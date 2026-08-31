import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Activity,
  Bot,
  CircleSlash,
  CircleUser,
  Command,
  LogOut,
  Radio,
  Search,
  Settings,
  Sparkles,
  Wifi,
  WifiOff,
  X,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { useAgentStore } from '../../stores/agent-store';
import { useAuthStore } from '../../stores/auth-store';
import { useUiStore } from '../../stores/ui-store';
import { ThemeToggle } from './ThemeToggle';
import { NotificationBell } from './NotificationBell';

/**
 * Premium glassmorphic Topbar with live telemetry, unified search,
 * real-time socket indicator, and user account dropdown.
 */
export function Topbar() {
  const navigate = useNavigate();
  const stats = useAgentStore((s) => s.stats);
  const { user, organization, logout } = useAuthStore();
  const socketConnected = useUiStore((s) => s.socketConnected);
  const toggleSidebar = useUiStore((s) => s.toggleSidebar);
  const [query, setQuery] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Global '/' or '⌘K' keyboard shortcut to focus search / open command palette
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        (e.key === '/' || (e.key === 'k' && (e.metaKey || e.ctrlKey))) &&
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

  const handleLogout = async () => {
    setMenuOpen(false);
    await logout();
    navigate('/login');
  };

  const userInitial = user?.name?.charAt(0).toUpperCase() || 'A';
  const orgInitial = organization?.name?.charAt(0).toUpperCase() || 'B';

  return (
    <header
      className={cn(
        'sticky top-0 z-30 flex h-14 shrink-0 items-center justify-between gap-3',
        'border-b border-line-subtle bg-surface px-5 backdrop-blur-md',
        'transition-colors duration-200',
      )}
    >
      {/* ---- Left: Sidebar Toggle & Search ---- */}
      <div className="flex flex-1 items-center gap-3 max-w-xl">
        <button
          type="button"
          onClick={toggleSidebar}
          aria-label="Toggle sidebar navigation"
          className="grid h-8 w-8 place-items-center rounded-lg text-ink-muted hover:bg-hover hover:text-ink transition-colors"
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="4" x2="20" y1="12" y2="12" />
            <line x1="4" x2="20" y1="6" y2="6" />
            <line x1="4" x2="20" y1="18" y2="18" />
          </svg>
        </button>

        {/* Search input capsule */}
        <form
          onSubmit={submitSearch}
          className="relative w-full max-w-sm group"
          role="search"
        >
          <label htmlFor="global-search" className="sr-only">
            Search missions, agents, logs
          </label>
          <Search
            size={14}
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
            placeholder="Search missions, agents, logs..."
            className={cn(
              'h-8.5 w-full rounded-xl border bg-inset/40',
              'pl-8.5 pr-9 text-xs text-ink placeholder:text-ink-faint shadow-2xs',
              'transition-all duration-200',
              isFocused
                ? 'border-brand-500/60 bg-surface ring-2 ring-brand-500/10'
                : 'border-line/70 hover:border-line-strong hover:bg-surface',
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
            <kbd className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 hidden sm:inline-flex items-center justify-center rounded border border-line-subtle bg-surface px-1.5 py-0.5 font-mono text-[9px] font-medium text-ink-faint shadow-2xs">
              ⌘K
            </kbd>
          )}
        </form>
      </div>

      {/* ---- Right: Telemetry & Actions ---- */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Live Socket Gateway Indicator */}
        <div
          className={cn(
            'flex h-7 items-center gap-1.5 rounded-full px-2.5 text-xs font-semibold backdrop-blur-sm shadow-2xs',
            socketConnected
              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
              : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20',
          )}
        >
          <span className={cn('h-1.5 w-1.5 rounded-full', socketConnected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500')} />
          <span>{socketConnected ? 'Live' : 'Offline'}</span>
        </div>

        {/* Fleet telemetry deck */}
        {stats && (
          <div className="hidden items-center gap-3 text-xs md:flex">
            {/* Online Agents */}
            <div className="flex items-center gap-1.5 text-ink-muted">
              <span className="h-2 w-2 rounded-full bg-emerald-500 inline-block" />
              <span className="font-semibold text-ink tabular-nums">{stats.online}</span>
              <span>online</span>
            </div>

            {/* Idle Agents */}
            <div className="flex items-center gap-1.5 text-ink-muted">
              <span className="h-2 w-2 rounded-full bg-amber-500 inline-block" />
              <span className="font-semibold text-ink tabular-nums">{stats.idle}</span>
              <span>idle</span>
            </div>

            {/* Active Tasks Counter */}
            <div className="flex items-center gap-1.5 text-ink-muted">
              <Activity size={13} strokeWidth={2} className="text-brand-500 shrink-0" />
              <span className="font-semibold text-ink tabular-nums">{stats.activeTasks}</span>
              <span>active tasks</span>
            </div>
          </div>
        )}

        {/* Action icons */}
        <div className="flex items-center gap-1">
          <ThemeToggle />
          <NotificationBell />
        </div>

        {/* User avatar circle with Dropdown Menu */}
        <div ref={menuRef} className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen((o) => !o)}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white shadow-xs hover:ring-2 hover:ring-blue-400/40 transition-all cursor-pointer"
          >
            {userInitial}
          </button>

          {menuOpen && (
            <div
              role="menu"
              className="absolute right-0 top-full mt-2 w-56 animate-scale-in origin-top-right rounded-2xl border border-line-subtle bg-surface p-1.5 shadow-e3 z-50"
            >
              {/* Header */}
              <div className="flex items-center gap-2.5 p-2 border-b border-line-subtle/80">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 text-xs font-bold">
                  {orgInitial}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-xs font-bold text-ink">{user?.name || 'Admin'}</p>
                  <p className="truncate text-[11px] text-ink-muted">{user?.email || 'admin@nexus.local'}</p>
                </div>
              </div>

              {/* Menu Links */}
              <div className="py-1">
                <Link
                  to="/controls"
                  role="menuitem"
                  onClick={() => setMenuOpen(false)}
                  className="flex h-8 items-center gap-2.5 rounded-lg px-2.5 text-xs font-medium text-ink-muted hover:bg-hover hover:text-ink transition-colors"
                >
                  <Settings size={14} strokeWidth={1.75} aria-hidden />
                  <span>Settings</span>
                </Link>

                <Link
                  to="/invitations"
                  role="menuitem"
                  onClick={() => setMenuOpen(false)}
                  className="flex h-8 items-center gap-2.5 rounded-lg px-2.5 text-xs font-medium text-ink-muted hover:bg-hover hover:text-ink transition-colors"
                >
                  <Bot size={14} strokeWidth={1.75} aria-hidden />
                  <span>Invitations</span>
                </Link>
              </div>

              {/* Sign out */}
              <div className="border-t border-line-subtle/80 pt-1">
                <button
                  type="button"
                  role="menuitem"
                  onClick={handleLogout}
                  className="flex h-8 w-full items-center gap-2.5 rounded-lg px-2.5 text-xs font-semibold text-rose-500 hover:bg-rose-500/10 transition-colors cursor-pointer"
                >
                  <LogOut size={14} strokeWidth={1.75} aria-hidden />
                  <span>Sign out</span>
                </button>
              </div>
            </div>
          )}
        </div>
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
