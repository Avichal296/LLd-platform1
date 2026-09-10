import { InvalidTransitionError } from "./errors.ts";
import type { Evaluation } from "./evaluation.ts";
import type { SubmissionContent } from "./submission-content.ts";

export const SUBMISSION_STATUSES = [
  "submitted",
  "evaluating",
  "completed",
  "failed",
] as const;

export type SubmissionStatus = (typeof SUBMISSION_STATUSES)[number];

export class Submission {
  evaluation: Evaluation | null;

  constructor(
    readonly id: string,
    readonly attemptId: string,
    readonly createdAt: Date,
    public status: SubmissionStatus,
    readonly content: SubmissionContent,
    evaluation: Evaluation | null = null,
    public failReason: string | null = null,
  ) {
    this.evaluation = evaluation;
  }

  beginEvaluation() {
    if (this.status !== "submitted" && this.status !== "failed") {
      throw new InvalidTransitionError(this.status, "evaluating");
    }
    this.status = "evaluating";
    this.failReason = null;
  }

  complete(evaluation: Evaluation) {
    if (this.status !== "evaluating") {
      throw new InvalidTransitionError(this.status, "completed");
    }
    this.status = "completed";
    this.evaluation = evaluation;
  }

  fail(reason: string) {
    if (this.status !== "evaluating") {
      throw new InvalidTransitionError(this.status, "failed");
    }
    this.status = "failed";
    this.failReason = reason;
  }

  canRetry(): boolean {
    return this.status === "failed";
  }
}
