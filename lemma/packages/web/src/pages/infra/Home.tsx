import { Link } from 'react-router';
import { useInfraOverview } from '../../app/infra-queries';
import { useT } from '../../app/i18n';
import { formatDay } from '../../lib/format';
import { Card, Empty, ErrorNote, Loading, LinkButton, Notice, PageHeader, SectionLabel, StatTile } from '../../ui';
import { HostNotice, STATUS_LABEL, ScenarioCard, SkillLine, formatMinutes } from './parts';

/** The dashboard of the Linux & Infrastructure mode: what to do next, and where you stand. */
export function InfraHome() {
  const t = useT();
  const overview = useInfraOverview();
  if (overview.isPending) return <Loading />;
  if (overview.isError) return <ErrorNote error={overview.error} retry={() => void overview.refetch()} />;
  const o = overview.data;
  const practised = o.skills.filter((s) => s.level !== 'new');
  const struggling = o.skills.filter((s) => s.struggling);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={t('Linux a infrastruktura', 'Linux & Infrastructure')}
        title={t('Přehled', 'Dashboard')}
        lead={t(
          'Praktické laboratoře: server se připraví sám, vy hledáte a opravujete.',
          'Hands-on labs: the server prepares itself, you diagnose and fix.',
        )}
      />
      <HostNotice host={o.host} />

      {o.active && (
        <Notice
          tone="info"
          title={t('Máte otevřenou laboratoř', 'You have a lab open')}
          action={
            <LinkButton to={`/infra/attempts/${o.active.id}`} variant="primary" size="sm">
              {t('Pokračovat', 'Continue')}
            </LinkButton>
          }
        >
          {t('Spuštěno', 'Started')} {formatDay(new Date(o.active.startedAt).toISOString().slice(0, 10), t.locale)}
        </Notice>
      )}

      {o.assignments.length > 0 && (
        <Card className="p-4">
          <SectionLabel>{t('Zadáno učitelem', 'Assigned by your teacher')}</SectionLabel>
          <ul className="mt-2 space-y-1 text-sm">
            {o.assignments.map((a) => (
              <li key={a.id}>
                <Link to={`/infra/scenarios/${a.scenarioId}`}>{t(a.title)}</Link>
                {a.dueDay && <span className="text-ink-3"> · {t('do', 'due')} {formatDay(a.dueDay, t.locale)}</span>}
                {a.note && <span className="text-ink-2"> — {a.note}</span>}
              </li>
            ))}
          </ul>
        </Card>
      )}

      <section>
        <SectionLabel action={<Link to="/infra/roadmap" className="text-xs">{t('Celá cesta', 'The whole roadmap')}</Link>}>
          {t('Doporučeno dál', 'Recommended next')}
        </SectionLabel>
        {o.recommendations.length === 0 ? (
          <div className="mt-2">
            <Empty title={t('Teď tu nic spustit nejde', 'Nothing can be started here right now')}>
              {t('Až bude služba laboratoří k dispozici, objeví se tu další krok.', 'Once the lab service is available, the next step appears here.')}
            </Empty>
          </div>
        ) : (
          <div className="mt-2 grid gap-3 md:grid-cols-2">
            {o.recommendations.slice(0, 4).map((r) => (
              <ScenarioCard key={r.scenario.id} scenario={r.scenario} reason={r.reason} kind={r.kind} />
            ))}
          </div>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <Card className="p-4">
          <SectionLabel action={<Link to="/infra/roadmap" className="text-xs">{t('Všechny dovednosti', 'All skills')}</Link>}>
            {t('Dovednosti', 'Skills')}
          </SectionLabel>
          {practised.length === 0 ? (
            <p className="mt-2 text-sm text-ink-2">
              {t('Úroveň dovednosti se ukáže po první laboratoři.', 'A skill level shows after your first lab.')}
            </p>
          ) : (
            <div className="mt-1 divide-y divide-border">
              {practised.map((s) => (
                <SkillLine key={s.skill} skill={s} />
              ))}
            </div>
          )}
        </Card>

        <div className="space-y-4">
          <Card className="grid grid-cols-2 gap-4 p-4">
            <StatTile label={t('Vyřešeno', 'Solved')} value={o.totals.solved} sub={t(`z toho ${o.totals.independent} samostatně`, `${o.totals.independent} on my own`)} />
            <StatTile label={t('Čas v laboratořích', 'Time in labs')} value={formatMinutes(o.totals.minutes * 60)} />
          </Card>
          {(struggling.length > 0 || o.recurring.length > 0) && (
            <Card className="p-4">
              <SectionLabel>{t('Na co si dát pozor', 'Watch out for')}</SectionLabel>
              <ul className="mt-2 space-y-1.5 text-sm">
                {o.recurring.map((m) => (
                  <li key={m.mistake}>
                    {t(m.label)} <span className="font-mono text-xs text-ink-3">×{m.count}</span>
                  </li>
                ))}
                {struggling.map((s) => (
                  <li key={s.skill} className="text-ink-2">
                    {t('Dovednost', 'Skill')}: {t(s.title)}
                  </li>
                ))}
              </ul>
            </Card>
          )}
          {o.recent.length > 0 && (
            <Card className="p-4">
              <SectionLabel action={<Link to="/infra/history" className="text-xs">{t('Historie', 'History')}</Link>}>
                {t('Naposledy', 'Recently')}
              </SectionLabel>
              <ul className="mt-2 space-y-1 text-sm">
                {o.recent.slice(0, 5).map((a) => (
                  <li key={a.id} className="flex justify-between gap-2">
                    <Link to={`/infra/attempts/${a.id}`} className="truncate">
                      {t(a.title)}
                    </Link>
                    <span className="shrink-0 font-mono text-xs text-ink-3">{t(STATUS_LABEL[a.status])}</span>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
