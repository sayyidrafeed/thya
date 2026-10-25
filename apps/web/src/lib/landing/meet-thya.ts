// Meet Thya introduces the character, not the mechanics (those live in How it works).
// Glossary meanings and examples come from real /demo/chat answers in mockup-conversations.ts.

export const meetThya = {
  heading: "Meet Thya.",
  lead: "The one on your team who's good with numbers. Ask about the shop the way you'd ask a coworker, in everyday Indonesian.",
  glossaryHeading: "Thya speaks shop, not finance.",
  glossaryLead:
    "Every answer names the term and says what it means, so a busy owner never has to guess.",
} as const;

export const thyaTraits = [
  {
    id: "language",
    title: "Talks like you do",
    body: "Everyday Indonesian in, plain answers out.",
  },
  {
    id: "numbers",
    title: "Numbers from your records",
    body: "Figures are calculated, never guessed by the AI.",
  },
  {
    id: "explains",
    title: "Explains the terms",
    body: "Revenue is never mistaken for profit.",
  },
  {
    id: "next-step",
    title: "Suggests a next step",
    body: "Most answers end with something to try tomorrow.",
  },
  {
    id: "local",
    title: "Built in Indonesia",
    body: "On a .id domain, with the model running in Indonesia.",
  },
] as const;

// Words floating around the mascot: the shop words Thya answers about.
export const shopWords = ["omzet", "menu laris", "margin", "modal bahan", "menu sepi"] as const;

export const glossary = [
  {
    term: "Omzet",
    meaning: "Revenue: every rupiah that came in from sales, before ingredient costs.",
    example: "Omzet itu semua uang masuk dari jualan, belum dipotong modal bahan.",
  },
  {
    term: "Margin kotor",
    meaning: "Gross margin: the share of sales left after ingredient costs.",
    example: "Dari tiap Rp100.000 jualan, sekitar Rp60.500 tersisa setelah modal bahan.",
  },
  {
    term: "Menu terlaris",
    meaning: "Best sellers: what sold the most in a period, with its revenue and margin.",
    example: "Es Kopi Susu Gula Aren: 290 terjual minggu ini.",
  },
  {
    term: "Menu sepi",
    meaning: "Slow movers: what barely sells, often with a thin margin too.",
    example: "Croissant Butter paling sedikit terjual sekaligus marginnya paling tipis.",
  },
] as const;
