"use client";

import { useRef } from "react";

import { useAsciiField } from "@/hooks/use-ascii-field";
import type { AsciiPattern } from "@/lib/ascii/flow-field";

export function AsciiField({ pattern }: { pattern: AsciiPattern }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useAsciiField(canvasRef, pattern.intensity);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 size-full font-mono"
    />
  );
}
