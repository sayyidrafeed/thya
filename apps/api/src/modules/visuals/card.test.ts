import { describe, expect, test } from "bun:test";
import { buildSummaryCardSvg, renderSummaryCard, type SummaryCard } from "./card";

const card: SummaryCard = {
  businessName: "Kopi Senja",
  title: "Rekap minggu lalu",
  periodLabel: "19 Okt s.d. 25 Okt 2026",
  stats: [
    { label: "Omzet", value: "Rp24.580.000", change: "naik 12,4%", trend: "up" },
    { label: "Laba kotor", value: "Rp15.120.000", change: "turun 3,1%", trend: "down" },
    { label: "Margin kotor", value: "61,5%", change: null, trend: null },
  ],
  highlight: { label: "Menu terlaris", value: "Es Kopi Susu (312 cup)" },
  footnote: "Laba kotor = omzet dikurangi modal bahan.",
};

describe("renderSummaryCard", () => {
  test("produces a 1080 x 1080 PNG under 1 MB", () => {
    const png = renderSummaryCard(card);
    const view = new DataView(png.buffer, png.byteOffset);

    expect(Array.from(png.slice(1, 4))).toEqual([0x50, 0x4e, 0x47]);
    expect([view.getUint32(16), view.getUint32(20)]).toEqual([1080, 1080]);
    expect(png.byteLength).toBeLessThanOrEqual(1_000_000);
  });

  test("shows the given values verbatim and adds no numbers of its own", () => {
    const svg = buildSummaryCardSvg(card);
    const numbers = svg.match(/>[^<]*\d[^<]*</g)?.map((text) => text.slice(1, -1));

    expect(numbers).toEqual([
      "19 Okt s.d. 25 Okt 2026",
      "Rp24.580.000",
      "naik 12,4%",
      "Rp15.120.000",
      "turun 3,1%",
      "61,5%",
      "Es Kopi Susu (312 cup)",
    ]);
  });

  test("escapes markup in owner data", () => {
    const svg = buildSummaryCardSvg({ ...card, businessName: 'Kopi <b>"Senja"</b> & Co' });

    expect(svg).toContain("Kopi &lt;b&gt;&quot;Senja&quot;&lt;/b&gt; &amp; Co");
  });

  test("renders without optional parts and with a single stat", () => {
    expect(() =>
      renderSummaryCard({
        ...card,
        stats: card.stats.slice(0, 1),
        highlight: null,
        footnote: null,
      }),
    ).not.toThrow();
  });

  test.each([0, 5])("rejects %i stats", (count) => {
    const stats = Array.from(
      { length: count },
      () => card.stats[0] ?? { label: "", value: "", change: null, trend: null },
    );

    expect(() => buildSummaryCardSvg({ ...card, stats })).toThrow(RangeError);
  });
});
