import { Brain, Calculator, NotebookPen, Receipt } from "lucide-react";

import { SectionHeading } from "@/components/landing/section-heading";
import { Reveal } from "@/components/motion/reveal";

const sources = [
  { label: "Notebook", Icon: NotebookPen },
  { label: "Receipts", Icon: Receipt },
  { label: "Cashier app", Icon: Calculator },
  { label: "Memory", Icon: Brain },
] as const;

const questions = [
  "Did we make money today?",
  "Which menu should I stop making?",
  "Was the promo worth it?",
] as const;

const workarounds = [
  "Add up receipts by hand at night",
  "Copy numbers into a spreadsheet",
  "Guess, because there's no time left",
] as const;

function Connector({ label }: { label: string }) {
  return (
    <div aria-hidden="true" className="flex items-center justify-center md:flex-col">
      <span className="h-8 w-px border-l border-dashed border-line-strong md:h-px md:w-full md:border-t md:border-l-0" />
      <span className="shrink-0 rounded-control border border-line bg-surface px-2 py-0.5 font-mono text-label text-ink-muted">
        {label}
      </span>
      <span className="h-8 w-px border-l border-dashed border-line-strong md:h-px md:w-full md:border-t md:border-l-0" />
    </div>
  );
}

export function Problem() {
  return (
    <section
      aria-labelledby="problem-title"
      className="mx-auto flex w-full max-w-page flex-col items-center gap-14 px-4 py-section sm:px-6"
    >
      <SectionHeading
        eyebrow="The problem"
        title={<span id="problem-title">The numbers are there. The answers aren&apos;t.</span>}
        lead="A small-shop owner is also the cashier, the buyer, and the bookkeeper. The records exist. What's missing is the time to turn them into an answer."
      />
      <Reveal className="w-full">
        <div className="grid items-center gap-2 md:grid-cols-[1fr_6rem_1.1fr_6rem_1fr]">
          <div className="flex flex-col gap-4 rounded-card border border-line bg-surface-raised p-5">
            <p className="font-mono text-label text-ink-muted uppercase">Where the numbers live</p>
            <ul className="grid grid-cols-2 gap-2">
              {sources.map(({ label, Icon }) => (
                <li
                  key={label}
                  className="flex items-center gap-2 rounded-bubble border border-line px-3 py-2 text-caption"
                >
                  <Icon aria-hidden="true" className="size-4 text-ink-muted" />
                  {label}
                </li>
              ))}
            </ul>
          </div>
          <Connector label="scattered" />
          <div className="flex flex-col gap-3 rounded-card bg-ink p-5 text-surface">
            <p className="font-mono text-label text-surface/70 uppercase">
              The owner, at closing time
            </p>
            <ul className="flex flex-col gap-2">
              {questions.map((question) => (
                <li
                  key={question}
                  className="w-fit rounded-bubble bg-surface/10 px-3 py-2 text-chat"
                >
                  {question}
                </li>
              ))}
            </ul>
          </div>
          <Connector label="no time" />
          <div className="flex flex-col gap-4 rounded-card border border-dashed border-line-strong p-5">
            <p className="font-mono text-label text-ink-muted uppercase">What it takes today</p>
            <ul className="flex flex-col gap-2 text-caption text-ink-muted">
              {workarounds.map((item) => (
                <li key={item} className="flex gap-2">
                  <span aria-hidden="true">–</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Reveal>
    </section>
  );
}
