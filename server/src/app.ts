import cors from "cors";
import express from "express";
import { PracticeService } from "./application/practice-service.ts";
import type { AttemptRepository, LearnerRepository, ProblemRepository } from "./application/ports.ts";
import { buildDefaultEvaluator } from "./evaluators/build.ts";
import { createRouter, errorHandler } from "./http/router.ts";
import {
  MemoryAttemptRepository,
  MemoryLearnerRepository,
  MemoryProblemRepository,
} from "./infra/memory-repos.ts";

const jobs: Array<() => Promise<void>> = [];
let draining = false;

function enqueue(work: () => Promise<void>) {
  jobs.push(work);
  void drain();
}

async function drain() {
  if (draining) return;
  draining = true;
  while (jobs.length) {
    const job = jobs.shift();
    if (!job) break;
    try {
      await job();
    } catch (err) {
      console.error("queue job failed", err);
    }
  }
  draining = false;
}

export function buildAppFromRepos(
  problems: ProblemRepository,
  attempts: AttemptRepository,
  learners: LearnerRepository,
) {
  const practice = new PracticeService(
    problems,
    attempts,
    learners,
    buildDefaultEvaluator(),
    enqueue,
  );

  const app = express();
  app.use(cors({ origin: true }));
  app.use(express.json({ limit: "1mb" }));
  app.use("/api", createRouter(practice));
  app.use(errorHandler);
  return app;
}

function memoryBundle() {
  const g = globalThis as typeof globalThis & {
    __lldMem?: {
      problems: MemoryProblemRepository;
      attempts: MemoryAttemptRepository;
      learners: MemoryLearnerRepository;
    };
  };
  if (!g.__lldMem) {
    g.__lldMem = {
      problems: new MemoryProblemRepository(),
      attempts: new MemoryAttemptRepository(),
      learners: new MemoryLearnerRepository(),
    };
  }
  return g.__lldMem;
}

export function buildMemoryApp() {
  const mem = memoryBundle();
  return buildAppFromRepos(mem.problems, mem.attempts, mem.learners);
}

export async function buildApp() {
  if (!process.env.DATABASE_URL) {
    return buildMemoryApp();
  }
  const { PrismaAttemptRepository, PrismaLearnerRepository, PrismaProblemRepository } =
    await import("./infra/prisma-repos.ts");
  return buildAppFromRepos(
    new PrismaProblemRepository(),
    new PrismaAttemptRepository(),
    new PrismaLearnerRepository(),
  );
}
