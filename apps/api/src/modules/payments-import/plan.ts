import { formatRupiah } from "../../sales/format";
import { addDays, formatDateId } from "../../sales/report";
import type { ExtractedRow, PaymentMethod } from "./extract";

// S9 validation, dedupe and card text, all by code. Only money in that succeeded is imported;
// everything else is named on the card so the owner sees what was left out and why.

export const MAX_PAYMENT_AMOUNT = 50_000_000;
export const MAX_PAYMENT_AGE_DAYS = 90;

export type PaymentRow = {
  paidAt: string;
  amount: number;
  method: PaymentMethod;
  sourceRef: string | null;
  sourceRow: number;
};

// What is already stored, for matching. Bank rows without an hour are stored at 00:00 WIB.
export type StoredPayment = { paidAt: Date; amount: number; sourceRef: string | null };

export type PaymentsPlan = {
  toInsert: PaymentRow[];
  alreadyRecorded: ExtractedRow[];
  maybeDuplicate: ExtractedRow[];
  card: string;
  historyNote: string;
};

const METHOD: Record<ExtractedRow["method"], PaymentMethod> = {
  qris: "qris",
  gopay: "gopay",
  transfer: "transfer",
  cash_deposit: "lainnya",
  fee: "lainnya",
  other: "lainnya",
};

type Skip = { row: ExtractedRow; reason: string };

function skipReason(
  row: ExtractedRow,
  { bank, today }: { bank: boolean; today: string },
): string | null {
  if (row.direction === "out") return "uang keluar (refund/biaya)";

  if (row.status === "failed") return "gagal";

  if (row.status !== "success") return "belum berhasil";

  if (bank && row.method !== "qris") return "bukan QRIS";

  if (!Number.isInteger(row.amount) || row.amount <= 0 || row.amount > MAX_PAYMENT_AMOUNT)
    return "nominal tidak wajar";

  if (row.date === null) return "tanggal tidak terbaca";

  if (row.date > today) return "tanggal di masa depan";

  if (row.date < addDays(today, -MAX_PAYMENT_AGE_DAYS))
    return `lebih dari ${MAX_PAYMENT_AGE_DAYS} hari lalu`;

  return null;
}

const wibInstant = (date: string, time: string | null) =>
  new Date(`${date}T${time ?? "00:00"}:00+07:00`);

const dayOf = (instant: Date) =>
  new Date(instant.getTime() + 7 * 60 * 60 * 1000).toISOString().slice(0, 10);

const minuteOf = (instant: Date) =>
  new Date(instant.getTime() + 7 * 60 * 60 * 1000).toISOString().slice(11, 16);

function countBy<T>(items: T[], key: (item: T) => string) {
  const counts = new Map<string, number>();

  for (const item of items) counts.set(key(item), (counts.get(key(item)) ?? 0) + 1);

  return counts;
}

function summarizeSkips(skips: Skip[]): string[] {
  return [...countBy(skips, (skip) => skip.reason)].map(([reason, count]) => `${count} ${reason}`);
}

function cardLines({
  toInsert,
  alreadyRecorded,
  maybeDuplicate,
  skips,
  shownTotal,
  readTotal,
}: {
  toInsert: PaymentRow[];
  alreadyRecorded: ExtractedRow[];
  maybeDuplicate: ExtractedRow[];
  skips: Skip[];
  shownTotal: number | null;
  readTotal: number;
}): string[] {
  const dates = [...new Set(toInsert.map((row) => dayOf(new Date(row.paidAt))))].sort();
  const total = toInsert.reduce((sum, row) => sum + row.amount, 0);
  const when = dates.length === 0 ? "" : ` ${dates.map((date) => formatDateId(date)).join(", ")}`;

  return [
    toInsert.length > 0
      ? `Dari screenshot${when}: ${toInsert.length} pembayaran masuk, total ${formatRupiah(total)}.`
      : "Dari screenshot ini tidak ada pembayaran baru untuk dicatat.",
    ...(alreadyRecorded.length > 0 ? [`${alreadyRecorded.length} sudah tercatat sebelumnya.`] : []),
    ...(maybeDuplicate.length > 0
      ? [
          `${maybeDuplicate.length} mungkin sudah tercatat (tanggal, jam, dan nominal sama), tidak dicatat lagi.`,
        ]
      : []),
    ...(skips.length > 0 ? [`Tidak dicatat: ${summarizeSkips(skips).join(", ")}.`] : []),
    ...(shownTotal !== null && shownTotal !== readTotal
      ? [
          `Total di gambar ${formatRupiah(shownTotal)}, yang terbaca ${formatRupiah(readTotal)}. Cek dulu ya, mungkin screenshot terpotong.`,
        ]
      : []),
    ...(toInsert.length > 0 ? ["Simpan?"] : []),
  ];
}

export function planPaymentsImport(
  rows: ExtractedRow[],
  stored: StoredPayment[],
  {
    imageSeen,
    bank,
    today,
    shownTotal,
  }: { imageSeen: boolean; bank: boolean; today: string; shownTotal: number | null },
): PaymentsPlan {
  const skips: Skip[] = [];
  const candidates: (ExtractedRow & { date: string })[] = [];

  for (const row of rows) {
    const reason = skipReason(row, { bank, today });

    if (reason !== null || row.date === null)
      skips.push({ row, reason: reason ?? "tanggal tidak terbaca" });
    else candidates.push({ ...row, date: row.date });
  }

  const readTotal = candidates.reduce((sum, row) => sum + row.amount, 0);

  if (imageSeen)
    return {
      toInsert: [],
      alreadyRecorded: candidates,
      maybeDuplicate: [],
      card: "Screenshot ini sudah pernah dicatat, Kak. Tidak ada yang ditambahkan.",
      historyNote:
        "Pemilik mengirim ulang screenshot yang sudah pernah dicatat; tidak ada pembayaran baru.",
    };

  const references = new Set(
    stored.flatMap((payment) => (payment.sourceRef ? [payment.sourceRef] : [])),
  );

  const timed = countBy(
    stored,
    (payment) => `${dayOf(payment.paidAt)}|${minuteOf(payment.paidAt)}|${payment.amount}`,
  );

  const daily = countBy(stored, (payment) => `${dayOf(payment.paidAt)}|${payment.amount}`);

  const toInsert: PaymentRow[] = [];
  const alreadyRecorded: ExtractedRow[] = [];
  const maybeDuplicate: ExtractedRow[] = [];

  for (const row of candidates) {
    // (a) same reference = recorded; (b) same date, minute and amount = maybe; (c) rows without
    // an hour match as a multiset of (date, amount), so two Rp18.000 against one stored adds one.
    const key = row.time ? `${row.date}|${row.time}|${row.amount}` : `${row.date}|${row.amount}`;
    const pool = row.time ? timed : daily;
    const left = pool.get(key) ?? 0;

    if (row.reference !== null && references.has(row.reference)) alreadyRecorded.push(row);
    else if (left > 0) {
      pool.set(key, left - 1);
      maybeDuplicate.push(row);
    } else
      toInsert.push({
        paidAt: wibInstant(row.date, row.time).toISOString(),
        amount: row.amount,
        method: METHOD[row.method],
        sourceRef: row.reference,
        sourceRow: row.sourceRow,
      });
  }

  const lines = cardLines({
    toInsert,
    alreadyRecorded,
    maybeDuplicate,
    skips,
    shownTotal,
    readTotal,
  });

  const total = toInsert.reduce((sum, row) => sum + row.amount, 0);

  return {
    toInsert,
    alreadyRecorded,
    maybeDuplicate,
    card: lines.join("\n"),
    historyNote:
      toInsert.length > 0
        ? `Pemilik mengirim screenshot; ${toInsert.length} pembayaran (${formatRupiah(total)}) disiapkan untuk dicek.`
        : "Pemilik mengirim screenshot; tidak ada pembayaran baru untuk dicatat.",
  };
}
