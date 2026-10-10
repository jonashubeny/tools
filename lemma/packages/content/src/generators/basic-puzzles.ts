import { L, type Generator } from '@lemma/core';
import { ans, firstFew, plural, zPrep } from './basic-kit';
import { gen, mc, step } from './helpers';

/** Patterns, non-standard problems and counting. */

const COLOURS: readonly [string, string][] = [
  ['červený', 'red'],
  ['modrý', 'blue'],
  ['zelený', 'green'],
  ['žlutý', 'yellow'],
];

/** A repeating pattern of beads: colour indices, with the first colour the one that is counted. */
const BEAD_CYCLES: readonly number[][] = [
  [0, 1, 1, 2],
  [0, 0, 1, 2, 2],
  [0, 1, 2, 1],
  [0, 1, 0, 2, 2],
  [0, 1, 1, 1, 2, 0],
  [0, 2, 1, 2, 3],
];

const listBeads = (cycle: readonly number[], czech: boolean): string =>
  [...cycle, ...cycle].map((c) => COLOURS[c]![czech ? 0 : 1]).join(', ');

export const BASIC_PUZZLE_GENERATORS: Generator[] = [
  // ----------------------------------------------------------------------------- patterns
  gen({
    id: 'puzzle.patterns.figures',
    concept: 'puzzle.patterns',
    kind: 'core',
    levels: [1, 2, 3, 4],
    title: L('Řada obrazců', 'A series of figures'),
    est: (lv) => 45 + 30 * lv,
    make(r, lv) {
      const a = r.int(3, 8);
      const d = r.int(2, 6);
      const [thing, few, thingEn] = r.pick([
        ['zápalek', 'zápalky', 'matches'],
        ['dílků', 'dílky', 'tiles'],
        ['puntíků', 'puntíky', 'dots'],
      ] as const);
      const rule = L(
        `První obrazec je složen ${zPrep(a)} ${a} ${thing} a každý další obrazec má o ${d} ${d <= 4 ? few : thing} více než předchozí.`,
        `The first figure is made of ${a} ${thingEn}, and each next figure has ${d} ${thingEn} more than the one before.`,
      );
      const term = (n: number): number => a + (n - 1) * d;
      if (lv <= 2) {
        const n = lv === 1 ? r.int(5, 8) : r.int(20, 45);
        return {
          prompt: L(
            `${rule.cs} Z kolika ${thing} je složen ${n}. obrazec?`,
            `${rule.en} How many ${thingEn} is figure ${n} made of?`,
          ),
          answer: { kind: 'number', value: ans(term(n)) },
          hints: [
            L(
              `Od prvního obrazce k ${n}. se přidává ${n - 1}krát, ne ${n}krát.`,
              `From the first figure to figure ${n} you add ${n - 1} times, not ${n} times.`,
            ),
            L(`$${a} + ${n - 1} \\cdot ${d}$`, `$${a} + ${n - 1} \\cdot ${d}$`),
          ],
          solution: [
            step(
              `Začátek a ${n - 1} ${plural(n - 1, 'přírůstek', 'přírůstky', 'přírůstků')}:`,
              `The start and ${n - 1} steps:`,
              `${a} + ${n - 1} \\cdot ${d} = ${term(n)}`,
            ),
          ],
          misconceptions: [
            mc(
              ans(a + n * d),
              'arithmetic',
              `Přírůstků je o jeden méně než pořadí obrazce: k ${n}. obrazci se přidává jen ${n - 1}krát.`,
              `There is one step fewer than the number of the figure: to reach figure ${n} you add only ${n - 1} times.`,
            ),
          ],
          verify: [{ kind: 'value', expr: `${a}+(${n}-1)*${d}` }],
        };
      }
      if (lv === 3) {
        const n = r.int(15, 60);
        const total = term(n);
        return {
          prompt: L(
            `${rule.cs} Kolikátý obrazec je složen ${zPrep(total)} ${total} ${thing}?`,
            `${rule.en} Which figure is made of ${total} ${thingEn}?`,
          ),
          answer: { kind: 'number', value: ans(n) },
          hints: [
            L(
              `O kolik ${thing} má hledaný obrazec více než první? Kolik přírůstků to je?`,
              `How many more ${thingEn} does that figure have than the first? How many steps is that?`,
            ),
            L(
              `$(${total} - ${a}) : ${d} = ${n - 1}$ ${plural(n - 1, 'přírůstek', 'přírůstky', 'přírůstků')}.`,
              `$(${total} - ${a}) \\div ${d} = ${n - 1}$ steps.`,
            ),
          ],
          solution: [
            step(
              'Počet přírůstků:',
              'The number of steps:',
              L(`(${total} - ${a}) : ${d} = ${n - 1}`, `(${total} - ${a}) \\div ${d} = ${n - 1}`),
            ),
            step('Pořadí obrazce je o jedna větší:', 'The number of the figure is one more:', `${n - 1} + 1 = ${n}`),
          ],
          misconceptions: [
            mc(
              ans(n - 1),
              'arithmetic',
              'To je počet přírůstků. První obrazec je už první v pořadí.',
              'That is the number of steps. The first figure already counts as number one.',
            ),
          ],
          verify: [{ kind: 'value', expr: `(${total}-${a})/${d}+1` }],
        };
      }
      const n = r.int(8, 15);
      const sum = (n * (a + term(n))) / 2;
      return {
        prompt: L(
          `${rule.cs} Kolik ${thing} je potřeba na prvních ${n} obrazců dohromady?`,
          `${rule.en} How many ${thingEn} are needed for the first ${n} figures altogether?`,
        ),
        answer: { kind: 'number', value: ans(sum) },
        hints: [
          L(
            `Spočítej ${n}. obrazec. První a poslední obrazec dají dohromady stejně jako druhý a předposlední.`,
            `Work out figure ${n}. The first and the last figure together have as many as the second and the last but one.`,
          ),
          L(
            `${n}. obrazec má ${term(n)}; dvojice dají vždy $${a} + ${term(n)} = ${a + term(n)}$.`,
            `Figure ${n} has ${term(n)}; each pair gives $${a} + ${term(n)} = ${a + term(n)}$.`,
          ),
        ],
        solution: [
          step(`${n}. obrazec:`, `Figure ${n}:`, `${a} + ${n - 1} \\cdot ${d} = ${term(n)}`),
          step(
            `Součet: ${n} obrazců, průměrně $\\frac{${a} + ${term(n)}}{2}$ na obrazec:`,
            `The sum: ${n} figures, $\\frac{${a} + ${term(n)}}{2}$ per figure on average:`,
            `${n} \\cdot \\frac{${a + term(n)}}{2} = ${sum}`,
          ),
        ],
        misconceptions: [
          mc(
            ans(n * term(n)),
            'concept',
            'Všechny obrazce nejsou tak velké jako poslední.',
            'Not every figure is as large as the last one.',
          ),
        ],
        verify: [{ kind: 'value', expr: `${n}*(2*${a}+(${n}-1)*${d})/2` }],
      };
    },
  }),

  gen({
    id: 'puzzle.patterns.cycle',
    concept: 'puzzle.patterns',
    kind: 'core',
    levels: [2, 3, 4],
    title: L('Opakující se vzor', 'A repeating pattern'),
    est: (lv) => 55 + 30 * lv,
    make(r, lv) {
      if (lv === 4) {
        const cycle = r.pick<readonly number[]>([
          [2, 5, 1, 4],
          [3, 1, 4, 1, 5],
          [1, 2, 3, 6],
          [4, 0, 2, 3, 1],
        ]);
        const c = cycle.length;
        const whole = cycle.reduce((x, y) => x + y, 0);
        const n = c * r.int(6, 14) + r.int(1, c - 1);
        const value = Math.floor(n / c) * whole + cycle.slice(0, n % c).reduce((x, y) => x + y, 0);
        const shown = [...cycle, ...cycle].join(', ');
        return {
          prompt: L(
            `Čísla v řadě se pravidelně opakují: ${shown}, … Jaký je součet prvních ${n} čísel řady?`,
            `The numbers of a series repeat regularly: ${shown}, … What is the sum of the first ${n} numbers?`,
          ),
          answer: { kind: 'number', value: ans(value) },
          hints: [
            L(
              `Opakuje se skupina ${c} čísel se součtem ${whole}. Kolik celých skupin se vejde do ${n} čísel?`,
              `A group of ${c} numbers with the sum ${whole} repeats. How many whole groups fit into ${n} numbers?`,
            ),
            L(
              `$${n} = ${Math.floor(n / c)} \\cdot ${c} + ${n % c}$`,
              `$${n} = ${Math.floor(n / c)} \\cdot ${c} + ${n % c}$`,
            ),
          ],
          solution: [
            step(
              'Celé skupiny a zbytek:',
              'Whole groups and the remainder:',
              `${n} = ${Math.floor(n / c)} \\cdot ${c} + ${n % c}`,
            ),
            step(
              `Součet: ${Math.floor(n / c)} skupin a ${firstFew(n % c, 'číslo', 'čísla', 'čísel')} další skupiny:`,
              `The sum: ${Math.floor(n / c)} groups and the first ${n % c} number${n % c === 1 ? '' : 's'} of the next:`,
              `${Math.floor(n / c)} \\cdot ${whole} + ${cycle.slice(0, n % c).reduce((x, y) => x + y, 0)} = ${value}`,
            ),
          ],
          misconceptions: [
            mc(
              ans(Math.floor(n / c) * whole),
              'incomplete',
              'Chybí čísla z neúplné poslední skupiny.',
              'The numbers of the incomplete last group are missing.',
            ),
          ],
        };
      }
      const cycle = r.pick(BEAD_CYCLES);
      const c = cycle.length;
      const positions = cycle.map((colour, index) => (colour === 0 ? index + 1 : 0)).filter((p) => p > 0);
      const intro = L(
        `Korálky jsou na šňůrce navlečeny v pravidelně se opakujícím pořadí: ${listBeads(cycle, true)}, …`,
        `Beads are threaded on a string in a regularly repeating order: ${listBeads(cycle, false)}, …`,
      );
      if (lv === 2) {
        const n = c * r.int(5, 12) + r.int(1, c - 1);
        const value = Math.floor(n / c) * positions.length + positions.filter((p) => p <= n % c).length;
        return {
          prompt: L(
            `${intro.cs} Kolik červených korálků je mezi prvními ${n} korálky?`,
            `${intro.en} How many red beads are among the first ${n} beads?`,
          ),
          answer: { kind: 'number', value: ans(value) },
          hints: [
            L(
              `Opakuje se skupina ${c} korálků. Kolik je v jedné skupině červených?`,
              `A group of ${c} beads repeats. How many red ones are in one group?`,
            ),
            L(
              `$${n} = ${Math.floor(n / c)} \\cdot ${c} + ${n % c}$; v neúplné skupině zkontroluj ${firstFew(n % c, 'korálek', 'korálky', 'korálků')}.`,
              `$${n} = ${Math.floor(n / c)} \\cdot ${c} + ${n % c}$; in the incomplete group check the first ${n % c} bead${n % c === 1 ? '' : 's'}.`,
            ),
          ],
          solution: [
            step(
              `V jedné skupině ${c} korálků ${positions.length === 1 ? 'je 1 červený' : `jsou ${positions.length} červené`}.`,
              `One group of ${c} beads has ${positions.length} red.`,
            ),
            step(
              'Celé skupiny a zbytek:',
              'Whole groups and the remainder:',
              `${Math.floor(n / c)} \\cdot ${positions.length} + ${positions.filter((p) => p <= n % c).length} = ${value}`,
            ),
          ],
          misconceptions: [
            mc(
              ans(Math.floor(n / c) * positions.length),
              'incomplete',
              'Zkontroluj i neúplnou skupinu na konci.',
              'Check the incomplete group at the end as well.',
            ),
          ],
        };
      }
      const k = positions.length * r.int(4, 9) + r.int(1, positions.length);
      const value = Math.floor((k - 1) / positions.length) * c + positions[(k - 1) % positions.length]!;
      return {
        prompt: L(
          `${intro.cs} Kolikátý korálek v řadě je ${k}. červený korálek?`,
          `${intro.en} Which bead of the string is the ${k}th red bead?`,
        ),
        answer: { kind: 'number', value: ans(value) },
        hints: [
          L(
            `V každé skupině ${c} korálků ${positions.length === 1 ? 'je 1 červený' : `jsou ${positions.length} červené`}. Kolik celých skupin je před ${k}. červeným?`,
            `Each group of ${c} beads has ${positions.length} red. How many whole groups come before the ${k}th red one?`,
          ),
          L(
            `Před ním ${plural(Math.floor((k - 1) / positions.length), 'je', 'jsou', 'je')} ${Math.floor((k - 1) / positions.length)} ${plural(Math.floor((k - 1) / positions.length), 'celá skupina', 'celé skupiny', 'celých skupin')}.`,
            `${Math.floor((k - 1) / positions.length)} whole groups come before it.`,
          ),
        ],
        solution: [
          step(
            'Celé skupiny před ním:',
            'The whole groups before it:',
            `${Math.floor((k - 1) / positions.length)} \\cdot ${c} = ${Math.floor((k - 1) / positions.length) * c}`,
          ),
          step(
            `V další skupině je hledaný korálek na ${positions[(k - 1) % positions.length]}. místě:`,
            `In the next group the bead is in place ${positions[(k - 1) % positions.length]}:`,
            `${Math.floor((k - 1) / positions.length) * c} + ${positions[(k - 1) % positions.length]} = ${value}`,
          ),
        ],
        misconceptions: [],
      };
    },
  }),

  // ---------------------------------------------------------------------------- reasoning
  gen({
    id: 'puzzle.reasoning.exchange',
    concept: 'puzzle.reasoning',
    kind: 'core',
    levels: [2, 3],
    title: L('Směnná pravidla', 'Rules of exchange'),
    est: (lv) => 60 + 30 * lv,
    make(r, lv) {
      const a = r.pick([3, 4, 6]);
      const [b, c] = r.pick([
        [2, 5],
        [2, 3],
        [3, 4],
        [3, 5],
        [2, 7],
      ] as const);
      const k = r.pick([2, 3, 4, 6].filter((v) => (v * a) % b === 0));
      const rules = L(
        `Při táborové hře platí tato pravidla výměny: za 1 mapu dostaneš ${a} ${plural(a, 'kompas', 'kompasy', 'kompasů')} a za ${b} ${plural(b, 'kompas', 'kompasy', 'kompasů')} dostaneš ${c} ${plural(c, 'píšťalku', 'píšťalky', 'píšťalek')}.`,
        `In a camp game these rules of exchange hold: 1 map gets you ${a} compasses, and ${b} compasses get you ${c} whistles.`,
      );
      if (lv === 2) {
        const value = (k * a * c) / b;
        return {
          prompt: L(
            `${rules.cs} Kolik píšťalek dostaneš za ${k} ${plural(k, 'mapu', 'mapy', 'map')}?`,
            `${rules.en} How many whistles do ${k} maps get you?`,
          ),
          answer: { kind: 'number', value: ans(value) },
          hints: [
            L(
              'Nejdřív vyměň mapy za kompasy, potom kompasy za píšťalky.',
              'First exchange the maps for compasses, then the compasses for whistles.',
            ),
            L(
              `Za ${k} ${plural(k, 'mapu', 'mapy', 'map')} ${plural(k * a, 'je', 'jsou', 'je')} ${k * a} ${plural(k * a, 'kompas', 'kompasy', 'kompasů')}.`,
              `${k} maps make ${k * a} compasses.`,
            ),
          ],
          solution: [
            step('Kompasy:', 'Compasses:', `${k} \\cdot ${a} = ${k * a}`),
            step(
              `Skupin po ${b} kompasech a píšťalky:`,
              `Groups of ${b} compasses, and whistles:`,
              L(
                `${k * a} : ${b} = ${(k * a) / b}, \\quad ${(k * a) / b} \\cdot ${c} = ${value}`,
                `${k * a} \\div ${b} = ${(k * a) / b}, \\quad ${(k * a) / b} \\cdot ${c} = ${value}`,
              ),
            ),
          ],
          misconceptions: [
            mc(
              ans(k * a * c),
              'misread',
              `Píšťalky se nedávají za každý kompas, ale za každých ${b}.`,
              `Whistles are not given for each compass but for every ${b}.`,
            ),
          ],
          verify: [{ kind: 'value', expr: `${k}*${a}*${c}/${b}` }],
        };
      }
      // How many maps at least for a wanted number of whistles.
      const groups = r.int(4, 9);
      const want = c * groups - r.int(1, c - 1);
      const compasses = groups * b;
      const maps = Math.ceil(compasses / a);
      // The same by trying one map after another.
      let tried = 1;
      while (Math.floor((tried * a) / b) * c < want) tried++;
      if (tried !== maps) throw new Error('puzzle.reasoning.exchange: the two counts of maps disagree');
      return {
        prompt: L(
          `${rules.cs} Kompasy se vyměňují jen po celých ${b === 2 ? 'dvojicích' : 'trojicích'}. Kolik nejméně map potřebuješ, abys získal aspoň ${want} píšťalek?`,
          `${rules.en} Compasses are exchanged only in whole groups of ${b}. What is the smallest number of maps you need to get at least ${want} whistles?`,
        ),
        answer: { kind: 'number', value: ans(maps) },
        hints: [
          L(
            `Postupuj od konce: kolik ${b === 2 ? 'dvojic' : 'trojic'} kompasů je potřeba na ${want} píšťalek?`,
            `Work backwards: how many groups of ${b} compasses are needed for ${want} whistles?`,
          ),
          L(
            `${plural(groups, 'Je potřeba', 'Jsou potřeba', 'Je potřeba')} ${groups} ${b === 2 ? plural(groups, 'dvojice', 'dvojice', 'dvojic') : plural(groups, 'trojice', 'trojice', 'trojic')}, tedy ${compasses} ${plural(compasses, 'kompas', 'kompasy', 'kompasů')}.`,
            `${groups} groups are needed, that is ${compasses} compasses.`,
          ),
        ],
        solution: [
          step(
            `Skupin kompasů: ${groups - 1} nestačí (jen ${(groups - 1) * c} ${plural((groups - 1) * c, 'píšťalka', 'píšťalky', 'píšťalek')}), proto ${groups}.`,
            `Groups of compasses: ${groups - 1} would give only ${(groups - 1) * c} whistles, so ${groups}.`,
          ),
          step('Kompasů:', 'Compasses:', `${groups} \\cdot ${b} = ${compasses}`),
          step(
            `Map: ${maps - 1} ${plural(maps - 1, 'mapa dá', 'mapy dají', 'map dá')} jen ${(maps - 1) * a} ${plural((maps - 1) * a, 'kompas', 'kompasy', 'kompasů')}, proto ${maps}.`,
            `Maps: ${maps - 1} would give only ${(maps - 1) * a} compasses, so ${maps}.`,
          ),
        ],
        misconceptions: [],
      };
    },
  }),

  gen({
    id: 'puzzle.reasoning.unknowns',
    concept: 'puzzle.reasoning',
    kind: 'core',
    levels: [2, 3, 4],
    title: L('Úlohy řešené úvahou', 'Problems solved by reasoning'),
    est: (lv) => 65 + 30 * lv,
    make(r, lv) {
      if (lv === 2) {
        const t = r.int(1, 6);
        const u = r.int(t + 1, 9);
        const number = 10 * t + u;
        const sum = t + u;
        const diff = 9 * (u - t);
        return {
          prompt: L(
            `Dvojciferné číslo má ciferný součet ${sum}. Když jeho číslice vyměníme, zvětší se o ${diff}. Které číslo to je?`,
            `A two-digit number has a digit sum of ${sum}. If its digits are swapped, it grows by ${diff}. Which number is it?`,
          ),
          answer: { kind: 'number', value: ans(number) },
          hints: [
            L(
              'Výměnou číslic se číslo změní o devítinásobek rozdílu číslic.',
              'Swapping the digits changes a number by nine times the difference of the digits.',
            ),
            L(
              `Číslice se liší o $${diff} : 9 = ${u - t}$ a jejich součet je ${sum}.`,
              `The digits differ by $${diff} \\div 9 = ${u - t}$ and add up to ${sum}.`,
            ),
          ],
          solution: [
            step(
              'Rozdíl číslic:',
              'The difference of the digits:',
              L(`${diff} : 9 = ${u - t}`, `${diff} \\div 9 = ${u - t}`),
            ),
            step(
              `Dvě číslice se součtem ${sum} a rozdílem ${u - t}:`,
              `Two digits with the sum ${sum} and the difference ${u - t}:`,
              `${t},\\ ${u}`,
            ),
            step(
              `Číslo se výměnou zvětší, takže menší číslice je na místě desítek: ${number}.`,
              `The number grows when swapped, so the smaller digit is in the tens place: ${number}.`,
            ),
          ],
          misconceptions: [
            mc(ans(10 * u + t), 'misread', 'To je číslo po výměně číslic.', 'That is the number after the swap.'),
          ],
        };
      }
      if (lv === 3) {
        const fives = r.int(3, 12);
        const twos = r.int(3, 12);
        const coins = fives + twos;
        const total = 5 * fives + 2 * twos;
        return {
          prompt: L(
            `Jana zaplatila ${total} korun jen pětikorunami a dvoukorunami. Mincí bylo dohromady ${coins}. Kolik bylo pětikorun?`,
            `Jana paid ${total} crowns using only five-crown and two-crown coins, ${coins} coins in all. How many five-crown coins were there?`,
          ),
          answer: { kind: 'number', value: ans(fives) },
          hints: [
            L(
              `Kdyby všech ${coins} mincí byly dvoukoruny, zaplatila by $2 \\cdot ${coins} = ${2 * coins}$ korun.`,
              `If all ${coins} coins were two-crown coins, she would have paid $2 \\cdot ${coins} = ${2 * coins}$ crowns.`,
            ),
            L(
              `Chybí ${total - 2 * coins} korun. Každá pětikoruna místo dvoukoruny přidá 3 koruny.`,
              `${total - 2 * coins} crowns are missing. Each five-crown coin in place of a two-crown coin adds 3 crowns.`,
            ),
          ],
          solution: [
            step('Samé dvoukoruny:', 'All two-crown coins:', `2 \\cdot ${coins} = ${2 * coins}`),
            step(
              'Rozdíl připadá na pětikoruny, po třech korunách:',
              'The difference is due to the five-crown coins, three crowns each:',
              L(`(${total} - ${2 * coins}) : 3 = ${fives}`, `(${total} - ${2 * coins}) \\div 3 = ${fives}`),
            ),
          ],
          misconceptions: [
            mc(ans(twos), 'misread', 'To je počet dvoukorun.', 'That is the number of two-crown coins.'),
          ],
          verify: [{ kind: 'value', expr: `(${total}-2*${coins})/3` }],
        };
      }
      const son = r.int(9, 15);
      const years = r.int(13, 20);
      const father = 2 * (son + years) - years;
      return {
        prompt: L(
          `Otci je ${father} let a synovi ${son} let. Za kolik let bude otec právě dvakrát starší než syn?`,
          `A father is ${father} and his son ${son} years old. In how many years will the father be exactly twice as old as the son?`,
        ),
        answer: { kind: 'number', value: ans(years) },
        hints: [
          L(
            `Rozdíl jejich věků se nemění: je stále $${father} - ${son} = ${father - son}$ let.`,
            `The difference of their ages never changes: it is always $${father} - ${son} = ${father - son}$ years.`,
          ),
          L(
            `Až bude otec dvakrát starší, bude synovi právě tolik, kolik činí ten rozdíl: ${father - son} let.`,
            `When the father is twice as old, the son will be exactly as old as that difference: ${father - son} years.`,
          ),
        ],
        solution: [
          step('Rozdíl věků:', 'The difference of the ages:', `${father} - ${son} = ${father - son}`),
          step(
            `Syn bude mít ${father - son} let za:`,
            `The son will be ${father - son} in:`,
            `${father - son} - ${son} = ${years}`,
          ),
        ],
        misconceptions: [],
        verify: [{ kind: 'value', expr: `${father}-2*${son}` }],
      };
    },
  }),

  // ----------------------------------------------------------------------------- counting
  gen({
    id: 'puzzle.counting.arrangements',
    concept: 'puzzle.counting',
    kind: 'core',
    levels: [1, 2, 3],
    title: L('Kolik je možností', 'How many possibilities'),
    est: (lv) => 45 + 30 * lv,
    make(r, lv) {
      if (lv === 1) {
        const soups = r.int(2, 4);
        const mains = r.int(3, 6);
        const desserts = r.pick([1, 2, 3]);
        const value = soups * mains * desserts;
        const withDessert = desserts > 1;
        return {
          prompt: L(
            `Jídelna nabízí ${soups} ${plural(soups, 'polévku', 'polévky', 'polévek')}${withDessert ? `, ${mains} ${plural(mains, 'hlavní jídlo', 'hlavní jídla', 'hlavních jídel')} a ${desserts} ${plural(desserts, 'moučník', 'moučníky', 'moučníků')}` : ` a ${mains} ${plural(mains, 'hlavní jídlo', 'hlavní jídla', 'hlavních jídel')}`}. Kolik různých obědů si lze sestavit, když z každého chodu vybereme právě jedno jídlo?`,
            `A canteen offers ${soups} soups${withDessert ? `, ${mains} main courses and ${desserts} desserts` : ` and ${mains} main courses`}. How many different lunches can be put together if exactly one dish of each course is chosen?`,
          ),
          answer: { kind: 'number', value: ans(value) },
          hints: [
            L(
              'Ke každé polévce si můžeš vzít kterékoli hlavní jídlo.',
              'With each soup you can take any of the main courses.',
            ),
            L('Počty možností se násobí.', 'The numbers of choices multiply.'),
          ],
          solution: [
            step(
              'Součin počtů:',
              'The product of the counts:',
              withDessert
                ? `${soups} \\cdot ${mains} \\cdot ${desserts} = ${value}`
                : `${soups} \\cdot ${mains} = ${value}`,
            ),
          ],
          misconceptions: [
            mc(
              ans(soups + mains + (withDessert ? desserts : 0)),
              'concept',
              'Možnosti se nesčítají: každá polévka jde s každým hlavním jídlem.',
              'The choices do not add: every soup goes with every main course.',
            ),
          ],
          verify: [{ kind: 'value', expr: `${soups}*${mains}*${desserts}` }],
        };
      }
      if (lv === 2) {
        const digits = r.pick([
          [1, 2, 5],
          [0, 3, 4],
          [2, 3, 4, 7],
          [0, 1, 6, 8],
          [1, 4, 5, 9],
          [0, 2, 5, 7],
        ] as const);
        const wantEven = r.bool();
        const all: number[] = [];
        for (const a of digits)
          for (const b of digits)
            for (const c of digits) if (a !== 0 && a !== b && b !== c && a !== c) all.push(100 * a + 10 * b + c);
        const matching = all.filter((n) => (wantEven ? n % 2 === 0 : true));
        return {
          prompt: L(
            `Z číslic ${digits.join(', ')} sestavujeme trojciferná čísla, v nichž se žádná číslice neopakuje. Kolik ${wantEven ? 'sudých ' : ''}čísel lze sestavit?`,
            `From the digits ${digits.join(', ')} we form three-digit numbers in which no digit repeats. How many ${wantEven ? 'even ' : ''}numbers can be formed?`,
          ),
          answer: { kind: 'number', value: ans(matching.length) },
          hints: [
            L(
              `Vypisuj systematicky, třeba podle první číslice.${(digits as readonly number[]).includes(0) ? ' Trojciferné číslo nemůže začínat nulou.' : ''}`,
              `List systematically, for instance by the first digit.${(digits as readonly number[]).includes(0) ? ' A three-digit number cannot start with zero.' : ''}`,
            ),
            wantEven
              ? L(
                  'Sudé číslo končí sudou číslicí. Začni tím, co může být na konci.',
                  'An even number ends in an even digit. Start with what can stand at the end.',
                )
              : L(
                  'Na první místo vyber číslici, na druhé jednu ze zbylých, na třetí jednu z těch, co zbyly potom.',
                  'Choose a digit for the first place, one of the rest for the second, one of what is left for the third.',
                ),
          ],
          solution: [
            step(
              `Všech čísel bez opakování číslic je ${all.length}.`,
              `There are ${all.length} numbers without a repeated digit.`,
            ),
            ...(wantEven ? [step(`Sudých z nich je ${matching.length}.`, `${matching.length} of them are even.`)] : []),
          ],
          misconceptions:
            (digits as readonly number[]).includes(0) && !wantEven
              ? [
                  mc(
                    ans(digits.length * (digits.length - 1) * (digits.length - 2)),
                    'domain',
                    'Čísla začínající nulou nejsou trojciferná.',
                    'Numbers starting with zero are not three-digit numbers.',
                  ),
                ]
              : [],
        };
      }
      const n = r.int(5, 12);
      const value = (n * (n - 1)) / 2;
      const [text, textEn] = r.pick([
        [
          `Turnaje se účastní ${n} týmů a každý tým sehraje s každým jiným právě jeden zápas. Kolik zápasů se odehraje?`,
          `${n} teams play a tournament in which every team plays every other team exactly once. How many matches are played?`,
        ],
        [
          `Na schůzce se sešlo ${n} lidí a každý si s každým jednou podal ruku. Kolik podání rukou proběhlo?`,
          `${n} people met and everyone shook hands once with everyone else. How many handshakes were there?`,
        ],
      ] as const);
      return {
        prompt: L(text, textEn),
        answer: { kind: 'number', value: ans(value) },
        hints: [
          L(
            `Každý z ${n} se potká s ${n - 1} ostatními. Když to vynásobíš, započítáš každou dvojici dvakrát.`,
            `Each of the ${n} meets ${n - 1} others. Multiplying counts every pair twice.`,
          ),
          L(
            `$${n} \\cdot ${n - 1} = ${n * (n - 1)}$, a to je dvojnásobek.`,
            `$${n} \\cdot ${n - 1} = ${n * (n - 1)}$, and that is double.`,
          ),
        ],
        solution: [step('Každá dvojice jednou:', 'Each pair once:', `\\frac{${n} \\cdot ${n - 1}}{2} = ${value}`)],
        misconceptions: [
          mc(ans(n * (n - 1)), 'concept', 'Každá dvojice je započítána dvakrát.', 'Every pair has been counted twice.'),
        ],
        verify: [{ kind: 'value', expr: `${n}*(${n}-1)/2` }],
      };
    },
  }),

  gen({
    id: 'puzzle.counting.sums',
    concept: 'puzzle.counting',
    kind: 'reverse',
    levels: [2, 3],
    title: L('Kolika způsoby', 'In how many ways'),
    est: (lv) => 70 + 30 * lv,
    make(r, lv) {
      if (lv === 2) {
        const total = r.int(18, 42);
        const ways: [number, number][] = [];
        for (let fives = 0; fives * 5 <= total; fives++)
          if ((total - fives * 5) % 2 === 0) ways.push([fives, (total - fives * 5) / 2]);
        return {
          prompt: L(
            `Kolika způsoby lze zaplatit přesně ${total} korun, když máme jen dvoukoruny a pětikoruny? (Na pořadí mincí nezáleží; smí se použít i jen jeden druh.)`,
            `In how many ways can exactly ${total} crowns be paid with two-crown and five-crown coins only? (The order of the coins does not matter; a single kind may be used.)`,
          ),
          answer: { kind: 'number', value: ans(ways.length) },
          hints: [
            L(
              'Postupuj podle počtu pětikorun: 0, 1, 2, … Zbytek musí jít zaplatit dvoukorunami, musí tedy být sudý.',
              'Go by the number of five-crown coins: 0, 1, 2, … The rest has to be paid in two-crown coins, so it must be even.',
            ),
            L(
              `Zbytek je sudý právě tehdy, když je počet pětikorun ${total % 2 === 0 ? 'sudý' : 'lichý'}.`,
              `The rest is even exactly when the number of five-crown coins is ${total % 2 === 0 ? 'even' : 'odd'}.`,
            ),
          ],
          solution: [
            step(
              'Možné počty pětikorun:',
              'The possible numbers of five-crown coins:',
              ways.map(([fives]) => `${fives}`).join(',\\ '),
            ),
            step(`Způsobů je ${ways.length}.`, `There are ${ways.length} ways.`),
          ],
          misconceptions: [],
        };
      }
      const sum = r.pick([3, 4, 5, 6, 24, 25, 26]);
      let count = 0;
      for (let n = 100; n <= 999; n++) if (Math.floor(n / 100) + (Math.floor(n / 10) % 10) + (n % 10) === sum) count++;
      return {
        prompt: L(
          `Kolik trojciferných čísel má ciferný součet ${sum}?`,
          `How many three-digit numbers have a digit sum of ${sum}?`,
        ),
        answer: { kind: 'number', value: ans(count) },
        hints: [
          L(
            'Vypisuj podle číslice na místě stovek a ke každé spočítej, kolika způsoby lze doplnit zbylé dvě číslice.',
            'List by the hundreds digit, and for each count the ways of filling in the other two digits.',
          ),
          sum <= 6
            ? L(
                `Číslice stovek může být 1 až ${sum}; na zbylé dvě pak zbývá součet ${sum - 1} až 0.`,
                `The hundreds digit can be 1 to ${sum}; the other two must then add up to ${sum - 1} down to 0.`,
              )
            : L(
                `Největší možný ciferný součet je 27. Počítej, kolik „chybí“ do samých devítek: ${27 - sum}.`,
                `The largest possible digit sum is 27. Count what is "missing" from all nines: ${27 - sum}.`,
              ),
        ],
        solution: [
          step(
            `Systematickým výpisem ${plural(count, 'vychází', 'vycházejí', 'vychází')} ${count} ${plural(count, 'číslo', 'čísla', 'čísel')}.`,
            `A systematic list gives ${count} numbers.`,
          ),
        ],
        misconceptions: [],
      };
    },
  }),
];
