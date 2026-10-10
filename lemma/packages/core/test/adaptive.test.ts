import { describe, expect, it } from 'vitest';
import type { Level } from '../src/content/types';
import { DAY_MS, GATES, PLACEMENT, PRIORITY, READINESS, SESSION, UNCERTAINTY } from '../src/learning/constants';
import {
  type DiagnosticAnswer,
  type DiagnosticConfig,
  diagnosticQueue,
  nextDiagnosticItem,
  verdictFor,
} from '../src/learning/diagnostic';
import { examReport, type ExamItemResult } from '../src/learning/exam';
import {
  applyAttempt,
  confidenceOf,
  emptySkillState,
  gatesFor,
  isStrongEvidence,
  levelOf,
  predictSuccess,
  predictWithChance,
  uncertaintyOf,
  withDefaults,
  type ResolvedAttempt,
  type SkillState,
} from '../src/learning/mastery';
import { pathPositionOf } from '../src/learning/path';
import { applyPlacement, placementSignals, presumedKnown, type SkillGraph } from '../src/learning/placement';
import {
  holdsBack,
  pickNext,
  prereqEvidence,
  scoreSkills,
  type PrioritySkill,
  type SessionItem,
} from '../src/learning/priority';
import { readiness, type ReadinessSkill } from '../src/learning/readiness';
import { reviewCard } from '../src/learning/scheduler';
import { chooseLevel } from '../src/learning/select';
import { composeGoalPlan } from '../src/learning/session';
import { createRng } from '../src/rng';

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

function run(state: SkillState, attempts: Partial<ResolvedAttempt>[], gapMs = 60_000, start = T0): SkillState {
  let current = state;
  attempts.forEach((overrides, index) => {
    current = applyAttempt(current, attempt({ at: start + index * gapMs, ...overrides })).state;
  });
  return current;
}

// --------------------------------------------------------------------------- the model

describe('false mastery', () => {
  it('moves the estimate less for a right answer that could have been a guess', () => {
    const typed = applyAttempt(emptySkillState('s'), attempt({ level: 3 }));
    const fiveOptions = applyAttempt(emptySkillState('s'), attempt({ level: 3, chance: 0.2 }));
    const coinFlip = applyAttempt(emptySkillState('s'), attempt({ level: 3, chance: 0.5 }));
    expect(fiveOptions.thetaAfter).toBeLessThan(typed.thetaAfter);
    expect(coinFlip.thetaAfter).toBeLessThan(fiveOptions.thetaAfter);
    // …and more for a wrong one: missing a question with a floor says more.
    const typedWrong = applyAttempt(emptySkillState('s'), attempt({ level: 3, solved: false, firstTry: false }));
    const choiceWrong = applyAttempt(
      emptySkillState('s'),
      attempt({ level: 3, solved: false, firstTry: false, chance: 0.2 }),
    );
    expect(choiceWrong.thetaAfter).toBeLessThan(typedWrong.thetaAfter);
    expect(predictWithChance(0, 3, 0.2)).toBeCloseTo(0.2 + 0.8 * predictSuccess(0, 3), 10);
    expect(predictWithChance(0, 3)).toBe(predictSuccess(0, 3));
  });

  it('does not count a declared guess or a coin flip as evidence for a level', () => {
    expect(isStrongEvidence(attempt())).toBe(true);
    expect(isStrongEvidence(attempt({ confidence: 'guess' }))).toBe(false);
    expect(isStrongEvidence(attempt({ chance: 0.5 }))).toBe(false);
    expect(isStrongEvidence(attempt({ chance: 0.2 }))).toBe(true);
    expect(isStrongEvidence(attempt({ selfAssessed: true }))).toBe(false);

    const guessed = run(
      emptySkillState('s'),
      Array.from({ length: 8 }, () => ({ context: 'mixed' as const, confidence: 'guess' as const, level: 3 as Level })),
    );
    expect(guessed.guessed).toBe(8);
    expect(guessed.unaided).toBe(0);
    expect(guessed.mixedUnaided).toBe(0);
    expect(guessed.hardCore).toBe(0);
    // Eight lucky answers leave the skill short of "proficient", whatever the estimate says.
    expect(levelOf(guessed)).toBeLessThan(4);
    const sure = run(
      emptySkillState('s'),
      Array.from({ length: 8 }, () => ({ context: 'mixed' as const, level: 3 as Level })),
    );
    expect(sure.theta).toBeGreaterThan(guessed.theta);
  });

  it('a student who guesses correctly does not instantly gain mastery', () => {
    // One sitting of right answers to five-option questions: no gap in time, one family.
    const state = run(
      emptySkillState('s'),
      Array.from({ length: 12 }, () => ({
        context: 'mixed' as const,
        level: 3 as Level,
        chance: 0.2,
        family: 'g1',
        families: 3,
      })),
    );
    expect(levelOf(state)).toBeLessThanOrEqual(3);
    const missing = gatesFor(state, 4)
      .filter((gate) => !gate.done)
      .map((gate) => gate.key);
    expect(missing).toContain('delay');
    expect(missing).toContain('variety');
  });

  it('asks for success in more than one problem family, as far as the skill has them', () => {
    const oneFamily = (families: number): Partial<ResolvedAttempt>[] => [
      ...Array.from({ length: 6 }, () => ({ level: 3 as Level, family: 'a', families })),
      { level: 3 as Level, context: 'mixed' as const, family: 'a', families },
      { level: 3 as Level, context: 'mixed' as const, family: 'a', families },
    ];
    // Three days later, still the same family.
    let state = run(emptySkillState('s'), oneFamily(3));
    state = applyAttempt(
      state,
      attempt({ level: 3, context: 'mixed', family: 'a', families: 3, at: T0 + 3 * DAY_MS }),
    ).state;
    const variety = gatesFor(state, 4).find((gate) => gate.key === 'variety')!;
    expect(variety).toMatchObject({ done: false, have: 1, need: GATES.PROFICIENT_FAMILIES });
    expect(
      gatesFor(state, 4)
        .filter((gate) => !gate.done)
        .map((gate) => gate.key),
    ).toEqual(['variety']);
    expect(levelOf(state)).toBe(3);

    // The same problem in another form, and the level is there.
    state = applyAttempt(
      state,
      attempt({ level: 3, context: 'mixed', family: 'b', families: 3, at: T0 + 3 * DAY_MS + 60_000 }),
    ).state;
    expect(state.families).toEqual(['a', 'b']);
    expect(levelOf(state)).toBe(4);
    expect(gatesFor(state, 5).find((gate) => gate.key === 'variety')).toMatchObject({
      done: false,
      need: GATES.MASTERED_FAMILIES,
    });

    // A skill with a single family is not asked for two.
    let single = run(emptySkillState('s'), oneFamily(1));
    single = applyAttempt(
      single,
      attempt({ level: 3, context: 'mixed', family: 'a', families: 1, at: T0 + 3 * DAY_MS }),
    ).state;
    expect(gatesFor(single, 4).find((gate) => gate.key === 'variety')).toMatchObject({ done: true, need: 1 });
    expect(levelOf(single)).toBe(4);
    // And where the number of families is unknown, nothing is asked.
    expect(gatesFor(emptySkillState('s'), 4).find((gate) => gate.key === 'variety')).toMatchObject({
      done: true,
      need: 0,
    });
  });

  it('a single careless mistake does not destroy a mastery estimate', () => {
    const strong: Partial<ResolvedAttempt>[] = [];
    for (let day = 0; day < 12; day++)
      strong.push({
        level: (day % 2 === 0 ? 4 : 3) as Level,
        context: 'mixed',
        family: `f${day % 3}`,
        families: 3,
        ceiling: 4,
        at: T0 + day * 8 * DAY_MS,
      });
    let state = emptySkillState('s');
    for (const step of strong) state = applyAttempt(state, attempt(step)).state;
    expect(levelOf(state)).toBe(5);
    const before = state.theta;

    const slip = applyAttempt(
      state,
      attempt({
        level: 3,
        context: 'mixed',
        solved: false,
        firstTry: false,
        errorType: 'arithmetic',
        family: 'f0',
        families: 3,
        ceiling: 4,
        at: T0 + 100 * DAY_MS,
      }),
    );
    expect(slip.thetaAfter).toBeLessThan(before);
    // The estimate gives a little and stays above the threshold; the level is kept.
    expect(slip.thetaAfter).toBeGreaterThan(GATES.MASTERED_THETA);
    expect(slip.levelAfter).toBe(5);
    // A conceptual error is different: "mastered" asks for none among the recent attempts.
    const gap = applyAttempt(
      state,
      attempt({
        level: 3,
        context: 'mixed',
        solved: false,
        firstTry: false,
        errorType: 'concept',
        family: 'f0',
        families: 3,
        ceiling: 4,
        at: T0 + 100 * DAY_MS,
      }),
    );
    expect(gap.levelAfter).toBe(4);
  });
});

describe('what is recorded per skill', () => {
  it('counts first tries, hints, timed work, days and the last success', () => {
    const state = run(
      emptySkillState('s'),
      [
        {},
        { hints: 1 },
        { solved: true, firstTry: false, retries: 1 },
        { context: 'exam' },
        { context: 'exam', solved: false, firstTry: false },
        { context: 'diagnostic' },
      ],
      DAY_MS,
    );
    expect(state.attempts).toBe(6);
    expect(state.firstTry).toBe(4);
    expect(state.hinted).toBe(1);
    expect(state.timed).toEqual({ attempts: 2, solved: 1 });
    expect(state.days).toBe(6);
    expect(state.diagnosed).toBe(1);
    expect(state.lastSuccessAt).toBe(T0 + 5 * DAY_MS);
    // Several problems on one day are one day.
    expect(run(emptySkillState('s'), [{}, {}, {}]).days).toBe(1);
  });

  it('keeps score of scheduled reviews and remembers a failed one until it is repaired', () => {
    let state = run(emptySkillState('s'), [{}]);
    const due = state.card!.due;
    const failed = applyAttempt(state, attempt({ at: due + DAY_MS, solved: false, firstTry: false }));
    expect(failed.state.reviews).toEqual({ passed: 0, failed: 1 });
    expect(failed.state.reviewFailed).toBe(true);
    state = applyAttempt(failed.state, attempt({ at: due + DAY_MS + 60_000 })).state;
    expect(state.reviewFailed).toBe(false);
    const again = applyAttempt(state, attempt({ at: state.card!.due + DAY_MS, context: 'mixed' }));
    expect(again.state.reviews.passed).toBe(1);
    expect(again.reviewPassed).toBe(true);
  });

  it('is unsure with little or one-sided evidence, and says so', () => {
    const none = emptySkillState('s');
    expect(uncertaintyOf(none)).toBe(UNCERTAINTY.MAX);
    expect(confidenceOf(none)).toBe('none');
    expect(confidenceOf(undefined)).toBe('none');

    const three = run(emptySkillState('s'), [{}, {}, {}]);
    expect(uncertaintyOf(three)).toBeLessThan(UNCERTAINTY.MAX);
    expect(confidenceOf(three)).toBe('low');

    // Ten attempts in one sitting from one family of three: still low.
    const oneSitting = run(
      emptySkillState('s'),
      Array.from({ length: 10 }, () => ({ family: 'a', families: 3 })),
    );
    expect(confidenceOf(oneSitting)).toBe('low');
    const spread = run(
      emptySkillState('s'),
      Array.from({ length: 10 }, (_, i) => ({ family: `f${i % 3}`, families: 3 })),
      3 * DAY_MS,
    );
    expect(uncertaintyOf(spread)).toBeLessThan(uncertaintyOf(oneSitting));
    expect(confidenceOf(spread)).toBe('high');
    expect(
      uncertaintyOf(
        run(
          emptySkillState('s'),
          Array.from({ length: 400 }, () => ({})),
          DAY_MS,
        ),
      ),
    ).toBe(UNCERTAINTY.MIN);
  });

  it('fills in what an older stored state lacks', () => {
    const old = withDefaults({ skill: 's', attempts: 4, theta: 0.5 } as Partial<SkillState> & { skill: string });
    expect(old.families).toEqual([]);
    expect(old.timed).toEqual({ attempts: 0, solved: 0 });
    expect(old.attempts).toBe(4);
  });
});

// --------------------------------------------------------------------------- placement

/** fractions → percent → applied percent; fractions → equations. */
const EDGES: Record<string, string[]> = {
  natural: [],
  fractions: ['natural'],
  percent: ['fractions'],
  applied: ['percent'],
  equations: ['fractions'],
};
const graph: SkillGraph = {
  prereqs: (skill) => EDGES[skill] ?? [],
  dependents: (skill) => Object.keys(EDGES).filter((id) => EDGES[id]!.includes(skill)),
};

describe('placement from a diagnostic', () => {
  it('presumes the prerequisites of a solved problem, less the further down they are', () => {
    const signals = placementSignals(graph, { skill: 'applied', level: 3, unaided: true, solved: true });
    expect(signals).toEqual([
      { skill: 'percent', theta: PLACEMENT.UP_STRONG, direction: 'up' },
      { skill: 'fractions', theta: PLACEMENT.UP_STRONG * PLACEMENT.DECAY, direction: 'up' },
      { skill: 'natural', theta: PLACEMENT.UP_STRONG * PLACEMENT.DECAY ** 2, direction: 'up' },
    ]);
    // A standard problem says less than a hard one; a warm-up says nothing.
    expect(placementSignals(graph, { skill: 'percent', level: 2, unaided: true, solved: true })[0]!.theta).toBe(
      PLACEMENT.UP_STANDARD,
    );
    expect(placementSignals(graph, { skill: 'percent', level: 1, unaided: true, solved: true })).toEqual([]);
    // Solved with a retry: no claim either way.
    expect(placementSignals(graph, { skill: 'percent', level: 2, unaided: false, solved: true })).toEqual([]);
  });

  it('lowers what builds on a missed skill, one step up only', () => {
    const signals = placementSignals(graph, { skill: 'fractions', level: 2, unaided: false, solved: false });
    expect(signals.map((signal) => signal.skill).sort()).toEqual(['equations', 'percent']);
    expect(signals.every((signal) => signal.direction === 'down' && signal.theta === PLACEMENT.DOWN)).toBe(true);
    // Missing a harder problem says the skill is not strong, not that what builds on it is missing.
    expect(placementSignals(graph, { skill: 'fractions', level: 3, unaided: false, solved: false })).toEqual([]);
  });

  it('gives way to the evidence a skill has of its own', () => {
    const up = { skill: 'fractions', theta: 0.63, direction: 'up' as const };
    const placed = applyPlacement(undefined, up, T0)!;
    expect(placed.theta).toBe(0.63);
    expect(placed.placement).toEqual({ theta: 0.63, at: T0 });
    expect(presumedKnown(placed)).toBe(true);
    expect(levelOf(placed)).toBe(0);
    // A weaker signal in the same direction changes nothing; a miss overrides.
    expect(applyPlacement(placed, { ...up, theta: 0.4 }, T0)).toBeNull();
    const lowered = applyPlacement(placed, { skill: 'fractions', theta: -0.6, direction: 'down' }, T0)!;
    expect(lowered.theta).toBe(-0.6);
    expect(presumedKnown(lowered)).toBe(false);
    expect(applyPlacement(lowered, up, T0)).toBeNull();
    // A practised skill takes no placement, and its first attempt clears the one it had.
    const practised = applyAttempt(placed, attempt()).state;
    expect(practised.placement).toBeNull();
    expect(applyPlacement(practised, up, T0)).toBeNull();
    expect(presumedKnown(practised)).toBe(false);
  });

  it('lets a placed skill start at the level its estimate suggests', () => {
    const levels: Level[] = [1, 2, 3, 4];
    expect(chooseLevel({ theta: 0.9, attempts: 0, available: levels })).toBe(1);
    expect(chooseLevel({ theta: 0.9, attempts: 0, available: levels, byEstimate: true })).toBe(2);
    expect(chooseLevel({ theta: 2.5, attempts: 0, available: levels, byEstimate: true })).toBe(PLACEMENT.START_CAP);
    expect(chooseLevel({ theta: -0.6, attempts: 0, available: levels, byEstimate: true })).toBe(1);
  });

  it('moves a learner who keeps succeeding up faster than the estimate alone would', () => {
    const levels: Level[] = [1, 2, 3, 4];
    // Two attempts in: a novice stays at level 2 — unless both were solved independently.
    expect(chooseLevel({ theta: 0.4, attempts: 2, available: levels, unaidedStreak: 1 })).toBe(2);
    expect(chooseLevel({ theta: 0.4, attempts: 2, available: levels, unaidedStreak: 2 })).toBe(3);
    // The estimate alone says level 3; four in a row aim two levels above it, as far as there are any.
    expect(chooseLevel({ theta: 1.2, attempts: 6, available: levels })).toBe(3);
    expect(chooseLevel({ theta: 1.2, attempts: 6, available: levels, unaidedStreak: 2 })).toBe(4);
    expect(chooseLevel({ theta: 1.2, attempts: 6, available: [1, 2, 3, 4, 5], unaidedStreak: 4 })).toBe(5);
    expect(chooseLevel({ theta: 1.2, attempts: 6, available: levels, unaidedStreak: 4 })).toBe(4);
    // A cap still holds, and a miss ends the run: one level down instead.
    expect(chooseLevel({ theta: 1.2, attempts: 6, available: levels, unaidedStreak: 4, cap: 3 })).toBe(3);
    expect(chooseLevel({ theta: 1.2, attempts: 6, available: levels, unaidedStreak: 4, lastFailed: true })).toBe(2);
  });
});

// -------------------------------------------------------------------------- path states

describe('path states', () => {
  it('reads each state off the evidence', () => {
    expect(pathPositionOf(undefined, T0)).toMatchObject({ state: 'not-started', reason: 'no-evidence' });
    expect(pathPositionOf(emptySkillState('s'), T0).state).toBe('not-started');

    const placedHigh = applyPlacement(undefined, { skill: 's', theta: 0.63, direction: 'up' }, T0)!;
    expect(pathPositionOf(placedHigh, T0)).toMatchObject({ state: 'diagnosed', reason: 'placed-high' });
    const placedLow = applyPlacement(undefined, { skill: 's', theta: -0.6, direction: 'down' }, T0)!;
    expect(pathPositionOf(placedLow, T0)).toMatchObject({ state: 'diagnosed', reason: 'placed-low' });

    // Asked in the diagnostic, not practised since.
    const asked = run(emptySkillState('s'), [{ context: 'diagnostic' }]);
    expect(pathPositionOf(asked, T0 + 60_000).state).toBe('diagnosed');
    const askedAndMissed = run(emptySkillState('s'), [{ context: 'diagnostic', solved: false, firstTry: false }]);
    expect(pathPositionOf(askedAndMissed, T0 + 60_000)).toMatchObject({ state: 'diagnosed', reason: 'placed-low' });

    const learning = run(emptySkillState('s'), [{}, {}]);
    expect(pathPositionOf(learning, T0 + 120_000)).toMatchObject({ state: 'learning', level: 2 - 1 });
    const practising = run(
      emptySkillState('s'),
      Array.from({ length: 6 }, () => ({})),
    );
    expect(pathPositionOf(practising, T0 + 600_000)).toMatchObject({
      state: 'practising',
      reason: 'familiar',
      level: 3,
    });
  });

  it('sends a familiar skill to review when it is due, fading or failed, and keeps its level', () => {
    const familiar = run(
      emptySkillState('s'),
      Array.from({ length: 6 }, () => ({})),
    );
    const due = familiar.card!.due;
    expect(pathPositionOf(familiar, due - 1).state).toBe('practising');
    expect(pathPositionOf(familiar, due + 1)).toMatchObject({ state: 'needs-review', reason: 'review-due', level: 3 });
    const failed = applyAttempt(familiar, attempt({ at: due + 1, solved: false, firstTry: false })).state;
    if (levelOf(failed) >= 3) expect(pathPositionOf(failed, due + 2).reason).toBe('review-failed');
    // A skill that is only being learned is not "in review": it is still being learned.
    const learning = run(emptySkillState('s'), [{}, {}]);
    expect(pathPositionOf(learning, learning.card!.due + DAY_MS).state).toBe('learning');
  });

  it('calls a skill mastered only when every gate is passed', () => {
    let state = emptySkillState('s');
    for (let day = 0; day < 12; day++)
      state = applyAttempt(
        state,
        attempt({
          level: (day % 2 === 0 ? 4 : 3) as Level,
          context: 'mixed',
          family: `f${day % 3}`,
          families: 3,
          ceiling: 4,
          at: T0 + day * 8 * DAY_MS,
        }),
      ).state;
    expect(levelOf(state)).toBe(5);
    const freshCard = reviewCard(state.card, 'good', T0 + 100 * DAY_MS);
    expect(pathPositionOf({ ...state, card: freshCard }, T0 + 100 * DAY_MS + 1)).toMatchObject({
      state: 'mastered',
      reason: 'all-gates',
    });
    const proficient = { ...state, level: 4 as const, hardTop: 0 };
    expect(pathPositionOf({ ...proficient, card: freshCard }, T0 + 100 * DAY_MS + 1).state).toBe('consolidating');
  });
});

// ----------------------------------------------------------------------------- priority

function skill(id: string, overrides: Partial<PrioritySkill> = {}): PrioritySkill {
  return {
    id,
    role: 'tested',
    weight: 0.1,
    level: 0,
    progress: 0,
    theta: 0,
    attempts: 0,
    sigma: UNCERTAINTY.MAX,
    presumedKnown: false,
    placed: false,
    due: false,
    overdueDays: 0,
    fading: false,
    reviewFailed: false,
    recentGapErrors: 0,
    prereqs: EDGES[id] ?? [],
    levels: [1, 2, 3, 4],
    inSchool: false,
    assigned: false,
    focus: null,
    ...overrides,
  };
}

/** The five skills of the little graph, natural numbers being a prerequisite only. */
function goal(overrides: Record<string, Partial<PrioritySkill>> = {}): PrioritySkill[] {
  return [
    skill('natural', { role: 'prerequisite', weight: 0, ...overrides.natural }),
    skill('fractions', { weight: 0.09, ...overrides.fractions }),
    skill('percent', { weight: 0.13, ...overrides.percent }),
    skill('applied', { weight: 0.06, ...overrides.applied }),
    skill('equations', { weight: 0.08, ...overrides.equations }),
  ];
}

const familiar = { level: 3 as const, progress: 0.65, theta: 0.8, attempts: 8, sigma: 0.5 };
const best = (skills: PrioritySkill[]) => [...scoreSkills(skills)].sort((a, b) => b.score - a.score);

describe('scoring skills', () => {
  it('sends a complete beginner to the prerequisites first, and says what they unlock', () => {
    const ranked = best(goal());
    expect(ranked[0]!.id).toBe('natural');
    expect(ranked[0]!.purpose).toBe('repair');
    expect(ranked[0]!.unlocks).toContain('fractions');
    // Everything above is held back, each by its own weakest prerequisite.
    const by = Object.fromEntries(ranked.map((entry) => [entry.id, entry.blockedBy]));
    expect(by).toEqual({
      natural: null,
      fractions: 'natural',
      percent: 'fractions',
      applied: 'percent',
      equations: 'fractions',
    });
    expect(ranked.slice(1).every((entry) => entry.score < ranked[0]!.score)).toBe(true);
  });

  it('stops a prerequisite holding others back once it is familiar, presumed, or off to a good start', () => {
    const nothing = { level: 0 as const, theta: 0, attempts: 0, presumedKnown: false, recentGapErrors: 0 };
    expect(holdsBack(nothing)).toBe(true);
    expect(holdsBack(prereqEvidence(undefined))).toBe(true);
    expect(holdsBack({ ...nothing, level: 3 })).toBe(false);
    expect(holdsBack({ ...nothing, presumedKnown: true })).toBe(false);
    // An estimate without attempts is a prior, not evidence.
    expect(holdsBack({ ...nothing, theta: 0.8 })).toBe(true);

    // One standard problem solved alone: still far from "familiar", and nothing says it is missing.
    const one = applyAttempt(emptySkillState('s'), attempt({ level: 2 })).state;
    expect(levelOf(one)).toBe(1);
    expect(holdsBack(prereqEvidence(one))).toBe(false);
    // Chosen among five options, it counts as well; a true/false statement does not.
    const after = (overrides: Partial<ResolvedAttempt>): boolean =>
      holdsBack(prereqEvidence(applyAttempt(emptySkillState('s'), attempt(overrides)).state));
    expect(after({ level: 2, chance: 0.2 })).toBe(false);
    expect(after({ level: 2, chance: 0.5 })).toBe(true);
    // A warm-up alone is not enough; neither is a success followed by a miss.
    expect(after({ level: 1 })).toBe(true);
    const mixed = run(emptySkillState('s'), [{ level: 2 }, { level: 2, solved: false, firstTry: false }]);
    expect(holdsBack(prereqEvidence(mixed))).toBe(true);
    // A good estimate with a conceptual error among the recent attempts is not a good start.
    const shaky = run(emptySkillState('s'), [
      { level: 2 },
      { level: 2 },
      { level: 3, solved: false, firstTry: false, errorType: 'concept' },
      { level: 2 },
    ]);
    expect(shaky.theta).toBeGreaterThan(PRIORITY.PROMISING_THETA);
    expect(levelOf(shaky)).toBeLessThan(3);
    expect(holdsBack(prereqEvidence(shaky))).toBe(true);
  });

  it('counts what waits behind a skill only while the skill is in the way', () => {
    const waiting = scoreSkills(goal()).find((entry) => entry.id === 'natural')!;
    expect(waiting.terms.unlock).toBeGreaterThan(0);
    const started = scoreSkills(goal({ natural: { level: 1, attempts: 1, theta: 0.37, progress: 0.2 } }));
    expect(started.find((entry) => entry.id === 'natural')!.terms.unlock).toBe(0);
    expect(started.find((entry) => entry.id === 'fractions')!.blockedBy).toBeNull();
    // Presumed from a diagnostic: nothing is pushed for the sake of what is behind it.
    const presumed = scoreSkills(goal({ natural: { presumedKnown: true, placed: true, theta: 0.6 } }));
    expect(presumed.find((entry) => entry.id === 'natural')!.terms.unlock).toBe(0);
  });

  it('treats a prerequisite as fine when a diagnostic makes it likely', () => {
    const ranked = best(goal({ natural: { presumedKnown: true, placed: true, theta: 0.6 } }));
    expect(ranked[0]!.id).toBe('fractions');
    expect(ranked[0]!.blockedBy).toBeNull();
    expect(ranked[0]!.purpose).toBe('new');
    expect(ranked.find((entry) => entry.id === 'percent')!.blockedBy).toBe('fractions');
  });

  it('repairs fractions before going on to percent', () => {
    const skills = goal({
      natural: { ...familiar, level: 4, progress: 0.85 },
      fractions: { level: 2, progress: 0.4, theta: -0.3, attempts: 6, sigma: 0.6, recentGapErrors: 3 },
      percent: { level: 1, progress: 0.25, attempts: 2 },
    });
    const ranked = best(skills);
    expect(ranked[0]!.id).toBe('fractions');
    expect(ranked[0]!.purpose).toBe('repair');
    expect(ranked[0]!.terms.errors).toBe(1);
    expect(ranked[0]!.terms.unlock).toBeGreaterThan(0);
    // Percent weighs more in the examination, and still waits.
    const percent = ranked.find((entry) => entry.id === 'percent')!;
    expect(percent.blockedBy).toBe('fractions');
    expect(percent.score).toBeLessThan(ranked[0]!.score * 0.5);
  });

  it('moves a student who keeps succeeding on to harder material', () => {
    const strong = { level: 4 as const, progress: 0.85, theta: 1.6, attempts: 14, sigma: 0.4 };
    const ranked = best(goal({ natural: strong, fractions: strong, percent: { ...familiar }, equations: strong }));
    // What is left to learn comes first…
    expect(ranked[0]!.id).toBe('applied');
    expect(ranked[0]!.purpose).toBe('new');
    // …and what is proficient is offered as a stretch, what is familiar as examination practice.
    expect(ranked.find((entry) => entry.id === 'fractions')!.purpose).toBe('stretch');
    expect(ranked.find((entry) => entry.id === 'percent')!.purpose).toBe('exam');
  });

  it('brings a mastered skill back when its review is due', () => {
    const mastered = { level: 5 as const, progress: 1, theta: 2.4, attempts: 20, sigma: 0.3 };
    const fresh = best(
      goal({ natural: mastered, fractions: mastered, percent: mastered, applied: mastered, equations: mastered }),
    );
    expect(fresh.every((entry) => entry.terms.review === 0)).toBe(true);
    const later = best(
      goal({
        natural: mastered,
        fractions: { ...mastered, due: true, overdueDays: 3 },
        percent: mastered,
        applied: mastered,
        equations: mastered,
      }),
    );
    expect(later[0]!.id).toBe('fractions');
    expect(later[0]!.purpose).toBe('review');
    expect(later[0]!.terms.review).toBeCloseTo(
      PRIORITY.REVIEW_DUE + (1 - PRIORITY.REVIEW_DUE) * (3 / PRIORITY.REVIEW_FULL_AFTER_DAYS),
      10,
    );
    // Longer overdue is more urgent; a failed review more urgent still.
    const overdue = scoreSkills(goal({ fractions: { ...mastered, due: true, overdueDays: 30 } })).find(
      (e) => e.id === 'fractions',
    )!;
    expect(overdue.terms.review).toBe(1);
    const fading = scoreSkills(goal({ fractions: { ...mastered, fading: true, reviewFailed: true } })).find(
      (e) => e.id === 'fractions',
    )!;
    expect(fading.terms.review).toBeCloseTo(PRIORITY.REVIEW_FADING + PRIORITY.REVIEW_FAILED_EXTRA, 10);
  });

  it('puts what the teacher assigned and what the class is on ahead', () => {
    const base = goal({
      natural: familiar,
      fractions: familiar,
      percent: familiar,
      applied: familiar,
      equations: familiar,
    });
    const plain = Object.fromEntries(scoreSkills(base).map((entry) => [entry.id, entry.score]));
    const assigned = scoreSkills(base.map((s) => (s.id === 'applied' ? { ...s, assigned: true } : s))).find(
      (e) => e.id === 'applied',
    )!;
    expect(assigned.purpose).toBe('assigned');
    expect(assigned.score - plain.applied!).toBeCloseTo(PRIORITY.ASSIGNED, 10);
    const school = scoreSkills(base.map((s) => (s.id === 'equations' ? { ...s, inSchool: true } : s))).find(
      (e) => e.id === 'equations',
    )!;
    expect(school.score).toBeGreaterThan(plain.equations!);
    const focus = scoreSkills(base.map((s) => (s.id === 'percent' ? { ...s, focus: 'difficulty' as const } : s))).find(
      (e) => e.id === 'percent',
    )!;
    expect(focus.score - plain.percent!).toBeCloseTo(PRIORITY.ASSIGNED * PRIORITY.FOCUS_DIFFICULTY, 10);
    // An assignment is not held back by a prerequisite: the teacher decided.
    const blockedButAssigned = scoreSkills(goal({ percent: { assigned: true } })).find((e) => e.id === 'percent')!;
    expect(blockedButAssigned.blockedBy).toBeNull();
  });

  it('never schedules what cannot be practised, and enrichment only once the rest is familiar', () => {
    const paperOnly = scoreSkills([...goal(), skill('constructions', { weight: 0.11, levels: [], prereqs: [] })]);
    expect(paperOnly.find((entry) => entry.id === 'constructions')!.score).toBe(0);

    const extra = skill('systems', { role: 'enrichment', weight: 0, prereqs: ['equations'] });
    const early = scoreSkills([
      ...goal({
        natural: familiar,
        fractions: familiar,
        percent: familiar,
        applied: { level: 1, progress: 0.2, attempts: 1 },
        equations: familiar,
      }),
      extra,
    ]);
    expect(early.find((entry) => entry.id === 'systems')!.terms.need).toBe(0);
    const late = scoreSkills([
      ...goal({ natural: familiar, fractions: familiar, percent: familiar, applied: familiar, equations: familiar }),
      extra,
    ]);
    expect(late.find((entry) => entry.id === 'systems')!.terms.need).toBeGreaterThan(0);
  });

  it('values information about a skill it knows little about', () => {
    const unknown = scoreSkills(goal({ natural: familiar })).find((e) => e.id === 'fractions')!;
    const known = scoreSkills(goal({ natural: familiar, fractions: { attempts: 6, sigma: 0.5 } })).find(
      (e) => e.id === 'fractions',
    )!;
    expect(unknown.terms.info).toBeGreaterThan(0);
    expect(known.terms.info).toBe(0);
  });
});

describe('one adaptive session', () => {
  const ready = goal({
    natural: { ...familiar, level: 4, progress: 0.85, theta: 1.8 },
    fractions: { ...familiar, theta: 1.4 },
    percent: { level: 2, progress: 0.4, theta: 0.1, attempts: 4, sigma: 0.7 },
    applied: { level: 1, progress: 0.2, attempts: 1 },
    equations: { level: 2, progress: 0.45, theta: 0.2, attempts: 5, sigma: 0.6 },
  });
  const scored = scoreSkills(ready);
  const item = (id: string, solved = true, purpose: SessionItem['purpose'] = 'consolidate'): SessionItem => ({
    skill: id,
    purpose,
    solved,
    unaided: solved,
  });

  it('never asks the same skill twice in a row', () => {
    const session: SessionItem[] = [];
    const rng = createRng(11);
    for (let step = 0; step < 14; step++) {
      const choice = pickNext(scored, ready, session, rng)!;
      expect(choice, `step ${step}`).not.toBeNull();
      if (session.length > 0) expect(choice.skill).not.toBe(session[session.length - 1]!.skill);
      session.push(item(choice.skill, true, choice.purpose));
    }
    // Nothing more often than the session allows, and more than one skill was served.
    const counts = new Map<string, number>();
    for (const entry of session) counts.set(entry.skill, (counts.get(entry.skill) ?? 0) + 1);
    expect(Math.max(...counts.values())).toBeLessThanOrEqual(SESSION.MAX_PER_SKILL);
    expect(counts.size).toBeGreaterThanOrEqual(3);
  });

  it('asks what a prerequisite holds back only when nothing else is left', () => {
    // A beginner, and one skill beside the chain that needs nothing.
    const skills = [...goal(), skill('symmetry', { weight: 0.01, prereqs: [] })];
    const all = scoreSkills(skills);
    const session: SessionItem[] = [];
    for (let step = 0; step < 8; step++) {
      const choice = pickNext(all, skills, session, createRng(step))!;
      // Percent weighs thirteen times what symmetry does, and still waits for fractions.
      expect(['natural', 'symmetry']).toContain(choice.skill);
      session.push(item(choice.skill, true, choice.purpose));
    }
    // Both have had their four turns: now, and only now, something held back is asked.
    const forced = pickNext(all, skills, session, createRng(1))!;
    expect(all.find((entry) => entry.id === forced.skill)!.blockedBy).not.toBeNull();
  });

  it('lets a failed skill rest and brings it back later', () => {
    const first = pickNext(scored, ready, [], createRng(3))!;
    const failed = [item(first.skill, false)];
    const second = pickNext(scored, ready, failed, createRng(3))!;
    expect(second.skill).not.toBe(first.skill);
    const third = pickNext(scored, ready, [...failed, item(second.skill)], createRng(3))!;
    expect(third.skill).not.toBe(first.skill);
    // After the rest it may return.
    const session = [...failed, item(second.skill), item(third.skill)];
    const later = Array.from({ length: 6 }, (_, seed) => pickNext(scored, ready, session, createRng(seed))!.skill);
    expect(later).toContain(first.skill);
  });

  it('answers two failures in a row with a problem that is likely to go well', () => {
    const session = [item('percent', false), item('equations', false)];
    const choice = pickNext(scored, ready, session, createRng(5))!;
    expect(choice.purpose).toBe('confidence');
    expect(choice.because).toBe('confidence');
    expect(choice.cap).toBe(2);
    const chosen = ready.find((s) => s.id === choice.skill)!;
    expect(predictSuccess(chosen.theta, 1)).toBeGreaterThanOrEqual(SESSION.CONFIDENCE_MIN_P);
    expect(['percent', 'equations']).not.toContain(choice.skill);
    // One failure is not a run.
    expect(pickNext(scored, ready, [item('percent', false)], createRng(5))!.purpose).not.toBe('confidence');
  });

  it('keeps a stretch for when things are going well', () => {
    const strong = { level: 4 as const, progress: 0.85, theta: 1.8, attempts: 14, sigma: 0.4 };
    const skills = goal({
      natural: strong,
      fractions: strong,
      percent: strong,
      applied: { ...strong, level: 5, progress: 1 },
      equations: strong,
    });
    const all = scoreSkills(skills);
    expect(all.every((entry) => entry.purpose === 'stretch')).toBe(true);
    // What is mastered and not due has nothing to gain: it is never scheduled.
    expect(all.find((entry) => entry.id === 'applied')!.score).toBe(0);
    const cold = pickNext(all, skills, [], createRng(1))!;
    const warm = pickNext(
      all,
      skills,
      [item('natural'), item('fractions'), item('percent'), item('equations')],
      createRng(1),
    )!;
    expect(warm.purpose).toBe('stretch');
    expect(warm.floor).toBe(4);
    expect(cold.skill).toBeDefined();
  });

  it('says why a problem was chosen and how it should be pitched', () => {
    const fresh = goal({ natural: { presumedKnown: true, placed: true, theta: 0.6 } });
    const choice = pickNext(scoreSkills(fresh), fresh, [], createRng(2))!;
    expect(choice).toMatchObject({ skill: 'fractions', purpose: 'new', cap: 2, byEstimate: false });
    const beginner = goal();
    const repair = pickNext(scoreSkills(beginner), beginner, [], createRng(2))!;
    expect(repair).toMatchObject({ skill: 'natural', purpose: 'repair', because: 'unlock', blockedSkill: 'fractions' });
    // The same input and seed give the same choice.
    expect(pickNext(scoreSkills(beginner), beginner, [], createRng(2))).toEqual(repair);
    expect(pickNext([], [], [], createRng(1))).toBeNull();
  });
});

// --------------------------------------------------------------------------- diagnostic

describe('the diagnostic', () => {
  const config: DiagnosticConfig = {
    anchors: ['fractions', 'percent', 'equations'],
    prereqs: (id) => EDGES[id] ?? [],
    levelsOf: () => [1, 2, 3, 4],
  };
  const answer = (
    item: { skill: string; level: Level; stage: DiagnosticAnswer['stage']; anchor: string },
    outcome: DiagnosticAnswer['outcome'],
  ): DiagnosticAnswer => ({ ...item, outcome });

  it('sweeps the anchors first, at the standard level', () => {
    expect(diagnosticQueue(config, [])).toEqual([
      { skill: 'fractions', level: 2, stage: 'anchor', anchor: 'fractions' },
      { skill: 'percent', level: 2, stage: 'anchor', anchor: 'percent' },
      { skill: 'equations', level: 2, stage: 'anchor', anchor: 'equations' },
    ]);
  });

  it('follows a miss with an easier problem, and a second miss with a prerequisite', () => {
    const answers: DiagnosticAnswer[] = [];
    const step = (outcome: DiagnosticAnswer['outcome']) => {
      const next = nextDiagnosticItem(config, answers)!;
      answers.push(answer(next, outcome));
      return next;
    };
    step('wrong'); // fractions
    step('correct'); // percent
    step('skipped'); // equations
    // Misses first: a single wrong answer settles nothing.
    expect(step('wrong')).toEqual({ skill: 'fractions', level: 1, stage: 'second-chance', anchor: 'fractions' });
    expect(step('correct')).toEqual({ skill: 'equations', level: 1, stage: 'second-chance', anchor: 'equations' });
    // Fractions were missed twice: one step down. Then the harder problem for what went well.
    expect(step('correct')).toEqual({ skill: 'natural', level: 2, stage: 'prerequisite', anchor: 'fractions' });
    expect(step('wrong')).toEqual({ skill: 'percent', level: 3, stage: 'harder', anchor: 'percent' });
    expect(nextDiagnosticItem(config, answers)).toBeNull();

    expect(verdictFor('fractions', answers)).toBe('gap');
    expect(verdictFor('equations', answers)).toBe('shaky');
    expect(verdictFor('percent', answers)).toBe('sound');
    expect(verdictFor('natural', answers)).toBe('untested');
  });

  it('tells strong from sound, and stops at its limit', () => {
    const answers: DiagnosticAnswer[] = [];
    for (;;) {
      const next = nextDiagnosticItem(config, answers);
      if (!next) break;
      answers.push(answer(next, 'correct'));
    }
    expect(answers.map((a) => a.stage)).toEqual(['anchor', 'anchor', 'anchor', 'harder', 'harder', 'harder']);
    expect(config.anchors.map((id) => verdictFor(id, answers))).toEqual(['strong', 'strong', 'strong']);
    expect(nextDiagnosticItem({ ...config, maxItems: 2 }, answers.slice(0, 2))).toBeNull();
  });

  it('skips what cannot be asked', () => {
    const sparse: DiagnosticConfig = {
      ...config,
      levelsOf: (id) => (id === 'percent' ? [] : id === 'equations' ? [3] : [1, 2]),
    };
    expect(diagnosticQueue(sparse, []).map((item) => `${item.skill}@${item.level}`)).toEqual([
      'fractions@2',
      'equations@3',
    ]);
    // A skill whose only level was the anchor's has nothing harder to ask.
    const done = [
      answer({ skill: 'equations', level: 3, stage: 'anchor', anchor: 'equations' }, 'correct'),
      answer({ skill: 'fractions', level: 2, stage: 'anchor', anchor: 'fractions' }, 'correct'),
    ];
    expect(diagnosticQueue(sparse, done)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------- readiness

function rs(id: string, overrides: Partial<ReadinessSkill> = {}): ReadinessSkill {
  return {
    id,
    role: 'tested',
    weight: 0.2,
    paperOnly: false,
    level: 0,
    practised: 0,
    attempts: 0,
    reviews: { passed: 0, failed: 0 },
    inTheWay: false,
    holdsUp: [],
    ...overrides,
  };
}

describe('readiness', () => {
  const none = { mocks: [], hard: { attempts: 0, unaided: 0 } };

  it('says nothing where there is nothing to go on', () => {
    const report = readiness({ skills: ['a', 'b', 'c', 'd', 'e'].map((id) => rs(id)), ...none });
    expect(report.verdict).toBe('no-data');
    for (const part of [
      report.coverage,
      report.mastery,
      report.familiar,
      report.retention,
      report.timed,
      report.unfamiliar,
    ])
      expect(part.value).toBeNull();
    expect(report.timed.count).toBe(0);
    expect(report.untouched).toEqual(['a', 'b', 'c', 'd', 'e']);
    // One practised skill is still nothing to judge by.
    const one = readiness({
      skills: [rs('a', { level: 5, practised: 30, attempts: 30 }), rs('b'), rs('c'), rs('d'), rs('e')],
      ...none,
    });
    expect(one.verdict).toBe('no-data');
    expect(one.coverage.value).toBeNull();
    expect(one.coverage.evidence).toBe(1);
    expect(one.coverage.needed).toBe(READINESS.NO_DATA_BELOW_SKILLS);
  });

  it('does not count a diagnostic as practice', () => {
    const skills = ['a', 'b', 'c', 'd', 'e'].map((id) => rs(id, { attempts: 2, practised: 0, level: 1 }));
    const report = readiness({ skills, ...none });
    expect(report.coverage.value).toBe(0);
    expect(report.verdict).toBe('building');
    expect(report.mastery.value).toBeNull();
  });

  it('reports each part with what stands behind it', () => {
    const skills = [
      rs('a', { level: 4, practised: 12, attempts: 12, reviews: { passed: 4, failed: 1 } }),
      rs('b', { level: 3, practised: 8, attempts: 8, reviews: { passed: 2, failed: 0 } }),
      rs('c', { level: 2, practised: 5, attempts: 5, inTheWay: true, holdsUp: ['d'] }),
      rs('d', { level: 1, practised: 1, attempts: 1, inTheWay: true }),
      // Tried once and it went well: below "familiar", and no gap.
      rs('f', { level: 1, practised: 1, attempts: 1, weight: 0 }),
      rs('e'),
    ];
    const report = readiness({ skills, mocks: [], hard: { attempts: 10, unaided: 6 } });
    expect(report.verdict).toBe('practising');
    expect(report.coverage.value).toBeCloseTo(0.6, 10);
    expect(report.mastery.value).toBeCloseTo(0.2, 10);
    expect(report.familiar.value).toBeCloseTo(0.4, 10);
    expect(report.retention).toMatchObject({ evidence: 7, needed: READINESS.RETENTION_MIN_REVIEWS });
    expect(report.retention.value).toBeCloseTo(6 / 7, 10);
    expect(report.unfamiliar.value).toBeCloseTo(0.6, 10);
    expect(report.timed.value).toBeNull();
    // The gap that holds something up comes first, with its own weight and what waits behind it.
    expect(report.gaps.map((gap) => gap.id)).toEqual(['c', 'd']);
    expect(report.gaps[0]).toMatchObject({ holdsUp: ['d'] });
    expect(report.gaps[0]!.weight).toBeCloseTo(0.4, 10);
    expect(report.untouched).toEqual(['e']);
  });

  it('leaves the paper-only part of the examination out, and says how large it is', () => {
    const skills = [
      rs('a', { level: 4, practised: 9, attempts: 9, weight: 0.3 }),
      rs('b', { level: 4, practised: 9, attempts: 9, weight: 0.3 }),
      rs('c', { level: 3, practised: 9, attempts: 9, weight: 0.3 }),
      rs('constructions', { weight: 0.1, paperOnly: true }),
      rs('basics', { role: 'prerequisite', weight: 0, level: 4, practised: 6, attempts: 6 }),
    ];
    const report = readiness({ skills, ...none });
    expect(report.coverage.value).toBeCloseTo(1, 10);
    expect(report.paperOnlyWeight).toBeCloseTo(0.1, 10);
    expect(report.untouched).toEqual([]);
    expect(report.verdict).toBe('test-ready');
  });

  it('shows timed tests as what they were, with the best and the last', () => {
    const mock = (finishedAt: number, points: number) => ({
      finishedAt,
      points,
      maxPoints: 45,
      examPoints: 50,
      minutesUsed: 60,
      minutesAllowed: 63,
    });
    const report = readiness({
      skills: [rs('a')],
      mocks: [mock(3, 27), mock(1, 18), mock(2, 36)],
      hard: { attempts: 0, unaided: 0 },
    });
    expect(report.timed.count).toBe(3);
    expect(report.timed.last!.points).toBe(27);
    expect(report.timed.best!.points).toBe(36);
    expect(report.timed.value).toBeCloseTo(27 / 45, 10);
    // Tests alone do not make a verdict: the skills have no evidence.
    expect(report.verdict).toBe('no-data');
  });
});

// ------------------------------------------------------------------------ plan and exam

describe('the daily plan of an examination goal', () => {
  const base = {
    day: '2026-10-09',
    minutes: 30,
    diagnosed: true,
    skillsWithEvidence: 6,
    assignments: [],
    top: [
      { id: 'fractions', purpose: 'repair' as const },
      { id: 'percent', purpose: 'new' as const },
      { id: 'equations', purpose: 'review' as const },
      { id: 'applied', purpose: 'new' as const },
    ],
    dueCount: 2,
    errorFocus: null,
    mock: { ready: false, daysSinceLast: null },
    exam: null,
  };

  it('starts with the placement test while there is none', () => {
    const plan = composeGoalPlan({ ...base, diagnosed: false, skillsWithEvidence: 0, top: [] });
    expect(plan.blocks.map((block) => block.kind)).toEqual(['diagnostic']);
    expect(plan.blocks[0]!.reason.code).toBe('diagnostic-first');
    expect(plan.focusTopic).toBeNull();
    // With time to spare an adaptive session follows it.
    const longer = composeGoalPlan({ ...base, diagnosed: false, minutes: 45 });
    expect(longer.blocks.map((block) => [block.kind, block.minutes])).toEqual([
      ['diagnostic', 20],
      ['adaptive', 25],
    ]);
  });

  it('is one adaptive session that names its first priorities', () => {
    const plan = composeGoalPlan(base);
    expect(plan.blocks).toHaveLength(1);
    expect(plan.blocks[0]).toMatchObject({
      kind: 'adaptive',
      minutes: 30,
      skills: ['fractions', 'percent', 'equations'],
      optional: false,
    });
    expect(plan.blocks[0]!.reason).toEqual({
      code: 'adaptive-mix',
      data: {
        due: 2,
        count: 4,
        s1: 'fractions',
        p1: 'repair',
        s2: 'percent',
        p2: 'new',
        s3: 'equations',
        p3: 'review',
      },
    });
  });

  it('puts what the teacher set first, and a drill against a recurring error last', () => {
    const plan = composeGoalPlan({
      ...base,
      minutes: 45,
      assignments: [{ id: 'a1', kind: 'remediation', skills: ['fractions'], minutes: 10 }],
      errorFocus: { type: 'sign', count: 4 },
    });
    expect(plan.blocks.map((block) => [block.kind, block.minutes])).toEqual([
      ['assigned', 10],
      ['adaptive', 27],
      ['drill', 8],
    ]);
    expect(plan.blocks[0]).toMatchObject({ assignment: 'a1', skills: ['fractions'] });
    // Blocks are named, so that a plan composed again finds the runs already under way.
    expect(plan.blocks.map((block) => block.id)).toEqual(['assigned:a1', 'adaptive', 'drill']);
    expect(plan.blocks[0]!.reason).toEqual({ code: 'assigned-by-teacher', data: { kind: 'remediation', count: 1 } });
    expect(plan.blocks.reduce((sum, block) => sum + block.minutes, 0)).toBe(45);
  });

  it('offers a timed test beside the day when the base is there, at most once a week', () => {
    const ready = composeGoalPlan({ ...base, mock: { ready: true, daysSinceLast: null }, exam: { day: '2027-04-12' } });
    const mock = ready.blocks.find((block) => block.kind === 'mock')!;
    expect(mock).toMatchObject({ optional: true });
    expect(mock.reason.code).toBe('mock-ready');
    expect(ready.test).toEqual({ day: '2027-04-12', inDays: 185, title: undefined });
    expect(
      composeGoalPlan({ ...base, mock: { ready: true, daysSinceLast: 3 } }).blocks.some((b) => b.kind === 'mock'),
    ).toBe(false);
    expect(
      composeGoalPlan({ ...base, mock: { ready: true, daysSinceLast: 7 } }).blocks.some((b) => b.kind === 'mock'),
    ).toBe(true);
    // A test the teacher assigned is the day's test; no second one is offered.
    const assigned = composeGoalPlan({
      ...base,
      assignments: [{ id: 't', kind: 'test', skills: [], minutes: 60 }],
      mock: { ready: true, daysSinceLast: null },
    });
    expect(assigned.blocks.filter((block) => block.kind === 'mock')).toHaveLength(1);
    expect(assigned.blocks[0]).toMatchObject({ kind: 'mock', assignment: 't', optional: false });
  });
});

describe('scoring bundles of sub-questions', () => {
  const item = (correct: boolean, overrides: Partial<ExamItemResult> = {}): ExamItemResult => ({
    skill: 'data',
    level: 2,
    points: 0,
    answered: true,
    correct,
    seconds: 60,
    expectedSeconds: 60,
    predicted: 0.6,
    ...overrides,
  });
  const scoring = { scale: null, bundles: { tf: [0, 0, 2, 4], match: [0, 2, 4, 6] } };

  it('marks three true/false statements together: 4, 2, 0, 0', () => {
    const points = (right: number): number =>
      examReport(
        [0, 1, 2].map((i) => item(i < right, { bundle: 'tf' })),
        600,
        scoring,
      ).points;
    expect([3, 2, 1, 0].map(points)).toEqual([4, 2, 0, 0]);
    expect(
      examReport(
        [0, 1, 2].map(() => item(true, { bundle: 'tf' })),
        600,
        scoring,
      ).maxPoints,
    ).toBe(4);
  });

  it('adds bundles to the loose items and keeps the grade out of it', () => {
    const results = [
      item(true, { skill: 'fractions', points: 2 }),
      item(false, { skill: 'fractions', points: 1 }),
      item(true, { bundle: 'tf' }),
      item(true, { bundle: 'tf' }),
      item(false, { bundle: 'tf', errorType: 'misread' }),
      item(true, { skill: 'percent', bundle: 'match' }),
      item(false, { skill: 'percent', bundle: 'match', answered: false }),
      item(true, { skill: 'percent', bundle: 'match' }),
    ];
    const report = examReport(results, 3780, scoring);
    expect(report.maxPoints).toBe(3 + 4 + 6);
    expect(report.points).toBe(2 + 2 + 4);
    expect(report.grade).toBeNull();
    expect(report.correct).toBe(5);
    const by = Object.fromEntries(report.bySkill.map((entry) => [entry.skill, [entry.points, entry.maxPoints]]));
    expect(by).toEqual({ fractions: [2, 3], data: [2, 4], percent: [4, 6] });
    // Two right in the true/false bundle cost two points, though only one answer was wrong.
    expect(report.next.find((entry) => entry.skill === 'data')!.lost).toBe(2);
    // The old call with a grade scale still works.
    expect(examReport([item(true, { points: 3 }), item(false, { points: 1 })], 600, [90, 75, 50, 30]).grade).toBe(2);
    expect(examReport([item(true, { points: 3 })], 600).grade).toBe(1);
  });
});
