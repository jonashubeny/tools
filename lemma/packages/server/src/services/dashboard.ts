import { CONCEPTS, CURRENT_FIT_SNAPSHOT, getConcept, getGoal, topLevelOf } from '@lemma/content';
import { type DashboardDto, type SkillDto, nextLevelGates } from '@lemma/core';
import { heatmap, recentItems, streakSummary } from './activity';
import { listAssignments } from './assignments';
import { type Ctx, getSettings, today } from './context';
import { diagnosticStatus } from './diagnostic';
import { bridgeCoverage } from './fit';
import { forgeDayCounts, forgeOverview } from './forge';
import { slipRates } from './insights';
import { allSkills, loadStates, meanProgress, stateOf, topicDtos } from './learner';
import { errorFocus, getPlan } from './plan';
import { readinessFor } from './readiness';
import { nextSteps, selectionFor } from './selection';

/** Everything the home screen needs, in one request. */
export function dashboard(ctx: Ctx): DashboardDto {
  const settings = getSettings(ctx);
  const goal = getGoal(settings.goal);
  const entrance = goal.kind === 'entrance';
  const states = loadStates(ctx);
  const skills = allSkills(ctx, states);
  const byId = new Map(skills.map((skill) => [skill.id, skill]));
  const plan = getPlan(ctx);
  const topics = entrance ? [] : topicDtos(skills, settings.currentTopic);
  const focusTopic = topics.find((topic) => topic.n === (plan.focusTopic ?? settings.currentTopic)) ?? null;
  const focusSkills = focusTopic
    ? focusTopic.skills.map((id) => byId.get(id)).filter((s): s is SkillDto => s !== undefined)
    : [];
  const steps = entrance ? nextSteps(selectionFor(ctx, states), 3) : [];

  // The next step: the skill the plan's main block works on, with what it still needs.
  const mainBlock = plan.blocks.find(
    (block) => block.kind === 'lesson' || block.kind === 'practice' || block.kind === 'prereq',
  );
  const nextId =
    steps[0]?.skill.id ??
    mainBlock?.skills[0]?.id ??
    focusSkills.filter((skill) => skill.hasProblems).sort((a, b) => a.level - b.level || a.theta - b.theta)[0]?.id;
  const nextConcept = nextId ? getConcept(nextId) : undefined;

  // Weak spots: practised skills that matter now and are furthest from proficient.
  const relevant = skills.filter((skill) => skill.attempts > 0 && skill.level < 4 && skill.hasProblems);
  const weak = [...relevant].sort((a, b) => a.progress - b.progress).slice(0, 4);
  // For an examination goal "to be reviewed" is a path state, and only what is at least
  // familiar is in it: a skill still being learned is not reviewed, it is learned.
  const fading = skills
    .filter((skill) => (entrance ? skill.path === 'needs-review' : skill.fading || skill.due))
    .sort((a, b) => (a.retention ?? 1) - (b.retention ?? 1))
    .slice(0, 4);

  const forge = forgeOverview(ctx);
  const streak = streakSummary(ctx);
  const totals = ctx.db
    .prepare(
      `SELECT COUNT(*) AS problems, SUM(CASE WHEN status = 'solved' THEN 1 ELSE 0 END) AS solved FROM problems WHERE status IN ('solved', 'failed')`,
    )
    .get() as { problems: number; solved: number | null };
  const practisable = skills.filter((skill) => skill.hasProblems);

  // The FIT widgets describe one path — the second-year syllabus towards FIT — and are not
  // shown to somebody preparing for an entrance examination.
  let fit: DashboardDto['fit'] = null;
  if (!entrance) {
    const coverage = bridgeCoverage(skills);
    fit = {
      bridgeCoverage: coverage.familiar,
      bridgeProficient: coverage.proficient,
      schoolProgress:
        meanProgress(
          CONCEPTS.filter((c) => c.track === 'school').map((c) => c.id),
          byId,
        ) ?? 0,
      reasoningProgress:
        meanProgress(
          CONCEPTS.filter((c) => c.track === 'reasoning' || c.track === 'vut').map((c) => c.id),
          byId,
        ) ?? 0,
      stale: today(ctx) > CURRENT_FIT_SNAPSHOT.reviewAfter,
      retrievedOn: CURRENT_FIT_SNAPSHOT.retrievedOn,
    };
  }

  return {
    today: today(ctx),
    name: settings.name,
    plan,
    focus: {
      topic: focusTopic,
      skills: focusSkills,
      nextSkill: nextConcept
        ? {
            id: nextConcept.id,
            title: nextConcept.title,
            next: nextLevelGates(stateOf(states, nextConcept.id), topLevelOf(nextConcept.id)),
          }
        : null,
    },
    weak: { skills: weak, error: errorFocus(ctx), fading },
    streak,
    heatmap: heatmap(ctx, forgeDayCounts(ctx)),
    recent: recentItems(ctx),
    goal: { id: goal.id, kind: goal.kind, title: goal.title, short: goal.short },
    entrance: entrance
      ? {
          next: steps[0] ?? null,
          readiness: readinessFor(ctx, states),
          diagnostic: diagnosticStatus(ctx, goal.id),
        }
      : null,
    assignments: listAssignments(ctx, 3),
    fit,
    totals: {
      problems: totals.problems,
      solved: totals.solved ?? 0,
      activeDays: streak.totalActiveDays,
      skillsProficient: practisable.filter((skill) => skill.level >= 4).length,
      skillsTotal: practisable.length,
      reviewsDue: skills.filter((skill) => skill.due).length,
    },
    slipRate: slipRates(ctx),
    forge: {
      configured: forge.configured,
      stale: forge.sources.some((source) => !source.ok),
      fetchedAt: forge.sources.reduce<number | null>(
        (latest, source) =>
          source.fetchedAt !== null && (latest === null || source.fetchedAt > latest) ? source.fetchedAt : latest,
        null,
      ),
    },
  };
}
