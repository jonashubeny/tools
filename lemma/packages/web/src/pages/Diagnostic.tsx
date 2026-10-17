import type { DiagnosticVerdict } from '@lemma/core';
import { ArrowDown, ArrowLeft, ArrowUp, Minus } from 'lucide-react';
import { Link, useParams } from 'react-router';
import { useT } from '../app/i18n';
import { STAGE_NAMES, VERDICT_NAMES, VERDICT_NOTES, errorName } from '../app/labels';
import { useDiagnostic, useDiagnostics } from '../app/queries';
import { clock, formatDateTime } from '../lib/format';
import { Card, ErrorNote, LinkButton, Loading, Notice, PageHeader, SectionLabel, StatTile, StatusIcon } from '../ui';

/** What a placement test found: skill by skill, with the questions that led there. */

const ORDER: DiagnosticVerdict[] = ['gap', 'shaky', 'sound', 'strong', 'untested'];
const RANK: Record<DiagnosticVerdict, number> = { untested: -1, gap: 0, shaky: 1, sound: 2, strong: 3 };

const TONE: Record<DiagnosticVerdict, 'good' | 'warning' | 'serious' | 'info'> = {
  strong: 'good',
  sound: 'good',
  shaky: 'warning',
  gap: 'serious',
  untested: 'info',
};

export function Diagnostic() {
  const { id } = useParams();
  const t = useT();
  const query = useDiagnostic(id);
  const all = useDiagnostics();
  if (query.isPending) return <Loading />;
  if (query.isError) return <ErrorNote error={query.error} retry={() => void query.refetch()} />;
  const report = query.data;

  if (report.finishedAt === null)
    return (
      <div className="mx-auto max-w-2xl">
        <Notice
          tone="info"
          title={t('Tenhle test ještě není dokončený', 'This test is not finished yet')}
          action={
            <LinkButton to={`/practice/${report.runId}`} size="sm">
              {t('Pokračovat', 'Go on')}
            </LinkButton>
          }
        >
          {t('Co ukázal, bude tady, až skončí.', 'What it found will be here once it is over.')}
        </Notice>
      </div>
    );

  // The test before this one, for seeing what moved.
  const earlier = (all.data ?? [])
    .filter((entry) => entry.finishedAt !== null && entry.finishedAt < report.finishedAt!)
    .sort((a, b) => b.finishedAt! - a.finishedAt!)[0];
  const before = new Map((earlier?.verdicts ?? []).map((entry) => [entry.skill, entry.verdict]));
  const verdicts = [...report.verdicts].sort((a, b) => ORDER.indexOf(a.verdict) - ORDER.indexOf(b.verdict));

  return (
    <div>
      <Link to="/map" className="mb-3 inline-flex items-center gap-1 text-sm text-ink-2">
        <ArrowLeft size={14} aria-hidden />
        {t('Mapa učiva', 'Curriculum map')}
      </Link>
      <PageHeader
        eyebrow={formatDateTime(report.finishedAt, t.locale)}
        title={t('Co ukázal rozřazovací test', 'What the placement test found')}
        lead={t(
          'Test je první odhad, ne známka. Kde úloha nevyšla, ptal se podruhé a lehčeji; teprve dvě nevyřešené úlohy tu znamenají mezeru. Běžné procvičování odhad dál zpřesňuje.',
          'The test is a first estimate, not a mark. Where a problem was missed it asked again, easier; only two missed problems count as a gap here. Ordinary practice refines the estimate further.',
        )}
      />

      <Card className="p-5">
        <div className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
          <StatTile label={t('Úloh', 'Problems')} value={report.counts.asked} />
          <StatTile label={t('Správně', 'Correct')} value={report.counts.correct} />
          <StatTile label={t('„Tohle neumím“', '“I do not know this”')} value={report.counts.skipped} />
          <StatTile
            label={t('Mezery', 'Gaps')}
            value={report.verdicts.filter((entry) => entry.verdict === 'gap').length}
            sub={t('z prověřených dovedností', 'of the skills asked')}
          />
        </div>
      </Card>

      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <Card className="p-5">
          <SectionLabel>{t('Dovednost po dovednosti', 'Skill by skill')}</SectionLabel>
          <ul className="mt-2 divide-y divide-border">
            {verdicts.map((entry) => {
              const items = report.items.filter((item) => item.anchor === entry.skill);
              const previous = before.get(entry.skill);
              const change =
                previous === undefined || previous === 'untested' ? null : RANK[entry.verdict] - RANK[previous];
              return (
                <li key={entry.skill} className="py-3">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <StatusIcon tone={TONE[entry.verdict]} />
                    <Link
                      to={`/concept/${entry.skill}`}
                      className="min-w-0 flex-1 truncate text-sm font-medium text-ink"
                    >
                      {t(entry.title)}
                    </Link>
                    <span className="text-sm">{t(VERDICT_NAMES[entry.verdict])}</span>
                    {change !== null && (
                      <span
                        className="flex items-center gap-1 text-xs text-ink-3"
                        title={`${t('minule', 'last time')}: ${t(VERDICT_NAMES[previous!])}`}
                      >
                        {change > 0 ? (
                          <ArrowUp size={12} style={{ color: 'var(--good)' }} aria-hidden />
                        ) : change < 0 ? (
                          <ArrowDown size={12} aria-hidden />
                        ) : (
                          <Minus size={12} aria-hidden />
                        )}
                        {change > 0
                          ? t('lepší než minule', 'better than last time')
                          : change < 0
                            ? t('slabší než minule', 'weaker than last time')
                            : t('stejně jako minule', 'as last time')}
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 pl-7 text-[13px] text-ink-3">{t(VERDICT_NOTES[entry.verdict])}</div>
                  <ul className="mt-1.5 space-y-0.5 pl-7 text-[13px] text-ink-2">
                    {items.map((item) => (
                      <li key={item.problemId} className="flex flex-wrap items-center gap-x-3">
                        <span className="w-24 shrink-0 text-ink-3">{t(STAGE_NAMES[item.stage])}</span>
                        <span className="min-w-0 flex-1 truncate">
                          {item.skill === entry.skill ? '' : `${t(item.title)} · `}
                          {t('úroveň', 'level')} {item.level}
                        </span>
                        <span>
                          {item.outcome === 'correct'
                            ? t('správně', 'correct')
                            : item.outcome === 'skipped'
                              ? t('„neumím“', '“do not know”')
                              : t('špatně', 'wrong')}
                          {item.error && ` (${t(errorName(item.error)).toLowerCase()})`}
                        </span>
                        <span className="w-10 shrink-0 text-right font-mono text-xs text-ink-3">
                          {clock(item.seconds)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </li>
              );
            })}
          </ul>
        </Card>

        <div className="min-w-0 space-y-5">
          <Card className="p-5">
            <SectionLabel>{t('Na co se test neptal', 'What the test did not ask')}</SectionLabel>
            <p className="mt-2 text-[13px] text-ink-2">
              {t(
                'Test se nemůže zeptat na všechno. U sousedních dovedností proto vychází z toho, co na nich stojí nebo na čem stojí — opatrně, a jen dokud nemají vlastní úlohy.',
                'The test cannot ask everything. For neighbouring skills it goes by what stands on them, or what they stand on — cautiously, and only until they have problems of their own.',
              )}
            </p>
            {report.presumed.length === 0 ? (
              <p className="mt-2 text-sm text-ink-3">
                {t('Žádné předpoklady o dalších dovednostech.', 'No presumptions about other skills.')}
              </p>
            ) : (
              <>
                {(['up', 'down'] as const).map((direction) => {
                  const list = report.presumed.filter((entry) => entry.direction === direction);
                  if (list.length === 0) return null;
                  return (
                    <div key={direction} className="mt-3">
                      <div className="text-xs text-ink-3">
                        {direction === 'up'
                          ? t(
                              'Nejspíš v pořádku (stojí na nich něco, co vyšlo)',
                              'Probably fine (something built on them was solved)',
                            )
                          : t(
                              'Nejspíš bude potřeba začít od základu (stojí na něčem, co nevyšlo)',
                              'Probably to be started from the basics (built on something that was missed)',
                            )}
                      </div>
                      <p className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-sm">
                        {list.map((entry) => (
                          <Link key={entry.id} to={`/concept/${entry.id}`} className="text-ink-2">
                            {t(entry.title)}
                          </Link>
                        ))}
                      </p>
                    </div>
                  );
                })}
              </>
            )}
          </Card>

          <Card className="p-5">
            <SectionLabel>{t('Co z toho plyne', 'What follows')}</SectionLabel>
            <p className="mt-2 text-sm text-ink-2">
              {t(
                'Plán teď začíná u mezer, které něco blokují, a u toho, co má ve zkoušce největší váhu. Kde to šlo, začínají úlohy výš než od úplného začátku.',
                'The plan now starts with the gaps that hold something up, and with what weighs most in the examination. Where things went well, problems start above the very beginning.',
              )}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <LinkButton to="/" variant="primary">
                {t('Na dnešní plán', 'To today’s plan')}
              </LinkButton>
              <LinkButton to="/map">{t('Mapa učiva', 'Curriculum map')}</LinkButton>
            </div>
            {earlier && (
              <p className="mt-3 text-xs text-ink-3">
                {t('Porovnáno s testem z', 'Compared with the test of')}{' '}
                <Link to={`/diagnostic/${earlier.id}`}>{formatDateTime(earlier.finishedAt!, t.locale)}</Link>.
              </p>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
