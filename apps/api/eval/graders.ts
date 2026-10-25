import { ungroundedNumbers } from "../src/agent/postcheck";
import type { EvalCase, ToolCall } from "./cases";

const WHATSAPP_MAX_CHARS = 4096;

// G5 heuristic: common English words that should never appear in an Indonesian reply.
const ENGLISH_WORDS = /\b(the|you|your|please|revenue|profit|sales|today|week|month)\b/i;

export type Turn = {
  user: string;
  reply: string;
  calls: ToolCall[];
  toolOutputs: unknown[];
};

export type Grade = { check: string; pass: boolean; detail?: string };

type WantedTool = NonNullable<EvalCase["expect"]["tools"]>[number];

const nameMatches = (want: WantedTool["name"], got: string) =>
  want instanceof RegExp ? want.test(got) : want === got;

const matches = (want: WantedTool, got: ToolCall) =>
  nameMatches(want.name, got.name) &&
  Object.entries(want.args).every(([key, value]) => got.args[key] === value);

function gradeTools(expect: EvalCase["expect"], turns: Turn[]): Grade[] {
  const calls = turns.at(-1)?.calls ?? [];
  const earlier = turns.slice(0, -1).flatMap((turn) => turn.calls);
  const all = turns.flatMap((turn) => turn.calls);

  const grades: Grade[] = (expect.tools ?? []).map((want) => ({
    check: `tool ${want.name} ${JSON.stringify(want.args)}`,
    pass: calls.some((got) => matches(want, got)),
    detail: calls.map((call) => `${call.name} ${JSON.stringify(call.args)}`).join("; "),
  }));

  if (expect.anyTool)
    grades.push({
      check: `any of ${expect.anyTool.map((want) => want.name).join(", ")}`,
      pass: expect.anyTool.some((want) => calls.some((got) => matches(want, got))),
    });

  if (expect.noTools)
    grades.push({
      check: "no tools",
      pass: calls.length === 0,
      detail: calls.map((call) => call.name).join(", "),
    });

  for (const pattern of expect.forbiddenTools ?? [])
    grades.push({
      check: `never ${pattern}`,
      pass: !all.some((call) => pattern.test(call.name)),
      detail: all.map((call) => call.name).join(", "),
    });

  for (const pattern of expect.forbiddenBeforeLast ?? [])
    grades.push({
      check: `not before last turn ${pattern}`,
      pass: !earlier.some((call) => pattern.test(call.name)),
    });

  return grades;
}

// A figure counts only on a line that names its metric, so a right number under the wrong label fails.
function gradeFacts(reply: string, facts: { value: string; near: RegExp }[]): Grade[] {
  const lines = reply.split("\n");

  return facts.map(({ value, near }) => ({
    check: `fact ${value} near ${near}`,
    pass: lines.some((line) => line.includes(value) && near.test(line)),
  }));
}

function gradeFormat(reply: string): Grade[] {
  const english = reply.match(ENGLISH_WORDS);

  return [
    { check: "no markdown table or heading", pass: !/^\s*\|.*\|\s*$|^#{1,6}\s/m.test(reply) },
    { check: `at most ${WHATSAPP_MAX_CHARS} chars`, pass: reply.length <= WHATSAPP_MAX_CHARS },
    { check: "no English words", pass: english === null, detail: english?.[0] },
  ];
}

const lineCount = (reply: string) => reply.split("\n").filter((line) => line.trim()).length;

export function gradeConversation(
  testCase: EvalCase,
  turns: Turn[],
  facts: { value: string; near: RegExp }[],
  promptFacts: string[],
  saved: number,
): Grade[] {
  const last = turns.at(-1);

  if (last === undefined) return [{ check: "conversation ran", pass: false }];

  const { expect } = testCase;

  const evidence = [
    ...promptFacts,
    ...turns.flatMap((turn) => [
      turn.user,
      ...turn.calls.map((call) => JSON.stringify(call.args)),
      ...turn.toolOutputs.map((output) => JSON.stringify(output)),
    ]),
  ];

  const ungrounded = turns.flatMap((turn) => ungroundedNumbers(turn.reply, evidence));

  return [
    ...gradeTools(expect, turns),
    ...gradeFacts(last.reply, facts),
    ...(expect.mustMatch ?? []).map((pattern) => ({
      check: `matches ${pattern}`,
      pass: pattern.test(last.reply),
    })),
    ...(expect.mustNotMatch ?? []).map((pattern) => ({
      check: `does not match ${pattern}`,
      pass: !pattern.test(last.reply),
    })),
    ...(expect.maxLines === undefined
      ? []
      : [
          {
            check: `at most ${expect.maxLines} lines`,
            pass: lineCount(last.reply) <= expect.maxLines,
            detail: String(lineCount(last.reply)),
          },
        ]),
    ...(expect.saved === undefined
      ? []
      : [
          {
            check: `${expect.saved} draft(s) saved`,
            pass: saved === expect.saved,
            detail: String(saved),
          },
        ]),
    {
      check: "every number grounded",
      pass: ungrounded.length === 0,
      detail: ungrounded.map((number) => `${number.text} in "${number.sentence}"`).join("; "),
    },
    ...turns.flatMap((turn) => gradeFormat(turn.reply)),
  ];
}
