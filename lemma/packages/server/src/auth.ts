import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import type { Db } from './db';

/**
 * Authentication.
 *
 * - A password is stored as a salted scrypt hash (Node's built-in crypto; no native
 *   dependency to keep patched). Every learner's database carries its owner's password,
 *   the administrator's being the main one.
 * - A session is a random 256-bit token. Only its SHA-256 is stored, so a leaked database
 *   does not hand out valid sessions. Sessions of all accounts are kept in the main
 *   database; each names the account it belongs to, and none means the administrator.
 * - Login attempts are throttled per client address with exponential back-off.
 */

const SCRYPT = { N: 1 << 15, r: 8, p: 1, keyLength: 32, maxmem: 64 * 1024 * 1024 };

export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, SCRYPT.keyLength, {
    N: SCRYPT.N,
    r: SCRYPT.r,
    p: SCRYPT.p,
    maxmem: SCRYPT.maxmem,
  });
  return `scrypt$${SCRYPT.N}$${SCRYPT.r}$${SCRYPT.p}$${salt.toString('base64')}$${hash.toString('base64')}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const parts = stored.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
  const [, n, r, p, saltB64, hashB64] = parts as [string, string, string, string, string, string];
  const salt = Buffer.from(saltB64, 'base64');
  const expected = Buffer.from(hashB64, 'base64');
  let actual: Buffer;
  try {
    actual = scryptSync(password, salt, expected.length, {
      N: Number(n),
      r: Number(r),
      p: Number(p),
      maxmem: SCRYPT.maxmem,
    });
  } catch {
    return false;
  }
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

const sha256 = (value: string): string => createHash('sha256').update(value).digest('hex');

export const SESSION_COOKIE = 'lemma_session';

export class AuthStore {
  constructor(
    private readonly db: Db,
    private readonly sessionDays: number,
  ) {}

  hasPassword(): boolean {
    return this.db.prepare('SELECT 1 FROM auth WHERE id = 1').get() !== undefined;
  }

  setPassword(password: string, now: number): void {
    const hash = hashPassword(password);
    this.db
      .prepare(
        `INSERT INTO auth (id, password_hash, created_at, changed_at) VALUES (1, ?, ?, ?)
         ON CONFLICT (id) DO UPDATE SET password_hash = excluded.password_hash, changed_at = excluded.changed_at`,
      )
      .run(hash, now, now);
  }

  checkPassword(password: string): boolean {
    const row = this.db.prepare('SELECT password_hash FROM auth WHERE id = 1').get() as
      { password_hash: string } | undefined;
    if (!row) return false;
    return verifyPassword(password, row.password_hash);
  }

  /**
   * Create a session for an account — `null` is the administrator — and return the token
   * to hand to the browser.
   */
  createSession(
    now: number,
    userAgent: string | undefined,
    username: string | null = null,
  ): { token: string; expiresAt: number } {
    const token = randomBytes(32).toString('base64url');
    const expiresAt = now + this.sessionDays * 86_400_000;
    this.db
      .prepare(
        'INSERT INTO sessions (token_hash, created_at, expires_at, last_seen_at, user_agent, username) VALUES (?, ?, ?, ?, ?, ?)',
      )
      .run(sha256(token), now, expiresAt, now, userAgent?.slice(0, 200) ?? null, username);
    return { token, expiresAt };
  }

  /**
   * Whose session a token is: a username, or `null` for the administrator. `undefined`
   * when the token is not a valid session — missing, forged or expired.
   */
  sessionOwner(token: string | undefined, now: number): string | null | undefined {
    if (!token) return undefined;
    const hash = sha256(token);
    const row = this.db
      .prepare('SELECT expires_at, last_seen_at, username FROM sessions WHERE token_hash = ?')
      .get(hash) as { expires_at: number; last_seen_at: number; username: string | null } | undefined;
    if (!row) return undefined;
    if (row.expires_at <= now) {
      this.db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(hash);
      return undefined;
    }
    // Touch at most once an hour to avoid a write on every request.
    if (now - row.last_seen_at > 3_600_000) {
      this.db.prepare('UPDATE sessions SET last_seen_at = ? WHERE token_hash = ?').run(now, hash);
    }
    return row.username;
  }

  validateSession(token: string | undefined, now: number): boolean {
    return this.sessionOwner(token, now) !== undefined;
  }

  deleteSession(token: string | undefined): void {
    if (token) this.db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(sha256(token));
  }

  /** Sign one account out everywhere; `null` is the administrator. */
  deleteSessionsOf(username: string | null): void {
    if (username === null) this.db.prepare('DELETE FROM sessions WHERE username IS NULL').run();
    else this.db.prepare('DELETE FROM sessions WHERE username = ?').run(username);
  }

  purgeExpired(now: number): number {
    return this.db.prepare('DELETE FROM sessions WHERE expires_at <= ?').run(now).changes;
  }
}

/** In-memory login throttle: after 5 failures the wait doubles with each further one. */
export class LoginThrottle {
  private readonly failures = new Map<string, { count: number; blockedUntil: number }>();

  /** Milliseconds the client still has to wait; 0 when it may try. */
  retryAfter(client: string, now: number): number {
    const entry = this.failures.get(client);
    if (!entry) return 0;
    return Math.max(0, entry.blockedUntil - now);
  }

  recordFailure(client: string, now: number): void {
    const entry = this.failures.get(client) ?? { count: 0, blockedUntil: 0 };
    entry.count++;
    if (entry.count >= 5) {
      const delay = Math.min(15 * 60_000, 2_000 * 2 ** (entry.count - 5));
      entry.blockedUntil = now + delay;
    }
    this.failures.set(client, entry);
    // Keep the map from growing without bound.
    if (this.failures.size > 5000) {
      for (const [key, value] of this.failures) {
        if (value.blockedUntil < now - 3_600_000) this.failures.delete(key);
      }
    }
  }

  recordSuccess(client: string): void {
    this.failures.delete(client);
  }
}
