import type { ReactNode } from "react";

const alignClass = {
  center: "items-center text-center",
  start: "items-start text-left",
} as const;

export function SectionHeading({
  eyebrow,
  title,
  lead,
  align = "center",
}: {
  eyebrow: string;
  title: ReactNode;
  lead?: ReactNode;
  align?: keyof typeof alignClass;
}) {
  return (
    <div className={`flex max-w-prose flex-col gap-4 ${alignClass[align]}`}>
      <p className="font-mono text-label text-brand uppercase">{eyebrow}</p>
      <h2 className="text-display font-medium text-balance md:text-display-wide">{title}</h2>
      {lead ? <p className="text-lead text-pretty text-ink-muted">{lead}</p> : null}
    </div>
  );
}
