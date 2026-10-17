import {
  L,
  classifyMisconception,
  type ErrorType,
  type Generator,
  type Level,
  type Misconception,
  type ProblemInstance,
  type ProblemKind,
  type Rng,
  type SolutionStep,
} from '@lemma/core';

/**
 * Authoring helpers for problem generators.
 *
 * A generator must be deterministic: all randomness comes from the `Rng` it is given.
 * Build problems "answer first" — choose the roots, the vertex, the slope — and derive
 * the question from them. That keeps numbers friendly and the canonical answer right by
 * construction; the `verify` specs then check it independently.
 */

export interface GeneratorDefinition {
  id: string;
  concept: string;
  kind: ProblemKind;
  levels: Level[];
  title: L;
  tags?: string[];
  /** Expected seconds: a number, or a function of the level. */
  est: number | ((level: Level) => number);
  make: (r: Rng, level: Level) => ProblemInstance;
}

/**
 * Drop misconceptions that, for this particular set of random parameters, coincide with
 * the correct answer or with each other (e.g. a "sign error" when the value is zero).
 */
function cleanMisconceptions(instance: ProblemInstance): ProblemInstance {
  if (!instance.misconceptions || instance.misconceptions.length === 0) return instance;
  const kept: Misconception[] = [];
  for (const candidate of instance.misconceptions) {
    if (classifyMisconception(instance.answer, candidate.answer, kept) === 'distinct') kept.push(candidate);
  }
  return { ...instance, misconceptions: kept };
}

/** Misconceptions that could never match anything: their answer does not parse. */
function auditMisconceptions(instance: ProblemInstance): string[] {
  return (instance.misconceptions ?? [])
    .filter((candidate) => classifyMisconception(instance.answer, candidate.answer) === 'unparseable')
    .map(
      (candidate) =>
        `misconception "${candidate.answer}" is not a readable answer for a ${instance.answer.kind} problem`,
    );
}

export function gen(def: GeneratorDefinition): Generator {
  const estSeconds = typeof def.est === 'number' ? () => def.est as number : def.est;
  return {
    id: def.id,
    concept: def.concept,
    kind: def.kind,
    levels: def.levels,
    title: def.title,
    tags: def.tags,
    estSeconds,
    generate: (rng, level) => cleanMisconceptions(def.make(rng, level)),
    audit: (rng, level) => auditMisconceptions(def.make(rng, level)),
  };
}

/** A solution step: explanation in both languages, optionally with display maths. */
export const step = (cs: string, en: string, math?: string | L): SolutionStep => ({ text: L(cs, en), math });

/** Apply the same wrapper to both languages of a bilingual formula: `mapL(interval, (s) => `D(f) = ${s}`)`. */
export const mapL = (text: L, wrap: (value: string) => string): L => L(wrap(text.cs), wrap(text.en));

/** A specific wrong answer and what causes it. */
export const mc = (answer: string, error: ErrorType, cs: string, en: string, skill?: string): Misconception => ({
  answer,
  error,
  note: L(cs, en),
  skill,
});

/** A non-zero integer in [min, max]. */
export const nz = (r: Rng, min: number, max: number): number => r.intExcept(min, max, [0]);

/** `count` distinct integers in [min, max], avoiding `except`. */
export function distinct(r: Rng, min: number, max: number, count: number, except: readonly number[] = []): number[] {
  const out: number[] = [];
  while (out.length < count) out.push(r.intExcept(min, max, [...except, ...out]));
  return out;
}

/** Pick one of several variants by level: `byLevel(level, a, b, c)` → a for 1, b for 2, … */
export function byLevel<T>(level: Level, ...variants: T[]): T {
  return variants[Math.min(level, variants.length) - 1]!;
}

/** Reusable hint fragments. */
export const HINT = {
  check: L(
    'Než odpověď odešleš, dosaď ji zpět do zadání.',
    'Before submitting, substitute your answer back into the problem.',
  ),
  sketch: L('Načrtni si graf — stačí od ruky.', 'Sketch the graph — freehand is enough.'),
  conditions: L(
    'Nejdřív si napiš podmínky. Pro která $x$ má výraz vůbec smysl?',
    'Write down the conditions first. For which $x$ does the expression make sense at all?',
  ),
  brackets: L('Záporné číslo dosazuj vždy v závorce.', 'Always substitute a negative number inside brackets.'),
};

/**
 * The Czech form of a counted word: `plural(5, 'koruna', 'koruny', 'korun')`. One takes the
 * singular, two to four the nominative plural, five and more the genitive plural — and a
 * verb or an adjective beside the noun changes with it: `plural(n, 'je', 'jsou', 'je')`.
 */
export function plural(count: number, one: string, few: string, many: string): string {
  const n = Math.abs(count);
  if (n === 1) return one;
  if (n >= 2 && n <= 4) return few;
  return many;
}

/**
 * "The first few" in Czech, where the adjective follows the numeral as well: "první korálek",
 * "první 3 korálky", "prvních 5 korálků".
 */
export function firstFew(count: number, one: string, few: string, many: string): string {
  if (count === 1) return `první ${one}`;
  return count >= 2 && count <= 4 ? `první ${count} ${few}` : `prvních ${count} ${many}`;
}

/**
 * The Czech preposition "z" in front of a number written in digits: "ze 3", "z 5",
 * "ze 17", "z 20". It follows how the number is read aloud (ze tří, z pěti, ze sedmnácti).
 */
export function zPrep(count: number): 'z' | 'ze' {
  const n = Math.abs(Math.round(count));
  if (n >= 100) return [1, 2, 3, 4, 6, 7].includes(Math.floor(n / 100) % 10) ? 'ze' : 'z';
  if (n >= 20) return [3, 4, 6, 7].includes(Math.floor(n / 10)) ? 'ze' : 'z';
  return [2, 3, 4, 6, 7, 13, 14, 16, 17].includes(n) ? 'ze' : 'z';
}

/** Wrap a number for display inside a product or power: (-3) but 3. */
export const par = (n: number): string => (n < 0 ? `(${n})` : `${n}`);

/** "x − 3", "x + 3" or "x": the variable shifted by −m, for writing (x − m). */
export function shiftTex(m: number, variable = 'x'): string {
  if (m === 0) return variable;
  return m > 0 ? `${variable} - ${m}` : `${variable} + ${-m}`;
}

/** The same shift as parser input. */
export function shiftIn(m: number, variable = 'x'): string {
  if (m === 0) return variable;
  return m > 0 ? `${variable}-${m}` : `${variable}+${-m}`;
}

/** " + 3", " - 3" or "": a trailing constant term. */
export function tailTex(n: number): string {
  if (n === 0) return '';
  return n > 0 ? ` + ${n}` : ` - ${-n}`;
}

export function tailIn(n: number): string {
  if (n === 0) return '';
  return n > 0 ? `+${n}` : `-${-n}`;
}

/** A leading coefficient before a bracket or variable: "", "-", "2", "-3". */
export function leadTex(a: number): string {
  if (a === 1) return '';
  if (a === -1) return '-';
  return `${a}`;
}

export function leadIn(a: number): string {
  if (a === 1) return '';
  if (a === -1) return '-';
  return `${a}*`;
}
