import { describe, expect, test } from "bun:test";
import type { UIMessage } from "ai";
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

describe("demo drafts", () => {
  test("the visitor's latest draft is open until a confirm, and saving changes no data", async () => {
    const open = demoDraftPort([owner("tadi laku 2 americano"), draftTurn, owner("ya")]);

    expect(await open.confirmOpen()).toMatchObject({ status: "done" });
    expect((await open.confirmOpen()).message).toContain("data contoh Kopi Senja tidak berubah");
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
});
