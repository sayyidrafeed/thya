import { describe, expect, test } from "bun:test";
import type { UIMessage } from "ai";
import { DRAFT_UNSEEN, type DraftRequest } from "../actions/kinds";
import { runTurn } from "../agent";
import { scriptedModel } from "../agent/testing";
import { buildDemoSales, demoBusiness } from "../sales/demo-shop";
import { demoDraftPort } from "./demo-drafts";

const draftTurn: UIMessage = {
  id: "a1",
  role: "assistant",
  parts: [
    {
      type: "tool-recordSales",
      toolCallId: "c1",
      state: "output-available",
      input: {},
      output: { status: "draft", draftId: "x", summary: "Catat penjualan" },
    },
    { type: "text", text: "Cek dulu ya Kak." },
  ],
};

const decisionTurn = (
  type: "tool-confirmDraft" | "tool-cancelDraft",
  outcome: string,
  id: string,
): UIMessage => ({
  id,
  role: "assistant",
  parts: [
    {
      type,
      toolCallId: id,
      state: "output-available",
      input: {},
      output: { status: "ok", outcome, message: "Pesan dari kode" },
    },
  ],
});

const confirmedTurn = decisionTurn("tool-confirmDraft", "done", "a2");

const owner = (text: string): UIMessage => ({
  id: text,
  role: "user",
  parts: [{ type: "text", text }],
});

const latte: DraftRequest = {
  kind: "sales.record",
  args: {
    date: "2026-10-25",
    items: [{ menuItemId: "matcha", name: "Matcha Latte", quantity: 1, unitPrice: 22_000 }],
  },
  summary: "Catat 1 Matcha Latte",
};

describe("demo drafts", () => {
  test("the visitor's latest draft is open until a confirm, and saving changes no data", async () => {
    const open = demoDraftPort([owner("tadi laku 2 americano"), draftTurn, owner("ya")]);
    const saved = await open.confirmOpen();

    expect(saved.status).toBe("done");
    expect(saved.message).toContain("data contoh Kopi Senja tidak berubah");
    expect(await open.confirmOpen()).toMatchObject({ status: "already_done" });
    expect(await demoDraftPort([owner("ya")]).confirmOpen()).toMatchObject({ status: "none" });
    expect(await demoDraftPort([owner("ya")]).cancelOpen()).toMatchObject({ status: "none" });
  });

  test("another ya after the latest draft was saved hears so, as on WhatsApp; a cancel saved nothing", async () => {
    const again = demoDraftPort([draftTurn, confirmedTurn, owner("ya")]);

    const third = demoDraftPort([
      draftTurn,
      confirmedTurn,
      decisionTurn("tool-confirmDraft", "already_done", "a3"),
      owner("ya"),
    ]);

    const cancelled = demoDraftPort([
      draftTurn,
      decisionTurn("tool-cancelDraft", "done", "a2"),
      owner("ya"),
    ]);

    expect(await again.confirmOpen()).toMatchObject({ status: "already_done" });
    expect(await third.confirmOpen()).toMatchObject({ status: "already_done" });
    expect(await again.cancelOpen()).toMatchObject({ status: "none" });
    expect(await cancelled.confirmOpen()).toMatchObject({ status: "none" });
  });

  test("a confirm that decided nothing leaves the draft open, as in Postgres", async () => {
    const unseen = decisionTurn("tool-confirmDraft", "none", "a2");
    const port = demoDraftPort([draftTurn, unseen, owner("ya")]);

    expect(await port.checkLatest()).toMatchObject({ status: "none", summary: "Catat penjualan" });
    expect(await port.confirmOpen()).toMatchObject({ status: "done" });
    expect(await port.checkLatest()).toMatchObject({ status: "already_done" });
  });

  test("a draft made in this request waits for the next one, and says which open one it replaced", async () => {
    const fresh = demoDraftPort([owner("ya, tadi laku 1 latte")]);
    const over = demoDraftPort([draftTurn, owner("ya, sama catat 1 latte")]);

    expect(await fresh.create(latte)).toMatchObject({ replaced: null });
    expect(await fresh.confirmOpen()).toEqual(DRAFT_UNSEEN);
    expect(await over.create(latte)).toMatchObject({ replaced: "Catat penjualan" });
    expect(await over.confirmOpen()).toEqual(DRAFT_UNSEEN);
    expect(await over.checkLatest()).toMatchObject({ summary: "Catat 1 Matcha Latte" });
  });

  test("a redraft in the same request replaces nothing new, and the card is the last draft", async () => {
    const fresh = demoDraftPort([owner("tadi laku 1 latte")]);
    const over = demoDraftPort([draftTurn, owner("ya, sama catat 1 latte")]);
    const twoLattes = { ...latte, summary: "Catat 2 Matcha Latte" };

    await fresh.create(latte);
    await over.create(latte);

    const again = await fresh.create(twoLattes);

    expect(again.replaced).toBeNull();
    expect(await over.create(twoLattes)).toMatchObject({ replaced: "Catat penjualan" });
    expect(await fresh.endTurn()).toEqual({
      draftId: again.draftId,
      summary: "Catat 2 Matcha Latte",
    });
    expect(await fresh.cancelOpen()).toMatchObject({ status: "done" });
    expect(await fresh.endTurn()).toBeNull();
    expect(await demoDraftPort([draftTurn, owner("ya")]).endTurn()).toBeNull();
  });

  test("a ya that saved the open draft beside a new sale ends in code's words, not the model's claim", async () => {
    const now = new Date("2026-10-25T14:00:00+07:00");
    const saved = (await demoDraftPort([draftTurn, owner("ya")]).confirmOpen()).message;

    const yaPlusSale = (menuName: string) => {
      const said = `ya, sama tadi laku 3 ${menuName}`;

      return runTurn({
        model: scriptedModel([
          { tool: "confirmDraft", input: {} },
          {
            tool: "recordSales",
            input: { day: "today", date: null, items: [{ menuName, quantity: 3 }] },
          },
          { text: "Sudah dicatat semuanya ya Kak." },
          // What a fresh rewrite would say: no claim, and no word of the save it never saw.
          { text: "Siap, Kak." },
        ]),
        business: demoBusiness,
        dataset: buildDemoSales(now),
        messages: [{ role: "user", content: said }],
        conceptEvents: [],
        now,
        drafts: demoDraftPort([draftTurn, owner(said)]),
      });
    };

    const failed = await yaPlusSale("nasi goreng");
    const drafted = await yaPlusSale("americano");

    expect(failed.reply.split("\n")).toEqual([
      saved,
      expect.stringMatching(/^"nasi goreng" tidak ada di daftar menu\./),
    ]);
    expect(failed.draft).toBeNull();
    expect(drafted.reply.split("\n")).toEqual([
      saved,
      "Belum tersimpan ya, Kak. Cek ringkasannya dulu, lalu jawab ya, ubah, atau batal.",
    ]);
    expect(drafted.draft?.summary).toContain("3 Americano");
  });
});
