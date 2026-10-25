import { educationCases } from "./education";
import { featureCases } from "./features";
import { guardrailCases } from "./guardrail";
import { numberCases } from "./numbers";
import { parseCases, type EvalCase } from "./schema";
import { toolChoiceCases } from "./tool-choice";
import { writeCases } from "./write";

export { EVAL_NOW, toolCall, type EvalCase, type ToolCall } from "./schema";

export const EVAL_CASES: EvalCase[] = parseCases([
  ...numberCases,
  ...toolChoiceCases,
  ...writeCases,
  ...guardrailCases,
  ...educationCases,
  ...featureCases,
]);

const duplicate = EVAL_CASES.find(
  (testCase, index) => EVAL_CASES.findIndex(({ id }) => id === testCase.id) !== index,
);

if (duplicate) throw new Error(`duplicate eval case id: ${duplicate.id}`);
