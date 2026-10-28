import { tool } from "ai";
import { z } from "zod";
import type { SalesDataset } from "../sales/demo-shop";
import { formatRupiah } from "../sales/format";
import {
  dailySales,
  dayCount,
  describeRange,
  MENU_SORT_KEYS,
  PERIODS,
  previousRange,
  rankMenuItems,
  resolvePeriod,
  SalesQueryError,
  summarizeSales,
  type DateRange,
} from "../sales/report";
import { compareChannels, describeChannels, noChannelDataMessage } from "../semantic/channels";
import { CONCEPT_IDS, CONCEPTS, type ConceptId } from "../semantic/concepts";
import {
  conceptText,
  exampleText,
  interpretation,
  menuCostExample,
  pickExplanation,
} from "../semantic/explain";
import {
  explainConceptEvents,
  exposureLevel,
  queryMetricEvents,
  type ConceptEvent,
} from "../semantic/exposure";
import {
  ANSWER_METRICS,
  computeMetric,
  METRIC_IDS,
  resolveMetric,
  type MetricId,
} from "../semantic/metrics";
import { GENERIC_PROFIT_TERMS, termsFor } from "../semantic/terms";

const MAX_DAILY_RANGE_DAYS = 31;

// Every field is required (nullable when not applicable): DeepSeek V4.1 Flash on NetraRuntime
// fills only one of several optional fields, e.g. sends startDate but drops endDate.
export const periodFields = {
  period: z
    .enum(PERIODS)
    .describe(
      "today = hari ini (masih berjalan), yesterday = kemarin, this_week = Senin minggu ini s.d. hari ini, " +
        "last_week = Senin-Minggu minggu lalu, last_7_days = 7 hari penuh s.d. kemarin, " +
        "last_14_days = 14 hari penuh s.d. kemarin, this_month = tanggal 1 s.d. hari ini, " +
        "last_month = bulan lalu penuh, last_30_days = 30 hari penuh s.d. kemarin, custom = pakai startDate dan endDate",
    ),
  startDate: z.iso
    .date()
    .nullable()
    .describe("Tanggal awal YYYY-MM-DD kalau period custom, selain itu null"),
  endDate: z.iso
    .date()
    .nullable()
    .describe(
      "Tanggal akhir YYYY-MM-DD (ikut dihitung) kalau period custom; null = sampai hari ini",
    ),
};

// Generic profit words sit under `profit` only: under net_profit "untung" read as laba bersih.
const metricHint = (id: MetricId) =>
  `${id} = ${CONCEPTS[id].label} (${termsFor(id)
    .filter((term) => !GENERIC_PROFIT_TERMS.includes(term))
    .join(", ")})`;

export const queryMetricInputSchema = z.object({
  metric: z
    .enum(METRIC_IDS)
    .describe(
      [
        ...ANSWER_METRICS.map(metricHint),
        `profit = ${GENERIC_PROFIT_TERMS.map((term) => `"${term}"`).join("/")} tanpa kata kotor atau bersih`,
      ].join("; "),
    ),
  userTerm: z
    .string()
    .nullable()
    .describe(
      'Kata persis yang dipakai user untuk angka ini, misalnya "untung" atau "omzet"; null kalau user tidak menyebut istilah',
    ),
  ...periodFields,
});

export const explainConceptInputSchema = z.object({
  concept: z.enum(CONCEPT_IDS),
  depth: z
    .enum(["short", "detail"])
    .describe(
      'short = "apa itu X?"; detail = "maksudnya?", "kok bisa?", atau minta penjelasan lebih',
    ),
});

export const topMenuItemsInputSchema = z.object({
  ...periodFields,
  sortBy: z
    .enum(MENU_SORT_KEYS)
    .describe("revenue = omzet, quantity = jumlah terjual, grossProfit = laba kotor"),
  direction: z.enum(["best", "worst"]).describe("best = paling laku, worst = paling sepi"),
  limit: z.number().int().min(1).max(10).describe("Jumlah menu yang ditampilkan, biasanya 5"),
});

export const dailySalesInputSchema = z.object(periodFields);

export const compareChannelsInputSchema = z.object(periodFields);

export const SALES_TOOL_NAMES = [
  "queryMetric",
  "explainConcept",
  "getTopMenuItems",
  "getDailySales",
  "compareChannels",
] as const;

export type SalesToolName = (typeof SALES_TOOL_NAMES)[number];

// Every tool answers with a status instead of throwing, so the model can explain a refusal.
type ToolError = { status: "error"; message: string };

export type ToolResult<T> = ({ status: "ok" } & T) | ToolError;

export type ToolGate = { exhausted: (name: SalesToolName) => boolean };

const BUDGET_SPENT =
  "Batas ambil data untuk pesan ini sudah habis. Susun jawaban sekarang dari hasil yang sudah ada.";

// `events` holds what this business already saw; the tools append to it as they explain.
// `deliveryImport`: whether delivery screenshots are read, so a missing-data answer only asks for
// a screenshot Thya can actually read (U10).
export function createSalesTools(
  dataset: SalesDataset,
  events: ConceptEvent[],
  gate: ToolGate = { exhausted: () => false },
  deliveryImport = false,
) {
  const { menu, records, payments, channelSales, commissions, today, dataStart } = dataset;

  function guarded<T>(name: SalesToolName, compute: () => T): T | ToolError {
    if (gate.exhausted(name)) return { status: "error", message: BUDGET_SPENT };

    try {
      return compute();
    } catch (error) {
      if (error instanceof SalesQueryError) return { status: "error", message: error.message };

      throw error;
    }
  }

  function run<T extends object>(name: SalesToolName, compute: () => T): ToolResult<T> {
    return guarded(name, () => ({ status: "ok" as const, ...compute() }));
  }

  function comparableRange(range: DateRange): DateRange | null {
    const previous = previousRange(range);

    // Comparing a still-running day with full days would mislead, so skip it.
    return range.end < today && previous.start >= dataStart ? previous : null;
  }

  function conceptExample(concept: ConceptId): string | null {
    const range = resolvePeriod(
      { period: "last_7_days", startDate: null, endDate: null },
      today,
      dataStart,
    );

    if (concept !== "menu_cost") {
      const example = exampleText(concept, summarizeSales(records, menu, range));

      return example === null
        ? null
        : `Contoh 7 hari terakhir (${describeRange(range, dataset).label}): ${example}`;
    }

    const [best] = rankMenuItems(records, menu, range, {
      sortBy: "quantity",
      direction: "best",
      limit: 1,
    });

    const item = menu.find((candidate) => candidate.name === best?.name);

    return item === undefined ? null : menuCostExample(item);
  }

  return {
    queryMetric: tool({
      description:
        "Satu angka usaha untuk satu periode, plus perbandingan dengan periode sebelumnya yang sama panjang. " +
        "Hasilnya membawa interpretedAs dan explanation yang harus disampaikan ke user kalau tidak null.",
      inputSchema: queryMetricInputSchema,
      execute: async ({ metric: requested, userTerm, ...periodInput }) =>
        run("queryMetric", () => {
          const range = resolvePeriod(periodInput, today, dataStart);
          const previous = comparableRange(range);
          const metric = resolveMetric(requested, userTerm);

          const result = computeMetric({
            requested: metric,
            menu,
            records,
            payments,
            range,
            previousRange: previous,
          });

          const explanation = pickExplanation(result, exposureLevel(events, metric));
          events.push(...queryMetricEvents(metric, explanation.level, userTerm));

          return {
            metric,
            label: CONCEPTS[metric].label,
            value: result.status === "ok" ? result.value : null,
            range: describeRange(range, dataset),
            previousPeriod:
              result.status === "ok" && previous !== null
                ? {
                    label: describeRange(previous, dataset).label,
                    value: result.previousValue,
                    change: result.change,
                  }
                : null,
            interpretedAs: interpretation(userTerm, metric),
            explanation,
            // U5: the estimate rule rides on the result, not the prompt (semantic-education item 6).
            estimateNote:
              result.status === "ok" && result.estimated
                ? 'Sebagian modal per porsi masih perkiraan. Sebut angka ini sebagai perkiraan, misalnya "laba kotor sekitar Rp… (perkiraan)".'
                : null,
          };
        }),
    }),

    explainConcept: tool({
      description:
        "Penjelasan satu istilah usaha dengan bahasa sehari-hari dan contoh angka milik user. " +
        'Panggil kalau user bertanya "apa itu X", "maksudnya?", atau "kok bisa?".',
      inputSchema: explainConceptInputSchema,
      execute: async ({ concept, depth }) =>
        run("explainConcept", () => {
          events.push(...explainConceptEvents(concept));

          return {
            concept,
            label: CONCEPTS[concept].label,
            text: conceptText(concept, depth, conceptExample(concept)),
          };
        }),
    }),

    getTopMenuItems: tool({
      description:
        "Peringkat menu untuk satu periode: menu terlaris atau paling sepi berdasarkan omzet, jumlah terjual, atau laba kotor. " +
        "Termasuk margin kotor per menu dan porsi omzet.",
      inputSchema: topMenuItemsInputSchema,
      execute: async ({ sortBy, direction, limit, ...periodInput }) =>
        run("getTopMenuItems", () => {
          const range = resolvePeriod(periodInput, today, dataStart);
          const items = rankMenuItems(records, menu, range, { sortBy, direction, limit });

          return {
            range: describeRange(range, dataset),
            sortBy,
            direction,
            items: items.map((item) => ({
              ...item,
              revenue: formatRupiah(item.revenue),
              grossProfit: formatRupiah(item.grossProfit),
            })),
          };
        }),
    }),

    getDailySales: tool({
      description: `Omzet dan item terjual per hari (maksimal ${MAX_DAILY_RANGE_DAYS} hari), untuk melihat tren dan hari paling ramai atau sepi.`,
      inputSchema: dailySalesInputSchema,
      execute: async (input) =>
        run("getDailySales", () => {
          const range = resolvePeriod(input, today, dataStart);

          if (dayCount(range) > MAX_DAILY_RANGE_DAYS) {
            throw new SalesQueryError(
              `Rincian harian maksimal ${MAX_DAILY_RANGE_DAYS} hari. Pakai queryMetric untuk periode panjang.`,
            );
          }

          const days = dailySales(records, menu, range);

          return {
            range: describeRange(range, dataset),
            days: days.map((day) => ({ ...day, revenue: formatRupiah(day.revenue) })),
          };
        }),
    }),

    compareChannels: tool({
      description:
        "Bandingkan jualan per saluran untuk satu periode: langsung di toko vs GoFood, GrabFood, ShopeeFood. " +
        "Tiap saluran: omzet, potongan aplikasi, modal bahan, laba kotor, margin, dan sisa untung per Rp100.000. " +
        `Untuk pertanyaan seperti "online vs makan di tempat, mana lebih untung?" (${termsFor("channel_sales").join(", ")}). ` +
        "Sampaikan message saluran yang not_ready, best, estimateNote, coverageNote, dan explanation kalau tidak null.",
      inputSchema: compareChannelsInputSchema,
      execute: async (input) =>
        guarded("compareChannels", () => {
          const range = resolvePeriod(input, today, dataStart);
          const lines = compareChannels({ menu, records, channelSales, commissions, range });

          if (lines === null)
            return {
              status: "not_ready" as const,
              message: noChannelDataMessage({ channelSales, importEnabled: deliveryImport }),
            };

          // Explained once per business, like any concept (semantic-education §3.2).
          const explain = exposureLevel(events, "app_commission") === "new";

          if (explain) events.push(...explainConceptEvents("app_commission"));

          return {
            status: "ok" as const,
            range: describeRange(range, dataset),
            ...describeChannels(lines, range),
            explanation: explain ? CONCEPTS.app_commission.plain : null,
          };
        }),
    }),
  };
}
