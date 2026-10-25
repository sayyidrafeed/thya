import { BookOpen, Calculator, Languages, MessageCircle, ShieldCheck } from "lucide-react";

import { ThyaMark } from "@/components/ui/thya-mark";
import { engine } from "@/lib/landing/problem";

const rowIcons = {
  words: BookOpen,
  code: Calculator,
  plain: MessageCircle,
  checked: ShieldCheck,
} as const;

const sideIcons = { trust: ShieldCheck, learn: Languages } as const;

// The brand panel with Thya's engine card in the middle, like nalarx's core engine.
export function ProblemEngine() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-6 rounded-panel bg-linear-to-br from-brand-deep via-brand to-brand-leaf px-4 py-12 md:py-20 lg:py-12">
      <div className="w-full max-w-sm overflow-hidden rounded-card bg-ink text-surface shadow-phone">
        <div className="flex items-center justify-between gap-3 border-b border-surface/10 px-4 py-3">
          <span className="flex items-center gap-2 text-body font-semibold">
            <ThyaMark size="sm" />
            Thya
          </span>
          <span className="text-caption text-surface/70">{engine.title}</span>
        </div>
        <ul className="divide-y divide-surface/10">
          {engine.rows.map((row) => {
            const Icon = rowIcons[row.id];

            return (
              <li key={row.id} className="flex items-start gap-3 px-4 py-3">
                <Icon aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-surface/60" />
                <div className="flex flex-col">
                  <span className="text-caption font-medium">{row.title}</span>
                  <span className="text-label text-surface/60">{row.body}</span>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
      <ul className="flex flex-wrap justify-center gap-2">
        {engine.sides.map((side) => {
          const Icon = sideIcons[side.id];

          return (
            <li
              key={side.id}
              className="flex items-center gap-2 rounded-control bg-surface/12 px-3 py-1.5 text-label text-on-brand"
            >
              <Icon aria-hidden="true" className="size-3.5" />
              {side.lines.join(" · ")}
            </li>
          );
        })}
      </ul>
      <p className="max-w-xs text-center text-caption text-pretty text-on-brand/85">
        {engine.caption}
      </p>
    </div>
  );
}
