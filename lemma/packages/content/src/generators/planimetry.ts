import { L, fMul, fToInput, fToTex, frac, type FigureSpec, type Generator } from '@lemma/core';
import { gen, mc, plural, step, zPrep } from './helpers';
import { agree, triangleASA, triangleFigure, triangleSSS } from './triangle-kit';
import { piIn, piTex } from './trig-kit';

type Point = [number, number];

/** The point of the unit circle at `deg` degrees, scaled by r. */
const onCircle = (deg: number, r = 1): Point => [
  r * Math.cos((deg * Math.PI) / 180),
  r * Math.sin((deg * Math.PI) / 180),
];

/** A circle with some of its points joined up; everything a circle-angle problem needs. */
function circleFigure(
  points: { at: Point; label: string }[],
  segments: [Point, Point][],
  extra: NonNullable<FigureSpec['labels']> = [],
): FigureSpec {
  return {
    view: { xMin: -1.45, xMax: 1.45, yMin: -1.35, yMax: 1.35 },
    aspect: 0.93,
    maxWidth: 400,
    bare: true,
    circles: [{ cx: 0, cy: 0, r: 1, color: 'muted' }],
    segments: segments.map(([from, to]) => ({ from, to, color: 'a' as const })),
    points: points.map((point) => ({ x: point.at[0], y: point.at[1], color: 'a' as const })),
    // Names sit just outside the circle (or beside the centre).
    labels: [
      ...points.map((point) => ({
        x: point.at[0] * 1.17 + (point.at[0] === 0 && point.at[1] === 0 ? 0.1 : 0),
        y: point.at[1] * 1.17 + (point.at[0] === 0 && point.at[1] === 0 ? -0.13 : 0),
        text: point.label,
      })),
      ...extra,
    ],
  };
}

/** Triangles with whole sides and whole area, for Heron's formula. */
const HERON: readonly (readonly [number, number, number, number])[] = [
  [13, 14, 15, 84],
  [5, 5, 6, 12],
  [5, 5, 8, 12],
  [7, 15, 20, 42],
  [9, 10, 17, 36],
  [13, 13, 10, 60],
  [10, 17, 21, 84],
  [11, 13, 20, 66],
  [4, 13, 15, 24],
];

/** Syllabus topic 16: planimetry. */
export const PLANIMETRY_GENERATORS: Generator[] = [
  gen({
    id: 'plan.angles.triangle',
    concept: 'plan.angles',
    kind: 'core',
    levels: [1, 2, 3],
    title: L('Úhly v trojúhelníku', 'Angles in a triangle'),
    tags: ['annual-review'],
    est: (lv) => 35 + 25 * lv,
    make(r, lv) {
      if (lv === 1) {
        const alpha = r.int(25, 95);
        const beta = r.int(25, Math.min(95, 150 - alpha));
        const gamma = 180 - alpha - beta;
        return {
          prompt: L(
            `V trojúhelníku $ABC$ je $\\alpha = ${alpha}^{\\circ}$ a $\\beta = ${beta}^{\\circ}$. Určete $\\gamma$.`,
            `In triangle $ABC$, $\\alpha = ${alpha}^{\\circ}$ and $\\beta = ${beta}^{\\circ}$. Find $\\gamma$.`,
          ),
          figure: triangleFigure(triangleASA(10, alpha, beta), { angles: { A: `${alpha}°`, B: `${beta}°`, C: 'γ' } }),
          answer: { kind: 'number', value: `${gamma}`, unit: 'deg', label: '\\gamma =' },
          hints: [
            L(
              'Kolik dávají dohromady všechny tři úhly trojúhelníku?',
              'What do the three angles of a triangle add up to?',
            ),
            L('$\\gamma = 180^{\\circ} - \\alpha - \\beta$', '$\\gamma = 180^{\\circ} - \\alpha - \\beta$'),
          ],
          solution: [
            step(
              'Součet vnitřních úhlů trojúhelníku je $180^{\\circ}$:',
              'The interior angles of a triangle sum to $180^{\\circ}$:',
              `\\gamma = 180^{\\circ} - ${alpha}^{\\circ} - ${beta}^{\\circ} = ${gamma}^{\\circ}`,
            ),
          ],
          misconceptions: [
            mc(
              `${alpha + beta}`,
              'incomplete',
              'To je součet zadaných úhlů. Ještě ho odečti od $180^{\\circ}$.',
              'That is the sum of the given angles. Subtract it from $180^{\\circ}$.',
            ),
            mc(
              `${360 - alpha - beta}`,
              'concept',
              'Součet úhlů v trojúhelníku je $180^{\\circ}$; $360^{\\circ}$ platí pro čtyřúhelník.',
              'The angles of a triangle sum to $180^{\\circ}$; $360^{\\circ}$ is for a quadrilateral.',
            ),
          ],
          verify: [{ kind: 'value', expr: `180-${alpha}-${beta}` }],
        };
      }
      if (lv === 2) {
        if (r.bool()) {
          // The exterior angle equals the sum of the two interior angles not adjacent to it.
          const alpha = r.int(30, 80);
          const beta = r.int(30, Math.min(80, 150 - alpha));
          const exterior = alpha + beta;
          return {
            prompt: L(
              `V trojúhelníku $ABC$ má vnější úhel u vrcholu $C$ velikost $${exterior}^{\\circ}$ a vnitřní úhel $\\alpha = ${alpha}^{\\circ}$. Určete vnitřní úhel $\\beta$.`,
              `In triangle $ABC$ the exterior angle at vertex $C$ measures $${exterior}^{\\circ}$ and the interior angle $\\alpha = ${alpha}^{\\circ}$. Find the interior angle $\\beta$.`,
            ),
            answer: { kind: 'number', value: `${beta}`, unit: 'deg', label: '\\beta =' },
            hints: [
              L(
                'Vnější a vnitřní úhel u téhož vrcholu dávají dohromady $180^{\\circ}$.',
                'An exterior angle and the interior angle at the same vertex add up to $180^{\\circ}$.',
              ),
              L(
                'Kratší cesta: vnější úhel se rovná součtu dvou vnitřních úhlů u ostatních vrcholů.',
                'The shortcut: an exterior angle equals the sum of the two interior angles at the other vertices.',
              ),
            ],
            solution: [
              step(
                'Vnější úhel u $C$ je součet vnitřních úhlů u $A$ a $B$:',
                'The exterior angle at $C$ is the sum of the interior angles at $A$ and $B$:',
                `${exterior}^{\\circ} = ${alpha}^{\\circ} + \\beta \\;\\Rightarrow\\; \\beta = ${beta}^{\\circ}`,
              ),
              step(
                'Proč: vnitřní úhel u $C$ je $180^{\\circ} - \\alpha - \\beta$ a vnější ho doplňuje do $180^{\\circ}$.',
                'Why: the interior angle at $C$ is $180^{\\circ} - \\alpha - \\beta$, and the exterior angle completes it to $180^{\\circ}$.',
              ),
            ],
            misconceptions: [
              mc(
                `${180 - exterior}`,
                'misread',
                'To je vnitřní úhel $\\gamma$ u vrcholu $C$. Ptali se na $\\beta$.',
                'That is the interior angle $\\gamma$ at vertex $C$. The question asks for $\\beta$.',
              ),
              mc(
                `${180 - exterior - alpha}`,
                'concept',
                'Vnější úhel není vnitřní úhel trojúhelníku — nelze ho odečítat od $180^{\\circ}$ spolu s $\\alpha$.',
                'An exterior angle is not an interior angle of the triangle — it cannot be subtracted from $180^{\\circ}$ together with $\\alpha$.',
              ),
            ],
            verify: [{ kind: 'value', expr: `${exterior}-${alpha}` }],
          };
        }
        const apex = 2 * r.int(10, 65);
        const base = (180 - apex) / 2;
        const fromApex = r.bool();
        return {
          prompt: fromApex
            ? L(
                `Rovnoramenný trojúhelník má při hlavním vrcholu (mezi rameny) úhel $${apex}^{\\circ}$. Jak velký je úhel při základně?`,
                `An isosceles triangle has an angle of $${apex}^{\\circ}$ at its apex (between the equal sides). How large is a base angle?`,
              )
            : L(
                `Rovnoramenný trojúhelník má při základně úhel $${base}^{\\circ}$. Jak velký je úhel při hlavním vrcholu (mezi rameny)?`,
                `An isosceles triangle has a base angle of $${base}^{\\circ}$. How large is the angle at the apex (between the equal sides)?`,
              ),
          answer: { kind: 'number', value: `${fromApex ? base : apex}`, unit: 'deg' },
          hints: [
            L(
              'Úhly při základně rovnoramenného trojúhelníku jsou stejné.',
              'The base angles of an isosceles triangle are equal.',
            ),
            L('Všechny tři úhly dají $180^{\\circ}$.', 'All three angles make $180^{\\circ}$.'),
          ],
          solution: [
            fromApex
              ? step(
                  'Na dva stejné úhly při základně zbývá:',
                  'What is left for the two equal base angles:',
                  `\\frac{180^{\\circ} - ${apex}^{\\circ}}{2} = ${base}^{\\circ}`,
                )
              : step(
                  'Oba úhly při základně jsou stejné:',
                  'Both base angles are equal:',
                  `180^{\\circ} - 2 \\cdot ${base}^{\\circ} = ${apex}^{\\circ}`,
                ),
          ],
          misconceptions: fromApex
            ? [
                mc(
                  `${180 - apex}`,
                  'incomplete',
                  'To je součet obou úhlů při základně. Ještě vyděl dvěma.',
                  'That is the sum of both base angles. Divide by two.',
                ),
              ]
            : [
                mc(
                  `${180 - base}`,
                  'incomplete',
                  'Při základně jsou dva stejné úhly — odečti oba.',
                  'There are two equal base angles — subtract both.',
                ),
              ],
          verify: [{ kind: 'value', expr: fromApex ? `(180-${apex})/2` : `180-2*${base}` }],
        };
      }
      // Level 3: the angles are given by expressions in x.
      const x = r.int(12, 30);
      const p = r.pick([2, 3]);
      const q = r.int(-10, 15);
      // α = x, β = p·x + q, γ = the rest, written as m·x + n with a second multiplier.
      const m = r.pick([1, 2]);
      const n = 180 - x - (p * x + q) - m * x;
      const angles = [x, p * x + q, m * x + n];
      const term = (coef: number, constant: number): string =>
        `${coef === 1 ? '' : coef}x${constant === 0 ? '' : constant > 0 ? ` + ${constant}^{\\circ}` : ` - ${-constant}^{\\circ}`}`;
      const largest = Math.max(...angles);
      const total = 1 + p + m;
      return {
        prompt: L(
          `Vnitřní úhly trojúhelníku mají velikosti $x$, $${term(p, q)}$ a $${term(m, n)}$. Určete velikost největšího z nich.`,
          `The interior angles of a triangle measure $x$, $${term(p, q)}$ and $${term(m, n)}$. Find the size of the largest one.`,
        ),
        answer: { kind: 'number', value: `${largest}`, unit: 'deg' },
        hints: [
          L(
            'Součet všech tří výrazů je $180^{\\circ}$. Sestav rovnici pro $x$.',
            'The three expressions add up to $180^{\\circ}$. Set up an equation for $x$.',
          ),
          L(
            'Po vyřešení dosaď $x$ do všech tří výrazů a porovnej je.',
            'After solving, substitute $x$ into all three expressions and compare.',
          ),
        ],
        solution: [
          step('Součet úhlů:', 'The angle sum:', `x + (${term(p, q)}) + (${term(m, n)}) = 180^{\\circ}`),
          step(
            'Sečteme a vyřešíme:',
            'Collect and solve:',
            `${total}x${q + n === 0 ? '' : ` ${q + n > 0 ? '+' : '-'} ${Math.abs(q + n)}^{\\circ}`} = 180^{\\circ} \\;\\Rightarrow\\; x = ${x}^{\\circ}`,
          ),
          step('Úhly:', 'The angles:', `${angles[0]}^{\\circ},\\; ${angles[1]}^{\\circ},\\; ${angles[2]}^{\\circ}`),
          step('Největší z nich:', 'The largest of them:', `${largest}^{\\circ}`),
        ],
        misconceptions: [
          mc(
            `${x}`,
            'incomplete',
            'To je $x$. Ptali se na největší úhel: dosaď do všech tří výrazů.',
            'That is $x$. The question asks for the largest angle: substitute into all three expressions.',
          ),
          ...angles
            .filter((angle) => angle !== largest && angle !== x)
            .map((angle) =>
              mc(
                `${angle}`,
                'misread',
                'To je jeden z úhlů, ale ne největší.',
                'That is one of the angles, but not the largest.',
              ),
            ),
        ],
        // The largest angle is what the other two leave of 180°.
        verify: [
          {
            kind: 'value',
            expr: `180-(${angles.filter((_, index) => index !== angles.indexOf(largest)).join(')-(')})`,
          },
        ],
      };
    },
  }),

  gen({
    id: 'plan.angles.polygon',
    concept: 'plan.angles',
    kind: 'core',
    levels: [2, 3],
    title: L('Úhly v mnohoúhelníku', 'Angles in a polygon'),
    est: (lv) => 60 + 25 * (lv - 2),
    make(r, lv) {
      const n = r.pick(lv === 2 ? [5, 6, 8, 9, 10, 12] : [5, 6, 8, 9, 10, 12, 15, 18, 20]);
      const sum = (n - 2) * 180;
      const interior = sum / n;
      const variant = lv === 2 ? r.pick(['sum', 'interior'] as const) : r.pick(['reverse', 'diagonals'] as const);
      if (variant === 'sum') {
        return {
          prompt: L(
            `Určete součet vnitřních úhlů konvexního ${n}úhelníku.`,
            `Find the sum of the interior angles of a convex polygon with ${n} sides.`,
          ),
          answer: { kind: 'number', value: `${sum}`, unit: 'deg' },
          hints: [
            L(
              'Rozděl mnohoúhelník úhlopříčkami z jednoho vrcholu na trojúhelníky. Kolik jich vznikne?',
              'Split the polygon into triangles with diagonals from one vertex. How many are there?',
            ),
            L(`Vznikne $n - 2$ trojúhelníků, tedy ${n - 2}.`, `There are $n - 2$ triangles, that is ${n - 2}.`),
          ],
          solution: [
            step(
              `Úhlopříčky z jednoho vrcholu rozdělí ${n}úhelník na ${n - 2} ${plural(n - 2, 'trojúhelník', 'trojúhelníky', 'trojúhelníků')}:`,
              `The diagonals from one vertex split the polygon into ${n - 2} triangles:`,
              `(${n} - 2) \\cdot 180^{\\circ} = ${sum}^{\\circ}`,
            ),
          ],
          misconceptions: [
            mc(`${n * 180}`, 'formula', 'Trojúhelníků je $n - 2$, ne $n$.', 'There are $n - 2$ triangles, not $n$.'),
            mc(
              `${(n - 1) * 180}`,
              'formula',
              'Trojúhelníků je $n - 2$: z jednoho vrcholu nevede úhlopříčka k němu samému ani k oběma sousedům.',
              'There are $n - 2$ triangles: no diagonal goes from a vertex to itself or to either neighbour.',
            ),
            mc(
              '360',
              'concept',
              '$360^{\\circ}$ je součet vnějších úhlů. Součet vnitřních závisí na počtu vrcholů.',
              '$360^{\\circ}$ is the sum of the exterior angles. The interior sum depends on the number of vertices.',
            ),
          ],
          verify: [{ kind: 'value', expr: `(${n}-2)*180` }],
        };
      }
      if (variant === 'interior') {
        return {
          prompt: L(
            `Jak velký je vnitřní úhel pravidelného ${n}úhelníku?`,
            `How large is an interior angle of a regular polygon with ${n} sides?`,
          ),
          answer: { kind: 'number', value: `${interior}`, unit: 'deg' },
          hints: [
            L(
              'Nejdřív součet všech vnitřních úhlů: $(n - 2) \\cdot 180^{\\circ}$.',
              'First the sum of all interior angles: $(n - 2) \\cdot 180^{\\circ}$.',
            ),
            L(
              'V pravidelném mnohoúhelníku jsou všechny úhly stejné.',
              'In a regular polygon all the angles are equal.',
            ),
          ],
          solution: [
            step(
              'Součet vnitřních úhlů dělíme počtem vrcholů:',
              'Divide the interior sum by the number of vertices:',
              `\\frac{(${n} - 2) \\cdot 180^{\\circ}}{${n}} = \\frac{${sum}^{\\circ}}{${n}} = ${interior}^{\\circ}`,
            ),
          ],
          misconceptions: [
            mc(
              `${360 / n}`,
              'concept',
              'To je vnější (nebo středový) úhel. Vnitřní ho doplňuje do $180^{\\circ}$.',
              'That is the exterior (or central) angle. The interior angle completes it to $180^{\\circ}$.',
            ),
            mc(
              `${sum}`,
              'incomplete',
              'To je součet všech úhlů. Ještě vyděl počtem vrcholů.',
              'That is the sum of all the angles. Divide by the number of vertices.',
            ),
          ],
          verify: [{ kind: 'value', expr: `180-360/${n}` }],
        };
      }
      if (variant === 'reverse') {
        return {
          prompt: L(
            `Vnitřní úhel pravidelného mnohoúhelníku má velikost $${interior}^{\\circ}$. Kolik má mnohoúhelník vrcholů?`,
            `An interior angle of a regular polygon measures $${interior}^{\\circ}$. How many vertices does the polygon have?`,
          ),
          answer: { kind: 'number', value: `${n}`, label: 'n =' },
          hints: [
            L(
              'Snazší je počítat s vnějším úhlem: vnitřní a vnější dají dohromady $180^{\\circ}$.',
              'The exterior angle is easier to work with: interior and exterior add up to $180^{\\circ}$.',
            ),
            L(
              'Součet vnějších úhlů každého konvexního mnohoúhelníku je $360^{\\circ}$.',
              'The exterior angles of any convex polygon sum to $360^{\\circ}$.',
            ),
          ],
          solution: [
            step(
              'Vnější úhel:',
              'The exterior angle:',
              `180^{\\circ} - ${interior}^{\\circ} = ${180 - interior}^{\\circ}`,
            ),
            step(
              'Vnější úhly dají dohromady $360^{\\circ}$:',
              'The exterior angles add up to $360^{\\circ}$:',
              `n = \\frac{360^{\\circ}}{${180 - interior}^{\\circ}} = ${n}`,
            ),
          ],
          misconceptions: [
            mc(
              `${360 / interior}`,
              'concept',
              'Dělit $360^{\\circ}$ je potřeba vnějším úhlem, ne vnitřním.',
              'Divide $360^{\\circ}$ by the exterior angle, not the interior one.',
            ),
          ],
          verify: [{ kind: 'value', expr: `360/(180-${interior})` }],
        };
      }
      const diagonals = (n * (n - 3)) / 2;
      return {
        prompt: L(
          `Kolik úhlopříček má konvexní ${n}úhelník?`,
          `How many diagonals does a convex polygon with ${n} sides have?`,
        ),
        answer: { kind: 'number', value: `${diagonals}` },
        hints: [
          L(
            `Z jednoho vrcholu vede úhlopříčka do všech vrcholů kromě něj samého a dvou sousedů, tedy do $n - 3$ vrcholů.`,
            `From one vertex a diagonal goes to every vertex except itself and its two neighbours, that is to $n - 3$ vertices.`,
          ),
          L(
            'Když to sečteš přes všechny vrcholy, každou úhlopříčku započítáš dvakrát.',
            'Adding that up over all vertices counts every diagonal twice.',
          ),
        ],
        solution: [
          step(
            `Z každého ${zPrep(n)} ${n} vrcholů ${plural(n - 3, 'vede', 'vedou', 'vede')} ${n - 3} ${plural(n - 3, 'úhlopříčka', 'úhlopříčky', 'úhlopříček')}; každá má dva konce:`,
            `Each of the ${n} vertices sends out ${n - 3} diagonals; each has two ends:`,
            `\\frac{${n} \\cdot (${n} - 3)}{2} = ${diagonals}`,
          ),
        ],
        misconceptions: [
          mc(
            `${n * (n - 3)}`,
            'incomplete',
            'Každá úhlopříčka je započítaná dvakrát — z obou konců.',
            'Every diagonal has been counted twice — once from each end.',
          ),
          mc(
            `${(n * (n - 1)) / 2}`,
            'concept',
            'To je počet všech spojnic vrcholů, tedy i stran. Strany odečti.',
            'That is the number of all segments between vertices, sides included. Subtract the sides.',
          ),
        ],
        verify: [{ kind: 'value', expr: `${n}*(${n}-1)/2-${n}` }],
      };
    },
  }),

  gen({
    id: 'plan.circle.inscribed',
    concept: 'plan.circle',
    kind: 'core',
    levels: [2, 3],
    title: L('Středový a obvodový úhel', 'Central and inscribed angles'),
    tags: ['annual-review'],
    est: (lv) => 60 + 30 * (lv - 2),
    make(r, lv) {
      if (lv === 2) {
        const inscribed = r.int(20, 80);
        const central = 2 * inscribed;
        const askInscribed = r.bool();
        // A and B bound the arc, V lies on the opposite arc.
        const [A, B] = [onCircle(270 - inscribed), onCircle(270 + inscribed)];
        const V = onCircle(r.pick([70, 90, 110]));
        const S: Point = [0, 0];
        return {
          prompt: askInscribed
            ? L(
                `Středový úhel $ASB$ má velikost $${central}^{\\circ}$. Jak velký je obvodový úhel $AVB$ nad týmž obloukem?`,
                `The central angle $ASB$ measures $${central}^{\\circ}$. How large is the inscribed angle $AVB$ on the same arc?`,
              )
            : L(
                `Obvodový úhel $AVB$ má velikost $${inscribed}^{\\circ}$. Jak velký je středový úhel $ASB$ nad týmž obloukem?`,
                `The inscribed angle $AVB$ measures $${inscribed}^{\\circ}$. How large is the central angle $ASB$ on the same arc?`,
              ),
          figure: circleFigure(
            [
              { at: A, label: 'A' },
              { at: B, label: 'B' },
              { at: V, label: 'V' },
              { at: S, label: 'S' },
            ],
            [
              [A, S],
              [S, B],
              [A, V],
              [V, B],
            ],
          ),
          answer: { kind: 'number', value: `${askInscribed ? inscribed : central}`, unit: 'deg' },
          hints: [
            L(
              'Oba úhly „vidí“ stejný oblouk $AB$ — jeden ze středu, druhý z kružnice.',
              'Both angles “see” the same arc $AB$ — one from the centre, the other from the circle.',
            ),
            L('Obvodový úhel je polovina středového.', 'The inscribed angle is half the central angle.'),
          ],
          solution: [
            askInscribed
              ? step(
                  'Obvodový úhel je polovinou středového úhlu nad týmž obloukem:',
                  'An inscribed angle is half the central angle on the same arc:',
                  `|\\angle AVB| = \\frac{${central}^{\\circ}}{2} = ${inscribed}^{\\circ}`,
                )
              : step(
                  'Středový úhel je dvojnásobkem obvodového úhlu nad týmž obloukem:',
                  'The central angle is twice the inscribed angle on the same arc:',
                  `|\\angle ASB| = 2 \\cdot ${inscribed}^{\\circ} = ${central}^{\\circ}`,
                ),
          ],
          misconceptions: askInscribed
            ? [
                mc(
                  `${central * 2}`,
                  'concept',
                  'Obráceně: menší je obvodový úhel, je to polovina středového.',
                  'The other way round: the inscribed angle is the smaller one, half the central angle.',
                ),
                mc(
                  `${central}`,
                  'concept',
                  'Stejně velké jsou obvodové úhly nad týmž obloukem mezi sebou; středový je dvojnásobný.',
                  'Inscribed angles on the same arc equal one another; the central angle is twice as large.',
                ),
              ]
            : [
                mc(
                  `${inscribed / 2}`,
                  'concept',
                  'Obráceně: středový úhel je větší, dvojnásobek obvodového.',
                  'The other way round: the central angle is the larger one, twice the inscribed angle.',
                ),
              ],
          verify: [{ kind: 'value', expr: askInscribed ? `${central}/2` : `2*${inscribed}` }],
        };
      }
      if (r.bool()) {
        // Thales: C on the circle over the diameter AB.
        const alpha = r.int(18, 72);
        const [A, B] = [onCircle(180), onCircle(0)];
        // The inscribed angle CAB is half the central angle over the arc CB.
        const C = onCircle(2 * alpha);
        return {
          prompt: L(
            `Úsečka $AB$ je průměr kružnice a bod $C$ leží na kružnici. Úhel $CAB$ má velikost $${alpha}^{\\circ}$. Určete velikost úhlu $CBA$.`,
            `The segment $AB$ is a diameter of a circle and the point $C$ lies on the circle. The angle $CAB$ measures $${alpha}^{\\circ}$. Find the angle $CBA$.`,
          ),
          figure: circleFigure(
            [
              { at: A, label: 'A' },
              { at: B, label: 'B' },
              { at: C, label: 'C' },
            ],
            [
              [A, B],
              [A, C],
              [C, B],
            ],
          ),
          answer: { kind: 'number', value: `${90 - alpha}`, unit: 'deg' },
          hints: [
            L(
              'Jak velký je úhel $ACB$, když $AB$ je průměr a $C$ leží na kružnici?',
              'How large is the angle $ACB$ when $AB$ is a diameter and $C$ lies on the circle?',
            ),
            L(
              'Thaletova věta: úhel nad průměrem je pravý. Na zbylé dva úhly zbývá $90^{\\circ}$.',
              "Thales' theorem: the angle on a diameter is a right angle. That leaves $90^{\\circ}$ for the other two.",
            ),
          ],
          solution: [
            step(
              'Podle Thaletovy věty je úhel u $C$ pravý:',
              "By Thales' theorem the angle at $C$ is a right angle:",
              '|\\angle ACB| = 90^{\\circ}',
            ),
            step(
              'Zbylé dva úhly se doplňují do $90^{\\circ}$:',
              'The other two angles complete each other to $90^{\\circ}$:',
              `|\\angle CBA| = 90^{\\circ} - ${alpha}^{\\circ} = ${90 - alpha}^{\\circ}`,
            ),
          ],
          misconceptions: [
            mc(
              `${180 - alpha}`,
              'incomplete',
              'Chybí pravý úhel u vrcholu $C$ (Thaletova věta).',
              "The right angle at $C$ (Thales' theorem) is missing.",
            ),
            mc(
              `${alpha}`,
              'concept',
              'Trojúhelník nemusí být rovnoramenný. Jisté je jen to, že úhel u $C$ je pravý.',
              'The triangle need not be isosceles. All that is certain is the right angle at $C$.',
            ),
          ],
          verify: [{ kind: 'value', expr: `180-90-${alpha}` }],
        };
      }
      // A cyclic quadrilateral: opposite angles are supplementary.
      const alpha = r.int(55, 125);
      // B and D bound an arc of 2α that does not contain A, so the angle at A really is α.
      const quad = [onCircle(200), onCircle(20 - alpha), onCircle(20 + 0.15 * alpha), onCircle(20 + alpha)];
      return {
        prompt: L(
          `Čtyřúhelník $ABCD$ je vepsán do kružnice (všechny vrcholy leží na ní). Úhel u vrcholu $A$ má velikost $${alpha}^{\\circ}$. Určete velikost úhlu u protějšího vrcholu $C$.`,
          `The quadrilateral $ABCD$ is inscribed in a circle (all its vertices lie on it). The angle at vertex $A$ measures $${alpha}^{\\circ}$. Find the angle at the opposite vertex $C$.`,
        ),
        figure: circleFigure(
          quad.map((at, index) => ({ at, label: 'ABCD'[index]! })),
          quad.map((at, index) => [at, quad[(index + 1) % 4]!] as [Point, Point]),
        ),
        answer: { kind: 'number', value: `${180 - alpha}`, unit: 'deg' },
        hints: [
          L(
            'Úhly u $A$ a $C$ jsou obvodové úhly nad dvěma oblouky $BD$, které dohromady tvoří celou kružnici.',
            'The angles at $A$ and $C$ are inscribed angles on the two arcs $BD$ that together make the whole circle.',
          ),
          L(
            'Jejich středové úhly dají dohromady $360^{\\circ}$, obvodové tedy polovinu.',
            'Their central angles add up to $360^{\\circ}$, so the inscribed ones add up to half of that.',
          ),
        ],
        solution: [
          step(
            'Protější úhly tětivového čtyřúhelníku se doplňují do $180^{\\circ}$:',
            'Opposite angles of a cyclic quadrilateral are supplementary:',
            `|\\angle C| = 180^{\\circ} - ${alpha}^{\\circ} = ${180 - alpha}^{\\circ}`,
          ),
        ],
        misconceptions: [
          mc(
            `${alpha}`,
            'concept',
            'Protější úhly stejné být nemusí (to platí pro rovnoběžník). U tětivového čtyřúhelníku se doplňují do $180^{\\circ}$.',
            'Opposite angles need not be equal (that holds for a parallelogram). In a cyclic quadrilateral they add up to $180^{\\circ}$.',
          ),
          mc(
            `${360 - alpha}`,
            'incomplete',
            'Do $360^{\\circ}$ se doplňují středové úhly. Obvodové jsou poloviční.',
            'It is the central angles that add up to $360^{\\circ}$. The inscribed ones are half as large.',
          ),
        ],
        verify: [{ kind: 'value', expr: `(360-2*${alpha})/2` }],
      };
    },
  }),

  gen({
    id: 'plan.circle.arc',
    concept: 'plan.circle',
    kind: 'core',
    levels: [2, 3],
    title: L('Délka oblouku a obsah výseče', 'Arc length and sector area'),
    est: (lv) => 70 + 25 * (lv - 2),
    make(r, lv) {
      const radius = r.pick([2, 3, 4, 6, 8, 9, 10, 12]);
      const deg = r.pick([30, 45, 60, 90, 120, 135, 150, 240, 270]);
      const part = frac(deg, 360);
      const arc = fMul(frac(2 * radius), part);
      const area = fMul(frac(radius * radius), part);
      const wantArea = lv === 3 ? r.bool(0.6) : r.bool(0.4);
      const value = wantArea ? area : arc;
      const other = wantArea ? arc : area;
      return {
        prompt: wantArea
          ? L(
              `Kruhová výseč má poloměr $r = ${radius}$ cm a středový úhel $${deg}^{\\circ}$. Určete její obsah (přesně, pomocí $\\pi$).`,
              `A circular sector has radius $r = ${radius}$ cm and central angle $${deg}^{\\circ}$. Find its area (exactly, in terms of $\\pi$).`,
            )
          : L(
              `Oblouk kružnice o poloměru $r = ${radius}$ cm přísluší středovému úhlu $${deg}^{\\circ}$. Určete jeho délku (přesně, pomocí $\\pi$).`,
              `An arc of a circle of radius $r = ${radius}$ cm belongs to a central angle of $${deg}^{\\circ}$. Find its length (exactly, in terms of $\\pi$).`,
            ),
        answer: { kind: 'number', value: piIn(value), label: wantArea ? 'S =' : 'l =', placeholder: '3pi' },
        hints: [
          L(
            `Jakou částí celého kruhu je výseč s úhlem $${deg}^{\\circ}$?`,
            `What fraction of the full circle is a sector of angle $${deg}^{\\circ}$?`,
          ),
          wantArea
            ? L(
                `Je to $\\frac{${deg}}{360} = ${fToTex(part)}$ kruhu, jehož obsah je $\\pi r^2$.`,
                `It is $\\frac{${deg}}{360} = ${fToTex(part)}$ of the circle, whose area is $\\pi r^2$.`,
              )
            : L(
                `Je to $\\frac{${deg}}{360} = ${fToTex(part)}$ kružnice, jejíž délka je $2\\pi r$.`,
                `It is $\\frac{${deg}}{360} = ${fToTex(part)}$ of the circle, whose circumference is $2\\pi r$.`,
              ),
        ],
        solution: [
          step(
            'Podíl z celého kruhu:',
            'The share of the full circle:',
            `\\frac{${deg}^{\\circ}}{360^{\\circ}} = ${fToTex(part)}`,
          ),
          wantArea
            ? step(
                'Stejný podíl z obsahu kruhu:',
                'The same share of the area of the circle:',
                `S = ${fToTex(part)} \\cdot \\pi \\cdot ${radius}^2 = ${piTex(area)}\\ \\text{cm}^2`,
              )
            : step(
                'Stejný podíl z délky kružnice:',
                'The same share of the circumference:',
                `l = ${fToTex(part)} \\cdot 2\\pi \\cdot ${radius} = ${piTex(arc)}\\ \\text{cm}`,
              ),
        ],
        misconceptions: [
          mc(
            piIn(other),
            'formula',
            wantArea
              ? 'To je délka oblouku. Obsah se počítá z $\\pi r^2$.'
              : 'To je obsah výseče. Délka oblouku se počítá z $2\\pi r$.',
            wantArea
              ? 'That is the arc length. The area comes from $\\pi r^2$.'
              : 'That is the area of the sector. The arc length comes from $2\\pi r$.',
          ),
          mc(
            piIn(wantArea ? frac(radius * radius) : frac(2 * radius)),
            'incomplete',
            'To je celý kruh. Výseč je jen jeho část.',
            'That is the whole circle. The sector is only a part of it.',
          ),
          mc(fToInput(value), 'notation', 'Chybí $\\pi$.', '$\\pi$ is missing.'),
          ...(wantArea
            ? [
                mc(
                  piIn(fMul(frac(2 * radius * 2 * radius), part)),
                  'misread',
                  'Do vzorce patří poloměr, ne průměr.',
                  'The formula takes the radius, not the diameter.',
                ),
              ]
            : []),
        ],
        verify: [{ kind: 'value', expr: wantArea ? `pi*${radius}^2*${deg}/360` : `2*pi*${radius}*${deg}/360` }],
      };
    },
  }),

  gen({
    id: 'plan.similarity.ratio',
    concept: 'plan.similarity',
    kind: 'core',
    levels: [2, 3],
    title: L('Poměr podobnosti', 'The scale factor'),
    tags: ['annual-review'],
    est: (lv) => 70 + 30 * (lv - 2),
    make(r, lv) {
      const k = r.pick([frac(3, 2), frac(2), frac(5, 2), frac(3), frac(1, 2), frac(2, 3), frac(4, 3), frac(5, 4)]);
      if (lv === 2) {
        const [a, b, c] = r.pick([
          [6, 8, 10],
          [4, 6, 8],
          [8, 12, 16],
          [6, 9, 12],
          [12, 16, 20],
          [8, 10, 12],
        ] as const);
        const image = (side: number): string => fToTex(fMul(frac(side), k));
        const target = fMul(frac(b), k);
        return {
          prompt: L(
            `Trojúhelníky $ABC$ a $A'B'C'$ jsou podobné. V trojúhelníku $ABC$ je $a = ${a}$, $b = ${b}$, $c = ${c}$ a v trojúhelníku $A'B'C'$ je $a' = ${image(a)}$. Určete $b'$.`,
            `Triangles $ABC$ and $A'B'C'$ are similar. In triangle $ABC$, $a = ${a}$, $b = ${b}$, $c = ${c}$, and in triangle $A'B'C'$, $a' = ${image(a)}$. Find $b'$.`,
          ),
          answer: { kind: 'number', value: fToInput(target), label: "b' =" },
          hints: [
            L(
              "Podobné trojúhelníky mají stejný poměr odpovídajících si stran: $\\dfrac{a'}{a} = \\dfrac{b'}{b}$.",
              "Similar triangles have the same ratio of corresponding sides: $\\dfrac{a'}{a} = \\dfrac{b'}{b}$.",
            ),
            L(
              `Poměr podobnosti je $k = \\dfrac{a'}{a} = ${fToTex(k)}$.`,
              `The scale factor is $k = \\dfrac{a'}{a} = ${fToTex(k)}$.`,
            ),
          ],
          solution: [
            step(
              'Poměr podobnosti ze známé dvojice stran:',
              'The scale factor from the known pair of sides:',
              `k = \\frac{a'}{a} = \\frac{${image(a)}}{${a}} = ${fToTex(k)}`,
            ),
            step(
              'Každá strana se násobí stejným číslem:',
              'Every side is multiplied by the same number:',
              `b' = k \\cdot b = ${fToTex(k)} \\cdot ${b} = ${fToTex(target)}`,
            ),
          ],
          misconceptions: [
            mc(
              fToInput(fMul(frac(b), frac(k.d, k.n))),
              'formula',
              "Poměr je obráceně: $k = \\frac{a'}{a}$, a tímtéž $k$ se násobí $b$.",
              "The ratio is upside down: $k = \\frac{a'}{a}$, and $b$ is multiplied by that same $k$.",
            ),
            mc(
              fToInput(frac(b * k.d + (a * k.n - a * k.d), k.d)),
              'concept',
              'Podobnost strany násobí, nepřičítá: rozdíl délek se nezachovává, poměr ano.',
              'Similarity multiplies sides; it does not add: differences of lengths are not preserved, ratios are.',
            ),
            mc(
              fToInput(fMul(frac(c), k)),
              'misread',
              "To je $c'$. Ptali se na $b'$.",
              "That is $c'$. The question asks for $b'$.",
            ),
          ],
          verify: [{ kind: 'value', expr: `${b}*(${fToInput(fMul(frac(a), k))})/${a}` }],
        };
      }
      if (r.bool()) {
        const area = r.pick([8, 12, 16, 20, 36]);
        const scaled = fMul(frac(area), fMul(k, k));
        return {
          prompt: L(
            `Dva podobné trojúhelníky mají poměr podobnosti $k = ${fToTex(k)}$ (strany druhého jsou $k$krát delší než strany prvního). První má obsah $${area}$ cm². Jaký obsah má druhý?`,
            `Two similar triangles have scale factor $k = ${fToTex(k)}$ (the sides of the second are $k$ times those of the first). The first has area $${area}$ cm². What is the area of the second?`,
          ),
          answer: { kind: 'number', value: fToInput(scaled), label: "S' =", placeholder: 'cm²' },
          hints: [
            L(
              'Obsah závisí na dvou délkách (například na základně a výšce). Co se stane, když se obě vynásobí $k$?',
              'Area depends on two lengths (say base and height). What happens when both are multiplied by $k$?',
            ),
            L('Obsahy podobných útvarů jsou v poměru $k^2$.', 'Areas of similar figures are in the ratio $k^2$.'),
          ],
          solution: [
            step(
              'Obsah se násobí druhou mocninou poměru podobnosti:',
              'The area is multiplied by the square of the scale factor:',
              `S' = k^2 \\cdot S = \\left(${fToTex(k)}\\right)^2 \\cdot ${area} = ${fToTex(scaled)}\\ \\text{cm}^2`,
            ),
            step(
              'Stejně se chová obraz na monitoru: dvakrát širší a dvakrát vyšší obrázek má čtyřikrát víc pixelů.',
              'An image on a screen behaves the same way: twice as wide and twice as tall means four times the pixels.',
            ),
          ],
          misconceptions: [
            mc(
              fToInput(fMul(frac(area), k)),
              'concept',
              'Číslem $k$ se násobí délky. Obsah se násobí $k^2$.',
              'Lengths are multiplied by $k$. Area is multiplied by $k^2$.',
            ),
            mc(
              fToInput(fMul(frac(area), frac(k.d * k.d, k.n * k.n))),
              'formula',
              'Poměr je obráceně: druhý trojúhelník má strany $k$krát delší.',
              'The ratio is upside down: the second triangle has sides $k$ times as long.',
            ),
          ],
          verify: [{ kind: 'value', expr: `${area}*(${fToInput(k)})^2` }],
        };
      }
      // The shadow problem: two right triangles with the same angle of the sun.
      // Tenths of a metre multiply cleanly once the float noise is rounded away.
      const clean = (value: number): number => Math.round(value * 1000) / 1000;
      const stick = r.pick([1, 2, 1.5]);
      const ratio = r.pick([1.5, 2, 2.5, 0.8, 1.2]);
      const height = r.pick([6, 8, 9, 12, 15, 18]);
      const stickShadow = clean(stick * ratio);
      const treeShadow = clean(height * ratio);
      const show = (value: number): L => L(String(value).replace('.', '{,}'), String(value));
      const proportion = L(
        `\\frac{h}{${show(treeShadow).cs}} = \\frac{${show(stick).cs}}{${show(stickShadow).cs}}`,
        `\\frac{h}{${show(treeShadow).en}} = \\frac{${show(stick).en}}{${show(stickShadow).en}}`,
      );
      const solved = L(
        `h = \\frac{${show(stick).cs} \\cdot ${show(treeShadow).cs}}{${show(stickShadow).cs}} = ${height}\\ \\text{m}`,
        `h = \\frac{${show(stick).en} \\cdot ${show(treeShadow).en}}{${show(stickShadow).en}} = ${height}\\ \\text{m}`,
      );
      return {
        prompt: L(
          `Tyč vysoká $${show(stick).cs}$ m vrhá stín dlouhý $${show(stickShadow).cs}$ m. Strom vrhá ve stejnou chvíli stín dlouhý $${show(treeShadow).cs}$ m. Jak vysoký je strom?`,
          `A pole $${show(stick).en}$ m tall casts a shadow $${show(stickShadow).en}$ m long. At the same moment a tree casts a shadow $${show(treeShadow).en}$ m long. How tall is the tree?`,
        ),
        context: { applied: true },
        answer: { kind: 'number', value: `${height}`, placeholder: 'm' },
        hints: [
          L(
            'Sluneční paprsky dopadají pod stejným úhlem, takže tyč se stínem a strom se stínem tvoří podobné pravoúhlé trojúhelníky.',
            "The sun's rays arrive at the same angle, so the pole with its shadow and the tree with its shadow form similar right triangles.",
          ),
          L('Poměr výšky ke stínu je u obou stejný.', 'The ratio of height to shadow is the same for both.'),
        ],
        solution: [
          step('Poměr výšky a stínu je stejný:', 'The ratio of height to shadow is the same:', proportion),
          step('Vyjádříme výšku:', 'Solve for the height:', solved),
        ],
        misconceptions: [
          mc(
            `${clean(treeShadow * ratio)}`,
            'formula',
            'Poměr je obráceně: stín se dělí, nenásobí.',
            'The ratio is upside down: divide the shadow, do not multiply it.',
          ),
          mc(
            `${clean(treeShadow - stickShadow + stick)}`,
            'concept',
            'Podobnost zachovává poměry, ne rozdíly.',
            'Similarity preserves ratios, not differences.',
          ),
        ],
        verify: [{ kind: 'value', expr: `${stick}*${treeShadow}/${stickShadow}` }],
      };
    },
  }),

  gen({
    id: 'plan.area.shapes',
    concept: 'plan.area',
    kind: 'core',
    levels: [1, 2, 3],
    title: L('Obsahy rovinných útvarů', 'Areas of plane figures'),
    tags: ['annual-review'],
    est: (lv) => 45 + 30 * lv,
    make(r, lv) {
      if (lv === 1) {
        const shape = r.pick(['triangle', 'trapezoid', 'parallelogram'] as const);
        const a = 2 * r.int(2, 9);
        const v = r.int(3, 12);
        if (shape === 'triangle') {
          return {
            prompt: L(
              `Trojúhelník má stranu $a = ${a}$ cm a výšku na tuto stranu $v_a = ${v}$ cm. Určete jeho obsah.`,
              `A triangle has a side $a = ${a}$ cm and the height onto that side $v_a = ${v}$ cm. Find its area.`,
            ),
            answer: { kind: 'number', value: `${(a * v) / 2}`, label: 'S =', placeholder: 'cm²' },
            hints: [
              L(
                'Trojúhelník je polovina rovnoběžníku se stejnou základnou a výškou.',
                'A triangle is half of a parallelogram with the same base and height.',
              ),
              L('$S = \\dfrac{a \\cdot v_a}{2}$', '$S = \\dfrac{a \\cdot v_a}{2}$'),
            ],
            solution: [
              step(
                'Polovina součinu strany a příslušné výšky:',
                'Half the product of a side and its height:',
                `S = \\frac{${a} \\cdot ${v}}{2} = ${(a * v) / 2}\\ \\text{cm}^2`,
              ),
            ],
            misconceptions: [
              mc(
                `${a * v}`,
                'formula',
                'Chybí polovina: $a \\cdot v_a$ je obsah rovnoběžníku.',
                'The half is missing: $a \\cdot v_a$ is the area of the parallelogram.',
              ),
            ],
            verify: [{ kind: 'value', expr: `${a}*${v}/2` }],
          };
        }
        if (shape === 'parallelogram') {
          const side = v + r.int(1, 4);
          return {
            prompt: L(
              `Rovnoběžník má strany $a = ${a}$ cm a $b = ${side}$ cm; výška na stranu $a$ je $v_a = ${v}$ cm. Určete jeho obsah.`,
              `A parallelogram has sides $a = ${a}$ cm and $b = ${side}$ cm; the height onto side $a$ is $v_a = ${v}$ cm. Find its area.`,
            ),
            answer: { kind: 'number', value: `${a * v}`, label: 'S =', placeholder: 'cm²' },
            hints: [
              L(
                'Odřízni trojúhelník z jedné strany a přilož ho na druhou: vznikne obdélník.',
                'Cut a triangle off one end and attach it to the other: a rectangle appears.',
              ),
              L(
                '$S = a \\cdot v_a$ — strana krát výška na ni, ne krát druhá strana.',
                '$S = a \\cdot v_a$ — a side times the height onto it, not times the other side.',
              ),
            ],
            solution: [
              step(
                'Strana krát příslušná výška:',
                'A side times its height:',
                `S = ${a} \\cdot ${v} = ${a * v}\\ \\text{cm}^2`,
              ),
            ],
            misconceptions: [
              mc(
                `${a * side}`,
                'formula',
                'Součin dvou stran je obsah jen u obdélníku. U rovnoběžníku je potřeba výška.',
                'The product of two sides is the area only for a rectangle. A parallelogram needs the height.',
              ),
              mc(
                `${(a * v) / 2}`,
                'formula',
                'Polovina patří k trojúhelníku, ne k rovnoběžníku.',
                'The half belongs to the triangle, not the parallelogram.',
              ),
            ],
            verify: [{ kind: 'value', expr: `${a}*${v}` }],
          };
        }
        const c = a - 2 * r.int(1, Math.max(1, a / 2 - 1));
        return {
          prompt: L(
            `Lichoběžník má základny $a = ${a}$ cm a $c = ${c}$ cm a výšku $v = ${v}$ cm. Určete jeho obsah.`,
            `A trapezoid has bases $a = ${a}$ cm and $c = ${c}$ cm and height $v = ${v}$ cm. Find its area.`,
          ),
          answer: { kind: 'number', value: `${((a + c) * v) / 2}`, label: 'S =', placeholder: 'cm²' },
          hints: [
            L(
              'Lichoběžník má stejný obsah jako obdélník, jehož strana je průměrem obou základen.',
              'A trapezoid has the same area as a rectangle whose side is the average of the two bases.',
            ),
            L('$S = \\dfrac{(a + c) \\cdot v}{2}$', '$S = \\dfrac{(a + c) \\cdot v}{2}$'),
          ],
          solution: [
            step(
              'Průměr základen krát výška:',
              'The average of the bases times the height:',
              `S = \\frac{(${a} + ${c}) \\cdot ${v}}{2} = ${((a + c) * v) / 2}\\ \\text{cm}^2`,
            ),
          ],
          misconceptions: [
            mc(`${(a + c) * v}`, 'formula', 'Chybí polovina.', 'The half is missing.'),
            mc(`${a * c * v}`, 'formula', 'Základny se sčítají, nenásobí.', 'The bases are added, not multiplied.'),
          ],
          verify: [{ kind: 'value', expr: `(${a}+${c})*${v}/2` }],
        };
      }
      if (lv === 2) {
        if (r.bool()) {
          const e = 2 * r.int(3, 9);
          const f = 2 * r.int(2, 7);
          return {
            prompt: L(
              `Kosočtverec má úhlopříčky $e = ${e}$ cm a $f = ${f}$ cm. Určete jeho obsah.`,
              `A rhombus has diagonals $e = ${e}$ cm and $f = ${f}$ cm. Find its area.`,
            ),
            answer: { kind: 'number', value: `${(e * f) / 2}`, label: 'S =', placeholder: 'cm²' },
            hints: [
              L(
                'Úhlopříčky kosočtverce jsou na sebe kolmé a půlí se: rozdělí ho na čtyři shodné pravoúhlé trojúhelníky.',
                'The diagonals of a rhombus are perpendicular and bisect each other: they cut it into four congruent right triangles.',
              ),
              L('$S = \\dfrac{e \\cdot f}{2}$', '$S = \\dfrac{e \\cdot f}{2}$'),
            ],
            solution: [
              step(
                'Čtyři pravoúhlé trojúhelníky s odvěsnami $\\frac{e}{2}$ a $\\frac{f}{2}$:',
                'Four right triangles with legs $\\frac{e}{2}$ and $\\frac{f}{2}$:',
                `S = 4 \\cdot \\frac{1}{2} \\cdot ${e / 2} \\cdot ${f / 2} = \\frac{${e} \\cdot ${f}}{2} = ${(e * f) / 2}\\ \\text{cm}^2`,
              ),
            ],
            misconceptions: [
              mc(
                `${e * f}`,
                'formula',
                'Součin úhlopříček je obsah opsaného obdélníku — kosočtverec je jeho polovina.',
                'The product of the diagonals is the area of the surrounding rectangle — the rhombus is half of it.',
              ),
              mc(
                `${(e * f) / 4}`,
                'formula',
                'Polovina, ne čtvrtina: trojúhelníky jsou čtyři.',
                'Half, not a quarter: there are four triangles.',
              ),
            ],
            verify: [{ kind: 'value', expr: `4*(1/2)*(${e}/2)*(${f}/2)` }],
          };
        }
        // A right triangle given by its hypotenuse and one leg.
        const [p, q, h] = r.pick([
          [3, 4, 5],
          [6, 8, 10],
          [5, 12, 13],
          [8, 15, 17],
          [9, 12, 15],
          [7, 24, 25],
        ] as const);
        return {
          prompt: L(
            `Pravoúhlý trojúhelník má přeponu $${h}$ cm a jednu odvěsnu $${p}$ cm. Určete jeho obsah.`,
            `A right triangle has hypotenuse $${h}$ cm and one leg $${p}$ cm. Find its area.`,
          ),
          answer: { kind: 'number', value: `${(p * q) / 2}`, label: 'S =', placeholder: 'cm²' },
          hints: [
            L(
              'K obsahu potřebuješ obě odvěsny — jsou na sebe kolmé, takže jedna je výškou na druhou.',
              'For the area you need both legs — they are perpendicular, so one is the height onto the other.',
            ),
            L('Druhou odvěsnu dopočítej Pythagorovou větou.', "Find the other leg with Pythagoras' theorem."),
          ],
          solution: [
            step(
              'Druhá odvěsna:',
              'The other leg:',
              `\\sqrt{${h}^2 - ${p}^2} = \\sqrt{${h * h - p * p}} = ${q}\\ \\text{cm}`,
            ),
            step(
              'Polovina součinu odvěsen:',
              'Half the product of the legs:',
              `S = \\frac{${p} \\cdot ${q}}{2} = ${(p * q) / 2}\\ \\text{cm}^2`,
            ),
          ],
          misconceptions: [
            mc(
              `${(p * h) / 2}`,
              'concept',
              'Přepona není kolmá na odvěsnu, takže to není dvojice „strana a výška“.',
              'The hypotenuse is not perpendicular to the leg, so they are not a “side and height” pair.',
            ),
            mc(`${p * q}`, 'formula', 'Chybí polovina.', 'The half is missing.'),
          ],
          verify: [{ kind: 'value', expr: `${p}*sqrt(${h}^2-${p}^2)/2` }],
        };
      }
      const [a, b, c, area] = r.pick(HERON);
      const s = (a + b + c) / 2;
      const t = triangleSSS(a, b, c);
      agree(area, (t.c * t.C[1]) / 2, "Heron's formula");
      return {
        prompt: L(
          `Trojúhelník má strany $${a}$ cm, $${b}$ cm a $${c}$ cm. Určete jeho obsah.`,
          `A triangle has sides $${a}$ cm, $${b}$ cm and $${c}$ cm. Find its area.`,
        ),
        figure: triangleFigure(t, { sides: { a: `${a}`, b: `${b}`, c: `${c}` } }),
        answer: { kind: 'number', value: `${area}`, label: 'S =', placeholder: 'cm²' },
        hints: [
          L(
            'Žádná výška ani úhel zadány nejsou. Obsah ze tří stran dává Heronův vzorec.',
            "No height or angle is given. Heron's formula gives the area from three sides.",
          ),
          L(
            '$S = \\sqrt{s(s - a)(s - b)(s - c)}$, kde $s$ je polovina obvodu.',
            '$S = \\sqrt{s(s - a)(s - b)(s - c)}$, where $s$ is half the perimeter.',
          ),
        ],
        solution: [
          step('Polovina obvodu:', 'Half the perimeter:', `s = \\frac{${a} + ${b} + ${c}}{2} = ${s}`),
          step(
            'Heronův vzorec:',
            "Heron's formula:",
            `S = \\sqrt{${s} \\cdot ${s - a} \\cdot ${s - b} \\cdot ${s - c}} = \\sqrt{${s * (s - a) * (s - b) * (s - c)}} = ${area}\\ \\text{cm}^2`,
          ),
        ],
        misconceptions: [
          mc(
            `${s * (s - a) * (s - b) * (s - c)}`,
            'incomplete',
            'To je číslo pod odmocninou. Ještě odmocnit.',
            'That is the number under the root. Take the square root.',
          ),
          mc(
            `sqrt(${a + b + c}*${b + c}*${a + c}*${a + b})`,
            'formula',
            'Do vzorce patří polovina obvodu $s$, ne celý obvod.',
            'The formula uses half the perimeter $s$, not the whole perimeter.',
          ),
          mc(
            `${(a * b) / 2}`,
            'concept',
            'Polovina součinu dvou stran je obsah jen tehdy, když jsou na sebe kolmé.',
            'Half the product of two sides is the area only when they are perpendicular.',
          ),
        ],
        verify: [{ kind: 'value', expr: `${(t.c * t.C[1]) / 2}` }],
      };
    },
  }),
];
