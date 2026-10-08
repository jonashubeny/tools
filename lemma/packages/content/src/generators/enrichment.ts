import { L, setL, type Generator, type Rng } from '@lemma/core';
import { gen, mc, step } from './helpers';
import {
  FALSE,
  TRUE,
  assignments,
  atom,
  bin,
  equivalent,
  evaluate,
  formulaCode,
  formulaGates,
  formulaTex,
  literal,
  not,
  replaceOp,
  trueRows,
  truthTableTex,
  variablesOf,
  type BinaryOp,
  type Formula,
} from './logic-kit';

/**
 * Enrichment: reasoning and the mathematics of computing. None of this is in the school
 * syllabus — it prepares for discrete mathematics and is labelled as enrichment wherever
 * it is shown.
 */

const capital = (text: string): string => `${text[0]!.toUpperCase()}${text.slice(1)}`;

// ------------------------------------------------------------------------ implications

interface Implication {
  p: L;
  notP: L;
  q: L;
  notQ: L;
}

const IMPLICATIONS: Implication[] = [
  {
    p: L('prší', 'it is raining'),
    notP: L('neprší', 'it is not raining'),
    q: L('je mokro', 'the ground is wet'),
    notQ: L('není mokro', 'the ground is not wet'),
  },
  {
    p: L('číslo je dělitelné čtyřmi', 'a number is divisible by four'),
    notP: L('číslo není dělitelné čtyřmi', 'a number is not divisible by four'),
    q: L('je sudé', 'it is even'),
    notQ: L('není sudé', 'it is not even'),
  },
  {
    p: L('program projde testy', 'the program passes the tests'),
    notP: L('program neprojde testy', 'the program does not pass the tests'),
    q: L('nasadí se na server', 'it is deployed to the server'),
    notQ: L('nenasadí se na server', 'it is not deployed to the server'),
  },
  {
    p: L('čtyřúhelník je čtverec', 'a quadrilateral is a square'),
    notP: L('čtyřúhelník není čtverec', 'a quadrilateral is not a square'),
    q: L('má všechny úhly pravé', 'all its angles are right angles'),
    notQ: L('nemá všechny úhly pravé', 'not all its angles are right angles'),
  },
  {
    p: L('$x > 5$', '$x > 5$'),
    notP: L('$x \\le 5$', '$x \\le 5$'),
    q: L('$x > 3$', '$x > 3$'),
    notQ: L('$x \\le 3$', '$x \\le 3$'),
  },
  {
    p: L('heslo je správné', 'the password is correct'),
    notP: L('heslo není správné', 'the password is not correct'),
    q: L('uživatel je přihlášen', 'the user is logged in'),
    notQ: L('uživatel není přihlášen', 'the user is not logged in'),
  },
];

const ifThen = (a: L, b: L): L => L(`Jestliže ${a.cs}, pak ${b.cs}.`, `If ${a.en}, then ${b.en}.`);

// -------------------------------------------------------------------------- quantifiers

interface Predicate {
  holds: string;
  fails: string;
  /** A tempting but wrong negation: the mirror image instead of the complement. */
  mirror: string;
}

function singlePredicates(r: Rng): Predicate[] {
  const k = r.int(2, 9);
  const a = r.int(1, 6);
  return [
    { holds: 'x^2 \\ge 0', fails: 'x^2 < 0', mirror: 'x^2 \\le 0' },
    { holds: `x > ${k}`, fails: `x \\le ${k}`, mirror: `x < ${k}` },
    { holds: `x + ${a} = ${a + k}`, fails: `x + ${a} \\ne ${a + k}`, mirror: `x + ${a} > ${a + k}` },
    { holds: `|x| \\le ${k}`, fails: `|x| > ${k}`, mirror: `|x| \\ge ${k}` },
    { holds: `2x < x + ${k}`, fails: `2x \\ge x + ${k}`, mirror: `2x > x + ${k}` },
  ];
}

function doublePredicates(r: Rng): { holds: string; fails: string }[] {
  const k = r.int(1, 9);
  return [
    { holds: 'x + y = 0', fails: 'x + y \\ne 0' },
    { holds: 'x \\cdot y = 1', fails: 'x \\cdot y \\ne 1' },
    { holds: 'y > x', fails: 'y \\le x' },
    { holds: `x + y > ${k}`, fails: `x + y \\le ${k}` },
    { holds: 'y^2 = x', fails: 'y^2 \\ne x' },
  ];
}

const FLIP = { '\\forall': '\\exists', '\\exists': '\\forall' } as const;
type Quantifier = keyof typeof FLIP;

// -------------------------------------------------------------------------------- proofs

const PROOF_KINDS = {
  direct: L('přímý důkaz', 'direct proof'),
  contrapositive: L('nepřímý důkaz (důkaz obměněné implikace)', 'proof by contrapositive'),
  contradiction: L('důkaz sporem', 'proof by contradiction'),
  induction: L('důkaz matematickou indukcí', 'proof by induction'),
  counterexample: L('vyvrácení protipříkladem', 'disproof by counterexample'),
} as const;
type ProofKind = keyof typeof PROOF_KINDS;

const PROOFS: { kind: ProofKind; claim: L; argument: L; why: L }[] = [
  {
    kind: 'direct',
    claim: L('Součet dvou sudých čísel je sudý.', 'The sum of two even numbers is even.'),
    argument: L(
      'Buď $a = 2k$ a $b = 2m$. Pak $a + b = 2k + 2m = 2(k + m)$, což je sudé číslo.',
      'Let $a = 2k$ and $b = 2m$. Then $a + b = 2k + 2m = 2(k + m)$, which is even.',
    ),
    why: L(
      'Vychází se z předpokladu a řetězem úprav se dojde přímo k závěru.',
      'It starts from the hypothesis and reaches the conclusion directly through a chain of steps.',
    ),
  },
  {
    kind: 'direct',
    claim: L(
      'Jestliže $a$ dělí $b$ a $b$ dělí $c$, pak $a$ dělí $c$.',
      'If $a$ divides $b$ and $b$ divides $c$, then $a$ divides $c$.',
    ),
    argument: L(
      'Platí $b = a \\cdot k$ a $c = b \\cdot m$. Dosazením $c = a \\cdot (k \\cdot m)$, tedy $a$ dělí $c$.',
      'We have $b = a \\cdot k$ and $c = b \\cdot m$. Substituting, $c = a \\cdot (k \\cdot m)$, so $a$ divides $c$.',
    ),
    why: L(
      'Vychází se z předpokladu a řetězem úprav se dojde přímo k závěru.',
      'It starts from the hypothesis and reaches the conclusion directly through a chain of steps.',
    ),
  },
  {
    kind: 'contrapositive',
    claim: L('Jestliže je $n^2$ sudé, pak je $n$ sudé.', 'If $n^2$ is even, then $n$ is even.'),
    argument: L(
      'Předpokládejme, že $n$ je liché: $n = 2k + 1$. Pak $n^2 = 4k^2 + 4k + 1 = 2(2k^2 + 2k) + 1$ je liché.',
      'Suppose $n$ is odd: $n = 2k + 1$. Then $n^2 = 4k^2 + 4k + 1 = 2(2k^2 + 2k) + 1$ is odd.',
    ),
    why: L(
      'Místo „$A \\Rightarrow B$“ se dokázalo „ne $B \\Rightarrow$ ne $A$“. Obě implikace říkají totéž.',
      'Instead of “$A \\Rightarrow B$” it proves “not $B \\Rightarrow$ not $A$”. The two implications say the same thing.',
    ),
  },
  {
    kind: 'contrapositive',
    claim: L(
      'Jestliže $n^2$ není dělitelné třemi, pak $n$ není dělitelné třemi.',
      'If $n^2$ is not divisible by three, then $n$ is not divisible by three.',
    ),
    argument: L(
      'Předpokládejme, že $n$ je dělitelné třemi: $n = 3k$. Pak $n^2 = 9k^2 = 3 \\cdot 3k^2$ je dělitelné třemi.',
      'Suppose $n$ is divisible by three: $n = 3k$. Then $n^2 = 9k^2 = 3 \\cdot 3k^2$ is divisible by three.',
    ),
    why: L(
      'Místo „$A \\Rightarrow B$“ se dokázalo „ne $B \\Rightarrow$ ne $A$“. Obě implikace říkají totéž.',
      'Instead of “$A \\Rightarrow B$” it proves “not $B \\Rightarrow$ not $A$”. The two implications say the same thing.',
    ),
  },
  {
    kind: 'contradiction',
    claim: L('Číslo $\\sqrt{2}$ není racionální.', 'The number $\\sqrt{2}$ is not rational.'),
    argument: L(
      'Předpokládejme, že $\\sqrt{2} = \\frac{p}{q}$ je zlomek v základním tvaru. Pak $p^2 = 2q^2$, takže $p$ je sudé, $p = 2r$. Odtud $q^2 = 2r^2$, takže i $q$ je sudé — zlomek tedy v základním tvaru nebyl.',
      'Suppose $\\sqrt{2} = \\frac{p}{q}$ is a fraction in lowest terms. Then $p^2 = 2q^2$, so $p$ is even, $p = 2r$. Hence $q^2 = 2r^2$, so $q$ is even too — the fraction was not in lowest terms after all.',
    ),
    why: L(
      'Předpokládá se opak tvrzení a dojde se k něčemu, co nemůže být pravda.',
      'The opposite of the claim is assumed and leads to something that cannot be true.',
    ),
  },
  {
    kind: 'contradiction',
    claim: L('Prvočísel je nekonečně mnoho.', 'There are infinitely many primes.'),
    argument: L(
      'Předpokládejme, že jich je konečně mnoho: $p_1, \\dots, p_k$. Číslo $N = p_1 \\cdots p_k + 1$ dává po dělení každým z nich zbytek 1, není tedy dělitelné žádným prvočíslem — což nelze.',
      'Suppose there are finitely many: $p_1, \\dots, p_k$. The number $N = p_1 \\cdots p_k + 1$ leaves remainder 1 on division by each of them, so no prime divides it — which is impossible.',
    ),
    why: L(
      'Předpokládá se opak tvrzení a dojde se k něčemu, co nemůže být pravda.',
      'The opposite of the claim is assumed and leads to something that cannot be true.',
    ),
  },
  {
    kind: 'induction',
    claim: L(
      'Pro každé přirozené $n$ platí $1 + 2 + \\dots + n = \\frac{n(n + 1)}{2}$.',
      'For every natural $n$, $1 + 2 + \\dots + n = \\frac{n(n + 1)}{2}$.',
    ),
    argument: L(
      'Pro $n = 1$ rovnost platí. Platí-li pro nějaké $n$, pak $1 + \\dots + n + (n + 1) = \\frac{n(n + 1)}{2} + (n + 1) = \\frac{(n + 1)(n + 2)}{2}$, tedy platí i pro $n + 1$.',
      'For $n = 1$ the equality holds. If it holds for some $n$, then $1 + \\dots + n + (n + 1) = \\frac{n(n + 1)}{2} + (n + 1) = \\frac{(n + 1)(n + 2)}{2}$, so it holds for $n + 1$ as well.',
    ),
    why: L(
      'Ověří se první případ a ukáže se, že z každého případu plyne následující.',
      'The first case is checked, and each case is shown to imply the next.',
    ),
  },
  {
    kind: 'counterexample',
    claim: L('Tvrzení „každé prvočíslo je liché“ neplatí.', 'The claim “every prime is odd” is false.'),
    argument: L('Číslo 2 je prvočíslo a je sudé.', 'The number 2 is a prime and it is even.'),
    why: L(
      'Obecné tvrzení („pro každé“) vyvrátí jediný případ, kde neplatí.',
      'A general claim (“for every”) is refuted by a single case where it fails.',
    ),
  },
  {
    kind: 'counterexample',
    claim: L(
      'Tvrzení „pro každé reálné $x$ platí $x^2 > x$“ neplatí.',
      'The claim “$x^2 > x$ for every real $x$” is false.',
    ),
    argument: L(
      'Pro $x = \\frac{1}{2}$ je $x^2 = \\frac{1}{4} < \\frac{1}{2}$.',
      'For $x = \\frac{1}{2}$, $x^2 = \\frac{1}{4} < \\frac{1}{2}$.',
    ),
    why: L(
      'Obecné tvrzení („pro každé“) vyvrátí jediný případ, kde neplatí.',
      'A general claim (“for every”) is refuted by a single case where it fails.',
    ),
  },
];

const FLAWS: {
  task: L;
  lines: string[];
  wrong: number;
  error: 'algebra' | 'domain' | 'sign';
  cs: string;
  en: string;
}[] = [
  {
    task: L('„Důkaz“, že $2 = 1$ (pro $a = b$, $a \\ne 0$)', 'A “proof” that $2 = 1$ (for $a = b$, $a \\ne 0$)'),
    lines: [
      'a^2 = ab',
      'a^2 - b^2 = ab - b^2',
      '(a - b)(a + b) = b(a - b)',
      'a + b = b',
      '2b = b \\;\\Rightarrow\\; 2 = 1',
    ],
    wrong: 3,
    error: 'domain',
    cs: 'Mezi třetím a čtvrtým řádkem se dělilo výrazem $a - b$. Jenže $a = b$, takže se dělilo nulou.',
    en: 'Between lines three and four both sides were divided by $a - b$. But $a = b$, so that was a division by zero.',
  },
  {
    task: L('„Řešení“ rovnice $x^2 = 3x$', 'A “solution” of the equation $x^2 = 3x$'),
    lines: ['x^2 = 3x', 'x = 3', 'K = \\{3\\}'],
    wrong: 1,
    error: 'domain',
    cs: 'Dělilo se neznámou $x$, která může být nula. Tím se ztratilo řešení $x = 0$. Správně: $x(x - 3) = 0$.',
    en: 'Both sides were divided by the unknown $x$, which may be zero. That lost the solution $x = 0$. Correctly: $x(x - 3) = 0$.',
  },
  {
    task: L('„Důkaz“, že $-1 = 1$', 'A “proof” that $-1 = 1$'),
    lines: ['(-1)^2 = 1^2', '\\sqrt{(-1)^2} = \\sqrt{1^2}', '-1 = 1'],
    wrong: 2,
    error: 'sign',
    cs: 'První dva řádky platí. Ale $\\sqrt{a^2} = |a|$, ne $a$: na obou stranách vyjde 1.',
    en: 'The first two lines are true. But $\\sqrt{a^2} = |a|$, not $a$: both sides come out as 1.',
  },
  {
    task: L('„Řešení“ nerovnice $-2x > 6$', 'A “solution” of the inequality $-2x > 6$'),
    lines: ['-2x > 6', 'x > -3'],
    wrong: 1,
    error: 'sign',
    cs: 'Při dělení záporným číslem se znak nerovnosti otáčí: $x < -3$.',
    en: 'Dividing by a negative number reverses the inequality: $x < -3$.',
  },
  {
    task: L('„Důkaz“, že $(a + b)^2 = a^2 + b^2$', 'A “proof” that $(a + b)^2 = a^2 + b^2$'),
    lines: ['(a + b)^2 = (a + b)(a + b)', '= a \\cdot a + b \\cdot b', '= a^2 + b^2'],
    wrong: 1,
    error: 'algebra',
    cs: 'Každý člen první závorky se násobí každým členem druhé: chybí $ab + ba = 2ab$. Stačí zkusit $a = b = 1$.',
    en: 'Every term of the first bracket multiplies every term of the second: $ab + ba = 2ab$ is missing. Just try $a = b = 1$.',
  },
];

// ------------------------------------------------------------------------ Boolean laws

export interface BooleanLaw {
  level: 2 | 3;
  expr: Formula;
  simple: Formula;
  name: L;
  why: L;
}

const [A, B] = [atom('A'), atom('B')];

export const BOOLEAN_LAWS: BooleanLaw[] = [
  {
    level: 2,
    expr: bin('and', A, bin('or', A, B)),
    simple: A,
    name: L('absorpce', 'absorption'),
    why: L(
      'Je-li $A = 0$, je celý součin 0; je-li $A = 1$, je závorka 1. Výsledek vždy kopíruje $A$.',
      'If $A = 0$ the whole product is 0; if $A = 1$ the bracket is 1. The result always copies $A$.',
    ),
  },
  {
    level: 2,
    expr: bin('or', A, bin('and', A, B)),
    simple: A,
    name: L('absorpce', 'absorption'),
    why: L(
      'Druhý člen může být 1 jen tehdy, když už je $A = 1$ — nic nového nepřidá.',
      'The second term can be 1 only when $A$ already is — it adds nothing new.',
    ),
  },
  {
    level: 2,
    expr: not(bin('and', A, B)),
    simple: bin('or', not(A), not(B)),
    name: L('De Morganův zákon', "De Morgan's law"),
    why: L('„Neplatí obojí“ znamená „aspoň jedno neplatí“.', '“Not both” means “at least one fails”.'),
  },
  {
    level: 2,
    expr: not(bin('or', A, B)),
    simple: bin('and', not(A), not(B)),
    name: L('De Morganův zákon', "De Morgan's law"),
    why: L(
      '„Neplatí ani jedno“ znamená „neplatí první a neplatí druhé“.',
      '“Neither holds” means “the first fails and the second fails”.',
    ),
  },
  {
    level: 2,
    expr: bin('or', bin('and', A, B), bin('and', A, not(B))),
    simple: A,
    name: L('vytknutí a zákon vyloučeného třetího', 'factoring and the excluded middle'),
    why: L('$A \\land (B \\lor \\neg B) = A \\land 1 = A$.', '$A \\land (B \\lor \\neg B) = A \\land 1 = A$.'),
  },
  {
    level: 2,
    expr: bin('and', A, not(A)),
    simple: FALSE,
    name: L('zákon sporu', 'the law of non-contradiction'),
    why: L('Výrok a jeho negace nemohou platit zároveň.', 'A statement and its negation cannot both hold.'),
  },
  {
    level: 2,
    expr: bin('or', A, not(A)),
    simple: TRUE,
    name: L('zákon vyloučeného třetího', 'the law of the excluded middle'),
    why: L('Z výroku a jeho negace vždy jeden platí.', 'Of a statement and its negation, one always holds.'),
  },
  {
    level: 3,
    expr: bin('or', A, bin('and', not(A), B)),
    simple: bin('or', A, B),
    name: L('distributivní zákon', 'the distributive law'),
    why: L(
      '$(A \\lor \\neg A) \\land (A \\lor B) = 1 \\land (A \\lor B)$.',
      '$(A \\lor \\neg A) \\land (A \\lor B) = 1 \\land (A \\lor B)$.',
    ),
  },
  {
    level: 3,
    expr: bin('and', bin('or', A, B), bin('or', A, not(B))),
    simple: A,
    name: L('distributivní zákon', 'the distributive law'),
    why: L('$A \\lor (B \\land \\neg B) = A \\lor 0 = A$.', '$A \\lor (B \\land \\neg B) = A \\lor 0 = A$.'),
  },
  {
    level: 3,
    expr: not(bin('or', not(A), B)),
    simple: bin('and', A, not(B)),
    name: L('De Morganův zákon a dvojí negace', "De Morgan's law and double negation"),
    why: L(
      '$\\neg(\\neg A \\lor B) = \\neg\\neg A \\land \\neg B$.',
      '$\\neg(\\neg A \\lor B) = \\neg\\neg A \\land \\neg B$.',
    ),
  },
  {
    level: 3,
    expr: not(bin('and', A, not(B))),
    simple: bin('or', not(A), B),
    name: L('De Morganův zákon a dvojí negace', "De Morgan's law and double negation"),
    why: L(
      '$\\neg(A \\land \\neg B) = \\neg A \\lor \\neg\\neg B$. Je to přesně implikace $A \\Rightarrow B$.',
      '$\\neg(A \\land \\neg B) = \\neg A \\lor \\neg\\neg B$. It is exactly the implication $A \\Rightarrow B$.',
    ),
  },
  {
    level: 3,
    expr: bin('and', A, bin('or', not(A), B)),
    simple: bin('and', A, B),
    name: L('distributivní zákon', 'the distributive law'),
    why: L(
      '$(A \\land \\neg A) \\lor (A \\land B) = 0 \\lor (A \\land B)$.',
      '$(A \\land \\neg A) \\lor (A \\land B) = 0 \\lor (A \\land B)$.',
    ),
  },
  {
    level: 3,
    expr: bin('or', not(bin('or', A, B)), bin('and', not(A), B)),
    simple: not(A),
    name: L('De Morganův zákon a vytknutí', "De Morgan's law and factoring"),
    why: L(
      '$(\\neg A \\land \\neg B) \\lor (\\neg A \\land B) = \\neg A \\land (\\neg B \\lor B) = \\neg A$.',
      '$(\\neg A \\land \\neg B) \\lor (\\neg A \\land B) = \\neg A \\land (\\neg B \\lor B) = \\neg A$.',
    ),
  },
];

/** Simple forms offered as answers. */
const SIMPLE_FORMS: Formula[] = [
  A,
  B,
  not(A),
  not(B),
  bin('and', A, B),
  bin('or', A, B),
  bin('and', not(A), not(B)),
  bin('or', not(A), not(B)),
  bin('and', A, not(B)),
  bin('or', not(A), B),
  bin('and', not(A), B),
  bin('or', A, not(B)),
  FALSE,
  TRUE,
];

// --------------------------------------------------------------------------- complexity

/** Growth classes from slowest to fastest; `rank` orders them, the rest are ways of writing one. */
const GROWTH: { rank: number; forms: string[] }[] = [
  { rank: 0, forms: ['\\log_2 n', '5\\log_2 n', '\\log_2 n + 100'] },
  { rank: 1, forms: ['\\sqrt{n}', '20\\sqrt{n}'] },
  { rank: 2, forms: ['n', '1000n', 'n + 500', '3n + 7'] },
  { rank: 3, forms: ['n\\log_2 n', '10\\,n\\log_2 n'] },
  { rank: 4, forms: ['n^2', '\\frac{n^2}{100}', 'n^2 + 50n'] },
  { rank: 5, forms: ['n^3', '\\frac{n^3}{1000}'] },
  { rank: 6, forms: ['2^n', '\\frac{2^n}{1000}'] },
];

/** Space after every third digit, as numbers are written in both languages' textbooks. */
const grouped = (value: number): string => String(value).replace(/\B(?=(\d{3})+(?!\d))/g, '\\,');

export const ENRICHMENT_GENERATORS: Generator[] = [
  gen({
    id: 'reason.logic.truth',
    concept: 'reason.logic',
    kind: 'core',
    levels: [1, 2, 3],
    title: L('Pravdivostní hodnoty složených výroků', 'Truth values of compound propositions'),
    est: (lv) => 40 + 35 * lv,
    make(r, lv) {
      if (lv === 1) {
        const op = r.pick<BinaryOp>(['and', 'or', 'imp', 'iff']);
        const formula = bin(op, literal(r, 'A'), literal(r, 'B'));
        const env = { A: r.bool(), B: r.bool() };
        const value = evaluate(formula, env);
        const asIff = evaluate(replaceOp(formula, 'imp', 'iff'), env);
        return {
          prompt: L(
            `Výrok $A$ je ${env.A ? 'pravdivý' : 'nepravdivý'} a výrok $B$ je ${env.B ? 'pravdivý' : 'nepravdivý'}. Jakou pravdivostní hodnotu má výrok $${formulaTex(formula)}$?`,
            `The proposition $A$ is ${env.A ? 'true' : 'false'} and the proposition $B$ is ${env.B ? 'true' : 'false'}. What is the truth value of $${formulaTex(formula)}$?`,
          ),
          answer: {
            kind: 'choice',
            fixedOrder: true,
            options: [
              { id: '1', text: L('pravdivý (1)', 'true (1)') },
              { id: '0', text: L('nepravdivý (0)', 'false (0)') },
            ],
            correct: [value ? '1' : '0'],
          },
          hints: [
            L(
              'Nejdřív urči hodnoty negací, potom teprve spojku.',
              'First find the values of the negations, and only then apply the connective.',
            ),
            L(
              '$\\land$ platí, jen když platí obě části; $\\lor$, když aspoň jedna; $\\Rightarrow$ neplatí jen pro $1 \\Rightarrow 0$; $\\Leftrightarrow$ platí při stejných hodnotách.',
              '$\\land$ holds only when both parts hold; $\\lor$ when at least one does; $\\Rightarrow$ fails only for $1 \\Rightarrow 0$; $\\Leftrightarrow$ holds for equal values.',
            ),
          ],
          solution: [
            step(
              'Celá pravdivostní tabulka; hledaný řádek je ten s danými hodnotami $A$, $B$:',
              'The whole truth table; the row sought is the one with the given values of $A$, $B$:',
              truthTableTex(formula),
            ),
            step(
              `Pro $A = ${env.A ? 1 : 0}$, $B = ${env.B ? 1 : 0}$ je výrok ${value ? 'pravdivý' : 'nepravdivý'}.`,
              `For $A = ${env.A ? 1 : 0}$, $B = ${env.B ? 1 : 0}$ the proposition is ${value ? 'true' : 'false'}.`,
            ),
          ],
          misconceptions: [
            mc(
              value ? '0' : '1',
              'concept',
              op === 'imp' && asIff !== value
                ? 'Implikace s nepravdivým předpokladem je pravdivá: slib „jestliže $A$, pak $B$“ se poruší jen tehdy, když $A$ nastane a $B$ ne.'
                : 'Projdi výrok po částech: nejdřív negace, potom spojka.',
              op === 'imp' && asIff !== value
                ? 'An implication with a false premise is true: the promise “if $A$ then $B$” is broken only when $A$ happens and $B$ does not.'
                : 'Go through the proposition piece by piece: negations first, then the connective.',
            ),
          ],
        };
      }
      const names = lv === 2 ? ['A', 'B'] : ['A', 'B', 'C'];
      const ops: BinaryOp[] = lv === 2 ? ['and', 'or', 'imp'] : ['and', 'or', 'imp', 'iff'];
      // A formula that uses every variable and is neither always true nor always false.
      let formula: Formula = bin('and', A, B);
      for (let attempt = 0; attempt < 40; attempt++) {
        const inner = bin(r.pick(ops), literal(r, names[0]!), literal(r, names[1]!));
        formula =
          lv === 2 ? bin(r.pick(ops), inner, literal(r, r.pick(names))) : bin(r.pick(ops), inner, literal(r, 'C'));
        const count = trueRows(formula, names);
        if (count > 0 && count < 2 ** names.length && variablesOf(formula).length === names.length) break;
      }
      const count = trueRows(formula, names);
      const total = 2 ** names.length;
      const confusions: [BinaryOp, BinaryOp, boolean, string, string][] = [
        [
          'imp',
          'iff',
          false,
          'Implikace není ekvivalence: $0 \\Rightarrow 1$ je pravda.',
          'An implication is not an equivalence: $0 \\Rightarrow 1$ is true.',
        ],
        [
          'imp',
          'imp',
          true,
          'Implikace má směr: neplatí jen tehdy, když předpoklad platí a závěr ne.',
          'An implication has a direction: it fails only when the premise holds and the conclusion does not.',
        ],
        [
          'or',
          'xor',
          false,
          'Spojka „nebo“ v logice platí i tehdy, když platí obě části.',
          'In logic “or” also holds when both parts hold.',
        ],
      ];
      return {
        prompt: L(
          `Sestavte pravdivostní tabulku výroku $${formulaTex(formula)}$. V kolika z jejích ${total} řádků je výrok pravdivý?`,
          `Build the truth table of $${formulaTex(formula)}$. In how many of its ${total} rows is the proposition true?`,
        ),
        answer: { kind: 'number', value: `${count}` },
        hints: [
          L(
            `${names.length} proměnné dávají $2^{${names.length}} = ${total}$ kombinací. Vypiš je systematicky.`,
            `${names.length} variables give $2^{${names.length}} = ${total}$ combinations. List them systematically.`,
          ),
          L(
            'Přidej si pomocné sloupce: negace, vnitřní závorku a teprve potom celý výrok.',
            'Add helper columns: the negations, the inner bracket, and only then the whole proposition.',
          ),
        ],
        solution: [
          step('Pravdivostní tabulka:', 'The truth table:', truthTableTex(formula, '\\varphi')),
          step('Počet řádků s hodnotou 1:', 'The number of rows with the value 1:', `${count}`),
        ],
        misconceptions: [
          ...confusions.map(([from, to, swap, cs, en]) =>
            mc(`${trueRows(replaceOp(formula, from, to, swap), names)}`, 'concept', cs, en),
          ),
          mc(
            `${total - count}`,
            'misread',
            'To je počet řádků, kde je výrok nepravdivý.',
            'That is the number of rows where the proposition is false.',
          ),
        ],
      };
    },
  }),

  gen({
    id: 'reason.logic.implication',
    concept: 'reason.logic',
    kind: 'core',
    levels: [2, 3],
    title: L('Implikace, obměna a negace', 'Implication, contrapositive and negation'),
    est: 60,
    make(r, lv) {
      const s = r.pick(IMPLICATIONS);
      const askNegation = lv === 3 && r.bool(0.6);
      const options = r.shuffle([
        { id: 'contrapositive', text: ifThen(s.notQ, s.notP) },
        { id: 'converse', text: ifThen(s.q, s.p) },
        { id: 'inverse', text: ifThen(s.notP, s.notQ) },
        {
          id: 'negation',
          text: L(`${capital(s.p.cs)} a zároveň ${s.notQ.cs}.`, `${capital(s.p.en)} and yet ${s.notQ.en}.`),
        },
      ]);
      const original = ifThen(s.p, s.q);
      return {
        prompt: askNegation
          ? L(`Která věta je negací výroku „${original.cs}“?`, `Which sentence is the negation of “${original.en}”?`)
          : L(`Která věta říká totéž co výrok „${original.cs}“?`, `Which sentence says the same as “${original.en}”?`),
        answer: { kind: 'choice', fixedOrder: true, options, correct: [askNegation ? 'negation' : 'contrapositive'] },
        hints: askNegation
          ? [
              L('Kdy je slib „jestliže $A$, pak $B$“ porušen?', 'When is the promise “if $A$ then $B$” broken?'),
              L(
                'Jen tehdy, když $A$ nastane a $B$ ne. Negace implikace proto není implikace.',
                'Only when $A$ happens and $B$ does not. So the negation of an implication is not an implication.',
              ),
            ]
          : [
              L(
                'Zkus si představit situaci, kdy by původní věta neplatila, a ověř, že v ní neplatí ani tvoje volba — a naopak.',
                'Imagine a situation in which the original sentence fails and check that your choice fails there too — and vice versa.',
              ),
              L(
                '„Jestliže $A$, pak $B$“ je totéž co „jestliže ne $B$, pak ne $A$“.',
                '“If $A$ then $B$” is the same as “if not $B$ then not $A$”.',
              ),
            ],
        solution: askNegation
          ? [
              step(
                'Implikace $A \\Rightarrow B$ neplatí v jediném případě: $A$ platí a $B$ neplatí. Negace je proto:',
                'An implication $A \\Rightarrow B$ fails in exactly one case: $A$ holds and $B$ does not. So its negation is:',
                '\\neg(A \\Rightarrow B) \\;\\Leftrightarrow\\; A \\land \\neg B',
              ),
            ]
          : [
              step(
                'Implikace je ekvivalentní se svou obměnou:',
                'An implication is equivalent to its contrapositive:',
                '(A \\Rightarrow B) \\;\\Leftrightarrow\\; (\\neg B \\Rightarrow \\neg A)',
              ),
              step(
                'Obrácená věta („jestliže $B$, pak $A$“) je jiné tvrzení a z původního neplyne.',
                'The converse (“if $B$ then $A$”) is a different claim and does not follow from the original.',
              ),
            ],
        misconceptions: [
          mc(
            'converse',
            'concept',
            'To je obrácená implikace. Z „když prší, je mokro“ neplyne „když je mokro, prší“.',
            'That is the converse. “If it rains, the ground is wet” does not give “if the ground is wet, it rains”.',
          ),
          mc(
            'inverse',
            'concept',
            'Znegovat obě části nestačí — je potřeba je i prohodit. Tahle věta říká totéž co obrácená implikace.',
            'Negating both parts is not enough — they must also be swapped. This sentence says the same as the converse.',
          ),
          askNegation
            ? mc(
                'contrapositive',
                'concept',
                'To je obměna: říká totéž co původní výrok, není to jeho negace.',
                'That is the contrapositive: it says the same as the original, it is not its negation.',
              )
            : mc(
                'negation',
                'concept',
                'To je negace původního výroku — tvrdí přesný opak.',
                'That is the negation of the original — it claims the exact opposite.',
              ),
        ],
      };
    },
  }),

  gen({
    id: 'reason.quantifiers.negate',
    concept: 'reason.quantifiers',
    kind: 'core',
    levels: [2, 3],
    title: L('Negace výroku s kvantifikátorem', 'Negating a quantified statement'),
    est: (lv) => 55 + 25 * (lv - 2),
    make(r, lv) {
      const q = r.pick<Quantifier>(['\\forall', '\\exists']);
      if (lv === 2) {
        const p = r.pick(singlePredicates(r));
        const [shown, negated] = [p.holds, p.fails];
        const say = (quantifier: string, predicate: string): string =>
          `${quantifier} x \\in \\mathbb{R}:\\ ${predicate}`;
        const options = r.shuffle([
          { id: 'right', tex: say(FLIP[q], negated) },
          { id: 'quantifier', tex: say(FLIP[q], shown) },
          { id: 'predicate', tex: say(q, negated) },
          { id: 'mirror', tex: say(FLIP[q], p.mirror) },
        ]);
        return {
          prompt: L(
            `Která možnost je negací výroku $${say(q, shown)}$?`,
            `Which option is the negation of $${say(q, shown)}$?`,
          ),
          answer: {
            kind: 'choice',
            fixedOrder: true,
            options: options.map((option) => ({ id: option.id, text: L(`$${option.tex}$`, `$${option.tex}$`) })),
            correct: ['right'],
          },
          hints: [
            L(
              'Negace musí platit přesně tehdy, když původní výrok neplatí.',
              'The negation must hold exactly when the original statement fails.',
            ),
            L(
              '„Neplatí pro každé“ znamená „existuje případ, kdy neplatí“ — a naopak. Mění se kvantifikátor i tvrzení za ním.',
              '“Not for every” means “there is a case where it fails” — and vice versa. Both the quantifier and the claim after it change.',
            ),
          ],
          solution: [
            step(
              'Kvantifikátor se vymění a tvrzení za ním se zneguje:',
              'The quantifier is swapped and the claim after it is negated:',
              `\\neg\\left(${say(q, shown)}\\right) \\;\\Leftrightarrow\\; ${say(FLIP[q], negated)}`,
            ),
          ],
          misconceptions: [
            mc(
              'quantifier',
              'incomplete',
              'Kvantifikátor je vyměněný, ale tvrzení za ním zůstalo. Tenhle výrok může platit zároveň s původním.',
              'The quantifier is swapped, but the claim after it stayed. This statement can hold together with the original.',
            ),
            mc(
              'predicate',
              'incomplete',
              'Tvrzení je znegované, ale kvantifikátor zůstal.',
              'The claim is negated, but the quantifier stayed.',
            ),
            mc(
              'mirror',
              'concept',
              'Negace musí pokrýt všechny zbylé případy: opakem „větší než“ je „menší nebo rovno“, opakem „rovná se“ je „nerovná se“.',
              'A negation must cover all the remaining cases: the opposite of “greater than” is “less than or equal”, the opposite of “equals” is “does not equal”.',
            ),
          ],
        };
      }
      const p = r.pick(doublePredicates(r));
      const say = (first: string, second: string, predicate: string, swapped = false): string =>
        swapped
          ? `${second} y \\in \\mathbb{R}\\ ${first} x \\in \\mathbb{R}:\\ ${predicate}`
          : `${first} x \\in \\mathbb{R}\\ ${second} y \\in \\mathbb{R}:\\ ${predicate}`;
      const options = r.shuffle([
        { id: 'right', tex: say(FLIP[q], q, p.fails) },
        { id: 'first', tex: say(FLIP[q], FLIP[q], p.fails) },
        { id: 'none', tex: say(q, FLIP[q], p.fails) },
        { id: 'order', tex: say(FLIP[q], q, p.fails, true) },
      ]);
      return {
        prompt: L(
          `Která možnost je negací výroku $${say(q, FLIP[q], p.holds)}$?`,
          `Which option is the negation of $${say(q, FLIP[q], p.holds)}$?`,
        ),
        answer: {
          kind: 'choice',
          fixedOrder: true,
          options: options.map((option) => ({ id: option.id, text: L(`$${option.tex}$`, `$${option.tex}$`) })),
          correct: ['right'],
        },
        hints: [
          L(
            'Postupuj zleva: zneguj první kvantifikátor a negaci posuň dál.',
            'Work from the left: negate the first quantifier and push the negation onward.',
          ),
          L(
            'Vymění se oba kvantifikátory, zneguje se tvrzení a pořadí proměnných zůstane.',
            'Both quantifiers are swapped, the claim is negated, and the order of the variables stays.',
          ),
        ],
        solution: [
          step(
            'Oba kvantifikátory se vymění, tvrzení se zneguje, pořadí zůstává:',
            'Both quantifiers are swapped, the claim is negated, the order stays:',
            `\\neg\\left(${say(q, FLIP[q], p.holds)}\\right) \\;\\Leftrightarrow\\; ${say(FLIP[q], q, p.fails)}`,
          ),
        ],
        misconceptions: [
          mc(
            'first',
            'incomplete',
            'Vyměnil se jen první kvantifikátor. Negace prochází přes oba.',
            'Only the first quantifier was swapped. The negation passes through both.',
          ),
          mc(
            'none',
            'incomplete',
            'Tvrzení je znegované, ale kvantifikátory zůstaly.',
            'The claim is negated, but the quantifiers stayed.',
          ),
          mc(
            'order',
            'concept',
            'Pořadí kvantifikátorů nelze prohodit: „pro každé $x$ existuje $y$“ je něco jiného než „existuje $y$ pro všechna $x$“.',
            'The order of quantifiers cannot be swapped: “for every $x$ there is a $y$” differs from “there is a $y$ for all $x$”.',
          ),
        ],
      };
    },
  }),

  gen({
    id: 'reason.quantifiers.truth',
    concept: 'reason.quantifiers',
    kind: 'core',
    levels: [2, 3],
    title: L('Platí pro každé? Existuje?', 'For all? There exists?'),
    est: (lv) => 80 + 30 * (lv - 2),
    make(r, lv) {
      const size = lv === 2 ? 4 : 5;
      const M = r.sample([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12], size).sort((a, b) => a - b);
      const [lo, hi] = [M[0]!, M[size - 1]!];
      const root = r.pick(M);
      const outsider = r.pick([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13].filter((value) => !M.includes(value)));
      // `only` keeps a predicate away from the quantifier that would make the statement trivial.
      const predicates: { tex: L; holds: (x: number) => boolean; only?: 'all' | 'some' }[] = [
        { tex: L(`x > ${lo}`, `x > ${lo}`), holds: (x) => x > lo },
        { tex: L(`x \\ge ${lo}`, `x \\ge ${lo}`), holds: (x) => x >= lo },
        { tex: L(`x < ${hi}`, `x < ${hi}`), holds: (x) => x < hi },
        { tex: L(`x^2 > ${hi}`, `x^2 > ${hi}`), holds: (x) => x * x > hi },
        { tex: L('x \\text{ je sudé}', 'x \\text{ is even}'), holds: (x) => x % 2 === 0 },
        { tex: L('x \\text{ je liché}', 'x \\text{ is odd}'), holds: (x) => x % 2 === 1 },
        { tex: L(`2x = ${2 * root}`, `2x = ${2 * root}`), holds: (x) => x === root },
        { tex: L(`x = ${outsider}`, `x = ${outsider}`), holds: (x) => x === outsider, only: 'some' },
        { tex: L(`x \\ne ${outsider}`, `x \\ne ${outsider}`), holds: (x) => x !== outsider, only: 'all' },
        { tex: L(`x^2 \\le ${hi * hi}`, `x^2 \\le ${hi * hi}`), holds: (x) => x * x <= hi * hi },
        { tex: L('x \\text{ je dělitelné třemi}', 'x \\text{ is divisible by three}'), holds: (x) => x % 3 === 0 },
      ];
      // Four statements, of which one to three are true.
      let chosen: { all: boolean; predicate: (typeof predicates)[number]; truth: boolean }[] = [];
      for (let attempt = 0; attempt < 60; attempt++) {
        chosen = r.sample(predicates, 4).map((predicate) => {
          const all = predicate.only ? predicate.only === 'all' : r.bool();
          return { all, predicate, truth: all ? M.every(predicate.holds) : M.some(predicate.holds) };
        });
        const count = chosen.filter((item) => item.truth).length;
        if (count >= 1 && count <= 3) break;
      }
      const setTex = setL(M);
      const text = (item: (typeof chosen)[number]): L =>
        L(
          `${item.all ? '\\forall' : '\\exists'} x \\in M:\\ ${item.predicate.tex.cs}`,
          `${item.all ? '\\forall' : '\\exists'} x \\in M:\\ ${item.predicate.tex.en}`,
        );
      const reason = (item: (typeof chosen)[number]): L => {
        const witness = M.find(item.predicate.holds);
        const counter = M.find((x) => !item.predicate.holds(x));
        if (item.all)
          return item.truth
            ? L('platí pro všechny prvky', 'holds for every element')
            : L(`neplatí: protipříklad $x = ${counter}$`, `fails: counterexample $x = ${counter}$`);
        return item.truth
          ? L(`platí: například $x = ${witness}$`, `holds: for example $x = ${witness}$`)
          : L('neplatí: žádný prvek nevyhovuje', 'fails: no element qualifies');
      };
      return {
        prompt: L(
          `Je dána množina $M = ${setTex.cs}$. Označte všechny pravdivé výroky.`,
          `Let $M = ${setTex.en}$. Select all the true statements.`,
        ),
        answer: {
          kind: 'choice',
          multi: true,
          fixedOrder: true,
          options: chosen.map((item, index) => ({
            id: `s${index}`,
            text: L(`$${text(item).cs}$`, `$${text(item).en}$`),
          })),
          correct: chosen.flatMap((item, index) => (item.truth ? [`s${index}`] : [])),
        },
        hints: [
          L(
            'Výrok „pro každé“ vyvrátí jediný prvek, pro který neplatí. Výrok „existuje“ potvrdí jediný prvek, pro který platí.',
            'A “for all” statement is refuted by a single element for which it fails. A “there exists” statement is confirmed by a single element for which it holds.',
          ),
          L('Projdi prvky množiny jeden po druhém.', 'Go through the elements of the set one by one.'),
        ],
        solution: chosen.map((item) => ({
          text: L(`$${text(item).cs}$ — ${reason(item).cs}.`, `$${text(item).en}$ — ${reason(item).en}.`),
        })),
      };
    },
  }),

  gen({
    id: 'reason.sets.operations',
    concept: 'reason.sets',
    kind: 'core',
    levels: [1, 2, 3],
    title: L('Operace s množinami', 'Set operations'),
    est: (lv) => 40 + 25 * lv,
    make(r, lv) {
      const U = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      const draw = (): number[] => r.sample(U, r.int(4, 5)).sort((a, b) => a - b);
      // Sets that overlap without one swallowing the other, so every operation has something to show.
      const interesting = (a: number[], b: number[], c: number[]): boolean =>
        a.some((x) => b.includes(x)) &&
        a.some((x) => !b.includes(x)) &&
        b.some((x) => !a.includes(x)) &&
        c.some((x) => a.includes(x) || b.includes(x));
      let [SA, SB, SC] = [draw(), draw(), draw()];
      for (let attempt = 0; attempt < 40 && !interesting(SA, SB, SC); attempt++)
        [SA, SB, SC] = [draw(), draw(), draw()];
      const [inA, inB, inC] = [
        (x: number) => SA.includes(x),
        (x: number) => SB.includes(x),
        (x: number) => SC.includes(x),
      ];
      type Operation = {
        tex: string;
        what: L;
        holds: (x: number) => boolean;
        swapped?: (x: number) => boolean;
        note?: L;
      };
      const pool: Record<1 | 2 | 3, Operation[]> = {
        1: [
          {
            tex: 'A \\cup B',
            what: L(
              'Sjednocení: všechny prvky, které jsou aspoň v jedné z množin (každý jen jednou).',
              'The union: every element that is in at least one of the sets (each listed once).',
            ),
            holds: (x) => inA(x) || inB(x),
            swapped: (x) => inA(x) && inB(x),
            note: L(
              'To je průnik (prvky společné oběma). Sjednocení obsahuje vše, co je aspoň v jedné z množin.',
              'That is the intersection (the elements common to both). The union contains everything that is in at least one of the sets.',
            ),
          },
          {
            tex: 'A \\cap B',
            what: L(
              'Průnik: prvky, které jsou v obou množinách zároveň.',
              'The intersection: the elements that are in both sets at once.',
            ),
            holds: (x) => inA(x) && inB(x),
            swapped: (x) => inA(x) || inB(x),
            note: L(
              'To je sjednocení. Průnik obsahuje jen prvky, které jsou v obou množinách zároveň.',
              'That is the union. The intersection contains only the elements that are in both sets at once.',
            ),
          },
          {
            tex: 'A \\setminus B',
            what: L(
              'Rozdíl: prvky z $A$, které nejsou v $B$.',
              'The difference: the elements of $A$ that are not in $B$.',
            ),
            holds: (x) => inA(x) && !inB(x),
            swapped: (x) => inB(x) && !inA(x),
            note: L(
              'To je $B \\setminus A$. Rozdíl $A \\setminus B$ jsou prvky z $A$, které nejsou v $B$.',
              'That is $B \\setminus A$. The difference $A \\setminus B$ consists of the elements of $A$ that are not in $B$.',
            ),
          },
        ],
        2: [
          {
            tex: 'B \\setminus A',
            what: L(
              'Rozdíl: prvky z $B$, které nejsou v $A$.',
              'The difference: the elements of $B$ that are not in $A$.',
            ),
            holds: (x) => inB(x) && !inA(x),
            swapped: (x) => inA(x) && !inB(x),
            note: L('To je $A \\setminus B$. Na pořadí záleží.', 'That is $A \\setminus B$. The order matters.'),
          },
          {
            tex: "A'",
            what: L(
              'Doplněk: prvky základní množiny $U$, které nejsou v $A$.',
              'The complement: the elements of the universal set $U$ that are not in $A$.',
            ),
            holds: (x) => !inA(x),
            swapped: inA,
            note: L(
              'To je sama množina $A$. Doplněk obsahuje právě ty prvky z $U$, které v $A$ nejsou.',
              'That is the set $A$ itself. The complement contains exactly the elements of $U$ that are not in $A$.',
            ),
          },
          {
            tex: "(A \\cup B)'",
            what: L(
              'Doplněk sjednocení: prvky z $U$, které nejsou ani v $A$, ani v $B$.',
              'The complement of the union: the elements of $U$ that are in neither $A$ nor $B$.',
            ),
            holds: (x) => !(inA(x) || inB(x)),
            swapped: (x) => !(inA(x) && inB(x)),
            note: L(
              "To je $(A \\cap B)'$. Doplněk sjednocení jsou prvky, které nejsou ani v jedné z množin.",
              "That is $(A \\cap B)'$. The complement of the union consists of the elements in neither set.",
            ),
          },
          {
            tex: '(A \\setminus B) \\cup (B \\setminus A)',
            what: L(
              'Prvky, které jsou právě v jedné z množin (symetrický rozdíl).',
              'The elements that are in exactly one of the sets (the symmetric difference).',
            ),
            holds: (x) => inA(x) !== inB(x),
            swapped: (x) => inA(x) || inB(x),
            note: L(
              'Prvky společné oběma množinám sem nepatří.',
              'The elements common to both sets do not belong here.',
            ),
          },
        ],
        3: [
          {
            tex: '(A \\cap B) \\cup C',
            what: L(
              `Nejdřív závorka: $A \\cap B = ${setL(U.filter((x) => inA(x) && inB(x))).cs}$. K ní přidáme všechny prvky $C$.`,
              `The bracket first: $A \\cap B = ${setL(U.filter((x) => inA(x) && inB(x))).en}$. Then add every element of $C$.`,
            ),
            holds: (x) => (inA(x) && inB(x)) || inC(x),
            swapped: (x) => inA(x) && (inB(x) || inC(x)),
            note: L(
              'Nejdřív závorka: průnik $A \\cap B$, a k němu se přidá celé $C$.',
              'The bracket first: the intersection $A \\cap B$, and then all of $C$ is added.',
            ),
          },
          {
            tex: 'A \\setminus (B \\cup C)',
            what: L(
              `Nejdřív závorka: $B \\cup C = ${setL(U.filter((x) => inB(x) || inC(x))).cs}$. Z $A$ odebereme vše, co v ní je.`,
              `The bracket first: $B \\cup C = ${setL(U.filter((x) => inB(x) || inC(x))).en}$. Remove from $A$ everything that is in it.`,
            ),
            holds: (x) => inA(x) && !inB(x) && !inC(x),
            swapped: (x) => (inA(x) && !inB(x)) || inC(x),
            note: L(
              'Nejdřív závorka: z $A$ se odebere vše, co je v $B$ nebo v $C$.',
              'The bracket first: everything in $B$ or in $C$ is removed from $A$.',
            ),
          },
          {
            tex: '(A \\cup B) \\cap C',
            what: L(
              `Nejdřív závorka: $A \\cup B = ${setL(U.filter((x) => inA(x) || inB(x))).cs}$. Z ní necháme jen to, co je také v $C$.`,
              `The bracket first: $A \\cup B = ${setL(U.filter((x) => inA(x) || inB(x))).en}$. Keep only what is also in $C$.`,
            ),
            holds: (x) => (inA(x) || inB(x)) && inC(x),
            swapped: (x) => inA(x) || (inB(x) && inC(x)),
            note: L(
              'Nejdřív závorka: sjednocení $A \\cup B$, a z něj jen to, co je také v $C$.',
              'The bracket first: the union $A \\cup B$, and of that only what is also in $C$.',
            ),
          },
          {
            tex: 'A \\cap (B \\setminus C)',
            what: L(
              `Nejdřív závorka: $B \\setminus C = ${setL(U.filter((x) => inB(x) && !inC(x))).cs}$. Z ní necháme jen to, co je také v $A$.`,
              `The bracket first: $B \\setminus C = ${setL(U.filter((x) => inB(x) && !inC(x))).en}$. Keep only what is also in $A$.`,
            ),
            holds: (x) => inA(x) && inB(x) && !inC(x),
            swapped: (x) => inA(x) && inB(x),
            note: L('Ještě odeber prvky, které jsou v $C$.', 'The elements that are in $C$ still have to be removed.'),
          },
        ],
      };
      const operation = r.pick(pool[lv as 1 | 2 | 3]);
      const result = U.filter(operation.holds);
      const sets =
        lv === 3
          ? ([
              ['A', SA],
              ['B', SB],
              ['C', SC],
            ] as const)
          : ([
              ['A', SA],
              ['B', SB],
            ] as const);
      const given = (locale: 'cs' | 'en'): string =>
        sets.map(([name, values]) => `${name} = ${setL(values)[locale]}`).join(',\\ ');
      const universe =
        lv >= 2 ? L(` v základní množině $U = ${setL(U).cs}$`, ` in the universal set $U = ${setL(U).en}$`) : L('', '');
      return {
        prompt: L(
          `Jsou dány množiny $${given('cs')}$${universe.cs}. Určete $${operation.tex}$.`,
          `Given the sets $${given('en')}$${universe.en}, find $${operation.tex}$.`,
        ),
        answer: { kind: 'set', values: result.map(String), label: `${operation.tex} =` },
        hints: [
          L(
            'Projdi prvky jeden po druhém a u každého rozhodni, jestli do výsledku patří.',
            'Go through the elements one by one and decide for each whether it belongs to the result.',
          ),
          L(
            '$\\cup$ = aspoň v jedné, $\\cap$ = v obou, $\\setminus$ = v první a ne v druhé, čárka = doplněk do $U$.',
            '$\\cup$ = in at least one, $\\cap$ = in both, $\\setminus$ = in the first and not in the second, the prime = complement in $U$.',
          ),
        ],
        solution: [
          { text: operation.what },
          step(
            'Výsledek:',
            'The result:',
            L(`${operation.tex} = ${setL(result).cs}`, `${operation.tex} = ${setL(result).en}`),
          ),
        ],
        misconceptions:
          operation.swapped && operation.note
            ? [mc(`{${U.filter(operation.swapped).join('; ')}}`, 'concept', operation.note.cs, operation.note.en)]
            : [],
      };
    },
  }),

  gen({
    id: 'reason.sets.inclusion-exclusion',
    concept: 'reason.sets',
    kind: 'applied',
    levels: [2, 3],
    title: L('Kolik jich je? Princip inkluze a exkluze', 'How many? Inclusion–exclusion'),
    est: (lv) => 80 + 40 * (lv - 2),
    make(r, lv) {
      if (lv === 2) {
        const [onlyA, onlyB, both, neither] = [r.int(4, 11), r.int(3, 10), r.int(2, 8), r.int(1, 6)];
        const [a, b, total] = [onlyA + both, onlyB + both, onlyA + onlyB + both + neither];
        const askBoth = r.bool(0.4);
        return {
          prompt: askBoth
            ? L(
                `Ve třídě je ${total} studentů. ${a} z nich programuje v Pythonu, ${b} v jazyce C a ${neither} neprogramuje ani v jednom. Kolik studentů programuje v obou jazycích?`,
                `A class has ${total} students. ${a} of them program in Python, ${b} in C, and ${neither} in neither. How many students program in both languages?`,
              )
            : L(
                `Ve třídě je ${total} studentů. ${a} z nich programuje v Pythonu, ${b} v jazyce C a ${both} v obou. Kolik studentů neprogramuje ani v jednom z těchto jazyků?`,
                `A class has ${total} students. ${a} of them program in Python, ${b} in C, and ${both} in both. How many students program in neither of these languages?`,
              ),
          context: { it: true, applied: true },
          answer: { kind: 'number', value: `${askBoth ? both : neither}` },
          hints: [
            L(
              'Nakresli dva překrývající se kruhy (Vennův diagram) a začni od průniku.',
              'Draw two overlapping circles (a Venn diagram) and start from the overlap.',
            ),
            L(
              'Sečteš-li obě skupiny, započítáš ty, kdo umějí obojí, dvakrát: $|A \\cup B| = |A| + |B| - |A \\cap B|$.',
              'Adding the two groups counts those who know both twice: $|A \\cup B| = |A| + |B| - |A \\cap B|$.',
            ),
          ],
          solution: askBoth
            ? [
                step(
                  'Aspoň v jednom jazyce programuje:',
                  'Those programming in at least one language:',
                  `${total} - ${neither} = ${total - neither}`,
                ),
                step(
                  'Součet obou skupin je větší o ty, kdo jsou započítáni dvakrát:',
                  'The sum of the two groups exceeds that by those counted twice:',
                  `${a} + ${b} - ${total - neither} = ${both}`,
                ),
              ]
            : [
                step(
                  'Aspoň v jednom jazyce programuje:',
                  'Those programming in at least one language:',
                  `|A \\cup B| = ${a} + ${b} - ${both} = ${total - neither}`,
                ),
                step('Zbytek třídy:', 'The rest of the class:', `${total} - ${total - neither} = ${neither}`),
              ],
          misconceptions: askBoth
            ? a + b - total > 0
              ? [
                  mc(
                    `${a + b - total}`,
                    'incomplete',
                    'Nezapomeň na ty, kdo neprogramují vůbec: do sjednocení nepatří.',
                    'Do not forget those who do not program at all: they are not in the union.',
                  ),
                ]
              : []
            : [
                mc(
                  `${total - a - b}`,
                  'concept',
                  'Ti, kdo umějí obojí, byli odečteni dvakrát. Jednou je vrať.',
                  'Those who know both were subtracted twice. Add them back once.',
                ),
                mc(
                  `${total - neither}`,
                  'misread',
                  'To je počet těch, kdo programují aspoň v jednom jazyce.',
                  'That is the number of those who program in at least one language.',
                ),
              ],
          verify: [
            { kind: 'value', expr: askBoth ? `${a}+${b}-(${total}-${neither})` : `${total}-(${a}+${b}-${both})` },
          ],
        };
      }
      // Three sets, built from the eight regions of the Venn diagram.
      const [oa, ob, oc] = [r.int(3, 8), r.int(3, 8), r.int(3, 8)];
      const [ab, ac, bc] = [r.int(1, 5), r.int(1, 5), r.int(1, 5)];
      const abc = r.int(1, 4);
      const none = r.int(1, 6);
      const [a, b, c] = [oa + ab + ac + abc, ob + ab + bc + abc, oc + ac + bc + abc];
      const [pab, pac, pbc] = [ab + abc, ac + abc, bc + abc];
      const union = oa + ob + oc + ab + ac + bc + abc;
      const total = union + none;
      return {
        prompt: L(
          `V průzkumu mezi ${total} vývojáři používá ${a} Linux, ${b} Windows a ${c} macOS. Linux i Windows používá ${pab}, Linux i macOS ${pac}, Windows i macOS ${pbc} a všechny tři systémy ${abc}. Kolik vývojářů nepoužívá žádný z těchto systémů?`,
          `In a survey of ${total} developers, ${a} use Linux, ${b} Windows and ${c} macOS. ${pab} use both Linux and Windows, ${pac} both Linux and macOS, ${pbc} both Windows and macOS, and ${abc} use all three. How many developers use none of these systems?`,
        ),
        context: { it: true, applied: true },
        answer: { kind: 'number', value: `${none}` },
        hints: [
          L(
            'Vennův diagram se třemi kruhy: vyplňuj od středu (všechny tři) směrem ven.',
            'A Venn diagram with three circles: fill it in from the centre (all three) outwards.',
          ),
          L(
            'Nebo vzorcem: sečti jednotlivé skupiny, odečti dvojice a přičti zpět trojici.',
            'Or by the formula: add the single groups, subtract the pairs, and add the triple back.',
          ),
        ],
        solution: [
          step(
            'Aspoň jeden systém používá:',
            'Those using at least one system:',
            `${a} + ${b} + ${c} - ${pab} - ${pac} - ${pbc} + ${abc} = ${union}`,
          ),
          step('Zbytek:', 'The rest:', `${total} - ${union} = ${none}`),
        ],
        misconceptions: [
          mc(
            `${total - (a + b + c - pab - pac - pbc)}`,
            'incomplete',
            'Ti, kdo používají všechny tři, byli třikrát přičteni a třikrát odečteni. Je potřeba je jednou přičíst zpět.',
            'Those who use all three were added three times and subtracted three times. They have to be added back once.',
          ),
          mc(
            `${union}`,
            'misread',
            'To je počet těch, kdo používají aspoň jeden systém.',
            'That is the number of those who use at least one system.',
          ),
        ],
        verify: [{ kind: 'value', expr: `${total}-(${a}+${b}+${c}-${pab}-${pac}-${pbc}+${abc})` }],
      };
    },
  }),

  gen({
    id: 'reason.proof.kind',
    concept: 'reason.proof',
    kind: 'core',
    levels: [2, 3],
    title: L('O jaký druh důkazu jde?', 'What kind of proof is it?'),
    est: 75,
    make(r, lv) {
      const proof = r.pick(lv === 2 ? PROOFS.filter((item) => item.kind !== 'induction') : PROOFS);
      const kinds = Object.keys(PROOF_KINDS) as ProofKind[];
      return {
        prompt: L(
          `**Tvrzení.** ${proof.claim.cs}\n\n**Zdůvodnění.** ${proof.argument.cs}\n\nO jaký druh argumentu jde?`,
          `**Claim.** ${proof.claim.en}\n\n**Argument.** ${proof.argument.en}\n\nWhat kind of argument is this?`,
        ),
        answer: {
          kind: 'choice',
          fixedOrder: true,
          options: kinds.map((kind) => ({ id: kind, text: PROOF_KINDS[kind] })),
          correct: [proof.kind],
        },
        hints: [
          L(
            'Podívej se, čím argument začíná: předpokladem tvrzení, opakem závěru, nebo opakem celého tvrzení?',
            'Look at how the argument starts: with the hypothesis, with the opposite of the conclusion, or with the opposite of the whole claim?',
          ),
          L(
            'A čím končí: závěrem, opakem předpokladu, nebo něčím nemožným?',
            'And how it ends: with the conclusion, with the opposite of the hypothesis, or with something impossible?',
          ),
        ],
        solution: [
          { text: proof.why },
          step(
            'Jde tedy o:',
            'So it is:',
            L(`\\text{${PROOF_KINDS[proof.kind].cs}}`, `\\text{${PROOF_KINDS[proof.kind].en}}`),
          ),
        ],
        misconceptions:
          proof.kind === 'contrapositive'
            ? [
                mc(
                  'contradiction',
                  'concept',
                  'Podobné, ale ne stejné: argument nekončí sporem, nýbrž opakem předpokladu. Dokazuje se obměněná implikace.',
                  'Similar but not the same: the argument does not end in a contradiction but in the opposite of the hypothesis. It proves the contrapositive.',
                ),
              ]
            : proof.kind === 'contradiction'
              ? [
                  mc(
                    'contrapositive',
                    'concept',
                    'Tady se nedokazuje jiná implikace: předpokládá se opak celého tvrzení a dojde se ke sporu.',
                    'No other implication is being proved here: the opposite of the whole claim is assumed and a contradiction follows.',
                  ),
                ]
              : [],
      };
    },
  }),

  gen({
    id: 'reason.proof.flaw',
    concept: 'reason.proof',
    kind: 'debug',
    levels: [3],
    title: L('Najdi díru v důkazu', 'Find the hole in the proof'),
    est: 90,
    make(r) {
      const flaw = r.pick(FLAWS);
      return {
        prompt: L(
          `${flaw.task.cs}. Ve kterém řádku je první chybný krok?`,
          `${flaw.task.en}. Which line contains the first faulty step?`,
        ),
        answer: {
          kind: 'spot',
          lines: flaw.lines.map((tex) => ({ tex })),
          wrongLine: flaw.wrong,
          errorType: flaw.error,
        },
        hints: [
          L(
            'Závěr je zjevně špatně, takže někde musí být nedovolený krok. U každého přechodu si řekni, jaká úprava se provedla.',
            'The conclusion is plainly wrong, so some step must be illegal. For each transition, say which operation was performed.',
          ),
          L(
            'Podezřelé jsou dělení, odmocňování a násobení záporným číslem: fungují jen za určitých podmínek.',
            'Division, taking roots and multiplying by a negative number are the usual suspects: they work only under certain conditions.',
          ),
        ],
        solution: [step(flaw.cs, flaw.en)],
      };
    },
  }),

  gen({
    id: 'comp.binary.convert',
    concept: 'comp.binary',
    kind: 'core',
    levels: [1, 2, 3],
    title: L('Převody mezi soustavami', 'Converting between number systems'),
    est: (lv) => 45 + 25 * lv,
    make(r, lv) {
      const hex = (value: number): string => value.toString(16).toUpperCase();
      const bits = (value: number, width = 0): string => value.toString(2).padStart(width, '0');
      if (lv === 3) {
        // The high digit is at least 8, so the binary form has all eight digits and no leading zero to argue about.
        const value = r.int(0x81, 0xfe);
        const digits = hex(value);
        const nibbles = [Math.floor(value / 16), value % 16];
        if (r.bool()) {
          return {
            prompt: L(
              `Převeďte šestnáctkové číslo $\\texttt{${digits}}_{16}$ do dvojkové soustavy (zapište jen číslice).`,
              `Convert the hexadecimal number $\\texttt{${digits}}_{16}$ to binary (write the digits only).`,
            ),
            context: { it: true },
            answer: { kind: 'number', value: bits(value), placeholder: '10100111' },
            hints: [
              L(
                'Každá šestnáctková číslice odpovídá přesně čtyřem bitům.',
                'Each hexadecimal digit corresponds to exactly four bits.',
              ),
              L(
                `Převeď číslice zvlášť: $\\texttt{${digits[0]}} = ${nibbles[0]}$, $\\texttt{${digits[1]}} = ${nibbles[1]}$.`,
                `Convert the digits separately: $\\texttt{${digits[0]}} = ${nibbles[0]}$, $\\texttt{${digits[1]}} = ${nibbles[1]}$.`,
              ),
            ],
            solution: [
              step(
                'Každou číslici zvlášť na čtyři bity:',
                'Each digit separately into four bits:',
                `\\texttt{${digits[0]}} = ${nibbles[0]} = ${bits(nibbles[0]!, 4)}_2,\\quad \\texttt{${digits[1]}} = ${nibbles[1]} = ${bits(nibbles[1]!, 4)}_2`,
              ),
              step(
                'Složíme za sebe:',
                'Put them side by side:',
                `\\texttt{${digits}}_{16} = ${bits(nibbles[0]!, 4)}\\,${bits(nibbles[1]!, 4)}_2`,
              ),
            ],
            misconceptions: [
              mc(
                bits(nibbles[1]!, 4) + bits(nibbles[0]!, 4),
                'misread',
                'Čtveřice bitů jsou v opačném pořadí.',
                'The groups of four bits are in the wrong order.',
              ),
              mc(
                `${bits(nibbles[0]!)}${bits(nibbles[1]!)}`,
                'notation',
                'Každá číslice musí dát přesně čtyři bity — doplň úvodní nuly u druhé čtveřice.',
                'Each digit must give exactly four bits — pad the second group with leading zeros.',
              ),
            ],
            verify: [{ kind: 'value', expr: bits(value) }],
          };
        }
        const wrong = r
          .shuffle(
            [
              hex(nibbles[1]! * 16 + nibbles[0]!).padStart(2, '0'),
              hex((value + 16) % 256).padStart(2, '0'),
              hex(value ^ 0x0f).padStart(2, '0'),
              hex((value + 1) % 256).padStart(2, '0'),
            ].filter((candidate, index, list) => candidate !== digits && list.indexOf(candidate) === index),
          )
          .slice(0, 3);
        const options = r.shuffle([digits, ...wrong]);
        return {
          prompt: L(
            `Které šestnáctkové číslo odpovídá dvojkovému číslu $${bits(nibbles[0]!, 4)}\\,${bits(nibbles[1]!, 4)}_2$?`,
            `Which hexadecimal number corresponds to the binary number $${bits(nibbles[0]!, 4)}\\,${bits(nibbles[1]!, 4)}_2$?`,
          ),
          context: { it: true },
          answer: {
            kind: 'choice',
            fixedOrder: true,
            options: options.map((option) => ({
              id: option,
              text: L(`$\\texttt{${option}}_{16}$`, `$\\texttt{${option}}_{16}$`),
            })),
            correct: [digits],
          },
          hints: [
            L(
              'Rozděl bity zprava po čtyřech. Každá čtveřice je jedna šestnáctková číslice.',
              'Split the bits into groups of four from the right. Each group is one hexadecimal digit.',
            ),
            L('Hodnoty 10 až 15 se píší A až F.', 'The values 10 to 15 are written A to F.'),
          ],
          solution: [
            step(
              'Čtveřice bitů na číslice:',
              'Groups of four bits into digits:',
              `${bits(nibbles[0]!, 4)}_2 = ${nibbles[0]} = \\texttt{${digits[0]}},\\quad ${bits(nibbles[1]!, 4)}_2 = ${nibbles[1]} = \\texttt{${digits[1]}}`,
            ),
          ],
        };
      }
      const variant =
        lv === 1 ? r.pick(['bin-dec', 'dec-bin'] as const) : r.pick(['bin-dec', 'dec-bin', 'hex-dec'] as const);
      if (variant === 'hex-dec') {
        const value = r.int(0x1a, 0xff);
        const digits = hex(value);
        const [high, low] = [Math.floor(value / 16), value % 16];
        return {
          prompt: L(
            `Převeďte šestnáctkové číslo $\\texttt{${digits}}_{16}$ do desítkové soustavy.`,
            `Convert the hexadecimal number $\\texttt{${digits}}_{16}$ to decimal.`,
          ),
          context: { it: true },
          answer: { kind: 'number', value: `${value}` },
          hints: [
            L('Číslice A až F mají hodnoty 10 až 15.', 'The digits A to F have the values 10 to 15.'),
            L('První číslice se násobí 16, druhá 1.', 'The first digit is multiplied by 16, the second by 1.'),
          ],
          solution: [
            step(
              'Rozepíšeme podle řádů:',
              'Expand by place value:',
              `\\texttt{${digits}}_{16} = ${high} \\cdot 16 + ${low} = ${value}`,
            ),
          ],
          misconceptions: [
            mc(
              `${high * 10 + low}`,
              'concept',
              'Řády jsou mocniny šestnácti, ne deseti.',
              'The places are powers of sixteen, not of ten.',
            ),
            mc(`${high + low}`, 'incomplete', 'První číslice má váhu 16.', 'The first digit has weight 16.'),
          ],
          verify: [{ kind: 'value', expr: `${high}*16+${low}` }],
        };
      }
      const value = lv === 1 ? r.int(5, 63) : r.int(64, 255);
      const digits = bits(value);
      const places = digits.split('').map((bit, index) => ({ bit, weight: 2 ** (digits.length - 1 - index) }));
      if (variant === 'bin-dec') {
        const reversed = parseInt(digits.split('').reverse().join(''), 2);
        return {
          prompt: L(
            `Převeďte dvojkové číslo $${digits}_2$ do desítkové soustavy.`,
            `Convert the binary number $${digits}_2$ to decimal.`,
          ),
          context: { it: true },
          answer: { kind: 'number', value: `${value}` },
          hints: [
            L(
              'Každá číslice má váhu mocniny dvou; úplně vpravo je $2^0 = 1$.',
              'Each digit has the weight of a power of two; the rightmost is $2^0 = 1$.',
            ),
            L(
              `Váhy zleva: ${places.map((place) => place.weight).join(', ')}. Sečti ty, u kterých je jednička.`,
              `Weights from the left: ${places.map((place) => place.weight).join(', ')}. Add those marked by a one.`,
            ),
          ],
          solution: [
            step(
              'Sečteme váhy míst, kde je jednička:',
              'Add the weights of the places holding a one:',
              `${places
                .filter((place) => place.bit === '1')
                .map((place) => place.weight)
                .join(' + ')} = ${value}`,
            ),
          ],
          misconceptions: [
            mc(
              `${reversed}`,
              'misread',
              'Váhy rostou zprava doleva: nejnižší řád je vpravo.',
              'The weights grow from right to left: the lowest place is on the right.',
            ),
            mc(
              `${value * 2}`,
              'concept',
              'Poslední číslice má váhu $2^0 = 1$, ne 2.',
              'The last digit has weight $2^0 = 1$, not 2.',
            ),
            mc(
              `${digits.split('').filter((bit) => bit === '1').length}`,
              'concept',
              'To je počet jedniček. Každá ale má jinou váhu.',
              'That is the number of ones. But each has a different weight.',
            ),
          ],
          verify: [{ kind: 'value', expr: places.map((place) => `${place.bit}*${place.weight}`).join('+') }],
        };
      }
      const divisions = (remainder: string): string => {
        const lines: string[] = [];
        for (let rest = value; rest > 0; rest = Math.floor(rest / 2))
          lines.push(`${rest} : 2 = ${Math.floor(rest / 2)}\\ \\text{${remainder} } ${rest % 2}`);
        return lines.join(',\\quad ');
      };
      return {
        prompt: L(
          `Převeďte číslo $${value}$ do dvojkové soustavy (zapište jen číslice).`,
          `Convert the number $${value}$ to binary (write the digits only).`,
        ),
        context: { it: true },
        answer: { kind: 'number', value: digits, placeholder: '101101' },
        hints: [
          L('Děl opakovaně dvěma a zapisuj zbytky.', 'Divide by two repeatedly and note the remainders.'),
          L(
            'Zbytky se čtou odzadu: poslední zbytek je první číslice.',
            'The remainders are read backwards: the last remainder is the first digit.',
          ),
        ],
        solution: [
          step(
            'Postupné dělení dvěma (zb. = zbytek):',
            'Repeated division by two (r. = remainder):',
            L(divisions('zb.'), divisions('r.')),
          ),
          step('Zbytky čteme odzadu:', 'Read the remainders backwards:', `${value} = ${digits}_2`),
        ],
        misconceptions: [
          mc(
            digits.split('').reverse().join(''),
            'misread',
            'Zbytky se čtou odzadu — máš číslice v opačném pořadí.',
            'The remainders are read backwards — your digits are in reverse order.',
          ),
        ],
        verify: [{ kind: 'value', expr: digits }],
      };
    },
  }),

  gen({
    id: 'comp.binary.capacity',
    concept: 'comp.binary',
    kind: 'applied',
    levels: [2, 3],
    title: L('Kolik se vejde do n bitů?', 'How much fits into n bits?'),
    est: (lv) => 50 + 25 * (lv - 2),
    make(r, lv) {
      const n = r.pick(lv === 2 ? [3, 4, 5, 6, 8, 10] : [8, 10, 12, 16]);
      const variant =
        lv === 2 ? r.pick(['count', 'max'] as const) : r.pick(['needed', 'signed-min', 'signed-max'] as const);
      const base = { context: { it: true, applied: true } };
      if (variant === 'count') {
        return {
          ...base,
          prompt: L(
            `Kolik různých hodnot lze zapsat pomocí ${n} bitů?`,
            `How many different values can be written with ${n} bits?`,
          ),
          answer: { kind: 'number', value: `${2 ** n}` },
          hints: [
            L(
              'Každý bit má dvě možnosti, nezávisle na ostatních.',
              'Each bit has two options, independently of the others.',
            ),
            L(
              `Možnosti se násobí: $2 \\cdot 2 \\cdots 2$ (${n}krát).`,
              `The options multiply: $2 \\cdot 2 \\cdots 2$ (${n} times).`,
            ),
          ],
          solution: [
            step(
              'Každý další bit počet možností zdvojnásobí:',
              'Each additional bit doubles the number of options:',
              `2^{${n}} = ${2 ** n}`,
            ),
          ],
          misconceptions: [
            mc(
              `${2 * n}`,
              'concept',
              'Možnosti se násobí, nesčítají: $2^n$, ne $2n$.',
              'The options multiply; they do not add: $2^n$, not $2n$.',
            ),
            mc(
              `${2 ** n - 1}`,
              'concept',
              'To je největší zapsatelné číslo. Hodnot je o jednu víc, protože se počítá i nula.',
              'That is the largest number that can be written. There is one more value, because zero counts too.',
            ),
          ],
          verify: [{ kind: 'value', expr: `2^${n}` }],
        };
      }
      if (variant === 'max') {
        return {
          ...base,
          prompt: L(
            `Jaké největší celé číslo bez znaménka lze uložit do ${n} bitů?`,
            `What is the largest unsigned integer that fits into ${n} bits?`,
          ),
          answer: { kind: 'number', value: `${2 ** n - 1}` },
          hints: [
            L('Největší číslo má všechny bity jedničkové.', 'The largest number has all its bits set to one.'),
            L(`Hodnot je $2^{${n}}$ a začínají nulou.`, `There are $2^{${n}}$ values and they start at zero.`),
          ],
          solution: [
            step(
              `Hodnot je $2^{${n}} = ${2 ** n}$, od nuly:`,
              `There are $2^{${n}} = ${2 ** n}$ values, starting from zero:`,
              `2^{${n}} - 1 = ${2 ** n - 1}`,
            ),
          ],
          misconceptions: [
            mc(
              `${2 ** n}`,
              'concept',
              'To je počet hodnot. Protože první z nich je nula, největší je o jednu menší.',
              'That is the number of values. Since the first of them is zero, the largest is one less.',
            ),
          ],
          verify: [{ kind: 'value', expr: `2^${n}-1` }],
        };
      }
      if (variant === 'needed') {
        const value = r.pick([100, 255, 256, 1000, 1023, 1024, 5000, 60000, 65535, 65536]);
        const needed = value.toString(2).length;
        return {
          ...base,
          prompt: L(
            `Kolik bitů je nejméně potřeba k uložení čísla $${grouped(value)}$ (bez znaménka)?`,
            `What is the least number of bits needed to store the number $${grouped(value)}$ (unsigned)?`,
          ),
          answer: { kind: 'number', value: `${needed}` },
          hints: [
            L('Do $n$ bitů se vejdou čísla od 0 do $2^n - 1$.', '$n$ bits hold the numbers from 0 to $2^n - 1$.'),
            L(
              'Hledej nejmenší mocninu dvou, která je větší než dané číslo.',
              'Look for the smallest power of two that exceeds the given number.',
            ),
          ],
          solution: [
            step(
              'Nejmenší mocnina dvou větší než dané číslo:',
              'The smallest power of two exceeding the number:',
              `2^{${needed - 1}} = ${grouped(2 ** (needed - 1))} \\le ${grouped(value)} < ${grouped(2 ** needed)} = 2^{${needed}}`,
            ),
            step('Stačí tedy:', 'So this many bits are enough:', `${needed}`),
          ],
          misconceptions: [
            mc(
              `${needed - 1}`,
              'concept',
              `Do ${needed - 1} bitů se vejde nejvýše $${grouped(2 ** (needed - 1) - 1)}$.`,
              `${needed - 1} bits hold at most $${grouped(2 ** (needed - 1) - 1)}$.`,
            ),
            mc(`${needed + 1}`, 'arithmetic', 'O jeden bit víc, než je nutné.', 'One bit more than necessary.'),
          ],
        };
      }
      const [lowest, highest] = [-(2 ** (n - 1)), 2 ** (n - 1) - 1];
      const askMin = variant === 'signed-min';
      return {
        ...base,
        prompt: L(
          `Celá čísla se znaménkem se ukládají v doplňkovém kódu. Jaké ${askMin ? 'nejmenší' : 'největší'} číslo lze uložit do ${n} bitů?`,
          `Signed integers are stored in two's complement. What is the ${askMin ? 'smallest' : 'largest'} number that fits into ${n} bits?`,
        ),
        answer: { kind: 'number', value: `${askMin ? lowest : highest}` },
        hints: [
          L(
            `Z $2^{${n}}$ hodnot připadá polovina na záporná čísla a polovina na nulu a kladná čísla.`,
            `Of the $2^{${n}}$ values, half go to the negative numbers and half to zero and the positive numbers.`,
          ),
          L(
            'Nula zabírá jedno místo mezi nezápornými, proto je kladných o jedno méně.',
            'Zero takes one slot among the non-negative ones, so there is one positive number fewer.',
          ),
        ],
        solution: [
          step(
            'Rozsah doplňkového kódu:',
            "The range of two's complement:",
            `-2^{${n - 1}} = -${grouped(-lowest)} \\quad\\text{…}\\quad 2^{${n - 1}} - 1 = ${grouped(highest)}`,
          ),
        ],
        misconceptions: askMin
          ? [
              mc(
                `${-highest}`,
                'concept',
                'Záporných čísel je o jedno víc než kladných, protože nula patří k nezáporným.',
                'There is one more negative number than positive, because zero sits with the non-negative ones.',
              ),
              mc(
                `${-(2 ** n)}`,
                'concept',
                'Jeden bit padne na znaménko: rozsah je $2^{n-1}$, ne $2^n$.',
                'One bit goes to the sign: the range is $2^{n-1}$, not $2^n$.',
              ),
            ]
          : [
              mc(
                `${-lowest}`,
                'concept',
                'Nula zabírá jedno místo, takže největší kladné číslo je o jednu menší.',
                'Zero takes one slot, so the largest positive number is one less.',
              ),
              mc(
                `${2 ** n - 1}`,
                'concept',
                'To platí pro čísla bez znaménka. Se znaménkem je k dispozici jen polovina rozsahu.',
                'That holds for unsigned numbers. With a sign only half the range is available.',
              ),
            ],
        verify: [{ kind: 'value', expr: askMin ? `-(2^${n})/2` : `2^${n}/2-1` }],
      };
    },
  }),

  gen({
    id: 'comp.boolean.simplify',
    concept: 'comp.boolean',
    kind: 'core',
    levels: [2, 3],
    title: L('Zjednodušení logického výrazu', 'Simplifying a logical expression'),
    est: (lv) => 70 + 30 * (lv - 2),
    make(r, lv) {
      const law = r.pick(BOOLEAN_LAWS.filter((item) => item.level === lv));
      // Three wrong answers that really are different functions.
      const wrong = r.shuffle(SIMPLE_FORMS.filter((form) => !equivalent(form, law.simple, ['A', 'B']))).slice(0, 3);
      const options = r.shuffle([law.simple, ...wrong]);
      // Options are named by their place in the list of simple forms.
      const id = (form: Formula): string =>
        `f${SIMPLE_FORMS.findIndex((other) => formulaTex(other) === formulaTex(form))}`;
      return {
        prompt: L(
          `Který výraz je ekvivalentní s výrazem $${formulaTex(law.expr)}$? V kódu: \`${formulaCode(law.expr)}\`.`,
          `Which expression is equivalent to $${formulaTex(law.expr)}$? In code: \`${formulaCode(law.expr)}\`.`,
        ),
        context: { it: true },
        answer: {
          kind: 'choice',
          fixedOrder: true,
          options: options.map((form) => ({ id: id(form), text: L(`$${formulaTex(form)}$`, `$${formulaTex(form)}$`) })),
          correct: [id(law.simple)],
        },
        hints: [
          L(
            'Zkus zákony Booleovy algebry: De Morganovy zákony, distributivní zákon, absorpci.',
            "Try the laws of Boolean algebra: De Morgan's laws, the distributive law, absorption.",
          ),
          L(
            'Nevíš-li jak dál, sestav pravdivostní tabulku — pro dvě proměnné má jen čtyři řádky.',
            'If you are stuck, build the truth table — for two variables it has only four rows.',
          ),
        ],
        solution: [
          { text: L(`${capital(law.name.cs)}: ${law.why.cs}`, `${capital(law.name.en)}: ${law.why.en}`) },
          step(
            'Kontrola pravdivostní tabulkou:',
            'A check by truth table:',
            truthTableTex(
              bin('iff', law.expr, law.simple),
              `${formulaTex(law.expr, true)} \\Leftrightarrow ${formulaTex(law.simple, true)}`,
            ),
          ),
        ],
        misconceptions: wrong.map((form) => {
          const row = assignments(['A', 'B']).find((env) => evaluate(form, env) !== evaluate(law.expr, env))!;
          return mc(
            id(form),
            'concept',
            `Liší se například pro $A = ${row.A ? 1 : 0}$, $B = ${row.B ? 1 : 0}$: původní výraz dává ${evaluate(law.expr, row) ? 1 : 0}, tento ${evaluate(form, row) ? 1 : 0}.`,
            `They differ for instance at $A = ${row.A ? 1 : 0}$, $B = ${row.B ? 1 : 0}$: the original gives ${evaluate(law.expr, row) ? 1 : 0}, this one ${evaluate(form, row) ? 1 : 0}.`,
          );
        }),
      };
    },
  }),

  gen({
    id: 'comp.boolean.circuit',
    concept: 'comp.boolean',
    kind: 'applied',
    levels: [2, 3],
    title: L('Kdy má obvod na výstupu jedničku?', 'When does the circuit output a one?'),
    est: (lv) => 70 + 35 * (lv - 2),
    make(r, lv) {
      const names = lv === 2 ? ['A', 'B'] : ['A', 'B', 'C'];
      const gates: BinaryOp[] = ['and', 'or', 'xor', 'nand', 'nor'];
      let circuit: Formula = bin('nand', A, B);
      for (let attempt = 0; attempt < 40; attempt++) {
        const inner = bin(r.pick(gates), literal(r, 'A', r.bool(0.25)), literal(r, 'B', r.bool(0.25)));
        circuit =
          lv === 2
            ? r.bool(0.5)
              ? not(inner)
              : bin(r.pick(gates), inner, atom(r.pick(names)))
            : bin(r.pick(gates), inner, literal(r, 'C', r.bool(0.3)));
        const count = trueRows(circuit, names);
        if (count > 0 && count < 2 ** names.length && variablesOf(circuit).length === names.length) break;
      }
      const count = trueRows(circuit, names);
      const total = 2 ** names.length;
      return {
        prompt: L(
          `Logický obvod počítá výstup $Y$ ze vstupů ${names.map((name) => `$${name}$`).join(', ')} takto:\n\n\`Y = ${formulaGates(circuit)}\`\n\nPro kolik z ${total} kombinací vstupů je na výstupu jednička?`,
          `A logic circuit computes its output $Y$ from the inputs ${names.map((name) => `$${name}$`).join(', ')} as follows:\n\n\`Y = ${formulaGates(circuit)}\`\n\nFor how many of the ${total} input combinations is the output a one?`,
        ),
        context: { it: true, applied: true },
        answer: { kind: 'number', value: `${count}` },
        hints: [
          L(
            'NAND je negovaný AND, NOR negovaný OR; XOR dává 1, právě když se vstupy liší.',
            'NAND is a negated AND, NOR a negated OR; XOR gives 1 exactly when its inputs differ.',
          ),
          L(
            `Sestav tabulku se všemi ${total} kombinacemi a počítej po hradlech zevnitř ven.`,
            `Build a table with all ${total} combinations and work through the gates from the inside out.`,
          ),
        ],
        solution: [
          step('Pravdivostní tabulka obvodu:', 'The truth table of the circuit:', truthTableTex(circuit, 'Y')),
          step('Počet řádků s jedničkou na výstupu:', 'The number of rows with a one at the output:', `${count}`),
        ],
        misconceptions: [
          mc(
            `${total - count}`,
            'misread',
            'To je počet kombinací, kdy je na výstupu nula.',
            'That is the number of combinations giving a zero at the output.',
          ),
          mc(
            `${trueRows(replaceOp(replaceOp(circuit, 'nand', 'and'), 'nor', 'or'), names)}`,
            'concept',
            'NAND a NOR výsledek negují — nejsou to obyčejné AND a OR.',
            'NAND and NOR negate the result — they are not plain AND and OR.',
          ),
          mc(
            `${trueRows(replaceOp(circuit, 'xor', 'or'), names)}`,
            'concept',
            'XOR není OR: pro dvě jedničky dává nulu.',
            'XOR is not OR: for two ones it gives zero.',
          ),
        ],
      };
    },
  }),

  gen({
    id: 'comp.complexity.compare',
    concept: 'comp.complexity',
    kind: 'core',
    levels: [2, 3],
    title: L('Která funkce roste nejrychleji?', 'Which function grows fastest?'),
    est: 50,
    make(r, lv) {
      const classes = r.sample(GROWTH, 4);
      // Level 2 shows the plain functions; level 3 dresses them in constants that do not matter.
      const options = classes.map((item) => ({ rank: item.rank, tex: lv === 2 ? item.forms[0]! : r.pick(item.forms) }));
      const wantFastest = r.bool(0.7);
      const target = options.reduce((best, option) =>
        (wantFastest ? option.rank > best.rank : option.rank < best.rank) ? option : best,
      );
      const ordered = [...options].sort((a, b) => a.rank - b.rank);
      return {
        prompt: wantFastest
          ? L(
              'Která z funkcí roste pro velká $n$ nejrychleji?',
              'Which of these functions grows fastest for large $n$?',
            )
          : L(
              'Která z funkcí roste pro velká $n$ nejpomaleji?',
              'Which of these functions grows slowest for large $n$?',
            ),
        context: { it: true },
        answer: {
          kind: 'choice',
          fixedOrder: true,
          options: options.map((option) => ({ id: `r${option.rank}`, text: L(`$${option.tex}$`, `$${option.tex}$`) })),
          correct: [`r${target.rank}`],
        },
        hints: [
          L(
            'Konstanty kolem nerozhodují: pro dost velké $n$ vždy vyhraje „typ“ funkce.',
            'The constants around do not decide: for large enough $n$ the “type” of the function always wins.',
          ),
          L(
            'Pořadí od nejpomalejší: $\\log n$, $\\sqrt{n}$, $n$, $n\\log n$, $n^2$, $n^3$, $2^n$.',
            'The order from the slowest: $\\log n$, $\\sqrt{n}$, $n$, $n\\log n$, $n^2$, $n^3$, $2^n$.',
          ),
        ],
        solution: [
          step(
            'Seřazeno od nejpomaleji rostoucí:',
            'Ordered from the slowest growing:',
            ordered.map((option) => option.tex).join(' \\;\\prec\\; '),
          ),
          step(
            'Vyzkoušej $n = 1\\,000\\,000$: $\\log_2 n \\approx 20$, $\\sqrt{n} = 1000$, $n^2 = 10^{12}$ a $2^n$ má přes 300 000 číslic.',
            'Try $n = 1{,}000{,}000$: $\\log_2 n \\approx 20$, $\\sqrt{n} = 1000$, $n^2 = 10^{12}$, and $2^n$ has over 300,000 digits.',
          ),
        ],
        misconceptions: options
          .filter((option) => option !== target)
          .map((option) =>
            mc(
              `r${option.rank}`,
              'concept',
              lv === 3
                ? 'Velká konstanta pomůže jen pro malá $n$. Pro velká $n$ rozhoduje, jak rychle funkce roste.'
                : 'Porovnej, co se s hodnotou stane, když $n$ zdvojnásobíš.',
              lv === 3
                ? 'A large constant helps only for small $n$. For large $n$ what matters is how fast the function grows.'
                : 'Compare what happens to the value when $n$ is doubled.',
            ),
          ),
      };
    },
  }),

  gen({
    id: 'comp.complexity.steps',
    concept: 'comp.complexity',
    kind: 'applied',
    levels: [2, 3],
    title: L('Kolik kroků algoritmus udělá?', 'How many steps does the algorithm take?'),
    est: (lv) => 70 + 30 * (lv - 2),
    make(r, lv) {
      const base = { context: { it: true, applied: true } };
      if (r.bool()) {
        // Halving: binary search.
        const k = r.int(4, 20);
        const n = lv === 2 ? 2 ** k : r.pick([100, 500, 1000, 5000, 10000, 100000, 1000000]);
        const steps = Math.ceil(Math.log2(n));
        // Count the halvings directly rather than trusting the logarithm.
        let counted = 0;
        for (let rest = n; rest > 1; rest = Math.ceil(rest / 2)) counted++;
        if (counted !== steps) throw new Error(`halving ${n}: counted ${counted}, formula ${steps}`);
        return {
          ...base,
          prompt: L(
            `Binární vyhledávání v každém kroku rozpůlí úsek seřazeného pole, ve kterém hledaný prvek může být (lichý počet se zaokrouhlí nahoru). Pole má $${grouped(n)}$ prvků. Po kolika krocích nejpozději zbude jediný prvek?`,
            `Binary search halves, at each step, the part of a sorted array where the item may be (an odd count is rounded up). The array has $${grouped(n)}$ elements. After how many steps at most is a single element left?`,
          ),
          answer: { kind: 'number', value: `${steps}` },
          hints: [
            L(
              'Po jednom kroku zbude polovina, po dvou čtvrtina… Po $k$ krocích zbude $\\frac{n}{2^k}$ prvků.',
              'After one step a half is left, after two a quarter… After $k$ steps $\\frac{n}{2^k}$ elements remain.',
            ),
            L('Hledej nejmenší $k$, pro které je $2^k \\ge n$.', 'Look for the smallest $k$ with $2^k \\ge n$.'),
          ],
          solution: [
            step(
              'Hledáme nejmenší $k$ s $2^k \\ge n$:',
              'Find the smallest $k$ with $2^k \\ge n$:',
              `2^{${steps - 1}} = ${grouped(2 ** (steps - 1))} < ${grouped(n)} \\le ${grouped(2 ** steps)} = 2^{${steps}}`,
            ),
            step(
              `Stačí tedy ${steps} kroků, tj. přibližně $\\log_2 n$. Procházení prvek po prvku by jich potřebovalo až $${grouped(n)}$.`,
              `So ${steps} steps are enough, roughly $\\log_2 n$. Going through the elements one by one could take up to $${grouped(n)}$.`,
            ),
          ],
          misconceptions: [
            mc(
              `${n / 2}`,
              'concept',
              'Půlí se opakovaně, ne jen jednou.',
              'The halving is repeated, not done just once.',
            ),
            mc(
              `${steps - 1}`,
              'arithmetic',
              `Po ${steps - 1} krocích by ještě zbývalo víc než jeden prvek.`,
              `After ${steps - 1} steps more than one element would still be left.`,
            ),
            mc(
              `${n}`,
              'concept',
              'To je počet kroků při procházení po jednom. Půlení je mnohem rychlejší.',
              'That is the number of steps when going one by one. Halving is far faster.',
            ),
          ],
          verify: [{ kind: 'value', expr: `${counted}` }],
        };
      }
      // Scaling: how the running time reacts to a larger input.
      const kind = r.pick(lv === 2 ? (['n', 'n2'] as const) : (['n2', 'n3', '2n'] as const));
      const seconds = r.pick([1, 2, 3, 5]);
      if (kind === '2n') {
        const extra = r.pick([1, 3, 10]);
        return {
          ...base,
          prompt: L(
            `Algoritmus, který zkouší všechny podmnožiny $n$ prvků, udělá $2^n$ kroků. Pro $n = 20$ běží ${seconds} s. Jak dlouho poběží pro $n = ${20 + extra}$? Výsledek uveďte v sekundách.`,
            `An algorithm that tries every subset of $n$ items takes $2^n$ steps. For $n = 20$ it runs for ${seconds} s. How long will it run for $n = ${20 + extra}$? Give the result in seconds.`,
          ),
          answer: { kind: 'number', value: `${seconds * 2 ** extra}`, placeholder: 's' },
          hints: [
            L('Každý prvek navíc počet podmnožin zdvojnásobí.', 'Each additional item doubles the number of subsets.'),
            L(`$2^{${20 + extra}} = 2^{20} \\cdot 2^{${extra}}$`, `$2^{${20 + extra}} = 2^{20} \\cdot 2^{${extra}}$`),
          ],
          solution: [
            step(
              'Poměr počtu kroků:',
              'The ratio of the step counts:',
              `\\frac{2^{${20 + extra}}}{2^{20}} = 2^{${extra}} = ${2 ** extra}`,
            ),
            step(
              'Doba běhu se násobí stejně:',
              'The running time is multiplied by the same factor:',
              `${seconds} \\cdot ${2 ** extra} = ${seconds * 2 ** extra}\\ \\text{s}`,
            ),
            step(
              'Proto exponenciální algoritmy přestávají stačit už pro malé vstupy: každých deset prvků navíc znamená tisíckrát delší běh.',
              'This is why exponential algorithms stop being usable even for small inputs: every ten extra items mean a thousand times the running time.',
            ),
          ],
          misconceptions: [
            mc(
              `${(seconds * (20 + extra)) / 20}`,
              'concept',
              'Čas neroste úměrně $n$: každý další prvek ho zdvojnásobí.',
              'The time does not grow in proportion to $n$: each extra item doubles it.',
            ),
            mc(
              `${seconds * 2 * extra}`,
              'concept',
              `Zdvojnásobení se opakuje, takže se násobí $2^{${extra}}$, ne $2 \\cdot ${extra}$.`,
              `The doubling is repeated, so the factor is $2^{${extra}}$, not $2 \\cdot ${extra}$.`,
            ),
          ],
          verify: [{ kind: 'value', expr: `${seconds}*2^${20 + extra}/2^20` }],
        };
      }
      const power = kind === 'n' ? 1 : kind === 'n2' ? 2 : 3;
      const factor = r.pick(kind === 'n3' ? [2, 3, 10] : [2, 3, 10, 100]);
      const name = power === 1 ? 'n' : `n^${power}`;
      const result = seconds * factor ** power;
      return {
        ...base,
        prompt: L(
          `Algoritmus udělá přibližně $${name}$ kroků a vstup o velikosti $n = 1000$ zpracuje za ${seconds} s. Jak dlouho mu potrvá vstup ${factor}krát větší? Výsledek uveďte v sekundách.`,
          `An algorithm takes about $${name}$ steps and processes an input of size $n = 1000$ in ${seconds} s. How long will an input ${factor} times as large take? Give the result in seconds.`,
        ),
        answer: { kind: 'number', value: `${result}`, placeholder: 's' },
        hints: [
          L(
            `Co se stane s $${name}$, když $n$ nahradíš $${factor}n$?`,
            `What happens to $${name}$ when $n$ is replaced by $${factor}n$?`,
          ),
          power === 1
            ? L('Počet kroků roste stejně jako vstup.', 'The number of steps grows just like the input.')
            : L(
                `$(${factor}n)^${power} = ${factor}^${power} \\cdot n^${power}$`,
                `$(${factor}n)^${power} = ${factor}^${power} \\cdot n^${power}$`,
              ),
        ],
        solution: [
          step(
            'Poměr počtu kroků:',
            'The ratio of the step counts:',
            power === 1
              ? `\\frac{${factor}n}{n} = ${factor}`
              : `\\frac{(${factor}n)^${power}}{n^${power}} = ${factor}^${power} = ${factor ** power}`,
          ),
          step(
            'Doba běhu se násobí stejně:',
            'The running time is multiplied by the same factor:',
            `${seconds} \\cdot ${factor ** power} = ${grouped(result)}\\ \\text{s}`,
          ),
        ],
        misconceptions:
          power === 1
            ? [
                mc(
                  `${seconds * factor * factor}`,
                  'concept',
                  'U lineárního algoritmu roste čas stejně jako vstup.',
                  'For a linear algorithm the time grows just like the input.',
                ),
              ]
            : [
                mc(
                  `${seconds * factor}`,
                  'concept',
                  `Čas neroste úměrně $n$, ale $${name}$: vstup ${factor}krát větší znamená $${factor}^${power}$krát víc kroků.`,
                  `The time grows not with $n$ but with $${name}$: an input ${factor} times as large means $${factor}^${power}$ times the steps.`,
                ),
                mc(
                  `${seconds * factor * power}`,
                  'formula',
                  `Exponent se nenásobí: $(${factor}n)^${power} = ${factor}^${power} \\cdot n^${power}$.`,
                  `The exponent is not a multiplier: $(${factor}n)^${power} = ${factor}^${power} \\cdot n^${power}$.`,
                ),
              ],
        verify: [{ kind: 'value', expr: `${seconds}*(${factor}*1000)^${power}/1000^${power}` }],
      };
    },
  }),
];
