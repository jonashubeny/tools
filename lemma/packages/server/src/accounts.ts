import fs from 'node:fs';
import path from 'node:path';
import { ADMIN_USERNAME, MIN_PASSWORD_LENGTH, USERNAME_PATTERN, type UserDto } from '@lemma/core';
import { AuthStore, hashPassword, verifyPassword } from './auth';
import type { Config } from './config';
import { type Db, backupDatabase, latestSchemaVersion, migrate, openDatabase, schemaVersion } from './db';
import { errorFields, log } from './log';
import { type Ctx, HttpError, badRequest, notFound } from './services/context';
import { ensureModelCurrent, modelMarker } from './services/learner';

/**
 * Accounts, and the database behind each of them.
 *
 * Lemma was built for one learner, and its services still see exactly that: one database
 * holding one person's log. Several people are served by giving each a database of their
 * own, rather than by teaching every query whose row is whose — so that nothing one
 * learner does can reach another's data, by construction and not by a WHERE clause.
 *
 *   <data>/lemma.sqlite                the administrator's: what it always was, plus the
 *                                      directory of users and everybody's sessions
 *   <data>/users/<name>/lemma.sqlite   one per user, with its own backups/ beside it
 *
 * A user's database is a complete Lemma database, password included. It can be carried
 * off to an instance of its own, and one from elsewhere can be brought in: put it in
 * place, then create the user.
 */

/** One signed-in person, and the context every service needs to work on their data. */
export interface Learner {
  /** ADMIN_USERNAME for the administrator. */
  username: string;
  admin: boolean;
  /** May use the AI tutor, which runs on the instance's key. The administrator always may. */
  tutor: boolean;
  ctx: Ctx;
}

/** A sanity limit, not a design target: every user is an open database. */
const MAX_USERS = 200;

const normalise = (name: string): string => name.trim().toLowerCase();

/**
 * Open a learner's database and bring it up to date: refuse one written by a newer Lemma,
 * back it up before a schema change, migrate, and rebuild the derived state if it was
 * computed under other rules.
 */
export async function prepareDatabase(file: string, config: Config, now: () => number): Promise<Db> {
  const db = openDatabase(file);
  try {
    const found = schemaVersion(db);
    const wanted = latestSchemaVersion();
    if (found > wanted) {
      throw new Error(
        `${file} has schema ${found}, but this version of Lemma only knows schema ${wanted}: it was written by a newer version, refusing to touch it`,
      );
    }
    // A schema change is the one moment a backup is certainly worth its bytes.
    if (found > 0 && found < wanted && file !== ':memory:') {
      const copy = await backupDatabase(db, path.dirname(file), `before-schema-${wanted}-${now()}`, 0);
      log.info('backup taken before migrating', { file: copy, from: found, to: wanted });
    }
    migrate(db);
    // Skill states are a cache of the log; rebuild them if they were computed under other rules.
    const model = ensureModelCurrent({ db, config, now });
    if (model.rebuilt) {
      log.info('learner model rebuilt from the log', {
        file,
        from: model.from,
        to: modelMarker(),
        skills: model.skills,
        problems: model.problems,
      });
    }
    return db;
  } catch (error) {
    db.close();
    throw error;
  }
}

interface UserRow {
  username: string;
  tutor: number;
  created_at: number;
  last_seen_at: number | null;
}

const userDto = (row: UserRow): UserDto => ({
  username: row.username,
  tutor: row.tutor === 1,
  createdAt: row.created_at,
  lastSeenAt: row.last_seen_at,
});

export class Accounts {
  /** The administrator's password, and the sessions of every account. */
  readonly auth: AuthStore;
  private readonly opened = new Map<string, Promise<Db>>();
  private dummyHash: string | undefined;

  constructor(
    private readonly main: Db,
    private readonly config: Config,
    private readonly now: () => number = () => Date.now(),
  ) {
    this.auth = new AuthStore(main, config.sessionDays);
  }

  // ---- learners -----------------------------------------------------------------------

  /** The administrator: the main database, exactly as a single-user instance has it. */
  admin(): Learner {
    return {
      username: ADMIN_USERNAME,
      admin: true,
      tutor: true,
      ctx: { db: this.main, config: this.config, now: this.now },
    };
  }

  async user(name: string): Promise<Learner> {
    const row = this.existing(name);
    return {
      username: row.username,
      admin: false,
      tutor: row.tutor === 1,
      ctx: { db: await this.database(row.username), config: this.userConfig(row.username), now: this.now },
    };
  }

  /** Whose session a token is, if anybody's. */
  async bySession(token: string | undefined): Promise<Learner | undefined> {
    const owner = this.auth.sessionOwner(token, this.now());
    if (owner === undefined) return undefined;
    return owner === null ? this.admin() : this.user(owner);
  }

  /** The learner these credentials belong to; undefined when they are wrong. No name is the administrator. */
  async signIn(name: string, password: string): Promise<Learner | undefined> {
    const username = normalise(name);
    if (username === '' || username === ADMIN_USERNAME) {
      return this.auth.checkPassword(password) ? this.admin() : undefined;
    }
    if (!this.find(username)) {
      // A name nobody has costs the same work as a wrong password, so the timing says nothing.
      this.dummyHash ??= hashPassword('nobody');
      verifyPassword(password, this.dummyHash);
      return undefined;
    }
    const learner = await this.user(username);
    return this.passwordOf(learner).checkPassword(password) ? learner : undefined;
  }

  /** The store holding a learner's own password. */
  passwordOf(learner: Learner): AuthStore {
    return new AuthStore(learner.ctx.db, this.config.sessionDays);
  }

  /** The name sessions carry for a learner: none for the administrator. */
  sessionName(learner: Learner): string | null {
    return learner.admin ? null : learner.username;
  }

  /** Every learner, the administrator first. One whose database cannot be opened is reported and left out. */
  async everyone(): Promise<Learner[]> {
    const learners = [this.admin()];
    for (const { username } of this.list()) {
      try {
        learners.push(await this.user(username));
      } catch (error) {
        log.error('a user database could not be opened', { username, ...errorFields(error) });
      }
    }
    return learners;
  }

  // ---- the directory of users (the administrator's business) --------------------------

  hasUsers(): boolean {
    return this.main.prepare('SELECT 1 FROM users LIMIT 1').get() !== undefined;
  }

  list(): UserDto[] {
    const rows = this.main
      .prepare(
        `SELECT u.username, u.tutor, u.created_at,
                (SELECT MAX(s.last_seen_at) FROM sessions s WHERE s.username = u.username) AS last_seen_at
           FROM users u ORDER BY u.username`,
      )
      .all() as UserRow[];
    return rows.map(userDto);
  }

  async create(name: string, password: string, tutor: boolean): Promise<UserDto> {
    const username = normalise(name);
    if (!USERNAME_PATTERN.test(username)) {
      throw badRequest(
        'a username has 2 to 32 characters: lower-case letters, digits, dots, dashes and underscores, beginning with a letter or a digit',
      );
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      throw badRequest(`a password must have at least ${MIN_PASSWORD_LENGTH} characters`);
    }
    if (username === ADMIN_USERNAME || this.find(username)) {
      throw new HttpError(409, 'username_taken', 'that username is taken');
    }
    if (this.list().length >= MAX_USERS) {
      throw new HttpError(409, 'too_many_users', `this instance already has ${MAX_USERS} users`);
    }

    // The database first: a directory without an account is harmless, an account without
    // a database is not. A database already waiting there is adopted with its contents —
    // that is how a learner is brought in from another instance.
    const adopted = fs.existsSync(path.join(this.userDir(username), 'lemma.sqlite'));
    const db = await this.database(username);
    const now = this.now();
    new AuthStore(db, this.config.sessionDays).setPassword(password, now);
    this.main
      .prepare('INSERT INTO users (username, tutor, created_at) VALUES (?, ?, ?)')
      .run(username, tutor ? 1 : 0, now);
    log.info(adopted ? 'user created over a database already in place' : 'user created', { username });
    return userDto({ username, tutor: tutor ? 1 : 0, created_at: now, last_seen_at: null });
  }

  setTutor(name: string, tutor: boolean): UserDto {
    const { username } = this.existing(name);
    this.main.prepare('UPDATE users SET tutor = ? WHERE username = ?').run(tutor ? 1 : 0, username);
    return this.list().find((user) => user.username === username)!;
  }

  /** Give a user a new password. Whoever was signed in with the old one is signed out. */
  async setPassword(name: string, password: string): Promise<void> {
    if (password.length < MIN_PASSWORD_LENGTH) {
      throw badRequest(`a password must have at least ${MIN_PASSWORD_LENGTH} characters`);
    }
    const learner = await this.user(name);
    this.passwordOf(learner).setPassword(password, this.now());
    this.auth.deleteSessionsOf(learner.username);
    log.info('user password set by the administrator', { username: learner.username });
  }

  /**
   * Remove an account. Its sessions go with it; its data is set aside rather than
   * destroyed, because months of somebody's work should survive one wrong click.
   */
  async remove(name: string): Promise<void> {
    const { username } = this.existing(name);
    this.main.prepare('DELETE FROM users WHERE username = ?').run(username);
    await this.close(username);

    const dir = this.userDir(username);
    if (fs.existsSync(dir)) {
      const aside = path.join(this.usersDir(), '.deleted');
      fs.mkdirSync(aside, { recursive: true });
      const stamp = new Date(this.now()).toISOString().replace(/[:.]/g, '-');
      fs.renameSync(dir, path.join(aside, `${username}-${stamp}`));
    }
    log.info('user removed; the data was moved to users/.deleted', { username });
  }

  /** Fold every write-ahead log back into its file and close: one clean file per learner. */
  async closeAll(): Promise<void> {
    for (const username of [...this.opened.keys()]) await this.close(username);
  }

  // ---- internals ----------------------------------------------------------------------

  private usersDir(): string {
    return path.join(this.config.dataDir, 'users');
  }

  private userDir(username: string): string {
    return path.join(this.usersDir(), username);
  }

  /**
   * What a user works with: their own data directory, and none of the administrator's
   * personal integrations from the environment. The tokens in particular belong to one
   * person, and a user could otherwise have them sent to a server of their choosing.
   */
  private userConfig(username: string): Config {
    return {
      ...this.config,
      dataDir: this.userDir(username),
      github: { username: '', token: '' },
      forgejo: { url: '', username: '', token: '' },
    };
  }

  private find(username: string): UserRow | undefined {
    return this.main
      .prepare('SELECT username, tutor, created_at, NULL AS last_seen_at FROM users WHERE username = ?')
      .get(username) as UserRow | undefined;
  }

  private existing(name: string): UserRow {
    const row = this.find(normalise(name));
    if (!row) throw notFound('user');
    return row;
  }

  private database(username: string): Promise<Db> {
    let pending = this.opened.get(username);
    if (!pending) {
      pending = prepareDatabase(path.join(this.userDir(username), 'lemma.sqlite'), this.userConfig(username), this.now);
      const attempt = pending;
      this.opened.set(username, attempt);
      // A failure is not remembered: the next request tries again.
      attempt.catch(() => {
        if (this.opened.get(username) === attempt) this.opened.delete(username);
      });
    }
    return pending;
  }

  private async close(username: string): Promise<void> {
    const pending = this.opened.get(username);
    this.opened.delete(username);
    if (!pending) return;
    try {
      const db = await pending;
      db.pragma('wal_checkpoint(TRUNCATE)');
      db.close();
    } catch (error) {
      log.error('closing a user database failed', { username, ...errorFields(error) });
    }
  }
}
