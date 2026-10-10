import { describe, expect, it } from 'vitest';
import { answerToTex, checkAnswer, interpretAnswer, validateSpec } from '../src/answer/check';
import { AS_FRACTION, REDUCE_FRACTION } from '../src/answer/messages';
import { guessChance, publicAnswerSpec, type AnswerSpec, type Misconception } from '../src/answer/types';
import { L } from '../src/i18n';

const verdict = (spec: AnswerSpec, input: string, misconceptions: Misconception[] = []) =>
  checkAnswer(spec, input, misconceptions).verdict;

const errorOf = (spec: AnswerSpec, input: string, misconceptions: Misconception[] = []) => {
  const result = checkAnswer(spec, input, misconceptions);
  return result.verdict === 'incorrect' ? result.diagnosis?.error : `(${result.verdict})`;
};

describe('number answers', () => {
  const spec: AnswerSpec = { kind: 'number', value: '3/2' };

  it('accepts equivalent exact forms', () => {
    for (const input of ['3/2', '1.5', '1,5', '6/4', 'x = 3/2', ' 1 + 1/2 ', '$3/2$']) {
      expect(verdict(spec, input), input).toBe('correct');
    }
  });

  it('accepts exact irrational forms', () => {
    const root: AnswerSpec = { kind: 'number', value: '2*sqrt(3)' };
    for (const input of ['2sqrt(3)', 'sqrt(12)', '2√3', '2*3^(1/2)'])
      expect(verdict(root, input), input).toBe('correct');
    const angle: AnswerSpec = { kind: 'number', value: 'pi/6' };
    for (const input of ['pi/6', 'π/6', '(1/6)pi']) expect(verdict(angle, input), input).toBe('correct');
  });

  it('asks for the exact value instead of rejecting a rounded one', () => {
    const root: AnswerSpec = { kind: 'number', value: '2*sqrt(3)' };
    const result = checkAnswer(root, '3,46');
    expect(result.verdict).toBe('invalid');
    expect(checkAnswer({ kind: 'number', value: '1/3' }, '0.333').verdict).toBe('invalid');
    // …but not when the answer is simply different
    expect(checkAnswer(root, '3,9').verdict).toBe('incorrect');
  });

  it('asks for lowest terms where reducing is the task, without calling the value wrong', () => {
    const reduced: AnswerSpec = { kind: 'number', value: '3/4', form: 'reduced' };
    expect(verdict(reduced, '3/4')).toBe('correct');
    expect(verdict(reduced, ' 3 / 4 ')).toBe('correct');
    // The right value in the wrong form is not counted as a wrong answer: it is sent back with the reason.
    expect(checkAnswer(reduced, '6/8')).toEqual({ verdict: 'invalid', message: REDUCE_FRACTION });
    expect(checkAnswer(reduced, '75/100')).toEqual({ verdict: 'invalid', message: REDUCE_FRACTION });
    expect(checkAnswer(reduced, '0,75')).toEqual({ verdict: 'invalid', message: AS_FRACTION });
    expect(checkAnswer(reduced, '1/2 + 1/4')).toEqual({ verdict: 'invalid', message: AS_FRACTION });
    // A different value is simply wrong.
    expect(verdict(reduced, '2/3')).toBe('incorrect');
    expect(verdict(reduced, '4/3')).toBe('incorrect');

    const negative: AnswerSpec = { kind: 'number', value: '-5/6', form: 'reduced' };
    expect(verdict(negative, '-5/6')).toBe('correct');
    expect(verdict(negative, '-10/12')).toBe('invalid');
    expect(errorOf(negative, '5/6')).toBe('sign');
    // A whole number is written as one.
    const whole: AnswerSpec = { kind: 'number', value: '3', form: 'reduced' };
    expect(verdict(whole, '3')).toBe('correct');
    expect(verdict(whole, '6/2')).toBe('invalid');
    expect(verdict(whole, '3/1')).toBe('invalid');
    // Without the requirement every equivalent form is accepted, as before.
    expect(verdict({ kind: 'number', value: '3/4' }, '6/8')).toBe('correct');
    // The interface is told beforehand, so that it can say what is expected.
    expect(publicAnswerSpec(reduced)).toMatchObject({ kind: 'number', form: 'reduced' });
  });

  it('accepts rounded answers when a tolerance is set', () => {
    const rounded: AnswerSpec = { kind: 'number', value: '3.4641', tol: 0.01 };
    expect(verdict(rounded, '3,46')).toBe('correct');
    expect(verdict(rounded, '3.47')).toBe('correct');
    expect(verdict(rounded, '3.5')).toBe('incorrect');
  });

  it('diagnoses a sign error', () => {
    expect(errorOf(spec, '-3/2')).toBe('sign');
  });

  it('diagnoses near misses and magnitude slips weakly', () => {
    const result = checkAnswer({ kind: 'number', value: '12' }, '13');
    expect(result).toMatchObject({ verdict: 'incorrect', diagnosis: { error: 'arithmetic', strong: false } });
    expect(errorOf({ kind: 'number', value: '2.5' }, '25')).toBe('arithmetic');
  });

  it('distinguishes degrees from radians', () => {
    const deg: AnswerSpec = { kind: 'number', value: '30', unit: 'deg' };
    expect(verdict(deg, '30')).toBe('correct');
    expect(verdict(deg, '30°')).toBe('correct');
    expect(errorOf(deg, 'pi/6')).toBe('notation');
  });

  it('asks again when radians were required and degrees arrive', () => {
    const rad: AnswerSpec = { kind: 'number', value: 'pi/6', unit: 'rad' };
    expect(verdict(rad, 'pi/6')).toBe('correct');
    expect(verdict(rad, 'π/6')).toBe('correct');
    // Right or wrong, a degree answer is the wrong form: not counted as an attempt.
    expect(checkAnswer(rad, '30°')).toMatchObject({
      verdict: 'invalid',
      message: { en: expect.stringContaining('radians') },
    });
    expect(verdict(rad, '45°')).toBe('invalid');
    expect(verdict(rad, 'pi/3')).toBe('incorrect');
    // Without the requirement a degree answer of the right size is simply right.
    expect(verdict({ kind: 'number', value: 'pi/6' }, '30°')).toBe('correct');

    const set: AnswerSpec = { kind: 'set', values: ['pi/6', '5*pi/6'], unit: 'rad' };
    expect(verdict(set, 'π/6; 5π/6')).toBe('correct');
    expect(verdict(set, '30°; 150°')).toBe('invalid');
    expect(publicAnswerSpec(set)).toMatchObject({ kind: 'set', unit: 'rad' });
  });

  it('rejects non-numbers as invalid, not as wrong', () => {
    expect(verdict(spec, '')).toBe('invalid');
    expect(verdict(spec, '3/')).toBe('invalid');
    expect(verdict(spec, 'x+1')).toBe('invalid');
    expect(verdict(spec, '1/0')).toBe('invalid');
  });
});

describe('expression answers', () => {
  const spec: AnswerSpec = { kind: 'expr', value: 'x^2-4x+3', vars: ['x'] };

  it('accepts any equivalent form by default', () => {
    for (const input of ['x^2-4x+3', '(x-1)(x-3)', '(x-2)^2-1', 'y = x² − 4x + 3', 'f(x) = 3 - 4x + x^2']) {
      expect(verdict(spec, input), input).toBe('correct');
    }
  });

  it('rejects a different function', () => {
    expect(verdict(spec, 'x^2-4x-3')).toBe('incorrect');
  });

  it('enforces a required form without counting it as an error', () => {
    const vertex: AnswerSpec = { ...spec, form: 'vertex' };
    expect(verdict(vertex, '(x-2)^2-1')).toBe('correct');
    expect(verdict(vertex, 'x^2-4x+3')).toBe('invalid');
    const factored: AnswerSpec = { ...spec, form: 'factored' };
    expect(verdict(factored, '(x-1)(x-3)')).toBe('correct');
    expect(verdict(factored, '(x-3)(x-1)')).toBe('correct');
    expect(verdict(factored, 'x^2-4x+3')).toBe('invalid');
  });

  it('flags unknown symbols as invalid', () => {
    expect(verdict(spec, 'y^2-4y+3')).toBe('invalid');
  });

  it('diagnoses a global sign flip and a constant offset', () => {
    expect(errorOf(spec, '-x^2+4x-3')).toBe('sign');
    expect(errorOf(spec, 'x^2-4x+4')).toBe('arithmetic');
  });
});

describe('set answers', () => {
  const spec: AnswerSpec = { kind: 'set', values: ['-1', '3'] };

  it('accepts the usual ways of writing a solution set', () => {
    for (const input of [
      '{-1; 3}',
      '{3; -1}',
      '-1; 3',
      'K = {-1; 3}',
      'x1 = -1; x2 = 3',
      '-1, 3',
      '{−1; 3}',
      'x = -1 nebo x = 3',
      '3 a -1',
    ]) {
      expect(verdict(spec, input), input).toBe('correct');
    }
  });

  it('ignores repeated elements', () => {
    expect(verdict(spec, '{-1; 3; 3}')).toBe('correct');
  });

  it('diagnoses missing and extra solutions', () => {
    expect(errorOf(spec, '{3}')).toBe('incomplete');
    expect(errorOf(spec, '{-1; 3; 5}')).toBe('domain');
    expect(errorOf(spec, '{1; -3}')).toBe('sign');
    expect(errorOf(spec, '{}')).toBe('incomplete');
  });

  it('handles the empty set and all reals', () => {
    const none: AnswerSpec = { kind: 'set', values: [] };
    for (const input of ['{}', '∅', 'nemá řešení', 'no solution', 'K = {}'])
      expect(verdict(none, input), input).toBe('correct');
    expect(verdict(none, '{1}')).toBe('incorrect');
    const all: AnswerSpec = { kind: 'set', values: 'all' };
    for (const input of ['R', 'ℝ', 'x ∈ R', 'všechna reálná čísla']) expect(verdict(all, input), input).toBe('correct');
    expect(verdict(all, '{}')).toBe('incorrect');
  });

  it('refuses an ambiguous decimal comma rather than guessing', () => {
    const result = checkAnswer({ kind: 'set', values: ['1', '2'] }, '{1,2}');
    expect(result.verdict).toBe('invalid');
    expect(checkAnswer({ kind: 'set', values: ['1', '2'] }, '{1,2}', [], { decimalComma: false }).verdict).toBe(
      'correct',
    );
    expect(verdict({ kind: 'set', values: ['1.5', '2'] }, '{1,5; 2}')).toBe('correct');
  });
});

describe('interval answers', () => {
  const spec: AnswerSpec = { kind: 'interval', value: '(-inf; 2> u <3; inf)' };

  it('accepts either notation', () => {
    for (const input of [
      '(-inf; 2> u <3; inf)',
      '(-∞, 2] ∪ [3, ∞)',
      '<3; inf) u (-inf; 2>',
      'x ∈ (-inf;2> ∪ <3;inf)',
    ]) {
      expect(verdict(spec, input), input).toBe('correct');
    }
  });

  it('diagnoses wrong brackets as notation', () => {
    expect(errorOf(spec, '(-inf; 2) u (3; inf)')).toBe('notation');
  });

  it('diagnoses a reversed inequality', () => {
    expect(errorOf(spec, '(2; 3)')).toBe('sign');
    expect(errorOf(spec, '<2; 3>')).toBe('sign');
  });

  it('accepts domain answers written as a difference', () => {
    const domain: AnswerSpec = { kind: 'interval', value: 'R \\ {2}' };
    for (const input of ['R \\ {2}', 'R - {2}', '(-inf; 2) u (2; inf)', 'D(f) = R \\ {2}', 'ℝ ∖ {2}']) {
      expect(verdict(domain, input), input).toBe('correct');
    }
  });

  it('accepts inequality notation', () => {
    expect(verdict({ kind: 'interval', value: '(2; inf)' }, 'x > 2')).toBe('correct');
    expect(errorOf({ kind: 'interval', value: '(2; inf)' }, 'x >= 2')).toBe('notation');
  });
});

describe('point answers', () => {
  const spec: AnswerSpec = { kind: 'point', coords: ['2', '-1'] };

  it('accepts Czech and English notation', () => {
    for (const input of ['[2; -1]', 'V[2; -1]', 'V = [2;-1]', '(2, -1)', '2; -1', '[4/2; -1]']) {
      expect(verdict(spec, input), input).toBe('correct');
    }
  });

  it('diagnoses swapped coordinates and sign errors', () => {
    expect(errorOf(spec, '[-1; 2]')).toBe('misread');
    expect(errorOf(spec, '[-2; -1]')).toBe('sign');
    expect(errorOf(spec, '[2; 1]')).toBe('sign');
    expect(errorOf(spec, '[2; 5]')).toBe('arithmetic');
  });

  it('requires the right number of coordinates', () => {
    expect(verdict(spec, '[2]')).toBe('invalid');
    expect(verdict(spec, '[2; -1; 0]')).toBe('invalid');
  });

  it('resolves a tight comma because two coordinates are expected', () => {
    expect(verdict({ kind: 'point', coords: ['1', '2'] }, '[1,2]')).toBe('correct');
    expect(verdict({ kind: 'point', coords: ['1.5', '2'] }, '[1,5; 2]')).toBe('correct');
  });
});

describe('complex answers', () => {
  const spec: AnswerSpec = { kind: 'complex', value: '1+sqrt(3)*i' };

  it('accepts algebraic and trigonometric forms', () => {
    for (const input of ['1+sqrt(3)i', '1 + i√3', '2(cos(pi/3) + i sin(pi/3))', 'z = 2(cos 60° + i sin 60°)']) {
      expect(verdict(spec, input), input).toBe('correct');
    }
  });

  it('diagnoses the conjugate', () => {
    expect(errorOf(spec, '1 - sqrt(3)i')).toBe('sign');
  });

  it('can insist on the form a + bi, because computing it is the task', () => {
    const power: AnswerSpec = { kind: 'complex', value: '16', form: 'algebraic' };
    expect(verdict(power, '16')).toBe('correct');
    expect(verdict(power, '16 + 0i')).toBe('correct');
    // The right value, still unevaluated: asked again rather than accepted or marked wrong.
    for (const input of ['(1+i)^8', '(1+i)^4 * (1+i)^4', '16(cos 0 + i sin 0)', 'i^4 * 16']) {
      expect(checkAnswer(power, input), input).toMatchObject({
        verdict: 'invalid',
        message: { en: expect.stringContaining('a + bi') },
      });
    }
    const z: AnswerSpec = { kind: 'complex', value: '-1+sqrt(3)*i', form: 'algebraic' };
    for (const input of ['-1+√3 i', '√3 i - 1', '(-2 + 2√3 i)/2', '2(-1/2 + √3/2 i)', '-1 + i√3'])
      expect(verdict(z, input), input).toBe('correct');
    expect(verdict(z, '2(cos(2pi/3) + i sin(2pi/3))')).toBe('invalid');
    expect(verdict(z, '1+√3 i')).toBe('incorrect');
    expect(publicAnswerSpec(z)).toMatchObject({ form: 'algebraic' });
  });
});

describe('answers that are still a computation', () => {
  it('asks for the value when a function is left unevaluated', () => {
    const half: AnswerSpec = { kind: 'number', value: '1/2' };
    expect(verdict(half, '1/2')).toBe('correct');
    expect(verdict(half, '0,5')).toBe('correct');
    expect(checkAnswer(half, 'sin(pi/6)')).toMatchObject({
      verdict: 'invalid',
      message: { en: expect.stringContaining('unevaluated') },
    });
    expect(verdict({ kind: 'number', value: '3' }, 'log_2(8)')).toBe('invalid');
    // A wrong value hidden in a function is not marked wrong either: it is simply not an answer yet.
    expect(verdict(half, 'cos(pi/6)')).toBe('invalid');
    // Roots are a way of writing a number, not a computation left undone.
    expect(verdict({ kind: 'number', value: 'sqrt(3)/2' }, '√3/2')).toBe('correct');
    expect(verdict({ kind: 'number', value: '2' }, '|-2|')).toBe('correct');
  });

  it('allows a family of functions wherever the expected answer uses it', () => {
    const log: AnswerSpec = { kind: 'number', value: 'log_3(11)', tol: 0.005 };
    for (const input of ['log_3(11)', 'ln(11)/ln(3)', 'log(11)/log(3)', '2,18'])
      expect(verdict(log, input), input).toBe('correct');
    expect(verdict(log, 'sin(1)')).toBe('invalid');
    const side: AnswerSpec = { kind: 'number', value: '8*sin(45°)/sin(30°)', tol: 0.05 };
    for (const input of ['8*sin(45°)/sin(30°)', '8√2', '11,31']) expect(verdict(side, input), input).toBe('correct');
  });

  it('applies to the elements of sets and to coordinates', () => {
    const set: AnswerSpec = { kind: 'set', values: ['pi/6', '5*pi/6'] };
    expect(verdict(set, 'pi/6; 5pi/6')).toBe('correct');
    expect(verdict(set, 'asin(1/2); pi - asin(1/2)')).toBe('invalid');
    expect(verdict({ kind: 'point', coords: ['2', 'pi/3'] }, '[2; atan(sqrt(3))]')).toBe('invalid');
    // Expressions in x are a different matter: there the functions are the answer.
    expect(verdict({ kind: 'expr', value: 'sin(x)^2', vars: ['x'] }, '1 - cos(x)^2')).toBe('correct');
  });
});

describe('choice and find-the-mistake answers', () => {
  const choice: AnswerSpec = {
    kind: 'choice',
    options: [
      { id: 'a', text: L('A', 'A') },
      { id: 'b', text: L('B', 'B') },
      { id: 'c', text: L('C', 'C') },
    ],
    correct: ['b'],
  };

  it('checks a single choice', () => {
    expect(verdict(choice, 'b')).toBe('correct');
    expect(verdict(choice, 'a')).toBe('incorrect');
    expect(verdict(choice, '')).toBe('invalid');
    expect(verdict(choice, 'z')).toBe('invalid');
  });

  it('checks multiple choice as a set', () => {
    const multi: AnswerSpec = { ...choice, correct: ['a', 'c'], multi: true };
    expect(verdict(multi, 'c,a')).toBe('correct');
    expect(verdict(multi, 'a')).toBe('incorrect');
    expect(verdict(multi, 'a,b,c')).toBe('incorrect');
  });

  it('uses misconceptions attached to options', () => {
    const result = checkAnswer(choice, 'a', [{ answer: 'a', error: 'formula', note: L('vzorec', 'formula') }]);
    expect(result).toMatchObject({ verdict: 'incorrect', diagnosis: { error: 'formula', source: 'misconception' } });
  });

  it('checks the faulty line', () => {
    const spot: AnswerSpec = {
      kind: 'spot',
      lines: [{ tex: 'a' }, { tex: 'b' }, { tex: 'c' }],
      wrongLine: 1,
      errorType: 'sign',
    };
    expect(verdict(spot, '1')).toBe('correct');
    expect(verdict(spot, '2')).toBe('incorrect');
    expect(verdict(spot, '7')).toBe('invalid');
  });
});

describe('the chance of guessing right', () => {
  const options = (n: number) =>
    Array.from({ length: n }, (_, i) => ({ id: String.fromCharCode(97 + i), text: L('x', 'x') }));

  it('is one in the number of options, and none for a typed answer', () => {
    expect(guessChance({ kind: 'choice', options: options(5), correct: ['a'] })).toBeCloseTo(0.2, 10);
    expect(guessChance({ kind: 'choice', options: options(2), correct: ['a'] })).toBe(0.5);
    expect(guessChance({ kind: 'choice', options: options(6), correct: ['c'] })).toBeCloseTo(1 / 6, 10);
    // Several boxes to tick: every selection but the empty one could be the answer.
    expect(guessChance({ kind: 'choice', options: options(3), correct: ['a', 'b'], multi: true })).toBeCloseTo(
      1 / 7,
      10,
    );
    expect(
      guessChance({
        kind: 'spot',
        lines: [{ tex: 'a' }, { tex: 'b' }, { tex: 'c' }, { tex: 'd' }],
        wrongLine: 2,
        errorType: 'sign',
      }),
    ).toBe(0.25);
    for (const spec of [
      { kind: 'number', value: '3/2' },
      { kind: 'expr', value: 'x+1', vars: ['x'] },
      { kind: 'set', values: ['1', '2'] },
      { kind: 'self', rubric: [], model: L('m', 'm') },
    ] as AnswerSpec[])
      expect(guessChance(spec), spec.kind).toBe(0);
    // Degenerate cases do not divide by zero.
    expect(guessChance({ kind: 'choice', options: options(1), correct: ['a'] })).toBe(0);
    expect(guessChance({ kind: 'choice', options: [], correct: [] })).toBe(0);
  });
});

describe('misconceptions', () => {
  const spec: AnswerSpec = { kind: 'point', coords: ['2', '-1'] };
  const misconceptions: Misconception[] = [
    { answer: '-2; -1', error: 'sign', note: L('znaménko u −b/2a', 'sign in −b/2a'), skill: 'quad.vertex' },
    { answer: '2; 3', error: 'misread', note: L('to je f(0)', 'that is f(0)') },
  ];

  it('take precedence over generic heuristics and carry their note', () => {
    const result = checkAnswer(spec, '[2; 3]', misconceptions);
    expect(result).toMatchObject({
      verdict: 'incorrect',
      diagnosis: { error: 'misread', source: 'misconception', strong: true },
    });
  });

  it('never turn a correct answer into a wrong one', () => {
    expect(checkAnswer(spec, '[2; -1]', misconceptions).verdict).toBe('correct');
  });
});

describe('interpretation preview', () => {
  it('typesets what was understood', () => {
    expect(interpretAnswer({ kind: 'expr', vars: ['x'] }, 'x^2-4x+3')).toEqual({ ok: true, tex: 'x^{2} - 4x + 3' });
    expect(interpretAnswer({ kind: 'interval' }, '<1;3)', { locale: 'cs' })).toEqual({
      ok: true,
      tex: '\\langle 1;\\,3)',
    });
    expect(interpretAnswer({ kind: 'set' }, '-1; 3', { locale: 'cs' })).toEqual({ ok: true, tex: '\\{-1;\\,3\\}' });
    expect(interpretAnswer({ kind: 'point', dims: 2 }, '2; -1', { locale: 'en' })).toEqual({
      ok: true,
      tex: '(2,\\,-1)',
    });
  });

  it('explains what is wrong with unreadable input', () => {
    const result = interpretAnswer({ kind: 'expr', vars: ['x'] }, '2x+');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message.cs.length).toBeGreaterThan(5);
      expect(result.message.en.length).toBeGreaterThan(5);
    }
  });
});

describe('spec utilities', () => {
  it('never leaks the answer in the public spec', () => {
    const specs: AnswerSpec[] = [
      { kind: 'number', value: '42' },
      { kind: 'expr', value: 'x^2-4x+3', vars: ['x'] },
      { kind: 'set', values: ['-1', '3'] },
      { kind: 'interval', value: '(2; inf)' },
      { kind: 'point', coords: ['2', '-1'] },
      { kind: 'complex', value: '3-2i' },
      { kind: 'choice', options: [{ id: 'a', text: L('A', 'A') }], correct: ['a'] },
      { kind: 'spot', lines: [{ tex: 'x', note: L('tajné', 'secret') }], wrongLine: 0, errorType: 'sign' },
      { kind: 'self', rubric: [L('r', 'r')], model: L('vzor', 'model') },
    ];
    for (const spec of specs) {
      const json = JSON.stringify(publicAnswerSpec(spec));
      for (const secret of [
        '42',
        'x^2-4x+3',
        '"-1"',
        '(2; inf)',
        '3-2i',
        'correct',
        'wrongLine',
        'secret',
        'model',
        'errorType',
      ]) {
        expect(json.includes(secret), `${spec.kind} leaks ${secret}`).toBe(false);
      }
    }
  });

  it('validates canonical answers', () => {
    expect(validateSpec({ kind: 'number', value: '3/2' })).toBeNull();
    expect(validateSpec({ kind: 'number', value: '1/0' })).not.toBeNull();
    expect(validateSpec({ kind: 'interval', value: 'nonsense' })).not.toBeNull();
    expect(validateSpec({ kind: 'expr', value: 'x^2-1', vars: ['x'], form: 'factored' })).not.toBeNull();
    expect(validateSpec({ kind: 'expr', value: '(x-1)(x+1)', vars: ['x'], form: 'factored' })).toBeNull();
  });

  it('renders canonical answers', () => {
    expect(answerToTex({ kind: 'point', coords: ['2', '-1'] }, 'cs')).toBe('[2;\\,-1]');
    expect(answerToTex({ kind: 'set', values: ['-1', '3'] }, 'en')).toBe('\\{-1,\\,3\\}');
    expect(answerToTex({ kind: 'interval', value: '(-inf; 2>' }, 'cs')).toBe('(-\\infty;\\,2\\rangle ');
    expect(answerToTex({ kind: 'number', value: '30', unit: 'deg' }, 'cs')).toBe('30^{\\circ}');
    // A rounded answer shows the number, to the precision its tolerance implies.
    expect(answerToTex({ kind: 'number', value: '2000*1.25^4', tol: 0.5 }, 'cs')).toBe(
      '2000 \\cdot 1{,}25^{4} \\approx 4883',
    );
    expect(answerToTex({ kind: 'number', value: 'ln(3)/ln(1.2)', tol: 0.05 }, 'en')).toMatch(/\\approx 6\.0$/);
    expect(answerToTex({ kind: 'number', value: '8*sin(45°)/sin(30°)', tol: 0.05 }, 'cs')).toMatch(
      /\\approx 11\{,\}3$/,
    );
    expect(answerToTex({ kind: 'number', value: '12.5', tol: 0.05 }, 'cs')).toBe('12{,}5');
    expect(answerToTex({ kind: 'number', value: '47.3', unit: 'deg', tol: 0.5 }, 'en')).toBe('47^{\\circ}');
  });
});
