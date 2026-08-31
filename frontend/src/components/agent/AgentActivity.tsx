import { History } from 'lucide-react';
import type { Activity } from '../../types';
import { timeAgo, cn } from '../../lib/utils';
import { activityIconFor, activityToneFor, activityLabel, tones } from '../../lib/design';
import { Card, CardHeader } from '../ui/Card';
import { EmptyState } from '../ui/States';

export function AgentActivity({ activities }: { activities: Activity[] }) {
  return (
    <Card padding="none">
      <CardHeader
        bordered
        icon={History}
        title="Recent Activity"
        description={`${activities.length} event${activities.length === 1 ? '' : 's'}`}
      />

      {activities.length === 0 ? (
        <EmptyState
          compact
          icon={History}
          title="No recent activity"
          description="This agent hasn't reported any events yet."
        />
      ) : (
        <ul className="max-h-[520px] overflow-y-auto p-2">
          {activities.map((activity) => {
            const tone = activityToneFor(activity.type);
            const Icon = activityIconFor(activity.type);
            const t = tones[tone];

            return (
              <li
                key={activity.id}
                className="flex items-start gap-2.5 rounded-md p-2 transition-colors hover:wash"
              >
                <span
                  className={cn(
                    'mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-sm border',
                    t.soft,
                    t.text,
                  )}
                >
                  <Icon size={13} strokeWidth={1.75} aria-hidden />
                </span>

                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <span
                      className={cn(
                        'text-2xs font-semibold uppercase tracking-[0.06em]',
                        t.text,
                      )}
                    >
                      {activityLabel[activity.type] ?? activity.type.replace(/_/g, ' ')}
                    </span>
                    <time
                      className="text-2xs tabular-nums text-ink-faint"
                      dateTime={activity.createdAt}
                    >
                      {timeAgo(activity.createdAt)}
                    </time>
                  </div>
                  <p className="mt-0.5 text-sm leading-relaxed text-ink-muted">
                    {activity.message}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
