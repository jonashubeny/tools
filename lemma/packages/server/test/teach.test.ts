import type {
  ApiError,
  AssignmentDto,
  CompareDto,
  ConceptDetailDto,
  CurriculumDto,
  DashboardDto,
  HistoryItemDto,
  MeDto,
  NoteDto,
  PlanDto,
  SettingsDto,
  StudentDetailDto,
  StudentSummaryDto,
  TeachBriefDto,
  TeachProblemDto,
  TeachSessionDto,
  UserDto,
} from '@lemma/core';
import { canonicalInput, createRng } from '@lemma/core';
import { afterEach, describe, expect, it } from 'vitest';
import type { Learner } from '../src/accounts';
import { createAssignment } from '../src/services/assignments';
import { createExam, finishExam } from '../src/services/exam';
import { allSkills, loadStates } from '../src/services/learner';
import { startDiagnostic, startRun } from '../src/services/practice';
import { selectionFor } from '../src/services/selection';
import { EMA, VOJTA, asAdmin, cleanUp, createUser, instance, playRun, setTeachers, study, withGoal } from './fixtures';
import { type Harness, DAY } from './helpers';

/**
 * Teaching: who may see whose work (scenarios 11–13 of the adaptive-learning brief), what
 * a teacher is shown, what a teacher can set, and the tutoring-session mode.
 *
 * The cast: the administrator teaches Ema and Vojta. Pavla is a second teacher, with
 * Vojta alone. Klára has no teacher. All of it is fiction.
 */

afterEach(cleanUp);

interface Cast {
  h: Harness;
  admin: string;
  ema: string;
  vojta: string;
  pavla: string;
  klara: string;
  /** The learners themselves, for giving them a history through the services. */
  learner: (name: string) => Promise<Learner>;
}

async function cast(): Promise<Cast> {
  const h = instance();
  const admin = await asAdmin(h);
  const [ema, vojta, pavla, klara] = [
    await createUser(h, admin, 'ema'),
    await createUser(h, admin, 'vojta'),
    await createUser(h, admin, 'pavla'),
    await createUser(h, admin, 'klara'),
  ];
  await setTeachers(h, admin, 'ema', ['admin']);
  await setTeachers(h, admin, 'vojta', ['admin', 'pavla']);
  const learner = (name: string): Promise<Learner> => h.accounts.user(name);
  for (const name of ['ema', 'vojta', 'klara']) withGoal((await learner(name)).ctx, 'jpz-9', { name: 'Test' });
  return { h, admin, ema, vojta, pavla, klara, learner };
}

/** Give Ema and Vojta a few days of work each. */
async function withHistories(c: Cast): Promise<{ ema: Learner; vojta: Learner }> {
  const ema = await c.learner('ema');
  const vojta = await c.learner('vojta');
  playRun(ema.ctx, startDiagnostic(ema.ctx), EMA, createRng(3), (row) =>
    row.skill.startsWith('frac.') || row.skill.startsWith('pct.') ? false : undefined,
  );
  playRun(vojta.ctx, startDiagnostic(vojta.ctx), VOJTA, createRng(3));
  // One clock for the instance: the two work on the same days.
  const rngs = { ema: createRng(5), vojta: createRng(6) };
  for (let day = 0; day < 5; day++) {
    study({ advance: () => undefined } as unknown as Harness, ema.ctx, EMA, {
      days: 1,
      perDay: 10,
      seed: rngs.ema.int(1, 9999),
    });
    study({ advance: () => undefined } as unknown as Harness, vojta.ctx, VOJTA, {
      days: 1,
      perDay: 10,
      seed: rngs.vojta.int(1, 9999),
    });
    c.h.advance(DAY);
  }
  return { ema, vojta };
}

const get = <T>(c: Cast, cookie: string, path: string) => c.h.get<T>(path, { Cookie: cookie });
const send = <T>(c: Cast, cookie: string, method: 'POST' | 'PUT' | 'DELETE', path: string, body?: unknown) =>
  c.h.send<T>(method, path, body, { Cookie: cookie });

/** Every teaching route about one learner, with a body that would be valid. */
const TEACH_ROUTES: readonly (readonly ['GET' | 'POST' | 'PUT' | 'DELETE', string, unknown?])[] = [
  ['GET', ''],
  ['GET', '/history'],
  ['GET', '/concepts/frac.concept'],
  ['GET', '/diagnostics/anything'],
  ['GET', '/exams/anything'],
  ['GET', '/notes'],
  ['GET', '/brief'],
  ['GET', '/sessions/anything'],
  ['GET', '/sessions/anything/items/anything'],
  ['PUT', '/goal', { goal: 'jpz-5' }],
  ['POST', '/assignments', { kind: 'practice', skills: ['geom.angles'] }],
  ['DELETE', '/assignments/anything'],
  ['PUT', '/focus/geom.angles', { kind: 'difficulty' }],
  ['DELETE', '/focus/geom.angles'],
  ['POST', '/notes', { body: 'a note' }],
  ['PUT', '/notes/anything', { body: 'changed' }],
  ['DELETE', '/notes/anything'],
  ['POST', '/sessions'],
  ['POST', '/sessions/anything/problems', { skill: 'geom.angles' }],
  ['PUT', '/sessions/anything/items/anything', { outcome: 'helped' }],
  ['POST', '/sessions/anything/items/anything/check', { input: '1' }],
  ['POST', '/sessions/anything/finish', {}],
];

async function refusedEverywhere(c: Cast, cookie: string, student: string, status: number): Promise<void> {
  for (const [method, suffix, body] of TEACH_ROUTES) {
    const path = `/api/teach/students/${student}${suffix}`;
    const response =
      method === 'GET' ? await get<ApiError>(c, cookie, path) : await send<ApiError>(c, cookie, method, path, body);
    expect(response.status, `${method} ${path}`).toBe(status);
  }
}

describe('who may see what', () => {
  it("11 · students cannot access another student's records", async () => {
    const c = await cast();
    const { ema, vojta } = await withHistories(c);
    const before = JSON.stringify(vojta.ctx.db.prepare('SELECT * FROM settings').all());

    // Ema asks for Vojta through every teaching route there is: refused, each one, and nothing happens.
    await refusedEverywhere(c, c.ema, 'vojta', 403);
    // She is not her own teacher either.
    await refusedEverywhere(c, c.ema, 'ema', 403);
    // The gate stands in front of the whole subtree, whatever is asked for beneath it.
    expect((await get<ApiError>(c, c.ema, '/api/teach/students/vojta/no/such/route')).status).toBe(403);
    expect((await get<ApiError>(c, c.admin, '/api/teach/students/vojta/no/such/route')).status).toBe(404);
    expect((await get<ApiError>(c, c.ema, '/api/teach/compare?students=vojta')).status).toBe(403);
    expect((await get<ApiError>(c, c.ema, '/api/teach/compare?students=ema,vojta')).status).toBe(403);
    // Her own list of students is hers, and empty.
    expect((await get<StudentSummaryDto[]>(c, c.ema, '/api/teach/students')).body).toEqual([]);
    expect(JSON.stringify(vojta.ctx.db.prepare('SELECT * FROM settings').all())).toBe(before);
    expect(vojta.ctx.db.prepare('SELECT COUNT(*) AS n FROM assignments').get()).toEqual({ n: 0 });
    expect(vojta.ctx.db.prepare('SELECT COUNT(*) AS n FROM focus').get()).toEqual({ n: 0 });

    // The routes about one's own work reach one's own database and no other: Vojta's ids mean nothing to Ema.
    const his = {
      problem: (vojta.ctx.db.prepare('SELECT id FROM problems LIMIT 1').get() as { id: string }).id,
      run: (vojta.ctx.db.prepare('SELECT id FROM runs LIMIT 1').get() as { id: string }).id,
      diagnostic: (vojta.ctx.db.prepare('SELECT id FROM diagnostics LIMIT 1').get() as { id: string }).id,
      assignment: createAssignment(vojta.ctx, 'admin', { kind: 'practice', skills: ['geom.angles'] }).id,
      exam: finishExam(vojta.ctx, createExam(vojta.ctx, { blueprint: 'jpz-9-practice' }).id).id,
    };
    for (const [method, path] of [
      ['GET', `/api/problems/${his.problem}`],
      ['POST', `/api/problems/${his.problem}/answer`],
      ['POST', `/api/problems/${his.problem}/reveal`],
      ['GET', `/api/runs/${his.run}`],
      ['POST', `/api/runs/${his.run}/next`],
      ['GET', `/api/diagnostics/${his.diagnostic}`],
      ['POST', `/api/assignments/${his.assignment}/start`],
      ['GET', `/api/exams/${his.exam}`],
    ] as const) {
      const response =
        method === 'GET'
          ? await get<ApiError>(c, c.ema, path)
          : await send<ApiError>(c, c.ema, method, path, { input: '1' });
      expect(response.status, `${method} ${path}`).toBe(404);
    }
    // What she sees of her own is her own.
    const mine = (await get<{ tables: Record<string, { id?: string }[]> }>(c, c.ema, '/api/data/export')).body.tables;
    const emaIds = new Set(
      (ema.ctx.db.prepare('SELECT id FROM problems').all() as { id: string }[]).map((row) => row.id),
    );
    expect(mine.problems!.length).toBe(emaIds.size);
    expect(mine.problems!.every((row) => emaIds.has(row.id!))).toBe(true);
    expect(mine.problems!.some((row) => row.id === his.problem)).toBe(false);
    // And nothing of the administration.
    expect((await get<ApiError>(c, c.ema, '/api/admin/users')).status).toBe(403);
    expect((await send<ApiError>(c, c.ema, 'PUT', '/api/admin/users/ema', { teachers: [] })).status).toBe(403);
    // Without a session there is nothing at all.
    expect((await c.h.get('/api/teach/students')).status).toBe(401);
    expect((await c.h.get('/api/teach/students/ema')).status).toBe(401);
  });

  it('12 · students cannot read private tutor notes', async () => {
    const c = await cast();
    await withHistories(c);
    const ema = await c.learner('ema');
    const SECRET = 'Ema krátí zlomky odčítáním — vysvětlit znovu na pizze.';

    const note = (
      await send<NoteDto>(c, c.admin, 'POST', '/api/teach/students/ema/notes', { body: SECRET, skill: 'frac.concept' })
    ).body;
    expect(note).toMatchObject({ student: 'ema', body: SECRET });
    expect(note.skill).toMatchObject({ id: 'frac.concept' });
    // A tutoring session with a private summary, and homework with a line meant for her.
    const session = (await send<TeachSessionDto>(c, c.admin, 'POST', '/api/teach/students/ema/sessions')).body;
    await send(c, c.admin, 'POST', `/api/teach/students/ema/sessions/${session.id}/finish`, {
      covered: ['frac.concept'],
      hard: ['frac.concept'],
      misconceptions: 'TAJNE-MYLNE-PREDSTAVY',
      next: 'TAJNE-PRISTE',
      summary: 'TAJNE-SHRNUTI',
      homework: { skills: ['frac.concept', 'geom.angles'], minutes: 15, note: 'Do pátku, zvládneš to.' },
    });

    // The teacher reads the note back.
    expect((await get<NoteDto[]>(c, c.admin, '/api/teach/students/ema/notes')).body.map((entry) => entry.body)).toEqual(
      [SECRET],
    );

    // Ema cannot ask for it…
    expect((await get<ApiError>(c, c.ema, '/api/teach/students/ema/notes')).status).toBe(403);
    expect(
      (await send<ApiError>(c, c.ema, 'PUT', `/api/teach/students/ema/notes/${note.id}`, { body: 'x' })).status,
    ).toBe(403);
    expect((await get<ApiError>(c, c.ema, `/api/teach/students/ema/sessions/${session.id}`)).status).toBe(403);
    // …it is in nothing the application sends her…
    const hidden = [SECRET, 'TAJNE-MYLNE-PREDSTAVY', 'TAJNE-PRISTE', 'TAJNE-SHRNUTI'];
    for (const path of [
      '/api/me',
      '/api/dashboard',
      '/api/settings',
      '/api/plan',
      '/api/assignments',
      '/api/curriculum',
      '/api/readiness',
      '/api/graph',
      '/api/errors',
      '/api/analytics',
      '/api/concepts/frac.concept',
      '/api/data/export',
    ]) {
      const response = await get<unknown>(c, c.ema, path);
      expect(response.status, path).toBe(200);
      const text = JSON.stringify(response.body);
      for (const secret of hidden) expect(text.includes(secret), `${path} leaks`).toBe(false);
    }
    // …and it is not in her database at all: the notes live with the teacher.
    const tables = (
      ema.ctx.db.prepare(`SELECT name FROM sqlite_master WHERE type = 'table'`).all() as { name: string }[]
    ).map((row) => row.name);
    const everything = tables
      .map((table) => JSON.stringify(ema.ctx.db.prepare(`SELECT * FROM ${table}`).all()))
      .join('\n');
    for (const secret of hidden) expect(everything.includes(secret)).toBe(false);
    expect(ema.ctx.db.prepare('SELECT COUNT(*) AS n FROM student_notes').get()).toEqual({ n: 0 });
    expect(ema.ctx.db.prepare('SELECT COUNT(*) AS n FROM teach_sessions').get()).toEqual({ n: 0 });
    expect(c.h.db.prepare('SELECT COUNT(*) AS n FROM student_notes').get()).toEqual({ n: 1 });

    // What was meant for her does reach her: the homework, with its line.
    const assignments = (await get<AssignmentDto[]>(c, c.ema, '/api/assignments')).body;
    expect(assignments).toHaveLength(1);
    expect(assignments[0]).toMatchObject({
      kind: 'practice',
      note: 'Do pátku, zvládneš to.',
      createdBy: 'admin',
      status: 'open',
    });

    // One teacher's notes are not another's: Pavla sees her own notes about Vojta, not the administrator's.
    const about = (
      await send<NoteDto>(c, c.admin, 'POST', '/api/teach/students/vojta/notes', { body: 'Vojta spěchá.' })
    ).body;
    expect((await get<NoteDto[]>(c, c.pavla, '/api/teach/students/vojta/notes')).body).toEqual([]);
    expect(
      (await send<ApiError>(c, c.pavla, 'PUT', `/api/teach/students/vojta/notes/${about.id}`, { body: 'x' })).status,
    ).toBe(404);
    expect((await send<ApiError>(c, c.pavla, 'DELETE', `/api/teach/students/vojta/notes/${about.id}`)).status).toBe(
      404,
    );
    // A note is found only under the learner it is about.
    expect(
      (await send<ApiError>(c, c.admin, 'PUT', `/api/teach/students/vojta/notes/${note.id}`, { body: 'x' })).status,
    ).toBe(404);
    // Editing and deleting one's own works.
    const edited = (
      await send<NoteDto>(c, c.admin, 'PUT', `/api/teach/students/ema/notes/${note.id}`, { body: 'Už to jde.' })
    ).body;
    expect(edited.body).toBe('Už to jde.');
    expect((await send(c, c.admin, 'DELETE', `/api/teach/students/ema/notes/${note.id}`)).status).toBe(200);
    expect((await get<NoteDto[]>(c, c.admin, '/api/teach/students/ema/notes')).body).toEqual([]);
    expect((await send<ApiError>(c, c.admin, 'POST', '/api/teach/students/ema/notes', { body: '   ' })).status).toBe(
      400,
    );
  });

  it('13 · tutors can inspect only students they are authorized to manage', async () => {
    const c = await cast();
    await withHistories(c);

    // Pavla teaches Vojta, and Vojta only.
    const hers = (await get<StudentSummaryDto[]>(c, c.pavla, '/api/teach/students')).body;
    expect(hers.map((student) => student.username)).toEqual(['vojta']);
    expect((await get<StudentDetailDto>(c, c.pavla, '/api/teach/students/vojta')).status).toBe(200);
    await refusedEverywhere(c, c.pavla, 'ema', 403);
    await refusedEverywhere(c, c.pavla, 'klara', 403);
    expect((await get<ApiError>(c, c.pavla, '/api/teach/compare?students=vojta,ema')).status).toBe(403);
    expect((await get<CompareDto>(c, c.pavla, '/api/teach/compare')).body.students.map((s) => s.username)).toEqual([
      'vojta',
    ]);

    // Being the administrator is not being everybody's teacher: Klára has none.
    const mine = (await get<StudentSummaryDto[]>(c, c.admin, '/api/teach/students')).body;
    expect(mine.map((student) => student.username)).toEqual(['ema', 'vojta']);
    await refusedEverywhere(c, c.admin, 'klara', 403);
    // An account that does not exist is answered exactly like one that is somebody else's.
    const stranger = await get<ApiError>(c, c.pavla, '/api/teach/students/ema');
    const nobody = await get<ApiError>(c, c.pavla, '/api/teach/students/nobody-by-that-name');
    expect(nobody.status).toBe(403);
    expect(nobody.body).toEqual(stranger.body);
    // The administrator, like anybody, is nobody's student.
    await refusedEverywhere(c, c.pavla, 'admin', 403);

    // Only the administrator decides who teaches whom.
    expect((await send<ApiError>(c, c.pavla, 'PUT', '/api/admin/users/ema', { teachers: ['pavla'] })).status).toBe(403);
    expect((await send<ApiError>(c, c.admin, 'PUT', '/api/admin/users/ema', { teachers: ['ema'] })).status).toBe(400);
    expect((await send<ApiError>(c, c.admin, 'PUT', '/api/admin/users/ema', { teachers: ['nobody'] })).status).toBe(
      400,
    );
    expect((await send<ApiError>(c, c.admin, 'PUT', '/api/admin/users/ema', { teachers: 'pavla' })).status).toBe(400);
    const listed = (await get<UserDto[]>(c, c.admin, '/api/admin/users')).body;
    expect(Object.fromEntries(listed.map((user) => [user.username, user.teachers]))).toEqual({
      ema: ['admin'],
      klara: [],
      pavla: [],
      vojta: ['admin', 'pavla'],
    });

    // The relation ends: so does the access, at once, on every route.
    await setTeachers(c.h, c.admin, 'vojta', ['admin']);
    await refusedEverywhere(c, c.pavla, 'vojta', 403);
    expect((await get<StudentSummaryDto[]>(c, c.pavla, '/api/teach/students')).body).toEqual([]);
    // It begins: so does the access.
    await setTeachers(c.h, c.admin, 'klara', ['pavla']);
    expect((await get<StudentDetailDto>(c, c.pavla, '/api/teach/students/klara')).status).toBe(200);
    // An account that is removed is taught by nobody and teaches nobody.
    expect((await send(c, c.admin, 'DELETE', '/api/admin/users/pavla')).status).toBe(200);
    expect(
      c.h.db.prepare(`SELECT COUNT(*) AS n FROM teaching WHERE teacher = 'pavla' OR student = 'pavla'`).get(),
    ).toEqual({ n: 0 });
    expect(
      (await get<UserDto[]>(c, c.admin, '/api/admin/users')).body.find((user) => user.username === 'klara')!.teachers,
    ).toEqual([]);
  });

  it('tells a learner who can see their work', async () => {
    const c = await cast();
    const me = async (cookie: string): Promise<MeDto> => (await get<MeDto>(c, cookie, '/api/me')).body;
    expect(await me(c.ema)).toMatchObject({ teachers: ['admin'], students: 0 });
    expect(await me(c.vojta)).toMatchObject({ teachers: ['admin', 'pavla'], students: 0 });
    expect(await me(c.klara)).toMatchObject({ teachers: [], students: 0 });
    expect(await me(c.pavla)).toMatchObject({ teachers: [], students: 1 });
    expect(await me(c.admin)).toMatchObject({ teachers: [], students: 2 });
    // Nothing of it before signing in.
    expect((await c.h.get<MeDto>('/api/me')).body).toMatchObject({ authenticated: false, teachers: [], students: 0 });
  });
});

describe('what a teacher is shown', () => {
  it('each student as they are: what is understood, what is in the way, what to do next', async () => {
    const c = await cast();
    const { ema } = await withHistories(c);
    await setTeachers(c.h, c.admin, 'klara', ['admin']);

    const students = (await get<StudentSummaryDto[]>(c, c.admin, '/api/teach/students')).body;
    const [emaSummary, klaraSummary, vojtaSummary] = ['ema', 'klara', 'vojta'].map((name) =>
      students.find((student) => student.username === name)!,
    );
    // Somebody who has not started: the first thing is the placement test, and readiness says nothing.
    expect(klaraSummary).toMatchObject({ diagnosed: false, lastActiveAt: null, openAssignments: 0 });
    expect(klaraSummary!.intervention).toMatchObject({ kind: 'run-diagnostic', reason: 'no-placement' });
    expect(klaraSummary!.readiness!.verdict).toBe('no-data');
    expect(klaraSummary!.week.problems).toBe(0);
    // Two who have: the week's work, with first tries and hints kept apart from plain "solved".
    for (const summary of [emaSummary!, vojtaSummary!]) {
      expect(summary.diagnosed).toBe(true);
      expect(summary.goal).toMatchObject({ id: 'jpz-9', kind: 'entrance' });
      expect(summary.week.problems).toBeGreaterThanOrEqual(50);
      expect(summary.week.activeDays).toBeGreaterThanOrEqual(5);
      expect(summary.week.firstTry).toBeLessThanOrEqual(summary.week.solved);
      expect(summary.week.unaided).toBeLessThanOrEqual(summary.week.firstTry);
      expect(summary.week.minutes).toBeGreaterThan(0);
      expect(Object.values(summary.paths).reduce((sum, n) => sum + n, 0)).toBe(35);
    }
    expect(vojtaSummary!.week.solved / vojtaSummary!.week.problems).toBeGreaterThan(
      emaSummary!.week.solved / emaSummary!.week.problems,
    );

    const detail = (await get<StudentDetailDto>(c, c.admin, '/api/teach/students/ema')).body;
    expect(detail.skills).toHaveLength(36);
    // The data is Ema's, not the teacher's own.
    const emaStates = loadStates(ema.ctx);
    const shown = detail.skills.find((skill) => skill.id === 'frac.concept')!;
    expect(shown.attempts).toBe(emaStates.get('frac.concept')!.attempts);
    expect(allSkills(c.h.ctx).every((skill) => skill.attempts === 0)).toBe(true);
    // Her path begins with fractions, and says so.
    expect(detail.path[0]!.skill.id.startsWith('frac.')).toBe(true);
    expect(detail.path[0]!.purpose).toBe('repair');
    expect(detail.diagnostics).toHaveLength(1);
    expect(detail.diagnostics[0]!.verdicts.find((entry) => entry.skill === 'frac.operations')!.verdict).toBe('gap');
    // Progress by area, effort by week, errors by kind: each a figure with its base.
    expect(detail.areas.map((area) => area.area)).toEqual(expect.arrayContaining(['numbers', 'geometry']));
    expect(detail.weekly).toHaveLength(8);
    expect(detail.weekly[7]!.problems + detail.weekly[6]!.problems).toBeGreaterThanOrEqual(50);
    expect(detail.totals.problems).toBeGreaterThanOrEqual(60);
    expect(detail.totals.firstTry).toBeLessThanOrEqual(detail.totals.solved);
    expect(detail.timed.timed.problems).toBe(0);
    expect(detail.heatmap.some((cell) => cell.score > 0)).toBe(true);
    expect(detail.readiness!.gaps.map((gap) => gap.id).some((id) => id.startsWith('frac.'))).toBe(true);
    // The recommendation follows from what was flagged, by a rule that is named.
    expect(['explain', 'assign-remediation', 'assign-review', 'keep-going']).toContain(detail.intervention.kind);
    expect(detail.intervention.reason.length).toBeGreaterThan(0);

    // Her solutions, as she typed them.
    const history = (await get<HistoryItemDto[]>(c, c.admin, '/api/teach/students/ema/history?limit=5')).body;
    expect(history).toHaveLength(5);
    expect(history[0]!.at).toBeGreaterThanOrEqual(history[4]!.at);
    for (const item of history) {
      expect(item.prompt.cs.length).toBeGreaterThan(0);
      expect(item.inputs.length).toBeGreaterThanOrEqual(item.status === 'solved' ? 1 : 0);
      expect(item.answerTex.cs.length + (item.answerText?.cs.length ?? 0)).toBeGreaterThan(0);
    }
    const mistakes = (
      await get<HistoryItemDto[]>(c, c.admin, '/api/teach/students/ema/history?skill=frac.concept&mistakes=1&limit=50')
    ).body;
    expect(mistakes.length).toBeGreaterThan(0);
    expect(
      mistakes.every((item) => item.skill === 'frac.concept' && (item.status !== 'solved' || !item.firstTry)),
    ).toBe(true);
    expect(mistakes.some((item) => item.inputs.some((entry) => entry.verdict === 'incorrect'))).toBe(true);
    // Older pages.
    const older = (
      await get<HistoryItemDto[]>(c, c.admin, `/api/teach/students/ema/history?limit=5&before=${history[4]!.at}`)
    ).body;
    expect(older.every((item) => item.at < history[4]!.at)).toBe(true);
    // One skill of hers in full: the gates she still has to pass.
    const concept = (await get<ConceptDetailDto>(c, c.admin, '/api/teach/students/ema/concepts/frac.concept')).body;
    expect(concept.stats.attempts).toBe(emaStates.get('frac.concept')!.attempts);
    expect(concept.next).not.toBeNull();
    // A practice test of hers can be read once it is finished, and only then.
    const running = createExam(ema.ctx, { blueprint: 'jpz-9-practice' });
    expect((await get<ApiError>(c, c.admin, `/api/teach/students/ema/exams/${running.id}`)).status).toBe(404);
    expect(
      (ema.ctx.db.prepare('SELECT finished_at FROM exams WHERE id = ?').get(running.id) as { finished_at: null })
        .finished_at,
    ).toBeNull();
    finishExam(ema.ctx, running.id);
    expect(
      (await get<{ report: unknown }>(c, c.admin, `/api/teach/students/ema/exams/${running.id}`)).body.report,
    ).not.toBeNull();
  });

  it('two students beside each other, without a ranking', async () => {
    const c = await cast();
    await withHistories(c);
    const compared = (await get<CompareDto>(c, c.admin, '/api/teach/compare?students=ema,vojta')).body;
    expect(compared.students.map((student) => student.username)).toEqual(['ema', 'vojta']);
    expect(compared.skills).toHaveLength(35);
    for (const row of compared.skills) {
      expect(Object.keys(row.cells).sort()).toEqual(['ema', 'vojta']);
      expect(row.cells.ema).toMatchObject({ role: expect.any(String) });
    }
    // The difference shows where it is: on fractions.
    const fractions = compared.skills.find((row) => row.id === 'frac.operations')!;
    expect(fractions.cells.vojta!.level).toBeGreaterThanOrEqual(fractions.cells.ema!.level);
    expect(Object.keys(compared.weekly).sort()).toEqual(['ema', 'vojta']);
    // No total, no order of merit, no single number per student.
    const text = JSON.stringify(compared);
    for (const word of ['rank', 'score"', 'overall', 'position']) expect(text.includes(word), word).toBe(false);
    // Students with different goals can be put side by side too: a skill one of them does not have is empty.
    await send(c, c.admin, 'PUT', '/api/teach/students/ema/goal', { goal: 'jpz-5' });
    const mixed = (await get<CompareDto>(c, c.admin, '/api/teach/compare')).body;
    expect(mixed.skills.find((row) => row.id === 'eqn.linear')!.cells).toMatchObject({ ema: null });
    expect(mixed.skills.find((row) => row.id === 'eqn.linear')!.cells.vojta).not.toBeNull();
  });
});

describe('a student who is not preparing for an examination', () => {
  it('is taught the same way: seen, set work that arrives, and shown problems', async () => {
    const c = await cast();
    // Klára follows the second-year syllabus; the administrator becomes her teacher.
    const klara = await c.learner('klara');
    withGoal(klara.ctx, 'school-it-2', { name: 'Klára' });
    await setTeachers(c.h, c.admin, 'klara', ['admin']);
    for (const concept of ['quad.graph', 'lin.graph']) {
      playRun(klara.ctx, startRun(klara.ctx, { context: 'blocked', concept, count: 5 }), VOJTA, createRng(7));
      c.h.advance(DAY);
    }

    const listed = (await get<StudentSummaryDto[]>(c, c.admin, '/api/teach/students')).body.find(
      (student) => student.username === 'klara',
    )!;
    expect(listed.goal).toMatchObject({ id: 'school-it-2', kind: 'school' });
    // No examination: no readiness, and no placement test to ask for.
    expect(listed.readiness).toBeNull();
    expect(listed.attention.map((flag) => flag.kind)).not.toContain('no-diagnostic');
    expect(listed.intervention.kind).not.toBe('run-diagnostic');
    expect(listed.week.problems + listed.previousWeek.problems).toBe(10);

    const detail = (await get<StudentDetailDto>(c, c.admin, '/api/teach/students/klara')).body;
    expect(detail.skills).toHaveLength(65);
    expect(detail.skills.find((skill) => skill.id === 'quad.graph')!.attempts).toBe(5);
    expect(detail.diagnostics).toEqual([]);
    expect((await get<HistoryItemDto[]>(c, c.admin, '/api/teach/students/klara/history')).body.length).toBe(10);
    expect((await get<ConceptDetailDto>(c, c.admin, '/api/teach/students/klara/concepts/quad.graph')).status).toBe(200);
    expect((await get<TeachBriefDto>(c, c.admin, '/api/teach/students/klara/brief')).status).toBe(200);
    // Beside a student of an examination goal: each has only the skills of their own goal.
    const compared = (await get<CompareDto>(c, c.admin, '/api/teach/compare?students=ema,klara')).body;
    expect(compared.skills.find((row) => row.id === 'quad.graph')!.cells).toMatchObject({ ema: null });
    expect(compared.skills.find((row) => row.id === 'frac.concept')!.cells).toMatchObject({ klara: null });

    // Work set for her is in front of her plan and on her first page, and she can start it there.
    const before = (await get<PlanDto>(c, c.klara, '/api/plan')).body.blocks.map((block) => block.id);
    const set = await send<AssignmentDto>(c, c.admin, 'POST', '/api/teach/students/klara/assignments', {
      kind: 'practice',
      skills: ['quad.graph'],
      count: 3,
      note: 'Před písemkou.',
    });
    expect(set.status).toBe(200);
    const plan = (await get<PlanDto>(c, c.klara, '/api/plan')).body;
    expect(plan.blocks[0]).toMatchObject({ id: `assigned:${set.body.id}`, kind: 'assigned', status: 'todo' });
    expect(plan.blocks.slice(1).map((block) => block.id)).toEqual(before);
    const page = (await get<DashboardDto>(c, c.klara, '/api/dashboard')).body;
    expect(page.entrance).toBeNull();
    expect(page.assignments[0]).toMatchObject({ id: set.body.id, note: 'Před písemkou.', createdBy: 'admin' });
    const started = await send<{ run: { id: string; total: number } }>(
      c,
      c.klara,
      'POST',
      `/api/plan/blocks/${encodeURIComponent(plan.blocks[0]!.id)}/start`,
    );
    expect(started.status).toBe(200);
    expect(started.body.run.total).toBe(3);
    // A skill of somebody else's curriculum cannot be set for her.
    expect(
      (
        await send<ApiError>(c, c.admin, 'POST', '/api/teach/students/klara/assignments', {
          kind: 'practice',
          skills: ['frac.concept'],
        })
      ).status,
    ).toBe(400);

    // A tutoring session works on her syllabus, and its homework reaches her.
    const session = (await send<TeachSessionDto>(c, c.admin, 'POST', '/api/teach/students/klara/sessions')).body;
    expect(session.skills.some((skill) => skill.id === 'quad.graph')).toBe(true);
    expect(session.skills.some((skill) => skill.id === 'frac.concept')).toBe(false);
    const shown = await send<TeachProblemDto>(
      c,
      c.admin,
      'POST',
      `/api/teach/students/klara/sessions/${session.id}/problems`,
      { skill: 'quad.graph' },
    );
    expect(shown.status).toBe(200);
    const wrapped = await send<TeachSessionDto>(
      c,
      c.admin,
      'POST',
      `/api/teach/students/klara/sessions/${session.id}/finish`,
      { covered: ['quad.graph'], hard: [], improved: [], homework: { skills: ['quad.vertex'], minutes: 10, note: '' } },
    );
    expect(wrapped.status).toBe(200);
    const hers = (await get<AssignmentDto[]>(c, c.klara, '/api/assignments')).body.filter(
      (entry) => entry.status === 'open',
    );
    expect(hers.map((entry) => entry.skills.map((skill) => skill.id))).toEqual([['quad.graph'], ['quad.vertex']]);
  });
});

describe('what a teacher can set', () => {
  it('the goal and the date, work to do, and a skill to come back to', async () => {
    const c = await cast();
    await withHistories(c);
    const ema = await c.learner('ema');

    // The goal and the examination date — and nothing else of her settings.
    const changed = await send<StudentSummaryDto>(c, c.admin, 'PUT', '/api/teach/students/ema/goal', {
      examDay: '2027-04-12',
      inSchool: ['pct.basics'],
      name: 'Changed by teacher',
      theme: 'light',
      sessionMinutes: 180,
    });
    expect(changed.body).toMatchObject({ examDay: '2027-04-12' });
    expect(changed.body.daysLeft).toBeGreaterThan(100);
    const settings = (await get<SettingsDto>(c, c.ema, '/api/settings')).body;
    expect(settings).toMatchObject({
      goal: 'jpz-9',
      examDay: '2027-04-12',
      inSchool: ['pct.basics'],
      name: 'Test',
      theme: 'dark',
      sessionMinutes: 30,
    });
    expect((await get<DashboardDto>(c, c.ema, '/api/dashboard')).body.entrance!.readiness.examDay).toBe('2027-04-12');

    // An exercise set: her plan has it at once, first, with the teacher's line.
    const created = await send<AssignmentDto>(c, c.admin, 'POST', '/api/teach/students/ema/assignments', {
      kind: 'practice',
      skills: ['geom.angles', 'geom.perimeter-area'],
      count: 6,
      dueDay: '2026-10-20',
      note: 'Úhly a obsahy, do úterý.',
    });
    expect(created.status).toBe(200);
    expect(created.body).toMatchObject({
      kind: 'practice',
      count: 6,
      dueDay: '2026-10-20',
      createdBy: 'admin',
      status: 'open',
    });
    const plan = (await get<PlanDto>(c, c.ema, '/api/plan')).body;
    expect(plan.blocks[0]).toMatchObject({ kind: 'assigned', id: `assigned:${created.body.id}` });
    expect(plan.blocks[0]!.assignment!.note).toBe('Úhly a obsahy, do úterý.');
    expect((await get<DashboardDto>(c, c.ema, '/api/dashboard')).body.assignments[0]).toMatchObject({
      id: created.body.id,
    });
    expect(
      (await get<StudentSummaryDto[]>(c, c.admin, '/api/teach/students')).body.find((s) => s.username === 'ema')!
        .openAssignments,
    ).toBe(1);
    // She cannot set work for herself, or withdraw it.
    expect(
      (await send<ApiError>(c, c.ema, 'POST', '/api/assignments', { kind: 'practice', skills: ['geom.angles'] }))
        .status,
    ).toBe(404);
    expect((await send<ApiError>(c, c.ema, 'DELETE', `/api/assignments/${created.body.id}`)).status).toBe(404);

    // The other kinds: a review, a remediation, a lesson, a timed test.
    for (const request of [
      { kind: 'review', skills: [] },
      { kind: 'remediation', skills: ['frac.operations'] },
      { kind: 'lesson', skills: ['geom.pythagoras'] },
      { kind: 'test', skills: [] },
    ]) {
      const response = await send<AssignmentDto>(c, c.admin, 'POST', '/api/teach/students/ema/assignments', request);
      expect(response.status, request.kind).toBe(200);
    }
    // What makes no sense is refused with a reason.
    for (const request of [
      { kind: 'practice', skills: [] },
      { kind: 'practice', skills: ['quad.vertex'] },
      { kind: 'essay', skills: ['geom.angles'] },
      { kind: 'remediation', skills: ['geom.angles', 'geom.circle'] },
    ]) {
      expect((await send<ApiError>(c, c.admin, 'POST', '/api/teach/students/ema/assignments', request)).status).toBe(
        400,
      );
    }
    expect(
      (
        await send<ApiError>(c, c.admin, 'POST', '/api/teach/students/ema/assignments', {
          kind: 'practice',
          skills: ['geom.constructions'],
        })
      ).status,
    ).toBe(422);

    // Withdrawn: gone from her plan.
    const withdrawn = await send<AssignmentDto>(
      c,
      c.admin,
      'DELETE',
      `/api/teach/students/ema/assignments/${created.body.id}`,
    );
    expect(withdrawn.body.status).toBe('cancelled');
    expect(
      (await get<PlanDto>(c, c.ema, '/api/plan')).body.blocks.some(
        (block) => block.id === `assigned:${created.body.id}`,
      ),
    ).toBe(false);

    // A skill marked to come back to: it moves up in what is selected for her, and changes no level.
    const levelBefore = allSkills(ema.ctx).find((skill) => skill.id === 'solid.views')!.level;
    const scoreBefore = selectionFor(ema.ctx).scored.find((entry) => entry.id === 'solid.views')!.score;
    expect(
      (await send(c, c.admin, 'PUT', '/api/teach/students/ema/focus/solid.views', { kind: 'difficulty' })).status,
    ).toBe(200);
    const after = selectionFor(ema.ctx).scored.find((entry) => entry.id === 'solid.views')!;
    expect(after.score).toBeGreaterThan(scoreBefore);
    expect(after.terms.assigned).toBeCloseTo(0.6, 6);
    expect(allSkills(ema.ctx).find((skill) => skill.id === 'solid.views')!.level).toBe(levelBefore);
    expect(
      (await get<CurriculumDto>(c, c.ema, '/api/curriculum')).body.skills.find((skill) => skill.id === 'solid.views')!
        .focus,
    ).toBe('difficulty');
    expect(
      (await get<StudentDetailDto>(c, c.admin, '/api/teach/students/ema')).body.focus.map((entry) => entry.skill),
    ).toEqual(['solid.views']);
    expect(
      (await send<ApiError>(c, c.admin, 'PUT', '/api/teach/students/ema/focus/solid.views', { kind: 'mastered' }))
        .status,
    ).toBe(400);
    expect(
      (await send<ApiError>(c, c.admin, 'PUT', '/api/teach/students/ema/focus/quad.vertex', { kind: 'covered' }))
        .status,
    ).toBe(400);
    await send(c, c.admin, 'DELETE', '/api/teach/students/ema/focus/solid.views');
    expect(selectionFor(ema.ctx).scored.find((entry) => entry.id === 'solid.views')!.terms.assigned).toBe(0);
  });
});

describe('a tutoring session', () => {
  it('before, during and after — and what it changes', async () => {
    const c = await cast();
    await withHistories(c);
    const ema = await c.learner('ema');
    const base = '/api/teach/students/ema';

    // Before: where she is strong, what is in the way, what went wrong, and an order for the hour.
    const brief = (await get<TeachBriefDto>(c, c.admin, `${base}/brief`)).body;
    expect(brief.strongest.length).toBeGreaterThan(0);
    expect(brief.gaps.some((gap) => gap.id.startsWith('frac.'))).toBe(true);
    expect(brief.mistakes.length).toBeGreaterThan(0);
    expect(brief.priorities[0]!.skill.id.startsWith('frac.')).toBe(true);
    const kinds = brief.sequence.map((step) => step.kind);
    expect(kinds[0]).toBe('warm-up');
    expect(kinds).toEqual(expect.arrayContaining(['explain', 'practise', 'homework']));
    expect(brief.sequence.every((step) => step.reason.length > 0 && step.minutes > 0)).toBe(true);
    const explain = brief.sequence.find((step) => step.kind === 'explain' && step.skill)!;
    expect(brief.gaps.map((gap) => gap.id)).toContain(explain.skill!.id);
    expect(brief.since).toMatchObject({ lastSessionAt: null, next: '' });

    const problemsBefore = (ema.ctx.db.prepare('SELECT COUNT(*) AS n FROM problems').get() as { n: number }).n;
    const statesBefore = JSON.stringify(
      ema.ctx.db.prepare('SELECT skill, state FROM skill_state ORDER BY skill').all(),
    );

    // During: pick a skill, show a problem; the teacher has the solution, and can check what she says.
    const session = (await send<TeachSessionDto>(c, c.admin, 'POST', `${base}/sessions`)).body;
    expect(session).toMatchObject({ student: 'ema', finishedAt: null, items: [], wrap: null });
    expect(session.brief.priorities).toEqual(brief.priorities);
    expect(session.skills).toHaveLength(35);
    // Asking again goes on with the same session.
    expect((await send<TeachSessionDto>(c, c.admin, 'POST', `${base}/sessions`)).body.id).toBe(session.id);

    const shown = (
      await send<TeachProblemDto>(c, c.admin, 'POST', `${base}/sessions/${session.id}/problems`, {
        skill: 'frac.concept',
        level: 1,
      })
    ).body;
    expect(shown.item).toMatchObject({ skill: 'frac.concept', level: 1, outcome: null });
    expect(shown.solution.length).toBeGreaterThan(0);
    expect(shown.answerTex.cs.length).toBeGreaterThan(0);
    // The same problem again after a reload.
    const reloaded = (await get<TeachProblemDto>(c, c.admin, `${base}/sessions/${session.id}/items/${shown.item.id}`))
      .body;
    expect(reloaded.prompt).toEqual(shown.prompt);

    const generator = (await import('@lemma/content')).getGenerator(shown.item.generator)!;
    const right = canonicalInput(generator.generate(createRng(shown.item.seed), shown.item.level).answer);
    const check = async (input: string) =>
      (
        await send<{ verdict: string }>(
          c,
          c.admin,
          'POST',
          `${base}/sessions/${session.id}/items/${shown.item.id}/check`,
          { input },
        )
      ).body;
    expect(await check(right)).toMatchObject({ verdict: 'correct' });
    expect((await check('123456789')).verdict).not.toBe('correct');

    const recorded = (
      await send<TeachSessionDto>(c, c.admin, 'PUT', `${base}/sessions/${session.id}/items/${shown.item.id}`, {
        outcome: 'not-yet',
        note: 'Plete si celek a část.',
      })
    ).body;
    expect(recorded.items[0]).toMatchObject({ outcome: 'not-yet', note: 'Plete si celek a část.' });
    expect(
      (
        await send<ApiError>(c, c.admin, 'PUT', `${base}/sessions/${session.id}/items/${shown.item.id}`, {
          outcome: 'perfect',
        })
      ).status,
    ).toBe(400);
    // Another of the same skill comes in another form; a level by her estimate when none is named.
    const second = (
      await send<TeachProblemDto>(c, c.admin, 'POST', `${base}/sessions/${session.id}/problems`, {
        skill: 'frac.concept',
        level: 1,
      })
    ).body;
    expect(second.item.generator).not.toBe(shown.item.generator);
    const third = (
      await send<TeachProblemDto>(c, c.admin, 'POST', `${base}/sessions/${session.id}/problems`, {
        skill: 'geom.angles',
      })
    ).body;
    expect(third.item.level).toBeGreaterThanOrEqual(1);
    expect(
      (
        await send<ApiError>(c, c.admin, 'POST', `${base}/sessions/${session.id}/problems`, {
          skill: 'geom.constructions',
        })
      ).status,
    ).toBe(422);
    expect(
      (await send<ApiError>(c, c.admin, 'POST', `${base}/sessions/${session.id}/problems`, { skill: 'quad.vertex' }))
        .status,
    ).toBe(400);

    // Nothing of this is Ema's own work: her log and her levels are exactly as they were.
    expect((ema.ctx.db.prepare('SELECT COUNT(*) AS n FROM problems').get() as { n: number }).n).toBe(problemsBefore);
    expect(JSON.stringify(ema.ctx.db.prepare('SELECT skill, state FROM skill_state ORDER BY skill').all())).toBe(
      statesBefore,
    );

    // After: what was covered, what was hard, homework, and what to do next time.
    const finished = (
      await send<TeachSessionDto>(c, c.admin, 'POST', `${base}/sessions/${session.id}/finish`, {
        covered: ['frac.concept', 'geom.angles', 'quad.vertex'],
        improved: ['geom.angles'],
        hard: ['frac.concept'],
        misconceptions: 'Čitatel bere jako počet dílků celku.',
        homework: {
          skills: ['frac.concept', 'geom.angles'],
          minutes: 15,
          dueDay: '2026-10-19',
          note: 'Stačí čtvrt hodiny.',
        },
        next: 'Sčítání zlomků se stejným jmenovatelem.',
        summary: 'Šlo to pomalu, ale drží se.',
      })
    ).body;
    expect(finished.finishedAt).not.toBeNull();
    expect(finished.wrap).toMatchObject({
      covered: ['frac.concept', 'geom.angles'],
      improved: ['geom.angles'],
      hard: ['frac.concept'],
      next: 'Sčítání zlomků se stejným jmenovatelem.',
    });
    expect(finished.wrap!.homework).toMatchObject({
      skills: ['frac.concept', 'geom.angles'],
      minutes: 15,
      dueDay: '2026-10-19',
    });

    // What it changes for Ema: what she is given next…
    const focus = Object.fromEntries(
      (ema.ctx.db.prepare('SELECT skill, kind FROM focus').all() as { skill: string; kind: string }[]).map((row) => [
        row.skill,
        row.kind,
      ]),
    );
    expect(focus).toEqual({ 'frac.concept': 'difficulty', 'geom.angles': 'covered' });
    const scored = selectionFor(ema.ctx).scored;
    expect(scored.find((entry) => entry.id === 'frac.concept')!.terms.assigned).toBeGreaterThanOrEqual(1);
    const plan = (await get<PlanDto>(c, c.ema, '/api/plan')).body;
    expect(plan.blocks[0]).toMatchObject({ kind: 'assigned' });
    expect(plan.blocks[0]!.assignment).toMatchObject({
      kind: 'practice',
      note: 'Stačí čtvrt hodiny.',
      dueDay: '2026-10-19',
    });
    // …and what it does not: no level moved because a topic was discussed, not even the one that "improved".
    expect(JSON.stringify(ema.ctx.db.prepare('SELECT skill, state FROM skill_state ORDER BY skill').all())).toBe(
      statesBefore,
    );
    expect((ema.ctx.db.prepare('SELECT COUNT(*) AS n FROM problems').get() as { n: number }).n).toBe(problemsBefore);

    // A finished session is a record: nothing more is added to it.
    expect(
      (await send<ApiError>(c, c.admin, 'POST', `${base}/sessions/${session.id}/problems`, { skill: 'geom.angles' }))
        .status,
    ).toBe(409);
    expect((await send<ApiError>(c, c.admin, 'POST', `${base}/sessions/${session.id}/finish`, {})).status).toBe(409);

    // Next time, the brief begins where this one ended.
    c.h.advance(3 * DAY);
    const next = (await get<TeachBriefDto>(c, c.admin, `${base}/brief`)).body;
    expect(next.since.lastSessionAt).toBe(finished.finishedAt);
    expect(next.since.next).toBe('Sčítání zlomků se stejným jmenovatelem.');
    expect(next.since.homework.map((entry) => entry.note)).toContain('Stačí čtvrt hodiny.');
    expect(next.sequence.some((step) => step.kind === 'check' && step.skill?.id === 'frac.concept')).toBe(true);
    const detail = (await get<StudentDetailDto>(c, c.admin, base)).body;
    expect(detail.sessions).toHaveLength(1);
    expect(detail.sessions[0]).toMatchObject({
      id: session.id,
      items: 3,
      next: 'Sčítání zlomků se stejným jmenovatelem.',
    });
    expect(detail.sessions[0]!.covered.map((skill) => skill.id)).toEqual(['frac.concept', 'geom.angles']);
    // A new session can begin.
    expect((await send<TeachSessionDto>(c, c.admin, 'POST', `${base}/sessions`)).body.id).not.toBe(session.id);
  });
});
