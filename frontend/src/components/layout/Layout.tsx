import { Outlet, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { CommandPalette } from './CommandPalette';
import { getSocket, connectSocket, disconnectSocket } from '../../lib/socket';
import { useAuthStore } from '../../stores/auth-store';
import { useAgentStore } from '../../stores/agent-store';
import { useActivityStore } from '../../stores/activity-store';
import { useTaskStore } from '../../stores/task-store';
import { useUiStore } from '../../stores/ui-store';
import { cn } from '../../lib/utils';
import type { Activity, Agent, Task } from '../../types';

export function Layout() {
  const { fetchAgents, fetchStats, updateAgent } = useAgentStore();
  const addActivity = useActivityStore((s) => s.addActivity);
  const { setTask, removeTask } = useTaskStore();
  const { accessToken, isAuthenticated } = useAuthStore();
  const sidebarCollapsed = useUiStore((s) => s.sidebarCollapsed);
  const setSidebarCollapsed = useUiStore((s) => s.setSidebarCollapsed);
  const setSocketConnected = useUiStore((s) => s.setSocketConnected);
  const { pathname } = useLocation();

  // Close sidebar drawer on mobile on route change
  useEffect(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
      setSidebarCollapsed(true);
    }
  }, [pathname, setSidebarCollapsed]);

  useEffect(() => {
    fetchAgents();
    fetchStats();

    const interval = setInterval(() => {
      fetchStats();
    }, 30000);

    return () => clearInterval(interval);
  }, [fetchAgents, fetchStats]);

  // Connect socket with auth token
  useEffect(() => {
    if (isAuthenticated && accessToken) {
      connectSocket(accessToken);
    }

    return () => {
      disconnectSocket();
    };
  }, [isAuthenticated, accessToken]);

  useEffect(() => {
    const s = getSocket();

    // Mirror transport state into the store so the topbar can show it.
    const onConnect = () => setSocketConnected(true);
    const onDisconnect = () => setSocketConnected(false);
    s.on('connect', onConnect);
    s.on('disconnect', onDisconnect);
    setSocketConnected(s.connected);

    s.on('agent:status', (agent: Agent) => {
      updateAgent(agent);
    });

    s.on('agent:heartbeat', (agent: Agent) => {
      updateAgent(agent);
    });

    s.on('activity:new', (activity: Activity) => {
      addActivity(activity);
    });

    s.on('task:update', (task: Task) => {
      setTask(task);
    });

    s.on('task:delete', ({ id }: { id: string }) => {
      removeTask(id);
    });

    // Agent-to-agent messaging events (real-time monitoring across the app)
    s.on('agent:message', () => {
      fetchStats();
    });

    return () => {
      s.off('connect', onConnect);
      s.off('disconnect', onDisconnect);
      s.off('agent:status');
      s.off('agent:heartbeat');
      s.off('activity:new');
      s.off('task:update');
      s.off('task:delete');
      s.off('agent:message');
    };
  }, [updateAgent, addActivity, setTask, removeTask, fetchStats, setSocketConnected]);

  // Route changes reset scroll and move focus to main for screen readers.
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' });
    document.getElementById('main-content')?.focus({ preventScroll: true });
  }, [pathname]);

  return (
    <div className="min-h-dvh bg-canvas">
      {/* Keyboard users can jump past the 17-item nav. */}
      <a
        href="#main-content"
        className={cn(
          'sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[200]',
          'focus:rounded-md focus:bg-brand-600 focus:px-4 focus:py-2',
          'focus:text-sm focus:font-medium focus:text-white',
        )}
      >
        Skip to main content
      </a>

      {/* Mobile Drawer Backdrop Overlay */}
      {!sidebarCollapsed && (
        <div
          onClick={() => setSidebarCollapsed(true)}
          className="fixed inset-0 z-40 bg-slate-950/60 backdrop-blur-xs lg:hidden transition-opacity cursor-pointer"
          aria-hidden="true"
        />
      )}

      <Sidebar />
      <CommandPalette />

      <div
        className={cn(
          'flex min-h-dvh flex-col transition-[padding] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)]',
          'pl-0',
          sidebarCollapsed ? 'lg:pl-[68px]' : 'lg:pl-[248px]',
        )}
      >
        <Topbar />

        <main
          id="main-content"
          tabIndex={-1}
          className="flex-1 px-3.5 sm:px-6 py-4 sm:py-6 outline-none"
        >
          {/* Caps line length on ultrawide displays instead of stretching. */}
          <div className="mx-auto w-full max-w-[1600px]">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
