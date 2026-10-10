import { ArrowRight, Ruler } from 'lucide-react';
import { Link } from 'react-router';
import { PathBadge } from '../app/components';
import { useT } from '../app/i18n';
import { READINESS_NAMES, READINESS_NOTES } from '../app/labels';
import { useGoals, useReadiness } from '../app/queries';
import { PART_KEYS, ReadinessParts, examCountdown, partTexts } from '../app/readiness-parts';
import { formatDay, pct } from '../lib/format';
import { Badge, Card, ErrorNote, LinkButton, Loading, Notice, PageHeader, SectionLabel } from '../ui';
import { LevelBar } from '../viz/charts';

/**
 * Readiness for the examination: several statements, each with what it rests on. Where
 * there is too little to go on, that is what is said — never a figure in its place.
 */

export function Readiness() {
  const t = useT();
  const query = useReadiness();
  const goals = useGoals();
  if (query.isPending) return <Loading />;
  if (query.isError) return <ErrorNote error={query.error} retry={() => void query.refetch()} />;
  const readiness = query.data;
  const goal = goals.data?.find((entry) => entry.id === readiness.goal);
  const texts = partTexts(readiness, t);
  const title = (id: string): string => (readiness.titles[id] ? t(readiness.titles[id]) : id);
  const heaviest = Math.max(1e-9, ...readiness.skills.map((skill) => skill.weight));
  const countdown = examCountdown(readiness, t);

  return (
    <div>
      <PageHeader
        eyebrow={goal ? t(goal.short) : undefined}
        title={t('Připravenost na zkoušku', 'Readiness for the examination')}
        lead={t(
          'Několik samostatných údajů místo jednoho čísla. U každého je řečeno, z čeho vychází — a kde je dat málo, stojí tu to místo čísla.',
          'Several separate statements instead of one number. Each says what it rests on — and where there is too little data, that is what stands here instead of a figure.',
        )}
        actions={
          <LinkButton to="/exams" variant="secondary">
            {t('Testy nanečisto', 'Practice tests')}
          </LinkButton>
        }
      />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <div className="min-w-0 space-y-5">
          <Card className="p-5">
            <SectionLabel>{t('Kde to teď je', 'Where things stand')}</SectionLabel>
            <div className="mt-2 text-lg font-semibold">{t(READINESS_NAMES[readiness.verdict])}</div>
            <p className="mt-1 text-sm text-ink-2">{t(READINESS_NOTES[readiness.verdict])}</p>
            <div className="mt-3 text-sm text-ink-2">
              {countdown ?? (
                <>
                  {t('Termín zkoušky není nastavený. ', 'No examination date is set. ')}
                  <Link to="/settings#goal">{t('Nastavit', 'Set it')}</Link>
                </>
              )}
            </div>
            <Notice tone="info" className="mt-4">
              {t(
                'Tohle není pravděpodobnost přijetí. Každá škola má vlastní kritéria a odhady v aplikaci nebyly ověřeny na skutečných výsledcích zkoušek.',
                'This is not a probability of admission. Every school sets its own criteria, and the estimates in the app have not been checked against real examination results.',
              )}
            </Notice>
          </Card>

          <Card className="p-5">
            <SectionLabel>{t('Šest pohledů', 'Six views')}</SectionLabel>
            <ReadinessParts readiness={readiness} className="mt-3" />
            <details className="mt-4 text-[13px] text-ink-3">
              <summary className="hover:text-ink-2">{t('Co který údaj znamená', 'What each figure means')}</summary>
              <dl className="mt-2 space-y-1.5">
                {PART_KEYS.map((key) => (
                  <div key={key}>
                    <dt className="inline font-medium text-ink-2">{texts[key]!.label}: </dt>
                    <dd className="inline">{texts[key]!.meaning}.</dd>
                  </div>
                ))}
              </dl>
            </details>
          </Card>

          <Card className="p-5">
            <SectionLabel
              action={
                <Link to="/exams" className="text-xs">
                  {t('nový test', 'new test')}
                </Link>
              }
            >
              {t('Testy na čas', 'Timed tests')}
            </SectionLabel>
            {readiness.timed.count === 0 ? (
              <p className="mt-2 text-sm text-ink-2">
                {t(
                  'Zatím žádný. Test nanečisto má stejnou stavbu a bodování jako skutečný; smysl dává, až bude většina látky procvičená.',
                  'None yet. A practice test has the structure and scoring of the real one; it makes sense once most of the material has been practised.',
                )}
              </p>
            ) : (
              <dl className="mt-2 grid grid-cols-3 gap-4 text-sm">
                <div>
                  <dt className="mono-label">{t('Počet', 'Taken')}</dt>
                  <dd className="mt-1 text-xl font-semibold">{readiness.timed.count}</dd>
                </div>
                {(['last', 'best'] as const).map((which) => {
                  const mock = readiness.timed[which];
                  return (
                    <div key={which}>
                      <dt className="mono-label">{which === 'last' ? t('Poslední', 'Last') : t('Nejlepší', 'Best')}</dt>
                      <dd className="mt-1 text-xl font-semibold tabular-nums">
                        {mock ? `${mock.points}/${mock.maxPoints}` : '—'}
                      </dd>
                      {mock && (
                        <dd className="text-xs text-ink-3">
                          {mock.minutesUsed}/{mock.minutesAllowed} min
                        </dd>
                      )}
                    </div>
                  );
                })}
              </dl>
            )}
          </Card>
        </div>

        <div className="min-w-0 space-y-5">
          {readiness.gaps.length > 0 && (
            <Card className="p-5">
              <SectionLabel>{t('Mezery, které něco blokují', 'Gaps that hold something up')}</SectionLabel>
              <ul className="mt-2 divide-y divide-border">
                {readiness.gaps.map((gap) => (
                  <li key={gap.id} className="py-2.5">
                    <Link to={`/concept/${gap.id}`} className="text-sm font-medium text-ink">
                      {title(gap.id)}
                    </Link>
                    <div className="mt-0.5 text-[13px] text-ink-2">
                      {gap.holdsUp.length > 0
                        ? `${t('čeká na to', 'waiting for it')}: ${gap.holdsUp.map(title).join(', ')}`
                        : t('zkoušelo se to a zatím to nejde', 'it has been tried and does not go well yet')}
                      {gap.weight > 0 && (
                        <span className="text-ink-3">
                          {' · '}
                          {gap.holdsUp.length > 0 ? `${t('dohromady', 'together')} ` : ''}
                          {pct(gap.weight, t.locale, 1)} {t('bodů zkoušky', 'of the points')}
                        </span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <Card className="p-5">
            <SectionLabel
              action={
                <Link to="/map" className="inline-flex items-center gap-1 text-xs">
                  {t('mapa učiva', 'curriculum map')}
                  <ArrowRight size={12} aria-hidden />
                </Link>
              }
            >
              {t('Z čeho se zkouška skládá', 'What the examination is made of')}
            </SectionLabel>
            <p className="mt-2 text-[13px] text-ink-2">
              {goal
                ? t(
                    `Délka pruhu je podíl bodů v testech, které byly přečteny úlohu po úloze (${goal.papersRead}).`,
                    `The length of a bar is the share of points in the tests that were read task by task (${goal.papersRead}).`,
                  )
                : null}{' '}
              {readiness.provisional &&
                t(
                  'Je jich málo: váhy jsou předběžné a s dalšími testy se mohou posunout.',
                  'That is few: the weights are provisional and may move as more tests are read.',
                )}
            </p>
            <ul className="mt-3 space-y-1.5">
              {readiness.skills.map((skill) => (
                <li key={skill.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-0.5">
                  <Link to={`/concept/${skill.id}`} className="min-w-0 truncate text-sm text-ink">
                    {title(skill.id)}
                  </Link>
                  <span className="flex items-center gap-3">
                    {skill.paperOnly ? (
                      <Badge tone="outline">
                        <Ruler size={11} aria-hidden /> {t('na papíře', 'on paper')}
                      </Badge>
                    ) : (
                      <>
                        <PathBadge state={skill.path} className="hidden sm:inline-flex" />
                        <LevelBar level={skill.level} size="sm" />
                      </>
                    )}
                  </span>
                  <span className="col-span-2 flex items-center gap-2">
                    <span
                      className="h-1.5 flex-1 overflow-hidden rounded-full"
                      style={{ background: 'var(--surface-3)' }}
                    >
                      <span
                        className="block h-full rounded-full"
                        style={{
                          width: `${(skill.weight / heaviest) * 100}%`,
                          minWidth: 3,
                          background: skill.paperOnly ? 'var(--series-muted)' : 'var(--series-1)',
                        }}
                      />
                    </span>
                    <span className="w-12 shrink-0 text-right font-mono text-xs text-ink-3">
                      {pct(skill.weight, t.locale, 1)}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
            {readiness.paperOnlyWeight > 0 && (
              <Notice
                tone="warning"
                className="mt-4"
                title={t('Konstrukční úlohy tu chybí', 'Construction tasks are missing here')}
              >
                {t(
                  `Rýsují se na papír a tvoří asi ${pct(readiness.paperOnlyWeight, t.locale)} bodů zkoušky. Aplikace je neumí zadat ani zkontrolovat, takže nejsou v žádném z údajů výše. Procvič je s pravítkem a kružítkem na zadáních z oficiálního webu.`,
                  `They are drawn on paper and make up about ${pct(readiness.paperOnlyWeight, t.locale)} of the examination's points. The app can neither set nor check them, so they are in none of the figures above. Practise them with ruler and compasses on the papers from the official site.`,
                )}
              </Notice>
            )}
          </Card>

          {readiness.untouched.length > 0 && (
            <Card className="p-5">
              <SectionLabel>{t('Zatím neprocvičeno', 'Not practised yet')}</SectionLabel>
              <p className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-sm">
                {readiness.untouched.map((id) => (
                  <Link key={id} to={`/concept/${id}`} className="text-ink-2">
                    {title(id)}
                  </Link>
                ))}
              </p>
            </Card>
          )}

          {goal?.facts && (
            <Card className="p-5">
              <SectionLabel>
                {t('Fakta o zkoušce a jejich zdroje', 'Facts about the examination, with sources')}
              </SectionLabel>
              <ul className="mt-2 space-y-1 text-sm text-ink-2">
                <li>
                  {goal.facts.minutes} min · {goal.facts.points} {t('bodů', 'points')} · {goal.facts.tasks}{' '}
                  {t('úloh', 'tasks')} ({goal.facts.open} {t('otevřených', 'open')}, {goal.facts.closed}{' '}
                  {t('uzavřených', 'closed')})
                </li>
                <li>{t(goal.facts.aids)}</li>
                {goal.facts.terms.map((term) => (
                  <li key={term.day + term.label.cs}>
                    {t(term.label)}: {formatDay(term.day, t.locale)}
                  </li>
                ))}
              </ul>
              <ul className="mt-3 space-y-1 text-[13px]">
                {goal.facts.sources.map((source) => (
                  <li key={source.url}>
                    <a href={source.url} target="_blank" rel="noreferrer noopener">
                      {source.title}
                    </a>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-ink-3">
                {t('Načteno', 'Read on')} {formatDay(goal.facts.retrievedOn, t.locale)} ·{' '}
                {t(
                  'termíny a pravidla se každý rok mění, ověř je na oficiálním webu',
                  'dates and rules change every year; check them on the official site',
                )}
              </p>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
