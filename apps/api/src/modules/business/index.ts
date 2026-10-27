import { and, asc, eq, inArray, lte, ne, or, sql, type SQL } from "drizzle-orm";
import type { PgTable } from "drizzle-orm/pg-core";
import { z } from "zod";
import type { Db } from "../../db/client";
import {
  attachments,
  businesses,
  channelCommissions,
  channelSales,
  conceptEvents,
  conversationSummaries,
  drafts,
  inboundMessages,
  menuCosts,
  menuItems,
  messages,
  outboundMessages,
  payments,
  schedules,
  sheetConnections,
  transactions,
} from "../../db/schema";
import { demoBusiness } from "../../sales/demo-shop";
import { jakartaDate, MENU_CATEGORIES } from "../../sales/report";
import { seedDemoSales } from "../../sales/repository";

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
    .values({ ...profile, whatsappPhone: normalizePhone(phone), isDemoCopy: true })
    .returning();

  if (!row) throw new Error("business insert returned no row");

  return toBusiness(row);
}

export async function findBusiness(db: Db, businessId: string): Promise<Business | null> {
  const [row] = await db.select().from(businesses).where(eq(businesses.id, businessId));

  return row ? toBusiness(row) : null;
}

// A typo guard, not a price rule: no warung menu item sells or costs ten million rupiah.
const MAX_RUPIAH = 10_000_000;

// Every item rides in the profile block of every turn.
const MAX_MENU_ITEMS = 100;

// Same rule the agent uses to match a menu name, so two entries it cannot tell apart never coexist.
const menuKey = (name: string) => name.toLowerCase().replace(/\s+/g, " ").trim();

const profileText = z.string().trim().min(1).max(60);

// Filled in by the team after the owner's consent is recorded (docs/ops/vps-runbook.md).
export const onboardingFileSchema = z.object({
  phone: z
    .string()
    .regex(/^\+?\d{9,15}$/, "nomor WhatsApp: angka saja, 9 sampai 15 digit")
    .transform(normalizePhone)
    .refine((phone) => phone.startsWith("62"), "nomor WhatsApp harus diawali 62 atau 0"),
  business: z
    .object({
      name: profileText,
      kind: profileText,
      city: profileText,
      openHour: z.number().int().min(0).max(23),
      closeHour: z.number().int().min(1).max(24),
    })
    .refine((profile) => profile.openHour !== profile.closeHour, {
      message: "jam buka dan jam tutup tidak boleh sama",
      path: ["closeHour"],
    }),
  menu: z
    .array(
      z.object({
        name: profileText,
        category: z.enum(MENU_CATEGORIES),
        price: z.number().int().positive().max(MAX_RUPIAH),
        // Required: one item without a cost fails every turn (costOn) until partial coverage (E10).
        cost: z.object({
          amount: z.number().int().min(0).max(MAX_RUPIAH),
          source: z.enum(["owner", "estimate"]),
        }),
      }),
    )
    .min(1)
    .max(MAX_MENU_ITEMS)
    .refine(
      (menu) => new Set(menu.map((item) => menuKey(item.name))).size === menu.length,
      "ada nama menu yang dobel (huruf besar kecil dan spasi tidak dibedakan)",
    ),
});

export type OnboardingFile = z.infer<typeof onboardingFileSchema>;

type MenuEntry = OnboardingFile["menu"][number];

type StoredItem = Pick<typeof menuItems.$inferSelect, "id" | "name" | "category" | "price">;

type StoredCost = Pick<typeof menuCosts.$inferSelect, "menuItemId" | "amount" | "source">;

export type KeptItem = { name: string; fields: ("category" | "price" | "cost")[] };

export type OnboardingResult =
  | { status: "demo_copy" }
  | {
      status: "created" | "existing";
      businessId: string;
      added: string[];
      kept: KeptItem[];
      profileKept: (keyof BusinessProfile)[];
    };

function changedFields(entry: MenuEntry, item: StoredItem, cost: StoredCost | undefined) {
  const fields: KeptItem["fields"] = [];

  if (entry.category !== item.category) fields.push("category");

  if (entry.price !== item.price) fields.push("price");

  if (cost === undefined || cost.amount !== entry.cost.amount || cost.source !== entry.cost.source)
    fields.push("cost");

  return fields;
}

function changedProfile(file: BusinessProfile, stored: BusinessProfile) {
  const keys = ["name", "kind", "city", "openHour", "closeHour"] as const;

  return keys.filter((key) => file[key] !== stored[key]);
}

// Re-runs only add new menu items: a stored profile, price, category or cost never changes here.
export async function onboardBusiness(
  db: Db,
  file: OnboardingFile,
  now: Date,
): Promise<OnboardingResult> {
  const today = jakartaDate(now);

  return db.transaction(async (tx): Promise<OnboardingResult> => {
    const [found] = await tx
      .select()
      .from(businesses)
      .where(eq(businesses.whatsappPhone, file.phone));

    // A demo copy holds seed sales; a pilot owner's real menu must not land among them.
    if (found?.isDemo || found?.isDemoCopy) return { status: "demo_copy" };

    const [business] = found
      ? [found]
      : await tx
          .insert(businesses)
          .values({ ...file.business, whatsappPhone: file.phone })
          .returning();

    if (!business) throw new Error("business insert returned no row");

    const stored: StoredItem[] = await tx
      .select({
        id: menuItems.id,
        name: menuItems.name,
        category: menuItems.category,
        price: menuItems.price,
      })
      .from(menuItems)
      .where(eq(menuItems.businessId, business.id));

    // Oldest first, so the map ends on the cost in force today (the order loadMenu uses).
    const costs: StoredCost[] = await tx
      .select({
        menuItemId: menuCosts.menuItemId,
        amount: menuCosts.amount,
        source: menuCosts.source,
      })
      .from(menuCosts)
      .innerJoin(menuItems, eq(menuItems.id, menuCosts.menuItemId))
      .where(and(eq(menuItems.businessId, business.id), lte(menuCosts.validFrom, today)))
      .orderBy(asc(menuCosts.validFrom), asc(menuCosts.createdAt), asc(menuCosts.id));

    const inForce = new Map(costs.map((cost) => [cost.menuItemId, cost]));
    const byKey = new Map(stored.map((item) => [menuKey(item.name), item]));
    const added: string[] = [];
    const kept: KeptItem[] = [];

    for (const entry of file.menu) {
      const item = byKey.get(menuKey(entry.name));

      if (item) {
        const fields = changedFields(entry, item, inForce.get(item.id));

        if (fields.length > 0) kept.push({ name: item.name, fields });

        continue;
      }

      const [inserted] = await tx
        .insert(menuItems)
        .values({
          businessId: business.id,
          name: entry.name,
          category: entry.category,
          price: entry.price,
        })
        .returning({ id: menuItems.id });

      if (!inserted) throw new Error(`menu insert returned no row for ${entry.name}`);

      await tx.insert(menuCosts).values({
        menuItemId: inserted.id,
        amount: entry.cost.amount,
        source: entry.cost.source,
        validFrom: today,
      });

      added.push(entry.name);
    }

    return {
      status: found ? "existing" : "created",
      businessId: business.id,
      added,
      kept,
      profileKept: found ? changedProfile(file.business, found) : [],
    };
  });
}

type ResetScope = { table: string; from: PgTable; where: SQL | undefined };

// Rehearsal leftovers. Menu, seed rows and traces stay, so a failed rehearsal can still be read.
function resetScopes(db: Db, businessId: string, phone: string): ResetScope[] {
  const menu = db
    .select({ id: menuItems.id })
    .from(menuItems)
    .where(eq(menuItems.businessId, businessId));

  return [
    { table: "drafts", from: drafts, where: eq(drafts.businessId, businessId) },
    { table: "schedules", from: schedules, where: eq(schedules.businessId, businessId) },
    { table: "payments", from: payments, where: eq(payments.businessId, businessId) },
    { table: "channel_sales", from: channelSales, where: eq(channelSales.businessId, businessId) },
    {
      table: "channel_commissions",
      from: channelCommissions,
      where: eq(channelCommissions.businessId, businessId),
    },
    {
      table: "sheet_connections",
      from: sheetConnections,
      where: eq(sheetConnections.businessId, businessId),
    },
    {
      table: "transactions (non-seed)",
      from: transactions,
      where: and(eq(transactions.businessId, businessId), ne(transactions.source, "seed")),
    },
    {
      table: "menu_costs (non-seed)",
      from: menuCosts,
      where: and(inArray(menuCosts.menuItemId, menu), ne(menuCosts.source, "seed")),
    },
    { table: "messages", from: messages, where: eq(messages.businessId, businessId) },
    {
      table: "conversation_summaries",
      from: conversationSummaries,
      where: eq(conversationSummaries.businessId, businessId),
    },
    {
      table: "concept_events",
      from: conceptEvents,
      where: eq(conceptEvents.businessId, businessId),
    },
    {
      table: "inbound_messages",
      from: inboundMessages,
      // A row has no business until its turn runs, so the number also catches unprocessed ones.
      where: or(eq(inboundMessages.businessId, businessId), eq(inboundMessages.phone, phone)),
    },
    {
      table: "outbound_messages",
      from: outboundMessages,
      where: or(
        eq(outboundMessages.businessId, businessId),
        sql`${outboundMessages.payload}->>'to' = ${phone}`,
      ),
    },
    { table: "attachments", from: attachments, where: eq(attachments.businessId, businessId) },
  ];
}

export type ResetRows = { table: string; rows: number }[];

export type DemoResetResult =
  | { status: "not_registered" }
  | { status: "not_demo_copy"; name: string }
  | { status: "dry_run"; businessId: string; name: string; rows: ResetRows }
  | {
      status: "reset";
      businessId: string;
      name: string;
      rows: ResetRows;
      seeded: Awaited<ReturnType<typeof seedDemoSales>>;
    };

// Dry run unless `confirm`, and only ever the one demo copy behind this number.
export async function resetDemoCopy(
  db: Db,
  phone: string,
  { confirm = false, now }: { confirm?: boolean; now: Date },
): Promise<DemoResetResult> {
  const [business] = await db
    .select({ id: businesses.id, name: businesses.name, isDemoCopy: businesses.isDemoCopy })
    .from(businesses)
    .where(eq(businesses.whatsappPhone, normalizePhone(phone)));

  if (!business) return { status: "not_registered" };

  if (!business.isDemoCopy) return { status: "not_demo_copy", name: business.name };

  const rows = await db.transaction(async (tx) => {
    const counted: ResetRows = [];

    for (const { table, from, where } of resetScopes(db, business.id, normalizePhone(phone))) {
      counted.push({ table, rows: await tx.$count(from, where) });

      if (confirm) await tx.delete(from).where(where);
    }

    return counted;
  });

  const found = { businessId: business.id, name: business.name, rows };

  if (!confirm) return { status: "dry_run", ...found };

  return { status: "reset", ...found, seeded: await seedDemoSales(db, business.id, now) };
}
