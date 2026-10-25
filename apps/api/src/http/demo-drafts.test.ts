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

const confirmedTurn: UIMessage = {
  id: "a2",
  role: "assistant",
  parts: [
    {
      type: "tool-confirmDraft",
      toolCallId: "c2",
      state: "output-available",
      input: {},
      output: { status: "ok", outcome: "done", message: "Sudah dicatat" },
    },
  ],
};

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

    const decided = demoDraftPort([draftTurn, confirmedTurn, owner("ya")]);

    expect(await decided.confirmOpen()).toMatchObject({ status: "none" });
    expect(await demoDraftPort([owner("ya")]).cancelOpen()).toMatchObject({ status: "none" });
  });
});
