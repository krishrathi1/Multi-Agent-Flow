import { useEffect, useRef, useState } from 'react';
import { Check, Monitor, Moon, Sun, type LucideIcon } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useUiStore } from '../../stores/ui-store';
import type { ThemePreference } from '../../lib/theme';

const options: Array<{ value: ThemePreference; label: string; icon: LucideIcon }> = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
];

/**
 * Theme picker. A menu rather than a bare toggle, because "system" is a real
 * third state — a two-way switch can't express "follow the OS".
 */
export function ThemeToggle() {
  const themePreference = useUiStore((s) => s.themePreference);
  const setThemePreference = useUiStore((s) => s.setThemePreference);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const active = options.find((o) => o.value === themePreference) ?? options[2];
  const ActiveIcon = active.icon;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Theme: ${active.label}. Change theme`}
        title={`Theme: ${active.label}`}
        className={cn(
          'grid h-8.5 w-8.5 place-items-center rounded-xl border border-line/70',
          'bg-surface/50 text-ink-subtle backdrop-blur-md shadow-xs',
          'transition-all duration-150 hover:border-brand-500/40 hover:bg-surface hover:text-ink hover:shadow-e1 active:scale-[0.98]',
          open && 'border-brand-500/50 bg-surface text-ink shadow-e1',
        )}
      >
        <ActiveIcon size={16} strokeWidth={1.75} aria-hidden />
      </button>

      {open && (
        <div
          role="menu"
          className={cn(
            'absolute right-0 top-full z-50 mt-2 w-40 animate-scale-in origin-top-right',
            'rounded-lg border border-line bg-overlay p-1 shadow-e4',
          )}
        >
          {options.map((opt) => {
            const Icon = opt.icon;
            const selected = opt.value === themePreference;
            return (
              <button
                key={opt.value}
                type="button"
                role="menuitemradio"
                aria-checked={selected}
                onClick={() => {
                  setThemePreference(opt.value);
                  setOpen(false);
                }}
                className={cn(
                  'flex h-8 w-full items-center gap-2.5 rounded-md px-2.5 text-sm',
                  'transition-colors hover:wash',
                  selected ? 'font-medium text-ink' : 'text-ink-muted',
                )}
              >
                <Icon size={15} strokeWidth={1.75} aria-hidden />
                {opt.label}
                {selected && (
                  <Check size={14} strokeWidth={2.25} className="ml-auto text-brand-400" aria-hidden />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
