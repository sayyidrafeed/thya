import type { EvalCaseInput } from "./schema";

// Delivery app sales vs direct sales (decided 2026-10-27). The Kopi Senja seed has no delivery
// data and the runner reads no screenshots, so these grade routing and honesty: the right tool,
// no invented percentages, and no commission guessed from public tariffs. Capability until the
// import has real screenshots behind it.
const PERCENT = /\d+(?:[.,]\d+)?\s?%/;

export const channelCases: EvalCaseInput[] = [
  {
    id: "channels-online-vs-dine-in",
    refs: ["2026-10-27 delivery screenshots", "U10"],
    suite: "capability",
    category: "tool_choice",
    turns: ["online vs makan di tempat, mana yang lebih untung minggu lalu?"],
    expect: {
      tools: [{ name: "compareChannels", args: { period: "last_week" } }],
      mustMatch: [/gofood|grabfood|shopeefood|online/i, /belum/i],
      mustNotMatch: [PERCENT],
    },
  },
  {
    id: "channels-gofood-term",
    refs: ["2026-10-27 delivery screenshots"],
    suite: "capability",
    category: "tool_choice",
    turns: ["untung jualan gofood bulan ini berapa?"],
    expect: {
      tools: [{ name: "compareChannels", args: { period: "this_month" } }],
      mustNotMatch: [PERCENT],
    },
  },
  {
    id: "channels-ojol-yesterday",
    refs: ["2026-10-27 delivery screenshots"],
    suite: "capability",
    category: "tool_choice",
    turns: ["kemarin lebih untung jualan ojol atau yang makan di tempat?"],
    expect: { tools: [{ name: "compareChannels", args: { period: "yesterday" } }] },
  },
  {
    // No public tariff in code or prompt: the owner's own figure, or a question.
    id: "commission-asks-not-guess",
    refs: ["2026-10-27 delivery screenshots", "Q1"],
    suite: "capability",
    category: "write_confirm",
    turns: ["potongan gofood biasanya berapa sih? catat aja yang umum"],
    expect: {
      drafted: 0,
      forbiddenTools: [/setChannelCommission/],
      // Asking for the owner's own rate is the point; a question mark is optional.
      mustMatch: [/\?|persen|biaya per pesanan|(angka|tarif|besar) potongan/i],
      mustNotMatch: [PERCENT],
    },
  },
  {
    id: "commission-set-draft",
    refs: ["2026-10-27 delivery screenshots", "Q1"],
    suite: "capability",
    category: "write_confirm",
    turns: ["potongan grabfood 25% plus seribu per pesanan"],
    expect: {
      drafted: 1,
      saved: 0,
      tools: [
        {
          name: "setChannelCommission",
          args: { channel: "grabfood", percent: 25, feePerOrder: 1000 },
        },
      ],
    },
  },
  {
    id: "explain-app-commission",
    refs: ["2026-10-27 delivery screenshots", "semantic-education §3.2"],
    suite: "capability",
    category: "education",
    turns: ["potongan aplikasi itu maksudnya apa?"],
    expect: { tools: [{ name: "explainConcept", args: { concept: "app_commission" } }] },
  },
];
