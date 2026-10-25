"use client";

import { useRef, useState } from "react";

import { useSvgPathsClock } from "@/hooks/use-svg-paths-clock";
import { artBox, footerArts } from "@/lib/footer-art/patterns";

function ArtCanvas({ artIndex }: { artIndex: number }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const art = footerArts[artIndex] ?? footerArts[0];

  useSvgPathsClock(svgRef, art.paths);

  return (
    <svg
      ref={svgRef}
      aria-hidden="true"
      viewBox={`0 0 ${artBox.width} ${artBox.height}`}
      preserveAspectRatio="xMidYMax slice"
      className="pointer-events-none absolute inset-0 size-full text-brand"
    >
      {art.paths(0).map((d, index) => (
        <path
          // oxlint-disable-next-line react/no-array-index-key -- paths are positional; index is their identity
          key={index}
          d={d}
          fill="none"
          stroke="currentColor"
          strokeWidth={1}
          strokeOpacity={art.opacity(index)}
          vectorEffect="non-scaling-stroke"
        />
      ))}
    </svg>
  );
}

// The A/B/C switcher is for the team review; keep one art and drop the switcher once picked.
export function FooterArt() {
  const [artIndex, setArtIndex] = useState(0);

  return (
    <div className="relative h-96 overflow-hidden md:h-[30rem]">
      <ArtCanvas key={artIndex} artIndex={artIndex} />
      <fieldset className="absolute top-4 right-4 flex gap-1 rounded-control border-0 glass p-1">
        <legend className="sr-only">Footer art</legend>
        {footerArts.map((art, index) => (
          <button
            key={art.id}
            type="button"
            aria-pressed={index === artIndex}
            onClick={() => setArtIndex(index)}
            className="min-h-9 rounded-control px-3 font-mono text-label text-ink-muted transition-colors hover:text-ink focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none aria-pressed:bg-ink aria-pressed:text-surface"
          >
            {String.fromCharCode(65 + index)}
            <span className="hidden sm:inline"> · {art.label}</span>
          </button>
        ))}
      </fieldset>
      <p
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 -bottom-[0.1em] text-center text-wordmark font-semibold text-ink select-none md:text-wordmark-md xl:text-wordmark-xl"
      >
        Thya
      </p>
    </div>
  );
}
