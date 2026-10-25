import type { ChatStep } from "@/lib/landing/showcase-scenes";

export type Beat = { at: number; shown: number; typing: boolean };

const userGapMs = 550;
const thinkMs = 350;
const typeMs = 750;
const holdMs = 1800;

// When each step of a scene appears. Thya always "types" before replying; the owner never does.
export function sceneTimeline(steps: readonly ChatStep[]) {
  const beats: Beat[] = [];
  let at = 0;

  for (const [index, step] of steps.entries()) {
    if (step.from === "user") {
      at += index === 0 ? 0 : userGapMs;
      beats.push({ at, shown: index + 1, typing: false });
      continue;
    }

    at += thinkMs;
    beats.push({ at, shown: index, typing: true });
    at += typeMs;
    beats.push({ at, shown: index + 1, typing: false });
  }

  return { beats, duration: at + holdMs };
}
