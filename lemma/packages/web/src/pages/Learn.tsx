import type { ExamDto, GraphDto, SkillDto, StartRunResponse, SyllabusTopicDto, Track } from '@lemma/core';
import { useQueryClient } from '@tanstack/react-query';
import { ChevronDown, ChevronRight, ExternalLink, Shuffle, Timer } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { ApiFailure, api } from '../app/api';
import { SkillRow } from '../app/components';
import { useT } from '../app/i18n';
import { AREA_NAMES, LEVEL_NAMES, TRACK_NAMES, TRACK_NOTES } from '../app/labels';
import { useGraph, useMe, useRefresh } from '../app/queries';
import { cn } from '../lib/cn';
import { formatDay, inDays, pct } from '../lib/format';
import { Badge, Button, Card, ErrorNote, LinkButton, Loading, Meter, Notice, PageHeader, Segmented } from '../ui';
import { LevelBar } from '../viz/charts';

type View = 'school' | 'foundation' | 'enrichment';

/** School mode: the year's syllabus in order, with what stands behind and beyond it. */
export function Learn() {
  const t = useT();
  const graph = useGraph();
  const me = useMe();
  const [view, setView] = useState<View>('school');

  if (graph.isPending || !me.data) return <Loading />;
  if (graph.isError) return <ErrorNote error={graph.error} retry={() => void graph.refetch()} />;
  const data = graph.data;

  return (
    <div>
      <PageHeader
        eyebrow={`${t('2. ročník', 'Year 2')} · ${data.syllabus.schoolYear} · ${data.syllabus.hoursPerWeek} ${t('h týdně', 'h a week')} · ${data.syllabus.hoursPerYear} ${t('h ročně', 'h a year')}`}
        title={t('Osnovy', 'Syllabus')}
        lead={t(
          'Sedmnáct kapitol v pořadí, v jakém je probíráte. Co je mimo osnovy, je vždy označené zvlášť.',
          'Seventeen chapters in the order your class takes them. Anything beyond the syllabus is always marked separately.',
        )}
        actions={
          <Segmented
            label={t('Co zobrazit', 'What to show')}
            value={view}
            onChange={setView}
            options={[
              { value: 'school', label: t('Školní osnovy', 'School syllabus') },
              { value: 'foundation', label: t('Základy', 'Foundations') },
              { value: 'enrichment', label: t('Rozšíření', 'Enrichment') },
            ]}
          />
        }
      />

      {view === 'school' && (
        <School
          data={data}
          tests={me.data.settings.tests}
          today={me.data.today}
          current={me.data.settings.currentTopic}
        />
      )}
      {view === 'foundation' && <TrackView data={data} tracks={['foundation']} />}
      {view === 'enrichment' && <TrackView data={data} tracks={['reasoning', 'vut']} />}
    </div>
  );
}

function School({
  data,
  tests,
  today,
  current,
}: {
  data: GraphDto;
  tests: { id: string; day: string; topics: number[]; title: string }[];
  today: string;
  current: number | null;
}) {
  const t = useT();
  const navigate = useNavigate();
  const client = useQueryClient();
  const refresh = useRefresh();
  const [open, setOpen] = useState<number | null>(current);
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const byId = useMemo(() => new Map(data.skills.map((skill) => [skill.id, skill])), [data.skills]);
  const upcoming = tests.filter((test) => test.day >= today).sort((a, b) => a.day.localeCompare(b.day));
  const daysTo = (day: string): number => Math.round((Date.parse(day) - Date.parse(today)) / 86_400_000);

  const run = async (key: string, action: () => Promise<void>): Promise<void> => {
    setBusy(key);
    setError(null);
    try {
      await action();
    } catch (failure) {
      setError(failure);
    } finally {
      setBusy(null);
    }
  };
  const practiseTopic = (n: number): Promise<void> =>
    run(`p${n}`, async () => {
      const started = await api.post<StartRunResponse>('/api/practice/start', { context: 'mixed', topic: n, count: 8 });
      navigate(`/practice/${started.run.id}`);
    });
  const exam = (blueprint: string, topics?: number[]): Promise<void> =>
    run(`e${blueprint}${topics?.join(',') ?? ''}`, async () => {
      const created = await api.post<ExamDto>('/api/exams', { blueprint, topics });
      navigate(`/exams/${created.id}`);
    });
  const setCurrent = async (n: number): Promise<void> => {
    await api.put('/api/settings', { currentTopic: n });
    await client.invalidateQueries({ queryKey: ['me'] });
    refresh();
  };

  return (
    <div className="space-y-5">
      {data.syllabus.source === 'transcription' && (
        <Notice
          tone="info"
          title={t(
            'Osnovy jsou opsané ze zadání, ne načtené z dokumentu školy',
            'The syllabus is transcribed from your brief, not read from the school’s document',
          )}
        >
          {t(
            'Názvy a pořadí kapitol odpovídají tomu, co bylo zadáno při zakládání projektu. Lemma do nich nic nepřidává; až bude k dispozici oficiální dokument, je třeba je s ním porovnat.',
            'Chapter names and order match what you supplied. Lemma adds nothing to them; once the official document is available they should be checked against it.',
          )}
        </Notice>
      )}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
        <Card className="overflow-hidden">
          <ol>
            {data.topics.map((topic, index) => (
              <TopicRow
                key={topic.n}
                topic={topic}
                skills={topic.skills
                  .map((id) => byId.get(id))
                  .filter((skill): skill is SkillDto => skill !== undefined)}
                expanded={open === topic.n}
                onToggle={() => setOpen((value) => (value === topic.n ? null : topic.n))}
                first={index === 0}
                busy={busy}
                onPractise={() => void practiseTopic(topic.n)}
                onTest={() => void exam('chapter-test', [topic.n])}
                onSetCurrent={() => void setCurrent(topic.n)}
              />
            ))}
          </ol>
        </Card>

        <div className="space-y-5">
          <Card className="p-4">
            <div className="mono-label">{t('Hodnocení ve škole', 'How school assesses')}</div>
            <p className="mt-1.5 text-sm text-ink-2">{t(data.syllabus.assessment)}</p>
          </Card>

          <Card className="p-4">
            <div className="mono-label">{t('Nejbližší testy', 'Upcoming tests')}</div>
            {upcoming.length === 0 ? (
              <p className="mt-1.5 text-sm text-ink-2">
                {t(
                  'Žádný není zadaný. Když ho přidáš, plán se na něj začne chystat týden předem.',
                  'None entered. Add one and the plan starts preparing for it a week ahead.',
                )}
              </p>
            ) : (
              <ul className="mt-2 space-y-2">
                {upcoming.map((test) => (
                  <li key={test.id} className="text-sm">
                    <div className="font-medium">{test.title || t('Test', 'Test')}</div>
                    <div className="text-[13px] text-ink-2">
                      {formatDay(test.day, t.locale)} · {inDays(daysTo(test.day), t.locale)} ·{' '}
                      {t('kapitoly', 'chapters')} {test.topics.join(', ')}
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <LinkButton to="/settings#tests" size="sm" className="mt-3">
              {t('Spravovat testy', 'Manage tests')}
            </LinkButton>
          </Card>

          <Card className="p-4">
            <div className="mono-label">{t('Výroční opakovací test', 'Annual review test')}</div>
            <p className="mt-1.5 text-sm text-ink-2">
              {t(
                'Základní typy úloh ze všeho, co už bylo probráno — tak, jak je bude chtít test na konci roku.',
                'The basic problem types from everything covered so far — the way the end-of-year test will ask for them.',
              )}
            </p>
            <Button
              size="sm"
              className="mt-3"
              onClick={() => void exam('annual-review')}
              busy={busy === 'eannual-review'}
            >
              <Timer size={13} />
              {t('Zkusit nanečisto', 'Try a mock')}
            </Button>
          </Card>

          {data.syllabus.books.length > 0 && (
            <Card className="p-4">
              <div className="mono-label">{t('Učebnice', 'Textbooks')}</div>
              <ul className="mt-1.5 list-disc space-y-1 pl-4 text-[13px] text-ink-2">
                {data.syllabus.books.map((book) => (
                  <li key={book}>{book}</li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      </div>
      {error !== null &&
        (error instanceof ApiFailure && error.code === 'no_problems' ? (
          <Notice tone="info">
            {t('Pro tuhle kapitolu zatím nejsou připravené úlohy.', 'There are no problems for this chapter yet.')}
          </Notice>
        ) : (
          <ErrorNote error={error} />
        ))}
    </div>
  );
}

function TopicRow({
  topic,
  skills,
  expanded,
  onToggle,
  first,
  busy,
  onPractise,
  onTest,
  onSetCurrent,
}: {
  topic: SyllabusTopicDto;
  skills: SkillDto[];
  expanded: boolean;
  onToggle: () => void;
  first: boolean;
  busy: string | null;
  onPractise: () => void;
  onTest: () => void;
  onSetCurrent: () => void;
}) {
  const t = useT();
  const practisable = skills.some((skill) => skill.hasProblems);
  const due = skills.filter((skill) => skill.due).length;
  return (
    <li className={cn(!first && 'border-t border-border')}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className={cn(
          'flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-surface-2',
          topic.current && 'bg-surface-2',
        )}
      >
        {expanded ? (
          <ChevronDown size={15} className="shrink-0 text-ink-3" aria-hidden />
        ) : (
          <ChevronRight size={15} className="shrink-0 text-ink-3" aria-hidden />
        )}
        <span className="w-6 shrink-0 font-mono text-sm text-ink-3">{topic.n}</span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-medium">{t(topic.title)}</span>
            {topic.current && <Badge tone="accent">{t('právě probíráte', 'current')}</Badge>}
            {!practisable && <Badge tone="outline">{t('úlohy se připravují', 'problems in preparation')}</Badge>}
            {due > 0 && <Badge>{t(`${due} k opakování`, `${due} to review`)}</Badge>}
          </span>
        </span>
        <span className="hidden w-28 shrink-0 sm:block">
          <Meter value={topic.progress} label={t('Postup kapitolou', 'Chapter progress')} />
        </span>
        <span className="w-10 shrink-0 text-right font-mono text-xs text-ink-2">{pct(topic.progress, t.locale)}</span>
      </button>
      {expanded && (
        <div className="border-t border-border bg-bg/40 px-4 py-4">
          {skills.length === 0 ? (
            <p className="text-sm text-ink-3">
              {t(
                'Pro tuto kapitolu zatím nejsou rozepsané dovednosti.',
                'No skills are written up for this chapter yet.',
              )}
            </p>
          ) : (
            <div className="-mx-2">
              {skills.map((skill) => (
                <SkillRow key={skill.id} skill={skill} />
              ))}
            </div>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant="primary"
              onClick={onPractise}
              disabled={!practisable}
              busy={busy === `p${topic.n}`}
            >
              <Shuffle size={13} />
              {t('Procvičit kapitolu namíchaně', 'Practise the chapter, mixed')}
            </Button>
            <Button size="sm" onClick={onTest} disabled={!practisable} busy={busy === `echapter-test${topic.n}`}>
              <Timer size={13} />
              {t('Test z kapitoly nanečisto', 'Mock chapter test')}
            </Button>
            {!topic.current && (
              <Button size="sm" variant="ghost" onClick={onSetCurrent}>
                {t('Tohle teď probíráme', 'This is what we are on now')}
              </Button>
            )}
          </div>
          {!practisable && (
            <p className="mt-2 text-[13px] text-ink-3">
              {t(
                'Pojmy a vysvětlení k téhle kapitole už jsou; generátory úloh ještě ne. Mezitím pomůžou odkazy níž.',
                'The concepts and explanations for this chapter exist; the problem generators do not yet. Meanwhile the links below help.',
              )}
            </p>
          )}
          {topic.resources.length > 0 && (
            <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[13px]">
              {topic.resources.map((resource) => (
                <li key={resource.url}>
                  <a
                    href={resource.url}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="inline-flex items-center gap-1"
                  >
                    {resource.title}
                    <ExternalLink size={11} aria-hidden />
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </li>
  );
}

function TrackView({ data, tracks }: { data: GraphDto; tracks: Track[] }) {
  const t = useT();
  return (
    <div className="space-y-6">
      {tracks.map((track) => {
        const skills = data.skills.filter((skill) => skill.track === track);
        const areas = [...new Set(skills.map((skill) => skill.area))];
        return (
          <section key={track}>
            <h2 className="text-lg font-semibold">{t(TRACK_NAMES[track])}</h2>
            <p className="mt-0.5 text-sm text-ink-2">{t(TRACK_NOTES[track])}</p>
            <div className="mt-3 grid gap-4 md:grid-cols-2">
              {areas.map((area) => (
                <Card key={area} className="p-4">
                  <div className="mono-label">{t(AREA_NAMES[area])}</div>
                  <div className="-mx-2 mt-1.5">
                    {skills
                      .filter((skill) => skill.area === area)
                      .map((skill) => (
                        <div key={skill.id}>
                          <SkillRow skill={skill} />
                          {!skill.hasProblems && (
                            <div className="px-2 pb-1 text-xs text-ink-3">
                              {t(
                                'zatím jen výklad, úlohy se připravují',
                                'explanation only for now; problems in preparation',
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                  </div>
                </Card>
              ))}
            </div>
          </section>
        );
      })}
      <p className="text-[13px] text-ink-3">
        {t('Úrovně', 'Levels')}:{' '}
        {([0, 1, 2, 3, 4, 5] as const).map((level) => (
          <span key={level} className="mr-3 inline-flex items-center gap-1.5 whitespace-nowrap">
            <LevelBar level={level} size="sm" /> {t(LEVEL_NAMES[level])}
          </span>
        ))}
      </p>
    </div>
  );
}
