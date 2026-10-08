import type { GraphDto, Locale, MeDto } from '@lemma/core';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { type FormEvent, useState } from 'react';
import { api } from '../app/api';
import { I18nProvider, useT } from '../app/i18n';
import { applyTheme } from '../app/theme';
import { Button, Field, Notice, Segmented, Select, TextInput } from '../ui';

/** The first minute: language, name, where the class is, how long a session should be. */
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
  const [name, setName] = useState(me.settings.name);
  const [topic, setTopic] = useState<number>(me.settings.currentTopic ?? 1);
  const [minutes, setMinutes] = useState(me.settings.sessionMinutes);
  const [theme, setTheme] = useState(me.settings.theme);
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent): Promise<void> => {
    event.preventDefault();
    setBusy(true);
    try {
      await api.post('/api/onboarding', { name, locale, theme, currentTopic: topic, sessionMinutes: minutes });
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
          'Čtyři věci, podle kterých se skládá denní plán. Všechno jde později změnit v Nastavení.',
          'Four things the daily plan is built from. Everything can be changed later in Settings.',
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
            placeholder="Jonas"
            className="max-w-xs"
          />
        </Field>

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

        {graph.data?.syllabus.source === 'transcription' && (
          <Notice
            tone="info"
            title={t(
              'Osnovy jsou opsané, ne načtené z dokumentu',
              'The syllabus is transcribed, not read from the document',
            )}
          >
            {t(
              'Seznam kapitol odpovídá tomu, co jsi zadal při zakládání projektu. Jakmile bude k dispozici oficiální dokument školy, je potřeba ho s ním porovnat.',
              'The list of chapters matches what you supplied when the project was set up. Once the school’s official document is available, it should be checked against it.',
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
