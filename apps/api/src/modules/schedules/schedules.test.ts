import { describe, expect, test } from "bun:test";
import { nextRunAt, scheduleSpecSchema, scheduleSummary, type ScheduleSpec } from ".";

const base: ScheduleSpec = {
  kind: "recap",
  frequency: "daily",
  time: "21:00",
  dayOfWeek: null,
  date: null,
  recapKind: "daily",
  reminderText: null,
};

const at = (iso: string) => new Date(iso);

describe("nextRunAt (WIB, S4-AC2)", () => {
  test("daily: today if the time is still ahead, tomorrow once it has passed", () => {
    expect(nextRunAt(base, at("2026-10-25T14:00:00+07:00"))).toEqual(
      at("2026-10-25T21:00:00+07:00"),
    );
    expect(nextRunAt(base, at("2026-10-25T21:00:00+07:00"))).toEqual(
      at("2026-10-26T21:00:00+07:00"),
    );
  });

  test("the WIB day decides, not the UTC one", () => {
    const early = { ...base, time: "06:00" };

    // 23:30 UTC on the 25th is already 06:30 WIB on the 26th.
    expect(nextRunAt(early, at("2026-10-25T23:30:00Z"))).toEqual(at("2026-10-27T06:00:00+07:00"));
    // 22:30 UTC on the 25th is 05:30 WIB on the 26th: today's 06:00 is still ahead.
    expect(nextRunAt(early, at("2026-10-25T22:30:00Z"))).toEqual(at("2026-10-26T06:00:00+07:00"));
  });

  test("weekly lands on the named day, including later the same day", () => {
    const monday = {
      ...base,
      frequency: "weekly" as const,
      dayOfWeek: "mon" as const,
      time: "06:00",
    };

    // 25 Oct 2026 is a Sunday.
    expect(nextRunAt(monday, at("2026-10-25T14:00:00+07:00"))).toEqual(
      at("2026-10-26T06:00:00+07:00"),
    );
    expect(nextRunAt(monday, at("2026-10-26T05:59:00+07:00"))).toEqual(
      at("2026-10-26T06:00:00+07:00"),
    );
    expect(nextRunAt(monday, at("2026-10-26T06:00:00+07:00"))).toEqual(
      at("2026-11-02T06:00:00+07:00"),
    );
  });

  test("once: its moment, or null when that has passed; month ends roll over", () => {
    const once = {
      ...base,
      kind: "reminder" as const,
      frequency: "once" as const,
      date: "2026-10-31",
      time: "23:59",
      recapKind: null,
      reminderText: "bayar listrik",
    };

    expect(nextRunAt(once, at("2026-10-31T23:58:00+07:00"))).toEqual(
      at("2026-10-31T23:59:00+07:00"),
    );
    expect(nextRunAt(once, at("2026-11-01T00:00:00+07:00"))).toBeNull();
    expect(nextRunAt({ ...base, time: "00:00" }, at("2026-10-31T12:00:00+07:00"))).toEqual(
      at("2026-11-01T00:00:00+07:00"),
    );
  });
});

describe("schedule spec", () => {
  test("cross-field rules are worded for the owner", () => {
    const weekly = scheduleSpecSchema.safeParse({ ...base, frequency: "weekly" });
    const reminder = scheduleSpecSchema.safeParse({ ...base, kind: "reminder", recapKind: null });
    const badTime = scheduleSpecSchema.safeParse({ ...base, time: "9 malam" });

    expect(weekly.error?.issues[0]?.message).toBe("Jadwal mingguan butuh harinya.");
    expect(reminder.error?.issues[0]?.message).toBe("Isi pengingatnya belum ada.");
    expect(badTime.success).toBe(false);
  });

  test("summaries", () => {
    expect(scheduleSummary(base)).toBe("Kirim rekap harian tiap hari jam 21.00 WIB");
    expect(
      scheduleSummary({
        ...base,
        kind: "reminder",
        frequency: "once",
        date: "2026-10-26",
        time: "09:00",
        recapKind: null,
        reminderText: "bayar listrik",
      }),
    ).toBe('Pengingat "bayar listrik" Senin, 26 Okt 2026 jam 09.00 WIB');
  });
});
