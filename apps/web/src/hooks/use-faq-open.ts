"use client";

import { useReducedMotion } from "motion/react";
import { useState } from "react";

// Which FAQ rows are open. Rows toggle independently so owners can compare answers.
export function useFaqOpen(initiallyOpen: readonly number[] = [0]) {
  const [open, setOpen] = useState<ReadonlySet<number>>(() => new Set(initiallyOpen));
  const reduceMotion = useReducedMotion() ?? false;

  function toggle(index: number) {
    setOpen((current) => {
      const next = new Set(current);

      if (next.has(index)) next.delete(index);
      else next.add(index);

      return next;
    });
  }

  return { isOpen: (index: number) => open.has(index), toggle, reduceMotion };
}
