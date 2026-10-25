"use client";

import { BookOpen, Calculator, Lightbulb, MapPin, MessageCircle } from "lucide-react";
import { m } from "motion/react";

import { SectionHeading } from "@/components/landing/section-heading";
import { ThyaMark } from "@/components/ui/thya-mark";
import { meetThya, shopWords, thyaTraits } from "@/lib/landing/meet-thya";

const traitIcon = {
  language: MessageCircle,
  numbers: Calculator,
  explains: BookOpen,
  "next-step": Lightbulb,
  local: MapPin,
} as const;

// Where each shop word sits around the mascot (static map; the float is a small idle loop).
const wordPlacement = [
  "top-[14%] left-[8%]",
  "top-[10%] right-[10%]",
  "top-[48%] right-[4%]",
  "bottom-[14%] left-[10%]",
  "bottom-[10%] right-[16%]",
] as const;

// Option A: the character. The mascot breathes in a soft panel with the shop words it answers about.
export function MeetThyaCharacter() {
  return (
    <div className="mx-auto grid w-full max-w-page grid-cols-1 items-center gap-10 px-4 sm:px-6 md:grid-cols-2 md:gap-16">
      <div className="relative grid min-h-96 place-items-center overflow-hidden rounded-panel bg-brand-soft">
        <m.div
          animate={{ y: [0, -8, 0] }}
          transition={{ duration: 4.2, repeat: Infinity, ease: "easeInOut" }}
        >
          <ThyaMark size="xl" />
        </m.div>
        {shopWords.map((word, index) => (
          <m.span
            key={word}
            aria-hidden="true"
            animate={{ y: [0, index % 2 === 0 ? -5 : 5, 0] }}
            transition={{ duration: 3.4 + index * 0.45, repeat: Infinity, ease: "easeInOut" }}
            className={`${wordPlacement[index] ?? ""} absolute rounded-control bg-surface-raised px-3 py-1.5 text-caption font-medium text-ink shadow-card`}
          >
            {word}
          </m.span>
        ))}
      </div>
      <div className="flex flex-col gap-8">
        <SectionHeading
          align="start"
          eyebrow="Meet Thya"
          title={<span id="meet-thya-title">{meetThya.heading}</span>}
          lead={meetThya.lead}
        />
        <ul className="grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2">
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
    </div>
  );
}
