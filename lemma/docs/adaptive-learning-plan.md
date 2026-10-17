# Adaptive learning for entrance examinations — plan and record

What this document is: the plan for extending Lemma from one learner's second-year syllabus
to an adaptive preparation for the Czech unified entrance examination in mathematics (JPZ,
written by CERMAT), with a tutor's view of several students. It records what was found in
the code, what the official sources say, what was decided and why, and — in §9 — what was
actually built and verified. Sections 1–8 were written before the code; §9 after it.

Related documents: `cermat-coverage.md` (the source-backed curriculum matrix, generated
from data), `learning-model.md` (the learner model, with every constant),
`content-model.md`, `architecture.md`.

## 1. What existed before (phase A)

Lemma already had most of an adaptive engine, built for one learner and one syllabus:

| Area | State before | Reused as |
|---|---|---|
| Attempt log | Every issued problem and every submission is stored; skill states are a cache rebuilt by replay | unchanged — the base of everything below |
| Per-skill model | Elo-style ability, credit by independence, counters for mixed / delayed / hard evidence, error families, speed, confidence calibration, FSRS review card | extended (§5.1) |
| Mastery levels | Six levels behind named evidence gates | kept; one gate added; mapped to the path states of §5.5 |
| Error inference | Misconception signatures, structural patterns, slip prior, timing; confirmed by the learner | unchanged |
| Next problem *within* a skill | Level aimed at ≈ 75 % predicted success; avoids recent families | kept |
| Next *skill* | A daily plan built from "the chapter the class is on", due reviews, a weak prerequisite, the dominant error type | kept for the school goal; replaced by a scored selection for examination goals (§5.3) |
| Exams | Timed, no hints, a report separating slips from gaps | extended with the examination's own structure and scoring (§6) |
| Accounts | Administrator plus users, one SQLite database per account | extended with a teaching relation (§7) |
| Content | 65 concepts of the second-year secondary syllabus with 96 generators; a linter that checks every generator on 40 seeds per level | a new track of lower-secondary concepts beside it (§4) |

Weaknesses found, all of which this work addresses:

1. **There was one curriculum.** Every learner saw the second-year syllabus and the FIT
   roadmap. Nothing said what a learner is preparing for.
2. **No placement.** A new account started every skill at "new" and at the lowest problem
   level, whatever the learner already knew.
3. **Skill choice was a fixed rule**, not a comparison: there was no way to say why skill A
   was more worth practising today than skill B.
4. **A mixed run fixed its queue at the start**, so nothing that happened inside a session
   could change what came next.
5. **A lucky choice counted as knowledge.** A correct multiple-choice answer earned full
   credit, and "I guessed" was recorded but not used.
6. **Mastery did not require variety**: one problem family could carry a skill to the top.
7. **The administrator could not see a user's progress**, and there was no way to assign
   work or keep notes.
8. **Exam scoring was "points = level"**, with no bundles of sub-questions and no relation
   to a real examination's structure.

No defects were found in the existing learner model or answer checking; the 476 tests that
described them still pass unchanged in meaning (§9 lists the ones whose expectations had to
be extended).

## 2. Which examination (phase B)

"CERMAT test" is not one test. The Centre writes the unified entrance examination in three
variants, and the secondary-school leaving examination, which is a different thing.
Lemma's examination goals are the three entrance variants:

| Goal | For | Written at the end of | Tasks | Points | Time |
|---|---|---|---|---|---|
| `jpz-9` | four-year fields and follow-up study | 9th grade | 16 (11 open, 5 closed) | 50 | 70 min |
| `jpz-7` | six-year grammar schools | 7th grade | 16 (10 open, 6 closed) | 50 | 70 min |
| `jpz-5` | eight-year grammar schools | 5th grade | 14 (8 open, 6 closed) | 50 | 70 min |

The existing second-year syllabus stays as the goal `school-it-2` and is the default, so
nothing changes for an account that does not choose otherwise. The goal and the date of
the examination are set per learner, by the learner or by their teacher.

Not built: the leaving examination (maturita), and admission tests that are not CERMAT's.

### Official sources

Retrieved on 9 October 2026 from `prijimacky.cermat.cz`; the facts used are in
`packages/content/src/jpz/`, each with its source.

- **Specification of requirements** for mathematics (document for 2022/2023; the site says
  it applies unchanged in 2025/2026, and had not yet said anything about 2026/2027). Three
  cumulative parts — eight-year, six-year, four-year — each in four areas: number and
  operations (number and variable), dependencies and data, geometry in the plane and in
  space, non-standard application problems.
- **How the tests are scored** (document "Hodnocení didaktických testů – Matematika"):
  whole points only, no negative points; multiple choice with five options, usually
  2 points; one bundle of three true/false statements; one matching bundle of three
  sub-questions with six options; narrowly open tasks (result only, any equivalent form),
  widely open tasks (the whole working), construction tasks.
- **The 2027 page**: 70 minutes, 50 points, no calculator and no tables; regular terms on
  12 and 13 April 2027 (four-year fields) and 14 and 15 April 2027 (grammar schools),
  substitute terms on 29 and 30 April 2027; the better of two attempts counts.
- **The archive of past tests** with answer keys, 2015–2026.
- **The rules for using the Centre's content**: test booklets and keys are protected, and
  spreading them or making them available needs written consent; links are allowed.

### What was done with the past papers

- All 108 booklets of 2017–2026 were downloaded for analysis (36 per variant: regular,
  substitute and illustrative tests). 2015 and 2016 were left out because the site itself
  says they do not correspond to the specification in force.
- 97 have a text layer and could be split into tasks mechanically; for each of them the
  number of tasks and the sum of points found equal what the cover declares. The other 11
  are scans and were not inspected.
- **28 papers were classified by reading every task** (all 20 four-year papers of
  2022–2026, and the regular terms of 2025 and 2026 for the other two variants): each
  task is assigned to one to three skills, and its points are split among them.
- The remaining 69 were classified by keyword rules. Against the 28 papers that were read,
  the rules name at least one of the same skills for 81 % of tasks and exactly the same
  set for 59 %. That is good enough to show where a skill occurs, and not good enough to
  weigh skills, so **weights come from the papers that were read, and only from them**.
- Answer keys of 2026 were read for the scoring of bundles (§6).

Nothing of the papers' wording is in the repository or in the application: the evidence
file holds, per task, its number, its points, its format and the skills it was assigned to,
plus the link to the official file. The exercises are Lemma's own.

What this supports, and what it does not: the skill list and the weights of `jpz-9` rest on
1 000 points of read tasks. Those of `jpz-7` and `jpz-5` rest on 200 points each and are
marked provisional. "Complete coverage" is claimed nowhere; `cermat-coverage.md` shows, per
skill, the specification items and the tasks behind it, and which skills have no exercises.

## 3. The curriculum model

- A **goal** names a set of skills, each in one of three roles, never guessed:
  **tested** — a task of that variant was assigned to it, or the specification part for
  that variant lists it; **prerequisite** — needed by a tested skill but belonging to an
  earlier part of the specification; **enrichment** — neither.
- A tested skill has a **weight**: its share of the points in the papers that were read.
  Weights drive selection and readiness, and are data, not code.
- **Prerequisites** are edges between skills. The graph is checked for cycles, and a goal
  must contain the prerequisites of everything it contains.
- One skill cannot be practised on a screen: **geometric constructions** (about a tenth of
  every test). It is in the curriculum with its evidence, marked paper-only; the tutor can
  record how it went in a session, and the practice test says how many points it leaves
  out.

## 4. Content

The lower-secondary track is new: about 35 skills from natural-number arithmetic to
systems of equations and solids, each with generators built the way the existing ones are
(answer first, independently verified, bilingual, with progressive hints, a worked
solution and the wrong answers that reveal a known misconception). Problem formats needed
by the examination — five-option choice, true/false statements, six-option matching — are
ordinary `choice` answers with a known chance of guessing.

Difficulty is a property of the problem as generated, not a label: each generator states
per level what changes (number of steps, kinds of numbers, whether the problem type is
named or has to be recognised), and the linter checks every level on 40 seeds.

## 5. The learner model and the selection algorithm (phase C)

Constants live in `packages/core/src/learning/constants.ts`; this section says what they
are for. `learning-model.md` has the exact rules.

### 5.1 What is recorded per skill

Kept from before: ability, attempts, solved, unaided, recent credit, mixed and delayed
unaided successes, hard successes, speed, error counts, calibration, review card.

Added: first-try successes; attempts with hints; distinct problem families solved
unaided; attempts and successes under examination conditions; reviews passed and failed;
the time of the last success; correct answers that were guesses; distinct days with
practice; whether there is evidence from a placement, and any placement inferred from
neighbouring skills.

From these: an **uncertainty** of the ability estimate — large with few attempts, one
family or a single day, shrinking with evidence. It is a stated heuristic, not a fitted
standard error, and nothing in the interface calls it a probability.

### 5.2 False mastery

- A correct answer to a question that can be guessed moves the estimate less: the
  predicted success includes the chance of guessing.
- A correct answer the learner marked as a guess, and any answer to a two-option question,
  is not counted as independent evidence for a level.
- "Proficient" needs independent successes in two different problem families, "mastered"
  in three — as many as the skill has, if it has fewer.
- Everything that was already required stays: mixed context, a gap of days, a hard
  problem, no recent conceptual error.

### 5.3 Choosing the next exercise

Every step scores each skill of the goal and takes the best one that the session's rules
allow. The score is a sum of named terms, so the interface can say why:

| Term | Meaning | Weight |
|---|---|---|
| need × importance | how far from mastered × the skill's weight in the examination | 1.0 |
| unlocks | how much examination weight is waiting behind this prerequisite | 0.9 |
| review | a scheduled review is due, or predicted recall has faded | 0.8 |
| recent errors | conceptual or procedural errors in the last attempts | 0.7 |
| school | the class is on it now | 0.5 |
| information | the estimate is uncertain and the skill matters | 0.35 |
| assigned | the teacher asked for it | 1.2 |

A skill whose prerequisite is below "familiar" is held back and its prerequisite is
pushed forward, with the reason shown. Each chosen skill has a **purpose** — new,
repair, consolidate, review, examination style, stretch — which decides whether the topic
is named, which level is aimed at, and what counts as evidence.

Session rules, on top of the score: the same skill does not come twice in a row, and after
a failure it waits at least two items and returns in another form; purposes are balanced
by diminishing returns; two failures in a row are followed by a problem the learner is
likely to solve; four independent successes in a row allow a stretch.

Within the skill, the level and the family are chosen as before. A learner placed by the
diagnostic starts at the level the estimate suggests, not at the bottom.

### 5.4 After a wrong answer

The existing flow already did most of what is asked: the error is classified (and the
learner confirms it), a hint is offered, the problem can be retried, the mistake can be
replayed later with the same or new numbers, and the error type feeds the drill. Added:
the failed skill returns later in the session in a different family; it is reviewed again
after a gap; a failure traced to a prerequisite makes the prerequisite due; and the
transfer check — a mixed-context problem — is what the next level requires anyway.

### 5.5 Path states

| State | Rule |
|---|---|
| not started | no evidence |
| diagnosed | evidence only from a placement, direct or inferred |
| learning | introduced or practising |
| practising | familiar: solves known problem types |
| consolidating | proficient: recognises and remembers; hard and long-delay evidence missing |
| mastered | every gate passed |
| needs review | familiar or better, and a review is due, recall has faded, or the last review failed |

### 5.6 The diagnostic

About fifteen problems in about twenty minutes, no feedback until the end, "I do not know
this" always available. First one problem on each anchor skill of the goal; then follow-ups
decided by the results: after a miss, a second problem on the same skill in another form
and, if that is missed too, a prerequisite; after an independent success, something harder.
A single miss never settles anything. Results are ordinary log entries, so the placement
survives a recompute; skills that were not asked get a cautious prior from their
neighbours and stay marked as uncertain. It can be repeated, and repeats are compared.

## 6. Practice tests and readiness

A practice test follows the variant's own structure as found in the 2025–2026 papers:
the same blocks, the same points per task, the five-option, true/false and matching
formats, 70 minutes. Bundles are scored as in the 2026 answer keys: three true/false
statements 4–2–0–0 points; matching 6–4–2–0 (eight-year variant 5–3–1–0). The construction
tasks cannot be done on a screen: the test says how many of the 50 points it covers.

What a screen cannot reproduce is said in the report: "widely open" tasks are marked on
the working by trained raters, here only the result is checked.

**Readiness is several statements, not one number**: coverage of the tested skills,
demonstrated mastery, retention, results of timed tests, performance on hard and
unfamiliar problems, and the prerequisite gaps that remain. Each says how much evidence it
rests on, and with too little it says "not enough data" instead of a value. Nothing is
presented as a probability of admission.

## 7. Teaching

- A **teaching relation** links a teacher to a student. The administrator creates it; the
  student sees who their teacher is and what the teacher can see.
- The teacher sees the students they teach and nobody else: overview, skills, mistakes,
  history, tests, the diagnostic. The check is on the server, on every route.
- **Private notes and session records live in the teacher's own database**, so no route of
  the student's can reach them.
- **Assignments** (a skill, a set, a review, a remediation, a practice test, a date) are
  written into the student's database, where the plan reads them.
- **Session mode**: before — strengths, gaps, recent mistakes, a suggested order; during —
  pick a skill and a level, show the problem large, record how it went; after — what was
  covered, what was hard, misconceptions, homework, next priorities.
- What is recorded in a session changes what is selected (a skill that was hard is pushed
  forward, homework becomes an assignment) and never the mastery level: that takes the
  student's own independent work.

## 8. Data model and tests

New tables, added by migration, nothing dropped: `teaching` (main database);
`assignments`, `focus`, `diagnostics` (each learner's); `student_notes`, `teach_sessions`
(the teacher's). New columns: the chance of guessing and the purpose of a problem.

Tests: the sixteen scenarios of the brief as server tests over fictional histories
(`packages/server/test/adaptive.test.ts`, `teach.test.ts`), unit tests of scoring,
placement, path states and readiness in core, and the content linter over every new
generator.

## 9. What was built

*Written on 10 October 2026, after the code. `roadmap.md` § Current state is the short
version; this is the record against the plan above.*

### 9.1 Phase by phase

| Phase | What exists | Where |
|---|---|---|
| A · inspect | §1 above | — |
| B · curriculum | Four goals; the specification as 77 paraphrased, linked items; 97 classified papers; roles and weights derived from both; a generated coverage document with a test that fails when it goes stale | `content/src/goals.ts`, `content/src/jpz/`, `docs/cermat-coverage.md` |
| B · content | The entrance track: 36 skills, 86 generators (12 five-option, 4 matching, 2 true/false), all through the existing linter | `content/src/concepts/basic.ts`, `content/src/generators/basic-*.ts` |
| C · model | Model version 3: guessing discounted, coin flips and declared guesses not counted as evidence, a variety gate, uncertainty in words, counters for first tries, hints, timed work, reviews and days | `core/src/learning/mastery.ts`, `constants.ts` |
| C · selection | A score of seven named terms per skill, purposes, session rules, prerequisites as a constraint; the reason stored with every problem and shown with it | `core/src/learning/priority.ts`, `server/src/services/selection.ts`, `practice.ts` |
| D · placement | At most 18 problems, silent until the end, second chances, one step down after two misses; cautious priors for skills not asked; can be skipped and repeated | `core/src/learning/diagnostic.ts`, `placement.ts`, `server/src/services/diagnostic.ts` |
| E · exercises | The closed formats of the examination with a known chance of guessing; fractions asked for in lowest terms (an unreduced one is "not an answer yet", not wrong); no immediate repeat of a problem family; worked examples that do not count as attempts | `core/src/answer/`, `core/src/learning/select.ts`, `server/src/services/lessons.ts` |
| F · path | Seven states read off the evidence by rule, each with the rule that applied; a curriculum map with role, weight, specification items and past tasks per skill | `core/src/learning/path.ts`, `web/src/pages/Map.tsx`, `Concept.tsx` |
| G · teaching | The teaching relation; a gate in front of every teaching route; students at a glance with rule-based attention flags and one suggested step; one student in detail with submitted answers; side by side without ranking; assignments; focus; private notes; session mode before, during and after | `server/src/services/teach.ts`, `assignments.ts`, `web/src/pages/Teach.tsx`, `Student.tsx`, `TeachSession.tsx` |
| H · tests and readiness | Practice tests with the examination's fields, formats, points and bundles; a report by skill with what comes back when; readiness in six parts, each silent until it has enough behind it | `content/src/goals.ts` (blueprints), `server/src/services/exam.ts`, `core/src/learning/readiness.ts` |
| I · tests and documents | §9.3 below; `learning-model.md` §12–16, `content-model.md`, `architecture.md`, README | — |
| J · deployment | §9.4 below | — |

Migration 3 adds six tables and three columns and drops nothing. An existing database is
backed up, migrated and has its learner model rebuilt under the new rules on first start;
an account that keeps the default goal sees the application it had.

### 9.2 Where the result differs from the plan

The plan was written before the algorithm had been run on anybody. Letting simulated
learners work through it for weeks changed these things:

- **Prerequisites became a constraint, and "weak" became narrower** (§5.3). As planned, a
  skill was held back whenever a prerequisite was below "familiar", and merely scored
  lower. A beginner was then still served skills three steps ahead of what they could do,
  and a strong learner was dragged through every basic skill before anything else. Now a
  held-back skill is not asked while anything else can be, and a prerequisite is in the
  way only if it is below "familiar" *and* neither made likely by the placement test nor
  off to a good start in the learner's own attempts.
- **A streak moves the level** (§5.3 said "as before"). Two independent successes in a
  row aim one level higher, four two higher. The estimate alone kept a strong learner on
  easy problems for too long.
- **The same problem family never comes twice in a row** where the skill has another;
  before, it was only made less likely.
- **The placement test** asks its second chance at the easiest level and steps down to
  the *nearest* prerequisite; a miss on the harder follow-up lowers nothing; true/false
  statements are not asked. It can also be declined.
- **Practice tests are shorter than 70 minutes** (§6): 62 or 63, because the construction
  tasks are left out and the time is cut by their share of the points.
- **Nothing shown in a tutoring session is the learner's attempt** (§7 said "record how it
  went"). How it went is recorded — in the teacher's session record. What two people work
  out together does not go into the log that mastery is computed from.
- **A kind of error is shown only where it rests on something.** The model has always
  fallen back on a default label when it could not tell; for the entrance track that was
  most errors, and a teacher's page listing them as findings would have been wrong. Drills
  and the teaching pages count only errors that were confirmed, matched a known wrong
  answer or pattern, or came far too fast; the rest are reported as "undetermined".
- **The AI tutor knows who is asking** — not in the plan, and necessary: its instructions
  addressed the instance's owner and the second-year syllabus. It is also off while a
  placement test runs.
- **"Reviews" mean one thing.** Analytics used to count every failed problem of a mixed
  run or an exam as a failed review; the readiness report counted attempts on skills
  whose review had come due. Both now use the second.

- **Assigned work reaches a learner of the school goal as well.** As first built it was
  put only into the plan of an examination goal; checking these documents against the
  code showed that a student following the syllabus would never have seen what the
  teacher set. The school plan now shows it in front of its own blocks, the first page
  lists it, and a test teaches such a student from the first look to the homework.

Planned and not built: recording how a construction task went in a session (§3) exists
only as a free-text note; a due date on an assignment is shown to the learner and flagged
to the teacher when overdue, but nothing reminds anybody.

### 9.3 Tests

669 tests in 19 files (476 before). New:

- **core** (48, and 2 for answer checking): guessing and false mastery, the variety gate,
  uncertainty; the score and each of its terms; purposes; every session rule;
  prerequisites as a constraint; the placement queue and its priors; path states;
  readiness and its thresholds; the plan of an examination goal; bundle scoring.
- **content** (16, 2, and 86): every paper adds up to 50 points and names skills that
  exist; the specification is cited item by item and what no concept covers is listed;
  goals contain their prerequisites; practice tests add up to the real 50 points and every
  slot can be filled; two rules of the linter for Czech text (below); and the linter's
  run over each of the 86 new generators, 40 seeds per level.
- **server** (26, 9, and 4): the sixteen scenarios of the brief, by number, in
  `adaptive.test.ts` (1–10, 14–16) and `teach.test.ts` (11–13); the upgrade of a database
  of the previous schema; the placement test; goals; practice tests; assignments and
  worked examples; what a teacher sees and can set, for a student of either kind of goal;
  a tutoring session; the tutor's instructions per learner; the coverage document against
  its data.

The scenario tests do not call the algorithm with hand-made inputs. Each lets a fictional
learner (`server/src/dev/personas.ts`: an ability per skill, a habit of errors, a pace)
answer through the same functions a browser reaches, with a clock that can be moved, and
states an expectation about the weeks that follow. They were run ten times over while
being written, to make sure none passes by luck.

Existing tests whose expectations changed, and why: the gate lists of levels 4 and 5 now
include `variety`; "every concept has problems at three levels" exempts the one
paper-only concept; a run summary test chooses which problem to correct at the second try
by whether the problem *has* a second try, because the family that comes second is no
longer the same.

**A reading, late.** On the last day two samples of every entrance-track generator were
read in Czech. About forty templates printed a noun in the wrong form after a small
number, two problems were degenerate (a fraction equal to one; an equation with the same
bracket on both sides), one decimal point had reached Czech prose. They are fixed, the
linter has two new rules for them, and the same rules found seven generators of the
school goal with the same fault. That this was found by reading, after 600 tests had
passed, is the reason `roadmap.md` asks for a proper read-through before a pupil sees the
problems.

### 9.4 What was verified outside the test suite

- **In a browser**, on a demonstration instance seeded by `scripts/dev-seed-class.ts`
  (a teacher and two fictional students with 24 simulated days): the learner's pages and
  the teacher's, in headless Chrome, read as screenshots. Several of the changes in §9.2
  came from that reading, not from tests.
- **In the container** (phase J), on 10 October 2026: the image built by Docker's own
  Compose (v5.6.0) through Podman's Docker-compatible API; a volume prepared with the
  README's commands, holding a database of the previous version with seventy simulated
  days in it and, as a second account, one two versions old. 107 checks through the
  published port — the old data intact after backup, migration and model rebuild; the
  features that existed; a new learner's whole first evening on an examination goal; the
  teaching pages and every refusal; work set for a student of each kind of goal — then
  the same accounts compared after a restart and after the container was removed and
  created again. All passed, and 28 pages opened in
  headless Chrome against the container without a console error or a failed request.
  Memory: 190 MB idle, 245 MB at the most.

Not verified: Docker Engine itself (the machine has none; the image was built by Buildah
and ran on the host's network as the namespace's own user); a real learner; a real
lesson; the AI tutor against a live model with the new instructions.

### 9.5 Limits, stated once more

- **No claim of complete coverage.** Problems exist for 34 of the 35 skills the four-year
  examination tests, carrying 89.2 % of the weight; the missing skill is constructions,
  10.9 % by Lemma's count. 16 of the 77 items of the specification have no problems.
  `cermat-coverage.md` lists both.
- **Weights are a reading, and for two variants a thin one**: four papers each.
- **Readiness is not a prediction.** The verdicts are thresholds chosen by reasoning.
  Nothing has been compared with examination results, and each school sets its own bar.
- **Every constant is a starting value** (`learning-model.md` §11).
- **No lessons in the entrance track**; worked examples, lenses and hints only.
- **The facts about the examination are dated** 9 October 2026 and concern spring 2027.
