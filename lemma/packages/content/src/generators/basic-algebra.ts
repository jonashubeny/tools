import { L, fToInput, fToTex, frac, lcm, nTex, polyIn, polyTex, type Generator, type Rng } from '@lemma/core';
import { ans, both, csT, enT, numericChoice, plEn, plural } from './basic-kit';
import { distinct, gen, mc, nz, par, shiftTex, step, tailTex } from './helpers';

/** Expressions, equations and word problems. */

const fr = (n: number | string, d: number): string => `\\frac{${n}}{${d}}`;

/** Draw parameters until `accept` returns a value; generators stay deterministic because `r` is. */
function search<T>(r: Rng, attempt: (r: Rng) => T | null, what: string): T {
  for (let i = 0; i < 400; i++) {
    const found = attempt(r);
    if (found !== null) return found;
  }
  throw new Error(`${what}: no suitable parameters found`);
}

/** "x + 3", "x − 3": a variable with a constant, for prose. */
const lin = (a: number, b: number, v = 'x'): string => polyTex([a, b], { variable: v });

export const BASIC_ALGEBRA_GENERATORS: Generator[] = [
  // ------------------------------------------------------------------------- expressions
  gen({
    id: 'expr.variables.evaluate',
    concept: 'expr.variables',
    kind: 'core',
    levels: [1, 2, 3],
    title: L('Hodnota výrazu', 'The value of an expression'),
    est: (lv) => 35 + 25 * lv,
    make(r, lv) {
      if (lv === 1) {
        const k = nz(r, -6, 6);
        const m = nz(r, -9, 9);
        const a = -r.int(2, 6);
        const value = k * a + m;
        return {
          prompt: L(
            `Vypočtěte hodnotu výrazu $${lin(k, m, 'a')}$ pro $a = ${a}$.`,
            `Find the value of $${lin(k, m, 'a')}$ for $a = ${a}$.`,
          ),
          answer: { kind: 'number', value: ans(value) },
          hints: [
            L('Záporné číslo dosazuj do závorky.', 'Substitute a negative number in brackets.'),
            L(`$${nTex(k)} \\cdot (${a}) = ${k * a}$`, `$${nTex(k)} \\cdot (${a}) = ${k * a}$`),
          ],
          solution: [
            step(
              'Dosadíme:',
              'Substitute:',
              `${nTex(k)} \\cdot (${a}) ${tailTex(m)} = ${k * a} ${tailTex(m)} = ${value}`,
            ),
          ],
          misconceptions: [
            mc(
              ans(-k * a + m),
              'sign',
              'Pozor na znaménko součinu se záporným číslem.',
              'Mind the sign of a product with a negative number.',
            ),
          ],
          verify: [{ kind: 'value', expr: `${k}*a+(${m})`, env: { a } }],
        };
      }
      if (lv === 2) {
        const p = r.pick([1, 2, 3, 4]);
        const q = nz(r, -6, 6);
        const c = nz(r, -5, 5);
        const a = r.pick([-4, -3, -2, 2, 3, 5]);
        const value = p * a * a + q * a + c;
        const shown = polyTex([p, q, c], { variable: 'a' });
        return {
          prompt: L(`Vypočtěte pro $a = ${a}$: $${shown}$`, `Calculate for $a = ${a}$: $${shown}$`),
          answer: { kind: 'number', value: ans(value) },
          hints: [
            L(
              'Nejdřív mocnina, pak násobení, nakonec sčítání. Záporné $a$ piš do závorky.',
              'The power first, then the products, then add. Write a negative $a$ in brackets.',
            ),
            L(`$a^2 = ${par(a)}^2 = ${a * a}$`, `$a^2 = ${par(a)}^2 = ${a * a}$`),
          ],
          solution: [
            step('Mocnina:', 'The power:', `a^2 = ${a * a}`),
            step(
              'Dosadíme:',
              'Substitute:',
              `${p === 1 ? '' : `${p} \\cdot `}${a * a} ${q < 0 ? '-' : '+'} ${Math.abs(q)} \\cdot ${par(a)} ${tailTex(c)} = ${value}`,
            ),
          ],
          misconceptions:
            a < 0
              ? [
                  mc(
                    ans(-p * a * a + q * a + c),
                    'sign',
                    'Druhá mocnina záporného čísla je kladná: umocňuje se celá závorka.',
                    'The square of a negative number is positive: the whole bracket is squared.',
                  ),
                ]
              : [],
          verify: [{ kind: 'value', expr: `${p}*a^2+(${q})*a+(${c})`, env: { a } }],
        };
      }
      const x = r.pick([-3, -2, 2, 3, 4]);
      const y = r.pick([-4, -3, -2, 3, 5].filter((v) => v !== x));
      const k = r.pick([2, 3]);
      const value = x * x - k * x * y;
      return {
        prompt: L(
          `Vypočtěte hodnotu výrazu $x^2 - ${k}xy$ pro $x = ${x}$, $y = ${y}$.`,
          `Find the value of $x^2 - ${k}xy$ for $x = ${x}$, $y = ${y}$.`,
        ),
        answer: { kind: 'number', value: ans(value) },
        hints: [
          L('Spočítej každý člen zvlášť a hlídej znaménka.', 'Work out each term separately and watch the signs.'),
          L(
            `$x^2 = ${x * x}$, $${k}xy = ${k} \\cdot ${par(x)} \\cdot ${par(y)} = ${k * x * y}$`,
            `$x^2 = ${x * x}$, $${k}xy = ${k} \\cdot ${par(x)} \\cdot ${par(y)} = ${k * x * y}$`,
          ),
        ],
        solution: [
          step('Oba členy:', 'Both terms:', `x^2 = ${x * x}, \\quad ${k}xy = ${k * x * y}`),
          step('Rozdíl:', 'The difference:', `${x * x} - ${par(k * x * y)} = ${value}`),
        ],
        misconceptions: [
          mc(
            ans(x * x + k * x * y),
            'sign',
            'Druhý člen se odečítá — a odečíst záporné číslo znamená přičíst.',
            'The second term is subtracted — and subtracting a negative number means adding.',
          ),
        ],
        verify: [{ kind: 'value', expr: `x^2-${k}*x*y`, env: { x, y } }],
      };
    },
  }),

  gen({
    id: 'expr.variables.from-words',
    concept: 'expr.variables',
    kind: 'applied',
    levels: [1, 2, 3],
    title: L('Zápis výrazem s proměnnou', 'Writing an expression with a variable'),
    est: (lv) => 50 + 30 * lv,
    make(r, lv) {
      const [a, b] = r.sample(['Jana', 'Petr', 'Klára', 'Vojta', 'Eva', 'Dan'], 2) as [string, string];
      const times = (k: number): string => ['dvojnásobek', 'trojnásobek', 'čtyřnásobek', 'pětinásobek'][k - 2]!;
      if (lv === 1) {
        const k = r.int(2, 5);
        const m = r.int(3, 20);
        const more = r.bool();
        return {
          prompt: L(
            `${a} má $x$ korun. ${b} má o ${m} ${plural(m, 'korunu', 'koruny', 'korun')} ${more ? 'více' : 'méně'} než ${times(k)} toho, co má ${a}. Vyjádřete výrazem s proměnnou $x$, kolik korun má ${b}.`,
            `${a} has $x$ crowns. ${b} has ${m} crowns ${more ? 'more' : 'less'} than ${k} times what ${a} has. Write an expression in $x$ for the number of crowns ${b} has.`,
          ),
          answer: { kind: 'expr', value: polyIn([k, more ? m : -m]), vars: ['x'] },
          hints: [
            L(
              `Nejdřív násobek: ${k}krát tolik, co má ${a}, je $${k}x$.`,
              `First the multiple: ${k} times what ${a} has is $${k}x$.`,
            ),
            L(
              `„O ${m} ${more ? 'více' : 'méně'}“ znamená ${more ? 'přičíst' : 'odečíst'} ${m}.`,
              `"${m} ${more ? 'more' : 'less'}" means ${more ? 'adding' : 'subtracting'} ${m}.`,
            ),
          ],
          solution: [step('Násobek a k němu změna:', 'The multiple and then the change:', polyTex([k, more ? m : -m]))],
          misconceptions: [
            mc(
              `${k}*(x${more ? '+' : '-'}${m})`,
              'misread',
              `Násobí se jen to, co má ${a}; částka ${m} Kč se ${more ? 'přičítá' : 'odečítá'} až potom.`,
              `Only what ${a} has is multiplied; the ${m} crowns come afterwards.`,
            ),
          ],
          verify: [{ kind: 'equiv', expr: `${k}*x${more ? '+' : '-'}${m}`, vars: ['x'] }],
          context: { applied: true },
        };
      }
      if (lv === 2) {
        const k = r.int(2, 4);
        const m = r.int(5, 30);
        return {
          prompt: L(
            `${a} má $x$ korun, ${b} má o ${m} korun více než ${times(k)} této částky. Vyjádřete výrazem s proměnnou $x$, kolik korun mají oba dohromady.`,
            `${a} has $x$ crowns and ${b} has ${m} crowns more than ${k} times that amount. Write an expression in $x$ for what they have together.`,
          ),
          answer: { kind: 'expr', value: polyIn([k + 1, m]), vars: ['x'] },
          hints: [
            L(`${b} má $${k}x + ${m}$ korun.`, `${b} has $${k}x + ${m}$ crowns.`),
            L(
              'Dohromady: sečti oba výrazy a sluč členy s $x$.',
              'Together: add both expressions and collect the terms in $x$.',
            ),
          ],
          solution: [
            step(`${b}:`, `${b}:`, `${k}x + ${m}`),
            step('Dohromady:', 'Together:', `x + ${k}x + ${m} = ${polyTex([k + 1, m])}`),
          ],
          misconceptions: [
            mc(
              polyIn([k, m]),
              'incomplete',
              `To je jen částka, kterou má ${b}. Otázka se ptá na oba dohromady.`,
              `That is only what ${b} has. The question asks for both together.`,
            ),
          ],
          verify: [{ kind: 'equiv', expr: `x+${k}*x+${m}`, vars: ['x'] }],
          context: { applied: true },
        };
      }
      const [p, q] = r.pick([
        [3, 4],
        [2, 3],
        [4, 5],
        [3, 5],
        [2, 5],
        [5, 6],
      ] as const);
      const rest = frac((p - 1) * (q - 1), p * q);
      const part = (n: number): [string, string] =>
        n === 2
          ? ['polovina', 'a half']
          : n === 3
            ? ['třetina', 'a third']
            : n === 4
              ? ['čtvrtina', 'a quarter']
              : n === 5
                ? ['pětina', 'a fifth']
                : ['šestina', 'a sixth'];
      return {
        prompt: L(
          `Role látky měřila $x$ metrů. Nejdřív se prodala ${part(p)[0]} role a potom ${part(q)[0]} toho, co zbylo. Vyjádřete výrazem s proměnnou $x$, kolik metrů látky zůstalo.`,
          `A roll of cloth was $x$ metres long. First ${part(p)[1]} of the roll was sold and then ${part(q)[1]} of what was left. Write an expression in $x$ for the metres that remained.`,
        ),
        answer: { kind: 'expr', value: `${rest.n}*x/${rest.d}`, vars: ['x'] },
        hints: [
          L(`Po prvním prodeji zbylo $${fr(p - 1, p)}x$.`, `After the first sale $${fr(p - 1, p)}x$ was left.`),
          L(
            `Z toho se prodala ${part(q)[0]}, zbylo tedy $${fr(q - 1, q)}$ z $${fr(p - 1, p)}x$.`,
            `Then ${part(q)[1]} of that was sold, leaving $${fr(q - 1, q)}$ of $${fr(p - 1, p)}x$.`,
          ),
        ],
        solution: [
          step('Po prvním prodeji:', 'After the first sale:', `x - ${fr(1, p)}x = ${fr(p - 1, p)}x`),
          step(
            'Po druhém prodeji:',
            'After the second sale:',
            `${fr(q - 1, q)} \\cdot ${fr(p - 1, p)}x = ${fToTex(rest)}x`,
          ),
        ],
        misconceptions: [
          mc(
            `${p * q - p - q}*x/${p * q}`,
            'misread',
            'Druhá část se počítá ze zbytku, ne z celé role.',
            'The second part is taken of the remainder, not of the whole roll.',
          ),
        ],
        verify: [{ kind: 'equiv', expr: `x-x/${p}-(x-x/${p})/${q}`, vars: ['x'] }],
        context: { applied: true },
      };
    },
  }),

  gen({
    id: 'expr.polynomials.simplify',
    concept: 'expr.polynomials',
    kind: 'core',
    levels: [1, 2, 3],
    title: L('Zjednodušení výrazu', 'Simplifying an expression'),
    est: (lv) => 45 + 30 * lv,
    make(r, lv) {
      if (lv === 1) {
        const a = r.int(3, 9);
        const b = nz(r, -8, 8);
        const c = r.int(2, 8);
        const d = nz(r, -8, 8);
        const coeffs = [a - c, b + d];
        if (coeffs[0] === 0) coeffs[0] = 1;
        const cc = a - coeffs[0]!;
        const shown = `${lin(a, b)} - (${lin(cc, -d)})`;
        return {
          prompt: L(`Zjednodušte: $${shown}$`, `Simplify: $${shown}$`),
          answer: { kind: 'expr', value: polyIn(coeffs), vars: ['x'], form: 'expanded' },
          hints: [
            L(
              'Minus před závorkou mění znaménko každému členu v ní.',
              'A minus in front of a bracket changes the sign of every term inside.',
            ),
            L(`$-(${lin(cc, -d)}) = ${polyTex([-cc, d])}$`, `$-(${lin(cc, -d)}) = ${polyTex([-cc, d])}$`),
          ],
          solution: [
            step('Odstraníme závorku:', 'Remove the bracket:', `${lin(a, b)} ${tailTex(-cc)}x ${tailTex(d)}`),
            step('Sloučíme:', 'Collect:', polyTex(coeffs)),
          ],
          misconceptions: [
            mc(
              polyIn([a - cc, b - d]),
              'sign',
              'Minus před závorkou platí i pro druhý člen.',
              'The minus in front of the bracket applies to the second term too.',
            ),
          ],
          verify: [{ kind: 'equiv', expr: `${polyIn([a, b])}-(${polyIn([cc, -d])})`, vars: ['x'] }],
        };
      }
      if (lv === 2) {
        const [a, b] = distinct(r, -6, 6, 2, [0]) as [number, number];
        const c = r.intExcept(-7, 7, [0, a + b]);
        const coeffs = [a + b - c, a * b];
        const shown = `(${shiftTex(-a)})(${shiftTex(-b)}) - x(${shiftTex(-c)})`;
        return {
          prompt: L(
            `Upravte na co nejjednodušší tvar bez závorek: $${shown}$`,
            `Simplify to a form without brackets: $${shown}$`,
          ),
          answer: { kind: 'expr', value: polyIn(coeffs), vars: ['x'], form: 'expanded' },
          hints: [
            L(
              'Roznásob každý součin zvlášť. Druhý nech zatím v závorce s minusem před ní.',
              'Expand each product separately. Keep the second in a bracket with the minus in front for now.',
            ),
            L(
              `$(${shiftTex(-a)})(${shiftTex(-b)}) = ${polyTex([1, a + b, a * b])}$`,
              `$(${shiftTex(-a)})(${shiftTex(-b)}) = ${polyTex([1, a + b, a * b])}$`,
            ),
          ],
          solution: [
            step(
              'Oba součiny:',
              'Both products:',
              `${polyTex([1, a + b, a * b])} - \\left(${polyTex([1, c, 0])}\\right)`,
            ),
            step('Po odečtení se $x^2$ zruší:', 'After subtracting, $x^2$ cancels:', polyTex(coeffs)),
          ],
          misconceptions: [
            mc(
              polyIn([a + b + c, a * b]),
              'sign',
              'Minus před druhým součinem mění znaménko obou jeho členů.',
              'The minus in front of the second product changes the sign of both its terms.',
            ),
          ],
          verify: [{ kind: 'equiv', expr: `(x+(${a}))*(x+(${b}))-x*(x+(${c}))`, vars: ['x'] }],
        };
      }
      const a = nz(r, -5, 5);
      const b = nz(r, -4, 4);
      const k = r.pick([2, 3]);
      const coeffs = [1 + k, 2 * a - k * b, a * a];
      const shown = `(${shiftTex(-a, 'y')})^2 + (${shiftTex(b, 'y')}) \\cdot ${k}y`;
      return {
        prompt: L(
          `Upravte na co nejjednodušší tvar bez závorek: $${shown}$`,
          `Simplify to a form without brackets: $${shown}$`,
        ),
        answer: { kind: 'expr', value: polyIn(coeffs, { variable: 'y' }), vars: ['y'], form: 'expanded' },
        hints: [
          L(
            'První část podle vzorce $(A + B)^2 = A^2 + 2AB + B^2$, druhou roznásob.',
            'The first part by $(A + B)^2 = A^2 + 2AB + B^2$; expand the second.',
          ),
          L(
            `$(${shiftTex(-a, 'y')})^2 = ${polyTex([1, 2 * a, a * a], { variable: 'y' })}$`,
            `$(${shiftTex(-a, 'y')})^2 = ${polyTex([1, 2 * a, a * a], { variable: 'y' })}$`,
          ),
        ],
        solution: [
          step(
            'Obě části:',
            'Both parts:',
            `\\left(${polyTex([1, 2 * a, a * a], { variable: 'y' })}\\right) + \\left(${polyTex([k, -k * b, 0], { variable: 'y' })}\\right)`,
          ),
          step('Sloučíme:', 'Collect:', polyTex(coeffs, { variable: 'y' })),
        ],
        misconceptions: [
          mc(
            polyIn([1 + k, -k * b, a * a], { variable: 'y' }),
            'algebra',
            'V druhé mocnině dvojčlenu chybí prostřední člen $2AB$.',
            'The middle term $2AB$ of the squared binomial is missing.',
          ),
        ],
        verify: [{ kind: 'equiv', expr: `(y+(${a}))^2+(y-(${b}))*${k}*y`, vars: ['y'] }],
      };
    },
  }),

  gen({
    id: 'expr.polynomials.square',
    concept: 'expr.polynomials',
    kind: 'core',
    levels: [1, 2, 3],
    title: L('Druhá mocnina dvojčlenu', 'The square of a binomial'),
    est: (lv) => 40 + 25 * lv,
    make(r, lv) {
      if (lv === 1) {
        const b = nz(r, -9, 9);
        const coeffs = [1, 2 * b, b * b];
        return {
          prompt: L(`Umocněte: $(${shiftTex(-b)})^2$`, `Expand: $(${shiftTex(-b)})^2$`),
          answer: { kind: 'expr', value: polyIn(coeffs), vars: ['x'], form: 'expanded' },
          hints: [
            L('$(A + B)^2 = A^2 + 2AB + B^2$', '$(A + B)^2 = A^2 + 2AB + B^2$'),
            L(`Prostřední člen je $2 \\cdot x \\cdot ${par(b)}$.`, `The middle term is $2 \\cdot x \\cdot ${par(b)}$.`),
          ],
          solution: [step('Podle vzorce:', 'By the identity:', polyTex(coeffs))],
          misconceptions: [
            mc(polyIn([1, 0, b * b]), 'algebra', 'Chybí prostřední člen $2AB$.', 'The middle term $2AB$ is missing.'),
            mc(
              polyIn([1, b, b * b]),
              'formula',
              'Prostřední člen je dvojnásobný součin.',
              'The middle term is twice the product.',
            ),
          ],
          verify: [{ kind: 'equiv', expr: `(x+(${b}))^2`, vars: ['x'] }],
        };
      }
      if (lv === 2) {
        const a = r.pick([2, 3, 4, 5]);
        const b = nz(r, -6, 6);
        const coeffs = [a * a, 2 * a * b, b * b];
        return {
          prompt: L(`Umocněte: $(${lin(a, b)})^2$`, `Expand: $(${lin(a, b)})^2$`),
          answer: { kind: 'expr', value: polyIn(coeffs), vars: ['x'], form: 'expanded' },
          hints: [
            L(
              `$A = ${a}x$, $B = ${b}$. Umocňuje se i koeficient: $(${a}x)^2 = ${a * a}x^2$.`,
              `$A = ${a}x$, $B = ${b}$. The coefficient is squared too: $(${a}x)^2 = ${a * a}x^2$.`,
            ),
            L(
              `Prostřední člen: $2 \\cdot ${a}x \\cdot ${par(b)} = ${2 * a * b}x$`,
              `The middle term: $2 \\cdot ${a}x \\cdot ${par(b)} = ${2 * a * b}x$`,
            ),
          ],
          solution: [step('Podle vzorce:', 'By the identity:', polyTex(coeffs))],
          misconceptions: [
            mc(
              polyIn([a, 2 * a * b, b * b]),
              'algebra',
              'Umocňuje se i koeficient u $x$.',
              'The coefficient of $x$ is squared too.',
            ),
            mc(
              polyIn([a * a, 0, b * b]),
              'algebra',
              'Chybí prostřední člen $2AB$.',
              'The middle term $2AB$ is missing.',
            ),
          ],
          verify: [{ kind: 'equiv', expr: `(${a}*x+(${b}))^2`, vars: ['x'] }],
        };
      }
      const d = r.pick([2, 3, 4, 5]);
      const b = nz(r, -4, 4);
      const coeffs = [frac(1, d * d), frac(2 * b, d), frac(b * b)];
      return {
        prompt: L(
          `Umocněte a zjednodušte: $\\left(${fr(1, d)}x ${tailTex(b)}\\right)^2$`,
          `Expand and simplify: $\\left(${fr(1, d)}x ${tailTex(b)}\\right)^2$`,
        ),
        answer: { kind: 'expr', value: polyIn(coeffs), vars: ['x'], form: 'expanded' },
        hints: [
          L(
            `$\\left(${fr(1, d)}x\\right)^2 = ${fr(1, d * d)}x^2$`,
            `$\\left(${fr(1, d)}x\\right)^2 = ${fr(1, d * d)}x^2$`,
          ),
          L(
            `Prostřední člen: $2 \\cdot ${fr(1, d)}x \\cdot ${par(b)} = ${fToTex(frac(2 * b, d))}x$`,
            `The middle term: $2 \\cdot ${fr(1, d)}x \\cdot ${par(b)} = ${fToTex(frac(2 * b, d))}x$`,
          ),
        ],
        solution: [step('Podle vzorce:', 'By the identity:', polyTex(coeffs))],
        misconceptions: [
          mc(
            polyIn([frac(1, d), frac(2 * b, d), frac(b * b)]),
            'algebra',
            'Umocňuje se i zlomek u $x$.',
            'The fraction in front of $x$ is squared too.',
          ),
        ],
        verify: [{ kind: 'equiv', expr: `(x/${d}+(${b}))^2`, vars: ['x'] }],
      };
    },
  }),

  gen({
    id: 'expr.factoring.common',
    concept: 'expr.factoring',
    kind: 'core',
    levels: [1, 2, 3],
    title: L('Vytýkání', 'Factoring out'),
    est: (lv) => 45 + 30 * lv,
    make(r, lv) {
      if (lv === 1) {
        const g = r.pick([2, 3, 4, 5, 6]);
        const [p, q0] = r.pick([
          [1, 2],
          [1, 3],
          [2, 3],
          [2, 5],
          [3, 2],
          [3, 5],
          [5, 2],
          [1, 7],
          [3, 7],
          [5, 3],
        ] as const);
        const q = q0 * r.sign();
        const shown = polyTex([g * p, g * q, 0], { variable: 'a' });
        return {
          prompt: L(`Rozložte na součin vytknutím: $${shown}$`, `Factor by taking out the common factor: $${shown}$`),
          answer: {
            kind: 'expr',
            value: `${g}*a*(${polyIn([p, q], { variable: 'a' })})`,
            vars: ['a'],
            form: 'factored',
          },
          hints: [
            L(
              'Co mají oba členy společného? Hledej číslo i proměnnou.',
              'What do both terms share? Look for a number and for the variable.',
            ),
            L(`Oba členy jsou dělitelné výrazem $${g}a$.`, `Both terms are divisible by $${g}a$.`),
          ],
          solution: [
            step(`Vytkneme $${g}a$:`, `Take out $${g}a$:`, `${g}a\\left(${polyTex([p, q], { variable: 'a' })}\\right)`),
            step('Kontrola: roznásobením dostaneme původní výraz.', 'Check: expanding gives the original back.'),
          ],
          misconceptions: [],
          verify: [{ kind: 'equiv', expr: polyIn([g * p, g * q, 0], { variable: 'a' }), vars: ['a'] }],
        };
      }
      if (lv === 2) {
        const g = r.pick([2, 3, 4, 5]);
        const p = nz(r, -4, 4);
        const q = r.pick([2, 3, 5]);
        // g·y² + g·p·y + g·q·x·y = g·y(y + p + q·x)
        const shown = `${g}y^2 ${tailTex(g * p)}y + ${g * q}xy`;
        return {
          prompt: L(`Z výrazu vytkněte $${g}y$: $${shown}$`, `Take $${g}y$ out of the expression: $${shown}$`),
          answer: {
            kind: 'expr',
            value: `${g}*y*(y${p < 0 ? '-' : '+'}${Math.abs(p)}+${q}*x)`,
            vars: ['x', 'y'],
            form: 'factored',
          },
          hints: [
            L(`Každý člen vyděl výrazem $${g}y$.`, `Divide each term by $${g}y$.`),
            L(
              `$${g}y^2 : ${g}y = y$, $${g * q}xy : ${g}y = ${q}x$`,
              `$${g}y^2 \\div ${g}y = y$, $${g * q}xy \\div ${g}y = ${q}x$`,
            ),
          ],
          solution: [step('Po vytknutí:', 'After factoring out:', `${g}y\\left(y ${tailTex(p)} + ${q}x\\right)`)],
          misconceptions: [],
          verify: [{ kind: 'equiv', expr: `${g}*y^2+(${g * p})*y+${g * q}*x*y`, vars: ['x', 'y'] }],
        };
      }
      const a = r.int(2, 7);
      const k = r.int(2, 5);
      const total = a + k;
      const shown = `(${a} + x) \\cdot x + ${k}x`;
      return {
        prompt: L(
          `Upravte a rozložte na součin vytknutím: $${shown}$`,
          `Simplify and factor by taking out the common factor: $${shown}$`,
        ),
        answer: { kind: 'expr', value: `x*(x+${total})`, vars: ['x'], form: 'factored' },
        hints: [
          L('Nejdřív roznásob a sluč, potom vytýkej.', 'Expand and collect first, then factor out.'),
          L(`Po úpravě: $x^2 + ${total}x$`, `After simplifying: $x^2 + ${total}x$`),
        ],
        solution: [
          step('Roznásobíme a sloučíme:', 'Expand and collect:', `${a}x + x^2 + ${k}x = x^2 + ${total}x`),
          step('Vytkneme $x$:', 'Take out $x$:', `x(x + ${total})`),
        ],
        misconceptions: [],
        verify: [{ kind: 'equiv', expr: `(${a}+x)*x+${k}*x`, vars: ['x'] }],
      };
    },
  }),

  gen({
    id: 'expr.factoring.identities',
    concept: 'expr.factoring',
    kind: 'core',
    levels: [1, 2, 3],
    title: L('Rozklad podle vzorce', 'Factoring by an identity'),
    est: (lv) => 45 + 30 * lv,
    make(r, lv) {
      if (lv === 1) {
        const a = r.pick([1, 2, 3, 4, 5]);
        const b = r.pick([1, 2, 3, 5, 7].filter((v) => v !== a && (a === 1 || v % a !== 0)));
        const shown = polyTex([a * a, 0, -b * b], { variable: 'a' });
        const ax = a === 1 ? 'a' : `${a}a`;
        return {
          prompt: L(`Rozložte na součin podle vzorce: $${shown}$`, `Factor by an identity: $${shown}$`),
          answer: {
            kind: 'expr',
            value: `(${a === 1 ? '' : `${a}*`}a-${b})*(${a === 1 ? '' : `${a}*`}a+${b})`,
            vars: ['a'],
            form: 'factored',
          },
          hints: [
            L(
              'Dva čtverce a mezi nimi minus: $A^2 - B^2 = (A - B)(A + B)$.',
              'Two squares with a minus between them: $A^2 - B^2 = (A - B)(A + B)$.',
            ),
            L(`$A = ${ax}$, $B = ${b}$`, `$A = ${ax}$, $B = ${b}$`),
          ],
          solution: [step('Rozdíl čtverců:', 'A difference of squares:', `(${ax} - ${b})(${ax} + ${b})`)],
          misconceptions: [
            mc(
              `(${a === 1 ? '' : `${a}*`}a-${b})^2`,
              'formula',
              'To je vzorec pro $(A - B)^2$, který má prostřední člen. Tady žádný není.',
              'That is the identity for $(A - B)^2$, which has a middle term. There is none here.',
            ),
          ],
          verify: [{ kind: 'equiv', expr: polyIn([a * a, 0, -b * b], { variable: 'a' }), vars: ['a'] }],
        };
      }
      if (lv === 2) {
        const a = r.pick([1, 2, 3]);
        const b = nz(r, -6, 6);
        const coeffs = [a * a, 2 * a * b, b * b];
        const ax = a === 1 ? 'x' : `${a}x`;
        return {
          prompt: L(
            `Rozložte na součin podle vzorce: $${polyTex(coeffs)}$`,
            `Factor by an identity: $${polyTex(coeffs)}$`,
          ),
          answer: {
            kind: 'expr',
            value: `(${a === 1 ? '' : `${a}*`}x${b < 0 ? '-' : '+'}${Math.abs(b)})^2`,
            vars: ['x'],
            form: 'factored',
          },
          hints: [
            L(
              'Krajní členy jsou čtverce. Zkus $(A \\pm B)^2$ a ověř prostřední člen.',
              'The outer terms are squares. Try $(A \\pm B)^2$ and check the middle term.',
            ),
            L(
              `$A = ${ax}$, $B = ${Math.abs(b)}$; prostřední člen má být $2AB = ${2 * a * Math.abs(b)}x$.`,
              `$A = ${ax}$, $B = ${Math.abs(b)}$; the middle term should be $2AB = ${2 * a * Math.abs(b)}x$.`,
            ),
          ],
          solution: [step('Druhá mocnina dvojčlenu:', 'The square of a binomial:', `(${ax} ${tailTex(b)})^2`)],
          misconceptions: [
            mc(
              `(${a === 1 ? '' : `${a}*`}x${b < 0 ? '+' : '-'}${Math.abs(b)})^2`,
              'sign',
              'Znaménko v závorce se řídí znaménkem prostředního členu.',
              'The sign in the bracket follows the sign of the middle term.',
            ),
          ],
          verify: [{ kind: 'equiv', expr: polyIn(coeffs), vars: ['x'] }],
        };
      }
      const a = r.int(2, 6);
      const b = r.pick([2, 3, 4, 5, 7].filter((v) => v !== a));
      const shown = `(x + ${a})^2 - ${2 * a}x - ${a * a + b * b}`;
      return {
        prompt: L(
          `Upravte a rozložte na součin užitím vzorce: $${shown}$`,
          `Simplify and factor using an identity: $${shown}$`,
        ),
        answer: { kind: 'expr', value: `(x-${b})*(x+${b})`, vars: ['x'], form: 'factored' },
        hints: [
          L(
            'Nejdřív umocni závorku a sluč, co se dá. Zbude rozdíl dvou čtverců.',
            'First expand the bracket and collect what you can. A difference of two squares is left.',
          ),
          L(`Po úpravě: $x^2 - ${b * b}$`, `After simplifying: $x^2 - ${b * b}$`),
        ],
        solution: [
          step(
            'Umocníme a sloučíme:',
            'Expand and collect:',
            `x^2 + ${2 * a}x + ${a * a} - ${2 * a}x - ${a * a + b * b} = x^2 - ${b * b}`,
          ),
          step('Rozdíl čtverců:', 'A difference of squares:', `(x - ${b})(x + ${b})`),
        ],
        misconceptions: [
          mc(
            `(x-${b})^2`,
            'formula',
            'Rozdíl čtverců se rozkládá na součin součtu a rozdílu, ne na druhou mocninu.',
            'A difference of squares factors into a sum times a difference, not into a square.',
          ),
        ],
        verify: [{ kind: 'equiv', expr: `(x+${a})^2-${2 * a}*x-${a * a + b * b}`, vars: ['x'] }],
      };
    },
  }),

  gen({
    id: 'expr.factoring.mental',
    concept: 'expr.factoring',
    kind: 'applied',
    levels: [2, 3],
    title: L('Počítání zpaměti pomocí vzorců', 'Mental arithmetic with identities'),
    est: (lv) => 45 + 20 * lv,
    make(r, lv) {
      const base = r.pick([20, 30, 40, 50, 60]);
      const d = r.int(1, 3);
      if (lv === 2) {
        const value = base * base - d * d;
        return {
          prompt: L(
            `Vypočtěte výhodně pomocí vzorce: $${base - d} \\cdot ${base + d}$`,
            `Calculate neatly with an identity: $${base - d} \\cdot ${base + d}$`,
          ),
          answer: { kind: 'number', value: ans(value) },
          hints: [
            L(`Obě čísla jsou stejně daleko od čísla ${base}.`, `Both numbers are equally far from ${base}.`),
            L(
              `$(${base} - ${d})(${base} + ${d}) = ${base}^2 - ${d}^2$`,
              `$(${base} - ${d})(${base} + ${d}) = ${base}^2 - ${d}^2$`,
            ),
          ],
          solution: [
            step(
              'Rozdíl čtverců:',
              'A difference of squares:',
              `${base}^2 - ${d}^2 = ${base * base} - ${d * d} = ${value}`,
            ),
          ],
          misconceptions: [
            mc(
              ans(base * base + d * d),
              'sign',
              'Je to rozdíl čtverců, ne součet.',
              'It is a difference of squares, not a sum.',
            ),
          ],
          verify: [{ kind: 'value', expr: `${base - d}*${base + d}` }],
        };
      }
      const up = r.bool();
      const n = up ? base + d : base - d;
      const value = n * n;
      return {
        prompt: L(`Vypočtěte výhodně pomocí vzorce: $${n}^2$`, `Calculate neatly with an identity: $${n}^2$`),
        answer: { kind: 'number', value: ans(value) },
        hints: [
          L(
            `Zapiš číslo jako $${base} ${up ? '+' : '-'} ${d}$ a použij vzorec pro druhou mocninu dvojčlenu.`,
            `Write the number as $${base} ${up ? '+' : '-'} ${d}$ and use the identity for the square of a binomial.`,
          ),
          L(
            `$${base}^2 ${up ? '+' : '-'} 2 \\cdot ${base} \\cdot ${d} + ${d}^2$`,
            `$${base}^2 ${up ? '+' : '-'} 2 \\cdot ${base} \\cdot ${d} + ${d}^2$`,
          ),
        ],
        solution: [
          step(
            'Podle vzorce:',
            'By the identity:',
            `${base * base} ${up ? '+' : '-'} ${2 * base * d} + ${d * d} = ${value}`,
          ),
        ],
        misconceptions: [
          mc(
            ans(base * base + (up ? 1 : -1) * d * d),
            'algebra',
            'Chybí prostřední člen $2AB$.',
            'The middle term $2AB$ is missing.',
          ),
        ],
        verify: [{ kind: 'value', expr: `${n}^2` }],
      };
    },
  }),

  // --------------------------------------------------------------------------- equations
  gen({
    id: 'eqn.linear.brackets',
    concept: 'eqn.linear',
    kind: 'core',
    levels: [1, 2, 3],
    title: L('Rovnice se závorkami', 'Equations with brackets'),
    est: (lv) => 50 + 35 * lv,
    make(r, lv) {
      if (lv === 1) {
        const a = r.pick([2, 3, 4, 5, 6]);
        const b = nz(r, -7, 7);
        const x0 = r.intExcept(-6, 8, [-b]);
        const c = a * (x0 + b);
        return {
          prompt: L(
            `Řešte rovnici: $${a}(${shiftTex(-b)}) = ${c}$`,
            `Solve the equation: $${a}(${shiftTex(-b)}) = ${c}$`,
          ),
          answer: { kind: 'set', values: [`${x0}`], label: 'x =' },
          hints: [
            L(
              `Obě strany vyděl číslem ${a}, nebo závorku roznásob.`,
              `Divide both sides by ${a}, or expand the bracket.`,
            ),
            L(`$${shiftTex(-b)} = ${c / a}$`, `$${shiftTex(-b)} = ${c / a}$`),
          ],
          solution: [
            step(`Vydělíme ${a}:`, `Divide by ${a}:`, `${shiftTex(-b)} = ${c / a}`),
            step('Osamostatníme $x$:', 'Isolate $x$:', `x = ${x0}`),
          ],
          misconceptions: [
            mc(
              `${c / a + b}`,
              'sign',
              'Při převodu na druhou stranu se znaménko mění.',
              'A term changes its sign when it moves to the other side.',
            ),
          ],
          verify: [{ kind: 'roots', expr: `${a}*(x+(${b}))-(${c})` }],
        };
      }
      if (lv === 2) {
        const p = search(
          r,
          (rng) => {
            const a = rng.pick([2, 3, 4, 5]);
            const d = rng.pick([2, 3, 4, 6].filter((v) => v !== a));
            const b = nz(rng, -5, 5);
            const e = nz(rng, -5, 5);
            const x0 = rng.int(-6, 7);
            const c = a * (x0 + b) - d * (x0 - e);
            return Math.abs(c) <= 30 && c !== 0 ? { a, b, c, d, e, x0 } : null;
          },
          'eqn.linear.brackets@2',
        );
        const { a, b, c, d, e, x0 } = p;
        const shown = `${a}(${shiftTex(-b)}) ${tailTex(-c)} = ${d}(${shiftTex(e)})`;
        return {
          prompt: L(`Řešte rovnici: $${shown}$`, `Solve the equation: $${shown}$`),
          answer: { kind: 'set', values: [`${x0}`], label: 'x =' },
          hints: [
            L(
              'Roznásob obě závorky, pak dej členy s $x$ na jednu stranu a čísla na druhou.',
              'Expand both brackets, then put the terms in $x$ on one side and the numbers on the other.',
            ),
            L(
              `Po roznásobení: $${polyTex([a, a * b - c])} = ${polyTex([d, -d * e])}$`,
              `After expanding: $${polyTex([a, a * b - c])} = ${polyTex([d, -d * e])}$`,
            ),
          ],
          solution: [
            step('Roznásobíme:', 'Expand:', `${polyTex([a, a * b - c])} = ${polyTex([d, -d * e])}`),
            step(
              'Členy s $x$ vlevo, čísla vpravo:',
              'Terms in $x$ to the left, numbers to the right:',
              `${nTex(a - d)}x = ${-d * e - (a * b - c)}`,
            ),
            step('Vydělíme:', 'Divide:', `x = ${x0}`),
          ],
          misconceptions: [],
          verify: [{ kind: 'roots', expr: `${a}*(x+(${b}))-(${c})-${d}*(x-(${e}))` }],
        };
      }
      // Decimal coefficients: p·x + q(x + s) = t(x + u), halves and tenths.
      const found = search(
        r,
        (rng) => {
          const p = rng.pick([0.5, 1.5, 0.2, 0.4]);
          const q = rng.pick([2, 3, 0.5]);
          const t = rng.pick([2.5, 1.5, 0.5, 3]);
          const s = rng.pick([1, 2, 2.5, 4]);
          const x0 = rng.int(-6, 8);
          if (Math.abs(p + q - t) < 1e-9) return null;
          // The same factor in front of both brackets leaves nothing to expand.
          if (q === t) return null;
          const u = ((p + q) * x0 + q * s) / t - x0;
          const u10 = Math.round(u * 10);
          return Math.abs(u * 10 - u10) < 1e-9 && u10 !== 0 && Math.abs(u) <= 9
            ? { p, q, t, s, u: u10 / 10, x0 }
            : null;
        },
        'eqn.linear.brackets@3',
      );
      const { p, q, t, s, u, x0 } = found;
      // What multiplies x once everything is collected; halves and tenths add up exactly.
      const coefficient = Math.round((p + q - t) * 10) / 10;
      const side = (n: (v: number) => string): string =>
        `${n(p)}x + ${n(q)} \\cdot (x + ${n(s)}) = ${n(t)} \\cdot (x ${u < 0 ? '-' : '+'} ${n(Math.abs(u))})`;
      return {
        prompt: both((n, czech) => `${czech ? 'Řešte rovnici' : 'Solve the equation'}: $${side(n)}$`),
        answer: { kind: 'set', values: [`${x0}`], label: 'x =' },
        hints: [
          L(
            'Roznásob obě závorky. Desetinných čísel se zbavíš vynásobením celé rovnice deseti.',
            'Expand both brackets. Multiplying the whole equation by ten gets rid of the decimals.',
          ),
          both((n) => `$${n(p + q)}x + ${n(q * s)} = ${n(t)}x ${t * u < 0 ? '-' : '+'} ${n(Math.abs(t * u))}$`),
        ],
        solution: [
          step(
            'Roznásobíme a sloučíme:',
            'Expand and collect:',
            both((n) => `${n(p + q)}x + ${n(q * s)} = ${n(t)}x ${t * u < 0 ? '-' : '+'} ${n(Math.abs(t * u))}`),
          ),
          step(
            'Členy s $x$ vlevo, čísla vpravo:',
            'Terms in $x$ to the left, numbers to the right:',
            both((n) => `${coefficient === 1 ? '' : coefficient === -1 ? '-' : n(coefficient)}x = ${n(t * u - q * s)}`),
          ),
          // With the coefficient one there is nothing left to divide by.
          ...(coefficient === 1 ? [] : [step('Vydělíme:', 'Divide:', `x = ${x0}`)]),
        ],
        misconceptions: [],
        verify: [{ kind: 'roots', expr: `${p}*x+${q}*(x+${s})-${t}*(x+(${u}))` }],
      };
    },
  }),

  gen({
    id: 'eqn.linear.fractions',
    concept: 'eqn.linear',
    kind: 'core',
    levels: [2, 3, 4],
    title: L('Rovnice se zlomky', 'Equations with fractions'),
    est: (lv) => 60 + 35 * lv,
    make(r, lv) {
      if (lv === 2) {
        const [a, b] = r.pick([
          [2, 3],
          [3, 4],
          [2, 5],
          [3, 6],
          [4, 6],
          [2, 4],
        ] as const);
        const m = lcm(a, b);
        const y0 = m * r.pick([1, 2, 3, -1, -2]);
        const c = y0 / a + y0 / b;
        return {
          prompt: L(
            `Řešte rovnici: $${fr('y', a)} + ${fr('y', b)} = ${c}$`,
            `Solve the equation: $${fr('y', a)} + ${fr('y', b)} = ${c}$`,
          ),
          answer: { kind: 'set', values: [`${y0}`], label: 'y =' },
          hints: [
            L(
              `Vynásob celou rovnici společným jmenovatelem ${m}.`,
              `Multiply the whole equation by the common denominator ${m}.`,
            ),
            L(`$${m / a}y + ${m / b}y = ${c * m}$`, `$${m / a}y + ${m / b}y = ${c * m}$`),
          ],
          solution: [
            step(`Násobíme ${m}:`, `Multiply by ${m}:`, `${m / a}y + ${m / b}y = ${c * m}`),
            step(
              'Sloučíme a vydělíme:',
              'Collect and divide:',
              `${m / a + m / b}y = ${c * m} \\quad\\Rightarrow\\quad y = ${y0}`,
            ),
          ],
          misconceptions: [
            mc(
              fToInput(frac(c, m / a + m / b)),
              'algebra',
              'Společným jmenovatelem se násobí i pravá strana.',
              'The right-hand side is multiplied by the common denominator too.',
            ),
          ],
          verify: [{ kind: 'roots', expr: `x/${a}+x/${b}-(${c})` }],
        };
      }
      if (lv === 3) {
        const found = search(
          r,
          (rng) => {
            const [a, b] = rng.pick([
              [2, 3],
              [3, 4],
              [2, 5],
              [4, 6],
              [3, 5],
              [2, 6],
            ] as const);
            const p = nz(rng, -5, 5);
            const q = nz(rng, -5, 5);
            const y0 = rng.int(-8, 10);
            if ((y0 + p) % a !== 0 || (y0 - q) % b !== 0) return null;
            const c = (y0 + p) / a - (y0 - q) / b;
            return { a, b, p, q, y0, c };
          },
          'eqn.linear.fractions@3',
        );
        const { a, b, p, q, y0, c } = found;
        const m = lcm(a, b);
        const shown = `\\frac{${shiftTex(-p, 'y')}}{${a}} - \\frac{${shiftTex(q, 'y')}}{${b}} = ${c}`;
        return {
          prompt: L(`Řešte rovnici: $${shown}$`, `Solve the equation: $${shown}$`),
          answer: { kind: 'set', values: [`${y0}`], label: 'y =' },
          hints: [
            L(
              `Vynásob celou rovnici číslem ${m}. Čitatele piš do závorek — před druhým zlomkem je minus.`,
              `Multiply the whole equation by ${m}. Keep the numerators in brackets — there is a minus in front of the second fraction.`,
            ),
            L(
              `$${m / a}(${shiftTex(-p, 'y')}) - ${m / b}(${shiftTex(q, 'y')}) = ${c * m}$`,
              `$${m / a}(${shiftTex(-p, 'y')}) - ${m / b}(${shiftTex(q, 'y')}) = ${c * m}$`,
            ),
          ],
          solution: [
            step(
              `Násobíme ${m}:`,
              `Multiply by ${m}:`,
              `${m / a}(${shiftTex(-p, 'y')}) - ${m / b}(${shiftTex(q, 'y')}) = ${c * m}`,
            ),
            step(
              'Roznásobíme a sloučíme:',
              'Expand and collect:',
              `${polyTex([m / a - m / b, (m / a) * p + (m / b) * q], { variable: 'y' })} = ${c * m}`,
            ),
            step('Řešení:', 'The solution:', `y = ${y0}`),
          ],
          misconceptions: [],
          verify: [{ kind: 'roots', expr: `(x+(${p}))/${a}-(x-(${q}))/${b}-(${c})` }],
        };
      }
      const found = search(
        r,
        (rng) => {
          const [a, b, c] = rng.pick([
            [6, 4, 2],
            [2, 3, 6],
            [3, 4, 2],
            [4, 6, 3],
            [6, 2, 3],
          ] as const);
          const k = rng.pick([2, 3, 5]);
          const p = nz(rng, -4, 4);
          const q = nz(rng, -4, 4);
          const y0 = rng.int(-9, 11);
          if ((k * y0 + p) % a !== 0 || y0 % b !== 0 || (y0 + q) % c !== 0) return null;
          const d = (k * y0 + p) / a + y0 / b - (y0 + q) / c;
          return Math.abs(d) <= 9 ? { a, b, c, k, p, q, y0, d } : null;
        },
        'eqn.linear.fractions@4',
      );
      const { a, b, c, k, p, q, y0, d } = found;
      const m = lcm(lcm(a, b), c);
      const shown = `\\frac{${polyTex([k, p], { variable: 'y' })}}{${a}} + \\frac{y}{${b}} = \\frac{${shiftTex(-q, 'y')}}{${c}} ${tailTex(d)}`;
      return {
        prompt: L(`Řešte rovnici: $${shown}$`, `Solve the equation: $${shown}$`),
        answer: { kind: 'set', values: [`${y0}`], label: 'y =' },
        hints: [
          L(
            `Společný jmenovatel je ${m}. Násob jím každý člen, i ten bez zlomku.`,
            `The common denominator is ${m}. Multiply every term by it, including the one without a fraction.`,
          ),
          L(
            `$${m / a}(${polyTex([k, p], { variable: 'y' })}) + ${m / b}y = ${m / c}(${shiftTex(-q, 'y')}) ${tailTex(d * m)}$`,
            `$${m / a}(${polyTex([k, p], { variable: 'y' })}) + ${m / b}y = ${m / c}(${shiftTex(-q, 'y')}) ${tailTex(d * m)}$`,
          ),
        ],
        solution: [
          step(
            `Násobíme ${m}:`,
            `Multiply by ${m}:`,
            `${m / a}(${polyTex([k, p], { variable: 'y' })}) + ${m / b}y = ${m / c}(${shiftTex(-q, 'y')}) ${tailTex(d * m)}`,
          ),
          step(
            'Roznásobíme a sloučíme:',
            'Expand and collect:',
            `${polyTex([(m / a) * k + m / b, (m / a) * p], { variable: 'y' })} = ${polyTex([m / c, (m / c) * q + d * m], { variable: 'y' })}`,
          ),
          step('Řešení:', 'The solution:', `y = ${y0}`),
        ],
        misconceptions: [],
        verify: [{ kind: 'roots', expr: `(${k}*x+(${p}))/${a}+x/${b}-(x+(${q}))/${c}-(${d})` }],
      };
    },
  }),

  gen({
    id: 'eqn.systems.solve',
    concept: 'eqn.systems',
    kind: 'core',
    levels: [2, 3, 4],
    title: L('Soustava dvou rovnic', 'A system of two equations'),
    est: (lv) => 70 + 35 * lv,
    make(r, lv) {
      const x0 = r.int(-5, 6);
      const y0 = r.intExcept(-6, 6, [0]);
      const answer = { kind: 'point' as const, coords: [`${x0}`, `${y0}`], label: '[x; y] =' };
      const line = (a: number, b: number): string =>
        `${a === 1 ? '' : a === -1 ? '-' : a}x ${b < 0 ? '-' : '+'} ${Math.abs(b) === 1 ? '' : Math.abs(b)}y`;
      if (lv === 2) {
        const a = r.pick([2, 3, 4, 5]);
        const b2 = r.pick([2, 3, 4]);
        const c1 = a * x0 - y0;
        const c2 = a * x0 + b2 * y0;
        return {
          prompt: L(
            `Řešte soustavu rovnic: $$\\begin{aligned} ${line(a, -1)} &= ${c1} \\\\ ${line(a, b2)} &= ${c2} \\end{aligned}$$`,
            `Solve the system of equations: $$\\begin{aligned} ${line(a, -1)} &= ${c1} \\\\ ${line(a, b2)} &= ${c2} \\end{aligned}$$`,
          ),
          answer,
          hints: [
            L(
              'Obě rovnice mají stejný člen s $x$. Odečti první rovnici od druhé.',
              'Both equations have the same term in $x$. Subtract the first from the second.',
            ),
            L(`$${b2 + 1}y = ${c2 - c1}$`, `$${b2 + 1}y = ${c2 - c1}$`),
          ],
          solution: [
            step(
              'Druhá minus první:',
              'The second minus the first:',
              `${b2 + 1}y = ${c2 - c1} \\quad\\Rightarrow\\quad y = ${y0}`,
            ),
            step(
              'Dosadíme do první:',
              'Substitute into the first:',
              `${a}x - ${par(y0)} = ${c1} \\quad\\Rightarrow\\quad x = ${x0}`,
            ),
          ],
          misconceptions: [
            mc(`[${y0}; ${x0}]`, 'misread', 'Pořadí: nejdřív $x$, potom $y$.', 'The order: $x$ first, then $y$.'),
          ],
          verify: [{ kind: 'solves', exprs: [`${a}*x-y-(${c1})`, `${a}*x+${b2}*y-(${c2})`] }],
        };
      }
      if (lv === 3) {
        const [a1, b1, a2, b2] = r.pick([
          [2, 3, 3, -2],
          [3, 2, 2, -3],
          [2, 5, 3, 4],
          [4, 3, 3, -2],
          [5, 2, 2, 3],
          [3, -4, 2, 5],
        ] as const);
        const c1 = a1 * x0 + b1 * y0;
        const c2 = a2 * x0 + b2 * y0;
        return {
          prompt: L(
            `Řešte soustavu rovnic: $$\\begin{aligned} ${line(a1, b1)} &= ${c1} \\\\ ${line(a2, b2)} &= ${c2} \\end{aligned}$$`,
            `Solve the system of equations: $$\\begin{aligned} ${line(a1, b1)} &= ${c1} \\\\ ${line(a2, b2)} &= ${c2} \\end{aligned}$$`,
          ),
          answer,
          hints: [
            L(
              `Vynásob první rovnici číslem ${a2} a druhou číslem ${a1}: členy s $x$ pak budou stejné.`,
              `Multiply the first equation by ${a2} and the second by ${a1}: the terms in $x$ will then match.`,
            ),
            L(
              `Po odečtení: $${a2 * b1 - a1 * b2}y = ${a2 * c1 - a1 * c2}$`,
              `After subtracting: $${a2 * b1 - a1 * b2}y = ${a2 * c1 - a1 * c2}$`,
            ),
          ],
          solution: [
            step(
              'Vyrovnáme koeficienty u $x$ a odečteme:',
              'Match the coefficients of $x$ and subtract:',
              `${a2 * b1 - a1 * b2}y = ${a2 * c1 - a1 * c2} \\quad\\Rightarrow\\quad y = ${y0}`,
            ),
            step(
              'Dosadíme zpět:',
              'Substitute back:',
              `${a1}x ${tailTex(b1 * y0)} = ${c1} \\quad\\Rightarrow\\quad x = ${x0}`,
            ),
          ],
          misconceptions: [
            mc(`[${y0}; ${x0}]`, 'misread', 'Pořadí: nejdřív $x$, potom $y$.', 'The order: $x$ first, then $y$.'),
          ],
          verify: [{ kind: 'solves', exprs: [`${a1}*x+(${b1})*y-(${c1})`, `${a2}*x+(${b2})*y-(${c2})`] }],
        };
      }
      // One equation has to be tidied first.
      const k = r.pick([2, 3]);
      const m = nz(r, -4, 4);
      const c1 = k * (x0 - m) - y0; // k(x − m) = y + c1
      const a2 = r.pick([1, 2]);
      const b2 = r.pick([3, 5]);
      const c2 = a2 * x0 + b2 * y0;
      return {
        prompt: L(
          `Řešte soustavu rovnic: $$\\begin{aligned} ${k}(${shiftTex(m)}) &= y ${tailTex(c1)} \\\\ ${line(a2, b2)} &= ${c2} \\end{aligned}$$`,
          `Solve the system of equations: $$\\begin{aligned} ${k}(${shiftTex(m)}) &= y ${tailTex(c1)} \\\\ ${line(a2, b2)} &= ${c2} \\end{aligned}$$`,
        ),
        answer,
        hints: [
          L(
            'Z první rovnice vyjádři $y$ a dosaď ho do druhé.',
            'Express $y$ from the first equation and substitute it into the second.',
          ),
          L(`$y = ${polyTex([k, -k * m - c1])}$`, `$y = ${polyTex([k, -k * m - c1])}$`),
        ],
        solution: [
          step('Z první rovnice:', 'From the first equation:', `y = ${polyTex([k, -k * m - c1])}`),
          step(
            'Dosadíme do druhé:',
            'Substitute into the second:',
            `${a2 === 1 ? '' : a2}x + ${b2}(${polyTex([k, -k * m - c1])}) = ${c2} \\quad\\Rightarrow\\quad x = ${x0}`,
          ),
          step('A zpět:', 'And back:', `y = ${y0}`),
        ],
        misconceptions: [
          mc(`[${y0}; ${x0}]`, 'misread', 'Pořadí: nejdřív $x$, potom $y$.', 'The order: $x$ first, then $y$.'),
        ],
        verify: [{ kind: 'solves', exprs: [`${k}*(x-(${m}))-y-(${c1})`, `${a2}*x+${b2}*y-(${c2})`] }],
      };
    },
  }),

  gen({
    id: 'eqn.systems.word',
    concept: 'eqn.systems',
    kind: 'applied',
    levels: [3, 4],
    title: L('Slovní úloha na soustavu rovnic', 'A word problem for a system'),
    est: (lv) => 90 + 40 * lv,
    make(r, lv) {
      const child = r.pick([40, 50, 60, 80]);
      const adult = child + r.pick([40, 60, 70, 100]);
      const [n1, m1, n2, m2] = r.pick([
        [2, 3, 3, 1],
        [1, 4, 2, 3],
        [3, 2, 2, 5],
        [2, 1, 3, 4],
      ] as const);
      const t1 = n1 * adult + m1 * child;
      const t2 = n2 * adult + m2 * child;
      const askAdult = lv === 4;
      const value = askAdult ? adult - child : child;
      return {
        prompt: L(
          `Rodina Novákových koupila ${n1} ${plural(n1, 'vstupenku', 'vstupenky', 'vstupenek')} pro dospělé a ${m1} ${plural(m1, 'dětskou', 'dětské', 'dětských')} za ${csT(t1)} korun. Rodina Dvořákových koupila ${n2} ${plural(n2, 'vstupenku', 'vstupenky', 'vstupenek')} pro dospělé a ${m2} ${plural(m2, 'dětskou', 'dětské', 'dětských')} za ${csT(t2)} korun. ${askAdult ? 'O kolik korun je vstupenka pro dospělé dražší než dětská?' : 'Kolik korun stojí dětská vstupenka?'}`,
          `The Nováks bought ${n1} adult ${plEn(n1, 'ticket')} and ${m1} child ${plEn(m1, 'ticket')} for ${enT(t1)} crowns. The Dvořáks bought ${n2} adult ${plEn(n2, 'ticket')} and ${m2} child ${plEn(m2, 'ticket')} for ${enT(t2)} crowns. ${askAdult ? 'By how many crowns is an adult ticket dearer than a child one?' : 'How many crowns is a child ticket?'}`,
        ),
        answer: { kind: 'number', value: ans(value) },
        hints: [
          L(
            'Označ cenu vstupenky pro dospělé $d$ a dětské $k$. Každá rodina dá jednu rovnici.',
            'Call the adult price $d$ and the child price $k$. Each family gives one equation.',
          ),
          L(
            `$${n1}d + ${m1}k = ${t1}$, $${n2}d + ${m2}k = ${t2}$`,
            `$${n1}d + ${m1}k = ${t1}$, $${n2}d + ${m2}k = ${t2}$`,
          ),
        ],
        solution: [
          step('Soustava:', 'The system:', `${n1}d + ${m1}k = ${t1}, \\quad ${n2}d + ${m2}k = ${t2}`),
          step('Řešení:', 'Its solution:', `d = ${adult}, \\quad k = ${child}`),
          ...(askAdult
            ? [step('Rozdíl cen:', 'The difference of the prices:', `${adult} - ${child} = ${adult - child}`)]
            : []),
        ],
        misconceptions: [
          mc(
            ans(adult),
            'misread',
            askAdult
              ? 'To je cena vstupenky pro dospělé. Otázka se ptá na rozdíl.'
              : 'To je cena vstupenky pro dospělé.',
            askAdult ? 'That is the adult price. The question asks for the difference.' : 'That is the adult price.',
          ),
        ],
        // Cramer's rule on the two purchases, independent of how the prices were chosen.
        verify: [
          {
            kind: 'value',
            expr: askAdult
              ? `(${t1}*${m2}-${t2}*${m1})/(${n1}*${m2}-${n2}*${m1})-(${n1}*${t2}-${n2}*${t1})/(${n1}*${m2}-${n2}*${m1})`
              : `(${n1}*${t2}-${n2}*${t1})/(${n1}*${m2}-${n2}*${m1})`,
          },
        ],
        context: { applied: true },
      };
    },
  }),

  // ------------------------------------------------------------------------ word problems
  gen({
    id: 'word.arith.two-step',
    concept: 'word.arith',
    kind: 'core',
    levels: [1, 2, 3],
    title: L('Slovní úlohy na dva kroky', 'Two-step word problems'),
    est: (lv) => 50 + 30 * lv,
    make(r, lv) {
      if (lv === 1) {
        const boxes = r.int(3, 6);
        const each = r.int(12, 28);
        const extra = r.int(5, 19);
        const value = boxes * each + extra;
        return {
          prompt: L(
            `${boxes <= 4 ? 'Ve' : 'V'} ${boxes} bednách je po ${each} kg jablek a v košíku ještě ${extra} kg. Kolik kilogramů jablek je to dohromady?`,
            `There are ${each} kg of apples in each of ${boxes} crates and another ${extra} kg in a basket. How many kilograms of apples is that altogether?`,
          ),
          answer: { kind: 'number', value: ans(value) },
          hints: [
            L('Nejdřív jablka v bednách, potom přičti košík.', 'First the apples in the crates, then add the basket.'),
            L(
              `V bednách je $${boxes} \\cdot ${each} = ${boxes * each}$ kg.`,
              `The crates hold $${boxes} \\cdot ${each} = ${boxes * each}$ kg.`,
            ),
          ],
          solution: [step('Bedny a košík:', 'Crates and basket:', `${boxes} \\cdot ${each} + ${extra} = ${value}`)],
          misconceptions: [
            mc(
              ans(boxes * (each + extra)),
              'misread',
              'Košík je jen jeden — přičítá se jednou.',
              'There is only one basket — it is added once.',
            ),
          ],
          verify: [{ kind: 'value', expr: `${boxes}*${each}+${extra}` }],
          context: { applied: true },
        };
      }
      if (lv === 2) {
        const ticket = r.pick([120, 140, 150, 160]);
        const snack = r.pick([45, 55, 60, 65]);
        const friends = r.int(3, 8);
        const total = (ticket + snack) * friends;
        return {
          prompt: L(
            `Lístek do kina stojí ${ticket} korun a popcorn ${snack} korun. Kamarádi koupili každému jeden lístek a jeden popcorn a zaplatili dohromady ${csT(total)} korun. Kolik kamarádů šlo do kina?`,
            `A cinema ticket costs ${ticket} crowns and a popcorn ${snack} crowns. A group of friends bought one ticket and one popcorn each and paid ${enT(total)} crowns in all. How many friends went to the cinema?`,
          ),
          answer: { kind: 'number', value: ans(friends) },
          hints: [
            L('Kolik zaplatil jeden kamarád?', 'How much did one friend pay?'),
            L(`Jeden zaplatil ${ticket + snack} korun.`, `One paid ${ticket + snack} crowns.`),
          ],
          solution: [
            step('Jeden kamarád:', 'One friend:', `${ticket} + ${snack} = ${ticket + snack}`),
            step(
              'Počet kamarádů:',
              'The number of friends:',
              L(`${total} : ${ticket + snack} = ${friends}`, `${total} \\div ${ticket + snack} = ${friends}`),
            ),
          ],
          misconceptions: [],
          verify: [{ kind: 'value', expr: `${total}/(${ticket}+${snack})` }],
          context: { applied: true },
        };
      }
      if (r.bool()) {
        const heads = r.int(9, 20);
        const rabbits = r.int(2, heads - 3);
        const legs = 2 * (heads - rabbits) + 4 * rabbits;
        return {
          prompt: L(
            `Na dvoře jsou slepice a králíci. Dohromady mají ${heads} hlav a ${legs} nohou. Kolik je na dvoře králíků?`,
            `There are hens and rabbits in a yard. Together they have ${heads} heads and ${legs} legs. How many rabbits are there?`,
          ),
          answer: { kind: 'number', value: ans(rabbits) },
          hints: [
            L(
              `Kdyby to byly samé slepice, měly by $2 \\cdot ${heads} = ${2 * heads}$ nohou.`,
              `If they were all hens, they would have $2 \\cdot ${heads} = ${2 * heads}$ legs.`,
            ),
            L(
              `Nohou je o ${legs - 2 * heads} víc. Každý králík přidá dvě nohy navíc.`,
              `There are ${legs - 2 * heads} more legs. Each rabbit adds two extra.`,
            ),
          ],
          solution: [
            step('Samé slepice by měly:', 'All hens would have:', `2 \\cdot ${heads} = ${2 * heads}`),
            step(
              'Nohy navíc připadají na králíky, po dvou:',
              'The extra legs belong to the rabbits, two each:',
              L(`(${legs} - ${2 * heads}) : 2 = ${rabbits}`, `(${legs} - ${2 * heads}) \\div 2 = ${rabbits}`),
            ),
          ],
          misconceptions: [mc(ans(heads - rabbits), 'misread', 'To je počet slepic.', 'That is the number of hens.')],
          verify: [{ kind: 'value', expr: `(${legs}-2*${heads})/2` }],
          context: { applied: true },
        };
      }
      const seats = r.pick([42, 45, 48, 52]);
      const pupils = r.int(110, 190);
      const adults = r.int(8, 15);
      const buses = Math.ceil((pupils + adults) / seats);
      return {
        prompt: L(
          `Na výlet jede ${pupils} žáků a ${adults} dospělých. Do jednoho autobusu se vejde ${seats} cestujících. Kolik autobusů je nejméně potřeba?`,
          `${pupils} pupils and ${adults} adults are going on a trip. One coach takes ${seats} passengers. What is the smallest number of coaches needed?`,
        ),
        answer: { kind: 'number', value: ans(buses) },
        hints: [
          L(
            'Kolik lidí jede celkem? A co s těmi, kteří se do plných autobusů nevejdou?',
            'How many people are going in all? And what about those who do not fit into the full coaches?',
          ),
          L(
            `Jede ${pupils + adults} lidí; $${pupils + adults} : ${seats}$ vychází se zbytkem.`,
            `${pupils + adults} people are going; $${pupils + adults} \\div ${seats}$ leaves a remainder.`,
          ),
        ],
        solution: [
          step('Všech cestujících:', 'All the passengers:', `${pupils} + ${adults} = ${pupils + adults}`),
          step(
            `${buses - 1} ${plural(buses - 1, 'autobus', 'autobusy', 'autobusů')} nestačí (${(buses - 1) * seats} míst), proto je potřeba ${buses}.`,
            `${buses - 1} coach${buses - 1 === 1 ? '' : 'es'} would not do (${(buses - 1) * seats} seats), so ${buses} are needed.`,
          ),
        ],
        misconceptions:
          (pupils + adults) % seats === 0
            ? []
            : [
                mc(
                  ans(buses - 1),
                  'misread',
                  'Ti, kteří zbyli, potřebují ještě jeden autobus.',
                  'Those left over need one more coach.',
                ),
              ],
        context: { applied: true },
      };
    },
  }),

  gen({
    id: 'word.arith.backwards',
    concept: 'word.arith',
    kind: 'reverse',
    levels: [1, 2, 3],
    title: L('Myslím si číslo', 'I am thinking of a number'),
    est: (lv) => 45 + 30 * lv,
    make(r, lv) {
      if (lv === 1) {
        const k = r.int(2, 6);
        const b = r.int(3, 15);
        const x = r.int(4, 14);
        const end = x * k + b;
        return {
          prompt: L(
            `Myslím si číslo. Když ho vynásobím ${k} a přičtu ${b}, dostanu ${end}. Které číslo si myslím?`,
            `I am thinking of a number. If I multiply it by ${k} and add ${b}, I get ${end}. Which number is it?`,
          ),
          answer: { kind: 'number', value: ans(x) },
          hints: [
            L(
              'Postupuj od konce a každou operaci zruš opačnou.',
              'Work backwards and undo each operation with its opposite.',
            ),
            L(`Před přičtením bylo ${end - b}.`, `Before the addition there was ${end - b}.`),
          ],
          solution: [
            step('Od konce:', 'From the end:', L(`(${end} - ${b}) : ${k} = ${x}`, `(${end} - ${b}) \\div ${k} = ${x}`)),
          ],
          misconceptions:
            end % k === 0
              ? [
                  mc(
                    ans(end / k - b),
                    'algebra',
                    'Operace se ruší v opačném pořadí: nejdřív odečíst, potom dělit.',
                    'Operations are undone in the reverse order: subtract first, then divide.',
                  ),
                ]
              : [],
          verify: [{ kind: 'value', expr: `(${end}-${b})/${k}` }],
        };
      }
      if (lv === 2) {
        const d = r.int(3, 9);
        const q = r.int(4, 12);
        const b = r.int(2, 9);
        const x = d * q;
        const end = (q + b) * 2;
        return {
          prompt: L(
            `Když neznámé číslo vydělím ${d}, k výsledku přičtu ${b} a součet zdvojnásobím, dostanu ${end}. Určete neznámé číslo.`,
            `If I divide an unknown number by ${d}, add ${b} to the result and double the sum, I get ${end}. Find the unknown number.`,
          ),
          answer: { kind: 'number', value: ans(x) },
          hints: [
            L('Od konce: polovina, odečíst, vynásobit.', 'From the end: halve, subtract, multiply.'),
            L(
              `Před zdvojnásobením bylo ${end / 2}, před přičtením ${q}.`,
              `Before doubling there was ${end / 2}, before the addition ${q}.`,
            ),
          ],
          solution: [
            step(
              'Od konce:',
              'From the end:',
              L(`(${end} : 2 - ${b}) \\cdot ${d} = ${x}`, `(${end} \\div 2 - ${b}) \\cdot ${d} = ${x}`),
            ),
          ],
          misconceptions: [],
          verify: [{ kind: 'value', expr: `(${end}/2-${b})*${d}` }],
        };
      }
      const x = r.pick([24, 36, 48, 60, 72]);
      const half = x / 2;
      const spent = r.int(5, half - 5);
      const end = (half - spent) * 3;
      const name = r.pick(['Pavel', 'Ivana', 'Šimon', 'Tereza']);
      const f = name.endsWith('a');
      return {
        prompt: L(
          `${name} měl${f ? 'a' : ''} v kapse několik korun. Polovinu dal${f ? 'a' : ''} sestře, pak utratil${f ? 'a' : ''} ${spent} korun a zbytek ${f ? 'jí' : 'mu'} babička ztrojnásobila. Teď má ${end} korun. Kolik korun měl${f ? 'a' : ''} na začátku?`,
          `${name} had some crowns in a pocket, gave half to a sister, then spent ${spent} crowns, and a grandmother tripled what was left. Now there are ${end} crowns. How many crowns were there at the start?`,
        ),
        answer: { kind: 'number', value: ans(x) },
        hints: [
          L(
            'Vrať se krok za krokem: před ztrojnásobením, před útratou, před rozdělením.',
            'Go back step by step: before the tripling, before the spending, before the sharing.',
          ),
          L(
            `Před ztrojnásobením: ${end / 3}. Před útratou: ${end / 3 + spent}.`,
            `Before the tripling: ${end / 3}. Before the spending: ${end / 3 + spent}.`,
          ),
        ],
        solution: [
          step(
            'Před ztrojnásobením a před útratou:',
            'Before the tripling and before the spending:',
            L(
              `${end} : 3 = ${end / 3}, \\quad ${end / 3} + ${spent} = ${half}`,
              `${end} \\div 3 = ${end / 3}, \\quad ${end / 3} + ${spent} = ${half}`,
            ),
          ),
          step('To byla polovina:', 'That was a half:', `2 \\cdot ${half} = ${x}`),
        ],
        misconceptions: [
          mc(
            ans(half),
            'incomplete',
            'To je částka po rozdělení se sestrou. Na začátku bylo dvakrát tolik.',
            'That is the amount after sharing with the sister. There was twice as much at the start.',
          ),
        ],
        verify: [{ kind: 'value', expr: `(${end}/3+${spent})*2` }],
        context: { applied: true },
      };
    },
  }),

  gen({
    id: 'word.arith.choice',
    concept: 'word.arith',
    kind: 'applied',
    levels: [2, 3],
    title: L('Slovní úloha – výběr odpovědi', 'A word problem – choose the answer'),
    tags: ['mc5'],
    est: (lv) => 70 + 30 * lv,
    make(r, lv) {
      if (lv === 2) {
        const less = r.int(12, 40);
        const d = r.pick([6, 8, 10, 14]);
        const sum = 2 * less + d;
        const [[a, aFemale], [b]] = r.sample(
          [
            ['Lucie', true],
            ['Tomáš', false],
            ['Aneta', true],
            ['Marek', false],
          ] as const,
          2,
        ) as [readonly [string, boolean], readonly [string, boolean]];
        const built = numericChoice(r, less, [less + d, sum / 2, sum - d, (sum + d) / 2], (v) =>
          L(`${v} kartiček`, `${v} cards`),
        );
        return {
          prompt: L(
            `${a} a ${b} mají dohromady ${sum} kartiček. ${a} jich má o ${d} více. Kolik kartiček má ${b}?`,
            `${a} and ${b} have ${sum} cards together. ${a} has ${d} more. How many cards does ${b} have?`,
          ),
          answer: built.spec,
          hints: [
            L(
              `Kdyby ${a} odložil${aFemale ? 'a' : ''} těch ${d} kartiček navíc, měli by oba stejně.`,
              `If ${a} put the ${d} extra cards aside, both would have the same.`,
            ),
            L(`Pak by měli dohromady ${sum - d}.`, `Then they would have ${sum - d} together.`),
          ],
          solution: [
            step('Bez kartiček navíc:', 'Without the extra cards:', `${sum} - ${d} = ${sum - d}`),
            step('Polovina:', 'A half:', L(`${sum - d} : 2 = ${less}`, `${sum - d} \\div 2 = ${less}`)),
          ],
          misconceptions: [built.idOf(less + d), built.idOf(sum / 2)].flatMap((id, index) =>
            id
              ? [
                  index === 0
                    ? mc(id, 'misread', `Tolik má ${a}.`, `That is what ${a} has.`)
                    : mc(
                        id,
                        'concept',
                        'Polovina by to byla, kdyby měli oba stejně.',
                        'It would be a half if both had the same.',
                      ),
                ]
              : [],
          ),
          context: { applied: true },
        };
      }
      const price = r.pick([15, 18, 24, 25]);
      const n = r.int(4, 8);
      const paid = r.pick([200, 500]);
      const change = paid - price * n;
      const built = numericChoice(r, n, [n + 1, n - 1, Math.round(paid / price), n + 2], (v) =>
        L(`${v} ${plural(v, 'sešit', 'sešity', 'sešitů')}`, `${v} exercise books`),
      );
      return {
        prompt: L(
          `Sešit stojí ${price} korun. Karel platil bankovkou ${paid} korun a vrátili mu ${change} korun. Kolik sešitů koupil?`,
          `An exercise book costs ${price} crowns. Karel paid with a ${paid}-crown note and got ${change} crowns back. How many exercise books did he buy?`,
        ),
        answer: built.spec,
        hints: [
          L('Kolik korun Karel za sešity opravdu zaplatil?', 'How many crowns did Karel actually pay for the books?'),
          L(
            `Zaplatil $${paid} - ${change} = ${paid - change}$ korun.`,
            `He paid $${paid} - ${change} = ${paid - change}$ crowns.`,
          ),
        ],
        solution: [
          step('Zaplaceno:', 'Paid:', `${paid} - ${change} = ${paid - change}`),
          step(
            'Počet sešitů:',
            'The number of books:',
            L(`${paid - change} : ${price} = ${n}`, `${paid - change} \\div ${price} = ${n}`),
          ),
        ],
        misconceptions: [built.idOf(Math.round(paid / price))].flatMap((id) =>
          id
            ? [
                mc(
                  id,
                  'misread',
                  'Tolik sešitů by bylo za celou bankovku. Část peněz se ale vrátila.',
                  'That many books would cost the whole note. But some money came back.',
                ),
              ]
            : [],
        ),
        context: { applied: true },
      };
    },
  }),

  gen({
    id: 'word.arith.matching',
    concept: 'word.arith',
    kind: 'applied',
    levels: [2],
    title: L('Slovní úloha – přiřazení výsledku', 'A word problem – match the result'),
    tags: ['match6'],
    est: () => 80,
    make(r) {
      const values = [6, 8, 9, 12, 15, 18];
      const value = r.pick(values);
      const ids = ['a', 'b', 'c', 'd', 'e', 'f'];
      const options = (unit: L): { id: string; text: L }[] =>
        values.map((v, i) => ({ id: ids[i]!, text: L(`${v} ${unit.cs}`, `${v} ${unit.en}`) }));
      const correct = [ids[values.indexOf(value)]!];
      const variant = r.int(0, 2);
      if (variant === 0) {
        const interval = r.pick([10, 15, 20]);
        const minutes = value * interval;
        return {
          prompt: L(
            `Tramvaj odjíždí ze zastávky každých ${interval} minut. Kolik tramvají odjede za ${minutes} minut, když první odjela přesně na začátku a poslední se už nepočítá?`,
            `A tram leaves a stop every ${interval} minutes. How many trams leave in ${minutes} minutes if the first left exactly at the start and the one at the very end is not counted?`,
          ),
          answer: { kind: 'choice', options: options(L('tramvají', 'trams')), correct, fixedOrder: true },
          hints: [
            L('Kolik intervalů se vejde do celé doby?', 'How many intervals fit into the whole time?'),
            L(`$${minutes} : ${interval}$`, `$${minutes} \\div ${interval}$`),
          ],
          solution: [
            step(
              'Počet intervalů:',
              'The number of intervals:',
              L(`${minutes} : ${interval} = ${value}`, `${minutes} \\div ${interval} = ${value}`),
            ),
          ],
          context: { applied: true },
        };
      }
      if (variant === 1) {
        const per = r.pick([4, 5, 6]);
        const total = value * per;
        return {
          prompt: L(
            `Do krabice se ${plural(per, 'vejde', 'vejdou', 'vejde')} ${per} ${plural(per, 'hrnek', 'hrnky', 'hrnků')}. Kolik krabic je potřeba na ${total} hrnků?`,
            `A box takes ${per} mugs. How many boxes are needed for ${total} mugs?`,
          ),
          answer: { kind: 'choice', options: options(L('krabic', 'boxes')), correct, fixedOrder: true },
          hints: [
            L('Rozděl hrnky do krabic po stejném počtu.', 'Share the mugs out into boxes of the same number.'),
            L(`$${total} : ${per}$`, `$${total} \\div ${per}$`),
          ],
          solution: [
            step(
              'Počet krabic:',
              'The number of boxes:',
              L(`${total} : ${per} = ${value}`, `${total} \\div ${per} = ${value}`),
            ),
          ],
          context: { applied: true },
        };
      }
      const gave = r.int(3, 9);
      const twice = (value + gave) * 2;
      return {
        prompt: L(
          `Míša měla ${twice} bonbonů. Polovinu dala bratrovi a pak ještě ${gave} snědla. Kolik bonbonů jí zbylo?`,
          `Míša had ${twice} sweets. She gave half to her brother and then ate ${gave}. How many sweets did she have left?`,
        ),
        answer: { kind: 'choice', options: options(L('bonbonů', 'sweets')), correct, fixedOrder: true },
        hints: [
          L('Nejdřív polovina, potom odečti snědené.', 'First the half, then subtract the ones eaten.'),
          L(`Po rozdělení: ${twice / 2}.`, `After sharing: ${twice / 2}.`),
        ],
        solution: [
          step(
            'Polovina a snědené:',
            'The half and the eaten ones:',
            L(`${twice} : 2 - ${gave} = ${value}`, `${twice} \\div 2 - ${gave} = ${value}`),
          ),
        ],
        context: { applied: true },
      };
    },
  }),

  gen({
    id: 'word.equations.parts',
    concept: 'word.equations',
    kind: 'core',
    levels: [2, 3, 4],
    title: L('Neznámá a její násobky', 'An unknown and its multiples'),
    est: (lv) => 70 + 35 * lv,
    make(r, lv) {
      if (lv === 2) {
        const x = r.int(15, 60);
        const d = r.int(6, 25);
        const total = 2 * x + d;
        return {
          prompt: L(
            `Dvě třídy nasbíraly dohromady ${total} kg papíru. Třída 9. A nasbírala o ${d} kg více než 9. B. Kolik kilogramů nasbírala 9. B?`,
            `Two classes collected ${total} kg of paper together. Class 9A collected ${d} kg more than 9B. How many kilograms did 9B collect?`,
          ),
          answer: { kind: 'number', value: ans(x) },
          hints: [
            L(
              `Označ množství 9. B jako $x$. Pak 9. A nasbírala $x + ${d}$.`,
              `Call 9B's amount $x$. Then 9A collected $x + ${d}$.`,
            ),
            L(`$x + (x + ${d}) = ${total}$`, `$x + (x + ${d}) = ${total}$`),
          ],
          solution: [
            step('Rovnice:', 'The equation:', `x + (x + ${d}) = ${total}`),
            step('Řešení:', 'Its solution:', `2x = ${total - d} \\quad\\Rightarrow\\quad x = ${x}`),
          ],
          misconceptions: [
            mc(ans(x + d), 'misread', 'To je množství 9. A.', "That is 9A's amount."),
            mc(
              fToInput(frac(total, 2)),
              'concept',
              'Polovina by to byla, kdyby obě třídy nasbíraly stejně.',
              'It would be a half if both classes had collected the same.',
            ),
          ],
          verify: [{ kind: 'value', expr: `(${total}-${d})/2` }],
          context: { applied: true },
        };
      }
      if (lv === 3) {
        const x = r.int(8, 30);
        const a = r.int(4, 15);
        const k = r.pick([2, 3]);
        const total = x + (x + a) + k * x;
        return {
          prompt: L(
            `Tři brigádníci natřeli dohromady ${total} m plotu. Druhý natřel o ${a} m více než první a třetí ${k === 2 ? 'dvakrát' : 'třikrát'} tolik co první. Kolik metrů natřel první brigádník?`,
            `Three helpers painted ${total} m of fence together. The second painted ${a} m more than the first and the third ${k === 2 ? 'twice' : 'three times'} as much as the first. How many metres did the first one paint?`,
          ),
          answer: { kind: 'number', value: ans(x) },
          hints: [
            L(
              `První $x$, druhý $x + ${a}$, třetí $${k}x$.`,
              `The first $x$, the second $x + ${a}$, the third $${k}x$.`,
            ),
            L(`$x + x + ${a} + ${k}x = ${total}$`, `$x + x + ${a} + ${k}x = ${total}$`),
          ],
          solution: [
            step('Rovnice:', 'The equation:', `x + (x + ${a}) + ${k}x = ${total}`),
            step('Řešení:', 'Its solution:', `${k + 2}x = ${total - a} \\quad\\Rightarrow\\quad x = ${x}`),
          ],
          misconceptions: [mc(ans(k * x), 'misread', 'To je třetí brigádník.', 'That is the third helper.')],
          verify: [{ kind: 'value', expr: `(${total}-${a})/(${k}+2)` }],
          context: { applied: true },
        };
      }
      const x = 2 * r.int(8, 30);
      const k = 2 * r.int(2, 9);
      const total = x + 1.5 * x + (1.5 * x - k);
      return {
        prompt: L(
          `Sběratel získal za tři roky ${total} známek. Druhý rok jich získal o polovinu více než první rok a třetí rok o ${k} méně než druhý rok. Kolik známek získal první rok?`,
          `A collector gained ${total} stamps in three years. In the second year he gained half as many again as in the first, and in the third year ${k} fewer than in the second. How many stamps did he gain in the first year?`,
        ),
        answer: { kind: 'number', value: ans(x) },
        hints: [
          L(
            '„O polovinu více“ než $x$ je $x + \\frac{x}{2} = \\frac{3}{2}x$.',
            '"Half as many again" as $x$ is $x + \\frac{x}{2} = \\frac{3}{2}x$.',
          ),
          L(
            `$x + \\frac{3}{2}x + \\frac{3}{2}x - ${k} = ${total}$`,
            `$x + \\frac{3}{2}x + \\frac{3}{2}x - ${k} = ${total}$`,
          ),
        ],
        solution: [
          step('Rovnice:', 'The equation:', `x + \\frac{3}{2}x + \\left(\\frac{3}{2}x - ${k}\\right) = ${total}`),
          step('Řešení:', 'Its solution:', `4x = ${total + k} \\quad\\Rightarrow\\quad x = ${x}`),
        ],
        misconceptions: [
          mc(
            fToInput(frac(total + k, 3)),
            'concept',
            '„O polovinu více“ není totéž co „stejně“: druhý rok je $\\frac{3}{2}x$.',
            '"Half as many again" is not "the same": the second year is $\\frac{3}{2}x$.',
          ),
        ],
        verify: [{ kind: 'value', expr: `(${total}+${k})/4` }],
        context: { applied: true },
      };
    },
  }),

  gen({
    id: 'word.equations.prices',
    concept: 'word.equations',
    kind: 'applied',
    levels: [2, 3],
    title: L('Ceny a počty', 'Prices and counts'),
    est: (lv) => 75 + 35 * lv,
    make(r, lv) {
      const tea = r.pick([25, 30, 35, 40]);
      const d = r.pick([10, 15, 20, 25]);
      const n1 = r.int(2, 5);
      const n2 = r.int(2, 5);
      if (lv === 2) {
        const total = n1 * tea + n2 * (tea + d);
        return {
          prompt: L(
            `U stánku stojí limonáda o ${d} korun více než čaj. Za ${n1} ${plural(n1, 'čaj', 'čaje', 'čajů')} a ${n2} ${plural(n2, 'limonádu', 'limonády', 'limonád')} jsme zaplatili ${total} korun. Kolik korun stojí čaj?`,
            `At a stall a lemonade costs ${d} crowns more than a tea. We paid ${total} crowns for ${n1} tea${n1 === 1 ? '' : 's'} and ${n2} lemonade${n2 === 1 ? '' : 's'}. How many crowns is a tea?`,
          ),
          answer: { kind: 'number', value: ans(tea) },
          hints: [
            L(`Cena čaje $x$, limonády $x + ${d}$.`, `A tea is $x$, a lemonade $x + ${d}$.`),
            L(`$${n1}x + ${n2}(x + ${d}) = ${total}$`, `$${n1}x + ${n2}(x + ${d}) = ${total}$`),
          ],
          solution: [
            step('Rovnice:', 'The equation:', `${n1}x + ${n2}(x + ${d}) = ${total}`),
            step('Řešení:', 'Its solution:', `${n1 + n2}x = ${total - n2 * d} \\quad\\Rightarrow\\quad x = ${tea}`),
          ],
          misconceptions: [mc(ans(tea + d), 'misread', 'To je cena limonády.', 'That is the price of a lemonade.')],
          verify: [{ kind: 'value', expr: `(${total}-${n2}*${d})/(${n1}+${n2})` }],
          context: { applied: true },
        };
      }
      const count = r.int(20, 60);
      const more = r.int(5, 18);
      const small = r.pick([20, 25, 30]);
      const big = small + r.pick([10, 15, 20]);
      const revenue = count * small + (count + more) * big;
      return {
        prompt: L(
          `Na jarmarku se prodávaly malé perníčky po ${small} korunách a velké po ${big} korunách. Velkých se prodalo o ${more} více než malých a celková tržba byla ${csT(revenue)} korun. Kolik malých perníčků se prodalo?`,
          `At a fair small gingerbreads sold at ${small} crowns and large ones at ${big} crowns. ${more} more large ones were sold than small ones, and the takings were ${enT(revenue)} crowns. How many small gingerbreads were sold?`,
        ),
        answer: { kind: 'number', value: ans(count) },
        hints: [
          L(`Malých $x$, velkých $x + ${more}$.`, `Small ones $x$, large ones $x + ${more}$.`),
          L(`$${small}x + ${big}(x + ${more}) = ${revenue}$`, `$${small}x + ${big}(x + ${more}) = ${revenue}$`),
        ],
        solution: [
          step('Rovnice:', 'The equation:', `${small}x + ${big}(x + ${more}) = ${revenue}`),
          step(
            'Řešení:',
            'Its solution:',
            `${small + big}x = ${revenue - big * more} \\quad\\Rightarrow\\quad x = ${count}`,
          ),
        ],
        misconceptions: [
          mc(ans(count + more), 'misread', 'To je počet velkých perníčků.', 'That is the number of large ones.'),
        ],
        verify: [{ kind: 'value', expr: `(${revenue}-${big}*${more})/(${small}+${big})` }],
        context: { applied: true },
      };
    },
  }),

  gen({
    id: 'word.equations.number',
    concept: 'word.equations',
    kind: 'reverse',
    levels: [2, 3],
    title: L('Úlohy o neznámém čísle', 'Problems about an unknown number'),
    est: (lv) => 60 + 30 * lv,
    make(r, lv) {
      if (lv === 2) {
        const k = r.pick([3, 4, 5]);
        const x = r.int(6, 25);
        const m = (k - 1) * x;
        return {
          prompt: L(
            `${k === 3 ? 'Trojnásobek' : k === 4 ? 'Čtyřnásobek' : 'Pětinásobek'} neznámého čísla je o ${m} větší než číslo samo. Určete neznámé číslo.`,
            `${k} times an unknown number is ${m} more than the number itself. Find the number.`,
          ),
          answer: { kind: 'number', value: ans(x) },
          hints: [
            L(`$${k}x = x + ${m}$`, `$${k}x = x + ${m}$`),
            L(`Po odečtení $x$: $${k - 1}x = ${m}$`, `After subtracting $x$: $${k - 1}x = ${m}$`),
          ],
          solution: [
            step(
              'Rovnice a řešení:',
              'The equation and its solution:',
              `${k}x = x + ${m} \\quad\\Rightarrow\\quad ${k - 1}x = ${m} \\quad\\Rightarrow\\quad x = ${x}`,
            ),
          ],
          misconceptions: [
            mc(
              fToInput(frac(m, k)),
              'algebra',
              'Číslo samo je na pravé straně taky: musí se převést k násobku.',
              'The number itself is on the right as well: it has to be moved to the multiple.',
            ),
          ],
          verify: [{ kind: 'value', expr: `${m}/(${k}-1)` }],
        };
      }
      const first = 2 * r.int(4, 30) + 1;
      const sum = 4 * first + 12;
      return {
        prompt: L(
          `Součet čtyř po sobě jdoucích lichých čísel je ${sum}. Určete nejmenší z nich.`,
          `The sum of four consecutive odd numbers is ${sum}. Find the smallest of them.`,
        ),
        answer: { kind: 'number', value: ans(first) },
        hints: [
          L(
            'Po sobě jdoucí lichá čísla se liší o 2: $x$, $x + 2$, $x + 4$, $x + 6$.',
            'Consecutive odd numbers differ by 2: $x$, $x + 2$, $x + 4$, $x + 6$.',
          ),
          L(`$4x + 12 = ${sum}$`, `$4x + 12 = ${sum}$`),
        ],
        solution: [
          step('Rovnice:', 'The equation:', `x + (x + 2) + (x + 4) + (x + 6) = ${sum}`),
          step('Řešení:', 'Its solution:', `4x = ${sum - 12} \\quad\\Rightarrow\\quad x = ${first}`),
        ],
        misconceptions: [
          mc(
            ans((sum - 6) / 4),
            'concept',
            'Lichá čísla po sobě se liší o 2, ne o 1.',
            'Consecutive odd numbers differ by 2, not by 1.',
          ),
        ],
        verify: [{ kind: 'value', expr: `(${sum}-12)/4` }],
      };
    },
  }),

  gen({
    id: 'word.rates.motion',
    concept: 'word.rates',
    kind: 'core',
    levels: [2, 3, 4],
    title: L('Úlohy o pohybu', 'Motion problems'),
    est: (lv) => 70 + 35 * lv,
    make(r, lv) {
      if (lv === 2) {
        const v = r.pick([12, 15, 18, 24, 30]);
        const minutes = r.pick([20, 40, 50, 80, 100].filter((m) => Number.isInteger((v * m) / 60)));
        const s = (v * minutes) / 60;
        return {
          prompt: L(
            `Cyklista jede stálou rychlostí ${v} km/h. Kolik kilometrů ujede za ${minutes} minut?`,
            `A cyclist rides at a steady ${v} km/h. How many kilometres does he cover in ${minutes} minutes?`,
          ),
          answer: { kind: 'number', value: ans(s) },
          hints: [
            L(
              'Kolik kilometrů ujede za 10 minut? Hodina má šest takových úseků.',
              'How far does he go in 10 minutes? An hour has six such stretches.',
            ),
            both((n, czech) => `${czech ? 'Za 10 minut ujede' : 'In 10 minutes he covers'} $${n(v / 6)}$ km.`),
          ],
          solution: [
            step(
              'Dráha je rychlost krát čas (v hodinách):',
              'Distance is speed times time (in hours):',
              `${v} \\cdot \\frac{${minutes}}{60} = ${s}`,
            ),
          ],
          misconceptions: [
            mc(
              ans(v * minutes),
              'misread',
              'Rychlost je v kilometrech za hodinu, čas je v minutách.',
              'The speed is in kilometres per hour, the time in minutes.',
            ),
          ],
          verify: [{ kind: 'value', expr: `${v}*${minutes}/60` }],
          context: { applied: true },
        };
      }
      if (lv === 3) {
        const lap = r.pick([8, 10, 12]);
        const time = r.pick(
          [40, 48, 50, 60].filter((t) => Number.isInteger((lap * 30) / t) || Number.isInteger((lap * 20) / t)),
        );
        const part = Number.isInteger((lap * 30) / time) ? 30 : 20;
        const done = (lap * part) / time;
        return {
          prompt: L(
            `Parník pluje stálou rychlostí a trasu dlouhou ${lap} km urazí za ${time} minut. Kolik kilometrů mu zbývá do přístavu po ${part} minutách plavby?`,
            `A steamer sails at a steady speed and covers a ${lap} km route in ${time} minutes. How many kilometres are left to the harbour after ${part} minutes?`,
          ),
          answer: { kind: 'number', value: ans(lap - done) },
          hints: [
            L(`Jakou část trasy urazí za ${part} minut?`, `What part of the route does it cover in ${part} minutes?`),
            both((n, czech) => `${czech ? `Za ${part} minut urazí` : `In ${part} minutes it covers`} $${n(done)}$ km.`),
          ],
          solution: [
            step(
              `Za ${part} minut:`,
              `In ${part} minutes:`,
              both((n) => `${lap} \\cdot \\frac{${part}}{${time}} = ${n(done)}`),
            ),
            step(
              'Do přístavu zbývá:',
              'Left to the harbour:',
              both((n) => `${lap} - ${n(done)} = ${n(lap - done)}`),
            ),
          ],
          misconceptions: [
            mc(
              ans(done),
              'misread',
              'To je vzdálenost, kterou už urazil. Otázka se ptá, kolik zbývá.',
              'That is the distance already covered. The question asks how much is left.',
            ),
          ],
          verify: [{ kind: 'value', expr: `${lap}-${lap}*${part}/${time}` }],
          context: { applied: true },
        };
      }
      const [v1, v2, minutes] = r.pick([
        [60, 90, 40],
        [50, 70, 30],
        [45, 75, 20],
        [80, 100, 50],
        [40, 80, 45],
        [54, 66, 25],
      ] as const);
      const distance = ((v1 + v2) * minutes) / 60;
      return {
        prompt: L(
          `Z měst A a B vzdálených ${distance} km vyjela ve stejnou chvíli proti sobě dvě auta, jedno rychlostí ${v1} km/h, druhé ${v2} km/h. Za kolik minut se potkají?`,
          `Two cars set off towards each other at the same moment from towns A and B, ${distance} km apart, one at ${v1} km/h and the other at ${v2} km/h. After how many minutes do they meet?`,
        ),
        answer: { kind: 'number', value: ans(minutes) },
        hints: [
          L(
            'Za hodinu se auta k sobě přiblíží o součet svých rychlostí.',
            'In an hour the cars come closer by the sum of their speeds.',
          ),
          L(`Přibližují se rychlostí ${v1 + v2} km/h.`, `They approach each other at ${v1 + v2} km/h.`),
        ],
        solution: [
          step('Společná rychlost přibližování:', 'The speed of approach:', `${v1} + ${v2} = ${v1 + v2}`),
          step(
            'Čas v hodinách a v minutách:',
            'The time in hours and in minutes:',
            `\\frac{${distance}}{${v1 + v2}}\\ \\text{h} = ${minutes}\\ \\text{min}`,
          ),
        ],
        misconceptions: [],
        verify: [{ kind: 'value', expr: `${distance}/(${v1}+${v2})*60` }],
        context: { applied: true },
      };
    },
  }),

  gen({
    id: 'word.rates.work',
    concept: 'word.rates',
    kind: 'core',
    levels: [3, 4],
    title: L('Společná práce', 'Working together'),
    est: (lv) => 80 + 35 * lv,
    make(r, lv) {
      if (lv === 3) {
        const [a, b, together] = r.pick([
          [6, 3, 2],
          [4, 12, 3],
          [10, 15, 6],
          [12, 6, 4],
          [20, 30, 12],
          [10, 40, 8],
          [9, 18, 6],
          [15, 30, 10],
        ] as const);
        const h = (n: number): string => `${n} ${plural(n, 'hodinu', 'hodiny', 'hodin')}`;
        const [text, textEn] = r.pick([
          [
            `Větší čerpadlo naplní nádrž samo za ${h(a)}, menší za ${h(b)}. Za kolik hodin naplní nádrž obě čerpadla společně?`,
            `The larger pump fills a tank alone in ${a} hours, the smaller in ${b} hours. In how many hours do both pumps fill it together?`,
          ],
          [
            `Jeden stroj zpracuje zakázku sám za ${h(a)}, druhý za ${h(b)}. Za kolik hodin ji zpracují oba stroje společně?`,
            `One machine does a job alone in ${a} hours, another in ${b} hours. In how many hours do both machines do it together?`,
          ],
          [
            `Malíř vymaluje halu sám za ${h(a)}, jeho pomocník za ${h(b)}. Za kolik hodin ji vymalují společně?`,
            `A painter paints a hall alone in ${a} hours, his helper in ${b} hours. In how many hours do they paint it together?`,
          ],
        ] as const);
        return {
          prompt: L(text, textEn),
          answer: { kind: 'number', value: ans(together) },
          hints: [
            L(
              'Jakou část práce udělá každý za jednu hodinu? Části se sčítají, časy ne.',
              'What part of the job does each do in one hour? The parts add; the times do not.',
            ),
            L(
              `Za hodinu: $\\frac{1}{${a}} + \\frac{1}{${b}} = ${fToTex(frac(a + b, a * b))}$ práce.`,
              `Per hour: $\\frac{1}{${a}} + \\frac{1}{${b}} = ${fToTex(frac(a + b, a * b))}$ of the job.`,
            ),
          ],
          solution: [
            step(
              'Společný výkon za hodinu:',
              'The joint rate per hour:',
              `\\frac{1}{${a}} + \\frac{1}{${b}} = ${fToTex(frac(a + b, a * b))}`,
            ),
            step(
              'Celá práce:',
              'The whole job:',
              L(
                `1 : ${fToTex(frac(a + b, a * b))} = ${together}`,
                `1 \\div ${fToTex(frac(a + b, a * b))} = ${together}`,
              ),
            ),
          ],
          misconceptions: [
            mc(
              ans(a + b),
              'concept',
              'Časy se nesčítají: společně to musí být rychlejší než kterýkoli sám.',
              'Times do not add: together it must be faster than either alone.',
            ),
            mc(
              fToInput(frac(a + b, 2)),
              'concept',
              'Průměr časů to není. Počítej s tím, jakou část práce udělá každý za hodinu.',
              'It is not the average of the times. Work with the part of the job each does per hour.',
            ),
          ],
          verify: [{ kind: 'value', expr: `1/(1/${a}+1/${b})` }],
          context: { applied: true },
        };
      }
      // The first works alone for a while; the numbers are chosen so that the rest is whole.
      const [a, b, alone, rest] = r.pick([
        [6, 3, 3, 1],
        [12, 6, 3, 3],
        [9, 18, 3, 4],
        [15, 30, 3, 8],
        [10, 15, 5, 3],
        [20, 30, 5, 9],
        [10, 40, 5, 4],
        [12, 4, 4, 2],
      ] as const);
      const together = (a * b) / (a + b);
      const hours = (n: number): string => `${n} ${plural(n, 'hodinu', 'hodiny', 'hodin')}`;
      return {
        prompt: L(
          `Jedno čerpadlo naplní nádrž za ${hours(a)}, druhé za ${hours(b)}. Nejdřív běželo ${hours(alone)} jen první čerpadlo, potom se připojilo druhé. Za kolik dalších hodin byla nádrž plná?`,
          `One pump fills a tank in ${a} hours, another in ${b} hours. First only the first pump ran for ${alone} hours; then the second joined in. After how many more hours was the tank full?`,
        ),
        answer: { kind: 'number', value: ans(rest) },
        hints: [
          L(
            `Jakou část nádrže naplnilo první čerpadlo samo za ${hours(alone)}?`,
            `What part of the tank did the first pump fill alone in ${alone} hours?`,
          ),
          L(
            `Zbývá $${fToTex(frac(a - alone, a))}$ nádrže a obě čerpadla naplní za hodinu $${fToTex(frac(a + b, a * b))}$.`,
            `$${fToTex(frac(a - alone, a))}$ of the tank is left, and both pumps fill $${fToTex(frac(a + b, a * b))}$ per hour.`,
          ),
        ],
        solution: [
          step('Zbývá naplnit:', 'Still to fill:', `1 - ${fToTex(frac(alone, a))} = ${fToTex(frac(a - alone, a))}`),
          step('Společně za hodinu:', 'Together per hour:', fToTex(frac(a + b, a * b))),
          step(
            'Čas:',
            'The time:',
            L(
              `${fToTex(frac(a - alone, a))} : ${fToTex(frac(a + b, a * b))} = ${rest}`,
              `${fToTex(frac(a - alone, a))} \\div ${fToTex(frac(a + b, a * b))} = ${rest}`,
            ),
          ),
        ],
        misconceptions: [
          mc(
            fToInput(frac(Math.round(together * 1000), 1000)),
            'misread',
            'Tolik by trvalo, kdyby obě čerpadla běžela od začátku. Část nádrže už ale byla plná.',
            'That is how long both pumps would take from the start. But part of the tank was already full.',
          ),
        ],
        verify: [{ kind: 'value', expr: `(1-${alone}/${a})/(1/${a}+1/${b})` }],
        context: { applied: true },
      };
    },
  }),
];
