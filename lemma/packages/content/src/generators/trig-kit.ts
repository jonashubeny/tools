import { L, frac, type Frac } from '@lemma/core';

/**
 * Shared vocabulary of the trigonometry generators: angles as rational multiples of π,
 * exact values at the standard angles, and equations solved on one turn.
 */

export type Fn = 'sin' | 'cos' | 'tan' | 'cot';

/** Function names as displayed: Czech schools write tg and cotg. */
const NAME: Record<Fn, L> = {
  sin: L('\\sin', '\\sin'),
  cos: L('\\cos', '\\cos'),
  tan: L('\\operatorname{tg}', '\\tan'),
  cot: L('\\operatorname{cotg}', '\\cot'),
};

/** `sin x`, `tg 2x`, … in both languages. */
export const fnL = (fn: Fn, arg: string): L => L(`${NAME[fn].cs} ${arg}`, `${NAME[fn].en} ${arg}`);

/** The function name alone, e.g. for `sin² x`. */
export const fnName = (fn: Fn): L => NAME[fn];

export function evalFn(fn: Fn, x: number): number {
  if (fn === 'sin') return Math.sin(x);
  if (fn === 'cos') return Math.cos(x);
  return fn === 'tan' ? Math.tan(x) : 1 / Math.tan(x);
}

/** The function's name in a sentence. All four are masculine in Czech ("sinus je kladný"). */
export const FN_WORD: Record<Fn, L> = {
  sin: L('sinus', 'sine'),
  cos: L('kosinus', 'cosine'),
  tan: L('tangens', 'tangent'),
  cot: L('kotangens', 'cotangent'),
};

/** Join formulas with "=" in both languages: `chainL([sin 150°, sin 30°, '1/2'])`. */
export function chainL(parts: readonly (L | string)[], separator = ' = '): L {
  const side = (locale: 'cs' | 'en'): string =>
    parts.map((part) => (typeof part === 'string' ? part : part[locale])).join(separator);
  return L(side('cs'), side('en'));
}

/** The co-function: what a learner gets by mixing the two up. */
export const CO: Record<Fn, Fn> = { sin: 'cos', cos: 'sin', tan: 'cot', cot: 'tan' };

// ----------------------------------------------------------------------------- angles

/** An angle of `m`·π radians, written the way a person writes it: 5π/6, −π/3, 2π. */
export function piTex(m: Frac): string {
  if (m.n === 0) return '0';
  const sign = m.n < 0 ? '-' : '';
  const n = Math.abs(m.n);
  const top = n === 1 ? '\\pi' : `${n}\\pi`;
  return m.d === 1 ? `${sign}${top}` : `${sign}\\frac{${top}}{${m.d}}`;
}

/** The same angle as parser input. */
export function piIn(m: Frac): string {
  if (m.n === 0) return '0';
  const top = m.n === 1 ? 'pi' : m.n === -1 ? '-pi' : `${m.n}*pi`;
  return m.d === 1 ? top : `${top}/${m.d}`;
}

export const degOf = (m: Frac): number => (m.n * 180) / m.d;
export const fromDeg = (deg: number): Frac => frac(deg, 180);
export const radOf = (m: Frac): number => (m.n * Math.PI) / m.d;
export const degTex = (deg: number): string => `${deg}^{\\circ}`;

/** A set of angles in radians, in each language's notation. */
export function angleSetL(angles: readonly Frac[]): L {
  if (angles.length === 0) return L('\\emptyset', '\\emptyset');
  const items = angles.map(piTex);
  return L(`\\left\\{${items.join(';\\,')}\\right\\}`, `\\left\\{${items.join(',\\,')}\\right\\}`);
}

/** The interval ⟨0; 2π) in each language's notation. */
export const TURN = L('\\langle 0;\\,2\\pi)', '[0,\\,2\\pi)');

/** The angle brought into ⟨0°; 360°). */
export const basicDeg = (deg: number): number => ((deg % 360) + 360) % 360;

/** 1–4, or 0 when the terminal side lies on an axis. */
export function quadrant(deg: number): 0 | 1 | 2 | 3 | 4 {
  const turn = basicDeg(deg);
  if (turn % 90 === 0) return 0;
  return (Math.floor(turn / 90) + 1) as 1 | 2 | 3 | 4;
}

export const QUADRANT_NAME: Record<1 | 2 | 3 | 4, L> = {
  1: L('I. kvadrant', 'quadrant I'),
  2: L('II. kvadrant', 'quadrant II'),
  3: L('III. kvadrant', 'quadrant III'),
  4: L('IV. kvadrant', 'quadrant IV'),
};

/** "in quadrant II", with the Czech preposition that goes with each numeral. */
export const QUADRANT_IN: Record<1 | 2 | 3 | 4, L> = {
  1: L('v I. kvadrantu', 'in quadrant I'),
  2: L('ve II. kvadrantu', 'in quadrant II'),
  3: L('ve III. kvadrantu', 'in quadrant III'),
  4: L('ve IV. kvadrantu', 'in quadrant IV'),
};

/** Where each function is positive and where negative. */
export function signQuadrants(fn: Fn, positive: boolean): L {
  const pair =
    fn === 'sin'
      ? positive
        ? 'I–II'
        : 'III–IV'
      : fn === 'cos'
        ? positive
          ? 'I–IV'
          : 'II–III'
        : positive
          ? 'I–III'
          : 'II–IV';
  const [first, second] = pair.split('–') as [string, string];
  return L(`v ${first}. a ${second}. kvadrantu`, `in quadrants ${first} and ${second}`);
}

/** The acute angle between the terminal side and the x-axis. */
export function referenceDeg(deg: number): number {
  const turn = basicDeg(deg);
  if (turn <= 90) return turn;
  if (turn <= 180) return 180 - turn;
  return turn <= 270 ? turn - 180 : 360 - turn;
}

/** Multiples of 30° and 45° in one turn. */
export const STANDARD_DEGREES = [0, 30, 45, 60, 90, 120, 135, 150, 180, 210, 225, 240, 270, 300, 315, 330] as const;

// ----------------------------------------------------------------------- exact values

export interface Exact {
  tex: string;
  /** Parser input. */
  input: string;
  value: number;
}

const TABLE: Record<number, Record<Fn, readonly [tex: string, input: string] | null>> = {
  0: { sin: ['0', '0'], cos: ['1', '1'], tan: ['0', '0'], cot: null },
  30: {
    sin: ['\\frac{1}{2}', '1/2'],
    cos: ['\\frac{\\sqrt{3}}{2}', 'sqrt(3)/2'],
    tan: ['\\frac{\\sqrt{3}}{3}', 'sqrt(3)/3'],
    cot: ['\\sqrt{3}', 'sqrt(3)'],
  },
  45: {
    sin: ['\\frac{\\sqrt{2}}{2}', 'sqrt(2)/2'],
    cos: ['\\frac{\\sqrt{2}}{2}', 'sqrt(2)/2'],
    tan: ['1', '1'],
    cot: ['1', '1'],
  },
  60: {
    sin: ['\\frac{\\sqrt{3}}{2}', 'sqrt(3)/2'],
    cos: ['\\frac{1}{2}', '1/2'],
    tan: ['\\sqrt{3}', 'sqrt(3)'],
    cot: ['\\frac{\\sqrt{3}}{3}', 'sqrt(3)/3'],
  },
  90: { sin: ['1', '1'], cos: ['0', '0'], tan: null, cot: ['0', '0'] },
};

/**
 * The exact value of a trigonometric function at a multiple of 30° or 45°.
 * Null where the function is not defined (tg 90°, cotg 0°).
 */
export function exact(fn: Fn, deg: number): Exact | null {
  const entry = TABLE[referenceDeg(deg)]?.[fn];
  if (!entry) return null;
  const raw = evalFn(fn, (basicDeg(deg) * Math.PI) / 180);
  const value = Math.abs(raw) < 1e-9 ? 0 : raw;
  const negative = value < 0;
  return { tex: negative ? `-${entry[0]}` : entry[0], input: negative ? `-${entry[1]}` : entry[1], value };
}

/** Wrap a value for use as a factor or after an operator: negative ones get brackets. */
export const parTex = (value: Exact): string => (value.value < 0 ? `\\left(${value.tex}\\right)` : value.tex);

// -------------------------------------------------------------------------- equations

/**
 * Every multiple of π/24 in ⟨0; 2π) at which `holds` is true. That grid contains every
 * solution of an equation built from the standard angles with the argument x or 2x.
 */
export function solveOnTurn(holds: (x: number) => boolean): Frac[] {
  const out: Frac[] = [];
  for (let k = 0; k < 48; k++) {
    if (holds((k * Math.PI) / 24)) out.push(frac(k, 24));
  }
  return out;
}

/** Is `value` (numerically) equal to `target`? Poles never are. */
export const near = (value: number, target: number): boolean =>
  Number.isFinite(value) && Math.abs(value - target) < 1e-9;
