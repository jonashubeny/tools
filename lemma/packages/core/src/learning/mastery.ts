import type { Diagnosis } from '../answer/check';
import type { Level } from '../content/types';
import { CREDIT, DAY_MS, ELO, GATES, LEVEL_DIFFICULTY, RETENTION, SLIP, UNCERTAINTY } from './constants';
import { ERROR_FAMILY, type ErrorFamily, type ErrorType } from './errors';
import { type ReviewCard, ratingFor, retrievability, reviewCard } from './scheduler';

/**
 * The per-skill learner model: an Elo-style ability estimate plus counters of the kinds
 * of evidence the mastery levels require. See docs/learning-model.md §3–§5.
 *
 * Everything here is a pure function of (previous state, attempt), so the whole state can
 * be rebuilt by replaying the attempt log.
 */

/** In which situation a problem was solved — it decides what the result proves. */
export type PracticeContext =
  | 'lesson' // check step inside a lesson
  | 'blocked' // practising one known topic
  | 'mixed' // interleaved review, topic hidden
  | 'drill' // Error Lab drill
  | 'challenge' // a single harder problem
  | 'exam' // timed, no hints, no feedback
  | 'diagnostic'; // placement: topic hidden, no hints, no feedback until the end

export const MASTERY_LEVELS = ['new', 'introduced', 'practising', 'familiar', 'proficient', 'mastered'] as const;
export type MasteryName = (typeof MASTERY_LEVELS)[number];
export type MasteryLevel = 0 | 1 | 2 | 3 | 4 | 5;

export type Confidence = 'sure' | 'think' | 'guess';

export interface SkillState {
  skill: string;
  /** Resolved problems (solved or given up). */
  attempts: number;
  /** Solved in any way. */
  solved: number;
  /** Solved on the first try without hints. */
  unaided: number;
  /** Ability estimate on the logit scale. */
  theta: number;
  /** Credit of the most recent attempts, oldest first. */
  recent: number[];
  /** Error family of the most recent attempts (null = no error), oldest first. */
  recentFamilies: (ErrorFamily | null)[];
  /** Unaided successes with the topic hidden. */
  mixedUnaided: number;
  /** Unaided successes after a gap of at least GATES.PROFICIENT_DELAY_DAYS. */
  delayedShort: number;
  /** Unaided successes after a gap of at least GATES.MASTERED_DELAY_DAYS. */
  delayedLong: number;
  /** Unaided successes at level ≥ 3. */
  hardCore: number;
  /** Unaided successes at level ≥ 4. */
  hardTop: number;
  /** Smoothed ratio of time taken to time expected, on solved problems. */
  speed: number | null;
  firstSeenAt: number | null;
  lastPracticedAt: number | null;
  lessonSeen: boolean;
  card: ReviewCard | null;
  /** Accumulated implicit review credit from problems that encompass this skill. */
  implicitCredit: number;
  errors: Partial<Record<ErrorType, number>>;
  /** Confidence calibration: stated confidence versus first-try outcome. */
  calibration: { sureRight: number; sureWrong: number; unsureRight: number; unsureWrong: number };
  level: MasteryLevel;
  /** When the current level was reached. */
  levelAt: number | null;
  /** Solved at the first submission, with or without a hint. */
  firstTry: number;
  /** Resolved with at least one hint (or the tutor's help). */
  hinted: number;
  /** Right first time, but declared a guess or asked as a coin flip: not gate evidence. */
  guessed: number;
  /** Problem families with an independent success, oldest first (at most eight). */
  families: string[];
  /** How many families the skill offered when it was last practised; 0 if not known. */
  familyCap: number;
  /** Under examination conditions. */
  timed: { attempts: number; solved: number };
  /** Scheduled reviews that had come due. */
  reviews: { passed: number; failed: number };
  /** The last review that had come due was failed. */
  reviewFailed: boolean;
  /** Distinct days with an attempt. */
  days: number;
  /** Day number of the last attempt, for counting days. */
  lastDay: number | null;
  lastSuccessAt: number | null;
  /** Attempts made in a diagnostic. */
  diagnosed: number;
  /**
   * A prior inferred in a diagnostic from neighbouring skills, while the skill itself has
   * no attempts. `theta` already carries it; this records that it is an inference.
   */
  placement: { theta: number; at: number } | null;
}

export function emptySkillState(skill: string, priorTheta = 0): SkillState {
  return {
    skill,
    attempts: 0,
    solved: 0,
    unaided: 0,
    theta: priorTheta,
    recent: [],
    recentFamilies: [],
    mixedUnaided: 0,
    delayedShort: 0,
    delayedLong: 0,
    hardCore: 0,
    hardTop: 0,
    speed: null,
    firstSeenAt: null,
    lastPracticedAt: null,
    lessonSeen: false,
    card: null,
    implicitCredit: 0,
    errors: {},
    calibration: { sureRight: 0, sureWrong: 0, unsureRight: 0, unsureWrong: 0 },
    level: 0,
    levelAt: null,
    firstTry: 0,
    hinted: 0,
    guessed: 0,
    families: [],
    familyCap: 0,
    timed: { attempts: 0, solved: 0 },
    reviews: { passed: 0, failed: 0 },
    reviewFailed: false,
    days: 0,
    lastDay: null,
    lastSuccessAt: null,
    diagnosed: 0,
    placement: null,
  };
}

/** A new skill starts slightly above or below zero depending on its prerequisites. */
export function priorTheta(prerequisiteThetas: readonly number[]): number {
  if (prerequisiteThetas.length === 0) return 0;
  const mean = prerequisiteThetas.reduce((sum, t) => sum + t, 0) / prerequisiteThetas.length;
  return Math.max(ELO.PRIOR_MIN, Math.min(ELO.PRIOR_MAX, ELO.PREREQ_PRIOR * mean));
}

/** Probability of solving an item of the given level unaided. */
export function predictSuccess(theta: number, level: Level): number {
  return 1 / (1 + Math.exp(LEVEL_DIFFICULTY[level] - theta));
}

/**
 * The same for a question that can be answered right by luck: with five options a fifth
 * of the learners who do not know still get it. A right answer is then less of a surprise
 * and moves the estimate less; a wrong one says more.
 */
export function predictWithChance(theta: number, level: Level, chance = 0): number {
  const guess = Math.max(0, Math.min(0.9, chance));
  return guess + (1 - guess) * predictSuccess(theta, level);
}

export function kFactor(attempts: number): number {
  return ELO.K_INITIAL / (1 + ELO.K_DECAY * attempts) + ELO.K_MIN;
}

/** A finished problem, as the learner model sees it. */
export interface ResolvedAttempt {
  skill: string;
  level: Level;
  context: PracticeContext;
  solved: boolean;
  /** The first submitted answer was correct. */
  firstTry: boolean;
  hints: number;
  /** Wrong submissions before the problem was resolved. */
  retries: number;
  seconds: number;
  expectedSeconds: number;
  confidence?: Confidence;
  /** Type of the first error, if there was one. */
  errorType?: ErrorType | null;
  /** The answer was graded by the learner (explanation questions). */
  selfAssessed?: boolean;
  at: number;
  /**
   * The highest level at which the skill has problems at all. "Hard" evidence is judged
   * against it: a skill whose hardest problems are level 3 must not be barred from the
   * top level for lack of a level-4 problem that does not exist.
   */
  ceiling?: Level;
  /** The problem family (generator or static problem) the attempt belongs to. */
  family?: string;
  /** How many families the skill has that count as evidence. */
  families?: number;
  /** Probability of a right answer by guessing: 1/5 for five options, 0 for a typed answer. */
  chance?: number;
}

export const isUnaided = (a: ResolvedAttempt): boolean => a.solved && a.firstTry && a.hints === 0;

/**
 * Unaided, and worth counting towards a level: not self-assessed, not a declared guess,
 * and not a question where a coin would do as well.
 */
export const isStrongEvidence = (a: ResolvedAttempt): boolean =>
  isUnaided(a) && !a.selfAssessed && a.confidence !== 'guess' && (a.chance ?? 0) < CREDIT.COIN_FLIP_CHANCE;

/** Outcome credit q ∈ [0, 1]: independent work is worth more. */
export function creditOf(a: ResolvedAttempt): number {
  if (!a.solved) return 0;
  const base = a.retries === 0 ? CREDIT.UNAIDED : CREDIT.AFTER_RETRY - CREDIT.RETRY_STEP * (a.retries - 1);
  return Math.max(CREDIT.SOLVED_FLOOR, Math.min(1, base - CREDIT.HINT_STEP * a.hints));
}

const hidesTopic = (context: PracticeContext): boolean =>
  context === 'mixed' || context === 'exam' || context === 'diagnostic';

function pushWindow<T>(list: readonly T[], item: T, size: number): T[] {
  const out = [...list, item];
  return out.length > size ? out.slice(out.length - size) : out;
}

export interface AttemptEffect {
  state: SkillState;
  /** Predicted success before the attempt. */
  predicted: number;
  credit: number;
  thetaBefore: number;
  thetaAfter: number;
  levelBefore: MasteryLevel;
  levelAfter: MasteryLevel;
  /** The review schedule was updated by this attempt. */
  reviewed: boolean;
  /** This attempt counted as passing a scheduled review. */
  reviewPassed: boolean;
}

/** The problem level that counts as "hard" for a gate, given what the skill offers. */
export const hardLevelFor = (wanted: number, ceiling: number | undefined): number =>
  Math.min(wanted, ceiling ?? wanted);

/** Fold one finished problem into the skill state. */
export function applyAttempt(prev: SkillState, a: ResolvedAttempt): AttemptEffect {
  const predicted = predictWithChance(prev.theta, a.level, a.chance);
  const credit = creditOf(a);
  const guessed = isUnaided(a) && (a.confidence === 'guess' || (a.chance ?? 0) >= CREDIT.COIN_FLIP_CHANCE);
  const weight = a.selfAssessed
    ? CREDIT.SELF_ASSESSED_WEIGHT
    : a.confidence === 'guess' && a.solved
      ? CREDIT.GUESSED_WEIGHT
      : 1;
  const theta = Math.max(
    ELO.THETA_MIN,
    Math.min(ELO.THETA_MAX, prev.theta + kFactor(prev.attempts) * weight * (credit - predicted)),
  );

  const gapDays = prev.lastPracticedAt === null ? 0 : (a.at - prev.lastPracticedAt) / DAY_MS;
  // Self-assessed answers and guesses are too soft to count as gate evidence.
  const unaided = isStrongEvidence(a);
  const dayNumber = Math.floor(a.at / DAY_MS);
  const wasDue = prev.card !== null && prev.card.lastReview !== null && prev.card.due <= a.at;

  const state: SkillState = {
    ...prev,
    attempts: prev.attempts + 1,
    solved: prev.solved + (a.solved ? 1 : 0),
    unaided: prev.unaided + (unaided ? 1 : 0),
    theta,
    recent: pushWindow(prev.recent, credit, 8),
    recentFamilies: pushWindow(
      prev.recentFamilies,
      a.errorType ? ERROR_FAMILY[a.errorType] : null,
      GATES.RECENT_WINDOW,
    ),
    mixedUnaided: prev.mixedUnaided + (unaided && hidesTopic(a.context) ? 1 : 0),
    delayedShort: prev.delayedShort + (unaided && gapDays >= GATES.PROFICIENT_DELAY_DAYS ? 1 : 0),
    delayedLong: prev.delayedLong + (unaided && gapDays >= GATES.MASTERED_DELAY_DAYS ? 1 : 0),
    hardCore: prev.hardCore + (unaided && a.level >= hardLevelFor(GATES.PROFICIENT_HARD_LEVEL, a.ceiling) ? 1 : 0),
    hardTop: prev.hardTop + (unaided && a.level >= hardLevelFor(GATES.MASTERED_HARD_LEVEL, a.ceiling) ? 1 : 0),
    firstSeenAt: prev.firstSeenAt ?? a.at,
    lastPracticedAt: a.at,
    errors: { ...prev.errors },
    calibration: { ...prev.calibration },
    firstTry: prev.firstTry + (a.solved && a.firstTry ? 1 : 0),
    hinted: prev.hinted + (a.hints > 0 ? 1 : 0),
    guessed: prev.guessed + (guessed ? 1 : 0),
    families:
      unaided && a.family !== undefined && !prev.families.includes(a.family)
        ? pushWindow(prev.families, a.family, 8)
        : prev.families,
    familyCap: a.families ?? prev.familyCap,
    timed:
      a.context === 'exam'
        ? { attempts: prev.timed.attempts + 1, solved: prev.timed.solved + (a.solved ? 1 : 0) }
        : prev.timed,
    reviews: wasDue
      ? { passed: prev.reviews.passed + (a.solved ? 1 : 0), failed: prev.reviews.failed + (a.solved ? 0 : 1) }
      : prev.reviews,
    reviewFailed: wasDue ? !a.solved : prev.reviewFailed && !a.solved,
    days: prev.days + (prev.lastDay === dayNumber ? 0 : 1),
    lastDay: dayNumber,
    lastSuccessAt: a.solved ? a.at : prev.lastSuccessAt,
    diagnosed: prev.diagnosed + (a.context === 'diagnostic' ? 1 : 0),
    // The skill now has evidence of its own; what was inferred has done its work.
    placement: null,
  };

  if (a.solved && a.expectedSeconds > 0) {
    const ratio = Math.max(0.2, Math.min(4, a.seconds / a.expectedSeconds));
    state.speed = prev.speed === null ? ratio : prev.speed * 0.7 + ratio * 0.3;
  }
  if (a.errorType) state.errors[a.errorType] = (state.errors[a.errorType] ?? 0) + 1;
  if (a.confidence) {
    const sure = a.confidence === 'sure';
    const right = a.solved && a.firstTry;
    if (sure && right) state.calibration.sureRight++;
    else if (sure) state.calibration.sureWrong++;
    else if (right) state.calibration.unsureRight++;
    else state.calibration.unsureWrong++;
  }

  // Only spaced or topic-hidden attempts say something about retention. Repeating a
  // blocked exercise five times in one sitting is one learning event, not five reviews.
  const reviewed = prev.card === null || hidesTopic(a.context) || gapDays >= 1;
  if (reviewed) {
    state.card = reviewCard(
      prev.card,
      ratingFor({
        solved: a.solved,
        unaided,
        seconds: a.seconds,
        expectedSeconds: a.expectedSeconds,
        confidence: a.confidence,
      }),
      a.at,
    );
    state.implicitCredit = 0;
  }

  const levelAfter = levelOf(state, prev.level);
  state.level = levelAfter;
  if (levelAfter !== prev.level) state.levelAt = a.at;

  return {
    state,
    predicted,
    credit,
    thetaBefore: prev.theta,
    thetaAfter: theta,
    levelBefore: prev.level,
    levelAfter,
    reviewed,
    reviewPassed: reviewed && wasDue && a.solved,
  };
}

/** Opening a lesson introduces the skill without proving anything. */
export function markLessonSeen(prev: SkillState, at: number): SkillState {
  if (prev.lessonSeen) return prev;
  const state: SkillState = { ...prev, lessonSeen: true, firstSeenAt: prev.firstSeenAt ?? at };
  state.level = levelOf(state, prev.level);
  if (state.level !== prev.level) state.levelAt = at;
  return state;
}

/**
 * Credit a skill that was implicitly practised by a harder problem. Returns the new state
 * and whether a free review was granted.
 */
export function applyImplicitCredit(
  prev: SkillState,
  weight: number,
  at: number,
): { state: SkillState; reviewed: boolean } {
  if (prev.card === null || prev.card.lastReview === null) return { state: prev, reviewed: false };
  const credit = prev.implicitCredit + weight;
  const dueSoon = prev.card.due - at <= RETENTION.IMPLICIT_DUE_WITHIN_DAYS * DAY_MS;
  if (credit >= RETENTION.IMPLICIT_THRESHOLD && dueSoon) {
    return {
      state: {
        ...prev,
        implicitCredit: 0,
        card: reviewCard(prev.card, 'good', at),
        lastPracticedAt: prev.lastPracticedAt,
      },
      reviewed: true,
    };
  }
  return { state: { ...prev, implicitCredit: Math.min(credit, 3) }, reviewed: false };
}

/** A failure traced to a prerequisite makes that prerequisite due now. */
export function markDueNow(prev: SkillState, at: number): SkillState {
  if (prev.card === null) return prev;
  return { ...prev, card: { ...prev.card, due: Math.min(prev.card.due, at) } };
}

// ------------------------------------------------------------------------------ levels

const recentCredit = (state: SkillState): number => {
  const window = state.recent.slice(-GATES.RECENT_WINDOW);
  return window.length === 0 ? 0 : window.reduce((sum, q) => sum + q, 0) / window.length;
};

const hasRecentGap = (state: SkillState): boolean =>
  state.recentFamilies.some((family) => family === 'procedure' || family === 'concept');

export type GateKey = 'attempts' | 'ability' | 'recent' | 'mixed' | 'delay' | 'hard' | 'variety' | 'clean';

export interface GateStatus {
  key: GateKey;
  done: boolean;
  /** Current value, where the gate is a count or a measure. */
  have: number;
  need: number;
  /** For the "hard" gate: the problem level that has to be solved unaided. */
  level?: number;
}

/** The evidence required for a given level, with the learner's current standing. */
export function gatesFor(
  state: SkillState,
  level: MasteryLevel,
  held: MasteryLevel = state.level,
  ceiling?: number,
): GateStatus[] {
  const relax = held >= level ? GATES.HYSTERESIS : 0;
  const gate = (key: GateKey, have: number, need: number): GateStatus => ({ key, done: have >= need, have, need });
  const hard = (have: number, wanted: number): GateStatus => ({
    ...gate('hard', have, 1),
    level: hardLevelFor(wanted, ceiling),
  });
  // As many families as asked for, or as the skill has. Where the number of families is
  // not known (0), nothing is asked: the gate is for content that offers a choice.
  const variety = (wanted: number): GateStatus =>
    gate('variety', state.families.length, Math.min(wanted, state.familyCap));
  switch (level) {
    case 0:
      return [];
    case 1:
      return [gate('attempts', state.attempts + (state.lessonSeen ? 1 : 0), 1)];
    case 2:
      return [gate('attempts', state.attempts, GATES.PRACTISING_ATTEMPTS)];
    case 3:
      return [
        gate('attempts', state.attempts, GATES.FAMILIAR_ATTEMPTS),
        gate('ability', round2(state.theta), round2(GATES.FAMILIAR_THETA - relax)),
        gate('recent', round2(recentCredit(state)), round2(GATES.FAMILIAR_RECENT_CREDIT - (relax > 0 ? 0.2 : 0))),
      ];
    case 4:
      return [
        gate('ability', round2(state.theta), round2(GATES.PROFICIENT_THETA - relax)),
        gate('mixed', state.mixedUnaided, GATES.PROFICIENT_MIXED),
        gate('delay', state.delayedShort, 1),
        hard(state.hardCore, GATES.PROFICIENT_HARD_LEVEL),
        variety(GATES.PROFICIENT_FAMILIES),
      ];
    case 5:
      return [
        gate('ability', round2(state.theta), round2(GATES.MASTERED_THETA - relax)),
        gate('mixed', state.mixedUnaided, GATES.MASTERED_MIXED),
        gate('delay', state.delayedLong, 1),
        hard(state.hardTop, GATES.MASTERED_HARD_LEVEL),
        variety(GATES.MASTERED_FAMILIES),
        { key: 'clean', done: !hasRecentGap(state), have: hasRecentGap(state) ? 0 : 1, need: 1 },
      ];
  }
}

const round2 = (value: number): number => Math.round(value * 100) / 100;

/** The highest level whose gates — and all lower levels' gates — are satisfied. */
export function levelOf(state: SkillState, held: MasteryLevel = state.level): MasteryLevel {
  let level: MasteryLevel = 0;
  for (const candidate of [1, 2, 3, 4, 5] as const) {
    if (gatesFor(state, candidate, held).every((g) => g.done)) level = candidate;
    else break;
  }
  return level;
}

/** What is still missing for the next level; null when mastered. */
export function nextLevelGates(
  state: SkillState,
  ceiling?: number,
): { level: MasteryLevel; gates: GateStatus[] } | null {
  if (state.level >= 5) return null;
  const next = (state.level + 1) as MasteryLevel;
  return { level: next, gates: gatesFor(state, next, state.level, ceiling) };
}

/** Is the skill predicted to have faded since it was last practised? */
export function isFading(state: SkillState, now: number): boolean {
  const r = retrievability(state.card, now);
  return r !== null && r < RETENTION.FADING_BELOW && state.level >= 2;
}

/** A 0–1 summary of a skill for progress bars: level plus progress towards the next. */
export function progressOf(state: SkillState): number {
  if (state.level >= 5) return 1;
  const next = nextLevelGates(state);
  if (!next || next.gates.length === 0) return state.level / 5;
  const partial =
    next.gates.reduce((sum, g) => {
      if (g.done) return sum + 1;
      if (g.key === 'ability') return sum + Math.max(0, Math.min(1, (g.have + 1) / (g.need + 1)));
      return sum + Math.max(0, Math.min(1, g.need === 0 ? 1 : g.have / g.need));
    }, 0) / next.gates.length;
  return (state.level + Math.min(0.95, partial)) / 5;
}

// --------------------------------------------------------------------------- uncertainty

/**
 * How unsure the ability estimate is, on the ability scale. Large with little evidence,
 * and kept large while the evidence comes from one problem family or one day only.
 * A heuristic: see UNCERTAINTY.
 */
export function uncertaintyOf(state: SkillState): number {
  let evidence = state.attempts;
  if (state.familyCap > 1 && state.families.length <= 1) evidence *= UNCERTAINTY.ONE_FAMILY;
  if (state.days <= 1) evidence *= UNCERTAINTY.ONE_DAY;
  return Math.max(UNCERTAINTY.MIN, UNCERTAINTY.MAX / Math.sqrt(1 + evidence));
}

export type EstimateConfidence = 'none' | 'low' | 'medium' | 'high';

/** The same in words the interface can show: how much the estimate can be relied on. */
export function confidenceOf(state: SkillState | undefined): EstimateConfidence {
  if (!state || (state.attempts === 0 && state.placement === null)) return 'none';
  const oneFamily = state.familyCap > 1 && state.families.length < 2;
  if (state.attempts < UNCERTAINTY.LOW_ATTEMPTS || state.days < 2 || oneFamily) return 'low';
  if (state.attempts >= UNCERTAINTY.HIGH_ATTEMPTS && state.days >= UNCERTAINTY.HIGH_DAYS && state.delayedShort >= 1)
    return 'high';
  return 'medium';
}

/**
 * A stored state brought up to the current shape. States are rebuilt from the log when the
 * model changes, so this only matters for objects built by hand (tests, fixtures).
 */
export function withDefaults(state: Partial<SkillState> & { skill: string }): SkillState {
  return { ...emptySkillState(state.skill), ...state };
}

// --------------------------------------------------------------------- error inference

export interface ErrorInference {
  type: ErrorType;
  family: ErrorFamily;
  /** How the guess was made, most trustworthy first. */
  basis: 'misconception' | 'pattern' | 'timing' | 'model';
  /** Whether the learner should take it as likely or merely as a starting suggestion. */
  confident: boolean;
}

/**
 * Guess what kind of error a wrong answer was, combining what the answer looked like
 * (diagnosis), how fast it came, and how likely a correct answer had been.
 */
export function inferError(input: {
  diagnosis?: Diagnosis;
  predicted: number;
  seconds: number;
  expectedSeconds: number;
  timed?: boolean;
}): ErrorInference {
  const { diagnosis, predicted, seconds, expectedSeconds } = input;
  if (diagnosis?.strong) {
    return {
      type: diagnosis.error,
      family: ERROR_FAMILY[diagnosis.error],
      basis: diagnosis.source === 'misconception' ? 'misconception' : 'pattern',
      confident: true,
    };
  }
  const ratio = expectedSeconds > 0 ? seconds / expectedSeconds : 1;
  if (ratio < SLIP.RUSHED_RATIO && predicted >= 0.5) {
    return { type: 'rushed', family: 'slip', basis: 'timing', confident: false };
  }
  if (diagnosis) {
    return { type: diagnosis.error, family: ERROR_FAMILY[diagnosis.error], basis: 'pattern', confident: false };
  }
  if (predicted >= SLIP.LIKELY_SLIP_P) return { type: 'arithmetic', family: 'slip', basis: 'model', confident: false };
  if (predicted <= SLIP.LIKELY_GAP_P) return { type: 'concept', family: 'concept', basis: 'model', confident: false };
  return { type: 'algebra', family: 'procedure', basis: 'model', confident: false };
}
