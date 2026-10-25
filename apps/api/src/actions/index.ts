import type { Db } from "../db/client";
import {
  cancelDraft,
  claimDraft,
  createDraft,
  finishDraft,
  openDraft,
  type Claim,
} from "../modules/drafts";
import { formatRupiah } from "../sales/format";
import { recordChatSales, setMenuCost } from "../sales/repository";
import { dayLabel } from "./summary";
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

async function execute(db: Db, businessId: string, draftId: string, draft: StoredDraft) {
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
    const message = await execute(db, businessId, draftId, stored);
    await finishDraft(db, draftId, { status: "done", outcome: { message } });

    return { status: "done", message };
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    console.error("draft failed:", reason);
    await finishDraft(db, draftId, { status: "failed", outcome: { error: reason } });

    return { status: "failed", message: FAILED };
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

    cancelOpen: async () => {
      const open = await openDraft(db, businessId, now);

      return open === null
        ? { status: "none", message: NOTHING_OPEN }
        : cancelOpenDraft(db, { businessId, draftId: open.id, now });
    },
  };
}
