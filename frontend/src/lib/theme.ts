/**
 * Theme resolution.
 *
 * Three user-facing choices — light, dark, system. Only light/dark are ever
 * stamped on <html data-theme>; "system" removes the attribute and lets the
 * `prefers-color-scheme` block in index.css decide.
 */

export type ThemePreference = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

export const THEME_KEY = 'nexus:theme';

export function systemTheme(): ResolvedTheme {
  if (typeof window === 'undefined' || !window.matchMedia) return 'dark';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function resolveTheme(pref: ThemePreference): ResolvedTheme {
  return pref === 'system' ? systemTheme() : pref;
}

export function readStoredTheme(): ThemePreference {
  try {
    const raw = localStorage.getItem(THEME_KEY);
    if (raw === 'light' || raw === 'dark' || raw === 'system') return raw;
  } catch {
    /* storage blocked — fall through to the default */
  }
  return 'system';
}

export function storeTheme(pref: ThemePreference): void {
  try {
    localStorage.setItem(THEME_KEY, pref);
  } catch {
    /* non-fatal: the choice just won't survive a reload */
  }
}

/**
 * Applies a preference to the document root.
 *
 * `force` pins a theme regardless of preference — used by the marketing and
 * auth screens, which are painted for dark only.
 */
export function applyTheme(pref: ThemePreference, force?: ResolvedTheme): ResolvedTheme {
  const resolved = force ?? resolveTheme(pref);
  const root = document.documentElement;

  if (force || pref !== 'system') {
    root.setAttribute('data-theme', resolved);
  } else {
    root.removeAttribute('data-theme');
  }

  // Keep the legacy `.dark` class in sync — some marketing markup still keys
  // off it, and it makes `dark:` variants behave predictably.
  root.classList.toggle('dark', resolved === 'dark');
  return resolved;
}
