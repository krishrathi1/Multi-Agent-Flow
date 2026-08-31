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
        'inline-flex items-center gap-0.5 rounded-lg border border-line-subtle',
        'bg-inset p-0.5',
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
              'flex h-7 shrink-0 items-center gap-1.5 rounded-md px-2.5 text-sm font-medium',
              'transition-colors duration-150',
              active
                ? 'bg-raised text-ink shadow-e1'
                : 'text-ink-subtle hover:text-ink-muted hover:wash',
            )}
          >
            {Icon && <Icon size={13} strokeWidth={1.75} aria-hidden />}
            {item.label}
            {typeof item.count === 'number' && <Chip>{item.count}</Chip>}
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
