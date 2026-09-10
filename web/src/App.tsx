import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  api,
  cacheAttempt,
  readCachedAttempt,
  readLearner,
  writeLearner,
  type AttemptView,
  type Problem,
  type Rubric,
  type SubmissionView,
} from "./api.ts";

type Route =
  | { name: "home" }
  | { name: "problem"; slug: string }
  | { name: "attempt"; id: string }
  | { name: "review"; id: string }
  | { name: "history" };

function parseRoute(): Route {
  const path = window.location.pathname.replace(/\/+$/, "") || "/";
  const parts = path.split("/").filter(Boolean);
  if (parts[0] === "problems" && parts[1]) return { name: "problem", slug: parts[1] };
  if (parts[0] === "attempts" && parts[1]) return { name: "attempt", id: parts[1] };
  if (parts[0] === "review" && parts[1]) return { name: "review", id: parts[1] };
  if (parts[0] === "history") return { name: "history" };
  return { name: "home" };
}

function go(href: string) {
  window.history.pushState({}, "", href);
  window.dispatchEvent(new Event("popstate"));
}

function routeKey(route: Route) {
  if (route.name === "problem") return `problem:${route.slug}`;
  if (route.name === "attempt") return `attempt:${route.id}`;
  if (route.name === "review") return `review:${route.id}`;
  return route.name;
}

export default function App() {
  const [route, setRoute] = useState<Route>(parseRoute);
  const [learner, setLearner] = useState(readLearner);

  useEffect(() => {
    const onPop = () => setRoute(parseRoute());
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  useEffect(() => {
    if (learner) return;
    api.createLearner("Guest").then((l) => {
      writeLearner(l);
      setLearner(l);
    });
  }, [learner]);

  return (
    <div className="min-h-screen">
      <header className="site-header">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-5 py-4">
          <button type="button" onClick={() => go("/")} className="text-left transition-opacity hover:opacity-80">
            <div className="font-display text-xl tracking-tight">Workbench</div>
            <div className="text-xs uppercase tracking-[0.18em] text-mute">LLD practice</div>
          </button>
          <nav className="flex items-center gap-5 text-sm">
            <button type="button" className="nav-link" onClick={() => go("/")}>
              Problems
            </button>
            <button type="button" className="nav-link" onClick={() => go("/history")}>
              Attempts
            </button>
            <NameBadge
              learner={learner}
              onRename={async (displayName) => {
                const l = await api.createLearner(displayName);
                writeLearner(l);
                setLearner(l);
              }}
            />
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-5 py-8">
        <div key={routeKey(route)} className="page-enter">
          {route.name === "home" && <Catalog />}
          {route.name === "problem" && learner && (
            <ProblemPage slug={route.slug} learnerId={learner.id} />
          )}
          {route.name === "attempt" && <AttemptPage id={route.id} />}
          {route.name === "review" && <ReviewPage id={route.id} />}
          {route.name === "history" && learner && <HistoryPage learnerId={learner.id} />}
        </div>
      </main>
    </div>
  );
}

function NameBadge({
  learner,
  onRename,
}: {
  learner: { displayName: string } | null;
  onRename: (name: string) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(learner?.displayName ?? "");
  useEffect(() => setName(learner?.displayName ?? ""), [learner]);
  return (
    <div className="relative">
      <button
        type="button"
        className="rounded-full border border-line bg-card px-3 py-1 text-sm transition hover:border-copper"
        onClick={() => setOpen((v) => !v)}
      >
        {learner?.displayName ?? "…"}
      </button>
      {open && (
        <form
          className="menu-in absolute right-0 z-10 mt-2 w-56 rounded-md border border-line bg-card p-3 shadow-lg"
          onSubmit={async (e) => {
            e.preventDefault();
            await onRename(name);
            setOpen(false);
          }}
        >
          <label className="text-xs text-mute">Display name</label>
          <input
            className="mt-1 w-full rounded border border-line bg-paper px-2 py-1"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <button className="btn-primary mt-2 w-full rounded bg-ink px-2 py-1 text-paper" type="submit">
            Save
          </button>
        </form>
      )}
    </div>
  );
}

function Catalog() {
  const [problems, setProblems] = useState<Problem[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    api.listProblems().then(setProblems).catch((e) => setErr(e.message));
  }, []);
  if (err) return <ErrorBox message={err} />;
  if (!problems) return <CatalogSkeleton />;
  if (!problems.length) return <p className="text-mute">No problems seeded yet.</p>;
  return (
    <div>
      <h1 className="font-display text-4xl leading-tight sm:text-5xl">Practice a design, not a score.</h1>
      <p className="mt-3 max-w-2xl text-mute">
        Pick a small object-oriented problem. Write classes, relationships, and the trade-off you
        almost made. Submit. Get a rubric back with evidence, not a 100-point vibe check.
      </p>
      <ul className="stagger mt-8 grid gap-4 sm:grid-cols-2">
        {problems.map((p) => (
          <li key={p.id}>
            <button
              type="button"
              onClick={() => go(`/problems/${p.slug}`)}
              className="problem-card group h-full w-full rounded-lg border border-line bg-card p-5 text-left"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs uppercase tracking-widest text-mute">
                  {p.difficulty} · {p.estimatedMinutes} min
                </span>
                <span className="text-xs text-copper opacity-0 transition group-hover:opacity-100">Open →</span>
              </div>
              <h2 className="mt-2 font-display text-2xl">{p.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-mute">{p.blurb}</p>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ProblemPage({ slug, learnerId }: { slug: string; learnerId: string }) {
  const [data, setData] = useState<{ problem: Problem; rubric: Rubric } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    api.getProblem(slug).then(setData).catch((e) => setErr(e.message));
  }, [slug]);
  if (err) return <ErrorBox message={err} />;
  if (!data) return <TextSkeleton lines={8} />;
  const p = data.problem;
  return (
    <article>
      <button type="button" className="quiet-link text-sm text-mute" onClick={() => go("/")}>
        ← All problems
      </button>
      <p className="mt-4 text-xs uppercase tracking-widest text-mute">
        {p.difficulty} · about {p.estimatedMinutes} minutes
      </p>
      <h1 className="mt-1 font-display text-4xl">{p.title}</h1>
      <div className="mt-6 whitespace-pre-wrap leading-relaxed">{p.prompt}</div>
      <Section title="Constraints">
        <ul className="list-disc pl-5 text-sm leading-7">
          {p.constraints.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>
      </Section>
      <Section title="What a solution must do">
        <ul className="list-disc pl-5 text-sm leading-7">
          {p.functionalReqs.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>
      </Section>
      <Section title="Change you should design for">
        <ul className="list-disc pl-5 text-sm leading-7">
          {p.changeScenarios.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>
      </Section>
      <Section title="How this will be judged">
        <ul className="divide-y divide-line rounded-md border border-line bg-card">
          {data.rubric.criteria.map((c) => (
            <li key={c.key} className="px-4 py-3">
              <div className="font-medium">{c.title}</div>
              <div className="text-sm text-mute">{c.question}</div>
            </li>
          ))}
        </ul>
      </Section>
      <button
        type="button"
        disabled={busy}
        className="btn-primary mt-8 rounded-md bg-copper px-5 py-2.5 text-paper hover:bg-copper-dark disabled:opacity-60"
        onClick={async () => {
          setBusy(true);
          try {
            const { attempt, problem, rubric } = await api.startAttempt(
              learnerId,
              p.id,
              readLearner()?.displayName,
            );
            cacheAttempt({ attempt, problem, rubric });
            go(`/attempts/${attempt.id}`);
          } catch (e) {
            setErr(e instanceof Error ? e.message : "Could not start");
            setBusy(false);
          }
        }}
      >
        {busy ? "Starting…" : "Start an attempt"}
      </button>
    </article>
  );
}

function AttemptPage({ id }: { id: string }) {
  const [data, setData] = useState<{
    attempt: AttemptView;
    problem: Problem;
    rubric: Rubric;
  } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const latest = data?.attempt.submissions.at(-1);
  const draftKey = `workbench.draft.${id}`;
  const [form, setForm] = useState({
    assumptions: "",
    classDesign: "",
    relationships: "",
    tradeoffs: "",
    codeSketch: "",
    diagramSource: "",
  });

  useEffect(() => {
    let cancelled = false;
    const cached = readCachedAttempt(id);
    if (cached) setData(cached);
    api
      .getAttempt(id)
      .then((d) => {
        if (cancelled) return;
        setData(d);
        const saved = localStorage.getItem(draftKey);
        if (saved) {
          try {
            setForm(JSON.parse(saved));
          } catch {
            /* ignore bad drafts */
          }
        }
      })
      .catch((e) => {
        if (cancelled) return;
        if (cached) return;
        setErr(e.message);
      });
    return () => {
      cancelled = true;
    };
  }, [id, draftKey]);

  useEffect(() => {
    localStorage.setItem(draftKey, JSON.stringify(form));
  }, [form, draftKey]);

  if (err) return <ErrorBox message={err} />;
  if (!data) return <TextSkeleton lines={10} />;

  const locked = latest?.status === "submitted" || latest?.status === "evaluating";

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_280px]">
      <div>
        <p className="text-xs uppercase tracking-widest text-mute">{data.problem.title}</p>
        <h1 className="font-display text-3xl">Design studio</h1>
        <p className="mt-2 text-sm text-mute">
          Structured text is the submission format. Optional code and mermaid are extra evidence,
          not a second product.
        </p>
        <Field
          label="Assumptions & scope"
          hint="What you are not building. Who the user is. What can fail."
          value={form.assumptions}
          onChange={(v) => setForm({ ...form, assumptions: v })}
          rows={6}
        />
        <Field
          label="Classes / types and responsibilities"
          hint="One type per block. Start lines with the type name."
          value={form.classDesign}
          onChange={(v) => setForm({ ...form, classDesign: v })}
          rows={12}
          mono
        />
        <Field
          label="Relationships"
          hint="Who knows whom. What is passed by id vs held directly."
          value={form.relationships}
          onChange={(v) => setForm({ ...form, relationships: v })}
          rows={6}
        />
        <Field
          label="Trade-offs"
          hint="Name the design you rejected. Mention at least one change scenario from the prompt."
          value={form.tradeoffs}
          onChange={(v) => setForm({ ...form, tradeoffs: v })}
          rows={7}
        />
        <Field
          label="Code sketch (optional)"
          hint="Interfaces and method signatures. Not a compilable project."
          value={form.codeSketch}
          onChange={(v) => setForm({ ...form, codeSketch: v })}
          rows={8}
          mono
        />
        <Field
          label="Diagram source (optional mermaid)"
          hint="classDiagram is enough. We store it so a later renderer can sit here."
          value={form.diagramSource}
          onChange={(v) => setForm({ ...form, diagramSource: v })}
          rows={8}
          mono
        />
        {err && <ErrorBox message={err} />}
        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            disabled={busy || locked}
            className="btn-primary rounded-md bg-copper px-5 py-2.5 text-paper disabled:opacity-50"
            onClick={async () => {
              setBusy(true);
              setErr(null);
              try {
                const sub = await api.submit(id, {
                  ...form,
                  learnerId: data.attempt.learnerId,
                  problemId: data.problem.id,
                });
                go(`/review/${sub.id}`);
              } catch (e) {
                setErr(e instanceof Error ? e.message : "Submit failed");
                setBusy(false);
              }
            }}
          >
            {locked ? "Evaluation in flight" : busy ? "Submitting…" : "Submit for review"}
          </button>
          {latest && (
            <button type="button" className="quiet-link text-sm text-mute" onClick={() => go(`/review/${latest.id}`)}>
              Open last submission
            </button>
          )}
        </div>
      </div>
      <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
        <div className="panel rounded-lg border border-line bg-card p-4 text-sm">
          <h2 className="font-medium">Prompt (short)</h2>
          <p className="mt-2 whitespace-pre-wrap text-mute">{data.problem.prompt.slice(0, 420)}…</p>
        </div>
        <div className="panel rounded-lg border border-line bg-card p-4 text-sm">
          <h2 className="font-medium">Must handle</h2>
          <ul className="mt-2 list-disc pl-4 text-mute">
            {data.problem.functionalReqs.map((r) => (
              <li key={r} className="mt-1">
                {r}
              </li>
            ))}
          </ul>
        </div>
        <div className="panel rounded-lg border border-line bg-card p-4 text-sm">
          <h2 className="font-medium">This attempt</h2>
          <p className="mt-2 text-mute">
            {data.attempt.submissions.length} submission
            {data.attempt.submissions.length === 1 ? "" : "s"} so far.
          </p>
          <ul className="mt-2 space-y-1">
            {data.attempt.submissions.map((s, i) => (
              <li key={s.id}>
                <button type="button" className="quiet-link text-copper" onClick={() => go(`/review/${s.id}`)}>
                  #{i + 1} · {s.status}
                  {s.evaluation ? ` · ${s.evaluation.overallScore}` : ""}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </aside>
    </div>
  );
}

function ReviewPage({ id }: { id: string }) {
  const [data, setData] = useState<{
    submission: SubmissionView;
    attempt: AttemptView;
    problem: Problem;
    rubric: Rubric;
  } | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let stop = false;
    async function tick() {
      try {
        const d = await api.getSubmission(id);
        if (stop) return;
        setData(d);
        if (d.submission.status === "submitted" || d.submission.status === "evaluating") {
          setTimeout(tick, 700);
        }
      } catch (e) {
        if (!stop) setErr(e instanceof Error ? e.message : "Failed");
      }
    }
    tick();
    return () => {
      stop = true;
    };
  }, [id]);

  const prev = useMemo(() => {
    if (!data) return null;
    const list = data.attempt.submissions;
    const idx = list.findIndex((s) => s.id === id);
    return idx > 0 ? list[idx - 1] : null;
  }, [data, id]);

  if (err) return <ErrorBox message={err} />;
  if (!data) return <TextSkeleton lines={8} />;

  const s = data.submission;
  const ev = s.evaluation;

  return (
    <div>
      <button type="button" className="quiet-link text-sm text-mute" onClick={() => go(`/attempts/${s.attemptId}`)}>
        ← Back to studio
      </button>
      <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-widest text-mute">{data.problem.title}</p>
          <h1 className="font-display text-3xl">Feedback</h1>
        </div>
        <StatusChip status={s.status} />
      </div>

      {(s.status === "submitted" || s.status === "evaluating") && (
        <p className="mt-6 flex items-center gap-3 text-mute">
          <span className="pulse-dot" />
          Evaluating against the rubric. This stays off the request path…
        </p>
      )}

      {s.status === "failed" && (
        <div className="mt-6">
          <ErrorBox message={s.failReason ?? "Evaluation failed"} />
          <button
            type="button"
            className="mt-3 rounded-md border border-line px-4 py-2"
            onClick={() => api.retry(s.id)}
          >
            Retry evaluation
          </button>
        </div>
      )}

      {ev && (
        <div className="mt-6">
          <div className="flex flex-wrap items-baseline gap-4">
            <CountedScore value={ev.overallScore} />
            <div className="text-sm text-mute">
              Weighted / 100 · {ev.evaluatorKind}
              <div className="mt-1 max-w-xl">{ev.summary}</div>
            </div>
          </div>
          {prev?.evaluation && (
            <p className="mt-3 text-sm">
              Previous attempt on this problem scored{" "}
              <span className="font-medium">{prev.evaluation.overallScore}</span>
              {ev.overallScore !== prev.evaluation.overallScore && (
                <>
                  {" "}
                  ({ev.overallScore > prev.evaluation.overallScore ? "up" : "down"}{" "}
                  {Math.abs(Math.round((ev.overallScore - prev.evaluation.overallScore) * 10) / 10)})
                </>
              )}
              .
            </p>
          )}
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <NoteList title="What landed" items={ev.strengths} />
            <NoteList title="Try next" items={ev.nextFocus} />
          </div>
          <ul className="stagger mt-6 space-y-3">
            {ev.criterionResults.map((c) => (
              <li key={c.criterionKey} className="panel rounded-lg border border-line bg-card p-4">
                <div className="flex items-baseline justify-between gap-3">
                  <h3 className="font-medium">{c.title}</h3>
                  <span className="tabular-nums text-sm">
                    {c.score}/{c.maxScore}
                  </span>
                </div>
                <ScoreBar ratio={c.score / c.maxScore} />
                {c.evidence && <p className="mt-2 text-sm">{c.evidence}</p>}
                {c.concern && <p className="mt-1 text-sm text-copper-dark">{c.concern}</p>}
                {c.suggestion && <p className="mt-1 text-sm text-moss">{c.suggestion}</p>}
                <p className="mt-2 text-xs text-mute">confidence {c.confidence}</p>
              </li>
            ))}
          </ul>
        </div>
      )}

      <details className="mt-8 rounded-lg border border-line bg-card p-4">
        <summary className="cursor-pointer font-medium">Your submission</summary>
        <Pre label="Assumptions" text={s.content.assumptions} />
        <Pre label="Classes" text={s.content.classDesign} />
        <Pre label="Relationships" text={s.content.relationships} />
        <Pre label="Trade-offs" text={s.content.tradeoffs} />
        {s.content.codeSketch && <Pre label="Code" text={s.content.codeSketch} />}
        {s.content.diagramSource && <Pre label="Diagram" text={s.content.diagramSource} />}
      </details>
    </div>
  );
}

function HistoryPage({ learnerId }: { learnerId: string }) {
  const [rows, setRows] = useState<Array<{ attempt: AttemptView; problem: Problem | null }> | null>(
    null,
  );
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    api.history(learnerId).then(setRows).catch((e) => setErr(e.message));
  }, [learnerId]);
  if (err) return <ErrorBox message={err} />;
  if (!rows) return <TextSkeleton lines={6} />;
  if (!rows.length) {
    return (
      <div>
        <h1 className="font-display text-3xl">No attempts yet</h1>
        <p className="mt-2 text-mute">Pick a problem and submit once. History lives here so you can compare retries.</p>
        <button type="button" className="quiet-link mt-4 text-copper" onClick={() => go("/")}>
          Browse problems
        </button>
      </div>
    );
  }
  return (
    <div>
      <h1 className="font-display text-3xl">Attempt history</h1>
      <ul className="mt-6 divide-y divide-line rounded-lg border border-line bg-card">
        {rows.map(({ attempt, problem }) => {
          const latest = attempt.submissions.at(-1);
          return (
            <li key={attempt.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-4 transition hover:bg-paper/70">
              <div>
                <div className="font-medium">{problem?.title ?? "Unknown problem"}</div>
                <div className="text-sm text-mute">
                  {attempt.submissions.length} submission
                  {attempt.submissions.length === 1 ? "" : "s"}
                  {latest?.evaluation ? ` · latest ${latest.evaluation.overallScore}` : latest ? ` · ${latest.status}` : ""}
                </div>
              </div>
              <button
                type="button"
                className="quiet-link text-sm text-copper"
                onClick={() => go(`/attempts/${attempt.id}`)}
              >
                Continue
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function Field({
  label,
  hint,
  value,
  onChange,
  rows,
  mono,
}: {
  label: string;
  hint: string;
  value: string;
  onChange: (v: string) => void;
  rows: number;
  mono?: boolean;
}) {
  return (
    <label className="mt-6 block">
      <span className="font-medium">{label}</span>
      <span className="mt-0.5 block text-sm text-mute">{hint}</span>
      <textarea
        className={`field-box mt-2 w-full rounded-md border border-line bg-card px-3 py-2 leading-relaxed outline-none ${mono ? "font-mono text-sm" : ""}`}
        rows={rows}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="font-display text-2xl">{title}</h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function ErrorBox({ message }: { message: string }) {
  return (
    <div className="mt-4 rounded-md border border-copper/40 bg-card px-3 py-2 text-sm text-copper-dark badge-pop">
      {message}
    </div>
  );
}

function StatusChip({ status }: { status: SubmissionView["status"] }) {
  const label =
    status === "completed"
      ? "Completed"
      : status === "failed"
        ? "Failed"
        : status === "evaluating"
          ? "Evaluating"
          : "Submitted";
  return (
    <span className="badge-pop inline-flex items-center gap-2 rounded-full border border-line bg-card px-3 py-1 text-sm text-mute">
      {(status === "evaluating" || status === "submitted") && <span className="pulse-dot" />}
      {label}
    </span>
  );
}

function ScoreBar({ ratio }: { ratio: number }) {
  return (
    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-line">
      <div
        className="score-fill h-full bg-moss"
        style={{ width: `${Math.round(Math.min(1, Math.max(0, ratio)) * 100)}%` }}
      />
    </div>
  );
}

function NoteList({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="panel rounded-lg border border-line bg-card p-4">
      <h3 className="font-medium">{title}</h3>
      {items.length ? (
        <ul className="mt-2 list-disc pl-4 text-sm leading-6">
          {items.map((i) => (
            <li key={i}>{i}</li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-mute">Nothing recorded.</p>
      )}
    </div>
  );
}

function CatalogSkeleton() {
  return (
    <div>
      <div className="skel h-12 w-4/5 max-w-xl" />
      <div className="skel mt-4 h-16 w-full max-w-2xl" />
      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="skel h-36" />
        ))}
      </div>
    </div>
  );
}

function TextSkeleton({ lines }: { lines: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: lines }, (_, i) => (
        <div key={i} className="skel h-4" style={{ width: `${70 + ((i * 13) % 25)}%` }} />
      ))}
    </div>
  );
}

function CountedScore({ value }: { value: number }) {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setShown(value);
      return;
    }
    const start = performance.now();
    const from = 0;
    const dur = 700;
    let frame = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / dur);
      const eased = 1 - (1 - t) * (1 - t);
      setShown(Math.round((from + (value - from) * eased) * 10) / 10);
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value]);
  return <div className="font-display text-5xl tabular-nums">{shown}</div>;
}

function Pre({ label, text }: { label: string; text: string }) {
  return (
    <div className="mt-4">
      <div className="text-xs uppercase tracking-widest text-mute">{label}</div>
      <pre className="mt-1 overflow-x-auto whitespace-pre-wrap font-mono text-sm leading-relaxed">{text}</pre>
    </div>
  );
}
