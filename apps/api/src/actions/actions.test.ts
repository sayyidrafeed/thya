import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { and, eq } from "drizzle-orm";
import type { Db } from "../db/client";
import { drafts, draftStatus, outboundMessages, transactions } from "../db/schema";
import { freshTestDb, integration } from "../db/testing";
import { createPhoneBusiness } from "../modules/business";
import { commitTurn, markOutbound } from "../modules/conversation";
import { DRAFT_TTL_MS } from "../modules/drafts";
import { demoBusiness } from "../sales/demo-shop";
import { loadSalesDataset, seedDemoSales } from "../sales/repository";
import {
  CARD_LOST,
  cardKey,
  dbDraftPort,
  decideConfirm,
  draftCheck,
  NOTHING_OPEN,
  runDraft,
  SAVED_BEFORE,
  undoDeadRun,
  type CardView,
  type LatestDraft,
} from ".";
import { DRAFT_UNSEEN } from "./kinds";

const NOW = new Date("2026-10-25T14:00:00+07:00");

// The owner's next message, a minute after the card went out with the reply.
const NEXT = new Date(NOW.getTime() + 60_000);

// The job replaying a dead run's batch marks what it reopens with a message of that batch.
const REPLAY = { now: NEXT, reopenedFor: "wamid.next" };

const CARD_VIEWS = ["seen", "unseen", "lost"] as const satisfies readonly CardView[];

describe("the confirm rule every draft port shares", () => {
  test("a typed ya runs only an open draft whose card the owner had first; a saved one is said so", () => {
    const answers = draftStatus.enumValues.flatMap((status) =>
      CARD_VIEWS.map((card) => {
        const latest = { status, summary: "Catat 2 Americano", card };
        const decision = decideConfirm(latest);

        return { status, card, answer: "run" in decision ? decision.run : decision };
      }),
    );

    const ran = {
      status: "pending",
      summary: "Catat 2 Americano",
      card: "seen",
    } satisfies LatestDraft;

    expect(decideConfirm(null)).toEqual(NOTHING_OPEN);
    expect(answers).toEqual([
      { status: "pending", card: "seen", answer: ran },
      { status: "pending", card: "unseen", answer: DRAFT_UNSEEN },
      { status: "pending", card: "lost", answer: CARD_LOST },
      { status: "executing", card: "seen", answer: NOTHING_OPEN },
      { status: "executing", card: "unseen", answer: NOTHING_OPEN },
      { status: "executing", card: "lost", answer: NOTHING_OPEN },
      { status: "done", card: "seen", answer: SAVED_BEFORE },
      { status: "done", card: "unseen", answer: SAVED_BEFORE },
      { status: "done", card: "lost", answer: SAVED_BEFORE },
      { status: "failed", card: "seen", answer: NOTHING_OPEN },
      { status: "failed", card: "unseen", answer: NOTHING_OPEN },
      { status: "failed", card: "lost", answer: NOTHING_OPEN },
      { status: "cancelled", card: "seen", answer: NOTHING_OPEN },
      { status: "cancelled", card: "unseen", answer: NOTHING_OPEN },
      { status: "cancelled", card: "lost", answer: NOTHING_OPEN },
      { status: "expired", card: "seen", answer: NOTHING_OPEN },
      { status: "expired", card: "unseen", answer: NOTHING_OPEN },
      { status: "expired", card: "lost", answer: NOTHING_OPEN },
    ]);
  });

  test("a status read reports a save only for a saved draft and names the draft it read", () => {
    const reads = draftStatus.enumValues.map(
      (status) =>
        [status, draftCheck({ status, summary: "Catat 2 Americano", card: "seen" })] as const,
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

    // An open draft whose card never arrived is not one the owner can check and answer.
    expect(draftCheck({ status: "pending", summary: "Catat 2 Americano", card: "lost" })).toEqual({
      status: "none",
      message: expect.stringContaining("tidak sampai"),
      summary: "Catat 2 Americano",
    });
  });
});

describe.if(integration)("deciding drafts", () => {
  const OWNER = "6281200000003";
  let db: Db;
  let businessId: string;

  beforeAll(async () => {
    db = await freshTestDb();
    businessId = (await createPhoneBusiness(db, demoBusiness, OWNER)).id;
    await seedDemoSales(db, businessId, NOW);
  }, 60_000);

  afterAll(async () => {
    await db.$client.end();
  });

  // A turn whose earliest owner message was written at `ownerWroteAt`.
  const portAt = (now: Date, ownerWroteAt = now) =>
    dbDraftPort(db, { businessId, traceId: crypto.randomUUID(), now, ownerWroteAt });

  // The card as agent-turn sends it: committed to the outbox with the reply, then marked by delivery.
  async function sendCard(
    draftId: string,
    fate: { sentAt: Date } | "queued" | "failed" = { sentAt: NOW },
  ) {
    await commitTurn(db, {
      businessId,
      traceId: crypto.randomUUID(),
      wamids: [],
      history: [],
      outbound: [
        {
          key: cardKey(draftId),
          payload: {
            type: "buttons",
            to: OWNER,
            body: "Catat 2 Americano",
            buttons: [{ id: `draft:${draftId}:yes`, title: "Ya" }],
          },
        },
      ],
    });

    if (fate === "queued") return;

    const [card] = await db
      .select({ id: outboundMessages.id })
      .from(outboundMessages)
      .where(eq(outboundMessages.idempotencyKey, cardKey(draftId)));

    if (card === undefined) throw new Error("the card was not committed");

    await markOutbound(
      db,
      card.id,
      fate === "failed"
        ? { status: "failed", error: "131000: Something went wrong" }
        : { status: "sent", wamid: `wamid.card.${draftId}`, sentAt: fate.sentAt },
    );
  }

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

    await sendCard(draftId);

    const nextTurn = portAt(NEXT);

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
    const { port, draftId } = await draftSale();

    expect(await port.confirmOpen()).toEqual(DRAFT_UNSEEN);
    expect(await chatRows()).toBe(before);

    await sendCard(draftId);

    expect(await portAt(NEXT).confirmOpen()).toMatchObject({ status: "done" });
    expect(await chatRows()).toBe(before + 1);
  });

  test("a typed ya waits for a card that went out after the owner wrote or is still queued", async () => {
    const before = await chatRows();

    // Typed while the turn was still answering: the card left 10 s after the "ya".
    const raced = await draftSale();

    await sendCard(raced.draftId, { sentAt: new Date(NOW.getTime() + 10_000) });

    expect(await portAt(NEXT, new Date(NOW.getTime() + 5_000)).confirmOpen()).toEqual(DRAFT_UNSEEN);

    // Still in the outbox while its send is retried.
    const queued = await draftSale();

    await sendCard(queued.draftId, "queued");

    expect(await portAt(NEXT).confirmOpen()).toEqual(DRAFT_UNSEEN);
    expect(await statusOf(queued.draftId)).toBe("pending");
    expect(await chatRows()).toBe(before);
  });

  test("a lost card stays lost to every ya, and saying it again replaces nothing", async () => {
    const before = await chatRows();
    const lost = await draftSale();

    await sendCard(lost.draftId, "failed");

    const nextTurn = portAt(NEXT);

    // A retried attempt asks again and must hear the same answer.
    expect(await nextTurn.confirmOpen()).toEqual(CARD_LOST);
    expect(await nextTurn.confirmOpen()).toEqual(CARD_LOST);
    expect(await nextTurn.checkLatest()).toMatchObject({
      status: "none",
      message: expect.stringContaining("tidak sampai"),
    });

    // Saying it again, as both answers ask, replaces no card the owner had.
    expect((await draftSale(NEXT)).replaced).toBeNull();
    expect(await statusOf(lost.draftId)).toBe("cancelled");
    expect(await chatRows()).toBe(before);
  });

  test("a run that died before answering is undone, and the card it took over is open again", async () => {
    const before = await chatRows();
    const seen = await draftSale();

    await sendCard(seen.draftId);

    const dead = await draftSale(NEXT, portAt(NEXT), "Catat 1 Kopi Tubruk");

    expect(dead.replaced).toBe("Catat 2 Americano");
    expect(await statusOf(seen.draftId)).toBe("cancelled");

    await undoDeadRun(db, { businessId, ...REPLAY });

    expect(await statusOf(dead.draftId)).toBeUndefined();
    expect(await statusOf(seen.draftId)).toBe("pending");

    // A draft whose card was committed belongs to a run that answered.
    await undoDeadRun(db, { businessId, ...REPLAY });

    expect(await statusOf(seen.draftId)).toBe("pending");
    expect(await portAt(NEXT).confirmOpen()).toMatchObject({ status: "done" });
    expect(await chatRows()).toBe(before + 1);
  });

  test("a dead job that drafted under two traces is undone back to the owner's card", async () => {
    const seen = await draftSale();

    await sendCard(seen.draftId);

    // Two screenshots in one batch: each drafts under its own trace, the second over the first.
    const first = await draftSale(NEXT, portAt(NEXT), "Catat 1 Kopi Tubruk");
    const second = await draftSale(NEXT, portAt(NEXT), "Catat 1 Cappuccino");

    await undoDeadRun(db, { businessId, ...REPLAY });

    expect(await statusOf(first.draftId)).toBeUndefined();
    expect(await statusOf(second.draftId)).toBeUndefined();
    expect(await statusOf(seen.draftId)).toBe("pending");
  });

  test("a ya retried after its run died finds the save that run made, not its undone draft", async () => {
    const before = await chatRows();
    const seen = await draftSale();

    await sendCard(seen.draftId);

    // The run answering "ya, tambah 1 kopi tubruk" saved the card and drafted again, then died.
    const dead = portAt(NEXT);

    expect(await dead.confirmOpen()).toMatchObject({ status: "done" });

    await draftSale(NEXT, dead, "Catat 1 Kopi Tubruk");
    await undoDeadRun(db, { businessId, ...REPLAY });

    expect(await portAt(NEXT).confirmOpen()).toEqual(SAVED_BEFORE);
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

    await sendCard(draftId);

    const asker = portAt(NEXT);

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

    await sendCard(over.draftId);

    expect(await portAt(NEXT).confirmOpen()).toMatchObject({ status: "done" });
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
