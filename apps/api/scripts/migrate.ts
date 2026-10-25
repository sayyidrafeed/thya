// Applies pending migrations. Run: bun run db:migrate (from apps/api). Server start does the same.
import { runMigrations } from "../src/db/migrate";
import { env } from "../src/env";

await runMigrations(env.DATABASE_URL);

console.log("migrations applied");
