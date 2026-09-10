import { loadEnv } from "../load-env.ts";
loadEnv();

import { PrismaClient } from "@prisma/client";
import type { AttemptRepository, LearnerRepository, ProblemRepository } from "../application/ports.ts";
import { Attempt } from "../domain/attempt.ts";
import { Evaluation } from "../domain/evaluation.ts";
import type { CriterionResult } from "../domain/evaluation.ts";
import type { LldProblem } from "../domain/problem.ts";
import { PRACTICE_RUBRIC } from "../domain/rubric.ts";
import { Submission } from "../domain/submission.ts";
import type { SubmissionStatus } from "../domain/submission.ts";
import { SubmissionContent } from "../domain/submission-content.ts";
import type { SubmissionFormat } from "../domain/submission-content.ts";

export const prisma = new PrismaClient();

function toProblem(row: {
  id: string;
  slug: string;
  title: string;
  difficulty: string;
  estimatedMinutes: number;
  blurb: string;
  prompt: string;
  constraints: unknown;
  functionalReqs: unknown;
  changeScenarios: unknown;
  designSignals: unknown;
}): LldProblem {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    difficulty: row.difficulty as LldProblem["difficulty"],
    estimatedMinutes: row.estimatedMinutes,
    blurb: row.blurb,
    prompt: row.prompt,
    constraints: row.constraints as string[],
    functionalReqs: row.functionalReqs as string[],
    changeScenarios: row.changeScenarios as string[],
    designSignals: row.designSignals as LldProblem["designSignals"],
  };
}

function toSubmission(row: {
  id: string;
  attemptId: string;
  createdAt: Date;
  status: string;
  format: string;
  assumptions: string;
  classDesign: string;
  relationships: string;
  tradeoffs: string;
  codeSketch: string;
  diagramSource: string;
  failReason: string | null;
  evaluation: {
    id: string;
    submissionId: string;
    evaluatorKind: string;
    overallScore: number;
    summary: string;
    strengths: unknown;
    nextFocus: unknown;
    criterionResults: unknown;
    startedAt: Date;
    completedAt: Date | null;
    errorMessage: string | null;
  } | null;
}): Submission {
  const content = new SubmissionContent(row.format as SubmissionFormat, {
    assumptions: row.assumptions,
    classDesign: row.classDesign,
    relationships: row.relationships,
    tradeoffs: row.tradeoffs,
    codeSketch: row.codeSketch,
    diagramSource: row.diagramSource,
  });
  const evaluation = row.evaluation
    ? new Evaluation(
        row.evaluation.id,
        row.evaluation.submissionId,
        row.evaluation.evaluatorKind,
        row.evaluation.criterionResults as CriterionResult[],
        row.evaluation.summary,
        row.evaluation.strengths as string[],
        row.evaluation.nextFocus as string[],
        row.evaluation.startedAt,
        row.evaluation.completedAt ?? row.evaluation.startedAt,
        row.evaluation.errorMessage,
      )
    : null;
  return new Submission(
    row.id,
    row.attemptId,
    row.createdAt,
    row.status as SubmissionStatus,
    content,
    evaluation,
    row.failReason,
  );
}

function toAttempt(row: {
  id: string;
  learnerId: string;
  problemId: string;
  startedAt: Date;
  lastActivityAt: Date;
  submissions: Parameters<typeof toSubmission>[0][];
}): Attempt {
  return new Attempt(
    row.id,
    row.learnerId,
    row.problemId,
    row.startedAt,
    row.lastActivityAt,
    row.submissions.map(toSubmission),
  );
}

const submissionInclude = { evaluation: true } as const;

export class PrismaProblemRepository implements ProblemRepository {
  async list() {
    const rows = await prisma.problem.findMany({ orderBy: { title: "asc" } });
    return rows.map(toProblem);
  }
  async getById(id: string) {
    const row = await prisma.problem.findUnique({ where: { id } });
    return row ? toProblem(row) : null;
  }
  async getBySlug(slug: string) {
    const row = await prisma.problem.findUnique({ where: { slug } });
    return row ? toProblem(row) : null;
  }
}

export class PrismaLearnerRepository implements LearnerRepository {
  async create(id: string, displayName: string) {
    return prisma.learner.create({ data: { id, displayName } });
  }
  async get(id: string) {
    return prisma.learner.findUnique({ where: { id } });
  }
  async ensure(id: string, displayName: string) {
    return prisma.learner.upsert({
      where: { id },
      create: { id, displayName },
      update: { displayName },
    });
  }
}

export class PrismaAttemptRepository implements AttemptRepository {
  async save(attempt: Attempt) {
    await prisma.attempt.upsert({
      where: { id: attempt.id },
      create: {
        id: attempt.id,
        learnerId: attempt.learnerId,
        problemId: attempt.problemId,
        startedAt: attempt.startedAt,
        lastActivityAt: attempt.lastActivityAt,
      },
      update: { lastActivityAt: attempt.lastActivityAt },
    });
  }

  async get(id: string) {
    const row = await prisma.attempt.findUnique({
      where: { id },
      include: { submissions: { include: submissionInclude, orderBy: { createdAt: "asc" } } },
    });
    return row ? toAttempt(row) : null;
  }

  async listByLearner(learnerId: string) {
    const rows = await prisma.attempt.findMany({
      where: { learnerId },
      include: { submissions: { include: submissionInclude, orderBy: { createdAt: "asc" } } },
      orderBy: { lastActivityAt: "desc" },
    });
    return rows.map(toAttempt);
  }

  async saveSubmission(submission: Submission) {
    const f = submission.content.fields;
    await prisma.submission.upsert({
      where: { id: submission.id },
      create: {
        id: submission.id,
        attemptId: submission.attemptId,
        createdAt: submission.createdAt,
        status: submission.status,
        format: submission.content.format,
        assumptions: f.assumptions,
        classDesign: f.classDesign,
        relationships: f.relationships,
        tradeoffs: f.tradeoffs,
        codeSketch: f.codeSketch,
        diagramSource: f.diagramSource,
        contentHash: submission.content.contentHash(),
        failReason: submission.failReason,
      },
      update: {
        status: submission.status,
        failReason: submission.failReason,
      },
    });
    await prisma.attempt.update({
      where: { id: submission.attemptId },
      data: { lastActivityAt: new Date() },
    });
  }

  async saveEvaluation(evaluation: Evaluation) {
    await prisma.evaluation.upsert({
      where: { submissionId: evaluation.submissionId },
      create: {
        id: evaluation.id,
        submissionId: evaluation.submissionId,
        evaluatorKind: evaluation.evaluatorKind,
        overallScore: evaluation.overallScore(PRACTICE_RUBRIC),
        summary: evaluation.summary,
        strengths: evaluation.strengths,
        nextFocus: evaluation.nextFocus,
        criterionResults: evaluation.criterionResults,
        startedAt: evaluation.startedAt,
        completedAt: evaluation.completedAt,
        errorMessage: evaluation.errorMessage,
      },
      update: {
        evaluatorKind: evaluation.evaluatorKind,
        overallScore: evaluation.overallScore(PRACTICE_RUBRIC),
        summary: evaluation.summary,
        strengths: evaluation.strengths,
        nextFocus: evaluation.nextFocus,
        criterionResults: evaluation.criterionResults,
        completedAt: evaluation.completedAt,
        errorMessage: evaluation.errorMessage,
      },
    });
  }

  async getSubmission(id: string) {
    const row = await prisma.submission.findUnique({
      where: { id },
      include: submissionInclude,
    });
    return row ? toSubmission(row) : null;
  }
}
