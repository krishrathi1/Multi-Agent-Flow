import type { HTMLAttributes, ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '../../lib/utils';

/* Padding is a fixed scale. Screens choose a density, never an arbitrary
   number — that is what stops the "every box has different padding" problem. */
const paddings = {
  none: '',
  sm: 'p-3',
  md: 'p-4',
  lg: 'p-5',
} as const;

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  padding?: keyof typeof paddings;
  /** Lifts the card and reveals a border on hover — only for clickable cards. */
  interactive?: boolean;
  /** Raises the surface one rung (use inside an already-elevated container). */
  raised?: boolean;
  children?: ReactNode;
}

export function Card({
  padding = 'md',
  interactive = false,
  raised = false,
  className,
  children,
  ...props
}: CardProps) {
  return (
    <div
      className={cn(
        'rounded-xl border border-line-subtle',
        raised ? 'bg-raised' : 'bg-surface',
        'shadow-e1',
        interactive &&
          'transition-[border-color,background-color,box-shadow] duration-150 ' +
            'hover:border-line-strong hover:bg-raised hover:shadow-e2 ' +
            'focus-within:border-brand-500/40',
        paddings[padding],
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export interface CardHeaderProps {
  title: ReactNode;
  /** Secondary line under the title. */
  description?: ReactNode;
  icon?: LucideIcon;
  /** Right-aligned controls: filters, menus, "view all" links. */
  actions?: ReactNode;
  className?: string;
  /** Adds the divider + padding used when the body is flush to the edges. */
  bordered?: boolean;
}

export function CardHeader({
  title,
  description,
  icon: Icon,
  actions,
  className,
  bordered = false,
}: CardHeaderProps) {
  return (
    <div
      className={cn(
        'flex items-start justify-between gap-4',
        bordered && 'border-b border-line-subtle px-4 py-3',
        !bordered && 'mb-4',
        className,
      )}
    >
      <div className="flex min-w-0 items-start gap-2.5">
        {Icon && (
          <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-md wash text-ink-muted">
            <Icon size={15} strokeWidth={1.75} aria-hidden />
          </span>
        )}
        <div className="min-w-0">
          <h3 className="truncate text-base font-semibold text-ink">{title}</h3>
          {description && (
            <p className="mt-0.5 text-sm text-ink-subtle">{description}</p>
          )}
        </div>
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}

/** Body wrapper for cards whose header used `bordered`. */
export function CardBody({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('p-4', className)} {...props}>
      {children}
    </div>
  );
}

export function CardFooter({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'flex items-center justify-end gap-2 border-t border-line-subtle px-4 py-3',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}
