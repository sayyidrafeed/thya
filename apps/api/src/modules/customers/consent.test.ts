import { describe, expect, test } from "bun:test";
import {
  createUnsubscribeToken,
  seedCustomersSchema,
  unsubscribeTokenSchema,
  unsubscribeUrl,
} from "./consent";

describe("unsubscribe token", () => {
  test("is random, URL safe and accepted by the route schema", () => {
    const tokens = Array.from({ length: 50 }, createUnsubscribeToken);

    expect(new Set(tokens).size).toBe(50);

    for (const token of tokens) expect(unsubscribeTokenSchema.safeParse(token).success).toBe(true);
  });

  test.each(["", "abc", "../../etc/passwd", `${"a".repeat(42)}=`, "a".repeat(44)])(
    "rejects %s at the route boundary",
    (token) => {
      expect(unsubscribeTokenSchema.safeParse(token).success).toBe(false);
    },
  );

  test("builds the link from the public API URL", () => {
    expect(unsubscribeUrl("https://api.thya.veterantech.id/", "tok")).toBe(
      "https://api.thya.veterantech.id/email/unsubscribe/tok",
    );
  });
});

describe("seedCustomersSchema", () => {
  test("accepts a short list of named addresses and rejects bad ones", () => {
    expect(
      seedCustomersSchema.safeParse([{ name: "Indy", email: "indy@example.com" }]).success,
    ).toBe(true);
    expect(seedCustomersSchema.safeParse([{ name: "Indy", email: "bukan-email" }]).success).toBe(
      false,
    );
    expect(seedCustomersSchema.safeParse([]).success).toBe(false);
  });
});
