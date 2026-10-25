import { forwardRef } from 'react';
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, type LucideIcon } from 'lucide-react';
import { cn } from '../../lib/utils';

export type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'ghost'
  | 'outline'
  | 'danger'
  | 'subtle';

export type ButtonSize = 'xs' | 'sm' | 'md' | 'lg';

/* Every control lands on a 4px rhythm and clears the 36px minimum hit height
   (sm and up). `xs` exists only for dense toolbars where the row itself
   provides the touch target. */
const sizes: Record<ButtonSize, string> = {
  xs: 'h-7 px-2 text-xs gap-1.5 rounded-sm',
  sm: 'h-8 px-2.5 text-sm gap-1.5 rounded-md',
  md: 'h-9 px-3.5 text-base gap-2 rounded-md',
  lg: 'h-11 px-5 text-md gap-2 rounded-lg',
};

const iconOnlySizes: Record<ButtonSize, string> = {
  xs: 'h-7 w-7 rounded-sm',
  sm: 'h-8 w-8 rounded-md',
  md: 'h-9 w-9 rounded-md',
  lg: 'h-11 w-11 rounded-lg',
};

const variants: Record<ButtonVariant, string> = {
  primary:
    'bg-brand-600 text-white shadow-e1 hover:bg-brand-500 active:bg-brand-700 ' +
    'disabled:bg-brand-600/40 disabled:text-white/60',
  secondary:
    'bg-raised text-ink border border-line ' +
    'hover:bg-hover hover:border-line-strong active:bg-overlay',
  outline:
    'bg-transparent text-ink-muted border border-line ' +
    'hover:text-ink hover:wash hover:border-line-strong',
  ghost:
    'bg-transparent text-ink-muted hover:text-ink hover:wash ' +
    'active:wash-strong',
  subtle:
    'bg-brand-500/10 text-brand-700 dark:text-brand-300 border border-brand-600/20 dark:border-brand-500/20 ' +
    'hover:bg-brand-500/16 hover:text-brand-800 dark:hover:text-brand-200 hover:border-brand-600/35 dark:hover:border-brand-500/35',
  danger:
    'bg-red-600 text-white shadow-e1 hover:bg-red-500 active:bg-red-700 ' +
    'disabled:bg-red-600/40',
};

const iconSize: Record<ButtonSize, number> = { xs: 13, sm: 14, md: 16, lg: 18 };

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Leading icon. Pass the component itself, not an element. */
  icon?: LucideIcon;
  /** Trailing icon, e.g. a chevron or external-link marker. */
  trailingIcon?: LucideIcon;
  /** Shows a spinner and blocks interaction. */
  loading?: boolean;
  /** Renders a square icon button — `aria-label` becomes required. */
  iconOnly?: boolean;
  fullWidth?: boolean;
  children?: ReactNode;
}

/**
 * The single button in the product. Variants carry their own hover/active/
 * disabled states so no screen has to reinvent them.
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'secondary',
    size = 'md',
    icon: Icon,
    trailingIcon: TrailingIcon,
    loading = false,
    iconOnly = false,
    fullWidth = false,
    className,
    children,
    disabled,
    type = 'button',
    ...props
  },
  ref,
) {
  const isDisabled = disabled || loading;
  const px = iconSize[size];

  return (
    <button
      ref={ref}
      type={type}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      className={cn(
        'relative inline-flex items-center justify-center font-medium whitespace-nowrap',
        'transition-colors duration-150 select-none',
        'disabled:opacity-50 disabled:pointer-events-none',
        iconOnly ? iconOnlySizes[size] : sizes[size],
        variants[variant],
        fullWidth && 'w-full',
        className,
      )}
      {...props}
    >
      {loading ? (
        <Loader2 size={px} className="animate-spin-slow shrink-0" aria-hidden />
      ) : (
        Icon && <Icon size={px} strokeWidth={1.75} className="shrink-0" aria-hidden />
      )}
      {!iconOnly && children}
      {!iconOnly && !loading && TrailingIcon && (
        <TrailingIcon size={px} strokeWidth={1.75} className="shrink-0 opacity-70" aria-hidden />
      )}
    </button>
  );
});

export interface ButtonLinkProps
  extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> {
  /** Internal route. Use `href` instead for external destinations. */
  to?: string;
  href?: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: LucideIcon;
  trailingIcon?: LucideIcon;
  iconOnly?: boolean;
  fullWidth?: boolean;
  children?: ReactNode;
}

/**
 * A navigation control that looks like a button. Separate from <Button> so we
 * never nest an <a> inside a <button> — that is invalid HTML and breaks both
 * keyboard activation and screen-reader semantics.
 */
export function ButtonLink({
  to,
  href,
  variant = 'secondary',
  size = 'md',
  icon: Icon,
  trailingIcon: TrailingIcon,
  iconOnly = false,
  fullWidth = false,
  className,
  children,
  ...props
}: ButtonLinkProps) {
  const px = iconSize[size];

  const classes = cn(
    'relative inline-flex items-center justify-center font-medium whitespace-nowrap',
    'transition-colors duration-150 select-none',
    iconOnly ? iconOnlySizes[size] : sizes[size],
    variants[variant],
    fullWidth && 'w-full',
    className,
  );

  const content = (
    <>
      {Icon && <Icon size={px} strokeWidth={1.75} className="shrink-0" aria-hidden />}
      {!iconOnly && children}
      {!iconOnly && TrailingIcon && (
        <TrailingIcon size={px} strokeWidth={1.75} className="shrink-0 opacity-70" aria-hidden />
      )}
    </>
  );

  if (to) {
    return (
      <Link to={to} className={classes} {...props}>
        {content}
      </Link>
    );
  }

  return (
    <a
      href={href}
      className={classes}
      {...(href?.startsWith('http')
        ? { target: '_blank', rel: 'noopener noreferrer' }
        : {})}
      {...props}
    >
      {content}
    </a>
  );
}
