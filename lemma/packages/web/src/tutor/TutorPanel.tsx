import { type TutorMode, type TutorStreamEvent, type TutorThreadDto, TUTOR_MODES } from '@lemma/core';
import { useQueryClient } from '@tanstack/react-query';
import { History, Plus, Send, ShieldCheck, Square, Trash2, X } from 'lucide-react';
import { type FormEvent, type KeyboardEvent, useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../app/api';
import { useT } from '../app/i18n';
import { TUTOR_MODE_HINTS, TUTOR_MODE_NAMES } from '../app/labels';
import { useThreads } from '../app/queries';
import { cn } from '../lib/cn';
import { formatDateTime } from '../lib/format';
import { RichText } from '../lib/Math';
import { IconButton, Notice, Select, Spinner } from '../ui';
import { useTutor } from './context';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  /** How many times the reply consulted the app's evaluator. */
  toolCalls?: number;
  truncated?: boolean;
}

type Phase = 'idle' | 'waiting' | 'tool' | 'writing';

const TOOL_LABELS: Record<string, [string, string]> = {
  evaluate_expression: ['Počítám přes vyhodnocovač…', 'Computing with the evaluator…'],
  compare_expressions: ['Ověřuji krok přes vyhodnocovač…', 'Verifying a step with the evaluator…'],
  check_answer: ['Kontroluji odpověď přes vyhodnocovač…', 'Checking the answer with the evaluator…'],
  get_practice_problem: ['Vybírám ověřenou úlohu…', 'Picking a verified problem…'],
  check_practice_answer: ['Kontroluji odpověď přes vyhodnocovač…', 'Checking the answer with the evaluator…'],
};

/** Read a server-sent-event stream of JSON objects. */
async function readEvents(response: Response, onEvent: (event: TutorStreamEvent) => void): Promise<void> {
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let boundary = buffer.indexOf('\n\n');
    while (boundary !== -1) {
      const block = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);
      boundary = buffer.indexOf('\n\n');
      const line = block.split('\n').find((row) => row.startsWith('data:'));
      if (!line) continue;
      try {
        onEvent(JSON.parse(line.slice(5)) as TutorStreamEvent);
      } catch {
        // A malformed event is skipped; the stream itself carries on.
      }
    }
  }
}

export function TutorPanel({ model }: { model: string | null }) {
  const t = useT();
  const tutor = useTutor();
  const client = useQueryClient();
  const { target } = tutor;

  const [threadId, setThreadId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [mode, setMode] = useState<TutorMode>(target.mode ?? 'socratic');
  const [draft, setDraft] = useState(target.draft ?? '');
  const [phase, setPhase] = useState<Phase>('idle');
  const [toolName, setToolName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const abort = useRef<AbortController | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const box = useRef<HTMLTextAreaElement>(null);
  const threads = useThreads();

  const loadThread = useCallback((thread: TutorThreadDto) => {
    setThreadId(thread.id);
    setMode(thread.mode);
    setMessages(thread.messages.map((message) => ({ role: message.role, content: message.content })));
    setError(null);
    setShowHistory(false);
  }, []);

  // Opened for a particular problem or concept: continue that problem's conversation if
  // there is one, otherwise start clean.
  useEffect(() => {
    let cancelled = false;
    abort.current?.abort();
    setThreadId(null);
    setMessages([]);
    setError(null);
    setPhase('idle');
    setMode(target.mode ?? 'socratic');
    setDraft(target.draft ?? '');
    if (target.problemId) {
      void api
        .get<TutorThreadDto[]>(`/api/tutor/threads?problemId=${encodeURIComponent(target.problemId)}`)
        .then((found) => (found[0] ? api.get<TutorThreadDto>(`/api/tutor/threads/${found[0].id}`) : null))
        .then((thread) => {
          if (thread && !cancelled) loadThread(thread);
        })
        .catch(() => undefined);
    }
    box.current?.focus();
    return () => {
      cancelled = true;
    };
  }, [target, loadThread]);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight });
  }, [messages, phase]);

  useEffect(() => () => abort.current?.abort(), []);

  const send = async (text: string): Promise<void> => {
    const message = text.trim();
    if (message === '' || phase !== 'idle') return;
    setError(null);
    setDraft('');
    setMessages((current) => [...current, { role: 'user', content: message }, { role: 'assistant', content: '' }]);
    setPhase('waiting');
    const controller = new AbortController();
    abort.current = controller;

    const patchLast = (change: (last: ChatMessage) => ChatMessage): void =>
      setMessages((current) =>
        current.length === 0 ? current : [...current.slice(0, -1), change(current[current.length - 1]!)],
      );
    const dropEmptyReply = (): void =>
      setMessages((current) =>
        current[current.length - 1]?.role === 'assistant' && current[current.length - 1]!.content.trim() === ''
          ? current.slice(0, -1)
          : current,
      );

    try {
      const response = await fetch('/api/tutor/chat', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          threadId: threadId ?? undefined,
          mode,
          message,
          concept: target.concept,
          problemId: target.problemId,
        }),
        signal: controller.signal,
      });
      if (!response.ok || !response.body) {
        const body = (await response.json().catch(() => null)) as { error?: string; message?: string } | null;
        dropEmptyReply();
        setError(
          body?.error === 'exam_running'
            ? t(
                'Během zkoušky nanečisto tutor mlčí. Po jejím skončení je zase k dispozici.',
                'The tutor stays silent during a mock exam. It is available again once the exam is over.',
              )
            : body?.error === 'placement_running'
              ? t(
                  'Během rozřazovacího testu tutor mlčí: test má zjistit, co zvládneš bez pomoci. Po jeho skončení je zase k dispozici.',
                  'The tutor stays silent during a placement test: the test is there to find what you can do unaided. It is available again once the test is over.',
                )
              : body?.error === 'tutor_disabled'
                ? t('Tutor není nastaven.', 'The tutor is not configured.')
                : (body?.message ?? t('Požadavek selhal.', 'The request failed.')),
        );
        return;
      }
      await readEvents(response, (event) => {
        switch (event.type) {
          case 'start':
            setThreadId(event.threadId);
            break;
          case 'delta':
            setPhase('writing');
            patchLast((last) => ({ ...last, content: last.content + event.text }));
            break;
          case 'retract':
            patchLast((last) => ({
              ...last,
              content: last.content.slice(0, Math.max(0, last.content.length - event.chars)),
            }));
            break;
          case 'tool':
            setPhase('tool');
            setToolName(event.name);
            break;
          case 'done':
            patchLast((last) => ({ ...last, toolCalls: event.toolCalls, truncated: event.truncated }));
            break;
          case 'error':
            // A refusal withdraws the reply; other failures keep what was already shown.
            if (event.code === 'refused') patchLast((last) => ({ ...last, content: '' }));
            if (event.code !== 'aborted') setError(event.message);
            break;
        }
      });
      dropEmptyReply();
    } catch (failure) {
      dropEmptyReply();
      if (!(failure instanceof DOMException && failure.name === 'AbortError'))
        setError(t('Spojení s tutorem se přerušilo.', 'The connection to the tutor was lost.'));
    } finally {
      setPhase('idle');
      setToolName(null);
      abort.current = null;
      // Help with an open problem changes how that problem will count.
      void client.invalidateQueries({ queryKey: ['threads'] });
    }
  };

  const submit = (event: FormEvent): void => {
    event.preventDefault();
    void send(draft);
  };
  const onKey = (event: KeyboardEvent<HTMLTextAreaElement>): void => {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      void send(draft);
    }
  };

  const fresh = (): void => {
    abort.current?.abort();
    setThreadId(null);
    setMessages([]);
    setError(null);
    setShowHistory(false);
    box.current?.focus();
  };

  const busy = phase !== 'idle';
  const toolLabel = TOOL_LABELS[toolName ?? ''] ?? ['Ověřuji…', 'Verifying…'];
  const status =
    phase === 'tool' ? t(toolLabel[0], toolLabel[1]) : phase === 'waiting' ? t('Přemýšlí…', 'Thinking…') : null;

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2.5">
        <div className="min-w-0">
          <div className="font-semibold">{t('Tutor', 'Tutor')}</div>
          {model && <div className="mono-label truncate">{model}</div>}
        </div>
        <div className="flex items-center">
          <IconButton label={t('Nový rozhovor', 'New conversation')} onClick={fresh}>
            <Plus size={16} />
          </IconButton>
          <IconButton
            label={t('Dřívější rozhovory', 'Earlier conversations')}
            onClick={() => setShowHistory((value) => !value)}
            aria-pressed={showHistory}
          >
            <History size={16} />
          </IconButton>
          <IconButton label={t('Zavřít', 'Close')} onClick={tutor.close}>
            <X size={16} />
          </IconButton>
        </div>
      </div>

      {showHistory ? (
        <div className="min-h-0 flex-1 overflow-y-auto p-2">
          {(threads.data ?? []).length === 0 && (
            <p className="px-2 py-6 text-center text-sm text-ink-3">
              {t('Zatím žádné rozhovory.', 'No conversations yet.')}
            </p>
          )}
          <ul className="space-y-0.5">
            {(threads.data ?? []).map((thread) => (
              <li key={thread.id} className="group flex items-center gap-1">
                <button
                  type="button"
                  className="min-w-0 flex-1 rounded-md px-2 py-1.5 text-left hover:bg-surface-2"
                  onClick={() => void api.get<TutorThreadDto>(`/api/tutor/threads/${thread.id}`).then(loadThread)}
                >
                  <div className="truncate text-sm">{thread.title}</div>
                  <div className="mono-label">
                    {formatDateTime(thread.updatedAt, t.locale)} · {t(TUTOR_MODE_NAMES[thread.mode])}
                  </div>
                </button>
                <IconButton
                  label={t('Smazat rozhovor', 'Delete conversation')}
                  onClick={() => {
                    void api.delete(`/api/tutor/threads/${thread.id}`).then(() => {
                      if (thread.id === threadId) fresh();
                      void threads.refetch();
                    });
                  }}
                >
                  <Trash2 size={14} />
                </IconButton>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div ref={scroller} className="min-h-0 flex-1 space-y-3 overflow-y-auto px-3 py-3">
          {messages.length === 0 && (
            <div className="space-y-3 pt-2 text-sm text-ink-2">
              <p>
                {target.problemId
                  ? t(
                      'Ptej se k úloze, kterou máš otevřenou. Tutor vidí zadání i tvé pokusy.',
                      'Ask about the problem you have open. The tutor sees the statement and your attempts.',
                    )
                  : t(
                      'Zeptej se na cokoli z matematiky. Nejvíc pomáhá, když napíšeš, co jsi už zkusil.',
                      'Ask anything about the mathematics. It helps most when you say what you have already tried.',
                    )}
              </p>
              {target.problemId && (
                <Notice tone="info">
                  {t(
                    'Rada k otevřené úloze se počítá jako nápověda: úloha pak nebude „vyřešená samostatně“.',
                    'Help with an open problem counts as a hint: the problem will then not be “solved unaided”.',
                  )}
                </Notice>
              )}
              <p className="text-[13px] text-ink-3">
                {t(
                  'Tutor není zdrojem pravdy. O správnosti rozhoduje vyhodnocovač aplikace; tutor ho může volat a v odpovědi je to vyznačeno.',
                  'The tutor is not the source of truth. Correctness is decided by the app’s evaluator; the tutor can call it, and replies show when it did.',
                )}
              </p>
            </div>
          )}
          {messages.map((message, index) =>
            message.role === 'user' ? (
              <div key={index} className="ml-8 rounded-lg bg-surface-2 px-3 py-2 text-sm whitespace-pre-wrap">
                {message.content}
              </div>
            ) : message.content === '' ? null : (
              <div key={index} className="mr-4 text-sm">
                <RichText text={message.content} />
                {(message.toolCalls ?? 0) > 0 && (
                  <div className="mt-1.5 flex items-center gap-1.5 text-xs text-ink-3">
                    <ShieldCheck size={13} aria-hidden />
                    {t('Výpočty ověřeny vyhodnocovačem aplikace', 'Calculations verified by the app’s evaluator')} (
                    {message.toolCalls}×)
                  </div>
                )}
                {message.truncated && (
                  <div className="mt-1.5 text-xs text-ink-3">
                    {t('Odpověď byla zkrácena limitem délky.', 'The reply was cut off by the length limit.')}
                  </div>
                )}
              </div>
            ),
          )}
          {status && (
            <div className="flex items-center gap-2 text-[13px] text-ink-3" role="status">
              <Spinner />
              {status}
            </div>
          )}
          {error && <Notice tone="serious">{error}</Notice>}
        </div>
      )}

      <form onSubmit={submit} className="border-t border-border p-3">
        <div className="mb-2">
          <Select
            value={mode}
            onChange={(event) => setMode(event.target.value as TutorMode)}
            aria-label={t('Režim tutora', 'Tutor mode')}
            className="h-8 text-[13px]"
          >
            {TUTOR_MODES.map((value) => (
              <option key={value} value={value}>
                {t(TUTOR_MODE_NAMES[value])}
              </option>
            ))}
          </Select>
          <div className="mt-1 text-xs text-ink-3">{t(TUTOR_MODE_HINTS[mode])}</div>
        </div>
        <div className="flex items-end gap-2">
          <textarea
            ref={box}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={onKey}
            rows={Math.min(8, Math.max(2, draft.split('\n').length))}
            maxLength={6000}
            placeholder={t(
              'Napiš zprávu…  (Enter odešle, Shift+Enter nový řádek)',
              'Write a message…  (Enter sends, Shift+Enter for a new line)',
            )}
            className="min-h-[60px] flex-1 resize-none rounded-lg border border-border-strong bg-surface-2 px-3 py-2 text-sm placeholder:text-ink-3 focus:border-accent focus:outline-none"
          />
          {busy ? (
            <button
              type="button"
              onClick={() => abort.current?.abort()}
              className={cn(
                'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border-strong bg-surface-2 text-ink hover:bg-surface-3',
              )}
              aria-label={t('Zastavit', 'Stop')}
              title={t('Zastavit', 'Stop')}
            >
              <Square size={14} />
            </button>
          ) : (
            <button
              type="submit"
              disabled={draft.trim() === ''}
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent-solid text-white hover:bg-accent-solid-hover disabled:opacity-40"
              aria-label={t('Odeslat', 'Send')}
              title={t('Odeslat', 'Send')}
            >
              <Send size={15} />
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
