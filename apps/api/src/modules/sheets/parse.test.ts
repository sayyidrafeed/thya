import { describe, expect, test } from "bun:test";
import {
  columnLetter,
  columnMapSchema,
  columnRange,
  guessColumnMap,
  parseSheetDate,
  parseSheetLink,
  rowsSchema,
} from "./parse";

const cells = (...values: (string | number | boolean)[]) => rowsSchema.parse([values])[0] ?? [];
const cell = (value: string | number) => cells(value)[0] ?? { text: "", number: null };

describe("parseSheetLink", () => {
  test("reads the spreadsheet id and gid from a shared link", () => {
    expect(
      parseSheetLink("https://docs.google.com/spreadsheets/d/1AbC-d_9/edit?usp=sharing#gid=123"),
    ).toEqual({ spreadsheetId: "1AbC-d_9", gid: 123 });
  });

  test("accepts a link without scheme or gid", () => {
    expect(parseSheetLink("docs.google.com/spreadsheets/d/abc123/edit")).toEqual({
      spreadsheetId: "abc123",
      gid: null,
    });
  });

  test("reads gid from the query string too", () => {
    expect(parseSheetLink("https://docs.google.com/spreadsheets/d/abc/edit?gid=7")?.gid).toBe(7);
  });

  test.each([
    "https://docs.google.com/document/d/abc/edit",
    "https://drive.google.com/drive/folders/abc",
    "https://evil.example/spreadsheets/d/abc",
    "https://docs.google.com.evil.example/spreadsheets/d/abc",
    "http://169.254.169.254/latest/meta-data",
    "bukan link",
  ])("rejects %s", (url) => {
    expect(parseSheetLink(url)).toBeNull();
  });
});

describe("parseSheetDate", () => {
  const today = "2026-10-25";

  test.each([
    ["2026-10-23", "2026-10-23"],
    ["23/10/2026", "2026-10-23"],
    ["3/1/2026", "2026-01-03"],
    ["23 Okt", "2026-10-23"],
    ["23 oktober", "2026-10-23"],
    ["5 Agt 2025", "2025-08-05"],
    ["1 Mei", "2026-05-01"],
  ])("reads %s", (text, expected) => {
    expect(parseSheetDate(cell(text), today)).toBe(expected);
  });

  test("puts a yearless date that would be in the future into last year", () => {
    expect(parseSheetDate(cell("30 Des"), today)).toBe("2025-12-30");
  });

  test.each(["31/02/2026", "2026-13-01", "23 Okto", "Okt 23", "10/23/2026", "", "Total"])(
    "treats %s as not a date",
    (text) => {
      expect(parseSheetDate(cell(text), today)).toBeNull();
    },
  );

  test("treats numbers as not a date", () => {
    expect(parseSheetDate(cell(46_000), today)).toBeNull();
  });
});

describe("guessColumnMap", () => {
  test("finds date, revenue and items sold columns", () => {
    expect(guessColumnMap(cells("No", "Tanggal", "Omzet (Rp)", "Cup terjual"))).toEqual({
      date: { index: 1, header: "Tanggal" },
      revenue: { index: 2, header: "Omzet (Rp)" },
      itemsSold: { index: 3, header: "Cup terjual" },
    });
  });

  test("recognises Tgl and Penjualan", () => {
    const map = guessColumnMap(cells("Tgl", "Penjualan"));

    expect([map?.date.index, map?.revenue?.index, map?.itemsSold]).toEqual([0, 1, null]);
  });

  test("round-trips through the jsonb schema", () => {
    const map = guessColumnMap(cells("Tanggal", "Omzet"));

    expect(columnMapSchema.parse(JSON.parse(JSON.stringify(map)))).toEqual({
      date: { index: 0, header: "Tanggal" },
      revenue: { index: 1, header: "Omzet" },
      itemsSold: null,
    });
    expect(columnMapSchema.safeParse({ date: { index: -1, header: "x" } }).success).toBe(false);
  });

  test("returns null without a date column", () => {
    expect(guessColumnMap(cells("Menu", "Omzet"))).toBeNull();
  });
});

describe("A1 helpers", () => {
  test("turns column indexes into letters", () => {
    expect([0, 25, 26, 51, 52, 701, 702].map(columnLetter)).toEqual([
      "A",
      "Z",
      "AA",
      "AZ",
      "BA",
      "ZZ",
      "AAA",
    ]);
  });

  test("quotes tab titles with spaces and apostrophes", () => {
    expect(columnRange("Laporan Jum'at", 2)).toBe("'Laporan Jum''at'!C:C");
  });
});
