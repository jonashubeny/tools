import type { Level } from '../content/types';
import { PLACEMENT } from './constants';
import { type SkillState, emptySkillState } from './mastery';

/**
 * What a diagnostic says about the skills it did not ask.
 *
 * A placement test cannot ask everything. Solving a standard problem on linear equations
 * says something about fractions and negative numbers too; failing a problem on fractions
 * says something about percent. This module turns one diagnostic result into cautious
 * priors for the neighbouring skills — and only for skills without evidence of their own.
 * See docs/learning-model.md §13.
 *
 * Pure, and a function of the log alone: replaying the log rebuilds the same placements.
 */

export interface SkillGraph {
  prereqs: (skill: string) => readonly string[];
  dependents: (skill: string) => readonly string[];
}

export interface PlacementSignal {
  skill: string;
  theta: number;
  /** 'up': presumed known because something built on it was solved; 'down': the reverse. */
  direction: 'up' | 'down';
}

/** Every skill within `depth` steps of `start` along `next`, with its distance; nearest first. */
function reach(start: string, next: (skill: string) => readonly string[], depth: number): Map<string, number> {
  const seen = new Map<string, number>();
  let frontier = [start];
  for (let distance = 1; distance <= depth && frontier.length > 0; distance++) {
    const following: string[] = [];
    for (const skill of frontier) {
      for (const neighbour of next(skill)) {
        if (neighbour === start || seen.has(neighbour)) continue;
        seen.set(neighbour, distance);
        following.push(neighbour);
      }
    }
    frontier = following;
  }
  return seen;
}

/** The priors one diagnostic result suggests for the skills around it. */
export function placementSignals(
  graph: SkillGraph,
  result: { skill: string; level: Level; unaided: boolean; solved: boolean },
): PlacementSignal[] {
  const out: PlacementSignal[] = [];
  if (result.unaided && result.level >= 2) {
    const base = result.level >= 3 ? PLACEMENT.UP_STRONG : PLACEMENT.UP_STANDARD;
    for (const [skill, distance] of reach(result.skill, graph.prereqs, PLACEMENT.UP_DEPTH)) {
      out.push({ skill, theta: base * PLACEMENT.DECAY ** (distance - 1), direction: 'up' });
    }
  } else if (!result.solved && result.level <= PLACEMENT.DOWN_MAX_LEVEL) {
    // Missing a harder problem says the skill is not strong; it does not say what builds on it is missing.
    for (const [skill, distance] of reach(result.skill, graph.dependents, PLACEMENT.DOWN_DEPTH)) {
      out.push({ skill, theta: PLACEMENT.DOWN * PLACEMENT.DECAY ** (distance - 1), direction: 'down' });
    }
  }
  return out;
}

/**
 * Fold a signal into a skill's state. Only a skill without attempts takes it: evidence of
 * its own always wins. Among signals, an "up" keeps the highest and a "down" the lowest,
 * and a "down" overrides an "up" — a miss is the more cautious reading.
 */
export function applyPlacement(prev: SkillState | undefined, signal: PlacementSignal, at: number): SkillState | null {
  if (prev && prev.attempts > 0) return null;
  const state = prev ?? emptySkillState(signal.skill);
  const current = state.placement?.theta;
  let theta: number;
  if (current === undefined) theta = signal.theta;
  else if (signal.direction === 'down') theta = Math.min(current, signal.theta);
  else if (current < 0) return null;
  else theta = Math.max(current, signal.theta);
  if (current === theta) return null;
  return { ...state, theta, placement: { theta, at } };
}

/** Never practised, but a diagnostic makes it likely that the skill is there. */
export const presumedKnown = (state: SkillState | undefined): boolean =>
  state !== undefined &&
  state.attempts === 0 &&
  state.placement !== null &&
  state.placement.theta >= PLACEMENT.PRESUMED_OK;
