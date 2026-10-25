import { ProblemDiagram } from "@/components/landing/problem-diagram";
import { SectionHeading } from "@/components/landing/section-heading";
import { problemHeading } from "@/lib/landing/problem";

export function Problem() {
  return (
    <section
      aria-labelledby="problem-title"
      className="mx-auto flex w-full max-w-page flex-col items-center gap-16 px-4 py-section sm:px-6"
    >
      <SectionHeading
        eyebrow="The problem"
        title={<span id="problem-title">{problemHeading.title}</span>}
        lead={problemHeading.lead}
      />
      <ProblemDiagram />
    </section>
  );
}
