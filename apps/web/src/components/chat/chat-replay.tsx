"use client";

import { m } from "motion/react";

import { ThyaBubble, TypingBubble, UserBubble } from "@/components/chat/bubbles";
import { useChatReplay } from "@/hooks/use-chat-replay";

// One exchange that replays while on screen: the owner asks, Thya types (and checks), Thya answers.
export function ChatReplay({
  question,
  answer,
  checking = false,
}: {
  question: string;
  answer: string;
  checking?: boolean;
}) {
  const { ref, stage, round } = useChatReplay();

  return (
    <div ref={ref} className="flex flex-1 flex-col justify-end gap-2 text-bubble">
      <UserBubble key={round} text={question} />
      {stage === "typing" && checking ? (
        <m.p
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-fit rounded-control border border-line bg-surface px-3 py-1 font-mono text-label text-ink-muted"
        >
          Checking sales records…
        </m.p>
      ) : null}
      {stage === "typing" ? <TypingBubble /> : null}
      {stage === "answered" ? <ThyaBubble text={answer} /> : null}
    </div>
  );
}
