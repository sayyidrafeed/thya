// Brightness ramp from empty to dense; index 0 is never drawn.
export const asciiGlyphs = " .·:-=+*#%" as const;

export const asciiCell = { width: 8, height: 12, fontPx: 11 } as const;

export type AsciiGrid = { cols: number; rows: number };

export type AsciiPattern = {
  id: "flow" | "rain" | "ripple" | "fire" | "hills";
  label: string;
  intensity: (col: number, row: number, seconds: number, grid: AsciiGrid) => number;
};

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

// Cheap repeatable per-column randomness, so rain streaks differ without state.
const hash = (n: number) => {
  const x = Math.sin(n * 127.1) * 43758.5453;

  return x - Math.floor(x);
};

// Layered sine waves bent by a slow swirl, so bands drift like ink in water.
function flow(col: number, row: number, seconds: number) {
  const swirl = Math.sin(row * 0.09 + seconds * 0.35) * 2.4;
  const wave = Math.sin(col * 0.055 + swirl + seconds * 0.5);
  const cross = Math.cos(row * 0.16 - col * 0.02 - seconds * 0.4);

  return clamp01(((wave * 0.65 + cross * 0.35 + 1) / 2 - 0.38) / 0.62);
}

function rain(col: number, row: number, seconds: number, grid: AsciiGrid) {
  if (hash(col) < 0.45) return 0;

  const speed = 6 + hash(col + 1) * 10;
  const length = 6 + hash(col + 2) * 14;
  const head = (seconds * speed + hash(col + 3) * grid.rows * 2) % (grid.rows + length);
  const behind = head - row;

  return behind < 0 || behind > length ? 0 : 1 - behind / length;
}

function ripple(col: number, row: number, seconds: number, grid: AsciiGrid) {
  const dx = (col - grid.cols / 2) * 0.66;
  const dy = row - grid.rows / 2;
  const distance = Math.hypot(dx, dy);
  const ring = (Math.sin(distance * 0.42 - seconds * 2) + 1) / 2;

  return clamp01(ring * (1 - distance / (grid.cols * 0.45)) * 1.3);
}

function fire(col: number, row: number, seconds: number, grid: AsciiGrid) {
  const height = row / grid.rows;
  const lick = Math.sin(col * 0.21 + seconds * 2.6 + Math.sin(row * 0.33 - seconds * 3.1) * 1.6);
  const gust = Math.sin(col * 0.05 - seconds * 0.7) * 0.25;

  return clamp01(height ** 1.6 * (0.75 + 0.35 * lick + gust) * 1.25 - 0.08);
}

function hills(col: number, row: number, seconds: number, grid: AsciiGrid) {
  const x = col / grid.cols;
  let level = 0;

  for (let layer = 0; layer < 3; layer++) {
    const crest =
      0.35 +
      layer * 0.18 +
      Math.sin(x * (4 + layer * 2) + layer * 1.7 + seconds * 0.08 * (layer + 1)) * 0.07 +
      Math.sin(x * 11 + layer) * 0.02;

    if (row / grid.rows > crest) level = 0.35 + layer * 0.3;
  }

  const mist = (Math.sin(col * 0.08 - seconds * 0.4 + row * 0.3) + 1) * 0.06;

  return clamp01(level + mist - (level > 0 ? 0 : 0.1));
}

export const asciiPatterns = [
  { id: "flow", label: "Flow", intensity: flow },
  { id: "rain", label: "Rain", intensity: rain },
  { id: "ripple", label: "Ripple", intensity: ripple },
  { id: "fire", label: "Fire", intensity: fire },
  { id: "hills", label: "Hills", intensity: hills },
] as const satisfies readonly AsciiPattern[];

export function glyphLevel(intensity: number) {
  return Math.min(asciiGlyphs.length - 1, Math.floor(intensity * asciiGlyphs.length));
}
