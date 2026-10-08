import type { LessonDto, LessonStep, ProblemDto, StartRunResponse } from '@lemma/core';
import { ArrowLeft, ArrowRight, Check, FlaskConical } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { api } from '../app/api';
import { useT } from '../app/i18n';
import { LAB_NAMES } from '../app/labels';
import { useLesson, useMe, useRefresh } from '../app/queries';
import { Figure } from '../figure/Figure';
import { LabTool } from '../lab/tools';
import { cn } from '../lib/cn';
import { RichText, Tex } from '../lib/Math';
import { Button, Card, ErrorNote, Loading, Notice } from '../ui';
import { ProblemView } from './ProblemView';

/** A lesson: short steps, one idea each. Guess first, look, then read why. */
export function Lesson() {
  const { id } = useParams();
  const lesson = useLesson(id);
  if (lesson.isPending) return <Loading />;
  if (lesson.isError) return <ErrorNote error={lesson.error} retry={() => void lesson.refetch()} />;
  return <Player key={lesson.data.concept} lesson={lesson.data} />;
}

function Player({ lesson }: { lesson: LessonDto }) {
  const t = useT();
  const navigate = useNavigate();
  const refresh = useRefresh();
  const total = lesson.steps.length;
  // Resume where it was left; a finished lesson reopens from the start.
  const [index, setIndex] = useState(lesson.done ? 0 : Math.min(lesson.step, total - 1));
  const [reached, setReached] = useState(lesson.done ? total : lesson.step);
  const [ready, setReady] = useState(false);
  const [finished, setFinished] = useState(false);
  const [busy, setBusy] = useState(false);
  const step = lesson.steps[index]!;

  // Steps that ask for something are only "ready" once it has been done.
  useEffect(
    () => setReady(step.kind === 'text' || step.kind === 'figure' || step.kind === 'summary' || index < reached),
    [index, step.kind, reached],
  );

  const forward = async (): Promise<void> => {
    setBusy(true);
    try {
      if (index >= reached) {
        await api.post(`/api/lessons/${lesson.concept}/step`, { step: index });
        setReached(index + 1);
        refresh();
      }
      if (index + 1 < total) setIndex(index + 1);
      else setFinished(true);
    } finally {
      setBusy(false);
    }
  };

  const practise = async (): Promise<void> => {
    setBusy(true);
    try {
      const started = await api.post<StartRunResponse>('/api/practice/start', {
        context: 'blocked',
        concept: lesson.concept,
        count: 6,
      });
      navigate(`/practice/${started.run.id}`);
    } catch {
      navigate(`/concept/${lesson.concept}`);
    }
  };

  return (
    <div className="mx-auto max-w-3xl">
      <Link to={`/concept/${lesson.concept}`} className="mb-3 inline-flex items-center gap-1 text-sm text-ink-2">
        <ArrowLeft size={14} aria-hidden />
        {t(lesson.title)}
      </Link>
      <div className="mb-5 flex items-center gap-3">
        <div
          className="flex flex-1 gap-1"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={total}
          aria-valuenow={finished ? total : index}
          aria-label={t('Postup lekcí', 'Progress through the lesson')}
        >
          {lesson.steps.map((_, i) => (
            <button
              key={i}
              type="button"
              disabled={i > reached}
              onClick={() => {
                setFinished(false);
                setIndex(i);
              }}
              aria-label={`${t('Krok', 'Step')} ${i + 1}`}
              className={cn(
                'h-1.5 flex-1 rounded-full disabled:cursor-default',
                i < reached ? 'bg-accent' : i === index ? 'bg-border-strong' : 'bg-surface-3',
                i === index && !finished && 'outline outline-2 outline-offset-2 outline-border-strong',
              )}
            />
          ))}
        </div>
        <span className="font-mono text-xs text-ink-3">
          {finished ? total : index + 1}/{total}
        </span>
      </div>

      {finished ? (
        <Card className="p-6">
          <div className="flex items-center gap-2.5">
            <Check size={20} style={{ color: 'var(--good)' }} aria-hidden />
            <h1 className="text-xl font-semibold">{t('Lekce je za tebou', 'The lesson is done')}</h1>
          </div>
          <p className="mt-2 text-ink-2">
            {t(
              'Číst a rozumět je první půlka. Druhá je udělat to sám, bez nápovědy — a pak znovu za pár dní, až to trochu vyprchá.',
              'Reading and understanding is the first half. The second is doing it alone, without hints — and then again in a few days, once it has faded a little.',
            )}
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Button variant="primary" size="lg" onClick={() => void practise()} busy={busy}>
              {t('Procvičit', 'Practise')}
              <ArrowRight size={15} />
            </Button>
            <Button size="lg" onClick={() => navigate('/')}>
              {t('Zpět na dnešek', 'Back to Today')}
            </Button>
          </div>
        </Card>
      ) : (
        <Card className="p-5 sm:p-6">
          <StepView key={index} step={step} done={index < reached} onReady={() => setReady(true)} />
          <div className="mt-6 flex items-center justify-between gap-3 border-t border-border pt-4">
            <Button variant="ghost" disabled={index === 0} onClick={() => setIndex(index - 1)}>
              <ArrowLeft size={14} />
              {t('Zpět', 'Back')}
            </Button>
            <Button variant="primary" size="lg" onClick={() => void forward()} disabled={!ready} busy={busy}>
              {index + 1 < total ? t('Dál', 'Continue') : t('Dokončit lekci', 'Finish the lesson')}
              <ArrowRight size={15} />
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}

function StepView({ step, done, onReady }: { step: LessonStep; done: boolean; onReady: () => void }) {
  const t = useT();
  switch (step.kind) {
    case 'text':
      return <RichText text={t(step.body)} className="text-[1.0625rem] leading-relaxed" />;
    case 'figure':
      return (
        <figure>
          <Figure spec={step.figure} />
          <figcaption className="mt-3 text-ink-2">
            <RichText text={t(step.caption)} />
          </figcaption>
        </figure>
      );
    case 'summary':
      return (
        <div>
          <div className="mono-label mb-2">{t('Co si odnést', 'What to take away')}</div>
          <ul className="space-y-2.5">
            {step.points.map((point, index) => (
              <li key={index} className="flex gap-2.5">
                <Check size={16} className="mt-1 shrink-0 text-ink-3" aria-hidden />
                <RichText text={t(point)} inlineOnly />
              </li>
            ))}
          </ul>
        </div>
      );
    case 'predict':
      return <Predict step={step} done={done} onReady={onReady} />;
    case 'explore':
      return <Explore step={step} done={done} onReady={onReady} />;
    case 'worked':
      return <Worked step={step} done={done} onReady={onReady} />;
    case 'check':
      return <Check_ step={step} done={done} onReady={onReady} />;
  }
}

function Predict({
  step,
  done,
  onReady,
}: {
  step: Extract<LessonStep, { kind: 'predict' }>;
  done: boolean;
  onReady: () => void;
}) {
  const t = useT();
  const [picked, setPicked] = useState<string | null>(null);
  const revealed = picked !== null || done;
  return (
    <div>
      <div className="mono-label mb-2">{t('Nejdřív si tipni', 'Guess first')}</div>
      <RichText text={t(step.question)} className="text-[1.0625rem] leading-relaxed" />
      <div className="mt-4 grid gap-2 sm:grid-cols-2" role="radiogroup">
        {step.options.map((option) => (
          <button
            key={option.id}
            type="button"
            role="radio"
            aria-checked={picked === option.id}
            disabled={revealed}
            onClick={() => {
              setPicked(option.id);
              onReady();
            }}
            className={cn(
              'rounded-lg border px-3.5 py-2.5 text-left disabled:cursor-default',
              picked === option.id ? 'border-accent bg-accent-wash' : 'border-border-strong bg-surface-2',
              !revealed && 'hover:bg-surface-3',
              revealed && step.correct === option.id && picked !== option.id && 'border-border-strong',
            )}
          >
            <RichText text={t(option.text)} inlineOnly />
            {revealed && step.correct === option.id && (
              <span className="ml-2 text-xs text-ink-3">← {t('tak to je', 'this is it')}</span>
            )}
          </button>
        ))}
      </div>
      {revealed && (
        <div className="mt-4 rounded-lg border border-border bg-surface-2 p-3.5">
          {picked !== null && step.correct !== undefined && (
            <div className="mb-1.5 text-[13px] text-ink-3">
              {picked === step.correct
                ? t('Trefa.', 'Right.')
                : t(
                    'Tentokrát vedle — a právě proto si to teď zapamatuješ líp.',
                    'Not this time — which is exactly why it will stick better now.',
                  )}
            </div>
          )}
          <RichText text={t(step.reveal)} />
        </div>
      )}
    </div>
  );
}

function Explore({
  step,
  done,
  onReady,
}: {
  step: Extract<LessonStep, { kind: 'explore' }>;
  done: boolean;
  onReady: () => void;
}) {
  const t = useT();
  const [shown, setShown] = useState(done);
  return (
    <div>
      <div className="mono-label mb-2 flex items-center gap-1.5">
        <FlaskConical size={12} aria-hidden />
        {t('Experiment', 'Experiment')} · {t(LAB_NAMES[step.lab.tool])}
      </div>
      <RichText text={t(step.task)} className="text-[1.0625rem] leading-relaxed" />
      <div className="mt-4 rounded-lg border border-border bg-bg/40 p-3 sm:p-4">
        <LabTool tool={step.lab.tool} preset={step.lab.preset} compact />
      </div>
      {shown ? (
        <div className="mt-4 rounded-lg border border-border bg-surface-2 p-3.5">
          <div className="mono-label mb-1">{t('Co bylo vidět', 'What there was to see')}</div>
          <RichText text={t(step.observe)} />
        </div>
      ) : (
        <Button
          className="mt-4"
          onClick={() => {
            setShown(true);
            onReady();
          }}
        >
          {t('Vyzkoušeno — co jsem měl vidět?', 'Tried it — what was I meant to see?')}
        </Button>
      )}
    </div>
  );
}

function Worked({
  step,
  done,
  onReady,
}: {
  step: Extract<LessonStep, { kind: 'worked' }>;
  done: boolean;
  onReady: () => void;
}) {
  const t = useT();
  const [shown, setShown] = useState(done ? step.steps.length : 1);
  useEffect(() => {
    if (shown >= step.steps.length) onReady();
  }, [shown, step.steps.length, onReady]);
  return (
    <div>
      <div className="mono-label mb-2">{t('Řešený příklad', 'Worked example')}</div>
      <h2 className="text-lg font-semibold">
        <RichText text={t(step.title)} inlineOnly />
      </h2>
      <ol className="mt-4 space-y-4">
        {step.steps.slice(0, shown).map((line, index) => (
          <li key={index} className="flex gap-3">
            <span className="mt-0.5 w-5 shrink-0 font-mono text-xs text-ink-3">{index + 1}</span>
            <div className="min-w-0 flex-1">
              <RichText text={t(line.text)} />
              {line.math !== undefined && (
                <Tex tex={typeof line.math === 'string' ? line.math : t(line.math)} display />
              )}
              {line.why && (
                <div className="mt-1 border-l-2 border-border-strong pl-3 text-[13px] text-ink-2">
                  <span className="text-ink-3">{t('Proč to jde: ', 'Why this is allowed: ')}</span>
                  <RichText text={t(line.why)} inlineOnly />
                </div>
              )}
            </div>
          </li>
        ))}
      </ol>
      {shown < step.steps.length && (
        <Button className="mt-4" onClick={() => setShown(shown + 1)}>
          {t('Další krok', 'Next step')}
          <span className="font-mono text-xs text-ink-3">
            {shown}/{step.steps.length}
          </span>
        </Button>
      )}
    </div>
  );
}

/** A real problem inside the lesson: answered like any other, and it counts like any other. */
function Check_({
  step,
  done,
  onReady,
}: {
  step: Extract<LessonStep, { kind: 'check' }>;
  done: boolean;
  onReady: () => void;
}) {
  const t = useT();
  const me = useMe();
  const refresh = useRefresh();
  const [problem, setProblem] = useState<ProblemDto | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [skipped, setSkipped] = useState(false);

  useEffect(() => {
    if (done) return;
    let cancelled = false;
    api
      .post<StartRunResponse>('/api/practice/start', {
        context: 'lesson',
        generator: step.generator,
        level: step.level,
      })
      .then((started) => {
        if (!cancelled) setProblem(started.problem);
      })
      .catch((failure: unknown) => {
        if (!cancelled) setError(failure);
      });
    return () => {
      cancelled = true;
    };
  }, [done, step.generator, step.level]);

  if (done && !problem)
    return <Notice tone="good" title={t('Kontrolní úloha je hotová', 'The check problem is done')} />;
  if (error !== null) {
    return (
      <div className="space-y-3">
        <ErrorNote error={error} />
        {!skipped && (
          <Button
            onClick={() => {
              setSkipped(true);
              onReady();
            }}
          >
            {t('Pokračovat bez úlohy', 'Continue without the problem')}
          </Button>
        )}
      </div>
    );
  }
  if (!problem || !me.data) return <Loading />;
  return (
    <div>
      <div className="mono-label mb-3">{t('Teď ty', 'Your turn')}</div>
      <ProblemView
        problem={problem}
        settings={me.data.settings}
        compact
        onChange={(next) => {
          setProblem(next);
          if (next.status !== 'open') {
            refresh();
            onReady();
          }
        }}
      />
    </div>
  );
}
