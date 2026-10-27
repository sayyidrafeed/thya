import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { and, asc, eq, gt } from "drizzle-orm";
import { createPhoneBusiness, onboardBusiness, onboardingFileSchema } from "../modules/business";
import { demoBusiness } from "../sales/demo-shop";
import { addDays, jakartaDate } from "../sales/report";
import { loadSalesDataset, recordChatSales, seedDemoSales } from "../sales/repository";
import type { Db } from "./client";
import { businesses, menuCosts, menuItems, transactions } from "./schema";
import { freshTestDb, integration } from "./testing";

// A pilot owner's own menu, never mixed with the demo's seed rows.

const NOW = new Date("2026-10-28T10:00:00+07:00");
const TODAY = jakartaDate(NOW);
const PILOT = "6281200000031";
const DEMO_COPY = "6281200000032";

const warung = {
  phone: "081200000031",
  business: {
    name: "Warung Bu Tes",
    kind: "warung makan",
    city: "Kota Contoh",
    openHour: 7,
    closeHour: 21,
  },
  menu: [
    {
      name: "Nasi Ayam Goreng",
      category: "makanan",
      price: 18_000,
      cost: { amount: 9_000, source: "owner" },
    },
    {
      name: "Es Teh Manis",
      category: "non-kopi",
      price: 4_000,
      cost: { amount: 1_000, source: "estimate" },
    },
    {
      name: "Kopi Hitam",
      category: "kopi",
      price: 4_000,
      cost: { amount: 1_500, source: "owner" },
    },
    {
      name: "Biaya Bungkus",
      category: "lainnya",
      price: 1_000,
      cost: { amount: 700, source: "owner" },
    },
  ],
};

describe("onboarding file", () => {
  test("the example in scripts/ is a valid file", async () => {
    const example = await Bun.file(
      `${import.meta.dir}/../../scripts/pilot-onboarding.example.json`,
    ).json();

    expect(onboardingFileSchema.safeParse(example).success).toBe(true);
  });

  test("a number Thya could never match, a missing cost or a duplicate name is refused", () => {
    const [first, second] = warung.menu;

    const invalid = [
      { ...warung, phone: "812000000031" },
      { ...warung, menu: [{ ...first, cost: undefined }] },
      { ...warung, menu: [first, { ...second, name: "  nasi ayam  GORENG " }] },
      { ...warung, business: { ...warung.business, closeHour: 7 } },
    ];

    expect(invalid.map((file) => onboardingFileSchema.safeParse(file).success)).toEqual([
      false,
      false,
      false,
      false,
    ]);
  });
});

describe.if(integration)("pilot onboarding", () => {
  let db: Db;
  let pilotId: string;

  beforeAll(async () => {
    db = await freshTestDb();
  }, 60_000);

  afterAll(async () => {
    await db.$client.end();
  });

  const menuOf = (businessId: string) =>
    db
      .select({ name: menuItems.name, category: menuItems.category, price: menuItems.price })
      .from(menuItems)
      .where(eq(menuItems.businessId, businessId))
      .orderBy(asc(menuItems.name));

  const costsOf = (businessId: string) =>
    db
      .select({
        name: menuItems.name,
        amount: menuCosts.amount,
        source: menuCosts.source,
        validFrom: menuCosts.validFrom,
      })
      .from(menuCosts)
      .innerJoin(menuItems, eq(menuItems.id, menuCosts.menuItemId))
      .where(eq(menuItems.businessId, businessId))
      .orderBy(asc(menuItems.name));

  test("the owner's own menu, categories and costs, with no seed sales and nothing dated ahead", async () => {
    const result = await onboardBusiness(db, onboardingFileSchema.parse(warung), NOW);

    if (result.status === "demo_copy") throw new Error("a new number was taken for a demo copy");

    pilotId = result.businessId;

    expect(result).toMatchObject({
      status: "created",
      added: ["Nasi Ayam Goreng", "Es Teh Manis", "Kopi Hitam", "Biaya Bungkus"],
      kept: [],
    });

    const [business] = await db.select().from(businesses).where(eq(businesses.id, pilotId));

    expect(business).toMatchObject({
      ...warung.business,
      whatsappPhone: PILOT,
      isDemo: false,
      isDemoCopy: false,
    });

    expect(await menuOf(pilotId)).toEqual([
      { name: "Biaya Bungkus", category: "lainnya", price: 1_000 },
      { name: "Es Teh Manis", category: "non-kopi", price: 4_000 },
      { name: "Kopi Hitam", category: "kopi", price: 4_000 },
      { name: "Nasi Ayam Goreng", category: "makanan", price: 18_000 },
    ]);

    expect(await costsOf(pilotId)).toEqual([
      { name: "Biaya Bungkus", amount: 700, source: "owner", validFrom: TODAY },
      { name: "Es Teh Manis", amount: 1_000, source: "estimate", validFrom: TODAY },
      { name: "Kopi Hitam", amount: 1_500, source: "owner", validFrom: TODAY },
      { name: "Nasi Ayam Goreng", amount: 9_000, source: "owner", validFrom: TODAY },
    ]);

    expect(await db.$count(transactions, eq(transactions.businessId, pilotId))).toBe(0);
    expect(await db.$count(transactions, gt(transactions.soldOn, TODAY))).toBe(0);

    const dataset = await loadSalesDataset(db, pilotId, NOW);

    expect(dataset.records).toEqual([]);
    expect(dataset.menu.map((item) => [item.name, item.cost])).toContainEqual([
      "Es Teh Manis",
      1_000,
    ]);
  });

  test("a re-run with one more item adds only that item; stored prices and costs stay", async () => {
    const [nasi, ...rest] = warung.menu;

    const edited = {
      ...warung,
      business: { ...warung.business, name: "Warung Bu Tes Baru" },
      menu: [
        {
          ...nasi,
          name: "nasi ayam goreng",
          price: 20_000,
          cost: { amount: 9_500, source: "owner" },
        },
        ...rest,
        {
          name: "Tahu Bacem",
          category: "makanan",
          price: 2_000,
          cost: { amount: 900, source: "owner" },
        },
      ],
    };

    expect(await onboardBusiness(db, onboardingFileSchema.parse(edited), NOW)).toEqual({
      status: "existing",
      businessId: pilotId,
      added: ["Tahu Bacem"],
      kept: [{ name: "Nasi Ayam Goreng", fields: ["price", "cost"] }],
      profileKept: ["name"],
    });

    const menu = await menuOf(pilotId);

    expect(menu).toHaveLength(5);
    expect(menu).toContainEqual({ name: "Nasi Ayam Goreng", category: "makanan", price: 18_000 });
    expect(menu).toContainEqual({ name: "Tahu Bacem", category: "makanan", price: 2_000 });

    const costs = await costsOf(pilotId);

    expect(costs.filter((cost) => cost.name === "Nasi Ayam Goreng")).toEqual([
      { name: "Nasi Ayam Goreng", amount: 9_000, source: "owner", validFrom: TODAY },
    ]);

    const [business] = await db.select().from(businesses).where(eq(businesses.id, pilotId));

    expect(business?.name).toBe("Warung Bu Tes");
  });

  test("a sale the owner types for yesterday still loads, priced with the first cost on record", async () => {
    const [nasi] = await db
      .select({ id: menuItems.id })
      .from(menuItems)
      .where(and(eq(menuItems.businessId, pilotId), eq(menuItems.name, "Nasi Ayam Goreng")));

    const yesterday = addDays(TODAY, -1);

    await recordChatSales(db, {
      businessId: pilotId,
      draftId: crypto.randomUUID(),
      args: {
        date: yesterday,
        items: [
          { menuItemId: nasi?.id ?? "", name: "Nasi Ayam Goreng", quantity: 2, unitPrice: 18_000 },
        ],
      },
    });

    const dataset = await loadSalesDataset(db, pilotId, NOW);

    expect(dataset.records).toEqual([
      {
        date: yesterday,
        itemId: nasi?.id ?? "",
        quantity: 2,
        unitPrice: 18_000,
        unitCost: 9_000,
        costEstimated: false,
      },
    ]);
  });

  test("a demo copy's number is not onboarded, and seed rows never enter a pilot business", async () => {
    const copy = await createPhoneBusiness(db, demoBusiness, DEMO_COPY);

    expect(
      await onboardBusiness(db, onboardingFileSchema.parse({ ...warung, phone: DEMO_COPY }), NOW),
    ).toEqual({ status: "demo_copy" });
    expect(await menuOf(copy.id)).toEqual([]);

    await expect(seedDemoSales(db, pilotId, NOW)).rejects.toThrow(
      "not the demo shop or a copy of it",
    );
    expect(await db.$count(transactions, eq(transactions.businessId, pilotId))).toBe(1);

    expect((await seedDemoSales(db, copy.id, NOW)).transactions).toBeGreaterThan(0);
  });
});
