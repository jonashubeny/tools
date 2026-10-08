import type { Locale } from '@lemma/core';

const tag = (locale: Locale): string => (locale === 'cs' ? 'cs-CZ' : 'en-GB');

/** A number the way the locale writes it: decimal comma in Czech. */
export function num(value: number, locale: Locale, digits = 0): string {
  return new Intl.NumberFormat(tag(locale), { maximumFractionDigits: digits, minimumFractionDigits: 0 }).format(value);
}

/** A share between 0 and 1 as a percentage. Czech puts a space before the sign. */
export function pct(value: number | null | undefined, locale: Locale, digits = 0): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  return `${num(value * 100, locale, digits)}${locale === 'cs' ? ' %' : '%'}`;
}

/** Parse a study day ("YYYY-MM-DD") as a local-noon date, safe from time-zone drift. */
export function dayToDate(day: string): Date {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1, 12);
}

export function formatDay(day: string, locale: Locale, style: 'short' | 'long' | 'weekday' = 'short'): string {
  const date = dayToDate(day);
  if (style === 'long')
    return new Intl.DateTimeFormat(tag(locale), {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(date);
  if (style === 'weekday')
    return new Intl.DateTimeFormat(tag(locale), { weekday: 'short', day: 'numeric', month: 'numeric' }).format(date);
  return new Intl.DateTimeFormat(tag(locale), { day: 'numeric', month: 'numeric', year: 'numeric' }).format(date);
}

/** Day and month of a study day: a compact axis label. */
export function formatDayShort(day: string, locale: Locale): string {
  return new Intl.DateTimeFormat(tag(locale), { day: 'numeric', month: 'numeric' }).format(dayToDate(day));
}

export function formatDateTime(at: number, locale: Locale): string {
  return new Intl.DateTimeFormat(tag(locale), {
    day: 'numeric',
    month: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(at));
}

/** Day and month of a moment, in the browser's time zone. */
export function formatDate(at: number, locale: Locale): string {
  return new Intl.DateTimeFormat(tag(locale), { day: 'numeric', month: 'numeric' }).format(new Date(at));
}

export function formatTime(at: number, locale: Locale): string {
  return new Intl.DateTimeFormat(tag(locale), { hour: '2-digit', minute: '2-digit' }).format(new Date(at));
}

export function monthLabel(day: string, locale: Locale): string {
  return new Intl.DateTimeFormat(tag(locale), { month: 'short' }).format(dayToDate(day));
}

/** "1:05" for a stopwatch. */
export function clock(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  const minutes = Math.floor(s / 60);
  return `${minutes}:${String(s % 60).padStart(2, '0')}`;
}

/** A duration in words: "45 s", "3 min", "1 h 20 min". */
export function duration(totalSeconds: number, locale: Locale): string {
  const s = Math.max(0, Math.round(totalSeconds));
  if (s < 60) return `${s} s`;
  const minutes = Math.round(s / 60);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  const h = locale === 'cs' ? 'h' : 'h';
  return rest === 0 ? `${hours} ${h}` : `${hours} ${h} ${rest} min`;
}

/** Relative day wording for due dates and tests. */
export function inDays(days: number, locale: Locale): string {
  const n = Math.round(days);
  if (locale === 'cs') {
    if (n === 0) return 'dnes';
    if (n === 1) return 'zítra';
    if (n === -1) return 'včera';
    if (n > 1) return n < 5 ? `za ${n} dny` : `za ${n} dní`;
    return `před ${-n} dny`;
  }
  if (n === 0) return 'today';
  if (n === 1) return 'tomorrow';
  if (n === -1) return 'yesterday';
  return n > 1 ? `in ${n} days` : `${-n} days ago`;
}

/** Czech plural forms: 1 úloha, 2–4 úlohy, 5+ úloh. */
export function plural(n: number, locale: Locale, cs: [string, string, string], en: [string, string]): string {
  if (locale === 'cs') return `${n} ${n === 1 ? cs[0] : n >= 2 && n <= 4 ? cs[1] : cs[2]}`;
  return `${n} ${n === 1 ? en[0] : en[1]}`;
}
