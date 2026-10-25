import { z } from "zod";
import { formatDateId } from "../sales/report";
import type { TurnAction, TurnToolCall } from "./run-turn";

// Decision Q2b/Q2c: when the model cannot produce a grounded answer, the owner gets a plain answer
// written by code from the tool results, or a short apology. Never a technical error.
const APOLOGY =
  "Maaf Kak, angkanya belum bisa Thya ambil sekarang. Coba tanya lagi ya, sebut periodenya juga (misalnya *minggu lalu*).";

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

  const concept = conceptOutput.safeParse(output);

  return concept.success ? [concept.data.text] : [];
}

export function fallbackReply(toolCalls: TurnToolCall[]): {
  reply: string;
  action: Extract<TurnAction, "template" | "apology">;
} {
  const lines = toolCalls.flatMap(linesFor);

  return lines.length > 0
    ? { reply: lines.join("\n"), action: "template" }
    : { reply: APOLOGY, action: "apology" };
}
