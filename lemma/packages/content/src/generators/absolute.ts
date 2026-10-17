import {
  L,
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
import { HINT, gen, leadIn, leadTex, mapL, mc, nz, shiftIn, shiftTex, step, tailIn, tailTex } from './helpers';

const absTex = (inner: string): string => `\\left|${inner}\\right|`;
const fNum = (f: Frac): number => f.n / f.d;

/** Syllabus topic 2: linear functions with absolute value. */
export const ABSOLUTE_GENERATORS: Generator[] = [
  gen({
    id: 'abs.graph.vertex',
    concept: 'abs.graph',
    kind: 'core',
    levels: [1, 2, 3],
    title: L('Vrchol a obor hodnot grafu s absolutní hodnotou', 'Vertex and range of an absolute-value graph'),
    tags: ['annual-review'],
    est: (lv) => 40 + 25 * lv,
    make(r, lv) {
      const m = nz(r, -5, 5);
      const n = r.int(-5, 5);
      if (lv === 3) {
        // y = |a·x + b| + n with the vertex at a non-integer x
        const a = r.pick([2, 3, -2]);
        const b = r.pick([1, 3, 5, -1, -3, -5].filter((v) => v % a !== 0));
        const vx = frac(-b, a);
        const shown = `${absTex(polyTex([a, b]))}${tailTex(n)}`;
        return {
          prompt: L(
            `Určete vrchol grafu funkce $f(x) = ${shown}$.`,
            `Find the vertex of the graph of $f(x) = ${shown}$.`,
          ),
          answer: { kind: 'point', coords: [fToInput(vx), `${n}`], label: 'V =', placeholder: '[1/2; -3]' },
          hints: [
            L(
              'Vrchol je tam, kde je vnitřek absolutní hodnoty nulový. Tam je absolutní hodnota nejmenší.',
              'The vertex is where the inside of the absolute value is zero. That is where the absolute value is smallest.',
            ),
            L(`Řeš $${polyTex([a, b])} = 0$.`, `Solve $${polyTex([a, b])} = 0$.`),
            L(
              `$x = ${fToTex(vx)}$. Jakou hodnotu tam má celá funkce?`,
              `$x = ${fToTex(vx)}$. What is the value of the whole function there?`,
            ),
          ],
          solution: [
            step('Vnitřek je nulový pro:', 'The inside is zero at:', `${polyTex([a, b])} = 0 \\iff x = ${fToTex(vx)}`),
            step(
              'Tam je absolutní hodnota 0 a funkce má hodnotu:',
              'There the absolute value is 0 and the function equals:',
              `f\\left(${fToTex(vx)}\\right) = ${n}`,
            ),
            step(
              'Vrchol:',
              'Vertex:',
              mapL(pointL(vx, n), (pt) => `V = ${pt}`),
            ),
          ],
          misconceptions: [
            mc(
              `${fToInput(frac(b, a))}; ${n}`,
              'sign',
              'Znaménko: z $ax + b = 0$ plyne $x = -\\frac{b}{a}$.',
              'Sign: from $ax + b = 0$ you get $x = -\\frac{b}{a}$.',
            ),
            mc(
              `${-b}; ${n}`,
              'algebra',
              'Ještě vydělit koeficientem u $x$.',
              'Still to be divided by the coefficient of $x$.',
            ),
          ],
          verify: [{ kind: 'extremum', expr: `abs(${polyIn([a, b])})${tailIn(n)}` }],
        };
      }
      const a = lv === 1 ? 1 : r.pick([2, 3, -1, -2]);
      const shown = `${leadTex(a)}${absTex(shiftTex(m))}${tailTex(n)}`;
      const expr = `${leadIn(a)}abs(${shiftIn(m)})${tailIn(n)}`;
      const askRange = lv === 2 && r.bool();
      if (askRange) {
        const up = a > 0;
        return {
          prompt: L(`Určete obor hodnot funkce $f(x) = ${shown}$.`, `Find the range of $f(x) = ${shown}$.`),
          answer: {
            kind: 'interval',
            value: up ? intervalIn(n, 'inf', true, false) : intervalIn('-inf', n, false, true),
            label: 'H(f) =',
          },
          hints: [
            L(
              'Nejmenší hodnota absolutní hodnoty je 0. Jakou hodnotu má pak celá funkce?',
              'The smallest value of an absolute value is 0. What is the value of the whole function then?',
            ),
            L(
              `Koeficient před absolutní hodnotou je $${a}$: graf se otevírá ${up ? 'nahoru' : 'dolů'}.`,
              `The coefficient in front of the absolute value is $${a}$: the graph opens ${up ? 'upwards' : 'downwards'}.`,
            ),
          ],
          solution: [
            step(
              'Vrchol grafu:',
              'Vertex of the graph:',
              mapL(pointL(m, n), (pt) => `V = ${pt}`),
            ),
            step(
              up ? 'Písmeno V se otevírá nahoru, vrchol je minimum:' : 'Graf je překlopený, vrchol je maximum:',
              up
                ? 'The V opens upwards, the vertex is the minimum:'
                : 'The graph is flipped, the vertex is the maximum:',
              mapL(up ? intervalL(n, 'inf', true, false) : intervalL('-inf', n, false, true), (set) => `H(f) = ${set}`),
            ),
          ],
          misconceptions: [
            mc(
              up ? intervalIn(0, 'inf', true, false) : intervalIn('-inf', 0, false, true),
              'misread',
              'To je obor hodnot samotné absolutní hodnoty. Přičtené číslo graf posouvá.',
              'That is the range of the absolute value alone. The added number shifts the graph.',
            ),
          ],
          verify: [{ kind: 'range', expr }],
        };
      }
      return {
        prompt: L(
          `Určete vrchol grafu funkce $f(x) = ${shown}$.`,
          `Find the vertex of the graph of $f(x) = ${shown}$.`,
        ),
        answer: { kind: 'point', coords: [`${m}`, `${n}`], label: 'V =', placeholder: '[2; -1]' },
        hints: [
          L('Graf má tvar písmene V. Kde je jeho špička?', 'The graph is V-shaped. Where is its tip?'),
          L(
            'Špička je tam, kde je vnitřek absolutní hodnoty nulový.',
            'The tip is where the inside of the absolute value is zero.',
          ),
        ],
        solution: [
          step(
            `Vnitřek $${shiftTex(m)}$ je nulový pro $x = ${m}$.`,
            `The inside $${shiftTex(m)}$ is zero at $x = ${m}$.`,
          ),
          step(
            `Funkční hodnota tam je $${n}$.`,
            `The function value there is $${n}$.`,
            mapL(pointL(m, n), (pt) => `V = ${pt}`),
          ),
        ],
        misconceptions: [
          mc(
            `${-m}; ${n}`,
            'concept',
            'Posun uvnitř funguje obráceně: $|x - 3|$ má vrchol v $x = 3$.',
            'A shift inside works the opposite way: $|x - 3|$ has its vertex at $x = 3$.',
          ),
          mc(`${n}; ${m}`, 'misread', 'Souřadnice jsou prohozené.', 'The coordinates are swapped.'),
        ],
        verify: [{ kind: 'extremum', expr }],
      };
    },
  }),

  gen({
    id: 'abs.graph.read',
    concept: 'abs.graph',
    kind: 'graph',
    levels: [2, 3],
    title: L('Předpis z grafu ve tvaru V', 'Formula from a V-shaped graph'),
    est: (lv) => 60 + 25 * lv,
    make(r, lv) {
      const a = lv === 2 ? r.pick([1, -1]) : r.pick([2, -2, 3, -1]);
      const m = r.int(-3, 3);
      const n = r.int(-3, 3);
      const expr = `${leadIn(a)}abs(${shiftIn(m)})${tailIn(n)}`;
      const yEdge = n + a * 2;
      const figure: FigureSpec = {
        view: {
          xMin: m - 6,
          xMax: m + 6,
          yMin: Math.min(n, yEdge) - (a > 0 ? 2 : 5),
          yMax: Math.max(n, yEdge) + (a > 0 ? 5 : 2),
        },
        aspect: 0.8,
        curves: [{ expr, color: 'a' }],
        points: [
          { x: m, y: n, color: 'a' },
          { x: m + 2, y: yEdge, color: 'a' },
          { x: m - 2, y: yEdge, color: 'a' },
        ],
      };
      return {
        prompt: L(
          'Na obrázku je graf funkce tvaru $y = a|x - m| + n$. Určete její předpis.',
          'The figure shows the graph of a function of the form $y = a|x - m| + n$. Find its formula.',
        ),
        figure,
        answer: { kind: 'expr', value: expr, vars: ['x'], label: 'y =', placeholder: '2|x-1|+3' },
        hints: [
          L('Vrchol dává $m$ a $n$ přímo.', 'The vertex gives $m$ and $n$ directly.'),
          L(
            `Vrchol je v bodě $[${m}; ${n}]$. Zbývá $a$: o kolik se změní $y$, když od vrcholu ujdeš 1 doprava?`,
            `The vertex is at $(${m}, ${n})$. That leaves $a$: by how much does $y$ change when you go 1 to the right of the vertex?`,
          ),
          L('Když graf od vrcholu klesá, je $a$ záporné.', 'If the graph falls away from the vertex, $a$ is negative.'),
        ],
        solution: [
          step(
            'Vrchol:',
            'Vertex:',
            mapL(pointL(m, n), (pt) => `V = ${pt} \\Rightarrow m = ${m},\\; n = ${n}`),
          ),
          step(
            'Sklon pravého ramene:',
            'Slope of the right arm:',
            `a = \\frac{${yEdge} - ${n < 0 ? `(${n})` : n}}{2} = ${a}`,
          ),
          step('Předpis:', 'Formula:', `y = ${leadTex(a)}${absTex(shiftTex(m))}${tailTex(n)}`),
        ],
        misconceptions: [
          mc(
            `${leadIn(a)}abs(${shiftIn(-m)})${tailIn(n)}`,
            'concept',
            'Vodorovný posun se zapisuje s opačným znaménkem.',
            'A horizontal shift is written with the opposite sign.',
          ),
          mc(
            `${leadIn(-a)}abs(${shiftIn(m)})${tailIn(n)}`,
            'sign',
            'Znaménko $a$: otevírá se graf nahoru, nebo dolů?',
            'The sign of $a$: does the graph open up or down?',
          ),
          mc(
            `${leadIn(a)}abs(${shiftIn(n)})${tailIn(m)}`,
            'misread',
            'Prohodil jsi $m$ a $n$.',
            'You swapped $m$ and $n$.',
          ),
        ],
        verify: [
          {
            kind: 'passes',
            points: [
              [m, n],
              [m + 2, yEdge],
              [m - 2, yEdge],
              [m + 5, n + 5 * a],
            ],
          },
        ],
      };
    },
  }),

  gen({
    id: 'abs.piecewise.rewrite',
    concept: 'abs.piecewise',
    kind: 'core',
    levels: [2, 3],
    title: L('Odstranění absolutní hodnoty na intervalu', 'Removing an absolute value on an interval'),
    est: (lv) => 60 + 30 * lv,
    make(r, lv) {
      if (lv === 2) {
        const a = r.pick([1, 2, 3]);
        const c = r.int(-4, 4);
        const b = -a * c;
        const p = nz(r, -3, 3);
        const q = r.int(-5, 5);
        const left = r.bool();
        const shown = `${absTex(polyTex([a, b]))} ${p === 1 ? '+ x' : p === -1 ? '- x' : p > 0 ? `+ ${p}x` : `- ${-p}x`}${tailTex(q)}`;
        const sign = left ? -1 : 1;
        const coeffs = [sign * a + p, sign * b + q];
        const condition = left ? `x < ${c}` : `x \\ge ${c}`;
        return {
          prompt: L(
            `Zapište funkci $f(x) = ${shown}$ bez absolutní hodnoty pro $${condition}$.`,
            `Write $f(x) = ${shown}$ without the absolute value for $${condition}$.`,
          ),
          answer: { kind: 'expr', value: polyIn(coeffs), vars: ['x'], label: 'f(x) =', form: 'expanded' },
          hints: [
            L(
              `Jaké znaménko má výraz $${polyTex([a, b])}$ pro $${condition}$? Zkus dosadit jedno konkrétní číslo.`,
              `What is the sign of $${polyTex([a, b])}$ for $${condition}$? Try one specific number.`,
            ),
            left
              ? L(
                  'Je záporný. Absolutní hodnota záporného výrazu je výraz s opačným znaménkem.',
                  'It is negative. The absolute value of a negative expression is its opposite.',
                )
              : L(
                  'Je nezáporný. Absolutní hodnotu můžeš prostě vynechat.',
                  'It is non-negative. The absolute value can simply be dropped.',
                ),
          ],
          solution: [
            step(
              `Pro $${condition}$ je $${polyTex([a, b])}$ ${left ? 'záporné' : 'nezáporné'}, takže:`,
              `For $${condition}$, $${polyTex([a, b])}$ is ${left ? 'negative' : 'non-negative'}, so:`,
              `${absTex(polyTex([a, b]))} = ${left ? `-(${polyTex([a, b])}) = ${polyTex([-a, -b])}` : polyTex([a, b])}`,
            ),
            step('Dosadíme a sečteme:', 'Substitute and collect:', `f(x) = ${polyTex(coeffs)}`),
          ],
          misconceptions: [
            mc(
              polyIn([-sign * a + p, -sign * b + q]),
              'sign',
              'Znaménko vnitřku je na tomto intervalu opačné, než jsi použil.',
              'On this interval the inside has the opposite sign to the one you used.',
            ),
            ...(left
              ? [
                  mc(
                    polyIn([-a + p, b + q]),
                    'sign',
                    'Minus před závorkou mění znaménko obou členů.',
                    'The minus before the bracket changes the sign of both terms.',
                  ),
                ]
              : []),
          ],
          verify: [
            { kind: 'equiv-on', expr: `abs(${polyIn([a, b])})+(${p})*x+(${q})`, on: left ? [c - 20, c] : [c, c + 20] },
          ],
        };
      }
      const p = r.int(-5, 1);
      const q = p + r.int(2, 6);
      const region = r.pick(['left', 'middle', 'right'] as const);
      const shown = `${absTex(shiftTex(p))} + ${absTex(shiftTex(q))}`;
      const condition = region === 'left' ? `x < ${p}` : region === 'middle' ? `${p} \\le x < ${q}` : `x \\ge ${q}`;
      const coeffs = region === 'left' ? [-2, p + q] : region === 'middle' ? [0, q - p] : [2, -(p + q)];
      return {
        prompt: L(
          `Zapište funkci $f(x) = ${shown}$ bez absolutních hodnot pro $${condition}$.`,
          `Write $f(x) = ${shown}$ without absolute values for $${condition}$.`,
        ),
        answer: { kind: 'expr', value: polyIn(coeffs), vars: ['x'], label: 'f(x) =', form: 'expanded' },
        hints: [
          L(
            `Nulové body jsou $${p}$ a $${q}$. Urči znaménko každého vnitřku na daném intervalu zvlášť.`,
            `The critical points are $${p}$ and $${q}$. Find the sign of each inside on the given interval separately.`,
          ),
          L(
            region === 'middle'
              ? `Tady je $${shiftTex(p)}$ nezáporné a $${shiftTex(q)}$ záporné.`
              : region === 'left'
                ? 'Tady jsou oba vnitřky záporné.'
                : 'Tady jsou oba vnitřky nezáporné.',
            region === 'middle'
              ? `Here $${shiftTex(p)}$ is non-negative and $${shiftTex(q)}$ is negative.`
              : region === 'left'
                ? 'Here both insides are negative.'
                : 'Here both insides are non-negative.',
          ),
        ],
        solution: [
          step(
            'Odstraníme absolutní hodnoty podle znamének:',
            'Remove the absolute values according to the signs:',
            region === 'left'
              ? `-(${shiftTex(p)}) - (${shiftTex(q)})`
              : region === 'middle'
                ? `(${shiftTex(p)}) - (${shiftTex(q)})`
                : `(${shiftTex(p)}) + (${shiftTex(q)})`,
          ),
          step(
            region === 'middle' ? 'Proměnná se odečte — mezi nulovými body je funkce konstantní:' : 'Sečteme:',
            region === 'middle'
              ? 'The variable cancels — between the critical points the function is constant:'
              : 'Collect:',
            `f(x) = ${polyTex(coeffs)}`,
          ),
          ...(region === 'middle'
            ? [
                step(
                  `Geometricky: součet vzdáleností od $${p}$ a od $${q}$ je pro bod mezi nimi vždy jejich vzdálenost.`,
                  `Geometrically: for a point between them, the distances to $${p}$ and to $${q}$ always add up to the distance between them.`,
                ),
              ]
            : []),
        ],
        misconceptions: [
          mc(
            polyIn([2, -(p + q)]),
            'sign',
            'Na tomto intervalu nejsou oba vnitřky nezáporné.',
            'On this interval the insides are not both non-negative.',
          ),
          mc(
            polyIn([-2, p + q]),
            'sign',
            'Na tomto intervalu nejsou oba vnitřky záporné.',
            'On this interval the insides are not both negative.',
          ),
        ],
        verify: [
          {
            kind: 'equiv-on',
            expr: `abs(${shiftIn(p)})+abs(${shiftIn(q)})`,
            on: region === 'left' ? [p - 20, p] : region === 'middle' ? [p, q] : [q, q + 20],
          },
        ],
      };
    },
  }),

  gen({
    id: 'abs.equations.basic',
    concept: 'abs.equations',
    kind: 'core',
    levels: [1, 2, 3],
    title: L('Rovnice s absolutní hodnotou', 'Equations with absolute value'),
    tags: ['annual-review'],
    est: (lv) => 45 + 30 * lv,
    make(r, lv) {
      if (lv === 3) {
        // |a·x + b| = |c·x + d|, two solutions, both rational with small denominators
        const [a, c] = r.pick([
          [1, 2],
          [2, 1],
          [1, 3],
          [3, 1],
          [2, 3],
          [1, -2],
          [3, -1],
        ] as const);
        const x1 = r.int(-4, 4);
        const b = r.int(-6, 6);
        const d = (a - c) * x1 + b; // a·x1 + b = c·x1 + d
        const x2 = frac(-(b + d), a + c); // a·x + b = −(c·x + d)
        const lhs = absTex(polyTex([a, b]));
        const rhs = absTex(polyTex([c, d]));
        const values = fNum(x2) === x1 ? [`${x1}`] : [`${x1}`, fToInput(x2)];
        return {
          prompt: L(`Řešte v $\\mathbb{R}$: $${lhs} = ${rhs}$`, `Solve in $\\mathbb{R}$: $${lhs} = ${rhs}$`),
          answer: { kind: 'set', values, label: 'K =' },
          hints: [
            L(
              'Dvě čísla mají stejnou absolutní hodnotu, když jsou stejná, nebo opačná.',
              'Two numbers have the same absolute value when they are equal or opposite.',
            ),
            L(
              `Řeš zvlášť $${polyTex([a, b])} = ${polyTex([c, d])}$ a $${polyTex([a, b])} = -(${polyTex([c, d])})$.`,
              `Solve separately $${polyTex([a, b])} = ${polyTex([c, d])}$ and $${polyTex([a, b])} = -(${polyTex([c, d])})$.`,
            ),
            HINT.check,
          ],
          solution: [
            step('$|A| = |B| \\iff A = B \\lor A = -B$', '$|A| = |B| \\iff A = B \\lor A = -B$'),
            step(
              'První případ:',
              'First case:',
              `${polyTex([a, b])} = ${polyTex([c, d])} \\;\\Rightarrow\\; x = ${x1}`,
            ),
            step(
              'Druhý případ:',
              'Second case:',
              `${polyTex([a, b])} = ${polyTex([-c, -d])} \\;\\Rightarrow\\; x = ${fToTex(x2)}`,
            ),
          ],
          misconceptions: [
            mc(
              `${x1}`,
              'incomplete',
              'Chybí druhý případ: vnitřky mohou být i opačné.',
              'The second case is missing: the insides may also be opposite.',
            ),
          ],
          verify: [{ kind: 'roots', expr: `abs(${polyIn([a, b])})-abs(${polyIn([c, d])})` }],
        };
      }
      const a = lv === 1 ? 1 : r.pick([2, 3, -2, 4]);
      const kind =
        lv === 1
          ? 'two'
          : r.weighted([
              ['two', 6],
              ['none', 2],
              ['one', 2],
            ] as const);
      const center = lv === 1 ? r.int(-6, 6) : r.int(-4, 4);
      const half = r.int(1, 6);
      const b = -a * center;
      const c = kind === 'two' ? Math.abs(a) * half : kind === 'one' ? 0 : -r.int(1, 6);
      const lhs = absTex(polyTex([a, b]));
      const values = kind === 'two' ? [`${center - half}`, `${center + half}`] : kind === 'one' ? [`${center}`] : [];
      return {
        prompt: L(`Řešte v $\\mathbb{R}$: $${lhs} = ${c}$`, `Solve in $\\mathbb{R}$: $${lhs} = ${c}$`),
        answer: { kind: 'set', values, label: 'K =', placeholder: '{…} / {}' },
        hints:
          kind === 'none'
            ? [
                L(
                  'Než začneš počítat: může být absolutní hodnota rovna zápornému číslu?',
                  'Before computing anything: can an absolute value equal a negative number?',
                ),
                L(
                  'Absolutní hodnota je vzdálenost. Vzdálenost není nikdy záporná.',
                  'An absolute value is a distance. A distance is never negative.',
                ),
              ]
            : [
                L(
                  'Která čísla mají absolutní hodnotu rovnou pravé straně?',
                  'Which numbers have an absolute value equal to the right-hand side?',
                ),
                kind === 'one'
                  ? L(
                      'Absolutní hodnotu 0 má jen nula. Vnitřek tedy musí být nulový.',
                      'Only zero has absolute value 0. So the inside must be zero.',
                    )
                  : L(
                      `Vnitřek je buď $${c}$, nebo $${-c}$. Vyřeš obě rovnice.`,
                      `The inside is either $${c}$ or $${-c}$. Solve both equations.`,
                    ),
              ],
        solution:
          kind === 'none'
            ? [
                step(
                  'Levá strana je vždy nezáporná, pravá je záporná. Rovnice nemá řešení.',
                  'The left side is never negative, the right side is negative. No solution.',
                  'K = \\emptyset',
                ),
              ]
            : kind === 'one'
              ? [
                  step(
                    'Vnitřek musí být nula:',
                    'The inside must be zero:',
                    `${polyTex([a, b])} = 0 \\;\\Rightarrow\\; x = ${center}`,
                  ),
                ]
              : [
                  step(
                    'Dva případy:',
                    'Two cases:',
                    `${polyTex([a, b])} = ${c} \\;\\lor\\; ${polyTex([a, b])} = ${-c}`,
                  ),
                  step(
                    'Řešení:',
                    'Solutions:',
                    mapL(setL([center - half, center + half]), (set) => `K = ${set}`),
                  ),
                  step(
                    `Geometricky: body vzdálené $${half}$ od čísla $${center}$.`,
                    `Geometrically: the points at distance $${half}$ from $${center}$.`,
                  ),
                ],
        misconceptions:
          kind === 'two'
            ? [
                mc(
                  `${a > 0 ? center + half : center - half}`,
                  'incomplete',
                  'Chybí druhý případ, kdy je vnitřek záporný.',
                  'The second case, where the inside is negative, is missing.',
                ),
                mc(
                  `${-(center - half)}; ${-(center + half)}`,
                  'sign',
                  'Kořeny mají opačná znaménka.',
                  'The roots have the opposite signs.',
                ),
              ]
            : kind === 'none'
              ? [
                  mc(
                    `${center - half}; ${center + half}`,
                    'concept',
                    'Absolutní hodnota nemůže být záporná — není co řešit.',
                    'An absolute value cannot be negative — there is nothing to solve.',
                  ),
                ]
              : [],
        verify: [{ kind: 'roots', expr: `abs(${polyIn([a, b])})-(${c})` }],
      };
    },
  }),

  gen({
    id: 'abs.equations.linear-rhs',
    concept: 'abs.equations',
    kind: 'hard',
    levels: [3, 4],
    title: L(
      'Rovnice s absolutní hodnotou a neznámou vpravo',
      'Absolute-value equations with the unknown on the right',
    ),
    est: (lv) => 100 + 30 * lv,
    make(r, lv) {
      // |x − a| = k·x + c.  Candidates: x1 from x − a = kx + c, x2 from −(x − a) = kx + c.
      let found: { a: number; k: number; c: number; x1: Frac; x2: Frac; ok1: boolean; ok2: boolean } | null = null;
      for (let attempt = 0; attempt < 400 && !found; attempt++) {
        const a = r.int(-6, 6);
        const k = r.pick([2, 3, -2, -3]);
        const c = r.int(-9, 9);
        const x1 = frac(a + c, 1 - k);
        const x2 = frac(a - c, 1 + k);
        if (x1.d > (lv === 3 ? 1 : 2) || x2.d > (lv === 3 ? 1 : 2)) continue;
        const rhs = (x: Frac): number => k * fNum(x) + c;
        // A candidate is a root iff the right side is non-negative there (and it lies in its case).
        const ok1 = rhs(x1) >= 0 && fNum(x1) - a >= 0;
        const ok2 = rhs(x2) >= 0 && fNum(x2) - a <= 0;
        if (fNum(x1) === fNum(x2)) continue;
        // Prefer exactly one valid root: that is where the checking habit pays off.
        if (ok1 === ok2 && r.bool(0.75)) continue;
        if (!ok1 && !ok2) continue;
        found = { a, k, c, x1, x2, ok1, ok2 };
      }
      const { a, k, c, x1, x2, ok1, ok2 } = found ?? {
        a: 1,
        k: 2,
        c: 4,
        x1: frac(-5),
        x2: frac(-1),
        ok1: false,
        ok2: true,
      };
      const lhs = absTex(shiftTex(a));
      const rhsTex = polyTex([k, c]);
      const valid = [ok1 ? x1 : null, ok2 ? x2 : null].filter((v): v is Frac => v !== null);
      const values = valid.map(fToInput);
      const extraneous = !ok1 ? x1 : !ok2 ? x2 : null;
      const rhsAt = (x: Frac): Frac => frac(k * x.n + c * x.d, x.d);
      const verdict = (ok: boolean): L =>
        ok
          ? L('Podmínku případu splňuje.', 'It satisfies the condition of its case.')
          : L(
              'Podmínku případu nesplňuje — není to řešení.',
              'It does not satisfy the condition of its case — not a solution.',
            );
      return {
        prompt: L(`Řešte v $\\mathbb{R}$: $${lhs} = ${rhsTex}$`, `Solve in $\\mathbb{R}$: $${lhs} = ${rhsTex}$`),
        answer: { kind: 'set', values, label: 'K =' },
        hints: [
          L(
            `Nulový bod je $${a}$. Rozděl řešení na případy $x \\ge ${a}$ a $x < ${a}$.`,
            `The critical point is $${a}$. Split into the cases $x \\ge ${a}$ and $x < ${a}$.`,
          ),
          L(
            `Případ $x \\ge ${a}$: $${shiftTex(a)} = ${rhsTex}$. Případ $x < ${a}$: $-(${shiftTex(a)}) = ${rhsTex}$.`,
            `Case $x \\ge ${a}$: $${shiftTex(a)} = ${rhsTex}$. Case $x < ${a}$: $-(${shiftTex(a)}) = ${rhsTex}$.`,
          ),
          L(
            'Každý kořen patří jen do svého případu. Ověř, že podmínku svého případu splňuje — nebo proveď zkoušku.',
            'Each root belongs to its own case only. Check that it satisfies the condition of its case — or substitute back.',
          ),
        ],
        solution: [
          step(
            `Případ $x \\ge ${a}$. ${verdict(ok1).cs}`,
            `Case $x \\ge ${a}$. ${verdict(ok1).en}`,
            `${shiftTex(a)} = ${rhsTex} \\;\\Rightarrow\\; x = ${fToTex(x1)}`,
          ),
          step(
            `Případ $x < ${a}$. ${verdict(ok2).cs}`,
            `Case $x < ${a}$. ${verdict(ok2).en}`,
            `-(${shiftTex(a)}) = ${rhsTex} \\;\\Rightarrow\\; x = ${fToTex(x2)}`,
          ),
          step(
            'Řešení:',
            'Solution:',
            mapL(setL(valid), (set) => `K = ${set}`),
          ),
          ...(extraneous
            ? [
                step(
                  `Zkouška pro $x = ${fToTex(extraneous)}$: pravá strana vyjde $${fToTex(rhsAt(extraneous))}$, tedy záporně. Absolutní hodnota se zápornému číslu rovnat nemůže.`,
                  `Check for $x = ${fToTex(extraneous)}$: the right side comes out as $${fToTex(rhsAt(extraneous))}$, which is negative. An absolute value cannot equal a negative number.`,
                ),
              ]
            : []),
        ],
        misconceptions: extraneous
          ? [
              mc(
                `${fToInput(x1)}; ${fToInput(x2)}`,
                'domain',
                'Jeden z kořenů nesplňuje podmínku svého případu. Dosaď ho do původní rovnice.',
                'One of the roots does not satisfy the condition of its case. Substitute it into the original equation.',
              ),
              mc(
                fToInput(extraneous),
                'domain',
                'Tenhle kořen nevyhovuje — pravá strana pro něj vyjde záporná.',
                'This root does not fit — the right-hand side comes out negative for it.',
              ),
            ]
          : [
              mc(
                fToInput(x1),
                'incomplete',
                'Chybí řešení z druhého případu.',
                'The solution from the second case is missing.',
              ),
            ],
        verify: [{ kind: 'roots', expr: `abs(${shiftIn(a)})-(${polyIn([k, c])})` }],
      };
    },
  }),

  gen({
    id: 'abs.inequalities.basic',
    concept: 'abs.inequalities',
    kind: 'core',
    levels: [2, 3],
    title: L('Nerovnice s absolutní hodnotou', 'Inequalities with absolute value'),
    est: (lv) => 60 + 30 * lv,
    make(r, lv) {
      const rel = r.pick(['<', '<=', '>', '>='] as const);
      const relTex = { '<': '<', '<=': '\\le', '>': '>', '>=': '\\ge' }[rel];
      const strict = rel === '<' || rel === '>';
      const inside = rel === '<' || rel === '<=';
      const a = lv === 2 ? 1 : r.pick([2, 3, -2]);
      const center = lv === 2 ? r.int(-6, 6) : r.int(-3, 3);
      const b = -a * center;
      const d = r.int(1, lv === 2 ? 7 : 5);
      // |a(x − center)| REL d  ⇔  |x − center| REL d/|a|
      const radius = frac(d, Math.abs(a));
      const left = frac(center * radius.d - radius.n, radius.d);
      const right = frac(center * radius.d + radius.n, radius.d);
      const lhs = absTex(polyTex([a, b]));
      const value = inside
        ? intervalIn(left, right, !strict, !strict)
        : `${intervalIn('-inf', left, false, !strict)} u ${intervalIn(right, 'inf', !strict, false)}`;
      const shownUnion = inside
        ? intervalL(left, right, !strict, !strict)
        : L(
            `${intervalL('-inf', left, false, !strict).cs} \\cup ${intervalL(right, 'inf', !strict, false).cs}`,
            `${intervalL('-inf', left, false, !strict).en} \\cup ${intervalL(right, 'inf', !strict, false).en}`,
          );
      return {
        prompt: L(`Řešte v $\\mathbb{R}$: $${lhs} ${relTex} ${d}$`, `Solve in $\\mathbb{R}$: $${lhs} ${relTex} ${d}$`),
        answer: { kind: 'interval', value, label: 'x \\in', placeholder: inside ? '(1; 5)' : '(-inf; 1) u (5; inf)' },
        hints: [
          L(
            inside
              ? 'Vzdálenost menší než číslo: jsou to body blízko středu, nebo daleko od něj?'
              : 'Vzdálenost větší než číslo: jsou to body blízko středu, nebo daleko od něj?',
            inside
              ? 'A distance smaller than a number: are those points near the centre or far from it?'
              : 'A distance greater than a number: are those points near the centre or far from it?',
          ),
          inside
            ? L(
                `$|A| ${relTex} ${d} \\iff ${-d} ${relTex} A ${relTex} ${d}$ — jeden interval.`,
                `$|A| ${relTex} ${d} \\iff ${-d} ${relTex} A ${relTex} ${d}$ — a single interval.`,
              )
            : L(
                `$|A| ${relTex} ${d} \\iff A ${rel === '>' ? '<' : '\\le'} ${-d} \\lor A ${relTex} ${d}$ — dva paprsky.`,
                `$|A| ${relTex} ${d} \\iff A ${rel === '>' ? '<' : '\\le'} ${-d} \\lor A ${relTex} ${d}$ — two rays.`,
              ),
          L(
            `Krajní body jsou $${fToTex(left)}$ a $${fToTex(right)}$. Patří do řešení?`,
            `The endpoints are $${fToTex(left)}$ and $${fToTex(right)}$. Are they included?`,
          ),
        ],
        solution: [
          step(
            'Krajní body — kde nastává rovnost:',
            'Endpoints — where equality holds:',
            `${lhs} = ${d} \\iff x = ${fToTex(left)} \\lor x = ${fToTex(right)}`,
          ),
          step(
            inside ? 'Vyhovují body mezi nimi:' : 'Vyhovují body vně:',
            inside ? 'The points between them satisfy it:' : 'The points outside satisfy it:',
            shownUnion,
          ),
          step(
            strict ? 'Nerovnost je ostrá, krajní body nepatří.' : 'Nerovnost je neostrá, krajní body patří.',
            strict
              ? 'The inequality is strict: endpoints excluded.'
              : 'The inequality is not strict: endpoints included.',
          ),
        ],
        verify: [{ kind: 'inequality', expr: `abs(${polyIn([a, b])})-${d}`, rel }],
      };
    },
  }),

  gen({
    id: 'abs.equations.find-mistake',
    concept: 'abs.equations',
    kind: 'debug',
    levels: [2, 3],
    title: L('Najdi chybu: rovnice s absolutní hodnotou', 'Find the mistake: absolute-value equation'),
    est: 75,
    make(r) {
      const a = r.pick([2, 3]);
      const center = r.int(-3, 4);
      const half = r.int(1, 4);
      const b = -a * center;
      const c = a * half;
      const picked = r.pick(['one-case', 'negative-rhs', 'second-sign'] as const);
      // Moving b with the wrong sign is only a mistake when b is not zero.
      const variant = picked === 'second-sign' && b === 0 ? 'one-case' : picked;
      const lhs = absTex(polyTex([a, b]));
      if (variant === 'negative-rhs') {
        return {
          prompt: L(
            `Žák řešil rovnici $${lhs} = ${-c}$. Ve kterém řádku je první chyba?`,
            `A student solved $${lhs} = ${-c}$. Which line contains the first mistake?`,
          ),
          answer: {
            kind: 'spot',
            lines: [
              { tex: `${polyTex([a, b])} = ${-c} \\;\\lor\\; ${polyTex([a, b])} = ${c}` },
              { tex: `${a}x = ${-c - b} \\;\\lor\\; ${a}x = ${c - b}` },
              { tex: `x = ${center - half} \\;\\lor\\; x = ${center + half}` },
            ],
            wrongLine: 0,
            errorType: 'concept',
          },
          hints: [
            L(
              'Podívej se na zadání dřív než na výpočet. Má rovnice vůbec šanci na řešení?',
              'Look at the problem before the computation. Can the equation have a solution at all?',
            ),
            L('Může být absolutní hodnota záporná?', 'Can an absolute value be negative?'),
          ],
          solution: [
            step(
              'Hned první krok je špatně: absolutní hodnota se nemůže rovnat zápornému číslu, takže není co rozdělovat na případy.',
              'The very first step is wrong: an absolute value cannot equal a negative number, so there are no cases to split into.',
            ),
            step('Správně:', 'Correct:', 'K = \\emptyset'),
          ],
        };
      }
      if (variant === 'one-case') {
        return {
          prompt: L(
            `Žák řešil rovnici $${lhs} = ${c}$. Ve kterém řádku je první chyba?`,
            `A student solved $${lhs} = ${c}$. Which line contains the first mistake?`,
          ),
          answer: {
            kind: 'spot',
            lines: [
              { tex: `${polyTex([a, b])} = ${c}` },
              { tex: `${a}x = ${c - b}` },
              { tex: `x = ${center + half}` },
              { tex: `K = \\{${center + half}\\}` },
            ],
            wrongLine: 0,
            errorType: 'incomplete',
          },
          hints: [
            L(
              'Každý řádek je sám o sobě početně správně. Co ale chybí?',
              'Every line is arithmetically correct on its own. But what is missing?',
            ),
            L('Kolik čísel má danou absolutní hodnotu?', 'How many numbers have a given absolute value?'),
          ],
          solution: [
            step(
              'Už první řádek zahodil případ, kdy je vnitřek záporný.',
              'The very first line dropped the case where the inside is negative.',
            ),
            step(
              'Správně:',
              'Correct:',
              mapL(
                setL([center - half, center + half]),
                (set) => `${polyTex([a, b])} = ${c} \\lor ${polyTex([a, b])} = ${-c} \\;\\Rightarrow\\; K = ${set}`,
              ),
            ),
          ],
        };
      }
      return {
        prompt: L(
          `Žák řešil rovnici $${lhs} = ${c}$. Ve kterém řádku je první chyba?`,
          `A student solved $${lhs} = ${c}$. Which line contains the first mistake?`,
        ),
        answer: {
          kind: 'spot',
          lines: [
            { tex: `${polyTex([a, b])} = ${c} \\;\\lor\\; ${polyTex([a, b])} = ${-c}` },
            { tex: `${a}x = ${c - b} \\;\\lor\\; ${a}x = ${-c + b}` },
            { tex: `x = ${fToTex(frac(c - b, a))} \\;\\lor\\; x = ${fToTex(frac(-c + b, a))}` },
          ],
          wrongLine: 1,
          errorType: 'sign',
        },
        hints: [
          L(
            'Rozdělení na případy je v pořádku. Zkontroluj převádění čísel na druhou stranu.',
            'The split into cases is fine. Check how the numbers were moved to the other side.',
          ),
          L(
            `Ve druhé rovnici: z $${polyTex([a, b])} = ${-c}$ má vyjít $${a}x = ${-c} - (${b})$.`,
            `In the second equation: from $${polyTex([a, b])} = ${-c}$ you should get $${a}x = ${-c} - (${b})$.`,
          ),
        ],
        solution: [
          step(
            `Ve druhém případě se číslo $${b}$ převedlo se špatným znaménkem.`,
            `In the second case the number $${b}$ was moved with the wrong sign.`,
          ),
          step('Správně:', 'Correct:', `${a}x = ${-c - b} \\;\\Rightarrow\\; x = ${center - half}`),
        ],
      };
    },
  }),
];
