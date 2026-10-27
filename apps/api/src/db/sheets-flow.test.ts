import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { and, eq } from "drizzle-orm";
import { scriptedModel, type ScriptStep } from "../agent/testing";
import { createWhatsAppClient } from "../channels/whatsapp/client";
import type { WebhookMessage } from "../channels/whatsapp/inbound";
import { fakeGraph, textMessage } from "../channels/whatsapp/testing";
import { handleAgentTurn } from "../jobs/agent-turn";
import { createPhoneBusiness } from "../modules/business";
import { recordInbound } from "../modules/conversation";
import {
  accessInstructions,
  dbSheetPort,
  runSheetImport,
  sheetImportArgs,
  type SheetsAccess,
} from "../modules/sheets";
import { fakeGoogle, fakeSheetsAccess, type FakeSpreadsheet } from "../agent/sheet-testing";
import { demoBusiness } from "../sales/demo-shop";
import { loadSalesDataset, seedDemoSales } from "../sales/repository";
import { dailySales, summarizeSales } from "../sales/report";
import type { Db } from "./client";
import { drafts, sheetConnections, transactions } from "./schema";
import { freshTestDb, integration } from "./testing";

// Business-features S5/S6 end to end over WhatsApp: link → card → Ya → Google (in memory) or
// transactions, with the real drafts, executors and Sheets client.

const NOW = new Date("2026-10-25T14:00:00+07:00");
const OWNER = "6281200000005";
const OTHER = "6281200000006";
const config = { accessToken: "t", phoneNumberId: "PNID", graphVersion: "v23.0" };
const EMAIL = "thya-sheets@thya-test.iam.gserviceaccount.com";

const link = (id: string, gid = 0) =>
  `https://docs.google.com/spreadsheets/d/${id}/edit#gid=${gid}`;

const tab = (rows: (string | number)[][]) => ({ id: 0, title: "Sheet1", rows });

const spreadsheets = new Map<string, FakeSpreadsheet>([
  [
    "laporan",
    { title: "Laporan Kopi Senja", access: "editor", tabs: [tab([["Tanggal", "Omzet"]])] },
  ],
  ["private", { title: "Rahasia", access: "none", tabs: [tab([])] }],
  ["readonly", { title: "Laporan Lihat", access: "viewer", tabs: [tab([["Tanggal", "Omzet"]])] }],
  [
    "penjualan-lama",
    {
      title: "Penjualan Lama",
      access: "editor",
      tabs: [
        tab([
          ["Tanggal", "Menu", "Jumlah", "Harga"],
          ["2026-10-20", "Americano", 4, ""],
          ["2026-10-21", "Es Kopi Susu Gula Aren", 3, 20_000],
          ["2025-01-05", "Americano", 2, ""],
          ["2026-10-21", "Nasi Goreng", 1, ""],
        ]),
      ],
    },
  ],
]);

const appendTwoDays = (url: string): ScriptStep[] => [
  { tool: "connectSheet", input: { url } },
  {
    tool: "appendDailySales",
    input: {
      period: "custom",
      startDate: "2026-10-23",
      endDate: "2026-10-24",
      metric: "revenue",
      dateColumn: null,
      valueColumn: null,
    },
  },
  { text: "Cek dulu kartunya ya Kak." },
];

const importOld: ScriptStep[] = [
  { tool: "connectSheet", input: { url: link("penjualan-lama") } },
  {
    tool: "importSalesFromSheet",
    input: { dateColumn: null, menuColumn: null, quantityColumn: null, priceColumn: null },
  },
  { text: "Cek dulu kartunya ya Kak." },
];

const tap = (id: string, title: string, buttonId: string): WebhookMessage => ({
  from: OWNER,
  id,
  timestamp: String(NOW.getTime() / 1000),
  type: "interactive",
  interactive: { type: "button_reply", button_reply: { id: buttonId, title } },
});

describe.if(integration)("sheets over WhatsApp", () => {
  let db: Db;
  let businessId: string;
  let otherId: string;
  let access: SheetsAccess;
  const google = fakeGoogle(spreadsheets);
  let wamid = 0;
  let clock = NOW.getTime();
  const later = () => new Date((clock += 3 * 60_000));

  beforeAll(async () => {
    db = await freshTestDb();
    businessId = (await createPhoneBusiness(db, demoBusiness, OWNER)).id;
    otherId = (await createPhoneBusiness(db, { ...demoBusiness, name: "Warung Lain" }, OTHER)).id;
    await seedDemoSales(db, businessId, NOW);
    access = await fakeSheetsAccess(google.fetcher);
  }, 60_000);

  afterAll(async () => {
    await db.$client.end();
  });

  async function send(message: WebhookMessage, script: ScriptStep[] = []) {
    const at = later();
    const graph = fakeGraph();

    await recordInbound(db, [
      { wamid: message.id, phone: OWNER, type: message.type, payload: message, receivedAt: at },
    ]);

    await handleAgentTurn(
      {
        db,
        model: scriptedModel(script),
        delivery: {
          db,
          client: createWhatsAppClient(config, graph.fetcher),
          loadImage: async () => null,
        },
        now: () => at,
        paymentsImport: false,
        sheets: access,
      },
      OWNER,
    );

    return graph.sent();
  }

  const say = (text: string, script: ScriptStep[]) =>
    send(textMessage(`wamid.s${++wamid}`, text, OWNER), script);

  const press = (buttonId: string) => send(tap(`wamid.b${++wamid}`, "Ya", buttonId));

  const yesButton = (sent: Awaited<ReturnType<typeof send>>) =>
    sent.find((body) => body.type === "interactive")?.interactive.action.buttons[0].reply.id ?? "";

  const sheetRows = (id: string) => spreadsheets.get(id)?.tabs[0]?.rows ?? [];

  test("a sheet not shared with Thya gets the code's share instructions and no card", async () => {
    const sent = await say(
      `${link("private")} tambahin omzet dua hari terakhir`,
      appendTwoDays(link("private")),
    );

    expect(sent.map((body) => body.text?.body)).toEqual([accessInstructions(EMAIL)]);
    expect(await db.$count(drafts, eq(drafts.businessId, businessId))).toBe(0);
  });

  test("two days of revenue are written only after Ya, once, even when Google fails mid-write", async () => {
    const dataset = await loadSalesDataset(db, businessId, NOW);

    const expected = dailySales(dataset.records, dataset.menu, {
      start: "2026-10-23",
      end: "2026-10-24",
    }).map((day) => [day.date, day.revenue]);

    const sent = await say(
      `${link("laporan")} tambahin omzet dua hari terakhir`,
      appendTwoDays(link("laporan")),
    );

    const card = sent.find((body) => body.type === "interactive")?.interactive.body.text;

    expect(card).toContain("Tambah 2 baris omzet ke sheet *Laporan Kopi Senja* (tab Sheet1)");
    expect(sheetRows("laporan")).toEqual([["Tanggal", "Omzet"]]);

    // The append lands but Google answers 503; the retry re-reads the dates and writes nothing.
    google.landThenFail();
    const done = await press(yesButton(sent));

    expect(done[0]?.text.body).toContain(
      "Sudah ditambahkan ke sheet *Laporan Kopi Senja*, Kak: 2 baris",
    );
    expect(sheetRows("laporan")).toEqual([["Tanggal", "Omzet"], ...expected]);

    const again = await press(yesButton(sent));

    expect(again[0]?.text.body).toContain("tidak menyimpannya dua kali");
    expect(sheetRows("laporan")).toHaveLength(3);
  });

  test("the connection belongs to this business only (S5-AC6)", async () => {
    expect(await dbSheetPort(db, businessId, access).activeConnection()).toMatchObject({
      spreadsheetId: "laporan",
    });
    expect(await dbSheetPort(db, otherId, access).activeConnection()).toBeNull();
  });

  test("a sheet shared as Viewer fails on Ya, says so, and marks the connection broken", async () => {
    const sent = await say(
      `${link("readonly")} tambahin omzet dua hari terakhir`,
      appendTwoDays(link("readonly")),
    );

    const done = await press(yesButton(sent));

    expect(done[0]?.text.body).toContain(`dibagikan ke ${EMAIL} sebagai *Editor*`);
    expect(sheetRows("readonly")).toHaveLength(1);
    expect(await db.$count(drafts, eq(drafts.status, "failed"))).toBe(1);
    expect(
      await db.$count(
        sheetConnections,
        and(eq(sheetConnections.businessId, businessId), eq(sheetConnections.status, "broken")),
      ),
    ).toBe(1);
  });

  test("old sales are imported after Ya and a second import adds nothing (S6-AC1, AC2)", async () => {
    const range = { start: "2026-10-20", end: "2026-10-21" };
    const before = await loadSalesDataset(db, businessId, NOW);

    const sent = await say(
      `${link("penjualan-lama")} masukin penjualan lama dari sheet ini`,
      importOld,
    );

    const card = sent.find((body) => body.type === "interactive")?.interactive.body.text;

    expect(card).toContain("2 baris, 20 Okt 2026 s.d. 21 Okt 2026, total Rp120.000.");
    expect(card).toContain(
      "2 baris dilewati: baris 4 (modal menu belum tercatat di tanggal itu), baris 5 (menu tidak dikenal).",
    );

    const sheetSales = () =>
      db.$count(
        transactions,
        and(eq(transactions.businessId, businessId), eq(transactions.source, "sheet")),
      );

    expect(await sheetSales()).toBe(0);

    const done = await press(yesButton(sent));

    expect(done[0]?.text.body).toBe(
      "Sudah diimport, Kak: 2 baris penjualan dari sheet *Penjualan Lama*.",
    );
    expect(await sheetSales()).toBe(2);

    const after = await loadSalesDataset(db, businessId, NOW);

    expect(summarizeSales(after.records, after.menu, range).revenue).toBe(
      summarizeSales(before.records, before.menu, range).revenue + 4 * 15_000 + 3 * 20_000,
    );

    // The executor run again on the same stored rows is a no-op through the unique index.
    const [stored] = await db.select().from(drafts).where(eq(drafts.kind, "sheet.import"));

    const rerun = await runSheetImport(db, {
      businessId,
      draftId: stored?.id ?? "",
      args: sheetImportArgs.parse(stored?.args),
    });

    expect(rerun).toBe("Sudah diimport, Kak: 0 baris baru, 2 sudah ada sebelumnya.");
    expect(await sheetSales()).toBe(2);

    // Asked again later, the card is never made: every row is already in.
    const twice = await say("import lagi dong", importOld);

    expect(twice.some((body) => body.type === "interactive")).toBe(false);
    expect(await sheetSales()).toBe(2);
  });
});
