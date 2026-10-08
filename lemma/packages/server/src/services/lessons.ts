import { getConcept, getLesson } from '@lemma/content';
import { type LessonDto, ACTIVITY, markLessonSeen } from '@lemma/core';
import { addEvent, award } from './activity';
import { type Ctx, notFound } from './context';
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
      }
    })();
  }
  return openLesson(ctx, conceptId);
}
