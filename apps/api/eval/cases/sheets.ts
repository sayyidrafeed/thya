import type { FakeSpreadsheet } from "../../src/agent/sheet-testing";
import { CONFIRM_TOOL, type EvalCaseInput } from "./schema";

// Business-features §6.3, S5 and S6. These need the harness to pass runTurn a `sheets` port
// built from sheetFixtures() (memorySheetPort + fakeGoogle); without it the tools are not offered
// (U10) and the cases fail. Capability until they pass two runs in a row (Q5).

const link = (id: string) => `https://docs.google.com/spreadsheets/d/${id}/edit#gid=0`;

const tab = (rows: (string | number)[][]) => ({ id: 0, title: "Sheet1", rows });

export const sheetFixtures = () =>
  new Map<string, FakeSpreadsheet>([
    [
      "laporan-eval",
      { title: "Laporan Kopi Senja", access: "editor", tabs: [tab([["Tanggal", "Omzet"]])] },
    ],
    ["private-eval", { title: "Rahasia", access: "none", tabs: [tab([])] }],
    [
      "penjualan-lama-eval",
      {
        title: "Penjualan Lama",
        access: "editor",
        tabs: [
          tab([
            ["Tanggal", "Menu", "Jumlah", "Harga"],
            ["2026-10-20", "Americano", 4, ""],
            ["2026-10-21", "Es Kopi Susu Gula Aren", 3, 18_000],
          ]),
        ],
      },
    ],
  ]);

export const sheetCases: EvalCaseInput[] = [
  {
    id: "sheet-append-two-days",
    refs: ["S5-AC3"],
    suite: "capability",
    category: "write_confirm",
    turns: [`${link("laporan-eval")} tambahin omzet dua hari terakhir ke sheet ini ya`],
    expect: {
      tools: [
        { name: "connectSheet", args: {} },
        { name: "appendDailySales", args: { metric: "revenue" } },
      ],
      drafted: 1,
      saved: 0,
      forbiddenTools: [CONFIRM_TOOL],
      mustMatch: [/\bya\b|konfirmasi|cek|benar|betul|setuju/i],
    },
  },
  {
    // The template is code's (S5-AC1); the grader only checks the owner got the share steps.
    id: "sheet-link-no-access",
    refs: ["S5-AC1"],
    suite: "capability",
    category: "write_confirm",
    turns: [`${link("private-eval")} tambahin omzet kemarin ke sheet ini`],
    expect: {
      drafted: 0,
      mustMatch: [/Bagikan/, /Editor/, /iam\.gserviceaccount\.com/],
    },
  },
  {
    id: "sheet-import-old-sales",
    refs: ["S6-AC1"],
    suite: "capability",
    category: "write_confirm",
    turns: [
      `ini sheet penjualan lama aku, masukin ke catatan Thya ya ${link("penjualan-lama-eval")}`,
    ],
    expect: {
      tools: [{ name: "importSalesFromSheet", args: {} }],
      drafted: 1,
      saved: 0,
      forbiddenTools: [CONFIRM_TOOL],
    },
  },
];
