import { forwardRef, useId } from 'react';
import type {
  InputHTMLAttributes,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
  ReactNode,
} from 'react';
import { AlertCircle, ChevronDown, Search, type LucideIcon } from 'lucide-react';
import { cn } from '../../lib/utils';

/* One field shell shared by input / select / textarea so borders, focus rings
   and error states are identical across every form in the product. */
const fieldBase =
  'w-full bg-inset border rounded-xl text-ink outline-none focus:outline-none focus-visible:outline-none ' +
  'placeholder:text-ink-faint transition-colors duration-150 ' +
  'disabled:opacity-50 disabled:cursor-not-allowed';

const fieldIdle =
  'border-line hover:border-line-strong ' +
  'focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/25';

const fieldError =
  'border-red-500/60 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/25';

interface FieldShellProps {
  label?: string;
  /** Persistent guidance under the field — not a placeholder. */
  hint?: string;
  error?: string;
  required?: boolean;
  htmlFor?: string;
  className?: string;
  children: ReactNode;
}

/** Label + control + hint/error, wired for screen readers. */
export function Field({
  label,
  hint,
  error,
  required,
  htmlFor,
  className,
  children,
}: FieldShellProps) {
  return (
    <div className={cn('space-y-1.5', className)}>
      {label && (
        <label
          htmlFor={htmlFor}
          className="flex items-center gap-1 text-sm font-medium text-ink-muted"
        >
          {label}
          {required && (
            <span className="text-red-400" aria-hidden>
              *
            </span>
          )}
          {required && <span className="sr-only">(required)</span>}
        </label>
      )}
      {children}
      {error ? (
        <p
          role="alert"
          className="flex items-start gap-1.5 text-xs text-red-300"
        >
          <AlertCircle size={13} strokeWidth={2} className="mt-px shrink-0" aria-hidden />
          {error}
        </p>
      ) : (
        hint && <p className="text-xs text-ink-faint">{hint}</p>
      )}
    </div>
  );
}

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  error?: string;
  icon?: LucideIcon;
  /** Element pinned to the right inside the field (e.g. a clear button). */
  trailing?: ReactNode;
  wrapperClassName?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, hint, error, icon: Icon, trailing, className, wrapperClassName, id, required, ...props },
  ref,
) {
  const autoId = useId();
  const inputId = id ?? autoId;

  return (
    <Field
      label={label}
      hint={hint}
      error={error}
      required={required}
      htmlFor={inputId}
      className={wrapperClassName}
    >
      <div className="relative">
        {Icon && (
          <Icon
            size={15}
            strokeWidth={1.75}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint"
            aria-hidden
          />
        )}
        <input
          ref={ref}
          id={inputId}
          required={required}
          aria-invalid={error ? true : undefined}
          className={cn(
            fieldBase,
            error ? fieldError : fieldIdle,
            'h-9 text-base',
            Icon ? 'pl-9' : 'pl-3',
            trailing ? 'pr-9' : 'pr-3',
            className,
          )}
          {...props}
        />
        {trailing && (
          <div className="absolute right-2 top-1/2 -translate-y-1/2">{trailing}</div>
        )}
      </div>
    </Field>
  );
});

/** Standalone search box for toolbars. */
export const SearchInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function SearchInput({ className, ...props }, ref) {
    return (
      <div className="relative">
        <Search
          size={15}
          strokeWidth={1.75}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint"
          aria-hidden
        />
        <input
          ref={ref}
          type="search"
          className={cn(fieldBase, fieldIdle, 'h-9 pl-9 pr-3 text-base', className)}
          {...props}
        />
      </div>
    );
  },
);

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  hint?: string;
  error?: string;
  wrapperClassName?: string;
  options?: Array<{ value: string; label: string }>;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, hint, error, className, wrapperClassName, id, required, children, options, ...props },
  ref,
) {
  const autoId = useId();
  const selectId = id ?? autoId;

  return (
    <Field
      label={label}
      hint={hint}
      error={error}
      required={required}
      htmlFor={selectId}
      className={wrapperClassName}
    >
      <div className="relative">
        <select
          ref={ref}
          id={selectId}
          required={required}
          aria-invalid={error ? true : undefined}
          className={cn(
            fieldBase,
            error ? fieldError : fieldIdle,
            'h-9 appearance-none pl-3 pr-9 text-base',
            className,
          )}
          {...props}
        >
          {options
            ? options.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))
            : children}
        </select>
        <ChevronDown
          size={15}
          strokeWidth={1.75}
          className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-ink-faint"
          aria-hidden
        />
      </div>
    </Field>
  );
});

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  hint?: string;
  error?: string;
  wrapperClassName?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { label, hint, error, className, wrapperClassName, id, required, ...props },
  ref,
) {
  const autoId = useId();
  const areaId = id ?? autoId;

  return (
    <Field
      label={label}
      hint={hint}
      error={error}
      required={required}
      htmlFor={areaId}
      className={wrapperClassName}
    >
      <textarea
        ref={ref}
        id={areaId}
        required={required}
        aria-invalid={error ? true : undefined}
        className={cn(
          fieldBase,
          error ? fieldError : fieldIdle,
          'min-h-[84px] resize-y px-3 py-2 text-base leading-relaxed',
          className,
        )}
        {...props}
      />
    </Field>
  );
});

/** Accessible on/off switch. */
export function Toggle({
  checked,
  onChange,
  label,
  description,
  disabled,
  id,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  description?: string;
  disabled?: boolean;
  id?: string;
}) {
  const autoId = useId();
  const toggleId = id ?? autoId;

  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <label htmlFor={toggleId} className="text-base font-medium text-ink">
          {label}
        </label>
        {description && (
          <p className="mt-0.5 text-sm text-ink-subtle">{description}</p>
        )}
      </div>
      <button
        id={toggleId}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative h-6 w-10 shrink-0 rounded-full transition-colors duration-200',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          checked ? 'bg-brand-600' : 'bg-line-strong',
        )}
      >
        <span
          className={cn(
            'absolute top-1 h-4 w-4 rounded-full bg-white shadow-e1',
            'transition-transform duration-200 ease-[cubic-bezier(0.16,1,0.3,1)]',
            checked ? 'translate-x-5' : 'translate-x-1',
          )}
        />
      </button>
    </div>
  );
}
