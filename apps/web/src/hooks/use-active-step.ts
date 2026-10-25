"use client";

import { type RefObject, useEffect, useState } from "react";

// The step whose block crosses the reading band is the active one. The band sits below the middle
// because on phones the chat is pinned over the top half of the screen.
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
      { rootMargin: "-62% 0px -33% 0px" },
    );

    for (const item of items) observer.observe(item);

    return () => observer.disconnect();
  }, [listRef]);

  return activeIndex;
}
