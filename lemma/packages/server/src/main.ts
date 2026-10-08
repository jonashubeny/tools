import type { Server } from 'node:http';
import path from 'node:path';
import { serve } from '@hono/node-server';
import { CONTENT_VERSION } from '@lemma/content';
import { studyDay } from '@lemma/core';
import { type Learner, Accounts, prepareDatabase } from './accounts';
import { APP_VERSION, createApp, ensurePassword } from './app';
import { loadConfig, publishedNote } from './config';
import { backupDay, schemaVersion } from './db';
import { errorFields, log, setLogLevel } from './log';
import { refreshForge } from './services/forge';
import { tutorStatus } from './services/tutor';

const HOUR = 3_600_000;

async function main(): Promise<void> {
  const config = loadConfig();
  setLogLevel(config.logLevel);
  const now = (): number => Date.now();

  // The main database is the administrator's, and holds the accounts of everybody else.
  const db = await prepareDatabase(path.join(config.dataDir, 'lemma.sqlite'), config, now);
  ensurePassword(db, config, now());

  const accounts = new Accounts(db, config, now);
  // Open every user's database now, so that a migration or a problem with one of them shows
  // in the log at start and not at somebody's first click.
  const learners = await accounts.everyone();

  const app = createApp({ db, config, accounts });
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
      users: learners.length - 1,
    });
    const published = publishedNote(config);
    if (published) log.info(published.msg, { url: published.url });
  });

  // ---- housekeeping -------------------------------------------------------------------

  /** One backup per learner and study day, taken the first time the app is seen running that day. */
  const dailyBackup = async ({ username, ctx }: Learner): Promise<void> => {
    if (config.backupKeep === 0) return;
    const day = studyDay(now(), config.timeZone, config.dayStartHour);
    const last = ctx.db.prepare(`SELECT value FROM settings WHERE key = 'last_backup_day'`).get() as
      { value: string } | undefined;
    if (last && JSON.parse(last.value) === day) return;
    const copy = await backupDay(ctx.db, ctx.config.dataDir, day, config.backupKeep);
    ctx.db
      .prepare(
        `INSERT INTO settings (key, value, updated_at) VALUES ('last_backup_day', ?, ?)
         ON CONFLICT (key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
      )
      .run(JSON.stringify(day), now());
    if (copy) log.info('daily backup written', { username, file: path.basename(copy), keep: config.backupKeep });
    else log.info('daily backup kept: this study day already has one', { username, file: `lemma-${day}.sqlite` });
  };

  const housekeeping = async (): Promise<void> => {
    for (const learner of await accounts.everyone()) {
      try {
        await dailyBackup(learner);
      } catch (error) {
        log.error('backup failed', { username: learner.username, ...errorFields(error) });
      }
      // Has its own refresh interval and never throws; the app works without it.
      await refreshForge(learner.ctx).catch((error: unknown) =>
        log.warn('forge refresh failed', { username: learner.username, ...errorFields(error) }),
      );
    }
    try {
      const purged = accounts.auth.purgeExpired(now());
      if (purged > 0) log.info('expired sessions removed', { count: purged });
    } catch (error) {
      log.error('session purge failed', errorFields(error));
    }
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
    let finished = false;
    const finish = async (): Promise<void> => {
      if (finished) return;
      finished = true;
      try {
        // Folds each write-ahead log back into its file, leaving one clean file per learner.
        await accounts.closeAll();
        db.pragma('wal_checkpoint(TRUNCATE)');
        db.close();
      } catch (error) {
        log.error('closing the database failed', errorFields(error));
      }
      process.exit(0);
    };
    server.close(() => void finish());
    // Streaming responses keep connections open; do not wait for them longer than this.
    setTimeout(() => {
      (server as Server).closeAllConnections?.();
      void finish();
    }, 4_000).unref();
  };
  process.on('SIGTERM', () => stop('SIGTERM'));
  process.on('SIGINT', () => stop('SIGINT'));
}

main().catch((error: unknown) => {
  log.error('startup failed', errorFields(error));
  process.exit(1);
});
