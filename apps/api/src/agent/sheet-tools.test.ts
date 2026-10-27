import { describe, expect, test } from "bun:test";
import type { DraftPort, DraftRequest } from "../actions/kinds";
import { accessInstructions, type SheetPort } from "../modules/sheets";
import {
  fakeGoogle,
  fakeSheetsAccess,
  memorySheetPort,
  type FakeSpreadsheet,
} from "./sheet-testing";
import { buildDemoSales, demoBusiness } from "../sales/demo-shop";
import { formatRupiah } from "../sales/format";
import { dailySales } from "../sales/report";
import { runTurn } from "./run-turn";
import { createSheetTools } from "./sheet-tools";
import { scriptedModel } from "./testing";

const NOW = new Date("2026-10-25T14:00:00+07:00");
const dataset = buildDemoSales(NOW);
const options = { toolCallId: "t", messages: [], context: {} };
const LINK = "https://docs.google.com/spreadsheets/d/laporan123/edit#gid=7";
const EMAIL = "thya-sheets@thya-test.iam.gserviceaccount.com";

function laporan(rows: (string | number)[][], access: FakeSpreadsheet["access"] = "editor") {
  return new Map<string, FakeSpreadsheet>([
    [
      "laporan123",
      {
        title: "Laporan Kopi Senja",
        access,
        tabs: [
          { id: 0, title: "Ringkasan", rows: [["Catatan"]] },
          { id: 7, title: "Harian", rows },
        ],
      },
    ],
  ]);
}

async function setup(spreadsheets: Map<string, FakeSpreadsheet>, imported: number[] = []) {
  const google = fakeGoogle(spreadsheets);
  const created: DraftRequest[] = [];
  let confirmed = 0;

  const { port, saved } = memorySheetPort(await fakeSheetsAccess(google.fetcher), {
    imported,
    costSince: new Map([["pisang-goreng", "2026-10-01"]]),
  });

  const drafts: DraftPort = {
    create: async (request) => {
      created.push(request);

      return { draftId: `d${created.length}` };
    },
    confirmOpen: async () => {
      confirmed++;

      return { status: "done", message: "Tersimpan." };
    },
    cancelOpen: async () => ({ status: "done", message: "Batal." }),
  };

  const sheet = createSheetTools(dataset, port, drafts);

  return { google, port, saved, created, sheet, confirmed: () => confirmed };
}

const twoDays = {
  period: "custom" as const,
  startDate: "2026-10-23",
  endDate: "2026-10-24",
  metric: "revenue" as const,
  dateColumn: null,
  valueColumn: null,
};

const revenueOn = (date: string) =>
  dailySales(dataset.records, dataset.menu, { start: date, end: date })[0]?.revenue ?? -1;

describe("connectSheet", () => {
  test("a sheet not shared with Thya gets the code's instructions with the exact email", async () => {
    const { sheet, saved } = await setup(laporan([], "none"));
    const result = await sheet.tools.connectSheet.execute!({ url: LINK }, options);

    expect(result).toEqual({
      status: "needs_access",
      serviceAccountEmail: EMAIL,
      message: accessInstructions(EMAIL),
    });
    expect(saved).toEqual([]);
  });

  test("a link that is not Google Sheets never reaches Google", async () => {
    const { sheet, google } = await setup(laporan([]));

    const result = await sheet.tools.connectSheet.execute!(
      { url: "https://example.com/spreadsheets/d/x" },
      options,
    );

    expect(result).toMatchObject({ status: "error" });
    expect(google.requests).toEqual([]);
  });

  test("a shared sheet is saved for this business on the tab from the link", async () => {
    const { sheet, saved } = await setup(laporan([["Tanggal", "Omzet"]]));
    const result = await sheet.tools.connectSheet.execute!({ url: LINK }, options);

    expect(result).toMatchObject({
      status: "ok",
      sheetTitle: "Laporan Kopi Senja",
      tab: "Harian",
      header: ["Tanggal", "Omzet"],
    });
    expect(saved).toEqual([
      {
        spreadsheetId: "laporan123",
        sheetTitle: "Laporan Kopi Senja",
        tabId: 7,
        tabTitle: "Harian",
        columnMap: {
          date: { index: 0, header: "Tanggal" },
          revenue: { index: 1, header: "Omzet" },
          itemsSold: null,
        },
      },
    ]);
  });

  test("after a sheet was read this turn, a typed ya confirms nothing (A14)", async () => {
    const { sheet, confirmed } = await setup(laporan([["Tanggal", "Omzet"]]));

    await sheet.tools.connectSheet.execute!({ url: LINK }, options);

    expect(await sheet.drafts?.confirmOpen()).toMatchObject({ status: "none" });
    expect(confirmed()).toBe(0);
  });

  test("a third call in one turn is refused without reaching Google", async () => {
    const { sheet, google } = await setup(laporan([["Tanggal", "Omzet"]]));

    await sheet.tools.connectSheet.execute!({ url: LINK }, options);
    await sheet.tools.connectSheet.execute!({ url: LINK }, options);
    const before = google.requests.length;
    const third = await sheet.tools.connectSheet.execute!({ url: LINK }, options);

    expect(third).toMatchObject({ status: "error" });
    expect(google.requests.length).toBe(before);
  });
});

describe("appendDailySales", () => {
  test("drafts the exact rows from dailySales and leaves the sheet untouched", async () => {
    const rows = [
      ["Tanggal", "Omzet"],
      ["2026-10-22", 1_000_000],
    ];

    const { sheet, created, google } = await setup(laporan(rows));

    await sheet.tools.connectSheet.execute!({ url: LINK }, options);
    const result = await sheet.tools.appendDailySales.execute!(twoDays, options);

    const [day23, day24] = [revenueOn("2026-10-23"), revenueOn("2026-10-24")];

    expect(result).toMatchObject({
      status: "draft",
      draftId: "d1",
      rows: [
        { date: "2026-10-23", value: day23, display: formatRupiah(day23) },
        { date: "2026-10-24", value: day24, display: formatRupiah(day24) },
      ],
    });
    expect(created[0]?.kind).toBe("sheet.append");
    expect(created[0]?.summary).toBe(
      [
        "Tambah 2 baris omzet ke sheet *Laporan Kopi Senja* (tab Harian), kolom Tanggal dan Omzet:",
        `- 2026-10-23: ${formatRupiah(day23)}`,
        `- 2026-10-24: ${formatRupiah(day24)}`,
      ].join("\n"),
    );
    expect(google.appends()).toBe(0);
    expect(rows).toHaveLength(2);
  });

  test("a date already in the sheet is skipped and named on the card", async () => {
    const { sheet, created } = await setup(
      laporan([
        ["Tanggal", "Omzet"],
        ["23 Okt", 5],
      ]),
    );

    await sheet.tools.connectSheet.execute!({ url: LINK }, options);
    const result = await sheet.tools.appendDailySales.execute!(twoDays, options);

    expect(result).toMatchObject({ status: "draft", skipped: ["2026-10-23"] });
    expect(created[0]?.summary).toContain("Tambah 1 baris omzet");
    expect(created[0]?.summary).toContain("Sudah ada di sheet, dilewati: 23 Okt.");
  });

  test("today is left out because the day is not over", async () => {
    const { sheet, created } = await setup(laporan([["Tanggal", "Omzet"]]));

    await sheet.tools.connectSheet.execute!({ url: LINK }, options);

    const today = await sheet.tools.appendDailySales.execute!(
      { ...twoDays, startDate: "2026-10-24", endDate: "2026-10-25" },
      options,
    );

    expect(today).toMatchObject({ status: "draft", rows: [{ date: "2026-10-24" }] });
    expect(created[0]?.summary).toContain("Hari ini belum selesai, jadi belum ditulis.");
  });

  test("unknown columns are asked back, then the owner's words pick them", async () => {
    const { sheet, created } = await setup(laporan([["Hari", "Pemasukan"]]));

    await sheet.tools.connectSheet.execute!({ url: LINK }, options);
    const unknown = await sheet.tools.appendDailySales.execute!(twoDays, options);

    expect(unknown).toMatchObject({ status: "error" });
    expect(JSON.stringify(unknown)).toContain("kolom yang ada: Hari, Pemasukan");
    expect(created).toEqual([]);

    const named = await sheet.tools.appendDailySales.execute!(
      { ...twoDays, dateColumn: "hari", valueColumn: "kolom B" },
      options,
    );

    expect(named).toMatchObject({ status: "draft" });
    expect(created[0]?.summary).toContain("kolom Hari dan Pemasukan:");
  });

  test("without a connected sheet nothing is read and no draft is made", async () => {
    const { sheet, created, google } = await setup(laporan([["Tanggal", "Omzet"]]));
    const result = await sheet.tools.appendDailySales.execute!(twoDays, options);

    expect(result).toMatchObject({ status: "error" });
    expect(created).toEqual([]);
    expect(google.requests).toEqual([]);
  });
});

describe("importSalesFromSheet", () => {
  const oldSales = [
    ["Tanggal", "Nama", "Terjual", "Harga"],
    ["2026-10-01", "Americano", 3, ""],
    ["2026-10-02", "es kopi susu gula aren", 2, 20_000],
    ["2026-09-30", "Pisang Goreng Madu", 1, ""],
    ["2026-10-03", "Nasi Goreng", 1, ""],
  ];

  test("asks which column is the menu, then previews with dedupe and skipped rows", async () => {
    const { sheet, created } = await setup(laporan(oldSales), [2]);

    await sheet.tools.connectSheet.execute!({ url: LINK }, options);

    const guessed = await sheet.tools.importSalesFromSheet.execute!(
      { dateColumn: null, menuColumn: null, quantityColumn: null, priceColumn: null },
      options,
    );

    expect(guessed).toMatchObject({ status: "error" });
    expect(JSON.stringify(guessed)).toContain("kolom yang ada: Tanggal, Nama, Terjual, Harga");

    const named = await sheet.tools.importSalesFromSheet.execute!(
      { dateColumn: null, menuColumn: "Nama", quantityColumn: null, priceColumn: null },
      options,
    );

    expect(named).toMatchObject({
      status: "draft",
      rowCount: 1,
      preview: [{ date: "2026-10-02", menu: "Es Kopi Susu Gula Aren", qty: 2, total: "Rp40.000" }],
      skipped: [
        { row: 4, reason: "modal menu belum tercatat di tanggal itu" },
        { row: 5, reason: "menu tidak dikenal" },
      ],
    });
    expect(created[0]).toMatchObject({
      kind: "sheet.import",
      args: {
        sourceSheetId: "laporan123#7",
        rows: [
          {
            sourceRow: 3,
            date: "2026-10-02",
            menuItemId: "es-kopi-susu-aren",
            quantity: 2,
            unitPrice: 20_000,
          },
        ],
      },
    });
    expect(created[0]?.summary).toContain("1 baris harganya beda dari daftar menu");
    expect(created[0]?.summary).toContain("1 baris sudah pernah diimport");
  });
});

describe("runTurn with sheets", () => {
  test("the share instructions are the code's text, not the model's retelling (S5-AC1)", async () => {
    const { port } = await setup(laporan([], "none"));

    const model = scriptedModel([
      { tool: "connectSheet", input: { url: LINK } },
      { text: "Bagikan ke thya@salah.com ya Kak." },
    ]);

    const result = await runTurn({
      model,
      business: demoBusiness,
      dataset,
      messages: [{ role: "user", content: `${LINK} tambahin omzet dua hari terakhir` }],
      conceptEvents: [],
      now: NOW,
      sheets: port,
    });

    expect(result.reply).toBe(accessInstructions(EMAIL));
    expect(result.check.action).toBe("template");
    expect(result.draft).toBeNull();
  });

  test("the sheet tools are offered only when the deployment has Google (U10)", async () => {
    const { port } = await setup(laporan([]));

    const offered = async (sheets: SheetPort | undefined) => {
      const model = scriptedModel([{ text: "Halo Kak." }]);

      await runTurn({
        model,
        business: demoBusiness,
        dataset,
        messages: [{ role: "user", content: "halo" }],
        conceptEvents: [],
        now: NOW,
        sheets,
      });

      return (model.doGenerateCalls[0]?.tools ?? []).map((tool) => tool.name);
    };

    expect(await offered(undefined)).not.toContain("connectSheet");
    expect(await offered(port)).toEqual(
      expect.arrayContaining(["connectSheet", "appendDailySales", "importSalesFromSheet"]),
    );
  });
});
