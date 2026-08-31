import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { cn } from '../../lib/utils';

export interface Option<T extends string = string> {
  value: T;
  label: string;
  badge?: string;
  icon?: React.ComponentType<{ size?: number; className?: string }>;
}

export interface CustomSelectProps<T extends string = string> {
  value: T;
  onChange: (value: T) => void;
  options: Option<T>[];
  placeholder?: string;
  className?: string;
  buttonClassName?: string;
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  /** When true the dropdown opens upward (above the trigger). Use near bottom of modal. */
  upward?: boolean;
}

export function CustomSelect<T extends string = string>({
  value,
  onChange,
  options,
  placeholder = 'Select option...',
  className,
  buttonClassName,
  size = 'md',
  disabled = false,
  upward = false,
}: CustomSelectProps<T>) {
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((o) => o.value === value);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const sizeClasses = {
    sm: 'h-8 px-2.5 text-2xs',
    md: 'h-9 px-3 text-xs',
    lg: 'h-10 px-3.5 text-xs',
  };

  return (
    <div className={cn('relative inline-block w-full', open ? 'z-50' : 'z-10', className)} ref={dropdownRef}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(!open)}
        className={cn(
          'flex w-full items-center justify-between gap-2 rounded-xl border border-line bg-surface font-semibold text-ink shadow-2xs transition-all hover:border-brand-500/50 hover:bg-hover active:scale-[0.99] cursor-pointer text-left outline-none focus:outline-none focus-visible:outline-none focus:ring-2 focus:ring-brand-500/20',
          sizeClasses[size],
          open && 'border-brand-500 ring-2 ring-brand-500/10',
          disabled && 'opacity-50 cursor-not-allowed pointer-events-none',
          buttonClassName
        )}
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {selectedOption?.icon && (
            <selectedOption.icon size={size === 'sm' ? 12 : 14} className="shrink-0 text-brand-500" />
          )}
          <span className="truncate">{selectedOption?.label || placeholder}</span>
        </div>
        <ChevronDown
          size={size === 'sm' ? 12 : 14}
          className={cn(
            'shrink-0 text-ink-muted transition-transform duration-200',
            open && (upward ? '-rotate-180 text-brand-500' : 'rotate-180 text-brand-500')
          )}
        />
      </button>

      {open && (
        <div
          className={cn(
            'absolute left-0 right-0 z-50 max-h-60 overflow-y-auto rounded-2xl border border-line bg-surface p-1.5 shadow-2xl space-y-1 animate-scale-in no-scrollbar',
            upward ? 'bottom-full mb-1.5' : 'top-full mt-1.5'
          )}
        >
          {options.map((opt) => {
            const isSelected = opt.value === value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  onChange(opt.value);
                  setOpen(false);
                }}
                className={cn(
                  'flex w-full items-center justify-between gap-2.5 rounded-xl px-2.5 py-2 text-xs font-semibold transition-colors cursor-pointer text-left',
                  isSelected
                    ? 'bg-brand-500/10 text-brand-600 dark:text-brand-400 font-bold'
                    : 'text-ink-muted hover:bg-hover hover:text-ink'
                )}
              >
                <div className="flex items-center gap-2 min-w-0">
                  {opt.icon && (
                    <opt.icon size={13} className="shrink-0 text-brand-500" />
                  )}
                  <span className="truncate">{opt.label}</span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {opt.badge && (
                    <span className="px-1.5 py-0.2 rounded-md bg-inset border border-line-subtle text-[10px] font-mono text-ink-muted">
                      {opt.badge}
                    </span>
                  )}
                  {isSelected && (
                    <Check size={13} className="text-brand-600 dark:text-brand-400" />
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
