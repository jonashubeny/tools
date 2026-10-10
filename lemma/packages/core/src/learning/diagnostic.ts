import type { Level } from '../content/types';
import { DIAGNOSTIC } from './constants';

/**
 * The placement test: which problem to ask next, given the answers so far.
 *
 * First one standard problem on each anchor skill of the goal — a broad sweep. Then
 * follow-ups decided by the results: after a miss, a second and easier problem on the same
 * skill, because one wrong answer settles nothing; after a second miss, one prerequisite,
 * to see how far down the gap goes; after a success, one harder problem, to tell
 * "standard" from "strong". Misses are followed up before successes, so that a short
 * test spends its problems where the gaps are.
 *
 * Pure: a function of the configuration and the list of answers.
 * See docs/learning-model.md §13.
 */

export type DiagnosticStage = 'anchor' | 'second-chance' | 'prerequisite' | 'harder';
export type DiagnosticOutcome = 'correct' | 'wrong' | 'skipped';

export interface DiagnosticItem {
  skill: string;
  level: Level;
  stage: DiagnosticStage;
  /** The anchor this problem follows up. */
  anchor: string;
}

export interface DiagnosticAnswer extends DiagnosticItem {
  outcome: DiagnosticOutcome;
}

export interface DiagnosticConfig {
  anchors: readonly string[];
  /** Direct prerequisites of a skill that can be asked; the one to probe first comes first. */
  prereqs: (skill: string) => readonly string[];
  /** Levels at which a skill has problems, ascending. */
  levelsOf: (skill: string) => readonly Level[];
  maxItems?: number;
}

/** The level nearest to the wanted one that the skill has. */
function nearest(levels: readonly Level[], wanted: number): Level | null {
  if (levels.length === 0) return null;
  return [...levels].sort((a, b) => Math.abs(a - wanted) - Math.abs(b - wanted) || a - b)[0]!;
}

const missed = (answer: DiagnosticAnswer): boolean => answer.outcome !== 'correct';

/** Every problem the answers so far call for, in the order they should be asked. */
export function diagnosticQueue(config: DiagnosticConfig, answers: readonly DiagnosticAnswer[]): DiagnosticItem[] {
  const queue: DiagnosticItem[] = [];
  const asked = new Set(answers.map((answer) => `${answer.stage}:${answer.anchor}`));
  const tested = new Set(answers.map((answer) => answer.skill));
  const of = (anchor: string, stage: DiagnosticStage): DiagnosticAnswer | undefined =>
    answers.find((answer) => answer.anchor === anchor && answer.stage === stage);

  for (const anchor of config.anchors) {
    if (asked.has(`anchor:${anchor}`)) continue;
    const level = nearest(config.levelsOf(anchor), DIAGNOSTIC.ANCHOR_LEVEL);
    if (level !== null) queue.push({ skill: anchor, level, stage: 'anchor', anchor });
  }
  if (queue.length > 0) return queue;

  const laterMisses: DiagnosticItem[] = [];
  const harder: DiagnosticItem[] = [];
  for (const anchor of config.anchors) {
    const first = of(anchor, 'anchor');
    if (!first) continue;
    if (missed(first)) {
      const second = of(anchor, 'second-chance');
      if (!second) {
        const level = nearest(config.levelsOf(anchor), DIAGNOSTIC.SECOND_CHANCE_LEVEL);
        if (level !== null) queue.push({ skill: anchor, level, stage: 'second-chance', anchor });
      } else if (missed(second) && !asked.has(`prerequisite:${anchor}`)) {
        // Twice missed: look one step down, at a prerequisite not asked yet.
        const pre = config.prereqs(anchor).find((id) => !tested.has(id) && config.levelsOf(id).length > 0);
        const level = pre ? nearest(config.levelsOf(pre), DIAGNOSTIC.ANCHOR_LEVEL) : null;
        if (pre && level !== null) laterMisses.push({ skill: pre, level, stage: 'prerequisite', anchor });
      }
    } else if (!asked.has(`harder:${anchor}`)) {
      const levels = config.levelsOf(anchor).filter((level) => level > first.level);
      const level = nearest(levels, DIAGNOSTIC.HARDER_LEVEL);
      if (level !== null) harder.push({ skill: anchor, level, stage: 'harder', anchor });
    }
  }
  return [...queue, ...laterMisses, ...harder];
}

/** The next problem, or null when the test is over. */
export function nextDiagnosticItem(
  config: DiagnosticConfig,
  answers: readonly DiagnosticAnswer[],
): DiagnosticItem | null {
  if (answers.length >= (config.maxItems ?? DIAGNOSTIC.MAX_ITEMS)) return null;
  return diagnosticQueue(config, answers)[0] ?? null;
}

export type DiagnosticVerdict =
  | 'strong' // the standard problem and the harder one
  | 'sound' // the standard problem; the harder one missed or not asked
  | 'shaky' // missed at first, solved the easier one
  | 'gap' // missed twice
  | 'untested';

/** What the test found about one anchor skill. */
export function verdictFor(anchor: string, answers: readonly DiagnosticAnswer[]): DiagnosticVerdict {
  const of = (stage: DiagnosticStage): DiagnosticAnswer | undefined =>
    answers.find((answer) => answer.anchor === anchor && answer.stage === stage);
  const first = of('anchor');
  if (!first) return 'untested';
  if (!missed(first)) return of('harder')?.outcome === 'correct' ? 'strong' : 'sound';
  const second = of('second-chance');
  if (!second) return 'shaky';
  return missed(second) ? 'gap' : 'shaky';
}
