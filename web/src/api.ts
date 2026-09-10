export type Difficulty = "intro" | "core" | "stretch";

export type Problem = {
  id: string;
  slug: string;
  title: string;
  difficulty: Difficulty;
  estimatedMinutes: number;
  blurb: string;
  prompt: string;
  constraints: string[];
  functionalReqs: string[];
  changeScenarios: string[];
};

export type Rubric = {
  id: string;
  name: string;
  criteria: Array<{
    key: string;
    title: string;
    weight: number;
    question: string;
    maxScore: number;
  }>;
};

export type CriterionResult = {
  criterionKey: string;
  title: string;
  score: number;
  maxScore: number;
  evidence: string;
  concern: string;
  suggestion: string;
  confidence: number;
};

export type EvaluationView = {
  id: string;
  evaluatorKind: string;
  overallScore: number;
  summary: string;
  strengths: string[];
  nextFocus: string[];
  criterionResults: CriterionResult[];
  completedAt: string;
};

export type SubmissionView = {
  id: string;
  attemptId: string;
  createdAt: string;
  status: "submitted" | "evaluating" | "completed" | "failed";
  failReason: string | null;
  format: string;
  content: {
    assumptions: string;
    classDesign: string;
    relationships: string;
    tradeoffs: string;
    codeSketch: string;
    diagramSource: string;
  };
  evaluation: EvaluationView | null;
};

export type AttemptView = {
  id: string;
  learnerId: string;
  problemId: string;
  startedAt: string;
  lastActivityAt: string;
  submissions: SubmissionView[];
};

const base = "";

async function http<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${base}${path}`, {
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    ...init,
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(body.error ?? `Request failed (${res.status})`);
    (err as Error & { code?: string }).code = body.code;
    throw err;
  }
  return body as T;
}

export const api = {
  createLearner: (displayName: string) =>
    http<{ id: string; displayName: string }>("/api/learners", {
      method: "POST",
      body: JSON.stringify({ displayName }),
    }),
  listProblems: () => http<Problem[]>("/api/problems"),
  getProblem: (slug: string) => http<{ problem: Problem; rubric: Rubric }>(`/api/problems/${slug}`),
  startAttempt: (learnerId: string, problemId: string, displayName?: string) =>
    http<{ attempt: AttemptView; problem: Problem; rubric: Rubric }>("/api/attempts", {
      method: "POST",
      body: JSON.stringify({ learnerId, problemId, displayName }),
    }).then((data) => {
      cacheAttempt(data);
      return data;
    }),
  getAttempt: (id: string) =>
    http<{ attempt: AttemptView; problem: Problem; rubric: Rubric }>(`/api/attempts/${id}`).then(
      (data) => {
        cacheAttempt(data);
        return data;
      },
    ),
  history: (learnerId: string) =>
    http<Array<{ attempt: AttemptView; problem: Problem | null }>>(
      `/api/learners/${learnerId}/history`,
    ),
  submit: (attemptId: string, payload: Record<string, string>) =>
    http<SubmissionView>(`/api/attempts/${attemptId}/submissions`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  getSubmission: (id: string) =>
    http<{
      submission: SubmissionView;
      attempt: AttemptView;
      problem: Problem;
      rubric: Rubric;
    }>(`/api/submissions/${id}`),
  retry: (id: string) =>
    http<SubmissionView>(`/api/submissions/${id}/retry`, { method: "POST" }),
};

const LEARNER_KEY = "workbench.learner";

export function readLearner(): { id: string; displayName: string } | null {
  try {
    const raw = localStorage.getItem(LEARNER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function writeLearner(l: { id: string; displayName: string }) {
  localStorage.setItem(LEARNER_KEY, JSON.stringify(l));
}

const ATTEMPT_CACHE = "workbench.attempt.";

export function cacheAttempt(data: { attempt: AttemptView; problem: Problem; rubric: Rubric }) {
  try {
    sessionStorage.setItem(ATTEMPT_CACHE + data.attempt.id, JSON.stringify(data));
  } catch {
    /* quota */
  }
}

export function readCachedAttempt(id: string): {
  attempt: AttemptView;
  problem: Problem;
  rubric: Rubric;
} | null {
  try {
    const raw = sessionStorage.getItem(ATTEMPT_CACHE + id);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
