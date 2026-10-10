import { L, intervalIn, intervalL, polyIn, polyTex, setL, type Generator } from '@lemma/core';
import { HINT, gen, leadIn, leadTex, mapL, mc, nz, plural, shiftIn, shiftTex, step, tailIn, tailTex } from './helpers';

/** Syllabus topic 5: power functions — natural, negative and fractional exponents. */
export const POWER_GENERATORS: Generator[] = [
  gen({
    id: 'pow.natural.properties',
    concept: 'pow.natural',
    kind: 'warmup',
    levels: [1, 2],
    title: L('Sudý a lichý exponent', 'Even and odd exponents'),
    est: (lv) => 25 + 15 * lv,
    make(r, lv) {
      const n = r.int(2, 7);
      const even = n % 2 === 0;
      if (lv === 1 && r.bool()) {
        return {
          prompt: L(`Funkce $f(x) = x^{${n}}$ je:`, `The function $f(x) = x^{${n}}$ is:`),
          answer: {
            kind: 'choice',
            fixedOrder: true,
            options: [
              {
                id: 'even',
                text: L('sudá — graf je souměrný podle osy $y$', 'even — its graph is symmetric about the $y$-axis'),
              },
              {
                id: 'odd',
                text: L('lichá — graf je souměrný podle počátku', 'odd — its graph is symmetric about the origin'),
              },
              { id: 'neither', text: L('ani sudá, ani lichá', 'neither even nor odd') },
            ],
            correct: [even ? 'even' : 'odd'],
          },
          hints: [
            L(
              'Porovnej $f(-x)$ s $f(x)$. Co udělá minus uvnitř mocniny?',
              'Compare $f(-x)$ with $f(x)$. What does the minus do inside the power?',
            ),
            L(
              `$(-x)^{${n}} = ${even ? '' : '-'}x^{${n}}$, protože záporné číslo se násobí ${even ? 'sudý' : 'lichý'} počet krát.`,
              `$(-x)^{${n}} = ${even ? '' : '-'}x^{${n}}$, because the negative factor appears an ${even ? 'even' : 'odd'} number of times.`,
            ),
          ],
          solution: [
            step(
              `$f(-x) = (-x)^{${n}} = ${even ? '' : '-'}x^{${n}} = ${even ? '' : '-'}f(x)$.`,
              `$f(-x) = (-x)^{${n}} = ${even ? '' : '-'}x^{${n}} = ${even ? '' : '-'}f(x)$.`,
            ),
            step(
              even
                ? 'Funkce je sudá. Tak ostatně dostala jméno: sudý exponent.'
                : 'Funkce je lichá — stejně jako exponent.',
              even
                ? 'The function is even. That is where the name comes from: an even exponent.'
                : 'The function is odd — just like the exponent.',
            ),
          ],
          misconceptions: [
            mc(
              even ? 'odd' : 'even',
              'concept',
              'Rozhoduje parita exponentu: sudý exponent znaménko smaže, lichý ho zachová.',
              'The parity of the exponent decides: an even exponent erases the sign, an odd one keeps it.',
            ),
          ],
        };
      }
      if (lv === 1) {
        const value = even ? intervalIn(0, 'inf', true, false) : 'R';
        return {
          prompt: L(`Určete obor hodnot funkce $f(x) = x^{${n}}$.`, `Find the range of $f(x) = x^{${n}}$.`),
          answer: { kind: 'interval', value, label: 'H(f) =' },
          hints: [
            L(
              'Může $f(x)$ vyjít záporně? Zkus dosadit záporné číslo.',
              'Can $f(x)$ come out negative? Try substituting a negative number.',
            ),
            even
              ? L(
                  'Sudá mocnina libovolného čísla je nezáporná; nulu dá $x = 0$.',
                  'An even power of any number is non-negative; $x = 0$ gives zero.',
                )
              : L(
                  'Lichá mocnina zachovává znaménko a roste bez omezení na obě strany.',
                  'An odd power keeps the sign and grows without bound in both directions.',
                ),
          ],
          solution: [
            step(
              even
                ? `Sudá mocnina je vždy $\\ge 0$, hodnoty $0$ dosáhne v $x = 0$ a shora omezená není.`
                : 'Lichá mocnina nabývá záporných i kladných hodnot a není omezená shora ani zdola.',
              even
                ? `An even power is always $\\ge 0$, it reaches $0$ at $x = 0$ and has no upper bound.`
                : 'An odd power takes negative and positive values and is unbounded both ways.',
              mapL(even ? intervalL(0, 'inf', true, false) : L('\\mathbb{R}', '\\mathbb{R}'), (iv) => `H(f) = ${iv}`),
            ),
          ],
          misconceptions: even
            ? [
                mc('R', 'concept', 'Sudá mocnina nemůže být záporná.', 'An even power cannot be negative.'),
                mc(
                  intervalIn(0, 'inf', false, false),
                  'notation',
                  'Nula do oboru hodnot patří: $f(0) = 0$.',
                  'Zero belongs to the range: $f(0) = 0$.',
                ),
              ]
            : [
                mc(
                  intervalIn(0, 'inf', true, false),
                  'concept',
                  'Lichá mocnina záporného čísla je záporná.',
                  'An odd power of a negative number is negative.',
                ),
              ],
          verify: [{ kind: 'range', expr: `x^${n}`, over: [-30, 30] }],
        };
      }
      // Level 2: how many real solutions does x^n = c have?
      const c = r.pick([-32, -9, -1, 0, 1, 5, 16, 100]);
      const count = even ? (c > 0 ? 2 : c === 0 ? 1 : 0) : 1;
      return {
        prompt: L(
          `Kolik reálných řešení má rovnice $x^{${n}} = ${c}$?`,
          `How many real solutions does $x^{${n}} = ${c}$ have?`,
        ),
        answer: {
          kind: 'choice',
          fixedOrder: true,
          options: [
            { id: '0', text: L('žádné', 'none') },
            { id: '1', text: L('jedno', 'one') },
            { id: '2', text: L('dvě', 'two') },
          ],
          correct: [`${count}`],
        },
        hints: [
          L(
            `Představ si graf $y = x^{${n}}$ a vodorovnou přímku $y = ${c}$. Kolikrát se protnou?`,
            `Picture the graph of $y = x^{${n}}$ and the horizontal line $y = ${c}$. How many times do they meet?`,
          ),
          even
            ? L(
                'Graf sudé mocniny má tvar U: nad osou dva průsečíky, pod osou žádný.',
                'The graph of an even power is U-shaped: two intersections above the axis, none below.',
              )
            : L(
                'Graf liché mocniny stále roste, takže každou vodorovnou přímku protne právě jednou.',
                'The graph of an odd power keeps rising, so it meets every horizontal line exactly once.',
              ),
        ],
        solution: [
          step(
            even
              ? c > 0
                ? `Sudá mocnina: kladnou hodnotu dá kladné i záporné $x$. Dvě řešení, $x = \\pm\\sqrt[${n}]{${c}}$.`
                : c === 0
                  ? 'Nulu dá jen $x = 0$. Jedno řešení.'
                  : 'Sudá mocnina nemůže být záporná. Žádné řešení.'
              : `Lichá mocnina je rostoucí na celém $\\mathbb{R}$ a nabývá všech hodnot. Právě jedno řešení.`,
            even
              ? c > 0
                ? `An even power: both a positive and a negative $x$ give a positive value. Two solutions, $x = \\pm\\sqrt[${n}]{${c}}$.`
                : c === 0
                  ? 'Only $x = 0$ gives zero. One solution.'
                  : 'An even power cannot be negative. No solution.'
              : `An odd power is increasing on all of $\\mathbb{R}$ and takes every value. Exactly one solution.`,
          ),
        ],
        misconceptions: [
          ...(even && c > 0
            ? [
                mc(
                  '1',
                  'incomplete',
                  'Chybí záporné řešení: sudá mocnina dává stejnou hodnotu pro $x$ i $-x$.',
                  'The negative solution is missing: an even power gives the same value for $x$ and $-x$.',
                ),
              ]
            : []),
          ...(!even && c < 0
            ? [
                mc(
                  '0',
                  'concept',
                  'Lichá mocnina záporného čísla je záporná, takže řešení existuje.',
                  'An odd power of a negative number is negative, so a solution exists.',
                ),
              ]
            : []),
          ...(!even && c > 0
            ? [
                mc(
                  '2',
                  'concept',
                  'U liché mocniny dá záporné $x$ zápornou hodnotu — řešení je jen jedno.',
                  'With an odd power a negative $x$ gives a negative value — there is only one solution.',
                ),
              ]
            : []),
        ],
      };
    },
  }),

  gen({
    id: 'pow.natural.equation',
    concept: 'pow.natural',
    kind: 'core',
    levels: [1, 2, 3],
    title: L('Rovnice $x^n = c$', 'The equation $x^n = c$'),
    tags: ['annual-review'],
    est: (lv) => 35 + 25 * lv,
    make(r, lv) {
      const n = lv === 1 ? r.pick([2, 3]) : r.pick([3, 4, 5, 6]);
      const even = n % 2 === 0;
      const base = n >= 5 ? r.pick([1, 2]) : r.int(1, n === 4 ? 3 : 5);
      // Sometimes an even power is set equal to a negative number: no solution.
      const impossible = even && lv >= 2 && r.bool(0.2);
      const t = even ? base : base * r.sign();
      const c = impossible ? -(base ** n) : t ** n;
      const a = lv === 3 ? r.pick([1, 2, 3, -1]) : 1;
      const m = lv === 3 ? nz(r, -4, 4) : 0;
      const lhsTex = `${leadTex(a)}${m === 0 ? 'x' : `(${shiftTex(m)})`}^{${n}}`;
      const lhsIn = `${leadIn(a)}(${shiftIn(m)})^${n}`;
      const rhs = a * c;
      const roots = impossible ? [] : even ? [m - base, m + base] : [m + t];
      const inner = m === 0 ? 'x' : shiftTex(m);
      return {
        prompt: L(`Řešte v $\\mathbb{R}$: $${lhsTex} = ${rhs}$`, `Solve in $\\mathbb{R}$: $${lhsTex} = ${rhs}$`),
        answer: { kind: 'set', values: roots.map(String), label: 'K =', placeholder: '{-2; 2}' },
        hints: [
          lv === 3
            ? L(
                `Nejdřív osamostatni mocninu${a === 1 ? '' : `: vyděl číslem $${a}$`}. Závorku ber jako jednu neznámou.`,
                `First isolate the power${a === 1 ? '' : `: divide by $${a}$`}. Treat the bracket as a single unknown.`,
              )
            : L(
                `Které číslo dá po umocnění na ${n}. číslo $${c}$?`,
                `Which number raised to the power ${n} gives $${c}$?`,
              ),
          even
            ? L(
                'Exponent je sudý: mysli na obě znaménka — a na to, jestli pravá strana vůbec může vyjít.',
                'The exponent is even: think of both signs — and of whether the right-hand side is possible at all.',
              )
            : L(
                'Exponent je lichý: řešení je jedno a má stejné znaménko jako pravá strana.',
                'The exponent is odd: there is one solution, with the same sign as the right-hand side.',
              ),
        ],
        solution: [
          ...(a !== 1
            ? [step(`Vydělíme $${a}$:`, `Divide by $${a}$:`, `${m === 0 ? 'x' : `(${shiftTex(m)})`}^{${n}} = ${c}`)]
            : []),
          impossible
            ? step(
                'Sudá mocnina reálného čísla není nikdy záporná, rovnice nemá řešení.',
                'An even power of a real number is never negative; the equation has no solution.',
                'K = \\emptyset',
              )
            : even
              ? step(
                  `Sudý exponent: $${inner}$ může být kladné i záporné.`,
                  `Even exponent: $${inner}$ may be positive or negative.`,
                  `${inner} = \\pm ${base}`,
                )
              : step(`Lichý exponent: jediné řešení.`, `Odd exponent: a single solution.`, `${inner} = ${t}`),
          ...(impossible
            ? []
            : [
                step(
                  m === 0 ? 'Množina řešení:' : 'Dopočítáme $x$:',
                  m === 0 ? 'Solution set:' : 'Solve for $x$:',
                  mapL(setL(roots), (set) => `K = ${set}`),
                ),
              ]),
        ],
        misconceptions: [
          ...(even && !impossible
            ? [
                mc(
                  `${m + base}`,
                  'incomplete',
                  'U sudé mocniny existuje i druhé řešení s opačným znaménkem.',
                  'With an even power there is a second solution with the opposite sign.',
                ),
              ]
            : []),
          ...(impossible
            ? [
                mc(
                  `${m - base}; ${m + base}`,
                  'concept',
                  'Sudá mocnina nemůže vyjít záporně — rovnice řešení nemá.',
                  'An even power cannot come out negative — there is no solution.',
                ),
              ]
            : []),
          ...(!even && t < 0
            ? [
                mc(
                  '{}',
                  'concept',
                  'Lichá mocnina záporného čísla je záporná, řešení existuje.',
                  'An odd power of a negative number is negative; a solution exists.',
                ),
              ]
            : []),
          ...(!even
            ? [
                mc(
                  `${m - t}; ${m + t}`,
                  'concept',
                  'Lichá mocnina zachovává znaménko: řešení je jen jedno.',
                  'An odd power keeps the sign: there is only one solution.',
                ),
              ]
            : []),
          ...(m !== 0 && !impossible
            ? [
                mc(
                  even ? `${-base}; ${base}` : `${t}`,
                  'incomplete',
                  `To je hodnota závorky. Ještě je potřeba dopočítat $x$ z $${shiftTex(m)}$.`,
                  `That is the value of the bracket. You still have to find $x$ from $${shiftTex(m)}$.`,
                ),
              ]
            : []),
        ],
        verify: [{ kind: 'roots', expr: `${lhsIn}-(${rhs})` }],
      };
    },
  }),

  gen({
    id: 'pow.negative.function',
    concept: 'pow.negative',
    kind: 'core',
    levels: [1, 2, 3],
    title: L('Funkce $y = k/x^n$', 'The function $y = k/x^n$'),
    est: (lv) => 35 + 25 * lv,
    make(r, lv) {
      const n = r.pick([1, 2, 3]);
      if (lv === 1) {
        const x0 = n === 3 ? r.pick([-2, -1, 1, 2]) : nz(r, -4, 4);
        const value = nz(r, -5, 5);
        const k = value * x0 ** n;
        const fTex = `\\dfrac{${k}}{x${n === 1 ? '' : `^{${n}}`}}`;
        return {
          prompt: L(
            `Je dána funkce $f(x) = ${fTex}$. Vypočítejte $f(${x0})$.`,
            `Let $f(x) = ${fTex}$. Compute $f(${x0})$.`,
          ),
          answer: { kind: 'number', value: `${value}`, label: `f(${x0}) =` },
          hints: [
            HINT.brackets,
            L(
              `Nejdřív spočítej jmenovatel: $(${x0})^{${n}}$. Jaké má znaménko?`,
              `Work out the denominator first: $(${x0})^{${n}}$. What is its sign?`,
            ),
          ],
          solution: [
            step(
              'Dosadíme, záporné číslo v závorce:',
              'Substitute, with the negative number in brackets:',
              `f(${x0}) = \\frac{${k}}{(${x0})^{${n}}} = \\frac{${k}}{${x0 ** n}} = ${value}`,
            ),
          ],
          misconceptions: [
            mc(
              `${-value}`,
              'sign',
              `Zkontroluj znaménko mocniny $(${x0})^{${n}}$.`,
              `Check the sign of the power $(${x0})^{${n}}$.`,
            ),
          ],
          verify: [{ kind: 'value', expr: `${k}/x^${n}`, env: { x: x0 } }],
        };
      }
      const k = nz(r, -6, 6);
      const m = nz(r, -5, 5);
      const expr = `${k}/(${shiftIn(m)})^${n}`;
      const fTex = `\\dfrac{${k}}{${n === 1 ? shiftTex(m) : `(${shiftTex(m)})^{${n}}`}}`;
      if (lv === 2) {
        return {
          prompt: L(`Určete definiční obor funkce $f(x) = ${fTex}$.`, `Find the domain of $f(x) = ${fTex}$.`),
          answer: { kind: 'interval', value: `R \\ {${m}}`, label: 'D(f) =', placeholder: 'R \\ {2}' },
          hints: [
            HINT.conditions,
            L(
              'Jmenovatel nesmí být nula. Pro které $x$ by nula vyšla?',
              'The denominator must not be zero. For which $x$ would it be?',
            ),
          ],
          solution: [
            step(
              'Podmínka: jmenovatel je různý od nuly.',
              'Condition: the denominator is non-zero.',
              `${shiftTex(m)} \\ne 0 \\;\\Rightarrow\\; x \\ne ${m}`,
            ),
            step('Definiční obor:', 'Domain:', `D(f) = \\mathbb{R} \\setminus \\{${m}\\}`),
          ],
          misconceptions: [
            mc(
              `R \\ {${-m}}`,
              'sign',
              `Nula vyjde pro $x = ${m}$, ne pro $x = ${-m}$: řeš $${shiftTex(m)} = 0$.`,
              `The zero occurs at $x = ${m}$, not $x = ${-m}$: solve $${shiftTex(m)} = 0$.`,
            ),
            mc(
              'R',
              'domain',
              'Dělit nulou nelze — jeden bod je potřeba vyloučit.',
              'Division by zero is impossible — one point has to be excluded.',
            ),
            mc(
              'R \\ {0}',
              'misread',
              `Ve jmenovateli není $x$, ale $${shiftTex(m)}$.`,
              `The denominator is not $x$ but $${shiftTex(m)}$.`,
            ),
          ],
          verify: [{ kind: 'domain', expr }],
        };
      }
      // Level 3: the vertical asymptote and the range after a shift up or down.
      const q = nz(r, -4, 4);
      const full = `${fTex}${tailTex(q)}`;
      const even = n % 2 === 0;
      const range = even
        ? k > 0
          ? intervalIn(q, 'inf', false, false)
          : intervalIn('-inf', q, false, false)
        : `R \\ {${q}}`;
      const rangeL = even
        ? k > 0
          ? intervalL(q, 'inf', false, false)
          : intervalL('-inf', q, false, false)
        : L(`\\mathbb{R} \\setminus \\{${q}\\}`, `\\mathbb{R} \\setminus \\{${q}\\}`);
      return {
        prompt: L(`Určete obor hodnot funkce $f(x) = ${full}$.`, `Find the range of $f(x) = ${full}$.`),
        answer: { kind: 'interval', value: range, label: 'H(f) =' },
        hints: [
          L(
            `Začni zlomkem samotným: jakých hodnot nabývá $${fTex}$? Může být nula?`,
            `Start with the fraction alone: which values does $${fTex}$ take? Can it be zero?`,
          ),
          L(
            `Přičtení $${q}$ posune celý graf o $${Math.abs(q)}$ ${q > 0 ? 'nahoru' : 'dolů'} — i vodorovnou asymptotu.`,
            `Adding $${q}$ shifts the whole graph ${Math.abs(q)} ${q > 0 ? 'up' : 'down'} — the horizontal asymptote too.`,
          ),
        ],
        solution: [
          step(
            even
              ? `Zlomek má ${k > 0 ? 'kladný' : 'záporný'} čitatel a kladný jmenovatel: je vždy ${k > 0 ? 'kladný' : 'záporný'}, nule se jen blíží.`
              : 'Zlomek nabývá všech hodnot kromě nuly: nulový čitatel nemá.',
            even
              ? `The fraction has a ${k > 0 ? 'positive' : 'negative'} numerator and a positive denominator: it is always ${k > 0 ? 'positive' : 'negative'} and only approaches zero.`
              : 'The fraction takes every value except zero: its numerator is never zero.',
          ),
          step(
            `Posun o $${q}$: vodorovná asymptota je $y = ${q}$.`,
            `Shifting by $${q}$: the horizontal asymptote is $y = ${q}$.`,
            mapL(rangeL, (iv) => `H(f) = ${iv}`),
          ),
        ],
        misconceptions: [
          mc(
            'R',
            'concept',
            `Hodnoty $${q}$ funkce nikdy nenabude: zlomek není nulový.`,
            `The function never takes the value $${q}$: the fraction is never zero.`,
          ),
          ...(even
            ? [
                mc(
                  `R \\ {${q}}`,
                  'concept',
                  'Sudá mocnina ve jmenovateli je vždy kladná, takže zlomek nemění znaménko.',
                  'An even power in the denominator is always positive, so the fraction never changes sign.',
                ),
              ]
            : []),
          mc(
            even ? (k > 0 ? intervalIn(0, 'inf', false, false) : intervalIn('-inf', 0, false, false)) : 'R \\ {0}',
            'incomplete',
            `Chybí posun: k hodnotám zlomku se ještě přičítá $${q}$.`,
            `The shift is missing: $${q}$ is still added to the values of the fraction.`,
          ),
          mc(
            `R \\ {${m}}`,
            'misread',
            'To je definiční obor. Otázka je na obor hodnot.',
            'That is the domain. The question asks for the range.',
          ),
        ],
        // A 1/x² tail falls within the oracle's tolerance only far out; odd powers decay too slowly to check.
        verify: even ? [{ kind: 'range', expr: `${expr}${tailIn(q)}`, over: [-4000, 4000] }] : [],
      };
    },
  }),

  gen({
    id: 'pow.negative.proportion',
    concept: 'pow.negative',
    kind: 'applied',
    levels: [2, 3],
    title: L('Nepřímá úměrnost v praxi', 'Inverse proportion in practice'),
    est: (lv) => 60 + 20 * lv,
    make(r, lv) {
      // x1 · y1 = x2 · y2 with whole numbers throughout.
      const x2 = r.pick([3, 4, 5, 6, 8]);
      // Different from x2, so that the product always has another divisor to start from.
      const y2 = r.pick([4, 5, 6, 8, 10, 12].filter((value) => value !== x2));
      const product = x2 * y2;
      const divisors = [2, 3, 4, 5, 6, 8, 10, 12].filter((d) => product % d === 0 && d !== x2);
      const x1 = r.pick(divisors);
      const y1 = product / x1;
      const scenario = lv === 3 ? r.pick(['download', 'disk'] as const) : r.pick(['workers', 'speed'] as const);
      const direct = (y1 * x2) / x1;
      const common = {
        answer: { kind: 'number' as const, value: `${y2}` },
        misconceptions: [
          mc(
            `${Number.isInteger(direct) ? direct : `${y1 * x2}/${x1}`}`,
            'concept',
            'To je přímá úměrnost. Tady platí: čím víc jednoho, tím míň druhého — součin zůstává stejný.',
            'That is direct proportion. Here more of one means less of the other — the product stays the same.',
          ),
        ],
        verify: [{ kind: 'value' as const, expr: `${x1}*${y1}/${x2}` }],
        context: { applied: true, it: scenario === 'download' || scenario === 'disk' },
      };
      // The quantities as the problem states them (speeds and link rates in tens).
      const scale = scenario === 'speed' || scenario === 'download' ? 10 : 1;
      const [q1, q2] = [x1 * scale, x2 * scale];
      const solution = (unit: L): ReturnType<typeof step>[] => [
        step(
          'Součin obou veličin se nemění:',
          'The product of the two quantities stays the same:',
          `${q1} \\cdot ${y1} = ${q1 * y1}`,
        ),
        step(
          'Dosadíme novou hodnotu a dopočítáme:',
          'Substitute the new value and solve:',
          mapL(unit, (u) => `${q2} \\cdot y = ${q1 * y1} \\;\\Rightarrow\\; y = ${y2}\\ \\text{${u}}`),
        ),
      ];
      const hints = [
        L(
          'Roste jedna veličina, když druhá klesá? Pak se nemění jejich součin, ne podíl.',
          'Does one quantity grow as the other falls? Then their product is constant, not their ratio.',
        ),
        L(
          `Součin je $${q1} \\cdot ${y1} = ${q1 * y1}$. Čím ho musíš vydělit?`,
          `The product is $${q1} \\cdot ${y1} = ${q1 * y1}$. What do you divide it by?`,
        ),
      ];
      switch (scenario) {
        case 'workers':
          return {
            ...common,
            prompt: L(
              `${q1} ${plural(q1, 'dělník udělá', 'stejně výkonní dělníci udělají', 'stejně výkonných dělníků udělá')} zakázku za ${y1} ${plural(y1, 'den', 'dny', 'dní')}. Za kolik dní by ji ${plural(q2, 'udělal', 'udělali', 'udělalo')} ${q2} ${plural(q2, 'dělník', 'dělníci', 'dělníků')}?`,
              `${q1} equally productive workers finish a job in ${y1} days. How many days would ${q2} workers need?`,
            ),
            hints,
            solution: solution(L(plural(y2, 'den', 'dny', 'dní'), y2 === 1 ? 'day' : 'days')),
          };
        case 'speed':
          return {
            ...common,
            prompt: L(
              `Rychlostí ${q1} km/h trvá cesta ${y1} ${plural(y1, 'hodinu', 'hodiny', 'hodin')}. Jak dlouho by trvala rychlostí ${q2} km/h?`,
              `At ${q1} km/h a journey takes ${y1} hours. How long would it take at ${q2} km/h?`,
            ),
            hints,
            solution: solution(L('h', 'h')),
          };
        case 'download':
          return {
            ...common,
            prompt: L(
              `Záloha se přes linku ${q1} Mbit/s přenese za ${y1} ${plural(y1, 'minutu', 'minuty', 'minut')}. Za kolik minut by se přenesla linkou ${q2} Mbit/s?`,
              `A backup transfers in ${y1} minutes over a ${q1} Mbit/s link. How many minutes would it take over a ${q2} Mbit/s link?`,
            ),
            hints,
            solution: solution(L('min', 'min')),
          };
        case 'disk':
          return {
            ...common,
            prompt: L(
              `Při průměrném zápisu ${q1} GB denně vystačí volné místo na disku na ${y1} ${plural(y1, 'den', 'dny', 'dní')}. Na kolik dní vystačí při ${q2} GB denně?`,
              `At an average of ${q1} GB written per day the free disk space lasts ${y1} days. How many days does it last at ${q2} GB per day?`,
            ),
            hints,
            solution: solution(L(plural(y2, 'den', 'dny', 'dní'), y2 === 1 ? 'day' : 'days')),
          };
      }
    },
  }),

  gen({
    id: 'pow.root.domain',
    concept: 'pow.root',
    kind: 'core',
    levels: [1, 2, 3],
    title: L('Definiční obor výrazu s odmocninou', 'Domain of an expression with a root'),
    tags: ['annual-review'],
    est: (lv) => 40 + 30 * lv,
    make(r, lv) {
      if (lv === 3) {
        const [r1, r2] = [r.int(-6, 0), r.int(1, 6)];
        const inside = r.bool();
        // inside: (x − r1)(r2 − x) ≥ 0 between the roots; otherwise (x − r1)(x − r2) ≥ 0 outside them.
        const coeffs = inside ? [-1, r1 + r2, -r1 * r2] : [1, -(r1 + r2), r1 * r2];
        const radicandTex = polyTex(coeffs);
        const radicandIn = polyIn(coeffs);
        const value = inside
          ? intervalIn(r1, r2, true, true)
          : `${intervalIn('-inf', r1, false, true)} u ${intervalIn(r2, 'inf', true, false)}`;
        const left = intervalL('-inf', r1, false, true);
        const right = intervalL(r2, 'inf', true, false);
        const display = inside
          ? intervalL(r1, r2, true, true)
          : L(`${left.cs} \\cup ${right.cs}`, `${left.en} \\cup ${right.en}`);
        return {
          prompt: L(
            `Určete definiční obor funkce $f(x) = \\sqrt{${radicandTex}}$.`,
            `Find the domain of $f(x) = \\sqrt{${radicandTex}}$.`,
          ),
          answer: { kind: 'interval', value, label: 'D(f) =' },
          hints: [
            L(
              'Pod druhou odmocninou nesmí být záporné číslo. Jakou nerovnici tedy řešíš?',
              'There must be no negative number under a square root. So which inequality are you solving?',
            ),
            L(
              `Kvadratická nerovnice: najdi kořeny ($${r1}$ a $${r2}$) a rozhodni podle toho, kam se parabola otevírá.`,
              `A quadratic inequality: find the roots ($${r1}$ and $${r2}$) and decide by which way the parabola opens.`,
            ),
          ],
          solution: [
            step('Podmínka:', 'Condition:', `${radicandTex} \\ge 0`),
            step(
              `Kořeny jsou $${r1}$ a $${r2}$; parabola se otevírá ${inside ? 'dolů, nezáporná je mezi kořeny' : 'nahoru, nezáporná je vně kořenů'}.`,
              `The roots are $${r1}$ and $${r2}$; the parabola opens ${inside ? 'downwards, so it is non-negative between the roots' : 'upwards, so it is non-negative outside the roots'}.`,
              mapL(display, (iv) => `D(f) = ${iv}`),
            ),
          ],
          misconceptions: [
            mc(
              inside
                ? `${intervalIn('-inf', r1, false, true)} u ${intervalIn(r2, 'inf', true, false)}`
                : intervalIn(r1, r2, true, true),
              'graph',
              'Podívej se, kam se parabola otevírá — interval je obráceně.',
              'Look at which way the parabola opens — the interval is the wrong way round.',
            ),
            mc(
              inside
                ? intervalIn(r1, r2, false, false)
                : `${intervalIn('-inf', r1, false, false)} u ${intervalIn(r2, 'inf', false, false)}`,
              'notation',
              'Odmocnina z nuly existuje, takže krajní body do definičního oboru patří.',
              'The square root of zero exists, so the endpoints belong to the domain.',
            ),
          ],
          verify: [{ kind: 'domain', expr: `sqrt(${radicandIn})` }],
        };
      }
      const a = lv === 1 ? r.pick([1, 2, 3]) : r.pick([1, 2, -1, -2, -3]);
      const bound = nz(r, -5, 5);
      const b = -a * bound;
      const radicandTex = `${leadTex(a)}x${tailTex(b)}`;
      const radicandIn = `${leadIn(a)}x${tailIn(b)}`;
      const below = lv === 2 && r.bool(0.4);
      const closed = !below;
      const value = a > 0 ? intervalIn(bound, 'inf', closed, false) : intervalIn('-inf', bound, false, closed);
      const valueL = a > 0 ? intervalL(bound, 'inf', closed, false) : intervalL('-inf', bound, false, closed);
      const fTex = below ? `\\dfrac{1}{\\sqrt{${radicandTex}}}` : `\\sqrt{${radicandTex}}`;
      const flipped = a > 0 ? intervalIn('-inf', bound, false, closed) : intervalIn(bound, 'inf', closed, false);
      return {
        prompt: L(`Určete definiční obor funkce $f(x) = ${fTex}$.`, `Find the domain of $f(x) = ${fTex}$.`),
        answer: { kind: 'interval', value, label: 'D(f) =', placeholder: '<2; inf)' },
        hints: [
          below
            ? L(
                'Dvě podmínky najednou: pod odmocninou nesmí být záporné číslo a jmenovatel nesmí být nula.',
                'Two conditions at once: nothing negative under the root, and the denominator must not be zero.',
              )
            : L(
                'Pod druhou odmocninou nesmí být záporné číslo. Zapiš to jako nerovnici.',
                'There must be no negative number under a square root. Write that as an inequality.',
              ),
          a < 0
            ? L(
                'Při dělení záporným číslem se znak nerovnosti otáčí.',
                'Dividing by a negative number reverses the inequality sign.',
              )
            : L(`Řeš $${radicandTex} ${below ? '>' : '\\ge'} 0$.`, `Solve $${radicandTex} ${below ? '>' : '\\ge'} 0$.`),
        ],
        solution: [
          step(
            below
              ? 'Odmocnina je ve jmenovateli, takže výraz pod ní musí být kladný:'
              : 'Výraz pod odmocninou musí být nezáporný:',
            below
              ? 'The root is in the denominator, so the expression under it must be positive:'
              : 'The expression under the root must be non-negative:',
            `${radicandTex} ${below ? '>' : '\\ge'} 0`,
          ),
          step(
            a < 0 ? `Dělíme záporným číslem $${a}$, znak se otočí:` : a === 1 ? 'Odtud:' : `Dělíme číslem $${a}$:`,
            a < 0
              ? `Divide by the negative number $${a}$; the sign reverses:`
              : a === 1
                ? 'Hence:'
                : `Divide by $${a}$:`,
            `x ${a > 0 ? (below ? '>' : '\\ge') : below ? '<' : '\\le'} ${bound}`,
          ),
          step(
            'Definiční obor:',
            'Domain:',
            mapL(valueL, (iv) => `D(f) = ${iv}`),
          ),
        ],
        misconceptions: [
          mc(
            a > 0 ? intervalIn(bound, 'inf', !closed, false) : intervalIn('-inf', bound, false, !closed),
            below ? 'domain' : 'notation',
            below
              ? 'Odmocnina je ve jmenovateli: nula pod ní by znamenala dělení nulou.'
              : 'Odmocnina z nuly existuje, krajní bod do definičního oboru patří.',
            below
              ? 'The root is in the denominator: zero under it would mean dividing by zero.'
              : 'The square root of zero exists; the endpoint belongs to the domain.',
          ),
          mc(
            flipped,
            a < 0 ? 'algebra' : 'sign',
            a < 0 ? 'Při dělení záporným číslem se nerovnost otáčí.' : 'Zkontroluj směr nerovnosti.',
            a < 0 ? 'Dividing by a negative number reverses the inequality.' : 'Check the direction of the inequality.',
          ),
          mc(
            a > 0 ? intervalIn(-bound, 'inf', closed, false) : intervalIn('-inf', -bound, false, closed),
            'sign',
            'Znaménková chyba při převádění členu na druhou stranu.',
            'A sign error when moving the term across.',
          ),
          mc(
            'R',
            'domain',
            'Druhá odmocnina ze záporného čísla v reálných číslech neexistuje.',
            'A square root of a negative number does not exist in the reals.',
          ),
        ],
        verify: [{ kind: 'domain', expr: below ? `1/sqrt(${radicandIn})` : `sqrt(${radicandIn})` }],
      };
    },
  }),

  gen({
    id: 'pow.root.equation',
    concept: 'pow.root',
    kind: 'hard',
    levels: [3, 4],
    title: L('Rovnice s odmocninou a zkouška', 'An equation with a root, and the check'),
    est: (lv) => 110 + 40 * (lv - 3),
    make(r, lv) {
      // √(p·x + q) = x − b, built from a root x0 = b + s that really works.
      const p = lv === 3 ? 1 : r.pick([2, 3, 4]);
      const b = r.int(-3, 4);
      const s = r.int(2, 5);
      const x0 = b + s;
      const q = s * s - p * x0;
      const x1 = b + p - s;
      const candidates = [...new Set([x0, x1])].sort((u, v) => u - v);
      const valid = candidates.filter((x) => x - b >= 0);
      const radicandTex = `${leadTex(p)}x${tailTex(q)}`;
      const rhsTex = shiftTex(b);
      const quadratic = polyTex([1, -(2 * b + p), b * b - q]);
      const extraneous = candidates.filter((x) => !valid.includes(x));
      return {
        prompt: L(
          `Řešte v $\\mathbb{R}$: $\\sqrt{${radicandTex}} = ${rhsTex}$`,
          `Solve in $\\mathbb{R}$: $\\sqrt{${radicandTex}} = ${rhsTex}$`,
        ),
        answer: { kind: 'set', values: valid.map(String), label: 'K =' },
        hints: [
          L(
            'Odmocniny se zbavíš umocněním obou stran. Pozor: tím mohou přibýt kořeny, které původní rovnici neřeší.',
            'Squaring both sides removes the root. Careful: that can add roots which do not solve the original equation.',
          ),
          L(
            `Po umocnění: $${radicandTex} = (${rhsTex})^2$. Vyřeš kvadratickou rovnici.`,
            `After squaring: $${radicandTex} = (${rhsTex})^2$. Solve the quadratic.`,
          ),
          L(
            'Každý kořen dosaď do původní rovnice. Odmocnina nemůže vyjít záporně.',
            'Substitute each root into the original equation. A square root cannot come out negative.',
          ),
        ],
        solution: [
          step('Umocníme obě strany:', 'Square both sides:', `${radicandTex} = (${rhsTex})^2`),
          step('Upravíme na kvadratickou rovnici:', 'Rearrange into a quadratic:', `${quadratic} = 0`),
          step(
            'Kořeny kvadratické rovnice:',
            'Roots of the quadratic:',
            candidates.length === 2 ? `x_1 = ${candidates[0]},\\; x_2 = ${candidates[1]}` : `x = ${candidates[0]}`,
          ),
          ...candidates.map((x) =>
            step(
              `Zkouška pro $x = ${x}$: levá strana $\\sqrt{${p * x + q}} = ${Math.sqrt(p * x + q)}$, pravá strana $${x - b}$. ${x - b >= 0 ? 'Vyhovuje.' : 'Nevyhovuje — odmocnina není záporná.'}`,
              `Check for $x = ${x}$: left side $\\sqrt{${p * x + q}} = ${Math.sqrt(p * x + q)}$, right side $${x - b}$. ${x - b >= 0 ? 'It works.' : 'It fails — a square root is not negative.'}`,
            ),
          ),
          step(
            'Množina řešení:',
            'Solution set:',
            mapL(setL(valid), (set) => `K = ${set}`),
          ),
        ],
        misconceptions: [
          ...(extraneous.length > 0
            ? [
                mc(
                  candidates.join('; '),
                  'domain',
                  'Chybí zkouška. Umocněním přibyl kořen, pro který je pravá strana záporná.',
                  'The check is missing. Squaring added a root for which the right-hand side is negative.',
                ),
                mc(
                  extraneous.join('; '),
                  'domain',
                  'Tenhle kořen zkouškou neprojde: pravá strana je záporná.',
                  'This root fails the check: the right-hand side is negative.',
                ),
              ]
            : []),
          ...(valid.length === 2
            ? [
                mc(`${valid[1]}`, 'incomplete', 'Zkouškou projdou oba kořeny.', 'Both roots pass the check.'),
                mc(`${valid[0]}`, 'incomplete', 'Zkouškou projdou oba kořeny.', 'Both roots pass the check.'),
              ]
            : []),
        ],
        verify: [{ kind: 'roots', expr: `sqrt(${leadIn(p)}x${tailIn(q)})-(${shiftIn(b)})` }],
      };
    },
  }),
];
