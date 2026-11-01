import { createHash, createHmac, timingSafeEqual } from "node:crypto";

// The handshake's verify token, compared in constant time; hashing gives both sides one length.
export function sameSecret(given: string | undefined, secret: string) {
  const digest = (value: string) => createHash("sha256").update(value, "utf8").digest();

  return given !== undefined && timingSafeEqual(digest(given), digest(secret));
}

// Meta signs the exact bytes it sent (X-Hub-Signature-256: sha256=<hex>). The check runs on the raw
// body before JSON.parse, because re-serialising parsed JSON never reproduces those bytes.
export function verifySignature(rawBody: string, header: string | null, appSecret: string) {
  if (header === null || !header.startsWith("sha256=")) return false;

  const expected = createHmac("sha256", appSecret).update(rawBody, "utf8").digest();
  const given = Buffer.from(header.slice("sha256=".length), "hex");

  // timingSafeEqual throws on a length mismatch, which would leak nothing but still crash.
  return given.length === expected.length && timingSafeEqual(given, expected);
}
