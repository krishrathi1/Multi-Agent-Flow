import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useUiStore } from '../stores/ui-store';
import { applyTheme } from '../lib/theme';

/**
 * Marketing and auth screens are painted for dark only (hero gradients, white
 * body copy). They pin dark so a light-mode preference doesn't wreck them; the
 * authenticated app honours the user's choice.
 */
const FORCED_DARK = [/^\/$/, /^\/docs(\/|$)/, /^\/login$/, /^\/signup$/, /^\/check-email$/, /^\/verify-email$/];

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const themePreference = useUiStore((s) => s.themePreference);
  const syncSystemTheme = useUiStore((s) => s.syncSystemTheme);
  const { pathname } = useLocation();

  const forceDark = FORCED_DARK.some((re) => re.test(pathname));

  useEffect(() => {
    applyTheme(themePreference, forceDark ? 'dark' : undefined);
  }, [themePreference, forceDark]);

  // Follow the OS while the preference is "system".
  useEffect(() => {
    if (!window.matchMedia) return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => syncSystemTheme();
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [syncSystemTheme]);

  return <>{children}</>;
}
