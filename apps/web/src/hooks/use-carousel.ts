"use client";

import { type RefObject, useEffect, useState } from "react";

// Tracks whether a horizontal scroller can move either way, and pages it by one card.
export function useCarousel(trackRef: RefObject<HTMLElement | null>) {
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(true);

  useEffect(() => {
    const track = trackRef.current;

    if (!track) return;

    const update = () => {
      setCanPrev(track.scrollLeft > 4);
      setCanNext(track.scrollLeft + track.clientWidth < track.scrollWidth - 4);
    };

    update();
    track.addEventListener("scroll", update, { passive: true });

    const resize = new ResizeObserver(update);

    resize.observe(track);

    return () => {
      track.removeEventListener("scroll", update);
      resize.disconnect();
    };
  }, [trackRef]);

  function page(direction: 1 | -1) {
    const track = trackRef.current;
    const card = track?.firstElementChild;

    if (!track || !card) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const step = card.getBoundingClientRect().width + 16;

    track.scrollBy({ left: direction * step, behavior: reduce ? "auto" : "smooth" });
  }

  return { canPrev, canNext, page };
}
