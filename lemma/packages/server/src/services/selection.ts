import { conceptsOfGoal, generatorsFor, getConcept, getGoal, goalSkillOf, staticProblemsFor } from '@lemma/content';
import {
  type GoalId,
  type Level,
  type NextStepDto,
  type PrioritySkill,
  type Purpose,
  type ScoredSkill,
  type SessionItem,
  type SkillRole,
  L,
  UNCERTAINTY,
  dueInDays,
  isDue,
  isFading,
  mainTerm,
  prereqEvidence,
  progressOf,
  scoreSkills,
  uncertaintyOf,
  waitingFor,
} from '@lemma/core';
import { activeFocus, assignedSkills } from './assignments';
import { type Ctx, getSettings } from './context';
import { type States, loadStates, stateOf } from './learner';

/**
 * What the selection algorithm is given: every skill of the learner's goal as the scoring
 * function wants it (core/learning/priority.ts). This module only gathers — from the
 * stored states, the goal, the settings, and what the teacher set. It decides nothing.
 */

/** The levels at which a skill has problems that count as evidence, ascending. */
const levelCache = new Map<string, Level[]>();
export function practiceLevels(skill: string): Level[] {
  let levels = levelCache.get(skill);
  if (!levels) {
    levels = [
      ...new Set([
        ...generatorsFor(skill)
          .filter((generator) => !generator.deprecated)
          .flatMap((generator) => generator.levels),
        ...staticProblemsFor(skill)
          .filter((problem) => problem.answer.kind !== 'self')
          .map((problem) => problem.level),
      ]),
    ].sort((a, b) => a - b);
    levelCache.set(skill, levels);
  }
  return levels;
}

/**
 * A skill's role and weight in a goal. An examination goal derives both from its sources
 * (content/goals.ts). The school goal has no such data: what the syllabus lists is what
 * is asked, each skill alike; the foundations are prerequisites; the rest is enrichment.
 */
function roleIn(goal: GoalId, skill: string, schoolSkills: number): { role: SkillRole; weight: number } {
  if (getGoal(goal).kind === 'entrance') {
    const found = goalSkillOf(goal, skill);
    return { role: found?.role ?? 'enrichment', weight: found?.weight ?? 0 };
  }
  const track = getConcept(skill)?.track;
  if (track === 'school') return { role: 'tested', weight: 1 / Math.max(1, schoolSkills) };
  if (track === 'foundation') return { role: 'prerequisite', weight: 0 };
  return { role: 'enrichment', weight: 0 };
}

export interface Selection {
  goal: GoalId;
  skills: PrioritySkill[];
  scored: ScoredSkill[];
}

export function selectionFor(ctx: Ctx, states: States = loadStates(ctx)): Selection {
  const settings = getSettings(ctx);
  const goal = settings.goal;
  const concepts = conceptsOfGoal(goal);
  const inGoal = new Set(concepts.map((concept) => concept.id));
  const schoolSkills = concepts.filter((concept) => concept.track === 'school').length;
  const assigned = assignedSkills(ctx);
  const focus = activeFocus(ctx);
  const inSchool = new Set(settings.inSchool);
  const now = ctx.now();

  const skills = concepts.map((concept): PrioritySkill => {
    const stored = states.get(concept.id);
    // A skill never touched still has a prior, from its prerequisites.
    const state = stored ?? stateOf(states, concept.id);
    const due = stored ? isDue(stored.card, now) : false;
    const dueIn = stored ? dueInDays(stored.card, now) : null;
    return {
      id: concept.id,
      ...roleIn(goal, concept.id, schoolSkills),
      ...prereqEvidence(stored),
      progress: stored ? progressOf(stored) : 0,
      theta: state.theta,
      sigma: stored ? uncertaintyOf(stored) : UNCERTAINTY.MAX,
      placed: stored !== undefined && (stored.placement !== null || stored.diagnosed > 0),
      due,
      overdueDays: due && dueIn !== null ? Math.max(0, -dueIn) : 0,
      fading: stored ? isFading(stored, now) : false,
      reviewFailed: stored?.reviewFailed ?? false,
      prereqs: concept.prereqs.filter((id) => inGoal.has(id)),
      levels: practiceLevels(concept.id),
      inSchool:
        inSchool.has(concept.id) || (settings.currentTopic !== null && concept.syllabusTopic === settings.currentTopic),
      assigned: assigned.has(concept.id),
      focus: focus.get(concept.id) ?? null,
    };
  });
  return { goal, skills, scored: scoreSkills(skills) };
}

const titled = (id: string): { id: string; title: NextStepDto['skill']['title'] } => ({
  id,
  title: getConcept(id)?.title ?? L(id, id),
});

/** The best-scoring skills, best first: what "continue" would work on, and why. */
export function nextSteps(selection: Selection, limit = 5): NextStepDto[] {
  const practisable = new Set(selection.skills.filter((skill) => skill.levels.length > 0).map((skill) => skill.id));
  return [...selection.scored]
    .filter((entry) => entry.score > 0 && practisable.has(entry.id))
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))
    .slice(0, limit)
    .map((entry) => {
      const waiting = waitingFor(entry, selection.scored);
      return {
        skill: titled(entry.id),
        purpose: entry.purpose,
        because: mainTerm(entry.terms),
        forSkill: waiting ? titled(waiting) : null,
        terms: entry.terms,
        score: Math.round(entry.score * 1000) / 1000,
      };
    });
}

const PURPOSES: readonly Purpose[] = [
  'new',
  'repair',
  'consolidate',
  'review',
  'exam',
  'stretch',
  'assigned',
  'confidence',
];
export const isPurpose = (value: unknown): value is Purpose =>
  typeof value === 'string' && (PURPOSES as readonly string[]).includes(value);

/** A run's resolved problems, as the session rules see them. */
export function sessionItems(
  rows: readonly {
    skill: string;
    purpose: string | null;
    status: string;
    first_try: number | null;
    hints_used: number;
    tutor_used: number;
  }[],
): SessionItem[] {
  return rows
    .filter((row) => row.status === 'solved' || row.status === 'failed')
    .map((row) => {
      const solved = row.status === 'solved';
      return {
        skill: row.skill,
        purpose: isPurpose(row.purpose) ? row.purpose : 'consolidate',
        solved,
        unaided: solved && row.first_try === 1 && row.hints_used + row.tutor_used === 0,
      };
    });
}
