import { and, asc, eq, inArray, isNull, lte, or, sql } from "drizzle-orm";
import type { MenuCostArgs, SalesRecordArgs } from "../actions/kinds";
import type { Db } from "../db/client";
import { menuCosts, menuItems, transactions } from "../db/schema";
import { channelSaleDays, commissionRates } from "../modules/channel-sales";
import { paymentDays } from "../modules/payments-import";
import { DEMO_HISTORY_DAYS, demoHourlySales, demoMenu, type SalesDataset } from "./demo-shop";
import { addDays, jakartaDate, type MenuItem, type SaleRecord } from "./report";

// Seed rows reach this far ahead, so the demo keeps "today" without a cron until after the final.
const DEMO_SEED_DAYS_AHEAD = 30;

type Cost = { validFrom: string; amount: number; estimated: boolean };

type CostHistory = Map<string, Cost[]>;

async function loadMenu(db: Db, businessId: string, today: string) {
  const items = await db
    .select({
      id: menuItems.id,
      name: menuItems.name,
      category: menuItems.category,
      price: menuItems.price,
    })
    .from(menuItems)
    .where(eq(menuItems.businessId, businessId))
    .orderBy(asc(menuItems.name));

  // Oldest first; ties broken by insert time, then id, so the order never depends on disk layout.
  const costs = await db
    .select({
      menuItemId: menuCosts.menuItemId,
      validFrom: menuCosts.validFrom,
      amount: menuCosts.amount,
      source: menuCosts.source,
    })
    .from(menuCosts)
    .innerJoin(menuItems, eq(menuItems.id, menuCosts.menuItemId))
    .where(and(eq(menuItems.businessId, businessId), lte(menuCosts.validFrom, today)))
    .orderBy(asc(menuCosts.validFrom), asc(menuCosts.createdAt), asc(menuCosts.id));

  const history: CostHistory = new Map();

  for (const { menuItemId, validFrom, amount, source } of costs)
    history.set(menuItemId, [
      ...(history.get(menuItemId) ?? []),
      { validFrom, amount, estimated: source === "estimate" },
    ]);

  const menu: MenuItem[] = items.map((item) => ({
    ...item,
    cost: costOn(history, item.id, today).amount,
  }));

  return { menu, history };
}

// The cost per portion in force on `date`. Partial cost coverage (E10) arrives with HPP
// onboarding; until then a sale without a known cost is an error, never a silent 0.
function costOn(history: CostHistory, itemId: string, date: string): Cost {
  const inForce = (history.get(itemId) ?? []).findLast((cost) => cost.validFrom <= date);

  if (inForce === undefined)
    throw new Error(`menu item ${itemId} has no cost per portion on ${date}`);

  return inForce;
}

// Sales up to `now`: hourly rows count once their hour has ended, rows without an hour count for
// their whole day. Each record keeps the price it was sold at and the cost in force that day.
export async function loadSalesDataset(
  db: Db,
  businessId: string,
  now: Date,
): Promise<SalesDataset> {
  const today = jakartaDate(now);
  const { menu, history } = await loadMenu(db, businessId, today);

  const rows = await db
    .select({
      date: transactions.soldOn,
      itemId: transactions.menuItemId,
      unitPrice: transactions.unitPrice,
      quantity: sql<number>`cast(sum(${transactions.quantity}) as integer)`,
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.businessId, businessId),
        or(
          lte(transactions.soldAt, now),
          and(isNull(transactions.soldAt), lte(transactions.soldOn, today)),
        ),
      ),
    )
    .groupBy(transactions.soldOn, transactions.menuItemId, transactions.unitPrice)
    .orderBy(asc(transactions.soldOn));

  const records: SaleRecord[] = rows.map((row) => {
    const cost = costOn(history, row.itemId, row.date);

    return { ...row, unitCost: cost.amount, costEstimated: cost.estimated };
  });

  return {
    menu,
    records,
    payments: await paymentDays(db, businessId, now),
    channelSales: await channelSaleDays(db, businessId, today),
    commissions: await commissionRates(db, businessId),
    today,
    dataStart: records[0]?.date ?? today,
    asOf: now,
  };
}

export async function hasSales(db: Db, businessId: string): Promise<boolean> {
  return (await db.$count(transactions, eq(transactions.businessId, businessId))) > 0;
}

// Idempotent through the partial unique index on seed rows.
export async function seedDemoSales(db: Db, businessId: string, now: Date) {
  const today = jakartaDate(now);
  const from = addDays(today, -(DEMO_HISTORY_DAYS - 1));

  const ids = new Map<string, string>();

  for (const item of demoMenu) {
    const [row] = await db
      .insert(menuItems)
      .values({ businessId, name: item.name, category: item.category, price: item.price })
      .onConflictDoNothing({ target: [menuItems.businessId, menuItems.name] })
      .returning({ id: menuItems.id });

    // An existing item keeps whatever price the owner set; only new items get the seed price.
    const [existing] = row
      ? [row]
      : await db
          .select({ id: menuItems.id })
          .from(menuItems)
          .where(and(eq(menuItems.businessId, businessId), eq(menuItems.name, item.name)));

    if (!existing) throw new Error(`seed: no id for ${item.name}`);

    ids.set(item.id, existing.id);

    const [hasCost] = await db
      .select({ id: menuCosts.id })
      .from(menuCosts)
      .where(and(eq(menuCosts.menuItemId, existing.id), eq(menuCosts.source, "seed")))
      .limit(1);

    if (!hasCost)
      await db
        .insert(menuCosts)
        .values({ menuItemId: existing.id, amount: item.cost, source: "seed", validFrom: from });
  }

  const sales = demoHourlySales(from, addDays(today, DEMO_SEED_DAYS_AHEAD)).map((sale) => {
    const menuItemId = ids.get(sale.itemId);
    const item = demoMenu.find((candidate) => candidate.id === sale.itemId);

    if (menuItemId === undefined || item === undefined)
      throw new Error(`seed: unknown demo item ${sale.itemId}`);

    return {
      businessId,
      menuItemId,
      soldOn: sale.date,
      soldAt: sale.soldAt,
      quantity: sale.quantity,
      unitPrice: item.price,
      source: "seed" as const,
    };
  });

  const BATCH = 2_000;
  let inserted = 0;

  for (let start = 0; start < sales.length; start += BATCH) {
    const result = await db
      .insert(transactions)
      .values(sales.slice(start, start + BATCH))
      .onConflictDoNothing()
      .returning({ id: transactions.id });

    inserted += result.length;
  }

  return {
    menuItems: ids.size,
    transactions: inserted,
    from,
    through: addDays(today, DEMO_SEED_DAYS_AHEAD),
  };
}

// Q3: a sale typed in chat. No hour is known, so the rows count for their whole day.
export async function recordChatSales(
  db: Db,
  { businessId, draftId, args }: { businessId: string; draftId: string; args: SalesRecordArgs },
) {
  const ids = [...new Set(args.items.map((item) => item.menuItemId))];

  const owned = await db.$count(
    menuItems,
    and(eq(menuItems.businessId, businessId), inArray(menuItems.id, ids)),
  );

  if (owned !== ids.length) throw new Error("a sold item is not on this business's menu");

  await db.insert(transactions).values(
    args.items.map((item) => ({
      businessId,
      menuItemId: item.menuItemId,
      soldOn: args.date,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      source: "chat" as const,
      draftId,
    })),
  );
}

// A new cost per portion from `validFrom` on; earlier sales keep the cost in force on their date.
export async function setMenuCost(
  db: Db,
  { businessId, draftId, args }: { businessId: string; draftId: string; args: MenuCostArgs },
) {
  const [item] = await db
    .select({ id: menuItems.id })
    .from(menuItems)
    .where(and(eq(menuItems.id, args.menuItemId), eq(menuItems.businessId, businessId)));

  if (!item) throw new Error(`menu item ${args.menuItemId} is not this business's`);

  await db.insert(menuCosts).values({
    menuItemId: item.id,
    amount: args.amount,
    source: args.source,
    includesPackaging: args.includesPackaging,
    validFrom: args.validFrom,
    draftId,
  });
}

export type MenuProfileItem = {
  name: string;
  price: number;
  cost: {
    amount: number;
    source: (typeof menuCosts.$inferSelect)["source"];
    validFrom: string;
  } | null;
};

// The menu as the profile block shows it: price and the cost per portion in force today.
export async function menuProfile(
  db: Db,
  businessId: string,
  today: string,
): Promise<MenuProfileItem[]> {
  const items = await db
    .select({ id: menuItems.id, name: menuItems.name, price: menuItems.price })
    .from(menuItems)
    .where(eq(menuItems.businessId, businessId))
    .orderBy(asc(menuItems.name));

  const costs = await db
    .select({
      menuItemId: menuCosts.menuItemId,
      amount: menuCosts.amount,
      source: menuCosts.source,
      validFrom: menuCosts.validFrom,
    })
    .from(menuCosts)
    .innerJoin(menuItems, eq(menuItems.id, menuCosts.menuItemId))
    .where(and(eq(menuItems.businessId, businessId), lte(menuCosts.validFrom, today)))
    .orderBy(asc(menuCosts.validFrom), asc(menuCosts.createdAt), asc(menuCosts.id));

  const latest = new Map(costs.map((cost) => [cost.menuItemId, cost]));

  return items.map((item) => {
    const cost = latest.get(item.id);

    return {
      name: item.name,
      price: item.price,
      cost: cost ? { amount: cost.amount, source: cost.source, validFrom: cost.validFrom } : null,
    };
  });
}
