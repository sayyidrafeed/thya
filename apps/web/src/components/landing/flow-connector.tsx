import { ChevronDown, ChevronRight } from "lucide-react";

// Dashed wire with a travelling dash and a label, horizontal from md up, vertical below.
export function FlowConnector({ label }: { label: string }) {
  return (
    <div aria-hidden="true" className="relative flex h-16 items-center justify-center md:h-auto">
      <svg
        className="absolute inset-0 size-full overflow-visible text-line-strong"
        preserveAspectRatio="none"
      >
        <line
          x1="50%"
          y1="0"
          x2="50%"
          y2="100%"
          stroke="currentColor"
          strokeDasharray="4 4"
          className="motion-safe:animate-dash-flow md:hidden"
        />
        <line
          x1="0"
          y1="50%"
          x2="100%"
          y2="50%"
          stroke="currentColor"
          strokeDasharray="4 4"
          className="hidden motion-safe:animate-dash-flow md:block"
        />
      </svg>
      <span className="relative flex items-center gap-1 rounded-control border border-line bg-surface px-2.5 py-1 font-mono text-label text-ink-muted">
        {label}
        <ChevronDown className="size-3 md:hidden" />
        <ChevronRight className="hidden size-3 md:block" />
      </span>
    </div>
  );
}
