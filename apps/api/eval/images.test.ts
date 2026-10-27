import { describe, expect, test } from "bun:test";
import type { ExtractedRow, Extraction } from "../src/modules/payments-import";
import {
  acCorrect,
  answerKeySchema,
  gradeRun,
  summarizeImage,
  verdict,
  type RunGrade,
} from "./images-grade";

const TODAY = "2026-10-27";

const key = answerKeySchema.parse({
  today: TODAY,
  documentKind: "payment_history",
  import: [
    { date: "2026-10-26", time: "09:15", amount: 18_000, method: "qris", reference: "A1" },
    { date: "2026-10-26", time: "10:02", amount: 25_500, method: "qris", reference: "B2" },
  ],
  skip: [
    { date: "2026-10-26", time: "11:40", amount: 30_000, reason: "failed" },
    { date: "2026-10-26", time: "12:05", amount: 18_000, reason: "out" },
  ],
});

type Read = Omit<ExtractedRow, "sourceRow">;

const qris = (row: Partial<Read> & Pick<Read, "time" | "amount">): Read => ({
  date: "2026-10-26",
  direction: "in",
  status: "success",
  method: "qris",
  reference: null,
  ...row,
});

const exact: Read[] = [
  qris({ time: "09:15", amount: 18_000, reference: "A1" }),
  qris({ time: "10:02", amount: 25_500, reference: "B2" }),
  qris({ time: "11:40", amount: 30_000, status: "failed" }),
  qris({ time: "12:05", amount: 18_000, direction: "out", method: "other" }),
];

function read(
  rows: Read[],
  documentKind: "payment_history" | "bank_statement" = "payment_history",
): Extraction {
  return {
    status: "ok",
    documentKind,
    rows: rows.map((row, sourceRow) => ({ ...row, sourceRow })),
    settlement: null,
    shownTotal: null,
  };
}

const problems = (run: RunGrade) =>
  Object.fromEntries(run.rows.map((row) => [row.row, row.problems]));

describe("gradeRun", () => {
  test("a faithful read matches every row and saves only the money in", () => {
    const run = gradeRun(key, read(exact), TODAY);

    expect(run.rows.every((row) => row.found && row.problems.length === 0)).toBe(true);
    expect(run).toMatchObject({ kindMatches: true, extra: 0, unknownAmounts: 0 });
  });

  test("a wrong minute and a wrong amount are told apart, and an invented amount is counted", () => {
    const run = gradeRun(
      key,
      read([
        qris({ time: "09:51", amount: 18_000, reference: "A1" }),
        qris({ time: "10:02", amount: 255_000, reference: "B2" }),
        exact[2]!,
        exact[3]!,
      ]),
      TODAY,
    );

    expect(problems(run)).toMatchObject({ "import[0]": ["time"], "import[1]": ["amount"] });
    expect(run.rows.filter(acCorrect).map((row) => row.row)).toEqual(["skip[0]", "skip[1]"]);
    expect(run.unknownAmounts).toBe(1);
  });

  test("a failed payment read as success is saved by the plan and flagged", () => {
    const run = gradeRun(
      key,
      read([exact[0]!, exact[1]!, qris({ time: "11:40", amount: 30_000 }), exact[3]!]),
      TODAY,
    );

    expect(problems(run)["skip[0]"]).toEqual(["imported", "reason"]);
  });

  test("a missed row, an extra row, and a reference misread that does not count against S9-AC1", () => {
    const run = gradeRun(
      key,
      read([
        qris({ time: "09:15", amount: 18_000, reference: "A7" }),
        exact[2]!,
        exact[3]!,
        qris({ time: "13:00", amount: 18_000 }),
      ]),
      TODAY,
    );

    expect(run.rows.find((row) => row.row === "import[1]")?.found).toBe(false);
    expect(problems(run)["import[0]"]).toEqual(["reference"]);
    expect(acCorrect(run.rows[0]!)).toBe(true);
    expect(run).toMatchObject({ extra: 1, extraImported: 1, unknownAmounts: 0 });
  });

  test("a bank transfer in is skipped as not QRIS when read as a transfer", () => {
    const bank = answerKeySchema.parse({
      today: TODAY,
      documentKind: "bank_statement",
      import: [{ date: "2026-10-26", time: null, amount: 36_000, method: "qris", reference: null }],
      skip: [{ date: "2026-10-26", time: null, amount: 500_000, reason: "not_qris" }],
    });

    const run = gradeRun(
      bank,
      read(
        [
          qris({ time: null, amount: 36_000 }),
          qris({ time: null, amount: 500_000, method: "transfer" }),
        ],
        "bank_statement",
      ),
      TODAY,
    );

    expect(run.rows.map((row) => [row.row, row.inSuccess, row.problems])).toEqual([
      ["import[0]", true, []],
      ["skip[0]", true, []],
    ]);
  });

  test("an unreadable answer for a readable picture misses every row", () => {
    const run = gradeRun(key, { status: "unreadable", message: "" }, TODAY);

    expect(run.kindMatches).toBe(false);
    expect(run.rows.every((row) => !row.found)).toBe(true);
  });
});

describe("verdict (S9-AC1)", () => {
  const good = () => gradeRun(key, read(exact), TODAY);
  const five = (run: () => RunGrade) => Array.from({ length: 5 }, run);

  test("three screenshots, five faithful runs each: PASS", () => {
    const images = ["a", "b", "c"].map((name) => ({ name, runs: five(good) }));

    expect(verdict(images)).toMatchObject({ status: "PASS", rowShare: 1, unknownAmounts: 0 });
  });

  test("one invented amount in one run fails, whatever the row share", () => {
    const invented = gradeRun(
      key,
      read([...exact, qris({ time: "14:00", amount: 99_000 })]),
      TODAY,
    );

    const images = ["a", "b", "c"].map((name) => ({ name, runs: five(good) }));

    images[0]!.runs[4] = invented;

    expect(verdict(images).status).toBe("FAIL");
  });

  test("too few screenshots or runs, or a failed model call, is INCOMPLETE rather than PASS", () => {
    const errored = gradeRun(key, { status: "error", message: "" }, TODAY);

    expect(verdict([{ name: "a", runs: five(good) }]).status).toBe("INCOMPLETE");
    expect(
      verdict(["a", "b", "c"].map((name) => ({ name, runs: [good(), good(), good()] }))).status,
    ).toBe("INCOMPLETE");

    const withError = ["a", "b", "c"].map((name) => ({ name, runs: five(good) }));

    withError[1]!.runs[0] = errored;

    expect(verdict(withError)).toMatchObject({ status: "INCOMPLETE", rowShare: 1 });
  });

  test("the printed summary holds counts and row ids, never an amount", () => {
    const wrong = gradeRun(
      key,
      read([qris({ time: "09:51", amount: 18_000, reference: "A1" }), ...exact.slice(1)]),
      TODAY,
    );

    const summary = summarizeImage([good(), wrong]);

    expect(summary).toMatchObject({ runs: 2, rows: 8, matched: 7, wrongDate: 1, missing: 0 });
    expect(summary.issues).toEqual(["import[0]: time x1"]);
    expect(JSON.stringify(summary)).not.toMatch(/18000|25500|30000/);
  });
});
