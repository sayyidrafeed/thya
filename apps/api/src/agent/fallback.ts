import { z } from "zod";
import { formatDateId } from "../sales/report";
import type { TurnAction, TurnToolCall } from "./run-turn";

// Decision Q2b/Q2c: when the model cannot produce a grounded answer, the owner gets a plain answer
// written by code from the tool results, or a short apology. Never a technical error.
const APOLOGY =
  "Maaf Kak, angkanya belum bisa Thya ambil sekarang. Coba tanya lagi ya, sebut periodenya juga (misalnya *minggu lalu*).";

// For a question that was not about figures (eval screenshot-qris-by-text): the numbers apology
// above, or a definition nobody asked for, would not answer it.
const NEUTRAL_APOLOGY =
  "Maaf Kak, Thya belum bisa jawab yang ini dengan pas. Boleh ditanyakan lagi dengan kalimat lain ya?";

const FIGURE_TOOLS = new Set(["queryMetric", "getTopMenuItems", "getDailySales"]);

type FallbackReply = { reply: string; action: Extract<TurnAction, "template" | "apology"> };

const range = z.object({ label: z.string(), dataUntil: z.string().optional() });

const metricOutput = z.object({
  status: z.literal("ok"),
  label: z.string(),
  value: z.string().nullable(),
  range,
});

const topMenuOutput = z.object({
  status: z.literal("ok"),
  direction: z.enum(["best", "worst"]),
  range,
  items: z.array(z.object({ name: z.string(), quantity: z.number(), revenue: z.string() })),
});

const dailyOutput = z.object({
  status: z.literal("ok"),
  range,
  days: z.array(z.object({ date: z.string(), weekday: z.string(), revenue: z.string() })),
});

const conceptOutput = z.object({ status: z.literal("ok"), text: z.string() });

const chartOutput = z.object({ status: z.literal("ok"), attachmentId: z.string(), range });

const period = ({ label, dataUntil }: z.infer<typeof range>) =>
  dataUntil ? `${label} (data sampai ${dataUntil})` : label;

function linesFor({ toolName, output }: TurnToolCall): string[] {
  if (toolName === "queryMetric") {
    const metric = metricOutput.safeParse(output);

    if (!metric.success) return [];

    const { label, value } = metric.data;
    const name = label.charAt(0).toUpperCase() + label.slice(1);

    return [
      value === null
        ? `${name} ${period(metric.data.range)} belum bisa dihitung, datanya belum lengkap.`
        : `${name} ${period(metric.data.range)}: *${value}*`,
    ];
  }

  if (toolName === "getTopMenuItems") {
    const top = topMenuOutput.safeParse(output);

    if (!top.success) return [];

    const heading = top.data.direction === "best" ? "Menu terlaris" : "Menu paling sepi";

    return [
      `${heading} ${period(top.data.range)}:`,
      ...top.data.items.map(
        (item) => `- ${item.name}: ${item.quantity} terjual, omzet ${item.revenue}`,
      ),
    ];
  }

  if (toolName === "getDailySales") {
    const daily = dailyOutput.safeParse(output);

    if (!daily.success) return [];

    return [
      `Omzet per hari ${period(daily.data.range)}:`,
      ...daily.data.days.map(
        (day) => `- ${day.weekday}, ${formatDateId(day.date)}: ${day.revenue}`,
      ),
    ];
  }

  if (toolName === "showChart") {
    const chart = chartOutput.safeParse(output);

    return chart.success ? [`Ini grafiknya, Kak, untuk ${period(chart.data.range)}.`] : [];
  }

  if (toolName !== "explainConcept") return [];

  const concept = conceptOutput.safeParse(output);

  return concept.success ? [concept.data.text] : [];
}

// `forcedTool`: the calls come from the Q2c retry, where the model had to call some tool. A
// definition picked that way says nothing about what the owner asked; fetched figures still do.
export function fallbackReply(toolCalls: TurnToolCall[], { forcedTool }: { forcedTool: boolean }) {
  const lines = toolCalls
    .filter((call) => !(forcedTool && call.toolName === "explainConcept"))
    .flatMap(linesFor);

  if (lines.length > 0)
    return { reply: lines.join("\n"), action: "template" } satisfies FallbackReply;

  const aboutFigures =
    toolCalls.length === 0 || toolCalls.some((call) => FIGURE_TOOLS.has(call.toolName));

  return {
    reply: aboutFigures ? APOLOGY : NEUTRAL_APOLOGY,
    action: "apology",
  } satisfies FallbackReply;
}
