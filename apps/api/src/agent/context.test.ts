import { expect, test } from "bun:test";
import type { ModelMessage } from "ai";
import { repairHistory } from "./context";

const call = (toolCallId: string): ModelMessage => ({
  role: "assistant",
  content: [{ type: "tool-call", toolCallId, toolName: "queryMetric", input: {} }],
});

const result = (toolCallId: string): ModelMessage => ({
  role: "tool",
  content: [
    {
      type: "tool-result",
      toolCallId,
      toolName: "queryMetric",
      output: { type: "json", value: { status: "ok" } },
    },
  ],
});

test("a complete history passes through unchanged", () => {
  const history: ModelMessage[] = [
    { role: "user", content: "omzet?" },
    call("a"),
    result("a"),
    { role: "assistant", content: "Omzet Rp1.000." },
  ];

  expect(repairHistory(history)).toEqual(history);
});

test("a call cut off before its result gets an interrupted result before the next message", () => {
  const repaired = repairHistory([
    { role: "user", content: "omzet?" },
    call("a"),
    { role: "user", content: "halo?" },
  ]);

  expect(repaired.map((message) => message.role)).toEqual(["user", "assistant", "tool", "user"]);
  expect(JSON.stringify(repaired[2])).toContain("Langkah ini terputus");
});

test("a result whose call is missing is dropped", () => {
  const repaired = repairHistory([
    { role: "user", content: "omzet?" },
    result("ghost"),
    { role: "assistant", content: "Siap." },
  ]);

  expect(repaired.map((message) => message.role)).toEqual(["user", "assistant"]);
});

test("a trailing open call is closed too", () => {
  const repaired = repairHistory([{ role: "user", content: "omzet?" }, call("a")]);

  expect(repaired.at(-1)?.role).toBe("tool");
});
