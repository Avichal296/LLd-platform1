import type { CriterionResult } from "../domain/evaluation.ts";
import type { EvaluationDraft, EvaluationInput, Evaluator } from "../domain/evaluator.ts";
import { PRACTICE_RUBRIC } from "../domain/rubric.ts";

/** Cheap, boring checks. These should never need a model. */
export class StructureEvaluator implements Evaluator {
  readonly kind = "structure";

  async evaluate(input: EvaluationInput): Promise<EvaluationDraft> {
    const f = input.submission.content.fields;
    const text = input.submission.content.combinedText();
    const classLines = namedTypes(f.classDesign);
    const hasInterface = /interface|abstract|port|protocol/i.test(text);
    const hasTests = /test|spec|assert|unit/i.test(f.tradeoffs + f.classDesign + f.codeSketch);
    const hasFailure = /fail|error|invalid|full|empty|timeout|overflow|null/i.test(text);
    const wordCount = text.split(/\s+/).filter(Boolean).length;

    const results: CriterionResult[] = PRACTICE_RUBRIC.criteria.map((c) => {
      let score = 3;
      let evidence = "";
      let concern = "";
      let suggestion = "";

      if (c.key === "requirement_understanding") {
        const reqHits = input.problem.functionalReqs.filter((r) =>
          fuzzyIncludes(text, r),
        ).length;
        score = band(reqHits, input.problem.functionalReqs.length);
        evidence = `Touched ${reqHits}/${input.problem.functionalReqs.length} functional requirements in the write-up.`;
        if (reqHits < input.problem.functionalReqs.length / 2) {
          concern = "Several stated requirements never show up in the design.";
          suggestion = "Walk the requirement list and say which type owns each one.";
        }
      }

      if (c.key === "class_responsibilities") {
        score = classLines.length >= 5 ? 4 : classLines.length >= 3 ? 3 : 2;
        evidence = `Counted ${classLines.length} named types: ${classLines.slice(0, 6).join(", ") || "none"}.`;
        if (classLines.length < 3) {
          concern = "Too few types to split real responsibilities.";
          suggestion = "Separate data, policy, and orchestration instead of one manager class.";
        }
      }

      if (c.key === "encapsulation") {
        score = hasInterface ? 4 : /private|method|api|public/i.test(text) ? 3 : 2;
        evidence = hasInterface
          ? "Mentions an interface/port, which is a start at hiding internals."
          : "No explicit interface/port named.";
        suggestion = hasInterface
          ? "Keep the interface small; don't leak fields through it."
          : "Name the seam another implementation would sit behind.";
      }

      if (c.key === "edge_cases") {
        score = hasFailure && hasTests ? 4 : hasFailure ? 3 : 2;
        evidence = hasFailure
          ? "Failure language is present."
          : "Little talk of invalid input or resource limits.";
        concern = hasTests ? "" : "Test plan is thin or missing.";
        suggestion = "Pick two awkward cases from the prompt and say how you would test them.";
      }

      if (c.key === "explanation") {
        score = wordCount > 450 ? 4 : wordCount > 220 ? 3 : 2;
        evidence = `Write-up is about ${wordCount} words.`;
        if (f.tradeoffs.length < 80) {
          concern = "Trade-off section is short.";
          suggestion = "Name one thing you rejected and why.";
        }
      }

      return {
        criterionKey: c.key,
        title: c.title,
        score,
        maxScore: c.maxScore,
        evidence,
        concern,
        suggestion,
        confidence: 0.7,
      };
    });

    return {
      evaluatorKind: this.kind,
      criterionResults: results,
      summary: "Structural checks looked at completeness, named types, and failure talk.",
      strengths: classLines.length >= 4 ? ["Named a workable set of types"] : [],
      nextFocus:
        classLines.length < 3
          ? ["Split the design into more than one or two types"]
          : [],
    };
  }
}

function namedTypes(classDesign: string): string[] {
  const lines = classDesign.split(/\n+/);
  const names: string[] = [];
  for (const line of lines) {
    const match =
      line.match(/^\s*(?:class|interface|type|enum|record)\s+([A-Z][A-Za-z0-9]+)/) ||
      line.match(/^\s*-\s*([A-Z][A-Za-z0-9]+)\b/) ||
      line.match(/^\s*([A-Z][A-Za-z0-9]{2,})\s*[:—-]/);
    if (match) names.push(match[1]);
  }
  return [...new Set(names)];
}

function fuzzyIncludes(haystack: string, requirement: string): boolean {
  const words = requirement
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .split(/\s+/)
    .filter((w) => w.length > 4);
  if (words.length < 2) return haystack.toLowerCase().includes(requirement.toLowerCase().slice(0, 18));
  const hits = words.filter((w) => haystack.toLowerCase().includes(w)).length;
  return hits / words.length >= 0.4;
}

function band(hits: number, total: number): number {
  if (total === 0) return 3;
  const r = hits / total;
  if (r >= 0.7) return 4;
  if (r >= 0.4) return 3;
  return 2;
}
