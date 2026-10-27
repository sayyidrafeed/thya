import { describe, expect, test } from "bun:test";
import type { RawDeliveryDay } from "../payments-import";
import { planChannelImport, type StoredChannelSale } from ".";

const TODAY = "2026-10-27";

const day = (overrides: Partial<RawDeliveryDay>): RawDeliveryDay => ({
  day: 26,
  month: 10,
  year: null,
  grossSales: 350_000,
  netReceived: null,
  orderCount: null,
  ...overrides,
});

const plan = (days: RawDeliveryDay[], stored: StoredChannelSale[] = [], imageSeen = false) =>
  planChannelImport(days, stored, { channel: "gofood", imageSeen, today: TODAY });

describe("planChannelImport", () => {
  test("a GoFood summary becomes one row per day with a card the owner can check", () => {
    const result = plan([
      day({ day: 25, grossSales: 280_000, orderCount: 20, netReceived: 224_000 }),
      day({ day: 26, orderCount: 25 }),
    ]);

    expect(result.toInsert).toEqual([
      {
        date: "2026-10-25",
        grossSales: 280_000,
        netReceived: 224_000,
        orderCount: 20,
        sourceRow: 0,
      },
      { date: "2026-10-26", grossSales: 350_000, netReceived: null, orderCount: 25, sourceRow: 1 },
    ]);
    expect(result.card).toBe(
      [
        "Dari screenshot GoFood: 2 hari, penjualan kotor total Rp630.000.",
        "- Minggu, 25 Okt 2026: Rp280.000, 20 pesanan, diterima Rp224.000",
        "- Senin, 26 Okt 2026: Rp350.000, 25 pesanan",
        "Dicatat terpisah dari omzet menu. Simpan?",
      ].join("\n"),
    );
  });

  test("code owns the year: 30 Des without a year is last December", () => {
    const result = plan([day({ day: 30, month: 12 })]);

    expect(result.toInsert).toEqual([]);
    expect(result.card).toContain("Tidak dicatat: 1 lebih dari 90 hari lalu.");
  });

  test("future, unreadable, impossible and doubled days are named, never stored", () => {
    // Without a printed year, 28 Okt would read as last year (S9 year rule); with one it is ahead.
    const result = plan([
      day({ day: 28, year: 2026 }),
      day({ day: null }),
      day({ grossSales: -5 }),
      day({ grossSales: 12.5 }),
      day({ day: 24 }),
      day({ day: 24, grossSales: 999_000 }),
    ]);

    expect(result.toInsert.map((row) => row.date)).toEqual(["2026-10-24"]);
    expect(result.card).toContain(
      "Tidak dicatat: 1 tanggal di masa depan, 1 tanggal tidak terbaca, 2 angka tidak wajar, 1 tanggal dobel.",
    );
  });

  test("a net above gross or a broken order count is dropped, never guessed", () => {
    const result = plan([day({ netReceived: 400_000, orderCount: -3 })]);

    expect(result.toInsert).toEqual([
      {
        date: "2026-10-26",
        grossSales: 350_000,
        netReceived: null,
        orderCount: null,
        sourceRow: 0,
      },
    ]);
    expect(result.card).toContain(
      "1 angka uang diterima tidak wajar (lebih dari penjualan), tidak dipakai.",
    );
  });

  test("the same picture again adds nothing", () => {
    const result = plan([day({})], [], true);

    expect(result.toInsert).toEqual([]);
    expect(result.card).toBe(
      "Screenshot ini sudah pernah dicatat, Kak. Tidak ada yang ditambahkan.",
    );
  });

  test("a day already stored is never counted twice: same figure = recorded, other figure = kept as stored", () => {
    const result = plan(
      [day({ day: 24 }), day({ day: 25, grossSales: 410_000 }), day({ day: 26 })],
      [
        { date: "2026-10-24", grossSales: 350_000, netReceived: null },
        { date: "2026-10-25", grossSales: 300_000, netReceived: null },
      ],
    );

    expect(result.toInsert.map((row) => row.date)).toEqual(["2026-10-26"]);
    expect(result.alreadyRecorded.map((row) => row.date)).toEqual(["2026-10-24"]);
    expect(result.conflicting).toEqual([
      {
        row: {
          date: "2026-10-25",
          grossSales: 410_000,
          netReceived: null,
          orderCount: null,
          sourceRow: 1,
        },
        stored: { date: "2026-10-25", grossSales: 300_000, netReceived: null },
      },
    ]);
    expect(result.card).toContain("1 hari sudah tercatat sebelumnya.");
    expect(result.card).toContain(
      "Minggu, 25 Okt 2026 sudah tercatat Rp300.000, di screenshot Rp410.000. Tidak diganti.",
    );
  });

  test("a long period lists seven days and counts the rest", () => {
    const days = Array.from({ length: 9 }, (_, index) => day({ day: 10 + index }));
    const lines = plan(days).card.split("\n");

    expect(lines[0]).toBe("Dari screenshot GoFood: 9 hari, penjualan kotor total Rp3.150.000.");
    expect(lines).toContain("- dan 2 hari lain");
    expect(lines.filter((line) => line.startsWith("- ") && line.includes("Okt"))).toHaveLength(7);
  });
});
