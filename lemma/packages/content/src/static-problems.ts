import { L, type StaticProblem } from '@lemma/core';
import { mc, step } from './generators/helpers';

/**
 * Hand-written problems, for cases where a generator adds nothing: explanations, choice of
 * method, estimation, and boss problems that combine several concepts.
 */
export const STATIC_PROBLEMS: StaticProblem[] = [
  {
    id: 'static.quad.three-forms',
    concept: 'quad.roots-form',
    kind: 'explain',
    level: 3,
    title: L('Tři tvary, tři pohledy', 'Three forms, three views'),
    estSeconds: 180,
    prompt: L(
      'Kvadratickou funkci lze zapsat ve tvaru obecném, vrcholovém a součinovém. Vysvětli vlastními slovy, co každý z nich ukazuje „na první pohled“, a uveď příklad úlohy, pro kterou je nejvýhodnější.',
      'A quadratic function can be written in standard, vertex and factored form. Explain in your own words what each one shows “at a glance”, and give an example of a task for which it is the most convenient.',
    ),
    answer: {
      kind: 'self',
      rubric: [
        L(
          'Obecný tvar: průsečík s osou $y$ (koeficient $c$) a směr otevření.',
          'Standard form: the $y$-intercept (the coefficient $c$) and the opening direction.',
        ),
        L(
          'Vrcholový tvar: vrchol, osa souměrnosti, obor hodnot, extrém.',
          'Vertex form: vertex, axis of symmetry, range, extremum.',
        ),
        L(
          'Součinový tvar: nulové body a znaménko funkce (nerovnice).',
          'Factored form: the zeros and the sign of the function (inequalities).',
        ),
        L('Ke každému tvaru jsem uvedl konkrétní typ úlohy.', 'I gave a concrete type of task for each form.'),
      ],
      model: L(
        'Obecný tvar $ax^2+bx+c$ hned ukazuje průsečík s osou $y$ a je vhodný pro dosazování do vzorců. Vrcholový tvar $a(x-m)^2+n$ ukazuje vrchol $[m;n]$, takže se hodí na extrémy a obor hodnot. Součinový tvar $a(x-x_1)(x-x_2)$ ukazuje nulové body, takže se hodí na nerovnice a určování znaménka. Součinový tvar existuje jen tehdy, má-li funkce reálné kořeny.',
        'Standard form $ax^2+bx+c$ shows the $y$-intercept at once and suits substituting into formulas. Vertex form $a(x-m)^2+n$ shows the vertex $(m,n)$, so it suits extrema and the range. Factored form $a(x-x_1)(x-x_2)$ shows the zeros, so it suits inequalities and sign questions. The factored form exists only when the function has real roots.',
      ),
    },
    hints: [],
    solution: [
      step(
        'Porovnej svou odpověď s body níže a se vzorovým řešením.',
        'Compare your answer with the points below and with the model answer.',
      ),
    ],
  },
  {
    id: 'static.lin.explain-parallel',
    concept: 'lin.from-points',
    kind: 'explain',
    level: 2,
    title: L('Proč se rovnoběžky nepotkají', 'Why parallel lines never meet'),
    estSeconds: 150,
    prompt: L(
      'Dvě různé přímky mají stejnou směrnici. Vysvětli algebraicky — pomocí rovnice pro průsečík — proč nemají žádný společný bod.',
      'Two different lines have the same slope. Explain algebraically — using the equation for the intersection — why they have no point in common.',
    ),
    answer: {
      kind: 'self',
      rubric: [
        L('Sestavil jsem rovnici $ax + b_1 = ax + b_2$.', 'I set up the equation $ax + b_1 = ax + b_2$.'),
        L('Ukázal jsem, že $x$ vypadne a zbude $b_1 = b_2$.', 'I showed that $x$ cancels, leaving $b_1 = b_2$.'),
        L(
          'Vysvětlil jsem, že pro různé přímky je to nepravdivé tvrzení, tedy rovnice nemá řešení.',
          'I explained that for different lines this is a false statement, so the equation has no solution.',
        ),
      ],
      model: L(
        'Průsečík splňuje $ax + b_1 = ax + b_2$. Po odečtení $ax$ zbude $b_1 = b_2$. Přímky jsou různé, takže $b_1 \\ne b_2$ a rovnost neplatí pro žádné $x$. Rovnice nemá řešení, přímky nemají společný bod.',
        'An intersection satisfies $ax + b_1 = ax + b_2$. Subtracting $ax$ leaves $b_1 = b_2$. The lines are different, so $b_1 \\ne b_2$ and the equality holds for no $x$. The equation has no solution, so the lines share no point.',
      ),
    },
    hints: [],
    solution: [step('Porovnej svou odpověď se vzorem.', 'Compare your answer with the model.')],
  },
  {
    id: 'static.quad.better-approach',
    concept: 'alg.quad-eq',
    kind: 'core',
    level: 2,
    title: L('Který postup je lepší?', 'Which approach is better?'),
    estSeconds: 60,
    tags: ['strategy'],
    prompt: L(
      'Máš vyřešit rovnici $x^2 - 6x + 9 = 0$. Který postup je nejrychlejší a nejméně náchylný k chybě?',
      'You have to solve $x^2 - 6x + 9 = 0$. Which approach is the quickest and least error-prone?',
    ),
    answer: {
      kind: 'choice',
      options: [
        { id: 'disc', text: L('Dosadit do vzorce s diskriminantem.', 'Substitute into the discriminant formula.') },
        {
          id: 'square',
          text: L('Poznat úplný čtverec $(x - 3)^2 = 0$.', 'Recognise the perfect square $(x - 3)^2 = 0$.'),
        },
        { id: 'graph', text: L('Narýsovat graf a odečíst průsečíky.', 'Draw the graph and read off the intercepts.') },
        { id: 'guess', text: L('Zkoušet dosazovat celá čísla.', 'Try substituting integers.') },
      ],
      correct: ['square'],
    },
    hints: [
      L(
        'Podívej se na koeficienty: $9 = 3^2$ a $6 = 2 \\cdot 3$. Připomíná ti to nějaký vzorec?',
        'Look at the coefficients: $9 = 3^2$ and $6 = 2 \\cdot 3$. Does that remind you of an identity?',
      ),
      L('$A^2 - 2AB + B^2 = (A - B)^2$.', '$A^2 - 2AB + B^2 = (A - B)^2$.'),
    ],
    solution: [
      step(
        'Levá strana je úplný čtverec:',
        'The left side is a perfect square:',
        '(x - 3)^2 = 0 \\;\\Rightarrow\\; x = 3',
      ),
      step(
        'Diskriminant by vyšel také ($D = 0$), ale je to víc kroků a víc míst na chybu. Než začneš počítat, vyplatí se pár sekund hledat strukturu.',
        'The discriminant works too ($D = 0$), but it takes more steps and offers more places to slip. A few seconds spent looking for structure before computing pays off.',
      ),
    ],
    misconceptions: [
      mc(
        'disc',
        'strategy',
        'Funguje, ale je to delší cesta. Poznat strukturu je rychlejší a bezpečnější.',
        'It works, but it is the long way round. Spotting the structure is faster and safer.',
      ),
    ],
  },
  {
    id: 'static.quad.estimate-sign',
    concept: 'quad.roots-form',
    kind: 'estimate',
    level: 3,
    title: L('Odhad bez kalkulačky', 'Estimating without a calculator'),
    estSeconds: 75,
    prompt: L(
      'Bez počítání rozhodni: jaké znaménko má $f(99{,}5)$ pro $f(x) = x^2 - 100x$?',
      'Without computing, decide: what is the sign of $f(99.5)$ for $f(x) = x^2 - 100x$?',
    ),
    answer: {
      kind: 'choice',
      fixedOrder: true,
      options: [
        { id: 'pos', text: L('kladné', 'positive') },
        { id: 'neg', text: L('záporné', 'negative') },
        { id: 'zero', text: L('nula', 'zero') },
      ],
      correct: ['neg'],
    },
    hints: [
      L(
        'Nepočítej $99{,}5^2$. Kde má funkce nulové body?',
        'Do not compute $99.5^2$. Where are the zeros of the function?',
      ),
      L(
        '$f(x) = x(x - 100)$: nulové body $0$ a $100$. Kde vůči nim leží $99{,}5$?',
        '$f(x) = x(x - 100)$: zeros at $0$ and $100$. Where does $99.5$ lie relative to them?',
      ),
    ],
    solution: [
      step('Rozložíme:', 'Factor:', 'f(x) = x(x - 100)'),
      step(
        '$99{,}5$ leží mezi kořeny $0$ a $100$ a parabola se otevírá nahoru, takže tam je záporná.',
        '$99.5$ lies between the roots $0$ and $100$ and the parabola opens upwards, so it is negative there.',
      ),
      step(
        'Stejně: první činitel je kladný, druhý záporný, součin záporný.',
        'Equivalently: the first factor is positive, the second negative, the product negative.',
      ),
    ],
    misconceptions: [
      mc(
        'pos',
        'rushed',
        'Velká čísla svádějí k odhadu „kladné“. Rozhoduje poloha vůči kořenům.',
        'Large numbers tempt you to guess “positive”. What decides is the position relative to the roots.',
      ),
    ],
  },
  {
    id: 'static.abs.boss-two-abs',
    concept: 'abs.equations',
    kind: 'boss',
    level: 5,
    title: L('Dvě absolutní hodnoty', 'Two absolute values'),
    estSeconds: 300,
    alsoRequires: ['abs.piecewise'],
    prompt: L('Řešte v $\\mathbb{R}$: $|x - 1| + |x + 2| = 5$', 'Solve in $\\mathbb{R}$: $|x - 1| + |x + 2| = 5$'),
    answer: { kind: 'set', values: ['-3', '2'], label: 'K =' },
    hints: [
      L(
        'Kolik je tu nulových bodů a na kolik intervalů rozdělí osu?',
        'How many critical points are there, and into how many intervals do they split the line?',
      ),
      L(
        'Nulové body $-2$ a $1$, tři intervaly. V každém zapiš levou stranu bez absolutních hodnot.',
        'Critical points $-2$ and $1$, three intervals. On each, rewrite the left side without absolute values.',
      ),
      L(
        'Prostřední interval: levá strana je konstantní, rovna $3$. Může se rovnat $5$?',
        'Middle interval: the left side is constant, equal to $3$. Can it equal $5$?',
      ),
      L(
        'Krajní intervaly dávají $-2x - 1 = 5$ a $2x + 1 = 5$. Ověř, že kořeny do svých intervalů patří.',
        'The outer intervals give $-2x - 1 = 5$ and $2x + 1 = 5$. Check that the roots belong to their intervals.',
      ),
    ],
    solution: [
      step(
        'Pro $x < -2$:',
        'For $x < -2$:',
        '-(x-1) - (x+2) = 5 \\;\\Rightarrow\\; -2x - 1 = 5 \\;\\Rightarrow\\; x = -3',
      ),
      step(
        'Pro $-2 \\le x < 1$: levá strana je $3$, rovnice $3 = 5$ nemá řešení.',
        'For $-2 \\le x < 1$: the left side is $3$; the equation $3 = 5$ has no solution.',
      ),
      step(
        'Pro $x \\ge 1$:',
        'For $x \\ge 1$:',
        '(x-1) + (x+2) = 5 \\;\\Rightarrow\\; 2x + 1 = 5 \\;\\Rightarrow\\; x = 2',
      ),
      step(
        'Oba kořeny leží ve svých intervalech.',
        'Both roots lie in their intervals.',
        L('K = \\{-3;\\, 2\\}', 'K = \\{-3,\\, 2\\}'),
      ),
      step(
        'Geometricky: součet vzdáleností od $1$ a od $-2$ je 5. Mezi nimi je vždy 3, takže hledané body leží o 1 vně.',
        'Geometrically: the distances to $1$ and to $-2$ add up to 5. Between them the sum is always 3, so the points lie 1 outside.',
      ),
    ],
    misconceptions: [
      mc(
        '2',
        'incomplete',
        'Chybí řešení z intervalu $x < -2$.',
        'The solution from the interval $x < -2$ is missing.',
      ),
      mc(
        '-3',
        'incomplete',
        'Chybí řešení z intervalu $x \\ge 1$.',
        'The solution from the interval $x \\ge 1$ is missing.',
      ),
      mc('-2; 3', 'sign', 'Znaménka při odstraňování absolutních hodnot.', 'Signs when removing the absolute values.'),
    ],
    verify: [{ kind: 'roots', expr: 'abs(x-1)+abs(x+2)-5' }],
  },
  {
    id: 'static.quad.boss-parameter',
    concept: 'quad.inequality',
    kind: 'boss',
    level: 5,
    title: L('Parametr a počet řešení', 'A parameter and the number of solutions'),
    estSeconds: 300,
    alsoRequires: ['alg.quad-eq'],
    prompt: L(
      'Pro které hodnoty parametru $k$ má rovnice $x^2 + kx + 9 = 0$ dvě různá reálná řešení?',
      'For which values of the parameter $k$ does $x^2 + kx + 9 = 0$ have two distinct real solutions?',
    ),
    answer: { kind: 'interval', value: '(-inf; -6) u (6; inf)', label: 'k \\in', placeholder: '(-inf; -1) u (1; inf)' },
    hints: [
      L(
        'Kdy má kvadratická rovnice dvě různá řešení? Zapiš to podmínkou.',
        'When does a quadratic equation have two distinct solutions? Write that as a condition.',
      ),
      L('$D > 0$, kde $D = k^2 - 36$. Neznámou je teď $k$.', '$D > 0$ with $D = k^2 - 36$. The unknown is now $k$.'),
      L(
        '$k^2 - 36 > 0$ je kvadratická nerovnice. Kořeny, parabola, náčrtek.',
        '$k^2 - 36 > 0$ is a quadratic inequality. Roots, parabola, sketch.',
      ),
    ],
    solution: [
      step(
        'Dvě různá řešení právě když $D > 0$:',
        'Two distinct solutions exactly when $D > 0$:',
        'k^2 - 4 \\cdot 9 > 0',
      ),
      step(
        'Kvadratická nerovnice v proměnné $k$ s kořeny $\\pm 6$:',
        'A quadratic inequality in $k$ with roots $\\pm 6$:',
        '(k - 6)(k + 6) > 0',
      ),
      step(
        'Parabola se otevírá nahoru, kladná je vně kořenů:',
        'The parabola opens upwards and is positive outside the roots:',
        L('k \\in (-\\infty;\\,-6) \\cup (6;\\,\\infty)', 'k \\in (-\\infty,\\,-6) \\cup (6,\\,\\infty)'),
      ),
    ],
    misconceptions: [
      mc(
        '(6; inf)',
        'incomplete',
        'Chybí záporná větev: i pro $k < -6$ je $k^2 > 36$.',
        'The negative branch is missing: $k^2 > 36$ also holds for $k < -6$.',
      ),
      mc(
        '(-6; 6)',
        'sign',
        'To je množina, kde je $D < 0$ — tam rovnice řešení nemá.',
        'That is where $D < 0$ — where the equation has no solution.',
      ),
    ],
    verify: [{ kind: 'inequality', expr: 'x^2-36', rel: '>' }],
  },
  {
    id: 'static.quad.boss-tangent',
    concept: 'quad.optimize',
    kind: 'boss',
    level: 5,
    title: L('Přímka, která se paraboly jen dotkne', 'A line that only touches the parabola'),
    estSeconds: 360,
    alsoRequires: ['lin.from-points', 'alg.quad-eq'],
    prompt: L(
      'Pro kterou hodnotu $q$ má přímka $y = 2x + q$ s parabolou $y = x^2$ právě jeden společný bod?',
      'For which value of $q$ does the line $y = 2x + q$ have exactly one point in common with the parabola $y = x^2$?',
    ),
    answer: { kind: 'number', value: '-1', label: 'q =' },
    hints: [
      L('Společné body dvou grafů: polož předpisy do rovnosti.', 'Common points of two graphs: equate the formulas.'),
      L(
        '$x^2 = 2x + q$, tedy $x^2 - 2x - q = 0$. Co znamená „právě jeden společný bod“ pro tuto rovnici?',
        '$x^2 = 2x + q$, i.e. $x^2 - 2x - q = 0$. What does “exactly one common point” mean for this equation?',
      ),
      L('$D = 0$: $4 + 4q = 0$.', '$D = 0$: $4 + 4q = 0$.'),
    ],
    solution: [
      step('Průsečíky:', 'Intersections:', 'x^2 = 2x + q \\iff x^2 - 2x - q = 0'),
      step(
        'Jeden společný bod právě když $D = 0$:',
        'One common point exactly when $D = 0$:',
        '(-2)^2 - 4\\cdot 1\\cdot(-q) = 4 + 4q = 0',
      ),
      step('Odtud:', 'Hence:', 'q = -1'),
      step(
        'Přímka $y = 2x - 1$ se paraboly dotýká v bodě $[1; 1]$ — je to její tečna. K tomuhle se vrátíš na FIT v matematické analýze jako k derivaci.',
        'The line $y = 2x - 1$ touches the parabola at $(1, 1)$ — it is its tangent. You will meet this again at FIT, in calculus, as the derivative.',
      ),
    ],
    misconceptions: [
      mc(
        '1',
        'sign',
        'Pozor na znaménko u $c = -q$ v diskriminantu.',
        'Mind the sign of $c = -q$ in the discriminant.',
      ),
      mc(
        '0',
        'concept',
        'Pro $q = 0$ má přímka s parabolou dva společné body ($x = 0$ a $x = 2$).',
        'For $q = 0$ the line meets the parabola twice (at $x = 0$ and $x = 2$).',
      ),
    ],
    verify: [{ kind: 'value', expr: '-4/4' }],
  },
  {
    id: 'static.fn.domain-explain',
    concept: 'fn.concept',
    kind: 'explain',
    level: 2,
    title: L('Dvě funkce, nebo jedna?', 'Two functions, or one?'),
    estSeconds: 150,
    prompt: L(
      'Jsou funkce $f(x) = \\dfrac{x^2 - 4}{x - 2}$ a $g(x) = x + 2$ stejné? Zdůvodni.',
      'Are $f(x) = \\dfrac{x^2 - 4}{x - 2}$ and $g(x) = x + 2$ the same function? Justify.',
    ),
    answer: {
      kind: 'self',
      rubric: [
        L(
          'Zkrátil jsem zlomek a viděl, že pro $x \\ne 2$ platí $f(x) = x + 2$.',
          'I cancelled the fraction and saw that $f(x) = x + 2$ for $x \\ne 2$.',
        ),
        L(
          'Uvedl jsem, že $f$ není definována pro $x = 2$, kdežto $g$ ano.',
          'I stated that $f$ is undefined at $x = 2$ whereas $g$ is defined.',
        ),
        L(
          'Závěr: nejsou stejné, liší se definičním oborem.',
          'Conclusion: they are not the same; their domains differ.',
        ),
      ],
      model: L(
        'Nejsou. Pro $x \\ne 2$ je $\\frac{x^2-4}{x-2} = \\frac{(x-2)(x+2)}{x-2} = x + 2$, takže mají stejné hodnoty všude, kde jsou obě definované. Ale $D(f) = \\mathbb{R} \\setminus \\{2\\}$ a $D(g) = \\mathbb{R}$. Funkce je předpis i definiční obor; grafem $f$ je přímka s jedním vynechaným bodem.',
        'They are not. For $x \\ne 2$, $\\frac{x^2-4}{x-2} = \\frac{(x-2)(x+2)}{x-2} = x + 2$, so they agree wherever both are defined. But $D(f) = \\mathbb{R} \\setminus \\{2\\}$ and $D(g) = \\mathbb{R}$. A function is its rule together with its domain; the graph of $f$ is a line with one point missing.',
      ),
    },
    hints: [],
    solution: [step('Porovnej svou odpověď se vzorem.', 'Compare your answer with the model.')],
  },
];
