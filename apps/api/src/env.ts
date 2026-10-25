import { z } from "zod";

const MISSING_KEY =
  "NETRA_API_KEY belum diisi. Salin .env.example ke .env di root repo, lalu isi key-nya.";

const envSchema = z.object({
  NETRA_API_KEY: z.string({ error: MISSING_KEY }).min(1, MISSING_KEY),
  NETRA_BASE_URL: z.url().default("https://api.netraruntime.com/v1"),
  NETRA_MODEL: z.string().min(1).default("deepseek/deepseek-v4.1-flash"),
  DATABASE_URL: z.url({ error: "DATABASE_URL belum diisi. Lihat .env.example." }),
  PORT: z.coerce.number().int().positive().default(3001),
  WEB_ORIGINS: z
    .string()
    .default("http://localhost:3000")
    .transform((value) =>
      value
        .split(",")
        .map((origin) => origin.trim())
        .filter(Boolean),
    ),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error(`Konfigurasi env tidak valid:\n${z.prettifyError(parsed.error)}`);
  process.exit(1);
}

export const env = parsed.data;
