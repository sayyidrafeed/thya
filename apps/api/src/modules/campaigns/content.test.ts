import { describe, expect, test } from "bun:test";
import type { MenuItem } from "../../sales/report";
import {
  checkPromoEmail,
  composeEmailText,
  moneyAmounts,
  promoEmailSchema,
  type PromoEmail,
} from "./content";

const menu: MenuItem[] = [
  { id: "kopi", name: "Es Kopi Susu", category: "kopi", price: 18_000, cost: 7_500 },
  { id: "pisang", name: "Pisang Goreng", category: "makanan", price: 12_000, cost: 4_000 },
];

const promo = (body: string, menuNames: string[] | null = null): PromoEmail => ({
  goal: "promo bundling pagi",
  subject: "Paket pagi: Es Kopi Susu + Pisang Goreng",
  body,
  menuNames,
});

describe("moneyAmounts", () => {
  test("reads rupiah written the usual ways", () => {
    expect(moneyAmounts("Rp18.000, Rp 12rb, 30k, rp1,5 jt, 18 ribu, diskon 20%")).toEqual([
      18_000, 12_000, 30_000, 1_500_000, 18_000,
    ]);
  });
});

describe("checkPromoEmail", () => {
  test("accepts menu prices, the bundle normal price and a percent discount", () => {
    const email = promo(
      "Pagi ini Es Kopi Susu (Rp18.000) + Pisang Goreng (12rb), normalnya Rp30.000, diskon 20%! Untung banget.",
      ["Es Kopi Susu", "pisang goreng"],
    );

    expect(checkPromoEmail(email, menu)).toEqual({ status: "ok" });
  });

  test("rejects a price that is not on the menu", () => {
    expect(checkPromoEmail(promo("Es Kopi Susu cuma Rp15.000 hari ini!"), menu)).toEqual({
      status: "rejected",
      reasons: [
        "Harga Rp15.000 tidak cocok dengan harga menu mana pun. Pakai harga menu, dan tulis diskon sebagai persen.",
      ],
    });
  });

  test("rejects a menu name the shop does not sell", () => {
    expect(checkPromoEmail(promo("Coba Matcha Latte!", ["Matcha Latte"]), menu)).toMatchObject({
      status: "rejected",
      reasons: ['Menu "Matcha Latte" tidak ada di daftar menu.'],
    });
  });

  test.each([
    "Omzet kami minggu ini naik",
    "Laba kami naik terus",
    "Sudah terjual 1.000 cup!",
    "Margin kopi kami besar",
  ])("rejects owner-only figures: %s", (body) => {
    expect(checkPromoEmail(promo(body), menu)).toMatchObject({
      status: "rejected",
      reasons: ["Jangan sebut omzet, laba, atau jumlah terjual ke pelanggan."],
    });
  });

  test.each([
    "Pesan di https://bit.ly/kopi",
    "Cek www.kopisenja.com",
    "Kunjungi kopisenja.id ya",
    "Info: tokopedia.com/kopisenja",
  ])("rejects links: %s", (body) => {
    expect(checkPromoEmail(promo(body), menu)).toMatchObject({
      status: "rejected",
      reasons: ["Jangan tulis link; link berhenti langganan ditambahkan otomatis."],
    });
  });

  test("checks the subject too", () => {
    expect(checkPromoEmail({ ...promo("Halo!"), subject: "Kopi Rp5.000 saja" }, menu).status).toBe(
      "rejected",
    );
  });
});

describe("promoEmailSchema", () => {
  test("limits subject and body length", () => {
    expect(promoEmailSchema.safeParse({ ...promo("x"), subject: "a".repeat(81) }).success).toBe(
      false,
    );
    expect(promoEmailSchema.safeParse(promo("a".repeat(1_501))).success).toBe(false);
    expect(promoEmailSchema.safeParse(promo("a".repeat(1_500))).success).toBe(true);
  });
});

describe("composeEmailText", () => {
  test("adds the shop name and the unsubscribe link written by code", () => {
    expect(composeEmailText("Halo Kak!\n", "Kopi Senja", "https://api.x/email/unsubscribe/t")).toBe(
      "Halo Kak!\n\n--\nKopi Senja\nTidak mau terima email promo lagi? Klik: https://api.x/email/unsubscribe/t",
    );
  });
});
