import { and, desc, eq, gt, inArray, ne, sql } from "drizzle-orm";
import type { Db } from "../../db/client";
import { drafts } from "../../db/schema";

// Decision Q1 (widened by business-features-plan §4.3): pending → executing → done | failed, or
// pending → cancelled | expired. Every transition is an UPDATE guarded by the current status, so
// two taps on "Ya" start one execution.

// The one way back is undoTurnDrafts, for a run that never committed its card.

// Long enough to answer after serving a rush, short enough that a stray "ya" tomorrow does nothing.
export const DRAFT_TTL_MS = 6 * 60 * 60 * 1000;

// One total order, so the draft a turn keeps open is the one a typed "ya" finds as the latest.
const NEWEST_FIRST = [desc(drafts.createdAt), desc(drafts.id)];

export type Draft = typeof drafts.$inferSelect;

export type NewDraft = {
  businessId: string;
  kind: string;
  args: object;
  summary: string;
  traceId: string;
  now: Date;
};

// One open draft per business: a new draft replaces the old one ("Ubah" = cancel + new draft), so
// a typed "ya" can only ever mean the latest card. `replaced` is the open draft it took over.
export async function createDraft(
  db: Db,
  draft: NewDraft,
): Promise<{ draft: Draft; replaced: Draft | null }> {
  return db.transaction(async (tx) => {
    const [row] = await tx
      .insert(drafts)
      .values({
        businessId: draft.businessId,
        kind: draft.kind,
        args: draft.args,
        summary: draft.summary,
        traceId: draft.traceId,
        expiresAt: new Date(draft.now.getTime() + DRAFT_TTL_MS),
      })
      .returning();

    if (!row) throw new Error("draft insert returned no row");

    // `replacedBy` lets undoTurnDrafts reopen the card if this draft's run never commits its card.
    // Only drafts ranked before this one (now() is its created_at in this transaction), so a parallel
    // call's newer draft stays the one keepTurnDraft keeps and latestDraft finds.
    const cancelled = await tx
      .update(drafts)
      .set({ status: "cancelled", decidedAt: draft.now, outcome: { replacedBy: row.id } })
      .where(
        and(
          eq(drafts.businessId, draft.businessId),
          eq(drafts.status, "pending"),
          sql`(${drafts.createdAt}, ${drafts.id}) < (now(), ${row.id}::uuid)`,
        ),
      )
      .returning();

    // A lapsed draft took nothing from the owner, and neither did this turn's own: no card went out.
    const replaced = cancelled.find(
      (old) => old.expiresAt > draft.now && old.traceId !== draft.traceId,
    );

    return { draft: row, replaced: replaced ?? null };
  });
}

export async function openDraft(db: Db, businessId: string, now: Date): Promise<Draft | null> {
  const [row] = await db
    .select()
    .from(drafts)
    .where(
      and(
        eq(drafts.businessId, businessId),
        eq(drafts.status, "pending"),
        gt(drafts.expiresAt, now),
      ),
    )
    .orderBy(...NEWEST_FIRST)
    .limit(1);

  return row ?? null;
}

// The card a typed "ya" may still be answering, whatever became of it; older ones are out of reach.
export async function latestDraft(db: Db, businessId: string, now: Date): Promise<Draft | null> {
  const [row] = await db
    .select()
    .from(drafts)
    .where(and(eq(drafts.businessId, businessId), gt(drafts.expiresAt, now)))
    .orderBy(...NEWEST_FIRST)
    .limit(1);

  return row ?? null;
}

export async function findDraft(db: Db, businessId: string, draftId: string) {
  const [row] = await db
    .select()
    .from(drafts)
    .where(and(eq(drafts.id, draftId), eq(drafts.businessId, businessId)));

  return row ?? null;
}

export type Claim =
  | { status: "claimed"; draft: Draft }
  | { status: Exclude<Draft["status"], "pending"> | "missing" };

// pending → executing for exactly one caller. Anyone else learns why not: already done, cancelled,
// expired, or not this business's draft at all.
export async function claimDraft(
  db: Db,
  { businessId, draftId, now }: { businessId: string; draftId: string; now: Date },
): Promise<Claim> {
  const [claimed] = await db
    .update(drafts)
    .set({ status: "executing", decidedAt: now })
    .where(
      and(
        eq(drafts.id, draftId),
        eq(drafts.businessId, businessId),
        eq(drafts.status, "pending"),
        gt(drafts.expiresAt, now),
      ),
    )
    .returning();

  if (claimed) return { status: "claimed", draft: claimed };

  const current = await findDraft(db, businessId, draftId);

  if (current === null) return { status: "missing" };

  if (current.status !== "pending") return { status: current.status };

  await db
    .update(drafts)
    .set({ status: "expired" })
    .where(and(eq(drafts.id, draftId), eq(drafts.status, "pending")));

  return { status: "expired" };
}

export async function finishDraft(
  db: Db,
  draftId: string,
  result: { status: "done" | "failed"; outcome: object },
) {
  await db
    .update(drafts)
    .set({ status: result.status, outcome: result.outcome })
    .where(and(eq(drafts.id, draftId), eq(drafts.status, "executing")));
}

// `tap`: the wamid of the tapped Batal or Ubah, kept on the draft so the same tap answered again
// (its batch replayed after a dead run) counts the cancel it already made.
export async function cancelDraft(
  db: Db,
  {
    businessId,
    draftId,
    now,
    tap,
  }: { businessId: string; draftId: string; now: Date; tap?: string },
): Promise<boolean> {
  const thisDraft = and(eq(drafts.id, draftId), eq(drafts.businessId, businessId));

  const cancelled = await db
    .update(drafts)
    .set({
      status: "cancelled",
      decidedAt: now,
      outcome: tap === undefined ? undefined : { cancelledBy: tap },
    })
    .where(and(thisDraft, eq(drafts.status, "pending")))
    .returning({ id: drafts.id });

  if (cancelled.length > 0) return true;

  if (tap === undefined) return false;

  return (
    (await db.$count(
      drafts,
      and(
        thisDraft,
        eq(drafts.status, "cancelled"),
        eq(sql`${drafts.outcome}->>'cancelledBy'`, tap),
      ),
    )) > 0
  );
}

// Drafts of a turn that sent no card for them (all if it failed, else all but `keep`) never run (Q1).
export async function cancelTurnDrafts(
  db: Db,
  {
    businessId,
    traceId,
    now,
    keep,
  }: { businessId: string; traceId: string; now: Date; keep?: string },
) {
  await db
    .update(drafts)
    .set({ status: "cancelled", decidedAt: now })
    .where(
      and(
        eq(drafts.businessId, businessId),
        eq(drafts.traceId, traceId),
        eq(drafts.status, "pending"),
        keep === undefined ? undefined : ne(drafts.id, keep),
      ),
    );
}

// A run that never committed its card showed no drafts: delete them, reopen what they took over.
// `reopenedFor`: a message of the batch replaying that run, unprocessed until a turn answers it.
export async function undoTurnDrafts(
  db: Db,
  {
    businessId,
    traceId,
    reopenedFor,
  }: { businessId: string; traceId: string; reopenedFor: string },
) {
  await db.transaction(async (tx) => {
    const undone = await tx
      .delete(drafts)
      .where(
        and(
          eq(drafts.businessId, businessId),
          eq(drafts.traceId, traceId),
          inArray(drafts.status, ["pending", "cancelled"]),
        ),
      )
      .returning({ id: drafts.id });

    if (undone.length === 0) return;

    await tx
      .update(drafts)
      .set({ status: "pending", decidedAt: null, outcome: { reopenedFor } })
      .where(
        and(
          eq(drafts.businessId, businessId),
          eq(drafts.status, "cancelled"),
          inArray(
            sql`${drafts.outcome}->>'replacedBy'`,
            undone.map((draft) => draft.id),
          ),
        ),
      );
  });
}

// A failed turn's batch is never replayed, so cards reopened for any of its messages close again.
export async function closeReopenedDrafts(
  db: Db,
  { businessId, wamids, now }: { businessId: string; wamids: string[]; now: Date },
) {
  await db
    .update(drafts)
    .set({ status: "cancelled", decidedAt: now })
    .where(
      and(
        eq(drafts.businessId, businessId),
        eq(drafts.status, "pending"),
        inArray(sql`${drafts.outcome}->>'reopenedFor'`, wamids),
      ),
    );
}

// An answered turn sends one card (Q1), for its newest draft if still open; others it made had no
// card. If the model cancelled that newest draft, no older one of the turn takes its place.
export async function keepTurnDraft(
  db: Db,
  { businessId, traceId, now }: { businessId: string; traceId: string; now: Date },
): Promise<Draft | null> {
  const [newest] = await db
    .select()
    .from(drafts)
    .where(and(eq(drafts.businessId, businessId), eq(drafts.traceId, traceId)))
    .orderBy(...NEWEST_FIRST)
    .limit(1);

  const kept = newest?.status === "pending" ? newest : null;

  await cancelTurnDrafts(db, { businessId, traceId, now, keep: kept?.id });

  return kept;
}

export async function countDrafts(db: Db, businessId: string, status: Draft["status"]) {
  return db.$count(drafts, and(eq(drafts.businessId, businessId), eq(drafts.status, status)));
}
