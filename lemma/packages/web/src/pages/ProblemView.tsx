import {
  type AnswerResultDto,
  type Confidence,
  type ErrorType,
  type OutcomeDto,
  type ProblemDto,
  type PublicAnswerSpec,
  type SelfModelDto,
  type SettingsDto,
  ERROR_FAMILIES,
  ERROR_FAMILY,
  ERROR_INFO,
  ERROR_TYPES,
  interpretAnswer,
} from '@lemma/core';
import { ArrowRight, CircleHelp, Cpu, Eye, Lightbulb, MessageSquare, Wrench } from 'lucide-react';
import { type FormEvent, type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router';
import { api } from '../app/api';
import { Gates } from '../app/components';
import { useT } from '../app/i18n';
import { CONTEXT_NAMES, FAMILY_NAMES, KIND_NAMES, LEVEL_NAMES, PURPOSE_NAMES, whyText } from '../app/labels';
import { useMilestones } from '../app/queries';
import { Figure } from '../figure/Figure';
import { cn } from '../lib/cn';
import { clock, pct } from '../lib/format';
import { RichText, Tex } from '../lib/Math';
import { useTutor } from '../tutor/context';
import { Badge, Button, ErrorNote, Meter, Notice, Segmented, StatusIcon } from '../ui';
import { LevelBar } from '../viz/charts';

interface Props {
  problem: ProblemDto;
  settings: SettingsDto;
  /** Called with the server's latest view of the problem after every action. */
  onChange: (problem: ProblemDto) => void;
  /** Present once the problem is resolved: what the main button does next. */
  onNext?: () => void;
  nextLabel?: string;
  /** Hide the skill-progress part of the outcome (lesson checks keep it short). */
  compact?: boolean;
}

/** A problem from statement to outcome: entry, live reading of the input, hints, feedback. */
export function ProblemView({ problem, settings, onChange, onNext, nextLabel, compact = false }: Props) {
  const t = useT();
  const tutor = useTutor();
  const [feedback, setFeedback] = useState<AnswerResultDto | null>(null);
  const [failure, setFailure] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const [confidence, setConfidence] = useState<Confidence | null>(null);
  const [confirmReveal, setConfirmReveal] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const startedAt = useRef(performance.now());
  const open = problem.status === 'open';
  // A placement test: one answer, no help, and nothing said about it until the test is over.
  const placement = problem.context === 'diagnostic';

  // A new problem starts a new clock and clears what belonged to the previous one.
  useEffect(() => {
    startedAt.current = performance.now();
    setFeedback(null);
    setFailure(null);
    setConfidence(null);
    setConfirmReveal(false);
    setElapsed(0);
  }, [problem.id]);

  useEffect(() => {
    if (!open) return;
    const timer = setInterval(() => setElapsed((performance.now() - startedAt.current) / 1000), 1000);
    return () => clearInterval(timer);
  }, [open, problem.id]);

  const seconds = (): number => Math.max(1, Math.round((performance.now() - startedAt.current) / 1000));

  const act = async (run: () => Promise<void>): Promise<void> => {
    setBusy(true);
    setFailure(null);
    try {
      await run();
    } catch (error) {
      setFailure(error);
    } finally {
      setBusy(false);
    }
  };

  const submit = (input: string): Promise<void> =>
    act(async () => {
      const result = await api.post<AnswerResultDto>(`/api/problems/${problem.id}/answer`, {
        input,
        seconds: seconds(),
        confidence: confidence ?? undefined,
      });
      setFeedback(result);
      onChange(result.problem);
    });
  const hint = (): Promise<void> =>
    act(async () => onChange(await api.post<ProblemDto>(`/api/problems/${problem.id}/hint`)));
  const reveal = (): Promise<void> =>
    act(async () => onChange(await api.post<ProblemDto>(`/api/problems/${problem.id}/reveal`, { seconds: seconds() })));
  const classify = (errorType: ErrorType): Promise<void> =>
    act(async () => onChange(await api.post<ProblemDto>(`/api/problems/${problem.id}/classify`, { errorType })));

  return (
    <article>
      <div className="mb-3 flex flex-wrap items-center gap-x-2 gap-y-1.5">
        <Badge tone="accent">{t(CONTEXT_NAMES[problem.context])}</Badge>
        <Badge>{t(KIND_NAMES[problem.kind])}</Badge>
        <Badge title={t('Obtížnost úlohy', 'Problem difficulty')}>
          {t('úroveň', 'level')} {problem.level}/5
        </Badge>
        {problem.it && (
          <Badge title={t('Úloha z IT praxe', 'A problem from IT practice')}>
            <Cpu size={11} aria-hidden /> IT
          </Badge>
        )}
        {problem.applied && !problem.it && (
          <Badge>
            <Wrench size={11} aria-hidden /> {t('z praxe', 'applied')}
          </Badge>
        )}
        <span className="min-w-0 flex-1 truncate text-right text-[13px] text-ink-3">
          {problem.concept ? (
            <Link to={`/concept/${problem.concept}`} className="text-ink-2">
              {problem.conceptTitle ? t(problem.conceptTitle) : problem.concept}
            </Link>
          ) : (
            t(
              'téma neuvedeno — poznat typ úlohy je součást úkolu',
              'topic not given — recognising the problem type is part of the task',
            )
          )}
        </span>
        {open && (
          <span
            className="font-mono text-xs text-ink-3"
            title={`${t('Obvyklý čas', 'Typical time')}: ${clock(problem.estSeconds)}`}
          >
            {clock(elapsed)}
          </span>
        )}
      </div>

      {problem.why && (
        <p className="mb-3 text-[13px] text-ink-3">
          <span className="font-medium text-ink-2">{t('Proč tahle úloha: ', 'Why this problem: ')}</span>
          {whyText(problem.why, t)} <span className="font-mono text-xs">({t(PURPOSE_NAMES[problem.why.purpose])})</span>
        </p>
      )}

      <div className="text-[1.0625rem] leading-relaxed">
        <RichText text={t(problem.prompt)} />
      </div>
      {problem.figure && <Figure spec={problem.figure} className="mt-4" />}

      <div className="mt-5">
        <AnswerEntry
          key={problem.id}
          problem={problem}
          settings={settings}
          disabled={!open || busy}
          onSubmit={(input) => void submit(input)}
          outcome={problem.outcome}
        >
          {open && settings.confidencePrompt && problem.wrongAttempts === 0 && problem.answer.kind !== 'self' && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-ink-3">{t('Jak moc si věříš?', 'How sure are you?')}</span>
              <Segmented
                label={t('Jistota', 'Confidence')}
                size="sm"
                value={confidence ?? ''}
                onChange={(value) => setConfidence(value === '' ? null : (value as Confidence))}
                options={[
                  { value: 'sure', label: t('jistě', 'sure') },
                  { value: 'think', label: t('asi', 'I think') },
                  { value: 'guess', label: t('tipuju', 'guessing') },
                ]}
              />
            </div>
          )}
        </AnswerEntry>
      </div>

      {open && problem.previousInputs.length > 0 && (
        <div className="mt-3 text-[13px] text-ink-3">
          {t('Předchozí pokusy: ', 'Already tried: ')}
          {problem.previousInputs.map((input, index) => (
            <code key={index} className="mr-1.5 rounded border border-border bg-surface-2 px-1.5 py-0.5 text-ink-2">
              {input}
            </code>
          ))}
        </div>
      )}

      {open && feedback?.verdict === 'invalid' && feedback.message && (
        <Notice tone="warning" className="mt-3" title={t('Tomuhle zápisu nerozumím', 'I cannot read this input')}>
          {t(feedback.message)} {t('Nepočítá se to jako pokus.', 'It does not count as an attempt.')}
        </Notice>
      )}
      {open && feedback?.verdict === 'incorrect' && (
        <Notice
          tone="serious"
          className="mt-3"
          title={`${t('To není ono.', 'Not quite.')} ${problem.triesLeft === 1 ? t('Zbývá poslední pokus.', 'One attempt left.') : t(`Zbývají ${problem.triesLeft} pokusy.`, `${problem.triesLeft} attempts left.`)}`}
        >
          {feedback.error?.note ? (
            <RichText text={t(feedback.error.note)} />
          ) : feedback.error && feedback.error.confident ? (
            `${t('Vypadá to na', 'It looks like')}: ${t(ERROR_INFO[feedback.error.type].title).toLowerCase()}.`
          ) : (
            t(
              'Než to zkusíš znovu, projdi svůj postup řádek po řádku.',
              'Before trying again, go through your working line by line.',
            )
          )}
        </Notice>
      )}

      {open && problem.hints.length > 0 && (
        <ol className="mt-4 space-y-2">
          {problem.hints.map((text, index) => (
            <li key={index} className="flex gap-2.5 rounded-lg border border-border bg-surface-2 px-3 py-2.5 text-sm">
              <Lightbulb size={15} className="mt-0.5 shrink-0 text-ink-3" aria-hidden />
              <div className="min-w-0">
                <div className="mono-label mb-0.5">
                  {t('Nápověda', 'Hint')} {index + 1}/{problem.hintCount}
                </div>
                <RichText text={t(text)} />
              </div>
            </li>
          ))}
        </ol>
      )}

      {open && (
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border pt-4">
          {problem.hintCount > 0 && (
            <Button
              size="sm"
              onClick={() => void hint()}
              disabled={busy || problem.hints.length >= problem.hintCount}
              title={t(
                'Každá nápověda snižuje, kolik se úloha započítá.',
                'Each hint reduces how much the problem counts.',
              )}
            >
              <Lightbulb size={13} />
              {problem.hints.length >= problem.hintCount
                ? t('Nápovědy vyčerpány', 'No more hints')
                : `${t('Nápověda', 'Hint')} ${problem.hints.length + 1}/${problem.hintCount}`}
            </Button>
          )}
          {tutor.enabled && !placement && (
            <Button
              size="sm"
              onClick={() => tutor.open({ problemId: problem.id, concept: problem.concept ?? undefined })}
              title={t('Počítá se jako nápověda.', 'Counts as a hint.')}
            >
              <MessageSquare size={13} />
              {t('Zeptat se tutora', 'Ask the tutor')}
            </Button>
          )}
          <span className="flex-1" />
          {placement ? (
            // No shame in it and no second question: in a placement test this is an answer like any other.
            <Button size="sm" onClick={() => void reveal()} disabled={busy}>
              {t('Tohle neumím', 'I do not know this')}
            </Button>
          ) : confirmReveal ? (
            <span className="flex flex-wrap items-center gap-2 text-[13px] text-ink-2">
              {t('Zapíše se jako nevyřešená.', 'It will be recorded as not solved.')}
              <Button size="sm" variant="danger" onClick={() => void reveal()} disabled={busy}>
                {t('Ukázat řešení', 'Show the solution')}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setConfirmReveal(false)}>
                {t('Ještě zkusím', 'I will keep trying')}
              </Button>
            </span>
          ) : (
            <Button size="sm" variant="ghost" onClick={() => setConfirmReveal(true)} disabled={busy}>
              <Eye size={13} />
              {t('Vzdát a ukázat řešení', 'Give up and see the solution')}
            </Button>
          )}
        </div>
      )}

      {failure !== null && (
        <div className="mt-3">
          <ErrorNote error={failure} />
        </div>
      )}

      {problem.status === 'recorded' && (
        <section className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-surface-2 p-4">
          <span className="text-sm text-ink-2">
            {t(
              'Zaznamenáno. Co bylo správně, uvidíš po skončení testu.',
              'Recorded. What was right is shown once the test is over.',
            )}
          </span>
          {onNext && (
            <Button variant="primary" size="lg" onClick={onNext} autoFocus>
              {nextLabel ?? t('Další úloha', 'Next problem')}
              <ArrowRight size={15} />
            </Button>
          )}
        </section>
      )}

      {problem.outcome && (
        <Outcome
          problem={problem}
          outcome={problem.outcome}
          compact={compact}
          busy={busy}
          onClassify={(type) => void classify(type)}
          onNext={onNext}
          nextLabel={nextLabel}
        />
      )}
    </article>
  );
}

// --------------------------------------------------------------------------- answer entry

const EXAMPLES: Record<string, { cs: string[]; en: string[] }> = {
  number: { cs: ['3/4', '2,5', 'sqrt(2)', 'pi/6', '2^10'], en: ['3/4', '2.5', 'sqrt(2)', 'pi/6', '2^10'] },
  expr: {
    cs: ['x^2 - 4x + 3', '(x-2)^2 - 1', '2*sqrt(x)', '|x-1|'],
    en: ['x^2 - 4x + 3', '(x-2)^2 - 1', '2*sqrt(x)', '|x-1|'],
  },
  set: { cs: ['{-1; 3}', '{}', 'R'], en: ['{-1; 3}', '{}', 'R'] },
  interval: {
    cs: ['(-inf; 2>', '<1; 3)', '(-inf; 1) u (3; inf)', 'R \\ {2}', 'x > 2'],
    en: ['(-inf; 2]', '[1; 3)', '(-inf; 1) u (3; inf)', 'R \\ {2}', 'x > 2'],
  },
  point: { cs: ['[2; -1]'], en: ['(2; -1)'] },
  complex: { cs: ['3 - 2i', '-i', '1/2 + i*sqrt(3)/2'], en: ['3 - 2i', '-i', '1/2 + i*sqrt(3)/2'] },
};

function AnswerEntry({
  problem,
  settings,
  disabled,
  onSubmit,
  outcome,
  children,
}: {
  problem: ProblemDto;
  settings: SettingsDto;
  disabled: boolean;
  onSubmit: (input: string) => void;
  outcome: OutcomeDto | null;
  children?: ReactNode;
}) {
  const t = useT();
  const spec = problem.answer;
  const open = problem.status === 'open';

  if (spec.kind === 'choice')
    return (
      <ChoiceEntry
        spec={spec}
        disabled={disabled}
        open={open}
        onSubmit={onSubmit}
        correct={outcome?.correctOptions ?? null}
        extra={children}
      />
    );
  if (spec.kind === 'spot')
    return (
      <SpotEntry
        spec={spec}
        disabled={disabled}
        open={open}
        onSubmit={onSubmit}
        wrongLine={outcome?.wrongLine ?? null}
        extra={children}
      />
    );
  if (spec.kind === 'self')
    return open ? <SelfEntry problemId={problem.id} disabled={disabled} onSubmit={onSubmit} /> : null;
  if (!open) return null;
  return (
    <TextEntry
      spec={spec}
      settings={settings}
      disabled={disabled}
      onSubmit={onSubmit}
      extra={children}
      retry={problem.wrongAttempts > 0}
      label={t('Tvoje odpověď', 'Your answer')}
    />
  );
}

function TextEntry({
  spec,
  settings,
  disabled,
  onSubmit,
  extra,
  retry,
  label,
}: {
  spec: Exclude<PublicAnswerSpec, { kind: 'choice' | 'spot' | 'self' }>;
  settings: SettingsDto;
  disabled: boolean;
  onSubmit: (input: string) => void;
  extra?: ReactNode;
  retry: boolean;
  label: string;
}) {
  const t = useT();
  const [value, setValue] = useState('');
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => input.current?.focus(), []);
  // After a wrong attempt the field is ready for the next one.
  useEffect(() => {
    if (!disabled) input.current?.focus();
  }, [disabled]);

  const reading = useMemo(
    () =>
      value.trim() === ''
        ? null
        : interpretAnswer(spec, value, { decimalComma: settings.decimalComma, locale: t.locale }),
    [spec, value, settings.decimalComma, t.locale],
  );
  const submit = (event: FormEvent): void => {
    event.preventDefault();
    if (value.trim() !== '' && !disabled) onSubmit(value);
  };
  const examples = EXAMPLES[spec.kind]?.[t.locale] ?? [];
  // An angle is asked for in a particular unit: show an example in that unit.
  const unitExample =
    spec.kind === 'number'
      ? spec.unit === 'deg'
        ? '45°'
        : spec.unit === 'rad'
          ? 'pi/3'
          : undefined
      : spec.kind === 'set' && spec.unit === 'rad'
        ? 'pi/6; 5pi/6'
        : undefined;
  const expectation: Record<typeof spec.kind, string> = {
    number:
      spec.kind === 'number' && spec.unit === 'deg'
        ? t('Očekává se úhel ve stupních.', 'An angle in degrees is expected.')
        : spec.kind === 'number' && spec.unit === 'rad'
          ? t(
              'Očekává se úhel v radiánech, např. 5π/6 (piš „pi“ nebo π).',
              'An angle in radians is expected, e.g. 5π/6 (type “pi” or π).',
            )
          : spec.kind === 'number' && spec.form === 'reduced'
            ? t(
                'Očekává se celé číslo nebo zlomek v základním tvaru, např. 3/4.',
                'A whole number or a fraction in lowest terms is expected, e.g. 3/4.',
              )
            : t(
                'Očekává se číslo; může to být zlomek nebo výraz s odmocninou.',
                'A number is expected; a fraction or a root is fine.',
              ),
    expr: t('Očekává se výraz.', 'An expression is expected.'),
    set:
      spec.kind === 'set' && spec.unit === 'rad'
        ? t(
            'Očekává se množina všech řešení, úhly v radiánech (piš „pi“ nebo π).',
            'The set of all solutions is expected, angles in radians (type “pi” or π).',
          )
        : t('Očekává se množina všech řešení.', 'The set of all solutions is expected.'),
    interval: t('Očekává se interval nebo sjednocení intervalů.', 'An interval or a union of intervals is expected.'),
    point: t('Očekává se bod.', 'A point is expected.'),
    complex:
      spec.kind === 'complex' && spec.form === 'algebraic'
        ? t(
            'Očekává se komplexní číslo ve tvaru a + bi, například -1 + √3 i.',
            'A complex number in the form a + bi is expected, for example -1 + √3 i.',
          )
        : t('Očekává se komplexní číslo.', 'A complex number is expected.'),
  };
  const formNote =
    spec.kind === 'expr' && spec.form
      ? {
          expanded: t('Ve tvaru roznásobeného mnohočlenu.', 'In expanded form.'),
          factored: t('V součinovém tvaru.', 'In factored form.'),
          vertex: t('Ve vrcholovém tvaru.', 'In vertex form.'),
        }[spec.form]
      : null;

  return (
    <form onSubmit={submit}>
      <div className="flex flex-wrap items-center gap-2.5">
        {spec.label && <Tex tex={spec.label} className="text-lg" />}
        <input
          ref={input}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          disabled={disabled}
          aria-label={label}
          placeholder={spec.placeholder ?? unitExample ?? examples[0] ?? ''}
          autoComplete="off"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          className="h-11 min-w-0 flex-1 basis-56 rounded-lg border border-border-strong bg-surface-2 px-3 font-mono text-base placeholder:text-ink-3 focus:border-accent focus:outline-none disabled:opacity-60"
        />
        <Button type="submit" variant="primary" size="lg" disabled={disabled || value.trim() === ''}>
          {retry ? t('Zkusit znovu', 'Try again') : t('Odeslat', 'Submit')}
        </Button>
      </div>

      <div className="mt-2 min-h-7 text-sm" aria-live="polite">
        {reading === null ? (
          <span className="text-ink-3">
            {expectation[spec.kind]} {formNote}
          </span>
        ) : reading.ok ? (
          <span className="text-ink-2">
            {t('Čtu to jako', 'I read this as')} <Tex tex={reading.tex} className="text-ink" />
          </span>
        ) : (
          <span className="text-ink-2">{t(reading.message)}</span>
        )}
      </div>

      <div className="mt-1 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <details className="text-[13px] text-ink-3">
          <summary className="inline-flex items-center gap-1 hover:text-ink-2">
            <CircleHelp size={13} aria-hidden />
            {t('Jak to zapsat', 'How to type it')}
          </summary>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {examples.map((example) => (
              <code key={example} className="rounded border border-border bg-surface-2 px-1.5 py-0.5 text-ink-2">
                {example}
              </code>
            ))}
          </div>
          <div className="mt-1.5">
            {settings.decimalComma
              ? t(
                  'Desetinná čárka: 2,5. Položky odděluj středníkem. Násobení jde psát i bez hvězdičky: 2x.',
                  'Decimal comma: 2,5. Separate items with a semicolon. Multiplication may be implicit: 2x.',
                )
              : t(
                  'Desetinná tečka: 2.5. Položky odděluj středníkem. Násobení jde psát i bez hvězdičky: 2x.',
                  'Decimal point: 2.5. Separate items with a semicolon. Multiplication may be implicit: 2x.',
                )}
          </div>
        </details>
        {extra}
      </div>
    </form>
  );
}

function ChoiceEntry({
  spec,
  disabled,
  open,
  onSubmit,
  correct,
  extra,
}: {
  spec: Extract<PublicAnswerSpec, { kind: 'choice' }>;
  disabled: boolean;
  open: boolean;
  onSubmit: (input: string) => void;
  correct: string[] | null;
  extra?: ReactNode;
}) {
  const t = useT();
  const [picked, setPicked] = useState<string[]>([]);
  const toggle = (id: string): void =>
    setPicked((current) =>
      spec.multi ? (current.includes(id) ? current.filter((x) => x !== id) : [...current, id]) : [id],
    );
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (picked.length > 0 && !disabled) onSubmit(picked.join(','));
      }}
    >
      {spec.multi && open && (
        <div className="mb-2 text-[13px] text-ink-3">
          {t('Může být správně víc možností.', 'More than one option may be right.')}
        </div>
      )}
      <div role={spec.multi ? 'group' : 'radiogroup'} className="space-y-2">
        {spec.options.map((option) => {
          const selected = picked.includes(option.id);
          const isCorrect = correct?.includes(option.id) ?? false;
          return (
            <button
              key={option.id}
              type="button"
              role={spec.multi ? 'checkbox' : 'radio'}
              aria-checked={selected}
              disabled={disabled || !open}
              onClick={() => toggle(option.id)}
              className={cn(
                'flex w-full items-start gap-3 rounded-lg border px-3.5 py-2.5 text-left transition-colors disabled:cursor-default',
                selected ? 'border-accent bg-accent-wash' : 'border-border-strong bg-surface-2',
                open && !selected && 'hover:bg-surface-3',
              )}
            >
              <span
                className={cn(
                  'mt-1 grid h-4 w-4 shrink-0 place-items-center border',
                  spec.multi ? 'rounded' : 'rounded-full',
                  selected ? 'border-accent' : 'border-border-strong',
                )}
              >
                {selected && (
                  <span className={cn('h-2 w-2 bg-accent', spec.multi ? 'rounded-[2px]' : 'rounded-full')} />
                )}
              </span>
              <span className="min-w-0 flex-1">
                <RichText text={t(option.text)} inlineOnly />
              </span>
              {!open && correct && isCorrect && (
                <span className="flex shrink-0 items-center gap-1 text-xs text-ink-2">
                  <StatusIcon tone="good" size={14} />
                  {t('správně', 'correct')}
                </span>
              )}
            </button>
          );
        })}
      </div>
      {open && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <Button type="submit" variant="primary" size="lg" disabled={disabled || picked.length === 0}>
            {t('Odeslat', 'Submit')}
          </Button>
          {extra}
        </div>
      )}
    </form>
  );
}

function SpotEntry({
  spec,
  disabled,
  open,
  onSubmit,
  wrongLine,
  extra,
}: {
  spec: Extract<PublicAnswerSpec, { kind: 'spot' }>;
  disabled: boolean;
  open: boolean;
  onSubmit: (input: string) => void;
  wrongLine: number | null;
  extra?: ReactNode;
}) {
  const t = useT();
  const [picked, setPicked] = useState<number | null>(null);
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (picked !== null && !disabled) onSubmit(String(picked));
      }}
    >
      <div className="mb-2 text-[13px] text-ink-3">
        {t(
          'Klikni na první řádek, který neplyne z předchozího.',
          'Click the first line that does not follow from the one before.',
        )}
      </div>
      <ol role="radiogroup" className="overflow-hidden rounded-lg border border-border-strong">
        {spec.lines.map((line, index) => {
          const selected = picked === index;
          const isWrong = wrongLine === index;
          return (
            <li key={index} className={cn(index > 0 && 'border-t border-border')}>
              <button
                type="button"
                role="radio"
                aria-checked={selected}
                disabled={disabled || !open}
                onClick={() => setPicked(index)}
                className={cn(
                  'flex w-full items-center gap-3 px-3 py-2 text-left disabled:cursor-default',
                  selected ? 'bg-accent-wash' : 'bg-surface-2',
                  open && !selected && 'hover:bg-surface-3',
                )}
              >
                <span className="w-5 shrink-0 font-mono text-xs text-ink-3">{index + 1}</span>
                <span className="min-w-0 flex-1 overflow-x-auto">
                  <Tex tex={line.tex} />
                </span>
                {!open && isWrong && (
                  <span className="flex shrink-0 items-center gap-1 text-xs text-ink-2">
                    <StatusIcon tone="critical" size={14} />
                    {t('tady je chyba', 'the error is here')}
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ol>
      {open && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <Button type="submit" variant="primary" size="lg" disabled={disabled || picked === null}>
            {t('Odeslat', 'Submit')}
          </Button>
          {extra}
        </div>
      )}
    </form>
  );
}

/** Write an explanation, compare it with the model, then grade it yourself. */
function SelfEntry({
  problemId,
  disabled,
  onSubmit,
}: {
  problemId: string;
  disabled: boolean;
  onSubmit: (input: string) => void;
}) {
  const t = useT();
  const [text, setText] = useState('');
  const [model, setModel] = useState<SelfModelDto | null>(null);
  const [loading, setLoading] = useState(false);
  const compare = async (): Promise<void> => {
    setLoading(true);
    try {
      setModel(await api.get<SelfModelDto>(`/api/problems/${problemId}/model`));
    } finally {
      setLoading(false);
    }
  };
  return (
    <div>
      <label className="block">
        <span className="mb-1 block text-[13px] text-ink-3">
          {t(
            'Napiš to vlastními slovy, jako bys to vysvětloval spolužákovi. Text se nikam neodesílá — jde o to ho zformulovat.',
            'Write it in your own words, as if explaining to a classmate. The text is not sent anywhere — the point is to formulate it.',
          )}
        </span>
        <textarea
          value={text}
          onChange={(event) => setText(event.target.value)}
          rows={5}
          disabled={disabled || model !== null}
          className="w-full rounded-lg border border-border-strong bg-surface-2 px-3 py-2 text-sm placeholder:text-ink-3 focus:border-accent focus:outline-none disabled:opacity-70"
        />
      </label>
      {model === null ? (
        <Button
          variant="primary"
          size="lg"
          className="mt-3"
          onClick={() => void compare()}
          busy={loading}
          disabled={disabled || text.trim().length < 15}
        >
          {t('Porovnat se vzorem', 'Compare with the model answer')}
        </Button>
      ) : (
        <div className="mt-4 space-y-3">
          <div className="rounded-lg border border-border bg-surface-2 p-3.5">
            <div className="mono-label mb-1">{t('Vzorové vysvětlení', 'Model explanation')}</div>
            <RichText text={t(model.model)} className="text-sm" />
          </div>
          <div>
            <div className="mono-label mb-1">{t('Mělo by v tom být', 'It should contain')}</div>
            <ul className="list-disc space-y-1 pl-5 text-sm text-ink-2">
              {model.rubric.map((item, index) => (
                <li key={index}>
                  <RichText text={t(item)} inlineOnly />
                </li>
              ))}
            </ul>
          </div>
          <div>
            <div className="mb-1.5 text-sm">
              {t(
                'Jak tvoje vysvětlení obstálo? Buď k sobě upřímný — nikdo jiný to nevidí.',
                'How did your explanation hold up? Be honest — nobody else sees this.',
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => onSubmit('yes')} disabled={disabled}>
                {t('Mám všechno podstatné', 'I have everything essential')}
              </Button>
              <Button onClick={() => onSubmit('partly')} disabled={disabled}>
                {t('Něco chybí', 'Something is missing')}
              </Button>
              <Button onClick={() => onSubmit('no')} disabled={disabled}>
                {t('Minul jsem podstatu', 'I missed the point')}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ------------------------------------------------------------------------------- outcome

function Outcome({
  problem,
  outcome,
  compact,
  busy,
  onClassify,
  onNext,
  nextLabel,
}: {
  problem: ProblemDto;
  outcome: OutcomeDto;
  compact: boolean;
  busy: boolean;
  onClassify: (type: ErrorType) => void;
  onNext?: () => void;
  nextLabel?: string;
}) {
  const t = useT();
  const tutor = useTutor();
  const milestones = useMilestones();
  const next = useRef<HTMLButtonElement>(null);
  const self = problem.answer.kind === 'self';
  const hadError = problem.wrongAttempts > 0 || !outcome.solved;
  const [showSolution, setShowSolution] = useState(!outcome.solved || outcome.corrected);
  const chosen = outcome.errorConfirmed ?? outcome.error?.type ?? null;

  useEffect(() => next.current?.focus(), []);

  const tone = outcome.solved ? (outcome.corrected ? 'warning' : 'good') : 'critical';
  const headline = outcome.solved
    ? self
      ? outcome.credit >= 0.5
        ? t('Zapsáno jako zvládnuté', 'Recorded as done')
        : t('Zapsáno jako částečné', 'Recorded as partial')
      : outcome.corrected
        ? t('Správně — po opravě', 'Correct — after a correction')
        : t('Správně', 'Correct')
    : self
      ? t('Zapsáno jako nezvládnuté', 'Recorded as not done')
      : t('Nevyřešeno', 'Not solved');

  return (
    <section className="mt-5 rounded-xl border border-border bg-surface-2 p-4 sm:p-5" aria-live="polite">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <StatusIcon tone={tone} size={20} />
          <span className="text-lg font-semibold">{headline}</span>
        </div>
        <div className="font-mono text-xs text-ink-3">
          {outcome.points > 0 && `+${outcome.points} ${t('b.', 'pts')} · `}
          {t('započteno', 'counted')} {pct(outcome.credit, t.locale)}
        </div>
      </div>

      {outcome.answerTex[t.locale] !== '' && (!outcome.solved || outcome.corrected) && (
        <div className="mt-3 text-sm">
          <span className="text-ink-2">{t('Správná odpověď: ', 'Correct answer: ')}</span>
          <Tex tex={t(outcome.answerTex)} className="text-base" />
        </div>
      )}

      {self && outcome.model && (
        <div className="mt-3 rounded-lg border border-border bg-surface-1 p-3">
          <div className="mono-label mb-1">{t('Vzorové vysvětlení', 'Model explanation')}</div>
          <RichText text={t(outcome.model)} className="text-sm" />
        </div>
      )}

      {hadError && !self && (
        <div className="mt-4 border-t border-border pt-4">
          <div className="text-sm font-medium">{t('Co to bylo za chybu?', 'What kind of error was it?')}</div>
          <p className="mt-0.5 text-[13px] text-ink-3">
            {outcome.error
              ? outcome.errorConfirmed
                ? t('Tvoje označení. Jde kdykoli změnit.', 'Your label. It can be changed at any time.')
                : t(
                    'Tohle je odhad aplikace. Ty to víš líp — oprav ho, když nesedí.',
                    'This is the app’s guess. You know better — correct it if it is off.',
                  )
              : t('Označ ji; podle toho se pak skládá trénink.', 'Label it; drills are built from this.')}
          </p>
          {outcome.error?.note && !outcome.errorConfirmed && (
            <div className="mt-2 text-[13px] text-ink-2">
              <RichText text={t(outcome.error.note)} />
            </div>
          )}
          <div className="mt-3 space-y-2">
            {ERROR_FAMILIES.map((family) => (
              <div key={family} className="flex flex-wrap items-center gap-1.5">
                <span className="w-24 shrink-0 text-xs text-ink-3">{t(FAMILY_NAMES[family])}</span>
                {ERROR_TYPES.filter((type) => ERROR_FAMILY[type] === family).map((type) => (
                  <button
                    key={type}
                    type="button"
                    disabled={busy}
                    aria-pressed={chosen === type}
                    onClick={() => onClassify(type)}
                    title={t(ERROR_INFO[type].description)}
                    className={cn(
                      'h-7 rounded-md border px-2 text-xs transition-colors',
                      chosen === type
                        ? 'border-accent bg-accent-wash text-ink'
                        : 'border-border-strong bg-surface-1 text-ink-2 hover:bg-surface-3 hover:text-ink',
                    )}
                  >
                    {t(ERROR_INFO[type].title)}
                  </button>
                ))}
              </div>
            ))}
          </div>
          {chosen && (
            <div className="mt-3 flex gap-2 rounded-lg border border-border bg-surface-1 px-3 py-2 text-[13px]">
              <Wrench size={14} className="mt-0.5 shrink-0 text-ink-3" aria-hidden />
              <div>
                <span className="text-ink-3">{t('Návyk proti ní: ', 'The habit against it: ')}</span>
                <span className="text-ink-2">{t(ERROR_INFO[chosen].remedy)}</span>
              </div>
            </div>
          )}
        </div>
      )}

      {outcome.solution.length > 0 && (
        <div className="mt-4 border-t border-border pt-4">
          <button
            type="button"
            className="text-sm font-medium text-accent-ink hover:underline"
            onClick={() => setShowSolution((value) => !value)}
            aria-expanded={showSolution}
          >
            {showSolution
              ? t('Skrýt postup', 'Hide the working')
              : t('Ukázat postup řešení', 'Show the worked solution')}
          </button>
          {showSolution && (
            <ol className="mt-3 space-y-3">
              {outcome.solution.map((step, index) => (
                <li key={index} className="flex gap-3">
                  <span className="mt-0.5 w-5 shrink-0 font-mono text-xs text-ink-3">{index + 1}</span>
                  <div className="min-w-0 flex-1 text-sm">
                    <RichText text={t(step.text)} />
                    {step.math !== undefined && (
                      <Tex tex={typeof step.math === 'string' ? step.math : t(step.math)} display />
                    )}
                  </div>
                </li>
              ))}
            </ol>
          )}
        </div>
      )}

      {!compact && (
        <div className="mt-4 border-t border-border pt-4">
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
            <Link to={`/concept/${outcome.skill.id}`} className="text-sm font-medium text-ink">
              {t(outcome.skill.title)}
            </Link>
            <div className="flex items-center gap-2 text-[13px] text-ink-2">
              {outcome.skill.levelAfter !== outcome.skill.levelBefore && (
                <>
                  <span>{t(LEVEL_NAMES[outcome.skill.levelBefore])}</span>
                  <ArrowRight size={13} aria-hidden />
                </>
              )}
              <LevelBar level={outcome.skill.levelAfter} size="sm" showName />
            </div>
          </div>
          <Meter
            value={outcome.skill.progressAfter}
            className="mt-2"
            label={t('Postup dovednosti', 'Skill progress')}
          />
          {outcome.skill.levelAfter > outcome.skill.levelBefore && (
            <Notice
              tone="good"
              className="mt-3"
              title={`${t('Nová úroveň', 'New level')}: ${t(LEVEL_NAMES[outcome.skill.levelAfter])}`}
            />
          )}
          {outcome.skill.levelAfter < outcome.skill.levelBefore && (
            <p className="mt-2 text-[13px] text-ink-3">
              {t(
                'Úroveň klesla: poslední důkazy jí neodpovídají. Vrátí se, jakmile se zase potvrdí.',
                'The level dropped: recent evidence does not support it. It returns once confirmed again.',
              )}
            </p>
          )}
          {outcome.reviewPassed && (
            <p className="mt-2 text-[13px] text-ink-3">
              {t(
                'Počítá se jako úspěšné opakování — další připomenutí se odsune.',
                'Counts as a passed review — the next reminder moves further out.',
              )}
            </p>
          )}
          {outcome.skill.next && (
            <details className="mt-3">
              <summary className="text-[13px] text-ink-2 hover:text-ink">
                {t('Co chybí k úrovni', 'What is missing for')} „{t(LEVEL_NAMES[outcome.skill.next.level])}“
              </summary>
              <Gates level={outcome.skill.next.level} gates={outcome.skill.next.gates} className="mt-2" />
            </details>
          )}
        </div>
      )}

      {outcome.milestones.length > 0 && (
        <div className="mt-4 space-y-2">
          {outcome.milestones.map((id) => {
            const def = milestones.data?.find((milestone) => milestone.id === id);
            return (
              <Notice key={id} tone="good" title={def ? t(def.title) : id}>
                {def ? t(def.description) : null}
              </Notice>
            );
          })}
        </div>
      )}

      <div className="mt-5 flex flex-wrap items-center gap-2">
        {onNext && (
          <Button ref={next} variant="primary" size="lg" onClick={onNext}>
            {nextLabel ?? t('Další úloha', 'Next problem')}
            <ArrowRight size={15} />
          </Button>
        )}
        {tutor.enabled && (
          <Button
            onClick={() =>
              tutor.open({
                problemId: problem.id,
                concept: problem.concept ?? undefined,
                mode: hadError ? 'mistake' : 'socratic',
              })
            }
          >
            <MessageSquare size={14} />
            {hadError
              ? t('Probrat chybu s tutorem', 'Go over the error with the tutor')
              : t('Probrat s tutorem', 'Discuss with the tutor')}
          </Button>
        )}
      </div>
    </section>
  );
}
