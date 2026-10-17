import { createRng } from '../rng';
import { type Node, variablesOf } from './ast';
import { EvalError, evalComplex, evalReal, type Complex } from './evaluate';

/** Default tolerance for "is this the same number?" — relative for large values. */
export const DEFAULT_TOLERANCE = 1e-9;

export function numbersEqual(a: number, b: number, tol = DEFAULT_TOLERANCE): boolean {
  if (a === b) return true;
  if (!Number.isFinite(a) || !Number.isFinite(b)) return false;
  const scale = Math.max(1, Math.abs(a), Math.abs(b));
  return Math.abs(a - b) <= tol * scale;
}

export function complexEqual(a: Complex, b: Complex, tol = DEFAULT_TOLERANCE): boolean {
  if (![a.re, a.im, b.re, b.im].every(Number.isFinite)) return false;
  const scale = Math.max(1, Math.hypot(a.re, a.im), Math.hypot(b.re, b.im));
  return Math.hypot(a.re - b.re, a.im - b.im) <= tol * scale;
}

export type EquivalenceResult =
  | { equal: true }
  | {
      equal: false;
      /** 'symbol': the candidate uses a variable the reference does not allow. */
      reason: 'differs' | 'symbol' | 'undetermined';
      symbol?: string;
      /** A point at which the two expressions differ, when one was found. */
      witness?: Record<string, number>;
    };

export interface EquivalenceOptions {
  /** Variables the answer may contain. */
  vars: readonly string[];
  tol?: number;
  /** Evaluate over the complex numbers (for answers containing i). */
  complex?: boolean;
}

const REQUIRED_POINTS = 8;
const MAX_TRIES = 80;
const POINT_TOLERANCE = 1e-7;

/**
 * Decide whether two expressions denote the same function by evaluating both at
 * pseudo-random points (the method WeBWorK has used for decades). Deterministic: the same
 * inputs always give the same verdict.
 *
 * Points where the reference is undefined are skipped; the candidate must be defined and
 * equal wherever the reference is. A removable singularity in the candidate, such as
 * (x²−1)/(x−1) for x+1, is therefore accepted.
 */
export function expressionsEquivalent(
  reference: Node,
  candidate: Node,
  options: EquivalenceOptions,
): EquivalenceResult {
  const allowed = new Set(options.vars);
  for (const name of variablesOf(candidate)) {
    if (!allowed.has(name)) return { equal: false, reason: 'symbol', symbol: name };
  }
  const tol = options.tol ?? POINT_TOLERANCE;
  const vars = [...new Set([...options.vars, ...variablesOf(reference)])];

  const evaluate = (node: Node, env: Record<string, number>): Complex => {
    if (options.complex) return evalComplex(node, env);
    return { re: evalReal(node, env), im: 0 };
  };
  const defined = (z: Complex): boolean => Number.isFinite(z.re) && Number.isFinite(z.im);

  if (vars.length === 0) {
    try {
      const a = evaluate(reference, {});
      const b = evaluate(candidate, {});
      if (!defined(a)) return { equal: false, reason: 'undetermined' };
      return complexEqual(a, b, tol) ? { equal: true } : { equal: false, reason: 'differs' };
    } catch (error) {
      if (error instanceof EvalError) return { equal: false, reason: 'symbol', symbol: error.symbol };
      throw error;
    }
  }

  const rng = createRng(0x5eed1e55);
  let used = 0;
  for (let attempt = 0; attempt < MAX_TRIES && used < REQUIRED_POINTS; attempt++) {
    const env: Record<string, number> = {};
    for (const name of vars) {
      // Mix ranges so that logs and roots get positive arguments often enough.
      const mode = attempt % 4;
      env[name] =
        mode === 0
          ? rng.float(-4, 4)
          : mode === 1
            ? rng.float(0.2, 5)
            : mode === 2
              ? rng.float(-1.5, 1.5)
              : rng.float(1.1, 9);
    }
    let a: Complex;
    let b: Complex;
    try {
      a = evaluate(reference, env);
      if (!defined(a)) continue;
      b = evaluate(candidate, env);
    } catch (error) {
      if (error instanceof EvalError) return { equal: false, reason: 'symbol', symbol: error.symbol };
      throw error;
    }
    used++;
    if (!defined(b) || !complexEqual(a, b, tol)) {
      return { equal: false, reason: 'differs', witness: env };
    }
  }
  if (used < 3) return { equal: false, reason: 'undetermined' };
  return { equal: true };
}

/** Structural shape requirements for an algebraic answer. */
export type ExprForm = 'expanded' | 'factored' | 'vertex';

function containsVar(node: Node): boolean {
  return variablesOf(node).size > 0;
}

/** Count how many times any variable occurs. */
function countVars(node: Node): number {
  switch (node.t) {
    case 'var':
      return 1;
    case 'neg':
    case 'abs':
    case 'deg':
      return countVars(node.a);
    case 'bin':
      return countVars(node.a) + countVars(node.b);
    case 'call':
      return node.args.reduce((sum, arg) => sum + countVars(arg), 0);
    default:
      return 0;
  }
}

/** A sum or difference that contains a variable — what "expanded" must not multiply or raise. */
function isVariableSum(node: Node): boolean {
  if (node.t === 'bin' && (node.op === '+' || node.op === '-')) return containsVar(node);
  if (node.t === 'neg') return isVariableSum(node.a);
  return false;
}

function isExpanded(node: Node): boolean {
  switch (node.t) {
    case 'bin':
      if (node.op === '*') {
        if (isVariableSum(node.a) || isVariableSum(node.b)) return false;
      }
      if (node.op === '^' && isVariableSum(node.a)) return false;
      if (node.op === '/' && isVariableSum(node.b)) return false;
      return isExpanded(node.a) && isExpanded(node.b);
    case 'neg':
      return !isVariableSum(node.a) && isExpanded(node.a);
    case 'abs':
    case 'deg':
      return isExpanded(node.a);
    case 'call':
      return node.args.every(isExpanded);
    default:
      return true;
  }
}

/** Flatten a product into its factors, ignoring signs. */
function factorsOf(node: Node, out: Node[] = []): Node[] {
  if (node.t === 'bin' && node.op === '*') {
    factorsOf(node.a, out);
    factorsOf(node.b, out);
  } else if (node.t === 'neg') {
    factorsOf(node.a, out);
  } else {
    out.push(node);
  }
  return out;
}

/**
 * Factored: a product in which the variable part is split into at least two factors
 * (counting powers), e.g. 2(x−1)(x+3) or (x−2)^2 or x(x+4).
 */
function isFactored(node: Node): boolean {
  let variableFactors = 0;
  for (const factor of factorsOf(node)) {
    if (!containsVar(factor)) continue;
    if (factor.t === 'bin' && factor.op === '^' && factor.b.t === 'num' && factor.b.v >= 2) {
      variableFactors += factor.b.v;
      if (!isExpanded(factor.a)) return false;
    } else {
      variableFactors += 1;
      if (!isExpanded(factor)) return false;
    }
  }
  return variableFactors >= 2;
}

/** Vertex form a(x−m)²+n: the variable occurs exactly once, inside a square. */
function isVertexForm(node: Node): boolean {
  if (countVars(node) !== 1) return false;
  const hasSquare = (n: Node): boolean => {
    switch (n.t) {
      case 'bin':
        if (n.op === '^' && n.b.t === 'num' && n.b.v === 2 && containsVar(n.a)) return true;
        return hasSquare(n.a) || hasSquare(n.b);
      case 'neg':
      case 'abs':
      case 'deg':
        return hasSquare(n.a);
      default:
        return false;
    }
  };
  return hasSquare(node);
}

export function hasForm(node: Node, form: ExprForm): boolean {
  if (form === 'expanded') return isExpanded(node);
  if (form === 'factored') return isFactored(node);
  return isVertexForm(node);
}
