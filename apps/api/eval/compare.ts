// U2 + U8: compare a candidate run with a baseline, per case by pass proportion (never trial 1 vs
// trial 1, engine-plan §5.3). `bun eval/compare.ts <baseline> <candidate>`; each argument is a run
// directory or its summary.json. Default baseline: eval/baseline.json. Exit 0 PASS, 1 BLOCKED, 2 REVIEW.
import { z } from "zod";

const summaryRow = z.object({
  id: z.string(),
  suite: z.enum(["regression", "capability"]),
  category: z.string(),
  trials: z.number(),
  passed: z.number(),
  errored: z.number(),
  failedChecks: z.array(z.string()),
});

export const runSummary = z.object({
  totals: z.object({ status: z.string(), actions: z.record(z.string(), z.number()) }).loose(),
  summary: z.array(summaryRow),
});

export type RunSummary = z.infer<typeof runSummary>;

// τ-bench estimator of pass^k from c passes in n trials: C(c, k) / C(n, k).
export function passHat(trials: number, passed: number, k: number): number {
  if (trials < k) return Number.NaN;

  let estimate = 1;

  for (let index = 0; index < k; index += 1) estimate *= (passed - index) / (trials - index);

  return Math.max(0, estimate);
}

// Share of turns where the Q2 number check had to step in (dropped, regenerated, template, apology).
export function interventionRate(actions: Record<string, number>): number {
  const turns = Object.values(actions).reduce((sum, count) => sum + count, 0);

  return turns === 0 ? 0 : (turns - (actions.none ?? 0)) / turns;
}

export type CaseDelta = {
  id: string;
  suite: "regression" | "capability";
  before: string;
  after: string;
  change: "dropped" | "improved" | "same" | "new" | "missing";
};

export function compareRuns(baseline: RunSummary, candidate: RunSummary) {
  const before = new Map(baseline.summary.map((row) => [row.id, row]));
  const after = new Map(candidate.summary.map((row) => [row.id, row]));
  const rate = (row: { trials: number; passed: number }) => row.passed / row.trials;

  const label = (row?: { trials: number; passed: number }) =>
    row ? `${row.passed}/${row.trials}` : "-";

  const cases: CaseDelta[] = [...new Set([...before.keys(), ...after.keys()])].map((id) => {
    const old = before.get(id);
    const now = after.get(id);
    const suite = (now ?? old)!.suite;

    const change =
      old === undefined
        ? "new"
        : now === undefined
          ? "missing"
          : rate(now) < rate(old)
            ? "dropped"
            : rate(now) > rate(old)
              ? "improved"
              : "same";

    return { id, suite, before: label(old), after: label(now), change };
  });

  const interventions = {
    before: interventionRate(baseline.totals.actions),
    after: interventionRate(candidate.totals.actions),
  };

  const regression = cases.filter((row) => row.suite === "regression");

  // A regression case that passes less often blocks. A missing regression case or more Q2
  // interventions (U8: more made-up numbers caught, even if every reply ends clean) needs review.
  const status = regression.some((row) => row.change === "dropped")
    ? "BLOCKED"
    : regression.some((row) => row.change === "missing") ||
        interventions.after > interventions.before
      ? "REVIEW"
      : "PASS";

  return { status, cases, interventions } as const;
}

async function readSummary(path: string): Promise<RunSummary> {
  const file = path.endsWith(".json") ? path : `${path.replace(/\/$/, "")}/summary.json`;

  return runSummary.parse(await Bun.file(file).json());
}

if (import.meta.main) {
  const args = process.argv.slice(2);

  const [baselinePath, candidatePath] =
    args.length === 1 ? [new URL("./baseline.json", import.meta.url).pathname, args[0]] : args;

  if (baselinePath === undefined || candidatePath === undefined) {
    console.error("usage: bun eval/compare.ts [baseline] <candidate>");
    process.exit(2);
  }

  const result = compareRuns(await readSummary(baselinePath), await readSummary(candidatePath));
  const order = ["dropped", "missing", "improved", "new", "same"];

  for (const row of result.cases.toSorted(
    (a, b) => order.indexOf(a.change) - order.indexOf(b.change),
  ))
    if (row.change !== "same")
      console.log(
        `${row.change.padEnd(8)} ${row.suite.padEnd(10)} ${row.id.padEnd(34)} ${row.before} -> ${row.after}`,
      );

  const percent = (value: number) => `${(value * 100).toFixed(1)}%`;

  console.log(
    `\n${result.status}: ${result.cases.filter((row) => row.change === "same").length} unchanged, ` +
      `Q2 interventions ${percent(result.interventions.before)} -> ${percent(result.interventions.after)} of turns`,
  );

  process.exit(result.status === "PASS" ? 0 : result.status === "BLOCKED" ? 1 : 2);
}
