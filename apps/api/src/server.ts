import { safeValidateUIMessages } from "ai";
import { Elysia } from "elysia";
import { z } from "zod";
import { streamDemoChat } from "./agent";
import { env } from "./env";
import { SalesQueryError } from "./sales/report";

const allowedOrigins = new Set(env.WEB_ORIGINS);

const demoChatBody = z.object({
  messages: z.array(z.unknown()).min(1).max(100),
});

export const app = new Elysia({ serve: { maxRequestBodySize: 256 * 1024 } })
  .onRequest(({ request, set }) => {
    const origin = request.headers.get("origin");

    if (origin && allowedOrigins.has(origin)) {
      set.headers["access-control-allow-origin"] = origin;
      set.headers.vary = "Origin";
    }

    if (request.method === "OPTIONS") {
      set.headers["access-control-allow-methods"] = "GET, POST, OPTIONS";
      set.headers["access-control-allow-headers"] = "content-type";
      set.headers["access-control-max-age"] = "86400";
      set.status = 204;

      return "";
    }
  })
  .get("/health", () => ({ ok: true }))
  .post(
    "/demo/chat",
    async ({ body, request, status }) => {
      const validated = await safeValidateUIMessages({ messages: body.messages });

      if (!validated.success) return status(400, { error: "Format messages tidak valid." });

      if (validated.data.some((message) => message.role === "system")) {
        return status(400, { error: "Pesan system tidak boleh dikirim dari client." });
      }

      const result = await streamDemoChat(validated.data, request.signal);

      return result.toUIMessageStreamResponse({
        sendReasoning: false,
        onError: (error) =>
          error instanceof SalesQueryError
            ? error.message
            : "Maaf Kak, Thya lagi gangguan. Coba kirim ulang sebentar lagi ya.",
      });
    },
    { body: demoChatBody },
  )
  .listen(env.PORT);

console.log(`Thya API jalan di http://localhost:${app.server?.port}`);
