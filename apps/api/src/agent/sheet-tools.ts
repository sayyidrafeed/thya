import { tool } from "ai";
import { z } from "zod";
import type { DraftOutcome, DraftPort } from "../actions/kinds";
import {
  connectSheet,
  DAILY_METRICS,
  formatDailyValue,
  MAX_APPEND_DAYS,
  prepareSheetAppend,
  prepareSheetImport,
  sourceSheetId,
  type SheetPort,
} from "../modules/sheets";
import type { SalesDataset } from "../sales/demo-shop";
import {
  dailySales,
  dayCount,
  resolvePeriod,
  SalesQueryError,
  type DateRange,
} from "../sales/report";
import type { TurnToolCall } from "./run-turn";
import { periodFields } from "./tools";

// Business-features S5/S6: thin adapters to modules/sheets. Registered only when the deployment
// has a Google service account (decision U10); every write is a draft confirmed with "Ya" (Q1).

export const SHEET_TOOL_NAMES = [
  "connectSheet",
  "appendDailySales",
  "importSalesFromSheet",
] as const;

export type SheetToolName = (typeof SHEET_TOOL_NAMES)[number];

// Decision Q7 style budget: each one reaches Google, and two calls cover one corrected retry.
const MAX_CALLS_PER_TOOL = 2;

const MAX_TITLE_LENGTH = 60;
const MAX_LISTED_TABS = 10;
const MAX_HEADER_CELLS = 20;
const MAX_HEADER_LENGTH = 40;
const MAX_LISTED_SKIPS = 10;

const BUDGET_SPENT =
  "Batas akses sheet untuk pesan ini sudah habis. Jelaskan hasil yang sudah ada ke Kakak.";

const NOT_READY = "Menulis ke sheet belum bisa dipakai di sini, Kak.";

const NO_SHEET =
  "Belum ada sheet yang tersambung. Minta Kakak kirim link Google Sheets-nya dulu, lalu panggil connectSheet.";

const DRAFT_NOTE =
  "Belum ditulis. Minta Kakak cek kartunya lalu tekan Ya, Ubah, atau Batal. Jangan bilang sudah masuk.";

// Engine-plan A14: a turn that read sheet cells confirms nothing; the owner taps "Ya" instead.
const TAINTED_CONFIRM: DraftOutcome = {
  status: "none",
  message: "Untuk pesan yang membaca isi sheet, konfirmasi lewat tombol Ya di kartu ya Kak.",
};

const columnWords = (what: string) =>
  z
    .string()
    .nullable()
    .describe(
      `Nama atau huruf kolom ${what} persis seperti kata Kakak ("Pemasukan", "kolom C"); null = ditebak dari judul kolom`,
    );

export const appendDailySalesInputSchema = z.object({
  ...periodFields,
  metric: z.enum(DAILY_METRICS).describe("revenue = omzet, items_sold = porsi terjual"),
  dateColumn: columnWords("tanggal"),
  valueColumn: columnWords("angka (omzet atau porsi)"),
});

export const importSalesInputSchema = z.object({
  dateColumn: columnWords("tanggal"),
  menuColumn: columnWords("nama menu"),
  quantityColumn: columnWords("jumlah terjual"),
  priceColumn: columnWords("harga"),
});

const capped = (text: string, length: number) => text.slice(0, length);

function appendRange(
  dataset: SalesDataset,
  input: z.infer<typeof appendDailySalesInputSchema>,
): { status: "ok"; range: DateRange } | { status: "error"; message: string } {
  let range: DateRange;

  try {
    range = resolvePeriod(input, dataset.today, dataset.dataStart);
  } catch (error) {
    if (error instanceof SalesQueryError) return { status: "error", message: error.message };

    throw error;
  }

  if (dayCount(range) > MAX_APPEND_DAYS)
    return {
      status: "error",
      message: `Paling banyak ${MAX_APPEND_DAYS} hari sekali tambah. Tawarkan periode yang lebih pendek.`,
    };

  return { status: "ok", range };
}

export function createSheetTools(dataset: SalesDataset, port: SheetPort, drafts: DraftPort | null) {
  const { access } = port;
  const calls = new Map<SheetToolName, number>();
  let tainted = false;

  const spent = (name: SheetToolName) => {
    const used = (calls.get(name) ?? 0) + 1;
    calls.set(name, used);

    return used > MAX_CALLS_PER_TOOL;
  };

  const error = (message: string) => ({ status: "error" as const, message });

  const tools = {
    connectSheet: tool({
      description:
        "Sambungkan Google Sheets dari link yang Kakak kirim (docs.google.com/spreadsheets/...). Panggil setiap Kakak " +
        "mengirim link sheet, sebelum menulis atau import. Sheet baru menggantikan yang lama.",
      inputSchema: z.object({
        url: z.string().describe("Link Google Sheets persis seperti yang Kakak kirim"),
      }),
      execute: async ({ url }) => {
        if (spent("connectSheet")) return error(BUDGET_SPENT);

        tainted = true;

        const result = await connectSheet(
          url,
          access.client,
          access.serviceAccountEmail,
          access.sleep,
        );

        if (result.status !== "ok") return result;

        const { spreadsheetId, sheetTitle, tab, tabs, header, columnMap } = result;

        await port.saveConnection({
          spreadsheetId,
          sheetTitle,
          tabId: tab.id,
          tabTitle: tab.title,
          columnMap,
        });

        return {
          status: "ok" as const,
          sheetTitle: capped(sheetTitle, MAX_TITLE_LENGTH),
          tab: capped(tab.title, MAX_TITLE_LENGTH),
          tabs: tabs.slice(0, MAX_LISTED_TABS).map((title) => capped(title, MAX_TITLE_LENGTH)),
          header: header.slice(0, MAX_HEADER_CELLS).map((cell) => capped(cell, MAX_HEADER_LENGTH)),
          note: "Sheet tersambung. Untuk menulis omzet/porsi harian panggil appendDailySales; untuk import penjualan lama panggil importSalesFromSheet.",
        };
      },
    }),

    appendDailySales: tool({
      description:
        "Siapkan baris omzet atau porsi terjual per hari untuk ditambahkan ke sheet yang tersambung. Hanya membuat " +
        "draft; ditulis setelah Kakak tekan Ya. Hari ini tidak ditulis karena belum selesai. Jangan menebak kolom.",
      inputSchema: appendDailySalesInputSchema,
      execute: async (input) => {
        if (drafts === null) return error(NOT_READY);

        if (spent("appendDailySales")) return error(BUDGET_SPENT);

        const connection = await port.activeConnection();

        if (connection === null) return error(NO_SHEET);

        const period = appendRange(dataset, input);

        if (period.status === "error") return period;

        tainted = true;

        const prepared = await prepareSheetAppend(access, connection, {
          metric: input.metric,
          days: dailySales(dataset.records, dataset.menu, period.range),
          dateColumn: input.dateColumn,
          valueColumn: input.valueColumn,
          today: dataset.today,
        });

        if (prepared.status === "error") return prepared;

        const { args, summary, skipped } = prepared;
        const { draftId } = await drafts.create({ kind: "sheet.append", args, summary });

        return {
          status: "draft" as const,
          draftId,
          summary,
          rows: args.values.map(({ date, value }) => ({
            date,
            value,
            display: formatDailyValue(args.metric, value),
          })),
          skipped,
          note: DRAFT_NOTE,
        };
      },
    }),

    importSalesFromSheet: tool({
      description:
        "Siapkan import penjualan lama dari sheet yang tersambung (satu baris per menu per hari: Tanggal, Menu, " +
        "Jumlah, Harga opsional). Hanya membuat draft; masuk setelah Kakak tekan Ya. Kalau kolom tidak ketemu, " +
        "tanya Kakak kolom mana, lalu panggil lagi dengan nama kolomnya.",
      inputSchema: importSalesInputSchema,
      execute: async (input) => {
        if (drafts === null) return error(NOT_READY);

        if (spent("importSalesFromSheet")) return error(BUDGET_SPENT);

        const connection = await port.activeConnection();

        if (connection === null) return error(NO_SHEET);

        tainted = true;

        const prepared = await prepareSheetImport(access, connection, {
          menu: dataset.menu,
          today: dataset.today,
          columns: {
            date: input.dateColumn,
            menu: input.menuColumn,
            quantity: input.quantityColumn,
            price: input.priceColumn,
          },
          imported: await port.importedRows(sourceSheetId(connection)),
          costSince: await port.costSince(),
        });

        if (prepared.status === "error") return prepared;

        const { args, summary, preview, skipped } = prepared;
        const { draftId } = await drafts.create({ kind: "sheet.import", args, summary });

        return {
          status: "draft" as const,
          draftId,
          summary,
          preview,
          rowCount: args.rows.length,
          skipped: skipped.slice(0, MAX_LISTED_SKIPS),
          note: DRAFT_NOTE,
        };
      },
    }),
  };

  const guarded: DraftPort | null =
    drafts === null
      ? null
      : {
          ...drafts,
          confirmOpen: async () => (tainted ? TAINTED_CONFIRM : drafts.confirmOpen()),
        };

  return { tools, drafts: guarded };
}

const needsAccessOutput = z.object({ status: z.literal("needs_access"), message: z.string() });

// S5-AC1: the share instructions carry the service account email from env, so the owner gets the
// code's text and the model never retypes the address.
export function sheetAccessReply(toolCalls: TurnToolCall[]): string | null {
  const last = toolCalls.findLast((call) => call.toolName === "connectSheet");
  const parsed = needsAccessOutput.safeParse(last?.output);

  return parsed.success ? parsed.data.message : null;
}
