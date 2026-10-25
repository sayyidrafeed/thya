import { createWhatsAppClient } from "./channels/whatsapp/client";
import type { Delivery } from "./channels/whatsapp/deliver";
import type { Db } from "./db/client";
import { env, whatsapp } from "./env";
import { loadAttachment } from "./modules/attachments";
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

export async function startWorkers(db: Db, databaseUrl: string) {
  const boss = createBoss(databaseUrl);
  const delivery = whatsappDelivery(db);

  const now = () => new Date();

  const templates = {
    recap: env.WHATSAPP_RECAP_TEMPLATE ?? null,
    reminder: env.WHATSAPP_REMINDER_TEMPLATE ?? null,
    language: env.WHATSAPP_TEMPLATE_LANGUAGE,
  };

  await startJobs(boss, {
    db,
    agentTurn: delivery === null ? null : { db, model: chatModel, delivery, now },
    schedules: delivery === null ? null : { db, now, templates },
  });

  return boss;
}
