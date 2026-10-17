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
| 11 | Entrance examinations | Goals per learner, the source-backed curriculum of the unified entrance examination, a placement test, a scored choice of the next skill, path states, practice tests in the examination's format, readiness | 🟡 built and tested with simulated learners; no real learner has used it, constructions cannot be practised, the weights of two of the three variants rest on four papers each (`adaptive-learning-plan.md` §9) |
| 12 | Teaching | The teaching relation, a teacher's view of each student, assignments, a tutoring-session mode, private notes | 🟡 built and tested, including who may see what; not yet used in a real lesson |

## Content plan

Depth-first on what is being taught now, breadth afterwards.

| Tier | Syllabus topics | Target | Status |
|---|---|---|---|
| A | 1–4 (linear, absolute value, quadratic) and their foundations | Lessons, Why-lenses, several generators per skill, static reasoning problems | ✅ 7 lessons, 26 generators, 8 hand-written problems (explain, estimate, boss) |
| B | 5–10 (power, inverse, exponential, logarithmic, equations) | Concepts, lenses, generators; lessons follow | 🟡 30 generators; lessons for chapters 5–8, none yet for 9–10 |
| C | 11–17 (trigonometry, complex numbers, planimetry, stereometry) | Concepts and a first set of generators | 🟡 40 generators; one lesson (unit circle) |
| E | Reasoning and VUT preparation | Logic, sets, number systems, complexity intuition | 🟡 14 generators; no lessons |
| J | The entrance track: primary and lower-secondary mathematics (36 skills) | Generators at several levels for every skill, in the examination's formats; worked examples | 🟡 86 generators (12 five-option, 4 matching, 2 true/false families among them) for 35 of the 36 skills; no lessons; hard problems (level 4) for 17 skills |

## After the first release

Ordered by expected value for the learner.

1. **Lessons for tiers B and C**, written just ahead of the class reaching each topic.
2. **Tune the model on real data**: after ~6 weeks, compare predicted and actual success,
   adjust level thresholds and hint costs, then `recompute`. For the examination goals the
   same holds for the weights of the selection, the thresholds of the placement test and
   those of the readiness report (`learning-model.md` §12–15).
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

For the entrance examinations, in the order a tutor would feel them:

1. **Read every generator of the entrance track with a pupil's eyes** and fix what reads
   badly; write lessons for the skills that most often need explaining (fractions,
   percent, equations from words).
2. **Read more papers of the six-year and eight-year variants** (27 and 29 are classified
   by keyword rules only), so that their weights stop being provisional; inspect the 11
   scanned booklets.
3. **The 16 items of the specification without problems** (`cermat-coverage.md` §7), most
   of them about positions and constructions; and a way to record construction work done
   on paper, so that a tenth of the examination is not invisible to the readiness report.
4. **Re-read the official pages** after 1 February 2027: the dates, and whether a new
   specification was published for 2026/2027.
5. **Whole solutions**: the real test marks the working of some open tasks; Lemma checks
   results only (item 4 of the list above would change that).

## Keeping FIT data current

Each autumn (the bachelor admission directive for the following year was approved on
22 September in 2026): fetch the new directive and the programme page, add a new snapshot
file, keep the old one. See `updating-fit-data.md`. In 2029 the programme is re-accredited;
the course mapping must be redone from the new study plan rather than patched.

## Current state

*As of 10 October 2026 (content version 2026.10.2, learner model 3, database schema 3).*

### What exists and has been verified

- **The whole loop works end to end**: sign in, see a plan for today with a reason for
  every block, learn a concept, practise it with typed answers, get hints, see the worked
  solution, have the error classified, watch the mastery level respond, review later,
  sit a mock exam, read the report. 669 automated tests cover the engine, the learning
  model, every problem generator and the HTTP API.
- **An account can prepare for an entrance examination instead** (`adaptive-learning-plan.md`
  §9 has the detail): a goal per learner; a placement test that says nothing until it is
  over and places the skills it did not ask; every next problem chosen by a documented
  score with its reason shown; path states read off the evidence; practice tests with the
  examination's fields, formats, points and bundles; readiness as several statements that
  appear only when enough stands behind them. Sixteen scenarios — a beginner, a learner
  without fractions, one who guesses, one who makes sign errors, a strong one — are tests
  that let fictional learners work through the real application for simulated weeks.
- **A teacher's view exists and is closed to everyone else.** Tested through the API for
  every teaching route as a stranger, as another teacher and as the student; private notes
  are searched for in everything the student can request and in the student's database;
  a student's log and levels are compared before and after a tutoring session and a
  noted skill.
- **What the examinations ask for is documented from sources**: `cermat-coverage.md` is
  generated from the specification (77 items, paraphrased and linked) and from 97
  classified past papers, and says what Lemma covers and what it does not. A test fails
  when the document and the data disagree.
- **Accounts.** The administrator (the password from `.env`) creates users in Settings;
  each has a database of their own. Tested through the API and on disk — separation,
  passwords, removal, the tutor permission, an upgrade from a database without accounts
  with seventy days of history in it — and walked through in a browser: create a user,
  sign out, sign in as that user.
- **Every one of the 65 concepts of the school goal has problems** — all 17 syllabus
  chapters (45 concepts, 96 generators), the foundations from earlier years (13 concepts)
  and the enrichment topics (7 concepts). Each generator is checked on 40 seeds per level
  against an independent oracle wherever one exists, and samples of each were read by eye
  in Czech. The English text is checked for presence and valid LaTeX but was read only in
  part.
- **35 of the 36 skills of the entrance track have problems** (86 generators; the 36th is
  geometric constructions, which a screen cannot check). They pass the same linter. Of
  their Czech text, two samples per generator — the lowest and the highest level — were
  read once, on 10 October 2026. That reading found about forty templates that declined
  a noun wrongly after a small number (*4 dětí*, *3 trojúhelníků*), two degenerate
  problems and one decimal point; all were fixed, the same kind of error was then found
  and fixed in seven generators of the school goal, and the linter now looks for it. It
  is one reading of two seeds each, not a review.
- **The learner model is replayable**: a simulated learner was run through 70 days of the
  real API and the state rebuilt from the event log matched the live state exactly.
- **Deployment was done for real** on the development machine: image built (251 MB),
  started, signed in, restarted and recreated with the sessions and data intact, daily
  backup written, health check green, clean shutdown. That machine is rootless Podman in
  an unprivileged LXC; the two workarounds it needs are in the README.
- **The Docker commands were run with Docker's own Compose** (v5.6.0), talking to Podman's
  Docker-compatible API because the machine has no Docker daemon: `build`, `config`, `up`,
  `ps`, `logs`, `exec`, `cp`, `run`, `restart`, `down`. Restoring a backup and moving the
  data into an empty volume were checked by what the app then knew, not by exit codes.
  Every file in the image is readable by an unprivileged user. (`podman-compose` was used
  for the versions before this one; the compose files have not changed since.)
- **Updating an existing instance was done in the container**, on 10 October 2026, with
  the commands of the README: a volume holding the previous version's database (seventy
  simulated days: 757 problems, 775 answers, 1 010 events, 8 exams) and, as a second
  account, a database two versions old. On start the server took a backup, migrated both,
  and rebuilt the learner model under the new rules; every row was still there, one skill
  of 42 changed its level (one step down — it had been carried by a single kind of
  problem), and replaying the log again gave the same levels. Then, through the published
  port: the features that existed (plan, practice, hints, mixed review, a mock exam with
  its grade, backup, export), a new account choosing an entrance examination and working
  through the placement test, an adaptive session and a practice test, the teaching
  pages with their refusals, and work set for a student of each kind of goal. 107 checks,
  all passing; after a restart, and again after the container was removed and created
  anew, every account's goal, levels, path states and row counts were unchanged. 28 pages
  were then opened in headless Chrome against the container: no console error, no failed
  request.
- **The interface was looked at**, not just compiled: every page in headless Chrome, dark
  and light, desktop and 390 px, with console errors and failed requests reported (none).
  The practice flow, a lesson and the new figure types were driven and screenshotted.

### What is thin

- **Lessons**: 12 of 65 concepts of the school goal have one (chapters 1–8 and the unit
  circle). The other concepts have the five "why" lenses, problems, hints and worked
  solutions, but no guided lesson. Write them just ahead of the class.
- **The entrance track has no lessons at all.** A skill there is explained by its "why"
  lenses, by worked examples generated on request (a problem with its solution opened
  line by line, which does not count as an attempt), and by hints. For a learner who
  meets fractions for the first time that is not enough; the tutor is.
- **Constructions and positions.** Geometric constructions — about a tenth of every
  test — cannot be practised; neither can 16 of the 77 items of the specification, most
  of them about mutual positions and constructions (`cermat-coverage.md` §7). The
  readiness report counts them out and says so.
- **The weights of the six-year and eight-year examinations are provisional**: four read
  papers each (200 points), against twenty (1 000 points) for the four-year one.
- **What kind of error it was** is often not known for the entrance track: a wrong answer
  matches an authored misconception or a pattern in some problems only. Where it does not,
  the error is counted as "undetermined" rather than given a label the model fell back on,
  and the learner can classify it.
- **Open tasks are marked by their result.** The real test marks the working of some.
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
- **Docker Engine, from start to finish.** The development machine has no Docker daemon
  and cannot run one (its `docker` command is Podman's wrapper). Docker's Compose was used
  against Podman's API, as described above; that proves the compose file and the commands,
  not the engine — and the image was built by Buildah, not by BuildKit. The container ran
  on the host's network and as the namespace's own user, which is what that machine
  needs; Docker's bridge network and user 1000 were not exercised. What is known from a
  real Docker host is two logs of 8 October 2026, both of the version before accounts. The first build stopped while BuildKit was
  installing the dependencies, on that host's network: read timeouts from the npm registry
  inside the build container. The second went through, and the server started, set the
  password and wrote its first backup into the volume (presumably as user 1000, the
  default, which the development machine cannot do). Not confirmed there: the page
  answering through the published port on Docker's bridge network, a restart with the data
  intact, restoring a backup. And the install step as it is now — it keeps its downloads
  and retries, added after the first log — has been built by Buildah only (including a
  rebuild with no network at all), not yet by BuildKit.
- **A real learner.** Every constant in the learning model is a reasoned starting value.
  After about six weeks of use, compare predicted and actual success and retune; the
  event log makes that safe. This holds twice over for the examination goals: the
  learners in their tests are simulations with an ability per skill and a habit of
  errors. They show that the algorithm does what its description says — not that the
  description is what a twelve-year-old needs.
- **A real lesson.** The tutoring-session mode has been clicked through and tested, never
  used with a student in the room.
- **A teacher's eye.** Notation and the choice of "basic problem types" for the annual
  review follow common Czech textbook practice and Lemma's reading of the chapter titles —
  not this school's past papers. If the teacher's conventions differ, the content should
  follow the teacher.
- **Accessibility with a screen reader**, and performance on a slow phone.

### Not built

For accounts: more than one administrator, signing up by oneself, limits on what a user
may spend on the tutor, and a button that erases a removed account's data (the directory
is left for the administrator to delete). A teacher cannot create accounts or set who
teaches whom — the administrator does both.

For the examinations: the leaving examination (maturita); admission tests that are not
the Centre's; Czech language, the other half of the unified examination; a parent's
view; messages between teacher and student; group assignments.

SCIO-style admission practice; years 3 and 4; vectors, matrices, limits, derivatives,
combinatorics (named on the FIT page as planned); step-by-step answer entry; ESLint;
end-to-end browser tests kept in the repository (the browser checks were run from
throw-away scripts); offline support.

### Housekeeping

The syllabus document itself is not in the repository; the seventeen chapter titles are a
transcription.
