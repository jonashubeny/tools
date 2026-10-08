import type { Rng } from '@lemma/core';

/**
 * Propositional formulas for the logic and Boolean-algebra generators: built as trees,
 * evaluated by the machine, and only then written down — so a truth table in a solution
 * is computed, never typed.
 */

export type BinaryOp = 'and' | 'or' | 'imp' | 'iff' | 'xor' | 'nand' | 'nor';

export type Formula =
  | { op: 'var'; name: string }
  | { op: 'const'; value: boolean }
  | { op: 'not'; a: Formula }
  | { op: BinaryOp; a: Formula; b: Formula };

export const atom = (name: string): Formula => ({ op: 'var', name });
export const not = (a: Formula): Formula => ({ op: 'not', a });
export const bin = (op: BinaryOp, a: Formula, b: Formula): Formula => ({ op, a, b });
export const TRUE: Formula = { op: 'const', value: true };
export const FALSE: Formula = { op: 'const', value: false };

export type Assignment = Record<string, boolean>;

export function evaluate(f: Formula, env: Assignment): boolean {
  switch (f.op) {
    case 'var':
      return env[f.name] ?? false;
    case 'const':
      return f.value;
    case 'not':
      return !evaluate(f.a, env);
    case 'and':
      return evaluate(f.a, env) && evaluate(f.b, env);
    case 'or':
      return evaluate(f.a, env) || evaluate(f.b, env);
    case 'imp':
      return !evaluate(f.a, env) || evaluate(f.b, env);
    case 'iff':
      return evaluate(f.a, env) === evaluate(f.b, env);
    case 'xor':
      return evaluate(f.a, env) !== evaluate(f.b, env);
    case 'nand':
      return !(evaluate(f.a, env) && evaluate(f.b, env));
    case 'nor':
      return !(evaluate(f.a, env) || evaluate(f.b, env));
  }
}

export function variablesOf(f: Formula, out: Set<string> = new Set()): string[] {
  if (f.op === 'var') out.add(f.name);
  else if (f.op === 'not') variablesOf(f.a, out);
  else if (f.op !== 'const') {
    variablesOf(f.a, out);
    variablesOf(f.b, out);
  }
  return [...out].sort();
}

/** Every assignment of the variables, in the order textbooks list them: 1 1, 1 0, 0 1, 0 0. */
export function assignments(names: readonly string[]): Assignment[] {
  const rows: Assignment[] = [];
  for (let mask = 2 ** names.length - 1; mask >= 0; mask--) {
    rows.push(Object.fromEntries(names.map((name, index) => [name, ((mask >> (names.length - 1 - index)) & 1) === 1])));
  }
  return rows;
}

/** In how many rows of its truth table is the formula true? */
export const trueRows = (f: Formula, names: readonly string[] = variablesOf(f)): number =>
  assignments(names).filter((row) => evaluate(f, row)).length;

/** Do two formulas agree on every assignment of the given variables? */
export function equivalent(
  f: Formula,
  g: Formula,
  names: readonly string[] = [...new Set([...variablesOf(f), ...variablesOf(g)])].sort(),
): boolean {
  return assignments(names).every((row) => evaluate(f, row) === evaluate(g, row));
}

/** Rewrite every occurrence of one connective as another: how a formula looks to someone who confuses the two. */
export function replaceOp(f: Formula, from: BinaryOp, to: BinaryOp, swap = false): Formula {
  if (f.op === 'var' || f.op === 'const') return f;
  if (f.op === 'not') return not(replaceOp(f.a, from, to, swap));
  const [a, b] = [replaceOp(f.a, from, to, swap), replaceOp(f.b, from, to, swap)];
  if (f.op !== from) return bin(f.op, a, b);
  return swap ? bin(to, b, a) : bin(to, a, b);
}

const SYMBOL: Record<BinaryOp, string> = {
  and: '\\land',
  or: '\\lor',
  imp: '\\Rightarrow',
  iff: '\\Leftrightarrow',
  xor: '\\oplus',
  nand: '\\uparrow',
  nor: '\\downarrow',
};

/** The formula in the notation of mathematical logic. */
export function formulaTex(f: Formula, nested = false): string {
  switch (f.op) {
    case 'var':
      return f.name;
    case 'const':
      return f.value ? '1' : '0';
    case 'not':
      return `\\neg ${f.a.op === 'var' || f.a.op === 'const' ? formulaTex(f.a) : `(${formulaTex(f.a)})`}`;
    default: {
      const body = `${formulaTex(f.a, true)} ${SYMBOL[f.op]} ${formulaTex(f.b, true)}`;
      return nested ? `(${body})` : body;
    }
  }
}

const GATE: Record<BinaryOp, string> = {
  and: 'AND',
  or: 'OR',
  imp: '=>',
  iff: 'XNOR',
  xor: 'XOR',
  nand: 'NAND',
  nor: 'NOR',
};

/** The formula as a circuit description: (A AND B) XOR (NOT C). */
export function formulaGates(f: Formula, nested = false): string {
  switch (f.op) {
    case 'var':
      return f.name;
    case 'const':
      return f.value ? '1' : '0';
    case 'not':
      return f.a.op === 'var' ? `NOT ${f.a.name}` : `NOT (${formulaGates(f.a)})`;
    default: {
      const side = (g: Formula): string => (g.op === 'not' ? `(${formulaGates(g)})` : formulaGates(g, true));
      const body = `${side(f.a)} ${GATE[f.op]} ${side(f.b)}`;
      return nested ? `(${body})` : body;
    }
  }
}

/** The formula as code, the way it appears in a condition. */
export function formulaCode(f: Formula, nested = false): string {
  const code: Partial<Record<BinaryOp, string>> = { and: '&&', or: '||', xor: '!=', iff: '==' };
  switch (f.op) {
    case 'var':
      return f.name.toLowerCase();
    case 'const':
      return f.value ? 'true' : 'false';
    case 'not':
      return f.a.op === 'var' ? `!${f.a.name.toLowerCase()}` : `!(${formulaCode(f.a)})`;
    default: {
      const body = `${formulaCode(f.a, true)} ${code[f.op] ?? f.op} ${formulaCode(f.b, true)}`;
      return nested ? `(${body})` : body;
    }
  }
}

/** The truth table as a LaTeX array, with the formula's own column last. */
export function truthTableTex(f: Formula, heading = formulaTex(f)): string {
  const names = variablesOf(f);
  const rows = assignments(names).map(
    (row) => `${names.map((name) => (row[name] ? '1' : '0')).join(' & ')} & ${evaluate(f, row) ? '1' : '0'}`,
  );
  return `\\begin{array}{${'c'.repeat(names.length)}|c} ${names.join(' & ')} & ${heading} \\\\ \\hline ${rows.join(' \\\\ ')} \\end{array}`;
}

/** A variable or its negation. */
export const literal = (r: Rng, name: string, negated = r.bool(0.4)): Formula =>
  negated ? not(atom(name)) : atom(name);
