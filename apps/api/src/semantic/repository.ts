import { asc, eq } from "drizzle-orm";
import type { Db } from "../db/client";
import { conceptEvents } from "../db/schema";
import type { ConceptEvent } from "./exposure";

// ConceptExposure (decision D5): the events replayed by exposureLevel, now durable per business.
export async function loadConceptEvents(db: Db, businessId: string): Promise<ConceptEvent[]> {
  const rows = await db
    .select({ concept: conceptEvents.concept, kind: conceptEvents.kind })
    .from(conceptEvents)
    .where(eq(conceptEvents.businessId, businessId))
    .orderBy(asc(conceptEvents.id));

  return rows;
}

export async function appendConceptEvents(
  db: Db,
  { businessId, traceId }: { businessId: string; traceId: string },
  events: ConceptEvent[],
) {
  if (events.length === 0) return;

  await db.insert(conceptEvents).values(events.map((event) => ({ businessId, traceId, ...event })));
}
