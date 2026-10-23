import fs from 'node:fs';
import type { AddressInfo } from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { SCENARIO_BY_ID } from '@lemma/labs';
import { afterEach, describe, expect, it } from 'vitest';
import type { LabdConfig } from '../src/config';
import type { Engine, ExecResult } from '../src/engine';
import type { Host, HostStatus } from '../src/host';
import { LabError, LabManager } from '../src/labs';
import { setLogLevel } from '../src/log';
import { createLabdServer } from '../src/server';
import { containerSpec } from '../src/spec';

setLogLevel('error');

/** An engine in memory: containers and networks are records, exec answers from a script. */
class FakeEngine {
  containers = new Map<string, { name: string; labels: Record<string, string>; running: boolean; spec: Record<string, unknown> }>();
  networks = new Map<string, { name: string; labels: Record<string, string> }>();
  execs: { container: string; cmd: string[] }[] = [];
  /** Decides the exit code of each exec; 0 by default. */
  onExec: (cmd: string[]) => Partial<ExecResult> = () => ({});
  private next = 0;

  async createContainer(name: string, spec: Record<string, unknown>): Promise<string> {
    const id = `c${++this.next}`;
    this.containers.set(id, { name, labels: spec.Labels as Record<string, string>, running: false, spec });
    return id;
  }
  async startContainer(id: string): Promise<void> {
    this.containers.get(id)!.running = true;
  }
  async removeContainer(id: string): Promise<void> {
    this.containers.delete(id);
  }
  async listContainers(labels: string[]) {
    return [...this.containers.entries()]
      .filter(([, c]) => labels.every((l) => (l.includes('=') ? c.labels[l.split('=')[0]!] === l.split('=')[1] : l in c.labels)))
      .map(([id, c]) => ({ Id: id, Names: [c.name], Labels: c.labels, State: c.running ? 'running' : 'exited', SizeRw: 0 }));
  }
  async createNetwork(name: string, _subnet: string, labels: Record<string, string>): Promise<string> {
    const id = `n${++this.next}`;
    this.networks.set(id, { name, labels });
    return id;
  }
  async connectNetwork(): Promise<void> {}
  async removeNetwork(id: string): Promise<void> {
    this.networks.delete(id);
  }
  async listNetworks(labels: string[]) {
    return [...this.networks.entries()]
      .filter(([, n]) => labels.every((l) => n.labels[l.split('=')[0]!] === l.split('=')[1]))
      .map(([id, n]) => ({ Id: id, Name: n.name, Labels: n.labels }));
  }
  async exec(container: string, cmd: string[]): Promise<ExecResult> {
    this.execs.push({ container, cmd });
    if (cmd.join(' ').includes('is-system-running')) return { exitCode: 0, stdout: 'running\n', stderr: '' };
    return { exitCode: 0, stdout: '', stderr: '', ...this.onExec(cmd) };
  }
  async stats() {
    return { memory: 1, cpuPercent: 0 };
  }
  async ping() {
    return true;
  }
}

const READY: HostStatus = {
  engine: { reachable: true, version: 'Fake 1' },
  singleUid: false,
  capabilities: { systemd: true, multiUser: true, networks: true },
  images: { base: { status: 'ready', tag: 'base:1' }, full: { status: 'ready', tag: 'full:1' } },
  probing: false,
  probedAt: 1,
  problems: [],
};

function fakeHost(status: HostStatus = READY): Host {
  return {
    status: () => structuredClone(status),
    has: (c: keyof HostStatus['capabilities']) => status.capabilities[c] === true,
    imageTag: (id: 'base' | 'full') => status.images[id].tag,
    prepare: async () => undefined,
  } as unknown as Host;
}

const dirs: string[] = [];
function config(over: Partial<LabdConfig> = {}): LabdConfig {
  const stateDir = fs.mkdtempSync(path.join(os.tmpdir(), 'labd-test-'));
  dirs.push(stateDir);
  return {
    host: '127.0.0.1',
    port: 0,
    token: 'test-token-0123456789abcdefgh',
    engineSocket: '/nonexistent',
    stateDir,
    imagesDir: '/nonexistent',
    prefix: 'lemma-lab',
    maxLabs: 3,
    maxLabsPerOwner: 1,
    maxMemoryMb: 2048,
    maxDiskMb: 512,
    maxLifetimeMinutes: 240,
    buildNetwork: '',
    singleUid: 'auto',
    logLevel: 'error',
    ...over,
  };
}
afterEach(() => {
  for (const dir of dirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
});

function setup(over: Partial<LabdConfig> = {}, status: HostStatus = READY) {
  let clock = Date.UTC(2026, 9, 23, 10);
  const engine = new FakeEngine();
  const cfg = config(over);
  const labs = new LabManager(engine as unknown as Engine, fakeHost(status), cfg, SCENARIO_BY_ID, () => clock);
  return { engine, labs, cfg, advance: (ms: number) => (clock += ms) };
}

describe('the life of a lab', () => {
  it('provisions, verifies, resets and destroys, leaving nothing behind', async () => {
    const { engine, labs } = setup();
    const lab = labs.create('alice', 'disk-full-logs');
    expect(lab.status).toBe('provisioning');
    await labs.settle(lab.id);
    expect(lab.status).toBe('ready');
    expect(engine.containers.size).toBe(1);
    // Provisioning and the fault run as scripts inside the machine, under a timeout.
    const scripts = engine.execs.filter((e) => e.cmd[0] === 'timeout' && e.cmd.includes('pipefail'));
    expect(scripts.length).toBe(SCENARIO_BY_ID.get('disk-full-logs')!.provision.length + SCENARIO_BY_ID.get('disk-full-logs')!.fault.length);

    engine.onExec = (cmd) => ({ exitCode: cmd.join(' ').includes('df --output') ? 1 : 0 });
    const result = await labs.verify('alice', lab.id);
    expect(result.results.find((r) => r.id === 'space')!.passed).toBe(false);
    expect(result.results.filter((r) => r.passed).length).toBe(result.results.length - 1);

    labs.reset('alice', lab.id);
    await labs.settle(lab.id);
    expect(lab.status).toBe('ready');
    expect(lab.generation).toBe(1);
    expect(engine.containers.size).toBe(1);

    labs.destroy('alice', lab.id);
    await labs.settle(lab.id);
    expect(lab.status).toBe('destroyed');
    expect(engine.containers.size).toBe(0);
  });

  it('confines every machine: no network, no capabilities beyond the base set, limits', async () => {
    const { engine, labs } = setup();
    const lab = labs.create('alice', 'dns-resolution');
    await labs.settle(lab.id);
    const spec = [...engine.containers.values()][0]!.spec as { HostConfig: Record<string, unknown> };
    expect(spec.HostConfig.NetworkMode).toBe('none');
    expect(spec.HostConfig.Privileged).toBe(false);
    expect(spec.HostConfig.CapDrop).toEqual(['ALL']);
    expect(spec.HostConfig.CapAdd).not.toContain('SYS_ADMIN');
    expect(spec.HostConfig.CapAdd).not.toContain('NET_ADMIN');
    expect(spec.HostConfig.SecurityOpt).toContain('no-new-privileges');
    expect(spec.HostConfig.Memory).toBe(spec.HostConfig.MemorySwap);
    expect(spec.HostConfig.PidsLimit).toBeGreaterThan(0);
    expect(JSON.stringify(spec)).not.toMatch(/docker\.sock|Binds/);
  });

  it('puts multi-machine labs on an internal network of their own', async () => {
    const { engine, labs } = setup();
    const lab = labs.create('alice', 'service-reachability');
    await labs.settle(lab.id);
    expect(engine.networks.size).toBe(1);
    const spec = containerSpec({ image: 'x', hostname: 'h', labels: {}, systemd: true, memoryMb: 64, cpus: 1, network: { name: 'n', address: '10.0.0.2', aliases: [] } });
    expect((spec.HostConfig as Record<string, unknown>).NetworkMode).toBe('n');
    labs.destroy('alice', lab.id);
    await labs.settle(lab.id);
    expect(engine.networks.size).toBe(0);
  });

  it('removes what it made when provisioning fails, and says where', async () => {
    const { engine, labs } = setup();
    engine.onExec = (cmd) => (cmd.includes('pipefail') ? { exitCode: 1, stderr: 'boom' } : {});
    const lab = labs.create('alice', 'disk-full-logs');
    await labs.settle(lab.id);
    expect(lab.status).toBe('failed');
    expect(lab.error).toContain('install ledger');
    expect(lab.detail).toContain('boom');
    expect(engine.containers.size).toBe(0);
  });
});

describe('who may do what', () => {
  it('answers somebody else’s lab exactly like a missing one', async () => {
    const { labs } = setup();
    const lab = labs.create('alice', 'disk-full-logs');
    await labs.settle(lab.id);
    const attempts: (() => unknown)[] = [
      () => labs.get('bob', lab.id),
      async () => labs.verify('bob', lab.id) as unknown,
      () => labs.reset('bob', lab.id),
      () => labs.destroy('bob', lab.id),
      () => labs.touch('bob', lab.id),
      () => labs.terminalTarget('bob', lab.id, 'app'),
    ];
    for (const attempt of attempts) {
      await expect(Promise.resolve().then(attempt)).rejects.toMatchObject({ status: 404, code: 'not_found' });
    }
    expect(() => labs.get('alice', 'nonexistent')).toThrow(LabError);
    expect(labs.list('bob')).toEqual([]);
  });

  it('enforces one lab per owner, the global count and the memory budget', async () => {
    const { labs } = setup({ maxLabs: 2 });
    labs.create('alice', 'disk-full-logs');
    expect(() => labs.create('alice', 'dns-resolution')).toThrow(expect.objectContaining({ code: 'owner_limit' }));
    labs.create('bob', 'service-wont-start');
    expect(() => labs.create('carol', 'dns-resolution')).toThrow(expect.objectContaining({ code: 'capacity', message: expect.stringMatching(/slot/) }));

    const small = setup({ maxMemoryMb: 500 });
    small.labs.create('alice', 'disk-full-logs'); // 384 MB
    expect(() => small.labs.create('bob', 'dns-resolution')).toThrow(expect.objectContaining({ code: 'capacity', message: expect.stringMatching(/memory/) }));
  });

  it('refuses a scenario the host cannot run, with the reason', () => {
    const { labs } = setup({}, { ...READY, capabilities: { systemd: true, multiUser: false, networks: false } });
    expect(labs.refusal('alice', 'nginx-bad-gateway')).toMatchObject({ code: 'unsupported' });
    expect(labs.refusal('alice', 'dns-resolution')).toBeNull();
    expect(labs.refusal('alice', 'no-such-scenario')).toMatchObject({ code: 'unknown_scenario' });
    expect(labs.refusal('../etc', 'dns-resolution')).toMatchObject({ code: 'bad_owner' });
  });
});

describe('housekeeping', () => {
  it('expires an idle lab, but activity keeps it alive until the hard limit', async () => {
    const { labs, advance, engine } = setup({ maxLifetimeMinutes: 180 });
    const lab = labs.create('alice', 'dns-resolution'); // ttl 90 minutes
    await labs.settle(lab.id);
    advance(80 * 60_000);
    labs.touch('alice', lab.id);
    advance(80 * 60_000);
    labs.reap();
    expect(lab.status).toBe('ready');
    advance(30 * 60_000); // 190 minutes old: past the hard limit
    labs.reap();
    await labs.settle(lab.id);
    expect(lab.status).toBe('expired');
    expect(engine.containers.size).toBe(0);
  });

  it('reconciles after a restart: unknown machines are removed, interrupted labs fail', async () => {
    const first = setup();
    const lab = first.labs.create('alice', 'disk-full-logs');
    await first.labs.settle(lab.id);
    // A machine nobody knows about, left by an earlier crash.
    await first.engine.createContainer('stray', { Labels: { 'lemma-lab': '1', 'lemma-lab.kind': 'machine', 'lemma-lab.lab': 'gone' } });
    const again = new LabManager(first.engine as unknown as Engine, fakeHost(), first.cfg, SCENARIO_BY_ID);
    again.load();
    await again.reconcile();
    expect(again.get('alice', lab.id).status).toBe('ready');
    expect([...first.engine.containers.values()].map((c) => c.name)).toEqual([`lemma-lab-${lab.id}-app`]);

    // Machines gone behind its back: the lab is marked failed.
    first.engine.containers.clear();
    const third = new LabManager(first.engine as unknown as Engine, fakeHost(), first.cfg, SCENARIO_BY_ID);
    third.load();
    await third.reconcile();
    expect(third.get('alice', lab.id).status).toBe('failed');
  });
});

describe('the API', () => {
  it('requires the token, scopes by owner, and has no way to run a command', async () => {
    const { labs, cfg, engine } = setup();
    const server = createLabdServer(cfg, engine as unknown as Engine, fakeHost(), labs);
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    const auth = { Authorization: `Bearer ${cfg.token}`, 'Content-Type': 'application/json' };
    try {
      expect((await fetch(`${base}/healthz`)).status).toBe(200);
      expect((await fetch(`${base}/v1/status`)).status).toBe(401);
      expect((await fetch(`${base}/v1/status`, { headers: { Authorization: 'Bearer nope' } })).status).toBe(401);

      const created = await fetch(`${base}/v1/labs`, { method: 'POST', headers: auth, body: JSON.stringify({ owner: 'alice', scenario: 'dns-resolution' }) });
      expect(created.status).toBe(201);
      const { id } = (await created.json()) as { id: string };
      await labs.settle(id);

      expect((await fetch(`${base}/v1/labs/${id}?owner=bob`, { headers: auth })).status).toBe(404);
      expect((await fetch(`${base}/v1/labs/${id}?owner=alice`, { headers: auth })).status).toBe(200);
      expect((await fetch(`${base}/v1/labs/${id}/verify`, { method: 'POST', headers: auth, body: JSON.stringify({ owner: 'bob' }) })).status).toBe(404);
      // Nothing like exec: unknown routes are 404, and a script in a body goes nowhere.
      for (const p of ['/v1/exec', `/v1/labs/${id}/exec`, `/v1/labs/${id}/run`]) {
        const r = await fetch(`${base}${p}`, { method: 'POST', headers: auth, body: JSON.stringify({ owner: 'alice', cmd: 'id' }) });
        expect(r.status, p).toBe(404);
      }
      expect(engine.execs.some((e) => e.cmd.join(' ').includes('cmd'))).toBe(false);
    } finally {
      server.close();
    }
  });
});
