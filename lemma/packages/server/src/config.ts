import path from 'node:path';
import { isValidTimeZone } from '@lemma/core';

/**
 * Configuration, read once from the environment. Everything has a default that is safe
 * for a single-user instance behind a reverse proxy; see .env.example for documentation.
 */
export interface Config {
  host: string;
  port: number;
  dataDir: string;
  /** Directory with the built web app; empty when the API runs alone (development). */
  webDir: string;
  /** Initial password; used only when the database has none yet. */
  initialPassword: string;
  /** Replace the stored password with LEMMA_PASSWORD on this start (the way back in after forgetting it). */
  passwordReset: boolean;
  authDisabled: boolean;
  cookieSecure: boolean;
  trustProxy: boolean;
  /** Extra origins allowed to make state-changing requests (comma-separated in env). */
  allowedOrigins: string[];
  timeZone: string;
  dayStartHour: number;
  sessionDays: number;
  backupKeep: number;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  github: { username: string; token: string };
  forgejo: { url: string; username: string; token: string };
  ai: {
    provider: 'none' | 'anthropic' | 'openai';
    model: string;
    anthropicKey: string;
    openaiKey: string;
    openaiBaseUrl: string;
    maxTokens: number;
    effort: 'low' | 'medium' | 'high' | 'xhigh' | 'max';
  };
}

const bool = (value: string | undefined, fallback = false): boolean => {
  if (value === undefined || value === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
};

const int = (value: string | undefined, fallback: number, min: number, max: number): number => {
  const parsed = Number.parseInt(value ?? '', 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
};

const EFFORTS = ['low', 'medium', 'high', 'xhigh', 'max'] as const;
const effortOf = (value: string | undefined): Config['ai']['effort'] =>
  (EFFORTS as readonly string[]).includes(value ?? '') ? (value as Config['ai']['effort']) : 'medium';

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const timeZone = env.LEMMA_TIMEZONE || env.TZ || 'Europe/Prague';
  if (!isValidTimeZone(timeZone)) throw new Error(`LEMMA_TIMEZONE "${timeZone}" is not a valid IANA time zone`);

  const anthropicKey = env.ANTHROPIC_API_KEY ?? '';
  const openaiKey = env.OPENAI_API_KEY ?? '';
  const openaiBaseUrl = (env.OPENAI_BASE_URL ?? '').replace(/\/+$/, '');
  const requested = (env.AI_PROVIDER ?? '').toLowerCase();
  // An explicit AI_PROVIDER wins; otherwise infer from whichever credentials are present.
  const provider: Config['ai']['provider'] =
    requested === 'anthropic' || requested === 'openai' || requested === 'none'
      ? requested
      : anthropicKey
        ? 'anthropic'
        : openaiBaseUrl || openaiKey
          ? 'openai'
          : 'none';

  const logLevel = (env.LOG_LEVEL ?? 'info').toLowerCase();

  return {
    host: env.HOST || '0.0.0.0',
    port: int(env.PORT, 8000, 1, 65535),
    dataDir: path.resolve(env.DATA_DIR || './data'),
    webDir: env.WEB_DIR ? path.resolve(env.WEB_DIR) : '',
    initialPassword: env.LEMMA_PASSWORD ?? '',
    passwordReset: bool(env.LEMMA_PASSWORD_RESET),
    authDisabled: bool(env.AUTH_DISABLED),
    cookieSecure: bool(env.COOKIE_SECURE),
    trustProxy: bool(env.TRUST_PROXY),
    allowedOrigins: (env.ALLOWED_ORIGINS ?? '')
      .split(',')
      .map((origin) => origin.trim().replace(/\/+$/, ''))
      .filter(Boolean),
    timeZone,
    dayStartHour: int(env.DAY_START_HOUR, 4, 0, 12),
    sessionDays: int(env.SESSION_DAYS, 60, 1, 365),
    backupKeep: int(env.BACKUP_KEEP, 14, 0, 365),
    logLevel: logLevel === 'debug' || logLevel === 'warn' || logLevel === 'error' ? logLevel : 'info',
    github: { username: env.GITHUB_USERNAME ?? '', token: env.GITHUB_TOKEN ?? '' },
    forgejo: {
      url: (env.FORGEJO_URL ?? '').replace(/\/+$/, ''),
      username: env.FORGEJO_USERNAME ?? '',
      token: env.FORGEJO_TOKEN ?? '',
    },
    ai: {
      provider,
      model: env.AI_MODEL ?? '',
      anthropicKey,
      openaiKey,
      openaiBaseUrl,
      // Thinking shares this budget with the visible answer, so it must not be tight.
      maxTokens: int(env.AI_MAX_TOKENS, 16000, 1024, 64000),
      effort: effortOf(env.AI_EFFORT),
    },
  };
}
