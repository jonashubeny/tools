import { FORMAT_TAGS, generatorsFor, getConcept, getLesson } from '@lemma/content';
import {
  type LessonDto,
  type Level,
  type WorkedExampleDto,
  ACTIVITY,
  L,
  answerToTex,
  createRng,
  markLessonSeen,
} from '@lemma/core';
import { addEvent, award } from './activity';
import { completeLessonAssignments } from './assignments';
import { type Ctx, HttpError, notFound } from './context';
import { loadStates, saveState, stateOf } from './learner';

interface ProgressRow {
  concept: string;
  step: number;
  done: number;
  started_at: number;
  finished_at: number | null;
}

function progressRow(ctx: Ctx, concept: string): ProgressRow | undefined {
  return ctx.db.prepare('SELECT * FROM lesson_progress WHERE concept = ?').get(concept) as ProgressRow | undefined;
}

/** Open a lesson. The first time, the skill becomes "introduced". */
export function openLesson(ctx: Ctx, conceptId: string): LessonDto {
  const lesson = getLesson(conceptId);
  const concept = getConcept(conceptId);
  if (!lesson || !concept) throw notFound('lesson');
  let row = progressRow(ctx, conceptId);
  if (!row) {
    const now = ctx.now();
    ctx.db.transaction(() => {
      ctx.db
        .prepare('INSERT INTO lesson_progress (concept, step, done, started_at) VALUES (?, 0, 0, ?)')
        .run(conceptId, now);
      const states = loadStates(ctx);
      saveState(ctx, markLessonSeen(stateOf(states, conceptId), now));
    })();
    row = progressRow(ctx, conceptId)!;
  }
  return {
    concept: conceptId,
    title: concept.title,
    minutes: lesson.minutes,
    steps: lesson.steps,
    step: Math.min(row.step, lesson.steps.length),
    done: row.done === 1,
  };
}

/** Mark a step as completed. Steps count once: going back and forth earns nothing. */
export function completeStep(ctx: Ctx, conceptId: string, stepIndex: number): LessonDto {
  const lesson = getLesson(conceptId);
  if (!lesson) throw notFound('lesson');
  openLesson(ctx, conceptId);
  const row = progressRow(ctx, conceptId)!;
  const index = Math.max(0, Math.min(lesson.steps.length - 1, Math.floor(stepIndex)));

  if (index >= row.step) {
    const nextStep = index + 1;
    const finished = nextStep >= lesson.steps.length;
    ctx.db.transaction(() => {
      // Check steps already earned their points as problems.
      for (let i = row.step; i <= index; i++) {
        if (lesson.steps[i]!.kind !== 'check')
          addEvent(ctx, {
            type: 'lesson_step',
            points: ACTIVITY.LESSON_STEP,
            skill: conceptId,
            ref: `${conceptId}#${i}`,
          });
      }
      ctx.db
        .prepare(
          'UPDATE lesson_progress SET step = ?, done = ?, finished_at = COALESCE(finished_at, ?) WHERE concept = ?',
        )
        .run(nextStep, finished ? 1 : 0, finished ? ctx.now() : null, conceptId);
      if (finished && row.done === 0) {
        addEvent(ctx, { type: 'lesson_done', points: ACTIVITY.LESSON_DONE, skill: conceptId, ref: conceptId });
        award(ctx, 'first-lesson');
        // A lesson the teacher recommended has now been read.
        completeLessonAssignments(ctx, conceptId);
      }
    })();
  }
  return openLesson(ctx, conceptId);
}

/**
 * A solved example of a skill: one of its own easiest problems with the whole solution
 * shown, for reading before practising. Skills without an authored lesson are introduced
 * this way. Nothing is logged as an attempt — reading a solution proves nothing — but the
 * skill counts as introduced, exactly as after opening a lesson.
 *
 * `n` picks among the examples, so that "another one" shows a different problem.
 */
export function workedExample(ctx: Ctx, conceptId: string, n = 0): WorkedExampleDto {
  const concept = getConcept(conceptId);
  if (!concept) throw notFound('concept');
  // A typed answer reads best as an example; fall back on whatever the skill has.
  const generators = generatorsFor(conceptId).filter((generator) => !generator.deprecated);
  const closed = Object.values(FORMAT_TAGS);
  const typed = generators.filter(
    (generator) => generator.kind !== 'debug' && !generator.tags?.some((tag) => closed.includes(tag)),
  );
  const pool = (typed.length > 0 ? typed : generators).sort((a, b) => Math.min(...a.levels) - Math.min(...b.levels));
  if (pool.length === 0) throw new HttpError(422, 'no_problems', `there is no worked example for "${conceptId}"`);
  const index = Math.max(0, Math.floor(n)) % (pool.length * 3);
  const generator = pool[index % pool.length]!;
  const level = Math.min(...generator.levels) as Level;
  // Stable for a concept and a number: reloading the page shows the same example.
  let seed = 7 + index * 7919;
  for (const char of conceptId) seed = (seed * 31 + char.charCodeAt(0)) % 2_147_483_647;
  const instance = generator.generate(createRng(seed || 1), level);

  const now = ctx.now();
  ctx.db.transaction(() => {
    const seen = ctx.db.prepare('SELECT 1 FROM lesson_progress WHERE concept = ?').get(conceptId) !== undefined;
    if (!seen && !getLesson(conceptId)) {
      ctx.db
        .prepare('INSERT INTO lesson_progress (concept, step, done, started_at, finished_at) VALUES (?, 1, 1, ?, ?)')
        .run(conceptId, now, now);
      saveState(ctx, markLessonSeen(stateOf(loadStates(ctx), conceptId), now));
    }
    completeLessonAssignments(ctx, conceptId);
  })();

  return {
    concept: conceptId,
    level,
    prompt: instance.prompt,
    figure: instance.figure ?? null,
    solution: instance.solution,
    answerTex: L(answerToTex(instance.answer, 'cs'), answerToTex(instance.answer, 'en')),
  };
}
