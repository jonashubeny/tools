import type { PublicAnswerSpec } from './answer/types';
import type {
  AdmissionRoute,
  Area,
  ExamFacts,
  FigureSpec,
  FitCourse,
  GoalId,
  LabLink,
  LessonStep,
  Level,
  ProblemKind,
  Resource,
  SkillRole,
  SlotFormat,
  SolutionStep,
  SourceRef,
  Track,
  WhyLenses,
} from './content/types';
import type { L, Locale } from './i18n';
import type { DiagnosticOutcome, DiagnosticStage, DiagnosticVerdict } from './learning/diagnostic';
import type { ErrorFamily, ErrorType } from './learning/errors';
import type { ExamReport, GradeScale } from './learning/exam';
import type { EstimateConfidence, GateStatus, MasteryLevel, PracticeContext } from './learning/mastery';
import type { PathReason, PathState } from './learning/path';
import type { PriorityTerms, Purpose } from './learning/priority';
import type { Readiness } from './learning/readiness';
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
  /** What the learner is preparing for. */
  goal: GoalId;
  /** Study day of the examination, for an examination goal; null when not set. */
  examDay: string | null;
  /** Skills the class is on now (examination goals; the school goal has `currentTopic`). */
  inSchool: string[];
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
  /** Accounts that may see this learner's work and set work for them. */
  teachers: string[];
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
  /** Who can see this learner's work: shown to the learner, so that it is never a surprise. */
  teachers: string[];
  /** How many learners this account teaches; above zero, the teaching pages are offered. */
  students: number;
}

// -------------------------------------------------------------------------------- goals

/** A goal as the interface shows it: what it is, and what stands behind it. */
export interface GoalDto {
  id: GoalId;
  kind: 'school' | 'entrance';
  title: L;
  short: L;
  description: L;
  grade: 5 | 7 | 9 | null;
  facts: ExamFacts | null;
  /** Past papers whose tasks were classified by reading; the weights rest on these. */
  papersRead: number;
  /** The weights rest on few papers and may move when more are read. */
  provisional: boolean;
  counts: { tested: number; prerequisite: number; enrichment: number; paperOnly: number };
  /**
   * For an examination goal: how many items the official specification has for it, and
   * how many of them the app has problems for. Null for the school goal.
   */
  spec: { items: number; withProblems: number; missing: { id: string; text: L }[] } | null;
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
  /** A direct prerequisite is below "familiar" and not made likely by a diagnostic. */
  weakPrereq: string | null;
  /** Why the skill belongs to the learner's goal; null for the school goal. */
  role: SkillRole | null;
  /** Share of the examination's points in the papers that were read, 0–1. */
  weight: number;
  /** For entrance skills: the grade by whose end the specification expects it. */
  stage: 5 | 7 | 9 | null;
  /** Cannot be practised on a screen (geometric constructions). */
  paperOnly: boolean;
  /** Where the skill stands on the learner's path, and the rule that put it there. */
  path: PathState;
  pathReason: PathReason;
  /** How far the estimate can be relied on. */
  confidence: EstimateConfidence;
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
  /** For entrance skills: the items of the official specification, and the tasks found in past papers. */
  spec: { id: string; text: L }[];
  evidence: { read: number; rules: number; papersRead: number } | null;
  /** What the model has counted, beyond the gates: shown so that the level can be checked. */
  record: {
    firstTry: number;
    hinted: number;
    guessed: number;
    families: number;
    familyCap: number;
    timed: { attempts: number; solved: number };
    reviews: { passed: number; failed: number };
    days: number;
    lastSuccessAt: number | null;
    diagnosed: number;
    placed: boolean;
  };
}

/** A solved example of a skill, to read before practising it. */
export interface WorkedExampleDto {
  concept: string;
  level: Level;
  prompt: L;
  figure: FigureSpec | null;
  solution: SolutionStep[];
  answerTex: L;
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
  /** 'recorded': answered in a test or placement that is not over, so nothing is said yet. */
  status: 'open' | 'solved' | 'failed' | 'skipped' | 'recorded';
  it: boolean;
  applied: boolean;
  /** Present once the problem is resolved. */
  outcome: OutcomeDto | null;
  /** The learner's previous wrong inputs on this problem. */
  previousInputs: string[];
  /** Why this problem was chosen, where a selection was made; null otherwise. */
  why: ProblemWhyDto | null;
}

/** The reason a problem of an adaptive session was chosen, in terms the interface can word. */
export interface ProblemWhyDto {
  purpose: Purpose;
  /** The term of the score that weighed most. */
  because: keyof PriorityTerms | 'confidence';
  /** The skill this one is being practised for. Withheld while the topic is hidden. */
  forSkill: { id: string; title: L } | null;
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
  /** 'recorded': taken without comment — a placement test says nothing until its end. */
  verdict: 'correct' | 'incorrect' | 'invalid' | 'recorded';
  /** Why the input was not accepted (verdict 'invalid'). */
  message: L | null;
  resolved: boolean;
  triesLeft: number;
  error: ErrorGuessDto | null;
  problem: ProblemDto;
}

/** What a run is: one practice context throughout, or a session that chooses as it goes. */
export type RunKind = PracticeContext | 'adaptive';

export interface RunDto {
  id: string;
  context: RunKind;
  /** For a placement test: its record, to be read once the run is finished. */
  diagnostic: string | null;
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
  context: RunKind;
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
  /** For work the teacher set. */
  assignment: AssignmentDto | null;
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
  /** What the learner is preparing for. */
  goal: { id: GoalId; kind: 'school' | 'entrance'; title: L; short: L };
  /** For an examination goal: the next step, readiness and what the teacher set. Null otherwise. */
  entrance: {
    next: NextStepDto | null;
    readiness: ReadinessDto;
    diagnostic: { done: boolean; skipped: boolean; count: number; lastAt: number | null; running: string | null };
  } | null;
  /** Work the teacher set: what is open, and the last few things done. Whatever the goal. */
  assignments: AssignmentDto[];
  /** The FIT widgets belong to the school goal; null for an examination goal. */
  fit: {
    /** Share of the FIT bridging-seminar skills at "familiar" or better, 0–1. */
    bridgeCoverage: number;
    bridgeProficient: number;
    schoolProgress: number;
    reasoningProgress: number;
    stale: boolean;
    retrievedOn: string;
  } | null;
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
  byTopic: {
    topic: number | null;
    title: L;
    /** Set where the grouping is by area of mathematics (goals without syllabus chapters). */
    area?: Area;
    counts: Partial<Record<ErrorType, number>>;
    total: number;
  }[];
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
  /** For a test with a fixed structure: the task's label, what it is worth and how it is answered. */
  slot: { label: string; points: number; format: SlotFormat; bundle: string | null } | null;
}

/** What a practice test of an examination covers, and what it leaves out. */
export interface ExamStructureDto {
  goal: GoalId;
  /** Points of the real test. */
  examPoints: number;
  /** Points that can be earned on a screen. */
  onScreenPoints: number;
  /** Points of tasks that are drawn on paper and left out here. */
  offScreenPoints: number;
  /** Points of each bundle by the number of its sub-questions answered correctly. */
  bundles: Record<string, number[]>;
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
  /** Present for a practice test that follows an examination's structure. */
  structure: ExamStructureDto | null;
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
    /** For a test with a fixed structure. */
    label?: string;
    points?: number;
    earned?: number;
    bundle?: string | null;
  }[];
  /** For an examination practice test: when to come back to what was missed. */
  followUp?: { skill: string; inDays: number; kind: 'repair' | 'review' }[];
  structure?: ExamStructureDto | null;
}

export interface ExamListItemDto {
  id: string;
  blueprint: string;
  title: L;
  startedAt: number;
  finishedAt: number | null;
  percent: number | null;
  grade: number | null;
  items: number;
  /** For an examination practice test: points out of those a screen allows. */
  points: number | null;
  maxPoints: number | null;
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
    /** Attempts on a skill whose scheduled review had come due, as the learner model counts them. */
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
  /** The same by area of mathematics, for every goal. */
  areas: {
    area: Area;
    skills: number;
    progress: number;
    attempts: number;
    accuracy: number | null;
    firstTry: number | null;
  }[];
  /** How timed work and untimed practice compare: they measure different things. */
  timed: {
    untimed: { problems: number; accuracy: number | null; firstTry: number | null; medianPace: number | null };
    timed: { problems: number; accuracy: number | null; firstTry: number | null; medianPace: number | null };
  };
  contexts: { context: PracticeContext; problems: number; accuracy: number | null }[];
  retention: { due: number; fading: number; scheduled: number; avgRetention: number | null };
  records: { title: L; value: string; at: number | null }[];
}

// -------------------------------------------------------------------------- assignments

export const ASSIGNMENT_KINDS = ['practice', 'review', 'remediation', 'lesson', 'test'] as const;
/**
 * Work a teacher sets: practice of one or several skills, a mixed review, a remediation
 * (the skill from its easiest problems, its prerequisites first), a lesson or worked
 * example to study, or a timed practice test.
 */
export type AssignmentKind = (typeof ASSIGNMENT_KINDS)[number];

export interface AssignmentDto {
  id: string;
  kind: AssignmentKind;
  skills: { id: string; title: L }[];
  /** A line from the teacher, shown to the student. */
  note: string;
  minutes: number;
  /** How many problems, where the kind is a set of problems. */
  count: number | null;
  dueDay: string | null;
  createdBy: string;
  createdAt: number;
  status: 'open' | 'done' | 'cancelled';
  doneAt: number | null;
  /** How it went, once started. */
  result: { problems: number; solved: number; unaided: number; hinted: number } | null;
}

export interface CreateAssignmentRequest {
  kind: AssignmentKind;
  skills: string[];
  note?: string;
  minutes?: number;
  count?: number;
  dueDay?: string | null;
}

/** What a teacher noted about a skill in a session: it steers selection, never the level. */
export interface FocusDto {
  skill: string;
  title: L;
  kind: 'difficulty' | 'covered';
  setBy: string;
  setAt: number;
  expiresAt: number;
}

// ----------------------------------------------------------- next step, readiness, map

/** What to do next and why, in terms the interface can word. */
export interface NextStepDto {
  skill: { id: string; title: L };
  purpose: Purpose;
  because: keyof PriorityTerms;
  /** The skill this one is practised for, when it is a prerequisite in the way. */
  forSkill: { id: string; title: L } | null;
  /** The terms of the score, for whoever wants to see the arithmetic. */
  terms: PriorityTerms;
  score: number;
}

export interface ReadinessDto extends Readiness {
  goal: GoalId;
  examDay: string | null;
  daysLeft: number | null;
  /** The weights rest on few papers. */
  provisional: boolean;
  /** Titles of every skill named in the report. */
  titles: Record<string, L>;
  /** The examination by weight: each tested skill and where the learner stands on it. */
  skills: { id: string; weight: number; level: MasteryLevel; path: PathState; paperOnly: boolean }[];
}

export interface CurriculumDto {
  goal: GoalDto;
  skills: (SkillDto & {
    /** Tasks assigned to the skill in past papers. */
    tasks: { read: number; rules: number };
    /** The weakest prerequisite in the way, if any. */
    blockedBy: string | null;
    /** Skills that build on this one, within the goal. */
    unlocks: string[];
    /** Open work from the teacher names it. */
    assigned: boolean;
    focus: 'difficulty' | 'covered' | null;
    inSchool: boolean;
  })[];
  /** The best next steps, the first being what "continue" does. */
  next: NextStepDto[];
  diagnostic: { done: boolean; skipped: boolean; count: number; lastAt: number | null; running: string | null };
}

// --------------------------------------------------------------------------- diagnostic

export interface DiagnosticDto {
  id: string;
  goal: GoalId;
  runId: string;
  startedAt: number;
  finishedAt: number | null;
  items: {
    problemId: string;
    skill: string;
    title: L;
    level: Level;
    stage: DiagnosticStage;
    anchor: string;
    outcome: DiagnosticOutcome;
    seconds: number;
    error: ErrorType | null;
  }[];
  verdicts: { skill: string; title: L; verdict: DiagnosticVerdict }[];
  /** Skills that were not asked and are presumed from their neighbours. */
  presumed: { id: string; title: L; direction: 'up' | 'down' }[];
  counts: { asked: number; correct: number; skipped: number };
}

// ----------------------------------------------------------------------------- teaching

export interface WeekFiguresDto {
  problems: number;
  solved: number;
  /** Right at the first submission. */
  firstTry: number;
  /** Right at the first submission and without a hint. */
  unaided: number;
  hinted: number;
  /** Sum of the time recorded on problems; a floor on time spent, not a measure of it. */
  minutes: number;
  activeDays: number;
  sessions: number;
}

/** Something about a student that deserves a look, with what it rests on. */
export interface AttentionDto {
  kind:
    | 'no-diagnostic'
    | 'inactive'
    | 'review-failed'
    | 'recurring-error'
    | 'misconception'
    | 'stuck'
    | 'neglected'
    | 'overdue-assignment'
    | 'guessing'
    | 'hint-reliance';
  skill: { id: string; title: L } | null;
  error: ErrorType | null;
  /** The figure behind it: days, errors, attempts. */
  count: number;
}

/** The most useful next thing for the teacher to do, by a stated rule. */
export interface InterventionDto {
  kind:
    'run-diagnostic' | 'explain' | 'assign-remediation' | 'assign-review' | 'timed-test' | 'check-in' | 'keep-going';
  skill: { id: string; title: L } | null;
  error: ErrorType | null;
  /** The rule that fired, as a code the interface words. */
  reason: string;
}

export interface StudentSummaryDto {
  username: string;
  name: string;
  goal: { id: GoalId; kind: 'school' | 'entrance'; title: L; short: L };
  examDay: string | null;
  daysLeft: number | null;
  lastActiveAt: number | null;
  week: WeekFiguresDto;
  previousWeek: WeekFiguresDto;
  /** Null for the school goal, which has no examination to be ready for. */
  readiness: ReadinessDto | null;
  attention: AttentionDto[];
  intervention: InterventionDto;
  openAssignments: number;
  diagnosed: boolean;
  /** Skills by path state. */
  paths: Record<PathState, number>;
}

export interface NoteDto {
  id: string;
  student: string;
  skill: { id: string; title: L } | null;
  body: string;
  createdAt: number;
  updatedAt: number;
}

/** One problem of a student's history, with everything that was typed. */
export interface HistoryItemDto {
  problemId: string;
  at: number;
  skill: string;
  title: L;
  level: Level;
  context: PracticeContext;
  purpose: Purpose | null;
  prompt: L;
  figure: FigureSpec | null;
  status: 'solved' | 'failed' | 'skipped';
  firstTry: boolean;
  hints: number;
  /** Asked the AI tutor while the problem was open. */
  tutor: boolean;
  seconds: number;
  estSeconds: number;
  confidence: 'sure' | 'think' | 'guess' | null;
  error: ErrorType | null;
  errorConfirmed: boolean;
  note: L | null;
  /** Every submission, in order; `text` where the input is not readable by itself. */
  inputs: { input: string; text: L | null; verdict: string; at: number }[];
  answerTex: L;
  answerText: L | null;
}

export interface MisconceptionDto {
  skill: { id: string; title: L };
  /** What the wrong answers have in common, as the content describes it. */
  note: L;
  error: ErrorType;
  count: number;
  lastAt: number;
}

export interface StudentDetailDto extends StudentSummaryDto {
  skills: SkillDto[];
  /** The best next steps the selection would take: the student's current path. */
  path: NextStepDto[];
  areas: AnalyticsDto['areas'];
  timed: AnalyticsDto['timed'];
  totals: AnalyticsDto['totals'] & { firstTry: number; hinted: number; guessed: number };
  weekly: (WeekFiguresDto & { week: string })[];
  /**
   * Errors by kind, counting only those whose kind rests on something: confirmed by the
   * learner, a known wrong answer or pattern, or an answer that came far too fast.
   */
  errors: { type: ErrorType; family: ErrorFamily; recent: number; previous: number }[];
  /** Errors whose kind could not be told from the answer and was not confirmed. */
  errorsUndetermined: { recent: number; previous: number };
  misconceptions: MisconceptionDto[];
  /** Tested skills not touched for a long time, or never. */
  neglected: { id: string; title: L; weight: number; daysSince: number | null }[];
  strongest: { id: string; title: L; level: MasteryLevel }[];
  diagnostics: DiagnosticDto[];
  assignments: AssignmentDto[];
  focus: FocusDto[];
  exams: ExamListItemDto[];
  heatmap: DayCellDto[];
  recent: RecentItemDto[];
  inSchool: string[];
  sessionMinutes: number;
  notes: NoteDto[];
  sessions: TeachSessionSummaryDto[];
}

/** Two or more students beside each other, skill by skill. Deliberately without a total. */
export interface CompareDto {
  students: StudentSummaryDto[];
  skills: {
    id: string;
    title: L;
    area: Area;
    cells: Record<
      string,
      { level: MasteryLevel; path: PathState; role: SkillRole | null; weight: number; attempts: number } | null
    >;
  }[];
  weekly: Record<string, (WeekFiguresDto & { week: string })[]>;
}

// --------------------------------------------------------------------- tutoring sessions

export const SESSION_OUTCOMES = ['independent', 'helped', 'not-yet'] as const;
/** How a problem went in a session, as the teacher saw it. */
export type SessionOutcome = (typeof SESSION_OUTCOMES)[number];

export interface TeachItemDto {
  id: string;
  skill: string;
  title: L;
  generator: string;
  seed: number;
  level: Level;
  outcome: SessionOutcome | null;
  note: string;
  at: number;
}

/** A problem shown in a session: the teacher sees the solution, and decides when to show it. */
export interface TeachProblemDto {
  item: TeachItemDto;
  prompt: L;
  figure: FigureSpec | null;
  answer: PublicAnswerSpec;
  hints: L[];
  solution: SolutionStep[];
  answerTex: L;
  estSeconds: number;
  misconceptions: { note: L; error: ErrorType }[];
}

export interface TeachBriefDto {
  strongest: { id: string; title: L; level: MasteryLevel }[];
  gaps: { id: string; title: L; weight: number; level: MasteryLevel; holdsUp: { id: string; title: L }[] }[];
  mistakes: MistakeDto[];
  misconceptions: MisconceptionDto[];
  priorities: NextStepDto[];
  /** A suggested order for the session, with a rough time for each step. */
  sequence: {
    kind: 'warm-up' | 'explain' | 'practise' | 'check' | 'homework';
    skill: { id: string; title: L } | null;
    minutes: number;
    /** The rule behind the step, as a code the interface words. */
    reason: string;
    error: ErrorType | null;
  }[];
  since: {
    lastSessionAt: number | null;
    /** What the last session set down as next priorities. */
    next: string;
    homework: AssignmentDto[];
    problems: number;
    activeDays: number;
  };
}

export interface TeachWrapDto {
  covered: string[];
  improved: string[];
  hard: string[];
  misconceptions: string;
  homework: { skills: string[]; minutes: number; dueDay: string | null; note: string } | null;
  next: string;
  summary: string;
}

export interface TeachSessionSummaryDto {
  id: string;
  student: string;
  startedAt: number;
  finishedAt: number | null;
  items: number;
  covered: { id: string; title: L }[];
  next: string;
}

export interface TeachSessionDto {
  id: string;
  student: string;
  startedAt: number;
  finishedAt: number | null;
  brief: TeachBriefDto;
  items: TeachItemDto[];
  wrap: TeachWrapDto | null;
  /** Skills that can be shown: the student's goal, with titles and the levels on offer. */
  skills: { id: string; title: L; area: Area; levels: Level[]; level: MasteryLevel; path: PathState }[];
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
