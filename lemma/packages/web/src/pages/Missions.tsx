import type { MissionDto } from '@lemma/core';
import { Check, Clock, ExternalLink } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router';
import { api } from '../app/api';
import { useT } from '../app/i18n';
import { useMissions, useRefresh } from '../app/queries';
import { cn } from '../lib/cn';
import { RichText } from '../lib/Math';
import { Badge, Card, ErrorNote, Field, Loading, PageHeader, TextInput } from '../ui';
import { LevelBar } from '../viz/charts';

/** Missions: small engineering projects in which the mathematics has a job to do. */
export function Missions() {
  const t = useT();
  const missions = useMissions();
  const location = useLocation();

  // Arriving with #mission-id scrolls to that mission.
  useEffect(() => {
    if (!missions.data || !location.hash) return;
    document.getElementById(location.hash.slice(1))?.scrollIntoView({ block: 'start' });
  }, [missions.data, location.hash]);

  if (missions.isPending) return <Loading />;
  if (missions.isError) return <ErrorNote error={missions.error} retry={() => void missions.refetch()} />;
  const order = { active: 0, idle: 1, done: 2 } as const;
  const sorted = [...missions.data].sort((a, b) => order[a.status] - order[b.status]);

  return (
    <div>
      <PageHeader
        title={t('Mise', 'Missions')}
        lead={t(
          'Malé inženýrské projekty, ve kterých má matematika práci: něco, co poběží na tvém serveru nebo skončí v repozitáři. Dělají se mimo Lemmu; tady si jen vedeš postup.',
          'Small engineering projects in which the mathematics has a job to do: something that will run on your server or end up in a repository. They are done outside Lemma; here you just keep track.',
        )}
      />
      <div className="space-y-5">
        {sorted.map((mission) => (
          <Mission key={mission.id} mission={mission} />
        ))}
      </div>
    </div>
  );
}

function Mission({ mission }: { mission: MissionDto }) {
  const t = useT();
  const refresh = useRefresh();
  const [notes, setNotes] = useState(mission.notes);
  const [repoUrl, setRepoUrl] = useState(mission.repoUrl);
  const [saving, setSaving] = useState(false);
  const done = mission.milestones.filter((milestone) => milestone.done).length;

  const save = async (patch: Record<string, unknown>): Promise<void> => {
    setSaving(true);
    try {
      await api.put(`/api/missions/${mission.id}`, patch);
      refresh();
    } finally {
      setSaving(false);
    }
  };
  const toggle = (id: string): void => {
    const ticked = mission.milestones.filter((milestone) => milestone.done).map((milestone) => milestone.id);
    void save({ milestones: ticked.includes(id) ? ticked.filter((x) => x !== id) : [...ticked, id] });
  };

  return (
    <Card id={mission.id} className="scroll-mt-16 p-5">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-lg font-semibold">{t(mission.title)}</h2>
        {mission.status === 'active' && <Badge tone="accent">{t('rozpracováno', 'in progress')}</Badge>}
        {mission.status === 'done' && (
          <Badge tone="accent">
            <Check size={11} aria-hidden /> {t('hotovo', 'done')}
          </Badge>
        )}
        {!mission.ready && mission.status === 'idle' && (
          <Badge
            tone="outline"
            title={t(
              'Většinu pojmů, které mise používá, jsi ještě nepotkal.',
              'You have not yet met most of the concepts this mission uses.',
            )}
          >
            {t('na později', 'for later')}
          </Badge>
        )}
        <span className="ml-auto flex items-center gap-2 text-xs text-ink-3">
          <span className="flex items-center gap-1">
            <Clock size={12} aria-hidden />~{mission.hours} h
          </span>
          <span title={t('Náročnost', 'Difficulty')}>
            {'●'.repeat(mission.difficulty)}
            {'○'.repeat(3 - mission.difficulty)}
          </span>
        </span>
      </div>
      <div className="mt-2 max-w-3xl text-ink-2">
        <RichText text={t(mission.brief)} />
      </div>
      <p className="mt-2 max-w-3xl text-sm text-ink-3">
        <span className="font-medium text-ink-2">{t('K čemu to je: ', 'What it is for: ')}</span>
        {t(mission.payoff)}
      </p>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {mission.stack.map((item) => (
          <Badge key={item}>{item}</Badge>
        ))}
      </div>

      <div className="mt-5 grid gap-x-8 gap-y-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="min-w-0">
          <div className="mono-label mb-2">
            {t('Milníky', 'Milestones')} · {done}/{mission.milestones.length}
          </div>
          <ol className="space-y-1.5">
            {mission.milestones.map((milestone) => (
              <li key={milestone.id}>
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={milestone.done}
                  disabled={saving}
                  onClick={() => toggle(milestone.id)}
                  className="flex w-full items-start gap-3 rounded-lg border border-border bg-surface-2 px-3 py-2.5 text-left hover:bg-surface-3"
                >
                  <span
                    className={cn(
                      'mt-0.5 grid h-4.5 w-4.5 shrink-0 place-items-center rounded border',
                      milestone.done ? 'border-transparent bg-accent-solid text-white' : 'border-border-strong',
                    )}
                  >
                    {milestone.done && <Check size={12} aria-hidden />}
                  </span>
                  <span className="min-w-0">
                    <span className={cn('block text-sm font-medium', milestone.done && 'text-ink-2')}>
                      {t(milestone.title)}
                    </span>
                    <span className="mt-0.5 block text-[13px] text-ink-2">
                      <RichText text={t(milestone.detail)} inlineOnly />
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ol>
          {mission.stretch.length > 0 && (
            <div className="mt-4">
              <div className="mono-label mb-1.5">{t('Když budeš chtít víc', 'If you want more')}</div>
              <ul className="list-disc space-y-1 pl-5 text-[13px] text-ink-2">
                {mission.stretch.map((item, index) => (
                  <li key={index}>
                    <RichText text={t(item)} inlineOnly />
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="min-w-0 space-y-4">
          <div>
            <div className="mono-label mb-1.5">{t('Matematika v misi', 'The mathematics in it')}</div>
            <ul className="-mx-2">
              {mission.concepts.map((concept) => (
                <li key={concept.id}>
                  <Link
                    to={`/concept/${concept.id}`}
                    className="flex items-center justify-between gap-3 rounded-md px-2 py-1.5 text-sm text-ink hover:bg-surface-2 hover:no-underline"
                  >
                    <span className="min-w-0 truncate">{t(concept.title)}</span>
                    <LevelBar level={concept.level} size="sm" />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <Field
            label={t('Repozitář', 'Repository')}
            hint={t('Odkaz na místo, kde projekt žije.', 'A link to where the project lives.')}
          >
            <div className="flex items-center gap-2">
              <TextInput
                value={repoUrl}
                onChange={(event) => setRepoUrl(event.target.value)}
                onBlur={() => repoUrl !== mission.repoUrl && void save({ repoUrl })}
                placeholder="https://…"
                inputMode="url"
              />
              {mission.repoUrl && (
                <a
                  href={mission.repoUrl}
                  target="_blank"
                  rel="noreferrer noopener"
                  aria-label={t('Otevřít repozitář', 'Open the repository')}
                  className="shrink-0 text-ink-2"
                >
                  <ExternalLink size={15} />
                </a>
              )}
            </div>
          </Field>
          <Field
            label={t('Poznámky', 'Notes')}
            hint={t('Ukládají se při opuštění pole.', 'Saved when you leave the field.')}
          >
            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              onBlur={() => notes !== mission.notes && void save({ notes })}
              rows={4}
              className="w-full rounded-lg border border-border-strong bg-surface-2 px-3 py-2 text-sm placeholder:text-ink-3 focus:border-accent focus:outline-none"
              placeholder={t(
                'Co jsem zjistil, co nefungovalo, co dál…',
                'What I found out, what did not work, what next…',
              )}
            />
          </Field>
        </div>
      </div>
    </Card>
  );
}
