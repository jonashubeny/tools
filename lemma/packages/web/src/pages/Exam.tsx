import {
  type ErrorType,
  type ExamDto,
  type ExamReportDto,
  type ProblemDto,
  type SettingsDto,
  type StartRunResponse,
  ERROR_FAMILIES,
  ERROR_INFO,
  ERROR_TYPES,
  interpretAnswer,
} from '@lemma/core';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ArrowRight, Clock, Flag } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { api } from '../app/api';
import { useT } from '../app/i18n';
import { FAMILY_COLOR, FAMILY_NAMES } from '../app/labels';
import { useExam, useMe, useRefresh } from '../app/queries';
import { Figure } from '../figure/Figure';
import { cn } from '../lib/cn';
import { clock, duration, pct } from '../lib/format';
import { RichText, Tex } from '../lib/Math';
import {
  Badge,
  Button,
  Card,
  ErrorNote,
  Loading,
  Notice,
  PageHeader,
  SectionLabel,
  Select,
  StatTile,
  StatusIcon,
} from '../ui';
import { BarList } from '../viz/charts';

export function Exam() {
  const { id } = useParams();
  const exam = useExam(id);
  const me = useMe();
  if (exam.isPending || !me.data) return <Loading />;
  if (exam.isError) return <ErrorNote error={exam.error} retry={() => void exam.refetch()} />;
  return exam.data.finishedAt === null ? (
    <Running key={exam.data.id} exam={exam.data} settings={me.data.settings} />
  ) : (
    <Report exam={exam.data} />
  );
}

// ------------------------------------------------------------------------------- running

function Running({ exam, settings }: { exam: ExamDto; settings: SettingsDto }) {
  const t = useT();
  const client = useQueryClient();
  const refresh = useRefresh();
  const [answers, setAnswers] = useState<string[]>(() => exam.items.map((item) => item.input));
  const [current, setCurrent] = useState(0);
  const [remaining, setRemaining] = useState(exam.deadlineAt - Date.now());
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const spent = useRef<number[]>(exam.items.map((item) => item.seconds));
  const dirty = useRef<Set<number>>(new Set());
  const latest = useRef(answers);
  latest.current = answers;
  const finishing = useRef(false);

  const save = useCallback(
    async (index: number): Promise<void> => {
      dirty.current.delete(index);
      try {
        await api.put(`/api/exams/${exam.id}/items/${index}`, {
          input: latest.current[index] ?? '',
          seconds: spent.current[index] ?? 0,
        });
      } catch {
        // Keep it marked so the next save retries it.
        dirty.current.add(index);
      }
    },
    [exam.id],
  );

  const finish = useCallback(async (): Promise<void> => {
    if (finishing.current) return;
    finishing.current = true;
    setBusy(true);
    setError(null);
    try {
      await Promise.all([...dirty.current].map((index) => save(index)));
      const done = await api.post<ExamDto>(`/api/exams/${exam.id}/finish`);
      client.setQueryData(['exam', exam.id], done);
      refresh();
    } catch (failure) {
      finishing.current = false;
      setError(failure);
      setBusy(false);
    }
  }, [client, exam.id, refresh, save]);

  // One tick a second: the clock, the time on the current item, and the deadline.
  useEffect(() => {
    const timer = setInterval(() => {
      const left = exam.deadlineAt - Date.now();
      setRemaining(left);
      spent.current[current] = (spent.current[current] ?? 0) + 1;
      if (left <= 0) void finish();
    }, 1000);
    return () => clearInterval(timer);
  }, [current, exam.deadlineAt, finish]);

  // Save shortly after typing stops.
  useEffect(() => {
    if (!dirty.current.has(current)) return;
    const timer = setTimeout(() => void save(current), 700);
    return () => clearTimeout(timer);
  }, [answers, current, save]);

  const setAnswer = (value: string): void => {
    dirty.current.add(current);
    setAnswers((list) => list.map((item, index) => (index === current ? value : item)));
  };
  const go = (index: number): void => {
    if (dirty.current.has(current)) void save(current);
    setCurrent(Math.max(0, Math.min(exam.items.length - 1, index)));
  };

  const item = exam.items[current]!;
  const unanswered = answers.filter((answer) => answer.trim() === '').length;
  const low = remaining < 120_000;

  return (
    <div className="mx-auto max-w-3xl">
      <div className="sticky top-12 z-20 -mx-1 mb-5 flex items-center gap-3 rounded-lg border border-border bg-surface-1 px-3.5 py-2.5 lg:top-2">
        <div className="min-w-0 flex-1 truncate text-sm font-medium">{t(exam.title)}</div>
        <div
          className={cn('flex items-center gap-1.5 font-mono text-sm', low ? 'font-semibold text-ink' : 'text-ink-2')}
          role="timer"
          aria-live={low ? 'polite' : 'off'}
        >
          {low ? <StatusIcon tone="warning" size={15} /> : <Clock size={14} aria-hidden />}
          {clock(Math.max(0, remaining) / 1000)}
        </div>
        <Button size="sm" onClick={() => setConfirm(true)} disabled={busy}>
          <Flag size={13} />
          {t('Odevzdat', 'Hand in')}
        </Button>
      </div>

      <nav className="mb-4 flex flex-wrap gap-1.5" aria-label={t('Úlohy', 'Problems')}>
        {exam.items.map((entry, index) => (
          <button
            key={entry.index}
            type="button"
            onClick={() => go(index)}
            aria-current={index === current}
            aria-label={`${t('Úloha', 'Problem')} ${index + 1}${answers[index]?.trim() ? `, ${t('zodpovězena', 'answered')}` : ''}`}
            className={cn(
              'h-8 w-9 rounded-md border font-mono text-[13px]',
              index === current
                ? 'border-accent bg-accent-wash text-ink'
                : answers[index]?.trim()
                  ? 'border-border-strong bg-surface-3 text-ink'
                  : 'border-border bg-surface-1 text-ink-3 hover:bg-surface-2',
            )}
          >
            {index + 1}
          </button>
        ))}
      </nav>

      <Card className="p-5 sm:p-6">
        <div className="mb-3 flex items-center gap-2">
          <Badge>
            {t('Úloha', 'Problem')} {current + 1}/{exam.items.length}
          </Badge>
          <Badge tone="outline">
            {item.problem.level}{' '}
            {t(
              item.problem.level === 1 ? 'bod' : item.problem.level < 5 ? 'body' : 'bodů',
              item.problem.level === 1 ? 'point' : 'points',
            )}
          </Badge>
        </div>
        <div className="text-[1.0625rem] leading-relaxed">
          <RichText text={t(item.problem.prompt)} />
        </div>
        {item.problem.figure && <Figure spec={item.problem.figure} className="mt-4" />}
        <div className="mt-5">
          <ExamEntry
            key={current}
            problem={item.problem}
            value={answers[current] ?? ''}
            onChange={setAnswer}
            settings={settings}
          />
        </div>
        <div className="mt-6 flex items-center justify-between gap-3 border-t border-border pt-4">
          <Button variant="ghost" onClick={() => go(current - 1)} disabled={current === 0}>
            <ArrowLeft size={14} />
            {t('Předchozí', 'Previous')}
          </Button>
          {current + 1 < exam.items.length ? (
            <Button onClick={() => go(current + 1)}>
              {t('Další', 'Next')}
              <ArrowRight size={14} />
            </Button>
          ) : (
            <Button variant="primary" onClick={() => setConfirm(true)}>
              {t('Odevzdat', 'Hand in')}
            </Button>
          )}
        </div>
      </Card>

      {confirm && (
        <Notice
          tone={unanswered > 0 ? 'warning' : 'info'}
          className="mt-4"
          title={
            unanswered > 0
              ? t(`Nezodpovězené úlohy: ${unanswered}`, `Unanswered problems: ${unanswered}`)
              : t('Všechno je zodpovězené', 'Everything is answered')
          }
          action={
            <div className="flex gap-2">
              <Button size="sm" variant="primary" onClick={() => void finish()} busy={busy}>
                {t('Odevzdat a vyhodnotit', 'Hand in and mark')}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setConfirm(false)}>
                {t('Ještě ne', 'Not yet')}
              </Button>
            </div>
          }
        >
          {t(
            `Zbývá ${clock(Math.max(0, remaining) / 1000)}. Po odevzdání už odpovědi nejdou měnit.`,
            `${clock(Math.max(0, remaining) / 1000)} left. Answers cannot be changed after handing in.`,
          )}
        </Notice>
      )}
      {error !== null && (
        <div className="mt-4">
          <ErrorNote error={error} />
        </div>
      )}
    </div>
  );
}

/** Answer entry without any verdict: in an exam the input is only recorded. */
function ExamEntry({
  problem,
  value,
  onChange,
  settings,
}: {
  problem: ProblemDto;
  value: string;
  onChange: (value: string) => void;
  settings: SettingsDto;
}) {
  const t = useT();
  const spec = problem.answer;
  const reading = useMemo(
    () =>
      spec.kind === 'choice' || spec.kind === 'spot' || spec.kind === 'self' || value.trim() === ''
        ? null
        : interpretAnswer(spec, value, { decimalComma: settings.decimalComma, locale: t.locale }),
    [spec, value, settings.decimalComma, t.locale],
  );

  if (spec.kind === 'choice') {
    const picked = value === '' ? [] : value.split(',');
    const toggle = (id: string): void =>
      onChange(
        (spec.multi
          ? picked.includes(id)
            ? picked.filter((x) => x !== id)
            : [...picked, id]
          : picked.includes(id)
            ? []
            : [id]
        ).join(','),
      );
    return (
      <div role={spec.multi ? 'group' : 'radiogroup'} className="space-y-2">
        {spec.options.map((option) => {
          const on = picked.includes(option.id);
          return (
            <button
              key={option.id}
              type="button"
              role={spec.multi ? 'checkbox' : 'radio'}
              aria-checked={on}
              onClick={() => toggle(option.id)}
              className={cn(
                'flex w-full items-start gap-3 rounded-lg border px-3.5 py-2.5 text-left',
                on ? 'border-accent bg-accent-wash' : 'border-border-strong bg-surface-2 hover:bg-surface-3',
              )}
            >
              <span
                className={cn(
                  'mt-1 grid h-4 w-4 shrink-0 place-items-center border',
                  spec.multi ? 'rounded' : 'rounded-full',
                  on ? 'border-accent' : 'border-border-strong',
                )}
              >
                {on && <span className={cn('h-2 w-2 bg-accent', spec.multi ? 'rounded-[2px]' : 'rounded-full')} />}
              </span>
              <RichText text={t(option.text)} inlineOnly />
            </button>
          );
        })}
      </div>
    );
  }
  if (spec.kind === 'spot') {
    return (
      <div>
        <div className="mb-2 text-[13px] text-ink-3">
          {t(
            'Klikni na první řádek, který neplyne z předchozího.',
            'Click the first line that does not follow from the one before.',
          )}
        </div>
        <ol role="radiogroup" className="overflow-hidden rounded-lg border border-border-strong">
          {spec.lines.map((line, index) => (
            <li key={index} className={cn(index > 0 && 'border-t border-border')}>
              <button
                type="button"
                role="radio"
                aria-checked={value === String(index)}
                onClick={() => onChange(value === String(index) ? '' : String(index))}
                className={cn(
                  'flex w-full items-center gap-3 px-3 py-2 text-left',
                  value === String(index) ? 'bg-accent-wash' : 'bg-surface-2 hover:bg-surface-3',
                )}
              >
                <span className="w-5 shrink-0 font-mono text-xs text-ink-3">{index + 1}</span>
                <span className="min-w-0 flex-1 overflow-x-auto">
                  <Tex tex={line.tex} />
                </span>
              </button>
            </li>
          ))}
        </ol>
      </div>
    );
  }
  if (spec.kind === 'self') return null;
  return (
    <div>
      <div className="flex flex-wrap items-center gap-2.5">
        {spec.label && <Tex tex={spec.label} className="text-lg" />}
        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          aria-label={t('Tvoje odpověď', 'Your answer')}
          placeholder={spec.placeholder ?? ''}
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          className="h-11 min-w-0 flex-1 basis-56 rounded-lg border border-border-strong bg-surface-2 px-3 font-mono text-base placeholder:text-ink-3 focus:border-accent focus:outline-none"
        />
      </div>
      <div className="mt-2 min-h-6 text-sm text-ink-2" aria-live="polite">
        {reading === null ? null : reading.ok ? (
          <>
            {t('Čtu to jako', 'I read this as')} <Tex tex={reading.tex} className="text-ink" />
          </>
        ) : (
          t(reading.message)
        )}
      </div>
    </div>
  );
}

// -------------------------------------------------------------------------------- report

function Report({ exam }: { exam: ExamDto }) {
  const t = useT();
  const navigate = useNavigate();
  const client = useQueryClient();
  const report = exam.report;
  const [busy, setBusy] = useState<string | null>(null);
  if (!report) return <Loading />;

  const titleOf = (skill: string): string => (report.skillTitles[skill] ? t(report.skillTitles[skill]) : skill);
  const withoutSlips =
    report.maxPoints === 0 ? 0 : (report.points + report.errors.pointsLostToSlips) / report.maxPoints;
  const practise = async (skill: string): Promise<void> => {
    setBusy(skill);
    try {
      const started = await api.post<StartRunResponse>('/api/practice/start', {
        context: 'blocked',
        concept: skill,
        count: 5,
      });
      navigate(`/practice/${started.run.id}`);
    } finally {
      setBusy(null);
    }
  };
  const classify = async (problemId: string, type: ErrorType): Promise<void> => {
    await api.post(`/api/problems/${problemId}/classify`, { errorType: type });
    client.setQueryData(['exam', exam.id], await api.post<ExamDto>(`/api/exams/${exam.id}/refresh`));
  };

  return (
    <div>
      <Link to="/exams" className="mb-3 inline-flex items-center gap-1 text-sm text-ink-2">
        <ArrowLeft size={14} aria-hidden />
        {t('Zkoušky', 'Exams')}
      </Link>
      <PageHeader title={t(exam.title)} eyebrow={t('Rozbor zkoušky', 'Exam analysis')} />

      <div className="space-y-5">
        <Card className="p-5">
          <div className="grid gap-x-10 gap-y-5 md:grid-cols-[auto_1fr]">
            <div>
              <div className="mono-label">{t('Výsledek', 'Result')}</div>
              <div className="mt-1 text-5xl font-semibold tracking-tight">{pct(report.percent / 100, t.locale)}</div>
              <div className="mt-1.5 text-sm text-ink-2">
                {report.points}/{report.maxPoints} {t('bodů', 'points')}
                {report.grade !== null && (
                  <>
                    {' '}
                    · {t('známka', 'grade')} <b className="text-ink">{report.grade}</b>
                  </>
                )}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
              <StatTile label={t('Správně', 'Correct')} value={`${report.correct}/${report.items}`} />
              <StatTile
                label={t('Čas', 'Time')}
                value={duration(report.time.usedSeconds, t.locale)}
                sub={`${t('z', 'of')} ${duration(report.time.limitSeconds, t.locale)}`}
              />
              <StatTile label={t('Bez odpovědi', 'Unanswered')} value={report.time.unanswered} />
              <StatTile
                label={t('Špatně ve spěchu', 'Wrong in a rush')}
                value={report.time.rushedWrong}
                sub={t('pod 35 % obvyklého času', 'under 35% of the usual time')}
              />
            </div>
          </div>
          {report.grade !== null && (
            <p className="mt-3 text-xs text-ink-3">
              {t(
                'Známka podle stupnice v Nastavení; ve škole se může lišit.',
                'The grade follows the scale in Settings; your school’s may differ.',
              )}
            </p>
          )}
        </Card>

        <div className="grid gap-5 lg:grid-cols-2">
          <Card className="p-5">
            <SectionLabel>{t('Kde zůstaly body', 'Where the points went')}</SectionLabel>
            {report.errors.pointsLostToSlips + report.errors.pointsLostToGaps === 0 ? (
              <p className="mt-2 text-sm text-ink-2">
                {t('Nikde — žádné ztracené body.', 'Nowhere — no points lost.')}
              </p>
            ) : (
              <>
                <div className="mt-3">
                  <BarList
                    labelWidth={190}
                    rows={[
                      {
                        id: 'slips',
                        label: t('Nepozornost', 'Slips'),
                        value: report.errors.pointsLostToSlips,
                        display: `${report.errors.pointsLostToSlips} ${t('b.', 'pts')}`,
                      },
                      {
                        id: 'gaps',
                        label: t('Postup, porozumění, nezodpovězeno', 'Procedure, understanding, unanswered'),
                        value: report.errors.pointsLostToGaps,
                        display: `${report.errors.pointsLostToGaps} ${t('b.', 'pts')}`,
                      },
                    ]}
                  />
                </div>
                {report.errors.pointsLostToSlips > 0 && (
                  <p className="mt-3 text-sm text-ink-2">
                    {t('Samotná kontrola by tě dostala z ', 'Checking alone would have taken you from ')}
                    <b className="text-ink">{pct(report.percent / 100, t.locale)}</b>
                    {t(' na ', ' to ')}
                    <b className="text-ink">{pct(withoutSlips, t.locale)}</b>
                    {t(
                      '. Tyhle body umíš — jen je neodevzdáváš.',
                      '. You know how to earn these points — you just do not hand them in.',
                    )}
                  </p>
                )}
                <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-ink-2">
                  {ERROR_FAMILIES.filter((family) => report.errors.byFamily[family] > 0).map((family) => (
                    <li key={family} className="flex items-center gap-1.5">
                      <span
                        aria-hidden
                        className="inline-block h-2.5 w-2.5 rounded-[3px]"
                        style={{ background: FAMILY_COLOR[family] }}
                      />
                      {t(FAMILY_NAMES[family])}: <b className="text-ink">{report.errors.byFamily[family]}</b>
                    </li>
                  ))}
                </ul>
              </>
            )}
            {report.time.slowItems > 0 && (
              <p className="mt-3 text-[13px] text-ink-3">
                {t(
                  `U ${report.time.slowItems} úloh jsi strávil víc než dvojnásobek obvyklého času.`,
                  `On ${report.time.slowItems} problems you spent more than twice the usual time.`,
                )}
              </p>
            )}
          </Card>

          <Card className="p-5">
            <SectionLabel>{t('Co s tím dál', 'What to do next')}</SectionLabel>
            {report.next.length === 0 ? (
              <p className="mt-2 text-sm text-ink-2">
                {t(
                  'Všechno sedělo. Zkus těžší výběr kapitol nebo výroční test.',
                  'Everything held. Try a harder choice of chapters or the annual test.',
                )}
              </p>
            ) : (
              <ol className="mt-2 divide-y divide-border">
                {report.next.map((entry) => (
                  <li key={entry.skill} className="flex items-center justify-between gap-3 py-2.5">
                    <div className="min-w-0">
                      <Link to={`/concept/${entry.skill}`} className="block truncate text-sm font-medium text-ink">
                        {titleOf(entry.skill)}
                      </Link>
                      <div className="text-[13px] text-ink-2">
                        {t(`ztraceno ${entry.lost} b., hlavně`, `${entry.lost} pts lost, mostly`)}:{' '}
                        {entry.mostly === 'unanswered'
                          ? t('bez odpovědi', 'unanswered')
                          : t(FAMILY_NAMES[entry.mostly]).toLowerCase()}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => void practise(entry.skill)}
                      busy={busy === entry.skill}
                      className="shrink-0"
                    >
                      {t('Procvičit', 'Practise')}
                    </Button>
                  </li>
                ))}
              </ol>
            )}
          </Card>
        </div>

        <Card className="p-5">
          <SectionLabel>{t('Podle dovedností', 'By skill')}</SectionLabel>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-ink-3">
                <tr>
                  <th className="pb-1.5 font-normal">{t('Dovednost', 'Skill')}</th>
                  <th className="pb-1.5 text-right font-normal">{t('Správně', 'Correct')}</th>
                  <th className="pb-1.5 text-right font-normal">{t('Body', 'Points')}</th>
                  <th
                    className="pb-1.5 text-right font-normal"
                    title={t('Skutečný čas dělený obvyklým', 'Actual time divided by the usual time')}
                  >
                    {t('Tempo', 'Pace')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {report.bySkill.map((row) => (
                  <tr key={row.skill} className="border-t border-border">
                    <td className="py-1.5 pr-3">
                      <Link to={`/concept/${row.skill}`} className="text-ink">
                        {titleOf(row.skill)}
                      </Link>
                    </td>
                    <td className="py-1.5 text-right">
                      {row.correct}/{row.items}
                    </td>
                    <td className="py-1.5 text-right">
                      {row.points}/{row.maxPoints}
                    </td>
                    <td className="py-1.5 text-right text-ink-2">
                      {row.pace.toFixed(1).replace('.', t.locale === 'cs' ? ',' : '.')}×
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card className="p-5">
          <SectionLabel>{t('Úloha po úloze', 'Problem by problem')}</SectionLabel>
          <ol className="mt-2 divide-y divide-border">
            {exam.items.map((item) => (
              <ReviewItem
                key={item.index}
                item={item}
                detail={report.details[item.index]}
                onClassify={(type) => void classify(item.problem.id, type)}
              />
            ))}
          </ol>
        </Card>
      </div>
    </div>
  );
}

function ReviewItem({
  item,
  detail,
  onClassify,
}: {
  item: ExamDto['items'][number];
  detail: ExamReportDto['details'][number] | undefined;
  onClassify: (type: ErrorType) => void;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const outcome = item.problem.outcome;
  if (!detail) return null;
  const spec = item.problem.answer;
  // A choice is stored as option ids and a spotted line as its index: show what they mean.
  const optionText = (ids: string[]): string | null =>
    spec.kind === 'choice'
      ? ids
          .map((id) => spec.options.find((option) => option.id === id))
          .filter((option) => option !== undefined)
          .map((option) => t(option.text))
          .join('; ')
      : null;
  const given =
    spec.kind === 'choice'
      ? optionText(detail.input.split(','))
      : spec.kind === 'spot'
        ? `${t('řádek', 'line')} ${Number(detail.input) + 1}`
        : null;
  const expected = !outcome
    ? null
    : spec.kind === 'choice'
      ? optionText(outcome.correctOptions)
      : spec.kind === 'spot' && outcome.wrongLine !== null
        ? `${t('řádek', 'line')} ${outcome.wrongLine + 1}`
        : null;
  const tone = detail.correct ? 'good' : detail.answered ? 'critical' : 'warning';
  const verdict = detail.correct
    ? t('správně', 'correct')
    : detail.answered
      ? t('špatně', 'wrong')
      : t('bez odpovědi', 'unanswered');
  return (
    <li className="py-3">
      <button
        type="button"
        className="flex w-full items-start gap-3 text-left"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
      >
        <span className="mt-0.5 w-5 shrink-0 font-mono text-xs text-ink-3">{item.index + 1}</span>
        <span className="mt-0.5 shrink-0">
          <StatusIcon tone={tone} />
        </span>
        <span className="min-w-0 flex-1">
          <span className={cn('block text-sm', !open && 'line-clamp-2')}>
            <RichText text={t(item.problem.prompt)} inlineOnly />
          </span>
          <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-ink-2">
            <span>{verdict}</span>
            {detail.answered && (
              <span>
                {t('tvoje: ', 'yours: ')}
                {given !== null ? (
                  <RichText text={given} inlineOnly />
                ) : (
                  <code className="rounded border border-border bg-surface-2 px-1.5 py-0.5">{detail.input}</code>
                )}
              </span>
            )}
            {!detail.correct && expected !== null && (
              <span>
                {t('správně: ', 'correct: ')}
                <RichText text={expected} inlineOnly className="text-ink" />
              </span>
            )}
            {!detail.correct && expected === null && outcome && outcome.answerTex[t.locale] !== '' && (
              <span>
                {t('správně: ', 'correct: ')}
                <Tex tex={t(outcome.answerTex)} />
              </span>
            )}
            <span className="text-ink-3">
              {clock(detail.seconds)} / {clock(detail.expectedSeconds)}
            </span>
          </span>
        </span>
      </button>
      {open && outcome && (
        <div className="mt-3 space-y-3 pl-[52px]">
          {item.problem.figure && <Figure spec={item.problem.figure} maxWidth={420} />}
          {detail.answered && !detail.correct && (
            <label className="flex flex-wrap items-center gap-2 text-[13px] text-ink-2">
              {t('Jaká to byla chyba?', 'What kind of error was it?')}
              <Select
                value={detail.error ?? 'unknown'}
                onChange={(event) => onClassify(event.target.value as ErrorType)}
                className="h-8 w-auto text-[13px]"
              >
                {ERROR_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {t(ERROR_INFO[type].title)}
                  </option>
                ))}
              </Select>
              {outcome.error && !outcome.errorConfirmed && (
                <span className="text-xs text-ink-3">{t('(odhad aplikace)', '(the app’s guess)')}</span>
              )}
            </label>
          )}
          <ol className="space-y-2.5">
            {outcome.solution.map((step, index) => (
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
        </div>
      )}
    </li>
  );
}
