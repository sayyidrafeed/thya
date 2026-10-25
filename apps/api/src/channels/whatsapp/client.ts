import { z } from "zod";

// The only code that talks to the WhatsApp Cloud API. `fetch` comes in as a parameter so tests
// replay Graph API answers without module mocking.

export type Fetch = (url: string, init: RequestInit) => Promise<Response>;

export type WhatsAppConfig = {
  accessToken: string;
  phoneNumberId: string;
  graphVersion: string;
};

// Meta error 131047: more than 24 hours since the owner last wrote, so only a template may go out.
export const OUTSIDE_WINDOW_CODE = 131_047;

export class WhatsAppError extends Error {
  readonly code: number | null;
  readonly retryable: boolean;

  constructor(message: string, code: number | null, retryable: boolean) {
    super(message);
    this.code = code;
    this.retryable = retryable;
  }
}

export type ReplyButton = { id: string; title: string };

export type TemplateMessage = {
  name: string;
  language: string;
  bodyParams: string[];
  headerImageId: string | null;
};

export type WhatsAppClient = ReturnType<typeof createWhatsAppClient>;

type TemplateComponent =
  | { type: "header"; parameters: { type: "image"; image: { id: string } }[] }
  | { type: "body"; parameters: { type: "text"; text: string }[] };

// The Graph API message bodies Thya sends, as Meta's message docs name them.
type OutgoingMessage =
  | { type: "text"; text: { body: string; preview_url: boolean } }
  | { type: "image"; image: { id: string; caption?: string } }
  | {
      type: "interactive";
      interactive: {
        type: "button";
        body: { text: string };
        action: { buttons: { type: "reply"; reply: ReplyButton }[] };
      };
    }
  | {
      type: "template";
      template: { name: string; language: { code: string }; components: TemplateComponent[] };
    };

type GraphBody =
  | (OutgoingMessage & { recipient_type: "individual"; to: string })
  | { status: "read"; message_id: string; typing_indicator: { type: "text" } };

// Limits from Meta's message docs: text 4096, caption and interactive body 1024, button title 20.
export const TEXT_LIMIT = 4_096;
export const CAPTION_LIMIT = 1_024;
export const BUTTON_TITLE_LIMIT = 20;

const errorSchema = z.object({
  error: z.object({ message: z.string(), code: z.number().optional() }),
});

const sentSchema = z.object({ messages: z.array(z.object({ id: z.string() })).min(1) });
const mediaSchema = z.object({ id: z.string() });

const mediaInfoSchema = z.object({
  url: z.url(),
  mime_type: z.string(),
  file_size: z.number().optional(),
});

// S9: only pictures Thya can read, and not huge ones.
export const MAX_MEDIA_BYTES = 5 * 1024 * 1024;
export const READABLE_IMAGES = ["image/jpeg", "image/png"] as const;

export type DownloadedImage = { bytes: Uint8Array; mediaType: (typeof READABLE_IMAGES)[number] };

async function failure(response: Response): Promise<WhatsAppError> {
  const parsed = errorSchema.safeParse(await response.json().catch(() => null));
  const code = parsed.success ? (parsed.data.error.code ?? null) : null;
  const message = parsed.success ? parsed.data.error.message : `HTTP ${response.status}`;

  // 429 and 5xx are worth a retry by the job; 4xx (bad number, window closed, bad template) are not.
  return new WhatsAppError(message, code, response.status === 429 || response.status >= 500);
}

function templateComponents({ headerImageId, bodyParams }: TemplateMessage): TemplateComponent[] {
  const body: TemplateComponent = {
    type: "body",
    parameters: bodyParams.map((text) => ({ type: "text", text })),
  };

  if (headerImageId === null) return [body];

  return [{ type: "header", parameters: [{ type: "image", image: { id: headerImageId } }] }, body];
}

export function createWhatsAppClient(config: WhatsAppConfig, fetcher: Fetch = fetch) {
  const base = `https://graph.facebook.com/${config.graphVersion}/${config.phoneNumberId}`;
  const auth = { authorization: `Bearer ${config.accessToken}` };

  async function post(path: string, body: GraphBody): Promise<Response> {
    const response = await fetcher(`${base}${path}`, {
      method: "POST",
      headers: { ...auth, "content-type": "application/json" },
      body: JSON.stringify({ messaging_product: "whatsapp", ...body }),
    });

    if (!response.ok) throw await failure(response);

    return response;
  }

  async function send(to: string, message: OutgoingMessage): Promise<string> {
    const response = await post("/messages", { recipient_type: "individual", to, ...message });
    const [sent] = sentSchema.parse(await response.json()).messages;

    if (!sent) throw new WhatsAppError("send returned no message id", null, false);

    return sent.id;
  }

  return {
    sendText: (to: string, text: string) =>
      send(to, { type: "text", text: { body: text, preview_url: false } }),

    sendImage: (to: string, mediaId: string, caption: string | null) =>
      // JSON.stringify drops an undefined caption.
      send(to, { type: "image", image: { id: mediaId, caption: caption ?? undefined } }),

    sendButtons: (to: string, body: string, buttons: ReplyButton[]) =>
      send(to, {
        type: "interactive",
        interactive: {
          type: "button",
          body: { text: body },
          action: {
            buttons: buttons.map((button) => ({ type: "reply", reply: button })),
          },
        },
      }),

    sendTemplate: (to: string, template: TemplateMessage) =>
      send(to, {
        type: "template",
        template: {
          name: template.name,
          language: { code: template.language },
          components: templateComponents(template),
        },
      }),

    // Marks the owner's message read and shows "typing…" until the reply lands or 25 s pass.
    markRead: async (wamid: string) => {
      await post("/messages", {
        status: "read",
        message_id: wamid,
        typing_indicator: { type: "text" },
      });
    },

    // Media URLs live five minutes, so the job downloads right away (harness §4). Null = a type
    // or size Thya does not read.
    downloadImage: async (mediaId: string): Promise<DownloadedImage | null> => {
      const info = await fetcher(`https://graph.facebook.com/${config.graphVersion}/${mediaId}`, {
        method: "GET",
        headers: auth,
      });

      if (!info.ok) throw await failure(info);

      const meta = mediaInfoSchema.parse(await info.json());
      const mediaType = READABLE_IMAGES.find((type) => meta.mime_type.startsWith(type));

      if (mediaType === undefined || (meta.file_size ?? 0) > MAX_MEDIA_BYTES) return null;

      const file = await fetcher(meta.url, { method: "GET", headers: auth });

      if (!file.ok) throw await failure(file);

      const bytes = new Uint8Array(await file.arrayBuffer());

      return bytes.byteLength > MAX_MEDIA_BYTES ? null : { bytes, mediaType };
    },

    uploadImage: async (png: Uint8Array): Promise<string> => {
      const form = new FormData();
      form.append("messaging_product", "whatsapp");
      form.append("type", "image/png");
      form.append("file", new Blob([png], { type: "image/png" }), "thya.png");

      const response = await fetcher(`${base}/media`, {
        method: "POST",
        headers: auth,
        body: form,
      });

      if (!response.ok) throw await failure(response);

      return mediaSchema.parse(await response.json()).id;
    },
  };
}
