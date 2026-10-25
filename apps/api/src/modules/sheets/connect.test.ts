import { describe, expect, test } from "bun:test";
import { accessInstructions, connectSheet, executeSheetAppend, type AppendTarget } from "./connect";
import type { SheetsClient, SheetsFailure } from "./google";
import { rowsSchema, type WriteCell } from "./parse";

type FakeTab = { id: number; title: string; rows: WriteCell[][] };

// In-memory Google Sheets: enough of the API to read ranges and append rows.
function fakeSheets(tabs: FakeTab[], access: "editor" | "viewer" | "none" = "editor") {
  const failures: SheetsFailure[] = [];
  let appendCalls = 0;
  const failNext = (reason: SheetsFailure) => failures.push(reason);

  const tabFor = (range: string) => {
    const title = /^'(.+)'!/.exec(range)?.[1]?.replaceAll("''", "'");

    return tabs.find((tab) => tab.title === title);
  };

  const injected = () => {
    const reason = failures.shift();

    return reason === undefined ? null : { status: "error" as const, reason };
  };

  const client: SheetsClient = {
    async getSpreadsheet() {
      const failure = injected();

      if (failure) return failure;

      if (access === "none") return { status: "error", reason: "no_access" };

      return {
        status: "ok",
        value: { title: "Laporan Kopi Senja", tabs: tabs.map(({ id, title }) => ({ id, title })) },
      };
    },

    async getValues(_id, range) {
      const failure = injected();
      const tab = tabFor(range);

      if (failure) return failure;

      if (access === "none" || tab === undefined) return { status: "error", reason: "no_access" };

      const column = /!([A-Z]):[A-Z]$/.exec(range)?.[1];
      const rows = range.endsWith("!1:1") ? tab.rows.slice(0, 1) : tab.rows;
      const index = column === undefined ? null : column.codePointAt(0)! - 65;
      const picked = index === null ? rows : rows.map((row) => [row[index] ?? ""]);

      return { status: "ok", value: rowsSchema.parse(picked) };
    },

    async appendRows(_id, range, rows) {
      appendCalls++;
      const failure = injected();
      const tab = tabFor(range);

      if (failure) return failure;

      if (access !== "editor" || tab === undefined) return { status: "error", reason: "no_access" };

      tab.rows.push(...rows);

      return { status: "ok", value: { updatedRows: rows.length } };
    },
  };

  return { client, failNext, appendCalls: () => appendCalls };
}

const noSleep = async () => {};
const email = "thya-sheets@thya-demo.iam.gserviceaccount.com";
const link = "https://docs.google.com/spreadsheets/d/sheet123/edit#gid=5";

describe("connectSheet", () => {
  test("rejects a non-Sheets link without calling Google", async () => {
    const sheets = fakeSheets([]);
    sheets.failNext("unavailable");

    const result = await connectSheet("https://docs.google.com/document/d/x", sheets.client, email);

    expect(result).toMatchObject({
      status: "error",
      message: expect.stringContaining("bukan link Google Sheets"),
    });
    // The injected failure is still queued, so no request was made.
    expect(await sheets.client.getSpreadsheet("x")).toEqual({
      status: "error",
      reason: "unavailable",
    });
  });

  test("answers an unshared sheet with the code template and the exact service account email", async () => {
    const result = await connectSheet(link, fakeSheets([], "none").client, email);

    expect(result).toEqual({
      status: "needs_access",
      serviceAccountEmail: email,
      message: accessInstructions(email),
    });
    expect(accessInstructions(email)).toContain(`tempel email ${email}, pilih *Editor*`);
  });

  test("picks the tab from gid and guesses the columns", async () => {
    const tabs = [
      { id: 0, title: "September", rows: [["Tanggal", "Omzet"]] },
      {
        id: 5,
        title: "Oktober",
        rows: [
          ["No", "Tgl", "Penjualan", "Cup terjual"],
          [1, "23 Okt", 3_260_000, 120],
        ],
      },
    ];

    const result = await connectSheet(link, fakeSheets(tabs).client, email, noSleep);

    expect(result).toEqual({
      status: "ok",
      spreadsheetId: "sheet123",
      sheetTitle: "Laporan Kopi Senja",
      tab: { id: 5, title: "Oktober" },
      tabs: ["September", "Oktober"],
      header: ["No", "Tgl", "Penjualan", "Cup terjual"],
      columnMap: {
        date: { index: 1, header: "Tgl" },
        revenue: { index: 2, header: "Penjualan" },
        itemsSold: { index: 3, header: "Cup terjual" },
      },
    });
  });

  test("falls back to the first tab without a matching gid and reports a missing date column", async () => {
    const tabs = [{ id: 0, title: "Sheet1", rows: [["Menu", "Harga"]] }];

    const result = await connectSheet(
      "https://docs.google.com/spreadsheets/d/sheet123/edit",
      fakeSheets(tabs).client,
      email,
    );

    expect(result).toMatchObject({ status: "ok", tab: { title: "Sheet1" }, columnMap: null });
  });

  test("retries a rate limit and then succeeds", async () => {
    const sheets = fakeSheets([{ id: 0, title: "S", rows: [["Tanggal"]] }]);
    const waits: number[] = [];
    sheets.failNext("rate_limited");

    const result = await connectSheet(link, sheets.client, email, async (ms) => {
      waits.push(ms);
    });

    expect(result.status).toBe("ok");
    expect(waits).toEqual([1_000]);
  });
});

describe("executeSheetAppend", () => {
  const today = "2026-10-25";

  const values = [
    { date: "2026-10-23", value: 3_260_000 },
    { date: "2026-10-24", value: 4_100_000 },
  ];

  const sheetWith = (rows: WriteCell[][], access: "editor" | "viewer" = "editor") => {
    const tab = { id: 0, title: "Laporan Okt", rows };

    const target: AppendTarget = {
      spreadsheetId: "sheet123",
      tabTitle: tab.title,
      metric: "revenue",
      columnMap: {
        date: { index: 0, header: "Tanggal" },
        revenue: { index: 2, header: "Omzet" },
        itemsSold: null,
      },
    };

    return { tab, target, ...fakeSheets([tab], access) };
  };

  test("appends one row per day in the mapped columns", async () => {
    const { tab, target, client } = sheetWith([
      ["Tanggal", "Catatan", "Omzet"],
      ["22/10/2026", "", 2_900_000],
    ]);

    const outcome = await executeSheetAppend(client, target, values, today, noSleep);

    expect(outcome).toEqual({ status: "done", written: ["2026-10-23", "2026-10-24"], skipped: [] });
    expect(tab.rows.slice(2)).toEqual([
      ["2026-10-23", "", 3_260_000],
      ["2026-10-24", "", 4_100_000],
    ]);
  });

  test("running the executor twice adds the rows only once", async () => {
    const { tab, target, client } = sheetWith([["Tanggal", "Catatan", "Omzet"]]);

    await executeSheetAppend(client, target, values, today, noSleep);
    const second = await executeSheetAppend(client, target, values, today, noSleep);

    expect(second).toEqual({ status: "done", written: [], skipped: ["2026-10-23", "2026-10-24"] });
    expect(tab.rows).toHaveLength(3);
  });

  test("skips dates the owner already wrote in another format", async () => {
    const { tab, target, client } = sheetWith([
      ["Tanggal", "Catatan", "Omzet"],
      ["23 Okt", "", 3_000_000],
    ]);

    const outcome = await executeSheetAppend(client, target, values, today, noSleep);

    expect(outcome).toEqual({ status: "done", written: ["2026-10-24"], skipped: ["2026-10-23"] });
    expect(tab.rows).toHaveLength(3);
  });

  test("retries a 5xx on append after re-reading the dates", async () => {
    const { tab, target, client, failNext, appendCalls } = sheetWith([
      ["Tanggal", "Catatan", "Omzet"],
    ]);

    failNext("unavailable");

    const outcome = await executeSheetAppend(client, target, values, today, noSleep);

    expect(outcome).toMatchObject({ status: "done", written: ["2026-10-23", "2026-10-24"] });
    expect(tab.rows).toHaveLength(3);
    expect(appendCalls()).toBe(1);
  });

  test("gives up after three failed attempts", async () => {
    const { target, client, failNext } = sheetWith([["Tanggal", "Catatan", "Omzet"]]);
    failNext("unavailable");
    failNext("unavailable");
    failNext("unavailable");

    const outcome = await executeSheetAppend(client, target, values, today, noSleep);

    expect(outcome).toMatchObject({ status: "failed", reason: "unavailable" });
  });

  test("asks for Editor access when the sheet is shared as Viewer", async () => {
    const { tab, target, client } = sheetWith([["Tanggal", "Catatan", "Omzet"]], "viewer");

    const outcome = await executeSheetAppend(client, target, values, today, noSleep);

    expect(outcome).toMatchObject({
      status: "failed",
      reason: "no_access",
      message: expect.stringContaining("Editor"),
    });
    expect(tab.rows).toHaveLength(1);
  });

  test("fails without writing when the metric has no column", async () => {
    const { tab, target, client } = sheetWith([["Tanggal"]]);

    const outcome = await executeSheetAppend(
      client,
      { ...target, metric: "items_sold" },
      values,
      today,
      noSleep,
    );

    expect(outcome).toMatchObject({ status: "failed", reason: "no_value_column" });
    expect(tab.rows).toHaveLength(1);
  });
});
