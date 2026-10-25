import { SectionHeading } from "@/components/landing/section-heading";
import { Reveal } from "@/components/motion/reveal";
import { featuredFigure, meetThyaHeading, thyaTraits } from "@/lib/landing/meet-thya";

const bentoSpan = {
  language: "md:col-span-2",
  numbers: "md:col-span-4 md:row-span-2",
  explains: "md:col-span-2",
  "next-step": "md:col-span-3",
  local: "md:col-span-3",
} as const;

function Quote({ text }: { text: string }) {
  return (
    <p className="w-fit max-w-full rounded-bubble rounded-tl-sm bg-bubble-in px-3 py-2 text-chat text-ink shadow-card">
      {text}
    </p>
  );
}

export function MeetThyaBento() {
  return (
    <div className="flex flex-col items-center gap-12">
      <SectionHeading eyebrow="Meet Thya" title={meetThyaHeading.bento} />
      <div className="grid w-full gap-3 md:grid-cols-6">
        {thyaTraits.map((trait, index) => (
          <div key={trait.id} className={bentoSpan[trait.id]}>
            <Reveal delay={index * 0.06} className="h-full">
              <div
                data-featured={trait.id === "numbers"}
                className="flex h-full flex-col justify-between gap-6 rounded-card border border-line bg-surface-muted p-6 data-[featured=true]:bg-brand-soft"
              >
                <div className="flex flex-col gap-2">
                  <h3 className="text-title font-medium">{trait.title}</h3>
                  <p className="text-pretty text-ink-muted">{trait.body}</p>
                </div>
                {trait.id === "numbers" ? (
                  <div className="flex flex-col gap-1">
                    <p className="text-display font-medium text-brand tabular-nums md:text-hero-wide">
                      {featuredFigure.value}
                    </p>
                    <p className="text-caption text-ink-muted">{featuredFigure.caption}</p>
                  </div>
                ) : null}
                <Quote text={trait.quote} />
              </div>
            </Reveal>
          </div>
        ))}
      </div>
    </div>
  );
}

export function MeetThyaRows() {
  return (
    <div className="grid gap-10 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] md:gap-16">
      <div className="md:sticky md:top-24 md:self-start">
        <SectionHeading align="start" eyebrow="Meet Thya" title={meetThyaHeading.rows} />
      </div>
      <ol className="flex flex-col">
        {thyaTraits.map((trait, index) => (
          <li
            key={trait.id}
            className="grid grid-cols-[2.5rem_1fr] gap-4 border-t border-line py-7 last:border-b"
          >
            <span className="font-mono text-label text-ink-muted tabular-nums">
              {String(index + 1).padStart(2, "0")}
            </span>
            <div className="flex flex-col gap-2">
              <h3 className="text-title font-medium">{trait.title}</h3>
              <p className="text-pretty text-ink-muted">{trait.body}</p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

export function MeetThyaQuotes() {
  return (
    <div className="flex flex-col gap-10">
      <SectionHeading align="start" eyebrow="Meet Thya" title={meetThyaHeading.quotes} />
      <ul
        aria-label="What Thya sounds like"
        // oxlint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- scrollable region must be reachable by keyboard
        tabIndex={0}
        className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-4 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none sm:-mx-6 sm:px-6"
      >
        {thyaTraits.map((trait) => (
          <li
            key={trait.id}
            className="flex w-72 shrink-0 snap-start flex-col justify-between gap-8 rounded-card border border-line bg-chat p-5 md:w-80"
          >
            <Quote text={trait.quote} />
            <div className="flex flex-col gap-2">
              <h3 className="text-title font-medium">{trait.title}</h3>
              <p className="text-caption text-pretty text-ink-muted">{trait.body}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
