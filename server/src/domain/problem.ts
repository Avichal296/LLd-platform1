export type DesignSignal = {
  token: string;
  aliases?: string[];
  why: string;
  criterionHint:
    | "requirement_understanding"
    | "class_responsibilities"
    | "coupling_cohesion"
    | "encapsulation"
    | "abstraction"
    | "extensibility"
    | "edge_cases"
    | "explanation";
};

export type LldProblem = {
  id: string;
  slug: string;
  title: string;
  difficulty: "intro" | "core" | "stretch";
  estimatedMinutes: number;
  blurb: string;
  prompt: string;
  constraints: string[];
  functionalReqs: string[];
  changeScenarios: string[];
  designSignals: DesignSignal[];
};

export function problemHasSignal(problem: LldProblem, haystack: string): DesignSignal[] {
  const text = haystack.toLowerCase();
  return problem.designSignals.filter((s) => {
    const needles = [s.token, ...(s.aliases ?? [])].map((n) => n.toLowerCase());
    return needles.some((n) => text.includes(n));
  });
}
