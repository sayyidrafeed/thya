import { z } from "zod";

// Every case runs on the Kopi Senja seed at this instant, so expected figures never drift.
export const EVAL_NOW = new Date("2026-10-25T14:00:00+07:00");

export const toolCall = z.object({ name: z.string(), args: z.record(z.string(), z.unknown()) });

export type ToolCall = z.infer<typeof toolCall>;

// A tool the case needs, by exact name or by pattern: capability cases name tools still being
// built (write, schedule, chart), so their final names can change without editing every case.
const wantedTool = z.object({
  name: z.union([z.string(), z.instanceof(RegExp)]),
  args: z.record(z.string(), z.unknown()),
});

// A figure the reply must quote: run queryMetric with `args` against the seed and require the
// chosen field on a line that also matches `near` (the metric word), not anywhere in the reply.
const fact = z.object({
  args: z.record(z.string(), z.unknown()),
  field: z.enum(["value", "previous", "change"]).default("value"),
  near: z.instanceof(RegExp),
});

export const CATEGORIES = [
  "numbers",
  "tool_choice",
  "write_confirm",
  "onboarding",
  "guardrail",
  "education",
  "tone",
] as const;

const evalCase = z.object({
  id: z.string(),
  // Rules and eval ids the case comes from (E# from semantic-education, S# from business-features).
  refs: z.array(z.string()),
  // regression = the feature runs today and a failure blocks a release; capability = not built
  // yet or not stable, recorded only (decision Q5).
  suite: z.enum(["regression", "capability"]),
  category: z.enum(CATEGORIES),
  turns: z.array(z.string()).min(1),
  expect: z.object({
    // Graded on the last turn.
    tools: z.array(wantedTool).optional(),
    anyTool: z.array(wantedTool).optional(),
    noTools: z.boolean().optional(),
    facts: z.array(fact).optional(),
    mustMatch: z.array(z.instanceof(RegExp)).optional(),
    mustNotMatch: z.array(z.instanceof(RegExp)).optional(),
    maxLines: z.number().int().positive().optional(),
    // G4 state: how many drafts were executed by the end of the conversation.
    saved: z.number().int().nonnegative().optional(),
    // Graded on every turn: tool names that must never run in this conversation.
    forbiddenTools: z.array(z.instanceof(RegExp)).optional(),
    // Graded on every turn but the last: e.g. no confirm before the owner said "ya".
    forbiddenBeforeLast: z.array(z.instanceof(RegExp)).optional(),
    // Advisory LLM judge (Q10, Claude in Claude Code); listed in report.md, never a gate.
    judge: z.literal("tone").optional(),
  }),
});

export type EvalCase = z.infer<typeof evalCase>;

export type EvalCaseInput = z.input<typeof evalCase>;

export const parseCases = (cases: EvalCaseInput[]) => z.array(evalCase).parse(cases);

const noDates = { startDate: null, endDate: null };

export const metric = (
  name: string,
  period: string,
  dates: { startDate: string | null; endDate: string | null } = noDates,
) => ({
  name: "queryMetric" as const,
  args: { metric: name, period, ...dates },
});

// Patterns for tools the engine is still building (engine-plan §6 1–5 Nov, business-features §5).
export const WRITE_TOOL = /^(draft|record|catat)/i;
export const CONFIRM_TOOL = /confirm/i;
export const MENU_COST_TOOL = /menucost|recipe/i;
export const SCHEDULE_TOOL = /schedule/i;
export const CHART_TOOL = /chart/i;
export const ANY_WRITE = /draft|record|confirm|set[A-Z]|create|send|append|import|schedule/;
