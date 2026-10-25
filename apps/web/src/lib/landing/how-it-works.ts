import type { mockupConversations } from "@/lib/landing/mockup-conversations";

export type HowItWorksStep = {
  id: string;
  tag: string;
  title: string;
  body: string;
  conversationId: (typeof mockupConversations)[number]["id"] | null;
  checking: boolean;
};

export const howItWorksSteps = [
  {
    id: "ask",
    tag: "In a chat",
    title: "Ask the way you'd ask a friend.",
    body: "Type a normal question in Indonesian, like “omzet kemarin berapa?”. There are no menus to find and no report to set up.",
    conversationId: "revenue",
    checking: false,
  },
  {
    id: "check",
    tag: "From your records",
    title: "Thya checks the numbers before it answers.",
    body: "Each figure is worked out with fixed calculations on your sales data. The language model only writes the sentence. If the data isn't there yet, Thya says so instead of guessing.",
    conversationId: "best-sellers",
    checking: true,
  },
  {
    id: "understand",
    tag: "In plain words",
    title: "Get the answer, and what it means.",
    body: "Terms like gross margin come with a one-line meaning, and most answers end with one thing you can try next.",
    conversationId: "margin",
    checking: false,
  },
  {
    id: "next",
    tag: "Coming next",
    title: "Then, on WhatsApp.",
    body: "We're building a WhatsApp number, recording sales by chat with a check before anything is saved, and a daily recap. None of these are live yet.",
    conversationId: null,
    checking: false,
  },
] as const satisfies readonly HowItWorksStep[];

export const comingNext = [
  "A WhatsApp number to chat with Thya",
  "Recording sales by chat, confirmed before saving",
  "A daily recap sent at closing time",
] as const;
