import { type MasteryLevel, type SkillState, isFading, levelOf } from './mastery';
import { isDue } from './scheduler';

/**
 * Where a skill stands on the learner's path, in the seven states the interface shows.
 *
 * The states are a reading of the evidence, never set by hand: each is a rule over the
 * skill state, and the rule that applied is returned with it so the interface can say why.
 * See docs/learning-model.md §14.
 */
export const PATH_STATES = [
  'not-started',
  'diagnosed',
  'learning',
  'practising',
  'consolidating',
  'mastered',
  'needs-review',
] as const;

export type PathState = (typeof PATH_STATES)[number];

/** Which rule put the skill where it is. */
export type PathReason =
  | 'no-evidence'
  | 'placed-high' // a diagnostic suggests it is there; nothing practised yet
  | 'placed-low' // a diagnostic suggests a gap
  | 'placed-unclear'
  | 'introduced' // lesson opened or first problems
  | 'familiar' // solves known problem types
  | 'proficient' // recognises and remembers; the long-term evidence is missing
  | 'all-gates'
  | 'review-due'
  | 'fading'
  | 'review-failed';

export interface PathPosition {
  state: PathState;
  reason: PathReason;
  level: MasteryLevel;
}

export function pathPositionOf(state: SkillState | undefined, now: number): PathPosition {
  if (!state) return { state: 'not-started', reason: 'no-evidence', level: 0 };
  const level = levelOf(state);
  const practised = state.attempts - state.diagnosed;

  if (state.attempts === 0 && !state.lessonSeen) {
    if (state.placement === null) return { state: 'not-started', reason: 'no-evidence', level };
    return { state: 'diagnosed', reason: state.placement.theta >= 0 ? 'placed-high' : 'placed-low', level };
  }
  // Asked in a diagnostic and not practised since: a first reading, not yet a path.
  if (practised === 0 && state.diagnosed > 0 && !state.lessonSeen) {
    const reason: PathReason =
      state.theta >= 0.4 ? 'placed-high' : state.theta <= -0.3 ? 'placed-low' : 'placed-unclear';
    return { state: 'diagnosed', reason, level };
  }
  if (level >= 3) {
    if (state.reviewFailed) return { state: 'needs-review', reason: 'review-failed', level };
    if (isDue(state.card, now)) return { state: 'needs-review', reason: 'review-due', level };
    if (isFading(state, now)) return { state: 'needs-review', reason: 'fading', level };
  }
  if (level >= 5) return { state: 'mastered', reason: 'all-gates', level };
  if (level === 4) return { state: 'consolidating', reason: 'proficient', level };
  if (level === 3) return { state: 'practising', reason: 'familiar', level };
  return { state: 'learning', reason: 'introduced', level };
}
