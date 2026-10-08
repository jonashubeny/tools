import { MILESTONES, getConcept, getMission } from '@lemma/content';
import {
  type ActivityRecord,
  type ActivityType,
  type DayCellDto,
  type DayDetailDto,
  type DayEventDto,
  type Level,
  type RecentItemDto,
  type StreakSummary,
  L,
  MASTERY_LEVELS,
  STREAK,
  addDays,
  computeStreak,
  dayRange,
  dayScore,
  heatLevel,
  scoresByDay,
} from '@lemma/core';
import { fromJson, toJson } from '../db';
import { type Ctx, dayOf, getSettings, today } from './context';

/** The append-only activity log and everything derived from it. */

export interface EventInput {
  type: ActivityType | 'milestone' | 'correction';
  points: number;
  at?: number;
  skill?: string | null;
  level?: Level | null;
  tool?: string | null;
  ref?: string | null;
  payload?: Record<string, unknown>;
}

export function addEvent(ctx: Ctx, event: EventInput): void {
  const at = event.at ?? ctx.now();
  ctx.db
    .prepare(
      'INSERT INTO events (at, day, type, points, skill, level, tool, ref, payload) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    )
    .run(
      at,
      dayOf(ctx, at),
      event.type,
      event.points,
      event.skill ?? null,
      event.level ?? null,
      event.tool ?? null,
      event.ref ?? null,
      event.payload ? toJson(event.payload) : null,
    );
}

interface EventRow {
  id: number;
  at: number;
  day: string;
  type: string;
  points: number;
  skill: string | null;
  level: number | null;
  tool: string | null;
  ref: string | null;
  payload: string | null;
}

const SCORED: readonly string[] = ['problem', 'lesson_step', 'lesson_done', 'level_up', 'exam', 'lab', 'mission'];

function toRecord(row: EventRow): ActivityRecord {
  return {
    type: row.type as ActivityType,
    day: row.day,
    at: row.at,
    points: row.points,
    level: (row.level ?? undefined) as Level | undefined,
    tool: row.tool ?? undefined,
  };
}

export function dayScores(ctx: Ctx, fromDay?: string): Map<string, number> {
  const rows = (
    fromDay
      ? ctx.db.prepare('SELECT * FROM events WHERE day >= ? AND points > 0').all(fromDay)
      : ctx.db.prepare('SELECT * FROM events WHERE points > 0').all()
  ) as EventRow[];
  return scoresByDay(rows.filter((row) => SCORED.includes(row.type)).map(toRecord));
}

export function streakSummary(ctx: Ctx): StreakSummary {
  const settings = getSettings(ctx);
  return computeStreak({
    scores: dayScores(ctx),
    today: today(ctx),
    pauses: settings.pauses.map((pause) => ({ from: pause.from, to: pause.to })),
    weekGoal: settings.weekGoal,
  });
}

/** The last 53 weeks, ending with the week that contains today. */
export function heatmap(ctx: Ctx, forge: ReadonlyMap<string, number> = new Map()): DayCellDto[] {
  const end = today(ctx);
  const start = addDays(end, -370);
  const scores = dayScores(ctx, start);
  return dayRange(start, end).map((day) => {
    const score = scores.get(day) ?? 0;
    return { day, score, level: heatLevel(score), forge: forge.get(day) ?? 0 };
  });
}

const EVENT_TITLES: Record<string, L> = {
  problem: L('Úloha', 'Problem'),
  lesson_step: L('Krok lekce', 'Lesson step'),
  lesson_done: L('Dokončená lekce', 'Lesson finished'),
  level_up: L('Nová úroveň', 'Level gained'),
  exam: L('Zkouška nanečisto', 'Mock exam'),
  lab: L('Experiment v laboratoři', 'Lab experiment'),
  mission: L('Milník mise', 'Mission milestone'),
  milestone: L('Milník', 'Milestone'),
  correction: L('Opravená chyba', 'Error corrected'),
};

const LEVEL_NAMES: Record<number, L> = {
  0: L('nová', 'new'),
  1: L('představená', 'introduced'),
  2: L('procvičovaná', 'practising'),
  3: L('známá', 'familiar'),
  4: L('ovládnutá', 'proficient'),
  5: L('mistrovská', 'mastered'),
};

export const levelName = (level: number): L =>
  LEVEL_NAMES[level] ?? L(MASTERY_LEVELS[level] ?? '?', MASTERY_LEVELS[level] ?? '?');

function describe(row: EventRow): DayEventDto {
  const payload = fromJson<Record<string, unknown>>(row.payload, {});
  const concept = row.skill ? getConcept(row.skill) : undefined;
  let title = EVENT_TITLES[row.type] ?? L(row.type, row.type);
  let detail: L | null = concept ? concept.title : null;

  if (row.type === 'problem') {
    const solved = payload.solved === true;
    const unaided = payload.unaided === true;
    title = solved
      ? unaided
        ? L('Vyřešeno samostatně', 'Solved unaided')
        : L('Vyřešeno s pomocí', 'Solved with help')
      : L('Nevyřešeno', 'Not solved');
    if (payload.reviewPassed === true) title = L(`${title.cs} · opakování`, `${title.en} · review`);
  } else if (row.type === 'level_up' && concept) {
    const to = typeof payload.to === 'number' ? payload.to : 0;
    detail = L(`${concept.title.cs} → ${levelName(to).cs}`, `${concept.title.en} → ${levelName(to).en}`);
  } else if (row.type === 'milestone') {
    const def = MILESTONES.find((m) => m.id === row.ref);
    if (def) detail = def.title;
  } else if (row.type === 'mission') {
    const mission = row.ref ? getMission(row.ref) : undefined;
    if (mission) detail = mission.title;
  } else if (row.type === 'exam') {
    const percent = typeof payload.percent === 'number' ? payload.percent : null;
    if (percent !== null) detail = L(`${percent} %`, `${percent}%`);
  } else if (row.type === 'lab' && row.tool) {
    detail = L(row.tool, row.tool);
  }
  return {
    at: row.at,
    type: row.type,
    points: row.points,
    title,
    detail,
    skill: row.skill,
    problemId: row.type === 'problem' || row.type === 'correction' ? row.ref : null,
  };
}

export function dayDetail(ctx: Ctx, day: string): DayDetailDto {
  const rows = ctx.db.prepare('SELECT * FROM events WHERE day = ? ORDER BY at, id').all(day) as EventRow[];
  const score = dayScore(rows.filter((row) => SCORED.includes(row.type)).map(toRecord));
  const problems = rows.filter((row) => row.type === 'problem');
  const payloads = problems.map((row) => fromJson<Record<string, unknown>>(row.payload, {}));
  return {
    day,
    score,
    active: score >= STREAK.ACTIVE_THRESHOLD,
    events: rows.map(describe),
    counts: {
      problems: problems.length,
      solved: payloads.filter((p) => p.solved === true).length,
      unaided: payloads.filter((p) => p.unaided === true).length,
      corrected: payloads.filter((p) => p.corrected === true).length,
      reviews: payloads.filter((p) => p.reviewPassed === true).length,
      lessons: rows.filter((row) => row.type === 'lesson_done').length,
    },
  };
}

/** What was accomplished lately: level changes, milestones, exams, finished lessons. */
export function recentItems(ctx: Ctx, limit = 8): RecentItemDto[] {
  const rows = ctx.db
    .prepare(
      `SELECT * FROM events WHERE type IN ('level_up', 'milestone', 'exam', 'lesson_done', 'correction') ORDER BY at DESC, id DESC LIMIT ?`,
    )
    .all(limit) as EventRow[];
  return rows.map((row) => {
    const described = describe(row);
    const kind: RecentItemDto['kind'] =
      row.type === 'level_up'
        ? 'level'
        : row.type === 'milestone'
          ? 'milestone'
          : row.type === 'exam'
            ? 'exam'
            : row.type === 'lesson_done'
              ? 'lesson'
              : 'correction';
    return { at: row.at, kind, title: described.title, detail: described.detail, skill: row.skill };
  });
}

// --------------------------------------------------------------------------- milestones

/** Record a milestone once. Returns true if it was newly achieved. */
export function award(ctx: Ctx, id: string, ref = ''): boolean {
  if (!MILESTONES.some((m) => m.id === id)) return false;
  const at = ctx.now();
  const result = ctx.db
    .prepare('INSERT OR IGNORE INTO milestones (id, ref, achieved_at, day) VALUES (?, ?, ?, ?)')
    .run(id, ref, at, dayOf(ctx, at));
  if (result.changes === 0) return false;
  addEvent(ctx, { type: 'milestone', points: 0, ref: id, payload: ref ? { ref } : undefined });
  return true;
}

export function achievedMilestones(ctx: Ctx): { id: string; ref: string; achievedAt: number }[] {
  const rows = ctx.db.prepare('SELECT id, ref, achieved_at FROM milestones ORDER BY achieved_at DESC').all() as {
    id: string;
    ref: string;
    achieved_at: number;
  }[];
  return rows.map((row) => ({ id: row.id, ref: row.ref, achievedAt: row.achieved_at }));
}

const count = (ctx: Ctx, sql: string, ...params: unknown[]): number =>
  (ctx.db.prepare(sql).get(...params) as { n: number }).n;

/**
 * Check the milestones that depend on totals. Cheap enough to run after every resolved
 * problem; `award` is idempotent.
 */
export function checkCountMilestones(ctx: Ctx): string[] {
  const earned: string[] = [];
  const tryAward = (id: string, condition: boolean): void => {
    if (condition && award(ctx, id)) earned.push(id);
  };
  const solved = count(ctx, `SELECT COUNT(*) AS n FROM problems WHERE status = 'solved'`);
  tryAward('first-problem', solved >= 1);
  tryAward('problems-100', solved >= 100);
  tryAward('reviews-25', count(ctx, 'SELECT COUNT(*) AS n FROM problems WHERE review_passed = 1') >= 25);
  const corrections = count(ctx, `SELECT COUNT(*) AS n FROM problems WHERE status = 'solved' AND wrong_attempts > 0`);
  tryAward('first-correction', corrections >= 1);
  tryAward('corrections-10', corrections >= 10);
  tryAward(
    'spot-10',
    count(ctx, `SELECT COUNT(*) AS n FROM problems WHERE status = 'solved' AND kind = 'debug' AND first_try = 1`) >= 10,
  );
  tryAward(
    'boss-solved',
    count(
      ctx,
      `SELECT COUNT(*) AS n FROM problems WHERE status = 'solved' AND level = 5 AND hints_used = 0 AND tutor_used = 0`,
    ) >= 1,
  );

  const streak = streakSummary(ctx);
  tryAward('streak-7', streak.current >= 7);
  tryAward('streak-30', streak.current >= 30);
  tryAward('consistency-20', streak.consistency.active >= 20);

  // A clean week: at least 30 resolved problems in the last 7 days, under 5 % slips.
  const since = ctx.now() - 7 * 86_400_000;
  const week = ctx.db
    .prepare(
      `SELECT COUNT(*) AS total,
              SUM(CASE WHEN COALESCE(error_confirmed, error_inferred) IN ('sign','arithmetic','copy','misread','notation','rushed') THEN 1 ELSE 0 END) AS slips
       FROM problems WHERE resolved_at >= ? AND status IN ('solved', 'failed')`,
    )
    .get(since) as { total: number; slips: number | null };
  tryAward('clean-week', week.total >= 30 && (week.slips ?? 0) / week.total < 0.05);
  return earned;
}
