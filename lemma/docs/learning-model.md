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
  `drill` (Error Lab) · `exam`
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

## 4. Levels and their evidence gates

Levels are computed by a pure function of the skill state. Each gate is something the
interface can name.

| Level | Requires |
|---|---|
| 0 **new** | nothing yet |
| 1 **introduced** | lesson opened or one attempt |
| 2 **practising** | ≥ 3 attempts |
| 3 **familiar** | ≥ 5 attempts · θ ≥ 0.4 · last 5 attempts ≥ 60 % credit |
| 4 **proficient** | *familiar* · θ ≥ 1.1 · ≥ 2 unaided correct answers in **mixed** context · ≥ 1 unaided correct after a gap of **≥ 2 days** · ≥ 1 unaided correct at level ≥ 3 |
| 5 **mastered** | *proficient* · θ ≥ 1.9 · ≥ 1 unaided correct at level ≥ 4 · ≥ 1 unaided correct after a gap of **≥ 7 days** · ≥ 3 mixed unaided · no gap-type error in the last 5 attempts |

"Unaided" = first try, no hints.

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
level whose *d* is closest to `θ − 1.1`, steps down after a failure, steps up after two
unaided successes, and avoids the previous problem family when another exists. New skills
start at level 1 regardless of θ.

In mixed contexts the skill label is hidden until the answer is checked.

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
4. **Error drill** — when one error type accounts for ≥ 3 of the last 20 errors.
5. **Experiment** (optional) — a Lab preset or mission step, sessions ≥ 45 minutes.

A test within 7 days changes what step 2 draws on: instead of the current chapter it takes
**every chapter the test covers** — the next unlearned lesson among them, otherwise the
weakest skill among them, and if nothing is weak, a mixed rehearsal of all of it. (An
earlier version prepared only from the first chapter listed for the test; a test on
chapters 3 and 4 then never practised chapter 4.) Within 3 days the challenge block becomes
a timed mock; the day before, the session is an error drill plus mixed retrieval, and
nothing new.

Each block carries a reason generated from the same data that selected it.

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

## 11. Known limitations

- Constants are reasoned, not fitted. Changing one means bumping `MODEL_VERSION`; the
  server then rebuilds every skill state from the log on its next start.
- Authored difficulty is not calibrated against data; one learner cannot calibrate items.
- FSRS intervals are tuned for recall of facts, not procedures.
- Self-classified errors are subjective. The inferred type is stored alongside.
- A skill is modelled as one ability; in reality "quadratic functions" has facets.
- The annual review's choice of "basic problem types" is an inference, not something the
  school published. If the teacher shows a past paper, retag the generators to match it.
