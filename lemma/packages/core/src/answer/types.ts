import type { L } from '../i18n';
import type { ErrorType } from '../learning/errors';
import type { ExprForm } from '../math/compare';

/**
 * What a problem expects as its answer and how it is checked.
 *
 * Canonical values are written in "author syntax": the same syntax a learner types, but
 * always with a decimal point and `;` between list items, so they are unambiguous.
 */
export type AnswerSpec =
  NumberSpec | ExprSpec | SetSpec | IntervalSpec | PointSpec | ComplexSpec | ChoiceSpec | SpotSpec | SelfSpec;

interface TextEntry {
  /** LaTeX shown before the input field: `x =`, `D(f) =`, `V =`. */
  label?: string;
  /** Example of the expected format, shown as the input placeholder. */
  placeholder?: string;
}

export interface NumberSpec extends TextEntry {
  kind: 'number';
  /** Expression for the exact value: "3/2", "2*sqrt(3)", "pi/6". */
  value: string;
  /** Accept anything within this absolute tolerance (for rounded answers). */
  tol?: number;
  /**
   * 'deg': the value is in degrees and a trailing ° is ignored.
   * 'rad': the angle must be given in radians; an answer written with a degree sign is
   * returned as invalid (right or not, it is not in the requested form).
   */
  unit?: 'deg' | 'rad';
  /**
   * 'reduced': the answer must be an integer or a fraction in lowest terms, the way the
   * entrance examination asks for it ("zlomkem v základním tvaru"). 6/8 has the right
   * value and is returned as invalid — not yet an answer — rather than marked wrong.
   */
  form?: 'reduced';
}

export interface ExprSpec extends TextEntry {
  kind: 'expr';
  value: string;
  /** Variables the answer may contain. */
  vars: string[];
  /** Required shape, checked in addition to equivalence. */
  form?: ExprForm;
}

export interface SetSpec extends TextEntry {
  kind: 'set';
  /** Elements of the solution set, [] for the empty set, 'all' for all real numbers. */
  values: string[] | 'all';
  /** 'rad': the elements are angles and must be given in radians, not with a degree sign. */
  unit?: 'rad';
}

export interface IntervalSpec extends TextEntry {
  kind: 'interval';
  /** e.g. "(-inf; 2> u <3; inf)" or "R \\ {2}". */
  value: string;
}

export interface PointSpec extends TextEntry {
  kind: 'point';
  coords: string[];
}

export interface ComplexSpec extends TextEntry {
  kind: 'complex';
  value: string;
  /**
   * 'algebraic': the answer must be written as a + bi. Anything else that merely has the
   * right value — a power, a product of brackets, the trigonometric form — is returned as
   * invalid, because computing it is the task.
   */
  form?: 'algebraic';
}

export interface ChoiceOption {
  id: string;
  text: L;
}

export interface ChoiceSpec {
  kind: 'choice';
  options: ChoiceOption[];
  /** Ids of all correct options. */
  correct: string[];
  /** More than one option may be selected. */
  multi?: boolean;
  /** Keep the authored order (for ordered options such as line numbers). */
  fixedOrder?: boolean;
}

/** "Find the mistake": pick the first line of a worked solution that is wrong. */
export interface SpotSpec {
  kind: 'spot';
  lines: { tex: string; note?: L }[];
  /** Index of the first incorrect line. */
  wrongLine: number;
  /** The kind of error the faulty line demonstrates. */
  errorType: ErrorType;
}

/** An explanation the learner assesses against a rubric. */
export interface SelfSpec {
  kind: 'self';
  rubric: L[];
  /** A model answer, revealed for the comparison. */
  model: L;
}

export type AnswerKind = AnswerSpec['kind'];

/**
 * The chance of answering right without knowing: one in five for five options, one in two
 * for a true/false statement, none for a typed answer. The learner model trusts a right
 * answer the less, the easier it is to guess.
 */
export function guessChance(spec: AnswerSpec): number {
  switch (spec.kind) {
    case 'choice': {
      const options = spec.options.length;
      if (options <= 1) return 0;
      // Several boxes to tick: every selection but the empty one is a possible answer.
      return spec.multi ? 1 / (2 ** options - 1) : 1 / options;
    }
    case 'spot':
      return spec.lines.length > 1 ? 1 / spec.lines.length : 0;
    default:
      return 0;
  }
}

/** A specific wrong answer with a known cause. */
export interface Misconception {
  /** The wrong answer, in the same syntax as the canonical one (option id for choices). */
  answer: string;
  error: ErrorType;
  /** Specific feedback: what probably happened. */
  note: L;
  /** The (prerequisite) concept this error points at, if not the problem's own. */
  skill?: string;
}

/** What the client needs in order to render the input — no answers inside. */
export type PublicAnswerSpec =
  | { kind: 'number'; label?: string; placeholder?: string; unit?: 'deg' | 'rad'; form?: 'reduced' }
  | { kind: 'expr'; label?: string; placeholder?: string; vars: string[]; form?: ExprForm }
  | { kind: 'set'; label?: string; placeholder?: string; unit?: 'rad' }
  | { kind: 'interval'; label?: string; placeholder?: string }
  | { kind: 'point'; label?: string; placeholder?: string; dims: number }
  | { kind: 'complex'; label?: string; placeholder?: string; form?: 'algebraic' }
  | { kind: 'choice'; options: ChoiceOption[]; multi: boolean }
  | { kind: 'spot'; lines: { tex: string }[] }
  | { kind: 'self' };

export function publicAnswerSpec(spec: AnswerSpec): PublicAnswerSpec {
  switch (spec.kind) {
    case 'number':
      return { kind: 'number', label: spec.label, placeholder: spec.placeholder, unit: spec.unit, form: spec.form };
    case 'expr':
      return { kind: 'expr', label: spec.label, placeholder: spec.placeholder, vars: spec.vars, form: spec.form };
    case 'set':
      return { kind: 'set', label: spec.label, placeholder: spec.placeholder, unit: spec.unit };
    case 'interval':
      return { kind: 'interval', label: spec.label, placeholder: spec.placeholder };
    case 'point':
      return { kind: 'point', label: spec.label, placeholder: spec.placeholder, dims: spec.coords.length };
    case 'complex':
      return { kind: 'complex', label: spec.label, placeholder: spec.placeholder, form: spec.form };
    case 'choice':
      return { kind: 'choice', options: spec.options, multi: spec.multi ?? false };
    case 'spot':
      return { kind: 'spot', lines: spec.lines.map((line) => ({ tex: line.tex })) };
    case 'self':
      return { kind: 'self' };
  }
}
