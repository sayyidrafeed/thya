"use client";

import { m } from "motion/react";

import { HeroHeading } from "@/components/landing/hero-heading";
import { UseCaseShowcase } from "@/components/landing/use-case-showcase";
import { useShowcase } from "@/hooks/use-showcase";
import { showcaseScenes } from "@/lib/landing/showcase-scenes";

const ease = [0.22, 1, 0.36, 1] as const;

export function Hero() {
  const { activeIndex, entries, select } = useShowcase(showcaseScenes);

  return (
    <section className="mx-auto flex w-full max-w-page flex-col items-center gap-8 px-4 pt-14 pb-section sm:px-6 md:pt-20">
      <m.p
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease }}
        className="rounded-control border border-line bg-surface-raised px-3 py-1 font-mono text-label text-ink-muted uppercase"
      >
        Prototype · .id DeveloperDay 2026
      </m.p>
      <HeroHeading activeIndex={activeIndex} />
      <m.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6, duration: 0.6, ease }}
        className="flex max-w-prose flex-col items-center gap-6 text-center"
      >
        <p className="text-lead text-pretty text-ink-muted">
          Thya reads your sales records and replies in plain Indonesian: what came in yesterday,
          what sells, what sits, and what to try next. Made for owners who would rather chat than
          open a spreadsheet.
        </p>
        <a
          href="#how-it-works"
          className="inline-flex min-h-11 items-center rounded-control bg-ink px-6 text-body font-medium text-surface transition-colors hover:bg-brand focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none"
        >
          See how it works
        </a>
      </m.div>
      <m.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.8, duration: 0.8, ease }}
        className="mt-6 w-full"
      >
        <UseCaseShowcase activeIndex={activeIndex} entries={entries} onSelect={select} />
      </m.div>
    </section>
  );
}
