import {
  L,
  fAdd,
  fMul,
  fToInput,
  fToTex,
  frac,
  intervalIn,
  intervalL,
  pointL,
  polyIn,
  polyTex,
  setL,
  type FigureSpec,
  type Frac,
  type Generator,
} from '@lemma/core';
import {
  HINT,
  distinct,
  gen,
  leadIn,
  leadTex,
  mapL,
  mc,
  nz,
  par,
  shiftIn,
  shiftTex,
  step,
  tailIn,
  tailTex,
} from './helpers';

/** Evaluate a polynomial given by descending coefficients. */
const poly = (coeffs: readonly number[], x: number): number => coeffs.reduce((acc, c) => acc * x + c, 0);

/** a(x − m)² + n as display and as parser input. */
const vertexTex = (a: number, m: number, n: number): string => `${leadTex(a)}(${shiftTex(m)})^2${tailTex(n)}`;
const vertexIn = (a: number, m: number, n: number): string => `${leadIn(a)}(${shiftIn(m)})^2${tailIn(n)}`;

/** a(x − r1)(x − r2). */
const factoredTex = (a: number, r1: number, r2: number): string =>
  r1 === r2
    ? `${leadTex(a)}(${shiftTex(r1)})^2`
    : `${leadTex(a)}${r1 === 0 ? 'x' : `(${shiftTex(r1)})`}${r2 === 0 ? 'x' : `(${shiftTex(r2)})`}`;
const factoredIn = (a: number, r1: number, r2: number): string => `${leadIn(a)}(${shiftIn(r1)})*(${shiftIn(r2)})`;

/** Syllabus topics 3 and 4: quadratic functions, also with absolute value. */
export const QUADRATIC_GENERATORS: Generator[] = [
  gen({
    id: 'quad.graph.features',
    concept: 'quad.graph',
    kind: 'warmup',
    levels: [1, 2],
    title: L('Co o parabole říkají koeficienty', 'What the coefficients say about a parabola'),
    est: (lv) => 30 + 25 * lv,
    make(r, lv) {
      const a = r.pick([1, 2, -1, -2, 3, -3]);
      if (lv === 1) {
        const b = r.int(-6, 6);
        const c = nz(r, -8, 8);
        const f = polyTex([a, b, c]);
        if (r.bool()) {
          return {
            prompt: L(
              `Ve kterém bodě protíná graf funkce $f(x) = ${f}$ osu $y$?`,
              `At which point does the graph of $f(x) = ${f}$ cross the $y$-axis?`,
            ),
            answer: { kind: 'point', coords: ['0', `${c}`], placeholder: '[0; 3]' },
            hints: [
              L('Na ose $y$ je $x = 0$.', 'On the $y$-axis, $x = 0$.'),
              L('Dosaď nulu — zbude jen absolutní člen.', 'Substitute zero — only the constant term remains.'),
            ],
            solution: [
              step(
                'Dosadíme $x = 0$:',
                'Substitute $x = 0$:',
                mapL(pointL(0, c), (pt) => `f(0) = ${c} \\;\\Rightarrow\\; ${pt}`),
              ),
            ],
            misconceptions: [mc(`${c}; 0`, 'misread', 'Souřadnice jsou prohozené.', 'The coordinates are swapped.')],
          };
        }
        return {
          prompt: L(`Parabola $y = ${f}$ je otevřená:`, `The parabola $y = ${f}$ opens:`),
          answer: {
            kind: 'choice',
            fixedOrder: true,
            options: [
              { id: 'up', text: L('nahoru (má minimum)', 'upwards (it has a minimum)') },
              { id: 'down', text: L('dolů (má maximum)', 'downwards (it has a maximum)') },
            ],
            correct: [a > 0 ? 'up' : 'down'],
          },
          hints: [
            L(
              'Rozhoduje jediný koeficient. Který člen převáží pro hodně velká $x$?',
              'One coefficient decides. Which term dominates for very large $x$?',
            ),
            L(`Koeficient u $x^2$ je $${a}$.`, `The coefficient of $x^2$ is $${a}$.`),
          ],
          solution: [
            step(
              `$a = ${a}$ je ${a > 0 ? 'kladné: parabola se otevírá nahoru' : 'záporné: parabola se otevírá dolů'}.`,
              `$a = ${a}$ is ${a > 0 ? 'positive: the parabola opens upwards' : 'negative: the parabola opens downwards'}.`,
            ),
          ],
          misconceptions: [
            mc(
              a > 0 ? 'down' : 'up',
              'misread',
              'Rozhoduje znaménko u $x^2$, ne u ostatních členů.',
              'It is the sign of the $x^2$ term that decides, not of the others.',
            ),
          ],
        };
      }
      const [r1, r2] = distinct(r, -5, 5, 2).sort((u, v) => u - v) as [number, number];
      const coeffs = [a, -a * (r1 + r2), a * r1 * r2];
      return {
        prompt: L(
          `Určete průsečíky grafu funkce $f(x) = ${polyTex(coeffs)}$ s osou $x$. Zadejte jejich $x$-ové souřadnice.`,
          `Find where the graph of $f(x) = ${polyTex(coeffs)}$ meets the $x$-axis. Enter the $x$-coordinates.`,
        ),
        answer: { kind: 'set', values: [`${r1}`, `${r2}`], label: 'x \\in' },
        hints: [
          L(
            'Na ose $x$ je $y = 0$. Řešíš kvadratickou rovnici.',
            'On the $x$-axis, $y = 0$. You are solving a quadratic equation.',
          ),
          Math.abs(a) === 1
            ? L('Zkus rozklad na součin nebo diskriminant.', 'Try factoring, or the discriminant.')
            : L(
                `Nejdřív vyděl celou rovnici číslem $${a}$ — kořeny se tím nezmění.`,
                `First divide the whole equation by $${a}$ — the roots do not change.`,
              ),
        ],
        solution: [
          step(
            'Položíme $f(x) = 0$' + (Math.abs(a) === 1 ? ':' : ` a vydělíme $${a}$:`),
            'Set $f(x) = 0$' + (Math.abs(a) === 1 ? ':' : ` and divide by $${a}$:`),
            `${polyTex([1, -(r1 + r2), r1 * r2])} = 0`,
          ),
          step('Rozklad:', 'Factor:', `${factoredTex(1, r1, r2)} = 0`),
          step('Průsečíky:', 'Intercepts:', `x_1 = ${r1},\\; x_2 = ${r2}`),
        ],
        verify: [{ kind: 'roots', expr: polyIn(coeffs) }],
      };
    },
  }),

  gen({
    id: 'quad.vertex.from-standard',
    concept: 'quad.vertex',
    kind: 'core',
    levels: [1, 2, 3],
    title: L('Vrchol paraboly', 'Vertex of a parabola'),
    tags: ['annual-review'],
    est: (lv) => 50 + 30 * lv,
    make(r, lv) {
      const a = lv === 1 ? 1 : lv === 2 ? r.pick([-1, 2, -2, 3]) : r.pick([1, -1, 2, -2]);
      // Level 3: vertex x is a half-integer.
      const m: Frac = lv === 3 ? frac(r.pick([1, 3, 5, -1, -3, -5]), 2) : frac(nz(r, -5, 5));
      const b = (-2 * a * m.n) / m.d;
      const c = r.int(-6, 6);
      const coeffs = [a, b, c];
      const n = fAdd(fMul(frac(a), fMul(m, m)), fAdd(fMul(frac(b), m), frac(c)));
      const f = polyTex(coeffs);
      const V = pointL(m, n);
      return {
        prompt: L(`Určete vrchol paraboly $y = ${f}$.`, `Find the vertex of the parabola $y = ${f}$.`),
        answer: { kind: 'point', coords: [fToInput(m), fToInput(n)], label: 'V =', placeholder: '[2; -1]' },
        hints: [
          L(
            'Vrchol leží na ose paraboly. Jak z koeficientů zjistíš její $x$-ovou souřadnici?',
            'The vertex lies on the axis of the parabola. How do the coefficients give its $x$-coordinate?',
          ),
          L(
            `$x_V = -\\dfrac{b}{2a} = -\\dfrac{${b}}{2\\cdot ${par(a)}}$. Pozor na znaménka.`,
            `$x_V = -\\dfrac{b}{2a} = -\\dfrac{${b}}{2\\cdot ${par(a)}}$. Mind the signs.`,
          ),
          L(
            `$x_V = ${fToTex(m)}$. Druhou souřadnici dostaneš dosazením do předpisu.`,
            `$x_V = ${fToTex(m)}$. Substitute into the formula to get the second coordinate.`,
          ),
        ],
        solution: [
          step(
            '$x$-ová souřadnice vrcholu:',
            '$x$-coordinate of the vertex:',
            `x_V = -\\frac{b}{2a} = -\\frac{${b}}{${2 * a}} = ${fToTex(m)}`,
          ),
          step(
            '$y$-ová souřadnice dosazením:',
            '$y$-coordinate by substitution:',
            `y_V = f\\left(${fToTex(m)}\\right) = ${fToTex(n)}`,
          ),
          step(
            'Vrchol:',
            'Vertex:',
            mapL(V, (pt) => `V = ${pt}`),
          ),
        ],
        misconceptions: [
          mc(
            `${fToInput(frac(-m.n, m.d))}; ${fToInput(fAdd(fMul(frac(a), fMul(m, m)), fAdd(fMul(frac(-b), m), frac(c))))}`,
            'sign',
            'Ve vzorci je minus: $x_V = -\\frac{b}{2a}$. Záporné $b$ dá kladný výsledek.',
            'The formula has a minus: $x_V = -\\frac{b}{2a}$. A negative $b$ gives a positive result.',
            'quad.vertex',
          ),
          mc(
            `${fToInput(m)}; ${c}`,
            'misread',
            'Druhá souřadnice není absolutní člen — to je hodnota v nule. Dosaď $x_V$.',
            'The second coordinate is not the constant term — that is the value at zero. Substitute $x_V$.',
          ),
          mc(
            `${fToInput(fMul(m, frac(2)))}; ${fToInput(n)}`,
            'formula',
            'Ve jmenovateli je $2a$, ne $a$.',
            'The denominator is $2a$, not $a$.',
          ),
          mc(`${fToInput(n)}; ${fToInput(m)}`, 'misread', 'Souřadnice jsou prohozené.', 'The coordinates are swapped.'),
        ],
        verify: [{ kind: 'extremum', expr: polyIn(coeffs) }],
      };
    },
  }),

  gen({
    id: 'quad.vertex.to-vertex-form',
    concept: 'quad.vertex',
    kind: 'core',
    levels: [2, 3],
    title: L('Převod na vrcholový tvar', 'Converting to vertex form'),
    est: (lv) => 70 + 30 * lv,
    make(r, lv) {
      const a = r.pick(lv === 2 ? [1, 2, -1] : [2, -2, 3, -1]);
      if (lv === 3) {
        // From factored form: the vertex lies midway between the roots.
        const r1 = r.int(-6, 4);
        const r2 = r1 + 2 * r.int(1, 4);
        const m = (r1 + r2) / 2;
        const n = a * (m - r1) * (m - r2);
        const shown = factoredTex(a, r1, r2);
        return {
          prompt: L(
            `Zapište funkci $f(x) = ${shown}$ ve vrcholovém tvaru $a(x - m)^2 + n$.`,
            `Write $f(x) = ${shown}$ in vertex form $a(x - m)^2 + n$.`,
          ),
          answer: {
            kind: 'expr',
            value: vertexIn(a, m, n),
            vars: ['x'],
            form: 'vertex',
            label: 'f(x) =',
            placeholder: '2(x-1)^2+3',
          },
          hints: [
            L(
              'Nemusíš roznásobovat. Parabola je souměrná — kde vůči nulovým bodům leží vrchol?',
              'No need to expand. A parabola is symmetric — where does the vertex lie relative to the zeros?',
            ),
            L(
              `Přesně uprostřed: $m = \\dfrac{${r1} + ${par(r2)}}{2} = ${m}$.`,
              `Exactly in the middle: $m = \\dfrac{${r1} + ${par(r2)}}{2} = ${m}$.`,
            ),
            L(`$n = f(${m})$. Koeficient $a$ zůstává $${a}$.`, `$n = f(${m})$. The coefficient $a$ stays $${a}$.`),
          ],
          solution: [
            step(
              `Nulové body jsou $${r1}$ a $${r2}$; vrchol leží uprostřed:`,
              `The zeros are $${r1}$ and $${r2}$; the vertex lies midway:`,
              `m = ${m}`,
            ),
            step('Dosadíme:', 'Substitute:', `n = f(${m}) = ${a}\\cdot${par(m - r1)}\\cdot${par(m - r2)} = ${n}`),
            step('Vrcholový tvar:', 'Vertex form:', `f(x) = ${vertexTex(a, m, n)}`),
          ],
          misconceptions: [
            mc(
              vertexIn(a, -m, n),
              'sign',
              'Znaménko v závorce je obráceně: vrchol v $x = m$ znamená $(x - m)$.',
              'The sign in the bracket is reversed: a vertex at $x = m$ means $(x - m)$.',
            ),
            mc(
              vertexIn(1, m, n),
              'algebra',
              'Koeficient $a$ před závorkou se nesmí ztratit.',
              'The coefficient $a$ in front of the bracket must not be lost.',
            ),
          ],
          verify: [{ kind: 'equiv', expr: factoredIn(a, r1, r2), vars: ['x'] }],
        };
      }
      const m = nz(r, -4, 4);
      const n = r.int(-7, 7);
      const coeffs = [a, -2 * a * m, a * m * m + n];
      return {
        prompt: L(
          `Zapište funkci $f(x) = ${polyTex(coeffs)}$ ve vrcholovém tvaru $a(x - m)^2 + n$.`,
          `Write $f(x) = ${polyTex(coeffs)}$ in vertex form $a(x - m)^2 + n$.`,
        ),
        answer: {
          kind: 'expr',
          value: vertexIn(a, m, n),
          vars: ['x'],
          form: 'vertex',
          label: 'f(x) =',
          placeholder: '2(x-1)^2+3',
        },
        hints: [
          L(
            'Dvě cesty: doplnit na čtverec, nebo najít vrchol a dosadit ho do tvaru $a(x - m)^2 + n$.',
            'Two routes: complete the square, or find the vertex and put it into $a(x - m)^2 + n$.',
          ),
          L(`$m = -\\dfrac{b}{2a} = ${m}$, $n = f(${m})$.`, `$m = -\\dfrac{b}{2a} = ${m}$, $n = f(${m})$.`),
          HINT.check,
        ],
        solution: [
          step('Vrchol:', 'Vertex:', `m = -\\frac{${-2 * a * m}}{${2 * a}} = ${m},\\quad n = f(${m}) = ${n}`),
          step('Vrcholový tvar:', 'Vertex form:', `f(x) = ${vertexTex(a, m, n)}`),
          step('Kontrola roznásobením.', 'Check by expanding.'),
        ],
        misconceptions: [
          mc(vertexIn(a, -m, n), 'sign', 'Znaménko v závorce je obráceně.', 'The sign in the bracket is reversed.'),
          mc(
            vertexIn(a, m, a * m * m + n),
            'algebra',
            'Druhé číslo je $n = f(m)$, ne absolutní člen původního předpisu.',
            'The second number is $n = f(m)$, not the constant term of the original formula.',
          ),
        ],
        verify: [{ kind: 'equiv', expr: polyIn(coeffs), vars: ['x'] }],
      };
    },
  }),

  gen({
    id: 'quad.vertex.read-graph',
    concept: 'quad.vertex',
    kind: 'graph',
    levels: [2, 3],
    title: L('Předpis paraboly z grafu', 'Formula of a parabola from its graph'),
    est: (lv) => 70 + 30 * lv,
    make(r, lv) {
      const a = lv === 2 ? r.pick([1, -1]) : r.pick([2, -2, -1, 1]);
      const m = r.int(-3, 3);
      const n = r.int(-3, 3);
      const expr = vertexIn(a, m, n);
      const figure: FigureSpec = {
        view: { xMin: m - 5, xMax: m + 5, yMin: a > 0 ? n - 2 : n - 9, yMax: a > 0 ? n + 9 : n + 2 },
        aspect: 0.9,
        curves: [{ expr, color: 'a' }],
        points: [
          { x: m, y: n, color: 'a', label: 'V' },
          { x: m + 1, y: n + a, color: 'a' },
          { x: m - 1, y: n + a, color: 'a' },
        ],
      };
      return {
        prompt: L(
          'Na obrázku je parabola s vyznačeným vrcholem a dvěma dalšími body. Určete předpis funkce.',
          'The figure shows a parabola with its vertex and two more points marked. Find the formula of the function.',
        ),
        figure,
        answer: { kind: 'expr', value: expr, vars: ['x'], label: 'y =', placeholder: '(x-1)^2+2' },
        hints: [
          L(
            'Vrchol přečteš přímo. Který tvar předpisu vrchol obsahuje?',
            'The vertex can be read directly. Which form of the formula contains the vertex?',
          ),
          L(
            `$y = a(${shiftTex(m)})^2${tailTex(n)}$. Zbývá $a$: o kolik se změní $y$, když se od vrcholu posuneš o 1 do strany?`,
            `$y = a(${shiftTex(m)})^2${tailTex(n)}$. That leaves $a$: by how much does $y$ change one step to the side of the vertex?`,
          ),
        ],
        solution: [
          step(
            'Vrchol:',
            'Vertex:',
            mapL(pointL(m, n), (pt) => `V = ${pt}`),
          ),
          step(
            `Bod o 1 vedle vrcholu má $y = ${n + a}$, tedy $a = ${a}$.`,
            `The point one step from the vertex has $y = ${n + a}$, so $a = ${a}$.`,
          ),
          step('Předpis:', 'Formula:', `y = ${vertexTex(a, m, n)}`),
        ],
        misconceptions: [
          mc(
            vertexIn(a, -m, n),
            'concept',
            'Vodorovný posun se zapisuje s opačným znaménkem.',
            'A horizontal shift is written with the opposite sign.',
          ),
          mc(
            vertexIn(-a, m, n),
            'sign',
            'Znaménko $a$ neodpovídá směru, kterým se parabola otevírá.',
            'The sign of $a$ does not match the way the parabola opens.',
          ),
          mc(
            vertexIn(a, n, m),
            'misread',
            'Prohodil jsi souřadnice vrcholu.',
            'You swapped the coordinates of the vertex.',
          ),
        ],
        verify: [
          {
            kind: 'passes',
            points: [
              [m, n],
              [m + 1, n + a],
              [m - 2, n + 4 * a],
            ],
          },
        ],
      };
    },
  }),

  gen({
    id: 'quad.roots-form.factored',
    concept: 'quad.roots-form',
    kind: 'core',
    levels: [2, 3],
    title: L('Součinový tvar', 'Factored form'),
    tags: ['annual-review'],
    est: (lv) => 60 + 30 * lv,
    make(r, lv) {
      const a = lv === 2 ? 1 : r.pick([2, -1, 3, -2]);
      const [r1, r2] = distinct(r, -6, 6, 2).sort((u, v) => u - v) as [number, number];
      const coeffs = [a, -a * (r1 + r2), a * r1 * r2];
      return {
        prompt: L(
          `Zapište funkci $f(x) = ${polyTex(coeffs)}$ v součinovém tvaru $a(x - x_1)(x - x_2)$.`,
          `Write $f(x) = ${polyTex(coeffs)}$ in factored form $a(x - x_1)(x - x_2)$.`,
        ),
        answer: {
          kind: 'expr',
          value: factoredIn(a, r1, r2),
          vars: ['x'],
          form: 'factored',
          label: 'f(x) =',
          placeholder: '2(x-1)(x+3)',
        },
        hints: [
          L(
            'Součinový tvar je postavený na nulových bodech. Nejdřív je najdi.',
            'Factored form is built on the zeros. Find them first.',
          ),
          L(`Nulové body: $${r1}$ a $${r2}$.`, `Zeros: $${r1}$ and $${r2}$.`),
          a === 1
            ? L('V závorce je vždy $x$ minus nulový bod.', 'Each bracket is $x$ minus a zero.')
            : L(
                `Nezapomeň na koeficient $${a}$ před závorkami — jinak by nesouhlasil člen s $x^2$.`,
                `Do not forget the coefficient $${a}$ in front — otherwise the $x^2$ term would not match.`,
              ),
        ],
        solution: [
          step('Nulové body:', 'Zeros:', `${polyTex(coeffs)} = 0 \\;\\Rightarrow\\; x_1 = ${r1},\\; x_2 = ${r2}`),
          step('Součinový tvar:', 'Factored form:', `f(x) = ${factoredTex(a, r1, r2)}`),
        ],
        misconceptions: [
          mc(
            factoredIn(a, -r1, -r2),
            'sign',
            'V závorce je $x$ minus kořen: kořen $3$ dává $(x - 3)$.',
            'Each bracket is $x$ minus the root: a root of $3$ gives $(x - 3)$.',
          ),
          ...(a !== 1
            ? [
                mc(
                  factoredIn(1, r1, r2),
                  'algebra',
                  'Chybí koeficient $a$ před závorkami.',
                  'The coefficient $a$ in front of the brackets is missing.',
                ),
              ]
            : []),
        ],
        verify: [{ kind: 'equiv', expr: polyIn(coeffs), vars: ['x'] }],
      };
    },
  }),

  gen({
    id: 'quad.roots-form.from-roots',
    concept: 'quad.roots-form',
    kind: 'reverse',
    levels: [2, 3],
    title: L('Parabola z nulových bodů', 'A parabola from its zeros'),
    est: (lv) => 80 + 30 * lv,
    make(r, lv) {
      const [r1, r2] = distinct(r, -5, 5, 2).sort((u, v) => u - v) as [number, number];
      const a = r.pick([1, 2, -1, -2, 3]);
      // Level 2 gives the y-intercept (needs non-zero roots); level 3 an arbitrary point.
      const px = lv === 2 && r1 !== 0 && r2 !== 0 ? 0 : r.intExcept(-6, 6, [r1, r2]);
      const py = a * (px - r1) * (px - r2);
      const P = pointL(px, py);
      const coeffs = [a, -a * (r1 + r2), a * r1 * r2];
      return {
        prompt: L(
          `Najděte kvadratickou funkci, která má nulové body $${r1}$ a $${r2}$ a jejíž graf prochází bodem $${P.cs}$.`,
          `Find the quadratic function with zeros $${r1}$ and $${r2}$ whose graph passes through $${P.en}$.`,
        ),
        answer: {
          kind: 'expr',
          value: factoredIn(a, r1, r2),
          vars: ['x'],
          label: 'f(x) =',
          placeholder: '2(x-1)(x+3)',
        },
        hints: [
          L(
            'Nulové body určují tvar až na jedno číslo. Který tvar předpisu je obsahuje?',
            'The zeros fix the formula up to one number. Which form of the formula contains them?',
          ),
          L(
            `$f(x) = a${factoredTex(1, r1, r2)}$. Bod navíc určí $a$.`,
            `$f(x) = a${factoredTex(1, r1, r2)}$. The extra point determines $a$.`,
          ),
          L(
            `Dosaď: $${py} = a\\cdot${par(px - r1)}\\cdot${par(px - r2)}$.`,
            `Substitute: $${py} = a\\cdot${par(px - r1)}\\cdot${par(px - r2)}$.`,
          ),
        ],
        solution: [
          step('Z nulových bodů:', 'From the zeros:', `f(x) = a${factoredTex(1, r1, r2)}`),
          step(
            `Dosadíme bod $${P.cs}$:`,
            `Substitute the point $${P.en}$:`,
            `${py} = a\\cdot ${(px - r1) * (px - r2)} \\;\\Rightarrow\\; a = ${a}`,
          ),
          step(
            'Výsledek (v libovolném tvaru):',
            'Result (in any form):',
            `f(x) = ${factoredTex(a, r1, r2)} = ${polyTex(coeffs)}`,
          ),
        ],
        misconceptions: [
          mc(
            factoredIn(1, r1, r2),
            'incomplete',
            'Tahle funkce má správné nulové body, ale daným bodem neprochází. Chybí koeficient $a$.',
            'This function has the right zeros but does not pass through the given point. The coefficient $a$ is missing.',
          ),
          mc(
            factoredIn(a, -r1, -r2),
            'sign',
            'Nulový bod $r$ znamená činitel $(x - r)$.',
            'A zero at $r$ means the factor $(x - r)$.',
          ),
        ],
        verify: [
          {
            kind: 'passes',
            points: [
              [r1, 0],
              [r2, 0],
              [px, py],
            ],
          },
        ],
      };
    },
  }),

  gen({
    id: 'quad.inequality.solve',
    concept: 'quad.inequality',
    kind: 'core',
    levels: [2, 3, 4],
    title: L('Kvadratická nerovnice', 'Quadratic inequality'),
    tags: ['annual-review'],
    est: (lv) => 70 + 30 * lv,
    make(r, lv) {
      const rel = r.pick(['<', '<=', '>', '>='] as const);
      const relTex = { '<': '<', '<=': '\\le', '>': '>', '>=': '\\ge' }[rel];
      const strict = rel === '<' || rel === '>';
      const wantsPositive = rel === '>' || rel === '>=';

      if (lv === 4) {
        // No sign change: D < 0 or D = 0.
        const a = r.pick([1, -1, 2]);
        const m = r.int(-4, 4);
        const double = r.bool();
        const q = double ? 0 : r.int(1, 5);
        const coeffs = [a, -2 * a * m, a * (m * m + q)];
        // sign of the expression: sign(a) everywhere (zero only at m when double)
        const alwaysTrue = a > 0 === wantsPositive;
        let value: string;
        let shown: L;
        if (!double) {
          value = alwaysTrue ? 'R' : '{}';
          shown = alwaysTrue ? L('\\mathbb{R}', '\\mathbb{R}') : L('\\emptyset', '\\emptyset');
        } else if (alwaysTrue) {
          value = strict ? `R \\ {${m}}` : 'R';
          shown = strict
            ? L(`\\mathbb{R} \\setminus \\{${m}\\}`, `\\mathbb{R} \\setminus \\{${m}\\}`)
            : L('\\mathbb{R}', '\\mathbb{R}');
        } else {
          value = strict ? '{}' : `{${m}}`;
          shown = strict ? L('\\emptyset', '\\emptyset') : L(`\\{${m}\\}`, `\\{${m}\\}`);
        }
        return {
          prompt: L(
            `Řešte v $\\mathbb{R}$: $${polyTex(coeffs)} ${relTex} 0$`,
            `Solve in $\\mathbb{R}$: $${polyTex(coeffs)} ${relTex} 0$`,
          ),
          answer: { kind: 'interval', value, label: 'x \\in', placeholder: 'R / {} / R \\ {1}' },
          hints: [
            L(
              'Spočítej diskriminant. Co říká o průsečících paraboly s osou $x$?',
              'Compute the discriminant. What does it say about where the parabola meets the $x$-axis?',
            ),
            double
              ? L(
                  `$D = 0$: parabola se osy jen dotýká, v bodě $x = ${m}$. Všude jinde má stejné znaménko.`,
                  `$D = 0$: the parabola only touches the axis, at $x = ${m}$. Everywhere else it has the same sign.`,
                )
              : L(
                  '$D < 0$: parabola osu vůbec neprotíná. Leží celá nad ní, nebo celá pod ní?',
                  '$D < 0$: the parabola never meets the axis. Is it entirely above, or entirely below?',
                ),
            L(
              `Otevírá se ${a > 0 ? 'nahoru' : 'dolů'} ($a = ${a}$). Načrtni si ji.`,
              `It opens ${a > 0 ? 'upwards' : 'downwards'} ($a = ${a}$). Sketch it.`,
            ),
          ],
          solution: [
            step(
              'Diskriminant:',
              'Discriminant:',
              `D = ${par(-2 * a * m)}^2 - 4\\cdot${par(a)}\\cdot${par(a * (m * m + q))} = ${4 * a * a * m * m - 4 * a * a * (m * m + q)}`,
            ),
            double
              ? step(
                  `Výraz je $${vertexTex(a, m, 0)}$: nulový jen pro $x = ${m}$, jinak ${a > 0 ? 'kladný' : 'záporný'}.`,
                  `The expression is $${vertexTex(a, m, 0)}$: zero only at $x = ${m}$, otherwise ${a > 0 ? 'positive' : 'negative'}.`,
                )
              : step(
                  `Parabola nemá s osou $x$ společný bod a otevírá se ${a > 0 ? 'nahoru' : 'dolů'}: výraz je všude ${a > 0 ? 'kladný' : 'záporný'}.`,
                  `The parabola never meets the $x$-axis and opens ${a > 0 ? 'upwards' : 'downwards'}: the expression is ${a > 0 ? 'positive' : 'negative'} everywhere.`,
                ),
            step(
              'Řešení:',
              'Solution:',
              mapL(shown, (set) => `x \\in ${set}`),
            ),
          ],
          misconceptions: [
            mc(
              alwaysTrue ? '{}' : 'R',
              'concept',
              '$D < 0$ neznamená „nerovnice nemá řešení“. Znamená jen, že výraz nemění znaménko.',
              '$D < 0$ does not mean “the inequality has no solution”. It only means the expression never changes sign.',
            ),
          ],
          verify: [{ kind: 'inequality', expr: polyIn(coeffs), rel }],
        };
      }

      const a = lv === 2 ? 1 : r.pick([-1, 2, -2]);
      const [r1, r2] = distinct(r, -6, 6, 2).sort((u, v) => u - v) as [number, number];
      const coeffs = [a, -a * (r1 + r2), a * r1 * r2];
      // Level 3 sometimes hides the zero on the right-hand side.
      const shift = lv === 3 && r.bool() ? nz(r, -5, 5) : 0;
      const lhs = polyTex([coeffs[0]!, coeffs[1]!, coeffs[2]! + shift]);
      // The expression is positive outside the roots iff a > 0.
      const outside = a > 0 === wantsPositive;
      const closed = !strict;
      const value = outside
        ? `${intervalIn('-inf', r1, false, closed)} u ${intervalIn(r2, 'inf', closed, false)}`
        : intervalIn(r1, r2, closed, closed);
      const shown: L = outside
        ? L(
            `${intervalL('-inf', r1, false, closed).cs} \\cup ${intervalL(r2, 'inf', closed, false).cs}`,
            `${intervalL('-inf', r1, false, closed).en} \\cup ${intervalL(r2, 'inf', closed, false).en}`,
          )
        : intervalL(r1, r2, closed, closed);
      return {
        prompt: L(
          `Řešte v $\\mathbb{R}$: $${lhs} ${relTex} ${shift}$`,
          `Solve in $\\mathbb{R}$: $${lhs} ${relTex} ${shift}$`,
        ),
        answer: { kind: 'interval', value, label: 'x \\in', placeholder: '(-inf; 1) u (3; inf)' },
        hints: [
          shift !== 0
            ? L(
                'Nejdřív převeď vše na jednu stranu, aby vpravo zůstala nula.',
                'First move everything to one side so that zero is on the right.',
              )
            : L(
                'Nerovnici neřeš úpravami — čti ji z grafu. Co k tomu potřebuješ znát?',
                'Do not solve by manipulation — read it off the graph. What do you need to know for that?',
              ),
          L(
            `Nulové body jsou $${r1}$ a $${r2}$, parabola se otevírá ${a > 0 ? 'nahoru' : 'dolů'}. Načrtni ji.`,
            `The zeros are $${r1}$ and $${r2}$, and the parabola opens ${a > 0 ? 'upwards' : 'downwards'}. Sketch it.`,
          ),
          L(
            `Kde je parabola ${wantsPositive ? 'nad osou' : 'pod osou'} $x$: mezi kořeny, nebo vně?`,
            `Where is the parabola ${wantsPositive ? 'above' : 'below'} the $x$-axis: between the roots, or outside them?`,
          ),
        ],
        solution: [
          ...(shift !== 0
            ? [step('Anulujeme pravou stranu:', 'Bring everything to one side:', `${polyTex(coeffs)} ${relTex} 0`)]
            : []),
          step('Nulové body:', 'Zeros:', `x_1 = ${r1},\\; x_2 = ${r2}`),
          step(
            `Parabola se otevírá ${a > 0 ? 'nahoru' : 'dolů'}, takže je ${wantsPositive ? 'kladná' : 'záporná'} ${outside ? 'vně kořenů' : 'mezi kořeny'}.`,
            `The parabola opens ${a > 0 ? 'upwards' : 'downwards'}, so it is ${wantsPositive ? 'positive' : 'negative'} ${outside ? 'outside the roots' : 'between the roots'}.`,
            mapL(shown, (set) => `x \\in ${set}`),
          ),
          step(
            strict ? 'Nerovnost je ostrá: kořeny do řešení nepatří.' : 'Nerovnost je neostrá: kořeny do řešení patří.',
            strict ? 'Strict inequality: the roots are excluded.' : 'Non-strict inequality: the roots are included.',
          ),
        ],
        verify: [
          { kind: 'inequality', expr: `${polyIn([coeffs[0]!, coeffs[1]!, coeffs[2]! + shift])}-(${shift})`, rel },
        ],
      };
    },
  }),

  gen({
    id: 'quad.graph.range',
    concept: 'quad.graph',
    kind: 'core',
    levels: [2, 3],
    title: L('Obor hodnot kvadratické funkce', 'Range of a quadratic function'),
    tags: ['annual-review'],
    est: (lv) => 60 + 30 * lv,
    make(r, lv) {
      const a = lv === 2 ? r.pick([1, -1]) : r.pick([2, -2, 3, -1]);
      const m = nz(r, -4, 4);
      const n = r.int(-7, 7);
      const coeffs = [a, -2 * a * m, a * m * m + n];
      const up = a > 0;
      return {
        prompt: L(
          `Určete obor hodnot funkce $f(x) = ${polyTex(coeffs)}$.`,
          `Find the range of $f(x) = ${polyTex(coeffs)}$.`,
        ),
        answer: {
          kind: 'interval',
          value: up ? intervalIn(n, 'inf', true, false) : intervalIn('-inf', n, false, true),
          label: 'H(f) =',
        },
        hints: [
          L(
            'Obor hodnot jsou všechna $y$, která funkce nabývá. Kde má parabola nejnižší nebo nejvyšší bod?',
            'The range is every $y$ the function takes. Where is the lowest or highest point of the parabola?',
          ),
          L(`Vrchol: $x_V = ${m}$, $y_V = f(${m}) = ${n}$.`, `Vertex: $x_V = ${m}$, $y_V = f(${m}) = ${n}$.`),
          L(
            `Parabola se otevírá ${up ? 'nahoru — vrchol je minimum' : 'dolů — vrchol je maximum'}.`,
            `The parabola opens ${up ? 'upwards — the vertex is the minimum' : 'downwards — the vertex is the maximum'}.`,
          ),
        ],
        solution: [
          step(
            'Vrchol:',
            'Vertex:',
            mapL(pointL(m, n), (pt) => `x_V = -\\frac{${-2 * a * m}}{${2 * a}} = ${m},\\quad V = ${pt}`),
          ),
          step(
            up ? 'Vrchol je nejnižší bod grafu:' : 'Vrchol je nejvyšší bod grafu:',
            up ? 'The vertex is the lowest point:' : 'The vertex is the highest point:',
            mapL(up ? intervalL(n, 'inf', true, false) : intervalL('-inf', n, false, true), (set) => `H(f) = ${set}`),
          ),
        ],
        misconceptions: [
          mc(
            up ? intervalIn('-inf', n, false, true) : intervalIn(n, 'inf', true, false),
            'sign',
            'Směr intervalu určuje znaménko $a$.',
            'The direction of the interval is set by the sign of $a$.',
          ),
          mc(
            up ? intervalIn(m, 'inf', true, false) : intervalIn('-inf', m, false, true),
            'misread',
            'Použil jsi $x$-ovou souřadnici vrcholu. Obor hodnot se týká $y$.',
            'You used the $x$-coordinate of the vertex. The range is about $y$.',
          ),
          mc(
            up ? intervalIn(a * m * m + n, 'inf', true, false) : intervalIn('-inf', a * m * m + n, false, true),
            'misread',
            'To je hodnota v nule, ne ve vrcholu.',
            'That is the value at zero, not at the vertex.',
          ),
        ],
        verify: [{ kind: 'range', expr: polyIn(coeffs) }],
      };
    },
  }),

  gen({
    id: 'quad.optimize.applied',
    concept: 'quad.optimize',
    kind: 'applied',
    levels: [3, 4],
    title: L('Největší a nejmenší hodnota v praxi', 'Largest and smallest values in practice'),
    est: (lv) => 120 + 30 * lv,
    make(r, lv) {
      const scenario = r.pick(['fence', 'throw', 'threads', 'price'] as const);
      if (scenario === 'fence') {
        const total = 4 * r.int(5, 20);
        const x = total / 4;
        const area = x * (total - 2 * x);
        return {
          prompt: L(
            `K rovné zdi chceme přistavět obdélníkovou ohradu a máme $${total}$ m pletiva. Pletivo bude na třech stranách, čtvrtou tvoří zeď. Jaký největší obsah (v m²) může ohrada mít?`,
            `A rectangular pen is to be built against a straight wall using $${total}$ m of fencing. The fence runs along three sides; the wall is the fourth. What is the largest area (in m²) the pen can have?`,
          ),
          context: { applied: true },
          answer: { kind: 'number', value: `${area}` },
          hints: [
            L(
              'Označ jako $x$ délku strany kolmé ke zdi. Jak dlouhá pak vyjde strana rovnoběžná se zdí?',
              'Let $x$ be the length of a side perpendicular to the wall. How long is the side parallel to the wall, then?',
            ),
            L(
              `Rovnoběžná strana: $${total} - 2x$. Obsah: $S(x) = x(${total} - 2x)$.`,
              `The parallel side: $${total} - 2x$. Area: $S(x) = x(${total} - 2x)$.`,
            ),
            L(
              `$S$ je parabola otevřená dolů s nulovými body $0$ a $${total / 2}$. Kde má vrchol?`,
              `$S$ is a downward parabola with zeros $0$ and $${total / 2}$. Where is its vertex?`,
            ),
          ],
          solution: [
            step('Obsah jako funkce $x$:', 'Area as a function of $x$:', `S(x) = x(${total} - 2x) = -2x^2 + ${total}x`),
            step(
              'Vrchol leží uprostřed mezi nulovými body:',
              'The vertex lies midway between the zeros:',
              `x_V = \\frac{0 + ${total / 2}}{2} = ${x}`,
            ),
            step('Největší obsah:', 'Largest area:', `S(${x}) = ${x}\\cdot ${total - 2 * x} = ${area}`),
            step(
              `Rozměry ${x} m × ${total - 2 * x} m: delší strana je podél zdi.`,
              `Dimensions ${x} m × ${total - 2 * x} m: the longer side runs along the wall.`,
            ),
          ],
          misconceptions: [
            mc(
              `${(total / 3) ** 2}`,
              'strategy',
              'Čtverec je nejlepší jen tehdy, když pletivo vede po všech čtyřech stranách. Tady zeď jednu stranu ušetří.',
              'A square is best only when the fence runs along all four sides. Here the wall saves one side.',
            ),
            mc(
              `${x}`,
              'misread',
              'To je rozměr, pro který je obsah největší. Ptali se na obsah.',
              'That is the dimension at which the area is largest. The question was the area.',
            ),
          ],
          verify: [{ kind: 'value', expr: `${x}*(${total}-2*${x})` }],
        };
      }
      if (scenario === 'throw') {
        const tV = r.int(1, 4);
        const h0 = r.pick([0, 1, 2]);
        const v = 10 * tV;
        const hMax = -5 * tV * tV + v * tV + h0;
        const askTime = lv === 3 && r.bool();
        return {
          prompt: L(
            `Míček vyhozený svisle vzhůru má v čase $t$ sekund výšku $h(t) = -5t^2 + ${v}t${tailTex(h0)}$ metrů. ${askTime ? 'Za kolik sekund dosáhne největší výšky?' : 'Jaké největší výšky (v metrech) dosáhne?'}`,
            `A ball thrown straight up has height $h(t) = -5t^2 + ${v}t${tailTex(h0)}$ metres after $t$ seconds. ${askTime ? 'After how many seconds does it reach its greatest height?' : 'What is the greatest height (in metres) it reaches?'}`,
          ),
          context: { applied: true },
          answer: { kind: 'number', value: `${askTime ? tV : hMax}` },
          hints: [
            L(
              'Výška je kvadratická funkce času. Kde má parabola otevřená dolů největší hodnotu?',
              'Height is a quadratic function of time. Where does a downward parabola take its largest value?',
            ),
            L(
              `$t_V = -\\dfrac{b}{2a} = -\\dfrac{${v}}{2\\cdot(-5)} = ${tV}$`,
              `$t_V = -\\dfrac{b}{2a} = -\\dfrac{${v}}{2\\cdot(-5)} = ${tV}$`,
            ),
          ],
          solution: [
            step('Čas vrcholu:', 'Time of the vertex:', `t_V = -\\frac{${v}}{2\\cdot(-5)} = ${tV}`),
            step(
              'Největší výška:',
              'Greatest height:',
              `h(${tV}) = -5\\cdot ${tV * tV} + ${v}\\cdot ${tV}${tailTex(h0)} = ${hMax}`,
            ),
          ],
          misconceptions: [
            mc(
              `${askTime ? hMax : tV}`,
              'misread',
              askTime ? 'To je výška. Ptali se na čas.' : 'To je čas. Ptali se na výšku.',
              askTime
                ? 'That is the height. The question was the time.'
                : 'That is the time. The question was the height.',
            ),
            mc(
              `${askTime ? -tV : -5 * tV * tV - v * tV + h0}`,
              'sign',
              'Ve vzorci $-\\frac{b}{2a}$ je $a$ záporné — dvě minus dají plus.',
              'In $-\\frac{b}{2a}$ the $a$ is negative — two minuses make a plus.',
            ),
          ],
          verify: [{ kind: 'value', expr: askTime ? `${v}/10` : `-5*${tV}^2+${v}*${tV}+${h0}` }],
        };
      }
      if (scenario === 'threads') {
        const nV = r.int(4, 12);
        const k = r.pick([1, 2, 3]);
        const peak = k * nV * nV;
        return {
          prompt: L(
            `Měření ukázalo, že propustnost služby při $n$ pracovních vláknech lze popsat funkcí $P(n) = -${k === 1 ? '' : k}n^2 + ${2 * k * nV}n$ požadavků za sekundu (víc vláken pomáhá, ale roste režie přepínání). Při kolika vláknech je propustnost největší?`,
            `Measurements show that the throughput of a service with $n$ worker threads follows $P(n) = -${k === 1 ? '' : k}n^2 + ${2 * k * nV}n$ requests per second (more threads help, but switching overhead grows). At how many threads is throughput highest?`,
          ),
          context: { it: true, applied: true },
          answer: { kind: 'number', value: `${nV}`, label: 'n =' },
          hints: [
            L(
              'Propustnost je parabola otevřená dolů. Kde má vrchol?',
              'Throughput is a downward parabola. Where is its vertex?',
            ),
            L(
              `Rychlá cesta: nulové body jsou $0$ a $${2 * nV}$. Vrchol leží uprostřed.`,
              `A quick route: the zeros are $0$ and $${2 * nV}$. The vertex lies midway.`,
            ),
          ],
          solution: [
            step('Vytkneme:', 'Factor:', `P(n) = -${k === 1 ? '' : k}n(n - ${2 * nV})`),
            step('Vrchol uprostřed mezi nulovými body:', 'Vertex midway between the zeros:', `n_V = ${nV}`),
            step(
              `Největší propustnost je $P(${nV}) = ${peak}$ požadavků za sekundu. Další vlákna už škodí.`,
              `Peak throughput is $P(${nV}) = ${peak}$ requests per second. Further threads only hurt.`,
            ),
          ],
          misconceptions: [
            mc(
              `${2 * nV}`,
              'misread',
              'To je nulový bod — tam propustnost klesne na nulu.',
              'That is a zero — throughput drops to nothing there.',
            ),
            mc(
              `${peak}`,
              'misread',
              'To je největší propustnost. Ptali se na počet vláken.',
              'That is the peak throughput. The question was the number of threads.',
            ),
          ],
          verify: [{ kind: 'value', expr: `${2 * k * nV}/(2*${k})` }],
        };
      }
      // Revenue p·(b2 − drop·p) peaks at p = b2 / (2·drop); choose the peak first.
      const drop = r.pick([10, 20]);
      const price = r.int(5, 20);
      const b2 = 2 * drop * price;
      return {
        prompt: L(
          `Vývojář prodává licenci k aplikaci. Při ceně $p$ stovek korun prodá měsíčně $${b2} - ${drop}p$ licencí. Při jaké ceně (ve stovkách Kč) bude měsíční tržba největší?`,
          `A developer sells an app licence. At a price of $p$ hundred CZK, $${b2} - ${drop}p$ licences sell per month. At what price (in hundreds of CZK) is monthly revenue highest?`,
        ),
        context: { it: true, applied: true },
        answer: { kind: 'number', value: `${price}`, label: 'p =' },
        hints: [
          L(
            'Tržba = cena × počet prodaných kusů. Sestav ji jako funkci ceny.',
            'Revenue = price × units sold. Write it as a function of the price.',
          ),
          L(
            `$T(p) = p(${b2} - ${drop}p)$ — parabola s nulovými body $0$ a $${b2 / drop}$.`,
            `$T(p) = p(${b2} - ${drop}p)$ — a parabola with zeros $0$ and $${b2 / drop}$.`,
          ),
        ],
        solution: [
          step('Tržba:', 'Revenue:', `T(p) = p(${b2} - ${drop}p) = -${drop}p^2 + ${b2}p`),
          step('Vrchol:', 'Vertex:', `p_V = -\\frac{${b2}}{2\\cdot(-${drop})} = ${price}`),
          step(
            `Při této ceně se prodá $${b2 - drop * price}$ licencí a tržba je $${price * (b2 - drop * price)}$ stovek Kč.`,
            `At this price $${b2 - drop * price}$ licences sell and revenue is $${price * (b2 - drop * price)}$ hundred CZK.`,
          ),
        ],
        misconceptions: [
          mc(
            `${b2 / drop}`,
            'misread',
            'Při této ceně si licenci nekoupí nikdo — tržba je nulová.',
            'At that price nobody buys a licence — revenue is zero.',
          ),
        ],
        verify: [{ kind: 'value', expr: `${b2}/(2*${drop})` }],
      };
    },
  }),

  gen({
    id: 'quad.vertex.find-mistake',
    concept: 'quad.vertex',
    kind: 'debug',
    levels: [2, 3],
    title: L('Najdi chybu: vrchol paraboly', 'Find the mistake: vertex of a parabola'),
    est: 80,
    make(r) {
      const a = r.pick([1, 2, -1]);
      const variant = r.pick(['sign-b', 'square-sign', 'denominator'] as const);
      // For the lost-sign variant b must be negative, i.e. a and m have the same sign.
      const m = variant === 'sign-b' ? Math.sign(a) * r.int(1, 4) : nz(r, -4, 4);
      const c = r.int(-5, 5);
      const b = -2 * a * m;
      const coeffs = [a, b, c];
      const n = poly(coeffs, m);
      const f = polyTex(coeffs);
      if (variant === 'sign-b') {
        return {
          prompt: L(
            `Žák hledal vrchol paraboly $y = ${f}$. Ve kterém řádku je první chyba?`,
            `A student was finding the vertex of $y = ${f}$. Which line contains the first mistake?`,
          ),
          answer: {
            kind: 'spot',
            lines: [
              { tex: `a = ${a},\\; b = ${b},\\; c = ${c}` },
              { tex: `x_V = -\\frac{b}{2a} = -\\frac{${-b}}{${2 * a}} = ${-m}` },
              { tex: `y_V = f(${-m}) = ${poly(coeffs, -m)}` },
            ],
            wrongLine: 1,
            errorType: 'sign',
          },
          hints: [
            L(
              'Porovnej dosazené hodnoty s koeficienty v prvním řádku — včetně znamének.',
              'Compare the substituted values with the coefficients in the first line — signs included.',
            ),
            L(`$b = ${b}$. Co se dosadilo do zlomku?`, `$b = ${b}$. What was put into the fraction?`),
          ],
          solution: [
            step(
              `Do vzorce se dosadilo $${-b}$ místo $${b}$: znaménko koeficientu $b$ se ztratilo.`,
              `$${-b}$ was substituted instead of $${b}$: the sign of $b$ was lost.`,
            ),
            step(
              'Správně:',
              'Correct:',
              mapL(pointL(m, n), (pt) => `x_V = -\\frac{${b}}{${2 * a}} = ${m},\\quad V = ${pt}`),
            ),
          ],
        };
      }
      if (variant === 'square-sign') {
        const neg = -Math.abs(m);
        const cs = [a, -2 * a * neg, c];
        const right = poly(cs, neg);
        const wrong = a * -(neg * neg) + cs[1]! * neg + c;
        return {
          prompt: L(
            `Žák hledal vrchol paraboly $y = ${polyTex(cs)}$. Ve kterém řádku je první chyba?`,
            `A student was finding the vertex of $y = ${polyTex(cs)}$. Which line contains the first mistake?`,
          ),
          answer: {
            kind: 'spot',
            lines: [
              { tex: `x_V = -\\frac{${cs[1]}}{2\\cdot ${par(a)}} = ${neg}` },
              {
                tex: `y_V = ${a === 1 ? '' : a === -1 ? '-' : `${a}\\cdot`}${par(neg)}^2 ${tailTex(cs[1]!)}\\cdot${par(neg)} ${tailTex(c)}`,
              },
              { tex: `y_V = ${a * -(neg * neg)} ${tailTex(cs[1]! * neg)} ${tailTex(c)} = ${wrong}` },
            ],
            wrongLine: 2,
            errorType: 'sign',
          },
          hints: [
            L(
              'První dva řádky jsou v pořádku. Přepočítej poslední řádek člen po členu.',
              'The first two lines are fine. Recompute the last line term by term.',
            ),
            L(`Kolik je $${par(neg)}^2$?`, `What is $${par(neg)}^2$?`),
          ],
          solution: [
            step(
              `$${par(neg)}^2 = ${neg * neg}$, ne $${-(neg * neg)}$. Záporné číslo se umocňuje i se znaménkem.`,
              `$${par(neg)}^2 = ${neg * neg}$, not $${-(neg * neg)}$. A negative number is squared together with its sign.`,
            ),
            step('Správně:', 'Correct:', `y_V = ${right}`),
          ],
        };
      }
      return {
        prompt: L(
          `Žák hledal vrchol paraboly $y = ${f}$. Ve kterém řádku je první chyba?`,
          `A student was finding the vertex of $y = ${f}$. Which line contains the first mistake?`,
        ),
        answer: {
          kind: 'spot',
          lines: [
            { tex: `a = ${a},\\; b = ${b},\\; c = ${c}` },
            { tex: `x_V = -\\frac{b}{a} = -\\frac{${b}}{${a}} = ${-b / a}` },
            { tex: `y_V = f(${-b / a}) = ${poly(coeffs, -b / a)}` },
          ],
          wrongLine: 1,
          errorType: 'formula',
        },
        hints: [
          L(
            'Koeficienty jsou přečtené správně. Je správně i vzorec?',
            'The coefficients are read correctly. Is the formula right too?',
          ),
          L(
            'Vrchol leží uprostřed mezi kořeny. Jak vypadá vzorec pro kořeny?',
            'The vertex lies midway between the roots. What does the formula for the roots look like?',
          ),
        ],
        solution: [
          step(
            'Ve jmenovateli má být $2a$: $x_V = -\\frac{b}{2a}$.',
            'The denominator should be $2a$: $x_V = -\\frac{b}{2a}$.',
          ),
          step(
            'Správně:',
            'Correct:',
            mapL(pointL(m, n), (pt) => `x_V = ${m},\\quad V = ${pt}`),
          ),
        ],
      };
    },
  }),

  // ------------------------------------------------------ 4 quadratic + absolute value
  gen({
    id: 'quadabs.graph.count',
    concept: 'quadabs.graph',
    kind: 'graph',
    levels: [3, 4],
    title: L('Počet řešení z grafu', 'Counting solutions from a graph'),
    tags: ['annual-review'],
    est: (lv) => 90 + 20 * lv,
    make(r, lv) {
      const k = r.pick([1, 2, 3]);
      const top = k * k;
      const kind = r.pick(
        lv === 3 ? (['below', 'above', 'zero'] as const) : (['below', 'above', 'zero', 'top', 'negative'] as const),
      );
      const c =
        kind === 'below'
          ? r.int(1, Math.max(1, top - 1))
          : kind === 'above'
            ? top + r.int(1, 4)
            : kind === 'zero'
              ? 0
              : kind === 'top'
                ? top
                : -r.int(1, 3);
      // k = 1 leaves no integer strictly between 0 and 1: treat c = 1 as the "top" case.
      const actual = c < 0 ? 0 : c === 0 ? 2 : c < top ? 4 : c === top ? 3 : 2;
      const expr = `abs(x^2-${top})`;
      const figure: FigureSpec = {
        view: { xMin: -k - 3, xMax: k + 3, yMin: -2, yMax: top + 5 },
        aspect: 0.75,
        curves: [{ expr, color: 'a' }],
        points: [
          { x: 0, y: top, color: 'a' },
          { x: -k, y: 0, color: 'a' },
          { x: k, y: 0, color: 'a' },
        ],
      };
      return {
        prompt: L(
          `Na obrázku je graf funkce $f(x) = |x^2 - ${top}|$. Kolik řešení má rovnice $|x^2 - ${top}| = ${c}$?`,
          `The figure shows the graph of $f(x) = |x^2 - ${top}|$. How many solutions does $|x^2 - ${top}| = ${c}$ have?`,
        ),
        figure,
        answer: {
          kind: 'choice',
          fixedOrder: true,
          options: ['0', '2', '3', '4'].map((id) => ({ id, text: L(id, id) })),
          correct: [`${actual}`],
        },
        hints: [
          L(
            `Řešení rovnice jsou průsečíky grafu s vodorovnou přímkou $y = ${c}$. Představ si ji v obrázku.`,
            `The solutions are where the graph meets the horizontal line $y = ${c}$. Picture it in the figure.`,
          ),
          L(
            `Důležité výšky jsou $0$ (kde se graf dotýká osy) a $${top}$ (vrchol prostředního „kopce“).`,
            `The important heights are $0$ (where the graph touches the axis) and $${top}$ (the top of the middle “hill”).`,
          ),
        ],
        solution: [
          step(
            `Přímka $y = ${c}$ leží ${c < 0 ? 'pod osou $x$, kam graf nedosáhne' : c === 0 ? 'na ose $x$, které se graf dotýká ve dvou bodech' : c < top ? `mezi $0$ a $${top}$: protne obě ramena i prostřední kopec` : c === top ? `přesně ve výšce vrcholu kopce: dotkne se ho a protne obě ramena` : `nad kopcem: protne jen obě ramena`}.`,
            `The line $y = ${c}$ lies ${c < 0 ? 'below the $x$-axis, where the graph never goes' : c === 0 ? 'on the $x$-axis, which the graph touches at two points' : c < top ? `between $0$ and $${top}$: it cuts both arms and the middle hill` : c === top ? `exactly at the top of the hill: it touches it and cuts both arms` : `above the hill: it cuts only the two arms`}.`,
          ),
          step('Počet řešení:', 'Number of solutions:', `${actual}`),
        ],
        misconceptions: [
          ...(actual === 4
            ? [
                mc(
                  '2',
                  'incomplete',
                  'Přímka protíná i prostřední, překlopenou část grafu.',
                  'The line also cuts the middle, flipped part of the graph.',
                ),
              ]
            : []),
          ...(actual === 0
            ? [mc('2', 'concept', 'Absolutní hodnota nemůže být záporná.', 'An absolute value cannot be negative.')]
            : []),
          ...(actual === 2 && c > top
            ? [mc('4', 'graph', 'Tak vysoko prostřední kopec nedosáhne.', 'The middle hill does not reach that high.')]
            : []),
        ],
        verify: [],
      };
    },
  }),

  gen({
    id: 'quadabs.equations.abs-x',
    concept: 'quadabs.equations',
    kind: 'hard',
    levels: [3, 4],
    title: L('Kvadratická rovnice s $|x|$', 'Quadratic equation in $|x|$'),
    tags: ['annual-review'],
    est: (lv) => 110 + 30 * lv,
    make(r, lv) {
      // x² − p|x| + q = 0 with t = |x| ∈ {t1, t2}
      const t1 = r.int(1, 6);
      const t2 = lv === 3 ? r.intExcept(1, 7, [t1]) : r.pick([0, -r.int(1, 5), r.intExcept(1, 7, [t1])]);
      const p = t1 + t2;
      const q = t1 * t2;
      const roots = [t1, t2]
        .filter((t) => t >= 0)
        .flatMap((t) => (t === 0 ? [0] : [-t, t]))
        .sort((u, v) => u - v);
      const shown = `x^2 ${p === 0 ? '' : p > 0 ? `- ${p === 1 ? '' : p}|x|` : `+ ${p === -1 ? '' : -p}|x|`}${tailTex(q)}`;
      const expr = `x^2-(${p})*abs(x)+(${q})`;
      return {
        prompt: L(`Řešte v $\\mathbb{R}$: $${shown} = 0$`, `Solve in $\\mathbb{R}$: $${shown} = 0$`),
        answer: { kind: 'set', values: roots.map(String), label: 'K =' },
        hints: [
          L(
            'Využij, že $x^2 = |x|^2$. Co se stane, když $|x|$ označíš novým písmenem?',
            'Use that $x^2 = |x|^2$. What happens if you call $|x|$ a new letter?',
          ),
          L(
            `Substituce $t = |x|$: $${polyTex([1, -p, q], { variable: 't' })} = 0$. Jakou podmínku musí $t$ splňovat?`,
            `Substitute $t = |x|$: $${polyTex([1, -p, q], { variable: 't' })} = 0$. What condition must $t$ satisfy?`,
          ),
          L(
            `$t \\ge 0$. Pro každé vyhovující $t$ pak řeš $|x| = t$ — to dává dvě hodnoty $x$ (nebo jednu pro $t = 0$).`,
            `$t \\ge 0$. For each admissible $t$, solve $|x| = t$ — two values of $x$ (or one for $t = 0$).`,
          ),
        ],
        solution: [
          step(
            'Substituce $t = |x|$, $t \\ge 0$:',
            'Substitute $t = |x|$, $t \\ge 0$:',
            `${polyTex([1, -p, q], { variable: 't' })} = 0 \\;\\Rightarrow\\; t_1 = ${t1},\\; t_2 = ${t2}`,
          ),
          ...(t2 < 0
            ? [step(`$t_2 = ${t2}$ nevyhovuje podmínce $t \\ge 0$.`, `$t_2 = ${t2}$ violates $t \\ge 0$.`)]
            : []),
          step(
            'Vrátíme se k $x$:',
            'Back to $x$:',
            mapL(setL(roots), (set) => `|x| = t \\;\\Rightarrow\\; K = ${set}`),
          ),
        ],
        misconceptions: [
          mc(
            [t1, t2].join('; '),
            t2 < 0 ? 'domain' : 'incomplete',
            'To jsou hodnoty $t = |x|$, ne $x$. Každé kladné $t$ dává dvě řešení $\\pm t$; záporné žádné.',
            'Those are values of $t = |x|$, not of $x$. Each positive $t$ gives two solutions $\\pm t$; a negative one gives none.',
          ),
          ...(t2 < 0
            ? [
                mc(
                  [-t1, t1, t2, -t2].sort((u, v) => u - v).join('; '),
                  'domain',
                  `$|x| = ${t2}$ nemá řešení — absolutní hodnota není záporná.`,
                  `$|x| = ${t2}$ has no solution — an absolute value is never negative.`,
                ),
              ]
            : []),
          mc(
            [t1, t2].filter((t) => t >= 0).join('; '),
            'incomplete',
            'Chybí záporná řešení: $|x| = t$ platí i pro $x = -t$.',
            'The negative solutions are missing: $|x| = t$ also holds for $x = -t$.',
          ),
        ],
        verify: [{ kind: 'roots', expr }],
      };
    },
  }),

  gen({
    id: 'quadabs.equations.abs-quad',
    concept: 'quadabs.equations',
    kind: 'hard',
    levels: [3, 4],
    title: L('Rovnice $|x^2 - a| = b$', 'Equations of the form $|x^2 - a| = b$'),
    est: (lv) => 110 + 30 * lv,
    make(r, lv) {
      // |x² − a| = b ⇒ x² = a + b or x² = a − b
      const u = r.int(2, 6);
      const four = lv === 4 ? r.bool(0.6) : r.bool(0.4);
      let a: number;
      let b: number;
      let roots: number[];
      if (four) {
        // a + b = u², a − b = v² with u, v of the same parity, 0 ≤ v < u
        const v = r.pick([0, 1, 2, 3, 4].filter((w) => w < u && (u - w) % 2 === 0));
        a = (u * u + v * v) / 2;
        b = (u * u - v * v) / 2;
        roots = v === 0 ? [-u, 0, u] : [-u, -v, v, u];
      } else {
        // a + b = u² and a − b < 0: only the outer pair ±u.
        b = r.int(Math.floor((u * u) / 2) + 1, u * u + 4);
        a = u * u - b;
        roots = [-u, u];
      }
      const inner = `x^2${a === 0 ? '' : a > 0 ? ` - ${a}` : ` + ${-a}`}`;
      const shown = `\\left|${inner}\\right|`;
      const expr = `abs(x^2-(${a}))-(${b})`;
      return {
        prompt: L(`Řešte v $\\mathbb{R}$: $${shown} = ${b}$`, `Solve in $\\mathbb{R}$: $${shown} = ${b}$`),
        answer: { kind: 'set', values: roots.map(String), label: 'K =' },
        hints: [
          L(
            `Absolutní hodnota se rovná $${b}$, když je vnitřek $${b}$ nebo $${-b}$. Dostaneš dvě rovnice.`,
            `An absolute value equals $${b}$ when its inside is $${b}$ or $${-b}$. That gives two equations.`,
          ),
          L(
            `$x^2 = ${a + b}$ a $x^2 = ${a - b}$. Má každá z nich řešení?`,
            `$x^2 = ${a + b}$ and $x^2 = ${a - b}$. Does each of them have solutions?`,
          ),
          L(
            '$x^2 = c$ má dvě řešení pro $c > 0$, jedno pro $c = 0$, žádné pro $c < 0$.',
            '$x^2 = c$ has two solutions for $c > 0$, one for $c = 0$, none for $c < 0$.',
          ),
        ],
        solution: [
          step('Dva případy:', 'Two cases:', `${inner} = ${b} \\;\\lor\\; ${inner} = ${-b}`),
          step('První:', 'First:', `x^2 = ${a + b} \\;\\Rightarrow\\; x = \\pm ${u}`),
          step(
            'Druhý:',
            'Second:',
            a - b < 0
              ? `x^2 = ${a - b} \\;\\Rightarrow\\; \\emptyset`
              : a - b === 0
                ? `x^2 = 0 \\;\\Rightarrow\\; x = 0`
                : `x^2 = ${a - b} \\;\\Rightarrow\\; x = \\pm ${Math.sqrt(a - b)}`,
          ),
          step(
            'Celkem:',
            'Altogether:',
            mapL(setL(roots), (set) => `K = ${set}`),
          ),
        ],
        misconceptions: [
          mc(
            [-u, u].join('; '),
            'incomplete',
            'Chybí druhý případ, kdy je vnitřek záporný.',
            'The second case, where the inside is negative, is missing.',
          ),
          mc(
            roots.filter((x) => x >= 0).join('; '),
            'incomplete',
            'Chybí záporné kořeny: $x^2 = c$ má řešení $\\pm\\sqrt{c}$.',
            'The negative roots are missing: $x^2 = c$ has solutions $\\pm\\sqrt{c}$.',
          ),
        ],
        verify: [{ kind: 'roots', expr }],
      };
    },
  }),
];
