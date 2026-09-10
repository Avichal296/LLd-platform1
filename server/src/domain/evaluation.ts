import type { CriterionKey, Rubric } from "./rubric.ts";
import { totalWeight } from "./rubric.ts";

export type CriterionResult = {
  criterionKey: CriterionKey;
  title: string;
  score: number;
  maxScore: number;
  evidence: string;
  concern: string;
  suggestion: string;
  confidence: number;
};

export class Evaluation {
  constructor(
    readonly id: string,
    readonly submissionId: string,
    readonly evaluatorKind: string,
    readonly criterionResults: CriterionResult[],
    readonly summary: string,
    readonly strengths: string[],
    readonly nextFocus: string[],
    readonly startedAt: Date,
    readonly completedAt: Date,
    readonly errorMessage: string | null = null,
  ) {}

  overallScore(rubric: Rubric): number {
    const byKey = new Map(this.criterionResults.map((r) => [r.criterionKey, r]));
    let acc = 0;
    for (const c of rubric.criteria) {
      const hit = byKey.get(c.key);
      const ratio = hit ? hit.score / c.maxScore : 0;
      acc += ratio * c.weight;
    }
    return Math.round((acc / totalWeight(rubric)) * 1000) / 10;
  }
}
