import { L, frac, fToInput, fToTex, gcd, lcm, type Generator } from '@lemma/core';
import { ans, both, cs, en, plural } from './basic-kit';
import { gen, mc, par, step } from './helpers';

/** Numbers: natural numbers, divisibility, integers, decimals, squares and roots. */

const PRIMES = [2, 3, 5, 7, 11, 13] as const;

export const BASIC_NUMBER_GENERATORS: Generator[] = [
  // ------------------------------------------------------------------- natural numbers
  gen({
    id: 'num.natural.order',
    concept: 'num.natural',
    kind: 'core',
    levels: [1, 2, 3],
    title: L('Pořadí početních operací', 'Order of operations'),
    est: (lv) => 35 + 25 * lv,
    make(r, lv) {
      if (lv === 1) {
        const b = r.int(3, 9);
        const c = r.int(3, 9);
        const plus = r.bool();
        const a = plus ? r.int(12, 60) : b * c + r.int(5, 40);
        const value = plus ? a + b * c : a - b * c;
        const wrong = plus ? (a + b) * c : (a - b) * c;
        const shown = `${a} ${plus ? '+' : '-'} ${b} \\cdot ${c}`;
        return {
          prompt: L(`Vypočtěte: $${shown}$`, `Calculate: $${shown}$`),
          answer: { kind: 'number', value: ans(value) },
          hints: [
            L(
              'Násobení má přednost před sčítáním a odčítáním.',
              'Multiplication comes before addition and subtraction.',
            ),
            L(`Nejdřív $${b} \\cdot ${c} = ${b * c}$.`, `First $${b} \\cdot ${c} = ${b * c}$.`),
          ],
          solution: [
            step('Nejdřív násobení:', 'Multiplication first:', `${b} \\cdot ${c} = ${b * c}`),
            step('Pak zbytek:', 'Then the rest:', `${a} ${plus ? '+' : '-'} ${b * c} = ${value}`),
          ],
          misconceptions: [
            mc(
              ans(wrong),
              'algebra',
              'Počítal jsi zleva doprava. Násobení má přednost.',
              'You went left to right. Multiplication comes first.',
            ),
          ],
          verify: [{ kind: 'value', expr: `${a}${plus ? '+' : '-'}${b}*${c}` }],
        };
      }
      if (lv === 2) {
        const c = r.int(3, 8);
        const a = r.int(4, 15);
        const b = r.int(4, 15);
        const e = r.int(2, 9);
        const k = r.int(2, 9);
        const d = e * k;
        const value = (a + b) * c - d / e;
        const shown = `(${a} + ${b}) \\cdot ${c} - ${d} : ${e}`;
        return {
          prompt: L(`Vypočtěte: $${shown}$`, `Calculate: $${shown.replace(':', '\\div')}$`),
          answer: { kind: 'number', value: ans(value) },
          hints: [
            L(
              'Nejdřív závorka, potom násobení a dělení, nakonec odčítání.',
              'Brackets first, then multiplication and division, subtraction last.',
            ),
            L(
              `Závorka je $${a + b}$, takže první část je $${a + b} \\cdot ${c} = ${(a + b) * c}$.`,
              `The bracket is $${a + b}$, so the first part is $${a + b} \\cdot ${c} = ${(a + b) * c}$.`,
            ),
          ],
          solution: [
            step('Závorka:', 'The bracket:', `${a} + ${b} = ${a + b}`),
            step(
              'Násobení a dělení:',
              'Multiplication and division:',
              L(
                `${a + b} \\cdot ${c} = ${(a + b) * c}, \\quad ${d} : ${e} = ${k}`,
                `${a + b} \\cdot ${c} = ${(a + b) * c}, \\quad ${d} \\div ${e} = ${k}`,
              ),
            ),
            step('Rozdíl:', 'The difference:', `${(a + b) * c} - ${k} = ${value}`),
          ],
          misconceptions: [
            mc(
              ans(((a + b) * c - d) / e),
              'algebra',
              'Dělil jsi celý rozdíl. Dělení se týká jen čísla před ním.',
              'You divided the whole difference. The division applies only to the number in front of it.',
            ),
            mc(ans(a + b * c - d / e), 'algebra', 'Závorka se počítá jako první.', 'The bracket is worked out first.'),
          ],
          verify: [{ kind: 'value', expr: `(${a}+${b})*${c}-${d}/${e}` }],
        };
      }
      // X : (p·q − m : n) − u : v, with the bracket dividing X.
      const p = r.int(3, 6);
      const q = r.int(6, 15);
      const n = r.int(3, 9);
      const k = r.int(2, 9);
      const m = n * k;
      const inner = p * q - k;
      const t = r.int(12, 60);
      const X = inner * t;
      const v = r.int(4, 9);
      const w = r.int(2, 9);
      const u = v * w;
      const value = t - w;
      const shown = `${cs(X)} : (${p} \\cdot ${q} - ${m} : ${n}) - ${u} : ${v}`;
      const shownEn = `${en(X)} \\div (${p} \\cdot ${q} - ${m} \\div ${n}) - ${u} \\div ${v}`;
      return {
        prompt: L(`Vypočtěte: $${shown}$`, `Calculate: $${shownEn}$`),
        answer: { kind: 'number', value: ans(value) },
        hints: [
          L(
            'Začni závorkou — a i v ní má násobení a dělení přednost před odčítáním.',
            'Start with the bracket — and inside it too, multiplication and division come before subtraction.',
          ),
          L(`Závorka: $${p * q} - ${k} = ${inner}$.`, `The bracket: $${p * q} - ${k} = ${inner}$.`),
        ],
        solution: [
          step(
            'Závorka:',
            'The bracket:',
            L(
              `${p} \\cdot ${q} - ${m} : ${n} = ${p * q} - ${k} = ${inner}`,
              `${p} \\cdot ${q} - ${m} \\div ${n} = ${p * q} - ${k} = ${inner}`,
            ),
          ),
          step(
            'Obě dělení:',
            'Both divisions:',
            L(
              `${cs(X)} : ${inner} = ${t}, \\quad ${u} : ${v} = ${w}`,
              `${en(X)} \\div ${inner} = ${t}, \\quad ${u} \\div ${v} = ${w}`,
            ),
          ),
          step('Rozdíl:', 'The difference:', `${t} - ${w} = ${value}`),
        ],
        verify: [{ kind: 'value', expr: `${X}/(${p}*${q}-${m}/${n})-${u}/${v}` }],
      };
    },
  }),

  gen({
    id: 'num.natural.missing',
    concept: 'num.natural',
    kind: 'reverse',
    levels: [1, 2, 3],
    title: L('Chybějící číslo v rovnosti', 'The missing number in an equality'),
    est: (lv) => 45 + 25 * lv,
    make(r, lv) {
      const box = '\\square';
      if (lv === 1) {
        const a = r.int(3, 9);
        const x = r.int(4, 12);
        const b = r.int(5, 30);
        const total = a * x + b;
        return {
          prompt: L(
            `Které číslo patří do rámečku? $${a} \\cdot ${box} + ${b} = ${total}$`,
            `Which number belongs in the box? $${a} \\cdot ${box} + ${b} = ${total}$`,
          ),
          answer: { kind: 'number', value: ans(x) },
          hints: [
            L(
              `Postupuj od konce: co muselo vyjít před přičtením čísla ${b}?`,
              `Work backwards: what was there before ${b} was added?`,
            ),
            L(`$${a} \\cdot ${box} = ${total - b}$. Teď vyděl.`, `$${a} \\cdot ${box} = ${total - b}$. Now divide.`),
          ],
          solution: [
            step(`Odečteme ${b}:`, `Subtract ${b}:`, `${a} \\cdot ${box} = ${total - b}`),
            step(`Vydělíme ${a}:`, `Divide by ${a}:`, `${box} = ${x}`),
          ],
          misconceptions: [
            mc(
              ans((total + b) / a),
              'sign',
              'Opačná operace k přičtení je odečtení.',
              'The opposite of adding is subtracting.',
            ),
          ],
          verify: [{ kind: 'value', expr: `(${total}-${b})/${a}` }],
        };
      }
      if (lv === 2) {
        const d = r.int(3, 11);
        const q = r.int(4, 12);
        const p = r.int(2, 6);
        const s = r.int(10, 30);
        const right = q; // box : d = (p·s + q) − p·s
        const x = d * q;
        return {
          prompt: L(
            `Které číslo patří do rámečku? $${box} : ${d} = (${q} + ${p} \\cdot ${s}) - ${p * s}$`,
            `Which number belongs in the box? $${box} \\div ${d} = (${q} + ${p} \\cdot ${s}) - ${p * s}$`,
          ),
          answer: { kind: 'number', value: ans(x) },
          hints: [
            L('Nejdřív vypočítej pravou stranu.', 'Work out the right-hand side first.'),
            L(
              `Pravá strana je ${right}. Které číslo dá po vydělení číslem ${d} výsledek ${right}?`,
              `The right-hand side is ${right}. Which number divided by ${d} gives ${right}?`,
            ),
          ],
          solution: [
            step('Pravá strana:', 'The right-hand side:', `(${q} + ${p * s}) - ${p * s} = ${right}`),
            step(
              `Opačná operace k dělení číslem ${d} je násobení:`,
              `The opposite of dividing by ${d} is multiplying:`,
              `${box} = ${right} \\cdot ${d} = ${x}`,
            ),
          ],
          misconceptions: [
            mc(
              ans((q + p) * s - p * s),
              'algebra',
              'V závorce má násobení přednost před sčítáním.',
              'Inside the bracket multiplication comes before addition.',
            ),
          ],
          verify: [{ kind: 'value', expr: `((${q}+${p}*${s})-${p * s})*${d}` }],
        };
      }
      const a = r.int(12, 40);
      const c = r.int(3, 8);
      const x = r.int(3, 11);
      const e = r.int(5, 25);
      const total = (a - x) * c + e;
      return {
        prompt: L(
          `Které číslo patří do rámečku? $(${a} - ${box}) \\cdot ${c} + ${e} = ${total}$`,
          `Which number belongs in the box? $(${a} - ${box}) \\cdot ${c} + ${e} = ${total}$`,
        ),
        answer: { kind: 'number', value: ans(x) },
        hints: [
          L(
            'Rozbaluj od konce: nejdřív zruš přičtení, pak násobení.',
            'Unwrap from the end: undo the addition first, then the multiplication.',
          ),
          L(`Závorka musí být $${(total - e) / c}$.`, `The bracket must be $${(total - e) / c}$.`),
        ],
        solution: [
          step(
            `Odečteme ${e} a vydělíme ${c}:`,
            `Subtract ${e} and divide by ${c}:`,
            `${a} - ${box} = ${(total - e) / c}`,
          ),
          step('Chybějící číslo:', 'The missing number:', `${box} = ${a} - ${(total - e) / c} = ${x}`),
        ],
        misconceptions: [
          mc(
            ans((total - e) / c + a),
            'sign',
            'Hledané číslo se od čísla před ním odečítá, ne přičítá.',
            'The wanted number is subtracted from the one before it, not added.',
          ),
        ],
        verify: [{ kind: 'value', expr: `${a}-(${total}-${e})/${c}` }],
      };
    },
  }),

  // ------------------------------------------------------------------------ divisibility
  gen({
    id: 'num.divisibility.gcd-lcm',
    concept: 'num.divisibility',
    kind: 'core',
    levels: [1, 2, 3],
    title: L('Společný dělitel a násobek', 'Common divisor and multiple'),
    est: (lv) => 50 + 30 * lv,
    make(r, lv) {
      const g = r.pick([2, 3, 4, 5, 6]);
      const [p, q] = r.pick([
        [2, 3],
        [3, 4],
        [2, 5],
        [3, 5],
        [4, 5],
        [5, 6],
        [3, 7],
        [4, 7],
      ] as const);
      const a = g * p;
      const b = g * q;
      if (lv === 1) {
        return {
          prompt: L(
            `Určete největšího společného dělitele čísel ${a} a ${b}.`,
            `Find the greatest common divisor of ${a} and ${b}.`,
          ),
          answer: { kind: 'number', value: ans(g) },
          hints: [
            L(
              'Vypiš si dělitele obou čísel a hledej největšího, který mají společný.',
              'List the divisors of both numbers and look for the largest one they share.',
            ),
            L(
              `$${a} = ${g} \\cdot ${p}$ a $${b} = ${g} \\cdot ${q}$.`,
              `$${a} = ${g} \\cdot ${p}$ and $${b} = ${g} \\cdot ${q}$.`,
            ),
          ],
          solution: [
            step(
              'Obě čísla rozložíme:',
              'Split both numbers:',
              `${a} = ${g} \\cdot ${p}, \\quad ${b} = ${g} \\cdot ${q}`,
            ),
            step(
              `Čísla ${p} a ${q} už společného dělitele většího než 1 nemají, takže největší společný dělitel je ${g}.`,
              `${p} and ${q} share no divisor above 1, so the greatest common divisor is ${g}.`,
            ),
          ],
          misconceptions: [
            mc(
              ans(lcm(a, b)),
              'misread',
              'To je nejmenší společný násobek. Dělitel nemůže být větší než čísla sama.',
              'That is the least common multiple. A divisor cannot be larger than the numbers themselves.',
            ),
          ],
          verify: [{ kind: 'value', expr: `${gcd(a, b)}` }],
        };
      }
      if (lv === 2) {
        const m = lcm(a, b);
        return {
          prompt: L(
            `Určete nejmenší společný násobek čísel ${a} a ${b}.`,
            `Find the least common multiple of ${a} and ${b}.`,
          ),
          answer: { kind: 'number', value: ans(m) },
          hints: [
            L(
              `Vypisuj násobky většího čísla (${b}, ${2 * b}, …) a zkoušej, který je dělitelný i číslem ${a}.`,
              `List the multiples of the larger number (${b}, ${2 * b}, …) and test which is divisible by ${a} as well.`,
            ),
            L(
              `$${a} = ${g} \\cdot ${p}$, $${b} = ${g} \\cdot ${q}$. Společný násobek potřebuje ${g}, ${p} i ${q}.`,
              `$${a} = ${g} \\cdot ${p}$, $${b} = ${g} \\cdot ${q}$. A common multiple needs ${g}, ${p} and ${q}.`,
            ),
          ],
          solution: [
            step('Rozklady:', 'The splits:', `${a} = ${g} \\cdot ${p}, \\quad ${b} = ${g} \\cdot ${q}`),
            step('Nejmenší společný násobek:', 'The least common multiple:', `${g} \\cdot ${p} \\cdot ${q} = ${m}`),
          ],
          misconceptions: [
            mc(
              ans(a * b),
              'formula',
              'Součin je společný násobek, ale ne nejmenší: společný dělitel se v něm počítá dvakrát.',
              'The product is a common multiple, but not the least: the common divisor is counted twice in it.',
            ),
            mc(ans(g), 'misread', 'To je největší společný dělitel.', 'That is the greatest common divisor.'),
          ],
          verify: [{ kind: 'value', expr: `${a}*${b}/${gcd(a, b)}` }],
        };
      }
      const variant = r.bool();
      if (variant) {
        const m = lcm(a, b);
        return {
          prompt: L(
            `Ze stejné zastávky vyjíždějí dvě linky: jedna ${plural(a, 'každou', 'každé', 'každých')} ${a} ${plural(a, 'minutu', 'minuty', 'minut')}, druhá ${plural(b, 'každou', 'každé', 'každých')} ${b} ${plural(b, 'minutu', 'minuty', 'minut')}. V 8:00 vyjely obě současně. Za kolik minut vyjedou poprvé znovu současně?`,
            `Two bus lines leave the same stop: one every ${a} minutes, the other every ${b} minutes. At 8:00 both left together. After how many minutes will they next leave together?`,
          ),
          answer: { kind: 'number', value: ans(m) },
          hints: [
            L(
              'Hledáš čas, který je násobkem obou intervalů — a nejmenší takový.',
              'You need a time that is a multiple of both intervals — the smallest one.',
            ),
            L(`Nejmenší společný násobek čísel ${a} a ${b}.`, `The least common multiple of ${a} and ${b}.`),
          ],
          solution: [
            step(
              'Obě linky vyjedou současně v čase, který je násobkem obou intervalů.',
              'Both lines leave together at a time that is a multiple of both intervals.',
            ),
            step('Nejmenší společný násobek:', 'The least common multiple:', `n(${a}, ${b}) = ${m}`),
          ],
          misconceptions: [
            mc(
              ans(a * b),
              'formula',
              'Součin je společný násobek, ale dřív nastane menší.',
              'The product is a common multiple, but a smaller one comes sooner.',
            ),
          ],
          verify: [{ kind: 'value', expr: `${a}*${b}/${gcd(a, b)}` }],
          context: { applied: true },
        };
      }
      const side = g * r.pick([5, 10]);
      const w = side * p;
      const h = side * q;
      return {
        prompt: L(
          `Podlahu o rozměrech ${w} cm a ${h} cm chceme pokrýt stejnými čtvercovými dlaždicemi bez řezání. Jakou největší délku strany v cm může dlaždice mít?`,
          `A floor of ${w} cm by ${h} cm is to be covered with identical square tiles without cutting. What is the largest side a tile can have, in cm?`,
        ),
        answer: { kind: 'number', value: ans(side) },
        hints: [
          L(
            'Strana dlaždice musí beze zbytku dělit obě délky.',
            'The side of the tile must divide both lengths exactly.',
          ),
          L(`Největší společný dělitel čísel ${w} a ${h}.`, `The greatest common divisor of ${w} and ${h}.`),
        ],
        solution: [
          step(
            'Strana dlaždice je společný dělitel obou rozměrů; chceme největšího.',
            'The side is a common divisor of both dimensions; we want the greatest.',
          ),
          step('Největší společný dělitel:', 'The greatest common divisor:', `D(${w}, ${h}) = ${side}`),
        ],
        misconceptions: [
          mc(
            ans(lcm(w, h)),
            'misread',
            'To je nejmenší společný násobek — taková dlaždice by byla větší než podlaha.',
            'That is the least common multiple — such a tile would be larger than the floor.',
          ),
        ],
        verify: [{ kind: 'value', expr: `${gcd(w, h)}` }],
        context: { applied: true },
      };
    },
  }),

  gen({
    id: 'num.divisibility.primes',
    concept: 'num.divisibility',
    kind: 'core',
    levels: [1, 2, 3],
    title: L('Prvočísla a rozklad na prvočinitele', 'Primes and prime factorisation'),
    est: (lv) => 50 + 30 * lv,
    make(r, lv) {
      if (lv === 1) {
        const n = r.pick([12, 18, 20, 28, 30, 42, 45, 50, 63, 66, 70, 75, 78, 98]);
        const divisors: number[] = [];
        for (let d = 1; d <= n; d++) if (n % d === 0) divisors.push(d);
        return {
          prompt: L(
            `Kolik dělitelů má číslo ${n}? (Počítej i jedničku a číslo samo.)`,
            `How many divisors does ${n} have? (Count 1 and the number itself.)`,
          ),
          answer: { kind: 'number', value: ans(divisors.length) },
          hints: [
            L(
              'Dělitele hledej po dvojicích: ke každému děliteli patří druhý, se kterým dá v součinu právě to číslo.',
              'Look for divisors in pairs: each divisor has a partner whose product with it is the number.',
            ),
            L(
              `Začni $1 \\cdot ${n}$, $${divisors[1]} \\cdot ${n / divisors[1]!}$, …`,
              `Start with $1 \\cdot ${n}$, $${divisors[1]} \\cdot ${n / divisors[1]!}$, …`,
            ),
          ],
          solution: [
            step('Dělitelé:', 'The divisors:', divisors.join(',\\ ')),
            step(`Je jich ${divisors.length}.`, `There are ${divisors.length} of them.`),
          ],
          misconceptions: [
            mc(
              ans(divisors.length - 2),
              'incomplete',
              'Jednička a číslo samo jsou také dělitelé.',
              'One and the number itself are divisors too.',
            ),
          ],
          verify: [{ kind: 'value', expr: `${divisors.length}` }],
        };
      }
      const [a, b, c] = r.sample(PRIMES, 3).sort((x, y) => x - y) as [number, number, number];
      const n = a * b * c;
      if (lv === 2) {
        return {
          prompt: L(
            `Číslo ${n} je součinem tří různých prvočísel. Určete největší z nich.`,
            `The number ${n} is a product of three different primes. Find the largest of them.`,
          ),
          answer: { kind: 'number', value: ans(c) },
          hints: [
            L(
              'Děl postupně nejmenšími prvočísly: 2, 3, 5, 7, …',
              'Divide by the smallest primes in turn: 2, 3, 5, 7, …',
            ),
            L(
              `$${n} : ${a} = ${b * c}$. Pokračuj s číslem ${b * c}.`,
              `$${n} \\div ${a} = ${b * c}$. Continue with ${b * c}.`,
            ),
          ],
          solution: [
            step('Rozklad na prvočinitele:', 'The prime factorisation:', `${n} = ${a} \\cdot ${b} \\cdot ${c}`),
            step(`Největší prvočinitel je ${c}.`, `The largest prime factor is ${c}.`),
          ],
          misconceptions: [
            mc(
              ans(b * c),
              'incomplete',
              `Číslo ${b * c} ještě není prvočíslo: $${b * c} = ${b} \\cdot ${c}$.`,
              `${b * c} is not a prime yet: $${b * c} = ${b} \\cdot ${c}$.`,
            ),
          ],
          verify: [{ kind: 'value', expr: `${n}/(${a}*${b})` }],
        };
      }
      return {
        prompt: L(
          `Číslo ${n} lze zapsat jako součin tří různých prvočísel. Určete jejich součet.`,
          `The number ${n} can be written as a product of three different primes. Find their sum.`,
        ),
        answer: { kind: 'number', value: ans(a + b + c) },
        hints: [
          L(
            'Nejdřív najdi rozklad na prvočinitele, teprve potom sčítej.',
            'Find the prime factorisation first, then add.',
          ),
          L(
            `$${n} = ${a} \\cdot ${b * c}$ a $${b * c} = ${b} \\cdot ${c}$.`,
            `$${n} = ${a} \\cdot ${b * c}$ and $${b * c} = ${b} \\cdot ${c}$.`,
          ),
        ],
        solution: [
          step('Rozklad:', 'The factorisation:', `${n} = ${a} \\cdot ${b} \\cdot ${c}`),
          step('Součet prvočinitelů:', 'The sum of the prime factors:', `${a} + ${b} + ${c} = ${a + b + c}`),
        ],
        misconceptions: [
          mc(
            ans(a + b * c),
            'incomplete',
            `Číslo ${b * c} není prvočíslo, rozklad je třeba dokončit.`,
            `${b * c} is not a prime; the factorisation has to be finished.`,
          ),
        ],
        verify: [{ kind: 'value', expr: `${a}+${b}+${c}` }],
      };
    },
  }),

  // ---------------------------------------------------------------------------- integers
  gen({
    id: 'num.integers.operations',
    concept: 'num.integers',
    kind: 'core',
    levels: [1, 2, 3],
    title: L('Počítání se zápornými čísly', 'Computing with negative numbers'),
    est: (lv) => 30 + 25 * lv,
    make(r, lv) {
      if (lv === 1) {
        const a = r.int(2, 12);
        const b = r.int(13, 25);
        const variant = r.int(0, 2);
        const [shown, value, expr, wrong] =
          variant === 0
            ? [`${a} - ${b}`, a - b, `${a}-${b}`, b - a]
            : variant === 1
              ? [`-${a} - ${b}`, -a - b, `-${a}-${b}`, b - a]
              : [`-${a} - (-${b})`, -a + b, `-${a}+${b}`, -a - b];
        return {
          prompt: L(`Vypočtěte: $${shown}$`, `Calculate: $${shown}$`),
          answer: { kind: 'number', value: ans(value) },
          hints: [
            L(
              'Představ si číselnou osu: odčítání je posun doleva, odečtení záporného čísla posun doprava.',
              'Picture the number line: subtracting moves left, subtracting a negative number moves right.',
            ),
            L(
              `Začni v čísle $${variant === 0 ? a : -a}$ a posuň se o ${b} ${variant === 2 ? 'doprava' : 'doleva'}.`,
              `Start at $${variant === 0 ? a : -a}$ and move ${b} to the ${variant === 2 ? 'right' : 'left'}.`,
            ),
          ],
          solution: [step('Na číselné ose:', 'On the number line:', `${shown} = ${value}`)],
          misconceptions: [mc(ans(wrong), 'sign', 'Pozor na znaménko výsledku.', 'Mind the sign of the result.')],
          verify: [{ kind: 'value', expr }],
        };
      }
      if (lv === 2) {
        const a = r.int(2, 9);
        const b = r.int(2, 9);
        const c = r.int(2, 6);
        const d = r.int(2, 6);
        const value = -a * -b - c * -d;
        const shown = `(-${a}) \\cdot (-${b}) - ${c} \\cdot (-${d})`;
        return {
          prompt: L(`Vypočtěte: $${shown}$`, `Calculate: $${shown}$`),
          answer: { kind: 'number', value: ans(value) },
          hints: [
            L(
              'Součin dvou záporných čísel je kladný, součin kladného a záporného záporný.',
              'The product of two negative numbers is positive, of a positive and a negative one negative.',
            ),
            L(
              `$(-${a}) \\cdot (-${b}) = ${a * b}$ a $${c} \\cdot (-${d}) = -${c * d}$.`,
              `$(-${a}) \\cdot (-${b}) = ${a * b}$ and $${c} \\cdot (-${d}) = -${c * d}$.`,
            ),
          ],
          solution: [
            step('Oba součiny:', 'Both products:', `${a * b} - (-${c * d})`),
            step(
              'Odečíst záporné číslo znamená přičíst:',
              'Subtracting a negative number means adding:',
              `${a * b} + ${c * d} = ${value}`,
            ),
          ],
          misconceptions: [
            mc(
              ans(a * b - c * d),
              'sign',
              'Minus před záporným součinem dává plus.',
              'A minus in front of a negative product gives a plus.',
            ),
            mc(ans(-a * b + c * d), 'sign', 'Minus krát minus je plus.', 'Minus times minus is plus.'),
          ],
          verify: [{ kind: 'value', expr: `(-${a})*(-${b})-${c}*(-${d})` }],
        };
      }
      const a = r.int(2, 9);
      const b = r.int(2, 7);
      const c = r.int(8, 15);
      const d = r.int(2, 5);
      const value = -a - (b - c) * -d;
      const shown = `-${a} - (${b} - ${c}) \\cdot (-${d})`;
      return {
        prompt: L(`Vypočtěte: $${shown}$`, `Calculate: $${shown}$`),
        answer: { kind: 'number', value: ans(value) },
        hints: [
          L(
            'Závorka, pak násobení, nakonec odčítání. Znaménka hlídej po každém kroku.',
            'Bracket, then multiplication, subtraction last. Watch the signs after every step.',
          ),
          L(
            `Závorka je $${b - c}$ a $(${b - c}) \\cdot (-${d}) = ${(b - c) * -d}$.`,
            `The bracket is $${b - c}$ and $(${b - c}) \\cdot (-${d}) = ${(b - c) * -d}$.`,
          ),
        ],
        solution: [
          step('Závorka:', 'The bracket:', `${b} - ${c} = ${b - c}`),
          step('Součin:', 'The product:', `(${b - c}) \\cdot (-${d}) = ${(b - c) * -d}`),
          step('Rozdíl:', 'The difference:', `-${a} - ${(b - c) * -d} = ${value}`),
        ],
        misconceptions: [
          mc(
            ans(-a + (b - c) * -d),
            'sign',
            'Před součinem je minus: odečítá se.',
            'There is a minus in front of the product: it is subtracted.',
          ),
          mc(
            ans(-a - (c - b) * -d),
            'sign',
            `Závorka vychází záporně: $${b} - ${c} = ${b - c}$.`,
            `The bracket is negative: $${b} - ${c} = ${b - c}$.`,
          ),
        ],
        verify: [{ kind: 'value', expr: `-${a}-(${b}-${c})*(-${d})` }],
      };
    },
  }),

  gen({
    id: 'num.integers.number-line',
    concept: 'num.integers',
    kind: 'applied',
    levels: [1, 2, 3],
    title: L('Číselná osa a teploty', 'The number line and temperatures'),
    est: (lv) => 40 + 25 * lv,
    make(r, lv) {
      if (lv === 1) {
        const start = -r.int(3, 12);
        const up = r.int(6, 18);
        const down = r.int(4, 14);
        const value = start + up - down;
        return {
          prompt: L(
            `Ráno bylo $${start}\\,^\\circ\\text{C}$. Do poledne se oteplilo o $${up}\\,^\\circ\\text{C}$ a do večera se ochladilo o $${down}\\,^\\circ\\text{C}$. Kolik stupňů Celsia bylo večer?`,
            `In the morning it was $${start}\\,^\\circ\\text{C}$. By noon it got $${up}\\,^\\circ\\text{C}$ warmer and by the evening $${down}\\,^\\circ\\text{C}$ colder. How many degrees Celsius was it in the evening?`,
          ),
          answer: { kind: 'number', value: ans(value) },
          hints: [
            L('Oteplení je přičtení, ochlazení odečtení.', 'Warming is adding, cooling is subtracting.'),
            L(
              `V poledne bylo $${start} + ${up} = ${start + up}$.`,
              `At noon it was $${start} + ${up} = ${start + up}$.`,
            ),
          ],
          solution: [step('Postupně:', 'Step by step:', `${start} + ${up} - ${down} = ${value}`)],
          misconceptions: [
            mc(
              ans(-start + up - down),
              'sign',
              'Ranní teplota byla pod nulou.',
              'The morning temperature was below zero.',
            ),
          ],
          verify: [{ kind: 'value', expr: `${start}+${up}-${down}` }],
          context: { applied: true },
        };
      }
      if (lv === 2) {
        const low = -r.int(4, 18);
        const high = r.int(3, 15);
        return {
          prompt: L(
            `Nejnižší teplota v noci byla $${low}\\,^\\circ\\text{C}$, nejvyšší přes den $${high}\\,^\\circ\\text{C}$. O kolik stupňů se obě teploty liší?`,
            `The lowest temperature at night was $${low}\\,^\\circ\\text{C}$, the highest during the day $${high}\\,^\\circ\\text{C}$. By how many degrees do they differ?`,
          ),
          answer: { kind: 'number', value: ans(high - low) },
          hints: [
            L(
              'Rozdíl je vzdálenost na číselné ose: od záporného čísla k nule a od nuly dál.',
              'The difference is a distance on the number line: from the negative number to zero, and on from zero.',
            ),
            L(
              `Od $${low}$ k nule je ${-low}, od nuly k ${high} je ${high}.`,
              `From $${low}$ to zero is ${-low}, from zero to ${high} is ${high}.`,
            ),
          ],
          solution: [step('Rozdíl:', 'The difference:', `${high} - ${par(low)} = ${high} + ${-low} = ${high - low}`)],
          misconceptions: [
            mc(
              ans(Math.abs(high + low)),
              'sign',
              'Odečíst záporné číslo znamená přičíst opačné.',
              'Subtracting a negative number means adding its opposite.',
            ),
          ],
          verify: [{ kind: 'value', expr: `${high}-(${low})` }],
          context: { applied: true },
        };
      }
      // Equal parts between two numbers on the line.
      const parts = r.pick([4, 5, 6, 8]);
      const size = r.pick([2, 3, 4, 5]);
      const left = -size * r.int(1, parts - 1);
      const right = left + parts * size;
      const j = r.int(1, parts - 1);
      const value = left + j * size;
      return {
        prompt: L(
          `Na číselné ose je úsek mezi čísly $${left}$ a $${right}$ rozdělen na ${parts} ${plural(parts, 'dílek', 'stejné dílky', 'stejných dílků')}. Které číslo leží na konci ${j}. dílku (počítáno zleva)?`,
          `On the number line the stretch between $${left}$ and $${right}$ is divided into ${parts} equal parts. Which number lies at the end of part ${j} (counting from the left)?`,
        ),
        answer: { kind: 'number', value: ans(value) },
        hints: [
          L(
            'Nejdřív zjisti, jak dlouhý je jeden dílek: délka celého úseku dělená počtem dílků.',
            'First find the length of one part: the length of the whole stretch divided by the number of parts.',
          ),
          L(
            `Úsek měří $${right} - ${par(left)} = ${right - left}$, jeden dílek ${size}.`,
            `The stretch is $${right} - ${par(left)} = ${right - left}$ long, one part is ${size}.`,
          ),
        ],
        solution: [
          step('Délka jednoho dílku:', 'The length of one part:', `(${right} - ${par(left)}) : ${parts} = ${size}`),
          step(
            `Od levého konce ${j} ${plural(j, 'dílek', 'dílky', 'dílků')} doprava:`,
            `${j} parts to the right of the left end:`,
            `${left} + ${j} \\cdot ${size} = ${value}`,
          ),
        ],
        misconceptions: [
          mc(
            ans(j * size),
            'misread',
            'Počítá se od levého konce úseku, ne od nuly.',
            'Count from the left end of the stretch, not from zero.',
          ),
        ],
        verify: [{ kind: 'value', expr: `${left}+${j}*(${right}-(${left}))/${parts}` }],
      };
    },
  }),

  // ---------------------------------------------------------------------------- decimals
  gen({
    id: 'num.decimals.operations',
    concept: 'num.decimals',
    kind: 'core',
    levels: [1, 2, 3],
    title: L('Počítání s desetinnými čísly', 'Computing with decimals'),
    est: (lv) => 35 + 25 * lv,
    make(r, lv) {
      if (lv === 1) {
        const a = r.int(2, 9);
        const b = r.int(2, 9);
        const value = (a * b) / 100;
        return {
          prompt: both((n) => `${n === cs ? 'Vypočtěte' : 'Calculate'}: $${n(a / 10)} \\cdot ${n(b / 10)}$`),
          answer: { kind: 'number', value: ans(value) },
          hints: [
            L(
              'Vynásob čísla bez desetinných čárek a pak čárku vrať: desetiny krát desetiny jsou setiny.',
              'Multiply the numbers without the decimal points and then put the point back: tenths times tenths are hundredths.',
            ),
            L(
              `$${a} \\cdot ${b} = ${a * b}$, výsledek má dvě desetinná místa.`,
              `$${a} \\cdot ${b} = ${a * b}$, and the result has two decimal places.`,
            ),
          ],
          solution: [
            step(
              'Desetiny krát desetiny jsou setiny:',
              'Tenths times tenths are hundredths:',
              both((n) => `${n(a / 10)} \\cdot ${n(b / 10)} = ${n(value)}`),
            ),
          ],
          misconceptions: [
            mc(
              ans((a * b) / 10),
              'arithmetic',
              'Součin dvou čísel s jedním desetinným místem má dvě desetinná místa.',
              'The product of two numbers with one decimal place has two decimal places.',
            ),
          ],
          verify: [{ kind: 'value', expr: `${a}/10*${b}/10` }],
        };
      }
      if (lv === 2) {
        const whole = r.int(2, 9);
        const divisor = r.pick([0.1, 0.01, 0.2, 0.5, 0.25]);
        const k = r.pick([3, 6, 7, 9, 12]);
        const dividend = Math.round(k * divisor * 1000) / 1000;
        const value = whole * 10 - k;
        return {
          prompt: both(
            (n, czech) =>
              `${czech ? 'Vypočtěte' : 'Calculate'}: $${whole} \\cdot 10 - ${n(dividend)} ${czech ? ':' : '\\div'} ${n(divisor)}$`,
          ),
          answer: { kind: 'number', value: ans(value) },
          hints: [
            L(
              'Dělit desetinou je totéž jako násobit deseti; dělit jednou polovinou je násobit dvěma.',
              'Dividing by a tenth is the same as multiplying by ten; dividing by a half is multiplying by two.',
            ),
            both((n, czech) => `$${n(dividend)} ${czech ? ':' : '\\div'} ${n(divisor)} = ${k}$`),
          ],
          solution: [
            step(
              'Dělení:',
              'The division:',
              both((n, czech) => `${n(dividend)} ${czech ? ':' : '\\div'} ${n(divisor)} = ${k}`),
            ),
            step('Celý výraz:', 'The whole expression:', `${whole * 10} - ${k} = ${value}`),
          ],
          misconceptions: [
            mc(
              ans(whole * 10 - dividend * divisor),
              'arithmetic',
              'Dělil jsi, nebo násobil? Dělením číslem menším než 1 se číslo zvětší.',
              'Did you divide or multiply? Dividing by a number below 1 makes a number larger.',
            ),
          ],
          verify: [{ kind: 'value', expr: `${whole}*10-${dividend}/${divisor}` }],
        };
      }
      const a = r.pick([0.04, 0.08, 0.12, 0.25, 0.4]);
      const d = r.pick([0.2, 0.4, 0.5]);
      const value = Math.round(((a - 1) / d) * 1000) / 1000;
      return {
        prompt: both(
          (n, czech) => `${czech ? 'Vypočtěte' : 'Calculate'}: $(${n(a)} - 1) ${czech ? ':' : '\\div'} ${n(d)}$`,
        ),
        answer: { kind: 'number', value: ans(value) },
        hints: [
          L(
            'Závorka vyjde záporně. Nejdřív ji spočítej, pak teprve děl.',
            'The bracket comes out negative. Work it out first, then divide.',
          ),
          both((n) => `$${n(a)} - 1 = ${n(a - 1)}$`),
        ],
        solution: [
          step(
            'Závorka:',
            'The bracket:',
            both((n) => `${n(a)} - 1 = ${n(a - 1)}`),
          ),
          step(
            'Dělení:',
            'The division:',
            both((n, czech) => `${n(a - 1)} ${czech ? ':' : '\\div'} ${n(d)} = ${n(value)}`),
          ),
        ],
        misconceptions: [
          mc(
            ans(-value),
            'sign',
            'Závorka je záporná, výsledek tedy také.',
            'The bracket is negative, so the result is too.',
          ),
          mc(
            ans(Math.round((a - 1) * d * 1000) / 1000),
            'arithmetic',
            'Dělit a násobit není totéž: dělením číslem menším než 1 se hodnota zvětší.',
            'Dividing is not multiplying: dividing by a number below 1 makes the value larger.',
          ),
        ],
        verify: [{ kind: 'value', expr: `(${a}-1)/${d}` }],
      };
    },
  }),

  gen({
    id: 'num.decimals.applied',
    concept: 'num.decimals',
    kind: 'applied',
    levels: [1, 2, 3],
    title: L('Desetinná čísla v úlohách', 'Decimals in problems'),
    est: (lv) => 50 + 30 * lv,
    make(r, lv) {
      if (lv === 1) {
        const a = r.int(12, 48) / 10;
        const b = r.int(15, 39) / 10;
        const c = r.int(5, 14) / 10;
        const value = Math.round((a + b - c) * 10) / 10;
        return {
          prompt: both((n, czech) =>
            czech
              ? `Nákup vážil $${n(a)}$ kg. Přidali jsme meloun o hmotnosti $${n(b)}$ kg a vyndali sáček brambor o hmotnosti $${n(c)}$ kg. Kolik kilogramů váží nákup teď?`
              : `The shopping weighed $${n(a)}$ kg. We added a melon of $${n(b)}$ kg and took out a bag of potatoes of $${n(c)}$ kg. How many kilograms does the shopping weigh now?`,
          ),
          answer: { kind: 'number', value: ans(value) },
          hints: [
            L(
              'Přidání je sčítání, vyndání odčítání. Piš desetinné čárky pod sebe.',
              'Adding is addition, taking out is subtraction. Line up the decimal points.',
            ),
            both((n) => `$${n(a)} + ${n(b)} = ${n(Math.round((a + b) * 10) / 10)}$`),
          ],
          solution: [
            step(
              'Sečteme a odečteme:',
              'Add and subtract:',
              both((n) => `${n(a)} + ${n(b)} - ${n(c)} = ${n(value)}`),
            ),
          ],
          misconceptions: [
            mc(
              ans(Math.round((a + b + c) * 10) / 10),
              'misread',
              'Sáček brambor jsme vyndali, takže se odečítá.',
              'The bag of potatoes was taken out, so it is subtracted.',
            ),
          ],
          verify: [{ kind: 'value', expr: `${a}+${b}-${c}` }],
          context: { applied: true },
        };
      }
      if (lv === 2) {
        const bottles = r.int(2, 4);
        const bottle = r.pick([0.5, 0.7, 1.5]);
        const glass = r.pick([0.2, 0.25]);
        const glasses = r.pick([18, 20, 24, 28, 30]);
        const start = Math.round((glasses * glass - bottles * bottle) * 100) / 100;
        return {
          prompt: both((n, czech) =>
            czech
              ? `V konvi je $${n(start)}$ l vody. Dolijeme do ní ${bottles} ${plural(bottles, 'láhev', 'láhve', 'lahví')} po $${n(bottle)}$ l a všechnu vodu rozlijeme do sklenic po $${n(glass)}$ l. Kolik sklenic naplníme?`
              : `A can holds $${n(start)}$ l of water. We pour in ${bottles} bottles of $${n(bottle)}$ l each and then share all the water out into glasses of $${n(glass)}$ l. How many glasses do we fill?`,
          ),
          answer: { kind: 'number', value: ans(glasses) },
          hints: [
            L(
              'Nejdřív zjisti, kolik litrů vody je v konvi po dolití.',
              'First find how many litres are in the can after topping up.',
            ),
            both((n) => `$${n(start)} + ${bottles} \\cdot ${n(bottle)} = ${n(glasses * glass)}$ l`),
          ],
          solution: [
            step(
              'Voda v konvi:',
              'The water in the can:',
              both((n) => `${n(start)} + ${bottles} \\cdot ${n(bottle)} = ${n(glasses * glass)}`),
            ),
            step(
              'Počet sklenic:',
              'The number of glasses:',
              both((n, czech) => `${n(glasses * glass)} ${czech ? ':' : '\\div'} ${n(glass)} = ${glasses}`),
            ),
          ],
          misconceptions: [
            mc(
              ans(Math.round(glasses * glass * glass * 1000) / 1000),
              'arithmetic',
              'Počet sklenic je podíl, ne součin: dělením číslem menším než 1 se hodnota zvětší.',
              'The number of glasses is a quotient, not a product: dividing by a number below 1 makes the value larger.',
            ),
          ],
          verify: [{ kind: 'value', expr: `(${start}+${bottles}*${bottle})/${glass}` }],
          context: { applied: true },
        };
      }
      const piece = r.pick([0.45, 0.35, 0.75, 0.6]);
      const count = r.pick([4, 6, 8, 12]);
      const total = Math.round(piece * count * 100) / 100;
      return {
        prompt: both((n, czech) =>
          czech
            ? `Tyč dlouhou $${n(total)}$ m rozřežeme na kusy dlouhé $${n(piece)}$ m. Kolikrát musíme říznout?`
            : `A rod $${n(total)}$ m long is sawn into pieces $${n(piece)}$ m long. How many cuts are needed?`,
        ),
        answer: { kind: 'number', value: ans(count - 1) },
        hints: [
          L(
            'Nejdřív zjisti, kolik kusů vznikne. Řezů je vždy o jeden méně než kusů.',
            'First find how many pieces there will be. There is always one cut fewer than pieces.',
          ),
          both((n, czech) => `$${n(total)} ${czech ? ':' : '\\div'} ${n(piece)} = ${count}$`),
        ],
        solution: [
          step(
            'Počet kusů:',
            'The number of pieces:',
            both((n, czech) => `${n(total)} ${czech ? ':' : '\\div'} ${n(piece)} = ${count}`),
          ),
          step('Počet řezů je o jeden menší:', 'One cut fewer:', `${count} - 1 = ${count - 1}`),
        ],
        misconceptions: [
          mc(
            ans(count),
            'misread',
            'To je počet kusů. Jedním řezem vzniknou dva kusy, takže řezů je o jeden méně.',
            'That is the number of pieces. One cut makes two pieces, so there is one cut fewer.',
          ),
        ],
        verify: [{ kind: 'value', expr: `${total}/${piece}-1` }],
        context: { applied: true },
      };
    },
  }),

  // -------------------------------------------------------------------- squares and roots
  gen({
    id: 'num.powers.evaluate',
    concept: 'num.powers',
    kind: 'core',
    levels: [1, 2, 3],
    title: L('Výrazy s mocninou a odmocninou', 'Expressions with squares and roots'),
    est: (lv) => 35 + 25 * lv,
    make(r, lv) {
      if (lv === 1) {
        const a = r.int(4, 12);
        const b = r.int(3, 11);
        const value = a * a - b;
        return {
          prompt: L(`Vypočtěte: $${a}^2 - \\sqrt{${b * b}}$`, `Calculate: $${a}^2 - \\sqrt{${b * b}}$`),
          answer: { kind: 'number', value: ans(value) },
          hints: [
            L(
              'Druhá mocnina je číslo krát samo sebou; odmocnina je číslo, které po umocnění dá to pod odmocninou.',
              'A square is a number times itself; a square root is the number whose square is what stands under the root.',
            ),
            L(`$${a}^2 = ${a * a}$ a $\\sqrt{${b * b}} = ${b}$.`, `$${a}^2 = ${a * a}$ and $\\sqrt{${b * b}} = ${b}$.`),
          ],
          solution: [step('Mocnina a odmocnina:', 'The square and the root:', `${a * a} - ${b} = ${value}`)],
          misconceptions: [
            mc(ans(2 * a - b), 'formula', 'Druhá mocnina není dvojnásobek.', 'A square is not a double.'),
          ],
          verify: [{ kind: 'value', expr: `${a}^2-sqrt(${b * b})` }],
        };
      }
      if (lv === 2) {
        const a = r.int(3, 9);
        const b = r.int(2, 9);
        if (r.bool()) {
          const c = r.int(2, 5);
          const value = a * a - b * c;
          return {
            prompt: L(
              `Vypočtěte: $(-${a})^2 - \\sqrt{${b * b} \\cdot ${c * c}}$`,
              `Calculate: $(-${a})^2 - \\sqrt{${b * b} \\cdot ${c * c}}$`,
            ),
            answer: { kind: 'number', value: ans(value) },
            hints: [
              L(
                'Druhá mocnina záporného čísla je kladná. Odmocnina ze součinu je součin odmocnin.',
                'The square of a negative number is positive. The root of a product is the product of the roots.',
              ),
              L(
                `$(-${a})^2 = ${a * a}$, $\\sqrt{${b * b} \\cdot ${c * c}} = ${b} \\cdot ${c}$.`,
                `$(-${a})^2 = ${a * a}$, $\\sqrt{${b * b} \\cdot ${c * c}} = ${b} \\cdot ${c}$.`,
              ),
            ],
            solution: [
              step('Mocnina:', 'The square:', `(-${a})^2 = ${a * a}`),
              step(
                'Odmocnina ze součinu:',
                'The root of the product:',
                `\\sqrt{${b * b} \\cdot ${c * c}} = ${b} \\cdot ${c} = ${b * c}`,
              ),
              step('Rozdíl:', 'The difference:', `${a * a} - ${b * c} = ${value}`),
            ],
            misconceptions: [
              mc(
                ans(-a * a - b * c),
                'sign',
                'Závorka se umocňuje celá: $(-a)^2 = a^2$.',
                'The whole bracket is squared: $(-a)^2 = a^2$.',
              ),
            ],
            verify: [{ kind: 'value', expr: `(-${a})^2-sqrt(${b * b}*${c * c})` }],
          };
        }
        const side = r.int(6, 15);
        return {
          prompt: L(
            `Čtverec má obsah $${side * side}\\ \\text{cm}^2$. Kolik centimetrů měří jeho obvod?`,
            `A square has an area of $${side * side}\\ \\text{cm}^2$. How many centimetres is its perimeter?`,
          ),
          answer: { kind: 'number', value: ans(4 * side) },
          hints: [
            L('Strana čtverce je odmocnina z jeho obsahu.', 'The side of a square is the root of its area.'),
            L(`$\\sqrt{${side * side}} = ${side}$`, `$\\sqrt{${side * side}} = ${side}$`),
          ],
          solution: [
            step('Strana:', 'The side:', `a = \\sqrt{${side * side}} = ${side}`),
            step('Obvod:', 'The perimeter:', `o = 4 \\cdot ${side} = ${4 * side}`),
          ],
          misconceptions: [
            mc(
              ans(side),
              'incomplete',
              'To je délka strany. Obvod jsou čtyři strany.',
              'That is the side. The perimeter is four sides.',
            ),
            mc(
              ans((side * side) / 4),
              'formula',
              'Obsah se nedělí čtyřmi; strana je odmocnina z obsahu.',
              'The area is not divided by four; the side is the root of the area.',
            ),
          ],
          verify: [{ kind: 'value', expr: `4*sqrt(${side * side})` }],
        };
      }
      const [x, y, z] = r.pick([
        [3, 4, 5],
        [5, 12, 13],
        [8, 15, 17],
        [6, 8, 10],
        [7, 24, 25],
      ] as const);
      const scale = r.pick([10, 100]);
      const value = x / scale;
      return {
        prompt: both((n) => `${n === cs ? 'Vypočtěte' : 'Calculate'}: $\\sqrt{${n(z / scale)}^2 - ${n(y / scale)}^2}$`),
        answer: { kind: 'number', value: ans(value) },
        hints: [
          L(
            'Odmocninu nelze rozdělit přes rozdíl. Nejdřív umocni a odečti, pak teprve odmocňuj.',
            'A root cannot be split over a difference. Square and subtract first, then take the root.',
          ),
          both(
            (n) =>
              `$${n(z / scale)}^2 = ${n((z * z) / (scale * scale), 6)}$, $${n(y / scale)}^2 = ${n((y * y) / (scale * scale), 6)}$`,
          ),
        ],
        solution: [
          step(
            'Mocniny a jejich rozdíl:',
            'The squares and their difference:',
            both(
              (n) =>
                `${n((z * z) / (scale * scale), 6)} - ${n((y * y) / (scale * scale), 6)} = ${n((x * x) / (scale * scale), 6)}`,
            ),
          ),
          step(
            'Odmocnina:',
            'The root:',
            both((n) => `\\sqrt{${n((x * x) / (scale * scale), 6)}} = ${n(value)}`),
          ),
        ],
        misconceptions: [
          mc(
            ans((z - y) / scale),
            'formula',
            '$\\sqrt{a^2 - b^2}$ není $a - b$.',
            '$\\sqrt{a^2 - b^2}$ is not $a - b$.',
          ),
        ],
        verify: [{ kind: 'value', expr: `sqrt((${z}/${scale})^2-(${y}/${scale})^2)` }],
      };
    },
  }),

  gen({
    id: 'num.powers.fractions',
    concept: 'num.powers',
    kind: 'core',
    levels: [1, 2, 3],
    title: L('Mocnina a odmocnina zlomku', 'Squares and roots of fractions'),
    est: (lv) => 40 + 25 * lv,
    make(r, lv) {
      const [p, q] = r.pick([
        [2, 3],
        [3, 4],
        [2, 5],
        [3, 5],
        [4, 5],
        [5, 6],
        [3, 7],
        [5, 7],
        [4, 9],
        [7, 8],
      ] as const);
      if (lv === 1) {
        const value = frac(p * p, q * q);
        return {
          prompt: L(
            `Vypočtěte a zapište zlomkem v základním tvaru: $\\left(\\frac{${p}}{${q}}\\right)^2$`,
            `Calculate and write as a fraction in lowest terms: $\\left(\\frac{${p}}{${q}}\\right)^2$`,
          ),
          answer: { kind: 'number', value: fToInput(value), form: 'reduced' },
          hints: [
            L(
              'Zlomek se umocní tak, že se umocní čitatel i jmenovatel.',
              'A fraction is squared by squaring the numerator and the denominator.',
            ),
            L(`$${p}^2 = ${p * p}$, $${q}^2 = ${q * q}$.`, `$${p}^2 = ${p * p}$, $${q}^2 = ${q * q}$.`),
          ],
          solution: [
            step(
              'Čitatel i jmenovatel zvlášť:',
              'Numerator and denominator separately:',
              `\\frac{${p}^2}{${q}^2} = ${fToTex(value)}`,
            ),
          ],
          misconceptions: [
            mc(
              fToInput(frac(2 * p, 2 * q + 1)),
              'formula',
              'Umocnit není vynásobit dvěma.',
              'Squaring is not doubling.',
            ),
            mc(fToInput(frac(p * p, q)), 'incomplete', 'Umocňuje se i jmenovatel.', 'The denominator is squared too.'),
          ],
          verify: [{ kind: 'value', expr: `(${p}/${q})^2` }],
        };
      }
      if (lv === 2) {
        const k = r.pick([1, 2, 3]);
        const value = frac(p, q);
        return {
          prompt: L(
            `Vypočtěte a zapište zlomkem v základním tvaru: $\\sqrt{\\frac{${p * p * k * k}}{${q * q * k * k}}}$`,
            `Calculate and write as a fraction in lowest terms: $\\sqrt{\\frac{${p * p * k * k}}{${q * q * k * k}}}$`,
          ),
          answer: { kind: 'number', value: fToInput(value), form: 'reduced' },
          hints: [
            L(
              'Odmocnina zlomku je odmocnina čitatele lomená odmocninou jmenovatele.',
              'The root of a fraction is the root of the numerator over the root of the denominator.',
            ),
            L(
              `$\\sqrt{${p * p * k * k}} = ${p * k}$, $\\sqrt{${q * q * k * k}} = ${q * k}$.`,
              `$\\sqrt{${p * p * k * k}} = ${p * k}$, $\\sqrt{${q * q * k * k}} = ${q * k}$.`,
            ),
          ],
          solution: [
            step('Odmocníme čitatele i jmenovatele:', 'Take the root of both:', `\\frac{${p * k}}{${q * k}}`),
            ...(k > 1 ? [step(`Zkrátíme číslem ${k}:`, `Cancel ${k}:`, fToTex(value))] : []),
          ],
          misconceptions: [
            mc(
              fToInput(frac(p * p * k * k, 2 * q * q * k * k)),
              'formula',
              'Odmocnit není vydělit dvěma.',
              'Taking a root is not halving.',
            ),
          ],
          verify: [{ kind: 'value', expr: `sqrt(${p * p * k * k}/${q * q * k * k})` }],
        };
      }
      // The root of a mixed number that is a perfect square: 6 1/4 = 25/4.
      const [n, d] = r.pick([
        [5, 2],
        [5, 3],
        [5, 4],
        [7, 2],
        [7, 3],
        [7, 4],
        [6, 5],
        [8, 3],
        [9, 4],
        [8, 5],
        [7, 5],
        [9, 2],
      ] as const);
      const whole = Math.floor((n * n) / (d * d));
      const rest = n * n - whole * d * d;
      const value = frac(n, d);
      return {
        prompt: L(
          `Vypočtěte druhou odmocninu ze smíšeného čísla $${whole}\\frac{${rest}}{${d * d}}$. Výsledek zapište zlomkem v základním tvaru.`,
          `Find the square root of the mixed number $${whole}\\frac{${rest}}{${d * d}}$. Write the result as a fraction in lowest terms.`,
        ),
        answer: { kind: 'number', value: fToInput(value), form: 'reduced' },
        hints: [
          L(
            'Smíšené číslo nejdřív převeď na zlomek. Odmocnit zvlášť celou část a zvlášť zlomek nejde.',
            'Turn the mixed number into a fraction first. You cannot take the root of the whole part and of the fraction separately.',
          ),
          L(
            `$${whole}\\frac{${rest}}{${d * d}} = \\frac{${n * n}}{${d * d}}$`,
            `$${whole}\\frac{${rest}}{${d * d}} = \\frac{${n * n}}{${d * d}}$`,
          ),
        ],
        solution: [
          step(
            'Převod na zlomek:',
            'As a fraction:',
            `${whole}\\frac{${rest}}{${d * d}} = \\frac{${whole} \\cdot ${d * d} + ${rest}}{${d * d}} = \\frac{${n * n}}{${d * d}}`,
          ),
          step('Odmocnina:', 'The root:', `\\sqrt{\\frac{${n * n}}{${d * d}}} = ${fToTex(value)}`),
        ],
        misconceptions: [],
        verify: [{ kind: 'value', expr: `sqrt(${whole}+${rest}/${d * d})` }],
      };
    },
  }),
];
