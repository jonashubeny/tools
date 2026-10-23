import type { AttemptDto } from '@lemma/core';
import { useQueryClient } from '@tanstack/react-query';
import { Play } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { api } from '../../app/api';
import { useInfraOverview, useScenario } from '../../app/infra-queries';
import { useT } from '../../app/i18n';
import { Markdown } from '../../app/Markdown';
import { Badge, Button, Card, ErrorNote, Loading, Notice, PageHeader, SectionLabel } from '../../ui';
import { Difficulty, ProgressMark, formatMinutes } from './parts';

/** One scenario before it is started: the situation, the objectives, what will be checked. */
export function InfraScenario() {
  const t = useT();
  const { id } = useParams();
  const scenario = useScenario(id);
  const overview = useInfraOverview();
  const navigate = useNavigate();
  const client = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  if (scenario.isPending) return <Loading />;
  if (scenario.isError) return <ErrorNote error={scenario.error} retry={() => void scenario.refetch()} />;
  const s = scenario.data;
  const active = overview.data?.active;
  const titleOf = (skill: string): string => {
    const found = overview.data?.skills.find((x) => x.skill === skill);
    return found ? t(found.title) : skill;
  };

  const start = async (): Promise<void> => {
    setBusy(true);
    setError(null);
    try {
      const attempt = await api.post<AttemptDto>(`/api/infra/scenarios/${encodeURIComponent(s.id)}/start`);
      await client.invalidateQueries({ queryKey: ['infra'] });
      navigate(`/infra/attempts/${attempt.id}`);
    } catch (failure) {
      setError(failure);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={
          <span className="inline-flex items-center gap-2">
            <Link to="/infra/roadmap">{t('Cesta', 'Roadmap')}</Link> · <Difficulty value={s.difficulty} /> · ~{s.estimatedMinutes} min
          </span>
        }
        title={t(s.title)}
        lead={t(s.summary)}
        actions={
          active ? (
            <Button variant="primary" onClick={() => navigate(`/infra/attempts/${active.id}`)}>
              {active.scenarioId === s.id ? t('Pokračovat v laboratoři', 'Continue the lab') : t('Otevřená laboratoř', 'Your open lab')}
            </Button>
          ) : (
            <Button variant="primary" size="lg" onClick={() => void start()} busy={busy} disabled={!s.runnable}>
              <Play size={16} />
              {t('Spustit laboratoř', 'Start the lab')}
            </Button>
          )
        }
      />
      {error !== null && <ErrorNote error={error} />}
      {!s.runnable && s.unavailable && <Notice tone="warning" title={t('Teď spustit nejde', 'Cannot start right now')}>{t(s.unavailable)}</Notice>}
      {s.waitingFor.length > 0 && (
        <Notice tone="info" title={t('Doporučujeme nejdřív procvičit', 'We suggest practising first')}>
          {t('Tato laboratoř staví na dovednosti, se kterou jste měli potíže:', 'This lab builds on a skill that has given you trouble:')}{' '}
          {s.waitingFor.map(titleOf).join(', ')}. {t('Spustit ji ale můžete.', 'You can still start it.')}
        </Notice>
      )}
      {s.untested && (
        <Notice tone="info" title={t('Experimentální laboratoř', 'Experimental lab')}>
          {t(
            'Napsaná a zkontrolovaná, ale autor ji ještě neprověřil celou na serveru, který to umí. Kdyby se něco chovalo divně, dejte vědět správci.',
            'Written and reviewed, but not yet run end to end by its author on a host that can run it. If anything behaves oddly, tell the administrator.',
          )}
        </Notice>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          <Card className="p-5">
            <SectionLabel>{t('Situace', 'The situation')}</SectionLabel>
            <div className="mt-2">
              <Markdown text={t(s.briefing)} />
            </div>
          </Card>
          <Card className="p-5">
            <SectionLabel>{t('Co se naučíte', 'What you will learn')}</SectionLabel>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
              {s.objectives.map((o, n) => (
                <li key={n}>{t(o)}</li>
              ))}
            </ul>
            <SectionLabel className="mt-5">{t('Co se zkontroluje', 'What will be checked')}</SectionLabel>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-ink-2">
              {s.checks.map((c) => (
                <li key={c.id}>{t(c.label)}</li>
              ))}
            </ul>
          </Card>
        </div>
        <div className="space-y-4">
          <Card className="space-y-3 p-4 text-sm">
            <div>
              <div className="mono-label">{t('Stroje', 'Machines')}</div>
              <div className="mt-1 font-mono">{s.machineNames.join(', ')}</div>
            </div>
            <div>
              <div className="mono-label">{t('Dovednosti', 'Skills')}</div>
              <div className="mt-1 flex flex-wrap gap-1">
                {s.skills.map((k) => (
                  <Badge key={k}>{titleOf(k)}</Badge>
                ))}
              </div>
            </div>
            {s.prerequisites.length > 0 && (
              <div>
                <div className="mono-label">{t('Předpoklady', 'Builds on')}</div>
                <div className="mt-1 text-ink-2">{s.prerequisites.map(titleOf).join(', ')}</div>
              </div>
            )}
            <div>
              <div className="mono-label">{t('Ověřeno na', 'Checked on')}</div>
              <div className="mt-1 text-xs text-ink-2">{s.verifiedOn}</div>
            </div>
            <ProgressMark progress={s.progress} />
          </Card>
          <Card className="p-4">
            <SectionLabel>{t('Dokumenty', 'Documents')}</SectionLabel>
            <ul className="mt-2 space-y-1 text-sm">
              {s.resources.map((r) => (
                <li key={r.id}>
                  {r.url ? (
                    <a href={r.url} target="_blank" rel="noreferrer noopener">
                      {t(r.title)}
                    </a>
                  ) : (
                    <Link to={`/infra/library#${r.id}`}>{t(r.title)}</Link>
                  )}
                </li>
              ))}
            </ul>
            <Link to={`/infra/guide?scenario=${s.id}`} className="mt-3 inline-block text-sm">
              {t('Studijní materiál k tisku / PDF', 'Printable study guide / PDF')}
            </Link>
          </Card>
          {s.history.length > 0 && (
            <Card className="p-4">
              <SectionLabel>{t('Vaše pokusy', 'Your attempts')}</SectionLabel>
              <ul className="mt-2 space-y-1 text-sm">
                {s.history.map((h) => (
                  <li key={h.id} className="flex justify-between gap-2">
                    <Link to={`/infra/attempts/${h.id}`}>{new Date(h.startedAt).toLocaleDateString(t.locale)}</Link>
                    <span className="font-mono text-xs text-ink-3">
                      {h.status} · {formatMinutes(h.seconds)}
                    </span>
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
