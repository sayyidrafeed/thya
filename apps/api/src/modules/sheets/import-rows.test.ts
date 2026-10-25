import { describe, expect, test } from "bun:test";
import type { MenuItem, SaleRecord } from "../../sales/report";
import { MAX_IMPORT_ROWS, parseImportRows } from "./import-rows";
import { rowsSchema } from "./parse";

const menu: MenuItem[] = [
  { id: "kopi", name: "Es Kopi Susu", category: "kopi", price: 18_000, cost: 7_500 },
  { id: "pisang", name: "Pisang Goreng", category: "makanan", price: 12_000, cost: 4_000 },
];

const today = "2026-10-25";
const sheet = (rows: (string | number)[][]) => rowsSchema.parse(rows);
const header = ["Tanggal", "Menu", "Jumlah", "Harga"];

describe("parseImportRows", () => {
  test("reads valid rows with the sheet row number", () => {
    const result = parseImportRows(
      sheet([
        header,
        ["2026-10-23", "Es Kopi Susu", 12, 18_000],
        ["24/10/2026", "pisang  goreng", "3", ""],
      ]),
      menu,
      today,
    );

    expect(result).toEqual({
      status: "ok",
      rows: [
        {
          sourceRow: 2,
          date: "2026-10-23",
          itemId: "kopi",
          menuName: "Es Kopi Susu",
          quantity: 12,
          unitPrice: 18_000,
          unitCost: 7_500,
          priceDiffersFromMenu: false,
        },
        {
          sourceRow: 3,
          date: "2026-10-24",
          itemId: "pisang",
          menuName: "Pisang Goreng",
          quantity: 3,
          unitPrice: 12_000,
          unitCost: 4_000,
          priceDiffersFromMenu: false,
        },
      ],
      skipped: [],
      priceMismatchCount: 0,
    });
  });

  test("rows carry the SaleRecord fields, with cost from the menu", () => {
    const result = parseImportRows(
      sheet([header, ["2026-10-23", "Es Kopi Susu", 2, 15_000]]),
      menu,
      today,
    );

    const records: SaleRecord[] = result.status === "ok" ? result.rows : [];

    expect(records).toMatchObject([
      { date: "2026-10-23", itemId: "kopi", quantity: 2, unitPrice: 15_000, unitCost: 7_500 },
    ]);
  });

  test("works without a Harga column", () => {
    const result = parseImportRows(
      sheet([
        ["Tanggal", "Menu", "Jumlah"],
        ["23 Okt", "Es Kopi Susu", 2],
      ]),
      menu,
      today,
    );

    expect(result).toMatchObject({
      status: "ok",
      rows: [{ date: "2026-10-23", unitPrice: 18_000 }],
    });
  });

  test("keeps the sheet price and counts rows that differ from the menu", () => {
    const result = parseImportRows(
      sheet([
        header,
        ["2026-10-23", "Es Kopi Susu", 1, "Rp15.000"],
        ["2026-10-23", "Pisang Goreng", 1, 12_000],
      ]),
      menu,
      today,
    );

    expect(result).toMatchObject({
      status: "ok",
      rows: [
        { unitPrice: 15_000, priceDiffersFromMenu: true },
        { unitPrice: 12_000, unitCost: 4_000, priceDiffersFromMenu: false },
      ],
      priceMismatchCount: 1,
    });
  });

  test("skips invalid rows with a reason instead of failing the import", () => {
    const result = parseImportRows(
      sheet([
        header,
        ["2026-10-23", "Es Kopi Susu", 1, 18_000],
        ["kemarin", "Es Kopi Susu", 1, 18_000],
        ["2026-10-26", "Es Kopi Susu", 1, 18_000],
        ["2026-10-23", "Matcha Latte", 1, 20_000],
        ["2026-10-23", "Es Kopi Susu", 1.5, 18_000],
        ["2026-10-23", "Es Kopi Susu", 0, 18_000],
        ["2026-10-23", "Es Kopi Susu", "dua", 18_000],
        ["2026-10-23", "Es Kopi Susu", 1, "gratis"],
        ["", "", "", ""],
        ["2026-10-24", "Pisang Goreng", 4, 12_000],
      ]),
      menu,
      today,
    );

    expect(result).toMatchObject({
      status: "ok",
      rows: [{ sourceRow: 2 }, { sourceRow: 11 }],
      skipped: [
        { row: 3, reason: "tanggal tidak terbaca" },
        { row: 4, reason: "tanggal di masa depan" },
        { row: 5, reason: "menu tidak dikenal" },
        { row: 6, reason: "jumlah harus bilangan bulat lebih dari 0" },
        { row: 7, reason: "jumlah harus bilangan bulat lebih dari 0" },
        { row: 8, reason: "jumlah harus bilangan bulat lebih dari 0" },
        { row: 9, reason: "harga tidak terbaca" },
      ],
    });
  });

  test("uses the computed number of a formula cell", () => {
    // With UNFORMATTED_VALUE Google returns =6*2 as 12.
    const result = parseImportRows(
      sheet([header, ["2026-10-23", "Es Kopi Susu", 12, 18_000]]),
      menu,
      today,
    );

    expect(result).toMatchObject({ status: "ok", rows: [{ quantity: 12 }] });
  });

  test.each([
    ["an empty sheet", []],
    ["a header only sheet", [header]],
    ["a sheet with blank rows only", [header, ["", "", "", ""]]],
  ])("rejects %s", (_name, rows) => {
    expect(parseImportRows(sheet(rows), menu, today)).toEqual({
      status: "error",
      message: "Sheet-nya masih kosong, Kak.",
    });
  });

  test("rejects a sheet without the required columns", () => {
    expect(
      parseImportRows(
        sheet([
          ["Tanggal", "Produk terjual"],
          ["2026-10-23", 1],
        ]),
        menu,
        today,
      ),
    ).toMatchObject({
      status: "error",
      message: expect.stringContaining("Kolom Tanggal, Menu, dan Jumlah"),
    });
  });

  test(`rejects more than ${MAX_IMPORT_ROWS} rows`, () => {
    const rows = Array.from({ length: MAX_IMPORT_ROWS + 1 }, () => [
      "2026-10-23",
      "Es Kopi Susu",
      1,
      18_000,
    ]);

    expect(parseImportRows(sheet([header, ...rows]), menu, today)).toMatchObject({
      status: "error",
    });
  });
});
