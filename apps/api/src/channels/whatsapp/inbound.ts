import { z } from "zod";

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
  context: z.object({ id: z.string() }).optional(),
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

// Statuses (sent/delivered/read) and other fields carry no owner message, so they yield nothing.
export function inboundMessages(body: z.infer<typeof webhookSchema>, phoneNumberId: string) {
  return body.entry
    .flatMap((entry) => entry.changes)
    .filter((change) => change.field === "messages")
    .filter((change) => (change.value.metadata?.phone_number_id ?? phoneNumberId) === phoneNumberId)
    .flatMap((change) => change.value.messages ?? [])
    .map((message): InboundMessage => ({
      wamid: message.id,
      phone: message.from,
      type: message.type,
      receivedAt: new Date(Number(message.timestamp) * 1000),
      payload: message,
    }));
}

// What the job does with one stored message. Media other than images, and unknown types, get a
// fixed reply instead of a model turn (voice notes wait for the STT bake-off, harness §10).
export type InboundContent =
  | { kind: "text"; text: string }
  | { kind: "button"; id: string; title: string; contextWamid: string | null }
  | { kind: "image"; mediaId: string; caption: string | null }
  | { kind: "unsupported"; type: string };

export function readContent(message: WebhookMessage): InboundContent {
  if (message.type === "text" && message.text) return { kind: "text", text: message.text.body };

  const reply = message.interactive?.button_reply;

  if (message.type === "interactive" && reply)
    return {
      kind: "button",
      id: reply.id,
      title: reply.title,
      contextWamid: message.context?.id ?? null,
    };

  if (message.type === "image" && message.image)
    return { kind: "image", mediaId: message.image.id, caption: message.image.caption ?? null };

  return { kind: "unsupported", type: message.type };
}
