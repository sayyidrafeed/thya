// Clears what rehearsals left on one demo copy, then refills its seed. Dry run unless
// --confirm. Run from apps/api: bun run phone:reset 6281234567890 [--confirm]
import { z } from "zod";
import { createDb } from "../src/db/client";
import { runMigrations } from "../src/db/migrate";
import { env } from "../src/env";
import { resetDemoCopy, type ResetRows } from "../src/modules/business";

const [phone, ...flags] = process.argv.slice(2);

const args = z
  .object({
    phone: z.string().regex(/^\+?\d{9,15}$/),
    flags: z.array(z.literal("--confirm")).max(1),
  })
  .safeParse({ phone, flags });

if (!args.success) {
  console.error("Pakai: bun run phone:reset 6281234567890 [--confirm]");
  process.exit(1);
}

const confirm = args.data.flags.length === 1;
const db = createDb(env.DATABASE_URL);

await runMigrations(env.DATABASE_URL);

const result = await resetDemoCopy(db, args.data.phone, { confirm, now: new Date() });

await db.$client.end();

const perTable = (rows: ResetRows) => rows.map((row) => `  ${row.table}: ${row.rows}`).join("\n");

if (result.status === "not_registered") {
  console.error("Nomor ini belum terdaftar. Tidak ada yang dihapus.");
  process.exit(1);
}

if (result.status === "not_demo_copy") {
  console.error(`${result.name} bukan salinan demo, jadi tidak direset. Tidak ada yang dihapus.`);
  process.exit(1);
}

if (result.status === "dry_run") {
  console.log(`Dry run untuk ${result.name} (${result.businessId}), belum ada yang dihapus:`);
  console.log(perTable(result.rows));
  console.log(
    "Jalankan lagi dengan --confirm untuk menghapus baris ini dan mengisi ulang seed demo.",
  );
} else {
  console.log(`Direset: ${result.name} (${result.businessId}). Baris yang dihapus:`);
  console.log(perTable(result.rows));
  console.log("Seed demo diisi ulang:", result.seeded);
}
