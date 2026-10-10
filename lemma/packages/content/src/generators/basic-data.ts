import { L, type Generator, type Rng } from '@lemma/core';
import { ans, both, csT, enT, numericChoice, plural, table, trueFalse, zPrep } from './basic-kit';
import { gen, mc, step } from './helpers';

/** Units, tables and the arithmetic mean. */

interface Conversion {
  /** The quantity given, with its unit: [value, Czech unit, English unit]. */
  from: [number, string, string];
  /** The unit asked for, in the genitive plural for Czech: "Kolik centimetrů…". */
  to: [string, string];
  factor: number;
  /** How the factor comes about. */
  why: L;
}

const LENGTH_MASS_TIME: readonly Conversion[] = [
  { from: [3.5, 'm', 'm'], to: ['centimetrů', 'centimetres'], factor: 100, why: L('1 m = 100 cm', '1 m = 100 cm') },
  { from: [0.75, 'km', 'km'], to: ['metrů', 'metres'], factor: 1000, why: L('1 km = 1 000 m', '1 km = 1,000 m') },
  { from: [45, 'mm', 'mm'], to: ['centimetrů', 'centimetres'], factor: 0.1, why: L('10 mm = 1 cm', '10 mm = 1 cm') },
  { from: [2.4, 'kg', 'kg'], to: ['gramů', 'grams'], factor: 1000, why: L('1 kg = 1 000 g', '1 kg = 1,000 g') },
  { from: [350, 'g', 'g'], to: ['kilogramů', 'kilograms'], factor: 0.001, why: L('1 000 g = 1 kg', '1,000 g = 1 kg') },
  { from: [2.5, 'h', 'h'], to: ['minut', 'minutes'], factor: 60, why: L('1 h = 60 min', '1 h = 60 min') },
  { from: [1.2, 't', 't'], to: ['kilogramů', 'kilograms'], factor: 1000, why: L('1 t = 1 000 kg', '1 t = 1,000 kg') },
  { from: [64, 'dm', 'dm'], to: ['metrů', 'metres'], factor: 0.1, why: L('10 dm = 1 m', '10 dm = 1 m') },
];

const AREA_VOLUME: readonly Conversion[] = [
  {
    from: [0.5, 'm²', 'm²'],
    to: ['centimetrů čtverečných', 'square centimetres'],
    factor: 10000,
    why: L('1 m² = 100 · 100 cm² = 10 000 cm²', '1 m² = 100 · 100 cm² = 10,000 cm²'),
  },
  {
    from: [3, 'dm²', 'dm²'],
    to: ['centimetrů čtverečných', 'square centimetres'],
    factor: 100,
    why: L('1 dm² = 10 · 10 cm² = 100 cm²', '1 dm² = 10 · 10 cm² = 100 cm²'),
  },
  {
    from: [2.5, 'ha', 'ha'],
    to: ['metrů čtverečných', 'square metres'],
    factor: 10000,
    why: L('1 ha = 100 · 100 m² = 10 000 m²', '1 ha = 100 · 100 m² = 10,000 m²'),
  },
  {
    from: [0.75, 'l', 'l'],
    to: ['mililitrů', 'millilitres'],
    factor: 1000,
    why: L('1 l = 1 000 ml', '1 l = 1,000 ml'),
  },
  { from: [3.2, 'hl', 'hl'], to: ['litrů', 'litres'], factor: 100, why: L('1 hl = 100 l', '1 hl = 100 l') },
  {
    from: [0.4, 'm³', 'm³'],
    to: ['litrů', 'litres'],
    factor: 1000,
    why: L('1 m³ = 1 000 dm³ = 1 000 l', '1 m³ = 1,000 dm³ = 1,000 l'),
  },
  {
    from: [1500, 'cm³', 'cm³'],
    to: ['litrů', 'litres'],
    factor: 0.001,
    why: L('1 000 cm³ = 1 dm³ = 1 l', '1,000 cm³ = 1 dm³ = 1 l'),
  },
  {
    from: [450, 'cm²', 'cm²'],
    to: ['decimetrů čtverečných', 'square decimetres'],
    factor: 0.01,
    why: L('100 cm² = 1 dm²', '100 cm² = 1 dm²'),
  },
];

/** Vary the given quantity a little so that seeds differ. */
function varied(r: Rng, c: Conversion): Conversion {
  const k = r.pick([1, 2, 3, 4]);
  return { ...c, from: [Math.round(c.from[0] * k * 1000) / 1000, c.from[1], c.from[2]] };
}

const CLASSES = ['6. A', '6. B', '7. A', '7. B', '8. A', '8. B'] as const;

interface ClassRow {
  name: string;
  boys: number;
  girls: number;
}

/** Four classes with boys and girls who signed up for something. */
function classTable(r: Rng): { rows: ClassRow[]; tex: L } {
  const names = r.sample(CLASSES, 4).sort();
  const rows = names.map((name) => ({ name, boys: r.int(6, 17), girls: r.int(6, 17) }));
  const body = rows.map((row) => [row.name, `${row.boys}`, `${row.girls}`]);
  return {
    rows,
    tex: L(table(['třída', 'chlapci', 'dívky'], body), table(['class', 'boys', 'girls'], body)),
  };
}

const intro = (tex: L): L =>
  L(
    `Tabulka udává, kolik chlapců a dívek z jednotlivých tříd se přihlásilo na sportovní den. ${tex.cs}`,
    `The table shows how many boys and girls of each class signed up for the sports day. ${tex.en}`,
  );

export const BASIC_DATA_GENERATORS: Generator[] = [
  // -------------------------------------------------------------------------------- units
  gen({
    id: 'units.conversion.convert',
    concept: 'units.conversion',
    kind: 'core',
    levels: [1, 2, 3],
    title: L('Převody jednotek', 'Converting units'),
    est: (lv) => 30 + 25 * lv,
    make(r, lv) {
      if (lv <= 2) {
        const c = varied(r, r.pick(lv === 1 ? LENGTH_MASS_TIME : AREA_VOLUME));
        const value = Math.round(c.from[0] * c.factor * 100000) / 100000;
        return {
          prompt: L(
            `Kolik ${c.to[0]} je ${csT(c.from[0])} ${c.from[1]}?`,
            `How many ${c.to[1]} are ${enT(c.from[0])} ${c.from[2]}?`,
          ),
          answer: { kind: 'number', value: ans(value, 5) },
          hints: [
            c.why,
            c.factor >= 1
              ? L(
                  `Do menší jednotky se převádí násobením: krát ${csT(c.factor)}.`,
                  `Converting to a smaller unit multiplies: times ${enT(c.factor)}.`,
                )
              : L(
                  `Do větší jednotky se převádí dělením: děleno ${csT(1 / c.factor)}.`,
                  `Converting to a larger unit divides: by ${enT(1 / c.factor)}.`,
                ),
          ],
          solution: [
            step(c.why.cs, c.why.en),
            step(
              'Převod:',
              'The conversion:',
              both((n, czech) =>
                c.factor >= 1
                  ? `${n(c.from[0])} \\cdot ${n(c.factor)} = ${n(value, 5)}`
                  : `${n(c.from[0])} ${czech ? ':' : '\\div'} ${n(Math.round(1 / c.factor))} = ${n(value, 5)}`,
              ),
            ),
          ],
          misconceptions: [
            mc(
              ans(c.from[0] / c.factor, 7),
              'arithmetic',
              'Opačný směr: menších jednotek je víc, větších míň.',
              'The wrong direction: there are more of the smaller unit and fewer of the larger.',
            ),
            ...(lv === 2 && (c.factor === 10000 || c.factor === 0.01)
              ? [
                  mc(
                    ans(c.factor === 10000 ? c.from[0] * 100 : c.from[0] / 10, 7),
                    'formula',
                    'U jednotek obsahu se převodní číslo umocňuje na druhou.',
                    'For units of area the conversion factor is squared.',
                  ),
                ]
              : []),
          ],
          verify: [{ kind: 'value', expr: `${c.from[0]}*${c.factor}` }],
        };
      }
      if (r.bool()) {
        const small = r.pick([200, 250, 400, 500]);
        const litres = r.pick([2, 3, 4, 6]);
        const count = (litres * 1000) / small;
        return {
          prompt: L(
            `Kolikrát se sklenice o objemu ${small} ml naplní ${zPrep(litres)} ${litres} litrů vody?`,
            `How many glasses of ${small} ml can be filled from ${litres} litres of water?`,
          ),
          answer: { kind: 'number', value: ans(count) },
          hints: [
            L('Převeď obě množství na stejnou jednotku.', 'Bring both amounts to the same unit.'),
            L(`${litres} l = ${csT(litres * 1000)} ml`, `${litres} l = ${enT(litres * 1000)} ml`),
          ],
          solution: [
            step(
              'Na mililitry:',
              'In millilitres:',
              both((n) => `${litres} \\cdot 1\\,000 = ${n(litres * 1000)}`),
            ),
            step(
              'Počet sklenic:',
              'The number of glasses:',
              both((n, czech) => `${n(litres * 1000)} ${czech ? ':' : '\\div'} ${small} = ${count}`),
            ),
          ],
          misconceptions: [
            mc(
              ans((litres * 100) / small, 6),
              'arithmetic',
              'Litr má 1 000 mililitrů, ne 100.',
              'A litre has 1,000 millilitres, not 100.',
            ),
          ],
          verify: [{ kind: 'value', expr: `${litres}*1000/${small}` }],
          context: { applied: true },
        };
      }
      const kg = r.pick([1.5, 2.5, 3.2]);
      const g = r.pick([350, 450, 800]);
      const dag = r.pick([20, 35, 60]);
      const total = Math.round(kg * 1000 + g + dag * 10);
      return {
        prompt: both((n, czech) =>
          czech
            ? `V batohu jsou tři věci o hmotnostech $${n(kg)}$ kg, ${g} g a ${dag} dag. Kolik gramů váží dohromady?`
            : `A rucksack holds three things weighing $${n(kg)}$ kg, ${g} g and ${dag} dag. How many grams do they weigh together?`,
        ),
        answer: { kind: 'number', value: ans(total) },
        hints: [
          L(
            'Než začneš sčítat, převeď všechno na gramy. 1 dag = 10 g.',
            'Before adding, convert everything to grams. 1 dag = 10 g.',
          ),
          both((n) => `$${n(kg)}$ kg $= ${n(kg * 1000)}$ g, ${dag} dag $= ${dag * 10}$ g`),
        ],
        solution: [
          step(
            'Na gramy:',
            'In grams:',
            both((n) => `${n(kg * 1000)},\\ ${g},\\ ${dag * 10}`),
          ),
          step(
            'Součet:',
            'The sum:',
            both((n) => `${n(kg * 1000)} + ${g} + ${dag * 10} = ${n(total)}`),
          ),
        ],
        misconceptions: [
          mc(
            ans(Math.round(kg * 1000 + g + dag)),
            'arithmetic',
            'Dekagram je deset gramů.',
            'A dekagram is ten grams.',
          ),
        ],
        verify: [{ kind: 'value', expr: `${kg}*1000+${g}+${dag}*10` }],
        context: { applied: true },
      };
    },
  }),

  gen({
    id: 'units.conversion.time',
    concept: 'units.conversion',
    kind: 'applied',
    levels: [1, 2, 3],
    title: L('Počítání s časem', 'Computing with time'),
    est: (lv) => 40 + 25 * lv,
    make(r, lv) {
      if (lv === 1) {
        const startH = r.int(8, 17);
        const startM = r.pick([15, 25, 35, 40, 50]);
        const duration = r.pick([55, 75, 85, 95, 110, 125]);
        const end = startH * 60 + startM + duration;
        const clock = (m: number): string => `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`;
        return {
          prompt: L(
            `Představení začalo v ${clock(startH * 60 + startM)} a skončilo v ${clock(end)}. Kolik minut trvalo?`,
            `A show started at ${clock(startH * 60 + startM)} and ended at ${clock(end)}. How many minutes did it last?`,
          ),
          answer: { kind: 'number', value: ans(duration) },
          hints: [
            L(
              'Nejdřív doplň do celé hodiny, pak přidej celé hodiny a zbylé minuty.',
              'First fill up to the full hour, then add the whole hours and the remaining minutes.',
            ),
            L(
              `Do ${startH + 1}:00 zbývá ${60 - startM} minut.`,
              `There are ${60 - startM} minutes to ${startH + 1}:00.`,
            ),
          ],
          solution: [
            step(`Do ${startH + 1}:00:`, `To ${startH + 1}:00:`, `60 - ${startM} = ${60 - startM}`),
            step(
              `Od ${startH + 1}:00 do ${clock(end)}:`,
              `From ${startH + 1}:00 to ${clock(end)}:`,
              `${end - (startH + 1) * 60}`,
            ),
            step('Dohromady:', 'Together:', `${60 - startM} + ${end - (startH + 1) * 60} = ${duration}`),
          ],
          misconceptions: [
            mc(
              ans(Math.floor(end / 60) * 100 + (end % 60) - (startH * 100 + startM)),
              'arithmetic',
              'Hodina má 60 minut, ne 100: časy nejde odečíst jako obyčejná čísla.',
              'An hour has 60 minutes, not 100: times cannot be subtracted like ordinary numbers.',
            ),
          ],
          verify: [{ kind: 'value', expr: `${end}-${startH * 60 + startM}` }],
          context: { applied: true },
        };
      }
      if (lv === 2) {
        const hours = r.int(1, 2);
        const minutes = r.pick([15, 20, 25, 35, 40]);
        const count = r.int(3, 6);
        const total = (hours * 60 + minutes) * count;
        return {
          prompt: L(
            `Trénink trvá ${hours} h ${minutes} min a v týdnu je jich ${count}. Kolik minut týdně tréninky zaberou?`,
            `A training session lasts ${hours} h ${minutes} min and there are ${count} of them in a week. How many minutes a week do they take?`,
          ),
          answer: { kind: 'number', value: ans(total) },
          hints: [
            L('Převeď délku jednoho tréninku na minuty.', 'Convert the length of one session to minutes.'),
            L(
              `Jeden trénink trvá ${hours * 60 + minutes} minut.`,
              `One session lasts ${hours * 60 + minutes} minutes.`,
            ),
          ],
          solution: [
            step('Jeden trénink:', 'One session:', `${hours} \\cdot 60 + ${minutes} = ${hours * 60 + minutes}`),
            step(
              `${count} ${plural(count, 'trénink', 'tréninky', 'tréninků')}:`,
              `${count} sessions:`,
              `${count} \\cdot ${hours * 60 + minutes} = ${total}`,
            ),
          ],
          misconceptions: [
            mc(
              ans((hours * 100 + minutes) * count),
              'arithmetic',
              'Hodina má 60 minut, ne 100.',
              'An hour has 60 minutes, not 100.',
            ),
          ],
          verify: [{ kind: 'value', expr: `(${hours}*60+${minutes})*${count}` }],
          context: { applied: true },
        };
      }
      const seconds = r.pick([5, 10, 15, 20]);
      const days = r.pick([2, 3, 5, 6]);
      const total = (seconds * 24 * days) / 60;
      return {
        prompt: L(
          `Staré hodiny se každou hodinu zpozdí o ${seconds} sekund. O kolik minut se zpozdí za ${days} ${days < 5 ? 'dny' : 'dní'}?`,
          `An old clock loses ${seconds} seconds every hour. By how many minutes is it slow after ${days} days?`,
        ),
        answer: { kind: 'number', value: ans(total) },
        hints: [
          L(
            `Kolik hodin ${days < 5 ? 'mají' : 'má'} ${days} ${days < 5 ? 'dny' : 'dní'}?`,
            `How many hours are there in ${days} days?`,
          ),
          L(
            `$${days} \\cdot 24 = ${days * 24}$ hodin, tedy zpoždění $${days * 24} \\cdot ${seconds} = ${days * 24 * seconds}$ sekund.`,
            `$${days} \\cdot 24 = ${days * 24}$ hours, so it loses $${days * 24} \\cdot ${seconds} = ${days * 24 * seconds}$ seconds.`,
          ),
        ],
        solution: [
          step('Počet hodin:', 'The number of hours:', `${days} \\cdot 24 = ${days * 24}`),
          step(
            'Zpoždění v sekundách:',
            'The loss in seconds:',
            both((n) => `${days * 24} \\cdot ${seconds} = ${n(days * 24 * seconds)}`),
          ),
          step(
            'V minutách:',
            'In minutes:',
            both((n, czech) => `${n(days * 24 * seconds)} ${czech ? ':' : '\\div'} 60 = ${total}`),
          ),
        ],
        misconceptions: [
          mc(
            ans(days * 24 * seconds),
            'misread',
            'To je zpoždění v sekundách. Otázka se ptá na minuty.',
            'That is the loss in seconds. The question asks for minutes.',
          ),
        ],
        verify: [{ kind: 'value', expr: `${seconds}*24*${days}/60` }],
        context: { applied: true },
      };
    },
  }),

  gen({
    id: 'units.conversion.matching',
    concept: 'units.conversion',
    kind: 'core',
    levels: [2],
    title: L('Převody jednotek – přiřazení výsledku', 'Converting units – match the result'),
    tags: ['match6'],
    est: () => 60,
    make(r) {
      const values = [15, 25, 40, 75, 150, 250];
      const ids = ['a', 'b', 'c', 'd', 'e', 'f'];
      const bank: readonly [number, L, L][] = [
        [
          15,
          L('Kolik minut je čtvrt hodiny?', 'How many minutes are a quarter of an hour?'),
          L('60 : 4 = 15', '60 ÷ 4 = 15'),
        ],
        [25, L('Kolik milimetrů je 2,5 cm?', 'How many millimetres are 2.5 cm?'), L('2,5 · 10 = 25', '2.5 · 10 = 25')],
        [40, L('Kolik centimetrů je 0,4 m?', 'How many centimetres are 0.4 m?'), L('0,4 · 100 = 40', '0.4 · 100 = 40')],
        [
          75,
          L('Kolik centimetrů jsou tři čtvrtě metru?', 'How many centimetres are three quarters of a metre?'),
          L('100 : 4 · 3 = 75', '100 ÷ 4 · 3 = 75'),
        ],
        [
          150,
          L('Kolik minut je dvě a půl hodiny?', 'How many minutes are two and a half hours?'),
          L('2,5 · 60 = 150', '2.5 · 60 = 150'),
        ],
        [
          250,
          L('Kolik gramů je čtvrt kilogramu?', 'How many grams are a quarter of a kilogram?'),
          L('1 000 : 4 = 250', '1,000 ÷ 4 = 250'),
        ],
        [
          150,
          L('Kolik sekund je 2,5 minuty?', 'How many seconds are 2.5 minutes?'),
          L('2,5 · 60 = 150', '2.5 · 60 = 150'),
        ],
        [
          250,
          L('Kolik mililitrů je čtvrt litru?', 'How many millilitres are a quarter of a litre?'),
          L('1 000 : 4 = 250', '1,000 ÷ 4 = 250'),
        ],
        [40, L('Kolik decimetrů jsou 4 metry?', 'How many decimetres are 4 metres?'), L('4 · 10 = 40', '4 · 10 = 40')],
        [
          75,
          L('Kolik minut je hodina a čtvrt?', 'How many minutes are an hour and a quarter?'),
          L('60 + 15 = 75', '60 + 15 = 75'),
        ],
        [
          25,
          L('Kolik centimetrů je čtvrt metru?', 'How many centimetres are a quarter of a metre?'),
          L('100 : 4 = 25', '100 ÷ 4 = 25'),
        ],
        [15, L('Kolik milimetrů je 1,5 cm?', 'How many millimetres are 1.5 cm?'), L('1,5 · 10 = 15', '1.5 · 10 = 15')],
      ];
      const [value, question, working] = r.pick(bank);
      return {
        prompt: question,
        answer: {
          kind: 'choice',
          options: values.map((v, i) => ({ id: ids[i]!, text: L(`${v}`, `${v}`) })),
          correct: [ids[values.indexOf(value)]!],
          fixedOrder: true,
        },
        hints: [
          L('Vybav si převodní vztah mezi oběma jednotkami.', 'Recall how the two units relate.'),
          L(
            'Čtvrtina je celek dělený čtyřmi; desetinné číslo násob převodním číslem.',
            'A quarter is the whole divided by four; multiply a decimal by the conversion factor.',
          ),
        ],
        solution: [step(working.cs, working.en)],
      };
    },
  }),

  // ------------------------------------------------------------------------------- tables
  gen({
    id: 'data.tables-charts.read',
    concept: 'data.tables-charts',
    kind: 'core',
    levels: [1, 2, 3],
    title: L('Čtení z tabulky', 'Reading a table'),
    est: (lv) => 45 + 30 * lv,
    make(r, lv) {
      const { rows, tex } = classTable(r);
      const boys = rows.reduce((sum, row) => sum + row.boys, 0);
      const girls = rows.reduce((sum, row) => sum + row.girls, 0);
      if (lv === 1) {
        const row = r.pick(rows);
        return {
          prompt: L(
            `${intro(tex).cs} Kolik žáků se přihlásilo ze třídy ${row.name}?`,
            `${intro(tex).en} How many pupils of class ${row.name} signed up?`,
          ),
          answer: { kind: 'number', value: ans(row.boys + row.girls) },
          hints: [
            L(`Najdi řádek třídy ${row.name}.`, `Find the row of class ${row.name}.`),
            L('Sečti chlapce a dívky v tom řádku.', 'Add the boys and the girls of that row.'),
          ],
          solution: [
            step(`Řádek ${row.name}:`, `Row ${row.name}:`, `${row.boys} + ${row.girls} = ${row.boys + row.girls}`),
          ],
          misconceptions: [mc(ans(row.boys), 'misread', 'To jsou jen chlapci.', 'Those are only the boys.')],
          verify: [{ kind: 'value', expr: `${row.boys}+${row.girls}` }],
        };
      }
      if (lv === 2) {
        const more = boys >= girls;
        const diff = Math.abs(boys - girls);
        return {
          prompt: L(
            `${intro(tex).cs} O kolik se liší celkový počet přihlášených chlapců a celkový počet přihlášených dívek?`,
            `${intro(tex).en} By how many do the total number of boys and the total number of girls differ?`,
          ),
          answer: { kind: 'number', value: ans(diff) },
          hints: [
            L(
              'Sečti zvlášť sloupec chlapců a zvlášť sloupec dívek.',
              'Add up the column of boys and the column of girls separately.',
            ),
            L(`Chlapců je ${boys}, dívek ${girls}.`, `There are ${boys} boys and ${girls} girls.`),
          ],
          solution: [
            step(
              'Součty sloupců:',
              'The column totals:',
              `${rows.map((x) => x.boys).join(' + ')} = ${boys}, \\quad ${rows.map((x) => x.girls).join(' + ')} = ${girls}`,
            ),
            step('Rozdíl:', 'The difference:', `${more ? boys : girls} - ${more ? girls : boys} = ${diff}`),
          ],
          misconceptions: [
            mc(
              ans(boys + girls),
              'misread',
              'To je součet. Otázka se ptá na rozdíl.',
              'That is the sum. The question asks for the difference.',
            ),
          ],
          verify: [{ kind: 'value', expr: `abs(${boys}-(${girls}))` }],
        };
      }
      const totals = rows.map((row) => ({ name: row.name, total: row.boys + row.girls }));
      const most = totals.reduce((a, b) => (b.total > a.total ? b : a));
      const whole = boys + girls;
      const others = whole - most.total;
      return {
        prompt: L(
          `${intro(tex).cs} Kolik žáků se přihlásilo ze všech ostatních tříd dohromady, když nepočítáme třídu s největším počtem přihlášených?`,
          `${intro(tex).en} How many pupils signed up from all the other classes together, leaving out the class with the most sign-ups?`,
        ),
        answer: { kind: 'number', value: ans(others) },
        hints: [
          L(
            'Nejdřív spočítej, kolik žáků se přihlásilo z každé třídy.',
            'First work out how many pupils of each class signed up.',
          ),
          L(`Nejvíc přihlášených má ${most.name}: ${most.total}.`, `${most.name} has the most: ${most.total}.`),
        ],
        solution: [
          step('Součty po třídách:', 'The totals by class:', totals.map((x) => `${x.total}`).join(',\\ ')),
          step(
            'Všichni bez nejpočetnější třídy:',
            'Everyone except the largest class:',
            `${whole} - ${most.total} = ${others}`,
          ),
        ],
        misconceptions: [
          mc(
            ans(whole),
            'misread',
            'To jsou všichni přihlášení. Jedna třída se neměla počítat.',
            'That is everyone. One class was to be left out.',
          ),
        ],
        verify: [{ kind: 'value', expr: `${whole}-${most.total}` }],
      };
    },
  }),

  gen({
    id: 'data.tables-charts.statements',
    concept: 'data.tables-charts',
    kind: 'graph',
    levels: [1, 2, 3],
    title: L('Tvrzení o tabulce', 'Statements about a table'),
    tags: ['tf'],
    est: (lv) => 40 + 20 * lv,
    make(r, lv) {
      const { rows, tex } = classTable(r);
      const boys = rows.reduce((sum, row) => sum + row.boys, 0);
      const girls = rows.reduce((sum, row) => sum + row.girls, 0);
      const whole = boys + girls;
      const truth = r.bool();
      let statement: L;
      let reason: L;
      if (lv === 1) {
        const candidates = rows.filter((x) => x.boys !== x.girls);
        const row = candidates.length > 0 ? r.pick(candidates) : rows[0]!;
        const boysMore = row.boys > row.girls;
        const sayBoys = truth === boysMore;
        statement = L(
          `Ze třídy ${row.name} se přihlásilo více ${sayBoys ? 'chlapců než dívek' : 'dívek než chlapců'}.`,
          `More ${sayBoys ? 'boys than girls' : 'girls than boys'} of class ${row.name} signed up.`,
        );
        reason = L(
          `Ve třídě ${row.name}: ${row.boys} chlapců a ${row.girls} dívek.`,
          `In class ${row.name}: ${row.boys} boys and ${row.girls} girls.`,
        );
        if (candidates.length === 0) {
          statement = L(
            `Ze třídy ${row.name} se přihlásilo stejně chlapců jako dívek.`,
            `As many boys as girls of class ${row.name} signed up.`,
          );
          return {
            prompt: L(
              `${intro(tex).cs} Rozhodněte, zda platí: ${statement.cs}`,
              `${intro(tex).en} Decide whether this is true: ${statement.en}`,
            ),
            answer: trueFalse(true),
            hints: [
              L(`Najdi řádek třídy ${row.name}.`, `Find the row of class ${row.name}.`),
              L('Porovnej obě čísla v řádku.', 'Compare the two numbers of the row.'),
            ],
            solution: [step(reason.cs, reason.en)],
          };
        }
      } else if (lv === 2) {
        const claimed = truth ? whole : whole + r.pick([-3, -2, 2, 3]);
        statement = L(
          `Na sportovní den se celkem přihlásilo právě ${claimed} žáků.`,
          `Exactly ${claimed} pupils signed up for the sports day in all.`,
        );
        reason = L(
          `Chlapců je ${boys}, dívek ${girls}, dohromady ${whole}.`,
          `There are ${boys} boys and ${girls} girls, ${whole} together.`,
        );
      } else {
        // Girls as a share of everyone, against a round percentage.
        const share = (girls / whole) * 100;
        const bound = truth
          ? Math.floor(share / 5) * 5 - (share % 5 === 0 ? 5 : 0)
          : Math.ceil(share / 5) * 5 + (share % 5 === 0 ? 5 : 0);
        statement = L(
          `Dívky tvoří více než ${bound} % všech přihlášených.`,
          `Girls make up more than ${bound} % of all who signed up.`,
        );
        reason = L(
          `Dívek je ${girls} z ${whole}, tedy asi ${csT(Math.round(share * 10) / 10)} %.`,
          `There are ${girls} girls out of ${whole}, about ${enT(Math.round(share * 10) / 10)} %.`,
        );
      }
      return {
        prompt: L(
          `${intro(tex).cs} Rozhodněte, zda platí: ${statement.cs}`,
          `${intro(tex).en} Decide whether this is true: ${statement.en}`,
        ),
        answer: trueFalse(truth),
        hints: [
          L(
            'Vypiš si z tabulky čísla, o kterých tvrzení mluví.',
            'Write down the numbers of the table that the statement talks about.',
          ),
          lv === 3
            ? L(
                'Kolik je 10 % ze všech přihlášených? Odtud odhadneš i ostatní procenta.',
                'How much is 10 % of everyone who signed up? From there you can estimate the other percentages.',
              )
            : L(
                'Spočítej to sám a teprve pak porovnej s tvrzením.',
                'Work it out yourself and only then compare with the statement.',
              ),
        ],
        solution: [
          step(reason.cs, reason.en),
          step(
            truth ? 'Tvrzení platí.' : 'Tvrzení neplatí.',
            truth ? 'The statement is true.' : 'The statement is not true.',
          ),
        ],
      };
    },
  }),

  // --------------------------------------------------------------------------------- mean
  gen({
    id: 'data.mean.compute',
    concept: 'data.mean',
    kind: 'core',
    levels: [1, 2, 3],
    title: L('Aritmetický průměr', 'The arithmetic mean'),
    est: (lv) => 45 + 30 * lv,
    make(r, lv) {
      if (lv === 1) {
        const n = r.pick([4, 5]);
        const mean = r.int(12, 30);
        const values = Array.from({ length: n - 1 }, () => mean + r.int(-6, 6));
        values.push(mean * n - values.reduce((a, b) => a + b, 0));
        const shuffled = r.shuffle(values);
        return {
          prompt: L(
            `Za ${n} ${plural(n, 'den', 'dny', 'dní')} ujel cyklista tyto vzdálenosti v km: ${shuffled.join(', ')}. Kolik kilometrů ujel průměrně za den?`,
            `In ${n} days a cyclist rode these distances in km: ${shuffled.join(', ')}. How many kilometres did he ride per day on average?`,
          ),
          answer: { kind: 'number', value: ans(mean) },
          hints: [
            L(
              'Průměr je součet všech hodnot dělený jejich počtem.',
              'The mean is the sum of all the values divided by how many there are.',
            ),
            L(`Součet je ${mean * n}.`, `The sum is ${mean * n}.`),
          ],
          solution: [
            step('Součet:', 'The sum:', `${shuffled.join(' + ')} = ${mean * n}`),
            step('Průměr:', 'The mean:', L(`${mean * n} : ${n} = ${mean}`, `${mean * n} \\div ${n} = ${mean}`)),
          ],
          misconceptions: [
            mc(
              ans(mean * n),
              'incomplete',
              'To je součet. Ještě ho vyděl počtem dní.',
              'That is the sum. It still has to be divided by the number of days.',
            ),
          ],
          verify: [{ kind: 'value', expr: `(${shuffled.join('+')})/${n}` }],
          context: { applied: true },
        };
      }
      if (lv === 2) {
        // Marks 1–4 of twenty pupils.
        const c1 = r.int(3, 7);
        const c2 = r.int(4, 8);
        const c4 = r.int(0, 3);
        const c3 = 20 - c1 - c2 - c4;
        const sum = c1 + 2 * c2 + 3 * c3 + 4 * c4;
        const mean = sum / 20;
        const head = ['známka', '1', '2', '3', '4'];
        const body = [[`${c1}`, `${c2}`, `${c3}`, `${c4}`]];
        return {
          prompt: L(
            `Písemku psalo 20 žáků. Tabulka udává, kolik žáků dostalo jednotlivé známky. ${table(head, [['počet žáků', ...body[0]!]])} Jaký je aritmetický průměr známek?`,
            `Twenty pupils sat a test. The table shows how many pupils got each mark. ${table(['mark', '1', '2', '3', '4'], [['pupils', ...body[0]!]])} What is the arithmetic mean of the marks?`,
          ),
          answer: { kind: 'number', value: ans(mean) },
          hints: [
            L(
              'Každou známku vynásob počtem žáků, kteří ji dostali, a součiny sečti.',
              'Multiply each mark by the number of pupils who got it, and add the products.',
            ),
            L(`Součet všech známek je ${sum}.`, `The sum of all the marks is ${sum}.`),
          ],
          solution: [
            step(
              'Součet známek:',
              'The sum of the marks:',
              `1 \\cdot ${c1} + 2 \\cdot ${c2} + 3 \\cdot ${c3} + 4 \\cdot ${c4} = ${sum}`,
            ),
            step(
              'Průměr:',
              'The mean:',
              both((n, czech) => `${sum} ${czech ? ':' : '\\div'} 20 = ${n(mean)}`),
            ),
          ],
          misconceptions: [
            mc(
              ans(2.5),
              'concept',
              'Průměr známek 1 až 4 by to byl jen tehdy, kdyby každou dostalo stejně žáků.',
              'That would be the mean of the marks 1 to 4 only if each were given equally often.',
            ),
          ],
          verify: [{ kind: 'value', expr: `(${c1}+2*${c2}+3*${c3}+4*${c4})/20` }],
          context: { applied: true },
        };
      }
      const n = r.pick([4, 5]);
      const mean = r.int(14, 28);
      const known = Array.from({ length: n - 1 }, () => mean + r.int(-5, 5));
      const missing = mean * n - known.reduce((a, b) => a + b, 0);
      return {
        prompt: L(
          `Průměr ${n === 4 ? 'čtyř' : 'pěti'} čísel je ${mean}. ${n === 4 ? 'Tři' : 'Čtyři'} z nich jsou ${known.join(', ')}. Určete zbývající číslo.`,
          `The mean of ${n === 4 ? 'four' : 'five'} numbers is ${mean}. ${n === 4 ? 'Three' : 'Four'} of them are ${known.join(', ')}. Find the remaining number.`,
        ),
        answer: { kind: 'number', value: ans(missing) },
        hints: [
          L('Z průměru a počtu čísel zjistíš jejich součet.', 'The mean and the count give you the sum.'),
          L(
            `Součet všech ${n} čísel je $${mean} \\cdot ${n} = ${mean * n}$.`,
            `The sum of all ${n} numbers is $${mean} \\cdot ${n} = ${mean * n}$.`,
          ),
        ],
        solution: [
          step('Součet všech čísel:', 'The sum of all the numbers:', `${mean} \\cdot ${n} = ${mean * n}`),
          step('Zbývající číslo:', 'The remaining number:', `${mean * n} - (${known.join(' + ')}) = ${missing}`),
        ],
        misconceptions: [
          mc(
            ans(mean),
            'concept',
            'Chybějící číslo nemusí být rovno průměru.',
            'The missing number need not equal the mean.',
          ),
        ],
        verify: [{ kind: 'value', expr: `${mean}*${n}-(${known.join('+')})` }],
      };
    },
  }),

  gen({
    id: 'data.mean.choice',
    concept: 'data.mean',
    kind: 'applied',
    levels: [2, 3],
    title: L('Průměr – výběr odpovědi', 'The mean – choose the answer'),
    tags: ['mc5'],
    est: (lv) => 70 + 30 * lv,
    make(r, lv) {
      if (lv === 2) {
        const n = r.pick([4, 5]);
        const mean = r.int(140, 160);
        const newMean = mean + r.pick([1, 2, -1, -2]);
        const added = newMean * (n + 1) - mean * n;
        const built = numericChoice(r, added, [newMean, mean, added - (n + 1), added + n], (v) =>
          L(`${v} cm`, `${v} cm`),
        );
        return {
          prompt: L(
            `Průměrná výška ${n} dětí je ${mean} cm. Když se k nim přidá další dítě, průměrná výška všech je ${newMean} cm. Kolik centimetrů měří dítě, které se přidalo?`,
            `The mean height of ${n} children is ${mean} cm. When another child joins them, the mean height of all is ${newMean} cm. How tall is the child who joined, in centimetres?`,
          ),
          answer: built.spec,
          hints: [
            L(
              'Z průměru a počtu dětí spočítej součet výšek před a po.',
              'From the mean and the number of children work out the sum of the heights before and after.',
            ),
            L(
              `Před: $${mean} \\cdot ${n} = ${mean * n}$, po: $${newMean} \\cdot ${n + 1} = ${newMean * (n + 1)}$.`,
              `Before: $${mean} \\cdot ${n} = ${mean * n}$, after: $${newMean} \\cdot ${n + 1} = ${newMean * (n + 1)}$.`,
            ),
          ],
          solution: [
            step(
              'Součty výšek:',
              'The sums of the heights:',
              `${mean} \\cdot ${n} = ${mean * n}, \\quad ${newMean} \\cdot ${n + 1} = ${newMean * (n + 1)}`,
            ),
            step(
              'Rozdíl je výška nového dítěte:',
              'The difference is the new child’s height:',
              `${newMean * (n + 1)} - ${mean * n} = ${added}`,
            ),
          ],
          misconceptions: [built.idOf(newMean)].flatMap((id) =>
            id
              ? [
                  mc(
                    id,
                    'concept',
                    'Nový průměr není výška nového dítěte: to dítě muselo průměr posunout.',
                    'The new mean is not the new child’s height: that child had to shift the mean.',
                  ),
                ]
              : [],
          ),
          context: { applied: true },
        };
      }
      // Two groups of different sizes whose joint mean is whole — and not the mean of the means.
      let first = 0;
      let second = 0;
      let m1 = 0;
      let realM2 = 0;
      for (let i = 0; i < 200; i++) {
        first = r.int(3, 7);
        second = r.int(3, 7);
        m1 = r.pick([60, 64, 70, 72, 80]);
        realM2 = r.pick([56, 65, 75, 84, 90]);
        if (first !== second && m1 !== realM2 && (first * m1 + second * realM2) % (first + second) === 0) break;
      }
      const joint = (first * m1 + second * realM2) / (first + second);
      const built = numericChoice(r, joint, [(m1 + realM2) / 2, m1, realM2, joint + 1], (v) =>
        L(`${v} bodů`, `${v} points`),
      );
      return {
        prompt: L(
          `První skupina má ${first} členů a jejich průměrný výsledek je ${m1} bodů. Druhá skupina má ${second} členů s průměrem ${realM2} bodů. Jaký je průměrný výsledek všech dohromady?`.replace(
            / ([34]) členů/g,
            ' $1 členy',
          ),
          `The first group has ${first} pupils with a mean result of ${m1} points. The second group has ${second} pupils with a mean of ${realM2} points. What is the mean result of all the pupils together?`,
        ),
        answer: built.spec,
        hints: [
          L(
            'Průměry dvou různě velkých skupin nejde jen zprůměrovat. Počítej se součty bodů.',
            'The means of two groups of different sizes cannot simply be averaged. Work with the sums of points.',
          ),
          L(
            `Součty: $${first} \\cdot ${m1} = ${first * m1}$ a $${second} \\cdot ${realM2} = ${second * realM2}$.`,
            `The sums: $${first} \\cdot ${m1} = ${first * m1}$ and $${second} \\cdot ${realM2} = ${second * realM2}$.`,
          ),
        ],
        solution: [
          step(
            'Všechny body:',
            'All the points:',
            `${first * m1} + ${second * realM2} = ${first * m1 + second * realM2}`,
          ),
          step(
            'Děleno počtem všech žáků:',
            'Divided by the number of all the pupils:',
            L(
              `${first * m1 + second * realM2} : ${first + second} = ${joint}`,
              `${first * m1 + second * realM2} \\div ${first + second} = ${joint}`,
            ),
          ),
        ],
        misconceptions: [built.idOf((m1 + realM2) / 2)].flatMap((id) =>
          id
            ? [
                mc(
                  id,
                  'concept',
                  'Průměr průměrů platí jen pro stejně velké skupiny.',
                  'The mean of the means works only for groups of the same size.',
                ),
              ]
            : [],
        ),
        context: { applied: true },
      };
    },
  }),
];
