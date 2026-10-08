import { L, type Lesson } from '@lemma/core';

/**
 * Lessons for syllabus chapters 4–8 and the unit circle of chapter 11.
 * Same writing rules as lessons.ts: one idea per step, ask before telling, say why.
 */
export const FUNCTION_LESSONS: Lesson[] = [
  // --------------------------------------------------------------------- quadabs.graph
  {
    concept: 'quadabs.graph',
    minutes: 12,
    steps: [
      {
        kind: 'predict',
        question: L(
          'Jak vznikne graf funkce $y = |x^2 - 4|$ z grafu $y = x^2 - 4$?',
          'How does the graph of $y = |x^2 - 4|$ arise from the graph of $y = x^2 - 4$?',
        ),
        options: [
          { id: 'a', text: L('celá parabola se posune o 4 nahoru', 'the whole parabola moves up by 4') },
          {
            id: 'b',
            text: L('část pod osou $x$ se překlopí nahoru', 'the part below the $x$-axis is flipped upwards'),
          },
          { id: 'c', text: L('levá polovina se překlopí doprava', 'the left half is flipped to the right') },
          { id: 'd', text: L('parabola se otočí vzhůru nohama', 'the parabola is turned upside down') },
        ],
        correct: 'b',
        reveal: L(
          'Překlopí se jen část pod osou $x$. Absolutní hodnota nechává kladná čísla být a záporným mění znaménko — a záporné hodnoty má $x^2 - 4$ jen mezi kořeny $-2$ a $2$.',
          'Only the part below the $x$-axis is flipped. The absolute value leaves positive numbers alone and changes the sign of negative ones — and $x^2 - 4$ is negative only between its roots $-2$ and $2$.',
        ),
      },
      {
        kind: 'explore',
        lab: { tool: 'grapher', preset: { expr: 'abs(x^2 - 4)' } },
        task: L(
          'Do druhého řádku napiš `x^2 - 4`. Kde oba grafy splývají a kde se liší?',
          'Type `x^2 - 4` into the second line. Where do the two graphs coincide and where do they differ?',
        ),
        observe: L(
          'Splývají tam, kde je parabola nad osou $x$. Mezi kořeny je jeden graf zrcadlovým obrazem druhého podle osy $x$. V kořenech vzniknou hroty — graf tam prudce změní směr.',
          'They coincide where the parabola is above the $x$-axis. Between the roots one graph is the mirror image of the other in the $x$-axis. At the roots corners appear — the graph changes direction abruptly.',
        ),
      },
      {
        kind: 'text',
        body: L(
          'Pozor na dvě různé věci. $|f(x)|$ překlápí nahoru to, co je **pod osou $x$**. $f(|x|)$ dělá něco jiného: zahodí levou polovinu grafu a pravou zrcadlí podle osy $y$.',
          'Mind two different things. $|f(x)|$ flips upwards whatever is **below the $x$-axis**. $f(|x|)$ does something else: it discards the left half of the graph and mirrors the right half in the $y$-axis.',
        ),
      },
      {
        kind: 'worked',
        title: L('Kolik řešení má rovnice $|x^2 - 4| = 3$?', 'How many solutions does $|x^2 - 4| = 3$ have?'),
        steps: [
          {
            text: L(
              'Načrtnu graf levé strany: parabola s vrcholem $[0; -4]$, jejíž spodní část se překlopí. Z vrcholu se stane „kopec“ s výškou 4.',
              'Sketch the left side: a parabola with vertex $(0, -4)$ whose lower part is flipped. The vertex becomes a “hill” of height 4.',
            ),
            why: L(
              'Počet řešení je počet průsečíků grafu s vodorovnou přímkou $y = 3$. Z obrázku ho uvidím dřív, než cokoli spočítám.',
              'The number of solutions is the number of intersections of the graph with the horizontal line $y = 3$. The picture shows it before any computing.',
            ),
          },
          {
            text: L(
              'Přímka $y = 3$ leží pod vrcholem kopce (3 < 4): protne kopec dvakrát a obě vnější ramena po jednom. Celkem čtyři průsečíky.',
              'The line $y = 3$ lies below the top of the hill (3 < 4): it cuts the hill twice and each outer arm once. Four intersections in all.',
            ),
          },
          {
            math: 'x^2 - 4 = 3 \\;\\lor\\; x^2 - 4 = -3',
            text: L(
              'Početně: výraz v absolutní hodnotě je buď 3, nebo $-3$.',
              'By computation: the expression inside the absolute value is either 3 or $-3$.',
            ),
            why: L(
              'Absolutní hodnotu 3 mají právě dvě čísla, $3$ a $-3$.',
              'Exactly two numbers have absolute value 3: $3$ and $-3$.',
            ),
          },
          {
            math: L('x = \\pm\\sqrt{7} \\;\\lor\\; x = \\pm 1', 'x = \\pm\\sqrt{7} \\;\\lor\\; x = \\pm 1'),
            text: L('Čtyři řešení — stejně jako na obrázku.', 'Four solutions — just as in the picture.'),
            why: L(
              'Obrázek a výpočet se navzájem kontrolují. Kdyby se počty lišily, je někde chyba.',
              'The picture and the computation check each other. If the counts differed, there would be a mistake somewhere.',
            ),
          },
        ],
      },
      { kind: 'check', generator: 'quadabs.graph.count', level: 3 },
      { kind: 'check', generator: 'quadabs.graph.count', level: 4 },
      {
        kind: 'summary',
        points: [
          L(
            '$|f(x)|$: část grafu pod osou $x$ se překlopí nahoru, zbytek zůstává.',
            '$|f(x)|$: the part of the graph below the $x$-axis is flipped up, the rest stays.',
          ),
          L('V kořenech funkce $f$ má graf $|f|$ hroty.', 'At the roots of $f$ the graph of $|f|$ has corners.'),
          L(
            'Počet řešení rovnice $|f(x)| = k$ je počet průsečíků s přímkou $y = k$: nejdřív náčrtek, potom výpočet.',
            'The number of solutions of $|f(x)| = k$ is the number of intersections with the line $y = k$: sketch first, compute second.',
          ),
        ],
      },
    ],
  },

  // ----------------------------------------------------------------------- pow.natural
  {
    concept: 'pow.natural',
    minutes: 10,
    steps: [
      {
        kind: 'predict',
        question: L(
          'Pro $x = 0{,}5$: které číslo je větší, $x^2$, nebo $x^3$?',
          'For $x = 0.5$: which is larger, $x^2$ or $x^3$?',
        ),
        options: [
          { id: 'a', text: L('$x^2$', '$x^2$') },
          { id: 'b', text: L('$x^3$', '$x^3$') },
          { id: 'c', text: L('jsou stejná', 'they are equal') },
        ],
        correct: 'a',
        reveal: L(
          '$x^2 = 0{,}25$ a $x^3 = 0{,}125$. Mezi nulou a jedničkou každé další násobení číslo zmenší, takže vyšší mocnina je menší. Pro $x > 1$ je to přesně naopak.',
          '$x^2 = 0.25$ and $x^3 = 0.125$. Between zero and one every further multiplication makes a number smaller, so the higher power is the smaller one. For $x > 1$ it is exactly the other way round.',
        ),
      },
      {
        kind: 'explore',
        lab: { tool: 'power', preset: { n: 2 } },
        task: L(
          'Přepínej exponent: 2, 3, 4, 5. Čím se liší grafy pro sudé a pro liché $n$? Kterými body procházejí všechny?',
          'Switch the exponent: 2, 3, 4, 5. How do the graphs for even and for odd $n$ differ? Through which points do all of them pass?',
        ),
        observe: L(
          'Sudé $n$: graf je souměrný podle osy $y$ a neklesne pod nulu. Liché $n$: graf je souměrný podle počátku a funkce roste na celém $\\mathbb{R}$. Všechny procházejí body $[0; 0]$ a $[1; 1]$.',
          'Even $n$: the graph is symmetric in the $y$-axis and never goes below zero. Odd $n$: the graph is symmetric about the origin and the function increases on all of $\\mathbb{R}$. All of them pass through $(0, 0)$ and $(1, 1)$.',
        ),
      },
      {
        kind: 'text',
        body: L(
          'Za souměrností je znaménko: $(-x)^n = x^n$ pro sudé $n$ a $(-x)^n = -x^n$ pro liché $n$. Funkci s první vlastností se říká **sudá**, s druhou **lichá**.',
          'Behind the symmetry is the sign: $(-x)^n = x^n$ for even $n$ and $(-x)^n = -x^n$ for odd $n$. A function with the first property is called **even**, with the second **odd**.',
        ),
      },
      {
        kind: 'worked',
        title: L('Rovnice $x^4 = 16$ a $x^3 = -8$', 'The equations $x^4 = 16$ and $x^3 = -8$'),
        steps: [
          {
            math: L(
              'x^4 = 16 \\;\\Rightarrow\\; x = 2 \\;\\lor\\; x = -2',
              'x^4 = 16 \\;\\Rightarrow\\; x = 2 \\;\\lor\\; x = -2',
            ),
            text: L(
              'Sudý exponent: řešení jsou dvě, navzájem opačná.',
              'An even exponent: there are two solutions, opposite to each other.',
            ),
            why: L(
              'Vodorovná přímka $y = 16$ protne graf tvaru „U“ dvakrát — souměrně podle osy $y$.',
              'The horizontal line $y = 16$ cuts the U-shaped graph twice — symmetrically in the $y$-axis.',
            ),
          },
          {
            math: 'x^3 = -8 \\;\\Rightarrow\\; x = -2',
            text: L(
              'Lichý exponent: řešení je vždy právě jedno, i pro zápornou pravou stranu.',
              'An odd exponent: there is always exactly one solution, even for a negative right-hand side.',
            ),
            why: L(
              'Lichá mocnina roste na celém $\\mathbb{R}$ a nabývá všech hodnot, takže každou vodorovnou přímku protne jednou.',
              'An odd power increases on all of $\\mathbb{R}$ and takes every value, so it meets each horizontal line once.',
            ),
          },
          {
            math: 'x^4 = -16 \\;\\Rightarrow\\; K = \\emptyset',
            text: L('Sudá mocnina nemůže být záporná: žádné řešení.', 'An even power cannot be negative: no solution.'),
          },
        ],
      },
      { kind: 'check', generator: 'pow.natural.properties', level: 1 },
      { kind: 'check', generator: 'pow.natural.equation', level: 2 },
      {
        kind: 'summary',
        points: [
          L(
            'Sudý exponent: graf souměrný podle osy $y$, hodnoty $\\ge 0$.',
            'Even exponent: graph symmetric in the $y$-axis, values $\\ge 0$.',
          ),
          L(
            'Lichý exponent: graf souměrný podle počátku, funkce rostoucí, nabývá všech hodnot.',
            'Odd exponent: graph symmetric about the origin, increasing, takes every value.',
          ),
          L(
            '$x^n = c$: pro sudé $n$ dvě, jedno nebo žádné řešení; pro liché $n$ vždy jedno.',
            '$x^n = c$: for even $n$ two, one or no solutions; for odd $n$ always one.',
          ),
        ],
      },
    ],
  },

  // ----------------------------------------------------------------------- inv.concept
  {
    concept: 'inv.concept',
    minutes: 12,
    steps: [
      {
        kind: 'predict',
        question: L(
          'Funkce $f(x) = 1{,}8x + 32$ převádí stupně Celsia na stupně Fahrenheita. Co dělá funkce k ní inverzní?',
          'The function $f(x) = 1.8x + 32$ converts degrees Celsius to degrees Fahrenheit. What does its inverse do?',
        ),
        options: [
          {
            id: 'a',
            text: L('převádí stupně Fahrenheita na stupně Celsia', 'converts degrees Fahrenheit to degrees Celsius'),
          },
          { id: 'b', text: L('počítá $\\dfrac{1}{1{,}8x + 32}$', 'computes $\\dfrac{1}{1.8x + 32}$') },
          { id: 'c', text: L('počítá $-1{,}8x - 32$', 'computes $-1.8x - 32$') },
        ],
        correct: 'a',
        reveal: L(
          'Inverzní funkce vrací zpět: z výstupu udělá původní vstup. Není to převrácená hodnota ani opačné číslo — zápis $f^{-1}$ tu neznamená „na minus první“.',
          'The inverse undoes the function: from the output it recovers the original input. It is neither the reciprocal nor the opposite number — the notation $f^{-1}$ does not mean “to the power minus one” here.',
        ),
      },
      {
        kind: 'explore',
        lab: { tool: 'inverse' },
        task: L(
          'Sleduj graf funkce a graf její inverze. Podle které přímky jsou souměrné? Co se stane s bodem $[a; b]$?',
          'Watch the graph of a function and the graph of its inverse. In which line are they symmetric? What happens to a point $(a, b)$?',
        ),
        observe: L(
          'Jsou souměrné podle přímky $y = x$. Bod $[a; b]$ na grafu $f$ odpovídá bodu $[b; a]$ na grafu $f^{-1}$: vstup a výstup si vymění role.',
          'They are symmetric in the line $y = x$. A point $(a, b)$ on the graph of $f$ corresponds to the point $(b, a)$ on the graph of $f^{-1}$: input and output swap roles.',
        ),
      },
      {
        kind: 'text',
        body: L(
          'Vrátit se zpět jde jen tehdy, když každý výstup vznikl z jediného vstupu. Takové funkci se říká **prostá**. Funkce $y = x^2$ na celém $\\mathbb{R}$ prostá není: čtyřku dá dvojka i minus dvojka, a ze čtyřky už nepoznáš, odkud přišla.',
          'Going back is possible only when every output came from a single input. Such a function is called **one-to-one**. The function $y = x^2$ on all of $\\mathbb{R}$ is not: both two and minus two give four, and from the four you cannot tell where it came from.',
        ),
      },
      {
        kind: 'worked',
        title: L('Inverzní funkce k $f(x) = 2x - 6$', 'The inverse of $f(x) = 2x - 6$'),
        steps: [
          {
            math: 'y = 2x - 6',
            text: L(
              'Zapíšu funkci jako rovnici mezi $x$ a $y$.',
              'Write the function as an equation between $x$ and $y$.',
            ),
          },
          {
            math: 'x = 2y - 6',
            text: L('Vyměním $x$ a $y$.', 'Swap $x$ and $y$.'),
            why: L(
              'Inverzní funkce má vstup a výstup prohozené — přesně to výměna písmen zapisuje.',
              'The inverse has input and output exchanged — which is exactly what swapping the letters records.',
            ),
          },
          {
            math: 'y = \\frac{x + 6}{2}',
            text: L(
              'Vyjádřím $y$. To je předpis inverzní funkce.',
              'Solve for $y$. That is the formula of the inverse.',
            ),
            why: L(
              'Původní funkce „vynásob dvěma, odečti šest“; inverzní dělá opačné kroky v opačném pořadí: „přičti šest, vyděl dvěma“.',
              'The original function says “multiply by two, subtract six”; the inverse does the opposite steps in the opposite order: “add six, divide by two”.',
            ),
          },
          {
            math: 'f(5) = 4, \\quad f^{-1}(4) = \\frac{4 + 6}{2} = 5',
            text: L(
              'Zkouška: inverzní funkce vrátila původní číslo.',
              'Check: the inverse returned the original number.',
            ),
          },
        ],
      },
      { kind: 'check', generator: 'inv.concept.injective', level: 1 },
      { kind: 'check', generator: 'inv.concept.values', level: 2 },
      {
        kind: 'summary',
        points: [
          L(
            '$f^{-1}$ vrací zpět: $f(a) = b$ právě tehdy, když $f^{-1}(b) = a$.',
            '$f^{-1}$ undoes $f$: $f(a) = b$ exactly when $f^{-1}(b) = a$.',
          ),
          L(
            'Inverzi má jen prostá funkce. Grafy $f$ a $f^{-1}$ jsou souměrné podle přímky $y = x$.',
            'Only a one-to-one function has an inverse. The graphs of $f$ and $f^{-1}$ are symmetric in the line $y = x$.',
          ),
          L('Definiční obor a obor hodnot si vymění místa.', 'The domain and the range swap places.'),
        ],
      },
    ],
  },

  // ---------------------------------------------------------------------- exp.function
  {
    concept: 'exp.function',
    minutes: 12,
    steps: [
      {
        kind: 'predict',
        question: L(
          'List papíru silný 0,1 mm přeložíš dvacetkrát na polovinu. Jak silný by byl výsledek?',
          'You fold a sheet of paper 0.1 mm thick in half twenty times. How thick would the result be?',
        ),
        options: [
          { id: 'a', text: L('asi 2 mm', 'about 2 mm') },
          { id: 'b', text: L('asi 2 cm', 'about 2 cm') },
          { id: 'c', text: L('asi 1 m', 'about 1 m') },
          { id: 'd', text: L('asi 100 m', 'about 100 m') },
        ],
        correct: 'd',
        reveal: L(
          'Asi 105 metrů: $0{,}1\\ \\text{mm} \\cdot 2^{20} = 104\\,857{,}6\\ \\text{mm}$. Každé přeložení tloušťku zdvojnásobí — a dvacet zdvojnásobení za sebou je víc než milionkrát. (Skutečný papír tolikrát přeložit nejde.)',
          'About 105 metres: $0.1\\ \\text{mm} \\cdot 2^{20} = 104{,}857.6\\ \\text{mm}$. Each fold doubles the thickness — and twenty doublings in a row is more than a millionfold. (Real paper cannot be folded that many times.)',
        ),
      },
      {
        kind: 'explore',
        lab: { tool: 'explog', preset: { show: 'exp' } },
        task: L(
          'Měň základ $a$. Co se stane s grafem $y = a^x$, když $a$ klesne pod 1? Kterým bodem graf prochází vždy?',
          'Change the base $a$. What happens to the graph of $y = a^x$ when $a$ drops below 1? Through which point does the graph always pass?',
        ),
        observe: L(
          'Pro $a > 1$ funkce roste, pro $0 < a < 1$ klesá. Vždy prochází bodem $[0; 1]$, protože $a^0 = 1$. K ose $x$ se blíží, ale nikdy se jí nedotkne: $a^x$ je vždy kladné.',
          'For $a > 1$ the function increases, for $0 < a < 1$ it decreases. It always passes through $(0, 1)$, because $a^0 = 1$. It approaches the $x$-axis but never touches it: $a^x$ is always positive.',
        ),
      },
      {
        kind: 'text',
        body: L(
          'U lineární funkce znamená krok o 1 doprava **přičtení** stejného čísla. U exponenciální funkce znamená **vynásobení** stejným číslem — základem $a$. Proto exponenciála nakonec předběhne jakoukoli přímku i parabolu.',
          'For a linear function a step of 1 to the right means **adding** the same number. For an exponential function it means **multiplying** by the same number — the base $a$. That is why an exponential eventually overtakes any line and any parabola.',
        ),
      },
      {
        kind: 'worked',
        title: L(
          'Nerovnice $2^x > 8$ a $\\left(\\frac{1}{2}\\right)^x > 8$',
          'The inequalities $2^x > 8$ and $\\left(\\frac{1}{2}\\right)^x > 8$',
        ),
        steps: [
          {
            math: '2^x > 2^3 \\;\\Rightarrow\\; x > 3',
            text: L(
              'Obě strany zapíšu se stejným základem a porovnám exponenty.',
              'Write both sides with the same base and compare the exponents.',
            ),
            why: L(
              'Funkce $2^x$ je rostoucí: větší hodnotu má právě pro větší $x$. Znak nerovnosti zůstává.',
              'The function $2^x$ is increasing: it has a larger value exactly for a larger $x$. The inequality sign stays.',
            ),
          },
          {
            math: '\\left(\\tfrac{1}{2}\\right)^x > \\left(\\tfrac{1}{2}\\right)^{-3} \\;\\Rightarrow\\; x < -3',
            text: L('Tady se znak nerovnosti otočí.', 'Here the inequality sign is reversed.'),
            why: L(
              'Funkce $\\left(\\frac{1}{2}\\right)^x$ je klesající: větší hodnotu má pro **menší** $x$.',
              'The function $\\left(\\frac{1}{2}\\right)^x$ is decreasing: it has a larger value for a **smaller** $x$.',
            ),
          },
          {
            text: L(
              'Zkouška jedním číslem: pro $x = -4$ je $\\left(\\frac{1}{2}\\right)^{-4} = 16 > 8$. Sedí.',
              'A check with one number: for $x = -4$, $\\left(\\frac{1}{2}\\right)^{-4} = 16 > 8$. It fits.',
            ),
          },
        ],
      },
      { kind: 'check', generator: 'exp.function.values', level: 1 },
      { kind: 'check', generator: 'exp.function.inequality', level: 2 },
      {
        kind: 'summary',
        points: [
          L(
            '$y = a^x$, $a > 0$, $a \\ne 1$: definiční obor $\\mathbb{R}$, obor hodnot $(0; \\infty)$, graf prochází bodem $[0; 1]$.',
            '$y = a^x$, $a > 0$, $a \\ne 1$: domain $\\mathbb{R}$, range $(0, \\infty)$, the graph passes through $(0, 1)$.',
          ),
          L('$a > 1$: rostoucí. $0 < a < 1$: klesající.', '$a > 1$: increasing. $0 < a < 1$: decreasing.'),
          L(
            'Při porovnávání exponentů se u základu menšího než 1 znak nerovnosti otáčí.',
            'When comparing exponents with a base below 1, the inequality sign is reversed.',
          ),
        ],
      },
    ],
  },

  // -------------------------------------------------------------------- log.definition
  {
    concept: 'log.definition',
    minutes: 10,
    steps: [
      {
        kind: 'predict',
        question: L(
          'Na kolikátou je potřeba umocnit dvojku, aby vyšlo 32?',
          'To which power must two be raised to give 32?',
        ),
        options: [
          { id: 'a', text: L('na čtvrtou', 'the fourth') },
          { id: 'b', text: L('na pátou', 'the fifth') },
          { id: 'c', text: L('na šestou', 'the sixth') },
          { id: 'd', text: L('na šestnáctou', 'the sixteenth') },
        ],
        correct: 'b',
        reveal: L(
          'Na pátou: $2^5 = 32$. Přesně na tuhle otázku odpovídá logaritmus: $\\log_2 32 = 5$.',
          'The fifth: $2^5 = 32$. A logarithm answers exactly this question: $\\log_2 32 = 5$.',
        ),
      },
      {
        kind: 'text',
        body: L(
          '**Logaritmus je exponent.** Zápis $\\log_a x = y$ říká totéž co $a^y = x$: „na kolikátou umocním základ $a$, abych dostal $x$?“ Základ musí být kladný a různý od 1, a logaritmovat lze jen kladná čísla.',
          '**A logarithm is an exponent.** Writing $\\log_a x = y$ says the same as $a^y = x$: “to which power do I raise the base $a$ to get $x$?” The base must be positive and different from 1, and only positive numbers have logarithms.',
        ),
      },
      {
        kind: 'explore',
        lab: { tool: 'explog', preset: { show: 'both' } },
        task: L(
          'Zobraz exponenciálu i logaritmus se stejným základem. Jak spolu grafy souvisejí?',
          'Show the exponential and the logarithm with the same base. How are the graphs related?',
        ),
        observe: L(
          'Jsou souměrné podle přímky $y = x$: logaritmus je funkce inverzní k exponenciále. Proto má definiční obor $(0; \\infty)$ — to je obor hodnot exponenciály.',
          'They are symmetric in the line $y = x$: the logarithm is the inverse of the exponential. That is why its domain is $(0, \\infty)$ — the range of the exponential.',
        ),
      },
      {
        kind: 'worked',
        title: L('Čtyři logaritmy zpaměti', 'Four logarithms in your head'),
        steps: [
          {
            math: '\\log_3 81 = 4',
            text: L('Hledám exponent: $3^? = 81$.', 'I look for the exponent: $3^? = 81$.'),
            why: L(
              '$3^4 = 81$. Logaritmus vždy převedu na otázku o mocnině.',
              '$3^4 = 81$. I always turn a logarithm into a question about a power.',
            ),
          },
          {
            math: '\\log_2 \\tfrac{1}{8} = -3',
            text: L('Zlomek znamená záporný exponent.', 'A fraction means a negative exponent.'),
            why: L('$2^{-3} = \\frac{1}{2^3} = \\frac{1}{8}$.', '$2^{-3} = \\frac{1}{2^3} = \\frac{1}{8}$.'),
          },
          {
            math: '\\log_5 1 = 0',
            text: L('Logaritmus jedné je nula při každém základu.', 'The logarithm of one is zero for every base.'),
            why: L('$a^0 = 1$ pro každé přípustné $a$.', '$a^0 = 1$ for every admissible $a$.'),
          },
          {
            math: '\\log_4 2 = \\tfrac{1}{2}',
            text: L('Exponent může být i zlomek.', 'The exponent may be a fraction as well.'),
            why: L('$4^{1/2} = \\sqrt{4} = 2$.', '$4^{1/2} = \\sqrt{4} = 2$.'),
          },
        ],
      },
      {
        kind: 'text',
        body: L(
          'V informatice je nejčastější základ 2. $\\log_2 n$ říká, kolikrát lze $n$ rozpůlit, než zbude 1 — tolik kroků udělá binární vyhledávání. A kolik bitů je potřeba na $n$ různých hodnot? Také přibližně $\\log_2 n$.',
          'In computing the most common base is 2. $\\log_2 n$ says how many times $n$ can be halved before 1 is left — that is how many steps binary search takes. And how many bits are needed for $n$ different values? Roughly $\\log_2 n$ as well.',
        ),
      },
      { kind: 'check', generator: 'log.definition.evaluate', level: 1 },
      { kind: 'check', generator: 'log.definition.evaluate', level: 2 },
      {
        kind: 'summary',
        points: [
          L(
            '$\\log_a x = y \\iff a^y = x$. Logaritmus je exponent.',
            '$\\log_a x = y \\iff a^y = x$. A logarithm is an exponent.',
          ),
          L(
            '$\\log_a 1 = 0$, $\\log_a a = 1$; logaritmus existuje jen pro $x > 0$.',
            '$\\log_a 1 = 0$, $\\log_a a = 1$; a logarithm exists only for $x > 0$.',
          ),
          L(
            'Zlomku odpovídá záporný exponent, odmocnině exponent zlomkový.',
            'A fraction corresponds to a negative exponent, a root to a fractional one.',
          ),
        ],
      },
    ],
  },

  // ------------------------------------------------------------------ trig.unit-circle
  {
    concept: 'trig.unit-circle',
    minutes: 12,
    steps: [
      {
        kind: 'predict',
        question: L(
          'Bod leží na jednotkové kružnici v místě $[1; 0]$. Otočíš ho kolem středu o $90^{\\circ}$ proti směru hodinových ručiček. Kde skončí?',
          'A point lies on the unit circle at $(1, 0)$. You rotate it about the centre by $90^{\\circ}$ anticlockwise. Where does it end up?',
        ),
        options: [
          { id: 'a', text: L('$[1; 1]$', '$(1, 1)$') },
          { id: 'b', text: L('$[0; 1]$', '$(0, 1)$') },
          { id: 'c', text: L('$[-1; 0]$', '$(-1, 0)$') },
          { id: 'd', text: L('$[0; -1]$', '$(0, -1)$') },
        ],
        correct: 'b',
        reveal: L(
          'V bodě $[0; 1]$. A právě tak jsou definovány hodnoty pro úhel $90^{\\circ}$: první souřadnice je kosinus, druhá sinus. Tedy $\\cos 90^{\\circ} = 0$ a $\\sin 90^{\\circ} = 1$.',
          'At $(0, 1)$. And that is exactly how the values for the angle $90^{\\circ}$ are defined: the first coordinate is the cosine, the second the sine. So $\\cos 90^{\\circ} = 0$ and $\\sin 90^{\\circ} = 1$.',
        ),
      },
      {
        kind: 'explore',
        lab: { tool: 'unitcircle' },
        task: L(
          'Táhni bodem po kružnici. Ve kterých kvadrantech je sinus kladný? A kosinus?',
          'Drag the point around the circle. In which quadrants is the sine positive? And the cosine?',
        ),
        observe: L(
          'Sinus je výška bodu: kladný nahoře, tedy v I. a II. kvadrantu. Kosinus je vodorovná poloha: kladný vpravo, tedy v I. a IV. kvadrantu.',
          'The sine is the height of the point: positive at the top, that is in quadrants I and II. The cosine is the horizontal position: positive on the right, that is in quadrants I and IV.',
        ),
      },
      {
        kind: 'text',
        body: L(
          'V pravoúhlém trojúhelníku dávají sinus a kosinus smysl jen pro ostré úhly. Na jednotkové kružnici fungují pro **jakýkoli** úhel — i tupý, záporný nebo větší než celá otáčka. Pro ostré úhly obě definice dávají totéž.',
          'In a right triangle sine and cosine make sense only for acute angles. On the unit circle they work for **any** angle — obtuse, negative, or larger than a full turn. For acute angles the two definitions agree.',
        ),
      },
      {
        kind: 'worked',
        title: L(
          'Hodnoty $\\sin 150^{\\circ}$ a $\\cos 150^{\\circ}$',
          'The values $\\sin 150^{\\circ}$ and $\\cos 150^{\\circ}$',
        ),
        steps: [
          {
            text: L(
              'Úhel $150^{\\circ}$ leží ve II. kvadrantu. K ose $x$ mu chybí $30^{\\circ}$ — to je jeho referenční úhel.',
              'The angle $150^{\\circ}$ lies in quadrant II. It is $30^{\\circ}$ short of the $x$-axis — that is its reference angle.',
            ),
            why: L(
              'Bod pro $150^{\\circ}$ je zrcadlovým obrazem bodu pro $30^{\\circ}$ podle osy $y$: stejná výška, opačná vodorovná poloha.',
              'The point for $150^{\\circ}$ is the mirror image of the point for $30^{\\circ}$ in the $y$-axis: same height, opposite horizontal position.',
            ),
          },
          {
            math: '\\sin 150^{\\circ} = \\sin 30^{\\circ} = \\frac{1}{2}',
            text: L('Výška je stejná, takže sinus se nemění.', 'The height is the same, so the sine does not change.'),
          },
          {
            math: '\\cos 150^{\\circ} = -\\cos 30^{\\circ} = -\\frac{\\sqrt{3}}{2}',
            text: L(
              'Bod je vlevo od osy $y$, takže kosinus je záporný.',
              'The point is to the left of the $y$-axis, so the cosine is negative.',
            ),
            why: L(
              'Velikost určí referenční úhel, znaménko kvadrant. Tyhle dva kroky stačí pro každý tabulkový úhel.',
              'The reference angle gives the size, the quadrant gives the sign. These two steps are enough for every table angle.',
            ),
          },
        ],
      },
      { kind: 'check', generator: 'trig.unit-circle.sign', level: 1 },
      { kind: 'check', generator: 'trig.unit-circle.exact', level: 2 },
      {
        kind: 'summary',
        points: [
          L(
            'Bod jednotkové kružnice pro úhel $x$ má souřadnice $[\\cos x; \\sin x]$.',
            'The point of the unit circle for the angle $x$ has coordinates $(\\cos x, \\sin x)$.',
          ),
          L(
            'Sinus je kladný nahoře (I., II.), kosinus vpravo (I., IV.).',
            'The sine is positive at the top (I, II), the cosine on the right (I, IV).',
          ),
          L(
            'Hodnota = referenční úhel (velikost) + kvadrant (znaménko).',
            'A value = reference angle (size) + quadrant (sign).',
          ),
        ],
      },
    ],
  },
];
