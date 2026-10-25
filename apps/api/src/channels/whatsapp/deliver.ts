import type { Db } from "../../db/client";
import { markOutbound, pendingOutbound, type OutboundPayload } from "../../modules/conversation";
import { WhatsAppError, type WhatsAppClient } from "./client";

export type Delivery = {
  db: Db;
  client: WhatsAppClient;
  loadImage: (attachmentId: string) => Promise<Uint8Array | null>;
};

async function sendImage(
  delivery: Delivery,
  to: string,
  attachmentId: string,
  caption: string | null,
) {
  const png = await delivery.loadImage(attachmentId);

  try {
    if (png === null) throw new WhatsAppError("attachment expired", null, false);

    return await delivery.client.sendImage(to, await delivery.client.uploadImage(png), caption);
  } catch (error) {
    // S2: a failed upload costs the picture, never the answer; no endless retry on the media.
    console.error(
      "whatsapp image failed, sending text:",
      error instanceof Error ? error.message : error,
    );

    return delivery.client.sendText(to, caption ?? "Grafiknya belum bisa dikirim, Kak.");
  }
}

async function send(delivery: Delivery, payload: OutboundPayload): Promise<string> {
  const { client } = delivery;

  if (payload.type === "text") return client.sendText(payload.to, payload.text);

  if (payload.type === "image")
    return sendImage(delivery, payload.to, payload.attachmentId, payload.caption);

  if (payload.type === "buttons")
    return client.sendButtons(payload.to, payload.body, payload.buttons);

  const png = payload.attachmentId ? await delivery.loadImage(payload.attachmentId) : null;

  return client.sendTemplate(payload.to, {
    name: payload.name,
    language: payload.language,
    bodyParams: payload.bodyParams,
    headerImageId: png ? await client.uploadImage(png) : null,
  });
}

// Sends every pending row for this number in order. A retryable failure (429, 5xx, network) throws
// so the job retries with the row still pending; any other failure is recorded and skipped.
export async function deliverPending(delivery: Delivery, to: string): Promise<number> {
  let sent = 0;

  for (const { id, payload } of await pendingOutbound(delivery.db, to)) {
    try {
      const wamid = await send(delivery, payload);
      await markOutbound(delivery.db, id, { status: "sent", wamid });
      sent += 1;
    } catch (error) {
      if (!(error instanceof WhatsAppError) || error.retryable) throw error;

      await markOutbound(delivery.db, id, {
        status: "failed",
        error: `${error.code}: ${error.message}`,
      });
    }
  }

  return sent;
}
