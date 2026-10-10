import { L } from '../i18n';

/**
 * Error taxonomy. Three families, because the remedy differs: a slip needs checking
 * habits, a procedural error needs the rule revisited, a conceptual gap needs the idea
 * rebuilt. See docs/learning-model.md §6.
 */
export const ERROR_TYPES = [
  'sign',
  'arithmetic',
  'copy',
  'misread',
  'notation',
  'rushed',
  'algebra',
  'formula',
  'domain',
  'incomplete',
  'graph',
  'concept',
  'strategy',
  'unknown',
] as const;

export type ErrorType = (typeof ERROR_TYPES)[number];
export type ErrorFamily = 'slip' | 'procedure' | 'concept';

export const ERROR_FAMILY: Readonly<Record<ErrorType, ErrorFamily>> = {
  sign: 'slip',
  arithmetic: 'slip',
  copy: 'slip',
  misread: 'slip',
  notation: 'slip',
  rushed: 'slip',
  algebra: 'procedure',
  formula: 'procedure',
  domain: 'procedure',
  incomplete: 'procedure',
  graph: 'procedure',
  concept: 'concept',
  strategy: 'concept',
  unknown: 'concept',
};

export const ERROR_FAMILIES: readonly ErrorFamily[] = ['slip', 'procedure', 'concept'];

export function isErrorType(value: unknown): value is ErrorType {
  return typeof value === 'string' && (ERROR_TYPES as readonly string[]).includes(value);
}

interface ErrorInfo {
  title: L;
  /** What it looks like. */
  description: L;
  /** One concrete habit that prevents it. */
  remedy: L;
}

export const ERROR_INFO: Readonly<Record<ErrorType, ErrorInfo>> = {
  sign: {
    title: L('Znaménko', 'Sign'),
    description: L(
      'Ztracené nebo otočené znaménko, obrácená nerovnost.',
      'A lost or flipped sign, or a reversed inequality.',
    ),
    remedy: L(
      'Záporná čísla dosazuj vždy v závorce a po každém řádku zkontroluj jen znaménka.',
      'Always substitute negative numbers in brackets, and re-read each line for signs only.',
    ),
  },
  arithmetic: {
    title: L('Numerická chyba', 'Arithmetic'),
    description: L(
      'Přepočítání: špatně sečteno, vynásobeno, zkráceno.',
      'A calculation slip: adding, multiplying, cancelling.',
    ),
    remedy: L(
      'Před výpočtem si odhadni výsledek. Když nesedí řád nebo znaménko, počítej znovu.',
      'Estimate before you compute. If the size or sign is off, redo it.',
    ),
  },
  copy: {
    title: L('Opsání', 'Copying'),
    description: L(
      'Špatně opsané zadání nebo vlastní předchozí řádek.',
      'Miscopied the problem or your own previous line.',
    ),
    remedy: L(
      'Po opsání zadání ho porovnej s originálem znak po znaku.',
      'After copying the problem, compare it with the original character by character.',
    ),
  },
  misread: {
    title: L('Jiná otázka', 'Misread the question'),
    description: L(
      'Správný výpočet, ale odpověď na něco jiného, než se ptali.',
      'Correct work, but it answers something other than what was asked.',
    ),
    remedy: L(
      'Než odpověď odešleš, přečti si znovu poslední větu zadání.',
      'Before submitting, re-read the last sentence of the problem.',
    ),
  },
  notation: {
    title: L('Zápis', 'Notation'),
    description: L(
      'Správná myšlenka ve špatném tvaru: závorka intervalu, jednotka, zaokrouhlení.',
      'Right idea, wrong form: interval bracket, unit, rounding.',
    ),
    remedy: L(
      'U intervalů si u každého krajního bodu polož otázku: patří tam, nebo ne?',
      'For every interval endpoint ask: is it included or not?',
    ),
  },
  rushed: {
    title: L('Spěch', 'Rushed'),
    description: L(
      'Chyba z časového tlaku nebo příliš rychlé odpovědi.',
      'An error made under time pressure or by answering too fast.',
    ),
    remedy: L(
      'Rychlost přijde s jistotou. Nejdřív přesně, potom rychle.',
      'Speed follows accuracy. First be right, then be fast.',
    ),
  },
  algebra: {
    title: L('Úprava výrazu', 'Algebraic manipulation'),
    description: L(
      'Neplatná úprava: roznásobení, krácení, práce se zlomky, mocninami.',
      'An invalid step: expanding, cancelling, fractions, powers.',
    ),
    remedy: L(
      'U každé úpravy řekni, jaké pravidlo používáš. Když ho neumíš pojmenovat, zkontroluj ho na číslech.',
      'Name the rule behind each step. If you cannot, test the step with numbers.',
    ),
  },
  formula: {
    title: L('Vzorec', 'Formula'),
    description: L(
      'Špatný vzorec, nebo správný vzorec špatně použitý.',
      'The wrong formula, or the right one misapplied.',
    ),
    remedy: L(
      'Vzorec si napiš obecně, pod něj dosazené hodnoty. Teprve pak počítej.',
      'Write the formula in general form, then the substituted values beneath it. Only then compute.',
    ),
  },
  domain: {
    title: L('Podmínky', 'Conditions'),
    description: L(
      'Zapomenutá podmínka nebo definiční obor; ponechaný kořen, který nevyhovuje.',
      'A forgotten condition or domain; an extraneous root kept.',
    ),
    remedy: L(
      'Podmínky si napiš hned na začátku a na konci jimi každý kořen prožeň.',
      'Write the conditions first, and at the end test every root against them.',
    ),
  },
  incomplete: {
    title: L('Neúplné řešení', 'Incomplete'),
    description: L(
      'Chybí druhé řešení, případ nebo část odpovědi.',
      'A second solution, a case, or part of the answer is missing.',
    ),
    remedy: L(
      'Zeptej se: může existovat další řešení? (± u odmocniny, druhá větev absolutní hodnoty, perioda)',
      'Ask: can there be another solution? (± of a root, the other absolute-value branch, a period)',
    ),
  },
  graph: {
    title: L('Čtení grafu', 'Graph reading'),
    description: L('Špatně odečtená hodnota, osa nebo měřítko.', 'A misread value, axis or scale.'),
    remedy: L(
      'Nejdřív si přečti popisky os a měřítko, až potom odečítej.',
      'Read the axis labels and scale first, then read values.',
    ),
  },
  concept: {
    title: L('Nepochopený pojem', 'Misunderstood concept'),
    description: L(
      'Myšlenka sama je pochopená jinak, než jak funguje.',
      'The idea itself is understood differently from how it works.',
    ),
    remedy: L(
      'Vrať se k „Proč?“ u daného pojmu a zkus ho vysvětlit vlastními slovy.',
      'Go back to the concept’s “Why?” and try to explain it in your own words.',
    ),
  },
  strategy: {
    title: L('Špatný postup', 'Wrong strategy'),
    description: L(
      'Zvolená metoda k výsledku nevede nebo je zbytečně složitá.',
      'The chosen method does not lead there, or is needlessly hard.',
    ),
    remedy: L(
      'Než začneš počítat, řekni si jednou větou, jaký máš plán.',
      'Before computing, state your plan in one sentence.',
    ),
  },
  unknown: {
    title: L('Nevím, jak na to', 'Did not know how'),
    description: L('Nebylo jasné, jak úlohu začít.', 'It was not clear how to start.'),
    remedy: L(
      'To není chyba, ale informace. Projdi si lekci k pojmu a zkus řešený příklad.',
      'That is information, not a mistake. Open the lesson and study a worked example.',
    ),
  },
};
