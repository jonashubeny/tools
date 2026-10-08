import { ANNUAL_REVIEW_TAG, CONCEPTS, EXAM_BLUEPRINTS, SYLLABUS, getConcept } from '@lemma/content';
import {
  type CreateExamRequest,
  type ErrorType,
  type ExamDto,
  type ExamItemResult,
  type ExamListItemDto,
  type ExamReportDto,
  type L as LText,
  type Level,
  L,
  checkAnswer,
  createRng,
  examReport,
  inferError,
  isErrorType,
  levelsForMix,
  nearestAvailableLevel,
  pointsForExam,
  predictSuccess,
} from '@lemma/core';
import { fromJson, toJson } from '../db';
import { addEvent, award } from './activity';
import { type Ctx, HttpError, badRequest, getSettings, newId, newSeed, notFound } from './context';
import { loadStates, stateOf } from './learner';
import {
  type ProblemRow,
  candidatesFor,
  getProblemRow,
  issueProblem,
  problemDto,
  resolveProblem,
  snapshotOf,
} from './practice';

/** Timed exam simulation: no hints, no feedback until the end, then a real analysis. */

interface StoredItem {
  problemId: string;
  input: string;
  seconds: number;
}

interface ExamRow {
  id: string;
  blueprint: string;
  title: string;
  minutes: number;
  started_at: number;
  deadline_at: number;
  finished_at: number | null;
  items: string;
  report: string | null;
}

/** Answers are still accepted this long after the deadline, to absorb network delay. */
const GRACE_MS = 20_000;

function examRow(ctx: Ctx, id: string): ExamRow {
  const row = ctx.db.prepare('SELECT * FROM exams WHERE id = ?').get(id) as ExamRow | undefined;
  if (!row) throw notFound('exam');
  return row;
}

function conceptsForExam(ctx: Ctx, request: CreateExamRequest, kind: 'chapter' | 'annual' | 'custom'): string[] {
  const usable = (id: string): boolean => getConcept(id) !== undefined && candidatesFor(id, 'exam').length > 0;
  if (request.concepts && request.concepts.length > 0) return request.concepts.filter(usable);

  const settings = getSettings(ctx);
  let topics = request.topics?.filter((n) => SYLLABUS.some((topic) => topic.n === n)) ?? [];
  if (topics.length === 0) {
    if (kind === 'annual') {
      // Everything covered so far: up to the current chapter, or whatever has been practised.
      const upTo =
        settings.currentTopic ??
        Math.max(1, ...[...loadStates(ctx).keys()].map((id) => getConcept(id)?.syllabusTopic ?? 0));
      topics = SYLLABUS.filter((topic) => topic.n <= upTo).map((topic) => topic.n);
    } else {
      topics = [settings.currentTopic ?? 1];
    }
  }
  const inTopics = CONCEPTS.filter(
    (concept) => concept.syllabusTopic !== undefined && topics.includes(concept.syllabusTopic) && !concept.deprecated,
  );
  if (kind !== 'annual') return inTopics.map((concept) => concept.id).filter(usable);
  // The annual review asks for the basic problem types of every chapter. A chapter with
  // none marked is represented by all of its concepts rather than left out.
  return topics.flatMap((n) => {
    const ofTopic = inTopics.filter((concept) => concept.syllabusTopic === n);
    const basic = ofTopic.filter((concept) => concept.annualReview);
    return (basic.length > 0 ? basic : ofTopic).map((concept) => concept.id).filter(usable);
  });
}

/**
 * The order in which an exam visits its concepts. Ordinary exams spread their items over
 * the concepts as evenly as possible. The annual review goes chapter by chapter instead,
 * so that no chapter appears twice before every chapter has appeared once.
 */
function conceptOrder(
  concepts: readonly string[],
  items: number,
  byChapter: boolean,
  rng: ReturnType<typeof createRng>,
): string[] {
  const order: string[] = [];
  if (!byChapter) {
    while (order.length < items) order.push(...rng.shuffle(concepts));
    return order.slice(0, items);
  }
  const chapters = new Map<number, string[]>();
  for (const id of concepts) {
    const topic = getConcept(id)?.syllabusTopic ?? 0;
    chapters.set(topic, [...(chapters.get(topic) ?? []), id]);
  }
  const queues = [...chapters.values()].map((ids) => rng.shuffle(ids));
  for (let round = 0; order.length < items; round++) {
    for (const queue of rng.shuffle(queues)) order.push(queue[round % queue.length]!);
  }
  return order.slice(0, items);
}

export function createExam(ctx: Ctx, request: CreateExamRequest): ExamDto {
  const blueprint = EXAM_BLUEPRINTS.find((b) => b.id === request.blueprint);
  if (!blueprint) throw badRequest('unknown exam blueprint');
  const concepts = conceptsForExam(ctx, request, blueprint.kind);
  if (concepts.length === 0) throw new HttpError(422, 'no_problems', 'there are no problems for the chosen topics yet');

  const rng = createRng(newSeed());
  const levels = rng.shuffle(levelsForMix(blueprint.items, blueprint.levelMix));
  const annual = blueprint.kind === 'annual';
  const order = conceptOrder(concepts, blueprint.items, annual, rng);

  const id = newId();
  const now = ctx.now();
  const states = loadStates(ctx);
  const items: StoredItem[] = [];
  const used: string[] = [];

  ctx.db.transaction(() => {
    ctx.db
      .prepare(
        'INSERT INTO exams (id, blueprint, title, minutes, started_at, deadline_at, items) VALUES (?, ?, ?, ?, ?, ?, ?)',
      )
      .run(id, blueprint.id, toJson(blueprint.title), blueprint.minutes, now, now + blueprint.minutes * 60_000, '[]');
    for (let i = 0; i < blueprint.items; i++) {
      const skill = order[i]!;
      // The levels on offer are those of the problem types that will actually be drawn from.
      const candidates = candidatesFor(skill, 'exam');
      const basic = annual ? candidates.filter((candidate) => candidate.tags?.includes(ANNUAL_REVIEW_TAG)) : [];
      const available = [...new Set((basic.length > 0 ? basic : candidates).flatMap((candidate) => candidate.levels))];
      const row = issueProblem(ctx, {
        skill,
        context: 'exam',
        examId: id,
        tag: annual ? ANNUAL_REVIEW_TAG : undefined,
        level: nearestAvailableLevel(available, levels[i]!),
        recent: used,
        states,
      });
      used.push(row.source);
      items.push({ problemId: row.id, input: '', seconds: 0 });
    }
    ctx.db.prepare('UPDATE exams SET items = ? WHERE id = ?').run(toJson(items), id);
  })();
  return getExam(ctx, id);
}

function toDto(ctx: Ctx, row: ExamRow): ExamDto {
  const items = fromJson<StoredItem[]>(row.items, []);
  const states = loadStates(ctx);
  return {
    id: row.id,
    blueprint: row.blueprint,
    title: fromJson<LText>(row.title, L('Zkouška', 'Exam')),
    startedAt: row.started_at,
    deadlineAt: row.deadline_at,
    finishedAt: row.finished_at,
    minutes: row.minutes,
    items: items.map((item, index) => ({
      index,
      problem: problemDto(ctx, getProblemRow(ctx, item.problemId), states),
      input: item.input,
      seconds: item.seconds,
    })),
    report: fromJson<ExamReportDto | null>(row.report, null),
  };
}

export function getExam(ctx: Ctx, id: string): ExamDto {
  const row = examRow(ctx, id);
  // Time is up and nobody pressed "finish": close it now.
  if (row.finished_at === null && ctx.now() > row.deadline_at + GRACE_MS) return finishExam(ctx, id);
  return toDto(ctx, row);
}

export function saveExamAnswer(
  ctx: Ctx,
  id: string,
  index: number,
  input: string,
  seconds: number,
): { saved: boolean } {
  const row = examRow(ctx, id);
  if (row.finished_at !== null) throw new HttpError(409, 'exam_finished', 'the exam is already finished');
  if (ctx.now() > row.deadline_at + GRACE_MS) throw new HttpError(409, 'time_up', 'time is up');
  const items = fromJson<StoredItem[]>(row.items, []);
  const item = items[index];
  if (!item) throw badRequest('no such item');
  item.input = String(input ?? '').slice(0, 500);
  item.seconds = Math.min(7200, Math.max(0, Number.isFinite(seconds) ? seconds : 0));
  ctx.db.prepare('UPDATE exams SET items = ? WHERE id = ?').run(toJson(items), id);
  return { saved: true };
}

export function finishExam(ctx: Ctx, id: string): ExamDto {
  const row = examRow(ctx, id);
  if (row.finished_at !== null) return toDto(ctx, row);
  const items = fromJson<StoredItem[]>(row.items, []);
  const settings = getSettings(ctx);
  const now = ctx.now();
  // Predictions are taken before any item is scored, so they describe the state the
  // learner walked in with.
  const before = loadStates(ctx);
  const results: ExamItemResult[] = [];
  const details: ExamReportDto['details'] = [];

  ctx.db.transaction(() => {
    items.forEach((item, index) => {
      const problem = getProblemRow(ctx, item.problemId);
      const snapshot = snapshotOf(problem);
      const predicted = predictSuccess(stateOf(before, problem.skill).theta, problem.level as Level);
      const answered = item.input.trim() !== '';
      const seconds = Math.max(1, item.seconds || 1);
      let correct = false;
      let error: ErrorType | null = null;

      if (!answered) {
        ctx.db
          .prepare(`UPDATE problems SET status = 'skipped', resolved_at = ?, seconds = ? WHERE id = ?`)
          .run(now, item.seconds, problem.id);
      } else {
        const check = checkAnswer(snapshot.answer, item.input, snapshot.misconceptions ?? [], {
          decimalComma: settings.decimalComma,
        });
        correct = check.verdict === 'correct';
        ctx.db
          .prepare('INSERT INTO attempts (problem_id, at, input, verdict, diagnosis) VALUES (?, ?, ?, ?, ?)')
          .run(
            problem.id,
            now,
            item.input,
            correct ? 'correct' : 'incorrect',
            check.verdict === 'incorrect' && check.diagnosis ? toJson(check.diagnosis) : null,
          );
        if (check.verdict !== 'correct') {
          // An answer that cannot be read is, in an exam, a wrong answer in the wrong form.
          const guess =
            check.verdict === 'invalid'
              ? { type: 'notation' as ErrorType, basis: 'pattern', confident: true }
              : inferError({
                  diagnosis: check.diagnosis,
                  predicted,
                  seconds,
                  expectedSeconds: problem.est_seconds,
                  timed: true,
                });
          error = guess.type;
          const note =
            check.verdict === 'incorrect'
              ? (check.diagnosis?.note ?? null)
              : check.verdict === 'invalid'
                ? check.message
                : null;
          ctx.db
            .prepare(
              'UPDATE problems SET wrong_attempts = 1, error_inferred = ?, error_basis = ?, error_note = ?, error_skill = ? WHERE id = ?',
            )
            .run(
              guess.type,
              guess.basis,
              toJson({ note, confident: guess.confident }),
              check.verdict === 'incorrect' ? (check.diagnosis?.skill ?? null) : null,
              problem.id,
            );
        }
        resolveProblem(ctx, problem.id, { solved: correct, seconds });
      }
      results.push({
        skill: problem.skill,
        level: problem.level as Level,
        points: problem.level,
        answered,
        correct,
        seconds: item.seconds,
        expectedSeconds: problem.est_seconds,
        predicted,
        errorType: error,
      });
      details.push({
        index,
        problemId: problem.id,
        skill: problem.skill,
        correct,
        answered,
        input: item.input,
        error,
        seconds: item.seconds,
        expectedSeconds: problem.est_seconds,
      });
    });

    const report = examReport(results, row.minutes * 60, settings.gradeScale);
    const skillTitles: Record<string, LText> = {};
    for (const result of results)
      skillTitles[result.skill] = getConcept(result.skill)?.title ?? L(result.skill, result.skill);
    const full: ExamReportDto = { ...report, skillTitles, details };
    ctx.db.prepare('UPDATE exams SET finished_at = ?, report = ? WHERE id = ?').run(now, toJson(full), id);
    addEvent(ctx, {
      type: 'exam',
      points: pointsForExam(report.percent),
      at: now,
      ref: id,
      payload: { percent: report.percent, blueprint: row.blueprint },
    });
    if (report.percent >= 80 && report.items >= 5) award(ctx, 'exam-80');
  })();
  return toDto(ctx, examRow(ctx, id));
}

/** Re-read error types after the learner has classified mistakes in the post-mortem. */
export function refreshExamReport(ctx: Ctx, id: string): ExamDto {
  const row = examRow(ctx, id);
  const report = fromJson<ExamReportDto | null>(row.report, null);
  if (row.finished_at === null || !report) return toDto(ctx, row);
  const settings = getSettings(ctx);
  const results: ExamItemResult[] = report.details.map((detail) => {
    const problem: ProblemRow = getProblemRow(ctx, detail.problemId);
    const confirmed = problem.error_confirmed ?? problem.error_inferred;
    detail.error = isErrorType(confirmed) && !detail.correct && detail.answered ? confirmed : null;
    return {
      skill: detail.skill,
      level: problem.level as Level,
      points: problem.level,
      answered: detail.answered,
      correct: detail.correct,
      seconds: detail.seconds,
      expectedSeconds: detail.expectedSeconds,
      predicted: problem.predicted ?? 0.5,
      errorType: detail.error,
    };
  });
  const updated: ExamReportDto = {
    ...examReport(results, row.minutes * 60, settings.gradeScale),
    skillTitles: report.skillTitles,
    details: report.details,
  };
  ctx.db.prepare('UPDATE exams SET report = ? WHERE id = ?').run(toJson(updated), id);
  return toDto(ctx, examRow(ctx, id));
}

export function listExams(ctx: Ctx): ExamListItemDto[] {
  const rows = ctx.db.prepare('SELECT * FROM exams ORDER BY started_at DESC LIMIT 50').all() as ExamRow[];
  return rows.map((row) => {
    const report = fromJson<ExamReportDto | null>(row.report, null);
    return {
      id: row.id,
      title: fromJson<LText>(row.title, L('Zkouška', 'Exam')),
      startedAt: row.started_at,
      finishedAt: row.finished_at,
      percent: report?.percent ?? null,
      grade: report?.grade ?? null,
      items: fromJson<StoredItem[]>(row.items, []).length,
    };
  });
}
