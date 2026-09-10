import { randomUUID } from "node:crypto";
import { Attempt } from "../domain/attempt.ts";
import { Evaluation } from "../domain/evaluation.ts";
import type { Evaluator } from "../domain/evaluator.ts";
import { NotFoundError } from "../domain/errors.ts";
import { PRACTICE_RUBRIC } from "../domain/rubric.ts";
import { SubmissionContent, type SubmissionFormat } from "../domain/submission-content.ts";
import type { AttemptRepository, LearnerRepository, ProblemRepository } from "./ports.ts";

export class PracticeService {
  constructor(
    private readonly problems: ProblemRepository,
    private readonly attempts: AttemptRepository,
    private readonly learners: LearnerRepository,
    private readonly evaluator: Evaluator,
    private readonly enqueue: (work: () => Promise<void>) => void,
  ) {}

  async register(displayName: string) {
    const name = displayName.trim() || "Anonymous";
    return this.learners.create(randomUUID(), name.slice(0, 40));
  }

  listProblems() {
    return this.problems.list();
  }

  async getProblem(slug: string) {
    const problem = await this.problems.getBySlug(slug);
    if (!problem) throw new NotFoundError("Problem");
    return { problem, rubric: PRACTICE_RUBRIC };
  }

  async startAttempt(learnerId: string, problemId: string, displayName = "Guest") {
    await this.learners.ensure(learnerId, displayName);
    const problem = await this.problems.getById(problemId);
    if (!problem) throw new NotFoundError("Problem");
    const attempt = new Attempt(randomUUID(), learnerId, problemId, new Date(), new Date(), []);
    await this.attempts.save(attempt);
    return { attempt, problem, rubric: PRACTICE_RUBRIC };
  }

  async getAttempt(id: string) {
    const attempt = await this.attempts.get(id);
    if (!attempt) throw new NotFoundError("Attempt");
    const problem = await this.problems.getById(attempt.problemId);
    if (!problem) throw new NotFoundError("Problem");
    return { attempt, problem, rubric: PRACTICE_RUBRIC };
  }

  async history(learnerId: string) {
    const learner = await this.learners.get(learnerId);
    if (!learner) throw new NotFoundError("Learner");
    const attempts = await this.attempts.listByLearner(learnerId);
    const problems = await this.problems.list();
    const byId = new Map(problems.map((p) => [p.id, p]));
    return attempts.map((a) => ({
      attempt: a,
      problem: byId.get(a.problemId) ?? null,
      latest: a.latest(),
    }));
  }

  async submit(
    attemptId: string,
    payload: {
      format?: SubmissionFormat;
      assumptions: string;
      classDesign: string;
      relationships: string;
      tradeoffs: string;
      codeSketch?: string;
      diagramSource?: string;
      learnerId?: string;
      problemId?: string;
    },
  ) {
    let attempt = await this.attempts.get(attemptId);
    if (!attempt && payload.learnerId && payload.problemId) {
      await this.learners.ensure(payload.learnerId, "Guest");
      const problem = await this.problems.getById(payload.problemId);
      if (!problem) throw new NotFoundError("Problem");
      attempt = new Attempt(attemptId, payload.learnerId, payload.problemId, new Date(), new Date(), []);
      await this.attempts.save(attempt);
    }
    if (!attempt) throw new NotFoundError("Attempt");

    const content = new SubmissionContent(payload.format ?? "structured_design", {
      assumptions: payload.assumptions,
      classDesign: payload.classDesign,
      relationships: payload.relationships,
      tradeoffs: payload.tradeoffs,
      codeSketch: payload.codeSketch ?? "",
      diagramSource: payload.diagramSource ?? "",
    });

    const submission = attempt.recordSubmission(randomUUID(), content);
    await this.attempts.saveSubmission(submission);
    await this.scheduleEvaluation(submission.id);
    return submission;
  }

  async retryEvaluation(submissionId: string) {
    const submission = await this.attempts.getSubmission(submissionId);
    if (!submission) throw new NotFoundError("Submission");
    if (!submission.canRetry()) {
      return submission;
    }
    submission.beginEvaluation();
    await this.attempts.saveSubmission(submission);
    await this.scheduleEvaluation(submission.id);
    return submission;
  }

  private async scheduleEvaluation(submissionId: string) {
    // Lambda freezes after the response. On Vercel we finish the eval
    // in-request (the row is already stored). Locally we still return 202.
    if (process.env.VERCEL) {
      await this.runEvaluation(submissionId);
      return;
    }
    this.enqueue(() => this.runEvaluation(submissionId));
  }

  async getSubmission(id: string) {
    const submission = await this.attempts.getSubmission(id);
    if (!submission) throw new NotFoundError("Submission");
    const attempt = await this.attempts.get(submission.attemptId);
    if (!attempt) throw new NotFoundError("Attempt");
    const problem = await this.problems.getById(attempt.problemId);
    if (!problem) throw new NotFoundError("Problem");
    return { submission, attempt, problem, rubric: PRACTICE_RUBRIC };
  }

  async runEvaluation(submissionId: string) {
    const loaded = await this.attempts.getSubmission(submissionId);
    if (!loaded) return;
    const attempt = await this.attempts.get(loaded.attemptId);
    if (!attempt) return;
    const problem = await this.problems.getById(attempt.problemId);
    if (!problem) return;

    const submission = loaded;
    try {
      if (submission.status !== "evaluating") {
        submission.beginEvaluation();
        await this.attempts.saveSubmission(submission);
      }
      const draft = await this.evaluator.evaluate({
        problem,
        rubric: PRACTICE_RUBRIC,
        submission,
      });
      const evaluation =
        draft instanceof Evaluation
          ? draft
          : new Evaluation(
              randomUUID(),
              submission.id,
              draft.evaluatorKind,
              draft.criterionResults,
              draft.summary,
              draft.strengths,
              draft.nextFocus,
              new Date(),
              new Date(),
            );
      submission.complete(evaluation);
      await this.attempts.saveEvaluation(evaluation);
      await this.attempts.saveSubmission(submission);
    } catch (err) {
      const reason = err instanceof Error ? err.message : "evaluation failed";
      try {
        submission.fail(reason);
        await this.attempts.saveSubmission(submission);
      } catch {
        // already left the evaluating state; nothing else to do
      }
    }
  }
}
