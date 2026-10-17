import {
  AREAS,
  ASSIGNMENT_KINDS,
  ERROR_INFO,
  type AssignmentKind,
  type GoalId,
  type HistoryItemDto,
  type SkillDto,
  type StudentDetailDto,
  type TeachSessionDto,
} from '@lemma/core';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, CircleAlert, Lightbulb, MessageSquare, Presentation, Trash2 } from 'lucide-react';
import { type FormEvent, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { api } from '../app/api';
import { Gates, PathBadge } from '../app/components';
import { useT } from '../app/i18n';
import {
  AREA_NAMES,
  ASSIGNMENT_NAMES,
  CONFIDENCE_NAMES,
  CONTEXT_NAMES,
  LEVEL_NAMES,
  PATH_REASONS,
  PURPOSE_NAMES,
  ROLE_NAMES,
  VERDICT_NAMES,
  errorName,
  whyText,
} from '../app/labels';
import { studentUrl, useGoals, useStudent, useStudentConcept, useStudentHistory } from '../app/queries';
import { attentionText, displayName, interventionText } from '../app/teach-labels';
import { Figure } from '../figure/Figure';
import { cn } from '../lib/cn';
import { clock, formatDate, formatDateTime, formatDay, formatDayShort, inDays, pct, plural } from '../lib/format';
import { RichText, Tex } from '../lib/Math';
import {
  Badge,
  Button,
  Card,
  ErrorNote,
  Field,
  IconButton,
  Loading,
  Notice,
  Overlay,
  SectionLabel,
  Segmented,
  Select,
  StatTile,
  StatusIcon,
  TextInput,
} from '../ui';
import { Heatmap } from '../viz/Heatmap';
import { BarList, LevelBar } from '../viz/charts';
import { ReadinessParts, examCountdown } from '../app/readiness-parts';

/** One learner, as their teacher sees them: the overview, every skill, the history, and what was set. */

type Tab = 'overview' | 'skills' | 'history' | 'work';

/** Run a change for this learner, then refetch everything about teaching. */
function useAct(): { act: (run: () => Promise<unknown>) => Promise<boolean>; busy: boolean; error: unknown } {
  const client = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const act = async (run: () => Promise<unknown>): Promise<boolean> => {
    setBusy(true);
    setError(null);
    try {
      await run();
      await client.invalidateQueries({ queryKey: ['teach'] });
      return true;
    } catch (failure) {
      setError(failure);
      return false;
    } finally {
      setBusy(false);
    }
  };
  return { act, busy, error };
}

export function Student() {
  const { student: name } = useParams();
  const t = useT();
  const navigate = useNavigate();
  const query = useStudent(name);
  const [tab, setTab] = useState<Tab>('overview');
  const [starting, setStarting] = useState(false);
  if (query.isPending) return <Loading />;
  if (query.isError) return <ErrorNote error={query.error} retry={() => void query.refetch()} />;
  const data = query.data;
  const session = async (): Promise<void> => {
    setStarting(true);
    try {
      const started = await api.post<TeachSessionDto>(`${studentUrl(data.username)}/sessions`);
      navigate(`/teach/${data.username}/session/${started.id}`);
    } finally {
      setStarting(false);
    }
  };

  return (
    <div>
      <Link to="/teach" className="mb-3 inline-flex items-center gap-1 text-sm text-ink-2">
        <ArrowLeft size={14} aria-hidden />
        {t('Žáci', 'Students')}
      </Link>
      <header className="mb-5 flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div className="min-w-0">
          <div className="mono-label">{data.username}</div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">{displayName(data)}</h1>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-2">
            <span>{t(data.goal.title)}</span>
            {data.readiness && (
              <span>
                {examCountdown(data.readiness, t) ?? t('termín zkoušky nenastaven', 'no examination date set')}
              </span>
            )}
            <span className="text-ink-3">
              {data.lastActiveAt === null
                ? t('zatím žádná úloha', 'no problem yet')
                : `${t('naposledy', 'last active')} ${formatDateTime(data.lastActiveAt, t.locale)}`}
            </span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="primary" busy={starting} onClick={() => void session()}>
            <Presentation size={14} />
            {t('Doučování', 'Tutoring session')}
          </Button>
        </div>
      </header>

      <div className="mb-5">
        <Segmented
          label={t('Pohled', 'View')}
          value={tab}
          onChange={setTab}
          options={[
            { value: 'overview', label: t('Přehled', 'Overview') },
            { value: 'skills', label: t('Dovednosti', 'Skills') },
            { value: 'history', label: t('Řešení', 'Solutions') },
            { value: 'work', label: t('Zadání a poznámky', 'Work and notes') },
          ]}
        />
      </div>

      {tab === 'overview' && <Overview data={data} />}
      {tab === 'skills' && <Skills data={data} />}
      {tab === 'history' && <History data={data} />}
      {tab === 'work' && <Work data={data} />}
    </div>
  );
}

// ------------------------------------------------------------------------------ overview

function Overview({ data }: { data: StudentDetailDto }) {
  const t = useT();
  const next = interventionText(data.intervention, t);
  const totals = data.totals;
  const diagnostic = data.diagnostics[0];
  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
      <div className="min-w-0 space-y-5">
        <Card className="p-5">
          <SectionLabel>{t('Co teď udělat', 'What to do next')}</SectionLabel>
          <div className="mt-2 text-lg font-semibold">{next.title}</div>
          <p className="mt-1 text-sm text-ink-2">{next.why}</p>
          {data.attention.length > 0 && (
            <ul className="mt-4 space-y-1.5 border-t border-border pt-3 text-sm text-ink-2">
              {data.attention.map((flag, index) => (
                <li key={index} className="flex gap-2">
                  <CircleAlert size={15} className="mt-0.5 shrink-0 text-ink-3" aria-hidden />
                  <span>{attentionText(flag, t)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="p-5">
          <SectionLabel>{t('Zlepšuje se to?', 'Is it improving?')}</SectionLabel>
          <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
            <StatTile
              label={t('Úlohy celkem', 'Problems in all')}
              value={totals.problems}
              sub={`${totals.solved} ${t('vyřešeno', 'solved')}`}
            />
            <StatTile
              label={t('Napoprvé', 'First try')}
              value={totals.problems === 0 ? '—' : pct(totals.firstTry / totals.problems, t.locale)}
              sub={t('správně na první odeslání', 'right at the first submission')}
            />
            <StatTile
              label={t('Bez pomoci', 'Unaided')}
              value={pct(totals.unaidedRate, t.locale)}
              sub={`${totals.hinted}× ${t('s nápovědou', 'with a hint')}`}
            />
            <StatTile
              label={t('Opakování po čase', 'Reviews after a gap')}
              value={
                totals.reviewsPassed + totals.reviewsFailed === 0
                  ? '—'
                  : `${totals.reviewsPassed}/${totals.reviewsPassed + totals.reviewsFailed}`
              }
              sub={
                totals.reviewsPassed + totals.reviewsFailed === 0
                  ? t('žádné zatím nepřišlo na řadu', 'none has come due yet')
                  : t('povedená z těch, která přišla na řadu', 'passed of those that came due')
              }
            />
          </div>
          <table className="mt-5 w-full text-sm">
            <thead className="text-left text-xs text-ink-3">
              <tr>
                <th className="pb-1.5 font-normal">{t('Týden od', 'Week of')}</th>
                <th className="pb-1.5 text-right font-normal">{t('Úlohy', 'Problems')}</th>
                <th className="pb-1.5 text-right font-normal">{t('Napoprvé', 'First try')}</th>
                <th className="pb-1.5 text-right font-normal">{t('S nápovědou', 'With hints')}</th>
                <th className="pb-1.5 text-right font-normal">{t('Dny', 'Days')}</th>
                <th
                  className="pb-1.5 text-right font-normal"
                  title={t(
                    'Součet času nad úlohami; skutečný čas učení je delší.',
                    'The sum of time on problems; real learning time is longer.',
                  )}
                >
                  {t('Čas ≥', 'Time ≥')}
                </th>
              </tr>
            </thead>
            <tbody>
              {data.weekly.map((week) => (
                <tr key={week.week} className={cn('border-t border-border', week.problems === 0 && 'text-ink-3')}>
                  <td className="py-1.5">{formatDayShort(week.week, t.locale)}</td>
                  <td className="py-1.5 text-right tabular-nums">{week.problems}</td>
                  <td className="py-1.5 text-right tabular-nums">
                    {week.problems === 0 ? '—' : pct(week.firstTry / week.problems, t.locale)}
                  </td>
                  <td className="py-1.5 text-right tabular-nums">{week.hinted}</td>
                  <td className="py-1.5 text-right tabular-nums">{week.activeDays}</td>
                  <td className="py-1.5 text-right tabular-nums">{week.minutes} min</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-xs text-ink-3">
            {t(
              'Čas je součet času nad úlohami — spodní odhad, ne měření. Přemýšlení mimo aplikaci v něm není, a odběhnutí od otevřené úlohy naopak ano.',
              'Time is the sum of time on problems — a floor, not a measurement. Thinking away from the app is not in it, and walking away from an open problem is.',
            )}
          </p>
          <div className="mt-4">
            <Heatmap
              cells={data.heatmap}
              measure="score"
              today={data.heatmap[data.heatmap.length - 1]?.day ?? ''}
              selected={null}
              onSelect={() => undefined}
            />
          </div>
        </Card>

        <Card className="p-5">
          <SectionLabel>{t('Podle oblastí', 'By area')}</SectionLabel>
          <table className="mt-2 w-full text-sm">
            <thead className="text-left text-xs text-ink-3">
              <tr>
                <th className="pb-1.5 font-normal">{t('Oblast', 'Area')}</th>
                <th className="pb-1.5 text-right font-normal">{t('Postup', 'Progress')}</th>
                <th className="pb-1.5 text-right font-normal">{t('Úlohy', 'Problems')}</th>
                <th className="pb-1.5 text-right font-normal">{t('Vyřešeno', 'Solved')}</th>
                <th className="pb-1.5 text-right font-normal">{t('Napoprvé', 'First try')}</th>
              </tr>
            </thead>
            <tbody>
              {data.areas.map((area) => (
                <tr key={area.area} className="border-t border-border">
                  <td className="py-1.5">{t(AREA_NAMES[area.area])}</td>
                  <td className="py-1.5 text-right tabular-nums">{pct(area.progress, t.locale)}</td>
                  <td className="py-1.5 text-right tabular-nums">{area.attempts}</td>
                  <td className="py-1.5 text-right tabular-nums">{pct(area.accuracy, t.locale)}</td>
                  <td className="py-1.5 text-right tabular-nums">{pct(area.firstTry, t.locale)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-3 text-[13px] text-ink-2">
            {t('Na čas a bez času zvlášť', 'Timed and untimed, apart')}: {t('procvičování', 'practice')}{' '}
            {data.timed.untimed.problems} {t('úloh', 'problems')}, {pct(data.timed.untimed.firstTry, t.locale)}{' '}
            {t('napoprvé', 'first try')} · {t('testy', 'tests')} {data.timed.timed.problems} {t('úloh', 'problems')},{' '}
            {pct(data.timed.timed.firstTry, t.locale)} {t('napoprvé', 'first try')}
          </p>
        </Card>

        {(data.errors.length > 0 || data.misconceptions.length > 0 || data.errorsUndetermined.recent > 0) && (
          <Card className="p-5">
            <SectionLabel>{t('Chyby a mylné představy', 'Errors and misconceptions')}</SectionLabel>
            {data.misconceptions.length > 0 && (
              <ul className="mt-2 space-y-2.5">
                {data.misconceptions.map((entry, index) => (
                  <li key={index} className="rounded-lg border border-border bg-surface-2 p-3 text-sm">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <span className="font-medium">{t(entry.skill.title)}</span>
                      <span className="font-mono text-xs text-ink-3">
                        {entry.count}× · {t(errorName(entry.error)).toLowerCase()} ·{' '}
                        {formatDate(entry.lastAt, t.locale)}
                      </span>
                    </div>
                    <div className="mt-1 text-ink-2">
                      <RichText text={t(entry.note)} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
            {data.errors.length > 0 && (
              <div className="mt-4">
                <div className="mb-2 text-xs text-ink-3">
                  {t(
                    'Druhy chyb za posledních 30 dní (v závorce 30 dní předtím) — jen kde druh z odpovědi plyne nebo byl potvrzen',
                    'Kinds of error in the last 30 days (the 30 days before in brackets) — only where the kind follows from the answer or was confirmed',
                  )}
                </div>
                <BarList
                  labelWidth={190}
                  rows={data.errors.slice(0, 7).map((entry) => ({
                    id: entry.type,
                    label: t(ERROR_INFO[entry.type].title),
                    value: entry.recent,
                    display: `${entry.recent}× (${entry.previous}×)`,
                  }))}
                />
              </div>
            )}
            {data.errorsUndetermined.recent + data.errorsUndetermined.previous > 0 && (
              <p className="mt-3 text-[13px] text-ink-3">
                {t(
                  `U dalších ${data.errorsUndetermined.recent} chyb (předtím ${data.errorsUndetermined.previous}) se druh z odpovědi poznat nedal. V Laboratoři chyb je lze označit ručně.`,
                  `For another ${data.errorsUndetermined.recent} errors (${data.errorsUndetermined.previous} before) the kind could not be told from the answer. They can be labelled by hand in the Error Lab.`,
                )}
              </p>
            )}
          </Card>
        )}
      </div>

      <div className="min-w-0 space-y-5">
        {data.readiness && (
          <Card className="p-5">
            <SectionLabel>{t('Připravenost na zkoušku', 'Readiness for the examination')}</SectionLabel>
            <ReadinessParts readiness={data.readiness} className="mt-3" />
            {data.readiness.gaps.length > 0 && (
              <div className="mt-4 border-t border-border pt-3">
                <div className="text-xs text-ink-3">
                  {t('Mezery, které něco blokují', 'Gaps that hold something up')}
                </div>
                <ul className="mt-1 space-y-1 text-sm">
                  {data.readiness.gaps.map((gap) => (
                    <li key={gap.id}>
                      {data.readiness!.titles[gap.id] ? t(data.readiness!.titles[gap.id]!) : gap.id}
                      {gap.holdsUp.length > 0 && (
                        <span className="text-ink-3">
                          {' → '}
                          {gap.holdsUp
                            .map((id) => (data.readiness!.titles[id] ? t(data.readiness!.titles[id]!) : id))
                            .join(', ')}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Card>
        )}

        <Card className="p-5">
          <SectionLabel>{t('Cesta: co přijde na řadu', 'The path: what comes next')}</SectionLabel>
          {data.path.length === 0 ? (
            <p className="mt-2 text-sm text-ink-2">{t('Nic nečeká.', 'Nothing is waiting.')}</p>
          ) : (
            <ol className="mt-2 divide-y divide-border">
              {data.path.map((step, index) => (
                <li key={step.skill.id} className="flex gap-3 py-2">
                  <span className="mt-0.5 w-4 shrink-0 font-mono text-xs text-ink-3">{index + 1}</span>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <span className="font-medium">{t(step.skill.title)}</span>
                      <Badge>{t(PURPOSE_NAMES[step.purpose])}</Badge>
                    </div>
                    <div className="text-[13px] text-ink-2">{whyText(step, t)}</div>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </Card>

        <Card className="p-5">
          <SectionLabel>{t('Co umí a co leží ladem', 'Strengths, and what lies fallow')}</SectionLabel>
          <div className="mt-2 text-xs text-ink-3">{t('Nejsilnější', 'Strongest')}</div>
          {data.strongest.length === 0 ? (
            <p className="text-sm text-ink-2">{t('Zatím nic na úrovni „známá“.', 'Nothing at “familiar” yet.')}</p>
          ) : (
            <ul className="mt-1 space-y-1 text-sm">
              {data.strongest.map((skill) => (
                <li key={skill.id} className="flex items-center justify-between gap-3">
                  <span className="min-w-0 truncate">{t(skill.title)}</span>
                  <LevelBar level={skill.level} size="sm" />
                </li>
              ))}
            </ul>
          )}
          {data.neglected.length > 0 && (
            <>
              <div className="mt-4 text-xs text-ink-3">
                {t('Dlouho nebo vůbec neprocvičeno', 'Not practised for long, or at all')}
              </div>
              <ul className="mt-1 space-y-1 text-sm">
                {data.neglected.map((skill) => (
                  <li key={skill.id} className="flex items-center justify-between gap-3">
                    <span className="min-w-0 truncate">{t(skill.title)}</span>
                    <span className="shrink-0 text-xs text-ink-3">
                      {skill.daysSince === null ? t('nikdy', 'never') : inDays(-skill.daysSince, t.locale)}
                      {skill.weight > 0 && ` · ${pct(skill.weight, t.locale, 1)}`}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </Card>

        <Card className="p-5">
          <SectionLabel>{t('Rozřazovací test', 'Placement test')}</SectionLabel>
          {!diagnostic ? (
            <p className="mt-2 text-sm text-ink-2">{t('Zatím neproběhl.', 'Not taken yet.')}</p>
          ) : (
            <>
              <p className="mt-2 text-[13px] text-ink-2">
                {formatDateTime(diagnostic.finishedAt ?? diagnostic.startedAt, t.locale)} · {diagnostic.counts.correct}/
                {diagnostic.counts.asked} {t('správně', 'correct')}
                {data.diagnostics.length > 1 && ` · ${t('celkem testů', 'tests in all')}: ${data.diagnostics.length}`}
              </p>
              <ul className="mt-2 space-y-1 text-sm">
                {diagnostic.verdicts.map((entry) => (
                  <li key={entry.skill} className="flex items-center justify-between gap-3">
                    <span className="min-w-0 truncate">{t(entry.title)}</span>
                    <span className="flex shrink-0 items-center gap-1.5 text-[13px] text-ink-2">
                      <StatusIcon
                        tone={
                          entry.verdict === 'gap'
                            ? 'serious'
                            : entry.verdict === 'shaky'
                              ? 'warning'
                              : entry.verdict === 'untested'
                                ? 'info'
                                : 'good'
                        }
                        size={14}
                      />
                      {t(VERDICT_NAMES[entry.verdict])}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </Card>

        <Card className="p-5">
          <SectionLabel>{t('Testy nanečisto', 'Practice tests')}</SectionLabel>
          {data.exams.filter((exam) => exam.finishedAt !== null).length === 0 ? (
            <p className="mt-2 text-sm text-ink-2">{t('Zatím žádný dokončený.', 'None finished yet.')}</p>
          ) : (
            <ul className="mt-2 divide-y divide-border text-sm">
              {data.exams
                .filter((exam) => exam.finishedAt !== null)
                .map((exam) => (
                  <li key={exam.id} className="flex items-center justify-between gap-3 py-2">
                    <span className="min-w-0">
                      <span className="block truncate">{t(exam.title)}</span>
                      <span className="mono-label">{formatDateTime(exam.startedAt, t.locale)}</span>
                    </span>
                    <span className="shrink-0 font-semibold tabular-nums">
                      {exam.points !== null && exam.maxPoints !== null
                        ? `${exam.points}/${exam.maxPoints}`
                        : pct((exam.percent ?? 0) / 100, t.locale)}
                    </span>
                  </li>
                ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}

// -------------------------------------------------------------------------------- skills

function Skills({ data }: { data: StudentDetailDto }) {
  const t = useT();
  const [open, setOpen] = useState<SkillDto | null>(null);
  const areas = AREAS.map((area) => ({ area, skills: data.skills.filter((skill) => skill.area === area) })).filter(
    (group) => group.skills.length > 0,
  );
  return (
    <>
      <div className="grid gap-5 lg:grid-cols-2">
        {areas.map((group) => (
          <Card key={group.area} className="p-5">
            <h3 className="font-semibold">{t(AREA_NAMES[group.area])}</h3>
            <ul className="mt-2 divide-y divide-border">
              {group.skills.map((skill) => (
                <li key={skill.id}>
                  <button
                    type="button"
                    onClick={() => setOpen(skill)}
                    className="flex w-full items-center gap-3 py-2 text-left hover:bg-surface-2"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm">{t(skill.title)}</span>
                      <span className="block text-xs text-ink-3">
                        {skill.role && t(ROLE_NAMES[skill.role])}
                        {skill.role === 'tested' && skill.weight > 0 && ` · ${pct(skill.weight, t.locale, 1)}`}
                        {` · ${plural(skill.attempts, t.locale, ['úloha', 'úlohy', 'úloh'], ['problem', 'problems'])}`}
                        {` · ${t(CONFIDENCE_NAMES[skill.confidence])}`}
                      </span>
                    </span>
                    {skill.paperOnly ? (
                      <Badge tone="outline">{t('na papíře', 'on paper')}</Badge>
                    ) : (
                      <>
                        <PathBadge state={skill.path} reason={skill.pathReason} className="hidden sm:inline-flex" />
                        <LevelBar level={skill.level} size="sm" />
                      </>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          </Card>
        ))}
      </div>
      {open && <SkillPanel data={data} skill={open} onClose={() => setOpen(null)} />}
    </>
  );
}

/** One skill of the learner in full, with what the teacher can do about it. */
function SkillPanel({ data, skill, onClose }: { data: StudentDetailDto; skill: SkillDto; onClose: () => void }) {
  const t = useT();
  const detail = useStudentConcept(data.username, skill.id);
  const { act, busy, error } = useAct();
  const [done, setDone] = useState<string | null>(null);
  const base = studentUrl(data.username);
  const assign = (kind: AssignmentKind, label: string) => async (): Promise<void> => {
    if (await act(() => api.post(`${base}/assignments`, { kind, skills: [skill.id] }))) setDone(label);
  };
  const focus = (kind: 'difficulty' | 'covered', label: string) => async (): Promise<void> => {
    if (await act(() => api.put(`${base}/focus/${encodeURIComponent(skill.id)}`, { kind }))) setDone(label);
  };
  return (
    <Overlay open onClose={onClose} title={t(skill.title)} width={520}>
      <div className="flex flex-wrap items-center gap-3">
        <LevelBar level={skill.level} showName />
        <PathBadge state={skill.path} />
      </div>
      <p className="mt-1.5 text-sm text-ink-2">{t(PATH_REASONS[skill.pathReason])}</p>
      {detail.isPending && <Loading />}
      {detail.isError && <ErrorNote error={detail.error} />}
      {detail.data && (
        <>
          {detail.data.next && (
            <div className="mt-4">
              <div className="text-[13px] font-medium text-ink-2">
                {t('Co chybí k úrovni', 'What is missing for')} „{t(LEVEL_NAMES[detail.data.next.level])}“
              </div>
              <Gates level={detail.data.next.level} gates={detail.data.next.gates} className="mt-2" />
            </div>
          )}
          <dl className="mt-4 grid grid-cols-3 gap-3 border-t border-border pt-4 text-sm">
            <div>
              <dt className="mono-label">{t('Úlohy', 'Problems')}</dt>
              <dd className="mt-0.5 font-semibold">
                {detail.data.stats.solved}/{detail.data.stats.attempts}
              </dd>
            </div>
            <div>
              <dt className="mono-label">{t('Napoprvé', 'First try')}</dt>
              <dd className="mt-0.5 font-semibold">{detail.data.record.firstTry}</dd>
            </div>
            <div>
              <dt className="mono-label">{t('S nápovědou', 'With hints')}</dt>
              <dd className="mt-0.5 font-semibold">{detail.data.record.hinted}</dd>
            </div>
            <div>
              <dt className="mono-label">{t('Typy úloh', 'Kinds')}</dt>
              <dd className="mt-0.5 font-semibold">
                {detail.data.record.families}/{detail.data.record.familyCap}
              </dd>
            </div>
            <div>
              <dt className="mono-label">{t('Dny', 'Days')}</dt>
              <dd className="mt-0.5 font-semibold">{detail.data.record.days}</dd>
            </div>
            <div>
              <dt className="mono-label">{t('Opakování', 'Reviews')}</dt>
              <dd className="mt-0.5 font-semibold">
                {detail.data.record.reviews.passed}/
                {detail.data.record.reviews.passed + detail.data.record.reviews.failed}
              </dd>
            </div>
          </dl>
          {detail.data.errors.length > 0 && (
            <p className="mt-3 text-[13px] text-ink-2">
              {t('Chyby', 'Errors')}:{' '}
              {detail.data.errors
                .map((entry) => `${t(errorName(entry.type)).toLowerCase()} ${entry.count}×`)
                .join(', ')}
            </p>
          )}
        </>
      )}

      {!skill.paperOnly && (
        <div className="mt-5 border-t border-border pt-4">
          <div className="mono-label mb-2">{t('Zadat', 'Assign')}</div>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              disabled={busy}
              onClick={() => void assign('practice', t('Procvičení zadáno.', 'Practice assigned.'))()}
            >
              {t('Procvičení', 'Practice')}
            </Button>
            <Button
              size="sm"
              disabled={busy}
              onClick={() => void assign('remediation', t('Doplnění základu zadáno.', 'Catching up assigned.'))()}
            >
              {t('Doplnění základu', 'Catching up')}
            </Button>
            <Button
              size="sm"
              disabled={busy}
              onClick={() => void assign('lesson', t('Výklad doporučen.', 'Lesson recommended.'))()}
            >
              {t('Výklad a řešený příklad', 'Lesson and worked example')}
            </Button>
          </div>
          <div className="mono-label mt-4 mb-2">{t('Vrátit se k tomu', 'Come back to it')}</div>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              disabled={busy}
              onClick={() => void focus('difficulty', t('Označeno: dělá potíže.', 'Marked: causes difficulty.'))()}
            >
              {t('Dělá potíže', 'Causes difficulty')}
            </Button>
            <Button
              size="sm"
              disabled={busy}
              onClick={() =>
                void focus('covered', t('Označeno: probráno, ověřit.', 'Marked: covered, to be checked.'))()
              }
            >
              {t('Probráno, ověřit', 'Covered, check it')}
            </Button>
          </div>
          <p className="mt-2 text-xs text-ink-3">
            {t(
              'Označení posune dovednost dopředu ve výběru úloh na dva týdny. Úroveň nemění: tu mění jen vlastní samostatná práce.',
              'A mark moves the skill forward in the selection for two weeks. It changes no level: only the learner’s own work does.',
            )}
          </p>
          {done && (
            <Notice tone="good" className="mt-3">
              {done}
            </Notice>
          )}
          {error !== null && (
            <div className="mt-3">
              <ErrorNote error={error} />
            </div>
          )}
        </div>
      )}
    </Overlay>
  );
}

// ------------------------------------------------------------------------------- history

function History({ data }: { data: StudentDetailDto }) {
  const t = useT();
  const [skill, setSkill] = useState('');
  const [mistakes, setMistakes] = useState<'all' | 'mistakes'>('all');
  const [before, setBefore] = useState<number[]>([]);
  const cursor = before[before.length - 1];
  const query = new URLSearchParams({ limit: '20' });
  if (skill) query.set('skill', skill);
  if (mistakes === 'mistakes') query.set('mistakes', '1');
  if (cursor) query.set('before', String(cursor));
  const history = useStudentHistory(data.username, query.toString());
  const reset = (): void => setBefore([]);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Select
          value={skill}
          onChange={(event) => {
            setSkill(event.target.value);
            reset();
          }}
          className="w-64"
          aria-label={t('Dovednost', 'Skill')}
        >
          <option value="">{t('Všechny dovednosti', 'Every skill')}</option>
          {data.skills
            .filter((entry) => entry.attempts > 0)
            .map((entry) => (
              <option key={entry.id} value={entry.id}>
                {t(entry.title)}
              </option>
            ))}
        </Select>
        <Segmented
          label={t('Které úlohy', 'Which problems')}
          size="sm"
          value={mistakes}
          onChange={(value) => {
            setMistakes(value);
            reset();
          }}
          options={[
            { value: 'all', label: t('všechny', 'all') },
            { value: 'mistakes', label: t('jen s chybou', 'with an error') },
          ]}
        />
      </div>
      {history.isPending && <Loading />}
      {history.isError && <ErrorNote error={history.error} />}
      {history.data && history.data.length === 0 && (
        <p className="text-sm text-ink-2">{t('Žádné úlohy pro tento výběr.', 'No problems for this selection.')}</p>
      )}
      {history.data && history.data.length > 0 && (
        <Card className="divide-y divide-border">
          {history.data.map((item) => (
            <HistoryRow key={item.problemId} item={item} />
          ))}
        </Card>
      )}
      <div className="mt-4 flex gap-2">
        {before.length > 0 && (
          <Button size="sm" onClick={() => setBefore((list) => list.slice(0, -1))}>
            {t('Novější', 'Newer')}
          </Button>
        )}
        {history.data && history.data.length === 20 && (
          <Button size="sm" onClick={() => setBefore((list) => [...list, history.data[history.data.length - 1]!.at])}>
            {t('Starší', 'Older')}
          </Button>
        )}
      </div>
    </div>
  );
}

function HistoryRow({ item }: { item: HistoryItemDto }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const tone =
    item.status === 'solved' ? (item.firstTry ? 'good' : 'warning') : item.status === 'skipped' ? 'info' : 'critical';
  const verdict =
    item.status === 'solved'
      ? item.firstTry
        ? t('správně napoprvé', 'right first time')
        : t('správně po opravě', 'right after a correction')
      : item.status === 'skipped'
        ? t('bez odpovědi', 'no answer')
        : t('nevyřešeno', 'not solved');
  return (
    <div className="px-4 py-3">
      <button
        type="button"
        className="flex w-full items-start gap-3 text-left"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
      >
        <span className="mt-0.5 shrink-0">
          <StatusIcon tone={tone} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-3">
            <span className="font-mono">{formatDateTime(item.at, t.locale)}</span>
            <span className="text-ink-2">{t(item.title)}</span>
            <span>
              {t('úroveň', 'level')} {item.level}
            </span>
            <span>{t(CONTEXT_NAMES[item.context])}</span>
            {item.purpose && <span>{t(PURPOSE_NAMES[item.purpose])}</span>}
          </span>
          <span className={cn('mt-1 block text-sm', !open && 'line-clamp-2')}>
            <RichText text={t(item.prompt)} inlineOnly />
          </span>
          <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-ink-2">
            <span>{verdict}</span>
            {item.hints > 0 && (
              <span className="flex items-center gap-1">
                <Lightbulb size={12} aria-hidden />
                {plural(item.hints, t.locale, ['nápověda', 'nápovědy', 'nápověd'], ['hint', 'hints'])}
              </span>
            )}
            {item.tutor && (
              <span className="flex items-center gap-1">
                <MessageSquare size={12} aria-hidden />
                {t('AI tutor', 'AI tutor')}
              </span>
            )}
            {item.confidence && (
              <span>
                {item.confidence === 'sure'
                  ? t('jistě', 'sure')
                  : item.confidence === 'think'
                    ? t('asi', 'I think')
                    : t('tip', 'a guess')}
              </span>
            )}
            {item.error && (
              <span>
                {t(errorName(item.error)).toLowerCase()}
                {!item.errorConfirmed && <span className="text-ink-3"> ({t('odhad', 'a guess')})</span>}
              </span>
            )}
            <span className="font-mono text-xs text-ink-3">
              {clock(item.seconds)} / {clock(item.estSeconds)}
            </span>
          </span>
        </span>
      </button>
      {open && (
        <div className="mt-3 space-y-2 pl-7 text-sm">
          {item.figure && <Figure spec={item.figure} maxWidth={420} />}
          {item.inputs.length === 0 ? (
            <p className="text-ink-3">{t('Nic nebylo odesláno.', 'Nothing was submitted.')}</p>
          ) : (
            <ol className="space-y-1">
              {item.inputs.map((input, index) => (
                <li key={index} className="flex flex-wrap items-center gap-2">
                  <span className="w-4 font-mono text-xs text-ink-3">{index + 1}</span>
                  {input.text ? (
                    <RichText text={t(input.text)} inlineOnly />
                  ) : (
                    <code className="rounded border border-border bg-surface-2 px-1.5 py-0.5">{input.input}</code>
                  )}
                  <span className="text-[13px] text-ink-3">
                    {input.verdict === 'correct' ? t('správně', 'correct') : t('špatně', 'wrong')}
                  </span>
                </li>
              ))}
            </ol>
          )}
          <div className="text-ink-2">
            {t('Správně', 'Correct answer')}:{' '}
            {item.answerText ? <RichText text={t(item.answerText)} inlineOnly /> : <Tex tex={t(item.answerTex)} />}
          </div>
          {item.note && (
            <Notice tone="info">
              <RichText text={t(item.note)} />
            </Notice>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------------- work

function Work({ data }: { data: StudentDetailDto }) {
  const t = useT();
  return (
    <div className="grid gap-5 xl:grid-cols-2">
      <div className="min-w-0 space-y-5">
        <GoalCard data={data} />
        <AssignCard data={data} />
        <FocusCard data={data} />
      </div>
      <div className="min-w-0 space-y-5">
        <NotesCard data={data} />
        <Card className="p-5">
          <SectionLabel>{t('Doučování', 'Tutoring sessions')}</SectionLabel>
          {data.sessions.length === 0 ? (
            <p className="mt-2 text-sm text-ink-2">{t('Zatím žádné.', 'None yet.')}</p>
          ) : (
            <ul className="mt-2 divide-y divide-border">
              {data.sessions.map((session) => (
                <li key={session.id} className="py-2.5">
                  <Link to={`/teach/${data.username}/session/${session.id}`} className="text-sm font-medium text-ink">
                    {formatDateTime(session.startedAt, t.locale)}
                    {session.finishedAt === null && ` · ${t('rozpracované', 'under way')}`}
                  </Link>
                  <div className="text-[13px] text-ink-2">
                    {plural(session.items, t.locale, ['úloha', 'úlohy', 'úloh'], ['problem', 'problems'])}
                    {session.covered.length > 0 && ` · ${session.covered.map((skill) => t(skill.title)).join(', ')}`}
                  </div>
                  {session.next && (
                    <div className="text-[13px] text-ink-3">
                      {t('Příště', 'Next time')}: {session.next}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}

function GoalCard({ data }: { data: StudentDetailDto }) {
  const t = useT();
  const goals = useGoals();
  const { act, busy, error } = useAct();
  const [examDay, setExamDay] = useState(data.examDay ?? '');
  const put = (patch: Record<string, unknown>): Promise<boolean> =>
    act(() => api.put(`${studentUrl(data.username)}/goal`, patch));
  return (
    <Card className="p-5">
      <SectionLabel>{t('Cíl a termín', 'Goal and date')}</SectionLabel>
      <div className="mt-3 space-y-4">
        <Field label={t('Na co se připravuje', 'Preparing for')}>
          <Select
            value={data.goal.id}
            disabled={busy}
            onChange={(event) => void put({ goal: event.target.value as GoalId })}
          >
            {(goals.data ?? []).map((goal) => (
              <option key={goal.id} value={goal.id}>
                {t(goal.title)}
              </option>
            ))}
          </Select>
        </Field>
        {data.goal.kind === 'entrance' && (
          <Field label={t('Termín zkoušky', 'Examination date')}>
            <span className="flex flex-wrap items-center gap-2">
              <TextInput
                type="date"
                value={examDay}
                onChange={(event) => setExamDay(event.target.value)}
                className="w-44"
              />
              <Button
                size="sm"
                disabled={busy || examDay === (data.examDay ?? '')}
                onClick={() => void put({ examDay: examDay === '' ? null : examDay })}
              >
                {t('Uložit', 'Save')}
              </Button>
            </span>
          </Field>
        )}
        <p className="text-xs text-ink-3">
          {t(
            'Cíl a termín jsou jediné, co tu jde v nastavení tohoto účtu změnit. Změna je v něm vidět.',
            'The goal and the date are the only settings of this account that can be changed here. The change shows there.',
          )}
        </p>
        {error !== null && <ErrorNote error={error} />}
      </div>
    </Card>
  );
}

function AssignCard({ data }: { data: StudentDetailDto }) {
  const t = useT();
  const { act, busy, error } = useAct();
  const [kind, setKind] = useState<AssignmentKind>('practice');
  const [skills, setSkills] = useState<string[]>([]);
  const [minutes, setMinutes] = useState(15);
  const [dueDay, setDueDay] = useState('');
  const [note, setNote] = useState('');
  const practisable = data.skills.filter((skill) => skill.hasProblems);
  const many = kind === 'practice' || kind === 'review';
  const needsSkill = kind !== 'test' && kind !== 'review';
  const titleOf = (id: string): string => {
    const skill = data.skills.find((entry) => entry.id === id);
    return skill ? t(skill.title) : id;
  };
  const submit = async (event: FormEvent): Promise<void> => {
    event.preventDefault();
    const ok = await act(() =>
      api.post(`${studentUrl(data.username)}/assignments`, {
        kind,
        skills: kind === 'test' ? [] : many ? skills : skills.slice(0, 1),
        minutes,
        dueDay: dueDay === '' ? null : dueDay,
        note,
      }),
    );
    if (ok) {
      setSkills([]);
      setNote('');
      setDueDay('');
    }
  };
  const open = data.assignments.filter((entry) => entry.status === 'open');
  const closed = data.assignments.filter((entry) => entry.status !== 'open').slice(0, 6);
  return (
    <Card className="p-5">
      <SectionLabel>{t('Zadat práci', 'Set work')}</SectionLabel>
      <form onSubmit={submit} className="mt-3 space-y-3">
        <Field label={t('Co', 'What')}>
          <Select
            value={kind}
            onChange={(event) => {
              setKind(event.target.value as AssignmentKind);
              setSkills([]);
            }}
          >
            {ASSIGNMENT_KINDS.map((entry) => (
              <option key={entry} value={entry}>
                {t(ASSIGNMENT_NAMES[entry])}
              </option>
            ))}
          </Select>
        </Field>
        {kind !== 'test' && (
          <Field
            label={many ? t('Dovednosti', 'Skills') : t('Dovednost', 'Skill')}
            hint={
              kind === 'review'
                ? t(
                    'Bez výběru se opakuje to, co je právě na řadě.',
                    'With none chosen, what is currently due is reviewed.',
                  )
                : kind === 'remediation'
                  ? t(
                      'Nejdřív slabé předpoklady, potom dovednost od nejlehčích úloh.',
                      'Weak prerequisites first, then the skill from its easiest problems.',
                    )
                  : kind === 'practice' && skills.length > 1
                    ? t(
                        'Víc dovedností: úlohy se vybírají jedna po druhé podle toho, jak to jde.',
                        'Several skills: problems are chosen one at a time, by how it goes.',
                      )
                    : undefined
            }
          >
            <Select
              value=""
              onChange={(event) => {
                const id = event.target.value;
                if (id) setSkills((list) => (many ? [...new Set([...list, id])] : [id]));
              }}
            >
              <option value="">{t('— vybrat —', '— choose —')}</option>
              {(kind === 'lesson' ? data.skills.filter((skill) => !skill.paperOnly) : practisable)
                .filter((skill) => !skills.includes(skill.id))
                .map((skill) => (
                  <option key={skill.id} value={skill.id}>
                    {t(skill.title)}
                  </option>
                ))}
            </Select>
            {skills.length > 0 && (
              <span className="mt-2 flex flex-wrap gap-1.5">
                {skills.map((id) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setSkills((list) => list.filter((entry) => entry !== id))}
                    className="h-7 rounded-md border border-border-strong bg-surface-2 px-2 text-xs hover:bg-surface-3"
                    title={t('Odebrat', 'Remove')}
                  >
                    {titleOf(id)} ×
                  </button>
                ))}
              </span>
            )}
          </Field>
        )}
        <div className="flex flex-wrap gap-4">
          {kind !== 'test' && kind !== 'lesson' && (
            <Field label={t('Minut', 'Minutes')}>
              <TextInput
                type="number"
                min={5}
                max={90}
                value={minutes}
                onChange={(event) => setMinutes(Number(event.target.value))}
                className="w-24"
              />
            </Field>
          )}
          <Field label={t('Do kdy (nepovinné)', 'Due (optional)')}>
            <TextInput
              type="date"
              value={dueDay}
              onChange={(event) => setDueDay(event.target.value)}
              className="w-44"
            />
          </Field>
        </div>
        <Field label={t('Vzkaz, který se zobrazí u zadání', 'A line shown with the assignment')}>
          <TextInput value={note} maxLength={300} onChange={(event) => setNote(event.target.value)} />
        </Field>
        <Button type="submit" variant="primary" busy={busy} disabled={needsSkill && skills.length === 0}>
          {t('Zadat', 'Assign')}
        </Button>
        {error !== null && <ErrorNote error={error} />}
      </form>

      {open.length + closed.length > 0 && (
        <ul className="mt-5 divide-y divide-border border-t border-border">
          {[...open, ...closed].map((entry) => (
            <li key={entry.id} className="flex items-start justify-between gap-3 py-2.5">
              <div className="min-w-0">
                <div className="text-sm font-medium">
                  {t(ASSIGNMENT_NAMES[entry.kind])}
                  <span className="ml-2 font-normal text-ink-3">
                    {entry.status === 'open'
                      ? t('otevřeno', 'open')
                      : entry.status === 'done'
                        ? t('hotovo', 'done')
                        : t('zrušeno', 'withdrawn')}
                  </span>
                </div>
                {entry.skills.length > 0 && (
                  <div className="text-[13px] text-ink-2">
                    {entry.skills.map((skill) => t(skill.title)).join(' · ')}
                  </div>
                )}
                <div className="text-xs text-ink-3">
                  {formatDate(entry.createdAt, t.locale)}
                  {entry.dueDay && ` · ${t('do', 'by')} ${formatDay(entry.dueDay, t.locale)}`}
                  {entry.result &&
                    ` · ${entry.result.solved}/${entry.result.problems} ${t('vyřešeno', 'solved')}, ${entry.result.unaided} ${t('bez pomoci', 'unaided')}, ${entry.result.hinted} ${t('s nápovědou', 'with hints')}`}
                </div>
                {entry.note && <div className="text-[13px] text-ink-2">„{entry.note}“</div>}
              </div>
              {entry.status === 'open' && (
                <IconButton
                  label={t('Zrušit zadání', 'Withdraw the assignment')}
                  disabled={busy}
                  onClick={() => void act(() => api.delete(`${studentUrl(data.username)}/assignments/${entry.id}`))}
                >
                  <Trash2 size={15} />
                </IconButton>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function FocusCard({ data }: { data: StudentDetailDto }) {
  const t = useT();
  const { act, busy } = useAct();
  if (data.focus.length === 0) return null;
  return (
    <Card className="p-5">
      <SectionLabel>{t('Označeno k návratu', 'Marked to come back to')}</SectionLabel>
      <ul className="mt-2 divide-y divide-border">
        {data.focus.map((entry) => (
          <li key={entry.skill} className="flex items-center justify-between gap-3 py-2 text-sm">
            <span className="min-w-0">
              {t(entry.title)}
              <span className="ml-2 text-xs text-ink-3">
                {entry.kind === 'difficulty'
                  ? t('dělá potíže', 'causes difficulty')
                  : t('probráno, ověřit', 'covered, to check')}{' '}
                · {t('do', 'until')} {formatDate(entry.expiresAt, t.locale)}
              </span>
            </span>
            <IconButton
              label={t('Odebrat označení', 'Remove the mark')}
              disabled={busy}
              onClick={() =>
                void act(() => api.delete(`${studentUrl(data.username)}/focus/${encodeURIComponent(entry.skill)}`))
              }
            >
              <Trash2 size={15} />
            </IconButton>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function NotesCard({ data }: { data: StudentDetailDto }) {
  const t = useT();
  const { act, busy, error } = useAct();
  const [body, setBody] = useState('');
  const [skill, setSkill] = useState('');
  const base = `${studentUrl(data.username)}/notes`;
  return (
    <Card className="p-5">
      <SectionLabel>{t('Soukromé poznámky', 'Private notes')}</SectionLabel>
      <p className="mt-2 text-[13px] text-ink-2">
        {t(
          'Ukládají se k tvému účtu, ne k žákovskému. Ze žákovského účtu se k nim nedá dostat žádnou stránkou a nevidí je ani jiný učitel téhož účtu.',
          'They are stored with your account, not with the learner’s. No page of the learner’s account can reach them, and another teacher of the same account cannot see them either.',
        )}
      </p>
      <form
        className="mt-3 space-y-2"
        onSubmit={(event) => {
          event.preventDefault();
          void act(() => api.post(base, { body, skill: skill || undefined })).then((ok) => {
            if (ok) {
              setBody('');
              setSkill('');
            }
          });
        }}
      >
        <textarea
          value={body}
          onChange={(event) => setBody(event.target.value)}
          rows={3}
          maxLength={4000}
          placeholder={t('Co si chceš zapamatovat…', 'What you want to remember…')}
          className="w-full rounded-lg border border-border-strong bg-surface-2 px-3 py-2 text-sm placeholder:text-ink-3 focus:border-accent focus:outline-none"
        />
        <div className="flex flex-wrap items-center gap-2">
          <Select value={skill} onChange={(event) => setSkill(event.target.value)} className="w-56">
            <option value="">{t('— bez dovednosti —', '— no skill —')}</option>
            {data.skills.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {t(entry.title)}
              </option>
            ))}
          </Select>
          <Button type="submit" size="sm" busy={busy} disabled={body.trim() === ''}>
            {t('Uložit poznámku', 'Save the note')}
          </Button>
        </div>
        {error !== null && <ErrorNote error={error} />}
      </form>
      {data.notes.length > 0 && (
        <ul className="mt-4 divide-y divide-border border-t border-border">
          {data.notes.map((note) => (
            <li key={note.id} className="flex items-start justify-between gap-3 py-2.5">
              <div className="min-w-0">
                <div className="text-xs text-ink-3">
                  {formatDateTime(note.createdAt, t.locale)}
                  {note.skill && ` · ${t(note.skill.title)}`}
                </div>
                <div className="mt-0.5 text-sm whitespace-pre-wrap">{note.body}</div>
              </div>
              <IconButton
                label={t('Smazat poznámku', 'Delete the note')}
                disabled={busy}
                onClick={() => void act(() => api.delete(`${base}/${note.id}`))}
              >
                <Trash2 size={15} />
              </IconButton>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
