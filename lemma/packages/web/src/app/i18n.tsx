import { type L, type Locale, isLocale, pick } from '@lemma/core';
import { type ReactNode, createContext, useContext, useMemo } from 'react';

/**
 * Translation without a key catalogue. With two languages and one author, writing both
 * strings where they are used keeps them complete and in step:
 *
 *   const t = useT();
 *   t('Dnes', 'Today')        // UI text
 *   t(concept.title)          // bilingual content from the server
 */
export interface Translate {
  (cs: string, en: string): string;
  (text: L): string;
  locale: Locale;
}

function makeTranslate(locale: Locale): Translate {
  const translate = ((a: string | L, b?: string): string => {
    if (typeof a === 'string') return locale === 'cs' ? a : (b ?? a);
    return pick(a, locale);
  }) as Translate;
  translate.locale = locale;
  return translate;
}

const I18nContext = createContext<Translate>(makeTranslate('cs'));

export function I18nProvider({ locale, children }: { locale: Locale; children: ReactNode }) {
  const value = useMemo(() => makeTranslate(locale), [locale]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export const useT = (): Translate => useContext(I18nContext);

/** The language to show before the server has told us the learner's choice. */
export function initialLocale(): Locale {
  try {
    const stored = localStorage.getItem('lemma.locale');
    if (isLocale(stored)) return stored;
  } catch {
    // ignore
  }
  return navigator.language.toLowerCase().startsWith('cs') || navigator.language.toLowerCase().startsWith('sk')
    ? 'cs'
    : 'en';
}

export function rememberLocale(locale: Locale): void {
  try {
    localStorage.setItem('lemma.locale', locale);
  } catch {
    // ignore
  }
  document.documentElement.lang = locale;
}
