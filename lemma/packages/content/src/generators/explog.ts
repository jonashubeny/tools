import {
  L,
  fToInput,
  fToTex,
  frac,
  intervalIn,
  intervalL,
  polyIn,
  polyTex,
  type Frac,
  type Generator,
} from '@lemma/core';
import { gen, leadIn, leadTex, mapL, mc, nz, plural, shiftIn, shiftTex, step, tailIn, tailTex } from './helpers';

/** A base for display inside a power: 3 or (1/2). */
export const baseTex = (b: Frac): string => (b.d === 1 ? `${b.n}` : `\\left(${fToTex(b)}\\right)`);
export const baseIn = (b: Frac): string => (b.d === 1 ? `${b.n}` : `(${b.n}/${b.d})`);
export const baseValue = (b: Frac): number => b.n / b.d;

/** A decimal for display: comma in Czech, point in English. */
export const dec = (value: number): L => L(String(value).replace('.', '{,}'), String(value));

/** b^k as an exact fraction, for integer k of either sign. */
export function power(b: Frac, k: number): Frac {
  return k >= 0 ? frac(b.n ** k, b.d ** k) : frac(b.d ** -k, b.n ** -k);
}

/** log_b(arg): "\log_{2} 8", with the Czech convention that plain "log" is base 10. */
export const logTex = (base: number | string, arg: string): string =>
  base === 10 ? `\\log ${arg}` : base === 'e' ? `\\ln ${arg}` : `\\log_{${base}} ${arg}`;
/** The same for the parser. */
export const logIn = (base: number | string, arg: string): string =>
  base === 'e' ? `ln(${arg})` : `ln(${arg})/ln(${base})`;

/** Syllabus topics 7 and 8: exponential and logarithmic functions. */
export const EXPLOG_GENERATORS: Generator[] = [
  gen({
    id: 'exp.function.values',
    concept: 'exp.function',
    kind: 'warmup',
    levels: [1, 2],
    title: L('Hodnoty a průběh exponenciály', 'Values and behaviour of an exponential'),
    tags: ['annual-review'],
    est: (lv) => 30 + 15 * lv,
    make(r, lv) {
      if (lv === 1) {
        const base = r.pick([frac(2), frac(3), frac(5), frac(1, 2), frac(2, 3), frac(1, 3), frac(10)]);
        const k = r.pick(base.d === 1 && base.n >= 5 ? [-2, -1, 0, 2] : [-3, -2, -1, 0, 2, 3]);
        const value = power(base, k);
        return {
          prompt: L(`Vypočítejte $${baseTex(base)}^{${k}}$.`, `Compute $${baseTex(base)}^{${k}}$.`),
          answer: { kind: 'number', value: fToInput(value) },
          hints: [
            k < 0
              ? L(
                  'Záporný exponent znamená převrácenou hodnotu: $a^{-n} = \\dfrac{1}{a^n}$.',
                  'A negative exponent means the reciprocal: $a^{-n} = \\dfrac{1}{a^n}$.',
                )
              : k === 0
                ? L('Cokoli nenulového na nultou je…?', 'Anything non-zero to the power zero is…?')
                : L(
                    'Exponent říká, kolikrát se základ násobí sám sebou.',
                    'The exponent says how many times the base is multiplied by itself.',
                  ),
            base.d !== 1 && k < 0
              ? L(
                  'U zlomku záporný exponent prohodí čitatel a jmenovatel.',
                  'For a fraction, a negative exponent swaps numerator and denominator.',
                )
              : L(
                  'Záporný exponent nedělá výsledek záporným.',
                  'A negative exponent does not make the result negative.',
                ),
          ],
          solution: [
            step(
              k === 0
                ? 'Nultá mocnina nenulového čísla je jedna.'
                : k < 0
                  ? 'Záporný exponent: převrácená hodnota, pak mocnina.'
                  : 'Umocníme čitatel i jmenovatel.',
              k === 0
                ? 'The zeroth power of a non-zero number is one.'
                : k < 0
                  ? 'Negative exponent: take the reciprocal, then the power.'
                  : 'Raise numerator and denominator to the power.',
              `${baseTex(base)}^{${k}} = ${fToTex(value)}`,
            ),
          ],
          misconceptions: [
            ...(k < 0
              ? [
                  mc(
                    fToInput(frac(-power(base, -k).n, power(base, -k).d)),
                    'concept',
                    'Záporný exponent neznamená záporný výsledek, ale převrácenou hodnotu.',
                    'A negative exponent does not mean a negative result but the reciprocal.',
                  ),
                  mc(
                    fToInput(power(base, -k)),
                    'sign',
                    'To je hodnota pro kladný exponent. Minus v exponentu ji převrátí.',
                    'That is the value for the positive exponent. The minus in the exponent inverts it.',
                  ),
                ]
              : []),
            ...(k === 0
              ? [
                  mc(
                    '0',
                    'concept',
                    '$a^0 = 1$ pro každé nenulové $a$, ne nula.',
                    '$a^0 = 1$ for every non-zero $a$, not zero.',
                  ),
                ]
              : []),
            ...(k > 0
              ? [
                  mc(
                    fToInput(frac(base.n * k, base.d)),
                    'concept',
                    'Mocnina není násobení exponentem.',
                    'A power is not multiplication by the exponent.',
                  ),
                ]
              : []),
          ],
          verify: [{ kind: 'value', expr: `${baseIn(base)}^(${k})` }],
        };
      }
      const base = r.pick([frac(3), frac(1, 2), frac(4, 5), frac(5, 4), frac(2, 3), frac(3, 2), frac(1, 10), frac(7)]);
      const growing = baseValue(base) > 1;
      if (r.bool()) {
        return {
          prompt: L(`Funkce $f(x) = ${baseTex(base)}^{x}$ je:`, `The function $f(x) = ${baseTex(base)}^{x}$ is:`),
          answer: {
            kind: 'choice',
            fixedOrder: true,
            options: [
              { id: 'up', text: L('rostoucí', 'increasing') },
              { id: 'down', text: L('klesající', 'decreasing') },
              { id: 'neither', text: L('ani rostoucí, ani klesající', 'neither increasing nor decreasing') },
            ],
            correct: [growing ? 'up' : 'down'],
          },
          hints: [
            L(
              'Co se stane s hodnotou, když $x$ vzroste o 1? Čím se násobí?',
              'What happens to the value when $x$ grows by 1? What is it multiplied by?',
            ),
            L(
              `Násobí se základem $${fToTex(base)}$. Je větší, nebo menší než 1?`,
              `It is multiplied by the base $${fToTex(base)}$. Is that greater or less than 1?`,
            ),
          ],
          solution: [
            step(
              growing
                ? `Základ $${fToTex(base)} > 1$: každý krok doprava hodnotu zvětší. Funkce je rostoucí.`
                : `Základ $${fToTex(base)}$ je mezi 0 a 1: každý krok doprava hodnotu zmenší. Funkce je klesající.`,
              growing
                ? `The base $${fToTex(base)} > 1$: each step right makes the value larger. The function is increasing.`
                : `The base $${fToTex(base)}$ is between 0 and 1: each step right makes the value smaller. The function is decreasing.`,
            ),
          ],
          misconceptions: [
            mc(
              growing ? 'down' : 'up',
              'concept',
              'Rozhoduje, jestli je základ větší než 1, ne jestli je kladný.',
              'What decides is whether the base exceeds 1, not whether it is positive.',
            ),
          ],
        };
      }
      const q = nz(r, -5, 5);
      const reach = Math.round(8 / Math.log10(Math.max(baseValue(base), 1 / baseValue(base))));
      return {
        prompt: L(
          `Určete obor hodnot funkce $f(x) = ${baseTex(base)}^{x}${tailTex(q)}$.`,
          `Find the range of $f(x) = ${baseTex(base)}^{x}${tailTex(q)}$.`,
        ),
        answer: { kind: 'interval', value: intervalIn(q, 'inf', false, false), label: 'H(f) =' },
        hints: [
          L(
            `Jakých hodnot nabývá samotné $${baseTex(base)}^{x}$? Může být nula nebo záporné?`,
            `Which values does $${baseTex(base)}^{x}$ itself take? Can it be zero or negative?`,
          ),
          L(
            `Mocnina kladného základu je vždy kladná. Přičtení $${q}$ posune celý graf.`,
            `A power of a positive base is always positive. Adding $${q}$ shifts the whole graph.`,
          ),
        ],
        solution: [
          step(
            `$${baseTex(base)}^{x} > 0$ pro každé $x$ a nabývá všech kladných hodnot.`,
            `$${baseTex(base)}^{x} > 0$ for every $x$, and it takes every positive value.`,
          ),
          step(
            `Posun o $${q}$:`,
            `Shift by $${q}$:`,
            mapL(intervalL(q, 'inf', false, false), (iv) => `H(f) = ${iv}`),
          ),
        ],
        misconceptions: [
          mc(
            intervalIn(q, 'inf', true, false),
            'notation',
            `Hodnoty $${q}$ funkce nikdy nedosáhne — mocnina není nula.`,
            `The function never reaches $${q}$ — the power is never zero.`,
          ),
          mc(
            'R',
            'concept',
            'Exponenciála je zdola omezená: mocnina kladného základu není záporná.',
            'An exponential is bounded below: a power of a positive base is never negative.',
          ),
          mc(
            intervalIn(0, 'inf', false, false),
            'incomplete',
            `Chybí posun o $${q}$.`,
            `The shift by $${q}$ is missing.`,
          ),
          mc(
            intervalIn('-inf', q, false, false),
            'graph',
            'Hodnoty leží nad asymptotou, ne pod ní.',
            'The values lie above the asymptote, not below it.',
          ),
        ],
        // Far enough out for the tail to come within the oracle's tolerance of the asymptote,
        // not so far that it vanishes in floating point: about 10⁻⁸ at the edge.
        verify: [{ kind: 'range', expr: `${baseIn(base)}^x${tailIn(q)}`, over: [-reach, reach] }],
      };
    },
  }),

  gen({
    id: 'exp.function.inequality',
    concept: 'exp.function',
    kind: 'core',
    levels: [2, 3],
    title: L('Exponenciální nerovnice se stejným základem', 'Exponential inequalities with a common base'),
    tags: ['annual-review'],
    est: (lv) => 60 + 30 * (lv - 2),
    make(r, lv) {
      const base = r.pick([frac(2), frac(3), frac(1, 2), frac(1, 3), frac(5), frac(1, 5)]);
      const growing = baseValue(base) > 1;
      const k = r.pick(Math.max(base.n, base.d) >= 5 ? [-2, -1, 1, 2] : [-3, -2, -1, 2, 3, 4]);
      const rhs = power(base, k);
      const rel = r.pick(['<', '<=', '>', '>='] as const);
      const relTex = { '<': '<', '<=': '\\le', '>': '>', '>=': '\\ge' }[rel];
      const p = lv === 2 ? 1 : r.pick([2, 3, -1, -2]);
      // Choose the constant so that the boundary is a whole number.
      const x0 = r.int(-4, 4);
      const c = k - p * x0;
      const exponentTex = `${leadTex(p)}x${tailTex(c)}`;
      const exponentIn = `${leadIn(p)}x${tailIn(c)}`;
      // base^E REL base^k  ⇔  E REL k (flipped for a base below 1)  ⇔  x REL x0 (flipped again for p < 0).
      const flips = (growing ? 0 : 1) + (p > 0 ? 0 : 1);
      const greater = (rel === '>' || rel === '>=') !== (flips % 2 === 1);
      const closed = rel === '<=' || rel === '>=';
      const value = greater ? intervalIn(x0, 'inf', closed, false) : intervalIn('-inf', x0, false, closed);
      const valueL = greater ? intervalL(x0, 'inf', closed, false) : intervalL('-inf', x0, false, closed);
      const wrongSide = greater ? intervalIn('-inf', x0, false, closed) : intervalIn(x0, 'inf', closed, false);
      const afterBase = growing ? relTex : { '<': '>', '<=': '\\ge', '>': '<', '>=': '\\le' }[rel];
      return {
        prompt: L(
          `Řešte v $\\mathbb{R}$: $${baseTex(base)}^{${exponentTex}} ${relTex} ${fToTex(rhs)}$`,
          `Solve in $\\mathbb{R}$: $${baseTex(base)}^{${exponentTex}} ${relTex} ${fToTex(rhs)}$`,
        ),
        answer: { kind: 'interval', value, label: 'x \\in' },
        hints: [
          L(
            `Zapiš pravou stranu jako mocninu téhož základu: $${fToTex(rhs)} = ${baseTex(base)}^{?}$.`,
            `Write the right-hand side as a power of the same base: $${fToTex(rhs)} = ${baseTex(base)}^{?}$.`,
          ),
          growing
            ? L(
                'Základ je větší než 1, funkce roste: nerovnost mezi mocninami platí stejně i mezi exponenty.',
                'The base exceeds 1, so the function increases: the inequality between the powers holds between the exponents too.',
              )
            : L(
                'Základ je menší než 1, funkce klesá: při přechodu k exponentům se znak nerovnosti otáčí.',
                'The base is below 1, so the function decreases: passing to the exponents reverses the inequality sign.',
              ),
        ],
        solution: [
          step(
            'Stejný základ na obou stranách:',
            'The same base on both sides:',
            `${baseTex(base)}^{${exponentTex}} ${relTex} ${baseTex(base)}^{${k}}`,
          ),
          step(
            growing ? 'Funkce je rostoucí, znak nerovnosti zůstává:' : 'Funkce je klesající, znak nerovnosti se otáčí:',
            growing ? 'The function is increasing; the sign stays:' : 'The function is decreasing; the sign reverses:',
            `${exponentTex} ${afterBase} ${k}`,
          ),
          step(
            p < 0
              ? 'Vyřešíme lineární nerovnici — dělíme záporným číslem, znak se otáčí znovu:'
              : 'Vyřešíme lineární nerovnici:',
            p < 0
              ? 'Solve the linear inequality — dividing by a negative number reverses the sign again:'
              : 'Solve the linear inequality:',
            mapL(valueL, (iv) => `x \\in ${iv}`),
          ),
        ],
        misconceptions: [
          mc(
            wrongSide,
            growing && p > 0 ? 'sign' : 'concept',
            growing
              ? 'Zkontroluj směr nerovnosti po dělení.'
              : 'U základu menšího než 1 funkce klesá, takže se znak nerovnosti při přechodu k exponentům otáčí.',
            growing
              ? 'Check the direction of the inequality after dividing.'
              : 'With a base below 1 the function decreases, so the inequality sign reverses when passing to the exponents.',
          ),
          mc(
            greater ? intervalIn(x0, 'inf', !closed, false) : intervalIn('-inf', x0, false, !closed),
            'notation',
            closed
              ? 'Nerovnost je neostrá, krajní bod do řešení patří.'
              : 'Nerovnost je ostrá, krajní bod do řešení nepatří.',
            closed
              ? 'The inequality is non-strict; the endpoint belongs to the solution.'
              : 'The inequality is strict; the endpoint is not part of the solution.',
          ),
        ],
        verify: [{ kind: 'inequality', expr: `${baseIn(base)}^(${exponentIn})-(${fToInput(rhs)})`, rel }],
      };
    },
  }),

  gen({
    id: 'exp.model.growth',
    concept: 'exp.model',
    kind: 'applied',
    levels: [2, 3, 4],
    title: L('Zdvojování, poločas a procenta', 'Doubling, half-life and percentages'),
    est: (lv) => 70 + 30 * (lv - 2),
    make(r, lv) {
      if (lv === 2) {
        const k = r.int(2, 5);
        if (r.bool()) {
          const start = r.pick([50, 100, 200, 300, 500]);
          const period = r.pick([2, 3, 4, 20, 30]);
          const unit = period >= 20 ? L('minut', 'minutes') : L('hodiny', 'hours');
          const total = k * period;
          return {
            prompt: L(
              `Počet bakterií v kultuře se ${plural(period, 'každou', 'každé', 'každých')} ${period} ${unit.cs} zdvojnásobí. Na začátku jich je ${start}. Kolik jich bude za ${total} ${period >= 20 ? 'minut' : plural(total, 'hodinu', 'hodiny', 'hodin')}?`,
              `The number of bacteria in a culture doubles every ${period} ${unit.en}. There are ${start} at the start. How many will there be after ${total} ${period >= 20 ? 'minutes' : 'hours'}?`,
            ),
            answer: { kind: 'number', value: `${start * 2 ** k}` },
            hints: [
              L(
                `Kolikrát se počet za tu dobu zdvojnásobí? $${total} : ${period} = {?}$`,
                `How many times does the number double in that time? $${total} : ${period} = {?}$`,
              ),
              L(
                `Zdvojnásobí se ${k}×, tedy se násobí $2^{${k}}$ — ne číslem $2 \\cdot ${k}$.`,
                `It doubles ${k} times, so it is multiplied by $2^{${k}}$ — not by $2 \\cdot ${k}$.`,
              ),
            ],
            solution: [
              step('Počet zdvojení:', 'Number of doublings:', `${total} : ${period} = ${k}`),
              step(
                'Každé zdvojení násobí dvěma:',
                'Each doubling multiplies by two:',
                `N = ${start} \\cdot 2^{${k}} = ${start} \\cdot ${2 ** k} = ${start * 2 ** k}`,
              ),
            ],
            misconceptions: [
              mc(
                `${start * 2 * k}`,
                'concept',
                `Zdvojení ${k}× po sobě je násobení $2^{${k}}$, ne $2 \\cdot ${k}$. To je rozdíl mezi exponenciálním a lineárním růstem.`,
                `Doubling ${k} times in a row multiplies by $2^{${k}}$, not $2 \\cdot ${k}$. That is the difference between exponential and linear growth.`,
              ),
              mc(
                `${start * 2 ** (k - 1)}`,
                'arithmetic',
                'O jedno zdvojení méně: přepočítej, kolik period uplynulo.',
                'One doubling too few: recount how many periods have passed.',
              ),
            ],
            verify: [{ kind: 'value', expr: `${start}*2^(${total}/${period})` }],
            context: { applied: true },
          };
        }
        const half = r.pick([4, 5, 6, 8, 12]);
        const start = 2 ** k * r.pick([5, 10, 25]);
        return {
          prompt: L(
            `Látka má poločas rozpadu ${half} ${plural(half, 'den', 'dny', 'dní')}. Na začátku je jí ${start} mg. Kolik miligramů zbude za ${half * k} dní?`,
            `A substance has a half-life of ${half} days. There are ${start} mg at the start. How many milligrams remain after ${half * k} days?`,
          ),
          answer: { kind: 'number', value: `${start / 2 ** k}` },
          hints: [
            L(
              `Kolik poločasů uplyne? $${half * k} : ${half} = {?}$`,
              `How many half-lives pass? $${half * k} : ${half} = {?}$`,
            ),
            L(
              `Po každém poločasu zbude polovina toho, co bylo: dělíš dvěma ${k}× po sobě.`,
              `After each half-life half of what was there remains: divide by two ${k} times in a row.`,
            ),
          ],
          solution: [
            step('Počet poločasů:', 'Number of half-lives:', `${half * k} : ${half} = ${k}`),
            step(
              'Každý poločas násobí jednou polovinou:',
              'Each half-life multiplies by one half:',
              `m = ${start} \\cdot \\left(\\tfrac{1}{2}\\right)^{${k}} = \\frac{${start}}{${2 ** k}} = ${start / 2 ** k}`,
            ),
          ],
          misconceptions: [
            mc(
              fToInput(frac(start, 2 * k)),
              'concept',
              `Půlení ${k}× po sobě je dělení $2^{${k}}$, ne $2 \\cdot ${k}$.`,
              `Halving ${k} times in a row divides by $2^{${k}}$, not $2 \\cdot ${k}$.`,
            ),
            mc(
              '0',
              'concept',
              'Polovina z toho, co zbývá, nikdy není nula: látka ubývá čím dál pomaleji.',
              'Half of what remains is never zero: the substance decays ever more slowly.',
            ),
          ],
          verify: [{ kind: 'value', expr: `${start}*(1/2)^(${half * k}/${half})` }],
          context: { applied: true },
        };
      }
      const percent = r.pick([5, 10, 15, 20, 25]);
      const factor = 1 + percent / 100;
      if (lv === 3) {
        const years = r.int(2, 4);
        const it = r.bool();
        const start = it ? r.pick([200, 400, 500, 800]) : r.pick([1000, 2000, 5000, 8000]);
        const exact = start * factor ** years;
        // Whole-number arithmetic: the "linear growth" mistake must print as a clean number.
        const linear = start + (start * percent * years) / 100;
        const f = dec(factor);
        return {
          prompt: it
            ? L(
                `Databáze má ${start} GB a každý rok naroste o ${percent} % své aktuální velikosti. Jak velká bude za ${years} roky? Zaokrouhlete na celé GB.`,
                `A database is ${start} GB and grows by ${percent}% of its current size each year. How large will it be after ${years} years? Round to whole GB.`,
              )
            : L(
                `Na účtu je ${start} Kč s ročním úrokem ${percent} %, úroky se připisují k jistině. Kolik korun na něm bude za ${years} roky? Zaokrouhlete na celé koruny.`,
                `An account holds ${start} CZK at ${percent}% annual interest, compounded. How many crowns will it hold after ${years} years? Round to whole crowns.`,
              ),
          answer: { kind: 'number', value: `${start}*${factor}^${years}`, tol: 0.5 },
          hints: [
            L(
              `Růst o ${percent} % znamená násobení číslem $${f.cs}$. Kolikrát za sebou?`,
              `Growth by ${percent}% means multiplying by $${f.en}$. How many times in a row?`,
            ),
            L(
              'Procenta se počítají pokaždé z nové, větší hodnoty — proto mocnina, ne násobení počtem let.',
              'The percentage is taken each time from the new, larger value — hence a power, not multiplication by the number of years.',
            ),
          ],
          solution: [
            step(
              'Roční koeficient růstu:',
              'Yearly growth factor:',
              mapL(f, (value) => `1 + \\frac{${percent}}{100} = ${value}`),
            ),
            step(
              `Po ${years} letech:`,
              `After ${years} years:`,
              mapL(f, (value) => `${start} \\cdot ${value}^{${years}} \\approx ${Math.round(exact)}`),
            ),
          ],
          misconceptions: [
            mc(
              `${linear}`,
              'concept',
              `To je lineární růst: ${percent} % z původní hodnoty každý rok. Tady se procenta počítají z aktuální hodnoty.`,
              `That is linear growth: ${percent}% of the original value each year. Here the percentage is taken from the current value.`,
            ),
          ],
          verify: [{ kind: 'value', expr: `${start}*(1+${percent}/100)^${years}` }],
          context: { applied: true, it },
        };
      }
      // Level 4: how long until it doubles (or triples)?
      const target = r.pick([2, 3]);
      const exact = Math.log(target) / Math.log(factor);
      const f = dec(factor);
      // toFixed keeps the trailing zero of a rounded value such as 6.0.
      const rounded = L(exact.toFixed(1).replace('.', '{,}'), exact.toFixed(1));
      return {
        prompt: L(
          `Objem dat roste každý rok o ${percent} % své aktuální velikosti. Za kolik let se ${target === 2 ? 'zdvojnásobí' : 'ztrojnásobí'}? Zaokrouhlete na jedno desetinné místo.`,
          `A volume of data grows by ${percent}% of its current size each year. After how many years will it have ${target === 2 ? 'doubled' : 'tripled'}? Round to one decimal place.`,
        ),
        answer: { kind: 'number', value: `ln(${target})/ln(${factor})`, tol: 0.05 },
        hints: [
          L(
            `Sestav rovnici: $${f.cs}^{t} = ${target}$. Počáteční velikost se vykrátí.`,
            `Set up the equation: $${f.en}^{t} = ${target}$. The starting size cancels.`,
          ),
          L(
            'Neznámá je v exponentu a základy sjednotit nejdou — rovnici zlogaritmuj.',
            'The unknown is in the exponent and the bases cannot be unified — take logarithms.',
          ),
        ],
        solution: [
          step(
            'Rovnice pro čas $t$:',
            'Equation for the time $t$:',
            mapL(f, (value) => `${value}^{t} = ${target}`),
          ),
          step(
            'Zlogaritmujeme obě strany:',
            'Take logarithms of both sides:',
            mapL(f, (value) => `t \\cdot \\log ${value} = \\log ${target}`),
          ),
          step(
            'Vyjádříme $t$:',
            'Solve for $t$:',
            L(
              `t = \\frac{\\log ${target}}{\\log ${f.cs}} \\approx ${rounded.cs}`,
              `t = \\frac{\\log ${target}}{\\log ${f.en}} \\approx ${rounded.en}`,
            ),
          ),
        ],
        misconceptions: [
          mc(
            `${(target - 1) * 100}/${percent}`,
            'concept',
            `To by platilo při lineárním růstu o ${percent} % původní hodnoty ročně. Exponenciální růst je rychlejší.`,
            `That would hold for linear growth of ${percent}% of the original value a year. Exponential growth is faster.`,
          ),
        ],
        verify: [{ kind: 'value', expr: `ln(${target})/ln(1+${percent}/100)` }],
        context: { applied: true, it: true },
      };
    },
  }),

  gen({
    id: 'exp.model.identify',
    concept: 'exp.model',
    kind: 'core',
    levels: [2, 3],
    title: L('Který model popisuje situaci', 'Which model describes the situation'),
    est: 60,
    make(r, lv) {
      const percent = r.pick([10, 20, 25, 30]);
      const start = r.pick([200, 500, 1000, 4000]);
      const decay = r.bool();
      const linear = lv === 3 && r.bool(0.4);
      const factor = decay ? 1 - percent / 100 : 1 + percent / 100;
      const amount = (start * percent) / 100;
      const option = (id: string, tex: L) => ({ id, text: L(`$y = ${tex.cs}$`, `$y = ${tex.en}$`) });
      const options = r.shuffle([
        option(
          'exp',
          mapL(dec(factor), (f) => `${start} \\cdot ${f}^{t}`),
        ),
        option(
          'expWrong',
          mapL(dec(percent / 100), (f) => `${start} \\cdot ${f}^{t}`),
        ),
        option('lin', L(`${start} ${decay ? '-' : '+'} ${amount}t`, `${start} ${decay ? '-' : '+'} ${amount}t`)),
        option(
          'expOther',
          mapL(dec(decay ? 1 + percent / 100 : 1 - percent / 100), (f) => `${start} \\cdot ${f}^{t}`),
        ),
      ]);
      const promptCs = linear
        ? `Hodnota stroje je ${start} tis. Kč a každý rok ${decay ? 'klesne' : 'vzroste'} o ${amount} tis. Kč. Která funkce udává hodnotu $y$ po $t$ letech?`
        : `Hodnota stroje je ${start} tis. Kč a každý rok ${decay ? 'klesne' : 'vzroste'} o ${percent} % své aktuální hodnoty. Která funkce udává hodnotu $y$ po $t$ letech?`;
      const promptEn = linear
        ? `A machine is worth ${start} thousand CZK and each year its value ${decay ? 'falls' : 'rises'} by ${amount} thousand CZK. Which function gives the value $y$ after $t$ years?`
        : `A machine is worth ${start} thousand CZK and each year its value ${decay ? 'falls' : 'rises'} by ${percent}% of its current value. Which function gives the value $y$ after $t$ years?`;
      return {
        prompt: L(promptCs, promptEn),
        answer: { kind: 'choice', options, correct: [linear ? 'lin' : 'exp'], fixedOrder: true },
        hints: [
          L(
            'Mění se hodnota každý rok o stejnou částku, nebo o stejný násobek? To rozhoduje mezi přímkou a exponenciálou.',
            'Does the value change by the same amount each year, or by the same factor? That decides between a line and an exponential.',
          ),
          linear
            ? L(
                'Stejná částka každý rok: hodnota se mění rovnoměrně.',
                'The same amount every year: the value changes at a steady rate.',
              )
            : L(
                `${decay ? 'Pokles' : 'Růst'} o ${percent} % znamená, že zbude ${decay ? 100 - percent : 100 + percent} % — čím se tedy násobí?`,
                `A ${decay ? 'fall' : 'rise'} of ${percent}% leaves ${decay ? 100 - percent : 100 + percent}% — so what is it multiplied by?`,
              ),
        ],
        solution: [
          step(
            linear
              ? `Každý rok stejná částka ${amount} tis. Kč: změna je rovnoměrná, model je lineární.`
              : `Každý rok se hodnota násobí číslem $${dec(factor).cs}$ (zbude ${Math.round(factor * 100)} %): model je exponenciální.`,
            linear
              ? `The same amount of ${amount} thousand CZK each year: the change is steady, the model is linear.`
              : `Each year the value is multiplied by $${dec(factor).en}$ (${Math.round(factor * 100)}% remains): the model is exponential.`,
            linear
              ? `y = ${start} ${decay ? '-' : '+'} ${amount}t`
              : mapL(dec(factor), (f) => `y = ${start} \\cdot ${f}^{t}`),
          ),
        ],
        misconceptions: [
          mc(
            linear ? 'exp' : 'lin',
            'concept',
            linear
              ? 'Tady se mění o stejnou částku, ne o stejný násobek: to je přímka.'
              : 'Procenta se počítají z aktuální hodnoty, ne z původní: změna není každý rok stejná.',
            linear
              ? 'Here the change is by the same amount, not the same factor: that is a line.'
              : 'The percentage is taken from the current value, not the original: the change is not the same each year.',
          ),
          mc(
            'expWrong',
            'concept',
            `Základem je to, co po roce zbude (${Math.round(factor * 100)} %), ne samotná změna (${percent} %).`,
            `The base is what remains after a year (${Math.round(factor * 100)}%), not the change itself (${percent}%).`,
          ),
          mc(
            'expOther',
            'misread',
            decay
              ? 'To je růst. Hodnota má klesat, základ musí být menší než 1.'
              : 'To je pokles. Hodnota má růst, základ musí být větší než 1.',
            decay
              ? 'That is growth. The value should fall, so the base must be below 1.'
              : 'That is decay. The value should rise, so the base must exceed 1.',
          ),
        ],
        context: { applied: true },
      };
    },
  }),

  gen({
    id: 'log.definition.evaluate',
    concept: 'log.definition',
    kind: 'warmup',
    levels: [1, 2, 3],
    title: L('Logaritmus zpaměti', 'Logarithms in your head'),
    tags: ['annual-review'],
    est: (lv) => 20 + 15 * lv,
    make(r, lv) {
      // Each case: base, argument (as TeX and as parser input) and the exact value.
      type Case = { base: number | string; baseTex?: string; argTex: string; argIn: string; value: Frac };
      const whole = (base: number, k: number): Case => ({
        base,
        argTex: `${base ** k}`,
        argIn: `${base ** k}`,
        value: frac(k),
      });
      const cases: Case[] =
        lv === 1
          ? [
              whole(2, 3),
              whole(2, 4),
              whole(2, 5),
              whole(3, 2),
              whole(3, 3),
              whole(3, 4),
              whole(5, 2),
              whole(5, 3),
              whole(10, 2),
              whole(10, 3),
              whole(4, 2),
              whole(7, 2),
            ]
          : lv === 2
            ? [
                { base: 2, argTex: '\\tfrac{1}{8}', argIn: '1/8', value: frac(-3) },
                { base: 3, argTex: '\\tfrac{1}{9}', argIn: '1/9', value: frac(-2) },
                { base: 5, argTex: '1', argIn: '1', value: frac(0) },
                { base: 7, argTex: '7', argIn: '7', value: frac(1) },
                { base: 10, argTex: '0{,}01', argIn: '1/100', value: frac(-2) },
                { base: 10, argTex: '0{,}001', argIn: '1/1000', value: frac(-3) },
                { base: 4, argTex: '2', argIn: '2', value: frac(1, 2) },
                { base: 9, argTex: '3', argIn: '3', value: frac(1, 2) },
                { base: 5, argTex: '\\sqrt{5}', argIn: 'sqrt(5)', value: frac(1, 2) },
                { base: 2, argTex: '\\tfrac{1}{2}', argIn: '1/2', value: frac(-1) },
                { base: 3, argTex: '\\sqrt{3}', argIn: 'sqrt(3)', value: frac(1, 2) },
              ]
            : [
                { base: 8, argTex: '4', argIn: '4', value: frac(2, 3) },
                { base: 9, argTex: '27', argIn: '27', value: frac(3, 2) },
                { base: 4, argTex: '8', argIn: '8', value: frac(3, 2) },
                { base: 4, argTex: '\\tfrac{1}{8}', argIn: '1/8', value: frac(-3, 2) },
                { base: '(1/2)', baseTex: '\\frac{1}{2}', argTex: '8', argIn: '8', value: frac(-3) },
                { base: '(1/3)', baseTex: '\\frac{1}{3}', argTex: '9', argIn: '9', value: frac(-2) },
                { base: '(1/2)', baseTex: '\\frac{1}{2}', argTex: '\\tfrac{1}{16}', argIn: '1/16', value: frac(4) },
                { base: 27, argTex: '9', argIn: '9', value: frac(2, 3) },
                { base: 8, argTex: '\\tfrac{1}{2}', argIn: '1/2', value: frac(-1, 3) },
                { base: 25, argTex: '125', argIn: '125', value: frac(3, 2) },
              ];
      const chosen = r.pick(cases);
      const b = chosen.baseTex ?? `${chosen.base}`;
      const expression = chosen.base === 10 ? `\\log ${chosen.argTex}` : `\\log_{${b}} ${chosen.argTex}`;
      const commonBase =
        lv === 3
          ? L(
              'Zapiš základ i argument jako mocniny téhož čísla a porovnej exponenty.',
              'Write both the base and the argument as powers of the same number and compare exponents.',
            )
          : L(
              'Záporný exponent dává zlomek, exponent $\\tfrac{1}{2}$ odmocninu.',
              'A negative exponent gives a fraction; the exponent $\\tfrac{1}{2}$ gives a square root.',
            );
      return {
        prompt: L(
          `Určete $${expression}$.${chosen.base === 10 ? ' (Zápis $\\log$ bez základu znamená základ 10.)' : ''}`,
          `Find $${expression}$.${chosen.base === 10 ? ' ($\\log$ without a base means base 10.)' : ''}`,
        ),
        answer: { kind: 'number', value: fToInput(chosen.value) },
        hints: [
          L(
            `Logaritmus je exponent. Ptáš se: $${b}^{?} = ${chosen.argTex}$`,
            `A logarithm is an exponent. You are asking: $${b}^{?} = ${chosen.argTex}$`,
          ),
          commonBase,
        ],
        solution: [
          step(
            'Hledáme exponent, na který je třeba umocnit základ:',
            'We look for the exponent the base must be raised to:',
            `${b.includes('frac') ? `\\left(${b}\\right)` : b}^{${fToTex(chosen.value)}} = ${chosen.argTex} \\;\\Rightarrow\\; ${expression} = ${fToTex(chosen.value)}`,
          ),
        ],
        misconceptions: [
          ...(chosen.value.n !== 0
            ? [
                mc(
                  fToInput(frac(-chosen.value.n, chosen.value.d)),
                  'sign',
                  'Znaménko exponentu: argument menší než 1 znamená (pro základ větší než 1) záporný exponent.',
                  'The sign of the exponent: an argument below 1 means (for a base above 1) a negative exponent.',
                ),
              ]
            : [
                mc(
                  '1',
                  'concept',
                  '$a^0 = 1$, takže logaritmus jedné je nula.',
                  '$a^0 = 1$, so the logarithm of one is zero.',
                ),
              ]),
          ...(chosen.value.d !== 1
            ? [
                mc(
                  fToInput(frac(chosen.value.d, chosen.value.n)),
                  'concept',
                  'Převrácený zlomek: zkontroluj, co je základ a co argument.',
                  'The fraction is upside down: check which is the base and which the argument.',
                ),
              ]
            : []),
        ],
        verify: [{ kind: 'value', expr: `ln(${chosen.argIn})/ln(${chosen.base})` }],
      };
    },
  }),

  gen({
    id: 'log.definition.unknown',
    concept: 'log.definition',
    kind: 'core',
    levels: [2, 3],
    title: L('Neznámá v logaritmu', 'An unknown inside a logarithm'),
    est: (lv) => 45 + 20 * (lv - 2),
    make(r, lv) {
      if (lv === 2 || r.bool()) {
        // log_b x = k
        const base = r.pick([2, 3, 5, 10]);
        const k = r.pick(base >= 5 ? [-2, -1, 2, 3] : [-3, -2, -1, 3, 4]);
        const value = power(frac(base), k);
        return {
          prompt: L(`Určete $x$: $${logTex(base, 'x')} = ${k}$`, `Find $x$: $${logTex(base, 'x')} = ${k}$`),
          answer: { kind: 'number', value: fToInput(value), label: 'x =' },
          hints: [
            L(
              'Přepiš rovnost podle definice: logaritmus je exponent.',
              'Rewrite the equation using the definition: a logarithm is an exponent.',
            ),
            L(`$x = ${base}^{${k}}$`, `$x = ${base}^{${k}}$`),
          ],
          solution: [
            step(
              'Podle definice logaritmu:',
              'By the definition of the logarithm:',
              `x = ${base}^{${k}} = ${fToTex(value)}`,
            ),
          ],
          misconceptions: [
            mc(
              `${base * k}`,
              'concept',
              'Logaritmus je exponent: $x$ je mocnina základu, ne součin.',
              'A logarithm is an exponent: $x$ is a power of the base, not a product.',
            ),
            ...(k > 0
              ? [
                  mc(
                    `${k ** base}`,
                    'concept',
                    `Základ a exponent jsou prohozené: $x = ${base}^{${k}}$.`,
                    `Base and exponent are swapped: $x = ${base}^{${k}}$.`,
                  ),
                ]
              : [
                  mc(
                    fToInput(frac(-power(frac(base), -k).n, 1)),
                    'concept',
                    'Záporný exponent dává zlomek, ne záporné číslo.',
                    'A negative exponent gives a fraction, not a negative number.',
                  ),
                ]),
          ],
          verify: [{ kind: 'value', expr: `${base}^(${k})` }],
        };
      }
      // log_x a = k: the base is the unknown.
      const [base, k] = r.pick([
        [2, 3],
        [3, 4],
        [5, 2],
        [2, 5],
        [4, 3],
        [10, 2],
        [3, 3],
        [6, 2],
      ] as const);
      const negative = r.bool(0.3);
      const argument = negative ? frac(1, base ** k) : frac(base ** k);
      const exponent = negative ? -k : k;
      return {
        prompt: L(
          `Určete základ $x$: $\\log_{x} ${fToTex(argument)} = ${exponent}$`,
          `Find the base $x$: $\\log_{x} ${fToTex(argument)} = ${exponent}$`,
        ),
        answer: { kind: 'number', value: `${base}`, label: 'x =' },
        hints: [
          L(
            `Podle definice: $x^{${exponent}} = ${fToTex(argument)}$.`,
            `By the definition: $x^{${exponent}} = ${fToTex(argument)}$.`,
          ),
          L(
            'Základ logaritmu musí být kladný a různý od 1.',
            'The base of a logarithm must be positive and different from 1.',
          ),
        ],
        solution: [
          step('Přepíšeme podle definice:', 'Rewrite using the definition:', `x^{${exponent}} = ${fToTex(argument)}`),
          step(
            negative ? 'Záporný exponent převrátíme a odmocníme; základ je kladný:' : 'Odmocníme; základ je kladný:',
            negative
              ? 'Invert for the negative exponent and take the root; the base is positive:'
              : 'Take the root; the base is positive:',
            `x = ${base}`,
          ),
        ],
        misconceptions: [
          mc(
            fToInput(frac(1, base)),
            'sign',
            'Zkontroluj znaménko exponentu: vyšel převrácený základ.',
            'Check the sign of the exponent: you got the reciprocal base.',
          ),
          mc(`${-base}`, 'domain', 'Základ logaritmu musí být kladný.', 'The base of a logarithm must be positive.'),
        ],
        verify: [{ kind: 'value', expr: `(${fToInput(argument)})^(1/(${exponent}))` }],
      };
    },
  }),

  gen({
    id: 'log.function.domain',
    concept: 'log.function',
    kind: 'core',
    levels: [1, 2, 3],
    title: L('Definiční obor výrazu s logaritmem', 'Domain of an expression with a logarithm'),
    tags: ['annual-review'],
    est: (lv) => 45 + 30 * lv,
    make(r, lv) {
      const base = r.pick([2, 3, 10, 'e'] as const);
      if (lv === 1) {
        const a = r.pick([1, 2, 3, -1, -2]);
        const bound = nz(r, -5, 5);
        const inside = polyTex([a, -a * bound]);
        const value = a > 0 ? intervalIn(bound, 'inf', false, false) : intervalIn('-inf', bound, false, false);
        const valueL = a > 0 ? intervalL(bound, 'inf', false, false) : intervalL('-inf', bound, false, false);
        return {
          prompt: L(
            `Určete definiční obor funkce $f(x) = ${logTex(base, `(${inside})`)}$.`,
            `Find the domain of $f(x) = ${logTex(base, `(${inside})`)}$.`,
          ),
          answer: { kind: 'interval', value, label: 'D(f) =', placeholder: '(2; inf)' },
          hints: [
            L(
              'Logaritmovat lze jen kladná čísla. Zapiš to jako nerovnici.',
              'Only positive numbers have logarithms. Write that as an inequality.',
            ),
            a < 0
              ? L(
                  'Při dělení záporným číslem se znak nerovnosti otáčí.',
                  'Dividing by a negative number reverses the inequality sign.',
                )
              : L(`Řeš $${inside} > 0$ — nerovnost je ostrá.`, `Solve $${inside} > 0$ — the inequality is strict.`),
          ],
          solution: [
            step(
              'Argument logaritmu musí být kladný:',
              'The argument of the logarithm must be positive:',
              `${inside} > 0`,
            ),
            step(
              a < 0 ? 'Dělíme záporným číslem, znak se otáčí:' : 'Vyřešíme:',
              a < 0 ? 'Divide by a negative number; the sign reverses:' : 'Solve:',
              mapL(valueL, (iv) => `x ${a > 0 ? '>' : '<'} ${bound} \\;\\Rightarrow\\; D(f) = ${iv}`),
            ),
          ],
          misconceptions: [
            mc(
              a > 0 ? intervalIn(bound, 'inf', true, false) : intervalIn('-inf', bound, false, true),
              'domain',
              'Logaritmus nuly neexistuje: krajní bod do definičního oboru nepatří.',
              'The logarithm of zero does not exist: the endpoint is not in the domain.',
            ),
            mc(
              a > 0 ? intervalIn('-inf', bound, false, false) : intervalIn(bound, 'inf', false, false),
              a < 0 ? 'algebra' : 'sign',
              a < 0 ? 'Při dělení záporným číslem se nerovnost otáčí.' : 'Zkontroluj směr nerovnosti.',
              a < 0
                ? 'Dividing by a negative number reverses the inequality.'
                : 'Check the direction of the inequality.',
            ),
            mc(
              'R',
              'domain',
              'Záporná čísla ani nula logaritmus nemají.',
              'Negative numbers and zero have no logarithm.',
            ),
            mc(
              intervalIn(0, 'inf', false, false),
              'misread',
              `Kladný musí být celý argument $${inside}$, ne jen $x$.`,
              `It is the whole argument $${inside}$ that must be positive, not just $x$.`,
            ),
          ],
          verify: [{ kind: 'domain', expr: logIn(base, polyIn([a, -a * bound])) }],
        };
      }
      if (lv === 2) {
        const [r1, r2] = [r.int(-6, -1), r.int(1, 6)];
        const between = r.bool();
        const coeffs = between ? [-1, r1 + r2, -r1 * r2] : [1, -(r1 + r2), r1 * r2];
        const value = between
          ? intervalIn(r1, r2, false, false)
          : `${intervalIn('-inf', r1, false, false)} u ${intervalIn(r2, 'inf', false, false)}`;
        const left = intervalL('-inf', r1, false, false);
        const right = intervalL(r2, 'inf', false, false);
        const valueL = between
          ? intervalL(r1, r2, false, false)
          : L(`${left.cs} \\cup ${right.cs}`, `${left.en} \\cup ${right.en}`);
        return {
          prompt: L(
            `Určete definiční obor funkce $f(x) = ${logTex(base, `(${polyTex(coeffs)})`)}$.`,
            `Find the domain of $f(x) = ${logTex(base, `(${polyTex(coeffs)})`)}$.`,
          ),
          answer: { kind: 'interval', value, label: 'D(f) =' },
          hints: [
            L(
              'Argument logaritmu musí být kladný — řešíš kvadratickou nerovnici.',
              'The argument of the logarithm must be positive — you are solving a quadratic inequality.',
            ),
            L(
              `Kořeny jsou $${r1}$ a $${r2}$. Podle toho, kam se parabola otevírá, je kladná mezi nimi, nebo vně.`,
              `The roots are $${r1}$ and $${r2}$. Depending on which way the parabola opens, it is positive between them or outside.`,
            ),
          ],
          solution: [
            step('Podmínka:', 'Condition:', `${polyTex(coeffs)} > 0`),
            step(
              `Kořeny $${r1}$, $${r2}$; parabola se otevírá ${between ? 'dolů, kladná je mezi kořeny' : 'nahoru, kladná je vně kořenů'}. Kořeny samotné nevyhovují.`,
              `Roots $${r1}$, $${r2}$; the parabola opens ${between ? 'downwards, so it is positive between the roots' : 'upwards, so it is positive outside the roots'}. The roots themselves do not qualify.`,
              mapL(valueL, (iv) => `D(f) = ${iv}`),
            ),
          ],
          misconceptions: [
            mc(
              between
                ? `${intervalIn('-inf', r1, false, false)} u ${intervalIn(r2, 'inf', false, false)}`
                : intervalIn(r1, r2, false, false),
              'graph',
              'Podívej se, kam se parabola otevírá — interval je obráceně.',
              'Look at which way the parabola opens — the interval is the wrong way round.',
            ),
            mc(
              between
                ? intervalIn(r1, r2, true, true)
                : `${intervalIn('-inf', r1, false, true)} u ${intervalIn(r2, 'inf', true, false)}`,
              'domain',
              'V kořenech je argument nulový a logaritmus nuly neexistuje.',
              'At the roots the argument is zero, and zero has no logarithm.',
            ),
          ],
          verify: [{ kind: 'domain', expr: logIn(base, polyIn(coeffs)) }],
        };
      }
      // Level 3: a root and a logarithm together.
      const lo = r.int(-5, 1);
      const hi = lo + r.int(2, 6);
      const fTex = `\\sqrt{${shiftTex(lo)}} + ${logTex(base, `(${polyTex([-1, hi])})`)}`;
      return {
        prompt: L(`Určete definiční obor funkce $f(x) = ${fTex}$.`, `Find the domain of $f(x) = ${fTex}$.`),
        answer: { kind: 'interval', value: intervalIn(lo, hi, true, false), label: 'D(f) =' },
        hints: [
          L(
            'Dvě podmínky, obě musí platit zároveň: jedna pro odmocninu, druhá pro logaritmus.',
            'Two conditions that must hold together: one for the root, one for the logarithm.',
          ),
          L(
            'Odmocnina snese nulu, logaritmus ne. Výsledkem je průnik obou podmínek.',
            'A root tolerates zero, a logarithm does not. The result is the intersection of the two conditions.',
          ),
        ],
        solution: [
          step('Odmocnina:', 'The root:', `${shiftTex(lo)} \\ge 0 \\;\\Rightarrow\\; x \\ge ${lo}`),
          step('Logaritmus:', 'The logarithm:', `${polyTex([-1, hi])} > 0 \\;\\Rightarrow\\; x < ${hi}`),
          step(
            'Průnik obou podmínek:',
            'Intersection of the two conditions:',
            mapL(intervalL(lo, hi, true, false), (iv) => `D(f) = ${iv}`),
          ),
        ],
        misconceptions: [
          mc(
            intervalIn(lo, hi, true, true),
            'domain',
            `V $x = ${hi}$ je argument logaritmu nula — tam funkce definovaná není.`,
            `At $x = ${hi}$ the argument of the logarithm is zero — the function is not defined there.`,
          ),
          mc(
            intervalIn(lo, hi, false, false),
            'notation',
            `V $x = ${lo}$ je pod odmocninou nula, a ta odmocnit jde.`,
            `At $x = ${lo}$ there is zero under the root, and that is allowed.`,
          ),
          mc(
            intervalIn(lo, 'inf', true, false),
            'incomplete',
            'Chybí podmínka pro logaritmus.',
            'The condition for the logarithm is missing.',
          ),
          mc(
            intervalIn('-inf', hi, false, false),
            'incomplete',
            'Chybí podmínka pro odmocninu.',
            'The condition for the root is missing.',
          ),
        ],
        verify: [{ kind: 'domain', expr: `sqrt(${shiftIn(lo)})+${logIn(base, polyIn([-1, hi]))}` }],
      };
    },
  }),

  gen({
    id: 'log.function.properties',
    concept: 'log.function',
    kind: 'warmup',
    levels: [1, 2],
    title: L('Co víme o grafu logaritmu', 'What we know about the graph of a logarithm'),
    est: 40,
    make(r, lv) {
      const base = r.pick([frac(2), frac(3), frac(1, 2), frac(1, 3), frac(10), frac(5)]);
      const b = base.d === 1 ? `${base.n}` : fToTex(base);
      const f = `\\log_{${b}} x`;
      const variant =
        lv === 1 ? r.pick(['point', 'monotone'] as const) : r.pick(['inverse', 'asymptote', 'monotone'] as const);
      if (variant === 'point') {
        const option = (id: string, cs: string, en: string) => ({ id, text: L(`$${cs}$`, `$${en}$`) });
        return {
          prompt: L(
            `Kterým z těchto bodů prochází graf funkce $y = ${f}$?`,
            `Through which of these points does the graph of $y = ${f}$ pass?`,
          ),
          answer: {
            kind: 'choice',
            options: r.shuffle([
              option('one', '[1;\\,0]', '(1,\\,0)'),
              option('zero', '[0;\\,1]', '(0,\\,1)'),
              option('origin', '[0;\\,0]', '(0,\\,0)'),
              option('ones', '[1;\\,1]', '(1,\\,1)'),
            ]),
            correct: ['one'],
            fixedOrder: true,
          },
          hints: [
            L(
              'Čemu se rovná logaritmus jedné? Na kolikátou umocníš základ, aby vyšla 1?',
              'What is the logarithm of one? To which power do you raise the base to get 1?',
            ),
            L('$a^0 = 1$ pro každý základ.', '$a^0 = 1$ for every base.'),
          ],
          solution: [
            step(
              `$${b.includes('frac') ? `\\left(${b}\\right)` : b}^{0} = 1$, tedy $\\log_{${b}} 1 = 0$. Graf každé logaritmické funkce prochází bodem $[1; 0]$.`,
              `$${b.includes('frac') ? `\\left(${b}\\right)` : b}^{0} = 1$, so $\\log_{${b}} 1 = 0$. The graph of every logarithmic function passes through $(1, 0)$.`,
            ),
          ],
          misconceptions: [
            mc(
              'zero',
              'concept',
              'To je bod exponenciály $y = a^x$. Logaritmus je její zrcadlový obraz: souřadnice jsou prohozené.',
              'That is a point of the exponential $y = a^x$. The logarithm is its mirror image: the coordinates are swapped.',
            ),
            mc('origin', 'domain', 'V nule logaritmus definovaný není.', 'The logarithm is not defined at zero.'),
          ],
        };
      }
      if (variant === 'monotone') {
        const growing = baseValue(base) > 1;
        return {
          prompt: L(`Funkce $f(x) = ${f}$ je:`, `The function $f(x) = ${f}$ is:`),
          answer: {
            kind: 'choice',
            fixedOrder: true,
            options: [
              { id: 'up', text: L('rostoucí', 'increasing') },
              { id: 'down', text: L('klesající', 'decreasing') },
            ],
            correct: [growing ? 'up' : 'down'],
          },
          hints: [
            L(
              'Logaritmus je inverzní k exponenciále se stejným základem — a inverze zachovává, jestli funkce roste, nebo klesá.',
              'The logarithm is the inverse of the exponential with the same base — and an inverse keeps whether a function rises or falls.',
            ),
            L(`Je základ $${b}$ větší, nebo menší než 1?`, `Is the base $${b}$ greater or less than 1?`),
          ],
          solution: [
            step(
              growing
                ? `Základ je větší než 1: $y = ${b}^x$ roste, tedy i její inverze roste.`
                : `Základ je mezi 0 a 1: exponenciála klesá, tedy i její inverze klesá.`,
              growing
                ? `The base exceeds 1: $y = ${b}^x$ increases, and so does its inverse.`
                : `The base is between 0 and 1: the exponential decreases, and so does its inverse.`,
            ),
          ],
          misconceptions: [
            mc(
              growing ? 'down' : 'up',
              'concept',
              'Rozhoduje, jestli je základ větší než 1.',
              'What decides is whether the base exceeds 1.',
            ),
          ],
        };
      }
      if (variant === 'inverse') {
        const exp = base.d === 1 ? `${base.n}^{x}` : `\\left(${fToTex(base)}\\right)^{x}`;
        const option = (id: string, tex: string) => ({ id, text: L(`$y = ${tex}$`, `$y = ${tex}$`) });
        return {
          prompt: L(
            `Která funkce je inverzní k funkci $y = ${exp}$?`,
            `Which function is the inverse of $y = ${exp}$?`,
          ),
          answer: {
            kind: 'choice',
            options: r.shuffle([
              option('log', f),
              option('recip', `\\dfrac{1}{${exp}}`),
              option('root', `\\sqrt[x]{${b}}`),
              option('power', `x^{${b}}`),
            ]),
            correct: ['log'],
            fixedOrder: true,
          },
          hints: [
            L(
              'Inverzní funkce odpovídá na otázku: na kolikátou jsem základ umocnil, když vyšlo $x$?',
              'The inverse answers the question: to which power did I raise the base to get $x$?',
            ),
            L('Na „kolikátou“ se ptá logaritmus.', '“To which power” is what a logarithm asks.'),
          ],
          solution: [
            step(
              'Z $y = a^x$ záměnou proměnných: $x = a^y$, a to je podle definice',
              'From $y = a^x$, swapping variables: $x = a^y$, which by definition is',
              `y = ${f}`,
            ),
          ],
          misconceptions: [
            mc(
              'recip',
              'concept',
              'Převrácená hodnota není inverzní funkce.',
              'The reciprocal is not the inverse function.',
            ),
            mc(
              'power',
              'concept',
              'Mocninná funkce má proměnnou v základu; tady je v exponentu.',
              'A power function has the variable in the base; here it is in the exponent.',
            ),
          ],
        };
      }
      return {
        prompt: L(
          `Která přímka je asymptotou grafu funkce $y = ${f}$?`,
          `Which line is an asymptote of the graph of $y = ${f}$?`,
        ),
        answer: {
          kind: 'choice',
          fixedOrder: true,
          options: [
            { id: 'x0', text: L('osa $y$ (přímka $x = 0$)', 'the $y$-axis (the line $x = 0$)') },
            { id: 'y0', text: L('osa $x$ (přímka $y = 0$)', 'the $x$-axis (the line $y = 0$)') },
            { id: 'x1', text: L('přímka $x = 1$', 'the line $x = 1$') },
            { id: 'none', text: L('žádnou asymptotu nemá', 'it has no asymptote') },
          ],
          correct: ['x0'],
        },
        hints: [
          L(
            'Exponenciála se blíží k ose $x$. Co se s tou asymptotou stane při zrcadlení podle $y = x$?',
            'An exponential approaches the $x$-axis. What happens to that asymptote when mirrored in $y = x$?',
          ),
          L(
            'Definiční obor je $(0; \\infty)$: co dělá graf u jeho kraje?',
            'The domain is $(0, \\infty)$: what does the graph do near its edge?',
          ),
        ],
        solution: [
          step(
            'Logaritmus je zrcadlovým obrazem exponenciály podle přímky $y = x$; její asymptota (osa $x$) se zobrazí na osu $y$.',
            'The logarithm is the mirror image of the exponential in the line $y = x$; its asymptote (the $x$-axis) maps to the $y$-axis.',
          ),
        ],
        misconceptions: [
          mc(
            'y0',
            'concept',
            'Osa $x$ je asymptotou exponenciály. U logaritmu jsou role os prohozené.',
            'The $x$-axis is the asymptote of the exponential. For the logarithm the roles of the axes are swapped.',
          ),
          mc(
            'x1',
            'misread',
            'V $x = 1$ graf jen protíná osu $x$.',
            'At $x = 1$ the graph merely crosses the $x$-axis.',
          ),
        ],
      };
    },
  }),

  gen({
    id: 'log.rules.evaluate',
    concept: 'log.rules',
    kind: 'core',
    levels: [2, 3, 4],
    title: L('Výpočty pomocí vět o logaritmech', 'Computing with the laws of logarithms'),
    tags: ['annual-review'],
    est: (lv) => 50 + 25 * (lv - 2),
    make(r, lv) {
      if (lv === 2) {
        if (r.bool()) {
          // log_b m + log_b n = k with m·n = b^k
          const [base, m, n, k] = r.pick([
            [6, 4, 9, 2],
            [10, 4, 25, 2],
            [10, 20, 5, 2],
            [10, 8, 125, 3],
            [6, 8, 27, 3],
            [12, 9, 16, 2],
            [15, 9, 25, 2],
            [10, 2, 50, 2],
            [6, 2, 18, 2],
            [6, 3, 12, 2],
          ] as const);
          const expression = `${logTex(base, `${m}`)} + ${logTex(base, `${n}`)}`;
          return {
            prompt: L(`Vypočítejte: $${expression}$`, `Compute: $${expression}$`),
            answer: { kind: 'number', value: `${k}` },
            hints: [
              L(
                'Součet logaritmů se stejným základem je logaritmus součinu.',
                'A sum of logarithms with the same base is the logarithm of the product.',
              ),
              L(
                `$${m} \\cdot ${n} = ${m * n}$. Kolikátá mocnina čísla ${base} to je?`,
                `$${m} \\cdot ${n} = ${m * n}$. Which power of ${base} is that?`,
              ),
            ],
            solution: [
              step(
                'Logaritmus součinu:',
                'Logarithm of a product:',
                `${expression} = ${logTex(base, `(${m} \\cdot ${n})`)} = ${logTex(base, `${m * n}`)} = ${k}`,
              ),
            ],
            misconceptions: [
              mc(
                `ln(${m + n})/ln(${base})`,
                'formula',
                'Součet logaritmů je logaritmus součinu, ne součtu.',
                'A sum of logarithms is the logarithm of the product, not of the sum.',
              ),
            ],
            verify: [{ kind: 'value', expr: `ln(${m})/ln(${base})+ln(${n})/ln(${base})` }],
          };
        }
        const base = r.pick([2, 3, 5]);
        const n = r.pick(base === 2 ? [3, 5, 7] : base === 3 ? [2, 4, 5] : [2, 3, 4]);
        const k = r.int(1, base === 5 ? 2 : 3);
        const m = n * base ** k;
        const expression = `${logTex(base, `${m}`)} - ${logTex(base, `${n}`)}`;
        return {
          prompt: L(`Vypočítejte: $${expression}$`, `Compute: $${expression}$`),
          answer: { kind: 'number', value: `${k}` },
          hints: [
            L(
              'Rozdíl logaritmů se stejným základem je logaritmus podílu.',
              'A difference of logarithms with the same base is the logarithm of the quotient.',
            ),
            L(`$${m} : ${n} = ${m / n}$`, `$${m} : ${n} = ${m / n}$`),
          ],
          solution: [
            step(
              'Logaritmus podílu:',
              'Logarithm of a quotient:',
              `${expression} = ${logTex(base, `\\dfrac{${m}}{${n}}`)} = ${logTex(base, `${m / n}`)} = ${k}`,
            ),
          ],
          misconceptions: [
            mc(
              `ln(${m - n})/ln(${base})`,
              'formula',
              'Rozdíl logaritmů je logaritmus podílu, ne rozdílu.',
              'A difference of logarithms is the logarithm of the quotient, not of the difference.',
            ),
          ],
          verify: [{ kind: 'value', expr: `ln(${m})/ln(${base})-ln(${n})/ln(${base})` }],
        };
      }
      if (lv === 3) {
        // p·log_b u + log_b v = k with u^p · v = b^k
        const [base, p, u, v, k] = r.pick([
          [6, 2, 2, 9, 2],
          [10, 3, 2, 125, 3],
          [10, 2, 5, 4, 2],
          [12, 2, 3, 16, 2],
          [6, 2, 3, 4, 2],
          [10, 2, 2, 25, 2],
          [6, 3, 2, 27, 3],
          [10, 2, 4, 625, 4],
          [15, 2, 5, 9, 2],
        ] as const);
        const expression = `${p}\\,${logTex(base, `${u}`)} + ${logTex(base, `${v}`)}`;
        return {
          prompt: L(`Vypočítejte: $${expression}$`, `Compute: $${expression}$`),
          answer: { kind: 'number', value: `${k}` },
          hints: [
            L(
              'Číslo před logaritmem se stane exponentem uvnitř: $p \\log a = \\log a^p$.',
              'A number in front of a logarithm becomes an exponent inside: $p \\log a = \\log a^p$.',
            ),
            L(
              `$${u}^{${p}} = ${u ** p}$, potom sečti logaritmy jako logaritmus součinu.`,
              `$${u}^{${p}} = ${u ** p}$, then add the logarithms as the logarithm of a product.`,
            ),
          ],
          solution: [
            step(
              'Logaritmus mocniny:',
              'Logarithm of a power:',
              `${p}\\,${logTex(base, `${u}`)} = ${logTex(base, `${u}^{${p}}`)} = ${logTex(base, `${u ** p}`)}`,
            ),
            step(
              'Logaritmus součinu:',
              'Logarithm of a product:',
              `${logTex(base, `${u ** p}`)} + ${logTex(base, `${v}`)} = ${logTex(base, `${u ** p * v}`)} = ${k}`,
            ),
          ],
          misconceptions: [
            mc(
              `ln(${p * u * v})/ln(${base})`,
              'formula',
              `Číslo ${p} před logaritmem je exponent, ne násobitel argumentu: $${p}\\log ${u} = \\log ${u}^{${p}}$.`,
              `The ${p} in front of the logarithm is an exponent, not a multiplier of the argument: $${p}\\log ${u} = \\log ${u}^{${p}}$.`,
            ),
          ],
          verify: [{ kind: 'value', expr: `${p}*ln(${u})/ln(${base})+ln(${v})/ln(${base})` }],
        };
      }
      // Level 4: change of base — a chain of logarithms that telescopes.
      const [a, b, c, k] = r.pick([
        [2, 3, 8, 3],
        [2, 5, 16, 4],
        [3, 2, 9, 2],
        [3, 7, 81, 4],
        [5, 2, 25, 2],
        [2, 7, 32, 5],
        [3, 5, 27, 3],
      ] as const);
      const expression = `${logTex(a, `${b}`)} \\cdot ${logTex(b, `${c}`)}`;
      return {
        prompt: L(`Vypočítejte: $${expression}$`, `Compute: $${expression}$`),
        answer: { kind: 'number', value: `${k}` },
        hints: [
          L(
            'Převeď oba logaritmy na stejný základ: $\\log_a b = \\dfrac{\\log b}{\\log a}$.',
            'Convert both logarithms to the same base: $\\log_a b = \\dfrac{\\log b}{\\log a}$.',
          ),
          L(`Po převedení se $\\log ${b}$ vykrátí.`, `After converting, $\\log ${b}$ cancels.`),
        ],
        solution: [
          step(
            'Změna základu u obou činitelů:',
            'Change of base in both factors:',
            `\\frac{\\log ${b}}{\\log ${a}} \\cdot \\frac{\\log ${c}}{\\log ${b}}`,
          ),
          step(
            `$\\log ${b}$ se vykrátí:`,
            `$\\log ${b}$ cancels:`,
            `\\frac{\\log ${c}}{\\log ${a}} = ${logTex(a, `${c}`)} = ${k}`,
          ),
        ],
        misconceptions: [
          mc(
            `ln(${b * c})/ln(${a * b})`,
            'formula',
            'Logaritmy s různými základy nejde spojit přímo; nejdřív je převeď na společný základ.',
            'Logarithms with different bases cannot be combined directly; convert them to a common base first.',
          ),
        ],
        verify: [{ kind: 'value', expr: `(ln(${b})/ln(${a}))*(ln(${c})/ln(${b}))` }],
      };
    },
  }),

  gen({
    id: 'log.rules.expand',
    concept: 'log.rules',
    kind: 'core',
    levels: [3, 4],
    title: L('Rozložit logaritmus výrazu', 'Expanding the logarithm of an expression'),
    est: (lv) => 70 + 25 * (lv - 3),
    make(r, lv) {
      // `product` and `power` are the two classic wrong expansions of each expression.
      const cases =
        lv === 3
          ? [
              {
                tex: '\\log (a^2 b)',
                value: '2*p+q',
                steps: '2\\log a + \\log b',
                final: '2p + q',
                product: '2*p*q',
                power: 'p^2+q',
              },
              {
                tex: '\\log \\dfrac{a}{b^3}',
                value: 'p-3*q',
                steps: '\\log a - 3\\log b',
                final: 'p - 3q',
                product: 'p/(3*q)',
                power: 'p-q^3',
              },
              {
                tex: '\\log (a^3 b^2)',
                value: '3*p+2*q',
                steps: '3\\log a + 2\\log b',
                final: '3p + 2q',
                product: '6*p*q',
                power: 'p^3+q^2',
              },
              {
                tex: '\\log \\dfrac{a^2}{b}',
                value: '2*p-q',
                steps: '2\\log a - \\log b',
                final: '2p - q',
                product: '2*p/q',
                power: 'p^2-q',
              },
              {
                tex: '\\log \\sqrt{a\\,b}',
                value: '(p+q)/2',
                steps: '\\tfrac{1}{2}(\\log a + \\log b)',
                final: '\\tfrac{1}{2}(p + q)',
                product: 'p*q/2',
                power: 'sqrt(p+q)',
              },
            ]
          : [
              {
                tex: '\\log \\dfrac{a^2 b}{c}',
                value: '2*p+q-r',
                steps: '2\\log a + \\log b - \\log c',
                final: '2p + q - r',
                product: '2*p*q/r',
                power: 'p^2+q-r',
              },
              {
                tex: '\\log \\dfrac{\\sqrt{a}}{b\\,c}',
                value: 'p/2-q-r',
                steps: '\\tfrac{1}{2}\\log a - \\log b - \\log c',
                final: '\\tfrac{1}{2}p - q - r',
                product: 'p/(2*q*r)',
                power: 'sqrt(p)-q-r',
              },
              {
                tex: '\\log \\dfrac{a^3}{b^2 c}',
                value: '3*p-2*q-r',
                steps: '3\\log a - 2\\log b - \\log c',
                final: '3p - 2q - r',
                product: '3*p/(2*q*r)',
                power: 'p^3-q^2-r',
              },
              {
                tex: '\\log \\left(a\\sqrt{b\\,c}\\right)',
                value: 'p+(q+r)/2',
                steps: '\\log a + \\tfrac{1}{2}(\\log b + \\log c)',
                final: 'p + \\tfrac{1}{2}(q + r)',
                product: 'p*q*r/2',
                power: 'p+sqrt(q+r)',
              },
            ];
      const chosen = r.pick(cases);
      const vars = lv === 3 ? ['p', 'q'] : ['p', 'q', 'r'];
      const letters = lv === 3 ? '$p = \\log a$, $q = \\log b$' : '$p = \\log a$, $q = \\log b$, $r = \\log c$';
      return {
        prompt: L(
          `Označme ${letters} (všechna čísla jsou kladná). Vyjádřete $${chosen.tex}$ pomocí těchto písmen.`,
          `Let ${letters} (all the numbers are positive). Express $${chosen.tex}$ in terms of these letters.`,
        ),
        answer: { kind: 'expr', value: chosen.value, vars, placeholder: '2p + q' },
        hints: [
          L(
            'Součin uvnitř logaritmu se rozpadne na součet, podíl na rozdíl, mocnina se přesune před logaritmus.',
            'A product inside a logarithm becomes a sum, a quotient a difference, and a power moves in front.',
          ),
          L(
            'Odmocnina je mocnina s exponentem $\\tfrac{1}{2}$.',
            'A square root is a power with exponent $\\tfrac{1}{2}$.',
          ),
        ],
        solution: [
          step(
            'Rozložíme podle vět o logaritmech:',
            'Expand using the laws of logarithms:',
            `${chosen.tex} = ${chosen.steps}`,
          ),
          step('Dosadíme písmena:', 'Substitute the letters:', chosen.final),
        ],
        misconceptions: [
          mc(
            chosen.product,
            'formula',
            'Logaritmus součinu je součet logaritmů (a podílu rozdíl), ne jejich součin nebo podíl.',
            'The logarithm of a product is the sum of the logarithms (of a quotient, the difference), not their product or quotient.',
          ),
          mc(
            chosen.power,
            'formula',
            'Exponent se přesouvá před logaritmus jako násobitel: $\\log a^2 = 2\\log a$, ne $(\\log a)^2$.',
            'An exponent moves in front of the logarithm as a multiplier: $\\log a^2 = 2\\log a$, not $(\\log a)^2$.',
          ),
        ],
        verify: [{ kind: 'equiv', expr: chosen.value, vars }],
      };
    },
  }),

  gen({
    id: 'log.rules.find-mistake',
    concept: 'log.rules',
    kind: 'debug',
    levels: [2, 3],
    title: L('Najdi chybu: věty o logaritmech', 'Find the mistake: laws of logarithms'),
    est: 70,
    make(r) {
      const cases: {
        task: string;
        lines: string[];
        wrong: number;
        error: 'formula' | 'concept';
        cs: string;
        en: string;
      }[] = [
        {
          task: '\\log_2 (8 + 8)',
          lines: ['\\log_2 (8 + 8) = \\log_2 8 + \\log_2 8', '= 3 + 3', '= 6'],
          wrong: 0,
          error: 'formula',
          cs: 'Logaritmus součtu není součet logaritmů. Správně: $\\log_2 16 = 4$.',
          en: 'The logarithm of a sum is not the sum of the logarithms. Correctly: $\\log_2 16 = 4$.',
        },
        {
          task: '\\log 20 + \\log 5',
          lines: ['\\log 20 + \\log 5 = \\log (20 \\cdot 5)', '= \\log 100', '= 10'],
          wrong: 2,
          error: 'concept',
          cs: 'První dva kroky jsou v pořádku. Ale $\\log 100 = 2$, protože $10^2 = 100$.',
          en: 'The first two steps are fine. But $\\log 100 = 2$, because $10^2 = 100$.',
        },
        {
          task: '\\log_3 9^2',
          lines: ['\\log_3 9^2 = (\\log_3 9)^2', '= 2^2', '= 4'],
          wrong: 0,
          error: 'formula',
          cs: 'Exponent se přesouvá před logaritmus: $\\log_3 9^2 = 2\\log_3 9 = 4$. Tady výsledek náhodou souhlasí, postup ne.',
          en: 'The exponent moves in front: $\\log_3 9^2 = 2\\log_3 9 = 4$. Here the result happens to agree; the method does not.',
        },
        {
          task: '\\dfrac{\\log 1000}{\\log 10}',
          lines: ['\\dfrac{\\log 1000}{\\log 10} = \\log \\dfrac{1000}{10}', '= \\log 100', '= 2'],
          wrong: 0,
          error: 'formula',
          cs: 'Podíl logaritmů není logaritmus podílu. Správně: $\\frac{3}{1} = 3$.',
          en: 'A quotient of logarithms is not the logarithm of the quotient. Correctly: $\\frac{3}{1} = 3$.',
        },
        {
          task: '\\log_2 12 - \\log_2 3',
          lines: ['\\log_2 12 - \\log_2 3 = \\log_2 (12 - 3)', '= \\log_2 9', '= 2\\log_2 3'],
          wrong: 0,
          error: 'formula',
          cs: 'Rozdíl logaritmů je logaritmus podílu: $\\log_2 \\frac{12}{3} = \\log_2 4 = 2$.',
          en: 'A difference of logarithms is the logarithm of the quotient: $\\log_2 \\frac{12}{3} = \\log_2 4 = 2$.',
        },
        {
          task: '2\\log 5 + \\log 4',
          lines: ['2\\log 5 + \\log 4 = \\log 5^2 + \\log 4', '= \\log (25 + 4)', '= \\log 29'],
          wrong: 1,
          error: 'formula',
          cs: 'Součet logaritmů je logaritmus součinu: $\\log (25 \\cdot 4) = \\log 100 = 2$.',
          en: 'A sum of logarithms is the logarithm of the product: $\\log (25 \\cdot 4) = \\log 100 = 2$.',
        },
      ];
      const chosen = r.pick(cases);
      return {
        prompt: L(
          `Někdo počítal $${chosen.task}$. Ve kterém řádku je první chyba?`,
          `Someone computed $${chosen.task}$. Which line contains the first mistake?`,
        ),
        answer: {
          kind: 'spot',
          lines: chosen.lines.map((tex) => ({ tex })),
          wrongLine: chosen.wrong,
          errorType: chosen.error,
        },
        hints: [
          L(
            'U každého řádku si řekni, kterou větu používá — a jestli taková věta existuje.',
            'For each line, say which law it uses — and whether such a law exists.',
          ),
          L(
            'Platí jen tři: logaritmus součinu, podílu a mocniny. Pro součet a rozdíl uvnitř logaritmu žádná věta není.',
            'There are only three: the logarithm of a product, of a quotient and of a power. There is no law for a sum or difference inside a logarithm.',
          ),
        ],
        solution: [step(chosen.cs, chosen.en)],
      };
    },
  }),
];
