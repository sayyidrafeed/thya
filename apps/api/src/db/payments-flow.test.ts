import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { scriptedModel, type ScriptStep } from "../agent/testing";
import { createWhatsAppClient } from "../channels/whatsapp/client";
import type { WebhookMessage } from "../channels/whatsapp/inbound";
import { fakeGraph } from "../channels/whatsapp/testing";
import { handleAgentTurn } from "../jobs/agent-turn";
import { createPhoneBusiness } from "../modules/business";
import { recordInbound } from "../modules/conversation";
import { demoBusiness } from "../sales/demo-shop";
import { summarizeSales } from "../sales/report";
import { loadSalesDataset, seedDemoSales } from "../sales/repository";
import { computeMetric } from "../semantic/metrics";
import type { Db } from "./client";
import { payments } from "./schema";
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

  async function send(messages: WebhookMessage[], script: ScriptStep[], bytes = picture) {
    const graph = fakeGraph(new Map([["media-1", bytes]]));
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
        paymentsImport: true,
      },
      OWNER,
    );

    return graph.sent();
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
});
