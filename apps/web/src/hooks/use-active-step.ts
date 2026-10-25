"use client";

import { type RefObject, useEffect, useState } from "react";

// The step whose block crosses the middle band of the viewport is the active one.
export function useActiveStep(listRef: RefObject<HTMLElement | null>) {
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const items = Array.from(listRef.current?.children ?? []);

    if (items.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActiveIndex(items.indexOf(entry.target));
        }
      },
      { rootMargin: "-45% 0px -45% 0px" },
    );

    for (const item of items) observer.observe(item);

    return () => observer.disconnect();
  }, [listRef]);

  return activeIndex;
}
