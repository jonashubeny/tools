/**
 * Study days.
 *
 * Streaks and the heatmap count *study days*, not calendar dates: a day starts at a
 * configurable hour (04:00 by default) in the learner's time zone, so a session that runs
 * past midnight still belongs to the evening it started in.
 *
 * A study day is identified by an ISO date string, e.g. "2026-10-07". Arithmetic on those
 * strings is done in UTC and never touches a time zone again.
 */

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatterFor(timeZone: string): Intl.DateTimeFormat {
  let formatter = formatters.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    formatters.set(timeZone, formatter);
  }
  return formatter;
}

/** The study day an instant belongs to. */
export function studyDay(ms: number, timeZone: string, rolloverHour = 4): string {
  const shifted = new Date(ms - rolloverHour * 3_600_000);
  const parts = formatterFor(timeZone).formatToParts(shifted);
  const get = (type: string): string => parts.find((part) => part.type === type)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

export function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-CA', { timeZone });
    return true;
  } catch {
    return false;
  }
}

const DAY_MS = 86_400_000;

function toUtc(day: string): number {
  const [y, m, d] = day.split('-').map(Number) as [number, number, number];
  return Date.UTC(y, m - 1, d);
}

function fromUtc(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

export function isDay(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(toUtc(value));
}

export function addDays(day: string, count: number): string {
  return fromUtc(toUtc(day) + count * DAY_MS);
}

/** Whole days from `from` to `to` (positive when `to` is later). */
export function daysBetween(from: string, to: string): number {
  return Math.round((toUtc(to) - toUtc(from)) / DAY_MS);
}

/** 0 = Monday … 6 = Sunday. */
export function weekdayIndex(day: string): number {
  return (new Date(toUtc(day)).getUTCDay() + 6) % 7;
}

/** The Monday of the week containing `day`. */
export function weekStart(day: string): string {
  return addDays(day, -weekdayIndex(day));
}

/** Every day from `from` to `to`, inclusive. */
export function dayRange(from: string, to: string): string[] {
  const out: string[] = [];
  for (let day = from; day <= to; day = addDays(day, 1)) out.push(day);
  return out;
}
