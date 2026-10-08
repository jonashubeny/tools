import type { AnswerSpec, Misconception, PublicAnswerSpec } from '../answer/types';
import type { L } from '../i18n';
import type { Rng } from '../rng';
import type { VerifySpec } from './verify';

/** See docs/content-model.md for the reasoning behind these shapes. */

/** Where a concept comes from. Only `school` concepts are on the official syllabus. */
export type Track = 'school' | 'foundation' | 'reasoning' | 'vut';

/** Columns of the skill tree. */
export type Area =
  'algebra' | 'functions' | 'explog' | 'trig' | 'complex' | 'geometry' | 'reasoning' | 'discrete' | 'computing';

export const AREAS: readonly Area[] = [
  'algebra',
  'functions',
  'explog',
  'trig',
  'complex',
  'geometry',
  'reasoning',
  'discrete',
  'computing',
];

/** Difficulty of a problem, 1 (warm-up) to 5 (boss). */
export type Level = 1 | 2 | 3 | 4 | 5;

export interface Resource {
  kind: 'textbook' | 'docs' | 'video' | 'article' | 'tool';
  title: string;
  url: string;
  /** Language of the resource. */
  lang: 'cs' | 'en';
}

/** Five ways of looking at the same idea. Any lens may be absent. */
export interface WhyLenses {
  intuition?: L;
  formal?: L;
  visual?: L;
  algebraic?: L;
  /** Only when the connection to IT is literally true of the mathematics. */
  it?: L;
}

export type LabTool =
  | 'grapher'
  | 'transform'
  | 'linear'
  | 'quadratic'
  | 'absolute'
  | 'power'
  | 'inverse'
  | 'explog'
  | 'unitcircle'
  | 'sinusoid'
  | 'complex';

export interface LabLink {
  tool: LabTool;
  /** Initial parameters for the tool. */
  preset?: Record<string, number | string | boolean>;
}

export interface Concept {
  /** Permanent identifier; never rename. */
  id: string;
  title: L;
  /** One sentence: what being able to do this means. */
  summary: L;
  area: Area;
  track: Track;
  /** 1–17; required for `school`, forbidden otherwise. */
  syllabusTopic?: number;
  prereqs: string[];
  /** Concepts implicitly practised when this one is solved; weight in (0, 1]. */
  encompasses?: { id: string; w: number }[];
  why?: WhyLenses;
  /** Terminology pairs for the glossary. */
  terms?: { cs: string; en: string }[];
  resources?: Resource[];
  /** First-year FIT courses this concept feeds (course codes such as 'IMA1'). */
  fit?: string[];
  lab?: LabLink;
  /**
   * Has "basic problem types" that belong in the annual review test. Derived by the
   * content package from the generators tagged for the review; not authored by hand.
   */
  annualReview?: boolean;
  deprecated?: boolean;
}

export interface SyllabusTopic {
  /** Order in the official syllabus, 1-based. */
  n: number;
  title: L;
  resources: Resource[];
}

// ---------------------------------------------------------------------------- figures

export type FigureColor = 'a' | 'b' | 'c' | 'd' | 'muted' | 'good' | 'bad';

export interface FigureSpec {
  view: { xMin: number; xMax: number; yMin: number; yMax: number };
  /** Height / width; default 0.62. */
  aspect?: number;
  /** Label the x axis in multiples of π. */
  piAxis?: boolean;
  /** Names of the horizontal and vertical axes; x and y by default (Re and Im for the complex plane). */
  axisLabels?: [string, string];
  /** The widest the figure should be drawn, in CSS pixels. Square figures read better small. */
  maxWidth?: number;
  curves?: {
    /** Expression in `x`. */
    expr: string;
    color?: FigureColor;
    dashed?: boolean;
    /** Restrict the curve to an interval of x. */
    domain?: [number, number];
    label?: string;
  }[];
  points?: { x: number; y: number; label?: string; color?: FigureColor; hollow?: boolean }[];
  segments?: { from: [number, number]; to: [number, number]; color?: FigureColor; dashed?: boolean }[];
  /** Full-height / full-width guide lines. */
  vlines?: { x: number; color?: FigureColor; dashed?: boolean }[];
  hlines?: { y: number; color?: FigureColor; dashed?: boolean }[];
  circles?: { cx: number; cy: number; r: number; color?: FigureColor; dashed?: boolean }[];
  /** Polygons, e.g. triangles for geometry; filled faintly. */
  polygons?: { points: [number, number][]; color?: FigureColor; labels?: string[] }[];
  labels?: { x: number; y: number; text: string; color?: FigureColor }[];
  /** Hide the coordinate grid and axes (for pure geometry). */
  bare?: boolean;
}

// --------------------------------------------------------------------------- problems

export type ProblemKind =
  | 'warmup'
  | 'core'
  | 'hard'
  | 'boss'
  | 'speed'
  | 'debug' // find the mistake
  | 'reverse' // construct an object with given properties
  | 'applied' // real-world or IT context
  | 'programming'
  | 'estimate'
  | 'explain'
  | 'graph'; // read or match a graph

export interface SolutionStep {
  text: L;
  /**
   * Display maths for this step (LaTeX, without delimiters). Bilingual when the notation
   * differs between languages — intervals, points and sets do.
   */
  math?: string | L;
}

/** One concrete problem, ready to be shown and checked. Fully serialisable. */
export interface ProblemInstance {
  prompt: L;
  figure?: FigureSpec;
  answer: AnswerSpec;
  /** Progressive hints, from a nudge to a concrete intermediate step. */
  hints: L[];
  solution: SolutionStep[];
  misconceptions?: Misconception[];
  /** Presentation context. */
  context?: { it?: boolean; applied?: boolean };
  /**
   * What the canonical answer must satisfy, checked independently by the content linter.
   * Not stored with issued problems and never sent to the client.
   */
  verify?: VerifySpec[];
}

export interface Generator {
  /** Permanent identifier. */
  id: string;
  concept: string;
  kind: ProblemKind;
  levels: Level[];
  title: L;
  tags?: string[];
  /** Expected solving time in seconds at a level. */
  estSeconds: (level: Level) => number;
  generate: (rng: Rng, level: Level) => ProblemInstance;
  /**
   * Authoring mistakes the generator can detect in what it would produce for this seed
   * (for instance a misconception that does not parse). Used by the content linter.
   */
  audit?: (rng: Rng, level: Level) => string[];
  deprecated?: boolean;
}

/** A hand-written problem where generation adds nothing. */
export interface StaticProblem extends ProblemInstance {
  id: string;
  concept: string;
  kind: ProblemKind;
  level: Level;
  title: L;
  tags?: string[];
  estSeconds: number;
  /** Other concepts this problem needs (boss problems combine several). */
  alsoRequires?: string[];
}

/** What the browser receives about a problem: everything except the answer. */
export interface PublicProblem {
  id: string;
  concept: string | null;
  conceptTitle: L | null;
  kind: ProblemKind;
  level: Level;
  prompt: L;
  figure?: FigureSpec;
  answer: PublicAnswerSpec;
  hintCount: number;
  estSeconds: number;
  context?: { it?: boolean; applied?: boolean };
}

// ---------------------------------------------------------------------------- lessons

export type LessonStep =
  | { kind: 'text'; body: L }
  | {
      kind: 'predict';
      question: L;
      options: { id: string; text: L }[];
      /** Shown after any choice — the point is to commit to a guess first. */
      reveal: L;
      correct?: string;
    }
  | { kind: 'explore'; lab: LabLink; task: L; observe: L }
  | { kind: 'figure'; figure: FigureSpec; caption: L }
  | { kind: 'worked'; title: L; steps: { math?: string | L; text: L; why?: L }[] }
  | { kind: 'check'; generator: string; level: Level }
  | { kind: 'summary'; points: L[] };

export interface Lesson {
  /** Same as the concept id it teaches. */
  concept: string;
  /** Rough reading-and-doing time. */
  minutes: number;
  steps: LessonStep[];
}

// --------------------------------------------------------------------------- missions

export interface Mission {
  id: string;
  title: L;
  /** The engineering task in two or three sentences. */
  brief: L;
  /** Why it is worth doing: what it makes concrete. */
  payoff: L;
  concepts: string[];
  /** Suggested technology, e.g. "C#", "C", "Python", "Bash". */
  stack: string[];
  /** Estimated total effort in hours. */
  hours: number;
  difficulty: 1 | 2 | 3;
  milestones: { id: string; title: L; detail: L }[];
  stretch?: L[];
}

// ------------------------------------------------------------------------------ exams

export interface ExamBlueprint {
  id: string;
  title: L;
  description: L;
  kind: 'chapter' | 'annual' | 'custom';
  /** Concepts to draw from; for 'chapter' and 'annual' this is filled at runtime. */
  concepts: string[];
  items: number;
  minutes: number;
  /** Share of items at each level, e.g. {2: 0.4, 3: 0.4, 4: 0.2}. */
  levelMix: Partial<Record<Level, number>>;
}

// ------------------------------------------------------------------------- FIT VUT data

export interface SourceRef {
  title: string;
  url: string;
}

export interface FitCourse {
  code: string;
  name: L;
  credits: number;
  year: 1 | 2;
  semester: 'winter' | 'summer';
  compulsory: boolean;
  /** What the course covers, paraphrased from the official annotation. */
  covers: L;
  /** The prerequisite as stated on the course page. */
  statedPrerequisite: L;
  url: string;
  /** Why it matters for someone preparing from secondary school. */
  prepNote?: L;
}

export interface AdmissionRoute {
  id: string;
  /** Letter of the directive's article 7, when it is a preferential route. */
  letter?: string;
  title: L;
  detail: L;
  /** How plausible this route is for the learner, as judged by Lemma (not by FIT). */
  relevance: 'primary' | 'possible' | 'unlikely';
  /** Lemma's comment on the route — clearly not an official statement. */
  note?: L;
}

/** A dated snapshot of official FIT information. Never edited after the fact. */
export interface FitSnapshot {
  /** Academic year the admission rules apply to, e.g. "2027/2028". */
  admissionFor: string;
  /** Academic year of the study plan, e.g. "2026/2027". */
  studyPlanFor: string;
  /** ISO date the sources were read. */
  retrievedOn: string;
  /** ISO date after which the UI asks for re-verification. */
  reviewAfter: string;
  sources: SourceRef[];
  programme: { facts: { text: L; source: string }[] };
  admission: {
    facts: { text: L; source: string }[];
    routes: AdmissionRoute[];
  };
  courses: FitCourse[];
  /** The outline of FIT's own bridging seminar (ISM): FIT's definition of "expected". */
  bridge: { title: L; source: string; items: { text: L; concepts: string[]; onSyllabus: boolean }[] };
}

/** A stage of the long-term roadmap. */
export interface RoadmapStage {
  id: string;
  title: L;
  description: L;
  /** Whether the stage is defined by an official source or is Lemma's recommendation. */
  basis: 'school-syllabus' | 'official-fit' | 'lemma-recommendation';
  groups: { title: L; concepts: string[]; note?: L }[];
}

// --------------------------------------------------------------------------- milestones

export interface MilestoneDef {
  id: string;
  title: L;
  description: L;
  /** Larger = shown first in lists. */
  weight: number;
}
