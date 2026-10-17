import { L, type Generator, type SolutionStep } from '@lemma/core';
import { gen, mapL, mc, nz, step } from './helpers';
import { FN_WORD, QUADRANT_IN, chainL, degTex, exact, fnL, fromDeg, parTex, piTex, type Fn } from './trig-kit';

/** The open interval of one quadrant, in each language's notation. */
function quadrantIntervalL(q: 1 | 2 | 3 | 4): L {
  const [lo, hi] = {
    1: ['0', '\\frac{\\pi}{2}'],
    2: ['\\frac{\\pi}{2}', '\\pi'],
    3: ['\\pi', '\\frac{3\\pi}{2}'],
    4: ['\\frac{3\\pi}{2}', '2\\pi'],
  }[q] as [string, string];
  return L(`\\left(${lo};\\,${hi}\\right)`, `\\left(${lo},\\,${hi}\\right)`);
}

const sinSign = (q: number): 1 | -1 => (q <= 2 ? 1 : -1);
const cosSign = (q: number): 1 | -1 => (q === 1 || q === 4 ? 1 : -1);

/** ±p/q as TeX and as parser input. */
const ratioTex = (sign: number, p: number, q: number): string => `${sign < 0 ? '-' : ''}\\frac{${p}}{${q}}`;
const ratioIn = (sign: number, p: number, q: number): string => `${sign < 0 ? '-' : ''}${p}/${q}`;

/** A negative factor gets brackets: 2 · (−3/5). */
const bracketNegative = (tex: string): string => (tex.startsWith('-') ? `\\left(${tex}\\right)` : tex);

/** The angle in the given quadrant whose sine has size a/h, as parser input (for the oracle). */
function angleIn(q: number, a: number, h: number): string {
  const acute = `asin(${a}/${h})`;
  return q === 1 ? acute : q === 2 ? `(pi-${acute})` : q === 3 ? `(pi+${acute})` : `(2*pi-${acute})`;
}

const TRIPLES: readonly (readonly [number, number, number])[] = [
  [3, 4, 5],
  [4, 3, 5],
  [5, 12, 13],
  [12, 5, 13],
  [8, 15, 17],
  [15, 8, 17],
  [7, 24, 25],
  [24, 7, 25],
];

// ------------------------------------------------------------------ constant-valued

interface ConstantTemplate {
  level: 2 | 3;
  tex: L;
  /** Parser input in x, for the oracle. */
  input: string;
  value: number;
  hints: [L, L];
  solution: SolutionStep[];
}

const TG = L('\\operatorname{tg}', '\\tan');
const COTG = L('\\operatorname{cotg}', '\\cot');
/** Build a bilingual formula from a template that names tg and cotg. */
const both = (make: (tg: string, cotg: string) => string): L => L(make(TG.cs, COTG.cs), make(TG.en, COTG.en));
const PYTHAGORAS = L('Základ je vztah $\\sin^2 x + \\cos^2 x = 1$.', 'The basis is $\\sin^2 x + \\cos^2 x = 1$.');
const QUOTIENT_HINT = L(
  `Rozepiš $${TG.cs}\\,x = \\dfrac{\\sin x}{\\cos x}$ a $${COTG.cs}\\,x = \\dfrac{\\cos x}{\\sin x}$.`,
  `Write $${TG.en}\\,x = \\dfrac{\\sin x}{\\cos x}$ and $${COTG.en}\\,x = \\dfrac{\\cos x}{\\sin x}$.`,
);

/** Expressions that collapse to a number. k and m vary so that the answer cannot be guessed. */
export function constantTemplates(k: number, m: number, a: number, b: number): ConstantTemplate[] {
  const tail = m === 0 ? '' : m > 0 ? ` + ${m}` : ` - ${-m}`;
  return [
    {
      level: 2,
      tex: L(`${k}\\sin^2 x + ${k}\\cos^2 x${tail}`, `${k}\\sin^2 x + ${k}\\cos^2 x${tail}`),
      input: `${k}*sin(x)^2+${k}*cos(x)^2+(${m})`,
      value: k + m,
      hints: [L(`Vytkni ${k}.`, `Factor out ${k}.`), PYTHAGORAS],
      solution: [
        step(
          `Vytkneme ${k} a použijeme $\\sin^2 x + \\cos^2 x = 1$:`,
          `Factor out ${k} and use $\\sin^2 x + \\cos^2 x = 1$:`,
          `${k}\\left(\\sin^2 x + \\cos^2 x\\right)${tail} = ${k}${tail} = ${k + m}`,
        ),
      ],
    },
    {
      level: 2,
      tex: L(`(${k}\\sin x)^2 + (${k}\\cos x)^2`, `(${k}\\sin x)^2 + (${k}\\cos x)^2`),
      input: `(${k}*sin(x))^2+(${k}*cos(x))^2`,
      value: k * k,
      hints: [
        L('Umocni každou závorku: umocňuje se i číslo.', 'Square each bracket: the number is squared too.'),
        PYTHAGORAS,
      ],
      solution: [
        step(
          'Umocníme a vytkneme:',
          'Square and factor:',
          `${k * k}\\sin^2 x + ${k * k}\\cos^2 x = ${k * k}\\left(\\sin^2 x + \\cos^2 x\\right) = ${k * k}`,
        ),
      ],
    },
    {
      level: 2,
      tex: both((tg, cotg) => `${k}\\,${tg}\\,x \\cdot ${cotg}\\,x${tail}`),
      input: `${k}*tan(x)*cot(x)+(${m})`,
      value: k + m,
      hints: [QUOTIENT_HINT, L('Zlomky se navzájem vykrátí.', 'The fractions cancel each other.')],
      solution: [
        step(
          'Tangens a kotangens jsou navzájem převrácené hodnoty, jejich součin je 1:',
          'Tangent and cotangent are reciprocals, so their product is 1:',
          `${k} \\cdot \\frac{\\sin x}{\\cos x} \\cdot \\frac{\\cos x}{\\sin x}${tail} = ${k}${tail} = ${k + m}`,
        ),
      ],
    },
    {
      level: 2,
      tex: L(`\\frac{${k} - ${k}\\sin^2 x}{\\cos^2 x}`, `\\frac{${k} - ${k}\\sin^2 x}{\\cos^2 x}`),
      input: `(${k}-${k}*sin(x)^2)/cos(x)^2`,
      value: k,
      hints: [
        L(`V čitateli vytkni ${k}.`, `Factor ${k} out of the numerator.`),
        L('$1 - \\sin^2 x = \\cos^2 x$', '$1 - \\sin^2 x = \\cos^2 x$'),
      ],
      solution: [
        step(
          'Vytkneme, nahradíme a zkrátíme:',
          'Factor, substitute and cancel:',
          `\\frac{${k}\\left(1 - \\sin^2 x\\right)}{\\cos^2 x} = \\frac{${k}\\cos^2 x}{\\cos^2 x} = ${k}`,
        ),
      ],
    },
    {
      level: 2,
      tex: L(`${k}(1 - \\cos x)(1 + \\cos x) + ${k}\\cos^2 x`, `${k}(1 - \\cos x)(1 + \\cos x) + ${k}\\cos^2 x`),
      input: `${k}*(1-cos(x))*(1+cos(x))+${k}*cos(x)^2`,
      value: k,
      hints: [
        L('Součin závorek je rozdíl čtverců.', 'The product of the brackets is a difference of squares.'),
        L('$(1 - \\cos x)(1 + \\cos x) = 1 - \\cos^2 x$', '$(1 - \\cos x)(1 + \\cos x) = 1 - \\cos^2 x$'),
      ],
      solution: [
        step(
          'Rozdíl čtverců, pak se kosiny odečtou:',
          'A difference of squares, then the cosines cancel:',
          `${k}\\left(1 - \\cos^2 x\\right) + ${k}\\cos^2 x = ${k}`,
        ),
      ],
    },
    {
      level: 3,
      tex: L(
        `(${a}\\sin x + ${b}\\cos x)^2 + (${b}\\sin x - ${a}\\cos x)^2`,
        `(${a}\\sin x + ${b}\\cos x)^2 + (${b}\\sin x - ${a}\\cos x)^2`,
      ),
      input: `(${a}*sin(x)+${b}*cos(x))^2+(${b}*sin(x)-${a}*cos(x))^2`,
      value: a * a + b * b,
      hints: [
        L(
          'Umocni obě závorky podle $(u \\pm v)^2 = u^2 \\pm 2uv + v^2$.',
          'Square both brackets with $(u \\pm v)^2 = u^2 \\pm 2uv + v^2$.',
        ),
        L(
          'Smíšené členy $\\sin x\\cos x$ mají opačná znaménka a odečtou se.',
          'The mixed terms in $\\sin x\\cos x$ have opposite signs and cancel.',
        ),
      ],
      solution: [
        step(
          'Umocníme:',
          'Square:',
          `${a * a}\\sin^2 x + ${2 * a * b}\\sin x\\cos x + ${b * b}\\cos^2 x + ${b * b}\\sin^2 x - ${2 * a * b}\\sin x\\cos x + ${a * a}\\cos^2 x`,
        ),
        step(
          'Smíšené členy se odečtou, zbytek vytkneme:',
          'The mixed terms cancel; factor the rest:',
          `${a * a + b * b}\\left(\\sin^2 x + \\cos^2 x\\right) = ${a * a + b * b}`,
        ),
      ],
    },
    {
      level: 3,
      tex: both((tg) => `\\frac{${k}}{\\cos^2 x} - ${k}\\,${tg}^2 x`),
      input: `${k}/cos(x)^2-${k}*tan(x)^2`,
      value: k,
      hints: [
        QUOTIENT_HINT,
        L(
          'Po převedení na společného jmenovatele vznikne v čitateli $1 - \\sin^2 x$.',
          'Over a common denominator the numerator becomes $1 - \\sin^2 x$.',
        ),
      ],
      solution: [
        step(
          'Společný jmenovatel:',
          'A common denominator:',
          `\\frac{${k}}{\\cos^2 x} - \\frac{${k}\\sin^2 x}{\\cos^2 x} = \\frac{${k}\\left(1 - \\sin^2 x\\right)}{\\cos^2 x} = \\frac{${k}\\cos^2 x}{\\cos^2 x} = ${k}`,
        ),
      ],
    },
    {
      level: 3,
      tex: both((tg) => `${k}\\cos^2 x\\,\\left(1 + ${tg}^2 x\\right)`),
      input: `${k}*cos(x)^2*(1+tan(x)^2)`,
      value: k,
      hints: [L('Roznásob závorku.', 'Expand the bracket.'), QUOTIENT_HINT],
      solution: [
        step(
          'Roznásobíme, tangens rozepíšeme:',
          'Expand and write out the tangent:',
          `${k}\\cos^2 x + ${k}\\cos^2 x \\cdot \\frac{\\sin^2 x}{\\cos^2 x} = ${k}\\cos^2 x + ${k}\\sin^2 x = ${k}`,
        ),
      ],
    },
    {
      level: 3,
      tex: L(`${k}\\sin^4 x - ${k}\\cos^4 x + ${2 * k}\\cos^2 x`, `${k}\\sin^4 x - ${k}\\cos^4 x + ${2 * k}\\cos^2 x`),
      input: `${k}*sin(x)^4-${k}*cos(x)^4+${2 * k}*cos(x)^2`,
      value: k,
      hints: [
        L('$\\sin^4 x - \\cos^4 x$ je rozdíl čtverců.', '$\\sin^4 x - \\cos^4 x$ is a difference of squares.'),
        L(
          '$\\sin^4 x - \\cos^4 x = (\\sin^2 x - \\cos^2 x)(\\sin^2 x + \\cos^2 x)$',
          '$\\sin^4 x - \\cos^4 x = (\\sin^2 x - \\cos^2 x)(\\sin^2 x + \\cos^2 x)$',
        ),
      ],
      solution: [
        step(
          'Rozdíl čtverců, druhá závorka je 1:',
          'A difference of squares; the second bracket is 1:',
          `${k}\\left(\\sin^2 x - \\cos^2 x\\right) + ${2 * k}\\cos^2 x`,
        ),
        step('Sečteme kosiny:', 'Collect the cosines:', `${k}\\sin^2 x + ${k}\\cos^2 x = ${k}`),
      ],
    },
    {
      level: 3,
      tex: L(`\\frac{${k}\\sin^2 x}{1 - \\cos x} - ${k}\\cos x`, `\\frac{${k}\\sin^2 x}{1 - \\cos x} - ${k}\\cos x`),
      input: `${k}*sin(x)^2/(1-cos(x))-${k}*cos(x)`,
      value: k,
      hints: [
        L('Nahraď $\\sin^2 x = 1 - \\cos^2 x$.', 'Replace $\\sin^2 x = 1 - \\cos^2 x$.'),
        L(
          '$1 - \\cos^2 x = (1 - \\cos x)(1 + \\cos x)$ — a zlomek se zkrátí.',
          '$1 - \\cos^2 x = (1 - \\cos x)(1 + \\cos x)$ — and the fraction cancels.',
        ),
      ],
      solution: [
        step(
          'Rozložíme čitatele a zkrátíme:',
          'Factor the numerator and cancel:',
          `\\frac{${k}(1 - \\cos x)(1 + \\cos x)}{1 - \\cos x} - ${k}\\cos x = ${k}(1 + \\cos x) - ${k}\\cos x = ${k}`,
        ),
      ],
    },
    {
      level: 3,
      tex: L(`(\\sin x + \\cos x)^2 - 2\\sin x\\cos x${tail}`, `(\\sin x + \\cos x)^2 - 2\\sin x\\cos x${tail}`),
      input: `(sin(x)+cos(x))^2-2*sin(x)*cos(x)+(${m})`,
      value: 1 + m,
      hints: [
        L('Umocni závorku: $(u + v)^2 = u^2 + 2uv + v^2$.', 'Square the bracket: $(u + v)^2 = u^2 + 2uv + v^2$.'),
        PYTHAGORAS,
      ],
      solution: [
        step(
          'Umocníme, smíšený člen se odečte:',
          'Square; the mixed term cancels:',
          `\\sin^2 x + 2\\sin x\\cos x + \\cos^2 x - 2\\sin x\\cos x${tail} = 1${tail} = ${1 + m}`,
        ),
      ],
    },
  ];
}

// --------------------------------------------------------------------- simplify (choice)

export interface SimplifyTemplate {
  level: 3 | 4;
  tex: L;
  /** Parser input in x. */
  input: string;
  answer: Fn;
  solution: L;
  /** The LaTeX of the worked simplification, if the text alone is not enough. */
  work?: L;
}

export const SIMPLIFY_TEMPLATES: SimplifyTemplate[] = [
  {
    level: 3,
    tex: both((tg) => `${tg}\\,x \\cdot \\cos x`),
    input: 'tan(x)*cos(x)',
    answer: 'sin',
    solution: L('Tangens rozepíšeme a kosinus se zkrátí.', 'Write out the tangent; the cosine cancels.'),
    work: L('\\frac{\\sin x}{\\cos x} \\cdot \\cos x = \\sin x', '\\frac{\\sin x}{\\cos x} \\cdot \\cos x = \\sin x'),
  },
  {
    level: 3,
    tex: both((_, cotg) => `${cotg}\\,x \\cdot \\sin x`),
    input: 'cot(x)*sin(x)',
    answer: 'cos',
    solution: L('Kotangens rozepíšeme a sinus se zkrátí.', 'Write out the cotangent; the sine cancels.'),
    work: L('\\frac{\\cos x}{\\sin x} \\cdot \\sin x = \\cos x', '\\frac{\\cos x}{\\sin x} \\cdot \\sin x = \\cos x'),
  },
  {
    level: 3,
    tex: both((tg) => `\\dfrac{\\sin x}{${tg}\\,x}`),
    input: 'sin(x)/tan(x)',
    answer: 'cos',
    solution: L(
      'Dělit zlomkem znamená násobit převráceným.',
      'Dividing by a fraction means multiplying by its reciprocal.',
    ),
    work: L('\\sin x \\cdot \\frac{\\cos x}{\\sin x} = \\cos x', '\\sin x \\cdot \\frac{\\cos x}{\\sin x} = \\cos x'),
  },
  {
    level: 3,
    tex: both((_, cotg) => `\\dfrac{\\cos x}{${cotg}\\,x}`),
    input: 'cos(x)/cot(x)',
    answer: 'sin',
    solution: L(
      'Dělit zlomkem znamená násobit převráceným.',
      'Dividing by a fraction means multiplying by its reciprocal.',
    ),
    work: L('\\cos x \\cdot \\frac{\\sin x}{\\cos x} = \\sin x', '\\cos x \\cdot \\frac{\\sin x}{\\cos x} = \\sin x'),
  },
  {
    level: 3,
    tex: L('\\dfrac{1 - \\cos^2 x}{\\sin x\\cos x}', '\\dfrac{1 - \\cos^2 x}{\\sin x\\cos x}'),
    input: '(1-cos(x)^2)/(sin(x)*cos(x))',
    answer: 'tan',
    solution: L('Čitatel je $\\sin^2 x$, jeden sinus se zkrátí.', 'The numerator is $\\sin^2 x$; one sine cancels.'),
    work: L(
      '\\frac{\\sin^2 x}{\\sin x\\cos x} = \\frac{\\sin x}{\\cos x}',
      '\\frac{\\sin^2 x}{\\sin x\\cos x} = \\frac{\\sin x}{\\cos x}',
    ),
  },
  {
    level: 3,
    tex: L('\\dfrac{1 - \\sin^2 x}{\\sin x\\cos x}', '\\dfrac{1 - \\sin^2 x}{\\sin x\\cos x}'),
    input: '(1-sin(x)^2)/(sin(x)*cos(x))',
    answer: 'cot',
    solution: L(
      'Čitatel je $\\cos^2 x$, jeden kosinus se zkrátí.',
      'The numerator is $\\cos^2 x$; one cosine cancels.',
    ),
    work: L(
      '\\frac{\\cos^2 x}{\\sin x\\cos x} = \\frac{\\cos x}{\\sin x}',
      '\\frac{\\cos^2 x}{\\sin x\\cos x} = \\frac{\\cos x}{\\sin x}',
    ),
  },
  {
    level: 3,
    tex: L('\\dfrac{\\sin x\\cos x}{1 - \\sin^2 x}', '\\dfrac{\\sin x\\cos x}{1 - \\sin^2 x}'),
    input: 'sin(x)*cos(x)/(1-sin(x)^2)',
    answer: 'tan',
    solution: L(
      'Jmenovatel je $\\cos^2 x$, jeden kosinus se zkrátí.',
      'The denominator is $\\cos^2 x$; one cosine cancels.',
    ),
    work: L(
      '\\frac{\\sin x\\cos x}{\\cos^2 x} = \\frac{\\sin x}{\\cos x}',
      '\\frac{\\sin x\\cos x}{\\cos^2 x} = \\frac{\\sin x}{\\cos x}',
    ),
  },
  {
    level: 3,
    tex: L('\\dfrac{\\sin x\\cos x}{1 - \\cos^2 x}', '\\dfrac{\\sin x\\cos x}{1 - \\cos^2 x}'),
    input: 'sin(x)*cos(x)/(1-cos(x)^2)',
    answer: 'cot',
    solution: L(
      'Jmenovatel je $\\sin^2 x$, jeden sinus se zkrátí.',
      'The denominator is $\\sin^2 x$; one sine cancels.',
    ),
    work: L(
      '\\frac{\\sin x\\cos x}{\\sin^2 x} = \\frac{\\cos x}{\\sin x}',
      '\\frac{\\sin x\\cos x}{\\sin^2 x} = \\frac{\\cos x}{\\sin x}',
    ),
  },
  {
    level: 4,
    tex: L('\\dfrac{\\cos^2 x}{1 - \\sin x} - 1', '\\dfrac{\\cos^2 x}{1 - \\sin x} - 1'),
    input: 'cos(x)^2/(1-sin(x))-1',
    answer: 'sin',
    solution: L(
      '$\\cos^2 x = 1 - \\sin^2 x = (1 - \\sin x)(1 + \\sin x)$, zlomek se zkrátí.',
      '$\\cos^2 x = 1 - \\sin^2 x = (1 - \\sin x)(1 + \\sin x)$, and the fraction cancels.',
    ),
    work: L('(1 + \\sin x) - 1 = \\sin x', '(1 + \\sin x) - 1 = \\sin x'),
  },
  {
    level: 4,
    tex: L('1 - \\dfrac{\\sin^2 x}{1 + \\cos x}', '1 - \\dfrac{\\sin^2 x}{1 + \\cos x}'),
    input: '1-sin(x)^2/(1+cos(x))',
    answer: 'cos',
    solution: L(
      '$\\sin^2 x = (1 - \\cos x)(1 + \\cos x)$, zlomek se zkrátí.',
      '$\\sin^2 x = (1 - \\cos x)(1 + \\cos x)$, and the fraction cancels.',
    ),
    work: L('1 - (1 - \\cos x) = \\cos x', '1 - (1 - \\cos x) = \\cos x'),
  },
  {
    level: 4,
    tex: both((tg) => `\\dfrac{\\sin x + ${tg}\\,x}{1 + \\cos x}`),
    input: '(sin(x)+tan(x))/(1+cos(x))',
    answer: 'tan',
    solution: L(
      'V čitateli vytkneme $\\sin x$ a závorku převedeme na společného jmenovatele.',
      'Factor $\\sin x$ out of the numerator and put the bracket over a common denominator.',
    ),
    work: L(
      '\\frac{\\sin x\\left(1 + \\frac{1}{\\cos x}\\right)}{1 + \\cos x} = \\frac{\\sin x \\cdot \\frac{\\cos x + 1}{\\cos x}}{1 + \\cos x} = \\frac{\\sin x}{\\cos x}',
      '\\frac{\\sin x\\left(1 + \\frac{1}{\\cos x}\\right)}{1 + \\cos x} = \\frac{\\sin x \\cdot \\frac{\\cos x + 1}{\\cos x}}{1 + \\cos x} = \\frac{\\sin x}{\\cos x}',
    ),
  },
  {
    level: 4,
    tex: both((tg, cotg) => `\\sin^2 x\\cos x\\,\\left(${tg}\\,x + ${cotg}\\,x\\right)`),
    input: 'sin(x)^2*cos(x)*(tan(x)+cot(x))',
    answer: 'sin',
    solution: L(
      'Závorku převedeme na společného jmenovatele: čitatel je $\\sin^2 x + \\cos^2 x = 1$.',
      'Put the bracket over a common denominator: its numerator is $\\sin^2 x + \\cos^2 x = 1$.',
    ),
    work: L(
      '\\sin^2 x\\cos x \\cdot \\frac{1}{\\sin x\\cos x} = \\sin x',
      '\\sin^2 x\\cos x \\cdot \\frac{1}{\\sin x\\cos x} = \\sin x',
    ),
  },
  {
    level: 4,
    tex: both((tg) => `\\dfrac{${tg}\\,x}{1 + ${tg}^2 x} \\cdot \\dfrac{1}{\\sin x}`),
    input: 'tan(x)/(1+tan(x)^2)/sin(x)',
    answer: 'cos',
    solution: L(
      '$1 + \\operatorname{tg}^2 x = \\dfrac{1}{\\cos^2 x}$, takže první zlomek je $\\sin x\\cos x$.',
      '$1 + \\tan^2 x = \\dfrac{1}{\\cos^2 x}$, so the first fraction is $\\sin x\\cos x$.',
    ),
    work: L('\\sin x\\cos x \\cdot \\frac{1}{\\sin x} = \\cos x', '\\sin x\\cos x \\cdot \\frac{1}{\\sin x} = \\cos x'),
  },
];

// ------------------------------------------------------------------------- sum formulas

/** 15°-family angles written as a sum or difference of two standard angles. */
const SPLITS: readonly { deg: number; a: number; b: number; plus: boolean }[] = [
  { deg: 75, a: 45, b: 30, plus: true },
  { deg: 15, a: 45, b: 30, plus: false },
  { deg: 105, a: 60, b: 45, plus: true },
  { deg: 165, a: 120, b: 45, plus: true },
  { deg: 195, a: 150, b: 45, plus: true },
  { deg: 255, a: 210, b: 45, plus: true },
  { deg: 285, a: 240, b: 45, plus: true },
  { deg: 345, a: 300, b: 45, plus: true },
];

/** ±(√6 ± √2)/4: the only sizes a sine or cosine of these angles can have. */
function quarterForm(value: number): { tex: string; input: string } {
  const forms = [
    { tex: '\\frac{\\sqrt{6} + \\sqrt{2}}{4}', input: '(sqrt(6)+sqrt(2))/4', value: (Math.sqrt(6) + Math.SQRT2) / 4 },
    { tex: '\\frac{\\sqrt{6} - \\sqrt{2}}{4}', input: '(sqrt(6)-sqrt(2))/4', value: (Math.sqrt(6) - Math.SQRT2) / 4 },
    { tex: '\\frac{\\sqrt{2} - \\sqrt{6}}{4}', input: '(sqrt(2)-sqrt(6))/4', value: (Math.SQRT2 - Math.sqrt(6)) / 4 },
    {
      tex: '-\\frac{\\sqrt{6} + \\sqrt{2}}{4}',
      input: '-(sqrt(6)+sqrt(2))/4',
      value: -(Math.sqrt(6) + Math.SQRT2) / 4,
    },
  ];
  return forms.find((form) => Math.abs(form.value - value) < 1e-9)!;
}

const SPOT_CASES: {
  task: string;
  lines: string[];
  wrong: number;
  error: 'formula' | 'algebra' | 'sign';
  cs: string;
  en: string;
}[] = [
  {
    task: '(\\sin x + \\cos x)^2',
    lines: ['(\\sin x + \\cos x)^2 = \\sin^2 x + \\cos^2 x', '= 1'],
    wrong: 0,
    error: 'formula',
    cs: 'Chybí smíšený člen: $(u + v)^2 = u^2 + 2uv + v^2$. Správně vyjde $1 + 2\\sin x\\cos x$.',
    en: 'The mixed term is missing: $(u + v)^2 = u^2 + 2uv + v^2$. The correct result is $1 + 2\\sin x\\cos x$.',
  },
  {
    task: '\\sin 75^{\\circ}',
    lines: [
      '\\sin 75^{\\circ} = \\sin(45^{\\circ} + 30^{\\circ})',
      '= \\sin 45^{\\circ} + \\sin 30^{\\circ}',
      '= \\frac{\\sqrt{2}}{2} + \\frac{1}{2}',
    ],
    wrong: 1,
    error: 'formula',
    cs: 'Sinus součtu není součet sinů: $\\sin(\\alpha + \\beta) = \\sin\\alpha\\cos\\beta + \\cos\\alpha\\sin\\beta$. Výsledek z třetího řádku je navíc větší než 1.',
    en: 'The sine of a sum is not the sum of the sines: $\\sin(\\alpha + \\beta) = \\sin\\alpha\\cos\\beta + \\cos\\alpha\\sin\\beta$. Besides, the result on line three exceeds 1.',
  },
  {
    task: '\\cos 2x',
    lines: ['\\cos 2x = \\cos^2 x - \\sin^2 x', '= \\left(1 - \\sin^2 x\\right) - \\sin^2 x', '= 1 - \\sin^2 x'],
    wrong: 2,
    error: 'algebra',
    cs: 'První dva řádky jsou správně. Dva stejné členy se ale sčítají: $1 - 2\\sin^2 x$.',
    en: 'The first two lines are right. But two equal terms add up: $1 - 2\\sin^2 x$.',
  },
  {
    task: '\\dfrac{\\sin 2x}{\\sin x}',
    lines: ['\\dfrac{\\sin 2x}{\\sin x} = \\dfrac{2\\sin x}{\\sin x}', '= 2'],
    wrong: 0,
    error: 'formula',
    cs: 'Dvojku nelze ze sinu „vytknout“: $\\sin 2x = 2\\sin x\\cos x$. Správně vyjde $2\\cos x$.',
    en: 'The 2 cannot be pulled out of the sine: $\\sin 2x = 2\\sin x\\cos x$. The correct result is $2\\cos x$.',
  },
  {
    task: '\\dfrac{\\sin^2 x}{\\cos^2 x} + 1',
    lines: [
      '\\dfrac{\\sin^2 x}{\\cos^2 x} + 1 = \\dfrac{\\sin^2 x + 1}{\\cos^2 x}',
      '= \\dfrac{2 - \\cos^2 x}{\\cos^2 x}',
    ],
    wrong: 0,
    error: 'algebra',
    cs: 'Jednička se musí rozšířit na stejného jmenovatele: $1 = \\frac{\\cos^2 x}{\\cos^2 x}$. Správně vyjde $\\frac{\\sin^2 x + \\cos^2 x}{\\cos^2 x} = \\frac{1}{\\cos^2 x}$.',
    en: 'The 1 has to be written over the same denominator: $1 = \\frac{\\cos^2 x}{\\cos^2 x}$. The correct result is $\\frac{\\sin^2 x + \\cos^2 x}{\\cos^2 x} = \\frac{1}{\\cos^2 x}$.',
  },
  {
    task: '\\sin(x + \\pi)',
    lines: [
      '\\sin(x + \\pi) = \\sin x\\cos\\pi + \\cos x\\sin\\pi',
      '= \\sin x \\cdot 1 + \\cos x \\cdot 0',
      '= \\sin x',
    ],
    wrong: 1,
    error: 'sign',
    cs: 'Vzorec je správně, ale $\\cos\\pi = -1$. Vyjde $\\sin(x + \\pi) = -\\sin x$: po půlotáčce je bod na kružnici přesně naproti.',
    en: 'The formula is right, but $\\cos\\pi = -1$. So $\\sin(x + \\pi) = -\\sin x$: after half a turn the point on the circle is exactly opposite.',
  },
  {
    task: '\\cos(60^{\\circ} - 45^{\\circ})',
    lines: [
      '\\cos(60^{\\circ} - 45^{\\circ}) = \\cos 60^{\\circ}\\cos 45^{\\circ} - \\sin 60^{\\circ}\\sin 45^{\\circ}',
      '= \\frac{1}{2} \\cdot \\frac{\\sqrt{2}}{2} - \\frac{\\sqrt{3}}{2} \\cdot \\frac{\\sqrt{2}}{2}',
      '= \\frac{\\sqrt{2} - \\sqrt{6}}{4}',
    ],
    wrong: 0,
    error: 'sign',
    cs: 'U kosinu je znaménko opačné než v závorce: $\\cos(\\alpha - \\beta) = \\cos\\alpha\\cos\\beta + \\sin\\alpha\\sin\\beta$. Kontrola: $\\cos 15^{\\circ}$ musí být kladný.',
    en: 'For the cosine the sign is opposite to the one in the bracket: $\\cos(\\alpha - \\beta) = \\cos\\alpha\\cos\\beta + \\sin\\alpha\\sin\\beta$. Check: $\\cos 15^{\\circ}$ must be positive.',
  },
];

/** Syllabus topic 13: transformations of trigonometric expressions. */
export const TRIG_IDENTITY_GENERATORS: Generator[] = [
  gen({
    id: 'trigid.basic.from-one',
    concept: 'trigid.basic',
    kind: 'core',
    levels: [2, 3],
    title: L('Z jedné funkce ostatní', 'From one function to the others'),
    tags: ['annual-review'],
    est: (lv) => 70 + 30 * (lv - 2),
    make(r, lv) {
      const [a, b, h] = r.pick(TRIPLES);
      const q = r.pick([1, 2, 3, 4] as const);
      const givenSin = r.bool();
      // sin x = ±a/h and cos x = ±b/h, with the signs of the quadrant.
      const [sSign, cSign] = [sinSign(q), cosSign(q)];
      const given = givenSin ? `\\sin x = ${ratioTex(sSign, a, h)}` : `\\cos x = ${ratioTex(cSign, b, h)}`;
      const interval = quadrantIntervalL(q);
      const otherWord = givenSin ? FN_WORD.cos : FN_WORD.sin;
      const [otherSign, otherTop] = givenSin ? [cSign, b] : [sSign, a];
      const [givenTop, otherName, givenName] = givenSin ? [a, '\\cos', '\\sin'] : [b, '\\sin', '\\cos'];
      const squareStep = step(
        `Ze vztahu $\\sin^2 x + \\cos^2 x = 1$:`,
        `From $\\sin^2 x + \\cos^2 x = 1$:`,
        `${otherName}^2 x = 1 - ${givenName}^2 x = 1 - \\frac{${givenTop * givenTop}}{${h * h}} = \\frac{${otherTop * otherTop}}{${h * h}}`,
      );
      const signStep = step(
        `${QUADRANT_IN[q].cs[0]!.toUpperCase()}${QUADRANT_IN[q].cs.slice(1)} je ${otherWord.cs} ${otherSign < 0 ? 'záporný' : 'kladný'}:`,
        `${QUADRANT_IN[q].en[0]!.toUpperCase()}${QUADRANT_IN[q].en.slice(1)} the ${otherWord.en} is ${otherSign < 0 ? 'negative' : 'positive'}:`,
        `${otherName} x = ${ratioTex(otherSign, otherTop, h)}`,
      );
      const x = angleIn(q, a, h);

      if (lv === 2) {
        return {
          prompt: L(
            `Je dáno $${given}$ a $x \\in ${interval.cs}$. Určete $${otherName} x$.`,
            `Given $${given}$ and $x \\in ${interval.en}$, find $${otherName} x$.`,
          ),
          answer: { kind: 'number', value: ratioIn(otherSign, otherTop, h), label: `${otherName} x =` },
          hints: [
            L(
              'Sinus a kosinus téhož úhlu váže vztah $\\sin^2 x + \\cos^2 x = 1$.',
              'The sine and cosine of the same angle are tied by $\\sin^2 x + \\cos^2 x = 1$.',
            ),
            L(
              `Odmocnina dá dvě možnosti, $\\pm$. Znaménko určí kvadrant: kde leží $${interval.cs}$?`,
              `The square root gives two options, $\\pm$. The quadrant decides the sign: where does $${interval.en}$ lie?`,
            ),
          ],
          solution: [squareStep, signStep],
          misconceptions: [
            mc(
              ratioIn(-otherSign, otherTop, h),
              'sign',
              `Velikost sedí, znaménko ne: ${QUADRANT_IN[q].cs} je ${otherWord.cs} ${otherSign < 0 ? 'záporný' : 'kladný'}.`,
              `The size is right, the sign is not: ${QUADRANT_IN[q].en} the ${otherWord.en} is ${otherSign < 0 ? 'negative' : 'positive'}.`,
            ),
            mc(
              `1-${givenTop}/${h}`,
              'formula',
              'Vztah platí pro druhé mocniny: $\\sin^2 x + \\cos^2 x = 1$, ne $\\sin x + \\cos x = 1$.',
              'The identity is about squares: $\\sin^2 x + \\cos^2 x = 1$, not $\\sin x + \\cos x = 1$.',
            ),
            mc(
              `${otherTop * otherTop}/${h * h}`,
              'incomplete',
              'To je druhá mocnina. Ještě odmocnit a určit znaménko.',
              'That is the square. Take the root and decide the sign.',
            ),
          ],
          verify: [{ kind: 'value', expr: `${givenSin ? 'cos' : 'sin'}(${x})` }],
        };
      }
      const tanSign = sSign * cSign;
      return {
        prompt: L(
          `Je dáno $${given}$ a $x \\in ${interval.cs}$. Určete $${TG.cs}\\,x$.`,
          `Given $${given}$ and $x \\in ${interval.en}$, find $${TG.en}\\,x$.`,
        ),
        answer: { kind: 'number', value: ratioIn(tanSign, a, b) },
        hints: [
          L(
            `Nejdřív dopočítej $${otherName} x$ ze vztahu $\\sin^2 x + \\cos^2 x = 1$ — se správným znaménkem pro daný kvadrant.`,
            `First find $${otherName} x$ from $\\sin^2 x + \\cos^2 x = 1$ — with the right sign for the quadrant.`,
          ),
          L('Tangens je podíl sinu a kosinu.', 'Tangent is sine over cosine.'),
        ],
        solution: [
          squareStep,
          signStep,
          step(
            'Tangens je podíl sinu a kosinu:',
            'Tangent is sine over cosine:',
            mapL(
              TG,
              (tg) =>
                `${tg}\\,x = \\frac{\\sin x}{\\cos x} = \\frac{${ratioTex(sSign, a, h)}}{${ratioTex(cSign, b, h)}} = ${ratioTex(tanSign, a, b)}`,
            ),
          ),
        ],
        misconceptions: [
          mc(
            ratioIn(-tanSign, a, b),
            'sign',
            `Velikost sedí, znaménko ne. Urči znaménka sinu i kosinu ${QUADRANT_IN[q].cs}.`,
            `The size is right, the sign is not. Find the signs of both sine and cosine ${QUADRANT_IN[q].en}.`,
          ),
          mc(
            ratioIn(tanSign, b, a),
            'concept',
            'To je kotangens: tangens je sinus lomeno kosinus, ne naopak.',
            'That is the cotangent: tangent is sine over cosine, not the other way round.',
          ),
          mc(
            ratioIn(otherSign, otherTop, h),
            'incomplete',
            `To je $${otherName} x$. Ptali se na tangens.`,
            `That is $${otherName} x$. The tangent was asked for.`,
          ),
        ],
        verify: [{ kind: 'value', expr: `tan(${x})` }],
      };
    },
  }),

  gen({
    id: 'trigid.basic.constant',
    concept: 'trigid.basic',
    kind: 'core',
    levels: [2, 3],
    title: L('Výraz, ze kterého zbude číslo', 'An expression that collapses to a number'),
    est: (lv) => 70 + 40 * (lv - 2),
    make(r, lv) {
      const k = r.int(2, 6);
      const m = nz(r, -4, 5);
      const a = r.int(1, 4);
      const b = r.intExcept(1, 4, [a]);
      const template = r.pick(constantTemplates(k, m, a, b).filter((item) => item.level === lv));
      return {
        prompt: L(
          `Zjednodušte (pro všechna $x$, pro která má výraz smysl). Výsledkem je číslo.\n\n$$${template.tex.cs}$$`,
          `Simplify (for all $x$ where the expression is defined). The result is a number.\n\n$$${template.tex.en}$$`,
        ),
        answer: { kind: 'number', value: `${template.value}` },
        hints: template.hints,
        solution: template.solution,
        misconceptions: [
          mc(
            '1',
            'incomplete',
            'Jednička vyjde jen ze samotného $\\sin^2 x + \\cos^2 x$. Co se stalo s čísly kolem?',
            'A plain 1 comes only from $\\sin^2 x + \\cos^2 x$ itself. What happened to the numbers around it?',
          ),
          mc(
            '0',
            'sign',
            'Zkontroluj znaménka: členy se neodečtou všechny.',
            'Check the signs: not everything cancels.',
          ),
        ],
        // The same value at two unrelated angles: it really is a constant.
        verify: [
          { kind: 'value', expr: template.input, env: { x: 0.7 } },
          { kind: 'value', expr: template.input, env: { x: 2.3 } },
        ],
      };
    },
  }),

  gen({
    id: 'trigid.basic.simplify',
    concept: 'trigid.basic',
    kind: 'core',
    levels: [3, 4],
    title: L('Zjednodušení goniometrického výrazu', 'Simplifying a trigonometric expression'),
    est: (lv) => 80 + 40 * (lv - 3),
    make(r, lv) {
      const template = r.pick(SIMPLIFY_TEMPLATES.filter((item) => item.level === lv));
      const options = (['sin', 'cos', 'tan', 'cot'] as const).map((fn) => ({
        id: fn,
        text: L(`$${fnL(fn, 'x').cs}$`, `$${fnL(fn, 'x').en}$`),
      }));
      const reciprocal = { sin: 'cos', cos: 'sin', tan: 'cot', cot: 'tan' }[template.answer];
      return {
        prompt: L(
          `Kterému z výrazů se rovná (pro všechna $x$, pro která má smysl)?\n\n$$${template.tex.cs}$$`,
          `Which expression is it equal to (for all $x$ where it is defined)?\n\n$$${template.tex.en}$$`,
        ),
        answer: { kind: 'choice', options, correct: [template.answer], fixedOrder: true },
        hints: [
          L(
            `Všechno převeď na sinus a kosinus: $${TG.cs}\\,x = \\dfrac{\\sin x}{\\cos x}$, $${COTG.cs}\\,x = \\dfrac{\\cos x}{\\sin x}$.`,
            `Rewrite everything in sines and cosines: $${TG.en}\\,x = \\dfrac{\\sin x}{\\cos x}$, $${COTG.en}\\,x = \\dfrac{\\cos x}{\\sin x}$.`,
          ),
          L(
            'Kde vidíš $1 - \\sin^2 x$ nebo $1 - \\cos^2 x$, nahraď to druhou mocninou druhé funkce. Pak krať.',
            'Wherever you see $1 - \\sin^2 x$ or $1 - \\cos^2 x$, replace it by the square of the other function. Then cancel.',
          ),
          L(
            'Kontrola dosazením: zkus $x = 45^{\\circ}$ nebo $x = 30^{\\circ}$ a porovnej hodnoty.',
            'Check by substitution: try $x = 45^{\\circ}$ or $x = 30^{\\circ}$ and compare the values.',
          ),
        ],
        solution: [
          { text: template.solution, math: template.work },
          step('Výsledek:', 'The result:', chainL([template.tex, fnL(template.answer, 'x')])),
        ],
        misconceptions: [
          mc(
            reciprocal,
            'algebra',
            'Skoro: vyšla ti „sesterská“ funkce. Zkontroluj, co zůstalo v čitateli a co ve jmenovateli.',
            'Close: you got the partner function. Check what was left in the numerator and what in the denominator.',
          ),
        ],
      };
    },
  }),

  gen({
    id: 'trigid.sum.exact',
    concept: 'trigid.sum',
    kind: 'core',
    levels: [3, 4],
    title: L('Přesná hodnota pomocí součtových vzorců', 'An exact value through the sum formulas'),
    est: (lv) => 110 + 30 * (lv - 3),
    make(r, lv) {
      const split = r.pick(lv === 3 ? SPLITS.slice(0, 3) : SPLITS.slice(2));
      const fn = r.pick(['sin', 'cos'] as const);
      const show = (deg: number): string => (lv === 3 ? degTex(deg) : piTex(fromDeg(deg)));
      const value = (fn === 'sin' ? Math.sin : Math.cos)((split.deg * Math.PI) / 180);
      const result = quarterForm(value);
      const [sa, ca, sb, cb] = [
        exact('sin', split.a)!,
        exact('cos', split.a)!,
        exact('sin', split.b)!,
        exact('cos', split.b)!,
      ];
      const op = split.plus ? '+' : '-';
      // sin(α ± β) = sin α cos β ± cos α sin β;  cos(α ± β) = cos α cos β ∓ sin α sin β.
      const inner = fn === 'sin' ? op : split.plus ? '-' : '+';
      const formula =
        fn === 'sin'
          ? `\\sin\\alpha\\cos\\beta ${inner} \\cos\\alpha\\sin\\beta`
          : `\\cos\\alpha\\cos\\beta ${inner} \\sin\\alpha\\sin\\beta`;
      const [first, second] =
        fn === 'sin'
          ? [
              [sa, cb],
              [ca, sb],
            ]
          : [
              [ca, cb],
              [sa, sb],
            ];
      const substituted = `${parTex(first![0]!)} \\cdot ${parTex(first![1]!)} ${inner} ${parTex(second![0]!)} \\cdot ${parTex(second![1]!)}`;
      const [fa, fb] = fn === 'sin' ? [sa, sb] : [ca, cb];
      return {
        prompt: L(
          `Určete přesnou hodnotu (bez kalkulačky): $\\${fn} ${show(split.deg)}$`,
          `Find the exact value (without a calculator): $\\${fn} ${show(split.deg)}$`,
        ),
        answer: { kind: 'number', value: result.input, placeholder: '(sqrt(6)+sqrt(2))/4' },
        hints: [
          L(
            `Tento úhel v tabulce není, ale dá se složit ze dvou tabulkových: $${show(split.deg)} = ${show(split.a)} ${op} ${show(split.b)}$.`,
            `This angle is not in the table, but it is made of two that are: $${show(split.deg)} = ${show(split.a)} ${op} ${show(split.b)}$.`,
          ),
          L(
            `Vzorec: $\\${fn}(\\alpha ${op} \\beta) = ${formula}$`,
            `The formula: $\\${fn}(\\alpha ${op} \\beta) = ${formula}$`,
          ),
        ],
        solution: [
          step(
            'Úhel rozložíme na tabulkové:',
            'Split the angle into table angles:',
            `${show(split.deg)} = ${show(split.a)} ${op} ${show(split.b)}`,
          ),
          step('Součtový vzorec:', 'The sum formula:', `\\${fn}(\\alpha ${op} \\beta) = ${formula}`),
          step(
            'Dosadíme přesné hodnoty a upravíme:',
            'Substitute the exact values and tidy up:',
            `${substituted} = ${result.tex}`,
          ),
        ],
        misconceptions: [
          mc(
            `(${fa.input})${op}(${fb.input})`,
            'formula',
            `${fn === 'sin' ? 'Sinus' : 'Kosinus'} ${split.plus ? 'součtu není součet' : 'rozdílu není rozdíl'} ${fn === 'sin' ? 'sinů' : 'kosinů'}. Použij součtový vzorec.`,
            `The ${fn === 'sin' ? 'sine' : 'cosine'} of a ${split.plus ? 'sum is not the sum' : 'difference is not the difference'} of the ${fn === 'sin' ? 'sines' : 'cosines'}. Use the sum formula.`,
          ),
          mc(
            quarterForm((fn === 'sin' ? Math.cos : Math.sin)((split.deg * Math.PI) / 180)).input,
            'formula',
            'To je hodnota druhé funkce: zkontroluj, který vzorec a které znaménko patří k sinu a které ke kosinu.',
            'That is the value of the other function: check which formula and which sign belong to the sine and which to the cosine.',
          ),
        ],
        verify: [{ kind: 'value', expr: `${fn}(${split.deg}*pi/180)` }],
      };
    },
  }),

  gen({
    id: 'trigid.sum.double',
    concept: 'trigid.sum',
    kind: 'core',
    levels: [3, 4],
    title: L('Dvojnásobný úhel', 'The double angle'),
    est: (lv) => 100 + 30 * (lv - 3),
    make(r, lv) {
      const [a, b, h] = r.pick(TRIPLES);
      const q = r.pick(lv === 3 ? ([1, 2] as const) : ([2, 3, 4] as const));
      const [sSign, cSign] = [sinSign(q), cosSign(q)];
      const givenSin = r.bool();
      const given = givenSin ? `\\sin x = ${ratioTex(sSign, a, h)}` : `\\cos x = ${ratioTex(cSign, b, h)}`;
      const interval = quadrantIntervalL(q);
      const target = lv === 3 ? r.pick(['sin', 'cos'] as const) : r.pick(['sin', 'cos', 'tan'] as const);
      const x = angleIn(q, a, h);
      const [sinTex, cosTex] = [ratioTex(sSign, a, h), ratioTex(cSign, b, h)];
      const sin2 = { sign: sSign * cSign, top: 2 * a * b, bottom: h * h };
      const cos2 = { sign: Math.sign(b * b - a * a), top: Math.abs(b * b - a * a), bottom: h * h };
      const otherStep = step(
        `Druhou funkci dopočítáme z $\\sin^2 x + \\cos^2 x = 1$; znaménko určí kvadrant (${QUADRANT_IN[q].cs}):`,
        `Find the other function from $\\sin^2 x + \\cos^2 x = 1$; the quadrant (${QUADRANT_IN[q].en}) decides the sign:`,
        givenSin ? `\\cos x = ${cosTex}` : `\\sin x = ${sinTex}`,
      );
      const sinStep = step(
        'Sinus dvojnásobného úhlu:',
        'The sine of the double angle:',
        `\\sin 2x = 2\\sin x\\cos x = 2 \\cdot ${bracketNegative(sinTex)} \\cdot ${bracketNegative(cosTex)} = ${ratioTex(sin2.sign, sin2.top, sin2.bottom)}`,
      );
      const cosStep = step(
        'Kosinus dvojnásobného úhlu:',
        'The cosine of the double angle:',
        `\\cos 2x = \\cos^2 x - \\sin^2 x = \\frac{${b * b}}{${h * h}} - \\frac{${a * a}}{${h * h}} = ${ratioTex(cos2.sign, cos2.top, cos2.bottom)}`,
      );
      const hints = [
        L(
          'Budeš potřebovat sinus i kosinus úhlu $x$. Jeden je dán, druhý dopočítej — pozor na znaménko v daném kvadrantu.',
          'You will need both the sine and the cosine of $x$. One is given; find the other — mind its sign in that quadrant.',
        ),
        L(
          '$\\sin 2x = 2\\sin x\\cos x$, $\\cos 2x = \\cos^2 x - \\sin^2 x$',
          '$\\sin 2x = 2\\sin x\\cos x$, $\\cos 2x = \\cos^2 x - \\sin^2 x$',
        ),
      ];
      const prompt = (name: L): L =>
        L(
          `Je dáno $${given}$ a $x \\in ${interval.cs}$. Určete $${name.cs}\\,2x$.`,
          `Given $${given}$ and $x \\in ${interval.en}$, find $${name.en}\\,2x$.`,
        );

      if (target === 'sin') {
        return {
          prompt: prompt(L('\\sin', '\\sin')),
          answer: { kind: 'number', value: ratioIn(sin2.sign, sin2.top, sin2.bottom), label: '\\sin 2x =' },
          hints,
          solution: [otherStep, sinStep],
          misconceptions: [
            mc(
              ratioIn(sSign, 2 * a, h),
              'formula',
              'Sinus dvojnásobného úhlu není dvojnásobek sinu: $\\sin 2x = 2\\sin x\\cos x$.',
              'The sine of a double angle is not twice the sine: $\\sin 2x = 2\\sin x\\cos x$.',
            ),
            mc(
              ratioIn(-sin2.sign, sin2.top, sin2.bottom),
              'sign',
              `Velikost sedí. Zkontroluj znaménko druhé funkce ${QUADRANT_IN[q].cs}.`,
              `The size is right. Check the sign of the other function ${QUADRANT_IN[q].en}.`,
            ),
            mc(
              ratioIn(sin2.sign, a * b, h * h),
              'incomplete',
              'Chybí dvojka: $\\sin 2x = 2\\sin x\\cos x$.',
              'The factor 2 is missing: $\\sin 2x = 2\\sin x\\cos x$.',
            ),
          ],
          verify: [{ kind: 'value', expr: `sin(2*${x})` }],
        };
      }
      if (target === 'cos') {
        return {
          prompt: prompt(L('\\cos', '\\cos')),
          answer: { kind: 'number', value: ratioIn(cos2.sign, cos2.top, cos2.bottom), label: '\\cos 2x =' },
          hints,
          solution: [otherStep, cosStep],
          misconceptions: [
            mc(
              ratioIn(cSign, 2 * b, h),
              'formula',
              'Kosinus dvojnásobného úhlu není dvojnásobek kosinu: $\\cos 2x = \\cos^2 x - \\sin^2 x$.',
              'The cosine of a double angle is not twice the cosine: $\\cos 2x = \\cos^2 x - \\sin^2 x$.',
            ),
            mc(
              ratioIn(-cos2.sign, cos2.top, cos2.bottom),
              'sign',
              'Pořadí: $\\cos^2 x - \\sin^2 x$, ne naopak.',
              'The order: $\\cos^2 x - \\sin^2 x$, not the other way round.',
            ),
            mc(
              '1',
              'formula',
              'To je $\\cos^2 x + \\sin^2 x$. U dvojnásobného úhlu je mezi nimi minus.',
              'That is $\\cos^2 x + \\sin^2 x$. For the double angle there is a minus between them.',
            ),
          ],
          verify: [{ kind: 'value', expr: `cos(2*${x})` }],
        };
      }
      const tan2Sign = sin2.sign * cos2.sign;
      return {
        prompt: prompt(TG),
        answer: { kind: 'number', value: ratioIn(tan2Sign, sin2.top, cos2.top) },
        hints: [
          ...hints,
          L(
            'Tangens je podíl sinu a kosinu — i pro úhel $2x$.',
            'Tangent is sine over cosine — for the angle $2x$ as well.',
          ),
        ],
        solution: [
          otherStep,
          sinStep,
          cosStep,
          step(
            'Tangens je jejich podíl:',
            'The tangent is their quotient:',
            mapL(TG, (tg) => `${tg}\\,2x = \\frac{\\sin 2x}{\\cos 2x} = ${ratioTex(tan2Sign, sin2.top, cos2.top)}`),
          ),
        ],
        misconceptions: [
          mc(
            ratioIn(sSign * cSign, 2 * a, b),
            'formula',
            'Tangens dvojnásobného úhlu není dvojnásobek tangens.',
            'The tangent of a double angle is not twice the tangent.',
          ),
          mc(
            ratioIn(-tan2Sign, sin2.top, cos2.top),
            'sign',
            'Velikost sedí, znaménko ne. Zkontroluj znaménka $\\sin 2x$ a $\\cos 2x$.',
            'The size is right, the sign is not. Check the signs of $\\sin 2x$ and $\\cos 2x$.',
          ),
        ],
        verify: [{ kind: 'value', expr: `tan(2*${x})` }],
      };
    },
  }),

  gen({
    id: 'trigid.sum.find-mistake',
    concept: 'trigid.sum',
    kind: 'debug',
    levels: [3],
    title: L('Najdi chybu: goniometrické vzorce', 'Find the mistake: trigonometric formulas'),
    est: 80,
    make(r) {
      const chosen = r.pick(SPOT_CASES);
      return {
        prompt: L(
          `Někdo upravoval výraz $${chosen.task}$. Ve kterém řádku je první chyba?`,
          `Someone transformed $${chosen.task}$. Which line contains the first mistake?`,
        ),
        answer: {
          kind: 'spot',
          lines: chosen.lines.map((tex) => ({ tex })),
          wrongLine: chosen.wrong,
          errorType: chosen.error,
        },
        hints: [
          L(
            'U každého řádku si řekni, který vzorec nebo úprava se použila — a jestli opravdu platí.',
            'For each line, say which formula or step was used — and whether it really holds.',
          ),
          L(
            'Podezřelý řádek ověř dosazením konkrétního úhlu, třeba $30^{\\circ}$.',
            'Test a suspicious line by substituting a concrete angle, say $30^{\\circ}$.',
          ),
        ],
        solution: [step(chosen.cs, chosen.en)],
      };
    },
  }),
];
