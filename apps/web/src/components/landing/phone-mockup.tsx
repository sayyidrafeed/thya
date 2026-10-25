"use client";

import { m } from "motion/react";

import { ChatText } from "@/components/chat/chat-text";
import type { MockupConversation } from "@/lib/landing/mockup-conversations";

export function PhoneMockup({ conversation }: { conversation: MockupConversation }) {
  return (
    <div className="w-full max-w-phone rounded-phone bg-ink p-2 shadow-phone">
      <div className="overflow-hidden rounded-screen bg-chat">
        <div className="flex items-center gap-3 bg-chat-bar px-4 pt-7 pb-3">
          <span
            aria-hidden="true"
            className="grid size-9 place-items-center rounded-full bg-brand text-caption font-semibold text-on-brand"
          >
            T
          </span>
          <div className="leading-tight">
            <p className="text-caption font-semibold">Thya</p>
            <p className="text-label text-ink-muted">Sample data · Kopi Senja</p>
          </div>
        </div>
        <div className="relative flex h-chat flex-col justify-end overflow-hidden px-3 py-4 text-chat">
          <m.div
            key={conversation.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            className="flex flex-col gap-2"
          >
            <p className="ml-auto max-w-[85%] rounded-bubble rounded-tr-sm bg-bubble-out px-3 py-2 shadow-card">
              {conversation.question}
            </p>
            <m.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              className="max-w-[92%] rounded-bubble rounded-tl-sm bg-bubble-in px-3 py-2 tabular-nums shadow-card"
            >
              <ChatText text={conversation.answer} />
            </m.div>
          </m.div>
        </div>
      </div>
    </div>
  );
}
