"use client";

import { useRef } from "react";

import { useAsciiField } from "@/hooks/use-ascii-field";

export function AsciiField() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useAsciiField(canvasRef);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 size-full font-mono"
    />
  );
}
