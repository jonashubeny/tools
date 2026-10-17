import {
  AREAS,
  SESSION_OUTCOMES,
  type Level,
  type SessionOutcome,
  type TeachBriefDto,
  type TeachProblemDto,
  type TeachSessionDto,
} from '@lemma/core';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Eye, Lightbulb, Maximize2, Minimize2, Play } from 'lucide-react';
import { type FormEvent, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import { api } from '../app/api';
import { PathBadge } from '../app/components';
import { useT } from '../app/i18n';
import { AREA_NAMES, ASSIGNMENT_NAMES, PURPOSE_NAMES, errorName, whyText } from '../app/labels';
import { studentUrl, useTeachSession } from '../app/queries';
import { OUTCOME_NAMES, STEP_NAMES, stepReason } from '../app/teach-labels';
import { Figure } from '../figure/Figure';
import { cn } from '../lib/cn';
import { formatDateTime, formatDay, plural } from '../lib/format';
import { RichText, Tex } from '../lib/Math';
import {
  Badge,
  Button,
  Card,
  ErrorNote,
  Field,
  Loading,
  Notice,
  SectionLabel,
  Segmented,
  Select,
  StatusIcon,
  TextInput,
} from '../ui';
import { LevelBar } from '../viz/charts';

/**
 * A tutoring session: what to know before sitting down, problems to show while it runs,
 * and what to write down afterwards. Nothing shown here is an attempt of the learner's:
 * what two people work out together says nothing about what one can do alone.
 */

type Skill = TeachSessionDto['skills'][number];

export function TeachSession() {
  const { student, id } = useParams();
  const t = useT();
  const query = useTeachSession(student, id);
  if (query.isPending) return <Loading />;
  if (query.isError) return <ErrorNote error={query.error} retry={() => void query.refetch()} />;
  const session = query.data;
  return (
    <div className="mx-auto max-w-4xl">
      <Link to={`/teach/${session.student}`} className="mb-3 inline-flex items-center gap-1 text-sm text-ink-2">
        <ArrowLeft size={14} aria-hidden />
        {session.student}
      </Link>
      <header className="mb-6">
        <div className="mono-label">{formatDateTime(session.startedAt, t.locale)}</div>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">
          {t('Doučování', 'Tutoring session')} · {session.student}
        </h1>
      </header>
      {session.finishedAt === null ? <Live session={session} /> : <Record session={session} />}
    </div>
  );
}

// --------------------------------------------------------------------------------- brief

function Brief({ brief, onShow }: { brief: TeachBriefDto; onShow?: (skill: string) => void }) {
  const t = useT();
  return (
    <Card className="p-5">
      <SectionLabel>{t('Před sezením', 'Before the session')}</SectionLabel>
      {(brief.since.lastSessionAt !== null || brief.since.next) && (
        <div className="mt-2 rounded-lg border border-border bg-surface-2 p-3 text-sm">
          {brief.since.lastSessionAt !== null && (
            <div className="text-[13px] text-ink-3">
              {t('Od minulého sezení', 'Since the last session')} ({formatDateTime(brief.since.lastSessionAt, t.locale)}
              ): {plural(brief.since.problems, t.locale, ['úloha', 'úlohy', 'úloh'], ['problem', 'problems'])},{' '}
              {plural(brief.since.activeDays, t.locale, ['den', 'dny', 'dní'], ['day', 'days'])}
            </div>
          )}
          {brief.since.next && (
            <div className="mt-1">
              <span className="text-ink-3">
                {t('Poznámka z minula na příště', 'The note from last time for this one')}:{' '}
              </span>
              {brief.since.next}
            </div>
          )}
          {brief.since.homework.length > 0 && (
            <ul className="mt-1.5 space-y-0.5 text-[13px] text-ink-2">
              {brief.since.homework.map((entry) => (
                <li key={entry.id}>
                  {t(ASSIGNMENT_NAMES[entry.kind])}: {entry.skills.map((skill) => t(skill.title)).join(', ') || '—'} —{' '}
                  {entry.status === 'done'
                    ? entry.result
                      ? t(
                          `hotovo, ${entry.result.solved}/${entry.result.problems} vyřešeno, ${entry.result.hinted}× s nápovědou`,
                          `done, ${entry.result.solved}/${entry.result.problems} solved, ${entry.result.hinted} with hints`,
                        )
                      : t('hotovo', 'done')
                    : entry.status === 'open'
                      ? entry.result
                        ? t('rozpracováno', 'under way')
                        : t('nezačato', 'not started')
                      : t('zrušeno', 'withdrawn')}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="mt-4">
        <div className="mono-label">{t('Navržený průběh', 'A suggested order')}</div>
        {brief.sequence.length === 0 ? (
          <p className="mt-1.5 text-sm text-ink-2">
            {t(
              'Zatím není z čeho navrhovat: v účtu nejsou žádné úlohy.',
              'Nothing to suggest from yet: there are no problems in the account.',
            )}
          </p>
        ) : (
          <ol className="mt-1.5 divide-y divide-border">
            {brief.sequence.map((step, index) => (
              <li key={index} className="flex items-start gap-3 py-2.5">
                <span className="mt-0.5 w-4 shrink-0 font-mono text-xs text-ink-3">{index + 1}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="font-medium">{t(STEP_NAMES[step.kind])}</span>
                    {step.skill && <span>{t(step.skill.title)}</span>}
                    {step.error && <span>{t(errorName(step.error)).toLowerCase()}</span>}
                    <Badge>{step.minutes} min</Badge>
                  </div>
                  <div className="text-[13px] text-ink-2">{stepReason(step.reason, t)}</div>
                </div>
                {onShow && step.skill && step.kind !== 'homework' && (
                  <Button size="sm" onClick={() => onShow(step.skill!.id)} className="shrink-0">
                    <Play size={13} />
                    {t('Úloha', 'A problem')}
                  </Button>
                )}
              </li>
            ))}
          </ol>
        )}
        <p className="mt-2 text-xs text-ink-3">
          {t(
            'Každý krok vychází z pravidla, které je u něj napsané. Je to návrh: co se bude dít, rozhoduješ ty.',
            'Every step comes from the rule written beside it. It is a suggestion: what happens is yours to decide.',
          )}
        </p>
      </div>

      <div className="mt-4 grid gap-x-8 gap-y-4 border-t border-border pt-4 sm:grid-cols-2">
        <div>
          <div className="mono-label">{t('Silné stránky', 'Strengths')}</div>
          {brief.strongest.length === 0 ? (
            <p className="mt-1 text-sm text-ink-3">{t('Zatím nic na úrovni „známá“.', 'Nothing at “familiar” yet.')}</p>
          ) : (
            <ul className="mt-1 space-y-1 text-sm">
              {brief.strongest.map((skill) => (
                <li key={skill.id} className="flex items-center justify-between gap-3">
                  <span className="min-w-0 truncate">{t(skill.title)}</span>
                  <LevelBar level={skill.level} size="sm" />
                </li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <div className="mono-label">{t('Nejdůležitější mezery', 'The gaps that matter most')}</div>
          {brief.gaps.length === 0 ? (
            <p className="mt-1 text-sm text-ink-3">
              {t('Žádná, o které by aplikace věděla.', 'None that the app knows of.')}
            </p>
          ) : (
            <ul className="mt-1 space-y-1 text-sm">
              {brief.gaps.map((gap) => (
                <li key={gap.id}>
                  {t(gap.title)}
                  {gap.holdsUp.length > 0 && (
                    <span className="text-ink-3"> → {gap.holdsUp.map((skill) => t(skill.title)).join(', ')}</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {brief.misconceptions.length > 0 && (
        <div className="mt-4 border-t border-border pt-4">
          <div className="mono-label">
            {t('Mylné představy, které se vracejí', 'Misconceptions that keep returning')}
          </div>
          <ul className="mt-1.5 space-y-2">
            {brief.misconceptions.slice(0, 4).map((entry, index) => (
              <li key={index} className="text-sm">
                <span className="font-medium">{t(entry.skill.title)}</span>{' '}
                <span className="font-mono text-xs text-ink-3">{entry.count}×</span>
                <div className="text-ink-2">
                  <RichText text={t(entry.note)} />
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {brief.mistakes.length > 0 && (
        <details className="mt-4 border-t border-border pt-4">
          <summary className="mono-label cursor-pointer">
            {t('Poslední chyby', 'Recent mistakes')} ({brief.mistakes.length})
          </summary>
          <ul className="mt-2 space-y-3">
            {brief.mistakes.map((mistake) => (
              <li key={mistake.problemId} className="text-sm">
                <div className="text-xs text-ink-3">
                  {t(mistake.skillTitle)} · {t(errorName(mistake.error)).toLowerCase()}
                </div>
                <div className="mt-0.5">
                  <RichText text={t(mistake.prompt)} inlineOnly />
                </div>
                <div className="mt-0.5 text-[13px] text-ink-2">
                  {t('odpověď', 'answer')}:{' '}
                  {mistake.inputText ? (
                    <RichText text={t(mistake.inputText)} inlineOnly />
                  ) : (
                    <code className="rounded border border-border bg-surface-2 px-1.5 py-0.5">
                      {mistake.input || '—'}
                    </code>
                  )}{' '}
                  · {t('správně', 'correct')}:{' '}
                  {mistake.answerText ? (
                    <RichText text={t(mistake.answerText)} inlineOnly />
                  ) : (
                    <Tex tex={t(mistake.answerTex)} />
                  )}
                </div>
              </li>
            ))}
          </ul>
        </details>
      )}

      {brief.priorities.length > 0 && (
        <details className="mt-4 border-t border-border pt-4">
          <summary className="mono-label cursor-pointer">
            {t('Co by aplikace vybrala sama', 'What the app would choose by itself')}
          </summary>
          <ol className="mt-2 space-y-1.5 text-sm">
            {brief.priorities.map((step) => (
              <li key={step.skill.id}>
                <span className="font-medium">{t(step.skill.title)}</span>{' '}
                <Badge>{t(PURPOSE_NAMES[step.purpose])}</Badge>
                <div className="text-[13px] text-ink-2">{whyText(step, t)}</div>
              </li>
            ))}
          </ol>
        </details>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------------------------- live

function Live({ session }: { session: TeachSessionDto }) {
  const t = useT();
  const client = useQueryClient();
  const base = `${studentUrl(session.student)}/sessions/${session.id}`;
  const [current, setCurrent] = useState<TeachProblemDto | null>(null);
  // Start the picker at what the brief suggests explaining, where it suggests anything.
  const suggested = session.brief.sequence.find((step) => step.kind === 'explain' && step.skill)?.skill?.id;
  const [skill, setSkill] = useState(
    session.skills.some((entry) => entry.id === suggested) ? suggested! : (session.skills[0]?.id ?? ''),
  );
  const [level, setLevel] = useState<'auto' | `${Level}`>('auto');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const chosen = session.skills.find((entry) => entry.id === skill);
  const update = (next: TeachSessionDto): void => {
    client.setQueryData(['teach', 'session', session.student, session.id], next);
  };

  const run = async <T,>(action: () => Promise<T>): Promise<T | undefined> => {
    setBusy(true);
    setError(null);
    try {
      return await action();
    } catch (failure) {
      setError(failure);
      return undefined;
    } finally {
      setBusy(false);
    }
  };
  const show = async (skillId: string, wanted?: Level): Promise<void> => {
    const problem = await run(() => api.post<TeachProblemDto>(`${base}/problems`, { skill: skillId, level: wanted }));
    if (problem) {
      setCurrent(problem);
      setSkill(skillId);
      update({ ...session, items: [...session.items, problem.item] });
    }
  };
  const reopen = async (itemId: string): Promise<void> => {
    const problem = await run(() => api.get<TeachProblemDto>(`${base}/items/${itemId}`));
    if (problem) setCurrent(problem);
  };
  const record = async (itemId: string, patch: { outcome?: SessionOutcome | null; note?: string }): Promise<void> => {
    const next = await run(() => api.put<TeachSessionDto>(`${base}/items/${itemId}`, patch));
    if (next) {
      update(next);
      const item = next.items.find((entry) => entry.id === itemId);
      if (item) setCurrent((problem) => (problem && problem.item.id === itemId ? { ...problem, item } : problem));
    }
  };

  return (
    <div className="space-y-5">
      <Brief brief={session.brief} onShow={(id) => void show(id)} />

      <Card className="p-5">
        <SectionLabel>{t('Během sezení: ukázat úlohu', 'During the session: show a problem')}</SectionLabel>
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <Field label={t('Dovednost', 'Skill')} className="min-w-56 flex-1">
            <Select value={skill} onChange={(event) => setSkill(event.target.value)}>
              {AREAS.map((area) => {
                const list = session.skills.filter((entry) => entry.area === area);
                return list.length === 0 ? null : (
                  <optgroup key={area} label={t(AREA_NAMES[area])}>
                    {list.map((entry) => (
                      <option key={entry.id} value={entry.id}>
                        {t(entry.title)}
                      </option>
                    ))}
                  </optgroup>
                );
              })}
            </Select>
          </Field>
          <div>
            <div className="mb-1 text-[13px] font-medium text-ink-2">{t('Úroveň', 'Level')}</div>
            <Segmented
              label={t('Úroveň', 'Level')}
              value={level}
              onChange={setLevel}
              options={[
                { value: 'auto' as const, label: t('podle úrovně', 'by level') },
                ...(chosen?.levels ?? []).map((value) => ({
                  value: String(value) as `${Level}`,
                  label: String(value),
                })),
              ]}
            />
          </div>
          <Button
            variant="primary"
            busy={busy}
            disabled={!skill}
            onClick={() => void show(skill, level === 'auto' ? undefined : (Number(level) as Level))}
          >
            <Play size={14} />
            {t('Ukázat úlohu', 'Show a problem')}
          </Button>
        </div>
        {chosen && (
          <div className="mt-2 flex items-center gap-3 text-xs text-ink-3">
            {t('Úroveň na této dovednosti', 'The level on this skill')}: <LevelBar level={chosen.level} size="sm" />
            <PathBadge state={chosen.path} className="text-xs" />
          </div>
        )}
        {error !== null && (
          <div className="mt-3">
            <ErrorNote error={error} />
          </div>
        )}

        {current && (
          <Shown
            key={current.item.id}
            base={base}
            problem={current}
            busy={busy}
            onRecord={(patch) => void record(current.item.id, patch)}
            onAnother={() => void show(current.item.skill)}
          />
        )}

        {session.items.length > 0 && (
          <div className="mt-5 border-t border-border pt-4">
            <div className="mono-label">{t('Ukázané úlohy', 'Problems shown')}</div>
            <ul className="mt-1.5 divide-y divide-border">
              {session.items.map((item, index) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => void reopen(item.id)}
                    className={cn(
                      'flex w-full items-center gap-3 py-2 text-left text-sm hover:bg-surface-2',
                      current?.item.id === item.id && 'font-medium',
                    )}
                  >
                    <span className="w-4 font-mono text-xs text-ink-3">{index + 1}</span>
                    <span className="min-w-0 flex-1 truncate">{t(item.title)}</span>
                    <span className="text-xs text-ink-3">
                      {t('úroveň', 'level')} {item.level}
                    </span>
                    <span className="w-24 text-right text-xs text-ink-2">
                      {item.outcome ? t(OUTCOME_NAMES[item.outcome]) : t('nezapsáno', 'not recorded')}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Card>

      <Wrap session={session} base={base} onDone={update} />
    </div>
  );
}

/** One problem on show: the statement large, help revealed step by step, and how it went. */
function Shown({
  base,
  problem,
  busy,
  onRecord,
  onAnother,
}: {
  base: string;
  problem: TeachProblemDto;
  busy: boolean;
  onRecord: (patch: { outcome?: SessionOutcome | null; note?: string }) => void;
  onAnother: () => void;
}) {
  const t = useT();
  const [hints, setHints] = useState(0);
  const [solution, setSolution] = useState(false);
  const [large, setLarge] = useState(false);
  const [input, setInput] = useState('');
  const [verdict, setVerdict] = useState<{
    verdict: string;
    message: { cs: string; en: string } | null;
    note: { cs: string; en: string } | null;
  } | null>(null);
  const [note, setNote] = useState(problem.item.note);
  const typed = problem.answer.kind !== 'choice' && problem.answer.kind !== 'spot' && problem.answer.kind !== 'self';

  // Escape leaves the large view.
  useEffect(() => {
    if (!large) return;
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') setLarge(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [large]);

  const check = async (value: string): Promise<void> => {
    setVerdict(await api.post(`${base}/items/${problem.item.id}/check`, { input: value }));
  };

  const statement = (
    <>
      <div className={cn('leading-relaxed', large ? 'text-2xl' : 'text-[1.0625rem]')}>
        <RichText text={t(problem.prompt)} />
      </div>
      {problem.figure && <Figure spec={problem.figure} className="mt-4" maxWidth={large ? 720 : 520} />}
      {problem.answer.kind === 'choice' && (
        <ul className={cn('mt-4 space-y-2', large && 'text-xl')}>
          {problem.answer.options.map((option) => (
            <li key={option.id}>
              <button
                type="button"
                onClick={() => void check(option.id)}
                className="flex w-full items-start gap-3 rounded-lg border border-border-strong bg-surface-2 px-3.5 py-2.5 text-left hover:bg-surface-3"
              >
                <RichText text={t(option.text)} inlineOnly />
              </button>
            </li>
          ))}
        </ul>
      )}
      {hints > 0 && (
        <ol className="mt-4 space-y-2">
          {problem.hints.slice(0, hints).map((hint, index) => (
            <li key={index} className="flex gap-2.5 rounded-lg border border-border bg-surface-2 px-3 py-2.5 text-sm">
              <Lightbulb size={15} className="mt-0.5 shrink-0 text-ink-3" aria-hidden />
              <RichText text={t(hint)} />
            </li>
          ))}
        </ol>
      )}
      {solution && (
        <div className="mt-4 rounded-lg border border-border bg-surface-2 p-4">
          <ol className="space-y-2.5">
            {problem.solution.map((step, index) => (
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
          {problem.answerTex[t.locale] !== '' && (
            <div className="mt-3 text-sm">
              {t('Výsledek', 'Result')}: <Tex tex={t(problem.answerTex)} className="text-base" />
            </div>
          )}
        </div>
      )}
    </>
  );

  const controls = (
    <div className="mt-4 flex flex-wrap items-center gap-2">
      {problem.hints.length > 0 && (
        <Button size="sm" disabled={hints >= problem.hints.length} onClick={() => setHints((n) => n + 1)}>
          <Lightbulb size={13} />
          {hints >= problem.hints.length
            ? t('Nápovědy vyčerpány', 'No more hints')
            : `${t('Nápověda', 'Hint')} ${hints + 1}/${problem.hints.length}`}
        </Button>
      )}
      <Button size="sm" onClick={() => setSolution((value) => !value)}>
        <Eye size={13} />
        {solution ? t('Skrýt řešení', 'Hide the solution') : t('Ukázat řešení', 'Show the solution')}
      </Button>
      <Button size="sm" variant="ghost" onClick={() => setLarge((value) => !value)}>
        {large ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
        {large ? t('Zmenšit', 'Smaller') : t('Na celou obrazovku', 'Full screen')}
      </Button>
    </div>
  );

  if (large)
    return (
      <div className="fixed inset-0 z-50 overflow-y-auto bg-bg p-6 sm:p-10">
        <div className="mx-auto max-w-4xl">
          {statement}
          {controls}
        </div>
      </div>
    );

  return (
    <div className="mt-5 rounded-xl border border-border-strong p-4 sm:p-5">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Badge tone="accent">{t(problem.item.title)}</Badge>
        <Badge>
          {t('úroveň', 'level')} {problem.item.level}/5
        </Badge>
        <span className="flex-1" />
        <Button size="sm" variant="ghost" disabled={busy} onClick={onAnother}>
          {t('Jiná úloha téže dovednosti', 'Another of the same skill')}
        </Button>
      </div>
      {statement}

      {typed && (
        <form
          className="mt-4 flex flex-wrap items-center gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (input.trim() !== '') void check(input);
          }}
        >
          <TextInput
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder={t('odpověď, která zazněla', 'the answer that was given')}
            className="max-w-xs font-mono"
            autoComplete="off"
            spellCheck={false}
          />
          <Button type="submit" size="sm" disabled={input.trim() === ''}>
            {t('Zkontrolovat', 'Check')}
          </Button>
        </form>
      )}
      {verdict && (
        <div className="mt-2 flex items-start gap-2 text-sm">
          <StatusIcon
            tone={verdict.verdict === 'correct' ? 'good' : verdict.verdict === 'invalid' ? 'warning' : 'critical'}
          />
          <span>
            {verdict.verdict === 'correct'
              ? t('Správně.', 'Correct.')
              : verdict.verdict === 'invalid'
                ? t('Tomuhle zápisu aplikace nerozumí.', 'The app cannot read this input.')
                : t('Špatně.', 'Wrong.')}{' '}
            {verdict.message && t(verdict.message)}
            {verdict.note && <RichText text={t(verdict.note)} inlineOnly />}
          </span>
        </div>
      )}
      {controls}

      {problem.misconceptions.length > 0 && (
        <details className="mt-3 text-[13px] text-ink-2">
          <summary className="hover:text-ink">
            {t('Na co si dát pozor: časté chyby u této úlohy', 'What to watch for: common mistakes on this problem')}
          </summary>
          <ul className="mt-1.5 space-y-1.5">
            {problem.misconceptions.map((entry, index) => (
              <li key={index}>
                <span className="text-ink-3">{t(errorName(entry.error)).toLowerCase()}: </span>
                <RichText text={t(entry.note)} inlineOnly />
              </li>
            ))}
          </ul>
        </details>
      )}

      <div className="mt-4 border-t border-border pt-4">
        <div className="mb-1.5 text-[13px] font-medium text-ink-2">{t('Jak to šlo', 'How it went')}</div>
        <div className="flex flex-wrap items-center gap-2">
          {SESSION_OUTCOMES.map((outcome) => (
            <Button
              key={outcome}
              size="sm"
              variant={problem.item.outcome === outcome ? 'primary' : 'secondary'}
              disabled={busy}
              onClick={() => onRecord({ outcome: problem.item.outcome === outcome ? null : outcome })}
            >
              {t(OUTCOME_NAMES[outcome])}
            </Button>
          ))}
          <TextInput
            value={note}
            onChange={(event) => setNote(event.target.value)}
            onBlur={() => note !== problem.item.note && onRecord({ note })}
            maxLength={500}
            placeholder={t('poznámka k úloze (jen pro tebe)', 'a note on the problem (for you only)')}
            className="min-w-48 flex-1"
          />
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------------- wrap

function Chips({
  all,
  selected,
  onChange,
  titleOf,
}: {
  all: string[];
  selected: string[];
  onChange: (next: string[]) => void;
  titleOf: (id: string) => string;
}) {
  return (
    <span className="flex flex-wrap gap-1.5">
      {all.map((id) => {
        const on = selected.includes(id);
        return (
          <button
            key={id}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(on ? selected.filter((entry) => entry !== id) : [...selected, id])}
            className={cn(
              'h-7 rounded-md border px-2 text-xs',
              on
                ? 'border-accent bg-accent-wash text-ink'
                : 'border-border-strong bg-surface-2 text-ink-2 hover:bg-surface-3',
            )}
          >
            {titleOf(id)}
          </button>
        );
      })}
    </span>
  );
}

function Wrap({
  session,
  base,
  onDone,
}: {
  session: TeachSessionDto;
  base: string;
  onDone: (next: TeachSessionDto) => void;
}) {
  const t = useT();
  const client = useQueryClient();
  const shown = [...new Set(session.items.map((item) => item.skill))];
  const [covered, setCovered] = useState<string[]>([]);
  const [extra, setExtra] = useState<string[]>([]);
  const [improved, setImproved] = useState<string[]>([]);
  const [hard, setHard] = useState<string[]>([]);
  const [homework, setHomework] = useState<string[]>([]);
  const [minutes, setMinutes] = useState(15);
  const [dueDay, setDueDay] = useState('');
  const [homeworkNote, setHomeworkNote] = useState('');
  const [misconceptions, setMisconceptions] = useState('');
  const [next, setNext] = useState('');
  const [summary, setSummary] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const titleOf = (id: string): string => {
    const skill = session.skills.find((entry) => entry.id === id);
    return skill ? t(skill.title) : id;
  };
  // What was shown is offered as covered; anything else can be added.
  const candidates = [...new Set([...shown, ...extra])];
  const topics = [...new Set([...covered, ...hard])];
  const addable = (skills: Skill[], taken: string[]): Skill[] => skills.filter((entry) => !taken.includes(entry.id));

  const finish = async (event: FormEvent): Promise<void> => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const done = await api.post<TeachSessionDto>(`${base}/finish`, {
        covered,
        improved,
        hard,
        misconceptions,
        next,
        summary,
        homework:
          homework.length > 0 ? { skills: homework, minutes, dueDay: dueDay || null, note: homeworkNote } : null,
      });
      onDone(done);
      await client.invalidateQueries({ queryKey: ['teach'] });
    } catch (failure) {
      setError(failure);
    } finally {
      setBusy(false);
    }
  };
  const area =
    'w-full rounded-lg border border-border-strong bg-surface-2 px-3 py-2 text-sm placeholder:text-ink-3 focus:border-accent focus:outline-none';

  return (
    <Card className="p-5">
      <SectionLabel>{t('Po sezení', 'After the session')}</SectionLabel>
      <form onSubmit={finish} className="mt-3 space-y-4">
        <Field label={t('Co se probralo', 'What was covered')}>
          <Chips all={candidates} selected={covered} onChange={setCovered} titleOf={titleOf} />
          <Select
            value=""
            onChange={(event) => {
              const id = event.target.value;
              if (id) {
                setExtra((list) => [...list, id]);
                setCovered((list) => [...list, id]);
              }
            }}
            className="mt-2 max-w-xs"
          >
            <option value="">{t('— přidat další dovednost —', '— add another skill —')}</option>
            {addable(session.skills, candidates).map((entry) => (
              <option key={entry.id} value={entry.id}>
                {t(entry.title)}
              </option>
            ))}
          </Select>
        </Field>
        {topics.length > 0 && (
          <>
            <Field
              label={t('Co dělalo potíže', 'What caused difficulty')}
              hint={t(
                'Tyhle dovednosti přijdou v dalších dnech na řadu přednostně.',
                'These skills come first over the coming days.',
              )}
            >
              <Chips all={candidates} selected={hard} onChange={setHard} titleOf={titleOf} />
            </Field>
            <Field
              label={t('Co se zlepšilo', 'What improved')}
              hint={t(
                'Zapíše se to; úroveň se tím nezmění. Tu mění jen vlastní samostatná práce — probrané dovednosti se proto brzy vrátí k ověření.',
                'It is written down; no level changes by it. Only the learner’s own work changes a level — which is why covered skills soon come back to be checked.',
              )}
            >
              <Chips all={topics} selected={improved} onChange={setImproved} titleOf={titleOf} />
            </Field>
          </>
        )}
        <Field label={t('Mylné představy, které se ukázaly', 'Misconceptions that showed')}>
          <textarea
            value={misconceptions}
            onChange={(event) => setMisconceptions(event.target.value)}
            rows={2}
            maxLength={2000}
            className={area}
          />
        </Field>
        <Field
          label={t('Domácí práce', 'Homework')}
          hint={t(
            'Zobrazí se jako zadaná práce, se vzkazem. Nepovinné.',
            'It shows as assigned work, with the line below. Optional.',
          )}
        >
          <Chips
            all={session.skills
              .filter((entry) => homework.includes(entry.id) || topics.includes(entry.id))
              .map((entry) => entry.id)}
            selected={homework}
            onChange={setHomework}
            titleOf={titleOf}
          />
          <Select
            value=""
            onChange={(event) =>
              event.target.value && setHomework((list) => [...new Set([...list, event.target.value])])
            }
            className="mt-2 max-w-xs"
          >
            <option value="">{t('— přidat dovednost —', '— add a skill —')}</option>
            {addable(session.skills, homework).map((entry) => (
              <option key={entry.id} value={entry.id}>
                {t(entry.title)}
              </option>
            ))}
          </Select>
          {homework.length > 0 && (
            <span className="mt-2 flex flex-wrap items-end gap-3">
              <span>
                <span className="mb-1 block text-xs text-ink-3">{t('Minut', 'Minutes')}</span>
                <TextInput
                  type="number"
                  min={5}
                  max={90}
                  value={minutes}
                  onChange={(event) => setMinutes(Number(event.target.value))}
                  className="w-24"
                />
              </span>
              <span>
                <span className="mb-1 block text-xs text-ink-3">{t('Do kdy', 'Due')}</span>
                <TextInput
                  type="date"
                  value={dueDay}
                  onChange={(event) => setDueDay(event.target.value)}
                  className="w-44"
                />
              </span>
              <span className="min-w-48 flex-1">
                <span className="mb-1 block text-xs text-ink-3">
                  {t('Vzkaz k zadání', 'A line with the assignment')}
                </span>
                <TextInput
                  value={homeworkNote}
                  maxLength={300}
                  onChange={(event) => setHomeworkNote(event.target.value)}
                />
              </span>
            </span>
          )}
        </Field>
        <Field label={t('Na příště', 'For next time')}>
          <textarea
            value={next}
            onChange={(event) => setNext(event.target.value)}
            rows={2}
            maxLength={1000}
            className={area}
          />
        </Field>
        <Field label={t('Shrnutí (jen pro tebe)', 'Summary (for you only)')}>
          <textarea
            value={summary}
            onChange={(event) => setSummary(event.target.value)}
            rows={2}
            maxLength={2000}
            className={area}
          />
        </Field>
        <Notice tone="info">
          {t(
            'Co se uloží kam: probrané a těžké dovednosti a domácí práce jdou do žákovského účtu a změní, co se v něm nabízí. Mylné představy, „na příště“ a shrnutí zůstávají u tebe — ze žákovského účtu vidět nejsou.',
            'What is stored where: covered and difficult skills and the homework go to the learner and change what they are given. Misconceptions, “for next time” and the summary stay with you — the learner does not see them.',
          )}
        </Notice>
        {error !== null && <ErrorNote error={error} />}
        <Button type="submit" variant="primary" size="lg" busy={busy}>
          {t('Uzavřít sezení', 'Close the session')}
        </Button>
      </form>
    </Card>
  );
}

// -------------------------------------------------------------------------------- record

function Record({ session }: { session: TeachSessionDto }) {
  const t = useT();
  const wrap = session.wrap;
  const titleOf = (id: string): string => {
    const skill = session.skills.find((entry) => entry.id === id);
    return skill ? t(skill.title) : id;
  };
  const list = (ids: string[]): string => (ids.length === 0 ? '—' : ids.map(titleOf).join(', '));
  return (
    <div className="space-y-5">
      <Card className="p-5">
        <SectionLabel>{t('Záznam sezení', 'Session record')}</SectionLabel>
        <p className="mt-1 text-xs text-ink-3">
          {t('Uzavřeno', 'Closed')} {formatDateTime(session.finishedAt ?? session.startedAt, t.locale)}
        </p>
        {wrap && (
          <dl className="mt-3 space-y-2.5 text-sm">
            {(
              [
                [t('Probráno', 'Covered'), list(wrap.covered)],
                [t('Dělalo potíže', 'Caused difficulty'), list(wrap.hard)],
                [t('Zlepšilo se', 'Improved'), list(wrap.improved)],
                [t('Mylné představy', 'Misconceptions'), wrap.misconceptions || '—'],
                [
                  t('Domácí práce', 'Homework'),
                  wrap.homework
                    ? `${list(wrap.homework.skills)} · ${wrap.homework.minutes} min${wrap.homework.dueDay ? ` · ${t('do', 'by')} ${formatDay(wrap.homework.dueDay, t.locale)}` : ''}${wrap.homework.note ? ` · „${wrap.homework.note}“` : ''}`
                    : '—',
                ],
                [t('Na příště', 'For next time'), wrap.next || '—'],
                [t('Shrnutí', 'Summary'), wrap.summary || '—'],
              ] as const
            ).map(([label, value]) => (
              <div key={label} className="flex gap-3">
                <dt className="w-32 shrink-0 text-ink-3">{label}</dt>
                <dd className="min-w-0 flex-1 whitespace-pre-wrap">{value}</dd>
              </div>
            ))}
          </dl>
        )}
        {session.items.length > 0 && (
          <ul className="mt-4 divide-y divide-border border-t border-border">
            {session.items.map((item, index) => (
              <li key={item.id} className="flex flex-wrap items-center gap-3 py-2 text-sm">
                <span className="w-4 font-mono text-xs text-ink-3">{index + 1}</span>
                <span className="min-w-0 flex-1 truncate">{t(item.title)}</span>
                <span className="text-xs text-ink-3">
                  {t('úroveň', 'level')} {item.level}
                </span>
                <span className="text-xs text-ink-2">{item.outcome ? t(OUTCOME_NAMES[item.outcome]) : '—'}</span>
                {item.note && <span className="w-full pl-7 text-[13px] text-ink-2">{item.note}</span>}
              </li>
            ))}
          </ul>
        )}
      </Card>
      <Brief brief={session.brief} />
    </div>
  );
}
