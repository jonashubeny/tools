import type { Level } from '../content/types';
import type { Rng } from '../rng';
import { PRIORITY, SESSION } from './constants';
import { type MasteryLevel, type SkillState, levelOf, predictSuccess } from './mastery';
import { presumedKnown } from './placement';

/**
 * Choosing what to practise next.
 *
 * Every skill of the learner's goal gets a score: a weighted sum of named terms, each of
 * which the interface can show ("due for review", "needed for linear equations"). On top
 * of the scores sit the rules of a session — not the same skill twice in a row, a rest
 * after a failure, a problem that is likely to go well after two that did not.
 *
 * Pure: the same input gives the same choice. The weights are PRIORITY and SESSION in
 * constants.ts. See docs/learning-model.md §12.
 */

/** Why a problem is being asked: it decides the context, the level and the wording. */
export type Purpose =
  | 'new' // first contact with the skill
  | 'repair' // a prerequisite or a skill with recent conceptual errors
  | 'consolidate' // practising what has been started
  | 'review' // spaced repetition, topic hidden
  | 'exam' // examination-style practice of what is already familiar, topic hidden
  | 'stretch' // a hard problem for a strong skill
  | 'assigned' // the teacher asked for it
  | 'confidence'; // something likely to go well, after a run of failures

export type SkillRoleInGoal = 'tested' | 'prerequisite' | 'enrichment';

export interface PrioritySkill {
  id: string;
  role: SkillRoleInGoal;
  /** Share of the examination's points, 0–1; 0 for prerequisites and enrichment. */
  weight: number;
  level: MasteryLevel;
  /** 0–1: level and the way to the next one. */
  progress: number;
  theta: number;
  attempts: number;
  /** Uncertainty of the estimate, on the ability scale. */
  sigma: number;
  /** Never practised, but a diagnostic makes it likely to be there. */
  presumedKnown: boolean;
  /** Has a prior from a diagnostic (its own answers or its neighbours'). */
  placed: boolean;
  due: boolean;
  overdueDays: number;
  fading: boolean;
  reviewFailed: boolean;
  /** Conceptual or procedural errors among the last five attempts. */
  recentGapErrors: number;
  prereqs: readonly string[];
  /** Levels at which the skill has problems. */
  levels: readonly Level[];
  /** The class is on it now. */
  inSchool: boolean;
  /** The teacher assigned it. */
  assigned: boolean;
  /** What the teacher noted in a session: it was hard, or it was covered and should be checked. */
  focus: 'difficulty' | 'covered' | null;
}

export interface PriorityTerms {
  /** (1 − progress) × importance. */
  need: number;
  /** Weight waiting behind this skill, as far as the skill itself is not there yet. */
  unlock: number;
  review: number;
  errors: number;
  school: number;
  info: number;
  assigned: number;
}

export interface ScoredSkill {
  id: string;
  score: number;
  purpose: Purpose;
  terms: PriorityTerms;
  /** The weakest prerequisite that holds this skill back, if any. */
  blockedBy: string | null;
  /** Skills that are waiting for this one, heaviest first. */
  unlocks: string[];
}

const FAMILIAR: MasteryLevel = 3;
const PROFICIENT: MasteryLevel = 4;

/** What is known about a skill as a prerequisite of others. */
export interface PrereqEvidence {
  level: MasteryLevel;
  theta: number;
  attempts: number;
  presumedKnown: boolean;
  recentGapErrors: number;
}

/**
 * Is a prerequisite in the way of what builds on it? Not when it is familiar; not when a
 * diagnostic makes it likely; and not when the learner's own first attempts went well —
 * then it still has to be practised, but nothing says it is missing.
 */
export function holdsBack(skill: PrereqEvidence): boolean {
  if (skill.level >= FAMILIAR || skill.presumedKnown) return false;
  const promising = skill.attempts > 0 && skill.theta >= PRIORITY.PROMISING_THETA && skill.recentGapErrors === 0;
  return !promising;
}

/** The same evidence, read off a stored skill state. */
export function prereqEvidence(state: SkillState | undefined): PrereqEvidence {
  return {
    level: state ? levelOf(state) : 0,
    theta: state?.theta ?? 0,
    attempts: state?.attempts ?? 0,
    presumedKnown: presumedKnown(state),
    recentGapErrors: (state?.recentFamilies ?? []).filter((family) => family === 'procedure' || family === 'concept')
      .length,
  };
}

export function scoreSkills(input: readonly PrioritySkill[]): ScoredSkill[] {
  const byId = new Map(input.map((skill) => [skill.id, skill]));
  const maxWeight = Math.max(...input.map((skill) => skill.weight), 1e-9);
  // Enrichment is offered only once everything the examination tests is at least familiar.
  const tested = input.filter((skill) => skill.role === 'tested');
  const enrichmentOpen = tested.length > 0 && tested.every((skill) => skill.level >= FAMILIAR);

  const importance = (skill: PrioritySkill): number => {
    if (skill.role === 'tested') return Math.max(PRIORITY.PREREQ_FLOOR, skill.weight / maxWeight);
    if (skill.role === 'prerequisite') return PRIORITY.PREREQ_FLOOR;
    return enrichmentOpen ? PRIORITY.PREREQ_FLOOR : 0;
  };

  // Who depends on whom.
  const dependents = new Map<string, string[]>();
  for (const skill of input) {
    for (const pre of skill.prereqs) {
      if (!byId.has(pre)) continue;
      dependents.set(pre, [...(dependents.get(pre) ?? []), skill.id]);
    }
  }

  /** What is waiting behind a skill: the need of everything that builds on it, fading with distance. */
  const behind = (start: string): { total: number; ids: string[] } => {
    const found = new Map<string, number>();
    let frontier = [start];
    for (let distance = 1; frontier.length > 0 && distance <= 4; distance++) {
      const following: string[] = [];
      for (const id of frontier) {
        for (const next of dependents.get(id) ?? []) {
          if (next === start || found.has(next)) continue;
          const skill = byId.get(next)!;
          found.set(next, importance(skill) * (1 - skill.progress) * PRIORITY.UNLOCK_DECAY ** (distance - 1));
          following.push(next);
        }
      }
      frontier = following;
    }
    const ids = [...found.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => id);
    return { total: [...found.values()].reduce((sum, value) => sum + value, 0), ids };
  };

  const waiting = new Map(input.map((skill) => [skill.id, behind(skill.id)]));
  const maxWaiting = Math.max(...[...waiting.values()].map((entry) => entry.total), 1e-9);

  return input.map((skill): ScoredSkill => {
    const need = (1 - skill.progress) * importance(skill);
    const behindIt = waiting.get(skill.id)!;
    // What waits behind a skill counts for it only while the skill is in the way.
    const unlock = holdsBack(skill) ? (behindIt.total / maxWaiting) * (1 - skill.progress) : 0;

    let review = 0;
    if (skill.attempts > 0) {
      if (skill.due)
        review =
          PRIORITY.REVIEW_DUE +
          (1 - PRIORITY.REVIEW_DUE) * Math.min(1, skill.overdueDays / PRIORITY.REVIEW_FULL_AFTER_DAYS);
      else if (skill.fading) review = PRIORITY.REVIEW_FADING;
      if (skill.reviewFailed) review = Math.min(1, review + PRIORITY.REVIEW_FAILED_EXTRA);
    }
    const errors = Math.min(1, skill.recentGapErrors / PRIORITY.ERRORS_SATURATE);
    const school = skill.inSchool ? 1 - skill.progress : 0;
    const info = skill.attempts < 4 ? (skill.sigma / 1.5) * Math.max(importance(skill), unlock * 0.5) : 0;
    const assigned =
      (skill.assigned ? 1 : 0) +
      (skill.focus === 'difficulty'
        ? PRIORITY.FOCUS_DIFFICULTY
        : skill.focus === 'covered'
          ? PRIORITY.FOCUS_COVERED
          : 0);

    const terms: PriorityTerms = { need, unlock, review, errors, school, info, assigned };
    let score =
      PRIORITY.NEED * need +
      PRIORITY.UNLOCK * unlock +
      PRIORITY.REVIEW * review +
      PRIORITY.ERRORS * errors +
      PRIORITY.SCHOOL * school +
      PRIORITY.INFO * info +
      PRIORITY.ASSIGNED * assigned;

    // Held back by a prerequisite: the prerequisite goes first (it carries the unlock term).
    const blocking = skill.prereqs
      .map((id) => byId.get(id))
      .filter((pre): pre is PrioritySkill => pre !== undefined && pre.levels.length > 0 && holdsBack(pre))
      .sort((a, b) => a.level - b.level || a.theta - b.theta)[0];
    const blocked = blocking !== undefined && skill.level < FAMILIAR && !skill.assigned;
    if (blocked) score *= PRIORITY.BLOCKED_FACTOR;
    if (skill.levels.length === 0) score = 0;

    let purpose: Purpose;
    if (skill.assigned) purpose = 'assigned';
    // A review hides the topic, and that is for what is at least familiar. Below that, a
    // skill that is due is still being learned: it comes back with its name and its hints.
    else if (
      review > 0 &&
      skill.level >= FAMILIAR &&
      PRIORITY.REVIEW * review >= Math.max(PRIORITY.NEED * need, PRIORITY.UNLOCK * unlock)
    )
      purpose = 'review';
    else if (skill.attempts === 0) purpose = unlock > need && skill.role !== 'tested' ? 'repair' : 'new';
    else if (skill.level < FAMILIAR && (errors > 0 || unlock > need)) purpose = 'repair';
    else if (skill.level < PROFICIENT) purpose = skill.level === FAMILIAR ? 'exam' : 'consolidate';
    else purpose = skill.levels.some((level) => level >= 4) ? 'stretch' : 'exam';

    return { id: skill.id, score, purpose, terms, blockedBy: blocked ? blocking.id : null, unlocks: behindIt.ids };
  });
}

// ------------------------------------------------------------------------------ session

/** One problem already asked in the session. */
export interface SessionItem {
  skill: string;
  purpose: Purpose;
  solved: boolean;
  unaided: boolean;
}

export interface Choice {
  skill: string;
  purpose: Purpose;
  /** The term that weighed most, for the explanation shown with the problem. */
  because: keyof PriorityTerms | 'confidence';
  blockedSkill: string | null;
  /** Do not go above / below this level. */
  cap?: Level;
  floor?: Level;
  /** Start by the estimate rather than at the bottom (the skill was placed by a diagnostic). */
  byEstimate: boolean;
}

/** The term of a score that weighed most: what the interface names as the reason. */
export const mainTerm = (terms: PriorityTerms): keyof PriorityTerms => {
  const weighted: [keyof PriorityTerms, number][] = [
    ['assigned', PRIORITY.ASSIGNED * terms.assigned],
    ['review', PRIORITY.REVIEW * terms.review],
    ['errors', PRIORITY.ERRORS * terms.errors],
    ['unlock', PRIORITY.UNLOCK * terms.unlock],
    ['need', PRIORITY.NEED * terms.need],
    ['school', PRIORITY.SCHOOL * terms.school],
    ['info', PRIORITY.INFO * terms.info],
  ];
  return weighted.sort((a, b) => b[1] - a[1])[0]![0];
};

/** The level a skill is usually asked at: the one nearest to 75 % predicted success. */
function usualSuccess(skill: PrioritySkill): number {
  const lowest = skill.levels[0] ?? 1;
  return predictSuccess(skill.theta, lowest);
}

/**
 * The next problem of a session: the best-scoring skill that the session's rules allow.
 * Returns null when nothing can be asked.
 */
export function pickNext(
  scored: readonly ScoredSkill[],
  skills: readonly PrioritySkill[],
  session: readonly SessionItem[],
  rng: Rng,
): Choice | null {
  const byId = new Map(skills.map((skill) => [skill.id, skill]));
  const asked = new Map<string, number>();
  const purposes = new Map<Purpose, number>();
  for (const item of session) {
    asked.set(item.skill, (asked.get(item.skill) ?? 0) + 1);
    purposes.set(item.purpose, (purposes.get(item.purpose) ?? 0) + 1);
  }
  const last = session[session.length - 1];
  // Skills failed recently rest for a while and come back later, in another form.
  const resting = new Set(
    session
      .slice(-SESSION.FAIL_COOLDOWN)
      .filter((item) => !item.solved)
      .map((item) => item.skill),
  );
  let failsInRow = 0;
  for (let i = session.length - 1; i >= 0 && !session[i]!.solved; i--) failsInRow++;
  let streak = 0;
  for (let i = session.length - 1; i >= 0 && session[i]!.unaided; i--) streak++;

  const permitted = scored.filter((entry) => {
    const skill = byId.get(entry.id);
    if (!skill || skill.levels.length === 0 || entry.score <= 0) return false;
    if (last && last.skill === entry.id) return false;
    if (resting.has(entry.id)) return false;
    return (asked.get(entry.id) ?? 0) < SESSION.MAX_PER_SKILL;
  });
  // Prerequisites are a constraint, not a preference: a skill held back by one is asked
  // only when the session has nothing else left to ask.
  const open = permitted.filter((entry) => entry.blockedBy === null);
  const allowed = open.length > 0 ? open : permitted;

  // After failures in a row: something the learner is likely to solve.
  if (failsInRow >= SESSION.CONFIDENCE_AFTER_FAILS) {
    const likely = allowed
      .map((entry) => ({ entry, skill: byId.get(entry.id)! }))
      .filter(({ skill }) => skill.attempts > 0 && usualSuccess(skill) >= SESSION.CONFIDENCE_MIN_P)
      .sort((a, b) => b.entry.terms.review - a.entry.terms.review || b.skill.theta - a.skill.theta)[0];
    if (likely) {
      return {
        skill: likely.entry.id,
        purpose: 'confidence',
        because: 'confidence',
        blockedSkill: null,
        cap: 2,
        byEstimate: false,
      };
    }
  }

  const adjusted = allowed
    .map((entry) => {
      let score = entry.score;
      score *= SESSION.SKILL_REPEAT ** (asked.get(entry.id) ?? 0);
      score *= SESSION.PURPOSE_REPEAT ** (purposes.get(entry.purpose) ?? 0);
      if (entry.purpose === 'stretch' && streak < SESSION.STRETCH_AFTER_STREAK) score *= SESSION.STRETCH_OTHERWISE;
      return { entry, score };
    })
    .filter((candidate) => candidate.score > 0)
    .sort((a, b) => b.score - a.score || a.entry.id.localeCompare(b.entry.id));
  if (adjusted.length === 0) {
    // Everything is resting or used up: fall back to the best skill that is not the last one.
    const fallback = scored
      .filter((entry) => (byId.get(entry.id)?.levels.length ?? 0) > 0 && entry.id !== last?.skill)
      .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))[0];
    if (!fallback) return null;
    return choiceFor(fallback, byId.get(fallback.id)!, scored);
  }
  const best = adjusted[0]!.score;
  const level = adjusted.filter((candidate) => candidate.score >= best * (1 - SESSION.TIE_BAND));
  const chosen = level.length === 1 ? level[0]! : rng.pick(level);
  return choiceFor(chosen.entry, byId.get(chosen.entry.id)!, scored);
}

/** The skill a prerequisite is practised for: the heaviest of those it unlocks that it holds back. */
export const waitingFor = (entry: ScoredSkill, scored: readonly ScoredSkill[]): string | null =>
  entry.unlocks.find((id) => scored.find((other) => other.id === id)?.blockedBy === entry.id) ?? null;

function choiceFor(entry: ScoredSkill, skill: PrioritySkill, scored: readonly ScoredSkill[]): Choice {
  const top = (skill.levels[skill.levels.length - 1] ?? 3) as Level;
  const base = {
    skill: entry.id,
    purpose: entry.purpose,
    because: mainTerm(entry.terms),
    blockedSkill: waitingFor(entry, scored),
    byEstimate: skill.placed || skill.attempts > 0,
  };
  switch (entry.purpose) {
    case 'new':
    case 'repair':
      // First contact goes gently unless a diagnostic says otherwise.
      return skill.placed ? { ...base, cap: 3 } : { ...base, cap: 2 };
    case 'review':
      return { ...base, cap: 3 };
    case 'stretch':
      return { ...base, floor: Math.min(4, top) as Level };
    case 'exam':
      return { ...base, floor: Math.min(3, top) as Level };
    default:
      return base;
  }
}
