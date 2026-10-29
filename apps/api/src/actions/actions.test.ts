import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { and, eq } from "drizzle-orm";
import type { Db } from "../db/client";
import { drafts, draftStatus, transactions } from "../db/schema";
import { freshTestDb, integration } from "../db/testing";
import { createPhoneBusiness } from "../modules/business";
import { DRAFT_TTL_MS } from "../modules/drafts";
import { demoBusiness } from "../sales/demo-shop";
import { loadSalesDataset, seedDemoSales } from "../sales/repository";
import {
  dbDraftPort,
  decideConfirm,
  draftCheck,
  NOTHING_OPEN,
  runDraft,
  SAVED_BEFORE,
  type LatestDraft,
} from ".";
import { DRAFT_UNSEEN } from "./kinds";

const NOW = new Date("2026-10-25T14:00:00+07:00");

describe("the confirm rule every draft port shares", () => {
  test("a typed ya runs only an open draft made in an earlier turn; a saved one is said so", () => {
    const answers = draftStatus.enumValues.flatMap((status) =>
      [true, false].map((madeThisTurn) => {
        const latest = { status, summary: "Catat 2 Americano", madeThisTurn };
        const decision = decideConfirm(latest);

        return { status, madeThisTurn, answer: "run" in decision ? decision.run : decision };
      }),
    );

    const ran = {
      status: "pending",
      summary: "Catat 2 Americano",
      madeThisTurn: false,
    } satisfies LatestDraft;

    expect(decideConfirm(null)).toEqual(NOTHING_OPEN);
    expect(answers).toEqual([
      { status: "pending", madeThisTurn: true, answer: DRAFT_UNSEEN },
      { status: "pending", madeThisTurn: false, answer: ran },
      { status: "executing", madeThisTurn: true, answer: NOTHING_OPEN },
      { status: "executing", madeThisTurn: false, answer: NOTHING_OPEN },
      { status: "done", madeThisTurn: true, answer: SAVED_BEFORE },
      { status: "done", madeThisTurn: false, answer: SAVED_BEFORE },
      { status: "failed", madeThisTurn: true, answer: NOTHING_OPEN },
      { status: "failed", madeThisTurn: false, answer: NOTHING_OPEN },
      { status: "cancelled", madeThisTurn: true, answer: NOTHING_OPEN },
      { status: "cancelled", madeThisTurn: false, answer: NOTHING_OPEN },
      { status: "expired", madeThisTurn: true, answer: NOTHING_OPEN },
      { status: "expired", madeThisTurn: false, answer: NOTHING_OPEN },
    ]);
  });

  test("a status read reports a save only for a saved draft and names the draft it read", () => {
    const reads = draftStatus.enumValues.map(
      (status) => [status, draftCheck({ status, summary: "Catat 2 Americano" })] as const,
    );

    expect(reads.map(([status, read]) => [status, read.status, read.summary])).toEqual([
      ["pending", "none", "Catat 2 Americano"],
      ["executing", "none", "Catat 2 Americano"],
      ["done", "already_done", "Catat 2 Americano"],
      ["failed", "none", "Catat 2 Americano"],
      ["cancelled", "none", "Catat 2 Americano"],
      ["expired", "none", "Catat 2 Americano"],
    ]);
    expect(reads[0]?.[1].message).toContain("belum tersimpan");
    expect(draftCheck(null)).toMatchObject({ status: "none", summary: null });
  });
});

describe.if(integration)("deciding drafts", () => {
  let db: Db;
  let businessId: string;

  beforeAll(async () => {
    db = await freshTestDb();
    businessId = (await createPhoneBusiness(db, demoBusiness, "6281200000003")).id;
    await seedDemoSales(db, businessId, NOW);
  }, 60_000);

  afterAll(async () => {
    await db.$client.end();
  });

  const portAt = (now: Date) => dbDraftPort(db, { businessId, traceId: crypto.randomUUID(), now });

  async function draftSale(now = NOW, port = portAt(now), summary = "Catat 2 Americano") {
    const { menu } = await loadSalesDataset(db, businessId, NOW);
    const americano = menu.find((item) => item.name === "Americano");

    if (americano === undefined) throw new Error("the demo menu has no Americano");

    const { draftId, replaced } = await port.create({
      kind: "sales.record",
      args: {
        date: "2026-10-25",
        items: [
          {
            menuItemId: americano.id,
            name: americano.name,
            quantity: 2,
            unitPrice: americano.price,
          },
        ],
      },
      summary,
    });

    return { port, draftId, replaced };
  }

  const statusOf = async (draftId: string) =>
    (await db.select({ status: drafts.status }).from(drafts).where(eq(drafts.id, draftId)))[0]
      ?.status;

  const chatRows = () =>
    db.$count(
      transactions,
      and(eq(transactions.businessId, businessId), eq(transactions.source, "chat")),
    );

  test("a second ya, typed or tapped, hears that the draft was saved and saves nothing more", async () => {
    expect(await portAt(NOW).confirmOpen()).toMatchObject({ status: "none" });

    const { draftId } = await draftSale();
    const nextTurn = portAt(NOW);

    expect(await nextTurn.confirmOpen()).toMatchObject({ status: "done" });
    expect(await nextTurn.confirmOpen()).toEqual(SAVED_BEFORE);
    expect(await runDraft(db, { businessId, draftId, now: NOW })).toMatchObject({
      status: "already_done",
      message: expect.stringContaining("tidak menyimpannya dua kali"),
    });
    expect(await chatRows()).toBe(1);

    // A stray "ya" once the draft's window has passed is answered as nothing waiting.
    const later = new Date(NOW.getTime() + DRAFT_TTL_MS + 60_000);

    expect(await portAt(later).confirmOpen()).toMatchObject({ status: "none" });
  });

  test("a ya in the turn that made the draft waits for the owner to see its card", async () => {
    const before = await chatRows();
    const { port } = await draftSale();

    expect(await port.confirmOpen()).toEqual(DRAFT_UNSEEN);
    expect(await chatRows()).toBe(before);
    expect(await portAt(NOW).confirmOpen()).toMatchObject({ status: "done" });
    expect(await chatRows()).toBe(before + 1);
  });

  test("after a cancel there is nothing to confirm", async () => {
    const before = await chatRows();
    const { port } = await draftSale();

    expect(await port.cancelOpen()).toMatchObject({ status: "done" });
    expect(await portAt(NOW).confirmOpen()).toMatchObject({ status: "none" });
    expect(await chatRows()).toBe(before);
  });

  test("asking whether the latest draft was saved reads it as it is and changes nothing", async () => {
    const before = await chatRows();
    const { draftId } = await draftSale();
    const asker = portAt(NOW);

    expect(await asker.checkLatest()).toEqual({
      status: "none",
      message: expect.stringContaining("belum tersimpan"),
      summary: "Catat 2 Americano",
    });
    expect(await asker.checkLatest()).toMatchObject({ status: "none" });
    expect(await statusOf(draftId)).toBe("pending");
    expect(await chatRows()).toBe(before);
    expect(await asker.confirmOpen()).toMatchObject({ status: "done" });
    expect(await portAt(NOW).checkLatest()).toMatchObject({
      status: "already_done",
      summary: "Catat 2 Americano",
    });
    expect(await chatRows()).toBe(before + 1);
  });

  test("a new draft over an open one names it; over a saved or lapsed one it names nothing", async () => {
    const open = await draftSale();
    const over = await draftSale();

    expect(open.replaced).toBeNull();
    expect(over.replaced).toBe("Catat 2 Americano");
    expect(await statusOf(open.draftId)).toBe("cancelled");
    expect(await portAt(NOW).confirmOpen()).toMatchObject({ status: "done" });
    expect((await draftSale()).replaced).toBeNull();

    const lapsed = new Date(NOW.getTime() + DRAFT_TTL_MS + 60_000);
    const afterWindow = await draftSale(lapsed);

    expect(afterWindow.replaced).toBeNull();
    expect(await afterWindow.port.cancelOpen()).toMatchObject({ status: "done" });
  });

  test("a turn's drafts never replace its own; a redraft still names the card it took over", async () => {
    const alone = portAt(NOW);
    const first = await draftSale(NOW, alone);
    const redraft = await draftSale(NOW, alone);

    await draftSale(NOW, portAt(NOW), "Catat 1 Kopi Tubruk");

    const over = portAt(NOW);
    const takeover = await draftSale(NOW, over);
    const retry = await draftSale(NOW, over);

    expect([first.replaced, redraft.replaced]).toEqual([null, null]);
    expect(await statusOf(first.draftId)).toBe("cancelled");
    expect([takeover.replaced, retry.replaced]).toEqual([
      "Catat 1 Kopi Tubruk",
      "Catat 1 Kopi Tubruk",
    ]);
    expect(await over.endTurn()).toEqual({ draftId: retry.draftId, summary: "Catat 2 Americano" });
    expect(await over.cancelOpen()).toMatchObject({ status: "done" });
    expect(await over.endTurn()).toBeNull();
  });
});
