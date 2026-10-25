import { PanelConnector } from "@/components/landing/flow-connector";
import { ProblemEngine } from "@/components/landing/problem-engine";
import { ProblemShop } from "@/components/landing/problem-shop";
import { ProblemSources } from "@/components/landing/problem-sources";
import { Reveal } from "@/components/motion/reveal";

// Shop data → Thya's engine → the owner's jobs, like nalarx.com's intelligence layer. Left to right
// from lg up; stacked below, where three columns would not fit.
export function ProblemDiagram() {
  return (
    <div className="mx-auto grid w-full max-w-4xl grid-cols-1 lg:max-w-none lg:grid-cols-[minmax(0,1fr)_3.5rem_minmax(0,1.1fr)_3.5rem_minmax(0,1fr)]">
      <Reveal className="h-full">
        <ProblemSources />
      </Reveal>
      <PanelConnector delay={0.3} />
      <Reveal className="h-full" delay={0.1}>
        <ProblemEngine />
      </Reveal>
      <PanelConnector delay={0.9} />
      <Reveal className="h-full" delay={0.2}>
        <ProblemShop />
      </Reveal>
    </div>
  );
}
