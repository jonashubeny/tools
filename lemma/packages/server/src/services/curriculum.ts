import { GOALS, JPZ_SPEC, SPEC_STAGE, conceptsOfGoal, getGoal, goalSkillOf, hasProblems } from '@lemma/content';
import type { CurriculumDto, Goal, GoalDto } from '@lemma/core';
import { activeFocus, assignedSkills } from './assignments';
import { type Ctx, getSettings } from './context';
import { diagnosticStatus } from './diagnostic';
import { allSkills, loadStates } from './learner';
import { nextSteps, selectionFor } from './selection';

/** The goals a learner can choose from, and the map of the one they chose. */

/**
 * The official specification against the app's content: the items that apply to an
 * examination (its own part and the earlier ones, which it includes), and which of them
 * no skill with problems covers.
 */
function specCoverage(goal: Goal): GoalDto['spec'] {
  if (goal.kind !== 'entrance' || goal.grade === null) return null;
  const grade = goal.grade;
  const covered = new Set(
    conceptsOfGoal(goal.id)
      .filter((concept) => hasProblems(concept.id))
      .flatMap((concept) => concept.spec ?? []),
  );
  const items = JPZ_SPEC.filter((item) => SPEC_STAGE[item.part] <= grade);
  const missing = items.filter((item) => !covered.has(item.id));
  return {
    items: items.length,
    withProblems: items.length - missing.length,
    missing: missing.map((item) => ({ id: item.id, text: item.summary })),
  };
}

export function goalDto(goal: Goal): GoalDto {
  const concepts = conceptsOfGoal(goal.id);
  const role = (wanted: string): number => goal.skills.filter((skill) => skill.role === wanted).length;
  return {
    id: goal.id,
    kind: goal.kind,
    title: goal.title,
    short: goal.short,
    description: goal.description,
    grade: goal.grade,
    facts: goal.facts,
    papersRead: goal.papersRead,
    provisional: goal.provisional,
    counts:
      goal.kind === 'school'
        ? { tested: concepts.filter((c) => c.track === 'school').length, prerequisite: 0, enrichment: 0, paperOnly: 0 }
        : {
            tested: role('tested'),
            prerequisite: role('prerequisite'),
            enrichment: role('enrichment'),
            paperOnly: concepts.filter((concept) => concept.paperOnly).length,
          },
    spec: specCoverage(goal),
  };
}

export const listGoals = (): GoalDto[] => GOALS.map(goalDto);

/**
 * The whole curriculum of the learner's goal: every skill with where the learner stands,
 * what holds it back and what it opens, and the steps the selection would take next.
 */
export function curriculum(ctx: Ctx): CurriculumDto {
  const settings = getSettings(ctx);
  const goal = getGoal(settings.goal);
  const states = loadStates(ctx);
  const selection = selectionFor(ctx, states);
  const scored = new Map(selection.scored.map((entry) => [entry.id, entry]));
  const input = new Map(selection.skills.map((skill) => [skill.id, skill]));
  const assigned = assignedSkills(ctx);
  const focus = activeFocus(ctx);

  return {
    goal: goalDto(goal),
    skills: allSkills(ctx, states, goal.id).map((skill) => ({
      ...skill,
      tasks: goalSkillOf(goal.id, skill.id)?.tasks ?? { read: 0, rules: 0 },
      blockedBy: scored.get(skill.id)?.blockedBy ?? skill.weakPrereq,
      unlocks: scored.get(skill.id)?.unlocks ?? [],
      assigned: assigned.has(skill.id),
      focus: focus.get(skill.id) ?? null,
      inSchool: input.get(skill.id)?.inSchool ?? false,
    })),
    next: nextSteps(selection, 5),
    diagnostic: diagnosticStatus(ctx, goal.id),
  };
}
