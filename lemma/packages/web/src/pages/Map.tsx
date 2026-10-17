import { AREAS, PATH_STATES, type Area, type CurriculumDto, type PathState, type StartRunResponse } from '@lemma/core';
import { ArrowRight, Lock, Ruler, School, Target, UserCheck } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { api } from '../app/api';
import { PathBadge, useStarter } from '../app/components';
import { useT } from '../app/i18n';
import { AREA_NAMES, PATH_NAMES, PURPOSE_NAMES, ROLE_NAMES, ROLE_NOTES, whyText } from '../app/labels';
import { useCurriculum, useDiagnostics, useRefresh } from '../app/queries';
import { formatDate, pct, plural } from '../lib/format';
import {
  Badge,
  Button,
  Card,
  ErrorNote,
  LinkButton,
  Loading,
  Notice,
  PageHeader,
  SectionLabel,
  Segmented,
} from '../ui';
import { LevelBar } from '../viz/charts';

/**
 * The whole curriculum of the learner's goal on one page: where each skill stands, what
 * it waits for, what it is worth in the examination — and, on top, what to do next.
 */

type Skill = CurriculumDto['skills'][number];
type Filter = 'all' | 'now' | 'waiting' | 'done';

const FILTERS: Record<Filter, (skill: Skill) => boolean> = {
  all: () => true,
  now: (skill) =>
    skill.blockedBy === null && skill.path !== 'mastered' && skill.path !== 'not-started' && !skill.paperOnly,
  waiting: (skill) => skill.blockedBy !== null,
  done: (skill) => skill.path === 'mastered' || skill.path === 'consolidating',
};

export function CurriculumMap() {
  const t = useT();
  const navigate = useNavigate();
  const refresh = useRefresh();
  const query = useCurriculum();
  const diagnostics = useDiagnostics();
  const { start, busy, error } = useStarter();
  const [filter, setFilter] = useState<Filter>('all');
  const data = query.data;

  const titles = useMemo(() => new Map((data?.skills ?? []).map((skill) => [skill.id, skill.title])), [data]);
  if (query.isPending) return <Loading />;
  if (query.isError) return <ErrorNote error={query.error} retry={() => void query.refetch()} />;
  const { goal, skills, next, diagnostic } = query.data;
  const titleOf = (id: string): string => (titles.get(id) ? t(titles.get(id)!) : id);
  const entrance = goal.kind === 'entrance';

  const counts = Object.fromEntries(PATH_STATES.map((state) => [state, 0])) as Record<PathState, number>;
  for (const skill of skills) if (!skill.paperOnly) counts[skill.path]++;
  const areas = AREAS.map((area) => ({ area, skills: skills.filter((skill) => skill.area === area) })).filter(
    (group) => group.skills.length > 0,
  );
  const skipPlacement = async (): Promise<void> => {
    await api.post('/api/diagnostic/skip');
    refresh();
  };
  const placement = async (): Promise<void> => {
    const started = await api.post<StartRunResponse>('/api/diagnostic/start');
    navigate(`/practice/${started.run.id}`);
  };

  return (
    <div>
      <PageHeader
        eyebrow={t(goal.short)}
        title={t('Mapa učiva', 'Curriculum map')}
        lead={
          entrance
            ? [
                `${t(goal.title)}.`,
                `${t('Zkouška žádá', 'The examination asks for')}: ${plural(goal.counts.tested, t.locale, ['dovednost', 'dovednosti', 'dovedností'], ['skill', 'skills'])}.`,
                goal.counts.prerequisite > 0
                  ? `${t('Předpoklady', 'Prerequisites')}: ${goal.counts.prerequisite}.`
                  : '',
                goal.counts.enrichment > 0
                  ? `${t('Nad rámec zkoušky', 'Beyond the examination')}: ${goal.counts.enrichment}.`
                  : '',
              ]
                .filter(Boolean)
                .join(' ')
            : t(goal.description)
        }
        actions={
          entrance && (
            <LinkButton to="/readiness" variant="secondary">
              {t('Připravenost', 'Readiness')}
            </LinkButton>
          )
        }
      />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Card className="p-5">
          <SectionLabel>{t('Co dál', 'What next')}</SectionLabel>
          {next.length === 0 ? (
            <p className="mt-2 text-sm text-ink-2">
              {t(
                'Nic nečeká: co jde procvičovat, je zvládnuté, a žádné opakování není na řadě.',
                'Nothing is waiting: what can be practised is mastered, and no review is due.',
              )}
            </p>
          ) : (
            <>
              <ol className="mt-2 divide-y divide-border">
                {next.map((step, index) => (
                  <li key={step.skill.id} className="flex items-start gap-3 py-2.5">
                    <span className="mt-0.5 w-4 shrink-0 font-mono text-xs text-ink-3">{index + 1}</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link to={`/concept/${step.skill.id}`} className="text-sm font-medium text-ink">
                          {t(step.skill.title)}
                        </Link>
                        <Badge>{t(PURPOSE_NAMES[step.purpose])}</Badge>
                      </div>
                      <p className="mt-0.5 text-[13px] text-ink-2">{whyText(step, t)}</p>
                    </div>
                  </li>
                ))}
              </ol>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <Button
                  variant="primary"
                  busy={busy === 'adaptive'}
                  onClick={() => void start('adaptive', '/api/practice/start', { context: 'adaptive', count: 10 })}
                >
                  {t('Pokračovat — 10 úloh', 'Continue — 10 problems')}
                  <ArrowRight size={14} />
                </Button>
                <span className="text-[13px] text-ink-3">
                  {t(
                    'Pořadí se po každé úloze přepočítá podle toho, jak dopadla.',
                    'The order is worked out again after every problem, by how it went.',
                  )}
                </span>
              </div>
            </>
          )}
          {error !== null && (
            <div className="mt-3">
              <ErrorNote error={error} />
            </div>
          )}
        </Card>

        <div className="min-w-0 space-y-5">
          {entrance && (
            <Card className="p-5">
              <SectionLabel>{t('Rozřazovací test', 'Placement test')}</SectionLabel>
              <p className="mt-2 text-sm text-ink-2">
                {diagnostic.running
                  ? t('Jeden test je rozdělaný.', 'A test is under way.')
                  : diagnostic.done
                    ? t(
                        `Naposledy ${formatDate(diagnostic.lastAt ?? 0, t.locale)}, celkem ${diagnostic.count}×. Zopakováním po čase uvidíš posun.`,
                        `Last taken on ${formatDate(diagnostic.lastAt ?? 0, t.locale)}, ${diagnostic.count} time(s) in all. Repeating it after a while shows the change.`,
                      )
                    : t(
                        'Asi patnáct úloh napříč látkou. Podle nich se nastaví, odkud začít, místo aby všechno začínalo od základů.',
                        'About fifteen problems across the curriculum. They set where to start, instead of everything beginning from the basics.',
                      )}
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Button size="sm" variant={diagnostic.done ? 'secondary' : 'primary'} onClick={() => void placement()}>
                  {diagnostic.running
                    ? t('Pokračovat v testu', 'Go on with the test')
                    : diagnostic.done
                      ? t('Udělat znovu', 'Take it again')
                      : t('Začít test', 'Start the test')}
                </Button>
                {!diagnostic.done && !diagnostic.running && !diagnostic.skipped && (
                  <Button size="sm" variant="ghost" onClick={() => void skipPlacement()}>
                    {t('Teď ne', 'Not now')}
                  </Button>
                )}
              </div>
              {(diagnostics.data ?? []).length > 0 && (
                <ul className="mt-3 space-y-1 border-t border-border pt-3 text-[13px]">
                  {(diagnostics.data ?? []).map((entry) => (
                    <li key={entry.id} className="flex items-center justify-between gap-3">
                      <Link to={`/diagnostic/${entry.id}`}>
                        {formatDate(entry.finishedAt ?? entry.startedAt, t.locale)}
                      </Link>
                      <span className="font-mono text-xs text-ink-3">
                        {entry.counts.correct}/{entry.counts.asked}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          )}

          <Card className="p-5">
            <SectionLabel>{t('Kde co je', 'Where things are')}</SectionLabel>
            <ul className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1.5">
              {PATH_STATES.map((state) => (
                <li key={state} className="flex items-center justify-between gap-2">
                  <PathBadge state={state} />
                  <span className="font-mono text-xs text-ink-2">{counts[state]}</span>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-ink-3">
              {t(
                'Stav se nenastavuje ručně: vychází z toho, co a jak bylo vyřešeno. Najetím na stav u dovednosti zjistíš proč.',
                'A state is never set by hand: it follows from what was solved and how. Hover over a state to see why.',
              )}
            </p>
          </Card>
        </div>
      </div>

      <div className="mt-6 mb-3 flex flex-wrap items-center justify-between gap-3">
        <SectionLabel>{t('Všechny dovednosti', 'Every skill')}</SectionLabel>
        <Segmented
          label={t('Co zobrazit', 'What to show')}
          size="sm"
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'all', label: t('vše', 'all') },
            { value: 'now', label: t('rozpracované', 'under way') },
            { value: 'waiting', label: t('čekají na základ', 'waiting') },
            { value: 'done', label: t('ovládnuté', 'proficient') },
          ]}
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        {areas.map(({ area, skills: list }) => (
          <AreaCard
            key={area}
            area={area}
            skills={list.filter(FILTERS[filter])}
            total={list.length}
            titleOf={titleOf}
          />
        ))}
      </div>

      {entrance && goal.spec && (
        <Card className="mt-5 p-5">
          <SectionLabel>
            {t('Z čeho mapa vychází — a co v ní chybí', 'What the map rests on — and what is missing from it')}
          </SectionLabel>
          <div className="mt-2 space-y-2 text-sm text-ink-2">
            <p>
              {t(
                `Dovednosti a jejich role vycházejí ze dvou zdrojů: z oficiální specifikace požadavků a z rozboru minulých testů. Váhy (podíl bodů) jsou spočítané jen z testů, které byly přečteny úlohu po úloze: ${goal.papersRead}.`,
                `The skills and their roles come from two sources: the official specification of requirements, and an analysis of past tests. The weights (share of points) are computed only from the tests that were read task by task: ${goal.papersRead}.`,
              )}{' '}
              {goal.provisional &&
                t('To je málo, takže váhy jsou předběžné.', 'That is few, so the weights are provisional.')}
            </p>
            <p>
              {t(
                `Specifikace má pro tuto zkoušku ${goal.spec.items} položek. Úlohy v aplikaci pokrývají ${goal.spec.withProblems} z nich; úplné pokrytí tedy aplikace netvrdí.`,
                `The specification has ${goal.spec.items} items for this examination. The app has problems for ${goal.spec.withProblems} of them; it does not claim complete coverage.`,
              )}
            </p>
          </div>
          {goal.spec.missing.length > 0 && (
            <details className="mt-3 text-[13px] text-ink-2">
              <summary className="text-ink-2 hover:text-ink">
                {plural(goal.spec.missing.length, t.locale, ['položka', 'položky', 'položek'], ['item', 'items'])}{' '}
                {t('specifikace bez úloh v aplikaci', 'of the specification without problems in the app')}
              </summary>
              <ul className="mt-2 space-y-1">
                {goal.spec.missing.map((item) => (
                  <li key={item.id} className="flex gap-2">
                    <span className="w-14 shrink-0 font-mono text-xs text-ink-3">{item.id}</span>
                    <span>{t(item.text)}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-ink-3">
                {t(
                  'Jde hlavně o rýsování a o vzájemnou polohu útvarů — to se na obrazovce zadat ani zkontrolovat poctivě nedá. Procvič je na papíře.',
                  'These are mainly constructions and the relative position of figures — which cannot honestly be set or checked on a screen. Practise them on paper.',
                )}
              </p>
            </details>
          )}
          {goal.facts && (
            <p className="mt-3 text-xs text-ink-3">
              {t('Zdroje', 'Sources')}:{' '}
              {goal.facts.sources.map((source, index) => (
                <span key={source.url}>
                  {index > 0 && ' · '}
                  <a href={source.url} target="_blank" rel="noreferrer noopener">
                    {source.title}
                  </a>
                </span>
              ))}
            </p>
          )}
        </Card>
      )}
      {!entrance && (
        <Notice tone="info" className="mt-5">
          {t(
            'Pro školní osnovy je podrobnější pohled na stránkách Osnovy a Strom dovedností.',
            'For the school syllabus, the Syllabus and Skill tree pages give a more detailed view.',
          )}
        </Notice>
      )}
    </div>
  );
}

function AreaCard({
  area,
  skills,
  total,
  titleOf,
}: {
  area: Area;
  skills: Skill[];
  total: number;
  titleOf: (id: string) => string;
}) {
  const t = useT();
  return (
    <Card className="p-5">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="font-semibold">{t(AREA_NAMES[area])}</h3>
        <span className="font-mono text-xs text-ink-3">
          {skills.length}/{total}
        </span>
      </div>
      {skills.length === 0 ? (
        <p className="mt-2 text-sm text-ink-3">{t('Nic pro tento výběr.', 'Nothing for this selection.')}</p>
      ) : (
        <ul className="mt-2 divide-y divide-border">
          {skills.map((skill) => (
            <li key={skill.id} className="py-2">
              <div className="flex items-center gap-3">
                <Link to={`/concept/${skill.id}`} className="min-w-0 flex-1 truncate text-sm text-ink">
                  {t(skill.title)}
                </Link>
                {skill.paperOnly ? (
                  <Badge
                    tone="outline"
                    title={t(
                      'Rýsuje se na papír; v aplikaci procvičit nejde.',
                      'Drawn on paper; it cannot be practised in the app.',
                    )}
                  >
                    <Ruler size={11} aria-hidden /> {t('na papíře', 'on paper')}
                  </Badge>
                ) : (
                  <>
                    <PathBadge state={skill.path} reason={skill.pathReason} className="hidden sm:inline-flex" />
                    <LevelBar level={skill.level} size="sm" />
                  </>
                )}
              </div>
              <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-ink-3">
                <span className="sm:hidden">{t(PATH_NAMES[skill.path])}</span>
                {skill.role === 'tested' && skill.weight > 0 && (
                  <span title={t('Podíl bodů v přečtených testech', 'Share of points in the tests that were read')}>
                    <Target size={11} className="mr-1 inline" aria-hidden />
                    {pct(skill.weight, t.locale, 1)} {t('zkoušky', 'of the exam')}
                  </span>
                )}
                {skill.role && skill.role !== 'tested' && (
                  <span title={t(ROLE_NOTES[skill.role])}>{t(ROLE_NAMES[skill.role])}</span>
                )}
                {skill.blockedBy && (
                  <span className="text-ink-2">
                    <Lock size={11} className="mr-1 inline" aria-hidden />
                    {t('nejdřív', 'first')}: {titleOf(skill.blockedBy)}
                  </span>
                )}
                {skill.inSchool && (
                  <span>
                    <School size={11} className="mr-1 inline" aria-hidden />
                    {t('teď ve škole', 'in class now')}
                  </span>
                )}
                {(skill.assigned || skill.focus) && (
                  <span>
                    <UserCheck size={11} className="mr-1 inline" aria-hidden />
                    {skill.assigned ? t('zadáno', 'assigned') : t('poznámka z doučování', 'noted in tutoring')}
                  </span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
