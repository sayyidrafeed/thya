import { describe, expect, test } from "bun:test";
import { compareRuns, passHat, type RunSummary } from "./compare";
import { anonymize } from "./from-trace";

const run = (
  rows: [id: string, suite: "regression" | "capability", passed: number, trials: number][],
  actions: Record<string, number> = { none: 10 },
): RunSummary => ({
  totals: { status: "PASS", actions },
  summary: rows.map(([id, suite, passed, trials]) => ({
    id,
    suite,
    category: "numbers",
    trials,
    passed,
    errored: 0,
    failedChecks: [],
  })),
});

describe("compareRuns", () => {
  test("a regression case that passes less often blocks, compared by proportion", () => {
    const result = compareRuns(run([["a", "regression", 3, 3]]), run([["a", "regression", 4, 5]]));

    expect(result.status).toBe("BLOCKED");
    expect(result.cases[0]?.change).toBe("dropped");
  });

  test("a capability drop is recorded but does not block", () => {
    const result = compareRuns(run([["a", "capability", 3, 3]]), run([["a", "capability", 0, 3]]));

    expect(result.status).toBe("PASS");
  });

  test("more Q2 interventions need review even when every case passes (U8)", () => {
    const result = compareRuns(
      run([["a", "regression", 3, 3]], { none: 10 }),
      run([["a", "regression", 3, 3]], { none: 9, dropped: 1 }),
    );

    expect(result.status).toBe("REVIEW");
  });

  test("a regression case missing from the candidate needs review", () => {
    expect(compareRuns(run([["a", "regression", 3, 3]]), run([])).status).toBe("REVIEW");
  });
});

test("passHat is the unbiased pass^k estimate", () => {
  expect(passHat(5, 5, 3)).toBe(1);
  expect(passHat(5, 4, 3)).toBeCloseTo(0.4);
  expect(passHat(3, 2, 3)).toBe(0);
});

test("anonymize replaces contacts, the shop name and amounts but keeps years", () => {
  expect(
    anonymize(
      "Warung Bu Ani omzet 2.550.000 tgl 5 Okt 2026, gula 40 ribu, wa 081398765432, ani@mail.com",
      "Warung Bu Ani",
    ),
  ).toBe(
    "Kopi Senja omzet 2.295.000 tgl 5 Okt 2026, gula 36 ribu, wa 081234567890, pemilik@contoh.id",
  );
});
