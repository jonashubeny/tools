import { blueprintsOfGoal, conceptsOfGoal, getConcept, getGoal, goalSkillOf } from '@lemma/content';
import {
  type ExamReportDto,
  type GoalId,
  type L as LText,
  type MockResult,
  type ReadinessDto,
  type ReadinessSkill,
  L,
  daysBetween,
  holdsBack,
  levelOf,
  pathPositionOf,
  prereqEvidence,
  readiness,
} from '@lemma/core';
import { fromJson } from '../db';
import { type Ctx, getSettings, today } from './context';
import { type States, loadStates } from './learner';

/**
 * Readiness for the examination of the learner's goal: the evidence gathered from the
 * database and handed to the pure report in core (learning/readiness.ts), which decides
 * what can be said and what cannot.
 */

/** The timed practice tests of a goal that were finished, oldest first. */
export function mockResults(ctx: Ctx, goal: GoalId): MockResult[] {
  const blueprint = blueprintsOfGoal(goal).find((candidate) => candidate.kind === 'entrance');
  if (!blueprint) return [];
  const rows = ctx.db
    .prepare(
      'SELECT minutes, finished_at, report FROM exams WHERE blueprint = ? AND finished_at IS NOT NULL ORDER BY finished_at',
    )
    .all(blueprint.id) as { minutes: number; finished_at: number; report: string | null }[];
  const out: MockResult[] = [];
  for (const row of rows) {
    const report = fromJson<ExamReportDto | null>(row.report, null);
    if (!report || report.maxPoints <= 0) continue;
    out.push({
      finishedAt: row.finished_at,
      points: report.points,
      maxPoints: report.maxPoints,
      examPoints: getGoal(goal).facts?.points ?? report.maxPoints,
      minutesUsed: Math.round(report.time.usedSeconds / 60),
      minutesAllowed: row.minutes,
    });
  }
  return out;
}

export function readinessFor(ctx: Ctx, states: States = loadStates(ctx)): ReadinessDto {
  const settings = getSettings(ctx);
  const goal = settings.goal;
  const now = ctx.now();
  const concepts = conceptsOfGoal(goal);
  const inGoal = new Set(concepts.map((concept) => concept.id));
  const levelIn = (id: string): number => {
    const state = states.get(id);
    return state ? levelOf(state) : 0;
  };

  const skills: ReadinessSkill[] = concepts.map((concept) => {
    const state = states.get(concept.id);
    const found = goalSkillOf(goal, concept.id);
    return {
      id: concept.id,
      role: found?.role ?? 'enrichment',
      weight: found?.weight ?? 0,
      paperOnly: concept.paperOnly ?? false,
      level: state ? levelOf(state) : 0,
      practised: state ? state.attempts - state.diagnosed : 0,
      attempts: state?.attempts ?? 0,
      reviews: state?.reviews ?? { passed: 0, failed: 0 },
      inTheWay: holdsBack(prereqEvidence(state)),
      // What waits behind a gap: the skills that build on it directly and are not there yet.
      holdsUp: concepts
        .filter((other) => other.prereqs.includes(concept.id) && inGoal.has(other.id) && levelIn(other.id) < 3)
        .map((other) => other.id),
    };
  });

  const placeholders = concepts.map(() => '?').join(',');
  const hard =
    concepts.length === 0
      ? { attempts: 0, unaided: 0 }
      : (ctx.db
          .prepare(
            `SELECT COUNT(*) AS attempts,
                    COALESCE(SUM(CASE WHEN status = 'solved' AND first_try = 1 AND hints_used + tutor_used = 0 THEN 1 ELSE 0 END), 0) AS unaided
             FROM problems
             WHERE status IN ('solved', 'failed') AND (level >= 4 OR context = 'exam') AND skill IN (${placeholders})`,
          )
          .get(...concepts.map((concept) => concept.id)) as { attempts: number; unaided: number });

  const report = readiness({ skills, mocks: mockResults(ctx, goal), hard });

  const titles: Record<string, LText> = {};
  const name = (id: string): void => {
    titles[id] = getConcept(id)?.title ?? L(id, id);
  };
  for (const gap of report.gaps) {
    name(gap.id);
    gap.holdsUp.forEach(name);
  }
  report.untouched.forEach(name);

  const tested = skills.filter((skill) => skill.role === 'tested').sort((a, b) => b.weight - a.weight);
  tested.forEach((skill) => name(skill.id));
  const day = today(ctx);
  const daysLeft = settings.examDay ? daysBetween(day, settings.examDay) : null;

  return {
    ...report,
    goal,
    examDay: settings.examDay,
    daysLeft: daysLeft !== null && daysLeft >= 0 ? daysLeft : null,
    provisional: getGoal(goal).provisional,
    titles,
    skills: tested.map((skill) => ({
      id: skill.id,
      weight: skill.weight,
      level: skill.level,
      path: pathPositionOf(states.get(skill.id), now).state,
      paperOnly: skill.paperOnly,
    })),
  };
}
