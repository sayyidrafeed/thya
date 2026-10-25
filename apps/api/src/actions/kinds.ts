import { z } from "zod";
import { PAYMENT_METHODS } from "../modules/payments-import";
import { scheduleSpecSchema, type ScheduleSpec } from "../modules/schedules";

// What each draft kind freezes at draft time (decision Q1, engine-plan B3). The executor runs these
// stored arguments, never new ones from the model, and parses them again at that boundary.

export const salesRecordArgs = z.object({
  date: z.iso.date(),
  items: z
    .array(
      z.object({
        menuItemId: z.string(),
        name: z.string(),
        quantity: z.number().int().positive(),
        unitPrice: z.number().int().positive(),
      }),
    )
    .min(1),
});

export const COST_SOURCES = ["owner", "recipe", "estimate"] as const;

export const menuCostArgs = z.object({
  menuItemId: z.string(),
  name: z.string(),
  amount: z.number().int().nonnegative(),
  source: z.enum(COST_SOURCES),
  includesPackaging: z.boolean().nullable(),
  validFrom: z.iso.date(),
});

export const paymentsImportArgs = z.object({
  imageSha256: z.string().regex(/^[0-9a-f]{64}$/),
  rows: z
    .array(
      z.object({
        paidAt: z.iso.datetime({ offset: true }),
        amount: z.number().int().positive(),
        method: z.enum(PAYMENT_METHODS),
        sourceRef: z.string().nullable(),
        sourceRow: z.number().int().nonnegative(),
      }),
    )
    .min(1),
});

export const scheduleCancelArgs = z.object({ scheduleId: z.string(), summary: z.string() });

export type SalesRecordArgs = z.infer<typeof salesRecordArgs>;

export type MenuCostArgs = z.infer<typeof menuCostArgs>;

export type DraftRequest =
  | { kind: "sales.record"; args: SalesRecordArgs; summary: string }
  | { kind: "menu.set_cost"; args: MenuCostArgs; summary: string }
  | { kind: "schedule.create"; args: ScheduleSpec; summary: string }
  | { kind: "schedule.cancel"; args: z.infer<typeof scheduleCancelArgs>; summary: string }
  | { kind: "payments.import"; args: z.infer<typeof paymentsImportArgs>; summary: string };

export type DraftKind = DraftRequest["kind"];

// A stored row's kind and args, parsed again before anything runs.
export const storedDraftSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("sales.record"), args: salesRecordArgs }),
  z.object({ kind: z.literal("menu.set_cost"), args: menuCostArgs }),
  z.object({ kind: z.literal("schedule.create"), args: scheduleSpecSchema }),
  z.object({ kind: z.literal("schedule.cancel"), args: scheduleCancelArgs }),
  z.object({ kind: z.literal("payments.import"), args: paymentsImportArgs }),
]);

export type StoredDraft = z.infer<typeof storedDraftSchema>;

// The outcome the owner reads. `message` is written by code, never by the model.
export type DraftOutcome =
  | { status: "done"; message: string }
  | { status: "failed"; message: string }
  | { status: "none"; message: string };

// How tools reach drafts without knowing the database (agent/ imports no db, engine-plan §5.1).
export type DraftPort = {
  create: (request: DraftRequest) => Promise<{ draftId: string }>;
  // Typed "ya": runs the one open draft. A tapped button goes through the channel instead.
  confirmOpen: () => Promise<DraftOutcome>;
  cancelOpen: () => Promise<DraftOutcome>;
  // Active schedules, to list, cancel, and skip duplicates. A port without them has none.
  listSchedules?: () => Promise<ScheduleView[]>;
};

export type ScheduleView = { id: string; summary: string; nextRun: string; spec: ScheduleSpec };
