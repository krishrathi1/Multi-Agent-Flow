import { create } from 'zustand';
import {
  applyTheme,
  readStoredTheme,
  resolveTheme,
  storeTheme,
  type ResolvedTheme,
  type ThemePreference,
} from '../lib/theme';

const SIDEBAR_KEY = 'nexus:sidebar-collapsed';

interface UiState {
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
  setSidebarCollapsed: (v: boolean) => void;

  /** Live socket connectivity, surfaced in the topbar. */
  socketConnected: boolean;
  setSocketConnected: (v: boolean) => void;

  /** What the user picked: light, dark, or follow the OS. */
  themePreference: ThemePreference;
  /** What is actually painted right now. Charts read this. */
  resolvedTheme: ResolvedTheme;
  setThemePreference: (pref: ThemePreference) => void;
  /** Cycles light → dark → system, for the topbar button. */
  cycleTheme: () => void;
  /** Re-resolves after an OS-level change while on "system". */
  syncSystemTheme: () => void;
}

export const useUiStore = create<UiState>((set) => ({
  sidebarCollapsed:
    typeof localStorage !== 'undefined' && localStorage.getItem(SIDEBAR_KEY) === '1',

  toggleSidebar: () =>
    set((s) => {
      const next = !s.sidebarCollapsed;
      try {
        localStorage.setItem(SIDEBAR_KEY, next ? '1' : '0');
      } catch {
        /* storage unavailable (private mode) — collapse still works in-session */
      }
      return { sidebarCollapsed: next };
    }),

  setSidebarCollapsed: (v) =>
    set(() => {
      try {
        localStorage.setItem(SIDEBAR_KEY, v ? '1' : '0');
      } catch {
        /* ignore */
      }
      return { sidebarCollapsed: v };
    }),

  socketConnected: false,
  setSocketConnected: (v) => set({ socketConnected: v }),

  themePreference: readStoredTheme(),
  resolvedTheme: resolveTheme(readStoredTheme()),

  setThemePreference: (pref) =>
    set(() => {
      storeTheme(pref);
      return { themePreference: pref, resolvedTheme: applyTheme(pref) };
    }),

  cycleTheme: () =>
    set((s) => {
      const order: ThemePreference[] = ['light', 'dark', 'system'];
      const next = order[(order.indexOf(s.themePreference) + 1) % order.length];
      storeTheme(next);
      return { themePreference: next, resolvedTheme: applyTheme(next) };
    }),

  syncSystemTheme: () =>
    set((s) =>
      s.themePreference === 'system'
        ? { resolvedTheme: applyTheme('system') }
        : {},
    ),
}));
