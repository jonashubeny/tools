import {
  conceptsOfGoal,
  generatorsFor,
  getConcept,
  getGenerator,
  getGoal,
  getStaticProblem,
  staticProblemsFor,
} from '@lemma/content';
import {
  type AnswerSpec,
  type AttentionDto,
  type CompareDto,
  type ErrorType,
  type HistoryItemDto,
  type InterventionDto,
  type L as LText,
  type Level,
  type MisconceptionDto,
  type NoteDto,
  type PathState,
  type ProblemInstance,
  type SessionOutcome,
  type SkillDto,
  type StudentDetailDto,
  type StudentSummaryDto,
  type TeachBriefDto,
  type TeachItemDto,
  type TeachProblemDto,
  type TeachSessionDto,
  type TeachSessionSummaryDto,
  type TeachWrapDto,
  type WeekFiguresDto,
  ERROR_FAMILY,
  L,
  PATH_STATES,
  SESSION_OUTCOMES,
  addDays,
  answerToTex,
  checkAnswer,
  chooseLevel,
  createRng,
  daysBetween,
  isDay,
  isErrorType,
  publicAnswerSpec,
  weekStart,
} from '@lemma/core';
import type { Learner } from '../accounts';
import { fromJson, toJson } from '../db';
import { heatmap, recentItems } from './activity';
import { createAssignment, focusDtos, listAssignments, openAssignments, setFocus } from './assignments';
import {
  type Ctx,
  HttpError,
  badRequest,
  getSettings,
  newId,
  newSeed,
  notFound,
  today,
  updateSettings,
} from './context';
import { diagnosticStatus, hasDiagnostic, listDiagnostics } from './diagnostic';
import { listExams } from './exam';
import { analytics, errorSummary } from './insights';
import { type States, allSkills, loadStates, stateOf } from './learner';
import { errorFocus, regeneratePlan } from './plan';
import { type ProblemRow, snapshotOf } from './practice';
import { readinessFor } from './readiness';
import { isPurpose, nextSteps, practiceLevels, selectionFor } from './selection';

/**
 * What a teacher sees of a learner, and what a teacher keeps about one.
 *
 * Every function here takes the contexts it works on as arguments: the learner's, the
 * teacher's, or both. Which learner a teacher may name is decided before any of them is
 * called — in the routes, by `Accounts.teaches` — and nothing here widens it.
 *
 * Two kinds of data, kept apart on purpose:
 *  - read from the learner's database: progress, history, mistakes, tests;
 *  - written to the teacher's own database: private notes and the records of tutoring
 *    sessions. No request made by a learner opens that database.
 * A teacher writes into a learner's database in three places only: an assignment, a note
 * about a skill that steers the selection, and the learner's goal and examination date.
 */

const DAY_MS = 86_400_000;

/** When a figure is worth a teacher's attention. Stated rules, not fitted ones. */
const ATTENTION = {
  /** Days without any work. */
  INACTIVE_DAYS: 5,
  /** A skill practised this often and still below "familiar". */
  STUCK_ATTEMPTS: 8,
  /** A tested skill not practised for this long. */
  NEGLECTED_DAYS: 21,
  /** The same wrong idea this many times… */
  MISCONCEPTION_REPEATS: 2,
  /** …within this many days. */
  MISCONCEPTION_WINDOW_DAYS: 60,
  /** Wrong answers given in under a quarter of the expected time, within two weeks. */
  RUSHED_WRONG: 4,
  /** Problems in two weeks before the share with hints means anything, and the share. */
  HINT_MIN_PROBLEMS: 10,
  HINT_SHARE: 0.5,
  /** A timed test is suggested again after this many days. */
  TEST_EVERY_DAYS: 14,
  /** Reviews due before a review is the thing to assign. */
  REVIEWS_DUE: 5,
} as const;

const titled = (id: string): { id: string; title: LText } => ({ id, title: getConcept(id)?.title ?? L(id, id) });

// ----------------------------------------------------------------------------- figures

function figures(ctx: Ctx, from: number, to: number): WeekFiguresDto {
  const row = ctx.db
    .prepare(
      `SELECT COUNT(*) AS problems,
              COALESCE(SUM(CASE WHEN status = 'solved' THEN 1 ELSE 0 END), 0) AS solved,
              COALESCE(SUM(CASE WHEN status = 'solved' AND first_try = 1 THEN 1 ELSE 0 END), 0) AS firstTry,
              COALESCE(SUM(CASE WHEN status = 'solved' AND first_try = 1 AND hints_used + tutor_used = 0 THEN 1 ELSE 0 END), 0) AS unaided,
              COALESCE(SUM(CASE WHEN hints_used + tutor_used > 0 THEN 1 ELSE 0 END), 0) AS hinted,
              COALESCE(SUM(seconds), 0) AS seconds,
              COUNT(DISTINCT day) AS activeDays
       FROM problems WHERE status IN ('solved', 'failed') AND resolved_at >= ? AND resolved_at < ?`,
    )
    .get(from, to) as Omit<WeekFiguresDto, 'minutes' | 'sessions'> & { seconds: number };
  const runs = ctx.db
    .prepare('SELECT COUNT(*) AS n FROM runs WHERE started_at >= ? AND started_at < ?')
    .get(from, to) as {
    n: number;
  };
  const exams = ctx.db
    .prepare('SELECT COUNT(*) AS n FROM exams WHERE started_at >= ? AND started_at < ?')
    .get(from, to) as { n: number };
  return {
    problems: row.problems,
    solved: row.solved,
    firstTry: row.firstTry,
    unaided: row.unaided,
    hinted: row.hinted,
    minutes: Math.round(row.seconds / 60),
    activeDays: row.activeDays,
    sessions: runs.n + exams.n,
  };
}

const lastActive = (ctx: Ctx): number | null =>
  (
    ctx.db.prepare(`SELECT MAX(resolved_at) AS at FROM problems WHERE status IN ('solved', 'failed')`).get() as {
      at: number | null;
    }
  ).at;

/** Wrong ideas that came back: the same diagnosis on the same skill, more than once. */
function misconceptions(ctx: Ctx): MisconceptionDto[] {
  const rows = ctx.db
    .prepare(
      `SELECT skill, error_note, COALESCE(error_confirmed, error_inferred) AS error, resolved_at FROM problems
       WHERE error_note IS NOT NULL AND resolved_at >= ? ORDER BY resolved_at`,
    )
    .all(ctx.now() - ATTENTION.MISCONCEPTION_WINDOW_DAYS * DAY_MS) as {
    skill: string;
    error_note: string;
    error: string | null;
    resolved_at: number;
  }[];
  const found = new Map<string, MisconceptionDto>();
  for (const row of rows) {
    const note = fromJson<{ note: LText | null }>(row.error_note, { note: null }).note;
    if (!note || !isErrorType(row.error)) continue;
    const key = `${row.skill}\u0000${note.cs}`;
    const entry = found.get(key);
    if (entry) {
      entry.count++;
      entry.lastAt = row.resolved_at;
    } else {
      found.set(key, { skill: titled(row.skill), note, error: row.error, count: 1, lastAt: row.resolved_at });
    }
  }
  return [...found.values()]
    .filter((entry) => entry.count >= ATTENTION.MISCONCEPTION_REPEATS)
    .sort((a, b) => b.count - a.count || b.lastAt - a.lastAt)
    .slice(0, 8);
}

/**
 * Kinds of error over the last thirty days and the thirty before. A kind is counted only
 * where it rests on something — the learner confirmed it, the answer matched a known wrong
 * answer or pattern, or it came far too fast. The rest are counted as undetermined: the
 * label the model falls back on says how likely a slip was, not what went wrong.
 */
function errorKinds(ctx: Ctx): Pick<StudentDetailDto, 'errors' | 'errorsUndetermined'> {
  const now = ctx.now();
  const recentFrom = now - 30 * DAY_MS;
  const rows = ctx.db
    .prepare(
      `SELECT COALESCE(error_confirmed, error_inferred) AS error, resolved_at,
              (error_confirmed IS NOT NULL OR error_basis IN ('misconception', 'pattern', 'timing')) AS grounded
       FROM problems
       WHERE status IN ('solved', 'failed') AND resolved_at >= ? AND COALESCE(error_confirmed, error_inferred) IS NOT NULL`,
    )
    .all(now - 60 * DAY_MS) as { error: string; resolved_at: number; grounded: number }[];
  const kinds = new Map<ErrorType, { recent: number; previous: number }>();
  const undetermined = { recent: 0, previous: 0 };
  for (const row of rows) {
    const when = row.resolved_at >= recentFrom ? 'recent' : 'previous';
    if (row.grounded !== 1 || !isErrorType(row.error)) {
      undetermined[when]++;
      continue;
    }
    const entry = kinds.get(row.error) ?? { recent: 0, previous: 0 };
    entry[when]++;
    kinds.set(row.error, entry);
  }
  return {
    errors: [...kinds.entries()]
      .map(([type, counts]) => ({ type, family: ERROR_FAMILY[type], ...counts }))
      .sort((a, b) => b.recent - a.recent || b.previous - a.previous),
    errorsUndetermined: undetermined,
  };
}

function neglected(skills: readonly SkillDto[], now: number): StudentDetailDto['neglected'] {
  return skills
    .filter((skill) => skill.hasProblems && skill.role !== 'enrichment' && skill.role !== 'prerequisite')
    .map((skill) => ({
      id: skill.id,
      title: skill.title,
      weight: skill.weight,
      daysSince: skill.lastPracticedAt === null ? null : Math.floor((now - skill.lastPracticedAt) / DAY_MS),
      level: skill.level,
    }))
    .filter((entry) =>
      entry.daysSince === null ? true : entry.daysSince >= ATTENTION.NEGLECTED_DAYS && entry.level < 5,
    )
    .sort((a, b) => b.weight - a.weight || (b.daysSince ?? 9999) - (a.daysSince ?? 9999))
    .slice(0, 6)
    .map(({ level: _level, ...entry }) => entry);
}

const strongest = (skills: readonly SkillDto[]): StudentDetailDto['strongest'] =>
  skills
    .filter((skill) => skill.level >= 3)
    .sort((a, b) => b.level - a.level || b.theta - a.theta)
    .slice(0, 5)
    .map((skill) => ({ id: skill.id, title: skill.title, level: skill.level }));

/** What deserves a look, each with the figure it rests on. */
function attention(
  ctx: Ctx,
  skills: readonly SkillDto[],
  states: States,
  repeated: readonly MisconceptionDto[],
): AttentionDto[] {
  const now = ctx.now();
  const settings = getSettings(ctx);
  const out: AttentionDto[] = [];
  const flag = (
    kind: AttentionDto['kind'],
    count: number,
    skill: string | null = null,
    error: ErrorType | null = null,
  ): void => {
    out.push({ kind, skill: skill ? titled(skill) : null, error, count });
  };
  const total = (
    ctx.db.prepare(`SELECT COUNT(*) AS n FROM problems WHERE status IN ('solved', 'failed')`).get() as {
      n: number;
    }
  ).n;

  const diagnostic = diagnosticStatus(ctx, settings.goal);
  if (hasDiagnostic(settings.goal) && !diagnostic.done) flag('no-diagnostic', total);

  const last = lastActive(ctx);
  if (last !== null && now - last >= ATTENTION.INACTIVE_DAYS * DAY_MS)
    flag('inactive', Math.floor((now - last) / DAY_MS));

  for (const row of openAssignments(ctx)) {
    if (row.due_day !== null && row.due_day < today(ctx))
      flag('overdue-assignment', daysBetween(row.due_day, today(ctx)));
  }
  for (const entry of repeated.slice(0, 2)) flag('misconception', entry.count, entry.skill.id, entry.error);

  const failedReviews = skills.filter((skill) => states.get(skill.id)?.reviewFailed).slice(0, 2);
  for (const skill of failedReviews) flag('review-failed', states.get(skill.id)!.reviews.failed, skill.id);

  const stuck = skills
    .filter((skill) => skill.hasProblems && skill.level < 3)
    .map((skill) => ({
      skill,
      practised: (states.get(skill.id)?.attempts ?? 0) - (states.get(skill.id)?.diagnosed ?? 0),
    }))
    .filter((entry) => entry.practised >= ATTENTION.STUCK_ATTEMPTS)
    .sort((a, b) => b.practised - a.practised)
    .slice(0, 2);
  for (const entry of stuck) flag('stuck', entry.practised, entry.skill.id);

  const focus = errorFocus(ctx);
  if (focus) flag('recurring-error', focus.count, null, focus.type);

  const recent = ctx.db
    .prepare(
      `SELECT COUNT(*) AS problems,
              COALESCE(SUM(CASE WHEN hints_used + tutor_used > 0 THEN 1 ELSE 0 END), 0) AS hinted,
              COALESCE(SUM(CASE WHEN status = 'failed' AND wrong_attempts > 0 AND est_seconds > 0 AND seconds < 0.25 * est_seconds THEN 1 ELSE 0 END), 0) AS rushed
       FROM problems WHERE status IN ('solved', 'failed') AND resolved_at >= ?`,
    )
    .get(now - 14 * DAY_MS) as { problems: number; hinted: number; rushed: number };
  if (recent.rushed >= ATTENTION.RUSHED_WRONG) flag('guessing', recent.rushed);
  if (recent.problems >= ATTENTION.HINT_MIN_PROBLEMS && recent.hinted / recent.problems > ATTENTION.HINT_SHARE)
    flag('hint-reliance', recent.hinted);

  // Only once there is enough work for "not touched" to mean a choice rather than a start.
  if (total >= 30) {
    const left = neglected(skills, now)[0];
    if (left) flag('neglected', left.daysSince ?? 0, left.id);
  }
  return out;
}

/** The one thing most worth doing next, by rules in a fixed order. */
function intervention(
  ctx: Ctx,
  flags: readonly AttentionDto[],
  summary: Pick<StudentSummaryDto, 'readiness'>,
  top: string | null,
): InterventionDto {
  const first = (kind: AttentionDto['kind']): AttentionDto | undefined => flags.find((entry) => entry.kind === kind);
  const act = (kind: InterventionDto['kind'], reason: string, from?: AttentionDto): InterventionDto => ({
    kind,
    reason,
    skill: from?.skill ?? null,
    error: from?.error ?? null,
  });
  const noTest = first('no-diagnostic');
  if (noTest && noTest.count < 10) return act('run-diagnostic', 'no-placement');
  const inactive = first('inactive');
  if (inactive && inactive.count >= 7) return act('check-in', 'inactive', inactive);
  const idea = first('misconception');
  if (idea) return act('explain', 'misconception', idea);
  const failed = first('review-failed') ?? first('stuck');
  if (failed) return act('assign-remediation', failed.kind, failed);
  const pattern = first('recurring-error');
  if (pattern) return act('explain', 'recurring-error', pattern);
  if (summary.readiness?.verdict === 'test-ready') {
    const last = summary.readiness.timed.last;
    if (!last || ctx.now() - last.finishedAt >= ATTENTION.TEST_EVERY_DAYS * DAY_MS)
      return act('timed-test', 'ready-for-test');
  }
  const due = (
    ctx.db.prepare('SELECT COUNT(*) AS n FROM skill_state WHERE due_at IS NOT NULL AND due_at <= ?').get(ctx.now()) as {
      n: number;
    }
  ).n;
  if (due >= ATTENTION.REVIEWS_DUE) return act('assign-review', 'reviews-due');
  return {
    kind: 'keep-going',
    reason: top ? 'next-step' : 'nothing-yet',
    skill: top ? titled(top) : null,
    error: null,
  };
}

// ----------------------------------------------------------------------------- overview

interface Gathered {
  summary: StudentSummaryDto;
  skills: SkillDto[];
  states: States;
  repeated: MisconceptionDto[];
  path: ReturnType<typeof nextSteps>;
}

function gather(student: Learner): Gathered {
  const ctx = student.ctx;
  const settings = getSettings(ctx);
  const goal = getGoal(settings.goal);
  const now = ctx.now();
  const states = loadStates(ctx);
  const skills = allSkills(ctx, states, goal.id);
  const repeated = misconceptions(ctx);
  const path = nextSteps(selectionFor(ctx, states), 5);
  const readiness = goal.kind === 'entrance' ? readinessFor(ctx, states) : null;
  const flags = attention(ctx, skills, states, repeated);
  const paths = Object.fromEntries(PATH_STATES.map((state) => [state, 0])) as Record<PathState, number>;
  for (const skill of skills) if (skill.hasProblems) paths[skill.path]++;
  const day = today(ctx);
  const daysLeft = settings.examDay ? daysBetween(day, settings.examDay) : null;
  const diagnostic = diagnosticStatus(ctx, goal.id);

  const summary: StudentSummaryDto = {
    username: student.username,
    name: settings.name,
    goal: { id: goal.id, kind: goal.kind, title: goal.title, short: goal.short },
    examDay: settings.examDay,
    daysLeft: daysLeft !== null && daysLeft >= 0 ? daysLeft : null,
    lastActiveAt: lastActive(ctx),
    week: figures(ctx, now - 7 * DAY_MS, now + 1),
    previousWeek: figures(ctx, now - 14 * DAY_MS, now - 7 * DAY_MS),
    readiness,
    attention: flags,
    intervention: { kind: 'keep-going', reason: 'nothing-yet', skill: null, error: null },
    openAssignments: openAssignments(ctx).length,
    diagnosed: diagnostic.done,
    paths,
  };
  summary.intervention = intervention(ctx, flags, summary, path[0]?.skill.id ?? null);
  return { summary, skills, states, repeated, path };
}

export const studentSummary = (student: Learner): StudentSummaryDto => gather(student).summary;

function weeklyFigures(ctx: Ctx, weeks = 8): (WeekFiguresDto & { week: string })[] {
  const current = weekStart(today(ctx));
  const out: (WeekFiguresDto & { week: string })[] = [];
  const rows = ctx.db
    .prepare(
      `SELECT day, status, first_try, hints_used + tutor_used AS help, seconds, run_id, exam_id FROM problems
       WHERE status IN ('solved', 'failed') AND day >= ?`,
    )
    .all(addDays(current, -7 * (weeks - 1))) as {
    day: string;
    status: string;
    first_try: number | null;
    help: number;
    seconds: number | null;
    run_id: string | null;
    exam_id: string | null;
  }[];
  for (let i = weeks - 1; i >= 0; i--) {
    const week = addDays(current, -7 * i);
    const end = addDays(week, 7);
    const list = rows.filter((row) => row.day >= week && row.day < end);
    const solved = list.filter((row) => row.status === 'solved');
    out.push({
      week,
      problems: list.length,
      solved: solved.length,
      firstTry: solved.filter((row) => row.first_try === 1).length,
      unaided: solved.filter((row) => row.first_try === 1 && row.help === 0).length,
      hinted: list.filter((row) => row.help > 0).length,
      minutes: Math.round(list.reduce((sum, row) => sum + (row.seconds ?? 0), 0) / 60),
      activeDays: new Set(list.map((row) => row.day)).size,
      sessions: new Set(list.map((row) => row.run_id ?? row.exam_id).filter(Boolean)).size,
    });
  }
  return out;
}

export function studentDetail(teacher: Ctx, student: Learner): StudentDetailDto {
  const ctx = student.ctx;
  const { summary, skills, states, repeated, path } = gather(student);
  const numbers = analytics(ctx);
  const settings = getSettings(ctx);
  const counted = [...states.values()].reduce(
    (sum, state) => ({
      firstTry: sum.firstTry + state.firstTry,
      hinted: sum.hinted + state.hinted,
      guessed: sum.guessed + state.guessed,
    }),
    { firstTry: 0, hinted: 0, guessed: 0 },
  );
  return {
    ...summary,
    skills,
    path,
    areas: numbers.areas,
    timed: numbers.timed,
    totals: { ...numbers.totals, ...counted },
    weekly: weeklyFigures(ctx),
    ...errorKinds(ctx),
    misconceptions: repeated,
    neglected: neglected(skills, ctx.now()),
    strongest: strongest(skills),
    diagnostics: listDiagnostics(ctx, settings.goal),
    assignments: listAssignments(ctx),
    focus: focusDtos(ctx),
    exams: listExams(ctx),
    heatmap: heatmap(ctx).slice(-7 * 16),
    recent: recentItems(ctx, 12),
    inSchool: settings.inSchool,
    sessionMinutes: settings.sessionMinutes,
    notes: listNotes(teacher, student.username),
    sessions: listSessions(teacher, student.username),
  };
}

/** Students beside each other, skill by skill. No total and no order of merit: there is none to give. */
export function compare(students: readonly Learner[]): CompareDto {
  const gathered = students.map((student) => ({ student, ...gather(student) }));
  const order: string[] = [];
  const seen = new Set<string>();
  for (const entry of gathered) {
    for (const skill of entry.skills) {
      if (!seen.has(skill.id) && skill.hasProblems) {
        seen.add(skill.id);
        order.push(skill.id);
      }
    }
  }
  return {
    students: gathered.map((entry) => entry.summary),
    skills: order.map((id) => {
      const concept = getConcept(id)!;
      return {
        id,
        title: concept.title,
        area: concept.area,
        cells: Object.fromEntries(
          gathered.map((entry) => {
            const skill = entry.skills.find((candidate) => candidate.id === id);
            return [
              entry.student.username,
              skill
                ? {
                    level: skill.level,
                    path: skill.path,
                    role: skill.role,
                    weight: skill.weight,
                    attempts: skill.attempts,
                  }
                : null,
            ];
          }),
        ),
      };
    }),
    weekly: Object.fromEntries(gathered.map((entry) => [entry.student.username, weeklyFigures(entry.student.ctx)])),
  };
}

// ------------------------------------------------------------------------------ history

/** What an input meant, where the input itself is an option id or a line number. */
function readable(spec: AnswerSpec, input: string): LText | null {
  if (spec.kind === 'choice') {
    const texts = input
      .split(',')
      .map((id) => spec.options.find((option) => option.id === id.trim())?.text)
      .filter((text): text is LText => text !== undefined);
    return texts.length === 0 ? null : L(texts.map((t) => t.cs).join('; '), texts.map((t) => t.en).join('; '));
  }
  if (spec.kind === 'spot') {
    const line = Number(input);
    return Number.isInteger(line) ? L(`řádek ${line + 1}`, `line ${line + 1}`) : null;
  }
  return null;
}

export interface HistoryQuery {
  skill?: string;
  /** Only problems resolved before this time: for paging backwards. */
  before?: number;
  limit?: number;
  /** Only problems with a wrong answer or given up. */
  onlyMistakes?: boolean;
}

/** A learner's problems, newest first, with everything that was typed. */
export function history(ctx: Ctx, query: HistoryQuery = {}): HistoryItemDto[] {
  const limit = Math.min(100, Math.max(1, query.limit ?? 30));
  const where = [`status IN ('solved', 'failed', 'skipped')`, 'resolved_at IS NOT NULL'];
  const args: (string | number)[] = [];
  if (query.skill) {
    where.push('skill = ?');
    args.push(query.skill);
  }
  if (query.before) {
    where.push('resolved_at < ?');
    args.push(query.before);
  }
  if (query.onlyMistakes) where.push(`(status != 'solved' OR wrong_attempts > 0)`);
  const rows = ctx.db
    .prepare(`SELECT * FROM problems WHERE ${where.join(' AND ')} ORDER BY resolved_at DESC, rowid DESC LIMIT ?`)
    .all(...args, limit) as ProblemRow[];
  const attempts = ctx.db.prepare('SELECT input, verdict, at FROM attempts WHERE problem_id = ? ORDER BY id');
  return rows.map((row) => {
    const snapshot = snapshotOf(row);
    const spec = snapshot.answer;
    const error = row.error_confirmed ?? row.error_inferred;
    const inputs = (attempts.all(row.id) as { input: string; verdict: string; at: number }[]).map((attempt) => ({
      ...attempt,
      text: readable(spec, attempt.input),
    }));
    return {
      problemId: row.id,
      at: row.resolved_at!,
      skill: row.skill,
      title: getConcept(row.skill)?.title ?? L(row.skill, row.skill),
      level: row.level as Level,
      context: row.context as HistoryItemDto['context'],
      purpose: isPurpose(row.purpose) ? row.purpose : null,
      prompt: snapshot.prompt,
      figure: snapshot.figure ?? null,
      status: row.status as HistoryItemDto['status'],
      firstTry: row.first_try === 1,
      hints: row.hints_used,
      tutor: row.tutor_used > 0,
      seconds: Math.round(row.seconds ?? 0),
      estSeconds: row.est_seconds,
      confidence:
        row.confidence === 'sure' || row.confidence === 'think' || row.confidence === 'guess' ? row.confidence : null,
      error: isErrorType(error) ? error : null,
      errorConfirmed: row.error_confirmed !== null,
      note: fromJson<{ note: LText | null }>(row.error_note, { note: null }).note,
      inputs,
      answerTex: L(answerToTex(spec, 'cs'), answerToTex(spec, 'en')),
      answerText:
        spec.kind === 'choice'
          ? readable(spec, spec.correct.join(','))
          : spec.kind === 'spot'
            ? readable(spec, String(spec.wrongLine))
            : null,
    };
  });
}

// -------------------------------------------------------- what a teacher sets for a learner

/**
 * A learner's goal, examination date and what their class is on, set by their teacher.
 * Nothing else of a learner's settings is a teacher's to change.
 */
export function setStudentGoal(student: Ctx, patch: Record<string, unknown>): void {
  const allowed: Record<string, unknown> = {};
  for (const key of ['goal', 'examDay', 'inSchool'] as const) {
    if (patch[key] !== undefined) allowed[key] = patch[key];
  }
  // Through the learner's own settings, so that the same validation applies.
  updateSettings(student, allowed);
  regeneratePlan(student);
}

// -------------------------------------------------------------------------------- notes

interface NoteRow {
  id: string;
  student: string;
  skill: string | null;
  body: string;
  created_at: number;
  updated_at: number;
}

const noteDto = (row: NoteRow): NoteDto => ({
  id: row.id,
  student: row.student,
  skill: row.skill ? titled(row.skill) : null,
  body: row.body,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

/** The teacher's notes about one learner, newest first. They live in the teacher's database. */
export function listNotes(teacher: Ctx, student: string): NoteDto[] {
  const rows = teacher.db
    .prepare('SELECT * FROM student_notes WHERE student = ? ORDER BY created_at DESC, rowid DESC LIMIT 200')
    .all(student) as NoteRow[];
  return rows.map(noteDto);
}

const noteBody = (value: unknown): string => {
  const body = typeof value === 'string' ? value.trim().slice(0, 4000) : '';
  if (body === '') throw badRequest('a note needs some text');
  return body;
};

export function addNote(teacher: Ctx, student: string, input: { body: unknown; skill?: unknown }): NoteDto {
  const skill = typeof input.skill === 'string' && getConcept(input.skill) ? input.skill : null;
  const id = newId();
  const now = teacher.now();
  teacher.db
    .prepare('INSERT INTO student_notes (id, student, skill, body, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)')
    .run(id, student, skill, noteBody(input.body), now, now);
  return noteDto(teacher.db.prepare('SELECT * FROM student_notes WHERE id = ?').get(id) as NoteRow);
}

/** A note of this teacher's about this learner; anything else does not exist as far as the caller can tell. */
function ownNote(teacher: Ctx, student: string, id: string): NoteRow {
  const row = teacher.db.prepare('SELECT * FROM student_notes WHERE id = ? AND student = ?').get(id, student) as
    NoteRow | undefined;
  if (!row) throw notFound('note');
  return row;
}

export function updateNote(teacher: Ctx, student: string, id: string, body: unknown): NoteDto {
  ownNote(teacher, student, id);
  teacher.db
    .prepare('UPDATE student_notes SET body = ?, updated_at = ? WHERE id = ?')
    .run(noteBody(body), teacher.now(), id);
  return noteDto(ownNote(teacher, student, id));
}

export function deleteNote(teacher: Ctx, student: string, id: string): void {
  ownNote(teacher, student, id);
  teacher.db.prepare('DELETE FROM student_notes WHERE id = ?').run(id);
}

// ---------------------------------------------------------------------------- sessions

interface SessionRow {
  id: string;
  student: string;
  started_at: number;
  finished_at: number | null;
  brief: string;
  items: string;
  wrap: string | null;
}

type StoredItem = Omit<TeachItemDto, 'title'> & { kind: 'generator' | 'static' };

const EMPTY_BRIEF: TeachBriefDto = {
  strongest: [],
  gaps: [],
  mistakes: [],
  misconceptions: [],
  priorities: [],
  sequence: [],
  since: { lastSessionAt: null, next: '', homework: [], problems: 0, activeDays: 0 },
};

function sessionRow(teacher: Ctx, student: string, id: string): SessionRow {
  const row = teacher.db.prepare('SELECT * FROM teach_sessions WHERE id = ? AND student = ?').get(id, student) as
    SessionRow | undefined;
  if (!row) throw notFound('session');
  return row;
}

const itemDto = (item: StoredItem): TeachItemDto => ({
  id: item.id,
  skill: item.skill,
  title: getConcept(item.skill)?.title ?? L(item.skill, item.skill),
  generator: item.generator,
  seed: item.seed,
  level: item.level,
  outcome: item.outcome,
  note: item.note,
  at: item.at,
});

export function listSessions(teacher: Ctx, student: string): TeachSessionSummaryDto[] {
  const rows = teacher.db
    .prepare('SELECT * FROM teach_sessions WHERE student = ? ORDER BY started_at DESC LIMIT 30')
    .all(student) as SessionRow[];
  return rows.map((row) => {
    const wrap = fromJson<TeachWrapDto | null>(row.wrap, null);
    return {
      id: row.id,
      student: row.student,
      startedAt: row.started_at,
      finishedAt: row.finished_at,
      items: fromJson<StoredItem[]>(row.items, []).length,
      covered: (wrap?.covered ?? []).map(titled),
      next: wrap?.next ?? '',
    };
  });
}

/**
 * What to know before sitting down with a learner: where they are strong, what is in the
 * way, what went wrong lately, and an order for the session. Each step of the order comes
 * from a rule that is named, so the teacher can see why it is there and overrule it.
 */
export function brief(teacher: Ctx, student: Learner): TeachBriefDto {
  const ctx = student.ctx;
  const { skills, repeated, path, summary } = gather(student);
  const now = ctx.now();
  const errors = errorSummary(ctx);
  const byId = new Map(skills.map((skill) => [skill.id, skill]));

  const previous = teacher.db
    .prepare(
      'SELECT * FROM teach_sessions WHERE student = ? AND finished_at IS NOT NULL ORDER BY finished_at DESC LIMIT 1',
    )
    .get(student.username) as SessionRow | undefined;
  const since = previous?.finished_at ?? null;
  const previousWrap = fromJson<TeachWrapDto | null>(previous?.wrap, null);
  const worked = figures(ctx, since ?? now - 14 * DAY_MS, now + 1);

  // Gaps: from the readiness report where the goal has one; otherwise the weakest practised skills.
  const gaps: TeachBriefDto['gaps'] = summary.readiness
    ? summary.readiness.gaps.map((gap) => ({
        ...titled(gap.id),
        weight: gap.weight,
        level: byId.get(gap.id)?.level ?? 0,
        holdsUp: gap.holdsUp.map(titled),
      }))
    : skills
        .filter((skill) => skill.attempts > 0 && skill.level < 3 && skill.hasProblems)
        .sort((a, b) => a.progress - b.progress)
        .slice(0, 6)
        .map((skill) => ({ id: skill.id, title: skill.title, weight: skill.weight, level: skill.level, holdsUp: [] }));

  const strong = strongest(skills);
  const sequence: TeachBriefDto['sequence'] = [];
  const step = (
    kind: TeachBriefDto['sequence'][number]['kind'],
    skill: string | null,
    minutes: number,
    reason: string,
    error: ErrorType | null = null,
  ): void => {
    sequence.push({ kind, skill: skill ? titled(skill) : null, minutes, reason, error });
  };
  const lastHard = (previousWrap?.hard ?? []).find((id) => byId.has(id));
  // 1. Start with something that goes well — and that is not about to be checked anyway.
  const warmUp = strong.find((skill) => skill.id !== lastHard);
  if (warmUp) step('warm-up', warmUp.id, 5, 'start-with-success');
  // 2. What was hard last time, checked before anything new is built on it.
  if (lastHard) step('check', lastHard, 5, 'check-last-time');
  // 3. The main thing to explain: a wrong idea that keeps coming back, else the biggest gap.
  const idea = repeated[0];
  const mainSkill =
    idea?.skill.id ??
    gaps[0]?.id ??
    path.find((entry) => entry.purpose === 'repair' || entry.purpose === 'new')?.skill.id ??
    null;
  if (mainSkill) {
    const reason = idea
      ? 'misconception'
      : gaps[0]?.holdsUp.length
        ? 'blocks-others'
        : gaps[0]
          ? 'biggest-gap'
          : 'next-step';
    step('explain', mainSkill, 15, reason, idea?.error ?? null);
    step('practise', mainSkill, 10, 'practise-together');
  }
  // 4. A recurring kind of slip deserves a word about checking.
  const focus = errorFocus(ctx);
  if (focus && ERROR_FAMILY[focus.type] === 'slip') step('explain', null, 5, 'recurring-error', focus.type);
  // 5. Homework: what the selection would take next, apart from what was just explained.
  const homework = path.find((entry) => entry.skill.id !== mainSkill);
  if (homework) step('homework', homework.skill.id, 15, 'homework');

  return {
    strongest: strong,
    gaps,
    mistakes: errors.recent.slice(0, 8),
    misconceptions: repeated,
    priorities: path,
    sequence,
    since: {
      lastSessionAt: since,
      next: previousWrap?.next ?? '',
      homework: listAssignments(ctx).filter(
        (entry) => since === null || entry.createdAt >= since - 60_000 || entry.status === 'open',
      ),
      problems: worked.problems,
      activeDays: worked.activeDays,
    },
  };
}

function sessionDto(student: Learner, row: SessionRow): TeachSessionDto {
  const states = loadStates(student.ctx);
  const skills = allSkills(student.ctx, states);
  return {
    id: row.id,
    student: row.student,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    brief: fromJson<TeachBriefDto>(row.brief, EMPTY_BRIEF),
    items: fromJson<StoredItem[]>(row.items, []).map(itemDto),
    wrap: fromJson<TeachWrapDto | null>(row.wrap, null),
    skills: skills
      .filter((skill) => skill.hasProblems)
      .map((skill) => ({
        id: skill.id,
        title: skill.title,
        area: skill.area,
        levels: practiceLevels(skill.id),
        level: skill.level,
        path: skill.path,
      })),
  };
}

/** Begin a session, or return the one that is open: a teacher has one session with a learner at a time. */
export function beginSession(teacher: Ctx, student: Learner): TeachSessionDto {
  const open = teacher.db
    .prepare('SELECT * FROM teach_sessions WHERE student = ? AND finished_at IS NULL ORDER BY started_at DESC LIMIT 1')
    .get(student.username) as SessionRow | undefined;
  if (open) return sessionDto(student, open);
  const id = newId();
  teacher.db
    .prepare('INSERT INTO teach_sessions (id, student, started_at, brief) VALUES (?, ?, ?, ?)')
    .run(id, student.username, teacher.now(), toJson(brief(teacher, student)));
  return sessionDto(student, sessionRow(teacher, student.username, id));
}

export const getSession = (teacher: Ctx, student: Learner, id: string): TeachSessionDto =>
  sessionDto(student, sessionRow(teacher, student.username, id));

/** The problem an item of a session stands for, generated again from its seed. */
function instanceOf(item: Pick<StoredItem, 'generator' | 'seed' | 'level' | 'kind'>): {
  instance: ProblemInstance;
  estSeconds: number;
} {
  if (item.kind === 'static') {
    const problem = getStaticProblem(item.generator);
    if (!problem) throw notFound('problem');
    return {
      instance: {
        prompt: problem.prompt,
        figure: problem.figure,
        answer: problem.answer,
        hints: problem.hints,
        solution: problem.solution,
        misconceptions: problem.misconceptions,
        context: problem.context,
      },
      estSeconds: problem.estSeconds,
    };
  }
  const generator = getGenerator(item.generator);
  if (!generator) throw notFound('problem');
  return {
    instance: generator.generate(createRng(item.seed), item.level),
    estSeconds: Math.round(generator.estSeconds(item.level)),
  };
}

function problemDto(item: StoredItem): TeachProblemDto {
  const { instance, estSeconds } = instanceOf(item);
  return {
    item: itemDto(item),
    prompt: instance.prompt,
    figure: instance.figure ?? null,
    answer: publicAnswerSpec(instance.answer),
    hints: instance.hints,
    solution: instance.solution,
    answerTex: L(answerToTex(instance.answer, 'cs'), answerToTex(instance.answer, 'en')),
    estSeconds,
    misconceptions: (instance.misconceptions ?? []).map((entry) => ({ note: entry.note, error: entry.error })),
  };
}

function openSession(teacher: Ctx, student: string, id: string): { row: SessionRow; items: StoredItem[] } {
  const row = sessionRow(teacher, student, id);
  if (row.finished_at !== null) throw new HttpError(409, 'session_finished', 'this session is already finished');
  return { row, items: fromJson<StoredItem[]>(row.items, []) };
}

/**
 * Pick a problem to show. It is generated for the session and is not an attempt of the
 * learner's: what two people work out together says nothing about what one can do alone,
 * so it never reaches the learner's log or their mastery.
 */
export function sessionProblem(
  teacher: Ctx,
  student: Learner,
  id: string,
  request: Record<string, unknown>,
): TeachProblemDto {
  const { items } = openSession(teacher, student.username, id);
  const skill = typeof request.skill === 'string' ? request.skill : '';
  if (!conceptsOfGoal(getSettings(student.ctx).goal).some((concept) => concept.id === skill))
    throw badRequest(`"${skill}" is not part of the learner's goal`);
  const sources = [
    ...generatorsFor(skill)
      .filter((generator) => !generator.deprecated)
      .map((generator) => ({ id: generator.id, kind: 'generator' as const, levels: generator.levels })),
    ...staticProblemsFor(skill)
      .filter((problem) => problem.answer.kind !== 'self')
      .map((problem) => ({ id: problem.id, kind: 'static' as const, levels: [problem.level] })),
  ];
  const available = practiceLevels(skill);
  if (sources.length === 0 || available.length === 0)
    throw new HttpError(422, 'no_problems', `there are no problems for "${skill}": it cannot be shown on a screen`);
  const state = stateOf(loadStates(student.ctx), skill);
  const wanted = typeof request.level === 'number' ? (Math.round(request.level) as Level) : undefined;
  const level =
    wanted !== undefined && available.includes(wanted)
      ? wanted
      : chooseLevel({ theta: state.theta, attempts: state.attempts, available, byEstimate: state.placement !== null });
  const seed = newSeed();
  // Not the families already shown in this session, as far as the skill has others.
  const shown = new Set(items.filter((item) => item.skill === skill).map((item) => item.generator));
  const atLevel = sources.filter((source) => source.levels.includes(level));
  const fresh = atLevel.filter((source) => !shown.has(source.id));
  const source = createRng(seed ^ 0x2f6e2b1).pick(fresh.length > 0 ? fresh : atLevel);
  const item: StoredItem = {
    id: newId(),
    skill,
    generator: source.id,
    kind: source.kind,
    seed,
    level,
    outcome: null,
    note: '',
    at: teacher.now(),
  };
  const dto = problemDto(item);
  teacher.db.prepare('UPDATE teach_sessions SET items = ? WHERE id = ?').run(toJson([...items, item]), id);
  return dto;
}

/** Show an item of the session again (after a reload, or to go back to it). */
export function sessionItemProblem(teacher: Ctx, student: string, id: string, itemId: string): TeachProblemDto {
  const item = fromJson<StoredItem[]>(sessionRow(teacher, student, id).items, []).find((entry) => entry.id === itemId);
  if (!item) throw notFound('session item');
  return problemDto(item);
}

/** How a shown problem went, as the teacher saw it. */
export function recordItem(
  teacher: Ctx,
  student: Learner,
  id: string,
  itemId: string,
  input: { outcome?: unknown; note?: unknown },
): TeachSessionDto {
  const { items } = openSession(teacher, student.username, id);
  const item = items.find((entry) => entry.id === itemId);
  if (!item) throw notFound('session item');
  if (input.outcome === null) item.outcome = null;
  else if (input.outcome !== undefined) {
    if (!(SESSION_OUTCOMES as readonly unknown[]).includes(input.outcome)) throw badRequest('unknown outcome');
    item.outcome = input.outcome as SessionOutcome;
  }
  if (typeof input.note === 'string') item.note = input.note.trim().slice(0, 500);
  teacher.db.prepare('UPDATE teach_sessions SET items = ? WHERE id = ?').run(toJson(items), id);
  return getSession(teacher, student, id);
}

/** Check an answer the learner gave aloud or on paper, with the same evaluator the app uses. */
export function checkItem(
  teacher: Ctx,
  student: Learner,
  id: string,
  itemId: string,
  input: string,
): { verdict: 'correct' | 'incorrect' | 'invalid'; message: LText | null; note: LText | null } {
  const item = fromJson<StoredItem[]>(sessionRow(teacher, student.username, id).items, []).find(
    (entry) => entry.id === itemId,
  );
  if (!item) throw notFound('session item');
  const { instance } = instanceOf(item);
  const settings = getSettings(student.ctx);
  const check = checkAnswer(instance.answer, String(input).slice(0, 500), instance.misconceptions ?? [], {
    decimalComma: settings.decimalComma,
    locale: settings.locale,
  });
  return {
    verdict: check.verdict,
    message: check.verdict === 'invalid' ? check.message : null,
    note: check.verdict === 'incorrect' ? (check.diagnosis?.note ?? null) : null,
  };
}

const idList = (value: unknown, allowed: ReadonlySet<string>): string[] =>
  Array.isArray(value)
    ? [...new Set(value.filter((id): id is string => typeof id === 'string' && allowed.has(id)))]
    : [];

const text = (value: unknown, max: number): string => (typeof value === 'string' ? value.trim().slice(0, max) : '');

/**
 * Close a session with what it found. What the teacher writes down steers what the learner
 * is given next — a skill that was hard is brought forward, one that was covered is
 * checked, the homework becomes an assignment — and it changes no mastery level: a topic
 * that was discussed has not thereby been learned.
 */
export function finishSession(
  teacherName: string,
  teacher: Ctx,
  student: Learner,
  id: string,
  input: Record<string, unknown>,
): TeachSessionDto {
  const { items } = openSession(teacher, student.username, id);
  const inGoal = new Set(conceptsOfGoal(getSettings(student.ctx).goal).map((concept) => concept.id));
  const practisable = new Set([...inGoal].filter((skill) => practiceLevels(skill).length > 0));
  const hard = idList(input.hard, inGoal);
  const covered = [...new Set([...idList(input.covered, inGoal), ...hard])];
  const homeworkInput =
    typeof input.homework === 'object' && input.homework !== null ? (input.homework as Record<string, unknown>) : null;
  const homeworkSkills = homeworkInput ? idList(homeworkInput.skills, practisable).slice(0, 8) : [];
  const wrap: TeachWrapDto = {
    covered,
    improved: idList(input.improved, inGoal),
    hard,
    misconceptions: text(input.misconceptions, 2000),
    homework:
      homeworkInput && homeworkSkills.length > 0
        ? {
            skills: homeworkSkills,
            minutes: Math.min(
              90,
              Math.max(5, typeof homeworkInput.minutes === 'number' ? Math.round(homeworkInput.minutes) : 15),
            ),
            dueDay: isDay(homeworkInput.dueDay) ? homeworkInput.dueDay : null,
            note: text(homeworkInput.note, 300),
          }
        : null,
    next: text(input.next, 1000),
    summary: text(input.summary, 2000),
  };
  const now = teacher.now();

  // The teacher's own record first; then what follows from it for the learner.
  teacher.db
    .prepare('UPDATE teach_sessions SET finished_at = ?, wrap = ?, items = ? WHERE id = ?')
    .run(now, toJson(wrap), toJson(items), id);

  student.ctx.db.transaction(() => {
    for (const skill of covered) {
      if (!practisable.has(skill)) continue;
      setFocus(student.ctx, teacherName, skill, hard.includes(skill) ? 'difficulty' : 'covered');
    }
    // Problems that did not go well in the session count as difficulty too.
    for (const item of items) {
      if (item.outcome === 'not-yet' && practisable.has(item.skill))
        setFocus(student.ctx, teacherName, item.skill, 'difficulty');
    }
    if (wrap.homework) {
      createAssignment(student.ctx, teacherName, {
        kind: 'practice',
        skills: wrap.homework.skills,
        minutes: wrap.homework.minutes,
        dueDay: wrap.homework.dueDay,
        note: wrap.homework.note,
      });
    }
  })();
  regeneratePlan(student.ctx);
  return getSession(teacher, student, id);
}
