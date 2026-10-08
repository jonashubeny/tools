import type { DashboardDto, PlanBlockDto, StartRunResponse } from '@lemma/core';
import { ERROR_INFO } from '@lemma/core';
import { ArrowRight, BedDouble, CalendarDays, Check, Play, RotateCcw } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { api } from '../app/api';
import { Gates, SkillRow, useTitleOf } from '../app/components';
import { useT } from '../app/i18n';
import { BLOCK_NAMES, LEVEL_NAMES, reasonText } from '../app/labels';
import { useDashboard, useDay, useRefresh } from '../app/queries';
import { cn } from '../lib/cn';
import { formatDate, formatDay, formatTime, inDays, pct, plural } from '../lib/format';
import { Badge, Button, Card, ErrorNote, Loading, Meter, Notice, SectionLabel, Segmented, StatTile } from '../ui';
import { Heatmap } from '../viz/Heatmap';

type BlockStart = StartRunResponse | { redirect: 'lesson' | 'exam' | 'lab'; target: string };

export function Today() {
  const t = useT();
  const dashboard = useDashboard();
  if (dashboard.isPending) return <Loading />;
  if (dashboard.isError) return <ErrorNote error={dashboard.error} retry={() => void dashboard.refetch()} />;
  const data = dashboard.data;
  const greeting = data.name ? t(`Ahoj, ${data.name}.`, `Hello, ${data.name}.`) : t('Dnes', 'Today');

  return (
    <div>
      <header className="mb-6">
        <div className="mono-label">{formatDay(data.today, t.locale, 'long')}</div>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">{greeting}</h1>
      </header>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
        <div className="min-w-0 space-y-5">
          <PlanCard data={data} />
          <ActivityCard data={data} />
        </div>
        <div className="min-w-0 space-y-5">
          <FocusCard data={data} />
          <WeakCard data={data} />
          <RecentCard data={data} />
          <FitCard data={data} />
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------------- plan

function PlanCard({ data }: { data: DashboardDto }) {
  const t = useT();
  const navigate = useNavigate();
  const refresh = useRefresh();
  const titleOf = useTitleOf();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<unknown>(null);
  const { plan } = data;
  const required = plan.blocks.filter((block) => !block.optional);
  const next =
    plan.blocks.find((block) => block.status !== 'done' && !block.optional) ??
    plan.blocks.find((block) => block.status !== 'done');
  const allDone = required.length > 0 && required.every((block) => block.status === 'done');

  const start = async (block: PlanBlockDto): Promise<void> => {
    setBusy(block.id);
    setError(null);
    try {
      const result = await api.post<BlockStart>(`/api/plan/blocks/${block.id}/start`);
      if ('redirect' in result) {
        if (result.redirect === 'lesson') navigate(`/lesson/${result.target}`);
        else if (result.redirect === 'exam') navigate(`/exams?blueprint=${result.target}`);
        else navigate(`/lab/${result.target}`);
      } else {
        navigate(`/practice/${result.run.id}`);
      }
    } catch (failure) {
      setError(failure);
    } finally {
      setBusy(null);
    }
  };

  const setMinutes = async (minutes: number): Promise<void> => {
    await api.post('/api/plan/regenerate', { minutes });
    refresh();
  };

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <SectionLabel>{t('Dnešní sezení', 'Today’s session')}</SectionLabel>
          <div className="mt-1 text-lg font-semibold">
            {allDone
              ? t('Hotovo. Dnešní plán je splněný.', 'Done. Today’s plan is complete.')
              : plural(
                  required.reduce((sum, block) => sum + block.minutes, 0),
                  t.locale,
                  ['minuta', 'minuty', 'minut'],
                  ['minute', 'minutes'],
                )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-ink-3">{t('Kolik máš času?', 'How much time do you have?')}</span>
          <Segmented
            label={t('Délka sezení', 'Session length')}
            size="sm"
            value={String(plan.minutes)}
            onChange={(value) => void setMinutes(Number(value))}
            options={[...new Set([15, 30, 45, 60, plan.minutes])]
              .sort((a, b) => a - b)
              .map((value) => ({ value: String(value), label: `${value}` }))}
          />
        </div>
      </div>

      {plan.test && (
        <Notice
          tone="info"
          className="mt-4"
          title={`${plan.test.title || t('Test', 'Test')} ${inDays(plan.test.inDays, t.locale)}`}
        >
          {t(
            'Plán se podle něj upravil: víc opakování toho, co v testu bude.',
            'The plan has adapted to it: more review of what the test will cover.',
          )}
        </Notice>
      )}

      {plan.blocks.length === 0 ? (
        <p className="mt-4 text-sm text-ink-2">
          {t(
            'Pro dnešek není co plánovat. Vyber si něco v osnovách nebo si zkus experiment v laboratoři.',
            'Nothing to plan for today. Pick something in the syllabus or try an experiment in the Lab.',
          )}
        </p>
      ) : (
        <ol className="mt-4 space-y-2">
          {plan.blocks.map((block, index) => {
            const done = block.status === 'done';
            const isNext = next?.id === block.id;
            return (
              <li
                key={block.id}
                className={cn(
                  'rounded-lg border px-3.5 py-3',
                  isNext ? 'border-border-strong bg-surface-2' : 'border-border',
                  done && 'opacity-60',
                )}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={cn(
                      'mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full border font-mono text-xs',
                      done ? 'border-transparent bg-good-wash' : 'border-border-strong text-ink-2',
                    )}
                  >
                    {done ? (
                      <Check size={13} style={{ color: 'var(--good)' }} aria-label={t('hotovo', 'done')} />
                    ) : (
                      index + 1
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="font-medium">{t(BLOCK_NAMES[block.kind])}</span>
                      <Badge>{block.minutes} min</Badge>
                      {block.optional && <Badge tone="outline">{t('volitelné', 'optional')}</Badge>}
                      {block.status === 'active' && <Badge tone="accent">{t('rozpracováno', 'in progress')}</Badge>}
                    </div>
                    {block.skills.length > 0 && (
                      <div className="mt-0.5 truncate text-sm text-ink-2">
                        {block.skills
                          .slice(0, 3)
                          .map((skill) => t(skill.title))
                          .join(' · ')}
                        {block.skills.length > 3 && ` · +${block.skills.length - 3}`}
                      </div>
                    )}
                    <p className="mt-1.5 text-[13px] text-ink-3">
                      <span className="font-medium text-ink-2">{t('Proč: ', 'Why: ')}</span>
                      {reasonText(block, t, titleOf)}
                    </p>
                  </div>
                  {!done && (
                    <Button
                      variant={isNext ? 'primary' : 'secondary'}
                      size="sm"
                      busy={busy === block.id}
                      onClick={() => void start(block)}
                      className="shrink-0"
                    >
                      {block.status === 'active' ? <RotateCcw size={13} /> : <Play size={13} />}
                      {block.status === 'active' ? t('Pokračovat', 'Continue') : t('Spustit', 'Start')}
                    </Button>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}
      {error !== null && (
        <div className="mt-3">
          <ErrorNote error={error} />
        </div>
      )}
      {data.totals.problems === 0 && (
        <p className="mt-4 text-[13px] text-ink-3">
          {t(
            'Plán zatím vychází jen z kapitoly, kterou jsi nastavil. Po prvních úlohách se začne řídit tím, co ti jde a co ne.',
            'For now the plan is based only on the chapter you set. After the first problems it starts following what you can and cannot do.',
          )}
        </p>
      )}
    </Card>
  );
}

// ------------------------------------------------------------------------------ activity

function ActivityCard({ data }: { data: DashboardDto }) {
  const t = useT();
  const [selected, setSelected] = useState<string | null>(null);
  const [measure, setMeasure] = useState<'score' | 'forge'>('score');
  const { streak } = data;
  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SectionLabel>
          {measure === 'score'
            ? t('Aktivita — body za den', 'Activity — points per day')
            : t('Kód — příspěvky za den', 'Code — contributions per day')}
        </SectionLabel>
        {data.forge.configured && (
          <Segmented
            label={t('Co zobrazit', 'What to show')}
            size="sm"
            value={measure}
            onChange={setMeasure}
            options={[
              { value: 'score', label: t('Matematika', 'Mathematics') },
              { value: 'forge', label: t('Kód', 'Code') },
            ]}
          />
        )}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
        <StatTile
          label={t('Pravidelnost', 'Consistency')}
          value={`${streak.consistency.active}/${streak.consistency.days}`}
          sub={t('aktivních dní za 4 týdny', 'active days in 4 weeks')}
        />
        <StatTile
          label={t('Tento týden', 'This week')}
          value={`${streak.thisWeek.active}/${streak.thisWeek.goal}`}
          sub={t('dní z týdenního cíle', 'days of the weekly goal')}
        />
        <StatTile
          label={t('Série', 'Run')}
          value={streak.current}
          sub={streak.current === 1 ? t('den v řadě', 'day in a row') : t('dní v řadě', 'days in a row')}
        />
        <StatTile
          label={t('Volné dny', 'Rest days')}
          value={
            <span className="inline-flex items-center gap-1.5">
              {streak.restDays}
              <BedDouble size={16} className="text-ink-3" aria-hidden />
            </span>
          }
          sub={
            streak.restDays >= 3
              ? t('plná záloha', 'fully banked')
              : t(`další za ${streak.nextRestIn} aktivních dní`, `next after ${streak.nextRestIn} active days`)
          }
        />
      </div>

      <div className="mt-5">
        <Heatmap
          cells={data.heatmap}
          measure={measure}
          today={data.today}
          selected={selected}
          onSelect={(day) => setSelected((current) => (current === day ? null : day))}
        />
      </div>
      {measure === 'forge' && data.forge.stale && (
        <p className="mt-2 text-xs text-ink-3">
          {t(
            'Data z repozitářů se nepodařilo obnovit; zobrazuje se poslední uložená verze.',
            'Repository data could not be refreshed; the last stored copy is shown.',
          )}
        </p>
      )}
      <p className="mt-2 text-xs text-ink-3">
        {t(
          'Volný den se použije sám, když jeden den vynecháš. Získáš ho za každých šest aktivních dní.',
          'A rest day is used automatically when you skip a day. You earn one for every six active days.',
        )}
      </p>
      {selected && <DayPanel day={selected} />}
    </Card>
  );
}

function DayPanel({ day }: { day: string }) {
  const t = useT();
  const detail = useDay(day);
  return (
    <div className="mt-4 rounded-lg border border-border bg-surface-2 p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="flex items-center gap-2 font-medium">
          <CalendarDays size={15} className="text-ink-3" aria-hidden />
          {formatDay(day, t.locale, 'long')}
        </div>
        {detail.data && (
          <div className="text-sm text-ink-2">
            {detail.data.score} {t('bodů', 'points')}
            {detail.data.active ? ` · ${t('aktivní den', 'active day')}` : ''}
          </div>
        )}
      </div>
      {detail.isPending && <Loading />}
      {detail.isError && <ErrorNote error={detail.error} />}
      {detail.data &&
        (detail.data.events.length === 0 ? (
          <p className="mt-2 text-sm text-ink-3">
            {t('Ten den se nic nezaznamenalo.', 'Nothing was recorded that day.')}
          </p>
        ) : (
          <>
            <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-[13px] text-ink-2">
              <span>
                {t('úlohy', 'problems')}: <b className="text-ink">{detail.data.counts.solved}</b>/
                {detail.data.counts.problems}
              </span>
              <span>
                {t('samostatně', 'unaided')}: <b className="text-ink">{detail.data.counts.unaided}</b>
              </span>
              <span>
                {t('opravené chyby', 'errors corrected')}: <b className="text-ink">{detail.data.counts.corrected}</b>
              </span>
              <span>
                {t('opakování', 'reviews')}: <b className="text-ink">{detail.data.counts.reviews}</b>
              </span>
              <span>
                {t('lekce', 'lessons')}: <b className="text-ink">{detail.data.counts.lessons}</b>
              </span>
            </div>
            <ul className="mt-3 max-h-64 space-y-1 overflow-y-auto pr-1 text-[13px]">
              {detail.data.events.map((event, index) => (
                <li key={index} className="flex items-baseline gap-3">
                  <span className="w-11 shrink-0 font-mono text-xs text-ink-3">{formatTime(event.at, t.locale)}</span>
                  <span className="min-w-0 flex-1 truncate">
                    {t(event.title)}
                    {event.detail && <span className="text-ink-3"> · {t(event.detail)}</span>}
                  </span>
                  {event.points > 0 && <span className="shrink-0 font-mono text-xs text-ink-3">+{event.points}</span>}
                </li>
              ))}
            </ul>
          </>
        ))}
    </div>
  );
}

// --------------------------------------------------------------------------------- focus

function FocusCard({ data }: { data: DashboardDto }) {
  const t = useT();
  const { topic, skills, nextSkill } = data.focus;
  return (
    <Card className="p-5">
      <SectionLabel
        action={
          <Link to="/learn" className="text-xs">
            {t('osnovy', 'syllabus')}
          </Link>
        }
      >
        {t('Co se právě učíš', 'What you are learning now')}
      </SectionLabel>
      {topic ? (
        <>
          <div className="mt-2 flex items-baseline justify-between gap-3">
            <div className="min-w-0 font-medium">
              <span className="font-mono text-ink-3">{topic.n}.</span> {t(topic.title)}
            </div>
            <div className="shrink-0 text-sm text-ink-2">{pct(topic.progress, t.locale)}</div>
          </div>
          <Meter
            value={topic.progress}
            className="mt-2"
            label={t('Postup kapitolou', 'Progress through the chapter')}
          />
          <div className="-mx-2 mt-3">
            {skills.map((skill) => (
              <SkillRow key={skill.id} skill={skill} />
            ))}
          </div>
        </>
      ) : (
        <p className="mt-2 text-sm text-ink-2">{t('Není nastavená žádná kapitola.', 'No chapter is set.')}</p>
      )}

      {nextSkill && nextSkill.next && (
        <div className="mt-4 border-t border-border pt-4">
          <div className="text-[13px] text-ink-2">
            <Link to={`/concept/${nextSkill.id}`} className="font-medium text-ink">
              {t(nextSkill.title)}
            </Link>{' '}
            {t('— co ještě chybí k úrovni', '— what is still needed for')} „{t(LEVEL_NAMES[nextSkill.next.level])}“:
          </div>
          <Gates level={nextSkill.next.level} gates={nextSkill.next.gates} className="mt-2" />
        </div>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------------------------- weak

function WeakCard({ data }: { data: DashboardDto }) {
  const t = useT();
  const navigate = useNavigate();
  const { weak, slipRate } = data;
  const nothing = weak.skills.length === 0 && !weak.error && weak.fading.length === 0;
  const drill = async (): Promise<void> => {
    if (!weak.error) return;
    const started = await api.post<StartRunResponse>('/api/practice/start', {
      context: 'drill',
      errorType: weak.error.type,
    });
    navigate(`/practice/${started.run.id}`);
  };
  return (
    <Card className="p-5">
      <SectionLabel
        action={
          <Link to="/errors" className="text-xs">
            {t('laboratoř chyb', 'Error Lab')}
          </Link>
        }
      >
        {t('Kde to drhne', 'Where it catches')}
      </SectionLabel>
      {nothing && (
        <p className="mt-2 text-sm text-ink-2">
          {t(
            'Zatím není z čeho soudit. Slabá místa se ukážou po prvních úlohách.',
            'Nothing to judge from yet. Weak spots show up after the first problems.',
          )}
        </p>
      )}

      {weak.error && (
        <div className="mt-3 rounded-lg border border-border bg-surface-2 p-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-sm font-medium">{t(ERROR_INFO[weak.error.type].title)}</div>
              <div className="mt-0.5 text-[13px] text-ink-2">
                {t(
                  `${weak.error.count}× v posledních úlohách s chybou`,
                  `${weak.error.count} times among recent problems with an error`,
                )}{' '}
                ({pct(weak.error.share, t.locale)})
              </div>
              <div className="mt-1.5 text-[13px] text-ink-3">{t(ERROR_INFO[weak.error.type].remedy)}</div>
            </div>
            <Button size="sm" onClick={() => void drill()} className="shrink-0">
              {t('Trénovat', 'Drill')}
            </Button>
          </div>
        </div>
      )}

      {slipRate.recent !== null && (
        <div className="mt-3 text-[13px] text-ink-2">
          {t('Úlohy pokažené nepozorností: ', 'Problems spoiled by a slip: ')}
          <b className="text-ink">{pct(slipRate.recent, t.locale)}</b>
          {slipRate.previous !== null && (
            <span className="text-ink-3">
              {' '}
              ({t('předtím', 'before')} {pct(slipRate.previous, t.locale)})
            </span>
          )}
        </div>
      )}

      {weak.skills.length > 0 && (
        <div className="mt-3">
          <div className="text-xs text-ink-3">{t('Nejdál od zvládnutí', 'Furthest from proficient')}</div>
          <div className="-mx-2 mt-1">
            {weak.skills.map((skill) => (
              <SkillRow key={skill.id} skill={skill} />
            ))}
          </div>
        </div>
      )}
      {weak.fading.length > 0 && (
        <div className="mt-3">
          <div className="text-xs text-ink-3">{t('Začíná se vytrácet z paměti', 'Starting to fade from memory')}</div>
          <div className="-mx-2 mt-1">
            {weak.fading.map((skill) => (
              <SkillRow key={skill.id} skill={skill} detail="due" />
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}

// -------------------------------------------------------------------------------- recent

function RecentCard({ data }: { data: DashboardDto }) {
  const t = useT();
  return (
    <Card className="p-5">
      <SectionLabel>{t('Co se povedlo', 'What went well')}</SectionLabel>
      {data.recent.length === 0 ? (
        <p className="mt-2 text-sm text-ink-2">
          {t(
            'Tady se budou objevovat nové úrovně, dokončené lekce a opravené chyby.',
            'New levels, finished lessons and corrected errors will appear here.',
          )}
        </p>
      ) : (
        <ul className="mt-2 space-y-1.5">
          {data.recent.map((item, index) => (
            <li key={index} className="flex items-baseline gap-3 text-[13px]">
              <span className="w-12 shrink-0 font-mono text-xs text-ink-3">{formatDate(item.at, t.locale)}</span>
              <span className="min-w-0 flex-1">
                <span className="text-ink">{t(item.title)}</span>
                {item.detail && <span className="text-ink-2"> · {t(item.detail)}</span>}
              </span>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 border-t border-border pt-3 text-[13px] text-ink-2">
        <span>
          <b className="text-ink">{data.totals.solved}</b> {t('vyřešených úloh', 'problems solved')}
        </span>
        <span>
          <b className="text-ink">{data.totals.activeDays}</b> {t('aktivních dní', 'active days')}
        </span>
        <span>
          <b className="text-ink">
            {data.totals.skillsProficient}/{data.totals.skillsTotal}
          </b>{' '}
          {t('dovedností ovládnuto', 'skills proficient')}
        </span>
      </div>
    </Card>
  );
}

// ----------------------------------------------------------------------------------- FIT

function FitCard({ data }: { data: DashboardDto }) {
  const t = useT();
  const { fit } = data;
  return (
    <Card className="p-5">
      <SectionLabel>{t('Směr FIT VUT', 'Towards FIT VUT')}</SectionLabel>
      <div className="mt-3 space-y-3">
        <div>
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span>{t('Letošní školní osnovy', 'This year’s school syllabus')}</span>
            <span className="text-ink-2">{pct(fit.schoolProgress, t.locale)}</span>
          </div>
          <Meter value={fit.schoolProgress} className="mt-1.5" />
        </div>
        <div>
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span>{t('Látka, kterou FIT sám opakuje v ISM', 'What FIT itself revises in its ISM seminar')}</span>
            <span className="text-ink-2">{pct(fit.bridgeCoverage, t.locale)}</span>
          </div>
          <Meter value={fit.bridgeCoverage} className="mt-1.5" />
          <div className="mt-1 text-xs text-ink-3">
            {t('podíl dovedností aspoň na úrovni „známá“', 'share of skills at “familiar” or better')}
          </div>
        </div>
      </div>
      {fit.stale && (
        <Notice tone="warning" className="mt-3">
          {t(
            'Údaje o FIT jsou starší než rok. Ověř je na webu fakulty.',
            'The FIT data is over a year old. Check it against the faculty’s website.',
          )}
        </Notice>
      )}
      <Link to="/fit" className="mt-3 inline-flex items-center gap-1 text-sm">
        {t('Cesta k FIT a zdroje', 'The road to FIT, with sources')}
        <ArrowRight size={14} aria-hidden />
      </Link>
      <div className="mt-1 text-xs text-ink-3">
        {t('Oficiální údaje načteny', 'Official data retrieved')} {formatDay(fit.retrievedOn, t.locale)} ·{' '}
        {t('pravidla se každý rok mění', 'the rules change every year')}
      </div>
    </Card>
  );
}
