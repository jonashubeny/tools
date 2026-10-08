import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { ApiError, MeDto, SettingsDto, StartRunResponse, UserDto } from '@lemma/core';
import type { Hono } from 'hono';
import { afterEach, describe, expect, it } from 'vitest';
import { prepareDatabase } from '../src/accounts';
import { createApp, ensurePassword } from '../src/app';
import { AuthStore } from '../src/auth';
import { loadConfig } from '../src/config';
import { MIGRATIONS } from '../src/db/migrations';
import { latestSchemaVersion, migrate, openDatabase, schemaVersion } from '../src/db';
import type { Provider } from '../src/services/tutor/types';
import { type Harness, harness } from './helpers';

const ADMIN_PASSWORD = 'correct horse battery';

const temporary: string[] = [];
const tempDir = (): string => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lemma-accounts-'));
  temporary.push(dir);
  return dir;
};
afterEach(() => {
  for (const dir of temporary.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
});

const cookieOf = (headers: Headers): string => (headers.get('set-cookie') ?? '').split(';')[0]!;

/** An instance with sign-in on, the administrator's password set, and user databases on disk. */
function instance(options: { provider?: Provider; env?: Record<string, string> } = {}): Harness & { dir: string } {
  const dir = tempDir();
  const h = harness({ auth: true, provider: options.provider, env: { DATA_DIR: dir, ...options.env } });
  ensurePassword(h.db, h.config, h.now());
  return { ...h, dir };
}

async function signIn(h: Harness, username: string | undefined, password: string): Promise<string> {
  const response = await h.send(
    'POST',
    '/api/auth/login',
    username === undefined ? { password } : { username, password },
  );
  expect(response.status).toBe(200);
  return cookieOf(response.headers);
}

const asAdmin = (h: Harness): Promise<string> => signIn(h, undefined, ADMIN_PASSWORD);

async function createUser(
  h: Harness,
  admin: string,
  username: string,
  password: string,
  tutor = false,
): Promise<UserDto> {
  const response = await h.send<UserDto>('POST', '/api/admin/users', { username, password, tutor }, { Cookie: admin });
  expect(response.status).toBe(200);
  return response.body;
}

describe('accounts', () => {
  it('lets the administrator, and nobody else, manage users', async () => {
    const h = instance();
    expect((await h.get('/api/admin/users')).status).toBe(401);

    const admin = await asAdmin(h);
    expect((await h.get<UserDto[]>('/api/admin/users', { Cookie: admin })).body).toEqual([]);

    const petr = await createUser(h, admin, 'Petr', 'petrovo dlouhé heslo');
    expect(petr).toMatchObject({ username: 'petr', tutor: false, lastSeenAt: null });
    await createUser(h, admin, 'anna.k', 'annino dlouhé heslo', true);
    const listed = (await h.get<UserDto[]>('/api/admin/users', { Cookie: admin })).body;
    expect(listed.map((user) => [user.username, user.tutor])).toEqual([
      ['anna.k', true],
      ['petr', false],
    ]);

    // What is refused, and why.
    const refuse = async (body: Record<string, unknown>): Promise<[number, string]> => {
      const response = await h.send<ApiError>('POST', '/api/admin/users', body, { Cookie: admin });
      return [response.status, response.body.error];
    };
    expect(await refuse({ username: 'petr', password: 'another long one' })).toEqual([409, 'username_taken']);
    expect(await refuse({ username: 'PETR', password: 'another long one' })).toEqual([409, 'username_taken']);
    expect(await refuse({ username: 'admin', password: 'another long one' })).toEqual([409, 'username_taken']);
    expect(await refuse({ username: 'jana', password: 'short' })).toEqual([400, 'bad_request']);
    expect(await refuse({ username: 'jana' })).toEqual([400, 'bad_request']);
    // A username becomes a directory name, so nothing that could leave the users directory.
    for (const username of ['../admin', 'a', '.hidden', 'a/b', 'jana novak', 'ž', `${'x'.repeat(33)}`])
      expect(await refuse({ username, password: 'another long one' })).toEqual([400, 'bad_request']);

    // A user is a learner, not an administrator.
    const user = await signIn(h, 'petr', 'petrovo dlouhé heslo');
    for (const [method, url] of [
      ['GET', '/api/admin/users'],
      ['POST', '/api/admin/users'],
      ['PUT', '/api/admin/users/anna.k'],
      ['POST', '/api/admin/users/anna.k/password'],
      ['DELETE', '/api/admin/users/anna.k'],
      ['POST', '/api/admin/backup'],
    ] as const) {
      const response =
        method === 'GET'
          ? await h.get<ApiError>(url, { Cookie: user })
          : await h.send<ApiError>(
              method,
              url,
              { username: 'x1', password: 'long enough', tutor: true },
              { Cookie: user },
            );
      expect([method, url, response.status, response.body.error]).toEqual([method, url, 403, 'forbidden']);
    }
    expect((await h.get<UserDto[]>('/api/admin/users', { Cookie: admin })).body).toHaveLength(2);
  });

  it('signs each account in with its own name and password', async () => {
    const h = instance();
    expect((await h.get<MeDto>('/api/me')).body).toMatchObject({
      authenticated: false,
      account: null,
      hasUsers: false,
    });

    const admin = await asAdmin(h);
    expect((await h.get<MeDto>('/api/me', { Cookie: admin })).body.account).toEqual({ username: 'admin', admin: true });
    await createUser(h, admin, 'petr', 'petrovo dlouhé heslo');
    // The sign-in page learns that a name is needed now — and nothing more.
    expect((await h.get<MeDto>('/api/me')).body).toMatchObject({ authenticated: false, account: null, hasUsers: true });

    const petr = await signIn(h, ' Petr ', 'petrovo dlouhé heslo');
    expect((await h.get<MeDto>('/api/me', { Cookie: petr })).body.account).toEqual({ username: 'petr', admin: false });
    // The administrator's name may be given or left out, in any case.
    await signIn(h, 'admin', ADMIN_PASSWORD);
    await signIn(h, 'ADMIN', ADMIN_PASSWORD);
    await signIn(h, '', ADMIN_PASSWORD);

    const attempt = async (body: Record<string, unknown>): Promise<number> =>
      (await h.send('POST', '/api/auth/login', body)).status;
    // One account's password opens no other account, and a name nobody has opens nothing.
    expect(await attempt({ username: 'petr', password: ADMIN_PASSWORD })).toBe(401);
    expect(await attempt({ username: 'admin', password: 'petrovo dlouhé heslo' })).toBe(401);
    expect(await attempt({ password: 'petrovo dlouhé heslo' })).toBe(401);
    expect(await attempt({ username: 'nobody', password: 'petrovo dlouhé heslo' })).toBe(401);
  });

  it('keeps every learner in a database of their own', async () => {
    const h = instance();
    const admin = await asAdmin(h);
    await createUser(h, admin, 'petr', 'petrovo dlouhé heslo');
    await createUser(h, admin, 'anna', 'annino dlouhé heslo');
    const petr = await signIn(h, 'petr', 'petrovo dlouhé heslo');
    const anna = await signIn(h, 'anna', 'annino dlouhé heslo');
    const people = { admin, petr, anna };

    // A new account starts empty, whatever the others have done.
    for (const cookie of Object.values(people))
      expect((await h.get<MeDto>('/api/me', { Cookie: cookie })).body.onboarded).toBe(false);

    const problems: Record<string, string> = {};
    for (const [name, cookie] of Object.entries(people)) {
      const onboarded = await h.send<SettingsDto>(
        'POST',
        '/api/onboarding',
        { name, locale: 'en' },
        { Cookie: cookie },
      );
      expect(onboarded.status).toBe(200);
      const run = await h.send<StartRunResponse>(
        'POST',
        '/api/practice/start',
        { context: 'blocked', concept: 'lin.graph', count: 1 },
        { Cookie: cookie },
      );
      expect(run.status).toBe(200);
      problems[name] = run.body.problem!.id;
    }

    type Export = { tables: { problems: { id: string }[]; settings: { key: string; value: string }[] } };
    for (const [name, cookie] of Object.entries(people)) {
      const me = (await h.get<MeDto>('/api/me', { Cookie: cookie })).body;
      expect([me.account!.username, me.onboarded, me.settings.name]).toEqual([name, true, name]);

      // Their own problem, and nobody else's: another learner's is simply not there.
      for (const [owner, id] of Object.entries(problems))
        expect([owner, (await h.get(`/api/problems/${id}`, { Cookie: cookie })).status]).toEqual([
          owner,
          owner === name ? 200 : 404,
        ]);
      const dump = (await h.get<Export>('/api/data/export', { Cookie: cookie })).body;
      expect(dump.tables.problems.map((problem) => problem.id)).toEqual([problems[name]]);
    }

    // On disk: the administrator's database is the main one, and each user has a directory.
    const idsIn = (file: string): string[] => {
      const db = openDatabase(file);
      const ids = (db.prepare('SELECT id FROM problems').all() as { id: string }[]).map((row) => row.id);
      db.close();
      return ids;
    };
    expect((h.db.prepare('SELECT id FROM problems').all() as { id: string }[]).map((row) => row.id)).toEqual([
      problems.admin,
    ]);
    expect(idsIn(path.join(h.dir, 'users', 'petr', 'lemma.sqlite'))).toEqual([problems.petr]);
    expect(idsIn(path.join(h.dir, 'users', 'anna', 'lemma.sqlite'))).toEqual([problems.anna]);
    expect(fs.readdirSync(path.join(h.dir, 'users')).sort()).toEqual(['anna', 'petr']);
  });

  it('finds every user and their data again after a restart', async () => {
    const h = instance();
    const admin = await asAdmin(h);
    await createUser(h, admin, 'petr', 'petrovo dlouhé heslo');
    const petr = await signIn(h, 'petr', 'petrovo dlouhé heslo');
    await h.send('POST', '/api/onboarding', { name: 'Petr' }, { Cookie: petr });

    // A second application over the same main database, as after a restart: nothing about
    // the users is kept in memory that the databases do not hold.
    const restarted = createApp({ db: h.db, config: h.config, now: h.now }) as unknown as Hono;
    const me = (await (await restarted.request('/api/me', { headers: { Cookie: petr } })).json()) as MeDto;
    expect([me.authenticated, me.account?.username, me.onboarded, me.settings.name]).toEqual([
      true,
      'petr',
      true,
      'Petr',
    ]);
  });

  it('changes and resets passwords without touching anyone else', async () => {
    const h = instance();
    const admin = await asAdmin(h);
    await createUser(h, admin, 'petr', 'petrovo dlouhé heslo');
    const phone = await signIn(h, 'petr', 'petrovo dlouhé heslo');
    const laptop = await signIn(h, 'petr', 'petrovo dlouhé heslo');
    const status = async (cookie: string): Promise<number> =>
      (await h.get('/api/dashboard', { Cookie: cookie })).status;

    // A user changes their own password: their other devices are signed out, nobody else is.
    expect(
      (
        await h.send(
          'POST',
          '/api/auth/password',
          { current: ADMIN_PASSWORD, next: 'nové dlouhé heslo' },
          { Cookie: phone },
        )
      ).status,
    ).toBe(401);
    const changed = await h.send(
      'POST',
      '/api/auth/password',
      { current: 'petrovo dlouhé heslo', next: 'nové dlouhé heslo' },
      { Cookie: phone },
    );
    expect(changed.status).toBe(200);
    expect([await status(laptop), await status(cookieOf(changed.headers)), await status(admin)]).toEqual([
      401, 200, 200,
    ]);
    expect(
      (await h.send('POST', '/api/auth/login', { username: 'petr', password: 'petrovo dlouhé heslo' })).status,
    ).toBe(401);
    // The administrator's password is untouched by it.
    await asAdmin(h);

    // The administrator gives a user a new password: the user is signed out and signs in with it.
    const session = await signIn(h, 'petr', 'nové dlouhé heslo');
    const set = (password: string): Promise<{ status: number }> =>
      h.send('POST', '/api/admin/users/petr/password', { password }, { Cookie: admin });
    expect((await set('short')).status).toBe(400);
    expect((await set('heslo od správce')).status).toBe(200);
    expect(await status(session)).toBe(401);
    expect((await h.send('POST', '/api/auth/login', { username: 'petr', password: 'nové dlouhé heslo' })).status).toBe(
      401,
    );
    const again = await signIn(h, 'petr', 'heslo od správce');
    expect(
      (await h.send('POST', '/api/admin/users/nobody/password', { password: 'long enough' }, { Cookie: admin })).status,
    ).toBe(404);

    // The administrator changes their own: users stay signed in.
    const own = await h.send(
      'POST',
      '/api/auth/password',
      { current: ADMIN_PASSWORD, next: 'správcovo nové heslo' },
      { Cookie: admin },
    );
    expect(own.status).toBe(200);
    expect([await status(admin), await status(cookieOf(own.headers)), await status(again)]).toEqual([401, 200, 200]);

    // And the way back in through .env signs the administrator out, not the users.
    ensurePassword(h.db, loadConfig({ LEMMA_PASSWORD: 'heslo ze souboru env', LEMMA_PASSWORD_RESET: '1' }), h.now());
    expect([await status(cookieOf(own.headers)), await status(again)]).toEqual([401, 200]);
    await signIn(h, 'admin', 'heslo ze souboru env');
  });

  it('removes an account, signs it out, and sets its data aside', async () => {
    const h = instance();
    const admin = await asAdmin(h);
    await createUser(h, admin, 'petr', 'petrovo dlouhé heslo');
    const petr = await signIn(h, 'petr', 'petrovo dlouhé heslo');
    await h.send('POST', '/api/onboarding', { name: 'Petr' }, { Cookie: petr });

    expect((await h.send('DELETE', '/api/admin/users/nobody', undefined, { Cookie: admin })).status).toBe(404);
    expect((await h.send('DELETE', '/api/admin/users/petr', undefined, { Cookie: admin })).status).toBe(200);
    expect((await h.get('/api/dashboard', { Cookie: petr })).status).toBe(401);
    expect(
      (await h.send('POST', '/api/auth/login', { username: 'petr', password: 'petrovo dlouhé heslo' })).status,
    ).toBe(401);
    expect((await h.get<UserDto[]>('/api/admin/users', { Cookie: admin })).body).toEqual([]);
    expect(
      (h.db.prepare('SELECT COUNT(*) AS n FROM sessions WHERE username IS NOT NULL').get() as { n: number }).n,
    ).toBe(0);

    // The data is not destroyed: it waits in users/.deleted, complete.
    expect(fs.readdirSync(path.join(h.dir, 'users'))).toEqual(['.deleted']);
    const [aside] = fs.readdirSync(path.join(h.dir, 'users', '.deleted'));
    expect(aside).toMatch(/^petr-\d{4}-\d{2}-\d{2}T/);
    const kept = openDatabase(path.join(h.dir, 'users', '.deleted', aside!, 'lemma.sqlite'));
    expect(
      (kept.prepare(`SELECT value FROM settings WHERE key = 'profile'`).get() as { value: string }).value,
    ).toContain('Petr');
    kept.close();

    // The name is free again, and whoever takes it starts from nothing.
    await createUser(h, admin, 'petr', 'jiný petr, jiné heslo');
    const other = await signIn(h, 'petr', 'jiný petr, jiné heslo');
    expect((await h.get<MeDto>('/api/me', { Cookie: other })).body).toMatchObject({
      onboarded: false,
      settings: { name: '' },
    });
  });

  it('adopts a database that is already in place, as when a learner moves in from another instance', async () => {
    // Somebody's single-user instance, with a password of its own.
    const elsewhere = tempDir();
    const config = loadConfig({ DATA_DIR: elsewhere, LEMMA_PASSWORD: 'heslo z jiné instance' });
    const theirs = await prepareDatabase(path.join(elsewhere, 'lemma.sqlite'), config, () => 1000);
    ensurePassword(theirs, config, 1000);
    theirs
      .prepare(`INSERT INTO settings (key, value, updated_at) VALUES ('profile', ?, 1), ('onboarded', 'true', 1)`)
      .run(JSON.stringify({ name: 'Eva' }));
    theirs.pragma('wal_checkpoint(TRUNCATE)');
    theirs.close();

    const h = instance();
    fs.mkdirSync(path.join(h.dir, 'users', 'eva'), { recursive: true });
    fs.copyFileSync(path.join(elsewhere, 'lemma.sqlite'), path.join(h.dir, 'users', 'eva', 'lemma.sqlite'));
    const admin = await asAdmin(h);
    await createUser(h, admin, 'eva', 'heslo od nového správce');

    // The password the administrator chose applies; the one that came with the file does not.
    expect(
      (await h.send('POST', '/api/auth/login', { username: 'eva', password: 'heslo z jiné instance' })).status,
    ).toBe(401);
    const eva = await signIn(h, 'eva', 'heslo od nového správce');
    expect((await h.get<MeDto>('/api/me', { Cookie: eva })).body).toMatchObject({
      onboarded: true,
      settings: { name: 'Eva' },
    });
  });

  it('lets a user talk to the tutor only once the administrator allows it', async () => {
    const provider: Provider = async (input) => {
      input.onText('ok');
      return { stop: 'complete', model: 'test-model', toolCalls: 0 };
    };
    const h = instance({ provider });
    const admin = await asAdmin(h);
    await createUser(h, admin, 'petr', 'petrovo dlouhé heslo');
    const petr = await signIn(h, 'petr', 'petrovo dlouhé heslo');
    const chat = async (cookie: string): Promise<[number, string]> => {
      const response = await h.app.request('/api/tutor/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: cookie },
        body: JSON.stringify({ mode: 'socratic', message: 'Ahoj' }),
      });
      const text = await response.text();
      return [response.status, response.status === 200 ? 'stream' : (JSON.parse(text) as ApiError).error];
    };
    const tutor = async (cookie: string): Promise<boolean> =>
      (await h.get<MeDto>('/api/me', { Cookie: cookie })).body.tutor.enabled;

    // The model runs on the instance's key, so a new account does not get it by default.
    expect([await tutor(admin), await tutor(petr)]).toEqual([true, false]);
    expect(await chat(petr)).toEqual([403, 'tutor_not_allowed']);
    expect(await chat(admin)).toEqual([200, 'stream']);

    const allowed = await h.send<UserDto>('PUT', '/api/admin/users/petr', { tutor: true }, { Cookie: admin });
    expect(allowed.body).toMatchObject({ username: 'petr', tutor: true });
    expect(await tutor(petr)).toBe(true);
    expect(await chat(petr)).toEqual([200, 'stream']);
    // The conversation is the user's own: the administrator's list does not show it.
    expect((await h.get<unknown[]>('/api/tutor/threads', { Cookie: petr })).body).toHaveLength(1);
    expect((await h.get<unknown[]>('/api/tutor/threads', { Cookie: admin })).body).toHaveLength(1);
    expect((h.db.prepare('SELECT COUNT(*) AS n FROM tutor_threads').get() as { n: number }).n).toBe(1);

    expect((await h.send('PUT', '/api/admin/users/petr', { tutor: 'yes' }, { Cookie: admin })).status).toBe(400);
    await h.send('PUT', '/api/admin/users/petr', { tutor: false }, { Cookie: admin });
    expect(await chat(petr)).toEqual([403, 'tutor_not_allowed']);
  });

  it("keeps the administrator's integrations from .env to the administrator", async () => {
    const h = instance({
      env: {
        GITHUB_USERNAME: 'the-admin',
        GITHUB_TOKEN: 'ghp_secret',
        FORGEJO_URL: 'https://git.example.org',
        FORGEJO_USERNAME: 'the-admin',
        FORGEJO_TOKEN: 'forgejo_secret',
      },
    });
    const admin = await asAdmin(h);
    await createUser(h, admin, 'petr', 'petrovo dlouhé heslo');
    const petr = await signIn(h, 'petr', 'petrovo dlouhé heslo');

    const own = (await h.get<SettingsDto>('/api/settings', { Cookie: admin })).body;
    expect([own.githubUser, own.forgejoUrl, own.forgejoUser]).toEqual([
      'the-admin',
      'https://git.example.org',
      'the-admin',
    ]);
    const theirs = (await h.get<SettingsDto>('/api/settings', { Cookie: petr })).body;
    expect([theirs.githubUser, theirs.forgejoUrl, theirs.forgejoUser]).toEqual(['', '', '']);

    // A user may name their GitHub account, which is always asked at github.com. A Forgejo
    // address would make the server call a host of the user's choosing, so it is not theirs to set.
    const patched = await h.send<SettingsDto>(
      'PUT',
      '/api/settings',
      { githubUser: 'petr-gh', forgejoUrl: 'https://intranet.example.org', forgejoUser: 'petr' },
      { Cookie: petr },
    );
    expect([patched.body.githubUser, patched.body.forgejoUrl, patched.body.forgejoUser]).toEqual(['petr-gh', '', '']);
    const adminPatched = await h.send<SettingsDto>(
      'PUT',
      '/api/settings',
      { forgejoUrl: 'https://code.example.org' },
      { Cookie: admin },
    );
    expect(adminPatched.body.forgejoUrl).toBe('https://code.example.org');
  });

  it('backs up every database beside itself, on request and for the administrator only', async () => {
    const h = instance();
    const admin = await asAdmin(h);
    await createUser(h, admin, 'petr', 'petrovo dlouhé heslo');
    const backup = await h.send<{ file: string; databases: number }>(
      'POST',
      '/api/admin/backup',
      {},
      { Cookie: admin },
    );
    expect(backup.status).toBe(200);
    expect(backup.body.databases).toBe(2);
    expect(fs.readdirSync(path.join(h.dir, 'backups'))).toEqual([backup.body.file]);
    expect(fs.readdirSync(path.join(h.dir, 'users', 'petr', 'backups'))).toEqual([backup.body.file]);
  });

  it('has no use for other accounts while sign-in is switched off', async () => {
    const h = harness({ env: { DATA_DIR: tempDir() } });
    // Without sign-in whoever opens the page is the administrator.
    expect((await h.get<MeDto>('/api/me')).body.account).toEqual({ username: 'admin', admin: true });
    const refused = await h.send<ApiError>('POST', '/api/admin/users', { username: 'petr', password: 'long enough' });
    expect([refused.status, refused.body.error]).toEqual([409, 'auth_disabled']);
  });
});

describe('opening a database', () => {
  const sha256 = (value: string): string => createHash('sha256').update(value).digest('hex');

  it('brings a single-user database forward without signing anyone out', () => {
    // A database as version 0.1.0 left it: the first schema, one password, one session.
    const db = openDatabase(':memory:');
    db.exec(MIGRATIONS[0]!.sql);
    db.pragma('user_version = 1');
    const auth = new AuthStore(db, 30);
    auth.setPassword('heslo z dřívějška', 1000);
    db.prepare(
      'INSERT INTO sessions (token_hash, created_at, expires_at, last_seen_at, user_agent) VALUES (?, 1000, 9999999, 1000, NULL)',
    ).run(sha256('an old cookie'));

    expect(schemaVersion(db)).toBe(1);
    expect(migrate(db)).toEqual(MIGRATIONS.slice(1).map((migration) => migration.id));
    expect(schemaVersion(db)).toBe(latestSchemaVersion());

    // The session that existed is the administrator's, and still valid; so is the password.
    expect(auth.sessionOwner('an old cookie', 2000)).toBeNull();
    expect(auth.sessionOwner('forged', 2000)).toBeUndefined();
    expect(auth.checkPassword('heslo z dřívějška')).toBe(true);
  });

  it('backs a database up before changing its schema, and refuses one from a newer version', async () => {
    const dir = tempDir();
    const file = path.join(dir, 'lemma.sqlite');
    const config = loadConfig({ DATA_DIR: dir });
    const old = openDatabase(file);
    old.exec(MIGRATIONS[0]!.sql);
    old.pragma('user_version = 1');
    old.prepare(`INSERT INTO settings (key, value, updated_at) VALUES ('probe', '"before"', 1)`).run();
    old.close();

    const db = await prepareDatabase(file, config, () => 5000);
    expect(schemaVersion(db)).toBe(latestSchemaVersion());
    const backups = fs.readdirSync(path.join(dir, 'backups'));
    expect(backups).toEqual([`lemma-before-schema-${latestSchemaVersion()}-5000.sqlite`]);
    const copy = openDatabase(path.join(dir, 'backups', backups[0]!));
    expect(schemaVersion(copy)).toBe(1);
    copy.close();

    db.pragma(`user_version = ${latestSchemaVersion() + 1}`);
    db.close();
    await expect(prepareDatabase(file, config, () => 6000)).rejects.toThrow(/written by a newer version/);
  });
});
