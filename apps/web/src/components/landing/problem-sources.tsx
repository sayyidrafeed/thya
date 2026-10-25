import { Calculator, ChevronRight, Plus } from "lucide-react";
import type { ReactNode } from "react";

import { Wire } from "@/components/landing/flow-connector";
import { AppIcon } from "@/components/ui/app-icon";
import { sources } from "@/lib/landing/problem";

const otherIcons = { "Cashier app": Calculator } as const;

const pills: { label: string; icon: ReactNode }[] = [
  ...sources.tiles.map((tile) => ({
    label: tile.label,
    icon: <AppIcon app={tile.app} size="sm" />,
  })),
  ...sources.others.map((label) => {
    const Icon = otherIcons[label];

    return {
      label,
      icon: (
        <span className="grid size-5 place-items-center rounded-md bg-surface-muted text-ink-muted">
          <Icon aria-hidden="true" className="size-3.5" strokeWidth={1.75} />
        </span>
      ),
    };
  }),
  {
    label: sources.more,
    icon: <Plus aria-hidden="true" className="size-4 text-ink-muted" />,
  },
];

// Pills are h-9 with gap-2, so each centre sits at a fixed share of the column height.
const pillRem = 2.25;
const gapRem = 0.5;
const columnRem = pills.length * pillRem + (pills.length - 1) * gapRem;

const rowY = pills.map(
  (_, index) => ((index * (pillRem + gapRem) + pillRem / 2) / columnRem) * 100,
);

const busX = 82;

function SourceWires() {
  const first = rowY[0] ?? 0;
  const last = rowY.at(-1) ?? 100;

  return (
    <div aria-hidden="true" className="relative hidden md:block">
      <svg className="absolute inset-0 size-full overflow-visible">
        {rowY.map((y, index) => (
          <Wire key={y} from={["0%", `${y}%`]} to={[`${busX}%`, `${y}%`]} delay={index * 0.25} />
        ))}
        <Wire from={[`${busX}%`, `${first}%`]} to={[`${busX}%`, `${last}%`]} delay={0.4} />
        <Wire from={[`${busX}%`, "50%"]} to={["100%", "50%"]} delay={1} />
      </svg>
      <ChevronRight className="absolute top-1/2 -right-1.5 size-3 -translate-y-1/2 text-line-strong" />
    </div>
  );
}

const boxClass =
  "rounded-card border border-line bg-surface px-4 py-3 text-center text-caption font-medium";

function Ledger() {
  return (
    <div className="flex flex-col items-stretch justify-center">
      <p className={boxClass}>{sources.ledger.top}</p>
      <span aria-hidden="true" className="mx-auto h-4 border-l border-dashed border-line-strong" />
      <div className="flex flex-col gap-1 rounded-card bg-linear-to-br from-brand-deep to-brand px-4 py-5 text-center text-on-brand shadow-phone">
        <p className="font-mono text-label text-on-brand/70 uppercase">{sources.ledger.eyebrow}</p>
        <p className="text-body font-semibold">{sources.ledger.title}</p>
      </div>
      <span aria-hidden="true" className="mx-auto h-4 border-l border-dashed border-line-strong" />
      <p className={boxClass}>{sources.ledger.bottom}</p>
    </div>
  );
}

// Where a food shop's numbers live today, wired into one ledger Thya reads from.
export function ProblemSources() {
  return (
    <div className="flex flex-col gap-6 rounded-panel border border-line bg-surface-raised p-5 shadow-card md:p-8">
      <p className="font-mono text-label text-ink-muted uppercase">{sources.title}</p>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-[auto_minmax(0,1fr)_14rem] md:gap-0 md:px-6">
        <ul className="flex flex-wrap gap-2 md:flex-col md:flex-nowrap">
          {pills.map((pill) => (
            <li
              key={pill.label}
              className="flex h-9 items-center gap-2 rounded-control border border-line bg-surface pr-3.5 pl-2 text-caption whitespace-nowrap"
            >
              {pill.icon}
              {pill.label}
            </li>
          ))}
        </ul>
        <SourceWires />
        <Ledger />
      </div>
    </div>
  );
}
