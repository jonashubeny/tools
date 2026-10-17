import { L, type FitSnapshot, type RoadmapStage } from '@lemma/core';
import { SNAPSHOT_2026_10 } from './snapshot-2026-10';

/**
 * All snapshots of official FIT information, oldest first. The last one is "current".
 * To update: add a new file next to snapshot-2026-10.ts and append it here.
 * See docs/updating-fit-data.md.
 */
export const FIT_SNAPSHOTS: readonly FitSnapshot[] = [SNAPSHOT_2026_10];

export const CURRENT_FIT_SNAPSHOT: FitSnapshot = FIT_SNAPSHOTS[FIT_SNAPSHOTS.length - 1]!;

/**
 * What is known about the learner's own timeline. Stated facts only; everything about
 * the 2029/2030 admission round is explicitly unknown.
 */
export const FIT_TIMELINE = {
  /** School year in which the learner is in the 2nd year (from the syllabus). */
  secondYear: '2026/2027',
  /** Expected first year of university study, assuming a 4-year programme without a gap. */
  expectedStart: '2029/2030',
  caveats: [
    L(
      'Pravidla přijímacího řízení pro rok 2029/2030 zatím neexistují. Směrnice pro rok 2027/2028 byla schválena 22. 9. 2026, tedy zhruba rok před začátkem studia, kterého se týká.',
      'The admission rules for 2029/2030 do not exist yet. The directive for 2027/2028 was approved on 22 Sep 2026, roughly a year before the start of the studies it governs.',
    ),
    L(
      'Akreditace současného programu BIT končí 25. 6. 2029 — před tvým nástupem. Budeš studovat podle nově akreditovaného programu, jehož předměty se mohou lišit.',
      'The accreditation of the current BIT programme ends on 25 June 2029 — before you would enrol. You would study under a re-accredited programme whose courses may differ.',
    ),
    L(
      'Proto se vyplatí stavět na tom, co se nemění: jistota ve středoškolské matematice, schopnost přesně uvažovat a zkušenost s programováním.',
      'That is why it pays to build on what does not change: fluency in secondary mathematics, the ability to reason precisely, and programming experience.',
    ),
  ],
};

/**
 * The long-term roadmap. Each stage says on what basis it is defined, so that official
 * requirements and Lemma's own recommendations are never mixed up.
 */
export const ROADMAP: RoadmapStage[] = [
  {
    id: 'school',
    title: L('Středoškolská matematika — 2. ročník', 'Secondary mathematics — year 2'),
    description: L(
      'Sedmnáct témat tvého letošního sylabu. Tohle je základ; všechno ostatní na něm stojí.',
      'The seventeen topics of this year’s syllabus. This is the foundation; everything else stands on it.',
    ),
    basis: 'school-syllabus',
    groups: [
      {
        title: L('Lineární funkce a absolutní hodnota', 'Linear functions and absolute value'),
        concepts: [
          'lin.graph',
          'lin.from-points',
          'lin.model',
          'abs.graph',
          'abs.piecewise',
          'abs.equations',
          'abs.inequalities',
        ],
      },
      {
        title: L('Kvadratická funkce', 'Quadratic functions'),
        concepts: [
          'quad.graph',
          'quad.vertex',
          'quad.roots-form',
          'quad.inequality',
          'quad.optimize',
          'quadabs.graph',
          'quadabs.equations',
        ],
      },
      {
        title: L('Mocninné a inverzní funkce', 'Power and inverse functions'),
        concepts: ['pow.natural', 'pow.negative', 'pow.root', 'inv.concept', 'inv.find'],
      },
      {
        title: L(
          'Exponenciální a logaritmické funkce a rovnice',
          'Exponential and logarithmic functions and equations',
        ),
        concepts: [
          'exp.function',
          'exp.model',
          'log.definition',
          'log.function',
          'log.rules',
          'expeq.same-base',
          'expeq.advanced',
          'logeq.basic',
          'logeq.rules',
        ],
      },
      {
        title: L('Goniometrie', 'Trigonometric functions'),
        concepts: [
          'trig.radians',
          'trig.unit-circle',
          'trig.graphs',
          'trigeq.basic',
          'trigeq.advanced',
          'trigid.basic',
          'trigid.sum',
        ],
      },
      { title: L('Komplexní čísla', 'Complex numbers'), concepts: ['cplx.polar', 'cplx.moivre'] },
      {
        title: L('Trigonometrie, planimetrie, stereometrie', 'Trigonometry, planimetry, stereometry'),
        concepts: [
          'trigo.sine-rule',
          'trigo.cosine-rule',
          'trigo.area',
          'plan.angles',
          'plan.circle',
          'plan.similarity',
          'plan.area',
          'ster.positions',
        ],
      },
    ],
  },
  {
    id: 'reasoning',
    title: L('Matematické uvažování', 'Mathematical reasoning'),
    description: L(
      'Logika, množiny a důkazy. Ve škole se jim věnuje málo času, na FIT na nich stojí první semestr.',
      'Logic, sets and proofs. School spends little time on them; the first semester at FIT is built on them.',
    ),
    basis: 'lemma-recommendation',
    groups: [
      {
        title: L('Logika a důkazy', 'Logic and proofs'),
        concepts: ['reason.logic', 'reason.quantifiers', 'reason.proof'],
      },
      { title: L('Množiny', 'Sets'), concepts: ['reason.sets', 'alg.intervals'] },
    ],
  },
  {
    id: 'bridge',
    title: L('Co FIT očekává ze střední školy', 'What FIT expects from secondary school'),
    description: L(
      'Osnova volitelného předmětu Matematický seminář, kterým FIT prvákům doplňuje středoškolskou matematiku. Přesnější oficiální seznam očekávaných znalostí neexistuje.',
      'The outline of the optional Mathematics Seminar with which FIT tops up first-years’ secondary mathematics. No more precise official list of expected knowledge exists.',
    ),
    basis: 'official-fit',
    groups: [],
  },
  {
    id: 'vut',
    title: L('Základy pro první ročník', 'Foundations for the first year'),
    description: L(
      'Témata nad rámec střední školy, která usnadní první dva semestry. Výběr je doporučení Lemmy vycházející z anotací předmětů, ne požadavek fakulty.',
      'Topics beyond secondary school that make the first two semesters easier. The selection is Lemma’s recommendation based on the course annotations, not a requirement of the faculty.',
    ),
    basis: 'lemma-recommendation',
    groups: [
      {
        title: L('Čísla v počítači (ISC, ISU, INC)', 'Numbers in a computer (ISC, ISU, INC)'),
        concepts: ['comp.binary', 'comp.boolean'],
      },
      { title: L('Složitost algoritmů (IAL)', 'Complexity of algorithms (IAL)'), concepts: ['comp.complexity'] },
      {
        title: L('Diskrétní matematika (IDM, IZLO)', 'Discrete mathematics (IDM, IZLO)'),
        concepts: ['reason.logic', 'reason.quantifiers', 'reason.sets', 'reason.proof'],
      },
      {
        title: L('Lineární algebra, analýza, pravděpodobnost', 'Linear algebra, calculus, probability'),
        concepts: [],
        note: L(
          'Zatím v Lemmě nejsou: vektory, matice, limity a derivace, kombinatorika. Jsou v plánu.',
          'Not in Lemma yet: vectors, matrices, limits and derivatives, combinatorics. They are on the roadmap.',
        ),
      },
    ],
  },
];
