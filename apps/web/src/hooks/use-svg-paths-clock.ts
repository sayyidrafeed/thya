"use client";

import { type RefObject, useEffect } from "react";

const stepMs = 1000 / 30;

// One clock per artwork: rewrites each path's `d` at 30 fps while visible.
// Reduced motion keeps frame 0; off-screen or hidden tabs pause the clock.
export function useSvgPathsClock(
  svgRef: RefObject<SVGSVGElement | null>,
  paths: (seconds: number) => string[],
) {
  useEffect(() => {
    const svg = svgRef.current;

    if (!svg) return;

    const nodes = Array.from(svg.querySelectorAll("path"));
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let elapsed = 0;
    let last = 0;
    let frame = 0;
    let visible = true;

    const draw = () => {
      const next = paths(elapsed / 1000);

      for (const [index, node] of nodes.entries()) node.setAttribute("d", next[index] ?? "");
    };

    const tick = (now: number) => {
      frame = 0;

      if (!visible || document.hidden) return;

      if (now - last >= stepMs) {
        elapsed += last === 0 ? 0 : Math.min(now - last, 100);
        last = now;
        draw();
      }

      frame = requestAnimationFrame(tick);
    };

    const resume = () => {
      if (still || frame || !visible || document.hidden) return;

      last = 0;
      frame = requestAnimationFrame(tick);
    };

    const onScreen = new IntersectionObserver(([entry]) => {
      visible = entry?.isIntersecting ?? true;
      resume();
    });

    draw();
    onScreen.observe(svg);
    document.addEventListener("visibilitychange", resume);

    return () => {
      cancelAnimationFrame(frame);
      onScreen.disconnect();
      document.removeEventListener("visibilitychange", resume);
    };
  }, [svgRef, paths]);
}
