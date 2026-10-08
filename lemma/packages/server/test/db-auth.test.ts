import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ensurePassword } from '../src/app';
import { AuthStore, LoginThrottle, hashPassword, verifyPassword } from '../src/auth';
import { loadConfig } from '../src/config';
import { backupDatabase, backupDay, latestSchemaVersion, migrate, openDatabase, schemaVersion } from '../src/db';
import { setLogLevel } from '../src/log';

setLogLevel('error');

const temporary: string[] = [];
const tempDir = (): string => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lemma-test-'));
  temporary.push(dir);
  return dir;
};
afterEach(() => {
  for (const dir of temporary.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
});

describe('database', () => {
  it('migrates a fresh database to the latest schema, once', () => {
    const db = openDatabase(':memory:');
    expect(schemaVersion(db)).toBe(0);
    expect(migrate(db).length).toBeGreaterThan(0);
    expect(schemaVersion(db)).toBe(latestSchemaVersion());
    expect(migrate(db)).toEqual([]);
    const tables = (db.prepare(`SELECT name FROM sqlite_master WHERE type = 'table'`).all() as { name: string }[]).map(
      (row) => row.name,
    );
    for (const table of [
      'auth',
      'sessions',
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
      'forge_cache',
    ]) {
      expect(tables).toContain(table);
    }
  });

  it('enforces foreign keys', () => {
    const db = openDatabase(':memory:');
    migrate(db);
    expect(() =>
      db.prepare(`INSERT INTO tutor_messages (thread_id, role, content, at) VALUES ('missing', 'user', 'x', 1)`).run(),
    ).toThrow();
  });

  it('uses write-ahead logging on disk and creates the data directory', () => {
    const dir = path.join(tempDir(), 'nested', 'data');
    const db = openDatabase(path.join(dir, 'lemma.sqlite'));
    expect(db.pragma('journal_mode', { simple: true })).toBe('wal');
    db.close();
  });

  // Root may write anywhere, so as root there is nothing to observe.
  it.skipIf(process.getuid?.() === 0)('says whose storage it cannot write instead of failing obscurely', () => {
    const dir = tempDir();
    const file = path.join(dir, 'lemma.sqlite');
    openDatabase(file).close();
    const me = `${process.getuid?.()}:${process.getgid?.()}`;

    // A database file the app may not write: SQLite would open it read-only and fail at the first write.
    fs.chmodSync(file, 0o444);
    expect(() => openDatabase(file)).toThrow(`lemma.sqlite belongs to ${me} and is not writable for user ${me}`);
    expect(() => openDatabase(file)).toThrow('chmod u+rwX');

    // The usual cause in a container is a file restored by root into the volume. Only root
    // can make such a file, so its owner is faked here.
    const owner = vi.spyOn(fs, 'statSync').mockReturnValue({ uid: 0, gid: 0 } as fs.Stats);
    try {
      expect(() => openDatabase(file)).toThrow(
        `lemma.sqlite belongs to 0:0 and is not writable for user ${me} (EACCES: permission denied, access '${file}'). ` +
          `Give it to that user (chown -R ${me}), or run the app as its owner (LEMMA_UID and LEMMA_GID in .env).`,
      );
    } finally {
      owner.mockRestore();
    }
    fs.chmodSync(file, 0o644);

    // A data directory the app may not write: SQLite would say "unable to open database file".
    fs.chmodSync(dir, 0o555);
    try {
      expect(() => openDatabase(file)).toThrow(/^\S+ belongs to \d+:\d+ and is not writable for user \d+:\d+ \(EACCES/);
    } finally {
      fs.chmodSync(dir, 0o755);
    }
    openDatabase(file).close();
  });

  it('writes a restorable backup and prunes old daily copies', async () => {
    const dir = tempDir();
    const db = openDatabase(path.join(dir, 'lemma.sqlite'));
    migrate(db);
    db.prepare(`INSERT INTO settings (key, value, updated_at) VALUES ('probe', '"kept"', 1)`).run();

    for (const day of ['2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04']) await backupDatabase(db, dir, day, 2);
    // A manual backup is never pruned.
    await backupDatabase(db, dir, 'manual-2026-10-04-1', 0);
    const files = fs.readdirSync(path.join(dir, 'backups')).sort();
    expect(files).toEqual(['lemma-2026-10-03.sqlite', 'lemma-2026-10-04.sqlite', 'lemma-manual-2026-10-04-1.sqlite']);

    const copy = openDatabase(path.join(dir, 'backups', 'lemma-2026-10-04.sqlite'));
    expect(schemaVersion(copy)).toBe(latestSchemaVersion());
    expect((copy.prepare(`SELECT value FROM settings WHERE key = 'probe'`).get() as { value: string }).value).toBe(
      '"kept"',
    );
    copy.close();
    db.close();
  });

  it('never replaces the backup a study day already has', async () => {
    const dir = tempDir();
    const db = openDatabase(path.join(dir, 'lemma.sqlite'));
    migrate(db);
    db.prepare(`INSERT INTO settings (key, value, updated_at) VALUES ('probe', '"morning"', 1)`).run();
    expect(await backupDay(db, dir, '2026-10-04', 14)).toBe(path.join(dir, 'backups', 'lemma-2026-10-04.sqlite'));

    // Later the same day, a database that does not remember that backup: restored, or lost and new.
    db.prepare(`UPDATE settings SET value = '"evening"' WHERE key = 'probe'`).run();
    expect(await backupDay(db, dir, '2026-10-04', 14)).toBeUndefined();
    expect(await backupDay(db, dir, '2026-10-05', 14)).toBe(path.join(dir, 'backups', 'lemma-2026-10-05.sqlite'));

    const probe = (day: string): string => {
      const copy = openDatabase(path.join(dir, 'backups', `lemma-${day}.sqlite`));
      const row = copy.prepare(`SELECT value FROM settings WHERE key = 'probe'`).get() as { value: string };
      copy.close();
      return row.value;
    };
    expect(probe('2026-10-04')).toBe('"morning"');
    expect(probe('2026-10-05')).toBe('"evening"');
    db.close();
  });
});

describe('configuration', () => {
  it('has safe defaults', () => {
    const config = loadConfig({});
    expect(config.port).toBe(8000);
    expect(config.timeZone).toBe('Europe/Prague');
    expect(config.authDisabled).toBe(false);
    expect(config.ai.provider).toBe('none');
    expect(config.dayStartHour).toBe(4);
  });

  it('infers the AI provider from the credentials present', () => {
    expect(loadConfig({ ANTHROPIC_API_KEY: 'k' }).ai.provider).toBe('anthropic');
    expect(loadConfig({ OPENAI_BASE_URL: 'http://localhost:11434/v1/' }).ai).toMatchObject({
      provider: 'openai',
      openaiBaseUrl: 'http://localhost:11434/v1',
    });
    expect(loadConfig({ ANTHROPIC_API_KEY: 'k', AI_PROVIDER: 'none' }).ai.provider).toBe('none');
  });

  it('rejects an invalid time zone and clamps numbers', () => {
    expect(() => loadConfig({ LEMMA_TIMEZONE: 'Mars/Olympus' })).toThrow(/time zone/);
    expect(loadConfig({ PORT: '99999999' }).port).toBe(65535);
    expect(loadConfig({ AI_MAX_TOKENS: '10' }).ai.maxTokens).toBe(1024);
    expect(loadConfig({ AI_EFFORT: 'enormous' }).ai.effort).toBe('medium');
  });
});

describe('passwords and sessions', () => {
  it('verifies the right password only', () => {
    const stored = hashPassword('tři malá prasátka');
    expect(stored.startsWith('scrypt$')).toBe(true);
    expect(verifyPassword('tři malá prasátka', stored)).toBe(true);
    expect(verifyPassword('tri mala prasatka', stored)).toBe(false);
    expect(verifyPassword('anything', 'not-a-hash')).toBe(false);
    expect(verifyPassword('anything', 'scrypt$x$y$z$AAAA$AAAA')).toBe(false);
    // Salted: the same password never hashes to the same string.
    expect(hashPassword('same')).not.toBe(hashPassword('same'));
  });

  it('sets the password on first start and resets it only when asked to', () => {
    const db = openDatabase(':memory:');
    migrate(db);
    const auth = new AuthStore(db, 30);
    // First start: a password is required, and a short one is refused.
    expect(() => ensurePassword(db, loadConfig({}), 1000)).toThrow(/LEMMA_PASSWORD/);
    expect(() => ensurePassword(db, loadConfig({ LEMMA_PASSWORD: 'short' }), 1000)).toThrow(/8 characters/);
    ensurePassword(db, loadConfig({ LEMMA_PASSWORD: 'the first password' }), 1000);
    expect(auth.checkPassword('the first password')).toBe(true);
    const session = auth.createSession(1000, 'test');

    // Later starts leave the stored password alone, whatever .env says.
    ensurePassword(db, loadConfig({ LEMMA_PASSWORD: 'something else entirely' }), 2000);
    expect(auth.checkPassword('the first password')).toBe(true);
    expect(auth.validateSession(session.token, 2000)).toBe(true);

    // The way back in after forgetting it: reset, and everyone is signed out.
    expect(() => ensurePassword(db, loadConfig({ LEMMA_PASSWORD_RESET: '1' }), 3000)).toThrow(/LEMMA_PASSWORD/);
    ensurePassword(db, loadConfig({ LEMMA_PASSWORD: 'a brand new password', LEMMA_PASSWORD_RESET: '1' }), 3000);
    expect(auth.checkPassword('the first password')).toBe(false);
    expect(auth.checkPassword('a brand new password')).toBe(true);
    expect(auth.validateSession(session.token, 3000)).toBe(false);
  });

  it('keeps only a hash of the session token and expires sessions', () => {
    const db = openDatabase(':memory:');
    migrate(db);
    const auth = new AuthStore(db, 30);
    expect(auth.hasPassword()).toBe(false);
    auth.setPassword('long enough', 1000);
    expect(auth.hasPassword()).toBe(true);
    expect(auth.checkPassword('long enough')).toBe(true);
    expect(auth.checkPassword('wrong')).toBe(false);

    const session = auth.createSession(1000, 'vitest');
    const stored = db.prepare('SELECT token_hash FROM sessions').get() as { token_hash: string };
    expect(stored.token_hash).not.toContain(session.token);
    expect(auth.validateSession(session.token, 2000)).toBe(true);
    expect(auth.validateSession('forged', 2000)).toBe(false);
    expect(auth.validateSession(undefined, 2000)).toBe(false);
    expect(auth.validateSession(session.token, session.expiresAt + 1)).toBe(false);
    // An expired session is removed when it is seen.
    expect((db.prepare('SELECT COUNT(*) AS n FROM sessions').get() as { n: number }).n).toBe(0);

    const other = auth.createSession(1000, undefined);
    auth.deleteSession(other.token);
    expect(auth.validateSession(other.token, 2000)).toBe(false);
  });

  it('throttles repeated failures and forgets them after a success', () => {
    const throttle = new LoginThrottle();
    for (let i = 0; i < 4; i++) throttle.recordFailure('10.0.0.1', 1000);
    expect(throttle.retryAfter('10.0.0.1', 1000)).toBe(0);
    throttle.recordFailure('10.0.0.1', 1000);
    expect(throttle.retryAfter('10.0.0.1', 1000)).toBe(2000);
    throttle.recordFailure('10.0.0.1', 1000);
    expect(throttle.retryAfter('10.0.0.1', 1000)).toBe(4000);
    // Another client is unaffected.
    expect(throttle.retryAfter('10.0.0.2', 1000)).toBe(0);
    throttle.recordSuccess('10.0.0.1');
    expect(throttle.retryAfter('10.0.0.1', 1000)).toBe(0);
  });
});
