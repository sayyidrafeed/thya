import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { and, eq } from "drizzle-orm";
import type { Db } from "../db/client";
import { transactions } from "../db/schema";
import { freshTestDb, integration } from "../db/testing";
import { createPhoneBusiness } from "../modules/business";
import { DRAFT_TTL_MS } from "../modules/drafts";
import { demoBusiness } from "../sales/demo-shop";
import { loadSalesDataset, seedDemoSales } from "../sales/repository";
import { dbDraftPort, DRAFT_UNSEEN, runDraft, SAVED_BEFORE } from ".";

const NOW = new Date("2026-10-25T14:00:00+07:00");

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

  async function draftSale() {
    const port = portAt(NOW);
    const { menu } = await loadSalesDataset(db, businessId, NOW);
    const americano = menu.find((item) => item.name === "Americano");

    if (americano === undefined) throw new Error("the demo menu has no Americano");

    const { draftId } = await port.create({
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
      summary: "Catat 2 Americano",
    });

    return { port, draftId };
  }

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
});
