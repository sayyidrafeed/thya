import type { AttachmentPort } from "../agent";
import type { Db } from "../db/client";
import { saveAttachment } from "../modules/attachments";
import { insertChannelSales, setCommission } from "../modules/channel-sales";
import { insertPayments } from "../modules/payments-import";
import {
  cancelDraft,
  claimDraft,
  createDraft,
  finishDraft,
  openDraft,
  type Claim,
} from "../modules/drafts";
import { formatRupiah } from "../sales/format";
import { DELIVERY_CHANNEL_NAMES } from "../sales/report";
import { recordChatSales, setMenuCost } from "../sales/repository";
import {
  cancelSchedule,
  createSchedule,
  listActiveSchedules,
  ScheduleError,
  scheduleSummary,
  specOf,
} from "../modules/schedules";
import { commissionText, dayLabel, runLabel } from "./summary";
import { storedDraftSchema, type DraftOutcome, type DraftPort, type StoredDraft } from "./kinds";

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
const NOTHING_OPEN = "Belum ada yang menunggu konfirmasi, Kak.";
const CANCELLED = "Oke Kak, dibatalkan. Tidak ada yang disimpan.";

async function execute(
  db: Db,
  { businessId, draftId, now }: { businessId: string; draftId: string; now: Date },
  draft: StoredDraft,
) {
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

    const items = draft.args.items.map((item) => `${item.quantity} ${item.name}`).join(", ");

    return `Sudah dicatat, Kak: ${items} untuk ${dayLabel(draft.args.date)}.`;
  }

  await setMenuCost(db, { businessId, draftId, args: draft.args });

  return `Sudah disimpan, Kak. Modal per porsi ${draft.args.name} sekarang ${formatRupiah(draft.args.amount)}. Laba sebelum ${dayLabel(draft.args.validFrom)} tetap pakai modal lama.`;
}

// Runs a stored draft once. Called for a tapped "Ya" (by code) and for a typed "ya" (confirmDraft).
export async function runDraft(
  db: Db,
  { businessId, draftId, now }: { businessId: string; draftId: string; now: Date },
): Promise<DraftOutcome> {
  const claim = await claimDraft(db, { businessId, draftId, now });

  if (claim.status !== "claimed") return { status: "none", message: NOT_RUN[claim.status] };

  try {
    const stored = storedDraftSchema.parse({ kind: claim.draft.kind, args: claim.draft.args });
    const message = await execute(db, { businessId, draftId, now }, stored);
    await finishDraft(db, draftId, { status: "done", outcome: { message } });

    return { status: "done", message };
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    console.error("draft failed:", reason);
    await finishDraft(db, draftId, { status: "failed", outcome: { error: reason } });

    // A schedule rule broken since the draft (a duplicate, too many) is told as it is.
    return { status: "failed", message: error instanceof ScheduleError ? error.message : FAILED };
  }
}

export async function cancelOpenDraft(
  db: Db,
  { businessId, draftId, now }: { businessId: string; draftId: string; now: Date },
): Promise<DraftOutcome> {
  return (await cancelDraft(db, { businessId, draftId, now }))
    ? { status: "done", message: CANCELLED }
    : { status: "none", message: NOT_RUN.cancelled };
}

export function dbDraftPort(
  db: Db,
  { businessId, traceId, now }: { businessId: string; traceId: string; now: Date },
): DraftPort {
  return {
    create: async ({ kind, args, summary }) => {
      const draft = await createDraft(db, { businessId, kind, args, summary, traceId, now });

      return { draftId: draft.id };
    },

    confirmOpen: async () => {
      const open = await openDraft(db, businessId, now);

      return open === null
        ? { status: "none", message: NOTHING_OPEN }
        : runDraft(db, { businessId, draftId: open.id, now });
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
        ? { status: "none", message: NOTHING_OPEN }
        : cancelOpenDraft(db, { businessId, draftId: open.id, now });
    },
  };
}

export function attachmentPort(db: Db, businessId: string, now: Date): AttachmentPort {
  return { save: (kind, png) => saveAttachment(db, { businessId, kind, png, now }) };
}
