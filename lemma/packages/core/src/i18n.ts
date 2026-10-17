/** Supported languages. Czech is what school and FIT use; English is the tech world's. */
export type Locale = 'cs' | 'en';

export const LOCALES: readonly Locale[] = ['cs', 'en'];

/** A text in every supported language. Content must always provide both. */
export interface L {
  cs: string;
  en: string;
}

/** Shorthand for authoring bilingual text: `L('česky', 'in English')`. */
export function L(cs: string, en: string): L {
  return { cs, en };
}

export function pick(text: L, locale: Locale): string {
  return text[locale] ?? text.en;
}

export function isLocale(value: unknown): value is Locale {
  return value === 'cs' || value === 'en';
}
