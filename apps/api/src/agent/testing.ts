import { MockLanguageModelV4 } from "ai/test";

// Test helpers: a model that plays back a fixed script of tool calls and texts, one per step.

const usage = {
  inputTokens: { total: 10, noCache: 10, cacheRead: 0, cacheWrite: 0 },
  outputTokens: { total: 5, text: 5, reasoning: 0 },
};

export type ToolStep = { tool: string; input: object };

// `parallel`: several tool calls in one step, which the SDK runs at the same time.
export type ScriptStep = ToolStep | { parallel: ToolStep[] } | { text: string };

export function scriptedModel(steps: ScriptStep[]) {
  return new MockLanguageModelV4({
    doGenerate: steps.map((step, index) =>
      "text" in step
        ? {
            content: [{ type: "text" as const, text: step.text }],
            finishReason: { unified: "stop" as const, raw: "stop" },
            usage,
            warnings: [],
          }
        : {
            content: ("parallel" in step ? step.parallel : [step]).map((call, order) => ({
              type: "tool-call" as const,
              toolCallId: `call-${index}${"parallel" in step ? `-${order}` : ""}`,
              toolName: call.tool,
              input: JSON.stringify(call.input),
            })),
            finishReason: { unified: "tool-calls" as const, raw: "tool_calls" },
            usage,
            warnings: [],
          },
    ),
  });
}
