import { Link } from 'react-router-dom';
import { ArrowUpRight, Radio, Timer } from 'lucide-react';
import type { Agent } from '../../types';
import { timeAgo, cn } from '../../lib/utils';
import { agentStatusTone, agentStatusLabel } from '../../lib/design';
import { Avatar } from '../ui/Avatar';
import { Badge } from '../ui/Badge';

export function AgentCard({ agent }: { agent: Agent }) {
  const tone = agentStatusTone[agent.status];
  const isOnline = agent.status === 'ONLINE';

  return (
    <Link
      to={`/agents/${agent.id}`}
      className={cn(
        'group relative flex flex-col rounded-xl border border-line-subtle',
        'bg-surface p-4 shadow-e1',
        'transition-[border-color,background-color,box-shadow] duration-150',
        'hover:border-line-strong hover:bg-raised hover:shadow-e2',
      )}
    >
      <div className="flex items-start gap-3">
        <Avatar
          name={agent.displayName || agent.name}
          emoji={agent.avatar}
          size="md"
          status={tone}
          statusLabel={agentStatusLabel[agent.status]}
        />

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="truncate text-base font-semibold leading-tight text-ink">
                {agent.displayName}
              </h3>
              <p className="mt-0.5 truncate font-mono text-xs text-ink-faint">
                {agent.name}
              </p>
            </div>
            <ArrowUpRight
              size={15}
              strokeWidth={1.75}
              className="mt-0.5 shrink-0 text-ink-faint opacity-0 transition-opacity group-hover:opacity-100"
              aria-hidden
            />
          </div>
        </div>
      </div>

      {agent.description && (
        <p className="mt-3 line-clamp-2 text-sm leading-relaxed text-ink-subtle">
          {agent.description}
        </p>
      )}

      {agent.currentTask && (
        <div className="mt-3 flex items-start gap-2 rounded-md border border-brand-500/20 bg-brand-500/[0.07] px-2.5 py-2">
          <Radio
            size={13}
            strokeWidth={1.75}
            className="mt-0.5 shrink-0 text-brand-700 dark:text-brand-300"
            aria-hidden
          />
          <span className="line-clamp-2 text-xs leading-relaxed text-brand-800 dark:text-brand-200">
            {agent.currentTask}
          </span>
        </div>
      )}

      {/* Footer pinned to the bottom so cards in a row align regardless of
          description length. */}
      <div className="mt-auto flex items-center justify-between gap-3 border-t border-line-subtle pt-3 text-xs text-ink-faint [&:not(:first-child)]:mt-4">
        <span className="flex items-center gap-1.5">
          <Timer size={12} strokeWidth={1.75} aria-hidden />
          {agent.heartbeatInterval > 0 ? `Every ${agent.heartbeatInterval}m` : 'Always on'}
        </span>
        <Badge tone={tone} dot pulse={isOnline}>
          {agent.lastHeartbeat ? timeAgo(agent.lastHeartbeat) : agentStatusLabel[agent.status]}
        </Badge>
      </div>
    </Link>
  );
}
