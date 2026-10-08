import { L, fToInput, fToTex, frac, intervalIn, intervalL, polyIn, polyTex, type Generator } from '@lemma/core';
import { distinct, gen, leadIn, leadTex, mapL, mc, nz, shiftIn, shiftTex, step, tailIn, tailTex } from './helpers';

/** Functions that are (or are not) one-to-one on all of ℝ, for the "which is injective?" question. */
const INJECTIVE: { tex: string; why: L }[] = [
  {
    tex: '2x - 3',
    why: L(
      'Lineární funkce s nenulovou směrnicí stále roste.',
      'A linear function with a non-zero slope keeps increasing.',
    ),
  },
  {
    tex: '-x + 4',
    why: L(
      'Lineární funkce se zápornou směrnicí stále klesá.',
      'A linear function with a negative slope keeps decreasing.',
    ),
  },
  { tex: 'x^3', why: L('Třetí mocnina roste na celém $\\mathbb{R}$.', 'The cube increases on all of $\\mathbb{R}$.') },
  { tex: 'x^3 + 1', why: L('Posunutá třetí mocnina stále roste.', 'A shifted cube still increases everywhere.') },
  {
    tex: '5 - 3x',
    why: L(
      'Lineární funkce se zápornou směrnicí stále klesá.',
      'A linear function with a negative slope keeps decreasing.',
    ),
  },
];
const NOT_INJECTIVE: { tex: string; pair: [number, number] }[] = [
  { tex: 'x^2', pair: [-2, 2] },
  { tex: '|x|', pair: [-3, 3] },
  { tex: 'x^2 - 4', pair: [-1, 1] },
  { tex: 'x^4', pair: [-1, 1] },
  { tex: '|x - 2|', pair: [1, 3] },
  { tex: '(x - 1)^2', pair: [0, 2] },
  { tex: '6', pair: [0, 1] },
];

/** Syllabus topic 6: one-to-one functions and inverses. */
export const INVERSE_GENERATORS: Generator[] = [
  gen({
    id: 'inv.concept.injective',
    concept: 'inv.concept',
    kind: 'warmup',
    levels: [1, 2],
    title: L('Je funkce prostá?', 'Is the function one-to-one?'),
    est: (lv) => 30 + 20 * lv,
    make(r, lv) {
      if (lv === 1) {
        const good = r.pick(INJECTIVE);
        const bad = r.sample(NOT_INJECTIVE, 3);
        const options = r.shuffle([
          { id: 'good', text: L(`$f(x) = ${good.tex}$`, `$f(x) = ${good.tex}$`) },
          ...bad.map((item, index) => ({ id: `bad${index}`, text: L(`$f(x) = ${item.tex}$`, `$f(x) = ${item.tex}$`) })),
        ]);
        return {
          prompt: L(
            'Která z funkcí je prostá na celém $\\mathbb{R}$?',
            'Which of these functions is one-to-one on all of $\\mathbb{R}$?',
          ),
          answer: { kind: 'choice', options, correct: ['good'], fixedOrder: true },
          hints: [
            L(
              'Prostá funkce nikdy nenabude stejné hodnoty ve dvou různých bodech.',
              'A one-to-one function never takes the same value at two different points.',
            ),
            L(
              'Zkus u každé najít dvě různá $x$ se stejným $f(x)$. U které to nejde?',
              'For each, try to find two different $x$ with the same $f(x)$. For which one is it impossible?',
            ),
          ],
          solution: [
            step(`$f(x) = ${good.tex}$: ${good.why.cs}`, `$f(x) = ${good.tex}$: ${good.why.en}`),
            ...bad.map((item) =>
              step(
                `$f(x) = ${item.tex}$ prostá není: $f(${item.pair[0]}) = f(${item.pair[1]})$.`,
                `$f(x) = ${item.tex}$ is not: $f(${item.pair[0]}) = f(${item.pair[1]})$.`,
              ),
            ),
          ],
          misconceptions: bad.map((item, index) =>
            mc(
              `bad${index}`,
              'concept',
              `Tahle prostá není: $f(${item.pair[0]}) = f(${item.pair[1]})$, dvě různá $x$ dávají stejnou hodnotu.`,
              `This one is not: $f(${item.pair[0]}) = f(${item.pair[1]})$, two different $x$ give the same value.`,
            ),
          ),
        };
      }
      // Level 2: a parabola restricted to an interval — one-to-one or not?
      const m = r.int(-3, 4);
      const c = r.int(-4, 4);
      const coeffs = [1, -2 * m, m * m + c];
      const side = r.pick(['right', 'left', 'across'] as const);
      const width = r.int(1, 3);
      const interval =
        side === 'right'
          ? intervalL(m + r.int(0, 2), 'inf', true, false)
          : side === 'left'
            ? intervalL('-inf', m - r.int(0, 2), false, true)
            : intervalL(m - width, m + width + 1, true, true);
      const injective = side !== 'across';
      return {
        prompt: L(
          `Je funkce $f(x) = ${polyTex(coeffs)}$ prostá na intervalu $${interval.cs}$?`,
          `Is $f(x) = ${polyTex(coeffs)}$ one-to-one on the interval $${interval.en}$?`,
        ),
        answer: {
          kind: 'choice',
          fixedOrder: true,
          options: [
            { id: 'yes', text: L('ano', 'yes') },
            { id: 'no', text: L('ne', 'no') },
          ],
          correct: [injective ? 'yes' : 'no'],
        },
        hints: [
          L(
            'Parabola je prostá jen tam, kde pořád roste, nebo pořád klesá. Kde se to láme?',
            'A parabola is one-to-one only where it keeps rising or keeps falling. Where does that change?',
          ),
          L(
            `Vrchol má $x$-ovou souřadnici $-\\dfrac{b}{2a} = ${m}$. Leží uvnitř intervalu?`,
            `The vertex has $x$-coordinate $-\\dfrac{b}{2a} = ${m}$. Is it inside the interval?`,
          ),
        ],
        solution: [
          step('Vrchol paraboly:', 'Vertex of the parabola:', `x_V = -\\frac{b}{2a} = ${m}`),
          step(
            injective
              ? `Interval leží celý na jedné straně od vrcholu, funkce je na něm ${side === 'right' ? 'rostoucí' : 'klesající'}, tedy prostá.`
              : `Vrchol leží uvnitř intervalu: funkce na něm nejdřív klesá a pak roste, například $f(${m - 1}) = f(${m + 1})$. Prostá není.`,
            injective
              ? `The interval lies entirely on one side of the vertex; the function is ${side === 'right' ? 'increasing' : 'decreasing'} there, hence one-to-one.`
              : `The vertex lies inside the interval: the function first falls, then rises, e.g. $f(${m - 1}) = f(${m + 1})$. It is not one-to-one.`,
          ),
        ],
        misconceptions: [
          mc(
            injective ? 'no' : 'yes',
            'concept',
            injective
              ? 'Na celém $\\mathbb{R}$ by prostá nebyla, ale tady se ptáme jen na jednu stranu od vrcholu.'
              : 'Interval obsahuje vrchol, takže po obou stranách od něj funkce nabývá stejných hodnot.',
            injective
              ? 'On all of $\\mathbb{R}$ it would not be, but here only one side of the vertex is in question.'
              : 'The interval contains the vertex, so the function takes the same values on both sides of it.',
          ),
        ],
      };
    },
  }),

  gen({
    id: 'inv.concept.values',
    concept: 'inv.concept',
    kind: 'core',
    levels: [1, 2, 3],
    title: L('Hodnota inverzní funkce', 'A value of the inverse function'),
    est: (lv) => 35 + 20 * lv,
    make(r, lv) {
      if (lv === 1) {
        const xs = distinct(r, 1, 9, 4);
        const ys = distinct(r, -6, 12, 4, xs);
        const index = r.int(0, 3);
        const pairs = xs.map((x, i) => `f(${x}) = ${ys[i]}`).join(',\\quad ');
        return {
          prompt: L(
            `O prosté funkci $f$ víme: $${pairs}$. Určete $f^{-1}(${ys[index]})$.`,
            `For a one-to-one function $f$ we know: $${pairs}$. Find $f^{-1}(${ys[index]})$.`,
          ),
          answer: { kind: 'number', value: `${xs[index]}`, label: `f^{-1}(${ys[index]}) =` },
          hints: [
            L(
              'Inverzní funkce běží pozpátku: z výsledku zjistí, co do funkce vstoupilo.',
              'The inverse runs backwards: from the result it finds what went into the function.',
            ),
            L(
              `Hledáš $x$, pro které $f(x) = ${ys[index]}$.`,
              `You are looking for the $x$ with $f(x) = ${ys[index]}$.`,
            ),
          ],
          solution: [
            step(
              `Protože $f(${xs[index]}) = ${ys[index]}$, je`,
              `Since $f(${xs[index]}) = ${ys[index]}$,`,
              `f^{-1}(${ys[index]}) = ${xs[index]}`,
            ),
          ],
          misconceptions: [],
        };
      }
      if (lv === 2) {
        const a = r.pick([2, 3, 4, -2, -3, 5]);
        const b = nz(r, -7, 7);
        const x0 = nz(r, -5, 5);
        const y0 = a * x0 + b;
        const fTex = `${leadTex(a)}x${tailTex(b)}`;
        return {
          prompt: L(
            `Je dána funkce $f(x) = ${fTex}$. Určete $f^{-1}(${y0})$.`,
            `Let $f(x) = ${fTex}$. Find $f^{-1}(${y0})$.`,
          ),
          answer: { kind: 'number', value: `${x0}`, label: `f^{-1}(${y0}) =` },
          hints: [
            L(
              `$f^{-1}(${y0})$ je to $x$, pro které $f(x) = ${y0}$. Předpis inverzní funkce k tomu nepotřebuješ.`,
              `$f^{-1}(${y0})$ is the $x$ for which $f(x) = ${y0}$. You do not need a formula for the inverse.`,
            ),
            L(`Vyřeš rovnici $${fTex} = ${y0}$.`, `Solve the equation $${fTex} = ${y0}$.`),
          ],
          solution: [
            step(
              'Hledáme $x$, pro které $f(x)$ dá požadovanou hodnotu:',
              'We look for the $x$ at which $f(x)$ gives the required value:',
              `${fTex} = ${y0}`,
            ),
            step('Vyřešíme:', 'Solve:', `${leadTex(a)}x = ${y0 - b} \\;\\Rightarrow\\; x = ${x0}`),
          ],
          misconceptions: [
            mc(
              `${a * y0 + b}`,
              'concept',
              `To je $f(${y0})$. Inverzní funkce jde opačným směrem: řeš $f(x) = ${y0}$.`,
              `That is $f(${y0})$. The inverse goes the other way: solve $f(x) = ${y0}$.`,
            ),
            ...(Math.abs(y0) > 1
              ? [
                  mc(
                    fToInput(frac(1, y0)),
                    'concept',
                    '$f^{-1}$ není převrácená hodnota $\\frac{1}{f}$.',
                    '$f^{-1}$ is not the reciprocal $\\frac{1}{f}$.',
                  ),
                ]
              : []),
            mc(
              fToInput(frac(y0 + b, a)),
              'sign',
              `Při převádění $${b}$ na druhou stranu se mění znaménko.`,
              `Moving $${b}$ across changes its sign.`,
            ),
          ],
          verify: [{ kind: 'value', expr: `(${y0}-(${b}))/(${a})` }],
        };
      }
      const c = nz(r, -6, 6);
      const t = nz(r, -3, 3);
      const y0 = t ** 3 + c;
      return {
        prompt: L(
          `Je dána funkce $f(x) = x^3${tailTex(c)}$. Určete $f^{-1}(${y0})$.`,
          `Let $f(x) = x^3${tailTex(c)}$. Find $f^{-1}(${y0})$.`,
        ),
        answer: { kind: 'number', value: `${t}`, label: `f^{-1}(${y0}) =` },
        hints: [
          L(
            `Hledáš $x$, pro které $x^3${tailTex(c)} = ${y0}$.`,
            `You are looking for the $x$ with $x^3${tailTex(c)} = ${y0}$.`,
          ),
          L(
            `Po úpravě $x^3 = ${y0 - c}$. Třetí odmocnina zachovává znaménko.`,
            `Rearranged, $x^3 = ${y0 - c}$. A cube root keeps the sign.`,
          ),
        ],
        solution: [
          step('Řešíme $f(x) = ' + y0 + '$:', 'Solve $f(x) = ' + y0 + '$:', `x^3 = ${y0 - c}`),
          step('Třetí odmocnina:', 'Cube root:', `x = ${t}`),
        ],
        misconceptions: [
          mc(
            `${-t}`,
            'sign',
            'Třetí odmocnina ze záporného čísla je záporná a naopak.',
            'The cube root of a negative number is negative, and vice versa.',
          ),
          mc(
            `${y0 ** 3 + c}`,
            'concept',
            `To je $f(${y0})$, ne $f^{-1}(${y0})$.`,
            `That is $f(${y0})$, not $f^{-1}(${y0})$.`,
          ),
        ],
        verify: [{ kind: 'value', expr: `cbrt(${y0}-(${c}))` }],
      };
    },
  }),

  gen({
    id: 'inv.find.linear',
    concept: 'inv.find',
    kind: 'core',
    levels: [1, 2],
    title: L('Inverze k lineární funkci', 'Inverse of a linear function'),
    tags: ['annual-review'],
    est: (lv) => 50 + 25 * lv,
    make(r, lv) {
      const a = lv === 1 ? r.pick([2, 3, 4, 5, -2, -3]) : r.pick([2, 3, -2, -4, 5]);
      const den = lv === 1 ? 1 : r.pick([2, 3].filter((d) => Math.abs(a) % d !== 0));
      const slope = frac(a, den);
      const b = nz(r, -6, 6);
      const fTex = `${den === 1 ? leadTex(a) : fToTex(slope)}x${tailTex(b)}`;
      // y = (a/den)x + b  ⇒  x = den(y − b)/a
      const invIn = `${den === 1 ? '' : `${den}*`}(${shiftIn(b)})/(${a})`;
      const invTex = `\\dfrac{${den === 1 ? '' : den}${den === 1 ? shiftTex(b) : `(${shiftTex(b)})`}}{${a}}`;
      return {
        prompt: L(
          `Určete předpis inverzní funkce k funkci $f(x) = ${fTex}$.`,
          `Find the formula of the inverse of $f(x) = ${fTex}$.`,
        ),
        answer: { kind: 'expr', value: invIn, vars: ['x'], label: 'f^{-1}(x) =' },
        hints: [
          L(
            'Zapiš $y = f(x)$, prohoď $x$ a $y$ a vyjádři $y$.',
            'Write $y = f(x)$, swap $x$ and $y$, and solve for $y$.',
          ),
          L(
            `Po záměně: $x = ${den === 1 ? leadTex(a) : fToTex(slope)}y${tailTex(b)}$. Nejdřív převeď $${b}$, teprve potom děl.`,
            `After swapping: $x = ${den === 1 ? leadTex(a) : fToTex(slope)}y${tailTex(b)}$. Move $${b}$ across first, and only then divide.`,
          ),
        ],
        solution: [
          step(
            'Zaměníme proměnné:',
            'Swap the variables:',
            `x = ${den === 1 ? leadTex(a) : fToTex(slope)}y${tailTex(b)}`,
          ),
          step(
            `Převedeme $${b}$ na druhou stranu:`,
            `Move $${b}$ to the other side:`,
            `${shiftTex(b)} = ${den === 1 ? leadTex(a) : fToTex(slope)}y`,
          ),
          step(
            den === 1 ? `Vydělíme $${a}$:` : `Vynásobíme $${den}$ a vydělíme $${a}$:`,
            den === 1 ? `Divide by $${a}$:` : `Multiply by $${den}$ and divide by $${a}$:`,
            `f^{-1}(x) = ${invTex}`,
          ),
        ],
        misconceptions: [
          mc(
            `${den}*x/(${a})-(${b})`,
            'algebra',
            `Dělit se musí celá strana: $(${shiftTex(b)})$, ne jen $x$.`,
            `The whole side has to be divided: $(${shiftTex(b)})$, not just $x$.`,
          ),
          mc(
            `${den}*(x+(${b}))/(${a})`,
            'sign',
            `Při převádění $${b}$ na druhou stranu se mění znaménko.`,
            `Moving $${b}$ across changes its sign.`,
          ),
          mc(
            `1/(${a}/${den}*x+(${b}))`,
            'concept',
            '$f^{-1}$ není převrácená hodnota $\\frac{1}{f(x)}$.',
            '$f^{-1}$ is not the reciprocal $\\frac{1}{f(x)}$.',
          ),
          mc(
            `(${a})*(x-(${b}))/${den}`,
            'algebra',
            'Směrnice inverzní funkce je převrácená: dělíš, nenásobíš.',
            'The slope of the inverse is the reciprocal: you divide, not multiply.',
          ),
        ],
        // The inverse must undo f: f⁻¹(f(t)) = t.
        verify: [{ kind: 'passes', points: [-2, 0, 3].map((t): [number, number] => [(a / den) * t + b, t]) }],
      };
    },
  }),

  gen({
    id: 'inv.find.nonlinear',
    concept: 'inv.find',
    kind: 'hard',
    levels: [3, 4],
    title: L('Inverze k lomené, odmocninové a kvadratické funkci', 'Inverse of a rational, root or quadratic function'),
    est: (lv) => 110 + 40 * (lv - 3),
    make(r, lv) {
      if (lv === 3 && r.bool()) {
        const m = nz(r, -5, 5);
        const n = nz(r, -4, 4);
        const fTex = `\\sqrt{${shiftTex(m)}}${tailTex(n)}`;
        return {
          prompt: L(
            `Určete předpis inverzní funkce k funkci $f(x) = ${fTex}$.`,
            `Find the formula of the inverse of $f(x) = ${fTex}$.`,
          ),
          answer: { kind: 'expr', value: `(${shiftIn(n)})^2${tailIn(m)}`, vars: ['x'], label: 'f^{-1}(x) =' },
          hints: [
            L(
              'Zaměň $x$ a $y$, osamostatni odmocninu a pak umocni.',
              'Swap $x$ and $y$, isolate the root, then square.',
            ),
            L(
              `Po záměně a převedení: $${shiftTex(n)} = \\sqrt{${shiftTex(m, 'y')}}$.`,
              `After swapping and rearranging: $${shiftTex(n)} = \\sqrt{${shiftTex(m, 'y')}}$.`,
            ),
          ],
          solution: [
            step('Zaměníme proměnné:', 'Swap the variables:', `x = \\sqrt{${shiftTex(m, 'y')}}${tailTex(n)}`),
            step(
              'Osamostatníme odmocninu a umocníme:',
              'Isolate the root and square:',
              `(${shiftTex(n)})^2 = ${shiftTex(m, 'y')}`,
            ),
            step(
              `Vyjádříme $y$. Protože $f$ nabývá jen hodnot $\\ge ${n}$, je inverze definovaná jen pro $x \\ge ${n}$.`,
              `Solve for $y$. Since $f$ only takes values $\\ge ${n}$, the inverse is defined only for $x \\ge ${n}$.`,
              `f^{-1}(x) = (${shiftTex(n)})^2${tailTex(m)},\\quad x \\ge ${n}`,
            ),
          ],
          misconceptions: [
            mc(
              `(${shiftIn(-n)})^2+(${m})`,
              'sign',
              `Při převádění $${n}$ na druhou stranu se mění znaménko.`,
              `Moving $${n}$ across changes its sign.`,
            ),
            mc(
              `x^2-(${n})+(${m})`,
              'algebra',
              `Umocnit se musí celá strana $(${shiftTex(n)})$, ne jen $x$.`,
              `The whole side $(${shiftTex(n)})$ has to be squared, not just $x$.`,
            ),
            mc(
              `(${shiftIn(n)})^2-(${m})`,
              'sign',
              `Při převádění $${-m}$ na druhou stranu se mění znaménko.`,
              `Moving $${-m}$ across changes its sign.`,
            ),
          ],
          verify: [{ kind: 'passes', points: [0, 1, 4, 9].map((t): [number, number] => [Math.sqrt(t) + n, t + m]) }],
        };
      }
      if (lv === 3) {
        // f(x) = (a·x + b)/(x + c), invertible when b ≠ a·c.
        const a = nz(r, -4, 4);
        const c = nz(r, -4, 4);
        const b = r.intExcept(-6, 6, [a * c, 0]);
        const fTex = `\\dfrac{${leadTex(a)}x${tailTex(b)}}{x${tailTex(c)}}`;
        // x(y + c) = a·y + b  ⇒  y(x − a) = b − c·x
        const numTex = polyTex([-c, b]);
        return {
          prompt: L(
            `Určete předpis inverzní funkce k funkci $f(x) = ${fTex}$.`,
            `Find the formula of the inverse of $f(x) = ${fTex}$.`,
          ),
          answer: { kind: 'expr', value: `(${polyIn([-c, b])})/(${shiftIn(a)})`, vars: ['x'], label: 'f^{-1}(x) =' },
          hints: [
            L(
              'Zaměň $x$ a $y$ a zbav se zlomku vynásobením jmenovatelem.',
              'Swap $x$ and $y$ and clear the fraction by multiplying by the denominator.',
            ),
            L(
              'Všechny členy s $y$ převeď na jednu stranu a $y$ vytkni.',
              'Collect every term containing $y$ on one side and factor $y$ out.',
            ),
          ],
          solution: [
            step(
              'Zaměníme proměnné a vynásobíme jmenovatelem:',
              'Swap the variables and multiply by the denominator:',
              `x(y${tailTex(c)}) = ${leadTex(a)}y${tailTex(b)}`,
            ),
            step(
              'Členy s $y$ na jednu stranu:',
              'Terms with $y$ on one side:',
              `xy ${a > 0 ? '-' : '+'} ${Math.abs(a) === 1 ? '' : Math.abs(a)}y = ${numTex}`,
            ),
            step(
              'Vytkneme $y$ a vydělíme:',
              'Factor out $y$ and divide:',
              `f^{-1}(x) = \\dfrac{${numTex}}{${shiftTex(a)}}`,
            ),
          ],
          misconceptions: [
            mc(
              `(x+(${c}))/((${a})*x+(${b}))`,
              'concept',
              'To je převrácená hodnota $\\frac{1}{f(x)}$, ne inverzní funkce.',
              'That is the reciprocal $\\frac{1}{f(x)}$, not the inverse function.',
            ),
            mc(
              `(${polyIn([c, b])})/(${shiftIn(a)})`,
              'sign',
              `Člen $${c}x$ mění při převedení znaménko.`,
              `The term $${c}x$ changes sign when moved across.`,
            ),
            mc(
              `(${polyIn([-c, b])})/(${shiftIn(-a)})`,
              'sign',
              `Člen $${a}y$ mění při převedení znaménko.`,
              `The term $${a}y$ changes sign when moved across.`,
            ),
          ],
          verify: [
            {
              kind: 'passes',
              points: [0, 1, 2].filter((t) => t + c !== 0).map((t): [number, number] => [(a * t + b) / (t + c), t]),
            },
          ],
        };
      }
      // Level 4: a parabola restricted to the right of its vertex.
      const m = nz(r, -4, 4);
      const n = r.int(-5, 5);
      const coeffs = [1, -2 * m, m * m + n];
      const domain = intervalL(m, 'inf', true, false);
      return {
        prompt: L(
          `Funkce $f(x) = ${polyTex(coeffs)}$ je definovaná jen pro $x \\in ${domain.cs}$. Určete předpis $f^{-1}$.`,
          `The function $f(x) = ${polyTex(coeffs)}$ is defined only for $x \\in ${domain.en}$. Find the formula of $f^{-1}$.`,
        ),
        answer: { kind: 'expr', value: `${m}+sqrt(${shiftIn(n)})`, vars: ['x'], label: 'f^{-1}(x) =' },
        hints: [
          L(
            'S $x$ na dvou místech se $y$ vyjádřit nedá. Doplň na čtverec, ať je tam jen jednou.',
            'With $x$ in two places you cannot solve for it. Complete the square so that it appears once.',
          ),
          L(
            `$f(x) = (${shiftTex(m)})^2${tailTex(n)}$. Po záměně proměnných odmocni — a rozmysli znaménko podle definičního oboru.`,
            `$f(x) = (${shiftTex(m)})^2${tailTex(n)}$. After swapping variables take the root — and choose the sign from the domain.`,
          ),
        ],
        solution: [
          step('Doplníme na čtverec:', 'Complete the square:', `f(x) = (${shiftTex(m)})^2${tailTex(n)}`),
          step(
            'Zaměníme proměnné a osamostatníme čtverec:',
            'Swap the variables and isolate the square:',
            `${shiftTex(n)} = (${shiftTex(m, 'y')})^2`,
          ),
          step(
            `Odmocníme. Původní $x \\ge ${m}$ je teď $y \\ge ${m}$, takže bereme kladnou odmocninu:`,
            `Take the root. The original $x \\ge ${m}$ is now $y \\ge ${m}$, so the positive root applies:`,
            `${shiftTex(m, 'y')} = \\sqrt{${shiftTex(n)}}`,
          ),
          step('Inverzní funkce:', 'The inverse:', `f^{-1}(x) = ${m} + \\sqrt{${shiftTex(n)}},\\quad x \\ge ${n}`),
        ],
        misconceptions: [
          mc(
            `${m}-sqrt(x-(${n}))`,
            'domain',
            `To je inverze druhé poloviny paraboly. Tady je $x \\ge ${m}$, takže před odmocninou je plus.`,
            `That is the inverse of the other half of the parabola. Here $x \\ge ${m}$, so the root takes a plus.`,
          ),
          mc(
            `${-m}+sqrt(x-(${n}))`,
            'sign',
            `Vrchol je v $x = ${m}$: po odmocnění $y${tailTex(-m)} = \\sqrt{\\dots}$.`,
            `The vertex is at $x = ${m}$: after the root, $y${tailTex(-m)} = \\sqrt{\\dots}$.`,
          ),
          mc(
            `${m}+sqrt(x+(${n}))`,
            'sign',
            `Při převádění $${n}$ na druhou stranu se mění znaménko.`,
            `Moving $${n}$ across changes its sign.`,
          ),
        ],
        verify: [{ kind: 'passes', points: [0, 1, 2, 3].map((t): [number, number] => [t * t + n, m + t]) }],
      };
    },
  }),

  gen({
    id: 'inv.find.domain',
    concept: 'inv.find',
    kind: 'core',
    levels: [2, 3],
    title: L('Definiční obor inverzní funkce', 'Domain of the inverse function'),
    est: (lv) => 55 + 25 * lv,
    make(r, lv) {
      const m = nz(r, -4, 4);
      const n = nz(r, -4, 4);
      const down = lv === 3 && r.bool();
      // √ rises from n; with a minus in front it falls from n.
      const fTex = `${down ? '-' : ''}\\sqrt{${shiftTex(m)}}${tailTex(n)}`;
      const fIn = `${down ? '-' : ''}sqrt(${shiftIn(m)})${tailIn(n)}`;
      const value = down ? intervalIn('-inf', n, false, true) : intervalIn(n, 'inf', true, false);
      const valueL = down ? intervalL('-inf', n, false, true) : intervalL(n, 'inf', true, false);
      return {
        prompt: L(
          `Určete definiční obor inverzní funkce k funkci $f(x) = ${fTex}$.`,
          `Find the domain of the inverse of $f(x) = ${fTex}$.`,
        ),
        answer: { kind: 'interval', value, label: 'D(f^{-1}) =' },
        hints: [
          L(
            'Inverzní funkce bere jako vstup to, co původní funkce vydala. Čemu se tedy rovná její definiční obor?',
            'The inverse takes as input what the original function produced. So what does its domain equal?',
          ),
          L(
            `$D(f^{-1}) = H(f)$. Jakých hodnot nabývá $${fTex}$? Odmocnina sama je vždy $\\ge 0$.`,
            `$D(f^{-1}) = H(f)$. Which values does $${fTex}$ take? The root itself is always $\\ge 0$.`,
          ),
        ],
        solution: [
          step(
            'Definiční obor inverzní funkce je obor hodnot původní funkce.',
            'The domain of the inverse is the range of the original function.',
            'D(f^{-1}) = H(f)',
          ),
          step(
            down
              ? `Odmocnina je $\\ge 0$, s minusem před ní $\\le 0$; po přičtení $${n}$ jsou hodnoty nejvýše $${n}$.`
              : `Odmocnina je $\\ge 0$; po přičtení $${n}$ jsou hodnoty nejméně $${n}$.`,
            down
              ? `The root is $\\ge 0$, with the minus in front $\\le 0$; after adding $${n}$ the values are at most $${n}$.`
              : `The root is $\\ge 0$; after adding $${n}$ the values are at least $${n}$.`,
            mapL(valueL, (iv) => `D(f^{-1}) = ${iv}`),
          ),
        ],
        misconceptions: [
          mc(
            intervalIn(m, 'inf', true, false),
            'concept',
            'To je definiční obor $f$. Inverzní funkce má definiční obor rovný oboru hodnot $f$.',
            'That is the domain of $f$. The domain of the inverse equals the range of $f$.',
          ),
          mc(
            'R',
            'domain',
            'Inverze je definovaná jen pro hodnoty, kterých $f$ opravdu nabývá.',
            'The inverse is defined only for values that $f$ actually takes.',
          ),
          mc(
            down ? intervalIn(n, 'inf', true, false) : intervalIn('-inf', n, false, true),
            'graph',
            down
              ? 'Minus před odmocninou graf překlápí: hodnoty jdou od ' + n + ' dolů.'
              : 'Odmocnina roste: hodnoty jdou od ' + n + ' nahoru.',
            down
              ? 'The minus in front of the root flips the graph: values go down from ' + n + '.'
              : 'The root increases: values go up from ' + n + '.',
          ),
          mc(
            down ? intervalIn('-inf', n, false, false) : intervalIn(n, 'inf', false, false),
            'notation',
            `Hodnoty $${n}$ funkce nabývá (v bodě $x = ${m}$), krajní bod tam patří.`,
            `The function does take the value $${n}$ (at $x = ${m}$); the endpoint belongs.`,
          ),
        ],
        verify: [{ kind: 'range', expr: fIn, over: [m, m + 400] }],
      };
    },
  }),
];
