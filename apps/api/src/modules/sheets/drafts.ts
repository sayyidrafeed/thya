import { z } from "zod";
import { formatCount, formatRupiah } from "../../sales/format";
import { formatDateId, type MenuItem } from "../../sales/report";
import {
  accessInstructions,
  DAILY_METRICS,
  planSheetAppend,
  sheetFailureMessage,
  withSheetRetry,
  type DailyMetric,
  type Sleep,
} from "./connect";
import {
  createAccessTokenProvider,
  createSheetsClient,
  type Fetch,
  type ServiceAccount,
  type SheetsClient,
  type SheetsFailure,
} from "./google";
import { MAX_IMPORT_ROWS, parseImportRows, type ImportColumnNames } from "./import-rows";
import {
  columnMapSchema,
  describeHeader,
  findColumnByName,
  guessColumnMap,
  quoteTab,
  type Cell,
  type ColumnMap,
  type SheetColumn,
} from "./parse";

// Business-features S5/S6: what the sheet tools freeze into a draft, and the card the owner
// confirms. Nothing here writes; the executors in repository.ts run after "Ya".

export type SheetsAccess = { client: SheetsClient; serviceAccountEmail: string; sleep?: Sleep };

export function createSheetsAccess(
  account: ServiceAccount,
  fetcher: Fetch = fetch,
  sleep?: Sleep,
): SheetsAccess {
  return {
    client: createSheetsClient(createAccessTokenProvider(account, fetcher), fetcher),
    serviceAccountEmail: account.client_email,
    sleep,
  };
}

export const storedConnectionSchema = z.object({
  spreadsheetId: z.string().min(1),
  sheetTitle: z.string(),
  tabId: z.number().int(),
  tabTitle: z.string(),
  columnMap: columnMapSchema.nullable(),
});

export type StoredConnection = z.infer<typeof storedConnectionSchema>;

// One business's sheet; the business id lives in the closure, never in tool input (features §4.3).
export type SheetPort = {
  access: SheetsAccess;
  activeConnection: () => Promise<StoredConnection | null>;
  saveConnection: (connection: StoredConnection) => Promise<void>;
  importedRows: (sourceSheetId: string) => Promise<ReadonlySet<number>>;
  costSince: () => Promise<ReadonlyMap<string, string>>;
};

// Errors whose message the owner reads as is when a confirmed sheet draft fails.
export class SheetActionError extends Error {}

function readFailure(access: SheetsAccess, reason: SheetsFailure) {
  const message =
    reason === "no_access" || reason === "not_found"
      ? accessInstructions(access.serviceAccountEmail)
      : sheetFailureMessage(reason);

  return { status: "error" as const, message };
}

const shortDate = (date: string) => formatDateId(date).replace(/ \d{4}$/, "");

// S5: daily totals appended to the owner's sheet.

export const MAX_APPEND_DAYS = 14;

export const sheetAppendArgs = z.object({
  spreadsheetId: z.string().min(1),
  sheetTitle: z.string(),
  tabTitle: z.string(),
  columnMap: columnMapSchema,
  metric: z.enum(DAILY_METRICS),
  values: z
    .array(z.object({ date: z.iso.date(), value: z.number().int().nonnegative() }))
    .min(1)
    .max(MAX_APPEND_DAYS),
});

export type SheetAppendArgs = z.infer<typeof sheetAppendArgs>;

export type DayTotals = { date: string; revenue: number; itemsSold: number };

export type PreparedAppend =
  | { status: "ok"; args: SheetAppendArgs; summary: string; skipped: string[] }
  | { status: "error"; message: string };

export type AppendRequest = {
  metric: DailyMetric;
  days: DayTotals[];
  // The owner's words for the columns ("Pemasukan", "kolom C"); null = guess from the header.
  dateColumn: string | null;
  valueColumn: string | null;
  today: string;
};

const METRIC_LABEL: Record<DailyMetric, string> = {
  revenue: "omzet",
  items_sold: "porsi terjual",
};

export function formatDailyValue(metric: DailyMetric, value: number): string {
  return metric === "revenue" ? formatRupiah(value) : `${formatCount(value)} porsi`;
}

type Columns =
  | { status: "ok"; date: SheetColumn; value: SheetColumn }
  | { status: "error"; message: string };

function pickColumn(header: Cell[], words: string | null, guessed: SheetColumn | null) {
  return words === null ? guessed : findColumnByName(header, words);
}

function appendColumns(header: Cell[], request: AppendRequest): Columns {
  const guess = guessColumnMap(header);
  const guessedValue = request.metric === "revenue" ? guess?.revenue : guess?.itemsSold;
  const date = pickColumn(header, request.dateColumn, guess?.date ?? null);
  const value = pickColumn(header, request.valueColumn, guessedValue ?? null);
  const known = describeHeader(header);

  if (date === null)
    return {
      status: "error",
      message: `Kolom tanggal belum ketemu di baris pertama sheet (${known}). Tanya Kakak kolom mana untuk tanggal, jangan menebak; lalu panggil lagi dengan dateColumn.`,
    };

  if (value === null)
    return {
      status: "error",
      message: `Kolom ${METRIC_LABEL[request.metric]} belum ketemu di baris pertama sheet (${known}). Tanya Kakak kolom mana yang dipakai, jangan menebak; lalu panggil lagi dengan valueColumn.`,
    };

  if (date.index === value.index)
    return {
      status: "error",
      message: "Kolom tanggal dan kolom angkanya tidak boleh sama. Tanya Kakak lagi.",
    };

  return { status: "ok", date, value };
}

function appendSummary(
  args: SheetAppendArgs,
  columns: { date: SheetColumn; value: SheetColumn },
  notes: { skipped: string[]; todayLeftOut: boolean },
): string {
  return [
    `Tambah ${args.values.length} baris ${METRIC_LABEL[args.metric]} ke sheet *${args.sheetTitle}* (tab ${args.tabTitle}), kolom ${columns.date.header} dan ${columns.value.header}:`,
    ...args.values.map(({ date, value }) => `- ${date}: ${formatDailyValue(args.metric, value)}`),
    ...(notes.skipped.length > 0
      ? [`Sudah ada di sheet, dilewati: ${notes.skipped.map(shortDate).join(", ")}.`]
      : []),
    ...(notes.todayLeftOut ? ["Hari ini belum selesai, jadi belum ditulis."] : []),
  ].join("\n");
}

// Reads the header and the date column (never the whole sheet) to show exactly what "Ya" writes.
export async function prepareSheetAppend(
  access: SheetsAccess,
  connection: StoredConnection,
  request: AppendRequest,
): Promise<PreparedAppend> {
  const { client, sleep } = access;
  const tab = quoteTab(connection.tabTitle);

  const header = await withSheetRetry(
    () => client.getValues(connection.spreadsheetId, `${tab}!1:1`),
    sleep,
  );

  if (header.status === "error") return readFailure(access, header.reason);

  const columns = appendColumns(header.value[0] ?? [], request);

  if (columns.status === "error") return columns;

  // A day still running would be written half and then skipped forever as "already there".
  const values = request.days
    .filter(({ date }) => date < request.today)
    .map((day) => ({
      date: day.date,
      value: request.metric === "revenue" ? day.revenue : day.itemsSold,
    }));

  if (values.length === 0)
    return {
      status: "error",
      message: "Hari ini belum selesai, jadi belum bisa ditulis. Tawarkan sampai kemarin.",
    };

  const columnMap: ColumnMap = {
    date: columns.date,
    revenue: request.metric === "revenue" ? columns.value : null,
    itemsSold: request.metric === "items_sold" ? columns.value : null,
  };

  const target = {
    spreadsheetId: connection.spreadsheetId,
    tabTitle: connection.tabTitle,
    columnMap,
    metric: request.metric,
  };

  const plan = await withSheetRetry(
    () => planSheetAppend(client, target, values, request.today),
    sleep,
  );

  if (plan.status === "error") return readFailure(access, plan.reason);

  const { toWrite, skipped } = plan.value;

  if (toWrite.length === 0)
    return {
      status: "error",
      message: `Semua tanggal itu sudah ada di sheet (${skipped.map(shortDate).join(", ")}), jadi tidak ada yang ditambah.`,
    };

  const args = { ...target, sheetTitle: connection.sheetTitle, values: toWrite };
  const todayLeftOut = values.length < request.days.length;

  return {
    status: "ok",
    args,
    summary: appendSummary(args, columns, { skipped, todayLeftOut }),
    skipped,
  };
}

// S6: old sales imported from the owner's sheet into transactions.

export const sheetImportArgs = z.object({
  sourceSheetId: z.string().min(1),
  sheetTitle: z.string(),
  tabTitle: z.string(),
  rows: z
    .array(
      z.object({
        sourceRow: z.number().int().positive(),
        date: z.iso.date(),
        menuItemId: z.string(),
        quantity: z.number().int().positive(),
        unitPrice: z.number().int().positive(),
      }),
    )
    .min(1)
    .max(MAX_IMPORT_ROWS),
});

export type SheetImportArgs = z.infer<typeof sheetImportArgs>;

// Row numbers are per tab, so the dedupe key names the tab too (S6-AC2).
export const sourceSheetId = ({ spreadsheetId, tabId }: StoredConnection) =>
  `${spreadsheetId}#${tabId}`;

export type ImportRequest = {
  menu: MenuItem[];
  today: string;
  columns: ImportColumnNames;
  imported: ReadonlySet<number>;
  costSince: ReadonlyMap<string, string>;
};

export type ImportPreview = { date: string; menu: string; qty: number; total: string };

const PREVIEW_ROWS = 5;
const LISTED_SKIPS = 3;

type ImportCard = {
  args: SheetImportArgs;
  preview: ImportPreview[];
  skipped: { row: number; reason: string }[];
  priceMismatchCount: number;
  alreadyImported: number;
};

function importSummary({
  args,
  preview,
  skipped,
  priceMismatchCount,
  alreadyImported,
}: ImportCard) {
  const dates = args.rows.map((row) => row.date).toSorted();
  const total = args.rows.reduce((sum, row) => sum + row.quantity * row.unitPrice, 0);

  const listed = skipped
    .slice(0, LISTED_SKIPS)
    .map(({ row, reason }) => `baris ${row} (${reason})`);

  const more =
    skipped.length > LISTED_SKIPS ? `, dan ${skipped.length - LISTED_SKIPS} lainnya` : "";

  return [
    `Import penjualan dari sheet *${args.sheetTitle}* (tab ${args.tabTitle}):`,
    `${args.rows.length} baris, ${formatDateId(dates[0] ?? "")} s.d. ${formatDateId(dates.at(-1) ?? "")}, total ${formatRupiah(total)}.`,
    ...preview.map((row) => `- ${row.date} ${row.menu} x ${row.qty} = ${row.total}`),
    ...(skipped.length > 0
      ? [`${skipped.length} baris dilewati: ${listed.join(", ")}${more}.`]
      : []),
    ...(priceMismatchCount > 0
      ? [`${priceMismatchCount} baris harganya beda dari daftar menu; dipakai harga di sheet.`]
      : []),
    ...(alreadyImported > 0
      ? [`${alreadyImported} baris sudah pernah diimport, tidak dimasukkan lagi.`]
      : []),
  ].join("\n");
}

export type PreparedImport =
  | ({ status: "ok"; summary: string } & ImportCard)
  | { status: "error"; message: string };

export async function prepareSheetImport(
  access: SheetsAccess,
  connection: StoredConnection,
  request: ImportRequest,
): Promise<PreparedImport> {
  const values = await withSheetRetry(
    () => access.client.getValues(connection.spreadsheetId, quoteTab(connection.tabTitle)),
    access.sleep,
  );

  if (values.status === "error") return readFailure(access, values.reason);

  const parsed = parseImportRows(
    values.value,
    request.menu,
    request.today,
    request.columns,
    request.costSince,
  );

  if (parsed.status === "error") return parsed;

  const fresh = parsed.rows.filter((row) => !request.imported.has(row.sourceRow));

  if (fresh.length === 0)
    return {
      status: "error",
      message:
        parsed.rows.length > 0
          ? "Semua baris di sheet ini sudah pernah diimport, Kak."
          : `Belum ada baris yang bisa diimport, Kak. ${parsed.skipped.length} baris dilewati, misalnya baris ${parsed.skipped[0]?.row} (${parsed.skipped[0]?.reason}).`,
    };

  const card: ImportCard = {
    args: {
      sourceSheetId: sourceSheetId(connection),
      sheetTitle: connection.sheetTitle,
      tabTitle: connection.tabTitle,
      rows: fresh.map(({ sourceRow, date, itemId, quantity, unitPrice }) => ({
        sourceRow,
        date,
        menuItemId: itemId,
        quantity,
        unitPrice,
      })),
    },
    preview: fresh.slice(0, PREVIEW_ROWS).map((row) => ({
      date: row.date,
      menu: row.menuName,
      qty: row.quantity,
      total: formatRupiah(row.quantity * row.unitPrice),
    })),
    skipped: parsed.skipped,
    priceMismatchCount: fresh.filter((row) => row.priceDiffersFromMenu).length,
    alreadyImported: parsed.rows.length - fresh.length,
  };

  return { status: "ok", summary: importSummary(card), ...card };
}
