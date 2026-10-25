"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useRef } from "react";

import { SectionHeading } from "@/components/landing/section-heading";
import { useCarousel } from "@/hooks/use-carousel";
import { meetThyaHeading, thyaTraits } from "@/lib/landing/meet-thya";

const controlClass =
  "glass grid size-11 place-items-center rounded-full text-ink transition duration-200 active:scale-95 disabled:opacity-35 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none";

export function MeetThya() {
  const trackRef = useRef<HTMLUListElement>(null);
  const { canPrev, canNext, page } = useCarousel(trackRef);

  return (
    <section
      id="meet-thya"
      aria-labelledby="meet-thya-title"
      className="scroll-mt-20 overflow-hidden py-section"
    >
      <div className="mx-auto flex w-full max-w-page items-end justify-between gap-6 px-4 sm:px-6">
        <SectionHeading
          align="start"
          eyebrow="Meet Thya"
          title={<span id="meet-thya-title">{meetThyaHeading.quotes}</span>}
        />
        <div className="hidden shrink-0 gap-2 sm:flex">
          <button
            type="button"
            aria-label="Previous"
            disabled={!canPrev}
            onClick={() => page(-1)}
            className={controlClass}
          >
            <ChevronLeft aria-hidden="true" className="size-5" />
          </button>
          <button
            type="button"
            aria-label="Next"
            disabled={!canNext}
            onClick={() => page(1)}
            className={controlClass}
          >
            <ChevronRight aria-hidden="true" className="size-5" />
          </button>
        </div>
      </div>
      <ul
        ref={trackRef}
        aria-label="What Thya sounds like"
        className="mt-12 no-scrollbar flex snap-x snap-mandatory scroll-px-gutter gap-4 overflow-x-auto px-gutter pb-6"
      >
        {thyaTraits.map((trait, index) => (
          <li
            key={trait.id}
            className="flex min-h-96 w-[min(82vw,22rem)] shrink-0 snap-start flex-col rounded-panel bg-surface-muted p-7 sm:p-8"
          >
            <p className="font-mono text-label text-ink-muted tabular-nums">
              {String(index + 1).padStart(2, "0")}
            </p>
            <h3 className="mt-3 text-title font-semibold text-balance">{trait.title}</h3>
            <p className="mt-2 text-caption text-pretty text-ink-muted">{trait.body}</p>
            <div className="mt-auto rounded-card bg-chat p-3">
              <p className="w-fit max-w-full rounded-bubble rounded-tl-sm bg-bubble-in px-3 py-2 text-chat text-ink shadow-card">
                {trait.quote}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
