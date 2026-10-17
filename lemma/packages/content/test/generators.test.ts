import katex from 'katex';
import { describe, expect, it } from 'vitest';
import { evalReal, parse } from '@lemma/core';
import { BOOLEAN_LAWS } from '../src/generators/enrichment';
import { atom, bin, equivalent, formulaTex, not } from '../src/generators/logic-kit';
import { SIMPLIFY_TEMPLATES, constantTemplates } from '../src/generators/trig-identities';
import { evalFn } from '../src/generators/trig-kit';
import { GENERATORS } from '../src/index';
import { lintGenerator, type TexValidator } from '../src/lint';

const validateTex: TexValidator = (tex) => {
  try {
    katex.renderToString(tex, { throwOnError: true, strict: 'error' });
    return null;
  } catch (error) {
    return error instanceof Error ? error.message.slice(0, 160) : String(error);
  }
};

describe('hand-written identity tables', () => {
  // Choice answers cannot be checked by the answer oracle, so the tables behind them are
  // checked here: each expression must equal what it claims at several unrelated angles.
  const at = (input: string, x: number): number => evalReal(parse(input, { decimalComma: false }), { x });
  const angles = [0.4, 1.1, 2.0, 3.7, 5.2];

  it('simplification templates equal the function they name', () => {
    expect(SIMPLIFY_TEMPLATES.length).toBeGreaterThan(8);
    for (const template of SIMPLIFY_TEMPLATES) {
      for (const x of angles)
        expect(at(template.input, x), `${template.input} at ${x}`).toBeCloseTo(evalFn(template.answer, x), 9);
    }
  });

  it('Boolean laws hold on every row of the truth table', () => {
    expect(BOOLEAN_LAWS.length).toBeGreaterThan(8);
    for (const law of BOOLEAN_LAWS)
      expect(equivalent(law.expr, law.simple, ['A', 'B']), formulaTex(law.expr)).toBe(true);
    // And the checker itself can tell things apart.
    expect(equivalent(bin('or', atom('A'), atom('B')), bin('and', atom('A'), atom('B')), ['A', 'B'])).toBe(false);
    expect(equivalent(bin('imp', atom('A'), atom('B')), bin('or', not(atom('A')), atom('B')))).toBe(true);
  });

  it('constant templates really are constant', () => {
    for (const [k, m, a, b] of [
      [2, 3, 1, 4],
      [5, -4, 3, 2],
      [6, 1, 4, 1],
    ] as const) {
      for (const template of constantTemplates(k, m, a, b)) {
        for (const x of angles)
          expect(at(template.input, x), `${template.input} at ${x}`).toBeCloseTo(template.value, 9);
      }
    }
  });
});

describe('generators', () => {
  // Every registered generator: forty seeds at each level it declares.
  for (const generator of GENERATORS) {
    it(generator.id, () => {
      const issues = lintGenerator(generator, 40, validateTex);
      expect(issues.map((issue) => `${issue.where}: ${issue.message}`)).toEqual([]);
    });
  }
});
