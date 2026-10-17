import { L, type FigureSpec, type Generator, type Rng } from '@lemma/core';
import { ans, both, numericChoice, plural, trueFalse } from './basic-kit';
import { gen, mc, step } from './helpers';

/** Plane geometry and solids. */

const TRIPLES = [
  [3, 4, 5],
  [5, 12, 13],
  [8, 15, 17],
  [6, 8, 10],
  [9, 12, 15],
  [7, 24, 25],
  [12, 16, 20],
] as const;

const PI = 3.14;
const piNote = L('Počítejte s $\\pi \\doteq 3{,}14$.', 'Use $\\pi \\approx 3.14$.');
const round2 = (value: number): number => Math.round(value * 100) / 100;

/** An L-shaped figure: a W × H rectangle with a w × h corner cut out at the top right. */
function lShape(W: number, H: number, w: number, h: number): FigureSpec {
  return {
    view: { xMin: -1.5, xMax: W + 1.5, yMin: -1.5, yMax: H + 1.5 },
    aspect: (H + 3) / (W + 3),
    bare: true,
    maxWidth: 340,
    polygons: [
      {
        points: [
          [0, 0],
          [W, 0],
          [W, H - h],
          [W - w, H - h],
          [W - w, H],
          [0, H],
        ],
        color: 'a',
      },
    ],
    labels: [
      { x: W / 2, y: -0.8, text: `${W} cm` },
      { x: -1, y: H / 2, text: `${H} cm` },
      { x: W - w / 2, y: H - h + 0.6, text: `${w} cm` },
      { x: W - w - 0.9, y: H - h / 2, text: `${h} cm` },
    ],
  };
}

/** A 3 × 3 plan of a cube building: how many cubes stand on each field. */
function plan(r: Rng): { heights: number[][]; tex: string; total: number; top: number } {
  for (;;) {
    const heights = Array.from({ length: 3 }, () => Array.from({ length: 3 }, () => r.pick([0, 1, 1, 2, 2, 3])));
    const total = heights.flat().reduce((a, b) => a + b, 0);
    const top = Math.max(...heights.flat());
    if (total >= 7 && top >= 2 && heights.flat().filter((v) => v > 0).length >= 5) {
      const tex = `$$\\begin{array}{|c|c|c|} \\hline ${heights.map((row) => row.join(' & ')).join(' \\\\ \\hline ')} \\\\ \\hline \\end{array}$$`;
      return { heights, tex, total, top };
    }
  }
}

/** Unit squares on the outside of a cube building, counted cube by cube. */
function surfaceOf(heights: number[][]): number {
  const filled = (x: number, y: number, z: number): boolean =>
    x >= 0 && x < 3 && y >= 0 && y < 3 && z >= 0 && z < (heights[x]?.[y] ?? 0);
  let faces = 0;
  for (let x = 0; x < 3; x++)
    for (let y = 0; y < 3; y++)
      for (let z = 0; z < heights[x]![y]!; z++)
        for (const [dx, dy, dz] of [
          [1, 0, 0],
          [-1, 0, 0],
          [0, 1, 0],
          [0, -1, 0],
          [0, 0, 1],
          [0, 0, -1],
        ] as const)
          if (!filled(x + dx, y + dy, z + dz)) faces++;
  return faces;
}

const planIntro = (tex: string): L =>
  L(
    `Stavba z krychliček stojí na čtvercové podložce 3 × 3. Plánek ukazuje pohled shora; číslo v poli udává, kolik krychliček na něm stojí na sobě. ${tex}`,
    `A building of unit cubes stands on a 3 × 3 square base. The plan shows the view from above; the number in a field says how many cubes are stacked on it. ${tex}`,
  );

interface Shape {
  name: L;
  axes: number;
  central: boolean;
}

const SHAPES: readonly Shape[] = [
  { name: L('čtverec', 'a square'), axes: 4, central: true },
  { name: L('obdélník, který není čtverec', 'a rectangle that is not a square'), axes: 2, central: true },
  { name: L('rovnostranný trojúhelník', 'an equilateral triangle'), axes: 3, central: false },
  {
    name: L('rovnoramenný trojúhelník, který není rovnostranný', 'an isosceles triangle that is not equilateral'),
    axes: 1,
    central: false,
  },
  { name: L('kosočtverec, který není čtverec', 'a rhombus that is not a square'), axes: 2, central: true },
  { name: L('pravidelný šestiúhelník', 'a regular hexagon'), axes: 6, central: true },
  { name: L('pravidelný pětiúhelník', 'a regular pentagon'), axes: 5, central: false },
  { name: L('rovnoramenný lichoběžník', 'an isosceles trapezoid'), axes: 1, central: false },
  {
    name: L('kosodélník', 'a rhomboid (a parallelogram with unequal sides and no right angle)'),
    axes: 0,
    central: true,
  },
];

export const BASIC_GEOMETRY_GENERATORS: Generator[] = [
  // ------------------------------------------------------------------ perimeter and area
  gen({
    id: 'geom.perimeter-area.rectangles',
    concept: 'geom.perimeter-area',
    kind: 'core',
    levels: [1, 2, 3],
    title: L('Obvod a obsah obdélníku', 'Perimeter and area of a rectangle'),
    est: (lv) => 40 + 30 * lv,
    make(r, lv) {
      const a = r.int(4, 14);
      const b = r.intExcept(3, 12, [a]);
      if (lv === 1) {
        const askArea = r.bool();
        const value = askArea ? a * b : 2 * (a + b);
        return {
          prompt: L(
            `Obdélník má strany dlouhé ${a} cm a ${b} cm. ${askArea ? 'Jaký je jeho obsah v cm²?' : 'Jaký je jeho obvod v cm?'}`,
            `A rectangle has sides of ${a} cm and ${b} cm. ${askArea ? 'What is its area in cm²?' : 'What is its perimeter in cm?'}`,
          ),
          answer: { kind: 'number', value: ans(value) },
          hints: [
            askArea
              ? L('Obsah obdélníku je součin jeho stran.', 'The area of a rectangle is the product of its sides.')
              : L('Obvod je součet délek všech čtyř stran.', 'The perimeter is the sum of all four sides.'),
            askArea
              ? L(`$S = ${a} \\cdot ${b}$`, `$A = ${a} \\cdot ${b}$`)
              : L(`$o = 2 \\cdot (${a} + ${b})$`, `$P = 2 \\cdot (${a} + ${b})$`),
          ],
          solution: [
            askArea
              ? step('Obsah:', 'The area:', `${a} \\cdot ${b} = ${a * b}`)
              : step('Obvod:', 'The perimeter:', `2 \\cdot (${a} + ${b}) = ${2 * (a + b)}`),
          ],
          misconceptions: [
            mc(
              ans(askArea ? 2 * (a + b) : a * b),
              'formula',
              askArea ? 'To je obvod, ne obsah.' : 'To je obsah, ne obvod.',
              askArea ? 'That is the perimeter, not the area.' : 'That is the area, not the perimeter.',
            ),
          ],
          verify: [{ kind: 'value', expr: askArea ? `${a}*${b}` : `2*(${a}+${b})` }],
        };
      }
      if (lv === 2) {
        return {
          prompt: L(
            `Obdélník má obsah ${a * b} cm² a jedna jeho strana měří ${a} cm. Jaký je jeho obvod v cm?`,
            `A rectangle has an area of ${a * b} cm² and one of its sides is ${a} cm. What is its perimeter in cm?`,
          ),
          answer: { kind: 'number', value: ans(2 * (a + b)) },
          hints: [
            L('Z obsahu a jedné strany zjistíš druhou stranu.', 'The area and one side give you the other side.'),
            L(`Druhá strana: $${a * b} : ${a} = ${b}$ cm.`, `The other side: $${a * b} \\div ${a} = ${b}$ cm.`),
          ],
          solution: [
            step('Druhá strana:', 'The other side:', L(`${a * b} : ${a} = ${b}`, `${a * b} \\div ${a} = ${b}`)),
            step('Obvod:', 'The perimeter:', `2 \\cdot (${a} + ${b}) = ${2 * (a + b)}`),
          ],
          misconceptions: [
            mc(
              ans(b),
              'incomplete',
              'To je druhá strana. Otázka se ptá na obvod.',
              'That is the other side. The question asks for the perimeter.',
            ),
          ],
          verify: [{ kind: 'value', expr: `2*(${a}+${a * b}/${a})` }],
        };
      }
      const W = r.int(7, 12);
      const H = r.int(6, 10);
      const w = r.int(2, W - 3);
      const h = r.int(2, H - 3);
      const askArea = r.bool();
      const value = askArea ? W * H - w * h : 2 * (W + H);
      return {
        prompt: L(
          `Z obdélníku ${W} cm × ${H} cm byl v rohu vyříznut obdélník ${w} cm × ${h} cm (viz obrázek). ${askArea ? 'Jaký je obsah zbylého útvaru v cm²?' : 'Jaký je obvod zbylého útvaru v cm?'}`,
          `A ${w} cm × ${h} cm rectangle was cut out of the corner of a ${W} cm × ${H} cm rectangle (see the figure). ${askArea ? 'What is the area of what is left, in cm²?' : 'What is the perimeter of what is left, in cm?'}`,
        ),
        figure: lShape(W, H, w, h),
        answer: { kind: 'number', value: ans(value) },
        hints: askArea
          ? [
              L(
                'Od obsahu velkého obdélníku odečti obsah vyříznutého.',
                'Subtract the area of the cut-out from the area of the large rectangle.',
              ),
              L(`$${W} \\cdot ${H} - ${w} \\cdot ${h}$`, `$${W} \\cdot ${H} - ${w} \\cdot ${h}$`),
            ]
          : [
              L(
                'Projdi obvod po stranách. Dvě nové strany ve výřezu jsou stejně dlouhé jako ty dvě, které zmizely.',
                'Walk along the perimeter. The two new sides of the notch are as long as the two that disappeared.',
              ),
              L(
                `Obvod je stejný jako u původního obdélníku: $2 \\cdot (${W} + ${H})$.`,
                `The perimeter is the same as that of the original rectangle: $2 \\cdot (${W} + ${H})$.`,
              ),
            ],
        solution: askArea
          ? [
              step(
                'Velký obdélník bez výřezu:',
                'The large rectangle minus the notch:',
                `${W} \\cdot ${H} - ${w} \\cdot ${h} = ${W * H} - ${w * h} = ${value}`,
              ),
            ]
          : [
              step(
                'Vodorovné strany dají dohromady dvakrát šířku, svislé dvakrát výšku — výřez na tom nic nemění.',
                'The horizontal sides add up to twice the width and the vertical ones to twice the height — the notch changes nothing.',
              ),
              step('Obvod:', 'The perimeter:', `2 \\cdot (${W} + ${H}) = ${value}`),
            ],
        misconceptions: askArea
          ? [
              mc(
                ans(W * H),
                'incomplete',
                'To je obsah celého obdélníku. Výřez se musí odečíst.',
                'That is the area of the whole rectangle. The notch has to be subtracted.',
              ),
            ]
          : [
              mc(
                ans(2 * (W + H) - 2 * (w + h)),
                'concept',
                'Vyříznutím rohu se obvod nezkrátí: přibudou dvě strany stejně dlouhé jako ty, které ubyly.',
                'Cutting out a corner does not shorten the perimeter: two sides appear that are as long as the ones removed.',
              ),
            ],
        verify: [
          { kind: 'value', expr: askArea ? `${W}*${H}-${w}*${h}` : `${W}+${H}+(${W}-${w})+${h}+${w}+(${H}-${h})` },
        ],
      };
    },
  }),

  gen({
    id: 'geom.perimeter-area.triangles',
    concept: 'geom.perimeter-area',
    kind: 'core',
    levels: [2, 3, 4],
    title: L('Obsah trojúhelníku a lichoběžníku', 'Area of a triangle and a trapezoid'),
    est: (lv) => 50 + 30 * lv,
    make(r, lv) {
      if (lv === 2) {
        const base = 2 * r.int(3, 9);
        const height = r.int(3, 11);
        return {
          prompt: L(
            `Trojúhelník má stranu dlouhou ${base} cm a výšku na tuto stranu ${height} cm. Jaký je jeho obsah v cm²?`,
            `A triangle has a side of ${base} cm and the altitude to that side is ${height} cm. What is its area in cm²?`,
          ),
          answer: { kind: 'number', value: ans((base * height) / 2) },
          hints: [
            L(
              'Trojúhelník je polovina rovnoběžníku se stejnou základnou a výškou.',
              'A triangle is half of a parallelogram with the same base and height.',
            ),
            L(`$S = \\frac{${base} \\cdot ${height}}{2}$`, `$A = \\frac{${base} \\cdot ${height}}{2}$`),
          ],
          solution: [step('Obsah:', 'The area:', `\\frac{${base} \\cdot ${height}}{2} = ${(base * height) / 2}`)],
          misconceptions: [
            mc(
              ans(base * height),
              'formula',
              'To je obsah rovnoběžníku. Trojúhelník je jeho polovina.',
              'That is the area of the parallelogram. The triangle is half of it.',
            ),
          ],
          verify: [{ kind: 'value', expr: `${base}*${height}/2` }],
        };
      }
      if (lv === 3) {
        const c = r.int(4, 9);
        const a = c + 2 * r.int(1, 4);
        const v = r.int(3, 9);
        const area = ((a + c) * v) / 2;
        return {
          prompt: L(
            `Lichoběžník má základny dlouhé ${a} cm a ${c} cm a výšku ${v} cm. Jaký je jeho obsah v cm²?`,
            `A trapezoid has bases of ${a} cm and ${c} cm and a height of ${v} cm. What is its area in cm²?`,
          ),
          answer: { kind: 'number', value: ans(area) },
          hints: [
            L(
              'Obsah lichoběžníku je průměr obou základen krát výška.',
              'The area of a trapezoid is the mean of the two bases times the height.',
            ),
            L(`$S = \\frac{(${a} + ${c}) \\cdot ${v}}{2}$`, `$A = \\frac{(${a} + ${c}) \\cdot ${v}}{2}$`),
          ],
          solution: [step('Obsah:', 'The area:', `\\frac{(${a} + ${c}) \\cdot ${v}}{2} = ${area}`)],
          misconceptions: [
            mc(
              ans(a * v),
              'formula',
              'Počítal jsi jako u obdélníku s delší základnou. Základny jsou dvě a bere se jejich průměr.',
              'You computed as for a rectangle with the longer base. There are two bases and their mean is taken.',
            ),
          ],
          verify: [{ kind: 'value', expr: `(${a}+${c})*${v}/2` }],
        };
      }
      const s = 2 * r.int(4, 8);
      const t = r.int(2, s / 2 - 1);
      const value = s * s - 2 * t * t;
      return {
        prompt: L(
          `Ze čtverce o straně ${s} cm odstřihneme v každém rohu pravoúhlý rovnoramenný trojúhelník s odvěsnami dlouhými ${t} cm. Jaký je obsah zbylého osmiúhelníku v cm²?`,
          `From a square of side ${s} cm we cut off, at each corner, a right isosceles triangle with legs of ${t} cm. What is the area of the octagon that is left, in cm²?`,
        ),
        answer: { kind: 'number', value: ans(value) },
        hints: [
          L(
            'Od obsahu čtverce odečti obsahy čtyř odstřižených trojúhelníků.',
            'Subtract the areas of the four cut-off triangles from the area of the square.',
          ),
          L(
            `Jeden trojúhelník má obsah $\\frac{${t} \\cdot ${t}}{2}$; čtyři dohromady $${2 * t * t}$ cm².`,
            `One triangle has an area of $\\frac{${t} \\cdot ${t}}{2}$; four together $${2 * t * t}$ cm².`,
          ),
        ],
        solution: [
          step('Čtverec:', 'The square:', `${s}^2 = ${s * s}`),
          step('Čtyři trojúhelníky:', 'The four triangles:', `4 \\cdot \\frac{${t} \\cdot ${t}}{2} = ${2 * t * t}`),
          step('Osmiúhelník:', 'The octagon:', `${s * s} - ${2 * t * t} = ${value}`),
        ],
        misconceptions: [
          mc(
            ans(s * s - 4 * t * t),
            'formula',
            'Obsah pravoúhlého trojúhelníku je polovina součinu odvěsen.',
            'The area of a right triangle is half the product of its legs.',
          ),
        ],
        verify: [{ kind: 'value', expr: `${s}^2-4*${t}*${t}/2` }],
      };
    },
  }),

  gen({
    id: 'geom.perimeter-area.choice',
    concept: 'geom.perimeter-area',
    kind: 'core',
    levels: [2, 3],
    title: L('Obvod a obsah – výběr odpovědi', 'Perimeter and area – choose the answer'),
    tags: ['mc5'],
    est: (lv) => 60 + 30 * lv,
    make(r, lv) {
      if (lv === 2) {
        const a = r.int(5, 12);
        const built = numericChoice(r, a * a, [4 * a, 2 * a * a, 16 * a, a * a * 4], (v) => L(`${v} cm²`, `${v} cm²`));
        return {
          prompt: L(
            `Čtverec má obvod ${4 * a} cm. Jaký je jeho obsah?`,
            `A square has a perimeter of ${4 * a} cm. What is its area?`,
          ),
          answer: built.spec,
          hints: [
            L('Z obvodu zjisti délku strany.', 'Find the side from the perimeter.'),
            L(`Strana: $${4 * a} : 4 = ${a}$ cm.`, `The side: $${4 * a} \\div 4 = ${a}$ cm.`),
          ],
          solution: [
            step('Strana:', 'The side:', L(`${4 * a} : 4 = ${a}`, `${4 * a} \\div 4 = ${a}`)),
            step('Obsah:', 'The area:', `${a}^2 = ${a * a}`),
          ],
          misconceptions: [built.idOf(4 * a)].flatMap((id) =>
            id
              ? [
                  mc(
                    id,
                    'formula',
                    'To je obvod. Obsah je strana krát strana.',
                    'That is the perimeter. The area is side times side.',
                  ),
                ]
              : [],
          ),
        };
      }
      const n = r.pick([2, 3, 4]);
      const side = r.int(3, 8);
      const perimeter = 2 * (n * side + side);
      const area = n * side * side;
      const built = numericChoice(r, area, [side * side, perimeter, (perimeter / 4) ** 2, 2 * area], (v) =>
        L(`${v} cm²`, `${v} cm²`),
      );
      return {
        prompt: L(
          `Obdélník se skládá ze ${n} shodných čtverců položených vedle sebe v jedné řadě. Jeho obvod je ${perimeter} cm. Jaký je obsah obdélníku?`,
          `A rectangle is made of ${n} congruent squares placed side by side in one row. Its perimeter is ${perimeter} cm. What is the area of the rectangle?`,
        ),
        answer: built.spec,
        hints: [
          L(
            `Označ stranu čtverce $a$. Obdélník má pak rozměry $${n}a$ a $a$.`,
            `Call the side of a square $a$. The rectangle is then $${n}a$ by $a$.`,
          ),
          L(
            `Obvod: $2 \\cdot (${n}a + a) = ${2 * (n + 1)}a = ${perimeter}$`,
            `The perimeter: $2 \\cdot (${n}a + a) = ${2 * (n + 1)}a = ${perimeter}$`,
          ),
        ],
        solution: [
          step(
            'Strana čtverce:',
            'The side of a square:',
            L(`${perimeter} : ${2 * (n + 1)} = ${side}`, `${perimeter} \\div ${2 * (n + 1)} = ${side}`),
          ),
          step('Obsah obdélníku:', 'The area of the rectangle:', `${n} \\cdot ${side}^2 = ${area}`),
        ],
        misconceptions: [built.idOf(side * side)].flatMap((id) =>
          id ? [mc(id, 'incomplete', 'To je obsah jednoho čtverce.', 'That is the area of one square.')] : [],
        ),
      };
    },
  }),

  // ------------------------------------------------------------------------------- angles
  gen({
    id: 'geom.angles.triangle',
    concept: 'geom.angles',
    kind: 'core',
    levels: [1, 2, 3],
    title: L('Úhly v trojúhelníku', 'Angles in a triangle'),
    est: (lv) => 35 + 25 * lv,
    make(r, lv) {
      if (lv === 1) {
        const alpha = r.int(25, 85);
        const beta = r.int(30, 150 - alpha);
        const gamma = 180 - alpha - beta;
        return {
          prompt: L(
            `V trojúhelníku ABC je $\\alpha = ${alpha}^\\circ$ a $\\beta = ${beta}^\\circ$. Určete velikost úhlu $\\gamma$ ve stupních.`,
            `In triangle ABC, $\\alpha = ${alpha}^\\circ$ and $\\beta = ${beta}^\\circ$. Find the angle $\\gamma$ in degrees.`,
          ),
          answer: { kind: 'number', value: ans(gamma), unit: 'deg', label: '\\gamma =' },
          hints: [
            L(
              'Součet vnitřních úhlů trojúhelníku je $180^\\circ$.',
              'The interior angles of a triangle add up to $180^\\circ$.',
            ),
            L(
              `$\\gamma = 180^\\circ - ${alpha}^\\circ - ${beta}^\\circ$`,
              `$\\gamma = 180^\\circ - ${alpha}^\\circ - ${beta}^\\circ$`,
            ),
          ],
          solution: [step('Doplněk do 180°:', 'What is missing to 180°:', `180 - ${alpha} - ${beta} = ${gamma}`)],
          misconceptions: [
            mc(
              ans(360 - alpha - beta),
              'formula',
              'Součet úhlů v trojúhelníku je 180°, ne 360°.',
              'The angles of a triangle add up to 180°, not 360°.',
            ),
          ],
          verify: [{ kind: 'value', expr: `180-${alpha}-${beta}` }],
        };
      }
      if (lv === 2) {
        const base = r.int(31, 79);
        const apex = 180 - 2 * base;
        if (r.bool()) {
          return {
            prompt: L(
              `V rovnoramenném trojúhelníku má úhel při hlavním vrcholu velikost $${apex}^\\circ$. Určete ve stupních velikost úhlu při základně.`,
              `In an isosceles triangle the angle at the apex is $${apex}^\\circ$. Find a base angle in degrees.`,
            ),
            answer: { kind: 'number', value: ans(base), unit: 'deg' },
            hints: [
              L(
                'Úhly při základně rovnoramenného trojúhelníku jsou stejné.',
                'The base angles of an isosceles triangle are equal.',
              ),
              L(
                `Na oba dohromady zbývá $180^\\circ - ${apex}^\\circ = ${180 - apex}^\\circ$.`,
                `Together they take $180^\\circ - ${apex}^\\circ = ${180 - apex}^\\circ$.`,
              ),
            ],
            solution: [
              step(
                'Oba úhly při základně dohromady a jeden z nich:',
                'Both base angles together, and one of them:',
                L(
                  `180 - ${apex} = ${180 - apex}, \\quad ${180 - apex} : 2 = ${base}`,
                  `180 - ${apex} = ${180 - apex}, \\quad ${180 - apex} \\div 2 = ${base}`,
                ),
              ),
            ],
            misconceptions: [
              mc(
                ans(180 - apex),
                'incomplete',
                'To jsou oba úhly při základně dohromady.',
                'That is both base angles together.',
              ),
            ],
            verify: [{ kind: 'value', expr: `(180-${apex})/2` }],
          };
        }
        const exterior = 180 - base;
        return {
          prompt: L(
            `V rovnoramenném trojúhelníku má vnější úhel při základně velikost $${exterior}^\\circ$. Určete ve stupních velikost úhlu při hlavním vrcholu.`,
            `In an isosceles triangle an exterior angle at the base is $${exterior}^\\circ$. Find the angle at the apex in degrees.`,
          ),
          answer: { kind: 'number', value: ans(apex), unit: 'deg' },
          hints: [
            L(
              'Vnější a vnitřní úhel u téhož vrcholu jsou vedlejší: dají dohromady $180^\\circ$.',
              'An exterior and an interior angle at the same vertex are adjacent: together they make $180^\\circ$.',
            ),
            L(
              `Vnitřní úhel při základně je $${base}^\\circ$, a takové jsou dva.`,
              `The interior base angle is $${base}^\\circ$, and there are two of them.`,
            ),
          ],
          solution: [
            step('Vnitřní úhel při základně:', 'The interior base angle:', `180 - ${exterior} = ${base}`),
            step('Úhel při hlavním vrcholu:', 'The angle at the apex:', `180 - 2 \\cdot ${base} = ${apex}`),
          ],
          misconceptions: [mc(ans(base), 'incomplete', 'To je úhel při základně.', 'That is a base angle.')],
          verify: [{ kind: 'value', expr: `180-2*(180-${exterior})` }],
        };
      }
      const alpha = 2 * r.int(15, 38);
      const beta = 2 * r.int(15, 38);
      const gamma = 180 - alpha - beta;
      const value = 180 - alpha - gamma / 2;
      return {
        prompt: L(
          `V trojúhelníku ABC je $\\alpha = ${alpha}^\\circ$ a $\\beta = ${beta}^\\circ$. Osa úhlu $\\gamma$ protíná stranu AB v bodě D. Určete ve stupních velikost úhlu ADC.`,
          `In triangle ABC, $\\alpha = ${alpha}^\\circ$ and $\\beta = ${beta}^\\circ$. The bisector of $\\gamma$ meets side AB at D. Find the angle ADC in degrees.`,
        ),
        answer: { kind: 'number', value: ans(value), unit: 'deg' },
        hints: [
          L(
            'Nejdřív úhel $\\gamma$, pak jeho polovinu. Úhel ADC hledej v trojúhelníku ADC.',
            'First the angle $\\gamma$, then half of it. Look for the angle ADC in triangle ADC.',
          ),
          L(
            `$\\gamma = ${gamma}^\\circ$; v trojúhelníku ADC jsou úhly $${alpha}^\\circ$ a $${gamma / 2}^\\circ$.`,
            `$\\gamma = ${gamma}^\\circ$; triangle ADC has the angles $${alpha}^\\circ$ and $${gamma / 2}^\\circ$.`,
          ),
        ],
        solution: [
          step(
            'Úhel γ a jeho polovina:',
            'The angle γ and half of it:',
            L(
              `180 - ${alpha} - ${beta} = ${gamma}, \\quad ${gamma} : 2 = ${gamma / 2}`,
              `180 - ${alpha} - ${beta} = ${gamma}, \\quad ${gamma} \\div 2 = ${gamma / 2}`,
            ),
          ),
          step('V trojúhelníku ADC:', 'In triangle ADC:', `180 - ${alpha} - ${gamma / 2} = ${value}`),
        ],
        misconceptions: [
          mc(
            ans(180 - alpha - gamma),
            'misread',
            'Osa úhel γ půlí: v trojúhelníku ADC je jen jeho polovina.',
            'The bisector halves γ: triangle ADC contains only half of it.',
          ),
        ],
        verify: [{ kind: 'value', expr: `180-${alpha}-(180-${alpha}-${beta})/2` }],
      };
    },
  }),

  gen({
    id: 'geom.angles.parallel',
    concept: 'geom.angles',
    kind: 'core',
    levels: [2, 3, 4],
    title: L('Úhly u rovnoběžek', 'Angles at parallel lines'),
    est: (lv) => 45 + 30 * lv,
    make(r, lv) {
      if (lv === 2) {
        const x = r.intExcept(38, 142, [90]);
        const value = Math.max(x, 180 - x);
        return {
          prompt: L(
            `Dvě rovnoběžky $p$, $q$ protíná třetí přímka. Jeden z úhlů, které svírá s přímkou $p$, má velikost $${x}^\\circ$. Určete ve stupních velikost tupého úhlu, který tato přímka svírá s přímkou $q$.`,
            `Two parallel lines $p$, $q$ are cut by a third line. One of the angles it makes with $p$ is $${x}^\\circ$. Find, in degrees, the obtuse angle it makes with $q$.`,
          ),
          answer: { kind: 'number', value: ans(value), unit: 'deg' },
          hints: [
            L(
              'U obou rovnoběžek vznikají stejné dvojice úhlů (souhlasné a střídavé úhly jsou shodné).',
              'The same pairs of angles appear at both parallels (corresponding and alternate angles are equal).',
            ),
            L(
              `U přímky $q$ jsou úhly $${x}^\\circ$ a $${180 - x}^\\circ$.`,
              `At $q$ the angles are $${x}^\\circ$ and $${180 - x}^\\circ$.`,
            ),
          ],
          solution: [
            step(
              `U každé z rovnoběžek svírá přímka úhly $${x}^\\circ$ a $180^\\circ - ${x}^\\circ = ${180 - x}^\\circ$.`,
              `At each parallel the line makes the angles $${x}^\\circ$ and $180^\\circ - ${x}^\\circ = ${180 - x}^\\circ$.`,
            ),
            step(`Tupý je ten větší: ${value}°.`, `The obtuse one is the larger: ${value}°.`),
          ],
          misconceptions: [
            mc(
              ans(Math.min(x, 180 - x)),
              'misread',
              'To je ostrý úhel. Otázka se ptá na tupý.',
              'That is the acute angle. The question asks for the obtuse one.',
            ),
          ],
          verify: [{ kind: 'value', expr: `(180+abs(2*${x}-180))/2` }],
        };
      }
      if (lv === 3) {
        const a = r.pick([2, 3, 4]);
        const c = r.pick([1, 2, 3].filter((v) => v !== a));
        const x = r.int(12, 30);
        const b = r.int(5, 25);
        const angle = a * x + b;
        const d = angle - c * x;
        return {
          prompt: L(
            `Dvě rovnoběžky protíná třetí přímka. Dva střídavé úhly mají velikosti $(${a}x + ${b})^\\circ$ a $(${c === 1 ? '' : c}x ${d < 0 ? '-' : '+'} ${Math.abs(d)})^\\circ$. Určete ve stupních velikost těchto úhlů.`,
            `Two parallel lines are cut by a third line. Two alternate angles measure $(${a}x + ${b})^\\circ$ and $(${c === 1 ? '' : c}x ${d < 0 ? '-' : '+'} ${Math.abs(d)})^\\circ$. Find these angles in degrees.`,
          ),
          answer: { kind: 'number', value: ans(angle), unit: 'deg' },
          hints: [
            L(
              'Střídavé úhly u rovnoběžek jsou stejně velké. Z toho dostaneš rovnici pro $x$.',
              'Alternate angles at parallel lines are equal. That gives an equation for $x$.',
            ),
            L(
              `$${a}x + ${b} = ${c === 1 ? '' : c}x ${d < 0 ? '-' : '+'} ${Math.abs(d)}$, tedy $x = ${x}$.`,
              `$${a}x + ${b} = ${c === 1 ? '' : c}x ${d < 0 ? '-' : '+'} ${Math.abs(d)}$, so $x = ${x}$.`,
            ),
          ],
          solution: [
            step(
              'Rovnice:',
              'The equation:',
              `${a}x + ${b} = ${c === 1 ? '' : c}x ${d < 0 ? '-' : '+'} ${Math.abs(d)} \\quad\\Rightarrow\\quad x = ${x}`,
            ),
            step('Velikost úhlů:', 'The angles:', `${a} \\cdot ${x} + ${b} = ${angle}`),
          ],
          misconceptions: [
            mc(
              ans(x),
              'incomplete',
              'To je hodnota $x$. Úhel získáš dosazením.',
              'That is the value of $x$. Substitute to get the angle.',
            ),
          ],
          verify: [{ kind: 'value', expr: `${a}*(${d}-${b})/(${a}-${c})+${b}` }],
        };
      }
      const alpha = r.int(35, 75);
      const beta = r.int(35, 75);
      const gamma = 180 - alpha - beta;
      const [name, value, why, whyEn] = r.pick([
        [
          'AKL',
          180 - alpha,
          `Úhly AKL a CKL jsou vedlejší a úhel CKL je souhlasný s úhlem α.`,
          'The angles AKL and CKL are adjacent, and CKL corresponds to α.',
        ],
        [
          'KLB',
          180 - beta,
          `Úhly KLB a CLK jsou vedlejší a úhel CLK je souhlasný s úhlem β.`,
          'The angles KLB and CLK are adjacent, and CLK corresponds to β.',
        ],
        ['KCL', gamma, `Úhel KCL je úhel γ trojúhelníku ABC.`, 'The angle KCL is the angle γ of triangle ABC.'],
      ] as const);
      return {
        prompt: L(
          `V trojúhelníku ABC je $\\alpha = ${alpha}^\\circ$ a $\\beta = ${beta}^\\circ$. Přímka rovnoběžná se stranou AB protíná stranu AC v bodě K a stranu BC v bodě L. Určete ve stupních velikost úhlu ${name}.`,
          `In triangle ABC, $\\alpha = ${alpha}^\\circ$ and $\\beta = ${beta}^\\circ$. A line parallel to side AB meets side AC at K and side BC at L. Find the angle ${name} in degrees.`,
        ),
        answer: { kind: 'number', value: ans(value), unit: 'deg' },
        hints: [
          L(
            'Načrtni si obrázek. Přímka KL je rovnoběžná s AB, takže u bodů K a L vznikají úhly souhlasné s α a β.',
            'Sketch it. The line KL is parallel to AB, so angles corresponding to α and β appear at K and L.',
          ),
          L(why, whyEn),
        ],
        solution: [step(why, whyEn), step('Velikost úhlu:', 'The angle:', `${value}`)],
        misconceptions:
          name === 'AKL'
            ? [
                mc(
                  ans(alpha),
                  'misread',
                  'To je úhel CKL. Úhel AKL je jeho vedlejší úhel.',
                  'That is the angle CKL. The angle AKL is adjacent to it.',
                ),
              ]
            : name === 'KLB'
              ? [
                  mc(
                    ans(beta),
                    'misread',
                    'To je úhel CLK. Úhel KLB je jeho vedlejší úhel.',
                    'That is the angle CLK. The angle KLB is adjacent to it.',
                  ),
                ]
              : [],
        verify: [
          {
            kind: 'value',
            expr: name === 'AKL' ? `180-${alpha}` : name === 'KLB' ? `180-${beta}` : `180-${alpha}-${beta}`,
          },
        ],
      };
    },
  }),

  gen({
    id: 'geom.angles.polygons',
    concept: 'geom.angles',
    kind: 'core',
    levels: [2, 3, 4],
    title: L('Úhly v mnohoúhelníku', 'Angles in a polygon'),
    est: (lv) => 45 + 30 * lv,
    make(r, lv) {
      const n = r.pick([5, 6, 9, 10, 12]);
      const names: Record<number, [string, string]> = {
        5: ['pětiúhelníku', 'pentagon'],
        6: ['šestiúhelníku', 'hexagon'],
        9: ['devítiúhelníku', 'nonagon'],
        10: ['desetiúhelníku', 'decagon'],
        12: ['dvanáctiúhelníku', 'dodecagon'],
      };
      const interior = ((n - 2) * 180) / n;
      if (lv === 2) {
        return {
          prompt: L(
            `Určete ve stupních součet všech vnitřních úhlů ${names[n]![0]}.`,
            `Find, in degrees, the sum of all the interior angles of a ${names[n]![1]}.`,
          ),
          answer: { kind: 'number', value: ans((n - 2) * 180), unit: 'deg' },
          hints: [
            L(
              'Rozděl mnohoúhelník úhlopříčkami z jednoho vrcholu na trojúhelníky.',
              'Split the polygon into triangles by the diagonals from one vertex.',
            ),
            L(
              `${plural(n - 2, 'Vznikne', 'Vzniknou', 'Vznikne')} ${n - 2} ${plural(n - 2, 'trojúhelník', 'trojúhelníky', 'trojúhelníků')}.`,
              `That gives ${n - 2} triangles.`,
            ),
          ],
          solution: [
            step(
              `${n - 2} ${plural(n - 2, 'trojúhelník', 'trojúhelníky', 'trojúhelníků')} po 180°:`,
              `${n - 2} triangles of 180° each:`,
              `${n - 2} \\cdot 180 = ${(n - 2) * 180}`,
            ),
          ],
          misconceptions: [
            mc(
              ans(n * 180),
              'formula',
              'Trojúhelníků je o dva méně než vrcholů.',
              'There are two triangles fewer than vertices.',
            ),
          ],
          verify: [{ kind: 'value', expr: `(${n}-2)*180` }],
        };
      }
      if (lv === 3) {
        return {
          prompt: L(
            `Určete ve stupních velikost vnitřního úhlu pravidelného ${names[n]![0]}.`,
            `Find, in degrees, an interior angle of a regular ${names[n]![1]}.`,
          ),
          answer: { kind: 'number', value: ans(interior), unit: 'deg' },
          hints: [
            L(
              'Nejdřív součet všech vnitřních úhlů, pak ho rozděl mezi stejné úhly.',
              'First the sum of all the interior angles, then share it among the equal angles.',
            ),
            L(
              `Součet je $${n - 2} \\cdot 180^\\circ = ${(n - 2) * 180}^\\circ$.`,
              `The sum is $${n - 2} \\cdot 180^\\circ = ${(n - 2) * 180}^\\circ$.`,
            ),
          ],
          solution: [
            step('Součet:', 'The sum:', `${n - 2} \\cdot 180 = ${(n - 2) * 180}`),
            step(
              'Jeden úhel:',
              'One angle:',
              L(`${(n - 2) * 180} : ${n} = ${interior}`, `${(n - 2) * 180} \\div ${n} = ${interior}`),
            ),
          ],
          misconceptions: [
            mc(
              ans(360 / n),
              'formula',
              'To je středový (nebo vnější) úhel, ne vnitřní.',
              'That is the central (or exterior) angle, not the interior one.',
            ),
          ],
          verify: [{ kind: 'value', expr: `(${n}-2)*180/${n}` }],
        };
      }
      const value = 180 / n;
      return {
        prompt: L(
          `V pravidelném ${names[n]![0]} ABCDE… spojíme vrcholy A a C. Určete ve stupních velikost úhlu BAC.`,
          `In a regular ${names[n]![1]} ABCDE… the vertices A and C are joined. Find the angle BAC in degrees.`,
        ),
        answer: { kind: 'number', value: ans(value), unit: 'deg' },
        hints: [
          L(
            'Trojúhelník ABC je rovnoramenný: strany AB a BC jsou stejně dlouhé. Úhel při vrcholu B je vnitřní úhel mnohoúhelníku.',
            'Triangle ABC is isosceles: AB and BC are equal. The angle at B is an interior angle of the polygon.',
          ),
          L(
            `Vnitřní úhel je $${interior}^\\circ$; na úhly při základně AC zbývá $${180 - interior}^\\circ$.`,
            `The interior angle is $${interior}^\\circ$; $${180 - interior}^\\circ$ is left for the angles at the base AC.`,
          ),
        ],
        solution: [
          step(
            'Vnitřní úhel při vrcholu B:',
            'The interior angle at B:',
            L(`${(n - 2) * 180} : ${n} = ${interior}`, `${(n - 2) * 180} \\div ${n} = ${interior}`),
          ),
          step(
            'Úhel BAC je úhel při základně rovnoramenného trojúhelníku ABC:',
            'BAC is a base angle of the isosceles triangle ABC:',
            L(`(180 - ${interior}) : 2 = ${value}`, `(180 - ${interior}) \\div 2 = ${value}`),
          ),
        ],
        misconceptions: [
          mc(
            ans(interior / 2),
            'concept',
            'Spojnice AC úhel při vrcholu A nepůlí. Počítej v trojúhelníku ABC.',
            'The segment AC does not halve the angle at A. Work in triangle ABC.',
          ),
        ],
        verify: [{ kind: 'value', expr: `(180-(${n}-2)*180/${n})/2` }],
      };
    },
  }),

  gen({
    id: 'geom.angles.inequality',
    concept: 'geom.angles',
    kind: 'reverse',
    levels: [2, 3],
    title: L('Trojúhelníková nerovnost', 'The triangle inequality'),
    est: (lv) => 55 + 30 * lv,
    make(r, lv) {
      const a = r.int(4, 12);
      const b = r.int(a + 2, a + 14);
      const low = b - a + 1;
      const high = a + b - 1;
      if (lv === 2) {
        const count = high - low + 1;
        return {
          prompt: L(
            `Dvě strany trojúhelníku měří ${a} cm a ${b} cm. Délka třetí strany je v centimetrech celé číslo. Kolik různých délek může třetí strana mít?`,
            `Two sides of a triangle are ${a} cm and ${b} cm. The third side is a whole number of centimetres. How many different lengths can it have?`,
          ),
          answer: { kind: 'number', value: ans(count) },
          hints: [
            L(
              'Třetí strana musí být kratší než součet zbylých dvou a delší než jejich rozdíl.',
              'The third side must be shorter than the sum of the other two and longer than their difference.',
            ),
            L(`Může měřit ${low} až ${high} cm.`, `It can be ${low} to ${high} cm.`),
          ],
          solution: [
            step('Meze:', 'The bounds:', `${b} - ${a} < c < ${b} + ${a}`),
            step(
              `Celá čísla od ${low} do ${high}:`,
              `The whole numbers from ${low} to ${high}:`,
              `${high} - ${low} + 1 = ${count}`,
            ),
          ],
          misconceptions: [
            mc(
              ans(count + 2),
              'concept',
              'Krajní hodnoty nevyhovují: se stranou rovnou součtu nebo rozdílu by trojúhelník „splaskl“ do úsečky.',
              'The end values do not work: with a side equal to the sum or the difference the triangle would collapse into a segment.',
            ),
          ],
          verify: [{ kind: 'value', expr: `(${a}+${b}-1)-(${b}-${a}+1)+1` }],
        };
      }
      const askMax = r.bool();
      const value = askMax ? a + b + high : a + b + low;
      return {
        prompt: L(
          `Dvě strany trojúhelníku měří ${a} cm a ${b} cm. Délka třetí strany je v centimetrech celé číslo. Jaký ${askMax ? 'největší' : 'nejmenší'} obvod v cm může trojúhelník mít?`,
          `Two sides of a triangle are ${a} cm and ${b} cm. The third side is a whole number of centimetres. What is the ${askMax ? 'largest' : 'smallest'} perimeter the triangle can have, in cm?`,
        ),
        answer: { kind: 'number', value: ans(value) },
        hints: [
          L(
            'Nejdřív zjisti, jak dlouhá může třetí strana nejvýše a nejméně být.',
            'First find how long the third side can be at most and at least.',
          ),
          L(`Třetí strana měří ${low} až ${high} cm.`, `The third side is ${low} to ${high} cm.`),
        ],
        solution: [
          step('Třetí strana:', 'The third side:', `${b - a} < c < ${a + b}`),
          step(
            `${askMax ? 'Největší' : 'Nejmenší'} obvod:`,
            `The ${askMax ? 'largest' : 'smallest'} perimeter:`,
            `${a} + ${b} + ${askMax ? high : low} = ${value}`,
          ),
        ],
        misconceptions: [
          mc(
            ans(askMax ? 2 * (a + b) : 2 * b),
            'concept',
            'Třetí strana se součtu (ani rozdílu) zbylých dvou nemůže rovnat.',
            'The third side cannot equal the sum (or the difference) of the other two.',
          ),
        ],
        verify: [{ kind: 'value', expr: askMax ? `${a}+${b}+${a}+${b}-1` : `${a}+${b}+${b}-${a}+1` }],
      };
    },
  }),

  gen({
    id: 'geom.angles.choice',
    concept: 'geom.angles',
    kind: 'core',
    levels: [3],
    title: L('Úhly – výběr odpovědi', 'Angles – choose the answer'),
    tags: ['mc5'],
    est: () => 120,
    make(r) {
      const exterior = r.int(101, 160);
      const base = 180 - exterior;
      const apex = 180 - 2 * base;
      const built = numericChoice(r, apex, [base, exterior, 180 - base, 2 * base, apex + 10], (v) =>
        L(`${v}°`, `${v}°`),
      );
      return {
        prompt: L(
          `V rovnoramenném trojúhelníku má vnější úhel při základně velikost $${exterior}^\\circ$. Jaká je velikost úhlu při hlavním vrcholu?`,
          `In an isosceles triangle an exterior angle at the base is $${exterior}^\\circ$. What is the angle at the apex?`,
        ),
        answer: built.spec,
        hints: [
          L(
            'Vnější a vnitřní úhel u téhož vrcholu dají dohromady $180^\\circ$.',
            'An exterior and an interior angle at the same vertex make $180^\\circ$ together.',
          ),
          L(
            `Úhel při základně je $${base}^\\circ$; takové jsou dva.`,
            `A base angle is $${base}^\\circ$; there are two of them.`,
          ),
        ],
        solution: [
          step('Úhel při základně:', 'A base angle:', `180 - ${exterior} = ${base}`),
          step('Úhel při hlavním vrcholu:', 'The angle at the apex:', `180 - 2 \\cdot ${base} = ${apex}`),
        ],
        misconceptions: [built.idOf(base)].flatMap((id) =>
          id ? [mc(id, 'incomplete', 'To je úhel při základně.', 'That is a base angle.')] : [],
        ),
      };
    },
  }),

  // ----------------------------------------------------------------------------- symmetry
  gen({
    id: 'geom.symmetry.axes',
    concept: 'geom.symmetry',
    kind: 'core',
    levels: [1, 2, 3],
    title: L('Osy souměrnosti a obraz bodu', 'Axes of symmetry and the image of a point'),
    est: (lv) => 35 + 25 * lv,
    make(r, lv) {
      if (lv === 1) {
        const shape = r.pick(SHAPES);
        return {
          prompt: L(
            `Kolik os souměrnosti má ${shape.name.cs}?`,
            `How many axes of symmetry does ${shape.name.en} have?`,
          ),
          answer: { kind: 'number', value: ans(shape.axes) },
          hints: [
            L(
              'Osa souměrnosti je přímka, podle které lze útvar přeložit tak, že se obě poloviny přesně kryjí.',
              'An axis of symmetry is a line along which the figure can be folded so that the two halves coincide exactly.',
            ),
            L(
              'Zkus osy vedoucí vrcholy a osy vedoucí středy stran.',
              'Try axes through the vertices and axes through the midpoints of the sides.',
            ),
          ],
          solution: [
            step(
              shape.axes === 0 ? 'Žádná přímka tento útvar nepřeloží sám na sebe.' : `Os je ${shape.axes}.`,
              shape.axes === 0 ? 'No line folds this figure onto itself.' : `There are ${shape.axes}.`,
            ),
          ],
          misconceptions:
            shape.axes === 2 && shape.name.en.startsWith('a rectangle')
              ? [
                  mc(
                    '4',
                    'concept',
                    'Úhlopříčky obdélníku nejsou osy souměrnosti: po přeložení se rohy nekryjí.',
                    'The diagonals of a rectangle are not axes of symmetry: the corners do not meet when folded.',
                  ),
                ]
              : shape.axes === 0
                ? [
                    mc(
                      '2',
                      'concept',
                      'Kosodélník je souměrný podle středu, ne podle žádné osy.',
                      'A rhomboid is symmetric about its centre, not about any axis.',
                    ),
                  ]
                : [],
        };
      }
      const x = r.intExcept(-6, 6, [0]);
      const y = r.intExcept(-6, 6, [0, x, -x]);
      if (lv === 2) {
        const kind = r.pick(['x', 'y', 'origin'] as const);
        const image = kind === 'x' ? [x, -y] : kind === 'y' ? [-x, y] : [-x, -y];
        const what =
          kind === 'x'
            ? L('v osové souměrnosti podle osy $x$', 'in the reflection in the $x$-axis')
            : kind === 'y'
              ? L('v osové souměrnosti podle osy $y$', 'in the reflection in the $y$-axis')
              : L('ve středové souměrnosti podle počátku', 'in the point reflection in the origin');
        return {
          prompt: L(
            `Určete souřadnice obrazu bodu $A[${x}; ${y}]$ ${what.cs}.`,
            `Find the coordinates of the image of the point $A(${x}, ${y})$ ${what.en}.`,
          ),
          answer: { kind: 'point', coords: [`${image[0]}`, `${image[1]}`], label: "A' =" },
          hints: [
            kind === 'origin'
              ? L(
                  'Středová souměrnost podle počátku mění znaménko obou souřadnic.',
                  'A point reflection in the origin changes the sign of both coordinates.',
                )
              : L(
                  'Obraz leží na druhé straně osy ve stejné vzdálenosti. Která souřadnice se nemění?',
                  'The image lies on the other side of the axis at the same distance. Which coordinate does not change?',
                ),
            kind === 'x'
              ? L('Podle osy $x$ se mění znaménko souřadnice $y$.', 'In the $x$-axis the sign of $y$ changes.')
              : kind === 'y'
                ? L('Podle osy $y$ se mění znaménko souřadnice $x$.', 'In the $y$-axis the sign of $x$ changes.')
                : L(`$[${x}; ${y}] \\to [${-x}; ${-y}]$`, `$(${x}, ${y}) \\to (${-x}, ${-y})$`),
          ],
          solution: [step('Obraz:', 'The image:', L(`A'[${image[0]}; ${image[1]}]`, `A'(${image[0]}, ${image[1]})`))],
          misconceptions:
            kind === 'origin'
              ? []
              : [
                  mc(
                    `[${kind === 'x' ? -x : x}; ${kind === 'x' ? y : -y}]`,
                    'misread',
                    'Zaměnil jsi osy: podle osy $x$ se mění $y$ a naopak.',
                    'The axes are swapped: in the $x$-axis $y$ changes, and the other way round.',
                  ),
                ],
          verify: [
            {
              kind: 'solves',
              exprs:
                kind === 'x'
                  ? [`x-(${x})`, `y+(${y})`]
                  : kind === 'y'
                    ? [`x+(${x})`, `y-(${y})`]
                    : [`x+(${x})`, `y+(${y})`],
            },
          ],
        };
      }
      const k = r.intExcept(-4, 5, [0, x]);
      const m = r.intExcept(-4, 5, [0, y]);
      const kind = r.pick(['vertical', 'horizontal', 'point'] as const);
      const image =
        kind === 'vertical' ? [2 * k - x, y] : kind === 'horizontal' ? [x, 2 * m - y] : [2 * k - x, 2 * m - y];
      const what =
        kind === 'vertical'
          ? L(`v osové souměrnosti podle přímky $x = ${k}$`, `in the reflection in the line $x = ${k}$`)
          : kind === 'horizontal'
            ? L(`v osové souměrnosti podle přímky $y = ${m}$`, `in the reflection in the line $y = ${m}$`)
            : L(`ve středové souměrnosti podle bodu $S[${k}; ${m}]$`, `in the point reflection in $S(${k}, ${m})$`);
      return {
        prompt: L(
          `Určete souřadnice obrazu bodu $A[${x}; ${y}]$ ${what.cs}.`,
          `Find the coordinates of the image of the point $A(${x}, ${y})$ ${what.en}.`,
        ),
        answer: { kind: 'point', coords: [`${image[0]}`, `${image[1]}`], label: "A' =" },
        hints: [
          L(
            'Obraz je od osy (středu) stejně daleko jako vzor, jen na druhé straně.',
            'The image is as far from the axis (centre) as the original, on the other side.',
          ),
          kind === 'horizontal'
            ? L(
                `Bod je od přímky $y = ${m}$ vzdálen $${Math.abs(y - m)}$; souřadnice $x$ se nemění.`,
                `The point is $${Math.abs(y - m)}$ away from the line $y = ${m}$; $x$ does not change.`,
              )
            : L(
                `Ve směru osy $x$ je bod od ${kind === 'vertical' ? 'přímky' : 'středu'} vzdálen $${Math.abs(x - k)}$.`,
                `Along the $x$-axis the point is $${Math.abs(x - k)}$ away from the ${kind === 'vertical' ? 'line' : 'centre'}.`,
              ),
        ],
        solution: [
          step(
            kind === 'point' ? 'Střed S je středem úsečky AA′:' : 'Osa půlí úsečku AA′:',
            kind === 'point' ? 'S is the midpoint of AA′:' : 'The axis bisects AA′:',
            L(`A'[${image[0]}; ${image[1]}]`, `A'(${image[0]}, ${image[1]})`),
          ),
        ],
        misconceptions: [],
        verify: [{ kind: 'solves', exprs: [`x-(${image[0]})`, `y-(${image[1]})`] }],
      };
    },
  }),

  gen({
    id: 'geom.symmetry.statements',
    concept: 'geom.symmetry',
    kind: 'core',
    levels: [2, 3],
    title: L('Tvrzení o souměrnosti', 'Statements about symmetry'),
    tags: ['tf'],
    est: (lv) => 35 + 15 * lv,
    make(r, lv) {
      if (lv === 2) {
        const shape = r.pick(SHAPES);
        const truth = r.bool();
        const aboutCentre = r.bool();
        if (aboutCentre) {
          const claim = truth === shape.central;
          return {
            prompt: L(
              `Rozhodněte, zda platí: ${subject(shape.name.cs)} ${claim ? 'je' : 'není'} středově souměrný útvar.`,
              `Decide whether this is true: ${subject(shape.name.en)} ${claim ? 'is' : 'is not'} symmetric about a point.`,
            ),
            answer: trueFalse(truth),
            hints: [
              L(
                'Středově souměrný útvar se po otočení o $180^\\circ$ kolem svého středu kryje sám se sebou.',
                'A figure symmetric about a point coincides with itself after a half-turn about its centre.',
              ),
              L('Představ si útvar otočený vzhůru nohama.', 'Picture the figure turned upside down.'),
            ],
            solution: [
              step(
                shape.central
                  ? 'Po otočení o 180° se útvar kryje sám se sebou: je středově souměrný.'
                  : 'Po otočení o 180° se útvar sám se sebou nekryje: středově souměrný není.',
                shape.central
                  ? 'After a half-turn the figure coincides with itself: it is symmetric about a point.'
                  : 'After a half-turn the figure does not coincide with itself: it is not symmetric about a point.',
              ),
            ],
          };
        }
        const claimed = truth ? shape.axes : shape.axes + r.pick(shape.axes >= 2 ? [-1, 1, 2] : [1, 2]);
        return {
          prompt: L(
            claimed === 0
              ? `Rozhodněte, zda platí: ${subject(shape.name.cs)} nemá žádnou osu souměrnosti.`
              : `Rozhodněte, zda platí: ${subject(shape.name.cs)} má právě ${claimed} ${plural(claimed, 'osu', 'osy', 'os')} souměrnosti.`,
            claimed === 0
              ? `Decide whether this is true: ${subject(shape.name.en)} has no axis of symmetry.`
              : `Decide whether this is true: ${subject(shape.name.en)} has exactly ${claimed} ${claimed === 1 ? 'axis' : 'axes'} of symmetry.`,
          ),
          answer: trueFalse(truth),
          hints: [
            L(
              'Hledej přímky, podle kterých lze útvar přeložit sám na sebe.',
              'Look for the lines along which the figure folds onto itself.',
            ),
            L(
              'Zkus osy vedoucí vrcholy a osy vedoucí středy stran.',
              'Try axes through the vertices and axes through the midpoints of the sides.',
            ),
          ],
          solution: [
            step(`Počet os souměrnosti je ${shape.axes}.`, `The number of axes of symmetry is ${shape.axes}.`),
          ],
        };
      }
      const x = r.intExcept(-6, 6, [0]);
      const y = r.intExcept(-6, 6, [0, x, -x]);
      const kind = r.pick(['x', 'y', 'origin'] as const);
      const image = kind === 'x' ? [x, -y] : kind === 'y' ? [-x, y] : [-x, -y];
      const truth = r.bool();
      const wrong = kind === 'x' ? [-x, y] : kind === 'y' ? [x, -y] : [y, x];
      const shown = truth ? image : wrong;
      const what =
        kind === 'x'
          ? L('podle osy $x$', 'in the $x$-axis')
          : kind === 'y'
            ? L('podle osy $y$', 'in the $y$-axis')
            : L('podle počátku soustavy souřadnic', 'in the origin');
      return {
        prompt: L(
          `Rozhodněte, zda platí: Obrazem bodu $[${x}; ${y}]$ v souměrnosti ${what.cs} je bod $[${shown[0]}; ${shown[1]}]$.`,
          `Decide whether this is true: The image of the point $(${x}, ${y})$ in the reflection ${what.en} is the point $(${shown[0]}, ${shown[1]})$.`,
        ),
        answer: trueFalse(truth),
        hints: [
          L(
            'Která souřadnice se při této souměrnosti mění a která zůstává?',
            'Which coordinate changes in this symmetry and which stays?',
          ),
          kind === 'x'
            ? L('Podle osy $x$ se mění znaménko $y$.', 'In the $x$-axis the sign of $y$ changes.')
            : kind === 'y'
              ? L('Podle osy $y$ se mění znaménko $x$.', 'In the $y$-axis the sign of $x$ changes.')
              : L('Podle počátku se mění znaménko obou souřadnic.', 'In the origin both signs change.'),
        ],
        solution: [
          step('Správný obraz:', 'The correct image:', L(`[${image[0]}; ${image[1]}]`, `(${image[0]}, ${image[1]})`)),
        ],
      };
    },
  }),

  // --------------------------------------------------------------------------- Pythagoras
  gen({
    id: 'geom.pythagoras.side',
    concept: 'geom.pythagoras',
    kind: 'core',
    levels: [1, 2, 3],
    title: L('Strana pravoúhlého trojúhelníku', 'A side of a right triangle'),
    est: (lv) => 45 + 30 * lv,
    make(r, lv) {
      const [p, q, h] = r.pick(TRIPLES);
      // Keep the numbers small enough to square in the head or on paper.
      const k = r.pick([1, 2, 3].filter((m) => h * m <= 39));
      const a = p * k;
      const b = q * k;
      const c = h * k;
      if (lv === 1) {
        return {
          prompt: L(
            `Odvěsny pravoúhlého trojúhelníku měří ${a} cm a ${b} cm. Kolik centimetrů měří přepona?`,
            `The legs of a right triangle are ${a} cm and ${b} cm. How many centimetres is the hypotenuse?`,
          ),
          answer: { kind: 'number', value: ans(c) },
          hints: [
            L('$c^2 = a^2 + b^2$', '$c^2 = a^2 + b^2$'),
            L(`$${a}^2 + ${b}^2 = ${a * a + b * b}$`, `$${a}^2 + ${b}^2 = ${a * a + b * b}$`),
          ],
          solution: [
            step(
              'Pythagorova věta:',
              'The Pythagorean theorem:',
              `c^2 = ${a}^2 + ${b}^2 = ${a * a} + ${b * b} = ${c * c}`,
            ),
            step('Odmocnina:', 'The root:', `c = \\sqrt{${c * c}} = ${c}`),
          ],
          misconceptions: [
            mc(
              ans(a + b),
              'formula',
              'Sčítají se druhé mocniny stran, ne strany samy.',
              'The squares of the sides are added, not the sides themselves.',
            ),
          ],
          verify: [{ kind: 'value', expr: `sqrt(${a}^2+${b}^2)` }],
        };
      }
      if (lv === 2) {
        return {
          prompt: L(
            `Přepona pravoúhlého trojúhelníku měří ${c} cm a jedna odvěsna ${a} cm. Kolik centimetrů měří druhá odvěsna?`,
            `The hypotenuse of a right triangle is ${c} cm and one leg is ${a} cm. How many centimetres is the other leg?`,
          ),
          answer: { kind: 'number', value: ans(b) },
          hints: [
            L('Odvěsna se počítá odčítáním: $b^2 = c^2 - a^2$.', 'A leg is found by subtracting: $b^2 = c^2 - a^2$.'),
            L(`$${c}^2 - ${a}^2 = ${c * c - a * a}$`, `$${c}^2 - ${a}^2 = ${c * c - a * a}$`),
          ],
          solution: [
            step(
              'Pythagorova věta pro odvěsnu:',
              'The theorem for a leg:',
              `b^2 = ${c}^2 - ${a}^2 = ${c * c} - ${a * a} = ${b * b}`,
            ),
            step('Odmocnina:', 'The root:', `b = ${b}`),
          ],
          misconceptions: [
            mc(
              ans(c - a),
              'formula',
              'Odčítají se druhé mocniny, ne strany samy.',
              'The squares are subtracted, not the sides themselves.',
            ),
          ],
          verify: [{ kind: 'value', expr: `sqrt(${c}^2-${a}^2)` }],
        };
      }
      // An isosceles triangle with base 2a and arms c: its height is b.
      const area = a * b;
      return {
        prompt: L(
          `Rovnoramenný trojúhelník má základnu dlouhou ${2 * a} cm a ramena dlouhá ${c} cm. Jaký je jeho obsah v cm²?`,
          `An isosceles triangle has a base of ${2 * a} cm and arms of ${c} cm. What is its area in cm²?`,
        ),
        answer: { kind: 'number', value: ans(area) },
        hints: [
          L(
            'Výška na základnu ji půlí a rozdělí trojúhelník na dva pravoúhlé.',
            'The altitude to the base bisects it and splits the triangle into two right triangles.',
          ),
          L(
            `Výška: $v^2 = ${c}^2 - ${a}^2$, tedy $v = ${b}$ cm.`,
            `The altitude: $h^2 = ${c}^2 - ${a}^2$, so $h = ${b}$ cm.`,
          ),
        ],
        solution: [
          step('Polovina základny a výška:', 'Half the base and the altitude:', `v = \\sqrt{${c}^2 - ${a}^2} = ${b}`),
          step('Obsah:', 'The area:', `\\frac{${2 * a} \\cdot ${b}}{2} = ${area}`),
        ],
        misconceptions: [
          mc(
            ans(a * c),
            'concept',
            'Rameno není výška. Výšku je třeba dopočítat Pythagorovou větou.',
            'An arm is not the altitude. The altitude has to be found with the Pythagorean theorem.',
          ),
        ],
        verify: [{ kind: 'value', expr: `${2 * a}*sqrt(${c}^2-${a}^2)/2` }],
      };
    },
  }),

  gen({
    id: 'geom.pythagoras.applied',
    concept: 'geom.pythagoras',
    kind: 'hard',
    levels: [3, 4],
    title: L('Pythagorova věta v úlohách', 'The Pythagorean theorem applied'),
    est: (lv) => 70 + 35 * lv,
    make(r, lv) {
      if (lv === 3) {
        const [p, q, h] = r.pick(TRIPLES);
        const c = r.int(3, 10);
        const a = c + p;
        const perimeter = a + c + q + h;
        return {
          prompt: L(
            `Pravoúhlý lichoběžník má základny dlouhé ${a} cm a ${c} cm a výšku ${q} cm. Jaký je jeho obvod v cm?`,
            `A right trapezoid has bases of ${a} cm and ${c} cm and a height of ${q} cm. What is its perimeter in cm?`,
          ),
          answer: { kind: 'number', value: ans(perimeter) },
          hints: [
            L(
              'Chybí šikmé rameno. Spusť z konce kratší základny výšku: vznikne pravoúhlý trojúhelník.',
              'The slanted side is missing. Drop the altitude from the end of the shorter base: a right triangle appears.',
            ),
            L(
              `Jeho odvěsny jsou $${a} - ${c} = ${p}$ cm a ${q} cm.`,
              `Its legs are $${a} - ${c} = ${p}$ cm and ${q} cm.`,
            ),
          ],
          solution: [
            step(
              'Odvěsny pomocného trojúhelníku:',
              'The legs of the auxiliary triangle:',
              `${a} - ${c} = ${p}, \\quad ${q}`,
            ),
            step('Šikmé rameno:', 'The slanted side:', `\\sqrt{${p}^2 + ${q}^2} = ${h}`),
            step('Obvod:', 'The perimeter:', `${a} + ${c} + ${q} + ${h} = ${perimeter}`),
          ],
          misconceptions: [
            mc(
              ans(a + c + 2 * q),
              'concept',
              'Šikmé rameno je delší než výška; je to přepona pomocného trojúhelníku.',
              'The slanted side is longer than the height; it is the hypotenuse of the auxiliary triangle.',
            ),
          ],
          verify: [{ kind: 'value', expr: `${a}+${c}+${q}+sqrt((${a}-${c})^2+${q}^2)` }],
        };
      }
      const [length, foot1, top1, foot2, top2] = r.pick([
        [25, 7, 24, 15, 20],
        [50, 14, 48, 30, 40],
        [65, 16, 63, 25, 60],
        [65, 25, 60, 39, 52],
        [65, 33, 56, 39, 52],
        [65, 16, 63, 39, 52],
      ] as const);
      return {
        prompt: L(
          `Žebřík dlouhý ${length} dm je opřen o svislou zeď a jeho pata je ${foot1} dm od zdi. O kolik decimetrů klesne horní konec žebříku, když patu odsuneme do vzdálenosti ${foot2} dm od zdi?`,
          `A ladder ${length} dm long leans against a vertical wall with its foot ${foot1} dm from the wall. By how many decimetres does the top of the ladder drop when the foot is moved to ${foot2} dm from the wall?`,
        ),
        answer: { kind: 'number', value: ans(top1 - top2) },
        hints: [
          L(
            'Žebřík, zeď a zem tvoří pravoúhlý trojúhelník s přeponou rovnou délce žebříku. Spočítej výšku horního konce před a po.',
            'Ladder, wall and ground form a right triangle whose hypotenuse is the ladder. Work out the height of the top before and after.',
          ),
          L(
            `Před: $\\sqrt{${length}^2 - ${foot1}^2} = ${top1}$ dm.`,
            `Before: $\\sqrt{${length}^2 - ${foot1}^2} = ${top1}$ dm.`,
          ),
        ],
        solution: [
          step('Výška před:', 'The height before:', `\\sqrt{${length}^2 - ${foot1}^2} = ${top1}`),
          step('Výška po:', 'The height after:', `\\sqrt{${length}^2 - ${foot2}^2} = ${top2}`),
          step('Pokles:', 'The drop:', `${top1} - ${top2} = ${top1 - top2}`),
        ],
        misconceptions: [
          mc(
            ans(foot2 - foot1),
            'concept',
            'Horní konec neklesne o tolik, o kolik se posune pata.',
            'The top does not drop by as much as the foot moves.',
          ),
        ],
        verify: [{ kind: 'value', expr: `sqrt(${length}^2-${foot1}^2)-sqrt(${length}^2-${foot2}^2)` }],
        context: { applied: true },
      };
    },
  }),

  gen({
    id: 'geom.pythagoras.choice',
    concept: 'geom.pythagoras',
    kind: 'core',
    levels: [3],
    title: L('Pythagorova věta – výběr odpovědi', 'The Pythagorean theorem – choose the answer'),
    tags: ['mc5'],
    est: () => 130,
    make(r) {
      const [p, q, h] = r.pick(TRIPLES);
      const k = r.pick([1, 2]);
      const e = 2 * p * k;
      const f = 2 * q * k;
      const side = h * k;
      const built = numericChoice(r, 4 * side, [e + f, 2 * (e + f), side, 4 * (p + q) * k, (e * f) / 2], (v) =>
        L(`${v} cm`, `${v} cm`),
      );
      return {
        prompt: L(
          `Kosočtverec má úhlopříčky dlouhé ${e} cm a ${f} cm. Jaký je jeho obvod?`,
          `A rhombus has diagonals of ${e} cm and ${f} cm. What is its perimeter?`,
        ),
        answer: built.spec,
        hints: [
          L(
            'Úhlopříčky kosočtverce se půlí a jsou na sebe kolmé: rozdělí ho na čtyři shodné pravoúhlé trojúhelníky.',
            'The diagonals of a rhombus bisect each other at right angles: they split it into four congruent right triangles.',
          ),
          L(
            `Odvěsny jednoho trojúhelníku jsou ${e / 2} cm a ${f / 2} cm, přepona je strana kosočtverce.`,
            `The legs of one triangle are ${e / 2} cm and ${f / 2} cm; the hypotenuse is the side of the rhombus.`,
          ),
        ],
        solution: [
          step('Strana:', 'The side:', `\\sqrt{${e / 2}^2 + ${f / 2}^2} = ${side}`),
          step('Obvod:', 'The perimeter:', `4 \\cdot ${side} = ${4 * side}`),
        ],
        misconceptions: [built.idOf(side), built.idOf(2 * (e + f))].flatMap((id, index) =>
          id
            ? [
                index === 0
                  ? mc(
                      id,
                      'incomplete',
                      'To je jedna strana. Obvod jsou čtyři.',
                      'That is one side. The perimeter is four.',
                    )
                  : mc(
                      id,
                      'concept',
                      'Úhlopříčky nejsou strany kosočtverce.',
                      'The diagonals are not the sides of the rhombus.',
                    ),
              ]
            : [],
        ),
      };
    },
  }),

  // ------------------------------------------------------------------------------- circle
  gen({
    id: 'geom.circle.basic',
    concept: 'geom.circle',
    kind: 'core',
    levels: [1, 2, 3],
    title: L('Obvod a obsah kruhu', 'Circumference and area of a circle'),
    est: (lv) => 40 + 25 * lv,
    make(r, lv) {
      if (lv === 1) {
        const radius = r.pick([5, 10, 15, 20, 25, 50]);
        const useDiameter = r.bool();
        const value = round2(2 * PI * radius);
        return {
          prompt: L(
            `Kruh má ${useDiameter ? `průměr ${2 * radius}` : `poloměr ${radius}`} cm. Jaký je jeho obvod v cm? ${piNote.cs}`,
            `A circle has a ${useDiameter ? `diameter of ${2 * radius}` : `radius of ${radius}`} cm. What is its circumference in cm? ${piNote.en}`,
          ),
          answer: { kind: 'number', value: ans(value), tol: 0.01 },
          hints: [
            L('$o = 2\\pi r = \\pi d$', '$C = 2\\pi r = \\pi d$'),
            both((n) => `$${n(PI)} \\cdot ${2 * radius}$`),
          ],
          solution: [
            step(
              'Obvod:',
              'The circumference:',
              both((n) => `\\pi d \\doteq ${n(PI)} \\cdot ${2 * radius} = ${n(value)}`),
            ),
          ],
          misconceptions: [
            mc(
              ans(round2(useDiameter ? 2 * PI * 2 * radius : PI * radius)),
              'formula',
              useDiameter ? 'Zadán je průměr: $o = \\pi d$, ne $2\\pi d$.' : 'Zadán je poloměr: $o = 2\\pi r$.',
              useDiameter
                ? 'The diameter is given: $C = \\pi d$, not $2\\pi d$.'
                : 'The radius is given: $C = 2\\pi r$.',
            ),
          ],
          verify: [{ kind: 'value', expr: `2*3.14*${radius}` }],
        };
      }
      if (lv === 2) {
        const radius = r.pick([2, 3, 4, 5, 10, 20]);
        const value = round2(PI * radius * radius);
        return {
          prompt: L(
            `Kruh má poloměr ${radius} cm. Jaký je jeho obsah v cm²? ${piNote.cs}`,
            `A circle has a radius of ${radius} cm. What is its area in cm²? ${piNote.en}`,
          ),
          answer: { kind: 'number', value: ans(value), tol: 0.01 },
          hints: [L('$S = \\pi r^2$', '$A = \\pi r^2$'), both((n) => `$${n(PI)} \\cdot ${radius * radius}$`)],
          solution: [
            step(
              'Obsah:',
              'The area:',
              both((n) => `\\pi r^2 \\doteq ${n(PI)} \\cdot ${radius}^2 = ${n(value)}`),
            ),
          ],
          misconceptions: [
            mc(
              ans(round2(2 * PI * radius)),
              'formula',
              'To je obvod. Obsah je $\\pi r^2$.',
              'That is the circumference. The area is $\\pi r^2$.',
            ),
          ],
          verify: [{ kind: 'value', expr: `3.14*${radius}^2` }],
        };
      }
      const radius = r.pick([5, 10, 15, 20]);
      const circumference = round2(2 * PI * radius);
      const value = round2(PI * radius * radius);
      return {
        prompt: both((n, czech) =>
          czech
            ? `Kruh má obvod $${n(circumference)}$ cm. Jaký je jeho obsah v cm²? ${piNote.cs}`
            : `A circle has a circumference of $${n(circumference)}$ cm. What is its area in cm²? ${piNote.en}`,
        ),
        answer: { kind: 'number', value: ans(value), tol: 0.01 },
        hints: [
          L(
            'Z obvodu zjisti poloměr: $r = \\frac{o}{2\\pi}$.',
            'Find the radius from the circumference: $r = \\frac{C}{2\\pi}$.',
          ),
          L(`Poloměr je ${radius} cm.`, `The radius is ${radius} cm.`),
        ],
        solution: [
          step(
            'Poloměr:',
            'The radius:',
            both((n, czech) => `${n(circumference)} ${czech ? ':' : '\\div'} (2 \\cdot ${n(PI)}) = ${radius}`),
          ),
          step(
            'Obsah:',
            'The area:',
            both((n) => `${n(PI)} \\cdot ${radius}^2 = ${n(value)}`),
          ),
        ],
        misconceptions: [],
        verify: [{ kind: 'value', expr: `3.14*(${circumference}/(2*3.14))^2` }],
      };
    },
  }),

  gen({
    id: 'geom.circle.composite',
    concept: 'geom.circle',
    kind: 'hard',
    levels: [3, 4],
    title: L('Útvary složené z kruhů', 'Figures made with circles'),
    est: (lv) => 70 + 35 * lv,
    make(r, lv) {
      if (lv === 3) {
        const a = 2 * r.pick([2, 3, 4, 5, 10]);
        const value = round2(a * a - PI * (a / 2) * (a / 2));
        return {
          prompt: L(
            `Do čtverce o straně ${a} cm je vepsán kruh. Jaký obsah v cm² má část čtverce, která leží mimo kruh? ${piNote.cs}`,
            `A circle is inscribed in a square of side ${a} cm. What is the area, in cm², of the part of the square outside the circle? ${piNote.en}`,
          ),
          answer: { kind: 'number', value: ans(value), tol: 0.01 },
          hints: [
            L(
              'Vepsaný kruh se dotýká všech stran čtverce: jeho průměr je roven straně čtverce.',
              'The inscribed circle touches every side of the square: its diameter equals the side.',
            ),
            L(`Poloměr kruhu je ${a / 2} cm.`, `The radius of the circle is ${a / 2} cm.`),
          ],
          solution: [
            step(
              'Čtverec a kruh:',
              'The square and the circle:',
              both((n) => `${a}^2 = ${a * a}, \\quad ${n(PI)} \\cdot ${a / 2}^2 = ${n(round2(PI * (a / 2) ** 2))}`),
            ),
            step(
              'Rozdíl:',
              'The difference:',
              both((n) => `${a * a} - ${n(round2(PI * (a / 2) ** 2))} = ${n(value)}`),
            ),
          ],
          misconceptions: [
            mc(
              ans(round2(a * a - PI * a * a)),
              'misread',
              'Strana čtverce je průměr kruhu, ne poloměr.',
              'The side of the square is the diameter of the circle, not the radius.',
            ),
          ],
          verify: [{ kind: 'value', expr: `${a}^2-3.14*(${a}/2)^2` }],
        };
      }
      const w = 2 * r.pick([5, 10, 15, 20]);
      const length = r.pick([30, 40, 50, 60, 80].filter((v) => v >= w + 20));
      const askPerimeter = r.bool();
      const value = askPerimeter ? round2(2 * length + PI * w) : round2(length * w + PI * (w / 2) ** 2);
      return {
        prompt: L(
          `Hřiště má tvar obdélníku ${length} m × ${w} m, ke kterému jsou ke kratším stranám přidány dva půlkruhy. ${askPerimeter ? 'Kolik metrů měří obvod hřiště?' : 'Jaký je obsah hřiště v m²?'} ${piNote.cs}`,
          `A pitch has the shape of a ${length} m × ${w} m rectangle with a semicircle added to each of its shorter sides. ${askPerimeter ? 'How many metres is its perimeter?' : 'What is its area in m²?'} ${piNote.en}`,
        ),
        answer: { kind: 'number', value: ans(value), tol: 0.01 },
        hints: [
          L(
            `Dva půlkruhy dají dohromady celý kruh o průměru ${w} m.`,
            `The two semicircles make one whole circle of diameter ${w} m.`,
          ),
          askPerimeter
            ? L(
                'Obvod tvoří dvě delší strany obdélníku a obvod toho kruhu. Kratší strany jsou uvnitř.',
                'The perimeter is the two longer sides of the rectangle and the circumference of that circle. The shorter sides are inside.',
              )
            : L('Obsah je obdélník plus ten kruh.', 'The area is the rectangle plus that circle.'),
        ],
        solution: askPerimeter
          ? [
              step(
                'Dvě rovné strany a kruh:',
                'Two straight sides and the circle:',
                both((n) => `2 \\cdot ${length} + ${n(PI)} \\cdot ${w} = ${n(value)}`),
              ),
            ]
          : [
              step(
                'Obdélník a kruh:',
                'The rectangle and the circle:',
                both((n) => `${length} \\cdot ${w} + ${n(PI)} \\cdot ${w / 2}^2 = ${n(value)}`),
              ),
            ],
        misconceptions: askPerimeter
          ? [
              mc(
                ans(round2(2 * length + 2 * w + PI * w)),
                'concept',
                'Kratší strany obdélníku leží uvnitř hřiště, do obvodu nepatří.',
                'The shorter sides of the rectangle lie inside the pitch; they are not part of the perimeter.',
              ),
            ]
          : [],
        verify: [{ kind: 'value', expr: askPerimeter ? `2*${length}+3.14*${w}` : `${length}*${w}+3.14*(${w}/2)^2` }],
        context: { applied: true },
      };
    },
  }),

  // ------------------------------------------------------------------------------- solids
  gen({
    id: 'solid.views.plan',
    concept: 'solid.views',
    kind: 'core',
    levels: [1, 2, 3],
    title: L('Stavby z krychliček', 'Cube buildings'),
    est: (lv) => 45 + 35 * lv,
    make(r, lv) {
      const { heights, tex, total, top } = plan(r);
      const intro = planIntro(tex);
      if (lv === 1) {
        return {
          prompt: L(
            `${intro.cs} Z kolika krychliček je stavba postavena?`,
            `${intro.en} How many cubes is the building made of?`,
          ),
          answer: { kind: 'number', value: ans(total) },
          hints: [
            L(
              'Číslo v poli je počet krychliček ve sloupci. Sečti všechna pole.',
              'The number in a field is the number of cubes in that column. Add up all the fields.',
            ),
            L('Sčítej po řádcích.', 'Add row by row.'),
          ],
          solution: [
            step(
              'Součet po řádcích:',
              'The sum, row by row:',
              `${heights.map((row) => row.reduce((a, b) => a + b, 0)).join(' + ')} = ${total}`,
            ),
          ],
          misconceptions: [
            mc(
              ans(heights.flat().filter((v) => v > 0).length),
              'misread',
              'To je počet obsazených polí. Na některých polích stojí víc krychliček na sobě.',
              'That is the number of occupied fields. Some fields carry several cubes.',
            ),
          ],
        };
      }
      if (lv === 2) {
        const need = 9 * top - total;
        return {
          prompt: L(
            `${intro.cs} Kolik krychliček je třeba přidat, aby ze stavby vznikl kvádr se čtvercovou podstavou 3 × 3 a s výškou ${top} ${plural(top, 'krychlička', 'krychličky', 'krychliček')}?`,
            `${intro.en} How many cubes must be added to turn the building into a cuboid with the 3 × 3 square base and a height of ${top} cubes?`,
          ),
          answer: { kind: 'number', value: ans(need) },
          hints: [
            L(
              'Kolik krychliček má hotový kvádr? A kolik jich už ve stavbě je?',
              'How many cubes does the finished cuboid have? And how many are already in the building?',
            ),
            L(
              `Kvádr: $3 \\cdot 3 \\cdot ${top} = ${9 * top}$ krychliček.`,
              `The cuboid: $3 \\cdot 3 \\cdot ${top} = ${9 * top}$ cubes.`,
            ),
          ],
          solution: [
            step('Kvádr:', 'The cuboid:', `3 \\cdot 3 \\cdot ${top} = ${9 * top}`),
            step('Stavba už má:', 'The building already has:', `${total}`),
            step('Chybí:', 'Missing:', `${9 * top} - ${total} = ${need}`),
          ],
          misconceptions: [
            mc(
              ans(9 * top),
              'incomplete',
              'Tolik krychliček má celý kvádr. Část už ve stavbě je.',
              'That is the whole cuboid. Part of it is already there.',
            ),
          ],
        };
      }
      const faces = surfaceOf(heights);
      return {
        prompt: L(
          `${intro.cs} Stavbu zvedneme a natřeme celou zvenku, i zespodu. Kolik čtverečků (stěn krychliček) natřeme?`,
          `${intro.en} We lift the building and paint all of its outside, the underside too. How many little squares (faces of the cubes) do we paint?`,
        ),
        answer: { kind: 'number', value: ans(faces) },
        hints: [
          L(
            'Počítej po směrech: shora, zespodu a ze čtyř stran. Shora a zespodu je vidět jeden čtvereček za každé obsazené pole.',
            'Count by direction: from above, from below and from the four sides. Above and below show one square per occupied field.',
          ),
          L(
            'U bočních stěn porovnávej sousední sloupce: natřená je jen ta část, o kterou vyšší sloupec vyčnívá.',
            'For the side faces compare neighbouring columns: only the part by which the taller column sticks out is painted.',
          ),
        ],
        solution: [
          step(
            `Shora a zespodu: $2 \\cdot ${heights.flat().filter((v) => v > 0).length}$ čtverečků.`,
            `From above and below: $2 \\cdot ${heights.flat().filter((v) => v > 0).length}$ squares.`,
          ),
          step(
            `Boční stěny: ${faces - 2 * heights.flat().filter((v) => v > 0).length} čtverečků.`,
            `The side faces: ${faces - 2 * heights.flat().filter((v) => v > 0).length} squares.`,
          ),
          step('Dohromady:', 'Together:', `${faces}`),
        ],
        misconceptions: [
          mc(
            ans(6 * total),
            'concept',
            'Stěny, kterými se krychličky dotýkají, se nenatírají.',
            'Faces where two cubes touch are not painted.',
          ),
        ],
      };
    },
  }),

  gen({
    id: 'solid.views.painted',
    concept: 'solid.views',
    kind: 'core',
    levels: [2, 3],
    title: L('Natřená krychle', 'A painted cube'),
    tags: ['mc5'],
    est: (lv) => 60 + 30 * lv,
    make(r, lv) {
      const n = lv === 2 ? 3 : r.pick([4, 5]);
      const counts = { 3: 8, 2: 12 * (n - 2), 1: 6 * (n - 2) ** 2, 0: (n - 2) ** 3 };
      const k = r.pick(lv === 2 ? ([0, 1, 2, 3] as const) : ([0, 1, 2] as const));
      const value = counts[k];
      const built = numericChoice(r, value, [counts[0], counts[1], counts[2], counts[3], n * n * n, 6 * n * n], (v) =>
        L(`${v}`, `${v}`),
      );
      const which =
        k === 0
          ? L('nemá natřenou žádnou stěnu', 'have no painted face')
          : k === 1
            ? L('má natřenou právě jednu stěnu', 'have exactly one painted face')
            : k === 2
              ? L('má natřené právě dvě stěny', 'have exactly two painted faces')
              : L('má natřené právě tři stěny', 'have exactly three painted faces');
      return {
        prompt: L(
          `Krychli slepenou z $${n} \\times ${n} \\times ${n}$ stejných krychliček natřeme celou zvenku a pak ji znovu rozebereme. Kolik krychliček ${which.cs}?`,
          `A cube glued from $${n} \\times ${n} \\times ${n}$ equal little cubes is painted all over on the outside and then taken apart again. How many little cubes ${which.en}?`,
        ),
        answer: built.spec,
        hints: [
          L(
            'Tři natřené stěny mají krychličky v rozích, dvě ty na hranách (bez rohů), jednu ty uprostřed stěn a žádnou ty uvnitř.',
            'Three painted faces: the corner cubes; two: those on the edges (without corners); one: those inside the faces; none: those in the interior.',
          ),
          k === 0
            ? L(
                `Uvnitř je krychle $${n - 2} \\times ${n - 2} \\times ${n - 2}$.`,
                `Inside there is a $${n - 2} \\times ${n - 2} \\times ${n - 2}$ cube.`,
              )
            : k === 1
              ? L(
                  `Na každé ze 6 stěn je uprostřed čtverec $${n - 2} \\times ${n - 2}$.`,
                  `Each of the 6 faces has a $${n - 2} \\times ${n - 2}$ square in the middle.`,
                )
              : k === 2
                ? L(
                    `Na každé z 12 hran je mezi rohy ${n - 2} ${plural(n - 2, 'krychlička', 'krychličky', 'krychliček')}.`,
                    `Each of the 12 edges has ${n - 2} cube${n - 2 === 1 ? '' : 's'} between its corners.`,
                  )
                : L('Krychle má 8 rohů.', 'A cube has 8 corners.'),
        ],
        solution: [
          step(
            k === 0 ? 'Vnitřní krychle:' : k === 1 ? 'Středy stěn:' : k === 2 ? 'Hrany bez rohů:' : 'Rohy:',
            k === 0
              ? 'The inner cube:'
              : k === 1
                ? 'The middles of the faces:'
                : k === 2
                  ? 'The edges without corners:'
                  : 'The corners:',
            k === 0
              ? `${n - 2}^3 = ${value}`
              : k === 1
                ? `6 \\cdot ${n - 2}^2 = ${value}`
                : k === 2
                  ? `12 \\cdot ${n - 2} = ${value}`
                  : '8',
          ),
        ],
      };
    },
  }),

  gen({
    id: 'solid.cuboid.volume-surface',
    concept: 'solid.cuboid',
    kind: 'core',
    levels: [1, 2, 3],
    title: L('Objem a povrch kvádru a krychle', 'Volume and surface of a cuboid and a cube'),
    est: (lv) => 40 + 30 * lv,
    make(r, lv) {
      const a = r.int(3, 9);
      const b = r.int(2, 8);
      const c = r.int(2, 7);
      if (lv === 1) {
        return {
          prompt: L(
            `Kvádr má rozměry ${a} cm, ${b} cm a ${c} cm. Jaký je jeho objem v cm³?`,
            `A cuboid measures ${a} cm, ${b} cm and ${c} cm. What is its volume in cm³?`,
          ),
          answer: { kind: 'number', value: ans(a * b * c) },
          hints: [
            L(
              'Objem kvádru je součin jeho tří rozměrů.',
              'The volume of a cuboid is the product of its three dimensions.',
            ),
            L(`$${a} \\cdot ${b} \\cdot ${c}$`, `$${a} \\cdot ${b} \\cdot ${c}$`),
          ],
          solution: [step('Objem:', 'The volume:', `${a} \\cdot ${b} \\cdot ${c} = ${a * b * c}`)],
          misconceptions: [
            mc(
              ans(2 * (a * b + b * c + a * c)),
              'formula',
              'To je povrch, ne objem.',
              'That is the surface area, not the volume.',
            ),
          ],
          verify: [{ kind: 'value', expr: `${a}*${b}*${c}` }],
        };
      }
      if (lv === 2) {
        const surface = 2 * (a * b + b * c + a * c);
        return {
          prompt: L(
            `Kvádr má rozměry ${a} cm, ${b} cm a ${c} cm. Jaký je jeho povrch v cm²?`,
            `A cuboid measures ${a} cm, ${b} cm and ${c} cm. What is its surface area in cm²?`,
          ),
          answer: { kind: 'number', value: ans(surface) },
          hints: [
            L('Kvádr má tři dvojice stejných stěn.', 'A cuboid has three pairs of equal faces.'),
            L(
              `Stěny mají obsahy ${a * b}, ${b * c} a ${a * c} cm².`,
              `The faces have areas of ${a * b}, ${b * c} and ${a * c} cm².`,
            ),
          ],
          solution: [step('Povrch:', 'The surface:', `2 \\cdot (${a * b} + ${b * c} + ${a * c}) = ${surface}`)],
          misconceptions: [
            mc(
              ans(a * b + b * c + a * c),
              'incomplete',
              'Každá ze tří stěn je na kvádru dvakrát.',
              'Each of the three faces occurs twice on the cuboid.',
            ),
          ],
          verify: [{ kind: 'value', expr: `2*(${a}*${b}+${b}*${c}+${a}*${c})` }],
        };
      }
      return {
        prompt: L(
          `Krychle má povrch ${6 * a * a} cm². Jaký je její objem v cm³?`,
          `A cube has a surface area of ${6 * a * a} cm². What is its volume in cm³?`,
        ),
        answer: { kind: 'number', value: ans(a * a * a) },
        hints: [
          L(
            'Povrch krychle je šest stejných čtverců. Z obsahu jedné stěny zjistíš hranu.',
            'The surface of a cube is six equal squares. The area of one face gives you the edge.',
          ),
          L(
            `Jedna stěna: $${6 * a * a} : 6 = ${a * a}$ cm², hrana ${a} cm.`,
            `One face: $${6 * a * a} \\div 6 = ${a * a}$ cm², the edge is ${a} cm.`,
          ),
        ],
        solution: [
          step(
            'Jedna stěna a hrana:',
            'One face and the edge:',
            L(
              `${6 * a * a} : 6 = ${a * a}, \\quad \\sqrt{${a * a}} = ${a}`,
              `${6 * a * a} \\div 6 = ${a * a}, \\quad \\sqrt{${a * a}} = ${a}`,
            ),
          ),
          step('Objem:', 'The volume:', `${a}^3 = ${a * a * a}`),
        ],
        misconceptions: [mc(ans(a * a), 'incomplete', 'To je obsah jedné stěny.', 'That is the area of one face.')],
        verify: [{ kind: 'value', expr: `sqrt(${6 * a * a}/6)^3` }],
      };
    },
  }),

  gen({
    id: 'solid.cuboid.water',
    concept: 'solid.cuboid',
    kind: 'applied',
    levels: [2, 3, 4],
    title: L('Akvária a hladiny', 'Aquaria and water levels'),
    est: (lv) => 55 + 30 * lv,
    make(r, lv) {
      const a = r.pick([40, 50, 60, 80]);
      const b = r.pick([20, 25, 30, 40]);
      if (lv === 2) {
        const c = r.pick([20, 30, 40, 50]);
        const litres = (a * b * c) / 1000;
        return {
          prompt: L(
            `Akvárium tvaru kvádru má vnitřní rozměry ${a} cm, ${b} cm a ${c} cm. Kolik litrů vody se do něj vejde?`,
            `A cuboid aquarium has inner dimensions of ${a} cm, ${b} cm and ${c} cm. How many litres of water does it hold?`,
          ),
          answer: { kind: 'number', value: ans(litres) },
          hints: [
            L(
              'Litr je decimetr krychlový. Převeď rozměry na decimetry, nebo vyděl objem v cm³ tisícem.',
              'A litre is a cubic decimetre. Convert the dimensions to decimetres, or divide the volume in cm³ by a thousand.',
            ),
            both((n) => `$${n(a / 10)} \\cdot ${n(b / 10)} \\cdot ${n(c / 10)}$ dm³`),
          ],
          solution: [
            step(
              'Objem v cm³:',
              'The volume in cm³:',
              both((n) => `${a} \\cdot ${b} \\cdot ${c} = ${n(a * b * c)}`),
            ),
            step(
              'V litrech:',
              'In litres:',
              both((n, czech) => `${n(a * b * c)} ${czech ? ':' : '\\div'} 1\\,000 = ${n(litres)}`),
            ),
          ],
          misconceptions: [
            mc(
              ans(a * b * c),
              'misread',
              'To je objem v cm³. Litr má 1 000 cm³.',
              'That is the volume in cm³. A litre is 1,000 cm³.',
            ),
          ],
          verify: [{ kind: 'value', expr: `${a}*${b}*${c}/1000` }],
          context: { applied: true },
        };
      }
      if (lv === 3) {
        const height = r.pick([10, 15, 20, 25, 30]);
        const litres = (a * b * height) / 1000;
        return {
          prompt: both((n, czech) =>
            czech
              ? `Do prázdného akvária s obdélníkovým dnem ${a} cm × ${b} cm nalijeme $${n(litres)}$ litrů vody. Do jaké výšky v cm bude voda sahat?`
              : `We pour $${n(litres)}$ litres of water into an empty aquarium with a ${a} cm × ${b} cm rectangular bottom. How high, in cm, will the water reach?`,
          ),
          answer: { kind: 'number', value: ans(height) },
          hints: [
            L(
              'Objem vody je obsah dna krát výška hladiny. Počítej v centimetrech: litr je 1 000 cm³.',
              'The volume of water is the area of the bottom times the height of the level. Work in centimetres: a litre is 1,000 cm³.',
            ),
            both((n) => `$${n(litres)}$ l $= ${n(litres * 1000)}$ cm³`),
          ],
          solution: [
            step(
              'Objem v cm³ a obsah dna:',
              'The volume in cm³ and the area of the bottom:',
              both((n) => `${n(litres * 1000)}, \\quad ${a} \\cdot ${b} = ${n(a * b)}`),
            ),
            step(
              'Výška:',
              'The height:',
              both((n, czech) => `${n(litres * 1000)} ${czech ? ':' : '\\div'} ${n(a * b)} = ${height}`),
            ),
          ],
          misconceptions: [],
          verify: [{ kind: 'value', expr: `${litres}*1000/(${a}*${b})` }],
          context: { applied: true },
        };
      }
      const rise = r.pick([1, 2, 3, 4]);
      const volume = (a * b * rise) / 1000;
      return {
        prompt: L(
          `V akváriu s obdélníkovým dnem ${a} cm × ${b} cm je voda. Když do ní ponoříme kámen, hladina stoupne o ${rise} cm (voda nepřeteče). Jaký objem v litrech má kámen?`,
          `An aquarium with a ${a} cm × ${b} cm rectangular bottom holds water. When a stone is put in, the level rises by ${rise} cm (nothing spills). What is the volume of the stone in litres?`,
        ),
        answer: { kind: 'number', value: ans(volume) },
        hints: [
          L(
            'Kámen vytlačí tolik vody, kolik sám zabírá: vrstvu o výšce, o kterou stoupla hladina.',
            'The stone displaces as much water as it takes up: a layer as high as the rise of the level.',
          ),
          L(`Vrstva: $${a} \\cdot ${b} \\cdot ${rise}$ cm³.`, `The layer: $${a} \\cdot ${b} \\cdot ${rise}$ cm³.`),
        ],
        solution: [
          step(
            'Objem vrstvy:',
            'The volume of the layer:',
            both((n) => `${a} \\cdot ${b} \\cdot ${rise} = ${n(a * b * rise)}`),
          ),
          step(
            'V litrech:',
            'In litres:',
            both((n, czech) => `${n(a * b * rise)} ${czech ? ':' : '\\div'} 1\\,000 = ${n(volume)}`),
          ),
        ],
        misconceptions: [
          mc(
            ans(a * b * rise),
            'misread',
            'To je objem v cm³. Otázka se ptá na litry.',
            'That is the volume in cm³. The question asks for litres.',
          ),
        ],
        verify: [{ kind: 'value', expr: `${a}*${b}*${rise}/1000` }],
        context: { applied: true },
      };
    },
  }),

  gen({
    id: 'solid.cuboid.choice',
    concept: 'solid.cuboid',
    kind: 'core',
    levels: [3],
    title: L('Krychle a kvádr – výběr odpovědi', 'Cube and cuboid – choose the answer'),
    tags: ['mc5'],
    est: () => 120,
    make(r) {
      const a = r.int(3, 9);
      const built = numericChoice(r, 2 * a * a, [a * a, 4 * a * a, 6 * a * a, 3 * a * a, a * a * a], (v) =>
        L(`o ${v} cm²`, `by ${v} cm²`),
      );
      return {
        prompt: L(
          `Krychli o hraně ${a} cm rozřízneme jedním rovným řezem rovnoběžným s jednou stěnou na dva kvádry. O kolik je součet povrchů obou kvádrů větší než povrch původní krychle?`,
          `A cube with an edge of ${a} cm is cut by one straight cut parallel to a face into two cuboids. By how much is the sum of the surfaces of the two cuboids larger than the surface of the original cube?`,
        ),
        answer: built.spec,
        hints: [
          L(
            'Co na povrchu přibylo? Řezem vzniknou dvě nové stěny — na každém kvádru jedna.',
            'What was added to the surface? The cut creates two new faces — one on each cuboid.',
          ),
          L(`Každá nová stěna je čtverec o straně ${a} cm.`, `Each new face is a square of side ${a} cm.`),
        ],
        solution: [
          step(
            'Původní stěny zůstávají, přibudou dvě stěny řezu:',
            'The original faces stay; two faces of the cut are added:',
            `2 \\cdot ${a}^2 = ${2 * a * a}`,
          ),
        ],
        misconceptions: [built.idOf(a * a)].flatMap((id) =>
          id
            ? [
                mc(
                  id,
                  'incomplete',
                  'Řez má dvě strany: nová stěna vznikne na obou kvádrech.',
                  'A cut has two sides: a new face appears on both cuboids.',
                ),
              ]
            : [],
        ),
      };
    },
  }),

  gen({
    id: 'solid.prism.triangular',
    concept: 'solid.prism',
    kind: 'core',
    levels: [2, 3, 4],
    title: L('Objem a povrch hranolu', 'Volume and surface of a prism'),
    est: (lv) => 55 + 35 * lv,
    make(r, lv) {
      const [p, q, h] = r.pick([
        [3, 4, 5],
        [6, 8, 10],
        [5, 12, 13],
        [9, 12, 15],
        [8, 15, 17],
      ] as const);
      const height = r.int(4, 12);
      if (lv === 2) {
        const volume = ((p * q) / 2) * height;
        return {
          prompt: L(
            `Podstavou kolmého hranolu je pravoúhlý trojúhelník s odvěsnami ${p} cm a ${q} cm. Výška hranolu je ${height} cm. Jaký je jeho objem v cm³?`,
            `The base of a right prism is a right triangle with legs of ${p} cm and ${q} cm. The prism is ${height} cm high. What is its volume in cm³?`,
          ),
          answer: { kind: 'number', value: ans(volume) },
          hints: [
            L(
              'Objem hranolu je obsah podstavy krát výška.',
              'The volume of a prism is the area of the base times the height.',
            ),
            L(
              `Podstava: $\\frac{${p} \\cdot ${q}}{2} = ${(p * q) / 2}$ cm².`,
              `The base: $\\frac{${p} \\cdot ${q}}{2} = ${(p * q) / 2}$ cm².`,
            ),
          ],
          solution: [
            step('Obsah podstavy:', 'The area of the base:', `\\frac{${p} \\cdot ${q}}{2} = ${(p * q) / 2}`),
            step('Objem:', 'The volume:', `${(p * q) / 2} \\cdot ${height} = ${volume}`),
          ],
          misconceptions: [
            mc(
              ans(p * q * height),
              'formula',
              'Podstava je trojúhelník: jeho obsah je polovina součinu odvěsen.',
              'The base is a triangle: its area is half the product of the legs.',
            ),
          ],
          verify: [{ kind: 'value', expr: `${p}*${q}/2*${height}` }],
        };
      }
      if (lv === 3) {
        const surface = p * q + (p + q + h) * height;
        return {
          prompt: L(
            `Podstavou kolmého hranolu je pravoúhlý trojúhelník s odvěsnami ${p} cm a ${q} cm. Výška hranolu je ${height} cm. Jaký je jeho povrch v cm²?`,
            `The base of a right prism is a right triangle with legs of ${p} cm and ${q} cm. The prism is ${height} cm high. What is its surface area in cm²?`,
          ),
          answer: { kind: 'number', value: ans(surface) },
          hints: [
            L(
              'Povrch jsou dvě podstavy a plášť. Plášť je obdélník, jehož jedna strana je obvod podstavy.',
              'The surface is two bases and the lateral surface. Unrolled, the lateral surface is a rectangle one side of which is the perimeter of the base.',
            ),
            L(
              `K obvodu podstavy potřebuješ přeponu: $\\sqrt{${p}^2 + ${q}^2} = ${h}$ cm.`,
              `For the perimeter of the base you need the hypotenuse: $\\sqrt{${p}^2 + ${q}^2} = ${h}$ cm.`,
            ),
          ],
          solution: [
            step('Dvě podstavy:', 'The two bases:', `2 \\cdot \\frac{${p} \\cdot ${q}}{2} = ${p * q}`),
            step('Plášť:', 'The lateral surface:', `(${p} + ${q} + ${h}) \\cdot ${height} = ${(p + q + h) * height}`),
            step('Povrch:', 'The surface:', `${p * q} + ${(p + q + h) * height} = ${surface}`),
          ],
          misconceptions: [
            mc(
              ans(p * q + (p + q) * height),
              'incomplete',
              'Plášť má tři stěny: chybí ta nad přeponou.',
              'The lateral surface has three faces: the one over the hypotenuse is missing.',
            ),
          ],
          verify: [{ kind: 'value', expr: `${p}*${q}+(${p}+${q}+sqrt(${p}^2+${q}^2))*${height}` }],
        };
      }
      const top = r.pick([6, 8, 10]);
      const bottom = top - r.pick([2, 4]);
      const depth = r.pick([3, 4, 5]);
      const length = r.pick([20, 30, 40, 50]);
      const litres = ((top + bottom) / 2) * depth * length;
      return {
        prompt: L(
          `Žlab na vodu má po celé délce stejný průřez tvaru rovnoramenného lichoběžníku: nahoře je široký ${top} dm, u dna ${bottom} dm a je hluboký ${depth} dm. Žlab je dlouhý ${length} dm. Kolik litrů vody se do něj vejde?`,
          `A water trough has the same cross-section along its whole length, an isosceles trapezoid: ${top} dm wide at the top, ${bottom} dm at the bottom and ${depth} dm deep. The trough is ${length} dm long. How many litres of water does it hold?`,
        ),
        answer: { kind: 'number', value: ans(litres) },
        hints: [
          L(
            'Žlab je hranol položený na boku: jeho podstavou je lichoběžníkový průřez a výškou délka žlabu.',
            'The trough is a prism lying on its side: its base is the trapezoidal cross-section and its height is the length of the trough.',
          ),
          L(
            `Průřez: $\\frac{(${top} + ${bottom}) \\cdot ${depth}}{2} = ${((top + bottom) / 2) * depth}$ dm².`,
            `The cross-section: $\\frac{(${top} + ${bottom}) \\cdot ${depth}}{2} = ${((top + bottom) / 2) * depth}$ dm².`,
          ),
        ],
        solution: [
          step(
            'Obsah průřezu:',
            'The area of the cross-section:',
            `\\frac{(${top} + ${bottom}) \\cdot ${depth}}{2} = ${((top + bottom) / 2) * depth}`,
          ),
          step(
            'Objem v dm³, tedy v litrech:',
            'The volume in dm³, that is in litres:',
            `${((top + bottom) / 2) * depth} \\cdot ${length} = ${litres}`,
          ),
        ],
        misconceptions: [
          mc(
            ans(top * depth * length),
            'formula',
            'Průřez není obdélník: u dna je žlab užší.',
            'The cross-section is not a rectangle: the trough is narrower at the bottom.',
          ),
        ],
        verify: [{ kind: 'value', expr: `(${top}+${bottom})/2*${depth}*${length}` }],
        context: { applied: true },
      };
    },
  }),

  gen({
    id: 'solid.prism.choice',
    concept: 'solid.prism',
    kind: 'core',
    levels: [3],
    title: L('Hranol – výběr odpovědi', 'A prism – choose the answer'),
    tags: ['mc5'],
    est: () => 120,
    make(r) {
      const [p, q] = r.pick([
        [3, 4],
        [6, 8],
        [5, 12],
        [4, 6],
        [6, 10],
      ] as const);
      const height = r.int(5, 12);
      const volume = ((p * q) / 2) * height;
      const built = numericChoice(r, height, [height / 2, 2 * height, height + 2, volume / (p + q), height - 1], (v) =>
        L(`${v} cm`, `${v} cm`),
      );
      return {
        prompt: L(
          `Kolmý hranol s objemem ${volume} cm³ má za podstavu pravoúhlý trojúhelník s odvěsnami ${p} cm a ${q} cm. Jaká je výška hranolu?`,
          `A right prism with a volume of ${volume} cm³ has a right triangle with legs of ${p} cm and ${q} cm as its base. What is the height of the prism?`,
        ),
        answer: built.spec,
        hints: [
          L(
            'Objem je obsah podstavy krát výška, výška je tedy objem dělený obsahem podstavy.',
            'The volume is the area of the base times the height, so the height is the volume divided by the area of the base.',
          ),
          L(
            `Podstava: $\\frac{${p} \\cdot ${q}}{2} = ${(p * q) / 2}$ cm².`,
            `The base: $\\frac{${p} \\cdot ${q}}{2} = ${(p * q) / 2}$ cm².`,
          ),
        ],
        solution: [
          step('Obsah podstavy:', 'The area of the base:', `\\frac{${p} \\cdot ${q}}{2} = ${(p * q) / 2}`),
          step(
            'Výška:',
            'The height:',
            L(`${volume} : ${(p * q) / 2} = ${height}`, `${volume} \\div ${(p * q) / 2} = ${height}`),
          ),
        ],
        misconceptions: [built.idOf(height / 2)].flatMap((id) =>
          id
            ? [
                mc(
                  id,
                  'formula',
                  'Podstava je trojúhelník, ne obdélník: její obsah je poloviční.',
                  'The base is a triangle, not a rectangle: its area is half.',
                ),
              ]
            : [],
        ),
      };
    },
  }),

  gen({
    id: 'solid.cylinder.volume',
    concept: 'solid.cylinder',
    kind: 'core',
    levels: [2, 3, 4],
    title: L('Objem a povrch válce', 'Volume and surface of a cylinder'),
    est: (lv) => 50 + 30 * lv,
    make(r, lv) {
      const radius = r.int(2, 6);
      const height = r.int(3, 12);
      const asPi = L(
        'Výsledek zapište jako násobek čísla $\\pi$, například $12\\pi$.',
        'Write the result as a multiple of $\\pi$, for example $12\\pi$.',
      );
      if (lv === 2) {
        const k = radius * radius * height;
        return {
          prompt: L(
            `Válec má poloměr podstavy ${radius} cm a výšku ${height} cm. Jaký je jeho objem v cm³? ${asPi.cs}`,
            `A cylinder has a base radius of ${radius} cm and a height of ${height} cm. What is its volume in cm³? ${asPi.en}`,
          ),
          answer: { kind: 'number', value: `${k}*pi`, label: 'V =' },
          hints: [
            L(
              'Válec je „kulatý hranol“: objem je obsah podstavy krát výška, $V = \\pi r^2 v$.',
              'A cylinder is a "round prism": the volume is the area of the base times the height, $V = \\pi r^2 h$.',
            ),
            L(
              `Podstava: $\\pi \\cdot ${radius}^2 = ${radius * radius}\\pi$ cm².`,
              `The base: $\\pi \\cdot ${radius}^2 = ${radius * radius}\\pi$ cm².`,
            ),
          ],
          solution: [step('Objem:', 'The volume:', `\\pi \\cdot ${radius}^2 \\cdot ${height} = ${k}\\pi`)],
          misconceptions: [
            mc(
              `${2 * radius * height}*pi`,
              'formula',
              'To je obsah pláště ($2\\pi r v$), ne objem.',
              'That is the lateral area ($2\\pi r h$), not the volume.',
            ),
            mc(
              `${radius * height}*pi`,
              'formula',
              'Poloměr se v objemu umocňuje na druhou.',
              'The radius is squared in the volume.',
            ),
          ],
          verify: [{ kind: 'value', expr: `pi*${radius}^2*${height}` }],
        };
      }
      if (lv === 3) {
        const k = 2 * radius * (radius + height);
        return {
          prompt: L(
            `Válec má poloměr podstavy ${radius} cm a výšku ${height} cm. Jaký je jeho povrch v cm²? ${asPi.cs}`,
            `A cylinder has a base radius of ${radius} cm and a height of ${height} cm. What is its surface area in cm²? ${asPi.en}`,
          ),
          answer: { kind: 'number', value: `${k}*pi`, label: 'S =' },
          hints: [
            L(
              'Povrch jsou dvě kruhové podstavy a plášť. Plášť je po rozvinutí obdélník $2\\pi r \\times v$.',
              'The surface is two circular bases and the lateral surface, which unrolls into a $2\\pi r \\times h$ rectangle.',
            ),
            L(
              `Podstavy: $2 \\cdot ${radius * radius}\\pi$; plášť: $2\\pi \\cdot ${radius} \\cdot ${height} = ${2 * radius * height}\\pi$.`,
              `The bases: $2 \\cdot ${radius * radius}\\pi$; the lateral surface: $2\\pi \\cdot ${radius} \\cdot ${height} = ${2 * radius * height}\\pi$.`,
            ),
          ],
          solution: [
            step(
              'Dvě podstavy a plášť:',
              'Two bases and the lateral surface:',
              `2 \\cdot ${radius * radius}\\pi + ${2 * radius * height}\\pi = ${k}\\pi`,
            ),
          ],
          misconceptions: [
            mc(
              `${2 * radius * height + radius * radius}*pi`,
              'incomplete',
              'Válec má dvě podstavy.',
              'A cylinder has two bases.',
            ),
            mc(
              `${2 * radius * height}*pi`,
              'incomplete',
              'To je jen plášť; chybí obě podstavy.',
              'That is only the lateral surface; both bases are missing.',
            ),
          ],
          verify: [{ kind: 'value', expr: `2*pi*${radius}*(${radius}+${height})` }],
        };
      }
      const m = r.pick([2, 3, 4, 5]);
      return {
        prompt: L(
          `Výška válce je ${m === 2 ? 'dvakrát' : m === 3 ? 'třikrát' : m === 4 ? 'čtyřikrát' : 'pětkrát'} větší než poloměr jeho podstavy. Kolikrát je obsah pláště válce větší než obsah jedné podstavy?`,
          `The height of a cylinder is ${m} times the radius of its base. How many times is the lateral area of the cylinder larger than the area of one base?`,
        ),
        answer: { kind: 'number', value: ans(2 * m) },
        hints: [
          L(
            'Zapiš oba obsahy pomocí poloměru $r$: plášť $2\\pi r v$, podstava $\\pi r^2$.',
            'Write both areas with the radius $r$: the lateral area $2\\pi r h$, the base $\\pi r^2$.',
          ),
          L(
            `Pro $v = ${m}r$ je plášť $2\\pi r \\cdot ${m}r = ${2 * m}\\pi r^2$.`,
            `For $h = ${m}r$ the lateral area is $2\\pi r \\cdot ${m}r = ${2 * m}\\pi r^2$.`,
          ),
        ],
        solution: [
          step('Plášť:', 'The lateral area:', `2\\pi r \\cdot ${m}r = ${2 * m}\\pi r^2`),
          step(
            'Podíl:',
            'The quotient:',
            L(`${2 * m}\\pi r^2 : \\pi r^2 = ${2 * m}`, `${2 * m}\\pi r^2 \\div \\pi r^2 = ${2 * m}`),
          ),
        ],
        misconceptions: [
          mc(
            ans(m),
            'formula',
            'Plášť je $2\\pi r v$ — dvojka tam nesmí chybět.',
            'The lateral area is $2\\pi r h$ — the two must not be left out.',
          ),
        ],
        verify: [{ kind: 'value', expr: `2*pi*1*${m}/(pi*1^2)` }],
      };
    },
  }),

  gen({
    id: 'solid.cylinder.choice',
    concept: 'solid.cylinder',
    kind: 'core',
    levels: [3],
    title: L('Válec – výběr odpovědi', 'A cylinder – choose the answer'),
    tags: ['mc5'],
    est: () => 120,
    make(r) {
      const [a, b] = r.pick([
        [2, 2],
        [3, 3],
        [2, 1],
        [3, 1],
        [4, 2],
        [4, 4],
      ] as const);
      const factor = (a * a) / b;
      const times = (v: number): L => L(`${v}krát`, `${v} times`);
      const built = numericChoice(r, factor, [a / b, a, a * a, a * b, 2 * factor], times);
      const word = (n: number): [string, string] =>
        n === 2 ? ['dvojnásobný', 'twice'] : n === 3 ? ['trojnásobný', 'three times'] : ['čtyřnásobný', 'four times'];
      const lower = (n: number): [string, string] =>
        n === 1
          ? ['stejnou výšku', 'the same height']
          : n === 2
            ? ['poloviční výšku', 'half the height']
            : n === 3
              ? ['třetinovou výšku', 'a third of the height']
              : ['čtvrtinovou výšku', 'a quarter of the height'];
      return {
        prompt: L(
          `Válec B má oproti válci A ${word(a)[0]} poloměr podstavy a ${lower(b)[0]}. Kolikrát větší je objem válce B než objem válce A?`,
          `Compared with cylinder A, cylinder B has ${word(a)[1]} the base radius and ${lower(b)[1]}. How many times larger is the volume of B than that of A?`,
        ),
        answer: built.spec,
        hints: [
          L(
            'V objemu $V = \\pi r^2 v$ je poloměr na druhou: zvětšení poloměru se projeví dvakrát.',
            'In $V = \\pi r^2 h$ the radius is squared: enlarging the radius counts twice.',
          ),
          L(
            `Poloměr ${a}krát větší znamená podstavu $${a}^2 = ${a * a}$krát větší.`,
            `A radius ${a} times larger means a base $${a}^2 = ${a * a}$ times larger.`,
          ),
        ],
        solution: [
          step(
            'Podstava:',
            'The base:',
            L(`${a}^2 = ${a * a}\\text{krát větší}`, `${a}^2 = ${a * a}\\text{ times larger}`),
          ),
          step('S výškou:', 'With the height:', L(`${a * a} : ${b} = ${factor}`, `${a * a} \\div ${b} = ${factor}`)),
        ],
        misconceptions: [built.idOf(a / b), built.idOf(a)]
          .flatMap((id) =>
            id ? [mc(id, 'formula', 'Poloměr je v objemu na druhou.', 'The radius is squared in the volume.')] : [],
          )
          .slice(0, 1),
      };
    },
  }),
];

/** A shape as the subject of a sentence: capitalised, and a relative clause closed by a comma. */
function subject(text: string): string {
  const closed = /, (který|that) /.test(text) ? `${text},` : text;
  return closed.charAt(0).toUpperCase() + closed.slice(1);
}
