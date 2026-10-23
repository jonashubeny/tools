import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { Capability, ImageId } from '@lemma/labs';
import type { LabdConfig } from './config';
import { type Engine, EngineError } from './engine';
import { errorFields, log } from './log';
import { containerSpec } from './spec';
import { tar } from './tar';

/**
 * What this host can do, found out rather than assumed: whether the engine answers,
 * whether it maps more than one user ID, whether systemd runs as PID 1 in a container,
 * whether private networks can be created — and the lab images, built here on first start.
 * Nothing about the host is taken from configuration alone, so a lab that cannot run here
 * is refused with the reason instead of failing half-way.
 */

export type ImageStatus = 'pending' | 'building' | 'ready' | 'failed' | 'unsupported';

export interface ImageState {
  status: ImageStatus;
  tag: string | null;
  error?: string;
  builtAt?: number;
}

export interface HostStatus {
  engine: { reachable: boolean; version: string | null };
  /** True when the engine maps one user ID only; null until probed. */
  singleUid: boolean | null;
  capabilities: Record<Capability, boolean | null>;
  images: Record<ImageId, ImageState>;
  probing: boolean;
  probedAt: number | null;
  problems: string[];
}

const DEBIAN = { image: 'docker.io/library/debian', tag: 'bookworm-slim' };

/** Images are named the same whatever the label prefix, so a self-test run reuses them. */
const IMAGE_PREFIX = 'lemma-lab';

export class Host {
  private state: HostStatus = {
    engine: { reachable: false, version: null },
    singleUid: null,
    capabilities: { systemd: null, multiUser: null, networks: null },
    images: { base: { status: 'pending', tag: null }, full: { status: 'pending', tag: null } },
    probing: false,
    probedAt: null,
    problems: [],
  };
  private running: Promise<void> | null = null;

  constructor(
    private readonly engine: Engine,
    private readonly config: LabdConfig,
    private readonly now: () => number = () => Date.now(),
  ) {}

  status(): HostStatus {
    return structuredClone(this.state);
  }

  has(capability: Capability): boolean {
    return this.state.capabilities[capability] === true;
  }

  imageTag(id: ImageId): string | null {
    const image = this.state.images[id];
    return image.status === 'ready' ? image.tag : null;
  }

  /** Probe and build; concurrent callers share one run. */
  prepare(): Promise<void> {
    this.running ??= this.run().finally(() => {
      this.running = null;
    });
    return this.running;
  }

  private label(kind: string): Record<string, string> {
    return { [`${this.config.prefix}`]: '1', [`${this.config.prefix}.kind`]: kind };
  }

  private async run(): Promise<void> {
    const s = this.state;
    s.probing = true;
    s.problems = [];
    try {
      s.engine.reachable = await this.engine.ping();
      if (!s.engine.reachable) {
        s.problems.push(`the container engine does not answer on ${this.config.engineSocket}`);
        return;
      }
      const version = await this.engine.version();
      const podman = version.Components?.find((c) => c.Name.toLowerCase().includes('podman'));
      s.engine.version = podman ? `Podman ${podman.Version}` : `Docker ${version.Version}`;

      if (!(await this.engine.imageExists(`${DEBIAN.image}:${DEBIAN.tag}`))) {
        log.info('pulling the Debian base image', DEBIAN);
        await this.engine.pull(DEBIAN.image, DEBIAN.tag);
      }

      // More than one user ID: chown to an ID other than root's has to work.
      const multiUser = await this.probe(`${DEBIAN.image}:${DEBIAN.tag}`, false, [
        'sh',
        '-c',
        'touch /tmp/p && chown 1000:1000 /tmp/p && [ "$(stat -c %u /tmp/p)" = 1000 ]',
      ]);
      s.capabilities.multiUser = multiUser;
      s.singleUid = this.config.singleUid === 'auto' ? !multiUser : this.config.singleUid === 'yes';
      if (!multiUser) {
        s.problems.push(
          'the engine maps a single user ID (rootless Podman without subordinate ID ranges): labs that need real users are unavailable',
        );
      }

      await this.buildImage('base', { LAB_SINGLE_UID: s.singleUid ? '1' : '0', DEBIAN_IMAGE: `${DEBIAN.image}:${DEBIAN.tag}` });
      const base = this.imageTag('base');
      if (!base) return;

      s.capabilities.systemd = await this.probeSystemd(base);
      if (!s.capabilities.systemd) s.problems.push('systemd does not start inside a container here: labs that need it are unavailable');
      s.capabilities.networks = await this.probeNetworks(base);
      if (!s.capabilities.networks) s.problems.push('private container networks cannot be created here: multi-machine labs are unavailable');

      if (multiUser) await this.buildImage('full', { BASE_IMAGE: base });
      else s.images.full = { status: 'unsupported', tag: null, error: 'needs an engine that maps more than one user ID' };
    } catch (error) {
      s.problems.push(error instanceof Error ? error.message : String(error));
      log.error('host preparation failed', errorFields(error));
    } finally {
      s.probing = false;
      s.probedAt = this.now();
      log.info('host prepared', {
        engine: s.engine.version,
        singleUid: s.singleUid,
        capabilities: s.capabilities,
        images: Object.fromEntries(Object.entries(s.images).map(([k, v]) => [k, v.status])),
        problems: s.problems,
      });
    }
  }

  /** Tag images by the hash of what they are built from: a changed Containerfile is rebuilt by itself. */
  private tagFor(id: ImageId, file: Buffer, args: Record<string, string>): string {
    const hash = createHash('sha256').update(file).update(JSON.stringify(args)).digest('hex').slice(0, 12);
    return `localhost/${IMAGE_PREFIX}-${id}:${hash}`;
  }

  private async buildImage(id: ImageId, args: Record<string, string>): Promise<void> {
    const file = fs.readFileSync(path.join(this.config.imagesDir, id, 'Containerfile'));
    const tag = this.tagFor(id, file, args);
    const image = this.state.images[id];
    if (await this.engine.imageExists(tag)) {
      this.state.images[id] = { status: 'ready', tag, builtAt: image.builtAt };
      return;
    }
    this.state.images[id] = { status: 'building', tag };
    log.info('building a lab image (a few minutes, once)', { image: id, tag });
    try {
      await this.engine.build(tar([{ name: 'Containerfile', content: file }]), tag, {
        dockerfile: 'Containerfile',
        buildArgs: args,
        networkMode: this.config.buildNetwork || undefined,
        labels: this.label('image'),
      });
      this.state.images[id] = { status: 'ready', tag, builtAt: this.now() };
      log.info('lab image built', { image: id, tag });
      await this.pruneImages(id, tag);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.state.images[id] = { status: 'failed', tag, error: message.slice(-600) };
      this.state.problems.push(`building the ${id} image failed`);
      log.error('lab image build failed', { image: id, ...errorFields(error) });
    }
  }

  /** Older builds of the same image are dead weight once a new one exists. */
  private async pruneImages(id: ImageId, keep: string): Promise<void> {
    try {
      const images = await this.engine.listImages(`*${IMAGE_PREFIX}-${id}`);
      for (const image of images) {
        for (const tag of image.RepoTags ?? []) {
          if (tag !== keep && tag.includes(`${IMAGE_PREFIX}-${id}:`)) await this.engine.removeImage(tag);
        }
      }
    } catch (error) {
      log.warn('pruning old lab images failed', errorFields(error));
    }
  }

  /** Run a throwaway container to completion; true when it exits 0. */
  private async probe(image: string, systemd: boolean, cmd: string[]): Promise<boolean> {
    const spec = containerSpec({
      image,
      hostname: 'probe',
      labels: this.label('probe'),
      systemd,
      memoryMb: 128,
      cpus: 0.5,
      network: null,
    });
    spec.Cmd = cmd;
    let id: string | undefined;
    try {
      id = await this.engine.createContainer(`${this.config.prefix}-probe-${process.pid}-${this.now()}`, spec);
      await this.engine.startContainer(id);
      return (await this.engine.waitContainer(id, 60_000)) === 0;
    } catch (error) {
      log.debug('probe failed', { cmd: cmd.join(' '), ...errorFields(error) });
      return false;
    } finally {
      if (id) await this.engine.removeContainer(id).catch(() => undefined);
    }
  }

  private async probeSystemd(image: string): Promise<boolean> {
    let id: string | undefined;
    try {
      id = await this.engine.createContainer(
        `${this.config.prefix}-probe-systemd-${this.now()}`,
        containerSpec({ image, hostname: 'probe', labels: this.label('probe'), systemd: true, memoryMb: 256, cpus: 0.5, network: null }),
      );
      await this.engine.startContainer(id);
      const result = await waitForSystemd(this.engine, id, 60);
      if (!result.ok) log.warn('systemd probe: not running', { state: result.state });
      return result.ok;
    } catch (error) {
      log.warn('systemd probe failed', errorFields(error));
      return false;
    } finally {
      if (id) await this.engine.removeContainer(id).catch(() => undefined);
    }
  }

  private async probeNetworks(image: string): Promise<boolean> {
    let network: string | undefined;
    let id: string | undefined;
    const name = `${this.config.prefix}-probe-net-${this.now()}`;
    try {
      network = await this.engine.createNetwork(name, '10.254.254.0/24', this.label('probe'));
      const spec = containerSpec({
        image,
        hostname: 'probe',
        labels: this.label('probe'),
        systemd: false,
        memoryMb: 64,
        cpus: 0.25,
        network: { name, address: '10.254.254.10', aliases: ['probe'] },
      });
      spec.Cmd = ['true'];
      id = await this.engine.createContainer(`${name}-c`, spec);
      await this.engine.startContainer(id);
      return (await this.engine.waitContainer(id, 30_000)) === 0;
    } catch (error) {
      log.debug('network probe failed', errorFields(error));
      return false;
    } finally {
      if (id) await this.engine.removeContainer(id).catch(() => undefined);
      if (network) await this.engine.removeNetwork(network).catch(() => undefined);
    }
  }
}

/** Wait until systemd in a container reports running (or degraded: a unit failed, the system works). */
export async function waitForSystemd(
  engine: Engine,
  container: string,
  seconds: number,
): Promise<{ ok: boolean; state: string }> {
  try {
    // Right after the start, systemctl may not reach systemd yet: ask again until it does.
    const loop =
      `end=$(( $(date +%s) + ${seconds} )); s=unknown; ` +
      'while [ "$(date +%s)" -lt "$end" ]; do ' +
      's=$(timeout 10 systemctl is-system-running --wait 2>/dev/null); ' +
      'case "$s" in running|degraded) echo "$s"; exit 0;; esac; sleep 1; done; echo "$s"; exit 1';
    const result = await engine.exec(container, ['sh', '-c', loop], { timeoutMs: (seconds + 15) * 1000 });
    const state = result.stdout.trim().split('\n').at(-1) ?? '';
    return { ok: state === 'running' || state === 'degraded', state };
  } catch (error) {
    return { ok: false, state: error instanceof EngineError ? error.message : String(error) };
  }
}
