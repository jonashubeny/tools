import {
  L,
  fToInput,
  fToTex,
  frac,
  fSub,
  fMul,
  nIn,
  nTex,
  pTex,
  pointL,
  polyIn,
  polyTex,
  type FigureSpec,
  type Generator,
} from '@lemma/core';
import { HINT, distinct, gen, mapL, mc, nz, par, step, tailTex } from './helpers';

/** A plot window that comfortably shows the given points. */
function windowFor(points: readonly (readonly [number, number])[], pad = 2): FigureSpec['view'] {
  const xs = points.map((p) => p[0]);
  const ys = points.map((p) => p[1]);
  const span = Math.max(6, Math.max(...xs) - Math.min(...xs) + 2 * pad, Math.max(...ys) - Math.min(...ys) + 2 * pad);
  const cx = (Math.max(...xs) + Math.min(...xs)) / 2;
  const cy = (Math.max(...ys) + Math.min(...ys)) / 2;
  const half = Math.ceil(span / 2);
  return {
    xMin: Math.round(cx) - half,
    xMax: Math.round(cx) + half,
    yMin: Math.round(cy) - half,
    yMax: Math.round(cy) + half,
  };
}

/** Syllabus topic 1: review of linear functions. */
export const LINEAR_GENERATORS: Generator[] = [
  gen({
    id: 'lin.graph.features',
    concept: 'lin.graph',
    kind: 'core',
    levels: [1, 2],
    title: L('Směrnice a průsečíky', 'Slope and intercepts'),
    tags: ['annual-review'],
    est: (lv) => 35 + 25 * lv,
    make(r, lv) {
      const a = nz(r, -4, 4);
      const x0 = nz(r, -5, 5);
      const b = -a * x0;
      const f = polyTex([a, b]);
      const ask = lv === 1 ? r.pick(['y-int', 'monotone'] as const) : r.pick(['x-int', 'value-at'] as const);
      if (ask === 'y-int') {
        return {
          prompt: L(
            `Ve kterém bodě protíná graf funkce $f(x) = ${f}$ osu $y$?`,
            `At which point does the graph of $f(x) = ${f}$ cross the $y$-axis?`,
          ),
          answer: { kind: 'point', coords: ['0', `${b}`], placeholder: '[0; 3]' },
          hints: [
            L(
              'Body na ose $y$ mají $x$-ovou souřadnici rovnou nule.',
              'Points on the $y$-axis have $x$-coordinate zero.',
            ),
            L('Dosaď $x = 0$.', 'Substitute $x = 0$.'),
          ],
          solution: [
            step(
              'Dosadíme $x = 0$:',
              'Substitute $x = 0$:',
              mapL(pointL(0, b), (pt) => `f(0) = ${b} \\;\\Rightarrow\\; ${pt}`),
            ),
          ],
          misconceptions: [
            mc(
              `${b}; 0`,
              'misread',
              'Souřadnice jsou prohozené — na ose $y$ je $x = 0$.',
              'The coordinates are swapped — on the $y$-axis, $x = 0$.',
            ),
            mc(`${x0}; 0`, 'misread', 'To je průsečík s osou $x$.', 'That is the $x$-intercept.'),
          ],
        };
      }
      if (ask === 'monotone') {
        return {
          prompt: L(`Funkce $f(x) = ${f}$ je:`, `The function $f(x) = ${f}$ is:`),
          answer: {
            kind: 'choice',
            fixedOrder: true,
            options: [
              { id: 'inc', text: L('rostoucí', 'increasing') },
              { id: 'dec', text: L('klesající', 'decreasing') },
              { id: 'const', text: L('konstantní', 'constant') },
            ],
            correct: [a > 0 ? 'inc' : 'dec'],
          },
          hints: [
            L(
              'O tom, zda přímka stoupá nebo klesá, rozhoduje jediné číslo v předpisu.',
              'A single number in the formula decides whether the line rises or falls.',
            ),
            L(
              `Směrnice je $${a}$. Když $x$ vzroste o 1, změní se $y$ o $${a}$.`,
              `The slope is $${a}$. When $x$ grows by 1, $y$ changes by $${a}$.`,
            ),
          ],
          solution: [
            step(
              `Směrnice $a = ${a}$ je ${a > 0 ? 'kladná, funkce roste' : 'záporná, funkce klesá'}.`,
              `The slope $a = ${a}$ is ${a > 0 ? 'positive, so the function increases' : 'negative, so the function decreases'}.`,
            ),
          ],
          misconceptions: [
            mc(
              a > 0 ? 'dec' : 'inc',
              'misread',
              'Rozhoduje znaménko směrnice, ne absolutního členu.',
              'It is the sign of the slope that decides, not that of the constant term.',
            ),
          ],
        };
      }
      if (ask === 'x-int') {
        return {
          prompt: L(
            `Určete nulový bod funkce $f(x) = ${f}$ (průsečík grafu s osou $x$).`,
            `Find the zero of $f(x) = ${f}$ (where its graph crosses the $x$-axis).`,
          ),
          answer: { kind: 'number', value: `${x0}`, label: 'x =' },
          hints: [
            L(
              'Na ose $x$ je funkční hodnota nulová. Jakou rovnici tedy řešíš?',
              'On the $x$-axis the function value is zero. Which equation do you solve, then?',
            ),
            L(`$${f} = 0$`, `$${f} = 0$`),
          ],
          solution: [
            step('Položíme $f(x) = 0$:', 'Set $f(x) = 0$:', `${f} = 0`),
            step('Vyřešíme:', 'Solve:', `x = ${fToTex(frac(-b, a))}`),
          ],
          misconceptions: [
            mc(
              `${-x0}`,
              'sign',
              'Při převodu čísla na druhou stranu se mění znaménko.',
              'A number changes sign when moved to the other side.',
            ),
            mc(
              `${b}`,
              'misread',
              'To je průsečík s osou $y$, ne nulový bod.',
              'That is the $y$-intercept, not the zero.',
            ),
          ],
          verify: [{ kind: 'value', expr: `-(${b})/(${a})` }],
        };
      }
      const y0 = a * r.int(-4, 4) + b;
      const xs = frac(y0 - b, a);
      return {
        prompt: L(
          `Pro které $x$ nabývá funkce $f(x) = ${f}$ hodnoty $${y0}$?`,
          `For which $x$ does $f(x) = ${f}$ take the value $${y0}$?`,
        ),
        answer: { kind: 'number', value: fToInput(xs), label: 'x =' },
        hints: [
          L(
            'Ptají se na vstup, ne na výstup. Co znáš: $x$, nebo $f(x)$?',
            'The question asks for the input, not the output. Which do you know: $x$ or $f(x)$?',
          ),
          L(`Řeš rovnici $${f} = ${y0}$.`, `Solve the equation $${f} = ${y0}$.`),
        ],
        solution: [
          step('Sestavíme rovnici:', 'Set up the equation:', `${f} = ${y0}`),
          step('Vyřešíme:', 'Solve:', `x = ${fToTex(xs)}`),
        ],
        misconceptions: [
          mc(
            `${a * y0 + b}`,
            'misread',
            `To je $f(${y0})$. Ptali se, pro které $x$ je $f(x) = ${y0}$.`,
            `That is $f(${y0})$. The question was for which $x$ we have $f(x) = ${y0}$.`,
          ),
        ],
        verify: [{ kind: 'value', expr: `(${y0}-(${b}))/(${a})` }],
      };
    },
  }),

  gen({
    id: 'lin.graph.read',
    concept: 'lin.graph',
    kind: 'graph',
    levels: [2, 3],
    title: L('Předpis přímky z grafu', 'Reading a line off its graph'),
    est: (lv) => 50 + 25 * lv,
    make(r, lv) {
      // slope as a fraction p/q in lowest terms; integer intercept
      const q = lv === 2 ? 1 : r.pick([2, 3]);
      const p = r.pick([-3, -2, -1, 1, 2, 3].filter((v) => q === 1 || Math.abs(v) % q !== 0));
      const b = r.int(-3, 3);
      const slope = frac(p, q);
      const expr = q === 1 ? polyIn([p, b]) : `(${p}/${q})*x${b === 0 ? '' : b > 0 ? `+${b}` : `${b}`}`;
      const x1 = 0;
      const x2 = q * r.pick([1, 2]) * r.sign();
      const P1: [number, number] = [x1, b];
      const P2: [number, number] = [x2, b + (p * x2) / q];
      const figure: FigureSpec = {
        view: windowFor([P1, P2, [0, 0]], 3),
        aspect: 1,
        curves: [{ expr, color: 'a' }],
        points: [
          { x: P1[0], y: P1[1], color: 'a' },
          { x: P2[0], y: P2[1], color: 'a' },
        ],
      };
      return {
        prompt: L(
          'Na obrázku je graf lineární funkce; vyznačené body mají celočíselné souřadnice. Určete její předpis.',
          'The figure shows the graph of a linear function; the marked points have integer coordinates. Find its formula.',
        ),
        figure,
        answer: { kind: 'expr', value: expr, vars: ['x'], label: 'y =', placeholder: '2x-1' },
        hints: [
          L(
            'Absolutní člen přečteš přímo: kde graf protíná osu $y$?',
            'The constant term can be read directly: where does the graph cross the $y$-axis?',
          ),
          L(
            'Směrnici zjistíš ze dvou vyznačených bodů: o kolik se změní $y$, když se $x$ změní o kolik?',
            'Get the slope from the two marked points: by how much does $y$ change when $x$ changes by how much?',
          ),
          L(
            `Směrnice $= \\dfrac{\\Delta y}{\\Delta x} = \\dfrac{${P2[1] - P1[1]}}{${P2[0] - P1[0]}}$.`,
            `Slope $= \\dfrac{\\Delta y}{\\Delta x} = \\dfrac{${P2[1] - P1[1]}}{${P2[0] - P1[0]}}$.`,
          ),
        ],
        solution: [
          step(
            `Graf protíná osu $y$ v bodě $${b}$, tedy $b = ${b}$.`,
            `The graph crosses the $y$-axis at $${b}$, so $b = ${b}$.`,
          ),
          step(
            'Směrnice z vyznačených bodů:',
            'Slope from the marked points:',
            `a = \\frac{${P2[1]} - ${par(P1[1])}}{${P2[0]} - ${P1[0]}} = ${fToTex(slope)}`,
          ),
          step('Předpis:', 'Formula:', `y = ${q === 1 ? polyTex([p, b]) : `${fToTex(slope)}x${tailTex(b)}`}`),
        ],
        misconceptions: [
          mc(
            q === 1 ? polyIn([-p, b]) : `(${-p}/${q})*x${b === 0 ? '' : b > 0 ? `+${b}` : `${b}`}`,
            'sign',
            'Směrnice má opačné znaménko: klesá-li graf zleva doprava, je záporná.',
            'The slope has the opposite sign: if the graph falls from left to right, it is negative.',
          ),
          ...(p !== 0
            ? [
                mc(
                  `(${q}/${p})*x${b === 0 ? '' : b > 0 ? `+${b}` : `${b}`}`,
                  'formula',
                  'Směrnice je $\\Delta y / \\Delta x$, ne naopak.',
                  'Slope is $\\Delta y / \\Delta x$, not the other way round.',
                ),
              ]
            : []),
        ],
        verify: [{ kind: 'passes', points: [P1, P2] }],
      };
    },
  }),

  gen({
    id: 'lin.from-points.two-points',
    concept: 'lin.from-points',
    kind: 'core',
    levels: [2, 3],
    title: L('Přímka dvěma body', 'A line through two points'),
    tags: ['annual-review'],
    est: (lv) => 60 + 30 * lv,
    make(r, lv) {
      const [x1, x2] = distinct(r, -5, 5, 2) as [number, number];
      // Level 3 uses a half-integer slope when the points allow integer coordinates.
      const half = lv === 3 && (x2 - x1) % 2 === 0;
      const a = half ? frac(r.pick([1, 3, -1, -3, 5, -5]), 2) : frac(nz(r, -4, 4));
      const y1 = r.int(-5, 5);
      const dy = fMul(a, frac(x2 - x1));
      const y2 = y1 + dy.n / dy.d;
      const b = fSub(frac(y1), fMul(a, frac(x1)));
      const A = pointL(x1, y1);
      const B = pointL(x2, y2);
      // polyIn/polyTex write the line the way a person would: no "1x", no "+ (−6)".
      const expr = polyIn([a, b]);
      const shown = polyTex([a, b]);
      return {
        prompt: L(
          `Určete předpis lineární funkce, jejíž graf prochází body $A${A.cs}$ a $B${B.cs}$.`,
          `Find the linear function whose graph passes through $A${A.en}$ and $B${B.en}$.`,
        ),
        answer: { kind: 'expr', value: expr, vars: ['x'], label: 'y =', placeholder: '2x-1' },
        hints: [
          L('Dva kroky: nejdřív směrnice, pak absolutní člen.', 'Two steps: first the slope, then the constant term.'),
          L(
            `Směrnice: $a = \\dfrac{y_B - y_A}{x_B - x_A} = \\dfrac{${y2} - ${par(y1)}}{${x2} - ${par(x1)}}$.`,
            `Slope: $a = \\dfrac{y_B - y_A}{x_B - x_A} = \\dfrac{${y2} - ${par(y1)}}{${x2} - ${par(x1)}}$.`,
          ),
          L(
            `Teď do $y = ${polyTex([a, 0])} + b$ dosaď jeden z bodů a vypočítej $b$.`,
            `Now substitute one of the points into $y = ${polyTex([a, 0])} + b$ and compute $b$.`,
          ),
        ],
        solution: [
          step(
            'Směrnice:',
            'Slope:',
            `a = \\frac{${y2} - ${par(y1)}}{${x2} - ${par(x1)}} = \\frac{${y2 - y1}}{${x2 - x1}} = ${fToTex(a)}`,
          ),
          step(
            'Dosadíme bod $A$:',
            'Substitute the point $A$:',
            `${y1} = ${fToTex(a)}\\cdot${par(x1)} + b \\;\\Rightarrow\\; b = ${fToTex(b)}`,
          ),
          step('Předpis:', 'Formula:', `y = ${shown}`),
          step(
            'Zkouška bodem $B$, který jsme zatím nepoužili.',
            'Check with the point $B$, which has not been used yet.',
          ),
        ],
        misconceptions: [
          mc(
            polyIn([frac(-a.n, a.d), fSub(frac(y1), fMul(frac(-a.n, a.d), frac(x1)))]),
            'sign',
            'Směrnice má opačné znaménko. Odečítej souřadnice ve stejném pořadí nahoře i dole.',
            'The slope has the opposite sign. Subtract the coordinates in the same order top and bottom.',
          ),
          mc(
            polyIn([a, y1]),
            'formula',
            '$b$ není $y$-ová souřadnice bodu $A$ — je to hodnota pro $x = 0$.',
            '$b$ is not the $y$-coordinate of $A$ — it is the value at $x = 0$.',
          ),
        ],
        verify: [
          {
            kind: 'passes',
            points: [
              [x1, y1],
              [x2, y2],
            ],
          },
        ],
      };
    },
  }),

  gen({
    id: 'lin.from-points.intersection',
    concept: 'lin.from-points',
    kind: 'core',
    levels: [2, 3],
    title: L('Průsečík dvou přímek', 'Intersection of two lines'),
    est: (lv) => 60 + 30 * lv,
    make(r, lv) {
      const px = lv === 2 ? r.int(-4, 4) : r.int(-5, 5);
      const py = r.int(-5, 5);
      const [a1, a2] = distinct(r, -4, 4, 2, [0]) as [number, number];
      const b1 = py - a1 * px;
      const b2 = py - a2 * px;
      const f = polyTex([a1, b1]);
      const g = polyTex([a2, b2]);
      return {
        prompt: L(
          `Určete průsečík grafů funkcí $f(x) = ${f}$ a $g(x) = ${g}$.`,
          `Find the intersection of the graphs of $f(x) = ${f}$ and $g(x) = ${g}$.`,
        ),
        answer: { kind: 'point', coords: [`${px}`, `${py}`], label: 'P =', placeholder: '[2; -1]' },
        hints: [
          L(
            'V průsečíku mají obě funkce stejnou hodnotu. Jak to zapíšeš rovnicí?',
            'At the intersection both functions have the same value. How do you write that as an equation?',
          ),
          L(`$${f} = ${g}$. Vyřeš pro $x$.`, `$${f} = ${g}$. Solve for $x$.`),
          L(
            `$x = ${px}$. Průsečík je bod — ještě potřebuješ $y$.`,
            `$x = ${px}$. The intersection is a point — you still need $y$.`,
          ),
        ],
        solution: [
          step('Položíme funkce do rovnosti:', 'Equate the functions:', `${f} = ${g}`),
          step('Vyřešíme:', 'Solve:', `${nTex(a1 - a2)}x = ${b2 - b1} \\;\\Rightarrow\\; x = ${px}`),
          step('Dosadíme do jedné z funkcí:', 'Substitute into either function:', `y = f(${px}) = ${py}`),
          step(
            'Průsečík:',
            'Intersection:',
            mapL(pointL(px, py), (pt) => `P = ${pt}`),
          ),
        ],
        misconceptions: [
          mc(
            `${-px}; ${a1 * -px + b1}`,
            'sign',
            'Při řešení rovnice se ztratilo znaménko.',
            'A sign was lost while solving the equation.',
          ),
          mc(`${py}; ${px}`, 'misread', 'Souřadnice jsou prohozené.', 'The coordinates are swapped.'),
        ],
        verify: [{ kind: 'solves', exprs: [`${polyIn([a1, b1])}-y`, `${polyIn([a2, b2])}-y`] }],
      };
    },
  }),

  gen({
    id: 'lin.model.applied',
    concept: 'lin.model',
    kind: 'applied',
    levels: [2, 3],
    title: L('Lineární model z praxe', 'A linear model from practice'),
    est: (lv) => 80 + 30 * lv,
    make(r, lv) {
      const scenario = r.pick(['disk', 'tariff', 'battery'] as const);
      if (scenario === 'disk') {
        const rate = r.pick([2, 3, 4, 5, 6]);
        const days = r.int(8, 30);
        const used = r.pick([40, 60, 85, 120, 150]);
        const capacity = used + rate * days;
        return {
          prompt: L(
            `Na serveru s diskem o kapacitě $${capacity}$ GB je obsazeno $${used}$ GB. Logy přibývají stálou rychlostí $${rate}$ GB za den. Za kolik dní bude disk plný?`,
            `A server has a $${capacity}$ GB disk with $${used}$ GB used. Logs grow at a steady $${rate}$ GB per day. In how many days will the disk be full?`,
          ),
          context: { it: true, applied: true },
          answer: { kind: 'number', value: `${days}`, label: 't =' },
          hints: [
            L(
              'Sestav funkci: obsazené místo v závislosti na počtu dní $t$.',
              'Build a function: used space as a function of the number of days $t$.',
            ),
            L(
              `$m(t) = ${used} + ${rate}t$. Kdy bude $m(t) = ${capacity}$?`,
              `$m(t) = ${used} + ${rate}t$. When is $m(t) = ${capacity}$?`,
            ),
          ],
          solution: [
            step('Model:', 'Model:', `m(t) = ${used} + ${rate}t`),
            step('Disk je plný, když:', 'The disk is full when:', `${used} + ${rate}t = ${capacity}`),
            step('Řešení:', 'Solution:', `t = \\frac{${capacity - used}}{${rate}} = ${days}`),
            step(
              'Dává výsledek smysl? Volné místo děleno denním přírůstkem.',
              'Does the result make sense? Free space divided by daily growth.',
            ),
          ],
          misconceptions: [
            mc(
              fToInput(frac(capacity, rate)),
              'misread',
              'Disk už je zčásti obsazený — zaplnit zbývá jen volné místo.',
              'The disk is already partly used — only the free space remains to be filled.',
            ),
          ],
          verify: [{ kind: 'value', expr: `(${capacity}-${used})/${rate}` }],
        };
      }
      if (scenario === 'tariff') {
        const flatA = r.pick([0, 50, 100]);
        const perA = r.pick([4, 5, 6]);
        const perB = perA - r.pick([1, 2, 3]);
        const x = r.pick([20, 30, 40, 50, 60, 80]);
        const flatB = flatA + (perA - perB) * x;
        return {
          prompt: L(
            `Cloudový poskytovatel A účtuje paušál $${flatA}$ Kč a $${perA}$ Kč za každou hodinu běhu. Poskytovatel B účtuje paušál $${flatB}$ Kč a $${perB}$ Kč za hodinu. Při kolika hodinách běhu vyjdou oba stejně draho?`,
            `Cloud provider A charges a flat $${flatA}$ CZK plus $${perA}$ CZK per hour of runtime. Provider B charges a flat $${flatB}$ CZK plus $${perB}$ CZK per hour. At how many hours do both cost the same?`,
          ),
          context: { it: true, applied: true },
          answer: { kind: 'number', value: `${x}`, label: 'h =' },
          hints: [
            L(
              'Každý tarif je lineární funkce počtu hodin. Sestav obě.',
              'Each tariff is a linear function of the number of hours. Write both down.',
            ),
            L(`$${flatA} + ${perA}h = ${flatB} + ${perB}h$`, `$${flatA} + ${perA}h = ${flatB} + ${perB}h$`),
          ],
          solution: [
            step('Ceny:', 'Costs:', `A(h) = ${flatA} + ${perA}h,\\quad B(h) = ${flatB} + ${perB}h`),
            step('Rovnost:', 'Equality:', `${perA - perB}h = ${flatB - flatA} \\;\\Rightarrow\\; h = ${x}`),
            step(
              lv === 3 ? 'Při více hodinách je levnější B — má menší směrnici.' : 'To je průsečík dvou přímek.',
              lv === 3
                ? 'Beyond that, B is cheaper — it has the smaller slope.'
                : 'That is the intersection of two lines.',
            ),
          ],
          misconceptions: [
            mc(
              fToInput(frac(flatB + flatA, perA - perB)),
              'sign',
              'Paušály se při převodu na jednu stranu odčítají.',
              'The flat fees are subtracted when moved to one side.',
            ),
          ],
          verify: [{ kind: 'value', expr: `(${flatB}-${flatA})/(${perA}-${perB})` }],
        };
      }
      const full = r.pick([3000, 4000, 5000, 6000]);
      const draw = r.pick([250, 400, 500]);
      const t = r.int(2, 6);
      const left = full - draw * t;
      return {
        prompt: L(
          `Raspberry Pi napájené z powerbanky o kapacitě $${full}$ mAh odebírá stále $${draw}$ mA. Kolik mAh zbude po $${t}$ hodinách provozu?`,
          `A Raspberry Pi running from a $${full}$ mAh power bank draws a steady $${draw}$ mA. How many mAh are left after $${t}$ hours?`,
        ),
        context: { it: true, applied: true },
        answer: { kind: 'number', value: `${left}` },
        hints: [
          L(
            'Zbývající kapacita klesá stálou rychlostí — to je lineární funkce času.',
            'The remaining capacity falls at a constant rate — a linear function of time.',
          ),
          L(`$Q(t) = ${full} - ${draw}t$`, `$Q(t) = ${full} - ${draw}t$`),
        ],
        solution: [
          step(
            'Model (směrnice je záporná, kapacita ubývá):',
            'Model (the slope is negative, capacity drains):',
            `Q(t) = ${full} - ${draw}t`,
          ),
          step('Dosadíme:', 'Substitute:', `Q(${t}) = ${full} - ${draw}\\cdot ${t} = ${left}`),
        ],
        misconceptions: [
          mc(
            `${full + draw * t}`,
            'sign',
            'Kapacita ubývá, směrnice je záporná.',
            'Capacity drains; the slope is negative.',
          ),
          mc(
            `${draw * t}`,
            'misread',
            'To je spotřebovaná energie. Ptali se, kolik zbude.',
            'That is what was consumed. The question was how much is left.',
          ),
        ],
        verify: [{ kind: 'value', expr: `${full}-${draw}*${t}` }],
      };
    },
  }),

  gen({
    id: 'lin.graph.find-mistake',
    concept: 'lin.graph',
    kind: 'debug',
    levels: [2, 3],
    title: L('Najdi chybu: směrnice', 'Find the mistake: slope'),
    est: 70,
    make(r) {
      const [x1, x2] = distinct(r, -4, 5, 2) as [number, number];
      const a = nz(r, -3, 3);
      const y1 = r.int(-4, 4);
      const y2 = y1 + a * (x2 - x1);
      // The "wrong sign of b" variant is only wrong when a·x1 is not zero.
      const picked = r.pick(['order', 'sign-b', 'reciprocal'] as const);
      const variant = picked === 'sign-b' && x1 === 0 ? 'order' : picked;
      const A = pointL(x1, y1);
      const B = pointL(x2, y2);
      const lines: { tex: string }[] = [];
      let wrongLine: number;
      if (variant === 'order') {
        lines.push({
          tex: `a = \\frac{y_B - y_A}{x_A - x_B} = \\frac{${y2} - ${par(y1)}}{${x1} - ${par(x2)}} = ${-a}`,
        });
        lines.push({ tex: `${y1} = ${-a}\\cdot${par(x1)} + b` });
        lines.push({ tex: `b = ${y1 + a * x1}` });
        lines.push({ tex: `y = ${polyTex([-a, y1 + a * x1])}` });
        wrongLine = 0;
      } else if (variant === 'sign-b') {
        lines.push({ tex: `a = \\frac{${y2} - ${par(y1)}}{${x2} - ${par(x1)}} = ${a}` });
        lines.push({ tex: `${y1} = ${a}\\cdot${par(x1)} + b` });
        lines.push({ tex: `b = ${y1} + ${par(a * x1)} = ${y1 + a * x1}` });
        lines.push({ tex: `y = ${polyTex([a, y1 + a * x1])}` });
        wrongLine = 2;
      } else {
        lines.push({ tex: `a = \\frac{x_B - x_A}{y_B - y_A} = \\frac{${x2 - x1}}{${y2 - y1}}` });
        lines.push({ tex: `${y1} = \\frac{${x2 - x1}}{${y2 - y1}}\\cdot${par(x1)} + b` });
        lines.push({ tex: `b = ${y1} - \\frac{${(x2 - x1) * x1}}{${y2 - y1}}` });
        wrongLine = 0;
      }
      return {
        prompt: L(
          `Žák hledal předpis přímky procházející body $A${A.cs}$ a $B${B.cs}$. Ve kterém řádku udělal první chybu?`,
          `A student was finding the line through $A${A.en}$ and $B${B.en}$. In which line is the first mistake?`,
        ),
        answer: { kind: 'spot', lines, wrongLine, errorType: variant === 'sign-b' ? 'sign' : 'formula' },
        hints: [
          L(
            'Nekontroluj výsledek, kontroluj každý krok zvlášť: plyne tenhle řádek z předchozího?',
            'Do not check the result; check each step on its own: does this line follow from the previous one?',
          ),
          L(
            'První řádek: je směrnice opravdu $\\dfrac{\\Delta y}{\\Delta x}$, se stejným pořadím bodů nahoře i dole?',
            'First line: is the slope really $\\dfrac{\\Delta y}{\\Delta x}$, with the same order of points top and bottom?',
          ),
        ],
        solution: [
          variant === 'order'
            ? step(
                'V čitateli je $y_B - y_A$, ale ve jmenovateli $x_A - x_B$ — pořadí bodů se liší, směrnice má špatné znaménko.',
                'The numerator is $y_B - y_A$ but the denominator is $x_A - x_B$ — the order of points differs, so the slope has the wrong sign.',
              )
            : variant === 'sign-b'
              ? step(
                  `Z $${y1} = ${a * x1} + b$ plyne $b = ${y1} - ${par(a * x1)}$, ne plus.`,
                  `From $${y1} = ${a * x1} + b$ we get $b = ${y1} - ${par(a * x1)}$, not plus.`,
                )
              : step(
                  'Směrnice je $\\Delta y / \\Delta x$. Tady je zlomek obráceně.',
                  'Slope is $\\Delta y / \\Delta x$. Here the fraction is upside down.',
                ),
          step('Správně:', 'Correct:', `y = ${polyTex([a, y1 - a * x1])}`),
        ],
      };
    },
  }),
];
