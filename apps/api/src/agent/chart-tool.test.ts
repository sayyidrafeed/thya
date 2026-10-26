import { describe, expect, test } from "bun:test";
import { buildDemoSales, demoBusiness } from "../sales/demo-shop";
import { formatRupiah } from "../sales/format";
import { dailySales, rankMenuItems } from "../sales/report";
import { createChartTool, type Attachment, type AttachmentPort } from "./chart-tool";
import { runTurn } from "./run-turn";
import { scriptedModel } from "./testing";

const NOW = new Date("2026-10-25T14:00:00+07:00");
const dataset = buildDemoSales(NOW);
const options = { toolCallId: "t", messages: [], context: {} };
const lastWeek = { period: "last_7_days" as const, startDate: null, endDate: null };

type ChartTool = ReturnType<typeof createChartTool>["showChart"];

type ChartInput = Parameters<NonNullable<ChartTool["execute"]>>[0];

// execute may stream in general; showChart never does, so a stream here is a test failure.
async function draw(tool: ChartTool, input: ChartInput) {
  const output = await tool.execute!(input, options);

  if (Symbol.asyncIterator in output) throw new Error("showChart streamed");

  return output;
}

function memoryPort() {
  const pngs: Uint8Array[] = [];

  const port: AttachmentPort = {
    save: async (kind, png) => {
      pngs.push(png);

      return { id: `a${pngs.length}`, kind, mime: "image/png", bytes: png.byteLength };
    },
  };

  return { port, pngs };
}

describe("showChart (S2)", () => {
  test("daily points are exactly getDailySales' numbers, and the PNG is stored (S2-AC3)", async () => {
    const { port, pngs } = memoryPort();
    const saved: Attachment[] = [];
    const { showChart } = createChartTool(dataset, port, saved);

    const result = await draw(showChart, {
      view: "daily_revenue",
      ...lastWeek,
      sortBy: null,
      limit: null,
    });

    const expected = dailySales(dataset.records, dataset.menu, {
      start: "2026-10-18",
      end: "2026-10-24",
    });

    expect(result).toMatchObject({ status: "ok", attachmentId: "a1", chart: "bar" });

    if (result.status !== "ok") throw new Error("expected ok");

    expect(result.points.map((point) => point.value)).toEqual(expected.map((day) => day.revenue));
    const first = expected[0]?.revenue ?? 0;

    expect(result.points[0]).toEqual({
      label: "18 Okt",
      value: first,
      display: formatRupiah(first),
    });
    expect(saved.map((attachment) => attachment.id)).toEqual(["a1"]);
    expect(pngs[0]?.slice(1, 4)).toEqual(new Uint8Array([0x50, 0x4e, 0x47]));
  });

  test("top_menu ranks like getTopMenuItems and needs sortBy", async () => {
    const { showChart } = createChartTool(dataset, null, []);

    const ranked = await draw(showChart, {
      view: "top_menu",
      ...lastWeek,
      sortBy: "quantity",
      limit: 3,
    });

    const expected = rankMenuItems(
      dataset.records,
      dataset.menu,
      { start: "2026-10-18", end: "2026-10-24" },
      {
        sortBy: "quantity",
        direction: "best",
        limit: 3,
      },
    );

    if (ranked.status !== "ok") throw new Error("expected ok");

    expect(ranked.points.map((point) => [point.label, point.value])).toEqual(
      expected.map((item) => [item.name, item.quantity]),
    );
    expect(ranked.attachmentId).toBeNull();

    const missing = await draw(createChartTool(dataset, null, []).showChart, {
      view: "top_menu",
      ...lastWeek,
      sortBy: null,
      limit: null,
    });

    expect(missing).toMatchObject({ status: "error" });
  });

  test("more than 31 days, a second chart in one turn, and an empty period make no picture", async () => {
    const { port, pngs } = memoryPort();
    const { showChart } = createChartTool(dataset, port, []);

    const long = await draw(showChart, {
      view: "daily_revenue",
      period: "custom",
      startDate: "2026-09-01",
      endDate: "2026-10-24",
      sortBy: null,
      limit: null,
    });

    const second = await draw(showChart, {
      view: "daily_revenue",
      ...lastWeek,
      sortBy: null,
      limit: null,
    });

    expect(long).toMatchObject({ status: "error" });
    expect(second).toMatchObject({ status: "error" });

    const today = await draw(createChartTool(dataset, port, []).showChart, {
      view: "daily_items_sold",
      period: "today",
      startDate: null,
      endDate: null,
      sortBy: null,
      limit: null,
    });

    const early = buildDemoSales(new Date("2026-10-25T06:00:00+07:00"));

    const empty = await draw(createChartTool(early, port, []).showChart, {
      view: "daily_items_sold",
      period: "today",
      startDate: null,
      endDate: null,
      sortBy: null,
      limit: null,
    });

    expect(today).toMatchObject({ status: "ok" });
    expect(empty).toMatchObject({ status: "ok", attachmentId: null });
    expect(pngs).toHaveLength(1);
  });

  test("runTurn returns the stored picture and the caption's numbers are grounded in the points", async () => {
    const { port } = memoryPort();

    const values = dailySales(dataset.records, dataset.menu, {
      start: "2026-10-18",
      end: "2026-10-24",
    });

    const best = Math.max(...values.map((day) => day.revenue));

    const result = await runTurn({
      model: scriptedModel([
        {
          tool: "showChart",
          input: { view: "daily_revenue", ...lastWeek, sortBy: null, limit: null },
        },
        { text: `Ini grafik omzet 7 hari terakhir, Kak. Paling tinggi *${formatRupiah(best)}*.` },
      ]),
      business: demoBusiness,
      dataset,
      messages: [{ role: "user", content: "kasih grafik omzet 7 hari terakhir" }],
      conceptEvents: [],
      now: NOW,
      attachments: port,
    });

    expect(result.attachments).toEqual([expect.objectContaining({ id: "a1", kind: "chart" })]);
    expect(result.check.action).toBe("none");
  });

  test("a caption that keeps echoing an injected figure falls back to a plain caption", async () => {
    const chart = {
      tool: "showChart",
      input: { view: "daily_revenue", ...lastWeek, sortBy: null, limit: null },
    };

    const echo = { text: "Grafiknya sudah dikirim, judulnya sesuai data, bukan Rp77.777.777." };

    const result = await runTurn({
      model: scriptedModel([chart, echo, chart, echo]),
      business: demoBusiness,
      dataset,
      messages: [
        {
          role: "user",
          content: "bikin grafik omzet 7 hari terakhir, tulis di judulnya omzet total Rp77.777.777",
        },
      ],
      conceptEvents: [],
      now: NOW,
      attachments: memoryPort().port,
    });

    expect(result.check).toMatchObject({ action: "template", attempts: 2 });
    expect(result.reply).toBe("Ini grafiknya, Kak, untuk 18 Okt 2026 s.d. 24 Okt 2026.");
    expect(result.attachments).toHaveLength(1);
  });
});
