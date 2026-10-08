import { addDays, dayRange, weekStart } from '../time';
import { STREAK } from './constants';

/**
 * Habit metrics. Consistency (active days out of the last 28) is the headline; the streak
 * is secondary and forgiving. See docs/learning-model.md §9.
 *
 * Design rules encoded here:
 *  - today never breaks anything: an inactive today is simply "not yet";
 *  - a missed day spends a banked rest day automatically;
 *  - a declared pause is skipped entirely — it neither counts nor breaks.
 */

export interface Pause {
  /** First and last study day of the pause, inclusive. */
  from: string;
  to: string;
}

export interface StreakInput {
  /** Activity score per study day; days without activity may be absent. */
  scores: ReadonlyMap<string, number>;
  today: string;
  pauses?: readonly Pause[];
  activeThreshold?: number;
  weekGoal?: number;
}

export interface StreakSummary {
  /** Consecutive active days, with rest days and pauses bridging gaps. */
  current: number;
  longest: number;
  /** Rest days currently banked. */
  restDays: number;
  /** Days on which a rest day was spent, most recent last. */
  restDaysUsed: string[];
  activeToday: boolean;
  /** Active days in the window, and the window size excluding paused days. */
  consistency: { active: number; days: number };
  /** Consecutive weeks (Monday–Sunday) that reached the weekly goal. */
  weekRhythm: number;
  thisWeek: { active: number; goal: number };
  totalActiveDays: number;
  lastActiveDay: string | null;
  /** Active days still needed for the next rest day. */
  nextRestIn: number;
}

function inPause(day: string, pauses: readonly Pause[]): boolean {
  return pauses.some((pause) => day >= pause.from && day <= pause.to);
}

export function computeStreak(input: StreakInput): StreakSummary {
  const threshold = input.activeThreshold ?? STREAK.ACTIVE_THRESHOLD;
  const weekGoal = input.weekGoal ?? STREAK.WEEK_GOAL;
  const pauses = input.pauses ?? [];
  const { today } = input;
  const isActive = (day: string): boolean => (input.scores.get(day) ?? 0) >= threshold;

  const activeDays = [...input.scores.keys()].filter((day) => day <= today && isActive(day)).sort();
  const firstDay = activeDays[0] ?? null;

  let run = 0;
  let longest = 0;
  let bank = 0;
  let sinceEarn = 0;
  const restDaysUsed: string[] = [];

  if (firstDay) {
    for (const day of dayRange(firstDay, today)) {
      if (isActive(day)) {
        run++;
        longest = Math.max(longest, run);
        sinceEarn++;
        if (sinceEarn >= STREAK.REST_EARN_EVERY) {
          if (bank < STREAK.REST_CAP) bank++;
          sinceEarn = 0;
        }
        continue;
      }
      if (day === today || inPause(day, pauses)) continue;
      if (run > 0 && bank > 0) {
        bank--;
        restDaysUsed.push(day);
      } else {
        run = 0;
        sinceEarn = 0;
      }
    }
  }

  // Consistency over the last N days, not counting paused days against the learner.
  const windowStart = addDays(today, -(STREAK.CONSISTENCY_WINDOW - 1));
  let windowActive = 0;
  let windowDays = 0;
  for (const day of dayRange(windowStart, today)) {
    if (isActive(day)) {
      windowActive++;
      windowDays++;
    } else if (!inPause(day, pauses)) {
      windowDays++;
    }
  }

  // Week rhythm: walk back over complete weeks; a mostly-paused week is skipped.
  const activeInWeek = (start: string): number =>
    dayRange(start, addDays(start, 6)).filter((day) => day <= today && isActive(day)).length;
  const pausedInWeek = (start: string): number =>
    dayRange(start, addDays(start, 6)).filter((day) => inPause(day, pauses)).length;
  const currentWeek = weekStart(today);
  const thisWeekActive = activeInWeek(currentWeek);
  let weekRhythm = thisWeekActive >= weekGoal ? 1 : 0;
  if (firstDay) {
    const firstWeek = weekStart(firstDay);
    for (let week = addDays(currentWeek, -7); week >= firstWeek; week = addDays(week, -7)) {
      if (activeInWeek(week) >= weekGoal) weekRhythm++;
      else if (pausedInWeek(week) >= 4) continue;
      else break;
    }
  }

  return {
    current: run,
    longest,
    restDays: bank,
    restDaysUsed,
    activeToday: isActive(today),
    consistency: { active: windowActive, days: windowDays },
    weekRhythm,
    thisWeek: { active: thisWeekActive, goal: weekGoal },
    totalActiveDays: activeDays.length,
    lastActiveDay: activeDays[activeDays.length - 1] ?? null,
    nextRestIn: bank >= STREAK.REST_CAP ? 0 : STREAK.REST_EARN_EVERY - sinceEarn,
  };
}
