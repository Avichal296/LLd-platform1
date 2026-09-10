# Workbench — LLD practice platform

A small practice loop for low-level design. Pick a problem (parking lot, elevator, expense split, library), write classes and trade-offs, submit, get rubric feedback with evidence, then retry. History stays on the attempt.

This is a 2-day MVP: a monolith with a real domain model, not an LMS and not a Kubernetes diagram.

## Stack

- React + Vite + Tailwind CSS
- Express + TypeScript
- PostgreSQL + Prisma
- Docker Compose for the full stack

## Quick start (Docker)

```bash
docker compose up --build
```

- App: http://localhost:43123
- API: http://localhost:43124/api/health

## Quick start (local)

You need Node 22+ and PostgreSQL 16.

```bash
# database
createdb lld_practice   # or use the docker postgres service only
# default url used by the server:
# postgresql://lld:7ca45de627a857e14f9cd01237d42f480b5b1e59905bfd35632ea285fd0e5234@localhost:5432/lld_practice

cd server
cp .env.example .env    # already matches the docker user/password
npm install
npx prisma generate
npx prisma db push
npm run seed
npm run dev             # :43124

# another terminal
cd web
npm install
npm run dev             # :43123, proxies /api → :43124
```

Open http://localhost:43123.

## Deploy

Cursor **Publish** (Vercel) is wired via `vercel.json`. The UI is the Vite build; `/api` is a serverless Express handler. Without `DATABASE_URL`, Vercel uses the in-memory store (fine for a demo; data does not survive cold starts). With `DATABASE_URL` pointed at a hosted Postgres, local/Docker still use Prisma as the real store.

```bash
# Vercel CLI (from repo root, after `vercel login`)
npx vercel
```

```bash
cd server
npm test
```

Covers the attempt/submission state machine, thin-submission rejection, duplicate content, and that a decent parking-lot write-up outscores a `ParkingLotManager` dump.

## What is in the box

- 4 LLD problems with constraints and change scenarios
- Structured studio (assumptions, types, relationships, trade-offs, optional code/diagram)
- Submission states: `submitted` → `evaluating` → `completed` / `failed`
- Composite evaluator (structure + heuristic signals). No LLM key required
- Attempt history and score delta vs the previous submission
- Research, design, and AI-usage notes at the repo root

## Limitations

- Learners are a display name in `localStorage`, not real accounts
- Evaluation is heuristic, not a staff engineer
- Diagrams are stored, not rendered
- One process holds the evaluation queue; see DESIGN.md for the first split

## Zip for offline use

`lld-practice-platform.zip` at the repo root (no `node_modules`). Unzip, run the local or Docker steps above.

## Assignment notes

Read `RESEARCH.md`, `DESIGN.md`, and `AI_USAGE.md` with this file. Google Form submission is on you; this repo is the prototype + write-up.
