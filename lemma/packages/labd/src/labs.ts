import { randomBytes } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { USERNAME_PATTERN } from '@lemma/core';
import { type ScenarioDef, type Step, SCENARIO_BY_ID, matchDiagnostics } from '@lemma/labs';
import type { LabdConfig } from './config';
import type { Engine } from './engine';
import { type Host, waitForSystemd } from './host';
import { errorFields, log } from './log';
import { containerSpec } from './spec';

/**
 * The life of a lab: requested → provisioning → ready ⇄ busy (checking, resetting) →
 * destroyed or expired; failed when provisioning breaks or a machine dies.
 *
 * labd keeps its own record of labs in one JSON file and reconciles it with what the
 * engine actually runs on every start: a machine nobody knows about is removed, a lab
 * whose machines are gone is marked failed. Every operation names the owner, and a lab
 * that belongs to somebody else answers exactly like one that does not exist.
 */

export type LabStatus = 'provisioning' | 'ready' | 'busy' | 'failed' | 'destroying' | 'destroyed' | 'expired';

export interface Lab {
  id: string;
  owner: string;
  scenarioId: string;
  version: number;
  status: LabStatus;
  /** What is going on while busy or provisioning. */
  operation: 'create' | 'verify' | 'reset' | null;
  /** Shown to the learner. */
  error: string | null;
  /** For the administrator: what the engine or a script said. */
  detail: string | null;
  createdAt: number;
  readyAt: number | null;
  lastActivityAt: number;
  expiresAt: number;
  endedAt: number | null;
  /** Raised by every reset; a provisioning run of an older generation stops quietly. */
  generation: number;
  verifications: number;
  machines: { name: string; containerId: string | null }[];
  networks: { name: string; id: string | null; subnet: string }[];
}

/** What the server and the learner see of a lab. */
export interface LabView {
  id: string;
  owner: string;
  scenarioId: string;
  version: number;
  status: LabStatus;
  operation: Lab['operation'];
  error: string | null;
  createdAt: number;
  readyAt: number | null;
  expiresAt: number;
  endedAt: number | null;
  generation: number;
  verifications: number;
  machines: string[];
}

export interface CheckResult {
  id: string;
  passed: boolean;
  ms: number;
}

export interface VerifyResult {
  lab: LabView;
  results: CheckResult[];
  diagnostics: string[];
}

export class LabError extends Error {
  constructor(
    readonly status: 400 | 404 | 409 | 503,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'LabError';
  }
}

const ACTIVE: LabStatus[] = ['provisioning', 'ready', 'busy', 'destroying'];
const isActive = (lab: Lab): boolean => ACTIVE.includes(lab.status);

const tail = (text: string, n = 800): string => (text.length > n ? `…${text.slice(-n)}` : text);

class StepFailed extends Error {
  constructor(
    readonly label: string,
    readonly output: string,
  ) {
    super(`step "${label}" failed`);
  }
}

export function viewOf(lab: Lab): LabView {
  return {
    id: lab.id,
    owner: lab.owner,
    scenarioId: lab.scenarioId,
    version: lab.version,
    status: lab.status,
    operation: lab.operation,
    error: lab.error,
    createdAt: lab.createdAt,
    readyAt: lab.readyAt,
    expiresAt: lab.expiresAt,
    endedAt: lab.endedAt,
    generation: lab.generation,
    verifications: lab.verifications,
    machines: lab.machines.map((m) => m.name),
  };
}

export class LabManager {
  private labs = new Map<string, Lab>();
  private locks = new Map<string, Promise<unknown>>();
  private readonly file: string;

  constructor(
    private readonly engine: Engine,
    private readonly host: Host,
    private readonly config: LabdConfig,
    private readonly scenarios: ReadonlyMap<string, ScenarioDef> = SCENARIO_BY_ID,
    private readonly now: () => number = () => Date.now(),
  ) {
    this.file = path.join(config.stateDir, 'labs.json');
  }

  // ---- state ---------------------------------------------------------------------------

  load(): void {
    try {
      const stored = JSON.parse(fs.readFileSync(this.file, 'utf8')) as Lab[];
      this.labs = new Map(stored.map((lab) => [lab.id, lab]));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') log.error('lab state unreadable, starting empty', errorFields(error));
      this.labs = new Map();
    }
  }

  private save(): void {
    fs.mkdirSync(this.config.stateDir, { recursive: true });
    const temp = `${this.file}.tmp`;
    fs.writeFileSync(temp, JSON.stringify([...this.labs.values()], null, 1));
    fs.renameSync(temp, this.file);
  }

  private labels(lab: Lab, kind: string, extra: Record<string, string> = {}): Record<string, string> {
    const p = this.config.prefix;
    return {
      [p]: '1',
      [`${p}.kind`]: kind,
      [`${p}.lab`]: lab.id,
      [`${p}.owner`]: lab.owner,
      [`${p}.scenario`]: `${lab.scenarioId}@${lab.version}`,
      ...extra,
    };
  }

  /** Operations on one lab run one after another. */
  private serial<T>(id: string, task: () => Promise<T>): Promise<T> {
    const previous = this.locks.get(id) ?? Promise.resolve();
    const next = previous.catch(() => undefined).then(task);
    this.locks.set(
      id,
      next.catch(() => undefined),
    );
    return next;
  }

  // ---- queries -------------------------------------------------------------------------

  /** The lab, if it exists and belongs to `owner`; otherwise 404, the same either way. */
  get(owner: string, id: string): Lab {
    const lab = this.labs.get(id);
    if (!lab || lab.owner !== owner) throw new LabError(404, 'not_found', 'no such lab');
    return lab;
  }

  list(owner?: string): Lab[] {
    return [...this.labs.values()]
      .filter((lab) => owner === undefined || lab.owner === owner)
      .sort((a, b) => b.createdAt - a.createdAt);
  }

  active(): Lab[] {
    return [...this.labs.values()].filter(isActive);
  }

  // ---- create --------------------------------------------------------------------------

  /** Why `owner` cannot start `scenarioId` right now, or null when they can. */
  refusal(owner: string, scenarioId: string): LabError | null {
    if (!USERNAME_PATTERN.test(owner) && owner !== 'admin') return new LabError(400, 'bad_owner', 'not a valid owner');
    const scenario = this.scenarios.get(scenarioId);
    if (!scenario) return new LabError(404, 'unknown_scenario', 'no such scenario');
    const status = this.host.status();
    if (!status.engine.reachable) return new LabError(503, 'engine_unavailable', 'the lab host is not reachable');
    const missing = scenario.requires.filter((capability) => !this.host.has(capability));
    if (missing.length > 0) {
      const probing = missing.some((capability) => status.capabilities[capability] === null);
      return probing
        ? new LabError(503, 'preparing', 'the lab host is still being prepared; try again in a few minutes')
        : new LabError(409, 'unsupported', `this lab host cannot run this scenario (it needs: ${missing.join(', ')})`);
    }
    for (const machine of scenario.machines) {
      const image = status.images[machine.image];
      if (image.status === 'pending' || image.status === 'building')
        return new LabError(503, 'preparing', 'the lab images are still being built; try again in a few minutes');
      if (image.status !== 'ready')
        return new LabError(409, 'unsupported', `the ${machine.image} lab image is not available on this host`);
    }
    const active = this.active();
    const mine = active.filter((lab) => lab.owner === owner);
    if (mine.length >= this.config.maxLabsPerOwner)
      return new LabError(409, 'owner_limit', 'you already have a lab running; end it before starting another');
    if (active.length >= this.config.maxLabs)
      return new LabError(503, 'capacity', 'every lab slot is taken right now; try again later');
    const memory = (s: ScenarioDef): number => s.machines.reduce((sum, m) => sum + m.memoryMb, 0);
    const used = active.reduce((sum, lab) => sum + memory(this.scenarios.get(lab.scenarioId) ?? scenario), 0);
    if (used + memory(scenario) > this.config.maxMemoryMb)
      return new LabError(503, 'capacity', 'not enough memory is free for this lab right now; try again later');
    const subnets = new Set(active.flatMap((lab) => lab.networks.map((n) => n.subnet)));
    if ((scenario.networks ?? []).some((n) => subnets.has(n.subnet)))
      return new LabError(503, 'network_busy', 'another lab uses the same network right now; try again later');
    return null;
  }

  create(owner: string, scenarioId: string): Lab {
    const refused = this.refusal(owner, scenarioId);
    if (refused) throw refused;
    const scenario = this.scenarios.get(scenarioId)!;
    const now = this.now();
    const lab: Lab = {
      id: randomBytes(6).toString('hex'),
      owner,
      scenarioId,
      version: scenario.version,
      status: 'provisioning',
      operation: 'create',
      error: null,
      detail: null,
      createdAt: now,
      readyAt: null,
      lastActivityAt: now,
      expiresAt: this.expiry(now, now, scenario),
      endedAt: null,
      generation: 0,
      verifications: 0,
      machines: scenario.machines.map((m) => ({ name: m.name, containerId: null })),
      networks: (scenario.networks ?? []).map((n) => ({ name: n.name, id: null, subnet: n.subnet })),
    };
    this.labs.set(lab.id, lab);
    this.save();
    log.info('lab requested', { lab: lab.id, owner, scenario: scenarioId });
    void this.serial(lab.id, () => this.provision(lab, lab.generation));
    return lab;
  }

  private expiry(createdAt: number, activity: number, scenario: ScenarioDef): number {
    return Math.min(createdAt + this.config.maxLifetimeMinutes * 60_000, activity + scenario.ttlMinutes * 60_000);
  }

  // ---- provisioning --------------------------------------------------------------------

  private containerName(lab: Lab, machine: string): string {
    return `${this.config.prefix}-${lab.id}-${machine}`;
  }

  private async provision(lab: Lab, generation: number): Promise<void> {
    const scenario = this.scenarios.get(lab.scenarioId)!;
    const stale = (): boolean => lab.generation !== generation || lab.status === 'destroying' || !isActive(lab);
    const started = this.now();
    try {
      for (const network of lab.networks) {
        network.id = await this.engine.createNetwork(
          `${this.config.prefix}-${lab.id}-${network.name}`,
          network.subnet,
          this.labels(lab, 'network'),
        );
      }
      this.save();

      const systemd = this.host.has('systemd');
      for (const def of scenario.machines) {
        const [first, ...rest] = def.networks ?? [];
        const network = first ? lab.networks.find((n) => n.name === first.network)! : null;
        const spec = containerSpec({
          image: this.host.imageTag(def.image)!,
          hostname: def.name,
          labels: this.labels(lab, 'machine', { [`${this.config.prefix}.machine`]: def.name }),
          systemd,
          memoryMb: def.memoryMb,
          cpus: def.cpus,
          network: network && first ? { name: `${this.config.prefix}-${lab.id}-${network.name}`, address: first.address, aliases: [def.name, `${def.name}.lab`] } : null,
          tmpfs: def.tmpfs,
          capAdd: def.capAdd,
        });
        const id = await this.engine.createContainer(this.containerName(lab, def.name), spec);
        lab.machines.find((m) => m.name === def.name)!.containerId = id;
        this.save();
        for (const extra of rest) {
          await this.engine.connectNetwork(`${this.config.prefix}-${lab.id}-${extra.network}`, id, extra.address, [def.name, `${def.name}.lab`]);
        }
        await this.engine.startContainer(id);
      }

      for (const machine of lab.machines) {
        const id = machine.containerId!;
        if (systemd) {
          const state = await waitForSystemd(this.engine, id, 90);
          if (!state.ok) throw new StepFailed(`boot ${machine.name}`, `systemd did not come up: ${state.state}`);
        }
        await this.prelude(scenario, machine.name, id);
      }
      if (stale()) return;

      for (const step of [...scenario.provision, ...scenario.fault]) {
        await this.runStep(lab, step);
        if (stale()) return;
      }
      // The learner's history starts empty: the diagnostics count only their own commands.
      for (const machine of lab.machines) {
        await this.engine.exec(machine.containerId!, ['sh', '-c', 'rm -f /root/.bash_history; install -d -m 0700 /root'], { timeoutMs: 15_000 });
      }
      if (stale()) return;

      const now = this.now();
      lab.status = 'ready';
      lab.operation = null;
      lab.readyAt = now;
      lab.lastActivityAt = now;
      lab.expiresAt = this.expiry(lab.createdAt, now, scenario);
      this.save();
      log.info('lab ready', { lab: lab.id, owner: lab.owner, scenario: lab.scenarioId, generation, seconds: Math.round((now - started) / 1000) });
    } catch (error) {
      if (stale()) return;
      lab.status = 'failed';
      lab.operation = null;
      lab.error =
        error instanceof StepFailed
          ? `preparing the lab failed at "${error.label}"; it has been removed — please try again, and tell the administrator if it keeps failing`
          : 'preparing the lab failed; it has been removed — please try again, and tell the administrator if it keeps failing';
      lab.detail = error instanceof StepFailed ? tail(error.output) : error instanceof Error ? error.message : String(error);
      lab.endedAt = this.now();
      this.save();
      log.error('lab provisioning failed', { lab: lab.id, scenario: lab.scenarioId, detail: lab.detail });
      await this.teardown(lab);
    }
  }

  /**
   * Make each machine's name service its own. The engine writes the host's name and its LAN
   * address into /etc/hosts; a lab machine should know only itself and its lab peers. The
   * files are bind mounts, so they are rewritten in place; the content is passed as
   * arguments, never spliced into the script.
   */
  private async prelude(scenario: ScenarioDef, name: string, container: string): Promise<void> {
    const me = scenario.machines.find((m) => m.name === name)!;
    const peers = scenario.machines
      .filter((m) => m.name !== name)
      .flatMap((m) =>
        (m.networks ?? [])
          .filter((n) => (me.networks ?? []).some((mine) => mine.network === n.network))
          .map((n) => `${n.address}\t${m.name}.lab ${m.name}`),
      );
    const own = (me.networks ?? []).map((n) => `${n.address}\t${name}.lab ${name}`);
    const hosts = ['127.0.0.1\tlocalhost', '::1\tlocalhost ip6-localhost ip6-loopback', `127.0.1.1\t${name}`, ...own, ...peers, ''].join('\n');
    const resolv = '# Lab machines have no DNS server; names come from /etc/hosts.\n';
    const result = await this.engine.exec(
      container,
      ['sh', '-c', 'printf "%s" "$1" > /etc/hosts && printf "%s" "$2" > /etc/resolv.conf', 'prelude', hosts, resolv],
      { timeoutMs: 15_000 },
    );
    if (result.exitCode !== 0) throw new StepFailed(`prepare ${name}`, result.stderr);
  }

  private async runStep(lab: Lab, step: Step): Promise<void> {
    const container = lab.machines.find((m) => m.name === step.machine)?.containerId;
    if (!container) throw new StepFailed(step.label, `no machine ${step.machine}`);
    const seconds = step.timeoutSec ?? 120;
    const result = await this.engine.exec(
      container,
      ['timeout', '-k', '5', String(seconds), 'bash', '-euo', 'pipefail', '-c', step.script],
      { timeoutMs: (seconds + 20) * 1000 },
    );
    if (result.exitCode !== 0) throw new StepFailed(step.label, `exit ${result.exitCode}\n${result.stderr || result.stdout}`);
  }

  /** Remove everything of a lab from the engine, by record and by label — whichever finds more. */
  private async teardown(lab: Lab): Promise<void> {
    const ids = new Set(lab.machines.map((m) => m.containerId).filter((id): id is string => id !== null));
    try {
      const labelled = await this.engine.listContainers([`${this.config.prefix}.lab=${lab.id}`]);
      for (const container of labelled) ids.add(container.Id);
    } catch (error) {
      log.warn('listing a lab’s containers failed', { lab: lab.id, ...errorFields(error) });
    }
    for (const id of ids) {
      await this.engine.removeContainer(id).catch((error: unknown) => log.warn('removing a container failed', { lab: lab.id, ...errorFields(error) }));
    }
    for (const machine of lab.machines) machine.containerId = null;
    const networks = new Set(lab.networks.map((n) => n.id).filter((id): id is string => id !== null));
    try {
      for (const network of await this.engine.listNetworks([`${this.config.prefix}.lab=${lab.id}`])) networks.add(network.Id);
    } catch {
      // listed by record only
    }
    for (const id of networks) {
      await this.engine.removeNetwork(id).catch((error: unknown) => log.warn('removing a network failed', { lab: lab.id, ...errorFields(error) }));
    }
    for (const network of lab.networks) network.id = null;
    this.save();
  }

  // ---- operations ----------------------------------------------------------------------

  touch(owner: string, id: string): Lab {
    const lab = this.get(owner, id);
    if (lab.status === 'ready' || lab.status === 'busy') {
      const now = this.now();
      lab.lastActivityAt = now;
      lab.expiresAt = this.expiry(lab.createdAt, now, this.scenarios.get(lab.scenarioId)!);
    }
    return lab;
  }

  async verify(owner: string, id: string): Promise<VerifyResult> {
    const lab = this.get(owner, id);
    if (lab.status !== 'ready') throw new LabError(409, 'not_ready', `the lab is ${lab.status}, not ready`);
    lab.status = 'busy';
    lab.operation = 'verify';
    return this.serial(id, async () => {
      const scenario = this.scenarios.get(lab.scenarioId)!;
      const results: CheckResult[] = [];
      let history = '';
      try {
        for (const check of scenario.checks) {
          const container = lab.machines.find((m) => m.name === check.machine)?.containerId;
          const seconds = check.timeoutSec ?? 10;
          const started = this.now();
          let passed = false;
          if (container) {
            try {
              const result = await this.engine.exec(
                container,
                ['timeout', '-k', '2', String(seconds), 'bash', '-c', check.script],
                { timeoutMs: (seconds + 10) * 1000 },
              );
              passed = result.exitCode === 0;
            } catch (error) {
              log.warn('a check could not run', { lab: lab.id, check: check.id, ...errorFields(error) });
            }
          }
          results.push({ id: check.id, passed, ms: this.now() - started });
        }
        for (const machine of lab.machines) {
          if (!machine.containerId) continue;
          const read = await this.engine
            .exec(machine.containerId, ['sh', '-c', 'tail -c 262144 /root/.bash_history 2>/dev/null || true'], { timeoutMs: 15_000 })
            .catch(() => ({ stdout: '' }));
          history += `${read.stdout}\n`;
        }
      } finally {
        if (lab.status === 'busy') {
          lab.status = 'ready';
          lab.operation = null;
        }
      }
      lab.verifications++;
      this.touch(owner, id);
      this.save();
      log.info('lab checked', { lab: lab.id, passed: results.filter((r) => r.passed).length, of: results.length });
      return { lab: viewOf(lab), results, diagnostics: matchDiagnostics(history, scenario.diagnostics) };
    });
  }

  /** Back to the documented initial state: fresh machines from the image, provisioning run again. */
  reset(owner: string, id: string): Lab {
    const lab = this.get(owner, id);
    if (!['ready', 'busy', 'failed'].includes(lab.status) && !(lab.status === 'provisioning'))
      throw new LabError(409, 'not_resettable', `the lab is ${lab.status}`);
    if (lab.status === 'failed') {
      const refused = this.refusalForReset(lab);
      if (refused) throw refused;
    }
    lab.generation++;
    lab.status = 'provisioning';
    lab.operation = 'reset';
    lab.error = null;
    lab.detail = null;
    lab.readyAt = null;
    lab.endedAt = null;
    lab.verifications = 0;
    lab.lastActivityAt = this.now();
    this.save();
    const generation = lab.generation;
    log.info('lab reset', { lab: lab.id, generation });
    void this.serial(id, async () => {
      await this.teardown(lab);
      if (lab.generation === generation && lab.status === 'provisioning') await this.provision(lab, generation);
    });
    return lab;
  }

  /** A failed lab that comes back to life must still fit within the limits. */
  private refusalForReset(lab: Lab): LabError | null {
    const others = this.active().filter((other) => other.id !== lab.id);
    if (others.filter((other) => other.owner === lab.owner).length >= this.config.maxLabsPerOwner)
      return new LabError(409, 'owner_limit', 'you already have another lab running');
    if (others.length >= this.config.maxLabs) return new LabError(503, 'capacity', 'every lab slot is taken right now');
    return null;
  }

  destroy(owner: string, id: string, reason: 'destroyed' | 'expired' = 'destroyed', error: string | null = null): Lab {
    const lab = this.get(owner, id);
    if (lab.status === 'destroyed' || lab.status === 'expired') return lab;
    const wasFailed = lab.status === 'failed';
    lab.status = 'destroying';
    lab.generation++;
    if (error) lab.error = error;
    this.save();
    void this.serial(id, async () => {
      await this.teardown(lab);
      lab.status = wasFailed && reason === 'destroyed' ? 'destroyed' : reason;
      lab.operation = null;
      lab.endedAt = this.now();
      this.save();
      log.info('lab removed', { lab: lab.id, owner: lab.owner, reason });
    });
    return lab;
  }

  /**
   * Apply the scenario's reference fix. For the self-test only: no API route leads here, so
   * nothing a request carries can make labd run it.
   */
  async applyReferenceFix(owner: string, id: string): Promise<void> {
    const lab = this.get(owner, id);
    const scenario = this.scenarios.get(lab.scenarioId)!;
    await this.serial(id, async () => {
      for (const step of scenario.selfTest) await this.runStep(lab, step);
    });
  }

  /** The container a terminal attaches to. */
  terminalTarget(owner: string, id: string, machine: string): string {
    const lab = this.get(owner, id);
    if (lab.status !== 'ready' && lab.status !== 'busy') throw new LabError(409, 'not_ready', `the lab is ${lab.status}`);
    const found = lab.machines.find((m) => m.name === machine) ?? (machine === '' ? lab.machines[0] : undefined);
    if (!found?.containerId) throw new LabError(404, 'not_found', 'no such machine');
    return found.containerId;
  }

  /** Wait for the lab's queued operations to finish (tests, shutdown). */
  async settle(id: string): Promise<void> {
    await this.locks.get(id);
  }

  // ---- housekeeping --------------------------------------------------------------------

  /** Remove labs past their time; forget ended ones after a day. */
  reap(): void {
    const now = this.now();
    for (const lab of this.labs.values()) {
      if ((lab.status === 'ready' || lab.status === 'provisioning') && now >= lab.expiresAt) {
        log.info('lab expired', { lab: lab.id, owner: lab.owner });
        this.destroy(lab.owner, lab.id, 'expired', 'the lab was removed after a period without activity');
      }
    }
    let pruned = false;
    for (const lab of [...this.labs.values()]) {
      if (!isActive(lab) && lab.status !== 'failed' && lab.endedAt !== null && now - lab.endedAt > 86_400_000) {
        this.labs.delete(lab.id);
        pruned = true;
      }
      if (lab.status === 'failed' && lab.endedAt !== null && now - lab.endedAt > 86_400_000) {
        lab.status = 'destroyed';
        pruned = true;
      }
    }
    if (pruned) this.save();
  }

  /** Stop labs whose machines died or wrote more than the disk limit. */
  async watch(): Promise<void> {
    let containers;
    try {
      containers = await this.engine.listContainers([`${this.config.prefix}.kind=machine`], true);
    } catch (error) {
      log.warn('watchdog: listing containers failed', errorFields(error));
      return;
    }
    const limit = this.config.maxDiskMb * 1024 * 1024;
    for (const lab of this.labs.values()) {
      if (lab.status !== 'ready') continue;
      for (const machine of lab.machines) {
        const found = containers.find((c) => c.Id === machine.containerId || (machine.containerId && c.Id.startsWith(machine.containerId)));
        if (!found || found.State !== 'running') {
          lab.detail = `machine ${machine.name} is ${found?.State ?? 'gone'}`;
          log.warn('lab machine stopped', { lab: lab.id, machine: machine.name, state: found?.State ?? 'gone' });
          this.destroy(lab.owner, lab.id, 'destroyed', `machine ${machine.name} stopped (out of memory or crashed); start the lab again`);
          break;
        }
        if ((found.SizeRw ?? 0) > limit) {
          log.warn('lab machine over its disk limit', { lab: lab.id, machine: machine.name, bytes: found.SizeRw });
          this.destroy(lab.owner, lab.id, 'destroyed', `machine ${machine.name} wrote more than ${this.config.maxDiskMb} MB and was stopped`);
          break;
        }
      }
    }
  }

  /** On start: make the record and the engine agree. */
  async reconcile(): Promise<void> {
    const p = this.config.prefix;
    let containers;
    try {
      containers = await this.engine.listContainers([`${p}=1`]);
    } catch (error) {
      log.error('reconcile: the engine could not be asked', errorFields(error));
      return;
    }
    for (const lab of this.labs.values()) {
      if (lab.status === 'provisioning' || lab.status === 'busy' || lab.status === 'destroying') {
        // Interrupted by a restart of labd: it cannot be resumed, only started again.
        lab.status = lab.status === 'destroying' ? 'destroyed' : 'failed';
        lab.operation = null;
        lab.error ??= 'the lab service restarted while this lab was being prepared; reset it to start again';
        lab.endedAt = this.now();
      } else if (lab.status === 'ready') {
        const missing = lab.machines.some((m) => !containers.some((c) => c.Id === m.containerId && c.State === 'running'));
        if (missing) {
          lab.status = 'failed';
          lab.error = 'the lab’s machines are gone (the host restarted?); reset it to start again';
          lab.endedAt = this.now();
        }
      }
    }
    const live = new Set([...this.labs.values()].filter((lab) => lab.status === 'ready').map((lab) => lab.id));
    let removed = 0;
    for (const container of containers) {
      const lab = container.Labels[`${p}.lab`];
      if (container.Labels[`${p}.kind`] === 'image') continue;
      if (!lab || !live.has(lab)) {
        await this.engine.removeContainer(container.Id).catch(() => undefined);
        removed++;
      }
    }
    try {
      for (const network of await this.engine.listNetworks([`${p}=1`])) {
        const lab = network.Labels?.[`${p}.lab`];
        if (!lab || !live.has(lab)) await this.engine.removeNetwork(network.Id).catch(() => undefined);
      }
    } catch (error) {
      log.warn('reconcile: networks could not be listed', errorFields(error));
    }
    this.save();
    log.info('labs reconciled', { known: this.labs.size, live: live.size, orphansRemoved: removed });
  }

  /** Resource use per machine of every active lab, for the administrator. */
  async usage(): Promise<{ lab: LabView; machines: { name: string; memory: number | null; cpuPercent: number | null; diskBytes: number | null }[] }[]> {
    let sizes: { Id: string; SizeRw?: number }[] = [];
    try {
      sizes = await this.engine.listContainers([`${this.config.prefix}.kind=machine`], true);
    } catch {
      // sizes stay unknown
    }
    const out = [];
    for (const lab of this.active()) {
      const machines = [];
      for (const machine of lab.machines) {
        const stats = machine.containerId ? await this.engine.stats(machine.containerId).catch(() => undefined) : undefined;
        const size = sizes.find((c) => c.Id === machine.containerId);
        machines.push({
          name: machine.name,
          memory: stats?.memory ?? null,
          cpuPercent: stats ? Math.round(stats.cpuPercent * 10) / 10 : null,
          diskBytes: size?.SizeRw ?? null,
        });
      }
      out.push({ lab: viewOf(lab), machines });
    }
    return out;
  }

  /** The administrator's view includes what went wrong in detail. */
  adminList(): (LabView & { detail: string | null })[] {
    return this.list().map((lab) => ({ ...viewOf(lab), detail: lab.detail }));
  }
}
