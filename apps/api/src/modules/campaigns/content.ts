import { z } from "zod";
import { formatRupiah } from "../../sales/format";
import type { MenuItem } from "../../sales/report";

// Rules for promo emails the model writes as tool arguments (S7). Code checks, the model rewrites.

export const MAX_SUBJECT_CHARS = 80;
export const MAX_BODY_CHARS = 1_500;

// SES sandbox sends about 1 email/second; check the console before raising.
export const SES_SEND_INTERVAL_MS = 1_000;
export const CAMPAIGNS_PER_DAY = 1;

export const promoEmailSchema = z.object({
  goal: z.string().trim().min(1).max(200),
  subject: z.string().trim().min(1).max(MAX_SUBJECT_CHARS),
  body: z.string().trim().min(1).max(MAX_BODY_CHARS),
  menuNames: z.array(z.string().trim().min(1)).nullable(),
});

export type PromoEmail = z.infer<typeof promoEmailSchema>;

export type ContentCheck = { status: "ok" } | { status: "rejected"; reasons: string[] };

const LINK =
  /(?:https?:\/\/|www\.)\S+|\b[a-z0-9-]+(?:\.[a-z0-9-]+)*\.(?:com|id|net|org|co|io|ly|me|app|link|xyz|info|biz|site|online|store|shop|my)\b/i;

// Owner-only numbers. "untung" is left out: to a customer it means a good deal.
const BUSINESS_FIGURES =
  /\b(?:omzet|omset|laba|profit|margin|pendapatan|revenue|penghasilan|terjual)\b/i;

const MONEY =
  /\brp\.?\s*(\d{1,3}(?:\.\d{3})+|\d+(?:,\d+)?)\s*(rb|ribu|k|jt|juta)?\b|\b(\d+(?:,\d+)?)\s*(rb|ribu|k)\b/gi;

const MULTIPLIERS = new Map([
  ["rb", 1_000],
  ["ribu", 1_000],
  ["k", 1_000],
  ["jt", 1_000_000],
  ["juta", 1_000_000],
]);

function toRupiah(amount: string, suffix: string | undefined): number {
  const multiplier = suffix === undefined ? undefined : MULTIPLIERS.get(suffix.toLowerCase());

  if (multiplier === undefined) return Number(amount.replaceAll(".", "").replace(",", "."));

  return Math.round(Number(amount.replace(",", ".")) * multiplier);
}

export function moneyAmounts(text: string): number[] {
  return [...text.matchAll(MONEY)].map((match) =>
    match[1] === undefined ? toRupiah(match[3] ?? "", match[4]) : toRupiah(match[1], match[2]),
  );
}

const normalizeName = (name: string) => name.trim().toLowerCase().replaceAll(/\s+/g, " ");

function priceReasons(email: PromoEmail, menu: MenuItem[]): string[] {
  const named = (email.menuNames ?? []).map((name) => ({
    name,
    item: menu.find((candidate) => normalizeName(candidate.name) === normalizeName(name)),
  }));

  const unknown = named.flatMap(({ name, item }) => (item === undefined ? [name] : []));

  // A bundle may quote its normal price: the sum of the named menu prices.
  const bundlePrice = named.reduce((sum, { item }) => sum + (item?.price ?? 0), 0);
  const allowed = new Set([...menu.map((item) => item.price), bundlePrice]);
  const text = `${email.subject}\n${email.body}`;
  const wrong = moneyAmounts(text).filter((amount) => !allowed.has(amount));

  return [
    ...unknown.map((name) => `Menu "${name}" tidak ada di daftar menu.`),
    ...wrong.map(
      (amount) =>
        `Harga ${formatRupiah(amount)} tidak cocok dengan harga menu mana pun. Pakai harga menu, dan tulis diskon sebagai persen.`,
    ),
  ];
}

export function checkPromoEmail(email: PromoEmail, menu: MenuItem[]): ContentCheck {
  const text = `${email.subject}\n${email.body}`;

  const reasons = [
    ...(LINK.test(text)
      ? ["Jangan tulis link; link berhenti langganan ditambahkan otomatis."]
      : []),
    ...(BUSINESS_FIGURES.test(text)
      ? ["Jangan sebut omzet, laba, atau jumlah terjual ke pelanggan."]
      : []),
    ...priceReasons(email, menu),
  ];

  return reasons.length === 0 ? { status: "ok" } : { status: "rejected", reasons };
}

// Plain-text email: the model's body plus a footer that only code writes.
export function composeEmailText(
  body: string,
  businessName: string,
  unsubscribeUrl: string,
): string {
  return `${body.trim()}\n\n--\n${businessName}\nTidak mau terima email promo lagi? Klik: ${unsubscribeUrl}`;
}
