// PLACEHOLDER script: illustrative Kopi Senja numbers until we record real /demo answers.
export type ChatSide = "in" | "out";

export type ChatLine = { id: string; side: ChatSide; text: string };

export type FeatureTab = { id: string; label: string; lines: readonly ChatLine[] };

export const featureTabs = [
  {
    id: "sales",
    label: "Daily sales",
    lines: [
      { id: "sales-1", side: "out", text: "Omzet kemarin berapa?" },
      {
        id: "sales-2",
        side: "in",
        text: "Omzet kemarin *Rp1.250.000* dari 86 transaksi.\nItu *naik 12%* dibanding Senin minggu lalu.",
      },
    ],
  },
  {
    id: "menu",
    label: "Best sellers",
    lines: [
      { id: "menu-1", side: "out", text: "Menu apa yang paling laku minggu ini?" },
      {
        id: "menu-2",
        side: "in",
        text: "Tiga menu terlaris minggu ini:\n- *Es Kopi Susu* 182 porsi\n- *Matcha Latte* 96 porsi\n- *Americano* 71 porsi",
      },
    ],
  },
  {
    id: "days",
    label: "Busiest days",
    lines: [
      { id: "days-1", side: "out", text: "Hari apa yang paling ramai 2 minggu terakhir?" },
      {
        id: "days-2",
        side: "in",
        text: "Paling ramai hari *Sabtu*, rata-rata *Rp1.900.000*.\nPaling sepi hari Selasa, sekitar Rp780.000.",
      },
    ],
  },
] as const satisfies readonly FeatureTab[];

export type FeatureTabId = (typeof featureTabs)[number]["id"];
