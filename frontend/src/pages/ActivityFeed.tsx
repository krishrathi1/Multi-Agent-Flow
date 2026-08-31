import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Activity as ActivityIcon, Inbox } from 'lucide-react';
import { ActivityItem } from '../components/activity/ActivityItem';
import { ActivityFilters } from '../components/activity/ActivityFilters';
import { PageHeader } from '../components/ui/PageHeader';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { EmptyState, SkeletonRows } from '../components/ui/States';
import { useActivityStore } from '../stores/activity-store';
import { useUiStore } from '../stores/ui-store';
import { useProcessStore } from '../stores/process-store';
import { ProcessScope } from '../components/process/ProcessScope';
import { formatNumber } from '../lib/design';

export function ActivityFeed() {
  const { activities, total, loading, filterAgent, filterType, fetchActivities } =
    useActivityStore();
  const socketConnected = useUiStore((s) => s.socketConnected);
  const { scopeId, setScope, processes } = useProcessStore();
  const [searchParams] = useSearchParams();

  // Deep links like /activity?processId=… set the shared scope on arrival.
  const linkedProcess = searchParams.get('processId');
  useEffect(() => {
    if (linkedProcess && linkedProcess !== scopeId) setScope(linkedProcess);
  }, [linkedProcess, scopeId, setScope]);

  useEffect(() => {
    fetchActivities({
      agentId: filterAgent || undefined,
      type: filterType || undefined,
      processId: scopeId || undefined,
      limit: 100,
    });
  }, [fetchActivities, filterAgent, filterType, scopeId]);

  const activeProcess = processes.find((p) => p.id === scopeId) ?? null;

  return (
    <>
      <PageHeader
        icon={ActivityIcon}
        title="Activity Feed"
        description="Live stream of every agent event."
        badge={
          <Badge tone={socketConnected ? 'success' : 'neutral'} dot pulse={socketConnected}>
            {socketConnected ? 'Live' : 'Offline'}
          </Badge>
        }
        actions={<ProcessScope align="right" />}
      />

      <Card>
        <ActivityFilters />
      </Card>

      <div className="mb-3 mt-6">
        <p className="text-sm text-ink-subtle">
          <span className="font-medium tabular-nums text-ink">{formatNumber(total)}</span>{' '}
          event{total === 1 ? '' : 's'}
          {activeProcess && (
            <>
              {' '}in <span className="font-medium text-ink">{activeProcess.name}</span>
            </>
          )}
          {(filterAgent || filterType) && ' matching filters'}
        </p>
      </div>

      {loading && activities.length === 0 ? (
        <SkeletonRows rows={8} />
      ) : activities.length === 0 ? (
        <Card padding="none">
          <EmptyState
            icon={Inbox}
            title="No events found"
            description={
              filterAgent || filterType || activeProcess
                ? 'No activity matches the current filters.'
                : 'Events will stream in here as your agents start reporting.'
            }
          />
        </Card>
      ) : (
        <ul className="space-y-2">
          {activities.map((activity, idx) => (
            <li key={activity.id || `feed-act-${idx}-${activity.createdAt || Date.now()}`}>
              <ActivityItem activity={activity} />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
