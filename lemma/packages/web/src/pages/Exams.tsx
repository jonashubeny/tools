import type { ExamBlueprint, ExamDto } from '@lemma/core';
import { Timer } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { ApiFailure, api } from '../app/api';
import { useT } from '../app/i18n';
import { useBlueprints, useExams, useGraph, useMe } from '../app/queries';
import { cn } from '../lib/cn';
import { formatDateTime, pct } from '../lib/format';
import { Badge, Button, Card, ErrorNote, Loading, Notice, PageHeader, SectionLabel } from '../ui';

/** Mock exams: a clock, no hints, no feedback until the end — then a real post-mortem. */
export function Exams() {
  const t = useT();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const blueprints = useBlueprints();
  const exams = useExams();
  const graph = useGraph();
  const me = useMe();
  const [chosen, setChosen] = useState<string | null>(params.get('blueprint'));
  const [topics, setTopics] = useState<number[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  // Default to the chapter the class is on.
  useEffect(() => {
    if (topics.length === 0 && me.data?.settings.currentTopic) setTopics([me.data.settings.currentTopic]);
  }, [me.data, topics.length]);

  if (blueprints.isPending || exams.isPending || graph.isPending) return <Loading />;
  if (blueprints.isError) return <ErrorNote error={blueprints.error} />;

  // What is offered depends on the goal: an examination's own practice test comes first where there is one.
  const blueprint =
    blueprints.data.find((item) => item.id === chosen) ??
    blueprints.data.find((item) => item.kind === 'entrance') ??
    blueprints.data.find((item) => item.id === 'chapter-test') ??
    blueprints.data[0];
  const structured = blueprint?.kind === 'entrance';
  const entranceGoal = blueprints.data.some((item) => item.kind === 'entrance');
  // Chapters are a matter of the school syllabus; other goals have none to choose from.
  const byChapter =
    Boolean(blueprint) && !structured && blueprint!.kind !== 'annual' && (graph.data?.topics.length ?? 0) > 0;
  const practisable = new Set(
    (graph.data?.skills ?? [])
      .filter((skill) => skill.hasProblems && skill.topic !== null)
      .map((skill) => skill.topic!),
  );
  const running = (exams.data ?? []).find((exam) => exam.finishedAt === null);

  const start = async (): Promise<void> => {
    if (!blueprint) return;
    setBusy(true);
    setError(null);
    try {
      const created = await api.post<ExamDto>('/api/exams', {
        blueprint: blueprint.id,
        topics: byChapter ? topics : undefined,
      });
      navigate(`/exams/${created.id}`);
    } catch (failure) {
      setError(failure);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <PageHeader
        title={entranceGoal ? t('Testy nanečisto', 'Practice tests') : t('Zkoušky nanečisto', 'Mock exams')}
        lead={
          entranceGoal
            ? t(
                'Jako u zkoušky: čas běží, nápovědy nejsou, výsledek až na konci. Test má stavbu a bodování skutečného testu; potom přijde rozbor — kolik bodů stála nepozornost a kolik skutečné mezery.',
                'As in the examination: the clock runs, there are no hints, the result comes at the end. The test has the structure and scoring of the real one; then comes the analysis — how many points slips cost, and how many real gaps did.',
              )
            : t(
                'Jako ve škole: čas běží, nápovědy nejsou, výsledek až na konci. Pak rozbor — kolik bodů stála nepozornost a kolik skutečné mezery.',
                'As at school: the clock runs, there are no hints, the result comes at the end. Then the analysis — how many points slips cost, and how many real gaps did.',
              )
        }
      />

      {running && (
        <Notice
          tone="warning"
          className="mb-5"
          title={t('Jedna zkouška právě běží', 'An exam is in progress')}
          action={
            <Button size="sm" onClick={() => navigate(`/exams/${running.id}`)}>
              {t('Vrátit se k ní', 'Return to it')}
            </Button>
          }
        >
          {t(running.title)}
        </Notice>
      )}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        <Card className="p-5">
          <SectionLabel>{t('Nová zkouška', 'New exam')}</SectionLabel>
          <div className="mt-3 grid gap-2.5" role="radiogroup" aria-label={t('Typ zkoušky', 'Kind of exam')}>
            {blueprints.data.map((item) => (
              <BlueprintOption
                key={item.id}
                blueprint={item}
                selected={item.id === blueprint?.id}
                onSelect={() => setChosen(item.id)}
              />
            ))}
          </div>

          {byChapter && (
            <div className="mt-5">
              <div className="text-sm font-medium">{t('Z kterých kapitol', 'From which chapters')}</div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {(graph.data?.topics ?? []).map((topic) => {
                  const available = practisable.has(topic.n);
                  const on = topics.includes(topic.n);
                  return (
                    <button
                      key={topic.n}
                      type="button"
                      disabled={!available}
                      aria-pressed={on}
                      onClick={() =>
                        setTopics((current) =>
                          on ? current.filter((n) => n !== topic.n) : [...current, topic.n].sort((a, b) => a - b),
                        )
                      }
                      title={
                        available
                          ? t(topic.title)
                          : `${t(topic.title)} — ${t('úlohy se připravují', 'problems in preparation')}`
                      }
                      className={cn(
                        'h-8 rounded-md border px-2.5 text-[13px] disabled:opacity-40',
                        on
                          ? 'border-accent bg-accent-wash text-ink'
                          : 'border-border-strong bg-surface-2 text-ink-2 hover:bg-surface-3',
                      )}
                    >
                      <span className="font-mono">{topic.n}</span> {t(topic.title)}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          {blueprint?.kind === 'annual' && (
            <p className="mt-4 text-[13px] text-ink-2">
              {t(
                'Bere základní typy úloh ze všech kapitol až po tu, kterou právě probíráte.',
                'Draws the basic problem types from every chapter up to the one your class is on.',
              )}
            </p>
          )}

          {error !== null &&
            (error instanceof ApiFailure && error.code === 'no_problems' ? (
              <Notice tone="info" className="mt-4">
                {t(
                  'Pro vybrané kapitoly zatím nejsou úlohy. Vyber jiné.',
                  'There are no problems for the chosen chapters yet. Pick others.',
                )}
              </Notice>
            ) : (
              <div className="mt-4">
                <ErrorNote error={error} />
              </div>
            ))}

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <Button
              variant="primary"
              size="lg"
              onClick={() => void start()}
              busy={busy}
              disabled={!blueprint || Boolean(running) || (byChapter && topics.length === 0)}
            >
              <Timer size={15} />
              {t('Začít — čas se spustí hned', 'Begin — the clock starts at once')}
            </Button>
            {blueprint && (
              <span className="text-[13px] text-ink-3">
                {blueprint.items} {t('úloh', 'problems')} · {blueprint.minutes} min ·{' '}
                {t('tutor je po dobu zkoušky vypnutý', 'the tutor is off for the duration')}
              </span>
            )}
          </div>
        </Card>

        <Card className="p-5">
          <SectionLabel>{t('Dřívější zkoušky', 'Earlier exams')}</SectionLabel>
          {(exams.data ?? []).length === 0 ? (
            <p className="mt-2 text-sm text-ink-2">{t('Zatím žádná.', 'None yet.')}</p>
          ) : (
            <ul className="mt-2 divide-y divide-border">
              {(exams.data ?? []).map((exam) => (
                <li key={exam.id}>
                  <Link
                    to={`/exams/${exam.id}`}
                    className="flex items-center justify-between gap-3 py-2.5 text-ink hover:no-underline"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">{t(exam.title)}</span>
                      <span className="mono-label">{formatDateTime(exam.startedAt, t.locale)}</span>
                    </span>
                    {exam.finishedAt === null ? (
                      <Badge tone="accent">{t('běží', 'running')}</Badge>
                    ) : exam.points !== null && exam.maxPoints !== null ? (
                      <span className="shrink-0 text-right">
                        <span className="block text-sm font-semibold tabular-nums">
                          {exam.points}/{exam.maxPoints}
                        </span>
                        <span className="mono-label">{t('bodů', 'points')}</span>
                      </span>
                    ) : (
                      <span className="shrink-0 text-right">
                        <span className="block text-sm font-semibold">{pct((exam.percent ?? 0) / 100, t.locale)}</span>
                        {exam.grade !== null && (
                          <span className="mono-label">
                            {t('známka', 'grade')} {exam.grade}
                          </span>
                        )}
                      </span>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}

function BlueprintOption({
  blueprint,
  selected,
  onSelect,
}: {
  blueprint: ExamBlueprint;
  selected: boolean;
  onSelect: () => void;
}) {
  const t = useT();
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={cn(
        'flex items-start gap-3 rounded-lg border px-3.5 py-3 text-left',
        selected ? 'border-accent bg-accent-wash' : 'border-border-strong bg-surface-2 hover:bg-surface-3',
      )}
    >
      <span
        className={cn(
          'mt-1 grid h-4 w-4 shrink-0 place-items-center rounded-full border',
          selected ? 'border-accent' : 'border-border-strong',
        )}
      >
        {selected && <span className="h-2 w-2 rounded-full bg-accent" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2">
          <span className="font-medium">{t(blueprint.title)}</span>
          <Badge>
            {blueprint.items} {t('úloh', 'problems')}
          </Badge>
          <Badge>{blueprint.minutes} min</Badge>
        </span>
        <span className="mt-0.5 block text-[13px] text-ink-2">{t(blueprint.description)}</span>
      </span>
    </button>
  );
}
