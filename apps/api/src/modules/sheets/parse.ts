import { z } from "zod";

// Pure parsing for Google Sheets: links, cell dates, header guesses and A1 ranges.
// Nothing here touches the network; a link is only ever parsed, never fetched (no SSRF).

// A cell as read with UNFORMATTED_VALUE: numbers stay numbers, everything else is text.
export type Cell = { text: string; number: number | null };

export const cellSchema = z
  .union([z.string(), z.number(), z.boolean()])
  .transform((value): Cell => ({
    text: String(value),
    number: z.number().safeParse(value).data ?? null,
  }));

export const rowsSchema = z.array(z.array(cellSchema));

// What Thya writes; RAW input keeps strings like "=IMPORTXML(...)" as text.
export type WriteCell = string | number;

export type SheetLink = { spreadsheetId: string; gid: number | null };

const SPREADSHEET_PATH = /^\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/;
const GID = /(?:^|[#&?])gid=(\d+)/;

export function parseSheetLink(text: string): SheetLink | null {
  const trimmed = text.trim();
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

  let url: URL;

  try {
    url = new URL(withScheme);
  } catch {
    return null;
  }

  if (url.hostname !== "docs.google.com") return null;

  const id = SPREADSHEET_PATH.exec(url.pathname)?.[1];

  if (id === undefined) return null;

  const gid = GID.exec(url.hash)?.[1] ?? GID.exec(url.search)?.[1];

  return { spreadsheetId: id, gid: gid === undefined ? null : Number(gid) };
}

const MONTHS = new Map([
  ["jan", 1],
  ["januari", 1],
  ["feb", 2],
  ["februari", 2],
  ["mar", 3],
  ["maret", 3],
  ["apr", 4],
  ["april", 4],
  ["mei", 5],
  ["jun", 6],
  ["juni", 6],
  ["jul", 7],
  ["juli", 7],
  ["agu", 8],
  ["agt", 8],
  ["ags", 8],
  ["agustus", 8],
  ["sep", 9],
  ["sept", 9],
  ["september", 9],
  ["okt", 10],
  ["oktober", 10],
  ["nov", 11],
  ["november", 11],
  ["des", 12],
  ["desember", 12],
]);

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const SLASH_DATE = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;
const NAMED_MONTH_DATE = /^(\d{1,2})\s+([a-z]+)\.?(?:\s+(\d{4}))?$/;

function isoDate(year: number, month: number, day: number): string | null {
  const date = new Date(Date.UTC(year, month - 1, day));

  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1) return null;

  if (date.getUTCDate() !== day) return null;

  return date.toISOString().slice(0, 10);
}

// Accepts YYYY-MM-DD, DD/MM/YYYY and "D MMM" with an Indonesian month ("23 Okt", "23 Oktober 2026").
// Without a year, the date lands in the year of `today`, or the year before if that would be in the future.
export function parseSheetDate(cell: Cell, today: string): string | null {
  if (cell.number !== null) return null;

  const text = cell.text.trim().toLowerCase();
  const iso = ISO_DATE.exec(text);

  if (iso) return isoDate(Number(iso[1]), Number(iso[2]), Number(iso[3]));

  const slash = SLASH_DATE.exec(text);

  if (slash) return isoDate(Number(slash[3]), Number(slash[2]), Number(slash[1]));

  const named = NAMED_MONTH_DATE.exec(text);
  const month = named?.[2] === undefined ? undefined : MONTHS.get(named[2]);

  if (named === null || month === undefined) return null;

  const day = Number(named[1]);

  if (named[3] !== undefined) return isoDate(Number(named[3]), month, day);

  const year = Number(today.slice(0, 4));
  const thisYear = isoDate(year, month, day);

  return thisYear !== null && thisYear > today ? isoDate(year - 1, month, day) : thisYear;
}

const sheetColumnSchema = z.object({ index: z.number().int().min(0), header: z.string() });

// Which columns hold the date and the daily numbers Thya can write. `null` = not recognised.
// Parse with this schema when reading `sheet_connections.column_map` back from jsonb.
export const columnMapSchema = z.object({
  date: sheetColumnSchema,
  revenue: sheetColumnSchema.nullable(),
  itemsSold: sheetColumnSchema.nullable(),
});

export type SheetColumn = z.infer<typeof sheetColumnSchema>;

export type ColumnMap = z.infer<typeof columnMapSchema>;

const DATE_HEADERS = ["tanggal", "tgl", "date", "hari/tanggal"];
const REVENUE_HEADERS = ["omzet", "omset", "penjualan", "pendapatan", "revenue", "sales"];
const ITEMS_SOLD_HEADERS = ["terjual", "jumlah terjual", "item terjual", "qty", "porsi", "cup"];

function normalizeHeader(cell: Cell): string {
  return cell.text.trim().toLowerCase().replaceAll(/\s+/g, " ");
}

function headerMatches(header: string, keywords: string[]): boolean {
  const words = header.split(/[^a-z/]+/);

  return keywords.some((keyword) => header === keyword || words.includes(keyword));
}

function findColumn(header: Cell[], keywords: string[], taken: number[]): SheetColumn | null {
  const index = header.findIndex(
    (cell, position) => !taken.includes(position) && headerMatches(normalizeHeader(cell), keywords),
  );

  return index === -1 ? null : { index, header: header[index]?.text.trim() ?? "" };
}

export function guessColumnMap(header: Cell[]): ColumnMap | null {
  const date = findColumn(header, DATE_HEADERS, []);

  if (date === null) return null;

  const revenue = findColumn(header, REVENUE_HEADERS, [date.index]);
  const taken = revenue === null ? [date.index] : [date.index, revenue.index];

  return { date, revenue, itemsSold: findColumn(header, ITEMS_SOLD_HEADERS, taken) };
}

export function columnLetter(index: number): string {
  let rest = index + 1;
  let letters = "";

  while (rest > 0) {
    const remainder = (rest - 1) % 26;
    letters = String.fromCodePoint(65 + remainder) + letters;
    rest = Math.floor((rest - 1) / 26);
  }

  return letters;
}

// Tab titles may hold spaces or quotes; A1 notation wants them single-quoted with '' escapes.
export function quoteTab(title: string): string {
  return `'${title.replaceAll("'", "''")}'`;
}

export function columnRange(tab: string, index: number): string {
  const letter = columnLetter(index);

  return `${quoteTab(tab)}!${letter}:${letter}`;
}
