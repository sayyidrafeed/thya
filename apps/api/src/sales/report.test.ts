import { describe, expect, test } from "bun:test";
import { buildDemoSales } from "./demo-shop";
import {
  rankMenuItems,
  resolvePeriod,
  summarizeSales,
  type MenuItem,
  type Period,
  type PeriodInput,
  type SaleRecord,
} from "./report";

const menu: MenuItem[] = [
  { id: "kopi", name: "Es Kopi Susu", category: "kopi", price: 18_000, cost: 7_500 },
  { id: "roti", name: "Roti Bakar", category: "makanan", price: 17_000, cost: 7_000 },
  { id: "teh", name: "Teh Tarik", category: "non-kopi", price: 14_000, cost: 4_500 },
];

function sale(date: string, itemId: string, quantity: number, from: MenuItem[] = menu): SaleRecord {
  const item = from.find((candidate) => candidate.id === itemId);

  if (!item) throw new Error(`no menu item ${itemId}`);

  return { date, itemId, quantity, unitPrice: item.price, unitCost: item.cost };
}

const records: SaleRecord[] = [
  sale("2026-10-19", "kopi", 99),
  sale("2026-10-20", "kopi", 10),
  sale("2026-10-20", "roti", 4),
  sale("2026-10-21", "kopi", 5),
  sale("2026-10-21", "roti", 6),
];

describe("summarizeSales", () => {
  test("totals revenue, HPP, gross profit and margin inside an inclusive range", () => {
    const summary = summarizeSales(records, menu, { start: "2026-10-20", end: "2026-10-21" });

    expect(summary).toEqual({
      revenue: 15 * 18_000 + 10 * 17_000,
      cogs: 15 * 7_500 + 10 * 7_000,
      grossProfit: 440_000 - 182_500,
      grossMarginPct: 58.5,
      itemsSold: 25,
      days: 2,
    });
  });

  test("reports zero margin instead of NaN when nothing sold", () => {
    expect(
      summarizeSales(records, menu, { start: "2026-10-01", end: "2026-10-01" }).grossMarginPct,
    ).toBe(0);
  });
});

describe("rankMenuItems", () => {
  const range = { start: "2026-10-20", end: "2026-10-21" };

  test("ranks best sellers by revenue with revenue share", () => {
    const ranked = rankMenuItems(records, menu, range, {
      sortBy: "revenue",
      direction: "best",
      limit: 2,
    });

    expect(ranked.map((item) => [item.rank, item.name, item.revenue])).toEqual([
      [1, "Es Kopi Susu", 270_000],
      [2, "Roti Bakar", 170_000],
    ]);
    expect(ranked[0]?.revenueSharePct).toBe(61.4);
  });

  test("lists items with no sales first when asking for the worst sellers", () => {
    const ranked = rankMenuItems(records, menu, range, {
      sortBy: "quantity",
      direction: "worst",
      limit: 1,
    });

    expect(ranked[0]).toMatchObject({ name: "Teh Tarik", quantity: 0 });
  });
});

describe("resolvePeriod", () => {
  const dataStart = "2026-07-01";
  // 2026-10-25 is a Sunday.
  const today = "2026-10-25";
  const named = (period: Period): PeriodInput => ({ period, startDate: null, endDate: null });

  const custom = (startDate: string | null, endDate: string | null): PeriodInput => ({
    period: "custom",
    startDate,
    endDate,
  });

  test("weeks start on Monday and full-day periods end yesterday", () => {
    expect(resolvePeriod(named("this_week"), today, dataStart)).toEqual({
      start: "2026-10-19",
      end: "2026-10-25",
    });
    expect(resolvePeriod(named("last_14_days"), today, dataStart)).toEqual({
      start: "2026-10-11",
      end: "2026-10-24",
    });
  });

  test("last month crosses the year boundary", () => {
    expect(resolvePeriod(named("last_month"), "2026-01-10", "2025-10-01")).toEqual({
      start: "2025-12-01",
      end: "2025-12-31",
    });
  });

  test("custom ranges without an end, or ending in the future, run until today", () => {
    expect(resolvePeriod(custom("2026-10-10", null), today, dataStart)).toEqual({
      start: "2026-10-10",
      end: today,
    });
    expect(resolvePeriod(custom("2026-10-10", "2026-10-31"), today, dataStart)).toEqual({
      start: "2026-10-10",
      end: today,
    });
  });

  test("rejects custom ranges with no start, a reversed order, a future start, or no data", () => {
    expect(() => resolvePeriod(custom(null, "2026-10-20"), today, dataStart)).toThrow(
      "butuh startDate",
    );
    expect(() => resolvePeriod(custom("2026-10-10", "2026-10-01"), today, dataStart)).toThrow(
      "tidak boleh setelah",
    );
    expect(() => resolvePeriod(custom("2026-11-01", "2026-11-30"), today, dataStart)).toThrow(
      "Belum ada data",
    );
    expect(() => resolvePeriod(custom("2026-06-30", "2026-07-05"), today, dataStart)).toThrow(
      "mulai 2026-07-01",
    );
  });
});

describe("buildDemoSales", () => {
  test("is deterministic per calendar date and only counts today's open hours", () => {
    // 06:00 WIB, before the shop opens at 07:00.
    const beforeOpening = buildDemoSales(new Date("2026-10-24T23:00:00Z"));
    // 23:00 WIB, after closing.
    const afterClosing = buildDemoSales(new Date("2026-10-25T16:00:00Z"));

    const today = (dataset: typeof beforeOpening) =>
      dataset.records.filter((record) => record.date === "2026-10-25");

    expect(today(beforeOpening).every((record) => record.quantity === 0)).toBe(true);
    expect(today(afterClosing).some((record) => record.quantity > 0)).toBe(true);

    const yesterday = (dataset: typeof beforeOpening) =>
      dataset.records.filter((record) => record.date === "2026-10-24");

    expect(yesterday(beforeOpening)).toEqual(yesterday(afterClosing));
  });
});
