"use client";

import { PhoneMockup } from "@/components/landing/phone-mockup";
import { useFeatureTabs } from "@/hooks/use-feature-tabs";

export function FeatureShowcase() {
  const { tabs, active, select } = useFeatureTabs();

  return (
    <section aria-labelledby="showcase-title" className="bg-surface-muted py-section">
      <div className="mx-auto flex max-w-page flex-col items-center gap-8 px-4">
        <h2 id="showcase-title" className="text-center text-title text-balance">
          Ask in plain words. Get your numbers back.
        </h2>
        <div
          role="tablist"
          aria-label="Example questions"
          className="flex flex-wrap justify-center gap-2"
        >
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              id={`tab-${tab.id}`}
              aria-selected={tab.id === active.id}
              aria-controls="showcase-panel"
              onClick={() => select(tab.id)}
              className="min-h-11 rounded-control bg-surface px-4 text-body text-ink-muted transition-colors hover:text-ink focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none aria-selected:bg-brand aria-selected:text-on-brand"
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div
          id="showcase-panel"
          role="tabpanel"
          aria-labelledby={`tab-${active.id}`}
          className="w-full"
        >
          <PhoneMockup key={active.id} lines={active.lines} />
        </div>
      </div>
    </section>
  );
}
