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
  Activity,
  ArrowRight,
  FileCode,
  AlertTriangle,
} from 'lucide-react';
import { api } from '../lib/api';
import { cn, timeAgo } from '../lib/utils';
import { formatCompact, formatCurrency, formatMs, tones, type Tone } from '../lib/design';
import type { ProcessRun, PersistedRunState, RunStats } from '../types';
import { PageHeader } from '../components/ui/PageHeader';
import { Card, CardHeader } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge, Chip } from '../components/ui/Badge';
import { EmptyState, SkeletonRows } from '../components/ui/States';
import { Tabs } from '../components/ui/Tabs';
import { RunCompareModal } from '../components/process/RunCompareModal';
import { LiveWaveform } from '../components/ui/LiveIcon';
import { HourglassLoader } from '../components/ui/HourglassLoader';
import { MarkdownRenderer } from '../components/ui/MarkdownRenderer';

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
    if (next && !detail) {
      setLoading(true);
      try {
        setDetail(await api.orchestration.run(run.id));
      } finally {
        setLoading(false);
      }
    }
  };

  const getStatusBadge = () => {
    switch (run.state) {
      case 'COMPLETED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            Completed
          </span>
        );
      case 'RUNNING':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/25">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
            Running
          </span>
        );
      case 'FAILED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/25">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
            Failed
          </span>
        );
      case 'AWAITING_APPROVAL':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/25">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
            Awaiting Review
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-inset text-ink-muted border border-line">
            {run.state.toLowerCase()}
          </span>
        );
    }
  };

  return (
    <li className="overflow-hidden rounded-2xl border border-line-subtle bg-surface shadow-2xs hover:border-line-strong hover:shadow-xs transition-all">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        className="flex w-full items-center gap-3.5 p-4 text-left transition-colors hover:bg-hover/50 cursor-pointer"
      >
        <ChevronRight
          size={16}
          className={cn(
            'shrink-0 text-ink-muted transition-transform duration-200',
            open && 'rotate-90 text-brand-500',
          )}
          aria-hidden
        />

        <div className="w-9 h-9 rounded-xl bg-brand-500/10 border border-brand-500/20 text-brand-600 dark:text-brand-400 flex items-center justify-center shrink-0">
          <Icon size={16} />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="block truncate text-xs font-bold text-ink">
              {run.process?.name ?? 'Chain Execution'}
            </span>
            <span className="text-[10px] text-ink-faint font-mono hidden md:inline">
              #{run.id.slice(0, 8)}
            </span>
          </div>

          <div className="mt-1 flex flex-wrap items-center gap-2 text-2xs text-ink-muted font-medium">
            <span className="inline-flex items-center gap-1 bg-inset px-2 py-0.5 rounded-md border border-line-subtle">
              <TriggerIcon size={10} />
              {run.trigger.toLowerCase()}
            </span>
            <span>•</span>
            <span>{timeAgo(run.startedAt)}</span>
            {run.error && (
              <>
                <span>•</span>
                <span className="text-rose-600 dark:text-rose-400 font-semibold truncate max-w-xs">{run.error}</span>
              </>
            )}
          </div>
        </div>

        <div className="hidden sm:flex shrink-0 items-center gap-4 text-xs font-mono text-ink-muted">
          <span className="bg-inset px-2 py-1 rounded-lg border border-line-subtle">{run._count?.steps ?? run.steps?.length ?? 0} stages</span>
          <span>{run.durationMs ? formatMs(run.durationMs) : '—'}</span>
          <span>{formatCompact(run.totalTokens)} tok</span>
          <span className="font-bold text-emerald-600 dark:text-emerald-400">
            {formatCurrency(run.totalCostUsd)}
          </span>
        </div>

        <div className="shrink-0">
          {getStatusBadge()}
        </div>
      </button>

      {open && (
        <div className="border-t border-line-subtle bg-inset/40 p-4 animate-scale-in">
          {loading ? (
            <div className="flex justify-center py-6">
              <HourglassLoader size={40} label="Loading execution stages..." />
            </div>
          ) : detail?.steps?.length ? (
            <div className="space-y-2.5">
              <h4 className="text-2xs font-bold uppercase tracking-wider text-ink-muted mb-2">
                Execution Stages ({detail.steps.length})
              </h4>
              <ul className="space-y-2">
                {detail.steps.map((s) => {
                  const SIcon = iconFor(s.state);
                  return (
                    <li key={s.id} className="rounded-xl border border-line bg-surface p-3.5 shadow-2xs">
                      <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded-md bg-inset border border-line-subtle text-[10px] font-mono font-bold text-ink">
                            Stage {s.stage}
                          </span>
                          <span className="text-xs font-bold text-ink">{s.agentName}</span>
                        </div>
                        <div className="text-2xs font-mono font-semibold text-ink-muted flex items-center gap-2">
                          <span>{formatMs(s.durationMs)}</span>
                          <span>•</span>
                          <span>{formatCompact(s.tokens)} tok</span>
                          <span>•</span>
                          <span className="text-emerald-600 dark:text-emerald-400 font-bold">{formatCurrency(s.costUsd)}</span>
                        </div>
                      </div>
                      {s.summary && (
                        <div className="mt-2">
                          <MarkdownRenderer content={s.summary} maxHeight="max-h-60 sm:max-h-72" />
                        </div>
                      )}
                      {s.error && (
                        <p className="mt-2 text-xs text-rose-600 dark:text-rose-400 font-medium bg-rose-500/10 p-2.5 rounded-lg border border-rose-500/20">
                          {s.error}
                        </p>
                      )}
                      {Array.isArray(s.files) && s.files.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {s.files.map((f) => (
                            <span
                              key={f}
                              className="rounded-md bg-inset px-2 py-0.5 font-mono text-[10px] text-ink-muted border border-line-subtle flex items-center gap-1"
                            >
                              <FileCode size={10} /> {f}
                            </span>
                          ))}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : (
            <p className="py-4 text-center text-xs text-ink-muted">No step details recorded for this run.</p>
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
      [
        { value: 'all' as const, label: 'All', count: counts.all ?? 0 },
        { value: 'COMPLETED' as const, label: 'Completed', count: counts.COMPLETED ?? 0 },
        { value: 'RUNNING' as const, label: 'Running', count: counts.RUNNING ?? 0 },
        { value: 'FAILED' as const, label: 'Failed', count: counts.FAILED ?? 0 },
        { value: 'AWAITING_APPROVAL' as const, label: 'Awaiting Review', count: counts.AWAITING_APPROVAL ?? 0 },
        { value: 'CANCELLED' as const, label: 'Cancelled', count: counts.CANCELLED ?? 0 },
      ].filter(
        (t) =>
          t.value === 'all' ||
          t.value === 'COMPLETED' ||
          t.value === 'FAILED' ||
          t.value === 'RUNNING' ||
          t.count > 0,
      ),
    [counts],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        icon={History}
        title="Run History"
        description="Comprehensive audit log of multi-agent production chains, stage traces, and cost metrics"
        actions={
          <div className="flex items-center gap-2.5">
            <Button
              variant="secondary"
              icon={GitCompareArrows}
              disabled={runs.length < 2}
              onClick={() => setComparing(true)}
            >
              Compare Runs
            </Button>
            <Button variant="secondary" icon={RefreshCw} onClick={load}>
              Refresh
            </Button>
          </div>
        }
      />

      <RunCompareModal runs={runs} open={comparing} onClose={() => setComparing(false)} />

      {/* 4 Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
        <div className="rounded-2xl border border-line-subtle bg-surface p-4.5 shadow-2xs hover:border-line-strong hover:shadow-xs transition-all">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-ink-muted">Total Runs</span>
            <div className="w-8 h-8 rounded-xl bg-brand-500/10 text-brand-600 dark:text-brand-400 border border-brand-500/20 flex items-center justify-center">
              <History size={16} />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-bold text-ink tracking-tight font-mono">
            {stats?.total ?? 0}
          </div>
          <p className="text-[11px] text-ink-muted mt-1 font-medium">Orchestrated chains</p>
        </div>

        <div className="rounded-2xl border border-line-subtle bg-surface p-4.5 shadow-2xs hover:border-line-strong hover:shadow-xs transition-all">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-ink-muted">Success Rate</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center justify-center">
              <CheckCircle2 size={16} />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-bold text-ink tracking-tight font-mono text-emerald-600 dark:text-emerald-400">
            {stats?.successRate ?? 0}%
          </div>
          <p className="text-[11px] text-ink-muted mt-1 font-medium">{stats?.completed ?? 0} finished runs</p>
        </div>

        <div className="rounded-2xl border border-line-subtle bg-surface p-4.5 shadow-2xs hover:border-line-strong hover:shadow-xs transition-all">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-ink-muted">Total Spend</span>
            <div className="w-8 h-8 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 flex items-center justify-center">
              <CircleDollarSign size={16} />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-bold text-ink tracking-tight font-mono">
            {formatCurrency(stats?.totalCostUsd ?? 0)}
          </div>
          <p className="text-[11px] text-ink-muted mt-1 font-medium">{formatCompact(stats?.totalTokens ?? 0)} tokens consumed</p>
        </div>

        <div className="rounded-2xl border border-line-subtle bg-surface p-4.5 shadow-2xs hover:border-line-strong hover:shadow-xs transition-all">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-ink-muted">Avg Duration</span>
            <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 flex items-center justify-center">
              <Timer size={16} />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-bold text-ink tracking-tight font-mono">
            {formatMs(stats?.avgDurationMs ?? 0)}
          </div>
          <p className="text-[11px] text-ink-muted mt-1 font-medium">Mean chain execution latency</p>
        </div>
      </div>

      {/* Runs List Card */}
      <div className="rounded-2xl border border-line-subtle bg-surface p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-line-subtle pb-4 mb-4">
          <div className="flex items-center gap-2.5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-ink">
              Execution Logs ({visible.length})
            </h3>
            <LiveWaveform color="bg-brand-500" />
          </div>

          {runs.length > 0 && (
            <div className="overflow-x-auto no-scrollbar">
              <Tabs items={tabs} value={filter} onChange={setFilter} aria-label="Filter runs" />
            </div>
          )}
        </div>

        <div>
          {loading && runs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <HourglassLoader size={48} label="Loading run history..." />
            </div>
          ) : visible.length === 0 ? (
            <div className="text-center py-12 text-xs text-ink-muted">
              {filter === 'FAILED' ? (
                <>
                  <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 mx-auto flex items-center justify-center mb-2.5 shadow-xs">
                    <CheckCircle2 size={20} />
                  </div>
                  <p className="font-bold text-ink text-sm">Zero Execution Failures</p>
                  <p className="text-ink-muted mt-1 max-w-sm mx-auto">
                    All orchestrated production chains and agent tasks have executed with 100% reliability.
                  </p>
                </>
              ) : (
                <>
                  <History size={32} className="mx-auto mb-2 text-ink-faint opacity-50" />
                  <p className="font-semibold text-ink">{runs.length === 0 ? 'No runs recorded yet' : 'No runs match this filter'}</p>
                  <p className="text-ink-muted mt-1">{runs.length === 0 ? 'Trigger a process or agent chain to view execution history.' : 'Try selecting a different status filter.'}</p>
                </>
              )}
            </div>
          ) : (
            <ul className="space-y-3">
              {visible.map((run) => (
                <RunRow key={run.id} run={run} />
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

