import { expect, test } from "bun:test";
import { ungroundedNumbers } from "../agent/postcheck";
import { formatCompactRupiah, formatCount, formatRupiah } from "./format";

test("formatCompactRupiah shortens amounts to rb, jt and M with a decimal comma", () => {
  expect(formatCompactRupiah(1_500_000)).toBe("Rp1,5 jt");
  expect(formatCompactRupiah(2_000_000)).toBe("Rp2 jt");
  expect(formatCompactRupiah(-120_000)).toBe("-Rp120 rb");
  expect(formatCompactRupiah(18_500)).toBe("Rp19 rb");
  expect(formatCompactRupiah(1_250_000_000)).toBe("Rp1,3 M");
  expect(formatCompactRupiah(850)).toBe("Rp850");
  expect(formatCompactRupiah(999_999)).toBe("Rp1 jt");
  expect(formatCompactRupiah(-999_999)).toBe("-Rp1 jt");
  expect(formatCompactRupiah(999_999_999)).toBe("Rp1 M");
});

test("a compact label stays grounded by the full amount it came from", () => {
  const evidence = [formatRupiah(1_534_000), formatRupiah(120_400)];

  expect(
    ungroundedNumbers(
      `Omzet ${formatCompactRupiah(1_534_000)}, rata-rata ${formatCompactRupiah(120_400)}.`,
      evidence,
    ),
  ).toEqual([]);
});

test("formatCount groups thousands with dots", () => {
  expect(formatCount(1234)).toBe("1.234");
  expect(formatCount(999)).toBe("999");
  expect(formatCount(1_000_000)).toBe("1.000.000");
});
