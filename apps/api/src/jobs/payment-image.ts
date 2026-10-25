import type { LanguageModel } from "ai";
import { dbDraftPort } from "../actions";
import type { TurnDraft } from "../agent";
import { WhatsAppError, type WhatsAppClient } from "../channels/whatsapp/client";
import type { Db } from "../db/client";
import {
  extractPayments,
  imageSeen,
  MAX_PAYMENT_AGE_DAYS,
  planPaymentsImport,
  storedPaymentsSince,
} from "../modules/payments-import";
import { formatRupiah } from "../sales/format";
import { jakartaDate } from "../sales/report";

// Business-features-plan S9, behind gate G11. The picture goes to one extraction call and is then
// dropped; only its hash, the rows and the card stay. Saving needs the "Ya" button.

export type PaymentImageDeps = { db: Db; model: LanguageModel; client: WhatsAppClient };

export type PaymentImageResult = { reply: string; draft: TurnDraft | null; note: string };

const WRONG_FILE = "Thya baru bisa membaca gambar JPG atau PNG di bawah 5 MB, Kak.";

const DAY_MS = 24 * 60 * 60 * 1000;

function settlementReply(settlement: {
  periodLabel: string | null;
  transactionCount: number | null;
  grossAmount: number | null;
  feeAmount: number | null;
  netAmount: number | null;
}): string {
  // Figures as printed on the picture, never computed (S9: settlement is shown, not stored).
  const parts = [
    settlement.transactionCount === null ? null : `${settlement.transactionCount} transaksi`,
    settlement.grossAmount === null ? null : `kotor ${formatRupiah(settlement.grossAmount)}`,
    settlement.feeAmount === null ? null : `biaya ${formatRupiah(settlement.feeAmount)}`,
    settlement.netAmount === null ? null : `diterima ${formatRupiah(settlement.netAmount)}`,
  ].filter((part) => part !== null);

  return [
    `Ini rincian pencairan${settlement.periodLabel ? ` ${settlement.periodLabel}` : ""}: ${parts.join(", ")}.`,
    "Pencairan belum dicatat terpisah. Kalau mau dicatat per pembayaran, kirim screenshot riwayat transaksinya ya Kak.",
  ].join("\n");
}

export async function readPaymentImage(
  deps: PaymentImageDeps,
  {
    businessId,
    mediaId,
    now,
    traceId,
  }: { businessId: string; mediaId: string; now: Date; traceId: string },
): Promise<PaymentImageResult> {
  let image: Awaited<ReturnType<WhatsAppClient["downloadImage"]>>;

  try {
    image = await deps.client.downloadImage(mediaId);
  } catch (error) {
    // A retryable failure retries the job; anything else is answered, never left hanging.
    if (!(error instanceof WhatsAppError) || error.retryable) throw error;

    image = null;
  }

  if (image === null)
    return {
      reply: WRONG_FILE,
      draft: null,
      note: "Pemilik mengirim berkas yang tidak bisa dibaca.",
    };

  const sha256 = new Bun.CryptoHasher("sha256").update(image.bytes).digest("hex");
  const today = jakartaDate(now);

  const extraction = await extractPayments(image.bytes, {
    model: deps.model,
    mediaType: image.mediaType,
    today,
  });

  if (extraction.status !== "ok")
    return {
      reply: extraction.message,
      draft: null,
      note: "Pemilik mengirim gambar; tidak ada pembayaran yang terbaca.",
    };

  if (extraction.documentKind === "settlement" && extraction.settlement !== null)
    return {
      reply: settlementReply(extraction.settlement),
      draft: null,
      note: "Pemilik mengirim screenshot pencairan; ditampilkan, tidak dicatat.",
    };

  const plan = planPaymentsImport(
    extraction.rows,
    await storedPaymentsSince(
      deps.db,
      businessId,
      new Date(now.getTime() - (MAX_PAYMENT_AGE_DAYS + 1) * DAY_MS),
    ),
    {
      imageSeen: await imageSeen(deps.db, businessId, sha256),
      bank: extraction.documentKind === "bank_statement",
      today,
      shownTotal: extraction.shownTotal,
    },
  );

  if (plan.toInsert.length === 0) return { reply: plan.card, draft: null, note: plan.historyNote };

  const { draftId } = await dbDraftPort(deps.db, { businessId, traceId, now }).create({
    kind: "payments.import",
    args: { imageSha256: sha256, rows: plan.toInsert },
    summary: plan.card,
  });

  return {
    reply: "Thya sudah baca screenshotnya. Cek dulu ya Kak, lalu tekan Ya, Ubah, atau Batal.",
    draft: { draftId, summary: plan.card },
    note: plan.historyNote,
  };
}
