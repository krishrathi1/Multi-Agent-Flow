import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity as ActivityIcon,
  ArrowRight,
  Bot,
  CircleDot,
  Cpu,
  Radio,
  Sparkles,
  Workflow,
  Zap,
} from 'lucide-react';
import { useActivityStore } from '../../stores/activity-store';
import { useAgentStore } from '../../stores/agent-store';
import { useProcessStore } from '../../stores/process-store';
import { useUiStore } from '../../stores/ui-store';
import { timeAgo, cn } from '../../lib/utils';
import { activityIconFor, activityToneFor, activityLabel, tones } from '../../lib/design';
import { Card, CardHeader } from '../ui/Card';
import { Skeleton } from '../ui/States';

const FEED_LIMIT = 8;

export function SystemHealth() {
  const { activities, fetchActivities, loading } = useActivityStore();
  const socketConnected = useUiStore((s) => s.socketConnected);
  const stats = useAgentStore((s) => s.stats);
  const processes = useProcessStore((s) => s.processes);

  useEffect(() => {
    fetchActivities({ limit: FEED_LIMIT });
  }, [fetchActivities]);

  const items = activities.slice(0, FEED_LIMIT);
  const activeProcesses = processes.filter((p) => p.status === 'ACTIVE').length;

  return (
    <div className="space-y-4">
      {/* ── 1. Live Telemetry Summary ── */}
      <Card padding="sm" className="space-y-3 border border-line shadow-xs">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-ink-muted flex items-center gap-1.5">
            <Radio size={13} className={socketConnected ? 'text-emerald-500 animate-pulse' : 'text-amber-500'} />
            <span>Gateway Telemetry</span>
          </span>
          <span
            className={cn(
              'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold',
              socketConnected
                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20',
            )}
          >
            <span className={cn('h-1.5 w-1.5 rounded-full', socketConnected ? 'bg-emerald-500' : 'bg-amber-500')} />
            {socketConnected ? 'LIVE STREAM' : 'DISCONNECTED'}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="rounded-lg bg-inset/60 p-2 border border-line-subtle">
            <p className="text-[10px] text-ink-muted font-medium">Active Chains</p>
            <p className="text-sm font-bold text-ink mt-0.5 tabular-nums">
              {activeProcesses}{' '}
              <span className="text-[11px] font-normal text-ink-faint">/ {processes.length}</span>
            </p>
          </div>

          <div className="rounded-lg bg-inset/60 p-2 border border-line-subtle">
            <p className="text-[10px] text-ink-muted font-medium">Fleet Online</p>
            <p className="text-sm font-bold text-ink mt-0.5 tabular-nums">
              {stats?.online ?? 0}{' '}
              <span className="text-[11px] font-normal text-ink-faint">/ {stats?.total ?? 0}</span>
            </p>
          </div>
        </div>
      </Card>

      {/* ── 2. Real-Time Activity Feed ── */}
      <Card padding="none" className="flex flex-col border border-line shadow-xs overflow-hidden">
        <CardHeader
          bordered
          icon={ActivityIcon}
          title="Live Operations Feed"
          description="Real-time event stream from autonomous agents"
          actions={
            <Link
              to="/activity"
              className="flex items-center gap-1 rounded-md text-xs font-semibold text-brand-600 dark:text-brand-400 transition-colors hover:underline"
            >
              View all
              <ArrowRight size={12} strokeWidth={2} aria-hidden />
            </Link>
          }
        />

        <div className="max-h-[440px] overflow-y-auto p-2.5 space-y-1.5 scrollbar-thin scrollbar-thumb-line scrollbar-track-transparent">
          {loading && items.length === 0 ? (
            <div className="space-y-2 p-1.5">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-start gap-2.5 p-1.5">
                  <Skeleton className="h-6 w-6 rounded-md" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-2.5 w-1/2" />
                    <Skeleton className="h-2.5 w-4/5" />
                  </div>
                </div>
              ))}
            </div>
          ) : items.length === 0 ? (
            <div className="py-8 px-4 text-center">
              <div className="mx-auto mb-2.5 grid h-9 w-9 place-items-center rounded-xl bg-brand-500/10 text-brand-500">
                <Radio size={18} className="animate-pulse" />
              </div>
              <p className="text-xs font-bold text-ink">Live Feed Active</p>
              <p className="mt-1 text-[11px] text-ink-muted leading-relaxed">
                Listening for real-time agent messages, stage handoffs, and execution logs.
              </p>
            </div>
          ) : (
            <ul className="space-y-1.5">
              {items.map((activity) => {
                const tone = activityToneFor(activity.type);
                const Icon = activityIconFor(activity.type);
                const t = tones[tone];

                return (
                  <li
                    key={activity.id}
                    className="flex items-start gap-2.5 rounded-lg border border-line-subtle/70 bg-surface p-2.5 transition-all hover:border-line hover:shadow-2xs"
                  >
                    <span
                      className={cn(
                        'mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-md border',
                        t.soft,
                        t.text,
                      )}
                    >
                      <Icon size={12} strokeWidth={2} aria-hidden />
                    </span>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline gap-1.5">
                        <span className="truncate text-xs font-bold text-ink">
                          {activity.agent?.displayName || 'System'}
                        </span>
                        <span
                          className={cn(
                            'shrink-0 text-[10px] font-bold uppercase tracking-wider',
                            t.text,
                          )}
                        >
                          {(activity.type && activityLabel[activity.type]) ||
                            (activity.type ? String(activity.type).replace(/_/g, ' ') : 'EVENT')}
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs leading-relaxed text-ink-muted line-clamp-2">
                        {activity.message}
                      </p>
                    </div>

                    <time
                      className="shrink-0 whitespace-nowrap pt-0.5 text-[10px] tabular-nums text-ink-faint"
                      dateTime={activity.createdAt}
                    >
                      {timeAgo(activity.createdAt)}
                    </time>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </Card>
    </div>
  );
}
