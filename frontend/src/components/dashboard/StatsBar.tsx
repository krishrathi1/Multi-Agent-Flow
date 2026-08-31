import {
  AlertOctagon,
  Bot,
  CircleDot,
  ListChecks,
  Moon,
  Zap,
} from 'lucide-react';
import { useAgentStore } from '../../stores/agent-store';
import { StatCard } from '../ui/StatCard';
import { Skeleton } from '../ui/States';
import type { Tone } from '../../lib/design';

const statItems = [
  { key: 'total', label: 'Total Agents', icon: Bot, tone: 'brand', to: '/controls' },
  { key: 'online', label: 'Online', icon: CircleDot, tone: 'success' },
  { key: 'idle', label: 'Idle', icon: Moon, tone: 'warning' },
  { key: 'error', label: 'Errors', icon: AlertOctagon, tone: 'danger', to: '/alerts' },
  { key: 'recentActivities', label: 'Events (1h)', icon: Zap, tone: 'info', to: '/activity' },
  { key: 'activeTasks', label: 'Active Tasks', icon: ListChecks, tone: 'accent', to: '/tasks' },
] satisfies ReadonlyArray<{
  key: 'total' | 'online' | 'idle' | 'error' | 'recentActivities' | 'activeTasks';
  label: string;
  icon: typeof Bot;
  tone: Tone;
  to?: string;
}>;

export function StatsBar() {
  const stats = useAgentStore((s) => s.stats);

  // Reserve the row's height while loading so the page below doesn't jump.
  if (!stats) {
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        {statItems.map((item) => (
          <Skeleton key={item.key} className="h-[104px] rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
      {statItems.map((item) => {
        const value = stats[item.key] ?? 0;
        return (
          <StatCard
            key={item.key}
            label={item.label}
            value={value}
            icon={item.icon}
            // A zero error count shouldn't shout in red — dim it instead.
            tone={value === 0 && item.tone === 'danger' ? 'neutral' : item.tone}
            muted={value === 0}
            to={item.to}
          />
        );
      })}
    </div>
  );
}
