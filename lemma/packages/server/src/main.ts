import type { Server } from 'node:http';
import path from 'node:path';
import { serve } from '@hono/node-server';
import { CONTENT_VERSION } from '@lemma/content';
import { studyDay } from '@lemma/core';
import { APP_VERSION, createApp, ensurePassword } from './app';
import { AuthStore } from './auth';
import { loadConfig } from './config';
import { backupDatabase, backupDay, latestSchemaVersion, migrate, openDatabase, schemaVersion } from './db';
import { errorFields, log, setLogLevel } from './log';
import type { Ctx } from './services/context';
import { refreshForge } from './services/forge';
import { ensureModelCurrent, modelMarker } from './services/learner';
import { tutorStatus } from './services/tutor';

const HOUR = 3_600_000;

async function main(): Promise<void> {
  const config = loadConfig();
  setLogLevel(config.logLevel);

  const file = path.join(config.dataDir, 'lemma.sqlite');
  const db = openDatabase(file);

  const found = schemaVersion(db);
  const wanted = latestSchemaVersion();
  if (found > wanted) {
    throw new Error(
      `the database has schema ${found}, but this version of Lemma only knows schema ${wanted}: it was written by a newer version, refusing to touch it`,
    );
  }
  // A schema change is the one moment a backup is certainly worth its bytes.
  if (found > 0 && found < wanted) {
    const copy = await backupDatabase(db, config.dataDir, `before-schema-${wanted}-${Date.now()}`, 0);
    log.info('backup taken before migrating', { file: path.basename(copy), from: found, to: wanted });
  }
  migrate(db);
  ensurePassword(db, config, Date.now());

  const ctx: Ctx = { db, config, now: () => Date.now() };
  // Skill states are a cache of the log; rebuild them if they were computed under other rules.
  const model = ensureModelCurrent(ctx);
  if (model.rebuilt)
    log.info('learner model rebuilt from the log', {
      from: model.from,
      to: modelMarker(),
      skills: model.skills,
      problems: model.problems,
    });
  const app = createApp({ db, config });
  const server = serve({ fetch: app.fetch, hostname: config.host, port: config.port }, (info) => {
    const tutor = tutorStatus(config);
    log.info('lemma is listening', {
      address: `http://${info.address}:${info.port}`,
      version: APP_VERSION,
      content: CONTENT_VERSION,
      schema: schemaVersion(db),
      timeZone: config.timeZone,
      web: config.webDir ? 'served' : 'not served (API only)',
      tutor: tutor.enabled ? `${tutor.provider} (${tutor.model})` : 'off',
    });
  });

  // ---- housekeeping -------------------------------------------------------------------

  /** One backup per study day, taken the first time the app is seen running that day. */
  const dailyBackup = async (): Promise<void> => {
    if (config.backupKeep === 0) return;
    const day = studyDay(Date.now(), config.timeZone, config.dayStartHour);
    const last = db.prepare(`SELECT value FROM settings WHERE key = 'last_backup_day'`).get() as
      { value: string } | undefined;
    if (last && JSON.parse(last.value) === day) return;
    const copy = await backupDay(db, config.dataDir, day, config.backupKeep);
    db.prepare(
      `INSERT INTO settings (key, value, updated_at) VALUES ('last_backup_day', ?, ?)
       ON CONFLICT (key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    ).run(JSON.stringify(day), Date.now());
    if (copy) log.info('daily backup written', { file: path.basename(copy), keep: config.backupKeep });
    else log.info('daily backup kept: this study day already has one', { file: `lemma-${day}.sqlite` });
  };

  const housekeeping = async (): Promise<void> => {
    try {
      await dailyBackup();
    } catch (error) {
      log.error('backup failed', errorFields(error));
    }
    try {
      const purged = new AuthStore(db, config.sessionDays).purgeExpired(Date.now());
      if (purged > 0) log.info('expired sessions removed', { count: purged });
    } catch (error) {
      log.error('session purge failed', errorFields(error));
    }
    // Has its own refresh interval and never throws; the app works without it.
    await refreshForge(ctx).catch((error: unknown) => log.warn('forge refresh failed', errorFields(error)));
  };

  const firstRun = setTimeout(() => void housekeeping(), 5_000);
  const timer = setInterval(() => void housekeeping(), HOUR);

  // ---- shutdown -----------------------------------------------------------------------

  let stopping = false;
  const stop = (signal: string): void => {
    if (stopping) return;
    stopping = true;
    log.info('shutting down', { signal });
    clearTimeout(firstRun);
    clearInterval(timer);
    const finish = (): void => {
      try {
        // Folds the write-ahead log back into the main file, leaving one clean file behind.
        db.pragma('wal_checkpoint(TRUNCATE)');
        db.close();
      } catch (error) {
        log.error('closing the database failed', errorFields(error));
      }
      process.exit(0);
    };
    server.close(finish);
    // Streaming responses keep connections open; do not wait for them longer than this.
    setTimeout(() => {
      (server as Server).closeAllConnections?.();
      finish();
    }, 4_000).unref();
  };
  process.on('SIGTERM', () => stop('SIGTERM'));
  process.on('SIGINT', () => stop('SIGINT'));
}

main().catch((error: unknown) => {
  log.error('startup failed', errorFields(error));
  process.exit(1);
});
