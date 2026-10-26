import { expect, test } from "bun:test";
import { clientAddress, createRateLimiter } from "./rate-limit";

test("each visitor gets the limit per window, and a new window starts fresh", () => {
  const allow = createRateLimiter({ limit: 2, windowMs: 60_000 });

  expect([allow("a", 0), allow("a", 1), allow("a", 2), allow("b", 3)]).toEqual([
    true,
    true,
    false,
    true,
  ]);
  expect(allow("a", 60_000)).toBe(true);
});

test("the visitor is the first forwarded address, not the proxy", () => {
  const request = new Request("http://thya/demo/chat", {
    headers: { "x-forwarded-for": "203.0.113.7, 10.0.0.2" },
  });

  expect(clientAddress(request, "10.0.0.2")).toBe("203.0.113.7");
  expect(clientAddress(new Request("http://thya/demo/chat"), "10.0.0.2")).toBe("10.0.0.2");
});
