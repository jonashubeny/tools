import type { Concept, Generator, Lesson, Level, Mission, StaticProblem, SyllabusTopic } from '@lemma/core';
import { ENRICHMENT_CONCEPTS } from './concepts/enrichment';
import { FOUNDATION_CONCEPTS } from './concepts/foundations';
import { EXPLOG_CONCEPTS } from './concepts/school-explog';
import { FUNCTION_CONCEPTS } from './concepts/school-functions';
import { GEOMETRY_CONCEPTS } from './concepts/school-geometry';
import { TRIG_CONCEPTS } from './concepts/school-trig';
import { EXAM_BLUEPRINTS, MILESTONES } from './exams';
import { CURRENT_FIT_SNAPSHOT, FIT_SNAPSHOTS, FIT_TIMELINE, ROADMAP } from './fit';
import { ABSOLUTE_GENERATORS } from './generators/absolute';
import { COMPLEX_GENERATORS } from './generators/complex';
import { ENRICHMENT_GENERATORS } from './generators/enrichment';
import { EXPLOG_GENERATORS } from './generators/explog';
import { EXPLOG_EQUATION_GENERATORS } from './generators/explog-equations';
import { STEREOMETRY_GENERATORS } from './generators/stereometry';
import { TRIANGLE_GENERATORS } from './generators/triangles';
import { TRIG_GENERATORS } from './generators/trig';
import { TRIG_IDENTITY_GENERATORS } from './generators/trig-identities';
import { FOUNDATION_GENERATORS } from './generators/foundations';
import { INVERSE_GENERATORS } from './generators/inverse';
import { LINEAR_GENERATORS } from './generators/linear';
import { PLANIMETRY_GENERATORS } from './generators/planimetry';
import { POWER_GENERATORS } from './generators/power';
import { QUADRATIC_GENERATORS } from './generators/quadratic';
import { LESSONS as FIRST_LESSONS } from './lessons';
import { FUNCTION_LESSONS } from './lessons-functions';
import { MISSIONS } from './missions';
import { STATIC_PROBLEMS } from './static-problems';
import { SYLLABUS, SYLLABUS_BOOKS, SYLLABUS_META } from './syllabus';

/**
 * @lemma/content — the curriculum: what there is to learn and the problems to learn it
 * with. Typed data and deterministic generators only; no I/O.
 */

export const GENERATORS: readonly Generator[] = [
  ...FOUNDATION_GENERATORS,
  ...LINEAR_GENERATORS,
  ...ABSOLUTE_GENERATORS,
  ...QUADRATIC_GENERATORS,
  ...POWER_GENERATORS,
  ...INVERSE_GENERATORS,
  ...EXPLOG_GENERATORS,
  ...EXPLOG_EQUATION_GENERATORS,
  ...TRIG_GENERATORS,
  ...TRIG_IDENTITY_GENERATORS,
  ...COMPLEX_GENERATORS,
  ...TRIANGLE_GENERATORS,
  ...PLANIMETRY_GENERATORS,
  ...STEREOMETRY_GENERATORS,
  ...ENRICHMENT_GENERATORS,
];

export const LESSONS: readonly Lesson[] = [...FIRST_LESSONS, ...FUNCTION_LESSONS];

/** The tag that marks a generator as one of its chapter's basic problem types. */
export const ANNUAL_REVIEW_TAG = 'annual-review';

const AUTHORED_CONCEPTS: readonly Concept[] = [
  ...FOUNDATION_CONCEPTS,
  ...FUNCTION_CONCEPTS,
  ...EXPLOG_CONCEPTS,
  ...TRIG_CONCEPTS,
  ...GEOMETRY_CONCEPTS,
  ...ENRICHMENT_CONCEPTS,
];

const reviewedConcepts = new Set(
  GENERATORS.filter((generator) => generator.tags?.includes(ANNUAL_REVIEW_TAG)).map((generator) => generator.concept),
);

/**
 * Every concept. `annualReview` is not authored but derived: a syllabus concept belongs
 * to the annual review exactly when one of its problem types is tagged as basic, so the
 * list of concepts and the list of problems cannot drift apart.
 */
export const CONCEPTS: readonly Concept[] = AUTHORED_CONCEPTS.map((concept) => ({
  ...concept,
  annualReview: concept.syllabusTopic !== undefined && reviewedConcepts.has(concept.id),
}));

export {
  CURRENT_FIT_SNAPSHOT,
  EXAM_BLUEPRINTS,
  FIT_SNAPSHOTS,
  FIT_TIMELINE,
  MILESTONES,
  MISSIONS,
  ROADMAP,
  STATIC_PROBLEMS,
  SYLLABUS,
  SYLLABUS_BOOKS,
  SYLLABUS_META,
};

export {
  conceptsWithoutProblems,
  lintContent,
  lintGenerator,
  lintInstance,
  type ContentBundle,
  type LintIssue,
  type TexValidator,
} from './lint';

/** Bump when content changes in a way that matters to stored data or caches. */
export const CONTENT_VERSION = '2026.10.1';

// ------------------------------------------------------------------------------ lookups

const conceptById = new Map(CONCEPTS.map((concept) => [concept.id, concept]));
const generatorById = new Map(GENERATORS.map((generator) => [generator.id, generator]));
const staticById = new Map(STATIC_PROBLEMS.map((problem) => [problem.id, problem]));
const lessonByConcept = new Map(LESSONS.map((lesson) => [lesson.concept, lesson]));
const missionById = new Map(MISSIONS.map((mission) => [mission.id, mission]));

const generatorsByConcept = new Map<string, Generator[]>();
for (const generator of GENERATORS) {
  const list = generatorsByConcept.get(generator.concept);
  if (list) list.push(generator);
  else generatorsByConcept.set(generator.concept, [generator]);
}

const staticByConcept = new Map<string, StaticProblem[]>();
for (const problem of STATIC_PROBLEMS) {
  const list = staticByConcept.get(problem.concept);
  if (list) list.push(problem);
  else staticByConcept.set(problem.concept, [problem]);
}

export const getConcept = (id: string): Concept | undefined => conceptById.get(id);
export const getGenerator = (id: string): Generator | undefined => generatorById.get(id);
export const getStaticProblem = (id: string): StaticProblem | undefined => staticById.get(id);
export const getLesson = (conceptId: string): Lesson | undefined => lessonByConcept.get(conceptId);
export const getMission = (id: string): Mission | undefined => missionById.get(id);
export const generatorsFor = (conceptId: string): readonly Generator[] => generatorsByConcept.get(conceptId) ?? [];
export const staticProblemsFor = (conceptId: string): readonly StaticProblem[] => staticByConcept.get(conceptId) ?? [];
export const getSyllabusTopic = (n: number): SyllabusTopic | undefined => SYLLABUS.find((topic) => topic.n === n);

/** Concepts of a syllabus topic, in authored (teaching) order. */
export const conceptsOfTopic = (n: number): Concept[] =>
  CONCEPTS.filter((concept) => concept.syllabusTopic === n && !concept.deprecated);

/**
 * The highest level at which a concept has problems that count as evidence (self-assessed
 * explanations do not). The learner model judges "hard" problems against this ceiling.
 */
const topLevels = new Map<string, Level>();
for (const concept of CONCEPTS) {
  const levels = [
    ...generatorsFor(concept.id)
      .filter((generator) => !generator.deprecated)
      .flatMap((generator) => generator.levels),
    ...staticProblemsFor(concept.id)
      .filter((problem) => problem.answer.kind !== 'self')
      .map((problem) => problem.level),
  ];
  if (levels.length > 0) topLevels.set(concept.id, Math.max(...levels) as Level);
}
export const topLevelOf = (conceptId: string): Level | undefined => topLevels.get(conceptId);

/** Does a concept have any problems to practise with? */
export const hasProblems = (conceptId: string): boolean =>
  generatorsFor(conceptId).length > 0 || staticProblemsFor(conceptId).length > 0;
