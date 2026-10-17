import type { ReadinessDto, ReadinessPart } from '@lemma/core';
import { cn } from '../lib/cn';
import { formatDay, inDays, pct, plural } from '../lib/format';
import { Meter } from '../ui';
import { type Translate, useT } from './i18n';

/**
 * The parts of the readiness report, as the home page, the readiness page and the
 * teaching pages all show them: a value with what it rests on, or the plain statement
 * that there is too little to go on.
 */

interface PartText {
  label: string;
  /** What the value is a share of. */
  meaning: string;
  /** What stands behind the value, in the part's own unit. */
  evidence: string;
  /** What is missing when there is no value. */
  missing: string;
}

/** The parts of the report in words: what each measures and what it is based on. */
export function partTexts(readiness: ReadinessDto, t: Translate): Record<string, PartText> {
  const of = (part: ReadinessPart, cs: [string, string, string], en: [string, string]): string =>
    plural(Math.round(part.evidence), t.locale, cs, en);
  const coverageBase = pct(readiness.coverage.value ?? 0, t.locale);
  return {
    coverage: {
      label: t('Pokrytí látky', 'Coverage'),
      meaning: t(
        'podíl zkoušky (podle bodů) na dovednostech aspoň třikrát procvičených',
        'share of the examination (by points) on skills practised at least three times',
      ),
      evidence: t(
        `${of(readiness.coverage, ['dovednost', 'dovednosti', 'dovedností'], ['skill', 'skills'])} s nějakou úlohou`,
        `${of(readiness.coverage, ['dovednost', 'dovednosti', 'dovedností'], ['skill', 'skills'])} with any problem done`,
      ),
      missing: t(
        `zatím ${of(readiness.coverage, ['dovednost', 'dovednosti', 'dovedností'], ['skill', 'skills'])} s úlohou, je potřeba aspoň ${readiness.coverage.needed}`,
        `${of(readiness.coverage, ['dovednost', 'dovednosti', 'dovedností'], ['skill', 'skills'])} with a problem so far; at least ${readiness.coverage.needed} are needed`,
      ),
    },
    familiar: {
      label: t('Aspoň „známé“', 'At least “familiar”'),
      meaning: t(
        'podíl zkoušky na dovednostech, kde typové úlohy řešíš bez pomoci',
        'share of the examination on skills whose standard problems you solve unaided',
      ),
      evidence: t(`při pokrytí ${coverageBase}`, `at a coverage of ${coverageBase}`),
      missing: t(
        `pokryto je ${coverageBase}; dává smysl až od ${pct(readiness.familiar.needed, t.locale)}`,
        `${coverageBase} is covered; it means something from ${pct(readiness.familiar.needed, t.locale)}`,
      ),
    },
    mastery: {
      label: t('Ovládnuto', 'Proficient'),
      meaning: t(
        'podíl zkoušky na dovednostech ověřených ve směsi, po pauze a na těžší úloze',
        'share of the examination on skills proven in a mix, after a gap and on a harder problem',
      ),
      evidence: t(`při pokrytí ${coverageBase}`, `at a coverage of ${coverageBase}`),
      missing: t(
        `pokryto je ${coverageBase}; dává smysl až od ${pct(readiness.mastery.needed, t.locale)}`,
        `${coverageBase} is covered; it means something from ${pct(readiness.mastery.needed, t.locale)}`,
      ),
    },
    retention: {
      label: t('Paměť po čase', 'Retention'),
      meaning: t('podíl naplánovaných opakování, která se povedla', 'share of scheduled reviews that were passed'),
      evidence: of(readiness.retention, ['opakování', 'opakování', 'opakování'], ['review', 'reviews']),
      missing: t(
        `zatím ${of(readiness.retention, ['opakování', 'opakování', 'opakování'], ['review', 'reviews'])}, je potřeba aspoň ${readiness.retention.needed}`,
        `${of(readiness.retention, ['opakování', 'opakování', 'opakování'], ['review', 'reviews'])} so far; at least ${readiness.retention.needed} are needed`,
      ),
    },
    timed: {
      label: t('Test na čas', 'Timed test'),
      meaning: t(
        'podíl bodů z posledního testu nanečisto (z těch, které jdou získat na obrazovce)',
        'share of the points in the last practice test (of those a screen allows)',
      ),
      evidence: of(readiness.timed, ['test', 'testy', 'testů'], ['test', 'tests']),
      missing: t('zatím žádný test nanečisto', 'no practice test yet'),
    },
    unfamiliar: {
      label: t('Těžké a neznámé úlohy', 'Hard and unfamiliar problems'),
      meaning: t(
        'podíl úloh úrovně 4+ a úloh z testů vyřešených napoprvé a bez nápovědy',
        'share of level 4+ and test problems solved at the first try without hints',
      ),
      evidence: of(readiness.unfamiliar, ['úloha', 'úlohy', 'úloh'], ['problem', 'problems']),
      missing: t(
        `zatím ${of(readiness.unfamiliar, ['úloha', 'úlohy', 'úloh'], ['problem', 'problems'])}, je potřeba aspoň ${readiness.unfamiliar.needed}`,
        `${of(readiness.unfamiliar, ['úloha', 'úlohy', 'úloh'], ['problem', 'problems'])} so far; at least ${readiness.unfamiliar.needed} are needed`,
      ),
    },
  };
}

export const PART_KEYS = ['coverage', 'familiar', 'mastery', 'retention', 'timed', 'unfamiliar'] as const;

/** The six parts as rows: a value with its base, or the plain statement that data is missing. */
export function ReadinessParts({ readiness, className }: { readiness: ReadinessDto; className?: string }) {
  const t = useT();
  const texts = partTexts(readiness, t);
  return (
    <ul className={cn('space-y-3', className)}>
      {PART_KEYS.map((key) => {
        const part = readiness[key];
        const text = texts[key]!;
        return (
          <li key={key}>
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span title={text.meaning}>{text.label}</span>
              {part.value === null ? (
                <span className="text-[13px] text-ink-3">{t('málo dat', 'not enough data')}</span>
              ) : (
                <span className="font-medium tabular-nums">{pct(part.value, t.locale)}</span>
              )}
            </div>
            {part.value !== null && <Meter value={part.value} className="mt-1.5" label={text.label} />}
            <div className="mt-1 text-xs text-ink-3">{part.value === null ? text.missing : text.evidence}</div>
          </li>
        );
      })}
    </ul>
  );
}

/** Days to the examination, in words; nothing when no date is set. */
export function examCountdown(readiness: ReadinessDto, t: Translate): string | null {
  if (!readiness.examDay) return null;
  return readiness.daysLeft === null
    ? `${t('Termín zkoušky', 'Examination date')}: ${formatDay(readiness.examDay, t.locale)}`
    : `${t('Zkouška', 'Examination')} ${inDays(readiness.daysLeft, t.locale)} (${formatDay(readiness.examDay, t.locale)})`;
}
