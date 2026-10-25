import { mockupConversations } from "@/lib/landing/mockup-conversations";

// Hero phone scenes. "today" scenes replay real /demo/chat answers. "next" scenes show automations
// the API does not run yet (Sheets, email); Rafee chose to show them unlabelled (2026-10-25) and build
// them before the final. Their only figures are real ones (daily revenue 23–24 Okt).

export type ChatStep =
  | { from: "user" | "thya"; kind: "text"; text: string }
  | { from: "user"; kind: "link"; title: string; url: string }
  | { from: "thya"; kind: "sheet"; title: string; rows: readonly (readonly [string, string])[] }
  | { from: "thya"; kind: "email"; subject: string; status: string }
  | {
      from: "thya";
      kind: "chart";
      title: string;
      meta: string;
      bars: readonly { label: string; value: number; display: string }[];
      caption: string;
    };

export type Scene = {
  id: string;
  group: "today" | "next";
  label: string;
  summary: string;
  steps: readonly ChatStep[];
};

// Four use cases in the hero: two that work today, two automations that are coming next.
const todayIds = new Set(["revenue", "best-sellers"]);

const todayScenes: Scene[] = mockupConversations
  .filter((conversation) => todayIds.has(conversation.id))
  .map((conversation) => ({
    id: conversation.id,
    group: "today",
    label: conversation.label,
    summary: conversation.summary,
    steps: [
      { from: "user", kind: "text", text: conversation.question },
      { from: "thya", kind: "text", text: conversation.answer },
    ],
  }));

const nextScenes: Scene[] = [
  {
    id: "sheets",
    group: "next",
    label: "Update a sheet",
    summary: "Send a Google Sheets link and Thya fills in your daily revenue.",
    steps: [
      {
        from: "user",
        kind: "link",
        title: "Laporan Kopi Senja",
        url: "docs.google.com/spreadsheets",
      },
      { from: "user", kind: "text", text: "Tambahin omzet dua hari terakhir ke sheet ini ya." },
      {
        from: "thya",
        kind: "sheet",
        title: "Laporan Kopi Senja · 2 baris baru",
        rows: [
          ["23 Okt", "Rp3.260.000"],
          ["24 Okt", "Rp4.100.000"],
        ],
      },
    ],
  },
  {
    id: "email",
    group: "next",
    label: "Email customers",
    summary: "Thya drafts a promo email and sends it once you say yes.",
    steps: [
      {
        from: "user",
        kind: "text",
        text: "Kirim promo bundling ke pelanggan, ya.",
      },
      {
        from: "thya",
        kind: "email",
        subject: "Paket pagi: Es Kopi Susu + Pisang Goreng",
        status: "Draft siap. Kirim sekarang?",
      },
      { from: "user", kind: "text", text: "Kirim." },
      {
        from: "thya",
        kind: "email",
        subject: "Paket pagi: Es Kopi Susu + Pisang Goreng",
        status: "Terkirim ke daftar pelanggan.",
      },
    ],
  },
];

export const showcaseScenes = [...todayScenes, ...nextScenes] as const;

export function firstUserLine(scene: Scene) {
  const step = scene.steps.find((item) => item.from === "user" && item.kind === "text");

  return step?.kind === "text" ? step.text : scene.label;
}
