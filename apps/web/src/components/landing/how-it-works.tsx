"use client";

import { AnimatePresence, m } from "motion/react";
import { useRef } from "react";

import { SectionHeading } from "@/components/landing/section-heading";
import { StepPanel } from "@/components/landing/step-panel";
import { useActiveStep } from "@/hooks/use-active-step";
import { howItWorksHeading, howItWorksSteps } from "@/lib/landing/how-it-works";

const ease = [0.22, 1, 0.36, 1] as const;

export function HowItWorks() {
  const listRef = useRef<HTMLOListElement>(null);
  const activeIndex = useActiveStep(listRef);
  const active = howItWorksSteps[activeIndex] ?? howItWorksSteps[0];

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
      <div className="grid gap-16 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <ol ref={listRef} className="flex flex-col gap-16 md:gap-0">
          {howItWorksSteps.map((step, index) => (
            <li
              key={step.sceneId}
              data-active={index === activeIndex}
              className="flex flex-col gap-8 transition duration-500 ease-out-soft motion-reduce:transition-none md:min-h-[70vh] md:justify-center md:data-[active=false]:opacity-30 md:data-[active=false]:blur-xs"
            >
              <div className="flex flex-col gap-4">
                <p className="flex items-center gap-3 font-mono text-label text-ink-muted">
                  <span className="tabular-nums">{String(index + 1).padStart(2, "0")}</span>
                </p>
                <h3 className="text-title font-medium text-balance md:text-display">
                  {step.title}
                </h3>
                <p className="text-pretty text-ink-muted">{step.body}</p>
              </div>
              <div className="md:hidden">
                <StepPanel step={step} />
              </div>
            </li>
          ))}
        </ol>
        <div className="hidden md:block">
          <div className="sticky top-[calc(50vh-15rem)]">
            <AnimatePresence mode="popLayout" initial={false}>
              <m.div
                key={active.sceneId}
                initial={{ opacity: 0, y: 32, filter: "blur(10px)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                exit={{ opacity: 0, y: -32, filter: "blur(10px)" }}
                transition={{ duration: 0.6, ease }}
              >
                <StepPanel step={active} />
              </m.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </section>
  );
}
