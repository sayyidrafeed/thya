"use client";

import { m } from "motion/react";

import { TypingBubble } from "@/components/chat/bubbles";
import { StepBubble } from "@/components/chat/step-bubble";
import { DeviceFrame } from "@/components/landing/device-frame";
import { ThyaMark } from "@/components/ui/thya-mark";
import type { ThreadEntry } from "@/hooks/use-showcase";
import { showcaseScenes } from "@/lib/landing/showcase-scenes";

// A running thread inside the phone; older scenes scroll out the top.
export function PhoneMockup({ entries }: { entries: ThreadEntry[] }) {
  return (
    <DeviceFrame>
      <div className="flex items-center gap-3 border-b border-line bg-chat-bar px-4 pb-3">
        <span className="grid size-9 place-items-center rounded-full bg-surface-raised shadow-card">
          <ThyaMark />
        </span>
        <div className="flex-1 leading-tight">
          <p className="text-caption font-semibold">Thya</p>
          <p className="text-label text-ink-muted">Your agent</p>
        </div>
      </div>
      <div className="relative flex h-chat flex-col justify-end gap-2 overflow-hidden px-3 py-3 text-bubble">
        {entries.map((entry) => {
          const scene = showcaseScenes[entry.scene];

          if (!scene) return null;

          return (
            <m.div
              key={entry.key}
              layout="position"
              transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
              className="flex shrink-0 flex-col gap-2"
            >
              {scene.steps.slice(0, entry.shown).map((step, index) => (
                // oxlint-disable-next-line react/no-array-index-key -- steps are a fixed script; position is identity
                <StepBubble key={index} step={step} />
              ))}
              {entry.typing ? <TypingBubble /> : null}
            </m.div>
          );
        })}
      </div>
    </DeviceFrame>
  );
}
