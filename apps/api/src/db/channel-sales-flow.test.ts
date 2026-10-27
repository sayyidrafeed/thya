import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { scriptedModel, type ScriptStep } from "../agent/testing";
import { createSalesTools } from "../agent/tools";
import { createWhatsAppClient } from "../channels/whatsapp/client";
import type { WebhookMessage } from "../channels/whatsapp/inbound";
import { fakeGraph } from "../channels/whatsapp/testing";
import { handleAgentTurn } from "../jobs/agent-turn";
import { createPhoneBusiness } from "../modules/business";
import { insertChannelSales } from "../modules/channel-sales";
import { recordInbound } from "../modules/conversation";
import { demoBusiness } from "../sales/demo-shop";
import { summarizeSales } from "../sales/report";
import { loadSalesDataset, seedDemoSales } from "../sales/repository";
import type { Db } from "./client";
import { channelCommissions, channelSales } from "./schema";
import { freshTestDb, integration } from "./testing";

const NOW = new Date("2026-10-25T14:00:00+07:00");
const OWNER = "6281200000005";
const config = { accessToken: "t", phoneNumberId: "PNID", graphVersion: "v23.0" };

// What the vision call returns for a GoBiz summary of two days; only 23 Okt prints the net.
const gobiz = {
  documentKind: "delivery_sales",
  provider: "gofood",
  transactions: [],
  settlement: null,
  shownTotal: null,
  unreadableReason: null,
  deliveryDays: [
    { day: 23, month: 10, year: null, grossSales: 350_000, netReceived: 280_000, orderCount: 25 },
    { day: 24, month: 10, year: null, grossSales: 200_000, netReceived: null, orderCount: 14 },
  ],
};

const extraction: ScriptStep[] = [{ tool: "recordExtraction", input: gobiz }, { text: "ok" }];

describe.if(integration)("delivery app sales screenshots (DELIVERY_IMPORT_ENABLED on)", () => {
  let db: Db;
  let businessId: string;
  let wamid = 0;
  let clock = NOW.getTime();
  const picture = new Uint8Array([137, 80, 78, 71, 4, 5, 6]);

  beforeAll(async () => {
    db = await freshTestDb();
    businessId = (await createPhoneBusiness(db, demoBusiness, OWNER)).id;
    await seedDemoSales(db, businessId, NOW);
  }, 60_000);

  afterAll(async () => {
    await db.$client.end();
  });

  async function send(messages: WebhookMessage[], script: ScriptStep[]) {
    const graph = fakeGraph(new Map([["media-1", picture]]));
    const at = new Date((clock += 5 * 60_000));
    const client = createWhatsAppClient(config, graph.fetcher);

    await recordInbound(
      db,
      messages.map((message) => ({
        wamid: message.id,
        phone: OWNER,
        type: message.type,
        payload: message,
        receivedAt: at,
      })),
    );
    await handleAgentTurn(
      {
        db,
        model: scriptedModel(script),
        delivery: { db, client, loadImage: async () => null },
        now: () => at,
        paymentsImport: false,
        deliveryImport: true,
      },
      OWNER,
    );

    return graph.sent();
  }

  const image = (): WebhookMessage => ({
    from: OWNER,
    id: `wamid.c${++wamid}`,
    timestamp: "1",
    type: "image",
    image: { id: "media-1", mime_type: "image/png" },
  });

  const text = (body: string): WebhookMessage => ({
    from: OWNER,
    id: `wamid.c${++wamid}`,
    timestamp: "1",
    type: "text",
    text: { body },
  });

  const tap = (buttonId: string): WebhookMessage => ({
    from: OWNER,
    id: `wamid.c${++wamid}`,
    timestamp: "1",
    type: "interactive",
    interactive: { type: "button_reply", button_reply: { id: buttonId, title: "Ya" } },
  });

  const yes = (sent: Awaited<ReturnType<typeof send>>) =>
    sent.find((body) => body.type === "interactive").interactive.action.buttons[0].reply.id;

  async function compare(start: string, end: string) {
    const { compareChannels } = createSalesTools(
      await loadSalesDataset(db, businessId, NOW),
      [],
      undefined,
      true,
    );

    return compareChannels.execute!(
      { period: "custom", startDate: start, endDate: end },
      { toolCallId: "t", messages: [], context: {} },
    );
  }

  test("a GoBiz screenshot becomes a card; nothing is saved before Ya, and menu revenue never moves", async () => {
    const before = await loadSalesDataset(db, businessId, NOW);
    const sent = await send([image()], extraction);
    const card = sent.find((body) => body.type === "interactive");

    expect(card.interactive.body.text).toBe(
      [
        "Dari screenshot GoFood: 2 hari, penjualan kotor total Rp550.000.",
        "- Jumat, 23 Okt 2026: Rp350.000, 25 pesanan, diterima Rp280.000",
        "- Sabtu, 24 Okt 2026: Rp200.000, 14 pesanan",
        "Dicatat terpisah dari omzet menu. Simpan?",
      ].join("\n"),
    );
    expect(await db.$count(channelSales)).toBe(0);

    const saved = await send([tap(yes(sent))], []);

    expect(saved[0].text.body).toBe(
      "Sudah dicatat, Kak: penjualan GoFood 2 hari, terpisah dari omzet menu.",
    );
    expect(await db.$count(channelSales)).toBe(2);

    const after = await loadSalesDataset(db, businessId, NOW);
    const days = { start: "2026-10-23", end: "2026-10-24" };

    expect(summarizeSales(after.records, after.menu, days).revenue).toBe(
      summarizeSales(before.records, before.menu, days).revenue,
    );
  });

  test("the same screenshot again, or a retried executor, adds nothing", async () => {
    const sent = await send([image()], extraction);

    expect(sent.map((body) => body.type)).toEqual(["text"]);
    expect(sent[0].text.body).toBe(
      "Screenshot ini sudah pernah dicatat, Kak. Tidak ada yang ditambahkan.",
    );

    const retried = await insertChannelSales(db, {
      businessId,
      draftId: crypto.randomUUID(),
      channel: "gofood",
      imageSha256: "0".repeat(64),
      rows: [
        {
          date: "2026-10-23",
          grossSales: 350_000,
          netReceived: 280_000,
          orderCount: 25,
          sourceRow: 0,
        },
      ],
    });

    expect(retried).toBe(0);
    expect(await db.$count(channelSales)).toBe(2);
  });

  test("the day with a printed net compares at once; the other waits for the owner's rate", async () => {
    const printed = await compare("2026-10-23", "2026-10-23");

    expect(printed).toMatchObject({
      status: "ok",
      channels: [
        { label: "Langsung di toko", status: "ok" },
        { label: "GoFood", status: "ok", appCommission: "Rp70.000", estimated: true },
      ],
    });

    expect(await compare("2026-10-23", "2026-10-24")).toMatchObject({
      channels: [{ status: "ok" }, { label: "GoFood", status: "not_ready" }],
    });
  });

  test("the owner's rate is a draft too, and once confirmed fills the days without a net", async () => {
    const drafted = await send(
      [text("gofood motong 20% kak")],
      [
        {
          tool: "setChannelCommission",
          input: { channel: "gofood", percent: 20, feePerOrder: null },
        },
        { text: "Cek dulu ya Kak, lalu jawab ya, ubah, atau batal." },
      ],
    );

    expect(await db.$count(channelCommissions)).toBe(0);

    const saved = await send([tap(yes(drafted))], []);

    expect(saved[0].text.body).toBe("Siap, Kak. Potongan GoFood sekarang 20%.");

    // 23 Okt: Rp350.000 - Rp280.000 from the screenshot; 24 Okt: 20% of Rp200.000.
    expect(await compare("2026-10-23", "2026-10-24")).toMatchObject({
      status: "ok",
      channels: [
        { status: "ok" },
        {
          label: "GoFood",
          status: "ok",
          revenue: "Rp550.000",
          appCommission: "Rp110.000",
          commissionFrom: "sebagian dari screenshot, sebagian dari potongan yang Kakak sebut",
        },
      ],
    });
  });
});
