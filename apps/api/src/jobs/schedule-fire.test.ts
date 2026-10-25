import { describe, expect, test } from "bun:test";
import { windowOpen } from "./schedule-fire";

describe("windowOpen (S4-AC4)", () => {
  const now = new Date("2026-10-26T21:00:00+07:00");
  const ago = (minutes: number) => new Date(now.getTime() - minutes * 60_000);

  test("free-form only while the last owner message is under 23 h 50 min old", () => {
    expect(windowOpen(ago(23 * 60 + 49), now)).toBe(true);
    expect(windowOpen(ago(23 * 60 + 50), now)).toBe(false);
    expect(windowOpen(ago(24 * 60), now)).toBe(false);
    expect(windowOpen(null, now)).toBe(false);
  });
});
