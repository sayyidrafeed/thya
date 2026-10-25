import type { LanguageModel, ModelMessage } from "ai";
import { cancelOpenDraft, dbDraftPort, runDraft } from "../actions";
import { runTurn, type TurnDraft, type TurnResult } from "../agent";
import { CAPTION_LIMIT, TEXT_LIMIT } from "../channels/whatsapp/client";
import { deliverPending, type Delivery } from "../channels/whatsapp/deliver";
import { toWhatsAppText, splitText } from "../channels/whatsapp/format";
import { messageSchema, readContent } from "../channels/whatsapp/inbound";
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

// Decision Q1 / A15: the card is its own message and its buttons carry the draft id, so a tap is
// handled by code without the model.
const DRAFT_BUTTON = /^draft:([0-9a-f-]{36}):(yes|edit|cancel)$/;

function textOutbound(to: string, key: string, text: string): Outbound[] {
  return splitText(text, TEXT_LIMIT).map((piece, index) => ({
    key: `${key}:${index}`,
    payload: { type: "text", to, text: piece },
  }));
}

function draftCard(to: string, draft: TurnDraft): Outbound {
  return {
    key: `card:${draft.draftId}`,
    payload: {
      type: "buttons",
      to,
      body: draft.summary.slice(0, CAPTION_LIMIT),
      buttons: [
        { id: `draft:${draft.draftId}:yes`, title: "Ya" },
        { id: `draft:${draft.draftId}:edit`, title: "Ubah" },
        { id: `draft:${draft.draftId}:cancel`, title: "Batal" },
      ],
    },
  };
}

type Tap = { wamid: string; tapped: string; reply: string };

// Owner words for the model, in arrival order, plus the taps code already answered.
type Batch = { texts: string[]; answered: Tap[] };

type InboundRow = Awaited<ReturnType<typeof unprocessedInbound>>[number];

async function answerTap(
  deps: AgentTurnDeps,
  business: Business,
  { draftId, action }: { draftId: string; action: string },
) {
  const where = { businessId: business.id, draftId, now: deps.now() };

  if (action === "yes") return { reply: (await runDraft(deps.db, where)).message, edit: false };

  const cancelled = await cancelOpenDraft(deps.db, where);

  // "Ubah" = cancel, then the model asks what to change and drafts again (Q1, features §4.3).
  if (action === "edit" && cancelled.status === "done") return { reply: null, edit: true };

  return { reply: cancelled.message, edit: false };
}

async function readBatch(deps: AgentTurnDeps, business: Business, rows: InboundRow[]) {
  const batch: Batch = { texts: [], answered: [] };

  for (const row of rows) {
    const content = readContent(messageSchema.parse(row.payload));

    if (content.kind === "text") batch.texts.push(content.text);

    if (content.kind !== "button") continue;

    const [, draftId, action] = DRAFT_BUTTON.exec(content.id) ?? [];

    // A button Thya did not make reads as the words on it.
    if (draftId === undefined || action === undefined) {
      batch.texts.push(content.title);
      continue;
    }

    const { reply, edit } = await answerTap(deps, business, { draftId, action });

    if (edit) batch.texts.push(content.title);

    if (reply !== null) batch.answered.push({ wamid: row.wamid, tapped: content.title, reply });
  }

  return batch;
}

// Code-written replies still join the thread, so the model knows a draft was saved or dropped.
function tapHistory(answered: Tap[]): ModelMessage[] {
  return answered.flatMap(({ tapped, reply }): ModelMessage[] => [
    { role: "user", content: tapped },
    { role: "assistant", content: reply },
  ]);
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
    drafts: dbDraftPort(db, { businessId: business.id, traceId, now }),
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

    const { owner, turn } = result;

    const outbound = [
      ...textOutbound(phone, key, turn.reply),
      ...(turn.draft ? [draftCard(phone, turn.draft)] : []),
    ];

    await commitTurn(deps.db, {
      businessId: business.id,
      traceId,
      wamids,
      history: [owner, ...turn.responseMessages],
      outbound,
    });

    await recordTurn(deps.db, {
      traceId,
      businessId: business.id,
      channel: "whatsapp",
      turn,
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

  const reply = async (key: string, text: string) => {
    await commitTurn(db, {
      businessId: business?.id ?? null,
      traceId: newTraceId(),
      wamids,
      history: [],
      outbound: textOutbound(phone, key, text),
    });

    await deliverPending(delivery, phone);
  };

  if (business === null) return reply(`unregistered:${phone}:${day}`, REPLIES.unregistered);

  const recent = await countInboundSince(db, phone, new Date(now.getTime() - RATE_LIMIT.windowMs));
  const minute = Math.floor(now.getTime() / RATE_LIMIT.windowMs);

  if (recent > RATE_LIMIT.messages) return reply(`throttled:${phone}:${minute}`, REPLIES.throttled);

  const lastWamid = wamids.at(-1);

  // Read receipt + typing indicator are courtesy; a failure must not cost the reply.
  if (lastWamid) await delivery.client.markRead(lastWamid).catch(() => {});

  const batch = await readBatch(deps, business, rows);

  if (batch.texts.length === 0 && batch.answered.length === 0)
    return reply(`unsupported:${lastWamid}`, REPLIES.unsupported);

  // Taps go first, so "Ya" then a question reads in the order the owner sent them.
  await commitTurn(db, {
    businessId: business.id,
    traceId: newTraceId(),
    wamids: batch.texts.length === 0 ? wamids : [],
    history: tapHistory(batch.answered),
    outbound: batch.answered.flatMap((tap) => textOutbound(phone, `tap:${tap.wamid}`, tap.reply)),
  });

  if (batch.texts.length > 0) await answer(deps, { business, phone, wamids, texts: batch.texts });

  await deliverPending(delivery, phone);
}
