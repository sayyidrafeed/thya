"use client";

import { useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";

import { sceneTimeline } from "@/lib/landing/scene-timeline";
import type { PlaygroundBeat } from "@/lib/playground/flows";

const maxChips = 2;

// The visitor's thread: beats they picked, with the latest one playing on the scene timeline.
// Chips offer the next unplayed beats in story order, and are held back while Thya is replying.
export function usePlayground(beats: readonly PlaygroundBeat[]) {
  const reduceMotion = useReducedMotion() === true;
  const [played, setPlayed] = useState<string[]>([]);
  const [progress, setProgress] = useState({ shown: 0, typing: false });
  const current = beats.find((beat) => beat.id === played.at(-1));

  useEffect(() => {
    if (!current || reduceMotion) return;

    const timers = sceneTimeline(current.steps).beats.map((beat) =>
      setTimeout(() => setProgress({ shown: beat.shown, typing: beat.typing }), beat.at),
    );

    return () => {
      for (const timer of timers) clearTimeout(timer);
    };
  }, [current, reduceMotion]);

  // With reduced motion a reply shows whole at once, with no typing beat.
  const shown = reduceMotion ? (current?.steps.length ?? 0) : progress.shown;
  const typing = !reduceMotion && progress.typing;
  const replying = current !== undefined && shown < current.steps.length;

  const chips = replying
    ? []
    : beats.filter((beat) => !played.includes(beat.id)).slice(0, maxChips);

  function choose(id: string) {
    if (replying || played.includes(id)) return;

    setProgress({ shown: 0, typing: false });
    setPlayed((value) => [...value, id]);
  }

  function restart() {
    setProgress({ shown: 0, typing: false });
    setPlayed([]);
  }

  return {
    played,
    shown,
    typing,
    chips,
    finished: !replying && played.length === beats.length,
    choose,
    restart,
  };
}
