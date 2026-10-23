import { useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, XCircle } from 'lucide-react';
import { type FormEvent, useState } from 'react';
import { Link, useParams } from 'react-router';
import { api } from '../../app/api';
import { useInfraRoadmap, useInfraStudent, useInfraStudentAttempt } from '../../app/infra-queries';
import { useT } from '../../app/i18n';
import { Badge, Button, Card, ErrorNote, Field, Loading, Overlay, PageHeader, SectionLabel, Select, TextInput } from '../../ui';
import { KIND_LABEL, STATUS_LABEL, SkillLine, formatMinutes } from './parts';

/** A teacher's view of one learner's lab work: skills, recurring mistakes, attempts and reports. */
export function InfraStudent() {
  const t = useT();
  const { student } = useParams();
  const data = useInfraStudent(student);
  const roadmap = useInfraRoadmap();
  const client = useQueryClient();
  const [open, setOpen] = useState<string | null>(null);
  const [scenario, setScenario] = useState('');
  const [note, setNote] = useState('');
  const [due, setDue] = useState('');
  const [busy, setBusy] = useState(false);

  if (data.isPending) return <Loading />;
  if (data.isError) return <ErrorNote error={data.error} retry={() => void data.refetch()} />;
  const d = data.data;
  const scenarios = (roadmap.data?.categories ?? []).flatMap((c) => c.skills.flatMap((s) => s.scenarios));

  const assign = async (event: FormEvent): Promise<void> => {
    event.preventDefault();
    setBusy(true);
    try {
      await api.post(`/api/teach/students/${encodeURIComponent(d.username)}/infra/assignments`, { scenario, note, dueDay: due || null });
      setNote('');
      await client.invalidateQueries({ queryKey: ['infra', 'student', d.username] });
    } finally {
      setBusy(false);
    }
  };
  const cancel = async (id: string): Promise<void> => {
    await api.delete(`/api/teach/students/${encodeURIComponent(d.username)}/infra/assignments/${encodeURIComponent(id)}`);
    await client.invalidateQueries({ queryKey: ['infra', 'student', d.username] });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={<Link to={`/teach/${d.username}`}>{t('Žák', 'Student')}</Link>}
        title={`${d.username} · ${t('Linux a infrastruktura', 'Linux & Infrastructure')}`}
      />
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <Card className="p-4">
            <SectionLabel>{t('Dovednosti', 'Skills')}</SectionLabel>
            <div className="mt-1 divide-y divide-border">
              {d.skills.filter((s) => s.level !== 'new').map((s) => <SkillLine key={s.skill} skill={s} />)}
              {d.skills.every((s) => s.level === 'new') && <p className="py-2 text-sm text-ink-3">{t('Zatím žádná laboratoř.', 'No labs yet.')}</p>}
            </div>
          </Card>
          <Card className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-ink-2">
                  <th className="px-4 py-2 font-medium">{t('Laboratoř', 'Lab')}</th>
                  <th className="px-2 py-2 font-medium">{t('Stav', 'Status')}</th>
                  <th className="px-2 py-2 font-medium">{t('Nápověda', 'Hints')}</th>
                  <th className="px-2 py-2 font-medium">{t('Čas', 'Time')}</th>
                  <th className="px-2 py-2 font-medium">{t('Zpráva', 'Report')}</th>
                </tr>
              </thead>
              <tbody>
                {d.attempts.map((a) => (
                  <tr key={a.id} className="border-t border-border">
                    <td className="px-4 py-2">
                      <button type="button" className="text-left text-accent-ink" onClick={() => setOpen(a.id)}>
                        {t(a.title)}
                      </button>
                      <div className="font-mono text-[11px] text-ink-3">{new Date(a.startedAt).toLocaleString(t.locale)}</div>
                    </td>
                    <td className="px-2 py-2">
                      {t(STATUS_LABEL[a.status])}
                      {a.independent ? ` · ${t('samostatně', 'independent')}` : ''}
                    </td>
                    <td className="px-2 py-2 font-mono text-xs">
                      {a.hintLevel}/3{a.solutionViewed ? ' · sol.' : ''}
                    </td>
                    <td className="px-2 py-2 font-mono text-xs">{formatMinutes(a.seconds)}</td>
                    <td className="px-2 py-2 text-xs">{a.report ? (a.reportPassed ? t('úplná', 'complete') : t('neúplná', 'incomplete')) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </div>
        <div className="space-y-4">
          {d.recurring.length > 0 && (
            <Card className="p-4">
              <SectionLabel>{t('Opakující se chyby', 'Recurring mistakes')}</SectionLabel>
              <ul className="mt-2 space-y-1 text-sm">
                {d.recurring.map((m) => (
                  <li key={m.mistake}>
                    {t(m.label)} <span className="font-mono text-xs text-ink-3">×{m.count}</span>
                  </li>
                ))}
              </ul>
            </Card>
          )}
          <Card className="p-4">
            <SectionLabel>{t('Systém by doporučil', 'The system would suggest')}</SectionLabel>
            <ul className="mt-2 space-y-1.5 text-sm">
              {d.recommendations.map((r) => (
                <li key={r.scenario.id}>
                  <Badge tone="accent">{t(KIND_LABEL[r.kind])}</Badge> {t(r.scenario.title)}
                  <div className="text-xs text-ink-3">{t(r.reason)}</div>
                </li>
              ))}
            </ul>
          </Card>
          <Card className="p-4">
            <SectionLabel>{t('Zadat laboratoř', 'Assign a lab')}</SectionLabel>
            <form onSubmit={(event) => void assign(event)} className="mt-2 space-y-2">
              <Select value={scenario} onChange={(event) => setScenario(event.target.value)} required>
                <option value="">{t('Vyberte…', 'Choose…')}</option>
                {scenarios.map((s) => (
                  <option key={s.id} value={s.id}>
                    {t(s.title)}
                  </option>
                ))}
              </Select>
              <Field label={t('Poznámka pro žáka', 'Note for the student')}>
                <TextInput value={note} onChange={(event) => setNote(event.target.value)} maxLength={500} />
              </Field>
              <Field label={t('Termín', 'Due')}>
                <TextInput type="date" value={due} onChange={(event) => setDue(event.target.value)} />
              </Field>
              <Button type="submit" busy={busy} disabled={!scenario}>
                {t('Zadat', 'Assign')}
              </Button>
            </form>
            <ul className="mt-3 space-y-1 text-sm">
              {d.assignments.map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-2">
                  <span>
                    {t(a.title)} <span className="font-mono text-xs text-ink-3">{a.status}</span>
                  </span>
                  {a.status === 'open' && (
                    <button type="button" className="text-xs text-ink-3 hover:text-ink" onClick={() => void cancel(a.id)}>
                      {t('zrušit', 'cancel')}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
      <Overlay open={open !== null} onClose={() => setOpen(null)} title={t('Pokus', 'Attempt')} width={560}>
        {open && student && <AttemptReview student={student} id={open} />}
      </Overlay>
    </div>
  );
}

function AttemptReview({ student, id }: { student: string; id: string }) {
  const t = useT();
  const attempt = useInfraStudentAttempt(student, id);
  if (attempt.isPending) return <Loading />;
  if (attempt.isError) return <ErrorNote error={attempt.error} />;
  const a = attempt.data;
  return (
    <div className="space-y-4 text-sm">
      <div className="font-medium">{t(a.scenario.title)}</div>
      <div className="font-mono text-xs text-ink-3">
        {a.status} · {t('nápověda', 'hints')} {a.hintLevel}/3 · {t('kontrol', 'checks')} {a.verifications} · {formatMinutes(a.seconds)}
      </div>
      {a.results && (
        <ul className="space-y-1">
          {a.results.map((r) => (
            <li key={r.id} className="flex items-center gap-1.5">
              {r.passed ? <CheckCircle2 size={14} style={{ color: 'var(--good)' }} /> : <XCircle size={14} style={{ color: 'var(--critical)' }} />}
              {t(r.label)}
            </li>
          ))}
        </ul>
      )}
      <div>
        <div className="mono-label">{t('Použitá diagnostika', 'Diagnostics used')}</div>
        <div className="mt-1 text-xs">{a.diagnostics.filter((d) => d.used).map((d) => t(d.label)).join(' · ') || '—'}</div>
      </div>
      {a.report && (
        <div>
          <div className="mono-label">{t('Zpráva o incidentu', 'Incident report')}</div>
          <p className="mt-1 whitespace-pre-wrap rounded-lg border border-border bg-surface-2 p-3">{a.report}</p>
        </div>
      )}
    </div>
  );
}
