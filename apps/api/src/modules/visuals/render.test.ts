import { afterAll, describe, expect, test } from "bun:test";
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { escapeXml, toResvgSvg, truncate } from "./render";

const apiRoot = fileURLToPath(new URL("../../../", import.meta.url));
const sandbox = mkdtempSync(join(tmpdir(), "thya-fonts-"));

afterAll(() => rmSync(sandbox, { recursive: true, force: true }));

describe("font check", () => {
  test("refuses to load with a clear message when the font files are missing", () => {
    // Same layout as apps/api, minus assets/.
    const moduleDir = join(sandbox, "src/modules/visuals");
    mkdirSync(moduleDir, { recursive: true });
    copyFileSync(
      fileURLToPath(new URL("./render.ts", import.meta.url)),
      join(moduleDir, "render.ts"),
    );
    symlinkSync(join(apiRoot, "node_modules"), join(sandbox, "node_modules"));

    const result = Bun.spawnSync([
      process.execPath,
      "-e",
      `await import(${JSON.stringify(join(moduleDir, "render.ts"))})`,
    ]);

    expect(result.exitCode).not.toBe(0);
    expect(result.stderr.toString()).toContain("Font grafik tidak ditemukan");
    expect(result.stderr.toString()).toContain("Inter-Regular.ttf");
  });
});

describe("toResvgSvg", () => {
  test("adds the namespace and size, and resolves CSS variables to their fallback", () => {
    const svg = toResvgSvg(
      '<svg class="ts-chart" width="100%" height="100%"><circle fill="var(--ts-chart-focus-fill, #fff)"/><text font-family="inherit">a</text></svg>',
      300,
      200,
    );

    expect(svg).toBe(
      '<svg xmlns="http://www.w3.org/2000/svg" font-family="Inter" class="ts-chart" width="300" height="200"><circle fill="#fff"/><text font-family="Inter">a</text></svg>',
    );
  });

  test("rejects input that is not an svg element", () => {
    expect(() => toResvgSvg("<div></div>", 1, 1)).toThrow();
  });
});

describe("text helpers", () => {
  test("escapes XML special characters", () => {
    expect(escapeXml(`<a href="x">Tom & Jerry's</a>`)).toBe(
      "&lt;a href=&quot;x&quot;&gt;Tom &amp; Jerry&apos;s&lt;/a&gt;",
    );
  });

  test("truncates by code point, not UTF-16 unit", () => {
    expect(truncate("Kopi ☕️ Susu Gula Aren", 8)).toBe("Kopi ☕️…");
    expect(truncate("Kopi", 8)).toBe("Kopi");
  });
});
