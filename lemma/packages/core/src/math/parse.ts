import { CONSTANT_ALIASES, FUNCTION_ALIASES, type BinOp, type ConstName, type FnName, type Node } from './ast';

/**
 * Parser for the mathematics a student types on a keyboard.
 *
 * It accepts both Czech school notation and the usual programming/English one:
 *   2,5        decimal comma                 (2.5 as well)
 *   2x, 2(x+1) implicit multiplication
 *   sin 2x     function without parentheses  (sin(2x) as well)
 *   tg, cotg   Czech names for tan, cot
 *   log x      base 10;  ln x natural;  log_2(8), log2(8) other bases
 *   |x - 1|    absolute value                (abs(x-1) as well)
 *   x², √2, π  common Unicode symbols
 *   6 : 2      colon as division
 *
 * Deliberate limits: variables are single letters, and scientific notation (1e5) is not
 * supported because `e` is Euler's number.
 */

export interface ParseOptions {
  /** Read "2,5" as 2.5 (comma between digits, no spaces). Default: true. */
  decimalComma?: boolean;
  /** Letters that are variables even though they are also constants (`e`, `i`). */
  variables?: readonly string[];
  /** Treat `i` as the imaginary unit. Default: false. */
  complex?: boolean;
}

export type ParseErrorCode =
  | 'empty'
  | 'unexpected-char'
  | 'unexpected-token'
  | 'missing-paren'
  | 'missing-operand'
  | 'missing-argument'
  | 'unbalanced-bar'
  | 'bad-number';

export class ParseError extends Error {
  readonly code: ParseErrorCode;
  /** Character offset in the original input. */
  readonly pos: number;
  /** The offending fragment, if any. */
  readonly detail: string;

  constructor(code: ParseErrorCode, pos: number, detail = '') {
    super(`${code} at ${pos}${detail ? `: ${detail}` : ''}`);
    this.name = 'ParseError';
    this.code = code;
    this.pos = pos;
    this.detail = detail;
  }
}

type Tok =
  | { k: 'num'; v: number; pos: number }
  | {
      k: 'fn';
      fn: FnName;
      base?: string;
      /** A root sign: takes only the operand right after it. */ tight?: boolean;
      pos: number;
    }
  | { k: 'const'; name: ConstName; pos: number }
  | { k: 'var'; name: string; pos: number }
  | { k: 'op'; op: BinOp; pos: number }
  | { k: 'lp' | 'rp' | 'bar' | 'sep' | 'deg' | 'end'; pos: number };

const SUPERSCRIPTS: Record<string, string> = {
  '⁰': '0',
  '¹': '1',
  '²': '2',
  '³': '3',
  '⁴': '4',
  '⁵': '5',
  '⁶': '6',
  '⁷': '7',
  '⁸': '8',
  '⁹': '9',
  '⁻': '-',
};

const MINUS_LIKE = '−–—';
const TIMES_LIKE = '·×⋅∙*';
const DIVIDE_LIKE = '÷:/';

const isDigit = (c: string | undefined): boolean => c !== undefined && c >= '0' && c <= '9';
const isLetter = (c: string | undefined): boolean =>
  c !== undefined && ((c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z'));

const FUNCTION_NAMES = Object.keys(FUNCTION_ALIASES).sort((a, b) => b.length - a.length);
const CONSTANT_NAMES = Object.keys(CONSTANT_ALIASES).sort((a, b) => b.length - a.length);

function tokenize(input: string, opts: Required<ParseOptions>): Tok[] {
  const toks: Tok[] = [];
  const vars = new Set(opts.variables);
  let i = 0;

  /** Split a run of letters into functions, constants and single-letter variables. */
  const pushWord = (word: string, start: number): void => {
    let p = 0;
    while (p < word.length) {
      const rest = word.slice(p);
      const lower = rest.toLowerCase();
      const fnName = FUNCTION_NAMES.find((name) => {
        if (!lower.startsWith(name)) return false;
        // "asin" could be a·sin when `a` is a declared variable.
        if (name[0] === 'a' && name.length === 4 && vars.has('a')) return false;
        return true;
      });
      if (fnName) {
        toks.push({ k: 'fn', fn: FUNCTION_ALIASES[fnName]!, pos: start + p });
        p += fnName.length;
        continue;
      }
      const letter = rest[0]!;
      if (!vars.has(letter)) {
        const constName = CONSTANT_NAMES.find((name) => lower.startsWith(name));
        if (constName) {
          const canonical = CONSTANT_ALIASES[constName]!;
          const isImaginary = canonical === 'i';
          if (!isImaginary || opts.complex) {
            toks.push({ k: 'const', name: canonical, pos: start + p });
            p += constName.length;
            continue;
          }
        }
      }
      toks.push({ k: 'var', name: letter, pos: start + p });
      p += 1;
    }
  };

  while (i < input.length) {
    const c = input[i]!;

    if (c === ' ' || c === '\t' || c === '\n' || c === ' ' || c === ' ') {
      i++;
      continue;
    }

    if (isDigit(c) || (c === '.' && isDigit(input[i + 1]))) {
      const start = i;
      while (isDigit(input[i])) i++;
      const sepChar = input[i];
      const isDecimalSep = (sepChar === '.' || (sepChar === ',' && opts.decimalComma)) && isDigit(input[i + 1]);
      if (isDecimalSep) {
        i++;
        while (isDigit(input[i])) i++;
      }
      const text = input.slice(start, i).replace(',', '.');
      const v = Number(text);
      if (!Number.isFinite(v)) throw new ParseError('bad-number', start, text);
      toks.push({ k: 'num', v, pos: start });
      continue;
    }

    if (isLetter(c)) {
      const start = i;
      while (isLetter(input[i])) i++;
      const word = input.slice(start, i);
      pushWord(word, start);
      // Logarithm base: log_2, log_{10}, log2
      const last = toks[toks.length - 1]!;
      if (last.k === 'fn' && last.fn === 'log') {
        if (input[i] === '_') {
          i++;
          if (input[i] === '{' || input[i] === '(') {
            const close = input[i] === '{' ? '}' : ')';
            const end = input.indexOf(close, i);
            if (end < 0) throw new ParseError('missing-paren', i);
            last.base = input.slice(i + 1, end);
            i = end + 1;
          } else {
            const baseStart = i;
            while (isDigit(input[i]) || isLetter(input[i]) || input[i] === '.' || input[i] === ',') {
              // stop a letter base after one character: log_a(x)
              if (isLetter(input[i]) && i > baseStart) break;
              i++;
            }
            if (i === baseStart) throw new ParseError('missing-argument', i, 'log_');
            last.base = input.slice(baseStart, i);
          }
        } else if (isDigit(input[i])) {
          const baseStart = i;
          while (isDigit(input[i])) i++;
          last.base = input.slice(baseStart, i);
        }
      }
      continue;
    }

    if (c in SUPERSCRIPTS) {
      const start = i;
      let exponent = '';
      while (i < input.length && input[i]! in SUPERSCRIPTS) exponent += SUPERSCRIPTS[input[i++]!];
      toks.push({ k: 'op', op: '^', pos: start });
      if (exponent.startsWith('-')) {
        toks.push({ k: 'lp', pos: start });
        toks.push({ k: 'op', op: '-', pos: start });
        toks.push({ k: 'num', v: Number(exponent.slice(1)), pos: start });
        toks.push({ k: 'rp', pos: start });
      } else {
        toks.push({ k: 'num', v: Number(exponent), pos: start });
      }
      continue;
    }

    if (c === '+') toks.push({ k: 'op', op: '+', pos: i });
    else if (c === '-' || MINUS_LIKE.includes(c)) toks.push({ k: 'op', op: '-', pos: i });
    else if (c === '*' && input[i + 1] === '*') {
      toks.push({ k: 'op', op: '^', pos: i });
      i++;
    } else if (TIMES_LIKE.includes(c)) toks.push({ k: 'op', op: '*', pos: i });
    else if (DIVIDE_LIKE.includes(c)) toks.push({ k: 'op', op: '/', pos: i });
    else if (c === '^') toks.push({ k: 'op', op: '^', pos: i });
    else if (c === '(') toks.push({ k: 'lp', pos: i });
    else if (c === ')') toks.push({ k: 'rp', pos: i });
    else if (c === '|') toks.push({ k: 'bar', pos: i });
    else if (c === ';' || c === ',') toks.push({ k: 'sep', pos: i });
    else if (c === '°') toks.push({ k: 'deg', pos: i });
    else if (c === 'π') toks.push({ k: 'const', name: 'pi', pos: i });
    else if (c === '∞') toks.push({ k: 'const', name: 'inf', pos: i });
    else if (c === '√') toks.push({ k: 'fn', fn: 'sqrt', tight: true, pos: i });
    else if (c === '∛') toks.push({ k: 'fn', fn: 'cbrt', tight: true, pos: i });
    else throw new ParseError('unexpected-char', i, c);
    i++;
  }

  toks.push({ k: 'end', pos: input.length });
  return toks;
}

class Parser {
  private p = 0;
  private absDepth = 0;

  constructor(
    private readonly toks: Tok[],
    private readonly opts: Required<ParseOptions>,
  ) {}

  private peek(): Tok {
    return this.toks[this.p]!;
  }

  private take(): Tok {
    return this.toks[this.p++]!;
  }

  private isOp(op: BinOp): boolean {
    const t = this.peek();
    return t.k === 'op' && t.op === op;
  }

  parseAll(): Node {
    if (this.peek().k === 'end') throw new ParseError('empty', 0);
    const node = this.expr();
    const t = this.peek();
    if (t.k !== 'end') {
      if (t.k === 'rp') throw new ParseError('missing-paren', t.pos, ')');
      if (t.k === 'bar') throw new ParseError('unbalanced-bar', t.pos);
      throw new ParseError('unexpected-token', t.pos);
    }
    return node;
  }

  private expr(): Node {
    let left = this.term();
    for (;;) {
      if (this.isOp('+')) {
        this.take();
        left = { t: 'bin', op: '+', a: left, b: this.term() };
      } else if (this.isOp('-')) {
        this.take();
        left = { t: 'bin', op: '-', a: left, b: this.term() };
      } else return left;
    }
  }

  /** Can the next token begin an operand (used to detect implicit multiplication)? */
  private startsOperand(): boolean {
    const t = this.peek();
    if (t.k === 'num' || t.k === 'var' || t.k === 'const' || t.k === 'fn' || t.k === 'lp') return true;
    // A bar closes the current |…| if one is open; otherwise it opens a new one.
    if (t.k === 'bar') return this.absDepth === 0;
    return false;
  }

  private term(): Node {
    let left = this.unary();
    for (;;) {
      if (this.isOp('*')) {
        this.take();
        left = { t: 'bin', op: '*', a: left, b: this.unary() };
      } else if (this.isOp('/')) {
        this.take();
        left = { t: 'bin', op: '/', a: left, b: this.unary() };
      } else if (this.startsOperand()) {
        left = { t: 'bin', op: '*', a: left, b: this.power(), implicit: true };
      } else return left;
    }
  }

  private unary(): Node {
    if (this.isOp('-')) {
      this.take();
      return { t: 'neg', a: this.unary() };
    }
    if (this.isOp('+')) {
      this.take();
      return this.unary();
    }
    return this.power();
  }

  private power(): Node {
    const base = this.postfix();
    if (this.isOp('^')) {
      this.take();
      return { t: 'bin', op: '^', a: base, b: this.unary() };
    }
    return base;
  }

  private postfix(): Node {
    let node = this.primary();
    while (this.peek().k === 'deg') {
      this.take();
      node = { t: 'deg', a: node };
    }
    return node;
  }

  private primary(): Node {
    const t = this.take();
    switch (t.k) {
      case 'num':
        return { t: 'num', v: t.v };
      case 'var':
        return { t: 'var', name: t.name };
      case 'const':
        return { t: 'const', name: t.name };
      case 'lp': {
        const saved = this.absDepth;
        this.absDepth = 0;
        const inner = this.expr();
        this.absDepth = saved;
        if (this.peek().k !== 'rp') throw new ParseError('missing-paren', this.peek().pos, '(');
        this.take();
        return inner;
      }
      case 'bar': {
        this.absDepth++;
        const inner = this.expr();
        this.absDepth--;
        if (this.peek().k !== 'bar') throw new ParseError('unbalanced-bar', t.pos);
        this.take();
        return { t: 'abs', a: inner };
      }
      case 'fn':
        return this.functionCall(t);
      case 'end':
        throw new ParseError('missing-operand', t.pos);
      case 'rp':
        throw new ParseError('missing-operand', t.pos, ')');
      default:
        throw new ParseError('unexpected-token', t.pos);
    }
  }

  private functionCall(t: Extract<Tok, { k: 'fn' }>): Node {
    // sin^2 x  →  (sin x)^2
    let exponent: Node | null = null;
    if (this.isOp('^')) {
      this.take();
      exponent = this.functionExponent();
    }

    let args: Node[];
    if (this.peek().k === 'lp') {
      this.take();
      const saved = this.absDepth;
      this.absDepth = 0;
      args = [this.expr()];
      while (this.peek().k === 'sep') {
        this.take();
        args.push(this.expr());
      }
      this.absDepth = saved;
      if (this.peek().k !== 'rp') throw new ParseError('missing-paren', this.peek().pos, '(');
      this.take();
    } else {
      args = [this.implicitArgument(t)];
    }

    if (t.base !== undefined) {
      args.push(parse(t.base, this.opts));
    }
    const maxArgs = t.fn === 'log' ? 2 : 1;
    if (args.length > maxArgs) throw new ParseError('unexpected-token', t.pos, t.fn);

    const callNode: Node = { t: 'call', fn: t.fn, args };
    return exponent ? { t: 'bin', op: '^', a: callNode, b: exponent } : callNode;
  }

  private functionExponent(): Node {
    const t = this.take();
    if (t.k === 'num') return { t: 'num', v: t.v };
    if (t.k === 'op' && t.op === '-') {
      const n = this.take();
      if (n.k !== 'num') throw new ParseError('missing-operand', n.pos);
      return { t: 'neg', a: { t: 'num', v: n.v } };
    }
    if (t.k === 'lp') {
      const inner = this.expr();
      if (this.peek().k !== 'rp') throw new ParseError('missing-paren', this.peek().pos, '(');
      this.take();
      return inner;
    }
    throw new ParseError('missing-operand', t.pos);
  }

  /**
   * Argument of a function written without parentheses: `sin 2x`, `ln 5`, `√2`.
   * For a named function it extends over a run of numbers and letters, so `sin 2x cos x`
   * is sin(2x)·cos(x). A root sign has no bar to show how far it reaches, so it takes
   * only the operand right after it: `√3 i` is √3·i and `2√2 x` is 2√2·x; a longer
   * radicand needs brackets, `√(2x)`.
   */
  private implicitArgument(fn: Extract<Tok, { k: 'fn' }>): Node {
    const first = this.peek();
    if (first.k !== 'num' && first.k !== 'var' && first.k !== 'const' && first.k !== 'fn' && first.k !== 'bar') {
      throw new ParseError('missing-argument', fn.pos, fn.fn);
    }
    let arg = this.power();
    if (fn.tight) return arg;
    for (;;) {
      const t = this.peek();
      if (t.k === 'num' || t.k === 'var' || t.k === 'const') {
        arg = { t: 'bin', op: '*', a: arg, b: this.power(), implicit: true };
      } else return arg;
    }
  }
}

function withDefaults(opts: ParseOptions | undefined): Required<ParseOptions> {
  return {
    decimalComma: opts?.decimalComma ?? true,
    variables: opts?.variables ?? [],
    complex: opts?.complex ?? false,
  };
}

/** Parse an expression; throws ParseError when the input is not understood. */
export function parse(input: string, opts?: ParseOptions): Node {
  const full = withDefaults(opts);
  return new Parser(tokenize(input, full), full).parseAll();
}

export type ParseResult = { ok: true; node: Node } | { ok: false; error: ParseError };

/** Like `parse`, but returns the error instead of throwing. */
export function tryParse(input: string, opts?: ParseOptions): ParseResult {
  try {
    return { ok: true, node: parse(input, opts) };
  } catch (error) {
    if (error instanceof ParseError) return { ok: false, error };
    throw error;
  }
}
