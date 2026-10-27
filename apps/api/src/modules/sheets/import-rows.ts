import type { MenuItem } from "../../sales/report";
import { describeHeader, findColumnByName, parseSheetDate, type Cell } from "./parse";

// S6: one row per menu per day with columns Tanggal, Menu, Jumlah and optional Harga.

export const MAX_IMPORT_ROWS = 5_000;

export type ImportRow = {
  sourceRow: number;
  date: string;
  itemId: string;
  menuName: string;
  quantity: number;
  unitPrice: number;
  // Menu cost on import day; the sheet has no cost column.
  unitCost: number;
  priceDiffersFromMenu: boolean;
};

export type SkippedRow = { row: number; reason: string };

export type ImportParseResult =
  | { status: "ok"; rows: ImportRow[]; skipped: SkippedRow[]; priceMismatchCount: number }
  | { status: "error"; message: string };

type ImportColumns = { date: number; menu: number; quantity: number; price: number | null };

const HEADERS = {
  date: ["tanggal", "tgl", "date"],
  menu: ["menu", "nama menu", "produk", "item"],
  quantity: ["jumlah", "qty", "jml", "terjual"],
  price: ["harga", "harga satuan", "price"],
};

// Columns the owner named when the headers are not the usual ones; null = guess from the header.
export type ImportColumnNames = Record<keyof ImportColumns, string | null>;

const GUESS_ALL: ImportColumnNames = { date: null, menu: null, quantity: null, price: null };

function findHeader(header: Cell[], names: string[]): number | null {
  const index = header.findIndex((cell) => names.includes(normalizeText(cell.text)));

  return index === -1 ? null : index;
}

type ColumnsResult =
  | { status: "ok"; columns: ImportColumns }
  | { status: "error"; message: string };

function importColumns(header: Cell[], named: ImportColumnNames): ColumnsResult {
  const unmatched = Object.values(named).find(
    (words) => words !== null && findColumnByName(header, words) === null,
  );

  if (unmatched !== undefined && unmatched !== null) {
    return {
      status: "error",
      message: `Kolom "${unmatched}" nggak ada di sheet, Kak (${describeHeader(header)}).`,
    };
  }

  const pick = (role: keyof ImportColumns) => {
    const words = named[role];

    return words === null
      ? findHeader(header, HEADERS[role])
      : (findColumnByName(header, words)?.index ?? null);
  };

  const date = pick("date");
  const menu = pick("menu");
  const quantity = pick("quantity");

  if (date === null || menu === null || quantity === null) {
    return {
      status: "error",
      message: `Kolom Tanggal, Menu, dan Jumlah belum ketemu di baris pertama sheet, Kak (${describeHeader(header)}).`,
    };
  }

  return { status: "ok", columns: { date, menu, quantity, price: pick("price") } };
}

function normalizeText(text: string): string {
  return text.trim().toLowerCase().replaceAll(/\s+/g, " ");
}

const RUPIAH_TEXT = /^(?:rp\.?\s*)?(\d{1,3}(?:\.\d{3})+|\d+)$/;

// Quantities and rupiah prices are whole and positive. Numbers arrive as numbers
// (UNFORMATTED_VALUE); text like "Rp18.000" is still accepted.
function parseAmount(cell: Cell): number | null {
  const match = RUPIAH_TEXT.exec(normalizeText(cell.text));

  const amount =
    cell.number ?? (match?.[1] === undefined ? null : Number(match[1].replaceAll(".", "")));

  return amount !== null && Number.isInteger(amount) && amount > 0 ? amount : null;
}

function isBlank(row: Cell[]): boolean {
  return row.every((cell) => cell.text.trim() === "");
}

type RowContext = {
  columns: ImportColumns;
  menuByName: Map<string, MenuItem>;
  today: string;
  costSince: ReadonlyMap<string, string>;
};

function parseRow(row: Cell[], sourceRow: number, context: RowContext): ImportRow | SkippedRow {
  const empty: Cell = { text: "", number: null };
  const { columns, menuByName, today } = context;
  const date = parseSheetDate(row[columns.date] ?? empty, today);

  if (date === null) return { row: sourceRow, reason: "tanggal tidak terbaca" };

  if (date > today) return { row: sourceRow, reason: "tanggal di masa depan" };

  const item = menuByName.get(normalizeText((row[columns.menu] ?? empty).text));

  if (item === undefined) return { row: sourceRow, reason: "menu tidak dikenal" };

  const quantity = parseAmount(row[columns.quantity] ?? empty);

  if (quantity === null) {
    return { row: sourceRow, reason: "jumlah harus bilangan bulat lebih dari 0" };
  }

  const priceCell = columns.price === null ? undefined : row[columns.price];
  const hasPrice = priceCell !== undefined && priceCell.text.trim() !== "";
  const sheetPrice = hasPrice ? parseAmount(priceCell) : null;

  if (hasPrice && sheetPrice === null) return { row: sourceRow, reason: "harga tidak terbaca" };

  const costSince = context.costSince.get(item.id);

  // Every stored sale needs the menu's cost on its date (costOn in sales/repository).
  if (costSince !== undefined && date < costSince) {
    return { row: sourceRow, reason: "modal menu belum tercatat di tanggal itu" };
  }

  return {
    sourceRow,
    date,
    itemId: item.id,
    menuName: item.name,
    quantity,
    unitPrice: sheetPrice ?? item.price,
    unitCost: item.cost,
    priceDiffersFromMenu: sheetPrice !== null && sheetPrice !== item.price,
  };
}

// `values` is the whole tab, header first. Row numbers are 1-based like the sheet itself.
// `costSince`: the first date each menu item has a cost per portion; earlier rows are skipped.
export function parseImportRows(
  values: Cell[][],
  menu: MenuItem[],
  today: string,
  named: ImportColumnNames = GUESS_ALL,
  costSince: ReadonlyMap<string, string> = new Map(),
): ImportParseResult {
  const [header, ...body] = values;
  const dataRows = body.filter((row) => !isBlank(row)).length;

  if (header === undefined || dataRows === 0) {
    return { status: "error", message: "Sheet-nya masih kosong, Kak." };
  }

  if (dataRows > MAX_IMPORT_ROWS) {
    return {
      status: "error",
      message: `Sheet-nya kepanjangan, Kak. Maksimal ${MAX_IMPORT_ROWS} baris sekali import, dipecah dulu ya.`,
    };
  }

  const found = importColumns(header, named);

  if (found.status === "error") return found;

  const context: RowContext = {
    columns: found.columns,
    menuByName: new Map(menu.map((item) => [normalizeText(item.name), item])),
    today,
    costSince,
  };

  const rows: ImportRow[] = [];
  const skipped: SkippedRow[] = [];

  for (const [index, row] of body.entries()) {
    if (isBlank(row)) continue;

    const parsed = parseRow(row, index + 2, context);

    if ("reason" in parsed) skipped.push(parsed);
    else rows.push(parsed);
  }

  const priceMismatchCount = rows.filter((row) => row.priceDiffersFromMenu).length;

  return { status: "ok", rows, skipped, priceMismatchCount };
}
