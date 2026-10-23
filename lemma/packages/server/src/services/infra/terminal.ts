import type { IncomingMessage, Server } from 'node:http';
import type { Duplex } from 'node:stream';
import { type RawData, WebSocketServer } from 'ws';
import type { Accounts, Learner } from '../../accounts';
import { SESSION_COOKIE } from '../../auth';
import type { Config } from '../../config';
import { errorFields, log } from '../../log';
import type { LabService } from './labd';
import { terminalLab } from './service';

/**
 * The browser's terminal: a WebSocket at /api/infra/attempts/:id/terminal, piped to the
 * lab's terminal in labd. Hono does not see upgrades, so this hangs off the HTTP server
 * itself and does the same checks the API does before anything is opened:
 *
 *   - the Origin must be this site (a WebSocket carries cookies, and no CORS stops it),
 *   - the session cookie must belong to a signed-in account,
 *   - the attempt is looked up in that account's own database, and labd is asked for the
 *     lab on behalf of that account — so no other account's terminal can be reached.
 */

const PATH = /^\/api\/infra\/attempts\/([A-Za-z0-9_-]{6,24})\/terminal$/;

const cookieOf = (header: string | undefined, name: string): string | undefined => {
  for (const part of (header ?? '').split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) return decodeURIComponent(rest.join('='));
  }
  return undefined;
};

const clamp = (value: string | null, min: number, max: number, fallback: number): number => {
  const n = Number(value);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : fallback;
};

export function attachTerminalProxy(server: Server, deps: { accounts: Accounts; config: Config; labs: LabService }): void {
  const { accounts, config, labs } = deps;
  const wss = new WebSocketServer({ noServer: true, maxPayload: 64 * 1024 });

  const refuse = (socket: Duplex, status: number, text: string): void => {
    socket.write(`HTTP/1.1 ${status} ${text}\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`);
    socket.destroy();
  };

  const sameOrigin = (req: IncomingMessage): boolean => {
    const origin = req.headers.origin;
    if (!origin) return false;
    const host = (config.trustProxy ? (req.headers['x-forwarded-host'] as string | undefined) : undefined) ?? req.headers.host ?? '';
    try {
      return new URL(origin).host === host || config.allowedOrigins.includes(origin.replace(/\/+$/, ''));
    } catch {
      return false;
    }
  };

  server.on('upgrade', (req: IncomingMessage, socket: Duplex, head: Buffer) => {
    const url = new URL(req.url ?? '/', 'http://lemma');
    const match = PATH.exec(url.pathname);
    if (!match) return refuse(socket, 404, 'Not Found');
    if (!sameOrigin(req)) return refuse(socket, 403, 'Forbidden');

    void (async () => {
      const learner: Learner | undefined = config.authDisabled
        ? accounts.admin()
        : await accounts.bySession(cookieOf(req.headers.cookie, SESSION_COOKIE));
      if (!learner) return refuse(socket, 401, 'Unauthorized');
      let lab: string;
      try {
        lab = terminalLab(learner.ctx, match[1]!);
      } catch {
        return refuse(socket, 404, 'Not Found');
      }
      const machine = (url.searchParams.get('machine') ?? '').replace(/[^a-z0-9-]/g, '').slice(0, 21);
      const cols = clamp(url.searchParams.get('cols'), 10, 500, 80);
      const rows = clamp(url.searchParams.get('rows'), 4, 200, 24);

      wss.handleUpgrade(req, socket, head, (browser) => {
        const upstream = labs.terminal(learner.username, lab, machine, cols, rows);
        const pending: { data: RawData; binary: boolean }[] = [];
        const forward = (data: RawData, binary: boolean): void => {
          if (upstream.readyState === upstream.OPEN) upstream.send(data, { binary });
          else if (upstream.readyState === upstream.CONNECTING && pending.length < 100) pending.push({ data, binary });
        };
        browser.on('message', forward);
        upstream.on('open', () => {
          for (const p of pending.splice(0)) upstream.send(p.data, { binary: p.binary });
          log.info('terminal opened', { username: learner.username, attempt: match[1], machine: machine || '(first)' });
        });
        upstream.on('message', (data, binary) => {
          if (browser.readyState === browser.OPEN) browser.send(data, { binary });
        });
        const closeBoth = (code: number, reason: string): void => {
          const safe = code >= 1000 && code < 5000 && code !== 1005 && code !== 1006 ? code : 1011;
          if (browser.readyState === browser.OPEN) browser.close(safe, reason.slice(0, 120));
          if (upstream.readyState === upstream.OPEN || upstream.readyState === upstream.CONNECTING) upstream.terminate();
        };
        upstream.on('close', (code, reason) => closeBoth(code, reason.toString()));
        upstream.on('unexpected-response', (_request, response) => closeBoth(4000 + Math.min(999, response.statusCode ?? 500), 'the lab terminal is not available'));
        upstream.on('error', (error) => {
          log.warn('lab terminal connection failed', errorFields(error));
          closeBoth(1011, 'the lab service cannot be reached');
        });
        browser.on('close', () => closeBoth(1000, ''));
        browser.on('error', () => closeBoth(1011, ''));
      });
    })().catch((error: unknown) => {
      log.error('terminal upgrade failed', errorFields(error));
      refuse(socket, 500, 'Internal Server Error');
    });
  });
}
