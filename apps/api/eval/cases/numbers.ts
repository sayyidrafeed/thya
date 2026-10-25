import { metric, type EvalCaseInput } from "./schema";

export const numberCases: EvalCaseInput[] = [
  {
    id: "revenue-last-week",
    refs: [],
    suite: "regression",
    category: "numbers",
    turns: ["omzet minggu lalu berapa?"],
    expect: {
      tools: [metric("revenue", "last_week")],
      facts: [{ args: metric("revenue", "last_week").args, near: /omzet/i }],
    },
  },
  {
    id: "untung-this-month",
    refs: ["E1"],
    suite: "regression",
    category: "numbers",
    turns: ["untung bulan ini berapa kak?"],
    expect: {
      tools: [metric("profit", "this_month")],
      facts: [{ args: metric("profit", "this_month").args, near: /laba kotor|untung/i }],
      mustMatch: [/laba kotor/i],
    },
  },
  {
    id: "cogs-last-week",
    refs: [],
    suite: "regression",
    category: "numbers",
    turns: ["modal bahan minggu lalu habis berapa?"],
    expect: {
      tools: [metric("cogs", "last_week")],
      facts: [{ args: metric("cogs", "last_week").args, near: /modal|hpp/i }],
    },
  },
  {
    id: "margin-last-month",
    refs: [],
    suite: "regression",
    category: "numbers",
    turns: ["margin kotor bulan lalu berapa persen?"],
    expect: {
      tools: [metric("gross_margin", "last_month")],
      facts: [{ args: metric("gross_margin", "last_month").args, near: /margin/i }],
    },
  },
  {
    id: "revenue-custom-range",
    refs: [],
    suite: "regression",
    category: "numbers",
    turns: ["omzet tanggal 1 sampai 10 Oktober 2026 berapa?"],
    expect: {
      tools: [metric("revenue", "custom", { startDate: "2026-10-01", endDate: "2026-10-10" })],
      facts: [
        {
          args: metric("revenue", "custom", { startDate: "2026-10-01", endDate: "2026-10-10" })
            .args,
          near: /omzet/i,
        },
      ],
    },
  },
  {
    id: "net-profit-missing",
    refs: ["E2"],
    suite: "regression",
    category: "numbers",
    turns: ["untung bersih bulan lalu berapa?"],
    expect: {
      anyTool: [
        { name: "queryMetric", args: { metric: "net_profit" } },
        { name: "explainConcept", args: { concept: "net_profit" } },
      ],
      mustMatch: [/belum/i],
      mustNotMatch: [/laba bersih[^\n.]*Rp\s?\d/i],
    },
  },
  {
    // The day is still running: the figure must come with "so far" wording (prompt rule).
    id: "revenue-today-running",
    refs: [],
    suite: "regression",
    category: "numbers",
    turns: ["omzet hari ini udah berapa?"],
    expect: {
      tools: [metric("revenue", "today")],
      facts: [{ args: metric("revenue", "today").args, near: /omzet/i }],
      mustMatch: [/sampai|baru|sejauh|hingga|per jam|pukul/i],
    },
  },
  {
    id: "revenue-yesterday",
    refs: [],
    suite: "regression",
    category: "numbers",
    turns: ["kemarin dapet omzet berapa?"],
    expect: {
      tools: [metric("revenue", "yesterday")],
      facts: [{ args: metric("revenue", "yesterday").args, near: /omzet|kemarin/i }],
    },
  },
  {
    id: "items-sold-last-week",
    refs: [],
    suite: "regression",
    category: "numbers",
    turns: ["minggu lalu total kejual berapa porsi?"],
    expect: {
      tools: [metric("items_sold", "last_week")],
      facts: [{ args: metric("items_sold", "last_week").args, near: /porsi|terjual|kejual/i }],
    },
  },
  {
    id: "gross-profit-last-month",
    refs: [],
    suite: "regression",
    category: "numbers",
    turns: ["laba kotor bulan september berapa?"],
    expect: {
      anyTool: [
        metric("gross_profit", "last_month"),
        metric("gross_profit", "custom", { startDate: "2026-09-01", endDate: "2026-09-30" }),
      ],
      facts: [{ args: metric("gross_profit", "last_month").args, near: /laba kotor/i }],
    },
  },
  {
    // Week to date (Monday to now), not seven full days.
    id: "revenue-this-week",
    refs: [],
    suite: "regression",
    category: "numbers",
    turns: ["minggu ini omzetnya udah berapa?"],
    expect: {
      tools: [metric("revenue", "this_week")],
      facts: [{ args: metric("revenue", "this_week").args, near: /omzet/i }],
    },
  },
  {
    id: "revenue-vs-previous-week",
    refs: ["E5"],
    suite: "regression",
    category: "numbers",
    turns: ["omzet minggu lalu naik atau turun dibanding minggu sebelumnya?"],
    expect: {
      // Dates are ignored outside custom; some trials fill them with the same week.
      tools: [{ name: "queryMetric", args: { metric: "revenue", period: "last_week" } }],
      facts: [{ args: metric("revenue", "last_week").args, near: /omzet|minggu lalu/i }],
      mustMatch: [/turun/i],
    },
  },
  {
    // An open-ended custom range: "sejak" without an end date means up to now.
    id: "revenue-since-date",
    refs: [],
    suite: "regression",
    category: "numbers",
    turns: ["omzet dari tanggal 15 Oktober sampai sekarang berapa?"],
    expect: {
      anyTool: [
        metric("revenue", "custom", { startDate: "2026-10-15", endDate: null }),
        metric("revenue", "custom", { startDate: "2026-10-15", endDate: "2026-10-25" }),
      ],
      facts: [
        {
          args: metric("revenue", "custom", { startDate: "2026-10-15", endDate: null }).args,
          near: /omzet/i,
        },
      ],
    },
  },
  {
    id: "cogs-last-30-days",
    refs: [],
    suite: "regression",
    category: "numbers",
    turns: ["HPP 30 hari terakhir totalnya berapa?"],
    expect: {
      tools: [metric("cogs", "last_30_days")],
      facts: [{ args: metric("cogs", "last_30_days").args, near: /hpp|modal/i }],
    },
  },
];
