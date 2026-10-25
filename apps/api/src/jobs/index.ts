import { PgBoss } from "pg-boss";
import type { Db } from "../db/client";
import { deleteExpiredAttachments } from "../modules/attachments";
import { handleAgentTurn, type AgentTurnDeps } from "./agent-turn";
import { fireDueSchedules, type ScheduleDeps } from "./schedule-fire";

// All pg-boss queues are wired here, in one place (decision Q9a). pg-boss keeps its tables in its
// own `pgboss` schema and owns a small pool next to Drizzle's.

export const AGENT_TURN = "agent-turn";
export const SCHEDULE_TICK = "schedule-tick";
export const ATTACHMENTS_CLEANUP = "attachments-cleanup";

// Messages that arrive within this window are answered as one batch (decided 2026-10-25).
export const BUFFER_SECONDS = 3;

const AGENT_TURN_RETRIES = 3;

export function createBoss(databaseUrl: string) {
  const boss = new PgBoss({ connectionString: databaseUrl, max: 3, application_name: "thya-jobs" });

  boss.on("error", (error) => console.error("pg-boss:", error.message));

  return boss;
}

export type JobDeps = {
  db: Db;
  // Both need WhatsApp; without it the queues exist but nothing works them.
  agentTurn: AgentTurnDeps | null;
  schedules: Omit<ScheduleDeps, "flush"> | null;
};

export async function startJobs(boss: PgBoss, deps: JobDeps) {
  await boss.start();

  // key_strict_fifo: one active job per phone, in arrival order; other phones run in parallel.
  await boss.createQueue(AGENT_TURN, {
    policy: "key_strict_fifo",
    retryLimit: AGENT_TURN_RETRIES,
    retryDelay: 5,
    retryBackoff: true,
    expireInSeconds: 180,
  });

  // One tick at a time; pg-boss cron schedules are stored in its tables, so every instance agrees.
  await boss.createQueue(SCHEDULE_TICK, {
    policy: "singleton",
    retryLimit: 0,
    expireInSeconds: 120,
  });
  await boss.createQueue(ATTACHMENTS_CLEANUP, { policy: "singleton", retryLimit: 1 });
  await boss.schedule(SCHEDULE_TICK, "* * * * *");
  await boss.schedule(ATTACHMENTS_CLEANUP, "17 3 * * *");

  await boss.work(ATTACHMENTS_CLEANUP, async () => {
    const deleted = await deleteExpiredAttachments(deps.db, new Date());

    if (deleted > 0) console.log(`attachments-cleanup: ${deleted} expired`);
  });

  const schedules = deps.schedules;

  if (schedules !== null)
    await boss.work(SCHEDULE_TICK, async () => {
      await fireDueSchedules({ ...schedules, flush: (phone) => enqueueAgentTurn(boss, phone, 0) });
    });

  const agentTurn = deps.agentTurn;

  if (agentTurn !== null)
    await boss.work<{ phone: string }>(AGENT_TURN, { localConcurrency: 4 }, async ([job]) => {
      if (!job) return;

      try {
        await handleAgentTurn(agentTurn, job.data.phone);
      } catch (error) {
        // A failed job would hold back this number's later messages for good (key_strict_fifo),
        // so the last attempt gives up quietly; the unanswered rows join the next message's batch.
        if (job.retryCount < AGENT_TURN_RETRIES) throw error;

        console.error("agent-turn gave up:", error instanceof Error ? error.message : error);
      }
    });
}

// Also used to flush a number's pending sends (schedules): the job delivers before it reads.
export async function enqueueAgentTurn(boss: PgBoss, phone: string, startAfter = BUFFER_SECONDS) {
  await boss.send(AGENT_TURN, { phone }, { singletonKey: phone, startAfter });
}
