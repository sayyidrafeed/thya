"use client";

import { BookOpen, Calculator, Lightbulb, MapPin, MessageCircle, Plug } from "lucide-react";
import { m } from "motion/react";

import { SectionHeading } from "@/components/landing/section-heading";
import { AppIcon } from "@/components/ui/app-icon";
import { ThyaMark } from "@/components/ui/thya-mark";
import { mascotApps, meetThya, thyaTraits } from "@/lib/landing/meet-thya";

const traitIcon = {
  language: MessageCircle,
  apps: Plug,
  numbers: Calculator,
  explains: BookOpen,
  "next-step": Lightbulb,
  local: MapPin,
} as const;

// Where each app tile sits around the mascot (static map; the float is a small idle loop).
const appPlacement = [
  "top-[12%] left-[10%]",
  "top-[8%] right-[14%]",
  "top-[44%] right-[6%]",
  "bottom-[12%] right-[16%]",
  "bottom-[10%] left-[14%]",
] as const;

// The mascot breathes in a soft panel, surrounded by the apps it reads the shop's numbers from.
export function MeetThya() {
  return (
    <section
      id="meet-thya"
      aria-labelledby="meet-thya-title"
      className="mx-auto grid w-full max-w-page scroll-mt-20 grid-cols-1 items-center gap-10 px-4 py-section sm:px-6 md:grid-cols-2 md:gap-16"
    >
      <div className="relative grid min-h-96 place-items-center overflow-hidden rounded-panel bg-brand-soft">
        <m.div
          animate={{ y: [0, -8, 0] }}
          transition={{ duration: 4.2, repeat: Infinity, ease: "easeInOut" }}
        >
          <ThyaMark size="xl" />
        </m.div>
        {mascotApps.map((app, index) => (
          <m.span
            key={app}
            aria-hidden="true"
            animate={{ y: [0, index % 2 === 0 ? -6 : 6, 0] }}
            transition={{ duration: 3.4 + index * 0.45, repeat: Infinity, ease: "easeInOut" }}
            className={`${appPlacement[index] ?? ""} absolute rounded-card bg-surface-raised p-1.5 shadow-card`}
          >
            <AppIcon app={app} />
          </m.span>
        ))}
      </div>
      <div className="order-first flex flex-col gap-8 md:order-none">
        <SectionHeading
          align="start"
          eyebrow="Meet Thya"
          title={<span id="meet-thya-title">{meetThya.heading}</span>}
          lead={meetThya.lead}
        />
        <ul className="grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2 md:grid-cols-1 lg:grid-cols-2">
          {thyaTraits.map((trait) => {
            const Icon = traitIcon[trait.id];

            return (
              <li key={trait.id} className="flex gap-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-surface-muted text-brand">
                  <Icon aria-hidden="true" className="size-4" strokeWidth={1.75} />
                </span>
                <div className="flex flex-col gap-0.5">
                  <h3 className="text-body font-semibold">{trait.title}</h3>
                  <p className="text-caption text-pretty text-ink-muted">{trait.body}</p>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
