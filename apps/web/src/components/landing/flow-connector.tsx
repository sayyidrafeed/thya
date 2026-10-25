"use client";

import { useReducedMotion } from "motion/react";

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

// The wire between two diagram panels: down when they stack, across when they sit side by side (lg).
export function PanelConnector({ delay = 0 }: { delay?: number }) {
  return (
    <div aria-hidden="true" className="relative h-16 lg:h-auto">
      <svg className="absolute inset-0 size-full overflow-visible lg:hidden">
        <Wire from={["50%", "0%"]} to={["50%", "100%"]} delay={delay} />
      </svg>
      <svg className="absolute inset-0 hidden size-full overflow-visible lg:block">
        <Wire from={["0%", "50%"]} to={["100%", "50%"]} delay={delay} />
      </svg>
    </div>
  );
}
