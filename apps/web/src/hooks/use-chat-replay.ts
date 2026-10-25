"use client";

import { useInView, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";

import type { ThreadStage } from "@/hooks/use-chat-thread";

const beats: [ThreadStage, number][] = [
  ["asked", 0],
  ["typing", 450],
  ["answered", 1500],
];

const loopMs = 7000;

// Replays one exchange (ask → Thya typing → answer) on a loop while the panel is on screen.
export function useChatReplay() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { amount: 0.4 });
  const reduceMotion = useReducedMotion();
  const [stage, setStage] = useState<ThreadStage>("asked");
  const [round, setRound] = useState(0);
  const playing = inView && reduceMotion !== true;

  useEffect(() => {
    if (!playing) return;

    const timers = beats.map(([next, at]) => setTimeout(() => setStage(next), at));
    const again = setTimeout(() => setRound((value) => value + 1), loopMs);

    return () => {
      for (const timer of timers) clearTimeout(timer);
      clearTimeout(again);
    };
  }, [playing, round]);

  return { ref, stage: playing ? stage : "answered", round };
}
