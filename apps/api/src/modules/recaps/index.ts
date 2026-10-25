// Recap content is written by code, never by the model (decision G3, business-features-plan S3).
import type { SalesDataset } from "../../sales/demo-shop";
import { formatCount } from "../../sales/format";
import {
  addDays,
  describeRange,
  formatDateId,
  previousRange,
  rankMenuItems,
  resolvePeriod,
  summarizeSales,
  weekdayName,
  type DateRange,
} from "../../sales/report";
import { CONCEPTS, type ConceptId } from "../../semantic/concepts";
import { exposureLevel, type ConceptEvent } from "../../semantic/exposure";
import { computeMetric } from "../../semantic/metrics";
import type { CardStat, SummaryCard } from "../visuals";

export type RecapKind = "daily" | "weekly";

// `facts` lists every figure in the text and card, so tests can trace each one to sales/.
export type Recap = { text: string; card: SummaryCard | null; facts: string[] };

// S3-AC4: the recap must fit a WhatsApp image caption.
export const RECAP_MAX_CHARS = 1_024;

type Figure = { value: string; change: string | null; trend: CardStat["trend"] };

function figure(
  dataset: SalesDataset,
  metric: "revenue" | "gross_profit" | "gross_margin",
  range: DateRange,
  previous: DateRange | null,
): Figure | null {
  const result = computeMetric({
    requested: metric,
    menu: dataset.menu,
    records: dataset.records,
    range,
    previousRange: previous,
  });

  return result.status === "ok"
    ? { value: result.value, change: result.change, trend: result.trend }
    : null;
}

function topItem(dataset: SalesDataset, range: DateRange) {
  const [best] = rankMenuItems(dataset.records, dataset.menu, range, {
    sortBy: "quantity",
    direction: "best",
    limit: 1,
  });

  return best && best.quantity > 0
    ? { name: best.name, quantity: formatCount(best.quantity) }
    : null;
}

// E14: at most one "tahukah Kakak", only for a concept the owner has seen once but not mastered.
function didYouKnow(concepts: ConceptId[], events: ConceptEvent[]): string | null {
  const concept = concepts.find((candidate) => exposureLevel(events, candidate) === "seen");

  return concept === undefined ? null : `Tahukah Kakak? ${CONCEPTS[concept].plain}`;
}

const withChange = ({ value, change }: Figure, against: string) =>
  change === null ? `*${value}*` : `*${value}* (${change} dibanding ${against})`;

function dailyRecap(dataset: SalesDataset, events: ConceptEvent[]): Recap {
  const yesterday = addDays(dataset.today, -1);
  const heading = `*Rekap kemarin, ${weekdayName(yesterday)} ${formatDateId(yesterday)}*`;
  const range = { start: yesterday, end: yesterday };

  const sold =
    yesterday >= dataset.dataStart ? summarizeSales(dataset.records, dataset.menu, range) : null;

  if (sold === null || sold.revenue === 0)
    return { text: `${heading}\nKemarin belum ada penjualan tercatat.`, card: null, facts: [] };

  const lastWeek = addDays(yesterday, -7);
  const comparable = lastWeek >= dataset.dataStart ? { start: lastWeek, end: lastWeek } : null;
  const revenue = figure(dataset, "revenue", range, comparable);
  const top = topItem(dataset, range);
  const tip = didYouKnow(["revenue"], events);

  if (revenue === null) throw new Error("revenue is always computable");

  const lines = [
    heading,
    `- Omzet: ${withChange(revenue, `${weekdayName(lastWeek)} pekan lalu`)}`,
    ...(top ? [`- Menu terlaris: ${top.name} (${top.quantity} terjual)`] : []),
    ...(tip ? ["", tip] : []),
  ];

  return {
    text: lines.join("\n"),
    card: null,
    facts: [
      revenue.value,
      ...(revenue.change ? [revenue.change] : []),
      ...(top ? [top.quantity] : []),
    ],
  };
}

function weeklyRecap(dataset: SalesDataset, events: ConceptEvent[], businessName: string): Recap {
  const lastWeek = resolvePeriod(
    { period: "last_week", startDate: null, endDate: null },
    dataset.today,
    dataset.dataStart,
  );

  if (lastWeek.end < dataset.dataStart)
    return {
      text: "*Rekap minggu lalu*\nBelum ada penjualan tercatat minggu lalu.",
      card: null,
      facts: [],
    };

  // A business newer than a week gets the days it has, never a "minggu lalu" it did not have.
  const partial = lastWeek.start < dataset.dataStart;
  const range = partial ? { start: dataset.dataStart, end: lastWeek.end } : lastWeek;
  const before = previousRange(range);
  const comparable = !partial && before.start >= dataset.dataStart ? before : null;
  const label = describeRange(range, dataset).label;
  const revenue = figure(dataset, "revenue", range, comparable);
  const profit = figure(dataset, "gross_profit", range, comparable);
  const margin = figure(dataset, "gross_margin", range, comparable);
  const sold = summarizeSales(dataset.records, dataset.menu, range);

  // A closed week has no margin; never print an invented 0% next to a real change.
  if (sold.revenue === 0)
    return {
      text: `*Rekap ${partial ? label : `minggu lalu (${label})`}*\nBelum ada penjualan tercatat.`,
      card: null,
      facts: [],
    };

  const top = topItem(dataset, range);
  const tip = didYouKnow(["gross_profit", "gross_margin"], events);

  const heading = partial
    ? `*Rekap ${label}* (data mulai ${formatDateId(dataset.dataStart)})`
    : `*Rekap minggu lalu (${label})*`;

  const against = "minggu sebelumnya";

  if (revenue === null || profit === null || margin === null)
    throw new Error("weekly figures are always computable");

  const lines = [
    heading,
    `- Omzet: ${withChange(revenue, against)}`,
    `- Laba kotor: ${withChange(profit, against)}`,
    `- Margin kotor: ${withChange(margin, against)}`,
    ...(top ? [`- Menu terlaris: ${top.name} (${top.quantity} terjual)`] : []),
    ...(tip ? ["", tip] : []),
  ];

  const itemsSold = formatCount(sold.itemsSold);

  return {
    text: lines.join("\n"),
    card: {
      businessName,
      title: partial ? "Rekap penjualan" : "Rekap minggu lalu",
      periodLabel: label,
      stats: [
        { label: "Omzet", value: revenue.value, change: revenue.change, trend: revenue.trend },
        { label: "Laba kotor", value: profit.value, change: profit.change, trend: profit.trend },
        { label: "Margin kotor", value: margin.value, change: margin.change, trend: margin.trend },
        { label: "Terjual", value: `${itemsSold} porsi`, change: null, trend: null },
      ],
      highlight: top ? { label: "Terlaris", value: top.name } : null,
      footnote: comparable ? `Perubahan dibanding ${against}` : null,
    },
    facts: [
      revenue.value,
      profit.value,
      margin.value,
      itemsSold,
      ...[revenue, profit, margin].flatMap(({ change }) => (change ? [change] : [])),
      ...(top ? [top.quantity] : []),
    ],
  };
}

// Daily recaps always cover yesterday, even when asked for mid-day (S3 edge case).
export function buildRecap(
  { dataset, businessName }: { dataset: SalesDataset; businessName: string },
  kind: RecapKind,
  events: ConceptEvent[],
): Recap {
  const recap =
    kind === "daily" ? dailyRecap(dataset, events) : weeklyRecap(dataset, events, businessName);

  if (recap.text.length > RECAP_MAX_CHARS) throw new Error(`recap is ${recap.text.length} chars`);

  return recap;
}
