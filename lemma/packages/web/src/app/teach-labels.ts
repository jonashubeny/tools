import {
  type AttentionDto,
  type InterventionDto,
  type SessionOutcome,
  type TeachBriefDto,
  type WeekFiguresDto,
  ERROR_INFO,
  L,
} from '@lemma/core';
import { pct, plural } from '../lib/format';
import type { Translate } from './i18n';

/** Wording for the teaching pages: each flag and suggestion says what it rests on. */

export function attentionText(flag: AttentionDto, t: Translate): string {
  const skill = flag.skill ? t(flag.skill.title) : '';
  const error = flag.error ? t(ERROR_INFO[flag.error].title).toLowerCase() : '';
  switch (flag.kind) {
    case 'no-diagnostic':
      return t('Rozřazovací test ještě neproběhl.', 'The placement test has not been taken yet.');
    case 'inactive':
      return t(`Bez úlohy už ${flag.count} dní.`, `No problem for ${flag.count} days.`);
    case 'review-failed':
      return t(`${skill}: poslední opakování se nepovedlo.`, `${skill}: the last review was not passed.`);
    case 'recurring-error':
      return t(
        `Opakuje se chyba „${error}“ (${flag.count}× mezi posledními chybami).`,
        `The error “${error}” keeps coming back (${flag.count} times among recent errors).`,
      );
    case 'misconception':
      return t(
        `${skill}: stejná mylná představa ${flag.count}× (${error}).`,
        `${skill}: the same misconception ${flag.count} times (${error}).`,
      );
    case 'stuck':
      return t(
        `${skill}: ${flag.count} úloh a pořád pod úrovní „známá“.`,
        `${skill}: ${flag.count} problems and still below “familiar”.`,
      );
    case 'neglected':
      return flag.count > 0
        ? t(`${skill}: ${flag.count} dní bez procvičení.`, `${skill}: ${flag.count} days without practice.`)
        : t(
            `${skill}: zatím nedotčeno, a ve zkoušce to váhu má.`,
            `${skill}: untouched so far, and it carries weight in the examination.`,
          );
    case 'overdue-assignment':
      return t(`Zadaná práce je ${flag.count} dní po termínu.`, `Assigned work is ${flag.count} days overdue.`);
    case 'guessing':
      return t(
        `${flag.count} špatných odpovědí za zlomek obvyklého času (dva týdny): vypadá to na tipování.`,
        `${flag.count} wrong answers in a fraction of the usual time (two weeks): it looks like guessing.`,
      );
    case 'hint-reliance':
      return t(
        `Nápověda u ${flag.count} úloh za dva týdny — víc než u poloviny.`,
        `Hints on ${flag.count} problems in two weeks — more than half of them.`,
      );
  }
}

/** The suggested next step for the teacher, with the rule behind it. */
export function interventionText(step: InterventionDto, t: Translate): { title: string; why: string } {
  const skill = step.skill ? t(step.skill.title) : '';
  const error = step.error ? t(ERROR_INFO[step.error].title).toLowerCase() : '';
  switch (step.kind) {
    case 'run-diagnostic':
      return {
        title: t('Nechat udělat rozřazovací test', 'Have the placement test taken'),
        why: t(
          'Bez něj všechno začíná od základů a o žákovi se zatím nic neví.',
          'Without it everything starts from the basics, and nothing is known about the learner yet.',
        ),
      };
    case 'check-in':
      return {
        title: t('Ozvat se', 'Get in touch'),
        why: t('Delší dobu žádná aktivita.', 'No activity for a longer time.'),
      };
    case 'explain':
      return step.reason === 'misconception'
        ? {
            title: t(`Vysvětlit: ${skill}`, `Explain: ${skill}`),
            why: t(
              `Vrací se tu stejná mylná představa (${error}). To procvičování samo nespraví.`,
              `The same misconception keeps returning here (${error}). Practice alone will not fix that.`,
            ),
          }
        : {
            title: t(`Probrat chybu: ${error}`, `Talk through the error: ${error}`),
            why: t(
              'Tenhle druh chyby se opakuje napříč tématy; pomáhá návyk kontroly.',
              'This kind of error recurs across topics; a checking habit helps.',
            ),
          };
    case 'assign-remediation':
      return {
        title: t(`Zadat doplnění základu: ${skill}`, `Assign catching up: ${skill}`),
        why:
          step.reason === 'review-failed'
            ? t('Poslední opakování se nepovedlo.', 'The last review was not passed.')
            : t('Hodně úloh a úroveň se nehýbe.', 'Many problems, and the level is not moving.'),
      };
    case 'assign-review':
      return {
        title: t('Zadat opakování', 'Assign a review'),
        why: t(
          'Nahromadilo se víc dovedností, které jsou na řadě k opakování.',
          'Several skills have come due for review.',
        ),
      };
    case 'timed-test':
      return {
        title: t('Zadat test nanečisto', 'Assign a timed practice test'),
        why: t(
          'Většina látky je procvičená a poslední test je starší dvou týdnů, nebo žádný nebyl.',
          'Most of the material has been practised, and the last test is over two weeks old or there was none.',
        ),
      };
    case 'keep-going':
      return step.skill
        ? {
            title: t(`Nic naléhavého. Na řadě je: ${skill}`, `Nothing urgent. Next in line: ${skill}`),
            why: t('Výběr úloh to zvládá bez zásahu.', 'The selection is handling it without intervention.'),
          }
        : {
            title: t('Zatím není z čeho vycházet', 'Nothing to go on yet'),
            why: t('Až budou první úlohy, bude tu víc.', 'There will be more here after the first problems.'),
          };
  }
}

export const OUTCOME_NAMES: Record<SessionOutcome, L> = {
  independent: L('samostatně', 'independently'),
  helped: L('s pomocí', 'with help'),
  'not-yet': L('zatím ne', 'not yet'),
};

export const STEP_NAMES: Record<TeachBriefDto['sequence'][number]['kind'], L> = {
  'warm-up': L('Rozjezd', 'Warm-up'),
  explain: L('Vysvětlit', 'Explain'),
  practise: L('Procvičit spolu', 'Practise together'),
  check: L('Ověřit z minula', 'Check from last time'),
  homework: L('Domácí práce', 'Homework'),
};

const STEP_REASONS: Record<string, L> = {
  'start-with-success': L('Začít něčím, co jde.', 'Start with something that goes well.'),
  'check-last-time': L(
    'Minule to bylo těžké: nejdřív ověřit, jestli to drží.',
    'It was hard last time: first check whether it holds.',
  ),
  misconception: L('Vrací se tu stejná mylná představa.', 'The same misconception keeps coming back here.'),
  'blocks-others': L('Mezera, na které stojí další látka.', 'A gap that further material stands on.'),
  'biggest-gap': L('Největší mezera podle váhy ve zkoušce.', 'The biggest gap by weight in the examination.'),
  'next-step': L('Další krok podle výběru úloh.', 'The next step by the selection.'),
  'practise-together': L('Hned po výkladu, dokud je to čerstvé.', 'Straight after the explanation, while it is fresh.'),
  'recurring-error': L(
    'Opakující se chyba z nepozornosti: probrat návyk kontroly.',
    'A recurring slip: talk through a checking habit.',
  ),
  homework: L('Co by přišlo na řadu samo; hodí se jako úkol.', 'What would come next anyway; it suits as homework.'),
};

export const stepReason = (reason: string, t: Translate): string =>
  STEP_REASONS[reason] ? t(STEP_REASONS[reason]) : reason;

/** A week's work in a line. Time is the sum of time on problems: a floor, not a measure. */
export function weekLine(week: WeekFiguresDto, t: Translate): string {
  if (week.problems === 0) return t('žádné úlohy', 'no problems');
  return [
    plural(week.problems, t.locale, ['úloha', 'úlohy', 'úloh'], ['problem', 'problems']),
    `${pct(week.firstTry / week.problems, t.locale)} ${t('napoprvé', 'first try')}`,
    plural(week.activeDays, t.locale, ['den', 'dny', 'dní'], ['day', 'days']),
    `≥ ${week.minutes} min`,
  ].join(' · ');
}

/** What to call a learner: the name they gave, or the account's. */
export const displayName = (student: { username: string; name: string }): string => student.name || student.username;
