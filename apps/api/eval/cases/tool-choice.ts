import { metric, type EvalCaseInput } from "./schema";

export const toolChoiceCases: EvalCaseInput[] = [
  {
    id: "top-quantity-this-week",
    refs: [],
    suite: "regression",
    category: "tool_choice",
    turns: ["menu apa yang paling laku minggu ini?"],
    expect: {
      tools: [
        {
          name: "getTopMenuItems",
          args: { period: "this_week", sortBy: "quantity", direction: "best" },
        },
      ],
    },
  },
  {
    id: "worst-last-7-days",
    refs: [],
    suite: "regression",
    category: "tool_choice",
    turns: ["menu yang paling sepi 7 hari terakhir apa aja?"],
    expect: {
      tools: [{ name: "getTopMenuItems", args: { period: "last_7_days", direction: "worst" } }],
    },
  },
  {
    id: "top-revenue-last-month",
    refs: [],
    suite: "regression",
    category: "tool_choice",
    turns: ["menu yang paling banyak ngasih pemasukan bulan lalu apa?"],
    expect: {
      tools: [
        {
          name: "getTopMenuItems",
          args: { period: "last_month", sortBy: "revenue", direction: "best" },
        },
      ],
    },
  },
  {
    id: "busiest-day-last-week",
    refs: [],
    suite: "regression",
    category: "tool_choice",
    turns: ["minggu lalu hari apa yang paling rame?"],
    expect: { tools: [{ name: "getDailySales", args: { period: "last_week" } }] },
  },
  {
    // "7 hari terakhir" is seven full days up to yesterday, not this week.
    id: "last-7-days-not-this-week",
    refs: ["E3"],
    suite: "regression",
    category: "tool_choice",
    turns: ["omzet 7 hari terakhir berapa?"],
    expect: { tools: [metric("revenue", "last_7_days")] },
  },
  {
    id: "top-gross-profit-menu",
    refs: [],
    suite: "regression",
    category: "tool_choice",
    turns: ["menu mana yang paling banyak nyumbang untung bulan ini?"],
    expect: {
      tools: [
        {
          name: "getTopMenuItems",
          args: { period: "this_month", sortBy: "grossProfit", direction: "best" },
        },
      ],
    },
  },
  {
    // The prompt maps a general "gimana jualan" to revenue plus profit.
    id: "general-how-is-business",
    refs: [],
    suite: "regression",
    category: "tool_choice",
    turns: ["gimana jualan minggu ini kak?"],
    expect: {
      tools: [{ name: "queryMetric", args: { metric: "revenue", period: "this_week" } }],
      anyTool: [
        { name: "queryMetric", args: { metric: "profit", period: "this_week" } },
        { name: "queryMetric", args: { metric: "gross_profit", period: "this_week" } },
      ],
    },
  },
  {
    id: "daily-sales-custom-range",
    refs: [],
    suite: "regression",
    category: "tool_choice",
    turns: ["omzet harian dari tanggal 12 sampai 18 Oktober dong"],
    expect: {
      tools: [
        {
          name: "getDailySales",
          args: { period: "custom", startDate: "2026-10-12", endDate: "2026-10-18" },
        },
      ],
    },
  },
  {
    id: "worst-revenue-last-month",
    refs: [],
    suite: "regression",
    category: "tool_choice",
    turns: ["bulan lalu menu apa yang omzetnya paling kecil?"],
    expect: {
      tools: [
        {
          name: "getTopMenuItems",
          args: { period: "last_month", sortBy: "revenue", direction: "worst" },
        },
      ],
    },
  },
  {
    // "Balik modal" is about payback, not material cost: no cogs figure as an answer. Checking
    // net profit and saying it cannot be computed yet is a good answer too.
    id: "balik-modal-asks-back",
    refs: ["E3"],
    suite: "regression",
    category: "tool_choice",
    turns: ["kapan aku balik modal ya?"],
    expect: { mustNotMatch: [/Rp\s?\d/] },
  },
  {
    // Screenshot import runs in the channel, not runTurn (business-features S9). By text, Thya
    // should ask for the image instead of inventing payments.
    id: "screenshot-qris-by-text",
    refs: ["S9"],
    suite: "capability",
    category: "tool_choice",
    turns: ["bisa catat pemasukan dari screenshot QRIS nggak?"],
    expect: {
      forbiddenTools: [/draft|record|confirm/i],
      mustMatch: [/kirim|foto|screenshot|gambar/i],
      mustNotMatch: [/Rp\s?\d/],
    },
  },
];
