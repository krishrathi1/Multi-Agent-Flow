import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { TrendingDown, TrendingUp, type LucideIcon } from 'lucide-react';
import { cn } from '../../lib/utils';
import { tones, type Tone } from '../../lib/design';

export interface StatCardProps {
  label: string;
  value: ReactNode;
  /** Short qualifier under the value, e.g. "last 24h". */
  sublabel?: string;
  icon?: LucideIcon;
  tone?: Tone;
  /** Signed percentage change; sign picks the arrow and colour. */
  delta?: number;
  /** What the delta is measured against, e.g. "vs. yesterday". */
  deltaLabel?: string;
  /** Turns the whole tile into a link. */
  to?: string;
  /** Dims the tile when the metric is zero/empty so real signal stands out. */
  muted?: boolean;
  className?: string;
}

/**
 * Metric tile. The value is the loudest element; the label sits above it in
 * small caps, and colour is used only for the icon and delta — never as a
 * full-bleed background, which flattens hierarchy.
 */
export function StatCard({
  label,
  value,
  sublabel,
  icon: Icon,
  tone = 'neutral',
  delta,
  deltaLabel,
  to,
  muted = false,
  className,
}: StatCardProps) {
  const t = tones[tone];
  const hasDelta = typeof delta === 'number' && Number.isFinite(delta);
  const positive = hasDelta && delta! >= 0;
  const DeltaIcon = positive ? TrendingUp : TrendingDown;

  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <p className="text-2xs font-semibold uppercase tracking-[0.08em] text-ink-faint">
          {label}
        </p>
        {Icon && (
          <span
            className={cn(
              'grid h-7 w-7 shrink-0 place-items-center rounded-md border',
              t.soft,
              t.text,
            )}
          >
            <Icon size={14} strokeWidth={1.75} aria-hidden />
          </span>
        )}
      </div>

      <div className="mt-3 flex items-baseline gap-2">
        <span
          className={cn(
            'text-2xl font-semibold tabular-nums leading-none tracking-tight',
            muted ? 'text-ink-subtle' : 'text-ink',
          )}
        >
          {value}
        </span>
        {hasDelta && (
          <span
            className={cn(
              'inline-flex items-center gap-0.5 text-xs font-medium tabular-nums',
              positive ? 'text-emerald-300' : 'text-red-300',
            )}
          >
            <DeltaIcon size={12} strokeWidth={2.25} aria-hidden />
            {positive ? '+' : ''}
            {delta!.toFixed(1)}%
          </span>
        )}
      </div>

      {(sublabel || deltaLabel) && (
        <p className="mt-1.5 text-xs text-ink-faint">{sublabel ?? deltaLabel}</p>
      )}
    </>
  );

  const shell = cn(
    'block rounded-xl border border-line-subtle bg-surface p-4',
    'shadow-e1',
    to &&
      'transition-[border-color,background-color,box-shadow] duration-150 ' +
        'hover:border-line-strong hover:bg-raised hover:shadow-e2',
    className,
  );

  if (to) {
    return (
      <Link to={to} className={shell}>
        {body}
      </Link>
    );
  }

  return <div className={shell}>{body}</div>;
}

/**
 * Dense KPI row used above charts — smaller than StatCard, no icon chrome.
 */
export function StatInline({
  label,
  value,
  tone = 'neutral',
  className,
}: {
  label: string;
  value: ReactNode;
  tone?: Tone;
  className?: string;
}) {
  return (
    <div className={cn('min-w-0', className)}>
      <p className="text-2xs font-semibold uppercase tracking-[0.08em] text-ink-faint">
        {label}
      </p>
      <p
        className={cn(
          'mt-1 truncate text-lg font-semibold tabular-nums leading-tight',
          tone === 'neutral' ? 'text-ink' : tones[tone].text,
        )}
      >
        {value}
      </p>
    </div>
  );
}
