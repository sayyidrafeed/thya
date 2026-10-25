"use client";

import { useEffect, useState } from "react";

export function useScrolledPast(offset: number) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const update = () => setScrolled(window.scrollY > offset);

    update();
    window.addEventListener("scroll", update, { passive: true });

    return () => window.removeEventListener("scroll", update);
  }, [offset]);

  return scrolled;
}
