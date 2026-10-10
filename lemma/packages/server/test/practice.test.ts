import { CONCEPTS, GENERATORS, hasProblems, topLevelOf } from '@lemma/content';
import type {
  AnswerResultDto,
  ApiError,
  ConceptDetailDto,
  DashboardDto,
  DayDetailDto,
  ErrorSummaryDto,
  GraphDto,
  LessonDto,
  PlanDto,
  ProblemDto,
  SkillState,
  StartRunResponse,
} from '@lemma/core';
import { describe, expect, it } from 'vitest';
import { ensureModelCurrent, loadStates, modelMarker, replayAll } from '../src/services/learner';
import { DAY, HOUR, MINUTE, type Harness, harness, rightAnswer, snapshotOfProblem, wrongAnswer } from './helpers';

const start = async (h: Harness, request: Record<string, unknown>): Promise<StartRunResponse> => {
  const response = await h.send<StartRunResponse>('POST', '/api/practice/start', request);
  expect(response.status).toBe(200);
  return response.body;
};

const answer = async (
  h: Harness,
  id: string,
  input: string,
  extra: Record<string, unknown> = {},
): Promise<AnswerResultDto> => {
  const response = await h.send<AnswerResultDto>('POST', `/api/problems/${id}/answer`, {
    input,
    seconds: 40,
    ...extra,
  });
  expect(response.status).toBe(200);
  return response.body;
};

/** Work through a run, answering each problem as `policy` says. */
async function playRun(
  h: Harness,
  first: StartRunResponse,
  policy: (problem: ProblemDto, index: number) => 'right' | 'wrong' | 'wrong-then-right' | 'hint-then-right',
): Promise<void> {
  let current = first;
  let index = 0;
  while (current.problem) {
    const problem = current.problem;
    h.advance(MINUTE);
    const choice = policy(problem, index++);
    if (choice === 'right') {
      await answer(h, problem.id, rightAnswer(h.db, problem.id));
    } else if (choice === 'hint-then-right') {
      if (problem.hintCount > 0) await h.send('POST', `/api/problems/${problem.id}/hint`);
      await answer(h, problem.id, rightAnswer(h.db, problem.id));
    } else {
      let result = await answer(h, problem.id, wrongAnswer(h.db, problem.id));
      if (choice === 'wrong-then-right' && !result.resolved) {
        result = await answer(h, problem.id, rightAnswer(h.db, problem.id));
      } else {
        while (!result.resolved) result = await answer(h, problem.id, wrongAnswer(h.db, problem.id));
      }
    }
    h.advance(MINUTE);
    current = (await h.send<StartRunResponse>('POST', `/api/runs/${current.run.id}/next`)).body;
  }
  expect(current.run.finished).toBe(true);
}

const stateSnapshot = (h: Harness): Record<string, SkillState> =>
  Object.fromEntries([...loadStates(h.ctx).entries()].sort(([a], [b]) => a.localeCompare(b)));

describe('answering a problem', () => {
  it('never sends the answer, the solution or the misconceptions with an open problem', async () => {
    const h = harness();
    const { problem } = await start(h, { context: 'blocked', concept: 'quad.vertex', count: 1 });
    const text = JSON.stringify(problem);
    expect(problem!.status).toBe('open');
    expect(problem!.outcome).toBeNull();
    const stored = snapshotOfProblem(h.db, problem!.id);
    expect(stored.solution.length).toBeGreaterThan(0);
    expect(text).not.toContain('"solution"');
    expect(text).not.toContain('"misconceptions"');
    // The public form of the answer says what to type, never what the value is.
    expect(Object.keys(problem!.answer)).not.toContain('value');
    expect(Object.keys(problem!.answer)).not.toContain('values');
    expect(Object.keys(problem!.answer)).not.toContain('correct');
  });

  it('solves on the first try and reports what changed', async () => {
    const h = harness();
    const { problem, run } = await start(h, { context: 'blocked', concept: 'lin.graph', count: 3 });
    expect(run.total).toBe(3);
    expect(problem!.concept).toBe('lin.graph');
    h.advance(MINUTE);

    const result = await answer(h, problem!.id, rightAnswer(h.db, problem!.id), { confidence: 'sure' });
    expect(result.verdict).toBe('correct');
    expect(result.resolved).toBe(true);
    const outcome = result.problem.outcome!;
    expect(outcome.solved).toBe(true);
    expect(outcome.credit).toBe(1);
    expect(outcome.points).toBeGreaterThan(0);
    expect(outcome.solution.length).toBeGreaterThan(0);
    expect(outcome.skill.levelAfter).toBeGreaterThanOrEqual(outcome.skill.levelBefore);
    expect(outcome.skill.progressAfter).toBeGreaterThan(outcome.skill.progressBefore);
    expect(outcome.milestones).toContain('first-problem');
    expect(outcome.error).toBeNull();

    // Answering again is refused rather than counted twice.
    const again = await h.send<ApiError>('POST', `/api/problems/${problem!.id}/answer`, { input: '1' });
    expect(again.status).toBe(409);
  });

  it('does not count input it cannot read as an attempt', async () => {
    const h = harness();
    const { problem } = await start(h, { context: 'blocked', concept: 'alg.linear-eq', count: 1 });
    const before = problem!.triesLeft;
    const result = await answer(h, problem!.id, '2 +* (');
    expect(result.verdict).toBe('invalid');
    expect(result.message).not.toBeNull();
    expect(result.resolved).toBe(false);
    expect(result.triesLeft).toBe(before);
    expect((h.db.prepare('SELECT COUNT(*) AS n FROM attempts').get() as { n: number }).n).toBe(0);
  });

  it('lets a wrong answer be corrected, for less credit, and remembers the error', async () => {
    const h = harness();
    const { problem } = await start(h, { context: 'blocked', concept: 'alg.linear-eq', count: 1 });
    h.advance(MINUTE);
    const wrong = await answer(h, problem!.id, wrongAnswer(h.db, problem!.id));
    expect(wrong.verdict).toBe('incorrect');
    expect(wrong.resolved).toBe(false);
    expect(wrong.triesLeft).toBe(problem!.triesLeft - 1);
    expect(wrong.error).not.toBeNull();
    // Still nothing given away.
    expect(wrong.problem.outcome).toBeNull();

    const right = await answer(h, problem!.id, rightAnswer(h.db, problem!.id));
    expect(right.verdict).toBe('correct');
    const outcome = right.problem.outcome!;
    expect(outcome.corrected).toBe(true);
    expect(outcome.credit).toBeLessThan(1);
    expect(outcome.credit).toBeGreaterThan(0);
    expect(outcome.error).not.toBeNull();
    expect(right.problem.previousInputs).toHaveLength(1);
  });

  it('closes the problem as not solved when the tries run out', async () => {
    const h = harness();
    const { problem } = await start(h, { context: 'blocked', concept: 'alg.linear-eq', count: 1 });
    let result = await answer(h, problem!.id, wrongAnswer(h.db, problem!.id));
    let guard = 0;
    while (!result.resolved && guard++ < 5) result = await answer(h, problem!.id, wrongAnswer(h.db, problem!.id));
    expect(result.resolved).toBe(true);
    expect(result.problem.status).toBe('failed');
    expect(result.problem.outcome!.solved).toBe(false);
    expect(result.problem.outcome!.answerTex.cs).not.toBe('');
    expect(result.problem.outcome!.points).toBeGreaterThan(0); // an honest attempt still counts as activity
  });

  it('gives hints one at a time and counts them against the credit', async () => {
    const h = harness();
    const { problem } = await start(h, { context: 'blocked', concept: 'quad.vertex', count: 1 });
    expect(problem!.hintCount).toBeGreaterThan(0);
    expect(problem!.hints).toHaveLength(0);
    const hinted = (await h.send<ProblemDto>('POST', `/api/problems/${problem!.id}/hint`)).body;
    expect(hinted.hints).toHaveLength(1);
    const result = await answer(h, problem!.id, rightAnswer(h.db, problem!.id));
    expect(result.problem.outcome!.credit).toBeCloseTo(0.8, 5);

    // Hints beyond the last one are refused.
    const other = (await start(h, { context: 'blocked', concept: 'quad.vertex', count: 1 })).problem!;
    for (let i = 0; i < other.hintCount; i++)
      expect((await h.send('POST', `/api/problems/${other.id}/hint`)).status).toBe(200);
    expect((await h.send('POST', `/api/problems/${other.id}/hint`)).status).toBe(409);
  });

  it('records giving up as not solved', async () => {
    const h = harness();
    const { problem } = await start(h, { context: 'blocked', concept: 'quad.vertex', count: 1 });
    const revealed = (await h.send<ProblemDto>('POST', `/api/problems/${problem!.id}/reveal`, { seconds: 30 })).body;
    expect(revealed.status).toBe('failed');
    expect(revealed.outcome!.solved).toBe(false);
    expect(revealed.outcome!.solution.length).toBeGreaterThan(0);
    expect(revealed.outcome!.error?.type).toBe('unknown');
  });

  it('lets the learner say what kind of error it was, and rebuilds the model from it', async () => {
    const h = harness();
    const { problem } = await start(h, { context: 'blocked', concept: 'alg.linear-eq', count: 1 });
    await answer(h, problem!.id, wrongAnswer(h.db, problem!.id));
    await answer(h, problem!.id, rightAnswer(h.db, problem!.id));
    const classified = (
      await h.send<ProblemDto>('POST', `/api/problems/${problem!.id}/classify`, { errorType: 'sign' })
    ).body;
    expect(classified.outcome!.errorConfirmed).toBe('sign');
    expect((await h.send('POST', `/api/problems/${problem!.id}/classify`, { errorType: 'made-up' })).status).toBe(400);

    const summary = (await h.get<ErrorSummaryDto>('/api/errors')).body;
    expect(summary.recent[0]).toMatchObject({
      problemId: problem!.id,
      error: 'sign',
      confirmed: true,
      solvedLater: true,
    });
    expect(summary.byType.find((entry) => entry.type === 'sign')!.recent).toBe(1);
  });

  it('rejects malformed practice requests', async () => {
    const h = harness();
    expect((await h.send('POST', '/api/practice/start', {})).status).toBe(400);
    expect((await h.send('POST', '/api/practice/start', { context: 'blocked' })).status).toBe(400);
    expect(
      (await h.send('POST', '/api/practice/start', { context: 'blocked', concept: 'quad.vertex', count: 'ten' }))
        .status,
    ).toBe(400);
    expect((await h.send('POST', '/api/practice/start', { context: 'exam', concept: 'quad.vertex' })).status).toBe(400);
    // A concept that exists but has no problems yet says so honestly.
    const empty = CONCEPTS.find((concept) => !hasProblems(concept.id));
    if (empty) {
      const response = await h.send<ApiError>('POST', '/api/practice/start', { context: 'blocked', concept: empty.id });
      expect(response.status).toBe(422);
      expect(response.body.error).toBe('no_problems');
    }
  });
});

describe('runs', () => {
  it('walks through a blocked run and summarises it', async () => {
    const h = harness();
    const first = await start(h, { context: 'blocked', concept: 'quad.graph', count: 5 });
    // One problem is failed outright, one is corrected at the second try — which needs a
    // problem that has a second try: a choice is settled by the first answer.
    let corrected = -1;
    await playRun(h, first, (problem, index) => {
      if (index === 3) return 'wrong';
      if (corrected >= 0 || problem.triesLeft < 2) return 'right';
      corrected = index;
      return 'wrong-then-right';
    });
    expect(corrected).toBeGreaterThanOrEqual(0);
    const run = (await h.get<StartRunResponse['run']>(`/api/runs/${first.run.id}`)).body;
    expect(run.finished).toBe(true);
    expect(run.summary).toMatchObject({ problems: 5, solved: 4, unaided: 3 });
    expect(run.summary!.errors.reduce((sum, entry) => sum + entry.count, 0)).toBe(2);
    expect(run.summary!.skills).toEqual([expect.objectContaining({ id: 'quad.graph', solved: 4, total: 5 })]);
  });

  it('returns the open problem again instead of issuing a new one', async () => {
    const h = harness();
    const first = await start(h, { context: 'blocked', concept: 'quad.graph', count: 3 });
    const again = (await h.send<StartRunResponse>('POST', `/api/runs/${first.run.id}/next`)).body;
    expect(again.problem!.id).toBe(first.problem!.id);
    expect((h.db.prepare('SELECT COUNT(*) AS n FROM problems').get() as { n: number }).n).toBe(1);
  });

  it('hides the topic in mixed practice until the answer is in', async () => {
    const h = harness();
    // Something has to have been practised before it can be reviewed.
    expect((await h.send<ApiError>('POST', '/api/practice/start', { context: 'mixed' })).status).toBe(422);
    await playRun(h, await start(h, { context: 'blocked', concept: 'lin.graph', count: 2 }), () => 'right');
    await playRun(h, await start(h, { context: 'blocked', concept: 'quad.graph', count: 2 }), () => 'right');

    const mixed = await start(h, { context: 'mixed', count: 4 });
    expect(mixed.problem!.concept).toBeNull();
    expect(mixed.problem!.conceptTitle).toBeNull();
    const result = await answer(h, mixed.problem!.id, rightAnswer(h.db, mixed.problem!.id));
    expect(result.problem.concept).not.toBeNull();
  });

  it('replays an earlier mistake with the same numbers', async () => {
    const h = harness();
    const { problem } = await start(h, { context: 'blocked', concept: 'quad.vertex', count: 1 });
    await h.send('POST', `/api/problems/${problem!.id}/reveal`, {});
    h.advance(DAY);
    const replay = await start(h, { context: 'drill', replayOf: problem!.id });
    expect(replay.problem!.prompt).toEqual(problem!.prompt);
    expect(replay.problem!.id).not.toBe(problem!.id);
    expect(replay.run.context).toBe('drill');
  });

  it('builds a drill from problems that can provoke the chosen error', async () => {
    const h = harness();
    const drill = await start(h, { context: 'drill', errorType: 'sign', count: 5 });
    expect(drill.run.total).toBe(5);
    expect(drill.problem).not.toBeNull();
  });

  it('raises a challenge at a hard level', async () => {
    const h = harness();
    const hard = GENERATORS.find((generator) => generator.levels.some((level) => level >= 4))!;
    const challenge = await start(h, { context: 'challenge', concept: hard.concept });
    expect(challenge.problem!.level).toBeGreaterThanOrEqual(4);
  });
});

describe('the learner model in the database', () => {
  it('rebuilds itself on start when it was computed under other rules', async () => {
    const h = harness();
    // A fresh database: nothing to rebuild, the rules in force are noted.
    expect(ensureModelCurrent(h.ctx)).toMatchObject({ rebuilt: false, from: null });
    expect(ensureModelCurrent(h.ctx)).toMatchObject({ rebuilt: false, from: modelMarker() });

    await playRun(h, await start(h, { context: 'blocked', concept: 'lin.graph', count: 6 }), (_p, i) =>
      i === 1 ? 'wrong-then-right' : 'right',
    );
    const live = stateSnapshot(h);
    // What an older version might have left behind: a state that the log does not support.
    const stale = (): void => {
      const row = h.db.prepare(`SELECT state FROM skill_state WHERE skill = 'lin.graph'`).get() as { state: string };
      const wrong = { ...(JSON.parse(row.state) as SkillState), level: 0, theta: -3, hardTop: 99 };
      h.db
        .prepare(`UPDATE skill_state SET state = ?, level = 0, theta = -3 WHERE skill = 'lin.graph'`)
        .run(JSON.stringify(wrong));
    };

    // Same rules: the stored states are trusted as they are (even these wrong ones).
    stale();
    expect(ensureModelCurrent(h.ctx).rebuilt).toBe(false);
    expect(stateSnapshot(h)).not.toEqual(live);

    // States left behind by an older version: rebuilt from the log, exactly.
    h.db
      .prepare(`UPDATE settings SET value = ? WHERE key = 'model_marker'`)
      .run(JSON.stringify('model 1 · content 2026.10.0'));
    const result = ensureModelCurrent(h.ctx);
    expect(result).toMatchObject({ rebuilt: true, from: 'model 1 · content 2026.10.0', problems: 6 });
    expect(stateSnapshot(h)).toEqual(live);
    expect(ensureModelCurrent(h.ctx).rebuilt).toBe(false);
  });

  it('is exactly what replaying the log produces', async () => {
    const h = harness();
    await h.send('PUT', '/api/settings', { currentTopic: 3 });
    // A lesson, several runs across days, mistakes, hints, a reclassification, a mixed review.
    await h.get('/api/lessons/quad.graph');
    h.advance(5 * MINUTE);
    await playRun(h, await start(h, { context: 'blocked', concept: 'alg.quad-eq', count: 4 }), (_p, i) =>
      i === 2 ? 'wrong-then-right' : 'right',
    );
    await playRun(h, await start(h, { context: 'blocked', concept: 'quad.graph', count: 5 }), (_p, i) =>
      i === 0 ? 'hint-then-right' : i === 3 ? 'wrong' : 'right',
    );
    h.advance(DAY);
    await playRun(h, await start(h, { context: 'blocked', concept: 'quad.vertex', count: 5 }), (_p, i) =>
      i % 2 === 0 ? 'right' : 'wrong-then-right',
    );
    h.advance(2 * DAY);
    await playRun(h, await start(h, { context: 'mixed', count: 6 }), (_p, i) => (i === 4 ? 'wrong' : 'right'));
    h.advance(8 * DAY);
    await playRun(h, await start(h, { context: 'mixed', count: 6 }), () => 'right');
    const failed = h.db.prepare(`SELECT id FROM problems WHERE status = 'failed' LIMIT 1`).get() as { id: string };
    await h.send('POST', `/api/problems/${failed.id}/classify`, { errorType: 'concept' });
    h.advance(HOUR);
    await playRun(h, await start(h, { context: 'blocked', concept: 'quad.inequality', count: 3 }), () => 'right');

    const live = stateSnapshot(h);
    expect(Object.keys(live).length).toBeGreaterThanOrEqual(4);
    const result = replayAll(h.ctx);
    expect(result.problems).toBe(29);
    expect(stateSnapshot(h)).toEqual(live);
  });

  it('does not call a skill mastered after a streak of easy, same-day successes', async () => {
    const h = harness();
    for (let round = 0; round < 3; round++) {
      await playRun(h, await start(h, { context: 'blocked', concept: 'lin.graph', count: 10 }), () => 'right');
    }
    const detail = (await h.get<ConceptDetailDto>('/api/concepts/lin.graph')).body;
    expect(detail.attempts).toBe(30);
    // Thirty right answers in one sitting are evidence of familiarity, not of retention.
    expect(detail.level).toBeLessThanOrEqual(3);
    expect(detail.next).not.toBeNull();
    expect(detail.next!.gates.some((gate) => !gate.done)).toBe(true);
  });

  it('asks for hard evidence at the hardest level a skill offers, and lets it reach the top', async () => {
    const h = harness();
    // lin.graph has no problems above level 3, so that is what "hard" means for it.
    expect(topLevelOf('lin.graph')).toBe(3);
    expect(topLevelOf('quad.inequality')).toBeGreaterThanOrEqual(4);

    await playRun(h, await start(h, { context: 'blocked', concept: 'lin.graph', count: 10 }), () => 'right');
    // Spaced, mixed, unaided work over most of a year.
    for (let week = 1; week <= 44; week++) {
      h.advance(8 * DAY);
      await playRun(h, await start(h, { context: 'mixed', skills: ['lin.graph'], count: 2 }), () => 'right');
    }
    const detail = (await h.get<ConceptDetailDto>('/api/concepts/lin.graph')).body;
    expect(detail.level).toBe(5);
    expect(detail.next).toBeNull();

    // On the way there, the gate names the level it wants.
    const other = harness();
    await playRun(other, await start(other, { context: 'blocked', concept: 'lin.graph', count: 6 }), () => 'right');
    const early = (await other.get<ConceptDetailDto>('/api/concepts/lin.graph')).body;
    const hard = early.next!.gates.find((gate) => gate.key === 'hard');
    if (hard) expect(hard.level).toBe(3);

    // Replaying the log gives the same answer as living through it.
    const before = JSON.stringify([...loadStates(h.ctx).entries()]);
    replayAll(h.ctx);
    expect(JSON.stringify([...loadStates(h.ctx).entries()])).toBe(before);
  });

  it('schedules a review after practice and reports it as due later', async () => {
    const h = harness();
    await playRun(h, await start(h, { context: 'blocked', concept: 'lin.graph', count: 4 }), () => 'right');
    const soon = (await h.get<GraphDto>('/api/graph')).body.skills.find((skill) => skill.id === 'lin.graph')!;
    expect(soon.due).toBe(false);
    expect(soon.dueInDays).toBeGreaterThan(0);
    h.advance(60 * DAY);
    const later = (await h.get<GraphDto>('/api/graph')).body.skills.find((skill) => skill.id === 'lin.graph')!;
    expect(later.due).toBe(true);
    expect(later.retention).toBeLessThan(soon.retention!);
  });
});

describe('lessons', () => {
  it('introduces the skill, counts each step once and finishes', async () => {
    const h = harness();
    const lesson = (await h.get<LessonDto>('/api/lessons/quad.graph')).body;
    expect(lesson.step).toBe(0);
    expect(lesson.done).toBe(false);
    expect((await h.get<ConceptDetailDto>('/api/concepts/quad.graph')).body.level).toBe(1);

    let current = lesson;
    for (let i = 0; i < lesson.steps.length; i++)
      current = (await h.send<LessonDto>('POST', '/api/lessons/quad.graph/step', { step: i })).body;
    expect(current.done).toBe(true);
    const events = (): number =>
      (
        h.db.prepare(`SELECT COUNT(*) AS n FROM events WHERE type IN ('lesson_step', 'lesson_done')`).get() as {
          n: number;
        }
      ).n;
    const counted = events();
    // Going through it again earns nothing.
    for (let i = 0; i < lesson.steps.length; i++) await h.send('POST', '/api/lessons/quad.graph/step', { step: i });
    expect(events()).toBe(counted);
    expect((await h.get('/api/lessons/no.such.lesson')).status).toBe(404);
  });
});

describe('the daily plan and the dashboard', () => {
  it('gives a newcomer something concrete to do, with a reason', async () => {
    const h = harness();
    await h.send('POST', '/api/onboarding', { name: 'Jonas', currentTopic: 3, sessionMinutes: 30 });
    const dashboard = (await h.get<DashboardDto>('/api/dashboard')).body;
    expect(dashboard.name).toBe('Jonas');
    expect(dashboard.plan.blocks.length).toBeGreaterThan(0);
    for (const block of dashboard.plan.blocks) {
      expect(block.reason.code).toBeTruthy();
      expect(block.minutes).toBeGreaterThan(0);
      expect(block.status).toBe('todo');
    }
    expect(
      dashboard.plan.blocks.filter((block) => !block.optional).reduce((sum, block) => sum + block.minutes, 0),
    ).toBeLessThanOrEqual(30);
    expect(dashboard.focus.topic?.n).toBe(3);
    expect(dashboard.heatmap.length).toBeGreaterThan(360);
    expect(dashboard.heatmap[dashboard.heatmap.length - 1]!.day).toBe(dashboard.today);
    expect(dashboard.streak.current).toBe(0);
    expect(dashboard.totals.problems).toBe(0);
    expect(dashboard.fit!.retrievedOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('adapts the plan to the time available and keeps it stable through the day', async () => {
    const h = harness();
    await h.send('POST', '/api/onboarding', { currentTopic: 3 });
    const short = (await h.get<PlanDto>('/api/plan?minutes=15')).body;
    const long = (await h.get<PlanDto>('/api/plan?minutes=60')).body;
    const total = (plan: PlanDto): number =>
      plan.blocks.filter((block) => !block.optional).reduce((sum, block) => sum + block.minutes, 0);
    expect(total(short)).toBeLessThanOrEqual(15);
    expect(total(long)).toBeLessThanOrEqual(60);
    expect(total(long)).toBeGreaterThan(total(short));
    // Asking again without a duration returns the stored plan, not a reshuffle.
    expect((await h.get<PlanDto>('/api/plan')).body).toEqual(long);
  });

  it('starts a block, marks it active, resumes it, and marks it done', async () => {
    const h = harness();
    await h.send('POST', '/api/onboarding', { currentTopic: 1 });
    // Give the plan something to practise rather than a lesson.
    await playRun(h, await start(h, { context: 'blocked', concept: 'lin.graph', count: 3 }), () => 'right');
    const plan = (await h.send<PlanDto>('POST', '/api/plan/regenerate', { minutes: 30 })).body;
    const block = plan.blocks.find((b) => b.kind === 'practice' || b.kind === 'review' || b.kind === 'prereq');
    expect(block).toBeDefined();

    const started = (await h.send<StartRunResponse>('POST', `/api/plan/blocks/${block!.id}/start`)).body;
    expect(started.run.blockId).toBe(block!.id);
    expect((await h.get<PlanDto>('/api/plan')).body.blocks.find((b) => b.id === block!.id)!.status).toBe('active');
    const resumed = (await h.send<StartRunResponse>('POST', `/api/plan/blocks/${block!.id}/start`)).body;
    expect(resumed.run.id).toBe(started.run.id);

    await playRun(h, started, () => 'right');
    expect((await h.get<PlanDto>('/api/plan')).body.blocks.find((b) => b.id === block!.id)!.status).toBe('done');
    expect((await h.send('POST', '/api/plan/blocks/nope/start')).status).toBe(404);
  });

  it('shows the day in the heatmap and lets it be inspected', async () => {
    const h = harness();
    await playRun(h, await start(h, { context: 'blocked', concept: 'lin.graph', count: 6 }), (_p, i) =>
      i === 2 ? 'wrong-then-right' : 'right',
    );
    const dashboard = (await h.get<DashboardDto>('/api/dashboard')).body;
    const cell = dashboard.heatmap[dashboard.heatmap.length - 1]!;
    expect(cell.score).toBeGreaterThan(0);
    expect(cell.level).toBeGreaterThan(0);
    expect(dashboard.streak.current).toBe(1);

    const day = (await h.get<DayDetailDto>(`/api/activity/day/${dashboard.today}`)).body;
    expect(day.score).toBe(cell.score);
    expect(day.counts).toMatchObject({ problems: 6, solved: 6, unaided: 5, corrected: 1 });
    expect(day.events.length).toBeGreaterThanOrEqual(6);
    expect((await h.get('/api/activity/day/yesterday')).status).toBe(400);
  });

  it('counts a study day from 04:00, not from midnight', async () => {
    const h = harness();
    // 01:30 on Thursday in Prague still belongs to Wednesday's study day.
    h.setTime(Date.UTC(2026, 9, 7, 23, 30));
    expect((await h.get<DashboardDto>('/api/dashboard')).body.today).toBe('2026-10-07');
    h.setTime(Date.UTC(2026, 9, 8, 2, 30));
    expect((await h.get<DashboardDto>('/api/dashboard')).body.today).toBe('2026-10-08');
  });

  it('counts a Lab session once per tool per day, and only after real time in it', async () => {
    const h = harness();
    expect(
      (await h.send<{ counted: boolean }>('POST', '/api/activity/lab', { tool: 'grapher', seconds: 5 })).body.counted,
    ).toBe(false);
    expect(
      (await h.send<{ counted: boolean }>('POST', '/api/activity/lab', { tool: 'grapher', seconds: 600 })).body.counted,
    ).toBe(true);
    expect(
      (await h.send<{ counted: boolean }>('POST', '/api/activity/lab', { tool: 'grapher', seconds: 600 })).body.counted,
    ).toBe(false);
    expect((await h.send('POST', '/api/activity/lab', { tool: '../etc', seconds: 600 })).status).toBe(400);
  });
});
