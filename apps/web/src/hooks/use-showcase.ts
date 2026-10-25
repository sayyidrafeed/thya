"use client";

import { useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";

import { sceneTimeline } from "@/lib/landing/scene-timeline";
import type { Scene } from "@/lib/landing/showcase-scenes";

export type ThreadEntry = { key: number; scene: number; shown: number; typing: boolean };

const keep = 2;

// Rafee's cadence: a new scene every 2.2 s; a longer scene gets just enough time to finish.
const cycleMs = 2200;
const afterLastStepMs = 500;

// Plays the hero scenes as one running chat on a 2.2 s cadence. Picking a scene jumps to it and restarts
// the timer. Reduced motion shows whole scenes and never advances.
export function useShowcase(scenes: readonly Scene[]) {
  const reduceMotion = useReducedMotion() === true;
  const counter = useRef(0);
  const [activeIndex, setActiveIndex] = useState(0);
  const [round, setRound] = useState(0);
  const [entries, setEntries] = useState<ThreadEntry[]>([]);

  useEffect(() => {
    const scene = scenes[activeIndex];

    if (!scene) return;

    counter.current += 1;

    const key = counter.current;
    const { beats } = sceneTimeline(scene.steps);
    const lastStepAt = beats.at(-1)?.at ?? 0;

    const update = (shown: number, typing: boolean) =>
      setEntries((current) => current.map((e) => (e.key === key ? { ...e, shown, typing } : e)));

    // Re-running for the same scene (Strict Mode, re-selecting it) replaces the last entry.
    // Earlier scenes cut short by a click are settled first, so none is left "typing".
    const settle = (entry: ThreadEntry) => ({
      ...entry,
      shown: scenes[entry.scene]?.steps.length ?? entry.shown,
      typing: false,
    });

    setEntries((current) => [
      ...(current.at(-1)?.scene === activeIndex ? current.slice(0, -1) : current)
        .slice(-(keep - 1))
        .map(settle),
      { key, scene: activeIndex, shown: reduceMotion ? scene.steps.length : 0, typing: false },
    ]);

    if (reduceMotion) return;

    const timers = beats.map((beat) => setTimeout(() => update(beat.shown, beat.typing), beat.at));

    timers.push(
      setTimeout(
        () => setActiveIndex((index) => (index + 1) % scenes.length),
        Math.max(cycleMs, lastStepAt + afterLastStepMs),
      ),
    );

    return () => {
      for (const timer of timers) clearTimeout(timer);
    };
  }, [activeIndex, round, reduceMotion, scenes]);

  function select(index: number) {
    setRound((value) => value + 1);
    setActiveIndex(index);
  }

  return { activeIndex, entries, select };
}
