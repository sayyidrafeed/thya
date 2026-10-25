"use client";

import { RotateCcw } from "lucide-react";
import { useReducedMotion } from "motion/react";
import { useEffect, useRef } from "react";

import { TypingBubble } from "@/components/chat/bubbles";
import { StepBubble } from "@/components/chat/step-bubble";
import { DeviceFrame } from "@/components/landing/device-frame";
import { ChatHeader } from "@/components/landing/phone-mockup";
import type { usePlayground } from "@/hooks/use-playground";
import { type PlaygroundBeat, playgroundGreeting } from "@/lib/playground/flows";

type Playground = ReturnType<typeof usePlayground>;

const chipClass =
  "flex min-h-11 w-full items-center rounded-control border border-brand/30 bg-surface-raised px-4 text-left text-caption font-medium text-brand transition duration-150 hover:bg-brand-soft focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none active:scale-97";

function Thread({
  beats,
  playground,
}: {
  beats: readonly PlaygroundBeat[];
  playground: Playground;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion() === true;
  const { played, shown, typing, chips, finished } = playground;

  // Keep the newest message in view by scrolling the thread itself, never the page.
  useEffect(() => {
    const element = ref.current;

    if (!element) return;
    element.scrollTo({ top: element.scrollHeight, behavior: reduceMotion ? "auto" : "smooth" });
  }, [played.length, shown, typing, chips.length, finished, reduceMotion]);

  return (
    <div
      ref={ref}
      role="log"
      aria-live="polite"
      className="no-scrollbar flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto overscroll-contain px-3 py-3 text-bubble *:shrink-0"
    >
      <div className="mt-auto" />
      <StepBubble step={playgroundGreeting} />
      {played.map((id, index) => {
        const beat = beats.find((item) => item.id === id);
        const last = index === played.length - 1;

        return beat?.steps.slice(0, last ? shown : undefined).map((step, stepIndex) => (
          // oxlint-disable-next-line react/no-array-index-key -- steps are a fixed script; position is identity
          <StepBubble key={`${id}-${stepIndex}`} step={step} />
        ));
      })}
      {typing ? <TypingBubble /> : null}
    </div>
  );
}

// The phone the visitor drives: the thread, quick replies in a fixed slot, and a read-only input.
export function PlaygroundPhone({
  beats,
  playground,
}: {
  beats: readonly PlaygroundBeat[];
  playground: Playground;
}) {
  const { chips, finished, choose, restart } = playground;

  return (
    <DeviceFrame>
      <ChatHeader />
      <div className="flex h-chat flex-col">
        <Thread beats={beats} playground={playground} />
        <div className="flex flex-col gap-2 px-3 pb-2">
          {chips.map((beat) => (
            <button
              key={beat.id}
              type="button"
              onClick={() => choose(beat.id)}
              className={chipClass}
            >
              {beat.chip}
            </button>
          ))}
          {finished ? (
            <button type="button" onClick={restart} className={`${chipClass} gap-2`}>
              <RotateCcw aria-hidden="true" className="size-4" />
              Mulai ulang
            </button>
          ) : null}
        </div>
      </div>
      <div className="px-3 pb-1">
        <p className="rounded-control bg-surface-raised px-4 py-2.5 text-caption text-ink-muted">
          Pilih pesan di atas
        </p>
      </div>
    </DeviceFrame>
  );
}
