import { ungroundedNumbers } from "../src/agent/postcheck";
import type { EvalCase, ToolCall } from "./cases";

const WHATSAPP_MAX_CHARS = 4096;

export type Turn = {
  user: string;
  reply: string;
  calls: ToolCall[];
  toolOutputs: unknown[];
};

export type Grade = { check: string; pass: boolean; detail?: string };

const matches = (want: ToolCall, got: ToolCall) =>
  want.name === got.name &&
  Object.entries(want.args).every(([key, value]) => got.args[key] === value);

function gradeTools(expect: EvalCase["expect"], calls: ToolCall[]): Grade[] {
  const grades: Grade[] = (expect.tools ?? []).map((want) => ({
    check: `tool ${want.name} ${JSON.stringify(want.args)}`,
    pass: calls.some((got) => matches(want, got)),
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
  return [
    { check: "no markdown table or heading", pass: !/^\s*\|.*\|\s*$|^#{1,6}\s/m.test(reply) },
    { check: `at most ${WHATSAPP_MAX_CHARS} chars`, pass: reply.length <= WHATSAPP_MAX_CHARS },
  ];
}

export function gradeConversation(
  testCase: EvalCase,
  turns: Turn[],
  facts: { value: string; near: RegExp }[],
  promptFacts: string[],
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
    ...gradeTools(expect, last.calls),
    ...gradeFacts(last.reply, facts),
    ...(expect.mustMatch ?? []).map((pattern) => ({
      check: `matches ${pattern}`,
      pass: pattern.test(last.reply),
    })),
    ...(expect.mustNotMatch ?? []).map((pattern) => ({
      check: `does not match ${pattern}`,
      pass: !pattern.test(last.reply),
    })),
    {
      check: "every number grounded",
      pass: ungrounded.length === 0,
      detail: ungrounded.map((number) => `${number.text} in "${number.sentence}"`).join("; "),
    },
    ...turns.flatMap((turn) => gradeFormat(turn.reply)),
  ];
}
