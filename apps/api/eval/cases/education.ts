import { metric, type EvalCaseInput } from "./schema";

// E13 by rule: English business terms in Indonesian replies ("margin" is accepted).
const ENGLISH_TERMS = /gross profit|revenue|cost of goods|net profit|\bsales\b|\bprofit\b/i;

export const educationCases: EvalCaseInput[] = [
  {
    id: "what-is-hpp",
    refs: [],
    suite: "regression",
    category: "education",
    turns: ["HPP itu apa sih?"],
    expect: { tools: [{ name: "explainConcept", args: { concept: "cogs" } }] },
  },
  {
    id: "maksudnya-after-gross-profit",
    refs: ["E7"],
    suite: "regression",
    category: "education",
    turns: ["laba kotor minggu lalu berapa?", "maksudnya laba kotor itu apa?"],
    expect: { tools: [{ name: "explainConcept", args: { concept: "gross_profit" } }] },
  },
  {
    id: "what-is-margin",
    refs: [],
    suite: "regression",
    category: "education",
    turns: ["margin itu maksudnya apa ya kak?"],
    expect: {
      tools: [{ name: "explainConcept", args: { concept: "gross_margin" } }],
      mustNotMatch: [ENGLISH_TERMS],
    },
  },
  {
    id: "omzet-vs-untung",
    refs: ["E1"],
    suite: "regression",
    category: "education",
    turns: ["bedanya omzet sama untung apa?"],
    expect: {
      anyTool: [
        { name: "explainConcept", args: { concept: "revenue" } },
        { name: "explainConcept", args: { concept: "gross_profit" } },
      ],
      mustNotMatch: [ENGLISH_TERMS],
    },
  },
  {
    // E4: the first answer introduces the term; asking again in the same thread does not repeat
    // the beginner explanation (the tool returns explanation null once it is familiar).
    id: "familiar-concept-not-repeated",
    refs: ["E4"],
    suite: "capability",
    category: "education",
    turns: ["omzet kemarin berapa?", "kalau omzet 7 hari terakhir?"],
    expect: {
      tools: [metric("revenue", "last_7_days")],
      mustNotMatch: [/omzet (itu|adalah)|total uang (masuk|jualan)/i],
    },
  },
  {
    id: "tone-greeting",
    refs: ["E13"],
    suite: "regression",
    category: "tone",
    turns: ["halo thya, pagi"],
    expect: {
      noTools: true,
      mustMatch: [/kak/i],
      mustNotMatch: [/Rp\s?\d/],
      maxLines: 4,
      judge: "tone",
    },
  },
  {
    id: "tone-thanks",
    refs: ["E13"],
    suite: "regression",
    category: "tone",
    turns: ["makasih ya thya"],
    expect: { noTools: true, maxLines: 3, judge: "tone" },
  },
  {
    // The owner writes in English; Thya still answers in Indonesian (prompt rule).
    id: "tone-english-input",
    refs: ["E13"],
    suite: "regression",
    category: "tone",
    turns: ["how much was revenue last week?"],
    expect: {
      tools: [metric("revenue", "last_week")],
      mustMatch: [/omzet/i],
      mustNotMatch: [/\b(revenue|last week|was)\b/i],
      judge: "tone",
    },
  },
  {
    id: "tone-explanation-short",
    refs: ["E13"],
    suite: "regression",
    category: "tone",
    turns: ["jelasin laba kotor dong, aku awam banget"],
    expect: {
      tools: [{ name: "explainConcept", args: { concept: "gross_profit" } }],
      mustNotMatch: [ENGLISH_TERMS],
      maxLines: 8,
      judge: "tone",
    },
  },
  {
    id: "tone-overwhelmed-owner",
    refs: ["E13"],
    suite: "regression",
    category: "tone",
    turns: ["pusing aku liat angka-angka ini, intinya jualanku minggu lalu bagus nggak sih?"],
    expect: {
      tools: [{ name: "queryMetric", args: { period: "last_week" } }],
      maxLines: 8,
      judge: "tone",
    },
  },
];
