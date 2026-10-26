export const MENU_CATEGORIES = ["kopi", "non-kopi", "makanan"] as const;

export type MenuCategory = (typeof MENU_CATEGORIES)[number];

export type MenuItem = {
  id: string;
  name: string;
  category: MenuCategory;
  price: number;
  cost: number;
};

// Price and cost per portion as they were on the sale date, so a later price or cost change never
// rewrites last month's revenue or profit.
export type SaleRecord = {
  date: string;
  itemId: string;
  quantity: number;
  unitPrice: number;
  unitCost: number;
  // True when that cost is the owner's rough guess (menu_costs.source "estimate"), so every
  // profit figure built on it is labelled "perkiraan" (semantic-education D4, item 6).
  costEstimated?: boolean;
};

// Money in through QRIS/GoPay, summed per WIB day (G10). Its own metric and never part of menu
// revenue: the owner may also record the same sale as a menu item.
export type PaymentDay = { date: string; amount: number };

export type DateRange = { start: string; end: string };

export const PERIODS = [
  "today",
  "yesterday",
  "this_week",
  "last_week",
  "last_7_days",
  "last_14_days",
  "this_month",
  "last_month",
  "last_30_days",
  "custom",
] as const;

export type Period = (typeof PERIODS)[number];

export type PeriodInput = { period: Period; startDate: string | null; endDate: string | null };

// Messages written for the shop owner; the chat may show them as they are.
export class SalesQueryError extends Error {}

const DAY_MS = 86_400_000;
const WIB_OFFSET_MS = 7 * 3_600_000;
const WEEKDAYS_ID = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];

const MONTHS_ID = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "Mei",
  "Jun",
  "Jul",
  "Agu",
  "Sep",
  "Okt",
  "Nov",
  "Des",
];

// WIB has no daylight saving, so a fixed offset is exact.
export function jakartaDate(instant: Date): string {
  return new Date(instant.getTime() + WIB_OFFSET_MS).toISOString().slice(0, 10);
}

export function jakartaHours(instant: Date): number {
  const shifted = new Date(instant.getTime() + WIB_OFFSET_MS);

  return shifted.getUTCHours() + shifted.getUTCMinutes() / 60;
}

export function jakartaTime(instant: Date): string {
  return new Date(instant.getTime() + WIB_OFFSET_MS).toISOString().slice(11, 16).replace(":", ".");
}

export function addDays(date: string, days: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
}

export function dayCount(range: DateRange): number {
  return Math.round((Date.parse(range.end) - Date.parse(range.start)) / DAY_MS) + 1;
}

export function weekdayName(date: string): string {
  return WEEKDAYS_ID[new Date(`${date}T00:00:00Z`).getUTCDay()]!;
}

export function formatDateId(date: string): string {
  const [year, month, day] = date.split("-");

  return `${Number(day)} ${MONTHS_ID[Number(month) - 1]} ${year}`;
}

// One owner for period labels, shared by tools, charts and recaps.
export type DescribedRange = DateRange & { label: string; days: number; dataUntil?: string };

export function describeRange(
  range: DateRange,
  { today, asOf }: { today: string; asOf: Date },
): DescribedRange {
  const label =
    range.start === range.end
      ? formatDateId(range.start)
      : `${formatDateId(range.start)} s.d. ${formatDateId(range.end)}`;

  return {
    ...range,
    label,
    days: dayCount(range),
    ...(range.end === today && { dataUntil: `hari ini pukul ${jakartaTime(asOf)} WIB` }),
  };
}

function startOfWeek(date: string): string {
  const mondayOffset = (new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7;

  return addDays(date, -mondayOffset);
}

function startOfMonth(date: string): string {
  return `${date.slice(0, 7)}-01`;
}

export function resolvePeriod(input: PeriodInput, today: string, dataStart: string): DateRange {
  switch (input.period) {
    case "today":
      return { start: today, end: today };
    case "yesterday": {
      const yesterday = addDays(today, -1);

      return { start: yesterday, end: yesterday };
    }

    case "this_week":
      return { start: startOfWeek(today), end: today };
    case "last_week": {
      const start = addDays(startOfWeek(today), -7);

      return { start, end: addDays(start, 6) };
    }

    case "last_7_days":
      return { start: addDays(today, -7), end: addDays(today, -1) };
    case "this_month":
      return { start: startOfMonth(today), end: today };
    case "last_month": {
      const end = addDays(startOfMonth(today), -1);

      return { start: startOfMonth(end), end };
    }

    case "last_14_days":
      return { start: addDays(today, -14), end: addDays(today, -1) };
    case "last_30_days":
      return { start: addDays(today, -30), end: addDays(today, -1) };
    case "custom": {
      const { startDate, endDate } = input;

      if (!startDate) throw new SalesQueryError("Period custom butuh startDate.");

      if (startDate > today) {
        throw new SalesQueryError(`Belum ada data penjualan setelah hari ini (${today}).`);
      }

      const end = endDate === null || endDate > today ? today : endDate;

      if (startDate > end) throw new SalesQueryError("startDate tidak boleh setelah endDate.");

      if (startDate < dataStart) {
        throw new SalesQueryError(`Data penjualan baru tersedia mulai ${dataStart}.`);
      }

      return { start: startDate, end };
    }
  }
}

export function previousRange(range: DateRange): DateRange {
  const length = dayCount(range);

  return { start: addDays(range.start, -length), end: addDays(range.start, -1) };
}

function inRange(date: string, range: DateRange): boolean {
  return date >= range.start && date <= range.end;
}

function menuIndex(menu: MenuItem[]): Map<string, MenuItem> {
  return new Map(menu.map((item) => [item.id, item]));
}

function lookup(index: Map<string, MenuItem>, itemId: string): MenuItem {
  const item = index.get(itemId);

  if (!item) throw new Error(`Unknown menu item: ${itemId}`);

  return item;
}

function marginPct(grossProfit: number, revenue: number): number {
  return revenue === 0 ? 0 : Math.round((grossProfit / revenue) * 1000) / 10;
}

export function summarizeSales(records: SaleRecord[], menu: MenuItem[], range: DateRange) {
  const index = menuIndex(menu);
  let revenue = 0;
  let cogs = 0;
  let itemsSold = 0;
  let costEstimated = false;

  for (const record of records) {
    if (!inRange(record.date, range)) continue;
    lookup(index, record.itemId);
    revenue += record.unitPrice * record.quantity;
    cogs += record.unitCost * record.quantity;
    itemsSold += record.quantity;
    costEstimated ||= record.costEstimated === true;
  }

  const grossProfit = revenue - cogs;

  return {
    revenue,
    cogs,
    grossProfit,
    grossMarginPct: marginPct(grossProfit, revenue),
    itemsSold,
    days: dayCount(range),
    costEstimated,
  };
}

export function paymentsIn(payments: PaymentDay[], range: DateRange): number {
  return payments.reduce((sum, day) => (inRange(day.date, range) ? sum + day.amount : sum), 0);
}

export const MENU_SORT_KEYS = ["revenue", "quantity", "grossProfit"] as const;

export type MenuSortKey = (typeof MENU_SORT_KEYS)[number];

export function rankMenuItems(
  records: SaleRecord[],
  menu: MenuItem[],
  range: DateRange,
  options: { sortBy: MenuSortKey; direction: "best" | "worst"; limit: number },
) {
  const index = menuIndex(menu);
  const totals = new Map(menu.map((item) => [item.id, { quantity: 0, revenue: 0, cogs: 0 }]));

  for (const record of records) {
    if (!inRange(record.date, range)) continue;
    lookup(index, record.itemId);

    const total = totals.get(record.itemId);

    if (!total) continue;
    total.quantity += record.quantity;
    total.revenue += record.unitPrice * record.quantity;
    total.cogs += record.unitCost * record.quantity;
  }

  const rows = menu.map((item) => {
    const { quantity, revenue, cogs } = totals.get(item.id) ?? { quantity: 0, revenue: 0, cogs: 0 };
    const grossProfit = revenue - cogs;

    return {
      name: item.name,
      category: item.category,
      quantity,
      revenue,
      grossProfit,
      grossMarginPct: marginPct(grossProfit, revenue),
    };
  });

  const totalRevenue = rows.reduce((sum, row) => sum + row.revenue, 0);
  const sign = options.direction === "best" ? -1 : 1;
  rows.sort(
    (a, b) => sign * (a[options.sortBy] - b[options.sortBy]) || a.name.localeCompare(b.name),
  );

  return rows.slice(0, options.limit).map((row, position) => ({
    rank: position + 1,
    ...row,
    revenueSharePct: totalRevenue === 0 ? 0 : Math.round((row.revenue / totalRevenue) * 1000) / 10,
  }));
}

export function dailySales(records: SaleRecord[], menu: MenuItem[], range: DateRange) {
  const index = menuIndex(menu);
  const days = new Map<string, { revenue: number; itemsSold: number }>();

  for (let date = range.start; date <= range.end; date = addDays(date, 1)) {
    days.set(date, { revenue: 0, itemsSold: 0 });
  }

  for (const record of records) {
    const day = days.get(record.date);

    if (!day) continue;
    lookup(index, record.itemId);
    day.revenue += record.unitPrice * record.quantity;
    day.itemsSold += record.quantity;
  }

  return [...days].map(([date, totals]) => ({ date, weekday: weekdayName(date), ...totals }));
}
