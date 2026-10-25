import { createHmac } from "node:crypto";
import type { Fetch } from "./client";
import type { WebhookMessage } from "./inbound";

// Test helpers: Meta-shaped webhook payloads and a recording Graph API, passed in as `fetch`.

export function webhookBody(messages: WebhookMessage[]) {
  return JSON.stringify({
    object: "whatsapp_business_account",
    entry: [
      {
        id: "waba",
        changes: [
          {
            field: "messages",
            value: {
              messaging_product: "whatsapp",
              metadata: { display_phone_number: "15550000000", phone_number_id: "PNID" },
              contacts: [{ wa_id: "6281200000001", profile: { name: "Bu Sari" } }],
              messages,
            },
          },
        ],
      },
    ],
  });
}

export const signWebhook = (body: string, secret: string) =>
  `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`;

export const textMessage = (id: string, body: string, from = "6281200000001"): WebhookMessage => ({
  from,
  id,
  timestamp: "1793088000",
  type: "text",
  text: { body },
});

export type GraphCall = { url: string; body: string };

export function graph(responses: Response[]) {
  const calls: GraphCall[] = [];

  const fetcher: Fetch = async (url, init) => {
    calls.push({ url, body: init.body instanceof FormData ? "form" : String(init.body) });

    const next = responses.shift();

    if (!next) throw new Error("unexpected Graph call");

    return next;
  };

  return { calls, fetcher };
}

// A Graph API that accepts everything, unless a test queues a failure for the next calls.
// `media` holds the pictures an owner "sent", by media id.
export function fakeGraph(media = new Map<string, Uint8Array>()) {
  const calls: GraphCall[] = [];
  const failures: Response[] = [];

  const fetcher: Fetch = async (url, init) => {
    const body = init.body instanceof FormData ? "form" : String(init.body);
    const failure = failures.shift();

    if (failure) return failure;

    calls.push({ url, body });

    const download = /^https:\/\/lookaside\.test\/(.+)$/.exec(url)?.[1];
    const info = /\/v\d+\.\d+\/([^/]+)$/.exec(url)?.[1];

    if (download !== undefined) return new Response(media.get(download));

    if (init.method === "GET" && info !== undefined && media.has(info))
      return Response.json({
        url: `https://lookaside.test/${info}`,
        mime_type: "image/png",
        file_size: media.get(info)?.byteLength,
      });

    if (url.endsWith("/media")) return Response.json({ id: `media.${calls.length}` });

    return Response.json({ messages: [{ id: `wamid.out.${calls.length}` }] });
  };

  // Messages the owner would see: every send except read receipts.
  const sent = () =>
    calls.flatMap((call) => {
      const body = call.url.endsWith("/messages") ? JSON.parse(call.body) : null;

      return body && body.status !== "read" ? [body] : [];
    });

  return { calls, fetcher, sent, fail: (response: Response) => failures.push(response) };
}
