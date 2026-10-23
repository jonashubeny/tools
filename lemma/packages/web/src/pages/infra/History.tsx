import { Link } from 'react-router';
import { useAttempts, useInfraOverview } from '../../app/infra-queries';
import { useT } from '../../app/i18n';
import { Card, Empty, ErrorNote, Loading, PageHeader, SectionLabel } from '../../ui';
import { formatMinutes } from './parts';

/** Every lab attempt, and the mistakes that keep coming back. */
export function InfraHistory() {
  const t = useT();
  const attempts = useAttempts();
  const overview = useInfraOverview();
  if (attempts.isPending) return <Loading />;
  if (attempts.isError) return <ErrorNote error={attempts.error} retry={() => void attempts.refetch()} />;
  const status: Record<string, string> = {
    active: t('rozpracováno', 'in progress'),
    solved: t('vyřešeno', 'solved'),
    abandoned: t('nedokončeno', 'abandoned'),
    expired: t('vypršelo', 'expired'),
  };
  return (
    <div className="space-y-6">
      <PageHeader eyebrow={t('Linux a infrastruktura', 'Linux & Infrastructure')} title={t('Historie', 'History')} />
      {(overview.data?.recurring.length ?? 0) > 0 && (
        <Card className="p-4">
          <SectionLabel>{t('Opakující se chyby', 'Recurring mistakes')}</SectionLabel>
          <ul className="mt-2 space-y-1 text-sm">
            {overview.data!.recurring.map((m) => (
              <li key={m.mistake}>
                {t(m.label)} <span className="font-mono text-xs text-ink-3">×{m.count} · {m.scenarios.join(', ')}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}
      {attempts.data.length === 0 ? (
        <Empty title={t('Zatím žádná laboratoř', 'No labs yet')} />
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-ink-2">
                <th className="px-4 py-2 font-medium">{t('Scénář', 'Scenario')}</th>
                <th className="px-2 py-2 font-medium">{t('Začátek', 'Started')}</th>
                <th className="px-2 py-2 font-medium">{t('Stav', 'Status')}</th>
                <th className="px-2 py-2 font-medium">{t('Nápověda', 'Hints')}</th>
                <th className="px-2 py-2 font-medium">{t('Kontroly', 'Checks')}</th>
                <th className="px-2 py-2 font-medium">{t('Čas', 'Time')}</th>
              </tr>
            </thead>
            <tbody>
              {attempts.data.map((a) => (
                <tr key={a.id} className="border-t border-border">
                  <td className="px-4 py-2">
                    <Link to={`/infra/attempts/${a.id}`}>{t(a.title)}</Link>
                  </td>
                  <td className="px-2 py-2 font-mono text-xs">{new Date(a.startedAt).toLocaleString(t.locale)}</td>
                  <td className="px-2 py-2">
                    {status[a.status]}
                    {a.independent ? ` · ${t('samostatně', 'on my own')}` : ''}
                  </td>
                  <td className="px-2 py-2 font-mono text-xs">
                    {a.hintLevel}/3{a.solutionViewed ? ` · ${t('řešení', 'solution')}` : ''}
                  </td>
                  <td className="px-2 py-2 font-mono text-xs">{a.verifications}</td>
                  <td className="px-2 py-2 font-mono text-xs">{formatMinutes(a.seconds)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
