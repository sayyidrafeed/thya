import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

const MISSING_KEY =
  "NETRA_API_KEY belum diisi. Salin .env.example ke .env di root repo, lalu isi key-nya.";

// All four or none: a partial set used to switch the channel off without a word.
const WHATSAPP_KEYS = [
  "WHATSAPP_ACCESS_TOKEN",
  "WHATSAPP_PHONE_NUMBER_ID",
  "WHATSAPP_APP_SECRET",
  "WHATSAPP_VERIFY_TOKEN",
] as const;

export const env = createEnv({
  server: {
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
  },
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
  createFinalSchema: (serverVars) =>
    z.object(serverVars).superRefine((value, ctx) => {
      const missing = WHATSAPP_KEYS.filter((key) => !value[key]);

      if (missing.length === 0 || missing.length === WHATSAPP_KEYS.length) return;

      ctx.addIssue({
        code: "custom",
        message: `WhatsApp baru terisi sebagian: ${missing.join(", ")} belum diisi. Isi keempatnya untuk menyalakan kanal, atau kosongkan semuanya untuk mematikannya.`,
      });
    }),
  onValidationError: (issues) => {
    const lines = issues.map((issue) => {
      // Zod reports top-level env keys as plain path keys.
      const path = issue.path?.map(String).join(".");

      return path ? `✖ ${issue.message}\n  → at ${path}` : `✖ ${issue.message}`;
    });

    console.error(`Konfigurasi env tidak valid:\n${lines.join("\n")}`);
    process.exit(1);
  },
});

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
