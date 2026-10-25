"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { m } from "motion/react";

import { useCycle } from "@/hooks/use-cycle";
import { testimonials, testimonialsHeading } from "@/lib/landing/testimonials";

const avatarTone = [
  "bg-brand-soft text-brand",
  "bg-brand text-on-brand",
  "bg-surface-muted text-ink",
  "bg-ink text-surface",
] as const;

const ease = [0.22, 1, 0.36, 1] as const;

const controlClass =
  "grid size-11 place-items-center rounded-full border border-line bg-surface-raised text-ink transition-colors hover:border-line-strong focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none active:scale-97";

function initials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2);
}

// One story at a time, fading through a blur. Every story is stacked in one grid cell, so the
// card is always as tall as the longest one and switching never moves the page.
export function Testimonials() {
  const { index, select } = useCycle(testimonials.length, 3000);

  const step = (delta: number) =>
    select((index + delta + testimonials.length) % testimonials.length);

  return (
    <section
      aria-labelledby="testimonials-title"
      aria-roledescription="carousel"
      className="mx-auto flex w-full max-w-page flex-col items-center gap-12 px-4 pt-section sm:px-6"
    >
      <div className="flex max-w-prose flex-col items-center gap-4 text-center">
        <p className="font-mono text-label text-brand uppercase">{testimonialsHeading.eyebrow}</p>
        <h2
          id="testimonials-title"
          className="text-display font-medium text-balance md:text-display-wide"
        >
          {testimonialsHeading.title}
        </h2>
      </div>
      <div className="grid w-full max-w-3xl">
        {testimonials.map((item, itemIndex) => {
          const active = itemIndex === index;

          return (
            <m.figure
              key={item.name}
              aria-hidden={!active}
              initial={false}
              animate={
                active
                  ? { opacity: 1, filter: "blur(0px)", y: 0 }
                  : { opacity: 0, filter: "blur(10px)", y: 8 }
              }
              transition={{ duration: 0.6, ease }}
              data-active={active}
              className="col-start-1 row-start-1 flex flex-col items-center gap-8 text-center data-[active=false]:pointer-events-none"
            >
              <blockquote className="text-title text-balance md:text-display">
                “{item.quote}”
              </blockquote>
              <figcaption className="flex items-center gap-3 text-left">
                <span
                  className={`grid size-12 shrink-0 place-items-center rounded-full text-body font-semibold ${avatarTone[itemIndex % avatarTone.length] ?? ""}`}
                >
                  {initials(item.name)}
                </span>
                <span className="flex flex-col">
                  <span className="text-body font-semibold">{item.name}</span>
                  <span className="text-caption text-ink-muted">{item.role}</span>
                </span>
              </figcaption>
            </m.figure>
          );
        })}
      </div>
      <div className="flex items-center gap-4">
        <button
          type="button"
          aria-label="Previous story"
          onClick={() => step(-1)}
          className={controlClass}
        >
          <ChevronLeft aria-hidden="true" className="size-4" />
        </button>
        <div className="flex gap-1">
          {testimonials.map((item, itemIndex) => (
            <button
              key={item.name}
              type="button"
              aria-label={`Story ${itemIndex + 1}: ${item.name}`}
              aria-current={itemIndex === index}
              onClick={() => select(itemIndex)}
              className="group grid size-6 place-items-center focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-line-strong transition-all duration-300 group-aria-[current=true]:w-5 group-aria-[current=true]:bg-ink" />
            </button>
          ))}
        </div>
        <button
          type="button"
          aria-label="Next story"
          onClick={() => step(1)}
          className={controlClass}
        >
          <ChevronRight aria-hidden="true" className="size-4" />
        </button>
      </div>
    </section>
  );
}
