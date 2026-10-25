import { describe, expect, test } from "bun:test";
import { ungroundedNumbers } from "../../agent";
import { buildDemoSales, type SalesDataset } from "../../sales/demo-shop";
import { rankMenuItems, summarizeSales } from "../../sales/report";
import type { ConceptEvent } from "../../semantic/exposure";
import { computeMetric } from "../../semantic/metrics";
import { buildRecap, RECAP_MAX_CHARS } from ".";
import { renderSummaryCard } from "../visuals";

// Sunday afternoon: yesterday is Saturday 24 Oct, last week is 12-18 Oct.
const NOW = new Date("2026-10-25T14:00:00+07:00");
const dataset = buildDemoSales(NOW);
const yesterday = { start: "2026-10-24", end: "2026-10-24" };
const lastWeek = { start: "2026-10-12", end: "2026-10-18" };

function evidence(source: SalesDataset): string[] {
  const metrics = (["revenue", "gross_profit", "gross_margin"] as const).flatMap((requested) => [
    computeMetric({
      requested,
      menu: source.menu,
      records: source.records,
      range: lastWeek,
      previousRange: { start: "2026-10-05", end: "2026-10-11" },
    }),
    computeMetric({
      requested,
      menu: source.menu,
      records: source.records,
      range: yesterday,
      previousRange: { start: "2026-10-17", end: "2026-10-17" },
    }),
  ]);

  return [
    JSON.stringify(metrics),
    JSON.stringify([
      summarizeSales(source.records, source.menu, lastWeek),
      summarizeSales(source.records, source.menu, yesterday),
    ]),
    JSON.stringify(
      [lastWeek, yesterday].map((range) =>
        rankMenuItems(source.records, source.menu, range, {
          sortBy: "quantity",
          direction: "best",
          limit: 1,
        }),
      ),
    ),
    "2026-10-24 2026-10-17 2026-10-12 2026-10-18 2026-10-05 2026-10-11",
  ];
}

const recapOf = (source: SalesDataset, kind: "daily" | "weekly", events: ConceptEvent[]) =>
  buildRecap({ dataset: source, businessName: "Kopi Senja" }, kind, events);

const withoutDates = (source: SalesDataset, drop: (date: string) => boolean): SalesDataset => ({
  ...source,
  records: source.records.filter((record) => !drop(record.date)),
});

describe("buildRecap", () => {
  test("S3-AC1: the same data and date always give the same recap", () => {
    expect(recapOf(dataset, "weekly", [])).toEqual(recapOf(dataset, "weekly", []));
    expect(recapOf(dataset, "daily", [])).toEqual(recapOf(dataset, "daily", []));
  });

  test("S3-AC2: every figure in the text and card comes from sales/ and semantic/", () => {
    for (const kind of ["daily", "weekly"] as const) {
      const recap = recapOf(dataset, kind, []);
      const cardText = JSON.stringify(recap.card ?? {});

      expect(ungroundedNumbers(recap.text, evidence(dataset))).toEqual([]);
      expect(ungroundedNumbers(cardText, evidence(dataset))).toEqual([]);

      for (const fact of recap.facts) expect(recap.text + cardText).toContain(fact);
    }
  });

  test("a daily recap covers yesterday even mid-day, against the same weekday last week", () => {
    const { text } = recapOf(dataset, "daily", []);

    expect(text).toStartWith("*Rekap kemarin, Sabtu 24 Okt 2026*");
    expect(text).toContain("dibanding Sabtu pekan lalu");
  });

  test("the weekly recap has a summary card with the four stats", () => {
    const { card, text } = recapOf(dataset, "weekly", []);

    expect(text).toStartWith("*Rekap minggu lalu (12 Okt 2026 s.d. 18 Okt 2026)*");
    expect(card?.stats.map((stat) => stat.label)).toEqual([
      "Omzet",
      "Laba kotor",
      "Margin kotor",
      "Terjual",
    ]);
  });

  test("S3-AC3: at most one did-you-know, only for a concept seen but not familiar", () => {
    const seen = [
      { concept: "gross_profit", kind: "explained" },
      { concept: "gross_margin", kind: "explained" },
    ] as const;

    const familiar = [...seen, ...seen];

    expect(recapOf(dataset, "weekly", [...seen]).text.match(/Tahukah Kakak/g)).toHaveLength(1);
    expect(recapOf(dataset, "weekly", [...familiar]).text).not.toContain("Tahukah Kakak");
    expect(recapOf(dataset, "weekly", []).text).not.toContain("Tahukah Kakak");
  });

  test("S3-AC4: recaps fit an image caption", () => {
    const seen = [{ concept: "gross_profit", kind: "explained" }] as const;

    expect(recapOf(dataset, "weekly", [...seen]).text.length).toBeLessThanOrEqual(RECAP_MAX_CHARS);
    expect(recapOf(dataset, "daily", []).text.length).toBeLessThanOrEqual(RECAP_MAX_CHARS);
  });

  test("a closed day yesterday says so, without a percentage", () => {
    const { text, facts } = recapOf(
      withoutDates(dataset, (date) => date === "2026-10-24"),
      "daily",
      [],
    );

    expect(text).toBe("*Rekap kemarin, Sabtu 24 Okt 2026*\nKemarin belum ada penjualan tercatat.");
    expect(facts).toEqual([]);
  });

  test("an empty week before means no comparison, never an infinite increase", () => {
    const { text } = recapOf(
      withoutDates(dataset, (date) => date >= "2026-10-05" && date <= "2026-10-11"),
      "weekly",
      [],
    );

    expect(text).not.toContain("dibanding");
    expect(text).not.toContain("∞");
  });

  test("a business younger than a week gets the days it has, not 'minggu lalu'", () => {
    const young = {
      ...withoutDates(dataset, (date) => date < "2026-10-16"),
      dataStart: "2026-10-16",
    };

    const { text, card } = recapOf(young, "weekly", []);

    expect(text).toStartWith("*Rekap 16 Okt 2026 s.d. 18 Okt 2026* (data mulai 16 Okt 2026)");
    expect(text).not.toContain("dibanding");
    expect(card?.title).toBe("Rekap penjualan");
  });

  test("a week without sales says so instead of printing a 0% margin", () => {
    const closed = withoutDates(dataset, (date) => date >= "2026-10-12" && date <= "2026-10-18");
    const { text, card, facts } = recapOf(closed, "weekly", []);

    expect(text).toBe(
      "*Rekap minggu lalu (12 Okt 2026 s.d. 18 Okt 2026)*\nBelum ada penjualan tercatat.",
    );
    expect(card).toBeNull();
    expect(facts).toEqual([]);
  });

  test("the weekly card renders as a PNG through the visuals renderer", () => {
    const { card } = recapOf(dataset, "weekly", []);

    if (card === null) throw new Error("weekly recap has no card");

    const png = renderSummaryCard(card);

    expect(Array.from(png.subarray(0, 4))).toEqual([0x89, 0x50, 0x4e, 0x47]);
  });
});
