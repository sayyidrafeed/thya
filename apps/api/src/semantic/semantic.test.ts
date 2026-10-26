import { describe, expect, test } from "bun:test";
import type { UIMessage } from "ai";
import type { MenuItem, PaymentDay, SaleRecord } from "../sales/report";
import { interpretation, pickExplanation } from "./explain";
import { eventsFromHistory, exposureLevel, queryMetricEvents, type ConceptEvent } from "./exposure";
import { computeMetric } from "./metrics";
import { findTerm } from "./terms";

const menu: MenuItem[] = [
  { id: "kopi", name: "Es Kopi Susu", category: "kopi", price: 18_000, cost: 7_500 },
  { id: "croissant", name: "Croissant", category: "makanan", price: 20_000, cost: 18_000 },
];

function sale(date: string, itemId: string, quantity: number, from: MenuItem[] = menu): SaleRecord {
  const item = from.find((candidate) => candidate.id === itemId);

  if (!item) throw new Error(`no menu item ${itemId}`);

  return { date, itemId, quantity, unitPrice: item.price, unitCost: item.cost };
}

// Last week only coffee; this week half the cups became low-margin croissants.
const records: SaleRecord[] = [
  sale("2026-10-12", "kopi", 100),
  sale("2026-10-19", "kopi", 60),
  sale("2026-10-19", "croissant", 60),
];

const thisWeek = { start: "2026-10-19", end: "2026-10-25" };
const lastWeek = { start: "2026-10-12", end: "2026-10-18" };

describe("terms", () => {
  test("matches the owner's word regardless of case and spacing", () => {
    expect(findTerm("  Laba   KOTOR ")?.concepts).toEqual(["gross_profit"]);
    expect(findTerm("untung")?.concepts).toEqual(["gross_profit", "net_profit"]);
    expect(findTerm("cuan")).toBeNull();
    expect(findTerm(null)).toBeNull();
  });
});

describe("computeMetric", () => {
  test('"profit" means gross profit while operating expenses are not recorded', () => {
    const result = computeMetric({
      requested: "profit",
      menu,
      records,
      payments: [],
      range: thisWeek,
      previousRange: lastWeek,
    });

    expect(result).toMatchObject({
      status: "ok",
      metric: "gross_profit",
      value: "Rp750.000",
      previousValue: "Rp1.050.000",
      change: "-28,6%",
    });
  });

  test("net profit is reported missing instead of computed from nothing", () => {
    const result = computeMetric({
      requested: "net_profit",
      menu,
      records,
      payments: [],
      range: thisWeek,
      previousRange: null,
    });

    expect(result).toEqual({
      status: "missing",
      metric: "net_profit",
      missing: "operating_expense",
    });
    expect(pickExplanation(result, "familiar").level).toBe("missing");
  });

  test("margin change is reported in percentage points", () => {
    const result = computeMetric({
      requested: "gross_margin",
      menu,
      records,
      payments: [],
      range: thisWeek,
      previousRange: lastWeek,
    });

    expect(result).toMatchObject({ value: "32,9%", previousValue: "58,3%", change: "-25,4 poin" });
  });

  test("a previous period without sales has no comparable margin or percent change", () => {
    const quietWeek = { start: "2026-10-05", end: "2026-10-11" };

    for (const requested of ["gross_margin", "revenue"] as const) {
      const result = computeMetric({
        requested,
        menu,
        records,
        payments: [],
        range: lastWeek,
        previousRange: quietWeek,
      });

      expect(result).toMatchObject({ change: null });
    }
  });

  test("tiny changes round to 0% without a sign, and a shrinking loss reads as an increase", () => {
    const tiny = [sale("2026-10-12", "kopi", 10_000), sale("2026-10-19", "kopi", 10_001)];

    const lossMenu: MenuItem[] = [{ ...menu[0]!, cost: 20_000 }];

    const losses = [
      sale("2026-10-12", "kopi", 2, lossMenu),
      sale("2026-10-19", "kopi", 1, lossMenu),
    ];

    const query = { range: thisWeek, previousRange: lastWeek, payments: [] };

    expect(computeMetric({ ...query, requested: "revenue", menu, records: tiny })).toMatchObject({
      change: "0%",
    });
    expect(
      computeMetric({ ...query, requested: "gross_profit", menu: lossMenu, records: losses }),
    ).toMatchObject({ value: "-Rp2.000", previousValue: "-Rp4.000", change: "+50%" });
  });
});

describe("uang masuk QRIS (G10)", () => {
  // Two payment days this week, one last week, one the day after the week ends.
  const payments: PaymentDay[] = [
    { date: "2026-10-18", amount: 40_000 },
    { date: "2026-10-19", amount: 97_500 },
    { date: "2026-10-25", amount: 18_000 },
    { date: "2026-10-26", amount: 500_000 },
  ];

  const query = { menu, records, payments, range: thisWeek, previousRange: lastWeek };

  test("is the sum of the payments inside the period, compared with the period before", () => {
    expect(computeMetric({ ...query, requested: "qris_in" })).toMatchObject({
      status: "ok",
      metric: "qris_in",
      value: "Rp115.500",
      previousValue: "Rp40.000",
      change: "+188,8%",
      estimated: false,
    });
  });

  test("S9-AC8: payments never change menu revenue", () => {
    for (const requested of ["revenue", "gross_profit", "gross_margin"] as const) {
      const without = computeMetric({ ...query, requested, payments: [] });
      const withPayments = computeMetric({ ...query, requested });

      expect(withPayments.status === "ok" && withPayments.value).toBe(
        without.status === "ok" && without.value,
      );
    }
  });

  test("a period without payments is Rp0 and has no percent change against it", () => {
    expect(
      computeMetric({ ...query, requested: "qris_in", range: lastWeek, previousRange: null }),
    ).toMatchObject({ value: "Rp40.000", change: null });
    expect(
      computeMetric({
        ...query,
        requested: "qris_in",
        range: { start: "2026-10-12", end: "2026-10-17" },
        previousRange: null,
      }),
    ).toMatchObject({ value: "Rp0" });
  });

  test("the owner's words map to the metric", () => {
    expect(findTerm("Uang masuk QRIS")?.concepts).toEqual(["qris_in"]);
    expect(findTerm("qris")?.concepts).toEqual(["qris_in"]);
  });
});

describe("estimated menu costs (semantic-education item 6)", () => {
  const guessed = (record: SaleRecord): SaleRecord => ({ ...record, costEstimated: true });

  // This week the croissant cost is only the owner's guess; last week is all known costs.
  const mixed = records.map((record) =>
    record.date === "2026-10-19" && record.itemId === "croissant" ? guessed(record) : record,
  );

  const query = { menu, payments: [], range: thisWeek, previousRange: lastWeek };

  test("every cost-based metric is flagged when any cost behind it is an estimate", () => {
    for (const requested of ["cogs", "gross_profit", "profit", "gross_margin"] as const) {
      expect(computeMetric({ ...query, requested, records: mixed })).toMatchObject({
        estimated: true,
      });
    }
  });

  test("revenue, items sold and QRIS money in never carry the flag", () => {
    for (const requested of ["revenue", "items_sold", "qris_in"] as const) {
      expect(computeMetric({ ...query, requested, records: mixed })).toMatchObject({
        estimated: false,
      });
    }
  });

  test("an estimate in the comparison period flags the change too, and known costs do not", () => {
    const guessedLastWeek = records.map((record) =>
      record.date === "2026-10-12" ? guessed(record) : record,
    );

    expect(
      computeMetric({ ...query, requested: "gross_profit", records: guessedLastWeek }),
    ).toMatchObject({ estimated: true });
    expect(
      computeMetric({
        ...query,
        requested: "gross_profit",
        records: guessedLastWeek,
        previousRange: null,
      }),
    ).toMatchObject({ estimated: false });
    expect(computeMetric({ ...query, requested: "gross_profit", records })).toMatchObject({
      estimated: false,
    });
  });
});

describe("pickExplanation", () => {
  const revenueNoHistory = computeMetric({
    requested: "revenue",
    menu,
    records,
    payments: [],
    range: lastWeek,
    previousRange: null,
  });

  test("a new concept gets the plain definition with the owner's own numbers", () => {
    expect(pickExplanation(revenueNoHistory, "new")).toEqual({
      level: "intro",
      text: "Omzet itu semua uang yang masuk dari jualan, sebelum dipotong modal atau biaya apa pun. Jadi Rp1.800.000 ini belum dipotong modal bahan Rp750.000.",
    });
  });

  test("a concept already seen is not explained again", () => {
    expect(pickExplanation(revenueNoHistory, "seen")).toEqual({ level: "none", text: null });
  });

  test("revenue up while gross profit falls triggers the pitfall, unless the owner is familiar", () => {
    const result = computeMetric({
      requested: "revenue",
      menu,
      records,
      payments: [],
      range: thisWeek,
      previousRange: lastWeek,
    });

    const warning =
      "Omzet naik dari Rp1.800.000 ke Rp2.280.000, tapi laba kotor turun dari Rp1.050.000 ke Rp750.000.";

    expect(pickExplanation(result, "seen").text).toStartWith(warning);
    expect(pickExplanation(result, "familiar").level).toBe("none");

    const firstTime = pickExplanation(result, "new");

    expect(firstTime.level).toBe("intro");
    expect(firstTime.text).toStartWith("Omzet itu semua uang");
    expect(firstTime.text).toContain(warning);
  });

  test("the gross profit answer does not repeat the revenue warning", () => {
    const result = computeMetric({
      requested: "gross_profit",
      menu,
      records,
      payments: [],
      range: thisWeek,
      previousRange: lastWeek,
    });

    expect(pickExplanation(result, "seen").level).toBe("none");
  });

  test("a pitfall is not counted as explaining the concept", () => {
    expect(queryMetricEvents("revenue", "pitfall", null)).toEqual([]);
  });
});

describe("interpretation", () => {
  test("names the metric only when the owner's word is ambiguous", () => {
    expect(interpretation("untung", "gross_profit")).toStartWith(
      '"untung" Thya hitung sebagai laba kotor',
    );
    expect(interpretation("modal", "cogs")).toBe('"modal" Thya hitung sebagai modal bahan (HPP).');
    expect(interpretation("laba kotor", "gross_profit")).toBeNull();
    expect(interpretation(null, "revenue")).toBeNull();
  });
});

describe("exposureLevel", () => {
  const explained: ConceptEvent = { concept: "gross_profit", kind: "explained" };
  const confused: ConceptEvent = { concept: "gross_profit", kind: "confused" };
  const correctUse: ConceptEvent = { concept: "gross_profit", kind: "correct_use" };

  test("moves new, seen, familiar and drops back on confusion", () => {
    expect(exposureLevel([], "gross_profit")).toBe("new");
    expect(exposureLevel([explained], "gross_profit")).toBe("seen");
    expect(exposureLevel([explained, explained], "gross_profit")).toBe("familiar");
    expect(exposureLevel([explained, explained, confused], "gross_profit")).toBe("seen");
    expect(exposureLevel([explained, correctUse, correctUse], "gross_profit")).toBe("familiar");
    expect(exposureLevel([explained], "revenue")).toBe("new");
  });

  test("the formal term counts as understanding only after Thya explained it", () => {
    expect(exposureLevel([correctUse, correctUse, correctUse], "gross_profit")).toBe("new");
    expect(exposureLevel([correctUse, explained, correctUse], "gross_profit")).toBe("seen");
  });
});

describe("eventsFromHistory", () => {
  test("replays explanations and correct use from earlier tool calls, skipping malformed parts", () => {
    const messages: UIMessage[] = [
      { id: "1", role: "user", parts: [{ type: "text", text: "laba kotor minggu ini?" }] },
      {
        id: "2",
        role: "assistant",
        parts: [
          {
            type: "tool-queryMetric",
            toolCallId: "a",
            state: "output-available",
            input: { userTerm: "laba kotor" },
            output: { metric: "gross_profit", explanation: { level: "intro" } },
          },
          {
            type: "tool-explainConcept",
            toolCallId: "b",
            state: "output-available",
            input: {},
            output: { concept: "not-a-concept" },
          },
        ],
      },
    ];

    expect(eventsFromHistory(messages)).toEqual([
      { concept: "gross_profit", kind: "correct_use" },
      { concept: "gross_profit", kind: "explained" },
    ]);
  });
});
