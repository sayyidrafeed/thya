import { and, eq, gte } from "drizzle-orm";
import type { Db } from "../../db/client";
import { payments } from "../../db/schema";
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
