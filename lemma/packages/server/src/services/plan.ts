import { CONCEPTS, getConcept } from '@lemma/content';
import {
  type ErrorType,
  type L as LText,
  type Plan,
  type PlanBlock,
  type PlanBlockDto,
  type PlanDto,
  type PlanSkill,
  type SkillDto,
  type StartRunRequest,
  type StartRunResponse,
  L,
  composePlan,
  isErrorType,
} from '@lemma/core';
import { fromJson, toJson } from '../db';
import { type Ctx, HttpError, getSettings, notFound, today } from './context';
import { allSkills } from './learner';
import { candidatesFor, nextInRun, startRun } from './practice';

/** The daily session plan: composed once per day, stored, and annotated with progress. */

/** The error type that dominates recent mistakes, if any does. */
export function errorFocus(ctx: Ctx): { type: ErrorType; count: number; share: number } | null {
  const rows = ctx.db
    .prepare(
      `SELECT COALESCE(error_confirmed, error_inferred) AS error FROM problems
       WHERE status IN ('solved', 'failed') AND COALESCE(error_confirmed, error_inferred) IS NOT NULL
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

function compose(ctx: Ctx, minutes: number): Plan {
  const settings = getSettings(ctx);
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

  const blocks: PlanBlockDto[] = plan.blocks.map((block) => {
    const mine = runs.filter((run) => run.plan_block === block.id);
    const finished = mine.find((run) => run.finished_at !== null);
    const active = mine.find((run) => run.finished_at === null);
    let status: PlanBlockDto['status'] = finished ? 'done' : active ? 'active' : 'todo';
    if (block.kind === 'experiment' && block.lab && labDone.has(block.lab)) status = 'done';
    // A lesson block is done when its lesson is — the practice that follows is a bonus.
    if (block.kind === 'lesson' && block.skills[0] && lessonsDone.has(block.skills[0])) status = 'done';
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
      runId: (active ?? finished)?.id ?? null,
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
 * reshuffle on every reload; asking for a different duration replaces it.
 */
export function getPlan(ctx: Ctx, minutes?: number): PlanDto {
  const day = today(ctx);
  const row = ctx.db.prepare('SELECT * FROM plans WHERE day = ?').get(day) as PlanRow | undefined;
  const wanted = minutes ?? row?.minutes ?? getSettings(ctx).sessionMinutes;
  if (row && row.minutes === wanted) {
    const stored = fromJson<Plan | null>(row.plan, null);
    if (stored) return toDto(ctx, stored);
  }
  return toDto(ctx, storePlan(ctx, wanted));
}

function storePlan(ctx: Ctx, minutes: number): Plan {
  const plan = compose(ctx, minutes);
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
  return toDto(ctx, storePlan(ctx, minutes ?? row?.minutes ?? getSettings(ctx).sessionMinutes));
}

function storedBlock(ctx: Ctx, blockId: string): PlanBlock {
  const row = ctx.db.prepare('SELECT plan FROM plans WHERE day = ?').get(today(ctx)) as { plan: string } | undefined;
  const plan = row ? fromJson<Plan | null>(row.plan, null) : null;
  const block = plan?.blocks.find((b) => b.id === blockId);
  if (!block) throw notFound('plan block');
  return block;
}

/** Roughly how many problems fit into a block. */
const problemsFor = (minutes: number, perProblem = 2): number =>
  Math.max(2, Math.min(12, Math.round(minutes / perProblem)));

/** Turn a plan block into a practice run. Lessons, mocks and experiments start elsewhere. */
export function startBlock(
  ctx: Ctx,
  blockId: string,
): StartRunResponse | { redirect: 'lesson' | 'exam' | 'lab'; target: string; title: LText | null } {
  const block = storedBlock(ctx, blockId);
  const first = block.skills[0];
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
    case 'lesson':
      return { redirect: 'lesson', target: first ?? '', title: first ? (getConcept(first)?.title ?? null) : null };
    case 'mock':
      return { redirect: 'exam', target: 'chapter-test', title: null };
    case 'experiment':
      return { redirect: 'lab', target: block.lab ?? 'grapher', title: null };
    default:
      throw new HttpError(400, 'bad_block', 'this block cannot be started');
  }
  return startRun(ctx, request);
}
