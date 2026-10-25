import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPortal } from 'react-dom';
import {
  Activity,
  AlertTriangle,
  Bot,
  Columns3,
  CornerDownLeft,
  Factory,
  Gauge,
  History,
  KanbanSquare,
  LayoutDashboard,
  MessagesSquare,
  Moon,
  Network,
  Plus,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Sun,
  Waypoints,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { useUiStore } from '../../stores/ui-store';
import { useProcessStore } from '../../stores/process-store';
import { useAgentStore } from '../../stores/agent-store';

interface Command {
  id: string;
  label: string;
  hint?: string;
  icon: LucideIcon;
  group: string;
  run: () => void;
  /** Extra words that should match this entry. */
  keywords?: string;
}

/**
 * High-contrast, beautifully styled Command Palette (⌘K)
 */
export function CommandPalette() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const setThemePreference = useUiStore((s) => s.setThemePreference);
  const toggleSidebar = useUiStore((s) => s.toggleSidebar);
  const processes = useProcessStore((s) => s.processes);
  const setScope = useProcessStore((s) => s.setScope);
  const agents = useAgentStore((s) => s.agents);

  const close = useCallback(() => {
    setOpen(false);
    setQuery('');
    setActive(0);
  }, []);

  const commands = useMemo<Command[]>(() => {
    const go = (path: string) => () => {
      navigate(path);
      close();
    };

    const nav: Command[] = [
      { id: 'n-dash', label: 'Dashboard', icon: LayoutDashboard, group: 'Go to', run: go('/dashboard') },
      { id: 'n-prod', label: 'Productions', icon: Factory, group: 'Go to', run: go('/processes') },
      { id: 'n-runs', label: 'Run History', icon: History, group: 'Go to', run: go('/runs') },
      { id: 'n-auto', label: 'Automation', icon: Zap, group: 'Go to', run: go('/automation'), keywords: 'templates schedules webhooks cron' },
      { id: 'n-act', label: 'Activity Feed', icon: Activity, group: 'Go to', run: go('/activity') },
      { id: 'n-chat', label: 'Mother Chat', icon: MessagesSquare, group: 'Go to', run: go('/chat') },
      { id: 'n-comms', label: 'Communications', icon: Waypoints, group: 'Go to', run: go('/comms') },
      { id: 'n-boards', label: 'Boards', icon: Columns3, group: 'Go to', run: go('/boards') },
      { id: 'n-appr', label: 'Approvals', icon: ShieldCheck, group: 'Go to', run: go('/approvals') },
      { id: 'n-tasks', label: 'Task Board', icon: KanbanSquare, group: 'Go to', run: go('/tasks') },
      { id: 'n-topo', label: 'Network Graph', icon: Network, group: 'Go to', run: go('/topology') },
      { id: 'n-metrics', label: 'Metrics & Cost', icon: Gauge, group: 'Go to', run: go('/metrics'), keywords: 'spend tokens' },
      { id: 'n-alerts', label: 'Alerts', icon: AlertTriangle, group: 'Go to', run: go('/alerts') },
      { id: 'n-skills', label: 'Skills', icon: Sparkles, group: 'Go to', run: go('/skills') },
      { id: 'n-settings', label: 'Settings', icon: Settings, group: 'Go to', run: go('/settings') },
    ];

    const actions: Command[] = [
      { id: 'a-new', label: 'New production', icon: Plus, group: 'Actions', run: go('/processes'), keywords: 'create chain agents' },
      { id: 'a-light', label: 'Switch to light theme', icon: Sun, group: 'Actions', run: () => { setThemePreference('light'); close(); } },
      { id: 'a-dark', label: 'Switch to dark theme', icon: Moon, group: 'Actions', run: () => { setThemePreference('dark'); close(); } },
      { id: 'a-sidebar', label: 'Toggle sidebar', icon: Columns3, group: 'Actions', run: () => { toggleSidebar(); close(); } },
      { id: 'a-all', label: 'Clear production filter', icon: Factory, group: 'Actions', run: () => { setScope(null); close(); }, keywords: 'scope all' },
    ];

    const prodCmds: Command[] = processes.map((p) => ({
      id: `p-${p.id}`,
      label: p.name,
      hint: `${p.agentCount} agents · ${p.status.toLowerCase()}`,
      icon: Factory,
      group: 'Productions',
      keywords: 'production chain',
      run: () => {
        setScope(p.id);
        navigate('/processes');
        close();
      },
    }));

    const agentCmds: Command[] = agents.slice(0, 30).map((a) => ({
      id: `ag-${a.id}`,
      label: a.displayName,
      hint: a.processRole ?? a.name,
      icon: Bot,
      group: 'Agents',
      keywords: a.name,
      run: go(`/agents/${a.id}`),
    }));

    return [...nav, ...actions, ...prodCmds, ...agentCmds];
  }, [navigate, close, setThemePreference, toggleSidebar, setScope, processes, agents]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands.slice(0, 40);
    return commands
      .filter((c) =>
        `${c.label} ${c.hint ?? ''} ${c.keywords ?? ''} ${c.group}`.toLowerCase().includes(q),
      )
      .slice(0, 40);
  }, [commands, query]);

  // Cmd/Ctrl-K opens; Escape closes.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((o) => !o);
        return;
      }
      if (e.key === 'Escape' && open) close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, close]);

  useEffect(() => {
    if (open) requestAnimationFrame(() => inputRef.current?.focus());
  }, [open]);

  useEffect(() => {
    setActive(0);
  }, [query]);

  // Keep the highlighted row in view while arrowing through a long list.
  useEffect(() => {
    listRef.current
      ?.querySelector(`[data-index="${active}"]`)
      ?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  if (!open) return null;

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((i) => (i + 1) % Math.max(filtered.length, 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => (i - 1 + filtered.length) % Math.max(filtered.length, 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      filtered[active]?.run();
    }
  };

  let lastGroup = '';

  return createPortal(
    <div className="fixed inset-0 z-[150] flex items-start justify-center p-4 pt-[10vh]">
      {/* High-contrast dark backdrop scrim with blur */}
      <div
        className="absolute inset-0 animate-fade-in bg-black/60 backdrop-blur-md"
        onClick={close}
        aria-hidden
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        className={cn(
          'relative flex w-full max-w-xl animate-scale-in flex-col overflow-hidden',
          'rounded-2xl border border-line-strong/60 bg-surface shadow-2xl',
          'ring-1 ring-black/10 dark:ring-white/10',
        )}
      >
        {/* Search header bar */}
        <div className="flex items-center gap-3 border-b border-line-subtle px-4 py-3.5 bg-surface">
          <Search size={18} strokeWidth={2.25} className="shrink-0 text-brand-500" aria-hidden />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Search screens, productions, agents…"
            aria-label="Command search"
            className="h-9 flex-1 bg-transparent text-sm md:text-base font-semibold text-ink outline-none placeholder:text-ink-muted/60"
          />
          <kbd className="rounded-md border border-line bg-raised px-2 py-0.5 font-mono text-[10px] font-bold text-ink-muted shadow-2xs">
            ESC
          </kbd>
        </div>

        {/* List of results */}
        <ul ref={listRef} className="max-h-[min(60vh,420px)] overflow-y-auto p-2 bg-surface" role="listbox">
          {filtered.length === 0 && (
            <li className="px-4 py-10 text-center text-sm font-medium text-ink-muted">
              Nothing matches “<span className="font-semibold text-ink">{query}</span>”.
            </li>
          )}
          {filtered.map((c, i) => {
            const showGroup = c.group !== lastGroup;
            lastGroup = c.group;
            const isSelected = i === active;
            return (
              <li key={c.id}>
                {showGroup && (
                  <p className="px-3 pb-1.5 pt-3.5 text-[11px] font-bold uppercase tracking-wider text-ink-muted">
                    {c.group}
                  </p>
                )}
                <button
                  type="button"
                  data-index={i}
                  role="option"
                  aria-selected={isSelected}
                  onMouseEnter={() => setActive(i)}
                  onClick={c.run}
                  className={cn(
                    'group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left',
                    'transition-all duration-150',
                    isSelected
                      ? 'bg-brand-500/12 text-brand-700 dark:text-brand-300 font-semibold ring-1 ring-brand-500/30 shadow-xs'
                      : 'text-ink hover:bg-hover',
                  )}
                >
                  <div
                    className={cn(
                      'grid h-7 w-7 shrink-0 place-items-center rounded-lg border transition-colors',
                      isSelected
                        ? 'border-brand-500/40 bg-brand-500/20 text-brand-600 dark:text-brand-300'
                        : 'border-line/70 bg-inset text-ink-muted group-hover:border-line-strong group-hover:text-ink',
                    )}
                  >
                    <c.icon size={15} strokeWidth={2} aria-hidden />
                  </div>
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">{c.label}</span>
                  {c.hint && (
                    <span
                      className={cn(
                        'shrink-0 truncate text-xs font-normal transition-colors',
                        isSelected ? 'text-brand-600/80 dark:text-brand-300/80' : 'text-ink-muted',
                      )}
                    >
                      {c.hint}
                    </span>
                  )}
                  {isSelected && (
                    <CornerDownLeft
                      size={13}
                      strokeWidth={2.5}
                      className="shrink-0 text-brand-500"
                      aria-hidden
                    />
                  )}
                </button>
              </li>
            );
          })}
        </ul>

        {/* Footer info */}
        <div className="flex items-center gap-4 border-t border-line-subtle bg-inset/50 px-4 py-2.5 text-xs font-medium text-ink-muted">
          <span className="flex items-center gap-1">
            <kbd className="rounded border border-line bg-raised px-1 py-0.5 font-mono text-[10px]">↑↓</kbd> navigate
          </span>
          <span className="flex items-center gap-1">
            <kbd className="rounded border border-line bg-raised px-1 py-0.5 font-mono text-[10px]">↵</kbd> select
          </span>
          <span className="ml-auto tabular-nums font-semibold text-ink">
            {filtered.length} results
          </span>
        </div>
      </div>
    </div>,
    document.body,
  );
}
