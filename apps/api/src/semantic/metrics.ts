import { formatPercent, formatRupiah } from "../sales/format";
import { summarizeSales, type DateRange, type MenuItem, type SaleRecord } from "../sales/report";
import type { ConceptId } from "./concepts";

// "profit" is the owner's generic "untung". Decision D2 resolves it to net profit once operating
// expenses are recorded; nothing records them yet, so it is always gross profit for now.
export const METRIC_IDS = [
  "revenue",
  "cogs",
  "gross_profit",
  "gross_margin",
  "net_profit",
  "profit",
  "items_sold",
] as const;

export type RequestedMetric = (typeof METRIC_IDS)[number];

export type MetricId = Exclude<RequestedMetric, "profit">;

export type SalesSummary = ReturnType<typeof summarizeSales>;

export type MetricResult =
  | {
      status: "ok";
      metric: MetricId;
      value: string;
      previousValue: string | null;
      change: string | null;
      current: SalesSummary;
      previous: SalesSummary | null;
    }
  | { status: "missing"; metric: MetricId; missing: ConceptId };

export type MetricQuery = {
  requested: RequestedMetric;
  menu: MenuItem[];
  records: SaleRecord[];
  range: DateRange;
  previousRange: DateRange | null;
};

export function resolveMetric(requested: RequestedMetric): MetricId {
  return requested === "profit" ? "gross_profit" : requested;
}

export const ANSWER_METRICS = METRIC_IDS.filter((id): id is MetricId => id !== "profit");

type ComputableMetric = Exclude<MetricId, "net_profit">;

function amount(metric: ComputableMetric, summary: SalesSummary): number {
  switch (metric) {
    case "revenue":
      return summary.revenue;
    case "cogs":
      return summary.cogs;
    case "gross_profit":
      return summary.grossProfit;
    case "gross_margin":
      return summary.grossMarginPct;
    case "items_sold":
      return summary.itemsSold;
  }
}

function formatAmount(metric: ComputableMetric, value: number): string {
  if (metric === "gross_margin") return formatPercent(value);

  return metric === "items_sold" ? `${value} porsi` : formatRupiah(value);
}

// Margin moves in percentage points; everything else in percent of the previous value.
// Dividing by |previous| keeps the sign right when a loss shrinks.
function formatChange(metric: ComputableMetric, current: number, previous: number): string {
  const delta =
    metric === "gross_margin"
      ? current - previous
      : ((current - previous) / Math.abs(previous)) * 100;

  const rounded = Math.round(delta * 10) / 10;
  const sign = rounded > 0 ? "+" : "";

  return metric === "gross_margin"
    ? `${sign}${rounded.toString().replace(".", ",")} poin`
    : `${sign}${formatPercent(rounded)}`;
}

export function computeMetric(query: MetricQuery): MetricResult {
  const metric = resolveMetric(query.requested);

  if (metric === "net_profit") return { status: "missing", metric, missing: "operating_expense" };

  const current = summarizeSales(query.records, query.menu, query.range);

  const previous =
    query.previousRange === null
      ? null
      : summarizeSales(query.records, query.menu, query.previousRange);

  const now = amount(metric, current);

  // A period without sales has no margin (report.ts reports 0), and 0 is not comparable.
  const comparable =
    previous !== null && (metric !== "gross_margin" || previous.revenue > 0) ? previous : null;

  const before = comparable === null ? null : amount(metric, comparable);
  const zeroBase = before === 0 && metric !== "gross_margin";

  return {
    status: "ok",
    metric,
    value: formatAmount(metric, now),
    previousValue: before === null ? null : formatAmount(metric, before),
    change: before === null || zeroBase ? null : formatChange(metric, now, before),
    current,
    previous,
  };
}
