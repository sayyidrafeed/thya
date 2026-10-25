// Problem section. Pains follow the proposal's "Current State" (Slides chapter 2, Indy and Nawra);
// the Slides call them challenges still to validate, so the copy adds no figures or quotes.

export const problemHeading = {
  title: "The numbers are there. The answers aren't.",
  lead: "A small-shop owner is also the cashier, the buyer, and the bookkeeper. The records exist. What's missing is the time to turn them into an answer.",
} as const;

export const diagram = {
  sources: {
    title: "Scattered across",
    items: ["Notebook", "Receipts", "Cashier app", "Memory"],
  },
  questions: {
    title: "Questions at closing time",
    items: [
      "Did we make money today?",
      "Which menu should I stop making?",
      "Was the promo worth it?",
    ],
    footnote: "A busy day doesn't mean a profitable one.",
  },
  costs: {
    title: "What it costs today",
    items: [
      "An evening adding up receipts",
      "Copying totals into a spreadsheet",
      "Guessing, because the day is over",
    ],
  },
  connectors: ["scattered", "by hand"],
  cta: "Thya answers these in one chat ↓",
} as const;
