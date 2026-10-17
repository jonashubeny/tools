import type { GateStatus, MasteryLevel, PathReason, PathState, SkillDto, StartRunResponse } from '@lemma/core';
import {
  BookOpen,
  Check,
  CheckCircle2,
  Circle,
  CircleDashed,
  Clock,
  Compass,
  Layers,
  PenLine,
  RotateCcw,
} from 'lucide-react';
import { useCallback, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { cn } from '../lib/cn';
import { inDays } from '../lib/format';
import { LevelBar } from '../viz/charts';
import { api } from './api';
import { useT } from './i18n';
import { LEVEL_NAMES, PATH_NAMES, PATH_REASONS, gateText } from './labels';
import { useGraph } from './queries';

/** Look up a concept's title by id, in the current language. Falls back to the id. */
export function useTitleOf(): (id: string) => string {
  const graph = useGraph();
  const t = useT();
  return useCallback(
    (id: string) => {
      const skill = graph.data?.skills.find((s) => s.id === id);
      return skill ? t(skill.title) : id;
    },
    [graph.data, t],
  );
}

/** One skill as a row: name, where it stands, and whether memory of it is fading. */
export function SkillRow({
  skill,
  className,
  detail,
}: {
  skill: SkillDto;
  className?: string;
  detail?: 'level' | 'due';
}) {
  const t = useT();
  return (
    <Link
      to={`/concept/${skill.id}`}
      className={cn(
        'group flex items-center gap-3 rounded-md px-2 py-1.5 text-ink hover:bg-surface-2 hover:no-underline',
        className,
      )}
    >
      <span className="min-w-0 flex-1 truncate text-sm">{t(skill.title)}</span>
      {(skill.due || skill.fading) && (
        <span
          className="flex shrink-0 items-center gap-1 text-xs text-ink-3"
          title={t('Čas si to připomenout', 'Time to recall it')}
        >
          <Clock size={12} aria-hidden />
          {detail === 'due' && skill.dueInDays !== null ? inDays(skill.dueInDays, t.locale) : t('opakovat', 'review')}
        </span>
      )}
      <span className="hidden w-24 shrink-0 text-right text-xs text-ink-3 sm:block">{t(LEVEL_NAMES[skill.level])}</span>
      <LevelBar level={skill.level} size="sm" />
    </Link>
  );
}

/** The evidence still needed for the next level: what "closer to mastery" concretely means. */
export function Gates({ level, gates, className }: { level: MasteryLevel; gates: GateStatus[]; className?: string }) {
  const t = useT();
  return (
    <ul className={cn('space-y-1.5', className)}>
      {gates.map((gate) => {
        const text = gateText(gate, level, t);
        return (
          <li key={gate.key} className="flex items-start gap-2 text-[13px]">
            {gate.done ? (
              <Check size={14} className="mt-0.5 shrink-0" style={{ color: 'var(--good)' }} aria-hidden />
            ) : (
              <Circle size={14} className="mt-0.5 shrink-0 text-ink-3" aria-hidden />
            )}
            <span className={cn('min-w-0 flex-1', gate.done ? 'text-ink-3' : 'text-ink-2')}>
              {text.label}
              <span className="sr-only">{gate.done ? t(' — splněno', ' — done') : t(' — zbývá', ' — remaining')}</span>
            </span>
            <span className="shrink-0 font-mono text-xs text-ink-3">{text.value}</span>
          </li>
        );
      })}
    </ul>
  );
}

const PATH_ICONS: Record<PathState, typeof Circle> = {
  'not-started': CircleDashed,
  diagnosed: Compass,
  learning: BookOpen,
  practising: PenLine,
  consolidating: Layers,
  mastered: CheckCircle2,
  'needs-review': RotateCcw,
};

/**
 * Where a skill stands on the path: an icon and the word, so that the state never rests
 * on colour. The rule that put it there is the tooltip.
 */
export function PathBadge({ state, reason, className }: { state: PathState; reason?: PathReason; className?: string }) {
  const t = useT();
  const Icon = PATH_ICONS[state];
  return (
    <span
      className={cn('inline-flex items-center gap-1.5 text-[13px] whitespace-nowrap text-ink-2', className)}
      title={reason ? t(PATH_REASONS[reason]) : undefined}
    >
      <Icon
        size={14}
        aria-hidden
        className="shrink-0"
        style={{
          color: state === 'mastered' ? 'var(--good)' : state === 'needs-review' ? 'var(--warning)' : undefined,
        }}
      />
      {t(PATH_NAMES[state])}
    </span>
  );
}

/** What starting something may answer with when it is not a run of problems. */
export type Started = StartRunResponse | { redirect: 'lesson' | 'exam' | 'lab' | 'concept'; target: string };

/** Go where a started block, assignment or run leads. */
export function useFollow(): (result: Started) => void {
  const navigate = useNavigate();
  return useCallback(
    (result: Started) => {
      if (!('redirect' in result)) navigate(`/practice/${result.run.id}`);
      else if (result.redirect === 'lesson') navigate(`/lesson/${result.target}`);
      else if (result.redirect === 'concept') navigate(`/concept/${result.target}?example=1`);
      else if (result.redirect === 'exam') navigate(`/exams?blueprint=${result.target}`);
      else navigate(`/lab/${result.target}`);
    },
    [navigate],
  );
}

/** Start something on the server and follow where it leads, with the busy and error state a button needs. */
export function useStarter(): {
  start: (key: string, path: string, body?: unknown) => Promise<void>;
  busy: string | null;
  error: unknown;
} {
  const follow = useFollow();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<unknown>(null);
  const start = useCallback(
    async (key: string, path: string, body?: unknown): Promise<void> => {
      setBusy(key);
      setError(null);
      try {
        follow(await api.post<Started>(path, body));
      } catch (failure) {
        setError(failure);
      } finally {
        setBusy(null);
      }
    },
    [follow],
  );
  return { start, busy, error };
}
