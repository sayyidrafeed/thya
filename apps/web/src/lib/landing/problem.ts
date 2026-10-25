// Problem section. Pains follow the proposal's "Current State" (Slides chapter 2, Indy and Nawra);
// the Slides call them challenges still to validate, so the copy adds no figures or quotes.
// The diagram copies nalarx.com's "Inside the intelligence layer" layout (Rafee, 2026-10-25).

export const problemHeading = {
  title: "The numbers are there. The answers aren't.",
  lead: "A small-shop owner is also the cashier, the buyer, and the bookkeeper. The records are spread across a handful of apps. Thya brings them into one chat.",
} as const;

export const sources = {
  title: "Where the numbers live",
  apps: ["gofood", "grabfood", "shopeefood", "whatsapp", "sheets"] as const,
  others: ["Cashier app", "Notebook"] as const,
  more: "Receipts & more",
  ledger: {
    top: "Sales records",
    eyebrow: "Auto-sync",
    title: "One shop ledger",
    bottom: "Menu & costs",
  },
} as const;

export const engine = {
  title: "Thya engine",
  rows: [
    { id: "words", title: "Shop words", body: "Omzet, margin and HPP in your terms" },
    { id: "code", title: "Calculated by code", body: "Numbers are never guessed by the AI" },
    { id: "plain", title: "Plain Indonesian", body: "Short answers with one next step" },
    { id: "checked", title: "Checked before sending", body: "Every figure traced to the records" },
  ],
  caption: "The language model runs on servers in Indonesia, with no data kept.",
  sides: [
    { id: "trust", lines: ["Numbers checked", "Sources shown"] },
    { id: "learn", lines: ["Speaks shop", "Explains each term"] },
  ],
} as const;

export const shop = {
  title: "Your shop",
  owner: { name: "You", role: "Owner" },
  tasks: [
    { id: "revenue", name: "Omzet", role: "Today's sales", doing: "adding up today's sales" },
    { id: "best", name: "Menu laris", role: "Best sellers", doing: "ranking this week's menu" },
    { id: "sheets", name: "Sheets", role: "Daily recap", doing: "writing the recap to your sheet" },
    { id: "email", name: "Email", role: "Promo blast", doing: "drafting the promo for customers" },
  ],
} as const;
