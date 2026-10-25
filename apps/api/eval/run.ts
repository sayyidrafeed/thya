// Eval layer c: runs EVAL_CASES through runTurn (the production turn, number check included) on
// NetraRuntime, k times each, and grades every trial in code. On demand only (decision Q4): `bun run eval [--k 3] [--only id,id]`.
// Exit 0 = PASS, 1 = BLOCKED (a required check failed), 2 = REVIEW (something did not run).
import { mkdir } from "node:fs/promises";
import { parseArgs } from "node:util";
import type { ModelMessage } from "ai";
import { promptFacts, runTurn, type TurnResult } from "../src/agent";
import { createSalesTools, queryMetricInputSchema } from "../src/agent/tools";
import { chatModel } from "../src/llm";
import { createDb } from "../src/db/client";
import { env } from "../src/env";
import { findDemoBusiness, type Business } from "../src/modules/business";
import type { SalesDataset } from "../src/sales/demo-shop";
import { loadSalesDataset } from "../src/sales/repository";
import type { ConceptEvent } from "../src/semantic/exposure";
import { EVAL_CASES, EVAL_NOW, toolCall, type EvalCase } from "./cases";
import { gradeConversation, type Grade, type Turn } from "./graders";

// Decision Q5: figures are held to pass^5, everything else to pass^3.
const TRIALS_BY_CATEGORY: Record<EvalCase["category"], number> = {
  numbers: 5,
  tool_choice: 3,
  guardrail: 3,
  education: 3,
};

const CONCURRENCY = 2;

type Trial = {
  id: string;
  trial: number;
  turns: Turn[];
  grades: Grade[];
  error: string | null;
  ms: number;
  inputTokens: number;
  cachedInputTokens: number;
  checks: TurnResult["check"][];
};

const { values: flags } = parseArgs({
  options: { k: { type: "string" }, only: { type: "string" } },
});

// The same seeded demo business and loader as /demo/chat (run `bun run db:seed` first).
const db = createDb(env.DATABASE_URL);
const found = await findDemoBusiness(db);

if (found === null) throw new Error("demo business is not seeded: run bun run db:seed");

const business: Business = found;

const dataset: SalesDataset = await loadSalesDataset(db, business.id, EVAL_NOW);

const only = flags.only?.split(",");
const selected = EVAL_CASES.filter((testCase) => !only || only.includes(testCase.id));

async function expectedFacts(testCase: EvalCase) {
  const { queryMetric } = createSalesTools(dataset, []);
  const options = { toolCallId: "eval", messages: [], context: {} };

  return Promise.all(
    (testCase.expect.facts ?? []).map(async ({ args, near }) => {
      const input = queryMetricInputSchema.parse({ userTerm: null, ...args });
      const output = await queryMetric.execute!(input, options);

      if (!("status" in output) || output.status !== "ok" || output.value === null)
        throw new Error(`${testCase.id}: expected figure has no value`);

      return { value: output.value, near };
    }),
  );
}

async function runTrial(testCase: EvalCase, trial: number): Promise<Trial> {
  const started = Date.now();
  const messages: ModelMessage[] = [];
  let conceptEvents: ConceptEvent[] = [];
  const turns: Turn[] = [];
  const checks: TurnResult["check"][] = [];
  let inputTokens = 0;
  let cachedInputTokens = 0;

  const result = (error: string | null, grades: Grade[]): Trial => ({
    id: testCase.id,
    trial,
    turns,
    grades,
    error,
    ms: Date.now() - started,
    inputTokens,
    cachedInputTokens,
    checks,
  });

  try {
    for (const user of testCase.turns) {
      messages.push({ role: "user", content: user });

      const turn = await runTurn({
        model: chatModel,
        business,
        dataset,
        messages: [...messages],
        conceptEvents,
        now: EVAL_NOW,
      });

      messages.push(...turn.responseMessages);
      conceptEvents = turn.conceptEvents;
      inputTokens += turn.usage.inputTokens;
      cachedInputTokens += turn.usage.cachedInputTokens;
      checks.push(turn.check);
      turns.push({
        user,
        reply: turn.reply,
        calls: turn.toolCalls.map((call) =>
          toolCall.parse({ name: call.toolName, args: call.input }),
        ),
        toolOutputs: turn.toolCalls.map((call) => call.output),
      });
    }

    const grades = gradeConversation(
      testCase,
      turns,
      await expectedFacts(testCase),
      promptFacts(business, EVAL_NOW),
    );

    return result(null, grades);
  } catch (error) {
    return result(error instanceof Error ? error.message : String(error), []);
  }
}

const passed = (trial: Trial) => trial.error === null && trial.grades.every((grade) => grade.pass);

function percentile(values: number[], fraction: number) {
  const sorted = values.toSorted((a, b) => a - b);

  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * fraction))] ?? 0;
}

const jobs = selected.flatMap((testCase) =>
  Array.from({ length: Number(flags.k ?? TRIALS_BY_CATEGORY[testCase.category]) }, (_, trial) => ({
    testCase,
    trial,
  })),
);

const trials: Trial[] = [];
const queue = [...jobs];

await Promise.all(
  Array.from({ length: CONCURRENCY }, async () => {
    for (let job = queue.shift(); job; job = queue.shift())
      trials.push(await runTrial(job.testCase, job.trial));
  }),
);

const runDir = new URL(`./runs/${new Date().toISOString().replaceAll(":", "-")}/`, import.meta.url);

await mkdir(runDir, { recursive: true });

const summary = selected.map((testCase) => {
  const own = trials.filter((trial) => trial.id === testCase.id);

  const failedChecks = [
    ...new Set(
      own.flatMap((trial) => [
        ...(trial.error ? [`error: ${trial.error}`] : []),
        ...trial.grades
          .filter((grade) => !grade.pass)
          .map((grade) => (grade.detail ? `${grade.check} (${grade.detail})` : grade.check)),
      ]),
    ),
  ];

  return {
    id: testCase.id,
    suite: testCase.suite,
    category: testCase.category,
    refs: testCase.refs,
    trials: own.length,
    passed: own.filter(passed).length,
    errored: own.filter((trial) => trial.error !== null).length,
    failedChecks,
  };
});

const regression = summary.filter((row) => row.suite === "regression");

// A real failure outranks an incomplete run. A run that ran nothing, or fewer trials than decision
// Q5 asks for (--k), can never pass.
const status = regression.some((row) => row.passed + row.errored < row.trials)
  ? "BLOCKED"
  : regression.length === 0 || flags.k !== undefined || regression.some((row) => row.errored > 0)
    ? "REVIEW"
    : "PASS";

const latencies = trials.map((trial) => trial.ms);
const inputTokens = trials.reduce((sum, trial) => sum + trial.inputTokens, 0);
const cached = trials.reduce((sum, trial) => sum + trial.cachedInputTokens, 0);

const totals = {
  status,
  cases: summary.length,
  passK: summary.filter((row) => row.passed === row.trials).length / summary.length,
  passPerTrial: trials.filter(passed).length / trials.length,
  p50Ms: percentile(latencies, 0.5),
  p95Ms: percentile(latencies, 0.95),
  inputTokens,
  cachedShare: inputTokens === 0 ? 0 : cached / inputTokens,
  now: EVAL_NOW.toISOString(),
  // How often decision Q2 had to step in: dropped sentence, regenerate, code template, apology.
  actions: Object.fromEntries(
    Map.groupBy(
      trials.flatMap((trial) => trial.checks),
      (check) => check.action,
    )
      .entries()
      .map(([action, list]) => [action, list.length]),
  ),
};

await Bun.write(
  new URL("transcripts.jsonl", runDir),
  trials.map((trial) => JSON.stringify(trial)).join("\n"),
);

await Bun.write(new URL("summary.json", runDir), JSON.stringify({ totals, summary }, null, 2));

for (const row of summary)
  console.log(
    `${row.passed === row.trials ? "ok  " : "FAIL"} ${row.id.padEnd(30)} ${row.passed}/${row.trials}  ${row.failedChecks.join(" | ").slice(0, 200)}`,
  );

console.log(
  `\n${status}: pass^k ${totals.passK.toFixed(2)}, per trial ${totals.passPerTrial.toFixed(2)}, ` +
    `p50 ${totals.p50Ms} ms, p95 ${totals.p95Ms} ms, cached ${(totals.cachedShare * 100).toFixed(0)}% of ${inputTokens} input tokens, ` +
    `number check ${JSON.stringify(totals.actions)}`,
);

console.log(`Transcripts: ${runDir.pathname}`);

await db.$client.end();

process.exit(status === "PASS" ? 0 : status === "BLOCKED" ? 1 : 2);
