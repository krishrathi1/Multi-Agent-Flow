import { useAgentStore } from '../../stores/agent-store';
import { useActivityStore } from '../../stores/activity-store';
import { cn } from '../../lib/utils';
import { activityIconFor, activityToneFor, tones } from '../../lib/design';
import { Avatar } from '../ui/Avatar';
import type { ActivityType } from '../../types';

const activityTypes: Array<{ value: ActivityType | null; label: string }> = [
  { value: null, label: 'All' },
  { value: 'HEARTBEAT', label: 'Heartbeat' },
  { value: 'TASK_START', label: 'Task Start' },
  { value: 'TASK_COMPLETE', label: 'Completed' },
  { value: 'ERROR', label: 'Errors' },
  { value: 'ALERT', label: 'Alerts' },
  { value: 'DELEGATION', label: 'Delegation' },
  { value: 'MESSAGE', label: 'Messages' },
];

function Pill({
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
        'inline-flex h-7 shrink-0 items-center gap-1.5 rounded-full border px-3 text-xs font-medium cursor-pointer',
        'transition-colors duration-150 select-none whitespace-nowrap',
        active
          ? activeClass ?? 'border-brand-500/35 bg-brand-500/15 text-brand-600 dark:text-brand-300 font-semibold shadow-2xs'
          : 'border-line bg-raised text-ink-subtle hover:border-line-strong hover:text-ink',
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

  return (
    <div className="space-y-3.5">
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <p className="text-2xs font-bold uppercase tracking-wider text-ink-faint">
            Agent
          </p>
          {filterAgent && (
            <button
              type="button"
              onClick={() => applyFilters(null, filterType)}
              className="text-2xs text-brand-600 dark:text-brand-400 hover:underline font-semibold cursor-pointer"
            >
              Clear Agent
            </button>
          )}
        </div>
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar scroll-smooth">
          <Pill active={!filterAgent} onClick={() => applyFilters(null, filterType)}>
            All agents
          </Pill>
          {agents.map((agent) => (
            <Pill
              key={agent.id}
              active={filterAgent === agent.id}
              onClick={() => applyFilters(agent.id, filterType)}
            >
              <Avatar name={agent.displayName} emoji={agent.avatar} size="xs" />
              <span>{agent.displayName}</span>
            </Pill>
          ))}
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-1.5">
          <p className="text-2xs font-bold uppercase tracking-wider text-ink-faint">
            Event type
          </p>
          {filterType && (
            <button
              type="button"
              onClick={() => applyFilters(filterAgent, null)}
              className="text-2xs text-brand-600 dark:text-brand-400 hover:underline font-semibold cursor-pointer"
            >
              Clear Type
            </button>
          )}
        </div>
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar scroll-smooth">
          {activityTypes.map((type) => {
            const Icon = type.value ? activityIconFor(type.value) : null;
            const t = type.value ? tones[activityToneFor(type.value)] : null;
            return (
              <Pill
                key={type.value ?? 'all'}
                active={filterType === type.value}
                activeClass={t ? cn(t.soft, t.text) : undefined}
                onClick={() => applyFilters(filterAgent, type.value)}
              >
                {Icon && <Icon size={12} strokeWidth={2} aria-hidden />}
                <span>{type.label}</span>
              </Pill>
            );
          })}
        </div>
      </div>
    </div>
  );
}
