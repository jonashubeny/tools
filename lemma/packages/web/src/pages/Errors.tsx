import {
  type ErrorSummaryDto,
  type ErrorType,
  type MistakeDto,
  type StartRunResponse,
  ERROR_FAMILIES,
  ERROR_FAMILY,
  ERROR_INFO,
  ERROR_TYPES,
} from '@lemma/core';
import { RotateCcw, Target } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { ApiFailure, api } from '../app/api';
import { useT } from '../app/i18n';
import { FAMILY_COLOR, FAMILY_NAMES, FAMILY_NOTES } from '../app/labels';
import { useErrors, useRefresh } from '../app/queries';
import { cn } from '../lib/cn';
import { formatDate, formatDayShort, pct } from '../lib/format';
import { RichText, Tex } from '../lib/Math';
import {
  Badge,
  Button,
  Card,
  Empty,
  ErrorNote,
  Loading,
  Notice,
  PageHeader,
  SectionLabel,
  Select,
  StatTile,
} from '../ui';
import { BarList, Dumbbell, StackedColumns } from '../viz/charts';

/**
 * The Error Lab. Mistakes are data: what kind they are decides what fixes them, and a
 * kind that keeps coming back can be trained like any other skill.
 */
export function Errors() {
  const t = useT();
  const errors = useErrors();
  const navigate = useNavigate();
  const [filter, setFilter] = useState<ErrorType | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [failure, setFailure] = useState<unknown>(null);

  if (errors.isPending) return <Loading />;
  if (errors.isError) return <ErrorNote error={errors.error} retry={() => void errors.refetch()} />;
  const data = errors.data;

  const start = async (key: string, body: Record<string, unknown>): Promise<void> => {
    setBusy(key);
    setFailure(null);
    try {
      const started = await api.post<StartRunResponse>('/api/practice/start', body);
      navigate(`/practice/${started.run.id}`);
    } catch (error) {
      setFailure(error);
    } finally {
      setBusy(null);
    }
  };

  const hasData = data.recent.length > 0;
  const top = data.byType.find((entry) => entry.recent > 0 && entry.type !== 'unknown');
  const matching = filter ? data.recent.filter((mistake) => mistake.error === filter) : data.recent;
  const shown = showAll ? matching : matching.slice(0, 8);

  return (
    <div>
      <PageHeader
        title={t('Laboratoř chyb', 'Error Lab')}
        lead={t(
          'Chyba není selhání, je to měření. Když víš, jakého je druhu, víš, co s ní: nepozornost se léčí návykem, špatný postup pravidlem, mezera v pochopení výkladem.',
          'An error is not a failure, it is a measurement. Once you know its kind you know what to do: a slip needs a habit, a wrong procedure needs the rule, a gap in understanding needs the explanation.',
        )}
      />

      {!hasData ? (
        <Empty title={t('Zatím žádné chyby k rozboru', 'No errors to analyse yet')} icon={<Target size={22} />}>
          {t(
            'Jakmile se v úlohách objeví první chyby, začnou se tu třídit a počítat. Každou můžeš sám označit, o jaký druh šlo.',
            'As soon as the first errors turn up in problems, they are sorted and counted here. You can label each one yourself.',
          )}
        </Empty>
      ) : (
        <div className="space-y-5">
          <Card className="p-5">
            <div className="grid gap-x-8 gap-y-5 md:grid-cols-[auto_1fr]">
              <div className="grid grid-cols-2 gap-x-8 gap-y-4 md:grid-cols-1">
                <StatTile
                  label={t(`Posledních ${data.windowDays} dní`, `Last ${data.windowDays} days`)}
                  value={data.errors}
                  sub={t(`úloh s chybou z ${data.attempts}`, `problems with an error, of ${data.attempts}`)}
                />
                <StatTile
                  label={t('Podíl úloh s chybou', 'Share with an error')}
                  value={pct(data.attempts === 0 ? null : data.errors / data.attempts, t.locale)}
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                {ERROR_FAMILIES.map((family) => (
                  <div key={family} className="rounded-lg border border-border bg-surface-2 p-3">
                    <div className="flex items-center gap-2">
                      <span
                        aria-hidden
                        className="inline-block h-2.5 w-2.5 rounded-[3px]"
                        style={{ background: FAMILY_COLOR[family] }}
                      />
                      <span className="text-sm font-medium">{t(FAMILY_NAMES[family])}</span>
                      <span className="ml-auto font-mono text-sm">{data.byFamily[family].recent}</span>
                    </div>
                    <p className="mt-1.5 text-[13px] text-ink-2">{t(FAMILY_NOTES[family])}</p>
                  </div>
                ))}
              </div>
            </div>

            {top && (
              <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border-strong bg-surface-2 p-3.5">
                <div className="min-w-0">
                  <div className="text-sm">
                    {t('Nejčastější: ', 'Most frequent: ')}
                    <b>{t(ERROR_INFO[top.type].title)}</b> <span className="text-ink-2">({top.recent}×)</span>
                  </div>
                  <div className="mt-0.5 text-[13px] text-ink-2">{t(ERROR_INFO[top.type].remedy)}</div>
                </div>
                <Button
                  variant="primary"
                  onClick={() => void start(`drill-${top.type}`, { context: 'drill', errorType: top.type, count: 6 })}
                  busy={busy === `drill-${top.type}`}
                >
                  <Target size={14} />
                  {t('Natrénovat', 'Train it')}
                </Button>
              </div>
            )}
            {failure !== null &&
              (failure instanceof ApiFailure && failure.code === 'no_drill' ? (
                <Notice tone="info" className="mt-3">
                  {t(
                    'Pro tenhle druh chyby zatím nejsou cílené úlohy.',
                    'There are no targeted problems for this kind of error yet.',
                  )}
                </Notice>
              ) : (
                <div className="mt-3">
                  <ErrorNote error={failure} />
                </div>
              ))}
          </Card>

          <div className="grid gap-5 lg:grid-cols-2">
            <Card className="p-5">
              <SectionLabel>{t('Podle druhu', 'By kind')}</SectionLabel>
              <p className="mt-1 text-[13px] text-ink-3">
                {t('Kliknutím vyfiltruješ seznam dole.', 'Click to filter the list below.')}
              </p>
              <div className="mt-3">
                <BarList
                  rows={data.byType
                    .filter((entry) => entry.recent > 0)
                    .map((entry) => ({
                      id: entry.type,
                      label: t(ERROR_INFO[entry.type].title),
                      value: entry.recent,
                      display: `${entry.recent}×`,
                      note: pct(entry.rate, t.locale),
                    }))}
                  selected={filter}
                  onSelect={(id) => setFilter((current) => (current === id ? null : (id as ErrorType)))}
                />
              </div>
            </Card>

            <Card className="p-5">
              {data.trends.length > 0 ? (
                <Dumbbell
                  title={t('Mění se to?', 'Is it changing?')}
                  subtitle={t(
                    `Podíl úloh s danou chybou: předchozích ${data.windowDays} dní → posledních ${data.windowDays}`,
                    `Share of problems with the error: previous ${data.windowDays} days → last ${data.windowDays}`,
                  )}
                  beforeLabel={t('předtím', 'before')}
                  afterLabel={t('nyní', 'now')}
                  format={(value) => pct(value, t.locale)}
                  rows={data.trends.map((trend) => ({
                    id: trend.type,
                    label:
                      trend.type in FAMILY_NAMES
                        ? t(FAMILY_NAMES[trend.type as keyof typeof FAMILY_NAMES])
                        : t(ERROR_INFO[trend.type as ErrorType].title),
                    before: trend.from,
                    after: trend.to,
                  }))}
                />
              ) : (
                <>
                  <SectionLabel>{t('Mění se to?', 'Is it changing?')}</SectionLabel>
                  <p className="mt-2 text-sm text-ink-2">
                    {t(
                      'Na srovnání je potřeba aspoň 15 úloh v posledních 30 dnech a 15 ve 30 dnech před nimi. Pak tu uvidíš třeba „znaménkové chyby: 18 % → 7 %“.',
                      'A comparison needs at least 15 problems in the last 30 days and 15 in the 30 before. Then you will see things like “sign errors: 18% → 7%”.',
                    )}
                  </p>
                </>
              )}
            </Card>
          </div>

          <Card className="p-5">
            <StackedColumns
              title={t('Chyby po týdnech', 'Errors by week')}
              subtitle={t(
                'Podíl úloh daného týdne, ve kterých se chyba objevila',
                'Share of each week’s problems in which an error occurred',
              )}
              x={data.weekly.map((week) => formatDayShort(week.week, t.locale))}
              totalLabel={t('S chybou celkem', 'With an error')}
              format={(value) => pct(value, t.locale)}
              series={ERROR_FAMILIES.map((family) => ({
                id: family,
                label: t(FAMILY_NAMES[family]),
                color: FAMILY_COLOR[family],
                values: data.weekly.map((week) => (week.attempts === 0 ? 0 : week[family] / week.attempts)),
              }))}
            />
          </Card>

          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
            <Card className="p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <SectionLabel>
                  {filter
                    ? `${t('Chyby', 'Errors')}: ${t(ERROR_INFO[filter].title)}`
                    : t('Poslední chyby', 'Recent errors')}
                </SectionLabel>
                {filter && (
                  <Button size="sm" variant="ghost" onClick={() => setFilter(null)}>
                    {t('Zobrazit všechny', 'Show all')}
                  </Button>
                )}
              </div>
              {shown.length === 0 ? (
                <p className="mt-3 text-sm text-ink-3">
                  {t('Žádná taková chyba v posledních týdnech.', 'No such error in recent weeks.')}
                </p>
              ) : (
                <ul className="mt-3 divide-y divide-border">
                  {shown.map((mistake) => (
                    <Mistake
                      key={mistake.problemId}
                      mistake={mistake}
                      busy={busy === mistake.problemId}
                      onReplay={() => void start(mistake.problemId, { context: 'drill', replayOf: mistake.problemId })}
                    />
                  ))}
                </ul>
              )}
              {matching.length > 8 && (
                <Button size="sm" variant="ghost" className="mt-2" onClick={() => setShowAll((value) => !value)}>
                  {showAll
                    ? t('Zobrazit méně', 'Show fewer')
                    : t(`Zobrazit všech ${matching.length}`, `Show all ${matching.length}`)}
                </Button>
              )}
            </Card>

            <div className="space-y-5">
              {data.byTopic.length > 0 && (
                <Card className="p-5">
                  <SectionLabel>{t('Kde se chybuje', 'Where errors happen')}</SectionLabel>
                  <div className="mt-3">
                    <BarList
                      labelWidth={170}
                      rows={data.byTopic.map((topic) => ({
                        id: String(topic.topic),
                        label: `${topic.topic !== null ? `${topic.topic}. ` : ''}${t(topic.title)}`,
                        value: topic.total,
                        display: `${topic.total}×`,
                      }))}
                    />
                  </div>
                </Card>
              )}
              <CalibrationCard data={data} />
              <Card className="p-5">
                <SectionLabel>{t('Trénink na míru', 'A drill to order')}</SectionLabel>
                <p className="mt-1.5 text-[13px] text-ink-2">
                  {t(
                    'Úlohy, ve kterých se daný druh chyby dá udělat — včetně hledání chyby v cizím postupu.',
                    'Problems in which the given kind of error can be made — including finding the mistake in someone else’s working.',
                  )}
                </p>
                <DrillPicker
                  busy={busy}
                  onStart={(type) => void start(`drill-${type}`, { context: 'drill', errorType: type, count: 6 })}
                />
              </Card>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Mistake({ mistake, busy, onReplay }: { mistake: MistakeDto; busy: boolean; onReplay: () => void }) {
  const t = useT();
  const refresh = useRefresh();
  const [open, setOpen] = useState(false);
  const reclassify = async (type: ErrorType): Promise<void> => {
    await api.post(`/api/problems/${mistake.problemId}/classify`, { errorType: type });
    refresh();
  };
  return (
    <li className="py-3">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="font-mono text-xs text-ink-3">{formatDate(mistake.at, t.locale)}</span>
        <Badge tone="outline">
          <span
            aria-hidden
            className="inline-block h-2 w-2 rounded-[2px]"
            style={{ background: FAMILY_COLOR[ERROR_FAMILY[mistake.error]] }}
          />
          {t(ERROR_INFO[mistake.error].title)}
        </Badge>
        {!mistake.confirmed && <span className="text-xs text-ink-3">{t('odhad', 'a guess')}</span>}
        <Link to={`/concept/${mistake.skill}`} className="ml-auto truncate text-[13px] text-ink-2">
          {t(mistake.skillTitle)}
        </Link>
      </div>
      <button
        type="button"
        className={cn('mt-1.5 block w-full text-left text-sm', !open && 'line-clamp-2')}
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
      >
        <RichText text={t(mistake.prompt)} inlineOnly />
      </button>
      <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-ink-2">
        {mistake.inputText ? (
          <span>
            {t('tvoje: ', 'yours: ')}
            <RichText text={t(mistake.inputText)} inlineOnly />
          </span>
        ) : (
          mistake.input !== '' && (
            <span>
              {t('tvoje: ', 'yours: ')}
              <code className="rounded border border-border bg-surface-2 px-1.5 py-0.5">{mistake.input}</code>
            </span>
          )
        )}
        {mistake.answerText ? (
          <span>
            {t('správně: ', 'correct: ')}
            <RichText text={t(mistake.answerText)} inlineOnly className="text-ink" />
          </span>
        ) : (
          mistake.answerTex[t.locale] !== '' && (
            <span>
              {t('správně: ', 'correct: ')}
              <Tex tex={t(mistake.answerTex)} />
            </span>
          )
        )}
        {mistake.solvedLater && <span className="text-ink-3">{t('pak opraveno', 'then corrected')}</span>}
      </div>
      {open && (
        <div className="mt-3 space-y-3">
          {mistake.note && (
            <div className="text-[13px] text-ink-2">
              <RichText text={t(mistake.note)} />
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" onClick={onReplay} busy={busy}>
              <RotateCcw size={13} />
              {t('Zkusit tu samou úlohu znovu', 'Try the same problem again')}
            </Button>
            <label className="flex items-center gap-2 text-[13px] text-ink-2">
              {t('Byla to', 'It was')}
              <Select
                value={mistake.error}
                onChange={(event) => void reclassify(event.target.value as ErrorType)}
                className="h-8 w-auto text-[13px]"
              >
                {ERROR_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {t(ERROR_INFO[type].title)}
                  </option>
                ))}
              </Select>
            </label>
          </div>
        </div>
      )}
    </li>
  );
}

function CalibrationCard({ data }: { data: ErrorSummaryDto }) {
  const t = useT();
  const c = data.calibration;
  const sure = c.sureRight + c.sureWrong;
  const unsure = c.unsureRight + c.unsureWrong;
  if (sure + unsure < 5) return null;
  return (
    <Card className="p-5">
      <SectionLabel>{t('Jistota a skutečnost', 'Confidence and reality')}</SectionLabel>
      <table className="mt-3 w-full text-sm">
        <thead className="text-left text-xs text-ink-3">
          <tr>
            <th className="pb-1 font-normal" />
            <th className="pb-1 text-right font-normal">{t('napoprvé správně', 'right first time')}</th>
            <th className="pb-1 text-right font-normal">{t('špatně', 'wrong')}</th>
          </tr>
        </thead>
        <tbody>
          <tr className="border-t border-border">
            <th scope="row" className="py-1.5 text-left font-normal text-ink-2">
              {t('„jistě“', '“sure”')}
            </th>
            <td className="py-1.5 text-right">{c.sureRight}</td>
            <td className="py-1.5 text-right font-medium">{c.sureWrong}</td>
          </tr>
          <tr className="border-t border-border">
            <th scope="row" className="py-1.5 text-left font-normal text-ink-2">
              {t('„asi“ / „tipuju“', '“I think” / “guessing”')}
            </th>
            <td className="py-1.5 text-right">{c.unsureRight}</td>
            <td className="py-1.5 text-right">{c.unsureWrong}</td>
          </tr>
        </tbody>
      </table>
      <p className="mt-3 text-[13px] text-ink-2">
        {sure > 0 && c.sureWrong / sure >= 0.2
          ? t(
              '„Jistě, a přesto špatně“ je u tebe časté. To je přesně místo, kde pomáhá kontrola: jistota není důkaz.',
              '“Sure, yet wrong” is frequent for you. That is exactly where checking helps: certainty is not proof.',
            )
          : t(
              'Když si jsi jistý, většinou to sedí. Nejistotu ber jako signál vrátit se k postupu.',
              'When you are sure, you are mostly right. Treat uncertainty as a signal to revisit the working.',
            )}
      </p>
    </Card>
  );
}

function DrillPicker({ busy, onStart }: { busy: string | null; onStart: (type: ErrorType) => void }) {
  const t = useT();
  const [type, setType] = useState<ErrorType>('sign');
  return (
    <div className="mt-3 flex items-center gap-2">
      <Select
        value={type}
        onChange={(event) => setType(event.target.value as ErrorType)}
        aria-label={t('Druh chyby', 'Kind of error')}
      >
        {ERROR_FAMILIES.map((family) => (
          <optgroup key={family} label={t(FAMILY_NAMES[family])}>
            {ERROR_TYPES.filter((item) => ERROR_FAMILY[item] === family && item !== 'unknown').map((item) => (
              <option key={item} value={item}>
                {t(ERROR_INFO[item].title)}
              </option>
            ))}
          </optgroup>
        ))}
      </Select>
      <Button onClick={() => onStart(type)} busy={busy === `drill-${type}`} className="shrink-0">
        {t('Spustit', 'Start')}
      </Button>
    </div>
  );
}
