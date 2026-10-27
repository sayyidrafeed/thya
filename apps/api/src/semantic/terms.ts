import type { ConceptId } from "./concepts";

// Words shop owners use for a metric. Owner: docs/semantic-education.md §3.1.
// All rows are team inference until interviews confirm them (source: "team").
// `formal` marks the precise term; using it unprompted counts as a sign the owner knows the concept.
export type Term = {
  phrase: string;
  concepts: ConceptId[];
  formal: boolean;
  locale: "id" | "jv";
};

export const TERMS: Term[] = [
  { phrase: "omzet", concepts: ["revenue"], formal: true, locale: "id" },
  { phrase: "pendapatan", concepts: ["revenue"], formal: true, locale: "id" },
  { phrase: "penjualan", concepts: ["revenue"], formal: true, locale: "id" },
  { phrase: "pemasukan", concepts: ["revenue"], formal: false, locale: "id" },
  { phrase: "jualan", concepts: ["revenue"], formal: false, locale: "id" },
  { phrase: "hasil jualan", concepts: ["revenue"], formal: false, locale: "id" },
  { phrase: "untung", concepts: ["gross_profit", "net_profit"], formal: false, locale: "id" },
  { phrase: "laba", concepts: ["gross_profit", "net_profit"], formal: false, locale: "id" },
  { phrase: "bathi", concepts: ["gross_profit", "net_profit"], formal: false, locale: "jv" },
  { phrase: "laba kotor", concepts: ["gross_profit"], formal: true, locale: "id" },
  { phrase: "untung kotor", concepts: ["gross_profit"], formal: false, locale: "id" },
  { phrase: "laba bersih", concepts: ["net_profit"], formal: true, locale: "id" },
  { phrase: "untung bersih", concepts: ["net_profit"], formal: false, locale: "id" },
  { phrase: "hpp", concepts: ["cogs"], formal: true, locale: "id" },
  { phrase: "harga pokok penjualan", concepts: ["cogs"], formal: true, locale: "id" },
  { phrase: "modal", concepts: ["cogs", "menu_cost"], formal: false, locale: "id" },
  { phrase: "modal bahan", concepts: ["cogs"], formal: false, locale: "id" },
  { phrase: "margin", concepts: ["gross_margin"], formal: true, locale: "id" },
  { phrase: "margin kotor", concepts: ["gross_margin"], formal: true, locale: "id" },
  { phrase: "persen untung", concepts: ["gross_margin"], formal: false, locale: "id" },
  { phrase: "laku", concepts: ["items_sold"], formal: false, locale: "id" },
  { phrase: "terjual", concepts: ["items_sold"], formal: false, locale: "id" },
  { phrase: "uang masuk qris", concepts: ["qris_in"], formal: true, locale: "id" },
  { phrase: "qris", concepts: ["qris_in"], formal: false, locale: "id" },
  { phrase: "uang qris", concepts: ["qris_in"], formal: false, locale: "id" },
  { phrase: "pembayaran qris", concepts: ["qris_in"], formal: false, locale: "id" },
  { phrase: "gofood", concepts: ["channel_sales"], formal: false, locale: "id" },
  { phrase: "go food", concepts: ["channel_sales"], formal: false, locale: "id" },
  { phrase: "grabfood", concepts: ["channel_sales"], formal: false, locale: "id" },
  { phrase: "grab", concepts: ["channel_sales"], formal: false, locale: "id" },
  { phrase: "shopeefood", concepts: ["channel_sales"], formal: false, locale: "id" },
  { phrase: "shopee food", concepts: ["channel_sales"], formal: false, locale: "id" },
  { phrase: "online", concepts: ["channel_sales"], formal: false, locale: "id" },
  { phrase: "jualan online", concepts: ["channel_sales"], formal: false, locale: "id" },
  { phrase: "ojol", concepts: ["channel_sales"], formal: false, locale: "id" },
  { phrase: "makan di tempat", concepts: ["channel_sales"], formal: false, locale: "id" },
  { phrase: "dine in", concepts: ["channel_sales"], formal: false, locale: "id" },
  { phrase: "jualan langsung", concepts: ["channel_sales"], formal: false, locale: "id" },
  { phrase: "komisi", concepts: ["app_commission"], formal: true, locale: "id" },
  { phrase: "komisi aplikasi", concepts: ["app_commission"], formal: true, locale: "id" },
  { phrase: "potongan aplikasi", concepts: ["app_commission"], formal: false, locale: "id" },
  { phrase: "potongan ojol", concepts: ["app_commission"], formal: false, locale: "id" },
];

export function normalizeTerm(phrase: string): string {
  return phrase.toLowerCase().replace(/\s+/g, " ").trim();
}

const termIndex = new Map(TERMS.map((term) => [term.phrase, term]));

export function findTerm(phrase: string | null): Term | null {
  if (phrase === null) return null;

  return termIndex.get(normalizeTerm(phrase)) ?? null;
}

// Synonym hint for tool descriptions, so the model and the table never drift apart.
export function termsFor(concept: ConceptId): string[] {
  return TERMS.flatMap((term) => (term.concepts.includes(concept) ? [term.phrase] : []));
}
