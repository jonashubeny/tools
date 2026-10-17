import { FORMAT_TAGS, conceptsOfGoal, generatorsFor, getConcept, getGoal, staticProblemsFor } from '@lemma/content';
import {
  type DiagnosticAnswer,
  type DiagnosticConfig,
  type DiagnosticDto,
  type DiagnosticItem,
  type DiagnosticOutcome,
  type DiagnosticStage,
  type GoalId,
  type Level,
  DIAGNOSTIC,
  L,
  PLACEMENT,
  diagnosticQueue,
  isErrorType,
  nextDiagnosticItem,
  verdictFor,
} from '@lemma/core';
import { fromJson, toJson } from '../db';
import { type Ctx, goalOf, notFound } from './context';
import { loadStates } from './learner';
import type { ProblemRow } from './practice';

/**
 * The placement test, as the database sees it. Which problem comes next is decided in
 * core (learning/diagnostic.ts); this module supplies that decision with the goal's
 * anchors and the answers so far, and writes down what the test concluded.
 *
 * The problems of a test are ordinary rows of the log, in the context 'diagnostic'. The
 * learner model is rebuilt from them like from any others, placements included.
 */

/** A true/false statement is a coin flip: too weak a question for a placement. */
const usableIn = (tags: readonly string[] | undefined): boolean => !tags?.includes(FORMAT_TAGS.truefalse);

/** Levels at which a skill can be asked in a placement test, ascending. */
export function diagnosticLevels(skill: string): Level[] {
  return [
    ...new Set([
      ...generatorsFor(skill)
        .filter((generator) => !generator.deprecated && usableIn(generator.tags))
        .flatMap((generator) => generator.levels),
      ...staticProblemsFor(skill)
        .filter((problem) => problem.answer.kind !== 'self')
        .map((problem) => problem.level),
    ]),
  ].sort((a, b) => a - b);
}

export const isDiagnosticCandidate = usableIn;

export function diagnosticConfig(goal: GoalId): DiagnosticConfig {
  const concepts = conceptsOfGoal(goal);
  const order = new Map(concepts.map((concept, index) => [concept.id, index]));
  return {
    anchors: getGoal(goal).anchors.filter((id) => order.has(id) && diagnosticLevels(id).length > 0),
    // The nearest building block first — the prerequisite taught last. If that one is
    // missing as well, the gap goes deeper, and the placements say so.
    prereqs: (skill) =>
      (getConcept(skill)?.prereqs ?? [])
        .filter((id) => order.has(id) && diagnosticLevels(id).length > 0)
        .sort((a, b) => order.get(b)! - order.get(a)!),
    levelsOf: diagnosticLevels,
  };
}

/** Does this goal have a placement test? (The school goal has no anchors and none.) */
export const hasDiagnostic = (goal: GoalId): boolean => diagnosticConfig(goal).anchors.length > 0;

interface Reason {
  stage?: DiagnosticStage;
  anchor?: string;
}

const STAGES: readonly DiagnosticStage[] = ['anchor', 'second-chance', 'prerequisite', 'harder'];

function outcomeOf(row: ProblemRow): DiagnosticOutcome {
  if (row.status === 'solved' && row.first_try === 1) return 'correct';
  // "I do not know this": given up without an answer.
  if (row.wrong_attempts === 0) return 'skipped';
  return 'wrong';
}

/** The answered problems of a test, in the order they were asked. */
export function answersOf(rows: readonly ProblemRow[]): (DiagnosticAnswer & { row: ProblemRow })[] {
  const out: (DiagnosticAnswer & { row: ProblemRow })[] = [];
  for (const row of rows) {
    if (row.status !== 'solved' && row.status !== 'failed') continue;
    const reason = fromJson<Reason>(row.reason, {});
    const stage = STAGES.includes(reason.stage as DiagnosticStage) ? (reason.stage as DiagnosticStage) : 'anchor';
    out.push({
      skill: row.skill,
      level: row.level as Level,
      stage,
      anchor: reason.anchor ?? row.skill,
      outcome: outcomeOf(row),
      row,
    });
  }
  return out;
}

/** The next problem of a test, or null when it is over. */
export const chooseDiagnostic = (goal: GoalId, rows: readonly ProblemRow[]): DiagnosticItem | null =>
  nextDiagnosticItem(diagnosticConfig(goal), answersOf(rows));

/**
 * How many problems the test will have asked when it ends, as far as can be told now:
 * follow-ups are added as answers come in, so the number can still grow a little.
 */
export function diagnosticLength(goal: GoalId, rows: readonly ProblemRow[]): number {
  const config = diagnosticConfig(goal);
  const answers = answersOf(rows);
  const limit = config.maxItems ?? DIAGNOSTIC.MAX_ITEMS;
  return Math.min(limit, answers.length + diagnosticQueue(config, answers).length);
}

// ------------------------------------------------------------------------------- records

interface DiagnosticRow {
  id: string;
  goal: string;
  run_id: string;
  started_at: number;
  finished_at: number | null;
  report: string | null;
}

interface StoredReport {
  items: Omit<DiagnosticDto['items'][number], 'title'>[];
  verdicts: { skill: string; verdict: DiagnosticDto['verdicts'][number]['verdict'] }[];
  presumed: { id: string; direction: 'up' | 'down' }[];
}

const title = (id: string): DiagnosticDto['items'][number]['title'] => getConcept(id)?.title ?? L(id, id);

function runRows(ctx: Ctx, runId: string): ProblemRow[] {
  return ctx.db.prepare('SELECT * FROM problems WHERE run_id = ? ORDER BY issued_at, rowid').all(runId) as ProblemRow[];
}

function reportOf(ctx: Ctx, goal: GoalId, rows: readonly ProblemRow[]): StoredReport {
  const answers = answersOf(rows);
  const config = diagnosticConfig(goal);
  const asked = new Set(answers.map((answer) => answer.skill));
  const inGoal = new Set(conceptsOfGoal(goal).map((concept) => concept.id));
  const presumed: StoredReport['presumed'] = [];
  for (const state of loadStates(ctx).values()) {
    if (state.placement === null || asked.has(state.skill) || !inGoal.has(state.skill)) continue;
    if (state.placement.theta >= PLACEMENT.PRESUMED_OK) presumed.push({ id: state.skill, direction: 'up' });
    else if (state.placement.theta < 0) presumed.push({ id: state.skill, direction: 'down' });
  }
  return {
    items: answers.map((answer) => {
      const error = answer.row.error_confirmed ?? answer.row.error_inferred;
      // A kind of error is named only where it rests on something: the learner confirmed it,
      // or the answer matched a known wrong answer. A label the model defaulted to is not shown.
      const grounded =
        answer.row.error_confirmed !== null ||
        answer.row.error_basis === 'misconception' ||
        answer.row.error_basis === 'pattern';
      return {
        problemId: answer.row.id,
        skill: answer.skill,
        level: answer.level,
        stage: answer.stage,
        anchor: answer.anchor,
        outcome: answer.outcome,
        seconds: Math.round(answer.row.seconds ?? 0),
        error: answer.outcome === 'wrong' && grounded && isErrorType(error) ? error : null,
      };
    }),
    verdicts: config.anchors.map((skill) => ({ skill, verdict: verdictFor(skill, answers) })),
    presumed,
  };
}

/** Write down what a finished test found. */
export function closeDiagnostic(ctx: Ctx, runId: string): void {
  const row = ctx.db.prepare('SELECT * FROM diagnostics WHERE run_id = ?').get(runId) as DiagnosticRow | undefined;
  if (!row || row.finished_at !== null) return;
  const report = reportOf(ctx, row.goal as GoalId, runRows(ctx, runId));
  ctx.db
    .prepare('UPDATE diagnostics SET finished_at = ?, report = ? WHERE id = ?')
    .run(ctx.now(), toJson(report), row.id);
}

function toDto(ctx: Ctx, row: DiagnosticRow): DiagnosticDto {
  const finished = row.finished_at !== null;
  // While the test runs nothing is concluded, and nothing about right or wrong is shown.
  const report = finished
    ? (fromJson<StoredReport | null>(row.report, null) ?? reportOf(ctx, row.goal as GoalId, runRows(ctx, row.run_id)))
    : { items: [], verdicts: [], presumed: [] };
  return {
    id: row.id,
    goal: row.goal as GoalId,
    runId: row.run_id,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    items: report.items.map((item) => ({ ...item, title: title(item.skill) })),
    verdicts: report.verdicts.map((entry) => ({ ...entry, title: title(entry.skill) })),
    presumed: report.presumed.map((entry) => ({ ...entry, title: title(entry.id) })),
    counts: {
      asked: report.items.length,
      correct: report.items.filter((item) => item.outcome === 'correct').length,
      skipped: report.items.filter((item) => item.outcome === 'skipped').length,
    },
  };
}

export function getDiagnostic(ctx: Ctx, id: string): DiagnosticDto {
  const row = ctx.db.prepare('SELECT * FROM diagnostics WHERE id = ?').get(id) as DiagnosticRow | undefined;
  if (!row) throw notFound('diagnostic');
  return toDto(ctx, row);
}

/** Finished tests of the learner's goal, newest first: repeating one shows the development. */
export function listDiagnostics(ctx: Ctx, goal: GoalId = goalOf(ctx)): DiagnosticDto[] {
  const rows = ctx.db
    .prepare('SELECT * FROM diagnostics WHERE goal = ? AND finished_at IS NOT NULL ORDER BY finished_at DESC LIMIT 20')
    .all(goal) as DiagnosticRow[];
  return rows.map((row) => toDto(ctx, row));
}

export interface DiagnosticStatus {
  done: boolean;
  skipped: boolean;
  count: number;
  lastAt: number | null;
  /** The run of a test that was started and not finished. */
  running: string | null;
}

const skippedGoals = (ctx: Ctx): string[] => {
  const row = ctx.db.prepare(`SELECT value FROM settings WHERE key = 'diagnostic_skipped'`).get() as
    { value: string } | undefined;
  return row ? fromJson<string[]>(row.value, []) : [];
};

export function diagnosticStatus(ctx: Ctx, goal: GoalId = goalOf(ctx)): DiagnosticStatus {
  const finished = ctx.db
    .prepare(
      'SELECT COUNT(*) AS n, MAX(finished_at) AS last FROM diagnostics WHERE goal = ? AND finished_at IS NOT NULL',
    )
    .get(goal) as { n: number; last: number | null };
  const running = ctx.db
    .prepare('SELECT run_id FROM diagnostics WHERE goal = ? AND finished_at IS NULL ORDER BY started_at DESC LIMIT 1')
    .get(goal) as { run_id: string } | undefined;
  return {
    done: finished.n > 0,
    skipped: skippedGoals(ctx).includes(goal),
    count: finished.n,
    lastAt: finished.last,
    running: running?.run_id ?? null,
  };
}

/** The learner would rather start practising: the plan stops proposing the test. */
export function skipDiagnostic(ctx: Ctx, goal: GoalId = goalOf(ctx)): void {
  const goals = [...new Set([...skippedGoals(ctx), goal])];
  ctx.db
    .prepare(
      `INSERT INTO settings (key, value, updated_at) VALUES ('diagnostic_skipped', ?, ?)
       ON CONFLICT (key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    )
    .run(toJson(goals), ctx.now());
}

/** Record a new test for a run that has just been created. */
export function openDiagnostic(ctx: Ctx, id: string, goal: GoalId, runId: string): void {
  ctx.db
    .prepare('INSERT INTO diagnostics (id, goal, run_id, started_at) VALUES (?, ?, ?, ?)')
    .run(id, goal, runId, ctx.now());
}

export const diagnosticOfRun = (ctx: Ctx, runId: string): string | null =>
  (ctx.db.prepare('SELECT id FROM diagnostics WHERE run_id = ?').get(runId) as { id: string } | undefined)?.id ?? null;
