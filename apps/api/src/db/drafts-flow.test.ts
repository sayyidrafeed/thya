import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { and, eq } from "drizzle-orm";
import { REPLACED_LINE } from "../agent";
import { saveClaims } from "../agent/postcheck";
import { scriptedModel, type ScriptStep, type ToolStep } from "../agent/testing";
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
      {
        db,
        model,
        delivery: { db, client, loadImage: async () => null },
        now: () => at,
        paymentsImport: false,
      },
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

  test("after Ya, asking whether it went in is answered from the saved draft, not an apology", async () => {
    const { buttons } = await draftFromCard();

    await press("Ya", buttons?.[0] ?? "");

    const before = await chatRows();

    const asked = await say("yang tadi udah masuk belum?", [
      { text: "Sudah masuk, Kak." },
      { tool: "checkDraft", input: {} },
      { text: "Sudah tersimpan, Kak: 2 Americano." },
    ]);

    expect(asked.sent.map((body) => body.text.body)).toEqual([
      "Sudah tersimpan, Kak: 2 Americano.",
    ]);
    expect(JSON.stringify(asked.model.doGenerateCalls[1]?.prompt)).toContain("panggil checkDraft");
    expect(await chatRows()).toBe(before);
  });

  test("Batal or Ubah on a card that is already saved says so and records nothing twice", async () => {
    const before = await chatRows();
    const { buttons } = await draftFromCard();

    await press("Ya", buttons?.[0] ?? "");

    const cancel = await press("Batal", buttons?.[2] ?? "");
    const edit = await press("Ubah", buttons?.[1] ?? "");

    expect(cancel.sent[0].text.body).toContain("sudah tersimpan");
    expect(edit.sent[0].text.body).toContain("sudah tersimpan");
    expect(edit.model.doGenerateCalls).toHaveLength(0);
    expect(await chatRows()).toBe(before + 1);
  });

  const DRAFT_LINE =
    "Belum tersimpan ya, Kak. Cek ringkasannya dulu, lalu jawab ya, ubah, atau batal.";

  const sale = (menuName: string, quantity = 3): ToolStep => ({
    tool: "recordSales",
    input: { day: "today", date: null, items: [{ menuName, quantity }] },
  });

  const claimTwice = (first: ScriptStep[], second: ScriptStep[]): ScriptStep[] => [
    ...first,
    { text: "Sudah aku catat ya Kak." },
    ...second,
    { text: "Siap, sudah tercatat." },
  ];

  const pendingIds = async () =>
    (
      await db
        .select({ id: drafts.id })
        .from(drafts)
        .where(and(eq(drafts.businessId, businessId), eq(drafts.status, "pending")))
    ).map((row) => row.id);

  // Every message this turn sent, and the draft id its one card carries.
  function delivered(sent: Awaited<ReturnType<typeof send>>["sent"]) {
    const cards = sent.filter((body) => body.type === "interactive");
    const yes: string = cards[0]?.interactive.action.buttons[0].reply.id ?? "";

    return {
      texts: sent.filter((body) => body.type === "text").map((body) => body.text.body),
      cards,
      cardDraft: yes.split(":")[1],
    };
  }

  const statusOf = async (draftId = "") =>
    (await db.select({ status: drafts.status }).from(drafts).where(eq(drafts.id, draftId)))[0]
      ?.status;

  test("a retry that drafts the sale again replaces nothing the owner saw", async () => {
    const { sent } = await say(
      "tadi laku 3 americano",
      claimTwice([sale("americano")], [sale("americano")]),
    );

    const { texts, cardDraft } = delivered(sent);

    expect(texts).toEqual([DRAFT_LINE]);
    expect(await pendingIds()).toEqual([cardDraft ?? ""]);
    await press("Batal", `draft:${cardDraft}:cancel`);
  });

  test("a retry over a card the owner had open still tells that the card is gone", async () => {
    const open = await draftFromCard();

    const { sent } = await say(
      "ya, sama catat 3 americano",
      claimTwice([sale("americano")], [sale("americano")]),
    );

    const { texts, cardDraft } = delivered(sent);

    expect(texts).toEqual([`${REPLACED_LINE}\n${DRAFT_LINE}`]);
    expect(await statusOf(open.buttons?.[0]?.split(":")[1])).toBe("cancelled");
    expect(await pendingIds()).toEqual([cardDraft ?? ""]);
    await press("Batal", `draft:${cardDraft}:cancel`);
  });

  test("a new sale that fails is told as not recorded, never as the earlier save", async () => {
    const { buttons } = await draftFromCard();

    await press("Ya", buttons?.[0] ?? "");

    const before = await chatRows();
    const check: ScriptStep = { tool: "checkDraft", input: {} };

    const { sent } = await say(
      "tadi laku 3 nasi goreng",
      claimTwice([sale("nasi goreng"), check], [sale("nasi goreng"), check]),
    );

    expect(sent.map((body) => body.type)).toEqual(["text"]);
    expect(sent[0].text.body).toStartWith('"nasi goreng" tidak ada di daftar menu.');
    expect(saveClaims(sent[0].text.body)).toEqual([]);
    expect(await chatRows()).toBe(before);
  });

  test("a retry that drafts and then fails leaves the card on its own draft, the one ya saves", async () => {
    // The script runs out after the retry's recordSales, so the retry fails like a provider error.
    const { sent } = await say("tadi laku 3 americano", [
      sale("americano"),
      { text: "Sudah aku catat ya Kak." },
      sale("americano", 4),
    ]);

    const { texts, cards, cardDraft } = delivered(sent);
    const before = await chatRows();

    expect(texts).toEqual([DRAFT_LINE]);
    expect(cards[0]?.interactive.body.text).toContain("4 Americano");
    expect(await pendingIds()).toEqual([cardDraft ?? ""]);

    await say("ya", [{ tool: "confirmDraft", input: {} }, { text: "Sudah dicatat, Kak." }]);

    expect(await statusOf(cardDraft)).toBe("done");
    expect(await chatRows()).toBe(before + 1);
  });

  test("two drafts made in one step leave one card, and a typed ya saves that card's draft", async () => {
    for (let round = 0; round < 20; round++) {
      const before = await chatRows();

      const { sent } = await say(`catat 2 americano, modal matcha latte ${7_000 + round}`, [
        {
          parallel: [
            sale("americano", 2),
            {
              tool: "setMenuCost",
              input: {
                menuName: "matcha latte",
                method: "owner",
                amount: 7_000 + round,
                ingredients: null,
                estimateShare: null,
                includesPackaging: true,
              },
            },
          ],
        },
        { text: "Cek dulu ya Kak, lalu jawab ya, ubah, atau batal." },
      ]);

      const { cards, cardDraft = "" } = delivered(sent);
      const [kept] = await db.select().from(drafts).where(eq(drafts.id, cardDraft));
      const sameTurn = eq(drafts.traceId, kept?.traceId ?? "");
      const turn = await db.select().from(drafts).where(sameTurn);

      expect(cards).toHaveLength(1);
      expect(cards[0]?.interactive.body.text).toBe(kept?.summary);
      expect(await pendingIds()).toEqual([cardDraft]);
      expect(turn.map((row) => row.status).toSorted()).toEqual(["cancelled", "pending"]);

      await say("ya", [{ tool: "confirmDraft", input: {} }, { text: "Sudah dicatat, Kak." }]);

      expect(await statusOf(cardDraft)).toBe("done");
      expect(await pendingIds()).toEqual([]);
      expect(await chatRows()).toBe(kept?.kind === "sales.record" ? before + 1 : before);
    }
  }, 60_000);

  test("a draft cancelled in the turn that made it gets no card", async () => {
    const { sent } = await say("tadi laku 2 americano, eh batal deh", [
      sale("americano", 2),
      { tool: "cancelDraft", input: {} },
      { text: "Oke Kak, dibatalkan. Tidak ada yang disimpan." },
    ]);

    expect(sent.map((body) => body.type)).toEqual(["text"]);
    expect(await pendingIds()).toEqual([]);
  });

  test("in a forwarded message, an earlier save read back backs no claim (A14)", async () => {
    const { buttons } = await draftFromCard();

    await press("Ya", buttons?.[0] ?? "");

    const check: ScriptStep = { tool: "checkDraft", input: {} };
    const forwarded = textMessage(`wamid.t${++wamid}`, "Kak tadi 2 americano ya", OWNER);

    const { sent } = await send({ ...forwarded, context: { forwarded: true } }, [
      check,
      { text: "Sudah tersimpan, Kak." },
      check,
      { text: "Sudah tersimpan kok, Kak." },
    ]);

    expect(sent.map((body) => body.type)).toEqual(["text"]);
    expect(sent[0].text.body).toContain("belum tersimpan");
    expect(saveClaims(sent[0].text.body)).toEqual([]);
  });

  // A typed ya saves the open card, then the same message names a new sale; the model claims both.
  async function yaPlusSale(menuName: string) {
    const { buttons } = await draftFromCard();
    const before = await chatRows();

    // A rewrite would start fresh and drop the save, so code answers before any retry.
    const { sent } = await say(`ya, sama tadi laku 3 ${menuName}`, [
      { tool: "confirmDraft", input: {} },
      sale(menuName),
      { text: "Sudah dicatat semuanya ya Kak." },
      { text: "Siap, Kak." },
    ]);

    const { texts, cards, cardDraft } = delivered(sent);
    const [saved = "", rest = ""] = texts[0]?.split("\n") ?? [];

    expect(texts).toEqual([`${saved}\n${rest}`]);
    expect(saved).toStartWith("Sudah dicatat, Kak: 2 Americano untuk ");
    // The one claim left is the draft owner's own line about the card that was saved.
    expect(saveClaims(texts[0] ?? "")).toEqual([saved]);
    expect(await statusOf(buttons?.[0]?.split(":")[1])).toBe("done");
    expect(await chatRows()).toBe(before + 1);

    return { rest, cards, cardDraft };
  }

  test("a ya that saves the open card beside a new sale that fails ends in code's words", async () => {
    const { rest, cards } = await yaPlusSale("nasi goreng");

    expect(rest).toStartWith('"nasi goreng" tidak ada di daftar menu.');
    expect(cards).toEqual([]);
    expect(await pendingIds()).toEqual([]);
  });

  test("a ya that saves the open card beside a new sale points at the new card in code's words", async () => {
    const { rest, cards, cardDraft } = await yaPlusSale("americano");

    expect(rest).toBe(DRAFT_LINE);
    expect(cards[0]?.interactive.body.text).toContain("3 Americano");
    expect(await pendingIds()).toEqual([cardDraft ?? ""]);
    await press("Batal", `draft:${cardDraft}:cancel`);
  });
});
