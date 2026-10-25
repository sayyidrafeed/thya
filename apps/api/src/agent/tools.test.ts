import { describe, expect, test } from "bun:test";
import type { z } from "zod";
import { formatRupiah } from "../sales/format";
import { buildDemoSales } from "../sales/demo-shop";
import { createSalesTools, queryMetricInputSchema, topMenuItemsInputSchema } from "./tools";

describe("tool input validation", () => {
  test("accepts a complete call with null for dates that do not apply", () => {
    const call: z.infer<typeof topMenuItemsInputSchema> = {
      period: "this_week",
      startDate: null,
      endDate: null,
      sortBy: "quantity",
      direction: "worst",
      limit: 5,
    };

    expect(topMenuItemsInputSchema.parse(call)).toEqual(call);
  });

  test("requires every field so the model cannot silently drop one", () => {
    expect(
      queryMetricInputSchema.safeParse({
        metric: "revenue",
        userTerm: null,
        period: "custom",
        startDate: "2026-10-10",
      }).success,
    ).toBe(false);
    expect(
      topMenuItemsInputSchema.safeParse({ period: "today", startDate: null, endDate: null })
        .success,
    ).toBe(false);
  });

  test("rejects unknown periods, malformed dates and out-of-range limits", () => {
    const noDates = { startDate: null, endDate: null };

    const revenue = { metric: "revenue", userTerm: null };

    expect(
      queryMetricInputSchema.safeParse({ ...revenue, period: "minggu_ini", ...noDates }).success,
    ).toBe(false);
    expect(
      queryMetricInputSchema.safeParse({
        ...revenue,
        period: "custom",
        startDate: "20-10-2026",
        endDate: "2026-10-25",
      }).success,
    ).toBe(false);
    expect(
      topMenuItemsInputSchema.safeParse({
        period: "today",
        ...noDates,
        sortBy: "revenue",
        direction: "best",
        limit: 50,
      }).success,
    ).toBe(false);
  });
});

test("formatRupiah uses Indonesian thousand separators", () => {
  expect(formatRupiah(1_250_000)).toBe("Rp1.250.000");
  expect(formatRupiah(-18_000)).toBe("-Rp18.000");
});

describe("semantic tools", () => {
  const dataset = buildDemoSales(new Date("2026-10-25T10:00:00+07:00"));
  const options = { toolCallId: "test", messages: [], context: {} };
  const weekly = { period: "last_7_days", startDate: null, endDate: null } as const;

  async function settle<T>(result: T | AsyncIterable<T> | PromiseLike<T>): Promise<T> {
    const value = await result;

    if (Symbol.asyncIterator in Object(value))
      throw new Error("streaming tool output not expected");

    // SAFETY: the guard above rules out the AsyncIterable branch.
    return value as T;
  }

  test("explains a concept once per conversation, then answers with the number only", async () => {
    const { queryMetric } = createSalesTools(dataset, []);
    const call = { metric: "profit", userTerm: "untung", ...weekly } as const;

    const first = await settle(queryMetric.execute!(call, options));
    const second = await settle(queryMetric.execute!(call, options));

    expect(first.metric).toBe("gross_profit");
    expect(first.interpretedAs).toStartWith('"untung" Thya hitung sebagai laba kotor');
    expect(first.explanation.level).toBe("intro");
    expect(second.explanation).toEqual({ level: "none", text: null });
  });

  test("history from earlier turns counts, and asking again brings the explanation back", async () => {
    const seen = [{ concept: "revenue", kind: "explained" }] as const;
    const { queryMetric, explainConcept } = createSalesTools(dataset, [...seen]);
    const call = { metric: "revenue", userTerm: "omzet", ...weekly } as const;

    expect((await settle(queryMetric.execute!(call, options))).explanation.level).toBe("none");

    const asked = await settle(
      explainConcept.execute!({ concept: "menu_cost", depth: "detail" }, options),
    );

    expect(asked.text).toContain("Contohnya Es Kopi Susu Gula Aren dijual Rp18.000");
    expect(asked.text).toContain("Terkait: modal bahan (HPP), laba kotor.");
  });

  test("net profit returns no number while operating expenses are missing", async () => {
    const { queryMetric } = createSalesTools(dataset, []);

    const result = await settle(
      queryMetric.execute!({ metric: "net_profit", userTerm: "untung bersih", ...weekly }, options),
    );

    expect(result.value).toBeNull();
    expect(result.explanation.level).toBe("missing");

    const { explainConcept } = createSalesTools(dataset, []);

    const asked = await settle(
      explainConcept.execute!({ concept: "net_profit", depth: "short" }, options),
    );

    expect(asked.text).toEndWith("Datanya belum dicatat Thya, jadi belum bisa dihitung.");
  });
});
