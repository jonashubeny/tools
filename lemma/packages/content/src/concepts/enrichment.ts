import { L, type Concept } from '@lemma/core';

/**
 * Enrichment: reasoning and preparation for first-year FIT courses.
 * NOT part of the school syllabus — tracks 'reasoning' and 'vut' only.
 */
export const ENRICHMENT_CONCEPTS: Concept[] = [
  // --------------------------------------------------------------------------- reasoning
  {
    id: 'reason.logic',
    title: L('Výroky a logické spojky', 'Propositions and connectives'),
    summary: L(
      'Určit pravdivost složeného výroku a sestavit pravdivostní tabulku.',
      'Determine the truth of a compound proposition and build a truth table.',
    ),
    area: 'reasoning',
    track: 'reasoning',
    prereqs: [],
    why: {
      intuition: L(
        'Výrok je věta, o které má smysl říct, že je pravdivá nebo nepravdivá. Spojky z jednoduchých výroků skládají složité — stejně jako operátory v podmínce.',
        'A proposition is a sentence that is either true or false. Connectives build complex ones from simple ones — just like operators in a condition.',
      ),
      formal: L(
        'Implikace $A \\Rightarrow B$ je nepravdivá jen v jednom případě: $A$ platí a $B$ ne. Z nepravdy plyne cokoli.',
        'The implication $A \\Rightarrow B$ is false in exactly one case: $A$ holds and $B$ does not. From a falsehood anything follows.',
      ),
      it: L(
        '`&&`, `||`, `!` jsou konjunkce, disjunkce a negace. De Morganovy zákony jsou to, čím přepisuješ `!(a && b)` na `!a || !b`. Na FIT na tom stojí Diskrétní matematika, Základy logiky i Návrh číslicových systémů.',
        '`&&`, `||`, `!` are conjunction, disjunction and negation. De Morgan’s laws are what you use to rewrite `!(a && b)` as `!a || !b`. At FIT, Discrete Mathematics, Foundations of Logic and Digital Design all build on this.',
      ),
    },
    terms: [
      { cs: 'výrok', en: 'proposition' },
      { cs: 'konjunkce, disjunkce', en: 'conjunction, disjunction' },
      { cs: 'implikace, ekvivalence', en: 'implication, equivalence' },
      { cs: 'negace', en: 'negation' },
    ],
    fit: ['IDM', 'IZLO', 'INC'],
  },
  {
    id: 'reason.quantifiers',
    title: L('Kvantifikátory a negace', 'Quantifiers and negation'),
    summary: L(
      'Číst a negovat výroky s „pro každé“ a „existuje“.',
      'Read and negate statements with “for all” and “there exists”.',
    ),
    area: 'reasoning',
    track: 'reasoning',
    prereqs: ['reason.logic'],
    why: {
      intuition: L(
        'Tvrzení „všechny testy prošly“ vyvrátíš jediným testem, který neprošel. Negace „pro každé“ je proto „existuje“.',
        'The claim “all tests passed” is refuted by a single failing test. So the negation of “for all” is “there exists”.',
      ),
      formal: L(
        '$\\neg(\\forall x: P(x)) \\iff \\exists x: \\neg P(x)$ a $\\neg(\\exists x: P(x)) \\iff \\forall x: \\neg P(x)$.',
        '$\\neg(\\forall x: P(x)) \\iff \\exists x: \\neg P(x)$ and $\\neg(\\exists x: P(x)) \\iff \\forall x: \\neg P(x)$.',
      ),
      it: L(
        '`all()` a `any()` v Pythonu, `All` a `Any` v C# LINQ jsou kvantifikátory nad kolekcí. `!list.All(p)` je totéž co `list.Any(x => !p(x))`.',
        '`all()` and `any()` in Python, `All` and `Any` in C# LINQ are quantifiers over a collection. `!list.All(p)` is the same as `list.Any(x => !p(x))`.',
      ),
    },
    terms: [
      { cs: 'obecný kvantifikátor', en: 'universal quantifier' },
      { cs: 'existenční kvantifikátor', en: 'existential quantifier' },
    ],
    fit: ['IDM', 'IZLO'],
  },
  {
    id: 'reason.sets',
    title: L('Množiny a operace s nimi', 'Sets and set operations'),
    summary: L(
      'Určit sjednocení, průnik, rozdíl a doplněk a spočítat prvky pomocí principu inkluze a exkluze.',
      'Find unions, intersections, differences and complements, and count elements by inclusion–exclusion.',
    ),
    area: 'discrete',
    track: 'reasoning',
    prereqs: ['reason.logic'],
    why: {
      intuition: L(
        'Množinové operace jsou logické spojky v jiném kabátě: průnik je „a zároveň“, sjednocení „nebo“, doplněk „ne“.',
        'Set operations are logical connectives in other clothes: intersection is “and”, union is “or”, complement is “not”.',
      ),
      formal: L(
        '$|A \\cup B| = |A| + |B| - |A \\cap B|$ — co je v obou, bys jinak započítal dvakrát.',
        '$|A \\cup B| = |A| + |B| - |A \\cap B|$ — what lies in both would otherwise be counted twice.',
      ),
      it: L(
        'SQL `JOIN`, `UNION`, `EXCEPT`, uživatelské skupiny a oprávnění v Linuxu, `sort | uniq | comm` v shellu — to všechno jsou operace s množinami.',
        'SQL `JOIN`, `UNION`, `EXCEPT`, Linux user groups and permissions, `sort | uniq | comm` in a shell — all of these are set operations.',
      ),
    },
    terms: [
      { cs: 'sjednocení, průnik', en: 'union, intersection' },
      { cs: 'doplněk, rozdíl', en: 'complement, difference' },
      { cs: 'podmnožina', en: 'subset' },
    ],
    fit: ['IDM'],
  },
  {
    id: 'reason.proof',
    title: L('Jak se dokazuje', 'How proofs work'),
    summary: L(
      'Rozlišit přímý důkaz, nepřímý důkaz a důkaz sporem a poznat chybný argument.',
      'Tell apart direct proof, proof by contrapositive and proof by contradiction, and spot a faulty argument.',
    ),
    area: 'reasoning',
    track: 'reasoning',
    prereqs: ['reason.quantifiers'],
    why: {
      intuition: L(
        'Příklad nic nedokazuje, protipříklad ano. Důkaz je argument, který nenechá žádnou skulinu — pro všechna čísla najednou.',
        'An example proves nothing; a counterexample does. A proof is an argument that leaves no gap — for all numbers at once.',
      ),
      formal: L(
        'Nepřímý důkaz využívá, že $A \\Rightarrow B$ je totéž co $\\neg B \\Rightarrow \\neg A$. Pozor: není to totéž co $B \\Rightarrow A$.',
        'Proof by contrapositive uses that $A \\Rightarrow B$ is the same as $\\neg B \\Rightarrow \\neg A$. Careful: it is not the same as $B \\Rightarrow A$.',
      ),
      it: L(
        'Testy ukazují, že program funguje na vyzkoušených vstupech; důkaz, že funguje na všech. Diskrétní matematika na FIT výslovně učí „přesně formulovat tvrzení a jejich důkazy“.',
        'Tests show a program works on the inputs you tried; a proof shows it works on all of them. Discrete Mathematics at FIT explicitly teaches “formulating statements and their proofs precisely”.',
      ),
    },
    terms: [
      { cs: 'přímý důkaz', en: 'direct proof' },
      { cs: 'nepřímý důkaz (obměnou)', en: 'proof by contrapositive' },
      { cs: 'důkaz sporem', en: 'proof by contradiction' },
      { cs: 'protipříklad', en: 'counterexample' },
    ],
    fit: ['IDM', 'IZLO', 'IAL'],
  },

  // ---------------------------------------------------------------------------- VUT prep
  {
    id: 'comp.binary',
    title: L('Dvojková a šestnáctková soustava', 'Binary and hexadecimal'),
    summary: L(
      'Převádět čísla mezi desítkovou, dvojkovou a šestnáctkovou soustavou.',
      'Convert numbers between decimal, binary and hexadecimal.',
    ),
    area: 'computing',
    track: 'vut',
    prereqs: ['alg.powers'],
    why: {
      intuition: L(
        'Poziční soustava je součet mocnin základu. V desítkové jsou to mocniny deseti, ve dvojkové mocniny dvou — pravidlo je stejné.',
        'A positional system is a sum of powers of the base. In decimal they are powers of ten, in binary powers of two — the rule is the same.',
      ),
      algebraic: L(
        '$1011_2 = 1\\cdot 2^3 + 0\\cdot 2^2 + 1\\cdot 2^1 + 1\\cdot 2^0 = 11$. Jedna šestnáctková číslice jsou přesně čtyři bity.',
        '$1011_2 = 1\\cdot 2^3 + 0\\cdot 2^2 + 1\\cdot 2^1 + 1\\cdot 2^0 = 11$. One hexadecimal digit is exactly four bits.',
      ),
      it: L(
        'Oprávnění `chmod 755`, maska sítě `/24`, barva `#1f6feb`, adresa v paměti `0x7ffe…`. Na FIT se s tím pracuje hned v prvním ročníku v Programování na strojové úrovni a v Návrhu číslicových systémů.',
        '`chmod 755` permissions, a `/24` netmask, the colour `#1f6feb`, a memory address `0x7ffe…`. At FIT you work with this from the first year, in Machine-Level Programming and Digital Design.',
      ),
    },
    terms: [
      { cs: 'dvojková soustava', en: 'binary' },
      { cs: 'šestnáctková soustava', en: 'hexadecimal' },
      { cs: 'bit, bajt', en: 'bit, byte' },
    ],
    fit: ['ISC', 'ISU', 'INC'],
  },
  {
    id: 'comp.boolean',
    title: L('Booleova algebra a hradla', 'Boolean algebra and gates'),
    summary: L(
      'Zjednodušit logický výraz pomocí zákonů Booleovy algebry a vyhodnotit jednoduchý obvod.',
      'Simplify a logical expression with the laws of Boolean algebra and evaluate a simple circuit.',
    ),
    area: 'computing',
    track: 'vut',
    prereqs: ['reason.logic', 'comp.binary'],
    why: {
      intuition: L(
        'Hradlo je logická spojka z křemíku. Sčítačka v procesoru není nic jiného než pár hradel XOR a AND.',
        'A gate is a logical connective made of silicon. The adder in a processor is nothing but a few XOR and AND gates.',
      ),
      formal: L(
        'Zákony jako u množin: komutativita, distributivita, De Morgan. Navíc $A \\cdot \\overline{A} = 0$ a $A + \\overline{A} = 1$.',
        'The laws mirror those of sets: commutativity, distributivity, De Morgan. In addition $A \\cdot \\overline{A} = 0$ and $A + \\overline{A} = 1$.',
      ),
      it: L(
        'Bitové operace `&`, `|`, `^`, `~` dělají totéž na všech bitech najednou — tak se nastavují příznaky, počítají masky sítí a kontrolní součty.',
        'The bitwise operators `&`, `|`, `^`, `~` do the same on all bits at once — that is how flags are set, netmasks computed and checksums built.',
      ),
    },
    terms: [
      { cs: 'hradlo', en: 'gate' },
      { cs: 'pravdivostní tabulka', en: 'truth table' },
    ],
    fit: ['INC', 'IDM'],
  },
  {
    id: 'comp.complexity',
    title: L('Jak rychle funkce rostou', 'How fast functions grow'),
    summary: L(
      'Porovnat růst $\\log n$, $n$, $n\\log n$, $n^2$ a $2^n$ a odhadnout počet kroků algoritmu.',
      'Compare the growth of $\\log n$, $n$, $n\\log n$, $n^2$ and $2^n$, and estimate the steps of an algorithm.',
    ),
    area: 'computing',
    track: 'vut',
    prereqs: ['log.definition', 'exp.function', 'pow.natural'],
    why: {
      intuition: L(
        'Otázka není „jak dlouho to trvá“, ale „co se stane, když vstup zdvojnásobím“. Lineární algoritmus zabere dvakrát déle, kvadratický čtyřikrát, exponenciální na druhou.',
        'The question is not “how long does it take” but “what happens when I double the input”. A linear algorithm takes twice as long, a quadratic one four times, an exponential one squares its time.',
      ),
      formal: L(
        'Pro velká $n$ platí $\\log n \\ll n \\ll n\\log n \\ll n^2 \\ll 2^n$. Na konstantách nezáleží — řád růstu je vždycky předežene.',
        'For large $n$: $\\log n \\ll n \\ll n\\log n \\ll n^2 \\ll 2^n$. Constants do not matter — the order of growth always overtakes them.',
      ),
      it: L(
        'Binární vyhledávání v milionu položek: 20 kroků. Lineární: milion. Třídění bublinkou: bilion. Proto je předmět Algoritmy na FIT z velké části o složitosti.',
        'Binary search in a million items: 20 steps. Linear search: a million. Bubble sort: a trillion. That is why much of FIT’s Algorithms course is about complexity.',
      ),
    },
    terms: [
      { cs: 'časová složitost', en: 'time complexity' },
      { cs: 'řád růstu', en: 'order of growth' },
    ],
    fit: ['IAL', 'ISC'],
  },
];
