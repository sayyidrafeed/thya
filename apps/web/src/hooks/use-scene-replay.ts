"use client";

import { useInView, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";

import { sceneTimeline } from "@/lib/landing/scene-timeline";
import type { ChatStep } from "@/lib/landing/showcase-scenes";

const restartAfterMs = 2400;

// Plays a scene's steps on its timeline while on screen, then replays it. Off screen or with
// reduced motion the whole scene shows at once.
export function useSceneReplay(steps: readonly ChatStep[]) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { amount: 0.4 });
  const reduceMotion = useReducedMotion() === true;
  const [progress, setProgress] = useState({ shown: 0, typing: false });
  const [round, setRound] = useState(0);
  const playing = inView && !reduceMotion;

  useEffect(() => {
    if (!playing) return;

    const { beats, duration } = sceneTimeline(steps);

    const timers = [
      setTimeout(() => setProgress({ shown: 0, typing: false }), 0),
      ...beats.map((beat) =>
        setTimeout(() => setProgress({ shown: beat.shown, typing: beat.typing }), beat.at),
      ),
      setTimeout(() => setRound((value) => value + 1), duration + restartAfterMs),
    ];

    return () => {
      for (const timer of timers) clearTimeout(timer);
    };
  }, [playing, round, steps]);

  return { ref, round, ...(playing ? progress : { shown: steps.length, typing: false }) };
}
