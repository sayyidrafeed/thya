// A pilot owner's own business, menu, prices and costs, without demo data. Consent first (runbook).
// Run from apps/api: bun run pilot:onboard path/to/pilot.json (shape: scripts/pilot-onboarding.example.json)
import { z } from "zod";
import { createDb } from "../src/db/client";
import { runMigrations } from "../src/db/migrate";
import { env } from "../src/env";
import { onboardBusiness, onboardingFileSchema } from "../src/modules/business";

const FIELD_NAMES = {
  category: "kategori",
  price: "harga",
  cost: "modal",
  name: "nama",
  kind: "jenis",
  city: "kota",
  openHour: "jam buka",
  closeHour: "jam tutup",
};

const path = process.argv[2];

if (!path) {
  console.error("Pakai: bun run pilot:onboard path/ke/pilot.json");
  process.exit(1);
}

const file = await Bun.file(path)
  .json()
  .catch(() => undefined);

if (file === undefined) {
  console.error(`File ${path} tidak ditemukan atau isinya bukan JSON.`);
  process.exit(1);
}

const parsed = onboardingFileSchema.safeParse(file);

if (!parsed.success) {
  console.error(`File onboarding belum benar:\n${z.prettifyError(parsed.error)}`);
  process.exit(1);
}

const db = createDb(env.DATABASE_URL);

await runMigrations(env.DATABASE_URL);

const result = await onboardBusiness(db, parsed.data, new Date());

await db.$client.end();

if (result.status === "demo_copy") {
  console.error(
    "Nomor ini salinan demo (phone:register) yang berisi data contoh, jadi tidak di-onboard. Pakai nomor lain.",
  );
  process.exit(1);
}

const { name } = parsed.data.business;

console.log(
  result.status === "created"
    ? `Usaha pilot dibuat: ${name} (${result.businessId}).`
    : `Usaha pilot sudah ada (${result.businessId}).`,
);

console.log(
  result.added.length > 0 ? `Menu baru: ${result.added.join(", ")}.` : "Tidak ada menu baru.",
);

if (result.kept.length > 0)
  console.log(
    `Tidak diubah karena beda dengan yang tersimpan: ${result.kept
      .map((item) => `${item.name} (${item.fields.map((field) => FIELD_NAMES[field]).join(", ")})`)
      .join("; ")}.`,
  );

if (result.profileKept.length > 0)
  console.log(
    `Profil di file beda dengan yang tersimpan dan tidak diubah: ${result.profileKept.map((field) => FIELD_NAMES[field]).join(", ")}.`,
  );
