import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '../../lib/utils';
import { tones, type Tone } from '../../lib/design';

export interface BadgeProps {
  tone?: Tone;
  /** Leading vector icon. */
  icon?: LucideIcon;
  /** Draws a filled status dot instead of an icon. */
  dot?: boolean;
  /** Animates the dot — reserve for genuinely live values. */
  pulse?: boolean;
  size?: 'sm' | 'md';
  className?: string;
  children: ReactNode;
}

/**
 * Status pill. Always pairs colour with a dot, icon or text label so meaning
 * never depends on hue alone (WCAG 1.4.1).
 */
export function Badge({
  tone = 'neutral',
  icon: Icon,
  dot = false,
  pulse = false,
  size = 'sm',
  className,
  children,
}: BadgeProps) {
  const t = tones[tone];

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border font-medium whitespace-nowrap',
        size === 'sm' ? 'h-5 px-2 text-2xs' : 'h-6 px-2.5 text-xs',
        t.soft,
        t.text,
        className,
      )}
    >
      {dot && (
        <span className="relative flex h-1.5 w-1.5 shrink-0">
          {pulse && (
            <span
              className={cn('absolute inset-0 rounded-full animate-ping-ring', t.solid)}
              aria-hidden
            />
          )}
          <span className={cn('relative h-1.5 w-1.5 rounded-full', t.solid)} />
        </span>
      )}
      {Icon && <Icon size={size === 'sm' ? 11 : 12} strokeWidth={2} className="shrink-0" aria-hidden />}
      {children}
    </span>
  );
}

/** Bare status dot for table cells and dense rows. */
export function StatusDot({
  tone = 'neutral',
  pulse = false,
  label,
  className,
}: {
  tone?: Tone;
  pulse?: boolean;
  /** Screen-reader text — the dot alone conveys nothing without it. */
  label: string;
  className?: string;
}) {
  const t = tones[tone];
  return (
    <span className={cn('relative flex h-2 w-2 shrink-0', className)} title={label}>
      {pulse && (
        <span className={cn('absolute inset-0 rounded-full animate-ping-ring', t.solid)} aria-hidden />
      )}
      <span className={cn('relative h-2 w-2 rounded-full', t.solid)} />
      <span className="sr-only">{label}</span>
    </span>
  );
}

/** Small monospace key/count chip, e.g. counts in column headers. */
export function Chip({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex h-5 min-w-[20px] items-center justify-center rounded-full',
        'wash px-1.5 text-2xs font-medium tabular-nums text-ink-subtle',
        className,
      )}
    >
      {children}
    </span>
  );
}
