import { type Card, type Grade, Rating, State, createEmptyCard, fsrs, generatorParameters } from 'ts-fsrs';
import { DAY_MS, RETENTION } from './constants';

/**
 * Review scheduling. Each skill is one card in an FSRS scheduler.
 *
 * FSRS is wrapped here so that nothing else in the code base depends on the library:
 * its parameters were fitted on flashcard recall, not on procedural skills, and the
 * scheduler may well be replaced once there is real data to judge it by.
 */

export type ReviewRating = 'again' | 'hard' | 'good' | 'easy';

/** Serialisable scheduler state for one skill; all times are UTC milliseconds. */
export interface ReviewCard {
  due: number;
  stability: number;
  difficulty: number;
  reps: number;
  lapses: number;
  state: number;
  elapsedDays: number;
  scheduledDays: number;
  learningSteps: number;
  lastReview: number | null;
}

const engine = fsrs(
  generatorParameters({
    request_retention: RETENTION.TARGET,
    maximum_interval: RETENTION.MAX_INTERVAL_DAYS,
    // Deterministic intervals: the app has too few cards for due-date clumping to matter,
    // and reproducible schedules make the model testable.
    enable_fuzz: false,
    // Long-term scheduling only; the minute-scale learning steps are for flashcards.
    enable_short_term: false,
  }),
);

const RATING: Readonly<Record<ReviewRating, Grade>> = {
  again: Rating.Again,
  hard: Rating.Hard,
  good: Rating.Good,
  easy: Rating.Easy,
};

function toCard(card: ReviewCard): Card {
  return {
    due: new Date(card.due),
    stability: card.stability,
    difficulty: card.difficulty,
    reps: card.reps,
    lapses: card.lapses,
    state: card.state as State,
    elapsed_days: card.elapsedDays,
    scheduled_days: card.scheduledDays,
    learning_steps: card.learningSteps,
    last_review: card.lastReview === null ? undefined : new Date(card.lastReview),
  };
}

function fromCard(card: Card): ReviewCard {
  return {
    due: card.due.getTime(),
    stability: card.stability,
    difficulty: card.difficulty,
    reps: card.reps,
    lapses: card.lapses,
    state: card.state,
    elapsedDays: card.elapsed_days,
    scheduledDays: card.scheduled_days,
    learningSteps: card.learning_steps,
    lastReview: card.last_review ? card.last_review.getTime() : null,
  };
}

export function newCard(now: number): ReviewCard {
  return fromCard(createEmptyCard(new Date(now)));
}

/** Apply one review and return the rescheduled card. */
export function reviewCard(card: ReviewCard | null, rating: ReviewRating, now: number): ReviewCard {
  const current = toCard(card ?? newCard(now));
  return fromCard(engine.next(current, new Date(now), RATING[rating]).card);
}

/** Predicted probability of recalling the skill right now; null before any review. */
export function retrievability(card: ReviewCard | null, now: number): number | null {
  if (!card || card.lastReview === null || card.stability <= 0) return null;
  const value = engine.get_retrievability(toCard(card), new Date(now), false);
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : null;
}

export function isDue(card: ReviewCard | null, now: number): boolean {
  return card !== null && card.lastReview !== null && card.due <= now;
}

/** Days until (positive) or since (negative) the review is due. */
export function dueInDays(card: ReviewCard | null, now: number): number | null {
  if (!card || card.lastReview === null) return null;
  return (card.due - now) / DAY_MS;
}

export interface RatingInput {
  solved: boolean;
  /** First try, no hints. */
  unaided: boolean;
  seconds: number;
  expectedSeconds: number;
  confidence?: 'sure' | 'think' | 'guess';
}

/** Map how a problem went to a review rating. */
export function ratingFor(attempt: RatingInput): ReviewRating {
  if (!attempt.solved) return 'again';
  if (!attempt.unaided) return 'hard';
  const ratio = attempt.expectedSeconds > 0 ? attempt.seconds / attempt.expectedSeconds : 1;
  if (ratio > RETENTION.HARD_SPEED) return 'hard';
  if (ratio <= RETENTION.EASY_SPEED && attempt.confidence === 'sure') return 'easy';
  return 'good';
}
