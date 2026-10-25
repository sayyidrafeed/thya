"use client";

import { useState } from "react";

import { MeetThyaCharacter } from "@/components/landing/meet-thya-character";
import { MeetThyaGlossary } from "@/components/landing/meet-thya-glossary";

const variants = [
  { id: "character", label: "Character", Layout: MeetThyaCharacter },
  { id: "glossary", label: "Shop words", Layout: MeetThyaGlossary },
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
      <div className="mx-auto flex w-full max-w-page justify-end px-4 sm:px-6">
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
