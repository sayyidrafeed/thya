"use client";

import { m } from "motion/react";

import { ChatText } from "@/components/chat/chat-text";

const ease = [0.22, 1, 0.36, 1] as const;

const enter = {
  initial: { opacity: 0, y: 10, scale: 0.97 },
  animate: { opacity: 1, y: 0, scale: 1 },
  transition: { duration: 0.32, ease },
} as const;

export function UserBubble({ text }: { text: string }) {
  return (
    <m.p
      {...enter}
      className="ml-auto max-w-[85%] origin-bottom-right rounded-bubble rounded-tr-sm bg-bubble-out px-3 py-2 text-ink shadow-card"
    >
      {text}
    </m.p>
  );
}

export function ThyaBubble({ text }: { text: string }) {
  return (
    <m.div
      {...enter}
      className="max-w-[92%] origin-bottom-left rounded-bubble rounded-tl-sm bg-bubble-in px-3 py-2 text-ink tabular-nums shadow-card"
    >
      <ChatText text={text} />
    </m.div>
  );
}

export function TypingBubble({ label = "Thya is typing" }: { label?: string }) {
  return (
    <m.div
      {...enter}
      className="flex w-fit origin-bottom-left gap-1 rounded-bubble rounded-tl-sm bg-bubble-in px-3 py-3 shadow-card"
    >
      <span className="sr-only">{label}</span>
      {[0, 1, 2].map((dot) => (
        <m.span
          key={dot}
          aria-hidden="true"
          animate={{ opacity: [0.3, 1, 0.3], y: [0, -2, 0] }}
          transition={{ duration: 0.9, repeat: Infinity, delay: dot * 0.15, ease: "easeInOut" }}
          className="size-1.5 rounded-full bg-ink-muted"
        />
      ))}
    </m.div>
  );
}
