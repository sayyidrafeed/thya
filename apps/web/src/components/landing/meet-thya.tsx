import {
  MeetThyaBento,
  MeetThyaQuotes,
  MeetThyaRows,
} from "@/components/landing/meet-thya-options";

// Temporary: all three layouts render stacked so Rafee can pick one. Delete the other two after.
const options = [
  { id: "a", label: "Option A · Bento", Layout: MeetThyaBento },
  { id: "b", label: "Option B · Numbered rows", Layout: MeetThyaRows },
  { id: "c", label: "Option C · Quote carousel", Layout: MeetThyaQuotes },
] as const;

export function MeetThya() {
  return (
    <section id="meet-thya" aria-label="Meet Thya" className="scroll-mt-16 border-y border-line">
      {options.map(({ id, label, Layout }) => (
        <div key={id} className="border-b border-dashed border-line-strong last:border-b-0">
          <p className="mx-auto w-full max-w-page px-4 pt-6 font-mono text-label text-ink-muted uppercase sm:px-6">
            {label}
          </p>
          <div className="mx-auto w-full max-w-page px-4 pt-10 pb-section sm:px-6">
            <Layout />
          </div>
        </div>
      ))}
    </section>
  );
}
