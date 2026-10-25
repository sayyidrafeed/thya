import { SectionHeading } from "@/components/landing/section-heading";
import { ThyaMark } from "@/components/ui/thya-mark";
import { Reveal } from "@/components/motion/reveal";
import { glossary, meetThya } from "@/lib/landing/meet-thya";

// Option B: Thya through the words it uses. Each card is a shop term, its meaning, and Thya's line.
export function MeetThyaGlossary() {
  return (
    <div className="mx-auto flex w-full max-w-page flex-col gap-12 px-4 sm:px-6">
      <div className="flex items-end gap-5">
        <span className="hidden shrink-0 sm:block">
          <ThyaMark size="lg" />
        </span>
        <SectionHeading
          align="start"
          eyebrow="Meet Thya"
          title={<span id="meet-thya-title">{meetThya.glossaryHeading}</span>}
          lead={meetThya.glossaryLead}
        />
      </div>
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {glossary.map((entry, index) => (
          <li key={entry.term}>
            <Reveal delay={index * 0.06} className="h-full">
              <div className="flex h-full flex-col gap-4 rounded-panel bg-surface-muted p-6 sm:p-8">
                <h3 className="text-display font-medium text-balance">{entry.term}</h3>
                <div className="flex flex-1 flex-col justify-between gap-6">
                  <p className="text-pretty text-ink-muted">{entry.meaning}</p>
                  <p className="flex items-start gap-2 text-caption text-ink">
                    <span className="mt-0.5 shrink-0">
                      <ThyaMark />
                    </span>
                    <span className="rounded-bubble rounded-tl-sm bg-surface-raised px-3 py-2 shadow-card">
                      {entry.example}
                    </span>
                  </p>
                </div>
              </div>
            </Reveal>
          </li>
        ))}
      </ul>
    </div>
  );
}
