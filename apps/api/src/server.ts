import { createUIMessageStreamResponse, safeValidateUIMessages } from "ai";
import { Elysia } from "elysia";
import { z } from "zod";
import { createDb } from "./db/client";
import { runMigrations } from "./db/migrate";
import { env, whatsapp } from "./env";
import { demoChatStream } from "./http/demo";
import { healthRoute } from "./http/health";
import { clientAddress, createRateLimiter } from "./http/rate-limit";
import { whatsappWebhook } from "./http/whatsapp";
import { loadDemoAttachment } from "./modules/attachments";
import { checkHealth, STALLED_AFTER_SECONDS } from "./modules/health";
import { ensureDemoBusiness } from "./modules/business";
import { hasSales, seedDemoSales } from "./sales/repository";
import { newTraceId } from "./trace";
import { startWorkers } from "./wiring";

const allowedOrigins = new Set(env.WEB_ORIGINS);
const db = createDb(env.DATABASE_URL);

await runMigrations(env.DATABASE_URL);

const demo = await ensureDemoBusiness(db);

// First boot waits for the seed once, so the demo never answers "Rp0" from a half-filled history.
const firstBoot = !(await hasSales(db, demo.id));

if (firstBoot) await seedDemoSales(db, demo.id, new Date());

// The server always starts pg-boss to enqueue; it works the queues only with JOBS_IN_SERVER=1
// (otherwise `bun src/worker.ts` does). A queue that cannot start must not take the web demo down,
// so the failure is logged and the WhatsApp webhook stays off.
const boss = await startWorkers(db, env.DATABASE_URL, env.JOBS_IN_SERVER).catch((error) => {
  console.error("jobs failed to start:", error instanceof Error ? error.message : error);

  return null;
});

const healthInput = { db, jobsStarted: boss !== null, whatsappConfigured: whatsapp !== null };

if (whatsapp && !boss)
  console.error("WhatsApp sudah diisi, tapi queue gagal start, jadi webhook dimatikan.");

// Acked webhooks with no process working the queues are stored and never answered, so say it loudly.
async function warnIfQueueStalled() {
  const health = await checkHealth(healthInput);

  if (health.jobs !== "stalled") return;

  console.error(
    `Queue macet ${health.queueLagSeconds} detik: tidak ada proses yang mengerjakan job, jadi pesan WhatsApp tersimpan tapi tidak dibalas. ${env.JOBS_IN_SERVER ? "Cek log job di server ini." : "Jalankan service worker (bun src/worker.ts) atau set JOBS_IN_SERVER=1."}`,
  );
}

if (whatsapp && boss)
  setInterval(() => void warnIfQueueStalled(), (STALLED_AFTER_SECONDS + 120) * 1000);

// Harness §8: every demo message is a paid model call, and the endpoint is public.
const allowDemoChat = createRateLimiter({ limit: 20, windowMs: 60_000 });

const demoChatBody = z.object({
  messages: z.array(z.unknown()).min(1).max(100),
});

export const app = new Elysia({ serve: { maxRequestBodySize: 256 * 1024 } })
  .onRequest(({ request, set }) => {
    const origin = request.headers.get("origin");

    if (origin && allowedOrigins.has(origin)) {
      set.headers["access-control-allow-origin"] = origin;
      set.headers.vary = "Origin";
      set.headers["access-control-expose-headers"] = "x-trace-id";
    }

    if (request.method === "OPTIONS") {
      set.headers["access-control-allow-methods"] = "GET, POST, OPTIONS";
      set.headers["access-control-allow-headers"] = "content-type";
      set.headers["access-control-max-age"] = "86400";
      set.status = 204;

      return "";
    }
  })
  .use(healthRoute(healthInput))
  // Pictures from showChart for the web demo only (features §4.2); real businesses' never leave by HTTP.
  .get("/attachments/:id", async ({ params, status }) => {
    if (!z.uuid().safeParse(params.id).success) return status(404, "not found");

    const png = await loadDemoAttachment(db, params.id, new Date());

    if (png === null) return status(404, "not found");

    return new Response(png, {
      headers: { "content-type": "image/png", "cache-control": "public, max-age=86400, immutable" },
    });
  })
  .use(whatsapp && boss ? whatsappWebhook(db, boss, whatsapp) : new Elysia())
  .post(
    "/demo/chat",
    async ({ body, request, server, status }) => {
      if (!allowDemoChat(clientAddress(request, server?.requestIP(request)?.address ?? null)))
        return status(429, {
          error: "Pesannya terlalu cepat, Kak. Tunggu sebentar lalu coba lagi.",
        });

      const validated = await safeValidateUIMessages({ messages: body.messages });

      if (!validated.success) return status(400, { error: "Format messages tidak valid." });

      if (validated.data.some((message) => message.role === "system")) {
        return status(400, { error: "Pesan system tidak boleh dikirim dari client." });
      }

      const traceId = newTraceId();

      return createUIMessageStreamResponse({
        headers: { "x-trace-id": traceId },
        stream: demoChatStream(db, validated.data, traceId, request.signal),
      });
    },
    { body: demoChatBody },
  )
  .listen(env.PORT);

console.log(
  `Thya API jalan di http://localhost:${app.server?.port} (WhatsApp ${whatsapp && boss ? "aktif" : "nonaktif"}, job ${env.JOBS_IN_SERVER ? "di server" : "di worker"}).`,
);

// A deploy sends SIGTERM: pg-boss stops fetching and lets running turns finish (up to its own
// timeout); a turn cut off anyway stays unprocessed and is retried once its job expires.
process.on("SIGTERM", () => {
  void (boss?.stop() ?? Promise.resolve()).finally(() => process.exit(0));
});

// After listen, so the health check passes while it runs. The demo's rows reach 30 days past each
// deploy, which keeps "today" moving without a cron; the insert is idempotent.
async function topUpDemoSales() {
  try {
    await seedDemoSales(db, demo.id, new Date());
  } catch (error) {
    console.error("demo seed failed:", error instanceof Error ? error.message : error);
  }
}

if (!firstBoot) void topUpDemoSales();
