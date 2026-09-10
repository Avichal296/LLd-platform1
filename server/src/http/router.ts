import express from "express";
import { DomainError } from "../domain/errors.ts";
import { PRACTICE_RUBRIC } from "../domain/rubric.ts";
import type { PracticeService } from "../application/practice-service.ts";
import { Submission } from "../domain/submission.ts";
import { Attempt } from "../domain/attempt.ts";
import type { LldProblem } from "../domain/problem.ts";

export function createRouter(practice: PracticeService) {
  const router = express.Router();

  router.post("/learners", async (req, res, next) => {
    try {
      const learner = await practice.register(String(req.body?.displayName ?? ""));
      res.status(201).json(learner);
    } catch (err) {
      next(err);
    }
  });

  router.get("/problems", async (_req, res, next) => {
    try {
      const problems = await practice.listProblems();
      res.json(problems.map(publicProblem));
    } catch (err) {
      next(err);
    }
  });

  router.get("/problems/:slug", async (req, res, next) => {
    try {
      const { problem, rubric } = await practice.getProblem(String(req.params.slug));
      res.json({ problem: publicProblem(problem, true), rubric });
    } catch (err) {
      next(err);
    }
  });

  router.post("/attempts", async (req, res, next) => {
    try {
      const { attempt, problem, rubric } = await practice.startAttempt(
        String(req.body.learnerId),
        String(req.body.problemId),
        String(req.body.displayName ?? "Guest"),
      );
      res.status(201).json({
        attempt: serializeAttempt(attempt),
        problem: publicProblem(problem, true),
        rubric,
      });
    } catch (err) {
      next(err);
    }
  });

  router.get("/attempts/:id", async (req, res, next) => {
    try {
      const { attempt, problem, rubric } = await practice.getAttempt(String(req.params.id));
      res.json({
        attempt: serializeAttempt(attempt),
        problem: publicProblem(problem, true),
        rubric,
      });
    } catch (err) {
      next(err);
    }
  });

  router.get("/learners/:id/history", async (req, res, next) => {
    try {
      const rows = await practice.history(String(req.params.id));
      res.json(
        rows.map((r) => ({
          attempt: serializeAttempt(r.attempt),
          problem: r.problem ? publicProblem(r.problem) : null,
        })),
      );
    } catch (err) {
      next(err);
    }
  });

  router.post("/attempts/:id/submissions", async (req, res, next) => {
    try {
      const submission = await practice.submit(String(req.params.id), req.body);
      res.status(202).json(serializeSubmission(submission));
    } catch (err) {
      next(err);
    }
  });

  router.get("/submissions/:id", async (req, res, next) => {
    try {
      const { submission, attempt, problem, rubric } = await practice.getSubmission(String(req.params.id));
      res.json({
        submission: serializeSubmission(submission),
        attempt: serializeAttempt(attempt),
        problem: publicProblem(problem, true),
        rubric,
      });
    } catch (err) {
      next(err);
    }
  });

  router.post("/submissions/:id/retry", async (req, res, next) => {
    try {
      const submission = await practice.retryEvaluation(String(req.params.id));
      res.json(serializeSubmission(submission));
    } catch (err) {
      next(err);
    }
  });

  router.get("/rubric", (_req, res) => {
    res.json(PRACTICE_RUBRIC);
  });

  router.get("/health", (_req, res) => {
    res.json({ ok: true });
  });

  return router;
}

export function errorHandler(
  err: unknown,
  _req: express.Request,
  res: express.Response,
  _next: express.NextFunction,
) {
  if (err instanceof DomainError) {
    res.status(err.httpStatus).json({ error: err.message, code: err.code });
    return;
  }
  console.error(err);
  const detail = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
  res.status(500).json({ error: "Something broke on the server.", code: "INTERNAL", detail });

}

function publicProblem(problem: LldProblem, includeSignals = false) {
  return {
    id: problem.id,
    slug: problem.slug,
    title: problem.title,
    difficulty: problem.difficulty,
    estimatedMinutes: problem.estimatedMinutes,
    blurb: problem.blurb,
    prompt: problem.prompt,
    constraints: problem.constraints,
    functionalReqs: problem.functionalReqs,
    changeScenarios: problem.changeScenarios,
    // signals stay server-side so the learner cannot just echo the answer key
    ...(includeSignals ? {} : {}),
  };
}

function serializeAttempt(attempt: Attempt) {
  return {
    id: attempt.id,
    learnerId: attempt.learnerId,
    problemId: attempt.problemId,
    startedAt: attempt.startedAt,
    lastActivityAt: attempt.lastActivityAt,
    submissions: attempt.submissions.map(serializeSubmission),
  };
}

function serializeSubmission(submission: Submission) {
  const f = submission.content.fields;
  const evaluation = submission.evaluation;
  return {
    id: submission.id,
    attemptId: submission.attemptId,
    createdAt: submission.createdAt,
    status: submission.status,
    failReason: submission.failReason,
    format: submission.content.format,
    content: f,
    evaluation: evaluation
      ? {
          id: evaluation.id,
          evaluatorKind: evaluation.evaluatorKind,
          overallScore: evaluation.overallScore(PRACTICE_RUBRIC),
          summary: evaluation.summary,
          strengths: evaluation.strengths,
          nextFocus: evaluation.nextFocus,
          criterionResults: evaluation.criterionResults,
          completedAt: evaluation.completedAt,
        }
      : null,
  };
}
