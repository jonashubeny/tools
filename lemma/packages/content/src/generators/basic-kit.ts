import { L, type ChoiceSpec, type Rng } from '@lemma/core';

/**
 * Shared vocabulary of the lower-secondary generators: numbers written the Czech and the
 * English way, and the three closed formats of the entrance examination.
 */

/** A number with at most `digits` decimals, without float noise or trailing zeros: 2.5, 0.06, 12. */
export function trim(value: number, digits = 4): string {
  const text = value.toFixed(digits);
  return text.includes('.') ? text.replace(/0+$/, '').replace(/\.$/, '') : text;
}

/** Group the digits of a whole part in threes with a thin space, as both languages print them. */
const grouped = (whole: string): string => whole.replace(/\B(?=(\d{3})+(?!\d))/g, '\\,');

/** A number for Czech maths: a decimal comma in braces, the thousands set apart by a thin space. */
export function cs(value: number, digits = 4): string {
  const [whole, fraction] = trim(Math.abs(value), digits).split('.');
  return `${value < 0 ? '-' : ''}${grouped(whole!)}${fraction ? `{,}${fraction}` : ''}`;
}

/** The same number for English maths: decimal point. */
export function en(value: number, digits = 4): string {
  const [whole, fraction] = trim(Math.abs(value), digits).split('.');
  return `${value < 0 ? '-' : ''}${grouped(whole!)}${fraction ? `.${fraction}` : ''}`;
}

/** A number in Czech prose, outside maths: 1 250,5 (with a non-breaking space). */
export function csT(value: number, digits = 4): string {
  const [whole, fraction] = trim(Math.abs(value), digits).split('.');
  return `${value < 0 ? '−' : ''}${whole!.replace(/\B(?=(\d{3})+(?!\d))/g, '\u00a0')}${fraction ? `,${fraction}` : ''}`;
}

/** A number in English prose, outside maths: 1,250.5. */
export function enT(value: number, digits = 4): string {
  const [whole, fraction] = trim(Math.abs(value), digits).split('.');
  return `${value < 0 ? '−' : ''}${whole!.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}${fraction ? `.${fraction}` : ''}`;
}

/** A number as the canonical answer and as parser input: plain, with a decimal point. */
export const ans = (value: number, digits = 4): string => trim(value, digits);

/**
 * Bilingual text built once per language: `both((n) => `$${n(2.5)}$ kg`)`. The formatter
 * writes TeX, so its numbers belong inside `$…$`; in prose use `csT` and `enT`.
 */
export function both(build: (n: (value: number, digits?: number) => string, czech: boolean) => string): L {
  return L(build(cs, true), build(en, false));
}

export { firstFew, plural, zPrep } from './helpers';

/** English plural with a regular "s". */
export const plEn = (count: number, word: string): string => (Math.abs(count) === 1 ? word : `${word}s`);

const LETTERS = ['a', 'b', 'c', 'd', 'e', 'f'] as const;

/**
 * A closed question with `size` options in ascending order, the way the test prints them.
 * `wrong` lists the tempting wrong values first; if they do not suffice — some coincide
 * with the right one or with each other — the rest is filled in around the right value.
 * Returns the specification and, for each wrong value that was used, its option id, so
 * that a misconception can be attached to it.
 */
export function numericChoice(
  r: Rng,
  correct: number,
  wrong: readonly number[],
  render: (value: number) => L,
  size: 5 | 6 = 5,
): { spec: ChoiceSpec; idOf: (value: number) => string | undefined } {
  const values: number[] = [correct];
  // A whole right answer gets whole distractors only: "33.333 kg" would give itself away.
  const whole = Number.isInteger(correct);
  const fresh = (value: number): boolean =>
    Number.isFinite(value) &&
    value > 0 &&
    (!whole || Number.isInteger(value)) &&
    !values.some((v) => Math.abs(v - value) < 1e-9);
  for (const value of wrong) {
    if (values.length < size && fresh(value)) values.push(value);
  }
  // Fill with neighbours on the same grid as the right value.
  const step = Number.isInteger(correct) ? Math.max(1, Math.round(Math.abs(correct) / 10)) : 0.5;
  for (let k = 1; values.length < size && k < 40; k++) {
    for (const candidate of r.shuffle([correct + k * step, correct - k * step])) {
      if (values.length < size && fresh(candidate)) values.push(candidate);
    }
  }
  values.sort((a, b) => a - b);
  const options = values.map((value, index) => ({ id: LETTERS[index]!, text: render(value) }));
  const idOf = (value: number): string | undefined => {
    const index = values.findIndex((v) => Math.abs(v - value) < 1e-9);
    return index >= 0 && Math.abs(value - correct) > 1e-9 ? LETTERS[index] : undefined;
  };
  return {
    spec: {
      kind: 'choice',
      options,
      correct: [LETTERS[values.findIndex((v) => Math.abs(v - correct) < 1e-9)]!],
      fixedOrder: true,
    },
    idOf,
  };
}

/** "Rozhodněte, zda tvrzení platí": a statement that is true or not. */
export function trueFalse(truth: boolean): ChoiceSpec {
  return {
    kind: 'choice',
    options: [
      { id: 'yes', text: L('Ano, platí', 'Yes, it is true') },
      { id: 'no', text: L('Ne, neplatí', 'No, it is not') },
    ],
    correct: [truth ? 'yes' : 'no'],
    fixedOrder: true,
  };
}

/** A table as display maths: a header row and body rows of cells (plain text or maths). */
export function table(header: readonly string[], rows: readonly (readonly string[])[]): string {
  const cell = (text: string): string => (/^[-\d\s.,{}\\]+$/.test(text) ? text : `\\text{${text}}`);
  const line = (cells: readonly string[]): string => cells.map(cell).join(' & ');
  return `$$\\begin{array}{l|${'c'.repeat(header.length - 1)}} ${line(header)} \\\\ \\hline ${rows.map(line).join(' \\\\ ')} \\end{array}$$`;
}

/** Friendly first names for word problems, in pairs that read naturally in both languages. */
export const NAMES = [
  'Adam',
  'Bára',
  'Cyril',
  'Dana',
  'Erik',
  'Filip',
  'Hana',
  'Ivo',
  'Jana',
  'Karel',
  'Lenka',
  'Marek',
  'Nela',
  'Ota',
  'Petra',
  'Radek',
  'Sára',
  'Tomáš',
  'Vendula',
  'Zuzana',
] as const;

export const twoNames = (r: Rng): [string, string] => r.sample(NAMES, 2) as [string, string];
