import {
  type ForgeDto,
  type GoalId,
  type GradeScale,
  type MeDto,
  type PauseDto,
  type SettingsDto,
  type TestDto,
  type UserDto,
  ADMIN_USERNAME,
  MIN_PASSWORD_LENGTH,
  USERNAME_PATTERN,
} from '@lemma/core';
import { useQueryClient } from '@tanstack/react-query';
import { Download, KeyRound, RefreshCw, Trash2, X } from 'lucide-react';
import { type FormEvent, type ReactNode, useEffect, useState } from 'react';
import { useLocation } from 'react-router';
import { ApiFailure, api } from '../app/api';
import { useT } from '../app/i18n';
import { useEntrance } from '../app/nav';
import { useForge, useGoals, useGraph, useMe, useRefresh, useUsers } from '../app/queries';
import { cn } from '../lib/cn';
import { formatDateTime, formatDay } from '../lib/format';
import {
  Badge,
  Button,
  Card,
  ErrorNote,
  Field,
  IconButton,
  Loading,
  Notice,
  PageHeader,
  Segmented,
  Select,
  StatusIcon,
  Switch,
  TextInput,
} from '../ui';

export function Settings() {
  const t = useT();
  const me = useMe();
  const client = useQueryClient();
  const refresh = useRefresh();
  const location = useLocation();
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    if (me.data && location.hash) document.getElementById(location.hash.slice(1))?.scrollIntoView({ block: 'start' });
  }, [me.data, location.hash]);

  const entrance = useEntrance(me.data?.settings.goal);
  if (!me.data) return <Loading />;
  const settings = me.data.settings;
  const admin = me.data.account?.admin ?? false;

  const save = async (patch: Partial<SettingsDto>): Promise<void> => {
    setError(null);
    try {
      await api.put('/api/settings', patch);
      await client.invalidateQueries({ queryKey: ['me'] });
      refresh();
    } catch (failure) {
      setError(failure);
    }
  };

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title={t('Nastavení', 'Settings')}
        lead={t('Změny se ukládají hned.', 'Changes are saved at once.')}
      />
      {error !== null && (
        <div className="mb-5">
          <ErrorNote error={error} />
        </div>
      )}
      <div className="space-y-5">
        <Profile settings={settings} save={save} />
        <Goal settings={settings} save={save} teachers={me.data.teachers} />
        <Learning settings={settings} save={save} entrance={entrance} />
        {/* Tests by chapter and school grades belong to the school syllabus. */}
        {!entrance && <Tests settings={settings} save={save} today={me.data.today} />}
        <Pauses settings={settings} save={save} />
        {!entrance && <Grades settings={settings} save={save} />}
        <Integrations settings={settings} save={save} admin={admin} />
        <Tutor me={me.data} />
        {me.data.authRequired && <Password />}
        {me.data.authRequired && admin && <Users tutorConfigured={me.data.tutor.enabled} />}
        <Data me={me.data} />
      </div>
    </div>
  );
}

type Save = (patch: Partial<SettingsDto>) => Promise<void>;

function Panel({ id, title, lead, children }: { id?: string; title: string; lead?: ReactNode; children: ReactNode }) {
  return (
    <Card id={id} className="scroll-mt-16 p-5">
      <h2 className="font-semibold">{title}</h2>
      {lead && <p className="mt-1 text-[13px] text-ink-2">{lead}</p>}
      <div className="mt-4 space-y-4">{children}</div>
    </Card>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
      <span className="text-sm">{label}</span>
      {children}
    </div>
  );
}

function Profile({ settings, save }: { settings: SettingsDto; save: Save }) {
  const t = useT();
  const [name, setName] = useState(settings.name);
  return (
    <Panel title={t('Profil a vzhled', 'Profile and appearance')}>
      <Field label={t('Jméno', 'Name')}>
        <TextInput
          value={name}
          maxLength={60}
          onChange={(event) => setName(event.target.value)}
          onBlur={() => name !== settings.name && void save({ name })}
          className="max-w-xs"
        />
      </Field>
      <Row label={t('Jazyk', 'Language')}>
        <Segmented
          label={t('Jazyk', 'Language')}
          value={settings.locale}
          onChange={(locale) => void save({ locale })}
          options={[
            { value: 'cs', label: 'Čeština' },
            { value: 'en', label: 'English' },
          ]}
        />
      </Row>
      <Row label={t('Motiv', 'Theme')}>
        <Segmented
          label={t('Motiv', 'Theme')}
          value={settings.theme}
          onChange={(theme) => void save({ theme })}
          options={[
            { value: 'dark', label: t('Tmavý', 'Dark') },
            { value: 'light', label: t('Světlý', 'Light') },
            { value: 'system', label: t('Podle systému', 'System') },
          ]}
        />
      </Row>
      <Switch
        checked={settings.decimalComma}
        onChange={(decimalComma) => void save({ decimalComma })}
        label={t('Desetinná čárka v odpovědích (2,5 místo 2.5)', 'Decimal comma in answers (2,5 instead of 2.5)')}
      />
    </Panel>
  );
}

/** What the learner is preparing for, when, and who can see how it goes. */
function Goal({ settings, save, teachers }: { settings: SettingsDto; save: Save; teachers: string[] }) {
  const t = useT();
  const goals = useGoals();
  const graph = useGraph();
  const chosen = goals.data?.find((goal) => goal.id === settings.goal);
  const entrance = chosen?.kind === 'entrance';
  const [examDay, setExamDay] = useState(settings.examDay ?? '');
  useEffect(() => setExamDay(settings.examDay ?? ''), [settings.examDay]);
  const skills = (graph.data?.skills ?? []).filter((skill) => skill.hasProblems);
  const titleOf = (id: string): string => {
    const skill = skills.find((entry) => entry.id === id);
    return skill ? t(skill.title) : id;
  };
  return (
    <Panel
      id="goal"
      title={t('Cíl', 'Goal')}
      lead={t(
        'Podle cíle se řídí všechno ostatní: které dovednosti aplikace nabízí, jak je váží a z čeho skládá plán. Záznam úloh se změnou cíle nemaže.',
        'Everything else follows from the goal: which skills the app offers, how it weighs them, and what the plan is made of. Changing the goal erases nothing of the log.',
      )}
    >
      <Field label={t('Na co se připravuji', 'What I am preparing for')}>
        <Select value={settings.goal} onChange={(event) => void save({ goal: event.target.value as GoalId })}>
          {(goals.data ?? []).map((goal) => (
            <option key={goal.id} value={goal.id}>
              {t(goal.title)}
            </option>
          ))}
        </Select>
      </Field>
      {entrance && chosen?.facts && (
        <>
          <Field
            label={t('Termín zkoušky', 'Examination date')}
            hint={t(
              `Termíny níže jsou z oficiálního webu, načteno ${formatDay(chosen.facts.retrievedOn, 'cs')}. Před zkouškou si je ověř.`,
              `The dates below are from the official site, read on ${formatDay(chosen.facts.retrievedOn, 'en')}. Check them before the examination.`,
            )}
          >
            <span className="flex flex-wrap items-center gap-2">
              <TextInput
                type="date"
                value={examDay}
                onChange={(event) => setExamDay(event.target.value)}
                onBlur={() =>
                  examDay !== (settings.examDay ?? '') && void save({ examDay: examDay === '' ? null : examDay })
                }
                className="w-44"
              />
              {chosen.facts.terms.map((term) => (
                <button
                  key={term.day + term.label.cs}
                  type="button"
                  aria-pressed={settings.examDay === term.day}
                  onClick={() => void save({ examDay: term.day })}
                  className={cn(
                    'h-7 rounded-md border px-2 text-xs',
                    settings.examDay === term.day
                      ? 'border-accent bg-accent-wash text-ink'
                      : 'border-border-strong bg-surface-2 text-ink-2 hover:bg-surface-3',
                  )}
                >
                  {t(term.label)} · {formatDay(term.day, t.locale)}
                </button>
              ))}
            </span>
          </Field>
          <Field
            label={t('Co teď probíráte ve škole', 'What your class is on now')}
            hint={t(
              'Nepovinné. Co je tu vybrané, dostává v plánu přednost.',
              'Optional. What is chosen here is given precedence in the plan.',
            )}
          >
            <Select
              value=""
              onChange={(event) =>
                event.target.value !== '' && void save({ inSchool: [...settings.inSchool, event.target.value] })
              }
            >
              <option value="">{t('— přidat dovednost —', '— add a skill —')}</option>
              {skills
                .filter((skill) => !settings.inSchool.includes(skill.id))
                .map((skill) => (
                  <option key={skill.id} value={skill.id}>
                    {t(skill.title)}
                  </option>
                ))}
            </Select>
            {settings.inSchool.length > 0 && (
              <span className="mt-2 flex flex-wrap gap-1.5">
                {settings.inSchool.map((id) => (
                  <span
                    key={id}
                    className="inline-flex h-7 items-center gap-1 rounded-md border border-border-strong bg-surface-2 pr-1 pl-2 text-xs"
                  >
                    {titleOf(id)}
                    <button
                      type="button"
                      aria-label={`${t('Odebrat', 'Remove')}: ${titleOf(id)}`}
                      onClick={() => void save({ inSchool: settings.inSchool.filter((entry) => entry !== id) })}
                      className="grid h-5 w-5 place-items-center rounded text-ink-3 hover:bg-surface-3 hover:text-ink"
                    >
                      <X size={12} />
                    </button>
                  </span>
                ))}
              </span>
            )}
          </Field>
        </>
      )}
      <Notice tone="info" title={t('Kdo vidí tvou práci', 'Who can see your work')}>
        {teachers.length > 0 ? (
          <>
            <span className="font-mono text-ink">{teachers.join(', ')}</span>{' '}
            {t(
              '— vidí tvé úlohy, odpovědi, chyby a výsledky testů, může ti zadávat práci a nastavit cíl a termín zkoušky. Nastavuje to správce.',
              '— can see your problems, answers, errors and test results, can set work for you, and can set the goal and the examination date. The administrator decides this.',
            )}
          </>
        ) : (
          t(
            'Nikdo jiný než ty. Učitele může účtu přiřadit jen správce a tady by to bylo vidět.',
            'Nobody but you. Only the administrator can give an account a teacher, and it would show here.',
          )
        )}
      </Notice>
    </Panel>
  );
}

function Learning({ settings, save, entrance }: { settings: SettingsDto; save: Save; entrance: boolean }) {
  const t = useT();
  const graph = useGraph();
  return (
    <Panel title={t('Učení', 'Learning')}>
      {!entrance && (
        <Field
          label={t('Kapitola, kterou teď ve škole probíráte', 'The chapter your class is on now')}
          hint={t('Podle ní se vybírá nová látka v denním plánu.', 'New material in the daily plan is chosen from it.')}
        >
          <Select
            value={settings.currentTopic ?? ''}
            onChange={(event) =>
              void save({ currentTopic: event.target.value === '' ? null : Number(event.target.value) })
            }
          >
            <option value="">{t('— nenastaveno —', '— not set —')}</option>
            {(graph.data?.topics ?? []).map((topic) => (
              <option key={topic.n} value={topic.n}>
                {topic.n}. {t(topic.title)}
              </option>
            ))}
          </Select>
        </Field>
      )}
      <Row label={t('Obvyklá délka sezení', 'Usual session length')}>
        <Segmented
          label={t('Délka sezení', 'Session length')}
          value={String(settings.sessionMinutes)}
          onChange={(value) => void save({ sessionMinutes: Number(value) })}
          options={[...new Set([15, 30, 45, 60, settings.sessionMinutes])]
            .sort((a, b) => a - b)
            .map((value) => ({ value: String(value), label: `${value} min` }))}
        />
      </Row>
      <Row label={t('Týdenní cíl (aktivních dní)', 'Weekly goal (active days)')}>
        <Segmented
          label={t('Týdenní cíl', 'Weekly goal')}
          value={String(settings.weekGoal)}
          onChange={(value) => void save({ weekGoal: Number(value) })}
          options={[2, 3, 4, 5, 6, 7].map((value) => ({ value: String(value), label: String(value) }))}
        />
      </Row>
      <Switch
        checked={settings.confidencePrompt}
        onChange={(confidencePrompt) => void save({ confidencePrompt })}
        label={t('Před odesláním se ptát, jak moc si věřím', 'Ask how sure I am before submitting')}
      />
      <p className="text-xs text-ink-3">
        {t(
          'Odpověď „jistě“, která je špatně, je nejlepší stopa po nepozornosti. Proto se na to aplikace ptá.',
          'A “sure” answer that turns out wrong is the best trace of a slip. That is why the app asks.',
        )}
      </p>
    </Panel>
  );
}

function Tests({ settings, save, today }: { settings: SettingsDto; save: Save; today: string }) {
  const t = useT();
  const graph = useGraph();
  const [day, setDay] = useState('');
  const [title, setTitle] = useState('');
  const [topics, setTopics] = useState<number[]>(settings.currentTopic ? [settings.currentTopic] : []);
  const tests = [...settings.tests].sort((a, b) => a.day.localeCompare(b.day));
  const add = (event: FormEvent): void => {
    event.preventDefault();
    if (!day || topics.length === 0) return;
    const next: TestDto[] = [...settings.tests, { id: '', day, title, topics }];
    void save({ tests: next });
    setDay('');
    setTitle('');
  };
  return (
    <Panel
      id="tests"
      title={t('Testy ve škole', 'Tests at school')}
      lead={t(
        'Týden před testem se denní plán začne chystat: víc namíchaného opakování, den předem test nanečisto.',
        'A week before a test the daily plan starts preparing: more mixed review, and a mock the day before.',
      )}
    >
      {tests.length > 0 && (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {tests.map((test) => (
            <li
              key={test.id}
              className={cn(
                'flex items-center justify-between gap-3 px-3 py-2 text-sm',
                test.day < today && 'text-ink-3',
              )}
            >
              <span className="min-w-0">
                <span className="font-medium">{test.title || t('Test', 'Test')}</span>
                <span className="ml-2 text-ink-2">
                  {formatDay(test.day, t.locale)} · {t('kapitoly', 'chapters')} {test.topics.join(', ')}
                </span>
              </span>
              <IconButton
                label={t('Smazat test', 'Delete the test')}
                onClick={() => void save({ tests: settings.tests.filter((item) => item.id !== test.id) })}
              >
                <Trash2 size={14} />
              </IconButton>
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={add} className="space-y-3 rounded-lg border border-border bg-surface-2 p-3">
        <div className="flex flex-wrap gap-3">
          <Field label={t('Datum', 'Date')}>
            <TextInput
              type="date"
              value={day}
              min={today}
              onChange={(event) => setDay(event.target.value)}
              required
              className="w-44"
            />
          </Field>
          <Field label={t('Název (nepovinný)', 'Title (optional)')} className="min-w-0 flex-1">
            <TextInput
              value={title}
              maxLength={80}
              onChange={(event) => setTitle(event.target.value)}
              placeholder={t('Čtvrtletní písemka', 'Term test')}
            />
          </Field>
        </div>
        <div>
          <div className="mb-1 text-[13px] font-medium text-ink-2">{t('Kapitoly', 'Chapters')}</div>
          <div className="flex flex-wrap gap-1.5">
            {(graph.data?.topics ?? []).map((topic) => {
              const on = topics.includes(topic.n);
              return (
                <button
                  key={topic.n}
                  type="button"
                  aria-pressed={on}
                  title={t(topic.title)}
                  onClick={() =>
                    setTopics((current) =>
                      on ? current.filter((n) => n !== topic.n) : [...current, topic.n].sort((a, b) => a - b),
                    )
                  }
                  className={cn(
                    'h-7 min-w-8 rounded-md border px-2 font-mono text-xs',
                    on
                      ? 'border-accent bg-accent-wash text-ink'
                      : 'border-border-strong bg-surface-1 text-ink-2 hover:bg-surface-3',
                  )}
                >
                  {topic.n}
                </button>
              );
            })}
          </div>
        </div>
        <Button type="submit" size="sm" disabled={!day || topics.length === 0}>
          {t('Přidat test', 'Add the test')}
        </Button>
      </form>
    </Panel>
  );
}

function Pauses({ settings, save }: { settings: SettingsDto; save: Save }) {
  const t = useT();
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [label, setLabel] = useState('');
  const add = (event: FormEvent): void => {
    event.preventDefault();
    if (!from || !to || from > to) return;
    const next: PauseDto[] = [...settings.pauses, { from, to, label }];
    void save({ pauses: next });
    setFrom('');
    setTo('');
    setLabel('');
  };
  return (
    <Panel
      title={t('Pauzy', 'Pauses')}
      lead={t(
        'Prázdniny, nemoc, lyžák. V pauze se nic nepřeruší a nic nepočítá — pravidelnost ani série.',
        'Holidays, illness, a ski trip. During a pause nothing breaks and nothing counts — neither consistency nor the run.',
      )}
    >
      {settings.pauses.length > 0 && (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {settings.pauses.map((pause, index) => (
            <li key={`${pause.from}-${index}`} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
              <span>
                <span className="font-medium">{pause.label || t('Pauza', 'Pause')}</span>
                <span className="ml-2 text-ink-2">
                  {formatDay(pause.from, t.locale)} – {formatDay(pause.to, t.locale)}
                </span>
              </span>
              <IconButton
                label={t('Smazat pauzu', 'Delete the pause')}
                onClick={() => void save({ pauses: settings.pauses.filter((_, i) => i !== index) })}
              >
                <Trash2 size={14} />
              </IconButton>
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={add} className="flex flex-wrap items-end gap-3 rounded-lg border border-border bg-surface-2 p-3">
        <Field label={t('Od', 'From')}>
          <TextInput
            type="date"
            value={from}
            onChange={(event) => setFrom(event.target.value)}
            required
            className="w-44"
          />
        </Field>
        <Field label={t('Do', 'To')}>
          <TextInput
            type="date"
            value={to}
            min={from}
            onChange={(event) => setTo(event.target.value)}
            required
            className="w-44"
          />
        </Field>
        <Field label={t('Popis', 'Label')} className="min-w-0 flex-1">
          <TextInput value={label} maxLength={60} onChange={(event) => setLabel(event.target.value)} />
        </Field>
        <Button type="submit" size="sm" disabled={!from || !to || from > to}>
          {t('Přidat', 'Add')}
        </Button>
      </form>
    </Panel>
  );
}

function Grades({ settings, save }: { settings: SettingsDto; save: Save }) {
  const t = useT();
  const scale = settings.gradeScale;
  const [draft, setDraft] = useState<string[]>((scale ?? [90, 75, 50, 30]).map(String));
  const valid = draft
    .map(Number)
    .every(
      (value, index, list) =>
        Number.isFinite(value) && value >= 0 && value <= 100 && (index === 0 || value < list[index - 1]!),
    );
  return (
    <Panel
      title={t('Známky u zkoušek nanečisto', 'Grades in mock exams')}
      lead={t(
        'Dolní hranice v procentech pro známky 1 až 4. Nastav je podle toho, jak známkuje váš učitel; výchozí hodnoty jsou jen odhad.',
        'Lower bounds in percent for grades 1 to 4. Set them to match your teacher’s marking; the defaults are only a guess.',
      )}
    >
      <Switch
        checked={scale !== null}
        onChange={(on) => void save({ gradeScale: on ? ([90, 75, 50, 30] as unknown as GradeScale) : null })}
        label={t('Zobrazovat známku', 'Show a grade')}
      />
      {scale !== null && (
        <div className="flex flex-wrap items-end gap-3">
          {draft.map((value, index) => (
            <Field key={index} label={`${t('Známka', 'Grade')} ${index + 1} ${t('od', 'from')}`}>
              <div className="flex items-center gap-1.5">
                <TextInput
                  type="number"
                  min={0}
                  max={100}
                  value={value}
                  onChange={(event) =>
                    setDraft((list) => list.map((item, i) => (i === index ? event.target.value : item)))
                  }
                  className="w-20"
                />
                <span className="text-sm text-ink-3">%</span>
              </div>
            </Field>
          ))}
          <Button
            size="sm"
            disabled={!valid}
            onClick={() => void save({ gradeScale: draft.map(Number) as unknown as GradeScale })}
          >
            {t('Uložit stupnici', 'Save the scale')}
          </Button>
        </div>
      )}
      {scale !== null && !valid && (
        <p className="text-xs text-ink-3">
          {t(
            'Hranice musí klesat: jednička nejvýš, čtyřka nejníž.',
            'The bounds must decrease: grade 1 highest, grade 4 lowest.',
          )}
        </p>
      )}
    </Panel>
  );
}

function Integrations({ settings, save, admin }: { settings: SettingsDto; save: Save; admin: boolean }) {
  const t = useT();
  const forge = useForge();
  const client = useQueryClient();
  const [github, setGithub] = useState(settings.githubUser);
  const [forgejoUrl, setForgejoUrl] = useState(settings.forgejoUrl);
  const [forgejoUser, setForgejoUser] = useState(settings.forgejoUser);
  const [busy, setBusy] = useState(false);
  const reload = async (): Promise<void> => {
    setBusy(true);
    try {
      client.setQueryData(['forge'], await api.post<ForgeDto>('/api/forge/refresh'));
      await client.invalidateQueries({ queryKey: ['dashboard'] });
    } finally {
      setBusy(false);
    }
  };
  return (
    <Panel
      title={admin ? t('GitHub a Forgejo', 'GitHub and Forgejo') : 'GitHub'}
      lead={t(
        'Volitelné. Lemma si z veřejných API stáhne počty tvých příspěvků a ukáže je vedle matematiky. Bez přihlášení, jen veřejná data; když služba neodpovídá, použije se poslední uložená kopie.',
        'Optional. Lemma fetches your contribution counts from the public APIs and shows them next to the mathematics. No sign-in, public data only; when a service is down the last stored copy is used.',
      )}
    >
      <Field label={t('Uživatelské jméno na GitHubu', 'GitHub username')}>
        <TextInput
          value={github}
          onChange={(event) => setGithub(event.target.value.trim())}
          onBlur={() => github !== settings.githubUser && void save({ githubUser: github })}
          className="max-w-xs"
          autoCapitalize="off"
          spellCheck={false}
        />
      </Field>
      {/* An address makes the server call that host, so naming one is the administrator's alone. */}
      <div className={cn('flex flex-wrap gap-3', !admin && 'hidden')}>
        <Field label={t('Adresa Forgejo / Gitea', 'Forgejo / Gitea address')} className="min-w-0 flex-1">
          <TextInput
            value={forgejoUrl}
            onChange={(event) => setForgejoUrl(event.target.value.trim())}
            onBlur={() => forgejoUrl !== settings.forgejoUrl && void save({ forgejoUrl })}
            placeholder="https://git.example.org"
            inputMode="url"
          />
        </Field>
        <Field label={t('Uživatel', 'User')}>
          <TextInput
            value={forgejoUser}
            onChange={(event) => setForgejoUser(event.target.value.trim())}
            onBlur={() => forgejoUser !== settings.forgejoUser && void save({ forgejoUser })}
            className="w-44"
            autoCapitalize="off"
            spellCheck={false}
          />
        </Field>
      </div>
      {forge.data && forge.data.sources.length > 0 && (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {forge.data.sources.map((source) => (
            <li key={source.id} className="flex items-start gap-2.5 px-3 py-2 text-sm">
              <span className="mt-0.5">
                <StatusIcon tone={source.ok ? 'good' : 'serious'} size={15} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="font-medium">{source.label}</span>
                <span className="block text-[13px] text-ink-2">
                  {source.ok ? t('v pořádku', 'working') : `${t('nepovedlo se', 'failed')}: ${source.error ?? ''}`}
                  {source.fetchedAt !== null && ` · ${formatDateTime(source.fetchedAt, t.locale)}`}
                </span>
                {source.note && <span className="block text-xs text-ink-3">{source.note}</span>}
              </span>
            </li>
          ))}
        </ul>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <Button size="sm" onClick={() => void reload()} busy={busy} disabled={!forge.data?.configured}>
          <RefreshCw size={13} />
          {t('Načíst teď', 'Fetch now')}
        </Button>
        {admin && (
          <span className="text-xs text-ink-3">
            {t(
              'Přístupové tokeny (pro soukromou aktivitu nebo vyšší limity) se zadávají jen v souboru .env, nikdy tady.',
              'Access tokens (for private activity or higher limits) go in the .env file only, never here.',
            )}
          </span>
        )}
      </div>
    </Panel>
  );
}

function Tutor({ me }: { me: MeDto }) {
  const t = useT();
  return (
    <Panel
      title={t('AI tutor', 'AI tutor')}
      lead={t(
        'Volitelný. Bez něj funguje všechno ostatní úplně stejně; správnost odpovědí na něm nikdy nezávisí.',
        'Optional. Everything else works exactly the same without it; the correctness of answers never depends on it.',
      )}
    >
      {me.tutor.enabled ? (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <StatusIcon tone="good" />
          {t('Zapnutý', 'Enabled')}
          <Badge>{me.tutor.provider}</Badge>
          <Badge>{me.tutor.model}</Badge>
        </div>
      ) : (
        <Notice tone="info" title={t('Vypnutý', 'Off')}>
          {!me.account?.admin ? (
            t(
              'Tutora zapíná správce této instance, pro každý účet zvlášť.',
              'The tutor is switched on by the administrator of this instance, account by account.',
            )
          ) : (
            <TutorSetup />
          )}
        </Notice>
      )}
      <p className="text-xs text-ink-3">
        {t(
          'Co se posílá poskytovateli modelu: tvoje zprávy, zadání a tvé pokusy u úlohy, o které se bavíte, a stručný přehled toho, co ti jde a nejde. Nic jiného z databáze.',
          'What is sent to the model provider: your messages, the statement and your attempts for the problem under discussion, and a brief summary of what you find easy and hard. Nothing else from the database.',
        )}
      </p>
    </Panel>
  );
}

function TutorSetup() {
  const t = useT();
  return (
    <>
      {t('Zapíná se v souboru .env: buď ', 'It is enabled in the .env file: either ')}
      <code>ANTHROPIC_API_KEY</code>
      {t(' pro Claude, nebo ', ' for Claude, or ')}
      <code>OPENAI_BASE_URL</code> + <code>AI_MODEL</code>
      {t(
        ' pro model běžící u tebe (Ollama, llama.cpp…). Pak restartuj kontejner.',
        ' for a model running on your own hardware (Ollama, llama.cpp…). Then restart the container.',
      )}
    </>
  );
}

function Password() {
  const t = useT();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [state, setState] = useState<'idle' | 'busy' | 'done' | 'wrong' | 'failed'>('idle');
  const submit = async (event: FormEvent): Promise<void> => {
    event.preventDefault();
    setState('busy');
    try {
      await api.post('/api/auth/password', { current, next });
      setCurrent('');
      setNext('');
      setState('done');
    } catch (failure) {
      setState(failure instanceof ApiFailure && failure.status === 401 ? 'wrong' : 'failed');
    }
  };
  return (
    <Panel
      title={t('Heslo', 'Password')}
      lead={t('Změna hesla odhlásí všechna ostatní zařízení.', 'Changing the password signs every other device out.')}
    >
      <form onSubmit={submit} className="flex flex-wrap items-end gap-3">
        <Field label={t('Současné', 'Current')}>
          <TextInput
            type="password"
            autoComplete="current-password"
            value={current}
            onChange={(event) => setCurrent(event.target.value)}
            className="w-52"
          />
        </Field>
        <Field label={t('Nové (aspoň 8 znaků)', 'New (at least 8 characters)')}>
          <TextInput
            type="password"
            autoComplete="new-password"
            value={next}
            minLength={8}
            onChange={(event) => setNext(event.target.value)}
            className="w-52"
          />
        </Field>
        <Button type="submit" busy={state === 'busy'} disabled={current === '' || next.length < 8}>
          {t('Změnit heslo', 'Change the password')}
        </Button>
      </form>
      {state === 'done' && <Notice tone="good" title={t('Heslo je změněné', 'The password has been changed')} />}
      {state === 'wrong' && (
        <Notice tone="serious" title={t('Současné heslo nesedí', 'The current password is not right')} />
      )}
      {state === 'failed' && <Notice tone="serious" title={t('Změna se nepovedla', 'The change failed')} />}
    </Panel>
  );
}

/** The administrator's panel: who else has an account here. */
function Users({ tutorConfigured }: { tutorConfigured: boolean }) {
  const t = useT();
  const client = useQueryClient();
  const users = useUsers(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [tutor, setTutor] = useState(false);
  // The row that is being given a new password, or asked about once more before removal.
  const [open, setOpen] = useState<{ username: string; action: 'password' | 'remove' } | null>(null);
  const [nextPassword, setNextPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: 'good' | 'serious'; text: string } | null>(null);

  const explain = (failure: unknown): string => {
    if (failure instanceof ApiFailure && failure.code === 'username_taken')
      return t('Takové jméno už tu je.', 'That name is taken.');
    if (failure instanceof ApiFailure && failure.status === 400)
      return t(
        `Jméno má 2 až 32 znaků: malá písmena bez diakritiky, číslice, tečka, pomlčka nebo podtržítko. Heslo má aspoň ${MIN_PASSWORD_LENGTH} znaků.`,
        `A name has 2 to 32 characters: lower-case letters, digits, a dot, a dash or an underscore. A password has at least ${MIN_PASSWORD_LENGTH} characters.`,
      );
    return t('Nepovedlo se. Podrobnosti jsou v logu serveru.', 'It failed. Details are in the server log.');
  };
  const act = async (action: () => Promise<unknown>, done: string | null): Promise<void> => {
    setBusy(true);
    setMessage(null);
    try {
      await action();
      await client.invalidateQueries({ queryKey: ['users'] });
      setOpen(null);
      setNextPassword('');
      if (done) setMessage({ tone: 'good', text: done });
    } catch (failure) {
      setMessage({ tone: 'serious', text: explain(failure) });
    } finally {
      setBusy(false);
    }
  };

  const name = username.trim().toLowerCase();
  const creatable = USERNAME_PATTERN.test(name) && name !== ADMIN_USERNAME && password.length >= MIN_PASSWORD_LENGTH;
  const create = (event: FormEvent): void => {
    event.preventDefault();
    void act(
      async () => {
        await api.post('/api/admin/users', { username: name, password, tutor: tutorConfigured && tutor });
        setUsername('');
        setPassword('');
        setTutor(false);
      },
      t(
        `Uživatel ${name} je založený. Řekni mu jméno a heslo.`,
        `User ${name} exists. Tell them the name and the password.`,
      ),
    );
  };
  const urlOf = (user: UserDto): string => `/api/admin/users/${encodeURIComponent(user.username)}`;

  return (
    <Panel
      id="users"
      title={t('Uživatelé', 'Users')}
      lead={t(
        'Ty jsi správce: účet „admin“ s heslem ze souboru .env. Každý další uživatel má vlastní účet a vlastní data – nevidí nic tvého ani cizího a začíná od nuly.',
        'You are the administrator: the account “admin”, with the password from the .env file. Every other user has an account and data of their own — they see nothing of yours or anyone else’s, and start from nothing.',
      )}
    >
      <form onSubmit={create} className="flex flex-wrap items-end gap-3">
        <Field label={t('Jméno', 'Name')}>
          <TextInput
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            className="w-44"
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            maxLength={32}
          />
        </Field>
        {/* Shown as typed: it is a first password to hand over, and the user changes it. */}
        <Field
          label={t(
            `Heslo (aspoň ${MIN_PASSWORD_LENGTH} znaků)`,
            `Password (at least ${MIN_PASSWORD_LENGTH} characters)`,
          )}
        >
          <TextInput
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="w-52"
            autoComplete="off"
            spellCheck={false}
          />
        </Field>
        <Button type="submit" busy={busy && open === null} disabled={!creatable}>
          {t('Založit uživatele', 'Create the user')}
        </Button>
      </form>
      {tutorConfigured && (
        <Switch
          checked={tutor}
          onChange={setTutor}
          label={t(
            'Nový uživatel smí používat AI tutora (běží na tvůj API klíč)',
            'The new user may use the AI tutor (it runs on your API key)',
          )}
        />
      )}
      {message && <Notice tone={message.tone}>{message.text}</Notice>}

      {users.isError && <ErrorNote error={users.error} retry={() => void users.refetch()} />}
      {users.data && users.data.length === 0 && (
        <p className="text-sm text-ink-2">
          {t(
            'Zatím tu jsi jen ty. Dokud nikoho nezaložíš, přihlašuje se jen heslem jako dosud.',
            'So far it is only you. Until you create somebody, signing in takes the password alone, as before.',
          )}
        </p>
      )}
      {users.data && users.data.length > 0 && (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {users.data.map((user) => (
            <li key={user.username} className="space-y-2 px-3 py-2.5">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                <span className="min-w-0 flex-1">
                  <span className="font-mono text-sm font-medium">{user.username}</span>
                  <span className="block text-xs text-ink-3">
                    {t('účet založen', 'created')} {formatDateTime(user.createdAt, t.locale)}
                    {' · '}
                    {user.lastSeenAt === null
                      ? t('zatím bez přihlášení', 'has not signed in yet')
                      : `${t('naposledy', 'last seen')} ${formatDateTime(user.lastSeenAt, t.locale)}`}
                  </span>
                </span>
                {tutorConfigured && (
                  <Switch
                    checked={user.tutor}
                    onChange={(next) => void act(() => api.put(urlOf(user), { tutor: next }), null)}
                    label={t('AI tutor', 'AI tutor')}
                  />
                )}
                <Button
                  size="sm"
                  onClick={() => {
                    setNextPassword('');
                    setOpen(
                      open?.username === user.username && open.action === 'password'
                        ? null
                        : { username: user.username, action: 'password' },
                    );
                  }}
                >
                  <KeyRound size={13} />
                  {t('Nové heslo', 'New password')}
                </Button>
                <IconButton
                  label={t('Smazat účet', 'Remove the account')}
                  onClick={() =>
                    setOpen(
                      open?.username === user.username && open.action === 'remove'
                        ? null
                        : { username: user.username, action: 'remove' },
                    )
                  }
                >
                  <Trash2 size={15} />
                </IconButton>
              </div>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 text-xs text-ink-3">
                <span
                  title={t(
                    'Učitel vidí práci žáka, zadává mu úlohy a nastavuje cíl. Žák to vidí ve svém Nastavení.',
                    'A teacher sees the learner’s work, sets work and sets the goal. The learner sees this in their Settings.',
                  )}
                >
                  {t('Učitelé:', 'Teachers:')}
                </span>
                {[
                  ADMIN_USERNAME,
                  ...users.data.map((other) => other.username).filter((name) => name !== user.username),
                ].map((name) => {
                  const on = user.teachers.includes(name);
                  return (
                    <button
                      key={name}
                      type="button"
                      aria-pressed={on}
                      disabled={busy}
                      onClick={() =>
                        void act(
                          () =>
                            api.put(urlOf(user), {
                              teachers: on ? user.teachers.filter((entry) => entry !== name) : [...user.teachers, name],
                            }),
                          null,
                        )
                      }
                      className={cn(
                        'h-6 rounded-md border px-1.5 font-mono',
                        on
                          ? 'border-accent bg-accent-wash text-ink'
                          : 'border-border bg-surface-1 text-ink-3 hover:bg-surface-2',
                      )}
                    >
                      {name}
                    </button>
                  );
                })}
                {user.teachers.length === 0 && <span>{t('nikdo', 'nobody')}</span>}
              </div>
              {open?.username === user.username && open.action === 'password' && (
                <form
                  className="flex flex-wrap items-end gap-3"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void act(
                      () => api.post(`${urlOf(user)}/password`, { password: nextPassword }),
                      t(
                        `Heslo pro ${user.username} je nastavené; účet je všude odhlášen.`,
                        `The password for ${user.username} is set; the account is signed out everywhere.`,
                      ),
                    );
                  }}
                >
                  <Field label={t(`Nové heslo pro ${user.username}`, `New password for ${user.username}`)}>
                    <TextInput
                      autoFocus
                      value={nextPassword}
                      onChange={(event) => setNextPassword(event.target.value)}
                      className="w-52"
                      autoComplete="off"
                      spellCheck={false}
                    />
                  </Field>
                  <Button type="submit" size="sm" busy={busy} disabled={nextPassword.length < MIN_PASSWORD_LENGTH}>
                    {t('Nastavit', 'Set')}
                  </Button>
                </form>
              )}
              {open?.username === user.username && open.action === 'remove' && (
                <div className="flex flex-wrap items-center gap-3 text-sm">
                  <span className="min-w-0 flex-1 text-ink-2">
                    {t(
                      `Smazat účet ${user.username}? Účet se hned odhlásí a přihlásit se už nepůjde. Data se nemažou: zůstanou na serveru ve složce users/.deleted.`,
                      `Remove the account ${user.username}? It is signed out at once and cannot sign in again. Its data is not erased: it stays on the server in users/.deleted.`,
                    )}
                  </span>
                  <Button
                    size="sm"
                    variant="danger"
                    busy={busy}
                    onClick={() =>
                      void act(
                        () => api.delete(urlOf(user)),
                        t(`Účet ${user.username} je smazaný.`, `The account ${user.username} is removed.`),
                      )
                    }
                  >
                    {t('Smazat', 'Remove')}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setOpen(null)}>
                    {t('Nechat', 'Keep')}
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

function Data({ me }: { me: MeDto }) {
  const t = useT();
  const refresh = useRefresh();
  // With sign-in switched off there is one learner, and that learner runs the instance.
  const admin = me.account?.admin ?? !me.authRequired;
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const run = async (key: string, action: () => Promise<string>): Promise<void> => {
    setBusy(key);
    setMessage(null);
    try {
      setMessage(await action());
    } catch {
      setMessage(t('Nepovedlo se. Podrobnosti jsou v logu serveru.', 'It failed. Details are in the server log.'));
    } finally {
      setBusy(null);
    }
  };
  return (
    <Panel
      title={t('Data', 'Data')}
      lead={
        admin
          ? t(
              'Všechno je v souborech SQLite na tvém serveru: tvoje data v jednom, data každého dalšího uživatele ve vlastním. Záloha se dělá sama jednou denně; návod na obnovu je v README.',
              "Everything lives in SQLite files on your server: your data in one, every other user's in one of their own. A backup is taken automatically once a day; the README explains how to restore.",
            )
          : t(
              'Tvoje data jsou ve vlastním souboru SQLite na serveru, odděleně od ostatních uživatelů. Záloha se dělá sama jednou denně.',
              "Your data lives in a SQLite file of its own on the server, apart from every other user's. A backup is taken automatically once a day.",
            )
      }
    >
      <div className="flex flex-wrap gap-2">
        <a
          href="/api/data/export"
          download
          className="inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-surface-2 px-3.5 text-sm font-medium text-ink hover:bg-surface-3 hover:no-underline"
        >
          <Download size={14} />
          {t('Exportovat vše jako JSON', 'Export everything as JSON')}
        </a>
        {admin && (
          <Button
            busy={busy === 'backup'}
            onClick={() =>
              void run('backup', async () => {
                const backup = await api.post<{ file: string; databases: number }>('/api/admin/backup');
                return backup.databases > 1
                  ? t(
                      `Záloha uložena: ${backup.file} (u každé z ${backup.databases} databází)`,
                      `Backup written: ${backup.file} (beside each of the ${backup.databases} databases)`,
                    )
                  : `${t('Záloha uložena', 'Backup written')}: ${backup.file}`;
              })
            }
          >
            {t('Zálohovat teď', 'Back up now')}
          </Button>
        )}
        <Button
          busy={busy === 'recompute'}
          title={t(
            'Znovu spočítá úrovně z kompletního záznamu úloh. Bezpečné; nic se nemaže.',
            'Recomputes levels from the complete log of problems. Safe; nothing is deleted.',
          )}
          onClick={() =>
            void run('recompute', async () => {
              const result = await api.post<{ skills: number; problems: number }>('/api/data/recompute');
              refresh();
              return t(
                `Přepočítáno z ${result.problems} úloh (${result.skills} dovedností).`,
                `Recomputed from ${result.problems} problems (${result.skills} skills).`,
              );
            })
          }
        >
          {t('Přepočítat úrovně ze záznamu', 'Recompute levels from the log')}
        </Button>
      </div>
      {message && <p className="text-sm text-ink-2">{message}</p>}
      <p className="font-mono text-xs text-ink-3">
        Lemma {me.version} · {t('obsah', 'content')} {me.contentVersion}
      </p>
    </Panel>
  );
}
