import { READINESS } from './constants';
import type { MasteryLevel } from './mastery';

/**
 * Readiness for an examination, as several statements instead of one number.
 *
 * Each part says what it measures, what it found, and how much evidence that rests on.
 * A part without enough evidence has no value — the interface then says "not enough data"
 * instead of showing a figure. Nothing here is a probability of being admitted: each
 * school sets its own threshold, and the model has not been calibrated against results.
 * See docs/learning-model.md §15.
 */

export interface ReadinessSkill {
  id: string;
  role: 'tested' | 'prerequisite' | 'enrichment';
  /** Share of the examination's points. */
  weight: number;
  /** Cannot be practised on a screen. */
  paperOnly: boolean;
  level: MasteryLevel;
  /** Problems resolved outside a diagnostic. */
  practised: number;
  /** Any evidence at all, a diagnostic included. */
  attempts: number;
  reviews: { passed: number; failed: number };
  /**
   * The skill is in the way of what builds on it: below "familiar", not made likely by a
   * diagnostic, and without a promising start (priority.ts, holdsBack).
   */
  inTheWay: boolean;
  /** Skills that build on this one (ids), for naming what a gap holds up. */
  holdsUp: readonly string[];
}

export interface MockResult {
  finishedAt: number;
  points: number;
  /** What could be earned on a screen. */
  maxPoints: number;
  /** What the real test is out of. */
  examPoints: number;
  minutesUsed: number;
  minutesAllowed: number;
}

export interface ReadinessInput {
  skills: readonly ReadinessSkill[];
  mocks: readonly MockResult[];
  /** First-try results on hard problems (level 4 and above) and in timed tests. */
  hard: { attempts: number; unaided: number };
}

/** One measured part: null value = not enough evidence to say. */
export interface ReadinessPart {
  value: number | null;
  /** How much stands behind the value, in the unit named by the part. */
  evidence: number;
  /** How much would be enough. */
  needed: number;
}

export type ReadinessVerdict = 'no-data' | 'building' | 'practising' | 'test-ready';

export interface Readiness {
  verdict: ReadinessVerdict;
  /** Share of the testable weight on skills practised at least a few times. Evidence: skills. */
  coverage: ReadinessPart;
  /** Share of the testable weight at "proficient" or better. Evidence: covered share. */
  mastery: ReadinessPart;
  /** The same at "familiar" or better. */
  familiar: ReadinessPart;
  /** Scheduled reviews passed. Evidence: reviews. */
  retention: ReadinessPart;
  /** Share of the available points in the last timed test. Evidence: tests. */
  timed: ReadinessPart & { last: MockResult | null; best: MockResult | null; count: number };
  /** Hard and timed problems solved unaided at the first try. Evidence: attempts. */
  unfamiliar: ReadinessPart;
  /** Skills with evidence of trouble — tried, and in the way — heaviest first with what waits behind them. */
  gaps: { id: string; weight: number; holdsUp: string[] }[];
  /** Share of the examination that cannot be practised here (constructions). */
  paperOnlyWeight: number;
  /** Tested skills not practised at all, heaviest first. */
  untouched: string[];
}

const part = (value: number, evidence: number, needed: number): ReadinessPart => ({
  value: evidence >= needed ? value : null,
  evidence,
  needed,
});

export function readiness(input: ReadinessInput): Readiness {
  const tested = input.skills.filter((skill) => skill.role === 'tested');
  const onScreen = tested.filter((skill) => !skill.paperOnly);
  const total = onScreen.reduce((sum, skill) => sum + skill.weight, 0) || 1;
  const share = (list: readonly ReadinessSkill[]): number => list.reduce((sum, skill) => sum + skill.weight, 0) / total;

  const covered = onScreen.filter((skill) => skill.practised >= READINESS.COVERED_ATTEMPTS);
  const withEvidence = input.skills.filter((skill) => skill.attempts > 0).length;
  const coverageValue = share(covered);
  const coverage = part(coverageValue, withEvidence, READINESS.NO_DATA_BELOW_SKILLS);

  const mastery = part(
    share(onScreen.filter((skill) => skill.level >= 4)),
    coverageValue,
    READINESS.MASTERY_NEEDS_COVERAGE,
  );
  const familiar = part(
    share(onScreen.filter((skill) => skill.level >= 3)),
    coverageValue,
    READINESS.MASTERY_NEEDS_COVERAGE,
  );

  const passed = input.skills.reduce((sum, skill) => sum + skill.reviews.passed, 0);
  const failed = input.skills.reduce((sum, skill) => sum + skill.reviews.failed, 0);
  const retention = part(
    passed + failed === 0 ? 0 : passed / (passed + failed),
    passed + failed,
    READINESS.RETENTION_MIN_REVIEWS,
  );

  const mocks = [...input.mocks].sort((a, b) => a.finishedAt - b.finishedAt);
  const last = mocks[mocks.length - 1] ?? null;
  const best = mocks.reduce<MockResult | null>(
    (top, mock) => (top === null || mock.points / mock.maxPoints > top.points / top.maxPoints ? mock : top),
    null,
  );
  const timed = { ...part(last ? last.points / last.maxPoints : 0, mocks.length, 1), last, best, count: mocks.length };

  const unfamiliar = part(
    input.hard.attempts === 0 ? 0 : input.hard.unaided / input.hard.attempts,
    input.hard.attempts,
    READINESS.UNFAMILIAR_MIN_ATTEMPTS,
  );

  const weightOf = new Map(input.skills.map((skill) => [skill.id, skill.weight]));
  const gaps = input.skills
    .filter((skill) => !skill.paperOnly && skill.role !== 'enrichment' && skill.inTheWay && skill.attempts > 0)
    .map((skill) => ({
      id: skill.id,
      weight: skill.weight + skill.holdsUp.reduce((sum, id) => sum + (weightOf.get(id) ?? 0), 0),
      holdsUp: [...skill.holdsUp],
    }))
    .sort((a, b) => b.weight - a.weight || a.id.localeCompare(b.id))
    .slice(0, 6);

  let verdict: ReadinessVerdict;
  if (withEvidence < READINESS.NO_DATA_BELOW_SKILLS) verdict = 'no-data';
  else if (coverageValue < READINESS.BUILDING_BELOW) verdict = 'building';
  else if (coverageValue >= READINESS.TEST_READY_COVERAGE && (familiar.value ?? 0) >= READINESS.TEST_READY_FAMILIAR)
    verdict = 'test-ready';
  else verdict = 'practising';

  return {
    verdict,
    coverage,
    mastery,
    familiar,
    retention,
    timed,
    unfamiliar,
    gaps,
    paperOnlyWeight: tested.filter((skill) => skill.paperOnly).reduce((sum, skill) => sum + skill.weight, 0),
    untouched: onScreen
      .filter((skill) => skill.practised === 0)
      .sort((a, b) => b.weight - a.weight)
      .map((skill) => skill.id),
  };
}
