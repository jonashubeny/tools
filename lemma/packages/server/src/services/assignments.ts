import { blueprintsOfGoal, conceptsOfGoal, getConcept, getLesson, hasProblems } from '@lemma/content';
import {
  ASSIGNMENT_KINDS,
  L,
  isDay,
  type AssignmentDto,
  type AssignmentKind,
  type CreateAssignmentRequest,
  type FocusDto,
} from '@lemma/core';
import { fromJson, toJson } from '../db';
import { type Ctx, HttpError, badRequest, goalOf, newId, notFound } from './context';

/**
 * Work a teacher has set for a learner, and what the teacher noted about single skills.
 *
 * Both are kept in the learner's own database, because that is where the plan and the
 * selection read them. They are written by the teaching routes and by nothing else; the
 * learner's own routes only read them and mark an assignment done by doing it.
 */

export interface AssignmentRow {
  id: string;
  kind: AssignmentKind;
  skills: string;
  note: string;
  minutes: number;
  count: number | null;
  due_day: string | null;
  created_by: string;
  created_at: number;
  status: 'open' | 'done' | 'cancelled';
  done_at: number | null;
  run_id: string | null;
  exam_id: string | null;
}

export const skillsOf = (row: AssignmentRow): string[] => fromJson<string[]>(row.skills, []);

const titled = (id: string): { id: string; title: AssignmentDto['skills'][number]['title'] } => ({
  id,
  title: getConcept(id)?.title ?? L(id, id),
});

export function assignmentRow(ctx: Ctx, id: string): AssignmentRow {
  const row = ctx.db.prepare('SELECT * FROM assignments WHERE id = ?').get(id) as AssignmentRow | undefined;
  if (!row) throw notFound('assignment');
  return row;
}

/** Open assignments, the ones due soonest first, then in the order they were set. */
export function openAssignments(ctx: Ctx): AssignmentRow[] {
  return ctx.db
    .prepare(
      `SELECT * FROM assignments WHERE status = 'open'
       ORDER BY CASE WHEN due_day IS NULL THEN 1 ELSE 0 END, due_day, created_at, rowid`,
    )
    .all() as AssignmentRow[];
}

export function assignmentDto(ctx: Ctx, row: AssignmentRow): AssignmentDto {
  // How it went so far, from the log: the problems of its run, or of its test.
  const figures = (
    row.run_id !== null
      ? ctx.db.prepare(`${RESULT_SQL} WHERE run_id = ? AND status IN ('solved', 'failed')`).get(row.run_id)
      : row.exam_id !== null
        ? ctx.db.prepare(`${RESULT_SQL} WHERE exam_id = ? AND status IN ('solved', 'failed')`).get(row.exam_id)
        : undefined
  ) as { problems: number; solved: number | null; unaided: number | null; hinted: number | null } | undefined;
  return {
    id: row.id,
    kind: row.kind,
    skills: skillsOf(row).map(titled),
    note: row.note,
    minutes: row.minutes,
    count: row.count,
    dueDay: row.due_day,
    createdBy: row.created_by,
    createdAt: row.created_at,
    status: row.status,
    doneAt: row.done_at,
    result:
      figures && figures.problems > 0
        ? {
            problems: figures.problems,
            solved: figures.solved ?? 0,
            unaided: figures.unaided ?? 0,
            hinted: figures.hinted ?? 0,
          }
        : null,
  };
}

const RESULT_SQL = `SELECT COUNT(*) AS problems,
    SUM(CASE WHEN status = 'solved' THEN 1 ELSE 0 END) AS solved,
    SUM(CASE WHEN status = 'solved' AND first_try = 1 AND hints_used + tutor_used = 0 THEN 1 ELSE 0 END) AS unaided,
    SUM(CASE WHEN hints_used + tutor_used > 0 THEN 1 ELSE 0 END) AS hinted
  FROM problems`;

/** Open ones first, then what was finished or withdrawn most recently. */
export function listAssignments(ctx: Ctx, closedLimit = 20): AssignmentDto[] {
  const closed = ctx.db
    .prepare(`SELECT * FROM assignments WHERE status != 'open' ORDER BY COALESCE(done_at, created_at) DESC LIMIT ?`)
    .all(closedLimit) as AssignmentRow[];
  return [...openAssignments(ctx), ...closed].map((row) => assignmentDto(ctx, row));
}

const clamp = (value: unknown, min: number, max: number, fallback: number): number => {
  const n = typeof value === 'number' && Number.isFinite(value) ? Math.round(value) : fallback;
  return Math.min(max, Math.max(min, n));
};

/** How many skills each kind takes. */
const SKILL_LIMITS: Readonly<Record<AssignmentKind, readonly [number, number]>> = {
  practice: [1, 8],
  review: [0, 12],
  remediation: [1, 1],
  lesson: [1, 1],
  test: [0, 0],
};

export function createAssignment(ctx: Ctx, by: string, request: CreateAssignmentRequest): AssignmentDto {
  if (!(ASSIGNMENT_KINDS as readonly string[]).includes(request.kind)) throw badRequest('unknown kind of assignment');
  const goal = goalOf(ctx);
  const inGoal = new Set(conceptsOfGoal(goal).map((concept) => concept.id));
  const wanted = [...new Set(Array.isArray(request.skills) ? request.skills : [])].filter(
    (id): id is string => typeof id === 'string',
  );
  const [min, max] = SKILL_LIMITS[request.kind];
  const skills = request.kind === 'test' ? [] : wanted;
  if (skills.length < min || skills.length > max)
    throw badRequest(
      min === max
        ? `this kind of assignment takes ${min} skill(s)`
        : `this kind of assignment takes ${min} to ${max} skills`,
    );
  for (const id of skills) {
    if (!inGoal.has(id)) throw badRequest(`"${id}" is not part of the learner's goal`);
    // A lesson can be read for anything; everything else needs problems to work on.
    if (request.kind !== 'lesson' && !hasProblems(id))
      throw new HttpError(422, 'no_problems', `there are no problems for "${id}": it cannot be practised on a screen`);
  }
  if (request.kind === 'test' && blueprintOf(ctx) === null)
    throw new HttpError(422, 'no_test', 'there is no practice test for this goal');

  const minutes =
    request.kind === 'test'
      ? (blueprintOf(ctx)?.minutes ?? 60)
      : clamp(request.minutes, 5, 90, request.kind === 'lesson' ? 10 : 15);
  const counted = request.kind === 'practice' || request.kind === 'review' || request.kind === 'remediation';
  const count = counted ? clamp(request.count, 2, 20, Math.max(4, Math.min(12, Math.round(minutes / 2)))) : null;
  const dueDay = typeof request.dueDay === 'string' && isDay(request.dueDay) ? request.dueDay : null;
  const note = typeof request.note === 'string' ? request.note.trim().slice(0, 300) : '';

  const id = newId();
  ctx.db
    .prepare(
      `INSERT INTO assignments (id, kind, skills, note, minutes, count, due_day, created_by, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(id, request.kind, toJson(skills), note, minutes, count, dueDay, by, ctx.now());
  return assignmentDto(ctx, assignmentRow(ctx, id));
}

/** The timed test a "test" assignment means for this learner's goal. */
export function blueprintOf(ctx: Ctx): { id: string; minutes: number } | null {
  const offered = blueprintsOfGoal(goalOf(ctx));
  const blueprint = offered.find((b) => b.kind === 'entrance') ?? offered.find((b) => b.kind === 'chapter');
  return blueprint ? { id: blueprint.id, minutes: blueprint.minutes } : null;
}

export function cancelAssignment(ctx: Ctx, id: string): AssignmentDto {
  const row = assignmentRow(ctx, id);
  if (row.status === 'open')
    ctx.db.prepare(`UPDATE assignments SET status = 'cancelled', done_at = ? WHERE id = ?`).run(ctx.now(), id);
  return assignmentDto(ctx, assignmentRow(ctx, id));
}

export function completeAssignment(ctx: Ctx, id: string): void {
  ctx.db
    .prepare(`UPDATE assignments SET status = 'done', done_at = ? WHERE id = ? AND status = 'open'`)
    .run(ctx.now(), id);
}

/** A run or a test was started for an assignment: remember which, so its result can be shown. */
export function linkAssignment(ctx: Ctx, id: string, link: { runId?: string; examId?: string }): void {
  if (link.runId) ctx.db.prepare('UPDATE assignments SET run_id = ? WHERE id = ?').run(link.runId, id);
  if (link.examId) ctx.db.prepare('UPDATE assignments SET exam_id = ? WHERE id = ?').run(link.examId, id);
}

/** A lesson or worked example was studied: that is what a "lesson" assignment asks for. */
export function completeLessonAssignments(ctx: Ctx, concept: string): void {
  for (const row of openAssignments(ctx)) {
    if (row.kind === 'lesson' && skillsOf(row).includes(concept)) completeAssignment(ctx, row.id);
  }
}

/** A timed test was finished: the oldest open "test" assignment is done, and linked to it. */
export function completeTestAssignment(ctx: Ctx, examId: string, blueprint: string): void {
  if (blueprintOf(ctx)?.id !== blueprint) return;
  const row = openAssignments(ctx)
    .filter((candidate) => candidate.kind === 'test')
    .sort((a, b) => a.created_at - b.created_at)[0];
  if (!row) return;
  linkAssignment(ctx, row.id, { examId });
  completeAssignment(ctx, row.id);
}

/** Skills named by open assignments that are worked through problems. */
export function assignedSkills(ctx: Ctx): Set<string> {
  const out = new Set<string>();
  for (const row of openAssignments(ctx)) {
    if (row.kind === 'practice' || row.kind === 'review' || row.kind === 'remediation')
      for (const id of skillsOf(row)) out.add(id);
  }
  return out;
}

/** Where a "lesson" assignment sends the learner: the lesson, or the concept's worked example. */
export const lessonTarget = (concept: string): 'lesson' | 'concept' => (getLesson(concept) ? 'lesson' : 'concept');

// -------------------------------------------------------------------------------- focus

interface FocusRow {
  skill: string;
  kind: 'difficulty' | 'covered';
  set_by: string;
  set_at: number;
  expires_at: number;
}

/** How long a note about a skill steers the selection. */
export const FOCUS_DAYS = 14;

export function activeFocus(ctx: Ctx): Map<string, 'difficulty' | 'covered'> {
  const rows = ctx.db.prepare('SELECT skill, kind FROM focus WHERE expires_at > ?').all(ctx.now()) as FocusRow[];
  return new Map(rows.map((row) => [row.skill, row.kind]));
}

export function focusDtos(ctx: Ctx): FocusDto[] {
  const rows = ctx.db
    .prepare('SELECT * FROM focus WHERE expires_at > ? ORDER BY set_at DESC')
    .all(ctx.now()) as FocusRow[];
  return rows.map((row) => ({
    skill: row.skill,
    title: getConcept(row.skill)?.title ?? L(row.skill, row.skill),
    kind: row.kind,
    setBy: row.set_by,
    setAt: row.set_at,
    expiresAt: row.expires_at,
  }));
}

export function setFocus(ctx: Ctx, by: string, skill: string, kind: 'difficulty' | 'covered', days = FOCUS_DAYS): void {
  if (!conceptsOfGoal(goalOf(ctx)).some((concept) => concept.id === skill))
    throw badRequest(`"${skill}" is not part of the learner's goal`);
  const now = ctx.now();
  ctx.db
    .prepare(
      `INSERT INTO focus (skill, kind, set_by, set_at, expires_at) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT (skill) DO UPDATE SET kind = excluded.kind, set_by = excluded.set_by, set_at = excluded.set_at,
         expires_at = excluded.expires_at`,
    )
    .run(skill, kind, by, now, now + days * 86_400_000);
}

export function clearFocus(ctx: Ctx, skill: string): void {
  ctx.db.prepare('DELETE FROM focus WHERE skill = ?').run(skill);
}
