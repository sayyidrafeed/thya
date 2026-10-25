import { escapeXml, FONT_FAMILY, PALETTE, rasterize, truncate } from "./render";

// Weekly recap card (S3 fills it). Every value arrives already formatted, so the card adds no numbers.

export const MAX_CARD_STATS = 4;

export type CardTrend = "up" | "down" | "flat";

export type CardStat = {
  label: string;
  value: string;
  change: string | null;
  trend: CardTrend | null;
};

export type SummaryCard = {
  businessName: string;
  title: string;
  periodLabel: string;
  stats: CardStat[];
  highlight: { label: string; value: string } | null;
  footnote: string | null;
};

const SIZE = 1080;
const MARGIN = 64;
const GAP = 32;
const TILE_WIDTH = (SIZE - MARGIN * 2 - GAP) / 2;
const TILE_HEIGHT = 220;
const TILES_TOP = 300;

const TREND_COLORS: Record<CardTrend, string> = {
  up: PALETTE.brand,
  down: PALETTE.negative,
  flat: PALETTE.inkMuted,
};

type TextOptions = {
  x: number;
  y: number;
  size: number;
  weight?: number;
  fill?: string;
  anchor?: "start" | "end";
};

function textEl(content: string, options: TextOptions): string {
  const { x, y, size, weight = 400, fill = PALETTE.ink, anchor = "start" } = options;

  return `<text x="${x}" y="${y}" font-size="${size}" font-weight="${weight}" fill="${fill}" text-anchor="${anchor}">${escapeXml(content)}</text>`;
}

function tileSvg(stat: CardStat, index: number): string {
  const x = MARGIN + (index % 2) * (TILE_WIDTH + GAP);
  const y = TILES_TOP + Math.floor(index / 2) * (TILE_HEIGHT + GAP);
  const changeColor = stat.trend === null ? PALETTE.inkMuted : TREND_COLORS[stat.trend];

  return [
    `<rect x="${x}" y="${y}" width="${TILE_WIDTH}" height="${TILE_HEIGHT}" rx="24" fill="${PALETTE.surfaceRaised}" stroke="${PALETTE.line}" stroke-width="2"/>`,
    textEl(truncate(stat.label, 24), { x: x + 32, y: y + 58, size: 28, fill: PALETTE.inkMuted }),
    textEl(truncate(stat.value, 15), { x: x + 32, y: y + 132, size: 54, weight: 700 }),
    stat.change === null
      ? ""
      : textEl(truncate(stat.change, 28), {
          x: x + 32,
          y: y + 186,
          size: 26,
          weight: 600,
          fill: changeColor,
        }),
  ].join("");
}

function highlightSvg(highlight: SummaryCard["highlight"], top: number): string {
  if (highlight === null) return "";

  return [
    `<rect x="${MARGIN}" y="${top}" width="${SIZE - MARGIN * 2}" height="132" rx="24" fill="${PALETTE.brandSoft}"/>`,
    textEl(truncate(highlight.label, 40), {
      x: MARGIN + 32,
      y: top + 52,
      size: 26,
      fill: PALETTE.inkMuted,
    }),
    textEl(truncate(highlight.value, 40), { x: MARGIN + 32, y: top + 102, size: 38, weight: 700 }),
  ].join("");
}

export function buildSummaryCardSvg(card: SummaryCard): string {
  if (card.stats.length < 1 || card.stats.length > MAX_CARD_STATS) {
    throw new RangeError(
      `renderSummaryCard: needs 1..${MAX_CARD_STATS} stats, got ${card.stats.length}`,
    );
  }

  const rows = Math.ceil(card.stats.length / 2);
  const highlightTop = TILES_TOP + rows * (TILE_HEIGHT + GAP) + 8;

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}" font-family="${FONT_FAMILY}">`,
    `<rect width="${SIZE}" height="${SIZE}" fill="${PALETTE.surface}"/>`,
    `<rect x="${MARGIN}" y="${MARGIN}" width="72" height="8" rx="4" fill="${PALETTE.brand}"/>`,
    textEl(truncate(card.businessName, 40), {
      x: MARGIN,
      y: 130,
      size: 30,
      weight: 600,
      fill: PALETTE.inkMuted,
    }),
    textEl(truncate(card.title, 30), { x: MARGIN, y: 200, size: 60, weight: 700 }),
    textEl(truncate(card.periodLabel, 48), { x: MARGIN, y: 252, size: 32, fill: PALETTE.inkMuted }),
    ...card.stats.map(tileSvg),
    highlightSvg(card.highlight, highlightTop),
    card.footnote === null
      ? ""
      : textEl(truncate(card.footnote, 64), {
          x: MARGIN,
          y: SIZE - 56,
          size: 24,
          fill: PALETTE.inkMuted,
        }),
    textEl("Thya", {
      x: SIZE - MARGIN,
      y: SIZE - 56,
      size: 28,
      weight: 700,
      fill: PALETTE.brand,
      anchor: "end",
    }),
    "</svg>",
  ].join("");
}

export function renderSummaryCard(card: SummaryCard): Uint8Array {
  return rasterize(buildSummaryCardSvg(card));
}
