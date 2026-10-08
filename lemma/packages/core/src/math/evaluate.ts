import type { FnName, Node } from './ast';

/** Raised when an expression refers to a symbol that has no value. */
export class EvalError extends Error {
  readonly symbol: string;

  constructor(symbol: string) {
    super(`unknown symbol: ${symbol}`);
    this.name = 'EvalError';
    this.symbol = symbol;
  }
}

export type Env = Readonly<Record<string, number>>;

const DEG = Math.PI / 180;

/**
 * Evaluate over the real numbers.
 *
 * Returns NaN where the expression is undefined (division by zero, log of a non-positive
 * number, even root of a negative number). Throws EvalError for unknown variables, and for
 * the imaginary unit — use evalComplex for that.
 */
export function evalReal(node: Node, env: Env = {}): number {
  switch (node.t) {
    case 'num':
      return node.v;
    case 'var': {
      const v = env[node.name];
      if (v === undefined) throw new EvalError(node.name);
      return v;
    }
    case 'const':
      if (node.name === 'pi') return Math.PI;
      if (node.name === 'e') return Math.E;
      if (node.name === 'inf') return Infinity;
      throw new EvalError('i');
    case 'neg':
      return -evalReal(node.a, env);
    case 'abs':
      return Math.abs(evalReal(node.a, env));
    case 'deg':
      return evalReal(node.a, env) * DEG;
    case 'bin': {
      const a = evalReal(node.a, env);
      const b = evalReal(node.b, env);
      switch (node.op) {
        case '+':
          return a + b;
        case '-':
          return a - b;
        case '*':
          return a * b;
        case '/':
          return b === 0 ? NaN : a / b;
        case '^':
          return realPow(a, b);
      }
      return NaN;
    }
    case 'call':
      return realCall(
        node.fn,
        node.args.map((arg) => evalReal(arg, env)),
      );
  }
}

/** a^b over the reals: 0^0 and negative bases with non-integer exponents are undefined. */
function realPow(a: number, b: number): number {
  if (a === 0 && b <= 0) return NaN;
  if (a < 0 && !Number.isInteger(b)) return NaN;
  return Math.pow(a, b);
}

function realCall(fn: FnName, args: number[]): number {
  const x = args[0]!;
  switch (fn) {
    case 'sqrt':
      return x < 0 ? NaN : Math.sqrt(x);
    case 'cbrt':
      return Math.cbrt(x);
    case 'abs':
      return Math.abs(x);
    case 'sin':
      return Math.sin(x);
    case 'cos':
      return Math.cos(x);
    case 'tan': {
      const c = Math.cos(x);
      return Math.abs(c) < 1e-12 ? NaN : Math.sin(x) / c;
    }
    case 'cot': {
      const s = Math.sin(x);
      return Math.abs(s) < 1e-12 ? NaN : Math.cos(x) / s;
    }
    case 'asin':
      return x < -1 || x > 1 ? NaN : Math.asin(x);
    case 'acos':
      return x < -1 || x > 1 ? NaN : Math.acos(x);
    case 'atan':
      return Math.atan(x);
    case 'ln':
      return x <= 0 ? NaN : Math.log(x);
    case 'log': {
      if (x <= 0) return NaN;
      if (args.length < 2) return Math.log10(x);
      const base = args[1]!;
      if (base <= 0 || base === 1) return NaN;
      return Math.log(x) / Math.log(base);
    }
    case 'exp':
      return Math.exp(x);
    case 'sgn':
      return Math.sign(x);
  }
}

/** A complex number re + im·i. */
export interface Complex {
  re: number;
  im: number;
}

export const complex = (re: number, im = 0): Complex => ({ re, im });

const cAdd = (a: Complex, b: Complex): Complex => ({ re: a.re + b.re, im: a.im + b.im });
const cSub = (a: Complex, b: Complex): Complex => ({ re: a.re - b.re, im: a.im - b.im });
const cMul = (a: Complex, b: Complex): Complex => ({
  re: a.re * b.re - a.im * b.im,
  im: a.re * b.im + a.im * b.re,
});
const cAbs = (a: Complex): number => Math.hypot(a.re, a.im);

function cDiv(a: Complex, b: Complex): Complex {
  const d = b.re * b.re + b.im * b.im;
  if (d === 0) return { re: NaN, im: NaN };
  return { re: (a.re * b.re + a.im * b.im) / d, im: (a.im * b.re - a.re * b.im) / d };
}

function cExp(a: Complex): Complex {
  const r = Math.exp(a.re);
  return { re: r * Math.cos(a.im), im: r * Math.sin(a.im) };
}

/** Principal logarithm. */
function cLn(a: Complex): Complex {
  const r = cAbs(a);
  if (r === 0) return { re: NaN, im: NaN };
  return { re: Math.log(r), im: Math.atan2(a.im, a.re) };
}

function cPow(a: Complex, b: Complex): Complex {
  if (b.im === 0 && Number.isInteger(b.re) && Math.abs(b.re) <= 64) {
    // Exact repeated multiplication for integer exponents (Moivre without rounding drift).
    let n = Math.abs(b.re);
    let result: Complex = { re: 1, im: 0 };
    let base = a;
    while (n > 0) {
      if (n & 1) result = cMul(result, base);
      base = cMul(base, base);
      n >>= 1;
    }
    return b.re < 0 ? cDiv({ re: 1, im: 0 }, result) : result;
  }
  if (a.re === 0 && a.im === 0) return b.re > 0 ? { re: 0, im: 0 } : { re: NaN, im: NaN };
  return cExp(cMul(b, cLn(a)));
}

function cSqrt(a: Complex): Complex {
  const r = cAbs(a);
  const re = Math.sqrt((r + a.re) / 2);
  const im = Math.sqrt((r - a.re) / 2);
  return { re, im: a.im < 0 ? -im : im };
}

const cSin = (a: Complex): Complex => ({
  re: Math.sin(a.re) * Math.cosh(a.im),
  im: Math.cos(a.re) * Math.sinh(a.im),
});
const cCos = (a: Complex): Complex => ({
  re: Math.cos(a.re) * Math.cosh(a.im),
  im: -Math.sin(a.re) * Math.sinh(a.im),
});

/**
 * Evaluate over the complex numbers. Functions without a sensible elementary complex
 * meaning at school level (inverse trigonometric, sgn) are applied to real arguments only.
 */
export function evalComplex(node: Node, env: Env = {}): Complex {
  switch (node.t) {
    case 'num':
      return { re: node.v, im: 0 };
    case 'var': {
      const v = env[node.name];
      if (v === undefined) throw new EvalError(node.name);
      return { re: v, im: 0 };
    }
    case 'const':
      if (node.name === 'pi') return { re: Math.PI, im: 0 };
      if (node.name === 'e') return { re: Math.E, im: 0 };
      if (node.name === 'i') return { re: 0, im: 1 };
      return { re: Infinity, im: 0 };
    case 'neg': {
      const a = evalComplex(node.a, env);
      return { re: -a.re, im: -a.im };
    }
    case 'abs':
      return { re: cAbs(evalComplex(node.a, env)), im: 0 };
    case 'deg': {
      const a = evalComplex(node.a, env);
      return { re: a.re * DEG, im: a.im * DEG };
    }
    case 'bin': {
      const a = evalComplex(node.a, env);
      const b = evalComplex(node.b, env);
      switch (node.op) {
        case '+':
          return cAdd(a, b);
        case '-':
          return cSub(a, b);
        case '*':
          return cMul(a, b);
        case '/':
          return cDiv(a, b);
        case '^':
          return cPow(a, b);
      }
      return { re: NaN, im: NaN };
    }
    case 'call': {
      const args = node.args.map((arg) => evalComplex(arg, env));
      const x = args[0]!;
      switch (node.fn) {
        case 'sqrt':
          return cSqrt(x);
        case 'abs':
          return { re: cAbs(x), im: 0 };
        case 'sin':
          return cSin(x);
        case 'cos':
          return cCos(x);
        case 'tan':
          return cDiv(cSin(x), cCos(x));
        case 'cot':
          return cDiv(cCos(x), cSin(x));
        case 'exp':
          return cExp(x);
        case 'ln':
          return cLn(x);
        default: {
          if (args.some((arg) => Math.abs(arg.im) > 1e-12)) return { re: NaN, im: NaN };
          return {
            re: realCall(
              node.fn,
              args.map((arg) => arg.re),
            ),
            im: 0,
          };
        }
      }
    }
  }
}

/** Evaluate a constant expression (no variables); NaN if undefined or not constant. */
export function evalConstant(node: Node): number {
  try {
    return evalReal(node, {});
  } catch {
    return NaN;
  }
}
