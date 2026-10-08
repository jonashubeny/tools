import type { AnswerSpec } from '../answer/types';
import { expressionsEquivalent, numbersEqual } from '../math/compare';
import { evalReal } from '../math/evaluate';
import { type IntervalSet, intervalSetContains, parseIntervalSet } from '../math/interval';
import { parse } from '../math/parse';

/**
 * Independent verification of authored answers.
 *
 * A generator states its canonical answer; a verification spec states what that answer
 * must *satisfy*, in terms the expression engine can check numerically without knowing
 * how the generator arrived at it. The content linter runs these for many seeds, so a
 * generator whose arithmetic is wrong for some parameters fails the build instead of
 * marking a learner's correct answer as wrong.
 */
export type VerifySpec =
  /** Answer (set): exactly the real zeros of `expr` within `range`. */
  | { kind: 'roots'; expr: string; variable?: string; range?: [number, number] }
  /** Answer (interval): exactly where `expr` REL 0 holds. */
  | { kind: 'inequality'; expr: string; rel: '<' | '<=' | '>' | '>='; variable?: string }
  /** Answer (interval): exactly where `expr` is defined. */
  | { kind: 'domain'; expr: string; variable?: string }
  /** Answer (interval): the set of values `expr` takes. */
  | { kind: 'range'; expr: string; variable?: string; over?: [number, number] }
  /** Answer (expr): equivalent to `expr`. */
  | { kind: 'equiv'; expr: string; vars: string[] }
  /** Answer (expr in x): equal to `expr` on the open interval `on` (piecewise rewrites). */
  | { kind: 'equiv-on'; expr: string; on: [number, number]; variable?: string }
  /** Answer (number): equals `expr` evaluated in `env`. */
  | { kind: 'value'; expr: string; env?: Record<string, number> }
  /** Answer (point): the minimum or maximum point of `expr`. */
  | { kind: 'extremum'; expr: string; variable?: string }
  /** Answer (expr in x): its graph passes through all the points. */
  | { kind: 'passes'; points: [number, number][]; variable?: string }
  /** Answer (point): satisfies every equation `expr = 0` in variables x, y. */
  | { kind: 'solves'; exprs: string[] };

const OPTS = { decimalComma: false } as const;

/** Sample points on a grid aligned to twelfths, so rational roots are hit exactly. */
function gridPoints(lo: number, hi: number, perUnit = 12): number[] {
  const out: number[] = [];
  for (let k = Math.ceil(lo * perUnit); k <= Math.floor(hi * perUnit); k++) out.push(k / perUnit);
  return out;
}

function intervalAnswer(spec: AnswerSpec): IntervalSet | string {
  if (spec.kind !== 'interval') return `expected an interval answer, got ${spec.kind}`;
  const parsed = parseIntervalSet(spec.value, OPTS);
  return parsed.ok ? parsed.set : `canonical interval does not parse: ${parsed.code}`;
}

type SetAnswer = { error: string } | { all: true } | { values: number[] };

function setAnswer(spec: AnswerSpec): SetAnswer {
  if (spec.kind !== 'set') return { error: `expected a set answer, got ${spec.kind}` };
  if (spec.values === 'all') return { all: true };
  return { values: spec.values.map((value) => evalReal(parse(value, OPTS), {})) };
}

function pointAnswer(spec: AnswerSpec): number[] | string {
  if (spec.kind !== 'point') return `expected a point answer, got ${spec.kind}`;
  return spec.coords.map((coord) => evalReal(parse(coord, OPTS), {}));
}

/** The point of [a, b] where g is smallest, by golden-section search (g unimodal there). */
function minimise(g: (x: number) => number, a: number, b: number): number {
  const ratio = (Math.sqrt(5) - 1) / 2;
  let lo = a;
  let hi = b;
  let x1 = hi - ratio * (hi - lo);
  let x2 = lo + ratio * (hi - lo);
  let y1 = g(x1);
  let y2 = g(x2);
  for (let step = 0; step < 80; step++) {
    if (y1 < y2) {
      hi = x2;
      x2 = x1;
      y2 = y1;
      x1 = hi - ratio * (hi - lo);
      y1 = g(x1);
    } else {
      lo = x1;
      x1 = x2;
      y1 = y2;
      x2 = lo + ratio * (hi - lo);
      y2 = g(x2);
    }
  }
  return (lo + hi) / 2;
}

/** The point of [a, b] where |f| is smallest. */
const minimiseAbs = (f: (x: number) => number, a: number, b: number): number => minimise((x) => Math.abs(f(x)), a, b);

/**
 * Zeros of f on [lo, hi]: exact grid hits, sign changes refined by bisection, and zeros
 * the graph only touches (a double root such as sin x = 1), found as minima of |f|.
 */
function findZeros(f: (x: number) => number, lo: number, hi: number): number[] {
  const zeros: number[] = [];
  const add = (x: number): void => {
    if (!zeros.some((z) => Math.abs(z - x) < 1e-6)) zeros.push(x);
  };
  const xs = gridPoints(lo, hi);
  // Touching zeros: |f| dips between two neighbours without f changing sign.
  for (let i = 1; i + 1 < xs.length; i++) {
    const [left, mid, right] = [f(xs[i - 1]!), f(xs[i]!), f(xs[i + 1]!)];
    if (
      ![left, mid, right].every(Number.isFinite) ||
      Math.sign(left) !== Math.sign(mid) ||
      Math.sign(mid) !== Math.sign(right)
    )
      continue;
    if (Math.abs(mid) > 0.05 || Math.abs(mid) > Math.abs(left) || Math.abs(mid) > Math.abs(right)) continue;
    const x = minimiseAbs(f, xs[i - 1]!, xs[i + 1]!);
    if (Math.abs(f(x)) < 1e-9) add(x);
  }
  let prevX = xs[0]!;
  let prevY = f(prevX);
  if (Math.abs(prevY) < 1e-10) add(prevX);
  for (let i = 1; i < xs.length; i++) {
    const x = xs[i]!;
    const y = f(x);
    if (Math.abs(y) < 1e-10) add(x);
    else if (
      Number.isFinite(y) &&
      Number.isFinite(prevY) &&
      Math.abs(prevY) >= 1e-10 &&
      Math.sign(y) !== Math.sign(prevY)
    ) {
      let a = prevX;
      let b = x;
      let fa = prevY;
      for (let step = 0; step < 60; step++) {
        const mid = (a + b) / 2;
        const fm = f(mid);
        if (!Number.isFinite(fm)) break;
        if (Math.sign(fm) === Math.sign(fa)) {
          a = mid;
          fa = fm;
        } else b = mid;
      }
      const root = (a + b) / 2;
      // A sign change across a pole is not a zero.
      if (Math.abs(f(root)) < 1e-6) add(root);
    }
    prevX = x;
    prevY = y;
  }
  return zeros;
}

function verifyOne(spec: AnswerSpec, v: VerifySpec): string | null {
  const variable = 'variable' in v && v.variable ? v.variable : 'x';

  switch (v.kind) {
    case 'roots': {
      const answer = setAnswer(spec);
      if ('error' in answer) return answer.error;
      const node = parse(v.expr, OPTS);
      const f = (x: number): number => evalReal(node, { [variable]: x });
      const [lo, hi] = v.range ?? [-60, 60];
      if ('all' in answer) {
        const sample = gridPoints(-5, 5, 3).map(f);
        return sample.every((y) => Math.abs(y) < 1e-9)
          ? null
          : 'answer is "all reals" but the expression is not identically zero';
      }
      const zeros = findZeros(f, lo, hi);
      for (const value of answer.values) {
        if (!(Math.abs(f(value)) < 1e-7)) return `${value} is in the answer but is not a zero of ${v.expr}`;
      }
      for (const zero of zeros) {
        if (!answer.values.some((value) => Math.abs(value - zero) < 1e-5))
          return `${v.expr} has a zero at ${zero} that the answer omits`;
      }
      return null;
    }

    case 'inequality': {
      const answer = intervalAnswer(spec);
      if (typeof answer === 'string') return answer;
      const node = parse(v.expr, OPTS);
      for (const x of gridPoints(-40, 40)) {
        // Shift off the grid a little so that boundary points are tested separately below.
        for (const point of [x, x + 1 / 37]) {
          const y = evalReal(node, { [variable]: point });
          if (!Number.isFinite(y)) {
            if (intervalSetContains(answer, point)) return `${point} is in the answer but ${v.expr} is undefined there`;
            continue;
          }
          if (Math.abs(y) < 1e-9 && point !== x) continue;
          const holds =
            v.rel === '<' ? y < -1e-12 : v.rel === '<=' ? y <= 1e-12 : v.rel === '>' ? y > 1e-12 : y >= -1e-12;
          if (holds !== intervalSetContains(answer, point)) {
            return `at ${variable} = ${point}: ${v.expr} ${v.rel} 0 is ${holds}, but the answer says ${!holds}`;
          }
        }
      }
      return null;
    }

    case 'domain': {
      const answer = intervalAnswer(spec);
      if (typeof answer === 'string') return answer;
      const node = parse(v.expr, OPTS);
      for (const x of gridPoints(-40, 40)) {
        for (const point of [x, x + 1 / 37]) {
          const defined = Number.isFinite(evalReal(node, { [variable]: point }));
          if (defined !== intervalSetContains(answer, point)) {
            return `at ${variable} = ${point}: ${v.expr} is ${defined ? 'defined' : 'undefined'}, but the answer says otherwise`;
          }
        }
      }
      return null;
    }

    case 'range': {
      const answer = intervalAnswer(spec);
      if (typeof answer === 'string') return answer;
      const node = parse(v.expr, OPTS);
      const [lo, hi] = v.over ?? [-200, 200];
      const f = (x: number): number => evalReal(node, { [variable]: x });
      const xs = gridPoints(lo, hi);
      let min = Infinity;
      let max = -Infinity;
      let argMin = -1;
      let argMax = -1;
      xs.forEach((x, index) => {
        const y = f(x);
        if (!Number.isFinite(y)) return;
        if (y < min) [min, argMin] = [y, index];
        if (y > max) [max, argMax] = [y, index];
      });
      // An extreme rarely sits on the grid (sin x peaks at π/2), so refine each one
      // between its neighbours before comparing it with the answer.
      const refine = (index: number, sign: 1 | -1): number => {
        const [a, b] = [xs[Math.max(0, index - 1)]!, xs[Math.min(xs.length - 1, index + 1)]!];
        const inside = [f(a), f(b)].every(Number.isFinite);
        return inside ? f(minimise((x) => sign * f(x), a, b)) : f(xs[index]!);
      };
      // The refined values carry rounding noise, so they only feed the endpoint comparison
      // below (which has a tolerance); containment is checked on the grid values.
      if (argMin >= 0) min = Math.min(min, refine(argMin, 1));
      if (argMax >= 0) max = Math.max(max, refine(argMax, -1));
      for (const x of xs) {
        const y = f(x);
        if (Number.isFinite(y) && !intervalSetContains(answer, y))
          return `${v.expr} takes the value ${y} at ${variable} = ${x}, outside the answer`;
      }
      // Every finite endpoint of the answer must actually be approached.
      for (const iv of answer) {
        if (Number.isFinite(iv.lo) && Math.abs(iv.lo - min) > 1e-6 && answer.length === 1)
          return `answer starts at ${iv.lo} but the smallest value found is ${min}`;
        if (Number.isFinite(iv.hi) && Math.abs(iv.hi - max) > 1e-6 && answer.length === 1)
          return `answer ends at ${iv.hi} but the largest value found is ${max}`;
      }
      return null;
    }

    case 'equiv': {
      if (spec.kind !== 'expr') return `expected an expression answer, got ${spec.kind}`;
      const result = expressionsEquivalent(
        parse(v.expr, { ...OPTS, variables: v.vars }),
        parse(spec.value, { ...OPTS, variables: spec.vars }),
        { vars: v.vars },
      );
      return result.equal ? null : `answer ${spec.value} is not equivalent to ${v.expr}`;
    }

    case 'equiv-on': {
      if (spec.kind !== 'expr') return `expected an expression answer, got ${spec.kind}`;
      const reference = parse(v.expr, OPTS);
      const candidate = parse(spec.value, { ...OPTS, variables: spec.vars });
      const lo = Math.max(v.on[0], -50);
      const hi = Math.min(v.on[1], 50);
      for (let i = 1; i <= 24; i++) {
        const x = lo + ((hi - lo) * i) / 25;
        const expected = evalReal(reference, { [variable]: x });
        const actual = evalReal(candidate, { [variable]: x });
        if (!numbersEqual(expected, actual, 1e-9))
          return `at ${variable} = ${x}: answer gives ${actual}, ${v.expr} gives ${expected}`;
      }
      return null;
    }

    case 'value': {
      if (spec.kind !== 'number') return `expected a number answer, got ${spec.kind}`;
      const expected = evalReal(parse(v.expr, { ...OPTS, variables: Object.keys(v.env ?? {}) }), v.env ?? {});
      const actual = evalReal(parse(spec.value, OPTS), {});
      const ok =
        spec.tol !== undefined ? Math.abs(expected - actual) <= spec.tol : numbersEqual(expected, actual, 1e-9);
      return ok ? null : `answer ${spec.value} = ${actual}, but ${v.expr} = ${expected}`;
    }

    case 'extremum': {
      const point = pointAnswer(spec);
      if (typeof point === 'string') return point;
      const node = parse(v.expr, OPTS);
      const f = (x: number): number => evalReal(node, { [variable]: x });
      const [x0, y0] = point as [number, number];
      if (!numbersEqual(f(x0), y0, 1e-9)) return `f(${x0}) = ${f(x0)}, but the answer claims ${y0}`;
      const left = f(x0 - 1e-3) - y0;
      const right = f(x0 + 1e-3) - y0;
      const isExtremum = (left > 0 && right > 0) || (left < 0 && right < 0);
      return isExtremum ? null : `(${x0}, ${y0}) is on the graph of ${v.expr} but is not an extremum`;
    }

    case 'passes': {
      if (spec.kind !== 'expr') return `expected an expression answer, got ${spec.kind}`;
      const node = parse(spec.value, { ...OPTS, variables: spec.vars });
      for (const [x, y] of v.points) {
        const actual = evalReal(node, { [variable]: x });
        if (!numbersEqual(actual, y, 1e-9)) return `answer gives ${actual} at ${variable} = ${x}, expected ${y}`;
      }
      return null;
    }

    case 'solves': {
      const point = pointAnswer(spec);
      if (typeof point === 'string') return point;
      const env = { x: point[0]!, y: point[1] ?? 0 };
      for (const expr of v.exprs) {
        const value = evalReal(parse(expr, { ...OPTS, variables: ['x', 'y'] }), env);
        if (!(Math.abs(value) < 1e-8)) return `the point does not satisfy ${expr} = 0 (got ${value})`;
      }
      return null;
    }
  }
}

/** Run all verification specs of a problem; returns human-readable failures. */
export function verifyAnswer(spec: AnswerSpec, checks: readonly VerifySpec[]): string[] {
  const failures: string[] = [];
  for (const check of checks) {
    try {
      const failure = verifyOne(spec, check);
      if (failure) failures.push(`[${check.kind}] ${failure}`);
    } catch (error) {
      failures.push(`[${check.kind}] threw: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  return failures;
}
