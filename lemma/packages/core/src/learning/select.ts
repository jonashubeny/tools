import type { Level, ProblemKind } from '../content/types';
import type { Rng } from '../rng';
import { LEVEL_DIFFICULTY, PLACEMENT, SELECTION } from './constants';

/**
 * Choosing the next problem: aim for a predicted success of roughly 70–85 %, hard enough
 * to need thought, easy enough to usually succeed. See docs/learning-model.md §7.
 */

export interface LevelChoiceInput {
  theta: number;
  attempts: number;
  /** Levels for which problems exist, ascending. */
  available: readonly Level[];
  /** The previous problem on this skill was not solved unaided. */
  lastFailed?: boolean;
  /** Unaided successes in a row on this skill, up to the latest attempt. */
  unaidedStreak?: number;
  /** Do not go above this level (used for warm-ups and reviews). */
  cap?: Level;
  /** Do not go below this level (used for challenges). */
  floor?: Level;
  /**
   * The estimate comes from a diagnostic: start where it points instead of at the bottom,
   * so that a learner who was placed does not have to prove every skill from level 1.
   */
  byEstimate?: boolean;
}

export function chooseLevel(input: LevelChoiceInput): Level {
  let levels = [...input.available].sort((a, b) => a - b);
  if (levels.length === 0) throw new Error('chooseLevel: no levels available');
  if (input.cap !== undefined) {
    const capped = levels.filter((level) => level <= input.cap!);
    if (capped.length > 0) levels = capped;
  }
  if (input.floor !== undefined) {
    const floored = levels.filter((level) => level >= input.floor!);
    if (floored.length > 0) levels = floored;
  }
  const placed = input.byEstimate === true && input.attempts === 0;
  if (input.attempts === 0 && input.floor === undefined && !placed) return levels[0]!;

  const streak = input.lastFailed ? 0 : (input.unaidedStreak ?? 0);
  if (input.attempts < SELECTION.NOVICE_ATTEMPTS && input.floor === undefined && streak < SELECTION.STREAK_STEP) {
    const limit = placed ? PLACEMENT.START_CAP : SELECTION.NOVICE_MAX_LEVEL;
    const novice = levels.filter((level) => level <= limit);
    if (novice.length > 0) levels = novice;
  }

  const ideal = input.theta - SELECTION.THETA_OFFSET;
  let index = 0;
  let best = Infinity;
  levels.forEach((level, i) => {
    const distance = Math.abs(LEVEL_DIFFICULTY[level] - ideal);
    if (distance < best) {
      best = distance;
      index = i;
    }
  });
  if (input.lastFailed) index = Math.max(0, index - 1);
  else if (streak >= SELECTION.STREAK_LEAP) index = Math.min(levels.length - 1, index + 2);
  else if (streak >= SELECTION.STREAK_STEP) index = Math.min(levels.length - 1, index + 1);
  return levels[index]!;
}

export interface Candidate {
  id: string;
  kind: ProblemKind;
  levels: readonly Level[];
}

/**
 * Pick a problem family at a level: never the one used last when there is a choice, and
 * the less likely the more recently a family was used, so that problems do not look alike.
 */
export function chooseCandidate<T extends Candidate>(
  candidates: readonly T[],
  level: Level,
  recentIds: readonly string[],
  rng: Rng,
  prefer: readonly ProblemKind[] = [],
): T | null {
  const offered = candidates.filter((candidate) => candidate.levels.includes(level));
  if (offered.length === 0) return null;
  // The family used last among these is left out when there is another: two problems of
  // a skill in a row are never the same kind while the skill has a second kind to offer.
  const lastUsed = offered
    .map((candidate) => ({ id: candidate.id, at: recentIds.lastIndexOf(candidate.id) }))
    .filter((entry) => entry.at >= 0)
    .sort((a, b) => b.at - a.at)[0];
  const atLevel =
    offered.length > 1 && lastUsed ? offered.filter((candidate) => candidate.id !== lastUsed.id) : offered;
  const weighted = atLevel.map((candidate) => {
    const recency = recentIds.lastIndexOf(candidate.id);
    // Not used recently: full weight. Used last: almost none.
    const age = recency < 0 ? recentIds.length + 1 : recentIds.length - recency;
    let weight = recency < 0 ? 4 : Math.max(0.15, age * 0.5 - 0.3);
    if (prefer.includes(candidate.kind)) weight *= 2.5;
    return [candidate, weight] as const;
  });
  return rng.weighted(weighted);
}

/** The level nearest to `wanted` among those a candidate set offers. */
export function nearestAvailableLevel(available: readonly Level[], wanted: Level): Level {
  if (available.length === 0) throw new Error('nearestAvailableLevel: no levels');
  return [...available].sort((a, b) => Math.abs(a - wanted) - Math.abs(b - wanted) || a - b)[0]!;
}
