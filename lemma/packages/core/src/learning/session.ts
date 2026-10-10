import { daysBetween } from '../time';
import type { ErrorType } from './errors';
import type { MasteryLevel } from './mastery';
import type { Purpose } from './priority';

/**
 * The daily session planner: turns the learner's state and a time budget into an ordered
 * list of blocks, each with a machine-readable reason the interface can explain.
 * See docs/learning-model.md §8.
 *
 * Pure and deterministic: the same input always produces the same plan.
 */

export type BlockKind =
  | 'review' // interleaved retrieval of skills that are due
  | 'lesson' // new material for the current topic
  | 'practice' // adaptive practice on one skill
  | 'prereq' // shore up a weak prerequisite first
  | 'challenge' // one harder problem
  | 'drill' // Error Lab drill on the dominant error type
  | 'mock' // short timed test before a real one
  | 'experiment' // optional Lab exploration
  | 'diagnostic' // the placement test
  | 'adaptive' // a session whose every problem is chosen when it is due
  | 'assigned'; // work set by the teacher

export type ReasonCode =
  | 'review-due'
  | 'review-test'
  | 'lesson-next'
  | 'practice-weakest'
  | 'practice-test'
  | 'practice-keep-fresh'
  | 'prereq-weak'
  | 'challenge-ready'
  | 'drill-pattern'
  | 'mock-before-test'
  | 'experiment-see-it'
  | 'diagnostic-first'
  | 'adaptive-mix'
  | 'assigned-by-teacher'
  | 'mock-ready';

export interface PlanBlock {
  id: string;
  kind: BlockKind;
  minutes: number;
  /** Skills the block works on. */
  skills: string[];
  reason: { code: ReasonCode; data: Record<string, string | number> };
  optional: boolean;
  /** For drills. */
  errorType?: ErrorType;
  /** For experiments. */
  lab?: string;
  /** For assigned blocks: the assignment it carries out. */
  assignment?: string;
}

export interface PlanSkill {
  id: string;
  /** Syllabus topic number, or null for non-school skills. */
  topic: number | null;
  /** Position in the authored order — earlier means more basic. */
  order: number;
  level: MasteryLevel;
  theta: number;
  attempts: number;
  /** A scheduled review is due. */
  due: boolean;
  /** How many days overdue (0 if not due). */
  overdueDays: number;
  prereqs: string[];
  hasLesson: boolean;
  lessonDone: boolean;
  /** Problems at level ≥ 4 exist for this skill. */
  hasHard: boolean;
  /** A Lab tool exists for this skill. */
  lab?: string;
}

export interface UpcomingTest {
  /** Study day of the test. */
  day: string;
  topics: number[];
  title?: string;
}

export interface PlanInput {
  day: string;
  minutes: number;
  skills: readonly PlanSkill[];
  /** The syllabus topic the class is on; null if not set. */
  currentTopic: number | null;
  tests: readonly UpcomingTest[];
  /** The most frequent recent error type, when it is frequent enough to drill. */
  errorFocus: { type: ErrorType; count: number } | null;
}

export interface Plan {
  day: string;
  minutes: number;
  blocks: PlanBlock[];
  /** The test that shaped this plan, if any. */
  test: { day: string; inDays: number; title?: string } | null;
  /** The topic the main block belongs to. */
  focusTopic: number | null;
}

const FAMILIAR: MasteryLevel = 3;
const PROFICIENT: MasteryLevel = 4;

function nextTest(input: PlanInput): { test: UpcomingTest; inDays: number } | null {
  const upcoming = input.tests
    .map((test) => ({ test, inDays: daysBetween(input.day, test.day) }))
    .filter((entry) => entry.inDays >= 0 && entry.inDays <= 7)
    .sort((a, b) => a.inDays - b.inDays);
  return upcoming[0] ?? null;
}

/** The topic to work on: the set one, else the first with anything below proficient. */
function focusTopic(input: PlanInput): number | null {
  if (input.currentTopic !== null && input.skills.some((skill) => skill.topic === input.currentTopic)) {
    return input.currentTopic;
  }
  const topics = [...new Set(input.skills.map((skill) => skill.topic).filter((t): t is number => t !== null))].sort(
    (a, b) => a - b,
  );
  return (
    topics.find((topic) => input.skills.some((s) => s.topic === topic && s.level < PROFICIENT)) ?? topics[0] ?? null
  );
}

export function composePlan(input: PlanInput): Plan {
  const minutes = Math.max(5, Math.round(input.minutes));
  const byId = new Map(input.skills.map((skill) => [skill.id, skill]));
  const blocks: PlanBlock[] = [];
  let remaining = minutes;
  let counter = 0;
  const add = (block: Omit<PlanBlock, 'id' | 'optional'> & { optional?: boolean }): void => {
    blocks.push({ ...block, id: `b${++counter}`, optional: block.optional ?? false });
    if (!block.optional) remaining -= block.minutes;
  };

  const upcoming = nextTest(input);
  const testTopics = new Set(upcoming?.test.topics ?? []);
  const testSkills = input.skills.filter((skill) => skill.topic !== null && testTopics.has(skill.topic));
  const preparing = upcoming !== null && testSkills.length > 0;
  const currentTopic = focusTopic(input);
  // The chapter the plan is "about": the current one, unless a test is near that does not cover it.
  let topic =
    preparing && upcoming && (currentTopic === null || !testTopics.has(currentTopic))
      ? (upcoming.test.topics[0] ?? currentTopic)
      : currentTopic;

  // ---- the day before (or of) a test: consolidate, add nothing new -------------------
  if (upcoming && upcoming.inDays <= 1 && testSkills.length > 0) {
    if (input.errorFocus) {
      add({
        kind: 'drill',
        minutes: Math.max(5, Math.round(minutes * 0.4)),
        skills: [],
        errorType: input.errorFocus.type,
        reason: { code: 'drill-pattern', data: { errorType: input.errorFocus.type, count: input.errorFocus.count } },
      });
    }
    add({
      kind: 'review',
      minutes: Math.max(5, remaining),
      skills: testSkills.map((skill) => skill.id),
      reason: { code: 'review-test', data: { inDays: upcoming.inDays, count: testSkills.length } },
    });
    return {
      day: input.day,
      minutes,
      blocks,
      test: { day: upcoming.test.day, inDays: upcoming.inDays, title: upcoming.test.title },
      focusTopic: topic,
    };
  }

  // ---- 1. reviews that are due --------------------------------------------------------
  const due = input.skills.filter((skill) => skill.due).sort((a, b) => b.overdueDays - a.overdueDays);
  if (due.length > 0) {
    const budget = Math.max(4, Math.round(minutes * 0.25));
    const count = Math.max(1, Math.min(due.length, Math.floor(budget / 2)));
    add({
      kind: 'review',
      minutes: Math.min(budget, count * 2 + 1),
      skills: due.slice(0, count).map((skill) => skill.id),
      reason: {
        code: 'review-due',
        data: { count: due.length, scheduled: count, overdueDays: Math.round(due[0]!.overdueDays) },
      },
    });
  }

  // ---- reserve time for the later blocks so the main block gets what is left -----------
  const wantMock = upcoming !== null && upcoming.inDays <= 3 && minutes >= 30 && testSkills.length > 0;
  const mockMinutes = wantMock ? Math.min(20, Math.round(minutes * 0.4)) : 0;

  // What the main block draws on: everything the test covers when one is near — a test on
  // two chapters must not be prepared from one — otherwise the current chapter.
  const topicSkills = (preparing ? testSkills : input.skills.filter((skill) => skill.topic === topic))
    .slice()
    .sort((a, b) => a.order - b.order);
  const challengeSkill =
    !wantMock && minutes >= 30
      ? topicSkills.filter((s) => s.level >= FAMILIAR && s.hasHard).sort((a, b) => b.theta - a.theta)[0]
      : undefined;
  const challengeMinutes = challengeSkill ? (minutes >= 45 ? 10 : 8) : 0;

  const wantDrill = input.errorFocus !== null && (minutes >= 25 || due.length === 0);
  const drillMinutes = wantDrill ? (minutes >= 45 ? 8 : 6) : 0;

  let mainMinutes = remaining - mockMinutes - challengeMinutes - drillMinutes;
  // Never squeeze the main block below a useful size: drop extras in reverse priority.
  let keepDrill = wantDrill;
  let keepChallenge = challengeSkill !== undefined;
  if (mainMinutes < 8 && keepDrill) {
    keepDrill = false;
    mainMinutes += drillMinutes;
  }
  if (mainMinutes < 8 && keepChallenge) {
    keepChallenge = false;
    mainMinutes += challengeMinutes;
  }
  mainMinutes = Math.max(5, mainMinutes);

  // ---- 2. the current topic -----------------------------------------------------------
  if (topicSkills.length > 0) {
    const unlearned = topicSkills.find((skill) => skill.attempts === 0 && skill.hasLesson && !skill.lessonDone);
    const weakest = [...topicSkills].sort((a, b) => a.level - b.level || a.theta - b.theta || a.order - b.order)[0]!;
    const target = unlearned ?? weakest;
    // When the block is about one skill, the plan is about that skill's chapter.
    const single = unlearned !== undefined || !topicSkills.every((skill) => skill.level >= PROFICIENT);
    if (single && target.topic !== null) topic = target.topic;

    const weakPrereq = target.prereqs
      .map((id) => byId.get(id))
      .filter((skill): skill is PlanSkill => skill !== undefined && skill.level < FAMILIAR)
      .sort((a, b) => a.level - b.level || a.theta - b.theta)[0];

    let forTarget = mainMinutes;
    if (weakPrereq && mainMinutes >= 10) {
      const prereqMinutes = Math.max(5, Math.round(mainMinutes * 0.4));
      forTarget = mainMinutes - prereqMinutes;
      add({
        kind: 'prereq',
        minutes: prereqMinutes,
        skills: [weakPrereq.id],
        reason: { code: 'prereq-weak', data: { skill: target.id, prereq: weakPrereq.id, level: weakPrereq.level } },
      });
    }

    if (unlearned) {
      add({
        kind: 'lesson',
        minutes: forTarget,
        skills: [unlearned.id],
        reason: { code: 'lesson-next', data: { skill: unlearned.id, topic: topic ?? 0 } },
      });
    } else if (topicSkills.every((skill) => skill.level >= PROFICIENT)) {
      // Nothing is weak. Before a test that means rehearsing all of it mixed together;
      // otherwise a little practice that keeps the chapter alive.
      if (preparing && upcoming) {
        add({
          kind: 'review',
          minutes: forTarget,
          skills: topicSkills.map((skill) => skill.id),
          reason: { code: 'review-test', data: { inDays: upcoming.inDays, count: topicSkills.length } },
        });
      } else {
        add({
          kind: 'practice',
          minutes: forTarget,
          skills: topicSkills.map((skill) => skill.id),
          reason: { code: 'practice-keep-fresh', data: { topic: topic ?? 0 } },
        });
      }
    } else {
      add({
        kind: 'practice',
        minutes: forTarget,
        skills: [weakest.id],
        reason:
          preparing && upcoming
            ? { code: 'practice-test', data: { skill: weakest.id, level: weakest.level, inDays: upcoming.inDays } }
            : { code: 'practice-weakest', data: { skill: weakest.id, level: weakest.level, topic: topic ?? 0 } },
      });
    }
  }

  // ---- 3. challenge or mock -----------------------------------------------------------
  if (wantMock && upcoming) {
    add({
      kind: 'mock',
      minutes: mockMinutes,
      skills: testSkills.map((skill) => skill.id),
      reason: { code: 'mock-before-test', data: { inDays: upcoming.inDays } },
    });
  } else if (keepChallenge && challengeSkill) {
    add({
      kind: 'challenge',
      minutes: challengeMinutes,
      skills: [challengeSkill.id],
      reason: { code: 'challenge-ready', data: { skill: challengeSkill.id, level: challengeSkill.level } },
    });
  }

  // ---- 4. error drill -----------------------------------------------------------------
  if (keepDrill && input.errorFocus) {
    add({
      kind: 'drill',
      minutes: drillMinutes,
      skills: [],
      errorType: input.errorFocus.type,
      reason: { code: 'drill-pattern', data: { errorType: input.errorFocus.type, count: input.errorFocus.count } },
    });
  }

  // ---- 5. optional experiment ---------------------------------------------------------
  if (minutes >= 45) {
    const withLab = topicSkills.find((skill) => skill.lab !== undefined);
    if (withLab?.lab) {
      add({
        kind: 'experiment',
        minutes: 10,
        skills: [withLab.id],
        lab: withLab.lab,
        optional: true,
        reason: { code: 'experiment-see-it', data: { skill: withLab.id, tool: withLab.lab } },
      });
    }
  }

  return {
    day: input.day,
    minutes,
    blocks,
    test: upcoming ? { day: upcoming.test.day, inDays: upcoming.inDays, title: upcoming.test.title } : null,
    focusTopic: topic,
  };
}

// ------------------------------------------------------------------- examination goals

/** Work the teacher set, as the planner sees it. */
export interface PlanAssignment {
  id: string;
  kind: 'practice' | 'review' | 'remediation' | 'lesson' | 'test';
  skills: string[];
  minutes: number;
}

export interface GoalPlanInput {
  day: string;
  minutes: number;
  /** A placement test has been finished. */
  diagnosed: boolean;
  /** Skills of the goal with any evidence. */
  skillsWithEvidence: number;
  assignments: readonly PlanAssignment[];
  /** The best-scoring skills with what they would be practised for. */
  top: readonly { id: string; purpose: Purpose }[];
  dueCount: number;
  errorFocus: { type: ErrorType; count: number } | null;
  /** The practice test: whether the readiness report calls for one, and how long since the last. */
  mock: { ready: boolean; daysSinceLast: number | null };
  /** The examination itself. */
  exam: { day: string; title?: string } | null;
}

/** A practice test at most this often. */
const MOCK_EVERY_DAYS = 7;

/**
 * The block that carries out an assignment. It is named after the assignment, not
 * numbered, so that a run finds it again however the plan around it has changed.
 */
export function assignedBlock(assignment: PlanAssignment, minutes = assignment.minutes): PlanBlock {
  return {
    id: `assigned:${assignment.id}`,
    kind: assignment.kind === 'test' ? 'mock' : 'assigned',
    minutes,
    skills: assignment.skills,
    assignment: assignment.id,
    optional: false,
    reason: { code: 'assigned-by-teacher', data: { kind: assignment.kind, count: assignment.skills.length } },
  };
}

/**
 * The daily plan of a learner preparing for an examination. There is no "chapter the
 * class is on" to hang it on: the main block is an adaptive session, which chooses each
 * problem by the scores of the moment (priority.ts). Around it: the placement test while
 * there is none, whatever the teacher assigned, a drill against a recurring error, and —
 * when the readiness report says the base is there — a timed practice test.
 */
export function composeGoalPlan(input: GoalPlanInput): Plan {
  const minutes = Math.max(5, Math.round(input.minutes));
  const blocks: PlanBlock[] = [];
  let remaining = minutes;
  // Blocks are named for what they are, not numbered: the plan is composed again whenever
  // the teacher sets something, and a run already under way has to find its block again.
  const add = (id: string, block: Omit<PlanBlock, 'id' | 'optional'> & { optional?: boolean }): void => {
    blocks.push({ ...block, id, optional: block.optional ?? false });
    if (!block.optional) remaining -= block.minutes;
  };
  const inDays = input.exam ? daysBetween(input.day, input.exam.day) : null;
  const test =
    input.exam && inDays !== null && inDays >= 0 ? { day: input.exam.day, inDays, title: input.exam.title } : null;

  // ---- 1. placement: without it everything starts from the very beginning ------------
  if (!input.diagnosed) {
    add('diagnostic', {
      kind: 'diagnostic',
      minutes: Math.min(20, minutes),
      skills: [],
      reason: { code: 'diagnostic-first', data: { known: input.skillsWithEvidence } },
    });
  }

  // ---- 2. what the teacher set -------------------------------------------------------
  for (const assignment of input.assignments) {
    if (remaining < 5 && blocks.length > 0) break;
    const block = assignedBlock(assignment, Math.max(5, Math.min(assignment.minutes, Math.max(5, remaining))));
    blocks.push(block);
    remaining -= block.minutes;
  }

  // ---- 3. the adaptive session -------------------------------------------------------
  const wantDrill = input.errorFocus !== null && minutes >= 25;
  const drillMinutes = wantDrill ? (minutes >= 45 ? 8 : 6) : 0;
  const adaptiveMinutes = remaining - drillMinutes;
  if (adaptiveMinutes >= 5 && input.top.length > 0) {
    const data: Record<string, string | number> = { due: input.dueCount, count: input.top.length };
    input.top.slice(0, 3).forEach((entry, index) => {
      data[`s${index + 1}`] = entry.id;
      data[`p${index + 1}`] = entry.purpose;
    });
    add('adaptive', {
      kind: 'adaptive',
      minutes: adaptiveMinutes,
      skills: input.top.slice(0, 3).map((entry) => entry.id),
      reason: { code: 'adaptive-mix', data },
    });
  }

  // ---- 4. a recurring error ----------------------------------------------------------
  if (wantDrill && input.errorFocus && remaining >= 5) {
    add('drill', {
      kind: 'drill',
      minutes: drillMinutes,
      skills: [],
      errorType: input.errorFocus.type,
      reason: { code: 'drill-pattern', data: { errorType: input.errorFocus.type, count: input.errorFocus.count } },
    });
  }

  // ---- 5. a timed practice test, offered beside the day's work -----------------------
  const mockDue = input.mock.daysSinceLast === null || input.mock.daysSinceLast >= MOCK_EVERY_DAYS;
  if (input.mock.ready && mockDue && !blocks.some((block) => block.kind === 'mock')) {
    add('mock', {
      kind: 'mock',
      minutes: 60,
      skills: [],
      optional: true,
      reason: { code: 'mock-ready', data: { inDays: inDays ?? -1, since: input.mock.daysSinceLast ?? -1 } },
    });
  }

  return { day: input.day, minutes, blocks, test, focusTopic: null };
}
