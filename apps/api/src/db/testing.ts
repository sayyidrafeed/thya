import { sql } from "drizzle-orm";
import { createDb, type Db } from "./client";
import { runMigrations } from "./migrate";

// Decision Q9d: tests that need Postgres run only with RUN_INTEGRATION_TESTS=1 and a disposable
// database in TEST_DATABASE_URL (never the seeded one).
export const integration = process.env.RUN_INTEGRATION_TESTS === "1";

export async function freshTestDb(): Promise<Db> {
  const url = process.env.TEST_DATABASE_URL;

  if (!url) throw new Error("RUN_INTEGRATION_TESTS=1 needs TEST_DATABASE_URL");

  await runMigrations(url);

  const db = createDb(url);

  const tables = await db.execute<{ tablename: string }>(
    sql`SELECT tablename FROM pg_tables WHERE schemaname = 'public'`,
  );

  const names = tables.map(({ tablename }) => `"${tablename}"`).join(", ");

  if (names) await db.execute(sql.raw(`TRUNCATE ${names} RESTART IDENTITY CASCADE`));

  return db;
}
