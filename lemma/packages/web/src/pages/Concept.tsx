import { type ConceptDetailDto, type StartRunResponse, ERROR_INFO } from '@lemma/core';
import { ArrowLeft, BookOpen, ExternalLink, FlaskConical, MessageSquare, Play, Zap } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { api } from '../app/api';
import { Gates } from '../app/components';
import { useT } from '../app/i18n';
import {
  AREA_NAMES,
  KIND_NAMES,
  LAB_NAMES,
  LENS_NAMES,
  LEVEL_MEANING,
  LEVEL_NAMES,
  TRACK_NAMES,
  TRACK_NOTES,
} from '../app/labels';
import { useConcept } from '../app/queries';
import { cn } from '../lib/cn';
import { formatDateTime, inDays, pct } from '../lib/format';
import { RichText } from '../lib/Math';
import { useTutor } from '../tutor/context';
import { Badge, Button, Card, ErrorNote, LinkButton, Loading, Meter, Notice, SectionLabel, StatTile } from '../ui';
import { BarList, LevelBar } from '../viz/charts';

const LENSES = ['intuition', 'formal', 'visual', 'algebraic', 'it'] as const;
type Lens = (typeof LENSES)[number];

/** Everything about one concept: why it works, where you stand, what to do next. */
export function Concept() {
  const { id } = useParams();
  const concept = useConcept(id);
  if (concept.isPending) return <Loading />;
  if (concept.isError) return <ErrorNote error={concept.error} retry={() => void concept.refetch()} />;
  // Keyed by id so that moving between concepts starts from a clean state.
  return <ConceptBody key={concept.data.id} data={concept.data} />;
}

function ConceptBody({ data }: { data: ConceptDetailDto }) {
  const t = useT();
  const navigate = useNavigate();
  const tutor = useTutor();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<unknown>(null);
  const available = LENSES.filter((lens) => data.why[lens] !== undefined);
  const [lens, setLens] = useState<Lens>(available[0] ?? 'intuition');

  const start = async (key: string, body: Record<string, unknown>): Promise<void> => {
    setBusy(key);
    setError(null);
    try {
      const started = await api.post<StartRunResponse>('/api/practice/start', body);
      navigate(`/practice/${started.run.id}`);
    } catch (failure) {
      setError(failure);
    } finally {
      setBusy(null);
    }
  };
  const hasHard = data.problemFamilies.some((family) => family.levels.some((level) => level >= 4));
  const lessonLabel = !data.lesson
    ? null
    : data.lesson.done
      ? t('Projít lekci znovu', 'Go through the lesson again')
      : data.lesson.step > 0
        ? t('Pokračovat v lekci', 'Continue the lesson')
        : t('Začít lekcí', 'Start with the lesson');

  return (
    <div>
      <Link to="/learn" className="mb-3 inline-flex items-center gap-1 text-sm text-ink-2">
        <ArrowLeft size={14} aria-hidden />
        {t('Osnovy', 'Syllabus')}
      </Link>

      <header className="mb-6">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={data.track === 'school' ? 'accent' : 'outline'} title={t(TRACK_NOTES[data.track])}>
            {t(TRACK_NAMES[data.track])}
          </Badge>
          {data.topic !== null && data.topicTitle && (
            <Badge>
              {t('kapitola', 'chapter')} {data.topic}: {t(data.topicTitle)}
            </Badge>
          )}
          <Badge>{t(AREA_NAMES[data.area])}</Badge>
          {data.annualReview && (
            <Badge
              title={t(
                'Základní typy úloh z této dovednosti patří do výročního testu.',
                'The basic problem types of this skill belong in the annual review test.',
              )}
            >
              {t('výroční test', 'annual test')}
            </Badge>
          )}
          {data.fit.map((code) => (
            <Link key={code} to="/fit" className="hover:no-underline">
              <Badge
                tone="outline"
                title={t(
                  'Předmět prvního ročníku FIT, který na tom staví',
                  'A first-year FIT course that builds on this',
                )}
              >
                FIT {code}
              </Badge>
            </Link>
          ))}
        </div>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">{t(data.title)}</h1>
        <p className="mt-1.5 max-w-3xl text-ink-2">
          <RichText text={t(data.summary)} inlineOnly />
        </p>
        {data.track !== 'school' && <p className="mt-1 text-[13px] text-ink-3">{t(TRACK_NOTES[data.track])}</p>}

        <div className="mt-4 flex flex-wrap gap-2">
          {lessonLabel && (
            <LinkButton to={`/lesson/${data.id}`} variant={data.lesson?.done ? 'secondary' : 'primary'}>
              <BookOpen size={14} />
              {lessonLabel}
              {data.lesson && !data.lesson.done && (
                <span className="font-normal opacity-80">· {data.lesson.minutes} min</span>
              )}
            </LinkButton>
          )}
          <Button
            variant={data.lesson && !data.lesson.done ? 'secondary' : 'primary'}
            disabled={!data.hasProblems}
            busy={busy === 'practice'}
            onClick={() => void start('practice', { context: 'blocked', concept: data.id, count: 6 })}
          >
            <Play size={14} />
            {t('Procvičit', 'Practise')}
          </Button>
          {hasHard && (
            <Button
              busy={busy === 'challenge'}
              onClick={() => void start('challenge', { context: 'challenge', concept: data.id })}
            >
              <Zap size={14} />
              {t('Těžší úloha', 'A harder problem')}
            </Button>
          )}
          {data.lab && (
            <LinkButton to={`/lab/${data.lab.tool}`}>
              <FlaskConical size={14} />
              {t(LAB_NAMES[data.lab.tool])}
            </LinkButton>
          )}
          {tutor.enabled && (
            <Button onClick={() => tutor.open({ concept: data.id })}>
              <MessageSquare size={14} />
              {t('Zeptat se tutora', 'Ask the tutor')}
            </Button>
          )}
        </div>
        {!data.hasProblems && (
          <Notice tone="info" className="mt-4">
            {t(
              'K tomuhle pojmu zatím nejsou úlohy. Výklad a souvislosti níž už platí; procvičování přibude.',
              'There are no problems for this concept yet. The explanation and connections below already hold; practice will follow.',
            )}
          </Notice>
        )}
        {data.weakPrereq && (
          <Notice
            tone="warning"
            className="mt-4"
            title={t('Předpoklad ještě není pevný', 'A prerequisite is not solid yet')}
          >
            {t('Tahle látka stojí na pojmu ', 'This builds on ')}
            <Link to={`/concept/${data.weakPrereq}`}>
              {t(
                data.prereqDetails.find((p) => p.id === data.weakPrereq)?.title ?? {
                  cs: data.weakPrereq,
                  en: data.weakPrereq,
                },
              )}
            </Link>
            {t(
              ', který zatím není na úrovni „známá“. Vyplatí se začít tam.',
              ', which is not yet at “familiar”. It pays to start there.',
            )}
          </Notice>
        )}
        {error !== null && (
          <div className="mt-4">
            <ErrorNote error={error} />
          </div>
        )}
      </header>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <div className="min-w-0 space-y-5">
          {available.length > 0 && (
            <Card className="p-5">
              <SectionLabel>{t('Proč to funguje', 'Why it works')}</SectionLabel>
              <div
                className="mt-3 flex flex-wrap gap-1"
                role="tablist"
                aria-label={t('Pohledy na pojem', 'Ways of looking at the concept')}
              >
                {available.map((key) => (
                  <button
                    key={key}
                    type="button"
                    role="tab"
                    aria-selected={lens === key}
                    onClick={() => setLens(key)}
                    className={cn(
                      'h-8 rounded-md px-3 text-sm transition-colors',
                      lens === key
                        ? 'bg-surface-3 font-medium text-ink'
                        : 'text-ink-2 hover:bg-surface-2 hover:text-ink',
                    )}
                  >
                    {t(LENS_NAMES[key])}
                  </button>
                ))}
              </div>
              <div role="tabpanel" className="mt-3 text-[0.975rem] leading-relaxed">
                <RichText text={t(data.why[lens] ?? { cs: '', en: '' })} />
              </div>
              {lens === 'it' && (
                <p className="mt-3 text-xs text-ink-3">
                  {t(
                    'Souvislosti s IT se uvádějí jen tam, kde opravdu platí.',
                    'Connections to IT are given only where they genuinely hold.',
                  )}
                </p>
              )}
            </Card>
          )}

          <Card className="p-5">
            <SectionLabel>{t('Kde stojíš', 'Where you stand')}</SectionLabel>
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
              <LevelBar level={data.level} />
              <span className="font-medium">
                {t(LEVEL_NAMES[data.level])} <span className="font-normal text-ink-3">({data.level}/5)</span>
              </span>
            </div>
            <p className="mt-1.5 text-sm text-ink-2">{t(LEVEL_MEANING[data.level])}</p>
            <Meter value={data.progress} className="mt-3" label={t('Celkový postup', 'Overall progress')} />

            {data.next && (
              <div className="mt-4">
                <div className="text-[13px] font-medium text-ink-2">
                  {t('Co je potřeba k úrovni', 'What it takes to reach')} „{t(LEVEL_NAMES[data.next.level])}“
                </div>
                <Gates level={data.next.level} gates={data.next.gates} className="mt-2" />
              </div>
            )}

            {data.stats.attempts > 0 && (
              <div className="mt-5 grid grid-cols-2 gap-x-6 gap-y-4 border-t border-border pt-4 sm:grid-cols-4">
                <StatTile
                  label={t('Úlohy', 'Problems')}
                  value={data.stats.attempts}
                  sub={`${data.stats.solved} ${t('vyřešeno', 'solved')}`}
                />
                <StatTile
                  label={t('Samostatně', 'Unaided')}
                  value={pct(data.stats.unaided / data.stats.attempts, t.locale)}
                  sub={`${data.stats.unaided}×`}
                />
                <StatTile
                  label={t('Ve směsi', 'In a mix')}
                  value={data.stats.mixedUnaided}
                  sub={t('samostatně, téma skryté', 'unaided, topic hidden')}
                />
                <StatTile
                  label={t('Tempo', 'Pace')}
                  value={
                    data.stats.speed === null
                      ? '—'
                      : `${data.stats.speed.toFixed(1).replace('.', t.locale === 'cs' ? ',' : '.')}×`
                  }
                  sub={t('oproti obvyklému času', 'of the typical time')}
                />
              </div>
            )}

            {data.attempts > 0 && (
              <p className="mt-4 text-[13px] text-ink-3">
                {data.due
                  ? t(
                      'Je čas si to připomenout — paměť na to začíná slábnout.',
                      'It is time to recall this — memory of it is starting to fade.',
                    )
                  : data.dueInDays !== null
                    ? `${t('Další připomenutí', 'Next review')} ${inDays(data.dueInDays, t.locale)}.`
                    : ''}
                {data.retention !== null &&
                  ` ${t('Odhad, že si to teď vybavíš', 'Estimated chance of recalling it now')}: ${pct(data.retention, t.locale)}.`}
                {data.lastPracticedAt !== null &&
                  ` ${t('Naposledy', 'Last practised')} ${formatDateTime(data.lastPracticedAt, t.locale)}.`}
              </p>
            )}
          </Card>

          {data.errors.length > 0 && (
            <Card className="p-5">
              <SectionLabel
                action={
                  <Link to="/errors" className="text-xs">
                    {t('laboratoř chyb', 'Error Lab')}
                  </Link>
                }
              >
                {t('Chyby u tohoto pojmu', 'Errors on this concept')}
              </SectionLabel>
              <div className="mt-3">
                <BarList
                  rows={data.errors.map((entry) => ({
                    id: entry.type,
                    label: t(ERROR_INFO[entry.type].title),
                    value: entry.count,
                    display: `${entry.count}×`,
                  }))}
                />
              </div>
              <Calibration data={data} />
            </Card>
          )}

          {data.problemFamilies.length > 0 && (
            <Card className="p-5">
              <SectionLabel>{t('Jaké úlohy tu jsou', 'What problems there are')}</SectionLabel>
              <ul className="mt-2 divide-y divide-border">
                {data.problemFamilies.map((family) => (
                  <li
                    key={family.id}
                    className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 py-2 text-sm"
                  >
                    <span className="min-w-0">
                      <RichText text={t(family.title)} inlineOnly />
                    </span>
                    <span className="flex shrink-0 items-center gap-1.5">
                      <Badge>{t(KIND_NAMES[family.kind])}</Badge>
                      <Badge tone="outline">
                        {t('úroveň', 'level')} {Math.min(...family.levels)}
                        {family.levels.length > 1 ? `–${Math.max(...family.levels)}` : ''}
                      </Badge>
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>

        <div className="min-w-0 space-y-5">
          {(data.prereqDetails.length > 0 || data.unlocks.length > 0) && (
            <Card className="p-5">
              {data.prereqDetails.length > 0 && (
                <>
                  <SectionLabel>{t('Na čem to stojí', 'What it stands on')}</SectionLabel>
                  <ul className="-mx-2 mt-1.5">
                    {data.prereqDetails.map((item) => (
                      <li key={item.id}>
                        <Link
                          to={`/concept/${item.id}`}
                          className="flex items-center justify-between gap-3 rounded-md px-2 py-1.5 text-sm text-ink hover:bg-surface-2 hover:no-underline"
                        >
                          <span className="min-w-0 truncate">{t(item.title)}</span>
                          <LevelBar level={item.level} size="sm" />
                        </Link>
                      </li>
                    ))}
                  </ul>
                </>
              )}
              {data.unlocks.length > 0 && (
                <>
                  <SectionLabel className={data.prereqDetails.length > 0 ? 'mt-4' : ''}>
                    {t('Co na tom stojí dál', 'What builds on it')}
                  </SectionLabel>
                  <ul className="-mx-2 mt-1.5">
                    {data.unlocks.map((item) => (
                      <li key={item.id}>
                        <Link
                          to={`/concept/${item.id}`}
                          className="block truncate rounded-md px-2 py-1.5 text-sm text-ink hover:bg-surface-2 hover:no-underline"
                        >
                          {t(item.title)}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </>
              )}
              <Link to="/tree" className="mt-3 inline-block text-[13px]">
                {t('Zobrazit ve stromu dovedností', 'Show in the skill tree')}
              </Link>
            </Card>
          )}

          {data.terms.length > 0 && (
            <Card className="p-5">
              <SectionLabel>{t('Pojmy česky a anglicky', 'Terms in Czech and English')}</SectionLabel>
              <table className="mt-2 w-full text-sm">
                <tbody>
                  {data.terms.map((term) => (
                    <tr key={term.cs} className="border-t border-border first:border-0">
                      <td className="py-1.5 pr-3">{term.cs}</td>
                      <td className="py-1.5 text-ink-2">{term.en}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}

          {data.missions.length > 0 && (
            <Card className="p-5">
              <SectionLabel>{t('Kde se to použije', 'Where it gets used')}</SectionLabel>
              <ul className="mt-1.5 space-y-1 text-sm">
                {data.missions.map((mission) => (
                  <li key={mission.id}>
                    <Link to={`/missions#${mission.id}`}>{t(mission.title)}</Link>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {data.resources.length > 0 && (
            <Card className="p-5">
              <SectionLabel>{t('Další zdroje', 'Further reading')}</SectionLabel>
              <ul className="mt-1.5 space-y-1.5 text-sm">
                {data.resources.map((resource) => (
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
                    <span className="ml-1.5 font-mono text-[11px] text-ink-3 uppercase">{resource.lang}</span>
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

/** How well confidence matched reality: being sure and wrong is the pattern worth seeing. */
function Calibration({ data }: { data: ConceptDetailDto }) {
  const t = useT();
  const c = data.stats.calibration;
  const total = c.sureRight + c.sureWrong + c.unsureRight + c.unsureWrong;
  if (total < 4) return null;
  return (
    <p className="mt-4 border-t border-border pt-3 text-[13px] text-ink-2">
      {t('Když sis byl jistý, měl jsi pravdu', 'When you were sure, you were right')}{' '}
      <b className="text-ink">
        {c.sureRight}× {t('z', 'of')} {c.sureRight + c.sureWrong}
      </b>
      {c.sureWrong > 0 &&
        t(
          `. „Jistě, a přesto špatně“ (${c.sureWrong}×) bývá nepozornost — tam pomáhá kontrola.`,
          `. “Sure, yet wrong” (${c.sureWrong}×) is usually a slip — that is where checking helps.`,
        )}
    </p>
  );
}
