import { and, asc, eq, lte } from "drizzle-orm";
import { z } from "zod";
import type { Db } from "../../db/client";
import { schedules } from "../../db/schema";
import { formatDateId, weekdayName } from "../../sales/report";

// Business-features-plan S4. The model never writes a cron: it picks frequency, time and day from
// enums, and code computes next_run_at in WIB (UTC+7 all year, no daylight saving).

export const DAYS_OF_WEEK = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;

export const MAX_ACTIVE_SCHEDULES = 10;

const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

const scheduleFields = z.object({
  kind: z.enum(["recap", "reminder"]),
  frequency: z.enum(["once", "daily", "weekly"]),
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  dayOfWeek: z.enum(DAYS_OF_WEEK).nullable(),
  date: z.iso.date().nullable(),
  recapKind: z.enum(["daily", "weekly"]).nullable(),
  reminderText: z.string().trim().min(1).max(120).nullable(),
});

export const scheduleSpecSchema = scheduleFields.superRefine((spec, context) => {
  const problem = specProblem(spec);

  if (problem) context.addIssue({ code: "custom", message: problem });
});

export type ScheduleSpec = z.infer<typeof scheduleSpecSchema>;

// Cross-field rules, worded for the owner because the model relays them.
export function specProblem(spec: z.infer<typeof scheduleFields>): string | null {
  if (spec.frequency === "weekly" && spec.dayOfWeek === null)
    return "Jadwal mingguan butuh harinya.";

  if (spec.frequency === "once" && spec.date === null) return "Jadwal sekali butuh tanggalnya.";

  if (spec.kind === "recap" && spec.recapKind === null) return "Pilih rekap harian atau mingguan.";

  if (spec.kind === "reminder" && spec.reminderText === null) return "Isi pengingatnya belum ada.";

  return null;
}

const wib = (instant: Date) => new Date(instant.getTime() + WIB_OFFSET_MS);

// The WIB wall-clock time `hh:mm` on WIB date `date` (YYYY-MM-DD), as an instant.
function atWib(date: string, time: string): Date {
  return new Date(Date.parse(`${date}T${time}:00+07:00`));
}

const wibDate = (instant: Date) => wib(instant).toISOString().slice(0, 10);

// The first run strictly after `after`, or null for a one-off whose moment has passed.
export function nextRunAt(spec: ScheduleSpec, after: Date): Date | null {
  if (spec.frequency === "once") {
    const at = atWib(spec.date ?? "", spec.time);

    return at > after ? at : null;
  }

  const today = atWib(wibDate(after), spec.time);

  for (let days = 0; days <= 7; days += 1) {
    const candidate = new Date(today.getTime() + days * DAY_MS);
    const weekday = DAYS_OF_WEEK[wib(candidate).getUTCDay()];

    if (candidate > after && (spec.frequency === "daily" || weekday === spec.dayOfWeek))
      return candidate;
  }

  throw new Error("no run within a week");
}

const DAY_LABEL: Record<(typeof DAYS_OF_WEEK)[number], string> = {
  sun: "Minggu",
  mon: "Senin",
  tue: "Selasa",
  wed: "Rabu",
  thu: "Kamis",
  fri: "Jumat",
  sat: "Sabtu",
};

export function scheduleSummary(spec: ScheduleSpec): string {
  const time = `jam ${spec.time.replace(":", ".")} WIB`;

  const when = {
    daily: `tiap hari ${time}`,
    weekly: `tiap ${DAY_LABEL[spec.dayOfWeek ?? "mon"]} ${time}`,
    once: `${weekdayName(spec.date ?? "")}, ${formatDateId(spec.date ?? "")} ${time}`,
  }[spec.frequency];

  if (spec.kind === "recap")
    return `Kirim rekap ${spec.recapKind === "weekly" ? "mingguan" : "harian"} ${when}`;

  return `Pengingat "${spec.reminderText}" ${when}`;
}

export type Schedule = typeof schedules.$inferSelect;

export function specOf(row: Schedule): ScheduleSpec {
  return scheduleSpecSchema.parse({
    kind: row.kind,
    frequency: row.frequency,
    time: row.time,
    dayOfWeek: row.dayOfWeek,
    date: row.date,
    recapKind: row.recapKind,
    reminderText: row.reminderText,
  });
}

export class ScheduleError extends Error {}

export async function listActiveSchedules(db: Db, businessId: string): Promise<Schedule[]> {
  return db
    .select()
    .from(schedules)
    .where(and(eq(schedules.businessId, businessId), eq(schedules.status, "active")))
    .orderBy(asc(schedules.nextRunAt));
}

// Checks that the owner sees as messages: a duplicate, too many, or a moment already gone.
export function checkNewSchedule(spec: ScheduleSpec, active: Schedule[], now: Date): Date {
  const summary = scheduleSummary(spec);
  const same = active.find((row) => scheduleSummary(specOf(row)) === summary);

  if (same) throw new ScheduleError(`Jadwal ini sudah ada: ${summary}.`);

  if (active.length >= MAX_ACTIVE_SCHEDULES)
    throw new ScheduleError(
      `Jadwal aktif sudah ${MAX_ACTIVE_SCHEDULES}. Batalkan salah satu dulu ya, Kak.`,
    );

  const next = nextRunAt(spec, now);

  if (next === null) throw new ScheduleError("Waktunya sudah lewat, Kak. Pilih waktu lain ya.");

  return next;
}

export async function createSchedule(
  db: Db,
  { businessId, spec, now }: { businessId: string; spec: ScheduleSpec; now: Date },
): Promise<Schedule> {
  const nextRun = checkNewSchedule(spec, await listActiveSchedules(db, businessId), now);

  const [row] = await db
    .insert(schedules)
    .values({ businessId, ...spec, nextRunAt: nextRun })
    .returning();

  if (!row) throw new Error("schedule insert returned no row");

  return row;
}

export async function cancelSchedule(
  db: Db,
  { businessId, scheduleId }: { businessId: string; scheduleId: string },
): Promise<boolean> {
  const cancelled = await db
    .update(schedules)
    .set({ status: "cancelled" })
    .where(
      and(
        eq(schedules.id, scheduleId),
        eq(schedules.businessId, businessId),
        eq(schedules.status, "active"),
      ),
    )
    .returning({ id: schedules.id });

  return cancelled.length > 0;
}

export async function dueSchedules(db: Db, now: Date): Promise<Schedule[]> {
  return db
    .select()
    .from(schedules)
    .where(and(eq(schedules.status, "active"), lte(schedules.nextRunAt, now)))
    .orderBy(asc(schedules.nextRunAt))
    .limit(50);
}

// Moves a due schedule past this run, once: the guard on next_run_at means a second worker (or a
// retried tick) finds nothing to claim and sends nothing (S4-AC3).
export async function claimRun(db: Db, row: Schedule, now: Date): Promise<boolean> {
  const next = row.frequency === "once" ? null : nextRunAt(specOf(row), now);

  const claimed = await db
    .update(schedules)
    .set(next === null ? { status: "done" } : { nextRunAt: next })
    .where(
      and(
        eq(schedules.id, row.id),
        eq(schedules.status, "active"),
        eq(schedules.nextRunAt, row.nextRunAt),
      ),
    )
    .returning({ id: schedules.id });

  return claimed.length > 0;
}
