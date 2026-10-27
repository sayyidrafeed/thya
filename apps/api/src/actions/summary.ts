import { formatPercent, formatRupiah } from "../sales/format";
import {
  DELIVERY_CHANNEL_NAMES,
  formatDateId,
  jakartaDate,
  jakartaTime,
  weekdayName,
  type ChannelCommission,
} from "../sales/report";
import type { MenuCostArgs, SalesRecordArgs } from "./kinds";

// Draft cards and results are written by code, so every number the owner confirms is exact.

export const dayLabel = (date: string) => `${weekdayName(date)}, ${formatDateId(date)}`;

export const runLabel = (instant: Date) =>
  `${dayLabel(jakartaDate(instant))} jam ${jakartaTime(instant)} WIB`;

export function salesSummary({ date, items }: SalesRecordArgs): string {
  const total = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);

  return [
    `Catat penjualan ${dayLabel(date)}:`,
    ...items.map(
      (item) =>
        `- ${item.quantity} ${item.name} x ${formatRupiah(item.unitPrice)} = ${formatRupiah(item.quantity * item.unitPrice)}`,
    ),
    `Total ${formatRupiah(total)}`,
  ].join("\n");
}

const COST_SOURCE_LABEL: Record<MenuCostArgs["source"], string> = {
  owner: "dari Kakak",
  recipe: "dihitung dari harga belanja",
  estimate: "perkiraan",
};

function packagingNote(includesPackaging: boolean | null): string {
  if (includesPackaging === null) return "";

  return includesPackaging ? ", sudah termasuk gelas/kemasan" : ", belum termasuk gelas/kemasan";
}

export function commissionText({ rateBps, feePerOrder }: ChannelCommission): string {
  const rate = formatPercent(rateBps / 100);

  return feePerOrder > 0 ? `${rate} + ${formatRupiah(feePerOrder)} per pesanan` : rate;
}

export function commissionSummary(commission: ChannelCommission): string {
  return [
    `Potongan ${DELIVERY_CHANNEL_NAMES[commission.channel]}: ${commissionText(commission)} dari penjualan kotor.`,
    "Dipakai untuk hari yang screenshot-nya tidak menulis uang yang diterima.",
  ].join("\n");
}

export function menuCostSummary(args: MenuCostArgs): string {
  return `Modal per porsi ${args.name} jadi ${formatRupiah(args.amount)} mulai ${dayLabel(args.validFrom)} (${COST_SOURCE_LABEL[args.source]}${packagingNote(args.includesPackaging)}).`;
}
