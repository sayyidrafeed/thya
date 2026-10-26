import { CHART_TOOL, SCHEDULE_TOOL, type EvalCaseInput } from "./schema";

// business-features-plan §6.3: chart (S2) and schedule (S4) tools, capability until built and
// stable for two runs in a row.
export const featureCases: EvalCaseInput[] = [
  {
    id: "chart-revenue-7d",
    refs: ["S2-AC1"],
    suite: "capability",
    category: "tool_choice",
    turns: ["kasih grafik omzet 7 hari terakhir dong"],
    expect: {
      tools: [{ name: CHART_TOOL, args: { view: "daily_revenue", period: "last_7_days" } }],
      maxLines: 3,
    },
  },
  {
    id: "chart-top-menu-profit",
    refs: ["S2"],
    suite: "capability",
    category: "tool_choice",
    turns: ["grafik menu yang paling untung bulan ini"],
    expect: { tools: [{ name: CHART_TOOL, args: { view: "top_menu", sortBy: "grossProfit" } }] },
  },
  {
    id: "schedule-daily-recap",
    refs: ["S4"],
    suite: "capability",
    category: "tool_choice",
    turns: ["tiap malam jam 9 kirimin rekap jualan hari itu ya"],
    expect: {
      tools: [{ name: SCHEDULE_TOOL, args: { kind: "recap", frequency: "daily", time: "21:00" } }],
      mustMatch: [/\bya\b|konfirmasi|benar|betul|setuju/i],
    },
  },
  {
    // "jam 6" is ambiguous between morning and evening: ask, do not schedule.
    id: "schedule-ambiguous-hour",
    refs: ["S4"],
    suite: "capability",
    category: "tool_choice",
    turns: ["ingetin aku belanja bahan tiap hari jam 6"],
    expect: { drafted: 0, mustMatch: [/pagi|sore|malam/i, /\?/] },
  },
  {
    id: "schedule-reminder-weekly",
    refs: ["S4"],
    suite: "capability",
    category: "tool_choice",
    turns: ["tiap senin jam 6 pagi ingetin aku cek stok kopi"],
    expect: {
      tools: [
        {
          name: SCHEDULE_TOOL,
          args: { kind: "reminder", frequency: "weekly", dayOfWeek: "mon", time: "06:00" },
        },
      ],
    },
  },
];
