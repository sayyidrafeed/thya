// Checks that NetraRuntime supports tool calling through the AI SDK:
// one tool, multi-step loop, and a final answer that uses the tool result.
// Run: bun run verify:netra (from apps/api). Exits 1 when no tool call happens.
import { generateText, isStepCount, tool } from "ai";
import { z } from "zod";
import { env } from "../src/env";
import { chatModel } from "../src/llm";

const prices = new Map([
  ["es kopi susu", 18_000],
  ["americano", 15_000],
]);

const result = await generateText({
  model: chatModel,
  instructions: "Kamu asisten kedai kopi. Selalu pakai tool untuk mengecek harga menu.",
  prompt: "Berapa harga es kopi susu?",
  tools: {
    getMenuPrice: tool({
      description: "Ambil harga jual satu menu dalam Rupiah",
      inputSchema: z.object({ menuName: z.string().describe("Nama menu, huruf kecil") }),
      execute: async ({ menuName }) => ({
        menuName,
        price: prices.get(menuName.toLowerCase()) ?? null,
      }),
    }),
  },
  stopWhen: isStepCount(3),
});

console.log(`model: ${env.NETRA_MODEL}`);

for (const [index, step] of result.steps.entries()) {
  console.log(`step ${index + 1}: finishReason=${step.finishReason}`);

  for (const call of step.toolCalls)
    console.log(`  tool call: ${call.toolName} ${JSON.stringify(call.input)}`);

  for (const toolResult of step.toolResults)
    console.log(`  tool result: ${JSON.stringify(toolResult.output)}`);
}

console.log(`final text: ${result.text}`);

const toolCalled = result.steps.some((step) => step.toolCalls.length > 0);
const answered = result.text.trim().length > 0;

console.log(
  toolCalled && answered ? "OK: tool calling works" : "FAIL: no tool call or no final answer",
);

process.exit(toolCalled && answered ? 0 : 1);
