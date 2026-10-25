import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { and, eq } from "drizzle-orm";
import { scriptedModel, type ScriptStep } from "../agent/testing";
import { createWhatsAppClient } from "../channels/whatsapp/client";
import type { WebhookMessage } from "../channels/whatsapp/inbound";
import { fakeGraph, textMessage } from "../channels/whatsapp/testing";
import { handleAgentTurn } from "../jobs/agent-turn";
import { createPhoneBusiness } from "../modules/business";
import { recordInbound } from "../modules/conversation";
import { demoBusiness } from "../sales/demo-shop";
import { loadSalesDataset, seedDemoSales } from "../sales/repository";
import { summarizeSales } from "../sales/report";
import type { Db } from "./client";
import { drafts, menuCosts, transactions } from "./schema";
import { freshTestDb, integration } from "./testing";

const NOW = new Date("2026-10-25T14:00:00+07:00");
const OWNER = "6281200000002";
const config = { accessToken: "t", phoneNumberId: "PNID", graphVersion: "v23.0" };

const recordTwoAmericano: ScriptStep[] = [
  {
    tool: "recordSales",
    input: { day: "today", date: null, items: [{ menuName: "americano", quantity: 2 }] },
  },
  { text: "Cek dulu ya Kak, lalu jawab ya, ubah, atau batal." },
];

const tap = (id: string, title: string, buttonId: string): WebhookMessage => ({
  from: OWNER,
  id,
  timestamp: String(NOW.getTime() / 1000),
  type: "interactive",
  interactive: { type: "button_reply", button_reply: { id: buttonId, title } },
});

describe.if(integration)("drafts over WhatsApp", () => {
  let db: Db;
  let businessId: string;
  let wamid = 0;

  beforeAll(async () => {
    db = await freshTestDb();
    businessId = (await createPhoneBusiness(db, demoBusiness, OWNER)).id;
    await seedDemoSales(db, businessId, NOW);
  }, 60_000);

  afterAll(async () => {
    await db.$client.end();
  });

  // Each message a few minutes after the last, like a real owner, so the rate limit stays out of it.
  let clock = NOW.getTime();
  const later = () => new Date((clock += 3 * 60_000));

  async function send(message: WebhookMessage, script: ScriptStep[] = [], at = later()) {
    const graph = fakeGraph();
    const model = scriptedModel(script);
    const client = createWhatsAppClient(config, graph.fetcher);

    await recordInbound(db, [
      {
        wamid: message.id,
        phone: OWNER,
        type: message.type,
        payload: message,
        receivedAt: at,
      },
    ]);

    await handleAgentTurn(
      { db, model, delivery: { db, client, loadImage: async () => null }, now: () => at },
      OWNER,
    );

    return { sent: graph.sent(), model };
  }

  const say = (text: string, script: ScriptStep[] = [], at = later()) =>
    send(textMessage(`wamid.t${++wamid}`, text, OWNER), script, at);

  const press = (title: string, buttonId: string, script: ScriptStep[] = [], at = later()) =>
    send(tap(`wamid.b${++wamid}`, title, buttonId), script, at);

  const chatRows = () =>
    db.$count(
      transactions,
      and(eq(transactions.businessId, businessId), eq(transactions.source, "chat")),
    );

  async function draftFromCard() {
    const { sent } = await say("tadi laku 2 americano", recordTwoAmericano);
    const card = sent.find((body) => body.type === "interactive");

    return {
      sent,
      buttons: card?.interactive.action.buttons.map(
        (button: { reply: { id: string } }) => button.reply.id,
      ),
    };
  }

  test("a sale typed in chat becomes a card, and one tap on Ya saves it once", async () => {
    const before = await loadSalesDataset(db, businessId, NOW);
    const { sent, buttons } = await draftFromCard();

    expect(sent.map((body) => body.type)).toEqual(["text", "interactive"]);
    expect(sent[1].interactive.body.text).toContain("- 2 Americano x Rp15.000 = Rp30.000");
    expect(await chatRows()).toBe(0);

    const yes = buttons?.[0] ?? "";
    const first = await press("Ya", yes);
    const second = await press("Ya", yes);

    expect(first.sent.map((body) => body.text.body)).toEqual([
      "Sudah dicatat, Kak: 2 Americano untuk Minggu, 25 Okt 2026.",
    ]);
    expect(second.sent[0].text.body).toContain("tidak menyimpannya dua kali");
    expect(first.model.doGenerateCalls).toHaveLength(0);
    expect(await chatRows()).toBe(1);

    const after = await loadSalesDataset(db, businessId, NOW);
    const today = { start: "2026-10-25", end: "2026-10-25" };

    expect(summarizeSales(after.records, after.menu, today).revenue).toBe(
      summarizeSales(before.records, before.menu, today).revenue + 30_000,
    );
  });

  test("Batal cancels without saving; Ubah cancels and lets the model ask what to change", async () => {
    const { buttons } = await draftFromCard();
    const cancelled = await press("Batal", buttons?.[2] ?? "");

    expect(cancelled.sent[0].text.body).toBe("Oke Kak, dibatalkan. Tidak ada yang disimpan.");

    const again = await draftFromCard();

    const edit = await press("Ubah", again.buttons?.[1] ?? "", [
      { text: "Mau diubah jadi apa, Kak?" },
    ]);

    expect(edit.sent[0].text.body).toBe("Mau diubah jadi apa, Kak?");
    expect(edit.model.doGenerateCalls).toHaveLength(1);
    expect(await chatRows()).toBe(1);
  });

  test("a newer draft replaces the open one, so an old card's Ya does nothing", async () => {
    const old = await draftFromCard();
    await draftFromCard();

    const stale = await press("Ya", old.buttons?.[0] ?? "");

    expect(stale.sent[0].text.body).toContain("sudah dibatalkan atau diganti");
    expect(await chatRows()).toBe(1);
  });

  test("a typed ya confirms the open draft through confirmDraft", async () => {
    const typed = await say("ya", [
      { tool: "confirmDraft", input: {} },
      { text: "Sudah dicatat, Kak: 2 Americano untuk Minggu, 25 Okt 2026." },
    ]);

    expect(typed.sent[0].text.body).toContain("Sudah dicatat");
    expect(await chatRows()).toBe(2);
  });

  test("a tap after the draft expired saves nothing", async () => {
    const { buttons } = await draftFromCard();
    const late = new Date(clock + 7 * 60 * 60 * 1000);
    const expired = await press("Ya", buttons?.[0] ?? "", [], late);

    expect(expired.sent[0].text.body).toContain("Konfirmasinya sudah lewat");
    expect(await chatRows()).toBe(2);
    expect(await db.$count(drafts, eq(drafts.status, "expired"))).toBe(1);
  });

  test("a new cost per portion applies from today and leaves last week's profit alone", async () => {
    const lastWeek = { start: "2026-10-12", end: "2026-10-18" };
    const before = await loadSalesDataset(db, businessId, NOW);

    const { sent } = await say("modal americano sekarang 6 ribu", [
      {
        tool: "setMenuCost",
        input: {
          menuName: "americano",
          method: "owner",
          amount: 6_000,
          ingredients: null,
          estimateShare: null,
          includesPackaging: true,
        },
      },
      { text: "Cek dulu ya Kak." },
    ]);

    const yes = sent[1].interactive.action.buttons[0].reply.id;
    const saved = await press("Ya", yes);

    expect(saved.sent[0].text.body).toContain("Modal per porsi Americano sekarang Rp6.000");
    expect(await db.$count(menuCosts, eq(menuCosts.source, "owner"))).toBe(1);

    const after = await loadSalesDataset(db, businessId, NOW);

    expect(summarizeSales(after.records, after.menu, lastWeek).grossProfit).toBe(
      summarizeSales(before.records, before.menu, lastWeek).grossProfit,
    );
    expect(after.menu.find((item) => item.name === "Americano")?.cost).toBe(6_000);
  });
});
