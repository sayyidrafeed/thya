"use client";

import { ArrowUpRight } from "lucide-react";

import { AsciiField } from "@/components/landing/ascii-field";
import { asciiPatterns } from "@/lib/ascii/flow-field";

// The team picked the flow pattern (A) on 2026-10-25.
const pattern = asciiPatterns.find((item) => item.id === "flow") ?? asciiPatterns[0];

export function DeveloperDayCta() {
  return (
    <section
      id="developerday"
      aria-labelledby="developerday-title"
      className="relative isolate flex min-h-[34rem] scroll-mt-20 flex-col items-center justify-center gap-6 overflow-hidden border-t border-line px-4 py-24"
    >
      <AsciiField pattern={pattern} />
      <div className="flex max-w-lg flex-col items-center gap-5 rounded-panel glass px-6 py-10 text-center sm:px-12">
        <p className="font-mono text-label text-brand uppercase">Built for .id DeveloperDay 2026</p>
        <h2 id="developerday-title" className="text-display font-medium text-balance">
          Made in Indonesia, for the shops that keep it running.
        </h2>
        <p className="text-caption text-pretty text-ink-muted">
          Thya is our entry to .id DeveloperDay 2026 by PANDI, on the road to APICTA. The answers on
          this page come from our prototype, using sample data.
        </p>
        <a
          href="https://developerday.id"
          target="_blank"
          rel="noreferrer"
          className="inline-flex min-h-11 items-center gap-1.5 rounded-control bg-ink px-5 text-caption font-medium text-surface transition duration-150 hover:bg-brand focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none active:scale-97"
        >
          Visit developerday.id
          <ArrowUpRight aria-hidden="true" className="size-4" />
        </a>
      </div>
    </section>
  );
}
