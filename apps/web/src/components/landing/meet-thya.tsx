"use client";

import { useState } from "react";

import { MeetThyaCarousel } from "@/components/landing/meet-thya-carousel";
import { MeetThyaSpotlight } from "@/components/landing/meet-thya-spotlight";
import { SectionHeading } from "@/components/landing/section-heading";
import { meetThyaHeading } from "@/lib/landing/meet-thya";

const variants = [
  { id: "carousel", label: "Carousel", Layout: MeetThyaCarousel },
  { id: "spotlight", label: "Spotlight", Layout: MeetThyaSpotlight },
] as const;

// The A/B switcher is for the team review; keep one layout and drop the switcher once picked.
export function MeetThya() {
  const [variantIndex, setVariantIndex] = useState(0);
  const { Layout } = variants[variantIndex] ?? variants[0];

  return (
    <section
      id="meet-thya"
      aria-labelledby="meet-thya-title"
      className="flex scroll-mt-20 flex-col gap-10 overflow-hidden py-section"
    >
      <div className="mx-auto flex w-full max-w-page flex-wrap items-end justify-between gap-6 px-4 sm:px-6">
        <SectionHeading
          align="start"
          eyebrow="Meet Thya"
          title={<span id="meet-thya-title">{meetThyaHeading}</span>}
        />
        <fieldset className="flex gap-1 rounded-control border-0 glass p-1">
          <legend className="sr-only">Meet Thya layout</legend>
          {variants.map((variant, index) => (
            <button
              key={variant.id}
              type="button"
              aria-pressed={index === variantIndex}
              onClick={() => setVariantIndex(index)}
              className="min-h-9 rounded-control px-3 font-mono text-label text-ink-muted transition-colors hover:text-ink focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none aria-pressed:bg-ink aria-pressed:text-surface"
            >
              {String.fromCharCode(65 + index)} · {variant.label}
            </button>
          ))}
        </fieldset>
      </div>
      <Layout />
    </section>
  );
}
