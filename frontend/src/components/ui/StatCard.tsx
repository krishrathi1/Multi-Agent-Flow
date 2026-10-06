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
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold text-ink-muted">
          {label}
        </p>
        {Icon && (
          <span
            className={cn(
              'grid h-6.5 w-6.5 sm:h-7 sm:w-7 shrink-0 place-items-center rounded-full text-xs transition-colors',
              t.soft,
              t.text,
            )}
          >
            <Icon size={13} strokeWidth={2} className="sm:hidden" aria-hidden />
            <Icon size={14} strokeWidth={2} className="hidden sm:inline" aria-hidden />
          </span>
        )}
      </div>

      <div className="mt-1.5 sm:mt-2 flex items-baseline justify-between gap-2">
        <span
          className={cn(
            'text-xl sm:text-2xl font-bold tracking-tight leading-none',
            muted ? 'text-ink-subtle' : 'text-ink',
          )}
        >
          {value}
        </span>
        {hasDelta && (
          <span
            className={cn(
              'inline-flex items-center gap-0.5 text-xs font-semibold tabular-nums',
              positive ? 'text-emerald-500' : 'text-rose-500',
            )}
          >
            <DeltaIcon size={12} strokeWidth={2.25} aria-hidden />
            {positive ? '+' : ''}
            {delta!.toFixed(1)}%
          </span>
        )}
      </div>

      {(sublabel || deltaLabel) && (
        <p className="mt-1 sm:mt-1.5 text-[11px] sm:text-xs text-ink-faint truncate">{sublabel ?? deltaLabel}</p>
      )}
    </>
  );

  const shell = cn(
    'group relative block rounded-2xl border border-line-subtle bg-surface p-3 sm:p-4.5',
    'shadow-xs transition-all duration-150',
    to &&
      'hover:-translate-y-0.5 hover:border-line-strong hover:shadow-sm active:translate-y-0',
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
