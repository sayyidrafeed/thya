import { createWhatsAppClient } from "./channels/whatsapp/client";
import type { Delivery } from "./channels/whatsapp/deliver";
import type { Db } from "./db/client";
import { whatsapp } from "./env";
import { createBoss, startJobs } from "./jobs";
import { chatModel } from "./llm";

// Shared by server.ts and worker.ts, so both entrypoints run the same jobs with the same clients.
export function whatsappDelivery(db: Db): Delivery | null {
  if (whatsapp === null) return null;

  return {
    db,
    client: createWhatsAppClient(whatsapp),
    // Attachments arrive with showChart (S2); until then no payload names one.
    loadImage: async () => null,
  };
}

export async function startWorkers(db: Db, databaseUrl: string) {
  const boss = createBoss(databaseUrl);
  const delivery = whatsappDelivery(db);

  await startJobs(boss, {
    agentTurn: delivery === null ? null : { db, model: chatModel, delivery, now: () => new Date() },
  });

  return boss;
}
