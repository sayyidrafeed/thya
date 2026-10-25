// Fibre artworks for the footer, all centred on the Thya mark at the focus point. Geometry lives in a
// 1440×420 art box; the scene scales it to cover the canvas. Progress runs the way comets travel.

export const artBox = { width: 1440, height: 420 } as const;
export const focus = { x: 720, y: 210 } as const;

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

type Curve = (t: number) => [number, number];

function sample(curve: Curve) {
  const points = new Float32Array(samples * 2);

  for (let s = 0; s < samples; s++) {
    const [x, y] = curve(s / (samples - 1));

    points[s * 2] = x;
    points[s * 2 + 1] = y;
  }

  return points;
}

// A: scattered records from both edges converge on the mark ("many records, one answer").
function converge(): Fibre[] {
  return Array.from({ length: 132 }, (_, i) => {
    const side = i % 2 === 0 ? -1 : 1;
    const seed = seeded(i);
    const startX = focus.x + side * (focus.x + 40);
    const startY = 10 + seeded(i, 1) * (artBox.height - 20);
    const sweep = (seeded(i, 2) - 0.5) * 260;
    // Fibres end on a small ring around the mark rather than one pixel, so the bundle stays readable.
    const endAngle = (seeded(i, 3) - 0.5) * 1.2 + (side < 0 ? Math.PI : 0);
    const endX = focus.x + Math.cos(endAngle) * 46;
    const endY = focus.y + Math.sin(endAngle) * 30;

    const points = sample((t) => [
      cubic(startX, startX - side * 380, focus.x + side * 260, endX, t),
      cubic(startY, startY + sweep, focus.y + sweep * 0.18, endY, t),
    ]);

    return { points, seed };
  });
}

// B: one question in the middle, answers fanning out across the shop.
function radiate(): Fibre[] {
  return Array.from({ length: 150 }, (_, i) => {
    const seed = seeded(i);
    const angle = seeded(i, 1) * Math.PI * 2;
    const curl = (seeded(i, 2) - 0.5) * 1.1;
    const reach = 700 + seeded(i, 3) * 300;

    const at = (a: number, r: number): [number, number] => [
      focus.x + Math.cos(a) * r,
      focus.y + Math.sin(a) * r * 0.42,
    ];

    const [x0, y0] = at(angle, 50);
    const [x1, y1] = at(angle + curl * 0.3, reach * 0.3);
    const [x2, y2] = at(angle + curl * 0.8, reach * 0.65);
    const [x3, y3] = at(angle + curl, reach);
    const points = sample((t) => [cubic(x0, x1, x2, x3, t), cubic(y0, y1, y2, y3, t)]);

    return { points, seed };
  });
}

// C: tangled lines on the left are pinched through Thya and leave as one tidy bundle on the right.
function untangle(): Fibre[] {
  return Array.from({ length: 120 }, (_, i) => {
    const seed = seeded(i);
    const startY = 10 + seeded(i, 1) * (artBox.height - 20);
    const pinchY = focus.y + (seeded(i, 2) - 0.5) * 22;
    const endY = focus.y + (seeded(i, 2) - 0.5) * 60;
    const sweep = (seeded(i, 3) - 0.5) * 360;
    const wobble = 18 + seeded(i, 4) * 30;

    const points = sample((t) => {
      if (t < 0.5) {
        const u = t * 2;
        const loose = (1 - u) ** 1.5;

        return [
          cubic(-40, 260, 560, focus.x, u),
          cubic(startY, startY + sweep, pinchY, pinchY, u) +
            Math.sin(u * Math.PI * 7 + seed * 9) * wobble * loose,
        ];
      }

      const u = (t - 0.5) * 2;

      return [
        cubic(focus.x, 960, 1240, artBox.width + 40, u),
        cubic(pinchY, pinchY, endY, endY, u),
      ];
    });

    return { points, seed };
  });
}

export const footerArts = [
  { id: "converge", label: "Converge", build: converge },
  { id: "radiate", label: "Radiate", build: radiate },
  { id: "untangle", label: "Untangle", build: untangle },
] as const;

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
