import { useEffect, useMemo, useRef, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  Activity,
  AlertTriangle,
  BadgeCheck,
  Bot,
  ChevronsLeft,
  ChevronsRight,
  CircleUser,
  Columns3,
  Cpu,
  Factory,
  History,
  Gauge,
  KanbanSquare,
  LayoutDashboard,
  LogOut,
  MessagesSquare,
  Network,
  Plus,
  Router,
  ScrollText,
  Search,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Table2,
  Waypoints,
  Zap,
  Code2,
  BrainCircuit,
  Target,
  ShieldAlert,
  Globe,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { useAuthStore } from '../../stores/auth-store';
import { useUiStore } from '../../stores/ui-store';

interface NavItem {
  path: string;
  label: string;
  icon: LucideIcon;
  /** Match only the exact path (used for index routes). */
  end?: boolean;
}

interface NavSection {
  label: string;
  items: NavItem[];
}

const navSections: NavSection[] = [
  {
    label: 'Core Fleet',
    items: [
      { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, end: true },
      { path: '/processes', label: 'Production Blocks', icon: Factory },
      { path: '/controls', label: 'Fleet Controls', icon: SlidersHorizontal },
      { path: '/chat', label: 'Mother Chat', icon: MessagesSquare },
    ],
  },
  {
    label: 'Work & Governance',
    items: [
      { path: '/tasks', label: 'Task Board', icon: KanbanSquare },
      { path: '/approvals', label: 'Approvals & Audit', icon: ShieldCheck },
      { path: '/topology', label: 'Network Graph', icon: Network },
      { path: '/activity', label: 'Live Activity', icon: Activity },
      { path: '/runs', label: 'Run History', icon: History },
    ],
  },
  {
    label: 'System & Tools',
    items: [
      { path: '/metrics', label: 'Metrics & Cost', icon: Gauge },
      { path: '/gateways', label: 'Gateways', icon: Router },
      { path: '/mcp', label: 'MCP Hub & Tools', icon: Cpu },
      { path: '/skills', label: 'Skills Library', icon: Sparkles },
      { path: '/alerts', label: 'Alerts & Incidents', icon: AlertTriangle },
    ],
  },
];

export function Sidebar() {
  const navigate = useNavigate();
  const { user, organization, logout } = useAuthStore();
  const collapsed = useUiStore((s) => s.sidebarCollapsed);
  const toggleSidebar = useUiStore((s) => s.toggleSidebar);
  const setSidebarCollapsed = useUiStore((s) => s.setSidebarCollapsed);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Auto-close on mobile after clicking nav
  const handleNavClick = () => {
    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
      setSidebarCollapsed(true);
    }
  };

  // Close the account menu on outside click or Escape.
  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMenuOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const orgInitial = useMemo(
    () => organization?.name?.charAt(0).toUpperCase() ?? 'N',
    [organization?.name],
  );

  return (
    <aside
      className={cn(
        'fixed inset-y-0 left-0 z-50 flex flex-col border-r border-line-subtle/80 bg-surface/85 backdrop-blur-2xl transition-all duration-250 ease-[cubic-bezier(0.16,1,0.3,1)]',
        // Mobile Drawer sliding
        collapsed
          ? '-translate-x-full lg:translate-x-0'
          : 'translate-x-0 shadow-2xl lg:shadow-none',
        // Width on desktop vs mobile
        collapsed
          ? 'lg:w-[68px]'
          : 'w-[280px] max-w-[85vw] lg:w-[248px]',
      )}
      aria-label="Main navigation"
    >
      {/* ---- Brand / Workspace Selector ---- */}
      <div
        className={cn(
          'flex h-14 shrink-0 items-center border-b border-line-subtle/80 bg-surface/80 backdrop-blur-md',
          collapsed ? 'lg:justify-center lg:px-2 px-3.5 justify-between' : 'justify-between px-3.5',
        )}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-600 text-xs font-bold text-white shadow-xs border border-brand-400/30">
            {orgInitial}
            <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-surface bg-emerald-500 shadow-2xs" />
          </div>
          {(!collapsed || typeof window !== 'undefined') && (
            <div className={cn('min-w-0 flex-1', collapsed ? 'lg:hidden' : 'block')}>
              <div className="flex items-center gap-1.5">
                <p className="truncate text-xs font-bold tracking-tight text-ink">
                  {organization?.name || 'Nexus Control Plane'}
                </p>
                <span className="rounded bg-brand-500/10 px-1 py-0.2 text-[9px] font-mono font-semibold text-brand-500 border border-brand-500/20">
                  PRO
                </span>
              </div>
              <p className="truncate text-[10px] font-mono text-ink-faint flex items-center gap-1 mt-0.5">
                <span className="h-1 w-1 rounded-full bg-emerald-500 inline-block" />
                Fleet Operational
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ---- Primary action ---- */}
      <div className={cn('shrink-0 pt-3.5', collapsed ? 'px-2.5' : 'px-3.5')}>
        <NavLink
          to="/processes"
          onClick={handleNavClick}
          title={collapsed ? 'New Production' : undefined}
          className={({ isActive }) =>
            cn(
              'group flex h-9 w-full items-center rounded-lg text-xs font-semibold tracking-wide shadow-xs',
              'transition-all duration-150 active:scale-[0.98]',
              collapsed ? 'justify-center px-0' : 'justify-between px-3',
              isActive
                ? 'bg-brand-600 text-white shadow-brand-500/20'
                : 'bg-brand-500/10 text-brand-600 dark:text-brand-300 border border-brand-500/20 hover:bg-brand-500/15 hover:border-brand-500/40',
            )
          }
        >
          <div className="flex items-center gap-2">
            <Plus size={15} strokeWidth={2.25} className="shrink-0 transition-transform group-hover:scale-110" aria-hidden />
            {!collapsed && <span>New Production</span>}
          </div>
          {!collapsed && (
            <kbd className="hidden sm:inline-flex items-center justify-center rounded border border-brand-500/30 bg-surface/50 px-1.5 py-0.5 font-mono text-[9px] text-ink-faint">
              ⌘N
            </kbd>
          )}
          <span className="sr-only">{collapsed ? 'New production' : ''}</span>
        </NavLink>
      </div>

      {/* ---- Navigation ---- */}
      <nav className={cn('min-h-0 flex-1 overflow-y-auto py-3', collapsed ? 'px-2.5' : 'px-3')}>
        {navSections.map((section, si) => (
          <div key={section.label} className={si > 0 ? 'mt-5' : ''}>
            {collapsed ? (
              // A hairline stands in for the label so grouping survives collapse.
              si > 0 && <div className="mx-2 mb-2 h-px bg-line-subtle" />
            ) : (
              <p className="mb-1.5 px-2.5 text-2xs font-semibold uppercase tracking-[0.09em] text-ink-faint">
                {section.label}
              </p>
            )}
            <ul className="space-y-0.5">
              {section.items.map((item) => (
                <li key={item.path}>
                  <NavLink
                    to={item.path}
                    end={item.end}
                    onClick={handleNavClick}
                    title={collapsed ? item.label : undefined}
                    className={({ isActive }) =>
                      cn(
                        'group relative flex h-9 items-center rounded-md text-sm font-medium',
                        'transition-colors duration-150',
                        collapsed ? 'justify-center px-0' : 'gap-2.5 px-2.5',
                        isActive
                          ? 'wash text-ink'
                          : 'text-ink-subtle hover:wash hover:text-ink',
                      )
                    }
                  >
                    {({ isActive }) => (
                      <>
                        {/* Active rail — a shape cue, so state isn't colour-only. */}
                        {isActive && (
                          <span
                            className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-brand-400"
                            aria-hidden
                          />
                        )}
                        <item.icon
                          size={16}
                          strokeWidth={1.75}
                          className={cn(
                            'shrink-0 transition-all duration-200 live-icon-hover',
                            isActive
                              ? 'text-brand-600 dark:text-brand-300 scale-105'
                              : 'text-ink-faint group-hover:text-brand-500 group-hover:scale-110',
                            item.path === '/chat' && isActive && 'animate-glow-pulse text-violet-500 dark:text-violet-300',
                            item.path === '/skills' && isActive && 'animate-shimmer-sparkle text-amber-500 dark:text-amber-400',
                            item.path === '/activity' && isActive && 'animate-pulse text-emerald-500 dark:text-emerald-400',
                          )}
                          aria-hidden
                        />
                        {!collapsed && <span className="truncate">{item.label}</span>}
                        {collapsed && <span className="sr-only">{item.label}</span>}
                      </>
                    )}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      {/* ---- Collapse toggle & Sign out ---- */}
      <div className={cn('shrink-0 border-t border-line-subtle py-2 space-y-1', collapsed ? 'px-2' : 'px-3')}>
        <button
          type="button"
          onClick={toggleSidebar}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className={cn(
            'flex h-8 w-full items-center rounded-lg text-xs font-medium',
            'text-ink-faint transition-colors hover:bg-hover hover:text-ink',
            collapsed ? 'justify-center' : 'gap-2 px-2.5',
          )}
        >
          {collapsed ? (
            <ChevronsRight size={15} strokeWidth={1.75} aria-hidden />
          ) : (
            <>
              <ChevronsLeft size={15} strokeWidth={1.75} aria-hidden />
              <span>Collapse</span>
            </>
          )}
        </button>

        <button
          type="button"
          onClick={handleLogout}
          aria-label="Sign out"
          title="Sign out"
          className={cn(
            'flex h-8 w-full items-center rounded-lg text-xs font-semibold',
            'text-rose-500 hover:bg-rose-500/10 transition-colors',
            collapsed ? 'justify-center' : 'gap-2 px-2.5',
          )}
        >
          <LogOut size={15} strokeWidth={1.75} aria-hidden />
          {!collapsed && <span>Sign out</span>}
        </button>
      </div>
    </aside>
  );
}
