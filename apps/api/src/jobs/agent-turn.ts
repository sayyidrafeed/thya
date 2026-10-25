import type { LanguageModel, ModelMessage } from "ai";
import { runTurn, type TurnResult } from "../agent";
import { TEXT_LIMIT } from "../channels/whatsapp/client";
import { deliverPending, type Delivery } from "../channels/whatsapp/deliver";
import { toWhatsAppText, splitText } from "../channels/whatsapp/format";
import { messageSchema, readContent, type InboundContent } from "../channels/whatsapp/inbound";
import type { Db } from "../db/client";
import { findBusinessByPhone, type Business } from "../modules/business";
import {
  commitTurn,
  countInboundSince,
  loadHistory,
  unprocessedInbound,
  type Outbound,
} from "../modules/conversation";
import { recordFailedTurn, recordTurn } from "../modules/traces";
import { jakartaDate } from "../sales/report";
import { loadSalesDataset } from "../sales/repository";
import { appendConceptEvents, loadConceptEvents } from "../semantic/repository";
import { newTraceId, withTrace } from "../trace";

export type AgentTurnDeps = {
  db: Db;
  // An object, not a model id string, so the trace can name it (decision U1).
  model: Exclude<LanguageModel, string>;
  delivery: Delivery;
  now: () => Date;
};

// Engine-plan A9: more than this many messages in a minute gets one throttle reply, no model turn.
export const RATE_LIMIT = { messages: 10, windowMs: 60_000 };

export const REPLIES = {
  unregistered:
    "Halo Kak, nomor ini belum terdaftar di Thya. Hubungi tim Thya dulu ya supaya usaha Kakak bisa disambungkan.",
  throttled:
    "Pesannya banyak sekali, Kak. Thya jawab pelan-pelan ya, tunggu sebentar lalu kirim lagi.",
  unsupported:
    "Maaf Kak, Thya baru bisa membaca pesan teks. Coba ketik pertanyaannya ya, misalnya: omzet kemarin berapa?",
  failed: "Maaf Kak, Thya lagi gangguan. Coba kirim ulang sebentar lagi ya.",
};

function textOutbound(to: string, key: string, text: string): Outbound[] {
  return splitText(text, TEXT_LIMIT).map((piece, index) => ({
    key: `${key}:${index}`,
    payload: { type: "text", to, text: piece },
  }));
}

function ownerText(content: InboundContent): string | null {
  if (content.kind === "text") return content.text;

  if (content.kind === "button") return content.title;

  return null;
}

async function runAgent(deps: AgentTurnDeps, business: Business, texts: string[], traceId: string) {
  const { db } = deps;
  const now = deps.now();
  const known = await loadConceptEvents(db, business.id);
  const owner: ModelMessage = { role: "user", content: texts.join("\n") };

  const turn = await runTurn({
    model: deps.model,
    business,
    dataset: await loadSalesDataset(db, business.id, now),
    messages: [...(await loadHistory(db, business.id)), owner],
    conceptEvents: known,
    now,
    formatReply: toWhatsAppText,
  });

  await appendConceptEvents(
    db,
    { businessId: business.id, traceId },
    turn.conceptEvents.slice(known.length),
  );

  return { owner, turn };
}

async function answer(
  deps: AgentTurnDeps,
  {
    business,
    phone,
    wamids,
    texts,
  }: { business: Business; phone: string; wamids: string[]; texts: string[] },
) {
  const traceId = newTraceId();
  const started = Date.now();
  // The last wamid names the batch: a retried job that already committed finds no rows and stops.
  const key = `reply:${wamids.at(-1)}`;

  await withTrace(traceId, async () => {
    let result: { owner: ModelMessage; turn: TurnResult };

    try {
      result = await runAgent(deps, business, texts, traceId);
    } catch (error) {
      await recordFailedTurn(deps.db, {
        traceId,
        businessId: business.id,
        channel: "whatsapp",
        durationMs: Date.now() - started,
        error: error instanceof Error ? error.message : String(error),
      });

      // The owner never sees a technical error, and a failed model call never blocks the number.
      await commitTurn(deps.db, {
        businessId: business.id,
        traceId,
        wamids,
        history: [],
        outbound: textOutbound(phone, key, REPLIES.failed),
      });

      return;
    }

    const outbound = textOutbound(phone, key, result.turn.reply);

    await commitTurn(deps.db, {
      businessId: business.id,
      traceId,
      wamids,
      history: [result.owner, ...result.turn.responseMessages],
      outbound,
    });

    await recordTurn(deps.db, {
      traceId,
      businessId: business.id,
      channel: "whatsapp",
      turn: result.turn,
      durationMs: Date.now() - started,
      outboundMessages: outbound.length,
      model: deps.model.modelId,
    });
  });
}

// One job per phone at a time (queue policy key_strict_fifo). Every message that arrived during
// the 3-second buffer is answered as one batch (harness §4).
export async function handleAgentTurn(deps: AgentTurnDeps, phone: string) {
  const { db, delivery } = deps;

  // Leftovers from a run that committed but crashed before sending go out first.
  await deliverPending(delivery, phone);

  const rows = await unprocessedInbound(db, phone);

  if (rows.length === 0) return;

  const now = deps.now();
  const wamids = rows.map((row) => row.wamid);
  const business = await findBusinessByPhone(db, phone);
  const day = jakartaDate(now);

  const reject = async (key: string, text: string) => {
    await commitTurn(db, {
      businessId: business?.id ?? null,
      traceId: newTraceId(),
      wamids,
      history: [],
      outbound: textOutbound(phone, key, text),
    });

    await deliverPending(delivery, phone);
  };

  if (business === null) return reject(`unregistered:${phone}:${day}`, REPLIES.unregistered);

  const recent = await countInboundSince(db, phone, new Date(now.getTime() - RATE_LIMIT.windowMs));
  const minute = Math.floor(now.getTime() / RATE_LIMIT.windowMs);

  if (recent > RATE_LIMIT.messages)
    return reject(`throttled:${phone}:${minute}`, REPLIES.throttled);

  const lastWamid = wamids.at(-1);

  // Read receipt + typing indicator are courtesy; a failure must not cost the reply.
  if (lastWamid) await delivery.client.markRead(lastWamid).catch(() => {});

  const contents = rows.map((row) => readContent(messageSchema.parse(row.payload)));
  const texts = contents.map(ownerText).filter((text) => text !== null);

  if (texts.length === 0) return reject(`unsupported:${lastWamid}`, REPLIES.unsupported);

  await answer(deps, { business, phone, wamids, texts });
  await deliverPending(delivery, phone);
}
