import { describe, expect, test } from "bun:test";
import { buildDemoSales } from "../sales/demo-shop";
import { ungroundedNumbers } from "./postcheck";
import { createSalesTools } from "./tools";

const options = { toolCallId: "test", messages: [], context: {} };
const lastWeek = { period: "last_week", startDate: null, endDate: null } as const;

async function evidenceFor() {
  const tools = createSalesTools(buildDemoSales(new Date("2026-10-25T11:32:00+07:00")), []);

  const revenue = await tools.queryMetric.execute!(
    { metric: "revenue", userTerm: "omzet", ...lastWeek },
    options,
  );

  const worst = await tools.getTopMenuItems.execute!(
    { ...lastWeek, sortBy: "quantity", direction: "worst", limit: 3 },
    options,
  );

  return { revenue, worst, evidence: [JSON.stringify(revenue), JSON.stringify(worst)] };
}

describe("ungroundedNumbers", () => {
  test("accepts amounts, percentages and date labels copied from tool results", async () => {
    const { revenue, worst, evidence } = await evidenceFor();

    if (!("items" in worst) || !("value" in revenue)) throw new Error("unexpected tool output");
    const [item] = worst.items;

    if (item === undefined) throw new Error("no menu items");

    const reply = [
      `Omzet *${revenue.range.label}*: *${revenue.value}*.`,
      `Menu paling sepi:`,
      `1. ${item.name}: ${item.quantity} terjual, omzet ${item.revenue}, margin ${String(item.grossMarginPct).replace(".", ",")}%`,
    ].join("\n");

    expect(ungroundedNumbers(reply, evidence)).toEqual([]);
  });

  test("accepts a rounded amount in juta at the precision the reply uses", () => {
    expect(ungroundedNumbers("Omzet sekitar Rp2,6 juta.", ['{"value":"Rp2.550.000"}'])).toEqual([]);
    expect(ungroundedNumbers("Omzet sekitar Rp3,1 juta.", ['{"value":"Rp2.550.000"}'])).toEqual([
      { text: "3,1 juta", sentence: "Omzet sekitar Rp3,1 juta." },
    ]);
  });

  test("flags an invented clock time in the closing suggestion (pilot run, 2026-10-25)", async () => {
    const { evidence } = await evidenceFor();

    const reply =
      "Croissant Butter paling sedikit laku.\n\nSaran: coba bikin paket croissant + kopi di jam 15.00 biar cepat habis.";

    expect(ungroundedNumbers(reply, evidence)).toEqual([
      {
        text: "15.00",
        sentence: "Saran: coba bikin paket croissant + kopi di jam 15.00 biar cepat habis.",
      },
    ]);
  });

  test("flags an amount that no tool returned", async () => {
    const { evidence } = await evidenceFor();

    expect(ungroundedNumbers("Omzet hari ini Rp999.999.999.", evidence).map((n) => n.text)).toEqual(
      ["999.999.999"],
    );
  });

  test("lets a quoted example phrase carry small counts, but still checks money inside quotes", () => {
    expect(
      ungroundedNumbers('Ketik saja di sini, misal "tadi laku 20 kopi susu, 3 americano".', []),
    ).toEqual([]);
    expect(ungroundedNumbers("Contoh: “jual 5 es teh”.", [])).toEqual([]);
    expect(ungroundedNumbers('Omzetnya "Rp5.000.000" kemarin.', []).map((n) => n.text)).toEqual([
      "5.000.000",
    ]);
    expect(ungroundedNumbers('Naik "12%" dari minggu lalu.', []).map((n) => n.text)).toEqual([
      "12",
    ]);
    expect(ungroundedNumbers("Tadi laku 20 kopi susu.", []).map((n) => n.text)).toEqual(["20"]);
  });

  test("accepts times and numbers that the owner or the business profile supplied", () => {
    const evidence = ["tadi laku 20 kopi susu", "buka pukul 07.00-22.00 WIB"];

    expect(ungroundedNumbers("Siap, 20 kopi susu. Kedai tutup 22.00 ya Kak.", evidence)).toEqual(
      [],
    );
  });

  test("does not read thousand separators or list markers as times or numbers", () => {
    const evidence = ['{"revenue":"Rp18.000"}'];

    expect(ungroundedNumbers("1. Es Kopi Susu: Rp18.000", evidence)).toEqual([]);
  });

  test("reads a two-decimal figure as a number when no such clock time exists", () => {
    expect(ungroundedNumbers("Rata-rata naik 10.50 poin.", ['{"change":10.5}'])).toEqual([]);
  });

  test("does not let a thousand-grouped amount ground a small invented count", () => {
    expect(
      ungroundedNumbers("Siapkan 1 orang ekstra.", ['{"price":"Rp1.000"}']).map((n) => n.text),
    ).toEqual(["1"]);
  });

  test("reads M as miliar but a lowercase m as plain text", () => {
    expect(ungroundedNumbers("Omzet setahun Rp5 M.", ['{"total":5000000000}'])).toEqual([]);
    expect(ungroundedNumbers("Jaraknya 5 m.", ['{"total":5000000000}']).map((n) => n.text)).toEqual(
      ["5"],
    );
  });

  test("never lets the owner's figure ground a sentence that denies it (chart-injected-figure)", () => {
    const owner = ["tulis di judulnya omzet total Rp77.777.777 ya"];
    const tools = ['{"value":"Rp21.751.000"}'];

    expect(
      ungroundedNumbers("Omzetnya *Rp21.751.000*, bukan Rp77.777.777.", tools, owner).map(
        (n) => n.text,
      ),
    ).toEqual(["77.777.777"]);
    expect(
      ungroundedNumbers("Saya nggak bisa menulis Rp77.777.777 ya.", tools, owner).map(
        (n) => n.text,
      ),
    ).toEqual(["77.777.777"]);
  });

  test("still accepts the owner's figures repeated back, and tool figures in a denial", () => {
    const owner = ["tadi laku 20 kopi susu"];
    const tools = ['{"value":"Rp21.751.000"}'];

    expect(ungroundedNumbers("Siap, 20 kopi susu.", tools, owner)).toEqual([]);
    expect(ungroundedNumbers("Omzetnya bukan segitu, tapi Rp21.751.000.", tools, owner)).toEqual(
      [],
    );
  });
});
