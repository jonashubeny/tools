import type { GateStatus, MasteryLevel, SkillDto } from '@lemma/core';
import { Check, Circle, Clock } from 'lucide-react';
import { useCallback } from 'react';
import { Link } from 'react-router';
import { cn } from '../lib/cn';
import { inDays } from '../lib/format';
import { LevelBar } from '../viz/charts';
import { useT } from './i18n';
import { LEVEL_NAMES, gateText } from './labels';
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
