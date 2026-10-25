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
