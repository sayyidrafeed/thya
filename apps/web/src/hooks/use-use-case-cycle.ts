"use client";

import { useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";

// Walks through a list of items (hero use cases, Meet Thya traits) until the visitor picks one; reduced motion never auto-advances.
export function useUseCaseCycle(count: number, cycleMs = 2200) {
  const reduceMotion = useReducedMotion();
  const [activeIndex, setActiveIndex] = useState(0);
  const [pinned, setPinned] = useState(false);

  useEffect(() => {
    if (pinned || reduceMotion === true) return;

    const timer = setInterval(() => setActiveIndex((index) => (index + 1) % count), cycleMs);

    return () => clearInterval(timer);
  }, [count, cycleMs, pinned, reduceMotion]);

  function select(index: number) {
    setPinned(true);
    setActiveIndex(index);
  }

  return { activeIndex, select };
}
