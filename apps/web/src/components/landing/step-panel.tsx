"use client";

import { ScenePlayer } from "@/components/chat/scene-player";
import type { HowItWorksStep } from "@/lib/landing/how-it-works";
import { showcaseScenes } from "@/lib/landing/showcase-scenes";

// The chat for one use case, replaying while it is on screen.
export function StepPanel({ step }: { step: HowItWorksStep }) {
  const scene = showcaseScenes.find((item) => item.id === step.sceneId);

  if (!scene) return null;

  return (
    <div className="rounded-panel bg-brand-soft p-3 sm:p-6">
      <div className="flex min-h-96 flex-col gap-3 rounded-card bg-chat p-4 shadow-card">
        <p className="flex items-center gap-2 font-mono text-label text-ink-muted">
          <span aria-hidden="true" className="size-2 rounded-full bg-brand" />
          thya · your agent
        </p>
        <ScenePlayer scene={scene} />
      </div>
    </div>
  );
}
