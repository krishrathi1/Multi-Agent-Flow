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
    label: 'Monitor',
    items: [
      { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, end: true },
      { path: '/processes', label: 'Productions', icon: Factory },
      { path: '/runs', label: 'Run History', icon: History },
      { path: '/activity', label: 'Activity Feed', icon: Activity },
      { path: '/chat', label: 'Mother Chat', icon: MessagesSquare },
      { path: '/comms', label: 'Communications', icon: Waypoints },
      { path: '/timeline', label: 'Timeline', icon: ScrollText },
    ],
  },
  {
    label: 'Manage',
    items: [
      { path: '/boards', label: 'Boards', icon: Columns3 },
      { path: '/approvals', label: 'Approvals', icon: ShieldCheck },
      { path: '/tasks', label: 'Task Board', icon: KanbanSquare },
      { path: '/topology', label: 'Network Graph', icon: Network },
      { path: '/controls', label: 'Agent Controls', icon: SlidersHorizontal },
      { path: '/gateways', label: 'Gateways', icon: Router },
      { path: '/skills', label: 'Skills', icon: Sparkles },
      { path: '/soul-templates', label: 'Soul Templates', icon: BadgeCheck },
    ],
  },
  {
    label: 'Ruflo Intelligence',
    items: [
      { path: '/ruflo/swarms', label: 'Swarm Studio', icon: Network },
      { path: '/ruflo/memory', label: 'Vector Memory (AgentDB)', icon: BrainCircuit },
      { path: '/ruflo/goals', label: 'GOAP Goal Planner', icon: Target },
      { path: '/ruflo/federation', label: 'Zero-Trust Federation', icon: Globe },
      { path: '/ruflo/learning', label: 'SONA Neural Hub', icon: Sparkles },
      { path: '/ruflo/aidefence', label: 'AIDefence Center', icon: ShieldAlert },
      { path: '/ruflo/metaharness', label: 'MetaHarness Readiness', icon: Gauge },
      { path: '/ruflo/personas', label: 'Specialized Personas', icon: Users },
    ],
  },
  {
    label: 'Observe',
    items: [
      { path: '/metrics', label: 'Metrics & Cost', icon: Gauge },
      { path: '/alerts', label: 'Alerts', icon: AlertTriangle },
      { path: '/search', label: 'Search & Audit', icon: Search },
    ],
  },
];

export function Sidebar() {
  const navigate = useNavigate();
  const { user, organization, logout } = useAuthStore();
  // Collapse lives in the UI store so the main region's offset stays in sync.
  const collapsed = useUiStore((s) => s.sidebarCollapsed);
  const toggleSidebar = useUiStore((s) => s.toggleSidebar);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

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

  const width = collapsed ? 'w-[68px]' : 'w-[248px]';

  const orgInitial = useMemo(
    () => organization?.name?.charAt(0).toUpperCase() ?? 'N',
    [organization?.name],
  );

  return (
    <aside
      className={cn(
        'fixed inset-y-0 left-0 z-40 flex flex-col border-r border-line-subtle',
        'bg-surface transition-[width] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)]',
        width,
      )}
      aria-label="Main navigation"
    >
      {/* ---- Brand ---- */}
      <div
        className={cn(
          'flex h-14 shrink-0 items-center border-b border-line-subtle/80 bg-surface/50 backdrop-blur-md',
          collapsed ? 'justify-center px-2' : 'gap-2.5 px-4',
        )}
      >
        <span className="relative grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-brand-500 via-brand-600 to-indigo-600 text-sm font-black text-white shadow-md shadow-brand-500/25 ring-1 ring-white/20">
          M
          <span className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full border border-surface bg-emerald-400" />
        </span>
        {!collapsed && (
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold tracking-tight text-ink">
              Mycelium<span className="text-brand-500">Ops</span>
            </p>
            <p className="truncate text-[10px] font-medium tracking-wider uppercase text-ink-faint">
              Mission Control
            </p>
          </div>
        )}
      </div>

      {/* ---- Primary action ---- */}
      <div className={cn('shrink-0 pt-3', collapsed ? 'px-2.5' : 'px-3')}>
        <NavLink
          to="/processes"
          title={collapsed ? 'New production' : undefined}
          className={({ isActive }) =>
            cn(
              'flex h-9 items-center rounded-md text-sm font-medium',
              'transition-colors duration-150',
              collapsed ? 'justify-center px-0' : 'gap-2 px-3',
              isActive
                ? 'bg-brand-600 text-white'
                : 'bg-brand-500/12 text-brand-700 dark:text-brand-200 border border-brand-600/25 dark:border-brand-500/25 hover:bg-brand-500/20 hover:border-brand-600/40 dark:hover:border-brand-500/40',
            )
          }
        >
          <Plus size={16} strokeWidth={2} className="shrink-0" aria-hidden />
          {!collapsed && 'New Production'}
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
                            'shrink-0 transition-colors',
                            isActive ? 'text-brand-700 dark:text-brand-300' : 'text-ink-faint group-hover:text-ink-muted',
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

      {/* ---- Collapse toggle ---- */}
      <div className={cn('shrink-0 border-t border-line-subtle py-2', collapsed ? 'px-2.5' : 'px-3')}>
        <button
          type="button"
          onClick={toggleSidebar}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className={cn(
            'flex h-8 w-full items-center rounded-md text-xs font-medium',
            'text-ink-faint transition-colors hover:wash hover:text-ink-muted',
            collapsed ? 'justify-center' : 'gap-2 px-2.5',
          )}
        >
          {collapsed ? (
            <ChevronsRight size={15} strokeWidth={1.75} aria-hidden />
          ) : (
            <>
              <ChevronsLeft size={15} strokeWidth={1.75} aria-hidden />
              Collapse
            </>
          )}
        </button>
      </div>

      {/* ---- Account ---- */}
      <div
        ref={menuRef}
        className={cn(
          'relative shrink-0 border-t border-line-subtle',
          collapsed ? 'p-2.5' : 'p-3',
        )}
      >
        <button
          type="button"
          onClick={() => setMenuOpen((o) => !o)}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          title={collapsed ? `${user?.name} — account menu` : undefined}
          className={cn(
            'flex w-full items-center rounded-md transition-colors duration-150',
            'hover:wash',
            collapsed ? 'justify-center p-1' : 'gap-2.5 p-1.5',
          )}
        >
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-brand-500/15 text-xs font-semibold text-brand-700 dark:text-brand-200">
            {user?.name?.charAt(0).toUpperCase() ?? <CircleUser size={16} />}
          </span>
          {!collapsed && (
            <span className="min-w-0 flex-1 text-left">
              <span className="block truncate text-sm font-medium text-ink">
                {user?.name}
              </span>
              <span className="block truncate text-2xs text-ink-faint">
                {organization?.name}
              </span>
            </span>
          )}
        </button>

        {menuOpen && (
          <div
            role="menu"
            className={cn(
              'absolute bottom-full mb-2 w-56 animate-scale-in origin-bottom-left',
              'rounded-lg border border-line bg-overlay p-1',
              'shadow-e4',
              collapsed ? 'left-2.5' : 'left-3',
            )}
          >
            <div className="flex items-center gap-2.5 border-b border-line-subtle px-2.5 py-2.5">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-brand-500/15 text-xs font-semibold text-brand-700 dark:text-brand-200">
                {orgInitial}
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-ink">{user?.name}</p>
                <p className="truncate text-2xs text-ink-faint">{user?.email}</p>
              </div>
            </div>

            <NavLink
              to="/settings"
              role="menuitem"
              onClick={() => setMenuOpen(false)}
              className="mt-1 flex h-8 items-center gap-2.5 rounded-md px-2.5 text-sm text-ink-muted transition-colors hover:wash hover:text-ink"
            >
              <Settings size={15} strokeWidth={1.75} aria-hidden />
              Settings
            </NavLink>
            <NavLink
              to="/invitations"
              role="menuitem"
              onClick={() => setMenuOpen(false)}
              className="flex h-8 items-center gap-2.5 rounded-md px-2.5 text-sm text-ink-muted transition-colors hover:wash hover:text-ink"
            >
              <Bot size={15} strokeWidth={1.75} aria-hidden />
              Invitations
            </NavLink>

            {/* Sign out sits below a divider — destructive actions stay separated. */}
            <div className="my-1 h-px bg-line-subtle" />
            <button
              type="button"
              role="menuitem"
              onClick={handleLogout}
              className="flex h-8 w-full items-center gap-2.5 rounded-md px-2.5 text-sm text-red-300 transition-colors hover:bg-red-500/10"
            >
              <LogOut size={15} strokeWidth={1.75} aria-hidden />
              Sign out
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
