import type { FitDto, RoadmapStageDto, SkillDto } from '@lemma/core';
import { ExternalLink, FileCheck2, Lightbulb } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { SkillRow } from '../app/components';
import { useT } from '../app/i18n';
import { useFit } from '../app/queries';
import { cn } from '../lib/cn';
import { formatDay, pct } from '../lib/format';
import { RichText } from '../lib/Math';
import { Badge, Card, ErrorNote, Loading, Meter, Notice, PageHeader } from '../ui';

/**
 * The road to FIT VUT. Two things are kept visibly apart on this page: what the faculty
 * has officially published (dated, with the source next to each statement) and what
 * Lemma recommends on top of it.
 */
export function Fit() {
  const t = useT();
  const fit = useFit();
  if (fit.isPending) return <Loading />;
  if (fit.isError) return <ErrorNote error={fit.error} retry={() => void fit.refetch()} />;
  const { snapshot, timeline, stages, history } = fit.data;
  const sourceTitle = (url: string): string => snapshot.sources.find((source) => source.url === url)?.title ?? url;

  return (
    <div>
      <PageHeader
        title={t('Cesta k FIT VUT', 'The road to FIT VUT')}
        lead={t(
          'Co fakulta oficiálně zveřejnila — a zvlášť, co k tomu doporučuje Lemma. Pravidla přijímání se mění každý rok; ta, která tu vidíš, platí pro jiný ročník než tvůj.',
          'What the faculty has officially published — and, separately, what Lemma recommends on top. Admission rules change every year; the ones shown here apply to a different intake than yours.',
        )}
      />

      {snapshot.stale && (
        <Notice
          tone="warning"
          className="mb-5"
          title={t('Tyhle údaje je potřeba ověřit', 'This data needs re-checking')}
        >
          {t(
            `Naposledy načteno ${formatDay(snapshot.retrievedOn, 'cs')}. Od té doby mohla fakulta pravidla změnit — podívej se na zdroje níž. Postup aktualizace je v docs/updating-fit-data.md.`,
            `Last retrieved ${formatDay(snapshot.retrievedOn, 'en')}. The faculty may have changed the rules since — check the sources below. The update procedure is in docs/updating-fit-data.md.`,
          )}
        </Notice>
      )}

      <Card className="mb-5 p-5">
        <div className="mono-label">{t('Časová osa', 'Timeline')}</div>
        <div className="mt-2 grid gap-4 sm:grid-cols-3">
          <div>
            <div className="text-xs text-ink-3">{t('Teď', 'Now')}</div>
            <div className="font-medium">
              {t(`2. ročník SŠ, ${timeline.secondYear}`, `Year 2 of secondary school, ${timeline.secondYear}`)}
            </div>
          </div>
          <div>
            <div className="text-xs text-ink-3">{t('Pravidla, která tu jsou', 'The rules shown here')}</div>
            <div className="font-medium">
              {t(`přijímání pro ${snapshot.admissionFor}`, `admission for ${snapshot.admissionFor}`)}
            </div>
          </div>
          <div>
            <div className="text-xs text-ink-3">{t('Tvůj předpokládaný nástup', 'Your expected start')}</div>
            <div className="font-medium">{timeline.expectedStart}</div>
          </div>
        </div>
        <ul className="mt-4 space-y-1.5 border-t border-border pt-3 text-sm text-ink-2">
          {timeline.caveats.map((caveat, index) => (
            <li key={index} className="flex gap-2">
              <span className="text-ink-3" aria-hidden>
                —
              </span>
              <span>{t(caveat)}</span>
            </li>
          ))}
        </ul>
      </Card>

      <Section
        kind="official"
        title={t('Oficiální údaje', 'Official information')}
        note={t(
          `Stav k ${formatDay(snapshot.retrievedOn, 'cs')} · přijímání ${snapshot.admissionFor} · studijní plán ${snapshot.studyPlanFor}`,
          `As of ${formatDay(snapshot.retrievedOn, 'en')} · admission ${snapshot.admissionFor} · study plan ${snapshot.studyPlanFor}`,
        )}
      >
        <div className="grid gap-5 lg:grid-cols-2">
          <Card className="p-5">
            <h3 className="font-semibold">{t('Program', 'The programme')}</h3>
            <Facts facts={snapshot.programmeFacts} sourceTitle={sourceTitle} />
          </Card>
          <Card className="p-5">
            <h3 className="font-semibold">{t('Přijímací řízení', 'Admission')}</h3>
            <Facts facts={snapshot.admissionFacts} sourceTitle={sourceTitle} />
          </Card>
        </div>

        <Card className="mt-5 p-5">
          <h3 className="font-semibold">{t('Cesty k přijetí', 'Routes to admission')}</h3>
          <p className="mt-1 text-[13px] text-ink-3">
            {t(
              'Text u každé cesty je z oficiální směrnice. Odhad, jak je pro tebe reálná, a poznámka pod ním jsou od Lemmy — fakulta nic takového neříká.',
              'The text of each route comes from the official directive. The estimate of how realistic it is for you, and the note under it, are Lemma’s — the faculty says nothing of the kind.',
            )}
          </p>
          <ul className="mt-3 divide-y divide-border">
            {[...snapshot.routes]
              .sort(
                (a, b) =>
                  ['primary', 'possible', 'unlikely'].indexOf(a.relevance) -
                  ['primary', 'possible', 'unlikely'].indexOf(b.relevance),
              )
              .map((route) => (
                <li key={route.id} className="py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    {route.letter && <span className="font-mono text-xs text-ink-3">{route.letter})</span>}
                    <span className="text-sm font-medium">{t(route.title)}</span>
                    <Badge
                      tone={route.relevance === 'primary' ? 'accent' : 'outline'}
                      title={t('Odhad Lemmy, ne fakulty', 'Lemma’s estimate, not the faculty’s')}
                    >
                      {route.relevance === 'primary'
                        ? t('hlavní cesta', 'main route')
                        : route.relevance === 'possible'
                          ? t('možná', 'possible')
                          : t('spíš ne', 'unlikely')}
                    </Badge>
                  </div>
                  <p className="mt-1 text-sm text-ink-2">{t(route.detail)}</p>
                  {route.note && (
                    <p className="mt-1.5 flex gap-1.5 text-[13px] text-ink-3">
                      <Lightbulb size={13} className="mt-0.5 shrink-0" aria-hidden />
                      <span>
                        <span className="font-medium">{t('Lemma: ', 'Lemma: ')}</span>
                        {t(route.note)}
                      </span>
                    </p>
                  )}
                </li>
              ))}
          </ul>
        </Card>

        <Card className="mt-5 p-5">
          <h3 className="font-semibold">{t(snapshot.bridge.title)}</h3>
          <p className="mt-1 text-[13px] text-ink-3">
            {t(
              'Fakulta tímhle volitelným seminářem sama říká, jakou středoškolskou matematiku čeká. Vpravo je, jak na tom jsi.',
              'With this optional seminar the faculty itself says what school mathematics it expects. On the right is where you stand.',
            )}{' '}
            <SourceLink url={snapshot.bridge.source} title={sourceTitle(snapshot.bridge.source)} />
          </p>
          <ul className="mt-3 divide-y divide-border">
            {snapshot.bridge.items.map((item, index) => (
              <li
                key={index}
                className="grid gap-x-4 gap-y-1.5 py-2.5 sm:grid-cols-[minmax(0,1fr)_220px] sm:items-center"
              >
                <div className="min-w-0">
                  <div className="text-sm">{t(item.text)}</div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-ink-3">
                    {item.onSyllabus ? (
                      <Badge tone="accent">{t('letos ve škole', 'at school this year')}</Badge>
                    ) : (
                      <Badge tone="outline">{t('mimo letošní osnovy', 'not on this year’s syllabus')}</Badge>
                    )}
                    {item.skills.slice(0, 4).map((skill) => (
                      <Link key={skill.id} to={`/concept/${skill.id}`} className="text-ink-3">
                        {t(skill.title)}
                      </Link>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {item.progress === null ? (
                    <span className="text-xs text-ink-3">{t('v Lemmě zatím chybí', 'not in Lemma yet')}</span>
                  ) : (
                    <>
                      <Meter value={item.progress} label={t('Postup', 'Progress')} />
                      <span className="w-10 shrink-0 text-right font-mono text-xs text-ink-2">
                        {pct(item.progress, t.locale)}
                      </span>
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </Card>

        <Card className="mt-5 p-5">
          <h3 className="font-semibold">{t('Předměty prvních semestrů', 'Courses of the first semesters')}</h3>
          <p className="mt-1 text-[13px] text-ink-3">
            {t(
              `Podle studijního plánu ${snapshot.studyPlanFor}. „Uvedený předpoklad“ je doslovně z karty předmětu.`,
              `From the ${snapshot.studyPlanFor} study plan. “Stated prerequisite” is quoted from the course card.`,
            )}
          </p>
          <div className="mt-3 space-y-2">
            {snapshot.courses.map((course) => (
              <details
                key={course.code}
                className="group rounded-lg border border-border bg-surface-2 open:bg-surface-1"
              >
                <summary className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3.5 py-2.5">
                  <span className="w-12 shrink-0 font-mono text-sm font-medium">{course.code}</span>
                  <span className="min-w-0 flex-1 text-sm">{t(course.name)}</span>
                  <Badge>
                    {course.year}. {t('roč.', 'yr')} ·{' '}
                    {course.semester === 'winter' ? t('zimní', 'winter') : t('letní', 'summer')}
                  </Badge>
                  <Badge>
                    {course.credits} {t('kr.', 'cr.')}
                  </Badge>
                  {!course.compulsory && <Badge tone="outline">{t('volitelný', 'optional')}</Badge>}
                  {course.progress !== null && (
                    <span className="w-10 text-right font-mono text-xs text-ink-2">
                      {pct(course.progress, t.locale)}
                    </span>
                  )}
                </summary>
                <div className="space-y-2.5 border-t border-border px-3.5 py-3 text-sm">
                  <p className="text-ink-2">{t(course.covers)}</p>
                  <p>
                    <span className="text-ink-3">{t('Uvedený předpoklad: ', 'Stated prerequisite: ')}</span>
                    <span className="text-ink-2">„{t(course.statedPrerequisite)}“</span>{' '}
                    <SourceLink url={course.url} title={`${course.code} — ${t('karta předmětu', 'course card')}`} />
                  </p>
                  {course.prepNote && (
                    <p className="flex gap-1.5 text-[13px] text-ink-3">
                      <Lightbulb size={13} className="mt-0.5 shrink-0" aria-hidden />
                      <span>
                        <span className="font-medium">{t('Lemma: ', 'Lemma: ')}</span>
                        {t(course.prepNote)}
                      </span>
                    </p>
                  )}
                  {course.skills.length > 0 && (
                    <div>
                      <div className="text-xs text-ink-3">
                        {t(
                          'Dovednosti v Lemmě, na kterých předmět staví (výběr Lemmy)',
                          'Skills in Lemma the course builds on (Lemma’s selection)',
                        )}
                      </div>
                      <div className="-mx-2 mt-1 grid sm:grid-cols-2">
                        {course.skills.map((skill) => (
                          <SkillRow key={skill.id} skill={skill} />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </details>
            ))}
          </div>
        </Card>

        <Card className="mt-5 p-5">
          <h3 className="font-semibold">{t('Zdroje', 'Sources')}</h3>
          <ul className="mt-2 space-y-1.5 text-sm">
            {snapshot.sources.map((source) => (
              <li key={source.url}>
                <a
                  href={source.url}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="inline-flex items-center gap-1"
                >
                  {source.title}
                  <ExternalLink size={11} aria-hidden />
                </a>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-ink-3">
            {t(
              `Načteno ${formatDay(snapshot.retrievedOn, 'cs')}. Lemma upozorní na ověření po ${formatDay(snapshot.reviewAfter, 'cs')}.`,
              `Retrieved ${formatDay(snapshot.retrievedOn, 'en')}. Lemma will ask for re-verification after ${formatDay(snapshot.reviewAfter, 'en')}.`,
            )}
            {history.length > 1 &&
              ` ${t('Uložené starší verze', 'Earlier stored versions')}: ${history
                .slice(1)
                .map((item) => item.admissionFor)
                .join(', ')}.`}
          </p>
        </Card>
      </Section>

      <Section
        kind="lemma"
        title={t('Dlouhodobá příprava', 'Long-term preparation')}
        note={t(
          'Doporučení Lemmy. Žádná z těchto etap není požadavek fakulty, pokud to u ní není výslovně uvedeno.',
          'Lemma’s recommendation. None of these stages is a faculty requirement unless it says so explicitly.',
        )}
      >
        <div className="space-y-5">
          {stages.map((stage) => (
            <Stage key={stage.id} stage={stage} />
          ))}
        </div>
      </Section>
    </div>
  );
}

function Section({
  kind,
  title,
  note,
  children,
}: {
  kind: 'official' | 'lemma';
  title: string;
  note: string;
  children: ReactNode;
}) {
  return (
    <section className="mt-8 first:mt-0">
      <div
        className={cn(
          'mb-4 flex items-start gap-3 border-l-2 pl-3',
          kind === 'official' ? 'border-accent' : 'border-border-strong',
        )}
      >
        <div className="mt-0.5 text-ink-3">
          {kind === 'official' ? <FileCheck2 size={18} aria-hidden /> : <Lightbulb size={18} aria-hidden />}
        </div>
        <div>
          <h2 className="text-lg font-semibold">{title}</h2>
          <p className="text-[13px] text-ink-2">{note}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

/** The source of one statement, right next to it. */
function SourceLink({ url, title }: { url: string; title: string }) {
  const t = useT();
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer noopener"
      title={title}
      className="inline-flex items-center gap-0.5 align-baseline text-xs whitespace-nowrap"
    >
      {t('zdroj', 'source')}
      <ExternalLink size={10} aria-hidden />
      <span className="sr-only">: {title}</span>
    </a>
  );
}

function Facts({
  facts,
  sourceTitle,
}: {
  facts: FitDto['snapshot']['programmeFacts'];
  sourceTitle: (url: string) => string;
}) {
  const t = useT();
  return (
    <ul className="mt-2 space-y-2">
      {facts.map((fact, index) => (
        <li key={index} className="text-sm text-ink-2">
          <RichText text={t(fact.text)} inlineOnly /> <SourceLink url={fact.source} title={sourceTitle(fact.source)} />
        </li>
      ))}
    </ul>
  );
}

const BASIS: Record<RoadmapStageDto['basis'], [string, string]> = {
  'school-syllabus': ['podle školních osnov', 'from the school syllabus'],
  'official-fit': ['podle oficiálních materiálů FIT', 'from official FIT material'],
  'lemma-recommendation': ['doporučení Lemmy', 'Lemma’s recommendation'],
};

function Stage({ stage }: { stage: RoadmapStageDto }) {
  const t = useT();
  const basis = BASIS[stage.basis];
  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-semibold">{t(stage.title)}</h3>
          <Badge tone={stage.basis === 'lemma-recommendation' ? 'outline' : 'accent'}>{t(basis[0], basis[1])}</Badge>
        </div>
        <div className="flex w-44 items-center gap-2">
          <Meter value={stage.progress} label={t('Postup etapou', 'Stage progress')} />
          <span className="w-10 shrink-0 text-right font-mono text-xs text-ink-2">{pct(stage.progress, t.locale)}</span>
        </div>
      </div>
      <p className="mt-1.5 text-sm text-ink-2">{t(stage.description)}</p>
      <div className="mt-4 grid gap-x-6 gap-y-4 md:grid-cols-2">
        {stage.groups.map((group, index) => (
          <Group key={index} title={t(group.title)} note={group.note ? t(group.note) : null} skills={group.skills} />
        ))}
      </div>
    </Card>
  );
}

function Group({ title, note, skills }: { title: string; note: string | null; skills: SkillDto[] }) {
  return (
    <div className="min-w-0">
      <div className="text-sm font-medium">{title}</div>
      {note && <div className="mt-0.5 text-xs text-ink-3">{note}</div>}
      <div className="-mx-2 mt-1">
        {skills.map((skill) => (
          <SkillRow key={skill.id} skill={skill} />
        ))}
      </div>
    </div>
  );
}
