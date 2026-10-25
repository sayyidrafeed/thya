import { describe, expect, test } from "bun:test";
import { fileURLToPath } from "node:url";
import {
  buildChartSvg,
  chartStyle,
  renderChart,
  valueAxis,
  type ChartSpec,
  type DailyPoint,
} from "./chart";
import { formatCompactRupiah, formatCount } from "../../sales/format";

const range = { start: "2026-10-19", end: "2026-10-25", label: "19 Okt s.d. 25 Okt 2026", days: 7 };

const days = (count: number, value: (index: number) => number): DailyPoint[] =>
  Array.from({ length: count }, (_, index) => ({
    date: `2026-10-${String(index + 1).padStart(2, "0")}`,
    label: `${index + 1} Okt`,
    value: value(index),
  }));

const daily = (points: DailyPoint[], unit: "rupiah" | "count" = "rupiah"): ChartSpec => ({
  kind: "daily",
  metricLabel: "Omzet harian",
  unit,
  range,
  points,
});

const ranking = (items: { name: string; value: number }[]): ChartSpec => ({
  kind: "ranking",
  metricLabel: "Menu terlaris",
  unit: "rupiah",
  range,
  items,
});

const valueLabels = (svg: string) =>
  [...svg.matchAll(/data-ts-key="value-labels:[^"]*"[^>]*>([^<]*)<\/text>/g)].map(
    (match) => match[1],
  );

const tickLabels = (svg: string, axis: "x" | "y") =>
  [
    ...svg.matchAll(new RegExp(`data-ts-key="${axis}-tick-label:[^"]*"[^>]*>([^<]*)</text>`, "g")),
  ].map((match) => match[1]);

function pngSize(png: Uint8Array) {
  const view = new DataView(png.buffer, png.byteOffset);

  return { width: view.getUint32(16), height: view.getUint32(20) };
}

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

describe("chartStyle", () => {
  test("uses bars up to 14 days, a line above, and horizontal bars for rankings", () => {
    expect(chartStyle(daily(days(14, () => 1)))).toBe("bar");
    expect(chartStyle(daily(days(15, () => 1)))).toBe("line");
    expect(chartStyle(ranking([{ name: "Kopi", value: 1 }]))).toBe("hbar");
  });
});

describe("renderChart", () => {
  test("produces a valid PNG, 1080 px wide and under 1 MB", () => {
    for (const spec of [
      daily(days(7, (i) => i * 1_000)),
      daily(days(31, (i) => i)),
      ranking([{ name: "Kopi", value: 5 }]),
    ]) {
      const png = renderChart(spec);

      expect(Array.from(png.slice(0, 8))).toEqual(PNG_SIGNATURE);
      expect(pngSize(png).width).toBe(1080);
      expect(png.byteLength).toBeLessThanOrEqual(1_000_000);
    }
  });

  test("is byte-identical across two processes", () => {
    const module = fileURLToPath(new URL("./chart.ts", import.meta.url));

    const script = `
      import { renderChart } from ${JSON.stringify(module)};
      import { createHash } from "node:crypto";
      const points = Array.from({ length: 10 }, (_, i) => ({ date: "2026-10-" + String(i + 1).padStart(2, "0"), label: i + 1 + " Okt", value: (i * 7919) % 5000 }));
      const png = renderChart({ kind: "daily", metricLabel: "Omzet", unit: "rupiah", range: { label: "x" }, points });
      console.log(createHash("sha256").update(png).digest("hex"));
    `;

    const run = () => Bun.spawnSync([process.execPath, "-e", script]).stdout.toString().trim();
    const first = run();

    expect(first).toMatch(/^[0-9a-f]{64}$/);
    expect(run()).toBe(first);
  });
});

describe("buildChartSvg", () => {
  test("labels every bar with the formatted value of its point", () => {
    const points = days(7, (i) => 1_000_000 + i * 250_000);
    const svg = buildChartSvg(daily(points));

    expect(valueLabels(svg)).toEqual(points.map((point) => formatCompactRupiah(point.value)));
    expect(tickLabels(svg, "x")).toEqual(points.map((point) => point.label));
  });

  test("labels only the highest, lowest and last point on a long line", () => {
    const points = days(31, (i) => [5, 9, 2][i % 3] ?? 0);
    const svg = buildChartSvg(daily(points, "count"));

    expect(valueLabels(svg).toSorted()).toEqual([2, 5, 9].map(formatCount));
  });

  test("formats axis ticks with the unit formatter", () => {
    const svg = buildChartSvg(
      daily(
        days(3, () => 40),
        "count",
      ),
    );

    expect(tickLabels(svg, "y").every((label) => /^\d[\d.]*$/.test(label ?? ""))).toBe(true);
  });

  test("labels every ranked item and keeps the rank order", () => {
    const items = [
      { name: "Es Kopi Susu", value: 900 },
      { name: "Americano", value: 400 },
      { name: "Teh Tarik", value: 100 },
    ];

    const svg = buildChartSvg(ranking(items));

    expect(valueLabels(svg)).toEqual(["Rp900", "Rp400", "Rp100"]);
    expect(tickLabels(svg, "y")).toEqual(["1. Es Kopi Susu", "2. Americano", "3. Teh Tarik"]);
  });

  test("puts the range in the title and data cut-off in the subtitle", () => {
    const withToday = buildChartSvg({
      ...daily(days(2, () => 1)),
      range: {
        start: "2026-10-24",
        end: "2026-10-25",
        label: "24 Okt s.d. 25 Okt 2026",
        days: 2,
        dataUntil: "hari ini pukul 14.30 WIB",
      },
    });

    expect(withToday).toContain(">Omzet harian</text>");
    expect(withToday).toContain(">24 Okt s.d. 25 Okt 2026</text>");
    expect(withToday).toContain(">Data sampai hari ini pukul 14.30 WIB</text>");
    expect(buildChartSvg(daily(days(2, () => 1)))).not.toContain("Data sampai");
  });

  test("renders all-zero data on a 0..1 axis without fractional ticks", () => {
    const svg = buildChartSvg(daily(days(3, () => 0)));

    expect(tickLabels(svg, "y")).toEqual(["Rp0", "Rp1"]);
    expect(valueLabels(svg)).toEqual(["Rp0", "Rp0", "Rp0"]);
    expect(() => renderChart(daily(days(3, () => 0)))).not.toThrow();
  });

  test("renders a single point", () => {
    const svg = buildChartSvg(daily(days(1, () => 3_260_000)));

    expect(valueLabels(svg)).toEqual(["Rp3,3 jt"]);
  });

  test("draws a negative bar below zero with its signed label", () => {
    const svg = buildChartSvg(
      ranking([
        { name: "Kopi", value: 500 },
        { name: "Teh", value: -120_000 },
      ]),
    );

    expect(valueLabels(svg)).toEqual(["Rp500", "-Rp120 rb"]);
    expect(tickLabels(svg, "x")).toContain("Rp0");
    expect(() => renderChart(ranking([{ name: "Teh", value: -120_000 }]))).not.toThrow();
  });

  test("truncates long menu names and escapes markup", () => {
    const svg = buildChartSvg(
      ranking([
        { name: "Es Kopi Susu Gula Aren Spesial Kopi Senja", value: 3 },
        { name: 'Roti <Bakar> & "Keju" 🍞', value: 2 },
      ]),
    );

    expect(tickLabels(svg, "y")[0]).toBe("1. Es Kopi Susu Gula Aren …");
    expect(svg).not.toContain("Spesial");
    expect(svg).not.toContain("<Bakar>");
    expect(svg).toContain("Roti &lt;Bakar&gt; &amp;");
  });

  test("renders a name with emoji outside the font", () => {
    expect(() => renderChart(ranking([{ name: "Kopi ☕️🍞", value: 2 }]))).not.toThrow();
  });

  test("hands resvg plain SVG: namespace, no CSS variables, no inherited fonts", () => {
    const svg = buildChartSvg(daily(days(5, (i) => i)));

    expect(svg.match(/xmlns="http:\/\/www\.w3\.org\/2000\/svg"/g)?.length).toBe(2);
    expect(svg).not.toContain("var(");
    expect(svg).not.toContain('"inherit"');
    expect(svg).not.toContain('width="100%"');
  });

  test.each([
    ["no points", daily([])],
    ["32 points", daily(days(32, () => 1))],
    ["no items", ranking([])],
    ["11 items", ranking(Array.from({ length: 11 }, (_, i) => ({ name: `Menu ${i}`, value: i })))],
  ])("rejects %s as a caller bug", (_name, spec) => {
    expect(() => buildChartSvg(spec)).toThrow(RangeError);
  });
});

describe("valueAxis", () => {
  test("uses whole-number steps that cover the data", () => {
    expect(valueAxis([140, 235], 0).ticks).toEqual([0, 100, 200, 300]);
    expect(valueAxis([0, 3], 0).ticks).toEqual([0, 1, 2, 3]);
    expect(valueAxis([-120_000, 4_600_000], 0).ticks).toEqual([
      -2_000_000, 0, 2_000_000, 4_000_000, 6_000_000,
    ]);
  });
});
