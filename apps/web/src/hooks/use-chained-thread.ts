"use client";

import { useInView, useReducedMotion } from "motion/react";
import { type RefObject, useEffect, useRef, useState } from "react";

import { sceneTimeline } from "@/lib/landing/scene-timeline";
import type { Scene } from "@/lib/landing/showcase-scenes";

// One running chat for How it works: reaching step N on scroll plays scene N under the scenes
// before it. Scrolling back trims the thread without replaying. Nothing plays until the chat is seen.
export function useChainedThread(
  ref: RefObject<HTMLElement | null>,
  scenes: readonly Scene[],
  activeIndex: number,
) {
  const seen = useInView(ref, { once: true, amount: 0.3 });
  const reduceMotion = useReducedMotion() === true;
  const [played, setPlayed] = useState({ upTo: -1, shown: 0, typing: false });
  const reached = useRef(-1);
  const target = seen ? activeIndex : -1;
  const scene = scenes[target];

  useEffect(() => {
    if (!scene || reduceMotion) return;

    const backward = target <= reached.current;

    const beats = backward
      ? [{ at: 0, shown: scene.steps.length, typing: false }]
      : [{ at: 0, shown: 0, typing: false }, ...sceneTimeline(scene.steps).beats];

    const timers = beats.map((beat) =>
      setTimeout(() => {
        // Marked when the first beat lands, so an effect that is torn down before it (Strict Mode,
        // a fast scroll past) still plays the scene the next time.
        reached.current = target;
        setPlayed({ upTo: target, shown: beat.shown, typing: beat.typing });
      }, beat.at),
    );

    return () => {
      for (const timer of timers) clearTimeout(timer);
    };
  }, [target, scene, reduceMotion]);

  if (reduceMotion) return { upTo: target, shown: scene?.steps.length ?? 0, typing: false };

  return played;
}
