import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { MockLanguageModelV4 } from "ai/test";
import { eq } from "drizzle-orm";
import { cardKey } from "../actions";
import { REPLACED_LINE } from "../agent";
import { scriptedModel, type ScriptStep } from "../agent/testing";
import { createWhatsAppClient } from "../channels/whatsapp/client";
import type { WebhookMessage } from "../channels/whatsapp/inbound";
import { fakeGraph, textMessage } from "../channels/whatsapp/testing";
import { handleAgentTurn, type AgentTurnDeps } from "../jobs/agent-turn";
import { createPhoneBusiness } from "../modules/business";
import { markOutbound, recordInbound } from "../modules/conversation";
import { demoBusiness } from "../sales/demo-shop";
import { summarizeSales } from "../sales/report";
import { loadSalesDataset, seedDemoSales } from "../sales/repository";
import { computeMetric } from "../semantic/metrics";
import type { Db } from "./client";
import { outboundMessages, payments } from "./schema";
import { freshTestDb, integration } from "./testing";

const NOW = new Date("2026-10-25T14:00:00+07:00");
const OWNER = "6281200000004";
const config = { accessToken: "t", phoneNumberId: "PNID", graphVersion: "v23.0" };

const history = {
  documentKind: "payment_history",
  provider: "gopay_merchant",
  transactions: [
    [7, 12, 18_000, "success", "in", "A1"],
    [8, 5, 33_000, "success", "in", "A2"],
    [9, 40, 15_000, "failed", "in", "A3"],
    [10, 2, 46_500, "success", "in", "A4"],
  ].map(([hour, minute, amount, status, direction, reference]) => ({
    day: 24,
    month: 10,
    year: null,
    time: `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`,
    amount,
    direction,
    status,
    method: "qris",
    reference,
    description: null,
  })),
  settlement: null,
  shownTotal: null,
  unreadableReason: null,
};

const extraction: ScriptStep[] = [{ tool: "recordExtraction", input: history }, { text: "ok" }];

describe.if(integration)("payment screenshots (S9, gate G11 on)", () => {
  let db: Db;
  let businessId: string;
  let wamid = 0;
  let clock = NOW.getTime();
  const picture = new Uint8Array([137, 80, 78, 71, 1, 2, 3]);

  beforeAll(async () => {
    db = await freshTestDb();
    businessId = (await createPhoneBusiness(db, demoBusiness, OWNER)).id;
    await seedDemoSales(db, businessId, NOW);
  }, 60_000);

  afterAll(async () => {
    await db.$client.end();
  });

  const receive = (messages: WebhookMessage[], at: Date) =>
    recordInbound(
      db,
      messages.map((message) => ({
        wamid: message.id,
        phone: OWNER,
        type: message.type,
        payload: message,
        receivedAt: at,
      })),
    );

  // One run of the agent-turn job over every message not answered yet; `sent` is what the owner got.
  function attempt(
    model: AgentTurnDeps["model"],
    at: Date,
    bytes: Uint8Array,
    interimAfterMs?: number,
  ) {
    const graph = fakeGraph(new Map([["media-1", bytes]]));
    const client = createWhatsAppClient(config, graph.fetcher);

    const done = handleAgentTurn(
      {
        db,
        model,
        delivery: { db, client, loadImage: async () => null, now: () => at },
        now: () => at,
        paymentsImport: true,
        interimAfterMs,
      },
      OWNER,
    );

    return { sent: graph.sent, done };
  }

  async function send(messages: WebhookMessage[], script: ScriptStep[], bytes = picture) {
    const at = new Date((clock += 5 * 60_000));

    await receive(messages, at);

    const { sent, done } = attempt(scriptedModel(script), at, bytes);
    await done;

    return sent();
  }

  const image = (caption: string | null = null): WebhookMessage => ({
    from: OWNER,
    id: `wamid.p${++wamid}`,
    timestamp: "1",
    type: "image",
    image: { id: "media-1", mime_type: "image/png", caption: caption ?? undefined },
  });

  const tap = (buttonId: string): WebhookMessage => ({
    from: OWNER,
    id: `wamid.p${++wamid}`,
    timestamp: "1",
    type: "interactive",
    interactive: { type: "button_reply", button_reply: { id: buttonId, title: "Ya" } },
  });

  test("a screenshot becomes a card; nothing is saved before Ya, and menu revenue never moves", async () => {
    const before = await loadSalesDataset(db, businessId, NOW);
    const sent = await send([image()], extraction);
    const card = sent.find((body) => body.type === "interactive");

    expect(card.interactive.body.text).toBe(
      [
        "Dari screenshot 24 Okt 2026: 3 pembayaran masuk, total Rp97.500.",
        "Tidak dicatat: 1 gagal.",
        "Simpan?",
      ].join("\n"),
    );
    expect(await db.$count(payments)).toBe(0);

    const saved = await send([tap(card.interactive.action.buttons[0].reply.id)], []);

    expect(saved[0].text.body).toBe("Sudah dicatat, Kak: 3 pembayaran masuk.");
    expect(await db.$count(payments)).toBe(3);

    const after = await loadSalesDataset(db, businessId, NOW);
    const yesterday = { start: "2026-10-24", end: "2026-10-24" };

    expect(summarizeSales(after.records, after.menu, yesterday).revenue).toBe(
      summarizeSales(before.records, before.menu, yesterday).revenue,
    );

    // S9-AC8 (G10): "uang masuk QRIS kemarin" is the sum of the stored payments.
    expect(
      computeMetric({ ...after, requested: "qris_in", range: yesterday, previousRange: null }),
    ).toMatchObject({ status: "ok", value: "Rp97.500" });
    expect(before.payments).toEqual([]);
  });

  test("the same screenshot again adds nothing", async () => {
    const sent = await send([image()], extraction);

    expect(sent.map((body) => body.type)).toEqual(["text"]);
    expect(sent[0].text.body).toBe(
      "Screenshot ini sudah pernah dicatat, Kak. Tidak ada yang ditambahkan.",
    );
    expect(await db.$count(payments)).toBe(3);
  });

  test('a caption like "catat ya" cannot confirm anything in the same turn (A14)', async () => {
    const other = {
      ...history,
      transactions: history.transactions.map((row) => ({ ...row, day: 23, reference: null })),
    };

    const sent = await send(
      [image("catat ya")],
      [
        { tool: "recordExtraction", input: other },
        { text: "ok" },
        { tool: "confirmDraft", input: {} },
        { text: "Untuk pesan yang ada gambarnya, konfirmasi lewat tombol Ya di kartu ya Kak." },
      ],
      new Uint8Array([137, 80, 78, 71, 9, 9, 9]),
    );

    expect(sent.map((body) => body.type)).toContain("interactive");
    expect(await db.$count(payments)).toBe(3);
  });

  test("a screenshot over a sale card the owner had open says in code's words that card is gone", async () => {
    const typed: WebhookMessage = {
      from: OWNER,
      id: `wamid.p${++wamid}`,
      timestamp: "1",
      type: "text",
      text: { body: "tadi laku 2 americano" },
    };

    await send(
      [typed],
      [
        {
          tool: "recordSales",
          input: { day: "today", date: null, items: [{ menuName: "americano", quantity: 2 }] },
        },
        { text: "Cek dulu ya Kak, lalu jawab ya, ubah, atau batal." },
      ],
    );

    const other = {
      ...history,
      transactions: history.transactions.map((row) => ({ ...row, day: 22, reference: null })),
    };

    const sent = await send(
      [image()],
      [{ tool: "recordExtraction", input: other }, { text: "ok" }],
      new Uint8Array([137, 80, 78, 71, 7, 7, 7]),
    );

    expect(sent.map((body) => body.type)).toEqual(["text", "interactive"]);
    expect(sent[0].text.body).toBe(
      `Thya sudah baca screenshotnya. Cek dulu ya Kak, lalu tekan Ya, Ubah, atau Batal.\n${REPLACED_LINE}`,
    );
  });

  test("a screenshot over a sale card that never reached the owner does not call that card gone", async () => {
    const typed: WebhookMessage = {
      from: OWNER,
      id: `wamid.p${++wamid}`,
      timestamp: "1",
      type: "text",
      text: { body: "tadi laku 2 americano" },
    };

    const asked = await send(
      [typed],
      [
        {
          tool: "recordSales",
          input: { day: "today", date: null, items: [{ menuName: "americano", quantity: 2 }] },
        },
        { text: "Cek dulu ya Kak, lalu jawab ya, ubah, atau batal." },
      ],
    );

    const draftId = asked
      .find((body) => body.type === "interactive")
      .interactive.action.buttons[0].reply.id.split(":")[1];

    const [card] = await db
      .select({ id: outboundMessages.id })
      .from(outboundMessages)
      .where(eq(outboundMessages.idempotencyKey, cardKey(draftId)));

    // The card's send failed for good, so the owner never had it.
    await markOutbound(db, card?.id ?? "", { status: "failed", error: "131026: undeliverable" });

    const other = {
      ...history,
      transactions: history.transactions.map((row) => ({ ...row, day: 21, reference: null })),
    };

    const sent = await send(
      [image()],
      [{ tool: "recordExtraction", input: other }, { text: "ok" }],
      new Uint8Array([137, 80, 78, 71, 6, 6, 6]),
    );

    expect(sent.map((body) => body.type)).toEqual(["text", "interactive"]);
    expect(sent[0].text.body).toBe(
      "Thya sudah baca screenshotnya. Cek dulu ya Kak, lalu tekan Ya, Ubah, atau Batal.",
    );
  });

  const words = "ini transferan kemarin";

  // Words for the model beside the screenshot, as its caption or as the next message.
  const batches = [
    { how: "with a caption", day: 20, messages: () => [image(words)] },
    {
      how: "followed by a message",
      day: 19,
      messages: () => [image(), textMessage(`wamid.p${++wamid}`, words, OWNER)],
    },
  ];

  for (const { how, day, messages } of batches)
    test(`a screenshot ${how} gets one card when the run dies before the reply`, async () => {
      const bytes = new Uint8Array([137, 80, 78, 71, day, day, day]);

      const read = {
        ...history,
        transactions: history.transactions.map((row) => ({ ...row, day, reference: null })),
      };

      // The picture reads the same way every time the model is asked.
      const reader = new MockLanguageModelV4({
        doGenerate: (options) =>
          scriptedModel([{ tool: "recordExtraction", input: read }]).doGenerate(options),
      });

      // Screenshots go to `reader`; the owner's words go to `answer`.
      const model = (answer: MockLanguageModelV4["doGenerate"]) =>
        new MockLanguageModelV4({
          doGenerate: (options) =>
            options.toolChoice?.type === "tool" ? reader.doGenerate(options) : answer(options),
        });

      const at = new Date((clock += 5 * 60_000));
      const thinking = Promise.withResolvers<void>();

      await receive(messages(), at);

      // The process dies (deploy, OOM) while the model thinks about the words. That call never
      // returns, and the run never gets to say it is still working.
      const dead = attempt(
        model(() => {
          thinking.resolve();

          return new Promise<never>(() => {});
        }),
        at,
        bytes,
        60 * 60_000,
      );

      await thinking.promise;

      // pg-boss runs the job again once the dead attempt expires.
      const replay = attempt(
        model(scriptedModel([{ text: "Baik, Kak." }]).doGenerate),
        new Date((clock += 5 * 60_000)),
        bytes,
      );

      await replay.done;

      const sent = [...dead.sent(), ...replay.sent()];
      const cards = sent.filter((body) => body.type === "interactive");

      expect(cards).toHaveLength(1);
      expect(sent.at(-1).text.body).toBe("Baik, Kak.");
      expect(reader.doGenerateCalls).toHaveLength(1);

      const saved = await send([tap(cards[0].interactive.action.buttons[0].reply.id)], []);

      expect(saved[0].text.body).toBe("Sudah dicatat, Kak: 3 pembayaran masuk.");
    });
});
