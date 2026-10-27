import { and, eq, inArray, min, sql } from "drizzle-orm";
import type { Db } from "../../db/client";
import { menuCosts, menuItems, sheetConnections, transactions } from "../../db/schema";
import { formatDateId } from "../../sales/report";
import { executeSheetAppend } from "./connect";
import {
  SheetActionError,
  storedConnectionSchema,
  type SheetAppendArgs,
  type SheetImportArgs,
  type SheetPort,
  type SheetsAccess,
  type StoredConnection,
} from "./drafts";

// sheet_connections (one active per business) and the two sheet draft executors.

const shortDate = (date: string) => formatDateId(date).replace(/ \d{4}$/, "");

export async function activeConnection(
  db: Db,
  businessId: string,
): Promise<StoredConnection | null> {
  const [row] = await db
    .select()
    .from(sheetConnections)
    .where(and(eq(sheetConnections.businessId, businessId), eq(sheetConnections.status, "active")));

  return row ? storedConnectionSchema.parse(row) : null;
}

// Features S5 (default for the final): a newly connected sheet replaces the active one.
export async function saveConnection(db: Db, businessId: string, connection: StoredConnection) {
  await db
    .insert(sheetConnections)
    .values({ businessId, ...connection })
    .onConflictDoUpdate({
      target: sheetConnections.businessId,
      targetWhere: sql`${sheetConnections.status} = 'active'`,
      set: connection,
    });
}

export async function markConnectionBroken(db: Db, businessId: string, spreadsheetId: string) {
  await db
    .update(sheetConnections)
    .set({ status: "broken" })
    .where(
      and(
        eq(sheetConnections.businessId, businessId),
        eq(sheetConnections.spreadsheetId, spreadsheetId),
        eq(sheetConnections.status, "active"),
      ),
    );
}

async function importedRows(db: Db, businessId: string, sourceSheetId: string) {
  const rows = await db
    .select({ sourceRow: transactions.sourceRow })
    .from(transactions)
    .where(
      and(eq(transactions.businessId, businessId), eq(transactions.sourceSheetId, sourceSheetId)),
    );

  return new Set(rows.flatMap(({ sourceRow }) => (sourceRow === null ? [] : [sourceRow])));
}

// The first day each menu item has a cost per portion; a sale before it could not be costed.
async function costSince(db: Db, businessId: string) {
  const rows = await db
    .select({ menuItemId: menuCosts.menuItemId, since: min(menuCosts.validFrom) })
    .from(menuCosts)
    .innerJoin(menuItems, eq(menuItems.id, menuCosts.menuItemId))
    .where(eq(menuItems.businessId, businessId))
    .groupBy(menuCosts.menuItemId);

  return new Map(rows.flatMap(({ menuItemId, since }) => (since ? [[menuItemId, since]] : [])));
}

export function dbSheetPort(db: Db, businessId: string, access: SheetsAccess): SheetPort {
  return {
    access,
    activeConnection: () => activeConnection(db, businessId),
    saveConnection: (connection) => saveConnection(db, businessId, connection),
    importedRows: (sourceSheetId) => importedRows(db, businessId, sourceSheetId),
    costSince: () => costSince(db, businessId),
  };
}

const lostAccess = (email: string) =>
  `Thya nggak bisa nulis ke sheet itu, Kak. Pastikan sheet-nya masih ada dan dibagikan ke ${email} sebagai *Editor*, lalu kirim ulang linknya ya.`;

// Executor for a confirmed sheet.append draft: retries re-read the date column, so no day is
// written twice (S5-AC4).
export async function runSheetAppend(
  db: Db,
  access: SheetsAccess | null,
  { businessId, args, today }: { businessId: string; args: SheetAppendArgs; today: string },
): Promise<string> {
  if (access === null)
    throw new SheetActionError("Google Sheets belum aktif di Thya, Kak. Coba lagi nanti ya.");

  const outcome = await executeSheetAppend(access.client, args, args.values, today, access.sleep);

  if (outcome.status === "failed") {
    if (outcome.reason !== "no_access" && outcome.reason !== "not_found")
      throw new SheetActionError(outcome.message);

    await markConnectionBroken(db, businessId, args.spreadsheetId);

    throw new SheetActionError(lostAccess(access.serviceAccountEmail));
  }

  const skipped =
    outcome.skipped.length > 0
      ? ` Sudah ada sebelumnya, dilewati: ${outcome.skipped.map(shortDate).join(", ")}.`
      : "";

  if (outcome.written.length === 0)
    return `Semua tanggalnya sudah ada di sheet *${args.sheetTitle}*, Kak. Tidak ada baris baru.`;

  return `Sudah ditambahkan ke sheet *${args.sheetTitle}*, Kak: ${outcome.written.length} baris (${outcome.written.map(shortDate).join(", ")}).${skipped}`;
}

const INSERT_CHUNK = 1_000;

// Executor for a confirmed sheet.import draft. The unique (business, sheet, row) index makes a
// second run of the same rows a no-op (S6-AC2).
export async function runSheetImport(
  db: Db,
  { businessId, draftId, args }: { businessId: string; draftId: string; args: SheetImportArgs },
): Promise<string> {
  const ids = [...new Set(args.rows.map((row) => row.menuItemId))];

  const owned = await db.$count(
    menuItems,
    and(eq(menuItems.businessId, businessId), inArray(menuItems.id, ids)),
  );

  if (owned !== ids.length) throw new Error("an imported item is not on this business's menu");

  const added = await db.transaction(async (tx) => {
    let count = 0;

    for (let start = 0; start < args.rows.length; start += INSERT_CHUNK) {
      const inserted = await tx
        .insert(transactions)
        .values(
          args.rows.slice(start, start + INSERT_CHUNK).map((row) => ({
            businessId,
            menuItemId: row.menuItemId,
            soldOn: row.date,
            quantity: row.quantity,
            unitPrice: row.unitPrice,
            source: "sheet" as const,
            sourceSheetId: args.sourceSheetId,
            sourceRow: row.sourceRow,
            draftId,
          })),
        )
        .onConflictDoNothing()
        .returning({ id: transactions.id });

      count += inserted.length;
    }

    return count;
  });

  const already = args.rows.length - added;

  return already === 0
    ? `Sudah diimport, Kak: ${added} baris penjualan dari sheet *${args.sheetTitle}*.`
    : `Sudah diimport, Kak: ${added} baris baru, ${already} sudah ada sebelumnya.`;
}
