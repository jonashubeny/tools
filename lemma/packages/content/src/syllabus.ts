import { L, type Resource, type SyllabusTopic } from '@lemma/core';

/**
 * The official 2nd-year mathematics syllabus (field IT, school year 2026/2027, 4 h/week,
 * 136 h/year), in the order it is taught.
 *
 * SOURCE AND STATUS — read before editing:
 *   The topic list is the learner's own transcription of the official syllabus. The
 *   original file was not available when this was written, so the Czech titles are a
 *   translation back from the English transcription, not the school's wording.
 *   Do not add, remove or reorder topics here unless the official document says so.
 *   Anything beyond this list belongs in concepts with track 'foundation', 'reasoning'
 *   or 'vut' — never in a syllabus topic.
 */
export const SYLLABUS_META = {
  subject: L('Matematika', 'Mathematics'),
  year: 2,
  field: 'IT',
  schoolYear: '2026/2027',
  hoursPerWeek: 4,
  hoursPerYear: 136,
  source: 'transcription' as 'transcription' | 'official-document',
  assessment: L(
    'Písemné práce po kapitolách, menší písemky, aktivita v hodině a závěrečná opakovací práce se základními typy úloh.',
    'Written tests after chapters, smaller written tests, classroom activity, and an annual review test of basic problem types.',
  ),
};

const realisticky = (id: number, title: string): Resource => ({
  kind: 'textbook',
  title: `realisticky.cz — ${title}`,
  url: `http://www.realisticky.cz/kapitola.php?id=${id}`,
  lang: 'cs',
});

export const SYLLABUS: readonly SyllabusTopic[] = [
  {
    n: 1,
    title: L('Opakování lineární funkce', 'Review of linear functions'),
    resources: [realisticky(37, 'Lineární funkce')],
  },
  {
    n: 2,
    title: L('Lineární funkce s absolutní hodnotou', 'Linear functions with absolute value'),
    resources: [realisticky(43, 'Funkce absolutní hodnota, rovnice a nerovnice s absolutní hodnotou')],
  },
  {
    n: 3,
    title: L('Kvadratická funkce', 'Quadratic functions'),
    resources: [realisticky(44, 'Kvadratická funkce, kvadratické rovnice a nerovnice')],
  },
  {
    n: 4,
    title: L('Kvadratická funkce s absolutní hodnotou', 'Quadratic functions with absolute value'),
    resources: [
      realisticky(44, 'Kvadratická funkce, kvadratické rovnice a nerovnice'),
      realisticky(43, 'Funkce absolutní hodnota, rovnice a nerovnice s absolutní hodnotou'),
    ],
  },
  {
    n: 5,
    title: L('Mocninné funkce', 'Power functions'),
    resources: [realisticky(40, 'Mocninné funkce a odmocniny')],
  },
  {
    n: 6,
    title: L('Inverzní funkce', 'Inverse functions'),
    resources: [realisticky(61, 'Vlastnosti funkcí (obsahuje hodinu Inverzní funkce)')],
  },
  {
    n: 7,
    title: L('Exponenciální funkce', 'Exponential functions'),
    resources: [realisticky(45, 'Exponenciální a logaritmické funkce a rovnice')],
  },
  {
    n: 8,
    title: L('Logaritmická funkce', 'Logarithmic functions'),
    resources: [realisticky(45, 'Exponenciální a logaritmické funkce a rovnice')],
  },
  {
    n: 9,
    title: L('Exponenciální rovnice', 'Exponential equations'),
    resources: [realisticky(45, 'Exponenciální a logaritmické funkce a rovnice')],
  },
  {
    n: 10,
    title: L('Logaritmické rovnice', 'Logarithmic equations'),
    resources: [realisticky(45, 'Exponenciální a logaritmické funkce a rovnice')],
  },
  {
    n: 11,
    title: L('Goniometrické funkce', 'Trigonometric functions'),
    resources: [realisticky(60, 'Goniometrické funkce')],
  },
  {
    n: 12,
    title: L('Goniometrické rovnice', 'Trigonometric equations'),
    resources: [realisticky(63, 'Goniometrické rovnice a vzorce')],
  },
  {
    n: 13,
    title: L('Úpravy goniometrických výrazů', 'Transformations of trigonometric expressions'),
    resources: [realisticky(63, 'Goniometrické rovnice a vzorce')],
  },
  {
    n: 14,
    title: L('Komplexní čísla – goniometrický tvar', 'Complex numbers – trigonometric form'),
    resources: [
      realisticky(54, 'Goniometrický tvar komplexních čísel'),
      realisticky(53, 'Základní vlastnosti komplexních čísel'),
    ],
  },
  {
    n: 15,
    title: L('Trigonometrie', 'Trigonometry'),
    resources: [realisticky(62, 'Trigonometrie')],
  },
  {
    n: 16,
    title: L('Planimetrie', 'Planimetry'),
    resources: [
      realisticky(67, 'Geometrické útvary v rovině'),
      realisticky(66, 'Základní planimetrické věty'),
      realisticky(65, 'Konstrukční úlohy'),
      realisticky(64, 'Zobrazení v rovině'),
    ],
  },
  {
    n: 17,
    title: L('Stereometrie I', 'Stereometry I'),
    resources: [realisticky(87, 'Stereometrie – Polohové vlastnosti')],
  },
];

/** Printed resources named in the syllabus; referenced by title only. */
export const SYLLABUS_BOOKS: readonly string[] = [
  'Matematika pro střední školy, 3. díl. Planimetrie.',
  'Matematika pro střední školy, 4. díl. Funkce I. Učebnice + Pracovní sešit.',
  'Matematika pro střední školy, 5. díl. Funkce II. Učebnice + Pracovní sešit.',
  'Matematika pro střední školy, 6. díl. Stereometrie.',
  'Sbírka úloh z matematiky pro střední školy.',
  'Matematické, fyzikální a chemické tabulky a vzorce pro střední školy.',
  'Duhová matematika',
];
