import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, Layers, Workflow } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useProcessStore } from '../../stores/process-store';
import { tones, type Tone } from '../../lib/design';
import { Chip } from '../ui/Badge';

/** A process stores its tint as a tone name; fall back if it's unset/unknown. */
export function processTone(color?: string | null): Tone {
  const known: Tone[] = ['brand', 'accent', 'success', 'warning', 'info', 'danger'];
  return known.includes(color as Tone) ? (color as Tone) : 'brand';
}

/**
 * Production-chain scope picker.
 *
 * Selection lives in the process store, so choosing a chain on the Activity
 * Feed also scopes the Timeline, Network Graph and Communications — the
 * operator picks a production once and the whole console follows.
 */
export function ProcessScope({
  className,
  align = 'left',
  label = 'Production',
}: {
  className?: string;
  align?: 'left' | 'right';
  label?: string;
}) {
  const { processes, scopeId, setScope, fetchProcesses } = useProcessStore();
  const [open, setOpen] = useState(false);
  const [placement, setPlacement] = useState<'left' | 'right'>(align);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (processes.length === 0) fetchProcesses();
  }, [processes.length, fetchProcesses]);

  useEffect(() => {
    if (!open || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const spaceRight = window.innerWidth - rect.left;
    const spaceLeft = rect.right;
    if (align === 'right' && spaceLeft < 295) {
      setPlacement('left');
    } else if (align === 'left' && spaceRight < 295) {
      setPlacement('right');
    } else {
      setPlacement(align);
    }
  }, [open, align]);

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

  const active = processes.find((p) => p.id === scopeId) ?? null;
  const activeTone = tones[processTone(active?.color)];

  return (
    <div ref={ref} className={cn('relative', className)}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`${label}: ${active ? active.name : 'All productions'}`}
        className={cn(
          'inline-flex h-8 w-full sm:w-auto max-w-[200px] xs:max-w-[240px] sm:max-w-[280px] items-center gap-2 rounded-md border px-2.5',
          'text-sm font-medium transition-colors duration-150',
          active
            ? cn(activeTone.soft, activeTone.text)
            : 'border-line bg-raised text-ink-muted hover:border-line-strong hover:text-ink',
        )}
      >
        {active ? (
          <span className={cn('h-2 w-2 shrink-0 rounded-full', activeTone.solid)} aria-hidden />
        ) : (
          <Layers size={14} strokeWidth={1.75} className="shrink-0" aria-hidden />
        )}
        <span className="truncate flex-1 text-left">{active ? active.name : 'All productions'}</span>
        <ChevronDown
          size={13}
          strokeWidth={2}
          className={cn('shrink-0 opacity-60 transition-transform', open && 'rotate-180')}
          aria-hidden
        />
      </button>

      {open && (
        <div
          role="listbox"
          className={cn(
            'absolute top-full z-50 mt-2 max-h-[420px] w-72 max-w-[calc(100vw-2rem)] overflow-y-auto animate-scale-in',
            'rounded-lg border border-line bg-overlay p-1 shadow-e4',
            placement === 'right' ? 'right-0 origin-top-right' : 'left-0 origin-top-left',
          )}
        >
          <button
            type="button"
            role="option"
            aria-selected={!scopeId}
            onClick={() => {
              setScope(null);
              setOpen(false);
            }}
            className={cn(
              'flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm',
              'transition-colors hover:wash',
              !scopeId ? 'font-medium text-ink' : 'text-ink-muted',
            )}
          >
            <Layers size={15} strokeWidth={1.75} className="shrink-0" aria-hidden />
            <span className="flex-1">All productions</span>
            {!scopeId && <Check size={14} strokeWidth={2.25} className="text-brand-500" aria-hidden />}
          </button>

          {processes.length > 0 && <div className="my-1 h-px bg-line-subtle" />}

          {processes.length === 0 ? (
            <p className="px-2.5 py-6 text-center text-xs text-ink-faint">
              No production chains yet.
            </p>
          ) : (
            processes.map((p) => {
              const t = tones[processTone(p.color)];
              const selected = p.id === scopeId;
              return (
                <button
                  key={p.id}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  onClick={() => {
                    setScope(p.id);
                    setOpen(false);
                  }}
                  className={cn(
                    'flex w-full items-start gap-2.5 rounded-md px-2.5 py-2 text-left',
                    'transition-colors hover:wash',
                  )}
                >
                  <span
                    className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full', t.solid)}
                    aria-hidden
                  />
                  <span className="min-w-0 flex-1">
                    <span
                      className={cn(
                        'block truncate text-sm',
                        selected ? 'font-medium text-ink' : 'text-ink-muted',
                      )}
                    >
                      {p.name}
                    </span>
                    <span className="mt-0.5 flex items-center gap-1.5 text-2xs text-ink-faint">
                      <Workflow size={10} strokeWidth={2} aria-hidden />
                      {p.agentCount} agent{p.agentCount === 1 ? '' : 's'}
                      <Chip>{p.status.toLowerCase()}</Chip>
                    </span>
                  </span>
                  {selected && (
                    <Check
                      size={14}
                      strokeWidth={2.25}
                      className="mt-1 shrink-0 text-brand-500"
                      aria-hidden
                    />
                  )}
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
