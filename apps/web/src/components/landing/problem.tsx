import {
  Brain,
  Calculator,
  Clock,
  FileSpreadsheet,
  NotebookPen,
  Receipt,
  Shuffle,
} from "lucide-react";

import { FlowConnector } from "@/components/landing/flow-connector";
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
  { label: "Add up receipts by hand at night", Icon: Clock },
  { label: "Copy numbers into a spreadsheet", Icon: FileSpreadsheet },
  { label: "Guess, because the day is over", Icon: Shuffle },
] as const;

const cardLabel = "font-mono text-label text-ink-muted uppercase";

export function Problem() {
  return (
    <section
      aria-labelledby="problem-title"
      className="mx-auto flex w-full max-w-page flex-col items-center gap-16 px-4 py-section sm:px-6"
    >
      <SectionHeading
        eyebrow="The problem"
        title={<span id="problem-title">The numbers are there. The answers aren&apos;t.</span>}
        lead="A small-shop owner is also the cashier, the buyer, and the bookkeeper. The records exist. What's missing is the time to turn them into an answer."
      />
      <Reveal className="w-full">
        <div className="grid w-full items-stretch md:grid-cols-[minmax(0,1fr)_7rem_minmax(0,1.15fr)_7rem_minmax(0,1fr)]">
          <div className="flex flex-col gap-5 rounded-card border border-line bg-surface-raised p-5 shadow-card">
            <p className={cardLabel}>Where the numbers live</p>
            <ul className="grid grid-cols-2 gap-2">
              {sources.map(({ label, Icon }) => (
                <li
                  key={label}
                  className="flex flex-col items-center gap-2 rounded-bubble bg-surface-muted px-2 py-4 text-center text-caption"
                >
                  <Icon aria-hidden="true" className="size-5 text-ink-muted" strokeWidth={1.5} />
                  {label}
                </li>
              ))}
            </ul>
          </div>
          <FlowConnector label="scattered" />
          <div className="flex flex-col gap-4 rounded-card bg-ink p-5 text-surface shadow-phone">
            <p className="font-mono text-label text-surface/70 uppercase">At closing time</p>
            <ul className="flex flex-col gap-2">
              {questions.map((question) => (
                <li
                  key={question}
                  className="w-fit max-w-full rounded-bubble rounded-tl-sm bg-surface/12 px-3 py-2 text-chat"
                >
                  {question}
                </li>
              ))}
            </ul>
            <p className="mt-auto text-caption text-surface/70">Questions every owner asks.</p>
          </div>
          <FlowConnector label="no time" />
          <div className="flex flex-col gap-5 rounded-card border border-dashed border-line-strong p-5">
            <p className={cardLabel}>What it takes today</p>
            <ul className="flex flex-col gap-3">
              {workarounds.map(({ label, Icon }) => (
                <li key={label} className="flex items-start gap-3 text-caption text-ink-muted">
                  <Icon aria-hidden="true" className="mt-0.5 size-4 shrink-0" strokeWidth={1.5} />
                  {label}
                </li>
              ))}
            </ul>
          </div>
        </div>
        <div className="mx-auto mt-2 flex w-fit flex-col items-center">
          <span
            aria-hidden="true"
            className="h-10 w-px border-l border-dashed border-line-strong"
          />
          <a
            href="#how-it-works"
            className="rounded-control bg-brand px-4 py-2 font-mono text-label text-on-brand uppercase transition-colors hover:bg-ink focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none"
          >
            Thya answers these in one chat ↓
          </a>
        </div>
      </Reveal>
    </section>
  );
}
