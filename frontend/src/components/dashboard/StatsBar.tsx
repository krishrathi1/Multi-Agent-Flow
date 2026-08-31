import {
  AlertOctagon,
  Bot,
  CircleDot,
  Clock,
  ListChecks,
  Shield,
  Users,
  Wifi,
  Zap,
} from 'lucide-react';
import { useAgentStore } from '../../stores/agent-store';
import { StatCard } from '../ui/StatCard';
import { Skeleton } from '../ui/States';
import type { Tone } from '../../lib/design';

const statItems = [
  { key: 'total', label: 'Total Agents', sublabel: 'All agents in fleet', icon: Users, tone: 'brand', to: '/controls' },
  { key: 'online', label: 'Online', sublabel: 'Currently online', icon: Wifi, tone: 'success' },
  { key: 'idle', label: 'Idle', sublabel: 'Ready for tasks', icon: Clock, tone: 'warning' },
  { key: 'error', label: 'Errors', sublabel: 'In last 1 hour', icon: Shield, tone: 'danger', to: '/alerts' },
  { key: 'recentActivities', label: 'Events (1h)', sublabel: 'Total events', icon: Zap, tone: 'brand', to: '/activity' },
  { key: 'activeTasks', label: 'Active Tasks', sublabel: 'In progress', icon: ListChecks, tone: 'accent', to: '/tasks' },
] satisfies ReadonlyArray<{
  key: 'total' | 'online' | 'idle' | 'error' | 'recentActivities' | 'activeTasks';
  label: string;
  sublabel: string;
  icon: typeof Users;
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
    <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 xl:grid-cols-6">
      {statItems.map((item) => {
        const value = stats[item.key] ?? 0;
        return (
          <StatCard
            key={item.key}
            label={item.label}
            sublabel={item.sublabel}
            value={value}
            icon={item.icon}
            tone={value === 0 && item.tone === 'danger' ? 'neutral' : item.tone}
            muted={false}
            to={item.to}
          />
        );
      })}
    </div>
  );
}
