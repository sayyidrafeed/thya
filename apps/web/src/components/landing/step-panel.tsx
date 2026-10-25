"use client";

import { StepBubble } from "@/components/chat/step-bubble";
import type { HowItWorksStep } from "@/lib/landing/how-it-works";
import { showcaseScenes } from "@/lib/landing/showcase-scenes";

// The finished chat for one use case. It stays still: the live chat is the Playground's job (D1 in
// docs/landing-demo-plan.md). On desktop panels swap in one sticky slot, so the height is fixed there;
// on phones each panel sits in the flow and never changes, so it fits its chat.
export function StepPanel({ step }: { step: HowItWorksStep }) {
  const scene = showcaseScenes.find((item) => item.id === step.sceneId);

  if (!scene) return null;

  return (
    <div className="rounded-panel bg-brand-soft p-3 sm:p-6">
      <div className="flex flex-col gap-3 overflow-hidden rounded-card bg-chat p-4 shadow-card md:h-chat">
        <p className="flex items-center gap-2 font-mono text-label text-ink-muted">
          <span aria-hidden="true" className="size-2 rounded-full bg-brand" />
          thya · your agent
        </p>
        <div className="flex min-h-0 flex-1 flex-col justify-end gap-2 overflow-hidden text-bubble *:shrink-0">
          {scene.steps.map((step, index) => (
            // oxlint-disable-next-line react/no-array-index-key -- steps are a fixed script; position is identity
            <StepBubble key={index} step={step} />
          ))}
        </div>
      </div>
    </div>
  );
}
