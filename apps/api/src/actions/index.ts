import type { AttachmentPort } from "../agent";
import type { Db } from "../db/client";
import { saveAttachment } from "../modules/attachments";
import { insertChannelSales, setCommission } from "../modules/channel-sales";
import { outboundState } from "../modules/conversation";
import { insertPayments } from "../modules/payments-import";
import {
  cancelDraft,
  claimDraft,
  createDraft,
  DRAFT_TTL_MS,
  findDraft,
  finishDraft,
  keepTurnDraft,
  latestDraft,
  openDraft,
  undoTurnDrafts,
  type Claim,
  type Draft,
} from "../modules/drafts";
import { formatRupiah } from "../sales/format";
import { DELIVERY_CHANNEL_NAMES, jakartaDate } from "../sales/report";
import { recordChatSales, setMenuCost } from "../sales/repository";
import {
  cancelSchedule,
  createSchedule,
  listActiveSchedules,
  ScheduleError,
  scheduleSummary,
  specOf,
} from "../modules/schedules";
import {
  runSheetAppend,
  runSheetImport,
  SheetActionError,
  type SheetsAccess,
} from "../modules/sheets";
import { commissionText, dayLabel, runLabel, salesRecorded } from "./summary";
import {
  DRAFT_UNSEEN,
  storedDraftSchema,
  type DraftCheck,
  type DraftOutcome,
  type DraftPort,
  type StoredDraft,
} from "./kinds";

// Draft executors: one per kind, each a thin call into the module that owns the table. Messages
// here go to the owner as they are, so they are plain Indonesian without technical words.

const NOT_RUN: Record<Exclude<Claim["status"], "claimed">, string> = {
  done: "Yang ini sudah tersimpan tadi, Kak. Thya tidak menyimpannya dua kali.",
  executing: "Yang ini sedang Thya simpan, Kak. Tunggu sebentar ya.",
  cancelled: "Yang ini sudah dibatalkan atau diganti, Kak. Kalau masih mau, sebutkan lagi ya.",
  expired: "Konfirmasinya sudah lewat, Kak. Sebutkan lagi ya, nanti Thya siapkan ulang.",
  failed: "Yang ini tadi gagal disimpan, Kak. Sebutkan lagi ya, nanti Thya siapkan ulang.",
  missing: "Thya tidak menemukan yang mau dikonfirmasi, Kak.",
};

const FAILED = "Maaf Kak, belum berhasil disimpan. Coba sebutkan lagi sebentar lagi ya.";
const CANCELLED = "Oke Kak, dibatalkan. Tidak ada yang disimpan.";

const SAVED_NOT_CANCELLED =
  "Yang ini sudah tersimpan, Kak, jadi tidak dibatalkan. Kalau ada yang salah, kabari tim Thya ya.";

export const NOTHING_OPEN: DraftOutcome = {
  status: "none",
  message: "Belum ada yang menunggu konfirmasi, Kak.",
};

export const SAVED_BEFORE: DraftOutcome = {
  status: "already_done",
  message: "Yang tadi sudah tersimpan, Kak. Belum ada yang baru untuk dikonfirmasi.",
};

// The card's send failed for good, so the owner never had it.
export const CARD_LOST: DraftOutcome = {
  status: "none",
  message:
    "Ringkasan yang tadi tidak sampai ke Kakak, jadi belum ada yang disimpan. Sebutkan lagi ya, nanti Thya siapkan ulang.",
};

const LATEST_STATE: Record<Draft["status"], Omit<DraftCheck, "summary">> = {
  pending: {
    status: "none",
    message: "Yang tadi belum tersimpan, Kak. Cek ringkasannya, lalu jawab ya, ubah, atau batal.",
  },
  executing: { status: "none", message: NOT_RUN.executing },
  done: { status: "already_done", message: "Yang tadi sudah tersimpan, Kak." },
  failed: { status: "none", message: NOT_RUN.failed },
  cancelled: { status: "none", message: NOT_RUN.cancelled },
  expired: { status: "none", message: NOT_RUN.expired },
};

const LOST_CHECK: Omit<DraftCheck, "summary"> = {
  status: "none",
  message:
    "Yang tadi belum tersimpan, Kak. Ringkasannya tidak sampai ke Kakak, jadi sebutkan lagi ya, nanti Thya siapkan ulang.",
};

const NOTHING_RECENT = `Dalam ${DRAFT_TTL_MS / 3_600_000} jam terakhir belum ada catatan yang Thya siapkan, Kak.`;

// Whether the owner had the card before writing; "unseen" includes one still on its way.
export type CardView = "seen" | "unseen" | "lost";

// The latest draft in the confirmation window, as a typed "ya" or a status question finds it.
export type LatestDraft = Pick<Draft, "status" | "summary"> & { card: CardView };

// The outbox key of a draft's card, which carries its Ya/Ubah/Batal buttons.
export const cardKey = (draftId: string) => `card:${draftId}`;

// One rule for every DraftPort: a typed "ya" runs only a card the owner had before writing it.
export function decideConfirm<T extends LatestDraft>(latest: T | null): DraftOutcome | { run: T } {
  if (latest?.status === "done") return SAVED_BEFORE;

  if (latest?.status !== "pending") return NOTHING_OPEN;

  if (latest.card === "lost") return CARD_LOST;

  return latest.card === "seen" ? { run: latest } : DRAFT_UNSEEN;
}

async function cardView(
  db: Db,
  draft: Draft,
  turn: { traceId: string; ownerWroteAt: Date },
): Promise<CardView> {
  if (draft.traceId === turn.traceId) return "unseen";

  const card = await outboundState(db, cardKey(draft.id));

  if (card?.status === "failed") return "lost";

  return card !== null && card.sentAt !== null && card.sentAt < turn.ownerWroteAt
    ? "seen"
    : "unseen";
}

export function draftCheck(latest: LatestDraft | null): DraftCheck {
  if (latest === null) return { status: "none", message: NOTHING_RECENT, summary: null };

  const lost = latest.status === "pending" && latest.card === "lost";

  return { ...(lost ? LOST_CHECK : LATEST_STATE[latest.status]), summary: latest.summary };
}

// Safe only at job start: with one job per phone, an open draft without a card is a dead run's.
export async function undoDeadRun(db: Db, { businessId, now }: { businessId: string; now: Date }) {
  const open = await openDraft(db, businessId, now);

  if (open !== null && (await outboundState(db, cardKey(open.id))) === null)
    await undoTurnDrafts(db, { businessId, traceId: open.traceId });
}

// `sheets`: Google access for sheet.append; null where the deployment has no service account.
type DraftRun = { businessId: string; draftId: string; now: Date; sheets?: SheetsAccess | null };

async function execute(db: Db, { businessId, draftId, now, sheets }: DraftRun, draft: StoredDraft) {
  if (draft.kind === "sheet.append")
    return runSheetAppend(db, sheets ?? null, {
      businessId,
      args: draft.args,
      today: jakartaDate(now),
    });

  if (draft.kind === "sheet.import")
    return runSheetImport(db, { businessId, draftId, args: draft.args });

  if (draft.kind === "schedule.create") {
    const row = await createSchedule(db, { businessId, spec: draft.args, now });

    return `Siap, Kak. ${scheduleSummary(draft.args)}. Yang pertama ${runLabel(row.nextRunAt)}.`;
  }

  if (draft.kind === "payments.import") {
    const added = await insertPayments(db, { businessId, draftId, ...draft.args });
    const already = draft.args.rows.length - added;

    return already === 0
      ? `Sudah dicatat, Kak: ${added} pembayaran masuk.`
      : `Sudah dicatat, Kak: ${added} pembayaran baru, ${already} sudah ada sebelumnya.`;
  }

  if (draft.kind === "channel_sales.import") {
    const added = await insertChannelSales(db, { businessId, draftId, ...draft.args });
    const already = draft.args.rows.length - added;
    const name = DELIVERY_CHANNEL_NAMES[draft.args.channel];

    return already === 0
      ? `Sudah dicatat, Kak: penjualan ${name} ${added} hari, terpisah dari omzet menu.`
      : `Sudah dicatat, Kak: penjualan ${name} ${added} hari baru, ${already} hari sudah ada sebelumnya.`;
  }

  if (draft.kind === "channel.set_commission") {
    await setCommission(db, { businessId, draftId, commission: draft.args, now });

    return `Siap, Kak. Potongan ${DELIVERY_CHANNEL_NAMES[draft.args.channel]} sekarang ${commissionText(draft.args)}.`;
  }

  if (draft.kind === "schedule.cancel")
    return (await cancelSchedule(db, { businessId, scheduleId: draft.args.scheduleId }))
      ? `Oke Kak, jadwal dibatalkan: ${draft.args.summary}.`
      : "Jadwal itu sudah tidak aktif, Kak.";

  if (draft.kind === "sales.record") {
    await recordChatSales(db, { businessId, draftId, args: draft.args });

    return salesRecorded(draft.args);
  }

  await setMenuCost(db, { businessId, draftId, args: draft.args });

  return `Sudah disimpan, Kak. Modal per porsi ${draft.args.name} sekarang ${formatRupiah(draft.args.amount)}. Laba sebelum ${dayLabel(draft.args.validFrom)} tetap pakai modal lama.`;
}

// Runs a stored draft once. Called for a tapped "Ya" (by code) and for a typed "ya" (confirmDraft).
export async function runDraft(db: Db, run: DraftRun): Promise<DraftOutcome> {
  const { businessId, draftId, now } = run;
  const claim = await claimDraft(db, { businessId, draftId, now });

  if (claim.status === "done") return { status: "already_done", message: NOT_RUN.done };

  if (claim.status !== "claimed") return { status: "none", message: NOT_RUN[claim.status] };

  try {
    const stored = storedDraftSchema.parse({ kind: claim.draft.kind, args: claim.draft.args });
    const message = await execute(db, run, stored);
    await finishDraft(db, draftId, { status: "done", outcome: { message } });

    return { status: "done", message };
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    console.error("draft failed:", reason);
    await finishDraft(db, draftId, { status: "failed", outcome: { error: reason } });

    // A schedule rule broken since the draft (a duplicate, too many) or a sheet Thya can no
    // longer write is told as it is.
    const told = error instanceof ScheduleError || error instanceof SheetActionError;

    return { status: "failed", message: told ? error.message : FAILED };
  }
}

export async function cancelOpenDraft(
  db: Db,
  { businessId, draftId, now }: { businessId: string; draftId: string; now: Date },
): Promise<DraftOutcome> {
  if (await cancelDraft(db, { businessId, draftId, now }))
    return { status: "done", message: CANCELLED };

  // "Sebutkan lagi" on a saved card would get the same sale recorded twice.
  return (await findDraft(db, businessId, draftId))?.status === "done"
    ? { status: "already_done", message: SAVED_NOT_CANCELLED }
    : { status: "none", message: NOT_RUN.cancelled };
}

// `ownerWroteAt`: when the owner wrote the earliest message this turn answers.
export function dbDraftPort(
  db: Db,
  {
    businessId,
    traceId,
    now,
    sheets,
    ownerWroteAt,
  }: {
    businessId: string;
    traceId: string;
    now: Date;
    sheets?: SheetsAccess | null;
    ownerWroteAt: Date;
  },
): DraftPort {
  // A retry redrafts over this turn's own draft, yet the owner's card it took over is still gone.
  let tookOver: string | null = null;

  const latestWithCard = async () => {
    const latest = await latestDraft(db, businessId, now);

    return latest && { ...latest, card: await cardView(db, latest, { traceId, ownerWroteAt }) };
  };

  return {
    create: async ({ kind, args, summary }) => {
      const { draft, replaced } = await createDraft(db, {
        businessId,
        kind,
        args,
        summary,
        traceId,
        now,
      });

      tookOver = replaced?.summary ?? tookOver;

      return { draftId: draft.id, replaced: tookOver };
    },

    confirmOpen: async () => {
      const decision = decideConfirm(await latestWithCard());

      return "run" in decision
        ? runDraft(db, { businessId, draftId: decision.run.id, now, sheets })
        : decision;
    },

    checkLatest: async () => draftCheck(await latestWithCard()),

    endTurn: async () => {
      const kept = await keepTurnDraft(db, { businessId, traceId, now });

      return kept && { draftId: kept.id, summary: kept.summary };
    },

    listSchedules: async () =>
      (await listActiveSchedules(db, businessId)).map((row) => {
        const spec = specOf(row);

        return {
          id: row.id,
          summary: scheduleSummary(spec),
          nextRun: runLabel(row.nextRunAt),
          spec,
        };
      }),

    cancelOpen: async () => {
      const open = await openDraft(db, businessId, now);

      return open === null
        ? NOTHING_OPEN
        : cancelOpenDraft(db, { businessId, draftId: open.id, now });
    },
  };
}

export function attachmentPort(db: Db, businessId: string, now: Date): AttachmentPort {
  return { save: (kind, png) => saveAttachment(db, { businessId, kind, png, now }) };
}
