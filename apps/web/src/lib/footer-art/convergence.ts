// "Many records, one answer": fibres enter from both edges and converge on the centre, where the
// Thya mark sits. Geometry lives in a 1440×420 art box; the hook scales it to cover the canvas.

export const artBox = { width: 1440, height: 420 } as const;
export const focus = { x: 720, y: 210 } as const;

const fibreCount = 132;
const samples = 56;

// Stable per-fibre variety; never Math.random, so every visit draws the same artwork.
export function seeded(i: number, salt = 0) {
  const x = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453;

  return x - Math.floor(x);
}

function cubic(a: number, b: number, c: number, d: number, t: number) {
  const u = 1 - t;

  return u * u * u * a + 3 * u * u * t * b + 3 * u * t * t * c + t * t * t * d;
}

export type Fibre = { points: Float32Array; seed: number };

export function convergenceFibres(): Fibre[] {
  return Array.from({ length: fibreCount }, (_, i) => {
    const side = i % 2 === 0 ? -1 : 1;
    const seed = seeded(i);
    const startX = focus.x + side * (focus.x + 40);
    const startY = 10 + seeded(i, 1) * (artBox.height - 20);
    const sweep = (seeded(i, 2) - 0.5) * 260;
    // Fibres end on a small ring around the mark rather than one pixel, so the bundle stays readable.
    const endAngle = (seeded(i, 3) - 0.5) * 1.2 + (side < 0 ? Math.PI : 0);
    const endX = focus.x + Math.cos(endAngle) * 46;
    const endY = focus.y + Math.sin(endAngle) * 30;
    const points = new Float32Array(samples * 2);

    for (let s = 0; s < samples; s++) {
      const t = s / (samples - 1);

      points[s * 2] = cubic(startX, startX - side * 380, focus.x + side * 260, endX, t);
      points[s * 2 + 1] = cubic(startY, startY + sweep, focus.y + sweep * 0.18, endY, t);
    }

    return { points, seed };
  });
}

// Interleaved LINES vertices: x, y, progress along the fibre (0 at the edge, 1 at the mark), seed.
export function fibreVertices(fibres: Fibre[]) {
  const segments = samples - 1;
  const data = new Float32Array(fibres.length * segments * 2 * 4);
  let o = 0;

  for (const { points, seed } of fibres) {
    for (let s = 0; s < segments; s++) {
      for (const k of [s, s + 1]) {
        data[o++] = points[k * 2] ?? 0;
        data[o++] = points[k * 2 + 1] ?? 0;
        data[o++] = k / segments;
        data[o++] = seed;
      }
    }
  }

  return data;
}
