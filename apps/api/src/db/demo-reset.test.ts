import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { and, eq, inArray } from "drizzle-orm";
import {
  createPhoneBusiness,
  onboardBusiness,
  onboardingFileSchema,
  resetDemoCopy,
} from "../modules/business";
import { demoBusiness } from "../sales/demo-shop";
import { seedDemoSales } from "../sales/repository";
import type { Db } from "./client";
import {
  attachments,
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
} from "./schema";
import { freshTestDb, integration } from "./testing";

// Wiping rehearsals off one demo copy, and nothing else.

const NOW = new Date("2026-10-28T10:00:00+07:00");
const NEXT_DAY = new Date("2026-10-29T10:00:00+07:00");
const REHEARSAL = "6281200000041";
const BYSTANDER = "6281200000042";
const PILOT = "6281200000043";

const RESET_TABLES = [
  "drafts",
  "schedules",
  "payments",
  "channel_sales",
  "channel_commissions",
  "sheet_connections",
  "transactions (non-seed)",
  "menu_costs (non-seed)",
  "messages",
  "conversation_summaries",
  "concept_events",
  "inbound_messages",
  "outbound_messages",
  "attachments",
];

// A rehearsal also leaves inbound and outbound rows that no turn has linked to the business yet.
const UNLINKED = new Set(["inbound_messages", "outbound_messages"]);

const each = (rows: number) =>
  RESET_TABLES.map((table) => ({ table, rows: UNLINKED.has(table) ? rows * 2 : rows }));

// One row in every table a rehearsal writes to.
async function rehearse(db: Db, businessId: string, phone: string) {
  const traceId = crypto.randomUUID();

  const [item] = await db
    .select({ id: menuItems.id, price: menuItems.price })
    .from(menuItems)
    .where(eq(menuItems.businessId, businessId))
    .limit(1);

  if (!item) throw new Error("the business needs a menu first");

  await db.insert(drafts).values({
    businessId,
    kind: "sales.record",
    args: {},
    summary: "2 menu",
    expiresAt: NOW,
    traceId,
  });
  await db
    .insert(schedules)
    .values({ businessId, kind: "recap", frequency: "daily", time: "07:00", nextRunAt: NOW });
  await db
    .insert(payments)
    .values({ businessId, paidAt: NOW, amount: 20_000, method: "qris", source: "chat" });
  await db.insert(channelSales).values({
    businessId,
    channel: "gofood",
    soldOn: "2026-10-27",
    grossSales: 100_000,
    source: "screenshot",
  });
  await db
    .insert(channelCommissions)
    .values({ businessId, channel: "gofood", rateBps: 2_000, feePerOrder: 0 });
  await db.insert(sheetConnections).values({
    businessId,
    spreadsheetId: "sheet",
    sheetTitle: "Laporan",
    tabId: 0,
    tabTitle: "Sheet1",
  });
  await db.insert(transactions).values({
    businessId,
    menuItemId: item.id,
    soldOn: "2026-10-28",
    quantity: 2,
    unitPrice: item.price,
    source: "chat",
  });
  await db
    .insert(menuCosts)
    .values({ menuItemId: item.id, amount: 8_000, source: "owner", validFrom: "2026-10-28" });

  const [message] = await db
    .insert(messages)
    .values({
      businessId,
      traceId,
      message: { role: "user", content: "omzet?" },
      source: "whatsapp",
    })
    .returning({ id: messages.id });

  await db.insert(conversationSummaries).values({
    businessId,
    revision: 1,
    coversThroughMessageId: message?.id ?? 0,
    summary: {},
  });
  await db
    .insert(conceptEvents)
    .values({ businessId, concept: "revenue", kind: "explained", traceId });
  await db.insert(inboundMessages).values({
    wamid: `wamid.${phone}`,
    businessId,
    phone,
    type: "text",
    payload: {},
    processedAt: NOW,
  });
  await db.insert(inboundMessages).values({
    wamid: `wamid.unprocessed.${phone}`,
    phone,
    type: "text",
    payload: {},
  });
  await db
    .insert(outboundMessages)
    .values({ idempotencyKey: `reply:${phone}`, businessId, kind: "text", payload: {} });
  await db.insert(outboundMessages).values({
    idempotencyKey: `unregistered:${phone}`,
    kind: "text",
    payload: { to: phone },
  });
  await db
    .insert(attachments)
    .values({ businessId, kind: "chart", png: new Uint8Array([1]), expiresAt: NOW });
}

describe.if(integration)("demo number reset", () => {
  let db: Db;
  let rehearsalId: string;
  let pilotId: string;

  const seedRows = (businessId: string) =>
    db.$count(
      transactions,
      and(eq(transactions.businessId, businessId), eq(transactions.source, "seed")),
    );

  beforeAll(async () => {
    db = await freshTestDb();

    for (const phone of [REHEARSAL, BYSTANDER]) {
      const copy = await createPhoneBusiness(db, demoBusiness, phone);

      await seedDemoSales(db, copy.id, NOW);
      await rehearse(db, copy.id, phone);

      if (phone === REHEARSAL) rehearsalId = copy.id;
    }

    const pilot = await onboardBusiness(
      db,
      onboardingFileSchema.parse({
        phone: PILOT,
        business: { ...demoBusiness, name: "Warung Pilot" },
        menu: [
          {
            name: "Nasi Rames",
            category: "makanan",
            price: 15_000,
            cost: { amount: 7_000, source: "owner" },
          },
        ],
      }),
      NOW,
    );

    if (pilot.status === "demo_copy") throw new Error("the pilot number was taken");

    pilotId = pilot.businessId;
    await rehearse(db, pilotId, PILOT);
  }, 60_000);

  afterAll(async () => {
    await db.$client.end();
  });

  test("without confirm it only counts, per table, what it would delete", async () => {
    const dryRun = { status: "dry_run", businessId: rehearsalId, rows: each(1) };

    expect(await resetDemoCopy(db, REHEARSAL, { now: NEXT_DAY })).toMatchObject(dryRun);
    expect(await resetDemoCopy(db, REHEARSAL, { now: NEXT_DAY })).toMatchObject(dryRun);
  });

  test("with confirm it clears that one demo copy and refills its seed", async () => {
    const seeded = await seedRows(rehearsalId);
    const result = await resetDemoCopy(db, REHEARSAL, { confirm: true, now: NEXT_DAY });

    if (result.status !== "reset") throw new Error(`expected a reset, got ${result.status}`);

    expect(result.rows).toEqual(each(1));
    expect(result.seeded.transactions).toBeGreaterThan(0);
    expect(await seedRows(rehearsalId)).toBe(seeded + result.seeded.transactions);
    expect(await resetDemoCopy(db, REHEARSAL, { now: NEXT_DAY })).toMatchObject({ rows: each(0) });

    // The menu and its seed costs are the demo shop itself.
    const menu = db
      .select({ id: menuItems.id })
      .from(menuItems)
      .where(eq(menuItems.businessId, rehearsalId));

    expect(await db.$count(menuItems, eq(menuItems.businessId, rehearsalId))).toBe(11);
    expect(
      await db.$count(
        menuCosts,
        and(inArray(menuCosts.menuItemId, menu), eq(menuCosts.source, "seed")),
      ),
    ).toBe(11);

    // Another tester's demo copy keeps everything.
    expect(await resetDemoCopy(db, BYSTANDER, { now: NEXT_DAY })).toMatchObject({ rows: each(1) });
  });

  test("a pilot owner's business and an unknown number are refused, and nothing is deleted", async () => {
    expect(await resetDemoCopy(db, PILOT, { confirm: true, now: NEXT_DAY })).toEqual({
      status: "not_demo_copy",
      name: "Warung Pilot",
    });
    expect(await resetDemoCopy(db, "6281299999998", { confirm: true, now: NEXT_DAY })).toEqual({
      status: "not_registered",
    });

    expect(await db.$count(drafts, eq(drafts.businessId, pilotId))).toBe(1);
    expect(await db.$count(messages, eq(messages.businessId, pilotId))).toBe(1);
    expect(await db.$count(transactions, eq(transactions.businessId, pilotId))).toBe(1);
    expect(await db.$count(menuItems, eq(menuItems.businessId, pilotId))).toBe(1);
  });
});
