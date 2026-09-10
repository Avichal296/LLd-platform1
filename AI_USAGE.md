# AI usage

The assignment asks for a few decisions where a model was actually in the loop, not a list of prompts.

## 1. Submission format

**Suggestion:** support text, code, and diagrams equally in v1.

**What I did:** only structured text is required. Code and mermaid are optional fields on the same value object.

**Why:** a 2-day slice that draws UML well usually draws UML *instead of* modelling Attempt/Evaluation. The helping guide said to pick the smallest format that still proves design quality. Text with named types does that. The format enum is the place diagrams would land later.

## 2. Scoring

**Suggestion:** ask an LLM "rate this design 1–100" and show the number.

**What I did:** rejected that. Rubric rows are `criterion → score → evidence → concern → suggestion → confidence`. Overall score is weighted from those rows.

**Why:** a single number trains people to retry until the vibes improve. The brief explicitly warned against unconstrained "is this good?" prompts.

## 3. Domain shape

**Suggestion:** a REST app with `Problem`, `User`, `Solution` tables and logic in Express handlers.

**What I did:** an `Attempt` aggregate, a `Submission` state machine, an `Evaluator` port, Prisma as an adapter.

**Why:** LLD of *this* product is a quarter of the grade. Handlers that `prisma.submission.create` and then `if (status)` would not survive change test B (a second kind of evaluator).

## 4. Where the model should judge

**Suggestion:** send the whole write-up to an API on every submit.

**What I did:** split deterministic checks (structure, uniqueness, state) from judgement. Implemented judgement as heuristics keyed by `designSignals` on each problem. Left a comment and a port for an LLM evaluator; did not add a vendor client.

**Why:** no key in the environment should mean "the product does not work". Tests need a stable oracle. An LLM can implement `Evaluator` later and join the composite.

## 5. UI scope

**Suggestion:** dashboards, auth screens, admin CMS for problems.

**What I did:** catalog, studio, review, history. Display name in localStorage.

**Why:** extra chrome would have eaten the time that belonged to the practice loop. The helping guide was blunt about features that do not improve that loop.

Cursor wrote a lot of the boilerplate (Vite config, Prisma mapping). Class boundaries, rubric text, problem prompts, and the "no LLM in the hot path" call were mine — including pushing back on the first, fancier sketches.
