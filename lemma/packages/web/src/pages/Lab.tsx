import { ACTIVITY, type LabTool as LabToolName } from '@lemma/core';
import { ArrowLeft } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router';
import { api } from '../app/api';
import { useT } from '../app/i18n';
import { LAB_BLURBS, LAB_NAMES } from '../app/labels';
import { useRefresh } from '../app/queries';
import { LabTool, isLabTool } from '../lab/tools';
import { Card, PageHeader } from '../ui';

const ORDER: LabToolName[] = [
  'grapher',
  'transform',
  'linear',
  'quadratic',
  'absolute',
  'power',
  'inverse',
  'explog',
  'unitcircle',
  'sinusoid',
  'complex',
];

/** The Math Lab: instruments for seeing what a formula does when its parameters move. */
export function Lab() {
  const { tool } = useParams();
  const t = useT();
  if (isLabTool(tool)) return <ToolPage key={tool} tool={tool} />;
  return (
    <div>
      <PageHeader
        title={t('Matematická laboratoř', 'Math Lab')}
        lead={t(
          'Nástroje na zkoušení: hýbej parametry a dívej se, co se děje. Nejdřív si tipni, co se stane — pak to ověř.',
          'Instruments for trying things out: move the parameters and watch. Guess what will happen first — then check.',
        )}
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {ORDER.map((id) => (
          <Link
            key={id}
            to={`/lab/${id}`}
            className="group rounded-xl border border-border bg-surface-1 p-4 text-ink hover:border-border-strong hover:no-underline"
          >
            <div className="font-medium group-hover:text-accent-ink">{t(LAB_NAMES[id])}</div>
            <div className="mt-1 text-sm text-ink-2">{t(LAB_BLURBS[id])}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}

function ToolPage({ tool }: { tool: LabToolName }) {
  const t = useT();
  const counted = useLabTime(tool);
  return (
    <div>
      <Link to="/lab" className="mb-3 inline-flex items-center gap-1 text-sm text-ink-2">
        <ArrowLeft size={14} aria-hidden />
        {t('Laboratoř', 'Lab')}
      </Link>
      <PageHeader title={t(LAB_NAMES[tool])} lead={t(LAB_BLURBS[tool])} />
      <Card className="p-4 sm:p-5">
        <LabTool tool={tool} />
      </Card>
      <p className="mt-3 text-xs text-ink-3">
        {counted
          ? t(
              'Dnešní experiment s tímhle nástrojem je započtený do aktivity.',
              'Today’s experiment with this tool has been counted towards your activity.',
            )
          : t(
              'Experiment se započítá do dnešní aktivity po dvou minutách skutečného zkoušení, jednou za den.',
              'An experiment counts towards today’s activity after two minutes of real use, once a day.',
            )}
      </p>
    </div>
  );
}

/**
 * Count time actually spent using a tool: a second counts only if there was input in the
 * preceding twenty and the tab is visible. Reported once the threshold is reached.
 */
function useLabTime(tool: LabToolName): boolean {
  const refresh = useRefresh();
  const [counted, setCounted] = useState(false);
  const seconds = useRef(0);
  const lastInput = useRef(0);
  const sent = useRef(false);

  useEffect(() => {
    const touch = (): void => {
      lastInput.current = Date.now();
    };
    const events = ['pointerdown', 'pointermove', 'keydown', 'input'] as const;
    for (const name of events) window.addEventListener(name, touch, { passive: true });
    const timer = setInterval(() => {
      if (sent.current || document.hidden || Date.now() - lastInput.current > 20_000) return;
      seconds.current += 1;
      if (seconds.current >= ACTIVITY.LAB_MIN_SECONDS) {
        sent.current = true;
        void api
          .post<{ counted: boolean }>('/api/activity/lab', { tool, seconds: seconds.current })
          .then(() => {
            setCounted(true);
            refresh();
          })
          .catch(() => {
            sent.current = false;
          });
      }
    }, 1000);
    return () => {
      for (const name of events) window.removeEventListener(name, touch);
      clearInterval(timer);
    };
  }, [tool, refresh]);

  return counted;
}
