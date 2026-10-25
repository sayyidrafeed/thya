import {
  barX,
  barY,
  createChartScene,
  defineChart,
  lineY,
  renderChartSvg,
  text,
} from "@tanstack/charts";
import { scaleBand } from "@tanstack/charts/scales/band";
import { scaleLinear } from "@tanstack/charts/scales/linear";
import { scalePoint } from "@tanstack/charts/scales/point";
import { formatCompactRupiah, formatCount } from "../../sales/format";
import type { DescribedRange } from "../../sales/report";
import { escapeXml, FONT_FAMILY, PALETTE, rasterize, toResvgSvg, truncate } from "./render";

export const MAX_DAILY_POINTS = 31;
export const MAX_RANKED_ITEMS = 10;

// Up to this many days a bar per day still reads well; longer ranges become a line.
export const MAX_DAILY_BARS = 14;

// Up to this many bars or points every value gets a label; above it only max, min and last.
const MAX_LABELLED_POINTS = 7;
const MAX_NAME_CHARS = 24;

const WIDTH = 1080;
const HEIGHT = 900;
const HEADER = 210;
const FOOTER = 56;
const SIDE = 24;
const PLOT_WIDTH = WIDTH - SIDE * 2;
const PLOT_HEIGHT = HEIGHT - HEADER - FOOTER;
const TICK_FONT = 24;
const VALUE_FONT = 24;

export type ChartUnit = "rupiah" | "count";

export type DailyPoint = { date: string; label: string; value: number };

export type RankedItem = { name: string; value: number };

export type ChartSpec =
  | {
      kind: "daily";
      metricLabel: string;
      unit: ChartUnit;
      range: DescribedRange;
      points: DailyPoint[];
    }
  | {
      kind: "ranking";
      metricLabel: string;
      unit: ChartUnit;
      range: DescribedRange;
      items: RankedItem[];
    };

export type ChartStyle = "bar" | "line" | "hbar";

export function chartStyle(spec: ChartSpec): ChartStyle {
  if (spec.kind === "ranking") return "hbar";

  return spec.points.length <= MAX_DAILY_BARS ? "bar" : "line";
}

function assertSize(spec: ChartSpec): void {
  const [count, max] =
    spec.kind === "daily"
      ? [spec.points.length, MAX_DAILY_POINTS]
      : [spec.items.length, MAX_RANKED_ITEMS];

  // Tools cap these before calling, so breaking the limit is a caller bug.
  if (count < 1 || count > max) {
    throw new RangeError(`renderChart: ${spec.kind} needs 1..${max} entries, got ${count}`);
  }
}

type Axis = { domain: [number, number]; ticks: number[] };

// Value labels sit above the zero line (negatives included), so only the top needs label room.
// Integer ticks only: rupiah and counts are whole numbers, so 0..1 must not show 0,2 steps.
export function valueAxis(values: number[], labelRoom: number): Axis {
  const min = Math.min(0, ...values);
  const max = Math.max(0, ...values);
  const span = max - min || 1;
  const rough = span / 4;
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  const step = Math.max(1, ([1, 2, 5, 10].find((m) => m * magnitude >= rough) ?? 10) * magnitude);
  const low = Math.floor(min / step) * step;
  const high = Math.max(Math.ceil(max / step) * step, low + step);

  const ticks = Array.from(
    { length: Math.round((high - low) / step) + 1 },
    (_, i) => low + i * step,
  );

  const room = (high - low) * labelRoom;

  return { domain: [low, high + room], ticks };
}

function labelledIndexes(values: number[]): Set<number> {
  if (values.length <= MAX_LABELLED_POINTS) return new Set(values.keys());

  const max = values.indexOf(Math.max(...values));
  const min = values.indexOf(Math.min(...values));

  return new Set([max, min, values.length - 1]);
}

const theme = {
  foreground: PALETTE.ink,
  muted: PALETTE.inkMuted,
  grid: PALETTE.line,
  background: PALETTE.surface,
  palette: [PALETTE.brand],
};

const grid = { stroke: PALETTE.line, strokeOpacity: 1 };
const tickLabels = { fontSize: TICK_FONT };

type LabelRow = { key: string; value: number; label: string | null };

function labelRows(keys: string[], values: number[], format: (value: number) => string) {
  const labelled = labelledIndexes(values);

  return values.map((value, index): LabelRow => ({
    key: keys[index] ?? String(index),
    value,
    label: labelled.has(index) ? format(value) : null,
  }));
}

function dailyDefinition(
  points: DailyPoint[],
  format: (value: number) => string,
  style: ChartStyle,
) {
  const values = points.map((point) => point.value);

  const labels = labelRows(
    points.map((point) => point.date),
    values,
    format,
  );

  const axis = valueAxis(values, 0.14);
  const tickText = new Map(points.map((point) => [point.date, point.label]));
  const fill = (row: { value: number }) => (row.value < 0 ? PALETTE.negative : PALETTE.brand);

  const series =
    style === "bar"
      ? barY(points, { x: "date", y: "value", fill, radius: { end: 6 } })
      : lineY(points, {
          x: "date",
          y: "value",
          stroke: PALETTE.brand,
          strokeWidth: 4,
          points: true,
        });

  return defineChart({
    marks: [
      series,
      text(labels, {
        id: "value-labels",
        x: "key",
        y: (row) => Math.max(row.value, 0),
        text: "label",
        fontSize: VALUE_FONT,
        fontWeight: 600,
        dy: -26,
      }),
    ],
    scales: {
      x: {
        scale:
          style === "bar"
            ? () => scaleBand<string>().padding(0.24)
            : () => scalePoint<string>().padding(0.4),
        axis: {
          ticks: { size: 0, format: (date: string) => tickText.get(date) ?? date },
          tickLabels: { ...tickLabels, thin: true },
        },
      },
      y: {
        scale: scaleLinear().domain(axis.domain),
        grid,
        axis: { line: false, ticks: { size: 0, values: axis.ticks, format }, tickLabels },
      },
    },
    theme,
  });
}

function rankingDefinition(items: RankedItem[], format: (value: number) => string) {
  const rows = items.map((item, index) => ({
    name: `${index + 1}. ${truncate(item.name, MAX_NAME_CHARS)}`,
    value: item.value,
    label: format(item.value),
  }));

  const axis = valueAxis(
    rows.map((row) => row.value),
    0.22,
  );

  return defineChart({
    marks: [
      barX(rows, {
        x: "value",
        y: "name",
        fill: (row) => (row.value < 0 ? PALETTE.negative : PALETTE.brand),
        radius: { end: 6 },
      }),
      text(rows, {
        id: "value-labels",
        x: (row) => Math.max(row.value, 0),
        y: "name",
        text: "label",
        fontSize: VALUE_FONT,
        fontWeight: 600,
        anchor: "start",
        dx: 12,
      }),
    ],
    scales: {
      x: {
        scale: scaleLinear().domain(axis.domain),
        grid,
        axis: { line: false, ticks: { size: 0, values: axis.ticks, format }, tickLabels },
      },
      y: {
        scale: () => scaleBand<string>().padding(0.28),
        axis: { line: false, ticks: { size: 0 }, tickLabels },
      },
    },
    theme,
  });
}

function plotSvg(spec: ChartSpec): string {
  const formatValue = spec.unit === "rupiah" ? formatCompactRupiah : formatCount;

  const size = { width: PLOT_WIDTH, height: PLOT_HEIGHT };

  const scene =
    spec.kind === "daily"
      ? createChartScene(dailyDefinition(spec.points, formatValue, chartStyle(spec)), size)
      : createChartScene(rankingDefinition(spec.items, formatValue), size);

  return renderChartSvg(scene, { ariaLabel: spec.metricLabel, idPrefix: "thya-chart" });
}

function headerSvg(spec: ChartSpec): string {
  const lines = [
    { text: truncate(spec.metricLabel, 40), size: 46, weight: 700, fill: PALETTE.ink, y: 84 },
    { text: truncate(spec.range.label, 52), size: 30, weight: 400, fill: PALETTE.inkMuted, y: 132 },
    ...(spec.range.dataUntil === undefined
      ? []
      : [
          {
            text: `Data sampai ${spec.range.dataUntil}`,
            size: 26,
            weight: 400,
            fill: PALETTE.inkMuted,
            y: 174,
          },
        ]),
  ];

  return lines
    .map(
      (line) =>
        `<text x="${SIDE + 24}" y="${line.y}" font-size="${line.size}" font-weight="${line.weight}" fill="${line.fill}">${escapeXml(line.text)}</text>`,
    )
    .join("");
}

// Full SVG before rasterizing; exposed so tests can check labels as text, not pixels.
export function buildChartSvg(spec: ChartSpec): string {
  assertSize(spec);

  const plot = toResvgSvg(plotSvg(spec), PLOT_WIDTH, PLOT_HEIGHT).replace(
    /^<svg /,
    `<svg x="${SIDE}" y="${HEADER}" `,
  );

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" font-family="${FONT_FAMILY}">`,
    `<rect width="${WIDTH}" height="${HEIGHT}" fill="${PALETTE.surface}"/>`,
    headerSvg(spec),
    plot,
    `<text x="${WIDTH - SIDE - 24}" y="${HEIGHT - 22}" text-anchor="end" font-size="24" font-weight="700" fill="${PALETTE.brand}">Thya</text>`,
    "</svg>",
  ].join("");
}

export function renderChart(spec: ChartSpec): Uint8Array {
  return rasterize(buildChartSvg(spec));
}
