import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Attempt } from "../src/domain/attempt.ts";
import { ConflictError, DomainError, InvalidTransitionError } from "../src/domain/errors.ts";
import { SubmissionContent } from "../src/domain/submission-content.ts";
import { Evaluation } from "../src/domain/evaluation.ts";
import { PRACTICE_RUBRIC } from "../src/domain/rubric.ts";
import { HeuristicDesignEvaluator } from "../src/evaluators/heuristic-evaluator.ts";
import { StructureEvaluator } from "../src/evaluators/structure-evaluator.ts";
import { CompositeEvaluator } from "../src/evaluators/composite-evaluator.ts";
import type { LldProblem } from "../src/domain/problem.ts";
import { Submission } from "../src/domain/submission.ts";

const meaty = {
  assumptions:
    "Single garage, in-memory inventory, trusted clock. No payments. Vans need large spots, bikes fit anywhere. We refuse when no legal spot exists rather than queueing cars.",
  classDesign: `ParkingLot owns floors.
Floor owns a collection of Spot.
Spot knows size and the vehicle currently in it.
Vehicle is abstract; Car, Bike, Van implement canFit(spot).
Ticket records spot id, vehicle id, issuedAt.
FeePolicy computes cents from duration and vehicle type.
TicketIssuer creates tickets; it does not also price them.`,
  relationships:
    "ParkingLot -> Floor -> Spot. Ticket references Spot by id, not by holding the Spot object. FeePolicy is used by the exit flow, not by Spot.",
  tradeoffs:
    "Kept pricing out of ParkingLot because a day-pass cap should not rewrite inventory. Rejected a single ParkingLotManager. For EV spots later we would add a SpotFeature flag rather than a new lot type.",
  codeSketch: `class Spot {
  park(v: Vehicle): Ticket
  free(): Vehicle
}
interface FeePolicy { fee(session): number }`,
  diagramSource: "",
};

function content(overrides: Partial<typeof meaty> = {}) {
  return new SubmissionContent("structured_design", { ...meaty, ...overrides });
}

describe("Attempt.recordSubmission", () => {
  it("stores a submission in submitted state", () => {
    const attempt = new Attempt("a1", "l1", "p1", new Date(), new Date(), []);
    const sub = attempt.recordSubmission("s1", content());
    assert.equal(sub.status, "submitted");
    assert.equal(attempt.submissions.length, 1);
  });

  it("rejects an identical design on the same attempt", () => {
    const attempt = new Attempt("a1", "l1", "p1", new Date(), new Date(), []);
    attempt.recordSubmission("s1", content());
    assert.throws(() => attempt.recordSubmission("s2", content()), ConflictError);
  });

  it("blocks a second submit while evaluation is in flight", () => {
    const attempt = new Attempt("a1", "l1", "p1", new Date(), new Date(), []);
    attempt.recordSubmission("s1", content());
    assert.throws(
      () =>
        attempt.recordSubmission(
          "s2",
          content({ tradeoffs: meaty.tradeoffs + " Also mentioned EV spots as a later flag." }),
        ),
      DomainError,
    );
  });
});

describe("Submission state machine", () => {
  it("cannot complete before evaluating", () => {
    const sub = new Submission("s", "a", new Date(), "submitted", content());
    const evaluation = new Evaluation(
      "e",
      "s",
      "test",
      [],
      "nope",
      [],
      [],
      new Date(),
      new Date(),
    );
    assert.throws(() => sub.complete(evaluation), InvalidTransitionError);
  });

  it("goes submitted -> evaluating -> completed", () => {
    const sub = new Submission("s", "a", new Date(), "submitted", content());
    sub.beginEvaluation();
    assert.equal(sub.status, "evaluating");
    const evaluation = new Evaluation(
      "e",
      "s",
      "test",
      [],
      "ok",
      [],
      [],
      new Date(),
      new Date(),
    );
    sub.complete(evaluation);
    assert.equal(sub.status, "completed");
    assert.equal(sub.evaluation, evaluation);
  });

  it("failed submissions may retry", () => {
    const sub = new Submission("s", "a", new Date(), "submitted", content());
    sub.beginEvaluation();
    sub.fail("boom");
    assert.equal(sub.canRetry(), true);
    sub.beginEvaluation();
    assert.equal(sub.status, "evaluating");
  });
});

describe("SubmissionContent", () => {
  it("rejects a thin write-up", () => {
    assert.throws(
      () =>
        new SubmissionContent("structured_design", {
          assumptions: "short",
          classDesign: "ParkingLot",
          relationships: "n/a",
          tradeoffs: "idk",
          codeSketch: "",
          diagramSource: "",
        }),
      (err: unknown) => err instanceof DomainError && (err as DomainError).code === "THIN_SUBMISSION",
    );
  });
});

const parking: LldProblem = {
  id: "prob-parking",
  slug: "parking-lot",
  title: "Parking lot",
  difficulty: "intro",
  estimatedMinutes: 35,
  blurb: "",
  prompt: "",
  constraints: [],
  functionalReqs: [
    "Park a vehicle if a legal spot exists, otherwise refuse.",
    "Issue a ticket that can later retrieve the parking session.",
    "Unpark using the ticket and return the fee.",
    "Query free-spot counts by floor and size.",
  ],
  changeScenarios: ["Add a fourth vehicle type (electric) that may only use EV-marked spots."],
  designSignals: [
    {
      token: "Spot",
      why: "inventory",
      criterionHint: "class_responsibilities",
    },
    {
      token: "Ticket",
      why: "session",
      criterionHint: "class_responsibilities",
    },
    {
      token: "Fee",
      aliases: ["FeePolicy"],
      why: "pricing",
      criterionHint: "extensibility",
    },
  ],
};

describe("evaluators", () => {
  it("scores a decent parking-lot design above a hollow one", async () => {
    const goodSub = new Submission("s1", "a", new Date(), "submitted", content());
    const hollowSub = new Submission(
      "s2",
      "a",
      new Date(),
      "submitted",
      content({
        assumptions:
          "I assume there is a parking lot and cars come in. The system should work in memory and be simple enough for an interview.",
        classDesign: `ParkingLotManager handles everything.
It has a list of spots and a list of vehicles.
HelperUtils computes fees.`,
        relationships: "The manager talks to the database of spots and to the UI layer somehow.",
        tradeoffs: "I used a manager because it is simpler. Singleton could also work here maybe.",
        codeSketch: "",
        diagramSource: "",
      }),
    );

    const evaluator = new CompositeEvaluator([
      new StructureEvaluator(),
      new HeuristicDesignEvaluator(),
    ]);

    const good = await evaluator.evaluate({
      problem: parking,
      rubric: PRACTICE_RUBRIC,
      submission: goodSub,
    });
    const hollow = await evaluator.evaluate({
      problem: parking,
      rubric: PRACTICE_RUBRIC,
      submission: hollowSub,
    });

    const goodScore = good instanceof Evaluation ? good.overallScore(PRACTICE_RUBRIC) : 0;
    const hollowScore =
      hollow instanceof Evaluation ? hollow.overallScore(PRACTICE_RUBRIC) : 0;

    assert.ok(goodScore > hollowScore, `${goodScore} should beat ${hollowScore}`);
    assert.ok(goodScore >= 50, `expected a passable score, got ${goodScore}`);
  });
});
