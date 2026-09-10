import type { LldProblem } from "./problem.ts";
import type { Rubric } from "./rubric.ts";
import type { Submission } from "./submission.ts";
import type { Evaluation } from "./evaluation.ts";

/**
 * Port for anyone who can judge a design.
 * Change test B: a rule engine or a human reviewer is another implementation
 * of this interface. The practice flow talks only to this port.
 */
export interface Evaluator {
  readonly kind: string;
  evaluate(input: EvaluationInput): Promise<Omit<Evaluation, "overallScore"> | EvaluationDraft>;
}

export type EvaluationInput = {
  problem: LldProblem;
  rubric: Rubric;
  submission: Submission;
};

export type EvaluationDraft = {
  evaluatorKind: string;
  criterionResults: Evaluation["criterionResults"];
  summary: string;
  strengths: string[];
  nextFocus: string[];
};
