import { L, type Locale } from '../i18n';
import type { ErrorType } from '../learning/errors';
import type { FnName, Node } from '../math/ast';
import { functionsOf, usesDegrees, usesImaginary, variablesOf } from '../math/ast';
import { complexEqual, expressionsEquivalent, hasForm, numbersEqual } from '../math/compare';
import { EvalError, evalComplex, evalReal, type Complex } from '../math/evaluate';
import {
  type IntervalSet,
  complementOf,
  intervalSetToTex,
  intervalSetsEqual,
  parseIntervalSet,
  sameEndpoints,
} from '../math/interval';
import { splitList, stripBrackets } from '../math/lists';
import { ParseError, parse, type ParseOptions } from '../math/parse';
import { toTex } from '../math/tex';
import {
  ALGEBRAIC_FORM,
  AS_FRACTION,
  AMBIGUOUS_COMMA,
  CHOOSE_OPTION,
  FINISH_COMPUTING,
  GIVE_EXACT,
  IN_RADIANS,
  REDUCE_FRACTION,
  NOT_A_NUMBER,
  POINT_DIMENSIONS,
  describeIntervalError,
  describeParseError,
  unexpectedSymbol,
  wrongForm,
} from './messages';
import type { AnswerSpec, Misconception, PublicAnswerSpec } from './types';

export interface CheckContext {
  /** Read "2,5" as 2.5. Default true (Czech notation). */
  decimalComma?: boolean;
  locale?: Locale;
}

export interface Diagnosis {
  error: ErrorType;
  /** Specific feedback about what probably happened. */
  note?: L;
  source: 'misconception' | 'heuristic';
  /** Strong: the wrong answer matches a known pattern exactly. */
  strong: boolean;
  /** A prerequisite concept the error points at. */
  skill?: string;
}

export type CheckResult =
  | { verdict: 'correct' }
  | { verdict: 'incorrect'; diagnosis?: Diagnosis }
  /** The input could not be read, or is right but in the wrong form. Not an attempt. */
  | { verdict: 'invalid'; message: L };

type Parsed =
  | { kind: 'number'; node: Node; value: number }
  | { kind: 'expr'; node: Node }
  | { kind: 'set'; all: boolean; nodes: Node[]; values: number[] }
  | { kind: 'interval'; set: IntervalSet }
  | { kind: 'point'; nodes: Node[]; values: number[] }
  | { kind: 'complex'; node: Node; value: Complex }
  | { kind: 'choice'; ids: string[] }
  | { kind: 'spot'; line: number }
  | { kind: 'self'; grade: 'yes' | 'partly' | 'no' };

type ParseOutcome = { ok: true; parsed: Parsed } | { ok: false; message: L };

type Shape = AnswerSpec | PublicAnswerSpec;

const bad = (message: L): ParseOutcome => ({ ok: false, message });

const EMPTY_WORDS = [
  '{}',
  '∅',
  'none',
  'no solution',
  'no solutions',
  'nema reseni',
  'nemá řešení',
  'zadne',
  'žádné',
  'zadne reseni',
  'žádné řešení',
  'prazdna mnozina',
  'prázdná množina',
];
const ALL_WORDS = ['r', 'ℝ', 'all', 'all reals', 'all real numbers', 'vsechna realna cisla', 'všechna reálná čísla'];

function clean(input: string): string {
  return input
    .trim()
    .replace(/^\$+|\$+$/g, '')
    .replace(/[−–—]/g, '-')
    .trim();
}

/** Drop a leading "x =", "y =", "f(x) =", "V =" — whatever precedes the last equals sign. */
function afterEquals(text: string): string {
  const pos = text.lastIndexOf('=');
  return pos >= 0 ? text.slice(pos + 1).trim() : text;
}

function parseExprSafe(text: string, opts: ParseOptions): { node: Node } | { message: L } {
  try {
    return { node: parse(text, opts) };
  } catch (error) {
    if (error instanceof ParseError) return { message: describeParseError(error) };
    throw error;
  }
}

function constantValue(node: Node): { value: number } | { message: L } {
  const vars = variablesOf(node);
  if (vars.size > 0) return { message: unexpectedSymbol([...vars][0]!, []) };
  try {
    const value = evalReal(node, {});
    if (!Number.isFinite(value)) return { message: NOT_A_NUMBER };
    return { value };
  } catch (error) {
    if (error instanceof EvalError) return { message: unexpectedSymbol(error.symbol, []) };
    throw error;
  }
}

function parseConstantList(parts: string[], opts: ParseOptions): { nodes: Node[]; values: number[] } | { message: L } {
  const nodes: Node[] = [];
  const values: number[] = [];
  for (const part of parts) {
    const text = afterEquals(part);
    if (text === '') return { message: describeParseError(new ParseError('empty', 0)) };
    const parsed = parseExprSafe(text, opts);
    if ('message' in parsed) return parsed;
    const value = constantValue(parsed.node);
    if ('message' in value) return value;
    nodes.push(parsed.node);
    values.push(value.value);
  }
  return { nodes, values };
}

function parseInput(shape: Shape, input: string, ctx: CheckContext): ParseOutcome {
  const opts: ParseOptions = { decimalComma: ctx.decimalComma ?? true };
  const text = clean(input);

  switch (shape.kind) {
    case 'number': {
      let body = afterEquals(text);
      if (shape.unit === 'deg') body = body.replace(/°\s*$/, '').trim();
      if (body === '') return bad(describeParseError(new ParseError('empty', 0)));
      const parsed = parseExprSafe(body, opts);
      if ('message' in parsed) return bad(parsed.message);
      const value = constantValue(parsed.node);
      if ('message' in value) return bad(value.message);
      return { ok: true, parsed: { kind: 'number', node: parsed.node, value: value.value } };
    }

    case 'expr': {
      const body = afterEquals(text);
      if (body === '') return bad(describeParseError(new ParseError('empty', 0)));
      const parsed = parseExprSafe(body, { ...opts, variables: shape.vars });
      if ('message' in parsed) return bad(parsed.message);
      const stray = [...variablesOf(parsed.node)].find((name) => !shape.vars.includes(name));
      if (stray) return bad(unexpectedSymbol(stray, shape.vars));
      return { ok: true, parsed: { kind: 'expr', node: parsed.node } };
    }

    case 'set': {
      if (text === '') return bad(describeParseError(new ParseError('empty', 0)));
      // "K = {…}", "x ∈ {…}"
      let body = text.replace(/^[A-Za-z]\s*(?:=|∈|\bin\b)\s*(?=[{∅Rℝ])/, '').trim();
      const lower = body.toLowerCase();
      if (EMPTY_WORDS.includes(lower)) return { ok: true, parsed: { kind: 'set', all: false, nodes: [], values: [] } };
      if (ALL_WORDS.includes(lower)) return { ok: true, parsed: { kind: 'set', all: true, nodes: [], values: [] } };
      body = stripBrackets(body, [['{', '}']]);
      if (body === '') return { ok: true, parsed: { kind: 'set', all: false, nodes: [], values: [] } };
      body = body.replace(/\s+(?:nebo|or|and|a)\s+/gi, ' ; ');
      const split = splitList(body, opts.decimalComma ?? true);
      if (!split.ok) return bad(AMBIGUOUS_COMMA);
      const list = parseConstantList(split.parts, opts);
      if ('message' in list) return bad(list.message);
      // A set has no repeated elements.
      const nodes: Node[] = [];
      const values: number[] = [];
      list.values.forEach((value, index) => {
        if (!values.some((existing) => numbersEqual(existing, value))) {
          values.push(value);
          nodes.push(list.nodes[index]!);
        }
      });
      return { ok: true, parsed: { kind: 'set', all: false, nodes, values } };
    }

    case 'interval': {
      const result = parseIntervalSet(text, opts);
      if (!result.ok) return bad(describeIntervalError(result.code, result.detail));
      return { ok: true, parsed: { kind: 'interval', set: result.set } };
    }

    case 'point': {
      const dims = 'dims' in shape ? shape.dims : shape.coords.length;
      if (text === '') return bad(describeParseError(new ParseError('empty', 0)));
      // "V[2; -1]", "V = [2; -1]", "(2, -1)", "2; -1"
      let body = text.replace(/^[A-Za-z]\w*\s*=?\s*(?=[[(])/, '');
      body = stripBrackets(body, [
        ['[', ']'],
        ['(', ')'],
      ]);
      const split = splitList(body, opts.decimalComma ?? true, dims);
      if (!split.ok) return bad(AMBIGUOUS_COMMA);
      if (split.parts.length !== dims) return bad(POINT_DIMENSIONS(dims));
      const list = parseConstantList(split.parts, opts);
      if ('message' in list) return bad(list.message);
      return { ok: true, parsed: { kind: 'point', nodes: list.nodes, values: list.values } };
    }

    case 'complex': {
      const body = afterEquals(text);
      if (body === '') return bad(describeParseError(new ParseError('empty', 0)));
      const parsed = parseExprSafe(body, { ...opts, complex: true });
      if ('message' in parsed) return bad(parsed.message);
      const vars = variablesOf(parsed.node);
      if (vars.size > 0) return bad(unexpectedSymbol([...vars][0]!, ['i']));
      const value = evalComplex(parsed.node, {});
      if (!Number.isFinite(value.re) || !Number.isFinite(value.im)) return bad(NOT_A_NUMBER);
      return { ok: true, parsed: { kind: 'complex', node: parsed.node, value } };
    }

    case 'choice': {
      const ids = text
        .split(',')
        .map((id) => id.trim())
        .filter((id) => id !== '');
      const known = new Set(shape.options.map((option) => option.id));
      if (ids.length === 0 || ids.some((id) => !known.has(id))) return bad(CHOOSE_OPTION);
      return { ok: true, parsed: { kind: 'choice', ids: [...new Set(ids)].sort() } };
    }

    case 'spot': {
      const line = Number(text);
      if (text === '' || !Number.isInteger(line) || line < 0 || line >= shape.lines.length) return bad(CHOOSE_OPTION);
      return { ok: true, parsed: { kind: 'spot', line } };
    }

    case 'self': {
      if (text !== 'yes' && text !== 'partly' && text !== 'no') return bad(CHOOSE_OPTION);
      return { ok: true, parsed: { kind: 'self', grade: text } };
    }
  }
}

/** The canonical answer of a spec, in parsed form. */
function canonical(spec: AnswerSpec): Parsed {
  const opts: ParseOptions = { decimalComma: false };
  switch (spec.kind) {
    case 'number': {
      const node = parse(spec.value, opts);
      return { kind: 'number', node, value: evalReal(node, {}) };
    }
    case 'expr':
      return { kind: 'expr', node: parse(spec.value, { ...opts, variables: spec.vars }) };
    case 'set': {
      if (spec.values === 'all') return { kind: 'set', all: true, nodes: [], values: [] };
      const nodes = spec.values.map((value) => parse(value, opts));
      return { kind: 'set', all: false, nodes, values: nodes.map((node) => evalReal(node, {})) };
    }
    case 'interval': {
      const result = parseIntervalSet(spec.value, opts);
      if (!result.ok) throw new Error(`invalid canonical interval "${spec.value}": ${result.code}`);
      return { kind: 'interval', set: result.set };
    }
    case 'point': {
      const nodes = spec.coords.map((coord) => parse(coord, opts));
      return { kind: 'point', nodes, values: nodes.map((node) => evalReal(node, {})) };
    }
    case 'complex': {
      const node = parse(spec.value, { ...opts, complex: true });
      return { kind: 'complex', node, value: evalComplex(node, {}) };
    }
    case 'choice':
      return { kind: 'choice', ids: [...spec.correct].sort() };
    case 'spot':
      return { kind: 'spot', line: spec.wrongLine };
    case 'self':
      return { kind: 'self', grade: 'yes' };
  }
}

function sameValues(a: readonly number[], b: readonly number[], tol?: number): boolean {
  if (a.length !== b.length) return false;
  const remaining = [...b];
  for (const value of a) {
    const index = remaining.findIndex((other) => numbersEqual(value, other, tol));
    if (index < 0) return false;
    remaining.splice(index, 1);
  }
  return true;
}

function sameParsed(spec: AnswerSpec, candidate: Parsed, reference: Parsed): boolean {
  if (candidate.kind !== reference.kind) return false;
  switch (candidate.kind) {
    case 'number': {
      const ref = reference as Extract<Parsed, { kind: 'number' }>;
      if (spec.kind === 'number' && spec.tol !== undefined) {
        return Math.abs(candidate.value - ref.value) <= spec.tol + 1e-12;
      }
      return numbersEqual(candidate.value, ref.value);
    }
    case 'expr': {
      const ref = reference as Extract<Parsed, { kind: 'expr' }>;
      const vars = spec.kind === 'expr' ? spec.vars : [];
      return expressionsEquivalent(ref.node, candidate.node, { vars }).equal;
    }
    case 'set': {
      const ref = reference as Extract<Parsed, { kind: 'set' }>;
      if (candidate.all !== ref.all) return false;
      return sameValues(candidate.values, ref.values);
    }
    case 'interval':
      return intervalSetsEqual(candidate.set, (reference as Extract<Parsed, { kind: 'interval' }>).set);
    case 'point': {
      const ref = reference as Extract<Parsed, { kind: 'point' }>;
      return (
        candidate.values.length === ref.values.length &&
        candidate.values.every((value, index) => numbersEqual(value, ref.values[index]!))
      );
    }
    case 'complex':
      return complexEqual(candidate.value, (reference as Extract<Parsed, { kind: 'complex' }>).value);
    case 'choice': {
      const ref = reference as Extract<Parsed, { kind: 'choice' }>;
      return candidate.ids.length === ref.ids.length && candidate.ids.every((id, index) => id === ref.ids[index]);
    }
    case 'spot':
      return candidate.line === (reference as Extract<Parsed, { kind: 'spot' }>).line;
    case 'self':
      return candidate.grade === 'yes';
  }
}

const heuristic = (error: ErrorType, note: L, strong = true): Diagnosis => ({
  error,
  note,
  source: 'heuristic',
  strong,
});

/** Recognise common error patterns from the shape of the wrong answer alone. */
function diagnose(spec: AnswerSpec, candidate: Parsed, reference: Parsed): Diagnosis | undefined {
  if (candidate.kind === 'number' && reference.kind === 'number') {
    const v = candidate.value;
    const c = reference.value;
    if (c !== 0 && numbersEqual(v, -c)) {
      return heuristic('sign', L('Hodnota sedí, znaménko ne.', 'The magnitude is right, the sign is not.'));
    }
    if (spec.kind === 'number' && spec.unit === 'deg' && numbersEqual(v, (c * Math.PI) / 180, 1e-6)) {
      return heuristic(
        'notation',
        L(
          'To je správný úhel, ale v radiánech — ptali se na stupně.',
          'That is the right angle, but in radians — degrees were asked for.',
        ),
      );
    }
    if (c !== 0 && v !== 0 && numbersEqual(v, 1 / c)) {
      return heuristic(
        'algebra',
        L('Vyšla ti převrácená hodnota správného výsledku.', 'You got the reciprocal of the correct result.'),
        false,
      );
    }
    for (const k of [10, 100, 1000]) {
      if (c !== 0 && (numbersEqual(v, c * k) || numbersEqual(v, c / k))) {
        return heuristic(
          'arithmetic',
          L(
            'Číslice sedí, ale řád ne — zkontroluj desetinnou čárku.',
            'The digits are right but the order of magnitude is not — check the decimal point.',
          ),
          false,
        );
      }
    }
    if (Number.isInteger(v) && Number.isInteger(c) && Math.abs(v - c) <= 2) {
      return heuristic(
        'arithmetic',
        L('Jsi těsně vedle — nejspíš numerická chyba.', 'You are very close — probably an arithmetic slip.'),
        false,
      );
    }
    return undefined;
  }

  if (candidate.kind === 'expr' && reference.kind === 'expr' && spec.kind === 'expr') {
    const vars = spec.vars;
    const equivalent = (a: Node, b: Node): boolean => expressionsEquivalent(a, b, { vars }).equal;
    if (equivalent(reference.node, { t: 'neg', a: candidate.node })) {
      return heuristic(
        'sign',
        L('Tvůj výraz je přesně opačný ke správnému.', 'Your expression is exactly the negative of the correct one.'),
      );
    }
    // Differs only by a constant: candidate − reference is the same at every point.
    const difference: Node = { t: 'bin', op: '-', a: candidate.node, b: reference.node };
    try {
      const d0 = evalReal(difference, Object.fromEntries(vars.map((name) => [name, 0.731])));
      if (Number.isFinite(d0) && Math.abs(d0) > 1e-9 && equivalent(difference, { t: 'num', v: d0 })) {
        return heuristic(
          'arithmetic',
          L(
            'Výraz se od správného liší jen o konstantu.',
            'Your expression differs from the correct one only by a constant.',
          ),
          false,
        );
      }
    } catch {
      // not comparable — fall through
    }
    return undefined;
  }

  if (candidate.kind === 'set' && reference.kind === 'set') {
    if (candidate.all || reference.all) return undefined;
    const got = candidate.values;
    const want = reference.values;
    const inWant = (value: number): boolean => want.some((w) => numbersEqual(w, value));
    const inGot = (value: number): boolean => got.some((g) => numbersEqual(g, value));
    if (got.length < want.length && got.every(inWant)) {
      return heuristic(
        'incomplete',
        got.length === 0
          ? L('Řešení existuje.', 'There is a solution.')
          : L('Co máš, je správně, ale něco chybí.', 'What you have is right, but something is missing.'),
      );
    }
    if (got.length > want.length && want.every(inGot)) {
      return heuristic(
        'domain',
        L(
          'Některá z hodnot nevyhovuje — proveď zkoušku nebo zkontroluj podmínky.',
          'One of the values does not fit — check by substitution or review the conditions.',
        ),
      );
    }
    if (
      got.length === want.length &&
      want.length > 0 &&
      sameValues(
        got.map((value) => -value),
        want,
      )
    ) {
      return heuristic('sign', L('Hodnoty sedí až na znaménko.', 'The values are right except for their sign.'));
    }
    return undefined;
  }

  if (candidate.kind === 'interval' && reference.kind === 'interval') {
    if (sameEndpoints(candidate.set, reference.set)) {
      return heuristic(
        'notation',
        L(
          'Krajní body sedí, ale závorky ne: který bod do množiny patří?',
          'The endpoints are right but the brackets are not: which endpoints are included?',
        ),
      );
    }
    const complement = complementOf(reference.set);
    if (intervalSetsEqual(candidate.set, complement) || sameEndpoints(candidate.set, complement)) {
      return heuristic(
        'sign',
        L(
          'To je přesně doplněk správné množiny — nerovnost je obráceně.',
          'That is exactly the complement of the correct set — the inequality is reversed.',
        ),
      );
    }
    return undefined;
  }

  if (candidate.kind === 'point' && reference.kind === 'point') {
    const got = candidate.values;
    const want = reference.values;
    if (got.length !== want.length) return undefined;
    if (
      got.length === 2 &&
      !numbersEqual(want[0]!, want[1]!) &&
      numbersEqual(got[0]!, want[1]!) &&
      numbersEqual(got[1]!, want[0]!)
    ) {
      return heuristic('misread', L('Souřadnice jsou prohozené.', 'The coordinates are swapped.'));
    }
    const matches = got.filter((value, index) => numbersEqual(value, want[index]!)).length;
    const flipped = got.filter((value, index) => want[index] !== 0 && numbersEqual(value, -want[index]!)).length;
    if (flipped > 0 && matches + flipped === got.length) {
      return heuristic('sign', L('Jedna ze souřadnic má opačné znaménko.', 'One coordinate has the opposite sign.'));
    }
    if (matches > 0) {
      return heuristic(
        'arithmetic',
        L('Jedna souřadnice je správně, druhá ne.', 'One coordinate is right, the other is not.'),
        false,
      );
    }
    return undefined;
  }

  if (candidate.kind === 'complex' && reference.kind === 'complex') {
    const v = candidate.value;
    const c = reference.value;
    if (c.im !== 0 && complexEqual(v, { re: c.re, im: -c.im })) {
      return heuristic(
        'sign',
        L(
          'To je komplexně sdružené číslo — znaménko imaginární části.',
          'That is the complex conjugate — check the sign of the imaginary part.',
        ),
      );
    }
    if (complexEqual(v, { re: -c.re, im: -c.im })) {
      return heuristic(
        'sign',
        L('Tvé číslo je opačné ke správnému.', 'Your number is the negative of the correct one.'),
      );
    }
    if (c.re !== c.im && complexEqual(v, { re: c.im, im: c.re })) {
      return heuristic(
        'misread',
        L('Reálná a imaginární část jsou prohozené.', 'The real and imaginary parts are swapped.'),
      );
    }
    return undefined;
  }

  if (candidate.kind === 'spot' && spec.kind === 'spot') {
    return candidate.line > spec.wrongLine
      ? heuristic(
          'rushed',
          L(
            'Chyba je už dřív. Projdi řádky pomaleji, jeden po druhém.',
            'The error is earlier. Go through the lines more slowly, one at a time.',
          ),
          false,
        )
      : heuristic(
          'algebra',
          L(
            'Tenhle řádek je ještě v pořádku. Ověř si úpravu dosazením čísla.',
            'This line is still fine. Test the step by substituting a number.',
          ),
          false,
        );
  }

  return undefined;
}

/** Was a decimal typed where an exact value was expected, and is it merely rounded? */
function isRoundedApproximation(spec: AnswerSpec, candidate: Parsed, reference: Parsed, input: string): boolean {
  if (spec.kind !== 'number' || spec.tol !== undefined) return false;
  if (candidate.kind !== 'number' || reference.kind !== 'number') return false;
  if (!/\d[.,]\d/.test(input)) return false;
  const scale = Math.max(1, Math.abs(reference.value));
  return Math.abs(candidate.value - reference.value) <= 0.006 * scale;
}

/** Functions that are part of writing a number down rather than of computing it. */
const NOTATION_FUNCTIONS: ReadonlySet<FnName> = new Set(['sqrt', 'cbrt', 'abs', 'sgn']);
const FUNCTION_FAMILIES: readonly ReadonlySet<FnName>[] = [
  new Set<FnName>(['sin', 'cos', 'tan', 'cot', 'asin', 'acos', 'atan']),
  new Set<FnName>(['log', 'ln', 'exp']),
];

/**
 * The expression trees of a real constant answer (a number, the elements of a set,
 * coordinates). Complex answers are left out: the trigonometric form is a legitimate way
 * to write one, and a spec that wants a + bi says so with `form: 'algebraic'`.
 */
function constantNodes(parsed: Parsed): Node[] {
  if (parsed.kind === 'number') return [parsed.node];
  if (parsed.kind === 'set' || parsed.kind === 'point') return parsed.nodes;
  return [];
}

/**
 * Does the input leave a function unevaluated that the expected answer has no use for?
 * "sin(5π/6)" has the value 1/2, but writing 1/2 is the task. A family of functions is
 * fine wherever the expected answer itself uses it (log₃ 11, 8·sin 45°/sin 30°).
 */
function leavesFunctions(candidate: Parsed, reference: Parsed): boolean {
  const expected = new Set<FnName>();
  for (const node of constantNodes(reference)) functionsOf(node, expected);
  const allowed = new Set<FnName>(NOTATION_FUNCTIONS);
  for (const family of FUNCTION_FAMILIES) {
    if ([...family].some((fn) => expected.has(fn))) for (const fn of family) allowed.add(fn);
  }
  return constantNodes(candidate).some((node) => [...functionsOf(node)].some((fn) => !allowed.has(fn)));
}

/** A real expression: no imaginary unit, and nothing left to evaluate but roots. */
function isRealTerm(node: Node): boolean {
  return !usesImaginary(node) && [...functionsOf(node)].every((fn) => NOTATION_FUNCTIONS.has(fn));
}

/**
 * Is a complex number written as a + bi? Sums and differences of real terms and real
 * multiples of i, possibly over a real denominator: 3 − 2i, √3/2 + i/2, (1 + √3·i)/2.
 * Not (1 + i)⁸, not (1 + i)(1 − i), not 2(cos π/3 + i sin π/3).
 */
function isAlgebraicForm(node: Node): boolean {
  if (node.t === 'neg') return isAlgebraicForm(node.a);
  if (node.t === 'const' && node.name === 'i') return true;
  if (node.t === 'bin') {
    if (node.op === '+' || node.op === '-') return isAlgebraicForm(node.a) && isAlgebraicForm(node.b);
    if (node.op === '*')
      return (isRealTerm(node.a) && isAlgebraicForm(node.b)) || (isAlgebraicForm(node.a) && isRealTerm(node.b));
    if (node.op === '/') return isAlgebraicForm(node.a) && isRealTerm(node.b);
  }
  return isRealTerm(node);
}

/** A whole number written as one: 7, -7, (−7). */
function integerOf(node: Node): number | null {
  if (node.t === 'num') return Number.isInteger(node.v) ? node.v : null;
  if (node.t === 'neg') {
    const inner = integerOf(node.a);
    return inner === null ? null : -inner;
  }
  return null;
}

/**
 * How a number is written, for answers that must be in lowest terms: a whole number or
 * p/q with nothing left to cancel is 'reduced'; p/q with a common factor is 'reducible';
 * anything else — a decimal, a sum, a mixed number — is 'other'.
 */
function fractionForm(node: Node): 'reduced' | 'reducible' | 'other' {
  if (integerOf(node) !== null) return 'reduced';
  if (node.t === 'neg') return fractionForm(node.a);
  if (node.t === 'bin' && node.op === '/') {
    const p = integerOf(node.a);
    const q = integerOf(node.b);
    if (p === null || q === null || q === 0) return 'other';
    let [a, b] = [Math.abs(p), Math.abs(q)];
    while (b !== 0) [a, b] = [b, a % b];
    return a === 1 && Math.abs(q) !== 1 ? 'reduced' : 'reducible';
  }
  return 'other';
}

/**
 * Check a learner's input against a problem's answer.
 *
 * - `correct`: accepted.
 * - `incorrect`: understood but wrong, with a diagnosis when the error is recognisable.
 * - `invalid`: not understood, or correct in value but not in the requested form. Callers
 *   must not count this as an attempt.
 */
export function checkAnswer(
  spec: AnswerSpec,
  input: string,
  misconceptions: readonly Misconception[] = [],
  ctx: CheckContext = {},
): CheckResult {
  const outcome = parseInput(spec, input, ctx);
  if (!outcome.ok) return { verdict: 'invalid', message: outcome.message };
  const candidate = outcome.parsed;
  const reference = canonical(spec);

  // Radians were asked for: degrees are the wrong form whatever their value.
  if ((spec.kind === 'number' || spec.kind === 'set') && spec.unit === 'rad') {
    const nodes = candidate.kind === 'number' ? [candidate.node] : candidate.kind === 'set' ? candidate.nodes : [];
    if (nodes.some(usesDegrees)) return { verdict: 'invalid', message: IN_RADIANS };
  }

  // Computing the value is the task: an answer that still contains the computation is
  // not wrong, but it is not an answer yet either.
  if (leavesFunctions(candidate, reference)) return { verdict: 'invalid', message: FINISH_COMPUTING };
  if (
    spec.kind === 'complex' &&
    spec.form === 'algebraic' &&
    candidate.kind === 'complex' &&
    !isAlgebraicForm(candidate.node)
  ) {
    return { verdict: 'invalid', message: ALGEBRAIC_FORM };
  }

  if (sameParsed(spec, candidate, reference)) {
    if (spec.kind === 'expr' && spec.form && candidate.kind === 'expr' && !hasForm(candidate.node, spec.form)) {
      return { verdict: 'invalid', message: wrongForm(spec.form) };
    }
    if (spec.kind === 'number' && spec.form === 'reduced' && candidate.kind === 'number') {
      const form = fractionForm(candidate.node);
      if (form !== 'reduced')
        return { verdict: 'invalid', message: form === 'reducible' ? REDUCE_FRACTION : AS_FRACTION };
    }
    return { verdict: 'correct' };
  }

  if (isRoundedApproximation(spec, candidate, reference, input)) {
    return { verdict: 'invalid', message: GIVE_EXACT };
  }

  for (const misconception of misconceptions) {
    const parsed = parseInput(spec, misconception.answer, { decimalComma: false });
    if (parsed.ok && sameParsed(spec, candidate, parsed.parsed)) {
      return {
        verdict: 'incorrect',
        diagnosis: {
          error: misconception.error,
          note: misconception.note,
          source: 'misconception',
          strong: true,
          skill: misconception.skill,
        },
      };
    }
  }

  if (candidate.kind === 'self') return { verdict: 'incorrect' };
  return { verdict: 'incorrect', diagnosis: diagnose(spec, candidate, reference) };
}

/**
 * How an authored wrong answer relates to the canonical one. Misconceptions are content,
 * not learner input, so the rules about form do not apply to them: "log₂(12 + 4)" is a
 * perfectly good description of what a mistaken learner computed.
 */
export function classifyMisconception(
  spec: AnswerSpec,
  answer: string,
  earlier: readonly Misconception[] = [],
): 'distinct' | 'correct' | 'duplicate' | 'unparseable' {
  const parsed = parseInput(spec, answer, { decimalComma: false });
  if (!parsed.ok) return 'unparseable';
  if (sameParsed(spec, parsed.parsed, canonical(spec))) return 'correct';
  for (const other of earlier) {
    const known = parseInput(spec, other.answer, { decimalComma: false });
    if (known.ok && sameParsed(spec, parsed.parsed, known.parsed)) return 'duplicate';
  }
  return 'distinct';
}

export type Interpretation = { ok: true; tex: string } | { ok: false; message: L };

/**
 * How an input would be understood, as LaTeX — shown live while typing so the learner can
 * catch a misread before submitting.
 */
export function interpretAnswer(shape: Shape, input: string, ctx: CheckContext = {}): Interpretation {
  const outcome = parseInput(shape, input, ctx);
  if (!outcome.ok) return { ok: false, message: outcome.message };
  const locale = ctx.locale ?? 'en';
  const parsed = outcome.parsed;
  const sep = locale === 'cs' ? ';\\,' : ',\\,';
  switch (parsed.kind) {
    case 'number':
    case 'expr':
    case 'complex':
      return { ok: true, tex: toTex(parsed.node, locale) };
    case 'set':
      if (parsed.all) return { ok: true, tex: '\\mathbb{R}' };
      if (parsed.nodes.length === 0) return { ok: true, tex: '\\emptyset' };
      return { ok: true, tex: `\\{${parsed.nodes.map((node) => toTex(node, locale)).join(sep)}\\}` };
    case 'interval':
      return { ok: true, tex: intervalSetToTex(parsed.set, locale) };
    case 'point': {
      const body = parsed.nodes.map((node) => toTex(node, locale)).join(sep);
      return { ok: true, tex: locale === 'cs' ? `[${body}]` : `(${body})` };
    }
    default:
      return { ok: true, tex: '' };
  }
}

/** The canonical answer as LaTeX, for showing the solution. */
export function answerToTex(spec: AnswerSpec, locale: Locale = 'en'): string {
  const sep = locale === 'cs' ? ';\\,' : ',\\,';
  const opts: ParseOptions = { decimalComma: false };
  switch (spec.kind) {
    case 'number': {
      const node = parse(spec.value, opts);
      const unit = spec.unit === 'deg' ? '^{\\circ}' : '';
      const exact = `${toTex(node, locale)}${unit}`;
      if (spec.tol === undefined) return exact;
      // A rounded answer is asked for: show the number itself, to the precision the
      // tolerance implies, next to the exact form it comes from.
      const digits = Math.max(0, Math.round(-Math.log10(2 * spec.tol)));
      const value = evalReal(node, {});
      const fixed = value.toFixed(digits);
      const rounded = `${locale === 'cs' ? fixed.replace('.', '{,}') : fixed}${unit}`;
      return node.t === 'num' ? rounded : `${exact} \\approx ${rounded}`;
    }
    case 'expr':
      return toTex(parse(spec.value, { ...opts, variables: spec.vars }), locale);
    case 'complex':
      return toTex(parse(spec.value, { ...opts, complex: true }), locale);
    case 'set':
      if (spec.values === 'all') return '\\mathbb{R}';
      if (spec.values.length === 0) return '\\emptyset';
      return `\\{${spec.values.map((value) => toTex(parse(value, opts), locale)).join(sep)}\\}`;
    case 'interval': {
      const result = parseIntervalSet(spec.value, opts);
      return result.ok ? intervalSetToTex(result.set, locale) : '';
    }
    case 'point': {
      const body = spec.coords.map((coord) => toTex(parse(coord, opts), locale)).join(sep);
      return locale === 'cs' ? `[${body}]` : `(${body})`;
    }
    default:
      return '';
  }
}

/** Sanity check for content authors: can the canonical answer of a spec be evaluated? */
export function validateSpec(spec: AnswerSpec): string | null {
  try {
    const reference = canonical(spec);
    if (reference.kind === 'number' && !Number.isFinite(reference.value)) return 'canonical value is not finite';
    if (reference.kind === 'set' && reference.values.some((value) => !Number.isFinite(value)))
      return 'a set element is not finite';
    if (reference.kind === 'point' && reference.values.some((value) => !Number.isFinite(value)))
      return 'a coordinate is not finite';
    if (reference.kind === 'complex' && !(Number.isFinite(reference.value.re) && Number.isFinite(reference.value.im))) {
      return 'canonical complex value is not finite';
    }
    if (spec.kind === 'choice') {
      const ids = new Set(spec.options.map((option) => option.id));
      if (ids.size !== spec.options.length) return 'duplicate option ids';
      if (spec.correct.length === 0 || spec.correct.some((id) => !ids.has(id))) return 'correct option missing';
    }
    if (spec.kind === 'spot' && (spec.wrongLine < 0 || spec.wrongLine >= spec.lines.length))
      return 'wrongLine out of range';
    if (spec.kind === 'expr' && spec.form && reference.kind === 'expr' && !hasForm(reference.node, spec.form)) {
      return `canonical expression is not in ${spec.form} form`;
    }
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}

/**
 * The canonical answer written the way a learner would type it. Used by tests (it must
 * always be accepted) and when replaying a solution.
 */
export function canonicalInput(spec: AnswerSpec): string {
  switch (spec.kind) {
    case 'number':
    case 'expr':
    case 'complex':
    case 'interval':
      return spec.value;
    case 'set':
      if (spec.values === 'all') return 'R';
      return `{${spec.values.join('; ')}}`;
    case 'point':
      return `[${spec.coords.join('; ')}]`;
    case 'choice':
      return spec.correct.join(',');
    case 'spot':
      return String(spec.wrongLine);
    case 'self':
      return 'yes';
  }
}
