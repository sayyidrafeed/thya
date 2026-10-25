"use client";

import { useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";

// Steps through `length` items on a fixed beat; a manual pick restarts the beat. Reduced motion stays put.
export function useCycle(length: number, intervalMs: number) {
  const [index, setIndex] = useState(0);
  const reduceMotion = useReducedMotion() === true;

  useEffect(() => {
    if (reduceMotion || length < 2) return;
    const id = setTimeout(() => setIndex((index + 1) % length), intervalMs);

    return () => clearTimeout(id);
  }, [index, length, intervalMs, reduceMotion]);

  return { index, select: setIndex };
}
