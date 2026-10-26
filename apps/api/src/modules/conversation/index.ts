import type { ModelMessage } from "ai";
import { and, asc, desc, eq, gt, gte, inArray, isNull, lte, max, sql } from "drizzle-orm";
import { z } from "zod";
import { repairHistory, summarySchema, type ConversationSummary } from "../../agent";
import type { Db } from "../../db/client";
import {
  conversationSummaries,
  inboundMessages,
  messages,
  outboundMessages,
} from "../../db/schema";

// Recent turns sent to the model. Compaction (B1) takes over once the thread passes its threshold.
const HISTORY_MESSAGES = 40;

export type MessageSource = (typeof messages.$inferInsert)["source"];

export async function appendMessages(
  db: Db,
  entry: { businessId: string; traceId: string; source: MessageSource; wamid?: string },
  turn: ModelMessage[],
) {
  if (turn.length === 0) return;

  await db.insert(messages).values(
    turn.map((message) => ({
      businessId: entry.businessId,
      traceId: entry.traceId,
      source: entry.source,
      wamid: entry.wamid ?? null,
      message,
    })),
  );
}

// The window starts at an owner message after the summary's cursor, so it never opens on a tool
// result whose call was cut, and never repeats what the summary already covers.
export async function loadHistory(db: Db, businessId: string): Promise<ModelMessage[]> {
  const cursor = (await loadSummary(db, businessId))?.coversThroughMessageId ?? 0;

  const recent = await db
    .select({ message: messages.message })
    .from(messages)
    .where(and(eq(messages.businessId, businessId), gt(messages.id, cursor)))
    .orderBy(desc(messages.id))
    .limit(HISTORY_MESSAGES);

  const ordered = recent.reverse().map((row) => row.message);
  const start = ordered.findIndex((message) => message.role === "user");

  return start === -1 ? [] : repairHistory(ordered.slice(start));
}

// Engine-plan B1: one summary row per business, replaced under an optimistic revision check.
export type StoredSummary = {
  revision: number;
  coversThroughMessageId: number;
  summary: ConversationSummary;
};

export async function loadSummary(db: Db, businessId: string): Promise<StoredSummary | null> {
  const [row] = await db
    .select()
    .from(conversationSummaries)
    .where(eq(conversationSummaries.businessId, businessId));

  if (!row) return null;

  return {
    revision: row.revision,
    coversThroughMessageId: row.coversThroughMessageId,
    summary: summarySchema.parse(row.summary),
  };
}

export async function saveSummary(
  db: Db,
  {
    businessId,
    previousRevision,
    coversThroughMessageId,
    summary,
  }: {
    businessId: string;
    previousRevision: number;
    coversThroughMessageId: number;
    summary: ConversationSummary;
  },
): Promise<boolean> {
  const values = {
    coversThroughMessageId,
    summary,
    revision: previousRevision + 1,
    updatedAt: new Date(),
  };

  const saved =
    previousRevision === 0
      ? await db
          .insert(conversationSummaries)
          .values({ businessId, ...values })
          .onConflictDoNothing()
          .returning({ revision: conversationSummaries.revision })
      : await db
          .update(conversationSummaries)
          .set(values)
          .where(
            and(
              eq(conversationSummaries.businessId, businessId),
              eq(conversationSummaries.revision, previousRevision),
            ),
          )
          .returning({ revision: conversationSummaries.revision });

  return saved.length > 0;
}

export async function messagesAfter(db: Db, businessId: string, afterId: number) {
  return db
    .select({ id: messages.id, message: messages.message })
    .from(messages)
    .where(and(eq(messages.businessId, businessId), gt(messages.id, afterId)))
    .orderBy(asc(messages.id));
}

// Rough size of what the next turn would send: characters of the stored messages after the cursor.
export async function historySize(db: Db, businessId: string): Promise<number> {
  const cursor = (await loadSummary(db, businessId))?.coversThroughMessageId ?? 0;

  const [row] = await db
    .select({ chars: sql<number>`coalesce(sum(length(${messages.message}::text)), 0)::integer` })
    .from(messages)
    .where(and(eq(messages.businessId, businessId), gt(messages.id, cursor)));

  return row?.chars ?? 0;
}

// Inbound WhatsApp messages: the wamid primary key drops a redelivered webhook (harness §4).
export type InboundRow = {
  wamid: string;
  phone: string;
  type: string;
  payload: object;
  receivedAt: Date;
};

export async function recordInbound(db: Db, rows: InboundRow[]) {
  if (rows.length === 0) return;

  await db.insert(inboundMessages).values(rows).onConflictDoNothing();
}

// Oldest first. The agent-turn queue runs one job per phone at a time, so no row lock is needed.
export async function unprocessedInbound(db: Db, phone: string) {
  return db
    .select()
    .from(inboundMessages)
    .where(and(eq(inboundMessages.phone, phone), isNull(inboundMessages.processedAt)))
    .orderBy(asc(inboundMessages.receivedAt), asc(inboundMessages.wamid));
}

export async function countInboundSince(db: Db, phone: string, since: Date) {
  return db.$count(
    inboundMessages,
    and(eq(inboundMessages.phone, phone), gte(inboundMessages.receivedAt, since)),
  );
}

export async function lastInboundAt(db: Db, businessId: string): Promise<Date | null> {
  const [row] = await db
    .select({ at: max(inboundMessages.receivedAt) })
    .from(inboundMessages)
    .where(eq(inboundMessages.businessId, businessId));

  return row?.at ?? null;
}

// Outbound WhatsApp messages (engine-plan A13). A turn's reply is written here in the same
// transaction that stores the turn, then delivered; a retried job finds the row instead of
// running the model again, and the idempotency key stops a second insert.
export const outboundPayloadSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("text"), to: z.string(), text: z.string() }),
  z.object({
    type: z.literal("image"),
    to: z.string(),
    attachmentId: z.string(),
    caption: z.string().nullable(),
  }),
  z.object({
    type: z.literal("buttons"),
    to: z.string(),
    body: z.string(),
    buttons: z
      .array(z.object({ id: z.string(), title: z.string() }))
      .min(1)
      .max(3),
  }),
  z.object({
    type: z.literal("template"),
    to: z.string(),
    name: z.string(),
    language: z.string(),
    bodyParams: z.array(z.string()),
    attachmentId: z.string().nullable(),
  }),
]);

export type OutboundPayload = z.infer<typeof outboundPayloadSchema>;

export type Outbound = { key: string; payload: OutboundPayload };

export type TurnCommit = {
  businessId: string | null;
  traceId: string;
  wamids: string[];
  history: ModelMessage[];
  outbound: Outbound[];
};

export async function commitTurn(db: Db, commit: TurnCommit) {
  const { businessId, traceId, wamids, history, outbound } = commit;

  await db.transaction(async (tx) => {
    if (businessId !== null && history.length > 0)
      await tx
        .insert(messages)
        .values(
          history.map((message) => ({ businessId, traceId, source: "whatsapp" as const, message })),
        );

    if (wamids.length > 0)
      await tx
        .update(inboundMessages)
        .set({ processedAt: new Date(), businessId, traceId })
        .where(inArray(inboundMessages.wamid, wamids));

    if (outbound.length > 0)
      await tx
        .insert(outboundMessages)
        .values(
          outbound.map(({ key, payload }) => ({
            idempotencyKey: key,
            businessId,
            traceId,
            kind: payload.type,
            payload,
          })),
        )
        .onConflictDoNothing();
  });
}

export type PendingOutbound = { id: string; payload: OutboundPayload };

// In insert order, so a reply's text always goes before its confirmation card.
export async function pendingOutbound(db: Db, to: string): Promise<PendingOutbound[]> {
  const rows = await db
    .select({ id: outboundMessages.id, payload: outboundMessages.payload })
    .from(outboundMessages)
    .where(
      and(eq(outboundMessages.status, "pending"), sql`${outboundMessages.payload}->>'to' = ${to}`),
    )
    .orderBy(asc(outboundMessages.sequence));

  return rows.map((row) => ({ id: row.id, payload: outboundPayloadSchema.parse(row.payload) }));
}

export async function markOutbound(
  db: Db,
  id: string,
  result: { status: "sent"; wamid: string } | { status: "failed"; error: string },
) {
  await db
    .update(outboundMessages)
    .set(
      result.status === "sent"
        ? { status: "sent", wamid: result.wamid, sentAt: new Date() }
        : { status: "failed", error: result.error },
    )
    .where(eq(outboundMessages.id, id));
}

export async function countOutbound(db: Db, traceId: string) {
  return db.$count(outboundMessages, eq(outboundMessages.traceId, traceId));
}

// Numbers with sends still pending since before `before`: their sender crashed after the commit.
export async function pendingRecipients(db: Db, before: Date): Promise<string[]> {
  const rows = await db
    .selectDistinct({ to: sql<string>`${outboundMessages.payload}->>'to'` })
    .from(outboundMessages)
    .where(and(eq(outboundMessages.status, "pending"), lte(outboundMessages.createdAt, before)));

  return rows.map((row) => row.to);
}
