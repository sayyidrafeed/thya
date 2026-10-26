// Works the pg-boss queues: same image as the API, command `bun src/worker.ts`.
// Not needed when the server runs with JOBS_IN_SERVER=1; running both is safe.
import { Elysia } from "elysia";
import { createDb } from "./db/client";
import { runMigrations } from "./db/migrate";
import { env, whatsapp } from "./env";
import { healthRoute } from "./http/health";
import { startWorkers } from "./wiring";

await runMigrations(env.DATABASE_URL);

const db = createDb(env.DATABASE_URL);
const boss = await startWorkers(db, env.DATABASE_URL, true);

// The image HEALTHCHECK probes /health on PORT; without it the platform restarts the worker every
// few minutes and the queues never drain (2026-10-26). Not routed publicly.
new Elysia()
  .use(healthRoute({ db, jobsStarted: true, whatsappConfigured: whatsapp !== null }))
  .listen(env.PORT);

console.log(
  `Worker Thya jalan (WhatsApp ${whatsapp ? "aktif" : "nonaktif"}, health di :${env.PORT}).`,
);

process.on("SIGTERM", () => void boss.stop().then(() => process.exit(0)));
