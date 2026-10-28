import { generateText, isStepCount, type LanguageModel, type ModelMessage } from "ai";
import { z } from "zod";
import type { DraftOutcome, DraftPort } from "../actions/kinds";
import type { BusinessProfile } from "../modules/business";
import type { SheetPort } from "../modules/sheets";
import type { SalesDataset } from "../sales/demo-shop";
import type { ConceptEvent } from "../semantic/exposure";
import { saveClaims, ungroundedNumbers, type UngroundedNumber } from "./postcheck";
import {
  buildInstructions,
  promptFacts,
  renderMemory,
  renderTurnContext,
  withTurnContext,
  type TurnMemory,
} from "./prompt";
import { fallbackReply } from "./fallback";
import { createSalesTools, SALES_TOOL_NAMES, type SalesToolName } from "./tools";
import { createWriteTools, draftDecisionSchema, type WriteToolName } from "./write-tools";
import { createSheetTools, sheetAccessReply, type SheetToolName } from "./sheet-tools";
import { createChartTool, type Attachment, type AttachmentPort } from "./chart-tool";

export const MAX_STEPS = 5;

// Below the WhatsApp typing indicator's 25 s plus one regenerate; a stuck call never holds the turn.
const TURN_TIMEOUT_MS = 40_000;

// Decision Q7: rounds (steps that call the tool), not individual calls.
const TOOL_ROUND_LIMITS = new Map<SalesToolName, number>([["queryMetric", 3]]);

export type { Attachment, AttachmentPort } from "./chart-tool";

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
  // Channel formatting applied to the final reply (WhatsApp markup, decision U4).
  formatReply?: (reply: string) => string;
  // Where write tools put drafts. Without it they answer that recording is not available here.
  drafts?: DraftPort;
  // Where showChart stores its picture. Without it the tool still answers with the points.
  attachments?: AttachmentPort;
  // Profile block and rolling summary (B2, B1). Without it the prompt is the static rules only.
  memory?: TurnMemory;
  // DELIVERY_IMPORT_ENABLED, so compareChannels only asks for screenshots Thya can read.
  deliveryImport?: boolean;
  // This business's Google Sheets (S5, S6). Without it the sheet tools are not offered (U10).
  sheets?: SheetPort;
};

// The draft a write tool prepared this turn; the channel shows it as a card with Ya/Ubah/Batal.
export type TurnDraft = { draftId: string; summary: string };

export type TurnResult = {
  reply: string;
  // What to persist: the chosen attempt's messages, with the final text replaced by `reply`.
  responseMessages: ModelMessage[];
  toolCalls: TurnToolCall[];
  attachments: Attachment[];
  conceptEvents: ConceptEvent[];
  check: { action: TurnAction; ungrounded: UngroundedNumber[]; attempts: number };
  draft: TurnDraft | null;
  // Short answers the owner can tap instead of typing, from the last tool call (an ambiguous hour).
  choices: string[] | null;
  // Decision U1: SHA-256 of the system prompt plus every tool's name, description and input schema.
  promptHash: string;
  usage: { inputTokens: number; cachedInputTokens: number; outputTokens: number };
};

type Attempt = {
  text: string;
  attachments: Attachment[];
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
  const attachments: Attachment[] = [];
  const rounds = new Map<string, number>();

  const sheets = input.sheets
    ? createSheetTools(input.dataset, input.sheets, input.drafts ?? null)
    : null;

  const tools = {
    ...createSalesTools(
      input.dataset,
      conceptEvents,
      {
        exhausted: (name) => (rounds.get(name) ?? 0) >= (TOOL_ROUND_LIMITS.get(name) ?? Infinity),
      },
      input.deliveryImport ?? false,
    ),
    ...createWriteTools(input.dataset, sheets ? sheets.drafts : (input.drafts ?? null)),
    ...createChartTool(input.dataset, input.attachments ?? null, attachments),
    ...sheets?.tools,
  };

  const result = await generateText({
    model: input.model,
    instructions: [
      buildInstructions(input.business),
      ...(input.memory ? [renderMemory(input.memory)] : []),
      ...(feedback ? [feedback] : []),
    ].join("\n\n"),
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

      // Read tools only: a step that must call something may never draft or confirm a draft.
      return requireTool && stepNumber === 0
        ? { toolChoice: "required", activeTools: SALES_TOOL_NAMES }
        : undefined;
    },
  });

  const outputs = new Map(
    result.steps.flatMap((step) => step.toolResults).map((done) => [done.toolCallId, done.output]),
  );

  return {
    text: result.text.trim(),
    attachments,
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
    // Prices and costs in the profile block come from tables, so a reply may repeat them.
    ...(input.memory?.profile ? [input.memory.profile] : []),
    JSON.stringify(input.messages.filter((message) => message.role !== "user")),
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
  const ungrounded = ungroundedNumbers(chosen.text, evidenceFor(input, chosen), [
    JSON.stringify(input.messages.filter((message) => message.role === "user")),
  ]);

  if (ungrounded.length === 0 && chosen.text) return { reply: chosen.text, ungrounded };

  const dropped = ungrounded.length > 0 ? dropClosingSentences(chosen.text, ungrounded) : null;

  return { reply: dropped, ungrounded };
}

const DRAFT_TOOLS = new Set<string>([
  "recordSales",
  "setMenuCost",
  "setChannelCommission",
  "createSchedule",
  "cancelSchedule",
  "appendDailySales",
  "importSalesFromSheet",
] satisfies (WriteToolName | SheetToolName)[]);

// Saved now, or by an earlier "ya" when no attempt drafted anything new; a cancel never counts.
function saveReported(attempts: Attempt[]): boolean {
  const calls = attempts.flatMap(({ toolCalls }) => toolCalls);

  const outcomes = calls.flatMap((call): DraftOutcome["status"][] => {
    const decision = draftDecisionSchema.safeParse(call.output);

    return call.toolName === "confirmDraft" && decision.success ? [decision.data.outcome] : [];
  });

  if (outcomes.includes("done")) return true;

  return (
    outcomes.includes("already_done") && !calls.some(({ toolName }) => DRAFT_TOOLS.has(toolName))
  );
}

type Found = { ungrounded: UngroundedNumber[]; claims: string[] };

function checkReply(
  input: TurnInput,
  chosen: Attempt,
  saved: boolean,
): Found & { reply: string | null } {
  const { reply, ungrounded } = grounded(input, chosen);
  const claims = saved ? [] : saveClaims(reply ?? chosen.text);

  return { reply: claims.length > 0 ? null : reply, ungrounded, claims };
}

// confirmDraft only on the owner's own yes: an open draft must never be saved to make a claim true.
const CLAIM_FEEDBACK =
  "Catatan sistem: jawaban sebelumnya bilang sesuatu sudah dicatat atau tersimpan, padahal di pesan ini tidak ada hasil confirmDraft yang menyatakannya. Kalau pesan terakhir Kakak berupa ya/oke/betul/simpan, termasuk ya lagi untuk draft yang tadi sudah disimpan, panggil confirmDraft lalu sampaikan message-nya apa adanya: hasilnya memberi tahu kalau yang tadi sudah tersimpan, dan tidak ada yang disimpan dua kali. Kalau pesan terakhir Kakak bukan jawaban setuju, misalnya pertanyaan, jangan panggil confirmDraft, dan tulis ulang tanpa menyatakan apa pun sudah dicatat, tercatat, disimpan, atau masuk catatan. Kalau ada draft, minta Kakak cek ringkasannya lalu jawab ya, ubah, atau batal.";

function retryFeedback({ ungrounded, claims }: Found): string {
  const listed = ungrounded.map(({ text }) => text).join(", ");

  return [
    ...(ungrounded.length > 0
      ? [
          `Catatan sistem: jawaban sebelumnya memuat angka yang tidak ada di hasil tool (${listed}). Tulis ulang jawabannya dan pakai hanya angka dari hasil tool. Jangan menghitung sendiri.`,
        ]
      : []),
    ...(claims.length > 0 ? [CLAIM_FEEDBACK] : []),
  ].join("\n");
}

async function retry(
  input: TurnInput,
  abortSignal: AbortSignal,
  found: Found,
  requireTool: boolean,
): Promise<Attempt | null> {
  try {
    return await attempt(input, abortSignal, { feedback: retryFeedback(found), requireTool });
  } catch {
    // Any failed retry (provider error, timeout, an ignored required tool call) falls back to
    // the first attempt's tool results: the owner never sees a technical error (Q2).
    return null;
  }
}

const draftOutputSchema = z.object({
  status: z.literal("draft"),
  draftId: z.string(),
  summary: z.string(),
});

const SETTLED: DraftOutcome["status"][] = ["done", "failed"];

// The draft the turn leaves open: a confirm or cancel that ran after it settled it, so no card.
function lastDraft(toolCalls: TurnToolCall[]): TurnDraft | null {
  return toolCalls.reduce<TurnDraft | null>((open, call) => {
    const draft = draftOutputSchema.safeParse(call.output);

    if (draft.success) return { draftId: draft.data.draftId, summary: draft.data.summary };

    const decision = draftDecisionSchema.safeParse(call.output);

    return decision.success && SETTLED.includes(decision.data.outcome) ? null : open;
  }, null);
}

const choicesOutputSchema = z.object({ choices: z.array(z.string()).min(2).max(3) });

// Only when the turn ended on that question: a later call that went through means it was answered.
function lastChoices(toolCalls: TurnToolCall[]): string[] | null {
  const parsed = choicesOutputSchema.safeParse(toolCalls.at(-1)?.output);

  return parsed.success ? parsed.data.choices : null;
}

function promptHash(input: TurnInput): string {
  const tools = {
    ...createSalesTools(input.dataset, []),
    ...createWriteTools(input.dataset, null),
  };

  const definitions = Object.entries(tools).map(([name, definition]) => [
    name,
    definition.description,
    definition.inputSchema,
  ]);

  return new Bun.CryptoHasher("sha256")
    .update(buildInstructions(input.business))
    .update(JSON.stringify(definitions))
    .digest("hex");
}

export async function runTurn(input: TurnInput): Promise<TurnResult> {
  const abortSignal = AbortSignal.any([
    AbortSignal.timeout(TURN_TIMEOUT_MS),
    ...(input.abortSignal ? [input.abortSignal] : []),
  ]);

  const attempts: Attempt[] = [];

  function finish(
    chosen: Attempt,
    checked: string,
    action: TurnAction,
    ungrounded: UngroundedNumber[],
  ) {
    const reply = input.formatReply ? input.formatReply(checked) : checked;

    return {
      reply,
      responseMessages: withReply(chosen.responseMessages, reply),
      toolCalls: chosen.toolCalls,
      attachments: chosen.attachments,
      conceptEvents: chosen.conceptEvents,
      check: { action, ungrounded, attempts: tries },
      // A draft made by an earlier attempt is still open, so its card goes out with this reply.
      draft: lastDraft(attempts.flatMap(({ toolCalls }) => toolCalls)),
      choices: lastChoices(chosen.toolCalls),
      promptHash: promptHash(input),
      usage: sumUsage(attempts),
    };
  }

  let tries = 1;
  const first = await attempt(input, abortSignal, { feedback: null, requireTool: false });
  attempts.push(first);

  const accessReply = sheetAccessReply(first.toolCalls);

  if (accessReply !== null) return finish(first, accessReply, "template", []);

  const firstCheck = checkReply(input, first, saveReported(attempts));

  if (firstCheck.ungrounded.length === 0 && firstCheck.reply)
    return finish(first, firstCheck.reply, "none", []);

  if (firstCheck.reply) return finish(first, firstCheck.reply, "dropped", firstCheck.ungrounded);

  // Made-up figures force a read tool (Q2c); a save claim needs a rewrite or confirmDraft instead.
  const forcedTool =
    firstCheck.ungrounded.length > 0 &&
    firstCheck.claims.length === 0 &&
    first.toolCalls.length === 0;

  // An empty answer means the step limit ran out; only a made-up number or claimed save is retried.
  if (firstCheck.ungrounded.length > 0 || firstCheck.claims.length > 0) {
    tries += 1;

    const second = await retry(input, abortSignal, firstCheck, forcedTool);

    if (second) attempts.push(second);

    const secondCheck = second ? checkReply(input, second, saveReported(attempts)) : null;

    if (second && secondCheck?.reply)
      return finish(
        second,
        secondCheck.reply,
        secondCheck.ungrounded.length === 0 ? "regenerated" : "dropped",
        firstCheck.ungrounded,
      );
  }

  const withTools = attempts.findLast((candidate) => candidate.toolCalls.length > 0) ?? first;

  const fallback = fallbackReply(withTools.toolCalls, {
    forcedTool,
    claimOnly: firstCheck.ungrounded.length === 0 && firstCheck.claims.length > 0,
  });

  return finish(withTools, fallback.reply, fallback.action, firstCheck.ungrounded);
}
