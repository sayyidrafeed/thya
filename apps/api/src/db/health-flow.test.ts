import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { sql } from "drizzle-orm";
import type { PgBoss } from "pg-boss";
import { healthRoute } from "../http/health";
import { createBoss, SCHEDULE_TICK, startJobs } from "../jobs";
import { checkHealth, type Health } from "../modules/health";
import { createDb, type Db } from "./client";
import { freshTestDb, integration } from "./testing";

function get(app: ReturnType<typeof healthRoute>) {
  return app.handle(new Request("http://thya/health"));
}

test("an unreachable database answers 503 so the container gets restarted", async () => {
  const db = createDb("postgres://u:p@127.0.0.1:1/none");
  const response = await get(healthRoute({ db, jobsStarted: true, whatsappConfigured: true }));

  expect(response.status).toBe(503);
  expect(await response.json()).toMatchObject({ status: "down", db: "down" });

  await db.$client.end();
});

describe.if(integration)("health against Postgres and pg-boss", () => {
  let db: Db;
  let boss: PgBoss;

  beforeAll(async () => {
    db = await freshTestDb();
    boss = createBoss(process.env.TEST_DATABASE_URL ?? "");
    await startJobs(boss, { db, agentTurn: null, schedules: null, work: false });
  }, 60_000);

  afterAll(async () => {
    await boss.stop({ graceful: false });
    await db.$client.end();
  });

  beforeEach(async () => {
    await db.execute(sql`DELETE FROM pgboss.job WHERE name = ${SCHEDULE_TICK}`);
  });

  async function dueTickWaiting(minutes: number) {
    await boss.send(SCHEDULE_TICK, {});
    await db.execute(sql`
      UPDATE pgboss.job SET start_after = now() - make_interval(mins => ${minutes})
      WHERE name = ${SCHEDULE_TICK}
    `);
  }

  test("WhatsApp off: the tick lag is not judged", async () => {
    await dueTickWaiting(10);

    expect(await checkHealth({ db, jobsStarted: true, whatsappConfigured: false })).toEqual({
      status: "ok",
      db: "ok",
      jobs: "off",
      whatsapp: "off",
      queueLagSeconds: null,
    });
  });

  test("queues that failed to start are degraded", async () => {
    expect(await checkHealth({ db, jobsStarted: false, whatsappConfigured: true })).toMatchObject({
      status: "degraded",
      jobs: "down",
      whatsapp: "off",
    });
  });

  test("WhatsApp on and the tick is worked: ok", async () => {
    expect(await checkHealth({ db, jobsStarted: true, whatsappConfigured: true })).toEqual({
      status: "ok",
      db: "ok",
      jobs: "ok",
      whatsapp: "on",
      queueLagSeconds: 0,
    });
  });

  test("WhatsApp on and nobody works the tick: stalled, still 200", async () => {
    await dueTickWaiting(5);

    const response = await get(healthRoute({ db, jobsStarted: true, whatsappConfigured: true }));
    // SAFETY: the route returns checkHealth's Health object as JSON.
    const body = (await response.json()) as Health;

    expect(response.status).toBe(200);
    expect(body).toMatchObject({ status: "degraded", jobs: "stalled", whatsapp: "on" });
    expect(body.queueLagSeconds).toBeGreaterThanOrEqual(300);
  });
});
