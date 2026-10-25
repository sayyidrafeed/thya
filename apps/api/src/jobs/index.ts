import { PgBoss } from "pg-boss";
import { handleAgentTurn, type AgentTurnDeps } from "./agent-turn";

// All pg-boss queues are wired here, in one place (decision Q9a). pg-boss keeps its tables in its
// own `pgboss` schema and owns a small pool next to Drizzle's.

export const AGENT_TURN = "agent-turn";

// Messages that arrive within this window are answered as one batch (decided 2026-10-25).
export const BUFFER_SECONDS = 3;

const AGENT_TURN_RETRIES = 3;

export function createBoss(databaseUrl: string) {
  const boss = new PgBoss({ connectionString: databaseUrl, max: 3, application_name: "thya-jobs" });

  boss.on("error", (error) => console.error("pg-boss:", error.message));

  return boss;
}

export type JobDeps = { agentTurn: AgentTurnDeps | null };

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

export async function enqueueAgentTurn(boss: PgBoss, phone: string) {
  await boss.send(AGENT_TURN, { phone }, { singletonKey: phone, startAfter: BUFFER_SECONDS });
}
