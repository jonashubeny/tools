import type { Level } from '../content/types';
import { ACTIVITY, HEAT_LEVELS } from './constants';

/**
 * Activity scoring: what the contribution heatmap counts.
 *
 * The score rewards meaningful learning events, not clicks or minutes. Nothing is awarded
 * for time alone, and easy problems stop counting after a daily cap, so the number cannot
 * be farmed. See docs/learning-model.md §9.
 */

export type ActivityType =
  | 'problem' // a problem was resolved
  | 'lesson_step'
  | 'lesson_done'
  | 'level_up'
  | 'exam'
  | 'lab'
  | 'mission';

/** One entry of the append-only activity log, reduced to what scoring needs. */
export interface ActivityRecord {
  type: ActivityType;
  /** Study day, "YYYY-MM-DD". */
  day: string;
  at: number;
  /** Points awarded when the event happened (before daily caps). */
  points: number;
  /** For problems: the difficulty level. */
  level?: Level;
  /** For lab events: which tool, so each counts once per day. */
  tool?: string;
}

export interface ProblemOutcome {
  solved: boolean;
  /** At least one answer was submitted (as opposed to giving up straight away). */
  attempted?: boolean;
  unaided: boolean;
  level: Level;
  /** Wrong first, then corrected without revealing the solution. */
  corrected: boolean;
  /** Counted as a passed scheduled review. */
  reviewPassed: boolean;
}

export function pointsForProblem(outcome: ProblemOutcome): number {
  // Honest work on a problem that did not come out is still work; giving up unseen is not.
  if (!outcome.solved) return outcome.attempted ? ACTIVITY.ATTEMPTED : 0;
  let points = outcome.unaided
    ? ACTIVITY.SOLVED_UNAIDED_BASE + outcome.level
    : ACTIVITY.SOLVED_HELPED_BASE + Math.floor(outcome.level / 2);
  if (outcome.corrected) points += ACTIVITY.ERROR_CORRECTED;
  if (outcome.reviewPassed) points += ACTIVITY.REVIEW_BONUS;
  return points;
}

export function pointsForExam(scorePercent: number): number {
  return ACTIVITY.EXAM_BASE + Math.round(Math.max(0, Math.min(100, scorePercent)) / 10);
}

export const POINTS = {
  lessonStep: ACTIVITY.LESSON_STEP,
  lessonDone: ACTIVITY.LESSON_DONE,
  levelUp: ACTIVITY.LEVEL_UP,
  lab: ACTIVITY.LAB,
  missionMilestone: ACTIVITY.MISSION_MILESTONE,
} as const;

/** The score of one day, with the daily caps applied. */
export function dayScore(records: readonly ActivityRecord[]): number {
  let total = 0;
  let warmups = 0;
  const labTools = new Set<string>();
  for (const record of [...records].sort((a, b) => a.at - b.at)) {
    if (record.type === 'problem' && record.level === 1 && record.points > 0) {
      warmups++;
      if (warmups > ACTIVITY.WARMUP_DAILY_CAP) continue;
    }
    if (record.type === 'lab') {
      const tool = record.tool ?? '';
      if (labTools.has(tool)) continue;
      labTools.add(tool);
    }
    total += record.points;
  }
  return total;
}

/** Scores per day for a whole log. */
export function scoresByDay(records: readonly ActivityRecord[]): Map<string, number> {
  const byDay = new Map<string, ActivityRecord[]>();
  for (const record of records) {
    const list = byDay.get(record.day);
    if (list) list.push(record);
    else byDay.set(record.day, [record]);
  }
  const scores = new Map<string, number>();
  for (const [day, list] of byDay) scores.set(day, dayScore(list));
  return scores;
}

/** Heatmap intensity 0–4 for a day's score. */
export function heatLevel(score: number): 0 | 1 | 2 | 3 | 4 {
  let level = 0;
  for (const threshold of HEAT_LEVELS) if (score >= threshold) level++;
  return level as 0 | 1 | 2 | 3 | 4;
}
