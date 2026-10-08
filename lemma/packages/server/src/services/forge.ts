import type { ForgeDto } from '@lemma/core';
import { fromJson, toJson } from '../db';
import { errorFields, log } from '../log';
import { type Ctx, getSettings } from './context';

/**
 * Activity from code forges, shown next to learning activity.
 *
 * Three sources, all optional and all cached, so the app never depends on any of them:
 *  - GitHub public events (no token): at most 300 events from the last 30 days.
 *  - GitHub contribution calendar (needs a token, any scope): the full year.
 *  - Forgejo/Gitea heatmap (public endpoint).
 * See docs/research.md §4.4 for what each endpoint does and does not provide.
 */

interface CacheRow {
  source: string;
  etag: string | null;
  fetched_at: number;
  ok: number;
  data: string;
  error: string | null;
}

type DayCounts = Record<string, number>;

const USER_AGENT = 'lemma-self-hosted (personal learning app)';
const REFRESH_MS = 6 * 3_600_000;
const TIMEOUT_MS = 12_000;

function readCache(ctx: Ctx, source: string): CacheRow | undefined {
  return ctx.db.prepare('SELECT * FROM forge_cache WHERE source = ?').get(source) as CacheRow | undefined;
}

function writeCache(
  ctx: Ctx,
  source: string,
  value: { ok: boolean; data?: DayCounts; etag?: string | null; error?: string | null },
): void {
  const existing = readCache(ctx, source);
  ctx.db
    .prepare(
      `INSERT INTO forge_cache (source, etag, fetched_at, ok, data, error) VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT (source) DO UPDATE SET etag = excluded.etag, fetched_at = excluded.fetched_at, ok = excluded.ok,
         data = excluded.data, error = excluded.error`,
    )
    // On failure the previous data is kept, so the last good picture stays visible.
    .run(
      source,
      value.etag ?? existing?.etag ?? null,
      ctx.now(),
      value.ok ? 1 : 0,
      value.data ? toJson(value.data) : (existing?.data ?? '{}'),
      value.error ?? null,
    );
}

async function request(url: string, init: RequestInit = {}): Promise<Response> {
  return fetch(url, {
    ...init,
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/json', ...(init.headers ?? {}) },
    signal: AbortSignal.timeout(TIMEOUT_MS),
    redirect: 'error',
  });
}

/** UTC calendar day of an ISO timestamp. External activity is not tied to study days. */
const utcDay = (iso: string): string => iso.slice(0, 10);

async function fetchGithubEvents(ctx: Ctx, user: string): Promise<void> {
  const source = `github-events:${user}`;
  const cached = readCache(ctx, source);
  const counts: DayCounts = {};
  let etag: string | null = null;
  // Up to three pages of 100; the API holds at most 300 events.
  for (let page = 1; page <= 3; page++) {
    const headers: Record<string, string> = { 'X-GitHub-Api-Version': '2022-11-28' };
    if (page === 1 && cached?.etag && cached.ok === 1) headers['If-None-Match'] = cached.etag;
    if (ctx.config.github.token) headers.Authorization = `Bearer ${ctx.config.github.token}`;
    const response = await request(
      `https://api.github.com/users/${encodeURIComponent(user)}/events/public?per_page=100&page=${page}`,
      { headers },
    );
    if (page === 1 && response.status === 304) {
      writeCache(ctx, source, { ok: true, etag: cached?.etag ?? null });
      return;
    }
    if (!response.ok) throw new Error(`GitHub events: HTTP ${response.status}`);
    if (page === 1) etag = response.headers.get('etag');
    const events = (await response.json()) as { created_at?: string }[];
    for (const event of events) {
      if (typeof event.created_at === 'string')
        counts[utcDay(event.created_at)] = (counts[utcDay(event.created_at)] ?? 0) + 1;
    }
    if (events.length < 100) break;
  }
  writeCache(ctx, source, { ok: true, data: counts, etag });
}

async function fetchGithubCalendar(ctx: Ctx, user: string): Promise<void> {
  const source = `github-calendar:${user}`;
  const query =
    'query($login: String!) { user(login: $login) { contributionsCollection { contributionCalendar { weeks { contributionDays { date contributionCount } } } } } }';
  const response = await request('https://api.github.com/graphql', {
    method: 'POST',
    headers: { Authorization: `Bearer ${ctx.config.github.token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables: { login: user } }),
  });
  if (!response.ok) throw new Error(`GitHub GraphQL: HTTP ${response.status}`);
  const body = (await response.json()) as {
    errors?: { message: string }[];
    data?: {
      user?: {
        contributionsCollection?: {
          contributionCalendar?: { weeks?: { contributionDays?: { date: string; contributionCount: number }[] }[] };
        };
      };
    };
  };
  if (body.errors?.length) throw new Error(`GitHub GraphQL: ${body.errors[0]!.message}`);
  const counts: DayCounts = {};
  for (const week of body.data?.user?.contributionsCollection?.contributionCalendar?.weeks ?? []) {
    for (const day of week.contributionDays ?? [])
      if (day.contributionCount > 0) counts[day.date] = day.contributionCount;
  }
  writeCache(ctx, source, { ok: true, data: counts });
}

async function fetchForgejo(ctx: Ctx, baseUrl: string, user: string): Promise<void> {
  const source = `forgejo:${baseUrl}:${user}`;
  const headers: Record<string, string> = {};
  if (ctx.config.forgejo.token) headers.Authorization = `token ${ctx.config.forgejo.token}`;
  const response = await request(`${baseUrl}/api/v1/users/${encodeURIComponent(user)}/heatmap`, { headers });
  if (!response.ok) throw new Error(`Forgejo heatmap: HTTP ${response.status}`);
  const entries = (await response.json()) as { timestamp?: number; contributions?: number }[];
  const counts: DayCounts = {};
  for (const entry of entries) {
    if (typeof entry.timestamp !== 'number' || typeof entry.contributions !== 'number') continue;
    const day = new Date(entry.timestamp * 1000).toISOString().slice(0, 10);
    counts[day] = (counts[day] ?? 0) + entry.contributions;
  }
  writeCache(ctx, source, { ok: true, data: counts });
}

interface SourceSpec {
  id: string;
  label: string;
  note: string | null;
  run: () => Promise<void>;
}

function sources(ctx: Ctx): SourceSpec[] {
  const settings = getSettings(ctx);
  const list: SourceSpec[] = [];
  if (settings.githubUser) {
    const user = settings.githubUser;
    if (ctx.config.github.token) {
      list.push({
        id: `github-calendar:${user}`,
        label: `GitHub · ${user}`,
        note: null,
        run: () => fetchGithubCalendar(ctx, user),
      });
    } else {
      list.push({
        id: `github-events:${user}`,
        label: `GitHub · ${user}`,
        note: 'public events, last 30 days',
        run: () => fetchGithubEvents(ctx, user),
      });
    }
  }
  if (settings.forgejoUrl && settings.forgejoUser) {
    const url = settings.forgejoUrl;
    const user = settings.forgejoUser;
    let host = url;
    try {
      host = new URL(url).host;
    } catch {
      // keep the raw value as a label
    }
    list.push({
      id: `forgejo:${url}:${user}`,
      label: `${host} · ${user}`,
      note: null,
      run: () => fetchForgejo(ctx, url, user),
    });
  }
  return list;
}

/** Refresh every configured source that is older than the refresh interval. */
export async function refreshForge(ctx: Ctx, force = false): Promise<void> {
  for (const source of sources(ctx)) {
    const cached = readCache(ctx, source.id);
    if (!force && cached && ctx.now() - cached.fetched_at < REFRESH_MS) continue;
    try {
      await source.run();
      log.debug('forge source refreshed', { source: source.id });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      writeCache(ctx, source.id, { ok: false, error: message.slice(0, 200) });
      log.warn('forge source failed', { source: source.id, ...errorFields(error) });
    }
  }
}

export function forgeOverview(ctx: Ctx): ForgeDto {
  const list = sources(ctx);
  const total: DayCounts = {};
  const dto: ForgeDto['sources'] = [];
  for (const source of list) {
    const cached = readCache(ctx, source.id);
    for (const [day, count] of Object.entries(fromJson<DayCounts>(cached?.data, {})))
      total[day] = (total[day] ?? 0) + count;
    dto.push({
      id: source.id,
      label: source.label,
      ok: cached ? cached.ok === 1 : false,
      fetchedAt: cached?.fetched_at ?? null,
      error: cached?.error ?? null,
      note: source.note,
    });
  }
  return {
    configured: list.length > 0,
    sources: dto,
    days: Object.entries(total)
      .map(([day, count]) => ({ day, count }))
      .sort((a, b) => a.day.localeCompare(b.day)),
  };
}

export function forgeDayCounts(ctx: Ctx): Map<string, number> {
  return new Map(forgeOverview(ctx).days.map((entry) => [entry.day, entry.count]));
}
