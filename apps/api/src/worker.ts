// Works the pg-boss queues without HTTP: same image as the API, command `bun src/worker.ts`.
// Not needed when the server runs with JOBS_IN_SERVER=1; running both is safe.
import { createDb } from "./db/client";
import { runMigrations } from "./db/migrate";
import { env, whatsapp } from "./env";
import { startWorkers } from "./wiring";

await runMigrations(env.DATABASE_URL);

const boss = await startWorkers(createDb(env.DATABASE_URL), env.DATABASE_URL, true);

console.log(`Worker Thya jalan (WhatsApp ${whatsapp ? "aktif" : "nonaktif"}).`);

process.on("SIGTERM", () => void boss.stop().then(() => process.exit(0)));
