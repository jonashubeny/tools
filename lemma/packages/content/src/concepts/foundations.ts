import { L, type Concept } from '@lemma/core';

/**
 * Foundations: material from earlier years that this year's syllabus depends on.
 * Track 'foundation' — NOT part of the official 2nd-year syllabus.
 */
export const FOUNDATION_CONCEPTS: Concept[] = [
  {
    id: 'alg.expressions',
    title: L('Úpravy výrazů', 'Manipulating expressions'),
    summary: L(
      'Roznásobit, vytknout a rozložit výraz pomocí vzorců, aniž se změní jeho hodnota.',
      'Expand, factor out and factor an expression with the standard identities without changing its value.',
    ),
    area: 'algebra',
    track: 'foundation',
    prereqs: [],
    why: {
      intuition: L(
        'Úprava výrazu je přepis téhož čísla jiným způsobem. Platí jen to, co platí pro každé dosazené číslo.',
        'Rewriting an expression is writing the same number differently. A step is valid only if it holds for every number you substitute.',
      ),
      algebraic: L(
        'Všechny úpravy stojí na distributivitě: $a(b+c) = ab + ac$. Vzorec $(a+b)^2 = a^2 + 2ab + b^2$ je jen distributivita použitá dvakrát.',
        'Every manipulation rests on distributivity: $a(b+c) = ab + ac$. The identity $(a+b)^2 = a^2 + 2ab + b^2$ is just distributivity applied twice.',
      ),
      it: L(
        'Překladač dělá totéž: přepisuje výraz na ekvivalentní, levnější tvar (např. `x*2` na `x<<1`). Smí to udělat jen tehdy, když výsledek vyjde stejně pro každý vstup.',
        'A compiler does the same thing: it rewrites an expression into an equivalent, cheaper one (e.g. `x*2` into `x<<1`). It may do so only if the result is the same for every input.',
      ),
    },
    terms: [
      { cs: 'roznásobit', en: 'expand' },
      { cs: 'vytknout', en: 'factor out' },
      { cs: 'rozložit na součin', en: 'factor' },
    ],
    fit: ['ISM'],
  },
  {
    id: 'alg.linear-eq',
    title: L('Lineární rovnice', 'Linear equations'),
    summary: L(
      'Vyřešit rovnici ekvivalentními úpravami a výsledek ověřit zkouškou.',
      'Solve an equation by equivalent transformations and verify the result by substitution.',
    ),
    area: 'algebra',
    track: 'foundation',
    prereqs: ['alg.expressions'],
    why: {
      intuition: L(
        'Rovnice je váha v rovnováze. Smíš s ní dělat cokoli, pokud to uděláš na obou stranách stejně.',
        'An equation is a balanced scale. You may do anything to it as long as you do the same on both sides.',
      ),
      formal: L(
        'Ekvivalentní úprava nemění množinu řešení: přičtení téhož výrazu k oběma stranám, násobení obou stran nenulovým číslem.',
        'An equivalent transformation does not change the solution set: adding the same expression to both sides, multiplying both sides by a non-zero number.',
      ),
      it: L(
        'Zkouška je unit test tvého řešení: dosadíš a obě strany se musí rovnat. Stojí pár sekund a chytí většinu chyb ze spěchu.',
        'Substituting back is a unit test of your solution: both sides must come out equal. It costs seconds and catches most careless errors.',
      ),
    },
    terms: [
      { cs: 'ekvivalentní úprava', en: 'equivalent transformation' },
      { cs: 'zkouška', en: 'check (by substitution)' },
      { cs: 'kořen rovnice', en: 'root / solution' },
    ],
    fit: ['ISM', 'ILG'],
  },
  {
    id: 'alg.intervals',
    title: L('Intervaly a číselné množiny', 'Intervals and number sets'),
    summary: L(
      'Zapsat množinu čísel intervalem, rozlišit uzavřený a otevřený konec, určit sjednocení a průnik.',
      'Write a set of numbers as an interval, tell closed from open ends, find unions and intersections.',
    ),
    area: 'algebra',
    track: 'foundation',
    prereqs: [],
    why: {
      intuition: L(
        'Interval je úsek číselné osy. Jediná otázka u každého konce: patří krajní bod dovnitř, nebo ne?',
        'An interval is a stretch of the number line. The only question at each end: is the endpoint included or not?',
      ),
      formal: L(
        '$\\langle a; b) = \\{x \\in \\mathbb{R} : a \\le x < b\\}$. Nekonečno není číslo, proto je u něj závorka vždy kulatá.',
        '$[a, b) = \\{x \\in \\mathbb{R} : a \\le x < b\\}$. Infinity is not a number, so its bracket is always round.',
      ),
      it: L(
        'Rozsah `0..n` v programování je polouzavřený interval $\\langle 0; n)$ — chyba o jedničku je přesně záměna uzavřeného a otevřeného konce.',
        'A range `0..n` in programming is the half-open interval $[0, n)$ — an off-by-one error is exactly a closed end mistaken for an open one.',
      ),
    },
    terms: [
      { cs: 'uzavřený interval', en: 'closed interval' },
      { cs: 'otevřený interval', en: 'open interval' },
      { cs: 'sjednocení', en: 'union' },
      { cs: 'průnik', en: 'intersection' },
    ],
    fit: ['ISM', 'IDM'],
  },
  {
    id: 'alg.linear-ineq',
    title: L('Lineární nerovnice', 'Linear inequalities'),
    summary: L(
      'Vyřešit nerovnici a zapsat řešení intervalem; vědět, kdy se znak nerovnosti otáčí.',
      'Solve an inequality and write the solution as an interval; know when the inequality sign flips.',
    ),
    area: 'algebra',
    track: 'foundation',
    prereqs: ['alg.linear-eq', 'alg.intervals'],
    why: {
      intuition: L(
        'Násobení záporným číslem zrcadlí číselnou osu kolem nuly: co bylo vpravo, je vlevo. Proto se znak nerovnosti otočí.',
        'Multiplying by a negative number mirrors the number line around zero: what was on the right is now on the left. That is why the sign flips.',
      ),
      algebraic: L(
        'Z $2 < 5$ po vynásobení $-1$ plyne $-2 > -5$. Stejně pro neznámou: $-3x < 6 \\iff x > -2$.',
        'From $2 < 5$, multiplying by $-1$ gives $-2 > -5$. The same with an unknown: $-3x < 6 \\iff x > -2$.',
      ),
    },
    terms: [{ cs: 'nerovnice', en: 'inequality' }],
    fit: ['ISM'],
  },
  {
    id: 'alg.quad-eq',
    title: L('Kvadratická rovnice', 'Quadratic equations'),
    summary: L(
      'Vyřešit kvadratickou rovnici rozkladem, diskriminantem nebo doplněním na čtverec a určit počet řešení.',
      'Solve a quadratic equation by factoring, the discriminant or completing the square, and tell how many solutions it has.',
    ),
    area: 'algebra',
    track: 'foundation',
    prereqs: ['alg.linear-eq', 'alg.expressions'],
    why: {
      intuition: L(
        'Součin je nula právě tehdy, když je nulový některý činitel. Proto rozklad $(x-1)(x-3)=0$ rovnou ukazuje kořeny.',
        'A product is zero exactly when one of its factors is zero. That is why the factored form $(x-1)(x-3)=0$ shows the roots directly.',
      ),
      formal: L(
        'Pro $ax^2+bx+c=0$, $a \\ne 0$: $D = b^2 - 4ac$. $D>0$ dva kořeny, $D=0$ jeden (dvojnásobný), $D<0$ žádný reálný.',
        'For $ax^2+bx+c=0$, $a \\ne 0$: $D = b^2 - 4ac$. $D>0$ two roots, $D=0$ one (double), $D<0$ no real root.',
      ),
      algebraic: L(
        'Vzorec $x = \\frac{-b \\pm \\sqrt{D}}{2a}$ není kouzlo: vznikne doplněním na čtverec obecné rovnice. Stojí za to si to jednou odvodit.',
        'The formula $x = \\frac{-b \\pm \\sqrt{D}}{2a}$ is not magic: it comes from completing the square on the general equation. Worth deriving once.',
      ),
      visual: L(
        'Kořeny jsou průsečíky paraboly s osou $x$. Diskriminant říká, zda parabola osu protne dvakrát, dotkne se jí, nebo ji mine.',
        'The roots are where the parabola crosses the $x$-axis. The discriminant says whether it crosses twice, touches, or misses.',
      ),
    },
    terms: [
      { cs: 'diskriminant', en: 'discriminant' },
      { cs: 'kořen', en: 'root' },
      { cs: 'Viètovy vzorce', en: "Vieta's formulas" },
    ],
    fit: ['ISM'],
  },
  {
    id: 'alg.complete-square',
    title: L('Doplnění na čtverec', 'Completing the square'),
    summary: L('Přepsat $x^2+bx+c$ do tvaru $(x-m)^2+n$.', 'Rewrite $x^2+bx+c$ in the form $(x-m)^2+n$.'),
    area: 'algebra',
    track: 'foundation',
    prereqs: ['alg.expressions'],
    why: {
      intuition: L(
        'Výraz $x^2 + 6x$ je skoro čtverec $(x+3)^2$ — chybí mu jen roh $9$. Přidáš ho a hned zase odečteš.',
        'The expression $x^2 + 6x$ is almost the square $(x+3)^2$ — only the corner $9$ is missing. You add it and take it away again.',
      ),
      visual: L(
        'Čtverec o straně $x$ a dva obdélníky $3 \\times x$ složíš do většího čtverce o straně $x+3$; zbude prázdný roh $3 \\times 3$.',
        'A square of side $x$ and two $3 \\times x$ rectangles fit into a bigger square of side $x+3$, leaving an empty $3 \\times 3$ corner.',
      ),
      algebraic: L(
        '$x^2 + bx + c = \\left(x + \\tfrac{b}{2}\\right)^2 - \\tfrac{b^2}{4} + c$.',
        '$x^2 + bx + c = \\left(x + \\tfrac{b}{2}\\right)^2 - \\tfrac{b^2}{4} + c$.',
      ),
    },
    terms: [{ cs: 'doplnění na čtverec', en: 'completing the square' }],
    fit: ['ISM', 'IMA1'],
  },
  {
    id: 'alg.powers',
    title: L('Mocniny a odmocniny', 'Powers and roots'),
    summary: L(
      'Počítat s mocninami s celým a racionálním exponentem podle pravidel.',
      'Compute with integer and rational exponents using the exponent rules.',
    ),
    area: 'algebra',
    track: 'foundation',
    prereqs: ['alg.expressions'],
    why: {
      intuition: L(
        'Pravidla pro mocniny nejsou nazpaměť: $a^m \\cdot a^n$ je $m$ činitelů a pak ještě $n$ činitelů, dohromady $m+n$.',
        'The exponent rules are not to be memorised: $a^m \\cdot a^n$ is $m$ factors followed by $n$ more, $m+n$ in total.',
      ),
      algebraic: L(
        'Záporný a lomený exponent jsou definovány tak, aby pravidla platila dál: $a^{-n} = \\frac{1}{a^n}$, $a^{1/n} = \\sqrt[n]{a}$.',
        'Negative and fractional exponents are defined so that the rules keep working: $a^{-n} = \\frac{1}{a^n}$, $a^{1/n} = \\sqrt[n]{a}$.',
      ),
      it: L(
        'Mocniny dvou jsou měna informatiky: $2^{10} = 1024$, $2^{32}$ adres v IPv4, $2^{64}$ hodnot 64bitového čísla.',
        'Powers of two are the currency of computing: $2^{10} = 1024$, $2^{32}$ IPv4 addresses, $2^{64}$ values of a 64-bit integer.',
      ),
    },
    terms: [
      { cs: 'mocnina', en: 'power' },
      { cs: 'základ, exponent', en: 'base, exponent' },
      { cs: 'odmocnina', en: 'root' },
    ],
    fit: ['ISM', 'ISC'],
  },
  {
    id: 'alg.abs-value',
    title: L('Absolutní hodnota', 'Absolute value'),
    summary: L(
      'Chápat $|a-b|$ jako vzdálenost dvou čísel na ose a umět absolutní hodnotu odstranit rozborem případů.',
      'Understand $|a-b|$ as the distance between two numbers and remove an absolute value by cases.',
    ),
    area: 'algebra',
    track: 'foundation',
    prereqs: ['alg.intervals'],
    why: {
      intuition: L(
        '$|x - 3|$ je vzdálenost čísla $x$ od trojky. Rovnice $|x-3| = 2$ se ptá: která čísla jsou od trojky daleko právě 2?',
        '$|x - 3|$ is the distance of $x$ from three. The equation $|x-3| = 2$ asks: which numbers are exactly 2 away from three?',
      ),
      formal: L(
        '$|a| = a$ pro $a \\ge 0$ a $|a| = -a$ pro $a < 0$. Výsledek není nikdy záporný.',
        '$|a| = a$ for $a \\ge 0$ and $|a| = -a$ for $a < 0$. The result is never negative.',
      ),
      it: L(
        'V kódu je to `if (a < 0) return -a; else return a;` — větvení podle znaménka. Stejné větvení děláš na papíře, když rozebíráš případy.',
        'In code it is `if (a < 0) return -a; else return a;` — a branch on the sign. You do the same branching on paper when you split into cases.',
      ),
    },
    terms: [
      { cs: 'absolutní hodnota', en: 'absolute value' },
      { cs: 'nulový bod', en: 'critical point (zero of the inner expression)' },
    ],
    fit: ['ISM'],
  },
  {
    id: 'fn.concept',
    title: L('Pojem funkce', 'The concept of a function'),
    summary: L(
      'Vědět, co je funkce, určit definiční obor a obor hodnot a číst hodnoty z grafu.',
      'Know what a function is, find its domain and range, and read values off a graph.',
    ),
    area: 'functions',
    track: 'foundation',
    prereqs: ['alg.intervals'],
    why: {
      intuition: L(
        'Funkce je stroj: do něj dáš číslo, vypadne právě jedno číslo. Stejný vstup dá vždy stejný výstup.',
        'A function is a machine: you put a number in and exactly one number comes out. The same input always gives the same output.',
      ),
      formal: L(
        'Funkce $f$ přiřazuje každému $x$ z definičního oboru $D(f)$ právě jedno $y$. Množina všech takových $y$ je obor hodnot $H(f)$.',
        'A function $f$ assigns to every $x$ in its domain $D(f)$ exactly one $y$. The set of all such $y$ is the range $H(f)$.',
      ),
      visual: L(
        'Graf je funkcí, pokud ho každá svislá přímka protne nejvýše jednou.',
        'A graph is a function if every vertical line meets it at most once.',
      ),
      it: L(
        'Je to přesně čistá funkce z programování: `int f(int x)`. Definiční obor jsou povolené vstupy, obor hodnot to, co může vrátit. Dělení nulou je vstup mimo definiční obor.',
        'It is exactly a pure function in programming: `int f(int x)`. The domain is the allowed inputs, the range what it can return. Division by zero is an input outside the domain.',
      ),
    },
    terms: [
      { cs: 'definiční obor', en: 'domain' },
      { cs: 'obor hodnot', en: 'range' },
      { cs: 'funkční hodnota', en: 'function value' },
      { cs: 'předpis funkce', en: 'formula / rule of a function' },
    ],
    fit: ['ISM', 'IMA1', 'IDM'],
  },
  {
    id: 'fn.properties',
    title: L('Vlastnosti funkcí', 'Properties of functions'),
    summary: L(
      'Poznat z grafu i z předpisu, kde funkce roste a klesá, zda je sudá nebo lichá, omezená, a kde má extrémy.',
      'Tell from a graph or a formula where a function increases or decreases, whether it is even or odd, bounded, and where its extrema are.',
    ),
    area: 'functions',
    track: 'foundation',
    prereqs: ['fn.concept'],
    why: {
      intuition: L(
        'Vlastnosti jsou odpovědi na otázky, které by sis o grafu položil sám: jde nahoru, nebo dolů? Je souměrný? Má strop nebo dno?',
        'Properties answer the questions you would ask about a graph yourself: does it go up or down? Is it symmetric? Does it have a ceiling or a floor?',
      ),
      formal: L(
        'Rostoucí: $x_1 < x_2 \\Rightarrow f(x_1) < f(x_2)$. Sudá: $f(-x) = f(x)$. Lichá: $f(-x) = -f(x)$.',
        'Increasing: $x_1 < x_2 \\Rightarrow f(x_1) < f(x_2)$. Even: $f(-x) = f(x)$. Odd: $f(-x) = -f(x)$.',
      ),
      visual: L(
        'Sudá funkce je souměrná podle osy $y$, lichá podle počátku.',
        'An even function is symmetric about the $y$-axis, an odd one about the origin.',
      ),
    },
    terms: [
      { cs: 'rostoucí, klesající', en: 'increasing, decreasing' },
      { cs: 'sudá, lichá', en: 'even, odd' },
      { cs: 'omezená', en: 'bounded' },
      { cs: 'maximum, minimum', en: 'maximum, minimum' },
      { cs: 'prostá funkce', en: 'injective (one-to-one) function' },
    ],
    fit: ['ISM', 'IMA1'],
  },
  {
    id: 'fn.transform',
    title: L('Posuny a transformace grafů', 'Shifting and transforming graphs'),
    summary: L(
      'Z grafu $y=f(x)$ odvodit graf $y = a\\,f(x-m)+n$ bez tabulky hodnot.',
      'Obtain the graph of $y = a\\,f(x-m)+n$ from that of $y=f(x)$ without a table of values.',
    ),
    area: 'functions',
    track: 'foundation',
    prereqs: ['fn.concept'],
    why: {
      intuition: L(
        'Co uděláš vně funkce, hýbe grafem svisle a „normálně“. Co uděláš uvnitř u $x$, hýbe vodorovně a obráceně.',
        'What you do outside the function moves the graph vertically and “as expected”. What you do inside, to $x$, moves it horizontally and the opposite way.',
      ),
      algebraic: L(
        'Proč obráceně? Aby $f(x-2)$ dostala stejný vstup jako dřív, musíš jí dát $x$ o 2 větší. Celý graf se tedy posune o 2 doprava.',
        'Why the opposite way? For $f(x-2)$ to receive the same input as before, you must feed it an $x$ that is 2 larger. So the whole graph moves 2 to the right.',
      ),
      it: L(
        'V grafice je to posun a škálování souřadnic — transformace, kterou na FIT v lineární algebře zapíšeš maticí a kterou herní engine používá na každý objekt ve scéně.',
        'In graphics this is translating and scaling coordinates — the transformation you will write as a matrix in linear algebra and apply to every object in a game scene.',
      ),
    },
    terms: [
      { cs: 'posunutí', en: 'translation / shift' },
      { cs: 'souměrnost podle osy', en: 'reflection in an axis' },
    ],
    fit: ['ISM', 'ILG'],
    lab: { tool: 'transform' },
  },
  {
    id: 'geo.right-triangle',
    title: L('Pravoúhlý trojúhelník', 'The right triangle'),
    summary: L(
      'Použít Pythagorovu větu a poměry sinus, kosinus a tangens v pravoúhlém trojúhelníku.',
      'Use the Pythagorean theorem and the ratios sine, cosine and tangent in a right triangle.',
    ),
    area: 'geometry',
    track: 'foundation',
    prereqs: ['alg.powers'],
    why: {
      intuition: L(
        'Všechny pravoúhlé trojúhelníky se stejným úhlem jsou si podobné, takže poměr stran závisí jen na úhlu. Ten poměr je sinus, kosinus, tangens.',
        'All right triangles with the same angle are similar, so the ratio of sides depends on the angle alone. That ratio is sine, cosine, tangent.',
      ),
      formal: L(
        '$\\sin\\alpha = \\frac{\\text{protilehlá}}{\\text{přepona}}$, $\\cos\\alpha = \\frac{\\text{přilehlá}}{\\text{přepona}}$, $\\operatorname{tg}\\alpha = \\frac{\\text{protilehlá}}{\\text{přilehlá}}$.',
        '$\\sin\\alpha = \\frac{\\text{opposite}}{\\text{hypotenuse}}$, $\\cos\\alpha = \\frac{\\text{adjacent}}{\\text{hypotenuse}}$, $\\tan\\alpha = \\frac{\\text{opposite}}{\\text{adjacent}}$.',
      ),
    },
    terms: [
      { cs: 'přepona', en: 'hypotenuse' },
      { cs: 'odvěsna', en: 'leg' },
      { cs: 'Pythagorova věta', en: 'Pythagorean theorem' },
    ],
    fit: ['ISM', 'IEL'],
  },
  {
    id: 'cplx.algebraic',
    title: L('Komplexní čísla – algebraický tvar', 'Complex numbers – algebraic form'),
    summary: L(
      'Sčítat, násobit a dělit komplexní čísla ve tvaru $a+b\\mathrm{i}$ a zakreslit je do Gaussovy roviny.',
      'Add, multiply and divide complex numbers in the form $a+b\\mathrm{i}$ and plot them in the complex plane.',
    ),
    area: 'complex',
    track: 'foundation',
    prereqs: ['alg.expressions', 'alg.quad-eq'],
    why: {
      intuition: L(
        'Reálná čísla leží na přímce. Komplexní čísla jsou body roviny: $a+b\\mathrm{i}$ je bod $[a; b]$.',
        'Real numbers live on a line. Complex numbers are points of a plane: $a+b\\mathrm{i}$ is the point $(a, b)$.',
      ),
      formal: L(
        'Počítáš jako s dvojčleny a všude, kde se objeví $\\mathrm{i}^2$, napíšeš $-1$.',
        'You compute as with binomials and replace $\\mathrm{i}^2$ by $-1$ wherever it appears.',
      ),
      it: L(
        'V programu je komplexní číslo struktura se dvěma floaty (`re`, `im`). C má `<complex.h>`, C# `System.Numerics.Complex`.',
        'In a program a complex number is a struct of two floats (`re`, `im`). C has `<complex.h>`, C# has `System.Numerics.Complex`.',
      ),
    },
    terms: [
      { cs: 'imaginární jednotka', en: 'imaginary unit' },
      { cs: 'komplexně sdružené číslo', en: 'complex conjugate' },
      { cs: 'Gaussova rovina', en: 'complex plane' },
    ],
    fit: ['ISM', 'ISS'],
    lab: { tool: 'complex' },
  },
];
