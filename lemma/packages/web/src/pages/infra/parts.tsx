import type { AttemptStatus, InfraSkillLevel, LabHostDto, RecommendationDto, ScenarioSummaryDto, SkillProgressDto } from '@lemma/core';
import { L } from '@lemma/core';
import { CheckCircle2, Circle, CircleDot, Clock, Layers, Server } from 'lucide-react';
import { Link } from 'react-router';
import { useT } from '../../app/i18n';
import { cn } from '../../lib/cn';
import { Badge, Meter, Notice } from '../../ui';

/** Small pieces shared by the pages of the Linux & Infrastructure mode. */

export const LEVEL_LABEL: Record<InfraSkillLevel, L> = {
  new: L('nezačato', 'not started'),
  learning: L('učím se', 'learning'),
  practising: L('procvičuji', 'practising'),
  proficient: L('zvládám', 'proficient'),
  mastered: L('ovládám', 'mastered'),
};

const LEVEL_VALUE: Record<InfraSkillLevel, number> = { new: 0, learning: 0.25, practising: 0.5, proficient: 0.75, mastered: 1 };

export const STATUS_LABEL: Record<AttemptStatus, L> = {
  active: L('rozpracováno', 'in progress'),
  solved: L('vyřešeno', 'solved'),
  abandoned: L('nedokončeno', 'abandoned'),
  expired: L('vypršelo', 'expired'),
};

export const KIND_LABEL: Record<RecommendationDto['kind'], L> = {
  continue: L('rozpracované', 'in progress'),
  assignment: L('zadáno', 'assigned'),
  remediation: L('cílené procvičení', 'targeted practice'),
  retention: L('opakování', 'review'),
  challenge: L('výzva', 'challenge'),
  next: L('další krok', 'next step'),
};

export function Difficulty({ value }: { value: number }) {
  const t = useT();
  return (
    <span className="inline-flex items-center gap-0.5" title={t(`Obtížnost ${value} z 5`, `Difficulty ${value} of 5`)} aria-label={t(`Obtížnost ${value} z 5`, `Difficulty ${value} of 5`)}>
      {[1, 2, 3, 4, 5].map((n) => (
        <span key={n} className={cn('h-2.5 w-1.5 rounded-sm', n <= value ? 'bg-accent' : 'bg-surface-3')} />
      ))}
    </span>
  );
}

export function ProgressMark({ progress }: { progress: ScenarioSummaryDto['progress'] }) {
  const t = useT();
  if (progress === 'independent')
    return (
      <span className="inline-flex items-center gap-1 text-xs text-ink-2">
        <CheckCircle2 size={14} style={{ color: 'var(--good)' }} aria-hidden />
        {t('samostatně', 'on my own')}
      </span>
    );
  if (progress === 'solved')
    return (
      <span className="inline-flex items-center gap-1 text-xs text-ink-2">
        <CheckCircle2 size={14} className="text-ink-3" aria-hidden />
        {t('vyřešeno s pomocí', 'solved with help')}
      </span>
    );
  if (progress === 'attempted')
    return (
      <span className="inline-flex items-center gap-1 text-xs text-ink-2">
        <CircleDot size={14} className="text-ink-3" aria-hidden />
        {t('zkoušeno', 'attempted')}
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 text-xs text-ink-3">
      <Circle size={14} aria-hidden />
      {t('nové', 'new')}
    </span>
  );
}

export function ScenarioCard({ scenario, reason, kind }: { scenario: ScenarioSummaryDto; reason?: L; kind?: RecommendationDto['kind'] }) {
  const t = useT();
  return (
    <Link
      to={`/infra/scenarios/${scenario.id}`}
      className={cn(
        'block rounded-xl border border-border bg-surface-1 p-4 hover:no-underline hover:border-border-strong',
        !scenario.runnable && 'opacity-70',
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        {kind && <Badge tone="accent">{t(KIND_LABEL[kind])}</Badge>}
        <Difficulty value={scenario.difficulty} />
        <span className="inline-flex items-center gap-1 font-mono text-[11px] text-ink-3">
          <Clock size={12} aria-hidden />~{scenario.estimatedMinutes} min
        </span>
        {scenario.faults > 1 && (
          <span className="inline-flex items-center gap-1 font-mono text-[11px] text-ink-3">
            <Layers size={12} aria-hidden />
            {t(`${scenario.faults} chyby`, `${scenario.faults} faults`)}
          </span>
        )}
        {scenario.machines > 1 && (
          <span className="inline-flex items-center gap-1 font-mono text-[11px] text-ink-3">
            <Server size={12} aria-hidden />
            {scenario.machines}
          </span>
        )}
        {scenario.untested && <Badge tone="outline">{t('experimentální', 'experimental')}</Badge>}
      </div>
      <div className="mt-2 font-medium text-ink">{t(scenario.title)}</div>
      <div className="mt-0.5 text-sm text-ink-2">{t(scenario.summary)}</div>
      {reason && <div className="mt-2 text-[13px] text-accent-ink">{t(reason)}</div>}
      <div className="mt-2 flex items-center justify-between gap-2">
        <ProgressMark progress={scenario.progress} />
        {!scenario.runnable && scenario.unavailable && <span className="text-xs text-ink-3">{t(scenario.unavailable)}</span>}
      </div>
    </Link>
  );
}

export function SkillLine({ skill }: { skill: SkillProgressDto }) {
  const t = useT();
  return (
    <div className="py-2">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-sm font-medium">{t(skill.title)}</div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {skill.struggling && <Badge tone="outline">{t('potíže', 'struggling')}</Badge>}
          <span className="font-mono text-[11px] text-ink-2">{t(LEVEL_LABEL[skill.level])}</span>
        </div>
      </div>
      <Meter className="mt-1.5" value={LEVEL_VALUE[skill.level]} label={t(skill.title)} height={4} />
      {skill.level !== 'new' && skill.next.length > 0 && (
        <div className="mt-1 text-xs text-ink-3">
          {t('Další úroveň:', 'Next level:')} {skill.next.map((n) => t(n)).join(' · ')}
        </div>
      )}
    </div>
  );
}

/** Why labs cannot run here, when they cannot — said plainly, never pretended away. */
export function HostNotice({ host }: { host: LabHostDto }) {
  const t = useT();
  if (!host.configured)
    return (
      <Notice tone="info" title={t('Laboratoře nejsou zapnuté', 'Labs are not switched on')}>
        {t(
          'Na tomto serveru neběží služba laboratoří (labd). Plán, knihovnu a dovednosti můžete procházet; spustit laboratoř nejde. Správce ji zapne podle README.',
          'This server has no lab service (labd). You can browse the roadmap, the library and your skills, but labs cannot start. The administrator can switch it on as the README describes.',
        )}
      </Notice>
    );
  if (!host.reachable)
    return (
      <Notice tone="warning" title={t('Služba laboratoří neodpovídá', 'The lab service is not answering')}>
        {host.problems.join(' · ')}
      </Notice>
    );
  if (host.preparing)
    return (
      <Notice tone="info" title={t('Server laboratoří se připravuje', 'The lab host is being prepared')}>
        {t('Při prvním startu se sestavují obrazy strojů; trvá to několik minut.', 'On the first start the machine images are built; it takes a few minutes.')}
      </Notice>
    );
  return null;
}

export const formatMinutes = (seconds: number): string => {
  const m = Math.round(seconds / 60);
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${m % 60} min`;
};
