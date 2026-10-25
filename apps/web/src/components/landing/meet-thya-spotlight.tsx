"use client";

import { AnimatePresence, m } from "motion/react";

import { ChatReplay } from "@/components/chat/chat-replay";
import { ThyaMark } from "@/components/ui/thya-mark";
import { useUseCaseCycle } from "@/hooks/use-use-case-cycle";
import { thyaTraits } from "@/lib/landing/meet-thya";

const ease = [0.22, 1, 0.36, 1] as const;

// Option B: an Apple-style feature list. The active trait opens; the chat beside it replays its exchange.
export function MeetThyaSpotlight() {
  const { activeIndex, select } = useUseCaseCycle(thyaTraits.length, 5200);
  const active = thyaTraits[activeIndex] ?? thyaTraits[0];

  return (
    <div className="mx-auto grid w-full max-w-page items-center gap-10 px-4 sm:px-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] md:gap-16">
      <ul className="flex flex-col">
        {thyaTraits.map((trait, index) => (
          <li key={trait.id} className="border-b border-line first:border-t">
            <button
              type="button"
              aria-expanded={index === activeIndex}
              data-active={index === activeIndex}
              onClick={() => select(index)}
              className="group flex min-h-14 w-full flex-col items-start gap-2 py-4 text-left focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              <span className="text-title font-medium text-ink-muted transition-colors duration-300 group-hover:text-ink group-data-[active=true]:text-ink">
                {trait.title}
              </span>
              <AnimatePresence initial={false}>
                {index === activeIndex ? (
                  <m.span
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.35, ease }}
                    className="overflow-hidden text-pretty text-ink-muted"
                  >
                    {trait.body}
                  </m.span>
                ) : null}
              </AnimatePresence>
            </button>
          </li>
        ))}
      </ul>
      <div className="rounded-panel bg-brand-soft p-3 sm:p-6">
        <div className="flex h-96 flex-col gap-3 rounded-card bg-chat p-4 shadow-card">
          <p className="flex items-center gap-2 text-caption font-semibold">
            <ThyaMark />
            Thya
          </p>
          <AnimatePresence mode="wait" initial={false}>
            <m.div
              key={active.id}
              initial={{ opacity: 0, filter: "blur(6px)" }}
              animate={{ opacity: 1, filter: "blur(0px)" }}
              exit={{ opacity: 0, filter: "blur(6px)" }}
              transition={{ duration: 0.3, ease }}
              className="flex flex-1 flex-col"
            >
              <ChatReplay question={active.ask} answer={active.reply} />
            </m.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
