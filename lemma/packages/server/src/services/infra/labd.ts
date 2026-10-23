import type { LabHostDto } from '@lemma/core';
import WebSocket from 'ws';
import type { Config } from '../../config';
import { HttpError } from '../context';

/**
 * The Lemma server's side of the lab worker. The server never touches a container engine:
 * it asks labd, over a private network, with the shared token, and always names the
 * account the lab belongs to. Without LABD_URL and LABD_TOKEN, or with labd down, every
 * call fails with 503 and the rest of the application carries on.
 */

export interface LabView {
  id: string;
  owner: string;
  scenarioId: string;
  version: number;
  status: 'provisioning' | 'ready' | 'busy' | 'failed' | 'destroying' | 'destroyed' | 'expired';
  operation: 'create' | 'verify' | 'reset' | null;
  error: string | null;
  createdAt: number;
  readyAt: number | null;
  expiresAt: number;
  endedAt: number | null;
  generation: number;
  verifications: number;
  machines: string[];
}

export interface VerifyResult {
  lab: LabView;
  results: { id: string; passed: boolean; ms: number }[];
  diagnostics: string[];
}

interface StatusResponse {
  host: {
    engine: { reachable: boolean; version: string | null };
    capabilities: LabHostDto['capabilities'];
    images: Record<'base' | 'full', { status: LabHostDto['images']['base'] }>;
    probing: boolean;
    problems: string[];
  };
  limits: Record<string, number>;
}

export interface AdminLabs {
  labs: (LabView & { detail: string | null })[];
  usage: { lab: LabView; machines: { name: string; memory: number | null; cpuPercent: number | null; diskBytes: number | null }[] }[];
}

/** What the server needs from labd; tests replace it with a fake. */
export interface LabService {
  configured(): boolean;
  status(): Promise<{ host: LabHostDto; limits: Record<string, number> | null }>;
  create(owner: string, scenario: string): Promise<LabView>;
  get(owner: string, id: string): Promise<LabView | null>;
  list(owner: string): Promise<LabView[]>;
  verify(owner: string, id: string): Promise<VerifyResult>;
  reset(owner: string, id: string): Promise<LabView>;
  touch(owner: string, id: string): Promise<LabView>;
  destroy(owner: string, id: string): Promise<LabView | null>;
  adminLabs(): Promise<AdminLabs>;
  adminDestroy(id: string): Promise<void>;
  prepare(): Promise<void>;
  /** A WebSocket to the lab's terminal; the caller pipes it to the browser's. */
  terminal(owner: string, id: string, machine: string, cols: number, rows: number): WebSocket;
}

const UNCONFIGURED: LabHostDto = {
  configured: false,
  reachable: false,
  engine: null,
  capabilities: { systemd: null, multiUser: null, networks: null },
  images: { base: 'pending', full: 'pending' },
  preparing: false,
  problems: ['labs are not set up on this server (LABD_URL and LABD_TOKEN)'],
};

export class LabdClient implements LabService {
  private cached: { at: number; value: { host: LabHostDto; limits: Record<string, number> | null } } | null = null;

  constructor(
    private readonly config: Config['labd'],
    private readonly now: () => number = () => Date.now(),
  ) {}

  configured(): boolean {
    return this.config.url !== '' && this.config.token !== '';
  }

  private async call<T>(method: string, path: string, body?: unknown, timeoutMs = 20_000): Promise<T> {
    if (!this.configured()) throw new HttpError(503, 'labs_unavailable', 'labs are not set up on this server');
    let response: Response;
    try {
      response = await fetch(`${this.config.url}${path}`, {
        method,
        headers: { Authorization: `Bearer ${this.config.token}`, 'Content-Type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch {
      throw new HttpError(503, 'labs_unavailable', 'the lab service cannot be reached right now');
    }
    const data = (await response.json().catch(() => ({}))) as { error?: string; message?: string };
    if (!response.ok) {
      const status = ([400, 404, 409, 503] as const).find((s) => s === response.status) ?? 502;
      if (response.status === 401) throw new HttpError(502, 'labs_misconfigured', 'the lab service refused the token (LABD_TOKEN differs)');
      throw new HttpError(status, data.error ?? 'labs_error', data.message ?? 'the lab service failed');
    }
    return data as T;
  }

  async status(): Promise<{ host: LabHostDto; limits: Record<string, number> | null }> {
    if (!this.configured()) return { host: UNCONFIGURED, limits: null };
    if (this.cached && this.now() - this.cached.at < 10_000) return this.cached.value;
    let value: { host: LabHostDto; limits: Record<string, number> | null };
    try {
      const s = await this.call<StatusResponse>('GET', '/v1/status', undefined, 5_000);
      const images = s.host.images as unknown as Record<'base' | 'full', { status: LabHostDto['images']['base'] }>;
      value = {
        host: {
          configured: true,
          reachable: s.host.engine.reachable,
          engine: s.host.engine.version,
          capabilities: s.host.capabilities,
          images: { base: images.base.status, full: images.full.status },
          preparing: s.host.probing || images.base.status === 'building' || images.full.status === 'building',
          problems: s.host.problems,
        },
        limits: s.limits,
      };
    } catch {
      value = {
        host: { ...UNCONFIGURED, configured: true, problems: ['the lab service does not answer'] },
        limits: null,
      };
    }
    this.cached = { at: this.now(), value };
    return value;
  }

  create(owner: string, scenario: string): Promise<LabView> {
    return this.call('POST', '/v1/labs', { owner, scenario });
  }

  async get(owner: string, id: string): Promise<LabView | null> {
    try {
      return await this.call<LabView>('GET', `/v1/labs/${encodeURIComponent(id)}?owner=${encodeURIComponent(owner)}`);
    } catch (error) {
      if (error instanceof HttpError && error.status === 404) return null;
      throw error;
    }
  }

  list(owner: string): Promise<LabView[]> {
    return this.call('GET', `/v1/labs?owner=${encodeURIComponent(owner)}`);
  }

  verify(owner: string, id: string): Promise<VerifyResult> {
    return this.call('POST', `/v1/labs/${encodeURIComponent(id)}/verify`, { owner }, 180_000);
  }

  reset(owner: string, id: string): Promise<LabView> {
    return this.call('POST', `/v1/labs/${encodeURIComponent(id)}/reset`, { owner });
  }

  touch(owner: string, id: string): Promise<LabView> {
    return this.call('POST', `/v1/labs/${encodeURIComponent(id)}/touch`, { owner });
  }

  async destroy(owner: string, id: string): Promise<LabView | null> {
    try {
      return await this.call<LabView>('DELETE', `/v1/labs/${encodeURIComponent(id)}?owner=${encodeURIComponent(owner)}`);
    } catch (error) {
      if (error instanceof HttpError && error.status === 404) return null;
      throw error;
    }
  }

  adminLabs(): Promise<AdminLabs> {
    return this.call('GET', '/v1/admin/labs', undefined, 30_000);
  }

  async adminDestroy(id: string): Promise<void> {
    await this.call('DELETE', `/v1/admin/labs/${encodeURIComponent(id)}`);
  }

  async prepare(): Promise<void> {
    await this.call('POST', '/v1/admin/prepare');
    this.cached = null;
  }

  terminal(owner: string, id: string, machine: string, cols: number, rows: number): WebSocket {
    const url = new URL(`${this.config.url.replace(/^http/, 'ws')}/v1/labs/${encodeURIComponent(id)}/terminal`);
    url.searchParams.set('owner', owner);
    url.searchParams.set('machine', machine);
    url.searchParams.set('cols', String(cols));
    url.searchParams.set('rows', String(rows));
    return new WebSocket(url, { headers: { Authorization: `Bearer ${this.config.token}` }, maxPayload: 1024 * 1024 });
  }
}
