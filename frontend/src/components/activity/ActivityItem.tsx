import type { Activity } from '../../types';
import { timeAgo, cn } from '../../lib/utils';
import { activityIconFor, activityToneFor, activityLabel, tones } from '../../lib/design';
import { Avatar } from '../ui/Avatar';

export function ActivityItem({ activity }: { activity: Activity }) {
  const tone = activityToneFor(activity.type);
  const Icon = activityIconFor(activity.type);
  const t = tones[tone];

  return (
    <div
      className={cn(
        'flex items-start gap-3 rounded-lg border border-line-subtle',
        'bg-surface p-3.5 transition-colors duration-150 hover:bg-raised',
      )}
    >
      {/* Type icon carries the colour; the label repeats it in text so the
          meaning survives without colour perception. */}
      <span
        className={cn(
          'mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-md border',
          t.soft,
          t.text,
        )}
      >
        <Icon size={15} strokeWidth={1.75} aria-hidden />
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <Avatar
            name={activity.agent.displayName}
            emoji={activity.agent.avatar}
            size="xs"
          />
          <span className="text-sm font-medium text-ink">
            {activity.agent.displayName}
          </span>
          <span className={cn('text-2xs font-semibold uppercase tracking-[0.07em]', t.text)}>
            {activityLabel[activity.type] ?? activity.type.replace(/_/g, ' ')}
          </span>
        </div>
        <p className="mt-1 text-base leading-relaxed text-ink-muted">
          {activity.message}
        </p>
      </div>

      <time
        className="shrink-0 whitespace-nowrap pt-0.5 text-xs tabular-nums text-ink-faint"
        dateTime={activity.createdAt}
      >
        {timeAgo(activity.createdAt)}
      </time>
    </div>
  );
}
