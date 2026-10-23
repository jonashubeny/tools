import '@xterm/xterm/css/xterm.css';
import { FitAddon } from '@xterm/addon-fit';
import { Terminal as XTerm } from '@xterm/xterm';
import { RotateCw } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useT } from '../../app/i18n';
import { Button } from '../../ui';

/**
 * A terminal on a lab machine. The bytes go over a WebSocket to the Lemma server, which
 * checks the session and passes them to the lab worker; binary frames are the terminal's
 * bytes, text frames are control messages (a resize). Closing the page hangs up the shell.
 */
export function LabTerminal({ attemptId, machine, generation }: { attemptId: string; machine: string; generation: number }) {
  const t = useT();
  const host = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<'connecting' | 'open' | 'closed'>('connecting');
  const [reason, setReason] = useState('');
  const [round, setRound] = useState(0);

  useEffect(() => {
    if (!host.current) return;
    const css = getComputedStyle(document.documentElement);
    const color = (name: string, fallback: string): string => css.getPropertyValue(name).trim() || fallback;
    const term = new XTerm({
      cursorBlink: true,
      fontFamily: '"Red Hat Mono Variable", ui-monospace, monospace',
      fontSize: 13.5,
      scrollback: 5000,
      theme: {
        background: color('--surface-1', '#16181b'),
        foreground: color('--text', '#f2f3f5'),
        cursor: color('--accent', '#3987e5'),
        selectionBackground: color('--accent-wash', 'rgba(57,135,229,0.3)'),
      },
    });
    const fit = new FitAddon();
    term.loadAddon(fit);
    term.open(host.current);
    fit.fit();

    const scheme = location.protocol === 'https:' ? 'wss' : 'ws';
    const query = new URLSearchParams({ machine, cols: String(term.cols), rows: String(term.rows) });
    const ws = new WebSocket(`${scheme}://${location.host}/api/infra/attempts/${encodeURIComponent(attemptId)}/terminal?${query}`);
    ws.binaryType = 'arraybuffer';
    setState('connecting');
    const encoder = new TextEncoder();

    ws.onopen = () => {
      setState('open');
      term.focus();
    };
    ws.onmessage = (event) => {
      if (event.data instanceof ArrayBuffer) term.write(new Uint8Array(event.data));
      else term.write(String(event.data));
    };
    ws.onclose = (event) => {
      setState('closed');
      setReason(event.reason);
      term.write(`\r\n\x1b[2m[${t('spojení ukončeno', 'connection closed')}]\x1b[0m\r\n`);
    };
    const input = term.onData((data) => {
      if (ws.readyState === WebSocket.OPEN) ws.send(encoder.encode(data));
    });
    const resize = term.onResize(({ cols, rows }) => {
      if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'resize', cols, rows }));
    });
    const observer = new ResizeObserver(() => {
      try {
        fit.fit();
      } catch {
        // detached
      }
    });
    observer.observe(host.current);

    return () => {
      observer.disconnect();
      input.dispose();
      resize.dispose();
      ws.close();
      term.dispose();
    };
    // `t` changes only with the language; reconnecting for that is not wanted.
  }, [attemptId, machine, generation, round]);

  return (
    <div className="flex h-full min-h-[360px] flex-col overflow-hidden rounded-xl border border-border bg-surface-1">
      <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-1.5">
        <div className="flex items-center gap-2 font-mono text-xs text-ink-2">
          <span
            className="h-2 w-2 rounded-full"
            style={{ background: state === 'open' ? 'var(--good)' : state === 'connecting' ? 'var(--warning)' : 'var(--critical)' }}
            aria-hidden
          />
          root@{machine}
          <span className="text-ink-3">
            {state === 'open' ? t('připojeno', 'connected') : state === 'connecting' ? t('připojuji…', 'connecting…') : reason || t('odpojeno', 'disconnected')}
          </span>
        </div>
        {state === 'closed' && (
          <Button size="sm" variant="ghost" onClick={() => setRound((n) => n + 1)}>
            <RotateCw size={14} />
            {t('Připojit znovu', 'Reconnect')}
          </Button>
        )}
      </div>
      <div ref={host} className="min-h-0 flex-1 p-2" />
    </div>
  );
}
