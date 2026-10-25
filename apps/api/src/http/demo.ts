import { convertToModelMessages, createUIMessageStream, type UIMessage } from "ai";
import { demoDraftPort } from "./demo-drafts";
import { runTurn, type TurnResult } from "../agent";
import { toWhatsAppText } from "../channels/whatsapp/format";
import type { Db } from "../db/client";
import { chatModel } from "../llm";
import { findDemoBusiness } from "../modules/business";
import { recordFailedTurn, recordTurn } from "../modules/traces";
import { loadSalesDataset } from "../sales/repository";
import { eventsFromHistory } from "../semantic/exposure";
import { withTrace } from "../trace";

const MAX_HISTORY_MESSAGES = 20;

// The web demo sends its whole history each request (nothing is stored for it) and runs the same
// turn as WhatsApp, on the seeded demo business in Postgres.
async function runDemoTurn(
  db: Db,
  messages: UIMessage[],
  traceId: string,
  abortSignal: AbortSignal,
) {
  const started = Date.now();
  const now = new Date();
  const business = await findDemoBusiness(db);

  if (business === null) throw new Error("demo business is not seeded");

  const run = runTurn({
    model: chatModel,
    business,
    dataset: await loadSalesDataset(db, business.id, now),
    messages: await convertToModelMessages(messages.slice(-MAX_HISTORY_MESSAGES)),
    // Exposure reads the whole history so a concept explained long ago is not explained again.
    conceptEvents: eventsFromHistory(messages),
    now,
    abortSignal,
    formatReply: toWhatsAppText,
    drafts: demoDraftPort(messages),
  });

  let turn: TurnResult;

  try {
    turn = await run;
  } catch (error) {
    // The client already has this trace id, so a failure still leaves a row behind it.
    await recordFailedTurn(db, {
      traceId,
      businessId: business.id,
      channel: "demo",
      durationMs: Date.now() - started,
      error: error instanceof Error ? error.message : String(error),
    });

    throw error;
  }

  await recordTurn(db, {
    traceId,
    businessId: business.id,
    channel: "demo",
    turn,
    durationMs: Date.now() - started,
    outboundMessages: 1,
    model: chatModel.modelId,
  });

  return turn;
}

// The reply is checked for made-up numbers before anything is sent (decision Q2), so the demo gets
// the finished turn replayed as one UI message instead of token-by-token streaming.
function replayTurn(run: () => Promise<TurnResult>) {
  return createUIMessageStream({
    execute: async ({ writer }) => {
      const turn = await run();

      writer.write({ type: "start" });

      // Separate steps keep the client's history in model order: tool call, result, then text.
      if (turn.toolCalls.length > 0) {
        writer.write({ type: "start-step" });

        for (const { toolCallId, toolName, input, output } of turn.toolCalls) {
          writer.write({ type: "tool-input-available", toolCallId, toolName, input });
          writer.write({ type: "tool-output-available", toolCallId, output });
        }

        writer.write({ type: "finish-step" });
      }

      writer.write({ type: "start-step" });
      writer.write({ type: "text-start", id: "reply" });
      // No buttons on the web: the card's summary follows the reply and the owner types the answer.
      const card = turn.draft ? `\n\n${turn.draft.summary}` : "";

      writer.write({ type: "text-delta", id: "reply", delta: turn.reply + card });
      writer.write({ type: "text-end", id: "reply" });
      writer.write({ type: "finish-step" });
      writer.write({ type: "finish" });
    },
    // The default logger prints the whole request, including the owner's messages.
    onError: (error) => {
      console.error("demo chat failed:", error instanceof Error ? error.message : error);

      return "Maaf Kak, Thya lagi gangguan. Coba kirim ulang sebentar lagi ya.";
    },
  });
}

export function demoChatStream(
  db: Db,
  messages: UIMessage[],
  traceId: string,
  abortSignal: AbortSignal,
) {
  return replayTurn(() =>
    withTrace(traceId, () => runDemoTurn(db, messages, traceId, abortSignal)),
  );
}
