import type { DashboardDto, ForgeDto } from '@lemma/core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { refreshForge } from '../src/services/forge';
import { HOUR, harness } from './helpers';

/**
 * The forge integration against scripted HTTP. Nothing here touches the network: `fetch`
 * is replaced by a function that records each request and answers from a script.
 */

interface Call {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: string | null;
}

type Reply = { status?: number; json?: unknown; headers?: Record<string, string> } | Error;

function scriptFetch(reply: (call: Call, index: number) => Reply): Call[] {
  const calls: Call[] = [];
  vi.stubGlobal('fetch', async (input: string | URL, init: RequestInit = {}) => {
    const call: Call = {
      url: String(input),
      method: init.method ?? 'GET',
      headers: Object.fromEntries(
        Object.entries((init.headers ?? {}) as Record<string, string>).map(([key, value]) => [
          key.toLowerCase(),
          value,
        ]),
      ),
      body: typeof init.body === 'string' ? init.body : null,
    };
    calls.push(call);
    const answer = reply(call, calls.length - 1);
    if (answer instanceof Error) throw answer;
    const status = answer.status ?? 200;
    // 304 must not carry a body.
    return new Response(status === 304 ? null : JSON.stringify(answer.json ?? []), {
      status,
      headers: { 'Content-Type': 'application/json', ...answer.headers },
    });
  });
  return calls;
}

const events = (day: string, count: number): { created_at: string }[] =>
  Array.from({ length: count }, (_, i) => ({ created_at: `${day}T${String(i % 24).padStart(2, '0')}:15:00Z` }));

afterEach(() => vi.unstubAllGlobals());

describe('GitHub public events (no token)', () => {
  it('counts events per day across pages, and asks politely', async () => {
    const h = harness();
    await h.send('PUT', '/api/settings', { githubUser: 'octocat' });
    const calls = scriptFetch((call) => {
      const page = new URL(call.url).searchParams.get('page');
      if (page === '1')
        return { json: [...events('2026-10-06', 60), ...events('2026-10-05', 40)], headers: { ETag: '"v1"' } };
      if (page === '2') return { json: events('2026-10-01', 37) };
      return { json: [] };
    });

    const forge = (await h.send<ForgeDto>('POST', '/api/forge/refresh')).body;
    expect(forge.configured).toBe(true);
    expect(forge.days).toEqual([
      { day: '2026-10-01', count: 37 },
      { day: '2026-10-05', count: 40 },
      { day: '2026-10-06', count: 60 },
    ]);
    expect(forge.sources).toMatchObject([{ ok: true, error: null, note: 'public events, last 30 days' }]);

    // Two pages were needed; the second was short, so there was no third request.
    expect(calls.map((call) => new URL(call.url).searchParams.get('page'))).toEqual(['1', '2']);
    expect(calls[0]!.url).toContain('https://api.github.com/users/octocat/events/public');
    // No sign-in is used or needed, and the request identifies itself.
    expect(calls[0]!.headers.authorization).toBeUndefined();
    expect(calls[0]!.headers['user-agent']).toContain('lemma');
    expect(calls[0]!.headers['x-github-api-version']).toBe('2022-11-28');
  });

  it('revalidates with the ETag and keeps the data when nothing changed', async () => {
    const h = harness();
    await h.send('PUT', '/api/settings', { githubUser: 'octocat' });
    scriptFetch(() => ({ json: events('2026-10-06', 5), headers: { ETag: '"v1"' } }));
    await h.send('POST', '/api/forge/refresh');

    const calls = scriptFetch(() => ({ status: 304 }));
    h.advance(HOUR);
    const forge = (await h.send<ForgeDto>('POST', '/api/forge/refresh')).body;
    expect(calls).toHaveLength(1);
    expect(calls[0]!.headers['if-none-match']).toBe('"v1"');
    expect(forge.days).toEqual([{ day: '2026-10-06', count: 5 }]);
    expect(forge.sources[0]).toMatchObject({ ok: true, fetchedAt: h.now() });
  });

  it('keeps showing the last good data when GitHub is down or rate-limits', async () => {
    const h = harness();
    await h.send('PUT', '/api/settings', { githubUser: 'octocat' });
    scriptFetch(() => ({ json: events('2026-10-06', 5) }));
    await h.send('POST', '/api/forge/refresh');

    scriptFetch(() => ({ status: 403, json: { message: 'API rate limit exceeded' } }));
    const limited = (await h.send<ForgeDto>('POST', '/api/forge/refresh')).body;
    expect(limited.sources[0]).toMatchObject({ ok: false, error: 'GitHub events: HTTP 403' });
    expect(limited.days).toEqual([{ day: '2026-10-06', count: 5 }]);

    scriptFetch(() => new TypeError('fetch failed'));
    const offline = await h.send<ForgeDto>('POST', '/api/forge/refresh');
    expect(offline.status).toBe(200);
    expect(offline.body.sources[0]).toMatchObject({ ok: false, error: 'fetch failed' });
    expect(offline.body.days).toEqual([{ day: '2026-10-06', count: 5 }]);

    // The rest of the app does not notice.
    expect((await h.get<DashboardDto>('/api/dashboard')).status).toBe(200);
  });

  it('does not ask again within the refresh interval unless told to', async () => {
    const h = harness();
    await h.send('PUT', '/api/settings', { githubUser: 'octocat' });
    const calls = scriptFetch(() => ({ json: events('2026-10-06', 2) }));
    await refreshForge(h.ctx);
    expect(calls).toHaveLength(1);
    h.advance(5 * HOUR);
    await refreshForge(h.ctx);
    expect(calls).toHaveLength(1);
    h.advance(2 * HOUR);
    await refreshForge(h.ctx);
    expect(calls).toHaveLength(2);
    // A failure is not retried in a tight loop either.
    scriptFetch(() => ({ status: 500 }));
    h.advance(7 * HOUR);
    await refreshForge(h.ctx);
    const quiet = scriptFetch(() => ({ status: 500 }));
    h.advance(HOUR);
    await refreshForge(h.ctx);
    expect(quiet).toHaveLength(0);
  });
});

describe('GitHub contribution calendar (with a token)', () => {
  it('reads the whole year through GraphQL and never sends the token anywhere else', async () => {
    const h = harness({ env: { GITHUB_TOKEN: 'ghp_test_token' } });
    await h.send('PUT', '/api/settings', { githubUser: 'octocat' });
    const calls = scriptFetch(() => ({
      json: {
        data: {
          user: {
            contributionsCollection: {
              contributionCalendar: {
                weeks: [
                  {
                    contributionDays: [
                      { date: '2026-03-01', contributionCount: 4 },
                      { date: '2026-03-02', contributionCount: 0 },
                    ],
                  },
                  { contributionDays: [{ date: '2026-10-06', contributionCount: 9 }] },
                ],
              },
            },
          },
        },
      },
    }));
    const forge = (await h.send<ForgeDto>('POST', '/api/forge/refresh')).body;
    expect(forge.days).toEqual([
      { day: '2026-03-01', count: 4 },
      { day: '2026-10-06', count: 9 },
    ]);
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({ url: 'https://api.github.com/graphql', method: 'POST' });
    expect(calls[0]!.headers.authorization).toBe('Bearer ghp_test_token');
    expect(JSON.parse(calls[0]!.body!).variables).toEqual({ login: 'octocat' });
    // The token is configuration: it is not part of the settings the browser can read.
    expect(JSON.stringify((await h.get('/api/settings')).body)).not.toContain('ghp_test_token');
    expect(JSON.stringify(forge)).not.toContain('ghp_test_token');
  });

  it('reports a GraphQL error as a failed source', async () => {
    const h = harness({ env: { GITHUB_TOKEN: 'ghp_test_token' } });
    await h.send('PUT', '/api/settings', { githubUser: 'octocat' });
    scriptFetch(() => ({ json: { errors: [{ message: 'Bad credentials' }] } }));
    const forge = (await h.send<ForgeDto>('POST', '/api/forge/refresh')).body;
    expect(forge.sources[0]).toMatchObject({ ok: false, error: 'GitHub GraphQL: Bad credentials' });
    expect(forge.days).toEqual([]);
  });
});

describe('Forgejo and several sources together', () => {
  it('reads the public heatmap and adds the sources up per day', async () => {
    const h = harness();
    await h.send('PUT', '/api/settings', {
      githubUser: 'octocat',
      forgejoUrl: 'https://git.example.org',
      forgejoUser: 'jonas',
    });
    const noon = (day: string): number => Date.parse(`${day}T12:00:00Z`) / 1000;
    const calls = scriptFetch((call) => {
      if (call.url.startsWith('https://git.example.org/')) {
        return {
          json: [
            { timestamp: noon('2026-10-06'), contributions: 3 },
            { timestamp: noon('2026-10-06') + 900, contributions: 2 },
            { timestamp: noon('2026-10-02'), contributions: 1 },
            { nonsense: true },
          ],
        };
      }
      return { json: events('2026-10-06', 4) };
    });
    const forge = (await h.send<ForgeDto>('POST', '/api/forge/refresh')).body;
    expect(calls.map((call) => new URL(call.url).host).sort()).toEqual(['api.github.com', 'git.example.org']);
    expect(calls.find((call) => call.url.includes('git.example.org'))!.url).toBe(
      'https://git.example.org/api/v1/users/jonas/heatmap',
    );
    expect(forge.sources.map((source) => source.label)).toEqual(['GitHub · octocat', 'git.example.org · jonas']);
    // 4 from GitHub and 3 + 2 from Forgejo on the 6th; malformed entries are skipped.
    expect(forge.days).toEqual([
      { day: '2026-10-02', count: 1 },
      { day: '2026-10-06', count: 9 },
    ]);

    // One source failing does not hide the other.
    scriptFetch((call) => (call.url.includes('git.example.org') ? { status: 502 } : { json: events('2026-10-07', 1) }));
    const partial = (await h.send<ForgeDto>('POST', '/api/forge/refresh')).body;
    expect(partial.sources.map((source) => source.ok)).toEqual([true, false]);
    expect(partial.days).toEqual([
      { day: '2026-10-02', count: 1 },
      { day: '2026-10-06', count: 5 },
      { day: '2026-10-07', count: 1 },
    ]);
  });

  it('refuses to follow redirects and gives up on a hung server', async () => {
    const h = harness();
    await h.send('PUT', '/api/settings', { githubUser: 'octocat' });
    let seen: RequestInit | undefined;
    vi.stubGlobal('fetch', async (_input: string | URL, init: RequestInit = {}) => {
      seen = init;
      return new Response('[]', { status: 200 });
    });
    await h.send('POST', '/api/forge/refresh');
    expect(seen?.redirect).toBe('error');
    expect(seen?.signal).toBeInstanceOf(AbortSignal);
  });
});
