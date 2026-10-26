import { and, asc, eq, gte, lte, sql } from "drizzle-orm";
import type { Db } from "../../db/client";
import { payments } from "../../db/schema";
import type { PaymentDay } from "../../sales/report";
import type { PaymentRow, StoredPayment } from "./plan";

export {
  EXTRACTION_REPLIES,
  extractPayments,
  normalizeExtraction,
  PAYMENT_METHODS,
  resolveDate,
  type ExtractedRow,
  type Extraction,
  type PaymentMethod,
} from "./extract";

export {
  MAX_PAYMENT_AGE_DAYS,
  planPaymentsImport,
  type PaymentRow,
  type PaymentsPlan,
  type StoredPayment,
} from "./plan";

export async function storedPaymentsSince(
  db: Db,
  businessId: string,
  since: Date,
): Promise<StoredPayment[]> {
  return db
    .select({ paidAt: payments.paidAt, amount: payments.amount, sourceRef: payments.sourceRef })
    .from(payments)
    .where(and(eq(payments.businessId, businessId), gte(payments.paidAt, since)));
}

// Money in up to `now`, per WIB day: what the "uang masuk QRIS" metric and the recaps read (G10).
// Read regardless of PAYMENTS_IMPORT_ENABLED, which only gates new imports.
export async function paymentDays(db: Db, businessId: string, now: Date): Promise<PaymentDay[]> {
  const day = sql<string>`to_char(${payments.paidAt} at time zone 'Asia/Jakarta', 'YYYY-MM-DD')`;

  return db
    .select({ date: day, amount: sql<number>`cast(sum(${payments.amount}) as integer)` })
    .from(payments)
    .where(and(eq(payments.businessId, businessId), lte(payments.paidAt, now)))
    .groupBy(day)
    .orderBy(asc(day));
}

export async function imageSeen(db: Db, businessId: string, imageSha256: string): Promise<boolean> {
  return (
    (await db.$count(
      payments,
      and(eq(payments.businessId, businessId), eq(payments.imageSha256, imageSha256)),
    )) > 0
  );
}

// S9-AC5/AC6: both unique indexes make a retried or repeated import add nothing.
export async function insertPayments(
  db: Db,
  {
    businessId,
    draftId,
    imageSha256,
    rows,
  }: { businessId: string; draftId: string; imageSha256: string; rows: PaymentRow[] },
) {
  if (rows.length === 0) return 0;

  const inserted = await db
    .insert(payments)
    .values(
      rows.map((row) => ({
        businessId,
        paidAt: new Date(row.paidAt),
        amount: row.amount,
        method: row.method,
        source: "screenshot" as const,
        sourceRef: row.sourceRef,
        imageSha256,
        sourceRow: row.sourceRow,
        draftId,
      })),
    )
    .onConflictDoNothing()
    .returning({ id: payments.id });

  return inserted.length;
}
