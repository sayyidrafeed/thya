import { describe, expect, test } from "bun:test";
import type { ChannelSaleDay, MenuItem, SaleRecord } from "../sales/report";
import {
  compareChannels,
  dayCommission,
  describeChannels,
  noChannelDataMessage,
  type ChannelQuery,
} from "./channels";

const menu: MenuItem[] = [
  { id: "nasi", name: "Nasi Ayam", category: "makanan", price: 20_000, cost: 8_000 },
];

// Direct sales: Rp200.000 omzet, Rp80.000 ingredients, so online cost is estimated at 40%.
const records: SaleRecord[] = [
  { date: "2026-10-26", itemId: "nasi", quantity: 10, unitPrice: 20_000, unitCost: 8_000 },
];

const range = { start: "2026-10-26", end: "2026-10-26" };

const sale = (overrides: Partial<ChannelSaleDay>): ChannelSaleDay => ({
  channel: "gofood",
  date: "2026-10-26",
  grossSales: 350_000,
  netReceived: null,
  orderCount: null,
  ...overrides,
});

const query = (overrides: Partial<ChannelQuery>): ChannelQuery => ({
  menu,
  records,
  channelSales: [],
  commissions: [],
  range,
  ...overrides,
});

describe("commission per day", () => {
  test("a printed net wins over the owner's rate: commission = gross - net", () => {
    expect(
      dayCommission(sale({ netReceived: 280_000 }), {
        channel: "gofood",
        rateBps: 2_000,
        feePerOrder: 0,
      }),
    ).toEqual({ status: "ok", amount: 70_000, from: "screenshot" });
  });

  test("without a net, the owner's percent plus fee per order", () => {
    expect(
      dayCommission(sale({ grossSales: 100_000, orderCount: 10 }), {
        channel: "gofood",
        rateBps: 2_000,
        feePerOrder: 1_000,
      }),
    ).toEqual({ status: "ok", amount: 30_000, from: "owner_rate" });
  });

  test("no rate, or a fee per order without an order count, is missing rather than zero", () => {
    expect(dayCommission(sale({}), undefined)).toEqual({
      status: "missing",
      missing: "commission",
    });
    expect(
      dayCommission(sale({}), { channel: "gofood", rateBps: 2_000, feePerOrder: 1_000 }),
    ).toEqual({ status: "missing", missing: "order_count" });
  });
});

describe("compareChannels", () => {
  test("margin per channel after commission, with online cost from the shop's own ratio", () => {
    const lines = compareChannels(
      query({
        channelSales: [
          sale({ netReceived: 280_000 }),
          sale({ channel: "grabfood", grossSales: 100_000, orderCount: 10 }),
        ],
        commissions: [{ channel: "grabfood", rateBps: 2_000, feePerOrder: 1_000 }],
      }),
    );

    expect(lines).toEqual([
      {
        channel: "direct",
        status: "ok",
        revenue: 200_000,
        commission: 0,
        commissionFrom: null,
        cogs: 80_000,
        grossProfit: 120_000,
        marginPct: 60,
        days: 1,
        estimated: false,
      },
      {
        channel: "gofood",
        status: "ok",
        revenue: 350_000,
        commission: 70_000,
        commissionFrom: "screenshot",
        cogs: 140_000,
        grossProfit: 140_000,
        marginPct: 40,
        days: 1,
        estimated: true,
      },
      {
        channel: "grabfood",
        status: "ok",
        revenue: 100_000,
        commission: 30_000,
        commissionFrom: "owner_rate",
        cogs: 40_000,
        grossProfit: 30_000,
        marginPct: 30,
        days: 1,
        estimated: true,
      },
    ]);
  });

  test("screenshot days and rate days in one period are both used and marked mixed", () => {
    const [, gofood] =
      compareChannels(
        query({
          range: { start: "2026-10-25", end: "2026-10-26" },
          channelSales: [sale({ date: "2026-10-25", netReceived: 280_000 }), sale({})],
          commissions: [{ channel: "gofood", rateBps: 2_000, feePerOrder: 0 }],
        }),
      ) ?? [];

    expect(gofood).toMatchObject({ status: "ok", commission: 140_000, commissionFrom: "mixed" });
  });

  test("an unknown commission, a missing order count, or no direct sales leave the margin not ready", () => {
    const missing = compareChannels(
      query({
        channelSales: [sale({}), sale({ channel: "shopeefood", grossSales: 90_000 })],
        commissions: [{ channel: "shopeefood", rateBps: 2_500, feePerOrder: 2_000 }],
      }),
    );

    expect(missing?.slice(1)).toEqual([
      {
        channel: "gofood",
        status: "not_ready",
        revenue: 350_000,
        days: 1,
        missing: "commission",
        dates: ["2026-10-26"],
      },
      {
        channel: "shopeefood",
        status: "not_ready",
        revenue: 90_000,
        days: 1,
        missing: "order_count",
        dates: ["2026-10-26"],
      },
    ]);

    const noDirect = compareChannels(
      query({ records: [], channelSales: [sale({ netReceived: 280_000 })] }),
    );

    expect(noDirect?.[1]).toMatchObject({ status: "not_ready", missing: "cost_ratio" });
  });

  test("no delivery day in the period means nothing to compare", () => {
    expect(compareChannels(query({ channelSales: [sale({ date: "2026-10-20" })] }))).toBeNull();
  });

  test("a guessed menu cost makes the direct margin an estimate too", () => {
    const [direct] =
      compareChannels(
        query({
          records: records.map((record) => ({ ...record, costEstimated: true })),
          channelSales: [sale({ netReceived: 280_000 })],
        }),
      ) ?? [];

    expect(direct).toMatchObject({ channel: "direct", estimated: true });
  });
});

describe("describeChannels", () => {
  test("formats every figure, names the best margin and labels online figures as estimates", () => {
    const week = { start: "2026-10-20", end: "2026-10-26" };

    const lines = compareChannels(
      query({ range: week, channelSales: [sale({ netReceived: 280_000 })] }),
    );

    if (lines === null) throw new Error("expected a comparison");

    const described = describeChannels(lines, week);

    expect(described.channels[1]).toEqual({
      label: "GoFood",
      status: "ok",
      revenue: "Rp350.000",
      appCommission: "Rp70.000",
      commissionFrom: "dari screenshot (penjualan kotor dikurangi uang yang diterima)",
      cogs: "Rp140.000",
      grossProfit: "Rp140.000",
      margin: "40%",
      leftPer100k: "Rp40.000",
      daysWithData: 1,
      estimated: true,
    });
    expect(described.best).toBe(
      "Dari tiap Rp100.000 jualan, sisa untung paling besar ada di Langsung di toko: sekitar Rp60.000.",
    );
    expect(described.estimateNote).toContain("perkiraan");
    expect(described.coverageNote).toBe(
      "GoFood baru tercatat 1 dari 7 hari. Bandingkan sisa untung per Rp100.000, jangan total omzetnya.",
    );
  });

  test("a channel that is not ready carries guidance instead of a profit", () => {
    const lines = compareChannels(query({ channelSales: [sale({})] }));

    if (lines === null) throw new Error("expected a comparison");

    const { channels, best } = describeChannels(lines, range);

    expect(channels[1]).toEqual({
      label: "GoFood",
      status: "not_ready",
      revenue: "Rp350.000",
      daysWithData: 1,
      message:
        "Potongan GoFood belum Thya ketahui, jadi untungnya belum bisa dihitung. GoFood motong berapa persen, Kak? Kalau ada biaya per pesanan, sebut juga ya.",
    });
    expect(best).toBeNull();
  });
});

describe("noChannelDataMessage", () => {
  test("asks for a screenshot only when Thya can read one", () => {
    expect(noChannelDataMessage({ channelSales: [], importEnabled: true })).toContain(
      "Kirim screenshot ringkasan penjualan per hari",
    );
    expect(noChannelDataMessage({ channelSales: [], importEnabled: false })).toBe(
      "Thya belum bisa membaca penjualan GoFood, GrabFood, atau ShopeeFood, jadi jualan online dan langsung belum bisa dibandingkan.",
    );
  });

  test("names the dates that are recorded when the period has none", () => {
    expect(
      noChannelDataMessage({
        channelSales: [sale({ date: "2026-10-20" }), sale({ date: "2026-10-22" })],
        importEnabled: false,
      }),
    ).toBe(
      "Data GoFood, GrabFood, atau ShopeeFood untuk periode ini belum ada. Yang sudah tercatat 20 Okt 2026 s.d. 22 Okt 2026.",
    );
  });
});
