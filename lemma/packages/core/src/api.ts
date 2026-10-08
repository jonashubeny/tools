import type { PublicAnswerSpec } from './answer/types';
import type {
  AdmissionRoute,
  Area,
  FigureSpec,
  FitCourse,
  LabLink,
  LessonStep,
  Level,
  ProblemKind,
  Resource,
  SolutionStep,
  SourceRef,
  Track,
  WhyLenses,
} from './content/types';
import type { L, Locale } from './i18n';
import type { ErrorFamily, ErrorType } from './learning/errors';
import type { ExamReport, GradeScale } from './learning/exam';
import type { GateStatus, MasteryLevel, PracticeContext } from './learning/mastery';
import type { BlockKind, ReasonCode } from './learning/session';
import type { StreakSummary } from './learning/streak';

/**
 * The HTTP API contract: every shape that crosses between server and browser.
 * Kept in core so both sides compile against the same definitions.
 */

// ----------------------------------------------------------------------------- settings

export interface TestDto {
  id: string;
  /** Study day of the test. */
  day: string;
  topics: number[];
  title: string;
}

export interface PauseDto {
  from: string;
  to: string;
  label: string;
}

export interface SettingsDto {
  name: string;
  locale: Locale;
  theme: 'dark' | 'light' | 'system';
  /** Read "2,5" as 2.5 in answers (Czech notation). */
  decimalComma: boolean;
  /** Default length of the daily session, minutes. */
  sessionMinutes: number;
  /** Active days per week aimed for. */
  weekGoal: number;
  /** Ask for confidence before submitting an answer. */
  confidencePrompt: boolean;
  /** The syllabus topic the class is on. */
  currentTopic: number | null;
  tests: TestDto[];
  pauses: PauseDto[];
  /** Lower bounds in percent for grades 1–4; null hides grades. */
  gradeScale: GradeScale | null;
  githubUser: string;
  forgejoUrl: string;
  forgejoUser: string;
}

// ----------------------------------------------------------------------------- accounts

/**
 * The administrator is the one account that exists from the first start: its password
 * comes from the server's environment, and it alone may create the others.
 */
export const ADMIN_USERNAME = 'admin';

/** Lower-case and safe as a directory name, because a learner's data lives in one. */
export const USERNAME_PATTERN = /^[a-z0-9][a-z0-9._-]{1,31}$/;

export const MIN_PASSWORD_LENGTH = 8;

/** Who is signed in. */
export interface AccountDto {
  username: string;
  admin: boolean;
}

/** A learner's account, as the administrator sees it. */
export interface UserDto {
  username: string;
  /** May use the AI tutor, which runs on the instance's API key. */
  tutor: boolean;
  createdAt: number;
  /** The last time any of the account's sessions was seen; null if nobody has signed in yet. */
  lastSeenAt: number | null;
}

export interface MeDto {
  authenticated: boolean;
  authRequired: boolean;
  /** Null until signed in. */
  account: AccountDto | null;
  /** Accounts besides the administrator's exist, so signing in takes a name as well. */
  hasUsers: boolean;
  onboarded: boolean;
  settings: SettingsDto;
  version: string;
  contentVersion: string;
  /** Today's study day in the server's configured time zone. */
  today: string;
  tutor: { enabled: boolean; provider: string | null; model: string | null };
}

// ------------------------------------------------------------------------------- skills

export interface SkillDto {
  id: string;
  title: L;
  summary: L;
  area: Area;
  track: Track;
  topic: number | null;
  prereqs: string[];
  level: MasteryLevel;
  /** 0–1, level plus progress towards the next one. */
  progress: number;
  theta: number;
  attempts: number;
  /** Predicted recall has dropped below the fading threshold. */
  fading: boolean;
  /** A scheduled review is due. */
  due: boolean;
  dueInDays: number | null;
  /** Predicted probability of recall, 0–1. */
  retention: number | null;
  hasLesson: boolean;
  lessonDone: boolean;
  hasProblems: boolean;
  lastPracticedAt: number | null;
  fit: string[];
  annualReview: boolean;
  /** A direct prerequisite is below "familiar". */
  weakPrereq: string | null;
}

export interface ConceptDetailDto extends SkillDto {
  why: WhyLenses;
  terms: { cs: string; en: string }[];
  resources: Resource[];
  lab: LabLink | null;
  /** Evidence still needed for the next level; null when mastered. */
  next: { level: MasteryLevel; gates: GateStatus[] } | null;
  /** Concepts that list this one as a prerequisite. */
  unlocks: { id: string; title: L }[];
  prereqDetails: { id: string; title: L; level: MasteryLevel }[];
  errors: { type: ErrorType; count: number }[];
  stats: {
    attempts: number;
    solved: number;
    unaided: number;
    /** time taken / time expected, smoothed; null before any solved problem. */
    speed: number | null;
    mixedUnaided: number;
    calibration: { sureRight: number; sureWrong: number; unsureRight: number; unsureWrong: number };
  };
  lesson: { minutes: number; steps: number; step: number; done: boolean } | null;
  missions: { id: string; title: L }[];
  problemFamilies: { id: string; title: L; kind: ProblemKind; levels: Level[] }[];
  topicTitle: L | null;
}

export interface SyllabusTopicDto {
  n: number;
  title: L;
  resources: Resource[];
  skills: string[];
  /** Mean progress of the topic's skills, 0–1. */
  progress: number;
  /** Lowest level among the topic's skills. */
  minLevel: MasteryLevel;
  current: boolean;
}

export interface GraphDto {
  skills: SkillDto[];
  topics: SyllabusTopicDto[];
  syllabus: {
    schoolYear: string;
    hoursPerWeek: number;
    hoursPerYear: number;
    /** 'transcription' until the official document replaces it. */
    source: 'transcription' | 'official-document';
    assessment: L;
    books: string[];
  };
}

// ------------------------------------------------------------------------------ lessons

export interface LessonDto {
  concept: string;
  title: L;
  minutes: number;
  steps: LessonStep[];
  /** Index of the first step not yet completed. */
  step: number;
  done: boolean;
}

// ----------------------------------------------------------------------------- practice

export interface ProblemDto {
  id: string;
  runId: string | null;
  /** Null while the topic is hidden (interleaved practice, exams). */
  concept: string | null;
  conceptTitle: L | null;
  kind: ProblemKind;
  level: Level;
  context: PracticeContext;
  prompt: L;
  figure: FigureSpec | null;
  answer: PublicAnswerSpec;
  hintCount: number;
  /** Hints already taken, in order. */
  hints: L[];
  estSeconds: number;
  wrongAttempts: number;
  triesLeft: number;
  status: 'open' | 'solved' | 'failed' | 'skipped';
  it: boolean;
  applied: boolean;
  /** Present once the problem is resolved. */
  outcome: OutcomeDto | null;
  /** The learner's previous wrong inputs on this problem. */
  previousInputs: string[];
}

export interface ErrorGuessDto {
  type: ErrorType;
  family: ErrorFamily;
  basis: 'misconception' | 'pattern' | 'timing' | 'model';
  confident: boolean;
  /** Specific feedback from a matched pattern. */
  note: L | null;
}

export interface OutcomeDto {
  solved: boolean;
  /** 0–1: how much the attempt counted. */
  credit: number;
  points: number;
  solution: SolutionStep[];
  /** The correct answer, typeset, per language (notation differs). */
  answerTex: L;
  /** For self-assessed problems. */
  model: L | null;
  rubric: L[];
  skill: {
    id: string;
    title: L;
    levelBefore: MasteryLevel;
    levelAfter: MasteryLevel;
    progressBefore: number;
    progressAfter: number;
    next: { level: MasteryLevel; gates: GateStatus[] } | null;
  };
  /** Wrong at first, then solved without revealing the solution. */
  corrected: boolean;
  reviewPassed: boolean;
  error: ErrorGuessDto | null;
  errorConfirmed: ErrorType | null;
  milestones: string[];
  seconds: number;
  /** For "find the mistake": which line was wrong. */
  wrongLine: number | null;
  correctOptions: string[];
}

/** The model answer of a self-assessed problem, for comparing one's own explanation. */
export interface SelfModelDto {
  model: L;
  rubric: L[];
}

export interface AnswerResultDto {
  verdict: 'correct' | 'incorrect' | 'invalid';
  /** Why the input was not accepted (verdict 'invalid'). */
  message: L | null;
  resolved: boolean;
  triesLeft: number;
  error: ErrorGuessDto | null;
  problem: ProblemDto;
}

export interface RunDto {
  id: string;
  context: PracticeContext;
  total: number;
  position: number;
  finished: boolean;
  blockId: string | null;
  title: L | null;
  summary: RunSummaryDto | null;
}

export interface RunSummaryDto {
  problems: number;
  solved: number;
  unaided: number;
  points: number;
  seconds: number;
  errors: { type: ErrorType; count: number }[];
  levelUps: { skill: string; title: L; from: MasteryLevel; to: MasteryLevel }[];
  skills: { id: string; title: L; solved: number; total: number }[];
}

export interface StartRunRequest {
  context: PracticeContext;
  concept?: string;
  skills?: string[];
  topic?: number;
  blockId?: string;
  errorType?: ErrorType;
  /** For a single lesson check or a replay. */
  generator?: string;
  level?: Level;
  replayOf?: string;
  count?: number;
}

export interface StartRunResponse {
  run: RunDto;
  problem: ProblemDto | null;
}

// --------------------------------------------------------------------------------- plan

export interface PlanBlockDto {
  id: string;
  kind: BlockKind;
  minutes: number;
  skills: { id: string; title: L }[];
  reason: { code: ReasonCode; data: Record<string, string | number> };
  optional: boolean;
  errorType: ErrorType | null;
  lab: string | null;
  status: 'todo' | 'active' | 'done';
  runId: string | null;
}

export interface PlanDto {
  day: string;
  minutes: number;
  blocks: PlanBlockDto[];
  test: { day: string; inDays: number; title: string | null } | null;
  focusTopic: number | null;
}

// --------------------------------------------------------------------- activity, streak

export interface DayCellDto {
  day: string;
  score: number;
  level: 0 | 1 | 2 | 3 | 4;
  /** External contributions (GitHub / Forgejo), when configured. */
  forge: number;
}

export interface DayEventDto {
  at: number;
  type: string;
  points: number;
  title: L;
  detail: L | null;
  skill: string | null;
  problemId: string | null;
}

export interface DayDetailDto {
  day: string;
  score: number;
  active: boolean;
  events: DayEventDto[];
  counts: { problems: number; solved: number; unaided: number; corrected: number; reviews: number; lessons: number };
}

export interface RecentItemDto {
  at: number;
  kind: 'level' | 'milestone' | 'exam' | 'lesson' | 'correction';
  title: L;
  detail: L | null;
  skill: string | null;
}

// ---------------------------------------------------------------------------- dashboard

export interface DashboardDto {
  today: string;
  name: string;
  plan: PlanDto;
  focus: {
    topic: SyllabusTopicDto | null;
    skills: SkillDto[];
    /** The single most useful next step, as evidence gates. */
    nextSkill: { id: string; title: L; next: { level: MasteryLevel; gates: GateStatus[] } | null } | null;
  };
  weak: {
    skills: SkillDto[];
    error: { type: ErrorType; count: number; share: number } | null;
    fading: SkillDto[];
  };
  streak: StreakSummary;
  heatmap: DayCellDto[];
  recent: RecentItemDto[];
  fit: {
    /** Share of the FIT bridging-seminar skills at "familiar" or better, 0–1. */
    bridgeCoverage: number;
    bridgeProficient: number;
    schoolProgress: number;
    reasoningProgress: number;
    stale: boolean;
    retrievedOn: string;
  };
  totals: {
    problems: number;
    solved: number;
    activeDays: number;
    skillsProficient: number;
    skillsTotal: number;
    reviewsDue: number;
  };
  slipRate: { recent: number | null; previous: number | null };
  forge: { configured: boolean; stale: boolean; fetchedAt: number | null };
}

// ------------------------------------------------------------------------------- errors

export interface MistakeDto {
  problemId: string;
  at: number;
  skill: string;
  skillTitle: L;
  prompt: L;
  /** The first wrong input, as typed. For choices this is an option id: show `inputText`. */
  input: string;
  answerTex: L;
  /** What was chosen and what was right, in words, when the answer was not typed. */
  inputText: L | null;
  answerText: L | null;
  error: ErrorType;
  confirmed: boolean;
  note: L | null;
  level: Level;
  solvedLater: boolean;
}

export interface ErrorSummaryDto {
  windowDays: number;
  attempts: number;
  errors: number;
  byType: { type: ErrorType; family: ErrorFamily; recent: number; previous: number; rate: number }[];
  byFamily: Record<ErrorFamily, { recent: number; previous: number }>;
  /** Weekly rates, oldest first. */
  weekly: { week: string; attempts: number; slip: number; procedure: number; concept: number }[];
  /** Where each error type happens. */
  byTopic: { topic: number | null; title: L; counts: Partial<Record<ErrorType, number>>; total: number }[];
  recent: MistakeDto[];
  /** Statements such as "sign errors: 18 % → 7 %". */
  trends: { type: ErrorType | ErrorFamily; from: number; to: number }[];
  calibration: { sureRight: number; sureWrong: number; unsureRight: number; unsureWrong: number };
}

// -------------------------------------------------------------------------------- exams

export interface ExamItemDto {
  index: number;
  problem: ProblemDto;
  input: string;
  seconds: number;
}

export interface ExamDto {
  id: string;
  blueprint: string;
  title: L;
  startedAt: number;
  deadlineAt: number;
  finishedAt: number | null;
  minutes: number;
  items: ExamItemDto[];
  report: ExamReportDto | null;
}

export interface ExamReportDto extends ExamReport {
  skillTitles: Record<string, L>;
  details: {
    index: number;
    problemId: string;
    skill: string;
    correct: boolean;
    answered: boolean;
    input: string;
    error: ErrorType | null;
    seconds: number;
    expectedSeconds: number;
  }[];
}

export interface ExamListItemDto {
  id: string;
  title: L;
  startedAt: number;
  finishedAt: number | null;
  percent: number | null;
  grade: number | null;
  items: number;
}

export interface CreateExamRequest {
  blueprint: string;
  topics?: number[];
  concepts?: string[];
}

// ---------------------------------------------------------------------------- analytics

export interface AnalyticsDto {
  totals: {
    sessions: number;
    problems: number;
    solved: number;
    unaided: number;
    accuracy: number | null;
    unaidedRate: number | null;
    avgLevel: number | null;
    medianSeconds: number | null;
    reviewsPassed: number;
    reviewsFailed: number;
    minutes: number;
    activeDays: number;
  };
  weekly: {
    week: string;
    problems: number;
    accuracy: number | null;
    unaidedRate: number | null;
    avgLevel: number | null;
    slipRate: number | null;
    gapRate: number | null;
    points: number;
    activeDays: number;
    mixedAccuracy: number | null;
    blockedAccuracy: number | null;
  }[];
  levels: Record<MasteryLevel, number>;
  topics: { topic: number; title: L; progress: number; attempts: number; accuracy: number | null }[];
  contexts: { context: PracticeContext; problems: number; accuracy: number | null }[];
  retention: { due: number; fading: number; scheduled: number; avgRetention: number | null };
  records: { title: L; value: string; at: number | null }[];
}

// ---------------------------------------------------------------------------------- FIT

export interface RoadmapGroupDto {
  title: L;
  note: L | null;
  skills: SkillDto[];
  progress: number;
}

export interface RoadmapStageDto {
  id: string;
  title: L;
  description: L;
  basis: 'school-syllabus' | 'official-fit' | 'lemma-recommendation';
  groups: RoadmapGroupDto[];
  progress: number;
}

export interface FitDto {
  snapshot: {
    admissionFor: string;
    studyPlanFor: string;
    retrievedOn: string;
    reviewAfter: string;
    stale: boolean;
    sources: SourceRef[];
    programmeFacts: { text: L; source: string }[];
    admissionFacts: { text: L; source: string }[];
    routes: AdmissionRoute[];
    courses: (FitCourse & { skills: SkillDto[]; progress: number | null })[];
    bridge: {
      title: L;
      source: string;
      items: { text: L; onSyllabus: boolean; skills: SkillDto[]; progress: number | null }[];
    };
  };
  history: { admissionFor: string; retrievedOn: string }[];
  timeline: { secondYear: string; expectedStart: string; caveats: L[] };
  stages: RoadmapStageDto[];
}

// ----------------------------------------------------------------------------- missions

export interface MissionDto {
  id: string;
  title: L;
  brief: L;
  payoff: L;
  concepts: { id: string; title: L; level: MasteryLevel }[];
  stack: string[];
  hours: number;
  difficulty: 1 | 2 | 3;
  milestones: { id: string; title: L; detail: L; done: boolean }[];
  stretch: L[];
  status: 'idle' | 'active' | 'done';
  notes: string;
  repoUrl: string;
  /** Whether the concepts it uses are far enough along to start. */
  ready: boolean;
}

// -------------------------------------------------------------------------------- forge

export interface ForgeDto {
  configured: boolean;
  sources: {
    id: string;
    label: string;
    ok: boolean;
    fetchedAt: number | null;
    error: string | null;
    note: string | null;
  }[];
  /** Contributions per calendar day, summed over sources. */
  days: { day: string; count: number }[];
}

// -------------------------------------------------------------------------------- tutor

export const TUTOR_MODES = [
  'socratic',
  'simple',
  'formal',
  'hint',
  'check',
  'mistake',
  'challenge',
  'programming',
  'reallife',
  'oral',
] as const;

export type TutorMode = (typeof TUTOR_MODES)[number];

export interface TutorMessageDto {
  id: number;
  role: 'user' | 'assistant';
  content: string;
  at: number;
}

export interface TutorThreadDto {
  id: string;
  mode: TutorMode;
  title: string;
  concept: string | null;
  problemId: string | null;
  createdAt: number;
  updatedAt: number;
  messages: TutorMessageDto[];
}

export interface TutorRequest {
  threadId?: string;
  mode: TutorMode;
  message: string;
  concept?: string;
  problemId?: string;
}

/** What `POST /api/tutor/chat` streams back, one JSON object per server-sent event. */
export type TutorStreamEvent =
  | { type: 'start'; threadId: string; title: string }
  | { type: 'delta'; text: string }
  /** Remove the last `chars` characters received: a round of the reply was withdrawn. */
  | { type: 'retract'; chars: number }
  /** The tutor is calling the app's evaluator or a problem generator. */
  | { type: 'tool'; name: string }
  | { type: 'done'; messageId: number; model: string; truncated: boolean; toolCalls: number }
  | { type: 'error'; code: string; message: string };

// ------------------------------------------------------------------------------- errors

export interface ApiError {
  error: string;
  message: string;
}
