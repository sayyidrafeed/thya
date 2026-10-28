import { formatCount, formatPercent, formatRupiah } from "../sales/format";
import {
  paymentsIn,
  summarizeSales,
  type DateRange,
  type MenuItem,
  type PaymentDay,
  type SaleRecord,
} from "../sales/report";
import type { ConceptId } from "./concepts";
import { findTerm, namesBothProfits } from "./terms";

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
  "qris_in",
] as const;

export type RequestedMetric = (typeof METRIC_IDS)[number];

export type MetricId = Exclude<RequestedMetric, "profit">;

export type SalesSummary = ReturnType<typeof summarizeSales>;

// QRIS money in sits beside the sales totals, never inside them (G10, S9-AC8).
export type MetricTotals = SalesSummary & { qrisIn: number };

export type MetricResult =
  | {
      status: "ok";
      metric: MetricId;
      value: string;
      previousValue: string | null;
      change: string | null;
      // Direction of `change` after the same rounding, so "0%" is flat, not up.
      trend: "up" | "down" | "flat" | null;
      // Some figure here (value, previous value or change) rests on a menu cost the owner only
      // guessed, so replies and recaps must call it "perkiraan" (semantic-education item 6).
      estimated: boolean;
      current: MetricTotals;
      previous: MetricTotals | null;
    }
  | { status: "missing"; metric: MetricId; missing: ConceptId };

export type MetricQuery = {
  requested: RequestedMetric;
  menu: MenuItem[];
  records: SaleRecord[];
  payments: PaymentDay[];
  range: DateRange;
  previousRange: DateRange | null;
};

const PROFITS: RequestedMetric[] = ["profit", "gross_profit", "net_profit"];

function namedProfit(userTerm: string | null): RequestedMetric | null {
  const term = findTerm(userTerm);

  if (term === null) return null;

  if (namesBothProfits(term)) return "profit";

  if (term.concepts.includes("net_profit")) return "net_profit";

  return term.concepts.includes("gross_profit") ? "gross_profit" : null;
}

// D2 follows the owner's word, not the model's pick (eval untung-this-month chose net profit).
export function resolveMetric(
  requested: RequestedMetric,
  userTerm: string | null = null,
): MetricId {
  const metric = (PROFITS.includes(requested) ? namedProfit(userTerm) : null) ?? requested;

  return metric === "profit" ? "gross_profit" : metric;
}

export const ANSWER_METRICS = METRIC_IDS.filter((id): id is MetricId => id !== "profit");

type ComputableMetric = Exclude<MetricId, "net_profit">;

// Metrics computed from menu costs; only these can inherit an estimate.
const COST_BASED: ComputableMetric[] = ["cogs", "gross_profit", "gross_margin"];

function totals(query: MetricQuery, range: DateRange): MetricTotals {
  return {
    ...summarizeSales(query.records, query.menu, range),
    qrisIn: paymentsIn(query.payments, range),
  };
}

function amount(metric: ComputableMetric, summary: MetricTotals): number {
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
    case "qris_in":
      return summary.qrisIn;
  }
}

function formatAmount(metric: ComputableMetric, value: number): string {
  if (metric === "gross_margin") return formatPercent(value);

  // Thousands separated like every other figure Thya shows ("1.249 porsi"), so the model copies it as is.
  return metric === "items_sold" ? `${formatCount(value)} porsi` : formatRupiah(value);
}

// Margin moves in percentage points; everything else in percent of the previous value.
// Dividing by |previous| keeps the sign right when a loss shrinks.
function describeChange(metric: ComputableMetric, current: number, previous: number) {
  const delta =
    metric === "gross_margin"
      ? current - previous
      : ((current - previous) / Math.abs(previous)) * 100;

  const rounded = Math.round(delta * 10) / 10;
  const sign = rounded > 0 ? "+" : "";
  const trend = rounded > 0 ? ("up" as const) : rounded < 0 ? ("down" as const) : ("flat" as const);

  return {
    change:
      metric === "gross_margin"
        ? `${sign}${rounded.toString().replace(".", ",")} poin`
        : `${sign}${formatPercent(rounded)}`,
    trend,
  };
}

export function computeMetric(query: MetricQuery): MetricResult {
  const metric = resolveMetric(query.requested);

  if (metric === "net_profit") return { status: "missing", metric, missing: "operating_expense" };

  const current = totals(query, query.range);
  const previous = query.previousRange === null ? null : totals(query, query.previousRange);

  const now = amount(metric, current);

  // A period without sales has no margin (report.ts reports 0), and 0 is not comparable.
  const comparable =
    previous !== null && (metric !== "gross_margin" || previous.revenue > 0) ? previous : null;

  const before = comparable === null ? null : amount(metric, comparable);
  const zeroBase = before === 0 && metric !== "gross_margin";

  const estimated =
    COST_BASED.includes(metric) &&
    (current.costEstimated || (comparable !== null && comparable.costEstimated));

  return {
    status: "ok",
    metric,
    value: formatAmount(metric, now),
    previousValue: before === null ? null : formatAmount(metric, before),
    ...(before === null || zeroBase
      ? { change: null, trend: null }
      : describeChange(metric, now, before)),
    estimated,
    current,
    previous,
  };
}
