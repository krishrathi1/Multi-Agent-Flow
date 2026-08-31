import { cn } from '../../lib/utils';
import { tones, type Tone } from '../../lib/design';

const sizes = {
  xs: { box: 'h-6 w-6 text-2xs', dot: 'h-1.5 w-1.5 ring-2' },
  sm: { box: 'h-7 w-7 text-xs', dot: 'h-2 w-2 ring-2' },
  md: { box: 'h-9 w-9 text-sm', dot: 'h-2.5 w-2.5 ring-2' },
  lg: { box: 'h-11 w-11 text-base', dot: 'h-3 w-3 ring-[3px]' },
  xl: { box: 'h-14 w-14 text-lg', dot: 'h-3.5 w-3.5 ring-[3px]' },
} as const;

/* Deterministic tint per name so an agent keeps the same colour everywhere. */
const palette = [
  'bg-brand-500/15 text-brand-700 dark:text-brand-300 border-brand-600/25 dark:border-brand-500/25',
  'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-600/25 dark:border-emerald-500/25',
  'bg-violet-500/15 text-violet-700 dark:text-violet-300 border-violet-600/25 dark:border-violet-500/25',
  'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-600/25 dark:border-amber-500/25',
  'bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-600/25 dark:border-sky-500/25',
  'bg-pink-500/15 text-pink-700 dark:text-pink-300 border-pink-600/25 dark:border-pink-500/25',
  'bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border-cyan-600/25 dark:border-cyan-500/25',
  'bg-orange-500/15 text-orange-700 dark:text-orange-300 border-orange-600/25 dark:border-orange-500/25',
];

function hashTint(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return palette[Math.abs(h) % palette.length];
}

function initials(name: string): string {
  const parts = name.trim().split(/[\s\-_]+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export interface AvatarProps {
  name: string;
  /** Existing seed data stores emoji here; rendered as decoration, not an icon. */
  emoji?: string | null;
  size?: keyof typeof sizes;
  /** Presence dot in the corner. */
  status?: Tone;
  statusLabel?: string;
  className?: string;
}

/**
 * Agent/user avatar. Falls back to deterministic initials so the grid never
 * shows a ragged mix of placeholder images.
 */
export function Avatar({
  name,
  emoji,
  size = 'md',
  status,
  statusLabel,
  className,
}: AvatarProps) {
  const s = sizes[size];

  return (
    <span className={cn('relative inline-flex shrink-0', className)}>
      <span
        className={cn(
          'grid place-items-center rounded-full border font-bold text-center select-none',
          s.box,
          emoji ? 'border-line bg-raised' : hashTint(name),
        )}
        aria-hidden
      >
        {emoji ? <span className="leading-none">{emoji}</span> : initials(name)}
      </span>
      {status && (
        <span
          className={cn(
            'absolute -bottom-0.5 -right-0.5 rounded-full ring-surface',
            s.dot,
            tones[status].solid,
          )}
          title={statusLabel}
        >
          <span className="sr-only">{statusLabel}</span>
        </span>
      )}
    </span>
  );
}
