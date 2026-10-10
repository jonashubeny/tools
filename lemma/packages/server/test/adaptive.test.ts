import { GENERATORS, conceptsOfGoal, familyCountOf, generatorsFor, getConcept, goalSkillOf } from '@lemma/content';
import {
  type AnswerResultDto,
  type DashboardDto,
  type ExamDto,
  type GraphDto,
  type Level,
  type StartRunResponse,
  createRng,
  gatesFor,
  levelOf,
} from '@lemma/core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cancelAssignment, createAssignment } from '../src/services/assignments';
import { type Ctx, getSettings, updateSettings } from '../src/services/context';
import { curriculum } from '../src/services/curriculum';
import { dashboard } from '../src/services/dashboard';
import { diagnosticStatus, listDiagnostics, skipDiagnostic } from '../src/services/diagnostic';
import { createExam, finishExam, saveExamAnswer } from '../src/services/exam';
import { analytics, conceptDetail } from '../src/services/insights';
import { type States, allSkills, loadStates, replayAll, weakPrereqOf } from '../src/services/learner';
import { workedExample } from '../src/services/lessons';
import { errorFocus, getPlan, regeneratePlan, startAssignment, startBlock } from '../src/services/plan';
import {
  type ProblemRow,
  getProblemRow,
  issueProblem,
  nextInRun,
  snapshotOf,
  startDiagnostic,
  startRun,
  submitAnswer,
} from '../src/services/practice';
import { readinessFor } from '../src/services/readiness';
import { nextSteps, selectionFor } from '../src/services/selection';
import {
  EMA,
  KLARA,
  MATEJ,
  VOJTA,
  type Persona,
  type Played,
  adaptiveSession,
  play,
  playRun,
  rightInput,
  study,
  withGoal,
  wrongInput,
} from './fixtures';
import { type Harness, DAY, MINUTE, harness } from './helpers';

/**
 * The learning engine, end to end, on fictional learners (fixtures.ts). The numbered
 * tests are the scenarios the adaptive-learning brief asks for, in its order; the access
 * scenarios (11–13) are in teach.test.ts.
 *
 * Problem seeds are drawn at random by the server, so no test asserts an exact sequence
 * of problems: each asserts a property that has to hold whatever was drawn.
 */

function learner(goal: 'jpz-9' | 'jpz-7' | 'jpz-5' = 'jpz-9'): Harness {
  const h = harness();
  withGoal(h.ctx, goal);
  return h;
}

const mean = (values: number[]): number => values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);
const stateOfSkill = (ctx: Ctx, skill: string) => loadStates(ctx).get(skill);

/** Solve one problem of a skill correctly, in a given context and family. */
function solve(
  h: Harness,
  skill: string,
  options: { generator?: string; level?: Level; context?: 'blocked' | 'mixed'; confidence?: 'sure' | 'guess' } = {},
): ProblemRow {
  const row = issueProblem(h.ctx, {
    skill,
    context: options.context ?? 'mixed',
    generator: options.generator,
    level: options.level,
  });
  submitAnswer(h.ctx, row.id, { input: rightInput(row), seconds: row.est_seconds, confidence: options.confidence });
  return getProblemRow(h.ctx, row.id);
}

/** Bring one skill to "mastered": right answers over weeks, in every family, hidden topic, hard ones included. */
function master(h: Harness, skill: string): void {
  const families = generatorsFor(skill);
  for (let round = 0; round < 12; round++) {
    const generator = families[round % families.length]!;
    solve(h, skill, { generator: generator.id, level: Math.max(...generator.levels) as Level });
    h.advance(8 * DAY);
  }
  expect(levelOf(stateOfSkill(h.ctx, skill)!)).toBe(5);
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('scenarios of the brief', () => {
  it('1 · a complete beginner receives prerequisite-level exercises', () => {
    const h = learner();
    skipDiagnostic(h.ctx);

    // What "continue" would do, and why: the prerequisite everything else stands on.
    const next = dashboard(h.ctx).entrance!.next!;
    expect(next.skill.id).toBe('num.natural');
    expect(next.purpose).toBe('repair');
    expect(next.because).toBe('unlock');
    expect(next.forSkill).not.toBeNull();
    // The map says what is waiting for what.
    const map = curriculum(h.ctx);
    const fractions = map.skills.find((skill) => skill.id === 'frac.operations')!;
    expect(fractions.blockedBy).not.toBeNull();
    expect(map.skills.find((skill) => skill.id === 'num.natural')!.unlocks.length).toBeGreaterThan(5);

    // The session: every problem is one whose prerequisites are not in the way, at the easiest levels.
    const rng = createRng(11);
    let step: StartRunResponse = startRun(h.ctx, { context: 'adaptive', count: 10 });
    let before: States = new Map();
    const served: ProblemRow[] = [];
    while (step.problem) {
      const row = getProblemRow(h.ctx, step.problem.id);
      expect(weakPrereqOf(getConcept(row.skill)!, before), `${row.skill} was served too early`).toBeNull();
      expect(row.level).toBeLessThanOrEqual(2);
      expect(['repair', 'new', 'confidence']).toContain(row.purpose);
      // Named topic and hints: this is learning, not testing.
      expect(row.context).toBe('blocked');
      expect(step.problem.why).not.toBeNull();
      served.push(play(h.ctx, step.problem, MATEJ, rng).row);
      before = loadStates(h.ctx);
      step = nextInRun(h.ctx, step.run.id);
    }
    expect(served).toHaveLength(10);
    expect(served[0]!.skill).toBe('num.natural');
    expect(served[0]!.level).toBe(1);
    // Nothing the examination weighs heavily was touched: it all waits for the basics.
    for (const heavy of ['pct.basics', 'eqn.linear', 'frac.operations', 'word.equations'])
      expect(served.some((row) => row.skill === heavy)).toBe(false);
  });

  it('2 · a student who struggles with fractions receives appropriate remediation', () => {
    const h = learner();
    playRun(h.ctx, startDiagnostic(h.ctx), EMA, createRng(3), (row) =>
      // Ema as she is, made certain where the story needs it: fractions and percent missed, the rest solved.
      row.skill.startsWith('frac.') || row.skill.startsWith('pct.') ? false : row.level <= 2 ? true : undefined,
    );
    const report = listDiagnostics(h.ctx)[0]!;
    expect(report.verdicts.find((entry) => entry.skill === 'frac.operations')!.verdict).toBe('gap');
    // The test went looking for how deep the gap goes: one prerequisite of fractions was asked as well.
    expect(report.items.some((item) => item.stage === 'prerequisite' && item.anchor === 'frac.operations')).toBe(true);

    // The path starts at the bottom of the gap, and says what it is for.
    const steps = nextSteps(selectionFor(h.ctx), 3);
    expect(steps[0]!.skill.id).toBe('frac.concept');
    expect(steps[0]!.purpose).toBe('repair');
    expect(steps[0]!.forSkill).not.toBeNull();
    // What builds on fractions waits; what does not, does not.
    const map = new Map(curriculum(h.ctx).skills.map((skill) => [skill.id, skill]));
    expect(map.get('frac.operations')!.blockedBy).toBe('frac.concept');
    expect(map.get('pct.basics')!.blockedBy).toBe('frac.concept');
    expect(map.get('geom.angles')!.blockedBy).toBeNull();
    expect(readinessFor(h.ctx).gaps.map((gap) => gap.id)).toContain('frac.concept');

    // A week of practice: fractions come every day, from the easy end, in changing forms.
    const played = study(h, h.ctx, EMA, { days: 6, perDay: 12, seed: 8 });
    const fractions = played.filter((entry) => entry.row.skill.startsWith('frac.'));
    expect(fractions.length).toBeGreaterThanOrEqual(12);
    // With the topic named and hints at hand: this is learning, not testing.
    expect(fractions.every((entry) => entry.row.context === 'blocked')).toBe(true);
    expect(fractions[0]!.row.level).toBe(1);
    const others = played.filter((entry) => !entry.row.skill.startsWith('frac.'));
    expect(mean(fractions.map((entry) => entry.row.level))).toBeLessThan(mean(others.map((entry) => entry.row.level)));
    expect(new Set(fractions.map((entry) => entry.row.source)).size).toBeGreaterThanOrEqual(2);
    // Never the same skill twice running — least of all right after a miss.
    played.forEach((entry, index) => {
      if (index > 0 && played[index - 1]!.row.run_id === entry.row.run_id)
        expect(entry.row.skill).not.toBe(played[index - 1]!.row.skill);
    });
    // Percent, which the examination weighs most, was not pushed at her while fractions were missing:
    // its first problem came after fraction basics had been practised.
    const firstPercent = played.findIndex((entry) => entry.row.skill.startsWith('pct.'));
    const fractionsBefore = played.slice(0, firstPercent < 0 ? played.length : firstPercent);
    expect(fractionsBefore.filter((entry) => entry.row.skill === 'frac.concept').length).toBeGreaterThanOrEqual(2);
  });

  it('3 · a student who repeatedly succeeds progresses to harder material', () => {
    const h = learner();
    playRun(h.ctx, startDiagnostic(h.ctx), VOJTA, createRng(3));
    // Placed by the test, he does not start at the bottom.
    const first = adaptiveSession(h.ctx, VOJTA, createRng(1), 10);
    expect(Math.max(...first.map((entry) => entry.row.level))).toBeGreaterThanOrEqual(2);
    h.advance(2 * DAY);

    const played = [...first, ...study(h, h.ctx, VOJTA, { days: 12, perDay: 12, gapDays: 2, seed: 4 })];
    const third = Math.floor(played.length / 3);
    const early = mean(played.slice(0, third).map((entry) => entry.row.level));
    const late = mean(played.slice(-third).map((entry) => entry.row.level));
    expect(late).toBeGreaterThan(early);
    // Skill by skill: the last problem of a skill is harder than its first, by a level on average.
    const bySkill = new Map<string, number[]>();
    for (const entry of played)
      bySkill.set(entry.row.skill, [...(bySkill.get(entry.row.skill) ?? []), entry.row.level]);
    const climbs = [...bySkill.values()]
      .filter((levels) => levels.length >= 4)
      .map((levels) => levels[levels.length - 1]! - levels[0]!);
    expect(climbs.length).toBeGreaterThanOrEqual(6);
    expect(mean(climbs)).toBeGreaterThan(0.8);
    // Hard problems arrive, and with them the purposes of somebody who is past the basics.
    expect(played.slice(-third).some((entry) => entry.row.level >= 4)).toBe(true);
    const purposes = new Set(played.slice(-third).map((entry) => entry.row.purpose));
    expect(purposes.has('exam') || purposes.has('stretch')).toBe(true);
    // Hidden-topic work appears once skills are familiar: recognising the problem is part of the task.
    expect(played.slice(-third).some((entry) => entry.row.context === 'mixed')).toBe(true);

    const skills = allSkills(h.ctx);
    expect(skills.filter((skill) => skill.level >= 3).length).toBeGreaterThanOrEqual(8);
    expect(skills.some((skill) => skill.level >= 4)).toBe(true);
    expect(readinessFor(h.ctx).verdict).not.toBe('no-data');
  });

  it('4 · a student who guesses correctly does not instantly gain mastery', () => {
    const h = learner();
    // Twelve true/false statements judged correctly over six days: each is a coin flip.
    for (let day = 0; day < 6; day++) {
      solve(h, 'data.tables-charts', { generator: 'data.tables-charts.statements' });
      solve(h, 'data.tables-charts', { generator: 'data.tables-charts.statements' });
      h.advance(3 * DAY);
    }
    const coin = stateOfSkill(h.ctx, 'data.tables-charts')!;
    expect(coin.attempts).toBe(12);
    expect(coin.solved).toBe(12);
    expect(coin.guessed).toBe(12);
    expect(coin.unaided).toBe(0);
    expect(levelOf(coin)).toBeLessThanOrEqual(3);
    expect(
      gatesFor(coin, 4)
        .filter((gate) => !gate.done)
        .map((gate) => gate.key),
    ).toEqual(expect.arrayContaining(['mixed', 'delay', 'hard', 'variety']));

    // Typed answers, all right, each declared a guess: honest, and not evidence for a level either.
    for (let i = 0; i < 8; i++) {
      solve(h, 'eqn.linear', { confidence: 'guess' });
      h.advance(3 * DAY);
    }
    const declared = stateOfSkill(h.ctx, 'eqn.linear')!;
    expect(declared.guessed).toBe(8);
    expect(levelOf(declared)).toBeLessThanOrEqual(3);

    // Five options, one sitting, one family: a lucky run moves the estimate less than typed answers do.
    const typed = learner();
    for (let i = 0; i < 6; i++) {
      solve(h, 'pct.basics', { generator: 'pct.basics.choice', level: 3 });
      solve(typed, 'pct.basics', { generator: 'pct.basics.three-types', level: 3 });
    }
    const chosen = stateOfSkill(h.ctx, 'pct.basics')!;
    expect(chosen.theta).toBeLessThan(stateOfSkill(typed.ctx, 'pct.basics')!.theta);
    expect(levelOf(chosen)).toBeLessThanOrEqual(3);
    // What the map shows for it is not "mastered", and it says how sure it is.
    const shown = allSkills(h.ctx).find((skill) => skill.id === 'pct.basics')!;
    expect(shown.path).not.toBe('mastered');
    expect(shown.confidence).toBe('low');
  });

  it('5 · a previously mastered skill returns for review when appropriate', () => {
    const h = learner();
    skipDiagnostic(h.ctx);
    master(h, 'eqn.linear');
    const shown = (): ReturnType<typeof allSkills>[number] =>
      allSkills(h.ctx).find((skill) => skill.id === 'eqn.linear')!;

    // Fresh: mastered, nothing due, and the selection leaves it alone.
    h.setTime(stateOfSkill(h.ctx, 'eqn.linear')!.lastPracticedAt! + MINUTE);
    expect(shown().path).toBe('mastered');
    expect(selectionFor(h.ctx).scored.find((entry) => entry.id === 'eqn.linear')!.score).toBe(0);

    // Months later the review is due: the state says so, and the selection brings it back.
    h.setTime(stateOfSkill(h.ctx, 'eqn.linear')!.card!.due + 3 * DAY);
    expect(shown().path).toBe('needs-review');
    expect(shown().pathReason).toBe('review-due');
    expect(shown().level).toBe(5);
    const entry = selectionFor(h.ctx).scored.find((scored) => scored.id === 'eqn.linear')!;
    expect(entry.purpose).toBe('review');
    expect(entry.terms.review).toBeGreaterThan(0.6);
    expect(getPlan(h.ctx).blocks.find((block) => block.kind === 'adaptive')!.reason.data.due).toBe(1);

    // It is asked with the topic hidden, and passing it is recorded as a review passed.
    const played = adaptiveSession(h.ctx, VOJTA, createRng(2), 8);
    const review = played.find((item) => item.row.skill === 'eqn.linear')!;
    expect(review).toBeDefined();
    expect(review.row.purpose).toBe('review');
    expect(review.row.context).toBe('mixed');
    if (review.right) {
      expect(review.row.review_passed).toBe(1);
      expect(shown().path).toBe('mastered');
    }

    // Analytics and the readiness report count the same thing as a review: an attempt on a
    // skill whose scheduled review had come due, as the learner model counted it.
    const counted = [...loadStates(h.ctx).values()].reduce(
      (sum, state) => sum + state.reviews.passed + state.reviews.failed,
      0,
    );
    expect(counted).toBeGreaterThan(0);
    const totals = analytics(h.ctx).totals;
    expect(totals.reviewsPassed + totals.reviewsFailed).toBe(counted);
    expect(readinessFor(h.ctx).retention.evidence).toBe(counted);
  });

  it('6 · a student who makes repeated sign errors receives targeted practice', () => {
    const h = learner();
    skipDiagnostic(h.ctx);
    const rng = createRng(6);
    // Klára works on integers and on expressions, and every miss is a lost sign where the problem knows that mistake.
    for (const skill of ['num.integers', 'expr.polynomials', 'num.integers']) {
      playRun(h.ctx, startRun(h.ctx, { context: 'blocked', concept: skill, count: 6 }), KLARA, rng, (_row, index) =>
        index % 2 === 0 ? false : undefined,
      );
      h.advance(DAY);
    }
    const signs = h.db
      .prepare(`SELECT COUNT(*) AS n FROM problems WHERE error_inferred = 'sign' AND error_basis = 'misconception'`)
      .get() as { n: number };
    expect(signs.n).toBeGreaterThanOrEqual(3);

    // The pattern is recognised…
    const focus = errorFocus(h.ctx)!;
    expect(focus.type).toBe('sign');
    // …the day's plan gives it a block of its own…
    const drill = regeneratePlan(h.ctx, 45).blocks.find((block) => block.kind === 'drill')!;
    expect(drill).toBeDefined();
    expect(drill.errorType).toBe('sign');
    // …and that block serves problems in which a sign can go wrong, from skills she has worked on.
    const started = startBlock(h.ctx, drill.id) as StartRunResponse;
    expect(started.run.context).toBe('drill');
    const drilled = playRun(h.ctx, started, VOJTA, createRng(1));
    expect(drilled.length).toBeGreaterThanOrEqual(4);
    const inGoal = new Set(conceptsOfGoal('jpz-9').map((concept) => concept.id));
    for (const item of drilled) {
      expect(inGoal.has(item.row.skill)).toBe(true);
      const generator = generatorsFor(item.row.skill).find((candidate) => candidate.id === item.row.source)!;
      const canGoWrongBySign = [1, 2, 3, 4, 5, 6].some((seed) =>
        generator.levels.some((level) => {
          const instance = generator.generate(createRng(seed * 7919 + level), level);
          return (
            (instance.misconceptions ?? []).some((entry) => entry.error === 'sign') ||
            (instance.answer.kind === 'spot' && instance.answer.errorType === 'sign')
          );
        }),
      );
      expect(canGoWrongBySign, item.row.source).toBe(true);
    }
    // A label the model merely defaulted to would not have done this: Ema's misses are no pattern.
    const other = learner();
    skipDiagnostic(other.ctx);
    playRun(
      other.ctx,
      startRun(other.ctx, { context: 'blocked', concept: 'geom.angles', count: 8 }),
      EMA,
      rng,
      () => false,
    );
    expect(errorFocus(other.ctx)).toBeNull();
  });

  it('7 · a single careless mistake does not destroy a mastery estimate', () => {
    const h = learner();
    master(h, 'eqn.linear');
    const before = stateOfSkill(h.ctx, 'eqn.linear')!;

    // One wrong answer, on a problem she was all but certain to solve.
    const row = issueProblem(h.ctx, { skill: 'eqn.linear', context: 'mixed', level: 2 });
    const answer = { input: wrongInput(row), seconds: row.est_seconds };
    let result: AnswerResultDto = submitAnswer(h.ctx, row.id, answer);
    while (!result.resolved) result = submitAnswer(h.ctx, row.id, answer);
    const after = stateOfSkill(h.ctx, 'eqn.linear')!;
    const resolved = getProblemRow(h.ctx, row.id);

    // The app's reading of it: most likely a slip, and it says so without certainty.
    expect(resolved.error_inferred).toBe('arithmetic');
    expect(resolved.error_basis).toBe('model');
    // The estimate gives a little; the level, the mastery and the path state stay.
    expect(after.theta).toBeLessThan(before.theta);
    expect(before.theta - after.theta).toBeLessThan(0.6);
    expect(levelOf(after)).toBe(5);
    expect(resolved.level_after).toBe(5);
    const shown = allSkills(h.ctx).find((skill) => skill.id === 'eqn.linear')!;
    expect(shown.level).toBe(5);
    // What it does change: the skill is looked at again soon.
    expect(['needs-review', 'mastered']).toContain(shown.path);
    expect(after.card!.due).toBeLessThan(before.card!.due);
    // The attempt itself is kept as it happened.
    expect(h.db.prepare('SELECT COUNT(*) AS n FROM attempts WHERE problem_id = ?').get(row.id)).toEqual({
      n: resolved.wrong_attempts,
    });
  });

  it('8 · a student can demonstrate mastery on differently worded problems — and only so', () => {
    const h = learner();
    const skill = 'frac.operations';
    expect(familyCountOf(skill)).toBeGreaterThanOrEqual(3);
    const families = generatorsFor(skill).filter((generator) => generator.kind !== 'debug');
    const one = families.find((generator) => generator.levels.includes(4)) ?? families[0]!;
    const top = Math.max(...one.levels) as Level;

    // The same kind of problem, solved again and again over three months.
    for (let i = 0; i < 12; i++) {
      solve(h, skill, { generator: one.id, level: i % 2 === 0 ? top : (Math.max(1, top - 1) as Level) });
      h.advance(8 * DAY);
    }
    const narrow = stateOfSkill(h.ctx, skill)!;
    expect(narrow.families).toEqual([one.id]);
    // Everything else the upper levels ask for is there. Variety is not.
    expect(levelOf(narrow)).toBe(3);
    expect(
      gatesFor(narrow, 4)
        .filter((gate) => !gate.done)
        .map((gate) => gate.key),
    ).toEqual(['variety']);
    const detail = conceptDetail(h.ctx, skill);
    expect(detail.next!.gates.find((gate) => gate.key === 'variety')).toMatchObject({ done: false, have: 1, need: 2 });
    expect(detail.record).toMatchObject({ families: 1, familyCap: familyCountOf(skill) });

    // The same skill in another wording: proficient. In a third: mastered.
    const others = families.filter((generator) => generator.id !== one.id);
    solve(h, skill, { generator: others[0]!.id });
    expect(levelOf(stateOfSkill(h.ctx, skill)!)).toBe(4);
    h.advance(8 * DAY);
    solve(h, skill, { generator: others[1]!.id });
    const broad = stateOfSkill(h.ctx, skill)!;
    expect(broad.families).toHaveLength(3);
    expect(levelOf(broad)).toBe(5);
  });

  it('9 · the exercise selector avoids repeatedly serving the same exercise', () => {
    const h = learner();
    playRun(h.ctx, startDiagnostic(h.ctx), VOJTA, createRng(3));
    const played: Played[] = [];
    for (let session = 0; session < 3; session++) played.push(...adaptiveSession(h.ctx, VOJTA, createRng(session), 14));

    const prompts = new Set<string>();
    const instances = new Set<string>();
    played.forEach((entry, index) => {
      const previous = played[index - 1];
      if (previous && previous.row.run_id === entry.row.run_id) {
        // Not the same skill twice running, and so not the same kind of problem either.
        expect(entry.row.skill).not.toBe(previous.row.skill);
        expect(entry.row.source).not.toBe(previous.row.source);
      }
      instances.add(`${entry.row.source}#${entry.row.seed}`);
      prompts.add(snapshotOf(entry.row).prompt.cs);
    });
    // No problem was issued twice, and no skill more often than a session allows.
    expect(instances.size).toBe(played.length);
    expect(prompts.size).toBeGreaterThanOrEqual(played.length - 2);
    for (const run of new Set(played.map((entry) => entry.row.run_id))) {
      const counts = new Map<string, number>();
      for (const entry of played.filter((item) => item.row.run_id === run))
        counts.set(entry.row.skill, (counts.get(entry.row.skill) ?? 0) + 1);
      expect(Math.max(...counts.values())).toBeLessThanOrEqual(4);
      expect(counts.size).toBeGreaterThanOrEqual(5);
    }

    // Practising one skill on purpose: the families take turns as far as the skill has them.
    const blocked = playRun(
      h.ctx,
      startRun(h.ctx, { context: 'blocked', concept: 'geom.angles', count: 8 }),
      VOJTA,
      createRng(9),
    );
    for (let i = 1; i < blocked.length; i++) {
      // The same family twice running only where the level leaves no other choice.
      if (blocked[i]!.row.source === blocked[i - 1]!.row.source) {
        const atLevel = generatorsFor('geom.angles').filter((generator) =>
          generator.levels.includes(blocked[i]!.row.level as Level),
        );
        expect(atLevel).toHaveLength(1);
      }
    }
    expect(new Set(blocked.map((entry) => entry.row.source)).size).toBeGreaterThanOrEqual(2);
    expect(new Set(blocked.map((entry) => `${entry.row.source}#${entry.row.seed}`)).size).toBe(blocked.length);
  });

  it('10 · the selector works on its own exercises when external services are unavailable', async () => {
    // No network at all: anything that tried to reach out would throw.
    const fetch = vi.fn(() => {
      throw new Error('no network in this test');
    });
    vi.stubGlobal('fetch', fetch);
    const h = learner();
    // The optional AI tutor is off, and nothing here depends on it.
    expect((await h.get<{ tutor: { enabled: boolean } }>('/api/me')).body.tutor.enabled).toBe(false);

    const diagnostic = playRun(h.ctx, startDiagnostic(h.ctx), EMA, createRng(1));
    const session = adaptiveSession(h.ctx, EMA, createRng(2), 10);
    const exam = createExam(h.ctx, { blueprint: 'jpz-9-practice' });
    finishExam(h.ctx, exam.id);
    const home = await h.get<DashboardDto>('/api/dashboard');
    expect(home.status).toBe(200);
    expect(home.body.forge.configured).toBe(false);

    // Every problem came from the content shipped with the app: a generator of its own, with a seed.
    for (const entry of [...diagnostic, ...session]) {
      expect(entry.row.source_kind).toBe('generator');
      expect(generatorsFor(entry.row.skill).some((generator) => generator.id === entry.row.source)).toBe(true);
    }
    expect(exam.items).toHaveLength(29);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('15 · timed tests and untimed practice produce appropriately distinct metrics', () => {
    const h = learner();
    playRun(h.ctx, startDiagnostic(h.ctx), VOJTA, createRng(3));
    study(h, h.ctx, VOJTA, { days: 3, perDay: 12, seed: 2 });
    const untimedBefore = analytics(h.ctx).timed;
    expect(untimedBefore.timed.problems).toBe(0);
    expect(untimedBefore.untimed.problems).toBe(36);
    expect(readinessFor(h.ctx).timed).toMatchObject({ value: null, count: 0, last: null });
    expect([...loadStates(h.ctx).values()].every((state) => state.timed.attempts === 0)).toBe(true);

    // A timed practice test: every second task answered correctly, the rest left empty.
    const exam = createExam(h.ctx, { blueprint: 'jpz-9-practice' });
    expect(exam.minutes).toBe(63);
    exam.items.forEach((item, index) => {
      if (index % 2 === 0) saveExamAnswer(h.ctx, exam.id, index, rightInput(getProblemRow(h.ctx, item.problem.id)), 60);
    });
    h.advance(50 * MINUTE);
    const finished = finishExam(h.ctx, exam.id);
    const answered = Math.ceil(exam.items.length / 2);

    const figures = analytics(h.ctx).timed;
    // The test's problems are counted as timed, and nowhere else; untimed practice is untouched by it.
    expect(figures.timed.problems).toBe(answered);
    expect(figures.timed.accuracy).toBe(1);
    expect(figures.untimed).toEqual(untimedBefore.untimed);
    const timedStates = [...loadStates(h.ctx).values()].reduce((sum, state) => sum + state.timed.attempts, 0);
    expect(timedStates).toBe(answered);
    // Readiness reports the test as a result of its own: points out of what a screen allows.
    const ready = readinessFor(h.ctx);
    expect(ready.timed.count).toBe(1);
    expect(ready.timed.last).toMatchObject({ maxPoints: 45, examPoints: 50, minutesAllowed: 63 });
    expect(ready.timed.value).toBeCloseTo(finished.report!.points / 45, 5);
    // The practice figures of the readiness report did not move because a test was taken…
    expect(finished.report!.maxPoints).toBe(45);
    expect(finished.report!.grade).toBeNull();
    // …and the contexts are kept apart in the breakdown as well.
    const contexts = Object.fromEntries(analytics(h.ctx).contexts.map((entry) => [entry.context, entry.problems]));
    expect(contexts.exam).toBe(answered);
    expect(contexts.diagnostic).toBeGreaterThan(0);
  });

  it('16 · missing data does not cause false claims of examination readiness', () => {
    const h = learner();
    const empty = readinessFor(h.ctx);
    expect(empty.verdict).toBe('no-data');
    for (const part of [empty.coverage, empty.mastery, empty.familiar, empty.retention, empty.timed, empty.unfamiliar])
      expect(part.value).toBeNull();
    expect(empty.gaps).toEqual([]);
    // The part that cannot be practised here is stated, not silently counted as covered.
    expect(empty.paperOnlyWeight).toBeGreaterThan(0.1);
    expect(empty.provisional).toBe(false);
    expect(readinessFor(learner('jpz-5').ctx).provisional).toBe(true);
    // No timed test is proposed to somebody the app knows nothing about.
    expect(getPlan(h.ctx).blocks.some((block) => block.kind === 'mock')).toBe(false);

    // A placement test alone: there is evidence now, and still no claim about mastery.
    playRun(h.ctx, startDiagnostic(h.ctx), VOJTA, createRng(3), () => true);
    const placed = readinessFor(h.ctx);
    expect(placed.verdict).toBe('building');
    expect(placed.coverage.value).toBe(0);
    expect(placed.mastery.value).toBeNull();
    expect(placed.familiar.value).toBeNull();
    expect(placed.retention.value).toBeNull();
    expect(placed.unfamiliar.value).toBeNull();
    // Every answer was right, and nothing is called a gap.
    expect(placed.gaps).toEqual([]);
    expect(getPlan(h.ctx).blocks.some((block) => block.kind === 'mock')).toBe(false);

    // One perfect session does not make a verdict either.
    adaptiveSession(h.ctx, VOJTA, createRng(1), 12);
    expect(readinessFor(h.ctx).verdict).not.toBe('test-ready');
    const home = dashboard(h.ctx);
    expect(home.entrance!.readiness.verdict).not.toBe('test-ready');
    // Nothing anywhere is a single percentage of passing.
    expect(Object.keys(home.entrance!.readiness)).not.toContain('probability');
  });
});

describe('persistence', () => {
  it('14 · mastery and progress survive application restarts', async () => {
    const fs = await import('node:fs');
    const os = await import('node:os');
    const path = await import('node:path');
    const { prepareDatabase } = await import('../src/accounts');
    const { loadConfig } = await import('../src/config');
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lemma-restart-'));
    try {
      const config = loadConfig({ DATA_DIR: dir, LEMMA_TIMEZONE: 'Europe/Prague', AUTH_DISABLED: '1' });
      let clock = Date.UTC(2026, 9, 7, 14, 0, 0);
      const now = (): number => clock;
      const file = path.join(dir, 'lemma.sqlite');

      let db = await prepareDatabase(file, config, now);
      let ctx: Ctx = { db, config, now };
      withGoal(ctx, 'jpz-9', { examDay: '2027-04-12' });
      const shim = { advance: (ms: number) => (clock += ms) } as unknown as Harness;
      playRun(ctx, startDiagnostic(ctx), EMA, createRng(3));
      study(shim, ctx, EMA, { days: 4, perDay: 10, seed: 5 });
      createAssignment(ctx, 'admin', { kind: 'practice', skills: ['geom.angles'], minutes: 10 });

      const snapshot = (target: Ctx) => ({
        skills: allSkills(target),
        states: target.db.prepare('SELECT skill, state FROM skill_state ORDER BY skill').all(),
        readiness: readinessFor(target),
        diagnostics: listDiagnostics(target),
        plan: getPlan(target),
        settings: getSettings(target),
        problems: (target.db.prepare('SELECT COUNT(*) AS n FROM problems').get() as { n: number }).n,
      });
      const before = snapshot(ctx);
      expect(before.problems).toBeGreaterThan(50);
      expect(before.skills.some((skill) => skill.level >= 2)).toBe(true);

      // Stop the application: the database is closed and nothing is kept in memory.
      db.pragma('wal_checkpoint(TRUNCATE)');
      db.close();
      db = await prepareDatabase(file, config, now);
      ctx = { db, config, now };
      expect(snapshot(ctx)).toEqual(before);

      // The stored states are a cache of the log: rebuilding them from the log changes nothing.
      replayAll(ctx);
      expect(snapshot(ctx).states).toEqual(before.states);
      expect(snapshot(ctx).skills).toEqual(before.skills);
      db.close();
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('upgrading', () => {
  it('brings a database of the previous version along, with everything in it', async () => {
    const fs = await import('node:fs');
    const os = await import('node:os');
    const path = await import('node:path');
    const { prepareDatabase } = await import('../src/accounts');
    const { loadConfig } = await import('../src/config');
    const { openDatabase, schemaVersion } = await import('../src/db');
    const { MIGRATIONS } = await import('../src/db/migrations');
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lemma-upgrade-'));
    try {
      // A database as the accounts release left it: schema 2, a learner model computed
      // under the rules of that time, and problems without the columns added since.
      const file = path.join(dir, 'lemma.sqlite');
      const old = openDatabase(file);
      for (const migration of MIGRATIONS.filter((entry) => entry.id <= 2)) old.exec(migration.sql);
      old.pragma('user_version = 2');
      const school = GENERATORS.filter((generator) => getConcept(generator.concept)!.track !== 'basic');
      const sample = (kind: 'choice' | 'number') => {
        for (const generator of school) {
          const level = generator.levels[0]!;
          const instance = generator.generate(createRng(11), level);
          const answer = instance.answer;
          if (answer.kind === kind && !(answer.kind === 'choice' && answer.multi))
            return { generator, level, instance };
        }
        throw new Error(`no school generator with a ${kind} answer`);
      };
      const chosen = sample('choice');
      const typed = sample('number');
      const at = Date.UTC(2026, 9, 1, 10, 0, 0);
      const insert = old.prepare(
        `INSERT INTO problems (id, skill, source, source_kind, seed, level, kind, context, snapshot, est_seconds, issued_at, day,
                               status, first_try, resolved_at, seconds, predicted, credit, points, level_before, level_after)
         VALUES (?, ?, ?, 'generator', 11, ?, ?, 'blocked', ?, 60, ?, '2026-10-01', 'solved', 1, ?, 50, 0.5, 1, 3, 0, 1)`,
      );
      [chosen, typed, typed, chosen].forEach((entry, index) => {
        const { verify: _verify, ...stored } = entry.instance;
        insert.run(
          `old-${index}`,
          entry.generator.concept,
          entry.generator.id,
          entry.level,
          entry.generator.kind,
          JSON.stringify(stored),
          at + index * 1000,
          at + index * 1000 + 500,
        );
      });
      const setting = old.prepare('INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)');
      setting.run('profile', JSON.stringify({ name: 'Jonáš', currentTopic: 3, sessionMinutes: 45 }), at);
      setting.run('onboarded', 'true', at);
      setting.run('model_marker', JSON.stringify('model 2 · content 2026.10.1'), at);
      old
        .prepare(
          'INSERT INTO skill_state (skill, state, level, theta, due_at, updated_at) VALUES (?, ?, 1, 0.3, NULL, ?)',
        )
        .run(
          typed.generator.concept,
          JSON.stringify({ skill: typed.generator.concept, attempts: 2, theta: 0.3, level: 1 }),
          at,
        );
      old.close();

      const config = loadConfig({ DATA_DIR: dir, LEMMA_TIMEZONE: 'Europe/Prague', AUTH_DISABLED: '1' });
      const now = (): number => at + 5 * DAY;
      const db = await prepareDatabase(file, config, now);
      const ctx: Ctx = { db, config, now };

      // The schema moved on, and a copy of the database as it was is kept beside it.
      expect(schemaVersion(db)).toBe(3);
      expect(fs.readdirSync(path.join(dir, 'backups'))).toEqual([`lemma-before-schema-3-${now()}.sqlite`]);
      // Nothing of the log was lost, and the new column was filled in from what each problem was.
      const rows = db.prepare('SELECT id, chance, purpose FROM problems ORDER BY id').all() as {
        id: string;
        chance: number;
        purpose: null;
      }[];
      expect(rows).toHaveLength(4);
      const options = (chosen.instance.answer as { options: unknown[] }).options.length;
      expect(rows.map((row) => row.chance)).toEqual([1 / options, 0, 0, 1 / options]);
      expect(rows.every((row) => row.purpose === null)).toBe(true);
      // The learner model was rebuilt under the present rules: the stale state is gone.
      const states = loadStates(ctx);
      const rebuilt = states.get(typed.generator.concept)!;
      expect(rebuilt.attempts).toBe(typed.generator.concept === chosen.generator.concept ? 4 : 2);
      expect(rebuilt.families).toEqual(expect.arrayContaining([typed.generator.id]));
      expect(rebuilt.days).toBe(1);
      expect(db.prepare(`SELECT value FROM settings WHERE key = 'model_marker'`).get()).toEqual({
        value: expect.stringContaining('model 3'),
      });
      // The settings read as before, with the defaults of what is new: the school goal, no examination.
      expect(getSettings(ctx)).toMatchObject({
        name: 'Jonáš',
        currentTopic: 3,
        sessionMinutes: 45,
        goal: 'school-it-2',
        examDay: null,
        inSchool: [],
      });
      // And the application works on it as it did: the same 65 skills, a plan, a home screen.
      expect(allSkills(ctx)).toHaveLength(65);
      expect(getPlan(ctx).blocks.length).toBeGreaterThan(0);
      const home = dashboard(ctx);
      expect(home.totals.problems).toBe(4);
      expect(home.entrance).toBeNull();
      expect(home.fit).not.toBeNull();
      for (const table of ['teaching', 'assignments', 'focus', 'diagnostics', 'student_notes', 'teach_sessions'])
        expect(db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get(), table).toEqual({ n: 0 });
      // Opening it again changes nothing more.
      db.close();
      const again = await prepareDatabase(file, config, now);
      expect(fs.readdirSync(path.join(dir, 'backups'))).toHaveLength(1);
      expect(again.prepare('SELECT COUNT(*) AS n FROM problems').get()).toEqual({ n: 4 });
      again.close();
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('the placement test', () => {
  it('says nothing about an answer until it is over', async () => {
    const h = learner();
    const plan = getPlan(h.ctx);
    expect(plan.blocks[0]).toMatchObject({ id: 'diagnostic', kind: 'diagnostic', status: 'todo' });

    const started = (await h.send<StartRunResponse>('POST', '/api/diagnostic/start')).body;
    expect(started.run).toMatchObject({ context: 'diagnostic', finished: false });
    expect(started.run.diagnostic).not.toBeNull();
    const first = started.problem!;
    // The topic is hidden, there are no hints, and there is one answer.
    expect(first).toMatchObject({
      concept: null,
      conceptTitle: null,
      context: 'diagnostic',
      hintCount: 0,
      triesLeft: 1,
    });
    expect((await h.send('POST', `/api/problems/${first.id}/hint`)).status).toBe(403);

    // A wrong answer is taken exactly like a right one.
    const wrong = await h.send<AnswerResultDto>('POST', `/api/problems/${first.id}/answer`, {
      input: wrongInput(getProblemRow(h.ctx, first.id)),
      seconds: 40,
    });
    expect(wrong.body).toMatchObject({ verdict: 'recorded', resolved: true, error: null });
    expect(wrong.body.problem).toMatchObject({ status: 'recorded', outcome: null, concept: null, wrongAttempts: 0 });
    expect(JSON.stringify(wrong.body)).not.toContain('solution":[');
    // Asking for the problem again tells no more.
    const again = await h.get<{ status: string; outcome: unknown }>(`/api/problems/${first.id}`);
    expect(again.body).toMatchObject({ status: 'recorded', outcome: null });
    // The plan knows the test is under way, and "start" goes on with it.
    expect(getPlan(h.ctx).blocks[0]).toMatchObject({ status: 'active' });

    const second = (await h.send<StartRunResponse>('POST', `/api/runs/${started.run.id}/next`)).body.problem!;
    expect(second.id).not.toBe(first.id);
    expect((await h.send<StartRunResponse>('POST', '/api/diagnostic/start')).body.problem!.id).toBe(second.id);
    // "I do not know this" is always there, and is recorded as such — the solution waits for the end.
    const skipped = await h.send<{ status: string; outcome: unknown }>('POST', `/api/problems/${second.id}/reveal`, {});
    expect(skipped.body).toMatchObject({ status: 'recorded', outcome: null });
    // While it runs, the record of the test shows nothing.
    const during = listDiagnostics(h.ctx);
    expect(during).toEqual([]);

    // Finish it.
    let step = nextInRun(h.ctx, started.run.id);
    const rng = createRng(4);
    while (step.problem) {
      play(h.ctx, step.problem, VOJTA, rng, true);
      step = nextInRun(h.ctx, started.run.id);
    }
    expect(step.run.finished).toBe(true);
    const report = listDiagnostics(h.ctx)[0]!;
    expect(report.items.length).toBeLessThanOrEqual(18);
    expect(report.items[0]).toMatchObject({ problemId: first.id, stage: 'anchor', outcome: 'wrong' });
    expect(report.items[1]).toMatchObject({ problemId: second.id, outcome: 'skipped' });
    expect(report.counts).toMatchObject({ asked: report.items.length, skipped: 1 });
    // One wrong answer settled nothing: the skill was asked again, easier, and that decided.
    const anchor = report.items[0]!.skill;
    const followUp = report.items.find((item) => item.anchor === anchor && item.stage === 'second-chance')!;
    expect(followUp).toBeDefined();
    expect(followUp.level).toBeLessThan(report.items[0]!.level);
    expect(report.verdicts.find((entry) => entry.skill === anchor)!.verdict).toBe('shaky');
    // Now the solutions can be read.
    const reviewed = await h.get<{ status: string; outcome: { solved: boolean } | null }>(`/api/problems/${first.id}`);
    expect(reviewed.body.status).toBe('failed');
    expect(reviewed.body.outcome).toMatchObject({ solved: false });

    // The plan moves on by itself: placed, it now offers the adaptive session.
    const after = getPlan(h.ctx);
    expect(after.blocks.some((block) => block.kind === 'diagnostic')).toBe(false);
    expect(after.blocks[0]!.kind).toBe('adaptive');
    expect(diagnosticStatus(h.ctx)).toMatchObject({ done: true, count: 1, running: null });
  });

  it('places the skills it did not ask, cautiously, and lets practice overrule it', () => {
    const h = learner();
    playRun(h.ctx, startDiagnostic(h.ctx), VOJTA, createRng(3), () => true);
    const report = listDiagnostics(h.ctx)[0]!;
    expect(report.verdicts.every((entry) => entry.verdict === 'strong' || entry.verdict === 'sound')).toBe(true);
    expect(report.presumed.length).toBeGreaterThan(3);
    expect(report.presumed.every((entry) => entry.direction === 'up')).toBe(true);

    const skills = new Map(allSkills(h.ctx).map((skill) => [skill.id, skill]));
    const presumed = report.presumed[0]!.id;
    // Presumed, not proven: the state is "diagnosed", the level is still zero, the confidence low.
    expect(skills.get(presumed)).toMatchObject({ path: 'diagnosed', pathReason: 'placed-high', level: 0, attempts: 0 });
    expect(skills.get(presumed)!.confidence).toBe('low');
    expect(skills.get(report.items[0]!.skill)!.path).toBe('diagnosed');
    // What was neither asked nor implied is still untouched.
    expect([...skills.values()].some((skill) => skill.path === 'not-started')).toBe(true);
    // A placed skill starts above the bottom…
    const first = issueProblem(h.ctx, { skill: presumed, context: 'blocked', byEstimate: true });
    expect(first.level).toBeGreaterThanOrEqual(2);
    // …and its own first answer replaces the presumption.
    expect(stateOfSkill(h.ctx, presumed)!.placement).not.toBeNull();
    submitAnswer(h.ctx, first.id, { input: rightInput(first), seconds: 30 });
    const own = stateOfSkill(h.ctx, presumed)!;
    expect(own.placement).toBeNull();
    expect(own.attempts).toBe(1);

    // The placement is part of the log: rebuilding the model reproduces it.
    const stored = h.db.prepare('SELECT skill, state FROM skill_state ORDER BY skill').all();
    replayAll(h.ctx);
    expect(h.db.prepare('SELECT skill, state FROM skill_state ORDER BY skill').all()).toEqual(stored);
  });

  it('can be declined, and repeated to see the development', () => {
    const h = learner();
    skipDiagnostic(h.ctx);
    expect(getPlan(h.ctx).blocks.some((block) => block.kind === 'diagnostic')).toBe(false);
    expect(diagnosticStatus(h.ctx)).toMatchObject({ done: false, skipped: true });
    // Declined is not forbidden.
    playRun(h.ctx, startDiagnostic(h.ctx), EMA, createRng(3));
    h.advance(30 * DAY);
    playRun(h.ctx, startDiagnostic(h.ctx), VOJTA, createRng(3), () => true);
    const both = listDiagnostics(h.ctx);
    expect(both).toHaveLength(2);
    expect(both[0]!.finishedAt!).toBeGreaterThan(both[1]!.finishedAt!);
    expect(both[0]!.counts.correct).toBeGreaterThan(both[1]!.counts.correct);
    // The school goal has no placement test, and says so.
    const school = harness();
    expect(() => startDiagnostic(school.ctx)).toThrow(/no placement test/);
  });
});

describe('goals', () => {
  it('scopes every view to the learner goal, and leaves the school goal as it was', async () => {
    const school = harness();
    const schoolGraph = (await school.get<GraphDto>('/api/graph')).body;
    expect(schoolGraph.skills).toHaveLength(65);
    expect(schoolGraph.skills.every((skill) => skill.track !== 'basic' && skill.role === null)).toBe(true);
    expect(schoolGraph.topics).toHaveLength(17);
    const schoolHome = (await school.get<DashboardDto>('/api/dashboard')).body;
    expect(schoolHome.goal).toMatchObject({ id: 'school-it-2', kind: 'school' });
    expect(schoolHome.entrance).toBeNull();
    expect(schoolHome.fit).not.toBeNull();
    expect(schoolHome.plan.blocks.every((block) => block.kind !== 'adaptive' && block.kind !== 'diagnostic')).toBe(
      true,
    );

    const h = learner('jpz-7');
    const graph = (await h.get<GraphDto>('/api/graph')).body;
    expect(graph.skills).toHaveLength(conceptsOfGoal('jpz-7').length);
    expect(graph.skills.every((skill) => skill.track === 'basic' && skill.role !== null)).toBe(true);
    expect(graph.topics).toEqual([]);
    const construction = graph.skills.find((skill) => skill.id === 'geom.constructions')!;
    expect(construction).toMatchObject({ paperOnly: true, hasProblems: false, role: 'tested' });
    expect(construction.weight).toBeCloseTo(goalSkillOf('jpz-7', 'geom.constructions')!.weight, 6);
    const home = (await h.get<DashboardDto>('/api/dashboard')).body;
    expect(home.fit).toBeNull();
    expect(home.entrance).not.toBeNull();
    expect(home.entrance!.readiness.goal).toBe('jpz-7');

    // The goal, the date and what the class is on are settings like any other, validated.
    const saved = updateSettings(h.ctx, {
      examDay: '2027-04-14',
      inSchool: ['pct.basics', 'quad.vertex', 'nonsense', 'pct.basics'],
    });
    expect(saved.examDay).toBe('2027-04-14');
    expect(saved.inSchool).toEqual(['pct.basics']);
    expect(updateSettings(h.ctx, { goal: 'not-a-goal', examDay: '14. 4. 2027' })).toMatchObject({
      goal: 'jpz-7',
      examDay: '2027-04-14',
    });
    expect(readinessFor(h.ctx)).toMatchObject({ examDay: '2027-04-14', provisional: true });
    expect(readinessFor(h.ctx).daysLeft).toBe(189);
    // What the class is on is pushed forward, and the reason is named.
    const inSchool = selectionFor(h.ctx).scored.find((entry) => entry.id === 'pct.basics')!;
    expect(inSchool.terms.school).toBeGreaterThan(0);
    // Changing the goal changes the map; nothing of the log is touched.
    solve(h, 'pct.basics');
    updateSettings(h.ctx, { goal: 'jpz-5' });
    expect(allSkills(h.ctx).some((skill) => skill.id === 'pct.basics')).toBe(true);
    expect(allSkills(h.ctx)).toHaveLength(conceptsOfGoal('jpz-5').length);
    expect(getSettings(h.ctx).inSchool).toEqual(['pct.basics']);
    updateSettings(h.ctx, { goal: 'school-it-2' });
    expect(getSettings(h.ctx).inSchool).toEqual([]);
    expect((h.db.prepare('SELECT COUNT(*) AS n FROM problems').get() as { n: number }).n).toBe(1);
  });

  it('offers an adaptive session for the school goal as well', () => {
    const h = harness();
    const played = adaptiveSession(h.ctx, VOJTA, createRng(1), 8);
    expect(played).toHaveLength(8);
    expect(played.every((entry) => getConcept(entry.row.skill)!.track !== 'basic')).toBe(true);
    expect(played.every((entry) => entry.row.purpose !== null)).toBe(true);
  });
});

describe('practice tests of an examination', () => {
  it('follow its structure and score its bundles', async () => {
    const h = learner();
    const offered = (await h.get<{ id: string; kind: string }[]>('/api/exam-blueprints')).body;
    expect(offered.map((blueprint) => blueprint.id)).toEqual(['quick-check', 'jpz-9-practice']);

    const exam = (await h.send<ExamDto>('POST', '/api/exams', { blueprint: 'jpz-9-practice' })).body;
    expect(exam.structure).toMatchObject({ examPoints: 50, onScreenPoints: 45, offScreenPoints: 5 });
    expect(exam.items).toHaveLength(29);
    expect(exam.items.map((item) => item.slot!.label).slice(0, 4)).toEqual(['1', '2.1', '2.2', '3.1']);
    // The formats are the examination's: typed answers, five options, true/false, six options.
    const byFormat = (format: string) => exam.items.filter((item) => item.slot!.format === format);
    expect(byFormat('choice')).toHaveLength(3);
    expect(byFormat('truefalse')).toHaveLength(3);
    expect(byFormat('matching')).toHaveLength(3);
    for (const item of byFormat('choice')) expect(item.problem.answer).toMatchObject({ kind: 'choice', multi: false });
    for (const item of byFormat('choice'))
      expect((item.problem.answer as { options: unknown[] }).options).toHaveLength(5);
    for (const item of byFormat('truefalse'))
      expect((item.problem.answer as { options: unknown[] }).options).toHaveLength(2);
    for (const item of byFormat('matching'))
      expect((item.problem.answer as { options: unknown[] }).options).toHaveLength(6);
    for (const item of byFormat('open')) expect(item.problem.answer.kind).not.toBe('choice');
    // Nothing is told while it runs.
    expect(exam.items.every((item) => item.problem.concept === null && item.problem.outcome === null)).toBe(true);

    // Everything right, except: one true/false statement, and two of the three matchings.
    const tf = byFormat('truefalse')[0]!.index;
    const matching = byFormat('matching').map((item) => item.index);
    for (const item of exam.items) {
      const row = getProblemRow(h.ctx, item.problem.id);
      const miss = item.index === tf || item.index === matching[0] || item.index === matching[1];
      await h.send('PUT', `/api/exams/${exam.id}/items/${item.index}`, {
        input: miss ? wrongInput(row) : rightInput(row),
        seconds: 90,
      });
    }
    const finished = (await h.send<ExamDto>('POST', `/api/exams/${exam.id}/finish`)).body;
    const report = finished.report!;
    // 45 on the screen; minus 2 of the 4 for the true/false bundle, minus 4 of the 6 for the matching.
    expect(report.maxPoints).toBe(45);
    expect(report.points).toBe(45 - 2 - 4);
    expect(report.grade).toBeNull();
    expect(report.structure).toMatchObject({ onScreenPoints: 45, offScreenPoints: 5, examPoints: 50 });
    expect(report.details.find((detail) => detail.index === tf)).toMatchObject({
      correct: false,
      earned: 0,
      bundle: 'tf',
    });
    const tfEarned = report.details
      .filter((detail) => detail.bundle === 'tf')
      .reduce((sum, detail) => sum + detail.earned!, 0);
    expect(tfEarned).toBe(2);
    // What to come back to, and when the schedule brings it back.
    expect(report.followUp!.length).toBeGreaterThan(0);
    expect(report.followUp!.every((entry) => entry.inDays >= 0 && entry.inDays <= 7)).toBe(true);
    expect(report.next.length).toBeGreaterThan(0);
    // Now everything about each task can be read.
    expect(finished.items.every((item) => item.problem.outcome !== null)).toBe(true);
    const listed = (await h.get<{ id: string; points: number; maxPoints: number }[]>('/api/exams')).body;
    expect(listed[0]).toMatchObject({ id: exam.id, points: 39, maxPoints: 45, blueprint: 'jpz-9-practice' });
  });

  it('are offered only to learners of that goal', async () => {
    const school = harness();
    expect((await school.send('POST', '/api/exams', { blueprint: 'jpz-9-practice' })).status).toBe(403);
    const seventh = learner('jpz-7');
    expect((await seventh.send('POST', '/api/exams', { blueprint: 'jpz-9-practice' })).status).toBe(403);
    expect((await seventh.send('POST', '/api/exams', { blueprint: 'chapter-test' })).status).toBe(403);
    const own = await seventh.send<ExamDto>('POST', '/api/exams', { blueprint: 'jpz-7-practice' });
    expect(own.status).toBe(200);
    expect(own.body.structure).toMatchObject({ onScreenPoints: 44, offScreenPoints: 6 });
    // A short test without chapters draws on the goal's own skills.
    const quick = await seventh.send<ExamDto>('POST', '/api/exams', { blueprint: 'quick-check' });
    expect(quick.status).toBe(200);
    const inGoal = new Set(conceptsOfGoal('jpz-7').map((concept) => concept.id));
    for (const item of quick.body.items)
      expect(inGoal.has(getProblemRow(seventh.ctx, item.problem.id).skill)).toBe(true);
  });
});

describe('assignments and worked examples', () => {
  it('puts what the teacher set first, carries it out, and marks it done', () => {
    const h = learner();
    skipDiagnostic(h.ctx);
    const practice = createAssignment(h.ctx, 'teacher', {
      kind: 'practice',
      skills: ['geom.angles', 'geom.perimeter-area'],
      minutes: 10,
      count: 6,
      note: 'Do pátku, prosím.',
    });
    expect(practice).toMatchObject({ status: 'open', createdBy: 'teacher', count: 6, result: null });
    // The plan notices by itself, and puts the assigned work before its own choices.
    const plan = getPlan(h.ctx);
    expect(plan.blocks[0]).toMatchObject({ id: `assigned:${practice.id}`, kind: 'assigned', status: 'todo' });
    expect(plan.blocks[0]!.assignment).toMatchObject({ id: practice.id, note: 'Do pátku, prosím.' });
    expect(plan.blocks[0]!.reason).toMatchObject({ code: 'assigned-by-teacher' });
    // The selection knows as well: the assigned skills carry the term, whatever else is waiting.
    const scored = selectionFor(h.ctx).scored.find((entry) => entry.id === 'geom.angles')!;
    expect(scored).toMatchObject({ purpose: 'assigned', blockedBy: null });
    expect(scored.terms.assigned).toBe(1);

    const started = startBlock(h.ctx, plan.blocks[0]!.id) as StartRunResponse;
    expect(started.run.total).toBe(6);
    expect(getPlan(h.ctx).blocks[0]).toMatchObject({ status: 'active', runId: started.run.id });
    // Starting it again goes on with the same run.
    expect((startAssignment(h.ctx, practice.id) as StartRunResponse).run.id).toBe(started.run.id);
    const played = playRun(h.ctx, started, VOJTA, createRng(1));
    expect(played).toHaveLength(6);
    expect(new Set(played.map((entry) => entry.row.skill))).toEqual(new Set(['geom.angles', 'geom.perimeter-area']));
    expect(played.every((entry) => entry.row.purpose === 'assigned')).toBe(true);
    const done = getPlan(h.ctx).blocks[0]!;
    expect(done).toMatchObject({ status: 'done' });
    expect(done.assignment).toMatchObject({ status: 'done' });
    expect(done.assignment!.result).toMatchObject({ problems: 6 });
    expect(() => startAssignment(h.ctx, practice.id)).toThrow(/no longer open/);

    // A remediation goes to the prerequisites first, then the skill from its easiest problems.
    const remediation = createAssignment(h.ctx, 'teacher', {
      kind: 'remediation',
      skills: ['frac.operations'],
      count: 8,
    });
    const fix = playRun(h.ctx, startAssignment(h.ctx, remediation.id) as StartRunResponse, VOJTA, createRng(2));
    const order = fix.map((entry) => entry.row.skill);
    expect(order.slice(0, 2).every((skill) => getConcept('frac.operations')!.prereqs.includes(skill))).toBe(true);
    expect(order.lastIndexOf('frac.operations')).toBe(order.length - 1);
    expect(fix.filter((entry) => entry.row.skill !== 'frac.operations').every((entry) => entry.row.level <= 2)).toBe(
      true,
    );
    expect(fix.find((entry) => entry.row.skill === 'frac.operations')!.row.level).toBeLessThanOrEqual(2);

    // What cannot be done on a screen cannot be assigned as practice; a skill of another goal neither.
    expect(() => createAssignment(h.ctx, 'teacher', { kind: 'practice', skills: ['geom.constructions'] })).toThrow();
    expect(() => createAssignment(h.ctx, 'teacher', { kind: 'practice', skills: ['quad.vertex'] })).toThrow(/goal/);
    expect(() =>
      createAssignment(h.ctx, 'teacher', { kind: 'remediation', skills: ['geom.angles', 'geom.circle'] }),
    ).toThrow();
  });

  it('reaches a learner of the school goal as well, without disturbing the plan of the day', () => {
    const h = harness();
    expect(getSettings(h.ctx).goal).toBe('school-it-2');
    // The plan of the day as it was composed in the morning: numbered blocks, kept for the day.
    const morning = getPlan(h.ctx).blocks.map((block) => block.id);
    expect(morning.length).toBeGreaterThan(0);

    const practice = createAssignment(h.ctx, 'teacher', {
      kind: 'practice',
      skills: ['quad.graph'],
      count: 4,
      note: 'Na pátek.',
    });
    // The assigned work stands in front, and the rest of the plan is what it was.
    const plan = getPlan(h.ctx);
    expect(plan.blocks[0]).toMatchObject({ id: `assigned:${practice.id}`, kind: 'assigned', status: 'todo' });
    expect(plan.blocks[0]!.assignment).toMatchObject({ id: practice.id, note: 'Na pátek.' });
    expect(plan.blocks.slice(1).map((block) => block.id)).toEqual(morning);
    // The first page lists it too, although it has no examination part.
    expect(dashboard(h.ctx).entrance).toBeNull();
    expect(dashboard(h.ctx).assignments.map((entry) => entry.id)).toEqual([practice.id]);

    // Started from the plan and done by doing it.
    const started = startBlock(h.ctx, plan.blocks[0]!.id) as StartRunResponse;
    expect(started.run.total).toBe(4);
    expect(getPlan(h.ctx).blocks[0]).toMatchObject({ status: 'active', runId: started.run.id });
    const played = playRun(h.ctx, started, VOJTA, createRng(3));
    expect(played.every((entry) => entry.row.skill === 'quad.graph')).toBe(true);
    const after = getPlan(h.ctx);
    expect(after.blocks[0]).toMatchObject({ id: `assigned:${practice.id}`, status: 'done' });
    expect(after.blocks.slice(1).map((block) => block.id)).toEqual(morning);
    expect(dashboard(h.ctx).assignments[0]).toMatchObject({ status: 'done', result: { problems: 4 } });

    // A lesson that exists is opened as a lesson, and the test is the chapter test.
    const lesson = createAssignment(h.ctx, 'teacher', { kind: 'lesson', skills: ['quad.vertex'] });
    expect(startAssignment(h.ctx, lesson.id)).toMatchObject({ redirect: 'lesson', target: 'quad.vertex' });
    const test = createAssignment(h.ctx, 'teacher', { kind: 'test', skills: [] });
    expect(startBlock(h.ctx, `assigned:${test.id}`)).toMatchObject({ redirect: 'exam', target: 'chapter-test' });
    // Withdrawn work leaves the plan again; a block that is not there cannot be started.
    cancelAssignment(h.ctx, lesson.id);
    cancelAssignment(h.ctx, test.id);
    expect(
      getPlan(h.ctx)
        .blocks.filter((block) => block.assignment !== null)
        .map((block) => block.assignment!.id),
    ).toEqual([practice.id]);
    expect(() => startBlock(h.ctx, 'assigned:nothing')).toThrow();
  });

  it('a recommended lesson is a worked example, and reading it is not an attempt', async () => {
    const h = learner();
    const lesson = createAssignment(h.ctx, 'teacher', { kind: 'lesson', skills: ['geom.pythagoras'] });
    expect(startAssignment(h.ctx, lesson.id)).toMatchObject({ redirect: 'concept', target: 'geom.pythagoras' });

    const example = (
      await h.get<{ solution: unknown[]; level: number; prompt: { cs: string } }>(
        '/api/concepts/geom.pythagoras/example',
      )
    ).body;
    expect(example.solution.length).toBeGreaterThan(0);
    expect(example.level).toBeLessThanOrEqual(2);
    // The same example on reload; another on request.
    expect(workedExample(h.ctx, 'geom.pythagoras', 0).prompt).toEqual(example.prompt);
    expect(workedExample(h.ctx, 'geom.pythagoras', 1).prompt).not.toEqual(example.prompt);

    // Nothing was attempted — and the skill counts as introduced, as after any lesson.
    expect((h.db.prepare('SELECT COUNT(*) AS n FROM problems').get() as { n: number }).n).toBe(0);
    const skill = allSkills(h.ctx).find((entry) => entry.id === 'geom.pythagoras')!;
    expect(skill).toMatchObject({ level: 1, attempts: 0, path: 'learning' });
    replayAll(h.ctx);
    expect(allSkills(h.ctx).find((entry) => entry.id === 'geom.pythagoras')!.level).toBe(1);
    expect(getPlan(h.ctx).blocks.find((block) => block.assignment?.id === lesson.id)).toMatchObject({ status: 'done' });
    // A skill that is drawn on paper has no example to show.
    expect((await h.get('/api/concepts/geom.constructions/example')).status).toBe(422);
  });

  it('a test the teacher asked for is done when a practice test is finished', () => {
    const h = learner();
    skipDiagnostic(h.ctx);
    const test = createAssignment(h.ctx, 'teacher', { kind: 'test', skills: [] });
    expect(test.minutes).toBe(63);
    const block = getPlan(h.ctx).blocks[0]!;
    expect(block).toMatchObject({ kind: 'mock', optional: false, status: 'todo' });
    expect(startBlock(h.ctx, block.id)).toMatchObject({ redirect: 'exam', target: 'jpz-9-practice' });
    const exam = createExam(h.ctx, { blueprint: 'jpz-9-practice' });
    finishExam(h.ctx, exam.id);
    const after = getPlan(h.ctx).blocks[0]!;
    expect(after).toMatchObject({ status: 'done' });
    expect(after.assignment).toMatchObject({ status: 'done' });
  });
});

describe('fixtures', () => {
  it('describe four different learners', () => {
    const outcomes = (persona: Persona): { accuracy: number; paths: Record<string, number> } => {
      const h = learner();
      playRun(h.ctx, startDiagnostic(h.ctx), persona, createRng(3));
      const played = study(h, h.ctx, persona, { days: 5, perDay: 12, seed: 7 });
      const paths: Record<string, number> = {};
      for (const skill of allSkills(h.ctx)) paths[skill.path] = (paths[skill.path] ?? 0) + 1;
      return { accuracy: played.filter((entry) => entry.right).length / played.length, paths };
    };
    const vojta = outcomes(VOJTA);
    const matej = outcomes(MATEJ);
    // The selection keeps a beginner and a strong student each at problems they mostly — not always — solve.
    expect(vojta.accuracy).toBeGreaterThan(0.75);
    expect(matej.accuracy).toBeGreaterThan(0.35);
    expect(matej.accuracy).toBeLessThan(0.85);
    expect((vojta.paths.practising ?? 0) + (vojta.paths.consolidating ?? 0)).toBeGreaterThan(
      (matej.paths.practising ?? 0) + (matej.paths.consolidating ?? 0),
    );
    // A beginner is not thrown into everything at once: much of the map is still ahead.
    expect((matej.paths['not-started'] ?? 0) + (matej.paths.diagnosed ?? 0)).toBeGreaterThan(8);
  });
});
