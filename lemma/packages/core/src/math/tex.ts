import type { Locale } from '../i18n';
import type { FnName, Node } from './ast';

/**
 * Render an expression as LaTeX, used to show the learner how their input was understood.
 * Czech conventions when locale is 'cs': decimal comma, tg/cotg.
 */

const PREC = { add: 1, mul: 2, neg: 3, pow: 4, atom: 5 } as const;

function precedence(node: Node): number {
  switch (node.t) {
    case 'bin':
      if (node.op === '+' || node.op === '-') return PREC.add;
      if (node.op === '*') return PREC.mul;
      // Rendered as \frac, which delimits itself — unless the sign is pulled out in front.
      if (node.op === '/') return node.a.t === 'neg' ? PREC.neg : PREC.atom;
      return PREC.pow;
    case 'neg':
      return PREC.neg;
    default:
      return PREC.atom;
  }
}

const FN_TEX: Record<FnName, { cs: string; en: string }> = {
  sqrt: { cs: '', en: '' },
  cbrt: { cs: '', en: '' },
  abs: { cs: '', en: '' },
  sin: { cs: '\\sin', en: '\\sin' },
  cos: { cs: '\\cos', en: '\\cos' },
  tan: { cs: '\\operatorname{tg}', en: '\\tan' },
  cot: { cs: '\\operatorname{cotg}', en: '\\cot' },
  asin: { cs: '\\arcsin', en: '\\arcsin' },
  acos: { cs: '\\arccos', en: '\\arccos' },
  atan: { cs: '\\operatorname{arctg}', en: '\\arctan' },
  ln: { cs: '\\ln', en: '\\ln' },
  log: { cs: '\\log', en: '\\log' },
  exp: { cs: '\\exp', en: '\\exp' },
  sgn: { cs: '\\operatorname{sgn}', en: '\\operatorname{sgn}' },
};

/** Format a number for display: no float noise, decimal comma in Czech. */
export function numberToTex(value: number, locale: Locale = 'en'): string {
  if (value === Infinity) return '\\infty';
  if (value === -Infinity) return '-\\infty';
  if (Number.isNaN(value)) return '\\text{?}';
  const rounded = Math.abs(value) < 1e-12 ? 0 : Number(value.toPrecision(12));
  let text = String(rounded);
  if (text.includes('e')) text = rounded.toFixed(10).replace(/\.?0+$/, '');
  return locale === 'cs' ? text.replace('.', '{,}') : text;
}

function wrap(tex: string): string {
  return `\\left(${tex}\\right)`;
}

/**
 * Would this node's TeX begin with a minus sign? A negation does; so does (−a)/b, which is
 * written −a/b with the sign before the bar; and so does anything that prints such a node
 * first without brackets: the product −2·i, the sum −a + b.
 */
function startsWithMinus(node: Node): boolean {
  if (node.t === 'neg') return true;
  if (node.t !== 'bin') return false;
  if (node.op === '/') return node.a.t === 'neg';
  if (node.op === '^') return false;
  // A product brackets a left factor that is a sum; everything else is printed as it is.
  if (node.op === '*') return precedence(node.a) >= PREC.mul && startsWithMinus(node.a);
  return startsWithMinus(node.a);
}

/** Is this node something that reads fine as a bare function argument (sin x, sin 2x)? */
function isSimpleArgument(node: Node): boolean {
  if (node.t === 'num' || node.t === 'var' || node.t === 'const') return true;
  // sin 45°
  if (node.t === 'deg') return node.a.t === 'num';
  if (node.t === 'bin' && node.op === '*' && node.implicit) {
    return isSimpleArgument(node.a) && isSimpleArgument(node.b);
  }
  if (node.t === 'bin' && node.op === '^') return node.a.t === 'var' || node.a.t === 'const';
  return false;
}

/** Should a multiplication be written with an explicit dot? */
function needsDot(left: Node, right: Node): boolean {
  // number · number, or anything followed by a number: 2·3, x·2
  if (right.t === 'num') return true;
  if (startsWithMinus(right)) return true;
  if (right.t === 'bin' && right.op === '^' && right.a.t === 'num') return true;
  if (right.t === 'bin' && right.op === '/') return left.t !== 'num';
  if (left.t === 'bin' && left.op === '/' && right.t === 'bin' && right.op === '/') return true;
  if (right.t === 'bin' && right.op === '*') return needsDot(left, right.a);
  return false;
}

export function toTex(node: Node, locale: Locale = 'en'): string {
  const go = (n: Node): string => toTex(n, locale);
  const child = (n: Node, minPrec: number): string => (precedence(n) < minPrec ? wrap(go(n)) : go(n));

  switch (node.t) {
    case 'num':
      return node.v < 0 ? `(${numberToTex(node.v, locale)})` : numberToTex(node.v, locale);
    case 'var':
      return node.name;
    case 'const':
      if (node.name === 'pi') return '\\pi';
      if (node.name === 'e') return '\\mathrm{e}';
      if (node.name === 'i') return '\\mathrm{i}';
      return '\\infty';
    case 'neg':
      return `-${startsWithMinus(node.a) ? wrap(go(node.a)) : child(node.a, PREC.neg)}`;
    case 'abs':
      return `\\left|${go(node.a)}\\right|`;
    case 'deg':
      return `${child(node.a, PREC.atom)}^{\\circ}`;
    case 'bin': {
      const { op, a, b } = node;
      // A right operand must not start with a sign: x + (-3), not x + -3.
      if (op === '+') return `${go(a)} + ${startsWithMinus(b) ? wrap(go(b)) : child(b, PREC.add)}`;
      if (op === '-') return `${go(a)} - ${startsWithMinus(b) ? wrap(go(b)) : child(b, PREC.mul)}`;
      if (op === '*') {
        const left = child(a, PREC.mul);
        // A product's right factor must not start with a sign: 2·(-x), not 2-x.
        const right = startsWithMinus(b) ? wrap(go(b)) : child(b, PREC.mul);
        return needsDot(a, b) ? `${left} \\cdot ${right}` : `${left}${rightGap(a, b)}${right}`;
      }
      if (op === '/') return a.t === 'neg' ? `-\\frac{${go(a.a)}}{${go(b)}}` : `\\frac{${go(a)}}{${go(b)}}`;
      // power
      const isCall = a.t === 'call' && FN_TEX[a.fn].en !== '' && a.fn !== 'log';
      if (isCall && a.t === 'call' && b.t === 'num' && Number.isInteger(b.v) && b.v > 0) {
        // (sin x)^2 is conventionally written sin^2 x
        return `${FN_TEX[a.fn][locale]}^{${go(b)}}${argumentTex(a.args[0]!, locale)}`;
      }
      const base = a.t === 'num' && a.v >= 0 ? go(a) : child(a, PREC.atom);
      return `${base}^{${go(b)}}`;
    }
    case 'call': {
      const [x, base] = node.args as [Node, Node | undefined];
      if (node.fn === 'sqrt') return `\\sqrt{${go(x)}}`;
      if (node.fn === 'cbrt') return `\\sqrt[3]{${go(x)}}`;
      if (node.fn === 'abs') return `\\left|${go(x)}\\right|`;
      if (node.fn === 'log' && base) return `\\log_{${go(base)}}${argumentTex(x, locale)}`;
      return `${FN_TEX[node.fn][locale]}${argumentTex(x, locale)}`;
    }
  }
}

function rightGap(left: Node, right: Node): string {
  // sin x · cos x style juxtaposition needs a thin space to stay readable.
  if (left.t === 'call' || right.t === 'call') return '\\,';
  return '';
}

function argumentTex(arg: Node, locale: Locale): string {
  return isSimpleArgument(arg) ? `\\,${toTex(arg, locale)}` : wrap(toTex(arg, locale));
}
