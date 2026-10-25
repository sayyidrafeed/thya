import { z } from "zod";

// Who may receive promo email. For the final only seeded team addresses that agreed (G7).

export const CONSENT_SOURCES = ["seed"] as const;

export type ConsentSource = (typeof CONSENT_SOURCES)[number];

// PROMO_SEED_CUSTOMERS: JSON list read by the seed script, never committed.
export const seedCustomersSchema = z
  .array(z.object({ name: z.string().trim().min(1).max(80), email: z.email() }))
  .min(1)
  .max(20);

export type SeedCustomer = z.infer<typeof seedCustomersSchema>[number];

const TOKEN_BYTES = 32;

// 256 random bits, base64url: an unsubscribe link cannot be guessed from another one.
export function createUnsubscribeToken(): string {
  return Buffer.from(crypto.getRandomValues(new Uint8Array(TOKEN_BYTES))).toString("base64url");
}

// Parses the :token path segment of GET /email/unsubscribe/:token.
export const unsubscribeTokenSchema = z.string().regex(/^[A-Za-z0-9_-]{43}$/);

export function unsubscribeUrl(publicApiUrl: string, token: string): string {
  return `${publicApiUrl.replace(/\/+$/, "")}/email/unsubscribe/${token}`;
}
