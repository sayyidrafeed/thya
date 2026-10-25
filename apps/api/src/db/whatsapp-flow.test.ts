import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { MockLanguageModelV4 } from "ai/test";
import { eq, sql } from "drizzle-orm";
import type { PgBoss } from "pg-boss";
import { createWhatsAppClient } from "../channels/whatsapp/client";
import { fakeGraph, signWebhook, textMessage, webhookBody } from "../channels/whatsapp/testing";
import { whatsappWebhook } from "../http/whatsapp";
import { createBoss, startJobs } from "../jobs";
import { handleAgentTurn, REPLIES, type AgentTurnDeps } from "../jobs/agent-turn";
import { scriptedModel } from "../agent/testing";
import { loadAttachment, loadDemoAttachment } from "../modules/attachments";
import { createPhoneBusiness } from "../modules/business";
import { loadHistory } from "../modules/conversation";
import { demoBusiness } from "../sales/demo-shop";
import { seedDemoSales } from "../sales/repository";
import type { Db } from "./client";
import { attachments, inboundMessages, outboundMessages } from "./schema";
import { freshTestDb, integration } from "./testing";

const NOW = new Date("2026-10-25T14:00:00+07:00");
const OWNER = "6281200000001";
const STRANGER = "6281299999999";
const config = { appSecret: "secret", verifyToken: "verify", phoneNumberId: "PNID" };

const usage = {
  inputTokens: { total: 10, noCache: 10, cacheRead: 0, cacheWrite: 0 },
  outputTokens: { total: 5, text: 5, reasoning: 0 },
};

function replyModel() {
  return new MockLanguageModelV4({
    doGenerate: async () => ({
      content: [{ type: "text", text: "Halo Kak, Thya **siap** bantu cek jualan." }],
      finishReason: { unified: "stop", raw: "stop" },
      usage,
      warnings: [],
    }),
  });
}

describe.if(integration)("whatsapp flow", () => {
  let db: Db;
  let boss: PgBoss;
  let app: ReturnType<typeof whatsappWebhook>;

  beforeAll(async () => {
    db = await freshTestDb();
    const business = await createPhoneBusiness(db, demoBusiness, `+${OWNER}`);
    await seedDemoSales(db, business.id, NOW);

    boss = createBoss(process.env.TEST_DATABASE_URL ?? "");
    await startJobs(boss, { db, agentTurn: null, schedules: null });
    app = whatsappWebhook(db, boss, config);
  }, 60_000);

  afterAll(async () => {
    await boss.stop({ graceful: false });
    await db.$client.end();
  });

  beforeEach(async () => {
    await db.execute(
      sql`TRUNCATE inbound_messages, outbound_messages, messages, agent_turns CASCADE`,
    );
  });

  function deliver(body: string, signature = signWebhook(body, config.appSecret)) {
    return app.handle(
      new Request("http://thya/webhook/whatsapp", {
        method: "POST",
        headers: { "content-type": "application/json", "x-hub-signature-256": signature },
        body,
      }),
    );
  }

  function deps(
    graph = fakeGraph(),
    model = replyModel(),
  ): AgentTurnDeps & { graph: typeof graph } {
    const client = createWhatsAppClient(
      { ...config, accessToken: "t", graphVersion: "v23.0" },
      graph.fetcher,
    );

    return {
      db,
      model,
      delivery: { db, client, loadImage: async () => null },
      now: () => NOW,
      paymentsImport: false,
      graph,
    };
  }

  test("Meta's verification handshake answers the challenge only with the right token", async () => {
    const ask = (token: string) =>
      app.handle(
        new Request(
          `http://thya/webhook/whatsapp?hub.mode=subscribe&hub.verify_token=${token}&hub.challenge=42`,
        ),
      );

    expect(await (await ask("verify")).text()).toBe("42");
    expect((await ask("wrong")).status).toBe(403);
  });

  test("a bad signature stores nothing", async () => {
    const response = await deliver(webhookBody([textMessage("wamid.bad", "hai")]), "sha256=00");

    expect(response.status).toBe(401);
    expect(await db.$count(inboundMessages)).toBe(0);
  });

  test("a redelivered webhook produces one reply, in WhatsApp format, and one stored turn", async () => {
    const body = webhookBody([textMessage("wamid.1", "halo Thya")]);

    expect((await deliver(body)).status).toBe(200);
    expect((await deliver(body)).status).toBe(200);
    expect(await db.$count(inboundMessages)).toBe(1);

    const queued = await boss.findJobs("agent-turn", { key: OWNER, queued: true });
    expect(queued.length).toBeGreaterThanOrEqual(1);

    const run = deps();
    await handleAgentTurn(run, OWNER);
    await handleAgentTurn(run, OWNER);

    expect(run.graph.sent()).toEqual([
      expect.objectContaining({
        to: OWNER,
        text: { body: "Halo Kak, Thya *siap* bantu cek jualan.", preview_url: false },
      }),
    ]);

    const [business] = await db.select({ id: inboundMessages.businessId }).from(inboundMessages);
    const history = await loadHistory(db, business?.id ?? "");

    expect(history.map((message) => message.role)).toEqual(["user", "assistant"]);
    expect(history.at(-1)?.content).toBe("Halo Kak, Thya *siap* bantu cek jualan.");
  });

  test("messages inside the buffer are answered together", async () => {
    await deliver(webhookBody([textMessage("wamid.a", "omzet")]));
    await deliver(webhookBody([textMessage("wamid.b", "kemarin ya")]));

    const run = deps();
    await handleAgentTurn(run, OWNER);

    expect(run.graph.sent()).toHaveLength(1);

    const [business] = await db.select({ id: inboundMessages.businessId }).from(inboundMessages);
    const [owner] = await loadHistory(db, business?.id ?? "");

    expect(owner?.content).toBe("omzet\nkemarin ya");
  });

  test("a send that fails after the turn is stored goes out on retry without a second model call", async () => {
    await deliver(webhookBody([textMessage("wamid.r", "halo")]));

    const model = replyModel();
    const run = deps(fakeGraph(), model);

    // The first failure hits the read receipt, which is allowed to fail; the second hits the reply.
    run.graph.fail(new Response("bad gateway", { status: 502 }));
    run.graph.fail(new Response("bad gateway", { status: 502 }));
    await expect(handleAgentTurn(run, OWNER)).rejects.toThrow();
    expect(run.graph.sent()).toHaveLength(0);

    await handleAgentTurn(run, OWNER);

    expect(run.graph.sent()).toHaveLength(1);
    expect(model.doGenerateCalls).toHaveLength(1);
    expect(await db.$count(outboundMessages, eq(outboundMessages.status, "sent"))).toBe(1);
  });

  test("an unregistered number gets one fixed reply a day and no model call", async () => {
    const run = deps();

    await deliver(webhookBody([textMessage("wamid.s1", "halo", STRANGER)]));
    await handleAgentTurn(run, STRANGER);
    await deliver(webhookBody([textMessage("wamid.s2", "halo lagi", STRANGER)]));
    await handleAgentTurn(run, STRANGER);

    expect(run.graph.sent().map((body) => body.text.body)).toEqual([REPLIES.unregistered]);
    expect(await db.$count(inboundMessages, eq(inboundMessages.phone, STRANGER))).toBe(2);
  });

  test("a flood above the rate limit gets one throttle reply", async () => {
    const flood = Array.from({ length: 12 }, (_, index) =>
      textMessage(`wamid.f${index}`, `pesan ${index}`),
    ).map((message) => ({ ...message, timestamp: String(NOW.getTime() / 1000) }));

    await deliver(webhookBody(flood));

    const run = deps();
    await handleAgentTurn(run, OWNER);

    expect(run.graph.sent().map((body) => body.text.body)).toEqual([REPLIES.throttled]);
  });

  test("a chart reply goes out as one picture with the reply as its caption (S2-AC1, AC4)", async () => {
    await deliver(webhookBody([textMessage("wamid.chart", "kasih grafik omzet 7 hari terakhir")]));

    const model = scriptedModel([
      {
        tool: "showChart",
        input: {
          view: "daily_revenue",
          period: "last_7_days",
          startDate: null,
          endDate: null,
          sortBy: null,
          limit: null,
        },
      },
      { text: "Ini grafik omzet 7 hari terakhir, Kak." },
    ]);

    const run = deps(fakeGraph(), model);

    run.delivery.loadImage = (id) => loadAttachment(db, id, NOW);
    await handleAgentTurn(run, OWNER);
    await handleAgentTurn(run, OWNER);

    expect(run.graph.calls.filter((call) => call.url.endsWith("/media"))).toHaveLength(1);
    expect(run.graph.sent()).toEqual([
      expect.objectContaining({
        type: "image",
        image: expect.objectContaining({ caption: "Ini grafik omzet 7 hari terakhir, Kak." }),
      }),
    ]);

    // A real business's picture is never served over HTTP; only the demo shop's are.
    const [row] = await db.select({ id: attachments.id }).from(attachments);

    expect(await loadDemoAttachment(db, row?.id ?? "", NOW)).toBeNull();
    expect(await loadAttachment(db, row?.id ?? "", NOW)).not.toBeNull();
  });
});
