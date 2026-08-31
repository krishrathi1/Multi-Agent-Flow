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
        'inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-xs font-medium',
        'transition-colors duration-150',
        active
          ? activeClass ?? 'border-brand-500/35 bg-brand-500/15 text-brand-200'
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
    <div className="space-y-4">
      <div>
        <p className="mb-2 text-2xs font-semibold uppercase tracking-[0.09em] text-ink-faint">
          Agent
        </p>
        <div className="flex flex-wrap gap-1.5">
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
              {agent.displayName}
            </Pill>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-2 text-2xs font-semibold uppercase tracking-[0.09em] text-ink-faint">
          Event type
        </p>
        <div className="flex flex-wrap gap-1.5">
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
                {type.label}
              </Pill>
            );
          })}
        </div>
      </div>
    </div>
  );
}
