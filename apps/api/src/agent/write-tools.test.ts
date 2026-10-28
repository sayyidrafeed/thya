import { describe, expect, test } from "bun:test";
import type { DraftOutcome, DraftPort, DraftRequest } from "../actions/kinds";
import { buildDemoSales, demoBusiness } from "../sales/demo-shop";
import { saveClaims } from "./postcheck";
import { runTurn } from "./run-turn";
import { scriptedModel, type ScriptStep } from "./testing";
import { SALES_TOOL_NAMES } from "./tools";
import { ambiguousHour, createWriteTools, hourChoices, matchMenu } from "./write-tools";

const NOW = new Date("2026-10-25T14:00:00+07:00");
const dataset = buildDemoSales(NOW);

const SAVED: DraftOutcome = { status: "done", message: "Sudah dicatat, Kak." };

function recordingPort(confirmed: DraftOutcome = SAVED) {
  const created: DraftRequest[] = [];
  const decided: string[] = [];

  const port: DraftPort = {
    create: async (request) => {
      created.push(request);

      return { draftId: `d${created.length}` };
    },
    confirmOpen: async () => {
      decided.push("confirm");

      return confirmed;
    },
    cancelOpen: async () => {
      decided.push("cancel");

      return { status: "done", message: "Oke Kak, dibatalkan." };
    },
    listSchedules: async () => [],
  };

  return { port, created, decided };
}

const options = { toolCallId: "t", messages: [], context: {} };

describe("matchMenu", () => {
  test("prefers an exact name and accepts a unique partial one", () => {
    expect(matchMenu(dataset.menu, "americano").map((item) => item.name)).toEqual(["Americano"]);
    expect(matchMenu(dataset.menu, "es kopi susu").map((item) => item.name)).toEqual([
      "Es Kopi Susu Gula Aren",
    ]);
    expect(matchMenu(dataset.menu, "nasi goreng")).toEqual([]);
  });
});

describe("recordSales", () => {
  test("freezes menu ids and today's prices into a draft with a code-written summary", async () => {
    const { port, created } = recordingPort();
    const { recordSales } = createWriteTools(dataset, port);

    const result = await recordSales.execute!(
      {
        day: "today",
        date: null,
        items: [
          { menuName: "es kopi susu", quantity: 3 },
          { menuName: "Americano", quantity: 2 },
        ],
      },
      options,
    );

    expect(result).toMatchObject({ status: "draft", draftId: "d1" });
    expect(created[0]?.kind).toBe("sales.record");
    expect(created[0]?.summary).toBe(
      [
        "Catat penjualan Minggu, 25 Okt 2026:",
        "- 3 Es Kopi Susu Gula Aren x Rp18.000 = Rp54.000",
        "- 2 Americano x Rp15.000 = Rp30.000",
        "Total Rp84.000",
      ].join("\n"),
    );
  });

  test("an unknown menu, a future day, or a missing date makes no draft", async () => {
    const { port, created } = recordingPort();
    const { recordSales } = createWriteTools(dataset, port);

    const unknown = await recordSales.execute!(
      { day: "today", date: null, items: [{ menuName: "nasi goreng seafood", quantity: 3 }] },
      options,
    );

    const future = await recordSales.execute!(
      { day: "custom", date: "2026-10-26", items: [{ menuName: "Americano", quantity: 1 }] },
      options,
    );

    const noDate = await recordSales.execute!(
      { day: "custom", date: null, items: [{ menuName: "Americano", quantity: 1 }] },
      options,
    );

    for (const result of [unknown, future, noDate])
      expect(result).toMatchObject({ status: "error" });
    expect(JSON.stringify(unknown)).toContain("tidak ada di daftar menu");
    expect(created).toEqual([]);
  });

  test("without a draft store the tool says recording is not available here", async () => {
    const { recordSales, confirmDraft } = createWriteTools(dataset, null);

    expect(
      await recordSales.execute!(
        { day: "today", date: null, items: [{ menuName: "Americano", quantity: 1 }] },
        options,
      ),
    ).toMatchObject({ status: "error" });
    expect(await confirmDraft.execute!({}, options)).toMatchObject({ status: "error" });
  });
});

describe("setMenuCost (onboarding HPP, E8/E9)", () => {
  const base = { amount: null, ingredients: null, estimateShare: null, includesPackaging: null };

  test("the recipe path divides purchase by portions in code", async () => {
    const { port, created } = recordingPort();
    const { setMenuCost } = createWriteTools(dataset, port);

    await setMenuCost.execute!(
      {
        ...base,
        menuName: "es kopi susu gula aren",
        method: "recipe",
        ingredients: [{ name: "gula aren 1 kg", purchaseCost: 40_000, portions: 50 }],
      },
      options,
    );

    expect(created[0]).toMatchObject({
      kind: "menu.set_cost",
      args: { amount: 800, source: "recipe", validFrom: "2026-10-25" },
    });
    expect(created[0]?.summary).toContain("gula aren 1 kg Rp40.000 untuk 50 porsi = Rp800");
    expect(created[0]?.summary).toContain("Bahan lain yang belum disebut belum masuk");
  });

  test("the estimate path takes a share of the selling price and says it is an estimate", async () => {
    const { port, created } = recordingPort();
    const { setMenuCost } = createWriteTools(dataset, port);

    await setMenuCost.execute!(
      { ...base, menuName: "Kopi Tubruk", method: "estimate", estimateShare: "half" },
      options,
    );

    expect(created[0]).toMatchObject({ args: { amount: 5_000, source: "estimate" } });
    expect(created[0]?.summary).toContain("(perkiraan)");
  });

  test("an owner amount is required for the owner path", async () => {
    const { port } = recordingPort();
    const { setMenuCost } = createWriteTools(dataset, port);

    expect(
      await setMenuCost.execute!({ ...base, menuName: "Americano", method: "owner" }, options),
    ).toMatchObject({ status: "error" });
  });
});

describe("setChannelCommission", () => {
  test("freezes the owner's percent and fee per order into a draft with a code-written card", async () => {
    const { port, created } = recordingPort();
    const { setChannelCommission } = createWriteTools(dataset, port);

    const result = await setChannelCommission.execute!(
      { channel: "gofood", percent: 20, feePerOrder: 1_000 },
      options,
    );

    expect(result).toMatchObject({ status: "draft" });
    expect(created).toEqual([
      {
        kind: "channel.set_commission",
        args: { channel: "gofood", rateBps: 2_000, feePerOrder: 1_000 },
        summary: [
          "Potongan GoFood: 20% + Rp1.000 per pesanan dari penjualan kotor.",
          "Dipakai untuk hari yang screenshot-nya tidak menulis uang yang diterima.",
        ].join("\n"),
      },
    ]);
  });

  test("keeps one decimal of a percent so the card shows what is stored", async () => {
    const { port, created } = recordingPort();
    const { setChannelCommission } = createWriteTools(dataset, port);

    await setChannelCommission.execute!(
      { channel: "grabfood", percent: 22.5, feePerOrder: null },
      options,
    );

    expect(created[0]).toMatchObject({ args: { rateBps: 2_250, feePerOrder: 0 } });
    expect(created[0]?.summary).toStartWith("Potongan GrabFood: 22,5% dari penjualan kotor.");
  });

  test("no figure, or an implausible one, asks the owner instead of drafting", async () => {
    const { port, created } = recordingPort();
    const { setChannelCommission } = createWriteTools(dataset, port);

    const none = await setChannelCommission.execute!(
      { channel: "shopeefood", percent: null, feePerOrder: null },
      options,
    );

    const tooHigh = await setChannelCommission.execute!(
      { channel: "shopeefood", percent: 70, feePerOrder: null },
      options,
    );

    expect(none).toMatchObject({ status: "error" });
    expect(tooHigh).toMatchObject({ status: "error" });
    expect(created).toEqual([]);
  });
});

describe("runTurn with a write tool", () => {
  test("returns the draft for the channel's card, and the summary's numbers count as grounded", async () => {
    const { port } = recordingPort();

    const model = scriptedModel([
      {
        tool: "recordSales",
        input: { day: "today", date: null, items: [{ menuName: "Americano", quantity: 2 }] },
      },
      { text: "Siap Kak, total Rp30.000. Cek dulu ya, lalu jawab ya, ubah, atau batal." },
    ]);

    const result = await runTurn({
      model,
      business: demoBusiness,
      dataset,
      messages: [{ role: "user", content: "tadi laku 2 americano" }],
      conceptEvents: [],
      now: NOW,
      drafts: port,
    });

    expect(result.draft).toEqual({
      draftId: "d1",
      summary:
        "Catat penjualan Minggu, 25 Okt 2026:\n- 2 Americano x Rp15.000 = Rp30.000\nTotal Rp30.000",
    });
    expect(result.check.action).toBe("none");
  });
});

describe("runTurn save claims", () => {
  const sale = (menuName: string): ScriptStep => ({
    tool: "recordSales",
    input: { day: "today", date: null, items: [{ menuName, quantity: 3 }] },
  });

  const confirm: ScriptStep = { tool: "confirmDraft", input: {} };
  const cancel: ScriptStep = { tool: "cancelDraft", input: {} };

  const savedBefore: DraftOutcome = {
    status: "already_done",
    message: "Yang tadi sudah tersimpan, Kak. Belum ada yang baru untuk dikonfirmasi.",
  };

  async function turn(steps: ScriptStep[], port: DraftPort, owner: string) {
    const model = scriptedModel(steps);

    const result = await runTurn({
      model,
      business: demoBusiness,
      dataset,
      messages: [{ role: "user", content: owner }],
      conceptEvents: [],
      now: NOW,
      drafts: port,
    });

    return { model, result };
  }

  test("a reply saying a failed sale was recorded is written once more, without forcing a tool", async () => {
    const { port, created } = recordingPort();
    const claim = "Pesanannya sudah aku catat sebagian, Kak, tapi nasi goreng belum ada di menu.";
    const honest = "Nasi goreng belum ada di daftar menu, Kak. Maksudnya Mie Goreng Telur?";

    const { model, result } = await turn(
      [sale("nasi goreng"), { text: claim }, sale("nasi goreng"), { text: honest }],
      port,
      "tadi laku 3 nasi goreng",
    );

    const retry = model.doGenerateCalls[2];

    expect(result.reply).toBe(honest);
    expect(result.check).toMatchObject({ action: "regenerated", attempts: 2 });
    expect(JSON.stringify(retry?.prompt.find((m) => m.role === "system"))).toContain(
      "tidak ada hasil confirmDraft",
    );
    expect(retry?.toolChoice).toEqual({ type: "auto" });
    expect(created).toEqual([]);
  });

  test("two claiming tries end on code-written text that points at the draft card", async () => {
    const { result } = await turn(
      [
        sale("Americano"),
        { text: "Siap Kak, sudah tercatat ya." },
        sale("Americano"),
        { text: "Oke, sudah kucatat." },
      ],
      recordingPort().port,
      "tadi laku 3 americano",
    );

    expect(result.check).toMatchObject({ action: "template", attempts: 2 });
    expect(result.reply).toStartWith("Belum tersimpan ya, Kak.");
    expect(saveClaims(result.reply)).toEqual([]);
    expect(result.draft?.draftId).toBe("d2");
  });

  test("a typed ya that saved in this turn may say so", async () => {
    const { result } = await turn(
      [confirm, { text: "Sudah dicatat, Kak." }],
      recordingPort().port,
      "ya",
    );

    expect(result).toMatchObject({ reply: "Sudah dicatat, Kak.", check: { action: "none" } });
  });

  test("with no draft to confirm, a claim is not allowed: code relays the confirm message, or a neutral apology", async () => {
    const nothingOpen = recordingPort({
      status: "none",
      message: "Belum ada yang menunggu konfirmasi, Kak.",
    }).port;

    const first = { text: "Sudah tersimpan semua, Kak." };
    const second = { text: "Yang tadi sudah tersimpan." };
    const relayed = await turn([confirm, first, confirm, second], nothingOpen, "ya");
    const withoutTools = await turn([first, second], nothingOpen, "ya");

    expect(relayed.result).toMatchObject({
      reply: "Belum ada yang menunggu konfirmasi, Kak.",
      check: { action: "template", attempts: 2 },
    });
    expect(withoutTools.result.reply).toStartWith("Maaf Kak, Thya belum bisa jawab yang ini");
    expect(withoutTools.model.doGenerateCalls[1]?.toolChoice).toEqual({ type: "auto" });
  });

  test("a second ya may say the earlier save stands once confirmDraft reports it", async () => {
    const { port, decided } = recordingPort(savedBefore);

    const { model, result } = await turn(
      [{ text: "Catatan tadi sudah Thya simpan ya, Kak." }, confirm, { text: savedBefore.message }],
      port,
      "ya",
    );

    expect(result).toMatchObject({
      reply: savedBefore.message,
      check: { action: "regenerated", attempts: 2 },
    });
    expect(model.doGenerateCalls[1]?.toolChoice).toEqual({ type: "auto" });
    expect(decided).toEqual(["confirm"]);
  });

  test("an earlier save backs no claim in a turn that drafted something new or failed to", async () => {
    const failed = recordingPort(savedBefore);
    const drafted = recordingPort(savedBefore);
    const honest = "Nasi goreng belum ada di daftar menu, Kak. Maksudnya Mie Goreng Telur?";

    const pointed =
      "3 Americano Thya siapkan dulu, Kak. Cek ringkasannya, lalu jawab ya, ubah, atau batal.";

    // Saved within the window, then a new sale fails and confirmDraft is called unasked.
    const afterFailure = await turn(
      [
        sale("nasi goreng"),
        confirm,
        { text: "Pesanannya sudah aku catat sebagian, Kak." },
        { text: honest },
      ],
      failed.port,
      "tadi laku 3 nasi goreng",
    );

    const afterDraft = await turn(
      [
        confirm,
        sale("Americano"),
        { text: "Yang tadi aman, Kak. 3 Americano juga sudah aku catat." },
        { text: pointed },
      ],
      drafted.port,
      "ya, tadi laku 3 americano juga",
    );

    expect(afterFailure.result).toMatchObject({
      reply: honest,
      check: { action: "regenerated", attempts: 2 },
    });
    expect(afterDraft.result).toMatchObject({
      reply: pointed,
      check: { action: "regenerated", attempts: 2 },
    });
  });

  test("a draft made by the first attempt keeps its card until a confirm in the turn settles it", async () => {
    const { port, created, decided } = recordingPort();
    const claim = { text: "Siap Kak, sudah aku catat ya." };

    const pointed =
      "Draftnya sudah siap, Kak. Cek ringkasannya dulu, lalu jawab ya, ubah, atau batal.";

    const { result } = await turn(
      [sale("Americano"), claim, { text: pointed }],
      port,
      "tadi laku 3 americano",
    );

    const settled = await turn(
      [sale("Americano"), claim, confirm, { text: "Sudah dicatat, Kak." }],
      recordingPort().port,
      "ya, tadi laku 3 americano",
    );

    expect(result).toMatchObject({
      reply: pointed,
      check: { action: "regenerated", attempts: 2 },
      toolCalls: [],
    });
    expect(result.draft).toEqual({ draftId: "d1", summary: created[0]?.summary ?? "" });
    expect(decided).toEqual([]);
    expect(settled.result).toMatchObject({ check: { action: "regenerated" }, draft: null });
  });

  test("the step forced by a made-up figure offers read tools only, so an open draft stays open", async () => {
    const { port, decided } = recordingPort();

    const { model, result } = await turn(
      [{ text: "Omzet hari ini Rp9.999.999, Kak." }, confirm, { text: "Sudah dicatat, Kak." }],
      port,
      "omzet hari ini berapa?",
    );

    const forced = model.doGenerateCalls[1];

    expect(forced?.toolChoice).toEqual({ type: "required" });
    expect(forced?.tools?.map((offered) => offered.name)).toEqual([...SALES_TOOL_NAMES]);
    expect(decided).toEqual([]);
    expect(saveClaims(result.reply)).toEqual([]);
  });

  test("a cancel is no save, so the reply may not say something was recorded", async () => {
    const honest = "Oke Kak, dibatalkan. Tidak ada yang disimpan.";

    const { result } = await turn(
      [cancel, { text: "Oke Kak, dicatat batal ya." }, { text: honest }],
      recordingPort().port,
      "eh nggak jadi, batal aja",
    );

    expect(result).toMatchObject({ reply: honest, check: { action: "regenerated", attempts: 2 } });
  });

  test("a save by the first attempt still counts when only a figure is written again", async () => {
    const { port, decided } = recordingPort();

    const { result } = await turn(
      [
        confirm,
        { text: "Sudah dicatat, Kak. Omzet hari ini jadi Rp9.999.999." },
        { text: "Sudah dicatat, Kak." },
      ],
      port,
      "ya",
    );

    expect(result).toMatchObject({
      reply: "Sudah dicatat, Kak.",
      check: { action: "regenerated", attempts: 2 },
    });
    expect(decided).toEqual(["confirm"]);
  });

  test("an open draft stays open when the owner only asks whether it was recorded", async () => {
    const asked = "yang tadi udah kecatat belum?";
    const claim = { text: "Sudah kecatat, Kak." };
    const honest = { text: "Belum, Kak. Cek ringkasannya dulu, lalu jawab ya, ubah, atau batal." };
    const withFigure = { text: "Sudah kecatat, Kak. Omzet hari ini jadi Rp9.999.999." };
    const answered = recordingPort();
    const repeated = recordingPort();
    const figured = recordingPort();
    const rewritten = await turn([claim, honest], answered.port, asked);
    const twice = await turn([claim, claim], repeated.port, asked);
    const unforced = await turn([withFigure, honest], figured.port, asked);
    const retry = rewritten.model.doGenerateCalls[1];

    expect(rewritten.result).toMatchObject({
      reply: honest.text,
      check: { action: "regenerated" },
    });
    expect(twice.result.reply).toStartWith("Maaf Kak, Thya belum bisa jawab yang ini");
    expect(JSON.stringify(retry?.prompt.find((m) => m.role === "system"))).toContain(
      "bukan jawaban setuju, misalnya pertanyaan, jangan panggil confirmDraft",
    );
    expect(retry?.toolChoice).toEqual({ type: "auto" });
    // A made-up figure beside the claim still must not force a tool that could be confirmDraft.
    expect(unforced.model.doGenerateCalls[1]?.toolChoice).toEqual({ type: "auto" });
    expect([...answered.decided, ...repeated.decided, ...figured.decided]).toEqual([]);
  });
});

describe("ambiguousHour (schedule-ambiguous-hour)", () => {
  test('"jam 6" needs pagi or malam; a day part, a 24-hour time, or a padded hour is clear', () => {
    expect(ambiguousHour("jam 6")).toBe(true);
    expect(ambiguousHour("tiap jam 9.30")).toBe(true);
    expect(ambiguousHour("jam 6 sore")).toBe(false);
    expect(ambiguousHour("jam 21.00")).toBe(false);
    expect(ambiguousHour("jam 06:00")).toBe(false);
    expect(ambiguousHour(null)).toBe(false);
  });

  test("offers both readings of the hour in the owner's words, as button titles", () => {
    expect(hourChoices("jam 6")).toEqual(["Jam 6 pagi", "Jam 6 sore"]);
    expect(hourChoices("tiap jam 9.30")).toEqual(["Jam 9.30 pagi", "Jam 9.30 malam"]);
    expect(hourChoices("jam 12")).toEqual(["Jam 12 malam", "Jam 12 siang"]);
    expect(hourChoices("jam 6 sore")).toBeNull();
  });
});
