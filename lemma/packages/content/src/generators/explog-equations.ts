import { L, fDiv, fSub, fToInput, fToTex, frac, polyIn, polyTex, setL, type Frac, type Generator } from '@lemma/core';
import { logIn, logTex, power } from './explog';
import { gen, leadIn, leadTex, mapL, mc, nz, shiftIn, shiftTex, step, tailIn, tailTex } from './helpers';

/** p·x + c as an exponent, for display and for the parser. */
const linTex = (p: number, c: number): string => `${leadTex(p)}x${tailTex(c)}`;
const linIn = (p: number, c: number): string => `${leadIn(p)}x${tailIn(c)}`;

/** A whole number or a simple fraction such as 1/8, for display. */
const valueTex = (value: Frac): string => fToTex(value);

/** Syllabus topics 9 and 10: exponential and logarithmic equations. */
export const EXPLOG_EQUATION_GENERATORS: Generator[] = [
  gen({
    id: 'expeq.same-base.basic',
    concept: 'expeq.same-base',
    kind: 'core',
    levels: [1, 2, 3],
    title: L('Exponenciální rovnice: sjednotit základ', 'Exponential equations: one common base'),
    tags: ['annual-review'],
    est: (lv) => 40 + 30 * lv,
    make(r, lv) {
      if (lv === 3) {
        // B1^(x + c1) = B2^(x + c2) with B1 = b^u and B2 = b^v.
        const [b, u, v] = r.pick([
          [2, 2, 3],
          [2, 3, 2],
          [3, 2, 3],
          [3, 3, 2],
          [2, 1, 2],
          [2, 2, 1],
          [2, 1, 3],
          [5, 2, 3],
          [3, 1, 2],
        ] as const);
        const t = r.pick([1, 2, -1, -2]);
        const x0 = r.int(-4, 5);
        // u(x0 + c1) = v(x0 + c2) holds when x0 + c1 = v·t and x0 + c2 = u·t.
        const c1 = v * t - x0;
        const c2 = u * t - x0;
        const [B1, B2] = [b ** u, b ** v];
        const lhs = `${B1}^{${linTex(1, c1)}}`;
        const rhs = `${B2}^{${linTex(1, c2)}}`;
        return {
          prompt: L(`Řešte v $\\mathbb{R}$: $${lhs} = ${rhs}$`, `Solve in $\\mathbb{R}$: $${lhs} = ${rhs}$`),
          answer: { kind: 'set', values: [`${x0}`], label: 'K =' },
          hints: [
            u === 1 || v === 1
              ? L(
                  `Větší základ je mocnina menšího: $${Math.max(B1, B2)} = ${b}^{${Math.max(u, v)}}$.`,
                  `The larger base is a power of the smaller one: $${Math.max(B1, B2)} = ${b}^{${Math.max(u, v)}}$.`,
                )
              : L(
                  `Oba základy jsou mocniny čísla ${b}: $${B1} = ${b}^{${u}}$ a $${B2} = ${b}^{${v}}$.`,
                  `Both bases are powers of ${b}: $${B1} = ${b}^{${u}}$ and $${B2} = ${b}^{${v}}$.`,
                ),
            L(
              'Mocnina mocniny: exponenty se násobí — celý exponent, včetně závorky.',
              'A power of a power: the exponents multiply — the whole exponent, brackets included.',
            ),
          ],
          solution: [
            step(
              `Převedeme na základ ${b}:`,
              `Convert to base ${b}:`,
              `${b}^{${u === 1 ? linTex(1, c1) : `${u}(${linTex(1, c1)})`}} = ${b}^{${v === 1 ? linTex(1, c2) : `${v}(${linTex(1, c2)})`}}`,
            ),
            step(
              'Exponenciální funkce je prostá, porovnáme exponenty:',
              'An exponential function is one-to-one, so compare the exponents:',
              `${linTex(u, u * c1)} = ${linTex(v, v * c2)}`,
            ),
            step(
              'Vyřešíme lineární rovnici:',
              'Solve the linear equation:',
              mapL(setL([x0]), (set) => `x = ${x0} \\;\\Rightarrow\\; K = ${set}`),
            ),
          ],
          misconceptions: [
            // u·x + c1 = v·x + c2: the factor reached only x.
            mc(
              fToInput(frac(c2 - c1, u - v)),
              'algebra',
              'Exponent se násobí celou závorkou, ne jen $x$.',
              'The exponent multiplies the whole bracket, not just $x$.',
            ),
          ],
          // As a ratio: the difference of two powers underflows to zero far to the left, which would look like a root.
          verify: [{ kind: 'roots', expr: `${B1}^(${linIn(1, c1)})/${B2}^(${linIn(1, c2)})-1` }],
        };
      }
      const b = r.pick([2, 3, 5]);
      const p = lv === 1 ? r.pick([1, 1, 2]) : r.pick([1, 2, 3, -1]);
      const x0 = r.int(-3, 4);
      // The exponent on the right: positive at level 1, any sign at level 2.
      const k = lv === 1 ? r.int(1, b === 5 ? 3 : 5) : r.pick(b === 5 ? [-2, -1, 2] : [-3, -2, -1, 3, 4]);
      const c = k - p * x0;
      const inverted = lv === 2 && r.bool(0.35);
      // (1/b)^E = b^(−E): the same solution needs the exponent −k on the right.
      const rhs = power(frac(b), inverted ? -k : k);
      const baseShown = inverted ? `\\left(\\tfrac{1}{${b}}\\right)` : `${b}`;
      const baseInput = inverted ? `(1/${b})` : `${b}`;
      const target = inverted ? -k : k;
      return {
        prompt: L(
          `Řešte v $\\mathbb{R}$: $${baseShown}^{${linTex(p, c)}} = ${valueTex(rhs)}$`,
          `Solve in $\\mathbb{R}$: $${baseShown}^{${linTex(p, c)}} = ${valueTex(rhs)}$`,
        ),
        answer: { kind: 'set', values: [`${x0}`], label: 'K =' },
        hints: [
          L(
            `Zapiš obě strany jako mocninu čísla ${b}: $${valueTex(rhs)} = ${b}^{?}$`,
            `Write both sides as a power of ${b}: $${valueTex(rhs)} = ${b}^{?}$`,
          ),
          inverted
            ? L(
                `$\\tfrac{1}{${b}} = ${b}^{-1}$, takže levá strana je $${b}^{-(${linTex(p, c)})}$.`,
                `$\\tfrac{1}{${b}} = ${b}^{-1}$, so the left side is $${b}^{-(${linTex(p, c)})}$.`,
              )
            : L(
                'Stejné základy ⇒ stejné exponenty. Zbývá lineární rovnice.',
                'Equal bases ⇒ equal exponents. A linear equation remains.',
              ),
        ],
        solution: [
          step(
            `Pravá strana jako mocnina čísla ${b}:`,
            `The right side as a power of ${b}:`,
            `${valueTex(rhs)} = ${b}^{${target}}`,
          ),
          ...(inverted
            ? [
                step(
                  'Levá strana na stejný základ:',
                  'The left side in the same base:',
                  `${baseShown}^{${linTex(p, c)}} = ${b}^{${linTex(-p, -c)}}`,
                ),
              ]
            : []),
          step(
            'Porovnáme exponenty:',
            'Compare the exponents:',
            `${inverted ? linTex(-p, -c) : linTex(p, c)} = ${target}`,
          ),
          step(
            'Vyřešíme:',
            'Solve:',
            mapL(setL([x0]), (set) => `x = ${x0} \\;\\Rightarrow\\; K = ${set}`),
          ),
        ],
        misconceptions: [
          ...(target !== k || k < 0
            ? [
                mc(
                  fToInput(frac(-k - c, p)),
                  'sign',
                  'Znaménko exponentu: zlomek znamená záporný exponent.',
                  'The sign of the exponent: a fraction means a negative exponent.',
                ),
              ]
            : []),
          mc(
            fToInput(fDiv(fSub(rhs, frac(c)), frac(p))),
            'concept',
            'Exponent se neporovnává s číslem na pravé straně, ale s jeho exponentem.',
            'The exponent is compared not with the number on the right but with its exponent.',
          ),
        ],
        verify: [{ kind: 'roots', expr: `${baseInput}^(${linIn(p, c)})-(${fToInput(rhs)})` }],
      };
    },
  }),

  gen({
    id: 'expeq.same-base.factor',
    concept: 'expeq.same-base',
    kind: 'hard',
    levels: [3, 4],
    title: L('Exponenciální rovnice: vytknout mocninu', 'Exponential equations: factor out a power'),
    est: (lv) => 100 + 30 * (lv - 3),
    make(r, lv) {
      const b = r.pick([2, 3]);
      const x0 = r.int(1, b === 2 ? 4 : 3);
      // Shifts of the exponent, largest first; coefficients ±1.
      const shifts = lv === 3 ? [r.int(1, 3), 0] : [r.int(2, 3), 1, 0];
      const signs = lv === 3 ? [1, r.sign()] : [1, r.sign(), r.sign()];
      const bracket = shifts.reduce((sum, shift, i) => sum + signs[i]! * b ** shift, 0);
      const total = bracket * b ** x0;
      const term = (shift: number): string => `${b}^{${shift === 0 ? 'x' : `x + ${shift}`}}`;
      const lhs = shifts.map((shift, i) => `${i === 0 ? '' : signs[i]! > 0 ? '+ ' : '- '}${term(shift)}`).join(' ');
      const lhsIn = shifts.map((shift, i) => `${i === 0 ? '' : signs[i]! > 0 ? '+' : '-'}${b}^(x+${shift})`).join('');
      const split = shifts[0] === 1 ? `${b}` : `${b}^{${shifts[0]}}`;
      const inside = shifts.map((shift, i) => `${i === 0 ? '' : signs[i]! > 0 ? '+ ' : '- '}${b ** shift}`).join(' ');
      return {
        prompt: L(`Řešte v $\\mathbb{R}$: $${lhs} = ${total}$`, `Solve in $\\mathbb{R}$: $${lhs} = ${total}$`),
        answer: { kind: 'set', values: [`${x0}`], label: 'K =' },
        hints: [
          L(
            `Každý člen obsahuje $${b}^x$: například $${term(shifts[0]!)} = ${split} \\cdot ${b}^x$.`,
            `Every term contains $${b}^x$: for example $${term(shifts[0]!)} = ${split} \\cdot ${b}^x$.`,
          ),
          L(
            `Vytkni $${b}^x$. V závorce zůstanou jen čísla.`,
            `Factor out $${b}^x$. Only numbers remain in the bracket.`,
          ),
        ],
        solution: [
          step(`Vytkneme $${b}^x$:`, `Factor out $${b}^x$:`, `${b}^x \\cdot (${inside}) = ${total}`),
          step(
            'Sečteme závorku a vydělíme:',
            'Evaluate the bracket and divide:',
            `${b}^x \\cdot ${bracket} = ${total} \\;\\Rightarrow\\; ${b}^x = ${b ** x0}`,
          ),
          step(
            'Porovnáme exponenty:',
            'Compare the exponents:',
            mapL(setL([x0]), (set) => `x = ${x0} \\;\\Rightarrow\\; K = ${set}`),
          ),
        ],
        misconceptions: [
          mc(
            `${x0 + shifts[0]!}`,
            'incomplete',
            `To je exponent prvního členu. Hledáš $x$, ne $x + ${shifts[0]}$.`,
            `That is the exponent of the first term. You want $x$, not $x + ${shifts[0]}$.`,
          ),
          mc(`${x0 - 1}`, 'arithmetic', 'Přepočítej závorku po vytknutí.', 'Recompute the bracket after factoring.'),
          mc(`${x0 + 1}`, 'arithmetic', 'Přepočítej závorku po vytknutí.', 'Recompute the bracket after factoring.'),
        ],
        verify: [{ kind: 'roots', expr: `${lhsIn}-(${total})` }],
      };
    },
  }),

  gen({
    id: 'expeq.advanced.substitution',
    concept: 'expeq.advanced',
    kind: 'hard',
    levels: [3, 4],
    title: L('Exponenciální rovnice: substituce', 'Exponential equations: substitution'),
    est: (lv) => 120 + 30 * (lv - 3),
    make(r, lv) {
      const b = r.pick([2, 3]);
      const square = b * b;
      // t² − (t1 + t2)t + t1·t2 = 0 for t = b^x. At level 4 one root is negative and drops out.
      const x1 = r.int(0, b === 2 ? 3 : 2);
      const t1 = b ** x1;
      const oneRoot = lv === 4;
      const x2 = oneRoot ? null : r.intExcept(0, b === 2 ? 3 : 2, [x1]);
      // Never t2 = −t1: the middle term would vanish and there would be nothing to substitute.
      const t2 = x2 === null ? -r.pick([1, 2, 3, 4].filter((value) => value !== t1)) : b ** x2;
      const pairs = (
        x2 === null
          ? [[t1, x1]]
          : [
              [t1, x1],
              [t2, x2],
            ]
      ).sort((p, q) => p[0]! - q[0]!);
      const sum = t1 + t2;
      const product = t1 * t2;
      const middle =
        sum === 0 ? '' : ` ${sum > 0 ? '-' : '+'} ${Math.abs(sum) === 1 ? '' : `${Math.abs(sum)} \\cdot `}${b}^x`;
      const equation = `${square}^x${middle}${tailTex(product)} = 0`;
      const roots = (x2 === null ? [x1] : [x1, x2]).sort((u, v) => u - v);
      const quadratic = polyTex([1, -sum, product], { variable: 't' });
      return {
        prompt: L(`Řešte v $\\mathbb{R}$: $${equation}$`, `Solve in $\\mathbb{R}$: $${equation}$`),
        answer: { kind: 'set', values: roots.map(String), label: 'K =' },
        hints: [
          L(
            `$${square}^x = (${b}^x)^2$. Jakou substituci to nabízí?`,
            `$${square}^x = (${b}^x)^2$. What substitution does that suggest?`,
          ),
          L(
            `Polož $t = ${b}^x$ a vyřeš kvadratickou rovnici $${quadratic} = 0$.`,
            `Put $t = ${b}^x$ and solve the quadratic $${quadratic} = 0$.`,
          ),
          L(
            `$t = ${b}^x$ je vždy kladné. Záporný kořen žádnému $x$ neodpovídá.`,
            `$t = ${b}^x$ is always positive. A negative root corresponds to no $x$.`,
          ),
        ],
        solution: [
          step(`Substituce $t = ${b}^x$, $t > 0$:`, `Substitution $t = ${b}^x$, $t > 0$:`, `${quadratic} = 0`),
          step(
            'Kořeny kvadratické rovnice:',
            'Roots of the quadratic:',
            `t_1 = ${Math.min(t1, t2)},\\; t_2 = ${Math.max(t1, t2)}`,
          ),
          ...(x2 === null
            ? [
                step(
                  `Záporný kořen $t = ${t2}$ nevyhovuje podmínce $t > 0$.`,
                  `The negative root $t = ${t2}$ fails the condition $t > 0$.`,
                ),
              ]
            : []),
          step(
            'Vrátíme se k $x$:',
            'Return to $x$:',
            pairs.map(([t, x]) => `${b}^x = ${t} \\Rightarrow x = ${x}`).join(',\\quad '),
          ),
          step(
            'Množina řešení:',
            'Solution set:',
            mapL(setL(roots), (set) => `K = ${set}`),
          ),
        ],
        misconceptions: [
          mc(
            x2 === null ? `${t1}` : `${Math.min(t1, t2)}; ${Math.max(t1, t2)}`,
            'incomplete',
            `To jsou hodnoty $t$. Ještě je potřeba vrátit se k $x$ z $t = ${b}^x$.`,
            `Those are values of $t$. You still have to go back to $x$ from $t = ${b}^x$.`,
          ),
          ...(x2 === null
            ? [
                mc(
                  `${t2}; ${x1}`,
                  'domain',
                  `$${b}^x$ nemůže být záporné, takže $t = ${t2}$ žádné řešení nedává.`,
                  `$${b}^x$ cannot be negative, so $t = ${t2}$ gives no solution.`,
                ),
              ]
            : [
                mc(
                  `${roots[0]}`,
                  'incomplete',
                  'Kvadratická rovnice má dva kladné kořeny, každý dává jedno $x$.',
                  'The quadratic has two positive roots, each giving one $x$.',
                ),
                mc(
                  `${roots[1]}`,
                  'incomplete',
                  'Kvadratická rovnice má dva kladné kořeny, každý dává jedno $x$.',
                  'The quadratic has two positive roots, each giving one $x$.',
                ),
              ]),
        ],
        verify: [{ kind: 'roots', expr: `${square}^x-(${sum})*${b}^x+(${product})`, range: [-8, 8] }],
      };
    },
  }),

  gen({
    id: 'expeq.advanced.logarithm',
    concept: 'expeq.advanced',
    kind: 'core',
    levels: [3, 4],
    title: L('Exponenciální rovnice: logaritmovat', 'Exponential equations: take logarithms'),
    est: (lv) => 70 + 40 * (lv - 3),
    make(r, lv) {
      const b = r.pick([2, 3, 5, 7]);
      // A right-hand side that is not a power of the base.
      const c = r.pick([3, 5, 6, 7, 10, 11, 12, 15, 20].filter((n) => !Number.isInteger(Math.log(n) / Math.log(b))));
      if (lv === 3) {
        const exact = Math.log(c) / Math.log(b);
        return {
          prompt: L(
            `Řešte v $\\mathbb{R}$: $${b}^x = ${c}$. Výsledek zapište přesně (např. \`log_2(5)\`), nebo zaokrouhlete na dvě desetinná místa.`,
            `Solve in $\\mathbb{R}$: $${b}^x = ${c}$. Give the result exactly (e.g. \`log_2(5)\`) or rounded to two decimal places.`,
          ),
          answer: { kind: 'number', value: `log_${b}(${c})`, tol: 0.005, label: 'x =' },
          hints: [
            L(
              `$${c}$ není mocnina čísla ${b} s celým exponentem. Podle definice logaritmu: $x$ je exponent, na který se umocní ${b}, aby vyšlo ${c}.`,
              `$${c}$ is not a whole power of ${b}. By the definition of a logarithm: $x$ is the exponent to which ${b} is raised to give ${c}.`,
            ),
            L(
              'Na kalkulačce: změna základu, $\\log_b c = \\dfrac{\\log c}{\\log b}$.',
              'On a calculator: change of base, $\\log_b c = \\dfrac{\\log c}{\\log b}$.',
            ),
          ],
          solution: [
            step('Podle definice logaritmu:', 'By the definition of the logarithm:', `x = \\log_{${b}} ${c}`),
            step(
              'Číselně, změnou základu:',
              'Numerically, by change of base:',
              L(
                `x = \\frac{\\log ${c}}{\\log ${b}} \\approx ${exact.toFixed(2).replace('.', '{,}')}`,
                `x = \\frac{\\log ${c}}{\\log ${b}} \\approx ${exact.toFixed(2)}`,
              ),
            ),
          ],
          misconceptions: [
            mc(
              `${c}/${b}`,
              'concept',
              'Neznámá je v exponentu: dělením základem se k ní nedostaneš, potřebuješ logaritmus.',
              'The unknown is in the exponent: dividing by the base does not reach it; you need a logarithm.',
            ),
            mc(
              `log_${c}(${b})`,
              'formula',
              'Zlomek je obráceně: $\\log_b c = \\dfrac{\\log c}{\\log b}$.',
              'The fraction is upside down: $\\log_b c = \\dfrac{\\log c}{\\log b}$.',
            ),
          ],
          verify: [{ kind: 'value', expr: `ln(${c})/ln(${b})` }],
        };
      }
      const p = r.pick([2, 3]);
      const q = nz(r, -3, 3);
      const exact = (Math.log(c) / Math.log(b) - q) / p;
      return {
        prompt: L(
          `Řešte v $\\mathbb{R}$: $${b}^{${linTex(p, q)}} = ${c}$. Zaokrouhlete na dvě desetinná místa.`,
          `Solve in $\\mathbb{R}$: $${b}^{${linTex(p, q)}} = ${c}$. Round to two decimal places.`,
        ),
        answer: { kind: 'number', value: `(log_${b}(${c})${tailIn(-q)})/${p}`, tol: 0.005, label: 'x =' },
        hints: [
          L(
            `Nejdřív urči celý exponent: $${linTex(p, q)} = \\log_{${b}} ${c}$.`,
            `First find the whole exponent: $${linTex(p, q)} = \\log_{${b}} ${c}$.`,
          ),
          L(
            'Logaritmus vyčísli a pak řeš obyčejnou lineární rovnici.',
            'Evaluate the logarithm, then solve an ordinary linear equation.',
          ),
        ],
        solution: [
          step(
            'Exponent je logaritmus pravé strany:',
            'The exponent is the logarithm of the right-hand side:',
            `${linTex(p, q)} = \\log_{${b}} ${c}`,
          ),
          step(
            'Vyjádříme $x$:',
            'Solve for $x$:',
            L(
              `x = \\frac{\\log_{${b}} ${c}${tailTex(-q)}}{${p}} \\approx ${exact.toFixed(2).replace('.', '{,}')}`,
              `x = \\frac{\\log_{${b}} ${c}${tailTex(-q)}}{${p}} \\approx ${exact.toFixed(2)}`,
            ),
          ),
        ],
        misconceptions: [
          mc(
            `(log_${b}(${c})${tailIn(q)})/${p}`,
            'sign',
            `Při převádění $${q}$ na druhou stranu se mění znaménko.`,
            `Moving $${q}$ across changes its sign.`,
          ),
          mc(
            `log_${b}(${c})/${p}${tailIn(-q)}`,
            'algebra',
            'Nejdřív odečti (přičti) číslo, teprve potom děl — dělí se celá strana.',
            'Subtract (add) the number first and only then divide — the whole side is divided.',
          ),
        ],
        verify: [{ kind: 'value', expr: `(ln(${c})/ln(${b})-(${q}))/${p}` }],
      };
    },
  }),

  gen({
    id: 'logeq.basic.definition',
    concept: 'logeq.basic',
    kind: 'core',
    levels: [1, 2, 3],
    title: L('Logaritmická rovnice podle definice', 'A logarithmic equation by the definition'),
    tags: ['annual-review'],
    est: (lv) => 45 + 30 * lv,
    make(r, lv) {
      const base = r.pick([2, 3, 10, 5]);
      const k = r.int(1, base === 2 ? 4 : base === 3 ? 3 : 2);
      const value = base ** k;
      if (lv === 3) {
        // The argument is (x − r1)(x − r2) + b^k, which equals b^k exactly at r1 and r2.
        const r1 = r.int(-5, -1);
        const r2 = r.int(1, 6);
        const coeffs = [1, -(r1 + r2), r1 * r2 + value];
        const argument = polyTex(coeffs);
        return {
          prompt: L(
            `Řešte v $\\mathbb{R}$: $${logTex(base, `(${argument})`)} = ${k}$`,
            `Solve in $\\mathbb{R}$: $${logTex(base, `(${argument})`)} = ${k}$`,
          ),
          answer: { kind: 'set', values: [`${r1}`, `${r2}`], label: 'K =' },
          hints: [
            L(
              `Podle definice: argument se rovná $${base}^{${k}}$.`,
              `By the definition: the argument equals $${base}^{${k}}$.`,
            ),
            L(
              'Vznikne kvadratická rovnice. Nakonec ověř, že pro oba kořeny je argument kladný.',
              'A quadratic equation results. At the end check that the argument is positive for both roots.',
            ),
          ],
          solution: [
            step(
              'Odstraníme logaritmus podle definice:',
              'Remove the logarithm using the definition:',
              `${argument} = ${base}^{${k}} = ${value}`,
            ),
            step('Kvadratická rovnice:', 'The quadratic:', `${polyTex([1, -(r1 + r2), r1 * r2])} = 0`),
            step(
              `Kořeny $${r1}$ a $${r2}$. Pro oba je argument roven $${value} > 0$, oba vyhovují.`,
              `Roots $${r1}$ and $${r2}$. For both the argument equals $${value} > 0$, so both are valid.`,
              mapL(setL([r1, r2]), (set) => `K = ${set}`),
            ),
          ],
          misconceptions: [
            mc(
              `${r2}`,
              'incomplete',
              'Záporný kořen není důvod ho vyloučit: rozhoduje, jestli je kladný argument logaritmu, ne $x$.',
              'A negative root is no reason to exclude it: what matters is whether the argument of the logarithm is positive, not $x$.',
            ),
          ],
          verify: [{ kind: 'roots', expr: `${logIn(base, polyIn(coeffs))}-${k}` }],
        };
      }
      const p = lv === 1 ? 1 : r.pick([2, 3, -1, -2]);
      const x0 = r.int(-4, 6);
      const c = value - p * x0;
      const argument = polyTex([p, c]);
      return {
        prompt: L(
          `Řešte v $\\mathbb{R}$: $${logTex(base, `(${argument})`)} = ${k}$`,
          `Solve in $\\mathbb{R}$: $${logTex(base, `(${argument})`)} = ${k}$`,
        ),
        answer: { kind: 'set', values: [`${x0}`], label: 'K =' },
        hints: [
          L(
            'Logaritmus je exponent. Přepiš rovnici bez logaritmu.',
            'A logarithm is an exponent. Rewrite the equation without the logarithm.',
          ),
          L(`$${argument} = ${base}^{${k}}$`, `$${argument} = ${base}^{${k}}$`),
        ],
        solution: [
          step(
            'Podle definice logaritmu:',
            'By the definition of the logarithm:',
            `${argument} = ${base}^{${k}} = ${value}`,
          ),
          step('Vyřešíme lineární rovnici:', 'Solve the linear equation:', `x = ${x0}`),
          step(
            `Zkouška: argument je $${value} > 0$.`,
            `Check: the argument is $${value} > 0$.`,
            mapL(setL([x0]), (set) => `K = ${set}`),
          ),
        ],
        misconceptions: [
          mc(
            fToInput(frac(base * k - c, p)),
            'concept',
            `Na pravé straně má být mocnina $${base}^{${k}}$, ne součin $${base} \\cdot ${k}$.`,
            `The right side should be the power $${base}^{${k}}$, not the product $${base} \\cdot ${k}$.`,
          ),
          mc(
            fToInput(frac(k - c, p)),
            'concept',
            'Logaritmus nejde jen tak vynechat: argument se rovná mocnině základu.',
            'The logarithm cannot simply be dropped: the argument equals a power of the base.',
          ),
          mc(
            fToInput(frac(value + c, p)),
            'sign',
            `Při převádění $${c}$ na druhou stranu se mění znaménko.`,
            `Moving $${c}$ across changes its sign.`,
          ),
        ],
        verify: [{ kind: 'roots', expr: `${logIn(base, polyIn([p, c]))}-${k}` }],
      };
    },
  }),

  gen({
    id: 'logeq.basic.equal-logs',
    concept: 'logeq.basic',
    kind: 'core',
    levels: [2, 3],
    title: L('Rovnost dvou logaritmů a podmínky', 'Two equal logarithms, and the conditions'),
    est: (lv) => 70 + 40 * (lv - 2),
    make(r, lv) {
      const base = r.pick([2, 3, 10, 'e'] as const);
      if (lv === 2) {
        const x0 = r.int(-3, 6);
        const common = r.int(1, 9);
        const p = r.pick([1, 2, 3]);
        const q = r.pick([-1, 2, 3, 4].filter((value) => value !== p));
        const [c, d] = [common - p * x0, common - q * x0];
        const [left, right] = [polyTex([p, c]), polyTex([q, d])];
        return {
          prompt: L(
            `Řešte v $\\mathbb{R}$: $${logTex(base, `(${left})`)} = ${logTex(base, `(${right})`)}$`,
            `Solve in $\\mathbb{R}$: $${logTex(base, `(${left})`)} = ${logTex(base, `(${right})`)}$`,
          ),
          answer: { kind: 'set', values: [`${x0}`], label: 'K =' },
          hints: [
            L(
              'Logaritmus je prostá funkce: stejné logaritmy ⇒ stejné argumenty.',
              'A logarithm is one-to-one: equal logarithms ⇒ equal arguments.',
            ),
            L(
              'Po vyřešení dosaď zpět — oba argumenty musí být kladné.',
              'After solving, substitute back — both arguments must be positive.',
            ),
          ],
          solution: [
            step('Porovnáme argumenty:', 'Compare the arguments:', `${left} = ${right}`),
            step('Vyřešíme:', 'Solve:', `x = ${x0}`),
            step(
              `Zkouška: oba argumenty jsou $${common} > 0$.`,
              `Check: both arguments equal $${common} > 0$.`,
              mapL(setL([x0]), (set) => `K = ${set}`),
            ),
          ],
          misconceptions: [
            mc(`${-x0}`, 'sign', 'Znaménková chyba při převádění členů.', 'A sign error while moving terms across.'),
          ],
          verify: [{ kind: 'roots', expr: `${logIn(base, polyIn([p, c]))}-${logIn(base, polyIn([q, d]))}` }],
        };
      }
      // Level 3: x² + c = s·x + d with one root where the arguments are positive (v) and one where they are not (e).
      const e = r.int(-4, 1);
      const v = r.int(Math.max(2, 1 - e), 7);
      const s = v + e;
      // The linear argument s·x + d must be ≤ 0 at e and > 0 at v.
      const d = -s * e - r.int(0, Math.min(2, s * (v - e) - 1));
      const c = v * e + d;
      const [left, right] = [polyTex([1, 0, c]), polyTex([s, d])];
      // A bare "x" needs no brackets: log x, not log (x).
      const equation = `${logTex(base, `(${left})`)} = ${logTex(base, right === 'x' ? right : `(${right})`)}`;
      return {
        prompt: L(`Řešte v $\\mathbb{R}$: $${equation}$`, `Solve in $\\mathbb{R}$: $${equation}$`),
        answer: { kind: 'set', values: [`${v}`], label: 'K =' },
        hints: [
          L('Porovnej argumenty a vyřeš kvadratickou rovnici.', 'Compare the arguments and solve the quadratic.'),
          L(
            'Každý kořen dosaď do původní rovnice. Logaritmus existuje jen pro kladný argument.',
            'Substitute each root into the original equation. A logarithm exists only for a positive argument.',
          ),
        ],
        solution: [
          step('Porovnáme argumenty:', 'Compare the arguments:', `${left} = ${right}`),
          step(
            'Kvadratická rovnice a její kořeny:',
            'The quadratic and its roots:',
            `${polyTex([1, -s, c - d])} = 0 \\;\\Rightarrow\\; x_1 = ${e},\\; x_2 = ${v}`,
          ),
          step(
            `Zkouška pro $x = ${e}$: argument vpravo je $${s * e + d}$, logaritmus neexistuje. Nevyhovuje.`,
            `Check for $x = ${e}$: the argument on the right is $${s * e + d}$, so the logarithm does not exist. Rejected.`,
          ),
          step(
            `Zkouška pro $x = ${v}$: oba argumenty jsou $${s * v + d} > 0$. Vyhovuje.`,
            `Check for $x = ${v}$: both arguments equal $${s * v + d} > 0$. Valid.`,
            mapL(setL([v]), (set) => `K = ${set}`),
          ),
        ],
        misconceptions: [
          mc(
            `${e}; ${v}`,
            'domain',
            `Chybí zkouška: pro $x = ${e}$ není argument logaritmu kladný.`,
            `The check is missing: for $x = ${e}$ the argument of the logarithm is not positive.`,
          ),
          mc(
            `${e}`,
            'domain',
            `Pro $x = ${e}$ není argument logaritmu kladný.`,
            `For $x = ${e}$ the argument of the logarithm is not positive.`,
          ),
        ],
        verify: [{ kind: 'roots', expr: `${logIn(base, polyIn([1, 0, c]))}-${logIn(base, polyIn([s, d]))}` }],
      };
    },
  }),

  gen({
    id: 'logeq.rules.sum',
    concept: 'logeq.rules',
    kind: 'hard',
    levels: [3, 4],
    title: L('Logaritmická rovnice: nejdřív věty', 'A logarithmic equation: the laws first'),
    est: (lv) => 110 + 30 * (lv - 3),
    make(r, lv) {
      // log_b(x + c1) + log_b(x + c2) = k, from a factor pair u·w = b^k with u < w.
      const [base, k, u, w] = r.pick([
        [2, 3, 2, 4],
        [2, 3, 1, 8],
        [2, 4, 2, 8],
        [3, 2, 1, 9],
        [10, 1, 2, 5],
        [10, 1, 1, 10],
        [6, 2, 4, 9],
        [6, 2, 3, 12],
        [10, 2, 4, 25],
        [10, 2, 5, 20],
        [2, 5, 4, 8],
        [3, 3, 3, 9],
      ] as const);
      const c1 = lv === 3 ? 0 : nz(r, -4, 4);
      const x0 = u - c1;
      const c2 = w - x0;
      const other = -w - c1;
      const [first, second] = [c1 === 0 ? 'x' : `(${shiftTex(-c1)})`, `(${shiftTex(-c2)})`];
      const equation = `${logTex(base, first)} + ${logTex(base, second)} = ${k}`;
      const expanded = polyTex([1, c1 + c2, c1 * c2 - base ** k]);
      return {
        prompt: L(`Řešte v $\\mathbb{R}$: $${equation}$`, `Solve in $\\mathbb{R}$: $${equation}$`),
        answer: { kind: 'set', values: [`${x0}`], label: 'K =' },
        hints: [
          L('Nejdřív podmínky: oba argumenty musí být kladné.', 'Conditions first: both arguments must be positive.'),
          L(
            'Součet logaritmů je logaritmus součinu. Potom podle definice.',
            'A sum of logarithms is the logarithm of the product. Then use the definition.',
          ),
          L(
            'Jeden z kořenů kvadratické rovnice podmínky nesplní.',
            'One root of the quadratic will fail the conditions.',
          ),
        ],
        solution: [
          step('Podmínky:', 'Conditions:', `x > ${Math.max(-c1, -c2)}`),
          step(
            'Logaritmus součinu:',
            'Logarithm of a product:',
            `${logTex(base, `\\big[${c1 === 0 ? 'x' : first}${second}\\big]`)} = ${k}`,
          ),
          step(
            'Podle definice:',
            'By the definition:',
            `${c1 === 0 ? 'x' : first}${second} = ${base}^{${k}} = ${base ** k}`,
          ),
          step(
            'Kvadratická rovnice a kořeny:',
            'The quadratic and its roots:',
            `${expanded} = 0 \\;\\Rightarrow\\; x_1 = ${other},\\; x_2 = ${x0}`,
          ),
          step(
            `$x = ${other}$ nesplňuje podmínky (argumenty by byly záporné).`,
            `$x = ${other}$ fails the conditions (the arguments would be negative).`,
            mapL(setL([x0]), (set) => `K = ${set}`),
          ),
        ],
        misconceptions: [
          mc(
            `${other}; ${x0}`,
            'domain',
            `Chybí podmínky: pro $x = ${other}$ jsou argumenty logaritmů záporné.`,
            `The conditions are missing: for $x = ${other}$ the arguments of the logarithms are negative.`,
          ),
          mc(
            fToInput(frac(base ** k - c1 - c2, 2)),
            'formula',
            'Součet logaritmů je logaritmus součinu, ne součtu argumentů.',
            'A sum of logarithms is the logarithm of the product, not of the sum of the arguments.',
          ),
        ],
        verify: [{ kind: 'roots', expr: `${logIn(base, shiftIn(-c1))}+${logIn(base, shiftIn(-c2))}-${k}` }],
      };
    },
  }),

  gen({
    id: 'logeq.rules.substitution',
    concept: 'logeq.rules',
    kind: 'hard',
    levels: [3, 4],
    title: L('Logaritmická rovnice: substituce', 'A logarithmic equation: substitution'),
    est: (lv) => 120 + 30 * (lv - 3),
    make(r, lv) {
      const base = r.pick([10, 2, 3]);
      const span = base === 10 ? [-1, 0, 1, 2, 3] : [-2, -1, 0, 1, 2, 3];
      // Level 4 needs a middle term and a constant, so neither root is 0 and they are not opposite.
      const usable = lv === 4 ? span.filter((value) => value !== 0) : span;
      const m = r.pick(usable);
      const n = r.pick(usable.filter((value) => value !== m && (lv === 3 || value !== -m)));
      const [lo, hi] = m < n ? [m, n] : [n, m];
      const log = logTex(base, 'x');
      const sq = base === 10 ? '\\log^2 x' : `\\log_{${base}}^2 x`;
      const sum = lo + hi;
      const product = lo * hi;
      const roots = [power(frac(base), lo), power(frac(base), hi)];
      const quadratic = polyTex([1, -sum, product], { variable: 't' });
      // Level 3 shows the quadratic in log x openly. Level 4 hides it in a product:
      // log x · log(b^j·x) = C, where log(b^j·x) = j + log x gives t(t + j) = C.
      const j = -sum;
      const scaled = power(frac(base), Math.abs(j));
      const shifted = j > 0 ? `${fToTex(scaled)}x` : `\\dfrac{x}{${fToTex(scaled)}}`;
      const shiftedIn = j > 0 ? `${fToInput(scaled)}*x` : `x/${fToInput(scaled)}`;
      const second = logTex(base, j > 0 ? `(${shifted})` : `\\left(${shifted}\\right)`);
      const openForm = `${sq}${sum === 0 ? '' : ` ${sum > 0 ? '-' : '+'} ${Math.abs(sum) === 1 ? '' : Math.abs(sum)}${log}`}${tailTex(product)} = 0`;
      const equation = lv === 3 ? openForm : `${log} \\cdot ${second} = ${-product}`;
      const split = `${second} = ${log} ${j > 0 ? '+' : '-'} ${Math.abs(j)}`;
      return {
        prompt: L(`Řešte v $\\mathbb{R}$: $${equation}$`, `Solve in $\\mathbb{R}$: $${equation}$`),
        answer: { kind: 'set', values: roots.map(fToInput), label: 'K =' },
        hints: [
          lv === 3
            ? L(
                `Logaritmus se v rovnici opakuje. Polož $t = ${log}$.`,
                `The logarithm repeats in the equation. Put $t = ${log}$.`,
              )
            : L(
                `Druhý logaritmus rozlož podle vět o logaritmech: $${split}$. Pak polož $t = ${log}$.`,
                `Split the second logarithm with the laws of logarithms: $${split}$. Then put $t = ${log}$.`,
              ),
          L(
            `Vyřeš $${quadratic} = 0$ a pak se vrať k $x = ${base}^{t}$.`,
            `Solve $${quadratic} = 0$, then return to $x = ${base}^{t}$.`,
          ),
        ],
        solution: [
          ...(lv === 4
            ? [
                step(
                  j > 0 ? 'Logaritmus součinu:' : 'Logaritmus podílu:',
                  j > 0 ? 'Logarithm of a product:' : 'Logarithm of a quotient:',
                  split,
                ),
              ]
            : []),
          step(
            `Podmínka $x > 0$. Substituce $t = ${log}$:`,
            `Condition $x > 0$. Substitution $t = ${log}$:`,
            lv === 3
              ? `${quadratic} = 0`
              : `t\\,(t ${j > 0 ? '+' : '-'} ${Math.abs(j)}) = ${-product} \\;\\Rightarrow\\; ${quadratic} = 0`,
          ),
          step('Kořeny:', 'Roots:', `t_1 = ${lo},\\; t_2 = ${hi}`),
          step(
            `Zpět k $x$ podle definice ($x = ${base}^{t}$):`,
            `Back to $x$ by the definition ($x = ${base}^{t}$):`,
            `x_1 = ${fToTex(roots[0]!)},\\; x_2 = ${fToTex(roots[1]!)}`,
          ),
          step(
            'Obě hodnoty jsou kladné, obě vyhovují.',
            'Both values are positive, so both are valid.',
            mapL(setL(roots), (set) => `K = ${set}`),
          ),
        ],
        misconceptions: [
          mc(
            `${lo}; ${hi}`,
            'incomplete',
            `To jsou hodnoty $t$. Ještě je potřeba vrátit se k $x = ${base}^{t}$.`,
            `Those are values of $t$. You still have to go back to $x = ${base}^{t}$.`,
          ),
          ...(lo < 0
            ? [
                mc(
                  fToInput(roots[1]!),
                  'domain',
                  `Záporné $t$ není problém: $x = ${base}^{${lo}}$ je kladné číslo.`,
                  `A negative $t$ is no problem: $x = ${base}^{${lo}}$ is a positive number.`,
                ),
              ]
            : []),
          mc(
            `${base * lo}; ${base * hi}`,
            'concept',
            `$x = ${base}^{t}$, ne $${base} \\cdot t$.`,
            `$x = ${base}^{t}$, not $${base} \\cdot t$.`,
          ),
        ],
        verify: [
          {
            kind: 'roots',
            expr:
              lv === 3
                ? `(${logIn(base, 'x')})^2-(${sum})*(${logIn(base, 'x')})+(${product})`
                : `(${logIn(base, 'x')})*(${logIn(base, shiftedIn)})-(${-product})`,
            range: [0.01, 1100],
          },
        ],
      };
    },
  }),
];
