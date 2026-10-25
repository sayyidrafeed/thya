// Meet Thya introduces the character, not the mechanics (those live in How it works).

export const meetThya = {
  heading: "Meet Thya.",
  lead: "The one on your team who's good with numbers. Thya works with the apps your shop already runs on, and you ask about all of it in everyday Indonesian.",
} as const;

export const thyaTraits = [
  {
    id: "language",
    title: "Talks like you do",
    body: "Everyday Indonesian in, plain answers out.",
  },
  {
    id: "apps",
    title: "Works with your apps",
    body: "GoFood, GrabFood, ShopeeFood, WhatsApp and Google Sheets.",
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

// App tiles floating around the mascot: where a food shop's numbers already live.
export const mascotApps = [
  "gofood",
  "grabfood",
  "shopeefood",
  "whatsapp",
  "sheets",
  "gmail",
] as const;
