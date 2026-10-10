import { L, type Concept } from '@lemma/core';

/**
 * The mathematics of primary and lower-secondary school that the unified entrance
 * examination tests. Track 'basic' — not part of the second-year syllabus.
 *
 * Each concept names the items of the official specification it covers (`spec`, see
 * jpz/spec.ts). Which examination tests it, and how heavily, is not authored here: it is
 * derived from the specification and from the classified past papers (goals.ts).
 * Skills are ordered from the most basic; the order is the teaching order.
 */
export const BASIC_CONCEPTS: Concept[] = [
  // ------------------------------------------------------------------------------ numbers
  {
    id: 'num.natural',
    title: L('Počítání s přirozenými čísly', 'Arithmetic with natural numbers'),
    summary: L(
      'Sčítat, odčítat, násobit a dělit přirozená čísla, dodržet pořadí operací a závorky a výsledek odhadem zkontrolovat.',
      'Add, subtract, multiply and divide natural numbers, keep the order of operations and brackets, and check the result by an estimate.',
    ),
    area: 'numbers',
    track: 'basic',
    spec: ['A1.1.1', 'A1.1.2', 'A1.1.3', 'A1.1.4', 'A1.1.5'],
    prereqs: [],
    why: {
      intuition: L(
        'Pořadí operací není zvyk, ale dohoda, aby jeden zápis znamenal pro všechny totéž: nejdřív závorky, pak násobení a dělení, nakonec sčítání a odčítání.',
        'The order of operations is not a habit but an agreement, so that one expression means the same to everyone: brackets first, then multiplication and division, then addition and subtraction.',
      ),
      algebraic: L(
        'Zkouška odhadem: $398 \\cdot 21$ je skoro $400 \\cdot 20 = 8\\,000$. Vyjde-li ti $835$, je někde chyba v řádu.',
        'Check by estimating: $398 \\cdot 21$ is close to $400 \\cdot 20 = 8\\,000$. If you get $835$, a place value went wrong.',
      ),
    },
    terms: [
      { cs: 'součet, rozdíl, součin, podíl', en: 'sum, difference, product, quotient' },
      { cs: 'dělení se zbytkem', en: 'division with remainder' },
    ],
  },
  {
    id: 'num.divisibility',
    title: L('Dělitelnost a prvočísla', 'Divisibility and primes'),
    summary: L(
      'Určit dělitele a násobky, rozložit číslo na prvočinitele a najít největšího společného dělitele a nejmenší společný násobek.',
      'Find divisors and multiples, factor a number into primes, and find the greatest common divisor and the least common multiple.',
    ),
    area: 'numbers',
    track: 'basic',
    spec: ['B1.1.1'],
    prereqs: ['num.natural'],
    why: {
      intuition: L(
        'Prvočísla jsou stavební kostky čísel: každé číslo větší než 1 se z nich dá složit násobením, a to jediným způsobem.',
        'Primes are the building blocks of numbers: every number above 1 is a product of them, in exactly one way.',
      ),
      algebraic: L(
        'Z rozkladů $12 = 2^2 \\cdot 3$ a $18 = 2 \\cdot 3^2$ čteš obojí: společný dělitel bere, co mají obě čísla ($2 \\cdot 3 = 6$), společný násobek všechno, co má aspoň jedno ($2^2 \\cdot 3^2 = 36$).',
        'From $12 = 2^2 \\cdot 3$ and $18 = 2 \\cdot 3^2$ you read both: the common divisor takes what both have ($2 \\cdot 3 = 6$), the common multiple everything at least one has ($2^2 \\cdot 3^2 = 36$).',
      ),
    },
    terms: [
      { cs: 'největší společný dělitel', en: 'greatest common divisor' },
      { cs: 'nejmenší společný násobek', en: 'least common multiple' },
      { cs: 'prvočíslo', en: 'prime number' },
    ],
  },
  {
    id: 'num.integers',
    title: L('Celá čísla', 'Integers'),
    summary: L(
      'Počítat se zápornými čísly, znázornit je na číselné ose a určit opačné číslo a absolutní hodnotu.',
      'Compute with negative numbers, place them on the number line, and find the opposite and the absolute value.',
    ),
    area: 'numbers',
    track: 'basic',
    spec: ['A1.1.7', 'B1.1.3'],
    prereqs: ['num.natural'],
    why: {
      intuition: L(
        'Záporné číslo je dluh nebo teplota pod nulou. Odečíst záporné číslo znamená dluh zrušit: $5 - (-3) = 8$.',
        'A negative number is a debt or a temperature below zero. Subtracting a negative number cancels a debt: $5 - (-3) = 8$.',
      ),
      visual: L(
        'Na číselné ose je sčítání posun doprava a odčítání posun doleva. Násobení číslem $-1$ osu převrátí kolem nuly.',
        'On the number line adding is a move to the right and subtracting a move to the left. Multiplying by $-1$ flips the line around zero.',
      ),
    },
    terms: [
      { cs: 'opačné číslo', en: 'opposite number' },
      { cs: 'absolutní hodnota', en: 'absolute value' },
    ],
  },
  {
    id: 'num.decimals',
    title: L('Desetinná čísla', 'Decimal numbers'),
    summary: L(
      'Počítat s desetinnými čísly, násobit a dělit je deseti, stem i desetinou a zaokrouhlovat.',
      'Compute with decimals, multiply and divide them by ten, a hundred or a tenth, and round.',
    ),
    area: 'numbers',
    track: 'basic',
    spec: ['A1.1.7', 'B1.1.4', 'B1.1.5'],
    prereqs: ['num.natural'],
    why: {
      intuition: L(
        'Desetinná čárka jen říká, kde končí jednotky. $0{,}3 \\cdot 0{,}2$ jsou tři desetiny ze dvou desetin, tedy šest setin: $0{,}06$.',
        'The decimal point only says where the units end. $0.3 \\cdot 0.2$ is three tenths of two tenths, that is six hundredths: $0.06$.',
      ),
      algebraic: L(
        'Dělit číslem $0{,}1$ je totéž jako násobit deseti: $4 : 0{,}1 = 40$, protože do čtyřky se desetina vejde čtyřicetkrát.',
        'Dividing by $0.1$ is the same as multiplying by ten: $4 \\div 0.1 = 40$, because a tenth fits into four forty times.',
      ),
    },
    terms: [{ cs: 'desetinné číslo', en: 'decimal number' }],
  },
  {
    id: 'num.powers',
    title: L('Druhá mocnina a odmocnina', 'Squares and square roots'),
    summary: L(
      'Určit druhou mocninu a odmocninu čísel, zlomků a součinů a vypočítat číselný výraz s nimi.',
      'Find squares and square roots of numbers, fractions and products, and evaluate numerical expressions that contain them.',
    ),
    area: 'numbers',
    track: 'basic',
    spec: ['B1.1.2', 'C1.1.1'],
    prereqs: ['num.integers', 'num.decimals'],
    why: {
      intuition: L(
        'Druhá mocnina je obsah čtverce o dané straně; odmocnina se ptá obráceně, jak dlouhou stranu má čtverec o daném obsahu.',
        'A square is the area of a square with the given side; a square root asks the reverse, how long the side of a square with the given area is.',
      ),
      algebraic: L(
        'Mocnina i odmocnina se dají rozdělit přes součin a podíl, ale ne přes součet: $\\sqrt{9 \\cdot 16} = 3 \\cdot 4$, kdežto $\\sqrt{9 + 16} = 5$, ne $7$.',
        'Powers and roots distribute over products and quotients, but not over sums: $\\sqrt{9 \\cdot 16} = 3 \\cdot 4$, whereas $\\sqrt{9 + 16} = 5$, not $7$.',
      ),
    },
    terms: [
      { cs: 'druhá mocnina', en: 'square' },
      { cs: 'druhá odmocnina', en: 'square root' },
    ],
  },
  {
    id: 'frac.concept',
    title: L('Zlomek jako část celku', 'A fraction as a part of a whole'),
    summary: L(
      'Určit zlomek z celku a celek ze zlomku, porovnat zlomky a rozumět slovům „o třetinu více“.',
      'Find a fraction of a whole and the whole from a fraction, compare fractions, and understand phrases such as "a third more".',
    ),
    area: 'numbers',
    track: 'basic',
    spec: ['A1.1.6', 'B1.1.4'],
    prereqs: ['num.natural'],
    why: {
      intuition: L(
        'Jmenovatel říká, na kolik stejných dílů je celek rozdělen, čitatel, kolik dílů bereš. Tři čtvrtiny ze 20 jsou tři díly po pěti.',
        'The denominator says into how many equal parts the whole is cut, the numerator how many you take. Three quarters of 20 are three parts of five.',
      ),
      algebraic: L(
        '„O třetinu více“ znamená celek a k němu ještě jeho třetinu, tedy $\\frac{4}{3}$ původního. Zpátky se proto nejde odečtením třetiny, ale dělením $\\frac{4}{3}$.',
        '"A third more" means the whole plus a third of it, that is $\\frac{4}{3}$ of the original. So the way back is not taking a third off, but dividing by $\\frac{4}{3}$.',
      ),
    },
    terms: [
      { cs: 'čitatel, jmenovatel', en: 'numerator, denominator' },
      { cs: 'část celku', en: 'part of a whole' },
    ],
  },
  {
    id: 'frac.operations',
    title: L('Počítání se zlomky', 'Computing with fractions'),
    summary: L(
      'Sčítat, odčítat, násobit a dělit zlomky a smíšená čísla a výsledek zapsat v základním tvaru.',
      'Add, subtract, multiply and divide fractions and mixed numbers, and write the result in lowest terms.',
    ),
    area: 'numbers',
    track: 'basic',
    spec: ['B1.1.6', 'B1.1.7'],
    prereqs: ['frac.concept', 'num.divisibility'],
    why: {
      intuition: L(
        'Sčítat jde jen stejné díly: třetiny s třetinami. Proto se před sčítáním převádí na společného jmenovatele — a před násobením ne.',
        'Only equal parts can be added: thirds to thirds. That is why you need a common denominator before adding — and not before multiplying.',
      ),
      algebraic: L(
        'Dělit zlomkem je násobit převráceným: $\\frac{2}{9} : \\frac{5}{18} = \\frac{2}{9} \\cdot \\frac{18}{5}$. Krať dřív, než vynásobíš; čísla zůstanou malá.',
        'Dividing by a fraction is multiplying by its reciprocal: $\\frac{2}{9} \\div \\frac{5}{18} = \\frac{2}{9} \\cdot \\frac{18}{5}$. Cancel before you multiply; the numbers stay small.',
      ),
    },
    terms: [
      { cs: 'základní tvar', en: 'lowest terms' },
      { cs: 'společný jmenovatel', en: 'common denominator' },
      { cs: 'smíšené číslo', en: 'mixed number' },
      { cs: 'převrácený zlomek', en: 'reciprocal' },
    ],
  },

  // ------------------------------------------------------------------ percent and ratio
  {
    id: 'pct.basics',
    title: L('Procenta: základ, část, počet procent', 'Percent: base, part, rate'),
    summary: L(
      'Vypočítat procentovou část, základ nebo počet procent a převádět mezi procentem, zlomkem a desetinným číslem.',
      'Find the part, the base or the rate, and convert between a percentage, a fraction and a decimal.',
    ),
    area: 'numbers',
    track: 'basic',
    spec: ['B1.1.8'],
    prereqs: ['frac.concept', 'num.decimals'],
    why: {
      intuition: L(
        'Procento je setina. Nejspolehlivější cesta vede přes jedno procento: kolik je 1 %, tolikrát víc je hledaný počet procent.',
        'A per cent is a hundredth. The most reliable route goes through one per cent: whatever 1 % is, the wanted rate is that many times more.',
      ),
      algebraic: L(
        'Vždy se ptej, z čeho se procenta počítají. Stejných 15 míst je 5 % z 300, ale 4 % z 375 — změnil se základ, ne část.',
        'Always ask what the percentage is taken of. The same 15 places are 5 % of 300 but 4 % of 375 — the base changed, not the part.',
      ),
    },
    terms: [
      { cs: 'základ', en: 'base' },
      { cs: 'procentová část', en: 'part (percentage)' },
      { cs: 'počet procent', en: 'rate' },
    ],
  },
  {
    id: 'pct.applied',
    title: L('Procenta: změny, slevy a úroky', 'Percent: changes, discounts and interest'),
    summary: L(
      'Zvětšit a zmenšit hodnotu o daný počet procent, určit původní hodnotu, složit dvě změny a vypočítat úrok.',
      'Increase and decrease a value by a percentage, find the original value, combine two changes, and compute interest.',
    ),
    area: 'numbers',
    track: 'basic',
    spec: ['C1.1.2'],
    prereqs: ['pct.basics'],
    why: {
      intuition: L(
        'Zdražení o 20 % je násobení číslem $1{,}2$, sleva 20 % násobení číslem $0{,}8$. Dvě změny po sobě se násobí, nesčítají.',
        'A 20 % rise is multiplying by $1.2$, a 20 % discount multiplying by $0.8$. Two changes in a row multiply; they do not add.',
      ),
      algebraic: L(
        'Zdražení o 25 % a pak sleva 20 % dají $1{,}25 \\cdot 0{,}8 = 1$: cena je zpátky. Sleva se totiž počítá z vyšší ceny.',
        'A 25 % rise followed by a 20 % discount gives $1.25 \\cdot 0.8 = 1$: the price is back. The discount is taken of the higher price.',
      ),
    },
    terms: [
      { cs: 'úrok, úroková míra', en: 'interest, interest rate' },
      { cs: 'sleva, zdražení', en: 'discount, price rise' },
    ],
  },
  {
    id: 'ratio.basics',
    title: L('Poměr', 'Ratio'),
    summary: L(
      'Zapsat a zkrátit poměr, rozdělit celek v daném poměru a změnit hodnotu v poměru.',
      'Write and simplify a ratio, divide a whole in a given ratio, and change a value in a ratio.',
    ),
    area: 'numbers',
    track: 'basic',
    spec: ['B1.1.9', 'B1.2.2'],
    prereqs: ['frac.concept'],
    why: {
      intuition: L(
        'Poměr $3 : 5$ říká, že na každé tři díly jednoho připadá pět stejných dílů druhého. Dohromady je dílů osm; nejdřív zjisti, kolik je jeden.',
        'The ratio $3 : 5$ says that for every three parts of one there are five equal parts of the other. Eight parts in all; first find out what one part is.',
      ),
    },
    terms: [
      { cs: 'poměr v základním tvaru', en: 'ratio in lowest terms' },
      { cs: 'postupný poměr', en: 'continued ratio' },
    ],
  },
  {
    id: 'ratio.proportion',
    title: L('Přímá a nepřímá úměrnost', 'Direct and inverse proportion'),
    summary: L(
      'Poznat, zda jsou dvě veličiny přímo, nebo nepřímo úměrné, a dopočítat chybějící hodnotu.',
      'Tell whether two quantities are directly or inversely proportional, and find the missing value.',
    ),
    area: 'numbers',
    track: 'basic',
    spec: ['B1.2.3', 'C1.2.2'],
    // Not `ratio.basics`: reasoning through "one piece" needs no ratio notation, and the
    // eight-year test asks for exactly that.
    prereqs: ['frac.concept'],
    why: {
      intuition: L(
        'Otázka, která rozhodne: když jedné veličiny dvakrát přibude, druhé dvakrát přibude (přímá úměrnost), nebo dvakrát ubude (nepřímá)?',
        'The deciding question: when one quantity doubles, does the other double (direct proportion) or halve (inverse)?',
      ),
      algebraic: L(
        'U přímé úměrnosti je stálý podíl (cena za kus), u nepřímé stálý součin (počet dělníků krát počet dní je vždy tatáž práce).',
        'In a direct proportion the quotient is constant (price per piece), in an inverse one the product (workers times days is always the same job).',
      ),
    },
    terms: [
      { cs: 'přímá úměrnost', en: 'direct proportion' },
      { cs: 'nepřímá úměrnost', en: 'inverse proportion' },
      { cs: 'trojčlenka', en: 'rule of three' },
    ],
  },
  {
    id: 'ratio.scale',
    title: L('Měřítko mapy a plánu', 'The scale of a map or plan'),
    summary: L(
      'Převést délku na mapě na skutečnou a obráceně a určit měřítko ze dvou délek.',
      'Convert a length on a map to the real one and back, and find the scale from two lengths.',
    ),
    area: 'numbers',
    track: 'basic',
    spec: ['B1.2.2', 'C1.3.12'],
    prereqs: ['ratio.basics', 'units.conversion'],
    why: {
      intuition: L(
        'Měřítko $1 : 50\\,000$ znamená, že jeden centimetr na mapě je 50 000 centimetrů ve skutečnosti, tedy půl kilometru. Polovina práce je převod jednotek.',
        'A scale of $1 : 50\\,000$ means one centimetre on the map is 50 000 centimetres in reality, half a kilometre. Half of the work is converting units.',
      ),
    },
    terms: [{ cs: 'měřítko', en: 'scale' }],
  },

  // ------------------------------------------------------------------------------ algebra
  {
    id: 'expr.variables',
    title: L('Výraz s proměnnou', 'Expressions with a variable'),
    summary: L(
      'Vypočítat hodnotu výrazu pro dané číslo a zapsat slovní vztah výrazem s proměnnou.',
      'Evaluate an expression for a given number, and write a relation given in words as an expression with a variable.',
    ),
    area: 'algebra',
    track: 'basic',
    spec: ['C1.1.3'],
    prereqs: ['num.integers'],
    why: {
      intuition: L(
        'Proměnná je číslo, které zatím neznáš, ale zacházíš s ním jako s každým jiným. „O 5 více než dvojnásobek $x$“ je $2x + 5$.',
        'A variable is a number you do not know yet but handle like any other. "5 more than twice $x$" is $2x + 5$.',
      ),
      algebraic: L(
        'Záporné číslo dosazuj do závorky: pro $a = -3$ je $a^2 = (-3)^2 = 9$, kdežto $-3^2 = -9$.',
        'Substitute a negative number in brackets: for $a = -3$, $a^2 = (-3)^2 = 9$, whereas $-3^2 = -9$.',
      ),
    },
    terms: [
      { cs: 'proměnná', en: 'variable' },
      { cs: 'hodnota výrazu', en: 'value of an expression' },
    ],
  },
  {
    id: 'expr.polynomials',
    title: L('Úpravy mnohočlenů', 'Working with polynomials'),
    summary: L(
      'Sčítat, odčítat a násobit mnohočleny, umocnit dvojčlen a výsledek zjednodušit.',
      'Add, subtract and multiply polynomials, square a binomial, and simplify the result.',
    ),
    area: 'algebra',
    track: 'basic',
    spec: ['C1.1.3'],
    prereqs: ['expr.variables', 'num.powers'],
    why: {
      intuition: L(
        'Sčítat lze jen členy téhož druhu: $x^2$ s $x^2$, $x$ s $x$, čísla s čísly. Je to stejné pravidlo jako u zlomků a jednotek.',
        'Only terms of the same kind can be added: $x^2$ with $x^2$, $x$ with $x$, numbers with numbers. It is the same rule as with fractions and units.',
      ),
      algebraic: L(
        'Minus před závorkou mění znaménko každému členu v ní: $-(x - 3) = -x + 3$. Nejčastější ztráta bodu v celé algebře.',
        'A minus in front of a bracket changes the sign of every term inside: $-(x - 3) = -x + 3$. The most common lost point in all of algebra.',
      ),
    },
    terms: [
      { cs: 'mnohočlen, dvojčlen', en: 'polynomial, binomial' },
      { cs: 'roznásobit', en: 'expand' },
    ],
  },
  {
    id: 'expr.factoring',
    title: L('Rozklad na součin', 'Factoring'),
    summary: L(
      'Rozložit výraz vytknutím a podle vzorců $(a \\pm b)^2$ a $a^2 - b^2$.',
      'Factor an expression by taking out a common factor and by the identities $(a \\pm b)^2$ and $a^2 - b^2$.',
    ),
    area: 'algebra',
    track: 'basic',
    spec: ['C1.1.3'],
    prereqs: ['expr.polynomials'],
    why: {
      intuition: L(
        'Rozklad je roznásobení pozpátku. Proto se dá vždy zkontrolovat: roznásob svůj výsledek a musíš dostat zadání.',
        'Factoring is expanding in reverse. So it can always be checked: expand your result and you must get the original back.',
      ),
      algebraic: L(
        'Dva čtverce a mezi nimi minus, to je $a^2 - b^2 = (a + b)(a - b)$. Tři členy, z nichž krajní jsou čtverce, zkus jako $(a \\pm b)^2$.',
        'Two squares with a minus between them is $a^2 - b^2 = (a + b)(a - b)$. Three terms whose outer ones are squares: try $(a \\pm b)^2$.',
      ),
    },
    terms: [
      { cs: 'vytknout', en: 'factor out' },
      { cs: 'rozdíl čtverců', en: 'difference of squares' },
    ],
  },
  {
    id: 'eqn.linear',
    title: L('Lineární rovnice', 'Linear equations'),
    summary: L(
      'Vyřešit lineární rovnici se závorkami a zlomky ekvivalentními úpravami a ověřit ji zkouškou.',
      'Solve a linear equation with brackets and fractions by equivalent steps, and verify it by substitution.',
    ),
    area: 'algebra',
    track: 'basic',
    spec: ['C1.1.4'],
    prereqs: ['expr.variables', 'frac.operations'],
    why: {
      intuition: L(
        'Rovnice je váha v rovnováze: smíš s ní udělat cokoli, když to uděláš na obou stranách stejně.',
        'An equation is a balanced scale: you may do anything to it as long as you do the same on both sides.',
      ),
      algebraic: L(
        'Zlomků se zbavíš vynásobením celé rovnice společným jmenovatelem — každého členu, i toho, který zlomek není.',
        'You get rid of fractions by multiplying the whole equation by the common denominator — every term, including the ones that are not fractions.',
      ),
    },
    terms: [
      { cs: 'ekvivalentní úprava', en: 'equivalent step' },
      { cs: 'zkouška', en: 'check (by substitution)' },
    ],
  },
  {
    id: 'eqn.systems',
    title: L('Soustava dvou rovnic', 'Systems of two equations'),
    summary: L(
      'Vyřešit soustavu dvou lineárních rovnic se dvěma neznámými dosazovací nebo sčítací metodou.',
      'Solve a system of two linear equations in two unknowns by substitution or by elimination.',
    ),
    area: 'algebra',
    track: 'basic',
    spec: ['C1.1.5'],
    prereqs: ['eqn.linear'],
    why: {
      intuition: L(
        'Dvě neznámé potřebují dvě informace. Cílem obou metod je totéž: udělat z nich jednu rovnici s jednou neznámou.',
        'Two unknowns need two pieces of information. Both methods aim at the same thing: one equation with one unknown.',
      ),
    },
    terms: [
      { cs: 'dosazovací metoda', en: 'substitution method' },
      { cs: 'sčítací metoda', en: 'elimination method' },
    ],
  },
  {
    id: 'word.arith',
    title: L('Slovní úlohy řešené úsudkem', 'Word problems solved by reasoning'),
    summary: L(
      'Přečíst zadání, rozhodnout, které operace vedou k odpovědi, a výsledek posoudit, zda dává smysl.',
      'Read the problem, decide which operations lead to the answer, and judge whether the result makes sense.',
    ),
    area: 'numbers',
    track: 'basic',
    spec: ['A1.1.8', 'A1.4.1', 'B1.4.1'],
    prereqs: ['num.natural'],
    why: {
      intuition: L(
        'Než začneš počítat, řekni vlastními slovy, na co se úloha ptá a co znáš. Polovina chyb vzniká odpovědí na jinou otázku.',
        'Before you compute, say in your own words what the problem asks and what you know. Half of all mistakes answer a different question.',
      ),
    },
    terms: [{ cs: 'úsudek', en: 'reasoning' }],
  },
  {
    id: 'word.equations',
    title: L('Slovní úlohy s neznámou', 'Word problems with an unknown'),
    summary: L(
      'Označit neznámou, vyjádřit ostatní údaje pomocí ní, sestavit vztah a vyřešit ho.',
      'Name the unknown, express the other quantities with it, set up the relation and solve it.',
    ),
    area: 'algebra',
    track: 'basic',
    spec: ['C1.1.4', 'C1.1.6', 'C1.4.2'],
    prereqs: ['word.arith', 'frac.concept'],
    why: {
      intuition: L(
        'Vyber jednu věc, kterou neznáš, a pojmenuj ji $x$. Všechno ostatní pak popiš pomocí $x$ — rovnice je už jen věta ze zadání přepsaná znaky.',
        'Pick one thing you do not know and call it $x$. Then describe everything else with $x$ — the equation is just a sentence of the problem written in symbols.',
      ),
      algebraic: L(
        'Zkoušku dělej do zadání, ne do rovnice. Rovnice může být sestavená špatně a vyřešená správně.',
        'Check against the wording, not against the equation. An equation can be set up wrongly and solved correctly.',
      ),
    },
    terms: [{ cs: 'neznámá', en: 'unknown' }],
  },
  {
    id: 'word.rates',
    title: L('Úlohy o pohybu a společné práci', 'Motion and work problems'),
    summary: L(
      'Počítat s rychlostí, dráhou a časem a s výkonem při společné práci.',
      'Work with speed, distance and time, and with rates of work done together.',
    ),
    area: 'algebra',
    track: 'basic',
    spec: ['C1.1.6', 'C1.2.2'],
    prereqs: ['ratio.proportion', 'word.arith'],
    why: {
      intuition: L(
        'Rychlost je dráha za jednotku času, výkon je práce za jednotku času. Sčítají se výkony, nikdy časy.',
        'Speed is distance per unit of time, a rate of work is work per unit of time. Rates add; times never do.',
      ),
      algebraic: L(
        'Kdo udělá práci za 6 hodin, udělá za hodinu šestinu. Dva dohromady za hodinu $\\frac{1}{6} + \\frac{1}{3} = \\frac{1}{2}$, celou práci tedy za 2 hodiny.',
        'Whoever does a job in 6 hours does a sixth per hour. Two together do $\\frac{1}{6} + \\frac{1}{3} = \\frac{1}{2}$ per hour, so the whole job takes 2 hours.',
      ),
    },
    terms: [
      { cs: 'rychlost, dráha, čas', en: 'speed, distance, time' },
      { cs: 'společná práce', en: 'joint work' },
    ],
  },

  // --------------------------------------------------------------------------------- data
  {
    id: 'units.conversion',
    title: L('Jednotky a jejich převody', 'Units and conversions'),
    summary: L(
      'Převádět jednotky délky, hmotnosti, času, obsahu a objemu a počítat s časovými údaji.',
      'Convert units of length, mass, time, area and volume, and compute with times.',
    ),
    area: 'data',
    track: 'basic',
    spec: ['A1.2.1', 'A1.3.5', 'A1.3.6', 'B1.3.13', 'B1.3.16'],
    prereqs: ['num.natural'],
    why: {
      intuition: L(
        'U obsahu se převodní číslo umocňuje: metr má 100 centimetrů, ale metr čtvereční $100 \\cdot 100 = 10\\,000$ centimetrů čtverečních.',
        'For areas the conversion factor is squared: a metre has 100 centimetres, but a square metre has $100 \\cdot 100 = 10\\,000$ square centimetres.',
      ),
      algebraic: L(
        'Litr je decimetr krychlový. Odtud plyne všechno ostatní: $1\\ \\text{m}^3 = 1\\,000\\ \\text{l}$, $1\\ \\text{cm}^3 = 1\\ \\text{ml}$.',
        'A litre is a cubic decimetre. Everything else follows: $1\\ \\text{m}^3 = 1\\,000\\ \\text{l}$, $1\\ \\text{cm}^3 = 1\\ \\text{ml}$.',
      ),
    },
    terms: [{ cs: 'převod jednotek', en: 'unit conversion' }],
  },
  {
    id: 'data.tables-charts',
    title: L('Tabulky a diagramy', 'Tables and diagrams'),
    summary: L(
      'Vyčíst údaje z tabulky a diagramu, porovnat je a rozhodnout, zda tvrzení o nich platí.',
      'Read values off a table or a diagram, compare them, and decide whether a statement about them is true.',
    ),
    area: 'data',
    track: 'basic',
    spec: ['A1.2.2', 'B1.2.1', 'C1.2.1'],
    prereqs: ['num.natural'],
    why: {
      intuition: L(
        'Než odpovíš, přečti nadpis, popisky a jednotky. Většina chyb u tabulek není v počítání, ale ve čtení jiného řádku nebo sloupce.',
        'Before you answer, read the title, the labels and the units. Most mistakes with tables are not in computing but in reading another row or column.',
      ),
    },
    terms: [
      { cs: 'sloupcový diagram', en: 'bar chart' },
      { cs: 'kruhový diagram', en: 'pie chart' },
    ],
  },
  {
    id: 'data.mean',
    title: L('Aritmetický průměr', 'The arithmetic mean'),
    summary: L(
      'Vypočítat průměr, průměr z četností a dopočítat chybějící hodnotu ze známého průměru.',
      'Compute a mean, a mean from frequencies, and find a missing value from a known mean.',
    ),
    area: 'data',
    track: 'basic',
    spec: ['B1.2.4', 'C1.2.1'],
    prereqs: ['num.decimals', 'data.tables-charts'],
    why: {
      intuition: L(
        'Průměr je hodnota, kterou by měli všichni, kdyby se součet rozdělil rovným dílem. Proto průměr krát počet dává zpátky součet.',
        'The mean is the value everyone would have if the total were shared out equally. So the mean times the count gives the total back.',
      ),
    },
    terms: [
      { cs: 'aritmetický průměr', en: 'arithmetic mean' },
      { cs: 'četnost', en: 'frequency' },
    ],
  },

  // ----------------------------------------------------------------------------- geometry
  {
    id: 'geom.perimeter-area',
    title: L('Obvod a obsah rovinných útvarů', 'Perimeter and area of plane figures'),
    summary: L(
      'Vypočítat obvod a obsah čtverce, obdélníku, trojúhelníku, rovnoběžníku, lichoběžníku a útvarů z nich složených.',
      'Find the perimeter and area of a square, rectangle, triangle, parallelogram, trapezoid and figures composed of them.',
    ),
    area: 'geometry',
    track: 'basic',
    spec: ['A1.3.5', 'A1.3.6', 'B1.3.7', 'B1.3.13', 'B1.3.17'],
    prereqs: ['num.natural', 'units.conversion'],
    why: {
      intuition: L(
        'Obvod je délka plotu, obsah je plocha trávníku. Obvod se měří v centimetrech, obsah ve čtverečných centimetrech — podle jednotky poznáš, co po tobě úloha chce.',
        'Perimeter is the length of the fence, area is the lawn inside. Perimeter is in centimetres, area in square centimetres — the unit tells you what is asked.',
      ),
      visual: L(
        'Trojúhelník je polovina rovnoběžníku se stejnou základnou a výškou; proto $S = \\frac{a \\cdot v_a}{2}$. Složený útvar rozděl na obdélníky a trojúhelníky, nebo ho doplň na obdélník a přebytek odečti.',
        'A triangle is half of a parallelogram with the same base and height; hence $S = \\frac{a \\cdot h_a}{2}$. Split a composite figure into rectangles and triangles, or complete it to a rectangle and subtract the surplus.',
      ),
    },
    terms: [
      { cs: 'obvod', en: 'perimeter' },
      { cs: 'obsah', en: 'area' },
      { cs: 'lichoběžník', en: 'trapezoid' },
    ],
  },
  {
    id: 'geom.angles',
    title: L('Úhly a trojúhelníky', 'Angles and triangles'),
    summary: L(
      'Dopočítat úhly z vedlejších, vrcholových, střídavých a souhlasných úhlů a ze součtu úhlů v trojúhelníku; použít trojúhelníkovou nerovnost.',
      'Find angles from adjacent, vertical, alternate and corresponding angles and from the angle sum of a triangle; use the triangle inequality.',
    ),
    area: 'geometry',
    track: 'basic',
    spec: ['B1.3.4', 'B1.3.5', 'B1.3.6', 'B1.3.7'],
    prereqs: ['num.natural'],
    why: {
      intuition: L(
        'Skoro každá úloha na úhly stojí na třech větách: vedlejší úhly dají $180^\\circ$, vrcholové jsou stejné, úhly v trojúhelníku dají $180^\\circ$.',
        'Almost every angle problem rests on three facts: adjacent angles make $180^\\circ$, vertical angles are equal, the angles of a triangle make $180^\\circ$.',
      ),
      visual: L(
        'U rovnoběžek hledej písmeno Z (střídavé úhly, stejné) a písmeno F (souhlasné úhly, stejné).',
        'With parallel lines look for the letter Z (alternate angles, equal) and the letter F (corresponding angles, equal).',
      ),
    },
    terms: [
      { cs: 'vedlejší úhly', en: 'adjacent (supplementary) angles' },
      { cs: 'vrcholové úhly', en: 'vertical angles' },
      { cs: 'střídavé, souhlasné úhly', en: 'alternate, corresponding angles' },
      { cs: 'trojúhelníková nerovnost', en: 'triangle inequality' },
    ],
  },
  {
    id: 'geom.symmetry',
    title: L('Osová a středová souměrnost', 'Axial and central symmetry'),
    summary: L(
      'Poznat souměrný útvar, určit počet os souměrnosti a najít obraz bodu v osové a středové souměrnosti.',
      'Recognise a symmetric figure, count its axes of symmetry, and find the image of a point in an axial or central symmetry.',
    ),
    area: 'geometry',
    track: 'basic',
    spec: ['A1.3.4', 'B1.3.11', 'B1.3.12'],
    prereqs: [],
    why: {
      intuition: L(
        'Osová souměrnost je přeložení papíru podle osy, středová otočení o půl kruhu kolem středu. Obraz je od osy nebo středu stejně daleko jako vzor.',
        'An axial symmetry is folding the paper along the axis, a central one a half-turn around the centre. The image is as far from the axis or the centre as the original.',
      ),
    },
    terms: [
      { cs: 'osa souměrnosti', en: 'axis of symmetry' },
      { cs: 'vzor a obraz', en: 'pre-image and image' },
    ],
  },
  {
    id: 'geom.pythagoras',
    title: L('Pythagorova věta', 'The Pythagorean theorem'),
    summary: L(
      'Vypočítat stranu pravoúhlého trojúhelníku a najít pravoúhlý trojúhelník v obdélníku, lichoběžníku nebo kvádru.',
      'Find a side of a right triangle, and spot the right triangle inside a rectangle, a trapezoid or a cuboid.',
    ),
    area: 'geometry',
    track: 'basic',
    spec: ['C1.3.2'],
    prereqs: ['num.powers', 'geom.perimeter-area'],
    why: {
      intuition: L(
        'Čtverec nad přeponou má stejný obsah jako čtverce nad oběma odvěsnami dohromady. Přepona je vždy nejdelší strana a leží proti pravému úhlu.',
        'The square on the hypotenuse has the same area as the squares on the two legs together. The hypotenuse is always the longest side, opposite the right angle.',
      ),
      algebraic: L(
        'Odvěsnu počítej odčítáním: $a^2 = c^2 - b^2$. Sečíst všechno, co vidíš, je nejčastější chyba.',
        'Find a leg by subtracting: $a^2 = c^2 - b^2$. Adding whatever you see is the most common mistake.',
      ),
    },
    terms: [
      { cs: 'přepona', en: 'hypotenuse' },
      { cs: 'odvěsna', en: 'leg' },
    ],
  },
  {
    id: 'geom.circle',
    title: L('Kruh a kružnice', 'Circles'),
    summary: L(
      'Vypočítat obvod a obsah kruhu a jeho částí a útvarů složených z kruhů a mnohoúhelníků.',
      'Find the circumference and area of a circle, of its parts, and of figures made of circles and polygons.',
    ),
    area: 'geometry',
    track: 'basic',
    spec: ['C1.3.3', 'C1.3.4'],
    prereqs: ['num.decimals', 'geom.perimeter-area'],
    why: {
      intuition: L(
        'Číslo $\\pi$ říká, kolikrát je obvod kruhu delší než jeho průměr — pro každý kruh stejně, trochu víc než třikrát.',
        'The number $\\pi$ says how many times the circumference is longer than the diameter — the same for every circle, a little over three times.',
      ),
      algebraic: L(
        '$o = 2\\pi r$, $S = \\pi r^2$. Nejdřív zjisti, zda je zadán poloměr, nebo průměr; záměna dá výsledek dvakrát nebo čtyřikrát jiný.',
        '$C = 2\\pi r$, $A = \\pi r^2$. First find out whether the radius or the diameter is given; mixing them up changes the result two- or fourfold.',
      ),
    },
    terms: [
      { cs: 'poloměr, průměr', en: 'radius, diameter' },
      { cs: 'obvod kruhu (délka kružnice)', en: 'circumference' },
    ],
  },
  {
    id: 'geom.constructions',
    title: L('Konstrukční úlohy', 'Geometric constructions'),
    summary: L(
      'Sestrojit trojúhelník, čtyřúhelník nebo jejich chybějící vrcholy pomocí os, kolmic, rovnoběžek a kružnic a najít všechna řešení.',
      'Construct a triangle, a quadrilateral or their missing vertices with bisectors, perpendiculars, parallels and circles, and find all solutions.',
    ),
    area: 'geometry',
    track: 'basic',
    spec: ['A1.3.2', 'A1.3.3', 'B1.3.3', 'B1.3.8', 'B1.3.9', 'C1.3.5', 'C1.3.6', 'C1.3.7'],
    prereqs: [],
    paperOnly: true,
    why: {
      intuition: L(
        'Každá podmínka ze zadání vymezuje množinu bodů: stejná vzdálenost od dvou bodů je osa úsečky, daná vzdálenost od bodu kružnice. Hledaný vrchol leží v průsečíku.',
        'Each condition of the problem marks out a set of points: equal distance from two points is the perpendicular bisector, a given distance from a point is a circle. The vertex you want is where they meet.',
      ),
      formal: L(
        'Rýsuje se na papíře, takže tuhle dovednost Lemma neumí zkontrolovat. Načrtni si nejdřív hotový útvar od ruky a vyznač, co znáš; v testu se hodnotí přesnost i to, zda jsou narýsována všechna řešení.',
        'Constructions are drawn on paper, so Lemma cannot check this skill. Sketch the finished figure freehand first and mark what you know; the test marks accuracy and whether every solution is drawn.',
      ),
    },
    terms: [
      { cs: 'osa úsečky, osa úhlu', en: 'perpendicular bisector, angle bisector' },
      { cs: 'Thaletova kružnice', en: 'Thales circle' },
    ],
  },
  {
    id: 'solid.views',
    title: L('Prostorová představivost', 'Spatial imagination'),
    summary: L(
      'Spočítat krychličky ve stavbě, určit pohledy shora, zepředu a z boku a poznat, co se skládá ze sítě.',
      'Count the cubes in a building, determine the views from above, the front and the side, and tell what folds from a net.',
    ),
    area: 'geometry',
    track: 'basic',
    spec: ['A1.3.7', 'B1.3.15', 'C1.4.4'],
    prereqs: [],
    why: {
      intuition: L(
        'Stavbu z krychliček počítej po vrstvách nebo po sloupcích, nikdy „od oka“. Plánek s čísly ve čtvercích říká, kolik krychliček stojí na každém poli.',
        'Count a cube building layer by layer or column by column, never by eye. A plan with numbers in the squares says how many cubes stand on each field.',
      ),
    },
    terms: [
      { cs: 'pohled shora, zepředu, zboku', en: 'top, front and side view' },
      { cs: 'síť tělesa', en: 'net of a solid' },
    ],
  },
  {
    id: 'solid.cuboid',
    title: L('Krychle a kvádr', 'Cubes and cuboids'),
    summary: L(
      'Vypočítat objem a povrch krychle a kvádru a dopočítat hranu z objemu nebo povrchu.',
      'Find the volume and surface area of a cube and a cuboid, and an edge from the volume or the surface.',
    ),
    area: 'geometry',
    track: 'basic',
    spec: ['B1.3.14', 'B1.3.16', 'B1.3.17'],
    prereqs: ['geom.perimeter-area', 'units.conversion'],
    why: {
      intuition: L(
        'Objem říká, kolik se dovnitř vejde, povrch, kolik papíru je třeba na obalení. Kvádr má šest stěn po dvojicích stejných.',
        'Volume says how much fits inside, surface how much paper wraps it. A cuboid has six faces in three equal pairs.',
      ),
      algebraic: L(
        '$V = a \\cdot b \\cdot c$, $S = 2(ab + bc + ca)$. Zdvojnásobíš-li všechny hrany, povrch vzroste čtyřikrát a objem osmkrát.',
        '$V = a \\cdot b \\cdot c$, $S = 2(ab + bc + ca)$. Doubling every edge makes the surface four times and the volume eight times larger.',
      ),
    },
    terms: [
      { cs: 'objem', en: 'volume' },
      { cs: 'povrch', en: 'surface area' },
      { cs: 'hrana, stěna', en: 'edge, face' },
    ],
  },
  {
    id: 'solid.prism',
    title: L('Hranoly', 'Prisms'),
    summary: L(
      'Vypočítat objem a povrch kolmého hranolu s trojúhelníkovou, lichoběžníkovou nebo jinou podstavou.',
      'Find the volume and surface area of a right prism with a triangular, trapezoidal or other base.',
    ),
    area: 'geometry',
    track: 'basic',
    spec: ['B1.3.14', 'B1.3.15', 'B1.3.16'],
    prereqs: ['solid.cuboid'],
    why: {
      intuition: L(
        'Každý hranol je podstava vytažená do výšky. Objem je proto vždy obsah podstavy krát výška, ať má podstava jakýkoli tvar.',
        'Every prism is its base pulled up to a height. So the volume is always the area of the base times the height, whatever the shape of the base.',
      ),
      algebraic: L(
        'Povrch jsou dvě podstavy a plášť. Plášť rozbalíš do obdélníku, jehož jedna strana je obvod podstavy a druhá výška hranolu.',
        'The surface is two bases and the lateral surface. Unrolled, the lateral surface is a rectangle with the perimeter of the base as one side and the height as the other.',
      ),
    },
    terms: [
      { cs: 'podstava, plášť', en: 'base, lateral surface' },
      { cs: 'kolmý hranol', en: 'right prism' },
    ],
  },
  {
    id: 'solid.cylinder',
    title: L('Válec', 'Cylinders'),
    summary: L(
      'Vypočítat objem a povrch rotačního válce a použít je v úlohách o nádobách a hladinách.',
      'Find the volume and surface area of a cylinder, and use them in problems about vessels and water levels.',
    ),
    area: 'geometry',
    track: 'basic',
    spec: ['C1.3.10', 'C1.3.11'],
    prereqs: ['geom.circle', 'solid.prism'],
    why: {
      intuition: L(
        'Válec je hranol s kruhovou podstavou: objem je zase obsah podstavy krát výška, $V = \\pi r^2 v$.',
        'A cylinder is a prism with a circular base: the volume is again the area of the base times the height, $V = \\pi r^2 h$.',
      ),
      algebraic: L(
        'Plášť válce je po rozvinutí obdélník o stranách $2\\pi r$ a $v$. Ve výsledku nech $\\pi$ stát, dokud úloha nechce číslo.',
        'Unrolled, the lateral surface is a rectangle with sides $2\\pi r$ and $h$. Keep $\\pi$ in the result until the problem asks for a number.',
      ),
    },
    terms: [{ cs: 'rotační válec', en: 'right circular cylinder' }],
  },

  // ---------------------------------------------------------------------------- reasoning
  {
    id: 'puzzle.patterns',
    title: L('Řady a zákonitosti', 'Sequences and patterns'),
    summary: L(
      'Objevit pravidlo v řadě čísel nebo obrazců, určit vzdálený člen a zjistit, kolikátý člen má danou vlastnost.',
      'Discover the rule in a series of numbers or figures, find a distant term, and tell which term has a given property.',
    ),
    area: 'reasoning',
    track: 'basic',
    spec: ['A1.4.1', 'B1.4.3', 'C1.4.5'],
    prereqs: ['num.natural'],
    why: {
      intuition: L(
        'Sepiš si prvních pár členů do tabulky a dívej se, o kolik se mění. Stálý přírůstek znamená pravidlo tvaru „začátek plus tolikrát krok“.',
        'Write the first few terms in a table and watch how much they change. A constant step means a rule of the form "start plus so many steps".',
      ),
      algebraic: L(
        'Desátý obrazec nekresli. Jestli první má 5 dílů a každý další o 3 víc, má $n$-tý $5 + 3(n - 1)$ dílů.',
        'Do not draw the tenth figure. If the first has 5 parts and each next one 3 more, the $n$-th has $5 + 3(n - 1)$ parts.',
      ),
    },
    terms: [{ cs: 'zákonitost, pravidlo řady', en: 'pattern, rule of a sequence' }],
  },
  {
    id: 'puzzle.reasoning',
    title: L('Logické a nestandardní úlohy', 'Logic and non-standard problems'),
    summary: L(
      'Vyřešit úlohu, na kterou není hotový postup: postupovat od konce, rozebrat možnosti, využít podmínky jednu po druhé.',
      'Solve a problem with no ready-made method: work backwards, go through the cases, use the conditions one by one.',
    ),
    area: 'reasoning',
    track: 'basic',
    spec: ['A1.4.1', 'B1.4.1', 'B1.4.2', 'C1.4.1'],
    prereqs: ['word.arith'],
    why: {
      intuition: L(
        'Když nevíš, jak začít, začni od konce nebo od nejpřísnější podmínky. Zkoušet možnosti je řádná metoda, pokud je procházíš po pořádku.',
        'When you do not know how to start, start from the end or from the strictest condition. Trying cases is a proper method as long as you go through them in order.',
      ),
    },
    terms: [{ cs: 'postup od konce', en: 'working backwards' }],
  },
  {
    id: 'puzzle.counting',
    title: L('Počítání možností', 'Counting possibilities'),
    summary: L(
      'Spočítat všechny možnosti systematickým výpisem nebo úvahou, bez kombinatorických vzorců.',
      'Count all possibilities by a systematic list or by reasoning, without combinatorial formulas.',
    ),
    area: 'reasoning',
    track: 'basic',
    spec: ['A1.4.1', 'C1.4.3'],
    prereqs: ['num.natural'],
    why: {
      intuition: L(
        'Vypisuj podle pravidla, třeba od nejmenšího, abys žádnou možnost nevynechal ani nepočítal dvakrát. Tři trička a dvoje kalhoty dají $3 \\cdot 2$ oblečení.',
        'List by a rule, for instance from the smallest, so that nothing is left out or counted twice. Three shirts and two pairs of trousers make $3 \\cdot 2$ outfits.',
      ),
    },
    terms: [{ cs: 'systematický výpis', en: 'systematic listing' }],
  },
];
