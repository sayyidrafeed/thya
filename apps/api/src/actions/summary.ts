import { formatRupiah } from "../sales/format";
import { formatDateId, weekdayName } from "../sales/report";
import type { MenuCostArgs, SalesRecordArgs } from "./kinds";

// Draft cards and results are written by code, so every number the owner confirms is exact.

export const dayLabel = (date: string) => `${weekdayName(date)}, ${formatDateId(date)}`;

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

export function menuCostSummary(args: MenuCostArgs): string {
  return `Modal per porsi ${args.name} jadi ${formatRupiah(args.amount)} mulai ${dayLabel(args.validFrom)} (${COST_SOURCE_LABEL[args.source]}${packagingNote(args.includesPackaging)}).`;
}
