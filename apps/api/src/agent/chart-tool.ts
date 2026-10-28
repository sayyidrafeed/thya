import { tool } from "ai";
import { z } from "zod";
import { chartStyle, MAX_DAILY_POINTS, renderChart, type ChartSpec } from "../modules/visuals";
import type { SalesDataset } from "../sales/demo-shop";
import { formatCount, formatRupiah } from "../sales/format";
import {
  dailySales,
  dayCount,
  describeRange,
  formatDateId,
  rankMenuItems,
  resolvePeriod,
  SalesQueryError,
  type DescribedRange,
} from "../sales/report";
import { periodFields } from "./tools";

// Business-features-plan S2: the picture is drawn by code from the same functions as
// getDailySales/getTopMenuItems; the model only picks the view and writes a short caption.

export type Attachment = {
  id: string;
  kind: "chart" | "summary_card";
  mime: "image/png";
  bytes: number;
};

// Where rendered pictures go; the channel sends them (agent/ never sends, features §4.2).
export type AttachmentPort = {
  save: (kind: Attachment["kind"], png: Uint8Array) => Promise<Attachment>;
};

// Decision Q7 (widened): at most one chart per turn, so a reply is at most one picture.
const MAX_CHARTS_PER_TURN = 1;

const CAPTION_NOTE =
  "Gambar grafik ikut terkirim bersama jawaban. Tulis caption maksimal 3 baris; jangan tulis ulang semua titik.";

const NOTE_SECOND_CHART =
  "Satu grafik saja per pesan. Tawarkan grafik berikutnya di pesan selanjutnya.";

export const showChartInputSchema = z.object({
  view: z
    .enum(["daily_revenue", "daily_items_sold", "top_menu"])
    .describe(
      "daily_revenue = omzet per hari, daily_items_sold = porsi terjual per hari, top_menu = peringkat menu",
    ),
  ...periodFields,
  sortBy: z
    .enum(["revenue", "quantity", "grossProfit"])
    .nullable()
    .describe(
      "Wajib untuk top_menu: revenue = omzet, quantity = jumlah terjual, grossProfit = laba kotor; null untuk view harian",
    ),
  limit: z
    .number()
    .int()
    .min(3)
    .max(10)
    .nullable()
    .describe("Jumlah menu untuk top_menu, null = 5"),
});

type ChartInput = z.infer<typeof showChartInputSchema>;

type ChartPoint = { label: string; value: number; display: string };

type BuiltChart = { spec: ChartSpec; points: ChartPoint[] };

const shortDate = (date: string) => formatDateId(date).replace(/ \d{4}$/, "");

const SORT_LABEL = {
  revenue: "Omzet",
  quantity: "Jumlah terjual",
  grossProfit: "Laba kotor",
} as const;

function buildSpec(dataset: SalesDataset, input: ChartInput): BuiltChart {
  const { menu, records, today, dataStart } = dataset;
  const range = resolvePeriod(input, today, dataStart);
  const described: DescribedRange = describeRange(range, dataset);

  if (input.view === "top_menu") {
    if (input.sortBy === null) throw new SalesQueryError("Isi sortBy untuk top_menu.");

    const sortBy = input.sortBy;

    const items = rankMenuItems(records, menu, range, {
      sortBy,
      direction: "best",
      limit: input.limit ?? 5,
    });

    const unit = sortBy === "quantity" ? "count" : "rupiah";
    const format = unit === "count" ? formatCount : formatRupiah;

    return {
      spec: {
        kind: "ranking",
        metricLabel: `${SORT_LABEL[sortBy]} per menu`,
        unit,
        range: described,
        items: items.map((item) => ({ name: item.name, value: item[sortBy] })),
      },
      points: items.map((item) => ({
        label: item.name,
        value: item[sortBy],
        display: format(item[sortBy]),
      })),
    };
  }

  if (dayCount(range) > MAX_DAILY_POINTS)
    throw new SalesQueryError(
      `Grafik harian maksimal ${MAX_DAILY_POINTS} hari. Pilih periode yang lebih pendek.`,
    );

  const revenue = input.view === "daily_revenue";

  const points = dailySales(records, menu, range).map((day) => {
    const value = revenue ? day.revenue : day.itemsSold;

    return {
      date: day.date,
      label: shortDate(day.date),
      value,
      display: revenue ? formatRupiah(value) : formatCount(value),
    };
  });

  return {
    spec: {
      kind: "daily",
      metricLabel: revenue ? "Omzet per hari" : "Porsi terjual per hari",
      unit: revenue ? "rupiah" : "count",
      range: described,
      points,
    },
    points: points.map(({ label, value, display }) => ({ label, value, display })),
  };
}

export function createChartTool(
  dataset: SalesDataset,
  port: AttachmentPort | null,
  saved: Attachment[],
) {
  let charts = 0;

  return {
    // Eval chart-unknown-data: asked for a stock chart, the model sent a revenue chart instead.
    showChart: tool({
      description:
        "Gambar grafik penjualan (omzet/porsi per hari, atau peringkat menu) yang dikirim sebagai gambar. " +
        "Panggil kalau Kakak minta grafik, diagram, atau gambar penjualan. Data selain penjualan (stok, pengeluaran) belum ada: " +
        "untuk itu jangan panggil tool ini dan jangan kirim grafik penjualan sebagai gantinya.",
      inputSchema: showChartInputSchema,
      execute: async (input) => {
        if (charts >= MAX_CHARTS_PER_TURN)
          return { status: "error" as const, message: NOTE_SECOND_CHART };

        charts += 1;

        let built: BuiltChart;

        try {
          built = buildSpec(dataset, input);
        } catch (error) {
          if (error instanceof SalesQueryError)
            return { status: "error" as const, message: error.message };

          throw error;
        }

        const { spec, points } = built;
        const empty = points.every((point) => point.value === 0);

        // An empty chart helps nobody: no picture, and the model says nothing sold yet (S2).
        const attachment =
          empty || port === null ? null : await port.save("chart", renderChart(spec));

        if (attachment) saved.push(attachment);

        return {
          status: "ok" as const,
          attachmentId: attachment?.id ?? null,
          chart: chartStyle(spec),
          range: spec.range,
          points,
          note: empty ? "Belum ada penjualan di periode ini; tidak ada gambar." : CAPTION_NOTE,
        };
      },
    }),
  };
}
