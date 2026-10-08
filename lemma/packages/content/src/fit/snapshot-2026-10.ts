import { L, type FitSnapshot } from '@lemma/core';

/**
 * Official FIT VUT information as read on 2026-10-07.
 *
 * RULES FOR THIS FILE
 *  - It is a dated snapshot. Never edit facts in place: when the faculty publishes new
 *    rules, add a new snapshot file and register it in ./index.ts.
 *  - Every fact carries the id of the source it was read from.
 *  - `relevance` and `note` on admission routes, and `prepNote` on courses, are Lemma's
 *    own commentary and are shown as such — they are not statements by the faculty.
 *  - The learner starts in 2029/2030. These admission rules are for 2027/2028 and the
 *    study plan is for 2026/2027; both are expected to change. See docs/research.md §2.
 */

const SRC = {
  programme: 'https://www.fit.vut.cz/study/program/9865/.cs',
  applicants: 'https://www.fit.vut.cz/applicants/application/.cs',
  directive: 'https://www.fit.vut.cz/fit/info/smernice/2026/sm2026-2.pdf',
  prepCourse: 'https://www.fit.vut.cz/applicants/pripravny-kurz-matematika/.cs',
  scioMat: 'https://www.scio.cz/matematika',
  scioOsp: 'https://www.scio.cz/obecne-studijni-predpoklady',
};

const course = (id: number): string => `https://www.fit.vut.cz/study/course/${id}/.cs`;

export const SNAPSHOT_2026_10: FitSnapshot = {
  admissionFor: '2027/2028',
  studyPlanFor: '2026/2027',
  retrievedOn: '2026-10-07',
  reviewAfter: '2027-10-01',
  sources: [
    { title: 'FIT VUT — detail programu Informační technologie (BIT)', url: SRC.programme },
    { title: 'FIT VUT — Studujte na FIT: přihláška a termíny', url: SRC.applicants },
    { title: 'Směrnice č. 2/2026: Pravidla přijímacího řízení pro ak. rok 2027/2028', url: SRC.directive },
    { title: 'FIT Start: Matematika bez obav (přípravný kurz)', url: SRC.prepCourse },
    { title: 'FIT VUT — karta předmětu Matematický seminář (ISM), 2026/2027', url: course(302562) },
    { title: 'Scio — NSZ Matematika', url: SRC.scioMat },
    { title: 'Scio — NSZ Obecné studijní předpoklady', url: SRC.scioOsp },
  ],

  programme: {
    facts: [
      {
        text: L(
          'Bakalářský program Informační technologie (BIT): 3 roky, prezenční forma, výuka v češtině, titul Bc.',
          'Bachelor’s programme Information Technology (BIT): 3 years, full-time, taught in Czech, degree Bc.',
        ),
        source: SRC.programme,
      },
      {
        text: L(
          'Akreditace programu platí od 25. 6. 2019 do 25. 6. 2029.',
          'The programme’s accreditation runs from 25 June 2019 to 25 June 2029.',
        ),
        source: SRC.programme,
      },
      {
        text: L(
          'K absolvování je třeba 180 kreditů (z toho 146 za povinné předměty), bakalářská práce a státní závěrečná zkouška.',
          'Graduation requires 180 credits (146 from compulsory courses), a bachelor’s thesis and the state final examination.',
        ),
        source: SRC.programme,
      },
      {
        text: L(
          'Student musí v prvním semestru získat alespoň 15 kreditů a v každém roce alespoň 30 kreditů, jinak je mu studium ukončeno.',
          'A student must earn at least 15 credits in the first semester and at least 30 credits each year, otherwise the studies are terminated.',
        ),
        source: SRC.programme,
      },
      {
        text: L(
          'K přijetí není nutná konkrétní střední škola; program nejvíce navazuje na střední průmyslové a odborné školy se zaměřením na IT.',
          'No particular secondary school is required; the programme follows most closely from secondary technical schools focused on IT.',
        ),
        source: SRC.programme,
      },
    ],
  },

  admission: {
    facts: [
      {
        text: L(
          'Základní podmínkou je středoškolské vzdělání s maturitní zkouškou.',
          'The basic condition is secondary education completed with the maturita exam.',
        ),
        source: SRC.directive,
      },
      {
        text: L(
          'Fakulta nekoná vlastní přijímací zkoušky. Pořadí uchazečů určuje nejlepší celkový percentil z Národních srovnávacích zkoušek Scio: OSP, MAT nebo VŠP.',
          'The faculty holds no entrance exam of its own. Applicants are ranked by their best overall percentile in the Scio National Comparative Exams: OSP, MAT or VŠP.',
        ),
        source: SRC.directive,
      },
      {
        text: L(
          'Očekávaná počáteční hranice pro přijetí je percentil 75. Jednou stanovená hranice se nezvyšuje, může být snížena.',
          'The expected initial admission threshold is percentile 75. Once set it is not raised; it may be lowered.',
        ),
        source: SRC.directive,
      },
      {
        text: L('Přijato může být nejvýše 800 uchazečů.', 'At most 800 applicants can be admitted.'),
        source: SRC.directive,
      },
      {
        text: L(
          'Přihlášky pro první kolo: 1. 11. 2026 – 31. 3. 2027. Při včasném podání a zaplacení umožní FIT jeden test NSZ zdarma (24. 4. 2027).',
          'Applications for the first round: 1 Nov 2026 – 31 Mar 2027. Applying and paying on time gives one NSZ sitting free of charge (24 Apr 2027).',
        ),
        source: SRC.applicants,
      },
      {
        text: L(
          'V předchozím roce se hlásilo 1 621 uchazečů; úspěšnost přijetí byla 84 %.',
          'The previous year saw 1,621 applicants; 84 % were admitted.',
        ),
        source: SRC.applicants,
      },
      {
        text: L(
          'Test MAT: 90 minut, 35 úloh, čtyři možnosti, bez kalkulačky; rozsah matematiky pro gymnázia.',
          'The MAT test: 90 minutes, 35 questions, four options, no calculator; scope of gymnázium mathematics.',
        ),
        source: SRC.scioMat,
      },
      {
        text: L(
          'Test OSP: verbální oddíl 35 minut / 33 úloh, analytický oddíl 50 minut / 33 úloh. Netestuje středoškolské znalosti.',
          'The OSP test: verbal section 35 minutes / 33 questions, analytical section 50 minutes / 33 questions. It does not test secondary-school knowledge.',
        ),
        source: SRC.scioOsp,
      },
    ],
    routes: [
      {
        id: 'nsz',
        title: L('Národní srovnávací zkoušky Scio', 'Scio National Comparative Exams'),
        detail: L(
          'Nejlepší percentil z testů OSP, MAT nebo VŠP ze všech termínů daného akademického roku; očekávaná hranice percentil 75.',
          'Best percentile from OSP, MAT or VŠP across all sittings of the academic year; expected threshold percentile 75.',
        ),
        relevance: 'primary',
        note: L(
          'Výchozí cesta pro každého, kdo nesplní žádnou podmínku přednostního přijetí. Test MAT pokrývá látku celé střední školy včetně kombinatoriky a analytické geometrie, které tě teprve čekají.',
          'The default route for anyone who meets no preferential condition. The MAT test covers the whole of secondary mathematics, including combinatorics and analytic geometry that are still ahead of you.',
        ),
      },
      {
        id: 'maturita',
        letter: 't',
        title: L(
          'Maturita z matematiky s percentilem 80 a více',
          'Maturita in mathematics with percentile 80 or higher',
        ),
        detail: L(
          'Uchazeč u maturitní zkoušky z matematiky dosáhl percentil 80 nebo více. Doklad lze použít bez časového omezení.',
          'The applicant achieved percentile 80 or higher in the maturita mathematics exam. The result has no expiry.',
        ),
        relevance: 'primary',
        note: L(
          'Nejpřirozenější cíl: stejná příprava slouží škole, maturitě i přijetí. Vyžaduje zvolit si u maturity matematiku.',
          'The most natural target: the same preparation serves school, the maturita and admission. It requires choosing mathematics for the maturita.',
        ),
      },
      {
        id: 'prep-course',
        letter: 'w',
        title: L('Přípravný kurz matematiky na FIT', 'FIT’s preparatory mathematics course'),
        detail: L(
          'Úspěšné absolvování přípravného kurzu matematiky pro maturanty na FIT VUT. Běh 2026: 17. 9. – 10. 12., čtvrtky 16:00–17:50, 40 míst, 1 990 Kč. Lze uznat jako předmět ISM (2 kredity). Doklad nesmí být starší než 4 roky.',
          'Successful completion of FIT’s preparatory mathematics course for final-year students. The 2026 run: 17 Sep – 10 Dec, Thursdays 16:00–17:50, 40 places, 1,990 CZK. Can be recognised as the course ISM (2 credits). The certificate must not be older than 4 years.',
        ),
        relevance: 'possible',
        note: L(
          'Je určen maturantům a koná se prezenčně v Brně. Jeho obsah — výrazy, rovnice, funkce, goniometrie, komplexní čísla, analytická geometrie — je ale užitečný jako seznam toho, co FIT pokládá za základ.',
          'It is aimed at final-year students and held in person in Brno. Its content — expressions, equations, functions, goniometry, complex numbers, analytic geometry — is useful in any case as a list of what FIT regards as the foundation.',
        ),
      },
      {
        id: 'math-olympiad',
        letter: 'b',
        title: L('Matematická olympiáda — krajské kolo', 'Mathematical Olympiad — regional round'),
        detail: L(
          'Úspěšný řešitel krajského kola Matematické olympiády v kategorii A, B, C nebo P. Doklad nesmí být starší než 4 roky.',
          'Successful solver of the regional round of the Mathematical Olympiad in category A, B, C or P. Not older than 4 years.',
        ),
        relevance: 'possible',
        note: L(
          'Kategorie P je programátorská — algoritmické úlohy. Pro někoho, kdo programuje, může být dostupnější než klasické kategorie.',
          'Category P is the programming one — algorithmic problems. For someone who codes it may be more reachable than the classical categories.',
        ),
      },
      {
        id: 'klokan',
        letter: 'k',
        title: L('Matematický klokan, kategorie Student', 'Mathematical Kangaroo, category Student'),
        detail: L(
          'Úspěšný řešitel celostátního kola, nebo percentil 80 a více v rámci státu. Doklad nesmí být starší než 4 roky.',
          'Successful solver of the national round, or percentile 80 or higher within the country. Not older than 4 years.',
        ),
        relevance: 'possible',
      },
      {
        id: 'bobrik',
        letter: 'l',
        title: L('Bobřík informatiky, kategorie Senior', 'Bebras (Bobřík informatiky), category Senior'),
        detail: L(
          'Umístění na 1. až 20. místě. Doklad nesmí být starší než 4 roky.',
          'Placing 1st to 20th. Not older than 4 years.',
        ),
        relevance: 'possible',
      },
      {
        id: 'soc',
        letter: 'e, j',
        title: L('Středoškolská odborná činnost (SOČ)', 'Secondary-school research activity (SOČ)'),
        detail: L(
          '1.–3. místo v krajské přehlídce SOČ, nebo úspěšná prezentace tématu SOČ řešeného pod vedením zaměstnance FIT VUT nebo FEKT VUT.',
          '1st–3rd place at the regional SOČ showcase, or a successfully presented SOČ topic supervised by an employee of FIT VUT or FEKT VUT.',
        ),
        relevance: 'possible',
        note: L(
          'Odborná práce z oblasti, které se už věnuješ — infrastruktura, open source — se dá jako SOČ zpracovat.',
          'A technical project in an area you already work in — infrastructure, open source — can be written up as SOČ.',
        ),
      },
      {
        id: 'cyber',
        letter: 'p',
        title: L('Národní soutěž v kybernetické bezpečnosti', 'National cybersecurity competition'),
        detail: L(
          'Účast ve 3. (finálovém) kole se ziskem alespoň 20 % bodů.',
          'Taking part in the 3rd (final) round with at least 20 % of the points.',
        ),
        relevance: 'possible',
      },
      {
        id: 'physics-olympiad',
        letter: 'c',
        title: L('Fyzikální olympiáda — krajské kolo', 'Physics Olympiad — regional round'),
        detail: L(
          'Úspěšný řešitel krajského kola v kategorii A, B, C nebo D.',
          'Successful solver of the regional round in category A, B, C or D.',
        ),
        relevance: 'unlikely',
      },
      {
        id: 'logic-olympiad',
        letter: 'd',
        title: L('Logická olympiáda — krajské kolo', 'Logical Olympiad — regional round'),
        detail: L('1.–3. místo v krajském kole v kategorii C.', '1st–3rd place in the regional round in category C.'),
        relevance: 'unlikely',
      },
      {
        id: 'vut-competition',
        letter: 'q',
        title: L(
          'Technická soutěž pořádaná FIT, FEKT nebo FSI VUT',
          'A technical competition run by FIT, FEKT or FSI VUT',
        ),
        detail: L(
          '1.–3. místo v technicky zaměřené soutěži (spolu)pořádané nebo garantované těmito fakultami.',
          '1st–3rd place in a technical competition (co-)organised or guaranteed by these faculties.',
        ),
        relevance: 'possible',
      },
      {
        id: 'matematika-plus',
        letter: 'u',
        title: L('Výběrová zkouška Matematika+', 'The selective exam Matematika+'),
        detail: L(
          'Percentil 60 nebo více u výběrové zkoušky z matematiky vyhlášené MŠMT.',
          'Percentile 60 or higher in the selective mathematics exam announced by the Ministry of Education.',
        ),
        relevance: 'possible',
      },
      {
        id: 'mensa',
        letter: 'v',
        title: L('IQ test Mensy', 'Mensa IQ test'),
        detail: L(
          'Percentil 90 nebo více ve standardizovaném vstupním IQ testu pro dospělé.',
          'Percentile 90 or higher in the standardised adult admission IQ test.',
        ),
        relevance: 'unlikely',
        note: L(
          'Je to cesta k přijetí, ne k tomu, aby člověk první ročník zvládl.',
          'It is a route to admission, not to getting through the first year.',
        ),
      },
      {
        id: 'other',
        letter: 'a, f–i, m–o, r, s',
        title: L('Další podmínky', 'Further conditions'),
        detail: L(
          'SAT Mathematics ≥ 545, zkoušky AP a A-levels, slovenské olympiády a soutěže, předchozí studium na VŠ nebo v celoživotním vzdělávání FIT. Úplný seznam je v článku 7 směrnice.',
          'SAT Mathematics ≥ 545, AP exams and A-levels, Slovak olympiads and competitions, previous university study or lifelong-learning courses at FIT. The full list is in article 7 of the directive.',
        ),
        relevance: 'unlikely',
      },
    ],
  },

  courses: [
    {
      code: 'IDM',
      name: L('Diskrétní matematika', 'Discrete Mathematics'),
      credits: 4,
      year: 1,
      semester: 'winter',
      compulsory: true,
      covers: L(
        'Formální jazyk matematiky, výroková a predikátová logika, důkazové techniky; množiny, relace, zobrazení, ekvivalence a uspořádání; grafy, stromy, nejkratší cesty a kostry; grupy, svazy, Booleovy algebry.',
        'The formal language of mathematics, propositional and predicate logic, proof techniques; sets, relations, mappings, equivalences and orderings; graphs, trees, shortest paths and spanning trees; groups, lattices, Boolean algebras.',
      ),
      statedPrerequisite: L('Středoškolská matematika.', 'Secondary-school mathematics.'),
      url: course(302514),
      prepNote: L(
        'Nejméně podobný školní matematice: méně počítání, víc definic a důkazů. Rozhoduje schopnost číst a psát přesná tvrzení.',
        'The least like school mathematics: less calculating, more definitions and proofs. What counts is the ability to read and write precise statements.',
      ),
    },
    {
      code: 'ILG',
      name: L('Lineární algebra', 'Linear Algebra'),
      credits: 5,
      year: 1,
      semester: 'winter',
      compulsory: true,
      covers: L(
        'Soustavy lineárních rovnic a Gaussova eliminace; matice, determinanty, inverzní matice; vektorové prostory, báze; skalární součin; lineární zobrazení, rotace, translace, homogenní souřadnice; vlastní čísla; kuželosečky a kvadratické formy.',
        'Systems of linear equations and Gaussian elimination; matrices, determinants, inverses; vector spaces, bases; the scalar product; linear maps, rotations, translations, homogeneous coordinates; eigenvalues; conics and quadratic forms.',
      ),
      statedPrerequisite: L('Středoškolská matematika.', 'Secondary-school mathematics.'),
      url: course(302528),
    },
    {
      code: 'IZP',
      name: L('Základy programování', 'Introduction to Programming'),
      credits: 7,
      year: 1,
      semester: 'winter',
      compulsory: true,
      covers: L(
        'Programování v jazyce C (ISO C99): typy, řídicí struktury, funkce, pole, struktury, ukazatele, dynamická alokace, rekurze, vyhledávání a řazení, ladění, testování, dokumentace. Dva projekty.',
        'Programming in C (ISO C99): types, control flow, functions, arrays, structures, pointers, dynamic allocation, recursion, searching and sorting, debugging, testing, documentation. Two projects.',
      ),
      statedPrerequisite: L(
        'Běžné znalosti matematiky a práce s počítačem na úrovni střední školy.',
        'Ordinary secondary-school knowledge of mathematics and computer use.',
      ),
      url: course(302589),
      prepNote: L(
        'Největší předmět prvního semestru (7 kreditů). Kdo přijde se zkušeností s C a ukazateli, získá čas na matematiku.',
        'The largest course of the first semester (7 credits). Arriving with experience in C and pointers frees time for the mathematics.',
      ),
    },
    {
      code: 'IEL',
      name: L('Elektronika pro informační technologie', 'Electronics for Information Technology'),
      credits: 6,
      year: 1,
      semester: 'winter',
      compulsory: true,
      covers: L(
        'Stejnosměrné obvody, Ohmův a Kirchhoffovy zákony, superpozice, náhradní zdroje, smyčkové proudy a uzlová napětí; přechodové děje v RC, RL a RLC obvodech; polovodiče, diody, tranzistory, hradla TTL a CMOS, operační zesilovače, A/D a D/A převodníky.',
        'DC circuits, Ohm’s and Kirchhoff’s laws, superposition, equivalent sources, loop currents and nodal voltages; transients in RC, RL and RLC circuits; semiconductors, diodes, transistors, TTL and CMOS gates, operational amplifiers, A/D and D/A converters.',
      ),
      statedPrerequisite: L('Běžné znalosti na úrovni střední školy.', 'Ordinary secondary-school knowledge.'),
      url: course(302517),
    },
    {
      code: 'IUS',
      name: L('Úvod do softwarového inženýrství', 'Introduction to Software Engineering'),
      credits: 5,
      year: 1,
      semester: 'winter',
      compulsory: true,
      covers: L(
        'Životní cyklus softwaru, analýza požadavků, ERD a DFD, objektová orientace, UML, testování, agilní metodiky.',
        'The software life cycle, requirements analysis, ERD and DFD, object orientation, UML, testing, agile methods.',
      ),
      statedPrerequisite: L(
        'Běžné znalosti práce s počítačem na úrovni střední školy.',
        'Ordinary secondary-school computer skills.',
      ),
      url: course(302578),
    },
    {
      code: 'ISM',
      name: L('Matematický seminář', 'Mathematics Seminar'),
      credits: 2,
      year: 1,
      semester: 'winter',
      compulsory: false,
      covers: L(
        'Opakování středoškolské matematiky potřebné pro další studium, zejména pro IMA1: výrazy, rovnice a nerovnice, funkce a jejich transformace, goniometrie, komplexní čísla, analytická geometrie, kuželosečky.',
        'Revision of the secondary-school mathematics needed for further study, especially IMA1: expressions, equations and inequalities, functions and their transformations, goniometry, complex numbers, analytic geometry, conics.',
      ),
      statedPrerequisite: L(
        'Základní středoškolské početní dovednosti.',
        'Basic secondary-school computational skills.',
      ),
      url: course(302562),
      prepNote: L(
        'Volitelný podpůrný předmět. Jeho osnova je nejlepší dostupný seznam toho, co FIT ze střední školy opravdu potřebuje.',
        'An optional support course. Its outline is the best available list of what FIT actually needs from secondary school.',
      ),
    },
    {
      code: 'ISC',
      name: L('Počítačový seminář', 'Computer Seminar'),
      credits: 2,
      year: 1,
      semester: 'winter',
      compulsory: false,
      covers: L(
        'Čísla v různých soustavách a jejich uložení v počítači, základy algoritmů a řešení problémů, základní datové struktury a programové konstrukce.',
        'Numbers in different bases and their representation in a computer, basics of algorithms and problem solving, basic data structures and programming constructs.',
      ),
      statedPrerequisite: L(
        'Běžné znalosti práce s počítačem a matematiky na úrovni střední školy.',
        'Ordinary secondary-school computer skills and mathematics.',
      ),
      url: course(302559),
    },
    {
      code: 'IFS',
      name: L('Fyzikální seminář', 'Physics Seminar'),
      credits: 2,
      year: 1,
      semester: 'winter',
      compulsory: false,
      covers: L(
        'Opakování středoškolské fyziky: vektory, kinematika, dynamika, práce a energie, elektrické pole, proud, kondenzátory a rezistory, magnetické pole.',
        'Revision of secondary-school physics: vectors, kinematics, dynamics, work and energy, electric field, current, capacitors and resistors, magnetic field.',
      ),
      statedPrerequisite: L('Středoškolská matematika a fyzika.', 'Secondary-school mathematics and physics.'),
      url: course(302521),
    },
    {
      code: 'IMA1',
      name: L('Matematická analýza 1', 'Calculus 1'),
      credits: 4,
      year: 1,
      semester: 'summer',
      compulsory: true,
      covers: L(
        'Funkce jedné proměnné a elementární funkce; limita a spojitost; derivace, Taylorův polynom, extrémy a průběh funkce; interpolace a numerické řešení rovnic; neurčitý, určitý a nevlastní integrál.',
        'Functions of one variable and elementary functions; limits and continuity; derivatives, Taylor polynomials, extrema and curve sketching; interpolation and numerical solution of equations; indefinite, definite and improper integrals.',
      ),
      statedPrerequisite: L('Středoškolská matematika.', 'Secondary-school mathematics.'),
      url: course(302530),
      prepNote: L(
        'Stojí celé na funkcích, které se učíš letos. Kdo si není jistý grafy, definičním oborem a úpravami výrazů, bojuje tu s algebrou místo s analýzou.',
        'It rests entirely on the functions you are learning this year. Anyone unsure about graphs, domains and algebraic manipulation ends up fighting the algebra instead of the calculus.',
      ),
    },
    {
      code: 'INC',
      name: L('Návrh číslicových systémů', 'Digital Systems Design'),
      credits: 5,
      year: 1,
      semester: 'summer',
      compulsory: true,
      covers: L(
        'Binární čísla a aritmetika, kódy; Booleova algebra, minimalizace logických výrazů (Karnaughovy mapy, Quine–McCluskey); kombinační a sekvenční logické obvody; stavové automaty.',
        'Binary numbers and arithmetic, codes; Boolean algebra, minimisation of logic expressions (Karnaugh maps, Quine–McCluskey); combinational and sequential logic; finite-state machines.',
      ),
      statedPrerequisite: L(
        'Množiny, relace a zobrazení. Základní pojmy a axiomy Booleovy algebry. Základní pojmy teorie grafů. Základy elektrotechniky.',
        'Sets, relations and mappings. Basic notions and axioms of Boolean algebra. Basic notions of graph theory. Basics of electrical engineering.',
      ),
      url: course(302539),
    },
    {
      code: 'IOS',
      name: L('Operační systémy', 'Operating Systems'),
      credits: 5,
      year: 1,
      semester: 'summer',
      compulsory: true,
      covers: L(
        'Principy operačních systémů a UNIX: shell a skripty, systém souborů, přístupová práva, procesy (fork, exec, wait), plánování, semafory, uváznutí, stránkování, virtuální paměť. Projekty: skript v shellu a synchronizace procesů v C.',
        'Operating-system principles and UNIX: the shell and scripting, file systems, permissions, processes (fork, exec, wait), scheduling, semaphores, deadlock, paging, virtual memory. Projects: a shell script and process synchronisation in C.',
      ),
      statedPrerequisite: L('Základy programování v jazyce C.', 'Basics of programming in C.'),
      url: course(302543),
      prepNote: L(
        'Tady ti zkušenost se správou Linuxu dává skutečný náskok.',
        'This is where your Linux administration experience gives you a real head start.',
      ),
    },
    {
      code: 'ISU',
      name: L('Programování na strojové úrovni', 'Machine-Level Programming'),
      credits: 6,
      year: 1,
      semester: 'summer',
      compulsory: true,
      covers: L(
        'Číselné soustavy, čísla se znaménkem a bez, aritmetika ve dvojkové soustavě, IEEE-754; asembler x86 (NASM), registry, adresování, volací konvence, koprocesor FPU.',
        'Number systems, signed and unsigned integers, binary arithmetic, IEEE-754; x86 assembly (NASM), registers, addressing, calling conventions, the FPU.',
      ),
      statedPrerequisite: L('Základní znalost programování v jazyce C.', 'Basic knowledge of programming in C.'),
      url: course(302567),
    },
    {
      code: 'IZLO',
      name: L('Základy logiky pro informatiky', 'Foundations of Logic for Computer Science'),
      credits: 2,
      year: 1,
      semester: 'summer',
      compulsory: true,
      covers: L(
        'Výroková a predikátová logika, syntaxe a sémantika, normální formy, formální důkaz, prvořádové teorie, SAT a SMT solvery, Gödelovy věty.',
        'Propositional and predicate logic, syntax and semantics, normal forms, formal proof, first-order theories, SAT and SMT solvers, Gödel’s theorems.',
      ),
      statedPrerequisite: L(
        'Základy diskrétní matematiky a matematické notace, množiny, relace, zobrazení.',
        'Basics of discrete mathematics and mathematical notation, sets, relations, mappings.',
      ),
      url: course(302588),
    },
    {
      code: 'IAL',
      name: L('Algoritmy', 'Algorithms'),
      credits: 5,
      year: 2,
      semester: 'winter',
      compulsory: true,
      covers: L(
        'Časová složitost; abstraktní datové typy: seznamy, zásobník, fronta, tabulky; binární a vyvážené stromy; hašování; řadicí algoritmy; rekurze a dynamické programování; vyhledávání v textu; grafové algoritmy; dokazování programů.',
        'Time complexity; abstract data types: lists, stack, queue, tables; binary and balanced trees; hashing; sorting algorithms; recursion and dynamic programming; text search; graph algorithms; proving programs correct.',
      ),
      statedPrerequisite: L(
        'Znalost základů programování v procedurálně orientovaném programovacím jazyce. Středoškolské znalosti z matematiky.',
        'Knowledge of the basics of programming in a procedural language. Secondary-school mathematics.',
      ),
      url: course(302503),
    },
    {
      code: 'IMA2',
      name: L('Matematická analýza 2', 'Calculus 2'),
      credits: 4,
      year: 2,
      semester: 'winter',
      compulsory: true,
      covers: L(
        'Číselné, mocninné a Fourierovy řady; funkce více proměnných: limita, parciální derivace, extrémy; dvojný a trojný integrál; diferenciální rovnice.',
        'Number, power and Fourier series; functions of several variables: limits, partial derivatives, extrema; double and triple integrals; differential equations.',
      ),
      statedPrerequisite: L('Úspěšně absolvovaný předmět IMA1.', 'Successful completion of IMA1.'),
      url: course(302531),
    },
    {
      code: 'IPT',
      name: L('Pravděpodobnost a statistika', 'Probability and Statistics'),
      credits: 5,
      year: 2,
      semester: 'winter',
      compulsory: true,
      covers: L(
        'Klasická a podmíněná pravděpodobnost, Bayesův vzorec; náhodné veličiny a rozdělení; centrální limitní věta; odhady, testování hypotéz, regrese.',
        'Classical and conditional probability, Bayes’ formula; random variables and distributions; the central limit theorem; estimation, hypothesis testing, regression.',
      ),
      statedPrerequisite: L(
        'Středoškolská matematika a vybrané partie z předchozích matematických předmětů.',
        'Secondary-school mathematics and selected parts of the earlier mathematics courses.',
      ),
      url: course(302549),
    },
    {
      code: 'ISS',
      name: L('Signály a systémy', 'Signals and Systems'),
      credits: 5,
      year: 2,
      semester: 'winter',
      compulsory: true,
      covers: L(
        'Spojité a diskrétní signály a systémy, konvoluce, Fourierova řada a transformace, vzorkování, číslicové filtry, náhodné signály. První cvičení: komplexní čísla, kosinusovky a komplexní exponenciály.',
        'Continuous and discrete signals and systems, convolution, Fourier series and transform, sampling, digital filters, random signals. First exercise session: complex numbers, cosines and complex exponentials.',
      ),
      statedPrerequisite: L(
        'Základní znalosti matematiky a statistiky.',
        'Basic knowledge of mathematics and statistics.',
      ),
      url: course(302564),
      prepNote: L(
        'Fakulta ho sama popisuje jako „většinou nenáviděný předmět plný komplexních čísel“. Goniometrické funkce a komplexní čísla z letošního roku jsou jeho vstupenkou.',
        'The faculty itself describes it as “a mostly hated course full of complex numbers”. This year’s trigonometric functions and complex numbers are its entry ticket.',
      ),
    },
  ],

  bridge: {
    title: L('Osnova předmětu Matematický seminář (ISM)', 'Outline of the Mathematics Seminar (ISM)'),
    source: course(302562),
    items: [
      {
        text: L('Úpravy algebraických výrazů', 'Manipulating algebraic expressions'),
        concepts: ['alg.expressions', 'alg.powers', 'alg.complete-square'],
        onSyllabus: false,
      },
      {
        text: L(
          'Rovnice a nerovnice: lineární, kvadratické, racionální lomené a s absolutní hodnotou',
          'Equations and inequalities: linear, quadratic, rational and with absolute value',
        ),
        concepts: [
          'alg.linear-eq',
          'alg.linear-ineq',
          'alg.quad-eq',
          'quad.inequality',
          'abs.equations',
          'abs.inequalities',
        ],
        onSyllabus: true,
      },
      {
        text: L(
          'Pojem funkce, graf, vlastnosti, posuny a transformace grafů; lineární a kvadratické funkce',
          'The concept of a function, graphs, properties, shifts and transformations; linear and quadratic functions',
        ),
        concepts: [
          'fn.concept',
          'fn.properties',
          'fn.transform',
          'lin.graph',
          'lin.from-points',
          'quad.graph',
          'quad.vertex',
          'quad.roots-form',
        ],
        onSyllabus: true,
      },
      {
        text: L(
          'Mocninné, lineární lomené, exponenciální a logaritmické funkce; určení inverzní funkce',
          'Power, linear-fractional, exponential and logarithmic functions; finding the inverse',
        ),
        concepts: [
          'pow.natural',
          'pow.negative',
          'pow.root',
          'inv.concept',
          'inv.find',
          'exp.function',
          'log.definition',
          'log.function',
          'log.rules',
        ],
        onSyllabus: true,
      },
      {
        text: L(
          'Goniometrické funkce, jejich vlastnosti a transformace; úlohy z goniometrie; skládání funkcí',
          'Trigonometric functions, their properties and transformations; goniometry; composition of functions',
        ),
        concepts: ['trig.radians', 'trig.unit-circle', 'trig.graphs', 'trigid.basic', 'trigid.sum'],
        onSyllabus: true,
      },
      {
        text: L('Komplexní čísla', 'Complex numbers'),
        concepts: ['cplx.algebraic', 'cplx.polar', 'cplx.moivre'],
        onSyllabus: true,
      },
      {
        text: L(
          'Rovnice a nerovnice: exponenciální a logaritmické',
          'Equations and inequalities: exponential and logarithmic',
        ),
        concepts: ['expeq.same-base', 'expeq.advanced', 'logeq.basic', 'logeq.rules'],
        onSyllabus: true,
      },
      {
        text: L(
          'Rovnice a nerovnice: iracionální, goniometrické a kombinované',
          'Equations and inequalities: irrational, trigonometric and mixed',
        ),
        concepts: ['trigeq.basic', 'trigeq.advanced'],
        onSyllabus: true,
      },
      {
        text: L(
          'Analytická geometrie: přímka a rovina, vzájemné polohy, vzdálenosti',
          'Analytic geometry: line and plane, mutual positions, distances',
        ),
        concepts: [],
        onSyllabus: false,
      },
      { text: L('Kuželosečky', 'Conic sections'), concepts: [], onSyllabus: false },
    ],
  },
};
