import type { LanguageModel, ModelMessage } from "ai";
import { attachmentPort, cancelOpenDraft, dbDraftPort, runDraft } from "../actions";
import { renderSummary, runTurn, type TurnDraft, type TurnResult } from "../agent";
import { BUTTON_TITLE_LIMIT, CAPTION_LIMIT, TEXT_LIMIT } from "../channels/whatsapp/client";
import { deliverPending, type Delivery } from "../channels/whatsapp/deliver";
import { toWhatsAppText, splitText } from "../channels/whatsapp/format";
import { messageSchema, readContent } from "../channels/whatsapp/inbound";
import type { DraftOutcome } from "../actions/kinds";
import { renderProfile } from "../profile";
import { COMPACTION_THRESHOLD_CHARS } from "./compaction";
import { readPaymentImage } from "./payment-image";
import type { Db } from "../db/client";
import { findBusinessByPhone, type Business } from "../modules/business";
import {
  commitTurn,
  countInboundSince,
  historySize,
  loadHistory,
  loadSummary,
  quoteForwarded,
  unprocessedInbound,
  type Outbound,
} from "../modules/conversation";
import { dbSheetPort, type SheetsAccess } from "../modules/sheets";
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
  // Gate G11: QRIS/GoPay screenshots are read only when this is on.
  paymentsImport: boolean;
  // DELIVERY_IMPORT_ENABLED: delivery app sales screenshots are read too. Off when omitted.
  deliveryImport?: boolean;
  // Google service account for the sheet tools (S5, S6); null or absent = no sheet tools (U10).
  sheets?: SheetsAccess | null;
  // Asks for a compaction job once the thread passes its threshold (B1); none in tests.
  compact?: (businessId: string) => Promise<void>;
  // How long a turn may think before the owner gets a "still working" line; default INTERIM_AFTER_MS.
  interimAfterMs?: number;
};

// Meta redelivers a webhook for up to 7 days; anything older than this is answered by code.
export const STALE_AFTER_MS = 6 * 60 * 60 * 1000;

// Harness §7: Meta's typing indicator stops after 25 s, and a slow month ranking takes about 20.
export const INTERIM_AFTER_MS = 15_000;

// What the thread records for a screenshot: never its content (A8), only that it came.
const IMAGE_NOTE = "[Pemilik mengirim gambar]";

const TAINTED_CONFIRM: DraftOutcome = {
  status: "none",
  message:
    "Untuk pesan yang ada gambarnya atau pesan terusan, konfirmasi lewat tombol Ya di kartu ya Kak.",
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
  interim: "Sebentar ya Kak, Thya masih menghitung.",
  stale:
    "Maaf Kak, pesan Kakak tadi baru sampai ke Thya sekarang. Kalau masih perlu, kirim ulang ya.",
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

// Decision Q6 (widened): a reply with a picture is the picture with the reply as its caption; only
// a reply over the caption limit adds a second message with the rest.
function replyOutbound(to: string, key: string, turn: TurnResult): Outbound[] {
  const [picture] = turn.attachments;

  if (picture === undefined && turn.choices !== null && turn.draft === null)
    return choicesOutbound(to, key, turn.reply, turn.choices);

  if (picture === undefined) return textOutbound(to, key, turn.reply);

  const [caption = "", ...rest] = splitText(turn.reply, CAPTION_LIMIT);

  return [
    { key: `${key}:image`, payload: { type: "image", to, attachmentId: picture.id, caption } },
    ...(rest.length > 0 ? textOutbound(to, `${key}:rest`, rest.join("\n\n")) : []),
  ];
}

// A question with tappable answers: the reply itself carries the buttons when it fits their body.
function choicesOutbound(to: string, key: string, reply: string, choices: string[]): Outbound[] {
  const fits = reply.length <= CAPTION_LIMIT;

  const buttons: Outbound = {
    key: `${key}:choices`,
    payload: {
      type: "buttons",
      to,
      body: fits ? reply : "Pilih salah satu ya, Kak:",
      buttons: choices.map((title, index) => ({
        id: `choice:${index}`,
        title: title.slice(0, BUTTON_TITLE_LIMIT),
      })),
    },
  };

  return fits ? [buttons] : [...textOutbound(to, key, reply), buttons];
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

// A message code answered itself: a tapped button, or a payment screenshot (S9).
type Tap = { wamid: string; tapped: string; reply: string; card: TurnDraft | null };

// Owner words for the model, in arrival order, plus what code already answered. `tainted`: the
// batch carried a picture or a forwarded message, so a typed "ya" in it confirms nothing (A14).
type Batch = { texts: string[]; answered: Tap[]; tainted: boolean };

type InboundRow = Awaited<ReturnType<typeof unprocessedInbound>>[number];

async function answerTap(
  deps: AgentTurnDeps,
  business: Business,
  { draftId, action }: { draftId: string; action: string },
) {
  const where = { businessId: business.id, draftId, now: deps.now(), sheets: deps.sheets };

  if (action === "yes") return { reply: (await runDraft(deps.db, where)).message, edit: false };

  const cancelled = await cancelOpenDraft(deps.db, where);

  // "Ubah" = cancel, then the model asks what to change and drafts again (Q1, features §4.3).
  if (action === "edit" && cancelled.status === "done") return { reply: null, edit: true };

  return { reply: cancelled.message, edit: false };
}

async function readBatch(deps: AgentTurnDeps, business: Business, rows: InboundRow[]) {
  const batch: Batch = { texts: [], answered: [], tainted: false };

  for (const row of rows) {
    const content = readContent(messageSchema.parse(row.payload));
    const forwarded = "forwarded" in content && content.forwarded;
    const said = (text: string) => (forwarded ? quoteForwarded(text) : text);

    // Someone else's words (A14): readable as data, but nothing in this turn confirms a draft.
    if (forwarded) batch.tainted = true;

    if (content.kind === "text") batch.texts.push(said(content.text));

    if (content.kind === "image") {
      if (content.caption) batch.texts.push(said(content.caption));

      const imports = { payments: deps.paymentsImport, delivery: deps.deliveryImport ?? false };

      if (!imports.payments && !imports.delivery) continue;

      batch.tainted = true;

      const read = await readPaymentImage(
        { db: deps.db, model: deps.model, client: deps.delivery.client },
        {
          businessId: business.id,
          mediaId: content.mediaId,
          now: deps.now(),
          traceId: newTraceId(),
          imports,
        },
      );

      batch.answered.push({
        wamid: row.wamid,
        tapped: IMAGE_NOTE,
        reply: read.reply,
        card: read.draft,
      });
      continue;
    }

    if (content.kind !== "button") continue;

    const [, draftId, action] = DRAFT_BUTTON.exec(content.id) ?? [];

    // Any other button (an answer choice, or one Thya did not make) reads as the words on it.
    if (draftId === undefined || action === undefined) {
      batch.texts.push(content.title);
      continue;
    }

    const { reply, edit } = await answerTap(deps, business, { draftId, action });

    if (edit) batch.texts.push(content.title);

    if (reply !== null)
      batch.answered.push({ wamid: row.wamid, tapped: content.title, reply, card: null });
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

async function turnMemory(db: Db, businessId: string, now: Date) {
  const stored = await loadSummary(db, businessId);

  return {
    profile: await renderProfile(db, businessId, now),
    summary: stored ? renderSummary(stored.summary) : null,
  };
}

async function runAgent(
  deps: AgentTurnDeps,
  business: Business,
  { texts, tainted }: { texts: string[]; tainted: boolean },
  traceId: string,
) {
  const { db } = deps;
  const now = deps.now();
  const known = await loadConceptEvents(db, business.id);
  const owner: ModelMessage = { role: "user", content: texts.join("\n") };
  const drafts = dbDraftPort(db, { businessId: business.id, traceId, now, sheets: deps.sheets });

  const turn = await runTurn({
    model: deps.model,
    business,
    dataset: await loadSalesDataset(db, business.id, now),
    messages: [...(await loadHistory(db, business.id)), owner],
    conceptEvents: known,
    now,
    formatReply: toWhatsAppText,
    drafts: tainted ? { ...drafts, confirmOpen: async () => TAINTED_CONFIRM } : drafts,
    attachments: attachmentPort(db, business.id, now),
    memory: await turnMemory(db, business.id, now),
    deliveryImport: deps.deliveryImport ?? false,
    sheets: deps.sheets ? dbSheetPort(db, business.id, deps.sheets) : undefined,
  });

  await appendConceptEvents(
    db,
    { businessId: business.id, traceId },
    turn.conceptEvents.slice(known.length),
  );

  return { owner, turn };
}

// One JSON line per turn, keyed by the trace id that agent_turns and the outbox rows carry. No
// message text and no phone number: those stay in the database.
function logTurn(entry: {
  traceId: string;
  outcome: "answered" | "failed";
  durationMs: number;
  inbound: number;
  outbound: number;
  error?: string;
}) {
  console.log(JSON.stringify({ event: "agent-turn", ...entry }));
}

// Goes through the outbox like any reply, so a retried job never sends it twice, and restarts the
// typing indicator that the line itself clears.
async function sendInterim(
  deps: AgentTurnDeps,
  {
    businessId,
    phone,
    traceId,
    wamid,
  }: { businessId: string; phone: string; traceId: string; wamid: string },
) {
  try {
    await commitTurn(deps.db, {
      businessId,
      traceId,
      wamids: [],
      history: [],
      outbound: textOutbound(phone, `interim:${wamid}`, REPLIES.interim),
    });
    await deliverPending(deps.delivery, phone);
    await deps.delivery.client.markRead(wamid).catch(() => {});
  } catch (error) {
    console.error("interim reply failed:", error instanceof Error ? error.message : error);
  }
}

async function answer(
  deps: AgentTurnDeps,
  {
    business,
    phone,
    wamids,
    texts,
    tainted,
  }: { business: Business; phone: string; wamids: string[]; texts: string[]; tainted: boolean },
) {
  const traceId = newTraceId();
  const started = Date.now();
  // The last wamid names the batch: a retried job that already committed finds no rows and stops.
  const key = `reply:${wamids.at(-1)}`;

  await withTrace(traceId, async () => {
    let result: { owner: ModelMessage; turn: TurnResult };
    let interim: Promise<void> | null = null;
    const lastWamid = wamids.at(-1) ?? traceId;

    const timer = setTimeout(() => {
      interim = sendInterim(deps, { businessId: business.id, phone, traceId, wamid: lastWamid });
    }, deps.interimAfterMs ?? INTERIM_AFTER_MS);

    try {
      // The interim line must be out before the reply is queued, or both sends race on the outbox.
      result = await runAgent(deps, business, { texts, tainted }, traceId).finally(async () => {
        clearTimeout(timer);
        await interim;
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const durationMs = Date.now() - started;

      await recordFailedTurn(deps.db, {
        traceId,
        businessId: business.id,
        channel: "whatsapp",
        durationMs,
        error: message,
      });

      logTurn({
        traceId,
        outcome: "failed",
        durationMs,
        inbound: wamids.length,
        outbound: 1,
        error: message,
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
      ...replyOutbound(phone, key, turn),
      ...(turn.draft ? [draftCard(phone, turn.draft)] : []),
    ];

    await commitTurn(deps.db, {
      businessId: business.id,
      traceId,
      wamids,
      history: [owner, ...turn.responseMessages],
      outbound,
    });

    const durationMs = Date.now() - started;

    await recordTurn(deps.db, {
      traceId,
      businessId: business.id,
      channel: "whatsapp",
      turn,
      durationMs,
      outboundMessages: outbound.length,
      model: deps.model.modelId,
    });

    logTurn({
      traceId,
      outcome: "answered",
      durationMs,
      inbound: wamids.length,
      outbound: outbound.length,
    });

    if (deps.compact && (await historySize(deps.db, business.id)) > COMPACTION_THRESHOLD_CHARS)
      await deps.compact(business.id);
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
  const business = await findBusinessByPhone(db, phone);
  const day = jakartaDate(now);
  const staleBefore = now.getTime() - STALE_AFTER_MS;

  const stale =
    business === null ? [] : rows.filter((row) => row.receivedAt.getTime() < staleBefore);

  // Decided 2026-10-26: a message that arrives hours late never reaches the model or writes data;
  // the owner is asked to send it again if it still matters.
  if (business !== null && stale.length > 0)
    await commitTurn(db, {
      businessId: business.id,
      traceId: newTraceId(),
      wamids: stale.map((row) => row.wamid),
      history: [],
      outbound: textOutbound(phone, `stale:${stale.at(-1)?.wamid}`, REPLIES.stale),
    });

  const current = rows.filter((row) => !stale.includes(row));

  if (current.length === 0) {
    await deliverPending(delivery, phone);

    return;
  }

  const wamids = current.map((row) => row.wamid);

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

  // An emoji on one of Thya's messages asks for nothing; answering it with "teks saja" is noise.
  if (current.every((row) => row.type === "reaction")) {
    await commitTurn(db, {
      businessId: business.id,
      traceId: newTraceId(),
      wamids,
      history: [],
      outbound: [],
    });

    return;
  }

  const recent = await countInboundSince(db, phone, new Date(now.getTime() - RATE_LIMIT.windowMs));
  const minute = Math.floor(now.getTime() / RATE_LIMIT.windowMs);

  if (recent > RATE_LIMIT.messages) return reply(`throttled:${phone}:${minute}`, REPLIES.throttled);

  const lastWamid = wamids.at(-1);

  // Read receipt + typing indicator are courtesy; a failure must not cost the reply.
  if (lastWamid) await delivery.client.markRead(lastWamid).catch(() => {});

  const batch = await readBatch(deps, business, current);

  if (batch.texts.length === 0 && batch.answered.length === 0)
    return reply(`unsupported:${lastWamid}`, REPLIES.unsupported);

  // Taps go first, so "Ya" then a question reads in the order the owner sent them.
  await commitTurn(db, {
    businessId: business.id,
    traceId: newTraceId(),
    wamids: batch.texts.length === 0 ? wamids : [],
    history: tapHistory(batch.answered),
    outbound: batch.answered.flatMap((tap) => [
      ...textOutbound(phone, `tap:${tap.wamid}`, tap.reply),
      ...(tap.card ? [draftCard(phone, tap.card)] : []),
    ]),
  });

  if (batch.texts.length > 0)
    await answer(deps, { business, phone, wamids, texts: batch.texts, tainted: batch.tainted });

  await deliverPending(delivery, phone);
}
