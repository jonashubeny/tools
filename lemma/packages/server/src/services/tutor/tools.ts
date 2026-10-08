import { generatorsFor, getConcept, getGenerator } from '@lemma/content';
import {
  type AnswerSpec,
  type Level,
  type Locale,
  type ProblemInstance,
  EvalError,
  ParseError,
  answerToTex,
  checkAnswer,
  chooseLevel,
  createRng,
  evalReal,
  expressionsEquivalent,
  parse,
  pick,
  variablesOf,
} from '@lemma/core';
import { z } from 'zod';
import { type Ctx, getSettings, newSeed } from '../context';
import { loadStates, stateOf } from '../learner';
import { type ProblemRow, snapshotOf } from '../practice';

/**
 * The tutor's tools. Every one of them is a thin wrapper around the deterministic
 * evaluator or the verified problem generators — this is how the model is kept from being
 * the source of truth about correctness (docs/architecture.md §7).
 *
 * Definitions are plain JSON Schema, provider-neutral; each provider file adapts them to
 * its own wire format. Inputs are validated here with Zod before anything runs, because
 * with eager input streaming the API no longer validates them for us.
 */

export interface ToolDefinition {
  name: string;
  description: string;
  input_schema: {
    type: 'object';
    properties: Record<string, unknown>;
    required: string[];
    additionalProperties: false;
  };
}

export interface ToolContext {
  ctx: Ctx;
  locale: Locale;
  problem: ProblemRow | null;
}

export const TOOL_DEFINITIONS: ToolDefinition[] = [
  {
    name: 'evaluate_expression',
    description:
      'Evaluate a numeric expression exactly as the app does. Use it for any arithmetic you would otherwise do in your head. Syntax: + - * / ^, parentheses, sqrt(), abs() or |x|, sin cos tg cotg (radians; append ° for degrees), log (base 10), ln, log_2(x), pi, e. Supply values for any variables.',
    input_schema: {
      type: 'object',
      properties: {
        expression: { type: 'string', description: 'The expression, e.g. "2*(-3)^2 - 12*(-3) + 13".' },
        variables: {
          type: 'object',
          description: 'Values of variables in the expression, e.g. {"x": -3}.',
          additionalProperties: { type: 'number' },
        },
      },
      required: ['expression'],
      additionalProperties: false,
    },
  },
  {
    name: 'compare_expressions',
    description:
      'Decide whether two algebraic expressions are equivalent (equal for every value of the variables). Use it to verify each line of the learner\'s working against the previous line, to find the first invalid step. For an equation step, compare "left − right" of both lines, or check a claimed root with evaluate_expression.',
    input_schema: {
      type: 'object',
      properties: {
        first: { type: 'string', description: 'First expression, e.g. "(x-2)^2 - 1".' },
        second: { type: 'string', description: 'Second expression, e.g. "x^2 - 4x + 3".' },
        variables: {
          type: 'array',
          items: { type: 'string' },
          description:
            'Usually unnecessary: letters are recognised as variables on their own. List a letter here only if it would otherwise be read as a constant, e.g. ["e"].',
        },
      },
      required: ['first', 'second'],
      additionalProperties: false,
    },
  },
  {
    name: 'check_answer',
    description:
      "Check a proposed FINAL answer to the problem the learner is currently working on, using the app's evaluator. Returns whether it is correct and, when it is wrong in a recognisable way, what kind of error it looks like. Does not reveal the correct answer and does not count as a submission. Only available when a problem is attached to the conversation.",
    input_schema: {
      type: 'object',
      properties: {
        answer: {
          type: 'string',
          description: 'The answer as the learner would type it, e.g. "{-1; 3}", "[2; -1]", "(-inf; 2>", "x^2-4x+3".',
        },
      },
      required: ['answer'],
      additionalProperties: false,
    },
  },
  {
    name: 'get_practice_problem',
    description:
      "Get a generated practice problem for a concept. Its answer is verified by the app, so prefer this to inventing a problem. Returns the problem statement and a reference to pass to check_practice_answer. If level is omitted, a level matching the learner's current ability is chosen.",
    input_schema: {
      type: 'object',
      properties: {
        concept: { type: 'string', description: 'Concept id from the list in the instructions, e.g. "quad.vertex".' },
        level: { type: 'integer', minimum: 1, maximum: 5, description: 'Difficulty 1 (warm-up) to 5 (boss).' },
      },
      required: ['concept'],
      additionalProperties: false,
    },
  },
  {
    name: 'check_practice_answer',
    description:
      "Check the learner's answer to a problem obtained from get_practice_problem. Set reveal to true only after the learner has solved it or explicitly given up; then the correct answer and the authored solution are returned so you can discuss them.",
    input_schema: {
      type: 'object',
      properties: {
        reference: { type: 'string', description: 'The reference returned by get_practice_problem.' },
        answer: { type: 'string', description: "The learner's answer." },
        reveal: { type: 'boolean', description: 'Also return the correct answer and solution.' },
      },
      required: ['reference', 'answer'],
      additionalProperties: false,
    },
  },
];

const EvaluateInput = z
  .object({ expression: z.string().min(1).max(300), variables: z.record(z.string(), z.number()).optional() })
  .strict();
const CompareInput = z
  .object({
    first: z.string().min(1).max(300),
    second: z.string().min(1).max(300),
    variables: z
      .array(z.string().regex(/^[A-Za-z]$/))
      .max(6)
      .optional(),
  })
  .strict();
const CheckInput = z.object({ answer: z.string().min(1).max(300) }).strict();
const PracticeInput = z
  .object({ concept: z.string().min(1).max(60), level: z.number().int().min(1).max(5).optional() })
  .strict();
const CheckPracticeInput = z
  .object({ reference: z.string().min(3).max(120), answer: z.string().min(1).max(300), reveal: z.boolean().optional() })
  .strict();

/**
 * `invalid` means the input did not match the tool's schema. That is reported to the model
 * differently from an ordinary tool error: with eager input streaming a malformed input is
 * most likely truncated or broken JSON, and the model should simply send it again.
 */
export type ToolOutcome = { ok: true; result: unknown } | { ok: false; invalid?: true; error: string };

const INVALID: ToolOutcome = { ok: false, invalid: true, error: 'the input does not match the tool schema' };

const describeError = (error: unknown): string => {
  if (error instanceof ParseError) return `could not parse the expression (${error.code} at position ${error.pos})`;
  if (error instanceof EvalError) return `unknown symbol "${error.symbol}" — supply its value or list it as a variable`;
  return error instanceof Error ? error.message : String(error);
};

/** What a check returns to the model: a verdict and a diagnosis, never the answer itself. */
function verdictOf(
  spec: AnswerSpec,
  instance: ProblemInstance,
  answer: string,
  decimalComma: boolean,
): Record<string, unknown> {
  const check = checkAnswer(spec, answer, instance.misconceptions ?? [], { decimalComma });
  if (check.verdict === 'correct') return { verdict: 'correct' };
  if (check.verdict === 'invalid') return { verdict: 'not_understood', reason: check.message.en };
  return {
    verdict: 'incorrect',
    likely_error: check.diagnosis
      ? { type: check.diagnosis.error, note: check.diagnosis.note?.en ?? null, certain: check.diagnosis.strong }
      : null,
  };
}

/** A reference to a generated problem: enough to regenerate it exactly. */
const REFERENCE = /^([a-z0-9.-]+)@([1-5])#(\d{1,10})$/;

export function executeTool(name: string, rawInput: unknown, tool: ToolContext): ToolOutcome {
  const decimalComma = getSettings(tool.ctx).decimalComma;
  try {
    switch (name) {
      case 'evaluate_expression': {
        const input = EvaluateInput.safeParse(rawInput);
        if (!input.success) return INVALID;
        const variables = input.data.variables ?? {};
        const value = evalReal(
          parse(input.data.expression, { decimalComma, variables: Object.keys(variables) }),
          variables,
        );
        if (!Number.isFinite(value))
          return {
            ok: true,
            result: {
              defined: false,
              note: 'the expression is undefined for these values (division by zero, root or logarithm outside its domain)',
            },
          };
        return { ok: true, result: { defined: true, value: Number(value.toPrecision(12)) } };
      }

      case 'compare_expressions': {
        const input = CompareInput.safeParse(rawInput);
        if (!input.success) return INVALID;
        const opts = { decimalComma, variables: input.data.variables ?? [] };
        const first = parse(input.data.first, opts);
        const second = parse(input.data.second, opts);
        // Whatever letters either side uses are the variables; the model need not list them.
        const vars = [...new Set([...variablesOf(first), ...variablesOf(second)])];
        const result = expressionsEquivalent(first, second, { vars });
        if (result.equal) return { ok: true, result: { equivalent: true } };
        if (result.reason === 'symbol') return { ok: false, error: `unknown symbol "${result.symbol}"` };
        if (result.reason === 'undetermined')
          return {
            ok: true,
            result: {
              equivalent: null,
              note: 'could not be decided: the first expression is undefined at the sampled points',
            },
          };
        return { ok: true, result: { equivalent: false, differ_at: result.witness ?? null } };
      }

      case 'check_answer': {
        const input = CheckInput.safeParse(rawInput);
        if (!input.success) return INVALID;
        if (!tool.problem)
          return {
            ok: false,
            error: 'no problem is attached to this conversation; tell the learner to submit the answer in the app',
          };
        const snapshot = snapshotOf(tool.problem);
        if (snapshot.answer.kind === 'self' || snapshot.answer.kind === 'choice' || snapshot.answer.kind === 'spot') {
          return {
            ok: false,
            error: 'this problem is answered by choosing an option or by self-assessment; it cannot be checked here',
          };
        }
        return { ok: true, result: verdictOf(snapshot.answer, snapshot, input.data.answer, decimalComma) };
      }

      case 'get_practice_problem': {
        const input = PracticeInput.safeParse(rawInput);
        if (!input.success) return INVALID;
        const concept = getConcept(input.data.concept);
        if (!concept)
          return {
            ok: false,
            error: `unknown concept "${input.data.concept}"; use an id from the list in the instructions`,
          };
        // Only problems with a typed, checkable answer make sense in a chat.
        const generators = generatorsFor(concept.id).filter(
          (g) => !g.deprecated && g.kind !== 'debug' && g.kind !== 'graph',
        );
        if (generators.length === 0)
          return { ok: false, error: `there are no generated problems for "${concept.id}" yet` };
        const available = [...new Set(generators.flatMap((g) => g.levels))].sort((a, b) => a - b) as Level[];
        const state = stateOf(loadStates(tool.ctx), concept.id);
        const level =
          input.data.level !== undefined && available.includes(input.data.level as Level)
            ? (input.data.level as Level)
            : chooseLevel({ theta: state.theta, attempts: Math.max(state.attempts, 1), available });
        const seed = newSeed();
        const atLevel = generators.filter((g) => g.levels.includes(level));
        const picker = createRng(seed ^ 0x2545f491);
        // Skip instances whose answer is a choice: they cannot be typed into a chat.
        for (const generator of picker.shuffle(atLevel)) {
          const instance = generator.generate(createRng(seed), level);
          if (instance.answer.kind === 'choice' || instance.answer.kind === 'spot' || instance.answer.kind === 'self')
            continue;
          if (instance.figure) continue;
          return {
            ok: true,
            result: {
              reference: `${generator.id}@${level}#${seed}`,
              concept: concept.title.en,
              level,
              statement: pick(instance.prompt, tool.locale),
              answer_format: instance.answer.kind,
            },
          };
        }
        return { ok: false, error: `no suitable typed-answer problem for "${concept.id}" at level ${level}` };
      }

      case 'check_practice_answer': {
        const input = CheckPracticeInput.safeParse(rawInput);
        if (!input.success) return INVALID;
        const match = REFERENCE.exec(input.data.reference);
        const generator = match ? getGenerator(match[1]!) : undefined;
        if (!match || !generator)
          return { ok: false, error: 'unknown reference; pass exactly what get_practice_problem returned' };
        const level = Number(match[2]) as Level;
        if (!generator.levels.includes(level)) return { ok: false, error: 'unknown reference' };
        const instance = generator.generate(createRng(Number(match[3])), level);
        const result = verdictOf(instance.answer, instance, input.data.answer, decimalComma);
        if (input.data.reveal) {
          result.correct_answer = `$${answerToTex(instance.answer, tool.locale)}$`;
          result.solution = instance.solution.map((s) => {
            const math =
              s.math === undefined ? '' : ` $${typeof s.math === 'string' ? s.math : pick(s.math, tool.locale)}$`;
            return `${pick(s.text, 'en')}${math}`;
          });
        }
        return { ok: true, result };
      }

      default:
        return { ok: false, error: `unknown tool "${name}"` };
    }
  } catch (error) {
    return { ok: false, error: describeError(error) };
  }
}
