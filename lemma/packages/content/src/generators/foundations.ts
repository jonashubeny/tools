import {
  L,
  fNeg,
  fToInput,
  fToTex,
  frac,
  intervalIn,
  intervalL,
  nIn,
  nTex,
  pTex,
  pointL,
  polyIn,
  polyTex,
  setL,
  type Generator,
} from '@lemma/core';
import { HINT, distinct, gen, mapL, mc, nz, par, shiftIn, shiftTex, step, tailIn, tailTex } from './helpers';

/** Generators for foundation concepts (track 'foundation'). */
export const FOUNDATION_GENERATORS: Generator[] = [
  // ---------------------------------------------------------------------- expressions
  gen({
    id: 'alg.expressions.expand',
    concept: 'alg.expressions',
    kind: 'core',
    levels: [1, 2, 3],
    title: L('Roznásobení závorek', 'Expanding brackets'),
    est: (lv) => 40 + 30 * lv,
    make(r, lv) {
      if (lv === 1) {
        const a = nz(r, -6, 6);
        const b = nz(r, -6, 6);
        const shown = `(${shiftTex(-a)})(${shiftTex(-b)})`;
        return {
          prompt: L(`Roznásobte a zjednodušte: $${shown}$`, `Expand and simplify: $${shown}$`),
          answer: { kind: 'expr', value: polyIn([1, a + b, a * b]), vars: ['x'], form: 'expanded' },
          hints: [
            L(
              'Každý člen první závorky vynásob každým členem druhé — vzniknou čtyři součiny.',
              'Multiply each term of the first bracket by each term of the second — four products.',
            ),
            L(
              `Dva prostřední součiny jsou $${nTex(b)}x$ a $${nTex(a)}x$. Sečti je.`,
              `The two middle products are $${nTex(b)}x$ and $${nTex(a)}x$. Add them.`,
            ),
          ],
          solution: [
            step('Každý s každým:', 'Each with each:', `x^2 ${tailTex(b)}x ${tailTex(a)}x ${tailTex(a * b)}`),
            step('Sečteme lineární členy:', 'Combine the linear terms:', polyTex([1, a + b, a * b])),
          ],
          misconceptions: [
            mc(
              polyIn([1, a + b, -a * b]),
              'sign',
              'Znaménko u posledního členu: součin dvou čísel se stejným znaménkem je kladný.',
              'Sign of the last term: the product of two numbers with the same sign is positive.',
            ),
            mc(
              polyIn([1, 0, a * b]),
              'algebra',
              'Chybí prostřední členy — násobí se každý s každým.',
              'The middle terms are missing — every term multiplies every term.',
            ),
          ],
          verify: [{ kind: 'equiv', expr: `(${shiftIn(-a)})*(${shiftIn(-b)})`, vars: ['x'] }],
        };
      }
      if (lv === 2) {
        const a = r.pick([2, 3, -1, -2, 4]);
        const b = nz(r, -5, 5);
        const inner = polyTex([a, b]);
        return {
          prompt: L(`Umocněte: $\\left(${inner}\\right)^2$`, `Expand: $\\left(${inner}\\right)^2$`),
          answer: { kind: 'expr', value: polyIn([a * a, 2 * a * b, b * b]), vars: ['x'], form: 'expanded' },
          hints: [
            L(
              'Použij vzorec $(A+B)^2 = A^2 + 2AB + B^2$. Co je tady $A$ a co $B$?',
              'Use $(A+B)^2 = A^2 + 2AB + B^2$. What are $A$ and $B$ here?',
            ),
            L(
              `$A = ${nTex(a)}x$, $B = ${nTex(b)}$. Prostřední člen je $2 \\cdot ${pTex(a)}x \\cdot ${pTex(b)}$.`,
              `$A = ${nTex(a)}x$, $B = ${nTex(b)}$. The middle term is $2 \\cdot ${pTex(a)}x \\cdot ${pTex(b)}$.`,
            ),
          ],
          solution: [
            step(
              'Vzorec pro druhou mocninu dvojčlenu:',
              'The square-of-a-binomial identity:',
              `(${nTex(a)}x)^2 + 2\\cdot${pTex(a)}x\\cdot${pTex(b)} + ${pTex(b)}^2`,
            ),
            step('Vyčíslíme:', 'Evaluate:', polyTex([a * a, 2 * a * b, b * b])),
          ],
          misconceptions: [
            mc(
              polyIn([a * a, 0, b * b]),
              'algebra',
              '$(A+B)^2 \\ne A^2 + B^2$ — chybí dvojnásobný součin $2AB$.',
              '$(A+B)^2 \\ne A^2 + B^2$ — the double product $2AB$ is missing.',
            ),
            mc(
              polyIn([a * a, a * b, b * b]),
              'formula',
              'Prostřední člen je dvojnásobný součin: $2AB$, ne $AB$.',
              'The middle term is the double product: $2AB$, not $AB$.',
            ),
            mc(
              polyIn([a, 2 * a * b, b * b]),
              'algebra',
              'Umocňuje se i koeficient: $(ax)^2 = a^2x^2$.',
              'The coefficient is squared too: $(ax)^2 = a^2x^2$.',
            ),
            mc(
              polyIn([a * a, -2 * a * b, b * b]),
              'sign',
              'Znaménko prostředního členu se řídí znaménky obou členů.',
              'The sign of the middle term follows the signs of both terms.',
            ),
          ],
          verify: [{ kind: 'equiv', expr: `(${polyIn([a, b])})^2`, vars: ['x'] }],
        };
      }
      const a = r.pick([2, 3]);
      const b = nz(r, -4, 4);
      const c = nz(r, -4, 4);
      const e = nz(r, -4, 4);
      const first = `(${polyTex([a, b])})(${shiftTex(-c)})`;
      const second = `(${shiftTex(-e)})^2`;
      const coeffs = [a - 1, a * c + b - 2 * e, b * c - e * e];
      return {
        prompt: L(`Zjednodušte: $${first} - ${second}$`, `Simplify: $${first} - ${second}$`),
        answer: { kind: 'expr', value: polyIn(coeffs), vars: ['x'], form: 'expanded' },
        hints: [
          L(
            'Roznásob každou část zvlášť. Druhou část nech zatím v závorce s minusem před ní.',
            'Expand each part separately. Keep the second part in a bracket with the minus in front for now.',
          ),
          L(
            `$${second} = ${polyTex([1, 2 * e, e * e])}$. Minus před závorkou změní znaménko všech tří členů.`,
            `$${second} = ${polyTex([1, 2 * e, e * e])}$. The minus in front changes the sign of all three terms.`,
          ),
        ],
        solution: [
          step(
            'Roznásobíme obě části:',
            'Expand both parts:',
            `${polyTex([a, a * c + b, b * c])} - \\left(${polyTex([1, 2 * e, e * e])}\\right)`,
          ),
          step(
            'Odstraníme závorku — minus mění všechna znaménka:',
            'Remove the bracket — the minus flips every sign:',
            `${polyTex([a, a * c + b, b * c])} ${tailTex(-1)}x^2 ${tailTex(-2 * e)}x ${tailTex(-e * e)}`,
          ),
          step('Sečteme:', 'Collect:', polyTex(coeffs)),
        ],
        misconceptions: [
          mc(
            polyIn([a - 1, a * c + b + 2 * e, b * c + e * e]),
            'sign',
            'Minus před závorkou platí pro všechny její členy, ne jen pro první.',
            'The minus in front of a bracket applies to all its terms, not only the first.',
          ),
          mc(
            polyIn([a - 1, a * c + b - 2 * e, b * c + e * e]),
            'sign',
            'Minus před závorkou změní znaménko i u posledního členu.',
            'The minus in front of the bracket changes the sign of the last term too.',
          ),
          mc(
            polyIn([a - 1, a * c + b, b * c - e * e]),
            'algebra',
            'V $(x+e)^2$ chybí prostřední člen $2ex$.',
            'The middle term $2ex$ of $(x+e)^2$ is missing.',
          ),
        ],
        verify: [{ kind: 'equiv', expr: `(${polyIn([a, b])})*(${shiftIn(-c)})-(${shiftIn(-e)})^2`, vars: ['x'] }],
      };
    },
  }),

  gen({
    id: 'alg.expressions.factor',
    concept: 'alg.expressions',
    kind: 'core',
    levels: [1, 2, 3],
    title: L('Rozklad na součin', 'Factoring'),
    est: (lv) => 45 + 30 * lv,
    make(r, lv) {
      if (lv === 1) {
        const g = r.pick([2, 3, 4, 5]);
        const p = r.pick([1, 2, 3, 5]);
        const q = r.pick([1, 2, 3, 5, 7].filter((v) => v !== p)) * r.sign();
        const shown = polyTex([g * p, g * q, 0]);
        return {
          prompt: L(`Rozložte na součin vytknutím: $${shown}$`, `Factor by taking out the common factor: $${shown}$`),
          answer: { kind: 'expr', value: `${g}*x*(${polyIn([p, q])})`, vars: ['x'], form: 'factored' },
          hints: [
            L(
              'Co mají oba členy společného? Hledej společné číslo i společnou proměnnou.',
              'What do both terms share? Look for a common number and a common variable.',
            ),
            L(`Oba členy jsou dělitelné výrazem $${g}x$.`, `Both terms are divisible by $${g}x$.`),
          ],
          solution: [
            step(`Vytkneme $${g}x$:`, `Take out $${g}x$:`, `${g}x\\left(${polyTex([p, q])}\\right)`),
            step(
              'Kontrola: roznásobením dostaneme původní výraz.',
              'Check: expanding gives the original expression back.',
            ),
          ],
          verify: [{ kind: 'equiv', expr: polyIn([g * p, g * q, 0]), vars: ['x'] }],
        };
      }
      if (lv === 2) {
        const [r1, r2] = distinct(r, -7, 7, 2, [0]) as [number, number];
        const coeffs = [1, -(r1 + r2), r1 * r2];
        return {
          prompt: L(`Rozložte na součin: $${polyTex(coeffs)}$`, `Factor: $${polyTex(coeffs)}$`),
          answer: { kind: 'expr', value: `(${shiftIn(r1)})*(${shiftIn(r2)})`, vars: ['x'], form: 'factored' },
          hints: [
            L(
              `Hledáš dvě čísla, jejichž součin je $${r1 * r2}$ a součet $${-(r1 + r2)}$.`,
              `You need two numbers whose product is $${r1 * r2}$ and whose sum is $${-(r1 + r2)}$.`,
            ),
            L(
              `Jsou to $${-r1}$ a $${-r2}$. Zapiš je do závorek $(x + \\dots)(x + \\dots)$.`,
              `They are $${-r1}$ and $${-r2}$. Put them into $(x + \\dots)(x + \\dots)$.`,
            ),
          ],
          solution: [
            step(
              `Dvě čísla se součinem $${r1 * r2}$ a součtem $${-(r1 + r2)}$: $${-r1}$ a $${-r2}$.`,
              `Two numbers with product $${r1 * r2}$ and sum $${-(r1 + r2)}$: $${-r1}$ and $${-r2}$.`,
            ),
            step('Rozklad:', 'Factored form:', `(${shiftTex(r1)})(${shiftTex(r2)})`),
          ],
          misconceptions: [
            mc(
              `(${shiftIn(-r1)})*(${shiftIn(-r2)})`,
              'sign',
              'Znaménka v závorkách jsou obráceně. Roznásob si to zpátky a porovnej lineární člen.',
              'The signs inside the brackets are reversed. Expand it back and compare the linear term.',
            ),
          ],
          verify: [{ kind: 'equiv', expr: polyIn(coeffs), vars: ['x'] }],
        };
      }
      const a = r.pick([2, 3, 5]);
      const b = r.pick([1, 2, 3, 4, 5, 7].filter((v) => v % a !== 0));
      const k = r.pick([1, 1, 2, 3]);
      const shown = polyTex([k * a * a, 0, -k * b * b]);
      return {
        prompt: L(`Rozložte na součin co nejvíce: $${shown}$`, `Factor completely: $${shown}$`),
        answer: {
          kind: 'expr',
          value: `${k === 1 ? '' : `${k}*`}(${a}x-${b})*(${a}x+${b})`,
          vars: ['x'],
          form: 'factored',
        },
        hints: [
          k === 1
            ? L(
                'Oba členy jsou druhé mocniny a mezi nimi je minus. Který vzorec to je?',
                'Both terms are squares with a minus between them. Which identity is that?',
              )
            : L(`Nejdřív vytkni společné číslo $${k}$.`, `First take out the common number $${k}$.`),
          L(
            `$A^2 - B^2 = (A-B)(A+B)$, kde $A = ${a}x$ a $B = ${b}$.`,
            `$A^2 - B^2 = (A-B)(A+B)$ with $A = ${a}x$ and $B = ${b}$.`,
          ),
        ],
        solution: [
          ...(k === 1
            ? []
            : [step(`Vytkneme $${k}$:`, `Take out $${k}$:`, `${k}\\left(${polyTex([a * a, 0, -b * b])}\\right)`)]),
          step('Rozdíl čtverců:', 'Difference of squares:', `${k === 1 ? '' : k}(${a}x - ${b})(${a}x + ${b})`),
        ],
        misconceptions: [
          mc(
            `${k === 1 ? '' : `${k}*`}(${a}x-${b})^2`,
            'formula',
            'To je vzorec pro $(A-B)^2$, který má prostřední člen. Tady žádný není — jde o rozdíl čtverců.',
            'That is the identity for $(A-B)^2$, which has a middle term. There is none here — it is a difference of squares.',
          ),
        ],
        verify: [{ kind: 'equiv', expr: polyIn([k * a * a, 0, -k * b * b]), vars: ['x'] }],
      };
    },
  }),

  // --------------------------------------------------------------------- linear equations
  gen({
    id: 'alg.linear-eq.solve',
    concept: 'alg.linear-eq',
    kind: 'core',
    levels: [1, 2, 3],
    title: L('Řešení lineární rovnice', 'Solving a linear equation'),
    est: (lv) => 40 + 35 * lv,
    make(r, lv) {
      if (lv === 1) {
        const a = nz(r, -6, 6);
        const x0 = r.int(-6, 6);
        const b = nz(r, -9, 9);
        const c = a * x0 + b;
        const lhs = polyTex([a, b]);
        return {
          prompt: L(`Řešte v $\\mathbb{R}$: $${lhs} = ${c}$`, `Solve in $\\mathbb{R}$: $${lhs} = ${c}$`),
          answer: { kind: 'set', values: [`${x0}`], label: 'x =' },
          hints: [
            L(`Nejdřív se zbav čísla $${nTex(b)}$ na levé straně.`, `First get rid of the $${nTex(b)}$ on the left.`),
            L(`Po úpravě: $${nTex(a)}x = ${c - b}$. Teď vyděl.`, `After that: $${nTex(a)}x = ${c - b}$. Now divide.`),
          ],
          solution: [
            step(
              `Od obou stran odečteme $${pTex(b)}$:`,
              `Subtract $${pTex(b)}$ from both sides:`,
              `${nTex(a)}x = ${c - b}`,
            ),
            step(`Vydělíme $${pTex(a)}$:`, `Divide by $${pTex(a)}$:`, `x = ${x0}`),
            step('Zkouška:', 'Check:', `${nTex(a)}\\cdot${par(x0)} ${tailTex(b)} = ${c}`),
          ],
          misconceptions: [
            mc(
              fToInput(frac(c + b, a)),
              'sign',
              'Při převodu na druhou stranu se znaménko mění.',
              'A term changes sign when it moves to the other side.',
            ),
          ],
          verify: [{ kind: 'roots', expr: `${polyIn([a, b])}-(${c})` }],
        };
      }
      if (lv === 2) {
        const x0 = r.int(-5, 5);
        const a = r.pick([2, 3, 4, -2, -3]);
        const b = nz(r, -5, 5);
        const c = r.intExcept(-4, 5, [a, 0]);
        const d = a * (x0 + b) - c * x0;
        const lhs = `${a}(${shiftTex(-b)})`;
        const rhs = polyTex([c, d]);
        const wrong = frac(d - b, a - c);
        return {
          prompt: L(`Řešte v $\\mathbb{R}$: $${lhs} = ${rhs}$`, `Solve in $\\mathbb{R}$: $${lhs} = ${rhs}$`),
          answer: { kind: 'set', values: [`${x0}`], label: 'x =' },
          hints: [
            L(
              'Nejdřív roznásob závorku — číslem před ní násobíš oba členy.',
              'Expand the bracket first — the number in front multiplies both terms.',
            ),
            L(
              `Levá strana je $${polyTex([a, a * b])}$. Členy s $x$ dej na jednu stranu, čísla na druhou.`,
              `The left side is $${polyTex([a, a * b])}$. Collect the $x$ terms on one side and the numbers on the other.`,
            ),
            L(`Vyjde $${nTex(a - c)}x = ${d - a * b}$.`, `You get $${nTex(a - c)}x = ${d - a * b}$.`),
          ],
          solution: [
            step('Roznásobíme:', 'Expand:', `${polyTex([a, a * b])} = ${rhs}`),
            step(
              'Členy s $x$ vlevo, čísla vpravo:',
              'Unknowns to the left, numbers to the right:',
              `${nTex(a - c)}x = ${d - a * b}`,
            ),
            step('Vydělíme:', 'Divide:', `x = ${x0}`),
          ],
          misconceptions: [
            mc(
              fToInput(wrong),
              'algebra',
              'Číslo před závorkou násobí oba členy v závorce, ne jen $x$.',
              'The number in front of the bracket multiplies both terms inside, not only $x$.',
            ),
          ],
          verify: [{ kind: 'roots', expr: `${a}*(${shiftIn(-b)})-(${polyIn([c, d])})` }],
        };
      }
      const [m, n] = r.pick([
        [2, 3],
        [3, 4],
        [2, 5],
        [3, 5],
        [4, 3],
        [5, 2],
      ] as const);
      const x0 = r.int(-6, 8);
      const p = r.int(-3, 4);
      const q = r.intExcept(-3, 4, [p]);
      const a = m * p - x0;
      const b = n * q - x0;
      const c = p - q;
      const lhs = `\\frac{${shiftTex(-a)}}{${m}} - \\frac{${shiftTex(-b)}}{${n}}`;
      return {
        prompt: L(`Řešte v $\\mathbb{R}$: $${lhs} = ${c}$`, `Solve in $\\mathbb{R}$: $${lhs} = ${c}$`),
        answer: { kind: 'set', values: [`${x0}`], label: 'x =' },
        hints: [
          L(
            `Zbav se zlomků: vynásob celou rovnici společným jmenovatelem $${m * n}$.`,
            `Clear the fractions: multiply the whole equation by the common denominator $${m * n}$.`,
          ),
          L(
            `Vyjde $${n}(${shiftTex(-a)}) - ${m}(${shiftTex(-b)}) = ${c * m * n}$. Pozor na minus před druhou závorkou.`,
            `You get $${n}(${shiftTex(-a)}) - ${m}(${shiftTex(-b)}) = ${c * m * n}$. Mind the minus before the second bracket.`,
          ),
        ],
        solution: [
          step(
            `Vynásobíme $${m * n}$:`,
            `Multiply by $${m * n}$:`,
            `${n}(${shiftTex(-a)}) - ${m}(${shiftTex(-b)}) = ${c * m * n}`,
          ),
          step(
            'Roznásobíme (minus mění obě znaménka):',
            'Expand (the minus flips both signs):',
            `${polyTex([n, n * a])} ${tailTex(-m)}x ${tailTex(-m * b)} = ${c * m * n}`,
          ),
          step(
            'Sečteme a vyřešíme:',
            'Collect and solve:',
            `${nTex(n - m)}x = ${c * m * n - n * a + m * b} \\;\\Rightarrow\\; x = ${x0}`,
          ),
        ],
        misconceptions: [
          mc(
            fToInput(frac(c * m * n - n * a - m * b, n - m)),
            'sign',
            'Minus před zlomkem platí pro celý čitatel: $-(x + b) = -x - b$.',
            'The minus before a fraction applies to the whole numerator: $-(x + b) = -x - b$.',
          ),
          mc(
            fToInput(frac(c - n * a + m * b, n - m)),
            'algebra',
            'Společným jmenovatelem se násobí i pravá strana.',
            'The right-hand side must be multiplied by the common denominator too.',
          ),
        ],
        verify: [{ kind: 'roots', expr: `(${shiftIn(-a)})/${m}-(${shiftIn(-b)})/${n}-(${c})` }],
      };
    },
  }),

  // --------------------------------------------------------------------------- intervals
  gen({
    id: 'alg.intervals.notation',
    concept: 'alg.intervals',
    kind: 'core',
    levels: [1, 2, 3],
    title: L('Zápis intervalem', 'Interval notation'),
    est: (lv) => 30 + 25 * lv,
    make(r, lv) {
      if (lv === 1) {
        const a = r.int(-6, 3);
        const b = a + r.int(2, 6);
        const loClosed = r.bool();
        const hiClosed = r.bool();
        const oneSided = r.bool(0.4);
        if (oneSided) {
          const greater = r.bool();
          const closed = r.bool();
          const rel = greater ? (closed ? '\\ge' : '>') : closed ? '\\le' : '<';
          const value = greater ? intervalIn(a, 'inf', closed, false) : intervalIn('-inf', a, false, closed);
          return {
            prompt: L(
              `Zapište intervalem množinu všech reálných $x$, pro která platí $x ${rel} ${a}$.`,
              `Write as an interval the set of all real $x$ with $x ${rel} ${a}$.`,
            ),
            answer: { kind: 'interval', value },
            hints: [
              L(
                'Nakresli si číselnou osu a vyznač, kterým směrem množina pokračuje.',
                'Draw a number line and mark which way the set extends.',
              ),
              L(
                `Patří číslo $${a}$ do množiny? Podle toho zvol závorku. U nekonečna je vždy kulatá.`,
                `Does $${a}$ belong to the set? Choose the bracket accordingly. At infinity it is always round.`,
              ),
            ],
            solution: [
              step(
                `Množina ${greater ? 'začíná v' : 'končí v'} $${a}$ a pokračuje do ${greater ? '' : 'minus '}nekonečna.`,
                `The set ${greater ? 'starts at' : 'ends at'} $${a}$ and extends to ${greater ? '' : 'minus '}infinity.`,
              ),
              step(
                `Znak $${rel}$ ${closed ? 'krajní bod zahrnuje' : 'krajní bod vylučuje'}.`,
                `The sign $${rel}$ ${closed ? 'includes' : 'excludes'} the endpoint.`,
                greater ? intervalL(a, 'inf', closed, false) : intervalL('-inf', a, false, closed),
              ),
            ],
            verify: [
              {
                kind: 'inequality',
                expr: `x-(${a})`,
                rel: (greater ? (closed ? '>=' : '>') : closed ? '<=' : '<') as '<' | '<=' | '>' | '>=',
              },
            ],
          };
        }
        const relLo = loClosed ? '\\le' : '<';
        const relHi = hiClosed ? '\\le' : '<';
        const shown = intervalL(a, b, loClosed, hiClosed);
        return {
          prompt: L(
            `Zapište intervalem množinu všech reálných $x$, pro která platí $${a} ${relLo} x ${relHi} ${b}$.`,
            `Write as an interval the set of all real $x$ with $${a} ${relLo} x ${relHi} ${b}$.`,
          ),
          answer: { kind: 'interval', value: intervalIn(a, b, loClosed, hiClosed) },
          hints: [
            L(
              'U každého krajního bodu rozhodni zvlášť: patří do množiny, nebo ne?',
              'Decide for each endpoint separately: is it in the set or not?',
            ),
            L(
              '$\\le$ znamená, že bod do množiny patří (ostrá závorka $\\langle$), $<$ že nepatří (kulatá).',
              '$\\le$ means the endpoint is included (square bracket), $<$ that it is not (round bracket).',
            ),
          ],
          solution: [
            step(
              'Levý konec podle prvního znaku, pravý podle druhého:',
              'Left end by the first sign, right end by the second:',
              shown,
            ),
          ],
        };
      }
      const a = r.int(-6, 0);
      const b = a + r.int(3, 6);
      const c = r.int(a + 1, b - 1);
      const d = b + r.int(1, 5);
      const aClosed = r.bool();
      const bClosed = r.bool();
      const cClosed = r.bool();
      const dClosed = r.bool();
      const A = intervalL(a, b, aClosed, bClosed);
      const B = intervalL(c, d, cClosed, dClosed);
      const op = lv === 3 && r.bool(0.35) ? 'diff' : r.pick(['cap', 'cup'] as const);
      const symbol = op === 'cap' ? '\\cap' : op === 'cup' ? '\\cup' : '\\setminus';
      const value =
        op === 'cap'
          ? intervalIn(c, b, cClosed, bClosed)
          : op === 'cup'
            ? intervalIn(a, d, aClosed, dClosed)
            : intervalIn(a, c, aClosed, !cClosed);
      const result =
        op === 'cap'
          ? intervalL(c, b, cClosed, bClosed)
          : op === 'cup'
            ? intervalL(a, d, aClosed, dClosed)
            : intervalL(a, c, aClosed, !cClosed);
      return {
        prompt: L(
          `Jsou dány intervaly $A = ${A.cs}$ a $B = ${B.cs}$. Určete $A ${symbol} B$.`,
          `Given the intervals $A = ${A.en}$ and $B = ${B.en}$, find $A ${symbol} B$.`,
        ),
        answer: { kind: 'interval', value },
        hints: [
          L(
            'Nakresli oba intervaly nad sebe na jednu číselnou osu.',
            'Draw both intervals one above the other on a single number line.',
          ),
          op === 'cap'
            ? L(
                'Průnik je to, co mají společné — úsek, kde se překrývají.',
                'The intersection is what they share — the stretch where they overlap.',
              )
            : op === 'cup'
              ? L(
                  'Sjednocení je vše, co leží aspoň v jednom z nich.',
                  'The union is everything lying in at least one of them.',
                )
              : L(
                  'Rozdíl $A \\setminus B$ je to, co je v $A$, ale není v $B$.',
                  'The difference $A \\setminus B$ is what is in $A$ but not in $B$.',
                ),
          L(
            'U krajních bodů výsledku zkontroluj, zda do výsledné množiny patří.',
            'For each endpoint of the result, check whether it belongs to the resulting set.',
          ),
        ],
        solution: [
          step(
            'Na číselné ose se intervaly překrývají mezi $' + c + '$ a $' + b + '$.',
            'On the number line the intervals overlap between $' + c + '$ and $' + b + '$.',
          ),
          step(
            op === 'diff'
              ? `Z $A$ odebereme vše od $${c}$ dál. Bod $${c}$ zůstane právě tehdy, když do $B$ nepatří.`
              : 'Krajní body převezmeme i se závorkami z původních intervalů.',
            op === 'diff'
              ? `Remove from $A$ everything from $${c}$ onwards. The point $${c}$ stays exactly when it is not in $B$.`
              : 'The endpoints keep the brackets they had in the original intervals.',
            result,
          ),
        ],
        misconceptions: [
          op === 'cap'
            ? mc(
                intervalIn(a, d, aClosed, dClosed),
                'concept',
                'To je sjednocení. Průnik je jen společná část.',
                'That is the union. The intersection is only the common part.',
              )
            : op === 'cup'
              ? mc(
                  intervalIn(c, b, cClosed, bClosed),
                  'concept',
                  'To je průnik. Sjednocení je vše z obou intervalů.',
                  'That is the intersection. The union is everything from both intervals.',
                )
              : mc(
                  intervalIn(a, c, aClosed, cClosed),
                  'notation',
                  `Bod $${c}$: patří do $B$? Pokud ano, v rozdílu být nesmí.`,
                  `The point $${c}$: is it in $B$? If so, it cannot be in the difference.`,
                ),
        ],
      };
    },
  }),

  // ------------------------------------------------------------------ linear inequalities
  gen({
    id: 'alg.linear-ineq.solve',
    concept: 'alg.linear-ineq',
    kind: 'core',
    levels: [1, 2, 3],
    title: L('Řešení lineární nerovnice', 'Solving a linear inequality'),
    est: (lv) => 45 + 30 * lv,
    make(r, lv) {
      const rel = r.pick(['<', '<=', '>', '>='] as const);
      const relTex = { '<': '<', '<=': '\\le', '>': '>', '>=': '\\ge' }[rel];
      const x0 = r.int(-6, 6);
      const a = lv === 1 ? r.int(2, 5) : lv === 2 ? -r.int(2, 5) : nz(r, -5, 5);
      const c = lv === 3 ? r.intExcept(-4, 4, [a]) : 0;
      const b = nz(r, -8, 8);
      // a·x + b REL c·x + d, with boundary x0
      const d = (a - c) * x0 + b;
      const lhs = polyTex([a, b]);
      const rhs = c === 0 ? `${d}` : polyTex([c, d]);
      const k = a - c;
      const flipped = k < 0;
      const strict = rel === '<' || rel === '>';
      const pointsRight = (rel === '>' || rel === '>=') !== flipped;
      const value = pointsRight ? intervalIn(x0, 'inf', !strict, false) : intervalIn('-inf', x0, false, !strict);
      const shown = pointsRight ? intervalL(x0, 'inf', !strict, false) : intervalL('-inf', x0, false, !strict);
      const finalRel = { '<': '>', '<=': '\\ge', '>': '<', '>=': '\\le' } as const;
      const afterRel = flipped ? finalRel[rel] : relTex;
      return {
        prompt: L(
          `Řešte v $\\mathbb{R}$ a výsledek zapište intervalem: $${lhs} ${relTex} ${rhs}$`,
          `Solve in $\\mathbb{R}$ and give the answer as an interval: $${lhs} ${relTex} ${rhs}$`,
        ),
        answer: { kind: 'interval', value, label: 'x \\in' },
        hints: [
          L(
            'Uprav ji jako rovnici: neznámé na jednu stranu, čísla na druhou.',
            'Treat it like an equation: unknowns to one side, numbers to the other.',
          ),
          L(
            `Dostaneš $${nTex(k)}x ${relTex} ${d - b}$. Jaké znaménko má číslo, kterým budeš dělit?`,
            `You get $${nTex(k)}x ${relTex} ${d - b}$. What is the sign of the number you are about to divide by?`,
          ),
          flipped
            ? L(
                'Dělíš záporným číslem — znak nerovnosti se otočí.',
                'You are dividing by a negative number — the inequality sign flips.',
              )
            : L(
                'Dělíš kladným číslem — znak nerovnosti zůstává.',
                'You are dividing by a positive number — the inequality sign stays.',
              ),
        ],
        solution: [
          step(
            'Převedeme neznámé vlevo a čísla vpravo:',
            'Move unknowns left and numbers right:',
            `${nTex(k)}x ${relTex} ${d - b}`,
          ),
          step(
            flipped ? `Dělíme $${k}$, tedy záporným číslem, a znak otočíme:` : `Dělíme $${k}$, znak zůstává:`,
            flipped ? `Divide by $${k}$, a negative number, and flip the sign:` : `Divide by $${k}$; the sign stays:`,
            `x ${afterRel} ${x0}`,
          ),
          step('Zapíšeme intervalem:', 'As an interval:', shown),
        ],
        verify: [{ kind: 'inequality', expr: `${polyIn([a, b])}-(${polyIn([c, d])})`, rel }],
      };
    },
  }),

  // ------------------------------------------------------------------ quadratic equations
  gen({
    id: 'alg.quad-eq.solve',
    concept: 'alg.quad-eq',
    kind: 'core',
    levels: [1, 2, 3, 4],
    title: L('Řešení kvadratické rovnice', 'Solving a quadratic equation'),
    est: (lv) => 45 + 35 * lv,
    make(r, lv) {
      if (lv === 1) {
        if (r.bool()) {
          const k = r.int(2, 9);
          return {
            prompt: L(`Řešte v $\\mathbb{R}$: $x^2 = ${k * k}$`, `Solve in $\\mathbb{R}$: $x^2 = ${k * k}$`),
            answer: { kind: 'set', values: [`${-k}`, `${k}`], label: 'K =' },
            hints: [
              L(
                'Která čísla dají po umocnění na druhou tento výsledek? Pozor, není jen jedno.',
                'Which numbers give this result when squared? Careful — there is more than one.',
              ),
              L(
                `$${k}^2 = ${k * k}$, ale také $(-${k})^2 = ${k * k}$.`,
                `$${k}^2 = ${k * k}$, but also $(-${k})^2 = ${k * k}$.`,
              ),
            ],
            solution: [
              step(
                'Odmocníme — a nezapomeneme na obě znaménka:',
                'Take the square root — with both signs:',
                `x = \\pm ${k}`,
              ),
            ],
            verify: [{ kind: 'roots', expr: `x^2-${k * k}` }],
          };
        }
        const b = nz(r, -8, 8);
        return {
          prompt: L(
            `Řešte v $\\mathbb{R}$: $${polyTex([1, b, 0])} = 0$`,
            `Solve in $\\mathbb{R}$: $${polyTex([1, b, 0])} = 0$`,
          ),
          answer: { kind: 'set', values: ['0', `${-b}`], label: 'K =' },
          hints: [
            L('Chybí absolutní člen — dá se vytknout $x$.', 'There is no constant term — you can take out $x$.'),
            L(
              `$x(${shiftTex(-b)}) = 0$. Součin je nula, když je nulový některý činitel.`,
              `$x(${shiftTex(-b)}) = 0$. A product is zero when one of its factors is zero.`,
            ),
          ],
          solution: [
            step('Vytkneme $x$:', 'Take out $x$:', `x(${shiftTex(-b)}) = 0`),
            step('Každý činitel položíme roven nule:', 'Set each factor to zero:', `x = 0 \\;\\lor\\; x = ${-b}`),
          ],
          misconceptions: [
            mc(
              `${-b}`,
              'incomplete',
              'Vydělením rovnice výrazem $x$ se ztratil kořen $x = 0$. Neděl — vytýkej.',
              'Dividing the equation by $x$ lost the root $x = 0$. Do not divide — factor out.',
            ),
          ],
          verify: [{ kind: 'roots', expr: polyIn([1, b, 0]) }],
        };
      }
      if (lv === 2) {
        const [r1, r2] = distinct(r, -7, 7, 2) as [number, number];
        const coeffs = [1, -(r1 + r2), r1 * r2];
        const D = (r1 - r2) ** 2;
        return {
          prompt: L(
            `Řešte v $\\mathbb{R}$: $${polyTex(coeffs)} = 0$`,
            `Solve in $\\mathbb{R}$: $${polyTex(coeffs)} = 0$`,
          ),
          answer: { kind: 'set', values: [`${r1}`, `${r2}`], label: 'K =' },
          hints: [
            L(
              'Zkus rozklad na součin: hledej dvě čísla podle součinu a součtu. Nebo použij diskriminant.',
              'Try factoring: look for two numbers by product and sum. Or use the discriminant.',
            ),
            L(
              `$D = b^2 - 4ac = ${D}$, takže $\\sqrt{D} = ${Math.abs(r1 - r2)}$.`,
              `$D = b^2 - 4ac = ${D}$, so $\\sqrt{D} = ${Math.abs(r1 - r2)}$.`,
            ),
            L(
              `Rozklad: $(${shiftTex(r1)})(${shiftTex(r2)}) = 0$.`,
              `Factored: $(${shiftTex(r1)})(${shiftTex(r2)}) = 0$.`,
            ),
          ],
          solution: [
            step('Diskriminant:', 'Discriminant:', `D = ${par(-(r1 + r2))}^2 - 4\\cdot 1\\cdot ${par(r1 * r2)} = ${D}`),
            step('Kořeny:', 'Roots:', `x_{1,2} = \\frac{${r1 + r2} \\pm ${Math.abs(r1 - r2)}}{2}`),
            step(
              'Tedy:',
              'So:',
              mapL(setL([Math.min(r1, r2), Math.max(r1, r2)]), (set) => `K = ${set}`),
            ),
          ],
          verify: [{ kind: 'roots', expr: polyIn(coeffs) }],
        };
      }
      if (lv === 3) {
        const q = r.pick([2, 3, 4]);
        const p = r.pick([1, 3, 5, 7, -1, -3, -5].filter((v) => Math.abs(v) % q !== 0 && (q !== 4 || v % 2 !== 0)));
        const s = r.intExcept(-5, 5, [0]);
        // (q·x − p)(x − s) = q·x² − (p + q·s)·x + p·s
        const coeffs = [q, -(p + q * s), p * s];
        const D = (p - q * s) ** 2;
        const root = frac(p, q);
        return {
          prompt: L(
            `Řešte v $\\mathbb{R}$: $${polyTex(coeffs)} = 0$`,
            `Solve in $\\mathbb{R}$: $${polyTex(coeffs)} = 0$`,
          ),
          answer: { kind: 'set', values: [fToInput(root), `${s}`], label: 'K =' },
          hints: [
            L(
              'Koeficient u $x^2$ není 1, takže hádání kořenů je těžší. Použij diskriminant.',
              'The coefficient of $x^2$ is not 1, so guessing roots is harder. Use the discriminant.',
            ),
            L(
              `$a = ${q}$, $b = ${-(p + q * s)}$, $c = ${p * s}$. $D = ${D}$.`,
              `$a = ${q}$, $b = ${-(p + q * s)}$, $c = ${p * s}$. $D = ${D}$.`,
            ),
            L(`Ve jmenovateli je $2a = ${2 * q}$, ne $2$.`, `The denominator is $2a = ${2 * q}$, not $2$.`),
          ],
          solution: [
            step(
              'Diskriminant:',
              'Discriminant:',
              `D = ${par(-(p + q * s))}^2 - 4\\cdot ${q}\\cdot ${par(p * s)} = ${D}`,
            ),
            step(
              'Dosadíme do vzorce:',
              'Substitute into the formula:',
              `x_{1,2} = \\frac{${p + q * s} \\pm ${Math.abs(p - q * s)}}{${2 * q}}`,
            ),
            step('Kořeny:', 'Roots:', `x_1 = ${fToTex(root)},\\quad x_2 = ${s}`),
          ],
          misconceptions: [
            mc(
              `${fToInput(frac(p + q * s + Math.abs(p - q * s), 2))}; ${fToInput(frac(p + q * s - Math.abs(p - q * s), 2))}`,
              'formula',
              'Ve jmenovateli vzorce je $2a$, ne jen $2$.',
              'The denominator of the formula is $2a$, not just $2$.',
            ),
            mc(
              `${fToInput(fNeg(root))}; ${-s}`,
              'sign',
              'Ve vzorci je $-b$. Když je $b$ záporné, je $-b$ kladné.',
              'The formula has $-b$. When $b$ is negative, $-b$ is positive.',
            ),
          ],
          verify: [{ kind: 'roots', expr: polyIn(coeffs) }],
        };
      }
      // Level 4: needs rearranging first; may have no or one real solution.
      const variant = r.weighted([
        ['two', 5],
        ['none', 2],
        ['double', 2],
      ] as const);
      const m = r.int(-4, 4);
      const d = nz(r, -4, 4);
      const e = r.int(-6, 6);
      let coeffs: number[];
      let values: string[];
      if (variant === 'two') {
        const [r1, r2] = distinct(r, -6, 6, 2) as [number, number];
        coeffs = [1, -(r1 + r2), r1 * r2];
        values = [`${r1}`, `${r2}`];
      } else if (variant === 'double') {
        coeffs = [1, -2 * m, m * m];
        values = [`${m}`];
      } else {
        const q = r.int(1, 6);
        coeffs = [1, -2 * m, m * m + q];
        values = [];
      }
      // Present as x² + (b + d)x + (c + e) = d·x + e
      const lhs = polyTex([1, coeffs[1]! + d, coeffs[2]! + e]);
      const rhs = polyTex([d, e]);
      const D = coeffs[1]! ** 2 - 4 * coeffs[2]!;
      return {
        prompt: L(`Řešte v $\\mathbb{R}$: $${lhs} = ${rhs}$`, `Solve in $\\mathbb{R}$: $${lhs} = ${rhs}$`),
        answer: { kind: 'set', values, label: 'K =', placeholder: '{…} / {}' },
        hints: [
          L(
            'Vzorec platí jen pro rovnici s nulou na jedné straně. Nejdřív vše převeď doleva.',
            'The formula works only with zero on one side. Move everything to the left first.',
          ),
          L(
            `Po úpravě: $${polyTex(coeffs)} = 0$. Spočítej diskriminant.`,
            `After rearranging: $${polyTex(coeffs)} = 0$. Compute the discriminant.`,
          ),
          L(`$D = ${D}$. Co to říká o počtu řešení?`, `$D = ${D}$. What does that say about the number of solutions?`),
        ],
        solution: [
          step('Převedeme vše na levou stranu:', 'Move everything to the left:', `${polyTex(coeffs)} = 0`),
          step('Diskriminant:', 'Discriminant:', `D = ${par(coeffs[1]!)}^2 - 4\\cdot ${par(coeffs[2]!)} = ${D}`),
          variant === 'none'
            ? step(
                '$D < 0$, rovnice nemá v $\\mathbb{R}$ řešení.',
                '$D < 0$, so there is no real solution.',
                'K = \\emptyset',
              )
            : variant === 'double'
              ? step('$D = 0$, jeden dvojnásobný kořen:', '$D = 0$, one double root:', `x = ${m}`)
              : step(
                  'Dva kořeny:',
                  'Two roots:',
                  mapL(setL(values.map(Number).sort((u, v) => u - v)), (set) => `K = ${set}`),
                ),
        ],
        verify: [{ kind: 'roots', expr: `${polyIn([1, coeffs[1]! + d, coeffs[2]! + e])}-(${polyIn([d, e])})` }],
      };
    },
  }),

  gen({
    id: 'alg.quad-eq.discriminant',
    concept: 'alg.quad-eq',
    kind: 'core',
    levels: [2, 3],
    title: L('Diskriminant a počet řešení', 'Discriminant and the number of solutions'),
    est: (lv) => 50 + 30 * lv,
    make(r, lv) {
      if (lv === 2) {
        const a = r.pick([1, 1, 2, -1, 3]);
        const b = r.int(-6, 6);
        const c = r.int(-5, 6);
        const D = b * b - 4 * a * c;
        const count = D > 0 ? 2 : D === 0 ? 1 : 0;
        const shown = polyTex([a, b, c]);
        return {
          prompt: L(
            `Kolik reálných řešení má rovnice $${shown} = 0$?`,
            `How many real solutions does $${shown} = 0$ have?`,
          ),
          answer: {
            kind: 'choice',
            fixedOrder: true,
            options: [
              { id: '0', text: L('žádné', 'none') },
              { id: '1', text: L('jedno', 'one') },
              { id: '2', text: L('dvě', 'two') },
            ],
            correct: [`${count}`],
          },
          hints: [
            L(
              'Rovnici nemusíš řešit. O počtu řešení rozhoduje jediné číslo.',
              'You do not have to solve it. A single number decides how many solutions there are.',
            ),
            L(
              `$D = b^2 - 4ac$ s $a = ${a}$, $b = ${b}$, $c = ${c}$.`,
              `$D = b^2 - 4ac$ with $a = ${a}$, $b = ${b}$, $c = ${c}$.`,
            ),
          ],
          solution: [
            step('Diskriminant:', 'Discriminant:', `D = ${par(b)}^2 - 4\\cdot ${par(a)}\\cdot ${par(c)} = ${D}`),
            step(
              D > 0
                ? '$D > 0$: dvě různá řešení.'
                : D === 0
                  ? '$D = 0$: jedno (dvojnásobné) řešení.'
                  : '$D < 0$: žádné reálné řešení.',
              D > 0
                ? '$D > 0$: two distinct solutions.'
                : D === 0
                  ? '$D = 0$: one (double) solution.'
                  : '$D < 0$: no real solution.',
            ),
          ],
        };
      }
      const b = 2 * nz(r, -5, 5);
      const c = (b * b) / 4;
      return {
        prompt: L(
          `Pro kterou hodnotu parametru $c$ má rovnice $${polyTex([1, b, 0])} + c = 0$ právě jedno reálné řešení?`,
          `For which value of the parameter $c$ does $${polyTex([1, b, 0])} + c = 0$ have exactly one real solution?`,
        ),
        answer: { kind: 'number', value: `${c}`, label: 'c =' },
        hints: [
          L(
            'Právě jedno řešení znamená podmínku na diskriminant. Jakou?',
            'Exactly one solution is a condition on the discriminant. Which one?',
          ),
          L(`$D = ${par(b)}^2 - 4c = 0$. Vyřeš pro $c$.`, `$D = ${par(b)}^2 - 4c = 0$. Solve for $c$.`),
        ],
        solution: [
          step('Jedno řešení právě když $D = 0$:', 'One solution exactly when $D = 0$:', `${b * b} - 4c = 0`),
          step('Odtud:', 'Hence:', `c = ${c}`),
          step(
            `Pak je levá strana úplný čtverec $(${shiftTex(-b / 2)})^2$.`,
            `The left side is then the perfect square $(${shiftTex(-b / 2)})^2$.`,
          ),
        ],
        misconceptions: [
          mc(
            `${-c}`,
            'sign',
            'Z $b^2 - 4c = 0$ plyne $c = \\frac{b^2}{4}$ — kladné číslo.',
            'From $b^2 - 4c = 0$ you get $c = \\frac{b^2}{4}$ — a positive number.',
          ),
          mc(`${b * b}`, 'arithmetic', 'Ještě vydělit čtyřmi.', 'Still to be divided by four.'),
        ],
        verify: [{ kind: 'value', expr: `(${b})^2/4` }],
      };
    },
  }),

  // ------------------------------------------------------------------ completing the square
  gen({
    id: 'alg.complete-square.do',
    concept: 'alg.complete-square',
    kind: 'core',
    levels: [2, 3],
    title: L('Doplnění na čtverec', 'Completing the square'),
    est: (lv) => 50 + 35 * lv,
    make(r, lv) {
      const a = lv === 2 ? 1 : r.pick([2, 3, -1, -2]);
      const m = nz(r, -5, 5);
      const n = r.int(-8, 8);
      // a(x − m)² + n = a·x² − 2am·x + (a·m² + n)
      const coeffs = [a, -2 * a * m, a * m * m + n];
      const answer = `${a === 1 ? '' : a === -1 ? '-' : `${a}*`}(${shiftIn(m)})^2${tailIn(n)}`;
      const shown = `${a === 1 ? '' : a === -1 ? '-' : a}(${shiftTex(m)})^2${tailTex(n)}`;
      return {
        prompt: L(
          `Doplňte na čtverec, tj. zapište ve tvaru $a(x - m)^2 + n$: $${polyTex(coeffs)}$`,
          `Complete the square, i.e. write in the form $a(x - m)^2 + n$: $${polyTex(coeffs)}$`,
        ),
        answer: { kind: 'expr', value: answer, vars: ['x'], form: 'vertex', placeholder: '(x-1)^2+3' },
        hints: [
          a === 1
            ? L(
                `Vezmi polovinu koeficientu u $x$: $\\frac{${-2 * m}}{2} = ${-m}$. To bude v závorce.`,
                `Take half of the coefficient of $x$: $\\frac{${-2 * m}}{2} = ${-m}$. That goes in the bracket.`,
              )
            : L(
                `Nejdřív vytkni $${a}$ z prvních dvou členů: $${a}(${polyTex([1, -2 * m, 0])})$.`,
                `First take $${a}$ out of the first two terms: $${a}(${polyTex([1, -2 * m, 0])})$.`,
              ),
          L(
            `$(${shiftTex(m)})^2 = ${polyTex([1, -2 * m, m * m])}$ — má navíc $${m * m}$, které musíš zase odečíst.`,
            `$(${shiftTex(m)})^2 = ${polyTex([1, -2 * m, m * m])}$ — it has an extra $${m * m}$ that you must subtract again.`,
          ),
          HINT.check,
        ],
        solution: [
          ...(a === 1
            ? []
            : [
                step(
                  `Vytkneme $${a}$:`,
                  `Take out $${a}$:`,
                  `${a}\\left(${polyTex([1, -2 * m, 0])}\\right) ${tailTex(a * m * m + n)}`,
                ),
              ]),
          step(
            'Doplníme a odečteme čtverec poloviny lineárního koeficientu:',
            'Add and subtract the square of half the linear coefficient:',
            `${a === 1 ? '' : a}\\left[(${shiftTex(m)})^2 - ${m * m}\\right] ${tailTex(a * m * m + n)}`,
          ),
          step('Upravíme:', 'Simplify:', shown),
        ],
        misconceptions: [
          mc(
            `${a === 1 ? '' : a === -1 ? '-' : `${a}*`}(${shiftIn(m)})^2${tailIn(a * m * m + n)}`,
            'algebra',
            'Doplněný čtverec jsi zapomněl odečíst.',
            'You forgot to subtract the square you added.',
          ),
          mc(
            `${a === 1 ? '' : a === -1 ? '-' : `${a}*`}(${shiftIn(-m)})^2${tailIn(n)}`,
            'sign',
            'Znaménko v závorce je obráceně.',
            'The sign inside the bracket is reversed.',
          ),
          mc(
            `${a === 1 ? '' : a === -1 ? '-' : `${a}*`}(${shiftIn(2 * m)})^2${tailIn(n)}`,
            'formula',
            'Do závorky patří polovina lineárního koeficientu, ne celý.',
            'Half of the linear coefficient goes into the bracket, not all of it.',
          ),
        ],
        verify: [{ kind: 'equiv', expr: polyIn(coeffs), vars: ['x'] }],
      };
    },
  }),

  // ------------------------------------------------------------------------------ powers
  gen({
    id: 'alg.powers.rules',
    concept: 'alg.powers',
    kind: 'core',
    levels: [1, 2, 3],
    title: L('Počítání s mocninami', 'Working with powers'),
    est: (lv) => 35 + 25 * lv,
    make(r, lv) {
      if (lv === 1) {
        const base = r.pick([2, 3, 5, 10]);
        const m = r.int(2, 7);
        const n = r.int(2, 6);
        const k = r.int(1, 5);
        const e = m + n - k;
        return {
          prompt: L(
            `Výraz $\\dfrac{${base}^{${m}} \\cdot ${base}^{${n}}}{${base}^{${k}}}$ lze zapsat jako $${base}^n$. Určete $n$.`,
            `The expression $\\dfrac{${base}^{${m}} \\cdot ${base}^{${n}}}{${base}^{${k}}}$ can be written as $${base}^n$. Find $n$.`,
          ),
          answer: { kind: 'number', value: `${e}`, label: 'n =' },
          hints: [
            L(
              'Při násobení mocnin se stejným základem se exponenty sčítají, při dělení odčítají.',
              'Multiplying powers of the same base adds the exponents; dividing subtracts them.',
            ),
            L(`Exponent je $${m} + ${n} - ${k}$.`, `The exponent is $${m} + ${n} - ${k}$.`),
          ],
          solution: [
            step(
              'Sečteme a odečteme exponenty:',
              'Add and subtract the exponents:',
              `${base}^{${m} + ${n} - ${k}} = ${base}^{${e}}`,
            ),
          ],
          misconceptions: [
            mc(
              `${m * n - k}`,
              'formula',
              'Exponenty se při násobení mocnin sčítají, ne násobí.',
              'Exponents add when powers are multiplied; they do not multiply.',
            ),
            mc(`${m + n + k}`, 'sign', 'Při dělení se exponent odčítá.', 'Division subtracts the exponent.'),
          ],
        };
      }
      if (lv === 2) {
        const item = r.pick([
          { tex: '2^{-3}', value: frac(1, 8), wrong: '-8' },
          { tex: '5^{-2}', value: frac(1, 25), wrong: '-25' },
          { tex: '\\left(\\frac{1}{2}\\right)^{-3}', value: frac(8), wrong: '1/8' },
          { tex: '\\left(\\frac{2}{3}\\right)^{-2}', value: frac(9, 4), wrong: '4/9' },
          { tex: '10^{-3}', value: frac(1, 1000), wrong: '-1000' },
          { tex: '\\left(\\frac{3}{4}\\right)^{-1}', value: frac(4, 3), wrong: '-3/4' },
          { tex: '4^{-1} \\cdot 4^{3}', value: frac(16), wrong: '1/64' },
          { tex: '\\left(3^{-1}\\right)^{-2}', value: frac(9), wrong: '1/9' },
        ]);
        return {
          prompt: L(`Vypočítejte přesně: $${item.tex}$`, `Evaluate exactly: $${item.tex}$`),
          answer: { kind: 'number', value: fToInput(item.value) },
          hints: [
            L(
              'Záporný exponent neznamená záporný výsledek. Znamená převrácenou hodnotu.',
              'A negative exponent does not mean a negative result. It means a reciprocal.',
            ),
            L(
              '$a^{-n} = \\dfrac{1}{a^n}$ a $\\left(\\dfrac{a}{b}\\right)^{-n} = \\left(\\dfrac{b}{a}\\right)^{n}$.',
              '$a^{-n} = \\dfrac{1}{a^n}$ and $\\left(\\dfrac{a}{b}\\right)^{-n} = \\left(\\dfrac{b}{a}\\right)^{n}$.',
            ),
          ],
          solution: [
            step(
              'Záporný exponent = převrácená hodnota:',
              'Negative exponent = reciprocal:',
              `${item.tex} = ${fToTex(item.value)}`,
            ),
          ],
          misconceptions: [
            mc(
              item.wrong,
              'concept',
              'Záporný exponent převrací zlomek; znaménko výsledku nemění.',
              'A negative exponent inverts the fraction; it does not change the sign of the result.',
            ),
          ],
        };
      }
      const item = r.pick([
        { tex: '27^{\\frac{2}{3}}', value: frac(9), root: '\\sqrt[3]{27} = 3', then: '3^2 = 9' },
        { tex: '16^{\\frac{3}{4}}', value: frac(8), root: '\\sqrt[4]{16} = 2', then: '2^3 = 8' },
        { tex: '8^{-\\frac{2}{3}}', value: frac(1, 4), root: '\\sqrt[3]{8} = 2', then: '2^{-2} = \\frac{1}{4}' },
        { tex: '25^{\\frac{3}{2}}', value: frac(125), root: '\\sqrt{25} = 5', then: '5^3 = 125' },
        { tex: '32^{\\frac{2}{5}}', value: frac(4), root: '\\sqrt[5]{32} = 2', then: '2^2 = 4' },
        {
          tex: '\\left(\\frac{8}{27}\\right)^{-\\frac{2}{3}}',
          value: frac(9, 4),
          root: '\\sqrt[3]{\\frac{8}{27}} = \\frac{2}{3}',
          then: '\\left(\\frac{2}{3}\\right)^{-2} = \\frac{9}{4}',
        },
        { tex: '81^{-\\frac{1}{4}}', value: frac(1, 3), root: '\\sqrt[4]{81} = 3', then: '3^{-1} = \\frac{1}{3}' },
        { tex: '4^{\\frac{5}{2}}', value: frac(32), root: '\\sqrt{4} = 2', then: '2^5 = 32' },
      ]);
      return {
        prompt: L(
          `Vypočítejte přesně, bez kalkulačky: $${item.tex}$`,
          `Evaluate exactly, without a calculator: $${item.tex}$`,
        ),
        answer: { kind: 'number', value: fToInput(item.value) },
        hints: [
          L(
            'Jmenovatel exponentu je odmocnina, čitatel mocnina: $a^{\\frac{m}{n}} = \\left(\\sqrt[n]{a}\\right)^m$.',
            'The denominator of the exponent is a root, the numerator a power: $a^{\\frac{m}{n}} = \\left(\\sqrt[n]{a}\\right)^m$.',
          ),
          L(
            `Nejdřív odmocni — čísla zůstanou malá: $${item.root}$.`,
            `Take the root first — the numbers stay small: $${item.root}$.`,
          ),
        ],
        solution: [
          step('Nejdřív odmocnina:', 'Root first:', item.root),
          step('Potom mocnina:', 'Then the power:', item.then),
        ],
      };
    },
  }),

  // ----------------------------------------------------------------------- absolute value
  gen({
    id: 'alg.abs-value.distance',
    concept: 'alg.abs-value',
    kind: 'core',
    levels: [1, 2, 3],
    title: L('Absolutní hodnota jako vzdálenost', 'Absolute value as distance'),
    est: (lv) => 30 + 25 * lv,
    make(r, lv) {
      if (lv === 1) {
        const a = r.int(-9, 9);
        const b = r.intExcept(-9, 9, [a]);
        const c = nz(r, -6, 6);
        const value = Math.abs(a - b) - Math.abs(c);
        return {
          prompt: L(`Vypočítejte: $|${a} - ${par(b)}| - |${c}|$`, `Evaluate: $|${a} - ${par(b)}| - |${c}|$`),
          answer: { kind: 'number', value: `${value}` },
          hints: [
            L(
              'Nejdřív spočítej vnitřek každé absolutní hodnoty, teprve potom ji odstraň.',
              'First compute the inside of each absolute value; only then remove it.',
            ),
            L(
              `$${a} - ${par(b)} = ${a - b}$. Absolutní hodnota je vzdálenost od nuly.`,
              `$${a} - ${par(b)} = ${a - b}$. The absolute value is the distance from zero.`,
            ),
          ],
          solution: [
            step('Vnitřky:', 'Insides:', `|${a - b}| - |${c}|`),
            step('Absolutní hodnoty:', 'Absolute values:', `${Math.abs(a - b)} - ${Math.abs(c)} = ${value}`),
          ],
          misconceptions: [
            mc(
              `${Math.abs(a) - Math.abs(b) - Math.abs(c)}`,
              'algebra',
              '$|a - b| \\ne |a| - |b|$. Nejdřív odečti, potom dělej absolutní hodnotu.',
              '$|a - b| \\ne |a| - |b|$. Subtract first, then take the absolute value.',
            ),
            mc(
              `${Math.abs(a - b) + Math.abs(c)}`,
              'sign',
              'Minus mezi absolutními hodnotami zůstává.',
              'The minus between the absolute values stays.',
            ),
          ],
          verify: [{ kind: 'value', expr: `abs(${a}-(${b}))-abs(${c})` }],
        };
      }
      if (lv === 2) {
        const a = r.int(-7, 7);
        const d = r.int(1, 8);
        return {
          prompt: L(
            `Která čísla mají na číselné ose od čísla $${a}$ vzdálenost právě $${d}$? Jinak řečeno, řešte $|${shiftTex(a)}| = ${d}$.`,
            `Which numbers lie at distance exactly $${d}$ from $${a}$ on the number line? In other words, solve $|${shiftTex(a)}| = ${d}$.`,
          ),
          answer: { kind: 'set', values: [`${a - d}`, `${a + d}`], label: 'K =' },
          hints: [
            L(
              `Představ si číselnou osu. Od čísla $${a}$ jdi $${d}$ kroků — ale kterým směrem?`,
              `Picture the number line. From $${a}$ go $${d}$ steps — but in which direction?`,
            ),
            L('Oběma směry. Řešení jsou dvě.', 'Both directions. There are two solutions.'),
          ],
          solution: [
            step(
              `Od $${a}$ o $${d}$ doleva a o $${d}$ doprava:`,
              `From $${a}$, go $${d}$ to the left and $${d}$ to the right:`,
              `x = ${a} - ${d} = ${a - d} \\;\\lor\\; x = ${a} + ${d} = ${a + d}`,
            ),
          ],
          misconceptions: [
            mc(
              `${-a - d}; ${-a + d}`,
              'sign',
              `$|x ${a >= 0 ? '-' : '+'} ${Math.abs(a)}|$ je vzdálenost od čísla $${a}$, ne od $${-a}$.`,
              `$|x ${a >= 0 ? '-' : '+'} ${Math.abs(a)}|$ is the distance from $${a}$, not from $${-a}$.`,
            ),
          ],
          verify: [{ kind: 'roots', expr: `abs(${shiftIn(a)})-${d}` }],
        };
      }
      const a = r.int(-8, 4);
      const b = a + 2 * r.int(1, 5) + r.pick([0, 1]);
      const mid = frac(a + b, 2);
      return {
        prompt: L(
          `Řešte v $\\mathbb{R}$: $|${shiftTex(a)}| = |${shiftTex(b)}|$. (Nápověda je v zadání: co ta rovnice říká o vzdálenostech?)`,
          `Solve in $\\mathbb{R}$: $|${shiftTex(a)}| = |${shiftTex(b)}|$. (The equation itself is a hint: what does it say about distances?)`,
        ),
        answer: { kind: 'set', values: [fToInput(mid)], label: 'K =' },
        hints: [
          L(
            `Levá strana je vzdálenost $x$ od $${a}$, pravá vzdálenost $x$ od $${b}$.`,
            `The left side is the distance of $x$ from $${a}$, the right side its distance from $${b}$.`,
          ),
          L('Který bod je od dvou daných bodů stejně daleko?', 'Which point is equally far from two given points?'),
        ],
        solution: [
          step(
            `Hledáme bod stejně vzdálený od $${a}$ a od $${b}$ — jejich střed:`,
            `We want the point equidistant from $${a}$ and $${b}$ — their midpoint:`,
            `x = \\frac{${a} + ${par(b)}}{2} = ${fToTex(mid)}`,
          ),
          step(
            'Algebraicky: $x - a = x - b$ nemá řešení, $x - a = -(x - b)$ dává totéž.',
            'Algebraically: $x - a = x - b$ has no solution; $x - a = -(x - b)$ gives the same.',
          ),
        ],
        verify: [{ kind: 'roots', expr: `abs(${shiftIn(a)})-abs(${shiftIn(b)})` }],
      };
    },
  }),

  // --------------------------------------------------------------------- function concept
  gen({
    id: 'fn.concept.evaluate',
    concept: 'fn.concept',
    kind: 'warmup',
    levels: [1, 2, 3],
    title: L('Funkční hodnota', 'Evaluating a function'),
    est: (lv) => 25 + 25 * lv,
    make(r, lv) {
      const x0 = lv === 1 ? r.int(-6, 6) : -r.int(1, 5);
      const a = lv === 1 ? 0 : r.pick([1, 2, 3, -1, -2]);
      const b = nz(r, -5, 5);
      const c = r.int(-6, 6);
      const coeffs = lv === 1 ? [b, c] : [a, b, c];
      const f = (x: number): number => coeffs.reduce((acc, k) => acc * x + k, 0);
      if (lv === 3) {
        const h = r.pick([1, 2]);
        const value = f(x0 + h) - f(x0);
        return {
          prompt: L(
            `Je dána funkce $f(x) = ${polyTex(coeffs)}$. Vypočítejte $f(${x0 + h}) - f(${x0})$.`,
            `Let $f(x) = ${polyTex(coeffs)}$. Compute $f(${x0 + h}) - f(${x0})$.`,
          ),
          answer: { kind: 'number', value: `${value}` },
          hints: [
            L(
              'Spočítej každou funkční hodnotu zvlášť a teprve potom odečti.',
              'Compute each function value separately and only then subtract.',
            ),
            L(`$f(${x0}) = ${f(x0)}$. Teď $f(${x0 + h})$.`, `$f(${x0}) = ${f(x0)}$. Now $f(${x0 + h})$.`),
            HINT.brackets,
          ],
          solution: [
            step('První hodnota:', 'First value:', `f(${x0 + h}) = ${f(x0 + h)}`),
            step('Druhá hodnota:', 'Second value:', `f(${x0}) = ${f(x0)}`),
            step('Rozdíl:', 'Difference:', `${f(x0 + h)} - ${par(f(x0))} = ${value}`),
          ],
          misconceptions: [
            mc(
              `${f(x0 + h) + f(x0)}`,
              'sign',
              'Odečítáš záporné číslo? Pak se přičítá.',
              'Subtracting a negative number? Then it is added.',
            ),
          ],
        };
      }
      const value = f(x0);
      const wrongSquare = lv === 2 ? a * -(x0 * x0) + b * x0 + c : value;
      return {
        prompt: L(
          `Je dána funkce $f(x) = ${polyTex(coeffs)}$. Vypočítejte $f(${x0})$.`,
          `Let $f(x) = ${polyTex(coeffs)}$. Compute $f(${x0})$.`,
        ),
        answer: { kind: 'number', value: `${value}`, label: `f(${x0}) =` },
        hints: [
          L(
            `Za každé $x$ v předpisu dosaď $${par(x0)}$ — i se závorkou.`,
            `Replace every $x$ in the formula by $${par(x0)}$ — brackets included.`,
          ),
          lv === 2
            ? L(`$${par(x0)}^2 = ${x0 * x0}$, ne $${-(x0 * x0)}$.`, `$${par(x0)}^2 = ${x0 * x0}$, not $${-(x0 * x0)}$.`)
            : HINT.brackets,
        ],
        solution: [
          step(
            'Dosadíme:',
            'Substitute:',
            lv === 1
              ? `${nTex(b)}\\cdot${par(x0)} ${tailTex(c)}`
              : `${nTex(a)}\\cdot${par(x0)}^2 ${tailTex(b)}\\cdot${par(x0)} ${tailTex(c)}`,
          ),
          step('Vypočítáme:', 'Evaluate:', `${value}`),
        ],
        misconceptions: [
          mc(
            `${wrongSquare}`,
            'sign',
            'Záporné číslo se umocňuje i se znaménkem: $(-3)^2 = 9$, ale $-3^2 = -9$.',
            'A negative number is squared together with its sign: $(-3)^2 = 9$, but $-3^2 = -9$.',
          ),
          mc(
            `${f(-x0)}`,
            'sign',
            'Dosadil jsi číslo s opačným znaménkem.',
            'You substituted the number with the opposite sign.',
          ),
        ],
        verify: [{ kind: 'value', expr: polyIn(coeffs), env: { x: x0 } }],
      };
    },
  }),

  gen({
    id: 'fn.concept.domain',
    concept: 'fn.concept',
    kind: 'core',
    levels: [2, 3],
    title: L('Definiční obor', 'Domain of a function'),
    est: (lv) => 45 + 30 * lv,
    make(r, lv) {
      const variant =
        lv === 2 ? r.pick(['frac', 'sqrt'] as const) : r.pick(['two-poles', 'inv-sqrt', 'two-roots'] as const);
      if (variant === 'frac') {
        const c = nz(r, -6, 6);
        const a = nz(r, -4, 4);
        const b = r.int(-5, 5);
        const tex = `\\dfrac{${polyTex([a, b])}}{${shiftTex(c)}}`;
        return {
          prompt: L(`Určete definiční obor funkce $f(x) = ${tex}$.`, `Find the domain of $f(x) = ${tex}$.`),
          answer: { kind: 'interval', value: `R \\ {${c}}`, label: 'D(f) =', placeholder: 'R \\ {2}' },
          hints: [
            L(
              'Jaká operace tu může „selhat“? Čím se nesmí dělit?',
              'Which operation here can “fail”? What must you never divide by?',
            ),
            L(`Jmenovatel $${shiftTex(c)}$ nesmí být nula.`, `The denominator $${shiftTex(c)}$ must not be zero.`),
          ],
          solution: [
            step(
              'Jmenovatel nesmí být nula:',
              'The denominator must not be zero:',
              `${shiftTex(c)} \\ne 0 \\iff x \\ne ${c}`,
            ),
            step('Definiční obor:', 'Domain:', `D(f) = \\mathbb{R} \\setminus \\{${c}\\}`),
          ],
          misconceptions: [
            mc(
              `R \\ {${-c}}`,
              'sign',
              'Jmenovatel je nula pro $x$, které řeší rovnici „jmenovatel = 0“. Zkontroluj znaménko.',
              'The denominator is zero for the $x$ solving “denominator = 0”. Check the sign.',
            ),
            mc(
              `R \\ {${fToInput(frac(-b, a))}}`,
              'misread',
              'To je nulový bod čitatele. Ten definiční obor neomezuje.',
              'That is the zero of the numerator. It does not restrict the domain.',
            ),
          ],
          verify: [{ kind: 'domain', expr: `(${polyIn([a, b])})/(${shiftIn(c)})` }],
        };
      }
      if (variant === 'sqrt') {
        const a = nz(r, -3, 3);
        const x0 = r.int(-5, 5);
        const b = -a * x0;
        const value = a > 0 ? intervalIn(x0, 'inf', true, false) : intervalIn('-inf', x0, false, true);
        const shown = a > 0 ? intervalL(x0, 'inf', true, false) : intervalL('-inf', x0, false, true);
        return {
          prompt: L(
            `Určete definiční obor funkce $f(x) = \\sqrt{${polyTex([a, b])}}$.`,
            `Find the domain of $f(x) = \\sqrt{${polyTex([a, b])}}$.`,
          ),
          answer: { kind: 'interval', value, label: 'D(f) =' },
          hints: [
            L('Co nesmí být pod druhou odmocninou?', 'What may not stand under a square root?'),
            L(`Řeš nerovnici $${polyTex([a, b])} \\ge 0$.`, `Solve the inequality $${polyTex([a, b])} \\ge 0$.`),
            a < 0
              ? L(
                  'Dělíš záporným číslem — znak nerovnosti se otočí.',
                  'You divide by a negative number — the inequality sign flips.',
                )
              : L(
                  'Nula pod odmocninou je v pořádku: $\\sqrt{0} = 0$.',
                  'Zero under the root is fine: $\\sqrt{0} = 0$.',
                ),
          ],
          solution: [
            step(
              'Výraz pod odmocninou musí být nezáporný:',
              'The radicand must be non-negative:',
              `${polyTex([a, b])} \\ge 0`,
            ),
            step(
              a < 0 ? 'Dělíme záporným číslem, znak se otáčí:' : 'Vyřešíme:',
              a < 0 ? 'Dividing by a negative number flips the sign:' : 'Solve:',
              `x ${a > 0 ? '\\ge' : '\\le'} ${x0}`,
            ),
            step(
              'Definiční obor:',
              'Domain:',
              mapL(shown, (set) => `D(f) = ${set}`),
            ),
          ],
          verify: [{ kind: 'domain', expr: `sqrt(${polyIn([a, b])})` }],
        };
      }
      if (variant === 'two-poles') {
        const [p, q] = distinct(r, -5, 5, 2).sort((u, v) => u - v) as [number, number];
        const tex = `\\dfrac{x + 1}{${polyTex([1, -(p + q), p * q])}}`;
        return {
          prompt: L(`Určete definiční obor funkce $f(x) = ${tex}$.`, `Find the domain of $f(x) = ${tex}$.`),
          answer: { kind: 'interval', value: `R \\ {${p}; ${q}}`, label: 'D(f) =', placeholder: 'R \\ {1; 2}' },
          hints: [
            L(
              'Jmenovatel nesmí být nula. Kdy je kvadratický výraz roven nule?',
              'The denominator must not be zero. When is a quadratic expression zero?',
            ),
            L(`Vyřeš $${polyTex([1, -(p + q), p * q])} = 0$.`, `Solve $${polyTex([1, -(p + q), p * q])} = 0$.`),
          ],
          solution: [
            step(
              'Nulové body jmenovatele:',
              'Zeros of the denominator:',
              `${polyTex([1, -(p + q), p * q])} = (${shiftTex(p)})(${shiftTex(q)}) = 0`,
            ),
            step(
              'Obě čísla vyloučíme:',
              'Exclude both:',
              mapL(setL([p, q]), (set) => `D(f) = \\mathbb{R} \\setminus ${set}`),
            ),
          ],
          misconceptions: [
            mc(
              `R \\ {${-p}; ${-q}}`,
              'sign',
              'Kořeny mají opačná znaménka, než jsi zapsal.',
              'The roots have the opposite signs to what you wrote.',
            ),
          ],
          verify: [{ kind: 'domain', expr: `(x+1)/(${polyIn([1, -(p + q), p * q])})` }],
        };
      }
      if (variant === 'inv-sqrt') {
        const a = nz(r, -3, 3);
        const x0 = r.int(-5, 5);
        const b = -a * x0;
        const value = a > 0 ? intervalIn(x0, 'inf', false, false) : intervalIn('-inf', x0, false, false);
        const shown = a > 0 ? intervalL(x0, 'inf', false, false) : intervalL('-inf', x0, false, false);
        return {
          prompt: L(
            `Určete definiční obor funkce $f(x) = \\dfrac{1}{\\sqrt{${polyTex([a, b])}}}$.`,
            `Find the domain of $f(x) = \\dfrac{1}{\\sqrt{${polyTex([a, b])}}}$.`,
          ),
          answer: { kind: 'interval', value, label: 'D(f) =' },
          hints: [
            L(
              'Jsou tu dvě podmínky najednou: odmocnina a jmenovatel.',
              'There are two conditions at once: the root and the denominator.',
            ),
            L(
              'Pod odmocninou nesmí být záporné číslo, a navíc odmocnina nesmí vyjít nula.',
              'The radicand must not be negative, and in addition the root must not be zero.',
            ),
          ],
          solution: [
            step(
              'Obě podmínky dohromady dávají ostrou nerovnost:',
              'Both conditions together give a strict inequality:',
              `${polyTex([a, b])} > 0`,
            ),
            step(
              'Řešení:',
              'Solution:',
              mapL(shown, (set) => `D(f) = ${set}`),
            ),
          ],
          verify: [{ kind: 'domain', expr: `1/sqrt(${polyIn([a, b])})` }],
        };
      }
      const p = r.int(-6, 1);
      const q = p + r.int(2, 7);
      return {
        prompt: L(
          `Určete definiční obor funkce $f(x) = \\sqrt{${shiftTex(p)}} + \\sqrt{${q} - x}$.`,
          `Find the domain of $f(x) = \\sqrt{${shiftTex(p)}} + \\sqrt{${q} - x}$.`,
        ),
        answer: { kind: 'interval', value: intervalIn(p, q, true, true), label: 'D(f) =' },
        hints: [
          L(
            'Každá odmocnina dá jednu podmínku. Platit musí obě současně.',
            'Each root gives one condition. Both must hold at the same time.',
          ),
          L(
            `$x \\ge ${p}$ a zároveň $x \\le ${q}$. „Zároveň“ znamená průnik.`,
            `$x \\ge ${p}$ and also $x \\le ${q}$. “And” means intersection.`,
          ),
        ],
        solution: [
          step('První odmocnina:', 'First root:', `${shiftTex(p)} \\ge 0 \\iff x \\ge ${p}`),
          step('Druhá odmocnina:', 'Second root:', `${q} - x \\ge 0 \\iff x \\le ${q}`),
          step(
            'Průnik obou podmínek:',
            'Intersection of both:',
            mapL(intervalL(p, q, true, true), (set) => `D(f) = ${set}`),
          ),
        ],
        misconceptions: [
          mc(
            `(-inf; ${p}> u <${q}; inf)`,
            'concept',
            'Podmínky musí platit současně — to je průnik, ne sjednocení.',
            'The conditions must hold together — that is an intersection, not a union.',
          ),
        ],
        verify: [{ kind: 'domain', expr: `sqrt(${shiftIn(p)})+sqrt(${q}-x)` }],
      };
    },
  }),

  gen({
    id: 'fn.properties.parity',
    concept: 'fn.properties',
    kind: 'core',
    levels: [2, 3],
    title: L('Sudá, nebo lichá?', 'Even or odd?'),
    est: (lv) => 40 + 25 * lv,
    make(r, lv) {
      const k = r.int(1, 5);
      const pool = [
        { tex: `x^2 + ${k}`, parity: 'even', neg: `(-x)^2 + ${k} = x^2 + ${k}` },
        { tex: `x^3 - ${k}x`, parity: 'odd', neg: `(-x)^3 - ${k}(-x) = -x^3 + ${k}x` },
        { tex: `${k}|x|`, parity: 'even', neg: `${k}|-x| = ${k}|x|` },
        { tex: `x^2 + ${k}x`, parity: 'neither', neg: `x^2 - ${k}x` },
        { tex: `x^4 - ${k}x^2`, parity: 'even', neg: `x^4 - ${k}x^2` },
        { tex: `x^3 + ${k}`, parity: 'neither', neg: `-x^3 + ${k}` },
        { tex: `\\dfrac{${k}}{x}`, parity: 'odd', neg: `\\dfrac{${k}}{-x} = -\\dfrac{${k}}{x}` },
        ...(lv === 3
          ? [
              { tex: `x\\,|x|`, parity: 'odd', neg: `(-x)|-x| = -x|x|` },
              { tex: `|x - ${k}|`, parity: 'neither', neg: `|-x - ${k}| = |x + ${k}|` },
              { tex: `\\dfrac{x}{x^2 + ${k}}`, parity: 'odd', neg: `\\dfrac{-x}{x^2 + ${k}}` },
              { tex: `(x - ${k})^2`, parity: 'neither', neg: `(x + ${k})^2` },
              { tex: `\\dfrac{${k}}{x^2}`, parity: 'even', neg: `\\dfrac{${k}}{(-x)^2} = \\dfrac{${k}}{x^2}` },
            ]
          : []),
      ] as { tex: string; parity: 'even' | 'odd' | 'neither'; neg: string }[];
      const item = r.pick(pool);
      const verdict = {
        even: L('$f(-x) = f(x)$: funkce je sudá.', '$f(-x) = f(x)$: the function is even.'),
        odd: L('$f(-x) = -f(x)$: funkce je lichá.', '$f(-x) = -f(x)$: the function is odd.'),
        neither: L(
          'Nevyšlo ani $f(x)$, ani $-f(x)$: funkce není sudá ani lichá.',
          'Neither $f(x)$ nor $-f(x)$ came out: the function is neither.',
        ),
      }[item.parity];
      return {
        prompt: L(
          `Rozhodněte, zda je funkce $f(x) = ${item.tex}$ sudá, lichá, nebo ani jedno.`,
          `Decide whether $f(x) = ${item.tex}$ is even, odd, or neither.`,
        ),
        answer: {
          kind: 'choice',
          fixedOrder: true,
          options: [
            { id: 'even', text: L('sudá', 'even') },
            { id: 'odd', text: L('lichá', 'odd') },
            { id: 'neither', text: L('ani sudá, ani lichá', 'neither') },
          ],
          correct: [item.parity],
        },
        hints: [
          L('Dosaď $-x$ místo $x$ a uprav. Co vyjde?', 'Substitute $-x$ for $x$ and simplify. What do you get?'),
          L('Porovnej výsledek s $f(x)$ a s $-f(x)$.', 'Compare the result with $f(x)$ and with $-f(x)$.'),
        ],
        solution: [step('Dosadíme $-x$:', 'Substitute $-x$:', `f(-x) = ${item.neg}`), { text: verdict }],
        misconceptions:
          item.parity === 'neither'
            ? [
                mc(
                  'even',
                  'concept',
                  'Sudý exponent sám nestačí — sudé musí být všechny členy.',
                  'One even exponent is not enough — every term must be even.',
                ),
                mc(
                  'odd',
                  'concept',
                  'Konstanta (nebo sudý člen) lichost pokazí: zkus dosadit konkrétní číslo a jeho opačné.',
                  'A constant (or an even term) spoils oddness: try a specific number and its opposite.',
                ),
              ]
            : [],
      };
    },
  }),

  gen({
    id: 'fn.transform.shift',
    concept: 'fn.transform',
    kind: 'core',
    levels: [1, 2, 3],
    title: L('Posunutí grafu', 'Shifting a graph'),
    est: (lv) => 35 + 25 * lv,
    make(r, lv) {
      const base = r.pick([
        { tex: (inner: string) => `\\left(${inner}\\right)^2`, input: (inner: string) => `(${inner})^2`, name: 'x^2' },
        { tex: (inner: string) => `\\left|${inner}\\right|`, input: (inner: string) => `abs(${inner})`, name: '|x|' },
      ]);
      const m = nz(r, -5, 5);
      const n = nz(r, -5, 5);
      const horizontal = L(
        m > 0 ? `o ${m} doprava` : `o ${-m} doleva`,
        m > 0 ? `${m} to the right` : `${-m} to the left`,
      );
      const vertical = L(n > 0 ? `o ${n} nahoru` : `o ${-n} dolů`, n > 0 ? `${n} up` : `${-n} down`);
      if (lv === 1) {
        const shown = `${base.tex(shiftTex(m))}${tailTex(n)}`;
        return {
          prompt: L(
            `Graf funkce $y = ${shown}$ vznikne posunutím grafu $y = ${base.name}$. Kde bude ležet jeho vrchol?`,
            `The graph of $y = ${shown}$ is a shifted copy of $y = ${base.name}$. Where is its vertex?`,
          ),
          answer: { kind: 'point', coords: [`${m}`, `${n}`], label: 'V =', placeholder: '[2; -1]' },
          hints: [
            L(
              `Vrchol grafu $y = ${base.name}$ je v počátku. Kam se posune?`,
              `The vertex of $y = ${base.name}$ is at the origin. Where does it move?`,
            ),
            L(
              'Pro které $x$ je vnitřek závorky nulový? To je $x$-ová souřadnice vrcholu.',
              'For which $x$ is the inside of the bracket zero? That is the $x$-coordinate of the vertex.',
            ),
          ],
          solution: [
            step(
              `Vnitřek $${shiftTex(m)}$ je nula pro $x = ${m}$: posun ${horizontal.cs}.`,
              `The inside $${shiftTex(m)}$ is zero at $x = ${m}$: a shift ${horizontal.en}.`,
            ),
            step(
              `Přičtené číslo $${n}$ posouvá graf ${vertical.cs}.`,
              `The added $${n}$ moves the graph ${vertical.en}.`,
              mapL(pointL(m, n), (point) => `V = ${point}`),
            ),
          ],
          misconceptions: [
            mc(
              `${-m}; ${n}`,
              'concept',
              'Posun uvnitř funkce funguje obráceně: $(x - 3)$ posouvá doprava, ne doleva.',
              'A shift inside the function works the opposite way: $(x - 3)$ moves right, not left.',
            ),
            mc(
              `${n}; ${m}`,
              'misread',
              'Souřadnice jsou prohozené: nejdřív vodorovný posun, pak svislý.',
              'The coordinates are swapped: horizontal shift first, then vertical.',
            ),
          ],
          verify: [{ kind: 'extremum', expr: `${base.input(shiftIn(m))}${tailIn(n)}` }],
        };
      }
      if (lv === 2) {
        return {
          prompt: L(
            `Graf funkce $y = ${base.name}$ posuneme ${horizontal.cs} a ${vertical.cs}. Napište předpis výsledné funkce.`,
            `The graph of $y = ${base.name}$ is shifted ${horizontal.en} and ${vertical.en}. Write the formula of the resulting function.`,
          ),
          answer: { kind: 'expr', value: `${base.input(shiftIn(m))}${tailIn(n)}`, vars: ['x'], label: 'y =' },
          hints: [
            L(
              'Svislý posun se přičte vně funkce. Vodorovný se zapisuje dovnitř, k $x$.',
              'A vertical shift is added outside the function. A horizontal one goes inside, with $x$.',
            ),
            L(
              `Nový vrchol má být v bodě $[${m}; ${n}]$. Pro jaké $x$ tedy musí být vnitřek nulový?`,
              `The new vertex should be at $(${m}, ${n})$. For which $x$ must the inside be zero, then?`,
            ),
          ],
          solution: [
            step(
              `Vodorovně ${horizontal.cs}: místo $x$ píšeme $${shiftTex(m)}$.`,
              `Horizontally ${horizontal.en}: write $${shiftTex(m)}$ in place of $x$.`,
            ),
            step(
              `Svisle ${vertical.cs}: přičteme $${n}$.`,
              `Vertically ${vertical.en}: add $${n}$.`,
              `y = ${base.tex(shiftTex(m))}${tailTex(n)}`,
            ),
          ],
          misconceptions: [
            mc(
              `${base.input(shiftIn(-m))}${tailIn(n)}`,
              'concept',
              'Vodorovný posun se zapisuje s opačným znaménkem: doprava o 3 je $(x - 3)$.',
              'A horizontal shift is written with the opposite sign: 3 to the right is $(x - 3)$.',
            ),
            mc(
              `${base.input(shiftIn(m))}${tailIn(-n)}`,
              'sign',
              'Svislý posun má znaménko „normální“: nahoru je plus.',
              'A vertical shift has the “normal” sign: up is plus.',
            ),
            mc(
              `${base.input(shiftIn(n))}${tailIn(m)}`,
              'misread',
              'Prohodil jsi vodorovný a svislý posun.',
              'You swapped the horizontal and the vertical shift.',
            ),
          ],
        };
      }
      const a = r.pick([-1, -2, 2, 3]);
      const shown = `${a === -1 ? '-' : a}${base.tex(shiftTex(m))}${tailTex(n)}`;
      const opens = a > 0;
      return {
        prompt: L(`Určete obor hodnot funkce $f(x) = ${shown}$.`, `Find the range of $f(x) = ${shown}$.`),
        answer: {
          kind: 'interval',
          value: opens ? intervalIn(n, 'inf', true, false) : intervalIn('-inf', n, false, true),
          label: 'H(f) =',
        },
        hints: [
          L(
            `Graf je $y = ${base.name}$ posunutý, natažený a případně překlopený. Kde má vrchol?`,
            `The graph is $y = ${base.name}$ shifted, stretched and possibly flipped. Where is its vertex?`,
          ),
          L(
            `Vrchol je $[${m}; ${n}]$. Koeficient $${a}$ je ${opens ? 'kladný' : 'záporný'} — graf se otevírá ${opens ? 'nahoru' : 'dolů'}.`,
            `The vertex is $(${m}, ${n})$. The coefficient $${a}$ is ${opens ? 'positive' : 'negative'} — the graph opens ${opens ? 'upwards' : 'downwards'}.`,
          ),
        ],
        solution: [
          step(
            'Vrchol:',
            'Vertex:',
            mapL(pointL(m, n), (point) => `V = ${point}`),
          ),
          step(
            opens ? 'Graf se otevírá nahoru, vrchol je nejnižší bod:' : 'Graf se otevírá dolů, vrchol je nejvyšší bod:',
            opens
              ? 'The graph opens upwards, the vertex is the lowest point:'
              : 'The graph opens downwards, the vertex is the highest point:',
            mapL(
              opens ? intervalL(n, 'inf', true, false) : intervalL('-inf', n, false, true),
              (set) => `H(f) = ${set}`,
            ),
          ),
        ],
        misconceptions: [
          mc(
            opens ? intervalIn('-inf', n, false, true) : intervalIn(n, 'inf', true, false),
            'sign',
            'Znaménko koeficientu před závorkou určuje, zda je vrchol minimum, nebo maximum.',
            'The sign of the leading coefficient decides whether the vertex is a minimum or a maximum.',
          ),
          mc(
            opens ? intervalIn(m, 'inf', true, false) : intervalIn('-inf', m, false, true),
            'misread',
            'Obor hodnot se týká $y$-ových hodnot — použij $y$-ovou souřadnici vrcholu.',
            'The range is about $y$-values — use the $y$-coordinate of the vertex.',
          ),
        ],
        verify: [{ kind: 'range', expr: `${a}*${base.input(shiftIn(m))}${tailIn(n)}` }],
      };
    },
  }),

  // ----------------------------------------------------------------------- right triangle
  gen({
    id: 'geo.right-triangle.solve',
    concept: 'geo.right-triangle',
    kind: 'core',
    levels: [1, 2, 3],
    title: L('Pravoúhlý trojúhelník', 'The right triangle'),
    est: (lv) => 40 + 25 * lv,
    make(r, lv) {
      const [p, q, h] = r.pick([
        [3, 4, 5],
        [5, 12, 13],
        [8, 15, 17],
        [7, 24, 25],
        [20, 21, 29],
      ] as const);
      const k = r.pick([1, 1, 2, 3]);
      const a = p * k;
      const b = q * k;
      const c = h * k;
      const figure = {
        view: { xMin: -1, xMax: b + 1, yMin: -1, yMax: a + 1 },
        bare: true,
        aspect: Math.min(0.8, (a + 2) / (b + 2)),
        polygons: [
          {
            points: [
              [0, 0],
              [b, 0],
              [0, a],
            ] as [number, number][],
            labels: ['C', 'B', 'A'],
          },
        ],
      };
      if (lv === 1) {
        const askHyp = r.bool();
        return {
          prompt: askHyp
            ? L(
                `Pravoúhlý trojúhelník má odvěsny $${a}$ cm a $${b}$ cm. Vypočítejte délku přepony (v cm).`,
                `A right triangle has legs $${a}$ cm and $${b}$ cm. Find the length of the hypotenuse (in cm).`,
              )
            : L(
                `Pravoúhlý trojúhelník má přeponu $${c}$ cm a jednu odvěsnu $${a}$ cm. Vypočítejte druhou odvěsnu (v cm).`,
                `A right triangle has hypotenuse $${c}$ cm and one leg $${a}$ cm. Find the other leg (in cm).`,
              ),
          figure,
          answer: { kind: 'number', value: `${askHyp ? c : b}` },
          hints: [
            L(
              'Pythagorova věta: $a^2 + b^2 = c^2$, kde $c$ je přepona — strana proti pravému úhlu.',
              'Pythagoras: $a^2 + b^2 = c^2$, where $c$ is the hypotenuse — the side opposite the right angle.',
            ),
            askHyp
              ? L(`$c^2 = ${a}^2 + ${b}^2 = ${a * a + b * b}$.`, `$c^2 = ${a}^2 + ${b}^2 = ${a * a + b * b}$.`)
              : L(
                  `$b^2 = ${c}^2 - ${a}^2 = ${c * c - a * a}$. Přepona je nejdelší, takže se odčítá.`,
                  `$b^2 = ${c}^2 - ${a}^2 = ${c * c - a * a}$. The hypotenuse is the longest side, so you subtract.`,
                ),
          ],
          solution: [
            askHyp
              ? step(
                  'Sečteme čtverce odvěsen:',
                  'Add the squares of the legs:',
                  `c = \\sqrt{${a}^2 + ${b}^2} = \\sqrt{${a * a + b * b}} = ${c}`,
                )
              : step(
                  'Od čtverce přepony odečteme čtverec odvěsny:',
                  'Subtract the square of the leg from that of the hypotenuse:',
                  `b = \\sqrt{${c}^2 - ${a}^2} = \\sqrt{${c * c - a * a}} = ${b}`,
                ),
          ],
          misconceptions: askHyp
            ? [
                mc(
                  `${a + b}`,
                  'formula',
                  'Sčítají se čtverce stran, ne strany samotné.',
                  'It is the squares of the sides that add, not the sides themselves.',
                ),
              ]
            : [
                mc(
                  `sqrt(${c * c + a * a})`,
                  'formula',
                  'Hledáš odvěsnu, ne přeponu — čtverce se odčítají.',
                  'You are after a leg, not the hypotenuse — the squares are subtracted.',
                ),
              ],
        };
      }
      if (lv === 2) {
        const which = r.pick(['sin', 'cos', 'tg'] as const);
        // angle α at vertex A: opposite side a' = BC = b (horizontal), adjacent AC = a (vertical)
        const value = which === 'sin' ? frac(b, c) : which === 'cos' ? frac(a, c) : frac(b, a);
        const name = { sin: '\\sin', cos: '\\cos', tg: L('\\operatorname{tg}', '\\tan') }[which];
        const fn = typeof name === 'string' ? L(name, name) : name;
        return {
          prompt: L(
            `V pravoúhlém trojúhelníku $ABC$ s pravým úhlem u vrcholu $C$ je $|AC| = ${a}$, $|BC| = ${b}$, $|AB| = ${c}$. Určete $${fn.cs}\\alpha$, kde $\\alpha$ je úhel u vrcholu $A$. Zapište jako zlomek.`,
            `In the right triangle $ABC$ with the right angle at $C$: $|AC| = ${a}$, $|BC| = ${b}$, $|AB| = ${c}$. Find $${fn.en}\\alpha$, where $\\alpha$ is the angle at $A$. Give a fraction.`,
          ),
          figure,
          answer: { kind: 'number', value: fToInput(value) },
          hints: [
            L(
              'Nejdřív urči, která strana je vůči úhlu $\\alpha$ protilehlá, která přilehlá a která je přepona.',
              'First work out which side is opposite to $\\alpha$, which is adjacent, and which is the hypotenuse.',
            ),
            L(
              `Proti vrcholu $A$ leží strana $BC$. Přilehlá odvěsna je $AC$, přepona $AB$.`,
              `Opposite the vertex $A$ lies the side $BC$. The adjacent leg is $AC$, the hypotenuse is $AB$.`,
            ),
          ],
          solution: [
            step(
              'Protilehlá $|BC| = ' + b + '$, přilehlá $|AC| = ' + a + '$, přepona $|AB| = ' + c + '$.',
              'Opposite $|BC| = ' + b + '$, adjacent $|AC| = ' + a + '$, hypotenuse $|AB| = ' + c + '$.',
            ),
            step('Poměr:', 'Ratio:', `${fn.cs}\\alpha = ${fToTex(value)}`),
          ],
          misconceptions: [
            mc(
              fToInput(which === 'sin' ? frac(a, c) : which === 'cos' ? frac(b, c) : frac(a, b)),
              'misread',
              'Zaměnil jsi protilehlou a přilehlou odvěsnu. Vždy se dívej z vrcholu daného úhlu.',
              'You swapped the opposite and adjacent legs. Always look from the vertex of the given angle.',
            ),
          ],
        };
      }
      const angle = r.pick([30, 45, 60] as const);
      const hyp = 2 * r.int(2, 9);
      const ask = r.pick(['opposite', 'adjacent'] as const);
      const table = {
        30: {
          opposite: `${hyp / 2}`,
          adjacent: `${hyp / 2}*sqrt(3)`,
          sin: '\\frac{1}{2}',
          cos: '\\frac{\\sqrt{3}}{2}',
        },
        45: {
          opposite: `${hyp / 2}*sqrt(2)`,
          adjacent: `${hyp / 2}*sqrt(2)`,
          sin: '\\frac{\\sqrt{2}}{2}',
          cos: '\\frac{\\sqrt{2}}{2}',
        },
        60: {
          opposite: `${hyp / 2}*sqrt(3)`,
          adjacent: `${hyp / 2}`,
          sin: '\\frac{\\sqrt{3}}{2}',
          cos: '\\frac{1}{2}',
        },
      }[angle];
      return {
        prompt: L(
          `V pravoúhlém trojúhelníku má přepona délku $${hyp}$ a jeden ostrý úhel velikost $${angle}^\\circ$. Určete přesně délku odvěsny ${ask === 'opposite' ? 'protilehlé' : 'přilehlé'} k tomuto úhlu.`,
          `A right triangle has hypotenuse $${hyp}$ and an acute angle of $${angle}^\\circ$. Find the exact length of the leg ${ask === 'opposite' ? 'opposite' : 'adjacent'} to that angle.`,
        ),
        answer: { kind: 'number', value: table[ask], placeholder: '3*sqrt(2)' },
        hints: [
          L(
            `${ask === 'opposite' ? 'Protilehlá odvěsna a přepona: to je sinus.' : 'Přilehlá odvěsna a přepona: to je kosinus.'}`,
            `${ask === 'opposite' ? 'Opposite leg and hypotenuse: that is sine.' : 'Adjacent leg and hypotenuse: that is cosine.'}`,
          ),
          L(
            `$\\sin ${angle}^\\circ = ${table.sin}$, $\\cos ${angle}^\\circ = ${table.cos}$.`,
            `$\\sin ${angle}^\\circ = ${table.sin}$, $\\cos ${angle}^\\circ = ${table.cos}$.`,
          ),
        ],
        solution: [
          step(
            ask === 'opposite' ? 'Protilehlá = přepona · sinus:' : 'Přilehlá = přepona · kosinus:',
            ask === 'opposite' ? 'Opposite = hypotenuse · sine:' : 'Adjacent = hypotenuse · cosine:',
            `${hyp} \\cdot ${ask === 'opposite' ? table.sin : table.cos}`,
          ),
          step('Výsledek ponecháme přesně, s odmocninou.', 'Leave the result exact, with the root.'),
        ],
        misconceptions: [
          mc(
            table[ask === 'opposite' ? 'adjacent' : 'opposite'],
            'formula',
            'Zaměnil jsi sinus a kosinus.',
            'You swapped sine and cosine.',
          ),
        ],
      };
    },
  }),

  // -------------------------------------------------------------- complex, algebraic form
  gen({
    id: 'cplx.algebraic.ops',
    concept: 'cplx.algebraic',
    kind: 'core',
    levels: [1, 2, 3],
    title: L('Počítání s komplexními čísly', 'Arithmetic with complex numbers'),
    est: (lv) => 40 + 35 * lv,
    make(r, lv) {
      const a = nz(r, -5, 5);
      const b = nz(r, -5, 5);
      const c = nz(r, -5, 5);
      const d = nz(r, -5, 5);
      // Written the way it is read: no "+ 0i", no "1i".
      const cx = (re: number, im: number): string => {
        const imPart = Math.abs(im) === 1 ? 'i' : `${Math.abs(im)}i`;
        if (im === 0) return `${re}`;
        if (re === 0) return `${im < 0 ? '-' : ''}${imPart}`;
        return `${re}${im > 0 ? '+' : '-'}${imPart}`;
      };
      const cxTex = (re: number, im: number): string => {
        const imPart = Math.abs(im) === 1 ? '\\mathrm{i}' : `${Math.abs(im)}\\mathrm{i}`;
        if (im === 0) return `${re}`;
        if (re === 0) return `${im < 0 ? '-' : ''}${imPart}`;
        return `${re} ${im >= 0 ? '+' : '-'} ${imPart}`;
      };
      if (lv === 1) {
        const minus = r.bool();
        const re = minus ? a - c : a + c;
        const im = minus ? b - d : b + d;
        return {
          prompt: L(
            `Vypočítejte: $(${cxTex(a, b)}) ${minus ? '-' : '+'} (${cxTex(c, d)})$`,
            `Compute: $(${cxTex(a, b)}) ${minus ? '-' : '+'} (${cxTex(c, d)})$`,
          ),
          answer: { kind: 'complex', value: cx(re, im), form: 'algebraic', placeholder: '3-2i' },
          hints: [
            L(
              'Reálné části počítej zvlášť, imaginární zvlášť — jako u dvojčlenů.',
              'Handle the real parts and the imaginary parts separately — as with binomials.',
            ),
            minus
              ? L(
                  'Minus před závorkou změní znaménko obou částí.',
                  'The minus before the bracket changes the sign of both parts.',
                )
              : L(
                  `Reálná část: $${a} + ${par(c)}$. Imaginární: $${b} + ${par(d)}$.`,
                  `Real part: $${a} + ${par(c)}$. Imaginary: $${b} + ${par(d)}$.`,
                ),
          ],
          solution: [step('Sečteme po složkách:', 'Combine component-wise:', cxTex(re, im))],
          misconceptions: minus
            ? [
                mc(
                  cx(a - c, b + d),
                  'sign',
                  'Minus před závorkou platí i pro imaginární část.',
                  'The minus before the bracket applies to the imaginary part too.',
                ),
              ]
            : [],
        };
      }
      if (lv === 2) {
        const re = a * c - b * d;
        const im = a * d + b * c;
        return {
          prompt: L(`Vypočítejte: $(${cxTex(a, b)})(${cxTex(c, d)})$`, `Compute: $(${cxTex(a, b)})(${cxTex(c, d)})$`),
          answer: { kind: 'complex', value: cx(re, im), form: 'algebraic', placeholder: '3-2i' },
          hints: [
            L('Roznásob jako dva dvojčleny — každý s každým.', 'Expand as two binomials — each with each.'),
            L('Kde vyjde $\\mathrm{i}^2$, napiš $-1$.', 'Wherever $\\mathrm{i}^2$ appears, write $-1$.'),
          ],
          solution: [
            step(
              'Každý s každým:',
              'Each with each:',
              `${a * c} ${tailTex(a * d)}\\mathrm{i} ${tailTex(b * c)}\\mathrm{i} ${tailTex(b * d)}\\mathrm{i}^2`,
            ),
            step('Dosadíme $\\mathrm{i}^2 = -1$ a sečteme:', 'Use $\\mathrm{i}^2 = -1$ and collect:', cxTex(re, im)),
          ],
          misconceptions: [
            mc(
              cx(a * c + b * d, im),
              'formula',
              '$\\mathrm{i}^2 = -1$, ne $+1$: poslední součin mění znaménko.',
              '$\\mathrm{i}^2 = -1$, not $+1$: the last product changes sign.',
            ),
            mc(
              cx(a * c, b * d),
              'algebra',
              'Násobí se každý s každým — chybí smíšené součiny.',
              'Each term multiplies each — the cross products are missing.',
            ),
          ],
        };
      }
      // Level 3: division with a tidy result: (p + qi)(c + di) / (c + di)
      const p = nz(r, -4, 4);
      const q = nz(r, -4, 4);
      const numRe = p * c - q * d;
      const numIm = p * d + q * c;
      return {
        prompt: L(
          `Vypočítejte a zapište ve tvaru $a + b\\mathrm{i}$: $\\dfrac{${cxTex(numRe, numIm)}}{${cxTex(c, d)}}$`,
          `Compute and write as $a + b\\mathrm{i}$: $\\dfrac{${cxTex(numRe, numIm)}}{${cxTex(c, d)}}$`,
        ),
        answer: { kind: 'complex', value: cx(p, q), form: 'algebraic', placeholder: '3-2i' },
        hints: [
          L(
            'Zlomek rozšiř číslem komplexně sdruženým ke jmenovateli.',
            'Multiply numerator and denominator by the complex conjugate of the denominator.',
          ),
          L(
            `Sdružené číslo ke jmenovateli je $${cxTex(c, -d)}$. Jmenovatel pak vyjde reálný: $${c}^2 + ${Math.abs(d)}^2 = ${c * c + d * d}$.`,
            `The conjugate of the denominator is $${cxTex(c, -d)}$. The denominator then becomes real: $${c}^2 + ${Math.abs(d)}^2 = ${c * c + d * d}$.`,
          ),
        ],
        solution: [
          step(
            'Rozšíříme sdruženým číslem:',
            'Multiply by the conjugate:',
            `\\frac{(${cxTex(numRe, numIm)})(${cxTex(c, -d)})}{${c * c + d * d}}`,
          ),
          step(
            'Roznásobíme čitatele:',
            'Expand the numerator:',
            `\\frac{${cxTex(p * (c * c + d * d), q * (c * c + d * d))}}{${c * c + d * d}}`,
          ),
          step('Vydělíme:', 'Divide:', cxTex(p, q)),
        ],
        misconceptions: [
          mc(
            cx(p, -q),
            'sign',
            'Rozšiřuje se číslem sdruženým ke jmenovateli, ne k čitateli.',
            'Multiply by the conjugate of the denominator, not of the numerator.',
          ),
        ],
      };
    },
  }),
];
