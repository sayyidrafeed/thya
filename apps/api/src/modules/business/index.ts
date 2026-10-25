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

// WhatsApp sends the sender as digits with the country code and no "+", e.g. 6281234567890.
export function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");

  return digits.startsWith("0") ? `62${digits.slice(1)}` : digits;
}

export async function findBusinessByPhone(db: Db, phone: string): Promise<Business | null> {
  const [row] = await db
    .select()
    .from(businesses)
    .where(eq(businesses.whatsappPhone, normalizePhone(phone)))
    .limit(1);

  return row ? toBusiness(row) : null;
}

export async function businessPhone(db: Db, businessId: string): Promise<string | null> {
  const [row] = await db
    .select({ phone: businesses.whatsappPhone })
    .from(businesses)
    .where(eq(businesses.id, businessId));

  return row?.phone ?? null;
}

// A tester's own copy of the demo shop, so their writes never touch the web demo's data.
export async function createPhoneBusiness(
  db: Db,
  profile: BusinessProfile,
  phone: string,
): Promise<Business> {
  const [row] = await db
    .insert(businesses)
    .values({ ...profile, whatsappPhone: normalizePhone(phone) })
    .returning();

  if (!row) throw new Error("business insert returned no row");

  return toBusiness(row);
}
