import { L, type Lesson } from '@lemma/core';

/**
 * Lessons: short sequences of steps for one concept each.
 *
 * Writing rules (docs/content-model.md §5): one idea per step; ask before telling; say
 * why a step is allowed; no step longer than a few sentences. A lesson is done in ten to
 * fifteen minutes and ends in real problems.
 */
export const LESSONS: Lesson[] = [
  // ------------------------------------------------------------------------ lin.graph
  {
    concept: 'lin.graph',
    minutes: 10,
    steps: [
      {
        kind: 'predict',
        question: L(
          'Funkce $f(x) = 2x + 1$. O kolik se změní $f(x)$, když $x$ vzroste o 3?',
          'Take $f(x) = 2x + 1$. By how much does $f(x)$ change when $x$ grows by 3?',
        ),
        options: [
          { id: 'a', text: L('o 2', 'by 2') },
          { id: 'b', text: L('o 3', 'by 3') },
          { id: 'c', text: L('o 6', 'by 6') },
          { id: 'd', text: L('o 7', 'by 7') },
        ],
        correct: 'c',
        reveal: L(
          'O 6. Směrnice 2 říká: každý krok o 1 doprava zvedne graf o 2. Tři kroky, třikrát 2. Číslo $+1$ na změnu nemá vliv — jen určuje, odkud se startuje.',
          'By 6. A slope of 2 says: each step of 1 to the right lifts the graph by 2. Three steps, three times 2. The $+1$ has no effect on the change — it only sets where you start.',
        ),
      },
      {
        kind: 'explore',
        lab: { tool: 'linear', preset: { a: 1, b: 0 } },
        task: L(
          'Hýbej jen posuvníkem $a$. Který bod grafu zůstává na místě? Pak hýbej jen $b$. Co se nemění teď?',
          'Move only the $a$ slider. Which point of the graph stays put? Then move only $b$. What stays the same now?',
        ),
        observe: L(
          '$a$ otáčí přímku kolem bodu $[0; b]$ na ose $y$. $b$ ji posouvá nahoru a dolů, sklon se nemění. Záporné $a$ přímku překlopí: klesá.',
          '$a$ turns the line around the point $(0, b)$ on the $y$-axis. $b$ slides it up and down without changing the tilt. A negative $a$ flips it: the line falls.',
        ),
      },
      {
        kind: 'text',
        body: L(
          'Směrnice je **změna $y$ dělená změnou $x$**: $a = \\dfrac{\\Delta y}{\\Delta x}$. U přímky je všude stejná — proto na ni stačí dva libovolné body.',
          'Slope is **the change in $y$ divided by the change in $x$**: $a = \\dfrac{\\Delta y}{\\Delta x}$. On a line it is the same everywhere — which is why any two points are enough to find it.',
        ),
      },
      {
        kind: 'worked',
        title: L('Přímka body $[1; 2]$ a $[3; 8]$', 'The line through $(1, 2)$ and $(3, 8)$'),
        steps: [
          {
            math: 'a = \\frac{8 - 2}{3 - 1} = \\frac{6}{2} = 3',
            text: L(
              'Směrnice: o kolik se změnilo $y$, děleno o kolik se změnilo $x$.',
              'Slope: how much $y$ changed, divided by how much $x$ changed.',
            ),
            why: L(
              'Odečítám ve stejném pořadí nahoře i dole — druhý bod minus první. Jinak vyjde opačné znaménko.',
              'I subtract in the same order top and bottom — second point minus first. Otherwise the sign comes out reversed.',
            ),
          },
          {
            math: '2 = 3 \\cdot 1 + b \\;\\Rightarrow\\; b = -1',
            text: L('Do $y = 3x + b$ dosadím jeden z bodů.', 'Substitute one of the points into $y = 3x + b$.'),
            why: L(
              'Bod leží na přímce, takže jeho souřadnice musí rovnici splňovat.',
              'The point lies on the line, so its coordinates must satisfy the equation.',
            ),
          },
          {
            math: 'y = 3x - 1',
            text: L(
              'Zkouška druhým bodem: $3 \\cdot 3 - 1 = 8$. Sedí.',
              'Check with the other point: $3 \\cdot 3 - 1 = 8$. It fits.',
            ),
            why: L(
              'Druhý bod jsem pro výpočet $b$ nepoužil, takže je to skutečná kontrola, ne opakování téhož.',
              'I did not use the second point to find $b$, so this is a real check, not a repetition.',
            ),
          },
        ],
      },
      { kind: 'check', generator: 'lin.graph.features', level: 1 },
      { kind: 'check', generator: 'lin.graph.read', level: 2 },
      {
        kind: 'summary',
        points: [
          L(
            '$y = ax + b$: $a$ je směrnice, $b$ je průsečík s osou $y$.',
            '$y = ax + b$: $a$ is the slope, $b$ is the $y$-intercept.',
          ),
          L(
            '$a > 0$ roste, $a < 0$ klesá, $a = 0$ je konstantní.',
            '$a > 0$ rises, $a < 0$ falls, $a = 0$ is constant.',
          ),
          L(
            'Směrnice ze dvou bodů: $\\Delta y / \\Delta x$, ve stejném pořadí.',
            'Slope from two points: $\\Delta y / \\Delta x$, in the same order.',
          ),
        ],
      },
    ],
  },

  // ------------------------------------------------------------------------ abs.graph
  {
    concept: 'abs.graph',
    minutes: 12,
    steps: [
      {
        kind: 'predict',
        question: L('Jak vypadá graf funkce $y = |x - 2|$?', 'What does the graph of $y = |x - 2|$ look like?'),
        options: [
          { id: 'a', text: L('přímka procházející bodem $[2; 0]$', 'a straight line through $(2, 0)$') },
          { id: 'b', text: L('písmeno V se špičkou v $x = 2$', 'a letter V with its tip at $x = 2$') },
          { id: 'c', text: L('písmeno V se špičkou v $x = -2$', 'a letter V with its tip at $x = -2$') },
          { id: 'd', text: L('parabola s vrcholem v $x = 2$', 'a parabola with vertex at $x = 2$') },
        ],
        correct: 'b',
        reveal: L(
          'Písmeno V se špičkou v $x = 2$. Přímka $y = x - 2$ je pod osou pro $x < 2$; absolutní hodnota tuhle část překlopí nahoru. Špička je tam, kde je vnitřek nulový.',
          'A V with its tip at $x = 2$. The line $y = x - 2$ is below the axis for $x < 2$; the absolute value flips that part upwards. The tip is where the inside is zero.',
        ),
      },
      {
        kind: 'explore',
        lab: { tool: 'absolute', preset: { a: 1, m: 2, n: 0 } },
        task: L(
          'Měň $m$ a $n$ a sleduj špičku. Pak nastav $a$ na záporné číslo. A nakonec zkus $a = 3$.',
          'Change $m$ and $n$ and watch the tip. Then make $a$ negative. Finally try $a = 3$.',
        ),
        observe: L(
          'Špička je vždy v bodě $[m; n]$. Záporné $a$ obrátí V vzhůru nohama, větší $|a|$ ho zúží — ramena mají směrnice $a$ a $-a$.',
          'The tip is always at $(m, n)$. A negative $a$ turns the V upside down, a larger $|a|$ narrows it — the arms have slopes $a$ and $-a$.',
        ),
      },
      {
        kind: 'text',
        body: L(
          'Funkce $y = a|x - m| + n$ je **po částech lineární**: vpravo od $m$ je to přímka $y = a(x - m) + n$, vlevo přímka $y = -a(x - m) + n$. Dvě přímky, které se potkají ve vrcholu.',
          'The function $y = a|x - m| + n$ is **piecewise linear**: right of $m$ it is the line $y = a(x - m) + n$, left of it the line $y = -a(x - m) + n$. Two lines meeting at the vertex.',
        ),
      },
      {
        kind: 'worked',
        title: L('Rozbor funkce $y = 2|x + 1| - 4$', 'Analysing $y = 2|x + 1| - 4$'),
        steps: [
          {
            math: 'x + 1 = 0 \\iff x = -1',
            text: L(
              'Vrchol je tam, kde je vnitřek absolutní hodnoty nulový.',
              'The vertex is where the inside of the absolute value is zero.',
            ),
            why: L(
              'Absolutní hodnota je nejmenší — nulová — právě tam. Všude jinde je kladná.',
              'That is exactly where the absolute value is smallest — zero. Everywhere else it is positive.',
            ),
          },
          {
            math: L('V = [-1;\\,-4]', 'V = (-1,\\,-4)'),
            text: L(
              'Funkční hodnota ve vrcholu je $2 \\cdot 0 - 4 = -4$.',
              'The value at the vertex is $2 \\cdot 0 - 4 = -4$.',
            ),
          },
          {
            math: L('H(f) = \\langle -4;\\, \\infty)', 'H(f) = [-4,\\, \\infty)'),
            text: L(
              '$a = 2 > 0$, graf se otevírá nahoru, vrchol je minimum.',
              '$a = 2 > 0$, the graph opens upwards, the vertex is the minimum.',
            ),
          },
          {
            math: '2|x + 1| = 4 \\iff |x + 1| = 2 \\iff x = 1 \\lor x = -3',
            text: L('Nulové body: kde je $y = 0$.', 'Zeros: where $y = 0$.'),
            why: L(
              'Absolutní hodnota 2 znamená vzdálenost 2 od čísla $-1$ — jedno číslo vpravo, jedno vlevo.',
              'An absolute value of 2 means a distance of 2 from $-1$ — one number to the right, one to the left.',
            ),
          },
        ],
      },
      { kind: 'check', generator: 'abs.graph.vertex', level: 1 },
      { kind: 'check', generator: 'abs.graph.read', level: 2 },
      {
        kind: 'summary',
        points: [
          L('$y = a|x - m| + n$ má vrchol $[m; n]$.', '$y = a|x - m| + n$ has its vertex at $(m, n)$.'),
          L(
            'Posun uvnitř funguje obráceně: $|x - 3|$ je posun doprava.',
            'A shift inside works the opposite way: $|x - 3|$ is a shift to the right.',
          ),
          L(
            'Znaménko $a$ určuje, zda je vrchol minimum, nebo maximum.',
            'The sign of $a$ decides whether the vertex is a minimum or a maximum.',
          ),
        ],
      },
    ],
  },

  // -------------------------------------------------------------------- abs.equations
  {
    concept: 'abs.equations',
    minutes: 12,
    steps: [
      {
        kind: 'predict',
        question: L('Kolik řešení má rovnice $|x - 3| = -2$?', 'How many solutions does $|x - 3| = -2$ have?'),
        options: [
          { id: 'a', text: L('žádné', 'none') },
          { id: 'b', text: L('jedno', 'one') },
          { id: 'c', text: L('dvě', 'two') },
        ],
        correct: 'a',
        reveal: L(
          'Žádné. Absolutní hodnota je vzdálenost a vzdálenost není záporná. Podívat se na pravou stranu dřív, než začneš počítat, ušetří celý výpočet — a chybu.',
          'None. An absolute value is a distance, and a distance is never negative. Looking at the right-hand side before computing saves the whole calculation — and a mistake.',
        ),
      },
      {
        kind: 'figure',
        figure: {
          view: { xMin: -2, xMax: 8, yMin: -2, yMax: 6 },
          aspect: 0.6,
          curves: [{ expr: 'abs(x-3)', color: 'a', label: 'y = |x − 3|' }],
          hlines: [{ y: 2, color: 'b', dashed: true }],
          points: [
            { x: 1, y: 2, color: 'b' },
            { x: 5, y: 2, color: 'b' },
          ],
        },
        caption: L(
          'Rovnice $|x - 3| = 2$ graficky: kde graf V protíná přímku $y = 2$. Dva průsečíky, $x = 1$ a $x = 5$ — obě čísla jsou od trojky vzdálená 2.',
          'The equation $|x - 3| = 2$ as a picture: where the V meets the line $y = 2$. Two intersections, $x = 1$ and $x = 5$ — both are at distance 2 from three.',
        ),
      },
      {
        kind: 'worked',
        title: L('Řešení rovnice $|2x - 1| = x + 4$', 'Solving $|2x - 1| = x + 4$'),
        steps: [
          {
            math: '2x - 1 = 0 \\iff x = \\tfrac{1}{2}',
            text: L('Nulový bod rozdělí osu na dvě části.', 'The critical point splits the line into two parts.'),
            why: L(
              'Vnitřek mění znaménko jen v nulovém bodě. V každé části má tedy absolutní hodnota jeden pevný tvar.',
              'The inside changes sign only at its zero. So in each part the absolute value has one fixed form.',
            ),
          },
          {
            math: 'x \\ge \\tfrac{1}{2}: \\quad 2x - 1 = x + 4 \\;\\Rightarrow\\; x = 5',
            text: L(
              'První případ: vnitřek je nezáporný, absolutní hodnotu vynechám.',
              'First case: the inside is non-negative, so I drop the absolute value.',
            ),
            why: L(
              '$5 \\ge \\tfrac{1}{2}$, kořen do svého případu patří.',
              '$5 \\ge \\tfrac{1}{2}$, so the root belongs to its case.',
            ),
          },
          {
            math: 'x < \\tfrac{1}{2}: \\quad -(2x - 1) = x + 4 \\;\\Rightarrow\\; x = -1',
            text: L(
              'Druhý případ: vnitřek je záporný, absolutní hodnota mění jeho znaménko.',
              'Second case: the inside is negative, so the absolute value flips its sign.',
            ),
            why: L(
              '$-1 < \\tfrac{1}{2}$, kořen do svého případu patří.',
              '$-1 < \\tfrac{1}{2}$, so the root belongs to its case.',
            ),
          },
          {
            math: L('K = \\{-1;\\, 5\\}', 'K = \\{-1,\\, 5\\}'),
            text: L(
              'Zkouška: $|2 \\cdot 5 - 1| = 9 = 5 + 4$ a $|2 \\cdot (-1) - 1| = 3 = -1 + 4$.',
              'Check: $|2 \\cdot 5 - 1| = 9 = 5 + 4$ and $|2 \\cdot (-1) - 1| = 3 = -1 + 4$.',
            ),
            why: L(
              'Když je neznámá i vpravo, může z některého případu vypadnout kořen, který do něj nepatří. Proto vždy kontroluj.',
              'When the unknown is also on the right, a case can produce a root that does not belong to it. So always check.',
            ),
          },
        ],
      },
      { kind: 'check', generator: 'abs.equations.basic', level: 1 },
      { kind: 'check', generator: 'abs.equations.basic', level: 2 },
      { kind: 'check', generator: 'abs.equations.find-mistake', level: 2 },
      {
        kind: 'summary',
        points: [
          L(
            'Nejdřív se podívej na pravou stranu: záporná znamená žádné řešení.',
            'Look at the right-hand side first: negative means no solution.',
          ),
          L('$|A| = c$ pro $c > 0$: $A = c$ nebo $A = -c$.', '$|A| = c$ for $c > 0$: $A = c$ or $A = -c$.'),
          L(
            'Je-li neznámá i vpravo, řeš po případech a každý kořen ověř.',
            'If the unknown is on the right too, solve by cases and verify every root.',
          ),
        ],
      },
    ],
  },

  // ----------------------------------------------------------------------- quad.graph
  {
    concept: 'quad.graph',
    minutes: 12,
    steps: [
      {
        kind: 'predict',
        question: L(
          'Bez počítání: ve kterém bodě protíná parabola $y = 3x^2 - 7x + 5$ osu $y$?',
          'Without computing: where does the parabola $y = 3x^2 - 7x + 5$ cross the $y$-axis?',
        ),
        options: [
          { id: 'a', text: L('$[0; 3]$', '$(0, 3)$') },
          { id: 'b', text: L('$[0; -7]$', '$(0, -7)$') },
          { id: 'c', text: L('$[0; 5]$', '$(0, 5)$') },
          { id: 'd', text: L('to se nedá říct bez diskriminantu', 'you cannot tell without the discriminant') },
        ],
        correct: 'c',
        reveal: L(
          'V bodě $[0; 5]$. Na ose $y$ je $x = 0$ a po dosazení nuly zmizí vše kromě absolutního členu. Koeficient $c$ je tedy vidět na grafu přímo.',
          'At $(0, 5)$. On the $y$-axis $x = 0$, and substituting zero wipes out everything but the constant term. So $c$ can be read off the graph directly.',
        ),
      },
      {
        kind: 'explore',
        lab: { tool: 'quadratic', preset: { a: 1, b: 0, c: 0, form: 'standard' } },
        task: L(
          'Tři pokusy, vždy měň jen jeden koeficient. 1) $a$: co dělá znaménko a co velikost? 2) $c$. 3) $b$ — sleduj, po jaké dráze se pohybuje vrchol.',
          'Three experiments, changing one coefficient at a time. 1) $a$: what does its sign do, and its size? 2) $c$. 3) $b$ — watch the path the vertex travels.',
        ),
        observe: L(
          '$a$: znaménko otevírá parabolu nahoru nebo dolů, velikost ji zužuje. $c$: posouvá celý graf svisle. $b$: posouvá vrchol do strany — a ten přitom klouže po jiné parabole.',
          '$a$: its sign opens the parabola up or down, its size narrows it. $c$: moves the whole graph vertically. $b$: moves the vertex sideways — and it slides along another parabola as it does.',
        ),
      },
      {
        kind: 'text',
        body: L(
          'Tři otázky, na které umíš z předpisu odpovědět hned: **kam se otevírá** (znaménko $a$), **kde protíná osu $y$** (číslo $c$) a **kolikrát protíná osu $x$** (diskriminant).',
          'Three questions the formula answers immediately: **which way it opens** (the sign of $a$), **where it crosses the $y$-axis** (the number $c$), and **how many times it crosses the $x$-axis** (the discriminant).',
        ),
      },
      {
        kind: 'worked',
        title: L('Náčrtek paraboly $y = x^2 - 2x - 3$', 'Sketching $y = x^2 - 2x - 3$'),
        steps: [
          {
            text: L(
              '$a = 1 > 0$: otevírá se nahoru. Osu $y$ protíná v $-3$.',
              '$a = 1 > 0$: it opens upwards. It crosses the $y$-axis at $-3$.',
            ),
          },
          {
            math: 'x^2 - 2x - 3 = (x - 3)(x + 1) = 0 \\;\\Rightarrow\\; x = 3 \\lor x = -1',
            text: L('Průsečíky s osou $x$.', 'The $x$-intercepts.'),
            why: L(
              'Hledám dvě čísla se součinem $-3$ a součtem $-2$: jsou to $-3$ a $1$.',
              'I need two numbers with product $-3$ and sum $-2$: they are $-3$ and $1$.',
            ),
          },
          {
            math: 'x_V = \\frac{-1 + 3}{2} = 1, \\quad y_V = 1 - 2 - 3 = -4',
            text: L('Vrchol leží uprostřed mezi průsečíky.', 'The vertex lies midway between the intercepts.'),
            why: L(
              'Parabola je souměrná podle svislé osy procházející vrcholem.',
              'A parabola is symmetric about the vertical line through its vertex.',
            ),
          },
        ],
      },
      {
        kind: 'figure',
        figure: {
          view: { xMin: -4, xMax: 6, yMin: -6, yMax: 6 },
          aspect: 0.75,
          curves: [{ expr: 'x^2-2x-3', color: 'a' }],
          vlines: [{ x: 1, color: 'muted', dashed: true }],
          points: [
            { x: -1, y: 0, color: 'b' },
            { x: 3, y: 0, color: 'b' },
            { x: 0, y: -3, color: 'c' },
            { x: 1, y: -4, color: 'a', label: 'V' },
          ],
        },
        caption: L(
          'Čtyři body a osa souměrnosti stačí na slušný náčrtek.',
          'Four points and the axis of symmetry are enough for a decent sketch.',
        ),
      },
      { kind: 'check', generator: 'quad.graph.features', level: 1 },
      { kind: 'check', generator: 'quad.graph.features', level: 2 },
      {
        kind: 'summary',
        points: [
          L(
            'Znaménko $a$: nahoru, nebo dolů. Velikost $a$: úzká, nebo široká.',
            'Sign of $a$: up or down. Size of $a$: narrow or wide.',
          ),
          L('$c$ je průsečík s osou $y$.', '$c$ is the $y$-intercept.'),
          L(
            'Průsečíky s osou $x$ jsou kořeny rovnice $ax^2 + bx + c = 0$.',
            'The $x$-intercepts are the roots of $ax^2 + bx + c = 0$.',
          ),
        ],
      },
    ],
  },

  // ---------------------------------------------------------------------- quad.vertex
  {
    concept: 'quad.vertex',
    minutes: 14,
    steps: [
      {
        kind: 'predict',
        question: L(
          'Parabola protíná osu $x$ v bodech $x = 1$ a $x = 5$. Jakou $x$-ovou souřadnici má její vrchol?',
          'A parabola crosses the $x$-axis at $x = 1$ and $x = 5$. What is the $x$-coordinate of its vertex?',
        ),
        options: [
          { id: 'a', text: L('$1$', '$1$') },
          { id: 'b', text: L('$3$', '$3$') },
          { id: 'c', text: L('$5$', '$5$') },
          { id: 'd', text: L('nedá se určit bez předpisu', 'it cannot be found without the formula') },
        ],
        correct: 'b',
        reveal: L(
          '$3$ — přesně uprostřed. Parabola je souměrná, takže vrchol leží v polovině mezi kořeny, ať je předpis jakýkoli. Tohle je často nejrychlejší cesta k vrcholu.',
          '$3$ — exactly in the middle. A parabola is symmetric, so the vertex lies halfway between the roots whatever the formula. This is often the quickest route to the vertex.',
        ),
      },
      {
        kind: 'worked',
        title: L('Odkud se bere $-\\frac{b}{2a}$', 'Where $-\\frac{b}{2a}$ comes from'),
        steps: [
          {
            math: 'x_{1,2} = \\frac{-b \\pm \\sqrt{D}}{2a}',
            text: L('Kořeny kvadratické rovnice.', 'The roots of the quadratic equation.'),
          },
          {
            math: 'x_V = \\frac{x_1 + x_2}{2} = \\frac{1}{2}\\cdot\\frac{-2b}{2a} = -\\frac{b}{2a}',
            text: L(
              'Vrchol je uprostřed mezi nimi; odmocniny se při sčítání odečtou.',
              'The vertex is halfway between them; the square roots cancel when added.',
            ),
            why: L(
              'Vzorec tedy platí i tehdy, když parabola osu $x$ neprotíná — odmocnina v něm vůbec nevystupuje.',
              'So the formula also works when the parabola never meets the $x$-axis — the square root does not appear in it at all.',
            ),
          },
        ],
      },
      {
        kind: 'explore',
        lab: { tool: 'quadratic', preset: { a: 1, m: 2, n: -1, form: 'vertex' } },
        task: L(
          'Parabola je teď zadaná vrcholovým tvarem $y = a(x - m)^2 + n$. Přesuň vrchol do bodu $[-3; 2]$. Jak budou vypadat $m$ a $n$? A jak závorka?',
          'The parabola is now given in vertex form $y = a(x - m)^2 + n$. Move the vertex to $(-3, 2)$. What are $m$ and $n$? And what does the bracket look like?',
        ),
        observe: L(
          '$m = -3$, $n = 2$, takže závorka je $(x + 3)$. Znaménko v závorce je vždy opačné než $x$-ová souřadnice vrcholu — nejčastější chyba v celé kapitole.',
          '$m = -3$, $n = 2$, so the bracket is $(x + 3)$. The sign in the bracket is always opposite to the $x$-coordinate of the vertex — the most common mistake in the whole chapter.',
        ),
      },
      {
        kind: 'worked',
        title: L('Vrchol paraboly $y = 2x^2 - 12x + 13$', 'The vertex of $y = 2x^2 - 12x + 13$'),
        steps: [
          {
            math: 'x_V = -\\frac{-12}{2 \\cdot 2} = \\frac{12}{4} = 3',
            text: L(
              'Dosadím do vzorce — $b$ i se znaménkem a v závorce.',
              'Substitute into the formula — $b$ with its sign, in brackets.',
            ),
            why: L(
              '$b = -12$, takže $-b = 12$. Dvě minus dají plus; tady se ztrácí nejvíc bodů.',
              '$b = -12$, so $-b = 12$. Two minuses make a plus; this is where most marks are lost.',
            ),
          },
          {
            math: 'y_V = 2 \\cdot 3^2 - 12 \\cdot 3 + 13 = 18 - 36 + 13 = -5',
            text: L('Druhou souřadnici dostanu dosazením.', 'The second coordinate comes from substituting.'),
          },
          {
            math: L('V = [3;\\,-5], \\qquad y = 2(x - 3)^2 - 5', 'V = (3,\\,-5), \\qquad y = 2(x - 3)^2 - 5'),
            text: L(
              'Vrchol a rovnou i vrcholový tvar: $a$ zůstává, $m$ a $n$ jsou souřadnice vrcholu.',
              'The vertex, and with it the vertex form: $a$ stays, $m$ and $n$ are the coordinates of the vertex.',
            ),
            why: L(
              'Kontrola roznásobením: $2(x^2 - 6x + 9) - 5 = 2x^2 - 12x + 13$.',
              'Check by expanding: $2(x^2 - 6x + 9) - 5 = 2x^2 - 12x + 13$.',
            ),
          },
        ],
      },
      { kind: 'check', generator: 'quad.vertex.from-standard', level: 1 },
      { kind: 'check', generator: 'quad.vertex.from-standard', level: 2 },
      { kind: 'check', generator: 'quad.vertex.find-mistake', level: 2 },
      {
        kind: 'summary',
        points: [
          L('$x_V = -\\dfrac{b}{2a}$, $y_V = f(x_V)$.', '$x_V = -\\dfrac{b}{2a}$, $y_V = f(x_V)$.'),
          L(
            'Vrchol je uprostřed mezi kořeny — pokud nějaké jsou.',
            'The vertex is midway between the roots — if there are any.',
          ),
          L(
            'Vrcholový tvar $a(x - m)^2 + n$ ukazuje vrchol $[m; n]$ přímo. Pozor na znaménko u $m$.',
            'Vertex form $a(x - m)^2 + n$ shows the vertex $(m, n)$ directly. Mind the sign of $m$.',
          ),
        ],
      },
    ],
  },

  // ------------------------------------------------------------------ quad.inequality
  {
    concept: 'quad.inequality',
    minutes: 11,
    steps: [
      {
        kind: 'predict',
        question: L(
          'Parabola $y = x^2 - 4$ má kořeny $-2$ a $2$. Kde je $x^2 - 4 < 0$?',
          'The parabola $y = x^2 - 4$ has roots $-2$ and $2$. Where is $x^2 - 4 < 0$?',
        ),
        options: [
          { id: 'a', text: L('pro $x < 2$', 'for $x < 2$') },
          { id: 'b', text: L('mezi kořeny, $x \\in (-2; 2)$', 'between the roots, $x \\in (-2, 2)$') },
          { id: 'c', text: L('vně kořenů', 'outside the roots') },
          { id: 'd', text: L('pro $x < \\pm 2$', 'for $x < \\pm 2$') },
        ],
        correct: 'b',
        reveal: L(
          'Mezi kořeny. Parabola se otevírá nahoru, takže pod osou je jen mezi místy, kde ji protíná. Odpověď „$x < \\pm 2$“ vypadá jako výpočet, ale nic neznamená — nerovnici neodmocňuj, kresli.',
          'Between the roots. The parabola opens upwards, so it is below the axis only between the places where it crosses. The answer “$x < \\pm 2$” looks like a calculation but means nothing — do not take square roots of an inequality; draw.',
        ),
      },
      {
        kind: 'figure',
        figure: {
          view: { xMin: -5, xMax: 5, yMin: -6, yMax: 8 },
          aspect: 0.7,
          curves: [{ expr: 'x^2-4', color: 'a' }],
          segments: [{ from: [-2, 0], to: [2, 0], color: 'bad' }],
          points: [
            { x: -2, y: 0, color: 'b', hollow: true },
            { x: 2, y: 0, color: 'b', hollow: true },
          ],
        },
        caption: L(
          'Řešení nerovnice je úsek osy $x$, nad kterým (nebo pod kterým) parabola leží. Prázdná kolečka: ostrá nerovnost, kořeny nepatří.',
          'The solution of the inequality is the stretch of the $x$-axis above (or below) which the parabola lies. Hollow dots: strict inequality, roots excluded.',
        ),
      },
      {
        kind: 'worked',
        title: L('Řešení nerovnice $-x^2 + 2x + 8 \\ge 0$', 'Solving $-x^2 + 2x + 8 \\ge 0$'),
        steps: [
          {
            math: '-x^2 + 2x + 8 = 0 \\iff x^2 - 2x - 8 = 0 \\iff (x - 4)(x + 2) = 0',
            text: L('Nejdřív kořeny: $x = 4$ a $x = -2$.', 'Roots first: $x = 4$ and $x = -2$.'),
            why: L(
              'Rovnici smím vynásobit $-1$. U nerovnice bych musel otočit znak — proto raději pracuju s grafem.',
              'I may multiply the equation by $-1$. With the inequality I would have to flip the sign — which is why I prefer to work from the graph.',
            ),
          },
          {
            text: L(
              '$a = -1 < 0$: parabola se otevírá dolů. Nad osou je tedy mezi kořeny.',
              '$a = -1 < 0$: the parabola opens downwards. So it is above the axis between the roots.',
            ),
          },
          {
            math: L('x \\in \\langle -2;\\, 4\\rangle', 'x \\in [-2,\\, 4]'),
            text: L(
              'Nerovnost je neostrá, kořeny do řešení patří.',
              'The inequality is not strict, so the roots are included.',
            ),
            why: L(
              'V kořenech je hodnota přesně 0 a $0 \\ge 0$ platí.',
              'At the roots the value is exactly 0, and $0 \\ge 0$ is true.',
            ),
          },
        ],
      },
      { kind: 'check', generator: 'quad.inequality.solve', level: 2 },
      { kind: 'check', generator: 'quad.inequality.solve', level: 3 },
      {
        kind: 'summary',
        points: [
          L(
            'Kořeny, směr otevření, náčrtek. Řešení se čte z obrázku.',
            'Roots, opening direction, sketch. Read the solution off the picture.',
          ),
          L(
            'Ostrá nerovnost: kulaté závorky. Neostrá: kořeny patří.',
            'Strict inequality: round brackets. Non-strict: roots included.',
          ),
          L(
            'Bez kořenů ($D < 0$) výraz nemění znaménko: řešením je $\\mathbb{R}$, nebo $\\emptyset$.',
            'With no roots ($D < 0$) the expression never changes sign: the solution is $\\mathbb{R}$ or $\\emptyset$.',
          ),
        ],
      },
    ],
  },
];
