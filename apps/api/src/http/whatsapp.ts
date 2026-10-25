import { Elysia } from "elysia";
import type { PgBoss } from "pg-boss";
import { inboundMessages, webhookSchema } from "../channels/whatsapp/inbound";
import { verifySignature } from "../channels/whatsapp/signature";
import type { Db } from "../db/client";
import { enqueueAgentTurn } from "../jobs";
import { recordInbound } from "../modules/conversation";

export type WebhookConfig = { appSecret: string; verifyToken: string; phoneNumberId: string };

// Harness §4: verify, store (the wamid key drops redeliveries), enqueue, answer 200 fast. The model
// never runs inside the request.
export function whatsappWebhook(db: Db, boss: PgBoss, config: WebhookConfig) {
  return new Elysia()
    .get("/webhook/whatsapp", ({ query, status }) => {
      const ok =
        query["hub.mode"] === "subscribe" && query["hub.verify_token"] === config.verifyToken;

      return ok ? (query["hub.challenge"] ?? "") : status(403, "forbidden");
    })
    .post(
      "/webhook/whatsapp",
      async ({ request, status }) => {
        const raw = await request.text();

        if (!verifySignature(raw, request.headers.get("x-hub-signature-256"), config.appSecret))
          return status(401, "invalid signature");

        let json: object;

        try {
          json = JSON.parse(raw);
        } catch {
          return status(400, "invalid json");
        }

        const parsed = webhookSchema.safeParse(json);

        // A signed payload of a shape Thya does not read (account updates, new fields) is not an
        // error worth Meta's retries.
        if (!parsed.success) return { ok: true };

        const messages = inboundMessages(parsed.data, config.phoneNumberId);

        await recordInbound(
          db,
          messages.map(({ wamid, phone, type, payload, receivedAt }) => ({
            wamid,
            phone,
            type,
            payload,
            receivedAt,
          })),
        );

        // Enqueued even for a duplicate: the job finds nothing new and stops. A failed enqueue
        // answers 500, so Meta redelivers and the stored message gets its job.
        for (const phone of new Set(messages.map((message) => message.phone)))
          await enqueueAgentTurn(boss, phone);

        return { ok: true };
      },
      { parse: "none" },
    );
}
