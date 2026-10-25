"use client";

import { TypingBubble } from "@/components/chat/bubbles";
import { StepBubble } from "@/components/chat/step-bubble";
import { useSceneReplay } from "@/hooks/use-scene-replay";
import type { Scene } from "@/lib/landing/showcase-scenes";

// One use case played as a chat that loops while visible.
export function ScenePlayer({ scene }: { scene: Scene }) {
  const { ref, round, shown, typing } = useSceneReplay(scene.steps);

  return (
    <div
      ref={ref}
      className="flex min-h-0 flex-1 flex-col justify-end gap-2 overflow-hidden text-bubble"
    >
      {scene.steps.slice(0, shown).map((step, index) => (
        // oxlint-disable-next-line react/no-array-index-key -- steps are a fixed script; position is identity
        <StepBubble key={`${round}-${index}`} step={step} />
      ))}
      {typing ? <TypingBubble /> : null}
    </div>
  );
}
