"use client";

import { PhoneMockup } from "@/components/landing/phone-mockup";
import type { ThreadEntry } from "@/hooks/use-showcase";
import { showcaseScenes } from "@/lib/landing/showcase-scenes";

const groups = [
  { id: "today", title: "Works today", placement: "lg:col-start-1" },
  { id: "next", title: "Coming next", placement: "lg:col-start-3" },
] as const;

export function UseCaseShowcase({
  activeIndex,
  entries,
  onSelect,
}: {
  activeIndex: number;
  entries: ThreadEntry[];
  onSelect: (index: number) => void;
}) {
  const preview = showcaseScenes[activeIndex]?.group === "next";

  return (
    <div className="grid gap-6 rounded-panel border border-line bg-surface-muted p-3 sm:p-5 lg:grid-cols-[1fr_auto_1fr] lg:items-center lg:gap-10 lg:p-10">
      {groups.map((group) => (
        <div key={group.id} className={`${group.placement} flex flex-col gap-2 lg:row-start-1`}>
          <p className="px-4 font-mono text-label text-ink-muted uppercase lg:px-6">
            {group.title}
          </p>
          <div className="grid grid-cols-2 gap-1 lg:grid-cols-1">
            {showcaseScenes.map((scene, index) =>
              scene.group === group.id ? (
                <button
                  key={scene.id}
                  type="button"
                  aria-pressed={index === activeIndex}
                  data-active={index === activeIndex}
                  onClick={() => onSelect(index)}
                  className="group flex min-h-11 flex-col justify-center gap-1 rounded-card border border-transparent px-4 py-3 text-left transition-colors duration-200 hover:bg-surface-raised/60 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none data-[active=true]:border-line data-[active=true]:bg-surface-raised data-[active=true]:shadow-card lg:px-6 lg:py-4"
                >
                  <span className="flex items-center gap-2 text-body font-medium">
                    <span
                      aria-hidden="true"
                      data-group={scene.group}
                      className="size-2 shrink-0 rounded-full bg-line-strong transition-colors group-data-[active=true]:bg-brand data-[group=next]:border data-[group=next]:border-dashed data-[group=next]:border-ink-muted data-[group=next]:bg-transparent"
                    />
                    {scene.label}
                  </span>
                  <span className="hidden text-caption text-pretty text-ink-muted sm:block">
                    {scene.summary}
                  </span>
                </button>
              ) : null,
            )}
          </div>
        </div>
      ))}
      <div className="flex justify-center lg:col-start-2 lg:row-start-1">
        <PhoneMockup entries={entries} preview={preview} />
      </div>
    </div>
  );
}
