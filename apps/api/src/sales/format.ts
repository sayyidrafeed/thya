export function formatRupiah(amount: number): string {
  const digits = Math.abs(Math.round(amount))
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ".");

  return `${amount < 0 ? "-" : ""}Rp${digits}`;
}

// One decimal with an Indonesian decimal comma: 38.5 -> "38,5%".
export function formatPercent(value: number): string {
  return `${(Math.round(value * 10) / 10).toString().replace(".", ",")}%`;
}

const COMPACT_UNITS = [
  { min: 1e9, divisor: 1e9, suffix: " M" },
  { min: 1e6, divisor: 1e6, suffix: " jt" },
  { min: 1e3, divisor: 1e3, suffix: " rb" },
] as const;

// Short labels for charts and captions: 1_500_000 -> "Rp1,5 jt", -120_000 -> "-Rp120 rb".
export function formatCompactRupiah(amount: number): string {
  const sign = amount < 0 ? "-" : "";
  const absolute = Math.abs(amount);
  const index = COMPACT_UNITS.findIndex(({ min }) => absolute >= min);
  const found = COMPACT_UNITS[index];

  if (found === undefined) return `${sign}Rp${Math.round(absolute)}`;

  const rounded = (divisor: number) => {
    const decimals = divisor === 1e3 ? 0 : 1;

    return Math.round((absolute / divisor) * 10 ** decimals) / 10 ** decimals;
  };

  // 999_999 rounds to "1000 rb"; show it in the next unit up as "1 jt".
  const larger = COMPACT_UNITS[index - 1];
  const unit = larger !== undefined && rounded(found.divisor) >= 1000 ? larger : found;

  return `${sign}Rp${rounded(unit.divisor).toString().replace(".", ",")}${unit.suffix}`;
}

// Whole counts with Indonesian thousand separators: 1234 -> "1.234".
export function formatCount(count: number): string {
  return Math.round(count)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}
