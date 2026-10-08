import { Check } from 'lucide-react';
import { useT } from '../app/i18n';
import { CONTEXT_NAMES } from '../app/labels';
import { type MilestoneDto, useAnalytics, useMilestones } from '../app/queries';
import { cn } from '../lib/cn';
import { duration, formatDate, formatDayShort, num, pct } from '../lib/format';
import { Card, Empty, ErrorNote, Loading, Meter, PageHeader, SectionLabel, StatTile } from '../ui';
import { BarList, LevelDistribution, LineChart, Sparkline, StackedColumns } from '../viz/charts';

/** The numbers behind the learning, as an engineer would want them: trends, not trophies. */
export function Analytics() {
  const t = useT();
  const analytics = useAnalytics();
  const milestones = useMilestones();
  if (analytics.isPending) return <Loading />;
  if (analytics.isError) return <ErrorNote error={analytics.error} retry={() => void analytics.refetch()} />;
  const data = analytics.data;
  const { totals, weekly } = data;
  const weeks = weekly.map((week) => formatDayShort(week.week, t.locale));
  const percent = (value: number): string => pct(value, t.locale);

  return (
    <div>
      <PageHeader
        title={t('Analytika', 'Analytics')}
        lead={t(
          'Co říkají data o tom, jak se učíš. Týdenní grafy pokrývají posledních dvanáct týdnů.',
          'What the data says about how you are learning. The weekly charts cover the last twelve weeks.',
        )}
      />

      {totals.problems === 0 ? (
        <Empty title={t('Zatím není co měřit', 'Nothing to measure yet')}>
          {t(
            'Grafy se začnou plnit po prvních vyřešených úlohách.',
            'The charts start filling in after the first problems.',
          )}
        </Empty>
      ) : (
        <div className="space-y-5">
          <Card className="p-5">
            <div className="grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-4 lg:grid-cols-7">
              <StatTile
                label={t('Úlohy', 'Problems')}
                value={num(totals.problems, t.locale)}
                sub={`${num(totals.solved, t.locale)} ${t('vyřešeno', 'solved')}`}
              >
                <Trend values={weekly.map((week) => week.problems)} label={t('Úlohy po týdnech', 'Problems by week')} />
              </StatTile>
              <StatTile
                label={t('Úspěšnost', 'Accuracy')}
                value={pct(totals.accuracy, t.locale)}
                sub={t('vyřešeno ze všech', 'solved, of all')}
              >
                <Trend
                  values={weekly.map((week) => week.accuracy)}
                  label={t('Úspěšnost po týdnech', 'Accuracy by week')}
                />
              </StatTile>
              <StatTile
                label={t('Samostatně', 'Unaided')}
                value={pct(totals.unaidedRate, t.locale)}
                sub={t('napoprvé, bez nápovědy', 'first try, no hints')}
              >
                <Trend
                  values={weekly.map((week) => week.unaidedRate)}
                  label={t('Samostatnost po týdnech', 'Unaided rate by week')}
                />
              </StatTile>
              <StatTile
                label={t('Medián času', 'Median time')}
                value={totals.medianSeconds === null ? '—' : duration(totals.medianSeconds, t.locale)}
                sub={t('na vyřešenou úlohu', 'per solved problem')}
              />
              <StatTile
                label={t('Čas celkem', 'Total time')}
                value={duration(totals.minutes * 60, t.locale)}
                sub={t(`${totals.sessions} dokončených sezení`, `${totals.sessions} finished runs`)}
              />
              <StatTile label={t('Aktivní dny', 'Active days')} value={totals.activeDays} />
              <StatTile
                label={t('Opakování', 'Reviews')}
                value={`${totals.reviewsPassed}`}
                sub={t(`úspěšných · ${totals.reviewsFailed} ne`, `passed · ${totals.reviewsFailed} not`)}
              />
            </div>
          </Card>

          <div className="grid gap-5 lg:grid-cols-2">
            <Card className="p-5">
              <LineChart
                title={t('Úspěšnost', 'Accuracy')}
                subtitle={t(
                  'Podíl úloh týdne: vyřešených, a z toho bez jakékoli pomoci',
                  'Share of the week’s problems: solved, and solved with no help at all',
                )}
                x={weeks}
                xLabel={t('Týden od', 'Week of')}
                yMin={0}
                yMax={1}
                format={percent}
                series={[
                  {
                    id: 'accuracy',
                    label: t('vyřešeno', 'solved'),
                    color: 'var(--series-1)',
                    values: weekly.map((week) => week.accuracy),
                  },
                  {
                    id: 'unaided',
                    label: t('samostatně', 'unaided'),
                    color: 'var(--series-2)',
                    values: weekly.map((week) => week.unaidedRate),
                  },
                ]}
              />
            </Card>
            <Card className="p-5">
              <LineChart
                title={t('Chyby', 'Errors')}
                subtitle={t(
                  'Podíl úloh týdne s chybou z nepozornosti a s chybou v postupu nebo pochopení',
                  'Share of the week’s problems with a slip, and with a procedural or conceptual error',
                )}
                x={weeks}
                xLabel={t('Týden od', 'Week of')}
                yMin={0}
                format={percent}
                series={[
                  {
                    id: 'slip',
                    label: t('nepozornost', 'slips'),
                    color: 'var(--series-1)',
                    values: weekly.map((week) => week.slipRate),
                  },
                  {
                    id: 'gap',
                    label: t('postup a porozumění', 'procedure and understanding'),
                    color: 'var(--series-2)',
                    values: weekly.map((week) => week.gapRate),
                  },
                ]}
              />
            </Card>
            <Card className="p-5">
              <LineChart
                title={t('Poznáš typ úlohy sám?', 'Do you recognise the problem type yourself?')}
                subtitle={t(
                  'Podíl samostatně vyřešených: když téma znáš předem, a když je úloha ve směsi bez označení',
                  'Share solved unaided: when the topic is announced, and when the problem comes unlabelled in a mix',
                )}
                x={weeks}
                xLabel={t('Týden od', 'Week of')}
                yMin={0}
                yMax={1}
                format={percent}
                series={[
                  {
                    id: 'blocked',
                    label: t('téma známé předem', 'topic announced'),
                    color: 'var(--series-1)',
                    values: weekly.map((week) => week.blockedAccuracy),
                  },
                  {
                    id: 'mixed',
                    label: t('ve směsi', 'in a mix'),
                    color: 'var(--series-2)',
                    values: weekly.map((week) => week.mixedAccuracy),
                  },
                ]}
              />
            </Card>
            <Card className="p-5">
              <StackedColumns
                title={t('Objem práce', 'Volume of work')}
                subtitle={t('Počet úloh dokončených v týdnu', 'Problems finished in the week')}
                x={weeks}
                format={(value) => num(value, t.locale)}
                totalLabel={t('Úloh', 'Problems')}
                series={[
                  {
                    id: 'problems',
                    label: t('úlohy', 'problems'),
                    color: 'var(--series-1)',
                    values: weekly.map((week) => week.problems),
                  },
                ]}
              />
            </Card>
            <Card className="p-5">
              <LineChart
                title={t('Průměrná obtížnost', 'Average difficulty')}
                subtitle={t(
                  'Průměrná úroveň úloh (1–5), které jsi v týdnu řešil',
                  'Mean level (1–5) of the problems worked in the week',
                )}
                x={weeks}
                xLabel={t('Týden od', 'Week of')}
                yMin={1}
                yMax={5}
                format={(value) => num(value, t.locale, 1)}
                series={[
                  {
                    id: 'level',
                    label: t('úroveň', 'level'),
                    color: 'var(--series-1)',
                    values: weekly.map((week) => week.avgLevel),
                  },
                ]}
              />
            </Card>
            <Card className="p-5">
              <StackedColumns
                title={t('Pravidelnost', 'Regularity')}
                subtitle={t('Počet aktivních dní v týdnu', 'Active days in the week')}
                x={weeks}
                format={(value) => num(value, t.locale)}
                totalLabel={t('Dní', 'Days')}
                series={[
                  {
                    id: 'days',
                    label: t('aktivní dny', 'active days'),
                    color: 'var(--series-1)',
                    values: weekly.map((week) => week.activeDays),
                  },
                ]}
              />
            </Card>
          </div>

          <div className="grid gap-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
            <Card className="p-5">
              <SectionLabel>{t('Kapitoly osnov', 'Syllabus chapters')}</SectionLabel>
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-xs text-ink-3">
                    <tr>
                      <th className="pb-1.5 font-normal">{t('Kapitola', 'Chapter')}</th>
                      <th className="w-36 pb-1.5 font-normal">{t('Postup', 'Progress')}</th>
                      <th className="pb-1.5 text-right font-normal">{t('Úloh', 'Problems')}</th>
                      <th className="pb-1.5 text-right font-normal">{t('Úspěšnost', 'Accuracy')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.topics.map((topic) => (
                      <tr
                        key={topic.topic}
                        className={cn('border-t border-border', topic.attempts === 0 && 'text-ink-3')}
                      >
                        <td className="py-1.5 pr-3">
                          <span className="font-mono text-ink-3">{topic.topic}.</span> {t(topic.title)}
                        </td>
                        <td className="py-1.5 pr-3">
                          <div className="flex items-center gap-2">
                            <Meter value={topic.progress} label={t('Postup', 'Progress')} />
                            <span className="w-9 shrink-0 text-right font-mono text-xs">
                              {pct(topic.progress, t.locale)}
                            </span>
                          </div>
                        </td>
                        <td className="py-1.5 text-right">{topic.attempts}</td>
                        <td className="py-1.5 text-right">{pct(topic.accuracy, t.locale)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>

            <div className="space-y-5">
              <Card className="p-5">
                <SectionLabel>{t('Dovednosti podle úrovně', 'Skills by level')}</SectionLabel>
                <div className="mt-3">
                  <LevelDistribution counts={data.levels} />
                </div>
              </Card>
              <Card className="p-5">
                <SectionLabel>{t('Paměť', 'Memory')}</SectionLabel>
                <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-4">
                  <StatTile label={t('V plánu opakování', 'Scheduled')} value={data.retention.scheduled} />
                  <StatTile label={t('Čeká teď', 'Due now')} value={data.retention.due} />
                  <StatTile label={t('Začíná mizet', 'Fading')} value={data.retention.fading} />
                  <StatTile
                    label={t('Průměrná vybavitelnost', 'Mean recall')}
                    value={pct(data.retention.avgRetention, t.locale)}
                    sub={t('odhad modelu', 'model estimate')}
                  />
                </div>
              </Card>
              <Card className="p-5">
                <SectionLabel>{t('Druhy práce', 'Kinds of work')}</SectionLabel>
                <div className="mt-3">
                  <BarList
                    labelWidth={150}
                    rows={data.contexts.map((entry) => ({
                      id: entry.context,
                      label: t(CONTEXT_NAMES[entry.context]),
                      value: entry.problems,
                      display: `${entry.problems}`,
                      note: `${pct(entry.accuracy, t.locale)} ${t('samostatně', 'unaided')}`,
                    }))}
                  />
                </div>
              </Card>
            </div>
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            <Card className="p-5">
              <SectionLabel>{t('Rekordy', 'Records')}</SectionLabel>
              <ul className="mt-2 divide-y divide-border">
                {data.records.map((record, index) => (
                  <li key={index} className="flex items-baseline justify-between gap-3 py-2 text-sm">
                    <span className="text-ink-2">{t(record.title)}</span>
                    <span className="shrink-0 text-right">
                      <span className="font-semibold">{record.value}</span>
                      {record.at !== null && (
                        <span className="ml-2 font-mono text-xs text-ink-3">{formatDate(record.at, t.locale)}</span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
            <Milestones list={milestones.data ?? []} />
          </div>
        </div>
      )}
    </div>
  );
}

function Trend({ values, label }: { values: (number | null)[]; label: string }) {
  return (
    <div className="mt-2">
      <Sparkline values={values} label={label} />
    </div>
  );
}

function Milestones({ list }: { list: MilestoneDto[] }) {
  const t = useT();
  const reached = list.filter((item) => item.achieved.length > 0);
  const ahead = list.filter((item) => item.achieved.length === 0);
  return (
    <Card className="p-5">
      <SectionLabel>
        {t('Milníky', 'Milestones')} · {reached.length}/{list.length}
      </SectionLabel>
      {reached.length === 0 && (
        <p className="mt-2 text-sm text-ink-2">
          {t('První přijde s první vyřešenou úlohou.', 'The first one comes with the first solved problem.')}
        </p>
      )}
      <ul className="mt-2 space-y-2">
        {reached.map((item) => (
          <li key={item.id} className="flex gap-2.5 text-sm">
            <Check size={15} className="mt-0.5 shrink-0" style={{ color: 'var(--good)' }} aria-hidden />
            <span className="min-w-0 flex-1">
              <span className="font-medium">{t(item.title)}</span>
              {item.achieved.length > 1 && <span className="text-ink-3"> ×{item.achieved.length}</span>}
              <span className="block text-[13px] text-ink-2">{t(item.description)}</span>
            </span>
            <span className="shrink-0 font-mono text-xs text-ink-3">
              {formatDate(Math.min(...item.achieved.map((entry) => entry.at)), t.locale)}
            </span>
          </li>
        ))}
      </ul>
      {ahead.length > 0 && (
        <details className="mt-3">
          <summary className="text-[13px] text-ink-2 hover:text-ink">
            {t(`Co je ještě před tebou (${ahead.length})`, `Still ahead (${ahead.length})`)}
          </summary>
          <ul className="mt-2 space-y-1.5">
            {ahead.map((item) => (
              <li key={item.id} className="text-[13px] text-ink-3">
                <span className="text-ink-2">{t(item.title)}</span> — {t(item.description)}
              </li>
            ))}
          </ul>
        </details>
      )}
    </Card>
  );
}
