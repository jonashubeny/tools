import { L, fToInput, fToTex, frac, type FigureSpec, type Frac, type Generator } from '@lemma/core';
import { gen, mc, step } from './helpers';
import { QUADRANT_IN, degTex, fromDeg, piIn, piTex, quadrant, referenceDeg } from './trig-kit';

/**
 * Syllabus topic 14: complex numbers in trigonometric form.
 *
 * Everything is built from numbers whose modulus and argument are both "nice": the
 * argument is a multiple of 30° or 45°, and the modulus is chosen so that the real and
 * imaginary parts come out as c·√m with m ∈ {1, 2, 3}.
 */

/** A real number of the form ±(c/d)·√m, m ∈ {1, 2, 3}, d ∈ {1, 2}. */
interface Surd {
  value: number;
  tex: string;
  /** Without the sign, for use after "+" or "−". */
  absTex: string;
  input: string;
  absIn: string;
}

/** Recognise a value as (c/d)·√m. Throws when it is not of that form: a generator bug. */
function surd(value: number): Surd {
  if (Math.abs(value) < 1e-9) return { value: 0, tex: '0', absTex: '0', input: '0', absIn: '0' };
  const size = Math.abs(value);
  for (const d of [1, 2]) {
    for (const m of [1, 2, 3]) {
      const c = (size * d) / Math.sqrt(m);
      if (Math.abs(c - Math.round(c)) > 1e-7 || Math.round(c) === 0) continue;
      const n = Math.round(c);
      const top = m === 1 ? `${n}` : `${n === 1 ? '' : n}\\sqrt{${m}}`;
      const absTex = d === 1 ? top : `\\frac{${top}}{${d}}`;
      const absIn = `${m === 1 ? `${n}` : n === 1 ? `sqrt(${m})` : `${n}*sqrt(${m})`}${d === 1 ? '' : `/${d}`}`;
      // The value is rebuilt from its parts, so that 1 is exactly 1 and not 1.0000000000000002.
      const exactValue = (Math.sign(value) * n * Math.sqrt(m)) / d;
      return {
        value: exactValue,
        tex: value < 0 ? `-${absTex}` : absTex,
        absTex,
        input: value < 0 ? `-${absIn}` : absIn,
        absIn,
      };
    }
  }
  throw new Error(`${value} is not of the form (c/d)·√m`);
}

/** a + bi the way it is written: parts that are zero are left out, a coefficient 1 is not shown. */
function algebraicTex(re: Surd, im: Surd): string {
  const unit = (part: Surd): string =>
    part.absTex === '1'
      ? '\\mathrm{i}'
      : `${part.absTex}${part.absTex.includes('sqrt') || part.absTex.includes('frac') ? '\\,' : ''}\\mathrm{i}`;
  if (im.value === 0) return re.tex;
  if (re.value === 0) return `${im.value < 0 ? '-' : ''}${unit(im)}`;
  return `${re.tex} ${im.value < 0 ? '-' : '+'} ${unit(im)}`;
}

/** The same number as parser input, written naturally so that it also displays naturally: 2-2*i. */
function algebraicIn(re: Surd, im: Surd): string {
  const unit = im.absIn === '1' ? 'i' : `${im.absIn}*i`;
  if (im.value === 0) return re.input;
  if (re.value === 0) return `${im.value < 0 ? '-' : ''}${unit}`;
  return `${re.input}${im.value < 0 ? '-' : '+'}${unit}`;
}

interface Polar {
  /** Modulus. */
  r: Surd;
  /** Argument in degrees, in ⟨0; 360). */
  deg: number;
  re: Surd;
  im: Surd;
  tex: string;
  input: string;
}

/** The complex number with the given modulus and argument. */
function polar(modulus: number, deg: number): Polar {
  const turn = ((deg % 360) + 360) % 360;
  const rad = (turn * Math.PI) / 180;
  const re = surd(modulus * Math.cos(rad));
  const im = surd(modulus * Math.sin(rad));
  return { r: surd(modulus), deg: turn, re, im, tex: algebraicTex(re, im), input: algebraicIn(re, im) };
}

/** A number with a nice modulus for its argument: k on the axes, k√2 on the diagonals, 2k otherwise. */
function nice(deg: number, k: number): Polar {
  const ref = referenceDeg(deg);
  return polar(ref === 45 ? k * Math.SQRT2 : ref === 30 || ref === 60 ? 2 * k : k, deg);
}

/** The square of a part, bracketed only where the square would otherwise bind to less than the whole: (−1)², (3√3)², but 2². */
const squared = (part: Surd): string => (/^\d+$/.test(part.tex) ? `${part.tex}^2` : `\\left(${part.tex}\\right)^2`);

/** r(cos φ + i sin φ), with the angle in degrees or radians. */
function trigTex(r: string, angle: string): string {
  const sum = `\\cos ${angle} + \\mathrm{i}\\sin ${angle}`;
  return r === '1' ? sum : `${r}\\left(${sum}\\right)`;
}

const rad = (deg: number): string => piTex(fromDeg(deg));
const radIn = (deg: number): string => piIn(fromDeg(deg));

/** The Gauss plane with one number marked. */
function plane(points: { re: number; im: number; label: string }[]): FigureSpec {
  const reach = Math.max(3, ...points.flatMap((point) => [Math.abs(point.re), Math.abs(point.im)])) + 1;
  return {
    view: { xMin: -reach, xMax: reach, yMin: -reach, yMax: reach },
    aspect: 1,
    maxWidth: 380,
    axisLabels: ['Re', 'Im'],
    segments: points.map((point) => ({
      from: [0, 0] as [number, number],
      to: [point.re, point.im] as [number, number],
      color: 'a' as const,
    })),
    points: points.map((point) => ({ x: point.re, y: point.im, label: point.label, color: 'a' as const })),
  };
}

/** √n with the largest square taken out: √8 = 2√2. */
function rootOf(n: number): { tex: string; input: string } {
  let outside = 1;
  for (let k = Math.floor(Math.sqrt(n)); k > 1; k--) {
    if (n % (k * k) === 0) {
      outside = k;
      break;
    }
  }
  const inside = n / (outside * outside);
  if (inside === 1) return { tex: `${outside}`, input: `${outside}` };
  return {
    tex: `${outside === 1 ? '' : outside}\\sqrt{${inside}}`,
    input: outside === 1 ? `sqrt(${inside})` : `${outside}*sqrt(${inside})`,
  };
}

const POINT_NOTE = L(
  'Odpověď zadejte jako dvojici $[\\,|z|;\\ \\varphi\\,]$, kde $\\varphi \\in \\langle 0;\\,2\\pi)$ je v radiánech.',
  'Give the answer as the pair $(|z|,\\ \\varphi)$, where $\\varphi \\in [0,\\,2\\pi)$ is in radians.',
);

export const COMPLEX_GENERATORS: Generator[] = [
  gen({
    id: 'cplx.polar.modulus',
    concept: 'cplx.polar',
    kind: 'warmup',
    levels: [1, 2],
    title: L('Absolutní hodnota komplexního čísla', 'The modulus of a complex number'),
    est: (lv) => 35 + 15 * lv,
    make(r, lv) {
      const [p, q] =
        lv === 1
          ? r.pick([
              [3, 4],
              [4, 3],
              [6, 8],
              [8, 6],
              [5, 12],
              [12, 5],
              [8, 15],
            ] as const)
          : r.pick([
              [1, 1],
              [2, 2],
              [1, 2],
              [2, 1],
              [2, 3],
              [1, 3],
              [3, 3],
              [2, 4],
              [4, 4],
              [3, 1],
            ] as const);
      const [a, b] = [p * r.sign(), q * r.sign()];
      const square = a * a + b * b;
      const result = rootOf(square);
      const z = `${a} ${b < 0 ? '-' : '+'} ${Math.abs(b) === 1 ? '' : Math.abs(b)}\\mathrm{i}`;
      return {
        prompt: L(
          `Určete absolutní hodnotu komplexního čísla $z = ${z}$.`,
          `Find the modulus of the complex number $z = ${z}$.`,
        ),
        figure: plane([{ re: a, im: b, label: 'z' }]),
        answer: { kind: 'number', value: result.input, label: '|z| =' },
        hints: [
          L(
            'Absolutní hodnota je vzdálenost bodu od počátku v Gaussově rovině.',
            'The modulus is the distance of the point from the origin in the complex plane.',
          ),
          L(
            'Pythagorova věta: $|a + b\\mathrm{i}| = \\sqrt{a^2 + b^2}$.',
            "Pythagoras' theorem: $|a + b\\mathrm{i}| = \\sqrt{a^2 + b^2}$.",
          ),
        ],
        solution: [
          step(
            'Vzdálenost od počátku podle Pythagorovy věty:',
            "The distance from the origin by Pythagoras' theorem:",
            `|z| = \\sqrt{${a < 0 ? `(${a})` : a}^2 + ${b < 0 ? `(${b})` : b}^2} = \\sqrt{${square}}${result.tex === `\\sqrt{${square}}` ? '' : ` = ${result.tex}`}`,
          ),
        ],
        misconceptions: [
          mc(
            `${Math.abs(a) + Math.abs(b)}`,
            'formula',
            'Vzdálenost od počátku není součet souřadnic: jde o přeponu, ne o cestu po odvěsnách.',
            'The distance from the origin is not the sum of the coordinates: it is the hypotenuse, not the walk along the legs.',
          ),
          mc(`${square}`, 'incomplete', 'To je $|z|^2$. Ještě odmocnit.', 'That is $|z|^2$. Take the square root.'),
          mc(
            `sqrt(${Math.abs(a * a - b * b)})`,
            'sign',
            'Do absolutní hodnoty se $\\mathrm{i}^2 = -1$ nepočítá: sčítají se druhé mocniny reálných čísel $a$ a $b$.',
            'The modulus does not involve $\\mathrm{i}^2 = -1$: add the squares of the real numbers $a$ and $b$.',
          ),
        ],
        verify: [{ kind: 'value', expr: `sqrt((${a})^2+(${b})^2)` }],
      };
    },
  }),

  gen({
    id: 'cplx.polar.argument',
    concept: 'cplx.polar',
    kind: 'core',
    levels: [2, 3],
    title: L('Argument komplexního čísla', 'The argument of a complex number'),
    est: (lv) => 60 + 25 * (lv - 2),
    make(r, lv) {
      const deg = r.pick(
        lv === 2 ? [90, 180, 270, 45, 135, 225, 315, 135, 225, 315] : [30, 60, 120, 150, 210, 240, 300, 330],
      );
      const z = nice(deg, r.int(1, 3));
      const q = quadrant(deg);
      const ref = referenceDeg(deg);
      return {
        prompt: L(
          `Určete argument $\\varphi \\in \\langle 0;\\,2\\pi)$ komplexního čísla $z = ${z.tex}$.`,
          `Find the argument $\\varphi \\in [0,\\,2\\pi)$ of the complex number $z = ${z.tex}$.`,
        ),
        answer: { kind: 'number', value: radIn(deg), unit: 'rad', label: '\\varphi =', placeholder: '3pi/4' },
        hints: [
          L(
            'Zakresli si číslo do Gaussovy roviny. Ve kterém kvadrantu (nebo na které ose) leží?',
            'Plot the number in the complex plane. In which quadrant (or on which axis) does it lie?',
          ),
          q === 0
            ? L(
                'Leží na ose, takže argument je násobek $\\frac{\\pi}{2}$.',
                'It lies on an axis, so the argument is a multiple of $\\frac{\\pi}{2}$.',
              )
            : L(
                'Referenční úhel najdeš z $\\operatorname{tg}\\alpha = \\dfrac{|b|}{|a|}$. Pak ho umísti do správného kvadrantu.',
                'Find the reference angle from $\\tan\\alpha = \\dfrac{|b|}{|a|}$. Then place it in the right quadrant.',
              ),
        ],
        solution:
          q === 0
            ? [
                step(
                  `Číslo leží na ${deg % 180 === 0 ? 'reálné' : 'imaginární'} ose, na její ${deg === 0 || deg === 90 ? 'kladné' : 'záporné'} části:`,
                  `The number lies on the ${deg % 180 === 0 ? 'real' : 'imaginary'} axis, on its ${deg === 0 || deg === 90 ? 'positive' : 'negative'} part:`,
                  `\\varphi = ${rad(deg)}`,
                ),
              ]
            : [
                step(
                  `Reálná část je ${z.re.value > 0 ? 'kladná' : 'záporná'}, imaginární ${z.im.value > 0 ? 'kladná' : 'záporná'}: číslo leží ${QUADRANT_IN[q].cs}.`,
                  `The real part is ${z.re.value > 0 ? 'positive' : 'negative'}, the imaginary part ${z.im.value > 0 ? 'positive' : 'negative'}: the number lies ${QUADRANT_IN[q].en}.`,
                ),
                step(
                  'Referenční úhel:',
                  'The reference angle:',
                  L(
                    `\\operatorname{tg}\\alpha = \\frac{${z.im.absTex}}{${z.re.absTex}} \\;\\Rightarrow\\; \\alpha = ${rad(ref)}`,
                    `\\tan\\alpha = \\frac{${z.im.absTex}}{${z.re.absTex}} \\;\\Rightarrow\\; \\alpha = ${rad(ref)}`,
                  ),
                ),
                step(
                  `Umístíme ho ${QUADRANT_IN[q].cs}:`,
                  `Place it ${QUADRANT_IN[q].en}:`,
                  `\\varphi = ${q === 1 ? rad(ref) : q === 2 ? `\\pi - ${rad(ref)} = ${rad(deg)}` : q === 3 ? `\\pi + ${rad(ref)} = ${rad(deg)}` : `2\\pi - ${rad(ref)} = ${rad(deg)}`}`,
                ),
              ],
        misconceptions:
          q === 0
            ? [
                mc(
                  radIn((deg + 180) % 360),
                  'sign',
                  'To je opačný směr. Zkontroluj znaménko.',
                  'That is the opposite direction. Check the sign.',
                ),
              ]
            : [
                mc(
                  radIn(ref),
                  'concept',
                  `To je referenční úhel. Číslo ale leží ${QUADRANT_IN[q].cs}.`,
                  `That is the reference angle. But the number lies ${QUADRANT_IN[q].en}.`,
                ),
                mc(
                  radIn((deg + 180) % 360),
                  'concept',
                  'Tangens má periodu $\\pi$, takže stejný podíl $\\frac{b}{a}$ mají dva protilehlé kvadranty. Rozhodnou znaménka $a$ a $b$.',
                  'Tangent has period $\\pi$, so two opposite quadrants share the same quotient $\\frac{b}{a}$. The signs of $a$ and $b$ decide.',
                ),
                mc(
                  radIn(360 - deg),
                  'sign',
                  'To je argument čísla komplexně sdruženého (zrcadlení podle reálné osy).',
                  'That is the argument of the complex conjugate (the mirror image in the real axis).',
                ),
              ],
        // φ recovered independently from cos φ = a/|z|, mirrored when the imaginary part is negative.
        verify: [{ kind: 'value', expr: `acos((${z.re.input})/(${z.r.input}))${z.im.value < 0 ? '*(-1)+2*pi' : ''}` }],
      };
    },
  }),

  gen({
    id: 'cplx.polar.form',
    concept: 'cplx.polar',
    kind: 'core',
    levels: [2, 3],
    title: L('Převod do goniometrického tvaru', 'Converting to trigonometric form'),
    tags: ['annual-review'],
    est: (lv) => 90 + 30 * (lv - 2),
    make(r, lv) {
      const deg = r.pick(lv === 2 ? [45, 135, 225, 315, 90, 180, 270] : [30, 60, 120, 150, 210, 240, 300, 330]);
      const z = nice(deg, r.int(1, 3));
      const q = quadrant(deg);
      const ref = referenceDeg(deg);
      const pair = (modulus: string, angle: string): string => `${modulus}; ${angle}`;
      return {
        prompt: L(
          `Zapište číslo $z = ${z.tex}$ v goniometrickém tvaru $z = |z|\\,(\\cos\\varphi + \\mathrm{i}\\sin\\varphi)$. ${POINT_NOTE.cs}`,
          `Write $z = ${z.tex}$ in trigonometric form $z = |z|\\,(\\cos\\varphi + \\mathrm{i}\\sin\\varphi)$. ${POINT_NOTE.en}`,
        ),
        answer: { kind: 'point', coords: [z.r.input, radIn(deg)], placeholder: '2; pi/3' },
        hints: [
          L('Nejdřív absolutní hodnota: $|z| = \\sqrt{a^2 + b^2}$.', 'The modulus first: $|z| = \\sqrt{a^2 + b^2}$.'),
          L(
            'Pak argument: $\\cos\\varphi = \\dfrac{a}{|z|}$, $\\sin\\varphi = \\dfrac{b}{|z|}$. Oba vztahy musí platit zároveň — tím je určen kvadrant.',
            'Then the argument: $\\cos\\varphi = \\dfrac{a}{|z|}$, $\\sin\\varphi = \\dfrac{b}{|z|}$. Both must hold at once — that fixes the quadrant.',
          ),
        ],
        solution: [
          step('Absolutní hodnota:', 'The modulus:', `|z| = \\sqrt{${squared(z.re)} + ${squared(z.im)}} = ${z.r.tex}`),
          step(
            'Argument:',
            'The argument:',
            `\\cos\\varphi = \\frac{${z.re.tex}}{${z.r.tex}} = ${surd(z.re.value / z.r.value).tex},\\quad \\sin\\varphi = \\frac{${z.im.tex}}{${z.r.tex}} = ${surd(z.im.value / z.r.value).tex} \\;\\Rightarrow\\; \\varphi = ${rad(deg)}`,
          ),
          step('Goniometrický tvar:', 'The trigonometric form:', `z = ${trigTex(z.r.tex, rad(deg))}`),
        ],
        misconceptions: [
          ...(q === 0
            ? []
            : [
                mc(
                  pair(z.r.input, radIn(ref)),
                  'concept',
                  `Úhel je jen referenční. Číslo leží ${QUADRANT_IN[q].cs}.`,
                  `That is only the reference angle. The number lies ${QUADRANT_IN[q].en}.`,
                ),
              ]),
          mc(
            pair(z.r.input, radIn((deg + 180) % 360)),
            'concept',
            'Absolutní hodnota sedí, ale úhel míří na opačnou stranu. Zkontroluj znaménka $\\cos\\varphi$ a $\\sin\\varphi$.',
            'The modulus is right, but the angle points the opposite way. Check the signs of $\\cos\\varphi$ and $\\sin\\varphi$.',
          ),
          mc(
            pair(`(${z.r.input})^2`, radIn(deg)),
            'incomplete',
            'Úhel sedí. Absolutní hodnota je ale odmocnina ze součtu čtverců.',
            'The angle is right. But the modulus is the square root of the sum of squares.',
          ),
          mc(
            pair(radIn(deg), z.r.input),
            'misread',
            'Hodnoty jsou správně, ale v opačném pořadí: nejdřív $|z|$, potom $\\varphi$.',
            'The values are right but in the wrong order: $|z|$ first, then $\\varphi$.',
          ),
        ],
        // x = |z| and y = φ must reproduce both parts of z.
        verify: [{ kind: 'solves', exprs: [`x*cos(y)-(${z.re.input})`, `x*sin(y)-(${z.im.input})`] }],
      };
    },
  }),

  gen({
    id: 'cplx.polar.convert',
    concept: 'cplx.polar',
    kind: 'core',
    levels: [2, 3],
    title: L('Z goniometrického tvaru do algebraického', 'From trigonometric to algebraic form'),
    est: (lv) => 70 + 25 * (lv - 2),
    make(r, lv) {
      const deg = r.pick(
        lv === 2 ? [30, 45, 60, 90, 180, 120, 135, 150] : [210, 225, 240, 270, 300, 315, 330, 150, 120],
      );
      const z = nice(deg, r.int(1, 3));
      const unitRe = surd(Math.cos((deg * Math.PI) / 180));
      const unitIm = surd(Math.sin((deg * Math.PI) / 180));
      const angle = lv === 2 && r.bool(0.4) ? degTex(deg) : rad(deg);
      const swapped = polar(z.r.value, 90 - deg);
      return {
        prompt: L(
          `Zapište v algebraickém tvaru $a + b\\mathrm{i}$: $z = ${trigTex(z.r.tex, angle)}$`,
          `Write in algebraic form $a + b\\mathrm{i}$: $z = ${trigTex(z.r.tex, angle)}$`,
        ),
        answer: { kind: 'complex', value: z.input, form: 'algebraic', label: 'z =', placeholder: '-1 + sqrt(3) i' },
        hints: [
          L(
            'Dosaď přesné hodnoty kosinu a sinu — pozor na znaménka podle kvadrantu.',
            'Substitute the exact values of the cosine and the sine — mind the signs for the quadrant.',
          ),
          L(`Pak závorku vynásob číslem $${z.r.tex}$.`, `Then multiply the bracket by $${z.r.tex}$.`),
        ],
        solution: [
          step(
            'Přesné hodnoty:',
            'The exact values:',
            `\\cos ${angle} = ${unitRe.tex},\\quad \\sin ${angle} = ${unitIm.tex}`,
          ),
          step(
            'Roznásobíme:',
            'Multiply out:',
            `z = ${z.r.tex}\\left(${algebraicTex(unitRe, unitIm)}\\right) = ${z.tex}`,
          ),
        ],
        misconceptions: [
          ...(z.r.value === 1
            ? []
            : [
                mc(
                  algebraicIn(unitRe, unitIm),
                  'incomplete',
                  `Chybí násobení absolutní hodnotou $${z.r.tex}$.`,
                  `The multiplication by the modulus $${z.r.tex}$ is missing.`,
                ),
              ]),
          mc(
            swapped.input,
            'concept',
            'Reálná část patří ke kosinu, imaginární k sinu — máš je prohozené.',
            'The real part goes with the cosine, the imaginary part with the sine — you have them swapped.',
          ),
          mc(
            polar(z.r.value, referenceDeg(deg)).input,
            'sign',
            'Velikosti sedí, znaménka ne: urči kvadrant úhlu.',
            'The sizes are right, the signs are not: find the quadrant of the angle.',
          ),
        ],
      };
    },
  }),

  gen({
    id: 'cplx.moivre.multiply',
    concept: 'cplx.moivre',
    kind: 'core',
    levels: [2, 3],
    title: L('Násobení a dělení v goniometrickém tvaru', 'Multiplying and dividing in trigonometric form'),
    tags: ['annual-review'],
    est: (lv) => 70 + 30 * (lv - 2),
    make(r, lv) {
      const divide = lv === 3 && r.bool(0.6);
      const angles = [30, 45, 60, 90, 120, 135, 150, 180, 210, 225, 240, 270, 300, 315, 330];
      // Level 2 stays inside one turn; a level-3 product runs past it and has to be brought
      // back into ⟨0; 2π), and a quotient may come out negative.
      const alpha = r.pick(lv === 2 ? angles.filter((angle) => angle <= 300) : angles);
      const beta = r.pick(
        angles.filter(
          (angle) => angle !== alpha && (divide || (lv === 2 ? alpha + angle < 360 : alpha + angle >= 360)),
        ),
      );
      const r2 = r.int(2, 4);
      const r1 = divide ? r2 * r.int(2, 4) : r.int(2, 5);
      const modulus = divide ? frac(r1, r2) : frac(r1 * r2);
      const rawDeg = divide ? alpha - beta : alpha + beta;
      const deg = ((rawDeg % 360) + 360) % 360;
      const raw = fromDeg(rawDeg);
      const op = divide ? '-' : '+';
      const task = divide ? `\\dfrac{z_1}{z_2}` : 'z_1 \\cdot z_2';
      const pair = (m: Frac, angle: Frac): string => `${fToInput(m)}; ${piIn(angle)}`;
      return {
        prompt: L(
          `Jsou dána čísla $z_1 = ${trigTex(`${r1}`, rad(alpha))}$ a $z_2 = ${trigTex(`${r2}`, rad(beta))}$. Určete $${task}$ v goniometrickém tvaru. ${POINT_NOTE.cs}`,
          `Given $z_1 = ${trigTex(`${r1}`, rad(alpha))}$ and $z_2 = ${trigTex(`${r2}`, rad(beta))}$, find $${task}$ in trigonometric form. ${POINT_NOTE.en}`,
        ),
        answer: { kind: 'point', coords: [fToInput(modulus), radIn(deg)], placeholder: '6; 5pi/6' },
        hints: [
          divide
            ? L(
                'Při dělení se absolutní hodnoty dělí a argumenty odčítají.',
                'In division the moduli are divided and the arguments subtracted.',
              )
            : L(
                'Při násobení se absolutní hodnoty násobí a argumenty sčítají.',
                'In multiplication the moduli multiply and the arguments add.',
              ),
          L(
            'Vyjde-li úhel mimo $\\langle 0;\\,2\\pi)$, přičti nebo odečti celou otáčku.',
            'If the angle falls outside $[0,\\,2\\pi)$, add or subtract a full turn.',
          ),
        ],
        solution: [
          step(
            divide ? 'Absolutní hodnoty dělíme:' : 'Absolutní hodnoty násobíme:',
            divide ? 'Divide the moduli:' : 'Multiply the moduli:',
            divide
              ? `|z| = \\frac{${r1}}{${r2}} = ${fToTex(modulus)}`
              : `|z| = ${r1} \\cdot ${r2} = ${fToTex(modulus)}`,
          ),
          step(
            divide ? 'Argumenty odčítáme:' : 'Argumenty sčítáme:',
            divide ? 'Subtract the arguments:' : 'Add the arguments:',
            `\\varphi = ${rad(alpha)} ${op} ${rad(beta)} = ${piTex(raw)}`,
          ),
          ...(rawDeg === deg
            ? []
            : [
                step(
                  'Úhel vrátíme do základního intervalu:',
                  'Bring the angle back into the basic interval:',
                  `${piTex(raw)} ${rawDeg < 0 ? '+' : '-'} 2\\pi = ${rad(deg)}`,
                ),
              ]),
          step('Výsledek:', 'The result:', `${task} = ${trigTex(fToTex(modulus), rad(deg))}`),
        ],
        misconceptions: [
          ...(rawDeg === deg
            ? []
            : [
                mc(
                  pair(modulus, raw),
                  'incomplete',
                  'Úhel je správně, ale mimo interval $\\langle 0;\\,2\\pi)$: přičti nebo odečti $2\\pi$.',
                  'The angle is right but outside $[0,\\,2\\pi)$: add or subtract $2\\pi$.',
                ),
              ]),
          mc(
            pair(divide ? frac(r1 - r2) : frac(r1 + r2), fromDeg(deg)),
            'formula',
            divide
              ? 'Úhel sedí. Absolutní hodnoty se ale dělí, neodčítají.'
              : 'Úhel sedí. Absolutní hodnoty se ale násobí, nesčítají.',
            divide
              ? 'The angle is right. But the moduli are divided, not subtracted.'
              : 'The angle is right. But the moduli multiply; they do not add.',
          ),
          mc(
            pair(modulus, fromDeg((((divide ? alpha + beta : alpha - beta) % 360) + 360) % 360)),
            'formula',
            divide
              ? 'Při dělení se argumenty odčítají, ne sčítají.'
              : 'Při násobení se argumenty sčítají, ne odčítají.',
            divide
              ? 'In division the arguments are subtracted, not added.'
              : 'In multiplication the arguments add; they are not subtracted.',
          ),
          ...(divide
            ? [
                mc(
                  pair(frac(r1 * r2), fromDeg(deg)),
                  'formula',
                  'Úhel sedí, ale absolutní hodnoty se při dělení dělí.',
                  'The angle is right, but in division the moduli are divided.',
                ),
              ]
            : []),
        ],
        verify: [
          {
            kind: 'solves',
            exprs: [
              `x-(${divide ? `${r1}/${r2}` : `${r1}*${r2}`})`,
              `cos(y)-cos((${alpha}${divide ? '-' : '+'}${beta})*pi/180)`,
              `sin(y)-sin((${alpha}${divide ? '-' : '+'}${beta})*pi/180)`,
            ],
          },
        ],
      };
    },
  }),

  gen({
    id: 'cplx.moivre.power',
    concept: 'cplx.moivre',
    kind: 'hard',
    levels: [3, 4],
    title: L('Moivreova věta: mocnina komplexního čísla', "De Moivre's theorem: a power of a complex number"),
    tags: ['annual-review'],
    est: (lv) => 150 + 40 * (lv - 3),
    make(r, lv) {
      // Level 3: the diagonals (1 ± i and friends). Level 4: the 30° and 60° directions.
      const deg = r.pick(lv === 3 ? [45, 135, 225, 315] : [30, 60, 120, 150, 210, 240, 300, 330]);
      const n = r.pick(lv === 3 ? [4, 6, 8, 10, 3, 5] : [3, 4, 5, 6]);
      const z = nice(deg, 1);
      const modulus = z.r.value ** n;
      const result = polar(modulus, deg * n);
      const power = surd(modulus);
      const total = fromDeg(deg * n);
      const reduced = fromDeg(result.deg);
      const turns = (deg * n - result.deg) / 360;
      // What comes out when the exponent is applied to each part separately.
      const partwise = { re: z.re.value ** n, im: z.im.value ** n };
      return {
        prompt: L(
          `Vypočítejte a výsledek zapište v algebraickém tvaru: $\\left(${z.tex}\\right)^{${n}}$`,
          `Compute and give the result in algebraic form: $\\left(${z.tex}\\right)^{${n}}$`,
        ),
        answer: { kind: 'complex', value: result.input, form: 'algebraic', placeholder: '-4 + 4i' },
        hints: [
          L(
            'Roznásobovat závorku je zdlouhavé. Převeď číslo do goniometrického tvaru.',
            'Expanding the bracket is tedious. Convert the number to trigonometric form.',
          ),
          L(
            `Moivreova věta: $z^n = |z|^n\\,(\\cos n\\varphi + \\mathrm{i}\\sin n\\varphi)$. Absolutní hodnota se umocní, argument se vynásobí.`,
            `De Moivre's theorem: $z^n = |z|^n\\,(\\cos n\\varphi + \\mathrm{i}\\sin n\\varphi)$. The modulus is raised to the power, the argument is multiplied.`,
          ),
          L(
            'Velký úhel zmenši o celé otáčky a pak převeď zpět do algebraického tvaru.',
            'Reduce the large angle by whole turns, then convert back to algebraic form.',
          ),
        ],
        solution: [
          step(
            'Goniometrický tvar základu:',
            'The trigonometric form of the base:',
            `|z| = ${z.r.tex},\\; \\varphi = ${rad(deg)} \\;\\Rightarrow\\; z = ${trigTex(z.r.tex, rad(deg))}`,
          ),
          step(
            'Moivreova věta:',
            "De Moivre's theorem:",
            `z^{${n}} = ${z.r.tex.includes('sqrt') ? `\\left(${z.r.tex}\\right)` : z.r.tex}^{${n}}\\left(\\cos ${piTex(total)} + \\mathrm{i}\\sin ${piTex(total)}\\right) = ${trigTex(power.tex, piTex(total))}`,
          ),
          ...(turns === 0
            ? []
            : [
                step(
                  'Odečteme celé otáčky:',
                  'Drop the whole turns:',
                  `${piTex(total)} - ${turns === 1 ? '' : `${turns} \\cdot `}2\\pi = ${piTex(reduced)}`,
                ),
              ]),
          step(
            'Zpět do algebraického tvaru:',
            'Back to algebraic form:',
            `${trigTex(power.tex, piTex(reduced))} = ${result.tex}`,
          ),
        ],
        misconceptions: [
          mc(
            algebraicIn(surd(partwise.re), surd(partwise.im)),
            'formula',
            'Mocnina součtu není součet mocnin: $(a + b\\mathrm{i})^n \\ne a^n + b^n\\mathrm{i}$.',
            'A power of a sum is not the sum of the powers: $(a + b\\mathrm{i})^n \\ne a^n + b^n\\mathrm{i}$.',
          ),
          mc(
            polar(modulus, deg).input,
            'incomplete',
            'Absolutní hodnota je správně, ale argument zůstal původní. Argument se násobí exponentem.',
            'The modulus is right, but the argument stayed as it was. The argument is multiplied by the exponent.',
          ),
          mc(
            `${n}*(${z.r.input})*(cos(${deg * n}*pi/180)+i*sin(${deg * n}*pi/180))`,
            'formula',
            'Absolutní hodnota se umocňuje, ne násobí exponentem.',
            'The modulus is raised to the power, not multiplied by the exponent.',
          ),
          mc(
            polar(modulus, -deg * n).input,
            'sign',
            'To je číslo komplexně sdružené: zkontroluj znaménko imaginární části.',
            'That is the complex conjugate: check the sign of the imaginary part.',
          ),
        ],
      };
    },
  }),

  gen({
    id: 'cplx.moivre.rotation',
    concept: 'cplx.moivre',
    kind: 'applied',
    levels: [2, 3],
    title: L('Násobení jako otočení', 'Multiplication as rotation'),
    est: (lv) => 80 + 30 * (lv - 2),
    make(r, lv) {
      if (lv === 2) {
        const a = r.intExcept(-5, 5, [0]);
        const b = r.intExcept(-5, 5, [0, a, -a]);
        const turn = r.pick([90, 180, 270] as const);
        // Multiplying by i, −1 or −i.
        const [re, im] = turn === 90 ? [-b, a] : turn === 180 ? [-a, -b] : [b, -a];
        const factor = { 90: '\\mathrm{i}', 180: '-1', 270: '-\\mathrm{i}' }[turn];
        const z = algebraicTex(surd(a), surd(b));
        const result = algebraicTex(surd(re), surd(im));
        return {
          prompt: L(
            `V počítačové grafice se bod roviny $[${a};\\,${b}]$ zapíše jako komplexní číslo $z = ${z}$. Bod otočíme kolem počátku o $${turn}^{\\circ}$ proti směru hodinových ručiček. Které komplexní číslo dostaneme?`,
            `In computer graphics the point $(${a},\\,${b})$ of the plane is written as the complex number $z = ${z}$. The point is rotated about the origin by $${turn}^{\\circ}$ anticlockwise. Which complex number results?`,
          ),
          context: { it: true, applied: true },
          figure: plane([{ re: a, im: b, label: 'z' }]),
          answer: {
            kind: 'complex',
            value: algebraicIn(surd(re), surd(im)),
            form: 'algebraic',
            placeholder: '-2 + 3i',
          },
          hints: [
            L(
              'Násobení číslem s absolutní hodnotou 1 a argumentem $\\varphi$ otočí bod o úhel $\\varphi$.',
              'Multiplying by a number of modulus 1 and argument $\\varphi$ rotates a point by the angle $\\varphi$.',
            ),
            L(
              `Které číslo má absolutní hodnotu 1 a argument $${turn}^{\\circ}$? Tím vynásob.`,
              `Which number has modulus 1 and argument $${turn}^{\\circ}$? Multiply by it.`,
            ),
          ],
          solution: [
            step(
              `Otočení o $${turn}^{\\circ}$ je násobení číslem $\\cos ${turn}^{\\circ} + \\mathrm{i}\\sin ${turn}^{\\circ} = ${factor}$:`,
              `A rotation by $${turn}^{\\circ}$ is multiplication by $\\cos ${turn}^{\\circ} + \\mathrm{i}\\sin ${turn}^{\\circ} = ${factor}$:`,
              `\\left(${z}\\right) \\cdot ${turn === 90 ? factor : `\\left(${factor}\\right)`} = ${result}`,
            ),
            step(
              'Stejný výpočet provádí rotační matice; komplexní čísla ho zapisují jedním násobením.',
              'A rotation matrix performs the same computation; complex numbers write it as a single multiplication.',
            ),
          ],
          misconceptions: [
            ...(turn === 180
              ? []
              : [
                  mc(
                    algebraicIn(surd(-re), surd(-im)),
                    'sign',
                    'To je otočení opačným směrem (po směru hodinových ručiček).',
                    'That is the rotation in the opposite direction (clockwise).',
                  ),
                ]),
            mc(
              algebraicIn(surd(a), surd(-b)),
              'concept',
              'To je zrcadlení podle reálné osy (číslo komplexně sdružené), ne otočení.',
              'That is the mirror image in the real axis (the conjugate), not a rotation.',
            ),
            mc(
              algebraicIn(surd(b), surd(a)),
              'concept',
              'Prohození souřadnic je zrcadlení podle osy prvního kvadrantu, ne otočení.',
              'Swapping the coordinates is a reflection in the diagonal, not a rotation.',
            ),
          ],
        };
      }
      const theta = r.pick([30, 45, 60, 120, 135, 150, 210, 240, 300, 315]);
      const scale = r.pick([1, 2]);
      const w = polar(scale, theta);
      return {
        prompt: L(
          `Kterým komplexním číslem $w$ je třeba násobit, aby se každý bod roviny otočil kolem počátku o $${theta}^{\\circ}$ proti směru hodinových ručiček${scale === 1 ? ' a jeho vzdálenost od počátku se nezměnila' : ` a jeho vzdálenost od počátku se zvětšila ${scale}krát`}? Zapište $w$ v algebraickém tvaru.`,
          `By which complex number $w$ must one multiply so that every point of the plane is rotated about the origin by $${theta}^{\\circ}$ anticlockwise${scale === 1 ? ' and keeps its distance from the origin' : ` and its distance from the origin grows ${scale} times`}? Give $w$ in algebraic form.`,
        ),
        context: { it: true, applied: true },
        answer: { kind: 'complex', value: w.input, form: 'algebraic', label: 'w =', placeholder: '1/2 + sqrt(3)/2 i' },
        hints: [
          L(
            'Při násobení se argumenty sčítají a absolutní hodnoty násobí.',
            'In multiplication the arguments add and the moduli multiply.',
          ),
          L(
            `Hledané číslo má tedy argument $${theta}^{\\circ}$ a absolutní hodnotu $${scale}$.`,
            `So the number sought has argument $${theta}^{\\circ}$ and modulus $${scale}$.`,
          ),
        ],
        solution: [
          step(
            `Argument se má zvětšit o $${theta}^{\\circ}$, absolutní hodnota ${scale === 1 ? 'zůstat' : `se má znásobit ${scale}`}:`,
            `The argument should grow by $${theta}^{\\circ}$ and the modulus should ${scale === 1 ? 'stay' : `be multiplied by ${scale}`}:`,
            `w = ${trigTex(`${scale}`, degTex(theta))}`,
          ),
          step('V algebraickém tvaru:', 'In algebraic form:', `w = ${w.tex}`),
        ],
        misconceptions: [
          mc(
            polar(scale, -theta).input,
            'sign',
            'To je otočení po směru hodinových ručiček.',
            'That is the clockwise rotation.',
          ),
          mc(
            polar(scale, 90 - theta).input,
            'concept',
            'Reálná část je kosinus úhlu, imaginární sinus — máš je prohozené.',
            'The real part is the cosine of the angle, the imaginary part the sine — you have them swapped.',
          ),
          ...(scale === 1
            ? []
            : [
                mc(
                  polar(1, theta).input,
                  'incomplete',
                  `Směr sedí, ale vzdálenost by se neměnila. Chybí násobení číslem ${scale}.`,
                  `The direction is right, but the distance would not change. The factor ${scale} is missing.`,
                ),
              ]),
        ],
      };
    },
  }),
];
