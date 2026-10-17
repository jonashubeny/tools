import type { Level } from '../content/types';
import { ERROR_FAMILY, type ErrorFamily, type ErrorType } from './errors';

/**
 * Scoring and analysis of a timed exam. The point of the report is not the percentage
 * but what it says about slips versus gaps, time, and what to practise next.
 * See docs/learning-model.md §10.
 */

export interface ExamItemResult {
  skill: string;
  level: Level;
  /** Points available for the item. */
  points: number;
  answered: boolean;
  correct: boolean;
  seconds: number;
  expectedSeconds: number;
  /** Predicted success before the exam, from the learner model. */
  predicted: number;
  /** Inferred or confirmed error type for wrong answers. */
  errorType?: ErrorType | null;
  /** Scored together with the other items of the same bundle (`ExamScoring.bundles`). */
  bundle?: string;
}

/** How an examination scores: the grade scale, and bundles of sub-questions marked together. */
export interface ExamScoring {
  scale?: GradeScale | null;
  /** Points of a bundle by the number of its items answered correctly: [0, 0, 2, 4]. */
  bundles?: Readonly<Record<string, readonly number[]>>;
}

export interface SkillBreakdown {
  skill: string;
  items: number;
  correct: number;
  points: number;
  maxPoints: number;
  /** Mean of seconds / expectedSeconds over the skill's items. */
  pace: number;
}

export interface ExamReport {
  items: number;
  answered: number;
  correct: number;
  points: number;
  maxPoints: number;
  percent: number;
  /** Czech school grade 1–5 according to the configured scale; null if no scale. */
  grade: number | null;
  time: {
    usedSeconds: number;
    limitSeconds: number;
    /** Items that took more than twice the expected time. */
    slowItems: number;
    /** Items left unanswered. */
    unanswered: number;
    /** Wrong answers given in under 35 % of the expected time. */
    rushedWrong: number;
  };
  errors: {
    byFamily: Record<ErrorFamily, number>;
    byType: Partial<Record<ErrorType, number>>;
    /** Points lost to slips: what careful checking alone would have recovered. */
    pointsLostToSlips: number;
    /** Points lost to procedural and conceptual gaps. */
    pointsLostToGaps: number;
  };
  bySkill: SkillBreakdown[];
  strong: string[];
  weak: string[];
  /** Ranked follow-up: skills ordered by points lost. */
  next: { skill: string; lost: number; mostly: ErrorFamily | 'unanswered' }[];
}

/** Lower bounds (percent) for grades 1–4; anything below the last is a 5. */
export type GradeScale = readonly [number, number, number, number];

/** A commonly used scale. Teachers differ — it is configurable in School settings. */
export const DEFAULT_GRADE_SCALE: GradeScale = [90, 75, 50, 30];

export function gradeFor(percent: number, scale: GradeScale | null): number | null {
  if (!scale) return null;
  for (let i = 0; i < scale.length; i++) if (percent >= scale[i]!) return i + 1;
  return 5;
}

/**
 * What each item is worth and earned. A loose item is all or nothing. The items of a
 * bundle share its points: the bundle's score depends on how many of them are right
 * (three true/false statements: 4, 2, 0, 0 points), and is spread over the right ones.
 */
export function itemPoints(
  results: readonly ExamItemResult[],
  bundles: Readonly<Record<string, readonly number[]>>,
): { max: number; earned: number }[] {
  const groups = new Map<string, { size: number; right: number }>();
  for (const r of results) {
    if (!r.bundle || !bundles[r.bundle]) continue;
    const group = groups.get(r.bundle) ?? { size: 0, right: 0 };
    group.size++;
    if (r.correct) group.right++;
    groups.set(r.bundle, group);
  }
  return results.map((r) => {
    const table = r.bundle ? bundles[r.bundle] : undefined;
    const group = r.bundle ? groups.get(r.bundle) : undefined;
    if (!table || !group) return { max: r.points, earned: r.correct ? r.points : 0 };
    const top = table[table.length - 1] ?? 0;
    const scored = table[Math.min(group.right, table.length - 1)] ?? 0;
    return { max: top / group.size, earned: r.correct && group.right > 0 ? scored / group.right : 0 };
  });
}

export function examReport(
  results: readonly ExamItemResult[],
  limitSeconds: number,
  scoring: GradeScale | null | ExamScoring = DEFAULT_GRADE_SCALE,
): ExamReport {
  const options: ExamScoring =
    scoring === null || Array.isArray(scoring) ? { scale: scoring as GradeScale | null } : (scoring as ExamScoring);
  const scale = options.scale === undefined ? DEFAULT_GRADE_SCALE : options.scale;
  const worth = itemPoints(results, options.bundles ?? {});
  const round = (value: number): number => Math.round(value * 100) / 100;
  const maxPoints = round(worth.reduce((sum, w) => sum + w.max, 0));
  const points = round(worth.reduce((sum, w) => sum + w.earned, 0));
  const percent = maxPoints === 0 ? 0 : Math.round((points / maxPoints) * 1000) / 10;

  const byFamily: Record<ErrorFamily, number> = { slip: 0, procedure: 0, concept: 0 };
  const byType: Partial<Record<ErrorType, number>> = {};
  let pointsLostToSlips = 0;
  let pointsLostToGaps = 0;
  let rushedWrong = 0;

  const skills = new Map<
    string,
    SkillBreakdown & { paceSum: number; lost: number; families: Record<string, number> }
  >();

  for (const [index, r] of results.entries()) {
    const { max, earned } = worth[index]!;
    let entry = skills.get(r.skill);
    if (!entry) {
      entry = {
        skill: r.skill,
        items: 0,
        correct: 0,
        points: 0,
        maxPoints: 0,
        pace: 0,
        paceSum: 0,
        lost: 0,
        families: {},
      };
      skills.set(r.skill, entry);
    }
    entry.items++;
    entry.maxPoints += max;
    entry.paceSum += r.expectedSeconds > 0 ? r.seconds / r.expectedSeconds : 1;
    entry.points += earned;
    if (r.correct) {
      entry.correct++;
      // In a bundle a right answer can still earn less than its share.
      entry.lost += max - earned;
      continue;
    }
    entry.lost += max;
    if (!r.answered) {
      entry.families.unanswered = (entry.families.unanswered ?? 0) + max;
      pointsLostToGaps += max;
      continue;
    }
    // Without a confirmed type, fall back on the model: failing something that was
    // predicted to succeed is most likely a slip.
    const type: ErrorType = r.errorType ?? (r.predicted >= 0.75 ? 'arithmetic' : 'concept');
    const family = ERROR_FAMILY[type];
    byFamily[family]++;
    byType[type] = (byType[type] ?? 0) + 1;
    entry.families[family] = (entry.families[family] ?? 0) + max;
    if (family === 'slip') pointsLostToSlips += max;
    else pointsLostToGaps += max;
    if (r.expectedSeconds > 0 && r.seconds / r.expectedSeconds < 0.35) rushedWrong++;
  }

  const bySkill: SkillBreakdown[] = [...skills.values()].map((entry) => ({
    skill: entry.skill,
    items: entry.items,
    correct: entry.correct,
    points: round(entry.points),
    maxPoints: round(entry.maxPoints),
    pace: Math.round((entry.paceSum / entry.items) * 100) / 100,
  }));

  const next = [...skills.values()]
    .filter((entry) => entry.lost > 0)
    .sort((a, b) => b.lost - a.lost)
    .map((entry) => {
      const mostly = Object.entries(entry.families).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'concept';
      return { skill: entry.skill, lost: round(entry.lost), mostly: mostly as ErrorFamily | 'unanswered' };
    });

  return {
    items: results.length,
    answered: results.filter((r) => r.answered).length,
    correct: results.filter((r) => r.correct).length,
    points,
    maxPoints,
    percent,
    grade: gradeFor(percent, scale),
    time: {
      usedSeconds: Math.round(results.reduce((sum, r) => sum + r.seconds, 0)),
      limitSeconds,
      slowItems: results.filter((r) => r.expectedSeconds > 0 && r.seconds > 2 * r.expectedSeconds).length,
      unanswered: results.filter((r) => !r.answered).length,
      rushedWrong,
    },
    errors: {
      byFamily,
      byType,
      pointsLostToSlips: round(pointsLostToSlips),
      pointsLostToGaps: round(pointsLostToGaps),
    },
    bySkill,
    strong: bySkill.filter((s) => s.correct === s.items).map((s) => s.skill),
    weak: bySkill.filter((s) => s.correct === 0).map((s) => s.skill),
    next,
  };
}

/** Distribute `count` items over levels according to a mix of shares. */
export function levelsForMix(count: number, mix: Partial<Record<Level, number>>): Level[] {
  const entries = (Object.entries(mix) as [string, number][])
    .map(([level, share]) => [Number(level) as Level, share] as const)
    .filter(([, share]) => share > 0)
    .sort((a, b) => a[0] - b[0]);
  if (entries.length === 0) return Array.from({ length: count }, () => 2 as Level);
  const total = entries.reduce((sum, [, share]) => sum + share, 0);
  const exact = entries.map(([level, share]) => ({ level, exact: (share / total) * count }));
  const out = exact.map((e) => ({ level: e.level, n: Math.floor(e.exact), frac: e.exact - Math.floor(e.exact) }));
  let assigned = out.reduce((sum, e) => sum + e.n, 0);
  // Largest remainders get the leftover items.
  for (const entry of [...out].sort((a, b) => b.frac - a.frac)) {
    if (assigned >= count) break;
    entry.n++;
    assigned++;
  }
  return out.flatMap((entry) => Array.from({ length: entry.n }, () => entry.level));
}
