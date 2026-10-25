import { mockupConversations } from "@/lib/landing/mockup-conversations";
import type { ChatStep } from "@/lib/landing/showcase-scenes";

// Playground: the visitor drives one story, "the night after Kopi Senja closes" (docs/landing-demo-plan.md).
// Act 1 replays real /demo/chat answers. The chart's daily revenue is the demo-shop seed for
// 18–24 Okt 2026 (buildDemoSales at 2026-10-25 11.32 WIB), the same data behind those answers.

export type PlaygroundBeat = {
  id: string;
  rail: string;
  chip: string;
  steps: readonly ChatStep[];
};

export type PlaygroundAct = {
  id: string;
  label: string;
  title: string;
  beats: readonly PlaygroundBeat[];
};

function fromConversation(id: string, rail: string): PlaygroundBeat {
  const conversation = mockupConversations.find((item) => item.id === id);

  if (!conversation) throw new Error(`Missing mockup conversation: ${id}`);

  return {
    id,
    rail,
    chip: conversation.question,
    steps: [
      { from: "user", kind: "text", text: conversation.question },
      { from: "thya", kind: "text", text: conversation.answer },
    ],
  };
}

const chartQuestion = "Kasih grafik omzet 7 hari terakhir.";

const revenueChart: PlaygroundBeat = {
  id: "chart",
  rail: "Weekly chart",
  chip: chartQuestion,
  steps: [
    { from: "user", kind: "text", text: chartQuestion },
    {
      from: "thya",
      kind: "chart",
      title: "Omzet harian",
      meta: "18–24 Okt 2026",
      bars: [
        { label: "Min 18", value: 3_727_000, display: "3,7 jt" },
        { label: "Sen 19", value: 2_489_000, display: "2,5 jt" },
        { label: "Sel 20", value: 2_623_000, display: "2,6 jt" },
        { label: "Rab 21", value: 2_561_000, display: "2,6 jt" },
        { label: "Kam 22", value: 2_991_000, display: "3 jt" },
        { label: "Jum 23", value: 3_260_000, display: "3,3 jt" },
        { label: "Sab 24", value: 4_100_000, display: "4,1 jt" },
      ],
      caption:
        "Total 7 hari *Rp21.751.000*. Tertinggi Sabtu 24 Okt (Rp4.100.000), terendah Senin 19 Okt (Rp2.489.000).",
    },
  ],
};

export const playgroundGreeting: ChatStep = {
  from: "thya",
  kind: "text",
  text: "Halo! Kopi Senja udah tutup ya. Mau cek apa malam ini?",
};

export const playgroundActs: readonly PlaygroundAct[] = [
  {
    id: "ask",
    label: "Ask",
    title: "Ask about the day",
    beats: [
      fromConversation("revenue", "Yesterday's revenue"),
      fromConversation("best-sellers", "Best sellers"),
      fromConversation("slow-movers", "Slow movers"),
      revenueChart,
      fromConversation("margin", "Last month's margin"),
    ],
  },
];
