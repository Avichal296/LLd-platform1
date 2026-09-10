# Design note

## MVP

A learner picks a problem, writes a structured design in the studio, submits, waits for a rubric-backed evaluation, then either retries on the same attempt or starts a fresh one. Previous submissions stay attached to the attempt.

User flow:

1. Open catalog.
2. Read prompt, constraints, change scenarios, rubric.
3. Start attempt (creates an `Attempt` aggregate).
4. Fill four required fields. Optional code / mermaid.
5. Submit → `Submission` persisted in `submitted`.
6. In-process queue moves it to `evaluating`, then `completed` or `failed`.
7. Review screen polls until done. History lists all attempts.

## Important types

| Type | Responsibility | Notes |
| --- | --- | --- |
| `LldProblem` | Prompt + signals the evaluator may look for | Signals are never sent to the browser |
| `Rubric` / `RubricCriterion` | What "good" means in this product | Versioned in code (`lld-practice-v1`) |
| `Attempt` | One sitting on one problem | Owns the submission list, duplicate detection |
| `SubmissionContent` | The artefact | Format enum is the variation point for diagrams |
| `Submission` | State machine for one artefact | `submitted → evaluating → completed \| failed` |
| `Evaluation` / `CriterionResult` | Judgement, not a chat log | Weighted overall score is derived |
| `Evaluator` (port) | Anyone who can judge | Structure + heuristic today; human/LLM later |
| `PracticeService` | Use-cases | HTTP does not own domain rules |
| `*Repository` | Persistence | Prisma stays behind the port |

HTTP and Prisma models are adapters. If evaluation becomes a worker process, `PracticeService.enqueue` is the seam.

## Evaluation

Two evaluators run as a composite.

- **Structure**: required evidence, named types, whether requirements were even mentioned, failure/test language. Deterministic.
- **Heuristic**: problem-specific `designSignals`, smell words (`Manager`, pattern salad), whether a change scenario was discussed. Still deterministic, slightly softer confidence.

AI (an LLM) is *allowed* by the assignment and would sit behind the same `Evaluator` port. This prototype does not call a model. A structured prompt + this rubric would plug in without touching Attempt. The heuristic exists so the loop works on a laptop with no keys, and so tests do not flake on a vendor.

We do not ask "is this a good design?". Each criterion is scored with evidence / concern / suggestion / confidence.

## Trade-offs

- **Structured text over UML-only.** Cheaper to build, still proves responsibilities. Change test A is the `format` field on `SubmissionContent`.
- **In-process queue over Redis.** Evaluation is milliseconds. The request still returns `202` before judging, and the row exists first, so a crash mid-eval leaves `submitted`/`evaluating` rather than losing the work. The first component to extract under load is this queue + evaluators.
- **Anonymous learner in localStorage.** Auth is not the product. A new name creates a new learner; history is scoped to that id.
- **No god "Score" object.** Overall score is a function of criterion results and rubric weights. Keeps us honest if weights change.
- **Signals stay server-side.** Otherwise people paste the answer key.

## Change tests (designed, not implemented)

The brief says not to build these now. The variation has a place.

**A — "today text, later a class diagram."**  
Learner artefact is `SubmissionContent`, not a string column on `Attempt`. `format` is `structured_design` | `class_diagram`. Diagram source already stores mermaid as extra evidence. Turning diagrams into a first-class format is: accept that format, render it on the review page. `Attempt`, `Submission` states, `Evaluation`, and `PracticeService.submit` do not change shape.

**B — "today one evaluator, later rules or a human."**  
`PracticeService` depends on `Evaluator`. HTTP never calls an implementation by name. Today `CompositeEvaluator(Structure, Heuristic)`. A `RuleEvaluator` or `HumanReviewEvaluator` (leave status `evaluating` until a reviewer posts) is another class behind the same port. The practice loop stays: persist → enqueue → complete/fail.

## Scale, kept small

| Brief | What we actually do |
| --- | --- |
| Do not block submit if eval is slow | `POST` returns `202` with `status: submitted`. Queue runs after the response. |
| Store before evaluate | `saveSubmission` happens, then `enqueue`. A crash mid-judge leaves the row. |
| Clear states | `submitted → evaluating → completed \| failed`. Invalid jumps throw. |
| Same request twice | Same attempt + same `contentHash` → `409`. One in-flight eval per attempt. |
| First thing to split | Evaluation queue + `evaluators/`. Not "problem service" vs "user service". |

No Redis, no Kubernetes, no extra processes. A monolith is the product.

## What we refused on purpose

- Microservices.
- An LMS (courses, auth walls, CMS).
- Strategy/Factory trees that do not earn their keep. One `Evaluator` port is the pattern that pays for change test B.
- `Please score this 0–100.` Feedback is criterion → score → evidence → concern → suggestion → confidence. Overall score is weighted from that, not a chat completion.
- Feature list without a working loop. Four problems, one studio, one rubric, history.

The learner problem we actually solve: **submit an LLD, get evidence-backed notes, retry on the same problem.** Everything else is allowed to wait.
