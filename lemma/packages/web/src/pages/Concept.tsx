import { type ConceptDetailDto, type StartRunResponse, ERROR_INFO } from '@lemma/core';
import { ArrowLeft, BookOpen, ExternalLink, FlaskConical, MessageSquare, Play, Ruler, Zap } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import { api } from '../app/api';
import { Gates, PathBadge } from '../app/components';
import { useT } from '../app/i18n';
import {
  AREA_NAMES,
  CONFIDENCE_NAMES,
  KIND_NAMES,
  LAB_NAMES,
  LENS_NAMES,
  LEVEL_MEANING,
  LEVEL_NAMES,
  PATH_REASONS,
  ROLE_NAMES,
  ROLE_NOTES,
  TRACK_NAMES,
  TRACK_NOTES,
} from '../app/labels';
import { useConcept, useExample, useRefresh } from '../app/queries';
import { Figure } from '../figure/Figure';
import { cn } from '../lib/cn';
import { formatDateTime, inDays, pct, plural } from '../lib/format';
import { RichText, Tex } from '../lib/Math';
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
  const [params] = useSearchParams();
  // A skill without an authored lesson is introduced by a solved example of its own problems.
  const canShowExample = !data.lesson && data.hasProblems;
  const [exampleOpen, setExampleOpen] = useState(canShowExample && params.get('example') === '1');
  const basic = data.track === 'basic';

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
      <Link to={basic ? '/map' : '/learn'} className="mb-3 inline-flex items-center gap-1 text-sm text-ink-2">
        <ArrowLeft size={14} aria-hidden />
        {basic ? t('Mapa učiva', 'Curriculum map') : t('Osnovy', 'Syllabus')}
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
          {data.role && (
            <Badge tone={data.role === 'tested' ? 'accent' : 'outline'} title={t(ROLE_NOTES[data.role])}>
              {t(ROLE_NAMES[data.role])}
              {data.role === 'tested' && data.weight > 0 && ` · ${pct(data.weight, t.locale, 1)}`}
            </Badge>
          )}
          {data.paperOnly && (
            <Badge tone="outline">
              <Ruler size={11} aria-hidden /> {t('na papíře', 'on paper')}
            </Badge>
          )}
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
        {data.track !== 'school' && !basic && (
          <p className="mt-1 text-[13px] text-ink-3">{t(TRACK_NOTES[data.track])}</p>
        )}

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
          {canShowExample && (
            <Button
              variant={data.attempts === 0 ? 'primary' : 'secondary'}
              onClick={() => setExampleOpen((open) => !open)}
            >
              <BookOpen size={14} />
              {t('Řešený příklad', 'Worked example')}
            </Button>
          )}
          <Button
            variant={
              (data.lesson && !data.lesson.done) || (canShowExample && data.attempts === 0) ? 'secondary' : 'primary'
            }
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
        {data.paperOnly ? (
          <Notice tone="info" className="mt-4" title={t('Tohle se procvičuje na papíře', 'This is practised on paper')}>
            {t(
              'Konstrukce se rýsují pravítkem a kružítkem a hodnotí se podle postupu i výsledku. To aplikace zadat ani poctivě zkontrolovat neumí, takže tu k nim úlohy nejsou a nezapočítávají se do žádného z údajů o připravenosti. Zadání na procvičení jsou na oficiálním webu zkoušky.',
              'Constructions are drawn with ruler and compasses and marked on the working as well as the result. The app can neither set nor honestly check that, so there are no problems for them here and they count towards none of the readiness figures. Papers to practise on are on the examination’s official site.',
            )}
          </Notice>
        ) : (
          !data.hasProblems && (
            <Notice tone="info" className="mt-4">
              {t(
                'K tomuhle pojmu zatím nejsou úlohy. Výklad a souvislosti níž už platí; procvičování přibude.',
                'There are no problems for this concept yet. The explanation and connections below already hold; practice will follow.',
              )}
            </Notice>
          )
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
          {exampleOpen && <WorkedExample id={data.id} />}
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
            <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-ink-2">
              <PathBadge state={data.path} className="font-medium text-ink" />
              <span>{t(PATH_REASONS[data.pathReason])}</span>
            </div>
            <div className="mt-1 text-xs text-ink-3">
              {t('Jak moc se dá odhadu věřit', 'How far the estimate can be trusted')}:{' '}
              {t(CONFIDENCE_NAMES[data.confidence])}
              {data.confidence === 'low' &&
                t(
                  ' — málo úloh, jediný den nebo jediný typ úlohy.',
                  ' — few problems, a single day, or a single kind of problem.',
                )}
            </div>

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

            {data.stats.attempts > 0 && (
              <p className="mt-4 text-[13px] text-ink-3">
                {t('Záznam', 'On record')}: {data.record.firstTry}× {t('napoprvé', 'at the first try')} ·{' '}
                {data.record.hinted}× {t('s nápovědou', 'with a hint')} ·{' '}
                {plural(data.record.days, t.locale, ['den', 'dny', 'dní'], ['day', 'days'])} ·{' '}
                {t('typy úloh', 'kinds of problem')} {data.record.families}/{data.record.familyCap}
                {data.record.guessed > 0 &&
                  ` · ${data.record.guessed}× ${t('tip nebo ano/ne', 'a guess or true/false')}`}
                {data.record.timed.attempts > 0 &&
                  ` · ${t('na čas', 'timed')} ${data.record.timed.solved}/${data.record.timed.attempts}`}
                {data.record.reviews.passed + data.record.reviews.failed > 0 &&
                  ` · ${t('opakování', 'reviews')} ${data.record.reviews.passed}/${data.record.reviews.passed + data.record.reviews.failed}`}
                {data.record.diagnosed > 0 &&
                  ` · ${t('z toho v rozřazení', 'of which in placement')} ${data.record.diagnosed}`}
              </p>
            )}

            {data.attempts > 0 && (
              <p className="mt-2 text-[13px] text-ink-3">
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
          {data.role && (
            <Card className="p-5">
              <SectionLabel>{t('Ve zkoušce', 'In the examination')}</SectionLabel>
              <p className="mt-2 text-sm text-ink-2">{t(ROLE_NOTES[data.role])}</p>
              {data.evidence && (
                <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                  <div>
                    <dt className="mono-label">{t('Podíl bodů', 'Share of points')}</dt>
                    <dd className="mt-1 text-xl font-semibold">
                      {data.role === 'tested' ? pct(data.weight, t.locale, 1) : '—'}
                    </dd>
                    <dd className="text-xs text-ink-3">
                      {t(
                        `v ${data.evidence.papersRead} přečtených testech`,
                        `in the ${data.evidence.papersRead} tests read`,
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt className="mono-label">{t('Úlohy v minulých testech', 'Tasks in past tests')}</dt>
                    <dd className="mt-1 text-xl font-semibold">{data.evidence.read}</dd>
                    <dd className="text-xs text-ink-3">
                      {t(
                        `čtením; dalších ${data.evidence.rules} podle klíčových slov`,
                        `by reading; ${data.evidence.rules} more by keyword rules`,
                      )}
                    </dd>
                  </div>
                </dl>
              )}
              {data.spec.length > 0 && (
                <details className="mt-3 text-[13px] text-ink-2">
                  <summary className="hover:text-ink">
                    {t('Co o tom říká specifikace požadavků', 'What the specification of requirements says')}
                  </summary>
                  <ul className="mt-2 space-y-1">
                    {data.spec.map((item) => (
                      <li key={item.id} className="flex gap-2">
                        <span className="w-14 shrink-0 font-mono text-xs text-ink-3">{item.id}</span>
                        <span>{t(item.text)}</span>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-2 text-xs text-ink-3">
                    {t(
                      'Znění je volný přepis; platí text oficiálního dokumentu.',
                      'The wording is a paraphrase; the official document’s text is what counts.',
                    )}
                  </p>
                </details>
              )}
            </Card>
          )}
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
              <Link to={basic ? '/map' : '/tree'} className="mt-3 inline-block text-[13px]">
                {basic
                  ? t('Zobrazit v mapě učiva', 'Show in the curriculum map')
                  : t('Zobrazit ve stromu dovedností', 'Show in the skill tree')}
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
      {t('Odpověď „jistě“ byla správně', 'A “sure” answer was right')}{' '}
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

/**
 * One of the skill's own problems, solved step by step. Reading it is not an attempt and
 * proves nothing; it is what a lesson would open with.
 */
function WorkedExample({ id }: { id: string }) {
  const t = useT();
  const refresh = useRefresh();
  const [n, setN] = useState(0);
  const example = useExample(id, n, true);
  return (
    <Card className="p-5">
      <SectionLabel
        action={
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setN((value) => value + 1);
              refresh();
            }}
          >
            {t('Jiný příklad', 'Another example')}
          </Button>
        }
      >
        {t('Řešený příklad', 'Worked example')}
      </SectionLabel>
      {example.isPending && <Loading />}
      {example.isError && <ErrorNote error={example.error} />}
      {example.data && (
        <>
          <div className="mt-3 text-[1.0625rem] leading-relaxed">
            <RichText text={t(example.data.prompt)} />
          </div>
          {example.data.figure && <Figure spec={example.data.figure} className="mt-4" maxWidth={460} />}
          <ol className="mt-4 space-y-2.5 border-t border-border pt-4">
            {example.data.solution.map((step, index) => (
              <li key={index} className="flex gap-3 text-sm">
                <span className="mt-0.5 w-4 shrink-0 font-mono text-xs text-ink-3">{index + 1}</span>
                <div className="min-w-0 flex-1">
                  <RichText text={t(step.text)} />
                  {step.math !== undefined && (
                    <Tex tex={typeof step.math === 'string' ? step.math : t(step.math)} display />
                  )}
                </div>
              </li>
            ))}
          </ol>
          {example.data.answerTex[t.locale] !== '' && (
            <div className="mt-3 text-sm text-ink-2">
              {t('Výsledek', 'Result')}: <Tex tex={t(example.data.answerTex)} className="text-ink" />
            </div>
          )}
          <p className="mt-3 text-xs text-ink-3">
            {t(
              'Přečtení příkladu se nepočítá jako vyřešená úloha. Teď to zkus bez pomoci.',
              'Reading an example does not count as a solved problem. Now try one unaided.',
            )}
          </p>
        </>
      )}
    </Card>
  );
}
