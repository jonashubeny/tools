import { type ProblemDto, type RunDto, type StartRunResponse, ERROR_INFO } from '@lemma/core';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { api } from '../app/api';
import { useT } from '../app/i18n';
import { LEVEL_NAMES, RUN_NAMES } from '../app/labels';
import { useMe, useRefresh } from '../app/queries';
import { cn } from '../lib/cn';
import { duration, pct } from '../lib/format';
import { Button, Card, ErrorNote, LinkButton, Loading, Notice, StatTile } from '../ui';
import { BarList } from '../viz/charts';
import { ProblemView } from './ProblemView';

/** A practice run: one problem at a time, then a summary of what the run showed. */
export function Practice() {
  const { runId } = useParams();
  const t = useT();
  const me = useMe();
  const refresh = useRefresh();
  const [run, setRun] = useState<RunDto | null>(null);
  const [problem, setProblem] = useState<ProblemDto | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);

  const advance = useCallback(async () => {
    if (!runId) return;
    setLoading(true);
    setError(null);
    try {
      const next = await api.post<StartRunResponse>(`/api/runs/${runId}/next`);
      setRun(next.run);
      setProblem(next.problem);
      if (next.run.finished) refresh();
    } catch (failure) {
      setError(failure);
    } finally {
      setLoading(false);
    }
  }, [runId, refresh]);

  useEffect(() => {
    void advance();
  }, [advance]);

  if (error !== null) return <ErrorNote error={error} retry={() => void advance()} />;
  if (!run || !me.data) return <Loading />;

  const answered = problem && problem.status !== 'open' ? run.position : Math.max(0, run.position - 1);
  const last = run.position >= run.total;

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-5 flex items-center gap-3">
        <Link
          to="/"
          className="inline-flex items-center gap-1 text-sm text-ink-2"
          title={t(
            'Úloha zůstane rozpracovaná; můžeš se k ní vrátit.',
            'The problem stays open; you can come back to it.',
          )}
        >
          <ArrowLeft size={14} aria-hidden />
          {t('Dnes', 'Today')}
        </Link>
        <div className="min-w-0 flex-1 truncate text-sm font-medium">
          {run.title ? t(run.title) : t(RUN_NAMES[run.context])}
        </div>
        {!run.finished && (
          <div className="font-mono text-xs text-ink-3">
            {Math.min(run.position, run.total)}/{run.total}
          </div>
        )}
      </div>
      {!run.finished && run.total > 1 && (
        <div
          className="mb-6 flex gap-1"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={run.total}
          aria-valuenow={answered}
          aria-label={t('Postup sezením', 'Progress through the run')}
        >
          {Array.from({ length: run.total }, (_, index) => (
            <span
              key={index}
              className={cn(
                'h-1 flex-1 rounded-full',
                index < answered ? 'bg-accent' : index === answered ? 'bg-border-strong' : 'bg-surface-3',
              )}
            />
          ))}
        </div>
      )}

      {run.context === 'diagnostic' && !run.finished && run.position <= 1 && problem?.status === 'open' && (
        <Notice tone="info" className="mb-5" title={t('Jak rozřazovací test funguje', 'How the placement test works')}>
          {t(
            'Asi patnáct úloh napříč látkou. Bez nápověd, na každou jedna odpověď, a co bylo správně, uvidíš až na konci. „Tohle neumím“ je platná odpověď: test má zjistit, odkud začít, ne tě nachytat. Nic se neznámkuje.',
            'About fifteen problems across the curriculum. No hints, one answer each, and what was right is shown only at the end. “I do not know this” is a valid answer: the test is there to find where to start, not to catch you out. Nothing is graded.',
          )}
        </Notice>
      )}

      {run.finished && run.context === 'diagnostic' ? (
        <PlacementDone run={run} />
      ) : run.finished ? (
        <Summary run={run} />
      ) : problem ? (
        <Card className={cn('p-5 sm:p-6', loading && 'opacity-60')}>
          <ProblemView
            problem={problem}
            settings={me.data.settings}
            onChange={(next) => {
              setProblem(next);
              if (next.status !== 'open') refresh();
            }}
            onNext={() => void advance()}
            nextLabel={last ? t('Dokončit', 'Finish') : undefined}
          />
        </Card>
      ) : (
        <Loading />
      )}
    </div>
  );
}

/** The end of a placement test: no score to dwell on, a pointer to what it found. */
function PlacementDone({ run }: { run: RunDto }) {
  const t = useT();
  return (
    <Card className="p-5 sm:p-6">
      <div className="mono-label">{t('Rozřazovací test', 'Placement test')}</div>
      <h1 className="mt-1 text-xl font-semibold">
        {t('Hotovo. Teď už je od čeho začít.', 'Done. Now there is somewhere to start from.')}
      </h1>
      <p className="mt-2 text-sm text-ink-2">
        {t(
          'Podle odpovědí se nastavilo, kde začneš a čím. Jedna špatná odpověď nic nerozhodla — kde to nevyšlo, test se zeptal ještě jednou a lehčeji. Všechno se dál upřesňuje podle toho, jak ti půjdou běžné úlohy.',
          'Your answers have set where you start and with what. One wrong answer decided nothing — where it did not work out, the test asked once more and easier. Everything is refined further by how ordinary problems go.',
        )}
      </p>
      <div className="mt-6 flex flex-wrap gap-2">
        {run.diagnostic && (
          <LinkButton to={`/diagnostic/${run.diagnostic}`} variant="primary" size="lg">
            {t('Co test ukázal', 'What the test found')}
          </LinkButton>
        )}
        <LinkButton to="/" size="lg">
          {t('Na dnešní plán', 'To today’s plan')}
        </LinkButton>
      </div>
    </Card>
  );
}

function Summary({ run }: { run: RunDto }) {
  const t = useT();
  const navigate = useNavigate();
  const summary = run.summary;
  const [busy, setBusy] = useState(false);
  if (!summary) return <Loading />;
  const adaptive = run.context === 'adaptive';

  const again = async (): Promise<void> => {
    setBusy(true);
    try {
      const started = await api.post<StartRunResponse>('/api/practice/start', {
        context: adaptive ? 'adaptive' : 'mixed',
      });
      navigate(`/practice/${started.run.id}`);
    } catch {
      navigate('/');
    } finally {
      setBusy(false);
    }
  };

  const worked = summary.problems;
  return (
    <Card className="p-5 sm:p-6">
      <div className="mono-label">{t('Shrnutí', 'Summary')}</div>
      <h1 className="mt-1 text-xl font-semibold">{run.title ? t(run.title) : t(RUN_NAMES[run.context])}</h1>

      {worked === 0 ? (
        <p className="mt-3 text-sm text-ink-2">
          {t('V tomhle sezení se nic nevyřešilo.', 'Nothing was worked on in this run.')}
        </p>
      ) : (
        <>
          <div className="mt-5 grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-4">
            <StatTile
              label={t('Vyřešeno', 'Solved')}
              value={`${summary.solved}/${worked}`}
              sub={pct(summary.solved / worked, t.locale)}
            />
            <StatTile
              label={t('Samostatně', 'Unaided')}
              value={summary.unaided}
              sub={t('napoprvé a bez nápovědy', 'first try, no hints')}
            />
            <StatTile
              label={t('Čas', 'Time')}
              value={duration(summary.seconds, t.locale)}
              sub={`${duration(summary.seconds / worked, t.locale)} ${t('na úlohu', 'per problem')}`}
            />
            <StatTile
              label={t('Body', 'Points')}
              value={summary.points}
              sub={t('do dnešní aktivity', 'towards today’s activity')}
            />
          </div>

          {summary.levelUps.length > 0 && (
            <div className="mt-6">
              <div className="mono-label mb-2">{t('Nové úrovně', 'Levels gained')}</div>
              <ul className="space-y-1 text-sm">
                {summary.levelUps.map((item, index) => (
                  <li key={index} className="flex items-center gap-2">
                    <Link to={`/concept/${item.skill}`} className="text-ink">
                      {t(item.title)}
                    </Link>
                    <span className="text-ink-3">
                      {t(LEVEL_NAMES[item.from])} <ArrowRight size={12} className="inline" aria-hidden />{' '}
                      <span className="text-ink-2">{t(LEVEL_NAMES[item.to])}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {summary.errors.length > 0 && (
            <div className="mt-6">
              <div className="mono-label mb-2">{t('Chyby v tomto sezení', 'Errors in this run')}</div>
              <BarList
                rows={summary.errors.map((entry) => ({
                  id: entry.type,
                  label: t(ERROR_INFO[entry.type].title),
                  value: entry.count,
                  display: `${entry.count}×`,
                }))}
              />
              <p className="mt-2 text-[13px] text-ink-3">
                {t('Nejčastější: ', 'Most frequent: ')}
                {t(ERROR_INFO[summary.errors[0]!.type].remedy)}
              </p>
            </div>
          )}

          {summary.skills.length > 1 && (
            <div className="mt-6">
              <div className="mono-label mb-2">{t('Podle dovedností', 'By skill')}</div>
              <ul className="space-y-1 text-sm">
                {summary.skills.map((skill) => (
                  <li key={skill.id} className="flex items-center justify-between gap-3">
                    <Link to={`/concept/${skill.id}`} className="min-w-0 truncate text-ink">
                      {t(skill.title)}
                    </Link>
                    <span className="shrink-0 font-mono text-xs text-ink-2">
                      {skill.solved}/{skill.total}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}

      <div className="mt-7 flex flex-wrap gap-2">
        <LinkButton to="/" variant="primary" size="lg">
          {t('Zpět na dnešek', 'Back to Today')}
        </LinkButton>
        <Button size="lg" onClick={() => void again()} busy={busy}>
          {adaptive
            ? t('Ještě jedno sezení', 'One more session')
            : t('Ještě smíšené opakování', 'One more mixed review')}
        </Button>
      </div>
    </Card>
  );
}
