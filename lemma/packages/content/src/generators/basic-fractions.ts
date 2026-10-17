import {
  L,
  fAdd,
  fDiv,
  fMul,
  fSub,
  fToInput,
  fToTex,
  frac,
  gcd,
  type ChoiceSpec,
  type Frac,
  type Generator,
} from '@lemma/core';
import { ans, both, cs, csT, en, enT, numericChoice, plural } from './basic-kit';
import { gen, mc, step } from './helpers';

/** Fractions, percent, ratio and proportion. */

const tex = (n: number, d: number): string => `${n < 0 ? '-' : ''}\\frac{${Math.abs(n)}}{${d}}`;
/** A fraction for a product or quotient: negative ones in brackets. */
const texP = (f: Frac): string => (f.n < 0 ? `\\left(${fToTex(f)}\\right)` : fToTex(f));
const reduced = (f: Frac) => ({ kind: 'number' as const, value: fToInput(f), form: 'reduced' as const });
const coprimeTo = (d: number, pool: readonly number[]): number[] => pool.filter((n) => gcd(n, d) === 1);

/** Six percentages in ascending order, as a matching bundle prints them. */
function percentOptions(values: readonly number[], correct: number, prefix: L): ChoiceSpec {
  const ids = ['a', 'b', 'c', 'd', 'e', 'f'];
  return {
    kind: 'choice',
    options: values.map((value, index) => ({
      id: ids[index]!,
      text: L(`${prefix.cs}${value} %`, `${prefix.en}${value} %`),
    })),
    correct: [ids[values.indexOf(correct)]!],
    fixedOrder: true,
  };
}

export const BASIC_FRACTION_GENERATORS: Generator[] = [
  // ---------------------------------------------------------------- fraction of a whole
  gen({
    id: 'frac.concept.of-quantity',
    concept: 'frac.concept',
    kind: 'core',
    levels: [1, 2, 3],
    title: L('Zlomek z celku a celek ze zlomku', 'A fraction of a whole and the whole from a fraction'),
    est: (lv) => 35 + 25 * lv,
    make(r, lv) {
      const q = r.pick([3, 4, 5, 6, 8]);
      const p = r.pick(coprimeTo(q, [1, 2, 3, 5, 7]).filter((n) => n < q));
      const k = r.int(3, 12);
      if (lv === 1) {
        const whole = q * k;
        return {
          prompt: L(`Kolik je $${tex(p, q)}$ z čísla ${whole}?`, `What is $${tex(p, q)}$ of ${whole}?`),
          answer: { kind: 'number', value: ans(p * k) },
          hints: [
            L(
              `Nejdřív zjisti jeden díl: ${whole} rozděl na ${q} ${plural(q, 'díl', 'stejné díly', 'stejných dílů')}.`,
              `Find one part first: divide ${whole} into ${q} equal parts.`,
            ),
            L(`Jeden díl je ${k}. Ber ${p === 1 ? 'jeden' : `${p}`}.`, `One part is ${k}. Take ${p}.`),
          ],
          solution: [
            step('Jeden díl:', 'One part:', L(`${whole} : ${q} = ${k}`, `${whole} \\div ${q} = ${k}`)),
            step(
              `${p} ${plural(p, 'díl', 'díly', 'dílů')}:`,
              `${p} part${p === 1 ? '' : 's'}:`,
              `${p} \\cdot ${k} = ${p * k}`,
            ),
          ],
          misconceptions: [
            mc(
              ans((whole * q) / p),
              'formula',
              'Dělí se jmenovatelem a násobí čitatelem, ne obráceně.',
              'Divide by the denominator and multiply by the numerator, not the other way round.',
            ),
          ],
          verify: [{ kind: 'value', expr: `${p}/${q}*${whole}` }],
        };
      }
      if (lv === 2) {
        const part = p * k * 2;
        const whole = q * k * 2;
        const [text, textEn, unit] = r.pick([
          [
            `$${tex(p, q)}$ cesty měří ${part} km. Kolik km měří celá cesta?`,
            `$${tex(p, q)}$ of the way is ${part} km. How many km is the whole way?`,
            'km',
          ],
          [
            `$${tex(p, q)}$ zásoby krmiva váží ${part} kg. Kolik kg váží celá zásoba?`,
            `$${tex(p, q)}$ of the feed weighs ${part} kg. How many kg does all of it weigh?`,
            'kg',
          ],
          [
            `$${tex(p, q)}$ nádrže je ${part} litrů. Kolik litrů se vejde do celé nádrže?`,
            `$${tex(p, q)}$ of a tank is ${part} litres. How many litres does the whole tank hold?`,
            'l',
          ],
        ] as const);
        return {
          prompt: L(text, textEn),
          answer: { kind: 'number', value: ans(whole) },
          hints: [
            L(
              `${part} ${unit} odpovídá ${p} ${plural(p, 'dílu', 'dílům', 'dílům')}. Kolik je jeden díl?`,
              `${part} ${unit} is ${p} part${p === 1 ? '' : 's'}. How much is one part?`,
            ),
            L(
              `Jeden díl je ${part / p} ${unit} a celek má ${q} ${plural(q, 'díl', 'díly', 'dílů')}.`,
              `One part is ${part / p} ${unit} and the whole has ${q} parts.`,
            ),
          ],
          solution: [
            step('Jeden díl:', 'One part:', L(`${part} : ${p} = ${part / p}`, `${part} \\div ${p} = ${part / p}`)),
            step(
              `Celek má ${q} ${plural(q, 'díl', 'díly', 'dílů')}:`,
              `The whole is ${q} parts:`,
              `${q} \\cdot ${part / p} = ${whole}`,
            ),
          ],
          misconceptions: [
            mc(
              fToInput(frac(part * p, q)),
              'concept',
              `Počítal jsi zlomek z čísla ${part}. To číslo ale už je ta část — hledáš celek, který je větší.`,
              `You took the fraction of ${part}. But that number already is the part — the whole you want is larger.`,
            ),
          ],
          verify: [{ kind: 'value', expr: `${part}/(${p}/${q})` }],
          context: { applied: true },
        };
      }
      const [a, b] = r.sample(['Tomáš', 'Lukáš', 'Ema', 'Nela', 'Vít', 'Klára'], 2) as [string, string];
      const base = q * k;
      const more = base + k;
      const [thing, thingEn] = r.pick([
        ['samolepek', 'stickers'],
        ['kartiček', 'cards'],
        ['bodů', 'points'],
      ] as const);
      const part = q === 3 ? 'třetinu' : q === 4 ? 'čtvrtinu' : q === 5 ? 'pětinu' : q === 6 ? 'šestinu' : 'osminu';
      const partEn =
        q === 3 ? 'a third' : q === 4 ? 'a quarter' : q === 5 ? 'a fifth' : q === 6 ? 'a sixth' : 'an eighth';
      return {
        prompt: L(
          `${a} má o ${part} více ${thing} než ${b}. ${a} jich má ${more}. Kolik ${thing} má ${b}?`,
          `${a} has ${partEn} more ${thingEn} than ${b}. ${a} has ${more}. How many ${thingEn} does ${b} have?`,
        ),
        answer: { kind: 'number', value: ans(base) },
        hints: [
          L(
            `„O ${part} více“ se počítá z toho, co má ${b}. ${a} má tedy $${tex(q + 1, q)}$ toho, co ${b}.`,
            `"${partEn} more" is taken of what ${b} has. So ${a} has $${tex(q + 1, q)}$ of that.`,
          ),
          L(`${more} odpovídá ${q + 1} dílům. Jeden díl je ${k}.`, `${more} is ${q + 1} parts. One part is ${k}.`),
        ],
        solution: [
          step(
            `Počet, který má ${b}, rozdělíme na ${q} ${plural(q, 'díl', 'stejné díly', 'stejných dílů')}; ${a} má o jeden díl víc, tedy ${q + 1} ${plural(q + 1, 'díl', 'díly', 'dílů')}.`,
            `What ${b} has is ${q} parts; ${a} has one part more, ${q + 1} parts.`,
          ),
          step('Jeden díl:', 'One part:', L(`${more} : ${q + 1} = ${k}`, `${more} \\div ${q + 1} = ${k}`)),
          step(`${b}:`, `${b}:`, `${q} \\cdot ${k} = ${base}`),
        ],
        misconceptions: [
          mc(
            fToInput(frac(more * (q - 1), q)),
            'concept',
            `Odečetl jsi ${part} z čísla ${more}. Ta ${part.replace('u', 'a')} se ale počítá z menšího počtu, ne z většího.`,
            `You took ${partEn} off ${more}. But the fraction is of the smaller number, not of the larger.`,
          ),
        ],
        verify: [{ kind: 'value', expr: `${more}/(1+1/${q})` }],
        context: { applied: true },
      };
    },
  }),

  gen({
    id: 'frac.concept.remaining',
    concept: 'frac.concept',
    kind: 'applied',
    levels: [1, 2, 3],
    title: L('Kolik zbylo z celku', 'What is left of the whole'),
    est: (lv) => 45 + 30 * lv,
    make(r, lv) {
      const [a, b] = r.pick([
        [3, 4],
        [2, 3],
        [2, 5],
        [4, 5],
        [3, 5],
        [2, 4],
        [4, 6],
        [3, 6],
      ] as const);
      const k = r.int(3, 9);
      const name = r.pick(['Petr', 'Jana', 'Marek', 'Eliška']);
      if (lv === 1) {
        const total = a * b * k;
        const left = total - total / a;
        return {
          prompt: L(
            `Kniha má ${total} stran. ${name} už přečetl${name.endsWith('a') ? 'a' : ''} $${tex(1, a)}$ knihy. Kolik stran zbývá?`,
            `A book has ${total} pages. ${name} has read $${tex(1, a)}$ of it. How many pages are left?`,
          ),
          answer: { kind: 'number', value: ans(left) },
          hints: [
            L(`Kolik stran je $${tex(1, a)}$ knihy?`, `How many pages are $${tex(1, a)}$ of the book?`),
            L(`Přečteno je ${total / a} stran.`, `${total / a} pages have been read.`),
          ],
          solution: [
            step('Přečteno:', 'Read:', L(`${total} : ${a} = ${total / a}`, `${total} \\div ${a} = ${total / a}`)),
            step('Zbývá:', 'Left:', `${total} - ${total / a} = ${left}`),
          ],
          misconceptions: [
            mc(
              ans(total / a),
              'misread',
              'To je počet přečtených stran. Otázka se ptá, kolik zbývá.',
              'That is the number of pages read. The question asks how many are left.',
            ),
          ],
          verify: [{ kind: 'value', expr: `${total}*(1-1/${a})` }],
          context: { applied: true },
        };
      }
      if (lv === 2) {
        // Two fractions of the whole; the rest is given.
        const rest = fSub(frac(1), fAdd(frac(1, a), frac(1, b)));
        if (rest.n <= 0) {
          // 1/2 + 1/2 and the like cannot occur with the pairs above, but stay safe.
          throw new Error('frac.concept.remaining: nothing left');
        }
        const total = rest.d * k;
        const left = rest.n * k;
        return {
          prompt: L(
            `První den ušli turisté $${tex(1, a)}$ trasy, druhý den $${tex(1, b)}$ trasy. Na třetí den jim ${plural(left, 'zbyl', 'zbyly', 'zbylo')} ${left} km. Kolik km měří celá trasa?`,
            `On the first day the hikers walked $${tex(1, a)}$ of the route, on the second $${tex(1, b)}$ of it. ${left} km were left for the third day. How many km is the whole route?`,
          ),
          answer: { kind: 'number', value: ans(total) },
          hints: [
            L(
              'Jaká část trasy zbyla na třetí den? Sečti první dva dny a odečti od celku.',
              'What part of the route was left for the third day? Add the first two days and subtract from the whole.',
            ),
            L(
              `Zbylo $${fToTex(rest)}$ trasy, a to ${plural(left, 'je', 'jsou', 'je')} ${left} km.`,
              `$${fToTex(rest)}$ of the route was left, and that is ${left} km.`,
            ),
          ],
          solution: [
            step(
              'První dva dny dohromady:',
              'The first two days together:',
              `${tex(1, a)} + ${tex(1, b)} = ${fToTex(fAdd(frac(1, a), frac(1, b)))}`,
            ),
            step('Zbylá část:', 'The part left:', `1 - ${fToTex(fAdd(frac(1, a), frac(1, b)))} = ${fToTex(rest)}`),
            step(
              `Jeden díl ${plural(k, 'je', 'jsou', 'je')} ${k} km, celá trasa má ${rest.d} ${plural(rest.d, 'díl', 'díly', 'dílů')}:`,
              `One part is ${k} km and the whole route has ${rest.d} parts:`,
              `${rest.d} \\cdot ${k} = ${total}`,
            ),
          ],
          misconceptions: [],
          verify: [{ kind: 'value', expr: `${left}/(1-1/${a}-1/${b})` }],
          context: { applied: true },
        };
      }
      // A fraction of the whole, then a fraction of what was left.
      const total = a * b * k;
      const afterFirst = total - total / a;
      const left = afterFirst - afterFirst / b;
      const wrongRest = fSub(frac(1), fAdd(frac(1, a), frac(1, b)));
      return {
        prompt: L(
          `Z ušetřených peněz utratil${name.endsWith('a') ? 'a' : ''} ${name} nejdřív $${tex(1, a)}$ a potom $${tex(1, b)}$ toho, co zbylo. Nakonec ${name.endsWith('a') ? 'jí' : 'mu'} zůstalo ${left} korun. Kolik korun měl${name.endsWith('a') ? 'a' : ''} na začátku?`,
          `${name} first spent $${tex(1, a)}$ of the savings and then $${tex(1, b)}$ of what was left. In the end ${left} crowns remained. How many crowns were there at the start?`,
        ),
        answer: { kind: 'number', value: ans(total) },
        hints: [
          L(
            'Druhý zlomek se nepočítá z celku, ale ze zbytku. Postupuj od konce.',
            'The second fraction is not of the whole but of the remainder. Work backwards.',
          ),
          L(
            `Po druhé útratě zbylo $${tex(b - 1, b)}$ zbytku, tedy zbytek byl ${afterFirst} korun.`,
            `After the second spending $${tex(b - 1, b)}$ of the remainder was left, so the remainder was ${afterFirst} crowns.`,
          ),
        ],
        solution: [
          step(
            `${left} korun je $${tex(b - 1, b)}$ zbytku po první útratě:`,
            `${left} crowns is $${tex(b - 1, b)}$ of what was left after the first spending:`,
            L(`${left} : ${b - 1} \\cdot ${b} = ${afterFirst}`, `${left} \\div ${b - 1} \\cdot ${b} = ${afterFirst}`),
          ),
          step(
            `${afterFirst} korun je $${tex(a - 1, a)}$ původní částky:`,
            `${afterFirst} crowns is $${tex(a - 1, a)}$ of the original amount:`,
            L(`${afterFirst} : ${a - 1} \\cdot ${a} = ${total}`, `${afterFirst} \\div ${a - 1} \\cdot ${a} = ${total}`),
          ),
        ],
        misconceptions:
          wrongRest.n > 0
            ? [
                mc(
                  fToInput(fDiv(frac(left), wrongRest)),
                  'misread',
                  'Druhý zlomek jsi počítal z celé částky. V zadání je to část zbytku.',
                  'You took the second fraction of the whole amount. The problem says it is a part of the remainder.',
                ),
              ]
            : [],
        verify: [{ kind: 'value', expr: `${left}/((1-1/${a})*(1-1/${b}))` }],
        context: { applied: true },
      };
    },
  }),

  gen({
    id: 'frac.concept.share-choice',
    concept: 'frac.concept',
    kind: 'applied',
    levels: [2, 3],
    title: L('Části celku – výběr odpovědi', 'Parts of a whole – choose the answer'),
    tags: ['mc5'],
    est: (lv) => 60 + 30 * lv,
    make(r, lv) {
      if (lv === 2) {
        const [a, b] = r.pick([
          [3, 4],
          [2, 3],
          [2, 5],
          [3, 6],
          [4, 6],
          [2, 6],
        ] as const);
        const total = a * b * r.int(2, 5);
        const first = total / a;
        const second = total / b;
        const rest = total - first - second;
        const built = numericChoice(r, rest, [first + second, first, second, total - first], (v) =>
          L(`${v} ${plural(v, 'dítě', 'děti', 'dětí')}`, `${v} ${v === 1 ? 'child' : 'children'}`),
        );
        return {
          prompt: L(
            `Na výlet jelo ${total} dětí. $${tex(1, a)}$ z nich jela vlakem, $${tex(1, b)}$ autobusem a ostatní šly pěšky. Kolik dětí šlo pěšky?`,
            `${total} children went on a trip. $${tex(1, a)}$ of them took the train, $${tex(1, b)}$ the bus and the rest walked. How many children walked?`,
          ),
          answer: built.spec,
          hints: [
            L(
              'Spočítej, kolik dětí jelo vlakem a kolik autobusem.',
              'Work out how many took the train and how many the bus.',
            ),
            L(`Vlakem ${first}, autobusem ${second}.`, `${first} by train, ${second} by bus.`),
          ],
          solution: [
            step(
              'Vlakem a autobusem:',
              'By train and by bus:',
              L(
                `${total} : ${a} = ${first}, \\quad ${total} : ${b} = ${second}`,
                `${total} \\div ${a} = ${first}, \\quad ${total} \\div ${b} = ${second}`,
              ),
            ),
            step('Pěšky:', 'On foot:', `${total} - ${first} - ${second} = ${rest}`),
          ],
          misconceptions: [built.idOf(first + second)].flatMap((id) =>
            id
              ? [
                  mc(
                    id,
                    'misread',
                    'To jsou děti, které jely. Otázka se ptá na ty, které šly pěšky.',
                    'Those are the children who rode. The question asks about those who walked.',
                  ),
                ]
              : [],
          ),
          context: { applied: true },
        };
      }
      const [q, p] = r.pick([
        [5, 2],
        [4, 3],
        [3, 2],
        [5, 3],
        [6, 5],
      ] as const);
      const t = r.int(2, 4);
      const chess = p * t;
      const inClub = 2 * chess;
      const klass = 2 * q * t;
      const built = numericChoice(r, klass, [inClub, chess * q, inClub * 2, klass + chess], (v) =>
        L(`${v} ${plural(v, 'žák', 'žáci', 'žáků')}`, `${v} ${v === 1 ? 'pupil' : 'pupils'}`),
      );
      return {
        prompt: L(
          `$${tex(p, q)}$ žáků třídy chodí do sportovního kroužku a polovina z nich hraje florbal. Florbal ${plural(chess, 'hraje', 'hrají', 'hraje')} ${chess} ${plural(chess, 'žák', 'žáci', 'žáků')}. Kolik žáků má třída?`,
          `$${tex(p, q)}$ of the pupils of a class go to the sports club, and half of those play floorball. ${chess} pupils play floorball. How many pupils are in the class?`,
        ),
        answer: built.spec,
        hints: [
          L(
            'Postupuj od konce: kolik žáků chodí do kroužku, když florbal hraje polovina z nich?',
            'Work backwards: how many pupils go to the club if half of them play floorball?',
          ),
          L(
            `Do kroužku chodí ${inClub} žáků, a to je $${tex(p, q)}$ třídy.`,
            `${inClub} pupils go to the club, and that is $${tex(p, q)}$ of the class.`,
          ),
        ],
        solution: [
          step(
            'Do kroužku chodí dvakrát tolik žáků, kolik hraje florbal:',
            'Twice as many go to the club as play floorball:',
            `2 \\cdot ${chess} = ${inClub}`,
          ),
          step(
            `${inClub} žáků tvoří ${p} ${plural(p, 'díl', 'díly', 'dílů')} z ${q}:`,
            `${inClub} pupils are ${p} parts of ${q}:`,
            L(`${inClub} : ${p} \\cdot ${q} = ${klass}`, `${inClub} \\div ${p} \\cdot ${q} = ${klass}`),
          ),
        ],
        misconceptions: [built.idOf(inClub)].flatMap((id) =>
          id
            ? [
                mc(
                  id,
                  'incomplete',
                  'Tolik žáků chodí do kroužku. Třída je větší.',
                  'That many go to the club. The class is larger.',
                ),
              ]
            : [],
        ),
        context: { applied: true },
      };
    },
  }),

  // ------------------------------------------------------------ operations with fractions
  gen({
    id: 'frac.operations.add-sub',
    concept: 'frac.operations',
    kind: 'core',
    levels: [1, 2, 3],
    title: L('Sčítání a odčítání zlomků', 'Adding and subtracting fractions'),
    est: (lv) => 45 + 30 * lv,
    make(r, lv) {
      if (lv === 1) {
        const b = r.pick([2, 3, 4, 5, 6, 9]);
        const m = r.pick([2, 3]);
        const d = b * m;
        const a = r.pick(coprimeTo(b, [1, 2, 3, 4, 5, 7]).filter((n) => n < b));
        const c = r.pick(coprimeTo(d, [1, 3, 5, 7, 11]).filter((n) => n < d));
        const value = fAdd(frac(a, b), frac(c, d));
        return {
          prompt: L(
            `Vypočtěte a zapište zlomkem v základním tvaru: $${tex(a, b)} + ${tex(c, d)}$`,
            `Calculate and write in lowest terms: $${tex(a, b)} + ${tex(c, d)}$`,
          ),
          answer: reduced(value),
          hints: [
            L(
              `Společný jmenovatel je ${d}: první zlomek rozšiř číslem ${m}.`,
              `The common denominator is ${d}: expand the first fraction by ${m}.`,
            ),
            L(`$${tex(a, b)} = ${tex(a * m, d)}$`, `$${tex(a, b)} = ${tex(a * m, d)}$`),
          ],
          solution: [
            step(
              'Na společného jmenovatele:',
              'To a common denominator:',
              `${tex(a * m, d)} + ${tex(c, d)} = ${tex(a * m + c, d)}`,
            ),
            step('V základním tvaru:', 'In lowest terms:', fToTex(value)),
          ],
          misconceptions: [
            mc(
              fToInput(frac(a + c, b + d)),
              'concept',
              'Čitatele a jmenovatele se nesčítají zvlášť. Sčítat lze jen stejné díly.',
              'Numerators and denominators are not added separately. Only equal parts can be added.',
            ),
          ],
          verify: [{ kind: 'value', expr: `${a}/${b}+${c}/${d}` }],
        };
      }
      if (lv === 2) {
        const [b, d] = r.pick([
          [4, 6],
          [3, 4],
          [6, 9],
          [4, 10],
          [5, 6],
          [8, 12],
          [3, 5],
          [6, 10],
        ] as const);
        const a = r.pick(coprimeTo(b, [1, 3, 5, 7]).filter((n) => n < 2 * b));
        const c = r.pick(coprimeTo(d, [1, 5, 7, 11]).filter((n) => n < 2 * d));
        const value = fSub(frac(a, b), frac(c, d));
        const common = (b * d) / gcd(b, d);
        return {
          prompt: L(
            `Vypočtěte a zapište zlomkem v základním tvaru: $${tex(a, b)} - ${tex(c, d)}$`,
            `Calculate and write in lowest terms: $${tex(a, b)} - ${tex(c, d)}$`,
          ),
          answer: reduced(value),
          hints: [
            L(
              `Nejmenší společný jmenovatel čísel ${b} a ${d} je ${common}.`,
              `The least common denominator of ${b} and ${d} is ${common}.`,
            ),
            L(
              `$${tex(a, b)} = ${tex((a * common) / b, common)}$, $${tex(c, d)} = ${tex((c * common) / d, common)}$`,
              `$${tex(a, b)} = ${tex((a * common) / b, common)}$, $${tex(c, d)} = ${tex((c * common) / d, common)}$`,
            ),
          ],
          solution: [
            step(
              'Na společného jmenovatele:',
              'To a common denominator:',
              `${tex((a * common) / b, common)} - ${tex((c * common) / d, common)} = ${tex((a * common) / b - (c * common) / d, common)}`,
            ),
            step('V základním tvaru:', 'In lowest terms:', fToTex(value)),
          ],
          misconceptions: [
            mc(
              fToInput(fSub(frac(c, d), frac(a, b))),
              'sign',
              'Pořadí při odčítání nejde prohodit: výsledek má opačné znaménko.',
              'The order of a subtraction cannot be swapped: the result has the opposite sign.',
            ),
          ],
          verify: [{ kind: 'value', expr: `${a}/${b}-${c}/${d}` }],
        };
      }
      const whole = r.int(1, 3);
      const [b, d] = r.pick([
        [2, 3],
        [3, 4],
        [2, 5],
        [4, 6],
        [3, 6],
        [2, 8],
      ] as const);
      const a = r.pick(coprimeTo(b, [1, 3, 5]).filter((n) => n < b + 3));
      const c = r.pick(coprimeTo(d, [1, 5, 7]).filter((n) => n < d));
      const value = fSub(frac(whole), fAdd(frac(a, b), frac(c, d)));
      const inner = fAdd(frac(a, b), frac(c, d));
      return {
        prompt: L(
          `Vypočtěte a zapište zlomkem v základním tvaru: $${whole} - \\left(${tex(a, b)} + ${tex(c, d)}\\right)$`,
          `Calculate and write in lowest terms: $${whole} - \\left(${tex(a, b)} + ${tex(c, d)}\\right)$`,
        ),
        answer: reduced(value),
        hints: [
          L(
            'Nejdřív závorka. Celé číslo pak zapiš jako zlomek se stejným jmenovatelem.',
            'The bracket first. Then write the whole number as a fraction with the same denominator.',
          ),
          L(`Závorka je $${fToTex(inner)}$.`, `The bracket is $${fToTex(inner)}$.`),
        ],
        solution: [
          step('Závorka:', 'The bracket:', `${tex(a, b)} + ${tex(c, d)} = ${fToTex(inner)}`),
          step(
            'Odečteme od celého čísla:',
            'Subtract from the whole number:',
            `${tex(whole * inner.d, inner.d)} - ${fToTex(inner)} = ${fToTex(value)}`,
          ),
        ],
        misconceptions: [
          mc(
            fToInput(fAdd(fSub(frac(whole), frac(a, b)), frac(c, d))),
            'sign',
            'Minus před závorkou platí pro oba zlomky v ní.',
            'The minus in front of the bracket applies to both fractions inside.',
          ),
        ],
        verify: [{ kind: 'value', expr: `${whole}-(${a}/${b}+${c}/${d})` }],
      };
    },
  }),

  gen({
    id: 'frac.operations.mul-div',
    concept: 'frac.operations',
    kind: 'core',
    levels: [1, 2, 3],
    title: L('Násobení a dělení zlomků', 'Multiplying and dividing fractions'),
    est: (lv) => 45 + 30 * lv,
    make(r, lv) {
      const [x, y] = r.pick([
        [2, 3],
        [3, 4],
        [2, 5],
        [3, 5],
        [4, 5],
        [5, 6],
        [3, 7],
        [2, 7],
        [5, 8],
        [4, 9],
      ] as const);
      const k = r.pick([2, 3, 4, 5]);
      const m = r.pick([2, 3, 5, 7].filter((n) => n !== k));
      if (lv === 1) {
        // (x·k)/(y·m) · m/(k·j): built so that something cancels crosswise, with each
        // fraction given in lowest terms — the test never prints 12/12 or 6/9.
        const k = r.pick(coprimeTo(y, [2, 3, 4, 5]));
        const m = r.pick([2, 3, 5, 7].filter((n) => gcd(n, k) === 1 && gcd(n, x) === 1));
        const first = [x * k, y * m] as const;
        const second = [m, k * r.pick(coprimeTo(m, [1, 2, 3]))] as const;
        const value = fMul(frac(first[0], first[1]), frac(second[0], second[1]));
        return {
          prompt: L(
            `Vypočtěte a zapište zlomkem v základním tvaru: $${tex(...first)} \\cdot ${tex(...second)}$`,
            `Calculate and write in lowest terms: $${tex(...first)} \\cdot ${tex(...second)}$`,
          ),
          answer: reduced(value),
          hints: [
            L(
              'Čitatel krát čitatel, jmenovatel krát jmenovatel — ale nejdřív krať křížem.',
              'Numerator times numerator, denominator times denominator — but cancel crosswise first.',
            ),
            L(
              `Čitatel ${second[0]} se krátí s jmenovatelem ${first[1]}, jmenovatel ${second[1]} s čitatelem ${first[0]}.`,
              `The numerator ${second[0]} cancels with the denominator ${first[1]}, and the denominator ${second[1]} with the numerator ${first[0]}.`,
            ),
          ],
          solution: [
            step('Součin:', 'The product:', `\\frac{${first[0]} \\cdot ${second[0]}}{${first[1]} \\cdot ${second[1]}}`),
            step('Po zkrácení:', 'After cancelling:', fToTex(value)),
          ],
          misconceptions: [
            mc(
              fToInput(frac(first[0] * second[1], first[1] * second[0])),
              'formula',
              'To je dělení (násobení převráceným zlomkem). Tady se násobí přímo.',
              'That is division (multiplying by the reciprocal). Here you multiply directly.',
            ),
          ],
          verify: [{ kind: 'value', expr: `${first[0]}/${first[1]}*${second[0]}/${second[1]}` }],
        };
      }
      if (lv === 2) {
        const first = frac(x, y * k);
        const second = frac(x * m, y);
        const value = fDiv(first, second);
        return {
          prompt: L(
            `Vypočtěte a zapište zlomkem v základním tvaru: $${fToTex(first)} : ${fToTex(second)}$`,
            `Calculate and write in lowest terms: $${fToTex(first)} \\div ${fToTex(second)}$`,
          ),
          answer: reduced(value),
          hints: [
            L(
              'Dělit zlomkem znamená násobit zlomkem převráceným.',
              'Dividing by a fraction means multiplying by its reciprocal.',
            ),
            L(
              `$${fToTex(first)} \\cdot ${tex(second.d, second.n)}$`,
              `$${fToTex(first)} \\cdot ${tex(second.d, second.n)}$`,
            ),
          ],
          solution: [
            step(
              'Násobíme převráceným zlomkem:',
              'Multiply by the reciprocal:',
              `${fToTex(first)} \\cdot ${tex(second.d, second.n)}`,
            ),
            step('Po zkrácení:', 'After cancelling:', fToTex(value)),
          ],
          misconceptions: [
            mc(
              fToInput(fMul(first, second)),
              'formula',
              'Vynásobil jsi zlomky. Při dělení se druhý zlomek nejdřív převrací.',
              'You multiplied the fractions. In a division the second fraction is turned over first.',
            ),
          ],
          verify: [{ kind: 'value', expr: `(${fToInput(first)})/(${fToInput(second)})` }],
        };
      }
      const a = frac(r.pick([1, 3, 5, 7]), r.pick([2, 4]));
      const b = frac(r.pick([1, 2, 4, 5]), 3);
      const c = frac(r.pick([1, 5, 7]), r.pick([6, 12]));
      const inner = fSub(a, b);
      const value = fDiv(inner, c);
      return {
        prompt: L(
          `Vypočtěte a zapište zlomkem v základním tvaru: $\\left(${fToTex(a)} - ${fToTex(b)}\\right) : ${fToTex(c)}$`,
          `Calculate and write in lowest terms: $\\left(${fToTex(a)} - ${fToTex(b)}\\right) \\div ${fToTex(c)}$`,
        ),
        answer: reduced(value),
        hints: [
          L(
            'Nejdřív závorka na společného jmenovatele, potom násobení převráceným zlomkem.',
            'First the bracket over a common denominator, then multiply by the reciprocal.',
          ),
          L(`Závorka je $${fToTex(inner)}$.`, `The bracket is $${fToTex(inner)}$.`),
        ],
        solution: [
          step('Závorka:', 'The bracket:', `${fToTex(a)} - ${fToTex(b)} = ${fToTex(inner)}`),
          step('Dělení:', 'The division:', `${texP(inner)} \\cdot ${tex(c.d, c.n)} = ${fToTex(value)}`),
        ],
        misconceptions: [
          mc(
            fToInput(fMul(inner, c)),
            'formula',
            'Dělení zlomkem je násobení převráceným zlomkem.',
            'Dividing by a fraction is multiplying by its reciprocal.',
          ),
        ],
        verify: [{ kind: 'value', expr: `(${fToInput(a)}-${fToInput(b)})/(${fToInput(c)})` }],
      };
    },
  }),

  gen({
    id: 'frac.operations.compound',
    concept: 'frac.operations',
    kind: 'hard',
    levels: [3, 4],
    title: L('Složený zlomek', 'Compound fractions'),
    est: (lv) => 60 + 40 * lv,
    make(r, lv) {
      const a = frac(r.pick([1, 3, 5]), r.pick([2, 4]));
      const b = frac(r.pick([1, 2, 5]), r.pick([3, 6]));
      const c = frac(r.pick([2, 4, 5, 7]), r.pick([3, 9]));
      if (lv === 3) {
        const top = fAdd(a, b);
        const value = fDiv(top, c);
        return {
          prompt: L(
            `Vypočtěte a zapište zlomkem v základním tvaru: $$\\frac{${fToTex(a)} + ${fToTex(b)}}{${fToTex(c)}}$$`,
            `Calculate and write in lowest terms: $$\\frac{${fToTex(a)} + ${fToTex(b)}}{${fToTex(c)}}$$`,
          ),
          answer: reduced(value),
          hints: [
            L(
              'Hlavní zlomková čára je dělení: nejdřív spočítej čitatele, pak ho vyděl jmenovatelem.',
              'The main fraction bar is a division: work out the numerator first, then divide by the denominator.',
            ),
            L(`Čitatel je $${fToTex(top)}$.`, `The numerator is $${fToTex(top)}$.`),
          ],
          solution: [
            step('Čitatel:', 'The numerator:', `${fToTex(a)} + ${fToTex(b)} = ${fToTex(top)}`),
            step(
              'Dělení jmenovatelem:',
              'Dividing by the denominator:',
              `${fToTex(top)} \\cdot ${tex(c.d, c.n)} = ${fToTex(value)}`,
            ),
          ],
          misconceptions: [
            mc(
              fToInput(fMul(top, c)),
              'formula',
              'Zlomková čára znamená dělení, ne násobení.',
              'A fraction bar means division, not multiplication.',
            ),
          ],
          verify: [{ kind: 'value', expr: `(${fToInput(a)}+${fToInput(b)})/(${fToInput(c)})` }],
        };
      }
      const g = r.pick([2, 3]);
      const top = fMul(a, frac(-b.n, b.d));
      const bottom = fAdd(fDiv(c, frac(g)), frac(1));
      const value = fDiv(top, bottom);
      return {
        prompt: L(
          `Vypočtěte a zapište zlomkem v základním tvaru: $$\\frac{${fToTex(a)} \\cdot \\left(-${fToTex(b)}\\right)}{${fToTex(c)} : ${g} + 1}$$`,
          `Calculate and write in lowest terms: $$\\frac{${fToTex(a)} \\cdot \\left(-${fToTex(b)}\\right)}{${fToTex(c)} \\div ${g} + 1}$$`,
        ),
        answer: reduced(value),
        hints: [
          L(
            'Čitatele a jmenovatele spočítej každého zvlášť. Ve jmenovateli má dělení přednost před sčítáním.',
            'Work out the numerator and the denominator separately. In the denominator division comes before addition.',
          ),
          L(
            `Čitatel je $${fToTex(top)}$, jmenovatel $${fToTex(bottom)}$.`,
            `The numerator is $${fToTex(top)}$, the denominator $${fToTex(bottom)}$.`,
          ),
        ],
        solution: [
          step('Čitatel:', 'The numerator:', `${fToTex(a)} \\cdot \\left(-${fToTex(b)}\\right) = ${fToTex(top)}`),
          step(
            'Jmenovatel:',
            'The denominator:',
            L(
              `${fToTex(c)} : ${g} + 1 = ${fToTex(fDiv(c, frac(g)))} + 1 = ${fToTex(bottom)}`,
              `${fToTex(c)} \\div ${g} + 1 = ${fToTex(fDiv(c, frac(g)))} + 1 = ${fToTex(bottom)}`,
            ),
          ),
          step('Podíl:', 'The quotient:', `${texP(top)} \\cdot ${tex(bottom.d, bottom.n)} = ${fToTex(value)}`),
        ],
        misconceptions: [
          mc(
            fToInput(frac(-value.n, value.d)),
            'sign',
            'Součin kladného a záporného zlomku je záporný.',
            'The product of a positive and a negative fraction is negative.',
          ),
          mc(
            fToInput(fDiv(top, fDiv(c, frac(g + 1)))),
            'algebra',
            'Ve jmenovateli se nejdřív dělí, teprve potom přičítá jednička.',
            'In the denominator you divide first and only then add the one.',
          ),
        ],
        verify: [{ kind: 'value', expr: `(${fToInput(a)}*(-${fToInput(b)}))/((${fToInput(c)})/${g}+1)` }],
      };
    },
  }),

  gen({
    id: 'frac.operations.spot',
    concept: 'frac.operations',
    kind: 'debug',
    levels: [2, 3],
    title: L('Najdi chybu ve výpočtu se zlomky', 'Find the mistake in a fraction calculation'),
    est: (lv) => 60 + 25 * lv,
    make(r, lv) {
      // (a/b ± c/d) : e/f, written out in four lines; one of them goes wrong and the
      // lines after it follow from the wrong value, as a real slip would.
      const [b, d] = r.pick([
        [2, 3],
        [3, 4],
        [2, 5],
        [3, 5],
        [4, 5],
        [2, 7],
      ] as const);
      const a = r.pick(coprimeTo(b, [1, 3, 5]).filter((n) => n < 2 * b));
      const c = r.pick(coprimeTo(d, [1, 2, 4]).filter((n) => n < d));
      const minus = lv === 3;
      const e = r.pick([2, 3, 5]);
      const f = r.pick(coprimeTo(e, [3, 4, 7]));
      const common = b * d;
      const na = a * d;
      const nc = c * b;
      const sum = minus ? na - nc : na + nc;
      const op = minus ? '-' : '+';
      const kinds = ['expand', 'add', 'invert', ...(minus ? (['order'] as const) : [])] as const;
      const kind = r.pick(kinds);

      // Line 1: to the common denominator.
      const line1Right = `${tex(a, b)} ${op} ${tex(c, d)} = ${tex(na, common)} ${op} ${tex(nc, common)}`;
      const line1Wrong = `${tex(a, b)} ${op} ${tex(c, d)} = ${tex(a, common)} ${op} ${tex(c, common)}`;
      const afterLine1 = kind === 'expand' ? (minus ? a - c : a + c) : sum;
      // Line 2: the numerators combined.
      const slip = kind === 'add' ? (minus ? na + nc : na + nc + 1) : kind === 'order' ? nc - na : afterLine1;
      const line2 = `= ${tex(slip, common)}`;
      // Line 3: the division rewritten.
      const line3Right = `${tex(slip, common)} : ${tex(e, f)} = ${tex(slip, common)} \\cdot ${tex(f, e)}`;
      const line3Wrong = `${tex(slip, common)} : ${tex(e, f)} = ${tex(slip, common)} \\cdot ${tex(e, f)}`;
      const last = kind === 'invert' ? frac(slip * e, common * f) : frac(slip * f, common * e);
      const lines = [
        { tex: kind === 'expand' ? line1Wrong : line1Right },
        { tex: line2 },
        { tex: kind === 'invert' ? line3Wrong : line3Right },
        { tex: `= ${fToTex(last)}` },
      ];
      const wrongLine = kind === 'expand' ? 0 : kind === 'invert' ? 2 : 1;
      const right = fDiv(frac(sum, common), frac(e, f));
      const explain = {
        expand: step(
          'Rozšířit zlomek znamená vynásobit čitatele i jmenovatele stejným číslem. V prvním řádku se změnily jen jmenovatele.',
          'Expanding a fraction means multiplying the numerator and the denominator by the same number. In the first line only the denominators changed.',
        ),
        add: step(
          `Ve druhém řádku jsou čitatele spočítány špatně: $${na} ${op} ${nc} = ${sum}$.`,
          `In the second line the numerators are combined wrongly: $${na} ${op} ${nc} = ${sum}$.`,
        ),
        order: step(
          `Ve druhém řádku se odčítalo v opačném pořadí: $${na} - ${nc} = ${sum}$, ne $${nc - na}$.`,
          `In the second line the subtraction was done the other way round: $${na} - ${nc} = ${sum}$, not $${nc - na}$.`,
        ),
        invert: step(
          'Ve třetím řádku se dělení změnilo na násobení, ale zlomek zůstal stejný. Dělit zlomkem znamená násobit zlomkem převráceným.',
          'In the third line the division became a multiplication but the fraction stayed the same. Dividing by a fraction means multiplying by its reciprocal.',
        ),
      } as const;
      return {
        prompt: L(
          `Žák počítal $\\left(${tex(a, b)} ${op} ${tex(c, d)}\\right) : ${tex(e, f)}$. Ve kterém řádku udělal první chybu?`,
          `A pupil computed $\\left(${tex(a, b)} ${op} ${tex(c, d)}\\right) \\div ${tex(e, f)}$. In which line is the first mistake?`,
        ),
        answer: {
          kind: 'spot',
          lines,
          wrongLine,
          errorType:
            kind === 'expand' ? 'algebra' : kind === 'invert' ? 'formula' : kind === 'order' ? 'sign' : 'arithmetic',
        },
        hints: [
          L(
            'Nekontroluj výsledek, ale každý řádek zvlášť: plyne z toho předchozího?',
            'Do not check the result; check each line on its own: does it follow from the one before?',
          ),
          L(
            'Tři místa, kde se u zlomků nejčastěji chybuje: rozšíření na společného jmenovatele, sečtení čitatelů, převrácení dělitele.',
            'Three places where fraction mistakes usually happen: expanding to a common denominator, combining the numerators, turning the divisor over.',
          ),
        ],
        solution: [explain[kind], step('Správně vychází:', 'The correct result:', fToTex(right))],
      };
    },
  }),

  // ------------------------------------------------------------------------------ percent
  gen({
    id: 'pct.basics.three-types',
    concept: 'pct.basics',
    kind: 'core',
    levels: [1, 2, 3],
    title: L('Procentová část, základ a počet procent', 'Part, base and rate'),
    est: (lv) => 40 + 25 * lv,
    make(r, lv) {
      const p = r.pick([5, 10, 15, 20, 25, 30, 40, 60, 75]);
      const base = r.pick([40, 60, 80, 120, 160, 200, 240, 300, 360]);
      const part = (base * p) / 100;
      if (lv === 1) {
        return {
          prompt: L(`Kolik je ${p} % z čísla ${base}?`, `What is ${p} % of ${base}?`),
          answer: { kind: 'number', value: ans(part) },
          hints: [
            L('Jedno procento je setina základu.', 'One per cent is a hundredth of the base.'),
            both((n) => `1 % ${n === cs ? 'je' : 'is'} $${n(base / 100)}$.`),
          ],
          solution: [
            step(
              'Jedno procento:',
              'One per cent:',
              both((n, czech) => `${base} ${czech ? ':' : '\\div'} 100 = ${n(base / 100)}`),
            ),
            step(
              `${p} procent:`,
              `${p} per cent:`,
              both((n) => `${p} \\cdot ${n(base / 100)} = ${n(part)}`),
            ),
          ],
          misconceptions: [
            mc(
              ans(base / p),
              'formula',
              'Procenta se nepočítají dělením základu počtem procent.',
              'A percentage is not found by dividing the base by the rate.',
            ),
          ],
          verify: [{ kind: 'value', expr: `${p}/100*${base}` }],
        };
      }
      if (lv === 2) {
        const [text, textEn] = r.pick([
          [
            `Dětských knih je v knihovně ${part}, což je ${p} % všech jejích knih. Kolik knih má knihovna celkem?`,
            `A library has ${part} children's books, which is ${p} % of all its books. How many books does it have in all?`,
          ],
          [
            `Míst pro invalidy je na parkovišti ${part}, což je ${p} % všech míst. Kolik míst má parkoviště celkem?`,
            `A car park has ${part} places for the disabled, which is ${p} % of all its places. How many places does it have in all?`,
          ],
          [
            `Vadných výrobků bylo ${part}, což je ${p} % všech vyrobených. Kolik výrobků bylo vyrobeno celkem?`,
            `${part} products were faulty, which is ${p} % of all that were made. How many products were made in all?`,
          ],
        ] as const);
        return {
          prompt: L(text, textEn),
          answer: { kind: 'number', value: ans(base) },
          hints: [
            L(`Kolik je jedno procento, když ${p} % je ${part}?`, `How much is one per cent if ${p} % is ${part}?`),
            both(
              (n) =>
                `1 % ${n === cs ? 'je' : 'is'} $${n(part / p)}$; ${n === cs ? 'základ je 100 %.' : 'the base is 100 %.'}`,
            ),
          ],
          solution: [
            step(
              'Jedno procento:',
              'One per cent:',
              both((n, czech) => `${n(part)} ${czech ? ':' : '\\div'} ${p} = ${n(part / p)}`),
            ),
            step(
              'Sto procent:',
              'One hundred per cent:',
              both((n) => `100 \\cdot ${n(part / p)} = ${base}`),
            ),
          ],
          misconceptions: [
            mc(
              ans((part * p) / 100),
              'concept',
              `Počítal jsi ${p} % z čísla ${part}. To číslo ale je ta část — základ musí být větší.`,
              `You took ${p} % of ${part}. But that number is the part — the base must be larger.`,
            ),
          ],
          verify: [{ kind: 'value', expr: `${part}/(${p}/100)` }],
          context: { applied: true },
        };
      }
      const sold = base - part;
      return {
        prompt: L(
          `Z ${base} vstupenek se prodalo ${sold}. Kolik procent vstupenek zbylo?`,
          `Of ${base} tickets, ${sold} were sold. What percentage of the tickets was left?`,
        ),
        answer: { kind: 'number', value: ans(p) },
        hints: [
          L(
            'Nejdřív zjisti, kolik vstupenek zbylo. Procenta se počítají ze všech vstupenek.',
            'First find how many tickets were left. The percentage is of all the tickets.',
          ),
          L(
            `${plural(part, 'Zbyla', 'Zbyly', 'Zbylo')} ${part} ${plural(part, 'vstupenka', 'vstupenky', 'vstupenek')} a 1 % je ${csT(base / 100)}.`,
            `${part} tickets were left and 1 % is ${base / 100}.`,
          ),
        ],
        solution: [
          step('Zbylo:', 'Left:', `${base} - ${sold} = ${part}`),
          step('V procentech:', 'As a percentage:', `\\frac{${part}}{${base}} \\cdot 100 = ${p}`),
        ],
        misconceptions: [
          mc(
            ans(100 - p),
            'misread',
            'To je procento prodaných vstupenek. Otázka se ptá na ty, které zbyly.',
            'That is the percentage sold. The question asks about what was left.',
          ),
        ],
        verify: [{ kind: 'value', expr: `(${base}-${sold})/${base}*100` }],
        context: { applied: true },
      };
    },
  }),

  gen({
    id: 'pct.basics.two-step',
    concept: 'pct.basics',
    kind: 'applied',
    levels: [2, 3, 4],
    title: L('Procenta ve dvou krocích', 'Percent in two steps'),
    est: (lv) => 55 + 30 * lv,
    make(r, lv) {
      const total = r.pick([200, 300, 400, 500, 600]);
      const p = r.pick([20, 40, 50, 60]);
      const first = (total * p) / 100;
      const rest = total - first;
      if (lv === 2) {
        return {
          prompt: L(
            `Školu navštěvuje ${total} žáků a ${p} % z nich dojíždí autobusem. Kolik žáků autobusem nedojíždí?`,
            `A school has ${total} pupils and ${p} % of them come by bus. How many pupils do not come by bus?`,
          ),
          answer: { kind: 'number', value: ans(rest) },
          hints: [
            L(`Kolik procent žáků autobusem nedojíždí?`, `What percentage of the pupils do not come by bus?`),
            L(`Nedojíždí ${100 - p} % žáků.`, `${100 - p} % do not.`),
          ],
          solution: [
            step(
              `${100 - p} % z ${total}:`,
              `${100 - p} % of ${total}:`,
              `\\frac{${100 - p}}{100} \\cdot ${total} = ${rest}`,
            ),
          ],
          misconceptions: [
            mc(
              ans(first),
              'misread',
              'To jsou žáci, kteří autobusem dojíždějí.',
              'Those are the pupils who do come by bus.',
            ),
          ],
          verify: [{ kind: 'value', expr: `${total}*(100-${p})/100` }],
          context: { applied: true },
        };
      }
      if (lv === 3) {
        const q = r.pick([10, 25, 50].filter((v) => Number.isInteger((rest * v) / 100)));
        const second = (rest * q) / 100;
        return {
          prompt: L(
            `Na sportovní den přišlo ${total} žáků. ${p} % z nich si vybralo míčové hry a ${q} % z ostatních šlo plavat. Kolik žáků šlo plavat?`,
            `${total} pupils came to the sports day. ${p} % of them chose ball games and ${q} % of the others went swimming. How many pupils went swimming?`,
          ),
          answer: { kind: 'number', value: ans(second) },
          hints: [
            L(
              'Druhé procento se nepočítá ze všech žáků, ale jen z těch ostatních.',
              'The second percentage is not of all the pupils, only of the others.',
            ),
            L(`Ostatních je ${rest}.`, `There are ${rest} others.`),
          ],
          solution: [
            step('Ostatní žáci:', 'The other pupils:', `${total} - ${first} = ${rest}`),
            step(`${q} % z nich:`, `${q} % of them:`, `\\frac{${q}}{100} \\cdot ${rest} = ${second}`),
          ],
          misconceptions: [
            mc(
              ans((total * q) / 100),
              'misread',
              `Počítal jsi ${q} % ze všech žáků. Základem jsou jen ti, kteří nehráli míčové hry.`,
              `You took ${q} % of all the pupils. The base is only those who did not play ball games.`,
            ),
          ],
          verify: [{ kind: 'value', expr: `(${total}-${total}*${p}/100)*${q}/100` }],
          context: { applied: true },
        };
      }
      // The same number is a different share of two bases.
      // The same people are a smaller share of a larger club.
      const [p1, p2] = r.pick([
        [5, 4],
        [10, 8],
        [25, 20],
        [20, 16],
      ] as const);
      const count = r.pick([4, 8, 12, 16, 20]) * (p1 === 5 || p1 === 25 ? 1 : 2);
      const before = (count * 100) / p1;
      const after = (count * 100) / p2;
      return {
        prompt: L(
          `V klubu ${plural(count, 'je', 'jsou', 'je')} ${count} ${plural(count, 'trenér', 'trenéři', 'trenérů')}. Loni tvořili ${p1} % všech členů klubu, letos po náboru nových členů tvoří už jen ${p2} %. O kolik členů se klub rozrostl?`,
          `A club has ${count} coaches. Last year they were ${p1} % of all its members; this year, after new members joined, they are only ${p2} %. By how many members did the club grow?`,
        ),
        answer: { kind: 'number', value: ans(after - before) },
        hints: [
          L(
            'Počet trenérů se nezměnil — změnil se základ. Spočítej počet členů loni a letos zvlášť.',
            'The number of coaches did not change — the base did. Work out the membership last year and this year separately.',
          ),
          L(`Loni měl klub ${before} členů.`, `Last year the club had ${before} members.`),
        ],
        solution: [
          step(
            'Loni:',
            'Last year:',
            L(`${count} : ${p1} \\cdot 100 = ${before}`, `${count} \\div ${p1} \\cdot 100 = ${before}`),
          ),
          step(
            'Letos:',
            'This year:',
            L(`${count} : ${p2} \\cdot 100 = ${after}`, `${count} \\div ${p2} \\cdot 100 = ${after}`),
          ),
          step('Rozdíl:', 'The difference:', `${after} - ${before} = ${after - before}`),
        ],
        misconceptions: [
          mc(
            ans(after),
            'incomplete',
            'Tolik členů má klub letos. Otázka se ptá, o kolik jich přibylo.',
            'That is this year’s membership. The question asks by how many it grew.',
          ),
        ],
        verify: [{ kind: 'value', expr: `${count}*100/${p2}-${count}*100/${p1}` }],
        context: { applied: true },
      };
    },
  }),

  gen({
    id: 'pct.basics.matching',
    concept: 'pct.basics',
    kind: 'applied',
    levels: [2, 3],
    title: L('Procenta – přiřazení výsledku', 'Percent – match the result'),
    tags: ['match6'],
    est: (lv) => 50 + 25 * lv,
    make(r, lv) {
      const options = [10, 20, 25, 40, 50, 75];
      const p = r.pick(options);
      const prefix = L('', '');
      if (lv === 2) {
        const base = r.pick([40, 80, 120, 160, 200, 280]);
        const part = (base * p) / 100;
        return {
          prompt: L(
            `V sadu roste ${base} stromů, z toho ${part} ${plural(part, 'jabloň', 'jabloně', 'jabloní')}. Kolik procent stromů v sadu jsou jabloně?`,
            `An orchard has ${base} trees, ${part} of them apple trees. What percentage of the trees are apple trees?`,
          ),
          answer: percentOptions(options, p, prefix),
          hints: [
            L(
              'Jakou část ze všech stromů tvoří jabloně? Zapiš ji zlomkem a zkrať.',
              'What part of all the trees are apple trees? Write it as a fraction and reduce it.',
            ),
            L(
              `$\\frac{${part}}{${base}} = ${fToTex(frac(part, base))}$`,
              `$\\frac{${part}}{${base}} = ${fToTex(frac(part, base))}$`,
            ),
          ],
          solution: [
            step('Část celku:', 'The part of the whole:', `\\frac{${part}}{${base}} = ${fToTex(frac(p, 100))}`),
            step('V procentech:', 'As a percentage:', `${p}\\ \\%`),
          ],
          context: { applied: true },
        };
      }
      // The rest of the whole after two shares.
      const total = r.pick([40, 80, 120, 200]);
      const others = 100 - p;
      // Shares in fives, so that every count is whole for each of the totals.
      const firstShare = r.pick([10, 15, 20].filter((v) => v < others));
      const first = (total * firstShare) / 100;
      const second = (total * (others - firstShare)) / 100;
      return {
        prompt: L(
          `Zmrzlinář prodal za den ${total} kornoutů: ${first} ${plural(first, 'vanilkový', 'vanilkové', 'vanilkových')}, ${second} ${plural(second, 'čokoládový', 'čokoládové', 'čokoládových')} a zbytek jahodových. Kolik procent prodaných kornoutů byly jahodové?`,
          `An ice-cream seller sold ${total} cones in a day: ${first} vanilla, ${second} chocolate and the rest strawberry. What percentage of the cones sold were strawberry?`,
        ),
        answer: percentOptions(options, p, prefix),
        hints: [
          L('Nejdřív zjisti, kolik kornoutů bylo jahodových.', 'First find how many cones were strawberry.'),
          L(`Jahodových bylo ${total - first - second}.`, `${total - first - second} were strawberry.`),
        ],
        solution: [
          step('Jahodové:', 'Strawberry:', `${total} - ${first} - ${second} = ${total - first - second}`),
          step('V procentech:', 'As a percentage:', `\\frac{${total - first - second}}{${total}} \\cdot 100 = ${p}`),
        ],
        context: { applied: true },
      };
    },
  }),

  gen({
    id: 'pct.basics.choice',
    concept: 'pct.basics',
    kind: 'applied',
    levels: [2, 3],
    title: L('Procenta – výběr odpovědi', 'Percent – choose the answer'),
    tags: ['mc5'],
    est: (lv) => 60 + 30 * lv,
    make(r, lv) {
      if (lv === 2) {
        const base = r.pick([120, 160, 180, 240, 360]);
        const p = r.pick([15, 20, 30, 35, 45]);
        const part = (base * p) / 100;
        const left = base - part;
        const built = numericChoice(r, left, [part, base - p, base / p, left - part], (v) =>
          L(`${v} ${plural(v, 'sazenice', 'sazenice', 'sazenic')}`, `${v} ${v === 1 ? 'seedling' : 'seedlings'}`),
        );
        return {
          prompt: L(
            `Zahradník měl ${base} sazenic a ${p} % z nich už vysadil. Kolik sazenic mu ještě zbývá vysadit?`,
            `A gardener had ${base} seedlings and has planted ${p} % of them. How many seedlings are still to be planted?`,
          ),
          answer: built.spec,
          hints: [
            L(`Kolik sazenic je ${p} %?`, `How many seedlings is ${p} %?`),
            L(`Vysadil ${part} ${plural(part, 'sazenici', 'sazenice', 'sazenic')}.`, `${part} have been planted.`),
          ],
          solution: [
            step('Vysazeno:', 'Planted:', `\\frac{${p}}{100} \\cdot ${base} = ${part}`),
            step('Zbývá:', 'Left:', `${base} - ${part} = ${left}`),
          ],
          misconceptions: [built.idOf(part), built.idOf(base - p)].flatMap((id, index) =>
            id
              ? [
                  index === 0
                    ? mc(
                        id,
                        'misread',
                        'Tolik sazenic už vysadil. Otázka se ptá, kolik zbývá.',
                        'That many have been planted. The question asks how many are left.',
                      )
                    : mc(
                        id,
                        'concept',
                        'Procenta nejsou kusy: 1 % z tohoto počtu není jedna sazenice.',
                        'Per cent are not pieces: 1 % of this number is not one seedling.',
                      ),
                ]
              : [],
          ),
          context: { applied: true },
        };
      }
      const [p1, p2] = r.pick([
        [30, 40],
        [25, 60],
        [20, 30],
        [40, 75],
        [50, 20],
      ] as const);
      const total = r.pick([200, 300, 400, 600]);
      const damaged = (total * p2) / 100;
      const count = (damaged * p1) / 100;
      const built = numericChoice(r, total, [damaged, (count * 100) / p2, count * 10, total - damaged], (v) =>
        L(`${v} knih`, `${v} books`),
      );
      return {
        prompt: L(
          `Při stěhování knihovny se poškodilo ${p2} % všech knih. Z poškozených knih muselo být ${p1} % vyřazeno — bylo to ${count} knih. Kolik knih měla knihovna?`,
          `When a library moved, ${p2} % of all its books were damaged. Of the damaged books ${p1} % had to be discarded — that was ${count} books. How many books did the library have?`,
        ),
        answer: built.spec,
        hints: [
          L(
            'Postupuj od konce: z počtu vyřazených knih zjisti počet poškozených.',
            'Work backwards: from the discarded books find the number of damaged ones.',
          ),
          L(`Poškozených knih bylo ${damaged}.`, `${damaged} books were damaged.`),
        ],
        solution: [
          step(
            `${count} knih je ${p1} % poškozených:`,
            `${count} books are ${p1} % of the damaged ones:`,
            L(`${count} : ${p1} \\cdot 100 = ${damaged}`, `${count} \\div ${p1} \\cdot 100 = ${damaged}`),
          ),
          step(
            `${damaged} knih je ${p2} % všech:`,
            `${damaged} books are ${p2} % of all:`,
            L(`${damaged} : ${p2} \\cdot 100 = ${total}`, `${damaged} \\div ${p2} \\cdot 100 = ${total}`),
          ),
        ],
        misconceptions: [built.idOf(damaged)].flatMap((id) =>
          id
            ? [
                mc(
                  id,
                  'incomplete',
                  'To je počet poškozených knih. Všech knih bylo víc.',
                  'That is the number of damaged books. There were more books in all.',
                ),
              ]
            : [],
        ),
        context: { applied: true },
      };
    },
  }),

  gen({
    id: 'pct.applied.change',
    concept: 'pct.applied',
    kind: 'core',
    levels: [1, 2, 3, 4],
    title: L('Zdražení, sleva a původní cena', 'Rise, discount and original price'),
    est: (lv) => 45 + 30 * lv,
    make(r, lv) {
      const p = r.pick([10, 20, 25, 30, 40, 50]);
      const base = r.pick([200, 300, 400, 500, 600, 800, 1200]);
      const up = r.bool();
      const factor = (100 + (up ? p : -p)) / 100;
      const changed = base * factor;
      const [item, itemEn] = r.pick([
        ['Batoh', 'A rucksack'],
        ['Lampa', 'A lamp'],
        ['Koloběžka', 'A scooter'],
        ['Bunda', 'A jacket'],
      ] as const);
      if (lv === 1) {
        return {
          prompt: L(
            `${item} stál${item.endsWith('a') ? 'a' : ''} ${csT(base)} korun. Cena se ${up ? 'zvýšila' : 'snížila'} o ${p} %. Kolik korun stojí teď?`,
            `${itemEn} cost ${enT(base)} crowns. The price went ${up ? 'up' : 'down'} by ${p} %. How many crowns is it now?`,
          ),
          answer: { kind: 'number', value: ans(changed) },
          hints: [
            L(`Kolik korun je ${p} % z původní ceny?`, `How many crowns is ${p} % of the original price?`),
            L(`${p} % je ${(base * p) / 100} korun.`, `${p} % is ${(base * p) / 100} crowns.`),
          ],
          solution: [
            step(
              'Změna v korunách:',
              'The change in crowns:',
              `\\frac{${p}}{100} \\cdot ${base} = ${(base * p) / 100}`,
            ),
            step('Nová cena:', 'The new price:', `${base} ${up ? '+' : '-'} ${(base * p) / 100} = ${changed}`),
          ],
          misconceptions: [
            mc(
              ans((base * p) / 100),
              'incomplete',
              'To je jen změna ceny, ne nová cena.',
              'That is only the change, not the new price.',
            ),
          ],
          verify: [{ kind: 'value', expr: `${base}*${factor}` }],
          context: { applied: true },
        };
      }
      if (lv === 2) {
        return {
          prompt: L(
            `Po ${up ? `zdražení o ${p} %` : `slevě ${p} %`} stojí zboží ${csT(changed)} korun. Kolik korun stálo původně?`,
            `After a ${up ? `${p} % rise` : `${p} % discount`} an item costs ${enT(changed)} crowns. How many crowns did it cost originally?`,
          ),
          answer: { kind: 'number', value: ans(base) },
          hints: [
            L(
              `Nová cena je ${100 + (up ? p : -p)} % původní ceny.`,
              `The new price is ${100 + (up ? p : -p)} % of the original.`,
            ),
            both(
              (n) =>
                `1 % ${n === cs ? 'původní ceny je' : 'of the original price is'} $${n(changed / (100 + (up ? p : -p)))}$.`,
            ),
          ],
          solution: [
            step(
              `${csT(changed)} korun je ${100 + (up ? p : -p)} % původní ceny.`,
              `${enT(changed)} crowns are ${100 + (up ? p : -p)} % of the original price.`,
            ),
            step(
              'Původní cena:',
              'The original price:',
              L(
                `${changed} : ${100 + (up ? p : -p)} \\cdot 100 = ${base}`,
                `${changed} \\div ${100 + (up ? p : -p)} \\cdot 100 = ${base}`,
              ),
            ),
          ],
          misconceptions: [
            mc(
              ans(up ? changed * (1 - p / 100) : changed * (1 + p / 100)),
              'concept',
              `Počítal jsi ${p} % z nové ceny. Procenta se ale počítají z původní ceny, kterou hledáš.`,
              `You took ${p} % of the new price. But the percentage is of the original price, which you are looking for.`,
            ),
          ],
          verify: [{ kind: 'value', expr: `${changed}/${factor}` }],
          context: { applied: true },
        };
      }
      if (lv === 3) {
        const q = r.pick([10, 20, 25, 50]);
        const final = base * (1 + p / 100) * (1 - q / 100);
        return {
          prompt: L(
            `Zboží za ${csT(base)} korun nejdřív zdražilo o ${p} % a potom bylo zlevněno o ${q} %. Kolik korun stojí nakonec?`,
            `An item at ${enT(base)} crowns first went up by ${p} % and was then reduced by ${q} %. How many crowns is it in the end?`,
          ),
          answer: { kind: 'number', value: ans(final) },
          hints: [
            L(
              'Sleva se počítá z ceny po zdražení, ne z původní ceny.',
              'The discount is taken of the price after the rise, not of the original price.',
            ),
            L(
              `Po zdražení stojí ${csT(base * (1 + p / 100))} korun.`,
              `After the rise it costs ${enT(base * (1 + p / 100))} crowns.`,
            ),
          ],
          solution: [
            step(
              'Po zdražení:',
              'After the rise:',
              both((n) => `${base} \\cdot ${n(1 + p / 100)} = ${n(base * (1 + p / 100))}`),
            ),
            step(
              'Po slevě:',
              'After the discount:',
              both((n) => `${n(base * (1 + p / 100))} \\cdot ${n(1 - q / 100)} = ${n(final)}`),
            ),
          ],
          misconceptions: [
            mc(
              ans(base * (1 + (p - q) / 100)),
              'concept',
              'Procenta ze dvou různých základů se nedají sečíst ani odečíst.',
              'Percentages of two different bases cannot be added or subtracted.',
            ),
          ],
          verify: [{ kind: 'value', expr: `${base}*(1+${p}/100)*(1-${q}/100)` }],
          context: { applied: true },
        };
      }
      // By how many per cent is one larger, or the other smaller: the same difference, two bases.
      const [small, big] = r.pick([
        [200, 250],
        [400, 500],
        [120, 150],
        [160, 200],
        [240, 300],
        [320, 400],
        [80, 100],
        [200, 400],
        [150, 300],
        [200, 500],
        [160, 400],
        [100, 400],
      ] as const);
      const more = ((big - small) / small) * 100;
      const less = ((big - small) / big) * 100;
      const askMore = r.bool();
      const value = askMore ? more : less;
      const [longName, shortName, longEn, shortEn] = r.pick([
        ['Modrá', 'červená', 'blue', 'red'],
        ['Zelená', 'žlutá', 'green', 'yellow'],
      ] as const);
      return {
        prompt: L(
          `${longName} trasa měří ${big} m, ${shortName} trasa ${small} m. O kolik procent je ${askMore ? `${longName.toLowerCase()} trasa delší než ${shortName}` : `${shortName} trasa kratší než ${longName.toLowerCase()}`}?`,
          `The ${longEn} route is ${big} m long, the ${shortEn} route ${small} m. By what percentage is the ${askMore ? `${longEn} route longer than the ${shortEn} one` : `${shortEn} route shorter than the ${longEn} one`}?`,
        ),
        answer: { kind: 'number', value: ans(value) },
        hints: [
          L(
            'Rozdíl v metrech je v obou směrech stejný. Liší se základ: je to trasa, se kterou se porovnává („než …“).',
            'The difference in metres is the same either way. The base differs: it is the route compared with ("than …").',
          ),
          L(
            `Rozdíl je ${big - small} m a základ je ${askMore ? small : big} m.`,
            `The difference is ${big - small} m and the base is ${askMore ? small : big} m.`,
          ),
        ],
        solution: [
          step('Rozdíl:', 'The difference:', `${big} - ${small} = ${big - small}`),
          step(
            `Vzhledem k ${askMore ? 'kratší' : 'delší'} trase:`,
            `Relative to the ${askMore ? 'shorter' : 'longer'} route:`,
            `\\frac{${big - small}}{${askMore ? small : big}} \\cdot 100 = ${value}`,
          ),
        ],
        misconceptions: [
          mc(
            ans(askMore ? less : more),
            'concept',
            'Vzal jsi za základ druhou trasu. Základ je to, s čím se porovnává („než …“).',
            'You took the other route as the base. The base is what you compare with ("than …").',
          ),
          mc(
            ans(big - small),
            'misread',
            'To je rozdíl v metrech, ne v procentech.',
            'That is the difference in metres, not in per cent.',
          ),
        ],
        verify: [{ kind: 'value', expr: `(${big}-${small})/${askMore ? small : big}*100` }],
        context: { applied: true },
      };
    },
  }),

  gen({
    id: 'pct.applied.interest',
    concept: 'pct.applied',
    kind: 'applied',
    levels: [2, 3],
    title: L('Úrok a daň z úroku', 'Interest and the tax on it'),
    est: (lv) => 55 + 30 * lv,
    make(r, lv) {
      const principal = r.pick([20000, 30000, 40000, 50000, 60000, 80000]);
      const rate = r.pick([2, 3, 4, 5]);
      const interest = (principal * rate) / 100;
      if (lv === 2) {
        return {
          prompt: L(
            `Na spořicí účet s roční úrokovou mírou ${rate} % jsme uložili ${csT(principal)} korun. Kolik korun činí úrok za jeden rok?`,
            `We put ${enT(principal)} crowns into a savings account with a yearly interest rate of ${rate} %. How many crowns is the interest for one year?`,
          ),
          answer: { kind: 'number', value: ans(interest) },
          hints: [
            L(
              'Úrok za rok je tolik procent z vkladu, kolik udává úroková míra.',
              'The yearly interest is the percentage of the deposit that the interest rate states.',
            ),
            L(
              `1 % z vkladu je ${csT(principal / 100)} korun.`,
              `1 % of the deposit is ${enT(principal / 100)} crowns.`,
            ),
          ],
          solution: [
            step(
              `${rate} % z vkladu:`,
              `${rate} % of the deposit:`,
              `\\frac{${rate}}{100} \\cdot ${principal} = ${interest}`,
            ),
          ],
          misconceptions: [
            mc(
              ans(principal + interest),
              'misread',
              'To je celá částka po roce. Otázka se ptá jen na úrok.',
              'That is the whole amount after a year. The question asks only for the interest.',
            ),
          ],
          verify: [{ kind: 'value', expr: `${principal}*${rate}/100` }],
          context: { applied: true },
        };
      }
      const tax = interest * 0.15;
      const final = principal + interest - tax;
      return {
        prompt: L(
          `Na účet s roční úrokovou mírou ${rate} % jsme uložili ${csT(principal)} korun. Z úroku se odvádí daň 15 %. Kolik korun bude na účtu po jednom roce?`,
          `We put ${enT(principal)} crowns into an account with a yearly interest rate of ${rate} %. A tax of 15 % is taken from the interest. How many crowns will be in the account after one year?`,
        ),
        answer: { kind: 'number', value: ans(final) },
        hints: [
          L(
            'Daň se počítá jen z úroku, ne z celého vkladu.',
            'The tax is taken of the interest only, not of the whole deposit.',
          ),
          L(
            `Úrok je ${csT(interest)} korun, daň z něj ${csT(tax)} korun.`,
            `The interest is ${enT(interest)} crowns and the tax on it ${enT(tax)} crowns.`,
          ),
        ],
        solution: [
          step('Úrok:', 'The interest:', `\\frac{${rate}}{100} \\cdot ${principal} = ${interest}`),
          step(
            'Daň z úroku:',
            'The tax on the interest:',
            both((n) => `${n(0.15)} \\cdot ${interest} = ${n(tax)}`),
          ),
          step(
            'Na účtu:',
            'In the account:',
            both((n) => `${principal} + ${interest} - ${n(tax)} = ${n(final)}`),
          ),
        ],
        misconceptions: [
          mc(
            ans(principal + interest),
            'incomplete',
            'Z úroku se ještě odvádí daň.',
            'The tax still has to be taken from the interest.',
          ),
          mc(
            ans((principal + interest) * 0.85),
            'misread',
            'Daň se platí jen z úroku, ne z vkladu.',
            'The tax is paid on the interest only, not on the deposit.',
          ),
        ],
        verify: [{ kind: 'value', expr: `${principal}+${principal}*${rate}/100*0.85` }],
        context: { applied: true },
      };
    },
  }),

  gen({
    id: 'pct.applied.matching',
    concept: 'pct.applied',
    kind: 'applied',
    levels: [3],
    title: L('O kolik procent – přiřazení výsledku', 'By what percentage – match the result'),
    tags: ['match6'],
    est: () => 110,
    make(r) {
      const options = [10, 20, 25, 40, 50, 60];
      const p = r.pick(options);
      const up = r.bool();
      const base = r.pick([20, 40, 60, 80, 120, 200]);
      const other = up ? base + (base * p) / 100 : base - (base * p) / 100;
      const [what, whatEn] = r.pick([
        ['na tábor přihlásilo', 'signed up for the camp'],
        ['do soutěže zapojilo', 'took part in the contest'],
        ['na závod postavilo', 'started in the race'],
      ] as const);
      return {
        prompt: L(
          `Loni se ${what} ${base} dětí, letos ${other}. O kolik procent se počet dětí oproti loňsku ${up ? 'zvýšil' : 'snížil'}?`,
          `Last year ${base} children ${whatEn}, this year ${other}. By what percentage did the number ${up ? 'rise' : 'fall'} compared with last year?`,
        ),
        answer: percentOptions(options, p, L('o ', 'by ')),
        hints: [
          L(`Základem je loňský počet, ${base} dětí.`, `The base is last year's number, ${base} children.`),
          L(
            `Rozdíl ${plural(Math.abs(other - base), 'je', 'jsou', 'je')} ${Math.abs(other - base)} ${plural(Math.abs(other - base), 'dítě', 'děti', 'dětí')}.`,
            `The difference is ${Math.abs(other - base)} children.`,
          ),
        ],
        solution: [
          step(
            'Rozdíl:',
            'The difference:',
            `${Math.max(base, other)} - ${Math.min(base, other)} = ${Math.abs(other - base)}`,
          ),
          step(
            'Vzhledem k loňsku:',
            'Relative to last year:',
            `\\frac{${Math.abs(other - base)}}{${base}} \\cdot 100 = ${p}`,
          ),
        ],
        context: { applied: true },
      };
    },
  }),

  // -------------------------------------------------------------------------------- ratio
  gen({
    id: 'ratio.basics.divide',
    concept: 'ratio.basics',
    kind: 'core',
    levels: [1, 2, 3],
    title: L('Dělení v poměru', 'Dividing in a ratio'),
    est: (lv) => 45 + 30 * lv,
    make(r, lv) {
      const [a, b] = r.pick([
        [2, 3],
        [3, 4],
        [2, 5],
        [3, 5],
        [4, 5],
        [1, 4],
        [3, 7],
        [5, 7],
      ] as const);
      const k = r.int(3, 12) * (lv === 3 ? 1000 : r.pick([10, 50, 100]));
      if (lv === 1) {
        const total = (a + b) * k;
        return {
          prompt: L(
            `Částku ${csT(total)} korun rozdělíme mezi dva sourozence v poměru $${a} : ${b}$. Kolik korun dostane ten, kdo má větší díl?`,
            `${enT(total)} crowns are shared between two siblings in the ratio $${a} : ${b}$. How many crowns does the one with the larger share get?`,
          ),
          answer: { kind: 'number', value: ans(b * k) },
          hints: [
            L(
              `Celek je rozdělen na $${a} + ${b} = ${a + b}$ ${plural(a + b, 'díl', 'stejné díly', 'stejných dílů')}.`,
              `The whole is split into $${a} + ${b} = ${a + b}$ equal parts.`,
            ),
            L(`Jeden díl je ${k} korun.`, `One part is ${k} crowns.`),
          ],
          solution: [
            step('Jeden díl:', 'One part:', L(`${total} : ${a + b} = ${k}`, `${total} \\div ${a + b} = ${k}`)),
            step(
              `Větší podíl tvoří ${b} ${plural(b, 'díl', 'díly', 'dílů')}:`,
              `The larger share is ${b} parts:`,
              `${b} \\cdot ${k} = ${b * k}`,
            ),
          ],
          misconceptions: [
            mc(ans(a * k), 'misread', 'To je menší díl.', 'That is the smaller share.'),
            mc(
              fToInput(frac(total, b)),
              'concept',
              'Celek se nedělí číslem z poměru, ale součtem obou čísel.',
              'The whole is not divided by a number of the ratio but by the sum of both.',
            ),
          ],
          verify: [{ kind: 'value', expr: `${total}*${b}/(${a}+${b})` }],
          context: { applied: true },
        };
      }
      if (lv === 2) {
        const diff = (b - a) * k;
        return {
          prompt: L(
            `Úspory dvou kamarádů jsou v poměru $${a} : ${b}$ a liší se o ${csT(diff)} korun. Kolik korun má ten, kdo naspořil méně?`,
            `The savings of two friends are in the ratio $${a} : ${b}$ and differ by ${enT(diff)} crowns. How many crowns has the one who saved less?`,
          ),
          answer: { kind: 'number', value: ans(a * k) },
          hints: [
            L(
              `Rozdíl ${csT(diff)} korun odpovídá rozdílu $${b} - ${a} = ${b - a}$ ${plural(b - a, 'dílu', 'dílů', 'dílů')}.`,
              `The difference of ${enT(diff)} crowns corresponds to $${b} - ${a} = ${b - a}$ part${b - a === 1 ? '' : 's'}.`,
            ),
            L(`Jeden díl je ${k} korun.`, `One part is ${k} crowns.`),
          ],
          solution: [
            step('Jeden díl:', 'One part:', L(`${diff} : ${b - a} = ${k}`, `${diff} \\div ${b - a} = ${k}`)),
            step(
              `Menší úspory tvoří ${a} ${plural(a, 'díl', 'díly', 'dílů')}:`,
              `The smaller savings are ${a} part${a === 1 ? '' : 's'}:`,
              `${a} \\cdot ${k} = ${a * k}`,
            ),
          ],
          misconceptions: [
            mc(
              fToInput(frac(diff * a, a + b)),
              'concept',
              'Rozdíl se nedělí součtem dílů. Rozdíl odpovídá rozdílu dílů.',
              'The difference is not divided by the sum of the parts. It corresponds to the difference of the parts.',
            ),
          ],
          verify: [{ kind: 'value', expr: `${diff}/(${b}-${a})*${a}` }],
          context: { applied: true },
        };
      }
      const c = r.pick([2, 3, 4, 6].filter((v) => v !== a && v !== b));
      const total = (a + b + c) * k;
      const middle = [a, b, c].sort((x, y) => x - y)[1]!;
      return {
        prompt: L(
          `Tři firmy si rozdělily zakázku za ${csT(total)} korun v poměru $${a} : ${b} : ${c}$. Kolik korun připadlo firmě s prostředním podílem?`,
          `Three firms shared a contract worth ${enT(total)} crowns in the ratio $${a} : ${b} : ${c}$. How many crowns went to the firm with the middle share?`,
        ),
        answer: { kind: 'number', value: ans(middle * k) },
        hints: [
          L(
            `Dílů je dohromady $${a} + ${b} + ${c} = ${a + b + c}$.`,
            `There are $${a} + ${b} + ${c} = ${a + b + c}$ parts in all.`,
          ),
          L(
            `Jeden díl je ${k} korun a prostřední podíl má ${middle} ${plural(middle, 'díl', 'díly', 'dílů')}.`,
            `One part is ${k} crowns and the middle share is ${middle} parts.`,
          ),
        ],
        solution: [
          step('Jeden díl:', 'One part:', L(`${total} : ${a + b + c} = ${k}`, `${total} \\div ${a + b + c} = ${k}`)),
          step('Prostřední podíl:', 'The middle share:', `${middle} \\cdot ${k} = ${middle * k}`),
        ],
        misconceptions: [],
        verify: [{ kind: 'value', expr: `${total}*${middle}/(${a}+${b}+${c})` }],
        context: { applied: true },
      };
    },
  }),

  gen({
    id: 'ratio.basics.choice',
    concept: 'ratio.basics',
    kind: 'applied',
    levels: [2, 3],
    title: L('Poměr – výběr odpovědi', 'Ratio – choose the answer'),
    tags: ['mc5'],
    est: (lv) => 60 + 30 * lv,
    make(r, lv) {
      const [a, b, c] = r.pick([
        [1, 2, 3],
        [1, 3, 4],
        [2, 3, 5],
        [1, 2, 5],
        [2, 3, 4],
      ] as const);
      const k = r.pick([5, 10, 15, 20, 25]);
      const total = (a + b + c) * k;
      if (lv === 2) {
        const built = numericChoice(r, b * k, [a * k, c * k, total / 3, total / b], (v) => L(`${v} kg`, `${v} kg`));
        return {
          prompt: L(
            `Směs na beton se míchá z cementu, písku a štěrku v poměru $${a} : ${b} : ${c}$. Kolik kilogramů písku je ve ${total} kg směsi?`,
            `A concrete mix is made of cement, sand and gravel in the ratio $${a} : ${b} : ${c}$. How many kilograms of sand are in ${total} kg of the mix?`,
          ),
          answer: built.spec,
          hints: [
            L(
              `Směs má $${a} + ${b} + ${c} = ${a + b + c}$ ${plural(a + b + c, 'díl', 'díly', 'dílů')}.`,
              `The mix has $${a} + ${b} + ${c} = ${a + b + c}$ parts.`,
            ),
            L(
              `Jeden díl váží ${k} kg; písek tvoří ${b} ${plural(b, 'díl', 'díly', 'dílů')}.`,
              `One part weighs ${k} kg; sand makes up ${b} parts.`,
            ),
          ],
          solution: [
            step('Jeden díl:', 'One part:', L(`${total} : ${a + b + c} = ${k}`, `${total} \\div ${a + b + c} = ${k}`)),
            step('Písek:', 'Sand:', `${b} \\cdot ${k} = ${b * k}`),
          ],
          misconceptions: [built.idOf(total / 3)].flatMap((id) =>
            id
              ? [
                  mc(
                    id,
                    'concept',
                    'Díly nejsou stejně velké: směs se nedělí na třetiny.',
                    'The shares are not equal: the mix is not split into thirds.',
                  ),
                ]
              : [],
          ),
          context: { applied: true },
        };
      }
      const built = numericChoice(r, (c - a) * k, [c * k, a * k, (c - b) * k, total / 3], (v) =>
        L(`o ${v} kg`, `by ${v} kg`),
      );
      return {
        prompt: L(
          `Směs na beton se míchá z cementu, písku a štěrku v poměru $${a} : ${b} : ${c}$. O kolik kilogramů je ve ${total} kg směsi více štěrku než cementu?`,
          `A concrete mix is made of cement, sand and gravel in the ratio $${a} : ${b} : ${c}$. By how many kilograms is there more gravel than cement in ${total} kg of the mix?`,
        ),
        answer: built.spec,
        hints: [
          L(
            'Nejdřív jeden díl. Štěrk a cement se liší o rozdíl svých dílů.',
            'One part first. Gravel and cement differ by the difference of their parts.',
          ),
          L(
            `Jeden díl váží ${k} kg, rozdíl tvoří ${c - a} ${plural(c - a, 'díl', 'díly', 'dílů')}.`,
            `One part weighs ${k} kg and the difference is ${c - a} parts.`,
          ),
        ],
        solution: [
          step('Jeden díl:', 'One part:', L(`${total} : ${a + b + c} = ${k}`, `${total} \\div ${a + b + c} = ${k}`)),
          step('Rozdíl:', 'The difference:', `(${c} - ${a}) \\cdot ${k} = ${(c - a) * k}`),
        ],
        misconceptions: [built.idOf(c * k)].flatMap((id) =>
          id
            ? [
                mc(
                  id,
                  'misread',
                  'To je hmotnost štěrku. Otázka se ptá na rozdíl.',
                  'That is the weight of the gravel. The question asks for the difference.',
                ),
              ]
            : [],
        ),
        context: { applied: true },
      };
    },
  }),

  gen({
    id: 'ratio.proportion.direct',
    concept: 'ratio.proportion',
    kind: 'core',
    levels: [1, 2, 3],
    title: L('Přímá úměrnost', 'Direct proportion'),
    est: (lv) => 40 + 30 * lv,
    make(r, lv) {
      if (lv === 1) {
        const unit = r.pick([18, 24, 32, 45, 60]);
        const k = r.int(2, 5);
        const m = r.pick([6, 7, 8, 9].filter((v) => v !== k));
        const [few, many, whatEn] = r.pick([
          ['kg jablek', 'kg jablek', 'kg of apples'],
          ['sešity', 'sešitů', 'exercise books'],
          ['litry mléka', 'litrů mléka', 'litres of milk'],
        ] as const);
        const what = (count: number): string => plural(count, many, few, many);
        return {
          prompt: L(
            `${k} ${what(k)} stojí ${k * unit} korun. Kolik korun stojí ${m} ${what(m)}?`,
            `${k} ${whatEn} cost ${k * unit} crowns. How many crowns do ${m} ${whatEn} cost?`,
          ),
          answer: { kind: 'number', value: ans(m * unit) },
          hints: [
            L(
              'Nejdřív zjisti cenu za jeden kus (nebo jeden kilogram, jeden litr).',
              'First find the price of one piece (or one kilogram, one litre).',
            ),
            L(`Jeden stojí ${unit} korun.`, `One costs ${unit} crowns.`),
          ],
          solution: [
            step(
              'Cena za jeden:',
              'The price of one:',
              L(`${k * unit} : ${k} = ${unit}`, `${k * unit} \\div ${k} = ${unit}`),
            ),
            step(`Cena za ${m}:`, `The price of ${m}:`, `${m} \\cdot ${unit} = ${m * unit}`),
          ],
          misconceptions: [],
          verify: [{ kind: 'value', expr: `${k * unit}/${k}*${m}` }],
          context: { applied: true },
        };
      }
      if (lv === 2) {
        const [n1, n2] = r.pick([
          [12, 20],
          [8, 20],
          [6, 15],
          [10, 25],
          [12, 30],
          [8, 14],
        ] as const);
        const per = r.pick([15, 25, 30, 50]);
        const [dish, dishEn, stuff, stuffEn] = r.pick([
          ['palačinek', 'pancakes', 'mouky', 'flour'],
          ['muffinů', 'muffins', 'cukru', 'sugar'],
          ['porcí polévky', 'portions of soup', 'čočky', 'lentils'],
        ] as const);
        return {
          prompt: L(
            `Podle receptu je na ${n1} ${dish} potřeba ${n1 * per} g ${stuff}. Kolik gramů ${stuff} je potřeba na ${n2} ${dish}?`,
            `A recipe needs ${n1 * per} g of ${stuffEn} for ${n1} ${dishEn}. How many grams of ${stuffEn} are needed for ${n2} ${dishEn}?`,
          ),
          answer: { kind: 'number', value: ans(n2 * per) },
          hints: [
            L(
              'Kolikrát víc porcí, tolikrát víc surovin. Nejjistější je spočítat množství na jeden kus.',
              'As many times more portions, so many times more ingredients. Safest is the amount for one piece.',
            ),
            L(`Na jeden kus je potřeba ${per} g.`, `One piece needs ${per} g.`),
          ],
          solution: [
            step(
              'Na jeden kus:',
              'For one piece:',
              L(`${n1 * per} : ${n1} = ${per}`, `${n1 * per} \\div ${n1} = ${per}`),
            ),
            step(`Na ${n2} kusů:`, `For ${n2} pieces:`, `${n2} \\cdot ${per} = ${n2 * per}`),
          ],
          misconceptions: [
            mc(
              ans(n1 * per + (n2 - n1)),
              'concept',
              'Množství neroste přičítáním, ale násobením: je to úměrnost.',
              'The amount does not grow by adding but by multiplying: it is a proportion.',
            ),
          ],
          verify: [{ kind: 'value', expr: `${n1 * per}/${n1}*${n2}` }],
          context: { applied: true },
        };
      }
      const perKg = r.pick([160, 180, 240, 320, 400]);
      const grams = r.pick([150, 250, 350, 450, 750]);
      const price = (perKg * grams) / 1000;
      const askGrams = r.bool();
      return askGrams
        ? {
            prompt: L(
              `Kilogram sýra stojí ${perKg} korun. Kolik gramů sýra koupíme za ${price} korun?`,
              `A kilogram of cheese costs ${perKg} crowns. How many grams of cheese do ${price} crowns buy?`,
            ),
            answer: { kind: 'number', value: ans(grams) },
            hints: [
              L('Kolik korun stojí 100 gramů?', 'How many crowns do 100 grams cost?'),
              L(`100 g stojí ${perKg / 10} korun.`, `100 g cost ${perKg / 10} crowns.`),
            ],
            solution: [
              step(
                'Cena za 100 g:',
                'The price of 100 g:',
                L(`${perKg} : 10 = ${perKg / 10}`, `${perKg} \\div 10 = ${perKg / 10}`),
              ),
              step(
                'Počet stogramových dílů a gramy:',
                'The number of 100 g portions, and the grams:',
                both(
                  (n, czech) =>
                    `${n(price)} ${czech ? ':' : '\\div'} ${n(perKg / 10)} = ${n(grams / 100)}, \\quad ${n(grams / 100)} \\cdot 100 = ${grams}`,
                ),
              ),
            ],
            misconceptions: [
              mc(
                ans(grams / 1000),
                'misread',
                'Odpověď má být v gramech, ne v kilogramech.',
                'The answer is asked for in grams, not kilograms.',
              ),
            ],
            verify: [{ kind: 'value', expr: `${price}/${perKg}*1000` }],
            context: { applied: true },
          }
        : {
            prompt: L(
              `Kilogram sýra stojí ${perKg} korun. Kolik korun zaplatíme za ${grams} g sýra?`,
              `A kilogram of cheese costs ${perKg} crowns. How many crowns do ${grams} g of cheese cost?`,
            ),
            answer: { kind: 'number', value: ans(price) },
            hints: [
              L('Kolik korun stojí 100 gramů — nebo 50 gramů?', 'How many crowns do 100 grams cost — or 50 grams?'),
              both(
                (n) => `${n === cs ? '50 g stojí' : '50 g cost'} $${n(perKg / 20)}$ ${n === cs ? 'korun' : 'crowns'}.`,
              ),
            ],
            solution: [
              step(
                'Cena za 50 g:',
                'The price of 50 g:',
                both((n, czech) => `${perKg} ${czech ? ':' : '\\div'} 20 = ${n(perKg / 20)}`),
              ),
              step(
                `${grams} g ${plural(grams / 50, 'je', 'jsou', 'je')} ${grams / 50} ${plural(grams / 50, 'takový díl', 'takové díly', 'takových dílů')}:`,
                `${grams} g is ${grams / 50} such portions:`,
                both((n) => `${grams / 50} \\cdot ${n(perKg / 20)} = ${n(price)}`),
              ),
            ],
            misconceptions: [
              mc(
                ans(perKg * grams),
                'misread',
                'Cena je za kilogram, ne za gram.',
                'The price is per kilogram, not per gram.',
              ),
            ],
            verify: [{ kind: 'value', expr: `${perKg}*${grams}/1000` }],
            context: { applied: true },
          };
    },
  }),

  gen({
    id: 'ratio.proportion.inverse',
    concept: 'ratio.proportion',
    kind: 'core',
    levels: [2, 3, 4],
    title: L('Nepřímá úměrnost', 'Inverse proportion'),
    est: (lv) => 50 + 30 * lv,
    make(r, lv) {
      const [w1, d1, w2] = r.pick([
        [6, 12, 9],
        [5, 18, 6],
        [8, 9, 6],
        [5, 12, 6],
        [10, 6, 12],
        [6, 20, 8],
        [12, 10, 8],
        [9, 8, 12],
      ] as const);
      const d2 = (w1 * d1) / w2;
      const [who, whoEn, job, jobEn] = r.pick([
        ['malířů', 'painters', 'vymaluje školu', 'paint a school'],
        ['brigádníků', 'helpers', 'sklidí sad', 'pick an orchard'],
        ['dlaždičů', 'pavers', 'vydláždí náměstí', 'pave a square'],
      ] as const);
      if (lv === 2) {
        return {
          prompt: L(
            `${w1} ${who} ${job} za ${d1} dní. Za kolik dní by to zvládlo ${w2} stejně výkonných ${who}?`,
            `${w1} ${whoEn} ${jobEn} in ${d1} days. In how many days would ${w2} equally fast ${whoEn} do it?`,
          ),
          answer: { kind: 'number', value: ans(d2) },
          hints: [
            L(
              'Víc lidí, méně dní: práce jako celek se nemění. Kolik „člověkodní“ práce je?',
              'More people, fewer days: the job as a whole does not change. How many "person-days" is it?',
            ),
            L(
              `Práce je $${w1} \\cdot ${d1} = ${w1 * d1}$ člověkodní.`,
              `The job is $${w1} \\cdot ${d1} = ${w1 * d1}$ person-days.`,
            ),
          ],
          solution: [
            step('Celá práce:', 'The whole job:', `${w1} \\cdot ${d1} = ${w1 * d1}`),
            step(
              `Rozdělená mezi ${w2}:`,
              `Shared among ${w2}:`,
              L(`${w1 * d1} : ${w2} = ${d2}`, `${w1 * d1} \\div ${w2} = ${d2}`),
            ),
          ],
          misconceptions: [
            mc(
              fToInput(frac(d1 * w2, w1)),
              'concept',
              'To je přímá úměrnost. Když lidí přibude, dní ubude.',
              'That is a direct proportion. When there are more people, there are fewer days.',
            ),
          ],
          verify: [{ kind: 'value', expr: `${w1}*${d1}/${w2}` }],
          context: { applied: true },
        };
      }
      if (lv === 3) {
        const earlier = Math.abs(d1 - d2);
        return {
          prompt: L(
            `${w1} ${who} ${job} za ${d1} dní. O kolik dní ${d2 < d1 ? 'dříve' : 'později'} by byla práce hotová, kdyby pracovalo ${w2} stejně výkonných ${who}?`,
            `${w1} ${whoEn} ${jobEn} in ${d1} days. How many days ${d2 < d1 ? 'sooner' : 'later'} would the job be done if ${w2} equally fast ${whoEn} worked?`,
          ),
          answer: { kind: 'number', value: ans(earlier) },
          hints: [
            L(
              'Nejdřív zjisti, za kolik dní by to zvládla druhá skupina.',
              'First find in how many days the second group would do it.',
            ),
            L(
              `Druhá skupina: $${w1 * d1} : ${w2} = ${d2}$ dní.`,
              `The second group: $${w1 * d1} \\div ${w2} = ${d2}$ days.`,
            ),
          ],
          solution: [
            step(
              'Celá práce a doba druhé skupiny:',
              'The whole job and the second group’s time:',
              L(
                `${w1} \\cdot ${d1} = ${w1 * d1}, \\quad ${w1 * d1} : ${w2} = ${d2}`,
                `${w1} \\cdot ${d1} = ${w1 * d1}, \\quad ${w1 * d1} \\div ${w2} = ${d2}`,
              ),
            ),
            step('Rozdíl:', 'The difference:', `${Math.max(d1, d2)} - ${Math.min(d1, d2)} = ${earlier}`),
          ],
          misconceptions: [
            mc(
              ans(d2),
              'incomplete',
              'To je doba druhé skupiny. Otázka se ptá na rozdíl.',
              'That is the second group’s time. The question asks for the difference.',
            ),
          ],
          verify: [{ kind: 'value', expr: `abs(${d1}-${w1}*${d1}/${w2})` }],
          context: { applied: true },
        };
      }
      // Some leave after a few days.
      const [w, d, after, leave] = r.pick([
        [6, 10, 4, 2],
        [8, 12, 6, 2],
        [10, 9, 3, 4],
        [9, 10, 4, 3],
        [12, 8, 2, 3],
        [6, 12, 2, 1],
      ] as const);
      const restWork = w * (d - after);
      const restDays = restWork / (w - leave);
      return {
        prompt: L(
          `${w} ${who} mělo práci naplánovanou na ${d} dní. Po ${after} dnech ${leave} z nich ${leave === 1 ? 'odešel' : leave < 5 ? 'odešli' : 'odešlo'}. Za kolik dalších dní dokončí zbytek práce ti, kteří zůstali?`,
          `${w} ${whoEn} had a job planned for ${d} days. After ${after} days ${leave} of them left. In how many more days will those who stayed finish the rest?`,
        ),
        answer: { kind: 'number', value: ans(restDays) },
        hints: [
          L(
            'Kolik práce zbývalo ve chvíli, kdy část lidí odešla? Počítej v člověkodnech.',
            'How much work was left when some people went away? Count in person-days.',
          ),
          L(
            `Zbývalo $${w} \\cdot (${d} - ${after}) = ${restWork}$ člověkodní pro ${w - leave} ${plural(w - leave, 'člověka', 'lidi', 'lidí')}.`,
            `$${w} \\cdot (${d} - ${after}) = ${restWork}$ person-days were left for ${w - leave} people.`,
          ),
        ],
        solution: [
          step('Zbývající práce:', 'The work left:', `${w} \\cdot (${d} - ${after}) = ${restWork}`),
          step(
            `Pro ${w - leave} ${plural(w - leave, 'člověka', 'lidi', 'lidí')}:`,
            `For ${w - leave} people:`,
            L(`${restWork} : ${w - leave} = ${restDays}`, `${restWork} \\div ${w - leave} = ${restDays}`),
          ),
        ],
        misconceptions: [
          mc(
            ans(d - after),
            'concept',
            'Tolik dní by zbývalo, kdyby nikdo neodešel. Méně lidí potřebuje víc času.',
            'That many days would be left if nobody had gone. Fewer people need more time.',
          ),
        ],
        verify: [{ kind: 'value', expr: `${w}*(${d}-${after})/(${w}-${leave})` }],
        context: { applied: true },
      };
    },
  }),

  gen({
    id: 'ratio.scale.map',
    concept: 'ratio.scale',
    kind: 'core',
    levels: [1, 2, 3],
    title: L('Měřítko mapy', 'The scale of a map'),
    est: (lv) => 45 + 30 * lv,
    make(r, lv) {
      const scale = r.pick([25000, 50000, 100000, 200000]);
      const cm = r.pick([3, 4, 6, 7, 8, 12]);
      const km = (cm * scale) / 100000;
      if (lv === 1) {
        return {
          prompt: L(
            `Na mapě s měřítkem $1 : ${cs(scale)}$ měří trasa ${cm} cm. Kolik kilometrů měří ve skutečnosti?`,
            `On a map with a scale of $1 : ${en(scale)}$ a route is ${cm} cm long. How many kilometres is it in reality?`,
          ),
          answer: { kind: 'number', value: ans(km) },
          hints: [
            L(
              `Jeden centimetr na mapě je ${csT(scale)} cm ve skutečnosti. Kolik je to metrů?`,
              `One centimetre on the map is ${enT(scale)} cm in reality. How many metres is that?`,
            ),
            L(
              `1 cm na mapě je ${csT(scale / 100)} m, tedy ${csT(scale / 100000)} km.`,
              `1 cm on the map is ${enT(scale / 100)} m, that is ${enT(scale / 100000)} km.`,
            ),
          ],
          solution: [
            step(
              'Jeden centimetr na mapě:',
              'One centimetre on the map:',
              both((n) => `${n(scale)}\\ \\text{cm} = ${n(scale / 100000)}\\ \\text{km}`),
            ),
            step(
              `${cm} cm:`,
              `${cm} cm:`,
              both((n) => `${cm} \\cdot ${n(scale / 100000)} = ${n(km)}`),
            ),
          ],
          misconceptions: [
            mc(
              ans((cm * scale) / 1000),
              'arithmetic',
              'Kilometr má 100 000 centimetrů, ne 1 000.',
              'A kilometre has 100 000 centimetres, not 1 000.',
            ),
          ],
          verify: [{ kind: 'value', expr: `${cm}*${scale}/100000` }],
          context: { applied: true },
        };
      }
      if (lv === 2) {
        return {
          prompt: both((n, czech) =>
            czech
              ? `Dvě vesnice jsou od sebe vzdáleny $${n(km)}$ km. Kolik centimetrů je mezi nimi na mapě s měřítkem $1 : ${n(scale)}$?`
              : `Two villages are $${n(km)}$ km apart. How many centimetres apart are they on a map with a scale of $1 : ${n(scale)}$?`,
          ),
          answer: { kind: 'number', value: ans(cm) },
          hints: [
            L(
              'Převeď skutečnou vzdálenost na centimetry a vyděl ji měřítkem.',
              'Convert the real distance to centimetres and divide by the scale.',
            ),
            both((n) => `$${n(km)}$ km $= ${n(km * 100000)}$ cm`),
          ],
          solution: [
            step(
              'Skutečná vzdálenost v cm:',
              'The real distance in cm:',
              both((n) => `${n(km)} \\cdot 100\\,000 = ${n(km * 100000)}`),
            ),
            step(
              'Na mapě:',
              'On the map:',
              both((n, czech) => `${n(km * 100000)} ${czech ? ':' : '\\div'} ${n(scale)} = ${cm}`),
            ),
          ],
          misconceptions: [],
          verify: [{ kind: 'value', expr: `${km}*100000/${scale}` }],
          context: { applied: true },
        };
      }
      return {
        prompt: both((n, czech) =>
          czech
            ? `Úsek dlouhý ve skutečnosti $${n(km)}$ km měří na mapě ${cm} cm. Měřítko mapy je $1 : x$. Určete číslo $x$.`
            : `A stretch that is $${n(km)}$ km long in reality measures ${cm} cm on a map. The scale of the map is $1 : x$. Find $x$.`,
        ),
        answer: { kind: 'number', value: ans(scale), label: 'x =' },
        hints: [
          L(
            'Měřítko říká, kolik centimetrů ve skutečnosti odpovídá jednomu centimetru na mapě.',
            'The scale says how many centimetres in reality correspond to one centimetre on the map.',
          ),
          both((n) => `$${n(km)}$ km $= ${n(km * 100000)}$ cm`),
        ],
        solution: [
          step(
            'Skutečná délka v cm:',
            'The real length in cm:',
            both((n) => `${n(km)} \\cdot 100\\,000 = ${n(km * 100000)}`),
          ),
          step(
            'Na jeden centimetr mapy:',
            'Per centimetre of the map:',
            both((n, czech) => `${n(km * 100000)} ${czech ? ':' : '\\div'} ${cm} = ${n(scale)}`),
          ),
        ],
        misconceptions: [
          mc(
            ans(scale / 100),
            'arithmetic',
            'Obě délky musí být ve stejných jednotkách — v centimetrech.',
            'Both lengths must be in the same unit — centimetres.',
          ),
        ],
        verify: [{ kind: 'value', expr: `${km}*100000/${cm}` }],
        context: { applied: true },
      };
    },
  }),
];
