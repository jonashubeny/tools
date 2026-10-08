import { L } from '../i18n';
import type { IntervalErrorCode } from '../math/interval';
import type { ParseError } from '../math/parse';

/** Human-readable explanations of why an input could not be read. */

export function describeParseError(error: ParseError): L {
  const d = error.detail;
  switch (error.code) {
    case 'empty':
      return L('Nejdřív napiš odpověď.', 'Type an answer first.');
    case 'unexpected-char':
      return L(`Znak „${d}“ tu nečekám.`, `I did not expect the character “${d}” here.`);
    case 'missing-paren':
      return L(
        'Závorky si neodpovídají — jedna chybí nebo přebývá.',
        'The brackets do not match — one is missing or extra.',
      );
    case 'missing-operand':
      return L('Za operátorem něco chybí.', 'Something is missing after an operator.');
    case 'missing-argument':
      return L(`Funkce ${d} potřebuje argument, např. ${d}(x).`, `The function ${d} needs an argument, e.g. ${d}(x).`);
    case 'unbalanced-bar':
      return L(
        'Svislé čáry absolutní hodnoty si neodpovídají. Zkus zápis abs(…).',
        'The absolute-value bars do not pair up. Try writing abs(…).',
      );
    case 'bad-number':
      return L(`„${d}“ není číslo.`, `“${d}” is not a number.`);
    default:
      return L('Tomuhle zápisu nerozumím.', 'I cannot read this.');
  }
}

export const AMBIGUOUS_COMMA = L(
  'Je „1,2“ jedno číslo, nebo dvě? Hodnoty odděluj středníkem (1; 2), desetinné číslo piš 1,2 nebo 1.2.',
  'Is “1,2” one number or two? Separate values with a semicolon (1; 2); write decimals as 1.2.',
);

export function describeIntervalError(code: IntervalErrorCode, detail: string): L {
  switch (code) {
    case 'empty':
      return L('Nejdřív napiš odpověď.', 'Type an answer first.');
    case 'bracket':
      return L(
        `„${detail}“ není interval. Piš např. (-inf; 2> nebo <1; 3).`,
        `“${detail}” is not an interval. Write e.g. (-inf; 2] or [1; 3).`,
      );
    case 'endpoints':
      return L(
        'Interval má dva krajní body oddělené středníkem.',
        'An interval has two endpoints separated by a semicolon.',
      );
    case 'endpoint-value':
      return L(`Krajní bod „${detail}“ neumím vyčíslit.`, `I cannot evaluate the endpoint “${detail}”.`);
    case 'reversed':
      return L('Levý krajní bod musí být menší než pravý.', 'The left endpoint must be smaller than the right one.');
    case 'ambiguous-comma':
      return AMBIGUOUS_COMMA;
  }
}

export function unexpectedSymbol(symbol: string, allowed: readonly string[]): L {
  if (allowed.length === 0) {
    return L(
      `Odpověď má být číslo, ale obsahuje „${symbol}“.`,
      `The answer should be a number, but it contains “${symbol}”.`,
    );
  }
  const list = allowed.join(', ');
  return L(
    `Neznámý symbol „${symbol}“. Odpověď smí obsahovat jen: ${list}.`,
    `Unknown symbol “${symbol}”. The answer may only contain: ${list}.`,
  );
}

export const NOT_A_NUMBER = L('Tenhle výraz nemá číselnou hodnotu.', 'This expression has no numeric value.');

export const GIVE_EXACT = L(
  'Skoro — ale zadej přesnou hodnotu (zlomek, odmocninu, π), ne zaokrouhlené číslo.',
  'Close — but give the exact value (a fraction, a root, π), not a rounded decimal.',
);

export const FINISH_COMPUTING = L(
  'Dopočítej to až do konce: v odpovědi nemá zůstat nevyčíslená funkce (sin, log, …).',
  'Finish the computation: the answer should not contain an unevaluated function (sin, log, …).',
);

export const ALGEBRAIC_FORM = L(
  'Výsledek zapiš v algebraickém tvaru a + bi (bez mocnin a součinů závorek).',
  'Give the result in algebraic form a + bi (no powers or products of brackets).',
);

export const IN_RADIANS = L(
  'Úhel zadej v radiánech (jako násobek π), ne ve stupních.',
  'Give the angle in radians (as a multiple of π), not in degrees.',
);

export function wrongForm(form: 'expanded' | 'factored' | 'vertex'): L {
  switch (form) {
    case 'expanded':
      return L(
        'Je to správná funkce, ale ne v požadovaném tvaru: roznásob závorky.',
        'That is the right expression, but not in the requested form: expand the brackets.',
      );
    case 'factored':
      return L(
        'Je to správný výraz, ale ne v požadovaném tvaru: rozlož ho na součin.',
        'That is the right expression, but not in the requested form: write it as a product.',
      );
    case 'vertex':
      return L(
        'Je to správná funkce, ale ne ve vrcholovém tvaru a(x − m)² + n.',
        'That is the right function, but not in vertex form a(x − m)² + n.',
      );
  }
}

export const POINT_DIMENSIONS = (dims: number): L =>
  L(`Bod má mít ${dims} souřadnice, např. [2; -1].`, `The point needs ${dims} coordinates, e.g. [2; -1].`);

export const CHOOSE_OPTION = L('Vyber odpověď.', 'Choose an option.');
