import { MockLanguageModelV4 } from "ai/test";

// Test helpers: a model that plays back a fixed script of tool calls and texts, one per step.

const usage = {
  inputTokens: { total: 10, noCache: 10, cacheRead: 0, cacheWrite: 0 },
  outputTokens: { total: 5, text: 5, reasoning: 0 },
};

export type ScriptStep = { tool: string; input: object } | { text: string };

export function scriptedModel(steps: ScriptStep[]) {
  return new MockLanguageModelV4({
    doGenerate: steps.map((step, index) =>
      "tool" in step
        ? {
            content: [
              {
                type: "tool-call" as const,
                toolCallId: `call-${index}`,
                toolName: step.tool,
                input: JSON.stringify(step.input),
              },
            ],
            finishReason: { unified: "tool-calls" as const, raw: "tool_calls" },
            usage,
            warnings: [],
          }
        : {
            content: [{ type: "text" as const, text: step.text }],
            finishReason: { unified: "stop" as const, raw: "stop" },
            usage,
            warnings: [],
          },
    ),
  });
}
