import { L, type ExamBlueprint, type MilestoneDef } from '@lemma/core';

/**
 * Exam templates. `concepts` is empty here: for 'chapter' and 'annual' exams the server
 * fills it from the chosen syllabus topics when the exam is created.
 */
export const EXAM_BLUEPRINTS: ExamBlueprint[] = [
  {
    id: 'quick-check',
    title: L('Rychlá prověrka', 'Quick check'),
    description: L(
      'Pět úloh z vybraných témat. Jako desetiminutovka ve škole.',
      'Five problems from the chosen topics. Like a ten-minute quiz at school.',
    ),
    kind: 'custom',
    concepts: [],
    items: 5,
    minutes: 12,
    levelMix: { 2: 0.6, 3: 0.4 },
  },
  {
    id: 'chapter-test',
    title: L('Písemná práce z kapitoly', 'Chapter test'),
    description: L(
      'Osm úloh z jedné nebo více kapitol, od základních po těžší. Bez nápověd, s časovým limitem.',
      'Eight problems from one or more chapters, from basic to harder. No hints, timed.',
    ),
    kind: 'chapter',
    concepts: [],
    items: 8,
    minutes: 40,
    levelMix: { 2: 0.375, 3: 0.375, 4: 0.25 },
  },
  {
    id: 'annual-review',
    title: L('Závěrečná opakovací práce', 'Annual review test'),
    description: L(
      'Základní typy úloh ze všech dosud probraných kapitol, promíchané. Odpovídá závěrečné práci, kterou škola píše na konci roku.',
      'Basic problem types from every chapter covered so far, mixed. Mirrors the review test the school sets at the end of the year.',
    ),
    kind: 'annual',
    concepts: [],
    items: 12,
    minutes: 45,
    levelMix: { 2: 0.5, 3: 0.5 },
  },
];

/**
 * Milestones: plain statements of things achieved. They are records, not rewards — no
 * points are attached, and they are never announced with fanfare.
 */
export const MILESTONES: MilestoneDef[] = [
  {
    id: 'first-problem',
    title: L('První vyřešená úloha', 'First problem solved'),
    description: L('Začátek.', 'A start.'),
    weight: 1,
  },
  {
    id: 'first-lesson',
    title: L('První dokončená lekce', 'First lesson finished'),
    description: L('Lekce včetně kontrolních úloh.', 'A lesson including its check problems.'),
    weight: 2,
  },
  {
    id: 'first-correction',
    title: L('První opravená chyba', 'First error corrected'),
    description: L(
      'Špatná odpověď, pojmenovaná příčina, správná odpověď.',
      'A wrong answer, a named cause, a right answer.',
    ),
    weight: 3,
  },
  {
    id: 'first-familiar',
    title: L('První dovednost na úrovni „známá“', 'First skill at “familiar”'),
    description: L('Spolehlivě řešíš známé typy úloh.', 'You reliably solve familiar problem types.'),
    weight: 4,
  },
  {
    id: 'first-proficient',
    title: L('První dovednost na úrovni „ovládnutá“', 'First skill at “proficient”'),
    description: L(
      'Úlohu poznáš a vyřešíš bez nápovědy i po několika dnech.',
      'You recognise and solve the problem unaided, even days later.',
    ),
    weight: 6,
  },
  {
    id: 'first-mastered',
    title: L('První dovednost na úrovni „mistrovská“', 'First skill at “mastered”'),
    description: L(
      'Těžké úlohy, po týdnu, bez chyby v postupu.',
      'Hard problems, a week later, with no error of method.',
    ),
    weight: 8,
  },
  {
    id: 'topic-proficient',
    title: L('Celá kapitola ovládnutá', 'A whole chapter proficient'),
    description: L(
      'Všechny dovednosti jedné kapitoly sylabu na úrovni „ovládnutá“.',
      'Every skill of one syllabus chapter at “proficient”.',
    ),
    weight: 9,
  },
  {
    id: 'boss-solved',
    title: L('Vyřešená boss úloha', 'A boss problem solved'),
    description: L(
      'Úloha kombinující několik pojmů, bez nápovědy.',
      'A problem combining several concepts, without hints.',
    ),
    weight: 7,
  },
  {
    id: 'reviews-25',
    title: L('25 úspěšných opakování', '25 reviews passed'),
    description: L('Dovednosti, které sis udržel i po čase.', 'Skills you kept after time had passed.'),
    weight: 5,
  },
  {
    id: 'problems-100',
    title: L('100 vyřešených úloh', '100 problems solved'),
    description: L('Sto úloh vyřešených jakýmkoli způsobem.', 'A hundred problems solved in any way.'),
    weight: 5,
  },
  {
    id: 'corrections-10',
    title: L('10 opravených chyb', '10 errors corrected'),
    description: L('Desetkrát ses k chybě vrátil a opravil ji.', 'Ten times you returned to an error and fixed it.'),
    weight: 5,
  },
  {
    id: 'spot-10',
    title: L('10 nalezených chyb', '10 mistakes found'),
    description: L(
      'Deset správně určených chyb v cizím řešení.',
      'Ten mistakes correctly located in someone else’s solution.',
    ),
    weight: 5,
  },
  {
    id: 'streak-7',
    title: L('7 dní v řadě', '7 days in a row'),
    description: L('Týden aktivních dní.', 'A week of active days.'),
    weight: 4,
  },
  {
    id: 'streak-30',
    title: L('30 dní v řadě', '30 days in a row'),
    description: L(
      'Měsíc aktivních dní, s volnými dny tam, kde byly potřeba.',
      'A month of active days, with rest days where they were needed.',
    ),
    weight: 8,
  },
  {
    id: 'consistency-20',
    title: L('20 aktivních dní z 28', '20 active days out of 28'),
    description: L('Pravidelnost, která vydrží i slabší týden.', 'A rhythm that survives a weak week.'),
    weight: 7,
  },
  {
    id: 'clean-week',
    title: L('Týden s méně než 5 % chyb z nepozornosti', 'A week under 5 % slips'),
    description: L(
      'Aspoň 30 úloh za týden a méně než jedna z dvaceti pokažená nepozorností.',
      'At least 30 problems in a week, fewer than one in twenty spoiled by a slip.',
    ),
    weight: 9,
  },
  {
    id: 'exam-80',
    title: L('Zkouška nanečisto na 80 %', 'A mock exam at 80 %'),
    description: L(
      'Časovaná písemka bez nápověd s výsledkem aspoň 80 %.',
      'A timed test without hints with a score of at least 80 %.',
    ),
    weight: 7,
  },
  {
    id: 'mission-done',
    title: L('Dokončená mise', 'A mission completed'),
    description: L('Všechny milníky jednoho projektu splněny.', 'Every milestone of one project done.'),
    weight: 9,
  },
];
