import { SectionHeading } from "@/components/landing/section-heading";
import { StepPanel } from "@/components/landing/step-panel";
import { howItWorksSteps } from "@/lib/landing/how-it-works";

export function HowItWorks() {
  return (
    <section
      id="how-it-works"
      aria-label="How it works"
      className="mx-auto flex w-full max-w-page scroll-mt-16 flex-col gap-16 px-4 py-section sm:px-6"
    >
      <SectionHeading
        align="start"
        eyebrow="How it works"
        title="One question in, one clear answer out."
      />
      <ol className="flex flex-col gap-20 md:gap-28">
        {howItWorksSteps.map((step, index) => (
          <li
            key={step.id}
            className="grid items-center gap-8 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] md:gap-16"
          >
            <div className="flex flex-col gap-4">
              <p className="flex items-center gap-3 font-mono text-label text-ink-muted">
                <span className="tabular-nums">{String(index + 1).padStart(2, "0")}</span>
                <span
                  data-upcoming={step.conversationId === null}
                  className="rounded-control bg-surface-muted px-2 py-0.5 text-ink uppercase data-[upcoming=true]:border data-[upcoming=true]:border-dashed data-[upcoming=true]:border-line-strong data-[upcoming=true]:bg-transparent"
                >
                  {step.tag}
                </span>
              </p>
              <h3 className="text-title font-medium text-balance md:text-display">{step.title}</h3>
              <p className="text-pretty text-ink-muted">{step.body}</p>
            </div>
            <StepPanel step={step} />
          </li>
        ))}
      </ol>
    </section>
  );
}
