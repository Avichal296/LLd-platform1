import { Attempt } from "../domain/attempt.ts";
import { Evaluation } from "../domain/evaluation.ts";
import type { LldProblem } from "../domain/problem.ts";
import { Submission } from "../domain/submission.ts";
import { PROBLEM_CATALOG } from "../catalog/problems.ts";
import type { AttemptRepository, LearnerRepository, ProblemRepository } from "../application/ports.ts";

export class MemoryProblemRepository implements ProblemRepository {
  constructor(private readonly problems: LldProblem[] = PROBLEM_CATALOG) {}
  async list() {
    return this.problems;
  }
  async getById(id: string) {
    return this.problems.find((p) => p.id === id) ?? null;
  }
  async getBySlug(slug: string) {
    return this.problems.find((p) => p.slug === slug) ?? null;
  }
}

export class MemoryLearnerRepository implements LearnerRepository {
  private store = new Map<string, { id: string; displayName: string }>();
  async create(id: string, displayName: string) {
    const row = { id, displayName };
    this.store.set(id, row);
    return row;
  }
  async get(id: string) {
    return this.store.get(id) ?? null;
  }
  async ensure(id: string, displayName: string) {
    return (await this.get(id)) ?? this.create(id, displayName);
  }
}

export class MemoryAttemptRepository implements AttemptRepository {
  private attempts = new Map<string, Attempt>();
  private submissions = new Map<string, Submission>();

  async save(attempt: Attempt) {
    this.attempts.set(attempt.id, attempt);
  }
  async get(id: string) {
    return this.attempts.get(id) ?? null;
  }
  async listByLearner(learnerId: string) {
    return [...this.attempts.values()]
      .filter((a) => a.learnerId === learnerId)
      .sort((a, b) => b.lastActivityAt.getTime() - a.lastActivityAt.getTime());
  }
  async saveSubmission(submission: Submission) {
    this.submissions.set(submission.id, submission);
    const attempt = this.attempts.get(submission.attemptId);
    if (!attempt) return;
    const idx = attempt.submissions.findIndex((s) => s.id === submission.id);
    if (idx === -1) attempt.submissions.push(submission);
    else attempt.submissions[idx] = submission;
    attempt.lastActivityAt = new Date();
  }
  async saveEvaluation(evaluation: Evaluation) {
    const sub = this.submissions.get(evaluation.submissionId);
    if (sub) sub.evaluation = evaluation;
  }
  async getSubmission(id: string) {
    return this.submissions.get(id) ?? null;
  }
}
