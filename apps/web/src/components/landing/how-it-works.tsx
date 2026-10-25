"use client";

import { useRef } from "react";

import { ChainedChat } from "@/components/landing/chained-chat";
import { SectionHeading } from "@/components/landing/section-heading";
import { useActiveStep } from "@/hooks/use-active-step";
import { howItWorksHeading, howItWorksSteps } from "@/lib/landing/how-it-works";
import { showcaseScenes } from "@/lib/landing/showcase-scenes";

const scenes = howItWorksSteps.flatMap((step) =>
  showcaseScenes.filter((scene) => scene.id === step.sceneId),
);

// Mireye-style scroll story: the step in the reading band is sharp, the rest blur, and the chat
// beside it (pinned above the steps on phones) gains that step's messages as it becomes active.
export function HowItWorks() {
  const listRef = useRef<HTMLOListElement>(null);
  const activeIndex = useActiveStep(listRef);

  return (
    <section
      id="how-it-works"
      aria-labelledby="how-it-works-title"
      className="mx-auto flex w-full max-w-page scroll-mt-20 flex-col gap-12 px-4 py-section sm:px-6"
    >
      <SectionHeading
        align="start"
        eyebrow="How it works"
        title={<span id="how-it-works-title">{howItWorksHeading}</span>}
      />
      <div className="grid grid-cols-1 gap-8 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] md:gap-16">
        <div className="sticky top-16 z-10 -mx-4 self-start bg-surface px-4 pt-3 pb-4 sm:-mx-6 sm:px-6 md:top-[calc(50vh-15rem)] md:order-last md:mx-0 md:bg-transparent md:p-0">
          <ChainedChat scenes={scenes} activeIndex={activeIndex} />
        </div>
        <ol ref={listRef} className="flex flex-col">
          {howItWorksSteps.map((step, index) => (
            <li
              key={step.sceneId}
              data-active={index === activeIndex}
              className="flex min-h-[60svh] flex-col justify-center gap-4 transition duration-500 ease-out-soft data-[active=false]:opacity-30 data-[active=false]:blur-xs motion-reduce:transition-none md:min-h-[70vh]"
            >
              <p className="font-mono text-label text-ink-muted tabular-nums">
                {String(index + 1).padStart(2, "0")}
              </p>
              <h3 className="text-title font-medium text-balance md:text-display">{step.title}</h3>
              <p className="text-pretty text-ink-muted">{step.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
