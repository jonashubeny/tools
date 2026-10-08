import { randomBytes, randomInt } from 'node:crypto';
import { DEFAULT_GRADE_SCALE, isLocale, studyDay, type SettingsDto } from '@lemma/core';
import type { Config } from '../config';
import { type Db, fromJson, toJson } from '../db';

/**
 * What every service needs: the database, the configuration and a clock. The clock is
 * injected so tests can move time; nothing in the services calls Date.now() directly.
 */
export interface Ctx {
  db: Db;
  config: Config;
  now: () => number;
}

export const newId = (): string => randomBytes(9).toString('base64url');

/** A fresh seed for a problem generator. */
export const newSeed = (): number => randomInt(1, 2_147_483_647);

export const today = (ctx: Ctx): string => studyDay(ctx.now(), ctx.config.timeZone, ctx.config.dayStartHour);
export const dayOf = (ctx: Ctx, at: number): string => studyDay(at, ctx.config.timeZone, ctx.config.dayStartHour);

export const DEFAULT_SETTINGS: SettingsDto = {
  name: '',
  locale: 'cs',
  theme: 'dark',
  decimalComma: true,
  sessionMinutes: 30,
  weekGoal: 4,
  confidencePrompt: true,
  currentTopic: null,
  tests: [],
  pauses: [],
  gradeScale: DEFAULT_GRADE_SCALE,
  githubUser: '',
  forgejoUrl: '',
  forgejoUser: '',
};

function readSetting<T>(db: Db, key: string, fallback: T): T {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined;
  return row ? fromJson<T>(row.value, fallback) : fallback;
}

function writeSetting(db: Db, key: string, value: unknown, now: number): void {
  db.prepare(
    `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)
     ON CONFLICT (key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
  ).run(key, toJson(value), now);
}

export function getSettings(ctx: Ctx): SettingsDto {
  const stored = readSetting<Partial<SettingsDto>>(ctx.db, 'profile', {});
  return {
    ...DEFAULT_SETTINGS,
    // Integrations default to the environment until changed in the UI.
    githubUser: ctx.config.github.username,
    forgejoUrl: ctx.config.forgejo.url,
    forgejoUser: ctx.config.forgejo.username,
    ...stored,
  };
}

const clampInt = (value: unknown, min: number, max: number, fallback: number): number => {
  const n = typeof value === 'number' ? Math.round(value) : Number.NaN;
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
};

const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** Validate and merge a partial update; unknown or malformed fields are ignored. */
export function updateSettings(ctx: Ctx, patch: Record<string, unknown>): SettingsDto {
  const current = getSettings(ctx);
  const next: SettingsDto = { ...current };

  if (typeof patch.name === 'string') next.name = patch.name.trim().slice(0, 60);
  if (isLocale(patch.locale)) next.locale = patch.locale;
  if (patch.theme === 'dark' || patch.theme === 'light' || patch.theme === 'system') next.theme = patch.theme;
  if (typeof patch.decimalComma === 'boolean') next.decimalComma = patch.decimalComma;
  if (typeof patch.confidencePrompt === 'boolean') next.confidencePrompt = patch.confidencePrompt;
  if (patch.sessionMinutes !== undefined)
    next.sessionMinutes = clampInt(patch.sessionMinutes, 5, 180, current.sessionMinutes);
  if (patch.weekGoal !== undefined) next.weekGoal = clampInt(patch.weekGoal, 1, 7, current.weekGoal);
  if (patch.currentTopic === null) next.currentTopic = null;
  else if (patch.currentTopic !== undefined)
    next.currentTopic = clampInt(patch.currentTopic, 1, 99, current.currentTopic ?? 1);

  if (Array.isArray(patch.tests)) {
    next.tests = patch.tests
      .filter((t): t is Record<string, unknown> => typeof t === 'object' && t !== null)
      .filter((t) => typeof t.day === 'string' && DAY.test(t.day) && Array.isArray(t.topics))
      .slice(0, 50)
      .map((t) => ({
        id: typeof t.id === 'string' && t.id ? t.id.slice(0, 24) : newId(),
        day: t.day as string,
        topics: (t.topics as unknown[])
          .filter((n): n is number => typeof n === 'number' && Number.isInteger(n))
          .slice(0, 20),
        title: typeof t.title === 'string' ? t.title.trim().slice(0, 80) : '',
      }));
  }
  if (Array.isArray(patch.pauses)) {
    next.pauses = patch.pauses
      .filter((p): p is Record<string, unknown> => typeof p === 'object' && p !== null)
      .filter(
        (p) =>
          typeof p.from === 'string' &&
          typeof p.to === 'string' &&
          DAY.test(p.from) &&
          DAY.test(p.to) &&
          p.from <= p.to,
      )
      .slice(0, 50)
      .map((p) => ({
        from: p.from as string,
        to: p.to as string,
        label: typeof p.label === 'string' ? p.label.trim().slice(0, 60) : '',
      }));
  }
  if (patch.gradeScale === null) next.gradeScale = null;
  else if (
    Array.isArray(patch.gradeScale) &&
    patch.gradeScale.length === 4 &&
    patch.gradeScale.every((n) => typeof n === 'number')
  ) {
    const scale = (patch.gradeScale as number[]).map((n) => Math.min(100, Math.max(0, Math.round(n))));
    if (scale[0]! > scale[1]! && scale[1]! > scale[2]! && scale[2]! > scale[3]!) {
      next.gradeScale = scale as unknown as SettingsDto['gradeScale'];
    }
  }
  if (typeof patch.githubUser === 'string' && /^[A-Za-z0-9-]{0,39}$/.test(patch.githubUser))
    next.githubUser = patch.githubUser;
  if (typeof patch.forgejoUser === 'string' && /^[A-Za-z0-9._-]{0,40}$/.test(patch.forgejoUser))
    next.forgejoUser = patch.forgejoUser;
  if (
    typeof patch.forgejoUrl === 'string' &&
    (patch.forgejoUrl === '' || /^https:\/\/[A-Za-z0-9.-]+(:\d+)?(\/[A-Za-z0-9._~/-]*)?$/.test(patch.forgejoUrl))
  ) {
    next.forgejoUrl = patch.forgejoUrl.replace(/\/+$/, '');
  }

  writeSetting(ctx.db, 'profile', next, ctx.now());
  return next;
}

export const isOnboarded = (ctx: Ctx): boolean => readSetting<boolean>(ctx.db, 'onboarded', false);
export const setOnboarded = (ctx: Ctx): void => writeSetting(ctx.db, 'onboarded', true, ctx.now());

/** Error with an HTTP status, thrown by services and turned into a JSON response. */
export class HttpError extends Error {
  constructor(
    readonly status: 400 | 401 | 403 | 404 | 409 | 422 | 429 | 500 | 502 | 503,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

export const notFound = (what: string): HttpError => new HttpError(404, 'not_found', `${what} not found`);
export const badRequest = (message: string): HttpError => new HttpError(400, 'bad_request', message);
