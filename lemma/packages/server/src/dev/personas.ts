import {
  type AnswerSpec,
  type ErrorType,
  type GoalId,
  type Level,
  type ProblemDto,
  type Rng,
  type StartRunResponse,
  LEVEL_DIFFICULTY,
  canonicalInput,
  createRng,
} from '@lemma/core';
import { type Ctx, setOnboarded, updateSettings } from '../services/context';
import { regeneratePlan } from '../services/plan';
import {
  type ProblemRow,
  getProblemRow,
  nextInRun,
  revealSolution,
  snapshotOf,
  startRun,
  submitAnswer,
  takeHint,
} from '../services/practice';

/**
 * Fictional learners, for tests of the learning engine and for seeding a demonstration
 * instance. Nothing here is used by the running application.
 *
 * A persona is a rule for answering: how likely a right first answer is for a skill at a
 * level, and what kind of mistake the learner tends to make. Histories are not written
 * down — they are produced by letting a persona work through the application itself, so
 * what ends up in a database got there the way real use would put it there: through the
 * real selection, the real answer checking and the real model. Everything a persona does
 * is seeded: the same persona and seed make the same decisions.
 */

const DAY = 86_400_000;

/** An answer that is well-formed and certainly wrong. */
export function wrongAnswerFor(spec: AnswerSpec): string {
  switch (spec.kind) {
    case 'number':
    case 'expr':
    case 'complex':
      return `(${spec.value}) + 7`;
    case 'set':
      return '{123456}';
    case 'interval':
      return '(123456; 123457)';
    case 'point':
      return `[${spec.coords.map(() => '123456').join('; ')}]`;
    case 'choice':
      return spec.options.find((option) => !spec.correct.includes(option.id))!.id;
    case 'spot':
      return String((spec.wrongLine + 1) % spec.lines.length);
    case 'self':
      return 'no';
  }
}

export interface Persona {
  name: string;
  /** Ability per skill on the model's own scale; `base` for skills not listed. */
  base: number;
  skills?: Readonly<Record<string, number>>;
  /** Skills whose id starts with one of these get this ability instead. */
  prefixes?: Readonly<Record<string, number>>;
  /** When wrong, give the wrong answer of this kind where the problem knows one. */
  errorBias?: ErrorType;
  /** Takes a hint before answering this often. */
  hintRate?: number;
  /** Says "I guessed" on right answers this often. */
  guessRate?: number;
  /** Time taken, as a share of the expected time. */
  pace?: number;
}

const abilityOf = (persona: Persona, skill: string): number => {
  if (persona.skills?.[skill] !== undefined) return persona.skills[skill]!;
  for (const [prefix, value] of Object.entries(persona.prefixes ?? {})) if (skill.startsWith(prefix)) return value;
  return persona.base;
};

/** How likely the persona is to answer right at the first try. */
export const chanceOfSuccess = (persona: Persona, skill: string, level: number): number =>
  1 / (1 + Math.exp(LEVEL_DIFFICULTY[level as Level] - abilityOf(persona, skill)));

// ------------------------------------------------------------------------------ personas

/** Ema, ninth grade: has never been sure of fractions, and everything built on them wobbles. */
export const EMA: Persona = {
  name: 'Ema',
  base: 1.2,
  prefixes: { 'frac.': -1.6, 'pct.': -0.6, 'ratio.': -0.4 },
  pace: 1.2,
};

/** Vojta, ninth grade: strong across the board and quick. */
export const VOJTA: Persona = { name: 'Vojta', base: 3.2, pace: 0.8 };

/** Klára, ninth grade: understands the material and keeps losing signs. */
export const KLARA: Persona = { name: 'Klára', base: 1.6, errorBias: 'sign', pace: 0.9 };

/** Matěj, ninth grade: a beginner in everything the examination asks. */
export const MATEJ: Persona = { name: 'Matěj', base: -1.2, hintRate: 0.3, pace: 1.4 };

// --------------------------------------------------------------------------- answering

export const rightInput = (row: ProblemRow): string => canonicalInput(snapshotOf(row).answer);

/** A wrong answer: the persona's typical mistake where the problem knows it, else any wrong one. */
export function wrongInput(row: ProblemRow, bias?: ErrorType): string {
  const snapshot = snapshotOf(row);
  const typical = bias ? (snapshot.misconceptions ?? []).find((entry) => entry.error === bias) : undefined;
  return typical?.answer ?? wrongAnswerFor(snapshot.answer);
}

/** A clock a simulation can move: where one is given, working a problem takes its time. */
export interface Clock {
  advance: (ms: number) => void;
}

export interface Played {
  row: ProblemRow;
  right: boolean;
}

/** Let a persona work one open problem to its end. Returns the resolved row. */
export function play(
  ctx: Ctx,
  problem: ProblemDto,
  persona: Persona,
  rng: Rng,
  force?: boolean,
  clock?: Clock,
): Played {
  let row = getProblemRow(ctx, problem.id);
  const right = force ?? rng.next() < chanceOfSuccess(persona, row.skill, row.level);
  const seconds = Math.max(5, row.est_seconds * (persona.pace ?? 1) * (0.8 + 0.4 * rng.next()));
  // The time spent on the problem passes before the answer is given.
  clock?.advance(Math.round(seconds) * 1000);
  const quiet = row.context === 'exam' || row.context === 'diagnostic';
  if (!quiet && !right && persona.hintRate && rng.next() < persona.hintRate && snapshotOf(row).hints.length > 0)
    takeHint(ctx, row.id);
  if (right) {
    const confidence = persona.guessRate && rng.next() < persona.guessRate ? 'guess' : 'sure';
    submitAnswer(ctx, row.id, { input: rightInput(row), seconds, confidence });
  } else {
    // Wrong until the problem closes; a learner who does not know gives up after the first miss.
    submitAnswer(ctx, row.id, { input: wrongInput(row, persona.errorBias), seconds, confidence: 'think' });
    row = getProblemRow(ctx, row.id);
    if (row.status === 'open') revealSolution(ctx, row.id, seconds);
  }
  return { row: getProblemRow(ctx, row.id), right };
}

/** Play a run to its end. `force` overrides the persona for a problem when it returns a boolean. */
export function playRun(
  ctx: Ctx,
  start: StartRunResponse,
  persona: Persona,
  rng: Rng,
  force?: (row: ProblemRow, index: number) => boolean | undefined,
  clock?: Clock,
): Played[] {
  const played: Played[] = [];
  let step = start;
  for (let guard = 0; guard < 80 && step.problem; guard++) {
    const row = getProblemRow(ctx, step.problem.id);
    played.push(play(ctx, step.problem, persona, rng, force?.(row, played.length), clock));
    step = nextInRun(ctx, step.run.id);
  }
  if (!step.run.finished) throw new Error(`run ${step.run.id} did not finish`);
  return played;
}

/** One adaptive session of `count` problems. */
export const adaptiveSession = (ctx: Ctx, persona: Persona, rng: Rng, count = 10, clock?: Clock): Played[] =>
  playRun(ctx, startRun(ctx, { context: 'adaptive', count }), persona, rng, undefined, clock);

/** Several days of adaptive practice, one session a day, `gapDays` apart. */
export function study(
  h: Clock,
  ctx: Ctx,
  persona: Persona,
  options: { days: number; perDay?: number; gapDays?: number; seed?: number },
): Played[] {
  const rng = createRng(options.seed ?? 1);
  const all: Played[] = [];
  for (let day = 0; day < options.days; day++) {
    all.push(...adaptiveSession(ctx, persona, rng, options.perDay ?? 10));
    h.advance((options.gapDays ?? 1) * DAY);
  }
  return all;
}

/** A learner who has chosen a goal and finished the first-run questions. */
export function withGoal(ctx: Ctx, goal: GoalId, extra: Record<string, unknown> = {}): void {
  updateSettings(ctx, { goal, ...extra });
  setOnboarded(ctx);
  regeneratePlan(ctx);
}
