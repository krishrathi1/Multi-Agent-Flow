import { useEffect, useState } from 'react';
import { ArrowRight, GitCompareArrows, Minus, TrendingDown, TrendingUp } from 'lucide-react';
import { api } from '../../lib/api';
import { cn } from '../../lib/utils';
import { formatCompact, formatCurrency, formatMs } from '../../lib/design';
import type { ProcessRun, RunComparison, StageDelta } from '../../types';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Badge, Chip } from '../ui/Badge';
import { EmptyState, Spinner } from '../ui/States';

/**
 * Direction of a change, in the reader's terms rather than the number's.
 *
 * Cost and duration are "lower is better", so a negative delta is the good
 * news — colouring by raw sign would mark a saving as a regression.
 */
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
        'inline-flex items-center gap-1 tabular-nums font-medium',
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

function StageRow({ s }: { s: StageDelta }) {
  // A stage present on only one side means the roster changed between runs —
  // showing a delta there would invent a comparison that doesn't exist.
  const onlyBase = s.headCostUsd === null;
  const onlyHead = s.baseCostUsd === null;

  return (
    <li className="flex flex-wrap items-center gap-2 rounded-lg border border-line-subtle bg-surface px-3 py-2.5">
      <Chip>stage {s.stage}</Chip>
      <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink">{s.agentName}</span>

      {onlyBase || onlyHead ? (
        <Badge tone="warning">{onlyBase ? 'removed' : 'added'}</Badge>
      ) : (
        <>
          <span className="hidden items-center gap-1.5 text-2xs tabular-nums text-ink-faint sm:flex">
            {formatCurrency(s.baseCostUsd ?? 0)}
            <ArrowRight size={10} strokeWidth={2} aria-hidden />
            <span className="text-ink-subtle">{formatCurrency(s.headCostUsd ?? 0)}</span>
          </span>
          <Delta value={s.costDelta} format={formatCurrency} className="text-xs" />
          <Delta
            value={s.durationDelta}
            format={(n) => formatMs(n)}
            className="hidden text-2xs md:inline-flex"
          />
        </>
      )}

      {s.headOk === false && <Badge tone="danger">failed</Badge>}
    </li>
  );
}

/**
 * Diffs two runs of a chain.
 *
 * The run list already showed that a run got slower or dearer; what it could
 * not show was *which agent* caused it. Stages are ranked by cost regression,
 * so the reason is the first row rather than something to hunt for.
 */
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

  // Default to the two most recent runs of the same chain — the comparison
  // almost everyone opens this for.
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
    // A fast re-selection must not let a stale response overwrite a newer one.
    return () => {
      cancelled = true;
    };
  }, [open, baseId, headId]);

  const label = (r: ProcessRun) =>
    `${r.process?.name ?? 'Production'} · ${new Date(r.startedAt).toLocaleString()} · ${formatCurrency(r.totalCostUsd)}`;

  const picker = (
    value: string,
    onChange: (v: string) => void,
    id: string,
    labelText: string,
  ) => (
    <div className="min-w-0 flex-1">
      <label
        htmlFor={id}
        className="mb-1 block text-2xs font-semibold uppercase tracking-[0.09em] text-ink-faint"
      >
        {labelText}
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          'h-9 w-full rounded-md border border-line bg-inset px-2.5 text-sm text-ink',
          'transition-colors hover:border-line-strong',
          'focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/25',
        )}
      >
        {runs.map((r) => (
          <option key={r.id} value={r.id}>
            {label(r)}
          </option>
        ))}
      </select>
    </div>
  );

  return (
    <Modal
      open={open}
      onClose={onClose}
      icon={GitCompareArrows}
      size="xl"
      title="Compare runs"
      description="See which stage accounts for a change in cost or duration."
      footer={
        <Button variant="ghost" onClick={onClose}>
          Close
        </Button>
      }
    >
      {runs.length < 2 ? (
        <EmptyState
          icon={GitCompareArrows}
          title="Not enough history"
          description="Two runs are needed before anything can be compared."
        />
      ) : (
        <div className="space-y-5">
          <div className="flex flex-wrap items-end gap-3">
            {picker(baseId, setBaseId, 'compare-base', 'Baseline')}
            <ArrowRight
              size={16}
              strokeWidth={1.75}
              className="mb-2 shrink-0 text-ink-faint"
              aria-hidden
            />
            {picker(headId, setHeadId, 'compare-head', 'Compared with')}
          </div>

          {baseId === headId && (
            <p className="text-sm text-ink-subtle">Pick two different runs.</p>
          )}

          {error && (
            <p
              role="alert"
              className="rounded-lg border border-red-500/25 bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-300"
            >
              {error}
            </p>
          )}

          {loading ? (
            <div className="flex justify-center py-10">
              <Spinner size={20} />
            </div>
          ) : diff ? (
            <>
              <div className="grid gap-3 sm:grid-cols-3">
                {[
                  {
                    label: 'Cost',
                    delta: diff.costDelta,
                    format: formatCurrency,
                    foot:
                      diff.costPct === null
                        ? 'baseline was free'
                        : `${diff.costPct > 0 ? '+' : ''}${diff.costPct}%`,
                  },
                  {
                    label: 'Duration',
                    delta: diff.durationDelta,
                    format: (n: number) => formatMs(n),
                    foot: `${formatMs(diff.base.durationMs)} → ${formatMs(diff.head.durationMs)}`,
                  },
                  {
                    label: 'Tokens',
                    delta: diff.tokenDelta,
                    format: (n: number) => formatCompact(n),
                    foot: `${formatCompact(diff.base.totalTokens)} → ${formatCompact(diff.head.totalTokens)}`,
                  },
                ].map((m) => (
                  <div
                    key={m.label}
                    className="rounded-lg border border-line-subtle bg-inset p-3"
                  >
                    <p className="text-2xs font-semibold uppercase tracking-[0.09em] text-ink-faint">
                      {m.label}
                    </p>
                    <p className="mt-1 text-lg">
                      <Delta value={m.delta} format={m.format} />
                    </p>
                    <p className="mt-0.5 text-2xs tabular-nums text-ink-faint">{m.foot}</p>
                  </div>
                ))}
              </div>

              <section>
                <h4 className="mb-2 text-2xs font-semibold uppercase tracking-[0.09em] text-ink-faint">
                  By stage — biggest regression first
                </h4>
                {diff.stages.length === 0 ? (
                  <p className="text-sm text-ink-subtle">
                    Neither run recorded any stage detail.
                  </p>
                ) : (
                  <ul className="space-y-2">
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
