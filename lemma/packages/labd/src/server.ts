import { timingSafeEqual } from 'node:crypto';
import http from 'node:http';
import { WebSocketServer } from 'ws';
import type { LabdConfig } from './config';
import type { Engine } from './engine';
import type { Host } from './host';
import { type LabManager, LabError, viewOf } from './labs';
import { errorFields, log } from './log';
import { openTerminal, terminalSize } from './terminal';

/**
 * labd's API. It is meant to be reached by the Lemma server alone, over a private network,
 * and every call carries the shared token. It offers a closed set of operations on labs
 * built from the reviewed scenarios — there is no call that runs a command of the caller's
 * choosing, and `owner` scopes every lab operation.
 *
 *   GET    /healthz                          liveness, no token
 *   GET    /v1/status                        host capabilities, images, limits, counts
 *   GET    /v1/availability?owner&scenario   may this owner start this scenario now?
 *   GET    /v1/labs?owner                    an owner's labs
 *   POST   /v1/labs            {owner, scenario}
 *   GET    /v1/labs/:id?owner
 *   POST   /v1/labs/:id/verify {owner}
 *   POST   /v1/labs/:id/reset  {owner}
 *   POST   /v1/labs/:id/touch  {owner}
 *   DELETE /v1/labs/:id?owner
 *   WS     /v1/labs/:id/terminal?owner&machine&cols&rows
 *   GET    /v1/admin/labs                    every lab, with details and resource use
 *   DELETE /v1/admin/labs/:id
 *   POST   /v1/admin/prepare                 probe the host and build images again
 */

const MAX_BODY = 16 * 1024;

export function createLabdServer(config: LabdConfig, engine: Engine, host: Host, labs: LabManager): http.Server {
  const token = Buffer.from(config.token);
  const authorised = (header: string | undefined): boolean => {
    const given = Buffer.from((header ?? '').replace(/^Bearer\s+/i, ''));
    return given.length === token.length && timingSafeEqual(given, token);
  };

  const send = (res: http.ServerResponse, status: number, body: unknown): void => {
    const data = JSON.stringify(body);
    res.writeHead(status, { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data), 'Cache-Control': 'no-store' });
    res.end(data);
  };

  const readBody = (req: http.IncomingMessage): Promise<Record<string, unknown>> =>
    new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      let size = 0;
      req.on('data', (chunk: Buffer) => {
        size += chunk.length;
        if (size > MAX_BODY) {
          reject(new LabError(400, 'too_large', 'request body too large'));
          req.destroy();
        } else chunks.push(chunk);
      });
      req.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8').trim();
        if (text === '') return resolve({});
        try {
          const parsed: unknown = JSON.parse(text);
          if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) throw new Error('not an object');
          resolve(parsed as Record<string, unknown>);
        } catch {
          reject(new LabError(400, 'bad_json', 'the body is not a JSON object'));
        }
      });
      req.on('error', reject);
    });

  const ownerOf = (value: unknown): string => {
    if (typeof value !== 'string' || value === '') throw new LabError(400, 'bad_owner', 'owner is required');
    return value;
  };

  const handle = async (req: http.IncomingMessage, res: http.ServerResponse): Promise<void> => {
    const url = new URL(req.url ?? '/', 'http://labd');
    const parts = url.pathname.split('/').filter(Boolean);
    const method = req.method ?? 'GET';

    if (url.pathname === '/healthz') return send(res, 200, { status: 'ok' });
    if (!authorised(req.headers.authorization)) return send(res, 401, { error: 'unauthorised', message: 'missing or wrong token' });
    if (parts[0] !== 'v1') return send(res, 404, { error: 'not_found', message: 'no such endpoint' });

    // /v1/status
    if (parts[1] === 'status' && parts.length === 2 && method === 'GET') {
      const active = labs.active();
      return send(res, 200, {
        host: host.status(),
        limits: {
          maxLabs: config.maxLabs,
          maxLabsPerOwner: config.maxLabsPerOwner,
          maxMemoryMb: config.maxMemoryMb,
          maxDiskMb: config.maxDiskMb,
          maxLifetimeMinutes: config.maxLifetimeMinutes,
        },
        labs: { active: active.length },
      });
    }

    if (parts[1] === 'availability' && method === 'GET') {
      const refused = labs.refusal(ownerOf(url.searchParams.get('owner')), url.searchParams.get('scenario') ?? '');
      return send(res, 200, refused ? { ok: false, error: refused.code, message: refused.message } : { ok: true });
    }

    if (parts[1] === 'labs') {
      const id = parts[2];
      if (!id) {
        if (method === 'GET') return send(res, 200, labs.list(ownerOf(url.searchParams.get('owner'))).map(viewOf));
        if (method === 'POST') {
          const body = await readBody(req);
          if (typeof body.scenario !== 'string') throw new LabError(400, 'bad_request', 'scenario is required');
          return send(res, 201, viewOf(labs.create(ownerOf(body.owner), body.scenario)));
        }
      } else if (parts.length === 3) {
        if (method === 'GET') return send(res, 200, viewOf(labs.get(ownerOf(url.searchParams.get('owner')), id)));
        if (method === 'DELETE') return send(res, 200, viewOf(labs.destroy(ownerOf(url.searchParams.get('owner')), id)));
      } else if (parts.length === 4 && method === 'POST') {
        const owner = ownerOf((await readBody(req)).owner);
        if (parts[3] === 'verify') return send(res, 200, await labs.verify(owner, id));
        if (parts[3] === 'reset') return send(res, 200, viewOf(labs.reset(owner, id)));
        if (parts[3] === 'touch') return send(res, 200, viewOf(labs.touch(owner, id)));
      }
    }

    if (parts[1] === 'admin') {
      if (parts[2] === 'labs' && parts.length === 3 && method === 'GET') {
        return send(res, 200, { labs: labs.adminList(), usage: await labs.usage() });
      }
      if (parts[2] === 'labs' && parts.length === 4 && method === 'DELETE') {
        const lab = labs.list().find((entry) => entry.id === parts[3]);
        if (!lab) throw new LabError(404, 'not_found', 'no such lab');
        return send(res, 200, viewOf(labs.destroy(lab.owner, lab.id, 'destroyed', 'the administrator ended this lab')));
      }
      if (parts[2] === 'prepare' && method === 'POST') {
        void host.prepare();
        return send(res, 202, { ok: true });
      }
    }

    return send(res, 404, { error: 'not_found', message: 'no such endpoint' });
  };

  const server = http.createServer((req, res) => {
    handle(req, res).catch((error: unknown) => {
      if (error instanceof LabError) return send(res, error.status, { error: error.code, message: error.message });
      log.error('request failed', { path: req.url?.split('?')[0], ...errorFields(error) });
      send(res, 500, { error: 'internal', message: 'the lab service failed' });
    });
  });

  const wss = new WebSocketServer({ noServer: true, maxPayload: 64 * 1024 });
  server.on('upgrade', (req, socket, head) => {
    const url = new URL(req.url ?? '/', 'http://labd');
    const parts = url.pathname.split('/').filter(Boolean);
    const refuse = (status: number, text: string): void => {
      socket.write(`HTTP/1.1 ${status} ${text}\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`);
      socket.destroy();
    };
    if (!authorised(req.headers.authorization)) return refuse(401, 'Unauthorized');
    if (!(parts[0] === 'v1' && parts[1] === 'labs' && parts[2] && parts[3] === 'terminal' && parts.length === 4))
      return refuse(404, 'Not Found');
    const owner = url.searchParams.get('owner') ?? '';
    try {
      labs.terminalTarget(owner, parts[2], url.searchParams.get('machine') ?? '');
    } catch (error) {
      return refuse(error instanceof LabError ? error.status : 500, 'Refused');
    }
    wss.handleUpgrade(req, socket, head, (ws) => {
      const size = terminalSize(url.searchParams.get('cols'), url.searchParams.get('rows'));
      openTerminal(ws, engine, labs, {
        owner,
        lab: parts[2]!,
        machine: url.searchParams.get('machine') ?? '',
        ...size,
      }).catch((error: unknown) => {
        log.warn('terminal failed', errorFields(error));
        ws.close(1011, 'terminal failed');
      });
    });
  });

  return server;
}
