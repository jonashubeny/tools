import { describe, expect, it } from 'vitest';
import type { Level } from '../src/content/types';
import { dayScore, heatLevel, pointsForProblem, scoresByDay, type ActivityRecord } from '../src/learning/activity';
import { DAY_MS, GATES, STREAK } from '../src/learning/constants';
import { examReport, gradeFor, levelsForMix, type ExamItemResult } from '../src/learning/exam';
import {
  applyAttempt,
  applyImplicitCredit,
  creditOf,
  emptySkillState,
  gatesFor,
  inferError,
  isFading,
  kFactor,
  levelOf,
  markLessonSeen,
  nextLevelGates,
  predictSuccess,
  priorTheta,
  progressOf,
  type PracticeContext,
  type ResolvedAttempt,
  type SkillState,
} from '../src/learning/mastery';
import { isDue, newCard, ratingFor, retrievability, reviewCard } from '../src/learning/scheduler';
import { chooseCandidate, chooseLevel } from '../src/learning/select';
import { composePlan, type PlanInput, type PlanSkill } from '../src/learning/session';
import { computeStreak } from '../src/learning/streak';
import { createRng } from '../src/rng';
import { addDays, daysBetween, studyDay, weekStart, weekdayIndex } from '../src/time';

const T0 = Date.UTC(2026, 9, 7, 10, 0, 0);

function attempt(overrides: Partial<ResolvedAttempt> = {}): ResolvedAttempt {
  return {
    skill: 's',
    level: 2,
    context: 'blocked',
    solved: true,
    firstTry: true,
    hints: 0,
    retries: 0,
    seconds: 60,
    expectedSeconds: 60,
    at: T0,
    ...overrides,
  };
}

/** Apply a sequence of attempts, one per step, spaced `gapMs` apart. */
function run(state: SkillState, attempts: Partial<ResolvedAttempt>[], gapMs = 60_000, start = T0): SkillState {
  let current = state;
  attempts.forEach((overrides, index) => {
    current = applyAttempt(current, attempt({ at: start + index * gapMs, ...overrides })).state;
  });
  return current;
}

describe('ability estimate', () => {
  it('predicts 50 % when ability equals difficulty', () => {
    expect(predictSuccess(0.5, 3)).toBeCloseTo(0.5, 10);
    expect(predictSuccess(2, 1)).toBeGreaterThan(0.95);
    expect(predictSuccess(-1, 5)).toBeLessThan(0.05);
  });

  it('moves a lot at first and little later', () => {
    expect(kFactor(0)).toBeGreaterThan(kFactor(10));
    expect(kFactor(10)).toBeGreaterThan(kFactor(100));
    expect(kFactor(1000)).toBeGreaterThan(0.07);
  });

  it('rises on success and falls on failure', () => {
    const up = applyAttempt(emptySkillState('s'), attempt());
    const down = applyAttempt(emptySkillState('s'), attempt({ solved: false, firstTry: false }));
    expect(up.thetaAfter).toBeGreaterThan(0);
    expect(down.thetaAfter).toBeLessThan(0);
  });

  it('gains almost nothing from easy items once ability is high', () => {
    const strong = { ...emptySkillState('s'), theta: 2, attempts: 20 };
    const easy = applyAttempt(strong, attempt({ level: 1 }));
    const hard = applyAttempt(strong, attempt({ level: 5 }));
    const easyGain = easy.thetaAfter - easy.thetaBefore;
    const hardGain = hard.thetaAfter - hard.thetaBefore;
    expect(easyGain).toBeLessThan(0.02);
    expect(hardGain).toBeGreaterThan(5 * easyGain);
  });

  it('derives a cautious prior from prerequisites', () => {
    expect(priorTheta([])).toBe(0);
    expect(priorTheta([2, 2])).toBeCloseTo(0.6, 10);
    expect(priorTheta([10])).toBe(0.8);
    expect(priorTheta([-10])).toBe(-0.5);
  });
});

describe('outcome credit', () => {
  it('rewards independence', () => {
    expect(creditOf(attempt())).toBe(1);
    expect(creditOf(attempt({ firstTry: false, retries: 1 }))).toBeCloseTo(0.6, 10);
    expect(creditOf(attempt({ firstTry: false, retries: 2 }))).toBeCloseTo(0.45, 10);
    expect(creditOf(attempt({ hints: 1 }))).toBeCloseTo(0.8, 10);
    expect(creditOf(attempt({ hints: 2 }))).toBeCloseTo(0.6, 10);
    expect(creditOf(attempt({ hints: 9 }))).toBeCloseTo(0.2, 10);
    expect(creditOf(attempt({ solved: false, firstTry: false, hints: 3 }))).toBe(0);
  });
});

describe('mastery levels', () => {
  it('starts new and becomes introduced by opening the lesson', () => {
    const fresh = emptySkillState('s');
    expect(fresh.level).toBe(0);
    expect(markLessonSeen(fresh, T0).level).toBe(1);
  });

  it('ten easy correct answers do not produce mastery — nor proficiency', () => {
    const state = run(
      emptySkillState('s'),
      Array.from({ length: 10 }, () => ({ level: 1 as Level })),
    );
    expect(state.attempts).toBe(10);
    expect(state.unaided).toBe(10);
    expect(state.level).toBeLessThanOrEqual(3);
    expect(state.mixedUnaided).toBe(0);
    expect(state.hardCore).toBe(0);
  });

  it('even thirty blocked level-3 successes in one sitting stop at familiar', () => {
    const state = run(
      emptySkillState('s'),
      Array.from({ length: 30 }, () => ({ level: 3 as Level })),
    );
    expect(state.theta).toBeGreaterThan(GATES.PROFICIENT_THETA);
    expect(state.level).toBe(3);
    const missing = nextLevelGates(state)!
      .gates.filter((g) => !g.done)
      .map((g) => g.key);
    expect(missing).toEqual(['mixed', 'delay']);
  });

  it('reaches proficient with mixed-context and delayed evidence', () => {
    let state = run(
      emptySkillState('s'),
      Array.from({ length: 8 }, () => ({ level: 3 as Level })),
    );
    expect(state.level).toBe(3);
    // three days later, twice, with the topic hidden
    state = run(state, [{ level: 3, context: 'mixed' }], 0, T0 + 3 * DAY_MS);
    state = run(state, [{ level: 3, context: 'mixed' }], 0, T0 + 6 * DAY_MS);
    expect(state.mixedUnaided).toBe(2);
    expect(state.delayedShort).toBeGreaterThanOrEqual(1);
    expect(state.level).toBe(4);
  });

  it('needs hard problems, a week-long gap and clean recent work for mastered', () => {
    let state = run(
      emptySkillState('s'),
      Array.from({ length: 8 }, () => ({ level: 3 as Level })),
    );
    state = run(state, [{ level: 3, context: 'mixed' }], 0, T0 + 3 * DAY_MS);
    state = run(state, [{ level: 4, context: 'mixed' }], 0, T0 + 6 * DAY_MS);
    state = run(state, [{ level: 4, context: 'mixed' }], 0, T0 + 14 * DAY_MS);
    state = run(
      state,
      Array.from({ length: 6 }, () => ({ level: 5 as Level, context: 'mixed' as PracticeContext })),
      DAY_MS,
      T0 + 15 * DAY_MS,
    );
    expect(state.delayedLong).toBeGreaterThanOrEqual(1);
    expect(state.hardTop).toBeGreaterThanOrEqual(1);
    expect(state.level).toBe(5);
    expect(nextLevelGates(state)).toBeNull();
    expect(progressOf(state)).toBe(1);
  });

  it('judges "hard" against the hardest problems a skill actually has', () => {
    // A skill whose problems stop at level 3: weeks of unaided, mixed, delayed work.
    const work = (ceiling: Level | undefined): SkillState => {
      let state = run(
        emptySkillState('s'),
        Array.from({ length: 8 }, () => ({ level: 3 as Level, ceiling })),
      );
      for (let week = 1; week <= 40; week++)
        state = run(state, [{ level: 3, context: 'mixed', ceiling }], 0, T0 + week * 8 * DAY_MS);
      return state;
    };
    // Without knowing the ceiling, the level-4 gate can never be met…
    const barred = work(undefined);
    expect(barred.theta).toBeGreaterThan(GATES.MASTERED_THETA);
    expect(barred.hardTop).toBe(0);
    expect(barred.level).toBe(4);
    expect(
      nextLevelGates(barred)!
        .gates.filter((g) => !g.done)
        .map((g) => g.key),
    ).toEqual(['hard']);
    // …with it, level 3 is the hard evidence there is, and it counts.
    const reached = work(3);
    expect(reached.hardTop).toBeGreaterThan(0);
    expect(reached.level).toBe(5);
    // A skill that does have level-4 problems is still held to them.
    expect(work(4).level).toBe(4);
    expect(work(5).level).toBe(4);

    // The gate says which level it asks for.
    const fresh = run(
      emptySkillState('s'),
      Array.from({ length: 8 }, () => ({ level: 2 as Level })),
    );
    const hardOf = (ceiling?: number) => gatesFor(fresh, 5, fresh.level, ceiling).find((g) => g.key === 'hard')!.level;
    expect(hardOf()).toBe(4);
    expect(hardOf(3)).toBe(3);
    expect(hardOf(5)).toBe(4);
    expect(gatesFor(fresh, 4, fresh.level, 2).find((g) => g.key === 'hard')!.level).toBe(2);
  });

  it('a recent conceptual error blocks mastered', () => {
    const base: SkillState = {
      ...emptySkillState('s'),
      attempts: 20,
      theta: 2.5,
      recent: [1, 1, 1, 1, 1],
      mixedUnaided: 5,
      delayedShort: 2,
      delayedLong: 2,
      hardCore: 4,
      hardTop: 2,
      level: 4,
    };
    expect(levelOf({ ...base, recentFamilies: [null, null, null, null, null] })).toBe(5);
    expect(levelOf({ ...base, recentFamilies: [null, 'concept', null, null, null] })).toBe(4);
    expect(levelOf({ ...base, recentFamilies: [null, 'slip', null, null, null] })).toBe(5);
  });

  it('hints and retries do not count as unaided evidence', () => {
    const state = run(emptySkillState('s'), [
      { level: 3, context: 'mixed', hints: 1 },
      { level: 3, context: 'mixed', firstTry: false, retries: 1 },
      { level: 3, context: 'mixed', selfAssessed: true },
    ]);
    expect(state.mixedUnaided).toBe(0);
    expect(state.unaided).toBe(0);
    expect(state.solved).toBe(3);
  });

  it('a held level survives a small dip but not a collapse', () => {
    const familiar: SkillState = {
      ...emptySkillState('s'),
      attempts: 12,
      theta: GATES.FAMILIAR_THETA - 0.1,
      recent: [1, 1, 0.6, 0, 0.6],
      level: 3,
    };
    expect(levelOf(familiar, 3)).toBe(3);
    expect(levelOf(familiar, 2)).toBe(2);
    expect(levelOf({ ...familiar, theta: -1 }, 3)).toBe(2);
  });

  it('explains what is missing for the next level', () => {
    const state = run(emptySkillState('s'), [{}, {}]);
    const next = nextLevelGates(state)!;
    expect(next.level).toBe(2);
    expect(next.gates).toEqual([{ key: 'attempts', done: false, have: 2, need: GATES.PRACTISING_ATTEMPTS }]);
    expect(gatesFor(state, 4).map((g) => g.key)).toEqual(['ability', 'mixed', 'delay', 'hard']);
  });

  it('progress grows monotonically with level', () => {
    const levels = [0, 1, 2, 3, 4, 5] as const;
    const values = levels.map((level) => progressOf({ ...emptySkillState('s'), level, attempts: level * 3 }));
    for (let i = 1; i < values.length; i++) expect(values[i]!).toBeGreaterThanOrEqual(values[i - 1]!);
  });

  it('records errors, speed and calibration', () => {
    const state = run(emptySkillState('s'), [
      { solved: false, firstTry: false, errorType: 'sign', confidence: 'sure' },
      { seconds: 30, expectedSeconds: 60, confidence: 'sure' },
      { confidence: 'guess' },
    ]);
    expect(state.errors.sign).toBe(1);
    expect(state.recentFamilies).toEqual(['slip', null, null]);
    expect(state.calibration).toEqual({ sureRight: 1, sureWrong: 1, unsureRight: 1, unsureWrong: 0 });
    expect(state.speed).toBeGreaterThan(0.4);
    expect(state.speed).toBeLessThan(1);
  });
});

describe('review schedule', () => {
  it('creates a card on first practice and schedules days ahead', () => {
    const effect = applyAttempt(emptySkillState('s'), attempt());
    expect(effect.reviewed).toBe(true);
    const card = effect.state.card!;
    expect(card.due - T0).toBeGreaterThan(DAY_MS / 2);
    expect(isDue(card, T0)).toBe(false);
    expect(isDue(card, card.due + 1)).toBe(true);
  });

  it('ignores repeated blocked practice within a day', () => {
    const first = applyAttempt(emptySkillState('s'), attempt()).state;
    const second = applyAttempt(first, attempt({ at: T0 + 5 * 60_000 }));
    expect(second.reviewed).toBe(false);
    expect(second.state.card).toEqual(first.card);
  });

  it('updates on mixed practice and after a gap, with growing intervals', () => {
    let state = applyAttempt(emptySkillState('s'), attempt()).state;
    const intervals: number[] = [];
    for (let i = 0; i < 4; i++) {
      const at = state.card!.due;
      const effect = applyAttempt(state, attempt({ at, context: 'mixed' }));
      expect(effect.reviewed).toBe(true);
      expect(effect.reviewPassed).toBe(true);
      state = effect.state;
      intervals.push(state.card!.due - at);
    }
    for (let i = 1; i < intervals.length; i++) expect(intervals[i]!).toBeGreaterThan(intervals[i - 1]!);
  });

  it('a failed review shortens the interval', () => {
    let state = applyAttempt(emptySkillState('s'), attempt()).state;
    state = applyAttempt(state, attempt({ at: state.card!.due, context: 'mixed' })).state;
    const good = applyAttempt(state, attempt({ at: state.card!.due, context: 'mixed' })).state;
    const failed = applyAttempt(
      state,
      attempt({ at: state.card!.due, context: 'mixed', solved: false, firstTry: false }),
    ).state;
    expect(failed.card!.due).toBeLessThan(good.card!.due);
    expect(failed.card!.lapses).toBe(1);
  });

  it('predicts falling recall over time', () => {
    const card = reviewCard(newCard(T0), 'good', T0);
    const soon = retrievability(card, T0 + DAY_MS)!;
    const later = retrievability(card, T0 + 30 * DAY_MS)!;
    expect(soon).toBeGreaterThan(later);
    expect(soon).toBeLessThanOrEqual(1);
    expect(later).toBeGreaterThan(0);
    expect(retrievability(null, T0)).toBeNull();
    expect(retrievability(newCard(T0), T0)).toBeNull();
  });

  it('flags fading skills', () => {
    const state = run(emptySkillState('s'), [{}, {}, {}]);
    expect(isFading(state, T0 + DAY_MS)).toBe(false);
    expect(isFading(state, T0 + 120 * DAY_MS)).toBe(true);
  });

  it('maps outcomes to ratings', () => {
    const base = { solved: true, unaided: true, seconds: 60, expectedSeconds: 60 };
    expect(ratingFor(base)).toBe('good');
    expect(ratingFor({ ...base, solved: false })).toBe('again');
    expect(ratingFor({ ...base, unaided: false })).toBe('hard');
    expect(ratingFor({ ...base, seconds: 200 })).toBe('hard');
    expect(ratingFor({ ...base, seconds: 20, confidence: 'sure' })).toBe('easy');
    expect(ratingFor({ ...base, seconds: 20 })).toBe('good');
  });

  it('grants a free review from implicit credit only when due soon', () => {
    let state = applyAttempt(emptySkillState('s'), attempt()).state;
    const farFromDue = applyImplicitCredit(state, 0.6, T0 + 60_000);
    expect(farFromDue.reviewed).toBe(false);
    expect(farFromDue.state.implicitCredit).toBeCloseTo(0.6, 10);

    const nearDue = state.card!.due - DAY_MS;
    state = applyImplicitCredit(state, 0.6, nearDue).state;
    const second = applyImplicitCredit(state, 0.6, nearDue);
    expect(second.reviewed).toBe(true);
    expect(second.state.implicitCredit).toBe(0);
    expect(second.state.card!.due).toBeGreaterThan(state.card!.due);
  });

  it('does nothing for a skill that was never practised', () => {
    const fresh = emptySkillState('s');
    expect(applyImplicitCredit(fresh, 5, T0)).toEqual({ state: fresh, reviewed: false });
  });
});

describe('error inference', () => {
  const timing = { seconds: 60, expectedSeconds: 60 };

  it('trusts a matching misconception', () => {
    const result = inferError({
      diagnosis: { error: 'domain', source: 'misconception', strong: true },
      predicted: 0.2,
      ...timing,
    });
    expect(result).toMatchObject({ type: 'domain', family: 'procedure', basis: 'misconception', confident: true });
  });

  it('calls a very fast wrong answer rushed', () => {
    expect(inferError({ predicted: 0.8, seconds: 10, expectedSeconds: 60 })).toMatchObject({
      type: 'rushed',
      basis: 'timing',
    });
  });

  it('falls back on the model: strong skill → slip, weak skill → gap', () => {
    expect(inferError({ predicted: 0.9, ...timing }).family).toBe('slip');
    expect(inferError({ predicted: 0.2, ...timing }).family).toBe('concept');
    expect(inferError({ predicted: 0.6, ...timing }).family).toBe('procedure');
  });

  it('uses a weak pattern as a suggestion', () => {
    const result = inferError({
      diagnosis: { error: 'arithmetic', source: 'heuristic', strong: false },
      predicted: 0.3,
      ...timing,
    });
    expect(result).toMatchObject({ type: 'arithmetic', confident: false });
  });
});

describe('problem selection', () => {
  const all: Level[] = [1, 2, 3, 4, 5];

  it('starts new skills at the lowest level', () => {
    expect(chooseLevel({ theta: 3, attempts: 0, available: all })).toBe(1);
    expect(chooseLevel({ theta: 0, attempts: 0, available: [2, 3] })).toBe(2);
  });

  it('keeps novices at level 2 or below', () => {
    expect(chooseLevel({ theta: 4, attempts: 2, available: all })).toBeLessThanOrEqual(2);
  });

  it('rises with ability', () => {
    const levels = [-1, 0.6, 1.6, 2.6, 3.6].map((theta) => chooseLevel({ theta, attempts: 10, available: all }));
    expect(levels).toEqual([1, 2, 3, 4, 5]);
  });

  it('targets roughly 75 % predicted success', () => {
    for (const theta of [0.6, 1.6, 2.6]) {
      const level = chooseLevel({ theta, attempts: 10, available: all });
      const p = predictSuccess(theta, level);
      expect(p).toBeGreaterThan(0.6);
      expect(p).toBeLessThan(0.9);
    }
  });

  it('steps down after a failure and up after two unaided successes', () => {
    const base = { theta: 1.6, attempts: 10, available: all };
    expect(chooseLevel(base)).toBe(3);
    expect(chooseLevel({ ...base, lastFailed: true })).toBe(2);
    expect(chooseLevel({ ...base, unaidedStreak: 2 })).toBe(4);
  });

  it('respects caps and floors', () => {
    expect(chooseLevel({ theta: 3, attempts: 10, available: all, cap: 2 })).toBe(2);
    expect(chooseLevel({ theta: -2, attempts: 10, available: all, floor: 4 })).toBe(4);
    expect(chooseLevel({ theta: 0, attempts: 0, available: all, floor: 4 })).toBe(4);
  });

  it('avoids repeating the same problem family', () => {
    const candidates = [
      { id: 'a', kind: 'core' as const, levels: [2] as Level[] },
      { id: 'b', kind: 'core' as const, levels: [2] as Level[] },
      { id: 'c', kind: 'core' as const, levels: [3] as Level[] },
    ];
    const rng = createRng(1);
    let b = 0;
    for (let i = 0; i < 200; i++) if (chooseCandidate(candidates, 2, ['a'], rng)!.id === 'b') b++;
    expect(b).toBeGreaterThan(160);
    expect(chooseCandidate(candidates, 5, [], rng)).toBeNull();
  });
});

describe('activity score', () => {
  it('rewards independent and harder work', () => {
    const base = { solved: true, unaided: true, level: 3 as Level, corrected: false, reviewPassed: false };
    expect(pointsForProblem(base)).toBe(5);
    expect(pointsForProblem({ ...base, unaided: false })).toBe(2);
    expect(pointsForProblem({ ...base, level: 5 })).toBe(7);
    expect(pointsForProblem({ ...base, unaided: false, corrected: true })).toBe(4);
    expect(pointsForProblem({ ...base, reviewPassed: true })).toBe(6);
    expect(pointsForProblem({ ...base, solved: false })).toBe(0);
    // An honest attempt that failed still shows up; giving up without trying does not.
    expect(pointsForProblem({ ...base, solved: false, attempted: true })).toBe(1);
  });

  it('caps easy problems per day so the heatmap cannot be farmed', () => {
    const records: ActivityRecord[] = Array.from({ length: 40 }, (_, i) => ({
      type: 'problem',
      day: '2026-10-07',
      at: T0 + i,
      points: 3,
      level: 1,
    }));
    expect(dayScore(records)).toBe(30);
    expect(dayScore(records.map((r) => ({ ...r, level: 3 as Level })))).toBe(120);
  });

  it('counts each Lab tool once per day', () => {
    const lab = (tool: string, at: number): ActivityRecord => ({ type: 'lab', day: '2026-10-07', at, points: 3, tool });
    expect(dayScore([lab('quadratic', 1), lab('quadratic', 2), lab('unitcircle', 3)])).toBe(6);
  });

  it('aggregates by study day and maps to heat levels', () => {
    const scores = scoresByDay([
      { type: 'lesson_done', day: '2026-10-06', at: 1, points: 4 },
      { type: 'problem', day: '2026-10-07', at: 2, points: 5, level: 3 },
      { type: 'problem', day: '2026-10-07', at: 3, points: 5, level: 3 },
    ]);
    expect(scores.get('2026-10-06')).toBe(4);
    expect(scores.get('2026-10-07')).toBe(10);
    expect([0, 1, 11, 12, 29, 30, 59, 60, 500].map(heatLevel)).toEqual([0, 1, 1, 2, 2, 3, 3, 4, 4]);
  });
});

describe('streak and consistency', () => {
  const ACTIVE = STREAK.ACTIVE_THRESHOLD;
  const scores = (days: Record<string, number>): Map<string, number> => new Map(Object.entries(days));
  const activeRun = (from: string, count: number): Record<string, number> =>
    Object.fromEntries(Array.from({ length: count }, (_, i) => [addDays(from, i), ACTIVE]));

  it('counts consecutive active days', () => {
    const summary = computeStreak({ scores: scores(activeRun('2026-10-01', 5)), today: '2026-10-05' });
    expect(summary.current).toBe(5);
    expect(summary.longest).toBe(5);
    expect(summary.activeToday).toBe(true);
  });

  it('does not break because today is not done yet', () => {
    const summary = computeStreak({ scores: scores(activeRun('2026-10-01', 5)), today: '2026-10-06' });
    expect(summary.current).toBe(5);
    expect(summary.activeToday).toBe(false);
  });

  it('ignores days below the activity threshold', () => {
    const summary = computeStreak({
      scores: scores({ '2026-10-01': ACTIVE, '2026-10-02': ACTIVE - 1, '2026-10-03': ACTIVE }),
      today: '2026-10-03',
    });
    expect(summary.current).toBe(1);
    expect(summary.totalActiveDays).toBe(2);
  });

  it('earns a rest day every six active days and spends it automatically', () => {
    const days = { ...activeRun('2026-10-01', 6), ...activeRun('2026-10-08', 2) }; // missed Oct 7
    const summary = computeStreak({ scores: scores(days), today: '2026-10-09' });
    expect(summary.current).toBe(8);
    expect(summary.restDaysUsed).toEqual(['2026-10-07']);
    expect(summary.restDays).toBe(0);
  });

  it('breaks without a banked rest day, and resets the earning counter', () => {
    const days = { ...activeRun('2026-10-01', 3), ...activeRun('2026-10-05', 2) }; // missed Oct 4
    const summary = computeStreak({ scores: scores(days), today: '2026-10-06' });
    expect(summary.current).toBe(2);
    expect(summary.longest).toBe(3);
    expect(summary.nextRestIn).toBe(4);
  });

  it('never banks more than the cap', () => {
    const summary = computeStreak({ scores: scores(activeRun('2026-08-01', 60)), today: '2026-09-29' });
    expect(summary.restDays).toBe(STREAK.REST_CAP);
    expect(summary.current).toBe(60);
    expect(summary.nextRestIn).toBe(0);
  });

  it('a declared pause neither counts nor breaks', () => {
    const days = { ...activeRun('2026-10-01', 3), ...activeRun('2026-10-11', 2) };
    const paused = computeStreak({
      scores: scores(days),
      today: '2026-10-12',
      pauses: [{ from: '2026-10-04', to: '2026-10-10' }],
    });
    expect(paused.current).toBe(5);
    expect(paused.consistency.days).toBe(28 - 7);
    const unpaused = computeStreak({ scores: scores(days), today: '2026-10-12' });
    expect(unpaused.current).toBe(2);
  });

  it('reports consistency over the last 28 days', () => {
    const days: Record<string, number> = {};
    for (let i = 0; i < 28; i += 2) days[addDays('2026-10-28', -i)] = ACTIVE;
    const summary = computeStreak({ scores: scores(days), today: '2026-10-28' });
    expect(summary.consistency).toEqual({ active: 14, days: 28 });
  });

  it('tracks weekly rhythm with room for rest', () => {
    // Mon–Thu active for three weeks; Fri–Sun off. 2026-09-14 is a Monday.
    const days: Record<string, number> = {};
    for (let week = 0; week < 3; week++) for (let d = 0; d < 4; d++) days[addDays('2026-09-14', week * 7 + d)] = ACTIVE;
    const summary = computeStreak({ scores: scores(days), today: '2026-10-04' });
    expect(summary.weekRhythm).toBe(3);
    expect(summary.current).toBe(0); // the daily streak broke, the rhythm did not
    const nextWeek = computeStreak({ scores: scores(days), today: '2026-10-06' });
    expect(nextWeek.weekRhythm).toBe(3);
    expect(nextWeek.thisWeek).toEqual({ active: 0, goal: STREAK.WEEK_GOAL });
  });

  it('handles an empty history', () => {
    const summary = computeStreak({ scores: new Map(), today: '2026-10-07' });
    expect(summary).toMatchObject({
      current: 0,
      longest: 0,
      restDays: 0,
      weekRhythm: 0,
      totalActiveDays: 0,
      lastActiveDay: null,
    });
    expect(summary.consistency).toEqual({ active: 0, days: 28 });
  });
});

describe('study days', () => {
  const prague = 'Europe/Prague';

  it('rolls over at 04:00 local time, not at midnight', () => {
    // 2026-10-08 01:30 CEST = 2026-10-07 23:30 UTC → still the study day of Oct 7
    expect(studyDay(Date.UTC(2026, 9, 7, 23, 30), prague)).toBe('2026-10-07');
    // 03:59 CEST
    expect(studyDay(Date.UTC(2026, 9, 8, 1, 59), prague)).toBe('2026-10-07');
    // 04:00 CEST
    expect(studyDay(Date.UTC(2026, 9, 8, 2, 0), prague)).toBe('2026-10-08');
  });

  it('respects the time zone and a custom rollover', () => {
    const instant = Date.UTC(2026, 0, 15, 23, 30); // 00:30 CET on Jan 16
    expect(studyDay(instant, prague, 0)).toBe('2026-01-16');
    expect(studyDay(instant, 'UTC', 0)).toBe('2026-01-15');
  });

  it('does date arithmetic across months, years and DST changes', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-10-25', 1)).toBe('2026-10-26'); // DST ends in Europe
    expect(daysBetween('2026-10-07', '2026-10-10')).toBe(3);
    expect(daysBetween('2026-10-10', '2026-10-07')).toBe(-3);
    expect(weekdayIndex('2026-10-07')).toBe(2); // Wednesday
    expect(weekStart('2026-10-07')).toBe('2026-10-05');
    expect(weekStart('2026-10-05')).toBe('2026-10-05');
    expect(weekStart('2026-10-11')).toBe('2026-10-05');
  });
});

describe('daily plan', () => {
  const skill = (id: string, overrides: Partial<PlanSkill> = {}): PlanSkill => ({
    id,
    topic: 3,
    order: 0,
    level: 0,
    theta: 0,
    attempts: 0,
    due: false,
    overdueDays: 0,
    prereqs: [],
    hasLesson: true,
    lessonDone: false,
    hasHard: true,
    ...overrides,
  });
  const input = (overrides: Partial<PlanInput> = {}): PlanInput => ({
    day: '2026-10-07',
    minutes: 45,
    skills: [],
    currentTopic: 3,
    tests: [],
    errorFocus: null,
    ...overrides,
  });
  const kinds = (plan: ReturnType<typeof composePlan>) => plan.blocks.map((b) => b.kind);
  const required = (plan: ReturnType<typeof composePlan>) =>
    plan.blocks.filter((b) => !b.optional).reduce((sum, b) => sum + b.minutes, 0);

  it('starts a new topic with its lesson', () => {
    const plan = composePlan(
      input({ skills: [skill('quad.graph', { order: 1 }), skill('quad.vertex', { order: 2 })] }),
    );
    expect(plan.blocks[0]).toMatchObject({ kind: 'lesson', skills: ['quad.graph'], reason: { code: 'lesson-next' } });
    expect(plan.focusTopic).toBe(3);
  });

  it('puts due reviews first and caps them at about a quarter of the time', () => {
    const due = Array.from({ length: 12 }, (_, i) =>
      skill(`old${i}`, { topic: 1, level: 3, attempts: 8, due: true, overdueDays: i }),
    );
    const plan = composePlan(input({ skills: [...due, skill('quad.graph')] }));
    expect(plan.blocks[0]!.kind).toBe('review');
    expect(plan.blocks[0]!.minutes).toBeLessThanOrEqual(12);
    expect(plan.blocks[0]!.skills[0]).toBe('old11'); // most overdue first
    expect(plan.blocks[0]!.reason.data.count).toBe(12);
  });

  it('practises the weakest skill once lessons are done', () => {
    const plan = composePlan(
      input({
        skills: [
          skill('a', { level: 3, theta: 1, attempts: 9, lessonDone: true }),
          skill('b', { level: 2, theta: 0.1, attempts: 4, lessonDone: true }),
        ],
      }),
    );
    expect(plan.blocks.find((b) => b.kind === 'practice')).toMatchObject({
      skills: ['b'],
      reason: { code: 'practice-weakest' },
    });
  });

  it('notices a weak prerequisite and schedules it first', () => {
    const plan = composePlan(
      input({
        skills: [
          skill('quad.equation', { topic: null, level: 1, attempts: 1, lessonDone: true }),
          skill('quad.vertex', { prereqs: ['quad.equation'] }),
        ],
      }),
    );
    expect(kinds(plan).slice(0, 2)).toEqual(['prereq', 'lesson']);
    expect(plan.blocks[0]).toMatchObject({
      skills: ['quad.equation'],
      reason: { code: 'prereq-weak', data: { skill: 'quad.vertex' } },
    });
  });

  it('adds a challenge only when there is time and a skill ready for it', () => {
    const ready = [skill('a', { level: 3, theta: 1.2, attempts: 9, lessonDone: true })];
    expect(kinds(composePlan(input({ skills: ready, minutes: 45 })))).toContain('challenge');
    expect(kinds(composePlan(input({ skills: ready, minutes: 15 })))).not.toContain('challenge');
    const notReady = [skill('a', { level: 2, attempts: 4, lessonDone: true })];
    expect(kinds(composePlan(input({ skills: notReady, minutes: 45 })))).not.toContain('challenge');
  });

  it('adds an error drill when a pattern is visible', () => {
    const plan = composePlan(input({ skills: [skill('a')], errorFocus: { type: 'sign', count: 5 } }));
    expect(plan.blocks.find((b) => b.kind === 'drill')).toMatchObject({
      errorType: 'sign',
      reason: { code: 'drill-pattern' },
    });
  });

  it('gives a useful 15-minute session', () => {
    const due = [skill('old', { topic: 1, level: 3, attempts: 8, due: true, overdueDays: 2 })];
    const plan = composePlan(
      input({ minutes: 15, skills: [...due, skill('quad.graph')], errorFocus: { type: 'sign', count: 5 } }),
    );
    expect(kinds(plan)).toEqual(['review', 'lesson']);
    expect(required(plan)).toBeLessThanOrEqual(16);
    expect(plan.blocks.find((b) => b.kind === 'lesson')!.minutes).toBeGreaterThanOrEqual(8);
  });

  it('keeps required blocks within the budget for any duration', () => {
    const skills = [
      skill('old', { topic: 1, level: 3, attempts: 8, due: true, overdueDays: 2 }),
      skill('a', { level: 3, theta: 1.2, attempts: 9, lessonDone: true, lab: 'quadratic' }),
    ];
    for (const minutes of [10, 15, 20, 30, 45, 60, 90]) {
      const plan = composePlan(input({ minutes, skills, errorFocus: { type: 'sign', count: 4 } }));
      expect(required(plan), `${minutes} min`).toBeLessThanOrEqual(minutes + 1);
      expect(plan.blocks.length).toBeGreaterThan(0);
    }
  });

  it('offers an optional experiment in long sessions', () => {
    const plan = composePlan(input({ minutes: 60, skills: [skill('a', { lab: 'quadratic' })] }));
    expect(plan.blocks.at(-1)).toMatchObject({ kind: 'experiment', optional: true, lab: 'quadratic' });
  });

  it('switches to a mock a few days before a test', () => {
    const skills = [skill('a', { level: 3, theta: 1, attempts: 9, lessonDone: true })];
    const plan = composePlan(
      input({ skills, tests: [{ day: '2026-10-09', topics: [3], title: 'Kvadratická funkce' }] }),
    );
    expect(kinds(plan)).toContain('mock');
    expect(kinds(plan)).not.toContain('challenge');
    expect(plan.test).toEqual({ day: '2026-10-09', inDays: 2, title: 'Kvadratická funkce' });
  });

  it('prepares for a test from everything it covers, not just one chapter', () => {
    const skills = [
      skill('q1', { topic: 3, level: 4, theta: 1.6, attempts: 20, lessonDone: true }),
      skill('q2', { topic: 3, level: 4, theta: 1.5, attempts: 18, lessonDone: true }),
      skill('abs', { topic: 4, level: 2, theta: 0.2, attempts: 5, lessonDone: true }),
    ];
    const plan = composePlan(input({ skills, currentTopic: 4, tests: [{ day: '2026-10-12', topics: [3, 4] }] }));
    expect(plan.blocks.find((b) => b.kind === 'practice')).toMatchObject({
      skills: ['abs'],
      reason: { code: 'practice-test', data: { skill: 'abs', inDays: 5 } },
    });
    expect(plan.focusTopic).toBe(4);

    // Everything the test covers is in hand: rehearse all of it, mixed.
    const ready = skills.map((s) => ({ ...s, level: 4 as const, theta: 1.6 }));
    const rehearsal = composePlan(
      input({ skills: ready, currentTopic: 4, tests: [{ day: '2026-10-12', topics: [3, 4] }] }),
    );
    expect(rehearsal.blocks.find((b) => b.reason.code === 'review-test')).toMatchObject({
      kind: 'review',
      skills: ['q1', 'q2', 'abs'],
    });
    expect(rehearsal.focusTopic).toBe(4);
  });

  it('focuses on the test even when the class has moved on', () => {
    const skills = [
      skill('old', { topic: 2, level: 2, attempts: 6, lessonDone: true }),
      skill('now', { topic: 3, level: 1, attempts: 1, lessonDone: true }),
    ];
    const plan = composePlan(input({ skills, currentTopic: 3, tests: [{ day: '2026-10-11', topics: [2] }] }));
    expect(plan.blocks.find((b) => b.kind === 'practice')).toMatchObject({ skills: ['old'] });
    expect(plan.focusTopic).toBe(2);
  });

  it('only consolidates the day before a test', () => {
    const skills = [skill('a', { level: 2, attempts: 4, lessonDone: true }), skill('new')];
    const plan = composePlan(
      input({ skills, tests: [{ day: '2026-10-08', topics: [3] }], errorFocus: { type: 'sign', count: 4 } }),
    );
    expect(kinds(plan)).toEqual(['drill', 'review']);
    expect(plan.blocks[1]!.reason.code).toBe('review-test');
  });

  it('ignores tests that are past or far away', () => {
    const skills = [skill('a')];
    const plan = composePlan(
      input({
        skills,
        tests: [
          { day: '2026-10-01', topics: [3] },
          { day: '2026-11-20', topics: [3] },
        ],
      }),
    );
    expect(plan.test).toBeNull();
  });

  it('falls back to the first unfinished topic when none is set', () => {
    const skills = [skill('done', { topic: 1, level: 4, attempts: 20, lessonDone: true }), skill('next', { topic: 2 })];
    expect(composePlan(input({ skills, currentTopic: null })).focusTopic).toBe(2);
  });

  it('is deterministic', () => {
    const data = input({
      skills: [skill('a'), skill('b', { due: true, level: 3, attempts: 6 })],
      errorFocus: { type: 'domain', count: 3 },
    });
    expect(composePlan(data)).toEqual(composePlan(data));
  });
});

describe('exam report', () => {
  const item = (overrides: Partial<ExamItemResult>): ExamItemResult => ({
    skill: 'a',
    level: 3,
    points: 2,
    answered: true,
    correct: true,
    seconds: 60,
    expectedSeconds: 60,
    predicted: 0.7,
    ...overrides,
  });

  it('separates slips from gaps and ranks what to practise', () => {
    const report = examReport(
      [
        item({ skill: 'a' }),
        item({ skill: 'a', correct: false, errorType: 'sign' }),
        item({ skill: 'b', correct: false, errorType: 'concept', points: 4 }),
        item({ skill: 'b', correct: false, answered: false, points: 4, seconds: 0 }),
        item({ skill: 'c', seconds: 200 }),
      ],
      1800,
    );
    expect(report).toMatchObject({ items: 5, answered: 4, correct: 2, points: 4, maxPoints: 14 });
    expect(report.percent).toBeCloseTo(28.6, 1);
    expect(report.errors.byFamily).toEqual({ slip: 1, procedure: 0, concept: 1 });
    expect(report.errors.pointsLostToSlips).toBe(2);
    expect(report.errors.pointsLostToGaps).toBe(8);
    expect(report.time).toMatchObject({ slowItems: 1, unanswered: 1, limitSeconds: 1800 });
    expect(report.strong).toEqual(['c']);
    expect(report.weak).toEqual(['b']);
    expect(report.next.map((n) => n.skill)).toEqual(['b', 'a']);
    expect(report.next[1]).toMatchObject({ skill: 'a', mostly: 'slip' });
  });

  it('guesses slip or gap from the model when the error is unclassified', () => {
    const report = examReport(
      [item({ correct: false, predicted: 0.9 }), item({ correct: false, predicted: 0.3 })],
      600,
    );
    expect(report.errors.byFamily).toMatchObject({ slip: 1, concept: 1 });
  });

  it('counts rushed wrong answers', () => {
    const report = examReport([item({ correct: false, seconds: 10, errorType: 'rushed' })], 600);
    expect(report.time.rushedWrong).toBe(1);
  });

  it('grades on the configured scale', () => {
    expect([100, 90, 89, 75, 50, 30, 29].map((p) => gradeFor(p, [90, 75, 50, 30]))).toEqual([1, 1, 2, 2, 3, 4, 5]);
    expect(gradeFor(80, null)).toBeNull();
  });

  it('distributes items over levels by largest remainder', () => {
    expect(levelsForMix(10, { 2: 0.4, 3: 0.4, 4: 0.2 })).toEqual([2, 2, 2, 2, 3, 3, 3, 3, 4, 4]);
    expect(levelsForMix(5, { 2: 0.5, 3: 0.5 })).toHaveLength(5);
    expect(levelsForMix(3, {})).toEqual([2, 2, 2]);
    expect(levelsForMix(7, { 1: 1, 5: 1 }).filter((l) => l === 1).length).toBeGreaterThanOrEqual(3);
  });
});
