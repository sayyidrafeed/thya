"use client";

import { useReducedMotion } from "motion/react";
import type { ReactNode } from "react";

type Point = [x: string, y: string];

// A dashed wire with a brand pulse travelling along it. Ends are percentages of the parent svg, so
// the dash stays crisp at any size (a scaled viewBox would stretch it).
export function Wire({ from, to, delay = 0 }: { from: Point; to: Point; delay?: number }) {
  const reduceMotion = useReducedMotion() === true;
  const ends = { x1: from[0], y1: from[1], x2: to[0], y2: to[1] };

  return (
    <>
      <line {...ends} strokeDasharray="4 4" className="stroke-line-strong" />
      {reduceMotion ? null : (
        <line
          {...ends}
          pathLength={100}
          strokeDasharray="18 82"
          strokeLinecap="round"
          strokeWidth={2}
          className="stroke-brand"
        >
          <animate
            attributeName="stroke-dashoffset"
            from="100"
            to="0"
            dur="2s"
            begin={`${delay}s`}
            repeatCount="indefinite"
          />
        </line>
      )}
    </>
  );
}

// The vertical wire between two diagram panels, with optional notes on either side.
export function PanelConnector({
  left,
  right,
  delay = 0,
}: {
  left?: ReactNode;
  right?: ReactNode;
  delay?: number;
}) {
  return (
    <div
      aria-hidden="true"
      className="grid h-20 grid-cols-[minmax(0,1fr)_3rem_minmax(0,1fr)] items-center gap-3 md:h-24"
    >
      <div className="flex justify-end">{left}</div>
      <div className="relative h-full">
        <svg className="absolute inset-0 size-full overflow-visible">
          <Wire from={["50%", "0%"]} to={["50%", "100%"]} delay={delay} />
        </svg>
      </div>
      <div className="flex justify-start">{right}</div>
    </div>
  );
}
