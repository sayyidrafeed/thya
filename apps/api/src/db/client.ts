import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export type Db = ReturnType<typeof createDb>;

// Callers pass the URL so modules and tests never read env on import.
export function createDb(url: string) {
  // Migrations re-run on every start and Postgres answers with "already exists" notices.
  const client = postgres(url, { max: 5, onnotice: () => {} });

  return drizzle({ client, schema, casing: "snake_case" });
}
