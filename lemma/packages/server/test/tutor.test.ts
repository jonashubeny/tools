import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { getGenerator } from '@lemma/content';
import {
  type ApiError,
  type Level,
  type StartRunResponse,
  type TutorStreamEvent,
  type TutorThreadDto,
  canonicalInput,
  createRng,
} from '@lemma/core';
import { afterEach, describe, expect, it } from 'vitest';
import { loadConfig } from '../src/config';
import { getProblemRow } from '../src/services/practice';
import { tutorStatus, turnsFrom } from '../src/services/tutor';
import { runClaude } from '../src/services/tutor/anthropic';
import { runLocal } from '../src/services/tutor/local';
import { STABLE_INSTRUCTIONS } from '../src/services/tutor/prompt';
import { TOOL_DEFINITIONS, executeTool } from '../src/services/tutor/tools';
import { type Provider, type ProviderInput, TutorError } from '../src/services/tutor/types';
import { MINUTE, type Harness, harness, rightAnswer, wrongAnswerFor } from './helpers';

const startProblem = async (h: Harness, concept = 'quad.vertex'): Promise<string> =>
  (await h.send<StartRunResponse>('POST', '/api/practice/start', { context: 'blocked', concept, count: 1 })).body
    .problem!.id;

/** Read a server-sent-event response into its events. */
async function chat(
  h: Harness,
  body: Record<string, unknown>,
): Promise<{ status: number; events: TutorStreamEvent[]; error?: ApiError }> {
  const response = await h.app.request('/api/tutor/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  if (!(response.headers.get('content-type') ?? '').includes('text/event-stream'))
    return { status: response.status, events: [], error: JSON.parse(text) as ApiError };
  const events = text
    .split('\n\n')
    .map((block) => block.split('\n').find((line) => line.startsWith('data:')))
    .filter((line): line is string => line !== undefined)
    .map((line) => JSON.parse(line.slice(5)) as TutorStreamEvent);
  return { status: response.status, events };
}

const textOf = (events: TutorStreamEvent[]): string => {
  let text = '';
  for (const event of events) {
    if (event.type === 'delta') text += event.text;
    if (event.type === 'retract') text = text.slice(0, text.length - event.chars);
  }
  return text;
};

describe('tutor tools', () => {
  const tool = (h: Harness, problemId?: string) => ({
    ctx: h.ctx,
    locale: 'cs' as const,
    problem: problemId ? getProblemRow(h.ctx, problemId) : null,
  });

  it('describes every tool with a closed schema', () => {
    expect(TOOL_DEFINITIONS.map((definition) => definition.name)).toEqual([
      'evaluate_expression',
      'compare_expressions',
      'check_answer',
      'get_practice_problem',
      'check_practice_answer',
    ]);
    for (const definition of TOOL_DEFINITIONS) {
      expect(definition.input_schema.additionalProperties).toBe(false);
      for (const required of definition.input_schema.required)
        expect(Object.keys(definition.input_schema.properties)).toContain(required);
      // The stable instructions tell the model about each tool by name.
      expect(STABLE_INSTRUCTIONS).toContain(definition.name);
    }
  });

  it('evaluates expressions the way the app does', () => {
    const h = harness();
    expect(executeTool('evaluate_expression', { expression: '2*(-3)^2 - 12*(-3) + 13' }, tool(h))).toEqual({
      ok: true,
      result: { defined: true, value: 67 },
    });
    expect(executeTool('evaluate_expression', { expression: 'x^2 - 4x + 3', variables: { x: 3 } }, tool(h))).toEqual({
      ok: true,
      result: { defined: true, value: 0 },
    });
    expect(executeTool('evaluate_expression', { expression: 'log(1000) + sin(pi/2)' }, tool(h))).toEqual({
      ok: true,
      result: { defined: true, value: 4 },
    });
    // Czech decimal comma, as in the learner's settings.
    expect(executeTool('evaluate_expression', { expression: '2,5 * 2' }, tool(h))).toEqual({
      ok: true,
      result: { defined: true, value: 5 },
    });
    expect(executeTool('evaluate_expression', { expression: '1/(2-2)' }, tool(h))).toMatchObject({
      ok: true,
      result: { defined: false },
    });
    expect(executeTool('evaluate_expression', { expression: '2 +* 3' }, tool(h))).toMatchObject({ ok: false });
    expect(executeTool('evaluate_expression', { expression: 'x + 1' }, tool(h))).toMatchObject({ ok: false });
  });

  it('compares expressions and shows where they differ', () => {
    const h = harness();
    expect(
      executeTool('compare_expressions', { first: '(x-2)^2 - 1', second: 'x^2 - 4x + 3', variables: ['x'] }, tool(h)),
    ).toEqual({ ok: true, result: { equivalent: true } });
    const differs = executeTool(
      'compare_expressions',
      { first: '(x-2)^2', second: 'x^2 - 4', variables: ['x'] },
      tool(h),
    );
    expect(differs).toMatchObject({ ok: true, result: { equivalent: false } });
    // Variables need not be declared, and expressions in different variables simply differ.
    expect(executeTool('compare_expressions', { first: '(a+b)^2', second: 'a^2 + 2ab + b^2' }, tool(h))).toEqual({
      ok: true,
      result: { equivalent: true },
    });
    expect(executeTool('compare_expressions', { first: 'x + y', second: 'x' }, tool(h))).toMatchObject({
      ok: true,
      result: { equivalent: false },
    });
    expect(executeTool('compare_expressions', { first: 'sin(x)^2 + cos(x)^2', second: '1' }, tool(h))).toEqual({
      ok: true,
      result: { equivalent: true },
    });
    expect(executeTool('compare_expressions', { first: '(x', second: 'x' }, tool(h))).toMatchObject({ ok: false });
  });

  it('reports input that does not match the schema as invalid, not as a tool error', () => {
    const h = harness();
    for (const [name, input] of [
      ['evaluate_expression', {}],
      ['evaluate_expression', { expression: 5 }],
      ['evaluate_expression', { expression: '1', extra: true }],
      ['compare_expressions', { first: 'x' }],
      ['check_answer', { answer: '' }],
      ['get_practice_problem', { concept: 'quad.vertex', level: 9 }],
      ['check_practice_answer', { reference: 'x' }],
    ] as const) {
      expect(executeTool(name, input, tool(h)), `${name} ${JSON.stringify(input)}`).toMatchObject({
        ok: false,
        invalid: true,
      });
    }
    expect(executeTool('rm_rf', {}, tool(h))).toMatchObject({ ok: false });
    expect(executeTool('rm_rf', {}, tool(h))).not.toHaveProperty('invalid');
  });

  it('checks an answer to the open problem without revealing it', async () => {
    const h = harness();
    expect(executeTool('check_answer', { answer: '1' }, tool(h))).toMatchObject({ ok: false });
    const id = await startProblem(h);
    const right = rightAnswer(h.db, id);
    expect(executeTool('check_answer', { answer: right }, tool(h, id))).toEqual({
      ok: true,
      result: { verdict: 'correct' },
    });
    const wrong = executeTool('check_answer', { answer: '[123456; 654321]' }, tool(h, id));
    expect(wrong).toMatchObject({ ok: true, result: { verdict: 'incorrect' } });
    expect(JSON.stringify(wrong)).not.toContain(right);
    // Checking through the tutor is not a submission.
    expect(getProblemRow(h.ctx, id)).toMatchObject({ status: 'open', wrong_attempts: 0 });
    expect((h.db.prepare('SELECT COUNT(*) AS n FROM attempts').get() as { n: number }).n).toBe(0);
  });

  it('hands out verified practice problems and checks answers to them', () => {
    const h = harness();
    expect(executeTool('get_practice_problem', { concept: 'no.such.concept' }, tool(h))).toMatchObject({ ok: false });
    const issued = executeTool('get_practice_problem', { concept: 'alg.linear-eq', level: 2 }, tool(h));
    expect(issued.ok).toBe(true);
    const problem = (issued as { result: { reference: string; statement: string; level: number } }).result;
    expect(problem.level).toBe(2);
    expect(problem.statement.length).toBeGreaterThan(5);
    expect(JSON.stringify(problem)).not.toContain('solution');

    const [, generatorId, level, seed] = /^(.+)@(\d)#(\d+)$/.exec(problem.reference)!;
    const instance = getGenerator(generatorId!)!.generate(createRng(Number(seed)), Number(level) as Level);
    const right = canonicalInput(instance.answer);

    expect(executeTool('check_practice_answer', { reference: problem.reference, answer: right }, tool(h))).toEqual({
      ok: true,
      result: { verdict: 'correct' },
    });
    const wrong = executeTool(
      'check_practice_answer',
      { reference: problem.reference, answer: wrongAnswerFor(instance.answer) },
      tool(h),
    );
    expect(wrong).toMatchObject({ ok: true, result: { verdict: 'incorrect' } });
    expect(wrong).not.toHaveProperty('result.correct_answer');
    const revealed = executeTool(
      'check_practice_answer',
      { reference: problem.reference, answer: right, reveal: true },
      tool(h),
    );
    expect(revealed).toMatchObject({ ok: true, result: { verdict: 'correct' } });
    expect(
      (revealed as { result: { correct_answer: string; solution: string[] } }).result.solution.length,
    ).toBeGreaterThan(0);
    expect(executeTool('check_practice_answer', { reference: 'made.up@2#17', answer: '1' }, tool(h))).toMatchObject({
      ok: false,
    });
  });
});

describe('conversation history', () => {
  it('alternates, starts with the learner and keeps the newest turns', () => {
    expect(turnsFrom([])).toEqual([]);
    expect(
      turnsFrom([
        { role: 'user', content: 'a' },
        { role: 'user', content: 'b' },
        { role: 'assistant', content: 'c' },
        { role: 'user', content: 'd' },
      ]),
    ).toEqual([
      { role: 'user', content: 'a\n\nb' },
      { role: 'assistant', content: 'c' },
      { role: 'user', content: 'd' },
    ]);

    const long = Array.from({ length: 100 }, (_, i) => ({
      role: i % 2 === 0 ? ('user' as const) : ('assistant' as const),
      content: `turn ${i}`,
    }));
    long.push({ role: 'user', content: 'latest' });
    const trimmed = turnsFrom(long);
    expect(trimmed.length).toBeLessThanOrEqual(30);
    expect(trimmed[0]!.role).toBe('user');
    expect(trimmed[trimmed.length - 1]!.content).toBe('latest');
    for (let i = 1; i < trimmed.length; i++) expect(trimmed[i]!.role).not.toBe(trimmed[i - 1]!.role);

    // One enormous message never crowds out the newest one.
    const huge = turnsFrom([
      { role: 'user', content: 'x'.repeat(50_000) },
      { role: 'assistant', content: 'y' },
      { role: 'user', content: 'now' },
    ]);
    expect(huge).toEqual([{ role: 'user', content: 'now' }]);
  });
});

describe('tutor status', () => {
  it('is off unless a provider is fully configured', () => {
    expect(tutorStatus(loadConfig({}))).toEqual({ enabled: false, provider: null, model: null });
    expect(tutorStatus(loadConfig({ ANTHROPIC_API_KEY: 'k' }))).toEqual({
      enabled: true,
      provider: 'anthropic',
      model: 'claude-opus-5-5',
    });
    expect(tutorStatus(loadConfig({ ANTHROPIC_API_KEY: 'k', AI_MODEL: 'claude-sonnet-5-5' })).model).toBe(
      'claude-sonnet-5-5',
    );
    // A local server needs a model name; a key is optional.
    expect(tutorStatus(loadConfig({ OPENAI_BASE_URL: 'http://localhost:11434/v1' })).enabled).toBe(false);
    expect(tutorStatus(loadConfig({ OPENAI_BASE_URL: 'http://localhost:11434/v1', AI_MODEL: 'qwen3' }))).toEqual({
      enabled: true,
      provider: 'openai-compatible',
      model: 'qwen3',
    });
    expect(tutorStatus(loadConfig({ ANTHROPIC_API_KEY: 'k', AI_PROVIDER: 'none' })).enabled).toBe(false);
  });
});

describe('the tutor endpoint', () => {
  const scripted =
    (
      script: (input: ProviderInput) => void | Promise<void>,
      stop: 'complete' | 'truncated' | 'refused' = 'complete',
    ): Provider =>
    async (input) => {
      await script(input);
      return { stop, model: 'test-model', toolCalls: 1 };
    };

  it('is unavailable when no provider is configured, and says so', async () => {
    const h = harness();
    const result = await chat(h, { mode: 'socratic', message: 'Ahoj' });
    expect(result.status).toBe(503);
    expect(result.error!.error).toBe('tutor_disabled');
  });

  it('streams a reply, stores the thread, and tells the model what it needs to know', async () => {
    let seen: ProviderInput | null = null;
    const h = harness({
      provider: scripted((input) => {
        seen = input;
        input.onText('Zkus nejdřív ');
        input.onTool('compare_expressions');
        input.onText('doplnit na čtverec.');
      }),
    });
    await h.send('PUT', '/api/settings', { name: 'Jonas', currentTopic: 3 });
    const { status, events } = await chat(h, { mode: 'hint', message: 'Nevím, jak začít.', concept: 'quad.vertex' });
    expect(status).toBe(200);
    expect(events.map((event) => event.type)).toEqual(['start', 'delta', 'tool', 'delta', 'done']);
    expect(textOf(events)).toBe('Zkus nejdřív doplnit na čtverec.');
    const done = events[events.length - 1] as Extract<TutorStreamEvent, { type: 'done' }>;
    expect(done).toMatchObject({ model: 'test-model', truncated: false, toolCalls: 1 });

    const input = seen as unknown as ProviderInput;
    expect(input.instructions).toBe(STABLE_INSTRUCTIONS);
    expect(input.turns).toEqual([{ role: 'user', content: 'Nevím, jak začít.' }]);
    expect(input.context).toContain('Reply in: Czech');
    expect(input.context).toContain('Mode: hint');
    expect(input.context).toContain('quad.vertex');
    expect(input.context).toContain('syllabus topic 3');

    const threadId = (events[0] as Extract<TutorStreamEvent, { type: 'start' }>).threadId;
    const thread = (await h.get<TutorThreadDto>(`/api/tutor/threads/${threadId}`)).body;
    expect(thread).toMatchObject({ mode: 'hint', concept: 'quad.vertex', title: 'Nevím, jak začít.' });
    expect(thread.messages.map((message) => [message.role, message.content])).toEqual([
      ['user', 'Nevím, jak začít.'],
      ['assistant', 'Zkus nejdřív doplnit na čtverec.'],
    ]);

    // The next message continues the thread, with the history, and may switch mode.
    await chat(h, { threadId, mode: 'formal', message: 'A proč to funguje?' });
    const second = seen as unknown as ProviderInput;
    expect(second.turns.map((turn) => turn.role)).toEqual(['user', 'assistant', 'user']);
    expect(second.context).toContain('Mode: explain formally');
    expect((await h.get<TutorThreadDto[]>('/api/tutor/threads')).body).toHaveLength(1);

    await h.send('DELETE', `/api/tutor/threads/${threadId}`);
    expect((await h.get(`/api/tutor/threads/${threadId}`)).status).toBe(404);
    expect((h.db.prepare('SELECT COUNT(*) AS n FROM tutor_messages').get() as { n: number }).n).toBe(0);
  });

  it('validates the request', async () => {
    const h = harness({ provider: scripted((input) => input.onText('ok')) });
    expect((await chat(h, { mode: 'socratic', message: '   ' })).status).toBe(400);
    expect((await chat(h, { mode: 'telepathy', message: 'x' })).status).toBe(400);
    expect((await chat(h, { mode: 'socratic', message: 'x'.repeat(7000) })).status).toBe(400);
    expect((await chat(h, { mode: 'socratic', message: 'x', threadId: 'missing' })).status).toBe(404);
    expect((await chat(h, { mode: 'socratic', message: 'x', problemId: 'missing' })).status).toBe(404);
  });

  it('counts help with an open problem as a hint, at most twice, and keeps the answer confidential', async () => {
    let context = '';
    const h = harness({
      provider: scripted((input) => {
        context = input.context;
        input.onText('Jaké znaménko má koeficient u x?');
      }),
    });
    const id = await startProblem(h);
    const right = rightAnswer(h.db, id);

    const first = await chat(h, { mode: 'socratic', message: 'Pomoz mi.', problemId: id });
    expect(context).toContain('OPEN — do not reveal the answer');
    expect(context).toContain('CONFIDENTIAL while the problem is open');
    expect(getProblemRow(h.ctx, id).tutor_used).toBe(1);
    const threadId = (first.events[0] as Extract<TutorStreamEvent, { type: 'start' }>).threadId;
    for (let i = 0; i < 3; i++) await chat(h, { threadId, mode: 'socratic', message: 'A dál?' });
    expect(getProblemRow(h.ctx, id).tutor_used).toBe(2);
    expect((await h.get<TutorThreadDto[]>(`/api/tutor/threads?problemId=${id}`)).body).toHaveLength(1);

    // Solved afterwards: correct, but not unaided.
    h.advance(MINUTE);
    const result = (
      await h.send<{ problem: { outcome: { credit: number; solved: boolean } } }>(
        'POST',
        `/api/problems/${id}/answer`,
        { input: right, seconds: 60 },
      )
    ).body;
    expect(result.problem.outcome.solved).toBe(true);
    expect(result.problem.outcome.credit).toBeCloseTo(0.6, 5);

    // Once it is resolved the tutor may discuss it, and talking about it costs nothing.
    await chat(h, { threadId, mode: 'socratic', message: 'Proč to tak je?' });
    expect(context).toContain('resolved — may be discussed freely');
    expect(getProblemRow(h.ctx, id).tutor_used).toBe(2);
  });

  it('takes back text the provider withdrew', async () => {
    const h = harness({
      provider: scripted((input) => {
        input.onText('První pokus');
        input.onRetract('První pokus'.length);
        input.onText('Druhý pokus');
      }),
    });
    const { events } = await chat(h, { mode: 'socratic', message: 'x' });
    expect(events.map((event) => event.type)).toEqual(['start', 'delta', 'retract', 'delta', 'done']);
    expect(textOf(events)).toBe('Druhý pokus');
    expect(
      (h.db.prepare(`SELECT content FROM tutor_messages WHERE role = 'assistant'`).get() as { content: string })
        .content,
    ).toBe('Druhý pokus');
  });

  it('keeps nothing of a refused reply and does not count it as help', async () => {
    const h = harness({ provider: scripted(() => undefined, 'refused') });
    const id = await startProblem(h);
    const { events } = await chat(h, { mode: 'socratic', message: 'x', problemId: id });
    expect(events[events.length - 1]).toMatchObject({ type: 'error', code: 'refused' });
    expect(
      (h.db.prepare(`SELECT COUNT(*) AS n FROM tutor_messages WHERE role = 'assistant'`).get() as { n: number }).n,
    ).toBe(0);
    expect(getProblemRow(h.ctx, id).tutor_used).toBe(0);
  });

  it('reports provider failures in the learner’s language and keeps what was already shown', async () => {
    const h = harness({
      provider: async (input) => {
        input.onText('Začátek odpovědi');
        throw new TutorError('rate_limit', 'rate limited');
      },
    });
    const { events } = await chat(h, { mode: 'socratic', message: 'x' });
    const last = events[events.length - 1] as Extract<TutorStreamEvent, { type: 'error' }>;
    expect(last).toMatchObject({ type: 'error', code: 'rate_limit' });
    expect(last.message).toContain('Zkus to za chvíli');
    expect(
      (h.db.prepare(`SELECT content FROM tutor_messages WHERE role = 'assistant'`).get() as { content: string })
        .content,
    ).toBe('Začátek odpovědi');

    await h.send('PUT', '/api/settings', { locale: 'en' });
    const english = await chat(h, { mode: 'socratic', message: 'x' });
    expect((english.events[english.events.length - 1] as { message: string }).message).toContain(
      'Try again in a moment',
    );
  });

  it('marks a reply that ran out of room as truncated, and an empty one as an error', async () => {
    const cut = harness({ provider: scripted((input) => input.onText('Neúplná odp'), 'truncated') });
    expect((await chat(cut, { mode: 'socratic', message: 'x' })).events.at(-1)).toMatchObject({
      type: 'done',
      truncated: true,
    });
    const empty = harness({ provider: scripted(() => undefined) });
    expect((await chat(empty, { mode: 'socratic', message: 'x' })).events.at(-1)).toMatchObject({
      type: 'error',
      code: 'empty',
    });
  });

  it('waits until a mock exam is over', async () => {
    const h = harness({ provider: scripted((input) => input.onText('ok')) });
    const exam = (
      await h.send<{ id: string; minutes: number }>('POST', '/api/exams', { blueprint: 'quick-check', topics: [1] })
    ).body;
    const during = await chat(h, { mode: 'socratic', message: 'Jak se řeší tahle úloha?' });
    expect(during.status).toBe(409);
    expect(during.error!.error).toBe('exam_running');
    await h.send('POST', `/api/exams/${exam.id}/finish`);
    expect((await chat(h, { mode: 'socratic', message: 'Jak se řeší tahle úloha?' })).status).toBe(200);
  });
});

// ------------------------------------------------------------------- the Claude provider

interface Recorded {
  path: string;
  headers: http.IncomingHttpHeaders;
  body: Record<string, any>;
}

type Block =
  { type: 'text'; text: string } | { type: 'thinking' } | { type: 'tool_use'; id: string; name: string; json: string };

/** A stand-in for the Messages API that plays back scripted streaming replies. */
async function fakeAnthropic(
  replies: { blocks: Block[]; stop: string }[],
): Promise<{ url: string; requests: Recorded[]; close: () => Promise<void> }> {
  const requests: Recorded[] = [];
  let turn = 0;
  const server = http.createServer((request, response) => {
    let raw = '';
    request.on('data', (chunk) => (raw += chunk));
    request.on('end', () => {
      requests.push({
        path: request.url ?? '',
        headers: request.headers,
        body: JSON.parse(raw) as Record<string, any>,
      });
      const reply = replies[Math.min(turn++, replies.length - 1)]!;
      response.writeHead(200, { 'content-type': 'text/event-stream', 'request-id': `req_${turn}` });
      const emit = (data: Record<string, unknown>): void =>
        void response.write(`event: ${String(data.type)}\ndata: ${JSON.stringify(data)}\n\n`);
      emit({
        type: 'message_start',
        message: {
          id: `msg_${turn}`,
          type: 'message',
          role: 'assistant',
          model: 'claude-opus-5-5',
          content: [],
          stop_reason: null,
          stop_sequence: null,
          usage: { input_tokens: 100, output_tokens: 1, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 },
        },
      });
      reply.blocks.forEach((block, index) => {
        if (block.type === 'text') {
          emit({ type: 'content_block_start', index, content_block: { type: 'text', text: '' } });
          for (const piece of block.text.match(/.{1,7}/gs) ?? [])
            emit({ type: 'content_block_delta', index, delta: { type: 'text_delta', text: piece } });
        } else if (block.type === 'thinking') {
          emit({
            type: 'content_block_start',
            index,
            content_block: { type: 'thinking', thinking: '', signature: '' },
          });
          emit({ type: 'content_block_delta', index, delta: { type: 'signature_delta', signature: `sig_${turn}` } });
        } else {
          emit({
            type: 'content_block_start',
            index,
            content_block: { type: 'tool_use', id: block.id, name: block.name, input: {} },
          });
          for (const piece of block.json.match(/.{1,9}/gs) ?? [])
            emit({ type: 'content_block_delta', index, delta: { type: 'input_json_delta', partial_json: piece } });
        }
        emit({ type: 'content_block_stop', index });
      });
      emit({
        type: 'message_delta',
        delta: { stop_reason: reply.stop, stop_sequence: null },
        usage: { output_tokens: 42 },
      });
      emit({ type: 'message_stop' });
      response.end();
    });
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  return {
    url: `http://127.0.0.1:${port}`,
    requests,
    close: () => new Promise((resolve) => server.close(() => resolve())),
  };
}

describe('the Claude provider, against a scripted Messages API', () => {
  const servers: { close: () => Promise<void> }[] = [];
  afterEach(async () => {
    delete process.env.ANTHROPIC_BASE_URL;
    for (const server of servers.splice(0)) await server.close();
  });

  const run = async (h: Harness, replies: { blocks: Block[]; stop: string }[], env: Record<string, string> = {}) => {
    const api = await fakeAnthropic(replies);
    servers.push(api);
    process.env.ANTHROPIC_BASE_URL = api.url;
    const out: { text: string; tools: string[]; retracted: number } = { text: '', tools: [], retracted: 0 };
    const result = await runClaude({
      config: loadConfig({ ANTHROPIC_API_KEY: 'test-key', ...env }),
      instructions: STABLE_INSTRUCTIONS,
      context: 'Reply in: Czech.',
      turns: [{ role: 'user', content: 'Je (x-2)^2 - 1 totéž co x^2 - 4x + 3?' }],
      tools: { ctx: h.ctx, locale: 'cs', problem: null },
      signal: new AbortController().signal,
      onText: (delta) => (out.text += delta),
      onRetract: (chars) => {
        out.text = out.text.slice(0, out.text.length - chars);
        out.retracted += chars;
      },
      onTool: (name) => out.tools.push(name),
    });
    return { api, out, result };
  };

  it('runs the tool the model asks for and sends the evaluator’s verdict back', async () => {
    const h = harness();
    const { api, out, result } = await run(h, [
      {
        blocks: [
          { type: 'thinking' },
          { type: 'text', text: 'Ověřím to.' },
          {
            type: 'tool_use',
            id: 'toolu_1',
            name: 'compare_expressions',
            json: '{"first": "(x-2)^2 - 1", "second": "x^2 - 4x + 3", "variables": ["x"]}',
          },
        ],
        stop: 'tool_use',
      },
      { blocks: [{ type: 'text', text: 'Ano, výrazy jsou ekvivalentní.' }], stop: 'end_turn' },
    ]);
    expect(result).toEqual({ stop: 'complete', model: 'claude-opus-5-5', toolCalls: 1 });
    expect(out.tools).toEqual(['compare_expressions']);
    expect(out.text).toBe('Ověřím to.\n\nAno, výrazy jsou ekvivalentní.');
    expect(api.requests).toHaveLength(2);

    const [first, second] = api.requests as [Recorded, Recorded];
    expect(first.path).toContain('/v1/messages');
    expect(first.headers['x-api-key']).toBe('test-key');
    // The request shape for the Claude 5 family.
    expect(first.body.model).toBe('claude-opus-5-5');
    expect(first.body.stream).toBe(true);
    expect(first.body.max_tokens).toBe(16000);
    expect(first.body.thinking).toEqual({ type: 'adaptive' });
    expect(first.body.output_config).toEqual({ effort: 'medium' });
    expect(first.body.fallbacks).toBe('default');
    expect(String(first.headers['anthropic-beta'])).toContain('server-side-fallback-2026-07-01');
    expect(first.body).not.toHaveProperty('temperature');
    expect(first.body).not.toHaveProperty('tool_choice');
    // The stable instructions are the cacheable prefix; the per-request context follows.
    expect(first.body.system).toEqual([
      { type: 'text', text: STABLE_INSTRUCTIONS, cache_control: { type: 'ephemeral' } },
      { type: 'text', text: 'Reply in: Czech.' },
    ]);
    expect(first.body.tools.map((t: { name: string }) => t.name)).toEqual(TOOL_DEFINITIONS.map((t) => t.name));
    expect(first.body.tools.every((t: { eager_input_streaming: boolean }) => t.eager_input_streaming === true)).toBe(
      true,
    );

    // Second round: the prefix is unchanged and the assistant turn is echoed whole.
    expect(second.body.system).toEqual(first.body.system);
    expect(second.body.tools).toEqual(first.body.tools);
    expect(second.body.messages).toHaveLength(3);
    expect(second.body.messages[0]).toEqual(first.body.messages[0]);
    expect(second.body.messages[1].role).toBe('assistant');
    expect(second.body.messages[1].content.map((block: { type: string }) => block.type)).toEqual([
      'thinking',
      'text',
      'tool_use',
    ]);
    expect(second.body.messages[1].content[0].signature).toBe('sig_1');
    expect(second.body.messages[2]).toEqual({
      role: 'user',
      content: [{ type: 'tool_result', tool_use_id: 'toolu_1', content: '{"equivalent":true}' }],
    });
  });

  it('answers a malformed tool input with the input it received, and a failing tool with its error', async () => {
    const h = harness();
    const { api, result } = await run(h, [
      {
        blocks: [
          { type: 'tool_use', id: 'toolu_1', name: 'compare_expressions', json: '{"first": "x"}' },
          { type: 'tool_use', id: 'toolu_2', name: 'evaluate_expression', json: '{"expression": "2 +* 3"}' },
        ],
        stop: 'tool_use',
      },
      { blocks: [{ type: 'text', text: 'Hotovo.' }], stop: 'end_turn' },
    ]);
    expect(result.toolCalls).toBe(2);
    const results = api.requests[1]!.body.messages[2].content;
    expect(results[0]).toEqual({
      type: 'tool_result',
      tool_use_id: 'toolu_1',
      is_error: true,
      content: JSON.stringify({ INVALID_JSON: JSON.stringify({ first: 'x' }) }),
    });
    expect(results[1]).toMatchObject({ type: 'tool_result', tool_use_id: 'toolu_2', is_error: true });
    expect(results[1].content).toContain('could not parse');
  });

  it('withdraws a refused reply and runs none of its tools', async () => {
    const h = harness();
    const { api, out, result } = await run(h, [
      {
        blocks: [
          { type: 'text', text: 'Částečná odpověď' },
          { type: 'tool_use', id: 'toolu_1', name: 'evaluate_expression', json: '{"expression": "1+1"}' },
        ],
        stop: 'refusal',
      },
    ]);
    expect(result.stop).toBe('refused');
    expect(out.text).toBe('');
    expect(out.retracted).toBe('Částečná odpověď'.length);
    expect(out.tools).toEqual([]);
    expect(api.requests).toHaveLength(1);
  });

  it('does not run a tool whose input was cut off by the output limit', async () => {
    const h = harness();
    const { api, out, result } = await run(h, [
      {
        blocks: [
          { type: 'text', text: 'Počkej' },
          { type: 'tool_use', id: 'toolu_1', name: 'evaluate_expression', json: '{"expression": "1+1"}' },
        ],
        stop: 'max_tokens',
      },
    ]);
    expect(result.stop).toBe('truncated');
    expect(out.tools).toEqual([]);
    expect(api.requests).toHaveLength(1);
  });

  it('stops a model that never stops calling tools', async () => {
    const h = harness();
    const { api, out, result } = await run(h, [
      {
        blocks: [{ type: 'tool_use', id: 'toolu_x', name: 'evaluate_expression', json: '{"expression": "1+1"}' }],
        stop: 'tool_use',
      },
    ]);
    expect(result.stop).toBe('truncated');
    expect(out.tools).toHaveLength(8);
    // Eight rounds of tools, one round in which they are refused, one last chance.
    expect(api.requests).toHaveLength(10);
    const last = api.requests[9]!.body.messages.at(-1);
    expect(last.content[0]).toMatchObject({ type: 'tool_result', is_error: true });
    expect(last.content[0].content).toContain('No more tool calls');
  });

  it('sends a plain request to models outside the Claude 5 family', async () => {
    const h = harness();
    const { api } = await run(h, [{ blocks: [{ type: 'text', text: 'ok' }], stop: 'end_turn' }], {
      AI_MODEL: 'claude-haiku-4-5',
      AI_EFFORT: 'high',
    });
    const body = api.requests[0]!.body;
    expect(body.model).toBe('claude-haiku-4-5');
    expect(body).not.toHaveProperty('thinking');
    expect(body).not.toHaveProperty('output_config');
    expect(body).not.toHaveProperty('fallbacks');
    expect(api.requests[0]!.headers['anthropic-beta'] ?? '').not.toContain('server-side-fallback');
  });

  it('turns API failures into errors the UI can explain', async () => {
    const h = harness();
    const server = http.createServer((_request, response) => {
      response.writeHead(401, { 'content-type': 'application/json' });
      response.end(
        JSON.stringify({ type: 'error', error: { type: 'authentication_error', message: 'invalid x-api-key' } }),
      );
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    servers.push({ close: () => new Promise((resolve) => server.close(() => resolve())) });
    process.env.ANTHROPIC_BASE_URL = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    const input = (env: Record<string, string>): ProviderInput => ({
      config: loadConfig(env),
      instructions: 'i',
      context: 'c',
      turns: [{ role: 'user', content: 'x' }],
      tools: { ctx: h.ctx, locale: 'cs', problem: null },
      signal: new AbortController().signal,
      onText: () => undefined,
      onRetract: () => undefined,
      onTool: () => undefined,
    });
    await expect(runClaude(input({ ANTHROPIC_API_KEY: 'bad' }))).rejects.toMatchObject({
      name: 'TutorError',
      code: 'auth',
    });
    // Without a key nothing is sent at all.
    await expect(runClaude(input({}))).rejects.toMatchObject({ name: 'TutorError', code: 'config' });
  });
});

describe('the OpenAI-compatible provider', () => {
  it('streams text from a local server and needs no key', async () => {
    const seen: { auth?: string; body?: Record<string, any> } = {};
    const server = http.createServer((request, response) => {
      let raw = '';
      request.on('data', (chunk) => (raw += chunk));
      request.on('end', () => {
        seen.auth = request.headers.authorization;
        seen.body = JSON.parse(raw) as Record<string, any>;
        response.writeHead(200, { 'content-type': 'text/event-stream' });
        for (const piece of ['Ah', 'oj', '!'])
          response.write(
            `data: ${JSON.stringify({ model: 'qwen3:8b', choices: [{ delta: { content: piece } }] })}\n\n`,
          );
        response.write(': keep-alive\n\n');
        response.write(`data: ${JSON.stringify({ choices: [{ delta: {}, finish_reason: 'stop' }] })}\n\n`);
        response.end('data: [DONE]\n\n');
      });
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const h = harness();
    let text = '';
    try {
      const result = await runLocal({
        config: loadConfig({
          OPENAI_BASE_URL: `http://127.0.0.1:${(server.address() as AddressInfo).port}/v1`,
          AI_MODEL: 'qwen3',
        }),
        instructions: 'Stable.',
        context: 'Context.',
        turns: [{ role: 'user', content: 'Ahoj' }],
        tools: { ctx: h.ctx, locale: 'cs', problem: null },
        signal: new AbortController().signal,
        onText: (delta) => (text += delta),
        onRetract: () => undefined,
        onTool: () => undefined,
      });
      expect(result).toEqual({ stop: 'complete', model: 'qwen3:8b', toolCalls: 0 });
      expect(text).toBe('Ahoj!');
      expect(seen.auth).toBeUndefined();
      expect(seen.body).toMatchObject({
        model: 'qwen3',
        stream: true,
        messages: [
          { role: 'system', content: 'Stable.\n\nContext.' },
          { role: 'user', content: 'Ahoj' },
        ],
      });
      expect(seen.body).not.toHaveProperty('tools');
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it('explains an unreachable server', async () => {
    const h = harness();
    await expect(
      runLocal({
        config: loadConfig({ OPENAI_BASE_URL: 'http://127.0.0.1:9/v1', AI_MODEL: 'qwen3' }),
        instructions: 'i',
        context: 'c',
        turns: [{ role: 'user', content: 'x' }],
        tools: { ctx: h.ctx, locale: 'cs', problem: null },
        signal: new AbortController().signal,
        onText: () => undefined,
        onRetract: () => undefined,
        onTool: () => undefined,
      }),
    ).rejects.toMatchObject({ name: 'TutorError', code: 'unreachable' });
  });
});
