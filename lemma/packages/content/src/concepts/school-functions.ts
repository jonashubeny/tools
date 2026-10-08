import { L, type Concept } from '@lemma/core';

/** Syllabus topics 1–6: linear, absolute-value, quadratic, power and inverse functions. */
export const FUNCTION_CONCEPTS: Concept[] = [
  // ------------------------------------------------------------------ 1 linear functions
  {
    id: 'lin.graph',
    title: L('Lineární funkce: směrnice a graf', 'Linear functions: slope and graph'),
    summary: L(
      'Z předpisu $y = ax + b$ vyčíst směrnici a průsečíky s osami a naopak z grafu sestavit předpis.',
      'Read slope and intercepts from $y = ax + b$, and build the formula from a graph.',
    ),
    area: 'functions',
    track: 'school',
    syllabusTopic: 1,
    prereqs: ['fn.concept', 'alg.linear-eq'],
    why: {
      intuition: L(
        'Směrnice $a$ říká, o kolik se změní $y$, když $x$ vzroste o 1. Číslo $b$ říká, kde graf startuje na ose $y$.',
        'The slope $a$ says how much $y$ changes when $x$ grows by 1. The number $b$ says where the graph starts on the $y$-axis.',
      ),
      formal: L(
        'Lineární funkce je každá funkce $f: y = ax + b$, $a, b \\in \\mathbb{R}$. Pro $a > 0$ je rostoucí, pro $a < 0$ klesající, pro $a = 0$ konstantní.',
        'A linear function is any $f: y = ax + b$, $a, b \\in \\mathbb{R}$. It is increasing for $a > 0$, decreasing for $a < 0$, constant for $a = 0$.',
      ),
      visual: L(
        'Směrnice je „schod“: jeden krok doprava, $a$ kroků nahoru. Čím větší $|a|$, tím strmější přímka.',
        'Slope is a “stair”: one step right, $a$ steps up. The larger $|a|$, the steeper the line.',
      ),
      algebraic: L(
        'Ze dvou bodů: $a = \\frac{y_2 - y_1}{x_2 - x_1}$ — změna $y$ dělená změnou $x$.',
        'From two points: $a = \\frac{y_2 - y_1}{x_2 - x_1}$ — the change in $y$ divided by the change in $x$.',
      ),
      it: L(
        'Lineární interpolace (`lerp`) v grafice a hrách je lineární funkce. Stejně tak převod jednotek nebo cena „paušál + za kus“. Směrnice je rychlost změny — první krok k derivaci.',
        'Linear interpolation (`lerp`) in graphics and games is a linear function. So is a unit conversion, or a “flat fee plus per item” price. Slope is a rate of change — the first step towards the derivative.',
      ),
    },
    terms: [
      { cs: 'směrnice', en: 'slope' },
      { cs: 'absolutní člen', en: 'constant term / y-intercept' },
      { cs: 'průsečík s osou', en: 'intercept' },
      { cs: 'přímá úměrnost', en: 'direct proportion' },
    ],
    fit: ['ISM', 'IMA1'],
    lab: { tool: 'linear' },
  },
  {
    id: 'lin.from-points',
    title: L('Předpis lineární funkce z bodů', 'Finding a linear function from points'),
    summary: L(
      'Určit předpis přímky ze dvou bodů nebo z bodu a směrnice; najít průsečík dvou přímek.',
      'Find the equation of a line from two points, or a point and a slope; find where two lines meet.',
    ),
    area: 'functions',
    track: 'school',
    syllabusTopic: 1,
    prereqs: ['lin.graph'],
    why: {
      intuition: L(
        'Dva body určují přímku. Nejdřív zjistíš sklon (směrnici), pak dosazením jednoho bodu zjistíš, kde přímka protíná osu $y$.',
        'Two points determine a line. First find the tilt (slope), then substitute one point to find where the line crosses the $y$-axis.',
      ),
      algebraic: L(
        'Průsečík dvou přímek je řešení soustavy: obě rovnice musí platit zároveň, tedy $a_1x + b_1 = a_2x + b_2$.',
        'The intersection of two lines solves a system: both equations hold at once, so $a_1x + b_1 = a_2x + b_2$.',
      ),
      it: L(
        'Kalibrace senzoru ze dvou měření, bod zvratu dvou tarifů, odhad času zálohy z dvou měření rychlosti — všechno je přímka ze dvou bodů.',
        'Calibrating a sensor from two readings, the break-even point of two tariffs, estimating backup time from two speed samples — each is a line through two points.',
      ),
    },
    fit: ['ISM', 'ILG'],
  },
  {
    id: 'lin.model',
    title: L('Lineární modely', 'Linear models'),
    summary: L(
      'Popsat reálnou situaci lineární funkcí a z modelu vyčíst odpověď včetně jednotek.',
      'Describe a real situation with a linear function and read the answer off the model, units included.',
    ),
    area: 'functions',
    track: 'school',
    syllabusTopic: 1,
    prereqs: ['lin.from-points'],
    why: {
      intuition: L(
        'Model je předpis, který nahradí tabulku. Kdykoli něco roste stálou rychlostí, je za tím lineární funkce.',
        'A model is a formula that replaces a table. Whenever something grows at a constant rate, a linear function is behind it.',
      ),
      it: L(
        'Zaplnění disku při stálém přírůstku logů, výdrž baterie při stálém odběru, cena cloudu za hodinu běhu.',
        'A disk filling at a steady log rate, battery life at constant draw, the cost of a cloud instance per hour.',
      ),
    },
    fit: ['ISM'],
  },

  // --------------------------------------------------------------- 2 absolute value, linear
  {
    id: 'abs.graph',
    title: L('Graf funkce s absolutní hodnotou', 'Graphs with absolute value'),
    summary: L(
      'Načrtnout $y = a|x - m| + n$, určit vrchol, obor hodnot a monotonii.',
      'Sketch $y = a|x - m| + n$ and find its vertex, range and monotonicity.',
    ),
    area: 'functions',
    track: 'school',
    syllabusTopic: 2,
    prereqs: ['lin.graph', 'alg.abs-value', 'fn.transform'],
    why: {
      intuition: L(
        'Absolutní hodnota překlopí vše, co je pod osou $x$, nahoru. Z přímky tak vznikne písmeno V.',
        'The absolute value flips everything below the $x$-axis upwards. A straight line becomes a letter V.',
      ),
      formal: L(
        '$y = |x - m|$ je po částech lineární: pro $x \\ge m$ je to $y = x - m$, pro $x < m$ je to $y = -(x - m)$.',
        '$y = |x - m|$ is piecewise linear: for $x \\ge m$ it is $y = x - m$, for $x < m$ it is $y = -(x - m)$.',
      ),
      visual: L(
        'Vrchol V leží v bodě $[m; n]$ — tam, kde je vnitřek absolutní hodnoty nulový.',
        'The tip of the V is at $(m, n)$ — where the inside of the absolute value is zero.',
      ),
      it: L(
        'Chyba měření se počítá jako $|\\text{naměřeno} - \\text{skutečnost}|$. Vzdálenost na mřížce (Manhattan) je $|x_1 - x_2| + |y_1 - y_2|$ — tolik kroků ujde robot, který se smí hýbat jen vodorovně a svisle.',
        'Measurement error is $|\\text{measured} - \\text{actual}|$. Grid (Manhattan) distance is $|x_1 - x_2| + |y_1 - y_2|$ — the number of steps for a robot that may only move horizontally and vertically.',
      ),
    },
    terms: [{ cs: 'funkce po částech lineární', en: 'piecewise linear function' }],
    fit: ['ISM'],
    lab: { tool: 'absolute' },
  },
  {
    id: 'abs.piecewise',
    title: L('Metoda nulových bodů', 'The critical-point method'),
    summary: L(
      'Rozdělit osu nulovými body a v každém intervalu zapsat výraz bez absolutní hodnoty.',
      'Split the number line at the critical points and rewrite the expression without absolute values on each interval.',
    ),
    area: 'functions',
    track: 'school',
    syllabusTopic: 2,
    prereqs: ['abs.graph', 'alg.linear-ineq'],
    why: {
      intuition: L(
        'Znaménko vnitřku absolutní hodnoty se může změnit jen v nulovém bodě. Mezi nulovými body je tedy pořád stejné a absolutní hodnotu jde odstranit.',
        'The sign of what is inside an absolute value can change only at its zero. Between zeros it stays the same, so the absolute value can be removed.',
      ),
      algebraic: L(
        'Pro $|x-1| + |x+2|$: nulové body $-2$ a $1$ dělí osu na tři intervaly; v každém má výraz jiný, obyčejný lineární předpis.',
        'For $|x-1| + |x+2|$: the critical points $-2$ and $1$ split the line into three intervals; on each the expression has a different, plain linear formula.',
      ),
      it: L(
        'Je to totéž jako rozepsat vnořené podmínky do větví `if / else if / else` podle toho, do kterého intervalu vstup padne.',
        'It is the same as unfolding nested conditions into `if / else if / else` branches according to which interval the input falls in.',
      ),
    },
    terms: [{ cs: 'nulový bod', en: 'critical point' }],
    fit: ['ISM'],
  },
  {
    id: 'abs.equations',
    title: L('Rovnice s absolutní hodnotou', 'Equations with absolute value'),
    summary: L(
      'Vyřešit rovnice typu $|ax+b| = c$ a $|ax+b| = cx + d$ a vyloučit kořeny, které nevyhovují.',
      'Solve equations such as $|ax+b| = c$ and $|ax+b| = cx + d$ and discard roots that do not fit.',
    ),
    area: 'functions',
    track: 'school',
    syllabusTopic: 2,
    prereqs: ['abs.piecewise', 'alg.linear-eq'],
    why: {
      intuition: L(
        '$|x - 3| = 2$ znamená „vzdálenost od trojky je 2“. Taková čísla jsou dvě: jedno vlevo, jedno vpravo.',
        '$|x - 3| = 2$ means “the distance from three is 2”. There are two such numbers: one to the left, one to the right.',
      ),
      formal: L(
        'Pro $c > 0$: $|A| = c \\iff A = c \\lor A = -c$. Pro $c < 0$ rovnice nemá řešení — vzdálenost není záporná.',
        'For $c > 0$: $|A| = c \\iff A = c \\lor A = -c$. For $c < 0$ there is no solution — a distance is never negative.',
      ),
      visual: L(
        'Graficky hledáš průsečíky grafu V s přímkou. Mohou být dva, jeden, nebo žádný.',
        'Graphically you look for where the V meets a line. There may be two points, one, or none.',
      ),
    },
    fit: ['ISM'],
  },
  {
    id: 'abs.inequalities',
    title: L('Nerovnice s absolutní hodnotou', 'Inequalities with absolute value'),
    summary: L(
      'Vyřešit $|ax+b| < c$ a $|ax+b| > c$ a zapsat řešení intervalem nebo sjednocením intervalů.',
      'Solve $|ax+b| < c$ and $|ax+b| > c$ and write the solution as an interval or a union of intervals.',
    ),
    area: 'functions',
    track: 'school',
    syllabusTopic: 2,
    prereqs: ['abs.equations', 'alg.linear-ineq'],
    why: {
      intuition: L(
        '$|x - 3| < 2$: čísla blíž k trojce než 2 — jeden interval. $|x - 3| > 2$: čísla dál než 2 — dva paprsky.',
        '$|x - 3| < 2$: numbers closer to three than 2 — one interval. $|x - 3| > 2$: numbers farther than 2 — two rays.',
      ),
      formal: L(
        'Pro $c > 0$: $|A| < c \\iff -c < A < c$ a $|A| > c \\iff A < -c \\lor A > c$.',
        'For $c > 0$: $|A| < c \\iff -c < A < c$, and $|A| > c \\iff A < -c \\lor A > c$.',
      ),
      it: L(
        'Tolerance je nerovnice s absolutní hodnotou: napětí je v pořádku, když $|U - 5| \\le 0{,}25$. Tak se porovnávají i desetinná čísla v testech: `abs(a - b) < eps`.',
        'A tolerance is an absolute-value inequality: a voltage is fine when $|U - 5| \\le 0.25$. Floating-point values are compared in tests the same way: `abs(a - b) < eps`.',
      ),
    },
    fit: ['ISM', 'IMA1'],
  },

  // ----------------------------------------------------------------- 3 quadratic functions
  {
    id: 'quad.graph',
    title: L('Parabola a role koeficientů', 'The parabola and its coefficients'),
    summary: L(
      'Vědět, co s grafem $y = ax^2 + bx + c$ dělá každý z koeficientů, a určit průsečíky s osami.',
      'Know what each coefficient of $y = ax^2 + bx + c$ does to the graph, and find the intercepts.',
    ),
    area: 'functions',
    track: 'school',
    syllabusTopic: 3,
    prereqs: ['lin.graph', 'alg.quad-eq', 'fn.transform'],
    why: {
      intuition: L(
        '$a$ určuje tvar: znaménko říká, jestli se parabola otevírá nahoru nebo dolů, velikost jak je úzká. $c$ je místo, kde protíná osu $y$. $b$ posouvá vrchol do strany.',
        '$a$ sets the shape: its sign says whether the parabola opens up or down, its size how narrow it is. $c$ is where it crosses the $y$-axis. $b$ slides the vertex sideways.',
      ),
      formal: L(
        'Kvadratická funkce je $f: y = ax^2 + bx + c$ s $a \\ne 0$. Definiční obor je $\\mathbb{R}$; obor hodnot je polopřímka začínající ve vrcholu.',
        'A quadratic function is $f: y = ax^2 + bx + c$ with $a \\ne 0$. Its domain is $\\mathbb{R}$; its range is a ray starting at the vertex.',
      ),
      visual: L(
        'Zkus v laboratoři hýbat jen koeficientem $b$: vrchol se pohybuje po jiné parabole, $y = -ax^2 + c$.',
        'Try moving only $b$ in the Lab: the vertex travels along another parabola, $y = -ax^2 + c$.',
      ),
      algebraic: L(
        'Průsečík s osou $y$: dosadíš $x = 0$, vyjde $c$. Průsečíky s osou $x$: řešíš $ax^2 + bx + c = 0$.',
        'The $y$-intercept: substitute $x = 0$ and get $c$. The $x$-intercepts: solve $ax^2 + bx + c = 0$.',
      ),
      it: L(
        'Šikmý vrh ve hře je parabola v čase. Algoritmus se dvěma vnořenými cykly dělá zhruba $n^2$ kroků — proto se třídění bublinkou na velkých datech nepoužívá.',
        'A projectile in a game follows a parabola in time. An algorithm with two nested loops takes about $n^2$ steps — which is why bubble sort is not used on large data.',
      ),
    },
    terms: [
      { cs: 'parabola', en: 'parabola' },
      { cs: 'kvadratický, lineární, absolutní člen', en: 'quadratic, linear, constant term' },
    ],
    fit: ['ISM', 'IMA1', 'IAL'],
    lab: { tool: 'quadratic' },
  },
  {
    id: 'quad.vertex',
    title: L('Vrchol a vrcholový tvar', 'Vertex and vertex form'),
    summary: L(
      'Najít vrchol paraboly a převádět mezi tvary $ax^2+bx+c$ a $a(x-m)^2+n$.',
      'Find the vertex of a parabola and convert between $ax^2+bx+c$ and $a(x-m)^2+n$.',
    ),
    area: 'functions',
    track: 'school',
    syllabusTopic: 3,
    prereqs: ['quad.graph', 'alg.complete-square'],
    encompasses: [{ id: 'alg.complete-square', w: 0.5 }],
    why: {
      intuition: L(
        'Vrcholový tvar je parabola $y = ax^2$ posunutá o $m$ doprava a o $n$ nahoru. Vrchol je tedy vidět přímo: $[m; n]$.',
        'Vertex form is the parabola $y = ax^2$ shifted $m$ to the right and $n$ up. So the vertex is visible directly: $(m, n)$.',
      ),
      formal: L(
        'Vrchol $V[m; n]$, kde $m = -\\frac{b}{2a}$ a $n = f(m)$. Osa paraboly je přímka $x = m$.',
        'The vertex is $V(m, n)$ with $m = -\\frac{b}{2a}$ and $n = f(m)$. The axis of the parabola is the line $x = m$.',
      ),
      visual: L(
        'Parabola je souměrná podle své osy, takže vrchol leží přesně uprostřed mezi nulovými body: $m = \\frac{x_1 + x_2}{2}$.',
        'A parabola is symmetric about its axis, so the vertex lies exactly midway between the zeros: $m = \\frac{x_1 + x_2}{2}$.',
      ),
      algebraic: L(
        'Vzorec $-\\frac{b}{2a}$ vypadne z doplnění na čtverec: $ax^2 + bx + c = a\\left(x + \\frac{b}{2a}\\right)^2 + c - \\frac{b^2}{4a}$.',
        'The formula $-\\frac{b}{2a}$ falls out of completing the square: $ax^2 + bx + c = a\\left(x + \\frac{b}{2a}\\right)^2 + c - \\frac{b^2}{4a}$.',
      ),
      it: L(
        'Hledání vrcholu je nejjednodušší optimalizace: najít vstup, pro který je výstup nejmenší nebo největší. Trénování neuronové sítě dělá totéž, jen s miliony proměnných.',
        'Finding the vertex is the simplest optimisation: find the input that makes the output smallest or largest. Training a neural network does the same with millions of variables.',
      ),
    },
    terms: [
      { cs: 'vrchol paraboly', en: 'vertex' },
      { cs: 'osa paraboly', en: 'axis of symmetry' },
      { cs: 'vrcholový tvar', en: 'vertex form' },
    ],
    fit: ['ISM', 'IMA1'],
    lab: { tool: 'quadratic', preset: { form: 'vertex' } },
  },
  {
    id: 'quad.roots-form',
    title: L('Nulové body a součinový tvar', 'Zeros and factored form'),
    summary: L(
      'Zapsat kvadratickou funkci ve tvaru $a(x-x_1)(x-x_2)$ a určit, kde je kladná a kde záporná.',
      'Write a quadratic as $a(x-x_1)(x-x_2)$ and determine where it is positive and where negative.',
    ),
    area: 'functions',
    track: 'school',
    syllabusTopic: 3,
    prereqs: ['quad.graph', 'alg.quad-eq'],
    encompasses: [{ id: 'alg.quad-eq', w: 0.6 }],
    why: {
      intuition: L(
        'Každý tvar něco ukazuje na první pohled: obecný průsečík s osou $y$, vrcholový vrchol, součinový nulové body.',
        'Each form shows something at a glance: standard form the $y$-intercept, vertex form the vertex, factored form the zeros.',
      ),
      algebraic: L(
        'Viètovy vzorce pro $x^2 + px + q$: $x_1 + x_2 = -p$, $x_1 x_2 = q$. Kořeny se tak často dají uhodnout bez diskriminantu.',
        "Vieta's formulas for $x^2 + px + q$: $x_1 + x_2 = -p$, $x_1 x_2 = q$. Roots can often be guessed without the discriminant.",
      ),
      visual: L(
        'Mezi kořeny má funkce opačné znaménko než $a$, vně stejné jako $a$.',
        'Between the roots the function has the sign opposite to $a$; outside them, the same sign as $a$.',
      ),
    },
    terms: [
      { cs: 'nulový bod funkce', en: 'zero of a function' },
      { cs: 'součinový tvar', en: 'factored form' },
    ],
    fit: ['ISM'],
  },
  {
    id: 'quad.inequality',
    title: L('Kvadratické nerovnice', 'Quadratic inequalities'),
    summary: L(
      'Vyřešit kvadratickou nerovnici pomocí nulových bodů a náčrtku paraboly.',
      'Solve a quadratic inequality using the zeros and a sketch of the parabola.',
    ),
    area: 'functions',
    track: 'school',
    syllabusTopic: 3,
    prereqs: ['quad.roots-form', 'alg.linear-ineq'],
    why: {
      intuition: L(
        'Neřešíš nerovnici, čteš graf: kde je parabola nad osou $x$ a kde pod ní? Stačí znát kořeny a směr otevření.',
        'You do not solve the inequality, you read the graph: where is the parabola above the $x$-axis and where below? Roots and opening direction are enough.',
      ),
      formal: L(
        'Pro $a > 0$ a kořeny $x_1 < x_2$: $ax^2+bx+c < 0 \\iff x \\in (x_1; x_2)$. Pro $D < 0$ je výraz stále kladný — řešením je buď $\\mathbb{R}$, nebo $\\emptyset$.',
        'For $a > 0$ with roots $x_1 < x_2$: $ax^2+bx+c < 0 \\iff x \\in (x_1, x_2)$. For $D < 0$ the expression is always positive — the solution is either $\\mathbb{R}$ or $\\emptyset$.',
      ),
    },
    fit: ['ISM', 'IMA1'],
  },
  {
    id: 'quad.optimize',
    title: L('Extrémy v úlohách z praxe', 'Optimisation with quadratics'),
    summary: L(
      'Sestavit kvadratickou funkci ze slovního zadání a pomocí vrcholu najít největší nebo nejmenší hodnotu.',
      'Build a quadratic from a word problem and use the vertex to find the largest or smallest value.',
    ),
    area: 'functions',
    track: 'school',
    syllabusTopic: 3,
    prereqs: ['quad.vertex', 'lin.model'],
    encompasses: [{ id: 'quad.vertex', w: 0.7 }],
    why: {
      intuition: L(
        'Když jednu veličinu zvětšuješ a druhá kvůli tomu klesá, jejich součin má někde uprostřed vrchol.',
        'When raising one quantity makes another fall, their product peaks somewhere in between.',
      ),
      it: L(
        'Počet vláken proti režii přepínání, velikost bloku proti počtu požadavků, cena proti počtu zákazníků — kompromis dvou protichůdných vlivů má často tvar paraboly.',
        'Thread count against switching overhead, block size against request count, price against number of customers — a trade-off between two opposing effects often has the shape of a parabola.',
      ),
    },
    fit: ['IMA1'],
  },

  // ------------------------------------------------------------ 4 quadratic + absolute value
  {
    id: 'quadabs.graph',
    title: L('Kvadratická funkce s absolutní hodnotou: graf', 'Quadratics with absolute value: graph'),
    summary: L(
      'Načrtnout grafy $y = |ax^2+bx+c|$ a $y = ax^2 + b|x| + c$ a popsat jejich vlastnosti.',
      'Sketch $y = |ax^2+bx+c|$ and $y = ax^2 + b|x| + c$ and describe their properties.',
    ),
    area: 'functions',
    track: 'school',
    syllabusTopic: 4,
    prereqs: ['quad.roots-form', 'quad.vertex', 'abs.graph'],
    why: {
      intuition: L(
        'Absolutní hodnota vně překlopí část paraboly pod osou $x$ nahoru. Absolutní hodnota uvnitř ($|x|$) zkopíruje pravou polovinu grafu zrcadlově doleva.',
        'An absolute value outside flips the part of the parabola below the $x$-axis upwards. One inside ($|x|$) mirrors the right half of the graph to the left.',
      ),
      formal: L(
        '$y = f(|x|)$ je vždy sudá funkce. $y = |f(x)|$ má obor hodnot v $\\langle 0; \\infty)$.',
        '$y = f(|x|)$ is always an even function. $y = |f(x)|$ has its range inside $[0, \\infty)$.',
      ),
    },
    fit: ['ISM'],
    lab: { tool: 'grapher', preset: { expr: 'abs(x^2-4)' } },
  },
  {
    id: 'quadabs.equations',
    title: L('Kvadratické rovnice s absolutní hodnotou', 'Quadratic equations with absolute value'),
    summary: L(
      'Vyřešit rovnice typu $x^2 - 3|x| + 2 = 0$ nebo $|x^2 - 4| = 3$ rozborem případů a ověřit kořeny.',
      'Solve equations such as $x^2 - 3|x| + 2 = 0$ or $|x^2 - 4| = 3$ by cases, and verify the roots.',
    ),
    area: 'functions',
    track: 'school',
    syllabusTopic: 4,
    prereqs: ['quadabs.graph', 'abs.equations', 'alg.quad-eq'],
    encompasses: [
      { id: 'alg.quad-eq', w: 0.5 },
      { id: 'abs.equations', w: 0.4 },
    ],
    why: {
      intuition: L(
        'Každý případ dá obyčejnou kvadratickou rovnici. Nová je jen jedna věc: každý kořen musíš porovnat s podmínkou svého případu.',
        'Each case gives an ordinary quadratic equation. Only one thing is new: every root must be checked against the condition of its case.',
      ),
      algebraic: L(
        'Trik pro rovnice s $|x|$: protože $x^2 = |x|^2$, substituce $t = |x|$, $t \\ge 0$ vede na jednu kvadratickou rovnici v $t$.',
        'A trick for equations in $|x|$: since $x^2 = |x|^2$, the substitution $t = |x|$, $t \\ge 0$ gives a single quadratic in $t$.',
      ),
    },
    fit: ['ISM'],
  },

  // -------------------------------------------------------------------- 5 power functions
  {
    id: 'pow.natural',
    title: L('Mocninné funkce s přirozeným exponentem', 'Power functions with natural exponent'),
    summary: L(
      'Popsat graf a vlastnosti $y = x^n$ pro sudé a liché $n$.',
      'Describe the graph and properties of $y = x^n$ for even and odd $n$.',
    ),
    area: 'functions',
    track: 'school',
    syllabusTopic: 5,
    prereqs: ['fn.properties', 'alg.powers'],
    why: {
      intuition: L(
        'Sudý exponent zahodí znaménko vstupu, lichý ho zachová. Proto jsou sudé mocniny souměrné podle osy $y$ a liché podle počátku.',
        'An even exponent discards the sign of the input, an odd one keeps it. That is why even powers are symmetric about the $y$-axis and odd ones about the origin.',
      ),
      visual: L(
        'Čím vyšší exponent, tím plošší je graf u nuly a tím strmější za jedničkou. Všechny procházejí bodem $[1; 1]$.',
        'The higher the exponent, the flatter the graph near zero and the steeper past one. All of them pass through $(1, 1)$.',
      ),
      it: L(
        'Polynomiální složitost $n^2$, $n^3$ jsou mocninné funkce. Rozdíl mezi nimi je přesně rozdíl mezi „poběží chvilku“ a „doběhne zítra“.',
        'Polynomial complexities $n^2$, $n^3$ are power functions. The gap between them is exactly the gap between “runs in a moment” and “finishes tomorrow”.',
      ),
    },
    fit: ['ISM', 'IMA1', 'IAL'],
    lab: { tool: 'power' },
  },
  {
    id: 'pow.negative',
    title: L('Mocninné funkce se záporným exponentem', 'Power functions with negative exponent'),
    summary: L(
      'Popsat graf $y = x^{-n}$, jeho definiční obor a asymptoty; pracovat s nepřímou úměrností.',
      'Describe the graph of $y = x^{-n}$, its domain and asymptotes; work with inverse proportion.',
    ),
    area: 'functions',
    track: 'school',
    syllabusTopic: 5,
    prereqs: ['pow.natural'],
    why: {
      intuition: L(
        '$x^{-n} = \\frac{1}{x^n}$: velká čísla se mění na malá a naopak. V nule funkce neexistuje — graf se k ose jen blíží.',
        '$x^{-n} = \\frac{1}{x^n}$: large numbers become small and vice versa. At zero the function does not exist — the graph only approaches the axis.',
      ),
      formal: L(
        '$D(f) = \\mathbb{R} \\setminus \\{0\\}$. Osy souřadnic jsou asymptoty grafu.',
        '$D(f) = \\mathbb{R} \\setminus \\{0\\}$. The coordinate axes are asymptotes of the graph.',
      ),
      it: L(
        'Nepřímá úměrnost je všude: doba přenosu = velikost / rychlost, proud = napětí / odpor. Síla signálu Wi-Fi klesá s druhou mocninou vzdálenosti, tedy jako $x^{-2}$.',
        'Inverse proportion is everywhere: transfer time = size / speed, current = voltage / resistance. Wi-Fi signal strength falls with the square of distance, i.e. like $x^{-2}$.',
      ),
    },
    terms: [
      { cs: 'nepřímá úměrnost', en: 'inverse proportion' },
      { cs: 'asymptota', en: 'asymptote' },
      { cs: 'hyperbola', en: 'hyperbola' },
    ],
    fit: ['ISM', 'IMA1', 'IEL'],
    lab: { tool: 'power', preset: { n: -1 } },
  },
  {
    id: 'pow.root',
    title: L('Odmocninové funkce', 'Root functions'),
    summary: L(
      'Určit definiční obor a graf $y = \\sqrt[n]{x}$ a výrazů s odmocninou.',
      'Find the domain and graph of $y = \\sqrt[n]{x}$ and of expressions with roots.',
    ),
    area: 'functions',
    track: 'school',
    syllabusTopic: 5,
    prereqs: ['pow.natural', 'alg.linear-ineq'],
    why: {
      intuition: L(
        'Odmocnina se ptá: které nezáporné číslo dá po umocnění $x$? Proto pod sudou odmocninou nesmí být záporné číslo.',
        'A root asks: which non-negative number gives $x$ when raised to the power? That is why nothing negative may stand under an even root.',
      ),
      formal: L(
        'Pro $y = \\sqrt{g(x)}$ je definiční obor dán podmínkou $g(x) \\ge 0$.',
        'For $y = \\sqrt{g(x)}$ the domain is given by the condition $g(x) \\ge 0$.',
      ),
    },
    fit: ['ISM', 'IMA1'],
  },

  // ------------------------------------------------------------------ 6 inverse functions
  {
    id: 'inv.concept',
    title: L('Prostá a inverzní funkce', 'Injective and inverse functions'),
    summary: L(
      'Rozhodnout, zda je funkce prostá, a pochopit inverzní funkci jako „běh pozpátku“.',
      'Decide whether a function is injective, and understand the inverse as “running it backwards”.',
    ),
    area: 'functions',
    track: 'school',
    syllabusTopic: 6,
    prereqs: ['fn.properties'],
    why: {
      intuition: L(
        'Inverzní funkce vrací zpět to, co původní funkce udělala. Jde to jen tehdy, když dva různé vstupy nikdy nedají stejný výstup — jinak nevíš, kam se vrátit.',
        'An inverse undoes what the original function did. That works only if two different inputs never give the same output — otherwise you cannot tell where to go back to.',
      ),
      formal: L(
        '$f$ je prostá, když $x_1 \\ne x_2 \\Rightarrow f(x_1) \\ne f(x_2)$. Pak existuje $f^{-1}$ a platí $D(f^{-1}) = H(f)$, $H(f^{-1}) = D(f)$.',
        '$f$ is injective when $x_1 \\ne x_2 \\Rightarrow f(x_1) \\ne f(x_2)$. Then $f^{-1}$ exists and $D(f^{-1}) = H(f)$, $H(f^{-1}) = D(f)$.',
      ),
      visual: L(
        'Grafy $f$ a $f^{-1}$ jsou souměrné podle přímky $y = x$ — role $x$ a $y$ se prostě prohodí.',
        'The graphs of $f$ and $f^{-1}$ are mirror images in the line $y = x$ — the roles of $x$ and $y$ simply swap.',
      ),
      it: L(
        'Šifrování a dešifrování, `encode` a `decode`, komprese a dekomprese jsou dvojice funkce a její inverze. Hash naopak prostý není — proto z něj heslo zpátky nedostaneš.',
        'Encryption and decryption, `encode` and `decode`, compression and decompression are pairs of a function and its inverse. A hash, by contrast, is not injective — which is why you cannot get the password back from it.',
      ),
    },
    terms: [
      { cs: 'prostá funkce', en: 'injective (one-to-one) function' },
      { cs: 'inverzní funkce', en: 'inverse function' },
    ],
    fit: ['ISM', 'IMA1', 'IDM'],
    lab: { tool: 'inverse' },
  },
  {
    id: 'inv.find',
    title: L('Určení inverzní funkce', 'Finding the inverse function'),
    summary: L(
      'Najít předpis $f^{-1}$ záměnou proměnných a vyjádřením $y$; zapsat její definiční obor.',
      'Find the formula of $f^{-1}$ by swapping the variables and solving for $y$; state its domain.',
    ),
    area: 'functions',
    track: 'school',
    syllabusTopic: 6,
    prereqs: ['inv.concept', 'alg.linear-eq'],
    why: {
      algebraic: L(
        'Postup: napiš $y = f(x)$, prohoď $x$ a $y$, vyjádři $y$. Definiční obor inverze je obor hodnot původní funkce — ne to, co vyjde z nového předpisu.',
        'Method: write $y = f(x)$, swap $x$ and $y$, solve for $y$. The domain of the inverse is the range of the original — not whatever the new formula would allow.',
      ),
      intuition: L(
        'Inverze odčiňuje kroky v opačném pořadí. Pro $f(x) = 2x + 3$ (vynásob 2, přičti 3) je inverze: odečti 3, vyděl 2.',
        'The inverse undoes the steps in reverse order. For $f(x) = 2x + 3$ (multiply by 2, add 3) the inverse is: subtract 3, divide by 2.',
      ),
    },
    fit: ['ISM', 'IMA1'],
  },
];
