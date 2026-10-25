// Brightness ramp from empty to dense; index 0 is never drawn.
export const asciiGlyphs = " .·:-=+*#%" as const;

export const asciiCell = { width: 8, height: 12, fontPx: 11 } as const;

// Layered sine waves bent by a slow swirl, so bands drift like ink in water instead of scrolling.
export function flowIntensity(col: number, row: number, seconds: number) {
  const swirl = Math.sin(row * 0.09 + seconds * 0.35) * 2.4;
  const wave = Math.sin(col * 0.055 + swirl + seconds * 0.5);
  const cross = Math.cos(row * 0.16 - col * 0.02 - seconds * 0.4);
  const value = (wave * 0.65 + cross * 0.35 + 1) / 2;

  return Math.max(0, (value - 0.38) / 0.62);
}

export function glyphLevel(intensity: number) {
  return Math.min(asciiGlyphs.length - 1, Math.floor(intensity * asciiGlyphs.length));
}
