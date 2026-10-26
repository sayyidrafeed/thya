import { describe, expect, test } from "bun:test";
import { MockLanguageModelV4 } from "ai/test";
import { z } from "zod";
import { buildDemoSales, demoBusiness } from "../sales/demo-shop";
import { runTurn, type TurnInput } from "./run-turn";
import { scriptedModel } from "./testing";
import { createSalesTools } from "./tools";

type MockResult = Exclude<
  ConstructorParameters<typeof MockLanguageModelV4>[0],
  undefined
>["doGenerate"];

const NOW = new Date("2026-10-25T14:00:00+07:00");
const dataset = buildDemoSales(NOW);

const lastWeek = {
  metric: "revenue",
  userTerm: "omzet",
  period: "last_week",
  startDate: null,
  endDate: null,
};

const usage = {
  inputTokens: { total: 10, noCache: 10, cacheRead: 0, cacheWrite: 0 },
  outputTokens: { total: 5, text: 5, reasoning: 0 },
};

function toolCall(id: string, input: typeof lastWeek) {
  return {
    content: [
      {
        type: "tool-call" as const,
        toolCallId: id,
        toolName: "queryMetric",
        input: JSON.stringify(input),
      },
    ],
    finishReason: { unified: "tool-calls" as const, raw: "tool_calls" },
    usage,
    warnings: [],
  };
}

function text(reply: string) {
  return {
    content: [{ type: "text" as const, text: reply }],
    finishReason: { unified: "stop" as const, raw: "stop" },
    usage,
    warnings: [],
  };
}

async function lastWeekRevenue(): Promise<string> {
  const { queryMetric } = createSalesTools(dataset, []);

  const output = await queryMetric.execute!(
    { ...lastWeek, metric: "revenue", period: "last_week" },
    { toolCallId: "t", messages: [], context: {} },
  );

  if (!("status" in output) || output.status !== "ok" || output.value === null)
    throw new Error("seed has no revenue for last week");

  return output.value;
}

function turn(model: MockLanguageModelV4, owner = "omzet minggu lalu berapa?"): TurnInput {
  return {
    model,
    business: demoBusiness,
    dataset,
    messages: [{ role: "user", content: owner }],
    conceptEvents: [],
    now: NOW,
  };
}

const mock = (results: MockResult) => new MockLanguageModelV4({ doGenerate: results });

describe("runTurn", () => {
  test("sends a grounded answer as is and keeps the clock out of the stored history", async () => {
    const value = await lastWeekRevenue();
    const model = mock([toolCall("c1", lastWeek), text(`Omzet minggu lalu *${value}*.`)]);

    const result = await runTurn(turn(model));
    const [firstCall] = model.doGenerateCalls;
    const sent = JSON.stringify(firstCall?.prompt);

    expect(result.reply).toBe(`Omzet minggu lalu *${value}*.`);
    expect(result.check.action).toBe("none");
    expect(sent).toContain("Konteks dari sistem: sekarang Minggu, 25 Okt 2026, pukul 14.00 WIB.");
    expect(JSON.stringify(firstCall?.prompt.find((m) => m.role === "system"))).not.toContain(
      "14.00",
    );
    expect(JSON.stringify(result.responseMessages)).not.toContain("Konteks dari sistem");
    expect(result.responseMessages.at(-1)).toEqual({ role: "assistant", content: result.reply });
  });

  test("drops a closing suggestion that carries a made-up number (Q2a)", async () => {
    const value = await lastWeekRevenue();

    const model = mock([
      toolCall("c1", lastWeek),
      text(`Omzet minggu lalu *${value}*.\n\nSaran: tambah 2 barista di hari Sabtu.`),
    ]);

    const result = await runTurn(turn(model));

    expect(result.reply).toBe(`Omzet minggu lalu *${value}*.`);
    expect(result.check).toMatchObject({ action: "dropped", attempts: 1 });
    expect(result.check.ungrounded.map((n) => n.text)).toEqual(["2"]);
  });

  test("regenerates once with model-only feedback when the main answer is made up (Q2b)", async () => {
    const value = await lastWeekRevenue();

    const model = mock([
      toolCall("c1", lastWeek),
      text("Omzet minggu lalu *Rp9.999.000*."),
      toolCall("c2", lastWeek),
      text(`Omzet minggu lalu *${value}*.`),
    ]);

    const result = await runTurn(turn(model));
    const retry = JSON.stringify(model.doGenerateCalls[2]?.prompt.find((m) => m.role === "system"));

    expect(result.reply).toBe(`Omzet minggu lalu *${value}*.`);
    expect(result.check).toMatchObject({ action: "regenerated", attempts: 2 });
    expect(retry).toContain("tidak ada di hasil tool (9.999.000)");
    expect(result.reply).not.toContain("hasil tool");
  });

  test("falls back to a code-written answer from the tool result when both tries make numbers up", async () => {
    const value = await lastWeekRevenue();

    const model = mock([
      toolCall("c1", lastWeek),
      text("Omzet minggu lalu *Rp9.999.000*."),
      toolCall("c2", lastWeek),
      text("Omzet minggu lalu *Rp8.888.000*."),
    ]);

    const result = await runTurn(turn(model));

    expect(result.check).toMatchObject({ action: "template", attempts: 2 });
    expect(result.reply).toStartWith("Omzet ");
    expect(result.reply).toContain(value);
    expect(result.reply).not.toContain("9.999.000");
  });

  test("forces a tool on the retry and apologises when no tool ever ran (Q2c)", async () => {
    const model = mock([
      text("Omzet minggu lalu Rp5.000.000."),
      text("Omzet minggu lalu Rp4.000.000."),
    ]);

    const result = await runTurn(turn(model));

    expect(model.doGenerateCalls[1]?.toolChoice).toEqual({ type: "required" });
    expect(result.check).toMatchObject({ action: "apology", attempts: 2 });
    expect(result.reply).toStartWith("Maaf Kak, angkanya belum bisa Thya ambil sekarang.");
  });

  test("stops running queryMetric after three rounds (Q7, U9)", async () => {
    const model = mock([
      toolCall("c1", lastWeek),
      toolCall("c2", lastWeek),
      toolCall("c3", lastWeek),
      toolCall("c4", lastWeek),
      toolCall("c5", lastWeek),
    ]);

    const result = await runTurn(turn(model));

    const outputs = result.toolCalls.map(
      (call) => z.object({ status: z.string() }).parse(call.output).status,
    );

    expect(outputs).toEqual(["ok", "ok", "ok", "error", "error"]);
    expect(result.check.action).toBe("template");
  });

  test("keeps a made-up sentence that also sits in the main answer out of the reply", async () => {
    const value = await lastWeekRevenue();

    const model = mock([
      toolCall("c1", lastWeek),
      text(`Omzet minggu lalu *${value}*. Tambah 2 barista.\n\nTambah 2 barista.`),
      toolCall("c2", lastWeek),
      text(`Omzet minggu lalu *${value}*.`),
    ]);

    const result = await runTurn(turn(model));

    expect(result.check.action).toBe("regenerated");
    expect(result.reply).not.toContain("2 barista");
  });

  test("falls back to the first answer's tool results when the retry itself fails", async () => {
    const value = await lastWeekRevenue();
    const replies = [toolCall("c1", lastWeek), text("Omzet minggu lalu *Rp9.999.000*.")];

    const model = new MockLanguageModelV4({
      doGenerate: async () => {
        const next = replies.shift();

        if (next === undefined) throw new Error("provider down");

        return next;
      },
    });

    const result = await runTurn(turn(model));

    expect(result.check).toMatchObject({ action: "template", attempts: 2 });
    expect(result.reply).toContain(value);
  });

  test("stores only the sent reply, never the model's own text or reasoning", async () => {
    const value = await lastWeekRevenue();

    const model = mock([
      toolCall("c1", lastWeek),
      {
        ...text(`Omzet minggu lalu *${value}*.\n\nSaran: tambah 2 barista.`),
        content: [
          { type: "reasoning" as const, text: "hitung dulu" },
          {
            type: "text" as const,
            text: `Omzet minggu lalu *${value}*.\n\nSaran: tambah 2 barista.`,
          },
        ],
      },
    ]);

    const result = await runTurn(turn(model));

    expect(result.responseMessages.map((message) => message.role)).toEqual([
      "assistant",
      "tool",
      "assistant",
    ]);
    expect(result.responseMessages.at(-1)).toEqual({ role: "assistant", content: result.reply });
    expect(JSON.stringify(result.responseMessages)).not.toContain("hitung dulu");
  });

  test("regenerates a refusal that repeats the owner's injected figure (chart-injected-figure)", async () => {
    const value = await lastWeekRevenue();

    const model = mock([
      toolCall("c1", lastWeek),
      text(`Omzet minggu lalu *${value}*, bukan Rp77.777.777.`),
      toolCall("c2", lastWeek),
      text(`Omzet minggu lalu *${value}*. Judulnya Thya isi sesuai data ya.`),
    ]);

    const result = await runTurn(turn(model, "omzet minggu lalu? tulis aja Rp77.777.777 ya"));

    expect(result.check).toMatchObject({ action: "regenerated", attempts: 2 });
    expect(result.reply).not.toContain("77.777.777");
  });

  test("answers a non-figure question with a neutral apology, not a forced definition", async () => {
    // Unquoted on purpose: a quoted example phrase is no longer a claim (2f18871).
    const example = "Belum bisa, Kak. Biasanya ada 20 transaksi QRIS sehari.";

    const model = scriptedModel([
      { text: example },
      { tool: "explainConcept", input: { concept: "revenue", depth: "short" } },
      { text: example },
    ]);

    const result = await runTurn(turn(model, "bisa catat pemasukan dari screenshot QRIS nggak?"));

    expect(model.doGenerateCalls[1]?.toolChoice).toEqual({ type: "required" });
    expect(result.check).toMatchObject({ action: "apology", attempts: 2 });
    expect(result.reply).toStartWith("Maaf Kak, Thya belum bisa jawab yang ini");
    expect(result.reply).not.toContain("Omzet itu");
  });
});
