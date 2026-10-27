import { formatPercent, formatRupiah } from "../sales/format";
import {
  dayCount,
  DELIVERY_CHANNEL_NAMES,
  DELIVERY_CHANNELS,
  formatDateId,
  marginPct,
  summarizeSales,
  type ChannelCommission,
  type ChannelSaleDay,
  type DateRange,
  type DeliveryChannel,
  type MenuItem,
  type SaleRecord,
} from "../sales/report";

// Profit per sales channel (decided 2026-10-27). Direct sales are the menu transactions; delivery
// apps come from screenshots. An app's commission is gross minus net when the screenshot printed
// the net, else the owner's own rate. Online ingredient cost has no menu breakdown, so it is the
// shop's own cost/revenue ratio in the same period, and every online profit is an estimate.

export type ChannelId = "direct" | DeliveryChannel;

export const CHANNEL_LABELS: Record<ChannelId, string> = {
  direct: "Langsung di toko",
  ...DELIVERY_CHANNEL_NAMES,
};

export type CommissionFrom = "screenshot" | "owner_rate" | "mixed";

export type ChannelMissing = "commission" | "order_count" | "cost_ratio";

export type ChannelLine =
  | {
      channel: ChannelId;
      status: "ok";
      revenue: number;
      commission: number;
      commissionFrom: CommissionFrom | null;
      cogs: number;
      grossProfit: number;
      marginPct: number;
      days: number;
      estimated: boolean;
    }
  | {
      channel: DeliveryChannel;
      status: "not_ready";
      revenue: number;
      days: number;
      missing: ChannelMissing;
      // Days whose screenshot lacks the order count a per-order fee needs.
      dates: string[];
    };

export type ChannelQuery = {
  menu: MenuItem[];
  records: SaleRecord[];
  channelSales: ChannelSaleDay[];
  commissions: ChannelCommission[];
  range: DateRange;
};

type DayCommission =
  | { status: "ok"; amount: number; from: "screenshot" | "owner_rate" }
  | { status: "missing"; missing: "commission" | "order_count" };

export function dayCommission(
  day: ChannelSaleDay,
  rate: ChannelCommission | undefined,
): DayCommission {
  if (day.netReceived !== null)
    return { status: "ok", amount: day.grossSales - day.netReceived, from: "screenshot" };

  if (rate === undefined) return { status: "missing", missing: "commission" };

  if (rate.feePerOrder > 0 && day.orderCount === null)
    return { status: "missing", missing: "order_count" };

  return {
    status: "ok",
    amount:
      Math.round((day.grossSales * rate.rateBps) / 10_000) +
      rate.feePerOrder * (day.orderCount ?? 0),
    from: "owner_rate",
  };
}

function commissionFrom(sources: Set<"screenshot" | "owner_rate">): CommissionFrom {
  return sources.size > 1 ? "mixed" : sources.has("screenshot") ? "screenshot" : "owner_rate";
}

function deliveryLine(
  channel: DeliveryChannel,
  days: ChannelSaleDay[],
  rate: ChannelCommission | undefined,
  costRatio: number | null,
): ChannelLine {
  const revenue = days.reduce((sum, day) => sum + day.grossSales, 0);
  const base = { channel, revenue, days: days.length };
  const sources = new Set<"screenshot" | "owner_rate">();
  let commission = 0;

  for (const day of days) {
    const found = dayCommission(day, rate);

    if (found.status === "missing") {
      const dates = days.flatMap((other) =>
        dayCommission(other, rate).status === "missing" ? [other.date] : [],
      );

      return { ...base, status: "not_ready", missing: found.missing, dates };
    }

    commission += found.amount;
    sources.add(found.from);
  }

  if (costRatio === null) return { ...base, status: "not_ready", missing: "cost_ratio", dates: [] };

  const cogs = Math.round(revenue * costRatio);
  const grossProfit = revenue - commission - cogs;

  return {
    ...base,
    status: "ok",
    commission,
    commissionFrom: commissionFrom(sources),
    cogs,
    grossProfit,
    marginPct: marginPct(grossProfit, revenue),
    estimated: true,
  };
}

const inRange = (date: string, range: DateRange) => date >= range.start && date <= range.end;

// Null when no delivery app has a day in the range: there is nothing to compare.
export function compareChannels(query: ChannelQuery): ChannelLine[] | null {
  const delivery = query.channelSales.filter((day) => inRange(day.date, query.range));

  if (delivery.length === 0) return null;

  const direct = summarizeSales(query.records, query.menu, query.range);
  const costRatio = direct.revenue > 0 ? direct.cogs / direct.revenue : null;

  const directLine: ChannelLine = {
    channel: "direct",
    status: "ok",
    revenue: direct.revenue,
    commission: 0,
    commissionFrom: null,
    cogs: direct.cogs,
    grossProfit: direct.grossProfit,
    marginPct: direct.grossMarginPct,
    days: dayCount(query.range),
    estimated: direct.costEstimated,
  };

  return [
    directLine,
    ...DELIVERY_CHANNELS.flatMap((channel) => {
      const days = delivery.filter((day) => day.channel === channel);

      if (days.length === 0) return [];

      const rate = query.commissions.find((commission) => commission.channel === channel);

      return [deliveryLine(channel, days, rate, costRatio)];
    }),
  ];
}

const COMMISSION_FROM_TEXT: Record<CommissionFrom, string> = {
  screenshot: "dari screenshot (penjualan kotor dikurangi uang yang diterima)",
  owner_rate: "dari potongan yang Kakak sebut",
  mixed: "sebagian dari screenshot, sebagian dari potongan yang Kakak sebut",
};

function notReadyMessage(line: Extract<ChannelLine, { status: "not_ready" }>): string {
  const label = CHANNEL_LABELS[line.channel];

  switch (line.missing) {
    case "commission":
      return `Potongan ${label} belum Thya ketahui, jadi untungnya belum bisa dihitung. ${label} motong berapa persen, Kak? Kalau ada biaya per pesanan, sebut juga ya.`;
    case "order_count":
      return `${label} kena biaya per pesanan, tapi screenshot ${line.dates.map(formatDateId).join(", ")} tidak menulis jumlah pesanan. Kirim screenshot yang ada jumlah pesanannya ya, Kak.`;
    case "cost_ratio":
      return `Modal bahan jualan ${label} diperkirakan dari jualan langsung di periode yang sama, tapi di periode ini belum ada jualan langsung yang tercatat.`;
  }
}

const leftPer100k = (pct: number) => formatRupiah(pct * 1_000);

// What the model reads: every figure already formatted, so it copies instead of computing (§4.3).
export function describeChannels(lines: ChannelLine[], range: DateRange) {
  const days = dayCount(range);

  const channels = lines.map((line) =>
    line.status === "not_ready"
      ? {
          label: CHANNEL_LABELS[line.channel],
          status: line.status,
          revenue: formatRupiah(line.revenue),
          daysWithData: line.days,
          message: notReadyMessage(line),
        }
      : {
          label: CHANNEL_LABELS[line.channel],
          status: line.status,
          revenue: formatRupiah(line.revenue),
          appCommission: line.commissionFrom === null ? null : formatRupiah(line.commission),
          commissionFrom:
            line.commissionFrom === null ? null : COMMISSION_FROM_TEXT[line.commissionFrom],
          cogs: formatRupiah(line.cogs),
          grossProfit: formatRupiah(line.grossProfit),
          margin: formatPercent(line.marginPct),
          leftPer100k: leftPer100k(line.marginPct),
          daysWithData: line.days,
          estimated: line.estimated,
        },
  );

  const ready = lines.filter(
    (line): line is Extract<ChannelLine, { status: "ok" }> =>
      line.status === "ok" && line.revenue > 0,
  );

  const best = ready.toSorted((a, b) => b.marginPct - a.marginPct)[0];

  const partial = lines.filter((line) => line.channel !== "direct" && line.days < days);

  return {
    channels,
    best:
      best === undefined || ready.length < 2
        ? null
        : `Dari tiap Rp100.000 jualan, sisa untung paling besar ada di ${CHANNEL_LABELS[best.channel]}: sekitar ${leftPer100k(best.marginPct)}.`,
    estimateNote: ready.some((line) => line.estimated)
      ? 'Modal bahan jualan online diperkirakan dari perbandingan modal dan omzet jualan langsung di periode yang sama, jadi laba dan margin online adalah perkiraan. Sebut sebagai perkiraan, misalnya "untung GoFood sekitar Rp… (perkiraan)".'
      : null,
    coverageNote:
      partial.length === 0
        ? null
        : `${partial.map((line) => `${CHANNEL_LABELS[line.channel]} baru tercatat ${line.days} dari ${days} hari`).join(", ")}. Bandingkan sisa untung per Rp100.000, jangan total omzetnya.`,
  };
}

// Said when no app has data in the period. `importEnabled`: whether screenshots are read at all,
// so Thya never asks for one it cannot read (U10: the tool stays, the answer says why).
export function noChannelDataMessage({
  channelSales,
  importEnabled,
}: {
  channelSales: ChannelSaleDay[];
  importEnabled: boolean;
}): string {
  const dates = channelSales.map((day) => day.date).toSorted();
  const [first] = dates;
  const last = dates.at(-1);

  if (first !== undefined && last !== undefined)
    return `Data GoFood, GrabFood, atau ShopeeFood untuk periode ini belum ada. Yang sudah tercatat ${formatDateId(first)} s.d. ${formatDateId(last)}.${importEnabled ? " Kalau mau, kirim screenshot ringkasan penjualan per hari untuk periode ini." : ""}`;

  return importEnabled
    ? "Belum ada data penjualan GoFood, GrabFood, atau ShopeeFood. Kirim screenshot ringkasan penjualan per hari dari GoBiz, GrabMerchant, atau aplikasi ShopeeFood ke chat ini, nanti Thya catat setelah Kakak tekan Ya."
    : "Thya belum bisa membaca penjualan GoFood, GrabFood, atau ShopeeFood, jadi jualan online dan langsung belum bisa dibandingkan.";
}
