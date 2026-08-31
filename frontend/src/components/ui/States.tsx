import type { ReactNode } from 'react';
import { AlertCircle, Loader2, RefreshCw, type LucideIcon } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Button } from './Button';

/* ---- Skeletons ----------------------------------------------------------
   Reserve the real layout's space so nothing jumps when data lands (CLS).
   ---------------------------------------------------------------------- */

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('skeleton rounded-md', className)} aria-hidden />;
}

export function SkeletonText({
  lines = 3,
  className,
}: {
  lines?: number;
  className?: string;
}) {
  return (
    <div className={cn('space-y-2', className)} aria-hidden>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className={cn('h-3', i === lines - 1 ? 'w-2/3' : 'w-full')}
        />
      ))}
    </div>
  );
}

export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'rounded-xl border border-line-subtle bg-surface p-4',
        className,
      )}
      aria-hidden
    >
      <div className="flex items-center gap-3">
        <Skeleton className="h-9 w-9 rounded-lg" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-3 w-1/3" />
          <Skeleton className="h-2.5 w-1/4" />
        </div>
      </div>
      <SkeletonText lines={2} className="mt-4" />
    </div>
  );
}

/** Grid of skeleton cards matching a card list's shape. */
export function SkeletonGrid({
  count = 6,
  className,
}: {
  count?: number;
  className?: string;
}) {
  return (
    <div
      className={cn('grid gap-4 sm:grid-cols-2 xl:grid-cols-3', className)}
      role="status"
      aria-label="Loading"
    >
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}

export function SkeletonRows({ rows = 6 }: { rows?: number }) {
  return (
    <div className="space-y-2" role="status" aria-label="Loading">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-14 w-full rounded-lg" />
      ))}
    </div>
  );
}

/* ---- Empty state -------------------------------------------------------- */

import { LottieAnimation, type AnimationType } from './LottieAnimation';

export interface EmptyStateProps {
  icon?: LucideIcon;
  animation?: AnimationType;
  title: string;
  /** Explain what would appear here and how to make it appear. */
  description?: string;
  action?: ReactNode;
  /** Compact variant for inside cards and columns. */
  compact?: boolean;
  className?: string;
}

export function EmptyState({
  icon: Icon,
  animation,
  title,
  description,
  action,
  compact = false,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center',
        compact ? 'px-4 py-8' : 'px-6 py-14',
        className,
      )}
    >
      {animation ? (
        <div className="relative mb-3 flex items-center justify-center">
          <div className="absolute inset-0 rounded-full bg-brand-500/10 blur-xl scale-125" />
          <LottieAnimation type={animation} size={compact ? 48 : 68} />
        </div>
      ) : Icon ? (
        <span
          className={cn(
            'mb-3 grid place-items-center rounded-2xl border border-line-subtle',
            'bg-surface/85 backdrop-blur-md text-ink-faint shadow-2xs',
            compact ? 'h-10 w-10' : 'h-14 w-14',
          )}
        >
          <Icon size={compact ? 18 : 24} strokeWidth={1.75} aria-hidden />
        </span>
      ) : null}
      <p
        className={cn(
          'font-bold text-ink',
          compact ? 'text-sm' : 'text-md',
        )}
      >
        {title}
      </p>
      {description && (
        <p
          className={cn(
            'mt-1 max-w-sm text-ink-subtle leading-relaxed',
            compact ? 'text-xs' : 'text-sm',
          )}
        >
          {description}
        </p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/* ---- Error state -------------------------------------------------------- */

export function ErrorState({
  title = 'Something went wrong',
  description,
  onRetry,
  compact = false,
  className,
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
  compact?: boolean;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={cn(
        'flex flex-col items-center justify-center text-center',
        compact ? 'px-4 py-8' : 'px-6 py-14',
        className,
      )}
    >
      <span className="mb-3 grid h-11 w-11 place-items-center rounded-full border border-red-500/25 bg-red-500/10 text-red-300">
        <AlertCircle size={20} strokeWidth={1.75} aria-hidden />
      </span>
      <p className="text-md font-medium text-ink">{title}</p>
      {description && (
        <p className="mt-1 max-w-sm text-sm text-ink-subtle">{description}</p>
      )}
      {onRetry && (
        <Button variant="secondary" size="sm" icon={RefreshCw} onClick={onRetry} className="mt-4">
          Try again
        </Button>
      )}
    </div>
  );
}

/* ---- Inline spinner ----------------------------------------------------- */

export function Spinner({
  size = 16,
  className,
  label = 'Loading',
}: {
  size?: number;
  className?: string;
  label?: string;
}) {
  return (
    <span role="status" aria-label={label} className={cn('inline-flex', className)}>
      <Loader2 size={size} className="animate-spin-slow text-ink-subtle" aria-hidden />
    </span>
  );
}

/** Centred spinner for first paint of a whole panel. */
export function LoadingPanel({ label = 'Loading' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2.5 py-14 text-sm text-ink-subtle">
      <Spinner />
      {label}
    </div>
  );
}
