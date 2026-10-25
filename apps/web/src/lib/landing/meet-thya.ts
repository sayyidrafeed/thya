// Every ask and reply is copied from a real /demo/chat exchange in mockup-conversations.ts.

export type ThyaTrait = {
  id: string;
  title: string;
  body: string;
  ask: string;
  reply: string;
};

export const thyaTraits = [
  {
    id: "language",
    title: "Talks like you do",
    body: "Ask in everyday Indonesian. No menus, no report builder, no formulas.",
    ask: "Menu apa yang kurang laku bulan ini?",
    reply: "Croissant Butter paling sedikit terjual sekaligus marginnya paling tipis.",
  },
  {
    id: "numbers",
    title: "Your numbers, not guesses",
    body: "Every figure is calculated from your sales records. The AI only writes the sentence around it.",
    ask: "Omzet kemarin berapa?",
    reply: "Omzet kemarin *Rp4.100.000*, naik *+25,8%* dibanding sehari sebelumnya.",
  },
  {
    id: "explains",
    title: "Explains as it answers",
    body: "Business terms come with a plain meaning, so revenue never gets mistaken for profit.",
    ask: "Omzet kemarin berapa?",
    reply: "Omzet itu semua uang masuk dari jualan, belum dipotong modal bahan.",
  },
  {
    id: "next-step",
    title: "Suggests a next step",
    body: "An answer ends with something you can try at the counter tomorrow.",
    ask: "Menu apa yang paling laku minggu ini?",
    reply: "Saran: coba paket bundling Es Kopi Susu + Pisang Goreng biar nilai transaksi naik.",
  },
  {
    id: "local",
    title: "Built in Indonesia",
    body: "Made for Indonesian shops, on a .id domain, with the language model running on servers in Indonesia.",
    ask: "Margin bulan lalu gimana?",
    reply: "Artinya dari tiap Rp100.000 jualan, sekitar Rp60.500 tersisa setelah modal bahan.",
  },
] as const satisfies readonly ThyaTrait[];

export const meetThyaHeading = "Thya, in its own words.";
