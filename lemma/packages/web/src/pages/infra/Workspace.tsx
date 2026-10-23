import type { AttemptDto } from '@lemma/core';
import { useQueryClient } from '@tanstack/react-query';
import { BookOpen, CheckCircle2, ClipboardCheck, FileText, Lightbulb, LogOut, NotebookPen, RotateCcw, XCircle } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { api } from '../../app/api';
import { useAttempt } from '../../app/infra-queries';
import { useT } from '../../app/i18n';
import { Markdown } from '../../app/Markdown';
import { cn } from '../../lib/cn';
import { Badge, Button, Card, ErrorNote, Loading, Notice, Segmented, Spinner } from '../../ui';
import { formatMinutes } from './parts';
import { LabTerminal } from './Terminal';

type Tab = 'task' | 'hints' | 'check' | 'docs' | 'notes';

/**
 * The lab itself: the terminal takes the room, the side panel holds the task, the
 * progressive hints, the checks, the documents and the learner's notes. Reset and exit
 * are always one click away, and both ask first.
 */
export function Workspace() {
  const t = useT();
  const { id } = useParams();
  const attempt = useAttempt(id);
  const client = useQueryClient();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>('task');
  const [machine, setMachine] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [resets, setResets] = useState(0);

  // Time with the lab on screen, reported every minute; it also keeps the lab alive.
  const visibleSince = useRef(Date.now());
  useEffect(() => {
    if (!id) return;
    const beat = (): void => {
      const now = Date.now();
      const seconds = document.visibilityState === 'visible' ? Math.round((now - visibleSince.current) / 1000) : 0;
      visibleSince.current = now;
      if (seconds > 0) void api.post(`/api/infra/attempts/${encodeURIComponent(id)}/heartbeat`, { seconds }).catch(() => undefined);
    };
    const timer = setInterval(beat, 60_000);
    const onVisibility = (): void => {
      if (document.visibilityState === 'visible') visibleSince.current = Date.now();
      else beat();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisibility);
      beat();
    };
  }, [id]);

  if (attempt.isPending) return <Loading />;
  if (attempt.isError) return <ErrorNote error={attempt.error} retry={() => void attempt.refetch()} />;
  const a = attempt.data;
  const lab = a.lab;
  const s = a.scenario;
  const currentMachine = machine || lab?.machines[0] || s.machineNames[0] || '';

  const act = async (name: string, path: string, body: unknown = {}, method: 'post' | 'put' = 'post'): Promise<AttemptDto | undefined> => {
    setBusy(name);
    setError(null);
    try {
      const result = await api[method]<AttemptDto>(`/api/infra/attempts/${encodeURIComponent(a.id)}/${path}`, body);
      client.setQueryData(['infra', 'attempt', a.id], result);
      void client.invalidateQueries({ queryKey: ['infra', 'overview'] });
      return result;
    } catch (failure) {
      setError(failure);
      return undefined;
    } finally {
      setBusy(null);
    }
  };

  const reset = async (): Promise<void> => {
    if (!window.confirm(t('Vrátit laboratoř do výchozího stavu? Vše, co jste na strojích změnili, zmizí.', 'Return the lab to its initial state? Everything you changed on the machines is lost.')))
      return;
    await act('reset', 'reset');
    setResets((n) => n + 1);
  };
  const exit = async (): Promise<void> => {
    const question =
      a.status === 'solved'
        ? t('Ukončit laboratoř? Stroje budou odstraněny.', 'End the lab? The machines will be removed.')
        : t('Ukončit laboratoř bez vyřešení? Stroje budou odstraněny a pokus se zapíše jako nedokončený.', 'Leave the lab unsolved? The machines are removed and the attempt is recorded as abandoned.');
    if (!window.confirm(question)) return;
    const result = await act('exit', 'finish');
    if (result) navigate(`/infra/scenarios/${s.id}`);
  };

  const status = lab?.status ?? 'destroyed';
  const ready = status === 'ready' || status === 'busy';
  const tabs: { value: Tab; label: string; icon: typeof FileText }[] = [
    { value: 'task', label: t('Úkol', 'Task'), icon: FileText },
    { value: 'hints', label: t('Nápověda', 'Hints'), icon: Lightbulb },
    { value: 'check', label: t('Kontrola', 'Check'), icon: ClipboardCheck },
    { value: 'docs', label: t('Dokumenty', 'Docs'), icon: BookOpen },
    { value: 'notes', label: t('Poznámky', 'Notes'), icon: NotebookPen },
  ];

  return (
    <div className="flex flex-col gap-4 xl:h-[calc(100dvh-4rem)]">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="mono-label">
            <Link to={`/infra/scenarios/${s.id}`}>{t('Laboratoř', 'Lab')}</Link>
          </div>
          <h1 className="truncate text-xl font-semibold tracking-tight">{t(s.title)}</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {a.status === 'solved' ? (
            <Badge tone="accent">
              <CheckCircle2 size={12} /> {t('vyřešeno', 'solved')}
            </Badge>
          ) : (
            <Badge>{t('rozpracováno', 'in progress')}</Badge>
          )}
          {lab && ready && (
            <span className="font-mono text-xs text-ink-3">
              {t('vyprší', 'expires')} {new Date(lab.expiresAt).toLocaleTimeString(t.locale, { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          {lab && (
            <Button size="sm" onClick={() => void reset()} busy={busy === 'reset'} disabled={busy !== null || status === 'provisioning'}>
              <RotateCcw size={14} />
              {t('Reset', 'Reset')}
            </Button>
          )}
          {lab && (
            <Button size="sm" variant="danger" onClick={() => void exit()} busy={busy === 'exit'} disabled={busy !== null}>
              <LogOut size={14} />
              {t('Ukončit', 'Exit')}
            </Button>
          )}
        </div>
      </header>

      {error !== null && <ErrorNote error={error} />}

      <div className="grid min-h-0 flex-1 gap-4 xl:grid-cols-[minmax(0,1fr)_400px]">
        <div className="flex min-h-[420px] min-w-0 flex-col gap-2">
          {lab && lab.machines.length > 1 && (
            <Segmented
              label={t('Stroj', 'Machine')}
              value={currentMachine}
              onChange={setMachine}
              options={lab.machines.map((m) => ({ value: m, label: m }))}
              size="sm"
            />
          )}
          {!lab ? (
            <Card className="grid flex-1 place-items-center p-8 text-center">
              <div className="max-w-sm space-y-2">
                <div className="font-medium">{t('Laboratoř už neběží', 'The lab is no longer running')}</div>
                <p className="text-sm text-ink-2">
                  {a.status === 'expired'
                    ? t('Byla odstraněna po době nečinnosti.', 'It was removed after a period without activity.')
                    : t('Stroje byly odstraněny. Výsledek zůstal zapsaný.', 'The machines were removed. The result stays recorded.')}
                </p>
                <Link to={`/infra/scenarios/${s.id}`} className="text-sm">
                  {t('Zpět na scénář', 'Back to the scenario')}
                </Link>
              </div>
            </Card>
          ) : status === 'provisioning' || status === 'destroying' ? (
            <Card className="grid flex-1 place-items-center p-8 text-center">
              <div className="space-y-2">
                <Spinner className="mx-auto" />
                <div className="font-medium">
                  {lab.operation === 'reset' ? t('Vracím stroje do výchozího stavu…', 'Returning the machines to their initial state…') : t('Připravuji stroje…', 'Preparing the machines…')}
                </div>
                <p className="text-sm text-ink-2">
                  {t('Spouštím je, nastavuji služby a připravuji závadu. Obvykle do minuty.', 'Starting them, configuring services and setting up the fault. Usually under a minute.')}
                </p>
              </div>
            </Card>
          ) : status === 'failed' ? (
            <Notice
              tone="critical"
              title={t('Laboratoř se nepodařilo připravit', 'The lab could not be prepared')}
              action={
                <Button size="sm" onClick={() => void reset()}>
                  {t('Zkusit znovu', 'Try again')}
                </Button>
              }
            >
              {lab.error}
            </Notice>
          ) : (
            <div className="min-h-0 flex-1">
              <LabTerminal attemptId={a.id} machine={currentMachine} generation={resets} />
            </div>
          )}
        </div>

        <Card className="flex min-h-0 flex-col">
          <div className="flex flex-wrap gap-1 border-b border-border p-1.5" role="tablist">
            {tabs.map((entry) => (
              <button
                key={entry.value}
                type="button"
                role="tab"
                aria-selected={tab === entry.value}
                onClick={() => setTab(entry.value)}
                className={cn(
                  'inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-[13px]',
                  tab === entry.value ? 'bg-surface-2 font-medium text-ink' : 'text-ink-2 hover:text-ink',
                )}
              >
                <entry.icon size={14} />
                {entry.label}
              </button>
            ))}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            {tab === 'task' && <TaskPanel a={a} />}
            {tab === 'hints' && <HintPanel a={a} busy={busy} act={act} />}
            {tab === 'check' && <CheckPanel a={a} busy={busy} ready={ready} act={act} />}
            {tab === 'docs' && <DocsPanel a={a} />}
            {tab === 'notes' && <NotesPanel a={a} />}
          </div>
        </Card>
      </div>
    </div>
  );
}

type Act = (name: string, path: string, body?: unknown, method?: 'post' | 'put') => Promise<AttemptDto | undefined>;

function TaskPanel({ a }: { a: AttemptDto }) {
  const t = useT();
  const s = a.scenario;
  return (
    <div className="space-y-4">
      {a.status === 'solved' && a.explanation && (
        <Notice tone="good" title={t('Vyřešeno', 'Solved')}>
          {a.independent ? t('Samostatně — bez podrobné nápovědy.', 'On your own — without the detailed hints.') : t('S pomocí nápovědy.', 'With help from the hints.')}
        </Notice>
      )}
      <Markdown text={t(s.briefing)} />
      <div>
        <div className="mono-label mb-1.5">{t('Cíle', 'Objectives')}</div>
        <ul className="list-disc space-y-1 pl-5 text-sm">
          {s.objectives.map((o, n) => (
            <li key={n}>{t(o)}</li>
          ))}
        </ul>
      </div>
      {a.status === 'solved' && a.explanation && (
        <div className="space-y-3 border-t border-border pt-4">
          <div className="mono-label">{t('Co se dělo a proč', 'What was going on, and why')}</div>
          <Markdown text={t(a.explanation)} />
          {a.solution && (
            <>
              <div className="mono-label">{t('Vzorové řešení', 'A worked solution')}</div>
              <Markdown text={t(a.solution)} />
            </>
          )}
          <Link to={`/infra/guide?scenario=${s.id}`} className="text-sm">
            {t('Studijní materiál k tématu (PDF)', 'A study guide on the topic (PDF)')}
          </Link>
        </div>
      )}
      <div className="font-mono text-[11px] text-ink-3">
        {t('Ověřeno na', 'Checked on')}: {s.verifiedOn} · {t('čas', 'time')} {formatMinutes(a.seconds)}
      </div>
    </div>
  );
}

function HintPanel({ a, busy, act }: { a: AttemptDto; busy: string | null; act: Act }) {
  const t = useT();
  const levelText = [
    '',
    t('Kde hledat', 'Where to look'),
    t('Jak diagnostikovat', 'How to diagnose'),
    t('Vysvětlení a oprava', 'Explanation and fix'),
  ];
  const next = a.hints.length + 1;
  return (
    <div className="space-y-4">
      <p className="text-xs text-ink-3">
        {t(
          'Nápověda má tři stupně. První ukáže směr; třetí už řeší. Do hodnocení se počítá, kolik jí bylo potřeba.',
          'Hints come in three steps. The first points a direction; the third solves. How much was needed counts in the assessment.',
        )}
      </p>
      {a.hints.map((hint) => (
        <div key={hint.level} className="space-y-2 rounded-lg border border-border p-3">
          <div className="mono-label">
            {hint.level}. {levelText[hint.level]}
          </div>
          <Markdown text={t(hint.text)} />
          {hint.commands.length > 0 && (
            <pre className="overflow-x-auto rounded-md bg-surface-2 p-2 font-mono text-[12px] leading-relaxed">{hint.commands.join('\n')}</pre>
          )}
        </div>
      ))}
      {a.status === 'active' && next <= 3 && (
        <Button onClick={() => void act('hint', 'hint')} busy={busy === 'hint'}>
          <Lightbulb size={14} />
          {t(`Ukázat nápovědu ${next}: ${levelText[next]}`, `Show hint ${next}: ${levelText[next]}`)}
        </Button>
      )}
      {a.status === 'active' && a.hints.length === 3 && !a.solution && (
        <Button variant="ghost" onClick={() => void act('solution', 'solution')} busy={busy === 'solution'}>
          {t('Ukázat celé řešení', 'Show the full solution')}
        </Button>
      )}
      {a.solution && a.status === 'active' && <Markdown text={t(a.solution)} />}
    </div>
  );
}

function CheckPanel({ a, busy, ready, act }: { a: AttemptDto; busy: string | null; ready: boolean; act: Act }) {
  const t = useT();
  const [report, setReport] = useState(a.report);
  const s = a.scenario;
  return (
    <div className="space-y-4">
      <Button variant="primary" className="w-full" onClick={() => void act('verify', 'verify')} busy={busy === 'verify'} disabled={!ready || busy !== null}>
        <ClipboardCheck size={16} />
        {t('Zkontrolovat řešení', 'Check my solution')}
      </Button>
      <ul className="space-y-2">
        {s.checks.map((check) => {
          const result = a.results?.find((r) => r.id === check.id);
          return (
            <li key={check.id} className="flex gap-2 text-sm">
              {result ? (
                result.passed ? (
                  <CheckCircle2 size={16} className="mt-0.5 shrink-0" style={{ color: 'var(--good)' }} aria-label={t('splněno', 'passed')} />
                ) : (
                  <XCircle size={16} className="mt-0.5 shrink-0" style={{ color: 'var(--critical)' }} aria-label={t('nesplněno', 'failed')} />
                )
              ) : (
                <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-surface-3" aria-hidden />
              )}
              <div>
                <div>{t(check.label)}</div>
                {result && !result.passed && result.hint && <div className="text-xs text-ink-3">{t(result.hint)}</div>}
              </div>
            </li>
          );
        })}
      </ul>
      {s.report && (
        <div className="space-y-2 border-t border-border pt-4">
          <div className="mono-label">{t('Zpráva o incidentu', 'Incident report')}</div>
          <p className="text-xs text-ink-2">{t(s.report.prompt)}</p>
          <textarea
            value={report}
            onChange={(event) => setReport(event.target.value)}
            rows={9}
            className="w-full rounded-lg border border-border-strong bg-surface-2 p-2 text-sm"
          />
          <Button size="sm" onClick={() => void act('report', 'report', { report }, 'put')} busy={busy === 'report'}>
            {t('Uložit zprávu', 'Save the report')}
          </Button>
          {a.reportResult && (
            <ul className="space-y-1 text-xs">
              {s.report.items.map((item) => (
                <li key={item.id} className="flex items-center gap-1.5">
                  {a.reportResult!.found.includes(item.id) ? (
                    <CheckCircle2 size={13} style={{ color: 'var(--good)' }} aria-hidden />
                  ) : (
                    <XCircle size={13} style={{ color: 'var(--critical)' }} aria-hidden />
                  )}
                  {t(item.label)}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      {a.diagnostics.length > 0 && (
        <div className="space-y-1 border-t border-border pt-4">
          <div className="mono-label">{t('Diagnostika, kterou jste použili', 'Diagnostics you used')}</div>
          <ul className="space-y-1 text-xs">
            {a.diagnostics.map((d) => (
              <li key={d.id} className={cn('flex items-center gap-1.5', d.used ? 'text-ink' : 'text-ink-3')}>
                {d.used ? (
                  <CheckCircle2 size={13} style={{ color: 'var(--good)' }} aria-label={t('použito', 'used')} />
                ) : (
                  <span className="inline-block h-[13px] w-[13px] rounded-full border border-border-strong" aria-label={t('nepoužito', 'not used')} />
                )}
                {t(d.label)}
              </li>
            ))}
          </ul>
          <p className="text-[11px] text-ink-3">{t('Zjištěno z historie příkazů při kontrole.', 'Read from the shell history at each check.')}</p>
        </div>
      )}
    </div>
  );
}

function DocsPanel({ a }: { a: AttemptDto }) {
  const t = useT();
  return (
    <div className="space-y-3">
      {a.scenario.resources.map((r) => (
        <details key={r.id} className="rounded-lg border border-border p-3">
          <summary className="cursor-pointer text-sm font-medium">
            {t(r.title)} <span className="font-mono text-[11px] text-ink-3">{r.kind}</span>
          </summary>
          <div className="mt-2">
            {r.body ? (
              <Markdown text={t(r.body)} />
            ) : r.url ? (
              <a href={r.url} target="_blank" rel="noreferrer noopener" className="text-sm break-all">
                {r.url}
              </a>
            ) : null}
            {r.verifiedOn && <div className="mt-2 font-mono text-[11px] text-ink-3">{r.verifiedOn}</div>}
          </div>
        </details>
      ))}
      <Link to={`/infra/guide?scenario=${a.scenario.id}`} className="text-sm">
        {t('Sestavit studijní materiál k tisku / PDF', 'Assemble a printable study guide / PDF')}
      </Link>
    </div>
  );
}

function NotesPanel({ a }: { a: AttemptDto }) {
  const t = useT();
  const [text, setText] = useState(a.scenario.note);
  const [saved, setSaved] = useState<'idle' | 'saving' | 'saved'>('idle');
  const save = async (): Promise<void> => {
    setSaved('saving');
    await api.put(`/api/infra/notes/${encodeURIComponent(a.scenario.id)}`, { body: text });
    setSaved('saved');
  };
  return (
    <div className="space-y-2">
      <p className="text-xs text-ink-3">{t('Soukromé poznámky k tomuto scénáři. Učitel je nevidí.', 'Private notes on this scenario. Your teacher does not see them.')}</p>
      <textarea
        value={text}
        onChange={(event) => {
          setText(event.target.value);
          setSaved('idle');
        }}
        rows={14}
        className="w-full rounded-lg border border-border-strong bg-surface-2 p-2 font-mono text-[13px]"
      />
      <Button size="sm" onClick={() => void save()} busy={saved === 'saving'}>
        {saved === 'saved' ? t('Uloženo', 'Saved') : t('Uložit', 'Save')}
      </Button>
    </div>
  );
}
