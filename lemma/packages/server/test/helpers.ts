import { type ProblemInstance, canonicalInput } from '@lemma/core';
import type { Hono } from 'hono';
import { Accounts } from '../src/accounts';
import { createApp } from '../src/app';
import { type Config, loadConfig } from '../src/config';
import { type Db, migrate, openDatabase } from '../src/db';
import { wrongAnswerFor } from '../src/dev/personas';
import { setLogLevel } from '../src/log';
import type { Ctx } from '../src/services/context';
import type { Provider } from '../src/services/tutor/types';

/** An application on an in-memory database with a clock the test controls. */
export interface Harness {
  app: Hono;
  db: Db;
  config: Config;
  /** The administrator's context: the one learner of an instance without accounts. */
  ctx: Ctx;
  /** The accounts of the instance, for reaching a user's own data in a test. */
  accounts: Accounts;
  /** Move the clock forward. */
  advance: (ms: number) => void;
  setTime: (ms: number) => void;
  now: () => number;
  get: <T = unknown>(
    path: string,
    headers?: Record<string, string>,
  ) => Promise<{ status: number; body: T; headers: Headers }>;
  send: <T = unknown>(
    method: 'POST' | 'PUT' | 'DELETE',
    path: string,
    body?: unknown,
    headers?: Record<string, string>,
  ) => Promise<{ status: number; body: T; headers: Headers }>;
}

export const MINUTE = 60_000;
export const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;

/** Wednesday 7 October 2026, 16:00 in Prague. */
export const START = Date.UTC(2026, 9, 7, 14, 0, 0);

export function harness(options: { auth?: boolean; provider?: Provider; env?: Record<string, string> } = {}): Harness {
  setLogLevel('error');
  const config = loadConfig({
    DATA_DIR: '/nonexistent/lemma-test',
    LEMMA_TIMEZONE: 'Europe/Prague',
    AUTH_DISABLED: options.auth ? '' : '1',
    LEMMA_PASSWORD: 'correct horse battery',
    ...options.env,
  });
  const db = openDatabase(':memory:');
  migrate(db);
  let clock = START;
  const now = (): number => clock;
  const accounts = new Accounts(db, config, now);
  const app = createApp({ db, config, now, accounts, tutorProvider: options.provider }) as unknown as Hono;

  const read = async <T>(response: Response): Promise<{ status: number; body: T; headers: Headers }> => {
    const text = await response.text();
    let body: unknown = text;
    try {
      body = JSON.parse(text);
    } catch {
      // not JSON: keep the text
    }
    return { status: response.status, body: body as T, headers: response.headers };
  };

  return {
    app,
    db,
    config,
    ctx: { db, config, now },
    accounts,
    advance: (ms) => {
      clock += ms;
    },
    setTime: (ms) => {
      clock = ms;
    },
    now,
    get: async (path, headers = {}) => read(await app.request(path, { headers })),
    send: async (method, path, body, headers = {}) =>
      read(
        await app.request(path, {
          method,
          headers: { 'Content-Type': 'application/json', ...headers },
          body: body === undefined ? undefined : JSON.stringify(body),
        }),
      ),
  };
}

export function snapshotOfProblem(db: Db, id: string): ProblemInstance {
  const row = db.prepare('SELECT snapshot FROM problems WHERE id = ?').get(id) as { snapshot: string };
  return JSON.parse(row.snapshot) as ProblemInstance;
}

/** The right answer to an issued problem, typed the way a learner would type it. */
export const rightAnswer = (db: Db, id: string): string => canonicalInput(snapshotOfProblem(db, id).answer);

export { wrongAnswerFor };

export const wrongAnswer = (db: Db, id: string): string => wrongAnswerFor(snapshotOfProblem(db, id).answer);
