import {
  L,
  type Concept,
  type ExamBlueprint,
  type ExamFacts,
  type ExamSlot,
  type Goal,
  type GoalId,
  type GoalSkill,
  type Level,
  type SkillRole,
  type SlotFormat,
} from '@lemma/core';
import { BASIC_CONCEPTS } from './concepts/basic';
import { type JpzVariant, VARIANT_OF_GOAL, evidenceFor } from './jpz/evidence';
import { JPZ_EVIDENCE_RETRIEVED_ON } from './jpz/evidence-data';
import { JPZ_SPEC_SOURCE, SPEC_STAGE, type SpecPart } from './jpz/spec';

/**
 * Goals: what a learner is preparing for. The second-year syllabus is one goal; each
 * variant of the unified entrance examination is another.
 *
 * For an entrance goal nothing about a skill's role or weight is authored. Both are
 * derived here from two sources that can be inspected: the official specification
 * (jpz/spec.ts) and the classified past papers (jpz/evidence-data.ts).
 */

// ------------------------------------------------------------------------ official facts

/**
 * SOURCE AND STATUS — read before editing:
 *   Read on 9 October 2026 from prijimacky.cermat.cz. Time limit, maximum score and aids are
 *   from the page for the 2027 examination; the numbers of open and closed tasks from the
 *   document on scoring; the dates from the 2027 page, which said the exact times would be
 *   added later. Re-read the pages before relying on any of this in a later year.
 */
const JPZ_SOURCES = {
  exam2027: {
    title: 'Jednotná přijímací zkouška 2027 (CZVV)',
    url: 'https://prijimacky.cermat.cz/menu/jednotna-prijimaci-zkouska.html',
  },
  scoring: {
    title: 'Hodnocení didaktických testů zadávaných v rámci JPZ – testy z matematiky (CZVV)',
    url: 'https://prijimacky.cermat.cz/files/files/dokumenty/Hodnoceni_uloh_JPZ_MA.pdf',
  },
  specification: { title: JPZ_SPEC_SOURCE.title, url: JPZ_SPEC_SOURCE.url },
  usage: {
    title: 'Pravidla pro využívání obsahu webů ve správě CZVV',
    url: 'https://prijimacky.cermat.cz/files/files/CZVV_pravidla-vyuziti-webstrankyp.pdf',
  },
  archive: (slug: string) => ({
    title: 'Testová zadání v PDF – matematika (CZVV)',
    url: `https://prijimacky.cermat.cz/menu/testova-zadani-k-procvicovani/testova-zadani-v-pdf/${slug}-obory-matematika.html`,
  }),
} as const;

const AIDS = L(
  'Jen psací a rýsovací potřeby. Kalkulačka ani tabulky nejsou povoleny.',
  'Writing and drawing instruments only. No calculator and no tables.',
);

const term = (cs: string, en: string, day: string): ExamFacts['terms'][number] => ({ label: L(cs, en), day });

function facts(
  shape: Pick<ExamFacts, 'tasks' | 'open' | 'closed'>,
  regular: [string, string],
  archive: string,
): ExamFacts {
  return {
    minutes: 70,
    points: 50,
    ...shape,
    aids: AIDS,
    terms: [
      term('1. řádný termín', '1st regular term', regular[0]),
      term('2. řádný termín', '2nd regular term', regular[1]),
      term('1. náhradní termín', '1st substitute term', '2027-04-29'),
      term('2. náhradní termín', '2nd substitute term', '2027-04-30'),
    ],
    sources: [
      JPZ_SOURCES.exam2027,
      JPZ_SOURCES.scoring,
      JPZ_SOURCES.specification,
      JPZ_SOURCES.archive(archive),
      JPZ_SOURCES.usage,
    ],
    retrievedOn: JPZ_EVIDENCE_RETRIEVED_ON,
    reviewAfter: '2027-02-01',
  };
}

// ------------------------------------------------------------------------------- roles

const PART_OF_GOAL: Readonly<Partial<Record<GoalId, SpecPart>>> = { 'jpz-5': 'A', 'jpz-7': 'B', 'jpz-9': 'C' };
const PART_RANK: Readonly<Record<SpecPart, number>> = { A: 0, B: 1, C: 2 };

/** A skill counts as represented in an examination's papers from this much evidence. */
export const EVIDENCE_THRESHOLD = { readTasks: 1, rulesTasks: 3 } as const;

/** Weight of a tested skill that no read paper happened to contain. */
export const WEIGHT_FLOOR = 0.004;

/** Fewer read papers than this, and a goal's weights are marked provisional. */
export const PROVISIONAL_BELOW_PAPERS = 10;

const partsOf = (concept: Concept): SpecPart[] => (concept.spec ?? []).map((id) => id[0] as SpecPart);

/** The earliest part of the specification that lists a concept, as a school grade. */
export function stageOf(concept: Concept): 5 | 7 | 9 | undefined {
  const parts = partsOf(concept);
  if (parts.length === 0) return undefined;
  return SPEC_STAGE[parts.sort((a, b) => PART_RANK[a] - PART_RANK[b])[0]!];
}

function goalSkills(goal: GoalId): GoalSkill[] {
  const variant = VARIANT_OF_GOAL[goal]!;
  const part = PART_OF_GOAL[goal]!;
  const evidence = evidenceFor(variant);
  const byId = new Map(BASIC_CONCEPTS.map((concept) => [concept.id, concept]));

  const tested = new Set<string>();
  for (const concept of BASIC_CONCEPTS) {
    const found = evidence.skills.get(concept.id);
    const withinSpecification = partsOf(concept).some((p) => PART_RANK[p] <= PART_RANK[part]);
    // A task that was read settles it. The keyword rules are trusted only for skills the
    // specification allows at this stage: a word like "válec" in a fifth-grade task is
    // about recognising a solid, not about the volume of a cylinder.
    const inPapers =
      found !== undefined &&
      (found.readTasks >= EVIDENCE_THRESHOLD.readTasks ||
        (withinSpecification && found.rulesTasks >= EVIDENCE_THRESHOLD.rulesTasks));
    // The examination's own part of the specification may ask for it even if no paper
    // that was read happened to.
    const inOwnPart = partsOf(concept).includes(part);
    if (inPapers || inOwnPart) tested.add(concept.id);
  }

  // Everything a tested skill needs, and everything the earlier parts of the
  // specification require, is a prerequisite.
  const needed = new Set<string>();
  const visit = (id: string): void => {
    for (const pre of byId.get(id)?.prereqs ?? []) {
      if (!needed.has(pre)) {
        needed.add(pre);
        visit(pre);
      }
    }
  };
  for (const id of tested) visit(id);
  for (const concept of BASIC_CONCEPTS) {
    if (partsOf(concept).some((p) => PART_RANK[p] < PART_RANK[part])) needed.add(concept.id);
  }

  const out: GoalSkill[] = [];
  for (const concept of BASIC_CONCEPTS) {
    const found = evidence.skills.get(concept.id);
    const tasks = { read: found?.readTasks ?? 0, rules: found?.rulesTasks ?? 0 };
    let role: SkillRole;
    if (tested.has(concept.id)) role = 'tested';
    else if (needed.has(concept.id)) role = 'prerequisite';
    // One part further on: there to stretch a strong learner, never scheduled by itself.
    else if (partsOf(concept).some((p) => PART_RANK[p] === PART_RANK[part] + 1)) role = 'enrichment';
    else continue;
    const share = evidence.readPoints > 0 ? (found?.readPoints ?? 0) / evidence.readPoints : 0;
    out.push({
      id: concept.id,
      role,
      weight: role === 'tested' ? Math.max(WEIGHT_FLOOR, Math.round(share * 10000) / 10000) : 0,
      tasks,
    });
  }
  return out;
}

const papersRead = (goal: GoalId): number => evidenceFor(VARIANT_OF_GOAL[goal] as JpzVariant).papersRead;

function entranceGoal(
  id: GoalId,
  grade: 5 | 7 | 9,
  text: { title: L; short: L; description: L },
  examFacts: ExamFacts,
  anchors: string[],
): Goal {
  return {
    id,
    kind: 'entrance',
    ...text,
    grade,
    facts: examFacts,
    skills: goalSkills(id),
    anchors,
    papersRead: papersRead(id),
    provisional: papersRead(id) < PROVISIONAL_BELOW_PAPERS,
  };
}

export const GOALS: readonly Goal[] = [
  {
    id: 'school-it-2',
    kind: 'school',
    title: L('Matematika 2. ročníku SŠ a příprava na FIT', 'Second-year secondary mathematics and FIT preparation'),
    short: L('2. ročník', 'Year 2'),
    description: L(
      'Sedmnáct kapitol osnov druhého ročníku, základy z dřívějška a rozšiřující témata.',
      'The seventeen chapters of the second-year syllabus, the foundations they need, and enrichment.',
    ),
    grade: null,
    facts: null,
    skills: [],
    anchors: [],
    papersRead: 0,
    provisional: false,
  },
  entranceGoal(
    'jpz-9',
    9,
    {
      title: L('Přijímačky na čtyřleté obory (9. třída)', 'Entrance examination to four-year fields (grade 9)'),
      short: L('Přijímačky 9', 'Entrance 9'),
      description: L(
        'Jednotná přijímací zkouška z matematiky pro čtyřleté obory s maturitou a nástavbové studium.',
        'The unified entrance examination in mathematics for four-year fields and follow-up study.',
      ),
    },
    facts({ tasks: 16, open: 11, closed: 5 }, ['2027-04-12', '2027-04-13'], 'ctyrlete'),
    [
      'frac.operations',
      'num.integers',
      'pct.basics',
      'ratio.proportion',
      'expr.polynomials',
      'eqn.linear',
      'word.equations',
      'geom.perimeter-area',
      'geom.angles',
      'geom.pythagoras',
      'solid.cuboid',
      'data.tables-charts',
    ],
  ),
  entranceGoal(
    'jpz-7',
    7,
    {
      title: L(
        'Přijímačky na šestiletá gymnázia (7. třída)',
        'Entrance examination to six-year grammar schools (grade 7)',
      ),
      short: L('Přijímačky 7', 'Entrance 7'),
      description: L(
        'Jednotná přijímací zkouška z matematiky pro šestiletá gymnázia.',
        'The unified entrance examination in mathematics for six-year grammar schools.',
      ),
    },
    facts({ tasks: 16, open: 10, closed: 6 }, ['2027-04-14', '2027-04-15'], 'sestilete'),
    [
      'frac.operations',
      'num.integers',
      'num.decimals',
      'pct.basics',
      'ratio.proportion',
      'word.arith',
      'geom.perimeter-area',
      'geom.angles',
      'solid.cuboid',
      'data.tables-charts',
    ],
  ),
  entranceGoal(
    'jpz-5',
    5,
    {
      title: L(
        'Přijímačky na osmiletá gymnázia (5. třída)',
        'Entrance examination to eight-year grammar schools (grade 5)',
      ),
      short: L('Přijímačky 5', 'Entrance 5'),
      description: L(
        'Jednotná přijímací zkouška z matematiky pro osmiletá gymnázia.',
        'The unified entrance examination in mathematics for eight-year grammar schools.',
      ),
    },
    facts({ tasks: 14, open: 8, closed: 6 }, ['2027-04-14', '2027-04-15'], 'osmilete'),
    [
      'num.natural',
      'word.arith',
      'frac.concept',
      'units.conversion',
      'geom.perimeter-area',
      'data.tables-charts',
      'solid.views',
      'puzzle.patterns',
    ],
  ),
];

const goalById = new Map(GOALS.map((goal) => [goal.id, goal]));
export const getGoal = (id: GoalId): Goal => goalById.get(id)!;
export const DEFAULT_GOAL: GoalId = 'school-it-2';

// --------------------------------------------------------------------- practice tests

/**
 * Generators that produce the examination's closed formats carry one of these tags; a
 * slot of that format draws only from them. Everything untagged is typed.
 */
export const FORMAT_TAGS: Readonly<Record<Exclude<SlotFormat, 'open'>, string>> = {
  choice: 'mc5',
  truefalse: 'tf',
  matching: 'match6',
};

const slot = (
  label: string,
  points: number,
  format: SlotFormat,
  level: Level,
  skills: string[],
  bundle?: string,
): ExamSlot => ({
  label,
  points,
  skills,
  format,
  level,
  ...(bundle ? { bundle } : {}),
});
const open = (label: string, points: number, level: Level, ...skills: string[]): ExamSlot =>
  slot(label, points, 'open', level, skills);

/** True/false bundle, as in the 2026 keys: 3 right 4 points, 2 right 2 points, otherwise none. */
const TRUE_FALSE = [0, 0, 2, 4];
/** Matching bundle of the four-year and six-year tests: 2 points for each right answer. */
const MATCHING = [0, 2, 4, 6];
/** Matching bundle of the eight-year test: 5, 3, 1, 0 points. */
const MATCHING_5 = [0, 1, 3, 5];

const onScreen = (slots: ExamSlot[], bundles: Record<string, number[]>): number => {
  const loose = slots.filter((s) => !s.bundle).reduce((sum, s) => sum + s.points, 0);
  return loose + Object.values(bundles).reduce((sum, table) => sum + table[table.length - 1]!, 0);
};

function entranceBlueprint(
  goal: GoalId,
  title: L,
  slots: ExamSlot[],
  bundles: Record<string, number[]>,
  offScreenPoints: number,
): ExamBlueprint {
  const points = onScreen(slots, bundles);
  return {
    id: `${goal}-practice`,
    title,
    description: L(
      `Stavba, bodování a čas podle testů z let 2025 a 2026. Na obrazovce jde ${points} z 50 bodů: konstrukční úlohy (${offScreenPoints} b.) se rýsují na papír a tady chybí, čas je o ně zkrácen. U úloh s celým postupem řešení se tu hodnotí jen výsledek.`,
      `Structure, scoring and time as in the 2025 and 2026 tests. ${points} of the 50 points can be earned on a screen: the construction tasks (${offScreenPoints} points) are drawn on paper and left out, and the time is shortened by their share. Where the real test marks the whole working, only the result is checked here.`,
    ),
    kind: 'entrance',
    goal,
    concepts: [...new Set(slots.flatMap((s) => s.skills))],
    items: slots.length,
    // Points follow the time a task takes (the scoring document says so), so the time
    // without the construction tasks is the same share of 70 minutes.
    minutes: Math.round((70 * points) / 50),
    levelMix: { 3: 1 },
    slots,
    bundles,
    offScreenPoints,
  };
}

/**
 * Practice tests that follow each variant's structure in 2025–2026: which task is open,
 * which a bundle, and how many points each carries (docs/cermat-coverage.md §Structure).
 * The skills offered for a slot are those the papers put at that place.
 */
export const ENTRANCE_BLUEPRINTS: ExamBlueprint[] = [
  entranceBlueprint(
    'jpz-9',
    L('Přijímačky nanečisto – čtyřleté obory', 'Entrance practice test – four-year fields'),
    [
      open('1', 1, 2, 'num.powers', 'units.conversion', 'num.integers', 'num.decimals', 'frac.concept', 'ratio.basics'),
      open('2.1', 1, 2, 'frac.operations'),
      open('2.2', 2, 3, 'frac.operations'),
      open('3.1', 1, 2, 'expr.variables'),
      open('3.2', 1, 2, 'expr.factoring'),
      open('3.3', 2, 3, 'expr.polynomials'),
      open('4.1', 2, 3, 'eqn.linear'),
      open('4.2', 2, 3, 'eqn.systems'),
      open('5.1', 1, 2, 'expr.variables'),
      open('5.2', 1, 2, 'word.equations'),
      open('5.3', 2, 3, 'word.equations'),
      open('6.1', 1, 2, 'word.rates', 'ratio.proportion'),
      open('6.2', 2, 3, 'word.rates', 'ratio.proportion'),
      open('7.1', 1, 2, 'geom.angles'),
      open('7.2', 2, 3, 'geom.angles'),
      open('8.1', 1, 2, 'geom.perimeter-area', 'geom.circle'),
      open('8.2', 2, 3, 'geom.pythagoras', 'geom.perimeter-area', 'geom.circle'),
      slot('11.1', 0, 'truefalse', 2, ['data.tables-charts', 'data.mean'], 'tf'),
      slot('11.2', 0, 'truefalse', 3, ['data.tables-charts', 'data.mean'], 'tf'),
      slot('11.3', 0, 'truefalse', 3, ['data.tables-charts', 'data.mean'], 'tf'),
      slot('12', 2, 'choice', 3, ['pct.basics', 'pct.applied']),
      slot('13', 2, 'choice', 3, ['geom.pythagoras', 'geom.perimeter-area', 'geom.angles']),
      slot('14', 2, 'choice', 3, ['solid.cuboid', 'solid.prism', 'solid.cylinder']),
      slot('15.1', 0, 'matching', 2, ['pct.basics', 'pct.applied'], 'match'),
      slot('15.2', 0, 'matching', 3, ['pct.basics', 'pct.applied'], 'match'),
      slot('15.3', 0, 'matching', 3, ['pct.basics', 'pct.applied'], 'match'),
      open('16.1', 1, 2, 'puzzle.patterns'),
      open('16.2', 1, 3, 'puzzle.patterns'),
      open('16.3', 2, 4, 'puzzle.patterns'),
    ],
    { tf: TRUE_FALSE, match: MATCHING },
    5,
  ),
  entranceBlueprint(
    'jpz-7',
    L('Přijímačky nanečisto – šestiletá gymnázia', 'Entrance practice test – six-year grammar schools'),
    [
      open('1', 1, 2, 'units.conversion', 'ratio.proportion', 'frac.concept'),
      open('2.1', 2, 2, 'frac.operations'),
      open('2.2', 2, 3, 'frac.operations'),
      open('3.1', 1, 2, 'num.divisibility'),
      open('3.2', 1, 2, 'num.integers'),
      open('3.3', 1, 2, 'num.decimals'),
      open('4.1', 1, 2, 'word.equations', 'word.arith'),
      open('4.2', 2, 3, 'word.equations', 'word.arith'),
      open('5.1', 1, 2, 'geom.angles'),
      open('5.2', 1, 2, 'geom.angles'),
      open('5.3', 2, 3, 'geom.angles'),
      open('6.1', 2, 2, 'frac.concept', 'ratio.proportion'),
      open('6.2', 2, 3, 'ratio.proportion', 'ratio.basics'),
      open('7.1', 1, 2, 'geom.perimeter-area'),
      open('7.2', 2, 3, 'geom.perimeter-area', 'solid.cuboid'),
      slot('10.1', 0, 'truefalse', 2, ['data.tables-charts', 'geom.symmetry'], 'tf'),
      slot('10.2', 0, 'truefalse', 2, ['data.tables-charts', 'geom.symmetry'], 'tf'),
      slot('10.3', 0, 'truefalse', 3, ['data.tables-charts', 'geom.symmetry'], 'tf'),
      slot('11', 2, 'choice', 2, ['data.mean', 'data.tables-charts']),
      slot('12', 2, 'choice', 2, ['ratio.basics', 'ratio.scale', 'pct.basics']),
      slot('13', 2, 'choice', 3, ['geom.perimeter-area', 'geom.angles']),
      slot('14', 2, 'choice', 3, ['solid.cuboid', 'solid.prism']),
      slot('15.1', 0, 'matching', 2, ['pct.basics'], 'match'),
      slot('15.2', 0, 'matching', 2, ['pct.basics'], 'match'),
      slot('15.3', 0, 'matching', 3, ['pct.basics'], 'match'),
      open('16.1', 1, 2, 'puzzle.patterns'),
      open('16.2', 1, 3, 'puzzle.patterns'),
      open('16.3', 2, 4, 'puzzle.patterns'),
    ],
    { tf: TRUE_FALSE, match: MATCHING },
    6,
  ),
  entranceBlueprint(
    'jpz-5',
    L('Přijímačky nanečisto – osmiletá gymnázia', 'Entrance practice test – eight-year grammar schools'),
    [
      open('1.1', 2, 2, 'num.natural'),
      open('1.2', 2, 3, 'num.natural'),
      open('2.1', 1, 2, 'units.conversion'),
      open('2.2', 2, 3, 'units.conversion'),
      open('3.1', 2, 2, 'word.arith'),
      open('3.2', 2, 3, 'word.arith'),
      open('4.1', 1, 1, 'frac.concept'),
      open('4.2', 1, 2, 'frac.concept', 'ratio.proportion'),
      open('4.3', 2, 3, 'ratio.proportion', 'word.arith'),
      open('5.1', 2, 2, 'geom.perimeter-area'),
      open('5.2', 2, 3, 'geom.perimeter-area'),
      open('6.1', 2, 2, 'puzzle.reasoning', 'puzzle.counting'),
      open('6.2', 2, 3, 'puzzle.reasoning', 'puzzle.counting'),
      slot('8.1', 0, 'truefalse', 1, ['data.tables-charts'], 'tf'),
      slot('8.2', 0, 'truefalse', 2, ['data.tables-charts'], 'tf'),
      slot('8.3', 0, 'truefalse', 2, ['data.tables-charts'], 'tf'),
      slot('9', 2, 'choice', 2, ['word.arith', 'frac.concept']),
      slot('10', 2, 'choice', 2, ['geom.symmetry', 'geom.perimeter-area']),
      slot('11', 2, 'choice', 2, ['geom.perimeter-area', 'units.conversion']),
      slot('12', 2, 'choice', 2, ['solid.views']),
      slot('13.1', 0, 'matching', 2, ['word.arith', 'units.conversion'], 'match'),
      slot('13.2', 0, 'matching', 2, ['word.arith', 'units.conversion'], 'match'),
      slot('13.3', 0, 'matching', 2, ['word.arith', 'units.conversion'], 'match'),
      open('14.1', 1, 2, 'puzzle.patterns'),
      open('14.2', 1, 2, 'puzzle.patterns'),
      open('14.3', 2, 3, 'puzzle.patterns'),
    ],
    { tf: TRUE_FALSE, match: MATCHING_5 },
    6,
  ),
];
