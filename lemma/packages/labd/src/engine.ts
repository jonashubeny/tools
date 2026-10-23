import http from 'node:http';
import type { Duplex } from 'node:stream';

/**
 * A small client for the Docker Engine API over its Unix socket. Podman serves the same
 * API (its "compat" API), so one client drives either engine. Only the calls labd needs
 * are here; paths carry no API version, so the engine answers with its current one.
 */

export class EngineError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'EngineError';
  }
}

export interface ExecResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

export interface ContainerSummary {
  Id: string;
  Names: string[];
  Labels: Record<string, string>;
  State: string;
  SizeRw?: number;
}

export interface NetworkSummary {
  Id: string;
  Name: string;
  Labels: Record<string, string> | null;
}

/** Output of a non-TTY exec arrives multiplexed: an 8-byte header (stream, size) before each frame. */
export function demux(buffer: Buffer): { stdout: string; stderr: string } {
  const out: Buffer[] = [];
  const err: Buffer[] = [];
  let offset = 0;
  while (offset + 8 <= buffer.length) {
    const kind = buffer[offset]!;
    const size = buffer.readUInt32BE(offset + 4);
    const frame = buffer.subarray(offset + 8, offset + 8 + size);
    (kind === 2 ? err : out).push(frame);
    offset += 8 + size;
  }
  // Not multiplexed after all (an engine that sends raw output): take it as it is.
  if (offset === 0 && buffer.length > 0) return { stdout: buffer.toString('utf8'), stderr: '' };
  return { stdout: Buffer.concat(out).toString('utf8'), stderr: Buffer.concat(err).toString('utf8') };
}

export class Engine {
  constructor(
    private readonly socketPath: string,
    private readonly defaultTimeoutMs = 60_000,
  ) {}

  private raw(
    method: string,
    path: string,
    body?: unknown,
    options: { timeoutMs?: number; contentType?: string } = {},
  ): Promise<{ status: number; data: Buffer }> {
    return new Promise((resolve, reject) => {
      const payload =
        body === undefined ? undefined : Buffer.isBuffer(body) ? body : Buffer.from(JSON.stringify(body), 'utf8');
      const request = http.request(
        {
          socketPath: this.socketPath,
          method,
          path,
          headers: {
            Host: 'engine',
            ...(payload
              ? { 'Content-Type': options.contentType ?? 'application/json', 'Content-Length': payload.length }
              : {}),
          },
        },
        (response) => {
          const chunks: Buffer[] = [];
          response.on('data', (chunk: Buffer) => chunks.push(chunk));
          response.on('end', () => resolve({ status: response.statusCode ?? 0, data: Buffer.concat(chunks) }));
          response.on('error', reject);
        },
      );
      request.setTimeout(options.timeoutMs ?? this.defaultTimeoutMs, () =>
        request.destroy(new EngineError(504, `engine call timed out: ${method} ${path}`)),
      );
      request.on('error', reject);
      if (payload) request.write(payload);
      request.end();
    });
  }

  private async call<T>(
    method: string,
    path: string,
    body?: unknown,
    options: { timeoutMs?: number; ok?: number[] } = {},
  ): Promise<T> {
    const { status, data } = await this.raw(method, path, body, options);
    const ok = options.ok ?? [200, 201, 204];
    if (!ok.includes(status)) {
      let message = data.toString('utf8').trim();
      try {
        const parsed = JSON.parse(message) as { message?: string; cause?: string };
        message = parsed.message ?? parsed.cause ?? message;
      } catch {
        // keep the text
      }
      throw new EngineError(status, `${method} ${path.split('?')[0]}: ${status} ${message.slice(0, 500)}`);
    }
    if (data.length === 0) return undefined as T;
    try {
      return JSON.parse(data.toString('utf8')) as T;
    } catch {
      return data.toString('utf8') as T;
    }
  }

  // ---- system

  async ping(): Promise<boolean> {
    try {
      const { status } = await this.raw('GET', '/_ping', undefined, { timeoutMs: 5_000 });
      return status === 200;
    } catch {
      return false;
    }
  }

  version(): Promise<{ Version: string; ApiVersion: string; Components?: { Name: string; Version: string }[] }> {
    return this.call('GET', '/version');
  }

  // ---- images

  async imageExists(name: string): Promise<boolean> {
    const { status } = await this.raw('GET', `/images/${encodeURIComponent(name)}/json`);
    return status === 200;
  }

  async pull(image: string, tag: string): Promise<void> {
    const { status, data } = await this.raw(
      'POST',
      `/images/create?fromImage=${encodeURIComponent(image)}&tag=${encodeURIComponent(tag)}`,
      undefined,
      { timeoutMs: 15 * 60_000 },
    );
    const text = data.toString('utf8');
    const failed = /"error(Detail)?"\s*:/.test(text);
    if (status !== 200 || failed) throw new EngineError(status, `pull ${image}:${tag} failed: ${text.slice(-500)}`);
  }

  /** Build from a tar context. Returns the build log; throws with its tail when the build fails. */
  async build(
    context: Buffer,
    tag: string,
    options: { dockerfile: string; buildArgs: Record<string, string>; networkMode?: string; labels: Record<string, string> },
  ): Promise<string> {
    const query = new URLSearchParams({
      t: tag,
      dockerfile: options.dockerfile,
      buildargs: JSON.stringify(options.buildArgs),
      labels: JSON.stringify(options.labels),
      rm: 'true',
      forcerm: 'true',
    });
    if (options.networkMode) query.set('networkmode', options.networkMode);
    const { status, data } = await this.raw('POST', `/build?${query}`, context, {
      timeoutMs: 30 * 60_000,
      contentType: 'application/x-tar',
    });
    const lines = data
      .toString('utf8')
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line) => {
        try {
          return JSON.parse(line) as { stream?: string; error?: string; errorDetail?: { message?: string } };
        } catch {
          return { stream: line };
        }
      });
    const log = lines.map((line) => line.stream ?? line.error ?? '').join('');
    const error = lines.find((line) => line.error || line.errorDetail);
    if (status !== 200 || error) {
      throw new EngineError(status, `build of ${tag} failed: ${(error?.error ?? error?.errorDetail?.message ?? '') || log.slice(-800)}`);
    }
    return log;
  }

  async listImages(reference: string): Promise<{ Id: string; RepoTags: string[] | null }[]> {
    return this.call('GET', `/images/json?filters=${encodeURIComponent(JSON.stringify({ reference: [reference] }))}`);
  }

  async removeImage(name: string): Promise<void> {
    await this.call('DELETE', `/images/${encodeURIComponent(name)}`, undefined, { ok: [200, 404, 409] });
  }

  // ---- containers

  async createContainer(name: string, spec: Record<string, unknown>): Promise<string> {
    const created = await this.call<{ Id: string }>('POST', `/containers/create?name=${encodeURIComponent(name)}`, spec);
    return created.Id;
  }

  async startContainer(id: string): Promise<void> {
    await this.call('POST', `/containers/${id}/start`, undefined, { ok: [204, 304] });
  }

  async removeContainer(id: string): Promise<void> {
    await this.call('DELETE', `/containers/${id}?force=true&v=true`, undefined, { ok: [200, 204, 404], timeoutMs: 60_000 });
  }

  async inspectContainer(id: string): Promise<{ Id: string; State: { Running: boolean; Status: string; ExitCode: number } } | undefined> {
    const { status, data } = await this.raw('GET', `/containers/${id}/json`);
    if (status === 404) return undefined;
    if (status !== 200) throw new EngineError(status, `inspect ${id}: ${data.toString('utf8').slice(0, 300)}`);
    return JSON.parse(data.toString('utf8'));
  }

  async waitContainer(id: string, timeoutMs: number): Promise<number> {
    const result = await this.call<{ StatusCode: number }>('POST', `/containers/${id}/wait`, undefined, { timeoutMs });
    return result.StatusCode;
  }

  listContainers(labels: string[], size = false): Promise<ContainerSummary[]> {
    const filters = encodeURIComponent(JSON.stringify({ label: labels }));
    return this.call('GET', `/containers/json?all=true${size ? '&size=true' : ''}&filters=${filters}`, undefined, {
      timeoutMs: 120_000,
    });
  }

  async stats(id: string): Promise<{ memory: number; cpuPercent: number } | undefined> {
    const { status, data } = await this.raw('GET', `/containers/${id}/stats?stream=false&one-shot=false`, undefined, {
      timeoutMs: 15_000,
    });
    if (status !== 200) return undefined;
    const s = JSON.parse(data.toString('utf8')) as {
      memory_stats?: { usage?: number; stats?: { inactive_file?: number } };
      cpu_stats?: { cpu_usage?: { total_usage?: number }; system_cpu_usage?: number; online_cpus?: number };
      precpu_stats?: { cpu_usage?: { total_usage?: number }; system_cpu_usage?: number };
    };
    const memory = Math.max(0, (s.memory_stats?.usage ?? 0) - (s.memory_stats?.stats?.inactive_file ?? 0));
    const cpuDelta = (s.cpu_stats?.cpu_usage?.total_usage ?? 0) - (s.precpu_stats?.cpu_usage?.total_usage ?? 0);
    const systemDelta = (s.cpu_stats?.system_cpu_usage ?? 0) - (s.precpu_stats?.system_cpu_usage ?? 0);
    const cpus = s.cpu_stats?.online_cpus ?? 1;
    const cpuPercent = systemDelta > 0 && cpuDelta > 0 ? (cpuDelta / systemDelta) * cpus * 100 : 0;
    return { memory, cpuPercent };
  }

  // ---- networks

  async createNetwork(name: string, subnet: string, labels: Record<string, string>): Promise<string> {
    const created = await this.call<{ Id: string }>('POST', '/networks/create', {
      Name: name,
      Driver: 'bridge',
      Internal: true,
      CheckDuplicate: true,
      IPAM: { Driver: 'default', Config: [{ Subnet: subnet }] },
      Labels: labels,
    });
    return created.Id;
  }

  async connectNetwork(network: string, container: string, address: string, aliases: string[]): Promise<void> {
    await this.call('POST', `/networks/${network}/connect`, {
      Container: container,
      EndpointConfig: { IPAMConfig: { IPv4Address: address }, Aliases: aliases },
    });
  }

  async removeNetwork(id: string): Promise<void> {
    await this.call('DELETE', `/networks/${id}`, undefined, { ok: [200, 204, 404] });
  }

  listNetworks(labels: string[]): Promise<NetworkSummary[]> {
    return this.call('GET', `/networks?filters=${encodeURIComponent(JSON.stringify({ label: labels }))}`);
  }

  // ---- exec

  private async createExec(container: string, spec: Record<string, unknown>): Promise<string> {
    const created = await this.call<{ Id: string }>('POST', `/containers/${container}/exec`, spec);
    return created.Id;
  }

  /**
   * Run a command in a container and collect its output. The command should bound its own
   * run time (labd wraps scripts in `timeout`); `timeoutMs` is the backstop on this side.
   */
  async exec(container: string, cmd: string[], options: { timeoutMs?: number; user?: string; stdin?: never } = {}): Promise<ExecResult> {
    const id = await this.createExec(container, {
      AttachStdout: true,
      AttachStderr: true,
      Tty: false,
      Cmd: cmd,
      User: options.user ?? 'root',
      Env: ['LANG=C.UTF-8', 'PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin'],
    });
    const { status, data } = await this.raw('POST', `/exec/${id}/start`, { Detach: false, Tty: false }, {
      timeoutMs: options.timeoutMs ?? this.defaultTimeoutMs,
    });
    if (status !== 200) throw new EngineError(status, `exec start: ${data.toString('utf8').slice(0, 300)}`);
    const { stdout, stderr } = demux(data);
    const inspected = await this.call<{ ExitCode: number | null; Running: boolean }>('GET', `/exec/${id}/json`);
    return { exitCode: inspected.ExitCode ?? -1, stdout, stderr };
  }

  /**
   * Start an interactive shell with a terminal and hand back the raw two-way stream
   * (the connection is "hijacked": after the 101 answer it carries the TTY's bytes).
   */
  async execInteractive(container: string, cmd: string[], env: string[]): Promise<{ id: string; stream: Duplex }> {
    const id = await this.createExec(container, {
      AttachStdin: true,
      AttachStdout: true,
      AttachStderr: true,
      Tty: true,
      Cmd: cmd,
      User: 'root',
      WorkingDir: '/root',
      Env: env,
    });
    const payload = Buffer.from(JSON.stringify({ Detach: false, Tty: true }));
    const stream = await new Promise<Duplex>((resolve, reject) => {
      const request = http.request({
        socketPath: this.socketPath,
        method: 'POST',
        path: `/exec/${id}/start`,
        headers: {
          Host: 'engine',
          'Content-Type': 'application/json',
          'Content-Length': payload.length,
          Connection: 'Upgrade',
          Upgrade: 'tcp',
        },
      });
      request.on('upgrade', (_response, socket, head) => {
        if (head.length > 0) socket.unshift(head);
        resolve(socket);
      });
      request.on('response', (response) => {
        // An engine that answers 200 instead of 101 still streams on the same socket.
        if (response.statusCode === 200) resolve(response.socket as Duplex);
        else {
          const chunks: Buffer[] = [];
          response.on('data', (chunk: Buffer) => chunks.push(chunk));
          response.on('end', () =>
            reject(new EngineError(response.statusCode ?? 0, `exec attach: ${Buffer.concat(chunks).toString('utf8').slice(0, 300)}`)),
          );
        }
      });
      request.on('error', reject);
      request.write(payload);
      request.end();
    });
    return { id, stream };
  }

  async resizeExec(id: string, cols: number, rows: number): Promise<void> {
    await this.call('POST', `/exec/${id}/resize?h=${rows}&w=${cols}`, undefined, { ok: [200, 201, 204, 404, 409, 500] });
  }
}
