import type { UIMessage } from "ai";
import { z } from "zod";
import { CONCEPT_IDS, type ConceptId } from "./concepts";
import { findTerm } from "./terms";

// How well one business knows each concept. Owner: docs/semantic-education.md §3.2.
// Stage 1 (no DB) replays these events from the chat history; stage 2 stores them in Postgres.
export type ConceptEvent = { concept: ConceptId; kind: "explained" | "confused" | "correct_use" };

export type ExposureLevel = "new" | "seen" | "familiar";

export const EXPLANATION_LEVELS = ["none", "intro", "pitfall", "missing"] as const;

export type ExplanationLevel = (typeof EXPLANATION_LEVELS)[number];

const FAMILIAR_AFTER = 2;

export function exposureLevel(events: ConceptEvent[], concept: ConceptId): ExposureLevel {
  let level: ExposureLevel = "new";
  let cleanExplanations = 0;
  let correctUses = 0;

  for (const event of events) {
    if (event.concept !== concept) continue;

    if (event.kind === "confused") {
      level = "seen";
      cleanExplanations = 0;
      correctUses = 0;
      continue;
    }

    // Using the formal term only shows understanding after Thya has explained it.
    if (event.kind === "correct_use" && level === "new") continue;

    if (event.kind === "explained") cleanExplanations += 1;
    else correctUses += 1;

    if (cleanExplanations >= FAMILIAR_AFTER || correctUses >= FAMILIAR_AFTER) level = "familiar";
    else if (cleanExplanations > 0) level = "seen";
  }

  return level;
}

export function queryMetricEvents(
  concept: ConceptId,
  explanation: ExplanationLevel,
  userTerm: string | null,
): ConceptEvent[] {
  const events: ConceptEvent[] = [];
  const term = findTerm(userTerm);

  if (term?.formal && term.concepts.length === 1 && term.concepts[0] === concept) {
    events.push({ concept, kind: "correct_use" });
  }

  // A pitfall warns without defining the concept, so it does not count as an explanation.
  if (explanation === "intro") {
    events.push({ concept, kind: "explained" });
  }

  return events;
}

// Asking "maksudnya?" is itself the confusion signal; the answer then counts as an explanation.
export function explainConceptEvents(concept: ConceptId): ConceptEvent[] {
  return [
    { concept, kind: "confused" },
    { concept, kind: "explained" },
  ];
}

const conceptId = z.enum(CONCEPT_IDS);

const queryMetricPart = z.object({
  type: z.literal("tool-queryMetric"),
  state: z.literal("output-available"),
  input: z.object({ userTerm: z.string().nullable() }),
  output: z.object({
    metric: conceptId,
    explanation: z.object({ level: z.enum(EXPLANATION_LEVELS) }),
  }),
});

const explainConceptPart = z.object({
  type: z.literal("tool-explainConcept"),
  state: z.literal("output-available"),
  output: z.object({ concept: conceptId }),
});

// The /demo client sends its own history, so tool parts are untrusted: anything malformed is skipped.
// A forged part can only make Thya explain more or less, never change a number.
export function eventsFromHistory(messages: UIMessage[]): ConceptEvent[] {
  const events: ConceptEvent[] = [];

  for (const message of messages) {
    if (message.role !== "assistant") continue;

    for (const part of message.parts) {
      const metricCall = queryMetricPart.safeParse(part);

      if (metricCall.success) {
        const { input, output } = metricCall.data;
        events.push(...queryMetricEvents(output.metric, output.explanation.level, input.userTerm));
        continue;
      }

      const explainCall = explainConceptPart.safeParse(part);

      if (explainCall.success)
        events.push(...explainConceptEvents(explainCall.data.output.concept));
    }
  }

  return events;
}
