import { describe, expect, it } from 'vitest';
import { expressionsEquivalent, hasForm, numbersEqual } from '../src/math/compare';
import { evalComplex, evalReal } from '../src/math/evaluate';
import { fAdd, fDiv, fToInput, fToTex, frac } from '../src/math/frac';
import { polyIn, polyTex } from '../src/math/format';
import {
  complementOf,
  intervalSetToTex,
  intervalSetsEqual,
  parseIntervalSet,
  type IntervalSet,
} from '../src/math/interval';
import { splitList } from '../src/math/lists';
import { ParseError, parse, tryParse } from '../src/math/parse';
import { toTex } from '../src/math/tex';

const value = (input: string, env: Record<string, number> = {}): number => evalReal(parse(input), env);

describe('parser: arithmetic and precedence', () => {
  it.each([
    ['1+2*3', 7],
    ['(1+2)*3', 9],
    ['2^3^2', 512],
    ['-2^2', -4],
    ['(-2)^2', 4],
    ['2^-1', 0.5],
    ['10-4-3', 3],
    ['12/4/3', 1],
    ['6 : 2', 3],
    ['2·3', 6],
    ['2×3', 6],
    ['7 − 10', -3],
    ['+5', 5],
    ['--5', 5],
  ])('%s = %d', (input, expected) => {
    expect(value(input)).toBeCloseTo(expected, 12);
  });
});

describe('parser: Czech and typed notation', () => {
  it('reads a decimal comma', () => {
    expect(value('2,5')).toBe(2.5);
    expect(value('2,5 + 0,5')).toBe(3);
    expect(value('2.5')).toBe(2.5);
  });

  it('treats a comma as a separator when decimal commas are off', () => {
    expect(evalReal(parse('log(8, 2)', { decimalComma: false }))).toBeCloseTo(3, 12);
  });

  it('understands implicit multiplication', () => {
    expect(value('2x', { x: 3 })).toBe(6);
    expect(value('2(x+1)', { x: 3 })).toBe(8);
    expect(value('(x+1)(x-1)', { x: 3 })).toBe(8);
    expect(value('xy', { x: 3, y: 4 })).toBe(12);
    expect(value('2x^2', { x: 3 })).toBe(18);
    expect(value('x(x+4)', { x: 2 })).toBe(12);
    expect(value('3pi')).toBeCloseTo(3 * Math.PI, 12);
  });

  it('understands Czech function names', () => {
    expect(value('tg(pi/4)')).toBeCloseTo(1, 12);
    expect(value('cotg(pi/4)')).toBeCloseTo(1, 12);
    expect(value('arctg(1)')).toBeCloseTo(Math.PI / 4, 12);
  });

  it('applies functions without parentheses', () => {
    expect(value('sin x', { x: 1 })).toBeCloseTo(Math.sin(1), 12);
    expect(value('sin 2x', { x: 1 })).toBeCloseTo(Math.sin(2), 12);
    expect(value('2 sin x cos x', { x: 0.7 })).toBeCloseTo(Math.sin(1.4), 12);
    expect(value('sin^2 x + cos^2 x', { x: 0.3 })).toBeCloseTo(1, 12);
    expect(value('sin²x', { x: 0.3 })).toBeCloseTo(Math.sin(0.3) ** 2, 12);
    expect(value('ln e')).toBeCloseTo(1, 12);
    expect(value('sinx', { x: 1 })).toBeCloseTo(Math.sin(1), 12);
  });

  it('uses base 10 for log and supports other bases', () => {
    expect(value('log 100')).toBeCloseTo(2, 12);
    expect(value('log(1000)')).toBeCloseTo(3, 12);
    expect(value('log_2(8)')).toBeCloseTo(3, 12);
    expect(value('log2(8)')).toBeCloseTo(3, 12);
    expect(value('log_2 8')).toBeCloseTo(3, 12);
    expect(value('log_{10}(100)')).toBeCloseTo(2, 12);
    expect(value('log(8; 2)')).toBeCloseTo(3, 12);
    expect(value('ln(e^3)')).toBeCloseTo(3, 12);
  });

  it('reads Unicode symbols', () => {
    expect(value('x²', { x: 3 })).toBe(9);
    expect(value('x⁻¹', { x: 4 })).toBe(0.25);
    expect(value('√16')).toBe(4);
    expect(value('2√3')).toBeCloseTo(2 * Math.sqrt(3), 12);
    // A root sign takes only what stands right after it; brackets extend it.
    expect(value('√2 x', { x: 3 })).toBeCloseTo(Math.SQRT2 * 3, 12);
    expect(value('√2x', { x: 8 })).toBeCloseTo(Math.SQRT2 * 8, 12);
    expect(value('√(2x)', { x: 8 })).toBe(4);
    expect(value('√2/2')).toBeCloseTo(Math.SQRT1_2, 12);
    expect(value('∛8 x', { x: 5 })).toBeCloseTo(10, 12);
    // The word form keeps the reading of other named functions.
    expect(value('sqrt 2x', { x: 8 })).toBe(4);
    expect(value('π/2')).toBeCloseTo(Math.PI / 2, 12);
    expect(value('30°')).toBeCloseTo(Math.PI / 6, 12);
  });

  it('parses absolute value bars, including nesting and products', () => {
    expect(value('|x-3|', { x: 1 })).toBe(2);
    expect(value('||x|-3|', { x: -1 })).toBe(2);
    expect(value('|x||y|', { x: -2, y: -3 })).toBe(6);
    expect(value('2|x|+1', { x: -4 })).toBe(9);
    expect(value('abs(x-3)', { x: 1 })).toBe(2);
    expect(value('|x-1|-|x+1|', { x: 0 })).toBe(0);
  });

  it('treats e and i according to context', () => {
    expect(value('e^1')).toBeCloseTo(Math.E, 12);
    expect(evalReal(parse('e+1', { variables: ['e'] }), { e: 5 })).toBe(6);
    const z = evalComplex(parse('(1+i)^2', { complex: true }));
    expect(z.re).toBeCloseTo(0, 12);
    expect(z.im).toBeCloseTo(2, 12);
  });
});

describe('parser: errors', () => {
  it.each([
    ['', 'empty'],
    ['2+', 'missing-operand'],
    ['(2+3', 'missing-paren'],
    ['2+3)', 'missing-paren'],
    ['|x', 'unbalanced-bar'],
    ['2 # 3', 'unexpected-char'],
    ['sin', 'missing-argument'],
  ])('rejects %j with %s', (input, code) => {
    const result = tryParse(input);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe(code);
  });

  it('throws ParseError from parse()', () => {
    expect(() => parse('2+')).toThrow(ParseError);
  });
});

describe('evaluation: undefined values', () => {
  it('returns NaN outside the real domain', () => {
    expect(value('1/0')).toBeNaN();
    expect(value('sqrt(-1)')).toBeNaN();
    expect(value('ln(0)')).toBeNaN();
    expect(value('log(-5)')).toBeNaN();
    expect(value('(-8)^(1/3)')).toBeNaN();
    expect(value('0^0')).toBeNaN();
    expect(value('tg(pi/2)')).toBeNaN();
    expect(value('arcsin(2)')).toBeNaN();
  });

  it('keeps defined edge cases', () => {
    expect(value('cbrt(-8)')).toBeCloseTo(-2, 12);
    expect(value('(-2)^3')).toBe(-8);
    expect(value('0^2')).toBe(0);
  });
});

describe('complex evaluation', () => {
  const z = (input: string) => evalComplex(parse(input, { complex: true }));

  it('handles algebraic and trigonometric form', () => {
    expect(z('(3-2i)(1+i)')).toMatchObject({ re: 5, im: 1 });
    const polar = z('2(cos(pi/3)+i*sin(pi/3))');
    expect(polar.re).toBeCloseTo(1, 12);
    expect(polar.im).toBeCloseTo(Math.sqrt(3), 12);
  });

  it('raises to integer powers exactly (Moivre)', () => {
    const w = z('(1+i)^8');
    expect(w.re).toBe(16);
    expect(w.im).toBe(0);
  });

  it('divides', () => {
    const w = z('(1+i)/(1-i)');
    expect(w.re).toBeCloseTo(0, 12);
    expect(w.im).toBeCloseTo(1, 12);
  });
});

describe('expression equivalence', () => {
  const eq = (a: string, b: string, vars = ['x']) => expressionsEquivalent(parse(a), parse(b), { vars }).equal;

  it('accepts algebraically equal forms', () => {
    expect(eq('x^2-4x+3', '(x-1)(x-3)')).toBe(true);
    expect(eq('x^2-4x+3', '(x-2)^2-1')).toBe(true);
    expect(eq('2(x+1)', '2x+2')).toBe(true);
    expect(eq('sin(2x)', '2 sin x cos x')).toBe(true);
    expect(eq('1/(2x)', '0,5/x')).toBe(true);
    expect(eq('sqrt(x^2)', '|x|')).toBe(true);
    expect(eq('log(x^2)', '2 log x')).toBe(false); // differs for x < 0: left defined, right not
  });

  it('rejects different functions', () => {
    expect(eq('x^2-4x+3', 'x^2-4x-3')).toBe(false);
    expect(eq('x^2', 'x^3')).toBe(false);
    expect(eq('2x+1', '2x-1')).toBe(false);
    expect(eq('|x|', 'x')).toBe(false);
  });

  it('accepts a removable singularity in the answer', () => {
    expect(eq('x+1', '(x^2-1)/(x-1)')).toBe(true);
  });

  it('reports unexpected symbols', () => {
    const result = expressionsEquivalent(parse('2x'), parse('2y'), { vars: ['x'] });
    expect(result).toMatchObject({ equal: false, reason: 'symbol', symbol: 'y' });
  });

  it('compares constants', () => {
    expect(expressionsEquivalent(parse('sqrt(8)'), parse('2sqrt(2)'), { vars: [] }).equal).toBe(true);
    expect(expressionsEquivalent(parse('1/3'), parse('0.3333'), { vars: [] }).equal).toBe(false);
  });

  it('is deterministic', () => {
    const a = parse('x^3-x');
    const b = parse('x(x-1)(x+1)');
    const first = expressionsEquivalent(a, b, { vars: ['x'] });
    for (let i = 0; i < 5; i++) expect(expressionsEquivalent(a, b, { vars: ['x'] })).toEqual(first);
  });
});

describe('expression forms', () => {
  it('recognises expanded form', () => {
    expect(hasForm(parse('x^2-4x+3'), 'expanded')).toBe(true);
    expect(hasForm(parse('(x-1)(x-3)'), 'expanded')).toBe(false);
    expect(hasForm(parse('(x-2)^2-1'), 'expanded')).toBe(false);
    expect(hasForm(parse('2(x+1)'), 'expanded')).toBe(false);
    expect(hasForm(parse('2x+2'), 'expanded')).toBe(true);
  });

  it('recognises factored form', () => {
    expect(hasForm(parse('(x-1)(x-3)'), 'factored')).toBe(true);
    expect(hasForm(parse('2(x-1)(x+3)'), 'factored')).toBe(true);
    expect(hasForm(parse('(x-2)^2'), 'factored')).toBe(true);
    expect(hasForm(parse('x(x+4)'), 'factored')).toBe(true);
    expect(hasForm(parse('-(x-1)(x+2)'), 'factored')).toBe(true);
    expect(hasForm(parse('x^2-4x+3'), 'factored')).toBe(false);
    expect(hasForm(parse('2(x^2-4)'), 'factored')).toBe(false);
  });

  it('recognises vertex form', () => {
    expect(hasForm(parse('(x-2)^2-1'), 'vertex')).toBe(true);
    expect(hasForm(parse('-2(x+1)^2+5'), 'vertex')).toBe(true);
    expect(hasForm(parse('x^2-4x+3'), 'vertex')).toBe(false);
    expect(hasForm(parse('(x-1)(x-3)'), 'vertex')).toBe(false);
  });
});

describe('numbers', () => {
  it('compares with relative tolerance', () => {
    expect(numbersEqual(0.1 + 0.2, 0.3)).toBe(true);
    expect(numbersEqual(1e12 + 1, 1e12)).toBe(true);
    expect(numbersEqual(1, 1.001)).toBe(false);
    expect(numbersEqual(NaN, NaN)).toBe(false);
  });
});

describe('fractions', () => {
  it('normalises', () => {
    expect(frac(6, -4)).toEqual({ n: -3, d: 2 });
    expect(frac(0, 5)).toEqual({ n: 0, d: 1 });
    expect(Object.is(frac(0, -5).n, 0)).toBe(true);
  });

  it('does arithmetic and formats', () => {
    expect(fAdd(frac(1, 2), frac(1, 3))).toEqual({ n: 5, d: 6 });
    expect(fDiv(frac(3), frac(-6))).toEqual({ n: -1, d: 2 });
    expect(fToTex(frac(-3, 2))).toBe('-\\frac{3}{2}');
    expect(fToInput(frac(-3, 2))).toBe('-3/2');
    expect(fToTex(frac(4, 2))).toBe('2');
  });
});

describe('polynomial formatting', () => {
  it('writes display form', () => {
    expect(polyTex([1, -4, 3])).toBe('x^{2} - 4x + 3');
    expect(polyTex([-1, 0, 1])).toBe('-x^{2} + 1');
    expect(polyTex([2, 1, 0])).toBe('2x^{2} + x');
    expect(polyTex([0, 0, 0])).toBe('0');
    expect(polyTex([frac(1, 2), -1])).toBe('\\frac{1}{2}x - 1');
  });

  it('writes parser input that evaluates to the same polynomial', () => {
    const cases: number[][] = [[1, -4, 3], [-1, 0, 1], [2, 1, 0], [3], [-2, 5]];
    for (const coeffs of cases) {
      const node = parse(polyIn(coeffs));
      for (const x of [-2, 0, 0.5, 3]) {
        const expected = coeffs.reduce((acc, c) => acc * x + c, 0);
        expect(evalReal(node, { x })).toBeCloseTo(expected, 10);
      }
    }
    expect(evalReal(parse(polyIn([frac(1, 2), -1])), { x: 4 })).toBe(1);
  });
});

describe('list splitting', () => {
  it('prefers semicolons', () => {
    expect(splitList('1; 2,5; 3', true)).toEqual({ ok: true, parts: ['1', '2,5', '3'] });
  });

  it('splits on loose commas and keeps tight ones as decimals', () => {
    expect(splitList('1, 2', true)).toEqual({ ok: true, parts: ['1', '2'] });
    expect(splitList('1,5, 2,5', true)).toEqual({ ok: true, parts: ['1,5', '2,5'] });
  });

  it('refuses a genuinely ambiguous comma', () => {
    expect(splitList('1,2', true)).toEqual({ ok: false, reason: 'ambiguous-comma' });
  });

  it('resolves the ambiguity when the item count is known', () => {
    expect(splitList('1,2', true, 2)).toEqual({ ok: true, parts: ['1', '2'] });
    expect(splitList('1,2', true, 1)).toEqual({ ok: true, parts: ['1,2'] });
  });

  it('treats every comma as a separator without decimal commas', () => {
    expect(splitList('1,2', false)).toEqual({ ok: true, parts: ['1', '2'] });
  });

  it('ignores separators inside brackets', () => {
    expect(splitList('log(8; 2); 3', true)).toEqual({ ok: true, parts: ['log(8; 2)', '3'] });
  });
});

describe('intervals', () => {
  const set = (input: string): IntervalSet => {
    const result = parseIntervalSet(input);
    if (!result.ok) throw new Error(`${input}: ${result.code}`);
    return result.set;
  };
  const same = (a: string, b: string) => intervalSetsEqual(set(a), set(b));

  it('reads Czech and English brackets as the same interval', () => {
    expect(same('<1; 3)', '[1, 3)')).toBe(true);
    expect(same('⟨1; 3⟩', '[1; 3]')).toBe(true);
    expect(same('(1;3)', '(1, 3)')).toBe(true);
    expect(same('<1; 3)', '(1; 3>')).toBe(false);
  });

  it('reads infinities', () => {
    expect(same('(-inf; 2>', '(-∞; 2]')).toBe(true);
    expect(same('<3; inf)', '[3, +oo)')).toBe(true);
    expect(same('(-inf; inf)', 'R')).toBe(true);
  });

  it('reads unions in any order and merges overlaps', () => {
    expect(same('(-inf; 2> u <3; inf)', '<3; inf) ∪ (-inf; 2>')).toBe(true);
    expect(same('(1; 3) u <3; 5)', '(1; 5)')).toBe(true);
    expect(same('(1; 3) u (3; 5)', '(1; 5)')).toBe(false);
    expect(same('(1; 4) nebo (2; 6>', '(1; 6>')).toBe(true);
  });

  it('reads set difference and point sets', () => {
    expect(same('R \\ {2}', '(-inf; 2) u (2; inf)')).toBe(true);
    expect(same('R - {0; 1}', '(-inf; 0) u (0; 1) u (1; inf)')).toBe(true);
    expect(same('<0; 5> \\ {5}', '<0; 5)')).toBe(true);
    expect(set('{1; 2}')).toHaveLength(2);
    expect(set('{}')).toEqual([]);
    expect(set('∅')).toEqual([]);
  });

  it('ignores common prefixes', () => {
    expect(same('x ∈ (1; 2)', '(1; 2)')).toBe(true);
    expect(same('D(f) = R \\ {2}', 'R \\ {2}')).toBe(true);
    expect(same('H = <-1; inf)', '<-1; inf)')).toBe(true);
  });

  it('reads inequality notation', () => {
    expect(same('x > 2', '(2; inf)')).toBe(true);
    expect(same('x <= -1', '(-inf; -1>')).toBe(true);
    expect(same('x ≥ 0', '<0; inf)')).toBe(true);
    expect(same('1 < x <= 3', '(1; 3>')).toBe(true);
  });

  it('evaluates exact endpoints', () => {
    const s = set('<-sqrt(2); pi/2)');
    expect(s[0]!.lo).toBeCloseTo(-Math.SQRT2, 12);
    expect(s[0]!.hi).toBeCloseTo(Math.PI / 2, 12);
  });

  it('handles decimal commas in endpoints', () => {
    expect(same('(1,5; 2,5)', '(1.5; 2.5)')).toBe(true);
    expect(same('(1,5)', '(1; 5)')).toBe(true);
    expect(same('(1,5, 3)', '(1.5; 3)')).toBe(true);
  });

  it('rejects malformed input', () => {
    expect(parseIntervalSet('1; 3')).toMatchObject({ ok: false, code: 'bracket' });
    expect(parseIntervalSet('(3; 1)')).toMatchObject({ ok: false, code: 'reversed' });
    expect(parseIntervalSet('(1; 2; 3)')).toMatchObject({ ok: false, code: 'endpoints' });
    expect(parseIntervalSet('(a; 3)')).toMatchObject({ ok: false, code: 'endpoint-value' });
    expect(parseIntervalSet('')).toMatchObject({ ok: false, code: 'empty' });
  });

  it('never closes an infinite end', () => {
    expect(set('<-inf; 2>')[0]).toMatchObject({ loClosed: false, hiClosed: true });
  });

  it('computes complements', () => {
    expect(intervalSetsEqual(complementOf(set('(-inf; 2> u <3; inf)')), set('(2; 3)'))).toBe(true);
    expect(intervalSetsEqual(complementOf(set('R')), [])).toBe(true);
    expect(intervalSetsEqual(complementOf([]), set('R'))).toBe(true);
    expect(intervalSetsEqual(complementOf(set('<1; 2)')), set('(-inf; 1) u <2; inf)'))).toBe(true);
  });

  it('renders in both notations', () => {
    expect(intervalSetToTex(set('<1; 3)'), 'cs')).toBe('\\langle 1;\\,3)');
    expect(intervalSetToTex(set('<1; 3)'), 'en')).toBe('[1,\\,3)');
    expect(intervalSetToTex(set('R'), 'cs')).toBe('\\mathbb{R}');
    expect(intervalSetToTex([], 'cs')).toBe('\\emptyset');
  });
});

describe('LaTeX output', () => {
  const tex = (input: string, locale: 'cs' | 'en' = 'en') => toTex(parse(input), locale);

  it('renders the usual shapes', () => {
    expect(tex('x^2-4x+3')).toBe('x^{2} - 4x + 3');
    expect(tex('1/2')).toBe('\\frac{1}{2}');
    expect(tex('2*3')).toBe('2 \\cdot 3');
    expect(tex('(x+1)(x-1)')).toBe('\\left(x + 1\\right)\\left(x - 1\\right)');
    expect(tex('sqrt(x+1)')).toBe('\\sqrt{x + 1}');
    expect(tex('|x-3|')).toBe('\\left|x - 3\\right|');
    expect(tex('-x^2')).toBe('-x^{2}');
    expect(tex('x - (2 - y)')).toBe('x - \\left(2 - y\\right)');
    expect(tex('log_2(8)')).toBe('\\log_{2}\\,8');
    expect(tex('sin^2 x')).toBe('\\sin^{2}\\,x');
  });

  it('puts the sign of a negative fraction in front of the bar', () => {
    expect(tex('-sqrt(2)/2')).toBe('-\\frac{\\sqrt{2}}{2}');
    expect(tex('-1/2')).toBe('-\\frac{1}{2}');
    // …and keeps the result unambiguous wherever a leading minus would collide.
    expect(tex('x + (-1/2)')).toBe('x + \\left(-\\frac{1}{2}\\right)');
    expect(tex('x - (-1/2)')).toBe('x - \\left(-\\frac{1}{2}\\right)');
    expect(tex('2*(-1/2)')).toBe('2 \\cdot \\left(-\\frac{1}{2}\\right)');
    expect(tex('(-1/2)^2')).toBe('\\left(-\\frac{1}{2}\\right)^{2}');
    expect(tex('-(-1/2)')).toBe('-\\left(-\\frac{1}{2}\\right)');
    expect(tex('-(1/2)')).toBe('-\\frac{1}{2}');
    // A product or a sum that opens with a minus is bracketed after an operator as well.
    expect(tex('2 + (-2)*y')).toBe('2 + \\left(-2y\\right)');
    expect(tex('x - (-a + b)')).toBe('x - \\left(-a + b\\right)');
    expect(tex('x + (-a + b)')).toBe('x + \\left(-a + b\\right)');
    expect(tex('3*(-2*x)')).toBe('3 \\cdot \\left(-2x\\right)');
  });

  it('writes a degree argument without brackets', () => {
    expect(tex('sin(45°)')).toBe('\\sin\\,45^{\\circ}');
    expect(tex('8*sin(45°)/sin(30°)')).toBe('\\frac{8\\,\\sin\\,45^{\\circ}}{\\sin\\,30^{\\circ}}');
  });

  it('follows the locale', () => {
    expect(tex('2,5', 'cs')).toBe('2{,}5');
    expect(tex('2,5', 'en')).toBe('2.5');
    expect(tex('tg x', 'cs')).toBe('\\operatorname{tg}\\,x');
    expect(tex('tg x', 'en')).toBe('\\tan\\,x');
  });
});
