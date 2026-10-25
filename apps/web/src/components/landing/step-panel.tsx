"use client";

import { m } from "motion/react";

import { ChatText } from "@/components/chat/chat-text";
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
      <m.div
        initial="hidden"
        whileInView="shown"
        viewport={{ once: true, amount: 0.4 }}
        transition={{ staggerChildren: 0.45 }}
        className="flex min-h-80 flex-col gap-3 rounded-card bg-chat p-4 shadow-card"
      >
        <p className="flex items-center gap-2 font-mono text-label text-ink-muted">
          <span aria-hidden="true" className="size-2 rounded-full bg-brand" />
          thya · sample data: kopi senja
        </p>
        {conversation ? (
          <>
            <m.p
              variants={appear}
              transition={{ duration: 0.4, ease }}
              className="ml-auto max-w-[85%] rounded-bubble rounded-tr-sm bg-bubble-out px-3 py-2 text-bubble shadow-card"
            >
              {conversation.question}
            </m.p>
            {step.checking ? (
              <m.p
                variants={appear}
                transition={{ duration: 0.4, ease }}
                className="w-fit rounded-control border border-line bg-surface px-3 py-1 font-mono text-label text-ink-muted"
              >
                Checking sales records…
              </m.p>
            ) : null}
            <m.div
              variants={appear}
              transition={{ duration: 0.4, ease }}
              className="max-w-[92%] rounded-bubble rounded-tl-sm bg-bubble-in px-3 py-2 text-bubble tabular-nums shadow-card"
            >
              <ChatText text={conversation.answer} />
            </m.div>
          </>
        ) : (
          <ComingNextList />
        )}
      </m.div>
    </div>
  );
}
