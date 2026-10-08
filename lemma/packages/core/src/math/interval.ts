import type { Locale } from '../i18n';
import { numbersEqual } from './compare';
import { evalConstant } from './evaluate';
import { splitList } from './lists';
import { tryParse, type ParseOptions } from './parse';
import { numberToTex, toTex } from './tex';

/**
 * Intervals and unions of intervals on the real line — the answer type for domains,
 * ranges and inequalities.
 *
 * Accepted notation (Czech and English, freely mixed):
 *   closed end   <  >   ⟨  ⟩   [  ]
 *   open end     (  )
 *   separator    ;  or  ,
 *   infinity     inf, -inf, +inf, oo, ∞
 *   union        u, U, ∪, or, nebo
 *   all reals    R, ℝ          empty set   {}, ∅
 *   points       {1; 2}        difference  R \ {2}
 *   prefixes     "x ∈", "D(f) =", "H =", "K =" are ignored
 */

export interface Interval {
  lo: number;
  hi: number;
  loClosed: boolean;
  hiClosed: boolean;
  /** How the endpoint was written, for display (√2 instead of 1.414…). */
  loTex?: string;
  hiTex?: string;
}

/** Sorted, pairwise disjoint, non-adjacent intervals. The empty array is the empty set. */
export type IntervalSet = Interval[];

export const ALL_REALS: IntervalSet = [{ lo: -Infinity, hi: Infinity, loClosed: false, hiClosed: false }];

export type IntervalErrorCode = 'empty' | 'bracket' | 'endpoints' | 'endpoint-value' | 'reversed' | 'ambiguous-comma';

export type IntervalParseResult =
  { ok: true; set: IntervalSet } | { ok: false; code: IntervalErrorCode; detail: string };

const CLOSED_OPEN = '<[';
const CLOSED_CLOSE = '>]';

function fail(code: IntervalErrorCode, detail = ''): IntervalParseResult {
  return { ok: false, code, detail };
}

/** Merge overlapping or touching intervals and sort them. */
export function normalizeIntervals(list: readonly Interval[]): IntervalSet {
  const items = list
    .filter((iv) => iv.lo < iv.hi || (iv.lo === iv.hi && iv.loClosed && iv.hiClosed))
    .map((iv) => ({
      ...iv,
      loClosed: iv.lo === -Infinity ? false : iv.loClosed,
      hiClosed: iv.hi === Infinity ? false : iv.hiClosed,
    }))
    .sort((a, b) => a.lo - b.lo || Number(b.loClosed) - Number(a.loClosed));

  const out: Interval[] = [];
  for (const iv of items) {
    const last = out[out.length - 1];
    const touches = last !== undefined && (iv.lo < last.hi || (iv.lo === last.hi && (iv.loClosed || last.hiClosed)));
    if (last && touches) {
      if (iv.hi > last.hi || (iv.hi === last.hi && iv.hiClosed && !last.hiClosed)) {
        last.hi = iv.hi;
        last.hiClosed = iv.hiClosed;
        last.hiTex = iv.hiTex;
      }
    } else {
      out.push({ ...iv });
    }
  }
  return out;
}

/** Remove single points from a set. */
function removePoints(set: IntervalSet, points: readonly number[]): IntervalSet {
  let current = set.map((iv) => ({ ...iv }));
  for (const p of points) {
    const next: Interval[] = [];
    for (const iv of current) {
      if (p < iv.lo || p > iv.hi) next.push(iv);
      else if (p === iv.lo && p === iv.hi) continue;
      else if (p === iv.lo) next.push({ ...iv, loClosed: false });
      else if (p === iv.hi) next.push({ ...iv, hiClosed: false });
      else {
        const tex = numberToTex(p);
        next.push({ lo: iv.lo, hi: p, loClosed: iv.loClosed, hiClosed: false, loTex: iv.loTex, hiTex: tex });
        next.push({ lo: p, hi: iv.hi, loClosed: false, hiClosed: iv.hiClosed, loTex: tex, hiTex: iv.hiTex });
      }
    }
    current = next;
  }
  return normalizeIntervals(current);
}

function parseEndpoint(text: string, opts?: ParseOptions): { value: number; tex: string } | null {
  const t = text.trim().toLowerCase().replace(/\s+/g, '');
  if (t === 'inf' || t === '+inf' || t === 'oo' || t === '+oo') return { value: Infinity, tex: '\\infty' };
  if (t === '-inf' || t === '-oo') return { value: -Infinity, tex: '-\\infty' };
  const parsed = tryParse(text, opts);
  if (!parsed.ok) return null;
  const value = evalConstant(parsed.node);
  if (Number.isNaN(value)) return null;
  if (value === Infinity) return { value, tex: '\\infty' };
  if (value === -Infinity) return { value, tex: '-\\infty' };
  return { value, tex: toTex(parsed.node) };
}

function preprocess(input: string): string {
  let s = input.trim().replace(/^\$+|\$+$/g, '');
  s = s
    .replace(/[−–—]/g, '-')
    .replace(/∞/g, 'inf')
    .replace(/[⟨〈‹]/g, '<')
    .replace(/[⟩〉›]/g, '>')
    .replace(/∪/g, ' U ')
    .replace(/∖/g, '\\')
    .replace(/ℝ/g, 'R')
    .replace(/∅/g, '{}');
  // "x ∈ …", "x in …"
  s = s.replace(/^[a-z]\s*(?:∈|\bin\b|\bje z\b)\s*/i, '');
  // "D(f) = …", "H = …", "K = …"
  s = s.replace(/^[A-Za-z]\s*(?:\(\s*[a-z]\s*\))?\s*=\s*/, '');
  return s.trim();
}

function parsePointSet(body: string, opts?: ParseOptions): number[] | IntervalParseResult {
  if (body.trim() === '') return [];
  const split = splitList(body, opts?.decimalComma ?? true);
  if (!split.ok) return fail('ambiguous-comma', body);
  const values: number[] = [];
  for (const part of split.parts) {
    const end = parseEndpoint(part, opts);
    if (!end || !Number.isFinite(end.value)) return fail('endpoint-value', part);
    values.push(end.value);
  }
  return values;
}

function parsePart(part: string, opts?: ParseOptions): Interval[] | IntervalParseResult {
  const p = part.trim();
  if (p === '') return fail('empty');
  if (p === 'R') return ALL_REALS.map((iv) => ({ ...iv }));
  if (p.startsWith('{') && p.endsWith('}')) {
    const points = parsePointSet(p.slice(1, -1), opts);
    if (!Array.isArray(points)) return points;
    return points.map((v) => ({
      lo: v,
      hi: v,
      loClosed: true,
      hiClosed: true,
      loTex: numberToTex(v),
      hiTex: numberToTex(v),
    }));
  }
  const open = p[0]!;
  const close = p[p.length - 1]!;
  const openOk = open === '(' || CLOSED_OPEN.includes(open);
  const closeOk = close === ')' || CLOSED_CLOSE.includes(close);
  if (!openOk || !closeOk || p.length < 3) return fail('bracket', p);

  const split = splitList(p.slice(1, -1), opts?.decimalComma ?? true, 2);
  if (!split.ok) return fail('ambiguous-comma', p);
  if (split.parts.length !== 2) return fail('endpoints', p);

  const lo = parseEndpoint(split.parts[0]!, opts);
  const hi = parseEndpoint(split.parts[1]!, opts);
  if (!lo) return fail('endpoint-value', split.parts[0]!);
  if (!hi) return fail('endpoint-value', split.parts[1]!);
  if (lo.value > hi.value) return fail('reversed', p);

  return [
    {
      lo: lo.value,
      hi: hi.value,
      loClosed: open !== '(',
      hiClosed: close !== ')',
      loTex: lo.tex,
      hiTex: hi.tex,
    },
  ];
}

function parseUnion(text: string, opts?: ParseOptions): IntervalSet | IntervalParseResult {
  const parts = text.split(/\s*(?:\bU\b|\bu\b|\bor\b|\bnebo\b)\s*/);
  const all: Interval[] = [];
  for (const part of parts) {
    const result = parsePart(part, opts);
    if (!Array.isArray(result)) return result;
    all.push(...result);
  }
  return normalizeIntervals(all);
}

/**
 * Inequality notation as an alternative to brackets: `x > 2`, `x <= -1`, `1 < x <= 3`.
 * Returns null when the text is not of that shape.
 */
function parseInequality(text: string, opts?: ParseOptions): Interval[] | null {
  const s = text.replace(/≥/g, '>=').replace(/≤/g, '<=');
  const one = /^[a-z]\s*(>=|>|<=|<)\s*([^<>=]+)$/i.exec(s);
  if (one) {
    const end = parseEndpoint(one[2]!, opts);
    if (!end || !Number.isFinite(end.value)) return null;
    const closed = one[1]!.includes('=');
    return one[1]!.startsWith('>')
      ? [{ lo: end.value, hi: Infinity, loClosed: closed, hiClosed: false, loTex: end.tex }]
      : [{ lo: -Infinity, hi: end.value, loClosed: false, hiClosed: closed, hiTex: end.tex }];
  }
  const two = /^([^<>=]+?)\s*(<=|<)\s*[a-z]\s*(<=|<)\s*([^<>=]+)$/i.exec(s);
  if (two) {
    const lo = parseEndpoint(two[1]!, opts);
    const hi = parseEndpoint(two[4]!, opts);
    if (!lo || !hi || !Number.isFinite(lo.value) || !Number.isFinite(hi.value) || lo.value > hi.value) return null;
    return [
      {
        lo: lo.value,
        hi: hi.value,
        loClosed: two[2] === '<=',
        hiClosed: two[3] === '<=',
        loTex: lo.tex,
        hiTex: hi.tex,
      },
    ];
  }
  return null;
}

export function parseIntervalSet(input: string, opts?: ParseOptions): IntervalParseResult {
  const raw = input
    .trim()
    .replace(/^\$+|\$+$/g, '')
    .replace(/[−–—]/g, '-');
  const inequality = parseInequality(raw, opts);
  if (inequality) return { ok: true, set: normalizeIntervals(inequality) };

  const s = preprocess(input);
  if (s === '') return fail('empty');
  if (s === '{}') return { ok: true, set: [] };

  // Set difference with a finite set on the right: R \ {2},  (0; 5) \ {1; 2},  R - {0}
  const diff = /^(.*?)\s*(?:\\|-)\s*(\{[^{}]*\})$/.exec(s);
  if (diff && diff[1]!.trim() !== '' && !diff[1]!.trim().endsWith(';') && !diff[1]!.trim().endsWith('(')) {
    const base = parseUnion(diff[1]!, opts);
    if (Array.isArray(base)) {
      const points = parsePointSet(diff[2]!.slice(1, -1), opts);
      if (!Array.isArray(points)) return points;
      return { ok: true, set: removePoints(base, points) };
    }
  }

  const set = parseUnion(s, opts);
  if (!Array.isArray(set)) return set;
  return { ok: true, set };
}

export function intervalSetsEqual(a: IntervalSet, b: IntervalSet, tol?: number): boolean {
  if (a.length !== b.length) return false;
  return a.every((iv, i) => {
    const other = b[i]!;
    return (
      endpointEqual(iv.lo, other.lo, tol) &&
      endpointEqual(iv.hi, other.hi, tol) &&
      iv.loClosed === other.loClosed &&
      iv.hiClosed === other.hiClosed
    );
  });
}

function endpointEqual(a: number, b: number, tol?: number): boolean {
  if (!Number.isFinite(a) || !Number.isFinite(b)) return a === b;
  return numbersEqual(a, b, tol);
}

/** Same pieces and endpoints, ignoring which ends are closed. */
export function sameEndpoints(a: IntervalSet, b: IntervalSet, tol?: number): boolean {
  if (a.length !== b.length) return false;
  return a.every((iv, i) => endpointEqual(iv.lo, b[i]!.lo, tol) && endpointEqual(iv.hi, b[i]!.hi, tol));
}

export function complementOf(set: IntervalSet): IntervalSet {
  const out: Interval[] = [];
  let lo = -Infinity;
  let loClosed = false;
  let loTex: string | undefined;
  for (const iv of set) {
    out.push({ lo, hi: iv.lo, loClosed, hiClosed: !iv.loClosed, loTex, hiTex: iv.loTex });
    lo = iv.hi;
    loClosed = !iv.hiClosed;
    loTex = iv.hiTex;
  }
  out.push({ lo, hi: Infinity, loClosed, hiClosed: false, loTex });
  return normalizeIntervals(out);
}

export function intervalSetContains(set: IntervalSet, x: number): boolean {
  return set.some((iv) => (x > iv.lo || (x === iv.lo && iv.loClosed)) && (x < iv.hi || (x === iv.hi && iv.hiClosed)));
}

function endpointTex(value: number, tex: string | undefined, locale: Locale): string {
  if (value === Infinity) return '\\infty';
  if (value === -Infinity) return '-\\infty';
  return tex ?? numberToTex(value, locale);
}

/** Czech style ⟨1; 3) or English style [1, 3). */
export function intervalSetToTex(set: IntervalSet, locale: Locale = 'en'): string {
  if (set.length === 0) return '\\emptyset';
  if (set.length === 1 && set[0]!.lo === -Infinity && set[0]!.hi === Infinity) return '\\mathbb{R}';
  const sep = locale === 'cs' ? ';\\,' : ',\\,';
  const closedOpen = locale === 'cs' ? '\\langle ' : '[';
  const closedClose = locale === 'cs' ? '\\rangle ' : ']';
  return set
    .map((iv) => {
      if (iv.lo === iv.hi) return `\\{${endpointTex(iv.lo, iv.loTex, locale)}\\}`;
      const open = iv.loClosed ? closedOpen : '(';
      const close = iv.hiClosed ? closedClose : ')';
      return `${open}${endpointTex(iv.lo, iv.loTex, locale)}${sep}${endpointTex(iv.hi, iv.hiTex, locale)}${close}`;
    })
    .join(' \\cup ');
}
