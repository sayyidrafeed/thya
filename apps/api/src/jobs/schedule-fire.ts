import type { ModelMessage } from "ai";
import { CAPTION_LIMIT } from "../channels/whatsapp/client";
import type { Db } from "../db/client";
import { saveAttachment } from "../modules/attachments";
import { businessPhone, findBusiness } from "../modules/business";
import {
  commitTurn,
  lastInboundAt,
  pendingRecipients,
  type Outbound,
} from "../modules/conversation";
import { buildRecap } from "../modules/recaps";
import {
  claimRun,
  dueSchedules,
  scheduleSummary,
  specOf,
  type Schedule,
} from "../modules/schedules";
import { renderSummaryCard } from "../modules/visuals";
import { loadSalesDataset } from "../sales/repository";
import { loadConceptEvents } from "../semantic/repository";
import { newTraceId } from "../trace";

// Business-features-plan S4: runs due schedules without the model. Reminder text is sent as the
// owner wrote it and never executed (S4-AC7).

export type Templates = { recap: string | null; reminder: string | null; language: string };

export type ScheduleDeps = {
  db: Db;
  now: () => Date;
  templates: Templates;
  // Sends go through the phone's agent-turn queue, so they never race a reply to the same number.
  flush: (phone: string) => Promise<void>;
};

// Rows still pending this long after their commit lost their sender (a crash); flush them again.
const STALE_PENDING_MS = 5 * 60 * 1000;

// S4-AC4: free-form only while the 24-hour window is surely open, with 10 minutes for the queue.
export const WINDOW_MS = 23 * 60 * 60 * 1000 + 50 * 60 * 1000;

const RECAP_LATE_LIMIT_MS = 2 * 60 * 60 * 1000;
const REMINDER_LATE_LIMIT_MS = 24 * 60 * 60 * 1000;
const LATE_NOTICE_MS = 10 * 60 * 1000;

export function windowOpen(lastInbound: Date | null, now: Date): boolean {
  return lastInbound !== null && now.getTime() - lastInbound.getTime() < WINDOW_MS;
}

type Run = {
  text: string;
  png: Uint8Array | null;
  templateParams: string[];
  template: string | null;
};

// One line for a template parameter: Meta rejects newlines and long runs of spaces there.
const oneLine = (text: string) =>
  text
    .replace(/\s*\n+\s*/g, " · ")
    .replace(/\s{4,}/g, " ")
    .slice(0, 900);

async function recapRun(deps: ScheduleDeps, row: Schedule, now: Date): Promise<Run> {
  const business = await findBusiness(deps.db, row.businessId);
  const kind = row.recapKind === "weekly" ? "weekly" : "daily";

  const recap = buildRecap(
    {
      dataset: await loadSalesDataset(deps.db, row.businessId, now),
      businessName: business?.name ?? "",
    },
    kind,
    await loadConceptEvents(deps.db, row.businessId),
  );

  return {
    text: recap.text,
    png: recap.card ? renderSummaryCard(recap.card) : null,
    template: deps.templates.recap,
    templateParams: [kind === "weekly" ? "mingguan" : "harian", oneLine(recap.text)],
  };
}

function reminderRun(deps: ScheduleDeps, row: Schedule, lateMs: number): Run {
  const text = row.reminderText ?? "";

  const body =
    lateMs > REMINDER_LATE_LIMIT_MS
      ? `Maaf Kak, pengingat "${text}" tadi terlewat dan belum terkirim tepat waktu.`
      : `${lateMs > LATE_NOTICE_MS ? "(Terlambat, maaf Kak) " : ""}Pengingat yang Kakak minta: ${text}`;

  return {
    text: body,
    png: null,
    template: deps.templates.reminder,
    templateParams: [oneLine(text)],
  };
}

async function outboundFor(deps: ScheduleDeps, row: Schedule, run: Run, to: string, now: Date) {
  const key = `schedule:${row.id}:${row.nextRunAt.toISOString()}`;

  const attachmentId = run.png
    ? (
        await saveAttachment(deps.db, {
          businessId: row.businessId,
          kind: "summary_card",
          png: run.png,
          now,
        })
      ).id
    : null;

  if (windowOpen(await lastInboundAt(deps.db, row.businessId), now)) {
    const payload =
      attachmentId && run.text.length <= CAPTION_LIMIT
        ? { type: "image" as const, to, attachmentId, caption: run.text }
        : { type: "text" as const, to, text: run.text };

    return [{ key, payload }];
  }

  // Outside the window only an approved template may go out; without one, nothing is sent and
  // the incident stays in the log (S4: never free-form outside the window).
  if (run.template === null) {
    console.error(`schedule ${row.id}: 24-hour window closed and no template configured`);

    return [];
  }

  return [
    {
      key,
      payload: {
        type: "template" as const,
        to,
        name: run.template,
        language: deps.templates.language,
        bodyParams: run.templateParams,
        attachmentId,
      },
    },
  ];
}

// Returns the number to flush, or null when nothing was queued.
async function fire(deps: ScheduleDeps, row: Schedule, now: Date): Promise<string | null> {
  const to = await businessPhone(deps.db, row.businessId);
  const lateMs = now.getTime() - row.nextRunAt.getTime();

  // Claimed before anything is built, so a second tick or worker never sends the same run.
  if (!(await claimRun(deps.db, row, now))) return null;

  if (to === null) return null;

  if (row.kind === "recap" && lateMs > RECAP_LATE_LIMIT_MS) {
    console.error(
      `schedule ${row.id}: recap ${Math.round(lateMs / 60_000)} min late, skipped once`,
    );

    return null;
  }

  const run =
    row.kind === "recap" ? await recapRun(deps, row, now) : reminderRun(deps, row, lateMs);

  const outbound: Outbound[] = await outboundFor(deps, row, run, to, now);

  const history: ModelMessage[] =
    outbound.length > 0 ? [{ role: "assistant", content: run.text }] : [];

  await commitTurn(deps.db, {
    businessId: row.businessId,
    traceId: newTraceId(),
    wamids: [],
    history,
    outbound,
  });

  return outbound.length > 0 ? to : null;
}

// Every minute (pg-boss cron), one tick at a time.
export async function fireDueSchedules(deps: ScheduleDeps) {
  const now = deps.now();

  const phones = new Set(
    await pendingRecipients(deps.db, new Date(now.getTime() - STALE_PENDING_MS)),
  );

  for (const row of await dueSchedules(deps.db, now)) {
    try {
      const to = await fire(deps, row, now);

      if (to) phones.add(to);
    } catch (error) {
      console.error(
        `schedule ${row.id} (${scheduleSummary(specOf(row))}) failed:`,
        error instanceof Error ? error.message : error,
      );
    }
  }

  for (const phone of phones) await deps.flush(phone);
}
