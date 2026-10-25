// Gives a tester's WhatsApp number its own copy of the Kopi Senja demo shop, so what they record
// never touches the web demo. Run: bun run phone:register 6281234567890 (from apps/api).
import { createDb } from "../src/db/client";
import { runMigrations } from "../src/db/migrate";
import { env } from "../src/env";
import { createPhoneBusiness, findBusinessByPhone } from "../src/modules/business";
import { demoBusiness } from "../src/sales/demo-shop";
import { seedDemoSales } from "../src/sales/repository";

const phone = process.argv[2];

if (!phone || !/^\+?\d{9,15}$/.test(phone)) {
  console.error("Pakai: bun run phone:register 6281234567890");
  process.exit(1);
}

const db = createDb(env.DATABASE_URL);

await runMigrations(env.DATABASE_URL);

const existing = await findBusinessByPhone(db, phone);
const business = existing ?? (await createPhoneBusiness(db, demoBusiness, phone));
const seeded = await seedDemoSales(db, business.id, new Date());

console.log(
  `${existing ? "sudah terdaftar" : "terdaftar"}: ${phone} → ${business.name} (${business.id}),`,
  seeded,
);

await db.$client.end();
