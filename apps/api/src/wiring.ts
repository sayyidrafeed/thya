import { createWhatsAppClient } from "./channels/whatsapp/client";
import type { Delivery } from "./channels/whatsapp/deliver";
import type { Db } from "./db/client";
import { env, whatsapp } from "./env";
import { loadAttachment } from "./modules/attachments";
import { createSheetsAccess } from "./modules/sheets";
import { createBoss, startJobs } from "./jobs";
import { chatModel } from "./llm";

// Shared by server.ts and worker.ts, so both entrypoints run the same jobs with the same clients.
export function whatsappDelivery(db: Db): Delivery | null {
  if (whatsapp === null) return null;

  return {
    db,
    client: createWhatsAppClient(whatsapp),
    loadImage: (attachmentId) => loadAttachment(db, attachmentId, new Date()),
  };
}

// `work`: whether this process works the queues. worker.ts always does; the server only when
// JOBS_IN_SERVER=1, so one container can run everything until a worker service exists.
export async function startWorkers(db: Db, databaseUrl: string, work: boolean) {
  const boss = createBoss(databaseUrl);
  const delivery = whatsappDelivery(db);

  const now = () => new Date();

  const templates = {
    recap: env.WHATSAPP_RECAP_TEMPLATE ?? null,
    reminder: env.WHATSAPP_REMINDER_TEMPLATE ?? null,
    language: env.WHATSAPP_TEMPLATE_LANGUAGE,
  };

  // One access per process, so the Google token cache is shared by every turn.
  const account = env.GOOGLE_SERVICE_ACCOUNT_JSON;
  const sheets = account === null ? null : createSheetsAccess(account);

  await startJobs(boss, {
    db,
    work,
    agentTurn:
      delivery === null
        ? null
        : {
            db,
            model: chatModel,
            delivery,
            now,
            paymentsImport: env.PAYMENTS_IMPORT_ENABLED,
            deliveryImport: env.DELIVERY_IMPORT_ENABLED,
            sheets,
          },
    schedules: delivery === null ? null : { db, now, templates },
  });

  return boss;
}
