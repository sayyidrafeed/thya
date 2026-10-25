// Real /demo/chat answers captured 2026-10-25 around 11.32 WIB, shortened to fit the phone
// (docs/landing-content.md). Never hand-write numbers here; recapture from the API instead.

export type MockupConversation = {
  id: string;
  label: string;
  word: string;
  summary: string;
  question: string;
  answer: string;
};

export const mockupConversations = [
  {
    id: "revenue",
    label: "Revenue",
    word: "revenue",
    summary: "Yesterday's revenue, compared with the day before.",
    question: "Omzet kemarin berapa?",
    answer:
      "Omzet kemarin (*24 Okt 2026*) *Rp4.100.000*, naik *+25,8%* dibanding sehari sebelumnya (Rp3.260.000). Omzet itu semua uang masuk dari jualan, belum dipotong modal bahan Rp1.621.500.",
  },
  {
    id: "best-sellers",
    label: "Best sellers",
    word: "best sellers",
    summary: "What sold most this week, with an idea to sell more.",
    question: "Menu apa yang paling laku minggu ini?",
    answer: [
      "Ini menu paling laku minggu ini (19–25 Okt 2026):",
      "- *Es Kopi Susu Gula Aren*: *290* terjual, omzet Rp5.220.000 (margin 58,3%)",
      "- *Americano*: *122* terjual, omzet Rp1.830.000 (margin 70%)",
      "- *Pisang Goreng Madu*: *103* terjual, omzet Rp1.236.000 (margin 66,7%)",
      "",
      "Saran: coba paket bundling Es Kopi Susu + Pisang Goreng biar nilai transaksi naik.",
    ].join("\n"),
  },
  {
    id: "slow-movers",
    label: "Slow movers",
    word: "slow movers",
    summary: "What isn't moving this month, and what to try.",
    question: "Menu apa yang kurang laku bulan ini?",
    answer: [
      "Ini menu paling sepi bulan ini (1–25 Okt 2026):",
      "- *Croissant Butter*: 170 terjual, margin 40%",
      "- *Es Cokelat*: 254 terjual, margin 60%",
      "- *Mie Goreng Telur*: 294 terjual, margin 56,3%",
      "",
      "Croissant Butter paling sedikit terjual sekaligus marginnya paling tipis. Saran: coba bundling Croissant Butter dengan kopi pagi biar perputarannya naik.",
    ].join("\n"),
  },
  {
    id: "margin",
    label: "Margin",
    word: "margin",
    summary: "How much is left after ingredient costs, in plain words.",
    question: "Margin bulan lalu gimana?",
    answer: [
      "Margin kotor bulan lalu (*1–30 Sep 2026*) sebesar *60,5%*, turun tipis *0,1 poin* dibanding Agustus (60,6%).",
      "",
      "Artinya dari tiap Rp100.000 jualan, sekitar Rp60.500 tersisa setelah modal bahan.",
    ].join("\n"),
  },
] as const satisfies readonly MockupConversation[];
