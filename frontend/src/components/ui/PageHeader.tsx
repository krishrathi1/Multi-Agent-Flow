import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, type LucideIcon } from 'lucide-react';
import { cn } from '../../lib/utils';

export interface Crumb {
  label: string;
  to?: string;
}

export interface PageHeaderProps {
  title: string;
  description?: string;
  icon?: LucideIcon;
  /** Trailing element next to the title, e.g. a status badge. */
  badge?: ReactNode;
  /** Primary + secondary actions, right-aligned. */
  actions?: ReactNode;
  breadcrumbs?: Crumb[];
  /** Filter/tab strip rendered below the title block. */
  toolbar?: ReactNode;
  className?: string;
}

/**
 * The one page title block. Every screen uses it, so vertical rhythm and
 * action placement are identical throughout the app.
 */
export function PageHeader({
  title,
  description,
  icon: Icon,
  badge,
  actions,
  breadcrumbs,
  toolbar,
  className,
}: PageHeaderProps) {
  return (
    <div className={cn('mb-6', className)}>
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav aria-label="Breadcrumb" className="mb-2">
          <ol className="flex items-center gap-1 text-xs text-ink-faint">
            {breadcrumbs.map((crumb, i) => (
              <li key={`${crumb.label}-${i}`} className="flex items-center gap-1">
                {i > 0 && <ChevronRight size={12} strokeWidth={2} aria-hidden />}
                {crumb.to ? (
                  <Link
                    to={crumb.to}
                    className="rounded-xs transition-colors hover:text-ink-muted"
                  >
                    {crumb.label}
                  </Link>
                ) : (
                  <span className="text-ink-subtle" aria-current="page">
                    {crumb.label}
                  </span>
                )}
              </li>
            ))}
          </ol>
        </nav>
      )}

      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div className="flex min-w-0 items-start gap-3">
          {Icon && (
            <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-line bg-surface text-brand-700 dark:text-brand-300">
              <Icon size={18} strokeWidth={1.75} aria-hidden />
            </span>
          )}
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-xl font-semibold tracking-tight text-ink">
                {title}
              </h1>
              {badge}
            </div>
            {description && (
              <p className="mt-1 max-w-2xl text-base text-ink-subtle">
                {description}
              </p>
            )}
          </div>
        </div>

        {actions && (
          <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
        )}
      </div>

      {toolbar && <div className="mt-5">{toolbar}</div>}
    </div>
  );
}

/** Section divider inside a long page. */
export function SectionHeading({
  title,
  description,
  actions,
  className,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('mb-3 flex items-end justify-between gap-4', className)}>
      <div className="min-w-0">
        <h2 className="text-2xs font-semibold uppercase tracking-[0.09em] text-ink-faint">
          {title}
        </h2>
        {description && (
          <p className="mt-1 text-sm text-ink-subtle">{description}</p>
        )}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}
