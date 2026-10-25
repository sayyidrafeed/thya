"use client";

import { ChartColumn, FileSpreadsheet, Link2, Mail } from "lucide-react";
import { m } from "motion/react";
import type { ReactNode } from "react";

import { ThyaBubble, UserBubble } from "@/components/chat/bubbles";
import { ChartBars } from "@/components/chat/chart-bars";
import type { ChatStep } from "@/lib/landing/showcase-scenes";

const ease = [0.22, 1, 0.36, 1] as const;

function Card({ side, children }: { side: "user" | "thya"; children: ReactNode }) {
  return (
    <m.div
      initial={{ opacity: 0, y: 10, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.32, ease }}
      data-side={side}
      className="w-[85%] overflow-hidden rounded-bubble bg-bubble-in text-ink shadow-card data-[side=thya]:origin-bottom-left data-[side=thya]:rounded-tl-sm data-[side=user]:ml-auto data-[side=user]:origin-bottom-right data-[side=user]:rounded-tr-sm data-[side=user]:bg-bubble-out"
    >
      {children}
    </m.div>
  );
}

function CardHead({ icon, title, meta }: { icon: ReactNode; title: string; meta: string }) {
  return (
    <div className="flex items-center gap-2.5 px-3 py-2.5">
      <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-surface-muted text-brand">
        {icon}
      </span>
      <span className="flex min-w-0 flex-col leading-tight">
        <span className="truncate font-semibold">{title}</span>
        <span className="truncate text-label text-ink-muted">{meta}</span>
      </span>
    </div>
  );
}

// One chat step: plain text bubbles for talk, cards for links and the results of an action.
export function StepBubble({ step }: { step: ChatStep }) {
  switch (step.kind) {
    case "text":
      return step.from === "user" ? (
        <UserBubble text={step.text} />
      ) : (
        <ThyaBubble text={step.text} />
      );
    case "link":
      return (
        <Card side="user">
          <CardHead icon={<Link2 className="size-4" />} title={step.title} meta={step.url} />
        </Card>
      );
    case "sheet":
      return (
        <Card side="thya">
          <CardHead
            icon={<FileSpreadsheet className="size-4" />}
            title="Sheet updated"
            meta={step.title}
          />
          <table className="w-full border-t border-line text-label tabular-nums">
            <tbody>
              {step.rows.map(([date, value]) => (
                <tr key={date} className="border-b border-line last:border-0">
                  <td className="px-3 py-1.5 text-ink-muted">{date}</td>
                  <td className="px-3 py-1.5 text-right font-medium">{value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      );
    case "email":
      return (
        <Card side="thya">
          <CardHead icon={<Mail className="size-4" />} title={step.subject} meta={step.status} />
        </Card>
      );
    case "chart":
      return (
        <Card side="thya">
          <CardHead icon={<ChartColumn className="size-4" />} title={step.title} meta={step.meta} />
          <ChartBars bars={step.bars} caption={step.caption} />
        </Card>
      );
  }
}
