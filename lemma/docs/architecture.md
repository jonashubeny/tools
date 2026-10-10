# Architecture

## 1. Shape

```
                      ┌──────────────────────── one container ───────────────────────┐
 browser ── HTTPS ──▶ │  Node 22                                                     │
 (via reverse proxy   │  ┌──────────────┐   ┌──────────────────────────────────────┐ │
  or Cloudflare       │  │ static files │   │ API (Hono)                           │ │
  Tunnel)             │  │ built SPA    │   │  auth · practice · plan · exam ·     │ │
                      │  └──────────────┘   │  errors · analytics · tutor · admin  │ │
                      │                     │  teach (one gate per student)        │ │
                      │                     └───────┬───────────────┬──────────────┘ │
                      │   in-process jobs           │               │                │
                      │   (backup, forge sync)      ▼               ▼                │
                      │                     ┌─────────────┐  ┌─────────────────┐     │
                      │                     │ @lemma/core │  │ @lemma/content  │     │
                      │                     │ pure logic  │  │ typed curriculum│     │
                      │                     └─────────────┘  └─────────────────┘     │
                      │                             │                                │
                      │                      ┌──────▼──────┐                         │
                      │                      │ SQLite (WAL)│── /data volume          │
                      │                      └─────────────┘   lemma.sqlite, backups/│
                      └───────────────────────────────────────────────────────────────┘
        optional, outbound only:  LLM endpoint · api.github.com · a Forgejo instance
```

One process, one database file, one volume. Outbound calls are optional and the app runs
without any of them.

## 2. Packages

| Package | Contains | Depends on |
|---|---|---|
| `@lemma/core` | Expression parser and evaluator, answer checking, error inference, mastery, scheduling, selection of the next skill, placement, path states, readiness, session planning, streaks, exam scoring, graph layout, content *types* | `ts-fsrs` |
| `@lemma/content` | Concepts, lessons, generators, static problems, missions, FIT snapshots, syllabus; goals, the entrance specification and the classified past papers | core |
| `@lemma/server` | HTTP API, SQLite access, auth, jobs, tutor, integrations, teaching; simulated learners for tests and demonstrations (`src/dev`) | core, content |
| `@lemma/web` | React single-page app | core (types, parser, figure maths) |

Rules that keep this maintainable:

- **`core` is pure.** No I/O, no clock, no randomness that is not passed in. Every function
  takes `now` and a seeded generator as arguments. That is what makes mastery, streaks and
  scheduling testable to the day.
- **`content` never imports `server` or `web`.**
- **`web` never imports `content`.** Solutions, hints and answers stay on the server and
  arrive only when the API decides to send them.
- Internal packages export TypeScript source directly; there is no build step between
  them. Vite bundles the web app, esbuild bundles the server into one file.

## 3. Technology choices

| Choice | Why | Rejected alternatives |
|---|---|---|
| **TypeScript everywhere** | One language across domain logic, content and UI; the parser that checks answers on the server also typesets the preview in the browser. | Python/FastAPI + SymPy: strong CAS, but two languages, duplicated types, a second runtime — and the Czech-notation parser would have to be written anyway. |
| **React + Vite, SPA** | The app is a signed-in, highly interactive tool; nothing needs server rendering or SEO. | Next.js: server components and caching semantics add concepts with no payoff here, and long-lived in-process jobs fit awkwardly. |
| **Hono on Node** | Small, typed, standards-based request/response; easy to test without a network. | Express (older typing story), Fastify (fine; more than needed). |
| **SQLite via better-sqlite3** | Single user, single writer. Zero administration, one file to back up, synchronous API that makes transactions trivial. | PostgreSQL: a second container, credentials and dumps to serve one person. |
| **Plain SQL migrations** | The schema is small and event-centric. SQL does not churn; ORMs do. Anyone can open the file with `sqlite3`. | Drizzle/Prisma: good tools, but a pre-1.0 dependency in the critical path of a multi-year project. |
| **Tailwind 4 + CSS variables** | Dense custom UI built quickly; theme switching is a variable swap. | Component libraries: fight the visual identity. |
| **In-house SVG figure kit** | See `research.md` §4.1. | Mafs (stale), JSXGraph (kept for later), Desmos/GeoGebra (external). |
| **In-house expression engine** | See `research.md` §4.2. | mathjs, Compute Engine, SymPy. |
| **KaTeX** | Fast, synchronous, self-hosted. | MathJax (slower, heavier). |
| **Red Hat Text / Mono / Display** | Open fonts, excellent for dense technical UI, bundled locally. | CDN fonts (external requests). |

## 4. Data

### Principle: the log is the truth

```
events (append-only)  ──fold──▶  skill_state, daily activity, streaks, analytics
```

Anything derived can be deleted and rebuilt (`POST /api/admin/recompute`). When the
mastery model changes, history is replayed through the new model. Nothing the learner did
is ever reinterpreted destructively.

This happens by itself. The stored states carry a marker of the rules they were computed
under — the model's version (`MODEL_VERSION` in `core/learning/constants.ts`) and the
content's (`CONTENT_VERSION`). On start the server compares the marker with its own and,
if they differ, replays the log before serving anything. Updating Lemma therefore never
leaves mastery levels computed under yesterday's rules; whoever changes a rule only has to
bump the version next to it.

### Tables

| Table | Purpose |
|---|---|
| `meta` | schema version, instance id |
| `auth` | the password hash (scrypt) of the database's owner, created/changed timestamps |
| `sessions` | hashed session tokens with expiry, each naming its account (none: the administrator) |
| `users` | the other accounts: name, tutor permission, created — used in the main database only |
| `settings` | key → JSON (locale, theme, school state, goals, integrations) |
| `problems` | every issued problem instance: generator, seed, level, context, snapshot JSON, status; the chance of guessing it; where a selection was made, its purpose and reason |
| `attempts` | every submitted answer: input, verdict, time, hints so far, inferred and confirmed error |
| `events` | append-only activity log: type, day, points, payload |
| `skill_state` | per-concept cache: θ, counters, evidence flags, FSRS card, error counts |
| `lesson_progress` | step reached per lesson |
| `plans` | the stored session plan per day |
| `runs` | a practice run (context, queue, position) |
| `exams` | exam sessions: items, answers, timing, report |
| `tutor_threads`, `tutor_messages` | tutor conversations |
| `mission_progress` | milestones, notes, repository URL |
| `forge_cache` | cached GitHub/Forgejo activity with ETag and fetch time |
| `teaching` | who teaches whom (teacher, student) — used in the main database only |
| `assignments` | work a teacher set for this learner: kind, skills, minutes, note, status, the run or test that did it |
| `focus` | what a teacher noted about a skill of this learner in a session ("difficulty", "covered"), with an expiry |
| `diagnostics` | placement tests: the run, the goal, the stored report |
| `student_notes` | a teacher's private notes about a student — in the **teacher's** database |
| `teach_sessions` | tutoring sessions a teacher ran: brief, the problems shown, the wrap-up — in the **teacher's** database |

There is one schema, so every database has every table and uses those that are its
business (migration 3 says which). Where a table lives is a security decision, not a
convenience: see §6, *Teaching*.

A problem instance is stored as a **snapshot** when issued. Checking an answer never
regenerates the problem, so a content update cannot change a question the learner is in
the middle of, and history stays interpretable after generators evolve.

### Time

All timestamps are UTC milliseconds. The *study day* is derived with the configured time
zone and a 04:00 rollover, and stored on each event so later configuration changes do not
rewrite history.

### Backups

A job writes `backups/lemma-YYYY-MM-DD.sqlite` daily using SQLite's online backup API and
keeps the last 14. The file is a complete, consistent database: restoring is copying it
over `lemma.sqlite`. `GET /api/admin/export` produces the same data as JSON.

## 5. Request flow: answering a problem

1. `POST /api/practice/start` — the server builds a queue for the context and issues the
   first problem: picks a generator and level (`core/select`), generates with a fresh
   seed, stores the snapshot, returns only the public part (prompt, figure, answer kind).
2. `POST /api/problems/:id/hint` — returns the next hint and records that it was taken.
3. `POST /api/problems/:id/answer` — the server parses and checks the input against the
   stored snapshot. If wrong: infers an error type, records the attempt, returns the
   suggestion and whether another try is allowed. If right or out of tries: computes the
   outcome credit, updates `skill_state` in the same transaction, appends events, and
   returns the solution and any level change.
4. `POST /api/problems/:id/classify` — the learner confirms or corrects the error type.

Steps 3's read-modify-write is one SQLite transaction.

Two kinds of run decide their next problem only when it is asked for, instead of working
through a queue built at the start:

- **An adaptive run.** `POST /api/runs/:id/next` gathers every skill of the learner's goal
  as the scoring function wants it (`services/selection.ts`), scores them
  (`core/learning/priority.ts`), applies the session's rules to what the run has asked so
  far, and issues a problem for the chosen skill and purpose. The purpose and the reason
  are stored with the problem and shown with it. The draw among equal scores is seeded by
  the run and the step, so asking twice gives the same problem.
- **A placement test.** The next problem follows from the answers so far
  (`core/learning/diagnostic.ts`). An answer returns the verdict `recorded` and nothing
  else — no right or wrong, no solution — until the run ends; then the report is written
  and the placements it implies are already in the learner model, because they are folded
  from the log like everything else.

### Three verdicts, not two

The checker (`core/answer`) answers *correct*, *incorrect* or **invalid**. Invalid means
"this is not an answer yet": it could not be read, or it has the right value in the wrong
form. An invalid input costs nothing — no attempt is recorded, the learner is told what is
expected and tries again. This is what lets the checker be strict without being unfair:

- a rounded decimal where an exact value is expected (`0,866` for `√3/2`);
- an expression in the wrong form when a form was asked for (expanded, factored, vertex);
- degrees where radians were asked for;
- a complex number left as a power or in trigonometric form when `a + bi` was asked for;
- **an answer that is still a computation**: `sin(5π/6)` has the value `1/2`, but writing
  `1/2` is the task. An input may use a family of functions (trigonometric, logarithmic)
  only if the expected answer itself does — `log_3(11)` is a fine answer to `3^x = 11`.

Authored misconceptions are content, not input, and are compared by value only; they may
describe an unfinished computation ("the learner computed `log_2(12 + 4)`").

## 6. Security

Threat model: a personal app reachable from the internet through a tunnel.

- **Authentication**: a password per account, stored as a salted scrypt hash. The
  administrator's is set from `LEMMA_PASSWORD` on first start; the administrator creates
  the other accounts. Sessions are random 256-bit tokens, stored hashed, sent as an
  `HttpOnly`, `SameSite=Lax` cookie; `Secure` when `COOKIE_SECURE=1`.
- **Separation of learners**: one database per account (below), so a route cannot return
  another learner's row — there is no such row in the database it was handed. Everything
  under `/api/admin` requires the administrator, in one place.
- **Teaching**: the one way to another learner's data is `/api/teach/students/:student`,
  behind one check that the account asking teaches that learner (below).
- **Login throttling** per client address with exponential back-off.
- **CSRF**: state-changing routes require a JSON content type and a same-origin `Origin`
  header, on top of `SameSite`.
- **Headers**: Content-Security-Policy restricted to self (inline styles allowed for
  KaTeX), `X-Content-Type-Options`, `Referrer-Policy`, `frame-ancestors 'none'`.
- **Proxy awareness**: forwarding headers are trusted only when `TRUST_PROXY=1`.
- **Container**: non-root user, read-only root filesystem, no capabilities, only `/data`
  writable.
- **Secrets** (LLM key, forge token) come from the environment, are never written to the
  database, and are never returned by the API.
- **Tutor**: model output is rendered as text and KaTeX, never as HTML.

Out of scope: protection against someone with access to the host, and against the
administrator — who runs the server and can read every file on it.

### Accounts: one database per learner

Lemma was designed for one learner, and every service takes a context of *the* database,
*the* configuration and a clock. Accounts were added without changing that: each account
has a database of its own, and a request is handed the context of whoever is asking.

```
<data>/lemma.sqlite                the administrator's — what a single-user instance has,
                                   plus the table of users and everybody's sessions
<data>/users/<name>/lemma.sqlite   one per user, with its own backups/ beside it
```

The alternative, a `user_id` column on every table, would have touched every query in the
application, and one forgotten `WHERE` would show one person another's work. With separate
files the separation does not depend on anyone remembering anything, and the account tests
check it both through the API and on disk. It also keeps what was already true: one writer
per database, a backup is a file, the learner model replays from one log. The cost is an
open file handle per user and that nothing can be computed *across* learners in one query —
which this application does not want to do anyway. The one view that puts learners side by
side (a teacher's, below) opens each database through the same gate as everything else
and produces no ranking.

Three things follow from "a user's database is a complete Lemma database":

- it holds its owner's password, so the administrator's `auth` row and a user's are the
  same mechanism, and a database can move between instances as an account;
- every database has the tables for accounts and sessions, since there is one schema, but
  only the main one uses them;
- what comes from the environment and belongs to a person — the GitHub name, the forge
  tokens — is given to the administrator's context only. A token in particular must not
  reach a user, who could name a Forgejo server of their own and have it sent there; for
  the same reason only the administrator may set a Forgejo address at all.

The AI tutor is the one shared resource with a bill attached. It is allowed per account,
off for a new one, and its concurrency limit is counted per learner.

Removing an account deletes its row and sessions and moves its directory to
`users/.deleted/`: months of somebody's work should survive one wrong click.
Putting Cloudflare Access in front is recommended and needs no change in the app.

### Teaching: who may see whom

A teacher is an account the administrator has named as the teacher of another account
(`teaching`, in the main database; `PUT /api/admin/users/:username` with `teachers`). It is
a relation between two accounts, not a role with powers of its own.

- **One gate.** Everything about one learner is under `/api/teach/students/:student`, and
  a middleware in front of all of it checks `accounts.teaches(asking, student)` before any
  handler runs. Handlers take the learner from what the gate set and from nowhere else, so
  a new route cannot forget the check. The refusal is the same `403` for a learner who is
  somebody else's and for one who does not exist: the route says nothing about which
  accounts there are. The list and the side-by-side view take only names the teacher
  teaches.
- **The administrator is not everybody's teacher.** Creating accounts does not open their
  work; the administrator sees a learner's work only by being named that learner's
  teacher, which the learner can then read.
- **The learner knows.** `GET /api/me` lists who teaches the account, and Settings shows it
  with what those accounts can see.
- **What a teacher can change** is short: the learner's goal, examination date and what
  the class is on; assignments; the focus noted on a skill. Not the password, not the
  other settings, not the log — and never a mastery level, which only the learner's own
  work moves.
- **Private notes are out of the learner's reach by construction.** A teacher's notes and
  session records are rows of the *teacher's* database. A learner's request is handed the
  learner's database, in which those rows do not exist; no learner route would have to be
  wrong for them to leak, because there is nothing to filter. The note is found only
  under the student it was written about, so one teacher's note cannot be addressed
  through another student either.
- **Problems shown in a tutoring session are not the learner's attempts.** They are
  generated and checked in the teacher's session record. What two people work out
  together says nothing about what one can do alone; the session leaves the learner only
  a focus on the skills that were hard and, if the teacher sets it, homework.
- **Exports** contain the tables of one's own database: a learner's has the assignments
  and placement tests, never anybody's notes; a teacher's has their notes.

The tests ask for every teaching route as a stranger, as another teacher and as the
student, and read a learner's every response and export for the text of a note.

## 7. The tutor

```
question ─▶ context builder ─▶ model ─▶ stream to browser
              │                  ▲
              │                  └─ tools (deterministic):
              │                       check_answer   → the evaluator's verdict
              │                       evaluate       → the expression engine
              │                       get_problem    → a generated, verified problem
              ├─ mode instructions (Socratic, hint, oral exam, …)
              ├─ concept: lenses, terms
              ├─ current problem + authored solution (marked: do not reveal)
              └─ learner profile: weak skills, dominant error types
```

- **Not the source of truth.** Correctness is decided by the evaluator and handed to the
  model as fact. Practice problems come from generators, so each has a verified answer.
  Tools: `evaluate_expression`, `compare_expressions`, `check_answer`,
  `get_practice_problem`, `check_practice_answer`. Tool input is validated against its
  schema before anything runs; a malformed call is returned to the model as an error.
- **Remembers weaknesses** through the learner model, injected fresh each time — not
  through opaque model memory.
- **Help is not free.** Asking about an open problem counts like taking a hint (capped at
  two), so the mastery evidence stays honest. While a mock exam or a placement test runs,
  the tutor is off (a placement test left unfinished stops counting after 45 minutes).
- **It knows whom it is talking to.** The instructions this instance was built around
  address its owner and the second-year syllabus, and are sent unchanged to the owner. Any
  other learner gets a text without the owner's person in it, and one preparing for an
  entrance examination gets that examination's concepts and a rule in place of the FIT
  facts: state a date, a score or a school's requirement only if it is in the context,
  otherwise say so and point to the official site. One text per goal, so each still
  caches as a prefix.
- **Provider-neutral**: Claude through the official SDK (streaming, adaptive thinking,
  the stable instructions cached, a server-side fallback on Opus for requests a safety
  classifier declines by mistake), or any OpenAI-compatible endpoint (Ollama, llama.cpp,
  vLLM) without tools — in which case the tutor says when it cannot verify something.
- **Streaming with retraction.** The reply streams to the browser as server-sent events
  (`start | delta | tool | retract | done | error`). If a turn is refused or cut off mid-way,
  the partial text is retracted rather than left standing as if it were an answer.
- **Optional**: with no provider configured, tutor entry points are hidden.

## 8. Deployment

`docker compose up -d --build` builds one image (multi-stage: install, build, slim
runtime) and starts one service with a named volume, a health check on `/healthz`, a
restart policy, and JSON logs on stdout. Configuration is `.env`. The compose file is
plain Compose-spec and is tested with `podman-compose` and with Docker's own Compose —
the latter against Podman's Docker-compatible API, which proves the file and the commands
but not Docker Engine (see the roadmap's current state).

Where the two tools differ, the difference is handled or written down: `.env` values
containing `$` or `#` are read differently (`.env.example`), the host is
`host.docker.internal` under both because the compose file asks for it, and
`podman-compose` has no `cp` and restarts left-over one-off containers (README).

Updating: `git pull && docker compose up -d --build`. Migrations run on start, inside a
transaction, after an automatic pre-migration backup. A database with a *newer* schema
than the running code is refused.

The container runs as an unprivileged user with a read-only root filesystem, all
capabilities dropped and `no-new-privileges`; only `/data` is writable. The runtime image
contains the server bundle, the web bundle and the SQLite driver's prebuilt binary —
no `node_modules` tree, no compiler.

Two things were learned by deploying on the development machine itself (rootless Podman
in an unprivileged LXC), and both are handled rather than documented away: a user without
subordinate UID ranges (`LEMMA_UID=0`, which is still the unprivileged host user), and a
host without `/dev/net/tun` (`compose.host-network.yaml`). See the README.

A forgotten password is reset from `.env` (`LEMMA_PASSWORD_RESET=1`), on the reasoning
that whoever can edit that file on the server owns the instance already.

Two failure modes of a mounted volume are caught at start rather than left to SQLite,
which reports the first as "unable to open database file" and does not report the second
at all (it opens the file read-only, and every later write fails): a data directory, or a
database file, that the app's user may not write. The message names the owner and the
user. And the backup of a study day is written once and never replaced: a database that
was just restored, or lost and created anew, does not remember today's backup and would
otherwise overwrite the one copy worth keeping.

## 9. Charts and colour

The interface has many small charts (heatmap, mastery bars, trend lines, error mix). They
share one set of rules, implemented once in `web/src/viz` and `web/src/index.css`, so that
a chart is right by construction rather than by taste.

**Colour does one job per chart.** Four jobs, four kinds of palette:

| Job | Palette | Used for |
|---|---|---|
| identity | eight categorical hues in a fixed order (blue, orange, aqua, yellow, magenta, green, violet, red) | series in a line chart, error families |
| magnitude | one blue ramp, light to dark | heatmap intensity, mastery level 1–5 |
| state | good / warning / serious / critical | verdicts and notices — always with an icon and a word, never colour alone |
| structure | surfaces, hairlines, three text inks | everything that is not data |

- The palettes are defined as CSS variables for the dark and the light theme separately.
  Each was **validated by script** (lightness band, chroma, colour-vision-deficiency
  separation of neighbouring series, contrast against the surface), not chosen by eye. The
  light theme is not an inversion of the dark one; its ramps were stepped again.
- Hues are assigned to a thing, not to a rank: filtering a chart never repaints the series
  that remain. A ninth series is never a generated colour.
- Status colours are reserved for status. "Series 4" is never red-because-red-was-free.
- Text is never drawn in a series colour. Values, labels and legends use the text inks; a
  coloured mark next to them carries the identity.

The values, as they stand in `index.css` (the stylesheet is authoritative):

| | Dark theme | Light theme |
|---|---|---|
| Surfaces (page, 1, 2, 3) | `#0d0e10` `#16181b` `#1d2024` `#272b30` | `#f4f5f7` `#ffffff` `#f1f2f4` `#e3e6ea` |
| Categorical 1–8 | `#3987e5` `#d95926` `#199e70` `#c98500` `#d55181` `#008300` `#9085e9` `#e66767` | `#2a78d6` `#eb6834` `#1baf7a` `#eda100` `#e87ba4` `#008300` `#4a3aa7` `#e34948` |
| Heatmap 1–4 | `#184f95` `#2a78d6` `#6da7ec` `#b7d3f6` | `#86b6ef` `#5598e7` `#256abf` `#104281` |
| Mastery 1–5 | `#184f95` `#256abf` `#3987e5` `#6da7ec` `#b7d3f6` | `#86b6ef` `#5598e7` `#2a78d6` `#1c5cab` `#0d366b` |
| Status | good `#0ca30c`, warning `#fab219`, serious `#ec835a`, critical `#d03b3b` | the same |

On a dark surface "more" is lighter; on a light surface "more" is darker. That is why the
two magnitude ramps run in opposite directions.

**Form.** One y-axis per chart, never two. A legend whenever there are two or more series,
none for one. Thin marks, hairline grid and axes. Direct labels only where they help.

**Nothing is hover-only.** Every chart with a tooltip also has a "Table" switch showing
the same numbers, and the heatmap can be walked with the keyboard. Tooltips enhance; they
never gate.

**Figures** (problem drawings, lesson illustrations, the Math Lab) are a separate kit
(`web/src/figure`) drawn from a serialisable `FigureSpec`, so content contains no drawing
code and a figure looks the same wherever it appears. A figure keeps its last measured
width when its container is momentarily not laid out, rather than tearing itself down.

## 10. Testing

| Layer | What is tested |
|---|---|
| core | parser and evaluator (including Czech notation), LaTeX output, answer checking per kind and the three verdicts, error inference, Elo updates, level gates, scheduler mapping, activity scoring, streak and rest-day logic, study-day boundaries, session planner, exam scoring, graph layout, the answer oracles; guessing and false mastery, the selection scores and session rules, prerequisites as a constraint, the placement queue and its priors, path states, readiness, bundle scoring |
| content | every generator for 40 seeds at each level (`content-model.md` §4); structure of the syllabus, the prerequisite graph and the FIT snapshot; coverage of every concept and every chapter; hand-written identity and Boolean tables checked numerically; the examination data — papers, specification, goals, practice tests |
| server | migrations including the upgrade of an existing database, auth, throttling and password reset, the practice flow end to end against an in-memory database, recompute equals incremental state, exams including the annual review and the entrance practice tests, insights, the tutor against scripted providers, a guard on the content sources and on the generated coverage document; simulated learners working through adaptive sessions; who may see whose work |

**Simulated learners.** Whether a selection algorithm does what its description says cannot
be read off unit tests of its parts. `packages/server/src/dev/personas.ts` defines
fictional learners — a true ability per skill, a habit of errors, a pace — who answer
through the same service functions as a browser does, with a clock that can be moved. The
adaptive tests state their expectations about such a learner's weeks ("a learner without
fractions is given fraction problems before equations"; "a learner who answers true/false
statements well and nothing else is not shown as mastering anything"), and
`scripts/dev-seed-class.ts` uses the same personas to fill a demonstration instance with
a teacher and two students. They are test material: nothing in the running application
uses them.

`npm test` runs everything; `npm run typecheck` checks all four packages. Beyond the
automated tests, the interface was exercised in headless Chrome (both themes, desktop and
phone width, console errors and failed requests reported), and a seventy-day simulated
learner was run through the real HTTP API to check that replaying the event log
reproduces the live learner model exactly.

## 11. What was deliberately not built

No message queue, no Redis, no separate worker, no microservices, no GraphQL, no
server-side rendering, no ORM. Each can be added when a real requirement appears; none is
required by a single-user learning tool.
