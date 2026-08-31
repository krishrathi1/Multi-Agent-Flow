import type { Activity } from '../../types';
import { timeAgo, cn } from '../../lib/utils';
import { activityIconFor, activityToneFor, activityLabel, tones } from '../../lib/design';
import { Avatar } from '../ui/Avatar';

export function ActivityItem({ activity }: { activity: Activity }) {
  const tone = activityToneFor(activity.type);
  const Icon = activityIconFor(activity.type);
  const t = tones[tone];
  const agentName = activity.agent?.displayName || 'System / Mother Core';
  const agentAvatar = activity.agent?.avatar;

  return (
    <div
      className={cn(
        'flex items-start gap-3 rounded-2xl border border-line-subtle',
        'bg-surface p-3.5 sm:p-4 transition-all duration-150 hover:bg-raised hover:border-line shadow-2xs',
      )}
    >
      {/* Type icon */}
      <span
        className={cn(
          'mt-0.5 grid h-8 w-8 sm:h-9 sm:w-9 shrink-0 place-items-center rounded-xl border shadow-2xs',
          t.soft,
          t.text,
        )}
      >
        <Icon size={16} strokeWidth={2} aria-hidden />
      </span>

      <div className="min-w-0 flex-1 space-y-1">
        {/* Top Header: Agent Avatar + Name + Time */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Avatar
              name={agentName}
              emoji={agentAvatar}
              size="xs"
            />
            <span className="text-xs sm:text-sm font-bold text-ink truncate">
              {agentName}
            </span>
          </div>

          <time
            className="shrink-0 whitespace-nowrap text-2xs tabular-nums text-ink-faint font-medium"
            dateTime={activity.createdAt}
          >
            {timeAgo(activity.createdAt)}
          </time>
        </div>

        {/* Event Type Pill */}
        <div>
          <span
            className={cn(
              'inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border',
              t.soft,
              t.text,
            )}
          >
            {(activity.type && activityLabel[activity.type]) ||
              (activity.type ? String(activity.type).replace(/_/g, ' ') : 'EVENT')}
          </span>
        </div>

        {/* Message Content */}
        <p className="text-xs sm:text-sm leading-relaxed text-ink-muted break-words pt-0.5">
          {activity.message}
        </p>
      </div>
    </div>
  );
}
