import { type ProblemInstance, L } from '@lemma/core';
import { describe, expect, it } from 'vitest';
import { lintInstance } from '../src/lint';

/** A minimal problem that passes; each test breaks one thing. */
const sound = (overrides: Partial<ProblemInstance> = {}): ProblemInstance => ({
  prompt: L('Kolik je $1 + 1$?', 'What is $1 + 1$?'),
  answer: { kind: 'number', value: '2' },
  hints: [L('a', 'a'), L('b', 'b')],
  solution: [{ text: L('s', 's') }],
  ...overrides,
});
const messages = (instance: ProblemInstance): string[] => lintInstance(instance, 't').map((issue) => issue.message);
const flagged = (instance: ProblemInstance, fragment: string): boolean =>
  messages(instance).some((message) => message.includes(fragment));

describe('the content linter', () => {
  it('accepts a sound problem', () => {
    expect(messages(sound())).toEqual([]);
    expect(messages(sound({ prompt: L('$x - 3$', '$x - 3$') }))).toEqual([]);
  });

  it('catches the artefacts of careless string building', () => {
    expect(flagged(sound({ prompt: L('$x + -3$', '$x + -3$') }), 'sign glitch')).toBe(true);
    expect(flagged(sound({ prompt: L('$f(undefined)$', 'ok') }), 'undefined')).toBe(true);
    expect(flagged(sound({ prompt: L('ok $x', 'ok') }), 'unbalanced $')).toBe(true);
    // In prose, "undefined" is an ordinary mathematical word.
    expect(messages(sound({ prompt: L('Výraz není definován.', 'The expression is undefined.') }))).toEqual([]);
  });

  it('requires both languages, hints and a solution', () => {
    expect(flagged(sound({ prompt: L('ok', '') }), 'empty text')).toBe(true);
    expect(flagged(sound({ hints: [L('a', 'a')] }), 'at least 2 hints')).toBe(true);
    expect(flagged(sound({ solution: [] }), 'empty solution')).toBe(true);
  });

  it('checks the answer against its independent specification', () => {
    const wrongRoots = sound({
      answer: { kind: 'set', values: ['1', '2'] },
      verify: [{ kind: 'roots', expr: '(x-1)*(x-3)' }],
    });
    expect(flagged(wrongRoots, '[roots]')).toBe(true);
    const rightRoots = sound({
      answer: { kind: 'set', values: ['1', '3'] },
      verify: [{ kind: 'roots', expr: '(x-1)*(x-3)' }],
    });
    expect(messages(rightRoots)).toEqual([]);
  });

  it('refuses a "misconception" that is really the right answer', () => {
    const instance = sound({ misconceptions: [{ answer: '4/2', error: 'sign', note: L('n', 'n') }] });
    expect(flagged(instance, 'is correct, expected a distinct wrong answer')).toBe(true);
  });

  it('reads a misconception as content: it may describe an unfinished computation', () => {
    // A learner may not answer "log_2(8)", but a misconception may say what a mistaken one computed.
    const unevaluated = sound({
      misconceptions: [{ answer: 'log_2(8)', error: 'formula', note: L('poznámka', 'note') }],
    });
    expect(lintInstance(unevaluated, 'x').filter((issue) => issue.where.includes('misconception'))).toEqual([]);
    const garbled = sound({ misconceptions: [{ answer: '3 +', error: 'formula', note: L('poznámka', 'note') }] });
    expect(flagged(garbled, 'is unparseable')).toBe(true);
  });

  it('knows how Czech counts: the noun after 1 and after 2 to 4', () => {
    const says = (cs: string): boolean => flagged(sound({ prompt: L(cs, 'ok') }), 'Czech count');
    // Where the genitive plural cannot be right.
    expect(says('3 trojúhelníků po 180°:')).toBe(true);
    expect(says('Kniha stojí 4 korun.')).toBe(true);
    expect(says('Cesta trvá o 2 hodin déle.')).toBe(true);
    expect(says('V klubu je 4 trenérů.')).toBe(true);
    expect(says('Celek je rozdělen na $1 + 2 = 3$ stejných dílů.')).toBe(true);
    expect(says('Linka jezdí každých 4 minut.')).toBe(true);
    expect(says('Zbývá 1 dílů.')).toBe(true);
    // Written rightly.
    expect(says('3 trojúhelníky po 180°:')).toBe(false);
    expect(says('Kniha stojí 4 koruny, sešit 5 korun a pero 12 korun.')).toBe(false);
    expect(says('V klubu je 14 trenérů.')).toBe(false);
    // Where the genitive is what the sentence asks for, the check stays out of it.
    expect(says('Obrazec je složen ze 3 dílů.')).toBe(false);
    expect(says('Součet všech 4 čísel je 20.')).toBe(false);
    expect(says('Opakuje se skupina 4 korálků.')).toBe(false);
    // Not counts at all: an adverb, a decimal, a formula that merely ends in a digit.
    expect(says('Graf posuneme o 2 dolů.')).toBe(false);
    expect(says('Nádoba má objem $2{,}3$ litrů.')).toBe(false);
    expect(says('Míček má výšku $h(t) = -5t^2 + 10t + 1$ metrů.')).toBe(false);
  });

  it('wants a decimal comma in Czech prose', () => {
    expect(
      flagged(sound({ hints: [L('Jedno procento je 0.4.', 'One per cent is 0.4.'), L('b', 'b')] }), 'decimal point'),
    ).toBe(true);
    expect(messages(sound({ hints: [L('Jedno procento je 0,4.', 'One per cent is 0.4.'), L('b', 'b')] }))).toEqual([]);
    // Inside mathematics the formatter decides, and a class "9. A" is not a number.
    expect(messages(sound({ prompt: L('Třída 9. A má $0.5$ dne volna.', 'ok') }))).toEqual([]);
  });

  it('wants the correct answer written the way a person would write it', () => {
    const answer = (value: string): ProblemInstance => sound({ answer: { kind: 'expr', value, vars: ['x'] } });
    expect(flagged(answer('4*x+(-6)'), 'written awkwardly')).toBe(true);
    expect(flagged(answer('1*x-3'), 'written awkwardly')).toBe(true);
    expect(flagged(answer('(x-1)^2+(-4)'), 'written awkwardly')).toBe(true);
    expect(messages(answer('4*x-6'))).toEqual([]);
    expect(messages(answer('11*x-3'))).toEqual([]);
    expect(messages(answer('x-3'))).toEqual([]);
  });
});
