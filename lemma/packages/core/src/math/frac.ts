/**
 * Exact rational numbers for problem generators. Generated answers such as a vertex at
 * x = 3/2 must be exact, both to display as a fraction and to compare without rounding.
 */
export interface Frac {
  /** Numerator; carries the sign. */
  n: number;
  /** Denominator; always positive. */
  d: number;
}

export function gcd(a: number, b: number): number {
  let x = Math.abs(a);
  let y = Math.abs(b);
  while (y !== 0) [x, y] = [y, x % y];
  return x;
}

export function lcm(a: number, b: number): number {
  if (a === 0 || b === 0) return 0;
  return Math.abs(a * b) / gcd(a, b);
}

export function frac(n: number, d = 1): Frac {
  if (!Number.isInteger(n) || !Number.isInteger(d)) throw new Error(`frac: integers required, got ${n}/${d}`);
  if (d === 0) throw new Error('frac: zero denominator');
  const g = gcd(n, d) || 1;
  const sign = d < 0 ? -1 : 1;
  // `|| 0` avoids a negative zero numerator.
  return { n: (sign * n) / g || 0, d: (sign * d) / g };
}

export const fAdd = (a: Frac, b: Frac): Frac => frac(a.n * b.d + b.n * a.d, a.d * b.d);
export const fSub = (a: Frac, b: Frac): Frac => frac(a.n * b.d - b.n * a.d, a.d * b.d);
export const fMul = (a: Frac, b: Frac): Frac => frac(a.n * b.n, a.d * b.d);
export const fDiv = (a: Frac, b: Frac): Frac => frac(a.n * b.d, a.d * b.n);
export const fNeg = (a: Frac): Frac => frac(-a.n, a.d);
export const fEq = (a: Frac, b: Frac): boolean => a.n === b.n && a.d === b.d;
export const fIsInt = (a: Frac): boolean => a.d === 1;
export const fToNumber = (a: Frac): number => a.n / a.d;
export const fSign = (a: Frac): number => Math.sign(a.n);

/** LaTeX: `3`, `-\frac{3}{2}`. */
export function fToTex(a: Frac): string {
  if (a.d === 1) return String(a.n);
  return `${a.n < 0 ? '-' : ''}\\frac{${Math.abs(a.n)}}{${a.d}}`;
}

/** Plain text the answer parser understands: `3`, `-3/2`. */
export function fToInput(a: Frac): string {
  return a.d === 1 ? String(a.n) : `${a.n}/${a.d}`;
}
