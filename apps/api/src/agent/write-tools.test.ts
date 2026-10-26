import { describe, expect, test } from "bun:test";
import type { DraftPort, DraftRequest } from "../actions/kinds";
import { buildDemoSales, demoBusiness } from "../sales/demo-shop";
import { runTurn } from "./run-turn";
import { scriptedModel } from "./testing";
import { ambiguousHour, createWriteTools, hourChoices, matchMenu } from "./write-tools";

const NOW = new Date("2026-10-25T14:00:00+07:00");
const dataset = buildDemoSales(NOW);

function recordingPort() {
  const created: DraftRequest[] = [];

  const port: DraftPort = {
    create: async (request) => {
      created.push(request);

      return { draftId: `d${created.length}` };
    },
    confirmOpen: async () => ({ status: "done", message: "Sudah dicatat, Kak." }),
    cancelOpen: async () => ({ status: "done", message: "Oke Kak, dibatalkan." }),
    listSchedules: async () => [],
  };

  return { port, created };
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
