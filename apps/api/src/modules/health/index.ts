import { sql } from "drizzle-orm";
import type { Db } from "../../db/client";
import { SCHEDULE_TICK } from "../../jobs";

// pg-boss enqueues a tick every minute; one still waiting after this long means no process works the queues.
export const STALLED_AFTER_SECONDS = 180;

const DB_TIMEOUT_MS = 2000;

export type Health = {
  status: "ok" | "degraded" | "down";
  db: "ok" | "down";
  // "off": WhatsApp is off, so nothing works the tick and its lag says nothing about a worker.
  jobs: "ok" | "stalled" | "down" | "off" | "unknown";
  whatsapp: "on" | "off";
  queueLagSeconds: number | null;
};

export type HealthInput = { db: Db; jobsStarted: boolean; whatsappConfigured: boolean };

export async function checkHealth({
  db,
  jobsStarted,
  whatsappConfigured,
}: HealthInput): Promise<Health> {
  const base = {
    whatsapp: whatsappConfigured && jobsStarted ? "on" : "off",
    queueLagSeconds: null,
  } as const;

  const dbUp = await withTimeout(db.execute(sql`SELECT 1`)).then(
    () => true,
    () => false,
  );

  if (!dbUp) return { ...base, status: "down", db: "down", jobs: "unknown" };

  if (!jobsStarted) return { ...base, status: "degraded", db: "ok", jobs: "down" };

  if (!whatsappConfigured) return { ...base, status: "ok", db: "ok", jobs: "off" };

  const lag = await withTimeout(oldestDueTickSeconds(db)).catch(() => undefined);

  if (lag === undefined) return { ...base, status: "degraded", db: "ok", jobs: "unknown" };

  const stalled = lag >= STALLED_AFTER_SECONDS;

  return {
    ...base,
    status: stalled ? "degraded" : "ok",
    db: "ok",
    jobs: stalled ? "stalled" : "ok",
    queueLagSeconds: lag,
  };
}

async function oldestDueTickSeconds(db: Db) {
  const [row] = await db.execute<{ lag: number | null }>(sql`
    SELECT floor(extract(epoch FROM now() - min(start_after)))::int AS lag
    FROM pgboss.job
    WHERE name = ${SCHEDULE_TICK} AND state = 'created' AND start_after <= now()
  `);

  return row?.lag ?? 0;
}

function withTimeout<T>(work: Promise<T>) {
  let timer: ReturnType<typeof setTimeout> | undefined;

  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error("health check timed out")), DB_TIMEOUT_MS);
  });

  return Promise.race([work, timeout]).finally(() => clearTimeout(timer));
}
