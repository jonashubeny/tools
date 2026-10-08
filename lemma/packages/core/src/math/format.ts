import { L } from '../i18n';
import { type Frac, fToInput, fToTex, frac } from './frac';

/**
 * Formatting helpers for content authors. Each produces either LaTeX for display or a
 * plain string the answer parser can read back — generators need both.
 */

export type Coef = number | Frac;

const asFrac = (c: Coef): Frac => (typeof c === 'number' ? toFrac(c) : c);

/** Convert a number to a fraction; non-integers are approximated to thousandths. */
export function toFrac(value: number): Frac {
  if (Number.isInteger(value)) return frac(value);
  return frac(Math.round(value * 1000), 1000);
}

/** A number in LaTeX; negative values are NOT parenthesised. */
export function nTex(c: Coef): string {
  return fToTex(asFrac(c));
}

/** A number in LaTeX, parenthesised when negative: for substituting into formulas. */
export function pTex(c: Coef): string {
  const f = asFrac(c);
  return f.n < 0 ? `\\left(${fToTex(f)}\\right)` : fToTex(f);
}

/** A number as parser input. */
export function nIn(c: Coef): string {
  return fToInput(asFrac(c));
}

/** "+ 3" / "- 3" — a term continuing an expression. */
export function signedTex(c: Coef): string {
  const f = asFrac(c);
  return f.n < 0 ? `- ${fToTex({ n: -f.n, d: f.d })}` : `+ ${fToTex(f)}`;
}

interface PolyOptions {
  variable?: string;
}

/**
 * A polynomial from coefficients in descending order: [1, -4, 3] → x^2 - 4x + 3.
 * Zero terms are dropped and coefficients ±1 are not written.
 */
export function polyTex(coeffs: readonly Coef[], options: PolyOptions = {}): string {
  const x = options.variable ?? 'x';
  const degree = coeffs.length - 1;
  let out = '';
  coeffs.forEach((raw, index) => {
    const c = asFrac(raw);
    if (c.n === 0) return;
    const power = degree - index;
    const magnitude: Frac = { n: Math.abs(c.n), d: c.d };
    const isOne = magnitude.n === 1 && magnitude.d === 1;
    const variablePart = power === 0 ? '' : power === 1 ? x : `${x}^{${power}}`;
    const body = power === 0 ? fToTex(magnitude) : `${isOne ? '' : fToTex(magnitude)}${variablePart}`;
    if (out === '') out = c.n < 0 ? `-${body}` : body;
    else out += c.n < 0 ? ` - ${body}` : ` + ${body}`;
  });
  return out === '' ? '0' : out;
}

/** The same polynomial as parser input: x^2-4x+3. */
export function polyIn(coeffs: readonly Coef[], options: PolyOptions = {}): string {
  const x = options.variable ?? 'x';
  const degree = coeffs.length - 1;
  let out = '';
  coeffs.forEach((raw, index) => {
    const c = asFrac(raw);
    if (c.n === 0) return;
    const power = degree - index;
    const magnitude: Frac = { n: Math.abs(c.n), d: c.d };
    const isOne = magnitude.n === 1 && magnitude.d === 1;
    const coefText = magnitude.d === 1 ? String(magnitude.n) : `(${magnitude.n}/${magnitude.d})`;
    const variablePart = power === 0 ? '' : power === 1 ? x : `${x}^${power}`;
    const body = power === 0 ? coefText : `${isOne ? '' : `${coefText}*`}${variablePart}`;
    if (out === '') out = c.n < 0 ? `-${body}` : body;
    else out += c.n < 0 ? `-${body}` : `+${body}`;
  });
  return out === '' ? '0' : out;
}

/** (x - 3) or (x + 3) for a root r: the linear factor x − r. */
export function factorTex(root: Coef, variable = 'x'): string {
  const r = asFrac(root);
  if (r.n === 0) return variable;
  return `\\left(${variable} ${signedTex({ n: -r.n, d: r.d })}\\right)`;
}

/** A point: Czech [2; −1], English (2, −1). */
export function pointL(x: Coef, y: Coef): L {
  // \left … \right, so the brackets grow with a fraction inside them.
  return L(`\\left[${nTex(x)};\\,${nTex(y)}\\right]`, `\\left(${nTex(x)},\\,${nTex(y)}\\right)`);
}

/** A solution set: Czech {−1; 3}, English {−1, 3}. */
export function setL(values: readonly Coef[]): L {
  if (values.length === 0) return L('\\emptyset', '\\emptyset');
  const items = values.map(nTex);
  return L(`\\{${items.join(';\\,')}\\}`, `\\{${items.join(',\\,')}\\}`);
}

export type Bound = Coef | 'inf' | '-inf';

function boundTex(b: Bound): string {
  if (b === 'inf') return '\\infty';
  if (b === '-inf') return '-\\infty';
  return nTex(b);
}

function boundIn(b: Bound): string {
  if (b === 'inf') return 'inf';
  if (b === '-inf') return '-inf';
  return nIn(b);
}

/** An interval for display: Czech ⟨1; 3), English [1, 3). */
export function intervalL(lo: Bound, hi: Bound, loClosed: boolean, hiClosed: boolean): L {
  const open = (closed: boolean, cs: boolean): string => (closed ? (cs ? '\\langle ' : '[') : '(');
  const close = (closed: boolean, cs: boolean): string => (closed ? (cs ? '\\rangle ' : ']') : ')');
  return L(
    `${open(loClosed, true)}${boundTex(lo)};\\,${boundTex(hi)}${close(hiClosed, true)}`,
    `${open(loClosed, false)}${boundTex(lo)},\\,${boundTex(hi)}${close(hiClosed, false)}`,
  );
}

/** The same interval as answer-parser input: <1; 3). */
export function intervalIn(lo: Bound, hi: Bound, loClosed: boolean, hiClosed: boolean): string {
  return `${loClosed ? '<' : '('}${boundIn(lo)}; ${boundIn(hi)}${hiClosed ? '>' : ')'}`;
}

/** Join display maths into bilingual text: both languages get the same formula. */
export function sameL(text: string): L {
  return L(text, text);
}
