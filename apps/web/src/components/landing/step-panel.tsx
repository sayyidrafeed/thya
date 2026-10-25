"use client";

import { m } from "motion/react";

import { ChatReplay } from "@/components/chat/chat-replay";
import { comingNext, type HowItWorksStep } from "@/lib/landing/how-it-works";
import { mockupConversations } from "@/lib/landing/mockup-conversations";

const ease = [0.22, 1, 0.36, 1] as const;
const appear = { hidden: { opacity: 0, y: 10 }, shown: { opacity: 1, y: 0 } };

function ComingNextList() {
  return (
    <ul className="flex flex-col gap-2">
      {comingNext.map((item) => (
        <m.li
          key={item}
          variants={appear}
          transition={{ duration: 0.4, ease }}
          className="flex items-center justify-between gap-3 rounded-bubble border border-dashed border-line-strong bg-surface/60 px-3 py-3 text-caption"
        >
          {item}
          <span className="shrink-0 font-mono text-label text-ink-muted uppercase">
            In progress
          </span>
        </m.li>
      ))}
    </ul>
  );
}

export function StepPanel({ step }: { step: HowItWorksStep }) {
  const conversation = mockupConversations.find((item) => item.id === step.conversationId);

  return (
    <div className="rounded-panel bg-brand-soft p-3 sm:p-6">
      <div className="flex min-h-96 flex-col gap-3 rounded-card bg-chat p-4 shadow-card">
        <p className="flex items-center gap-2 font-mono text-label text-ink-muted">
          <span aria-hidden="true" className="size-2 rounded-full bg-brand" />
          thya · your agent
        </p>
        {conversation ? (
          <ChatReplay
            question={conversation.question}
            answer={conversation.answer}
            checking={step.checking}
          />
        ) : (
          <m.div
            initial="hidden"
            whileInView="shown"
            viewport={{ once: true, amount: 0.4 }}
            transition={{ staggerChildren: 0.3 }}
          >
            <ComingNextList />
          </m.div>
        )}
      </div>
    </div>
  );
}
