import type { LanguageModel } from "ai";
import { dbDraftPort } from "../actions";
import type { TurnDraft } from "../agent";
import { WhatsAppError, type WhatsAppClient } from "../channels/whatsapp/client";
import type { Db } from "../db/client";
import {
  channelImageSeen,
  MAX_CHANNEL_AGE_DAYS,
  planChannelImport,
  storedChannelSales,
} from "../modules/channel-sales";
import {
  EXTRACTION_REPLIES,
  extractPayments,
  imageSeen,
  MAX_PAYMENT_AGE_DAYS,
  planPaymentsImport,
  storedPaymentsSince,
  type RawDeliveryDay,
} from "../modules/payments-import";
import { formatRupiah } from "../sales/format";
import { addDays, jakartaDate, type DeliveryChannel } from "../sales/report";

// Business-features-plan S9, behind gate G11. The picture goes to one extraction call and is then
// dropped; only its hash, the rows and the card stay. Saving needs the "Ya" button.

export type PaymentImageDeps = { db: Db; model: LanguageModel; client: WhatsAppClient };

export type PaymentImageResult = { reply: string; draft: TurnDraft | null; note: string };

// Which pictures are imported: QRIS/GoPay (PAYMENTS_IMPORT_ENABLED, gate G11) and delivery app
// sales summaries (DELIVERY_IMPORT_ENABLED). One extraction call serves both.
export type ImageImports = { payments: boolean; delivery: boolean };

const WRONG_FILE = "Thya baru bisa membaca gambar JPG atau PNG di bawah 5 MB, Kak.";

const READ_CARD =
  "Thya sudah baca screenshotnya. Cek dulu ya Kak, lalu tekan Ya, Ubah, atau Batal.";

const DELIVERY_REPLIES = {
  onlyDelivery:
    "Thya baru bisa mencatat ringkasan penjualan GoFood, GrabFood, atau ShopeeFood dari gambar, Kak. Bukti pembayaran QRIS belum bisa dicatat.",
  notSales:
    "Ini sepertinya bukan ringkasan penjualan, Kak. Kirim screenshot ringkasan penjualan per hari dari GoBiz, GrabMerchant, atau aplikasi ShopeeFood ya.",
  notEither:
    "Ini sepertinya bukan bukti transaksi atau ringkasan penjualan, Kak. Kirim screenshot riwayat GoPay Merchant, mutasi QRIS, atau ringkasan penjualan GoFood, GrabFood, atau ShopeeFood ya.",
  unknownApp:
    "Thya belum tahu ini ringkasan dari aplikasi mana, Kak. Kirim screenshot yang kelihatan nama GoFood, GrabFood, atau ShopeeFood-nya ya.",
  periodOnly:
    "Ini ringkasan beberapa hari sekaligus, Kak. Thya mencatat per hari, jadi kirim ringkasan per tanggal ya (pilih satu tanggal di aplikasinya).",
};

function notTransactionsReply({ payments, delivery }: ImageImports): string {
  if (!delivery) return EXTRACTION_REPLIES.not_transactions;

  return payments ? DELIVERY_REPLIES.notEither : DELIVERY_REPLIES.notSales;
}

async function readDeliverySales(
  deps: PaymentImageDeps,
  {
    businessId,
    now,
    traceId,
    sha256,
  }: { businessId: string; now: Date; traceId: string; sha256: string },
  { channel, days }: { channel: DeliveryChannel | null; days: RawDeliveryDay[] },
): Promise<PaymentImageResult> {
  const unread = (reply: string) => ({
    reply,
    draft: null,
    note: "Pemilik mengirim screenshot aplikasi pesan-antar; tidak ada penjualan yang bisa dicatat.",
  });

  if (channel === null) return unread(DELIVERY_REPLIES.unknownApp);

  if (days.length === 0) return unread(DELIVERY_REPLIES.periodOnly);

  const today = jakartaDate(now);

  const plan = planChannelImport(
    days,
    await storedChannelSales(deps.db, {
      businessId,
      channel,
      since: addDays(today, -(MAX_CHANNEL_AGE_DAYS + 1)),
    }),
    { channel, imageSeen: await channelImageSeen(deps.db, businessId, sha256), today },
  );

  if (plan.toInsert.length === 0) return { reply: plan.card, draft: null, note: plan.historyNote };

  const { draftId } = await dbDraftPort(deps.db, { businessId, traceId, now }).create({
    kind: "channel_sales.import",
    args: { channel, imageSha256: sha256, rows: plan.toInsert },
    summary: plan.card,
  });

  return { reply: READ_CARD, draft: { draftId, summary: plan.card }, note: plan.historyNote };
}

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
    imports,
  }: { businessId: string; mediaId: string; now: Date; traceId: string; imports: ImageImports },
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
    delivery: imports.delivery,
  });

  if (extraction.status === "delivery_sales")
    return readDeliverySales(deps, { businessId, now, traceId, sha256 }, extraction);

  if (extraction.status !== "ok")
    return {
      reply:
        extraction.status === "not_transactions"
          ? notTransactionsReply(imports)
          : extraction.message,
      draft: null,
      note: "Pemilik mengirim gambar; tidak ada pembayaran yang terbaca.",
    };

  if (!imports.payments)
    return {
      reply: DELIVERY_REPLIES.onlyDelivery,
      draft: null,
      note: "Pemilik mengirim bukti pembayaran; pencatatan pembayaran belum dinyalakan.",
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
    reply: READ_CARD,
    draft: { draftId, summary: plan.card },
    note: plan.historyNote,
  };
}
