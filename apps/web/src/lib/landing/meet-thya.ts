// Every quote is copied from a real /demo/chat answer in mockup-conversations.ts.

export type ThyaTrait = {
  id: string;
  title: string;
  body: string;
  quote: string;
};

export const thyaTraits = [
  {
    id: "language",
    title: "Talks like you do",
    body: "Ask in everyday Indonesian. No menus, no report builder, no formulas.",
    quote: "Omzet kemarin berapa?",
  },
  {
    id: "numbers",
    title: "Your numbers, not guesses",
    body: "Every figure is calculated from your sales records. The AI only writes the sentence around it.",
    quote: "Omzet kemarin Rp4.100.000, naik +25,8% dibanding sehari sebelumnya.",
  },
  {
    id: "explains",
    title: "Explains as it answers",
    body: "Business terms come with a plain meaning, so revenue never gets mistaken for profit.",
    quote: "Omzet itu semua uang masuk dari jualan, belum dipotong modal bahan.",
  },
  {
    id: "next-step",
    title: "Suggests a next step",
    body: "An answer ends with something you can try at the counter tomorrow.",
    quote: "Saran: coba paket bundling Es Kopi Susu + Pisang Goreng biar nilai transaksi naik.",
  },
  {
    id: "local",
    title: "Built in Indonesia",
    body: "Made for Indonesian shops, on a .id domain, with the language model running on servers in Indonesia.",
    quote: "Artinya dari tiap Rp100.000 jualan, sekitar Rp60.500 tersisa setelah modal bahan.",
  },
] as const satisfies readonly ThyaTrait[];

export const featuredFigure = {
  value: "Rp4.100.000",
  caption: "Kopi Senja's revenue yesterday, from one question.",
} as const;

export const meetThyaHeading = {
  bento: "Meet Thya, the one on your team who's good with numbers.",
  rows: "Thya is a chat, not another app to learn.",
  quotes: "Thya, in its own words.",
} as const;
