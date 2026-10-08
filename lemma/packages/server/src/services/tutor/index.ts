import { getConcept } from '@lemma/content';
import {
  type TutorMessageDto,
  type TutorMode,
  type TutorStreamEvent,
  type TutorThreadDto,
  L,
  TUTOR_MODES,
  pick,
} from '@lemma/core';
import type { Context, Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import type { Config } from '../../config';
import { errorFields, log } from '../../log';
import { type Ctx, HttpError, badRequest, getSettings, newId, notFound } from '../context';
import { type ProblemRow } from '../practice';
import { DEFAULT_CLAUDE_MODEL, runClaude } from './anthropic';
import { runLocal } from './local';
import { STABLE_INSTRUCTIONS, buildContext, titleFrom } from './prompt';
import { type Provider, type TutorErrorCode, type TutorTurn, TutorError } from './types';

/**
 * The tutor: conversation threads, and one streaming endpoint.
 *
 * The tutor is optional. Without a provider configured the rest of the app is unaffected,
 * and nothing in the learning model depends on it. What it may and may not do is decided
 * here and in prompt.ts, not left to the model:
 *  - it is never asked whether an answer is right — its tools call the app's evaluator;
 *  - talking to it about a problem that is still open counts as help, like a hint;
 *  - it is unavailable while a mock exam is running.
 */

const MAX_MESSAGE_CHARS = 6000;
/** How much of a thread is sent back to the model. */
const MAX_HISTORY_TURNS = 30;
const MAX_HISTORY_CHARS = 40_000;
/** However long the conversation, the tutor counts as at most this many hints on a problem. */
const TUTOR_HELP_CAP = 2;
const MAX_CONCURRENT = 2;
const PING_MS = 15_000;

export function tutorStatus(config: Config): { enabled: boolean; provider: string | null; model: string | null } {
  const { ai } = config;
  if (ai.provider === 'anthropic' && ai.anthropicKey)
    return { enabled: true, provider: 'anthropic', model: ai.model || DEFAULT_CLAUDE_MODEL };
  // A local server needs no key, but it does need to be told which model to run.
  if (ai.provider === 'openai' && ai.model && (ai.openaiBaseUrl || ai.openaiKey))
    return { enabled: true, provider: 'openai-compatible', model: ai.model };
  return { enabled: false, provider: null, model: null };
}

const ERROR_TEXT: Record<TutorErrorCode | 'refused' | 'empty', L> = {
  config: L(
    'Tutor není správně nastaven (zkontroluj proměnné AI_* v .env).',
    'The tutor is not configured correctly (check the AI_* variables in .env).',
  ),
  auth: L('Poskytovatel modelu odmítl API klíč.', 'The model provider rejected the API key.'),
  rate_limit: L(
    'Poskytovatel modelu právě omezuje počet požadavků. Zkus to za chvíli.',
    'The model provider is rate limiting requests. Try again in a moment.',
  ),
  overloaded: L(
    'Poskytovatel modelu je přetížený. Zkus to za chvíli.',
    'The model provider is overloaded. Try again in a moment.',
  ),
  unreachable: L(
    'K modelu se nepodařilo připojit. Zbytek aplikace funguje dál.',
    'The model could not be reached. The rest of the app keeps working.',
  ),
  aborted: L('Odpověď byla zastavena.', 'The reply was stopped.'),
  provider: L(
    'Model vrátil chybu. Podrobnosti jsou v logu serveru.',
    'The model returned an error. Details are in the server log.',
  ),
  refused: L(
    'Model na tuto zprávu odmítl odpovědět. Zkus ji formulovat jinak.',
    'The model declined to answer this message. Try wording it differently.',
  ),
  empty: L('Model nevrátil žádnou odpověď. Zkus to znovu.', 'The model returned no reply. Try again.'),
};

interface ThreadRow {
  id: string;
  mode: string;
  title: string;
  concept: string | null;
  problem_id: string | null;
  created_at: number;
  updated_at: number;
}

interface MessageRow {
  id: number;
  role: 'user' | 'assistant';
  content: string;
  at: number;
}

const isMode = (value: unknown): value is TutorMode =>
  typeof value === 'string' && (TUTOR_MODES as readonly string[]).includes(value);

function threadDto(row: ThreadRow, messages: MessageRow[]): TutorThreadDto {
  return {
    id: row.id,
    mode: isMode(row.mode) ? row.mode : 'socratic',
    title: row.title,
    concept: row.concept,
    problemId: row.problem_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    messages: messages.map((m): TutorMessageDto => ({ id: m.id, role: m.role, content: m.content, at: m.at })),
  };
}

const getThread = (ctx: Ctx, id: string): ThreadRow | undefined =>
  ctx.db.prepare('SELECT * FROM tutor_threads WHERE id = ?').get(id) as ThreadRow | undefined;

const messagesOf = (ctx: Ctx, threadId: string): MessageRow[] =>
  ctx.db
    .prepare('SELECT id, role, content, at FROM tutor_messages WHERE thread_id = ? ORDER BY id')
    .all(threadId) as MessageRow[];

function addMessage(ctx: Ctx, threadId: string, role: 'user' | 'assistant', content: string): number {
  const at = ctx.now();
  const result = ctx.db
    .prepare('INSERT INTO tutor_messages (thread_id, role, content, at) VALUES (?, ?, ?, ?)')
    .run(threadId, role, content, at);
  ctx.db.prepare('UPDATE tutor_threads SET updated_at = ? WHERE id = ?').run(at, threadId);
  return Number(result.lastInsertRowid);
}

/**
 * The stored thread as alternating turns, newest kept. A reply that failed leaves two
 * learner messages in a row; they are joined, since the conversation must alternate and
 * must begin with the learner.
 */
export function turnsFrom(messages: readonly { role: 'user' | 'assistant'; content: string }[]): TutorTurn[] {
  const merged: TutorTurn[] = [];
  for (const message of messages) {
    const last = merged[merged.length - 1];
    if (last && last.role === message.role) last.content = `${last.content}\n\n${message.content}`;
    else merged.push({ role: message.role, content: message.content });
  }
  let start = Math.max(0, merged.length - MAX_HISTORY_TURNS);
  let chars = 0;
  for (let i = merged.length - 1; i >= start; i--) {
    chars += merged[i]!.content.length;
    // The newest turn is always sent, however long it is.
    if (chars > MAX_HISTORY_CHARS && i < merged.length - 1) {
      start = i + 1;
      break;
    }
  }
  while (start < merged.length - 1 && merged[start]!.role !== 'user') start++;
  return merged.slice(start);
}

const examRunning = (ctx: Ctx): boolean =>
  ctx.db.prepare('SELECT 1 FROM exams WHERE finished_at IS NULL AND deadline_at > ?').get(ctx.now()) !== undefined;

export interface TutorRouteDeps {
  /** The data of whoever is asking: threads and problems are that learner's own. */
  ctxOf: (c: Context) => Ctx;
  /** Whether the asking account may talk to the model, which runs on the instance's key. */
  allowed: (c: Context) => boolean;
  body: (c: Context) => Promise<Record<string, unknown>>;
  /** Replaces the configured AI provider; used by tests. */
  provider?: Provider;
}

export function registerTutorRoutes(app: Hono, deps: TutorRouteDeps): void {
  const { ctxOf, allowed, body, provider } = deps;
  /** Replies in progress, per learner — counted by database, of which each learner has one. */
  const active = new WeakMap<object, number>();

  app.get('/api/tutor/threads', (c) => {
    const ctx = ctxOf(c);
    const problemId = c.req.query('problemId');
    const rows = (
      problemId
        ? ctx.db
            .prepare('SELECT * FROM tutor_threads WHERE problem_id = ? ORDER BY updated_at DESC LIMIT 5')
            .all(problemId)
        : ctx.db.prepare('SELECT * FROM tutor_threads ORDER BY updated_at DESC LIMIT 40').all()
    ) as ThreadRow[];
    return c.json(rows.map((row) => threadDto(row, [])));
  });

  app.get('/api/tutor/threads/:id', (c) => {
    const ctx = ctxOf(c);
    const row = getThread(ctx, c.req.param('id'));
    if (!row) throw notFound('thread');
    return c.json(threadDto(row, messagesOf(ctx, row.id)));
  });

  app.delete('/api/tutor/threads/:id', (c) => {
    ctxOf(c).db.prepare('DELETE FROM tutor_threads WHERE id = ?').run(c.req.param('id'));
    return c.json({ ok: true });
  });

  app.post('/api/tutor/chat', async (c) => {
    const ctx = ctxOf(c);
    const { config } = ctx;
    if (!allowed(c)) throw new HttpError(403, 'tutor_not_allowed', 'the tutor is not switched on for this account');
    const status = tutorStatus(config);
    const run: Provider | null =
      provider ??
      (status.provider === 'anthropic' ? runClaude : status.provider === 'openai-compatible' ? runLocal : null);
    if (!run) throw new HttpError(503, 'tutor_disabled', 'no AI provider is configured');

    const request = await body(c);
    const message = typeof request.message === 'string' ? request.message.trim() : '';
    if (message === '') throw badRequest('message is required');
    if (message.length > MAX_MESSAGE_CHARS)
      throw badRequest(`the message is too long (limit ${MAX_MESSAGE_CHARS} characters)`);
    if (!isMode(request.mode)) throw badRequest('unknown mode');
    const mode = request.mode;

    // A mock exam measures what he can do alone; the tutor waits until it is over.
    if (examRunning(ctx))
      throw new HttpError(409, 'exam_running', 'the tutor is unavailable while a mock exam is running');
    const answering = active.get(ctx.db) ?? 0;
    if (answering >= MAX_CONCURRENT) throw new HttpError(429, 'busy', 'the tutor is already answering');

    let thread = typeof request.threadId === 'string' ? getThread(ctx, request.threadId) : undefined;
    if (typeof request.threadId === 'string' && !thread) throw notFound('thread');
    if (!thread) {
      const problemId = typeof request.problemId === 'string' ? request.problemId : null;
      if (problemId && !ctx.db.prepare('SELECT 1 FROM problems WHERE id = ?').get(problemId)) throw notFound('problem');
      const concept = typeof request.concept === 'string' && getConcept(request.concept) ? request.concept : null;
      const now = ctx.now();
      thread = {
        id: newId(),
        mode,
        title: titleFrom(message),
        concept,
        problem_id: problemId,
        created_at: now,
        updated_at: now,
      };
      ctx.db
        .prepare(
          'INSERT INTO tutor_threads (id, mode, title, concept, problem_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
        )
        .run(
          thread.id,
          thread.mode,
          thread.title,
          thread.concept,
          thread.problem_id,
          thread.created_at,
          thread.updated_at,
        );
    } else if (thread.mode !== mode) {
      ctx.db.prepare('UPDATE tutor_threads SET mode = ? WHERE id = ?').run(mode, thread.id);
    }
    const threadId = thread.id;
    const title = thread.title;

    const problem = thread.problem_id
      ? ((ctx.db.prepare('SELECT * FROM problems WHERE id = ?').get(thread.problem_id) as ProblemRow | undefined) ??
        null)
      : null;
    const locale = getSettings(ctx).locale;
    addMessage(ctx, threadId, 'user', message);

    // Everything the model is told is fixed here, before the first round.
    const turns = turnsFrom(messagesOf(ctx, threadId));
    const context = buildContext(ctx, {
      mode,
      locale,
      conceptId: thread.concept,
      problem,
      toolsAvailable: status.provider === 'anthropic' || provider !== undefined,
    });

    active.set(ctx.db, answering + 1);
    c.header('X-Accel-Buffering', 'no'); // nginx: do not buffer the stream
    return streamSSE(c, async (stream) => {
      const abort = new AbortController();
      stream.onAbort(() => abort.abort());

      // Deltas arrive synchronously from the provider; writes are queued to keep their order.
      let queue: Promise<unknown> = Promise.resolve();
      const send = (event: TutorStreamEvent): void => {
        queue = queue.then(() => stream.writeSSE({ data: JSON.stringify(event) })).catch(() => undefined);
      };
      const ping = setInterval(() => {
        queue = queue.then(() => stream.write(': ping\n\n')).catch(() => undefined);
      }, PING_MS);

      let text = '';
      const fail = (code: TutorErrorCode | 'refused' | 'empty'): void =>
        send({ type: 'error', code, message: pick(ERROR_TEXT[code], locale) });
      /** Keep what was delivered, and count it as help if it was about an open problem. */
      const keep = (): number | null => {
        if (text.trim() === '') return null;
        const id = addMessage(ctx, threadId, 'assistant', text);
        if (problem)
          ctx.db
            .prepare(`UPDATE problems SET tutor_used = MIN(tutor_used + 1, ?) WHERE id = ? AND status = 'open'`)
            .run(TUTOR_HELP_CAP, problem.id);
        return id;
      };

      send({ type: 'start', threadId, title });
      try {
        const result = await run({
          config,
          instructions: STABLE_INSTRUCTIONS,
          context,
          turns,
          tools: { ctx, locale, problem },
          signal: abort.signal,
          onText: (delta) => {
            text += delta;
            send({ type: 'delta', text: delta });
          },
          onRetract: (chars) => {
            text = text.slice(0, Math.max(0, text.length - chars));
            send({ type: 'retract', chars });
          },
          onTool: (name) => send({ type: 'tool', name }),
        });
        if (result.stop === 'refused') {
          fail('refused');
        } else {
          const messageId = keep();
          if (messageId === null) fail('empty');
          else
            send({
              type: 'done',
              messageId,
              model: result.model,
              truncated: result.stop === 'truncated',
              toolCalls: result.toolCalls,
            });
        }
      } catch (error) {
        const code = error instanceof TutorError ? error.code : 'provider';
        if (!(error instanceof TutorError)) log.error('tutor: unexpected failure', errorFields(error));
        // What he already read stays in the thread, so the history matches what he saw.
        keep();
        fail(code);
      } finally {
        clearInterval(ping);
        active.set(ctx.db, Math.max(0, (active.get(ctx.db) ?? 1) - 1));
        await queue;
      }
    });
  });
}
