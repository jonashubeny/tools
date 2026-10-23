import { randomBytes } from 'node:crypto';
import type { WebSocket } from 'ws';
import type { Engine } from './engine';
import type { LabManager } from './labs';
import { errorFields, log } from './log';

/**
 * A terminal on a lab machine: a login shell started by exec with a TTY, its byte stream
 * bridged to a WebSocket. Binary frames carry the terminal's bytes both ways; text frames
 * carry control messages, of which there is one: {"type":"resize","cols":…,"rows":…}.
 *
 * The shell runs inside the lab container and nowhere else. When the socket closes, the
 * shell is sent SIGHUP, as a terminal hang-up would, so nothing is left running.
 */

const MAX_SESSIONS_PER_LAB = 4;
const sessions = new Map<string, number>();

const clamp = (value: unknown, min: number, max: number, fallback: number): number =>
  typeof value === 'number' && Number.isFinite(value) ? Math.min(max, Math.max(min, Math.round(value))) : fallback;

export async function openTerminal(
  ws: WebSocket,
  engine: Engine,
  labs: LabManager,
  request: { owner: string; lab: string; machine: string; cols: number; rows: number },
): Promise<void> {
  const container = labs.terminalTarget(request.owner, request.lab, request.machine);
  const open = sessions.get(request.lab) ?? 0;
  if (open >= MAX_SESSIONS_PER_LAB) {
    ws.close(4429, 'too many terminals on this lab');
    return;
  }
  sessions.set(request.lab, open + 1);

  const sid = randomBytes(6).toString('hex');
  const pidFile = `/run/lemma-term-${sid}.pid`;
  let stream;
  let execId: string;
  try {
    ({ id: execId, stream } = await engine.execInteractive(
      container,
      ['/bin/sh', '-c', `echo $$ > ${pidFile}; cat /etc/motd 2>/dev/null; exec /bin/bash -l`],
      [
        'TERM=xterm-256color',
        'HOME=/root',
        'LANG=C.UTF-8',
        'PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin',
      ],
    ));
  } catch (error) {
    sessions.set(request.lab, Math.max(0, (sessions.get(request.lab) ?? 1) - 1));
    log.warn('terminal could not start', { lab: request.lab, ...errorFields(error) });
    ws.close(1011, 'the terminal could not start');
    return;
  }
  await engine.resizeExec(execId, request.cols, request.rows).catch(() => undefined);
  log.info('terminal opened', { lab: request.lab, owner: request.owner, machine: request.machine || '(first)' });

  let closed = false;
  let lastTouch = 0;
  const close = (): void => {
    if (closed) return;
    closed = true;
    sessions.set(request.lab, Math.max(0, (sessions.get(request.lab) ?? 1) - 1));
    stream.destroy();
    if (ws.readyState === ws.OPEN) ws.close(1000, 'terminal closed');
    void engine
      .exec(container, ['sh', '-c', `[ -f ${pidFile} ] && kill -HUP "$(cat ${pidFile})" 2>/dev/null; rm -f ${pidFile}`], { timeoutMs: 10_000 })
      .catch(() => undefined);
    log.info('terminal closed', { lab: request.lab });
  };

  stream.on('data', (chunk: Buffer) => {
    if (ws.readyState === ws.OPEN) ws.send(chunk, { binary: true });
  });
  stream.on('end', close);
  stream.on('close', close);
  stream.on('error', close);

  ws.on('message', (data, isBinary) => {
    const bytes = Buffer.isBuffer(data) ? data : Array.isArray(data) ? Buffer.concat(data) : Buffer.from(data);
    if (isBinary) {
      stream.write(bytes);
      const now = Date.now();
      if (now - lastTouch > 30_000) {
        lastTouch = now;
        try {
          labs.touch(request.owner, request.lab);
        } catch {
          close();
        }
      }
      return;
    }
    try {
      const message = JSON.parse(bytes.toString('utf8')) as { type?: string; cols?: unknown; rows?: unknown };
      if (message.type === 'resize') {
        void engine.resizeExec(execId, clamp(message.cols, 10, 500, 80), clamp(message.rows, 4, 200, 24)).catch(() => undefined);
      }
    } catch {
      // not a control message: ignore
    }
  });
  ws.on('close', close);
  ws.on('error', close);
}

export const terminalSize = (cols: unknown, rows: unknown): { cols: number; rows: number } => ({
  cols: clamp(Number(cols), 10, 500, 80),
  rows: clamp(Number(rows), 4, 200, 24),
});
