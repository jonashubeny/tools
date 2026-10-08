import {
  GENERATORS,
  STATIC_PROBLEMS,
  conceptsOfTopic,
  generatorsFor,
  getConcept,
  getGenerator,
  getStaticProblem,
  staticProblemsFor,
  topLevelOf,
} from '@lemma/content';
import {
  type AnswerResultDto,
  type AnswerSpec,
  type Confidence,
  type ErrorGuessDto,
  type ErrorType,
  type L as LText,
  type Level,
  type OutcomeDto,
  type PracticeContext,
  type ProblemDto,
  type ProblemInstance,
  type ProblemKind,
  type RunDto,
  type RunSummaryDto,
  type StartRunRequest,
  type StartRunResponse,
  ACTIVITY,
  ERROR_FAMILY,
  L,
  answerToTex,
  checkAnswer,
  chooseCandidate,
  chooseLevel,
  createRng,
  inferError,
  isErrorType,
  isUnaided,
  levelOf,
  nextLevelGates,
  pointsForProblem,
  predictSuccess,
  progressOf,
  publicAnswerSpec,
} from '@lemma/core';
import { fromJson, toJson } from '../db';
import { addEvent, award, checkCountMilestones } from './activity';
import { type Ctx, HttpError, badRequest, getSettings, newId, newSeed, notFound, today } from './context';
import { type States, applyResolved, factsFromRow, loadStates, replayAll, saveState, stateOf } from './learner';

/** The practice flow: issuing problems, checking answers, hints, and runs. */

export interface ProblemRow {
  id: string;
  run_id: string | null;
  exam_id: string | null;
  skill: string;
  source: string;
  source_kind: 'generator' | 'static';
  seed: number;
  level: number;
  kind: string;
  context: string;
  snapshot: string;
  est_seconds: number;
  issued_at: number;
  day: string;
  status: 'open' | 'solved' | 'failed' | 'skipped';
  hints_used: number;
  tutor_used: number;
  wrong_attempts: number;
  first_try: number | null;
  self_assessed: number;
  resolved_at: number | null;
  seconds: number | null;
  confidence: string | null;
  predicted: number | null;
  credit: number | null;
  points: number;
  review_passed: number;
  error_inferred: string | null;
  error_basis: string | null;
  error_note: string | null;
  error_skill: string | null;
  error_confirmed: string | null;
  level_before: number | null;
  level_after: number | null;
  replay_of: string | null;
}

interface QueueItem {
  skill: string;
  generator?: string;
  staticId?: string;
  /** Prefer problem types carrying this tag, where the skill has any. */
  tag?: string;
  level?: Level;
  floor?: Level;
  cap?: Level;
  seed?: number;
  replayOf?: string;
}

interface RunRow {
  id: string;
  context: string;
  day: string;
  plan_block: string | null;
  title: string | null;
  queue: string;
  position: number;
  params: string;
  started_at: number;
  finished_at: number | null;
}

const hidesSkill = (context: string): boolean => context === 'mixed' || context === 'exam';

export function getProblemRow(ctx: Ctx, id: string): ProblemRow {
  const row = ctx.db.prepare('SELECT * FROM problems WHERE id = ?').get(id) as ProblemRow | undefined;
  if (!row) throw notFound('problem');
  return row;
}

export const snapshotOf = (row: ProblemRow): ProblemInstance => JSON.parse(row.snapshot) as ProblemInstance;

/** How many submissions a problem allows before it is closed. */
export function maxTries(spec: AnswerSpec, context: string): number {
  if (context === 'exam' || spec.kind === 'self') return 1;
  if (spec.kind === 'choice') return spec.options.length <= 3 ? 1 : 2;
  if (spec.kind === 'spot') return 2;
  return 3;
}

function errorGuess(row: ProblemRow): ErrorGuessDto | null {
  if (!isErrorType(row.error_inferred)) return null;
  const extra = fromJson<{ note: LText | null; confident: boolean }>(row.error_note, { note: null, confident: false });
  const basis =
    row.error_basis === 'misconception' || row.error_basis === 'pattern' || row.error_basis === 'timing'
      ? row.error_basis
      : 'model';
  return {
    type: row.error_inferred,
    family: ERROR_FAMILY[row.error_inferred],
    basis,
    confident: extra.confident,
    note: extra.note,
  };
}

function outcomeDto(
  ctx: Ctx,
  row: ProblemRow,
  states: States,
  extras?: { progressBefore: number; milestones: string[] },
): OutcomeDto {
  const snapshot = snapshotOf(row);
  const spec = snapshot.answer;
  const concept = getConcept(row.skill);
  const state = stateOf(states, row.skill);
  return {
    solved: row.status === 'solved',
    credit: row.credit ?? 0,
    points: row.points,
    solution: snapshot.solution,
    answerTex: L(answerToTex(spec, 'cs'), answerToTex(spec, 'en')),
    model: spec.kind === 'self' ? spec.model : null,
    rubric: spec.kind === 'self' ? spec.rubric : [],
    skill: {
      id: row.skill,
      title: concept?.title ?? L(row.skill, row.skill),
      levelBefore: (row.level_before ?? 0) as OutcomeDto['skill']['levelBefore'],
      levelAfter: (row.level_after ?? 0) as OutcomeDto['skill']['levelAfter'],
      progressBefore: extras?.progressBefore ?? progressOf(state),
      progressAfter: progressOf(state),
      next: nextLevelGates(state, topLevelOf(row.skill)),
    },
    corrected: row.status === 'solved' && row.wrong_attempts > 0,
    reviewPassed: row.review_passed === 1,
    error: errorGuess(row),
    errorConfirmed: isErrorType(row.error_confirmed) ? row.error_confirmed : null,
    milestones: extras?.milestones ?? [],
    seconds: row.seconds ?? 0,
    wrongLine: spec.kind === 'spot' ? spec.wrongLine : null,
    correctOptions: spec.kind === 'choice' ? spec.correct : [],
  };
}

export function problemDto(
  ctx: Ctx,
  row: ProblemRow,
  states?: States,
  extras?: { progressBefore: number; milestones: string[] },
): ProblemDto {
  const snapshot = snapshotOf(row);
  const concept = getConcept(row.skill);
  const resolved = row.status !== 'open';
  // In interleaved practice the topic stays hidden until the answer is in: recognising the
  // kind of problem is part of what is being practised.
  const hidden = hidesSkill(row.context) && !resolved;
  const inputs = (
    ctx.db
      .prepare(`SELECT input FROM attempts WHERE problem_id = ? AND verdict = 'incorrect' ORDER BY id`)
      .all(row.id) as { input: string }[]
  ).map((a) => a.input);
  return {
    id: row.id,
    runId: row.run_id,
    concept: hidden ? null : row.skill,
    conceptTitle: hidden ? null : (concept?.title ?? null),
    kind: row.kind as ProblemKind,
    level: row.level as Level,
    context: row.context as PracticeContext,
    prompt: snapshot.prompt,
    figure: snapshot.figure ?? null,
    answer: publicAnswerSpec(snapshot.answer),
    hintCount: row.context === 'exam' ? 0 : snapshot.hints.length,
    hints: snapshot.hints.slice(0, row.hints_used),
    estSeconds: row.est_seconds,
    wrongAttempts: row.wrong_attempts,
    triesLeft: resolved ? 0 : Math.max(0, maxTries(snapshot.answer, row.context) - row.wrong_attempts),
    status: row.status,
    it: snapshot.context?.it ?? false,
    applied: snapshot.context?.applied ?? false,
    outcome:
      resolved &&
      row.status !== 'skipped' &&
      row.resolved_at !== null &&
      (row.context !== 'exam' || examFinished(ctx, row.exam_id))
        ? outcomeDto(ctx, row, states ?? loadStates(ctx), extras)
        : null,
    previousInputs: row.context === 'exam' ? [] : inputs,
  };
}

function examFinished(ctx: Ctx, examId: string | null): boolean {
  if (!examId) return true;
  const row = ctx.db.prepare('SELECT finished_at FROM exams WHERE id = ?').get(examId) as
    { finished_at: number | null } | undefined;
  return row?.finished_at !== null && row?.finished_at !== undefined;
}

// ------------------------------------------------------------------------------ issuing

interface Candidate {
  id: string;
  kind: ProblemKind;
  levels: Level[];
  sourceKind: 'generator' | 'static';
  tags?: string[];
}

/** Problem sources for a skill that make sense in the given context. */
export function candidatesFor(skill: string, context: string): Candidate[] {
  const out: Candidate[] = [];
  for (const generator of generatorsFor(skill)) {
    if (generator.deprecated) continue;
    out.push({
      id: generator.id,
      kind: generator.kind,
      levels: generator.levels,
      sourceKind: 'generator',
      tags: generator.tags,
    });
  }
  for (const problem of staticProblemsFor(skill)) {
    // Self-assessed explanations do not belong in a timed exam or a hidden-topic review.
    if (problem.answer.kind === 'self' && (context === 'exam' || context === 'mixed')) continue;
    out.push({ id: problem.id, kind: problem.kind, levels: [problem.level], sourceKind: 'static' });
  }
  return out;
}

export interface IssueOptions {
  skill: string;
  context: PracticeContext;
  runId?: string | null;
  examId?: string | null;
  generator?: string;
  staticId?: string;
  /** Prefer problem types carrying this tag, where the skill has any. */
  tag?: string;
  level?: Level;
  floor?: Level;
  cap?: Level;
  seed?: number;
  replayOf?: string;
  recent?: readonly string[];
  lastFailed?: boolean;
  unaidedStreak?: number;
  states?: States;
}

export function issueProblem(ctx: Ctx, opts: IssueOptions): ProblemRow {
  const states = opts.states ?? loadStates(ctx);
  const state = stateOf(states, opts.skill);
  let all = candidatesFor(opts.skill, opts.context);
  if (opts.generator) all = all.filter((candidate) => candidate.id === opts.generator);
  if (opts.staticId) all = all.filter((candidate) => candidate.id === opts.staticId);
  if (opts.tag) {
    const tagged = all.filter((candidate) => candidate.tags?.includes(opts.tag!));
    if (tagged.length > 0) all = tagged;
  }
  if (all.length === 0) throw new HttpError(422, 'no_problems', `no problems are available for "${opts.skill}" yet`);

  const available = [...new Set(all.flatMap((candidate) => candidate.levels))].sort((a, b) => a - b);
  const level =
    opts.level !== undefined && available.includes(opts.level)
      ? opts.level
      : chooseLevel({
          theta: state.theta,
          attempts: state.attempts,
          available,
          lastFailed: opts.lastFailed,
          unaidedStreak: opts.unaidedStreak,
          cap: opts.cap,
          floor: opts.floor,
        });

  const seed = opts.seed ?? newSeed();
  const picker = createRng(seed ^ 0x51ed270b);
  const chosen =
    chooseCandidate(all, level, opts.recent ?? [], picker) ??
    all.find((candidate) => candidate.levels.includes(level)) ??
    all[0]!;

  let instance: ProblemInstance;
  let estSeconds: number;
  if (chosen.sourceKind === 'generator') {
    const generator = getGenerator(chosen.id)!;
    instance = generator.generate(createRng(seed), level);
    estSeconds = Math.round(generator.estSeconds(level));
  } else {
    const problem = getStaticProblem(chosen.id)!;
    instance = {
      prompt: problem.prompt,
      figure: problem.figure,
      answer: problem.answer,
      hints: problem.hints,
      solution: problem.solution,
      misconceptions: problem.misconceptions,
      context: problem.context,
    };
    estSeconds = problem.estSeconds;
  }
  // The verification specs are an authoring aid; they are not stored or sent anywhere.
  const { verify: _verify, ...stored } = instance;

  const id = newId();
  const now = ctx.now();
  ctx.db
    .prepare(
      `INSERT INTO problems (id, run_id, exam_id, skill, source, source_kind, seed, level, kind, context, snapshot, est_seconds, issued_at, day, replay_of)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      id,
      opts.runId ?? null,
      opts.examId ?? null,
      opts.skill,
      chosen.id,
      chosen.sourceKind,
      seed,
      level,
      chosen.kind,
      opts.context,
      toJson(stored),
      estSeconds,
      now,
      today(ctx),
      opts.replayOf ?? null,
    );
  return getProblemRow(ctx, id);
}

// ---------------------------------------------------------------------------- resolving

const clampSeconds = (value: unknown, fallback: number): number => {
  const n = typeof value === 'number' && Number.isFinite(value) ? value : fallback;
  return Math.min(7200, Math.max(1, n));
};

interface ResolveInput {
  solved: boolean;
  seconds: number;
  /** Credit as a retry even though no wrong submission was recorded (self-assessed "partly"). */
  partial?: boolean;
}

/** Close a problem and fold it into the learner model, the activity log and the milestones. */
export function resolveProblem(
  ctx: Ctx,
  id: string,
  input: ResolveInput,
): { row: ProblemRow; states: States; progressBefore: number; milestones: string[] } {
  return ctx.db.transaction(() => {
    const before = getProblemRow(ctx, id);
    if (before.status !== 'open') throw new HttpError(409, 'already_resolved', 'this problem is already resolved');
    const now = ctx.now();
    const snapshot = snapshotOf(before);
    const selfAssessed = snapshot.answer.kind === 'self';
    const wrongAttempts = before.wrong_attempts + (input.partial ? 1 : 0);
    const firstTry = input.solved && wrongAttempts === 0;

    ctx.db
      .prepare(
        'UPDATE problems SET status = ?, resolved_at = ?, seconds = ?, first_try = ?, wrong_attempts = ?, self_assessed = ? WHERE id = ?',
      )
      .run(
        input.solved ? 'solved' : 'failed',
        now,
        input.seconds,
        firstTry ? 1 : 0,
        wrongAttempts,
        selfAssessed ? 1 : 0,
        id,
      );
    const row = getProblemRow(ctx, id);

    const states = loadStates(ctx);
    const facts = factsFromRow({ ...row, resolved_at: now });
    const progressBefore = progressOf(stateOf(states, row.skill));
    const { effect, touched } = applyResolved(states, facts);
    saveState(ctx, effect.state);
    for (const skill of touched) saveState(ctx, states.get(skill)!);

    const unaided = isUnaided({ ...facts, confidence: facts.confidence ?? undefined }) && !selfAssessed;
    const corrected = input.solved && before.wrong_attempts > 0;
    const attempted = ctx.db.prepare('SELECT 1 FROM attempts WHERE problem_id = ? LIMIT 1').get(id) !== undefined;
    const points = pointsForProblem({
      solved: input.solved,
      attempted,
      unaided,
      level: facts.level,
      corrected,
      reviewPassed: effect.reviewPassed,
    });

    ctx.db
      .prepare(
        'UPDATE problems SET predicted = ?, credit = ?, points = ?, review_passed = ?, level_before = ?, level_after = ? WHERE id = ?',
      )
      .run(
        effect.predicted,
        effect.credit,
        points,
        effect.reviewPassed ? 1 : 0,
        effect.levelBefore,
        effect.levelAfter,
        id,
      );

    addEvent(ctx, {
      type: 'problem',
      points,
      at: now,
      skill: row.skill,
      level: facts.level,
      ref: id,
      payload: { solved: input.solved, unaided, corrected, reviewPassed: effect.reviewPassed, context: row.context },
    });
    if (corrected) addEvent(ctx, { type: 'correction', points: 0, at: now, skill: row.skill, ref: id });

    const milestones: string[] = [];
    if (effect.levelAfter > effect.levelBefore) {
      addEvent(ctx, {
        type: 'level_up',
        points: ACTIVITY.LEVEL_UP,
        at: now,
        skill: row.skill,
        payload: { from: effect.levelBefore, to: effect.levelAfter },
      });
      if (effect.levelAfter >= 3 && award(ctx, 'first-familiar')) milestones.push('first-familiar');
      if (effect.levelAfter >= 4 && award(ctx, 'first-proficient')) milestones.push('first-proficient');
      if (effect.levelAfter >= 5 && award(ctx, 'first-mastered')) milestones.push('first-mastered');
      const topic = getConcept(row.skill)?.syllabusTopic;
      if (topic !== undefined && effect.levelAfter >= 4) {
        const allProficient = conceptsOfTopic(topic).every((concept) => {
          const state = states.get(concept.id);
          return state !== undefined && levelOf(state) >= 4;
        });
        if (allProficient && award(ctx, 'topic-proficient', String(topic))) milestones.push('topic-proficient');
      }
    }
    milestones.push(...checkCountMilestones(ctx));

    return { row: getProblemRow(ctx, id), states, progressBefore, milestones };
  })();
}

export interface AnswerRequest {
  input: string;
  seconds?: number;
  confidence?: Confidence;
}

export function submitAnswer(ctx: Ctx, id: string, request: AnswerRequest): AnswerResultDto {
  const row = getProblemRow(ctx, id);
  if (row.status !== 'open') throw new HttpError(409, 'already_resolved', 'this problem is already resolved');
  if (row.context === 'exam') throw new HttpError(409, 'exam_problem', 'exam problems are answered through the exam');
  const snapshot = snapshotOf(row);
  const spec = snapshot.answer;
  const settings = getSettings(ctx);
  const input = String(request.input ?? '').slice(0, 500);
  const check = checkAnswer(spec, input, snapshot.misconceptions ?? [], {
    decimalComma: settings.decimalComma,
    locale: settings.locale,
  });
  const tries = maxTries(spec, row.context);

  if (check.verdict === 'invalid') {
    return {
      verdict: 'invalid',
      message: check.message,
      resolved: false,
      triesLeft: Math.max(0, tries - row.wrong_attempts),
      error: null,
      problem: problemDto(ctx, row),
    };
  }

  const now = ctx.now();
  const seconds = clampSeconds(request.seconds, (now - row.issued_at) / 1000);
  ctx.db
    .prepare('INSERT INTO attempts (problem_id, at, input, verdict, diagnosis) VALUES (?, ?, ?, ?, ?)')
    .run(
      id,
      now,
      input,
      check.verdict,
      check.verdict === 'incorrect' && check.diagnosis ? toJson(check.diagnosis) : null,
    );
  if (row.confidence === null && request.confidence) {
    ctx.db.prepare('UPDATE problems SET confidence = ? WHERE id = ?').run(request.confidence, id);
  }

  if (check.verdict === 'correct') {
    const result = resolveProblem(ctx, id, { solved: true, seconds });
    return {
      verdict: 'correct',
      message: null,
      resolved: true,
      triesLeft: 0,
      error: null,
      problem: problemDto(ctx, result.row, result.states, result),
    };
  }

  // A self-assessed "partly" counts as solved with reduced credit; "no" as not solved.
  if (spec.kind === 'self') {
    const partly = input.trim() === 'partly';
    const result = resolveProblem(ctx, id, { solved: partly, seconds, partial: partly });
    return {
      verdict: 'incorrect',
      message: null,
      resolved: true,
      triesLeft: 0,
      error: null,
      problem: problemDto(ctx, result.row, result.states, result),
    };
  }

  const wrongAttempts = row.wrong_attempts + 1;
  ctx.db.prepare('UPDATE problems SET wrong_attempts = ? WHERE id = ?').run(wrongAttempts, id);

  // The first wrong answer is the informative one: later ones are corrections of it.
  if (row.wrong_attempts === 0) {
    const state = stateOf(loadStates(ctx), row.skill);
    const guess = inferError({
      diagnosis: check.diagnosis,
      predicted: predictSuccess(state.theta, row.level as Level),
      seconds,
      expectedSeconds: row.est_seconds,
    });
    ctx.db
      .prepare('UPDATE problems SET error_inferred = ?, error_basis = ?, error_note = ?, error_skill = ? WHERE id = ?')
      .run(
        guess.type,
        guess.basis,
        toJson({ note: check.diagnosis?.note ?? null, confident: guess.confident }),
        check.diagnosis?.skill ?? null,
        id,
      );
  }

  if (wrongAttempts >= tries) {
    const result = resolveProblem(ctx, id, { solved: false, seconds });
    return {
      verdict: 'incorrect',
      message: null,
      resolved: true,
      triesLeft: 0,
      error: errorGuess(result.row),
      problem: problemDto(ctx, result.row, result.states, result),
    };
  }
  const updated = getProblemRow(ctx, id);
  return {
    verdict: 'incorrect',
    message: null,
    resolved: false,
    triesLeft: tries - wrongAttempts,
    error: errorGuess(updated),
    problem: problemDto(ctx, updated),
  };
}

export function takeHint(ctx: Ctx, id: string): ProblemDto {
  const row = getProblemRow(ctx, id);
  if (row.status !== 'open') throw new HttpError(409, 'already_resolved', 'this problem is already resolved');
  if (row.context === 'exam') throw new HttpError(403, 'no_hints', 'hints are not available in an exam');
  const snapshot = snapshotOf(row);
  if (row.hints_used >= snapshot.hints.length) throw new HttpError(409, 'no_more_hints', 'there are no more hints');
  ctx.db.prepare('UPDATE problems SET hints_used = hints_used + 1 WHERE id = ?').run(id);
  return problemDto(ctx, getProblemRow(ctx, id));
}

/** Give up and see the solution. Recorded as not solved. */
export function revealSolution(ctx: Ctx, id: string, seconds?: number): ProblemDto {
  const row = getProblemRow(ctx, id);
  if (row.status !== 'open') return problemDto(ctx, row);
  if (row.context === 'exam') throw new HttpError(403, 'no_reveal', 'solutions are shown after the exam');
  if (row.wrong_attempts === 0 && row.error_inferred === null) {
    // Nothing was attempted: the honest reading is "did not know how to start".
    ctx.db
      .prepare('UPDATE problems SET error_inferred = ?, error_basis = ?, error_note = ? WHERE id = ?')
      .run('unknown', 'model', toJson({ note: null, confident: false }), id);
  }
  const result = resolveProblem(ctx, id, {
    solved: false,
    seconds: clampSeconds(seconds, (ctx.now() - row.issued_at) / 1000),
  });
  return problemDto(ctx, result.row, result.states, result);
}

/**
 * The model answer and rubric of a self-assessed problem. The learner writes an
 * explanation, compares it with this, and only then grades it — so it has to be
 * available while the problem is still open.
 */
export function selfModel(ctx: Ctx, id: string): { model: LText; rubric: LText[] } {
  const spec = snapshotOf(getProblemRow(ctx, id)).answer;
  if (spec.kind !== 'self') throw badRequest('this problem is not self-assessed');
  return { model: spec.model, rubric: spec.rubric };
}

/** The learner confirms or corrects what kind of error it was. */
export function classifyError(ctx: Ctx, id: string, errorType: ErrorType): ProblemDto {
  const row = getProblemRow(ctx, id);
  if (row.wrong_attempts === 0 && row.status !== 'failed')
    throw badRequest('there is no error to classify on this problem');
  const changed = (row.error_confirmed ?? row.error_inferred) !== errorType;
  ctx.db.prepare('UPDATE problems SET error_confirmed = ? WHERE id = ?').run(errorType, id);
  // The stored error type feeds the learner model; rebuilding keeps the cache exact.
  if (changed && row.status !== 'open') replayAll(ctx);
  return problemDto(ctx, getProblemRow(ctx, id));
}

// --------------------------------------------------------------------------------- runs

function getRunRow(ctx: Ctx, id: string): RunRow {
  const row = ctx.db.prepare('SELECT * FROM runs WHERE id = ?').get(id) as RunRow | undefined;
  if (!row) throw notFound('run');
  return row;
}

function runProblems(ctx: Ctx, runId: string): ProblemRow[] {
  return ctx.db.prepare('SELECT * FROM problems WHERE run_id = ? ORDER BY issued_at, rowid').all(runId) as ProblemRow[];
}

function runSummary(ctx: Ctx, runId: string): RunSummaryDto {
  const problems = runProblems(ctx, runId).filter((p) => p.status === 'solved' || p.status === 'failed');
  const errors = new Map<ErrorType, number>();
  const skills = new Map<string, { solved: number; total: number }>();
  const levelUps: RunSummaryDto['levelUps'] = [];
  for (const p of problems) {
    const error = p.error_confirmed ?? p.error_inferred;
    if (isErrorType(error)) errors.set(error, (errors.get(error) ?? 0) + 1);
    const entry = skills.get(p.skill) ?? { solved: 0, total: 0 };
    entry.total++;
    if (p.status === 'solved') entry.solved++;
    skills.set(p.skill, entry);
    if (p.level_before !== null && p.level_after !== null && p.level_after > p.level_before) {
      const concept = getConcept(p.skill);
      levelUps.push({
        skill: p.skill,
        title: concept?.title ?? L(p.skill, p.skill),
        from: p.level_before as 0,
        to: p.level_after as 0,
      });
    }
  }
  return {
    problems: problems.length,
    solved: problems.filter((p) => p.status === 'solved').length,
    unaided: problems.filter((p) => p.status === 'solved' && p.first_try === 1 && p.hints_used + p.tutor_used === 0)
      .length,
    points: problems.reduce((sum, p) => sum + p.points, 0),
    seconds: Math.round(problems.reduce((sum, p) => sum + (p.seconds ?? 0), 0)),
    errors: [...errors.entries()].map(([type, count]) => ({ type, count })).sort((a, b) => b.count - a.count),
    levelUps,
    skills: [...skills.entries()].map(([id, entry]) => ({ id, title: getConcept(id)?.title ?? L(id, id), ...entry })),
  };
}

export function runDto(ctx: Ctx, row: RunRow): RunDto {
  const queue = fromJson<QueueItem[]>(row.queue, []);
  return {
    id: row.id,
    context: row.context as PracticeContext,
    total: queue.length,
    position: Math.min(row.position, queue.length),
    finished: row.finished_at !== null,
    blockId: row.plan_block,
    title: fromJson<LText | null>(row.title, null),
    summary: row.finished_at !== null ? runSummary(ctx, row.id) : null,
  };
}

export const getRun = (ctx: Ctx, id: string): RunDto => runDto(ctx, getRunRow(ctx, id));

function recentSources(ctx: Ctx, limit = 14): string[] {
  const rows = ctx.db.prepare('SELECT source FROM problems ORDER BY issued_at DESC, rowid DESC LIMIT ?').all(limit) as {
    source: string;
  }[];
  return rows.map((row) => row.source).reverse();
}

/** The open problem of a run, or the next one; finishes the run when the queue is done. */
export function nextInRun(ctx: Ctx, runId: string): StartRunResponse {
  const run = getRunRow(ctx, runId);
  if (run.finished_at !== null) return { run: runDto(ctx, run), problem: null };
  const problems = runProblems(ctx, runId);
  const open = problems.find((p) => p.status === 'open');
  if (open) return { run: runDto(ctx, run), problem: problemDto(ctx, open) };

  const queue = fromJson<QueueItem[]>(run.queue, []);
  const position = problems.length;
  if (position >= queue.length) {
    ctx.db.prepare('UPDATE runs SET finished_at = ?, position = ? WHERE id = ?').run(ctx.now(), queue.length, runId);
    return { run: runDto(ctx, getRunRow(ctx, runId)), problem: null };
  }

  const item = queue[position]!;
  const sameSkill = problems.filter((p) => p.skill === item.skill);
  const last = sameSkill[sameSkill.length - 1];
  let unaidedStreak = 0;
  for (let i = sameSkill.length - 1; i >= 0; i--) {
    const p = sameSkill[i]!;
    if (p.status === 'solved' && p.first_try === 1 && p.hints_used + p.tutor_used === 0) unaidedStreak++;
    else break;
  }
  const row = issueProblem(ctx, {
    skill: item.skill,
    context: run.context as PracticeContext,
    runId,
    generator: item.generator,
    staticId: item.staticId,
    level: item.level,
    floor: item.floor,
    cap: item.cap,
    seed: item.seed,
    replayOf: item.replayOf,
    recent: recentSources(ctx),
    lastFailed:
      last !== undefined &&
      !(last.status === 'solved' && last.first_try === 1 && last.hints_used + last.tutor_used === 0),
    unaidedStreak,
  });
  ctx.db.prepare('UPDATE runs SET position = ? WHERE id = ?').run(position + 1, runId);
  return { run: runDto(ctx, getRunRow(ctx, runId)), problem: problemDto(ctx, row) };
}

/** Which error types each generator can produce, found by sampling it once at start-up. */
let errorProfileCache: Map<string, Set<ErrorType>> | null = null;

export function errorProfile(): Map<string, Set<ErrorType>> {
  if (errorProfileCache) return errorProfileCache;
  const profile = new Map<string, Set<ErrorType>>();
  for (const generator of GENERATORS) {
    const types = new Set<ErrorType>();
    for (const level of generator.levels) {
      for (let seed = 1; seed <= 4; seed++) {
        try {
          const instance = generator.generate(createRng(seed * 7919 + level), level);
          for (const misconception of instance.misconceptions ?? []) types.add(misconception.error);
          if (instance.answer.kind === 'spot') types.add(instance.answer.errorType);
        } catch {
          // A generator that throws is reported by the content linter, not here.
        }
      }
    }
    profile.set(generator.id, types);
  }
  for (const problem of STATIC_PROBLEMS) {
    profile.set(problem.id, new Set((problem.misconceptions ?? []).map((m) => m.error)));
  }
  errorProfileCache = profile;
  return profile;
}

/** Problems that exercise a given error type, preferring families the learner got wrong. */
function drillQueue(ctx: Ctx, errorType: ErrorType, count: number, states: States): QueueItem[] {
  const profile = errorProfile();
  const missed = new Map<string, number>();
  const rows = ctx.db
    .prepare(
      `SELECT source, COUNT(*) AS n FROM problems WHERE COALESCE(error_confirmed, error_inferred) = ? GROUP BY source`,
    )
    .all(errorType) as { source: string; n: number }[];
  for (const row of rows) missed.set(row.source, row.n);

  const weighted: (readonly [QueueItem, number])[] = [];
  for (const generator of GENERATORS) {
    if (generator.deprecated || !profile.get(generator.id)?.has(errorType)) continue;
    const state = states.get(generator.concept);
    const seen = state !== undefined && state.attempts > 0;
    let weight = seen ? 2 : 0.4;
    weight += (missed.get(generator.id) ?? 0) * 3;
    if (generator.kind === 'debug') weight *= 1.5;
    weighted.push([{ skill: generator.concept, generator: generator.id }, weight]);
  }
  if (weighted.length === 0) return [];
  const rng = createRng(newSeed());
  const queue: QueueItem[] = [];
  const pool = [...weighted];
  while (queue.length < count && pool.length > 0) {
    const pick = rng.weighted(pool);
    queue.push(pick);
    // Allow a family to come back once the others have had a turn.
    const index = pool.findIndex(([item]) => item === pick);
    pool.splice(index, 1);
    if (pool.length === 0 && queue.length < count) pool.push(...weighted);
  }
  return queue;
}

export function startRun(ctx: Ctx, request: StartRunRequest): StartRunResponse {
  const states = loadStates(ctx);
  const rng = createRng(newSeed());
  let queue: QueueItem[] = [];
  let title: LText | null = null;
  let context: PracticeContext = request.context;

  if (request.replayOf) {
    const original = getProblemRow(ctx, request.replayOf);
    context = 'drill';
    queue = [
      {
        skill: original.skill,
        ...(original.source_kind === 'generator' ? { generator: original.source } : { staticId: original.source }),
        level: original.level as Level,
        seed: original.seed,
        replayOf: original.id,
      },
    ];
    title = L('Oprava dřívější chyby', 'Fixing an earlier mistake');
  } else {
    switch (request.context) {
      case 'blocked': {
        const concept = request.concept ? getConcept(request.concept) : undefined;
        if (!concept) throw badRequest('concept is required');
        const count = Math.min(20, Math.max(1, request.count ?? 6));
        queue = Array.from({ length: count }, () => ({ skill: concept.id }));
        title = concept.title;
        break;
      }
      case 'lesson': {
        const generator = request.generator ? getGenerator(request.generator) : undefined;
        if (!generator) throw badRequest('generator is required');
        queue = [{ skill: generator.concept, generator: generator.id, level: request.level }];
        title = getConcept(generator.concept)?.title ?? null;
        break;
      }
      case 'challenge': {
        const concept = request.concept ? getConcept(request.concept) : undefined;
        if (!concept) throw badRequest('concept is required');
        queue = [{ skill: concept.id, floor: 4 }];
        title = L(`Výzva: ${concept.title.cs}`, `Challenge: ${concept.title.en}`);
        break;
      }
      case 'mixed': {
        const now = ctx.now();
        let skills: string[];
        if (request.skills && request.skills.length > 0) {
          skills = request.skills.filter((id) => getConcept(id) !== undefined && candidatesFor(id, 'mixed').length > 0);
        } else if (request.topic !== undefined) {
          skills = conceptsOfTopic(request.topic)
            .map((c) => c.id)
            .filter((id) => candidatesFor(id, 'mixed').length > 0);
        } else {
          const practised = [...states.values()].filter(
            (s) => s.attempts > 0 && candidatesFor(s.skill, 'mixed').length > 0,
          );
          const due = practised
            .filter((s) => s.card !== null && s.card.due <= now)
            .sort((a, b) => a.card!.due - b.card!.due);
          // Nothing due: review what was practised least recently.
          skills = (
            due.length > 0 ? due : practised.sort((a, b) => (a.lastPracticedAt ?? 0) - (b.lastPracticedAt ?? 0))
          ).map((s) => s.skill);
        }
        const count = Math.min(20, Math.max(1, request.count ?? Math.min(8, Math.max(skills.length, 1))));
        if (skills.length === 0) throw new HttpError(422, 'nothing_to_review', 'there is nothing to review yet');
        const picked: string[] = [];
        while (picked.length < count) picked.push(...rng.shuffle(skills));
        queue = picked.slice(0, count).map((skill) => ({ skill }));
        title = L('Smíšené opakování', 'Mixed review');
        break;
      }
      case 'drill': {
        if (!request.errorType || !isErrorType(request.errorType)) throw badRequest('errorType is required');
        queue = drillQueue(ctx, request.errorType, Math.min(12, Math.max(1, request.count ?? 6)), states);
        if (queue.length === 0) throw new HttpError(422, 'no_drill', 'no problems target this error type yet');
        title = L('Cílený trénink', 'Targeted drill');
        break;
      }
      default:
        throw badRequest(`cannot start a run in context "${request.context}"`);
    }
  }

  const id = newId();
  ctx.db
    .prepare(
      'INSERT INTO runs (id, context, day, plan_block, title, queue, params, started_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    )
    .run(
      id,
      context,
      today(ctx),
      request.blockId ?? null,
      title ? toJson(title) : null,
      toJson(queue),
      toJson({ errorType: request.errorType ?? null }),
      ctx.now(),
    );
  return nextInRun(ctx, id);
}
