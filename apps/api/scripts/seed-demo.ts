// Seeds the Kopi Senja demo business into Postgres (idempotent). Run: bun run db:seed (from apps/api).
import { createDb } from "../src/db/client";
import { runMigrations } from "../src/db/migrate";
import { env } from "../src/env";
import { ensureDemoBusiness } from "../src/modules/business";
import { seedDemoSales } from "../src/sales/repository";

const db = createDb(env.DATABASE_URL);

await runMigrations(env.DATABASE_URL);

const business = await ensureDemoBusiness(db);
const result = await seedDemoSales(db, business.id, new Date());

console.log(`demo ${business.name} (${business.id}):`, result);

await db.$client.end();
