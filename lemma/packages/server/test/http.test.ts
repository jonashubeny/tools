import type { ApiError, MeDto, SettingsDto } from '@lemma/core';
import { describe, expect, it } from 'vitest';
import { ensurePassword } from '../src/app';
import { DAY, harness } from './helpers';

const cookieOf = (headers: Headers): string => (headers.get('set-cookie') ?? '').split(';')[0]!;

describe('health and security headers', () => {
  it('reports health without authentication', async () => {
    const h = harness({ auth: true });
    const { status, body, headers } = await h.get<{ status: string; schema: number }>('/healthz');
    expect(status).toBe(200);
    expect(body.status).toBe('ok');
    expect(body.schema).toBeGreaterThan(0);
    expect(headers.get('content-security-policy')).toContain("default-src 'self'");
    expect(headers.get('x-content-type-options')).toBe('nosniff');
    expect(headers.get('x-frame-options')).toBe('DENY');
  });

  it('never lets API responses be cached', async () => {
    const h = harness();
    expect((await h.get('/api/me')).headers.get('cache-control')).toBe('no-store');
  });

  it('answers unknown API paths with JSON, not with the web app', async () => {
    const h = harness();
    const { status, body } = await h.get<ApiError>('/api/does-not-exist');
    expect(status).toBe(404);
    expect(body.error).toBe('not_found');
  });

  it('rejects a body that is not JSON', async () => {
    const h = harness();
    const response = await h.app.request('/api/settings', {
      method: 'PUT',
      body: '{not json',
      headers: { 'Content-Type': 'application/json' },
    });
    expect(response.status).toBe(400);
    expect(((await response.json()) as ApiError).error).toBe('bad_json');
  });
});

describe('authentication', () => {
  it('requires a password of sensible length on first start', () => {
    const h = harness({ auth: true, env: { LEMMA_PASSWORD: 'short' } });
    expect(() => ensurePassword(h.db, h.config, h.now())).toThrow(/LEMMA_PASSWORD/);
  });

  it('protects the API, signs in with the password, and signs out', async () => {
    const h = harness({ auth: true });
    ensurePassword(h.db, h.config, h.now());

    const anonymous = await h.get<MeDto>('/api/me');
    expect(anonymous.body.authenticated).toBe(false);
    expect(anonymous.body.authRequired).toBe(true);
    // Nothing personal is revealed before signing in.
    expect(anonymous.body.settings.name).toBe('');
    expect(anonymous.body.tutor.enabled).toBe(false);
    expect((await h.get('/api/dashboard')).status).toBe(401);

    const wrong = await h.send<ApiError>('POST', '/api/auth/login', { password: 'nope' });
    expect(wrong.status).toBe(401);

    const login = await h.send('POST', '/api/auth/login', { password: 'correct horse battery' });
    expect(login.status).toBe(200);
    const setCookie = login.headers.get('set-cookie') ?? '';
    expect(setCookie).toContain('HttpOnly');
    expect(setCookie).toContain('SameSite=Lax');
    const cookie = cookieOf(login.headers);

    const me = await h.get<MeDto>('/api/me', { Cookie: cookie });
    expect(me.body.authenticated).toBe(true);
    expect((await h.get('/api/dashboard', { Cookie: cookie })).status).toBe(200);

    await h.send('POST', '/api/auth/logout', {}, { Cookie: cookie });
    expect((await h.get('/api/dashboard', { Cookie: cookie })).status).toBe(401);
  });

  it('expires sessions', async () => {
    const h = harness({ auth: true, env: { SESSION_DAYS: '2' } });
    ensurePassword(h.db, h.config, h.now());
    const cookie = cookieOf((await h.send('POST', '/api/auth/login', { password: 'correct horse battery' })).headers);
    h.advance(DAY);
    expect((await h.get('/api/dashboard', { Cookie: cookie })).status).toBe(200);
    h.advance(2 * DAY);
    expect((await h.get('/api/dashboard', { Cookie: cookie })).status).toBe(401);
  });

  it('throttles guessing', async () => {
    const h = harness({ auth: true });
    ensurePassword(h.db, h.config, h.now());
    for (let i = 0; i < 5; i++)
      expect((await h.send('POST', '/api/auth/login', { password: `guess ${i}` })).status).toBe(401);
    const blocked = await h.send<ApiError>('POST', '/api/auth/login', { password: 'correct horse battery' });
    expect(blocked.status).toBe(429);
    expect(blocked.headers.get('retry-after')).toBe('2');
    h.advance(2_500);
    expect((await h.send('POST', '/api/auth/login', { password: 'correct horse battery' })).status).toBe(200);
  });

  it('changes the password and signs other sessions out', async () => {
    const h = harness({ auth: true });
    ensurePassword(h.db, h.config, h.now());
    const first = cookieOf((await h.send('POST', '/api/auth/login', { password: 'correct horse battery' })).headers);
    const second = cookieOf((await h.send('POST', '/api/auth/login', { password: 'correct horse battery' })).headers);

    expect(
      (await h.send('POST', '/api/auth/password', { current: 'wrong', next: 'a new long password' }, { Cookie: first }))
        .status,
    ).toBe(401);
    expect(
      (
        await h.send(
          'POST',
          '/api/auth/password',
          { current: 'correct horse battery', next: 'short' },
          { Cookie: first },
        )
      ).status,
    ).toBe(400);
    const changed = await h.send(
      'POST',
      '/api/auth/password',
      { current: 'correct horse battery', next: 'a new long password' },
      { Cookie: first },
    );
    expect(changed.status).toBe(200);

    expect((await h.get('/api/dashboard', { Cookie: second })).status).toBe(401);
    expect((await h.get('/api/dashboard', { Cookie: cookieOf(changed.headers) })).status).toBe(200);
    expect((await h.send('POST', '/api/auth/login', { password: 'correct horse battery' })).status).toBe(401);
    expect((await h.send('POST', '/api/auth/login', { password: 'a new long password' })).status).toBe(200);
  });

  it('refuses state-changing requests from another origin', async () => {
    const h = harness();
    const foreign = await h.send<ApiError>(
      'PUT',
      '/api/settings',
      { name: 'x' },
      { Origin: 'https://evil.example', Host: 'lemma.local' },
    );
    expect(foreign.status).toBe(403);
    expect(foreign.body.error).toBe('bad_origin');
    const own = await h.send(
      'PUT',
      '/api/settings',
      { name: 'Jonas' },
      { Origin: 'http://lemma.local', Host: 'lemma.local' },
    );
    expect(own.status).toBe(200);
  });

  it('accepts origins that were allowed explicitly', async () => {
    const h = harness({ env: { ALLOWED_ORIGINS: 'https://lemma.example.org/' } });
    const response = await h.send(
      'PUT',
      '/api/settings',
      { name: 'Jonas' },
      { Origin: 'https://lemma.example.org', Host: 'internal:8000' },
    );
    expect(response.status).toBe(200);
  });
});

describe('settings', () => {
  it('stores valid values and ignores malformed ones', async () => {
    const h = harness();
    const { body } = await h.send<SettingsDto>('PUT', '/api/settings', {
      name: '  Jonas  ',
      locale: 'en',
      theme: 'neon',
      sessionMinutes: 1000,
      weekGoal: 'many',
      currentTopic: 3,
      tests: [
        { day: '2026-10-20', topics: [3, 4], title: 'Kvadratické funkce' },
        { day: 'soon', topics: [1] },
      ],
      pauses: [
        { from: '2026-12-24', to: '2027-01-02', label: 'Vánoce' },
        { from: '2027-02-10', to: '2027-02-01' },
      ],
      gradeScale: [90, 75, 50, 30],
      githubUser: 'not a valid user!',
      forgejoUrl: 'javascript:alert(1)',
    });
    expect(body.name).toBe('Jonas');
    expect(body.locale).toBe('en');
    expect(body.theme).toBe('dark');
    expect(body.sessionMinutes).toBe(180);
    expect(body.weekGoal).toBe(4);
    expect(body.currentTopic).toBe(3);
    expect(body.tests).toHaveLength(1);
    expect(body.tests[0]).toMatchObject({ day: '2026-10-20', topics: [3, 4] });
    expect(body.pauses).toEqual([{ from: '2026-12-24', to: '2027-01-02', label: 'Vánoce' }]);
    expect(body.githubUser).toBe('');
    expect(body.forgejoUrl).toBe('');
    // And they persist.
    expect((await h.get<SettingsDto>('/api/settings')).body.currentTopic).toBe(3);
  });

  it('marks onboarding as done', async () => {
    const h = harness();
    expect((await h.get<MeDto>('/api/me')).body.onboarded).toBe(false);
    await h.send('POST', '/api/onboarding', { name: 'Jonas', currentTopic: 1 });
    expect((await h.get<MeDto>('/api/me')).body.onboarded).toBe(true);
  });
});
