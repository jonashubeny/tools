/** Abstract syntax tree of a mathematical expression. */
export type Node =
  | { t: 'num'; v: number }
  | { t: 'var'; name: string }
  | { t: 'const'; name: ConstName }
  | { t: 'neg'; a: Node }
  | { t: 'bin'; op: BinOp; a: Node; b: Node; implicit?: boolean }
  | { t: 'call'; fn: FnName; args: Node[] }
  | { t: 'abs'; a: Node }
  | { t: 'deg'; a: Node };

export type BinOp = '+' | '-' | '*' | '/' | '^';
export type ConstName = 'pi' | 'e' | 'i' | 'inf';

/** Canonical function names. Aliases (tg, cotg, asin…) are resolved by the parser. */
export type FnName =
  | 'sqrt'
  | 'cbrt'
  | 'abs'
  | 'sin'
  | 'cos'
  | 'tan'
  | 'cot'
  | 'asin'
  | 'acos'
  | 'atan'
  | 'ln'
  | 'log' // log(x) = base 10 (Czech school convention); log(x, b) = base b
  | 'exp'
  | 'sgn';

/** Spellings accepted in input, mapped to canonical names. */
export const FUNCTION_ALIASES: Readonly<Record<string, FnName>> = {
  sqrt: 'sqrt',
  odm: 'sqrt',
  cbrt: 'cbrt',
  abs: 'abs',
  sin: 'sin',
  cos: 'cos',
  tan: 'tan',
  tg: 'tan',
  cot: 'cot',
  cotg: 'cot',
  ctg: 'cot',
  arcsin: 'asin',
  asin: 'asin',
  arccos: 'acos',
  acos: 'acos',
  arctan: 'atan',
  arctg: 'atan',
  atan: 'atan',
  ln: 'ln',
  log: 'log',
  exp: 'exp',
  sgn: 'sgn',
  sign: 'sgn',
};

export const CONSTANT_ALIASES: Readonly<Record<string, ConstName>> = {
  pi: 'pi',
  e: 'e',
  i: 'i',
  inf: 'inf',
  oo: 'inf',
  infty: 'inf',
};

export const num = (v: number): Node => ({ t: 'num', v });
export const variable = (name: string): Node => ({ t: 'var', name });
export const bin = (op: BinOp, a: Node, b: Node): Node => ({ t: 'bin', op, a, b });
export const neg = (a: Node): Node => ({ t: 'neg', a });
export const call = (fn: FnName, ...args: Node[]): Node => ({ t: 'call', fn, args });

/** All variable names that occur in the expression. */
export function variablesOf(node: Node, out: Set<string> = new Set()): Set<string> {
  switch (node.t) {
    case 'var':
      out.add(node.name);
      break;
    case 'neg':
    case 'abs':
    case 'deg':
      variablesOf(node.a, out);
      break;
    case 'bin':
      variablesOf(node.a, out);
      variablesOf(node.b, out);
      break;
    case 'call':
      for (const arg of node.args) variablesOf(arg, out);
      break;
    default:
      break;
  }
  return out;
}

/** All functions called anywhere in the expression. */
export function functionsOf(node: Node, out: Set<FnName> = new Set()): Set<FnName> {
  switch (node.t) {
    case 'neg':
    case 'abs':
    case 'deg':
      functionsOf(node.a, out);
      break;
    case 'bin':
      functionsOf(node.a, out);
      functionsOf(node.b, out);
      break;
    case 'call':
      out.add(node.fn);
      for (const arg of node.args) functionsOf(arg, out);
      break;
    default:
      break;
  }
  return out;
}

/** Is any part of the expression written in degrees (30°)? */
export function usesDegrees(node: Node): boolean {
  switch (node.t) {
    case 'deg':
      return true;
    case 'neg':
    case 'abs':
      return usesDegrees(node.a);
    case 'bin':
      return usesDegrees(node.a) || usesDegrees(node.b);
    case 'call':
      return node.args.some(usesDegrees);
    default:
      return false;
  }
}

/** Does the expression use the imaginary unit? */
export function usesImaginary(node: Node): boolean {
  switch (node.t) {
    case 'const':
      return node.name === 'i';
    case 'neg':
    case 'abs':
    case 'deg':
      return usesImaginary(node.a);
    case 'bin':
      return usesImaginary(node.a) || usesImaginary(node.b);
    case 'call':
      return node.args.some(usesImaginary);
    default:
      return false;
  }
}
