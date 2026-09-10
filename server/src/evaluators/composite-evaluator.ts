import { randomUUID } from "node:crypto";
import type { CriterionKey, EvaluationDraft, EvaluationInput, Evaluator } from "../domain/index.ts";
import { Evaluation } from "../domain/evaluation.ts";
import { PRACTICE_RUBRIC } from "../domain/rubric.ts";
import type { CriterionResult } from "../domain/evaluation.ts";

export class CompositeEvaluator implements Evaluator {
  readonly kind: string;

  constructor(private readonly parts: Evaluator[]) {
    this.kind = parts.map((p) => p.kind).join("+");
  }

  async evaluate(input: EvaluationInput): Promise<Evaluation> {
    const drafts = [];
    for (const part of this.parts) {
      drafts.push(await part.evaluate(input));
    }

    const merged = mergeDrafts(drafts as EvaluationDraft[], this.kind);
    const startedAt = new Date(Date.now() - 5);
    return new Evaluation(
      randomUUID(),
      input.submission.id,
      merged.evaluatorKind,
      merged.criterionResults,
      merged.summary,
      merged.strengths,
      merged.nextFocus,
      startedAt,
      new Date(),
    );
  }
}

function mergeDrafts(drafts: EvaluationDraft[], kind: string): EvaluationDraft {
  const byKey = new Map<CriterionKey, CriterionResult[]>();
  for (const d of drafts) {
    for (const r of d.criterionResults) {
      const list = byKey.get(r.criterionKey) ?? [];
      list.push(r);
      byKey.set(r.criterionKey, list);
    }
  }

  const criterionResults: CriterionResult[] = PRACTICE_RUBRIC.criteria.map((c) => {
    const hits = byKey.get(c.key) ?? [];
    if (!hits.length) {
      return {
        criterionKey: c.key,
        title: c.title,
        score: 2,
        maxScore: c.maxScore,
        evidence: "No evaluator spoke to this criterion.",
        concern: "Missing coverage.",
        suggestion: "Add more structure so this dimension can be judged.",
        confidence: 0.3,
      };
    }
    const score =
      Math.round((hits.reduce((s, h) => s + h.score, 0) / hits.length) * 10) / 10;
    const evidence = hits.map((h) => h.evidence).filter(Boolean).join(" ");
    const concern = hits.map((h) => h.concern).filter(Boolean).join(" ");
    const suggestion = hits.map((h) => h.suggestion).filter(Boolean).join(" ");
    const confidence = hits.reduce((s, h) => s + h.confidence, 0) / hits.length;
    return {
      criterionKey: c.key,
      title: c.title,
      score: clamp(score, 1, c.maxScore),
      maxScore: c.maxScore,
      evidence: evidence || "See notes below.",
      concern,
      suggestion,
      confidence: Math.round(confidence * 100) / 100,
    };
  });

  const strengths = unique(drafts.flatMap((d) => d.strengths)).slice(0, 4);
  const nextFocus = unique(drafts.flatMap((d) => d.nextFocus)).slice(0, 4);
  const weakest = [...criterionResults].sort((a, b) => a.score - b.score)[0];
  const strongest = [...criterionResults].sort((a, b) => b.score - a.score)[0];
  const summary = `Strongest signal is ${strongest.title.toLowerCase()} (${strongest.score}/${strongest.maxScore}). Weakest is ${weakest.title.toLowerCase()} (${weakest.score}/${weakest.maxScore}). ${drafts.map((d) => d.summary).join(" ")}`;

  return { evaluatorKind: kind, criterionResults, summary, strengths, nextFocus };
}

function unique(items: string[]): string[] {
  return [...new Set(items.map((s) => s.trim()).filter(Boolean))];
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}
