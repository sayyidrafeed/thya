"use client";

import { Award, Store, TrendingUp } from "lucide-react";
import { AnimatePresence, m } from "motion/react";
import type { ReactNode } from "react";

import { AppIcon } from "@/components/ui/app-icon";
import { useCycle } from "@/hooks/use-cycle";
import { shop } from "@/lib/landing/problem";

function Glyph({ children }: { children: ReactNode }) {
  return (
    <span className="grid size-5 place-items-center rounded-md bg-brand-soft text-brand">
      {children}
    </span>
  );
}

const taskIcons = {
  revenue: (
    <Glyph>
      <TrendingUp aria-hidden="true" className="size-3.5" />
    </Glyph>
  ),
  best: (
    <Glyph>
      <Award aria-hidden="true" className="size-3.5" />
    </Glyph>
  ),
  sheets: <AppIcon app="sheets" size="sm" />,
  email: <AppIcon app="gmail" size="sm" />,
} as const;

function Node({
  icon,
  name,
  role,
  active = false,
}: {
  icon: ReactNode;
  name: string;
  role: string;
  active?: boolean;
}) {
  return (
    <div
      data-active={active}
      className="relative flex items-center gap-2.5 rounded-control border border-line bg-surface py-2 pr-4 pl-2.5 transition-colors duration-300 data-[active=true]:border-brand data-[active=true]:bg-brand-soft"
    >
      {icon}
      <span className="flex flex-col">
        <span className="text-caption font-medium">{name}</span>
        <span className="text-label text-ink-muted">{role}</span>
      </span>
      {active ? (
        <span className="absolute -top-2.5 left-3 rounded-control bg-brand px-2 font-mono text-label text-on-brand">
          Active
        </span>
      ) : null}
    </div>
  );
}

// The owner and the four jobs Thya does for them; one job lights up at a time.
export function ProblemShop() {
  const { index: activeIndex } = useCycle(shop.tasks.length, 2200);
  const active = shop.tasks[activeIndex] ?? shop.tasks[0];

  return (
    <div className="flex h-full flex-col gap-6 rounded-panel border border-line bg-surface-raised p-5 shadow-card md:p-8 lg:p-6">
      <p className="font-mono text-label text-ink-muted uppercase">{shop.title}</p>
      <div className="flex flex-1 flex-col items-center justify-center">
        <Node
          icon={
            <Glyph>
              <Store aria-hidden="true" className="size-3.5" />
            </Glyph>
          }
          name={shop.owner.name}
          role={shop.owner.role}
        />
        <span aria-hidden="true" className="h-6 border-l border-line-strong" />
        <ul className="relative grid w-full grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-4 md:gap-4 md:pt-6 lg:grid-cols-1 lg:gap-3 lg:pt-0">
          <span
            aria-hidden="true"
            className="absolute inset-x-[12.5%] top-0 hidden border-t border-line-strong md:block lg:hidden"
          />
          {shop.tasks.map((task, index) => (
            <li key={task.id} className="relative flex justify-center">
              <span
                aria-hidden="true"
                className="absolute -top-6 left-1/2 hidden h-6 border-l border-line-strong md:block lg:hidden"
              />
              <Node
                icon={taskIcons[task.id]}
                name={task.name}
                role={task.role}
                active={index === activeIndex}
              />
            </li>
          ))}
        </ul>
      </div>
      <div className="grid min-h-6 place-items-center text-caption text-ink-muted" aria-live="off">
        <AnimatePresence mode="wait" initial={false}>
          <m.p
            key={active.id}
            initial={{ opacity: 0, filter: "blur(4px)" }}
            animate={{ opacity: 1, filter: "blur(0px)" }}
            exit={{ opacity: 0, filter: "blur(4px)" }}
            transition={{ duration: 0.25 }}
            className="text-center"
          >
            <span className="font-medium text-ink">{active.name}</span> — {active.doing}
          </m.p>
        </AnimatePresence>
      </div>
    </div>
  );
}
