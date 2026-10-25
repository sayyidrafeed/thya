"use client";

import { PhoneMockup } from "@/components/landing/phone-mockup";
import type { ThreadEntry } from "@/hooks/use-chat-thread";
import { mockupConversations } from "@/lib/landing/mockup-conversations";

const placementClass = [
  "lg:col-start-1 lg:row-start-1",
  "lg:col-start-1 lg:row-start-2",
  "lg:col-start-3 lg:row-start-1",
  "lg:col-start-3 lg:row-start-2",
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
  return (
    <div className="grid grid-cols-2 gap-3 rounded-panel border border-line bg-surface-muted p-3 sm:p-5 lg:grid-cols-[1fr_auto_1fr] lg:grid-rows-2 lg:gap-x-10 lg:gap-y-6 lg:p-10">
      {mockupConversations.map((conversation, index) => (
        <button
          key={conversation.id}
          type="button"
          aria-pressed={index === activeIndex}
          data-active={index === activeIndex}
          onClick={() => onSelect(index)}
          className={`${placementClass[index] ?? ""} group flex min-h-11 flex-col justify-center gap-1 self-center rounded-card border border-transparent px-4 py-3 text-left transition-colors duration-200 hover:bg-surface-raised/60 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none data-[active=true]:border-line data-[active=true]:bg-surface-raised data-[active=true]:shadow-card lg:px-6 lg:py-5`}
        >
          <span className="flex items-center gap-2 text-body font-medium">
            <span
              aria-hidden="true"
              className="size-2 rounded-full bg-line-strong transition-colors group-data-[active=true]:bg-brand"
            />
            {conversation.label}
          </span>
          <span className="hidden text-caption text-pretty text-ink-muted sm:block">
            {conversation.summary}
          </span>
        </button>
      ))}
      <div className="col-span-2 flex justify-center pt-3 lg:col-span-1 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:pt-0">
        <PhoneMockup entries={entries} />
      </div>
    </div>
  );
}
