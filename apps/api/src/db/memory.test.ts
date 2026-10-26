import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import type { ModelMessage } from "ai";
import { eq } from "drizzle-orm";
import { scriptedModel } from "../agent/testing";
import { compactConversation } from "../jobs/compaction";
import { createPhoneBusiness } from "../modules/business";
import {
  appendMessages,
  historySize,
  loadHistory,
  loadSummary,
  saveSummary,
} from "../modules/conversation";
import { renderProfile } from "../profile";
import { demoBusiness } from "../sales/demo-shop";
import { seedDemoSales, setMenuCost } from "../sales/repository";
import type { Db } from "./client";
import { menuItems } from "./schema";
import { freshTestDb, integration } from "./testing";

const NOW = new Date("2026-10-25T14:00:00+07:00");

describe.if(integration)("memory", () => {
  let db: Db;
  let businessId: string;

  beforeAll(async () => {
    db = await freshTestDb();
    businessId = (await createPhoneBusiness(db, demoBusiness, "6281200000005")).id;
    await seedDemoSales(db, businessId, NOW);
  }, 60_000);

  afterAll(async () => {
    await db.$client.end();
  });

  test("the profile block comes from tables, and an estimated cost says so", async () => {
    const [americano] = await db.select().from(menuItems).where(eq(menuItems.name, "Americano"));

    await setMenuCost(db, {
      businessId,
      draftId: crypto.randomUUID(),
      args: {
        menuItemId: americano?.id ?? "",
        name: "Americano",
        amount: 5_000,
        source: "estimate",
        includesPackaging: null,
        validFrom: "2026-10-25",
      },
    });

    const profile = await renderProfile(db, businessId, NOW);

    expect(profile).toContain(
      "- Americano: harga jual Rp15.000, modal per porsi Rp5.000 (perkiraan, sejak 25 Okt 2026)",
    );
    expect(profile).toContain(
      "- Kopi Tubruk: harga jual Rp10.000, modal per porsi Rp3.000 (data contoh,",
    );
  });

  test("compaction folds older turns, keeps the last four, and loses a race cleanly", async () => {
    const turns = Array.from({ length: 10 }, (_, index): ModelMessage[] => [
      { role: "user", content: `pertanyaan ${index}` },
      { role: "assistant", content: `jawaban ${index} ${"panjang ".repeat(400)}` },
    ]);

    for (const turn of turns)
      await appendMessages(
        db,
        { businessId, traceId: Bun.randomUUIDv7(), source: "whatsapp" },
        turn,
      );

    expect(await historySize(db, businessId)).toBeGreaterThan(24_000);

    const model = scriptedModel([
      {
        tool: "saveSummary",
        input: {
          ongoing: ["Kakak bertanya soal jualan"],
          preferences: [],
          pendingQuestions: [],
          corrections: [],
        },
      },
      { text: "ok" },
    ]);

    expect(await compactConversation({ db, model }, businessId)).toBe(true);

    const history = await loadHistory(db, businessId);
    const stored = await loadSummary(db, businessId);

    expect(history[0]).toEqual({ role: "user", content: "pertanyaan 6" });
    expect(history).toHaveLength(8);
    expect(stored?.revision).toBe(1);
    expect(stored?.summary.ongoing).toEqual(["Kakak bertanya soal jualan"]);

    // A second writer still holding revision 0 must not overwrite revision 1.
    expect(
      await saveSummary(db, {
        businessId,
        previousRevision: 0,
        coversThroughMessageId: 1,
        summary: stored?.summary ?? {
          ongoing: [],
          preferences: [],
          pendingQuestions: [],
          corrections: [],
        },
      }),
    ).toBe(false);
  });
});
