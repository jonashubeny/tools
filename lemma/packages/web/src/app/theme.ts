export type ThemeSetting = 'dark' | 'light' | 'system';

const media = (): MediaQueryList | null =>
  typeof window.matchMedia === 'function' ? window.matchMedia('(prefers-color-scheme: light)') : null;

const resolve = (setting: ThemeSetting): 'dark' | 'light' =>
  setting === 'system' ? (media()?.matches ? 'light' : 'dark') : setting;

let stopFollowing: (() => void) | null = null;

/** Apply a theme now and remember it for the next page load (public/theme-init.js reads it). */
export function applyTheme(setting: ThemeSetting): void {
  document.documentElement.setAttribute('data-theme', resolve(setting));
  try {
    localStorage.setItem('lemma.theme', setting);
  } catch {
    // Private mode or blocked storage: the theme simply is not remembered.
  }
  stopFollowing?.();
  stopFollowing = null;
  if (setting === 'system') {
    const query = media();
    if (!query) return;
    const follow = (): void => document.documentElement.setAttribute('data-theme', query.matches ? 'light' : 'dark');
    query.addEventListener('change', follow);
    stopFollowing = () => query.removeEventListener('change', follow);
  }
}

export const currentTheme = (): 'dark' | 'light' =>
  document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
