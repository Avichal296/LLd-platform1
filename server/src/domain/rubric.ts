export type CriterionKey =
  | "requirement_understanding"
  | "class_responsibilities"
  | "coupling_cohesion"
  | "encapsulation"
  | "abstraction"
  | "extensibility"
  | "edge_cases"
  | "explanation";

export type RubricCriterion = {
  key: CriterionKey;
  title: string;
  weight: number;
  question: string;
  maxScore: number;
};

export type Rubric = {
  id: string;
  name: string;
  criteria: RubricCriterion[];
};

export const PRACTICE_RUBRIC: Rubric = {
  id: "lld-practice-v1",
  name: "LLD practice rubric",
  criteria: [
    {
      key: "requirement_understanding",
      title: "Requirement understanding",
      weight: 1.2,
      maxScore: 5,
      question: "Did the learner restate the real constraints and call out what they are not solving?",
    },
    {
      key: "class_responsibilities",
      title: "Class responsibilities",
      weight: 1.4,
      maxScore: 5,
      question: "Is each named type doing one job, and can you tell who owns which data?",
    },
    {
      key: "coupling_cohesion",
      title: "Coupling and cohesion",
      weight: 1.2,
      maxScore: 5,
      question: "Are collaborators loosely connected, or is one type orchestrating everything?",
    },
    {
      key: "encapsulation",
      title: "Encapsulation and interfaces",
      weight: 1.1,
      maxScore: 5,
      question: "Are internals hidden behind methods, and are the public seams intentional?",
    },
    {
      key: "abstraction",
      title: "Abstraction and patterns",
      weight: 1,
      maxScore: 5,
      question: "Are patterns used because they earn their keep, not because they look like an interview answer?",
    },
    {
      key: "extensibility",
      title: "Extensibility",
      weight: 1.1,
      maxScore: 5,
      question: "Would the named change scenario force a rewrite, or a new type?",
    },
    {
      key: "edge_cases",
      title: "Edge cases and testability",
      weight: 1,
      maxScore: 5,
      question: "Did they name failure modes and how they would test the interesting behaviour?",
    },
    {
      key: "explanation",
      title: "Quality of explanation",
      weight: 1,
      maxScore: 5,
      question: "Can a reviewer follow the trade-offs without guessing?",
    },
  ],
};

export function totalWeight(rubric: Rubric): number {
  return rubric.criteria.reduce((sum, c) => sum + c.weight, 0);
}
