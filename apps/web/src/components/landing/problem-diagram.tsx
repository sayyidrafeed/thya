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
import { Reveal } from "@/components/motion/reveal";
import { diagram } from "@/lib/landing/problem";

const sourceIcons = [NotebookPen, Receipt, Calculator, Brain] as const;
const costIcons = [Clock, FileSpreadsheet, Shuffle] as const;
const cardLabel = "font-mono text-label text-ink-muted uppercase";

// Where the numbers live → the questions they should answer → what answering them costs today.
export function ProblemDiagram() {
  return (
    <Reveal className="w-full">
      <div className="grid w-full grid-cols-1 items-stretch md:grid-cols-[minmax(0,1fr)_7rem_minmax(0,1.15fr)_7rem_minmax(0,1fr)]">
        <div className="flex flex-col gap-5 rounded-card border border-line bg-surface-raised p-5 shadow-card">
          <p className={cardLabel}>{diagram.sources.title}</p>
          <ul className="grid grid-cols-2 gap-2">
            {diagram.sources.items.map((label, index) => {
              const Icon = sourceIcons[index] ?? NotebookPen;

              return (
                <li
                  key={label}
                  className="flex flex-col items-center gap-2 rounded-bubble bg-surface-muted px-2 py-4 text-center text-caption"
                >
                  <Icon aria-hidden="true" className="size-5 text-ink-muted" strokeWidth={1.5} />
                  {label}
                </li>
              );
            })}
          </ul>
        </div>
        <FlowConnector label={diagram.connectors[0]} />
        <div className="flex flex-col gap-4 rounded-card bg-ink p-5 text-surface shadow-phone">
          <p className="font-mono text-label text-surface/70 uppercase">
            {diagram.questions.title}
          </p>
          <ul className="flex flex-col gap-2">
            {diagram.questions.items.map((question) => (
              <li
                key={question}
                className="w-fit max-w-full rounded-bubble rounded-tl-sm bg-surface/12 px-3 py-2 text-bubble"
              >
                {question}
              </li>
            ))}
          </ul>
          <p className="mt-auto text-caption text-surface/70">{diagram.questions.footnote}</p>
        </div>
        <FlowConnector label={diagram.connectors[1]} delay={0.9} />
        <div className="flex flex-col gap-5 rounded-card border border-dashed border-line-strong p-5">
          <p className={cardLabel}>{diagram.costs.title}</p>
          <ul className="flex flex-col gap-3">
            {diagram.costs.items.map((label, index) => {
              const Icon = costIcons[index] ?? Clock;

              return (
                <li key={label} className="flex items-start gap-3 text-caption text-ink-muted">
                  <Icon aria-hidden="true" className="mt-0.5 size-4 shrink-0" strokeWidth={1.5} />
                  {label}
                </li>
              );
            })}
          </ul>
        </div>
      </div>
      <div className="mx-auto mt-2 flex w-fit flex-col items-center">
        <span aria-hidden="true" className="h-10 w-px border-l border-dashed border-line-strong" />
        <a
          href="#how-it-works"
          className="rounded-control bg-brand px-4 py-2 font-mono text-label text-on-brand uppercase transition-colors hover:bg-ink focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none"
        >
          {diagram.cta}
        </a>
      </div>
    </Reveal>
  );
}
