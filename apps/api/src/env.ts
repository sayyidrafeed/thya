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
  // WhatsApp Cloud API. The channel turns on only when all four are set (morning-handoff.md).
  WHATSAPP_ACCESS_TOKEN: z.string().min(1).optional(),
  WHATSAPP_PHONE_NUMBER_ID: z.string().min(1).optional(),
  WHATSAPP_APP_SECRET: z.string().min(1).optional(),
  WHATSAPP_VERIFY_TOKEN: z.string().min(1).optional(),
  // Approved utility templates for sends outside the 24-hour window (morning-handoff.md).
  WHATSAPP_RECAP_TEMPLATE: z.string().min(1).optional(),
  WHATSAPP_REMINDER_TEMPLATE: z.string().min(1).optional(),
  WHATSAPP_TEMPLATE_LANGUAGE: z.string().min(2).default("id"),
  // 1 = the API process also works the job queues (no separate worker service needed).
  JOBS_IN_SERVER: z
    .enum(["0", "1"])
    .default("0")
    .transform((value) => value === "1"),
  // Gate G11: reading QRIS/GoPay screenshots stays off until real screenshots pass S9-AC1.
  PAYMENTS_IMPORT_ENABLED: z
    .enum(["0", "1"])
    .default("0")
    .transform((value) => value === "1"),
  WHATSAPP_GRAPH_VERSION: z
    .string()
    .regex(/^v\d+\.\d+$/)
    .default("v23.0"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error(`Konfigurasi env tidak valid:\n${z.prettifyError(parsed.error)}`);
  process.exit(1);
}

export const env = parsed.data;

function whatsappConfig() {
  const {
    WHATSAPP_ACCESS_TOKEN,
    WHATSAPP_PHONE_NUMBER_ID,
    WHATSAPP_APP_SECRET,
    WHATSAPP_VERIFY_TOKEN,
  } = env;

  if (
    !WHATSAPP_ACCESS_TOKEN ||
    !WHATSAPP_PHONE_NUMBER_ID ||
    !WHATSAPP_APP_SECRET ||
    !WHATSAPP_VERIFY_TOKEN
  )
    return null;

  return {
    accessToken: WHATSAPP_ACCESS_TOKEN,
    phoneNumberId: WHATSAPP_PHONE_NUMBER_ID,
    appSecret: WHATSAPP_APP_SECRET,
    verifyToken: WHATSAPP_VERIFY_TOKEN,
    graphVersion: env.WHATSAPP_GRAPH_VERSION,
  };
}

export const whatsapp = whatsappConfig();
