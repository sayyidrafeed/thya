"use client";

import { useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";

import { sceneTimeline } from "@/lib/landing/scene-timeline";
import type { Scene } from "@/lib/landing/showcase-scenes";

export type ThreadEntry = { key: number; scene: number; shown: number; typing: boolean };

const keep = 2;

// Plays the hero scenes as one running chat: each scene's steps arrive on its timeline, then the
// next scene starts, until the visitor picks one. Reduced motion shows whole scenes and never advances.
export function useShowcase(scenes: readonly Scene[]) {
  const reduceMotion = useReducedMotion() === true;
  const counter = useRef(0);
  const [activeIndex, setActiveIndex] = useState(0);
  const [pinned, setPinned] = useState(false);
  const [entries, setEntries] = useState<ThreadEntry[]>([]);

  useEffect(() => {
    const scene = scenes[activeIndex];

    if (!scene) return;

    counter.current += 1;

    const key = counter.current;
    const { beats, duration } = sceneTimeline(scene.steps);

    const update = (shown: number, typing: boolean) =>
      setEntries((current) => current.map((e) => (e.key === key ? { ...e, shown, typing } : e)));

    // Re-running for the same scene (Strict Mode, re-selecting it) replaces the last entry.
    setEntries((current) => [
      ...(current.at(-1)?.scene === activeIndex ? current.slice(0, -1) : current).slice(
        -(keep - 1),
      ),
      { key, scene: activeIndex, shown: reduceMotion ? scene.steps.length : 0, typing: false },
    ]);

    if (reduceMotion) return;

    const timers = beats.map((beat) => setTimeout(() => update(beat.shown, beat.typing), beat.at));

    if (!pinned) {
      timers.push(
        setTimeout(() => setActiveIndex((index) => (index + 1) % scenes.length), duration),
      );
    }

    return () => {
      for (const timer of timers) clearTimeout(timer);
    };
  }, [activeIndex, pinned, reduceMotion, scenes]);

  function select(index: number) {
    setPinned(true);
    setActiveIndex(index);
  }

  return { activeIndex, entries, select };
}
