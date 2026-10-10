import {
  ANNUAL_REVIEW_TAG,
  CONCEPTS,
  EXAM_BLUEPRINTS,
  FORMAT_TAGS,
  SYLLABUS,
  WEIGHT_FLOOR,
  blueprintsOfGoal,
  conceptsOfGoal,
  getConcept,
  getGoal,
  goalSkillOf,
} from '@lemma/content';
import {
  type CreateExamRequest,
  type ErrorType,
  type ExamBlueprint,
  type ExamDto,
  type ExamItemResult,
  type ExamListItemDto,
  type ExamReportDto,
  type ExamScoring,
  type ExamSlot,
  type ExamStructureDto,
  type L as LText,
  type Level,
  type SlotFormat,
  L,
  checkAnswer,
  createRng,
  dueInDays,
  examReport,
  inferError,
  isErrorType,
  itemPoints,
  levelsForMix,
  nearestAvailableLevel,
  pointsForExam,
  predictWithChance,
} from '@lemma/core';
import { fromJson, toJson } from '../db';
import { addEvent, award } from './activity';
import { completeTestAssignment } from './assignments';
import { type Ctx, HttpError, badRequest, getSettings, goalOf, newId, newSeed, notFound } from './context';
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
  /** For a test with a fixed structure: the slot the problem fills. */
  label?: string;
  points?: number;
  format?: SlotFormat;
  bundle?: string;
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
  // An examination goal has no chapters: a short test draws on what has been practised,
  // or, before anything has, on what the examination asks.
  if (getGoal(settings.goal).kind === 'entrance') {
    const states = loadStates(ctx);
    const inGoal = conceptsOfGoal(settings.goal)
      .map((concept) => concept.id)
      .filter(usable);
    const practised = inGoal.filter((id) => (states.get(id)?.attempts ?? 0) > 0);
    return practised.length >= 3 ? practised : inGoal.filter((id) => goalSkillOf(settings.goal, id)?.role === 'tested');
  }
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

const CLOSED_TAGS = Object.values(FORMAT_TAGS);

/** The problem types of a skill that can fill a slot of the given format. */
function slotCandidates(skill: string, format: SlotFormat): ReturnType<typeof candidatesFor> {
  return candidatesFor(skill, 'exam').filter((candidate) =>
    format === 'open'
      ? !candidate.tags?.some((tag) => CLOSED_TAGS.includes(tag))
      : candidate.tags?.includes(FORMAT_TAGS[format]),
  );
}

/**
 * A practice test that follows an examination's own structure: one problem per slot, in
 * the slot's format and worth the slot's points. Where a slot offers several skills, one
 * is drawn by its weight in the examination, less likely each time it has been used.
 */
function createEntranceExam(ctx: Ctx, blueprint: ExamBlueprint): ExamDto {
  const goal = blueprint.goal!;
  const slots = blueprint.slots ?? [];
  const rng = createRng(newSeed());
  const states = loadStates(ctx);
  const id = newId();
  const now = ctx.now();
  const items: StoredItem[] = [];
  const usedSources: string[] = [];
  const usedSkills = new Map<string, number>();

  ctx.db.transaction(() => {
    ctx.db
      .prepare(
        'INSERT INTO exams (id, blueprint, title, minutes, started_at, deadline_at, items) VALUES (?, ?, ?, ?, ?, ?, ?)',
      )
      .run(id, blueprint.id, toJson(blueprint.title), blueprint.minutes, now, now + blueprint.minutes * 60_000, '[]');
    for (const slot of slots) {
      const offered = slot.skills.filter((skill) => slotCandidates(skill, slot.format).length > 0);
      if (offered.length === 0)
        throw new HttpError(422, 'no_problems', `there are no problems for task ${slot.label} of this test`);
      const skill = rng.weighted(
        offered.map(
          (candidate) =>
            [
              candidate,
              (goalSkillOf(goal, candidate)?.weight || WEIGHT_FLOOR) / (1 + 2 * (usedSkills.get(candidate) ?? 0)),
            ] as const,
        ),
      );
      usedSkills.set(skill, (usedSkills.get(skill) ?? 0) + 1);
      const available = [...new Set(slotCandidates(skill, slot.format).flatMap((candidate) => candidate.levels))];
      const row = issueProblem(ctx, {
        skill,
        context: 'exam',
        examId: id,
        level: nearestAvailableLevel(available, slot.level),
        ...(slot.format === 'open' ? { withoutTags: CLOSED_TAGS } : { withTag: FORMAT_TAGS[slot.format] }),
        recent: usedSources,
        states,
      });
      usedSources.push(row.source);
      items.push({
        problemId: row.id,
        input: '',
        seconds: 0,
        label: slot.label,
        points: slot.points,
        format: slot.format,
        ...(slot.bundle ? { bundle: slot.bundle } : {}),
      });
    }
    ctx.db.prepare('UPDATE exams SET items = ? WHERE id = ?').run(toJson(items), id);
  })();
  return getExam(ctx, id);
}

const blueprintById = (id: string): ExamBlueprint | undefined => EXAM_BLUEPRINTS.find((b) => b.id === id);

/** What a structured practice test covers of the real one; null for the school's tests. */
function structureOf(blueprint: ExamBlueprint | undefined): ExamStructureDto | null {
  if (!blueprint || blueprint.kind !== 'entrance' || !blueprint.goal) return null;
  const bundles = blueprint.bundles ?? {};
  const loose = (blueprint.slots ?? [])
    .filter((slot: ExamSlot) => !slot.bundle)
    .reduce((sum, slot) => sum + slot.points, 0);
  const bundled = Object.values(bundles).reduce((sum, table) => sum + (table[table.length - 1] ?? 0), 0);
  return {
    goal: blueprint.goal,
    examPoints: getGoal(blueprint.goal).facts?.points ?? loose + bundled,
    onScreenPoints: loose + bundled,
    offScreenPoints: blueprint.offScreenPoints ?? 0,
    bundles,
  };
}

/** How a test scores: the school's by grade scale, an examination's by its bundles and no grade. */
function scoringOf(ctx: Ctx, blueprint: ExamBlueprint | undefined): ExamScoring {
  return blueprint?.kind === 'entrance'
    ? { scale: null, bundles: blueprint.bundles ?? {} }
    : { scale: getSettings(ctx).gradeScale };
}

export function createExam(ctx: Ctx, request: CreateExamRequest): ExamDto {
  const blueprint = blueprintById(request.blueprint);
  if (!blueprint) throw badRequest('unknown exam blueprint');
  // A learner is offered the tests of their own goal, and can start no others.
  if (!blueprintsOfGoal(goalOf(ctx)).some((offered) => offered.id === blueprint.id))
    throw new HttpError(403, 'not_your_test', 'this test does not belong to your goal');
  if (blueprint.kind === 'entrance') return createEntranceExam(ctx, blueprint);
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
      slot:
        item.label !== undefined
          ? { label: item.label, points: item.points ?? 0, format: item.format ?? 'open', bundle: item.bundle ?? null }
          : null,
    })),
    report: fromJson<ExamReportDto | null>(row.report, null),
    structure: structureOf(blueprintById(row.blueprint)),
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
  const blueprint = blueprintById(row.blueprint);
  const scoring = scoringOf(ctx, blueprint);
  // Predictions are taken before any item is scored, so they describe the state the
  // learner walked in with.
  const before = loadStates(ctx);
  const results: ExamItemResult[] = [];
  const details: ExamReportDto['details'] = [];

  ctx.db.transaction(() => {
    items.forEach((item, index) => {
      const problem = getProblemRow(ctx, item.problemId);
      const snapshot = snapshotOf(problem);
      const predicted = predictWithChance(
        stateOf(before, problem.skill).theta,
        problem.level as Level,
        problem.chance ?? 0,
      );
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
        // The school's tests weigh an item by its level; an examination's by its slot.
        points: item.points ?? problem.level,
        answered,
        correct,
        seconds: item.seconds,
        expectedSeconds: problem.est_seconds,
        predicted,
        errorType: error,
        ...(item.bundle ? { bundle: item.bundle } : {}),
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
        ...(item.label !== undefined ? { label: item.label, bundle: item.bundle ?? null } : {}),
      });
    });

    const report = examReport(results, row.minutes * 60, scoring);
    const skillTitles: Record<string, LText> = {};
    for (const result of results)
      skillTitles[result.skill] = getConcept(result.skill)?.title ?? L(result.skill, result.skill);
    const structure = structureOf(blueprint);
    const full: ExamReportDto = { ...report, skillTitles, details };
    if (structure) {
      const worth = itemPoints(results, scoring.bundles ?? {});
      details.forEach((detail, index) => {
        detail.points = Math.round(worth[index]!.max * 100) / 100;
        detail.earned = Math.round(worth[index]!.earned * 100) / 100;
      });
      // When each missed skill comes back, as the review schedule now has it.
      const after = loadStates(ctx);
      full.followUp = report.next.slice(0, 8).map((entry) => {
        const due = dueInDays(after.get(entry.skill)?.card ?? null, now);
        return {
          skill: entry.skill,
          inDays: Math.max(0, Math.ceil(due ?? 1)),
          kind: entry.mostly === 'slip' ? ('review' as const) : ('repair' as const),
        };
      });
      full.structure = structure;
    }
    ctx.db.prepare('UPDATE exams SET finished_at = ?, report = ? WHERE id = ?').run(now, toJson(full), id);
    addEvent(ctx, {
      type: 'exam',
      points: pointsForExam(report.percent),
      at: now,
      ref: id,
      payload: { percent: report.percent, blueprint: row.blueprint },
    });
    if (report.percent >= 80 && report.items >= 5) award(ctx, 'exam-80');
    // A test the teacher asked for is done with this.
    completeTestAssignment(ctx, id, row.blueprint);
  })();
  return toDto(ctx, examRow(ctx, id));
}

/** Re-read error types after the learner has classified mistakes in the post-mortem. */
export function refreshExamReport(ctx: Ctx, id: string): ExamDto {
  const row = examRow(ctx, id);
  const report = fromJson<ExamReportDto | null>(row.report, null);
  if (row.finished_at === null || !report) return toDto(ctx, row);
  const stored = fromJson<StoredItem[]>(row.items, []);
  const results: ExamItemResult[] = report.details.map((detail) => {
    const problem: ProblemRow = getProblemRow(ctx, detail.problemId);
    const confirmed = problem.error_confirmed ?? problem.error_inferred;
    detail.error = isErrorType(confirmed) && !detail.correct && detail.answered ? confirmed : null;
    const item = stored[detail.index];
    return {
      skill: detail.skill,
      level: problem.level as Level,
      points: item?.points ?? problem.level,
      answered: detail.answered,
      correct: detail.correct,
      seconds: detail.seconds,
      expectedSeconds: detail.expectedSeconds,
      predicted: problem.predicted ?? 0.5,
      errorType: detail.error,
      ...(item?.bundle ? { bundle: item.bundle } : {}),
    };
  });
  const updated: ExamReportDto = {
    ...report,
    ...examReport(results, row.minutes * 60, scoringOf(ctx, blueprintById(row.blueprint))),
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
    const structured = blueprintById(row.blueprint)?.kind === 'entrance';
    return {
      id: row.id,
      blueprint: row.blueprint,
      title: fromJson<LText>(row.title, L('Zkouška', 'Exam')),
      startedAt: row.started_at,
      finishedAt: row.finished_at,
      percent: report?.percent ?? null,
      grade: report?.grade ?? null,
      items: fromJson<StoredItem[]>(row.items, []).length,
      points: structured ? (report?.points ?? null) : null,
      maxPoints: structured ? (report?.maxPoints ?? null) : null,
    };
  });
}
