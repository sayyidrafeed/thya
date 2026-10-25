import { Languages, ShieldCheck } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { PanelConnector } from "@/components/landing/flow-connector";
import { ProblemEngine } from "@/components/landing/problem-engine";
import { ProblemShop } from "@/components/landing/problem-shop";
import { ProblemSources } from "@/components/landing/problem-sources";
import { Reveal } from "@/components/motion/reveal";
import { engine } from "@/lib/landing/problem";

const sideIcons: Record<(typeof engine.sides)[number]["id"], LucideIcon> = {
  trust: ShieldCheck,
  learn: Languages,
};

function SideNote({
  side,
  align,
}: {
  side: (typeof engine.sides)[number];
  align: "start" | "end";
}) {
  const Icon = sideIcons[side.id];

  return (
    <span
      data-align={align}
      className="flex items-center gap-3 text-label text-ink-muted data-[align=end]:flex-row-reverse data-[align=end]:text-right"
    >
      <span className="grid size-9 shrink-0 place-items-center rounded-bubble border border-line bg-surface-raised">
        <Icon className="size-4 text-ink" />
      </span>
      <span className="hidden flex-col sm:flex">
        {side.lines.map((line) => (
          <span key={line}>{line}</span>
        ))}
      </span>
    </span>
  );
}

// Shop data → Thya's engine → the owner's jobs, laid out like nalarx.com's intelligence layer.
export function ProblemDiagram() {
  const [trust, learn] = engine.sides;

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col">
      <Reveal>
        <ProblemSources />
      </Reveal>
      <PanelConnector delay={0.3} />
      <Reveal>
        <ProblemEngine />
      </Reveal>
      <PanelConnector
        delay={0.9}
        left={<SideNote side={trust} align="end" />}
        right={<SideNote side={learn} align="start" />}
      />
      <Reveal>
        <ProblemShop />
      </Reveal>
    </div>
  );
}
