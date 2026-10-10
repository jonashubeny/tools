# Learning model

How Lemma decides what the learner knows, what to show next, and what counts as progress.
The implementation is `packages/core/src/learning/`; every number below is a named constant
in `constants.ts`. Sources for the claims are in `research.md` §3.

## 1. Design goals

1. Ten easy correct answers must not produce "mastered".
2. Distinguish *can do it right after the lesson* from *recognises and solves it cold*.
3. Separate **slips** from **gaps**, because they need different treatment.
4. Be explainable: for any level shown, the screen can state why and what is missing.
5. Be replaceable: all state derives from an append-only log and can be recomputed.

## 2. What is recorded

Every interaction is an **event** in an append-only log. Problem attempts carry:

- skill, problem family, seed, difficulty (1–5)
- context: `lesson` · `blocked` (topic practice) · `mixed` (interleaved, topic hidden) ·
  `drill` (Error Lab) · `challenge` · `exam` · `diagnostic` (placement test)
- the chance of a right answer by guessing: 1/5 for five options, 1/2 for a true/false
  statement, 0 for a typed answer
- where a selection was made, why the problem was asked (its purpose and the reason, §12)
- result: correct on first try / after retry / after hints / revealed
- hints used, retries, time taken against the item's expected time
- confidence before submitting (optional): sure · think so · guess
- error type: inferred, then confirmed or corrected by the learner
- days since this skill was last practised

Per-skill state is a cache computed from these. `recompute` rebuilds it from scratch.

## 3. Ability: an Elo-style estimate

Each skill has an ability θ (logit scale, starts at 0 with a prior nudge from its
prerequisites). Each problem has a difficulty *d* from its authored level:

| level | meaning | *d* |
|---|---|---|
| 1 | warm-up, single step | −1.5 |
| 2 | standard | −0.5 |
| 3 | core test level | 0.5 |
| 4 | hard, multi-step | 1.5 |
| 5 | boss, several concepts | 2.5 |

Predicted success: `P = 1 / (1 + e^(d − θ))`.

After an attempt with outcome *q* ∈ [0, 1]: `θ ← θ + K·(q − P)`, with
`K = 0.9 / (1 + 0.12·n) + 0.08` where *n* is the number of prior attempts — large moves
early, small ones later.

**Outcome credit *q*** — independent work is worth more:

| How it was solved | *q* |
|---|---|
| Correct, first try, no hints | 1.0 |
| Correct after one retry, no hints | 0.6 |
| Correct with hints | 0.6 → 0.2 (−0.2 per hint, floor 0.2) |
| Not solved / solution revealed | 0 |

Why this satisfies goal 1: with θ = 1 and an easy item (*d* = −1.5), P ≈ 0.92, so a correct
answer moves θ by about 0.08·K. Easy items cannot push the estimate far past their own
difficulty, and the levels below need evidence easy items cannot supply.

**Answers that can be guessed.** For a question with a chance *c* of guessing right, the
predicted success is `P′ = c + (1 − c)·P`. A right answer is then less of a surprise and
moves θ less; a wrong one says more. A right answer the learner marked "guess" moves θ by
half. Neither is a probability that has been fitted to anything: it is the standard
correction for guessing, applied to a reasoned scale.

**How sure the estimate is.** Each skill has an uncertainty
`σ = max(0.3, 1.5 / √(1 + n))`, where *n* is the number of attempts — counted at 60 % while
the independent successes come from a single problem family although the skill has
several, and at 80 % while all the work was done on one day. It is a stated heuristic, not
a standard error. The selection uses it to value problems that tell it something (§12).

The interface shows how far an estimate can be relied on in words, by a rule of its own:
*no data* · *little data* (fewer than four attempts, one day only, or one problem family) ·
*fairly sure* · *well supported* (eight attempts over three days and a success after a
gap of two days).

## 4. Levels and their evidence gates

Levels are computed by a pure function of the skill state. Each gate is something the
interface can name.

| Level | Requires |
|---|---|
| 0 **new** | nothing yet |
| 1 **introduced** | lesson opened or one attempt |
| 2 **practising** | ≥ 3 attempts |
| 3 **familiar** | ≥ 5 attempts · θ ≥ 0.4 · last 5 attempts ≥ 60 % credit |
| 4 **proficient** | *familiar* · θ ≥ 1.1 · ≥ 2 unaided correct answers in **mixed** context · ≥ 1 unaided correct after a gap of **≥ 2 days** · ≥ 1 unaided correct at level ≥ 3 · unaided correct in **2 different problem families** |
| 5 **mastered** | *proficient* · θ ≥ 1.9 · ≥ 1 unaided correct at level ≥ 4 · ≥ 1 unaided correct after a gap of **≥ 7 days** · ≥ 3 mixed unaided · unaided correct in **3 different problem families** · no gap-type error in the last 5 attempts |

"Unaided", wherever a gate counts it, means evidence that is worth counting: right at the
first try, without a hint, not self-assessed, **not marked as a guess**, and **not a
question a coin would answer as well** (chance of guessing below one half). A dozen
true/false statements judged correctly raise the estimate a little and open no gate.

**Variety.** One kind of problem solved again and again is not mastery of a skill. The
upper levels ask for independent success in different problem families — two for
*proficient*, three for *mastered*, or as many as the skill has if it has fewer.

**"Hard" is relative to what a skill offers.** The level-3 and level-4 requirements are
capped by the hardest problems the skill actually has. Converting degrees to radians has
no level-4 problem and should not need one; for such a skill "mastered" asks for an
unaided solve at its top level, and the gate says so ("level 3 or higher — the hardest
this skill has so far"). Every other requirement — ability, mixed context, the week-long
gap, no recent conceptual error — applies unchanged, so the level is still earned over
weeks, not in a sitting. Tests require every concept to have problems at level 3 at
least. When harder problems are added to a skill, its ceiling rises and a recompute holds
earlier work to the new standard.

*Familiar* is "I can solve this when I see a familiar example". *Proficient* is the first
level that requires recognising the problem type without being told (mixed context) and
remembering it (delay). That is the distinction the brief asks for, made concrete.

Levels do not drop because time passes. Instead each skill has a **retention** value
(next section); when it falls below 70 % the node is shown as *fading* and a review is
scheduled. A level drops only on evidence — failed reviews pull θ down.

## 5. Retention: when to review

Each skill is one card in an FSRS scheduler (`ts-fsrs`, target retention 0.9, long-term
mode). An attempt is graded:

| Attempt | FSRS rating |
|---|---|
| Failed / revealed | Again |
| Correct with help, or retry, or > 2× expected time | Hard |
| Correct unaided | Good |
| Correct unaided, ≤ 0.6× expected time, confidence "sure" | Easy |

Only attempts in `mixed`, `exam`, or after a ≥ 1-day gap update the schedule; repeated
blocked practice within a day is not treated as multiple spaced reviews.

**Implicit review credit.** A concept can declare `encompasses: [{skill, weight}]`. Solving
a problem on "quadratic function – vertex" genuinely exercises "completing the square".
When the parent attempt is correct and unaided, each encompassed skill accumulates
`weight` of credit; at ≥ 1.0, if that skill is due within three days, it receives a *Good*
review without a problem being spent. A failure attributed (by misconception tag) to an
encompassed skill makes that skill due immediately. This is a deliberately simplified
version of Fractional Implicit Repetition.

## 6. Errors

### Taxonomy

Three families, because the remedy differs.

| Family | Type | Meaning |
|---|---|---|
| **slip** | `sign` | lost or flipped sign, reversed inequality |
| | `arithmetic` | numerical slip |
| | `copy` | copied the problem or own line incorrectly |
| | `misread` | answered a different question (gave *x*, asked for *f(x)*) |
| | `notation` | right idea, wrong form (bracket type, units, missing ±) |
| | `rushed` | made under time pressure |
| **procedure** | `algebra` | invalid manipulation |
| | `formula` | wrong formula or misapplied |
| | `domain` | forgot a condition, kept an extraneous root |
| | `incomplete` | missed a case or a second solution |
| | `graph` | misread a graph |
| **concept** | `concept` | misunderstood the idea |
| | `strategy` | wrong approach |
| | `unknown` | did not know how to start |

### Inference, in order of trust

1. **Misconception signature.** The problem lists specific wrong answers with their cause
   ("vertex x-coordinate with the sign of *b* not flipped" → `sign`). A match is strong
   evidence and comes with a specific message.
2. **Structural heuristics** on the answer: negation of the correct value → `sign`;
   proper subset of the solution set → `incomplete`; superset containing a listed
   extraneous root → `domain`; right endpoints, wrong brackets → `notation`; swapped
   coordinates → `misread`; complement of the correct interval set → `sign` (inequality
   direction).
3. **Model-based slip prior.** If predicted success was ≥ 0.85, the default family is
   *slip*; if ≤ 0.4, *concept*. This is the "slip" idea from knowledge tracing.
4. **Timing.** Under 35 % of expected time, or in a timed exam with the clock nearly out →
   `rushed`.

The result is a suggestion. The learner confirms or changes it; that choice is what is
stored and it is itself a moment of reflection.

### Slip rate

`slip rate = slip-family errors / attempts`, over a rolling window. It is the headline
number of the Error Lab and the main long-term success metric.

### Training against slips

- **Find-the-mistake** items train error detection.
- **Targeted drills** concentrate the trap that produced the learner's most common error.
- **Confidence before submit** makes over-confident errors visible.
- **Replay**: any past mistake can be reopened with the identical problem.
- **Estimation and check** problem types practise sanity-checking and back-substitution.

## 7. Choosing the next problem

Within a skill, the selector aims at **predicted success of 0.70–0.85**: it picks the
level whose *d* is closest to `θ − 1.1`. Three things move it from there:

- **The last problem on the skill was not solved independently** → one level lower.
- **A run of independent successes** on the skill, counted across sessions and days: two in
  a row aim one level above the estimate's, four in a row two above. The estimate moves
  cautiously by design; somebody who keeps succeeding should not have to wait for it.
- **A new skill** starts at its lowest level, and stays at level 2 or below for its first
  three attempts — unless a placement test has said something about it (then it starts
  where the estimate points, at level 3 at most), or the first two attempts were both
  solved independently.

The problem family used last for a skill is never used again straight away when the level
offers another; among the rest, the less recently used are more likely.

In mixed contexts the skill label is hidden until the answer is checked.

*Which skill* comes next is a separate question: §8 for the school syllabus, §12 for an
examination goal.

## 8. The daily session

Input: minutes available, skill states, due reviews, current chapter, upcoming tests,
recent errors. Output: an ordered list of blocks, stored for the day so it does not
reshuffle on reload.

Priority order when time is short:

1. **Reviews due** (mixed) — capped at ~25 % of the time, most overdue first.
2. **Current topic** — the next unlearned lesson step, otherwise adaptive practice on the
   weakest skill of the chapter. If a prerequisite of that skill is below *familiar*, the
   prerequisite is scheduled first and the reason says so.
3. **Challenge** — one level-4/5 or mixed-concept problem, only when the session is ≥ 30
   minutes and the topic has a skill at *familiar* or above.
4. **Error drill** — when one error type accounts for ≥ 3 of the last 20 errors whose kind
   rests on something: confirmed by the learner, a known wrong answer or pattern, or an
   answer that came far too fast. A label the model merely fell back on is not a pattern.
5. **Experiment** (optional) — a Lab preset or mission step, sessions ≥ 45 minutes.

A test within 7 days changes what step 2 draws on: instead of the current chapter it takes
**every chapter the test covers** — the next unlearned lesson among them, otherwise the
weakest skill among them, and if nothing is weak, a mixed rehearsal of all of it. (An
earlier version prepared only from the first chapter listed for the test; a test on
chapters 3 and 4 then never practised chapter 4.) Within 3 days the challenge block becomes
a timed mock; the day before, the session is an error drill plus mixed retrieval, and
nothing new.

Each block carries a reason generated from the same data that selected it.

### The plan of an examination goal

A learner preparing for an entrance examination has no "chapter the class is on" to hang a
plan on. Their day is composed from other blocks (`composeGoalPlan`), in this order:

1. **The placement test** (§13) — proposed until one has been taken or declined.
2. **Whatever the teacher assigned**, one block per open assignment (§16).
3. **An adaptive session** — the main block and the rest of the time. Every problem in it
   is chosen at the moment it is asked (§12), so the block names only the skills that
   lead the scores now and what each would be practised for.
4. **Error drill** — as above, in sessions of 25 minutes or more.
5. **A timed practice test** (§10), offered beside the day's work once the readiness
   report says the base is there (§15), at most once in seven days.

The plan is stored for the day with a fingerprint of what it was composed from: the goal,
the open assignments and whether a placement test exists. When that changes — the teacher
assigns something in the afternoon — the plan is composed again, and a block already
started finds itself by its name.

## 9. Activity score, consistency, streak

**Activity score** per day — what the heatmap shows:

| Event | Points |
|---|---|
| Problem solved unaided | 2 + level |
| Problem solved with help | 1 + level/2 |
| Problem attempted but not solved (an answer was submitted) | 1 |
| Error corrected (wrong, then right on retry) | +2 |
| Review passed (mixed/delayed) | +1 on top |
| Lesson step completed | 1 |
| Lesson finished | 4 |
| Level gained | 6 |
| Exam finished | 10 + score/10 |
| Lab experiment (≥ 2 min of interaction, once per tool per day) | 3 |
| Mission milestone | 8 |

Level-1 problems count at most 10 per day; nothing is awarded for time alone, and nothing
for opening a problem and giving up without an attempt. The single point for a failed
attempt exists so that a day spent struggling honestly with hard problems does not look
like a day off. A day is
**active** at ≥ 12 points — about ten focused minutes.

Days roll over at 04:00 local time, so a late session counts for the day it belongs to.

- **Consistency**: active days in the last 28. The primary habit metric.
- **Streak**: consecutive active days. A missed day consumes a **rest day** if one is
  banked; one is earned per 6 active days, capped at 3. They apply automatically.
- **Week rhythm**: consecutive weeks reaching the weekly goal (default 4 active days).
- **Pause**: a declared date range in which nothing breaks.

No message is ever phrased as a loss.

## 10. Exams

A blueprint (skills, item count, level mix, time limit) produces a fixed item list. No
hints, no feedback until submission. Scoring is the evaluator's verdict per item. Attempts
count as `exam` context: unaided, mixed evidence. The report classifies each wrong answer
as slip or gap using §6, compares time per item with expectation, and ranks follow-up
practice by (missed points × skill importance).

Three blueprints exist: a five-item quick check, an eight-item chapter test, and the
twelve-item **annual review**, which mirrors the test the school sets at the end of the
year. The review differs from the other two in how it is drawn:

- It covers every chapter up to the current one (or the chapters asked for), and only the
  problem types tagged as a chapter's *basic* types (`content-model.md` §2).
- It goes chapter by chapter: no chapter appears twice before every chapter has appeared
  once. With four chapters covered, each gets three items; with all seventeen, twelve
  different chapters are drawn, different ones each time.

The syllabus says only that such a test exists and that it covers basic problem types.
Which types those are is Lemma's reading of each chapter, and it is easy to change: it is
one tag on a generator.

**Practice tests of an entrance examination** are a fourth kind, with a fixed structure
instead of a level mix: one problem per answer field of the real test, in that field's
format (typed, five options, true/false, six options) and worth its points. Three
true/false statements and three matchings are **bundles**, scored together by how many
parts are right, as in the 2026 answer keys: three, two, one or no right statements give
4, 2, 0 or 0 points; matchings give 6, 4, 2 or 0 (5, 3, 1 or 0 in the eight-year
variant). No school grade is given. Construction tasks cannot be done on a screen:
the test says how many of the 50 points it leaves out, and its time limit is shortened by
their share. The report adds when each missed skill comes back in the review schedule.
What the structure rests on: `cermat-coverage.md` §4.

## 11. Known limitations

- Constants are reasoned, not fitted. Changing one means bumping `MODEL_VERSION`; the
  server then rebuilds every skill state from the log on its next start.
- Authored difficulty is not calibrated against data; one learner cannot calibrate items.
- FSRS intervals are tuned for recall of facts, not procedures.
- Self-classified errors are subjective. The inferred type is stored alongside.
- A skill is modelled as one ability; in reality "quadratic functions" has facets.
- The annual review's choice of "basic problem types" is an inference, not something the
  school published. If the teacher shows a past paper, retag the generators to match it.
- The weights of §12, the thresholds of §13 and §15 and the uncertainty of §3 are reasoned
  starting values like everything else here. None has been fitted to learners' results, and
  nothing in the interface is presented as a calibrated probability.
- A skill's weight in an examination is its share of points in past papers as Lemma
  classified them (`cermat-coverage.md`). The Centre publishes no weights.

## 12. Choosing the next skill for an examination goal

`priority.ts`. Every step of an adaptive session scores each skill of the learner's goal
again and takes the best one the session's rules allow, so what happened a minute ago
changes what comes now.

### The score

A weighted sum of named terms, each between 0 and 1. The interface can show the terms and
names the heaviest as the reason.

| Term | What it measures | Weight |
|---|---|---|
| need | `(1 − progress) × importance`, where importance is the skill's weight in the examination relative to the heaviest skill (a prerequisite, or a tested skill no read paper contained, counts 0.1) | 1.0 |
| unlock | the need of everything that builds on this skill, up to four steps along the prerequisite graph and fading by 0.6 per step, relative to the skill with most behind it — counted only while this skill is itself in the way | 0.9 |
| review | 0.6 when a review is due, rising to 1 over a week overdue; 0.4 when recall is predicted to have faded; +0.2 after a failed review | 0.8 |
| errors | conceptual or procedural errors among the last five attempts (two saturate it) | 0.7 |
| school | the class is on it now: `1 − progress` for a skill marked so in Settings | 0.5 |
| information | for a skill with fewer than four attempts: its uncertainty × how much it matters | 0.35 |
| assigned | the teacher assigned it (1), noted difficulty with it (0.6) or covered it (0.3) | 1.2 |

Enrichment — skills of the next part of the specification — has no importance until every
tested skill is at least *familiar*, and then that of a prerequisite. A skill without
problems (constructions) scores 0.

### Prerequisites are a constraint

A skill below *familiar* is **held back** while one of its direct prerequisites is *in the
way*. A prerequisite is in the way unless one of these holds:

- it is *familiar* or better;
- a placement test makes it likely (a presumed estimate of 0.4 or more, no attempts yet);
- the learner's own first attempts went well: an estimate of 0.25 or more with no
  conceptual or procedural error among the recent attempts. One standard problem solved
  alone reaches that; a warm-up or a true/false statement does not;
- it has no problems to practise with.

A held-back skill keeps 15 % of its score, and — more to the point — **is not asked while
anything else can be**: the session takes it only when every skill that is not held back
is resting or used up. The prerequisite goes first, and the reason shown says which skill
it is being practised for. Work the teacher assigned is never held back.

### Purpose

Each scored skill gets a purpose, which decides the practice context and the level:

| Purpose | When | Context | Level |
|---|---|---|---|
| new | never attempted | topic named, hints | ≤ 2, or ≤ 3 if placed |
| repair | below *familiar* with recent gap errors, or more waits behind the skill than it needs itself | topic named, hints | ≤ 2 (≤ 3 if placed) |
| consolidate | started, below *familiar* | topic named, hints | by the estimate |
| review | *familiar* or better, and the review term outweighs need and unlock | **topic hidden** | ≤ 3 |
| exam-style | *familiar*; or *proficient* and better where the skill has no hard problems | **topic hidden** | ≥ 3 |
| stretch | *proficient* or better, problems of level ≥ 4 exist | one harder problem | ≥ 4 |
| assigned | named by an open assignment | topic named | by the estimate |
| confidence | after two failures in a row (below) | topic named | ≤ 2 |

A skill below *familiar* that is due is still being learned: it comes back with its name
and its hints, not as a hidden-topic review.

### Session rules

Applied on top of the scores:

- never the same skill twice in a row;
- after a failure the skill rests for two problems, then returns — in another problem
  family (§7);
- at most four problems of one skill per session, each repeat multiplying its score by 0.6;
- each problem of a purpose already served multiplies that purpose's scores by 0.8, so that
  a session mixes new material, repairs, reviews and examination-style problems;
- after **two failures in a row**, the next problem is one the learner is likely to solve:
  a practised skill with a predicted success of 0.8 or more at its easiest level;
- a **stretch** keeps 30 % of its score until four problems in a row were solved
  independently;
- scores within 3 % of the best are drawn at random, with a seed fixed per step.

The rules of §7 then choose the level and the problem family within the limits of the
purpose.

For the school goal the same scoring runs an "adaptive practice" beside the daily plan of
§8. There are no examination weights there: every skill of the syllabus counts alike, the
foundations are prerequisites, and the rest is enrichment.

## 13. The placement test

`diagnostic.ts`, `placement.ts`. At most 18 problems, no hints, one answer each, and
nothing said about right or wrong until the end. "I do not know this" is always there.

1. **Anchors.** One standard (level 2) problem on each anchor skill of the goal — eight to
   twelve skills spread over the curriculum, listed in `goals.ts`.
2. **After a miss: a second chance.** One easier (level 1) problem on the same skill — of
   another kind where the skill has one. A single wrong answer settles nothing.
3. **After a second miss: one step down.** A standard problem on the nearest prerequisite,
   to see how far the gap goes.
4. **After a success: one harder problem** (level 3). Misses are followed up first, so a
   short test spends its problems where the gaps are.

Verdict per anchor: *strong* (standard and harder solved) · *sound* (standard solved) ·
*shaky* (missed, the easier one solved) · *gap* (missed twice).

**What it says about skills it did not ask.** A standard problem solved alone makes its
prerequisites likely, up to three steps down the graph: an estimate of 0.6 (0.9 after a
level-3 problem), times 0.7 per further step. A standard or easier problem missed lowers
what builds directly on that skill to −0.6. A miss on the harder problem lowers nothing:
it says the skill is not strong, not that what builds on it is missing. Among signals a
"down" overrides an "up". These are priors for skills *without* attempts: a skill's own
first answer starts from the prior and moves it by the full first step of §3, and no later
signal touches a skill that has evidence of its own.

True/false statements are not asked in a placement test, and the answers to the test are
ordinary log entries: rebuilding the model from the log reproduces every placement. The
test can be skipped (everything then starts from the basics) and repeated; the report
compares each anchor with the previous test.

## 14. Path states

`path.ts`. What the map shows for each skill is one of seven states, read off the
evidence by rule — never set by hand, and each with the rule that applied.

| State | Rule |
|---|---|
| not started | no attempt, no lesson, no placement |
| diagnosed | evidence only from a placement test: its own answers there, or a prior from neighbouring skills |
| learning | *introduced* or *practising* (levels 1–2) |
| practising | *familiar* (level 3) |
| consolidating | *proficient* (level 4) |
| mastered | every gate passed (level 5) |
| needs review | *familiar* or better, and the last due review was failed, a review is due, or recall is predicted to have faded |

"Needs review" keeps the level: a skill is not demoted by the calendar (§4).

## 15. Readiness

`readiness.ts`. Several statements, never one number. Each has a value only when enough
stands behind it; otherwise the interface says "not enough data" and what is missing.

| Part | Value | Shown from |
|---|---|---|
| coverage | share of the examination's points (by weight) on skills practised at least 3 times outside a placement test | 3 skills with any evidence |
| familiar · proficient | share of the weight at level ≥ 3 · ≥ 4 | coverage ≥ 40 % |
| retention | scheduled reviews passed ÷ taken | 5 reviews |
| timed | points of the last practice test ÷ points a screen allows | 1 test |
| hard and unfamiliar | first-try, no-hint successes on problems of level ≥ 4 and in timed tests | 8 such problems |
| gaps | skills that were tried and are in the way (§12), with what waits behind them | — |

The verdict is a phrase: *nothing to judge from* · *the base is being built* (coverage
below 40 %) · *practising across the curriculum* · *time for a timed test* (coverage ≥ 70 %
and 60 % of the weight at least familiar). The weight of skills that cannot be practised
on a screen is reported separately and is in none of the figures. Nothing is a probability
of admission: schools set their own thresholds, and the model has not been checked against
examination results.

## 16. What a teacher changes

A teacher's actions steer what is selected. None of them changes a level.

- **An assignment** adds the `assigned` term to its skills and puts a block first in the
  daily plan. It is done by doing it. The plan of an examination goal is composed again
  around it; the plan of the school goal is not — its blocks stay as they were composed
  in the morning, and the assigned block is put in front of them.
- **A note about a skill** from a tutoring session — "caused difficulty" or "covered, to be
  checked" — adds 0.6 or 0.3 of the `assigned` weight for two weeks. It acts where the
  score of §12 decides: in every adaptive session, and so in the daily plan of an
  examination goal. The daily plan of the school goal (§8) follows the class and does
  not read it.
- **Problems shown in a session** are not attempts. What two people work out together says
  nothing about what one can do alone, so they never reach the learner's log.
