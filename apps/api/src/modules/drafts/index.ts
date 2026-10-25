import { and, desc, eq, gt } from "drizzle-orm";
import type { Db } from "../../db/client";
import { drafts } from "../../db/schema";

// Decision Q1 (widened by business-features-plan §4.3): pending → executing → done | failed, or
// pending → cancelled | expired. Every transition is an UPDATE guarded by the current status, so
// two taps on "Ya" start one execution.

// Long enough to answer after serving a rush, short enough that a stray "ya" tomorrow does nothing.
export const DRAFT_TTL_MS = 6 * 60 * 60 * 1000;

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
// a typed "ya" can only ever mean the latest card.
export async function createDraft(db: Db, draft: NewDraft): Promise<Draft> {
  return db.transaction(async (tx) => {
    await tx
      .update(drafts)
      .set({ status: "cancelled", decidedAt: draft.now })
      .where(and(eq(drafts.businessId, draft.businessId), eq(drafts.status, "pending")));

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

    return row;
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
    .orderBy(desc(drafts.createdAt))
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

export async function cancelDraft(
  db: Db,
  { businessId, draftId, now }: { businessId: string; draftId: string; now: Date },
): Promise<boolean> {
  const cancelled = await db
    .update(drafts)
    .set({ status: "cancelled", decidedAt: now })
    .where(
      and(eq(drafts.id, draftId), eq(drafts.businessId, businessId), eq(drafts.status, "pending")),
    )
    .returning({ id: drafts.id });

  return cancelled.length > 0;
}

export async function countDrafts(db: Db, businessId: string, status: Draft["status"]) {
  return db.$count(drafts, and(eq(drafts.businessId, businessId), eq(drafts.status, status)));
}
