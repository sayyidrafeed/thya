import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import type { ModelMessage } from "ai";
import { eq } from "drizzle-orm";
import { appendMessages, loadHistory } from "../modules/conversation";
import { ensureDemoBusiness } from "../modules/business";
import { recordTurn } from "../modules/traces";
import { buildDemoSales } from "../sales/demo-shop";
import { summarizeSales } from "../sales/report";
import { loadSalesDataset, seedDemoSales } from "../sales/repository";
import { computeMetric } from "../semantic/metrics";
import { appendConceptEvents, loadConceptEvents } from "../semantic/repository";
import { newTraceId } from "../trace";
import type { Db } from "./client";
import { runMigrations } from "./migrate";
import { menuCosts, menuItems, payments, transactions } from "./schema";
import { freshTestDb, integration } from "./testing";

const NOW = new Date("2026-10-25T14:00:00+07:00");

describe.if(integration)("postgres", () => {
  let db: Db;
  let businessId: string;

  beforeAll(async () => {
    db = await freshTestDb();
    businessId = (await ensureDemoBusiness(db)).id;
    await seedDemoSales(db, businessId, NOW);
    // Seeding ~21k rows takes under a second normally, but much longer on a busy CI runner.
  }, 60_000);

  afterAll(async () => {
    await db.$client.end();
  });

  test(
    "migrations and the demo seed can run again without changes",
    { timeout: 60_000 },
    async () => {
      const url = process.env.TEST_DATABASE_URL ?? "";

      await Promise.all(Array.from({ length: 6 }, () => runMigrations(url)));

      expect((await ensureDemoBusiness(db)).id).toBe(businessId);
      expect((await seedDemoSales(db, businessId, NOW)).transactions).toBe(0);
    },
  );

  test("the loader reproduces the generator for every finished day", async () => {
    const fromDb = await loadSalesDataset(db, businessId, NOW);
    const generated = buildDemoSales(NOW);

    const nameOf = (menu: { id: string; name: string }[]) =>
      new Map(menu.map((item) => [item.id, item.name]));

    const dbNames = nameOf(fromDb.menu);
    const generatedNames = nameOf(generated.menu);

    const pastDays = (records: typeof fromDb.records, names: Map<string, string>) =>
      records
        .filter((record) => record.date < fromDb.today)
        .map((record) => `${record.date}|${names.get(record.itemId)}|${record.quantity}`)
        .toSorted();

    expect(fromDb.dataStart).toBe(generated.dataStart);
    expect(pastDays(fromDb.records, dbNames)).toEqual(pastDays(generated.records, generatedNames));
  });

  test("hours that have not ended yet are not counted", async () => {
    const opening = await loadSalesDataset(db, businessId, new Date("2026-10-25T07:30:00+07:00"));

    expect(opening.records.filter((record) => record.date === "2026-10-25")).toEqual([]);
  });

  test("the same sheet row cannot be imported twice", async () => {
    const [item] = await db.select({ id: menuItems.id }).from(menuItems).limit(1);

    const row = {
      businessId,
      menuItemId: item!.id,
      soldOn: "2026-10-20",
      quantity: 3,
      unitPrice: 18_000,
      source: "sheet" as const,
      sourceSheetId: "sheet-1",
      sourceRow: 7,
    };

    await db.insert(transactions).values(row);

    await expect(db.insert(transactions).values(row).execute()).rejects.toThrow();
  });

  test("history comes back from the first owner message, with interrupted calls closed", async () => {
    const traceId = newTraceId();

    const turn: ModelMessage[] = [
      { role: "assistant", content: "sisa giliran lama" },
      { role: "user", content: "omzet minggu lalu?" },
      {
        role: "assistant",
        content: [{ type: "tool-call", toolCallId: "c1", toolName: "queryMetric", input: {} }],
      },
    ];

    await appendMessages(db, { businessId, traceId, source: "whatsapp" }, turn);

    const history = await loadHistory(db, businessId);

    expect(history.map((message) => message.role)).toEqual(["user", "assistant", "tool"]);
  });

  test("concept events and turn traces are stored per business", async () => {
    const traceId = newTraceId();

    await appendConceptEvents(db, { businessId, traceId }, [
      { concept: "gross_profit", kind: "explained" },
    ]);
    await recordTurn(db, {
      traceId,
      businessId,
      channel: "demo",
      durationMs: 1_200,
      outboundMessages: 1,
      model: "deepseek/deepseek-v4.1-flash",
      turn: {
        reply: "Omzet Rp1.000.",
        responseMessages: [],
        toolCalls: [
          { toolCallId: "c1", toolName: "queryMetric", input: {}, output: { status: "ok" } },
        ],
        attachments: [],
        conceptEvents: [],
        check: { action: "none", ungrounded: [], attempts: 1 },
        draft: null,
        choices: null,
        promptHash: "test",
        usage: { inputTokens: 10, cachedInputTokens: 5, outputTokens: 3 },
      },
    });

    expect(await loadConceptEvents(db, businessId)).toEqual([
      { concept: "gross_profit", kind: "explained" },
    ]);
  });

  test("a later cost applies from its date on, and last month's profit stays the same", async () => {
    const before = await loadSalesDataset(db, businessId, NOW);
    const lastWeek = { start: "2026-10-12", end: "2026-10-18" };
    const [item] = await db.select({ id: menuItems.id }).from(menuItems).limit(1);

    await db.insert(menuCosts).values({
      menuItemId: item!.id,
      amount: 99_000,
      source: "owner",
      validFrom: "2026-10-20",
    });

    const after = await loadSalesDataset(db, businessId, NOW);

    expect(summarizeSales(after.records, after.menu, lastWeek)).toEqual(
      summarizeSales(before.records, before.menu, lastWeek),
    );
    expect(after.menu.find((menuItem) => menuItem.id === item!.id)?.cost).toBe(99_000);
  });

  test("profit from an estimated cost is flagged from the cost's date on", async () => {
    const [item] = await db
      .select({ id: menuItems.id })
      .from(menuItems)
      .where(eq(menuItems.name, "Croissant Butter"));

    await db.insert(menuCosts).values({
      menuItemId: item!.id,
      amount: 10_000,
      source: "estimate",
      validFrom: "2026-10-21",
    });

    const dataset = await loadSalesDataset(db, businessId, NOW);

    const profit = (range: { start: string; end: string }) =>
      computeMetric({ ...dataset, requested: "gross_profit", range, previousRange: null });

    expect(profit({ start: "2026-10-21", end: "2026-10-24" })).toMatchObject({ estimated: true });
    expect(profit({ start: "2026-10-12", end: "2026-10-18" })).toMatchObject({ estimated: false });
  });

  test("payments are summed per WIB day, up to now", async () => {
    await db.insert(payments).values(
      (
        [
          ["2026-10-23T23:59:00+07:00", 10_000],
          ["2026-10-24T00:01:00+07:00", 20_000],
          ["2026-10-24T23:59:00+07:00", 30_000],
          ["2026-10-25T13:59:00+07:00", 40_000],
          ["2026-10-25T14:01:00+07:00", 50_000],
        ] as const
      ).map(([paidAt, amount]) => ({
        businessId,
        paidAt: new Date(paidAt),
        amount,
        method: "qris" as const,
        source: "chat" as const,
      })),
    );

    expect((await loadSalesDataset(db, businessId, NOW)).payments).toEqual([
      { date: "2026-10-23", amount: 10_000 },
      { date: "2026-10-24", amount: 50_000 },
      { date: "2026-10-25", amount: 40_000 },
    ]);
  });

  test("an explained QRIS concept can be stored (migration 0004)", async () => {
    await appendConceptEvents(db, { businessId, traceId: newTraceId() }, [
      { concept: "qris_in", kind: "explained" },
    ]);

    expect((await loadConceptEvents(db, businessId)).at(-1)).toEqual({
      concept: "qris_in",
      kind: "explained",
    });
  });

  test("re-seeding keeps a price the owner changed", async () => {
    const [item] = await db
      .select({ id: menuItems.id, name: menuItems.name })
      .from(menuItems)
      .limit(1);

    await db.update(menuItems).set({ price: 99_999 }).where(eq(menuItems.id, item!.id));
    await seedDemoSales(db, businessId, NOW);

    const [after] = await db
      .select({ price: menuItems.price })
      .from(menuItems)
      .where(eq(menuItems.id, item!.id));

    expect(after?.price).toBe(99_999);
  });
});
