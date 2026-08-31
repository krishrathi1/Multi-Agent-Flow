import { NavLink } from 'react-router-dom';
import { cn } from '@/lib/utils';

interface NavItem {
  label: string;
  path: string;
  end?: boolean;
}

interface NavGroup {
  title: string;
  items: NavItem[];
}

const navGroups: NavGroup[] = [
  {
    title: 'Introduction',
    items: [
      { label: 'Getting Started', path: '/docs', end: true },
    ],
  },
  {
    title: 'Core Features',
    items: [
      { label: 'Agent Management', path: '/docs/agent-management' },
      { label: 'MCP Integration', path: '/docs/mcp-integration' },
      { label: 'Remote Agent Tracking', path: '/docs/remote-agents' },
      { label: 'Alert Configuration', path: '/docs/alerts' },
    ],
  },
  {
    title: 'Collaboration',
    items: [
      { label: 'Organizations & Teams', path: '/docs/organizations' },
    ],
  },
  {
    title: 'Developer',
    items: [
      { label: 'API Reference', path: '/docs/api-reference' },
      { label: 'WebSocket Events', path: '/docs/websocket-events' },
    ],
  },
];

export function DocsSidebar() {
  return (
    <aside className="w-64 shrink-0 border-r border-white/5 py-8 pr-6 hidden lg:block">
      <nav className="sticky top-20 space-y-6">
        {navGroups.map((group) => (
          <div key={group.title}>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2 px-3">
              {group.title}
            </h3>
            <ul className="space-y-0.5">
              {group.items.map((item) => (
                <li key={item.path}>
                  <NavLink
                    to={item.path}
                    end={item.end}
                    className={({ isActive }) =>
                      cn(
                        'block px-3 py-2 rounded-lg text-sm transition-colors duration-150',
                        isActive
                          ? 'bg-nexus-600/15 text-nexus-400 font-medium'
                          : 'text-gray-400 hover:text-gray-300 hover:bg-surface-850'
                      )
                    }
                  >
                    {item.label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>
    </aside>
  );
}
