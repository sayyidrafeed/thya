import { describe, expect, test } from "bun:test";

import { parseWhatsAppText } from "./format";

const plain = (blocks: ReturnType<typeof parseWhatsAppText>) =>
  blocks.map((block) =>
    block.kind === "list"
      ? {
          list: block.items.map((item) =>
            item.map((s) => (s.bold ? `*${s.text}*` : s.text)).join(""),
          ),
        }
      : {
          paragraph: block.lines.map((line) =>
            line.map((s) => (s.bold ? `*${s.text}*` : s.text)).join(""),
          ),
        },
  );

describe("parseWhatsAppText", () => {
  test("keeps bold spans and plain text in order", () => {
    const [block] = parseWhatsAppText("Omzet kemarin *Rp1.250.000*, naik dari minggu lalu.");

    expect(block?.kind).toBe("paragraph");
    expect(block?.kind === "paragraph" && block.lines[0]?.map((s) => [s.text, s.bold])).toEqual([
      ["Omzet kemarin ", false],
      ["Rp1.250.000", true],
      [", naik dari minggu lalu.", false],
    ]);
  });

  test("groups consecutive dash lines into one list and splits paragraphs on blank lines", () => {
    const text =
      "Menu terlaris minggu ini:\n- *Es Kopi Susu* 182 porsi\n- Matcha Latte 96 porsi\n\nMau dicek per hari?";

    expect(plain(parseWhatsAppText(text))).toEqual([
      { paragraph: ["Menu terlaris minggu ini:"] },
      { list: ["*Es Kopi Susu* 182 porsi", "Matcha Latte 96 porsi"] },
      { paragraph: ["Mau dicek per hari?"] },
    ]);
  });

  test("leaves an unclosed asterisk as plain text", () => {
    expect(plain(parseWhatsAppText("Harga *naik hari ini"))).toEqual([
      { paragraph: ["Harga *naik hari ini"] },
    ]);
  });
});
