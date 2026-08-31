import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Activity,
  CircleSlash,
  Command,
  Radio,
  Search,
  Sparkles,
  Wifi,
  WifiOff,
  X,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { useAgentStore } from '../../stores/agent-store';
import { useUiStore } from '../../stores/ui-store';
import { ThemeToggle } from './ThemeToggle';
import { NotificationBell } from './NotificationBell';

/**
 * Premium glassmorphic Topbar with live telemetry, unified search,
 * real-time socket indicator, and fast command access.
 */
export function Topbar() {
  const navigate = useNavigate();
  const stats = useAgentStore((s) => s.stats);
  const socketConnected = useUiStore((s) => s.socketConnected);
  const [query, setQuery] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  // Global '/' keyboard shortcut to focus search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.key === '/' &&
        document.activeElement?.tagName !== 'INPUT' &&
        document.activeElement?.tagName !== 'TEXTAREA'
      ) {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    if (q) navigate(`/search?q=${encodeURIComponent(q)}`);
  };

  const clearSearch = () => {
    setQuery('');
    searchRef.current?.focus();
  };

  const hasErrors = (stats?.error ?? 0) > 0;

  return (
    <header
      className={cn(
        'sticky top-0 z-30 flex h-14 shrink-0 items-center justify-between gap-3',
        'border-b border-line/60 bg-canvas/75 px-5 backdrop-blur-xl',
        'transition-colors duration-200',
      )}
    >
      {/* Ambient bottom gradient border glow */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-brand-500/25 to-transparent" />

      {/* ---- Left: Search & Quick Commands ---- */}
      <div className="flex flex-1 items-center gap-2.5 max-w-xl">
        {/* Search input capsule */}
        <form
          onSubmit={submitSearch}
          className="relative w-full max-w-sm group"
          role="search"
        >
          <label htmlFor="global-search" className="sr-only">
            Search activity, agents and audit log
          </label>
          <Search
            size={15}
            strokeWidth={2}
            className={cn(
              'pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 transition-colors duration-200',
              isFocused ? 'text-brand-500' : 'text-ink-faint group-hover:text-ink-muted',
            )}
            aria-hidden
          />
          <input
            id="global-search"
            ref={searchRef}
            type="text"
            value={query}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search missions, logs, agents…"
            className={cn(
              'h-8.5 w-full rounded-xl border bg-surface/60 backdrop-blur-md',
              'pl-9 pr-9 text-xs text-ink placeholder:text-ink-faint shadow-xs',
              'transition-all duration-200',
              isFocused
                ? 'border-brand-500/60 bg-surface ring-4 ring-brand-500/10 shadow-e2'
                : 'border-line/70 hover:border-line-strong hover:bg-surface/90',
            )}
          />

          {/* Quick Clear or Keyboard Shortcut tag */}
          {query ? (
            <button
              type="button"
              onClick={clearSearch}
              aria-label="Clear search"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-0.5 text-ink-faint hover:bg-hover hover:text-ink transition-colors"
            >
              <X size={13} strokeWidth={2} />
            </button>
          ) : (
            <kbd className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 hidden sm:inline-flex items-center justify-center rounded-md border border-line-subtle bg-raised/70 px-1.5 py-0.5 font-mono text-[10px] text-ink-faint shadow-2xs">
              /
            </kbd>
          )}
        </form>

        {/* Command palette trigger pill */}
        <button
          type="button"
          onClick={() =>
            window.dispatchEvent(
              new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }),
            )
          }
          aria-label="Open command palette (Ctrl+K or ⌘K)"
          className={cn(
            'group hidden h-8.5 items-center gap-2 rounded-xl border border-line-strong/70',
            'bg-surface px-2.5 text-xs font-semibold text-ink shadow-xs',
            'transition-all duration-150 hover:border-brand-500 hover:bg-brand-500/5 hover:text-brand-600 dark:hover:text-brand-400 hover:shadow-e1 active:scale-[0.98] lg:flex',
          )}
        >
          <Command
            size={13}
            strokeWidth={2.25}
            className="text-brand-500 transition-transform duration-200 group-hover:scale-110"
            aria-hidden
          />
          <span className="font-medium text-ink">Commands</span>
          <span className="flex items-center gap-0.5">
            <kbd className="rounded border border-line bg-raised px-1.5 py-0.5 font-mono text-[10px] font-bold text-ink shadow-2xs">
              ⌘
            </kbd>
            <kbd className="rounded border border-line bg-raised px-1.5 py-0.5 font-mono text-[10px] font-bold text-ink shadow-2xs">
              K
            </kbd>
          </span>
        </button>
      </div>

      {/* ---- Right: Telemetry & Actions ---- */}
      <div className="flex items-center gap-2 sm:gap-2.5">
        {/* Fleet telemetry deck */}
        {stats && (
          <div className="hidden items-center gap-1.5 rounded-xl border border-line/60 bg-surface/40 px-2 py-1 backdrop-blur-md shadow-2xs md:flex">
            {/* Online Agents Pill */}
            <div
              className={cn(
                'flex items-center gap-1.5 rounded-lg px-2 py-0.5 text-xs font-medium transition-colors',
                stats.online > 0
                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                  : 'text-ink-faint',
              )}
            >
              <span className="relative flex h-2 w-2">
                {stats.online > 0 && (
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                )}
                <span
                  className={cn(
                    'relative inline-flex h-2 w-2 rounded-full',
                    stats.online > 0 ? 'bg-emerald-500' : 'bg-ink-faint/50',
                  )}
                />
              </span>
              <span>{stats.online} online</span>
            </div>

            {/* Idle Agents Pill */}
            {stats.idle > 0 && (
              <div className="flex items-center gap-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 text-xs font-medium text-amber-600 dark:text-amber-400">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                <span>{stats.idle} idle</span>
              </div>
            )}

            {/* Errors Pill */}
            {hasErrors && (
              <div className="flex items-center gap-1.5 rounded-lg bg-rose-500/10 border border-rose-500/25 px-2 py-0.5 text-xs font-medium text-rose-600 dark:text-rose-400">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-rose-500" />
                </span>
                <span>{stats.error} error</span>
              </div>
            )}

            {/* Active Tasks Counter */}
            <div className="flex items-center gap-1.5 pl-1.5 pr-1 text-xs text-ink-faint">
              <Activity size={12} strokeWidth={2} className="text-brand-500 shrink-0" />
              <span className="font-semibold tabular-nums text-ink">
                {stats.activeTasks}
              </span>
              <span className="hidden lg:inline text-ink-muted">active tasks</span>
            </div>
          </div>
        )}

        {/* Divider */}
        <div className="hidden h-5 w-px bg-line/60 sm:block" />

        {/* Live Socket Gateway Indicator */}
        <div
          title={socketConnected ? 'Real-time WebSocket connection active' : 'Live updates disconnected'}
          className={cn(
            'flex h-8.5 items-center gap-1.5 rounded-xl border px-2 text-xs font-medium backdrop-blur-sm transition-all shadow-xs',
            socketConnected
              ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
              : 'border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400',
          )}
        >
          {socketConnected ? (
            <>
              <Radio size={13} strokeWidth={2.25} className="animate-pulse text-emerald-500" />
              <span className="hidden xl:inline text-[11px] font-semibold">LIVE</span>
            </>
          ) : (
            <>
              <WifiOff size={13} strokeWidth={2} className="text-amber-500" />
              <span className="hidden xl:inline text-[11px] font-semibold">RECONNECTING</span>
            </>
          )}
        </div>

        {/* Theme Picker */}
        <ThemeToggle />

        {/* Notification Bell */}
        <NotificationBell />
      </div>
    </header>
  );
}

/** Shown when a page's data source is unreachable. */
export function OfflineNotice() {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3.5 py-2.5 text-xs font-medium text-amber-300 backdrop-blur-md shadow-xs">
      <CircleSlash size={14} strokeWidth={2} className="shrink-0 text-amber-400" aria-hidden />
      <span>Live updates are disconnected. Some data may be delayed or stale.</span>
    </div>
  );
}
