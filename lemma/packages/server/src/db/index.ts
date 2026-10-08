import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { log } from '../log';
import { MIGRATIONS } from './migrations';

export type Db = Database.Database;

/**
 * Open the database and bring its schema up to date.
 *
 * WAL mode gives readers that never block the single writer and makes the online backup
 * API safe to use while the app runs. `synchronous = NORMAL` is the recommended pairing
 * with WAL: durable across application crashes, and across power loss up to the last
 * checkpoint — an acceptable trade for a personal learning log.
 */
export function openDatabase(file: string): Db {
  if (file !== ':memory:') assertWritable(file);
  const db = new Database(file);
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');
  db.pragma('foreign_keys = ON');
  db.pragma('busy_timeout = 5000');
  return db;
}

const statOf = (target: string): fs.Stats | undefined => {
  try {
    return fs.statSync(target);
  } catch {
    return undefined;
  }
};

/**
 * Left to SQLite, a data directory the app may not write is "unable to open database
 * file", and a database file it may not write is opened read-only without a word: the app
 * starts and then fails at every answer. Both nearly always mean that a mounted volume, or
 * a backup copied into it, belongs to another user than the one the app runs as — so check
 * before opening, and say that.
 */
function assertWritable(file: string): void {
  let target = path.dirname(file);
  try {
    fs.mkdirSync(target, { recursive: true });
    fs.accessSync(target, fs.constants.R_OK | fs.constants.W_OK | fs.constants.X_OK);
    if (fs.existsSync(file)) {
      target = file;
      fs.accessSync(target, fs.constants.R_OK | fs.constants.W_OK);
    }
  } catch (error) {
    const uid = process.getuid?.();
    const me = `${uid ?? '?'}:${process.getgid?.() ?? '?'}`;
    const stat = statOf(target);
    throw new Error(
      `${target}${stat ? ` belongs to ${stat.uid}:${stat.gid} and` : ''} is not writable for user ${me} ` +
        `(${error instanceof Error ? error.message : String(error)}). ` +
        (stat?.uid === uid
          ? 'Its mode does not let its owner write (chmod u+rwX).'
          : `Give it to that user (chown -R ${me}), or run the app as its owner (LEMMA_UID and LEMMA_GID in .env).`),
      { cause: error },
    );
  }
}

export function schemaVersion(db: Db): number {
  return db.pragma('user_version', { simple: true }) as number;
}

/** Apply pending migrations. Returns the ids that were applied. */
export function migrate(db: Db): number[] {
  const current = schemaVersion(db);
  const pending = MIGRATIONS.filter((migration) => migration.id > current).sort((a, b) => a.id - b.id);
  const applied: number[] = [];
  for (const migration of pending) {
    db.transaction(() => {
      db.exec(migration.sql);
      db.pragma(`user_version = ${migration.id}`);
    })();
    applied.push(migration.id);
    log.info('migration applied', { id: migration.id, name: migration.name });
  }
  return applied;
}

export const latestSchemaVersion = (): number => Math.max(0, ...MIGRATIONS.map((migration) => migration.id));

/**
 * Write a consistent copy of the database to `backups/` using SQLite's online backup API
 * and prune old copies. The result is a complete database file: restoring means copying
 * it over lemma.sqlite while the app is stopped.
 */
export async function backupDatabase(db: Db, dataDir: string, label: string, keep: number): Promise<string> {
  const dir = path.join(dataDir, 'backups');
  fs.mkdirSync(dir, { recursive: true });
  const target = path.join(dir, `lemma-${label}.sqlite`);
  const temp = `${target}.tmp`;
  await db.backup(temp);
  fs.renameSync(temp, target);

  if (keep > 0) {
    const files = fs
      .readdirSync(dir)
      .filter((name) => /^lemma-\d{4}-\d{2}-\d{2}\.sqlite$/.test(name))
      .sort();
    for (const name of files.slice(0, Math.max(0, files.length - keep))) {
      fs.unlinkSync(path.join(dir, name));
    }
  }
  return target;
}

/**
 * The backup of a study day is the state the app was first seen in that day, and it is
 * never replaced. A database that has just been restored, or lost and created anew, does
 * not remember having been backed up today — and would otherwise overwrite the one copy
 * worth keeping. Returns the file written, or undefined when the day already has one.
 */
export async function backupDay(db: Db, dataDir: string, day: string, keep: number): Promise<string | undefined> {
  if (fs.existsSync(path.join(dataDir, 'backups', `lemma-${day}.sqlite`))) return undefined;
  return backupDatabase(db, dataDir, day, keep);
}

/** Typed helpers for JSON columns. */
export const toJson = (value: unknown): string => JSON.stringify(value);
export function fromJson<T>(text: string | null | undefined, fallback: T): T {
  if (text === null || text === undefined || text === '') return fallback;
  try {
    return JSON.parse(text) as T;
  } catch {
    return fallback;
  }
}
