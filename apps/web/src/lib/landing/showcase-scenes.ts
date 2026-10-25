import { mockupConversations } from "@/lib/landing/mockup-conversations";

// Hero phone scenes. "today" scenes replay real /demo/chat answers. "next" scenes are previews of
// automations that are not built yet: the UI labels them "Coming next" and the phone shows "Preview".
// Their only figures are real ones (daily revenue 23–24 Okt from the revenue answer).

export type ChatStep =
  | { from: "user" | "thya"; kind: "text"; text: string }
  | { from: "user"; kind: "link"; title: string; url: string }
  | { from: "thya"; kind: "sheet"; title: string; rows: readonly (readonly [string, string])[] }
  | { from: "thya"; kind: "calendar"; title: string; when: string }
  | { from: "thya"; kind: "email"; subject: string; status: string };

export type Scene = {
  id: string;
  group: "today" | "next";
  label: string;
  summary: string;
  steps: readonly ChatStep[];
};

const todayScenes: Scene[] = mockupConversations.map((conversation) => ({
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
    id: "calendar",
    group: "next",
    label: "Set a reminder",
    summary: "Ask for a reminder and Thya puts it on Google Calendar.",
    steps: [
      { from: "user", kind: "text", text: "Ingetin aku restock gula aren tiap Senin pagi ya." },
      {
        from: "thya",
        kind: "calendar",
        title: "Restock gula aren",
        when: "Setiap Senin, 07.00",
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
        text: "Kirim promo bundling Es Kopi Susu + Pisang Goreng ke pelanggan.",
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
