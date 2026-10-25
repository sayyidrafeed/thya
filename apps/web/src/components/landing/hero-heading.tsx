"use client";

import { m } from "motion/react";
import { Fragment } from "react";

import { firstUserLine, showcaseScenes } from "@/lib/landing/showcase-scenes";

const ease = [0.22, 1, 0.36, 1] as const;
const leadWords = ["Ask", "how", "your", "shop", "did", "today."];

function questionOffset(index: number, activeIndex: number) {
  if (index === activeIndex) return "0%";

  const previous = (activeIndex - 1 + showcaseScenes.length) % showcaseScenes.length;

  return index === previous ? "-100%" : "100%";
}

export function HeroHeading({ activeIndex }: { activeIndex: number }) {
  return (
    <div className="flex flex-col items-center gap-6 text-center">
      <h1 className="text-hero font-medium text-balance md:text-hero-wide">
        <span className="block">
          {leadWords.map((word, index) => (
            <Fragment key={word}>
              {index > 0 && " "}
              <m.span
                initial={{ opacity: 0, y: "0.4em" }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.06 * index, duration: 0.7, ease }}
                className="inline-block"
              >
                {word}
              </m.span>
            </Fragment>
          ))}
        </span>
        <m.span
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.45, duration: 0.6 }}
          className="block text-ink-muted"
        >
          Get the answer in a chat.
        </m.span>
      </h1>
      <m.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6, duration: 0.6 }}
        className="grid max-w-prose overflow-hidden text-title font-medium text-brand md:text-display"
      >
        {showcaseScenes.map((scene, index) => (
          <m.span
            key={scene.id}
            aria-hidden={index !== activeIndex}
            initial={false}
            animate={{
              y: questionOffset(index, activeIndex),
              opacity: index === activeIndex ? 1 : 0,
            }}
            transition={{ duration: 0.55, ease }}
            className="col-start-1 row-start-1 text-balance"
          >
            “{firstUserLine(scene)}”
          </m.span>
        ))}
      </m.p>
    </div>
  );
}
