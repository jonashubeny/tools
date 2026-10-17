import { L, type Generator } from '@lemma/core';
import { gen, mapL, mc, step } from './helpers';
import { ROUND_ONE, agree, rounded, triangleASA, triangleFigure, triangleSAS, triangleSSS } from './triangle-kit';

const sinD = (deg: number): number => Math.sin((deg * Math.PI) / 180);
const cosD = (deg: number): number => Math.cos((deg * Math.PI) / 180);

/** Side lengths a, b, γ and c where γ is 60° or 120° and all three sides are whole numbers. */
const WHOLE_SAS: readonly (readonly [a: number, b: number, gamma: number, c: number])[] = [
  [3, 5, 120, 7],
  [5, 8, 60, 7],
  [3, 8, 60, 7],
  [7, 8, 120, 13],
  [7, 15, 60, 13],
  [8, 15, 60, 13],
  [5, 16, 120, 19],
  [5, 21, 60, 19],
  [16, 21, 60, 19],
  [6, 10, 120, 14],
  [10, 16, 60, 14],
];

/** Triangles with whole sides in which the angle opposite c is 60°, 90° or 120°. */
const WHOLE_SSS: readonly (readonly [a: number, b: number, c: number, gamma: number])[] = [
  [3, 5, 7, 120],
  [5, 8, 7, 60],
  [3, 8, 7, 60],
  [7, 8, 13, 120],
  [7, 15, 13, 60],
  [8, 15, 13, 60],
  [3, 4, 5, 90],
  [5, 12, 13, 90],
  [8, 15, 17, 90],
  [5, 21, 19, 60],
];

/** Syllabus topic 15: trigonometry of the general triangle. */
export const TRIANGLE_GENERATORS: Generator[] = [
  gen({
    id: 'trigo.sine-rule.side',
    concept: 'trigo.sine-rule',
    kind: 'core',
    levels: [2, 3],
    title: L('Sinová věta: délka strany', 'The law of sines: a side'),
    tags: ['annual-review'],
    est: (lv) => 100 + 40 * (lv - 2),
    make(r, lv) {
      const alpha = r.int(28, 80);
      const beta = r.intExcept(28, Math.min(80, 150 - alpha), [alpha]);
      const gamma = 180 - alpha - beta;
      const hint = L(
        'Každá strana patří k sinu protilehlého úhlu: $\\dfrac{a}{\\sin\\alpha} = \\dfrac{b}{\\sin\\beta} = \\dfrac{c}{\\sin\\gamma}$.',
        'Each side goes with the sine of the opposite angle: $\\dfrac{a}{\\sin\\alpha} = \\dfrac{b}{\\sin\\beta} = \\dfrac{c}{\\sin\\gamma}$.',
      );
      if (lv === 2) {
        const a = r.int(5, 20);
        const t = triangleASA((a * sinD(gamma)) / sinD(alpha), alpha, beta);
        const b = (a * sinD(beta)) / sinD(alpha);
        agree(b, t.b, 'sine rule');
        const shown = rounded(b);
        return {
          prompt: L(
            `V trojúhelníku $ABC$ je $a = ${a}$ cm, $\\alpha = ${alpha}^{\\circ}$ a $\\beta = ${beta}^{\\circ}$. Vypočítejte délku strany $b$. ${ROUND_ONE.cs}`,
            `In triangle $ABC$, $a = ${a}$ cm, $\\alpha = ${alpha}^{\\circ}$ and $\\beta = ${beta}^{\\circ}$. Find the length of side $b$. ${ROUND_ONE.en}`,
          ),
          figure: triangleFigure(t, {
            sides: { a: `a = ${a}`, b: 'b = ?' },
            angles: { A: `${alpha}°`, B: `${beta}°` },
          }),
          answer: {
            kind: 'number',
            value: `${a}*sin(${beta}°)/sin(${alpha}°)`,
            tol: 0.06,
            label: 'b =',
            placeholder: 'cm',
          },
          hints: [
            hint,
            L(
              'Znáš dvojici $a$, $\\alpha$ a k hledané straně $b$ úhel $\\beta$. Sestav rovnost dvou zlomků a vyjádři $b$.',
              'You know the pair $a$, $\\alpha$, and the angle $\\beta$ that belongs to the side $b$. Set two fractions equal and solve for $b$.',
            ),
          ],
          solution: [
            step(
              'Sinová věta pro dvojice $a$, $\\alpha$ a $b$, $\\beta$:',
              'The law of sines for the pairs $a$, $\\alpha$ and $b$, $\\beta$:',
              `\\frac{b}{\\sin ${beta}^{\\circ}} = \\frac{${a}}{\\sin ${alpha}^{\\circ}}`,
            ),
            step(
              'Vyjádříme $b$:',
              'Solve for $b$:',
              mapL(
                shown.tex,
                (value) =>
                  `b = \\frac{${a} \\cdot \\sin ${beta}^{\\circ}}{\\sin ${alpha}^{\\circ}} \\approx ${value}\\ \\text{cm}`,
              ),
            ),
            step(
              `Kontrola: proti většímu úhlu leží delší strana. $\\beta$ je ${beta > alpha ? 'větší' : 'menší'} než $\\alpha$, takže $b$ má vyjít ${beta > alpha ? 'větší' : 'menší'} než $a$.`,
              `Check: the longer side lies opposite the larger angle. $\\beta$ is ${beta > alpha ? 'larger' : 'smaller'} than $\\alpha$, so $b$ should come out ${beta > alpha ? 'longer' : 'shorter'} than $a$.`,
            ),
          ],
          misconceptions: [
            mc(
              `${a}*sin(${alpha}°)/sin(${beta}°)`,
              'formula',
              'Poměr je obráceně: strana $b$ patří k $\\sin\\beta$, strana $a$ k $\\sin\\alpha$.',
              'The ratio is upside down: side $b$ goes with $\\sin\\beta$, side $a$ with $\\sin\\alpha$.',
            ),
            mc(
              `${a}*${beta}/${alpha}`,
              'concept',
              'Strany nejsou úměrné úhlům, ale jejich sinům.',
              'The sides are proportional not to the angles but to their sines.',
            ),
          ],
          verify: [{ kind: 'value', expr: `${t.b}` }],
        };
      }
      const c = r.int(6, 20);
      const t = triangleASA(c, alpha, beta);
      const a = (c * sinD(alpha)) / sinD(gamma);
      agree(a, t.a, 'sine rule');
      const shown = rounded(a);
      return {
        prompt: L(
          `V trojúhelníku $ABC$ je $c = ${c}$ cm, $\\alpha = ${alpha}^{\\circ}$ a $\\beta = ${beta}^{\\circ}$. Vypočítejte délku strany $a$. ${ROUND_ONE.cs}`,
          `In triangle $ABC$, $c = ${c}$ cm, $\\alpha = ${alpha}^{\\circ}$ and $\\beta = ${beta}^{\\circ}$. Find the length of side $a$. ${ROUND_ONE.en}`,
        ),
        figure: triangleFigure(t, { sides: { c: `c = ${c}`, a: 'a = ?' }, angles: { A: `${alpha}°`, B: `${beta}°` } }),
        answer: {
          kind: 'number',
          value: `${c}*sin(${alpha}°)/sin(${gamma}°)`,
          tol: 0.06,
          label: 'a =',
          placeholder: 'cm',
        },
        hints: [
          hint,
          L(
            'Ke straně $c$ potřebuješ protilehlý úhel $\\gamma$. Ten není zadán — ale součet úhlů v trojúhelníku znáš.',
            'For side $c$ you need the opposite angle $\\gamma$. It is not given — but you know the sum of the angles in a triangle.',
          ),
        ],
        solution: [
          step(
            'Třetí úhel:',
            'The third angle:',
            `\\gamma = 180^{\\circ} - ${alpha}^{\\circ} - ${beta}^{\\circ} = ${gamma}^{\\circ}`,
          ),
          step(
            'Sinová věta pro dvojice $a$, $\\alpha$ a $c$, $\\gamma$:',
            'The law of sines for the pairs $a$, $\\alpha$ and $c$, $\\gamma$:',
            `\\frac{a}{\\sin ${alpha}^{\\circ}} = \\frac{${c}}{\\sin ${gamma}^{\\circ}}`,
          ),
          step(
            'Vyjádříme $a$:',
            'Solve for $a$:',
            mapL(
              shown.tex,
              (value) =>
                `a = \\frac{${c} \\cdot \\sin ${alpha}^{\\circ}}{\\sin ${gamma}^{\\circ}} \\approx ${value}\\ \\text{cm}`,
            ),
          ),
        ],
        misconceptions: [
          mc(
            `${c}*sin(${alpha}°)/sin(${beta}°)`,
            'misread',
            'Proti straně $c$ leží úhel $\\gamma$, ne $\\beta$. Nejdřív dopočítej $\\gamma$.',
            'The angle opposite side $c$ is $\\gamma$, not $\\beta$. Find $\\gamma$ first.',
          ),
          mc(
            `${c}*sin(${gamma}°)/sin(${alpha}°)`,
            'formula',
            'Poměr je obráceně: strana $a$ patří k $\\sin\\alpha$.',
            'The ratio is upside down: side $a$ goes with $\\sin\\alpha$.',
          ),
        ],
        verify: [{ kind: 'value', expr: `${t.a}` }],
      };
    },
  }),

  gen({
    id: 'trigo.sine-rule.angle',
    concept: 'trigo.sine-rule',
    kind: 'core',
    levels: [3],
    title: L('Sinová věta: velikost úhlu', 'The law of sines: an angle'),
    est: 130,
    make(r) {
      const alpha = r.int(40, 110);
      const a = r.int(9, 20);
      const b = r.int(4, a - 2);
      // a > b, so β < α: the angle sought is acute and there is exactly one triangle.
      const beta = (Math.asin((b * sinD(alpha)) / a) * 180) / Math.PI;
      const t = triangleSAS(a, b, 180 - alpha - beta);
      agree(alpha, t.alpha, 'angle α');
      agree(beta, t.beta, 'angle β');
      const shown = rounded(beta);
      const sine = rounded((b * sinD(alpha)) / a, 4);
      return {
        prompt: L(
          `V trojúhelníku $ABC$ je $a = ${a}$ cm, $b = ${b}$ cm a $\\alpha = ${alpha}^{\\circ}$. Vypočítejte velikost úhlu $\\beta$. Zaokrouhlete na jedno desetinné místo.`,
          `In triangle $ABC$, $a = ${a}$ cm, $b = ${b}$ cm and $\\alpha = ${alpha}^{\\circ}$. Find the angle $\\beta$. Round to one decimal place.`,
        ),
        figure: triangleFigure(t, { sides: { a: `a = ${a}`, b: `b = ${b}` }, angles: { A: `${alpha}°`, B: 'β = ?' } }),
        answer: { kind: 'number', value: shown.input, unit: 'deg', tol: 0.06, label: '\\beta =', placeholder: '°' },
        hints: [
          L(
            'Sinová věta: $\\dfrac{\\sin\\beta}{b} = \\dfrac{\\sin\\alpha}{a}$. Vyjádři $\\sin\\beta$.',
            'The law of sines: $\\dfrac{\\sin\\beta}{b} = \\dfrac{\\sin\\alpha}{a}$. Solve for $\\sin\\beta$.',
          ),
          L(
            'Sinus má v trojúhelníku dvě možná řešení, $\\beta$ a $180^{\\circ} - \\beta$. Které dává smysl? Proti kratší straně leží menší úhel.',
            'A sine has two possible solutions in a triangle, $\\beta$ and $180^{\\circ} - \\beta$. Which one makes sense? The smaller angle lies opposite the shorter side.',
          ),
        ],
        solution: [
          step(
            'Ze sinové věty:',
            'From the law of sines:',
            mapL(
              sine.tex,
              (value) =>
                `\\sin\\beta = \\frac{b \\cdot \\sin\\alpha}{a} = \\frac{${b} \\cdot \\sin ${alpha}^{\\circ}}{${a}} \\approx ${value}`,
            ),
          ),
          step(
            `Protože $b < a$, je $\\beta < \\alpha$: úhel je ostrý a řešení je jediné.`,
            `Since $b < a$, we have $\\beta < \\alpha$: the angle is acute and there is only one solution.`,
            mapL(shown.tex, (value) => `\\beta \\approx ${value}^{\\circ}`),
          ),
        ],
        misconceptions: [
          mc(
            rounded(180 - beta).input,
            'concept',
            `Sinus tohoto úhlu je stejný, ale trojúhelník by neexistoval: proti kratší straně $b$ musí ležet menší úhel než $\\alpha = ${alpha}^{\\circ}$.`,
            `The sine of that angle is the same, but no such triangle exists: the angle opposite the shorter side $b$ must be smaller than $\\alpha = ${alpha}^{\\circ}$.`,
          ),
          mc(
            rounded((b * alpha) / a).input,
            'concept',
            'Úhly nejsou úměrné stranám — úměrné jsou jejich siny.',
            'The angles are not proportional to the sides — their sines are.',
          ),
          mc(
            rounded((b * sinD(alpha)) / a, 4).input,
            'incomplete',
            'To je $\\sin\\beta$. Ještě je potřeba najít úhel (funkce $\\sin^{-1}$ na kalkulačce).',
            'That is $\\sin\\beta$. The angle itself is still needed (the $\\sin^{-1}$ key on a calculator).',
          ),
        ],
        verify: [{ kind: 'value', expr: `${t.beta}` }],
      };
    },
  }),

  gen({
    id: 'trigo.cosine-rule.side',
    concept: 'trigo.cosine-rule',
    kind: 'core',
    levels: [2, 3],
    title: L('Kosinová věta: třetí strana', 'The law of cosines: the third side'),
    tags: ['annual-review'],
    est: (lv) => 100 + 40 * (lv - 2),
    make(r, lv) {
      const [a, b, gamma] =
        lv === 2
          ? (r.pick(WHOLE_SAS).slice(0, 3) as [number, number, number])
          : [r.int(4, 15), r.int(4, 15), r.pick([35, 40, 48, 52, 65, 70, 75, 80, 100, 105, 110, 125, 130, 140])];
      const t = triangleSAS(a, b, gamma);
      const square = a * a + b * b - 2 * a * b * cosD(gamma);
      agree(Math.sqrt(square), t.c, 'cosine rule');
      const exactCos = gamma === 60 ? '\\frac{1}{2}' : gamma === 120 ? '\\left(-\\frac{1}{2}\\right)' : null;
      const shown = rounded(t.c);
      const whole = Math.round(t.c);
      return {
        prompt: L(
          `V trojúhelníku $ABC$ je $a = ${a}$ cm, $b = ${b}$ cm a $\\gamma = ${gamma}^{\\circ}$. Vypočítejte délku strany $c$.${lv === 2 ? '' : ` ${ROUND_ONE.cs}`}`,
          `In triangle $ABC$, $a = ${a}$ cm, $b = ${b}$ cm and $\\gamma = ${gamma}^{\\circ}$. Find the length of side $c$.${lv === 2 ? '' : ` ${ROUND_ONE.en}`}`,
        ),
        figure: triangleFigure(t, { sides: { a: `a = ${a}`, b: `b = ${b}`, c: 'c = ?' }, angles: { C: `${gamma}°` } }),
        answer:
          lv === 2
            ? { kind: 'number', value: `${whole}`, label: 'c =', placeholder: 'cm' }
            : {
                kind: 'number',
                value: `sqrt(${a}^2+${b}^2-2*${a}*${b}*cos(${gamma}°))`,
                tol: 0.06,
                label: 'c =',
                placeholder: 'cm',
              },
        hints: [
          L(
            'Dvě strany a úhel mezi nimi: to je situace pro kosinovou větu.',
            'Two sides and the angle between them: that calls for the law of cosines.',
          ),
          L(
            '$c^2 = a^2 + b^2 - 2ab\\cos\\gamma$. Součin $2ab\\cos\\gamma$ spočítej celý najednou a teprve pak odečti.',
            '$c^2 = a^2 + b^2 - 2ab\\cos\\gamma$. Compute the product $2ab\\cos\\gamma$ as a whole and only then subtract.',
          ),
          ...(gamma > 90
            ? [
                L(
                  'Pro tupý úhel je kosinus záporný, takže se poslední člen ve výsledku přičte.',
                  'For an obtuse angle the cosine is negative, so the last term ends up being added.',
                ),
              ]
            : []),
        ],
        solution: [
          step(
            'Kosinová věta:',
            'The law of cosines:',
            `c^2 = a^2 + b^2 - 2ab\\cos\\gamma = ${a}^2 + ${b}^2 - 2 \\cdot ${a} \\cdot ${b} \\cdot ${exactCos ?? `\\cos ${gamma}^{\\circ}`}`,
          ),
          lv === 2
            ? step(
                'Dopočítáme:',
                'Compute:',
                `c^2 = ${a * a} + ${b * b} ${gamma === 60 ? '-' : '+'} ${a * b} = ${whole * whole} \\;\\Rightarrow\\; c = ${whole}\\ \\text{cm}`,
              )
            : step(
                'Dopočítáme a odmocníme:',
                'Compute and take the root:',
                L(
                  `c^2 \\approx ${rounded(square, 2).tex.cs} \\;\\Rightarrow\\; c \\approx ${shown.tex.cs}\\ \\text{cm}`,
                  `c^2 \\approx ${rounded(square, 2).tex.en} \\;\\Rightarrow\\; c \\approx ${shown.tex.en}\\ \\text{cm}`,
                ),
              ),
          step(
            `Kontrola: úhel $\\gamma$ je ${gamma > 90 ? 'tupý, takže $c$ musí být delší než přepona pravoúhlého trojúhelníku s odvěsnami $a$, $b$' : 'ostrý, takže $c$ musí být kratší než přepona pravoúhlého trojúhelníku s odvěsnami $a$, $b$'} ($\\sqrt{a^2 + b^2} \\approx ${rounded(Math.hypot(a, b)).tex.cs}$).`,
            `Check: the angle $\\gamma$ is ${gamma > 90 ? 'obtuse, so $c$ must be longer than the hypotenuse of the right triangle with legs $a$, $b$' : 'acute, so $c$ must be shorter than the hypotenuse of the right triangle with legs $a$, $b$'} ($\\sqrt{a^2 + b^2} \\approx ${rounded(Math.hypot(a, b)).tex.en}$).`,
          ),
        ],
        misconceptions: [
          mc(
            `sqrt(${a}^2+${b}^2)`,
            'formula',
            'To je Pythagorova věta, která platí jen pro pravý úhel. Chybí člen $-2ab\\cos\\gamma$.',
            "That is Pythagoras' theorem, which holds only for a right angle. The term $-2ab\\cos\\gamma$ is missing.",
          ),
          mc(
            `sqrt(${a}^2+${b}^2+2*${a}*${b}*cos(${gamma}°))`,
            'sign',
            gamma > 90
              ? 'Kosinus tupého úhlu je záporný: minus a minus dají plus.'
              : 'Před členem $2ab\\cos\\gamma$ je minus.',
            gamma > 90
              ? 'The cosine of an obtuse angle is negative: minus times minus gives plus.'
              : 'There is a minus in front of $2ab\\cos\\gamma$.',
          ),
          mc(
            `${a}^2+${b}^2-2*${a}*${b}*cos(${gamma}°)`,
            'incomplete',
            'To je $c^2$. Ještě odmocnit.',
            'That is $c^2$. Take the square root.',
          ),
          ...((a - b) ** 2 * cosD(gamma) > 0
            ? [
                mc(
                  `sqrt((${a}^2+${b}^2-2*${a}*${b})*cos(${gamma}°))`,
                  'algebra',
                  'Násobení má přednost: kosinem se násobí jen člen $2ab$, ne celý rozdíl.',
                  'Multiplication comes first: only the term $2ab$ is multiplied by the cosine, not the whole difference.',
                ),
              ]
            : []),
        ],
        verify: [{ kind: 'value', expr: `${t.c}` }],
      };
    },
  }),

  gen({
    id: 'trigo.cosine-rule.angle',
    concept: 'trigo.cosine-rule',
    kind: 'core',
    levels: [3, 4],
    title: L('Kosinová věta: úhel ze tří stran', 'The law of cosines: an angle from three sides'),
    est: (lv) => 120 + 30 * (lv - 3),
    make(r, lv) {
      let a: number;
      let b: number;
      let c: number;
      if (lv === 3) {
        [a, b, c] = r.pick(WHOLE_SSS).slice(0, 3) as [number, number, number];
      } else {
        // Any triangle with whole sides; the angle asked for lies opposite the longest side.
        a = r.int(4, 12);
        b = r.int(4, 12);
        c = r.int(Math.max(a, b) + 1, a + b - 1);
      }
      const t = triangleSSS(a, b, c);
      const top = a * a + b * b - c * c;
      const cosine = top / (2 * a * b);
      agree((Math.acos(cosine) * 180) / Math.PI, t.gamma, 'cosine rule');
      const exact = lv === 3;
      const shown = rounded(t.gamma);
      const gammaTex = exact ? L(`${Math.round(t.gamma)}`, `${Math.round(t.gamma)}`) : shown.tex;
      return {
        prompt: L(
          `V trojúhelníku $ABC$ je $a = ${a}$ cm, $b = ${b}$ cm a $c = ${c}$ cm. Vypočítejte velikost úhlu $\\gamma$ (proti straně $c$).${exact ? '' : ' Zaokrouhlete na jedno desetinné místo.'}`,
          `In triangle $ABC$, $a = ${a}$ cm, $b = ${b}$ cm and $c = ${c}$ cm. Find the angle $\\gamma$ (opposite side $c$).${exact ? '' : ' Round to one decimal place.'}`,
        ),
        figure: triangleFigure(t, { sides: { a: `a = ${a}`, b: `b = ${b}`, c: `c = ${c}` }, angles: { C: 'γ = ?' } }),
        answer: exact
          ? { kind: 'number', value: `${Math.round(t.gamma)}`, unit: 'deg', label: '\\gamma =', placeholder: '°' }
          : { kind: 'number', value: shown.input, unit: 'deg', tol: 0.06, label: '\\gamma =', placeholder: '°' },
        hints: [
          L(
            'Tři strany a žádný úhel: kosinová věta, vyjádřená pro kosinus.',
            'Three sides and no angle: the law of cosines, solved for the cosine.',
          ),
          L(
            '$\\cos\\gamma = \\dfrac{a^2 + b^2 - c^2}{2ab}$ — odečítá se strana ležící proti hledanému úhlu.',
            '$\\cos\\gamma = \\dfrac{a^2 + b^2 - c^2}{2ab}$ — the side subtracted is the one opposite the angle sought.',
          ),
        ],
        solution: [
          step(
            'Z kosinové věty vyjádříme kosinus:',
            'Solve the law of cosines for the cosine:',
            `\\cos\\gamma = \\frac{a^2 + b^2 - c^2}{2ab} = \\frac{${a * a} + ${b * b} - ${c * c}}{2 \\cdot ${a} \\cdot ${b}} = ${top === 0 ? '0' : `${top < 0 ? '-' : ''}\\frac{${Math.abs(top)}}{${2 * a * b}}`}`,
          ),
          step(
            top < 0
              ? 'Kosinus je záporný, úhel je tedy tupý:'
              : top === 0
                ? 'Kosinus je nula, úhel je pravý:'
                : 'Kosinus je kladný, úhel je ostrý:',
            top < 0
              ? 'The cosine is negative, so the angle is obtuse:'
              : top === 0
                ? 'The cosine is zero, so the angle is a right angle:'
                : 'The cosine is positive, so the angle is acute:',
            mapL(gammaTex, (value) => `\\gamma ${exact ? '=' : '\\approx'} ${value}^{\\circ}`),
          ),
        ],
        misconceptions: [
          mc(
            rounded(180 - t.gamma, exact ? 0 : 1).input,
            'sign',
            'Znaménko v čitateli: $a^2 + b^2 - c^2$, odečítá se strana proti hledanému úhlu.',
            'The sign in the numerator: $a^2 + b^2 - c^2$; the side opposite the angle sought is subtracted.',
          ),
          mc(
            rounded(t.alpha, exact ? 0 : 1).input,
            'misread',
            'To je úhel $\\alpha$ proti straně $a$. Ptali se na $\\gamma$ proti straně $c$.',
            'That is the angle $\\alpha$ opposite side $a$. The question asks for $\\gamma$, opposite side $c$.',
          ),
          mc(
            rounded(t.beta, exact ? 0 : 1).input,
            'misread',
            'To je úhel $\\beta$ proti straně $b$. Ptali se na $\\gamma$ proti straně $c$.',
            'That is the angle $\\beta$ opposite side $b$. The question asks for $\\gamma$, opposite side $c$.',
          ),
        ],
        verify: [{ kind: 'value', expr: `${t.gamma}` }],
      };
    },
  }),

  gen({
    id: 'trigo.area.sas',
    concept: 'trigo.area',
    kind: 'core',
    levels: [2, 3],
    title: L('Obsah trojúhelníku ze dvou stran a úhlu', 'Triangle area from two sides and an angle'),
    tags: ['annual-review'],
    est: (lv) => 70 + 30 * (lv - 2),
    make(r, lv) {
      // Level 2: sin γ = 1/2, so the result is a whole number and needs no calculator.
      const gamma = lv === 2 ? r.pick([30, 150]) : r.pick([35, 40, 50, 55, 65, 70, 75, 80, 100, 110, 125, 140]);
      const a = lv === 2 ? r.pick([4, 6, 8, 10, 12]) : r.int(5, 16);
      const b = lv === 2 ? r.pick([6, 8, 10, 14]) : r.int(5, 16);
      const t = triangleSAS(a, b, gamma);
      const area = (a * b * sinD(gamma)) / 2;
      // Independently: half the base a times the height of A above BC.
      agree(area, (t.a * Math.abs(t.A[1])) / 2, 'area');
      const shown = rounded(area);
      return {
        prompt: L(
          `V trojúhelníku $ABC$ je $a = ${a}$ cm, $b = ${b}$ cm a úhel mezi nimi $\\gamma = ${gamma}^{\\circ}$. Vypočítejte obsah trojúhelníku.${lv === 2 ? '' : ` ${ROUND_ONE.cs}`}`,
          `In triangle $ABC$, $a = ${a}$ cm, $b = ${b}$ cm and the angle between them is $\\gamma = ${gamma}^{\\circ}$. Find the area of the triangle.${lv === 2 ? '' : ` ${ROUND_ONE.en}`}`,
        ),
        figure: triangleFigure(t, { sides: { a: `a = ${a}`, b: `b = ${b}` }, angles: { C: `${gamma}°` } }),
        answer:
          lv === 2
            ? { kind: 'number', value: `${Math.round(area)}`, label: 'S =', placeholder: 'cm²' }
            : { kind: 'number', value: `${a}*${b}*sin(${gamma}°)/2`, tol: 0.06, label: 'S =', placeholder: 'cm²' },
        hints: [
          L(
            'Obsah je polovina základny krát výška. Výšku na stranu $a$ vyjádři pomocí strany $b$ a úhlu $\\gamma$.',
            'The area is half the base times the height. Express the height onto side $a$ through side $b$ and the angle $\\gamma$.',
          ),
          L(
            '$v_a = b\\sin\\gamma$, takže $S = \\frac{1}{2}ab\\sin\\gamma$.',
            '$v_a = b\\sin\\gamma$, so $S = \\frac{1}{2}ab\\sin\\gamma$.',
          ),
        ],
        solution: [
          step(
            'Výška na stranu $a$ je $v_a = b\\sin\\gamma$, proto:',
            'The height onto side $a$ is $v_a = b\\sin\\gamma$, hence:',
            `S = \\frac{1}{2}ab\\sin\\gamma = \\frac{1}{2} \\cdot ${a} \\cdot ${b} \\cdot \\sin ${gamma}^{\\circ}`,
          ),
          lv === 2
            ? step(
                `$\\sin ${gamma}^{\\circ} = \\frac{1}{2}$:`,
                `$\\sin ${gamma}^{\\circ} = \\frac{1}{2}$:`,
                `S = \\frac{${a} \\cdot ${b}}{4} = ${Math.round(area)}\\ \\text{cm}^2`,
              )
            : step(
                'Vyčíslíme:',
                'Evaluate:',
                mapL(shown.tex, (value) => `S \\approx ${value}\\ \\text{cm}^2`),
              ),
        ],
        misconceptions: [
          mc(
            `${a}*${b}*sin(${gamma}°)`,
            'formula',
            'Chybí polovina: $ab\\sin\\gamma$ je obsah rovnoběžníku.',
            'The half is missing: $ab\\sin\\gamma$ is the area of the parallelogram.',
          ),
          mc(
            `${a}*${b}/2`,
            'formula',
            'To by platilo jen pro pravý úhel mezi stranami. Obecně je potřeba $\\sin\\gamma$.',
            'That would hold only for a right angle between the sides. In general $\\sin\\gamma$ is needed.',
          ),
          mc(
            `abs(${a}*${b}*cos(${gamma}°)/2)`,
            'formula',
            'Výška je $b\\sin\\gamma$, ne $b\\cos\\gamma$.',
            'The height is $b\\sin\\gamma$, not $b\\cos\\gamma$.',
          ),
        ],
        verify: [{ kind: 'value', expr: `${(t.a * Math.abs(t.A[1])) / 2}` }],
      };
    },
  }),

  gen({
    id: 'trigo.area.triangulation',
    concept: 'trigo.area',
    kind: 'applied',
    levels: [3, 4],
    title: L('Zaměření polohy ze dvou stanovišť', 'Locating a position from two stations'),
    est: (lv) => 150 + 40 * (lv - 3),
    make(r, lv) {
      const c = r.pick([50, 80, 100, 120, 150, 200]);
      const alpha = r.int(35, 80);
      const beta = r.intExcept(35, Math.min(80, 145 - alpha), [alpha]);
      const gamma = 180 - alpha - beta;
      const t = triangleASA(c, alpha, beta);
      const b = (c * sinD(beta)) / sinD(gamma);
      agree(b, t.b, 'distance from A');
      const height = b * sinD(alpha);
      agree(height, t.C[1], 'distance from the baseline');
      const setup = L(
        `Dva vysílače $A$ a $B$ stojí ${c} m od sebe. Přijímač $C$ zaměřil jejich směry: úhel $CAB$ má velikost $${alpha}^{\\circ}$ a úhel $CBA$ velikost $${beta}^{\\circ}$.`,
        `Two transmitters $A$ and $B$ stand ${c} m apart. A receiver $C$ took bearings on them: the angle $CAB$ measures $${alpha}^{\\circ}$ and the angle $CBA$ measures $${beta}^{\\circ}$.`,
      );
      const figure = triangleFigure(t, { sides: { c: `${c} m` }, angles: { A: `${alpha}°`, B: `${beta}°` } });
      const thirdAngle = step(
        'Úhel u přijímače:',
        'The angle at the receiver:',
        `\\gamma = 180^{\\circ} - ${alpha}^{\\circ} - ${beta}^{\\circ} = ${gamma}^{\\circ}`,
      );
      const distance = step(
        'Sinová věta pro strany $b = |AC|$ a $c = |AB|$:',
        'The law of sines for the sides $b = |AC|$ and $c = |AB|$:',
        mapL(
          rounded(b, lv === 3 ? 0 : 1).tex,
          (value) =>
            `b = \\frac{${c} \\cdot \\sin ${beta}^{\\circ}}{\\sin ${gamma}^{\\circ}} \\approx ${value}\\ \\text{m}`,
        ),
      );
      if (lv === 3) {
        return {
          prompt: L(
            `${setup.cs} Jak daleko je přijímač od vysílače $A$? Zaokrouhlete na celé metry.`,
            `${setup.en} How far is the receiver from transmitter $A$? Round to whole metres.`,
          ),
          context: { it: true, applied: true },
          figure,
          answer: {
            kind: 'number',
            value: `${c}*sin(${beta}°)/sin(${gamma}°)`,
            tol: 0.5,
            label: '|AC| =',
            placeholder: 'm',
          },
          hints: [
            L(
              'Načrtni trojúhelník $ABC$. Známá strana $AB$ leží proti úhlu u přijímače — ten je potřeba dopočítat.',
              'Sketch triangle $ABC$. The known side $AB$ lies opposite the angle at the receiver — which has to be found first.',
            ),
            L(
              'Hledaná strana $AC$ leží proti úhlu u vysílače $B$. Použij sinovou větu.',
              'The side sought, $AC$, lies opposite the angle at transmitter $B$. Use the law of sines.',
            ),
          ],
          solution: [
            thirdAngle,
            distance,
            step(
              'Tomuhle postupu se říká triangulace; tak pracují rádiové zaměřovače. GPS používá příbuzný postup, trilateraci: místo úhlů měří vzdálenosti.',
              'This method is called triangulation; it is how radio direction finders work. GPS uses a related method, trilateration: it measures distances instead of angles.',
            ),
          ],
          misconceptions: [
            mc(
              `${c}*sin(${alpha}°)/sin(${gamma}°)`,
              'misread',
              'To je vzdálenost od vysílače $B$: proti straně $BC$ leží úhel u $A$.',
              'That is the distance from transmitter $B$: the side $BC$ lies opposite the angle at $A$.',
            ),
            mc(
              `${c}*sin(${beta}°)/sin(${alpha}°)`,
              'formula',
              'Strana $AB$ leží proti úhlu u přijímače $C$, ne proti úhlu u $A$.',
              'The side $AB$ lies opposite the angle at the receiver $C$, not the angle at $A$.',
            ),
          ],
          verify: [{ kind: 'value', expr: `${t.b}` }],
        };
      }
      return {
        prompt: L(
          `${setup.cs} Jak daleko je přijímač od přímky $AB$, která vysílače spojuje? Zaokrouhlete na celé metry.`,
          `${setup.en} How far is the receiver from the line $AB$ that joins the transmitters? Round to whole metres.`,
        ),
        context: { it: true, applied: true },
        figure,
        answer: {
          kind: 'number',
          value: `${c}*sin(${beta}°)/sin(${gamma}°)*sin(${alpha}°)`,
          tol: 0.5,
          placeholder: 'm',
        },
        hints: [
          L(
            'Vzdálenost bodu od přímky je kolmice — v trojúhelníku $ABC$ výška z vrcholu $C$.',
            'The distance of a point from a line is the perpendicular — in triangle $ABC$ the height from $C$.',
          ),
          L(
            'Nejdřív sinovou větou spočítej stranu $AC$. Výška pak leží v pravoúhlém trojúhelníku s přeponou $AC$ a úhlem u $A$.',
            'First find the side $AC$ with the law of sines. The height then lies in a right triangle with hypotenuse $AC$ and the angle at $A$.',
          ),
        ],
        solution: [
          thirdAngle,
          distance,
          step(
            'Výška z $C$ je odvěsna pravoúhlého trojúhelníku s přeponou $b$ a úhlem $\\alpha$:',
            'The height from $C$ is a leg of the right triangle with hypotenuse $b$ and angle $\\alpha$:',
            mapL(
              rounded(height, 0).tex,
              (value) => `v = b \\cdot \\sin ${alpha}^{\\circ} \\approx ${value}\\ \\text{m}`,
            ),
          ),
        ],
        misconceptions: [
          mc(
            `${c}*sin(${beta}°)/sin(${gamma}°)`,
            'incomplete',
            'To je vzdálenost od vysílače $A$. Vzdálenost od přímky je kolmice, tedy výška.',
            'That is the distance from transmitter $A$. The distance from the line is the perpendicular, that is, the height.',
          ),
          mc(
            `${c}*sin(${beta}°)/sin(${gamma}°)*cos(${alpha}°)`,
            'formula',
            'Výška leží proti úhlu $\\alpha$, patří k ní tedy sinus.',
            'The height lies opposite the angle $\\alpha$, so it goes with the sine.',
          ),
        ],
        verify: [{ kind: 'value', expr: `${t.C[1]}` }],
      };
    },
  }),
];
