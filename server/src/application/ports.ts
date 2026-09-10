import type { Attempt } from "../domain/attempt.ts";
import type { Evaluation } from "../domain/evaluation.ts";
import type { LldProblem } from "../domain/problem.ts";
import type { Submission } from "../domain/submission.ts";

export interface ProblemRepository {
  list(): Promise<LldProblem[]>;
  getById(id: string): Promise<LldProblem | null>;
  getBySlug(slug: string): Promise<LldProblem | null>;
}

export interface AttemptRepository {
  save(attempt: Attempt): Promise<void>;
  get(id: string): Promise<Attempt | null>;
  listByLearner(learnerId: string): Promise<Attempt[]>;
  saveSubmission(submission: Submission): Promise<void>;
  saveEvaluation(evaluation: Evaluation): Promise<void>;
  getSubmission(id: string): Promise<Submission | null>;
}

export interface LearnerRepository {
  create(id: string, displayName: string): Promise<{ id: string; displayName: string }>;
  get(id: string): Promise<{ id: string; displayName: string } | null>;
  ensure(id: string, displayName: string): Promise<{ id: string; displayName: string }>;
}
