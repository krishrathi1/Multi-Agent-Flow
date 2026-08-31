import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Ban,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  Clock,
  GitCompareArrows,
  History,
  Play,
  RefreshCw,
  ShieldCheck,
  Timer,
  XCircle,
  Zap,
} from 'lucide-react';
import { api } from '../lib/api';
import { cn, timeAgo } from '../lib/utils';
import { formatCompact, formatCurrency, formatMs, tones, type Tone } from '../lib/design';
import type { ProcessRun, PersistedRunState, RunStats } from '../types';
import { PageHeader } from '../components/ui/PageHeader';
import { Card, CardHeader } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge, Chip } from '../components/ui/Badge';
import { StatCard } from '../components/ui/StatCard';
import { EmptyState, SkeletonRows, Spinner } from '../components/ui/States';
import { Tabs } from '../components/ui/Tabs';
import { RunCompareModal } from '../components/process/RunCompareModal';

const stateTone: Record<PersistedRunState, Tone> = {
  QUEUED: 'neutral',
  RUNNING: 'info',
  AWAITING_APPROVAL: 'warning',
  COMPLETED: 'success',
  FAILED: 'danger',
  CANCELLED: 'warning',
};



const stateIcon: Record<PersistedRunState, typeof CheckCircle2> = {
  QUEUED: Clock,
  RUNNING: Play,
  AWAITING_APPROVAL: ShieldCheck,
  COMPLETED: CheckCircle2,
  FAILED: XCircle,
  CANCELLED: Ban,
};

/* A run state arriving from a newer server must not blank the page — this is
   exactly how AWAITING_APPROVAL broke it. Fall back instead of indexing null. */
const toneFor = (state: PersistedRunState): Tone => stateTone[state] ?? 'neutral';
const iconFor = (state: PersistedRunState) => stateIcon[state] ?? Clock;

const triggerIcon = {
  MANUAL: Play,
  SCHEDULED: CalendarClock,
  WEBHOOK: Zap,
  RETRY: RefreshCw,
} as const;

type Filter = 'all' | PersistedRunState;

/** Expandable row showing a run and, when opened, its per-stage detail. */
function RunRow({ run }: { run: ProcessRun }) {
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState<ProcessRun | null>(null);
  const [loading, setLoading] = useState(false);

  const tone = toneFor(run.state);
  const Icon = iconFor(run.state);
  const TriggerIcon = triggerIcon[run.trigger] ?? Play;

  const toggle = async () => {
    const next = !open;
    setOpen(next);
    // Fetch step detail lazily — the list only carries counts.
    if (next && !detail) {
      setLoading(true);
      try {
        setDetail(await api.orchestration.run(run.id));
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <li className="overflow-hidden rounded-xl border border-line-subtle bg-surface">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        className="flex w-full items-center gap-3 p-3.5 text-left transition-colors hover:bg-raised"
      >
        <ChevronRight
          size={15}
          strokeWidth={2}
          className={cn(
            'shrink-0 text-ink-faint transition-transform duration-150',
            open && 'rotate-90',
          )}
          aria-hidden
        />
        <span
          className={cn(
            'grid h-8 w-8 shrink-0 place-items-center rounded-md border',
            tones[tone].soft,
            tones[tone].text,
          )}
        >
          <Icon size={15} strokeWidth={1.75} aria-hidden />
        </span>

        <span className="min-w-0 flex-1">
          <span className="block truncate text-base font-medium text-ink">
            {run.process?.name ?? 'Production'}
          </span>
          <span className="mt-0.5 flex flex-wrap items-center gap-2 text-2xs text-ink-faint">
            <span className="inline-flex items-center gap-1">
              <TriggerIcon size={10} strokeWidth={2} aria-hidden />
              {run.trigger.toLowerCase()}
            </span>
            <span>·</span>
            <span>{timeAgo(run.startedAt)}</span>
            {run.error && (
              <>
                <span>·</span>
                <span className="text-amber-700 dark:text-amber-300">{run.error}</span>
              </>
            )}
          </span>
        </span>

        <span className="hidden shrink-0 items-center gap-4 text-xs tabular-nums text-ink-subtle sm:flex">
          <span title="Stages run">{run._count?.steps ?? run.steps?.length ?? 0} steps</span>
          <span title="Duration">{run.durationMs ? formatMs(run.durationMs) : '—'}</span>
          <span title="Tokens">{formatCompact(run.totalTokens)}</span>
          <span title="Cost" className="font-medium text-ink">
            {formatCurrency(run.totalCostUsd)}
          </span>
        </span>

        <Badge tone={tone} className="shrink-0">
          {run.state.toLowerCase()}
        </Badge>
      </button>

      {open && (
        <div className="border-t border-line-subtle bg-inset p-3">
          {loading ? (
            <div className="flex justify-center py-4">
              <Spinner />
            </div>
          ) : detail?.steps?.length ? (
            <ul className="space-y-2">
              {detail.steps.map((s) => {
                const st = toneFor(s.state);
                const SIcon = iconFor(s.state);
                return (
                  <li key={s.id} className="rounded-lg border border-line-subtle bg-surface p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <SIcon size={13} className={tones[st].text} aria-hidden />
                      <span className="text-sm font-medium text-ink">{s.agentName}</span>
                      <Chip>stage {s.stage}</Chip>
                      <span className="ml-auto text-2xs tabular-nums text-ink-faint">
                        {formatMs(s.durationMs)} · {formatCompact(s.tokens)} tok ·{' '}
                        {formatCurrency(s.costUsd)}
                      </span>
                    </div>
                    {s.summary && (
                      <p className="mt-1.5 line-clamp-3 whitespace-pre-wrap text-xs leading-relaxed text-ink-subtle">
                        {s.summary}
                      </p>
                    )}
                    {s.error && (
                      <p className="mt-1.5 text-xs text-red-600 dark:text-red-300">{s.error}</p>
                    )}
                    {Array.isArray(s.files) && s.files.length > 0 && (
                      <p className="mt-1.5 flex flex-wrap gap-1">
                        {s.files.map((f) => (
                          <span
                            key={f}
                            className="rounded bg-white/[0.06] px-1.5 py-0.5 font-mono text-2xs text-ink-subtle"
                          >
                            {f}
                          </span>
                        ))}
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="py-3 text-center text-xs text-ink-faint">No step detail recorded.</p>
          )}
        </div>
      )}
    </li>
  );
}

export function Runs() {
  const [runs, setRuns] = useState<ProcessRun[]>([]);
  const [stats, setStats] = useState<RunStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>('all');
  const [comparing, setComparing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [r, s] = await Promise.all([
        api.orchestration.runs({ limit: 50 }),
        api.orchestration.runStats(),
      ]);
      setRuns(r);
      setStats(s);
    } catch (err) {
      console.error('Failed to load runs', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    // A run in flight changes state — keep the list fresh without a socket.
    const t = setInterval(load, 10_000);
    return () => clearInterval(t);
  }, [load]);

  const counts = useMemo(() => {
    const base: Record<string, number> = { all: runs.length };
    for (const r of runs) base[r.state] = (base[r.state] ?? 0) + 1;
    return base;
  }, [runs]);

  const visible = useMemo(
    () => (filter === 'all' ? runs : runs.filter((r) => r.state === filter)),
    [runs, filter],
  );

  const tabs = useMemo(
    () =>
      (
        [
          { value: 'all' as const, label: 'All', count: counts.all ?? 0 },
          { value: 'COMPLETED' as const, label: 'Completed', count: counts.COMPLETED ?? 0 },
          { value: 'RUNNING' as const, label: 'Running', count: counts.RUNNING ?? 0 },
          { value: 'FAILED' as const, label: 'Failed', count: counts.FAILED ?? 0 },
          { value: 'AWAITING_APPROVAL' as const, label: 'Awaiting approval', count: counts.AWAITING_APPROVAL ?? 0 },
          { value: 'CANCELLED' as const, label: 'Cancelled', count: counts.CANCELLED ?? 0 },
        ] satisfies { value: Filter; label: string; count: number }[]
      ).filter((t) => t.value === 'all' || t.count > 0),
    [counts],
  );

  return (
    <>
      <PageHeader
        icon={History}
        title="Run History"
        description="Every production-chain execution, with per-stage detail and spend."
        actions={
          <>
            <Button
              variant="secondary"
              icon={GitCompareArrows}
              disabled={runs.length < 2}
              onClick={() => setComparing(true)}
            >
              Compare
            </Button>
            <Button variant="secondary" icon={RefreshCw} onClick={load}>
              Refresh
            </Button>
          </>
        }
      />

      <RunCompareModal runs={runs} open={comparing} onClose={() => setComparing(false)} />

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatCard
          label="Total Runs"
          value={stats?.total ?? 0}
          icon={History}
          tone="brand"
          muted={(stats?.total ?? 0) === 0}
        />
        <StatCard
          label="Success Rate"
          value={`${stats?.successRate ?? 0}%`}
          sublabel={`${stats?.completed ?? 0} completed`}
          icon={CheckCircle2}
          tone={(stats?.successRate ?? 0) >= 80 ? 'success' : 'warning'}
          muted={(stats?.total ?? 0) === 0}
        />
        <StatCard
          label="Total Spend"
          value={formatCurrency(stats?.totalCostUsd ?? 0)}
          sublabel={`${formatCompact(stats?.totalTokens ?? 0)} tokens`}
          icon={CircleDollarSign}
          tone="accent"
          muted={(stats?.totalCostUsd ?? 0) === 0}
        />
        <StatCard
          label="Avg Duration"
          value={formatMs(stats?.avgDurationMs ?? 0)}
          icon={Timer}
          tone="info"
          muted={(stats?.avgDurationMs ?? 0) === 0}
        />
      </div>

      <div className="mt-6">
        <Card padding="none">
          <CardHeader
            bordered
            icon={History}
            title="Runs"
            description={`${visible.length} shown`}
            actions={
              runs.length > 0 ? (
                <Tabs items={tabs} value={filter} onChange={setFilter} aria-label="Filter runs" />
              ) : undefined
            }
          />
          <div className="p-3">
            {loading && runs.length === 0 ? (
              <SkeletonRows rows={5} />
            ) : visible.length === 0 ? (
              <EmptyState
                icon={History}
                title={runs.length === 0 ? 'No runs yet' : 'No runs match this filter'}
                description={
                  runs.length === 0
                    ? 'Run a production chain and its execution history appears here.'
                    : 'Try a different state.'
                }
              />
            ) : (
              <ul className="space-y-2">
                {visible.map((run) => (
                  <RunRow key={run.id} run={run} />
                ))}
              </ul>
            )}
          </div>
        </Card>
      </div>
    </>
  );
}
