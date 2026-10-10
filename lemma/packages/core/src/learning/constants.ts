import type { Level } from '../content/types';

/**
 * Every tunable number of the learning model, in one place.
 *
 * These are reasoned starting values, not fitted ones (docs/learning-model.md §11). After
 * changing any of them, run the recompute job so stored state matches the new model.
 */

/**
 * Bump whenever the rules that turn the log into skill states change — a constant below,
 * a gate, how an attempt is credited. A server that finds states computed under another
 * version rebuilds them from the log on start, so nobody has to remember to recompute.
 *
 *   1  initial model
 *   2  "hard" evidence is judged against the hardest problems a skill offers
 *   3  guessable answers move the estimate less and are not gate evidence; the upper
 *      levels ask for success in more than one problem family; placements from a
 *      diagnostic; counters for first tries, hints, timed work, reviews and days
 */
export const MODEL_VERSION = 3;

/** Item difficulty on the ability (logit) scale, per authored level. */
export const LEVEL_DIFFICULTY: Readonly<Record<Level, number>> = { 1: -1.5, 2: -0.5, 3: 0.5, 4: 1.5, 5: 2.5 };

export const ELO = {
  /** Update size for a brand-new skill… */
  K_INITIAL: 0.9,
  /** …decaying with the number of attempts… */
  K_DECAY: 0.12,
  /** …down to this floor. */
  K_MIN: 0.08,
  THETA_MIN: -4,
  THETA_MAX: 5,
  /** Share of the prerequisites' mean ability used as a prior for a new skill. */
  PREREQ_PRIOR: 0.3,
  PRIOR_MIN: -0.5,
  PRIOR_MAX: 0.8,
} as const;

/** How much an attempt counts, depending on how independently it was solved. */
export const CREDIT = {
  UNAIDED: 1,
  /** Correct on the second try. */
  AFTER_RETRY: 0.6,
  /** Each further retry. */
  RETRY_STEP: 0.15,
  /** Each hint taken. */
  HINT_STEP: 0.2,
  /** A solved problem is never worth less than this. */
  SOLVED_FLOOR: 0.2,
  /** Self-assessed answers move the estimate half as much. */
  SELF_ASSESSED_WEIGHT: 0.5,
  /** So does a right answer the learner said was a guess: honest, and weak evidence. */
  GUESSED_WEIGHT: 0.5,
  /**
   * From this chance of guessing right, a correct answer is not evidence for a level at
   * all (a true/false statement is a coin flip).
   */
  COIN_FLIP_CHANCE: 0.5,
} as const;

/** Evidence required for each mastery level. */
export const GATES = {
  PRACTISING_ATTEMPTS: 3,
  FAMILIAR_ATTEMPTS: 5,
  FAMILIAR_THETA: 0.4,
  FAMILIAR_RECENT_CREDIT: 0.6,
  PROFICIENT_THETA: 1.1,
  PROFICIENT_MIXED: 2,
  PROFICIENT_DELAY_DAYS: 2,
  PROFICIENT_HARD_LEVEL: 3,
  MASTERED_THETA: 1.9,
  MASTERED_MIXED: 3,
  MASTERED_DELAY_DAYS: 7,
  MASTERED_HARD_LEVEL: 4,
  /**
   * Independent successes in this many different problem families — or in as many as the
   * skill has, if it has fewer. One formulation solved again and again is not mastery.
   */
  PROFICIENT_FAMILIES: 2,
  MASTERED_FAMILIES: 3,
  /** A level already held survives ability dipping this far below its threshold. */
  HYSTERESIS: 0.3,
  /** How many recent attempts the "recent" conditions look at. */
  RECENT_WINDOW: 5,
} as const;

/** Problem selection aims for this predicted success rate. */
export const SELECTION = {
  /** Ideal item difficulty = ability − this (≈ 75 % predicted success). */
  THETA_OFFSET: 1.1,
  /** Until a skill has this many attempts, never go above level 2… */
  NOVICE_ATTEMPTS: 3,
  NOVICE_MAX_LEVEL: 2,
  /**
   * …unless the last problems on it were all solved independently. This many in a row
   * lift the limit and aim one level above the estimate's; the estimate moves cautiously,
   * and somebody who keeps succeeding should not be kept waiting for it.
   */
  STREAK_STEP: 2,
  /** This many in a row aim two levels above. */
  STREAK_LEAP: 4,
} as const;

/**
 * How sure the estimate is. A stated heuristic, not a fitted standard error: it shrinks
 * with the number of attempts and is widened while the evidence is one-sided — a single
 * problem family, or a single day.
 */
export const UNCERTAINTY = {
  /** With no evidence at all. */
  MAX: 1.5,
  MIN: 0.3,
  /** Evidence from one family only counts this much (when the skill has more). */
  ONE_FAMILY: 0.6,
  /** Evidence from a single day counts this much. */
  ONE_DAY: 0.8,
  /** "Low" confidence below these… */
  LOW_ATTEMPTS: 4,
  /** …"high" from these, with several days and families and a delayed success. */
  HIGH_ATTEMPTS: 8,
  HIGH_DAYS: 3,
} as const;

/**
 * What a diagnostic says about skills it did not ask: a cautious prior, replaced by the
 * skill's own evidence as soon as there is any.
 */
export const PLACEMENT = {
  /** Unaided success at level 3 or above: its prerequisites are presumed about this able… */
  UP_STRONG: 0.9,
  /** …at level 2, this able… */
  UP_STANDARD: 0.6,
  /** …and each further step down the graph, this share of it. */
  DECAY: 0.7,
  /** How far down the prerequisites a success reaches. */
  UP_DEPTH: 3,
  /** A miss on a standard or easier problem (level 2 or below): what builds on the skill starts this low… */
  DOWN: -0.6,
  DOWN_MAX_LEVEL: 2,
  /** …one step up the graph only. */
  DOWN_DEPTH: 1,
  /** A prerequisite never practised counts as "presumably fine" from this prior. */
  PRESUMED_OK: 0.4,
  /** A placed skill starts at the level its prior suggests, but never above this. */
  START_CAP: 3,
} as const;

/**
 * Choosing what to practise next: every skill of the goal gets a score, a sum of the terms
 * below times these weights. docs/learning-model.md §12 says what each term measures.
 * Starting values chosen by reasoning; change them here and nowhere else.
 */
export const PRIORITY = {
  /** How far from mastered × how much the examination weighs the skill. */
  NEED: 1.0,
  /** How much examination weight is waiting behind this prerequisite. */
  UNLOCK: 0.9,
  /** A scheduled review is due, or recall is predicted to have faded. */
  REVIEW: 0.8,
  /** Conceptual or procedural errors among the last attempts. */
  ERRORS: 0.7,
  /** The class is on it now. */
  SCHOOL: 0.5,
  /** The estimate is uncertain and the skill matters. */
  INFO: 0.35,
  /** The teacher asked for it. */
  ASSIGNED: 1.2,
  /** A skill held back by a weak prerequisite keeps this share of its score. */
  BLOCKED_FACTOR: 0.15,
  /**
   * A prerequisite with some work of its own stops holding others back from this estimate
   * (about two chances in three on a standard problem), as long as its recent attempts
   * show no conceptual or procedural error. Below "familiar", but nothing says it is missing.
   * One standard problem solved alone reaches it — typed, or chosen among five options;
   * a warm-up or a true/false statement does not.
   */
  PROMISING_THETA: 0.25,
  /** Each step along the graph passes on this share of the weight behind it. */
  UNLOCK_DECAY: 0.6,
  /** A skill of no weight of its own (a prerequisite) still counts this much. */
  PREREQ_FLOOR: 0.1,
  /** Review urgency of a due skill, growing to 1 over this many days overdue. */
  REVIEW_DUE: 0.6,
  REVIEW_FULL_AFTER_DAYS: 7,
  REVIEW_FADING: 0.4,
  REVIEW_FAILED_EXTRA: 0.2,
  /** This many recent conceptual errors saturate the error term. */
  ERRORS_SATURATE: 2,
  /** The teacher noted difficulty with the skill, or covered it and wants it checked. */
  FOCUS_DIFFICULTY: 0.6,
  FOCUS_COVERED: 0.3,
} as const;

/** Rules of one adaptive session, applied on top of the scores. */
export const SESSION = {
  /** After a failure the skill waits at least this many problems. */
  FAIL_COOLDOWN: 2,
  /** No skill more often than this in one session… */
  MAX_PER_SKILL: 4,
  /** …and each time it has been chosen its score is multiplied by this. */
  SKILL_REPEAT: 0.6,
  /** Each problem of a purpose already served multiplies that purpose's scores by this. */
  PURPOSE_REPEAT: 0.8,
  /** This many failures in a row are followed by a problem likely to be solved. */
  CONFIDENCE_AFTER_FAILS: 2,
  /** That problem's skill must have at least this predicted success at its usual level. */
  CONFIDENCE_MIN_P: 0.8,
  /** A stretch is offered after this many independent successes in a row… */
  STRETCH_AFTER_STREAK: 4,
  /** …and otherwise keeps this share of its score. */
  STRETCH_OTHERWISE: 0.3,
  /** Scores within this share of the best count as equal and are drawn at random. */
  TIE_BAND: 0.03,
} as const;

/** When the parts of the readiness report have enough behind them to be shown as values. */
export const READINESS = {
  /** A skill counts as covered from this many problems outside a diagnostic. */
  COVERED_ATTEMPTS: 3,
  /** Mastery is reported once this share of the weight has been covered. */
  MASTERY_NEEDS_COVERAGE: 0.4,
  /** Retention needs this many scheduled reviews. */
  RETENTION_MIN_REVIEWS: 5,
  /** Hard and unfamiliar problems: this many attempts. */
  UNFAMILIAR_MIN_ATTEMPTS: 8,
  /** "Ready for a timed test" from this coverage and this share at familiar or better. */
  TEST_READY_COVERAGE: 0.7,
  TEST_READY_FAMILIAR: 0.6,
  /** Below this coverage the verdict is "building the base". */
  BUILDING_BELOW: 0.4,
  /** Fewer skills with any evidence than this: nothing can be said. */
  NO_DATA_BELOW_SKILLS: 3,
} as const;

/** The placement test. */
export const DIAGNOSTIC = {
  MAX_ITEMS: 18,
  /** Anchors are asked at this level (standard). */
  ANCHOR_LEVEL: 2,
  /** After an anchor is solved, one harder problem at this level. */
  HARDER_LEVEL: 3,
  /** After a miss, a second problem on the same skill at this level. */
  SECOND_CHANCE_LEVEL: 1,
} as const;

export const RETENTION = {
  /** Reviews are scheduled so predicted recall is still this high. */
  TARGET: 0.9,
  /** Below this, a skill is shown as fading. */
  FADING_BELOW: 0.7,
  MAX_INTERVAL_DAYS: 180,
  /** A correct unaided answer faster than this share of the expected time is "easy". */
  EASY_SPEED: 0.6,
  /** Slower than this multiple of the expected time counts as "hard". */
  HARD_SPEED: 2,
  /** Implicit credit needed before an encompassed skill gets a free review. */
  IMPLICIT_THRESHOLD: 1,
  /** …and only if that skill is due within this many days. */
  IMPLICIT_DUE_WITHIN_DAYS: 3,
} as const;

/** Thresholds for guessing whether a wrong answer was a slip or a gap. */
export const SLIP = {
  /** Predicted success at or above this → the default guess is a slip. */
  LIKELY_SLIP_P: 0.85,
  /** At or below this → the default guess is a conceptual gap. */
  LIKELY_GAP_P: 0.4,
  /** Answered in less than this share of the expected time → rushed. */
  RUSHED_RATIO: 0.35,
} as const;

/** Activity points: what the heatmap counts. */
export const ACTIVITY = {
  SOLVED_UNAIDED_BASE: 2,
  SOLVED_HELPED_BASE: 1,
  /** An answer was submitted but the problem was not solved: effort still shows. */
  ATTEMPTED: 1,
  ERROR_CORRECTED: 2,
  REVIEW_BONUS: 1,
  LESSON_STEP: 1,
  LESSON_DONE: 4,
  LEVEL_UP: 6,
  EXAM_BASE: 10,
  LAB: 3,
  MISSION_MILESTONE: 8,
  /** Only this many level-1 problems count per day. */
  WARMUP_DAILY_CAP: 10,
  /** Seconds of real interaction before a Lab session counts. */
  LAB_MIN_SECONDS: 120,
} as const;

export const STREAK = {
  /** Points that make a day "active" — about ten focused minutes. */
  ACTIVE_THRESHOLD: 12,
  /** One rest day is earned per this many active days… */
  REST_EARN_EVERY: 6,
  /** …up to this many banked. */
  REST_CAP: 3,
  /** Default weekly goal in active days. */
  WEEK_GOAL: 4,
  CONSISTENCY_WINDOW: 28,
} as const;

/** Heatmap intensity thresholds (points per day) for levels 1–4. */
export const HEAT_LEVELS: readonly number[] = [1, 12, 30, 60];

export const DAY_MS = 86_400_000;
