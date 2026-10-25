import { eq } from "drizzle-orm";
import type { Db } from "../../db/client";
import { businesses } from "../../db/schema";
import { demoBusiness } from "../../sales/demo-shop";

export type BusinessProfile = {
  name: string;
  kind: string;
  city: string;
  openHour: number;
  closeHour: number;
};

export type Business = BusinessProfile & { id: string };

function toBusiness(row: typeof businesses.$inferSelect): Business {
  return {
    id: row.id,
    name: row.name,
    kind: row.kind,
    city: row.city,
    openHour: row.openHour,
    closeHour: row.closeHour,
  };
}

export async function findDemoBusiness(db: Db): Promise<Business | null> {
  const [row] = await db.select().from(businesses).where(eq(businesses.isDemo, true)).limit(1);

  return row ? toBusiness(row) : null;
}

// Idempotent: the seed and every deploy can call it.
export async function ensureDemoBusiness(db: Db): Promise<Business> {
  const existing = await findDemoBusiness(db);

  if (existing) return existing;

  const [row] = await db
    .insert(businesses)
    .values({ ...demoBusiness, isDemo: true })
    .returning();

  if (!row) throw new Error("demo business insert returned no row");

  return toBusiness(row);
}
