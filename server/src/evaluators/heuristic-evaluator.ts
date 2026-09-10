import { problemHasSignal } from "../domain/problem.ts";
import type { CriterionResult } from "../domain/evaluation.ts";
import type { EvaluationDraft, EvaluationInput, Evaluator } from "../domain/evaluator.ts";
import { PRACTICE_RUBRIC } from "../domain/rubric.ts";

/**
 * Looks for problem-specific design ideas and a handful of smell words.
 * Not a substitute for a human reviewer. Good enough to make retries useful.
 */
export class HeuristicDesignEvaluator implements Evaluator {
  readonly kind = "heuristic";

  async evaluate(input: EvaluationInput): Promise<EvaluationDraft> {
    const text = input.submission.content.combinedText();
    const hits = problemHasSignal(input.problem, text);
    const hitKeys = new Set(hits.map((h) => h.criterionHint));
    const godClass = /manager|service|handler|processor|util/i.test(
      input.submission.content.fields.classDesign,
    );
    const patternDump = countMatches(
      text,
      /\b(singleton|factory|observer|strategy|decorator|adapter|facade|command pattern)\b/gi,
    );
    const tradeoffWords = /because|instead|rather|trade|cost|simple|later/i.test(
      input.submission.content.fields.tradeoffs,
    );
    const changeTalk = input.problem.changeScenarios.some((s) =>
      input.submission.content.fields.tradeoffs.toLowerCase().includes(s.toLowerCase().slice(0, 18)),
    ) || /extend|new type|plug|without rewrite|open.closed/i.test(text);

    const results: CriterionResult[] = PRACTICE_RUBRIC.criteria.map((c) => {
      const related = hits.filter((h) => h.criterionHint === c.key);
      let score = 2.5;
      if (hitKeys.has(c.key)) score += 1;
      if (related.length >= 2) score += 0.5;

      let evidence =
        related.length > 0
          ? `Picked up: ${related.map((r) => r.token).join(", ")}.`
          : "No expected signal for this dimension.";
      let concern = related.length ? "" : "This part of the design still looks generic.";
      let suggestion = related.length
        ? related[0].why
        : "Name the type that would own this concern, even if you keep it small.";

      if (c.key === "coupling_cohesion") {
        if (godClass) {
          score -= 0.8;
          concern = "Manager/Service/Handler naming often hides a grab-bag of duties.";
          suggestion = "Rename by the job (TicketIssuer, FloorRequest, FarePolicy), not by 'manager'.";
          evidence += " Found broad *Manager/*Service type names.";
        } else {
          score += 0.4;
          evidence += " No obvious god-class naming.";
        }
      }

      if (c.key === "abstraction") {
        if (patternDump >= 3) {
          score = Math.min(score, 2.5);
          concern = "Pattern names showed up more than the problem did.";
          suggestion = "Keep at most one pattern and say what breaks if you drop it.";
        } else if (patternDump === 1) {
          score += 0.3;
          evidence += " Pattern use looks restrained.";
        }
      }

      if (c.key === "extensibility") {
        score = changeTalk ? Math.max(score, 4) : Math.min(score, 3);
        evidence = changeTalk
          ? "The write-up reacts to a change scenario."
          : "Change scenarios from the prompt were not really addressed.";
        suggestion = `Try this: ${input.problem.changeScenarios[0]}`;
      }

      if (c.key === "explanation") {
        score = tradeoffWords ? Math.max(score, 3.5) : Math.min(score, 3);
        if (!tradeoffWords) suggestion = "Write the rejected alternative in one sentence.";
      }

      return {
        criterionKey: c.key,
        title: c.title,
        score: round1(Math.min(5, Math.max(1, score))),
        maxScore: c.maxScore,
        evidence,
        concern,
        suggestion,
        confidence: 0.55,
      };
    });

    const missing = input.problem.designSignals
      .filter((s) => !hits.some((h) => h.token === s.token))
      .slice(0, 3);

    return {
      evaluatorKind: this.kind,
      criterionResults: results,
      summary: `Matched ${hits.length}/${input.problem.designSignals.length} design signals.`,
      strengths: hits.slice(0, 3).map((h) => `Covered ${h.token}`),
      nextFocus: missing.map((m) => `Consider ${m.token}: ${m.why}`),
    };
  }
}

function countMatches(text: string, re: RegExp): number {
  return text.match(re)?.length ?? 0;
}

function round1(n: number) {
  return Math.round(n * 10) / 10;
}
