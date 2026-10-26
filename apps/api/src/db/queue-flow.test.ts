import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { sql } from "drizzle-orm";
import type { PgBoss } from "pg-boss";
import { AGENT_TURN, createBoss, enqueueAgentTurn, releaseBlockedPhones, startJobs } from "../jobs";
import type { Db } from "./client";
import { freshTestDb, integration } from "./testing";

const OWNER = "6281200000009";

describe.if(integration)("agent-turn queue", () => {
  let db: Db;
  let boss: PgBoss;

  beforeAll(async () => {
    db = await freshTestDb();
    boss = createBoss(process.env.TEST_DATABASE_URL ?? "");
    await startJobs(boss, { db, agentTurn: null, schedules: null, work: false });
    // freshTestDb clears only the public schema; other suites leave jobs in pg-boss's.
    await db.execute(sql`DELETE FROM pgboss.job WHERE name = ${AGENT_TURN}`);
  }, 60_000);

  afterAll(async () => {
    await boss.stop({ graceful: false });
    await db.$client.end();
  });

  test("a job that expired on its last attempt no longer holds the number's next message", async () => {
    await enqueueAgentTurn(boss, OWNER, 0);
    const [first] = await boss.fetch(AGENT_TURN);

    if (!first) throw new Error("expected the first job");

    // What pg-boss leaves when the last attempt runs past expireInSeconds.
    await db.execute(sql`UPDATE pgboss.job SET state = 'failed' WHERE id = ${first.id}`);
    await enqueueAgentTurn(boss, OWNER, 0);

    expect(await boss.fetch(AGENT_TURN)).toEqual([]);

    expect(await releaseBlockedPhones(boss)).toBe(1);

    const [next] = await boss.fetch(AGENT_TURN);

    expect(next?.data).toEqual({ phone: OWNER });
    expect(await releaseBlockedPhones(boss)).toBe(0);
  });
});
