import { describe, expect, test } from "bun:test";
import { buildDemoSales, demoBusiness } from "../sales/demo-shop";
import { compactHistory, renderSummary, withoutFigures } from "./compaction";
import { runTurn } from "./run-turn";
import { scriptedModel } from "./testing";

const NOW = new Date("2026-10-25T14:00:00+07:00");

describe("compaction (B1)", () => {
  test("no figures survive in the summary, whatever the model wrote", () => {
    expect(
      withoutFigures({
        ongoing: ["Kakak sedang menimbang promo pagi", "Omzet kemarin Rp4.100.000"],
        preferences: ["Jawaban singkat", "Rekap jam 9 malam"],
        pendingQuestions: [],
        corrections: ['"untung" maksudnya laba kotor'],
      }),
    ).toEqual({
      ongoing: ["Kakak sedang menimbang promo pagi"],
      preferences: ["Jawaban singkat"],
      pendingQuestions: [],
      corrections: ['"untung" maksudnya laba kotor'],
    });
  });

  test("the transcript goes in as data with tool calls by name, and the summary comes back clean", async () => {
    const model = scriptedModel([
      {
        tool: "saveSummary",
        input: {
          ongoing: ["Promo pagi"],
          preferences: ["Singkat"],
          pendingQuestions: [],
          corrections: ["Laba = 10%"],
        },
      },
      { text: "ok" },
    ]);

    const summary = await compactHistory({
      model,
      previous: null,
      messages: [
        { role: "user", content: "omzet kemarin?" },
        {
          role: "assistant",
          content: [{ type: "tool-call", toolCallId: "c", toolName: "queryMetric", input: {} }],
        },
        {
          role: "tool",
          content: [
            {
              type: "tool-result",
              toolCallId: "c",
              toolName: "queryMetric",
              output: { type: "json", value: { value: "Rp4.100.000" } },
            },
          ],
        },
        { role: "assistant", content: "Omzet kemarin Rp4.100.000." },
      ],
    });

    const sent = JSON.stringify(model.doGenerateCalls[0]?.prompt);

    expect(summary).toEqual({
      ongoing: ["Promo pagi"],
      preferences: ["Singkat"],
      pendingQuestions: [],
      corrections: [],
    });
    expect(sent).toContain("Pemilik: omzet kemarin?");
    expect(sent).toContain("[cek data: queryMetric]");
    expect(renderSummary(summary)).toBe(
      "Sedang dibahas:\n- Promo pagi\nPreferensi Kakak:\n- Singkat",
    );
  });
});

describe("turn memory (B2)", () => {
  test("the profile block reaches the model, and its prices count as grounded", async () => {
    const model = scriptedModel([{ text: "Harga Americano *Rp15.000* per gelas, Kak." }]);

    const result = await runTurn({
      model,
      business: demoBusiness,
      dataset: buildDemoSales(NOW),
      messages: [{ role: "user", content: "harga americano berapa?" }],
      conceptEvents: [],
      now: NOW,
      memory: {
        profile: "Menu:\n- Americano: harga jual Rp15.000, modal per porsi belum dicatat",
        summary: null,
      },
    });

    const system = JSON.stringify(
      model.doGenerateCalls[0]?.prompt.find((message) => message.role === "system"),
    );

    expect(system).toContain("kosong = belum dibahas, bukan data hilang");
    expect(system).toContain("Americano: harga jual Rp15.000");
    expect(result.check.action).toBe("none");
  });
});
