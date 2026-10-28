import { describe, expect, test } from "bun:test";
import type { z } from "zod";
import { formatRupiah } from "../sales/format";
import { buildDemoSales, demoBusiness } from "../sales/demo-shop";
import { runTurn } from "./run-turn";
import { scriptedModel } from "./testing";
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

  async function settle<T extends { status: string }>(
    result: T | AsyncIterable<T> | PromiseLike<T>,
  ): Promise<T> {
    const value = await result;

    if (Symbol.asyncIterator in Object(value))
      throw new Error("streaming tool output not expected");

    // SAFETY: the guard above rules out the AsyncIterable branch.
    return value as T;
  }

  async function succeeded<T extends { status: string }>(
    result: T | AsyncIterable<T> | PromiseLike<T>,
  ): Promise<Extract<T, { status: "ok" }>> {
    const value = await settle(result);

    if (value.status !== "ok") throw new Error(`tool failed: ${JSON.stringify(value)}`);

    // SAFETY: status "ok" selects exactly the success branch of ToolResult.
    return value as Extract<T, { status: "ok" }>;
  }

  test("explains a concept once per conversation, then answers with the number only", async () => {
    const { queryMetric } = createSalesTools(dataset, []);
    const call = { metric: "profit", userTerm: "untung", ...weekly } as const;

    const first = await succeeded(queryMetric.execute!(call, options));
    const second = await succeeded(queryMetric.execute!(call, options));

    expect(first.metric).toBe("gross_profit");
    expect(first.interpretedAs).toStartWith('"untung" Thya hitung sebagai laba kotor');
    expect(first.explanation.level).toBe("intro");
    expect(second.explanation).toEqual({ level: "none", text: null });
  });

  test("history from earlier turns counts, and asking again brings the explanation back", async () => {
    const seen = [{ concept: "revenue", kind: "explained" }] as const;
    const { queryMetric, explainConcept } = createSalesTools(dataset, [...seen]);
    const call = { metric: "revenue", userTerm: "omzet", ...weekly } as const;

    expect((await succeeded(queryMetric.execute!(call, options))).explanation.level).toBe("none");

    const asked = await succeeded(
      explainConcept.execute!({ concept: "menu_cost", depth: "detail" }, options),
    );

    expect(asked.text).toContain("Contohnya Es Kopi Susu Gula Aren dijual Rp18.000");
    expect(asked.text).toContain("Terkait: modal bahan (HPP), laba kotor.");
  });

  test("the owner's profit word picks the metric, whichever profit the model asked for (D2)", async () => {
    const { queryMetric } = createSalesTools(dataset, []);

    const untung = await succeeded(
      queryMetric.execute!({ metric: "net_profit", userTerm: "untung", ...weekly }, options),
    );

    const bersih = await succeeded(
      queryMetric.execute!({ metric: "profit", userTerm: "untung bersih", ...weekly }, options),
    );

    expect(untung).toMatchObject({ metric: "gross_profit", value: expect.stringMatching(/^Rp/) });
    expect(untung.interpretedAs).toStartWith('"untung" Thya hitung sebagai laba kotor');
    expect(bersih).toMatchObject({ metric: "net_profit", value: null });
    // Listed under net_profit too, "untung" read as laba bersih (eval untung-this-month).
    expect(queryMetricInputSchema.shape.metric.description).toContain(
      "net_profit = laba bersih (laba bersih, untung bersih)",
    );
  });

  test("net profit returns no number while operating expenses are missing", async () => {
    const { queryMetric } = createSalesTools(dataset, []);

    const result = await succeeded(
      queryMetric.execute!({ metric: "net_profit", userTerm: "untung bersih", ...weekly }, options),
    );

    expect(result.value).toBeNull();
    expect(result.explanation.level).toBe("missing");

    const { explainConcept } = createSalesTools(dataset, []);

    const asked = await succeeded(
      explainConcept.execute!({ concept: "net_profit", depth: "short" }, options),
    );

    expect(asked.text).toEndWith("Datanya belum dicatat Thya, jadi belum bisa dihitung.");
  });

  test("a refused period comes back as an error status the model can explain", async () => {
    const { getDailySales } = createSalesTools(dataset, []);

    const result = await settle(
      getDailySales.execute!({ period: "last_month", startDate: null, endDate: null }, options),
    );

    const tooLong = await settle(
      getDailySales.execute!(
        { period: "custom", startDate: "2026-08-01", endDate: "2026-10-20" },
        options,
      ),
    );

    expect(result.status).toBe("ok");
    expect(tooLong).toEqual({
      status: "error",
      message: "Rincian harian maksimal 31 hari. Pakai queryMetric untuk periode panjang.",
    });
  });

  describe("compareChannels", () => {
    const yesterday = { period: "yesterday", startDate: null, endDate: null } as const;

    test("without delivery data it is not ready, and only asks for a screenshot Thya can read", async () => {
      const off = await settle(
        createSalesTools(dataset, []).compareChannels.execute!(yesterday, options),
      );

      const on = await settle(
        createSalesTools(dataset, [], undefined, true).compareChannels.execute!(yesterday, options),
      );

      expect(off).toEqual({
        status: "not_ready",
        message:
          "Thya belum bisa membaca penjualan GoFood, GrabFood, atau ShopeeFood, jadi jualan online dan langsung belum bisa dibandingkan.",
      });
      expect(on).toMatchObject({ status: "not_ready" });
      expect("message" in on && on.message).toContain("Kirim screenshot");
    });

    test("compares direct sales with GoFood after commission, and explains the commission once", async () => {
      const withGofood = {
        ...dataset,
        channelSales: [
          {
            channel: "gofood" as const,
            date: "2026-10-24",
            grossSales: 350_000,
            netReceived: 280_000,
            orderCount: 25,
          },
        ],
      };

      const events: Parameters<typeof createSalesTools>[1] = [];
      const { compareChannels } = createSalesTools(withGofood, events);
      const first = await settle(compareChannels.execute!(yesterday, options));
      const second = await settle(compareChannels.execute!(yesterday, options));

      if (first.status !== "ok" || second.status !== "ok") throw new Error("expected ok");

      expect(first.channels.map((line) => line.label)).toEqual(["Langsung di toko", "GoFood"]);
      expect(first.channels[1]).toMatchObject({
        revenue: "Rp350.000",
        appCommission: "Rp70.000",
        estimated: true,
      });
      expect(first.estimateNote).toContain("perkiraan");
      expect(first.explanation).toStartWith("Potongan aplikasi itu");
      expect(second.explanation).toBeNull();
      expect(events).toContainEqual({ concept: "app_commission", kind: "explained" });
    });

    test("a reply copying the figures passes the number check; made-up margins fall back to a code-written comparison (Q2)", async () => {
      const withGofood = {
        ...dataset,
        channelSales: [
          {
            channel: "gofood" as const,
            date: "2026-10-24",
            grossSales: 350_000,
            netReceived: 280_000,
            orderCount: 25,
          },
        ],
      };

      const output = await settle(
        createSalesTools(withGofood, []).compareChannels.execute!(yesterday, options),
      );

      if (output.status !== "ok") throw new Error("expected ok");

      const [direct, gofood] = output.channels;

      if (direct?.status !== "ok" || gofood?.status !== "ok") throw new Error("expected figures");

      const turn = (texts: string[]) =>
        runTurn({
          model: scriptedModel(
            texts.flatMap((text) => [{ tool: "compareChannels", input: yesterday }, { text }]),
          ),
          business: demoBusiness,
          dataset: withGofood,
          messages: [{ role: "user", content: "kemarin gofood vs makan di tempat untung mana?" }],
          conceptEvents: [],
          now: new Date("2026-10-25T10:00:00+07:00"),
        });

      const copied = await turn([
        `Kemarin GoFood omzet *${gofood.revenue}*, dipotong ${gofood.appCommission}, laba kotor sekitar ${gofood.grossProfit} (perkiraan), margin ${gofood.margin}. Langsung di toko margin ${direct.margin}.`,
      ]);

      expect(copied.check.action).toBe("none");

      const invented = await turn([
        "GoFood margin 71,3%, langsung 12,9%.",
        "GoFood margin 72,4%, langsung 13,1%.",
      ]);

      expect(invented.check.action).toBe("template");
      expect(invented.reply).toContain(
        `- GoFood: omzet Rp350.000, laba kotor ${gofood.grossProfit} (margin ${gofood.margin}, perkiraan)`,
      );
    });
  });

  test("a spent round budget answers without running the query", async () => {
    const { queryMetric } = createSalesTools(dataset, [], { exhausted: () => true });

    const result = await settle(
      queryMetric.execute!({ metric: "revenue", userTerm: null, ...weekly }, options),
    );

    expect(result.status).toBe("error");
  });
});
