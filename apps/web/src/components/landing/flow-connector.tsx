"use client";

import { ChevronDown, ChevronRight } from "lucide-react";
import { useReducedMotion } from "motion/react";

function Wire({ vertical, delay }: { vertical: boolean; delay: number }) {
  const reduceMotion = useReducedMotion() === true;
  const [x1, y1, x2, y2] = vertical ? ["50%", "0", "50%", "100%"] : ["0", "50%", "100%", "50%"];

  return (
    <>
      <line x1={x1} y1={y1} x2={x2} y2={y2} strokeDasharray="4 4" className="stroke-line-strong" />
      {reduceMotion ? null : (
        <line
          x1={x1}
          y1={y1}
          x2={x2}
          y2={y2}
          pathLength={100}
          strokeDasharray="22 78"
          strokeLinecap="round"
          strokeWidth={2}
          className="stroke-brand"
        >
          <animate
            attributeName="stroke-dashoffset"
            from="100"
            to="0"
            dur="1.8s"
            begin={`${delay}s`}
            repeatCount="indefinite"
          />
        </line>
      )}
    </>
  );
}

// Dashed wire with a travelling pulse and a label; horizontal from md up, vertical below.
export function FlowConnector({ label, delay = 0 }: { label: string; delay?: number }) {
  return (
    <div aria-hidden="true" className="relative flex h-16 items-center justify-center lg:h-auto">
      <svg className="absolute inset-0 size-full overflow-visible lg:hidden">
        <Wire vertical delay={delay} />
      </svg>
      <svg className="absolute inset-0 hidden size-full overflow-visible lg:block">
        <Wire vertical={false} delay={delay} />
      </svg>
      <span className="relative flex items-center gap-1 rounded-control border border-line bg-surface px-2.5 py-1 font-mono text-label text-ink-muted">
        {label}
        <ChevronDown className="size-3 lg:hidden" />
        <ChevronRight className="hidden size-3 lg:block" />
      </span>
    </div>
  );
}
