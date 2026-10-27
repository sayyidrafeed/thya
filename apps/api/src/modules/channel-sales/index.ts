import { and, asc, eq, gte, lte } from "drizzle-orm";
import type { Db } from "../../db/client";
import { channelCommissions, channelSales } from "../../db/schema";
import type { ChannelCommission, ChannelSaleDay, DeliveryChannel } from "../../sales/report";
import type { ChannelSaleRow, StoredChannelSale } from "./plan";

export {
  MAX_CHANNEL_AGE_DAYS,
  MAX_CHANNEL_DAY_SALES,
  planChannelImport,
  type ChannelImportPlan,
  type ChannelSaleRow,
  type StoredChannelSale,
} from "./plan";

// Every stored day up to `today`, for the channel comparison. Read regardless of
// DELIVERY_IMPORT_ENABLED, which only gates new imports (same rule as QRIS money in).
export async function channelSaleDays(
  db: Db,
  businessId: string,
  today: string,
): Promise<ChannelSaleDay[]> {
  return db
    .select({
      channel: channelSales.channel,
      date: channelSales.soldOn,
      grossSales: channelSales.grossSales,
      netReceived: channelSales.netReceived,
      orderCount: channelSales.orderCount,
    })
    .from(channelSales)
    .where(and(eq(channelSales.businessId, businessId), lte(channelSales.soldOn, today)))
    .orderBy(asc(channelSales.soldOn), asc(channelSales.channel));
}

export async function commissionRates(db: Db, businessId: string): Promise<ChannelCommission[]> {
  return db
    .select({
      channel: channelCommissions.channel,
      rateBps: channelCommissions.rateBps,
      feePerOrder: channelCommissions.feePerOrder,
    })
    .from(channelCommissions)
    .where(eq(channelCommissions.businessId, businessId));
}

export async function storedChannelSales(
  db: Db,
  { businessId, channel, since }: { businessId: string; channel: DeliveryChannel; since: string },
): Promise<StoredChannelSale[]> {
  return db
    .select({
      date: channelSales.soldOn,
      grossSales: channelSales.grossSales,
      netReceived: channelSales.netReceived,
    })
    .from(channelSales)
    .where(
      and(
        eq(channelSales.businessId, businessId),
        eq(channelSales.channel, channel),
        gte(channelSales.soldOn, since),
      ),
    );
}

export async function channelImageSeen(
  db: Db,
  businessId: string,
  imageSha256: string,
): Promise<boolean> {
  return (
    (await db.$count(
      channelSales,
      and(eq(channelSales.businessId, businessId), eq(channelSales.imageSha256, imageSha256)),
    )) > 0
  );
}

// The unique (business, app, day) index makes a retried or repeated import add nothing.
export async function insertChannelSales(
  db: Db,
  {
    businessId,
    draftId,
    channel,
    imageSha256,
    rows,
  }: {
    businessId: string;
    draftId: string;
    channel: DeliveryChannel;
    imageSha256: string;
    rows: ChannelSaleRow[];
  },
): Promise<number> {
  if (rows.length === 0) return 0;

  const inserted = await db
    .insert(channelSales)
    .values(
      rows.map((row) => ({
        businessId,
        channel,
        soldOn: row.date,
        grossSales: row.grossSales,
        netReceived: row.netReceived,
        orderCount: row.orderCount,
        source: "screenshot" as const,
        imageSha256,
        sourceRow: row.sourceRow,
        draftId,
      })),
    )
    .onConflictDoNothing()
    .returning({ id: channelSales.id });

  return inserted.length;
}

// One rate per app: the newest the owner confirmed replaces the old one for every day.
export async function setCommission(
  db: Db,
  {
    businessId,
    draftId,
    commission,
    now,
  }: { businessId: string; draftId: string; commission: ChannelCommission; now: Date },
) {
  const values = { rateBps: commission.rateBps, feePerOrder: commission.feePerOrder, draftId };

  await db
    .insert(channelCommissions)
    .values({ businessId, channel: commission.channel, ...values, updatedAt: now })
    .onConflictDoUpdate({
      target: [channelCommissions.businessId, channelCommissions.channel],
      set: { ...values, updatedAt: now },
    });
}
