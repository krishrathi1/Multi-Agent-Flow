import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Chip } from './Badge';

export interface TabItem<T extends string = string> {
  value: T;
  label: string;
  icon?: LucideIcon;
  count?: number;
}

export interface TabsProps<T extends string = string> {
  items: TabItem<T>[];
  value: T;
  onChange: (value: T) => void;
  /** `pill` for filter strips, `underline` for page-level section tabs. */
  variant?: 'pill' | 'underline';
  className?: string;
  'aria-label'?: string;
}

export function Tabs<T extends string = string>({
  items,
  value,
  onChange,
  variant = 'pill',
  className,
  'aria-label': ariaLabel = 'Sections',
}: TabsProps<T>) {
  if (variant === 'underline') {
    return (
      <div
        role="tablist"
        aria-label={ariaLabel}
        className={cn(
          'flex items-center gap-1 overflow-x-auto border-b border-line-subtle',
          className,
        )}
      >
        {items.map((item) => {
          const active = item.value === value;
          const Icon = item.icon;
          return (
            <button
              key={item.value}
              role="tab"
              aria-selected={active}
              onClick={() => onChange(item.value)}
              className={cn(
                'relative flex h-9 shrink-0 items-center gap-1.5 px-3 text-sm font-medium',
                'transition-colors duration-150',
                active
                  ? 'text-ink'
                  : 'text-ink-subtle hover:text-ink-muted',
              )}
            >
              {Icon && <Icon size={14} strokeWidth={1.75} aria-hidden />}
              {item.label}
              {typeof item.count === 'number' && <Chip>{item.count}</Chip>}
              {active && (
                <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-brand-500" />
              )}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cn(
        'flex max-w-full items-center gap-1.5 overflow-x-auto rounded-xl border border-line-subtle/80',
        'bg-inset/70 p-1 backdrop-blur-sm shadow-2xs no-scrollbar scroll-smooth',
        className,
      )}
    >
      {items.map((item) => {
        const active = item.value === value;
        const Icon = item.icon;
        return (
          <button
            key={item.value}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(item.value)}
            className={cn(
              'flex h-7 shrink-0 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold whitespace-nowrap',
              'transition-all duration-150 active:scale-[0.98]',
              active
                ? 'bg-surface text-ink shadow-xs border border-line-subtle'
                : 'text-ink-muted hover:text-ink hover:bg-surface/50',
            )}
          >
            {Icon && <Icon size={13} strokeWidth={2} aria-hidden />}
            {item.label}
            {typeof item.count === 'number' && (
              <span className={cn(
                'ml-1 rounded px-1.5 py-0.2 text-[10px] font-mono font-bold',
                active ? 'bg-brand-500/10 text-brand-600 dark:text-brand-400' : 'bg-inset text-ink-faint'
              )}>
                {item.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/** Horizontal toolbar wrapper: filters left, actions right, wraps cleanly. */
export function Toolbar({
  children,
  right,
  className,
}: {
  children?: ReactNode;
  right?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-wrap items-center justify-between gap-x-4 gap-y-3',
        className,
      )}
    >
      <div className="flex flex-wrap items-center gap-2">{children}</div>
      {right && <div className="flex flex-wrap items-center gap-2">{right}</div>}
    </div>
  );
}
