"use client";

import { m } from "motion/react";

import { ThyaBubble, TypingBubble, UserBubble } from "@/components/chat/bubbles";
import { ThyaMark } from "@/components/ui/thya-mark";
import type { ThreadEntry } from "@/hooks/use-chat-thread";
import { mockupConversations } from "@/lib/landing/mockup-conversations";

// A running thread: each entry is one question and Thya's reply; older ones scroll out the top.
export function PhoneMockup({ entries }: { entries: ThreadEntry[] }) {
  return (
    <div className="w-full max-w-phone rounded-phone bg-ink p-2 shadow-phone">
      <div className="overflow-hidden rounded-screen bg-chat">
        <div className="flex items-center gap-3 bg-chat-bar px-4 pt-7 pb-3">
          <span className="grid size-9 place-items-center rounded-full bg-surface-raised shadow-card">
            <ThyaMark />
          </span>
          <div className="leading-tight">
            <p className="text-caption font-semibold">Thya</p>
            <p className="text-label text-ink-muted">Your agent</p>
          </div>
        </div>
        <div className="relative flex h-chat flex-col justify-end gap-2 overflow-hidden px-3 py-4 text-bubble">
          {entries.map((entry) => {
            const conversation = mockupConversations[entry.index] ?? mockupConversations[0];

            return (
              <m.div
                key={entry.key}
                layout="position"
                transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                className="flex shrink-0 flex-col gap-2"
              >
                <UserBubble text={conversation.question} />
                {entry.stage === "typing" ? <TypingBubble /> : null}
                {entry.stage === "answered" ? <ThyaBubble text={conversation.answer} /> : null}
              </m.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
