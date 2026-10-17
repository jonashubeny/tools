import { L, type L as Text } from '@lemma/core';

/**
 * The official specification of requirements for the unified entrance examination in
 * mathematics, item by item.
 *
 * SOURCE AND STATUS — read before editing:
 *   "Specifikace požadavků pro jednotnou přijímací zkoušku v přijímacím řízení na střední
 *   školy v oborech vzdělání s maturitní zkouškou pro školní rok 2022/2023 — Matematika",
 *   Centrum pro zjišťování výsledků vzdělávání. Read on 9 October 2026, when the site said
 *   it applied unchanged in 2025/2026 and had published nothing yet for 2026/2027.
 *   The items below are a paraphrase, one per bullet of the document, in its order; the
 *   wording that counts is the document's. Do not add items the document does not have.
 *
 * The three parts are cumulative: part B asks for everything in part A as well, part C for
 * everything in A and B.
 */

export const JPZ_SPEC_SOURCE = {
  title: 'Specifikace požadavků k jednotné přijímací zkoušce 2022/2023 – Matematika (CZVV)',
  url: 'https://prijimacky.cermat.cz/files/files/dokumenty/specifikace-pozadavku/Specifikace_2022-2023/MASPECIFIKACEPOZADAVKU2022.pdf',
  page: 'https://prijimacky.cermat.cz/menu/specifikace-pozadavku-k-jpz.html',
  retrievedOn: '2026-10-09',
} as const;

/** A: eight-year grammar schools (grade 5) · B: six-year (grade 7) · C: four-year fields (grade 9). */
export type SpecPart = 'A' | 'B' | 'C';

export const SPEC_STAGE: Readonly<Record<SpecPart, 5 | 7 | 9>> = { A: 5, B: 7, C: 9 };

export const SPEC_AREAS: Readonly<Record<1 | 2 | 3 | 4, Text>> = {
  1: L('Číslo, početní operace a proměnná', 'Number, operations and variable'),
  2: L('Závislosti, vztahy a práce s daty', 'Dependencies, relations and data'),
  3: L('Geometrie v rovině a v prostoru', 'Geometry in the plane and in space'),
  4: L('Nestandardní aplikační úlohy a problémy', 'Non-standard application problems'),
};

export interface SpecItem {
  /** Part, area and position of the bullet in the document: 'C1.1.4'. */
  id: string;
  part: SpecPart;
  area: 1 | 2 | 3 | 4;
  /** Page of the document. */
  page: number;
  summary: Text;
}

const item = (id: string, page: number, cs: string, en: string): SpecItem => ({
  id,
  part: id[0] as SpecPart,
  area: Number(id.split('.')[1]) as 1 | 2 | 3 | 4,
  page,
  summary: L(cs, en),
});

export const JPZ_SPEC: readonly SpecItem[] = [
  // ------------------------------------------------------------ part A: eight-year (grade 5)
  item(
    'A1.1.1',
    4,
    'Přirozená čísla do milionu a nula, desítková soustava, rozvinutý zápis',
    'Natural numbers to a million and zero, place value, expanded notation',
  ),
  item(
    'A1.1.2',
    4,
    'Číselná osa, porovnávání, „o kolik“ a „kolikrát“',
    'Number line, comparing, "by how much" and "how many times"',
  ),
  item(
    'A1.1.3',
    4,
    'Zaokrouhlování; sčítání, odčítání, násobení, dělení, pořadí operací a závorky',
    'Rounding; the four operations, order of operations and brackets',
  ),
  item(
    'A1.1.4',
    4,
    'Názvy členů operací, dělení se zbytkem, sudá a lichá čísla',
    'Terms of the operations, division with remainder, even and odd numbers',
  ),
  item(
    'A1.1.5',
    4,
    'Písemné algoritmy; násobení a dělení 10, 100, 1 000 zpaměti',
    'Written algorithms; mental multiplication and division by 10, 100, 1 000',
  ),
  item(
    'A1.1.6',
    4,
    'Část celku, jednoduché zlomky, sčítání a odčítání zlomků se stejným jmenovatelem',
    'Part of a whole, simple fractions, adding and subtracting fractions with a common denominator',
  ),
  item(
    'A1.1.7',
    4,
    'Čtení desetinných čísel, číselná osa, znak minus u celého záporného čísla',
    'Reading decimals, the number line, the minus sign of a negative integer',
  ),
  item(
    'A1.1.8',
    4,
    'Slovní úlohy na čtyři operace, odhad, kontrola a reálnost výsledku',
    'Word problems on the four operations, estimating, checking, plausibility',
  ),
  item('A1.2.1', 5, 'Čas, hmotnost a další jednotky, převody jednotek', 'Time, mass and other units, conversions'),
  item(
    'A1.2.2',
    5,
    'Data z textu, tabulek a diagramů (sloupcový, kruhový, bez procent)',
    'Data from text, tables and diagrams (bar, pie, without percent)',
  ),
  item('A1.3.1', 5, 'Základní rovinné útvary a jejich pojmenování', 'Basic plane figures and their names'),
  item(
    'A1.3.2',
    5,
    'Zásady rýsování: pravítko, trojúhelník s ryskou, kružítko',
    'Drawing principles: ruler, set square, compasses',
  ),
  item(
    'A1.3.3',
    5,
    'Rýsování přímek, rovnoběžek, kolmic, kružnice, čtverce, obdélníku, trojúhelníku',
    'Drawing lines, parallels, perpendiculars, a circle, square, rectangle, triangle',
  ),
  item('A1.3.4', 5, 'Osově souměrné útvary ve čtvercové síti', 'Axially symmetric figures on a square grid'),
  item(
    'A1.3.5',
    5,
    'Délka úsečky, jednotky délky, obvod mnohoúhelníku',
    'Length of a segment, units of length, perimeter of a polygon',
  ),
  item('A1.3.6', 5, 'Obsah ve čtvercové síti, jednotky obsahu', 'Area on a square grid, units of area'),
  item(
    'A1.3.7',
    5,
    'Základní tělesa, pohledy shora, zepředu a ze strany',
    'Basic solids, views from above, the front and the side',
  ),
  item(
    'A1.4.1',
    5,
    'Úsudek ve slovních úlohách, jednoduché zákonitosti, schémata',
    'Reasoning in word problems, simple regularities, diagrams',
  ),

  // -------------------------------------------------------------- part B: six-year (grade 7)
  item(
    'B1.1.1',
    7,
    'Dělitelnost: násobek, dělitel, nejmenší společný násobek, největší společný dělitel, prvočísla, znaky dělitelnosti, rozklad na prvočinitele',
    'Divisibility: multiples, divisors, lcm, gcd, primes, divisibility rules, prime factorisation',
  ),
  item(
    'B1.1.2',
    7,
    'Druhá mocnina přirozeného čísla a druhá odmocnina čísel 1 až 100',
    'Squares of natural numbers and square roots of 1 to 100',
  ),
  item(
    'B1.1.3',
    7,
    'Celá čísla: číselná osa, opačné číslo, absolutní hodnota, početní operace',
    'Integers: number line, opposite, absolute value, operations',
  ),
  item(
    'B1.1.4',
    7,
    'Racionální čísla: zlomek a desetinné číslo včetně periodického, převody, číselná osa',
    'Rational numbers: fractions and decimals including repeating ones, conversions, number line',
  ),
  item(
    'B1.1.5',
    7,
    'Operace s desetinnými čísly, zaokrouhlování, odhady',
    'Operations with decimals, rounding, estimates',
  ),
  item(
    'B1.1.6',
    7,
    'Operace se zlomky: rozšiřování, krácení, základní tvar, společný jmenovatel, smíšená čísla, složený zlomek',
    'Operations with fractions: expanding, reducing, lowest terms, common denominator, mixed numbers, compound fractions',
  ),
  item('B1.1.7', 7, 'Hodnota číselného výrazu', 'The value of a numerical expression'),
  item(
    'B1.1.8',
    7,
    'Procenta: základ, počet procent, procentová část, promile; jednoduchý úrok',
    'Percent: base, rate, part, per mille; simple interest',
  ),
  item(
    'B1.1.9',
    7,
    'Poměr: dělení celku v poměru, změna v poměru, postupný a převrácený poměr; slovní úlohy s celými a racionálními čísly',
    'Ratio: dividing in a ratio, changing in a ratio, continued and inverse ratios; word problems with integers and rationals',
  ),
  item(
    'B1.2.1',
    8,
    'Tabulky, sloupcové a kruhové diagramy, porovnání souborů dat',
    'Tables, bar and pie diagrams, comparing sets of data',
  ),
  item(
    'B1.2.2',
    8,
    'Poměr jako vztah celek–část, úměra, měřítko mapy a plánu',
    'Ratio as part–whole, proportion, the scale of a map or plan',
  ),
  item(
    'B1.2.3',
    8,
    'Přímá a nepřímá úměrnost v textu, tabulce a grafu; trojčlenka',
    'Direct and inverse proportion in text, table and graph; the rule of three',
  ),
  item('B1.2.4', 8, 'Aritmetický průměr', 'The arithmetic mean'),
  item('B1.2.5', 8, 'Bod v pravoúhlé soustavě souřadnic', 'A point in a rectangular coordinate system'),
  item('B1.3.1', 8, 'Matematická symbolika v geometrii', 'The symbols of geometry'),
  item(
    'B1.3.2',
    8,
    'Bod, přímka, polopřímka, úsečka; vzájemná poloha, vzdálenost bodu od přímky',
    'Point, line, ray, segment; mutual position, distance of a point from a line',
  ),
  item('B1.3.3', 8, 'Zásady rýsování včetně úhloměru', 'Drawing principles including the protractor'),
  item(
    'B1.3.4',
    8,
    'Úhel: druhy, měření, jednotky, sčítání a odčítání, násobení a dělení dvěma',
    'Angles: kinds, measuring, units, adding and subtracting, doubling and halving',
  ),
  item(
    'B1.3.5',
    8,
    'Dvojice úhlů: vrcholové, vedlejší, střídavé, souhlasné',
    'Pairs of angles: vertical, adjacent, alternate, corresponding',
  ),
  item(
    'B1.3.6',
    8,
    'Trojúhelník: třídění, trojúhelníková nerovnost, úhly, výška a těžnice',
    'Triangles: classification, the triangle inequality, angles, altitude and median',
  ),
  item(
    'B1.3.7',
    8,
    'Čtyřúhelníky, rovnoběžníky, lichoběžníky, pravidelné mnohoúhelníky',
    'Quadrilaterals, parallelograms, trapezoids, regular polygons',
  ),
  item(
    'B1.3.8',
    9,
    'Konstrukce: osa úsečky a úhlu, výšky a těžnice, přenesení úhlu, úhly 60°, 90°, 45°, pravidelný šestiúhelník a osmiúhelník',
    'Constructions: bisectors of a segment and an angle, altitudes and medians, copying an angle, 60°, 90°, 45°, regular hexagon and octagon',
  ),
  item(
    'B1.3.9',
    9,
    'Konstrukční úlohy: rozbor náčrtem, trojúhelník podle sss, sus, usu, čtyřúhelník',
    'Construction problems: analysis by a sketch, a triangle from SSS, SAS, ASA, a quadrilateral',
  ),
  item('B1.3.10', 9, 'Shodnost trojúhelníků', 'Congruence of triangles'),
  item(
    'B1.3.11',
    9,
    'Osová souměrnost: vzor a obraz, osa souměrnosti, konstrukce obrazu',
    'Axial symmetry: pre-image and image, the axis, constructing the image',
  ),
  item('B1.3.12', 9, 'Středová souměrnost', 'Central symmetry'),
  item(
    'B1.3.13',
    9,
    'Jednotky délky a obsahu; obvod a obsah čtverce, obdélníku, trojúhelníku, rovnoběžníku, lichoběžníku a složených útvarů',
    'Units of length and area; perimeter and area of the square, rectangle, triangle, parallelogram, trapezoid and composite figures',
  ),
  item(
    'B1.3.14',
    9,
    'Krychle, kvádr a kolmý hranol: vlastnosti a pojmy',
    'Cube, cuboid and right prism: properties and terms',
  ),
  item(
    'B1.3.15',
    9,
    'Sítě krychle, kvádru a hranolu, volné rovnoběžné promítání, pohledy',
    'Nets of the cube, cuboid and prism, oblique projection, views',
  ),
  item(
    'B1.3.16',
    9,
    'Jednotky objemu; objem a povrch krychle, kvádru a hranolu',
    'Units of volume; volume and surface of the cube, cuboid and prism',
  ),
  item(
    'B1.3.17',
    9,
    'Aplikační geometrické úlohy na obvod, obsah, povrch a objem',
    'Applied geometry problems on perimeter, area, surface and volume',
  ),
  item(
    'B1.4.1',
    9,
    'Úsudek, matematizace situací, prezentace řešení',
    'Reasoning, turning situations into mathematics, presenting the solution',
  ),
  item('B1.4.2', 9, 'Grafická interpretace a schémata', 'Graphical interpretation and diagrams'),
  item(
    'B1.4.3',
    9,
    'Jednoduché zákonitosti: číselné a obrázkové řady, početní tabulky',
    'Simple regularities: series of numbers and pictures, number tables',
  ),

  // ------------------------------------------------------- part C: four-year fields (grade 9)
  item(
    'C1.1.1',
    11,
    'Mocniny a odmocniny: zpaměti i písemně, pravidla pro zlomek a součin, číselné výrazy',
    'Powers and roots: mental and written, rules for a fraction and a product, numerical expressions',
  ),
  item(
    'C1.1.2',
    11,
    'Aplikační úlohy na procenta včetně finanční matematiky (úrok, daň, inflace)',
    'Applied percent including financial mathematics (interest, tax, inflation)',
  ),
  item(
    'C1.1.3',
    11,
    'Proměnná a výraz, hodnota výrazu, operace s mnohočleny, vytýkání, vzorce (a±b)² a a²−b²',
    'Variable and expression, the value of an expression, operations with polynomials, factoring out, the identities (a±b)² and a²−b²',
  ),
  item(
    'C1.1.4',
    11,
    'Lineární rovnice: ekvivalentní úpravy, zkouška, počet řešení, sestavení rovnice',
    'Linear equations: equivalent steps, the check, the number of solutions, setting up an equation',
  ),
  item('C1.1.5', 11, 'Soustava dvou rovnic se dvěma neznámými', 'Systems of two equations in two unknowns'),
  item('C1.1.6', 11, 'Matematizace reálných situací rovnicemi', 'Modelling real situations with equations'),
  item(
    'C1.2.1',
    11,
    'Statistika: četnost, aritmetický průměr, tabulky a diagramy',
    'Statistics: frequency, the arithmetic mean, tables and diagrams',
  ),
  item(
    'C1.2.2',
    11,
    'Přímá a nepřímá úměrnost tabulkou, rovnicí a grafem',
    'Direct and inverse proportion as a table, an equation and a graph',
  ),
  item(
    'C1.3.1',
    12,
    'Rozbor situace náčrtkem, symbolika, reálnost výsledku',
    'Analysing a situation by a sketch, symbols, plausibility of the result',
  ),
  item('C1.3.2', 12, 'Pythagorova věta v rovině a v tělesech', 'The Pythagorean theorem in the plane and in solids'),
  item(
    'C1.3.3',
    12,
    'Kružnice a kruh; vzájemná poloha kružnice a přímky a dvou kružnic',
    'Circle and disc; a line and a circle, two circles',
  ),
  item('C1.3.4', 12, 'Číslo π, obvod a obsah kruhu', 'The number π, circumference and area of a circle'),
  item(
    'C1.3.5',
    12,
    'Konstrukce: osa úhlu a úsečky, tečna kružnice, kružnice opsaná, Thaletova kružnice',
    'Constructions: bisectors, a tangent to a circle, the circumscribed circle, the Thales circle',
  ),
  item('C1.3.6', 12, 'Zásady rýsování', 'Drawing principles'),
  item(
    'C1.3.7',
    12,
    'Konstrukce rovinných útvarů ze zadaných prvků, všechna řešení',
    'Constructing plane figures from given elements, all solutions',
  ),
  item(
    'C1.3.8',
    12,
    'Shodné a podobné trojúhelníky, poměr podobnosti',
    'Congruent and similar triangles, the ratio of similarity',
  ),
  item('C1.3.9', 12, 'Jehlan: promítání, pohledy, síť, vlastnosti', 'The pyramid: projection, views, net, properties'),
  item('C1.3.10', 12, 'Rotační válec: síť, objem a povrch', 'The cylinder: net, volume and surface'),
  item('C1.3.11', 12, 'Aplikační úlohy s válcem a koulí', 'Applied problems with the cylinder and the sphere'),
  item('C1.3.12', 12, 'Měřítko mapy a plánu ve slovních úlohách', 'The scale of a map or plan in word problems'),
  item('C1.4.1', 12, 'Řešení úsudkem a jeho zdůvodnění', 'Solving by reasoning and justifying it'),
  item(
    'C1.4.2',
    12,
    'Standardní algoritmy (rovnice) v praktických problémech',
    'Standard algorithms (equations) in practical problems',
  ),
  item(
    'C1.4.3',
    12,
    'Jednoduché strategické a kombinatorické úlohy bez vzorců',
    'Simple strategic and combinatorial problems without formulas',
  ),
  item(
    'C1.4.4',
    12,
    'Netradiční geometrické úlohy, prostorová představivost',
    'Non-traditional geometry problems, spatial imagination',
  ),
  item('C1.4.5', 12, 'Komplexní poznatky z různých oblastí', 'Combined knowledge from several areas'),
];

const specById = new Map(JPZ_SPEC.map((entry) => [entry.id, entry]));
export const getSpecItem = (id: string): SpecItem | undefined => specById.get(id);
