import type { GoalId } from '@lemma/core';
import { JPZ_EVIDENCE_LINES, JPZ_SITE, JPZ_UNREADABLE_LINES } from './evidence-data';

/**
 * The classified past papers, parsed from the lines in evidence-data.ts, and what follows
 * from them: for each examination, how many points of the papers that were read fall on
 * each skill. That share is the skill's weight in selection and readiness.
 */

export type JpzVariant = 'M9' | 'M7' | 'M5';

export const VARIANT_OF_GOAL: Readonly<Partial<Record<GoalId, JpzVariant>>> = {
  'jpz-9': 'M9',
  'jpz-7': 'M7',
  'jpz-5': 'M5',
};

export type TaskFormat = 'open' | 'construction' | 'truefalse' | 'choice' | 'matching';

const FORMATS: Readonly<Record<string, TaskFormat>> = {
  o: 'open',
  K: 'construction',
  T: 'truefalse',
  C: 'choice',
  M: 'matching',
};

export interface PaperTask {
  n: number;
  points: number;
  format: TaskFormat;
  /** One to three skills; the task's points are split equally among them. */
  skills: string[];
}

export interface Paper {
  /** 'M9-2026-1': variant, year, term (1, 2 regular · N1, N2 substitute · I illustrative). */
  id: string;
  variant: JpzVariant;
  year: number;
  term: string;
  /** Classified by reading every task, or by keyword rules. */
  basis: 'read' | 'rules';
  /** The text that was classified: the booklet, or the official model solution. */
  via: 'booklet' | 'solution';
  /** The official booklet. */
  url: string;
  tasks: PaperTask[];
  points: number;
}

function parsePaper(line: string): Paper {
  const [head, body] = line.split(' | ');
  const [id, basis, via, path] = head!.split(' ');
  const [variant, year, term] = id!.split('-');
  if (!body || !path || (basis !== 'read' && basis !== 'rules') || (via !== 'booklet' && via !== 'solution'))
    throw new Error(`evidence: cannot read the line of ${id}`);
  const tasks = body.split('; ').map((part): PaperTask => {
    const match = /^(\d+)\/(\d+)([oKTCM])=(.+)$/.exec(part);
    if (!match) throw new Error(`evidence: cannot read "${part}" in ${id}`);
    return {
      n: Number(match[1]),
      points: Number(match[2]),
      format: FORMATS[match[3]!]!,
      skills: match[4]!.split('+'),
    };
  });
  return {
    id: id!,
    variant: variant as JpzVariant,
    year: Number(year),
    term: term!,
    basis,
    via,
    url: JPZ_SITE + path,
    tasks,
    points: tasks.reduce((sum, task) => sum + task.points, 0),
  };
}

const nonEmpty = (text: string): string[] =>
  text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '');

export const JPZ_PAPERS: readonly Paper[] = nonEmpty(JPZ_EVIDENCE_LINES).map(parsePaper);

/** Booklets without a text layer: listed so that the documentation can say what was not seen. */
export const JPZ_UNREADABLE: readonly { id: string; url: string }[] = nonEmpty(JPZ_UNREADABLE_LINES).map((line) => {
  const [id, path] = line.split(' ');
  return { id: id!, url: JPZ_SITE + path! };
});

export interface SkillEvidence {
  skill: string;
  /** Points in the papers that were read. */
  readPoints: number;
  readTasks: number;
  /** Tasks in the papers classified by rules. */
  rulesTasks: number;
  /** 'M9-2026-1/7': the read tasks, newest first. */
  refs: string[];
}

export interface VariantEvidence {
  variant: JpzVariant;
  papersRead: number;
  papersByRules: number;
  /** Points of all read papers: the denominator of the weights. */
  readPoints: number;
  skills: Map<string, SkillEvidence>;
}

function collect(variant: JpzVariant): VariantEvidence {
  const papers = JPZ_PAPERS.filter((paper) => paper.variant === variant);
  const skills = new Map<string, SkillEvidence>();
  const entry = (skill: string): SkillEvidence => {
    let found = skills.get(skill);
    if (!found) {
      found = { skill, readPoints: 0, readTasks: 0, rulesTasks: 0, refs: [] };
      skills.set(skill, found);
    }
    return found;
  };
  for (const paper of papers) {
    for (const task of paper.tasks) {
      for (const skill of task.skills) {
        const found = entry(skill);
        if (paper.basis === 'read') {
          found.readPoints += task.points / task.skills.length;
          found.readTasks++;
          found.refs.push(`${paper.id}/${task.n}`);
        } else {
          found.rulesTasks++;
        }
      }
    }
  }
  const read = papers.filter((paper) => paper.basis === 'read');
  return {
    variant,
    papersRead: read.length,
    papersByRules: papers.length - read.length,
    readPoints: read.reduce((sum, paper) => sum + paper.points, 0),
    skills,
  };
}

const EVIDENCE: Readonly<Record<JpzVariant, VariantEvidence>> = {
  M9: collect('M9'),
  M7: collect('M7'),
  M5: collect('M5'),
};

export const evidenceFor = (variant: JpzVariant): VariantEvidence => EVIDENCE[variant];

/** Points by task format in the read papers of a variant: what a practice test must mirror. */
export function formatShares(variant: JpzVariant): Record<TaskFormat, number> {
  const out: Record<TaskFormat, number> = { open: 0, construction: 0, truefalse: 0, choice: 0, matching: 0 };
  const read = JPZ_PAPERS.filter((paper) => paper.variant === variant && paper.basis === 'read');
  const total = read.reduce((sum, paper) => sum + paper.points, 0) || 1;
  for (const paper of read) for (const task of paper.tasks) out[task.format] += task.points / total;
  return out;
}
