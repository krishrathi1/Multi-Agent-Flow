import { useEffect, useState, useRef } from 'react';
import {
  ArrowRight,
  GitCompareArrows,
  Minus,
  TrendingDown,
  TrendingUp,
  ChevronDown,
  Check,
  Calendar,
  DollarSign,
  Clock,
  Zap,
  Activity,
  Layers,
  Sparkles,
} from 'lucide-react';
import { api } from '../../lib/api';
import { cn, timeAgo } from '../../lib/utils';
import { formatCompact, formatCurrency, formatMs } from '../../lib/design';
import type { ProcessRun, RunComparison, StageDelta } from '../../types';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Badge, Chip } from '../ui/Badge';
import { EmptyState, Spinner } from '../ui/States';

function toneFor(delta: number): 'up' | 'down' | 'flat' {
  if (Math.abs(delta) < 1e-9) return 'flat';
  return delta > 0 ? 'up' : 'down';
}

const DELTA_STYLES = {
  up: 'text-red-600 dark:text-red-400',
  down: 'text-emerald-600 dark:text-emerald-400',
  flat: 'text-ink-faint',
} as const;

const DELTA_ICONS = { up: TrendingUp, down: TrendingDown, flat: Minus } as const;

/** A signed figure that reads as better/worse, not merely bigger/smaller. */
function Delta({
  value,
  format,
  className,
}: {
  value: number;
  format: (n: number) => string;
  className?: string;
}) {
  const tone = toneFor(value);
  const Icon = DELTA_ICONS[tone];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 tabular-nums font-mono font-bold',
        DELTA_STYLES[tone],
        className,
      )}
    >
      <Icon size={12} strokeWidth={2} aria-hidden />
      {value > 0 ? '+' : value < 0 ? '−' : ''}
      {format(Math.abs(value))}
    </span>
  );
}

function CustomRunSelect({
  label,
  value,
  onChange,
  runs,
  placeholder = 'Select a run',
}: {
  label: string;
  value: string;
  onChange: (val: string) => void;
  runs: ProcessRun[];
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const selected = runs.find((r) => r.id === value);

  return (
    <div className="relative min-w-0 flex-1" ref={ref}>
      <label className="block text-2xs font-bold uppercase tracking-wider text-ink-muted mb-1.5">
        {label}
      </label>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={cn(
          'w-full h-11 px-3 py-2 rounded-xl bg-inset border text-xs text-ink flex items-center justify-between shadow-2xs transition-all cursor-pointer text-left',
          open ? 'border-brand-500 ring-2 ring-brand-500/10' : 'border-line hover:border-line-strong'
        )}
      >
        <div className="flex items-center gap-2 truncate min-w-0">
          <div className="w-6 h-6 rounded-lg bg-brand-500/10 text-brand-600 dark:text-brand-400 flex items-center justify-center shrink-0">
            <Activity size={12} />
          </div>
          <div className="truncate">
            <span className="font-bold text-ink block truncate">
              {selected ? selected.process?.name ?? 'Chain Execution' : placeholder}
            </span>
            {selected && (
              <span className="text-[10px] text-ink-muted font-mono block truncate">
                {new Date(selected.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · {formatCurrency(selected.totalCostUsd)}
              </span>
            )}
          </div>
        </div>
        <ChevronDown size={14} className={cn('text-ink-muted shrink-0 ml-1.5 transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="absolute z-50 mt-1.5 left-0 w-full min-w-[280px] max-w-full rounded-2xl bg-surface/95 backdrop-blur-2xl border border-line shadow-2xl p-1.5 space-y-1 animate-scale-in max-h-60 overflow-y-auto no-scrollbar">
          {runs.map((r) => {
            const isSelected = r.id === value;
            return (
              <button
                key={r.id}
                type="button"
                onClick={() => {
                  onChange(r.id);
                  setOpen(false);
                }}
                className={cn(
                  'w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs text-left transition-colors cursor-pointer',
                  isSelected
                    ? 'bg-brand-500/10 text-brand-600 dark:text-brand-400 font-bold'
                    : 'text-ink-muted hover:bg-hover hover:text-ink font-medium'
                )}
              >
                <div className="min-w-0 flex-1 pr-2 truncate">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-ink truncate">
                      {r.process?.name ?? 'Chain Execution'}
                    </span>
                    <span className="text-2xs font-mono font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.2 rounded border border-emerald-500/20">
                      {formatCurrency(r.totalCostUsd)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-ink-faint font-mono mt-0.5">
                    <span>{new Date(r.startedAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</span>
                    <span>•</span>
                    <span>{r.durationMs ? formatMs(r.durationMs) : '—'}</span>
                  </div>
                </div>
                {isSelected && <Check size={14} className="text-brand-500 shrink-0" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function StageRow({ s }: { s: StageDelta }) {
  const onlyBase = s.headCostUsd === null;
  const onlyHead = s.baseCostUsd === null;

  return (
    <li className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-surface p-3.5 shadow-2xs hover:border-line-strong transition-all">
      <div className="flex items-center gap-2.5 min-w-0 flex-1">
        <span className="px-2 py-0.5 rounded-lg bg-inset border border-line-subtle text-[10px] font-bold font-mono text-ink-muted">
          Stage {s.stage}
        </span>
        <span className="min-w-0 truncate text-xs font-bold text-ink">{s.agentName}</span>
      </div>

      <div className="flex items-center gap-3 shrink-0">
        {onlyBase || onlyHead ? (
          <Badge tone="warning">{onlyBase ? 'removed' : 'added'}</Badge>
        ) : (
          <>
            <div className="hidden sm:flex items-center gap-1.5 text-2xs tabular-nums text-ink-muted font-mono bg-inset px-2 py-1 rounded-lg border border-line-subtle">
              <span>{formatCurrency(s.baseCostUsd ?? 0)}</span>
              <ArrowRight size={10} className="text-ink-faint" />
              <span className="text-ink font-semibold">{formatCurrency(s.headCostUsd ?? 0)}</span>
            </div>
            <Delta value={s.costDelta} format={formatCurrency} className="text-xs" />
            <Delta
              value={s.durationDelta}
              format={(n) => formatMs(n)}
              className="hidden md:inline-flex text-2xs"
            />
          </>
        )}

        {s.headOk === false && <Badge tone="danger">failed</Badge>}
      </div>
    </li>
  );
}

export function RunCompareModal({
  runs,
  open,
  onClose,
}: {
  runs: ProcessRun[];
  open: boolean;
  onClose: () => void;
}) {
  const [baseId, setBaseId] = useState('');
  const [headId, setHeadId] = useState('');
  const [diff, setDiff] = useState<RunComparison | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || runs.length < 2) return;
    const first = runs[0];
    const sameChain = runs.find((r) => r.id !== first.id && r.processId === first.processId);
    const previous = sameChain ?? runs[1];
    setHeadId(first.id);
    setBaseId(previous.id);
  }, [open, runs]);

  useEffect(() => {
    if (!open || !baseId || !headId || baseId === headId) {
      setDiff(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    api.orchestration
      .compareRuns(baseId, headId)
      .then((d) => !cancelled && setDiff(d))
      .catch((err) => !cancelled && setError((err as Error).message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [open, baseId, headId]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      icon={GitCompareArrows}
      size="xl"
      title="Compare Runs"
      description="Inspect execution delta, cost variance, and latency per agent stage"
      footer={
        <Button variant="secondary" onClick={onClose}>
          Close
        </Button>
      }
    >
      {runs.length < 2 ? (
        <EmptyState
          icon={GitCompareArrows}
          title="Not enough run history"
          description="At least two completed runs are required to generate comparative diffs."
        />
      ) : (
        <div className="space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <CustomRunSelect
              label="Baseline Run"
              value={baseId}
              onChange={setBaseId}
              runs={runs}
            />
            <div className="hidden sm:flex items-center justify-center pt-5">
              <div className="w-8 h-8 rounded-full bg-inset border border-line flex items-center justify-center text-ink-muted">
                <ArrowRight size={14} />
              </div>
            </div>
            <CustomRunSelect
              label="Compared Run"
              value={headId}
              onChange={setHeadId}
              runs={runs}
            />
          </div>

          {baseId === headId && (
            <p className="text-xs font-semibold text-amber-600 dark:text-amber-400 bg-amber-500/10 border border-amber-500/20 p-3 rounded-xl">
              Please select two different runs to compare telemetry.
            </p>
          )}

          {error && (
            <p
              role="alert"
              className="rounded-xl border border-red-500/25 bg-red-500/10 p-3 text-xs text-red-600 dark:text-red-400 font-semibold"
            >
              {error}
            </p>
          )}

          {loading ? (
            <div className="flex justify-center py-10">
              <Spinner size={24} />
            </div>
          ) : diff ? (
            <>
              {/* Core Delta Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                {[
                  {
                    label: 'Cost Delta',
                    delta: diff.costDelta,
                    format: formatCurrency,
                    foot:
                      diff.costPct === null
                        ? 'Baseline was free'
                        : `${diff.costPct > 0 ? '+' : ''}${diff.costPct}% variance`,
                  },
                  {
                    label: 'Duration Delta',
                    delta: diff.durationDelta,
                    format: (n: number) => formatMs(n),
                    foot: `${formatMs(diff.base.durationMs)} → ${formatMs(diff.head.durationMs)}`,
                  },
                  {
                    label: 'Token Delta',
                    delta: diff.tokenDelta,
                    format: (n: number) => formatCompact(n),
                    foot: `${formatCompact(diff.base.totalTokens)} → ${formatCompact(diff.head.totalTokens)}`,
                  },
                ].map((m) => (
                  <div
                    key={m.label}
                    className="rounded-2xl border border-line-subtle bg-inset/60 p-4 shadow-2xs"
                  >
                    <p className="text-[10px] font-bold uppercase tracking-wider text-ink-muted">
                      {m.label}
                    </p>
                    <p className="mt-1.5 text-lg font-bold">
                      <Delta value={m.delta} format={m.format} />
                    </p>
                    <p className="mt-1 text-[11px] font-mono text-ink-muted">{m.foot}</p>
                  </div>
                ))}
              </div>

              {/* Stage Diff List */}
              <section className="space-y-2.5">
                <h4 className="text-xs font-bold uppercase tracking-wider text-ink">
                  Stage Breakdown (Cost Variance Ranked)
                </h4>
                {diff.stages.length === 0 ? (
                  <p className="text-xs text-ink-muted bg-inset p-4 rounded-xl text-center">
                    Neither run recorded individual stage breakdowns.
                  </p>
                ) : (
                  <ul className="space-y-2 max-h-64 overflow-y-auto pr-1 no-scrollbar">
                    {diff.stages.map((s) => (
                      <StageRow key={`${s.stage}-${s.agentName}`} s={s} />
                    ))}
                  </ul>
                )}
              </section>
            </>
          ) : null}
        </div>
      )}
    </Modal>
  );
}

