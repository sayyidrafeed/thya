// Gate G11: grades payment-screenshot extractions against a hand-written answer key, and decides
// S9-AC1 (business-features-plan S9) over the whole folder. Pure: no model, no files, no images.
import { z } from "zod";
import {
  PAYMENT_METHODS,
  planPaymentsImport,
  type ExtractedRow,
  type Extraction,
} from "../src/modules/payments-import";

const day = z.iso.date();

const minute = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
  .nullable();

const rupiah = z.number().int().positive();

// Why a visible row must stay out of `payments`. Each names what the extraction has to read.
export const SKIP_REASONS = ["out", "failed", "pending", "not_qris", "too_old"] as const;

type SkipReason = (typeof SKIP_REASONS)[number];

export const answerKeySchema = z.object({
  // The day the screenshot was taken: resolves a missing year and the 90-day limit. Default: today.
  today: day.optional(),
  documentKind: z.enum([
    "payment_history",
    "settlement",
    "bank_statement",
    "not_transactions",
    "unreadable",
  ]),
  // Money in that should be saved. `time` null = no time shown (bank statements).
  import: z
    .array(
      z.object({
        date: day,
        time: minute,
        amount: rupiah,
        method: z.enum(PAYMENT_METHODS),
        reference: z.string().nullable(),
      }),
    )
    .default([]),
  // Every other transaction row on the picture, with why it stays out.
  skip: z
    .array(z.object({ date: day, time: minute, amount: rupiah, reason: z.enum(SKIP_REASONS) }))
    .default([]),
});

export type AnswerKey = z.infer<typeof answerKeySchema>;

// S9-AC1 grades date, time, amount, direction and status; the rest is reported, not gated.
const AC_FIELDS = ["date", "time", "amount", "direction", "status"] as const;

export type Problem =
  | (typeof AC_FIELDS)[number]
  | "method"
  | "reference"
  | "not_imported"
  | "imported"
  | "reason";

export type RowGrade = {
  row: string;
  // A money-in row that succeeded: what the ≥ 95% in S9-AC1 counts.
  inSuccess: boolean;
  found: boolean;
  problems: Problem[];
};

export type RunGrade = {
  outcome: Extraction["status"];
  kindMatches: boolean;
  rows: RowGrade[];
  // Extracted rows that answer no key row, and how many of those the plan would have saved.
  extra: number;
  extraImported: number;
  // Extracted amounts that appear nowhere in the key: S9-AC1 allows zero.
  unknownAmounts: number;
};

type KeyRow = {
  row: string;
  date: string;
  time: string | null;
  amount: number;
  expected: { import: AnswerKey["import"][number] } | { skip: SkipReason };
};

const READS_AS: Record<SkipReason, (row: ExtractedRow) => boolean> = {
  out: (row) => row.direction === "out",
  failed: (row) => row.status === "failed",
  pending: (row) => row.status === "pending" || row.status === "unknown",
  not_qris: (row) => row.method !== "qris",
  too_old: () => true,
};

const isInSuccess = (expected: KeyRow["expected"]) =>
  "import" in expected || expected.skip === "not_qris" || expected.skip === "too_old";

// Exact rows first, then the same amount on another date or time, then the same minute with
// another amount, so each key row meets the extracted row it most likely is.
const PASSES: ((want: KeyRow, got: ExtractedRow) => boolean)[] = [
  (want, got) => got.amount === want.amount && got.date === want.date && got.time === want.time,
  (want, got) => got.amount === want.amount,
  (want, got) => want.time !== null && got.date === want.date && got.time === want.time,
];

function pair(keyRows: KeyRow[], rows: ExtractedRow[]) {
  const pairs = new Map<string, ExtractedRow>();
  const used = new Set<number>();

  for (const same of PASSES)
    for (const want of keyRows) {
      if (pairs.has(want.row)) continue;

      const got = rows.find((row) => !used.has(row.sourceRow) && same(want, row));

      if (got === undefined) continue;

      pairs.set(want.row, got);
      used.add(got.sourceRow);
    }

  return { pairs, unused: rows.filter((row) => !used.has(row.sourceRow)) };
}

function keyRows(key: AnswerKey): KeyRow[] {
  return [
    ...key.import.map((row, index) => ({
      row: `import[${index}]`,
      date: row.date,
      time: row.time,
      amount: row.amount,
      expected: { import: row },
    })),
    ...key.skip.map((row, index) => ({
      row: `skip[${index}]`,
      date: row.date,
      time: row.time,
      amount: row.amount,
      expected: { skip: row.reason },
    })),
  ];
}

export function gradeRun(key: AnswerKey, extraction: Extraction, today: string): RunGrade {
  const rows = extraction.status === "ok" ? extraction.rows : [];
  const outcome = extraction.status;
  const kind = extraction.status === "ok" ? extraction.documentKind : extraction.status;

  // The harness has no stored payments, so the plan shows what this picture alone would save.
  const plan =
    extraction.status === "ok"
      ? planPaymentsImport(rows, [], {
          imageSeen: false,
          bank: extraction.documentKind === "bank_statement",
          today,
          shownTotal: extraction.shownTotal,
        })
      : null;

  const saved = new Map((plan?.toInsert ?? []).map((row) => [row.sourceRow, row]));
  const wanted = keyRows(key);
  const { pairs, unused } = pair(wanted, rows);

  const graded = wanted.map((want): RowGrade => {
    const got = pairs.get(want.row);
    const inSuccess = isInSuccess(want.expected);

    if (got === undefined) return { row: want.row, inSuccess, found: false, problems: [] };

    const { expected } = want;
    const stored = saved.get(got.sourceRow);

    const read: [Problem, boolean][] = [
      ["date", got.date !== want.date],
      ["time", got.time !== want.time],
      ["amount", got.amount !== want.amount],
      ["direction", inSuccess && got.direction !== "in"],
      ["status", inSuccess && got.status !== "success"],
    ];

    const planned: [Problem, boolean][] =
      "import" in expected
        ? [
            ["not_imported", stored === undefined],
            ["method", stored !== undefined && stored.method !== expected.import.method],
            ["reference", stored !== undefined && stored.sourceRef !== expected.import.reference],
          ]
        : [
            ["imported", stored !== undefined],
            ["reason", !READS_AS[expected.skip](got)],
          ];

    const problems = [...read, ...planned].flatMap(([problem, wrong]) => (wrong ? [problem] : []));

    return { row: want.row, inSuccess, found: true, problems };
  });

  const amounts = new Set(wanted.map((want) => want.amount));

  return {
    outcome,
    kindMatches: kind === key.documentKind,
    rows: graded,
    extra: unused.length,
    extraImported: unused.filter((row) => saved.has(row.sourceRow)).length,
    unknownAmounts: rows.filter((row) => !amounts.has(row.amount)).length,
  };
}

const AC_PROBLEMS = new Set<Problem>(AC_FIELDS);

export const acCorrect = (row: RowGrade) =>
  row.found && !row.problems.some((problem) => AC_PROBLEMS.has(problem));

export type ImageRuns = { name: string; runs: RunGrade[] };

// S9-AC1 as written: ≥ 3 real screenshots, K = 5 runs each, zero amounts that are not on the
// picture in every run, and ≥ 95% of money-in successful rows right on all five fields.
export const AC1 = { images: 3, runs: 5, rowShare: 0.95 };

export type Verdict = {
  status: "PASS" | "FAIL" | "INCOMPLETE";
  reasons: string[];
  rowShare: number;
  unknownAmounts: number;
};

export function verdict(images: ImageRuns[]): Verdict {
  const runs = images.flatMap((image) => image.runs);

  // A failed model call says nothing about accuracy; it only makes the run incomplete.
  const rows = runs
    .filter((run) => run.outcome !== "error")
    .flatMap((run) => run.rows)
    .filter((row) => row.inSuccess);

  const correct = rows.filter(acCorrect).length;
  const rowShare = rows.length === 0 ? 0 : correct / rows.length;
  const unknownAmounts = runs.reduce((sum, run) => sum + run.unknownAmounts, 0);
  const errored = runs.filter((run) => run.outcome === "error").length;
  const fewestRuns = Math.min(...images.map((image) => image.runs.length));

  const failures = [
    ...(unknownAmounts > 0 ? [`${unknownAmounts} amount(s) read that are not on the picture`] : []),
    ...(rows.length > 0 && rowShare < AC1.rowShare
      ? [`${correct}/${rows.length} money-in rows right, below ${AC1.rowShare * 100}%`]
      : []),
  ];

  const missing = [
    ...(images.length < AC1.images
      ? [`${images.length} screenshot(s) with an answer key, S9-AC1 needs ${AC1.images}`]
      : []),
    ...(images.length > 0 && fewestRuns < AC1.runs
      ? [`${fewestRuns} run(s) per screenshot, S9-AC1 needs ${AC1.runs}`]
      : []),
    ...(errored > 0 ? [`${errored} run(s) failed to call the model; run again`] : []),
    ...(rows.length === 0 ? ["no money-in rows in the answer keys"] : []),
  ];

  const status = failures.length > 0 ? "FAIL" : missing.length > 0 ? "INCOMPLETE" : "PASS";

  return { status, reasons: [...failures, ...missing], rowShare, unknownAmounts };
}

const RESULT_ONLY: Problem[] = [
  "direction",
  "status",
  "method",
  "not_imported",
  "imported",
  "reason",
];

// Counts and key row ids only, so the printout carries no amount or reference from the picture.
export function summarizeImage(all: RunGrade[]) {
  const runs = all.filter((run) => run.outcome !== "error");
  const rows = runs.flatMap((run) => run.rows);
  const count = (has: (row: RowGrade) => boolean) => rows.filter(has).length;

  const any = (row: RowGrade, problems: Problem[]) =>
    row.problems.some((problem) => problems.includes(problem));

  const issues = new Map<string, Map<string, number>>();

  for (const row of rows)
    for (const problem of row.found ? row.problems : ["missing"]) {
      const counts = issues.get(row.row) ?? new Map<string, number>();

      counts.set(problem, (counts.get(problem) ?? 0) + 1);
      issues.set(row.row, counts);
    }

  const sum = (field: "extra" | "extraImported" | "unknownAmounts") =>
    runs.reduce((total, run) => total + run[field], 0);

  return {
    runs: all.length,
    errors: all.length - runs.length,
    kindWrong: runs.filter((run) => !run.kindMatches).length,
    rows: rows.length,
    // References are graded apart, as in the synthetic probe: blur misreads them, not amounts.
    matched: count((row) => row.found && row.problems.every((problem) => problem === "reference")),
    missing: count((row) => !row.found),
    wrongAmount: count((row) => any(row, ["amount"])),
    wrongDate: count((row) => any(row, ["date", "time"])),
    other: count((row) => any(row, RESULT_ONLY)),
    referenceDiffers: count((row) => any(row, ["reference"])),
    extra: sum("extra"),
    extraImported: sum("extraImported"),
    unknownAmounts: sum("unknownAmounts"),
    issues: [...issues].map(
      ([row, counts]) =>
        `${row}: ${[...counts].map(([problem, times]) => `${problem} x${times}`).join(", ")}`,
    ),
  };
}
