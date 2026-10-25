import { Resvg } from "@resvg/resvg-js";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

// Shared raster step for charts and cards: SVG string -> PNG with the bundled Inter font only.

export const FONT_FAMILY = "Inter";

export const FONT_FILES = ["Inter-Regular.ttf", "Inter-Bold.ttf"].map((file) =>
  fileURLToPath(new URL(`../../../assets/fonts/${file}`, import.meta.url)),
);

const missingFonts = FONT_FILES.filter((file) => !existsSync(file));

// Checked once at load, like env.ts: a missing font would otherwise render blank text in production.
if (missingFonts.length > 0) {
  throw new Error(
    `Font grafik tidak ditemukan: ${missingFonts.join(", ")}. Pastikan apps/api/assets ikut tersalin ke image.`,
  );
}

export const PALETTE = {
  surface: "#faf8f3",
  surfaceRaised: "#ffffff",
  ink: "#17150f",
  inkMuted: "#5c574c",
  line: "#e2dccf",
  brand: "#1c6b47",
  brandSoft: "#e1eee5",
  negative: "#b4442f",
};

export function escapeXml(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

export function truncate(text: string, maxChars: number): string {
  const chars = [...text.trim()];

  return chars.length <= maxChars ? chars.join("") : `${chars.slice(0, maxChars - 1).join("")}…`;
}

const CSS_VAR = /var\(--[\w-]+,\s*([^()]+)\)/g;

// TanStack emits browser SVG: no xmlns, 100% size, CSS variables and inherited fonts. resvg needs all explicit.
export function toResvgSvg(svg: string, width: number, height: number): string {
  if (!svg.startsWith("<svg ")) throw new Error("toResvgSvg: input is not an <svg> element");

  const withRoot = svg.replace(
    /^<svg /,
    `<svg xmlns="http://www.w3.org/2000/svg" font-family="${FONT_FAMILY}" `,
  );

  return withRoot
    .replace(/ width="100%" height="100%"/, ` width="${width}" height="${height}"`)
    .replaceAll(CSS_VAR, (_match, fallback: string) => fallback.trim())
    .replaceAll('font-family="inherit"', `font-family="${FONT_FAMILY}"`);
}

export function rasterize(svg: string): Uint8Array {
  const resvg = new Resvg(svg, {
    font: { fontFiles: FONT_FILES, loadSystemFonts: false, defaultFontFamily: FONT_FAMILY },
  });

  return new Uint8Array(resvg.render().asPng());
}
