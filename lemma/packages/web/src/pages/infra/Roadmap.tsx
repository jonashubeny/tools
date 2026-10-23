import { Link } from 'react-router';
import { useInfraRoadmap } from '../../app/infra-queries';
import { useT } from '../../app/i18n';
import { Card, ErrorNote, Loading, PageHeader } from '../../ui';
import { LEVEL_LABEL, ScenarioCard } from './parts';

/** From beginner to advanced: categories, the skills in each, their labs and what is planned. */
export function InfraRoadmap() {
  const t = useT();
  const roadmap = useInfraRoadmap();
  if (roadmap.isPending) return <Loading />;
  if (roadmap.isError) return <ErrorNote error={roadmap.error} retry={() => void roadmap.refetch()} />;
  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow={t('Linux a infrastruktura', 'Linux & Infrastructure')}
        title={t('Cesta a dovednosti', 'Roadmap and skills')}
        lead={t(
          'Úroveň dovednosti vyžaduje důkazy: samostatné řešení, víc různých laboratoří, a že to umíte i po týdnu.',
          'A skill level asks for evidence: solving on your own, in more than one lab, and still a week later.',
        )}
      />
      {roadmap.data.categories.map((category) => (
        <section key={category.category} className="space-y-3">
          <h2 className="text-lg font-semibold tracking-tight">{t(category.title)}</h2>
          {category.skills.map(({ skill, scenarios, planned }) => (
            <Card key={skill.skill} className="p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div>
                  <div className="font-medium">{t(skill.title)}</div>
                  <div className="text-sm text-ink-2">{t(skill.description)}</div>
                </div>
                <div className="flex items-center gap-2 font-mono text-[11px] text-ink-2">
                  {skill.struggling && <span className="text-warning-ink">{t('potíže', 'struggling')}</span>}
                  {t(LEVEL_LABEL[skill.level])}
                  {skill.level !== 'new' && (
                    <Link to={`/infra/guide?skill=${skill.skill}`} className="font-sans text-xs">
                      {t('studijní materiál', 'study guide')}
                    </Link>
                  )}
                </div>
              </div>
              {scenarios.length > 0 && (
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  {scenarios.map((s) => (
                    <ScenarioCard key={s.id} scenario={s} />
                  ))}
                </div>
              )}
              {planned.length > 0 && (
                <ul className="mt-3 space-y-0.5 text-sm text-ink-3">
                  {planned.map((p, n) => (
                    <li key={n}>
                      {t('Připravuje se', 'Planned')}: {t(p)}
                    </li>
                  ))}
                </ul>
              )}
              {scenarios.length === 0 && planned.length === 0 && (
                <div className="mt-2 text-sm text-ink-3">{t('Procvičuje se v laboratořích jiných dovedností.', 'Practised inside the labs of other skills.')}</div>
              )}
            </Card>
          ))}
        </section>
      ))}
    </div>
  );
}
