import { tool } from "ai";
import { z } from "zod";
import {
  COST_SOURCES,
  DRAFT_OUTCOMES,
  type DraftOutcome,
  type DraftPort,
  type DraftRequest,
} from "../actions/kinds";
import { commissionSummary, menuCostSummary, salesSummary, runLabel } from "../actions/summary";
import type { SalesDataset } from "../sales/demo-shop";
import { formatRupiah } from "../sales/format";
import { addDays, DELIVERY_CHANNELS, type MenuItem } from "../sales/report";
import {
  DAYS_OF_WEEK,
  MAX_ACTIVE_SCHEDULES,
  nextRunAt,
  scheduleSpecSchema,
  scheduleSummary,
} from "../modules/schedules";

// Write tools only prepare drafts (decision Q1). Nothing is saved until the owner taps "Ya" (code)
// or types "ya" (confirmDraft). Draft text comes from code, so every number in it is grounded.

export const WRITE_TOOL_NAMES = [
  "recordSales",
  "setMenuCost",
  "setChannelCommission",
  "confirmDraft",
  "cancelDraft",
  "createSchedule",
  "listSchedules",
  "cancelSchedule",
] as const;

export type WriteToolName = (typeof WRITE_TOOL_NAMES)[number];

// Owners record today's or recent sales; older entries are more likely a typo than a memory.
const MAX_BACKDATE_DAYS = 31;

const DRAFT_NOTE =
  "Belum tersimpan. Minta Kakak cek ringkasannya lalu tekan Ya, Ubah, atau Batal. Jangan bilang sudah tersimpan.";

// Eval forwarded-order-unknown-menu: after this error the model wrote "sudah aku catat sebagian".
const NOT_RECORDED_NOTE =
  "Belum ada yang dicatat. Jangan bilang sudah dicatat, sebagian sekalipun.";

const NOT_READY = "Pencatatan belum bisa dipakai di sini, Kak.";

export type DraftResult =
  | { status: "draft"; draftId: string; summary: string; note: string }
  | { status: "error"; message: string; note?: string };

// What confirmDraft and cancelDraft hand the model; run-turn and fallback read it back.
export const draftDecisionSchema = z.object({
  status: z.literal("ok"),
  outcome: z.enum(DRAFT_OUTCOMES),
  message: z.string(),
});

type DecisionResult = z.infer<typeof draftDecisionSchema> | { status: "error"; message: string };

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

// A sanity bound on what the owner says, not a tariff: above it is more likely a slip of the tongue.
const MAX_COMMISSION_PERCENT = 50;

export const setChannelCommissionInputSchema = z.object({
  channel: z.enum(DELIVERY_CHANNELS),
  percent: z
    .number()
    .min(0)
    .max(100)
    .nullable()
    .describe(
      "Potongan dalam persen dari penjualan kotor persis kata Kakak (20 = 20%); null kalau Kakak hanya menyebut biaya per pesanan",
    ),
  feePerOrder: z
    .number()
    .int()
    .min(0)
    .nullable()
    .describe("Biaya tetap per pesanan dalam Rupiah kalau Kakak menyebutnya, selain itu null"),
});

function commissionArgs({
  channel,
  percent,
  feePerOrder,
}: z.infer<typeof setChannelCommissionInputSchema>) {
  if (percent === null && feePerOrder === null)
    throw new WriteInputError(
      "Potongannya belum disebut. Tanya Kakak aplikasinya motong berapa persen.",
    );

  if (percent !== null && percent > MAX_COMMISSION_PERCENT)
    throw new WriteInputError(
      `Potongan di atas ${MAX_COMMISSION_PERCENT}% jarang terjadi. Tanya Kakak lagi angkanya.`,
    );

  // One decimal place, so the card shows exactly the rate that is stored.
  return {
    channel,
    rateBps: Math.round((percent ?? 0) * 10) * 10,
    feePerOrder: feePerOrder ?? 0,
  };
}

export const createScheduleInputSchema = z.object({
  kind: z
    .enum(["recap", "reminder"])
    .describe("recap = rekap penjualan otomatis, reminder = pengingat teks"),
  frequency: z
    .enum(["once", "daily", "weekly"])
    .describe("once = sekali, daily = tiap hari, weekly = tiap minggu"),
  time: z
    .string()
    .describe(
      'Jam WIB 24 jam "HH:MM". "Jam 9 malam" = "21:00". Kalau pagi/malam tidak jelas, tanya dulu',
    ),
  dayOfWeek: z.enum(DAYS_OF_WEEK).nullable().describe("Hari untuk weekly, selain itu null"),
  date: z.iso.date().nullable().describe("YYYY-MM-DD untuk once, selain itu null"),
  recapKind: z
    .enum(["daily", "weekly"])
    .nullable()
    .describe(
      "Untuk recap: daily = rekap kemarin, weekly = rekap minggu lalu; null untuk reminder",
    ),
  timeWords: z
    .string()
    .nullable()
    .describe(
      'Kata persis Kakak tentang jamnya, misalnya "jam 9 malam" atau "jam 6"; null kalau tidak disebut',
    ),
  reminderText: z
    .string()
    .nullable()
    .describe("Isi pengingat untuk reminder (maksimal 120 huruf), null untuk recap"),
});

const DAY_PART = /pagi|siang|sore|petang|malam|subuh|dini hari/i;

// "Jam 6" could be 06:00 or 18:00. Code checks the owner's words instead of trusting the model's
// guess (eval case schedule-ambiguous-hour, decision U5: the rule lives in the tool).
export function ambiguousHour(words: string | null): boolean {
  return ambiguousTime(words) !== null;
}

function ambiguousTime(words: string | null) {
  if (words === null || DAY_PART.test(words)) return null;

  for (const [time, hour = ""] of words.matchAll(/\b(\d{1,2})(?:[.:]\d{2})?\b/g)) {
    const value = Number(hour);

    if (value >= 1 && value <= 12 && !hour.startsWith("0")) return { time, hour: value };
  }

  return null;
}

function dayPart(hour24: number) {
  if (hour24 >= 4 && hour24 <= 10) return "pagi";

  if (hour24 >= 11 && hour24 <= 14) return "siang";

  // "Jam 6 sore" is how owners say 18:00.
  if (hour24 >= 15 && hour24 <= 18) return "sore";

  return "malam";
}

// The two readings of an ambiguous hour, in the owner's words, for the channel's reply buttons:
// "jam 6" gives "Jam 6 pagi" and "Jam 6 sore"; a tap comes back as that text.
export function hourChoices(words: string | null): string[] | null {
  const ambiguous = ambiguousTime(words);

  if (ambiguous === null) return null;

  const morning = ambiguous.hour % 12;

  return [morning, morning + 12].map((hour24) => `Jam ${ambiguous.time} ${dayPart(hour24)}`);
}

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
      if (error instanceof WriteInputError)
        return { status: "error", message: error.message, note: NOT_RECORDED_NOTE };

      throw error;
    }

    const { draftId } = await port.create(request);

    return { status: "draft", draftId, summary: request.summary, note: DRAFT_NOTE };
  }

  async function scheduleDraft(input: z.infer<typeof createScheduleInputSchema>) {
    if (port === null) return { status: "error" as const, message: NOT_READY };

    const choices = hourChoices(input.timeWords);

    if (choices !== null)
      return {
        status: "error" as const,
        message: `"${input.timeWords}" belum jelas pagi atau malam. Tanya Kakak dulu, jangan menebak; Kakak juga dapat tombol ${choices.join(" / ")}.`,
        choices,
      };

    const parsed = scheduleSpecSchema.safeParse(input);

    if (!parsed.success)
      return {
        status: "error" as const,
        message: parsed.error.issues.map((issue) => issue.message).join(" "),
      };

    const spec = parsed.data;
    const summary = scheduleSummary(spec);
    const active = await (port.listSchedules?.() ?? []);
    const next = nextRunAt(spec, dataset.asOf);

    if (active.some((schedule) => schedule.summary === summary))
      return { status: "error" as const, message: `Jadwal ini sudah ada: ${summary}.` };

    if (active.length >= MAX_ACTIVE_SCHEDULES)
      return {
        status: "error" as const,
        message: `Jadwal aktif sudah ${MAX_ACTIVE_SCHEDULES}. Tawarkan untuk membatalkan salah satu.`,
      };

    if (next === null)
      return { status: "error" as const, message: "Waktunya sudah lewat. Tanya waktu lain." };

    return draft(() => ({
      kind: "schedule.create",
      args: spec,
      summary: `${summary}\nYang pertama: ${runLabel(next)}`,
    }));
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

    setChannelCommission: tool({
      description:
        "Siapkan potongan (komisi) satu aplikasi pesan-antar sesuai kata Kakak, untuk menghitung untung jualan online. " +
        "Hanya membuat draft. Jangan menebak atau memakai tarif umum: kalau Kakak belum menyebut angkanya, tanya dulu.",
      inputSchema: setChannelCommissionInputSchema,
      execute: async (input) =>
        draft(() => {
          const args = commissionArgs(input);

          return { kind: "channel.set_commission", args, summary: commissionSummary(args) };
        }),
    }),

    createSchedule: tool({
      description:
        "Siapkan jadwal rekap otomatis atau pengingat. Hanya membuat draft. Jangan menebak jam: kalau Kakak tidak menyebut jam " +
        "atau tidak jelas pagi/malam, tanya dulu.",
      inputSchema: createScheduleInputSchema,
      execute: scheduleDraft,
    }),

    listSchedules: tool({
      description: "Daftar jadwal rekap dan pengingat yang aktif milik Kakak.",
      inputSchema: z.object({}),
      execute: async () => {
        if (port === null) return { status: "error" as const, message: NOT_READY };

        const schedules = (await (port.listSchedules?.() ?? [])).map(
          ({ id, summary, nextRun }) => ({
            id,
            summary,
            nextRun,
          }),
        );

        return { status: "ok" as const, schedules };
      },
    }),

    cancelSchedule: tool({
      description:
        "Siapkan pembatalan satu jadwal. Ambil id dari listSchedules dulu. Hanya membuat draft.",
      inputSchema: z.object({ scheduleId: z.string() }),
      execute: async ({ scheduleId }) => {
        if (port === null) return { status: "error" as const, message: NOT_READY };

        const target = (await (port.listSchedules?.() ?? [])).find(
          (schedule) => schedule.id === scheduleId,
        );

        if (!target)
          return {
            status: "error" as const,
            message: "Jadwal itu tidak ada. Panggil listSchedules dulu.",
          };

        return draft(() => ({
          kind: "schedule.cancel",
          args: { scheduleId, summary: target.summary },
          summary: `Batalkan jadwal: ${target.summary}`,
        }));
      },
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
