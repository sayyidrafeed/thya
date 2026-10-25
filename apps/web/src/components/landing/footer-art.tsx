"use client";

import { useRef } from "react";

import { ThyaMark } from "@/components/ui/thya-mark";
import { useFibreCanvas } from "@/hooks/use-fibre-canvas";
import { footerArts } from "@/lib/footer-art/fibres";

// The team picked Untangle (C) on 2026-10-25.
const art = footerArts.find((item) => item.id === "untangle") ?? footerArts[0];

function FibreCanvas({ build }: { build: (typeof footerArts)[number]["build"] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useFibreCanvas(canvasRef, build);

  return <canvas ref={canvasRef} aria-hidden="true" className="absolute inset-0 -z-10 size-full" />;
}

export function FooterArt() {
  return (
    <div className="relative isolate h-72 overflow-hidden md:h-[30rem]">
      <FibreCanvas build={art.build} />
      <span className="absolute top-1/2 left-1/2 grid size-20 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full glass">
        <ThyaMark size="lg" />
      </span>
      <p className="absolute top-[calc(50%+3.5rem)] left-1/2 -translate-x-1/2 rounded-control bg-surface/80 px-3 py-1 text-caption whitespace-nowrap text-ink-muted backdrop-blur-sm">
        Messy notes in. Clear answers out.
      </p>
    </div>
  );
}
