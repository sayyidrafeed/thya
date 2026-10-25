import { generateText, isStepCount, type LanguageModel, type ModelMessage } from "ai";
import type { BusinessProfile } from "../modules/business";
import type { SalesDataset } from "../sales/demo-shop";
import type { ConceptEvent } from "../semantic/exposure";
import { ungroundedNumbers, type UngroundedNumber } from "./postcheck";
import { buildInstructions, promptFacts, renderTurnContext, withTurnContext } from "./prompt";
import { fallbackReply } from "./fallback";
import { createSalesTools, type SalesToolName } from "./tools";

export const MAX_STEPS = 5;

// Below the WhatsApp typing indicator's 25 s plus one regenerate; a stuck call never holds the turn.
const TURN_TIMEOUT_MS = 40_000;

// Decision Q7: rounds (steps that call the tool), not individual calls.
const TOOL_ROUND_LIMITS = new Map<SalesToolName, number>([["queryMetric", 4]]);

export type Attachment = {
  id: string;
  kind: "chart" | "summary_card";
  mime: "image/png";
  bytes: number;
};

export type TurnToolCall = {
  toolCallId: string;
  toolName: string;
  input: unknown;
  output: unknown;
};

export type TurnAction = "none" | "dropped" | "regenerated" | "template" | "apology";

export type TurnInput = {
  // Passed in rather than imported so tests run without NetraRuntime credentials.
  model: LanguageModel;
  business: BusinessProfile;
  dataset: SalesDataset;
  // Stored history plus the owner's new message(s) at the end, without any clock.
  messages: ModelMessage[];
  conceptEvents: ConceptEvent[];
  now: Date;
  abortSignal?: AbortSignal;
};

export type TurnResult = {
  reply: string;
  // What to persist: the chosen attempt's messages, with the final text replaced by `reply`.
  responseMessages: ModelMessage[];
  toolCalls: TurnToolCall[];
  attachments: Attachment[];
  conceptEvents: ConceptEvent[];
  check: { action: TurnAction; ungrounded: UngroundedNumber[]; attempts: number };
  usage: { inputTokens: number; cachedInputTokens: number; outputTokens: number };
};

type Attempt = {
  text: string;
  toolCalls: TurnToolCall[];
  responseMessages: ModelMessage[];
  conceptEvents: ConceptEvent[];
  usage: TurnResult["usage"];
};

async function attempt(
  input: TurnInput,
  abortSignal: AbortSignal,
  { feedback, requireTool }: { feedback: string | null; requireTool: boolean },
): Promise<Attempt> {
  const conceptEvents = [...input.conceptEvents];
  const rounds = new Map<string, number>();

  const tools = createSalesTools(input.dataset, conceptEvents, {
    exhausted: (name) => (rounds.get(name) ?? 0) >= (TOOL_ROUND_LIMITS.get(name) ?? Infinity),
  });

  const result = await generateText({
    model: input.model,
    instructions: buildInstructions(input.business) + (feedback ? `\n\n${feedback}` : ""),
    messages: withTurnContext(input.messages, renderTurnContext(input.now)),
    tools,
    stopWhen: isStepCount(MAX_STEPS),
    maxRetries: 1,
    abortSignal,
    prepareStep: ({ steps, stepNumber }) => {
      rounds.clear();

      for (const step of steps)
        for (const name of new Set(step.toolCalls.map((call) => call.toolName)))
          rounds.set(name, (rounds.get(name) ?? 0) + 1);

      return requireTool && stepNumber === 0 ? { toolChoice: "required" } : undefined;
    },
  });

  const outputs = new Map(
    result.steps.flatMap((step) => step.toolResults).map((done) => [done.toolCallId, done.output]),
  );

  return {
    text: result.text.trim(),
    toolCalls: result.steps
      .flatMap((step) => step.toolCalls)
      .map(({ toolCallId, toolName, input: args }) => ({
        toolCallId,
        toolName,
        input: args,
        output: outputs.get(toolCallId),
      })),
    responseMessages: result.responseMessages,
    conceptEvents,
    usage: {
      inputTokens: result.totalUsage.inputTokens ?? 0,
      cachedInputTokens: result.totalUsage.inputTokenDetails?.cacheReadTokens ?? 0,
      outputTokens: result.totalUsage.outputTokens ?? 0,
    },
  };
}

function evidenceFor(input: TurnInput, { toolCalls }: Attempt): string[] {
  return [
    ...promptFacts(input.business, input.now),
    JSON.stringify(input.messages),
    ...toolCalls.map((call) => JSON.stringify([call.input, call.output])),
  ];
}

// Decision Q2a: a made-up number only in the closing paragraph (a suggestion) costs that sentence,
// not the whole answer. Returns null when the main answer itself is affected.
function dropClosingSentences(reply: string, ungrounded: UngroundedNumber[]): string | null {
  const paragraphs = reply.split(/\n\s*\n/);
  const closing = paragraphs.at(-1);

  if (paragraphs.length < 2 || closing === undefined) return null;

  const main = paragraphs.slice(0, -1).join("\n\n");

  // A sentence that also sits in the main answer cannot be dropped from the closing alone.
  if (!ungrounded.every(({ sentence }) => closing.includes(sentence) && !main.includes(sentence)))
    return null;

  const trimmed = ungrounded
    .reduce((rest, { sentence }) => rest.replace(sentence, ""), closing)
    .replace(/\s{2,}/g, " ")
    .trim();

  return [...paragraphs.slice(0, -1), ...(trimmed ? [trimmed] : [])].join("\n\n").trim();
}

// The text the owner sees replaces the model's last text, so history matches what was sent.
function withReply(messages: ModelMessage[], reply: string): ModelMessage[] {
  const lastAssistant = messages.findLastIndex((message) => message.role === "assistant");

  const kept = messages.flatMap((message, index): ModelMessage[] => {
    if (index !== lastAssistant || message.role !== "assistant") return [message];

    // Only tool calls stay: their results follow this message. Old text and reasoning go.
    const parts = Array.isArray(message.content)
      ? message.content.filter((part) => part.type === "tool-call")
      : [];

    return parts.length > 0 ? [{ ...message, content: parts }] : [];
  });

  return [...kept, { role: "assistant", content: reply }];
}

function sumUsage(attempts: Attempt[]): TurnResult["usage"] {
  return attempts.reduce(
    (total, { usage }) => ({
      inputTokens: total.inputTokens + usage.inputTokens,
      cachedInputTokens: total.cachedInputTokens + usage.cachedInputTokens,
      outputTokens: total.outputTokens + usage.outputTokens,
    }),
    { inputTokens: 0, cachedInputTokens: 0, outputTokens: 0 },
  );
}

function grounded(input: TurnInput, chosen: Attempt) {
  const ungrounded = ungroundedNumbers(chosen.text, evidenceFor(input, chosen));

  if (ungrounded.length === 0 && chosen.text) return { reply: chosen.text, ungrounded };

  const dropped = ungrounded.length > 0 ? dropClosingSentences(chosen.text, ungrounded) : null;

  return { reply: dropped, ungrounded };
}

export async function runTurn(input: TurnInput): Promise<TurnResult> {
  const abortSignal = AbortSignal.any([
    AbortSignal.timeout(TURN_TIMEOUT_MS),
    ...(input.abortSignal ? [input.abortSignal] : []),
  ]);

  const attempts: Attempt[] = [];

  function finish(
    chosen: Attempt,
    reply: string,
    action: TurnAction,
    ungrounded: UngroundedNumber[],
  ) {
    return {
      reply,
      responseMessages: withReply(chosen.responseMessages, reply),
      toolCalls: chosen.toolCalls,
      attachments: [],
      conceptEvents: chosen.conceptEvents,
      check: { action, ungrounded, attempts: tries },
      usage: sumUsage(attempts),
    };
  }

  let tries = 1;
  const first = await attempt(input, abortSignal, { feedback: null, requireTool: false });
  attempts.push(first);
  const firstCheck = grounded(input, first);

  if (firstCheck.ungrounded.length === 0 && firstCheck.reply)
    return finish(first, firstCheck.reply, "none", []);

  if (firstCheck.reply) return finish(first, firstCheck.reply, "dropped", firstCheck.ungrounded);

  // An empty answer means the step limit ran out; only a made-up number earns a second try.
  if (firstCheck.ungrounded.length > 0) {
    const listed = firstCheck.ungrounded.map(({ text }) => text).join(", ");
    tries += 1;

    let second: Attempt | null = null;

    try {
      second = await attempt(input, abortSignal, {
        feedback: `Catatan sistem: jawaban sebelumnya memuat angka yang tidak ada di hasil tool (${listed}). Tulis ulang jawabannya dan pakai hanya angka dari hasil tool. Jangan menghitung sendiri.`,
        requireTool: first.toolCalls.length === 0,
      });
    } catch {
      // Any failed retry (provider error, timeout, an ignored required tool call) falls back to
      // the first attempt's tool results: the owner never sees a technical error (Q2).
    }

    if (second) attempts.push(second);

    const secondCheck = second ? grounded(input, second) : { reply: null, ungrounded: [] };

    if (second && secondCheck.reply)
      return finish(
        second,
        secondCheck.reply,
        secondCheck.ungrounded.length === 0 ? "regenerated" : "dropped",
        firstCheck.ungrounded,
      );
  }

  const withTools = attempts.findLast((candidate) => candidate.toolCalls.length > 0) ?? first;
  const fallback = fallbackReply(withTools.toolCalls);

  return finish(withTools, fallback.reply, fallback.action, firstCheck.ungrounded);
}
