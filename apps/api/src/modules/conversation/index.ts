import type { ModelMessage } from "ai";
import { desc, eq } from "drizzle-orm";
import { repairHistory } from "../../agent";
import type { Db } from "../../db/client";
import { messages } from "../../db/schema";

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

// The window starts at an owner message, so it never opens on a tool result whose call was cut.
export async function loadHistory(db: Db, businessId: string): Promise<ModelMessage[]> {
  const recent = await db
    .select({ message: messages.message })
    .from(messages)
    .where(eq(messages.businessId, businessId))
    .orderBy(desc(messages.id))
    .limit(HISTORY_MESSAGES);

  const ordered = recent.reverse().map((row) => row.message);
  const start = ordered.findIndex((message) => message.role === "user");

  return start === -1 ? [] : repairHistory(ordered.slice(start));
}
