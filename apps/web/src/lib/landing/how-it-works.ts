// How it works details the four hero use cases. Each step plays the matching scene from
// showcase-scenes.ts; "next" ones are automations that are not built yet and say so.

export type HowItWorksStep = {
  sceneId: "revenue" | "best-sellers" | "sheets" | "email";
  title: string;
  body: string;
};

export const howItWorksHeading = "Four things owners ask Thya for.";

export const howItWorksSteps = [
  {
    sceneId: "revenue",
    title: "Ask how yesterday went.",
    body: "Type a normal question like “omzet kemarin berapa?”. Thya works the figure out from your sales records, compares it with the day before, and says what the term means. If the data isn't there yet, it says so instead of guessing.",
  },
  {
    sceneId: "best-sellers",
    title: "Know what to sell more of.",
    body: "Ask what sold best this week. Thya lists the top menus with their revenue and margin, then suggests one thing to try, like bundling two best sellers together.",
  },
  {
    sceneId: "sheets",
    title: "Keep your spreadsheet up to date.",
    body: "Paste a Google Sheets link and ask Thya to add the latest daily revenue. It writes the rows and shows you exactly what changed.",
  },
  {
    sceneId: "email",
    title: "Reach your regulars.",
    body: "Ask Thya to send a promo. It drafts the email around your best sellers and only sends it once you say yes.",
  },
] as const satisfies readonly HowItWorksStep[];
