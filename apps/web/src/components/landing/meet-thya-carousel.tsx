"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useRef } from "react";

import { ChatReplay } from "@/components/chat/chat-replay";
import { useCarousel } from "@/hooks/use-carousel";
import { thyaTraits } from "@/lib/landing/meet-thya";

const controlClass =
  "glass grid size-11 place-items-center rounded-full text-ink transition duration-200 active:scale-95 disabled:opacity-35 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none";

// Option A: a snap carousel; every card carries a real exchange that replays while visible.
export function MeetThyaCarousel() {
  const trackRef = useRef<HTMLUListElement>(null);
  const { canPrev, canNext, page } = useCarousel(trackRef);

  return (
    <div className="flex flex-col gap-6">
      <div className="mx-auto hidden w-full max-w-page justify-end gap-2 px-4 sm:flex sm:px-6">
        <button
          type="button"
          aria-label="Previous"
          disabled={!canPrev}
          onClick={() => page(-1)}
          className={controlClass}
        >
          <ChevronLeft aria-hidden="true" className="size-5" />
        </button>
        <button
          type="button"
          aria-label="Next"
          disabled={!canNext}
          onClick={() => page(1)}
          className={controlClass}
        >
          <ChevronRight aria-hidden="true" className="size-5" />
        </button>
      </div>
      <ul
        ref={trackRef}
        aria-label="What Thya sounds like"
        className="no-scrollbar flex snap-x snap-mandatory scroll-px-gutter gap-4 overflow-x-auto px-gutter pb-6"
      >
        {thyaTraits.map((trait) => (
          <li
            key={trait.id}
            className="flex w-[min(84vw,24rem)] shrink-0 snap-start flex-col gap-5 rounded-panel bg-surface-muted p-5 transition duration-300 ease-out-soft hover:-translate-y-1 hover:shadow-card sm:p-6"
          >
            <div className="flex h-56 flex-col rounded-card bg-chat p-3">
              <ChatReplay question={trait.ask} answer={trait.reply} />
            </div>
            <div className="flex flex-col gap-1.5 px-1">
              <h3 className="text-title font-semibold text-balance">{trait.title}</h3>
              <p className="text-caption text-pretty text-ink-muted">{trait.body}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
