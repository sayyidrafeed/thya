// Footer line art, drawn in a fixed 1440×420 viewBox. Each pattern returns the same number of
// path strings every frame, so the SVG is rendered once and only `d` changes.

export const artBox = { width: 1440, height: 420 } as const;

export type FooterArt = {
  id: "waves" | "strings" | "flow";
  label: string;
  count: number;
  paths: (seconds: number) => string[];
  opacity: (index: number) => number;
};

// Stable per-item variety (rossark: seeded, never Math.random per frame).
const seeded = (i: number, salt = 0) => {
  const x = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453;

  return x - Math.floor(x);
};

const round = (n: number) => Math.round(n * 10) / 10;

const waveCount = 34;

// A: stacked horizon lines; amplitude grows toward the bottom so the band reads like a slow swell.
function waves(seconds: number) {
  return Array.from({ length: waveCount }, (_, i) => {
    const depth = i / (waveCount - 1);
    const baseY = 90 + depth * 320;
    const amp = 6 + depth * 26;
    const points: string[] = [];

    for (let x = -20; x <= artBox.width + 20; x += 24) {
      const y =
        baseY +
        Math.sin(x * 0.0042 + i * 0.22 + seconds * 0.35) * amp +
        Math.sin(x * 0.011 - i * 0.15 - seconds * 0.22) * amp * 0.35;

      points.push(`${points.length === 0 ? "M" : "L"}${x} ${round(y)}`);
    }

    return points.join(" ");
  });
}

const stringCount = 72;

// B: string art. Chords between a slow lower curve and an upper arc; their envelope draws the shape.
function strings(seconds: number) {
  const drift = Math.sin(seconds * 0.12) * 0.08;

  return Array.from({ length: stringCount }, (_, i) => {
    const p = i / (stringCount - 1);
    const x1 = p * artBox.width;
    const y1 = artBox.height - 10 - Math.sin(p * Math.PI) * 60;
    const q = (p + 0.32 + drift) % 1;
    const angle = Math.PI * (1.05 + q * 0.9);
    const x2 = artBox.width / 2 + Math.cos(angle) * 760;
    const y2 = 470 + Math.sin(angle) * 430;
    const bend = Math.sin(seconds * 0.3 + i * 0.12) * 18;

    return `M${round(x1)} ${round(y1)} Q${round((x1 + x2) / 2 + bend)} ${round((y1 + y2) / 2 - 40)} ${round(x2)} ${round(y2)}`;
  });
}

const flowCount = 140;
const flowSteps = 28;

// C: streamlines traced through a slowly turning angle field.
function flow(seconds: number) {
  return Array.from({ length: flowCount }, (_, i) => {
    let x = seeded(i, 1) * artBox.width;
    let y = 60 + seeded(i, 2) * (artBox.height - 60);
    const points = [`M${round(x)} ${round(y)}`];

    for (let step = 0; step < flowSteps; step++) {
      const angle =
        Math.sin(x * 0.0021 + seconds * 0.18) * 1.6 +
        Math.cos(y * 0.006 - seconds * 0.12) * 1.1 +
        Math.sin((x + y) * 0.0013) * 0.8;

      x += Math.cos(angle) * 14;
      y += Math.sin(angle) * 9;
      points.push(`L${round(x)} ${round(y)}`);
    }

    return points.join(" ");
  });
}

export const footerArts = [
  {
    id: "waves",
    label: "Wave lines",
    count: waveCount,
    paths: waves,
    opacity: (i) => 0.12 + (i / waveCount) * 0.55,
  },
  {
    id: "strings",
    label: "Line art",
    count: stringCount,
    paths: strings,
    opacity: (i) => 0.18 + seeded(i, 3) * 0.3,
  },
  {
    id: "flow",
    label: "Flow field",
    count: flowCount,
    paths: flow,
    opacity: (i) => 0.15 + seeded(i, 4) * 0.45,
  },
] as const satisfies readonly FooterArt[];
