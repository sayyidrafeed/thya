import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { MockLanguageModelV4 } from "ai/test";
import { eq, sql } from "drizzle-orm";
import { scriptedModel, type ScriptStep, type ToolStep } from "../agent/testing";
import { createWhatsAppClient, type Fetch } from "../channels/whatsapp/client";
import type { WebhookMessage } from "../channels/whatsapp/inbound";
import { fakeGraph, textMessage } from "../channels/whatsapp/testing";
import { AGENT_TURN, createBoss, enqueueAgentTurn, startJobs } from "../jobs";
import { handleAgentTurn, REPLIES, type AgentTurnDeps } from "../jobs/agent-turn";
import { createPhoneBusiness } from "../modules/business";
import { pendingOutbound, recordInbound } from "../modules/conversation";
import { demoBusiness } from "../sales/demo-shop";
import { seedDemoSales } from "../sales/repository";
import type { Db } from "./client";
import {
  agentTurns,
  conceptEvents,
  drafts,
  inboundMessages,
  messages,
  outboundMessages,
} from "./schema";
import { freshTestDb, integration } from "./testing";

// Harness §4: once pg-boss fails an attempt (expireInSeconds, or a shutdown while it runs), the
// attempt keeps running in the background beside the next one. These are the ways it used to
// write over that next attempt.

const NOW = new Date("2026-10-25T14:00:00+07:00");
const OWNER = "6281200000011";
const config = { accessToken: "t", phoneNumberId: "PNID", graphVersion: "v23.0" };

const sale = (quantity: number): ToolStep => ({
  tool: "recordSales",
  input: { day: "today", date: null, items: [{ menuName: "americano", quantity }] },
});

const drafted = (quantity: number): ScriptStep[] => [
  sale(quantity),
  { text: "Cek dulu ya Kak, lalu jawab ya, ubah, atau batal." },
];

// A GoPay history the screenshot extraction reads (S9), one payment the day before NOW.
const extraction: ScriptStep[] = [
  {
    tool: "recordExtraction",
    input: {
      documentKind: "payment_history",
      provider: "gopay_merchant",
      transactions: [
        {
          day: 24,
          month: 10,
          year: null,
          time: "07:12",
          amount: 18_000,
          direction: "in",
          status: "success",
          method: "qris",
          reference: "A1",
          description: null,
        },
      ],
      settlement: null,
      shownTotal: null,
      unreadableReason: null,
    },
  },
  { text: "ok" },
];

const notPayment: ScriptStep[] = [
  {
    tool: "recordExtraction",
    input: {
      documentKind: "not_transactions",
      provider: null,
      transactions: [],
      settlement: null,
      shownTotal: null,
      unreadableReason: null,
    },
  },
  { text: "ok" },
];

type Gate = { reached: Promise<void>; wait: () => Promise<void>; open: () => void };

// A point an attempt stops at until the test opens it; `reached` once the attempt gets there.
function gate(): Gate {
  const reached = Promise.withResolvers<void>();
  const opened = Promise.withResolvers<void>();

  return {
    reached: reached.promise,
    wait: () => {
      reached.resolve();

      return opened.promise;
    },
    open: () => opened.resolve(),
  };
}

type GraphCall = { url: string; text: string | null; read: boolean };

// The Graph API one attempt talks to, where `hold` can make a call wait first, like a WhatsApp
// call that outlives the job's expireInSeconds.
function heldGraph(
  hold: (call: GraphCall) => Promise<void> | undefined,
  media?: Map<string, Uint8Array>,
) {
  const graph = fakeGraph(media);

  const fetcher: Fetch = async (url, init) => {
    const json = init.method === "POST" && !(init.body instanceof FormData);
    const sent = json ? JSON.parse(String(init.body)) : null;

    await hold({ url, text: sent?.text?.body ?? null, read: sent?.status === "read" });

    return graph.fetcher(url, init);
  };

  return { ...graph, fetcher };
}

const aborted = (signal: AbortSignal | undefined) =>
  new Promise<never>((_, reject) =>
    signal?.addEventListener("abort", () => reject(signal.reason), { once: true }),
  );

// Like a provider over fetch: a call fails as soon as its signal aborts, at once if it already
// has. The call numbered `holdAt` also waits at `held` until the test opens it.
function abortableModel(steps: ScriptStep[], holdAt = -1, held: Gate = gate()) {
  const script = scriptedModel(steps);

  const model = new MockLanguageModelV4({
    doGenerate: async (options) => {
      options.abortSignal?.throwIfAborted();

      if (model.doGenerateCalls.length - 1 === holdAt)
        await Promise.race([held.wait(), aborted(options.abortSignal)]);

      return script.doGenerate(options);
    },
  });

  return model;
}

describe.if(integration)("an attempt pg-boss has failed", () => {
  let db: Db;
  let wamid = 0;
  let clock = NOW.getTime();
  const later = () => new Date((clock += 3 * 60_000));
  const picture = new Uint8Array([137, 80, 78, 71, 1, 2, 3]);
  const media = new Map([["media-1", picture]]);

  beforeAll(async () => {
    db = await freshTestDb();
    const business = await createPhoneBusiness(db, demoBusiness, OWNER);
    await seedDemoSales(db, business.id, NOW);
  }, 60_000);

  afterAll(async () => {
    await db.$client.end();
  });

  function deps(
    model: AgentTurnDeps["model"],
    fetcher: Fetch,
    at: Date,
    more: Partial<AgentTurnDeps> = {},
  ): AgentTurnDeps {
    const client = createWhatsAppClient(config, fetcher);

    return {
      db,
      model,
      delivery: { db, client, loadImage: async () => null, now: () => at },
      now: () => at,
      paymentsImport: true,
      ...more,
    };
  }

  // One attempt of the agent-turn job over whatever the owner has written and Thya not answered.
  const attempt = (
    model: AgentTurnDeps["model"],
    fetcher: Fetch,
    at: Date,
    more: Partial<AgentTurnDeps> = {},
  ) => handleAgentTurn(deps(model, fetcher, at, more), OWNER);

  async function write(message: WebhookMessage, at = later()) {
    await recordInbound(db, [
      { wamid: message.id, phone: OWNER, type: message.type, payload: message, receivedAt: at },
    ]);

    return at;
  }

  const typed = (text: string) => textMessage(`wamid.x${++wamid}`, text, OWNER);

  // The draft behind the card the owner received, from its Ya button.
  function cardOf(sent: ReturnType<ReturnType<typeof fakeGraph>["sent"]>): string {
    const card = sent.find((body) => body.type === "interactive");
    const yes: string = card?.interactive.action.buttons[0].reply.id ?? "";

    return yes.split(":")[1] ?? "";
  }

  const statusOf = async (draftId: string) =>
    (await db.select({ status: drafts.status }).from(drafts).where(eq(drafts.id, draftId)))[0]
      ?.status;

  // The owner's open card "2 Americano", from a turn that ran normally.
  async function openCard() {
    const at = await write(typed("tadi laku 2 americano"));
    const graph = fakeGraph();

    await attempt(scriptedModel(drafted(2)), graph.fetcher, at);

    return cardOf(graph.sent());
  }

  const yes = (draftId: string): WebhookMessage => ({
    from: OWNER,
    id: `wamid.x${++wamid}`,
    timestamp: String(NOW.getTime() / 1000),
    type: "interactive",
    interactive: {
      type: "button_reply",
      button_reply: { id: `draft:${draftId}:yes`, title: "Ya" },
    },
  });

  const screenshot = (): WebhookMessage => ({
    from: OWNER,
    id: `wamid.x${++wamid}`,
    timestamp: "1",
    type: "image",
    image: { id: "media-1", mime_type: "image/png" },
  });

  // Downloading the owner's picture hangs until `stuck` opens.
  const downloadHeld = (stuck: Gate) =>
    heldGraph(
      (call) => (call.url.startsWith("https://lookaside.test/") ? stuck.wait() : undefined),
      media,
    );

  async function pressYes(draftId: string) {
    const at = await write(yes(draftId));
    const graph = fakeGraph();

    await attempt(scriptedModel([]), graph.fetcher, at);

    return graph.sent().map((body) => body.text?.body);
  }

  test("a turn held up on WhatsApp past expiry commits no second card after the next attempt answered", async () => {
    const card = await openCard();
    const correction = typed("eh bukan 2, 3 americano");
    const at = await write(correction);
    const first = new AbortController();
    const stuck = gate();
    let interimOut = false;

    // The "still working" line goes out 150 ms in, by when the turn has kept its draft and waits
    // only on that line; the read receipt after it hangs.
    const firstGraph = heldGraph(async (call) => {
      if (call.text === REPLIES.interim) {
        interimOut = true;
        await Bun.sleep(150);
      } else if (interimOut && call.read) await stuck.wait();
    });

    const running = attempt(abortableModel(drafted(3)), firstGraph.fetcher, at, {
      signal: first.signal,
      interimAfterMs: 0,
    });

    await stuck.reached;
    first.abort();

    const next = fakeGraph();
    await attempt(abortableModel(drafted(3)), next.fetcher, at);
    stuck.open();

    await expect(running).rejects.toBe(first.signal.reason);

    // The interim line is the one row the held-up turn committed, before pg-boss failed it.
    const [interim] = await db
      .select({ traceId: outboundMessages.traceId })
      .from(outboundMessages)
      .where(eq(outboundMessages.idempotencyKey, `interim:${correction.id}:0`));

    const [batch] = await db
      .select({ traceId: inboundMessages.traceId })
      .from(inboundMessages)
      .where(eq(inboundMessages.wamid, correction.id));

    expect(firstGraph.sent().map((body) => body.text?.body)).toEqual([REPLIES.interim]);
    expect(next.sent().map((body) => body.type)).toEqual(["text", "interactive"]);
    expect(await pendingOutbound(db, OWNER)).toEqual([]);
    expect(await db.$count(messages, eq(messages.traceId, interim?.traceId ?? ""))).toBe(0);
    expect(batch?.traceId).not.toBe(interim?.traceId);
    expect(await statusOf(card)).toBe("cancelled");

    expect(await pressYes(cardOf(next.sent()))).toEqual([
      expect.stringContaining("Sudah dicatat, Kak: 3 Americano"),
    ]);
  });

  test("a turn cut off by a worker shutdown leaves its draft to the next attempt and sends no apology", async () => {
    const card = await openCard();
    const at = await write(typed("eh bukan 2, 3 americano"));
    const url = process.env.TEST_DATABASE_URL ?? "";

    // Jobs other suites left in pg-boss's schema must not reach this worker.
    const setup = createBoss(url);
    await startJobs(setup, { db, agentTurn: null, schedules: null, work: false });
    await db.execute(sql`DELETE FROM pgboss.job WHERE name = ${AGENT_TURN}`);
    await setup.stop({ graceful: false });

    // The model drafts the correction; its next call is still running when the deploy stops it.
    const thinking = gate();
    const model = abortableModel(drafted(3), 1, thinking);
    const graph = fakeGraph();
    const boss = createBoss(url);

    try {
      await startJobs(boss, {
        db,
        agentTurn: deps(model, graph.fetcher, at),
        schedules: null,
        work: true,
      });
      await enqueueAgentTurn(boss, OWNER, 0);
      await thinking.reached;
      await boss.stop({ timeout: 1_000 });
    } finally {
      await boss.stop({ graceful: false });
      await db.execute(sql`DELETE FROM pgboss.job WHERE name = ${AGENT_TURN}`);
    }

    // Left as a dead run leaves it: its draft pending without a card, no apology, no failed turn.
    const left = await db
      .select({ id: drafts.id })
      .from(drafts)
      .where(eq(drafts.status, "pending"));

    expect(model.doGenerateCalls[1]?.abortSignal?.aborted).toBe(true);
    expect(graph.sent()).toEqual([]);
    expect(await db.$count(agentTurns, eq(agentTurns.action, "error"))).toBe(0);
    expect(left.map((row) => row.id)).not.toContain(card);
    expect(left).toHaveLength(1);

    // The retry asks back, and the card the cut-off turn took over is the owner's again.
    const retry = fakeGraph();
    const asked = "Maksudnya jadi 3 Americano ya, Kak?";
    await attempt(scriptedModel([{ text: asked }]), retry.fetcher, at);

    expect(retry.sent().map((body) => body.text?.body)).toEqual([asked]);
    expect(await statusOf(left[0]?.id ?? "")).toBeUndefined();
    expect(await statusOf(card)).toBe("pending");
  }, 15_000);

  test("a turn held up before its dead-run check leaves the next attempt's new draft alone", async () => {
    const card = await openCard();
    const at = await write(typed("eh bukan 2, 3 americano"));
    const first = new AbortController();
    const stuck = gate();

    // The read receipt hangs before this turn looks for drafts a dead run left without a card.
    const firstGraph = heldGraph((call) => (call.read ? stuck.wait() : undefined));
    const running = attempt(abortableModel([]), firstGraph.fetcher, at, { signal: first.signal });

    await stuck.reached;
    first.abort();

    // The next attempt has drafted the correction and not yet committed its card.
    const answering = gate();
    const next = fakeGraph();
    const replying = attempt(abortableModel(drafted(3), 1, answering), next.fetcher, at);

    await answering.reached;
    stuck.open();
    await expect(running).rejects.toBe(first.signal.reason);
    answering.open();
    await replying;

    const nextCard = cardOf(next.sent());

    expect(await statusOf(nextCard)).toBe("pending");
    expect(await statusOf(card)).toBe("cancelled");

    expect(await pressYes(nextCard)).toEqual([
      expect.stringContaining("Sudah dicatat, Kak: 3 Americano"),
    ]);
  });

  test("a delivery held up past expiry sends nothing more once the next attempt has sent it", async () => {
    const at = await write(typed("tadi laku 2 americano"));
    const first = new AbortController();
    const stuck = gate();

    // The turn committed its reply and card; sending the reply hangs.
    const firstGraph = heldGraph((call) => (call.text === null ? undefined : stuck.wait()));

    const running = attempt(abortableModel(drafted(2)), firstGraph.fetcher, at, {
      signal: first.signal,
    });

    await stuck.reached;
    first.abort();

    const next = fakeGraph();
    await attempt(abortableModel([]), next.fetcher, at);
    stuck.open();

    await expect(running).rejects.toBe(first.signal.reason);

    // The reply WhatsApp already had goes out twice (a send in flight is never cut off), the card once.
    const cards = [...firstGraph.sent(), ...next.sent()].filter(
      (body) => body.type === "interactive",
    );

    expect(cards).toHaveLength(1);
  });

  test("a screenshot download held up past expiry drafts nothing over the next attempt's card", async () => {
    const at = await write(screenshot());
    const first = new AbortController();
    const stuck = gate();
    const firstGraph = downloadHeld(stuck);

    const running = attempt(abortableModel(extraction), firstGraph.fetcher, at, {
      signal: first.signal,
    });

    await stuck.reached;
    first.abort();

    const next = fakeGraph(media);
    await attempt(abortableModel(extraction), next.fetcher, at);
    stuck.open();

    await expect(running).rejects.toBe(first.signal.reason);

    const card = cardOf(next.sent());

    expect(firstGraph.sent()).toEqual([]);
    expect(await statusOf(card)).toBe("pending");
    expect(await db.$count(drafts, eq(drafts.kind, "payments.import"))).toBe(1);
  });

  test("a screenshot download held up past expiry leaves a Ya later in the batch to the next attempt", async () => {
    const card = await openCard();
    const at = later();
    const first = new AbortController();
    const stuck = gate();

    // A picture that is no payment, then Ya on the open sale card, in one batch.
    await write(screenshot(), new Date(at.getTime() - 1_000));
    await write(yes(card), at);

    const running = attempt(abortableModel(notPayment), downloadHeld(stuck).fetcher, at, {
      signal: first.signal,
    });

    // The download comes back after pg-boss failed the attempt, before the retry starts.
    await stuck.reached;
    first.abort();
    stuck.open();
    await expect(running).rejects.toBe(first.signal.reason);

    const next = fakeGraph(media);
    await attempt(abortableModel(notPayment), next.fetcher, at);

    expect(next.sent().map((body) => body.text?.body)).toEqual([
      expect.any(String),
      expect.stringContaining("Sudah dicatat, Kak: 2 Americano"),
    ]);
  });

  test("a rewrite cut off past expiry records no explanation the owner never got", async () => {
    const at = await write(typed("omzet itu apa?"));
    const before = await db.$count(conceptEvents);
    const first = new AbortController();
    const rewriting = gate();

    // The answer names a figure no tool gave, so the turn asks for a rewrite, which is still
    // running when pg-boss fails the attempt; runTurn then falls back to the first answer.
    const model = abortableModel(
      [
        { tool: "explainConcept", input: { concept: "revenue", depth: "short" } },
        { text: "Omzet itu total penjualan, misalnya Rp777.777 sehari." },
      ],
      2,
      rewriting,
    );

    const running = attempt(model, fakeGraph().fetcher, at, { signal: first.signal });

    await rewriting.reached;
    first.abort();

    await expect(running).rejects.toBe(first.signal.reason);
    expect(await db.$count(conceptEvents)).toBe(before);
  });
});
