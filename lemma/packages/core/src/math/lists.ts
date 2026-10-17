/**
 * Splitting "a; b; c" style input, with the decimal-comma problem handled explicitly.
 *
 * Czech notation uses a comma inside numbers (2,5) and therefore a semicolon between
 * list items ({1; 2,5}). English notation uses a point and a comma. A learner may type
 * either, so `1,2` is genuinely ambiguous: one number or two? We resolve it when the
 * expected number of items is known and refuse — with a helpful message — when it is not.
 */

export type SplitResult = { ok: true; parts: string[] } | { ok: false; reason: 'ambiguous-comma' };

const isDigit = (c: string | undefined): boolean => c !== undefined && c >= '0' && c <= '9';

/** Positions of separators at bracket depth 0. */
function topLevelPositions(text: string, separator: string): number[] {
  const positions: number[] = [];
  let depth = 0;
  for (let i = 0; i < text.length; i++) {
    const c = text[i]!;
    if (c === '(' || c === '[' || c === '{') depth++;
    else if (c === ')' || c === ']' || c === '}') depth = Math.max(0, depth - 1);
    else if (c === separator && depth === 0) positions.push(i);
  }
  return positions;
}

function splitAt(text: string, positions: number[]): string[] {
  const parts: string[] = [];
  let start = 0;
  for (const pos of positions) {
    parts.push(text.slice(start, pos).trim());
    start = pos + 1;
  }
  parts.push(text.slice(start).trim());
  return parts;
}

/**
 * @param expected number of items the context requires (2 for an interval, the dimension
 *                 for a point); leave undefined for sets.
 */
export function splitList(text: string, decimalComma: boolean, expected?: number): SplitResult {
  const semicolons = topLevelPositions(text, ';');
  if (semicolons.length > 0) return { ok: true, parts: splitAt(text, semicolons) };

  const commas = topLevelPositions(text, ',');
  if (commas.length === 0) return { ok: true, parts: [text.trim()] };
  if (!decimalComma) return { ok: true, parts: splitAt(text, commas) };

  // A "tight" comma sits directly between two digits: it may be a decimal comma.
  const tight = commas.filter((pos) => isDigit(text[pos - 1]) && isDigit(text[pos + 1]));
  const loose = commas.filter((pos) => !tight.includes(pos));

  if (loose.length > 0) return { ok: true, parts: splitAt(text, loose) };
  // Only tight commas remain.
  if (expected !== undefined) {
    if (expected === 1) return { ok: true, parts: [text.trim()] };
    if (tight.length === expected - 1) return { ok: true, parts: splitAt(text, tight) };
  }
  return { ok: false, reason: 'ambiguous-comma' };
}

/** Remove one pair of enclosing brackets of the given kinds, if present. */
export function stripBrackets(text: string, pairs: readonly (readonly [string, string])[]): string {
  const t = text.trim();
  for (const [open, close] of pairs) {
    if (t.startsWith(open) && t.endsWith(close) && t.length >= open.length + close.length) {
      return t.slice(open.length, t.length - close.length).trim();
    }
  }
  return t;
}
