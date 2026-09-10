import { ConflictError, DomainError } from "./errors.ts";
import { Submission } from "./submission.ts";
import { SubmissionContent } from "./submission-content.ts";

export class Attempt {
  constructor(
    readonly id: string,
    readonly learnerId: string,
    readonly problemId: string,
    readonly startedAt: Date,
    public lastActivityAt: Date,
    readonly submissions: Submission[],
  ) {}

  recordSubmission(id: string, content: SubmissionContent, now = new Date()): Submission {
    const hash = content.contentHash();
    const duplicate = this.submissions.find((s) => s.content.contentHash() === hash);
    if (duplicate) {
      throw new ConflictError(
        "This attempt already has the same design. Change the work before submitting again.",
      );
    }

    const inFlight = this.submissions.find(
      (s) => s.status === "submitted" || s.status === "evaluating",
    );
    if (inFlight) {
      throw new DomainError(
        "An evaluation is already running for this attempt. Wait for it to finish.",
        "EVALUATION_IN_FLIGHT",
        409,
      );
    }

    const submission = new Submission(id, this.id, now, "submitted", content);
    this.submissions.push(submission);
    this.lastActivityAt = now;
    return submission;
  }

  latest(): Submission | null {
    if (!this.submissions.length) return null;
    return [...this.submissions].sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
    )[0];
  }
}
