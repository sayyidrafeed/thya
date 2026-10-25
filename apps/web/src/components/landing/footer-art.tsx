"use client";

import { useRef } from "react";

import { ThyaMark } from "@/components/ui/thya-mark";
import { useConvergenceCanvas } from "@/hooks/use-convergence-canvas";

// Scattered sales records (fibres) flowing into one answer (the mark at the focus point).
export function FooterArt() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useConvergenceCanvas(canvasRef);

  return (
    <div className="relative isolate h-96 overflow-hidden md:h-[30rem]">
      <canvas ref={canvasRef} aria-hidden="true" className="absolute inset-0 -z-10 size-full" />
      <span className="absolute top-1/2 left-1/2 grid size-20 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full glass">
        <ThyaMark size="lg" />
      </span>
      <p className="absolute top-[calc(50%+3.5rem)] left-1/2 -translate-x-1/2 rounded-control bg-surface/80 px-3 py-1 text-caption whitespace-nowrap text-ink-muted backdrop-blur-sm">
        Many records in. One answer out.
      </p>
    </div>
  );
}
