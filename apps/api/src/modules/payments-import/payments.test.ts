import { describe, expect, test } from "bun:test";
import { MockLanguageModelV4 } from "ai/test";
import { scriptedModel, type ScriptStep } from "../../agent/testing";
import {
  extractPayments,
  normalizeExtraction,
  planPaymentsImport,
  resolveDate,
  type ExtractedRow,
} from ".";

const TODAY = "2026-10-25";

const row = (overrides: Partial<ExtractedRow>): ExtractedRow => ({
  sourceRow: 0,
  date: "2026-10-24",
  time: "07:12",
  amount: 18_000,
  direction: "in",
  status: "success",
  method: "qris",
  reference: null,
  ...overrides,
});

const raw = (transactions: object[]) => ({
  documentKind: "payment_history" as const,
  provider: "gopay_merchant" as const,
  transactions: transactions.map((transaction) => ({
    day: 24,
    month: 10,
    year: null,
    time: "07:12",
    amount: 18_000,
    direction: "in" as const,
    status: "success" as const,
    method: "qris" as const,
    reference: null,
    description: null,
    ...transaction,
  })),
  settlement: null,
  shownTotal: null,
  unreadableReason: null,
});

const plan = (rows: ExtractedRow[], stored = [], options = {}) =>
  planPaymentsImport(rows, stored, {
    imageSeen: false,
    bank: false,
    today: TODAY,
    shownTotal: null,
    ...options,
  });

describe("normalization (code owns the year and the references)", () => {
  test("a missing year is this year, or last year when that would be in the future", () => {
    expect(resolveDate({ day: 24, month: 10, year: null }, TODAY)).toBe("2026-10-24");
    expect(resolveDate({ day: 30, month: 12, year: null }, TODAY)).toBe("2025-12-30");
    expect(resolveDate({ day: 24, month: 10, year: 2025 }, TODAY)).toBe("2025-10-24");
    expect(resolveDate({ day: 24, month: null, year: null }, TODAY)).toBeNull();
  });

  test('"ID " prefixes go, and a reference on several rows is a merchant number, not an id', () => {
    const rows = normalizeExtraction(
      raw([
        { reference: "ID A1B2" },
        { reference: "NMID9" },
        { reference: "NMID9" },
        { time: "7.30" },
      ]),
      TODAY,
    );

    expect(rows.map((item) => item.reference)).toEqual(["A1B2", null, null, null]);
    expect(rows[3]?.time).toBe("07:30");
  });
});

describe("planPaymentsImport", () => {
  test("only money in that succeeded is imported; the rest is named on the card", () => {
    const result = plan([
      row({ sourceRow: 0, amount: 18_000 }),
      row({ sourceRow: 1, amount: 33_000, time: "08:05" }),
      row({ sourceRow: 2, status: "failed" }),
      row({ sourceRow: 3, direction: "out" }),
      row({ sourceRow: 4, status: "pending" }),
      row({ sourceRow: 5, amount: 99_000_000 }),
      row({ sourceRow: 6, date: "2026-10-26" }),
    ]);

    expect(result.toInsert.map((item) => [item.amount, item.paidAt])).toEqual([
      [18_000, "2026-10-24T00:12:00.000Z"],
      [33_000, "2026-10-24T01:05:00.000Z"],
    ]);
    expect(result.card).toBe(
      [
        "Dari screenshot 24 Okt 2026: 2 pembayaran masuk, total Rp51.000.",
        "Tidak dicatat: 1 gagal, 1 uang keluar (refund/biaya), 1 belum berhasil, 1 nominal tidak wajar, 1 tanggal di masa depan.",
        "Simpan?",
      ].join("\n"),
    );
  });

  test("bank statements keep QRIS only", () => {
    const result = plan(
      [
        row({ method: "qris", time: null }),
        row({ method: "transfer", time: null }),
        row({ method: "cash_deposit", time: null }),
      ],
      [],
      { bank: true },
    );

    expect(result.toInsert).toHaveLength(1);
    expect(result.card).toContain("2 bukan QRIS");
  });

  test("two equal payments in the same minute without references are both kept (same-minute)", () => {
    expect(plan([row({ sourceRow: 0 }), row({ sourceRow: 1 })]).toInsert).toHaveLength(2);
  });

  test("dedupe: same reference recorded, same minute and amount maybe, bank rows as a multiset", () => {
    const stored = [
      { paidAt: new Date("2026-10-24T07:12:00+07:00"), amount: 18_000, sourceRef: "R1" },
      { paidAt: new Date("2026-10-24T09:00:00+07:00"), amount: 46_500, sourceRef: null },
      { paidAt: new Date("2026-10-23T00:00:00+07:00"), amount: 36_000, sourceRef: null },
    ];

    const result = planPaymentsImport(
      [
        row({ sourceRow: 0, reference: "R1", time: "10:00" }),
        row({ sourceRow: 1, amount: 46_500, time: "09:00" }),
        row({ sourceRow: 2, date: "2026-10-23", time: null, amount: 36_000 }),
        row({ sourceRow: 3, date: "2026-10-23", time: null, amount: 36_000 }),
      ],
      stored,
      { imageSeen: false, bank: true, today: TODAY, shownTotal: null },
    );

    expect(result.alreadyRecorded.map((item) => item.sourceRow)).toEqual([0]);
    expect(result.maybeDuplicate.map((item) => item.sourceRow)).toEqual([1, 2]);
    expect(result.toInsert.map((item) => item.sourceRow)).toEqual([3]);
  });

  test("a resent screenshot adds nothing, whatever order the rows come back in (resent-reordered)", () => {
    const result = plan([row({ sourceRow: 1 }), row({ sourceRow: 0, amount: 33_000 })], [], {
      imageSeen: true,
    });

    expect(result.toInsert).toEqual([]);
    expect(result.card).toBe(
      "Screenshot ini sudah pernah dicatat, Kak. Tidak ada yang ditambahkan.",
    );
  });

  test("a total on the picture that differs from what was read is flagged, not blocked", () => {
    const result = plan([row({})], [], { shownTotal: 50_000 });

    expect(result.toInsert).toHaveLength(1);
    expect(result.card).toContain("Total di gambar Rp50.000, yang terbaca Rp18.000.");
  });
});

describe("extractPayments", () => {
  const image = new Uint8Array([137, 80, 78, 71]);

  test("returns normalized rows from the forced tool call", async () => {
    const model = scriptedModel([
      { tool: "recordExtraction", input: raw([{ reference: "ID X1" }]) },
      { text: "ok" },
    ]);

    const result = await extractPayments(image, {
      model,
      mediaType: "image/png",
      today: TODAY,
      delivery: false,
    });

    expect(result).toMatchObject({ status: "ok", rows: [{ date: "2026-10-24", reference: "X1" }] });
  });

  test("not a transaction, unreadable, and a failing model each give a fixed reply (netra-error)", async () => {
    const notTx = scriptedModel([
      { tool: "recordExtraction", input: { ...raw([]), documentKind: "not_transactions" } },
      { text: "ok" },
    ]);

    const failing = new MockLanguageModelV4({
      doGenerate: async () => {
        throw new Error("upstream 503");
      },
    });

    expect(
      await extractPayments(image, {
        model: notTx,
        mediaType: "image/png",
        today: TODAY,
        delivery: false,
      }),
    ).toMatchObject({
      status: "not_transactions",
    });
    expect(
      await extractPayments(image, {
        model: failing,
        mediaType: "image/png",
        today: TODAY,
        delivery: false,
      }),
    ).toEqual({
      status: "error",
      message: "Thya belum bisa baca gambarnya sekarang, coba kirim lagi sebentar ya Kak.",
    });
  });

  describe("delivery app sales summaries (DELIVERY_IMPORT_ENABLED)", () => {
    const summary = (provider: string): ScriptStep => ({
      tool: "recordExtraction",
      input: {
        ...raw([]),
        documentKind: "delivery_sales",
        provider,
        deliveryDays: [
          {
            day: 26,
            month: 10,
            year: null,
            grossSales: 350_000,
            netReceived: null,
            orderCount: 25,
          },
        ],
      },
    });

    const read = (step: ScriptStep, delivery: boolean) =>
      extractPayments(image, {
        model: scriptedModel([step, { text: "ok" }]),
        mediaType: "image/png",
        today: TODAY,
        delivery,
      });

    test("a GoFood summary comes back as its channel and the days as printed", async () => {
      expect(await read(summary("gofood"), true)).toEqual({
        status: "delivery_sales",
        channel: "gofood",
        days: [
          {
            day: 26,
            month: 10,
            year: null,
            grossSales: 350_000,
            netReceived: null,
            orderCount: 25,
          },
        ],
      });
    });

    test("an app the model cannot name has no channel, so nothing is drafted for it", async () => {
      expect(await read(summary("other"), true)).toMatchObject({
        status: "delivery_sales",
        channel: null,
      });
    });

    test("with the gate off the kind is not in the schema, so the call cannot return it", async () => {
      expect(await read(summary("gofood"), false)).toMatchObject({ status: "error" });
    });

    test("a payment screenshot still reads as payments with the gate on", async () => {
      expect(
        await read({ tool: "recordExtraction", input: { ...raw([{}]), deliveryDays: [] } }, true),
      ).toMatchObject({
        status: "ok",
        documentKind: "payment_history",
        rows: [{ amount: 18_000 }],
      });
    });
  });
});
