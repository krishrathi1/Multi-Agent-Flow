import { useAgentStore } from '../../stores/agent-store';
import { useActivityStore } from '../../stores/activity-store';
import { cn } from '../../lib/utils';
import { activityIconFor, activityToneFor, tones } from '../../lib/design';
import { Avatar } from '../ui/Avatar';
import type { ActivityType } from '../../types';
import { Filter, X, Sparkles, Bot, Layers } from 'lucide-react';

const activityTypes: Array<{ value: ActivityType | null; label: string }> = [
  { value: null, label: 'All Events' },
  { value: 'HEARTBEAT', label: 'Heartbeat' },
  { value: 'TASK_START', label: 'Task Start' },
  { value: 'TASK_COMPLETE', label: 'Completed' },
  { value: 'ERROR', label: 'Errors' },
  { value: 'ALERT', label: 'Alerts' },
  { value: 'DELEGATION', label: 'Delegation' },
  { value: 'MESSAGE', label: 'Messages' },
];

function FilterPill({
  active,
  onClick,
  children,
  activeClass,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  activeClass?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'inline-flex h-8 shrink-0 items-center gap-1.5 rounded-xl border px-3 text-xs font-semibold cursor-pointer',
        'transition-all duration-150 select-none whitespace-nowrap active:scale-[0.97]',
        active
          ? activeClass ?? 'border-brand-500/40 bg-brand-500/10 text-brand-600 dark:text-brand-400 font-bold shadow-2xs'
          : 'border-line bg-surface text-ink-muted hover:border-line-strong hover:bg-hover hover:text-ink',
      )}
    >
      {children}
    </button>
  );
}

export function ActivityFilters() {
  const agents = useAgentStore((s) => s.agents);
  const { filterAgent, filterType, setFilterAgent, setFilterType, fetchActivities } =
    useActivityStore();

  const applyFilters = (agentId: string | null, type: ActivityType | null) => {
    setFilterAgent(agentId);
    setFilterType(type);
    fetchActivities({
      agentId: agentId || undefined,
      type: type || undefined,
      limit: 100,
    });
  };

  const hasActiveFilters = Boolean(filterAgent || filterType);

  return (
    <div className="space-y-4">
      {/* Agent Filter Row */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-2xs font-bold uppercase tracking-wider text-ink-muted flex items-center gap-1.5">
            <Bot size={12} className="text-brand-500" />
            Agent Filter
          </span>
          {filterAgent && (
            <button
              type="button"
              onClick={() => applyFilters(null, filterType)}
              className="text-2xs text-brand-600 dark:text-brand-400 hover:underline font-bold cursor-pointer flex items-center gap-1"
            >
              <X size={10} /> Reset Agent
            </button>
          )}
        </div>
        <div className="flex items-center gap-2 overflow-x-auto pb-1.5 no-scrollbar scroll-smooth">
          <FilterPill active={!filterAgent} onClick={() => applyFilters(null, filterType)}>
            All Agents
          </FilterPill>
          {agents.map((agent) => (
            <FilterPill
              key={agent.id}
              active={filterAgent === agent.id}
              onClick={() => applyFilters(agent.id, filterType)}
            >
              <Avatar name={agent.displayName} emoji={agent.avatar} size="xs" />
              <span className="truncate max-w-[180px] sm:max-w-none">{agent.displayName}</span>
            </FilterPill>
          ))}
        </div>
      </div>

      {/* Event Type Filter Row */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-2xs font-bold uppercase tracking-wider text-ink-muted flex items-center gap-1.5">
            <Layers size={12} className="text-brand-500" />
            Event Type
          </span>
          {filterType && (
            <button
              type="button"
              onClick={() => applyFilters(filterAgent, null)}
              className="text-2xs text-brand-600 dark:text-brand-400 hover:underline font-bold cursor-pointer flex items-center gap-1"
            >
              <X size={10} /> Reset Type
            </button>
          )}
        </div>
        <div className="flex items-center gap-2 overflow-x-auto pb-1.5 no-scrollbar scroll-smooth">
          {activityTypes.map((type) => {
            const Icon = type.value ? activityIconFor(type.value) : null;
            const t = type.value ? tones[activityToneFor(type.value)] : null;
            return (
              <FilterPill
                key={type.value ?? 'all'}
                active={filterType === type.value}
                activeClass={t ? cn(t.soft, t.text, 'border-current font-bold') : undefined}
                onClick={() => applyFilters(filterAgent, type.value)}
              >
                {Icon && <Icon size={12} strokeWidth={2.2} aria-hidden />}
                <span>{type.label}</span>
              </FilterPill>
            );
          })}
        </div>
      </div>
    </div>
  );
}

