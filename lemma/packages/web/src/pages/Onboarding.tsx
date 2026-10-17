import type { GoalDto, GoalId, GraphDto, Locale, MeDto } from '@lemma/core';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { type FormEvent, useState } from 'react';
import { api } from '../app/api';
import { I18nProvider, useT } from '../app/i18n';
import { useGoals } from '../app/queries';
import { applyTheme } from '../app/theme';
import { cn } from '../lib/cn';
import { formatDay } from '../lib/format';
import { Button, Field, Notice, Segmented, Select, TextInput } from '../ui';

/** The first minute: language, name, what the learner is preparing for, how long a session should be. */
export function Onboarding({ me }: { me: MeDto }) {
  const [locale, setLocale] = useState<Locale>(me.settings.locale);
  return (
    <I18nProvider locale={locale}>
      <Form me={me} locale={locale} setLocale={setLocale} />
    </I18nProvider>
  );
}

function Form({ me, locale, setLocale }: { me: MeDto; locale: Locale; setLocale: (locale: Locale) => void }) {
  const t = useT();
  const client = useQueryClient();
  const graph = useQuery({ queryKey: ['graph'], queryFn: () => api.get<GraphDto>('/api/graph') });
  const goals = useGoals();
  // A teacher may have set the goal and the date beforehand: start from what is there.
  const [goal, setGoal] = useState<GoalId>(me.settings.goal);
  const [examDay, setExamDay] = useState(me.settings.examDay ?? '');
  const chosen = goals.data?.find((entry) => entry.id === goal);
  const entrance = chosen?.kind === 'entrance';
  const [name, setName] = useState(me.settings.name);
  const [topic, setTopic] = useState<number>(me.settings.currentTopic ?? 1);
  const [minutes, setMinutes] = useState(me.settings.sessionMinutes);
  const [theme, setTheme] = useState(me.settings.theme);
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent): Promise<void> => {
    event.preventDefault();
    setBusy(true);
    try {
      await api.post('/api/onboarding', {
        name,
        locale,
        theme,
        goal,
        examDay: entrance && examDay !== '' ? examDay : null,
        ...(entrance ? {} : { currentTopic: topic }),
        sessionMinutes: minutes,
      });
      await client.invalidateQueries();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-xl px-6 py-14">
      <div className="mono-label">Lemma</div>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight">
        {t('Nastavení na první spuštění', 'First-run setup')}
      </h1>
      <p className="mt-2 text-ink-2">
        {t(
          'Pár věcí, podle kterých se skládá denní plán. Všechno jde později změnit v Nastavení.',
          'A few things the daily plan is built from. Everything can be changed later in Settings.',
        )}
      </p>

      <form onSubmit={submit} className="mt-8 space-y-6">
        <div className="flex flex-wrap gap-6">
          <div>
            <div className="mb-1 text-[13px] font-medium text-ink-2">{t('Jazyk', 'Language')}</div>
            <Segmented
              label={t('Jazyk', 'Language')}
              value={locale}
              onChange={setLocale}
              options={[
                { value: 'cs', label: 'Čeština' },
                { value: 'en', label: 'English' },
              ]}
            />
          </div>
          <div>
            <div className="mb-1 text-[13px] font-medium text-ink-2">{t('Motiv', 'Theme')}</div>
            <Segmented
              label={t('Motiv', 'Theme')}
              value={theme}
              onChange={(next) => {
                setTheme(next);
                applyTheme(next);
              }}
              options={[
                { value: 'dark', label: t('Tmavý', 'Dark') },
                { value: 'light', label: t('Světlý', 'Light') },
                { value: 'system', label: t('Podle systému', 'System') },
              ]}
            />
          </div>
        </div>

        <Field label={t('Jak ti má aplikace říkat', 'What the app should call you')}>
          <TextInput
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={60}
            className="max-w-xs"
          />
        </Field>

        <div>
          <div className="mb-1.5 text-[13px] font-medium text-ink-2">
            {t('Na co se připravuješ', 'What you are preparing for')}
          </div>
          <div className="grid gap-2" role="radiogroup" aria-label={t('Cíl', 'Goal')}>
            {(goals.data ?? []).map((entry) => (
              <GoalOption key={entry.id} goal={entry} selected={entry.id === goal} onSelect={() => setGoal(entry.id)} />
            ))}
          </div>
        </div>

        {entrance && chosen?.facts ? (
          <Field
            label={t('Kdy zkoušku píšeš', 'When you sit the examination')}
            hint={t(
              `Nepovinné. Termíny níže jsou z oficiálního webu (načteno ${formatDay(chosen.facts.retrievedOn, 'cs')}); před zkouškou si je ověř.`,
              `Optional. The dates below are from the official site (read on ${formatDay(chosen.facts.retrievedOn, 'en')}); check them before the examination.`,
            )}
          >
            <TextInput
              type="date"
              value={examDay}
              onChange={(event) => setExamDay(event.target.value)}
              className="max-w-[12rem]"
            />
            <span className="mt-2 flex flex-wrap gap-1.5">
              {chosen.facts.terms.map((term) => (
                <button
                  key={term.day + term.label.cs}
                  type="button"
                  onClick={() => setExamDay(term.day)}
                  aria-pressed={examDay === term.day}
                  className={cn(
                    'h-7 rounded-md border px-2 text-xs',
                    examDay === term.day
                      ? 'border-accent bg-accent-wash text-ink'
                      : 'border-border-strong bg-surface-2 text-ink-2 hover:bg-surface-3',
                  )}
                >
                  {t(term.label)} · {formatDay(term.day, t.locale)}
                </button>
              ))}
            </span>
          </Field>
        ) : (
          <Field
            label={t('Kterou kapitolu teď ve škole probíráte', 'Which chapter your class is on now')}
            hint={t(
              'Podle ní se vybírá nová látka. Až se ve škole posunete, změň ji.',
              'New material is chosen from it. Change it when the class moves on.',
            )}
          >
            <Select value={topic} onChange={(event) => setTopic(Number(event.target.value))}>
              {(graph.data?.topics ?? []).map((item) => (
                <option key={item.n} value={item.n}>
                  {item.n}. {t(item.title)}
                </option>
              ))}
            </Select>
          </Field>
        )}

        <div>
          <div className="mb-1 text-[13px] font-medium text-ink-2">
            {t('Obvyklá délka jednoho sezení', 'Usual length of one session')}
          </div>
          <Segmented
            label={t('Délka sezení', 'Session length')}
            value={String(minutes)}
            onChange={(value) => setMinutes(Number(value))}
            options={[15, 30, 45, 60].map((value) => ({ value: String(value), label: `${value} min` }))}
          />
          <div className="mt-1 text-xs text-ink-3">
            {t(
              'Každý den jde zvolit jinou. Kratší pravidelně je lepší než dlouhé občas.',
              'You can pick a different one each day. Short and regular beats long and occasional.',
            )}
          </div>
        </div>

        {entrance && (
          <Notice
            tone="info"
            title={t('Začne se krátkým rozřazovacím testem', 'It starts with a short placement test')}
          >
            {t(
              'Asi patnáct úloh napříč látkou, bez známky. Podle nich se nastaví, odkud začít. Jde přeskočit — pak se začíná od základů.',
              'About fifteen problems across the curriculum, with no mark. They set where to start. It can be skipped — then everything starts from the basics.',
            )}
          </Notice>
        )}
        {!entrance && graph.data?.syllabus.source === 'transcription' && (
          <Notice
            tone="info"
            title={t(
              'Osnovy jsou opsané, ne načtené z dokumentu',
              'The syllabus is transcribed, not read from the document',
            )}
          >
            {t(
              'Seznam kapitol odpovídá tomu, co bylo zadáno při zakládání projektu. Jakmile bude k dispozici oficiální dokument školy, je potřeba ho s ním porovnat.',
              'The list of chapters matches what was supplied when the project was set up. Once the school’s official document is available, it should be checked against it.',
            )}
          </Notice>
        )}

        <Button type="submit" variant="primary" size="lg" busy={busy}>
          {t('Začít', 'Start')}
        </Button>
      </form>
    </div>
  );
}

function GoalOption({ goal, selected, onSelect }: { goal: GoalDto; selected: boolean; onSelect: () => void }) {
  const t = useT();
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={cn(
        'flex items-start gap-3 rounded-lg border px-3.5 py-2.5 text-left',
        selected ? 'border-accent bg-accent-wash' : 'border-border-strong bg-surface-2 hover:bg-surface-3',
      )}
    >
      <span
        className={cn(
          'mt-1 grid h-4 w-4 shrink-0 place-items-center rounded-full border',
          selected ? 'border-accent' : 'border-border-strong',
        )}
      >
        {selected && <span className="h-2 w-2 rounded-full bg-accent" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium">{t(goal.title)}</span>
        <span className="mt-0.5 block text-[13px] text-ink-2">{t(goal.description)}</span>
      </span>
    </button>
  );
}
