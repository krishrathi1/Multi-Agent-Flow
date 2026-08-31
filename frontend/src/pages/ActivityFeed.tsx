import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Activity as ActivityIcon, Inbox, RefreshCw, Layers } from 'lucide-react';
import { ActivityItem } from '../components/activity/ActivityItem';
import { ActivityFilters } from '../components/activity/ActivityFilters';
import { PageHeader } from '../components/ui/PageHeader';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { useActivityStore } from '../stores/activity-store';
import { useUiStore } from '../stores/ui-store';
import { useProcessStore } from '../stores/process-store';
import { ProcessScope } from '../components/process/ProcessScope';
import { formatNumber } from '../lib/design';
import { LiveWaveform } from '../components/ui/LiveIcon';
import { HourglassLoader } from '../components/ui/HourglassLoader';

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
    <div className="space-y-6">
      <PageHeader
        icon={ActivityIcon}
        title="Activity Feed"
        description="Real-time multi-agent event stream, execution traces, and telemetry signals"
        badge={
          <Badge tone={socketConnected ? 'success' : 'neutral'} dot pulse={socketConnected}>
            {socketConnected ? 'Live Stream' : 'Offline'}
          </Badge>
        }
        actions={
          <div className="flex items-center gap-2.5">
            <ProcessScope align="right" />
            <Button
              variant="secondary"
              icon={RefreshCw}
              onClick={() =>
                fetchActivities({
                  agentId: filterAgent || undefined,
                  type: filterType || undefined,
                  processId: scopeId || undefined,
                  limit: 100,
                })
              }
            >
              Refresh
            </Button>
          </div>
        }
      />

      {/* Filter Toolbar Container */}
      <div className="rounded-2xl border border-line-subtle bg-surface p-4 sm:p-5 shadow-xs">
        <ActivityFilters />
      </div>

      {/* Feed Status Header */}
      <div className="flex items-center justify-between gap-3 px-1">
        <div className="flex items-center gap-2">
          <p className="text-xs font-semibold text-ink-muted">
            <span className="font-bold text-ink font-mono">{formatNumber(total)}</span>{' '}
            event{total === 1 ? '' : 's'}
            {activeProcess && (
              <>
                {' '}in <span className="font-bold text-ink">{activeProcess.name}</span>
              </>
            )}
            {(filterAgent || filterType) && ' matching active filters'}
          </p>
        </div>
        <LiveWaveform color="bg-brand-500" />
      </div>

      {/* Activity List */}
      {loading && activities.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20">
          <HourglassLoader size={48} label="Connecting to agent event stream..." />
        </div>
      ) : activities.length === 0 ? (
        <div className="rounded-2xl border border-line-subtle bg-surface p-12 text-center shadow-xs">
          <Inbox size={32} className="mx-auto mb-2 text-ink-faint opacity-50" />
          <h3 className="text-xs font-bold text-ink mb-1">No Events Found</h3>
          <p className="text-xs text-ink-muted max-w-sm mx-auto">
            {filterAgent || filterType || activeProcess
              ? 'No agent activity matches the current filter criteria. Try resetting filters.'
              : 'Live agent events, task executions, and telemetry heartbeats will stream in here automatically.'}
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {activities.map((activity, idx) => (
            <li key={activity.id || `feed-act-${idx}-${activity.createdAt || Date.now()}`}>
              <ActivityItem activity={activity} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

