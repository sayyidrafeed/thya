"use client";

import { useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";

const cycleMs = 4200;

// Walks through the hero use cases until the visitor picks one; reduced motion never auto-advances.
export function useUseCaseCycle(count: number) {
  const reduceMotion = useReducedMotion();
  const [activeIndex, setActiveIndex] = useState(0);
  const [pinned, setPinned] = useState(false);

  useEffect(() => {
    if (pinned || reduceMotion === true) return;

    const timer = setInterval(() => setActiveIndex((index) => (index + 1) % count), cycleMs);

    return () => clearInterval(timer);
  }, [count, pinned, reduceMotion]);

  function select(index: number) {
    setPinned(true);
    setActiveIndex(index);
  }

  return { activeIndex, select };
}
