import fs from 'node:fs';
import path from 'node:path';
import { CONTENT_VERSION, EXAM_BLUEPRINTS, MILESTONES } from '@lemma/content';
import { type MeDto, type StartRunRequest, ACTIVITY, ERROR_TYPES, isDay, isErrorType } from '@lemma/core';
import { type Context, Hono } from 'hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import { z } from 'zod';
import { AuthStore, LoginThrottle, SESSION_COOKIE } from './auth';
import type { Config } from './config';
import { type Db, backupDatabase, schemaVersion } from './db';
import { errorFields, log } from './log';
import { achievedMilestones, addEvent, dayDetail } from './services/activity';
import {
  type Ctx,
  HttpError,
  badRequest,
  getSettings,
  isOnboarded,
  setOnboarded,
  today,
  updateSettings,
} from './services/context';
import { dashboard } from './services/dashboard';
import { createExam, finishExam, getExam, listExams, refreshExamReport, saveExamAnswer } from './services/exam';
import { fitOverview, missions, updateMission } from './services/fit';
import { forgeOverview, refreshForge } from './services/forge';
import { analytics, conceptDetail, errorSummary, graph } from './services/insights';
import { replayAll } from './services/learner';
import { completeStep, openLesson } from './services/lessons';
import { getPlan, regeneratePlan, startBlock } from './services/plan';
import {
  classifyError,
  getProblemRow,
  getRun,
  nextInRun,
  problemDto,
  revealSolution,
  selfModel,
  startRun,
  submitAnswer,
  takeHint,
} from './services/practice';
import { registerTutorRoutes, tutorStatus } from './services/tutor';
import type { Provider } from './services/tutor/types';

export const APP_VERSION = '0.1.0';

export interface AppDeps {
  db: Db;
  config: Config;
  now?: () => number;
  /** Replaces the configured AI provider; used by tests. */
  tutorProvider?: Provider;
}

const StartRun = z.object({
  context: z.enum(['blocked', 'lesson', 'challenge', 'mixed', 'drill']),
  concept: z.string().max(80).optional(),
  skills: z.array(z.string().max(80)).max(80).optional(),
  topic: z.number().int().min(1).max(99).optional(),
  blockId: z.string().max(60).optional(),
  errorType: z.enum(ERROR_TYPES).optional(),
  generator: z.string().max(120).optional(),
  level: z.number().int().min(1).max(5).optional(),
  replayOf: z.string().max(40).optional(),
  count: z.number().int().min(1).max(20).optional(),
});

type Env = { Bindings: { incoming?: { socket?: { remoteAddress?: string } } } };

const SECURITY_HEADERS: Record<string, string> = {
  // KaTeX positions glyphs with inline styles, hence 'unsafe-inline' for styles only.
  'Content-Security-Policy':
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'same-origin',
  'Permissions-Policy': 'geolocation=(), microphone=(), camera=()',
};

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
  '.txt': 'text/plain; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
};

export function createApp(deps: AppDeps): Hono<Env> {
  const { db, config } = deps;
  const ctx: Ctx = { db, config, now: deps.now ?? (() => Date.now()) };
  const auth = new AuthStore(db, config.sessionDays);
  const throttle = new LoginThrottle();
  const app = new Hono<Env>();

  const clientAddress = (c: Context<Env>): string => {
    if (config.trustProxy) {
      const forwarded = c.req.header('cf-connecting-ip') ?? c.req.header('x-forwarded-for')?.split(',')[0]?.trim();
      if (forwarded) return forwarded;
    }
    return c.env?.incoming?.socket?.remoteAddress ?? 'local';
  };

  const isAuthenticated = (c: Context<Env>): boolean =>
    config.authDisabled || auth.validateSession(getCookie(c, SESSION_COOKIE), ctx.now());

  // ---- cross-cutting -----------------------------------------------------------------

  app.use('*', async (c, next) => {
    const started = Date.now();
    await next();
    for (const [name, value] of Object.entries(SECURITY_HEADERS)) c.res.headers.set(name, value);
    if (c.req.path.startsWith('/api/')) {
      c.res.headers.set('Cache-Control', 'no-store');
      log.debug('request', { method: c.req.method, path: c.req.path, status: c.res.status, ms: Date.now() - started });
    }
  });

  app.onError((error, c) => {
    if (error instanceof HttpError) return c.json({ error: error.code, message: error.message }, error.status);
    if (error instanceof SyntaxError)
      return c.json({ error: 'bad_json', message: 'the request body is not valid JSON' }, 400);
    log.error('unhandled error', { path: c.req.path, ...errorFields(error) });
    return c.json({ error: 'internal', message: 'something went wrong on the server' }, 500);
  });

  // State-changing requests must come from our own pages. SameSite=Lax cookies already
  // block cross-site POSTs in browsers; the Origin check is a second, explicit barrier.
  app.use('/api/*', async (c, next) => {
    if (c.req.method !== 'GET' && c.req.method !== 'HEAD') {
      const origin = c.req.header('origin');
      if (origin) {
        const host = (config.trustProxy ? c.req.header('x-forwarded-host') : undefined) ?? c.req.header('host') ?? '';
        let originHost = '';
        try {
          originHost = new URL(origin).host;
        } catch {
          originHost = '';
        }
        const allowed = originHost === host || config.allowedOrigins.includes(origin.replace(/\/+$/, ''));
        if (!allowed) throw new HttpError(403, 'bad_origin', 'cross-origin request refused');
      }
    }
    await next();
  });

  app.use('/api/*', async (c, next) => {
    const open = c.req.path === '/api/me' || c.req.path === '/api/auth/login' || c.req.path === '/api/auth/logout';
    if (!open && !isAuthenticated(c)) throw new HttpError(401, 'unauthenticated', 'sign in first');
    await next();
  });

  const body = async (c: Context<Env>): Promise<Record<string, unknown>> => {
    const text = await c.req.text();
    if (text.trim() === '') return {};
    const parsed: unknown = JSON.parse(text);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed))
      throw badRequest('expected a JSON object');
    return parsed as Record<string, unknown>;
  };

  // ---- health and session ------------------------------------------------------------

  app.get('/healthz', (c) => {
    db.prepare('SELECT 1').get();
    return c.json({ status: 'ok', version: APP_VERSION, schema: schemaVersion(db), content: CONTENT_VERSION });
  });

  app.get('/api/me', (c) => {
    const authenticated = isAuthenticated(c);
    const tutor = deps.tutorProvider ? { enabled: true, provider: 'test', model: 'test' } : tutorStatus(config);
    const me: MeDto = {
      authenticated,
      authRequired: !config.authDisabled,
      onboarded: authenticated ? isOnboarded(ctx) : false,
      // Settings are personal; nothing but the UI language is revealed before sign-in.
      settings: authenticated
        ? getSettings(ctx)
        : {
            ...getSettings(ctx),
            name: '',
            tests: [],
            pauses: [],
            githubUser: '',
            forgejoUrl: '',
            forgejoUser: '',
            currentTopic: null,
          },
      version: APP_VERSION,
      contentVersion: CONTENT_VERSION,
      today: today(ctx),
      tutor: authenticated ? tutor : { enabled: false, provider: null, model: null },
    };
    return c.json(me);
  });

  app.post('/api/auth/login', async (c) => {
    const client = clientAddress(c);
    const now = ctx.now();
    const wait = throttle.retryAfter(client, now);
    if (wait > 0) {
      c.header('Retry-After', String(Math.ceil(wait / 1000)));
      throw new HttpError(429, 'too_many_attempts', `too many attempts; try again in ${Math.ceil(wait / 1000)} s`);
    }
    const { password } = await body(c);
    if (typeof password !== 'string' || !auth.checkPassword(password)) {
      throttle.recordFailure(client, now);
      log.warn('failed login', { client });
      throw new HttpError(401, 'bad_password', 'wrong password');
    }
    throttle.recordSuccess(client);
    const session = auth.createSession(now, c.req.header('user-agent'));
    setCookie(c, SESSION_COOKIE, session.token, {
      httpOnly: true,
      sameSite: 'Lax',
      secure: config.cookieSecure,
      path: '/',
      expires: new Date(session.expiresAt),
    });
    return c.json({ ok: true });
  });

  app.post('/api/auth/logout', (c) => {
    auth.deleteSession(getCookie(c, SESSION_COOKIE));
    deleteCookie(c, SESSION_COOKIE, { path: '/' });
    return c.json({ ok: true });
  });

  app.post('/api/auth/password', async (c) => {
    const { current, next } = await body(c);
    if (typeof next !== 'string' || next.length < 8)
      throw badRequest('the new password must have at least 8 characters');
    if (!config.authDisabled && (typeof current !== 'string' || !auth.checkPassword(current)))
      throw new HttpError(401, 'bad_password', 'wrong current password');
    const now = ctx.now();
    auth.setPassword(next, now);
    // Changing the password signs every other device out.
    auth.deleteAllSessions();
    const session = auth.createSession(now, c.req.header('user-agent'));
    setCookie(c, SESSION_COOKIE, session.token, {
      httpOnly: true,
      sameSite: 'Lax',
      secure: config.cookieSecure,
      path: '/',
      expires: new Date(session.expiresAt),
    });
    return c.json({ ok: true });
  });

  // ---- settings ----------------------------------------------------------------------

  app.get('/api/settings', (c) => c.json(getSettings(ctx)));
  app.put('/api/settings', async (c) => {
    const settings = updateSettings(ctx, await body(c));
    // The plan depends on the current chapter, tests and session length.
    regeneratePlan(ctx, settings.sessionMinutes);
    return c.json(settings);
  });
  app.post('/api/onboarding', async (c) => {
    const settings = updateSettings(ctx, await body(c));
    setOnboarded(ctx);
    regeneratePlan(ctx, settings.sessionMinutes);
    return c.json(settings);
  });

  // ---- learning ----------------------------------------------------------------------

  app.get('/api/dashboard', (c) => c.json(dashboard(ctx)));
  app.get('/api/graph', (c) => c.json(graph(ctx)));
  app.get('/api/concepts/:id', (c) => c.json(conceptDetail(ctx, c.req.param('id'))));

  app.get('/api/lessons/:id', (c) => c.json(openLesson(ctx, c.req.param('id'))));
  app.post('/api/lessons/:id/step', async (c) => {
    const { step } = await body(c);
    if (typeof step !== 'number') throw badRequest('step is required');
    return c.json(completeStep(ctx, c.req.param('id'), step));
  });

  app.post('/api/practice/start', async (c) => {
    const request = StartRun.safeParse(await body(c));
    if (!request.success) throw badRequest('the practice request is not valid');
    return c.json(startRun(ctx, request.data as StartRunRequest));
  });
  app.get('/api/runs/:id', (c) => c.json(getRun(ctx, c.req.param('id'))));
  app.post('/api/runs/:id/next', (c) => c.json(nextInRun(ctx, c.req.param('id'))));

  app.get('/api/problems/:id', (c) => c.json(problemDto(ctx, getProblemRow(ctx, c.req.param('id')))));
  app.post('/api/problems/:id/answer', async (c) => {
    const { input, seconds, confidence } = await body(c);
    if (typeof input !== 'string') throw badRequest('input is required');
    return c.json(
      submitAnswer(ctx, c.req.param('id'), {
        input,
        seconds: typeof seconds === 'number' ? seconds : undefined,
        confidence: confidence === 'sure' || confidence === 'think' || confidence === 'guess' ? confidence : undefined,
      }),
    );
  });
  app.post('/api/problems/:id/hint', (c) => c.json(takeHint(ctx, c.req.param('id'))));
  app.get('/api/problems/:id/model', (c) => c.json(selfModel(ctx, c.req.param('id'))));
  app.post('/api/problems/:id/reveal', async (c) => {
    const { seconds } = await body(c);
    return c.json(revealSolution(ctx, c.req.param('id'), typeof seconds === 'number' ? seconds : undefined));
  });
  app.post('/api/problems/:id/classify', async (c) => {
    const { errorType } = await body(c);
    if (!isErrorType(errorType)) throw badRequest('unknown error type');
    return c.json(classifyError(ctx, c.req.param('id'), errorType));
  });

  app.get('/api/plan', (c) => {
    const minutes = Number(c.req.query('minutes'));
    return c.json(
      getPlan(ctx, Number.isFinite(minutes) && minutes >= 5 ? Math.min(180, Math.round(minutes)) : undefined),
    );
  });
  app.post('/api/plan/regenerate', async (c) => {
    const { minutes } = await body(c);
    return c.json(
      regeneratePlan(ctx, typeof minutes === 'number' ? Math.min(180, Math.max(5, Math.round(minutes))) : undefined),
    );
  });
  app.post('/api/plan/blocks/:id/start', (c) => c.json(startBlock(ctx, c.req.param('id'))));

  // ---- activity and insight ----------------------------------------------------------

  app.get('/api/activity/day/:day', (c) => {
    const day = c.req.param('day');
    if (!isDay(day)) throw badRequest('day must be YYYY-MM-DD');
    return c.json(dayDetail(ctx, day));
  });
  app.post('/api/activity/lab', async (c) => {
    const { tool, seconds } = await body(c);
    if (typeof tool !== 'string' || !/^[a-z]{3,20}$/.test(tool)) throw badRequest('tool is required');
    // A Lab session counts once per tool per day, and only after real time spent with it.
    const enough = typeof seconds === 'number' && seconds >= ACTIVITY.LAB_MIN_SECONDS;
    const already = db
      .prepare(`SELECT 1 FROM events WHERE type = 'lab' AND day = ? AND tool = ?`)
      .get(today(ctx), tool);
    if (enough && !already) addEvent(ctx, { type: 'lab', points: ACTIVITY.LAB, tool });
    return c.json({ counted: enough && !already });
  });
  app.get('/api/errors', (c) => c.json(errorSummary(ctx)));
  app.get('/api/analytics', (c) => c.json(analytics(ctx)));
  app.get('/api/milestones', (c) => {
    const achieved = achievedMilestones(ctx);
    return c.json(
      [...MILESTONES]
        .sort((a, b) => b.weight - a.weight)
        .map((def) => ({
          ...def,
          achieved: achieved.filter((a) => a.id === def.id).map((a) => ({ ref: a.ref, at: a.achievedAt })),
        })),
    );
  });

  // ---- exams -------------------------------------------------------------------------

  app.get('/api/exam-blueprints', (c) => c.json(EXAM_BLUEPRINTS));
  app.get('/api/exams', (c) => c.json(listExams(ctx)));
  app.post('/api/exams', async (c) => {
    const { blueprint, topics, concepts } = await body(c);
    if (typeof blueprint !== 'string') throw badRequest('blueprint is required');
    return c.json(
      createExam(ctx, {
        blueprint,
        topics: Array.isArray(topics) ? topics.filter((n): n is number => typeof n === 'number') : undefined,
        concepts: Array.isArray(concepts) ? concepts.filter((s): s is string => typeof s === 'string') : undefined,
      }),
    );
  });
  app.get('/api/exams/:id', (c) => c.json(getExam(ctx, c.req.param('id'))));
  app.put('/api/exams/:id/items/:index', async (c) => {
    const { input, seconds } = await body(c);
    return c.json(
      saveExamAnswer(
        ctx,
        c.req.param('id'),
        Number(c.req.param('index')),
        typeof input === 'string' ? input : '',
        typeof seconds === 'number' ? seconds : 0,
      ),
    );
  });
  app.post('/api/exams/:id/finish', (c) => c.json(finishExam(ctx, c.req.param('id'))));
  app.post('/api/exams/:id/refresh', (c) => c.json(refreshExamReport(ctx, c.req.param('id'))));

  // ---- FIT, missions, forge ----------------------------------------------------------

  app.get('/api/fit', (c) => c.json(fitOverview(ctx)));
  app.get('/api/missions', (c) => c.json(missions(ctx)));
  app.put('/api/missions/:id', async (c) => c.json(updateMission(ctx, c.req.param('id'), await body(c))));
  app.get('/api/forge', (c) => c.json(forgeOverview(ctx)));
  app.post('/api/forge/refresh', async (c) => {
    await refreshForge(ctx, true);
    return c.json(forgeOverview(ctx));
  });

  registerTutorRoutes(app as unknown as Hono, ctx, body as never, deps.tutorProvider);

  // ---- administration ----------------------------------------------------------------

  app.post('/api/admin/recompute', (c) => c.json(replayAll(ctx)));
  app.post('/api/admin/backup', async (c) => {
    const file = await backupDatabase(db, config.dataDir, `manual-${today(ctx)}-${Date.now()}`, 0);
    return c.json({ file: path.basename(file) });
  });
  app.get('/api/admin/export', (c) => {
    const tables = [
      'settings',
      'runs',
      'problems',
      'attempts',
      'events',
      'skill_state',
      'lesson_progress',
      'plans',
      'exams',
      'milestones',
      'mission_progress',
      'tutor_threads',
      'tutor_messages',
    ];
    const dump: Record<string, unknown[]> = {};
    for (const table of tables) dump[table] = db.prepare(`SELECT * FROM ${table}`).all();
    c.header('Content-Disposition', `attachment; filename="lemma-export-${today(ctx)}.json"`);
    return c.json({
      exportedAt: new Date(ctx.now()).toISOString(),
      version: APP_VERSION,
      schema: schemaVersion(db),
      content: CONTENT_VERSION,
      tables: dump,
    });
  });

  app.all('/api/*', () => {
    throw new HttpError(404, 'not_found', 'no such endpoint');
  });

  // ---- the web app -------------------------------------------------------------------

  if (config.webDir && fs.existsSync(path.join(config.webDir, 'index.html'))) {
    const root = config.webDir;
    app.get('*', (c) => {
      const requested = decodeURIComponent(c.req.path);
      const resolved = path.resolve(root, `.${requested}`);
      // Never serve anything outside the web directory.
      const inside = resolved === root || resolved.startsWith(root + path.sep);
      const isFile = inside && fs.existsSync(resolved) && fs.statSync(resolved).isFile();
      const file = isFile ? resolved : path.join(root, 'index.html');
      const ext = path.extname(file).toLowerCase();
      const headers: Record<string, string> = { 'Content-Type': MIME[ext] ?? 'application/octet-stream' };
      // Vite fingerprints everything under /assets, so those can be cached forever.
      headers['Cache-Control'] =
        isFile && requested.startsWith('/assets/') ? 'public, max-age=31536000, immutable' : 'no-cache';
      return c.body(fs.readFileSync(file), 200, headers);
    });
  }

  return app;
}

/**
 * Create the password from the environment on first start. With LEMMA_PASSWORD_RESET=1
 * the stored password is replaced as well and every session is signed out: whoever can
 * edit `.env` on the server owns the instance anyway, so this is the way back in.
 */
export function ensurePassword(db: Db, config: Config, now: number): void {
  const auth = new AuthStore(db, config.sessionDays);
  if (config.authDisabled) {
    log.warn('authentication is disabled (AUTH_DISABLED=1): do not expose this instance to a network you do not trust');
    return;
  }
  // Compose gives `$` and ` #` in .env a meaning, so part of a password can go missing on the way here.
  const arrived = config.initialPassword
    ? ` — ${config.initialPassword.length} arrived, see the note on $ in .env.example`
    : '';
  if (auth.hasPassword() && config.passwordReset) {
    if (config.initialPassword.length < 8)
      throw new Error(`LEMMA_PASSWORD_RESET=1 needs LEMMA_PASSWORD to be set to at least 8 characters${arrived}`);
    auth.setPassword(config.initialPassword, now);
    auth.deleteAllSessions();
    log.warn(
      'password reset from LEMMA_PASSWORD and all sessions signed out; remove LEMMA_PASSWORD_RESET from .env now',
    );
    return;
  }
  if (auth.hasPassword()) return;
  if (config.initialPassword.length < 8) {
    throw new Error(
      `LEMMA_PASSWORD must be set to at least 8 characters for the first start${arrived || ' (see .env.example)'}`,
    );
  }
  auth.setPassword(config.initialPassword, now);
  log.info('password set from LEMMA_PASSWORD; change it in Settings and remove it from .env if you like');
}
