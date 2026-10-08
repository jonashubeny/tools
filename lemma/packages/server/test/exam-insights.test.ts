import { ANNUAL_REVIEW_TAG, CONCEPTS, EXAM_BLUEPRINTS, SYLLABUS, getConcept, getGenerator } from '@lemma/content';
import type {
  AnalyticsDto,
  ExamDto,
  ExamListItemDto,
  FitDto,
  ForgeDto,
  GraphDto,
  MissionDto,
  StartRunResponse,
} from '@lemma/core';
import { describe, expect, it } from 'vitest';
import { loadStates } from '../src/services/learner';
import { DAY, MINUTE, type Harness, harness, rightAnswer, wrongAnswer } from './helpers';

/** The skill and problem source behind each item of an exam, read from the database. */
function sourcesOf(h: Harness, exam: ExamDto): { skill: string; source: string }[] {
  const find = h.db.prepare('SELECT skill, source FROM problems WHERE id = ?');
  return exam.items.map((item) => find.get(item.problem.id) as { skill: string; source: string });
}

async function practise(h: Harness, concept: string, count: number): Promise<void> {
  let current = (await h.send<StartRunResponse>('POST', '/api/practice/start', { context: 'blocked', concept, count }))
    .body;
  while (current.problem) {
    h.advance(MINUTE);
    await h.send('POST', `/api/problems/${current.problem.id}/answer`, {
      input: rightAnswer(h.db, current.problem.id),
      seconds: 45,
    });
    current = (await h.send<StartRunResponse>('POST', `/api/runs/${current.run.id}/next`)).body;
  }
}

describe('mock exams', () => {
  it('runs a timed exam without feedback and reports on it afterwards', async () => {
    const h = harness();
    await h.send('PUT', '/api/settings', { currentTopic: 3 });
    const created = await h.send<ExamDto>('POST', '/api/exams', { blueprint: 'quick-check', topics: [3] });
    expect(created.status).toBe(200);
    const exam = created.body;
    expect(exam.items.length).toBeGreaterThan(2);
    expect(exam.deadlineAt - exam.startedAt).toBe(exam.minutes * MINUTE);
    for (const item of exam.items) {
      expect(item.problem.context).toBe('exam');
      expect(item.problem.concept).toBeNull();
      expect(item.problem.hintCount).toBe(0);
      expect(item.problem.outcome).toBeNull();
    }

    // No shortcuts while it runs.
    const firstId = exam.items[0]!.problem.id;
    expect((await h.send('POST', `/api/problems/${firstId}/answer`, { input: '1' })).status).toBe(409);
    expect((await h.send('POST', `/api/problems/${firstId}/hint`)).status).toBe(403);
    expect((await h.send('POST', `/api/problems/${firstId}/reveal`, {})).status).toBe(403);

    // First right, second wrong, third left blank, the rest right.
    for (const item of exam.items) {
      h.advance(MINUTE);
      if (item.index === 2) continue;
      const input = item.index === 1 ? wrongAnswer(h.db, item.problem.id) : rightAnswer(h.db, item.problem.id);
      const saved = await h.send('PUT', `/api/exams/${exam.id}/items/${item.index}`, { input, seconds: 60 });
      expect(saved.status).toBe(200);
    }
    // Nothing is scored before the end.
    expect((await h.get<ExamDto>(`/api/exams/${exam.id}`)).body.report).toBeNull();
    expect(loadStates(h.ctx).size).toBe(0);

    const finished = (await h.send<ExamDto>('POST', `/api/exams/${exam.id}/finish`)).body;
    const report = finished.report!;
    expect(finished.finishedAt).not.toBeNull();
    expect(report.items).toBe(exam.items.length);
    expect(report.correct).toBe(exam.items.length - 2);
    expect(report.details[1]).toMatchObject({ correct: false, answered: true });
    expect(report.details[1]!.error).not.toBeNull();
    expect(report.details[2]).toMatchObject({ correct: false, answered: false, error: null });
    expect(report.percent).toBeGreaterThan(0);
    expect(report.percent).toBeLessThan(100);
    // Now the solutions are visible, and the learner model has taken the exam in.
    expect(finished.items[0]!.problem.outcome).not.toBeNull();
    expect(finished.items[0]!.problem.concept).not.toBeNull();
    expect(loadStates(h.ctx).size).toBeGreaterThan(0);

    // Finishing twice changes nothing; answers are no longer accepted.
    expect((await h.send<ExamDto>('POST', `/api/exams/${exam.id}/finish`)).body.report).toEqual(report);
    expect((await h.send('PUT', `/api/exams/${exam.id}/items/0`, { input: '1', seconds: 1 })).status).toBe(409);

    const list = (await h.get<ExamListItemDto[]>('/api/exams')).body;
    expect(list[0]).toMatchObject({ id: exam.id, percent: report.percent, items: exam.items.length });
  });

  it('closes itself when time runs out', async () => {
    const h = harness();
    const exam = (await h.send<ExamDto>('POST', '/api/exams', { blueprint: 'quick-check', topics: [1] })).body;
    await h.send('PUT', `/api/exams/${exam.id}/items/0`, {
      input: rightAnswer(h.db, exam.items[0]!.problem.id),
      seconds: 30,
    });
    h.advance(exam.minutes * MINUTE + 30_000);
    expect((await h.send('PUT', `/api/exams/${exam.id}/items/1`, { input: '1', seconds: 1 })).status).toBe(409);
    const closed = (await h.get<ExamDto>(`/api/exams/${exam.id}`)).body;
    expect(closed.finishedAt).not.toBeNull();
    expect(closed.report!.correct).toBe(1);
    expect(closed.report!.time.unanswered).toBe(exam.items.length - 1);
  });

  it('re-reads the report after a mistake is reclassified', async () => {
    const h = harness();
    const exam = (await h.send<ExamDto>('POST', '/api/exams', { blueprint: 'quick-check', topics: [1] })).body;
    for (const item of exam.items)
      await h.send('PUT', `/api/exams/${exam.id}/items/${item.index}`, {
        input: wrongAnswer(h.db, item.problem.id),
        seconds: 50,
      });
    await h.send('POST', `/api/exams/${exam.id}/finish`);
    await h.send('POST', `/api/problems/${exam.items[0]!.problem.id}/classify`, { errorType: 'misread' });
    const refreshed = (await h.send<ExamDto>('POST', `/api/exams/${exam.id}/refresh`)).body;
    expect(refreshed.report!.details[0]!.error).toBe('misread');
  });

  it('refuses unknown blueprints and topics that do not exist', async () => {
    const h = harness();
    expect((await h.send('POST', '/api/exams', { blueprint: 'nope' })).status).toBe(400);
    // Every chapter of the syllabus has problems now, the last one included.
    expect((await h.send('POST', '/api/exams', { blueprint: 'quick-check', topics: [17] })).status).toBe(200);
    // A chapter number outside the syllabus is ignored, and the exam falls back to the current chapter.
    const fallback = await h.send<ExamDto>('POST', '/api/exams', { blueprint: 'quick-check', topics: [99] });
    expect(fallback.status).toBe(200);
    for (const row of sourcesOf(h, fallback.body)) expect(getConcept(row.skill)?.syllabusTopic).toBe(1);
  });

  it('draws the annual review chapter by chapter, from basic problem types only', async () => {
    const h = harness();
    const blueprint = EXAM_BLUEPRINTS.find((b) => b.id === 'annual-review')!;

    // Twelve chapters, twelve items: each chapter exactly once.
    const twelve = Array.from({ length: blueprint.items }, (_, i) => i + 1);
    const wide = (await h.send<ExamDto>('POST', '/api/exams', { blueprint: 'annual-review', topics: twelve })).body;
    const chapters = sourcesOf(h, wide).map((row) => getConcept(row.skill)!.syllabusTopic);
    expect([...chapters].sort((a, b) => a! - b!)).toEqual(twelve);
    for (const row of sourcesOf(h, wide)) {
      expect(getGenerator(row.source)?.tags, row.source).toContain(ANNUAL_REVIEW_TAG);
      expect(getConcept(row.skill)?.annualReview, row.skill).toBe(true);
    }

    // The whole year: more chapters than items, so no chapter may appear twice.
    const year = (
      await h.send<ExamDto>('POST', '/api/exams', {
        blueprint: 'annual-review',
        topics: SYLLABUS.map((topic) => topic.n),
      })
    ).body;
    const seen = sourcesOf(h, year).map((row) => getConcept(row.skill)!.syllabusTopic);
    expect(new Set(seen).size).toBe(seen.length);

    // Four chapters covered so far: every one of them three times.
    await h.send('PUT', '/api/settings', { currentTopic: 4 });
    const early = (await h.send<ExamDto>('POST', '/api/exams', { blueprint: 'annual-review' })).body;
    const counts = new Map<number, number>();
    for (const row of sourcesOf(h, early))
      counts.set(getConcept(row.skill)!.syllabusTopic!, (counts.get(getConcept(row.skill)!.syllabusTopic!) ?? 0) + 1);
    expect([...counts.entries()].sort((a, b) => a[0] - b[0])).toEqual(
      [1, 2, 3, 4].map((n) => [n, blueprint.items / 4]),
    );
  });

  it('keeps every chapter of the syllabus in the annual review', () => {
    for (const topic of SYLLABUS) {
      const basic = CONCEPTS.filter((concept) => concept.syllabusTopic === topic.n && concept.annualReview);
      expect(basic.length, `chapter ${topic.n}`).toBeGreaterThan(0);
    }
    // Material from earlier years and enrichment are not part of the school's review.
    for (const concept of CONCEPTS)
      if (concept.syllabusTopic === undefined) expect(concept.annualReview, concept.id).toBe(false);
  });
});

describe('insight', () => {
  it('lists every concept with its place in the syllabus', async () => {
    const h = harness();
    const graph = (await h.get<GraphDto>('/api/graph')).body;
    expect(graph.topics).toHaveLength(17);
    expect(graph.syllabus.source).toBe('transcription');
    expect(graph.syllabus.hoursPerYear).toBe(136);
    const ids = new Set(graph.skills.map((skill) => skill.id));
    for (const skill of graph.skills) {
      for (const prereq of skill.prereqs) expect(ids.has(prereq)).toBe(true);
      // Only school concepts may claim a place on the school syllabus.
      if (skill.topic !== null) expect(skill.track).toBe('school');
    }
    expect((await h.get('/api/concepts/no.such')).status).toBe(404);
  });

  it('computes analytics from the log', async () => {
    const h = harness();
    const empty = (await h.get<AnalyticsDto>('/api/analytics')).body;
    expect(empty.totals.problems).toBe(0);
    expect(empty.totals.accuracy).toBeNull();

    await practise(h, 'lin.graph', 4);
    h.advance(DAY);
    await practise(h, 'quad.graph', 4);
    const analytics = (await h.get<AnalyticsDto>('/api/analytics')).body;
    expect(analytics.totals).toMatchObject({ problems: 8, solved: 8, unaided: 8, accuracy: 1, activeDays: 2 });
    expect(analytics.weekly.reduce((sum, week) => sum + week.problems, 0)).toBe(8);
    expect(analytics.contexts.find((entry) => entry.context === 'blocked')!.problems).toBe(8);
    expect(Object.values(analytics.levels).reduce((sum, n) => sum + n, 0)).toBeGreaterThan(0);
  });

  it('exports everything as JSON and recomputes on request', async () => {
    const h = harness();
    await practise(h, 'lin.graph', 2);
    const dump = await h.get<{ tables: Record<string, unknown[]> }>('/api/admin/export');
    expect(dump.headers.get('content-disposition')).toContain('lemma-export-');
    expect(dump.body.tables.problems).toHaveLength(2);
    expect(JSON.stringify(dump.body)).not.toContain('password_hash');
    const recomputed = (await h.send<{ skills: number; problems: number }>('POST', '/api/admin/recompute')).body;
    expect(recomputed.problems).toBe(2);
  });
});

describe('FIT roadmap, missions and the forge', () => {
  it('serves dated, sourced FIT data and keeps official and recommended apart', async () => {
    const h = harness();
    const fit = (await h.get<FitDto>('/api/fit')).body;
    expect(fit.snapshot.retrievedOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(fit.snapshot.stale).toBe(false);
    expect(fit.snapshot.sources.length).toBeGreaterThan(0);
    for (const source of fit.snapshot.sources) expect(source.url).toMatch(/^https:\/\//);
    // Every stated fact points at one of the listed official sources.
    const urls = new Set(fit.snapshot.sources.map((source) => source.url));
    for (const fact of [...fit.snapshot.programmeFacts, ...fit.snapshot.admissionFacts])
      expect(urls.has(fact.source)).toBe(true);
    expect(urls.has(fit.snapshot.bridge.source)).toBe(true);
    expect(fit.snapshot.courses.length).toBeGreaterThan(5);
    expect(fit.stages.map((stage) => stage.basis)).toEqual(
      expect.arrayContaining(['school-syllabus', 'official-fit', 'lemma-recommendation']),
    );
    expect(fit.timeline.caveats.length).toBeGreaterThan(0);

    // Past the review date the data is flagged as possibly out of date.
    h.advance(400 * DAY);
    expect((await h.get<FitDto>('/api/fit')).body.snapshot.stale).toBe(true);
  });

  it('tracks a mission', async () => {
    const h = harness();
    const missions = (await h.get<MissionDto[]>('/api/missions')).body;
    expect(missions.length).toBeGreaterThan(3);
    const mission = missions[0]!;
    expect(mission.status).toBe('idle');
    const updated = (
      await h.send<MissionDto>('PUT', `/api/missions/${mission.id}`, {
        status: 'active',
        notes: 'začínám',
        milestones: [mission.milestones[0]!.id],
        repoUrl: 'https://github.com/jonas/example',
      })
    ).body;
    expect(updated.status).toBe('active');
    expect(updated.notes).toBe('začínám');
    expect(updated.milestones[0]!.done).toBe(true);
    expect(updated.repoUrl).toBe('https://github.com/jonas/example');
    // Unsafe links are not stored.
    const unsafe = (await h.send<MissionDto>('PUT', `/api/missions/${mission.id}`, { repoUrl: 'javascript:alert(1)' }))
      .body;
    expect(unsafe.repoUrl).toBe('https://github.com/jonas/example');
    expect((await h.send('PUT', '/api/missions/nope', {})).status).toBe(404);
  });

  it('works without any forge configured', async () => {
    const h = harness();
    const forge = (await h.get<ForgeDto>('/api/forge')).body;
    expect(forge.configured).toBe(false);
    expect(forge.days).toEqual([]);
  });
});
