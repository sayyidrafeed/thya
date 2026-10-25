import { and, eq, gt, lte } from "drizzle-orm";
import type { Db } from "../../db/client";
import { attachments, businesses } from "../../db/schema";

// Business-features-plan §4.2: PNGs live a week in Postgres (one VPS, no object storage). Tools
// render and store; channels send. Ids are random v4 UUIDs, never time-ordered and guessable.

export const ATTACHMENT_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export const ATTACHMENT_KINDS = ["chart", "summary_card"] as const;

export type AttachmentKind = (typeof ATTACHMENT_KINDS)[number];

export type StoredAttachment = {
  id: string;
  kind: AttachmentKind;
  mime: "image/png";
  bytes: number;
};

export async function saveAttachment(
  db: Db,
  {
    businessId,
    kind,
    png,
    now,
  }: { businessId: string; kind: AttachmentKind; png: Uint8Array; now: Date },
): Promise<StoredAttachment> {
  const id = crypto.randomUUID();

  await db.insert(attachments).values({
    id,
    businessId,
    kind,
    png,
    expiresAt: new Date(now.getTime() + ATTACHMENT_TTL_MS),
  });

  return { id, kind, mime: "image/png", bytes: png.byteLength };
}

export async function loadAttachment(db: Db, id: string, now: Date): Promise<Uint8Array | null> {
  const [row] = await db
    .select({ png: attachments.png })
    .from(attachments)
    .where(and(eq(attachments.id, id), gt(attachments.expiresAt, now)));

  return row?.png ?? null;
}

// GET /attachments/:id serves the web demo's pictures only; a real business's never leave by HTTP.
export async function loadDemoAttachment(db: Db, id: string, now: Date) {
  const [row] = await db
    .select({ png: attachments.png })
    .from(attachments)
    .innerJoin(businesses, eq(businesses.id, attachments.businessId))
    .where(
      and(eq(attachments.id, id), eq(businesses.isDemo, true), gt(attachments.expiresAt, now)),
    );

  return row?.png ?? null;
}

export async function deleteExpiredAttachments(db: Db, now: Date) {
  const deleted = await db
    .delete(attachments)
    .where(lte(attachments.expiresAt, now))
    .returning({ id: attachments.id });

  return deleted.length;
}
