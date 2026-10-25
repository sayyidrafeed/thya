"use client";

import { useReducedMotion } from "motion/react";
import { useEffect, useRef } from "react";

import { TypingBubble } from "@/components/chat/bubbles";
import { StepBubble } from "@/components/chat/step-bubble";
import { ChatHeader } from "@/components/landing/phone-mockup";
import { useChainedThread } from "@/hooks/use-chained-thread";
import type { Scene } from "@/lib/landing/showcase-scenes";

// The How it works chat: one thread that grows a use case at a time as the visitor scrolls.
export function ChainedChat({
  scenes,
  activeIndex,
}: {
  scenes: readonly Scene[];
  activeIndex: number;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const threadRef = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion() === true;
  const { upTo, shown, typing } = useChainedThread(rootRef, scenes, activeIndex);

  // Follow the newest message by scrolling the thread itself, never the page.
  useEffect(() => {
    const thread = threadRef.current;

    if (!thread) return;
    thread.scrollTo({ top: thread.scrollHeight, behavior: reduceMotion ? "auto" : "smooth" });
  }, [upTo, shown, typing, reduceMotion]);

  return (
    <div ref={rootRef} className="rounded-panel bg-brand-soft p-2 shadow-card sm:p-4">
      <div className="flex h-80 flex-col overflow-hidden rounded-card bg-chat sm:h-96 md:h-chat">
        <div className="bg-chat-bar pt-3">
          <ChatHeader />
        </div>
        <div
          ref={threadRef}
          role="log"
          aria-live="polite"
          className="no-scrollbar flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto overscroll-contain px-3 py-3 text-bubble *:shrink-0"
        >
          <div className="mt-auto" />
          {scenes.slice(0, upTo + 1).map((scene, index) =>
            scene.steps.slice(0, index === upTo ? shown : undefined).map((step, stepIndex) => (
              // oxlint-disable-next-line react/no-array-index-key -- steps are a fixed script; position is identity
              <StepBubble key={`${scene.id}-${stepIndex}`} step={step} />
            )),
          )}
          {typing ? <TypingBubble /> : null}
        </div>
      </div>
    </div>
  );
}
