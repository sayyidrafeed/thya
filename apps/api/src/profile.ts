import type { Db } from "./db/client";
import { listActiveSchedules, scheduleSummary, specOf } from "./modules/schedules";
import { formatRupiah } from "./sales/format";
import { formatDateId, jakartaDate } from "./sales/report";
import { menuProfile, type MenuProfileItem } from "./sales/repository";

// Engine-plan B2: the profile block is rendered from tables on every turn, never remembered as text.

const COST_SOURCE: Record<NonNullable<MenuProfileItem["cost"]>["source"], string> = {
  owner: "dari Kakak",
  recipe: "dihitung dari harga belanja",
  estimate: "perkiraan",
  seed: "data contoh",
};

function menuLine({ name, price, cost }: MenuProfileItem): string {
  const costText = cost
    ? `modal per porsi ${formatRupiah(cost.amount)} (${COST_SOURCE[cost.source]}, sejak ${formatDateId(cost.validFrom)})`
    : "modal per porsi belum dicatat";

  return `- ${name}: harga jual ${formatRupiah(price)}, ${costText}`;
}

export async function renderProfile(db: Db, businessId: string, now: Date): Promise<string | null> {
  const menu = await menuProfile(db, businessId, jakartaDate(now));
  const schedules = await listActiveSchedules(db, businessId);

  const lines = [
    ...(menu.length > 0 ? ["Menu:", ...menu.map(menuLine)] : []),
    ...(schedules.length > 0
      ? ["Jadwal aktif:", ...schedules.map((row) => `- ${scheduleSummary(specOf(row))}`)]
      : []),
  ];

  return lines.length > 0 ? lines.join("\n") : null;
}
