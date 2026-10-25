"use client";

import { Check } from "lucide-react";

import { SectionHeading } from "@/components/landing/section-heading";
import { PlaygroundPhone } from "@/components/playground/playground-phone";
import { usePlayground } from "@/hooks/use-playground";
import { playgroundActs } from "@/lib/playground/flows";

const act = playgroundActs[0];
const beats = act?.beats ?? [];

// Try Thya by hand: pick a message, Thya replies. Every reply is scripted, so nothing can fail live.
export function Playground() {
  const playground = usePlayground(beats);
  const { played, chips, choose } = playground;
  const current = played.at(-1);

  return (
    <section
      id="playground"
      aria-labelledby="playground-title"
      className="mx-auto grid w-full max-w-page scroll-mt-20 grid-cols-1 items-center gap-12 px-4 py-section sm:px-6 md:grid-cols-2 md:gap-16"
    >
      <div className="flex flex-col gap-10">
        <SectionHeading
          align="start"
          eyebrow="Playground"
          title={<span id="playground-title">Try it yourself.</span>}
          lead="It's closing time at Kopi Senja, a sample coffee shop. Pick a message and see how Thya answers."
        />
        <div className="hidden flex-col gap-4 md:flex">
          <p className="font-mono text-label text-ink-muted uppercase">{act?.title}</p>
          <ol className="flex flex-col">
            {beats.map((beat, index) => {
              const done = played.includes(beat.id);
              const state = beat.id === current ? "current" : done ? "done" : "next";
              const available = chips.some((chip) => chip.id === beat.id);

              return (
                <li key={beat.id} className="border-l border-line">
                  <button
                    type="button"
                    disabled={!available}
                    onClick={() => choose(beat.id)}
                    data-state={state}
                    className="group -ml-px flex min-h-11 w-full items-center gap-3 border-l-2 border-transparent py-2 pl-4 text-left text-ink-muted transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none enabled:cursor-pointer enabled:hover:text-ink data-[state=current]:border-brand data-[state=current]:text-ink"
                  >
                    <span className="grid size-6 shrink-0 place-items-center rounded-full border border-line font-mono text-label tabular-nums group-data-[state=current]:border-brand group-data-[state=current]:bg-brand group-data-[state=current]:text-on-brand group-data-[state=done]:border-brand group-data-[state=done]:bg-brand group-data-[state=done]:text-on-brand">
                      {done ? <Check aria-hidden="true" className="size-3.5" /> : index + 1}
                    </span>
                    <span className="text-body">{beat.rail}</span>
                  </button>
                </li>
              );
            })}
          </ol>
        </div>
      </div>
      <div className="flex justify-center">
        <PlaygroundPhone beats={beats} playground={playground} />
      </div>
    </section>
  );
}
