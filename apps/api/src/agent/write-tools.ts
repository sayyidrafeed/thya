import { tool } from "ai";
import { z } from "zod";
import {
  COST_SOURCES,
  type DraftOutcome,
  type DraftPort,
  type DraftRequest,
} from "../actions/kinds";
import { menuCostSummary, salesSummary } from "../actions/summary";
import type { SalesDataset } from "../sales/demo-shop";
import { formatRupiah } from "../sales/format";
import { addDays, type MenuItem } from "../sales/report";

// Write tools only prepare drafts (decision Q1). Nothing is saved until the owner taps "Ya" (code)
// or types "ya" (confirmDraft). Draft text comes from code, so every number in it is grounded.

export const WRITE_TOOL_NAMES = [
  "recordSales",
  "setMenuCost",
  "confirmDraft",
  "cancelDraft",
] as const;

export type WriteToolName = (typeof WRITE_TOOL_NAMES)[number];

// Owners record today's or recent sales; older entries are more likely a typo than a memory.
const MAX_BACKDATE_DAYS = 31;

const DRAFT_NOTE =
  "Belum tersimpan. Minta Kakak cek ringkasannya lalu tekan Ya, Ubah, atau Batal. Jangan bilang sudah tersimpan.";

const NOT_READY = "Pencatatan belum bisa dipakai di sini, Kak.";

export type DraftResult =
  | { status: "draft"; draftId: string; summary: string; note: string }
  | { status: "error"; message: string };

type DecisionResult =
  | { status: "ok"; outcome: DraftOutcome["status"]; message: string }
  | { status: "error"; message: string };

async function decide(
  port: DraftPort | null,
  run: (port: DraftPort) => Promise<DraftOutcome>,
): Promise<DecisionResult> {
  if (port === null) return { status: "error", message: NOT_READY };

  const { status, message } = await run(port);

  return { status: "ok", outcome: status, message };
}

const normalize = (text: string) => text.toLowerCase().replace(/\s+/g, " ").trim();

// Exact name first, then a unique partial match ("es kopi susu" → "Es Kopi Susu Gula Aren").
export function matchMenu(menu: MenuItem[], name: string): MenuItem[] {
  const wanted = normalize(name);
  const exact = menu.filter((item) => normalize(item.name) === wanted);

  if (exact.length > 0) return exact;

  return menu.filter(
    (item) => normalize(item.name).includes(wanted) || wanted.includes(normalize(item.name)),
  );
}

function menuError(menu: MenuItem[], name: string, found: MenuItem[]): string {
  const names = (found.length > 1 ? found : menu).map((item) => item.name).join(", ");

  return found.length > 1
    ? `"${name}" cocok dengan beberapa menu: ${names}. Tanya Kakak yang mana.`
    : `"${name}" tidak ada di daftar menu. Menu yang ada: ${names}. Pengeluaran dan menu baru belum bisa dicatat.`;
}

class WriteInputError extends Error {}

function resolveItem(menu: MenuItem[], name: string): MenuItem {
  const found = matchMenu(menu, name);
  const [item] = found;

  if (found.length !== 1 || item === undefined)
    throw new WriteInputError(menuError(menu, name, found));

  return item;
}

function resolveDay(day: "today" | "yesterday" | "custom", date: string | null, today: string) {
  if (day === "today") return today;

  if (day === "yesterday") return addDays(today, -1);

  if (date === null)
    throw new WriteInputError("Tanggal penjualan belum disebut. Tanya Kakak tanggalnya.");

  if (date > today) throw new WriteInputError("Penjualan yang belum terjadi tidak bisa dicatat.");

  if (date < addDays(today, -MAX_BACKDATE_DAYS))
    throw new WriteInputError(
      `Penjualan lebih dari ${MAX_BACKDATE_DAYS} hari lalu belum bisa dicatat lewat chat.`,
    );

  return date;
}

export const recordSalesInputSchema = z.object({
  day: z
    .enum(["today", "yesterday", "custom"])
    .describe("today = hari ini/tadi, yesterday = kemarin, custom = pakai date"),
  date: z.iso.date().nullable().describe("YYYY-MM-DD kalau day custom, selain itu null"),
  items: z
    .array(
      z.object({
        menuName: z.string().describe("Nama menu persis seperti kata Kakak"),
        quantity: z.number().int().min(1).max(1_000).describe("Jumlah porsi yang terjual"),
      }),
    )
    .min(1)
    .max(20),
});

export const setMenuCostInputSchema = z.object({
  menuName: z.string(),
  method: z
    .enum(COST_SOURCES)
    .describe(
      "owner = Kakak menyebut modal per porsi; recipe = Kakak menyebut harga belanja bahan dan jadi berapa porsi; estimate = Kakak tidak tahu dan setuju pakai perkiraan",
    ),
  amount: z
    .number()
    .int()
    .min(0)
    .nullable()
    .describe("Modal per porsi dalam Rupiah kalau method owner, selain itu null"),
  ingredients: z
    .array(
      z.object({
        name: z.string(),
        purchaseCost: z.number().int().positive().describe("Harga belanja bahan dalam Rupiah"),
        portions: z.number().int().positive().describe("Bahan itu cukup untuk berapa porsi"),
      }),
    )
    .nullable()
    .describe("Bahan yang disebut Kakak kalau method recipe, selain itu null"),
  estimateShare: z
    .enum(["half", "third", "quarter"])
    .nullable()
    .describe(
      "Perkiraan modal sebagai bagian harga jual kalau method estimate: half = separuh, third = sepertiga, quarter = seperempat",
    ),
  includesPackaging: z
    .boolean()
    .nullable()
    .describe("Sudah termasuk gelas/kemasan dan es? null kalau belum ditanya"),
});

const ESTIMATE_SHARE = { half: 2, third: 3, quarter: 4 } as const;

type CostInput = z.infer<typeof setMenuCostInputSchema>;

function costAmount(item: MenuItem, input: CostInput): number {
  if (input.method === "owner") {
    if (input.amount === null)
      throw new WriteInputError("Modal per porsi belum disebut. Tanya Kakak angkanya.");

    return input.amount;
  }

  if (input.method === "recipe") {
    if (!input.ingredients?.length)
      throw new WriteInputError("Sebutkan harga belanja bahan dan jadi berapa porsi.");

    return input.ingredients.reduce(
      (sum, { purchaseCost, portions }) => sum + Math.round(purchaseCost / portions),
      0,
    );
  }

  if (input.estimateShare === null)
    throw new WriteInputError(
      "Tanya Kakak perkiraannya: separuh, sepertiga, atau seperempat harga jual?",
    );

  return Math.round(item.price / ESTIMATE_SHARE[input.estimateShare]);
}

// Recipe costs list what they were built from, so the owner sees a partial recipe is partial.
function recipeNote(input: CostInput): string {
  if (input.method !== "recipe" || !input.ingredients?.length) return "";

  const parts = input.ingredients.map(
    ({ name, purchaseCost, portions }) =>
      `${name} ${formatRupiah(purchaseCost)} untuk ${portions} porsi = ${formatRupiah(Math.round(purchaseCost / portions))}`,
  );

  return `\nDihitung dari: ${parts.join("; ")}. Bahan lain yang belum disebut belum masuk.`;
}

export function createWriteTools(dataset: SalesDataset, port: DraftPort | null) {
  const { menu, today } = dataset;

  async function draft(build: () => DraftRequest): Promise<DraftResult> {
    if (port === null) return { status: "error", message: NOT_READY };

    let request: DraftRequest;

    try {
      request = build();
    } catch (error) {
      if (error instanceof WriteInputError) return { status: "error", message: error.message };

      throw error;
    }

    const { draftId } = await port.create(request);

    return { status: "draft", draftId, summary: request.summary, note: DRAFT_NOTE };
  }

  return {
    recordSales: tool({
      description:
        'Siapkan catatan penjualan yang sudah terjadi ("tadi laku 20 kopi susu"). Hanya membuat draft; ' +
        "baru tersimpan setelah Kakak konfirmasi. Untuk koreksi sebelum konfirmasi, panggil lagi dengan isi yang benar.",
      inputSchema: recordSalesInputSchema,
      execute: async ({ day, date, items }) =>
        draft(() => {
          const args = {
            date: resolveDay(day, date, today),
            items: items.map(({ menuName, quantity }) => {
              const item = resolveItem(menu, menuName);

              return { menuItemId: item.id, name: item.name, quantity, unitPrice: item.price };
            }),
          };

          return { kind: "sales.record", args, summary: salesSummary(args) };
        }),
    }),

    setMenuCost: tool({
      description:
        "Siapkan modal per porsi (HPP) satu menu, mulai hari ini. Hanya membuat draft. Kalau Kakak tidak tahu angkanya, " +
        "tanya harga belanja bahan dan jadi berapa porsi (recipe), atau tawarkan perkiraan (estimate).",
      inputSchema: setMenuCostInputSchema,
      execute: async (input) =>
        draft(() => {
          const item = resolveItem(menu, input.menuName);

          const args = {
            menuItemId: item.id,
            name: item.name,
            amount: costAmount(item, input),
            source: input.method,
            includesPackaging: input.includesPackaging,
            validFrom: today,
          };

          return {
            kind: "menu.set_cost",
            args,
            summary: menuCostSummary(args) + recipeNote(input),
          };
        }),
    }),

    confirmDraft: tool({
      description:
        "Simpan draft terakhir karena Kakak menjawab ya/oke/betul/simpan. Jangan panggil tanpa jawaban setuju dari Kakak.",
      inputSchema: z.object({}),
      execute: async () => decide(port, (open) => open.confirmOpen()),
    }),

    cancelDraft: tool({
      description: "Batalkan draft terakhir karena Kakak bilang batal/nggak jadi.",
      inputSchema: z.object({}),
      execute: async () => decide(port, (open) => open.cancelOpen()),
    }),
  };
}
