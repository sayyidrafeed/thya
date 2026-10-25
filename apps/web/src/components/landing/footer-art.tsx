"use client";

import { useRef, useState } from "react";

import { ThyaMark } from "@/components/ui/thya-mark";
import { useFibreCanvas } from "@/hooks/use-fibre-canvas";
import { footerArts } from "@/lib/footer-art/fibres";

const captions = {
  converge: "Many records in. One answer out.",
  radiate: "One question. Answers for the whole shop.",
  untangle: "Messy notes in. Clear answers out.",
} as const;

function FibreCanvas({ build }: { build: (typeof footerArts)[number]["build"] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useFibreCanvas(canvasRef, build);

  return <canvas ref={canvasRef} aria-hidden="true" className="absolute inset-0 -z-10 size-full" />;
}

// The A/B/C switcher is for the team review; keep one artwork and drop the switcher once picked.
export function FooterArt() {
  const [artIndex, setArtIndex] = useState(0);
  const art = footerArts[artIndex] ?? footerArts[0];

  return (
    <div className="relative isolate h-72 overflow-hidden md:h-[30rem]">
      <FibreCanvas key={art.id} build={art.build} />
      <span className="absolute top-1/2 left-1/2 grid size-20 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full glass">
        <ThyaMark size="lg" />
      </span>
      <p className="absolute top-[calc(50%+3.5rem)] left-1/2 -translate-x-1/2 rounded-control bg-surface/80 px-3 py-1 text-caption whitespace-nowrap text-ink-muted backdrop-blur-sm">
        {captions[art.id]}
      </p>
      <fieldset className="absolute top-4 right-4 flex gap-1 rounded-control border-0 glass p-1">
        <legend className="sr-only">Footer art</legend>
        {footerArts.map((item, index) => (
          <button
            key={item.id}
            type="button"
            aria-pressed={index === artIndex}
            onClick={() => setArtIndex(index)}
            className="min-h-9 rounded-control px-3 font-mono text-label text-ink-muted transition-colors hover:text-ink focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none aria-pressed:bg-ink aria-pressed:text-surface"
          >
            {String.fromCharCode(65 + index)}
            <span className="hidden sm:inline"> · {item.label}</span>
          </button>
        ))}
      </fieldset>
    </div>
  );
}
