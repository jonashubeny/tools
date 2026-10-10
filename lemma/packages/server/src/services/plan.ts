import { CONCEPTS, getConcept, getGoal, hasProblems } from '@lemma/content';
import {
  type ErrorType,
  type L as LText,
  type Plan,
  type PlanAssignment,
  type PlanBlock,
  type PlanBlockDto,
  type PlanDto,
  type PlanSkill,
  type SkillDto,
  type StartRunRequest,
  type StartRunResponse,
  L,
  assignedBlock,
  composeGoalPlan,
  composePlan,
  holdsBack,
  isErrorType,
  prereqEvidence,
} from '@lemma/core';
import { fromJson, toJson } from '../db';
import {
  type AssignmentRow,
  assignmentDto,
  assignmentRow,
  blueprintOf,
  lessonTarget,
  linkAssignment,
  openAssignments,
  skillsOf,
} from './assignments';
import { type Ctx, HttpError, dayOf, getSettings, goalOf, notFound, today } from './context';
import { diagnosticStatus, hasDiagnostic } from './diagnostic';
import { allSkills, loadStates } from './learner';
import { type QueueItem, candidatesFor, nextInRun, startDiagnostic, startRun } from './practice';
import { mockResults, readinessFor } from './readiness';
import { nextSteps, selectionFor } from './selection';

/** The daily session plan: composed once per day, stored, and annotated with progress. */

/**
 * The error type that dominates recent mistakes, if any does. Only mistakes whose kind
 * rests on something count: the learner confirmed it, the answer matched a known wrong
 * answer or pattern, or it came far too fast. A label the model merely defaulted to is
 * not a pattern to drill.
 */
export function errorFocus(ctx: Ctx): { type: ErrorType; count: number; share: number } | null {
  const rows = ctx.db
    .prepare(
      `SELECT COALESCE(error_confirmed, error_inferred) AS error FROM problems
       WHERE status IN ('solved', 'failed') AND COALESCE(error_confirmed, error_inferred) IS NOT NULL
         AND (error_confirmed IS NOT NULL OR error_basis IN ('misconception', 'pattern', 'timing'))
       ORDER BY resolved_at DESC LIMIT 20`,
    )
    .all() as { error: string }[];
  const counts = new Map<ErrorType, number>();
  for (const row of rows) {
    // "Did not know how" is not a pattern to drill; it calls for the lesson instead.
    if (isErrorType(row.error) && row.error !== 'unknown') counts.set(row.error, (counts.get(row.error) ?? 0) + 1);
  }
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
  if (!top || top[1] < 3) return null;
  return { type: top[0], count: top[1], share: top[1] / rows.length };
}

function planSkills(skills: readonly SkillDto[]): PlanSkill[] {
  const order = new Map(CONCEPTS.map((concept, index) => [concept.id, index]));
  return skills
    .filter((skill) => skill.hasProblems)
    .map((skill) => ({
      id: skill.id,
      topic: skill.topic,
      order: order.get(skill.id) ?? 0,
      level: skill.level,
      theta: skill.theta,
      attempts: skill.attempts,
      due: skill.due,
      overdueDays: skill.due && skill.dueInDays !== null ? -skill.dueInDays : 0,
      prereqs: skill.prereqs,
      hasLesson: skill.hasLesson,
      lessonDone: skill.lessonDone,
      hasHard: candidatesFor(skill.id, 'challenge').some((candidate) => candidate.levels.some((level) => level >= 4)),
      lab: getConcept(skill.id)?.lab?.tool,
    }));
}

/** Assignments that belong in today's plan: the open ones, and those finished today. */
function plannedAssignments(ctx: Ctx): AssignmentRow[] {
  const day = today(ctx);
  const doneToday = (
    ctx.db.prepare(`SELECT * FROM assignments WHERE status = 'done' ORDER BY created_at`).all() as AssignmentRow[]
  ).filter((row) => row.done_at !== null && dayOf(ctx, row.done_at) === day);
  return [...openAssignments(ctx), ...doneToday].sort((a, b) => a.created_at - b.created_at);
}

const asPlanAssignment = (row: AssignmentRow): PlanAssignment => ({
  id: row.id,
  kind: row.kind,
  skills: skillsOf(row),
  minutes: row.minutes,
});

/**
 * The plan as the learner is shown it. An examination plan is composed around what the
 * teacher set. The school plan is not: its blocks are numbered, and composing it again in
 * the afternoon would hand the morning's finished blocks to other work. So it is kept for
 * the day, as it always was, and assigned work is put in front of it when it is read.
 */
function withAssigned(ctx: Ctx, plan: Plan): Plan {
  if (getGoal(goalOf(ctx)).kind !== 'school') return plan;
  const assigned = plannedAssignments(ctx).map((row) => assignedBlock(asPlanAssignment(row)));
  return assigned.length === 0 ? plan : { ...plan, blocks: [...assigned, ...plan.blocks] };
}

/**
 * What a stored plan was composed for. When it no longer matches — another goal, a
 * placement test done, work set or withdrawn by the teacher — the plan is composed anew.
 * The school plan depends on none of these and is kept for the day (withAssigned).
 */
function planBasis(ctx: Ctx): string {
  const goal = goalOf(ctx);
  if (getGoal(goal).kind === 'school') return 'school';
  const diagnostic = diagnosticStatus(ctx, goal);
  return [
    goal,
    diagnostic.done || diagnostic.skipped ? 'placed' : 'unplaced',
    ...plannedAssignments(ctx).map((row) => row.id),
  ].join('|');
}

function composeForGoal(ctx: Ctx, minutes: number): Plan {
  const settings = getSettings(ctx);
  const goal = settings.goal;
  const states = loadStates(ctx);
  const selection = selectionFor(ctx, states);
  const diagnostic = diagnosticStatus(ctx, goal);
  const focus = errorFocus(ctx);
  const mocks = mockResults(ctx, goal);
  const lastMock = mocks[mocks.length - 1];
  const assignments = plannedAssignments(ctx).map(asPlanAssignment);
  return composeGoalPlan({
    day: today(ctx),
    minutes,
    // Nothing to place with (no anchors), a test done, or a learner who chose to start practising.
    diagnosed: !hasDiagnostic(goal) || diagnostic.done || diagnostic.skipped,
    skillsWithEvidence: selection.skills.filter((skill) => skill.attempts > 0).length,
    assignments,
    top: nextSteps(selection, 6).map((step) => ({ id: step.skill.id, purpose: step.purpose })),
    dueCount: selection.skills.filter((skill) => skill.due).length,
    errorFocus: focus ? { type: focus.type, count: focus.count } : null,
    mock: {
      ready: readinessFor(ctx, states).verdict === 'test-ready',
      daysSinceLast: lastMock ? Math.floor((ctx.now() - lastMock.finishedAt) / 86_400_000) : null,
    },
    exam: settings.examDay ? { day: settings.examDay } : null,
  });
}

function compose(ctx: Ctx, minutes: number): Plan {
  const settings = getSettings(ctx);
  if (getGoal(settings.goal).kind === 'entrance') return composeForGoal(ctx, minutes);
  const focus = errorFocus(ctx);
  return composePlan({
    day: today(ctx),
    minutes,
    skills: planSkills(allSkills(ctx)),
    currentTopic: settings.currentTopic,
    tests: settings.tests.map((test) => ({ day: test.day, topics: test.topics, title: test.title || undefined })),
    errorFocus: focus ? { type: focus.type, count: focus.count } : null,
  });
}

interface PlanRow {
  day: string;
  minutes: number;
  plan: string;
}

/** How many timed tests of the learner's goal were finished on a study day. */
function testsFinishedOn(ctx: Ctx, day: string): number {
  const blueprint = blueprintOf(ctx)?.id;
  if (!blueprint) return 0;
  const rows = ctx.db
    .prepare('SELECT finished_at FROM exams WHERE blueprint = ? AND finished_at IS NOT NULL')
    .all(blueprint) as { finished_at: number }[];
  return rows.filter((row) => dayOf(ctx, row.finished_at) === day).length;
}

type StoredPlan = Plan & { basis?: string };

function toDto(ctx: Ctx, plan: Plan): PlanDto {
  const runs = ctx.db
    .prepare(
      'SELECT id, plan_block, finished_at FROM runs WHERE day = ? AND plan_block IS NOT NULL ORDER BY started_at',
    )
    .all(plan.day) as {
    id: string;
    plan_block: string;
    finished_at: number | null;
  }[];
  const labDone = new Set(
    (
      ctx.db.prepare(`SELECT tool FROM events WHERE day = ? AND type = 'lab'`).all(plan.day) as {
        tool: string | null;
      }[]
    ).map((row) => row.tool),
  );
  const lessonsDone = new Set(
    (ctx.db.prepare('SELECT concept FROM lesson_progress WHERE done = 1').all() as { concept: string }[]).map(
      (row) => row.concept,
    ),
  );
  const assignments = new Map(
    (ctx.db.prepare('SELECT * FROM assignments').all() as AssignmentRow[]).map((row) => [row.id, row]),
  );
  const runFinished = (id: string | null): boolean | null => {
    if (!id) return null;
    const run = ctx.db.prepare('SELECT finished_at FROM runs WHERE id = ?').get(id) as
      { finished_at: number | null } | undefined;
    return run ? run.finished_at !== null : null;
  };

  const blocks: PlanBlockDto[] = plan.blocks.map((block) => {
    const mine = runs.filter((run) => run.plan_block === block.id);
    const finished = mine.find((run) => run.finished_at !== null);
    const active = mine.find((run) => run.finished_at === null);
    let status: PlanBlockDto['status'] = finished ? 'done' : active ? 'active' : 'todo';
    let runId = (active ?? finished)?.id ?? null;
    if (block.kind === 'experiment' && block.lab && labDone.has(block.lab)) status = 'done';
    // A lesson block is done when its lesson is — the practice that follows is a bonus.
    if (block.kind === 'lesson' && block.skills[0] && lessonsDone.has(block.skills[0])) status = 'done';
    if (block.kind === 'diagnostic') {
      const diagnostic = diagnosticStatus(ctx);
      status = diagnostic.done ? 'done' : diagnostic.running ? 'active' : 'todo';
      runId = diagnostic.running ?? runId;
    }
    // The timed test is taken on the Exams page; it is done when one was finished today.
    if (block.kind === 'mock' && !block.assignment && testsFinishedOn(ctx, plan.day) > 0) status = 'done';
    // Work the teacher set is done when the assignment is, wherever it was started from.
    const assignment = block.assignment ? assignments.get(block.assignment) : undefined;
    if (assignment) {
      const underWay = runFinished(assignment.run_id) === false;
      status = assignment.status === 'done' ? 'done' : underWay ? 'active' : 'todo';
      runId = assignment.run_id ?? runId;
    } else if (block.assignment) {
      status = 'done';
    }
    return {
      id: block.id,
      kind: block.kind,
      minutes: block.minutes,
      skills: block.skills.map((id) => ({ id, title: getConcept(id)?.title ?? L(id, id) })),
      reason: block.reason,
      optional: block.optional,
      errorType: block.errorType ?? null,
      lab: block.lab ?? null,
      status,
      runId,
      assignment: assignment ? assignmentDto(ctx, assignment) : null,
    };
  });
  return {
    day: plan.day,
    minutes: plan.minutes,
    blocks,
    test: plan.test ? { ...plan.test, title: plan.test.title ?? null } : null,
    focusTopic: plan.focusTopic,
  };
}

/**
 * Today's plan. It is composed on first request and then kept, so that it does not
 * reshuffle on every reload; asking for a different duration replaces it, and so does a
 * change in what it was composed for (planBasis).
 */
export function getPlan(ctx: Ctx, minutes?: number): PlanDto {
  const day = today(ctx);
  const row = ctx.db.prepare('SELECT * FROM plans WHERE day = ?').get(day) as PlanRow | undefined;
  const wanted = minutes ?? row?.minutes ?? getSettings(ctx).sessionMinutes;
  if (row && row.minutes === wanted) {
    const stored = fromJson<StoredPlan | null>(row.plan, null);
    if (stored && (stored.basis ?? 'school') === planBasis(ctx)) return toDto(ctx, withAssigned(ctx, stored));
  }
  return toDto(ctx, withAssigned(ctx, storePlan(ctx, wanted)));
}

function storePlan(ctx: Ctx, minutes: number): Plan {
  const plan: StoredPlan = { ...compose(ctx, minutes), basis: planBasis(ctx) };
  ctx.db
    .prepare(
      `INSERT INTO plans (day, minutes, plan, created_at) VALUES (?, ?, ?, ?)
       ON CONFLICT (day) DO UPDATE SET minutes = excluded.minutes, plan = excluded.plan, created_at = excluded.created_at`,
    )
    .run(plan.day, plan.minutes, toJson(plan), ctx.now());
  return plan;
}

/** Recompose today's plan from the current state (after settings change, or on request). */
export function regeneratePlan(ctx: Ctx, minutes?: number): PlanDto {
  const day = today(ctx);
  const row = ctx.db.prepare('SELECT minutes FROM plans WHERE day = ?').get(day) as { minutes: number } | undefined;
  return toDto(ctx, withAssigned(ctx, storePlan(ctx, minutes ?? row?.minutes ?? getSettings(ctx).sessionMinutes)));
}

function storedBlock(ctx: Ctx, blockId: string): PlanBlock {
  const row = ctx.db.prepare('SELECT plan FROM plans WHERE day = ?').get(today(ctx)) as { plan: string } | undefined;
  const plan = row ? fromJson<Plan | null>(row.plan, null) : null;
  const block = plan?.blocks.find((b) => b.id === blockId);
  if (!block) throw notFound('plan block');
  return block;
}

const ASSIGNED_PREFIX = 'assigned:';

/** Roughly how many problems fit into a block. */
const problemsFor = (minutes: number, perProblem = 2): number =>
  Math.max(2, Math.min(12, Math.round(minutes / perProblem)));

/** What starting something leads to when it is not a run of problems. */
export interface Redirect {
  redirect: 'lesson' | 'exam' | 'lab' | 'concept';
  target: string;
  title: LText | null;
}

/** Turn a plan block into a practice run. Lessons, mocks and experiments start elsewhere. */
export function startBlock(ctx: Ctx, blockId: string): StartRunResponse | Redirect {
  // Assigned work is found by its own name: in a school plan its block is not stored.
  if (blockId.startsWith(ASSIGNED_PREFIX)) return startAssignment(ctx, blockId.slice(ASSIGNED_PREFIX.length), blockId);
  const block = storedBlock(ctx, blockId);
  const first = block.skills[0];
  if (block.assignment) return startAssignment(ctx, block.assignment, blockId);
  if (block.kind === 'diagnostic') return startDiagnostic(ctx, blockId);
  // Pressing "start" on a block that is under way continues it rather than duplicating it.
  const active = ctx.db
    .prepare(
      'SELECT id FROM runs WHERE day = ? AND plan_block = ? AND finished_at IS NULL ORDER BY started_at DESC LIMIT 1',
    )
    .get(today(ctx), blockId) as { id: string } | undefined;
  if (active) return nextInRun(ctx, active.id);
  let request: StartRunRequest;
  switch (block.kind) {
    case 'review':
      request = {
        context: 'mixed',
        skills: block.skills,
        count: Math.max(block.skills.length, problemsFor(block.minutes)),
        blockId,
      };
      break;
    case 'practice':
      request =
        block.skills.length > 1
          ? { context: 'mixed', skills: block.skills, count: problemsFor(block.minutes), blockId }
          : { context: 'blocked', concept: first, count: problemsFor(block.minutes), blockId };
      break;
    case 'prereq':
      request = { context: 'blocked', concept: first, count: problemsFor(block.minutes), blockId };
      break;
    case 'challenge':
      request = { context: 'challenge', concept: first, blockId };
      break;
    case 'drill':
      request = { context: 'drill', errorType: block.errorType, count: problemsFor(block.minutes, 1.5), blockId };
      break;
    case 'adaptive':
      request = { context: 'adaptive', count: Math.max(4, Math.min(20, Math.round(block.minutes / 2))), blockId };
      break;
    case 'lesson':
      return { redirect: 'lesson', target: first ?? '', title: first ? (getConcept(first)?.title ?? null) : null };
    case 'mock':
      return { redirect: 'exam', target: blueprintOf(ctx)?.id ?? 'chapter-test', title: null };
    case 'experiment':
      return { redirect: 'lab', target: block.lab ?? 'grapher', title: null };
    default:
      throw new HttpError(400, 'bad_block', 'this block cannot be started');
  }
  return startRun(ctx, request);
}

/**
 * A remediation: the weak prerequisites of the skill first, two easy problems each, then
 * the skill itself — from its easiest problems, the cap coming off halfway through.
 */
function remediationQueue(ctx: Ctx, skill: string, count: number): QueueItem[] {
  const states = loadStates(ctx);
  const weak = (getConcept(skill)?.prereqs ?? [])
    .filter((id) => getConcept(id) !== undefined && hasProblems(id))
    .filter((id) => holdsBack(prereqEvidence(states.get(id))))
    .slice(0, 2);
  const queue: QueueItem[] = weak.flatMap((id) => [
    { skill: id, cap: 2 },
    { skill: id, cap: 2 },
  ]);
  const own = Math.max(3, count - queue.length);
  for (let i = 0; i < own; i++) queue.push(i < Math.ceil(own / 2) ? { skill, cap: 2 } : { skill });
  return queue;
}

/** Start (or go on with) the work of an assignment. */
export function startAssignment(ctx: Ctx, id: string, blockId?: string): StartRunResponse | Redirect {
  const row = assignmentRow(ctx, id);
  if (row.status !== 'open') throw new HttpError(409, 'assignment_closed', 'this assignment is no longer open');
  if (row.run_id) {
    const run = ctx.db.prepare('SELECT finished_at FROM runs WHERE id = ?').get(row.run_id) as
      { finished_at: number | null } | undefined;
    if (run && run.finished_at === null) return nextInRun(ctx, row.run_id);
  }
  const skills = skillsOf(row);
  const first = skills[0];
  const titleOf = (skill: string | undefined): LText | null => (skill ? (getConcept(skill)?.title ?? null) : null);
  const count = row.count ?? problemsFor(row.minutes);

  let response: StartRunResponse;
  switch (row.kind) {
    case 'lesson':
      return { redirect: lessonTarget(first ?? ''), target: first ?? '', title: titleOf(first) };
    case 'test':
      return { redirect: 'exam', target: blueprintOf(ctx)?.id ?? 'chapter-test', title: null };
    case 'review':
      response = startRun(
        ctx,
        { context: 'mixed', skills: skills.length > 0 ? skills : undefined, count, blockId },
        { assignment: id, title: L('Zadané opakování', 'Assigned review') },
      );
      break;
    case 'remediation': {
      const name = titleOf(first);
      response = startRun(
        ctx,
        { context: 'blocked', concept: first, blockId },
        {
          assignment: id,
          queue: remediationQueue(ctx, first ?? '', count),
          title: name ? L(`Doplnění: ${name.cs}`, `Catching up: ${name.en}`) : undefined,
        },
      );
      break;
    }
    case 'practice':
      response =
        skills.length === 1
          ? startRun(ctx, { context: 'blocked', concept: first, count, blockId }, { assignment: id })
          : startRun(
              ctx,
              { context: 'adaptive', skills, count, blockId },
              { assignment: id, title: L('Zadané procvičování', 'Assigned practice') },
            );
      break;
    default:
      throw new HttpError(400, 'bad_assignment', 'this assignment cannot be started');
  }
  linkAssignment(ctx, id, { runId: response.run.id });
  return response;
}
