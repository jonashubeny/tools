import type { LearningMode, MeDto } from '@lemma/core';
import { useQueryClient } from '@tanstack/react-query';
import { Sigma, Terminal } from 'lucide-react';
import { useState } from 'react';
import { api } from '../app/api';
import { useT } from '../app/i18n';
import { cn } from '../lib/cn';
import { Button } from '../ui';

/**
 * After signing in, the first question: which mode. Both use the same account; progress,
 * history and everything learned are kept apart. The choice can be changed at any time
 * from the sidebar.
 */
export function ModeChoice({ me }: { me: MeDto }) {
  const t = useT();
  const client = useQueryClient();
  const [busy, setBusy] = useState<LearningMode | null>(null);

  const choose = async (mode: LearningMode): Promise<void> => {
    setBusy(mode);
    try {
      await api.put('/api/settings', { mode });
      await client.invalidateQueries();
    } finally {
      setBusy(null);
    }
  };

  const options: { mode: LearningMode; icon: typeof Sigma; title: string; text: string }[] = [
    {
      mode: 'math',
      icon: Sigma,
      title: t('Matematika', 'Mathematics'),
      text: t(
        'Osnovy, přijímací zkoušky, procvičování s nápovědou, Laboratoř chyb.',
        'The syllabus, entrance examinations, practice with hints, the Error Lab.',
      ),
    },
    {
      mode: 'infra',
      icon: Terminal,
      title: t('Linux a infrastruktura', 'Linux & Infrastructure'),
      text: t(
        'Praktické laboratoře na skutečných strojích: služby, disky, sítě, nasazení, bezpečnost.',
        'Hands-on labs on real machines: services, disks, networks, deployment, security.',
      ),
    },
  ];

  return (
    <div className="mx-auto max-w-2xl px-6 py-16">
      <div className="mono-label">Lemma</div>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight">{t('Co se dnes budeme učit?', 'What are we learning?')}</h1>
      <p className="mt-2 text-ink-2">
        {t(
          'Oba režimy používají tentýž účet, pokrok si ale vedou každý zvlášť. Přepnout jde kdykoli v postranním panelu.',
          'Both modes use the same account but keep their progress apart. You can switch at any time from the sidebar.',
        )}
      </p>
      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {options.map((option) => (
          <div
            key={option.mode}
            className={cn('flex flex-col rounded-xl border border-border bg-surface-1 p-5', me.settings.mode === option.mode && 'border-accent')}
          >
            <option.icon size={22} className="text-accent" aria-hidden />
            <div className="mt-3 font-semibold">{option.title}</div>
            <p className="mt-1 flex-1 text-sm text-ink-2">{option.text}</p>
            <Button className="mt-4" variant="primary" busy={busy === option.mode} onClick={() => void choose(option.mode)}>
              {t('Začít', 'Start')}
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
