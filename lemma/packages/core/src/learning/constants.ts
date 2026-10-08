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
 */
export const MODEL_VERSION = 2;

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
  /** A level already held survives ability dipping this far below its threshold. */
  HYSTERESIS: 0.3,
  /** How many recent attempts the "recent" conditions look at. */
  RECENT_WINDOW: 5,
} as const;

/** Problem selection aims for this predicted success rate. */
export const SELECTION = {
  /** Ideal item difficulty = ability − this (≈ 75 % predicted success). */
  THETA_OFFSET: 1.1,
  /** Until a skill has this many attempts, never go above level 2. */
  NOVICE_ATTEMPTS: 3,
  NOVICE_MAX_LEVEL: 2,
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
