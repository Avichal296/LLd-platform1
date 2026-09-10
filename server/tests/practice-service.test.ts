import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { PracticeService } from "../src/application/practice-service.ts";
import type { AttemptRepository, LearnerRepository, ProblemRepository } from "../src/application/ports.ts";
import { Attempt } from "../src/domain/attempt.ts";
import { Evaluation } from "../src/domain/evaluation.ts";
import type { LldProblem } from "../src/domain/problem.ts";
import { Submission } from "../src/domain/submission.ts";
import { buildDefaultEvaluator } from "../src/evaluators/build.ts";

const problem: LldProblem = {
  id: "p1",
  slug: "parking-lot",
  title: "Parking lot",
  difficulty: "intro",
  estimatedMinutes: 30,
  blurb: "x",
  prompt: "x",
  constraints: [],
  functionalReqs: ["Park a vehicle if a legal spot exists, otherwise refuse."],
  changeScenarios: ["Add EV spots"],
  designSignals: [
    { token: "Spot", why: "inventory", criterionHint: "class_responsibilities" },
    { token: "Ticket", why: "session", criterionHint: "class_responsibilities" },
  ],
};

class MemProblems implements ProblemRepository {
  async list() {
    return [problem];
  }
  async getById(id: string) {
    return id === problem.id ? problem : null;
  }
  async getBySlug(slug: string) {
    return slug === problem.slug ? problem : null;
  }
}

class MemLearners implements LearnerRepository {
  store = new Map<string, { id: string; displayName: string }>();
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

class MemAttempts implements AttemptRepository {
  attempts = new Map<string, Attempt>();
  subs = new Map<string, Submission>();
  async save(attempt: Attempt) {
    this.attempts.set(attempt.id, attempt);
  }
  async get(id: string) {
    return this.attempts.get(id) ?? null;
  }
  async listByLearner(learnerId: string) {
    return [...this.attempts.values()].filter((a) => a.learnerId === learnerId);
  }
  async saveSubmission(submission: Submission) {
    this.subs.set(submission.id, submission);
    const attempt = this.attempts.get(submission.attemptId);
    if (attempt) {
      const idx = attempt.submissions.findIndex((s) => s.id === submission.id);
      if (idx === -1) attempt.submissions.push(submission);
      else attempt.submissions[idx] = submission;
    }
  }
  async saveEvaluation(evaluation: Evaluation) {
    const sub = this.subs.get(evaluation.submissionId);
    if (sub) sub.evaluation = evaluation;
  }
  async getSubmission(id: string) {
    return this.subs.get(id) ?? null;
  }
}

const body = {
  assumptions:
    "One garage, in-memory spots, trusted clock, no payments. Refuse when no legal spot exists. Vans need large, bikes fit any size, cars take regular or large.",
  classDesign: `ParkingLot has floors.
Floor holds Spot instances.
Spot has a size and optional Vehicle.
Vehicle / Car / Bike / Van decide canFit.
Ticket stores spotId and issuedAt.
FeePolicy returns cents for a session.`,
  relationships:
    "Lot owns floors owns spots. Ticket points at a spot id. Exit uses FeePolicy. TicketIssuer does not price.",
  tradeoffs:
    "Pricing is a policy object so a day-pass cap does not rewrite inventory. I rejected ParkingLotManager. EV spots later become a feature on Spot.",
  codeSketch: "interface FeePolicy { fee(t: Ticket): number }",
};

describe("PracticeService", () => {
  it("persists a submission before evaluation and ends completed", async () => {
    const attempts = new MemAttempts();
    const learners = new MemLearners();
    const queued: Array<() => Promise<void>> = [];
    const practice = new PracticeService(
      new MemProblems(),
      attempts,
      learners,
      buildDefaultEvaluator(),
      (w) => queued.push(w),
    );

    const learner = await practice.register("Ravi");
    const started = await practice.startAttempt(learner.id, "p1");
    const submission = await practice.submit(started.attempt.id, body);

    assert.equal(submission.status, "submitted");
    assert.equal(attempts.subs.has(submission.id), true);

    assert.equal(queued.length, 1);
    await queued[0]();

    const done = await practice.getSubmission(submission.id);
    assert.equal(done.submission.status, "completed");
    assert.ok(done.submission.evaluation);
    assert.ok(done.submission.evaluation.overallScore(done.rubric) > 0);
  });

  it("starts an attempt for a learner id that was never registered", async () => {
    const practice = new PracticeService(
      new MemProblems(),
      new MemAttempts(),
      new MemLearners(),
      buildDefaultEvaluator(),
      () => {},
    );
    const started = await practice.startAttempt("brand-new", "p1", "Guest");
    assert.equal(started.attempt.learnerId, "brand-new");
    assert.equal(started.problem.id, "p1");
  });
});
