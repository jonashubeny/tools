import { SCENARIOS } from '@lemma/labs';
import type { LabdConfig } from './config';
import { Engine } from './engine';
import { Host } from './host';
import { LabManager } from './labs';
import { log, setLogLevel } from './log';

/**
 * `labd selftest [scenario…]` — prove on this host that each scenario works: a fresh lab
 * must fail its checks, pass them after the reviewed reference fix, fail them the same way
 * again after a reset, and leave nothing behind once destroyed. Runs beside a live labd
 * without touching its labs: its own label prefix, its own state file.
 */
export async function selftest(base: LabdConfig, wanted: string[]): Promise<boolean> {
  setLogLevel('warn');
  const config: LabdConfig = { ...base, prefix: `${base.prefix}-selftest`, stateDir: `${base.stateDir}/selftest`, maxLabs: 1, maxLabsPerOwner: 1 };
  const engine = new Engine(config.engineSocket);
  const host = new Host(engine, config);
  const labs = new LabManager(engine, host, config);
  labs.load();
  await labs.reconcile();
  await host.prepare();

  const say = (text: string): void => void process.stdout.write(`${text}\n`);
  const scenarios = SCENARIOS.filter((s) => wanted.length === 0 || wanted.includes(s.id));
  let ok = true;
  for (const scenario of scenarios) {
    const refused = labs.refusal('selftest', scenario.id);
    if (refused) {
      say(`SKIP  ${scenario.id}: ${refused.message}`);
      continue;
    }
    const started = Date.now();
    const problems: string[] = [];
    const lab = labs.create('selftest', scenario.id);
    try {
      await labs.settle(lab.id);
      if (lab.status !== 'ready') throw new Error(`not ready after provisioning: ${lab.status} — ${lab.detail ?? lab.error}`);
      const before = await labs.verify('selftest', lab.id);
      const failing = before.results.filter((r) => !r.passed).map((r) => r.id);
      if (failing.length === 0) problems.push('every check passes before the fix: the fault does nothing');

      await labs.applyReferenceFix('selftest', lab.id);
      const after = await labs.verify('selftest', lab.id);
      const still = after.results.filter((r) => !r.passed).map((r) => r.id);
      if (still.length > 0) problems.push(`checks still failing after the reference fix: ${still.join(', ')}`);

      labs.reset('selftest', lab.id);
      await labs.settle(lab.id);
      if (lab.status !== 'ready') throw new Error(`not ready after reset: ${lab.status} — ${lab.detail ?? lab.error}`);
      const again = await labs.verify('selftest', lab.id);
      const failingAgain = again.results.filter((r) => !r.passed).map((r) => r.id);
      if (failingAgain.join() !== failing.join())
        problems.push(`after a reset other checks fail (${failingAgain.join(', ')}) than at first (${failing.join(', ')})`);
    } catch (error) {
      problems.push(error instanceof Error ? error.message : String(error));
    } finally {
      labs.destroy('selftest', lab.id);
      await labs.settle(lab.id);
      const left = await engine.listContainers([`${config.prefix}.lab=${lab.id}`]);
      if (left.length > 0) problems.push(`${left.length} container(s) left behind after destroy`);
    }
    const seconds = Math.round((Date.now() - started) / 1000);
    if (problems.length === 0) say(`PASS  ${scenario.id} (${seconds} s)`);
    else {
      ok = false;
      say(`FAIL  ${scenario.id} (${seconds} s)\n      ${problems.join('\n      ')}`);
    }
  }
  log.info('selftest finished', { ok });
  return ok;
}
