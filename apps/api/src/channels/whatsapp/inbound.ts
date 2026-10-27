import { z } from "zod";
import type { DeliveryStatus } from "../../modules/conversation";

// Only the fields Thya reads; everything else in Meta's payload passes through untouched.
export const messageSchema = z.object({
  from: z.string().min(1),
  id: z.string().min(1),
  timestamp: z.string(),
  type: z.string(),
  text: z.object({ body: z.string() }).optional(),
  interactive: z
    .object({
      type: z.string(),
      button_reply: z.object({ id: z.string(), title: z.string() }).optional(),
    })
    .optional(),
  image: z
    .object({ id: z.string(), mime_type: z.string().optional(), caption: z.string().optional() })
    .optional(),
  // A reply carries `id`; a forwarded text or image carries only `forwarded` (forwarded up to 5
  // times) or `frequently_forwarded` (more than 5). Meta webhook reference, messages/text and
  // messages/image: developers.facebook.com/documentation/business-messaging/whatsapp/webhooks/reference/messages/text
  context: z
    .object({
      id: z.string().optional(),
      forwarded: z.boolean().optional(),
      frequently_forwarded: z.boolean().optional(),
    })
    .optional(),
});

// Meta reports each sent message's fate here; `errors` comes with "failed".
const statusSchema = z.object({
  id: z.string().min(1),
  status: z.string(),
  timestamp: z.string(),
  errors: z
    .array(
      z.object({ code: z.number(), title: z.string().optional(), message: z.string().optional() }),
    )
    .optional(),
});

export const webhookSchema = z.object({
  object: z.string(),
  entry: z.array(
    z.object({
      changes: z.array(
        z.object({
          field: z.string(),
          value: z.object({
            metadata: z.object({ phone_number_id: z.string() }).optional(),
            messages: z.array(messageSchema).optional(),
            // Parsed one by one later: an odd status must never cost the messages beside it.
            statuses: z.array(z.unknown()).optional(),
          }),
        }),
      ),
    }),
  ),
});

export type WebhookMessage = z.infer<typeof messageSchema>;

export type InboundMessage = {
  wamid: string;
  phone: string;
  type: string;
  receivedAt: Date;
  payload: WebhookMessage;
};

type Webhook = z.infer<typeof webhookSchema>;

function ownChanges(body: Webhook, phoneNumberId: string) {
  return body.entry
    .flatMap((entry) => entry.changes)
    .filter((change) => change.field === "messages")
    .filter(
      (change) => (change.value.metadata?.phone_number_id ?? phoneNumberId) === phoneNumberId,
    );
}

// Statuses carry no owner message, so they yield nothing here (see deliveryStatuses).
export function inboundMessages(body: Webhook, phoneNumberId: string) {
  return ownChanges(body, phoneNumberId)
    .flatMap((change) => change.value.messages ?? [])
    .map((message): InboundMessage => ({
      wamid: message.id,
      phone: message.from,
      type: message.type,
      receivedAt: new Date(Number(message.timestamp) * 1000),
      payload: message,
    }));
}

// "sent" adds nothing to what the send call already returned, so only the later fates are kept.
export function deliveryStatuses(body: Webhook, phoneNumberId: string): DeliveryStatus[] {
  return ownChanges(body, phoneNumberId)
    .flatMap((change) => change.value.statuses ?? [])
    .flatMap((raw) => {
      const parsed = statusSchema.safeParse(raw);

      if (!parsed.success) return [];

      const status = parsed.data;

      if (status.status !== "delivered" && status.status !== "read" && status.status !== "failed")
        return [];

      const [error] = status.errors ?? [];

      return [
        {
          wamid: status.id,
          status: status.status,
          at: new Date(Number(status.timestamp) * 1000),
          error: error ? `${error.code}: ${error.title ?? error.message ?? "failed"}` : null,
        },
      ];
    });
}

// What the job does with one stored message. Media other than images, and unknown types, get a
// fixed reply instead of a model turn (voice notes wait for the STT bake-off, harness §10).
// `forwarded`: the words are someone else's (often a customer's order), not the owner's.
export type InboundContent =
  | { kind: "text"; text: string; forwarded: boolean }
  | { kind: "button"; id: string; title: string; contextWamid: string | null }
  | { kind: "image"; mediaId: string; caption: string | null; forwarded: boolean }
  | { kind: "unsupported"; type: string };

export function readContent(message: WebhookMessage): InboundContent {
  const forwarded = Boolean(message.context?.forwarded || message.context?.frequently_forwarded);

  if (message.type === "text" && message.text)
    return { kind: "text", text: message.text.body, forwarded };

  const reply = message.interactive?.button_reply;

  if (message.type === "interactive" && reply)
    return {
      kind: "button",
      id: reply.id,
      title: reply.title,
      contextWamid: message.context?.id ?? null,
    };

  if (message.type === "image" && message.image)
    return {
      kind: "image",
      mediaId: message.image.id,
      caption: message.image.caption ?? null,
      forwarded,
    };

  return { kind: "unsupported", type: message.type };
}
