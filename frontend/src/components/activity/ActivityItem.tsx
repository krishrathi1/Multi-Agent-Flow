import type { Activity } from '../../types';
import { timeAgo, cn } from '../../lib/utils';
import { activityIconFor, activityToneFor, activityLabel, tones } from '../../lib/design';
import { Avatar } from '../ui/Avatar';
import { Clock } from 'lucide-react';

export function ActivityItem({ activity }: { activity: Activity }) {
  const tone = activityToneFor(activity.type);
  const Icon = activityIconFor(activity.type);
  const t = tones[tone];
  const agentName = activity.agent?.displayName || 'System / Mother Core';
  const agentAvatar = activity.agent?.avatar;

  return (
    <div
      className={cn(
        'flex items-start gap-3.5 rounded-2xl border border-line-subtle',
        'bg-surface p-4 transition-all duration-150 hover:bg-raised hover:border-line-strong hover:shadow-xs shadow-2xs',
      )}
    >
      {/* Type icon */}
      <span
        className={cn(
          'mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full border shadow-2xs',
          t.soft,
          t.text,
        )}
      >
        <Icon size={16} strokeWidth={2.2} aria-hidden />
      </span>

      <div className="min-w-0 flex-1 space-y-1.5">
        {/* Top Header: Agent Avatar + Name + Time */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2 min-w-0">
            <Avatar
              name={agentName}
              emoji={agentAvatar}
              size="xs"
            />
            <span className="text-xs font-bold text-ink truncate">
              {agentName}
            </span>
            <span
              className={cn(
                'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border',
                t.soft,
                t.text,
              )}
            >
              {(activity.type && activityLabel[activity.type]) ||
                (activity.type ? String(activity.type).replace(/_/g, ' ') : 'EVENT')}
            </span>
          </div>

          <time
            className="shrink-0 whitespace-nowrap text-2xs tabular-nums text-ink-muted font-mono font-medium flex items-center gap-1"
            dateTime={activity.createdAt}
          >
            <Clock size={11} className="text-ink-faint" />
            {timeAgo(activity.createdAt)}
          </time>
        </div>

        {/* Message Content */}
        <p className="text-xs leading-relaxed text-ink font-medium break-words">
          {activity.message}
        </p>

        {/* Optional details/metadata if present */}
        {activity.metadata && Object.keys(activity.metadata).length > 0 && (
          <div className="pt-1">
            <pre className="text-[11px] font-mono bg-inset/80 p-3 rounded-xl border border-line-subtle text-ink font-medium overflow-x-auto no-scrollbar">
              {JSON.stringify(activity.metadata, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}

