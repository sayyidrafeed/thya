import { formatCount, formatRupiah } from "../../sales/format";
import {
  addDays,
  DELIVERY_CHANNEL_NAMES,
  formatDateId,
  weekdayName,
  type DeliveryChannel,
} from "../../sales/report";
import { resolveDate, type RawDeliveryDay } from "../payments-import";

// Validation, dedupe and card text for a delivery app's sales screenshot, all by code (the S9
// pattern). One row per app per WIB day; a day already stored is never counted twice.

export const MAX_CHANNEL_DAY_SALES = 50_000_000;
export const MAX_CHANNEL_AGE_DAYS = 90;
const MAX_ORDERS_PER_DAY = 5_000;
const MAX_CARD_DAYS = 7;

export type ChannelSaleRow = {
  date: string;
  grossSales: number;
  netReceived: number | null;
  orderCount: number | null;
  sourceRow: number;
};

export type StoredChannelSale = { date: string; grossSales: number; netReceived: number | null };

export type ChannelImportPlan = {
  toInsert: ChannelSaleRow[];
  alreadyRecorded: ChannelSaleRow[];
  // Same app and day already stored with other figures: kept as stored, shown on the card.
  conflicting: { row: ChannelSaleRow; stored: StoredChannelSale }[];
  card: string;
  historyNote: string;
};

const isWhole = (value: number, max: number) =>
  Number.isInteger(value) && value >= 0 && value <= max;

function skipReason(date: string | null, grossSales: number, today: string): string | null {
  if (!isWhole(grossSales, MAX_CHANNEL_DAY_SALES)) return "angka tidak wajar";

  if (date === null) return "tanggal tidak terbaca";

  if (date > today) return "tanggal di masa depan";

  if (date < addDays(today, -MAX_CHANNEL_AGE_DAYS))
    return `lebih dari ${MAX_CHANNEL_AGE_DAYS} hari lalu`;

  return null;
}

// A net above gross or a broken order count is dropped, never guessed; the day stays.
function cleanRow(day: RawDeliveryDay, date: string, sourceRow: number) {
  const netOk = day.netReceived !== null && isWhole(day.netReceived, day.grossSales);
  const ordersOk = day.orderCount !== null && isWhole(day.orderCount, MAX_ORDERS_PER_DAY);

  return {
    row: {
      date,
      grossSales: day.grossSales,
      netReceived: netOk ? day.netReceived : null,
      orderCount: ordersOk ? day.orderCount : null,
      sourceRow,
    },
    droppedNet: day.netReceived !== null && !netOk,
  };
}

const dayText = (date: string) => `${weekdayName(date)}, ${formatDateId(date)}`;

function rowLine(row: ChannelSaleRow): string {
  return [
    `- ${dayText(row.date)}: ${formatRupiah(row.grossSales)}`,
    ...(row.orderCount === null ? [] : [`${formatCount(row.orderCount)} pesanan`]),
    ...(row.netReceived === null ? [] : [`diterima ${formatRupiah(row.netReceived)}`]),
  ].join(", ");
}

function countReasons(reasons: string[]): string {
  const counts = new Map<string, number>();

  for (const reason of reasons) counts.set(reason, (counts.get(reason) ?? 0) + 1);

  return [...counts].map(([reason, count]) => `${count} ${reason}`).join(", ");
}

function cardLines(
  name: string,
  plan: Omit<ChannelImportPlan, "card" | "historyNote">,
  { skipped, droppedNet }: { skipped: string[]; droppedNet: number },
): string[] {
  const { toInsert, alreadyRecorded, conflicting } = plan;
  const total = toInsert.reduce((sum, row) => sum + row.grossSales, 0);
  const listed = toInsert.slice(0, MAX_CARD_DAYS);

  return [
    toInsert.length > 0
      ? `Dari screenshot ${name}: ${toInsert.length} hari, penjualan kotor total ${formatRupiah(total)}.`
      : `Dari screenshot ${name} ini tidak ada penjualan baru untuk dicatat.`,
    ...listed.map(rowLine),
    ...(toInsert.length > listed.length
      ? [`- dan ${toInsert.length - listed.length} hari lain`]
      : []),
    ...(alreadyRecorded.length > 0
      ? [`${alreadyRecorded.length} hari sudah tercatat sebelumnya.`]
      : []),
    ...conflicting.map(
      ({ row, stored }) =>
        `${dayText(row.date)} sudah tercatat ${formatRupiah(stored.grossSales)}, di screenshot ${formatRupiah(row.grossSales)}. Tidak diganti.`,
    ),
    ...(skipped.length > 0 ? [`Tidak dicatat: ${countReasons(skipped)}.`] : []),
    ...(droppedNet > 0
      ? [`${droppedNet} angka uang diterima tidak wajar (lebih dari penjualan), tidak dipakai.`]
      : []),
    ...(toInsert.length > 0 ? ["Dicatat terpisah dari omzet menu. Simpan?"] : []),
  ];
}

export function planChannelImport(
  days: RawDeliveryDay[],
  stored: StoredChannelSale[],
  { channel, imageSeen, today }: { channel: DeliveryChannel; imageSeen: boolean; today: string },
): ChannelImportPlan {
  const name = DELIVERY_CHANNEL_NAMES[channel];

  if (imageSeen)
    return {
      toInsert: [],
      alreadyRecorded: [],
      conflicting: [],
      card: "Screenshot ini sudah pernah dicatat, Kak. Tidak ada yang ditambahkan.",
      historyNote: `Pemilik mengirim ulang screenshot ${name} yang sudah pernah dicatat.`,
    };

  const storedByDate = new Map(stored.map((sale) => [sale.date, sale]));
  const seen = new Set<string>();
  const skipped: string[] = [];
  let droppedNet = 0;

  const plan: Omit<ChannelImportPlan, "card" | "historyNote"> = {
    toInsert: [],
    alreadyRecorded: [],
    conflicting: [],
  };

  for (const [index, day] of days.entries()) {
    const date = resolveDate(day, today);
    const reason = skipReason(date, day.grossSales, today);

    if (reason !== null || date === null) {
      skipped.push(reason ?? "tanggal tidak terbaca");
      continue;
    }

    // One picture listing a day twice disagrees with itself; neither copy is trusted.
    if (seen.has(date)) {
      skipped.push("tanggal dobel");
      continue;
    }

    seen.add(date);

    const cleaned = cleanRow(day, date, index);
    const existing = storedByDate.get(date);

    if (cleaned.droppedNet) droppedNet += 1;

    if (existing === undefined) plan.toInsert.push(cleaned.row);
    else if (existing.grossSales === cleaned.row.grossSales) plan.alreadyRecorded.push(cleaned.row);
    else plan.conflicting.push({ row: cleaned.row, stored: existing });
  }

  const total = plan.toInsert.reduce((sum, row) => sum + row.grossSales, 0);

  return {
    ...plan,
    card: cardLines(name, plan, { skipped, droppedNet }).join("\n"),
    historyNote:
      plan.toInsert.length > 0
        ? `Pemilik mengirim screenshot ${name}; ${plan.toInsert.length} hari penjualan (${formatRupiah(total)}) disiapkan untuk dicek.`
        : `Pemilik mengirim screenshot ${name}; tidak ada penjualan baru untuk dicatat.`,
  };
}
