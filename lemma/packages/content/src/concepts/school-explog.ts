import { L, type Concept } from '@lemma/core';

/** Syllabus topics 7–10: exponential and logarithmic functions and equations. */
export const EXPLOG_CONCEPTS: Concept[] = [
  // --------------------------------------------------------------------- 7 exponential
  {
    id: 'exp.function',
    title: L('Exponenciální funkce', 'The exponential function'),
    summary: L(
      'Popsat graf a vlastnosti $y = a^x$ pro $a > 1$ a pro $0 < a < 1$.',
      'Describe the graph and properties of $y = a^x$ for $a > 1$ and for $0 < a < 1$.',
    ),
    area: 'explog',
    track: 'school',
    syllabusTopic: 7,
    prereqs: ['alg.powers', 'fn.properties'],
    why: {
      intuition: L(
        'Lineární funkce přičítá pořád stejně. Exponenciální násobí pořád stejně: každý krok doprava vynásobí hodnotu číslem $a$.',
        'A linear function keeps adding the same amount. An exponential keeps multiplying by the same amount: each step to the right multiplies the value by $a$.',
      ),
      formal: L(
        '$f: y = a^x$, $a > 0$, $a \\ne 1$. $D(f) = \\mathbb{R}$, $H(f) = (0; \\infty)$. Rostoucí pro $a > 1$, klesající pro $0 < a < 1$. Graf prochází bodem $[0; 1]$.',
        '$f: y = a^x$, $a > 0$, $a \\ne 1$. $D(f) = \\mathbb{R}$, $H(f) = (0, \\infty)$. Increasing for $a > 1$, decreasing for $0 < a < 1$. The graph passes through $(0, 1)$.',
      ),
      visual: L(
        'Graf se k ose $x$ blíží, ale nikdy se jí nedotkne — $a^x$ není nula ani záporné pro žádné $x$.',
        'The graph approaches the $x$-axis but never touches it — $a^x$ is never zero or negative for any $x$.',
      ),
      it: L(
        'Každý bit zdvojnásobí počet hodnot: $n$ bitů dá $2^n$ možností. Proto přidání jednoho znaku k heslu násobí počet pokusů útočníka, a proto úplné prohledávání neškáluje.',
        'Every bit doubles the number of values: $n$ bits give $2^n$ possibilities. That is why one more character in a password multiplies an attacker’s work, and why brute force does not scale.',
      ),
    },
    terms: [
      { cs: 'exponenciální funkce', en: 'exponential function' },
      { cs: 'základ', en: 'base' },
    ],
    fit: ['ISM', 'IMA1', 'IAL'],
    lab: { tool: 'explog' },
  },
  {
    id: 'exp.model',
    title: L('Exponenciální růst a pokles', 'Exponential growth and decay'),
    summary: L(
      'Modelovat zdvojování, poločas a procentní růst funkcí $y = y_0 \\cdot a^{t}$.',
      'Model doubling, half-life and percentage growth with $y = y_0 \\cdot a^{t}$.',
    ),
    area: 'explog',
    track: 'school',
    syllabusTopic: 7,
    prereqs: ['exp.function'],
    why: {
      intuition: L(
        '„Roste o 5 % ročně“ znamená násobit každý rok číslem $1{,}05$. Po $t$ letech je to $1{,}05^t$ — ne $1 + 0{,}05t$.',
        '“Grows 5 % a year” means multiplying by $1.05$ every year. After $t$ years that is $1.05^t$ — not $1 + 0.05t$.',
      ),
      it: L(
        'Exponenciální backoff při opakování síťového požadavku čeká 1 s, 2 s, 4 s, 8 s… Stejně roste objem dat, která se zdvojnásobí každých pár let.',
        'Exponential backoff when retrying a network request waits 1 s, 2 s, 4 s, 8 s… Data volumes that double every few years grow the same way.',
      ),
    },
    terms: [
      { cs: 'poločas', en: 'half-life' },
      { cs: 'doba zdvojení', en: 'doubling time' },
    ],
    fit: ['IMA1'],
  },

  // --------------------------------------------------------------------- 8 logarithmic
  {
    id: 'log.definition',
    title: L('Logaritmus', 'The logarithm'),
    summary: L(
      'Rozumět logaritmu jako exponentu a vyčíslit jednoduché logaritmy zpaměti.',
      'Understand a logarithm as an exponent and evaluate simple logarithms mentally.',
    ),
    area: 'explog',
    track: 'school',
    syllabusTopic: 8,
    prereqs: ['exp.function', 'inv.concept'],
    why: {
      intuition: L(
        '$\\log_2 8$ je otázka: na kolikátou musím umocnit dvojku, abych dostal osm? Odpověď je exponent, tedy 3.',
        '$\\log_2 8$ is a question: to what power must I raise two to get eight? The answer is an exponent: 3.',
      ),
      formal: L(
        '$\\log_a x = y \\iff a^y = x$, pro $a > 0$, $a \\ne 1$, $x > 0$. Logaritmus je inverzní funkce k exponenciální.',
        '$\\log_a x = y \\iff a^y = x$, for $a > 0$, $a \\ne 1$, $x > 0$. The logarithm is the inverse of the exponential.',
      ),
      it: L(
        '$\\log_2 n$ je počet půlení, než z $n$ prvků zbude jeden — tolik kroků udělá binární vyhledávání a tolik pater má vyvážený strom. Pro milion prvků je to jen 20.',
        '$\\log_2 n$ is how many halvings it takes to get from $n$ items to one — the number of steps of binary search and the height of a balanced tree. For a million items it is only 20.',
      ),
    },
    terms: [
      { cs: 'logaritmus', en: 'logarithm' },
      { cs: 'dekadický logaritmus (log)', en: 'common logarithm (log₁₀)' },
      { cs: 'přirozený logaritmus (ln)', en: 'natural logarithm (ln)' },
    ],
    fit: ['ISM', 'IMA1', 'IAL'],
    lab: { tool: 'explog' },
  },
  {
    id: 'log.function',
    title: L('Logaritmická funkce', 'The logarithmic function'),
    summary: L(
      'Popsat graf $y = \\log_a x$, určit definiční obor výrazů s logaritmem.',
      'Describe the graph of $y = \\log_a x$ and find the domain of expressions containing logarithms.',
    ),
    area: 'explog',
    track: 'school',
    syllabusTopic: 8,
    prereqs: ['log.definition', 'alg.linear-ineq'],
    why: {
      visual: L(
        'Graf $\\log_a x$ je graf $a^x$ překlopený podle přímky $y = x$. Co byla vodorovná asymptota, je teď svislá.',
        'The graph of $\\log_a x$ is the graph of $a^x$ mirrored in the line $y = x$. What was a horizontal asymptote is now vertical.',
      ),
      formal: L(
        '$D(f) = (0; \\infty)$, $H(f) = \\mathbb{R}$. Argument logaritmu musí být kladný — to je podmínka, na kterou se nejčastěji zapomíná.',
        '$D(f) = (0, \\infty)$, $H(f) = \\mathbb{R}$. The argument of a logarithm must be positive — the condition most often forgotten.',
      ),
      it: L(
        'Decibely, pH i stupnice zemětřesení jsou logaritmické: stejný krok na stupnici znamená stejné násobení veličiny.',
        'Decibels, pH and earthquake magnitudes are logarithmic: the same step on the scale means the same multiplication of the quantity.',
      ),
    },
    terms: [{ cs: 'argument logaritmu', en: 'argument of a logarithm' }],
    fit: ['ISM', 'IMA1'],
    lab: { tool: 'explog', preset: { show: 'log' } },
  },
  {
    id: 'log.rules',
    title: L('Věty o logaritmech', 'Laws of logarithms'),
    summary: L(
      'Upravovat výrazy pomocí logaritmu součinu, podílu a mocniny a změnit základ.',
      'Rewrite expressions with the product, quotient and power laws, and change base.',
    ),
    area: 'explog',
    track: 'school',
    syllabusTopic: 8,
    prereqs: ['log.definition', 'alg.powers'],
    encompasses: [{ id: 'alg.powers', w: 0.4 }],
    why: {
      intuition: L(
        'Logaritmy jsou exponenty, takže se chovají jako exponenty: při násobení se sčítají, při umocňování násobí.',
        'Logarithms are exponents, so they behave like exponents: they add when you multiply and multiply when you raise to a power.',
      ),
      formal: L(
        '$\\log_a(xy) = \\log_a x + \\log_a y$, $\\log_a\\frac{x}{y} = \\log_a x - \\log_a y$, $\\log_a x^r = r\\log_a x$ pro $x, y > 0$.',
        '$\\log_a(xy) = \\log_a x + \\log_a y$, $\\log_a\\frac{x}{y} = \\log_a x - \\log_a y$, $\\log_a x^r = r\\log_a x$ for $x, y > 0$.',
      ),
      algebraic: L(
        'Pozor: $\\log(x + y)$ žádné pravidlo nemá. $\\log(x+y) \\ne \\log x + \\log y$.',
        'Careful: there is no rule for $\\log(x + y)$. $\\log(x+y) \\ne \\log x + \\log y$.',
      ),
      it: L(
        'Logaritmické pravítko násobilo sčítáním délek. Dnes se stejným trikem sčítají logaritmy pravděpodobností místo násobení malých čísel, která by podtekla.',
        'A slide rule multiplied by adding lengths. Today the same trick adds log-probabilities instead of multiplying tiny numbers that would underflow.',
      ),
    },
    fit: ['ISM', 'IMA1', 'IAL'],
  },

  // ---------------------------------------------------------------- 9 exponential equations
  {
    id: 'expeq.same-base',
    title: L('Exponenciální rovnice: stejný základ', 'Exponential equations: common base'),
    summary: L(
      'Převést obě strany rovnice na mocniny téhož základu a porovnat exponenty.',
      'Rewrite both sides as powers of the same base and equate the exponents.',
    ),
    area: 'explog',
    track: 'school',
    syllabusTopic: 9,
    prereqs: ['exp.function', 'alg.linear-eq'],
    encompasses: [{ id: 'alg.powers', w: 0.5 }],
    why: {
      intuition: L(
        'Exponenciální funkce je prostá: stejný výsledek dostaneš jen ze stejného exponentu. Proto z $a^u = a^v$ plyne $u = v$.',
        'An exponential function is injective: the same result comes only from the same exponent. That is why $a^u = a^v$ gives $u = v$.',
      ),
      algebraic: L(
        'Základ sjednotíš rozkladem: $4 = 2^2$, $8 = 2^3$, $\\frac{1}{2} = 2^{-1}$, $\\sqrt{2} = 2^{1/2}$.',
        'Unify the base by rewriting: $4 = 2^2$, $8 = 2^3$, $\\frac{1}{2} = 2^{-1}$, $\\sqrt{2} = 2^{1/2}$.',
      ),
    },
    fit: ['ISM'],
  },
  {
    id: 'expeq.advanced',
    title: L('Exponenciální rovnice: substituce a logaritmování', 'Exponential equations: substitution and logarithms'),
    summary: L(
      'Řešit rovnice substitucí $t = a^x$ a rovnice, kde základ sjednotit nejde, logaritmováním.',
      'Solve equations by the substitution $t = a^x$, and those where bases cannot be unified by taking logarithms.',
    ),
    area: 'explog',
    track: 'school',
    syllabusTopic: 9,
    prereqs: ['expeq.same-base', 'alg.quad-eq', 'log.definition'],
    encompasses: [
      { id: 'expeq.same-base', w: 0.5 },
      { id: 'alg.quad-eq', w: 0.4 },
    ],
    why: {
      intuition: L(
        'Když se $a^x$ v rovnici opakuje, schovej ho za písmeno. Z rovnice se stane kvadratická — jen nezapomeň, že $t = a^x$ musí být kladné.',
        'When $a^x$ repeats in an equation, hide it behind a letter. The equation becomes quadratic — just remember that $t = a^x$ must be positive.',
      ),
      algebraic: L(
        '$2^x = 5$ nemá „hezké“ řešení. Logaritmus je přesně nástroj na vytažení neznámé z exponentu: $x = \\log_2 5 = \\frac{\\log 5}{\\log 2}$.',
        '$2^x = 5$ has no “nice” solution. The logarithm is exactly the tool for pulling an unknown out of an exponent: $x = \\log_2 5 = \\frac{\\log 5}{\\log 2}$.',
      ),
    },
    fit: ['ISM'],
  },

  // --------------------------------------------------------------- 10 logarithmic equations
  {
    id: 'logeq.basic',
    title: L('Logaritmické rovnice: základní typy', 'Logarithmic equations: basic types'),
    summary: L(
      'Řešit rovnice $\\log_a f(x) = c$ a $\\log_a f(x) = \\log_a g(x)$ včetně podmínek.',
      'Solve $\\log_a f(x) = c$ and $\\log_a f(x) = \\log_a g(x)$, conditions included.',
    ),
    area: 'explog',
    track: 'school',
    syllabusTopic: 10,
    prereqs: ['log.function', 'alg.linear-eq'],
    why: {
      intuition: L(
        'Logaritmus odstraníš tím, že se vrátíš k definici: $\\log_a A = c$ říká $A = a^c$.',
        'You remove a logarithm by going back to its definition: $\\log_a A = c$ says $A = a^c$.',
      ),
      formal: L(
        'Každý argument logaritmu musí být kladný. Podmínky napiš před řešením a každý kořen jimi na konci prožeň — odlogaritmování může přidat kořen, který nevyhovuje.',
        'Every argument of a logarithm must be positive. Write the conditions before solving and test every root against them at the end — removing logarithms can introduce a root that does not fit.',
      ),
    },
    fit: ['ISM'],
  },
  {
    id: 'logeq.rules',
    title: L('Logaritmické rovnice: věty a substituce', 'Logarithmic equations: laws and substitution'),
    summary: L(
      'Řešit rovnice, kde je nejdřív třeba použít věty o logaritmech nebo substituci $t = \\log_a x$.',
      'Solve equations that first need the laws of logarithms or the substitution $t = \\log_a x$.',
    ),
    area: 'explog',
    track: 'school',
    syllabusTopic: 10,
    prereqs: ['logeq.basic', 'log.rules', 'alg.quad-eq'],
    encompasses: [
      { id: 'logeq.basic', w: 0.5 },
      { id: 'log.rules', w: 0.5 },
    ],
    why: {
      intuition: L(
        'Cíl je vždy stejný: jeden logaritmus vlevo, jeden vpravo (nebo číslo). Věty o logaritmech jsou nástroj, jak se tam dostat.',
        'The goal is always the same: one logarithm on the left, one on the right (or a number). The laws of logarithms are the tool to get there.',
      ),
      algebraic: L(
        'Sloučením $\\log x + \\log(x-3)$ do $\\log(x(x-3))$ se definiční obor rozšíří. Proto podmínky určuj z původní rovnice, ne z upravené.',
        'Merging $\\log x + \\log(x-3)$ into $\\log(x(x-3))$ enlarges the domain. So take the conditions from the original equation, not the rewritten one.',
      ),
    },
    fit: ['ISM'],
  },
];
