import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

// Server and worker both start with this; the advisory lock lets only one apply migrations.
const MIGRATION_LOCK = 4_242_001;

// Its own single connection: the session lock and the migration share it, so concurrent callers
// in one process never wait on a lock held by their own pool (and closing it releases the lock).
export async function runMigrations(url: string) {
  const client = postgres(url, { max: 1, onnotice: () => {} });
  const db = drizzle({ client, casing: "snake_case" });

  try {
    await db.execute(sql`SELECT pg_advisory_lock(${MIGRATION_LOCK})`);
    await migrate(db, { migrationsFolder: new URL("../../drizzle", import.meta.url).pathname });
  } finally {
    await client.end();
  }
}
