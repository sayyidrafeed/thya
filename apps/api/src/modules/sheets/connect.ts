import type { SheetsClient, SheetsFailure, SheetsResult, SheetTab } from "./google";
import {
  columnLetter,
  columnRange,
  guessColumnMap,
  parseSheetDate,
  parseSheetLink,
  quoteTab,
  type ColumnMap,
  type WriteCell,
} from "./parse";

export const MAX_SHEET_ATTEMPTS = 3;
const RETRY_BASE_MS = 1_000;

export type Sleep = (ms: number) => Promise<void>;

const realSleep: Sleep = (ms) => Bun.sleep(ms);

// Template reply from code (S5-AC1): the email comes from env, never from the model.
export function accessInstructions(serviceAccountEmail: string): string {
  return (
    "Thya belum bisa buka sheet itu, Kak. Caranya: klik *Bagikan* di sheet, " +
    `tempel email ${serviceAccountEmail}, pilih *Editor*, lalu kirim ulang linknya ya.`
  );
}

const FAILURE_MESSAGES: Record<SheetsFailure, string> = {
  no_access: "Thya belum punya akses Editor ke sheet itu, Kak.",
  not_found: "Sheet-nya nggak ketemu, Kak. Mungkin sudah dihapus atau aksesnya dicabut.",
  rate_limited: "Google Sheets lagi sibuk, Kak. Coba lagi sebentar ya.",
  unavailable: "Google Sheets lagi susah diakses, Kak. Coba lagi sebentar ya.",
  rejected: "Sheet-nya menolak perubahan dari Thya, Kak. Coba cek lagi isi dan aksesnya ya.",
};

export function sheetFailureMessage(reason: SheetsFailure): string {
  return FAILURE_MESSAGES[reason];
}

function isRetryable(reason: SheetsFailure): boolean {
  return reason === "rate_limited" || reason === "unavailable";
}

// Retries 429/5xx with backoff. `attempt` reruns the whole step so a retried write re-reads first.
export async function withSheetRetry<T>(
  attempt: () => Promise<SheetsResult<T>>,
  sleep: Sleep = realSleep,
): Promise<SheetsResult<T>> {
  let result = await attempt();

  for (let tries = 1; tries < MAX_SHEET_ATTEMPTS; tries++) {
    if (result.status === "ok" || !isRetryable(result.reason)) return result;

    await sleep(RETRY_BASE_MS * 2 ** (tries - 1));
    result = await attempt();
  }

  return result;
}

export type SheetConnection = {
  spreadsheetId: string;
  sheetTitle: string;
  tab: SheetTab;
  tabs: string[];
  header: string[];
  columnMap: ColumnMap | null;
};

export type ConnectResult =
  | ({ status: "ok" } & SheetConnection)
  | { status: "needs_access"; serviceAccountEmail: string; message: string }
  | { status: "error"; message: string };

export async function connectSheet(
  url: string,
  client: SheetsClient,
  serviceAccountEmail: string,
  sleep: Sleep = realSleep,
): Promise<ConnectResult> {
  const link = parseSheetLink(url);

  if (link === null) {
    return {
      status: "error",
      message:
        "Ini bukan link Google Sheets, Kak. Kirim link yang diawali docs.google.com/spreadsheets ya.",
    };
  }

  const info = await withSheetRetry(() => client.getSpreadsheet(link.spreadsheetId), sleep);

  if (info.status === "error") {
    return info.reason === "no_access" || info.reason === "not_found"
      ? {
          status: "needs_access",
          serviceAccountEmail,
          message: accessInstructions(serviceAccountEmail),
        }
      : { status: "error", message: sheetFailureMessage(info.reason) };
  }

  const { title, tabs } = info.value;
  const tab = tabs.find((candidate) => candidate.id === link.gid) ?? tabs[0];

  if (tab === undefined) return { status: "error", message: "Sheet-nya belum punya tab, Kak." };

  const header = await withSheetRetry(
    () => client.getValues(link.spreadsheetId, `${quoteTab(tab.title)}!1:1`),
    sleep,
  );

  if (header.status === "error") {
    return { status: "error", message: sheetFailureMessage(header.reason) };
  }

  const headerRow = header.value[0] ?? [];

  return {
    status: "ok",
    spreadsheetId: link.spreadsheetId,
    sheetTitle: title,
    tab,
    tabs: tabs.map((candidate) => candidate.title),
    header: headerRow.map((cell) => cell.text),
    columnMap: guessColumnMap(headerRow),
  };
}

export type DailyMetric = "revenue" | "items_sold";

export type AppendTarget = {
  spreadsheetId: string;
  tabTitle: string;
  columnMap: ColumnMap;
  metric: DailyMetric;
};

export type DailyValue = { date: string; value: number };

export type AppendPlan = { toWrite: DailyValue[]; skipped: string[] };

export type AppendOutcome =
  | { status: "done"; written: string[]; skipped: string[] }
  | { status: "failed"; reason: SheetsFailure | "no_value_column"; message: string };

function valueColumn(target: AppendTarget) {
  return target.metric === "revenue" ? target.columnMap.revenue : target.columnMap.itemsSold;
}

// Dates already in the sheet are left alone, so a retried append never writes a day twice.
export async function planSheetAppend(
  client: SheetsClient,
  target: AppendTarget,
  values: DailyValue[],
  today: string,
): Promise<SheetsResult<AppendPlan>> {
  const range = columnRange(target.tabTitle, target.columnMap.date.index);
  const column = await client.getValues(target.spreadsheetId, range);

  if (column.status === "error") return column;

  const existing = new Set(
    column.value.map((row) => (row[0] ? parseSheetDate(row[0], today) : null)),
  );

  return {
    status: "ok",
    value: {
      toWrite: values.filter(({ date }) => !existing.has(date)),
      skipped: values.flatMap(({ date }) => (existing.has(date) ? [date] : [])),
    },
  };
}

function rowFor(
  target: AppendTarget,
  valueIndex: number,
  { date, value }: DailyValue,
): WriteCell[] {
  const row: WriteCell[] = Array.from(
    { length: Math.max(target.columnMap.date.index, valueIndex) + 1 },
    () => "",
  );

  row[target.columnMap.date.index] = date;
  row[valueIndex] = value;

  return row;
}

async function appendOnce(
  client: SheetsClient,
  target: AppendTarget,
  values: DailyValue[],
  today: string,
): Promise<SheetsResult<AppendPlan>> {
  const plan = await planSheetAppend(client, target, values, today);
  const value = valueColumn(target);

  if (plan.status === "error" || value === null || plan.value.toWrite.length === 0) return plan;

  const lastColumn = columnLetter(Math.max(target.columnMap.date.index, value.index));
  const range = `${quoteTab(target.tabTitle)}!A:${lastColumn}`;
  const rows = plan.value.toWrite.map((day) => rowFor(target, value.index, day));
  const appended = await client.appendRows(target.spreadsheetId, range, rows);

  return appended.status === "error" ? appended : plan;
}

function appendFailure(reason: SheetsFailure): AppendOutcome {
  const message =
    reason === "no_access"
      ? "Thya cuma bisa baca sheet itu, Kak. Ubah aksesnya ke *Editor* dulu ya."
      : sheetFailureMessage(reason);

  return { status: "failed", reason, message };
}

// Executor for a confirmed `sheet.append` draft. Each retry re-reads the date column first.
export async function executeSheetAppend(
  client: SheetsClient,
  target: AppendTarget,
  values: DailyValue[],
  today: string,
  sleep: Sleep = realSleep,
): Promise<AppendOutcome> {
  if (valueColumn(target) === null) {
    return {
      status: "failed",
      reason: "no_value_column",
      message: "Kolom untuk angkanya belum ketemu di sheet, Kak. Kolom mana yang dipakai?",
    };
  }

  // Read once up front so dates written by an earlier retry are not reported as skipped.
  const before = await withSheetRetry(() => planSheetAppend(client, target, values, today), sleep);

  if (before.status === "error") return appendFailure(before.reason);

  const result = await withSheetRetry(() => appendOnce(client, target, values, today), sleep);

  if (result.status === "error") return appendFailure(result.reason);

  const { skipped } = before.value;

  return {
    status: "done",
    written: values.flatMap(({ date }) => (skipped.includes(date) ? [] : [date])),
    skipped,
  };
}
