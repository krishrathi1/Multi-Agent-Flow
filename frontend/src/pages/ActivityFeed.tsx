import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Activity as ActivityIcon,
  Inbox,
  RefreshCw,
  Layers,
  Sparkles,
  Filter,
  CheckCircle2,
  AlertCircle,
  MessageSquare,
  Bot,
} from 'lucide-react';
import { ActivityItem } from '@/components/activity/ActivityItem';
import { PageHeader } from '@/components/ui/PageHeader';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { useActivityStore } from '@/stores/activity-store';
import { useUiStore } from '@/stores/ui-store';
import { useProcessStore } from '@/stores/process-store';
import { ProcessScope } from '@/components/process/ProcessScope';
import { formatNumber } from '@/lib/design';
import { LiveWaveform } from '@/components/ui/LiveIcon';
import { HourglassLoader } from '@/components/ui/HourglassLoader';
import { cn } from '@/lib/utils';
import type { Activity, ActivityType } from '@/types';

export function ActivityFeed() {
  const { activities, total, loading, filterAgent, filterType, fetchActivities, setFilterType } =
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

  // Group events by Day: TODAY, YESTERDAY, EARLIER
  const groupedActivities = useMemo(() => {
    const today = new Date().toDateString();
    const yesterday = new Date(Date.now() - 86400000).toDateString();

    const groups: { title: string; items: Activity[] }[] = [
      { title: 'Today', items: [] },
      { title: 'Yesterday', items: [] },
      { title: 'Earlier', items: [] },
    ];

    for (const a of activities) {
      const itemDate = new Date(a.createdAt).toDateString();
      if (itemDate === today) groups[0].items.push(a);
      else if (itemDate === yesterday) groups[1].items.push(a);
      else groups[2].items.push(a);
    }

    return groups.filter((g) => g.items.length > 0);
  }, [activities]);

  const filterOptions: { id: ActivityType | ''; label: string }[] = [
    { id: '', label: 'All Events' },
    { id: 'TASK_COMPLETE', label: 'Tasks' },
    { id: 'MESSAGE', label: 'Messages' },
    { id: 'ERROR', label: 'Errors' },
    { id: 'DELEGATION', label: 'Delegations' },
  ];

  return (
    <div className="space-y-4 sm:space-y-6 max-w-5xl mx-auto pb-16">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-brand-500/10 text-brand-600 dark:text-brand-400 border border-brand-500/20 flex items-center justify-center shrink-0">
            <ActivityIcon size={17} />
          </div>
          <div>
            <h1 className="text-base sm:text-lg font-bold text-ink tracking-tight flex items-center gap-2">
              Activity Feed
              <Badge tone={socketConnected ? 'success' : 'neutral'} dot pulse={socketConnected}>
                {socketConnected ? 'Live Stream' : 'Offline'}
              </Badge>
            </h1>
            <p className="text-2xs text-ink-muted">Real-time telemetry traces, deliverable signals, and audit trail</p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <ProcessScope align="right" />
          <Button
            variant="secondary"
            size="xs"
            icon={RefreshCw}
            loading={loading}
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
      </div>

      {/* KPI Metric Strip */}
      <div className="grid grid-cols-3 gap-2.5 sm:gap-3.5">
        <div className="p-3 sm:p-4 rounded-2xl border border-line-subtle bg-surface shadow-2xs space-y-1">
          <span className="text-2xs font-bold uppercase tracking-wider text-ink-muted block">Total Events</span>
          <div className="text-lg sm:text-xl font-bold font-mono text-ink">{formatNumber(total)}</div>
          <span className="text-[10px] text-ink-faint font-mono block">Recorded signals</span>
        </div>

        <div className="p-3 sm:p-4 rounded-2xl border border-line-subtle bg-surface shadow-2xs space-y-1">
          <span className="text-2xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 block">Stream Status</span>
          <div className="text-lg sm:text-xl font-bold font-mono text-emerald-600 dark:text-emerald-400">
            {socketConnected ? 'Connected' : 'Syncing'}
          </div>
          <span className="text-[10px] text-ink-faint font-mono block">Socket.IO room</span>
        </div>

        <div className="p-3 sm:p-4 rounded-2xl border border-line-subtle bg-surface shadow-2xs space-y-1">
          <span className="text-2xs font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400 block">Scope</span>
          <div className="text-xs sm:text-sm font-bold font-mono text-ink truncate mt-1">
            {activeProcess ? activeProcess.name : 'All Chains'}
          </div>
          <span className="text-[10px] text-ink-faint font-mono block truncate">Current filter</span>
        </div>
      </div>

      {/* Filter Chips Bar */}
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
        {filterOptions.map((opt) => (
          <button
            key={opt.id}
            type="button"
            onClick={() => setFilterType(opt.id ? (opt.id as ActivityType) : null)}
            className={cn(
              'shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer shadow-2xs',
              (filterType === opt.id || (!filterType && opt.id === ''))
                ? 'bg-brand-600 text-white shadow-xs'
                : 'border border-line bg-surface text-ink-muted hover:text-ink hover:bg-hover'
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Grouped Chronological Stream */}
      {loading && activities.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20">
          <HourglassLoader size={48} label="Connecting to agent event stream..." />
        </div>
      ) : groupedActivities.length === 0 ? (
        <div className="rounded-3xl border border-line-subtle bg-surface p-12 text-center shadow-2xs">
          <Inbox size={32} className="mx-auto mb-2 text-ink-faint opacity-50" />
          <h3 className="text-xs font-bold text-ink mb-1">No Events Found</h3>
          <p className="text-2xs text-ink-muted max-w-sm mx-auto">
            {filterAgent || filterType || activeProcess
              ? 'No agent activity matches the current filter criteria.'
              : 'Live agent events, task executions, and telemetry heartbeats stream in here automatically.'}
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {groupedActivities.map((group) => (
            <div key={group.title} className="space-y-2.5">
              <span className="text-2xs font-bold uppercase tracking-wider text-ink-muted px-1 block sticky top-0 bg-canvas/80 backdrop-blur-xs py-1 z-10">
                {group.title} ({group.items.length})
              </span>

              <ul className="space-y-2.5">
                {group.items.map((activity, idx) => (
                  <li key={activity.id || `feed-act-${idx}-${activity.createdAt || Date.now()}`}>
                    <ActivityItem activity={activity} />
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
