// Runs the pg-boss jobs without HTTP. The server starts the same jobs itself (one container on the
// VPS), so this entrypoint is for splitting them out later; running both is safe.
import { createDb } from "./db/client";
import { runMigrations } from "./db/migrate";
import { env, whatsapp } from "./env";
import { startWorkers } from "./wiring";

await runMigrations(env.DATABASE_URL);

const boss = await startWorkers(createDb(env.DATABASE_URL), env.DATABASE_URL);

console.log(`Worker Thya jalan (WhatsApp ${whatsapp ? "aktif" : "nonaktif"}).`);

process.on("SIGTERM", () => void boss.stop().then(() => process.exit(0)));
