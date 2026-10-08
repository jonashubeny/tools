# Roadmap

Status legend: ✅ done · 🟡 partly done · ⬜ not started.
The status column is updated whenever work lands; the "Current state" section at the end
is the honest summary.

## Phases

| # | Phase | Scope | Status |
|---|---|---|---|
| 0 | Research and specification | Sources, product spec, architecture, learning and content models | ✅ |
| 1 | Foundation | Monorepo, container, database and migrations, auth, shell, theme, i18n | ✅ |
| 2 | Core learning | Expression engine, answer checking, concepts, lessons, generators, practice flow, hints | ✅ (lessons: see content plan) |
| 3 | Adaptive learning | Elo ability, level gates, FSRS scheduling, error inference, Error Lab, daily plan | ✅ |
| 4 | Progress and motivation | Activity score, heatmap with day detail, consistency, streak with rest days, skill tree, milestones | ✅ |
| 5 | Math Lab | Figure kit, function grapher, transformation, quadratic, unit circle, complex plane tools | ✅ eleven tools |
| 6 | FIT roadmap | Dated snapshots, course mapping, readiness by stage | ✅ |
| 7 | AI tutor | Provider abstraction, modes, grounding, tools, streaming | 🟡 built and tested against scripted providers; never run against a live model |
| 8 | Forge integration | GitHub events / calendar, Forgejo heatmap, caching | 🟡 built and tested against scripted HTTP; not yet pointed at the live services |
| 9 | Missions | Mission briefs, milestones, progress | ✅ seven missions |
| 10 | Polish | Exam simulation report, analytics trends, accessibility, performance, docs | 🟡 reports, trends and docs done; no accessibility audit, no performance measurement |

## Content plan

Depth-first on what is being taught now, breadth afterwards.

| Tier | Syllabus topics | Target | Status |
|---|---|---|---|
| A | 1–4 (linear, absolute value, quadratic) and their foundations | Lessons, Why-lenses, several generators per skill, static reasoning problems | ✅ 7 lessons, 26 generators, 8 hand-written problems (explain, estimate, boss) |
| B | 5–10 (power, inverse, exponential, logarithmic, equations) | Concepts, lenses, generators; lessons follow | 🟡 30 generators; lessons for chapters 5–8, none yet for 9–10 |
| C | 11–17 (trigonometry, complex numbers, planimetry, stereometry) | Concepts and a first set of generators | 🟡 40 generators; one lesson (unit circle) |
| E | Reasoning and VUT preparation | Logic, sets, number systems, complexity intuition | 🟡 14 generators; no lessons |

## After the first release

Ordered by expected value for the learner.

1. **Lessons for tiers B and C**, written just ahead of the class reaching each topic.
2. **Tune the model on real data**: after ~6 weeks, compare predicted and actual success,
   adjust level thresholds and hint costs, then `recompute`.
3. **Geometry tools**: a construction tool for planimetry (candidate: JSXGraph) and a 3D
   viewer for stereometry sections.
4. **Step-by-step answers**: enter intermediate lines, each checked for equivalence with
   the previous one, so the first invalid step is located automatically.
5. **Year 3 and 4**: add the next syllabus when it exists; analytic geometry, sequences,
   combinatorics, probability. Fetch the RVP for field 18-20-M/01 and the "Matematika
   rozšiřující" catalogue then.
6. **Admission practice**: SCIO-style timed sets (MAT format: 35 questions, 90 minutes,
   four options); OSP-style analytical reasoning.
7. **Beyond mathematics** — the wider "FIT preparation environment": C fundamentals
   aligned with IZP, number representation aligned with ISU/INC, shell tasks aligned with
   IOS, circuit basics aligned with IEL.
8. **Quality**: ESLint, end-to-end browser tests, offline support.

## Keeping FIT data current

Each autumn (the bachelor admission directive for the following year was approved on
22 September in 2026): fetch the new directive and the programme page, add a new snapshot
file, keep the old one. See `updating-fit-data.md`. In 2029 the programme is re-accredited;
the course mapping must be redone from the new study plan rather than patched.

## Current state

*As of 8 October 2026 (content version 2026.10.1).*

### What exists and has been verified

- **The whole loop works end to end**: sign in, see a plan for today with a reason for
  every block, learn a concept, practise it with typed answers, get hints, see the worked
  solution, have the error classified, watch the mastery level respond, review later,
  sit a mock exam, read the report. 462 automated tests cover the engine, the learning
  model, every problem generator and the HTTP API.
- **Every one of the 65 concepts has problems** — all 17 syllabus chapters (45 concepts,
  96 generators), the foundations from earlier years (13 concepts) and the enrichment
  topics (7 concepts). Each generator is checked on 40 seeds per level against an
  independent oracle wherever one exists, and samples of each were read by eye in Czech.
  The English text is checked for presence and valid LaTeX but was read only in part.
- **The learner model is replayable**: a simulated learner was run through 70 days of the
  real API and the state rebuilt from the event log matched the live state exactly.
- **Deployment was done for real** on the development machine: image built (249 MB),
  started through `podman-compose`, signed in, restarted and recreated with the session
  and data intact, daily backup written, health check green, clean shutdown. That machine
  is rootless Podman in an unprivileged LXC; the two workarounds it needs are in the
  README.
- **The Docker commands were run with Docker's own Compose** (v5.6.0), talking to Podman's
  Docker-compatible API because the machine has no Docker daemon: `config`, `up`, `ps`,
  `logs`, `exec`, `cp`, `run`, `down`. Restoring a backup and moving the data into an empty
  volume were checked by what the app then knew, not by exit codes, with `docker compose`
  and with `podman-compose`. Every file in the image is readable by an unprivileged user.
- **The interface was looked at**, not just compiled: every page in headless Chrome, dark
  and light, desktop and 390 px, with console errors and failed requests reported (none).
  The practice flow, a lesson and the new figure types were driven and screenshotted.

### What is thin

- **Lessons**: 12 of 65 concepts have one (chapters 1–8 and the unit circle). The other
  concepts have the five "why" lenses, problems, hints and worked solutions, but no
  guided lesson. Write them just ahead of the class.
- **Problem variety beyond chapter 3**: boss problems, "explain in your own words" and
  estimation exist only for the first chapters (8 hand-written problems). There are no
  speed rounds and no programming problems. Later chapters have core, hard, applied,
  find-the-mistake and read-the-graph problems.
- **Hard problems**: 19 concepts have problems at level 4 or 5; the other 46 stop at
  level 3. The mastery model accounts for this (`learning-model.md` §4), but more hard
  problems would make "mastered" mean more.
- **Stereometry** is drawn, not manipulated: there is no 3D viewer, and no construction
  tool for planimetry.

### What has not been tried

- **The AI tutor against a real model.** No API key was available. The provider code is
  tested against a scripted Messages API and a scripted OpenAI-compatible server, which
  proves the plumbing, not the pedagogy. Expect to tune the prompts.
- **GitHub and Forgejo against the live services.** Tested against scripted responses
  only (pagination, ETags, failures, tokens).
- **Docker Engine itself.** The development machine has no Docker daemon and cannot run
  one (its `docker` command is Podman's wrapper). Docker's Compose was used against
  Podman's API, as described above; that proves the compose file and the commands, not the
  engine. Never exercised: BuildKit building the image (Buildah built it), Docker's bridge
  network with the published port (the machine can only do host networking), and the app
  running as user 1000 (there it can only run as the namespace's root). The first
  `docker compose up -d --build` on a real Docker host is therefore a first.
- **A real learner.** Every constant in the learning model is a reasoned starting value.
  After about six weeks of use, compare predicted and actual success and retune; the
  event log makes that safe.
- **A teacher's eye.** Notation and the choice of "basic problem types" for the annual
  review follow common Czech textbook practice and Lemma's reading of the chapter titles —
  not this school's past papers. If the teacher's conventions differ, the content should
  follow the teacher.
- **Accessibility with a screen reader**, and performance on a slow phone.

### Not built

SCIO-style admission practice; years 3 and 4; vectors, matrices, limits, derivatives,
combinatorics (named on the FIT page as planned); step-by-step answer entry; ESLint;
end-to-end browser tests kept in the repository (the browser checks were run from
throw-away scripts); offline support.

### Housekeeping

The repository is initialised (`main`) but **nothing has been committed** — that is the
owner's first decision to make. The syllabus document itself is not in the repository;
the seventeen chapter titles are a transcription.
