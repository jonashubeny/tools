import { LABS_CATALOG_VERSION, lintScenarios } from '@lemma/labs';
import { loadLabdConfig } from './config';
import { Engine } from './engine';
import { Host } from './host';
import { LabManager } from './labs';
import { errorFields, log, setLogLevel } from './log';
import { selftest } from './selftest';
import { createLabdServer } from './server';

/**
 * labd — the lab worker. The one process of a Lemma installation that talks to the
 * container engine. The web application never does; it asks labd, which runs the
 * reviewed scenarios and nothing else.
 */
async function main(): Promise<void> {
  const config = loadLabdConfig();
  setLogLevel(config.logLevel);

  const problems = lintScenarios();
  if (problems.length > 0) throw new Error(`the scenario catalog has problems: ${problems.join('; ')}`);

  if (process.argv[2] === 'selftest') {
    process.exit((await selftest(config, process.argv.slice(3))) ? 0 : 1);
  }

  const engine = new Engine(config.engineSocket);
  const host = new Host(engine, config);
  const labs = new LabManager(engine, host, config);
  labs.load();

  const server = createLabdServer(config, engine, host, labs);
  server.listen(config.port, config.host, () => {
    log.info('labd is listening', {
      address: `http://${config.host}:${config.port}`,
      engine: config.engineSocket,
      catalog: LABS_CATALOG_VERSION.split(',').length,
      limits: { labs: config.maxLabs, perOwner: config.maxLabsPerOwner, memoryMb: config.maxMemoryMb, diskMb: config.maxDiskMb },
    });
  });

  // Probing and building take minutes the first time; the API answers meanwhile.
  void (async () => {
    if (await engine.ping()) await labs.reconcile();
    await host.prepare();
  })().catch((error: unknown) => log.error('preparing the host failed', errorFields(error)));

  const reaper = setInterval(() => labs.reap(), 30_000);
  const watchdog = setInterval(() => void labs.watch(), 60_000);
  // An engine that was down at start (or restarted) is probed again until it answers.
  const retry = setInterval(() => {
    if (!host.status().engine.reachable && !host.status().probing) void host.prepare();
  }, 60_000);

  const stop = (signal: string): void => {
    log.info('labd shutting down; labs keep running and are reconciled at the next start', { signal });
    clearInterval(reaper);
    clearInterval(watchdog);
    clearInterval(retry);
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 3_000).unref();
  };
  process.on('SIGTERM', () => stop('SIGTERM'));
  process.on('SIGINT', () => stop('SIGINT'));
}

main().catch((error: unknown) => {
  log.error('labd failed to start', errorFields(error));
  process.exit(1);
});
