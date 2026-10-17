import {
  L,
  fAdd,
  fDiv,
  fMul,
  fSub,
  fToInput,
  frac,
  intervalIn,
  intervalL,
  polyTex,
  type Frac,
  type Generator,
  type SolutionStep,
} from '@lemma/core';
import { gen, mapL, mc, step } from './helpers';
import {
  CO,
  FN_WORD,
  QUADRANT_IN,
  STANDARD_DEGREES,
  TURN,
  angleSetL,
  chainL,
  degTex,
  evalFn,
  exact,
  fnL,
  fromDeg,
  near,
  piIn,
  piTex,
  quadrant,
  referenceDeg,
  signQuadrants,
  solveOnTurn,
  type Fn,
} from './trig-kit';

/** A negative angle needs brackets after a function name: sin(−π/3). */
const arg = (angle: string): string => (angle.startsWith('-') ? `\\left(${angle}\\right)` : angle);

const capital = (word: string): string => `${word[0]!.toUpperCase()}${word.slice(1)}`;

/** Flip the sign of a parser-input value such as "sqrt(3)/2" or "-1/2". */
const negIn = (input: string): string => (input.startsWith('-') ? input.slice(1) : `-${input}`);

/** A·f(Bx): the coefficient, the function and the argument the way they are written. */
function waveTex(a: Frac, fn: 'sin' | 'cos' | 'tan', b: Frac, name = `\\${fn}`): string {
  const lead =
    a.d === 1
      ? a.n === 1
        ? ''
        : a.n === -1
          ? '-'
          : `${a.n}`
      : `${a.n < 0 ? '-' : ''}\\frac{${Math.abs(a.n)}}{${a.d}}`;
  const inner = b.d === 1 ? (b.n === 1 ? 'x' : `${b.n}x`) : b.n === 1 ? `\\frac{x}{${b.d}}` : `\\frac{${b.n}x}{${b.d}}`;
  return `${lead}${name} ${inner}`;
}

const waveIn = (a: Frac, fn: 'sin' | 'cos' | 'tan', b: Frac): string => `(${a.n}/${a.d})*${fn}((${b.n}/${b.d})*x)`;

/** A sum of terms with integer coefficients, written the usual way: 2sin²x − sin x − 1. */
function sumTex(terms: readonly { c: number; tex: string }[]): string {
  let out = '';
  for (const { c, tex } of terms) {
    if (c === 0) continue;
    const size = Math.abs(c);
    const body = tex === '' ? `${size}` : `${size === 1 ? '' : size}${tex}`;
    out += out === '' ? `${c < 0 ? '-' : ''}${body}` : ` ${c < 0 ? '-' : '+'} ${body}`;
  }
  return out === '' ? '0' : out;
}

/** Syllabus topic 11 (trigonometric functions) and topic 12 (trigonometric equations). */
export const TRIG_GENERATORS: Generator[] = [
  gen({
    id: 'trig.radians.convert',
    concept: 'trig.radians',
    kind: 'warmup',
    levels: [1, 2],
    title: L('Stupně a radiány', 'Degrees and radians'),
    tags: ['annual-review'],
    est: 35,
    make(r, lv) {
      const deg =
        lv === 1
          ? r.pick([30, 45, 60, 90, 120, 135, 150, 180, 210, 225, 240, 270, 300, 315, 330, 360])
          : r.pick([15, 18, 20, 36, 40, 72, 75, 100, 105, 108, 144, 160, 200, 320, 450, 540, -45, -120, -270]);
      const m = fromDeg(deg);
      if (r.bool()) {
        return {
          prompt: L(
            `Převeďte na radiány (jako násobek $\\pi$): $${degTex(deg)}$`,
            `Convert to radians (as a multiple of $\\pi$): $${degTex(deg)}$`,
          ),
          answer: { kind: 'number', value: piIn(m), unit: 'rad', label: `${degTex(deg)} =`, placeholder: 'pi/6' },
          hints: [
            L(
              'Půl otáčky je $180^{\\circ}$ i $\\pi$ radiánů.',
              'Half a turn is both $180^{\\circ}$ and $\\pi$ radians.',
            ),
            L(
              'Vynásob $\\dfrac{\\pi}{180}$ a zlomek zkrať.',
              'Multiply by $\\dfrac{\\pi}{180}$ and reduce the fraction.',
            ),
          ],
          solution: [
            step(
              'Stupně násobíme $\\frac{\\pi}{180}$ a krátíme:',
              'Multiply the degrees by $\\frac{\\pi}{180}$ and reduce:',
              `${degTex(deg)} = ${deg < 0 ? `(${deg})` : deg} \\cdot \\frac{\\pi}{180} = ${piTex(m)}`,
            ),
          ],
          misconceptions: [
            mc(
              `${deg}*pi`,
              'formula',
              'Chybí dělení 180: úhlu $180^{\\circ}$ odpovídá $\\pi$, ne $180\\pi$.',
              'The division by 180 is missing: $180^{\\circ}$ corresponds to $\\pi$, not $180\\pi$.',
            ),
            mc(
              `${deg}/180`,
              'incomplete',
              'Zlomek je správně, ale chybí v něm $\\pi$.',
              'The fraction is right, but $\\pi$ is missing from it.',
            ),
            mc(
              piIn(frac(deg, 360)),
              'formula',
              'Celá otáčka je $2\\pi$, takže $\\pi$ odpovídá $180^{\\circ}$, ne $360^{\\circ}$.',
              'A full turn is $2\\pi$, so $\\pi$ corresponds to $180^{\\circ}$, not $360^{\\circ}$.',
            ),
          ],
          verify: [{ kind: 'value', expr: `(${deg})*pi/180` }],
        };
      }
      return {
        prompt: L(`Převeďte na stupně: $${piTex(m)}$`, `Convert to degrees: $${piTex(m)}$`),
        answer: { kind: 'number', value: `${deg}`, unit: 'deg', label: `${piTex(m)} =`, placeholder: '30°' },
        hints: [
          L('$\\pi$ radiánů je $180^{\\circ}$.', '$\\pi$ radians is $180^{\\circ}$.'),
          L('Za $\\pi$ dosaď $180^{\\circ}$ a dopočítej.', 'Replace $\\pi$ by $180^{\\circ}$ and compute.'),
        ],
        solution: [
          step(
            'Za $\\pi$ dosadíme $180^{\\circ}$:',
            'Replace $\\pi$ by $180^{\\circ}$:',
            `${piTex(m)} = ${m.d === 1 ? `${m.n} \\cdot 180^{\\circ}` : `\\frac{${m.n} \\cdot 180^{\\circ}}{${m.d}}`} = ${degTex(deg)}`,
          ),
        ],
        misconceptions: [
          mc(
            `${deg * 2}`,
            'formula',
            '$\\pi$ je půl otáčky, tedy $180^{\\circ}$ — ne $360^{\\circ}$.',
            '$\\pi$ is half a turn, that is $180^{\\circ}$ — not $360^{\\circ}$.',
          ),
        ],
        verify: [{ kind: 'value', expr: `(${piIn(m)})*180/pi` }],
      };
    },
  }),

  gen({
    id: 'trig.radians.reduce',
    concept: 'trig.radians',
    kind: 'core',
    levels: [1, 2, 3],
    title: L('Základní velikost úhlu', 'The basic size of an angle'),
    est: (lv) => 40 + 15 * lv,
    make(r, lv) {
      if (lv === 1) {
        const basic = r.pick([20, 30, 45, 60, 75, 100, 120, 135, 150, 200, 210, 240, 250, 300, 315, 330]);
        const turns = r.pick([1, 2, 3, -1, -2]);
        const deg = basic + 360 * turns;
        return {
          prompt: L(
            `Určete základní velikost úhlu $${degTex(deg)}$ (tedy úhel z intervalu $\\langle 0^{\\circ};\\,360^{\\circ})$ se stejným koncovým ramenem).`,
            `Find the basic size of the angle $${degTex(deg)}$ (the angle in $[0^{\\circ},\\,360^{\\circ})$ with the same terminal side).`,
          ),
          answer: { kind: 'number', value: `${basic}`, unit: 'deg' },
          hints: [
            L(
              'Celá otáčka ($360^{\\circ}$) koncové rameno nezmění.',
              'A full turn ($360^{\\circ}$) does not change the terminal side.',
            ),
            turns > 0
              ? L(
                  'Odečítej $360^{\\circ}$, dokud nejsi pod $360^{\\circ}$.',
                  'Subtract $360^{\\circ}$ until you are below $360^{\\circ}$.',
                )
              : L(
                  'Přičítej $360^{\\circ}$, dokud nejsi v kladných číslech.',
                  'Add $360^{\\circ}$ until the angle is no longer negative.',
                ),
          ],
          solution: [
            step(
              turns > 0 ? 'Odečteme celé otáčky:' : 'Přičteme celé otáčky:',
              turns > 0 ? 'Subtract whole turns:' : 'Add whole turns:',
              `${degTex(deg)} ${turns > 0 ? '-' : '+'} ${Math.abs(turns) === 1 ? '' : `${Math.abs(turns)} \\cdot `}360^{\\circ} = ${degTex(basic)}`,
            ),
          ],
          misconceptions: [
            ...(deg < 0
              ? [
                  mc(
                    `${Math.abs(deg) % 360}`,
                    'sign',
                    'Záporný úhel se otáčí opačným směrem: nestačí vynechat znaménko, je potřeba přičíst otáčky.',
                    'A negative angle turns the other way: dropping the sign is not enough; add whole turns.',
                  ),
                ]
              : []),
            ...(turns > 1
              ? [
                  mc(
                    `${deg - 360}`,
                    'incomplete',
                    'Pořád je to víc než $360^{\\circ}$ — odečti ještě jednu otáčku.',
                    'That is still more than $360^{\\circ}$ — subtract another turn.',
                  ),
                ]
              : []),
          ],
          verify: [{ kind: 'value', expr: `${deg}-(${turns})*360` }],
        };
      }
      const d = r.pick(lv === 2 ? [2, 3, 4, 6] : [3, 4, 6]);
      const n = r.pick(Array.from({ length: 2 * d - 1 }, (_, i) => i + 1).filter((k) => frac(k, d).d === d));
      const basic = frac(n, d);
      const turns = lv === 2 ? r.pick([1, 2]) : r.pick([-1, -2, -3, 3, 4]);
      const m = fAdd(basic, frac(2 * turns));
      const whole = `${Math.abs(turns) === 1 ? '' : `${Math.abs(turns)} \\cdot `}2\\pi`;
      // What comes out when the sign of a negative angle is simply dropped.
      const unsigned = frac(Math.abs(m.n) % (2 * m.d), m.d);
      return {
        prompt: L(
          `Určete základní velikost úhlu $${piTex(m)}$ (tedy úhel z intervalu $${TURN.cs}$ se stejným koncovým ramenem).`,
          `Find the basic size of the angle $${piTex(m)}$ (the angle in $${TURN.en}$ with the same terminal side).`,
        ),
        answer: { kind: 'number', value: piIn(basic), unit: 'rad', placeholder: 'pi/6' },
        hints: [
          L(
            'Celá otáčka je $2\\pi$. Přičtením nebo odečtením celých otáček se koncové rameno nezmění.',
            'A full turn is $2\\pi$. Adding or subtracting whole turns does not change the terminal side.',
          ),
          L(
            `Zapiš si $2\\pi$ se stejným jmenovatelem: $2\\pi = \\frac{${2 * d}\\pi}{${d}}$.`,
            `Write $2\\pi$ with the same denominator: $2\\pi = \\frac{${2 * d}\\pi}{${d}}$.`,
          ),
        ],
        solution: [
          step(
            turns > 0 ? 'Odečteme celé otáčky:' : 'Přičteme celé otáčky:',
            turns > 0 ? 'Subtract whole turns:' : 'Add whole turns:',
            `${piTex(m)} ${turns > 0 ? '-' : '+'} ${whole} = ${piTex(m)} ${turns > 0 ? '-' : '+'} \\frac{${2 * d * Math.abs(turns)}\\pi}{${d}} = ${piTex(basic)}`,
          ),
        ],
        misconceptions: [
          mc(
            piIn(frac((n + d) % (2 * d), d)),
            'concept',
            'Celá otáčka je $2\\pi$, ne $\\pi$. Po půlotáčce míří rameno na opačnou stranu.',
            'A full turn is $2\\pi$, not $\\pi$. After half a turn the side points the opposite way.',
          ),
          ...(turns < 0
            ? [
                mc(
                  piIn(unsigned),
                  'sign',
                  'Záporný úhel se otáčí opačným směrem: nestačí vynechat znaménko.',
                  'A negative angle turns the other way: dropping the sign is not enough.',
                ),
              ]
            : []),
        ],
        verify: [{ kind: 'value', expr: `(${piIn(m)})-(${turns})*2*pi` }],
      };
    },
  }),

  gen({
    id: 'trig.unit-circle.exact',
    concept: 'trig.unit-circle',
    kind: 'core',
    levels: [1, 2, 3],
    title: L('Přesné hodnoty goniometrických funkcí', 'Exact values of trigonometric functions'),
    tags: ['annual-review'],
    est: (lv) => 30 + 15 * lv,
    make(r, lv) {
      const fn = r.pick<Fn>(lv === 1 ? ['sin', 'cos', 'tan'] : ['sin', 'cos', 'tan', 'cot']);
      const pool = (
        lv === 1 ? [0, 30, 45, 60, 90] : STANDARD_DEGREES.filter((deg) => (lv === 2 ? deg > 90 : deg > 0))
      ).filter((deg) => exact(fn, deg) !== null);
      const basic = r.pick(pool);
      const deg = lv === 3 ? basic + 360 * r.pick([-1, -1, 1, -2]) : basic;
      const value = exact(fn, deg)!;
      const show = (angle: number): string => (lv === 1 ? degTex(angle) : piTex(fromDeg(angle)));
      const expr = fnL(fn, arg(show(deg)));
      const q = quadrant(basic);
      const ref = referenceDeg(basic);
      const word = FN_WORD[fn];
      const co = exact(CO[fn], deg);

      const solution: SolutionStep[] = [];
      if (deg !== basic)
        solution.push(
          step(
            'Celé otáčky hodnotu nemění, odečteme (přičteme) je:',
            'Whole turns do not change the value, so drop them:',
            chainL([expr, fnL(fn, show(basic))]),
          ),
        );
      if (q === 0) {
        const [cx, sy] = [exact('cos', basic)!.tex, exact('sin', basic)!.tex];
        const ratio =
          fn === 'tan'
            ? L(
                `Tangens je podíl $\\frac{\\sin}{\\cos} = \\frac{${sy}}{${cx}}$.`,
                `Tangent is the quotient $\\frac{\\sin}{\\cos} = \\frac{${sy}}{${cx}}$.`,
              )
            : fn === 'cot'
              ? L(
                  `Kotangens je podíl $\\frac{\\cos}{\\sin} = \\frac{${cx}}{${sy}}$.`,
                  `Cotangent is the quotient $\\frac{\\cos}{\\sin} = \\frac{${cx}}{${sy}}$.`,
                )
              : L('', '');
        solution.push(
          step(
            `Úhel $${show(basic)}$ leží na ose: bod jednotkové kružnice je $[${cx};\\,${sy}]$. První souřadnice je kosinus, druhá sinus. ${ratio.cs}`.trim(),
            `The angle $${show(basic)}$ lies on an axis: the point of the unit circle is $(${cx},\\,${sy})$. The first coordinate is the cosine, the second the sine. ${ratio.en}`.trim(),
            chainL([expr, value.tex]),
          ),
        );
      } else if (q === 1) {
        // An acute angle: read the value off the triangle.
        const triangle =
          ref === 45
            ? L(
                'V pravoúhlém trojúhelníku s úhly $45^{\\circ}$, $45^{\\circ}$ mají odvěsny délku $1$ a přepona $\\sqrt{2}$.',
                'In the right triangle with angles $45^{\\circ}$, $45^{\\circ}$ the legs have length $1$ and the hypotenuse $\\sqrt{2}$.',
              )
            : L(
                'V pravoúhlém trojúhelníku s úhly $30^{\\circ}$, $60^{\\circ}$ leží proti $30^{\\circ}$ strana $1$, proti $60^{\\circ}$ strana $\\sqrt{3}$ a přepona má délku $2$.',
                'In the right triangle with angles $30^{\\circ}$, $60^{\\circ}$ the side opposite $30^{\\circ}$ is $1$, the side opposite $60^{\\circ}$ is $\\sqrt{3}$ and the hypotenuse is $2$.',
              );
        const ratio = {
          sin: L('protilehlá ku přeponě', 'opposite over hypotenuse'),
          cos: L('přilehlá ku přeponě', 'adjacent over hypotenuse'),
          tan: L('protilehlá ku přilehlé', 'opposite over adjacent'),
          cot: L('přilehlá ku protilehlé', 'adjacent over opposite'),
        }[fn];
        solution.push(step(triangle.cs, triangle.en));
        solution.push(
          step(
            `${capital(word.cs)} je ${ratio.cs}:`,
            `${capital(word.en)} is ${ratio.en}:`,
            chainL([fnL(fn, show(basic)), value.tex]),
          ),
        );
      } else {
        solution.push(
          step(
            `Úhel $${show(basic)}$ leží ${QUADRANT_IN[q].cs}, referenční úhel (ostrý úhel k ose $x$) je $${show(ref)}$.`,
            `The angle $${show(basic)}$ lies ${QUADRANT_IN[q].en}; its reference angle (the acute angle to the $x$-axis) is $${show(ref)}$.`,
          ),
        );
        solution.push(
          step(
            `${capital(word.cs)} je ${QUADRANT_IN[q].cs} ${value.value < 0 ? 'záporný' : 'kladný'}:`,
            `${capital(word.en)} is ${value.value < 0 ? 'negative' : 'positive'} ${QUADRANT_IN[q].en}:`,
            chainL([
              fnL(fn, show(basic)),
              mapL(fnL(fn, show(ref)), (tex) => `${value.value < 0 ? '-' : ''}${tex}`),
              value.tex,
            ]),
          ),
        );
      }

      return {
        prompt: L(`Určete přesnou hodnotu: $${expr.cs}$`, `Find the exact value: $${expr.en}$`),
        answer: { kind: 'number', value: value.input, placeholder: 'sqrt(3)/2' },
        hints:
          q === 0
            ? [
                L(
                  'Úhel leží na některé ose. Který bod jednotkové kružnice mu odpovídá?',
                  'The angle lies on an axis. Which point of the unit circle belongs to it?',
                ),
                L(
                  'Kosinus je první souřadnice bodu, sinus druhá; $\\operatorname{tg} = \\frac{\\sin}{\\cos}$.',
                  'Cosine is the first coordinate of the point, sine the second; $\\tan = \\frac{\\sin}{\\cos}$.',
                ),
              ]
            : lv === 1
              ? [
                  L(
                    'Vybav si trojúhelník $30^{\\circ}$–$60^{\\circ}$–$90^{\\circ}$ (strany $1$, $\\sqrt{3}$, $2$) nebo $45^{\\circ}$–$45^{\\circ}$–$90^{\\circ}$ (strany $1$, $1$, $\\sqrt{2}$).',
                    'Recall the $30^{\\circ}$–$60^{\\circ}$–$90^{\\circ}$ triangle (sides $1$, $\\sqrt{3}$, $2$) or the $45^{\\circ}$–$45^{\\circ}$–$90^{\\circ}$ one (sides $1$, $1$, $\\sqrt{2}$).',
                  ),
                  L(
                    'Sinus = protilehlá ku přeponě, kosinus = přilehlá ku přeponě, tangens = protilehlá ku přilehlé.',
                    'Sine = opposite over hypotenuse, cosine = adjacent over hypotenuse, tangent = opposite over adjacent.',
                  ),
                ]
              : [
                  L(
                    'Najdi kvadrant a referenční úhel — ostrý úhel, který rameno svírá s osou $x$.',
                    'Find the quadrant and the reference angle — the acute angle between the terminal side and the $x$-axis.',
                  ),
                  L(
                    `Referenční úhel je $${show(ref)}$. Jaké znaménko má ${word.cs} ${QUADRANT_IN[q as 1].cs}?`,
                    `The reference angle is $${show(ref)}$. What sign does the ${word.en} have ${QUADRANT_IN[q as 1].en}?`,
                  ),
                ],
        solution,
        misconceptions: [
          ...(value.value !== 0
            ? [
                mc(
                  negIn(value.input),
                  'sign',
                  q === 0
                    ? 'Hodnota sedí, znaménko ne. Na které straně osy bod leží?'
                    : `Hodnota sedí, znaménko ne: ${word.cs} je ${QUADRANT_IN[q].cs} ${value.value < 0 ? 'záporný' : 'kladný'}.`,
                  q === 0
                    ? 'The size is right, the sign is not. On which side of the axis does the point lie?'
                    : `The size is right, the sign is not: the ${word.en} is ${value.value < 0 ? 'negative' : 'positive'} ${QUADRANT_IN[q].en}.`,
                ),
              ]
            : []),
          ...(co
            ? [
                mc(
                  co.input,
                  'concept',
                  fn === 'sin' || fn === 'cos'
                    ? `To je ${FN_WORD[CO[fn]].cs} toho úhlu. Sinus je druhá souřadnice bodu na jednotkové kružnici, kosinus první.`
                    : 'To je převrácená hodnota: $\\operatorname{tg} = \\frac{\\sin}{\\cos}$, $\\operatorname{cotg} = \\frac{\\cos}{\\sin}$.',
                  fn === 'sin' || fn === 'cos'
                    ? `That is the ${FN_WORD[CO[fn]].en} of the angle. Sine is the second coordinate of the point on the unit circle, cosine the first.`
                    : 'That is the reciprocal: $\\tan = \\frac{\\sin}{\\cos}$, $\\cot = \\frac{\\cos}{\\sin}$.',
                ),
              ]
            : []),
        ],
        verify: [{ kind: 'value', expr: `${fn}((${deg})*pi/180)` }],
      };
    },
  }),

  gen({
    id: 'trig.unit-circle.sign',
    concept: 'trig.unit-circle',
    kind: 'warmup',
    levels: [1, 2],
    title: L('Znaménka v kvadrantech', 'Signs in the quadrants'),
    est: 45,
    make(r, lv) {
      // Angles off the axes and away from the memorised ones, so the quadrant has to be found.
      const angles: { deg: number; tex: string }[] =
        lv === 1
          ? [20, 40, 70, 100, 110, 130, 160, 200, 220, 250, 290, 310, 340].map((deg) => ({ deg, tex: degTex(deg) }))
          : [5, 8, 9, 10].flatMap((d) =>
              Array.from({ length: 2 * d - 1 }, (_, i) => frac(i + 1, d))
                .filter((m) => m.d === d)
                .map((m) => ({ deg: (m.n * 180) / m.d, tex: piTex(m) })),
            );
      const wantNegative = lv === 1 ? true : r.bool();
      const all = r.shuffle(
        (['sin', 'cos', 'tan', 'cot'] as const).flatMap((fn) =>
          angles.map((angle) => ({ fn, ...angle, negative: evalFn(fn, (angle.deg * Math.PI) / 180) < 0 })),
        ),
      );
      const right = all.find((item) => item.negative === wantNegative)!;
      // One distractor of the opposite sign for each of the other three functions.
      const wrong = (['sin', 'cos', 'tan', 'cot'] as const)
        .filter((fn) => fn !== right.fn)
        .map((fn) => all.find((item) => item.fn === fn && item.negative !== wantNegative)!);
      const items = r.shuffle([right, ...wrong]);
      const describe = (item: (typeof all)[number]): L => {
        const q = quadrant(item.deg) as 1 | 2 | 3 | 4;
        return L(
          `$${fnL(item.fn, item.tex).cs}$: úhel leží ${QUADRANT_IN[q].cs}, ${FN_WORD[item.fn].cs} je tam ${item.negative ? 'záporný' : 'kladný'}.`,
          `$${fnL(item.fn, item.tex).en}$: the angle lies ${QUADRANT_IN[q].en}, where the ${FN_WORD[item.fn].en} is ${item.negative ? 'negative' : 'positive'}.`,
        );
      };
      return {
        prompt: wantNegative
          ? L('Která z hodnot je záporná?', 'Which of these values is negative?')
          : L('Která z hodnot je kladná?', 'Which of these values is positive?'),
        answer: {
          kind: 'choice',
          options: items.map((item, index) => ({
            id: `o${index}`,
            text: L(`$${fnL(item.fn, item.tex).cs}$`, `$${fnL(item.fn, item.tex).en}$`),
          })),
          correct: [`o${items.indexOf(right)}`],
          fixedOrder: true,
        },
        hints: [
          L(
            'Hodnoty počítat nemusíš. U každého úhlu stačí určit kvadrant.',
            'You need not compute the values. Finding the quadrant of each angle is enough.',
          ),
          L(
            'Sinus je kladný nahoře (I., II.), kosinus vpravo (I., IV.), tangens a kotangens v I. a III. kvadrantu.',
            'Sine is positive at the top (I, II), cosine on the right (I, IV), tangent and cotangent in quadrants I and III.',
          ),
        ],
        solution: items.map((item) => ({ text: describe(item) })),
        misconceptions: items
          .filter((item) => item !== right)
          .map((item) => mc(`o${items.indexOf(item)}`, 'concept', describe(item).cs, describe(item).en)),
      };
    },
  }),

  gen({
    id: 'trig.graphs.parameters',
    concept: 'trig.graphs',
    kind: 'core',
    levels: [2, 3],
    title: L('Perioda a obor hodnot sinusoidy', 'Period and range of a sinusoid'),
    tags: ['annual-review'],
    est: (lv) => 45 + 15 * (lv - 2),
    make(r, lv) {
      const variant = r.pick(['period', 'range'] as const);
      const fn = variant === 'period' && lv === 3 && r.bool(0.3) ? 'tan' : r.pick(['sin', 'cos'] as const);
      const a =
        fn === 'tan'
          ? frac(1)
          : r.pick(lv === 2 ? [frac(2), frac(3), frac(4)] : [frac(2), frac(3), frac(-2), frac(-3), frac(1, 2)]);
      const b = r.pick(lv === 2 ? [frac(2), frac(3), frac(4)] : [frac(2), frac(3), frac(1, 2), frac(1, 3), frac(4)]);
      const d = fn === 'tan' ? 0 : lv === 2 && variant === 'period' ? 0 : r.pick([-2, -1, 1, 2, 3]);
      const name = fn === 'tan' ? L('\\operatorname{tg}', '\\tan') : L(`\\${fn}`, `\\${fn}`);
      const formula = mapL(
        name,
        (text) => `${waveTex(a, fn, b, text)}${d === 0 ? '' : d > 0 ? ` + ${d}` : ` - ${-d}`}`,
      );
      const input = `${waveIn(a, fn, b)}+(${d})`;
      const bTex = b.d === 1 ? `${b.n}` : `\\frac{${b.n}}{${b.d}}`;

      if (variant === 'period') {
        const basePeriod = fn === 'tan' ? frac(1) : frac(2);
        const period = fDiv(basePeriod, b);
        return {
          prompt: L(
            `Určete nejmenší periodu funkce $y = ${formula.cs}$.`,
            `Find the smallest period of the function $y = ${formula.en}$.`,
          ),
          answer: { kind: 'number', value: piIn(period), label: 'T =', placeholder: 'pi/2' },
          hints: [
            fn === 'tan'
              ? L(
                  'Tangens má základní periodu $\\pi$ (sinus a kosinus $2\\pi$).',
                  'Tangent has basic period $\\pi$ (sine and cosine $2\\pi$).',
                )
              : L(
                  'Sinus i kosinus mají základní periodu $2\\pi$. Co s ní udělá číslo u $x$?',
                  'Sine and cosine have basic period $2\\pi$. What does the number in front of $x$ do to it?',
                ),
            L(
              `Číslo ${b.d === 1 ? 'větší než 1' : 'menší než 1'} u $x$ graf vodorovně ${b.d === 1 ? 'stlačí' : 'roztáhne'}: periodu jím dělíme.`,
              `A number ${b.d === 1 ? 'greater than 1' : 'less than 1'} in front of $x$ ${b.d === 1 ? 'squeezes' : 'stretches'} the graph horizontally: divide the period by it.`,
            ),
          ],
          solution: [
            step(
              `Perioda funkce $${mapL(name, (text) => `${text}\\,bx`).cs}$ je $T = \\frac{${piTex(basePeriod)}}{b}$; násobení ani posun ve svislém směru ji nemění.`,
              `The period of $${mapL(name, (text) => `${text}\\,bx`).en}$ is $T = \\frac{${piTex(basePeriod)}}{b}$; vertical scaling and shifting do not change it.`,
              b.d === 1 && basePeriod.n === 1
                ? `T = ${piTex(period)}`
                : `T = \\frac{${piTex(basePeriod)}}{${bTex}} = ${piTex(period)}`,
            ),
          ],
          misconceptions: [
            mc(
              piIn(fMul(basePeriod, b)),
              'formula',
              'Periodu číslem u $x$ dělíme, nenásobíme: rychlejší kmitání znamená kratší periodu.',
              'Divide the period by the number in front of $x$, do not multiply: faster oscillation means a shorter period.',
            ),
            mc(
              piIn(fDiv(fn === 'tan' ? frac(2) : frac(1), b)),
              'formula',
              fn === 'tan'
                ? 'Tangens má základní periodu $\\pi$, ne $2\\pi$.'
                : 'Sinus a kosinus mají základní periodu $2\\pi$; periodu $\\pi$ mají tangens a kotangens.',
              fn === 'tan'
                ? 'Tangent has basic period $\\pi$, not $2\\pi$.'
                : 'Sine and cosine have basic period $2\\pi$; it is tangent and cotangent that have $\\pi$.',
            ),
            mc(
              piIn(basePeriod),
              'concept',
              'To je perioda základní funkce. Číslo u $x$ ji mění.',
              'That is the period of the basic function. The number in front of $x$ changes it.',
            ),
          ],
          verify: [{ kind: 'value', expr: `${fn === 'tan' ? '' : '2*'}pi/(${b.n}/${b.d})` }],
        };
      }
      const size = frac(Math.abs(a.n), a.d);
      const lo = fSub(frac(d), size);
      const hi = fAdd(frac(d), size);
      return {
        prompt: L(
          `Určete obor hodnot funkce $y = ${formula.cs}$.`,
          `Find the range of the function $y = ${formula.en}$.`,
        ),
        answer: { kind: 'interval', value: intervalIn(lo, hi, true, true), label: 'H(f) =' },
        hints: [
          L(
            `Sinus i kosinus nabývají hodnot od $-1$ do $1$. Co s nimi udělá násobení číslem $${a.d === 1 ? a.n : `\\frac{${a.n}}{${a.d}}`}$?`,
            `Sine and cosine take values from $-1$ to $1$. What does multiplying by $${a.d === 1 ? a.n : `\\frac{${a.n}}{${a.d}}`}$ do to them?`,
          ),
          L(
            'Nakonec celý graf posuň o konstantu nahoru nebo dolů.',
            'Finally shift the whole graph up or down by the constant.',
          ),
        ],
        solution: [
          step(
            'Vyjdeme z nerovnosti pro základní funkci:',
            'Start from the inequality for the basic function:',
            `-1 \\le ${waveTex(frac(1), fn, b)} \\le 1`,
          ),
          step(
            a.n < 0 ? 'Vynásobíme (záporné číslo nerovnosti otočí, krajní hodnoty zůstanou stejné):' : 'Vynásobíme:',
            a.n < 0
              ? 'Multiply (a negative factor flips the inequalities; the extreme values stay the same):'
              : 'Multiply:',
            `${fToTexSigned(fSub(frac(0), size))} \\le ${waveTex(a, fn, b)} \\le ${fToTexSigned(size)}`,
          ),
          ...(d === 0
            ? []
            : [
                step(
                  d > 0 ? `Přičteme ${d}:` : `Odečteme ${-d}:`,
                  d > 0 ? `Add ${d}:` : `Subtract ${-d}:`,
                  `${fToTexSigned(lo)} \\le y \\le ${fToTexSigned(hi)}`,
                ),
              ]),
          step(
            'Obor hodnot:',
            'The range:',
            mapL(intervalL(lo, hi, true, true), (set) => `H(f) = ${set}`),
          ),
        ],
        misconceptions: [
          mc(
            intervalIn(-1 + d, 1 + d, true, true),
            'concept',
            'Amplituda není 1: číslo před funkcí graf svisle roztáhne.',
            'The amplitude is not 1: the number in front of the function stretches the graph vertically.',
          ),
          ...(d === 0
            ? []
            : [
                mc(
                  intervalIn(fSub(frac(0), size), size, true, true),
                  'incomplete',
                  'Ještě posun: konstanta posune celý graf nahoru nebo dolů.',
                  'The shift is still missing: the constant moves the whole graph up or down.',
                ),
              ]),
          mc(
            intervalIn(lo, hi, false, false),
            'notation',
            'Krajních hodnot funkce nabývá, interval je uzavřený.',
            'The function does reach the extreme values, so the interval is closed.',
          ),
        ],
        verify: [{ kind: 'range', expr: input, over: [0, 40] }],
      };
    },
  }),

  gen({
    id: 'trig.graphs.match',
    concept: 'trig.graphs',
    kind: 'graph',
    levels: [2, 3],
    title: L('Který předpis patří ke grafu?', 'Which formula belongs to the graph?'),
    est: 60,
    make(r, lv) {
      const fn = r.pick(['sin', 'cos'] as const);
      const a = r.pick(lv === 2 ? [frac(1), frac(2), frac(3)] : [frac(2), frac(3), frac(-1), frac(-2)]);
      const b = r.pick(lv === 2 ? [frac(1), frac(2)] : [frac(2), frac(1, 2), frac(1)]);
      const other = fn === 'sin' ? 'cos' : 'sin';
      const otherB = r.pick([frac(1), frac(2), frac(1, 2)].filter((value) => value.n !== b.n || value.d !== b.d));
      // A wrong amplitude: the same curve flipped, or one of a different height.
      const otherA = r.bool()
        ? frac(-a.n)
        : frac(r.pick([1, 2, 3].filter((size) => size !== Math.abs(a.n))) * Math.sign(a.n));
      const options = r.shuffle([
        { id: 'right', tex: waveTex(a, fn, b) },
        { id: 'fn', tex: waveTex(a, other, b) },
        { id: 'period', tex: waveTex(a, fn, otherB) },
        { id: 'amplitude', tex: waveTex(otherA, fn, b) },
      ]);
      const atZero = fn === 'sin' ? 0 : a.n;
      const period = fDiv(frac(2), b);
      return {
        prompt: L('Který předpis odpovídá grafu na obrázku?', 'Which formula matches the graph shown?'),
        figure: {
          view: { xMin: -0.6, xMax: 4 * Math.PI + 0.4, yMin: -3.6, yMax: 3.6 },
          piAxis: true,
          aspect: 0.42,
          curves: [{ expr: waveIn(a, fn, b), color: 'a' }],
        },
        answer: {
          kind: 'choice',
          options: options.map((option) => ({ id: option.id, text: L(`$y = ${option.tex}$`, `$y = ${option.tex}$`) })),
          correct: ['right'],
          fixedOrder: true,
        },
        hints: [
          L(
            'Podívej se na hodnotu v nule: sinusoida tvaru $a\\sin bx$ tam prochází nulou, $a\\cos bx$ tam má největší nebo nejmenší hodnotu.',
            'Look at the value at zero: a curve $a\\sin bx$ passes through zero there, while $a\\cos bx$ has its largest or smallest value there.',
          ),
          L(
            'Amplituda je největší výchylka od osy. Periodu odečti jako délku jedné celé vlny: $T = \\frac{2\\pi}{b}$.',
            'The amplitude is the largest deviation from the axis. Read the period as the length of one full wave: $T = \\frac{2\\pi}{b}$.',
          ),
        ],
        solution: [
          fn === 'sin'
            ? step(
                `V nule graf prochází nulou, jde tedy o sinus. Z nuly ${a.n > 0 ? 'stoupá, koeficient je kladný' : 'klesá, koeficient je záporný'}.`,
                `The graph passes through zero at zero, so it is a sine. From there it ${a.n > 0 ? 'rises, so the coefficient is positive' : 'falls, so the coefficient is negative'}.`,
              )
            : step(
                `V nule má graf svou ${a.n > 0 ? 'největší' : 'nejmenší'} hodnotu $${atZero}$, jde tedy o kosinus s ${a.n > 0 ? 'kladným' : 'záporným'} koeficientem.`,
                `At zero the graph has its ${a.n > 0 ? 'largest' : 'smallest'} value $${atZero}$, so it is a cosine with a ${a.n > 0 ? 'positive' : 'negative'} coefficient.`,
              ),
          step(`Největší výchylka je $${Math.abs(a.n)}$.`, `The largest deviation is $${Math.abs(a.n)}$.`),
          step(
            `Jedna vlna má délku $${piTex(period)}$, takže $b = \\frac{2\\pi}{${piTex(period)}} = ${b.d === 1 ? b.n : `\\frac{${b.n}}{${b.d}}`}$.`,
            `One wave has length $${piTex(period)}$, so $b = \\frac{2\\pi}{${piTex(period)}} = ${b.d === 1 ? b.n : `\\frac{${b.n}}{${b.d}}`}$.`,
            `y = ${waveTex(a, fn, b)}`,
          ),
        ],
        misconceptions: [
          mc(
            'fn',
            'graph',
            'Zkontroluj hodnotu v nule: sinus tam prochází nulou, kosinus má extrém.',
            'Check the value at zero: a sine passes through zero there, a cosine has an extreme.',
          ),
          mc(
            'period',
            'graph',
            'Amplituda sedí, perioda ne. Změř délku jedné celé vlny.',
            'The amplitude fits, the period does not. Measure the length of one full wave.',
          ),
          mc(
            'amplitude',
            'graph',
            'Perioda sedí. Zkontroluj největší výchylku a směr, kterým graf z nuly vychází.',
            'The period fits. Check the largest deviation and the direction in which the graph leaves zero.',
          ),
        ],
      };
    },
  }),

  gen({
    id: 'trig.graphs.signal',
    concept: 'trig.graphs',
    kind: 'applied',
    levels: [2, 3],
    title: L('Tón jako sinusoida', 'A tone as a sinusoid'),
    est: (lv) => 60 + 20 * (lv - 2),
    make(r, lv) {
      const f = r.pick(lv === 2 ? [50, 100, 200, 220, 440, 880, 1000] : [50, 100, 125, 200, 250, 400, 500, 1000, 2000]);
      const amplitude = r.pick([1, 2, 3, 5]);
      const omega = 2 * f;
      const signal = `y = ${amplitude === 1 ? '' : amplitude}\\sin(${omega}\\pi t)`;
      if (lv === 2) {
        return {
          prompt: L(
            `Zvukový signál čistého tónu popisuje funkce $${signal}$, kde $t$ je čas v sekundách. Jakou má tón frekvenci (kolik celých kmitů proběhne za sekundu)?`,
            `A pure tone is described by $${signal}$, where $t$ is time in seconds. What is the frequency of the tone (how many full oscillations happen per second)?`,
          ),
          context: { it: true, applied: true },
          answer: { kind: 'number', value: `${f}`, label: 'f =', placeholder: 'Hz' },
          hints: [
            L(
              'Jeden kmit proběhne, když se argument sinu zvětší o $2\\pi$.',
              'One oscillation is complete when the argument of the sine grows by $2\\pi$.',
            ),
            L(
              `Za jednu sekundu naroste argument o $${omega}\\pi$. Kolikrát se do toho vejde $2\\pi$?`,
              `In one second the argument grows by $${omega}\\pi$. How many times does $2\\pi$ fit into that?`,
            ),
          ],
          solution: [
            step(
              'Obecně $y = A\\sin(2\\pi f t)$, kde $f$ je frekvence v hertzích. Porovnáme:',
              'In general $y = A\\sin(2\\pi f t)$, where $f$ is the frequency in hertz. Compare:',
              `2\\pi f = ${omega}\\pi \\;\\Rightarrow\\; f = ${f}\\ \\text{Hz}`,
            ),
            step(
              `Amplituda $${amplitude}$ určuje hlasitost, na výšku tónu nemá vliv.`,
              `The amplitude $${amplitude}$ sets the loudness and has no effect on the pitch.`,
            ),
          ],
          misconceptions: [
            mc(
              `${omega}`,
              'formula',
              'To je číslo u $\\pi t$. Jeden kmit odpovídá $2\\pi$, takže je potřeba dělit dvěma.',
              'That is the number in front of $\\pi t$. One oscillation corresponds to $2\\pi$, so divide by two.',
            ),
            mc(
              `${amplitude}`,
              'concept',
              'To je amplituda (hlasitost). Frekvenci určuje číslo u $t$.',
              'That is the amplitude (loudness). The frequency comes from the number in front of $t$.',
            ),
          ],
          verify: [{ kind: 'value', expr: `${omega}*pi/(2*pi)` }],
        };
      }
      const periodMs = 1000 / f;
      return {
        prompt: L(
          `Zvukový signál čistého tónu popisuje funkce $${signal}$, kde $t$ je čas v sekundách. Jak dlouho trvá jeden kmit? Výsledek uveďte v milisekundách.`,
          `A pure tone is described by $${signal}$, where $t$ is time in seconds. How long does one oscillation take? Give the result in milliseconds.`,
        ),
        context: { it: true, applied: true },
        answer: { kind: 'number', value: `${periodMs}`, label: 'T =', placeholder: 'ms' },
        hints: [
          L(
            'Perioda funkce $\\sin(bt)$ je $T = \\frac{2\\pi}{b}$.',
            'The period of $\\sin(bt)$ is $T = \\frac{2\\pi}{b}$.',
          ),
          L(
            'Výsledek vyjde v sekundách. Milisekunda je tisícina sekundy.',
            'The result comes out in seconds. A millisecond is a thousandth of a second.',
          ),
        ],
        solution: [
          step('Perioda:', 'The period:', `T = \\frac{2\\pi}{${omega}\\pi} = \\frac{1}{${f}}\\ \\text{s}`),
          step(
            'Převedeme na milisekundy:',
            'Convert to milliseconds:',
            L(
              `T = \\frac{1000}{${f}}\\ \\text{ms} = ${String(periodMs).replace('.', '{,}')}\\ \\text{ms}`,
              `T = \\frac{1000}{${f}}\\ \\text{ms} = ${periodMs}\\ \\text{ms}`,
            ),
          ),
          step(
            `Frekvence je $f = \\frac{1}{T} = ${f}$ Hz. Při vzorkování 44 100 Hz tak na jeden kmit připadá asi ${Math.round(44100 / f)} vzorků.`,
            `The frequency is $f = \\frac{1}{T} = ${f}$ Hz. Sampled at 44,100 Hz, one oscillation therefore spans about ${Math.round(44100 / f)} samples.`,
          ),
        ],
        misconceptions: [
          mc(
            `1/${f}`,
            'misread',
            'To je perioda v sekundách. Ptali se na milisekundy.',
            'That is the period in seconds. Milliseconds were asked for.',
          ),
          mc(
            `${f}`,
            'concept',
            'To je frekvence (kmitů za sekundu). Perioda je její převrácená hodnota.',
            'That is the frequency (oscillations per second). The period is its reciprocal.',
          ),
          mc(
            `${2000 / f}`,
            'formula',
            `Perioda je $\\frac{2\\pi}{b}$, kde $b = ${omega}\\pi$ je celé číslo u $t$ včetně $\\pi$.`,
            `The period is $\\frac{2\\pi}{b}$, where $b = ${omega}\\pi$ is the whole coefficient of $t$, $\\pi$ included.`,
          ),
        ],
        verify: [{ kind: 'value', expr: `1000*2*pi/(${omega}*pi)` }],
      };
    },
  }),

  gen({
    id: 'trigeq.basic.interval',
    concept: 'trigeq.basic',
    kind: 'core',
    levels: [1, 2, 3],
    title: L('Základní goniometrická rovnice na jedné otáčce', 'A basic trigonometric equation on one turn'),
    tags: ['annual-review'],
    est: (lv) => 50 + 30 * lv,
    make(r, lv) {
      const fn = r.pick<Fn>(
        lv === 1 ? ['sin', 'cos'] : lv === 2 ? ['sin', 'cos', 'tan', 'cot'] : ['sin', 'cos', 'tan'],
      );
      const defined = STANDARD_DEGREES.filter((deg) => exact(fn, deg) !== null);
      // Level 1: positive textbook values. Level 2: negative values or tangents. Level 3: argument 2x.
      const pool =
        lv === 1
          ? [30, 45, 60, 30, 45, 60, 0, 90]
          : lv === 2
            ? defined.filter((deg) => fn === 'tan' || fn === 'cot' || exact(fn, deg)!.value < 0)
            : defined.filter((deg) => referenceDeg(deg) % 90 !== 0);
      const value = exact(fn, r.pick(pool))!;
      const k = lv === 3 ? 2 : 1;
      const solutions = solveOnTurn((x) => near(evalFn(fn, k * x), value.value));
      const inner = solveOnTurn((u) => near(evalFn(fn, u), value.value));
      const lhs = fnL(fn, k === 1 ? 'x' : '2x');
      const word = FN_WORD[fn];
      const onAxis = Math.abs(value.value) < 1e-9 || Math.abs(Math.abs(value.value) - 1) < 1e-9;
      const positive = value.value > 0;
      const refValue = exact(fn, referenceDeg((inner[0]!.n * 180) / inner[0]!.d));
      const reference = fromDeg(referenceDeg((inner[0]!.n * 180) / inner[0]!.d));
      // With the argument x the listed angles are already the answer; with 2x they are values of u.
      const member = (set: string): string => (k === 1 ? `K = ${set}` : `u \\in ${set}`);

      const solution: SolutionStep[] = [];
      if (k === 2)
        solution.push(
          step(
            'Substituce $u = 2x$. Když $x$ projde jednu otáčku, projde $u$ dvě:',
            'Substitute $u = 2x$. While $x$ covers one turn, $u$ covers two:',
            L(
              'x \\in \\langle 0;\\,2\\pi) \\;\\Rightarrow\\; u \\in \\langle 0;\\,4\\pi)',
              'x \\in [0,\\,2\\pi) \\;\\Rightarrow\\; u \\in [0,\\,4\\pi)',
            ),
          ),
        );
      if (onAxis) {
        solution.push(
          step(
            `Na jednotkové kružnici: ${fn === 'sin' ? 'sinus je druhá souřadnice bodu' : fn === 'cos' ? 'kosinus je první souřadnice bodu' : `${word.cs} je podíl souřadnic bodu`}. Hodnotu $${value.tex}$ má v jedné otáčce pro:`,
            `On the unit circle: ${fn === 'sin' ? 'sine is the second coordinate of the point' : fn === 'cos' ? 'cosine is the first coordinate of the point' : `the ${word.en} is a quotient of the coordinates`}. Within one turn it equals $${value.tex}$ for:`,
            mapL(angleSetL(inner), member),
          ),
        );
      } else {
        solution.push(
          step(
            'Referenční úhel (bez ohledu na znaménko):',
            'The reference angle (ignoring the sign):',
            mapL(
              chainL([fnL(fn, '\\alpha'), refValue!.tex]),
              (tex) => `${tex} \\;\\Rightarrow\\; \\alpha = ${piTex(reference)}`,
            ),
          ),
        );
        solution.push(
          step(
            `${capital(word.cs)} je ${positive ? 'kladný' : 'záporný'} ${signQuadrants(fn, positive).cs}:`,
            `The ${word.en} is ${positive ? 'positive' : 'negative'} ${signQuadrants(fn, positive).en}:`,
            mapL(angleSetL(inner), member),
          ),
        );
      }
      if (k === 2) {
        const twoTurns = [...inner, ...inner.map((u) => fAdd(u, frac(2)))];
        solution.push(
          step(
            'Ve druhé otáčce přibudou řešení posunutá o $2\\pi$:',
            'The second turn adds the solutions shifted by $2\\pi$:',
            mapL(angleSetL(twoTurns), (set) => `u \\in ${set}`),
          ),
        );
        solution.push(
          step(
            'Vrátíme se k $x = \\frac{u}{2}$:',
            'Return to $x = \\frac{u}{2}$:',
            mapL(angleSetL(solutions), (set) => `K = ${set}`),
          ),
        );
      }

      const list = (angles: readonly Frac[]): string => angles.map(piIn).join('; ');
      const first = inner[0]!;
      // The partner a learner gets by using the other function's symmetry.
      const wrongPartner = fn === 'sin' ? fAdd(first, frac(1)) : fn === 'cos' ? fSub(frac(1), first) : null;
      const wrap = (m: Frac): Frac => frac(((m.n % (2 * m.d)) + 2 * m.d) % (2 * m.d), m.d);
      return {
        prompt: L(
          `Řešte v intervalu $${TURN.cs}$: $${lhs.cs} = ${value.tex}$`,
          `Solve on $${TURN.en}$: $${lhs.en} = ${value.tex}$`,
        ),
        answer: { kind: 'set', values: solutions.map(piIn), unit: 'rad', label: 'K =', placeholder: 'pi/6; 5pi/6' },
        hints: [
          ...(k === 2
            ? [
                L(
                  'Označ si $u = 2x$ a řeš nejdřív rovnici pro $u$. Pozor: $u$ projde dvě otáčky.',
                  'Write $u = 2x$ and solve for $u$ first. Careful: $u$ runs through two turns.',
                ),
              ]
            : []),
          fn === 'sin' || fn === 'cos'
            ? L(
                `Kde na jednotkové kružnici má ${fn === 'sin' ? 'druhá' : 'první'} souřadnice hodnotu $${value.tex}$? ${onAxis ? '' : 'Jsou to dva body.'}`.trim(),
                `Where on the unit circle does the ${fn === 'sin' ? 'second' : 'first'} coordinate equal $${value.tex}$? ${onAxis ? '' : 'There are two such points.'}`.trim(),
              )
            : L(
                `${capital(word.cs)} má periodu $\\pi$: v jedné otáčce jsou dvě řešení, která se liší o $\\pi$.`,
                `The ${word.en} has period $\\pi$: one turn holds two solutions that differ by $\\pi$.`,
              ),
          onAxis
            ? L('Jde o bod na některé ose.', 'It is a point on one of the axes.')
            : L(
                `Referenční úhel je $${piTex(reference)}$. ${word.cs[0]!.toUpperCase()}${word.cs.slice(1)} je ${positive ? 'kladný' : 'záporný'} ${signQuadrants(fn, positive).cs}.`,
                `The reference angle is $${piTex(reference)}$. The ${word.en} is ${positive ? 'positive' : 'negative'} ${signQuadrants(fn, positive).en}.`,
              ),
        ],
        solution,
        misconceptions: [
          ...(k === 1 && solutions.length > 1
            ? [
                mc(
                  list([first]),
                  'incomplete',
                  'To je jen jedno řešení. V jedné otáčce jsou (většinou) dvě.',
                  'That is only one solution. One turn (usually) holds two.',
                ),
              ]
            : []),
          ...(k === 1 && wrongPartner && !onAxis
            ? [
                mc(
                  list([first, wrap(wrongPartner)]),
                  'concept',
                  fn === 'sin'
                    ? 'Druhé řešení sinu je $\\pi - x_1$ (souměrnost podle osy $y$), ne $x_1 + \\pi$.'
                    : 'Druhé řešení kosinu je $2\\pi - x_1$ (souměrnost podle osy $x$), ne $\\pi - x_1$.',
                  fn === 'sin'
                    ? 'The second solution of a sine is $\\pi - x_1$ (symmetry in the $y$-axis), not $x_1 + \\pi$.'
                    : 'The second solution of a cosine is $2\\pi - x_1$ (symmetry in the $x$-axis), not $\\pi - x_1$.',
                ),
              ]
            : []),
          ...(k === 1 && !onAxis
            ? [
                mc(
                  list([reference]),
                  'sign',
                  'To je referenční úhel. Ještě je potřeba najít kvadranty se správným znaménkem.',
                  'That is the reference angle. The quadrants with the right sign still have to be found.',
                ),
              ]
            : []),
          ...(k === 2
            ? [
                mc(
                  list(inner),
                  'incomplete',
                  'To jsou hodnoty $2x$. Ještě je potřeba vydělit dvěma.',
                  'Those are values of $2x$. They still have to be halved.',
                ),
                mc(
                  list(inner.map((u) => fDiv(u, frac(2)))),
                  'incomplete',
                  '$2x$ projde dvě otáčky, takže přibudou ještě řešení posunutá o $\\pi$.',
                  '$2x$ runs through two turns, so the solutions shifted by $\\pi$ are missing.',
                ),
              ]
            : []),
        ],
        verify: [{ kind: 'roots', expr: `${fn}(${k === 1 ? 'x' : '2*x'})-(${value.input})`, range: [0, 6.2831] }],
      };
    },
  }),

  gen({
    id: 'trigeq.basic.general',
    concept: 'trigeq.basic',
    kind: 'core',
    levels: [2, 3],
    title: L('Všechna řešení: perioda', 'All solutions: the period'),
    est: 60,
    make(r, lv) {
      const fn = r.pick<Fn>(lv === 2 ? ['sin', 'cos'] : ['sin', 'cos', 'tan']);
      const value = exact(
        fn,
        r.pick(lv === 2 ? [30, 45, 60] : [30, 45, 60, 120, 135, 150, 210, 225, 240, 300, 315, 330]),
      )!;
      const [a, b] = solveOnTurn((x) => near(evalFn(fn, x), value.value)) as [Frac, Frac];
      const lhs = fnL(fn, 'x');
      const wrap = (m: Frac): Frac => frac(((m.n % (2 * m.d)) + 2 * m.d) % (2 * m.d), m.d);
      const one = `x = ${piTex(a)} + 2k\\pi`;
      const both = (second: Frac): string => `${one} \\;\\lor\\; x = ${piTex(second)} + 2k\\pi`;
      const half = `x = ${piTex(a)} + k\\pi`;
      const mirrored = wrap(fSub(frac(1), a));
      const options =
        fn === 'tan'
          ? [
              { id: 'right', tex: half },
              { id: 'turn', tex: one },
              { id: 'pattern', tex: both(mirrored) },
              { id: 'quarter', tex: `x = ${piTex(a)} + k\\,\\frac{\\pi}{2}` },
            ]
          : [
              { id: 'right', tex: both(b) },
              { id: 'one', tex: one },
              { id: 'half', tex: half },
              { id: 'pattern', tex: fn === 'sin' ? `x = \\pm${piTex(a)} + 2k\\pi` : both(mirrored) },
            ];
      const shown = r.shuffle(options);
      return {
        prompt: L(
          `Která možnost popisuje všechna řešení rovnice $${lhs.cs} = ${value.tex}$ v $\\mathbb{R}$? ($k \\in \\mathbb{Z}$)`,
          `Which option describes all solutions of $${lhs.en} = ${value.tex}$ in $\\mathbb{R}$? ($k \\in \\mathbb{Z}$)`,
        ),
        answer: {
          kind: 'choice',
          options: shown.map((option) => ({ id: option.id, text: L(`$${option.tex}$`, `$${option.tex}$`) })),
          correct: ['right'],
          fixedOrder: true,
        },
        hints: [
          L(
            'Nejdřív najdi řešení v jedné otáčce. Kolik jich je?',
            'First find the solutions within one turn. How many are there?',
          ),
          fn === 'tan'
            ? L(
                'Tangens se opakuje po $\\pi$, takže obě řešení z jedné otáčky pokryje jediný zápis.',
                'Tangent repeats after $\\pi$, so a single formula covers both solutions of one turn.',
              )
            : L(
                'Sinus a kosinus se opakují až po $2\\pi$. Každé řešení z jedné otáčky dostane svůj vlastní zápis.',
                'Sine and cosine repeat only after $2\\pi$. Each solution of one turn gets its own formula.',
              ),
        ],
        solution: [
          step(
            'Řešení v jedné otáčce:',
            'Solutions within one turn:',
            mapL(angleSetL([a, b]), (set) => `x \\in ${set}`),
          ),
          fn === 'tan'
            ? step(
                `Obě řešení se liší právě o periodu $\\pi$, takže stačí jeden zápis:`,
                `The two solutions differ by exactly the period $\\pi$, so one formula is enough:`,
                half,
              )
            : step(
                'Perioda je $2\\pi$, ke každému řešení přičteme její celé násobky:',
                'The period is $2\\pi$; add its whole multiples to each solution:',
                both(b),
              ),
        ],
        misconceptions:
          fn === 'tan'
            ? [
                mc(
                  'turn',
                  'incomplete',
                  'To je jen polovina řešení: tangens se opakuje už po $\\pi$.',
                  'That is only half of the solutions: tangent already repeats after $\\pi$.',
                ),
                mc(
                  'pattern',
                  'concept',
                  'Tohle je vzor pro sinus. Pro $\\pi - x$ má tangens opačné znaménko.',
                  'That is the pattern for a sine. At $\\pi - x$ the tangent has the opposite sign.',
                ),
                mc(
                  'quarter',
                  'concept',
                  'Perioda tangens je $\\pi$, ne $\\frac{\\pi}{2}$.',
                  'The period of the tangent is $\\pi$, not $\\frac{\\pi}{2}$.',
                ),
              ]
            : [
                mc(
                  'one',
                  'incomplete',
                  'To je jen polovina řešení: v každé otáčce jsou dvě.',
                  'That is only half of the solutions: every turn holds two.',
                ),
                mc(
                  'half',
                  'concept',
                  `Perioda je $2\\pi$, ne $\\pi$: pro $x + \\pi$ má ${FN_WORD[fn].cs} opačné znaménko.`,
                  `The period is $2\\pi$, not $\\pi$: at $x + \\pi$ the ${FN_WORD[fn].en} has the opposite sign.`,
                ),
                mc(
                  'pattern',
                  'concept',
                  fn === 'sin'
                    ? 'Zápis s $\\pm$ patří ke kosinu. Druhé řešení sinu je $\\pi - x_1$.'
                    : 'Druhé řešení $\\pi - x_1$ patří k sinu. Pro kosinus je to $-x_1$, tedy $2\\pi - x_1$.',
                  fn === 'sin'
                    ? 'The $\\pm$ pattern belongs to the cosine. The second solution of a sine is $\\pi - x_1$.'
                    : 'The second solution $\\pi - x_1$ belongs to the sine. For a cosine it is $-x_1$, that is $2\\pi - x_1$.',
                ),
              ],
      };
    },
  }),

  gen({
    id: 'trigeq.advanced.quadratic',
    concept: 'trigeq.advanced',
    kind: 'hard',
    levels: [3, 4],
    title: L('Goniometrická rovnice: substituce', 'A trigonometric equation: substitution'),
    est: (lv) => 150 + 40 * (lv - 3),
    make(r, lv) {
      const fn = r.pick(['sin', 'cos'] as const);
      const other = fn === 'sin' ? 'cos' : 'sin';
      // Level 3: two usable roots, chosen so that the quadratic keeps all three terms
      // (neither root is zero and they are not opposite). Level 4: the second root lies
      // outside ⟨−1; 1⟩ and the square is written with the other function.
      const valid =
        lv === 3 ? [frac(-1), frac(-1, 2), frac(1, 2), frac(1)] : [frac(-1), frac(-1, 2), frac(0), frac(1, 2), frac(1)];
      const t1 = r.pick(valid);
      const t2 =
        lv === 3
          ? r.pick(valid.filter((t) => Math.abs(t.n / t.d) !== Math.abs(t1.n / t1.d)))
          : r.pick([frac(2), frac(-2), frac(3), frac(3, 2), frac(-3, 2)]);
      const scale = t1.d * t2.d;
      // scale·(t − t1)(t − t2) = A·t² + B·t + C with integer coefficients.
      const [A, B, C] = [scale, -(t1.n * t2.d + t2.n * t1.d), t1.n * t2.n];
      const s2 = `\\${fn}^2 x`;
      const s1 = `\\${fn} x`;
      const plain = sumTex([
        { c: A, tex: s2 },
        { c: B, tex: s1 },
        { c: C, tex: '' },
      ]);
      // Level 4 writes the square with the other function, so the identity is needed first:
      // A·s² = A − A·c², and the whole equation is multiplied by −1 to lead with a plus.
      const disguised = sumTex([
        { c: A, tex: `\\${other}^2 x` },
        { c: -B, tex: s1 },
        { c: -(A + C), tex: '' },
      ]);
      const equation = lv === 3 ? plain : disguised;
      const input =
        lv === 3 ? `${A}*${fn}(x)^2+(${B})*${fn}(x)+(${C})` : `${A}*${other}(x)^2-(${B})*${fn}(x)-(${A + C})`;
      const tValue = (t: Frac): number => t.n / t.d;
      const solutions = solveOnTurn((x) => [t1, t2].some((t) => near(evalFn(fn, x), tValue(t))));
      const forRoot = (t: Frac): Frac[] => solveOnTurn((x) => near(evalFn(fn, x), tValue(t)));
      const tTex = (t: Frac): string =>
        t.d === 1 ? `${t.n}` : `${t.n < 0 ? '-' : ''}\\frac{${Math.abs(t.n)}}{${t.d}}`;
      const [lo, hi] = tValue(t1) < tValue(t2) ? [t1, t2] : [t2, t1];
      const usable = [lo, hi].filter((t) => Math.abs(tValue(t)) <= 1);
      const rejected = [lo, hi].filter((t) => Math.abs(tValue(t)) > 1);
      const quadratic = polyTex([A, B, C], { variable: 't' });
      return {
        prompt: L(`Řešte v intervalu $${TURN.cs}$: $${equation} = 0$`, `Solve on $${TURN.en}$: $${equation} = 0$`),
        answer: { kind: 'set', values: solutions.map(piIn), unit: 'rad', label: 'K =', placeholder: 'pi/6; 5pi/6' },
        hints: [
          lv === 3
            ? L(
                `Rovnice je kvadratická v $${s1}$. Jakou substituci to nabízí?`,
                `The equation is quadratic in $${s1}$. What substitution does that suggest?`,
              )
            : L(
                `V rovnici jsou obě funkce. Pomocí $\\sin^2 x + \\cos^2 x = 1$ nahraď $\\${other}^2 x$, aby zbyl jen $${s1}$.`,
                `Both functions appear. Use $\\sin^2 x + \\cos^2 x = 1$ to replace $\\${other}^2 x$ so that only $${s1}$ remains.`,
              ),
          L(`Polož $t = ${s1}$ a vyřeš $${quadratic} = 0$.`, `Put $t = ${s1}$ and solve $${quadratic} = 0$.`),
          L(
            `$t = ${s1}$ leží vždy mezi $-1$ a $1$. Kořen mimo tento interval žádné řešení nedá.`,
            `$t = ${s1}$ always lies between $-1$ and $1$. A root outside that interval gives no solution.`,
          ),
        ],
        solution: [
          ...(lv === 4
            ? [
                step(
                  `Dosadíme $\\${other}^2 x = 1 - ${s2}$ a upravíme:`,
                  `Substitute $\\${other}^2 x = 1 - ${s2}$ and tidy up:`,
                  `${plain} = 0`,
                ),
              ]
            : []),
          step(
            `Substituce $t = ${s1}$, $t \\in \\langle -1;\\,1\\rangle$:`,
            `Substitution $t = ${s1}$, $-1 \\le t \\le 1$:`,
            `${quadratic} = 0`,
          ),
          step('Kořeny kvadratické rovnice:', 'Roots of the quadratic:', `t_1 = ${tTex(lo)},\\; t_2 = ${tTex(hi)}`),
          ...rejected.map((t) =>
            step(
              `$t = ${tTex(t)}$ nevyhovuje: $${s1}$ nemůže být ${tValue(t) > 0 ? 'větší než 1' : 'menší než −1'}.`,
              `$t = ${tTex(t)}$ is rejected: $${s1}$ cannot be ${tValue(t) > 0 ? 'greater than 1' : 'less than −1'}.`,
            ),
          ),
          ...usable.map((t) =>
            step(
              `Pro $t = ${tTex(t)}$:`,
              `For $t = ${tTex(t)}$:`,
              mapL(angleSetL(forRoot(t)), (set) => `${s1} = ${tTex(t)} \\;\\Rightarrow\\; x \\in ${set}`),
            ),
          ),
          step(
            'Množina řešení:',
            'Solution set:',
            mapL(angleSetL(solutions), (set) => `K = ${set}`),
          ),
        ],
        misconceptions: [
          mc(
            usable.map(fToInput).join('; '),
            'incomplete',
            `To jsou hodnoty $t$. Ještě je potřeba vyřešit $${s1} = t$.`,
            `Those are values of $t$. The equations $${s1} = t$ still have to be solved.`,
          ),
          ...(usable.length === 2
            ? usable.map((t) =>
                mc(
                  forRoot(t).map(piIn).join('; '),
                  'incomplete',
                  'To jsou řešení jen pro jeden kořen kvadratické rovnice. Druhý kořen dává další.',
                  'Those are the solutions for only one root of the quadratic. The other root gives more.',
                ),
              )
            : []),
        ],
        verify: [{ kind: 'roots', expr: input, range: [0, 6.2831] }],
      };
    },
  }),

  gen({
    id: 'trigeq.advanced.factor',
    concept: 'trigeq.advanced',
    kind: 'hard',
    levels: [3, 4],
    title: L('Goniometrická rovnice: vytýkat, nedělit', 'A trigonometric equation: factor, do not divide'),
    est: (lv) => 140 + 40 * (lv - 3),
    make(r, lv) {
      const f = r.pick(['sin', 'cos'] as const);
      const g = lv === 3 && r.bool(0.35) ? f : f === 'sin' ? 'cos' : 'sin';
      // 2·f·g = c·f, that is f·(2g − c) = 0, with c = ±1, ±√2 or ±√3.
      const size = r.pick([
        { tex: '1', input: '1', half: '\\frac{1}{2}', value: 1 },
        { tex: '\\sqrt{2}', input: 'sqrt(2)', half: '\\frac{\\sqrt{2}}{2}', value: Math.SQRT2 },
        { tex: '\\sqrt{3}', input: 'sqrt(3)', half: '\\frac{\\sqrt{3}}{2}', value: Math.sqrt(3) },
      ]);
      const sign = r.sign();
      const c = {
        input: `${sign < 0 ? '-' : ''}${size.input}`,
        half: `${sign < 0 ? '-' : ''}${size.half}`,
        value: sign * size.value,
      };
      const [fx, gx] = [`\\${f} x`, `\\${g} x`];
      const product = f === g ? `2\\${f}^2 x` : '2\\sin x\\cos x';
      const rhs = `${sign < 0 ? '-' : ''}${size.tex === '1' ? '' : `${size.tex}\\,`}${fx}`;
      const open = `${product} = ${rhs}`;
      const equation = lv === 4 ? `\\sin 2x = ${rhs}` : open;
      const input = lv === 4 ? `sin(2*x)-(${c.input})*${f}(x)` : `2*${f}(x)*${g}(x)-(${c.input})*${f}(x)`;
      const zerosOfF = solveOnTurn((x) => near(evalFn(f, x), 0));
      const fromG = solveOnTurn((x) => near(evalFn(g, x), c.value / 2));
      const solutions = solveOnTurn((x) => near(evalFn(f, x), 0) || near(evalFn(g, x), c.value / 2));
      const bracket = `2${gx} ${sign > 0 ? '-' : '+'} ${size.tex}`;
      return {
        prompt: L(`Řešte v intervalu $${TURN.cs}$: $${equation}$`, `Solve on $${TURN.en}$: $${equation}$`),
        answer: { kind: 'set', values: solutions.map(piIn), unit: 'rad', label: 'K =', placeholder: '0; pi/3; pi' },
        hints: [
          lv === 4
            ? L(
                'Rozepiš dvojnásobný úhel: $\\sin 2x = 2\\sin x\\cos x$.',
                'Expand the double angle: $\\sin 2x = 2\\sin x\\cos x$.',
              )
            : L(
                `Na obou stranách je $${fx}$. Nedělit — převést na jednu stranu a vytknout.`,
                `Both sides contain $${fx}$. Do not divide — move everything to one side and factor.`,
              ),
          L(
            `Proč nedělit: $${fx}$ může být nula, a dělením by se právě tato řešení ztratila.`,
            `Why not divide: $${fx}$ can be zero, and dividing would lose exactly those solutions.`,
          ),
          L(
            'Součin je nula, když je nulový aspoň jeden činitel. Vzniknou dvě základní rovnice.',
            'A product is zero when at least one factor is zero. Two basic equations result.',
          ),
        ],
        solution: [
          ...(lv === 4 ? [step('Dvojnásobný úhel:', 'The double angle:', open)] : []),
          step(
            'Převedeme na jednu stranu a vytkneme (nedělíme!):',
            'Move everything to one side and factor (no dividing!):',
            `${fx}\\,\\left(${bracket}\\right) = 0`,
          ),
          step(
            'Součin je nula, když je nulový některý činitel:',
            'A product is zero when one of its factors is:',
            `${fx} = 0 \\;\\lor\\; ${gx} = ${c.half}`,
          ),
          step(
            `První rovnice:`,
            `The first equation:`,
            mapL(angleSetL(zerosOfF), (set) => `${fx} = 0 \\;\\Rightarrow\\; x \\in ${set}`),
          ),
          step(
            `Druhá rovnice:`,
            `The second equation:`,
            mapL(angleSetL(fromG), (set) => `${gx} = ${c.half} \\;\\Rightarrow\\; x \\in ${set}`),
          ),
          step(
            'Množina řešení:',
            'Solution set:',
            mapL(angleSetL(solutions), (set) => `K = ${set}`),
          ),
        ],
        misconceptions: [
          mc(
            fromG.map(piIn).join('; '),
            'concept',
            `Dělil(a) jsi výrazem $${fx}$, který může být nula — tím se ztratila řešení rovnice $${fx} = 0$. Místo dělení vytýkej.`,
            `You divided by $${fx}$, which can be zero — that lost the solutions of $${fx} = 0$. Factor instead of dividing.`,
          ),
          mc(
            zerosOfF.map(piIn).join('; '),
            'incomplete',
            'To jsou řešení jen z prvního činitele. Druhá závorka dává další.',
            'Those come from the first factor only. The bracket gives more.',
          ),
        ],
        verify: [{ kind: 'roots', expr: input, range: [0, 6.2831] }],
      };
    },
  }),
];

/** A fraction for display inside an inequality chain: −3, 1/2, … */
function fToTexSigned(value: Frac): string {
  if (value.d === 1) return `${value.n}`;
  return `${value.n < 0 ? '-' : ''}\\frac{${Math.abs(value.n)}}{${value.d}}`;
}
