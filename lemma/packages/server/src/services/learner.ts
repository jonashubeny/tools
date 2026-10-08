import {
  CONCEPTS,
  CONTENT_VERSION,
  SYLLABUS,
  conceptsOfTopic,
  getConcept,
  getLesson,
  hasProblems,
  topLevelOf,
} from '@lemma/content';
import {
  MODEL_VERSION,
  applyAttempt,
  applyImplicitCredit,
  dueInDays,
  emptySkillState,
  isDue,
  isErrorType,
  isFading,
  isUnaided,
  levelOf,
  markDueNow,
  markLessonSeen,
  priorTheta,
  progressOf,
  retrievability,
  type AttemptEffect,
  type Concept,
  type Confidence,
  type ErrorType,
  type Level,
  type MasteryLevel,
  type PracticeContext,
  type ResolvedAttempt,
  type SkillDto,
  type SkillState,
  type SyllabusTopicDto,
} from '@lemma/core';
import { fromJson, toJson } from '../db';
import type { Ctx } from './context';

/**
 * The learner model in the database: one cached state per concept, derived from the log
 * of resolved problems. `replayAll` rebuilds the cache from the log; `applyResolved`
 * applies one problem. Both go through the same function, which is what guarantees that
 * the cache and a rebuild agree.
 */

export type States = Map<string, SkillState>;

export function loadStates(ctx: Ctx): States {
  const rows = ctx.db.prepare('SELECT skill, state FROM skill_state').all() as { skill: string; state: string }[];
  const states: States = new Map();
  for (const row of rows) {
    const state = fromJson<SkillState | null>(row.state, null);
    if (state) states.set(row.skill, state);
  }
  return states;
}

export function saveState(ctx: Ctx, state: SkillState): void {
  ctx.db
    .prepare(
      `INSERT INTO skill_state (skill, state, level, theta, due_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT (skill) DO UPDATE SET state = excluded.state, level = excluded.level, theta = excluded.theta,
         due_at = excluded.due_at, updated_at = excluded.updated_at`,
    )
    .run(state.skill, toJson(state), state.level, state.theta, state.card?.due ?? null, ctx.now());
}

/** The state of a skill, created with a prior from its prerequisites when first needed. */
export function stateOf(states: States, skill: string): SkillState {
  const existing = states.get(skill);
  if (existing) return existing;
  const concept = getConcept(skill);
  const prereqThetas = (concept?.prereqs ?? [])
    .map((id) => states.get(id))
    .filter((s): s is SkillState => s !== undefined && s.attempts > 0)
    .map((s) => s.theta);
  return emptySkillState(skill, priorTheta(prereqThetas));
}

/** The facts about a resolved problem that the learner model consumes. */
export interface ResolvedFacts {
  skill: string;
  level: Level;
  context: PracticeContext;
  solved: boolean;
  firstTry: boolean;
  hints: number;
  retries: number;
  seconds: number;
  expectedSeconds: number;
  confidence: Confidence | null;
  errorType: ErrorType | null;
  /** A prerequisite the error was traced to, if any. */
  errorSkill: string | null;
  selfAssessed: boolean;
  at: number;
}

export interface ResolutionResult {
  effect: AttemptEffect;
  /** Other skills whose state changed (implicit reviews, prerequisites made due). */
  touched: string[];
}

/** Apply one resolved problem to a set of states. Mutates `states`. */
export function applyResolved(states: States, facts: ResolvedFacts): ResolutionResult {
  const attempt: ResolvedAttempt = {
    skill: facts.skill,
    level: facts.level,
    context: facts.context,
    solved: facts.solved,
    firstTry: facts.firstTry,
    hints: facts.hints,
    retries: facts.retries,
    seconds: facts.seconds,
    expectedSeconds: facts.expectedSeconds,
    confidence: facts.confidence ?? undefined,
    errorType: facts.errorType,
    selfAssessed: facts.selfAssessed,
    at: facts.at,
    ceiling: topLevelOf(facts.skill),
  };
  const effect = applyAttempt(stateOf(states, facts.skill), attempt);
  states.set(facts.skill, effect.state);
  const touched: string[] = [];

  const concept = getConcept(facts.skill);
  if (concept && isUnaided(attempt) && !facts.selfAssessed) {
    for (const enc of concept.encompasses ?? []) {
      const target = states.get(enc.id);
      if (!target) continue;
      const result = applyImplicitCredit(target, enc.w, facts.at);
      if (result.state !== target) {
        states.set(enc.id, result.state);
        touched.push(enc.id);
      }
    }
  }
  if (!facts.firstTry && facts.errorSkill && facts.errorSkill !== facts.skill) {
    const target = states.get(facts.errorSkill);
    if (target) {
      const next = markDueNow(target, facts.at);
      if (next !== target) {
        states.set(facts.errorSkill, next);
        touched.push(facts.errorSkill);
      }
    }
  }
  return { effect, touched };
}

interface ReplayRow {
  skill: string;
  level: number;
  context: string;
  status: string;
  first_try: number | null;
  hints_used: number;
  tutor_used: number;
  wrong_attempts: number;
  seconds: number | null;
  est_seconds: number;
  confidence: string | null;
  error_inferred: string | null;
  error_confirmed: string | null;
  error_skill: string | null;
  self_assessed: number;
  resolved_at: number;
}

export function factsFromRow(row: ReplayRow): ResolvedFacts {
  const error = row.error_confirmed ?? row.error_inferred;
  return {
    skill: row.skill,
    level: Math.min(5, Math.max(1, row.level)) as Level,
    context: row.context as PracticeContext,
    solved: row.status === 'solved',
    firstTry: row.first_try === 1,
    // Asking the tutor about an open problem is help, and counts like a hint.
    hints: row.hints_used + row.tutor_used,
    // Retries = wrong submissions before it was solved; a failed problem has no "retries".
    retries: row.status === 'solved' ? row.wrong_attempts : Math.max(0, row.wrong_attempts - 1),
    seconds: row.seconds ?? row.est_seconds,
    expectedSeconds: row.est_seconds,
    confidence:
      row.confidence === 'sure' || row.confidence === 'think' || row.confidence === 'guess' ? row.confidence : null,
    errorType: isErrorType(error) ? error : null,
    errorSkill: row.error_skill,
    selfAssessed: row.self_assessed === 1,
    at: row.resolved_at,
  };
}

/**
 * The rules the stored skill states were computed under: the model's own version and the
 * content's (which decides prerequisites and how hard a skill's problems get).
 */
export const modelMarker = (): string => `model ${MODEL_VERSION} · content ${CONTENT_VERSION}`;

/**
 * Make sure the stored skill states match the rules this version applies. They are a
 * cache of the log, so after an update that changed the model or the content they are
 * simply rebuilt. Returns what was done, for the log.
 */
export function ensureModelCurrent(ctx: Ctx): {
  rebuilt: boolean;
  from: string | null;
  skills: number;
  problems: number;
} {
  const row = ctx.db.prepare(`SELECT value FROM settings WHERE key = 'model_marker'`).get() as
    { value: string } | undefined;
  const from = row ? fromJson<string | null>(row.value, null) : null;
  const marker = modelMarker();
  if (from === marker) return { rebuilt: false, from, skills: 0, problems: 0 };
  const result = replayAll(ctx);
  ctx.db
    .prepare(
      `INSERT INTO settings (key, value, updated_at) VALUES ('model_marker', ?, ?)
       ON CONFLICT (key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    )
    .run(toJson(marker), ctx.now());
  return { rebuilt: result.problems > 0, from, ...result };
}

/**
 * Rebuild every skill state from the log. Run after the learning model changes, after an
 * error is reclassified, or simply to check that the cache is consistent.
 */
export function replayAll(ctx: Ctx): { skills: number; problems: number } {
  const problems = ctx.db
    .prepare(
      `SELECT skill, level, context, status, first_try, hints_used, tutor_used, wrong_attempts, seconds, est_seconds, confidence,
              error_inferred, error_confirmed, error_skill, self_assessed, resolved_at
       FROM problems WHERE status IN ('solved', 'failed') AND resolved_at IS NOT NULL ORDER BY resolved_at, rowid`,
    )
    .all() as ReplayRow[];
  const lessons = ctx.db.prepare('SELECT concept, started_at FROM lesson_progress ORDER BY started_at').all() as {
    concept: string;
    started_at: number;
  }[];

  const states: States = new Map();
  let lessonIndex = 0;
  const flushLessons = (until: number): void => {
    while (lessonIndex < lessons.length && lessons[lessonIndex]!.started_at <= until) {
      const lesson = lessons[lessonIndex++]!;
      states.set(lesson.concept, markLessonSeen(stateOf(states, lesson.concept), lesson.started_at));
    }
  };
  for (const row of problems) {
    flushLessons(row.resolved_at);
    applyResolved(states, factsFromRow(row));
  }
  flushLessons(Number.MAX_SAFE_INTEGER);

  ctx.db.transaction(() => {
    ctx.db.prepare('DELETE FROM skill_state').run();
    for (const state of states.values()) saveState(ctx, state);
  })();
  return { skills: states.size, problems: problems.length };
}

// --------------------------------------------------------------------------------- DTOs

export function lessonDoneSet(ctx: Ctx): Set<string> {
  const rows = ctx.db.prepare('SELECT concept FROM lesson_progress WHERE done = 1').all() as { concept: string }[];
  return new Set(rows.map((row) => row.concept));
}

export function skillDto(concept: Concept, states: States, lessonsDone: Set<string>, now: number): SkillDto {
  const state = states.get(concept.id);
  const level: MasteryLevel = state ? levelOf(state) : 0;
  const weak = concept.prereqs.find((id) => {
    const pre = states.get(id);
    return (pre ? levelOf(pre) : 0) < 3 && getConcept(id) !== undefined && hasProblems(id);
  });
  return {
    id: concept.id,
    title: concept.title,
    summary: concept.summary,
    area: concept.area,
    track: concept.track,
    topic: concept.syllabusTopic ?? null,
    prereqs: concept.prereqs,
    level,
    progress: state ? progressOf(state) : 0,
    theta: state ? Math.round(state.theta * 100) / 100 : 0,
    attempts: state?.attempts ?? 0,
    fading: state ? isFading(state, now) : false,
    due: state ? isDue(state.card, now) : false,
    dueInDays: state ? dueInDays(state.card, now) : null,
    retention: state ? retrievability(state.card, now) : null,
    hasLesson: getLesson(concept.id) !== undefined,
    lessonDone: lessonsDone.has(concept.id),
    hasProblems: hasProblems(concept.id),
    lastPracticedAt: state?.lastPracticedAt ?? null,
    fit: concept.fit ?? [],
    annualReview: concept.annualReview ?? false,
    weakPrereq: weak ?? null,
  };
}

export function allSkills(ctx: Ctx, states: States = loadStates(ctx)): SkillDto[] {
  const done = lessonDoneSet(ctx);
  const now = ctx.now();
  return CONCEPTS.filter((concept) => !concept.deprecated).map((concept) => skillDto(concept, states, done, now));
}

export function topicDtos(skills: readonly SkillDto[], currentTopic: number | null): SyllabusTopicDto[] {
  const byId = new Map(skills.map((skill) => [skill.id, skill]));
  return SYLLABUS.map((topic) => {
    const ids = conceptsOfTopic(topic.n).map((concept) => concept.id);
    const list = ids.map((id) => byId.get(id)).filter((s): s is SkillDto => s !== undefined);
    return {
      n: topic.n,
      title: topic.title,
      resources: topic.resources,
      skills: ids,
      progress: list.length === 0 ? 0 : list.reduce((sum, s) => sum + s.progress, 0) / list.length,
      minLevel: (list.length === 0 ? 0 : Math.min(...list.map((s) => s.level))) as MasteryLevel,
      current: topic.n === currentTopic,
    };
  });
}

/** Mean progress over a set of concept ids; null when the set is empty. */
export function meanProgress(ids: readonly string[], byId: Map<string, SkillDto>): number | null {
  const list = ids.map((id) => byId.get(id)).filter((s): s is SkillDto => s !== undefined);
  if (list.length === 0) return null;
  return list.reduce((sum, s) => sum + s.progress, 0) / list.length;
}
