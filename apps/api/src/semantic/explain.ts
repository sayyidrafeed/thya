import { formatPercent, formatRupiah } from "../sales/format";
import type { MenuItem } from "../sales/report";
import { CONCEPTS, NOT_RECORDED, type ConceptId } from "./concepts";
import type { ExplanationLevel, ExposureLevel } from "./exposure";
import type { MetricId, MetricResult, SalesSummary } from "./metrics";
import { findTerm } from "./terms";

// Every number in these texts comes from the tool result, so the post-output number check holds.
export type Explanation = { level: ExplanationLevel; text: string | null };

const MARGIN_DROP_POINTS = 2;

export function exampleText(concept: ConceptId, summary: SalesSummary): string | null {
  const revenue = formatRupiah(summary.revenue);
  const cogs = formatRupiah(summary.cogs);

  switch (concept) {
    case "revenue":
      return `Jadi ${revenue} ini belum dipotong modal bahan ${cogs}.`;
    case "cogs":
      return `Dari omzet ${revenue}, sebanyak ${cogs} habis buat modal bahan.`;
    case "gross_profit":
      return `Omzet ${revenue} dikurangi modal bahan ${cogs}, sisanya ${formatRupiah(summary.grossProfit)}.`;
    case "gross_margin":
      return `Artinya dari tiap Rp100.000 jualan, sekitar ${formatRupiah(summary.grossMarginPct * 1000)} tersisa setelah modal bahan.`;
    default:
      return null;
  }
}

function pitfallText(
  metric: MetricId,
  current: SalesSummary,
  previous: SalesSummary,
): string | null {
  const revenueUp = current.revenue > previous.revenue;
  const profitDown = current.grossProfit < previous.grossProfit;

  const cause =
    "Biasanya karena menu yang modalnya besar lebih banyak terjual, atau modal bahan naik.";

  // Only on revenue: the gross profit answer already shows its own drop, and a parallel
  // revenue + profit call would otherwise repeat the warning.
  if (metric === "revenue" && revenueUp && profitDown) {
    return (
      `Omzet naik dari ${formatRupiah(previous.revenue)} ke ${formatRupiah(current.revenue)}, ` +
      `tapi laba kotor turun dari ${formatRupiah(previous.grossProfit)} ke ${formatRupiah(current.grossProfit)}. ${cause}`
    );
  }

  if (
    metric === "gross_margin" &&
    previous.grossMarginPct - current.grossMarginPct >= MARGIN_DROP_POINTS
  ) {
    return `Margin turun dari ${formatPercent(previous.grossMarginPct)} ke ${formatPercent(current.grossMarginPct)}. ${cause}`;
  }

  return null;
}

function missingText(missing: ConceptId): string {
  if (missing === "operating_expense") {
    return "Laba bersih belum bisa dihitung karena biaya operasional (sewa, gaji, listrik) belum dicatat, dan Thya belum bisa mencatatnya. Yang bisa Thya hitung sekarang laba kotor.";
  }

  return `Datanya belum ada: ${CONCEPTS[missing].label} belum dicatat.`;
}

export function pickExplanation(result: MetricResult, exposure: ExposureLevel): Explanation {
  if (result.status === "missing") return { level: "missing", text: missingText(result.missing) };

  const pitfall =
    result.previous === null ? null : pitfallText(result.metric, result.current, result.previous);

  if (exposure === "new") {
    const detail = pitfall ?? exampleText(result.metric, result.current);
    const plain = CONCEPTS[result.metric].plain;

    return { level: "intro", text: detail === null ? plain : `${plain} ${detail}` };
  }

  if (pitfall !== null && exposure !== "familiar") return { level: "pitfall", text: pitfall };

  return { level: "none", text: null };
}

// Said when the owner's word could mean more than one metric, so they know which one Thya used.
export function interpretation(userTerm: string | null, metric: MetricId): string | null {
  const term = findTerm(userTerm);

  if (term === null || term.concepts.length < 2 || !term.concepts.includes(metric)) return null;

  const label = CONCEPTS[metric].label;

  if (metric === "gross_profit") {
    return `"${term.phrase}" Thya hitung sebagai ${label} (omzet dikurangi modal bahan), karena biaya sewa, gaji, dan listrik belum dicatat.`;
  }

  return `"${term.phrase}" Thya hitung sebagai ${label}.`;
}

export function menuCostExample(item: MenuItem): string {
  return `Contohnya ${item.name} dijual ${formatRupiah(item.price)}, modal bahannya ${formatRupiah(item.cost)}, jadi sisa ${formatRupiah(item.price - item.cost)} per porsi.`;
}

export function conceptText(
  concept: ConceptId,
  depth: "short" | "detail",
  example: string | null,
): string {
  const { plain, whyItMatters, related } = CONCEPTS[concept];
  const parts = [plain, example];

  if (NOT_RECORDED.includes(concept))
    parts.push("Datanya belum dicatat Thya, jadi belum bisa dihitung.");

  if (depth === "detail") {
    parts.push(whyItMatters, `Terkait: ${related.map((id) => CONCEPTS[id].label).join(", ")}.`);
  }

  return parts.filter((part) => part !== null).join(" ");
}
