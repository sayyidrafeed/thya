import { addDays, jakartaDate, jakartaHours, type MenuItem, type SaleRecord } from "./report";

export const demoBusiness = {
  name: "Kopi Senja",
  kind: "kedai kopi",
  city: "Yogyakarta",
  openHour: 7,
  closeHour: 22,
};

type DemoMenuItem = MenuItem & { baseDailyQuantity: number };

const demoMenu: DemoMenuItem[] = [
  {
    id: "es-kopi-susu-aren",
    name: "Es Kopi Susu Gula Aren",
    category: "kopi",
    price: 18_000,
    cost: 7_500,
    baseDailyQuantity: 45,
  },
  {
    id: "americano",
    name: "Americano",
    category: "kopi",
    price: 15_000,
    cost: 4_500,
    baseDailyQuantity: 18,
  },
  {
    id: "kopi-tubruk",
    name: "Kopi Tubruk",
    category: "kopi",
    price: 10_000,
    cost: 3_000,
    baseDailyQuantity: 14,
  },
  {
    id: "cappuccino",
    name: "Cappuccino",
    category: "kopi",
    price: 22_000,
    cost: 8_000,
    baseDailyQuantity: 16,
  },
  {
    id: "matcha-latte",
    name: "Matcha Latte",
    category: "non-kopi",
    price: 24_000,
    cost: 10_500,
    baseDailyQuantity: 12,
  },
  {
    id: "es-cokelat",
    name: "Es Cokelat",
    category: "non-kopi",
    price: 20_000,
    cost: 8_000,
    baseDailyQuantity: 10,
  },
  {
    id: "teh-tarik",
    name: "Teh Tarik",
    category: "non-kopi",
    price: 14_000,
    cost: 4_500,
    baseDailyQuantity: 12,
  },
  {
    id: "roti-bakar",
    name: "Roti Bakar Cokelat Keju",
    category: "makanan",
    price: 17_000,
    cost: 7_000,
    baseDailyQuantity: 14,
  },
  {
    id: "pisang-goreng",
    name: "Pisang Goreng Madu",
    category: "makanan",
    price: 12_000,
    cost: 4_000,
    baseDailyQuantity: 16,
  },
  {
    id: "mie-goreng-telur",
    name: "Mie Goreng Telur",
    category: "makanan",
    price: 16_000,
    cost: 7_000,
    baseDailyQuantity: 11,
  },
  {
    id: "croissant",
    name: "Croissant Butter",
    category: "makanan",
    price: 20_000,
    cost: 12_000,
    baseDailyQuantity: 7,
  },
];

// Sunday first, matching Date#getUTCDay. Weekends are the busy days for a kedai kopi.
const WEEKDAY_FACTOR = [1.25, 0.85, 0.85, 0.9, 0.95, 1.1, 1.35];
const DATA_DAYS = 120;
const MATCHA_TREND_START = "2026-07-01";

function deterministicNoise(key: string): number {
  let hash = 0x811c9dc5;

  for (let i = 0; i < key.length; i++) {
    hash ^= key.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }

  let t = (hash + 0x6d2b79f5) | 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  const unit = ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;

  return 0.8 + unit * 0.4;
}

function fullDayQuantity(date: string, item: DemoMenuItem): number {
  const weekday = new Date(`${date}T00:00:00Z`).getUTCDay();
  const dayOfMonth = Number(date.slice(8, 10));
  const payday = dayOfMonth >= 25 || dayOfMonth <= 2 ? 1.15 : 1;

  const trend =
    item.id === "matcha-latte"
      ? Math.min(
          1.6,
          0.8 +
            0.004 * Math.max(0, (Date.parse(date) - Date.parse(MATCHA_TREND_START)) / 86_400_000),
        )
      : 1;

  const noise = deterministicNoise(`${date}:${item.id}`);

  return Math.round(item.baseDailyQuantity * WEEKDAY_FACTOR[weekday]! * payday * trend * noise);
}

export type SalesDataset = {
  menu: MenuItem[];
  records: SaleRecord[];
  today: string;
  dataStart: string;
  asOf: Date;
};

// Same calendar date always yields the same numbers; today only counts the hours the shop has been open.
export function buildDemoSales(now: Date): SalesDataset {
  const today = jakartaDate(now);
  const dataStart = addDays(today, -(DATA_DAYS - 1));

  const openShare = Math.min(
    1,
    Math.max(
      0,
      (jakartaHours(now) - demoBusiness.openHour) /
        (demoBusiness.closeHour - demoBusiness.openHour),
    ),
  );

  const records: SaleRecord[] = [];

  for (let date = dataStart; date <= today; date = addDays(date, 1)) {
    for (const item of demoMenu) {
      const full = fullDayQuantity(date, item);
      const quantity = date === today ? Math.floor(full * openShare) : full;
      records.push({ date, itemId: item.id, quantity });
    }
  }

  return { menu: demoMenu, records, today, dataStart, asOf: now };
}
