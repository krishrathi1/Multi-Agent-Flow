import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react';
import { cn } from '../../lib/utils';
import { tones, type Tone } from '../../lib/design';

/**
 * Toasts for async actions that would otherwise fail silently.
 *
 * Announced via aria-live so screen readers hear them, and they never steal
 * focus — a toast interrupting a keyboard user mid-task is worse than the
 * missing feedback it replaces.
 */

export interface Toast {
  id: string;
  title: string;
  description?: string;
  tone: Extract<Tone, 'success' | 'danger' | 'warning' | 'info'>;
  /** ms before auto-dismiss; 0 pins it until dismissed. */
  duration: number;
}

interface ToastApi {
  success: (title: string, description?: string) => void;
  error: (title: string, description?: string) => void;
  warning: (title: string, description?: string) => void;
  info: (title: string, description?: string) => void;
  dismiss: (id: string) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}

const icons = {
  success: CheckCircle2,
  danger: XCircle,
  warning: AlertTriangle,
  info: Info,
} as const;

let seq = 0;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((list) => list.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (tone: Toast['tone'], title: string, description?: string) => {
      const id = `t${++seq}`;
      // Errors stay until dismissed — they usually need action.
      const duration = tone === 'danger' ? 0 : 5000;
      setToasts((list) => [...list.slice(-3), { id, title, description, tone, duration }]);
    },
    [],
  );

  const api: ToastApi = {
    success: (t, d) => push('success', t, d),
    error: (t, d) => push('danger', t, d),
    warning: (t, d) => push('warning', t, d),
    info: (t, d) => push('info', t, d),
    dismiss,
  };

  return (
    <ToastContext.Provider value={api}>
      {children}
      {createPortal(
        <div
          role="region"
          aria-label="Notifications"
          className="pointer-events-none fixed bottom-4 right-4 z-[200] flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-2"
        >
          {toasts.map((t) => (
            <ToastItem key={t.id} toast={t} onDismiss={dismiss} />
          ))}
        </div>,
        document.body,
      )}
    </ToastContext.Provider>
  );
}

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: (id: string) => void }) {
  const Icon = icons[toast.tone];
  const t = tones[toast.tone];

  useEffect(() => {
    if (toast.duration === 0) return;
    const timer = setTimeout(() => onDismiss(toast.id), toast.duration);
    return () => clearTimeout(timer);
  }, [toast, onDismiss]);

  return (
    <div
      // polite, not assertive: it must not interrupt what's being read.
      aria-live="polite"
      className={cn(
        'pointer-events-auto flex animate-slide-in-right items-start gap-2.5 rounded-lg border',
        'bg-overlay p-3 shadow-e4',
        t.border,
      )}
    >
      <Icon size={16} strokeWidth={1.75} className={cn('mt-0.5 shrink-0', t.text)} aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-ink">{toast.title}</p>
        {toast.description && (
          <p className="mt-0.5 text-xs leading-relaxed text-ink-subtle">{toast.description}</p>
        )}
      </div>
      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        aria-label="Dismiss notification"
        className="grid h-6 w-6 shrink-0 place-items-center rounded-sm text-ink-faint transition-colors hover:wash hover:text-ink"
      >
        <X size={13} strokeWidth={2} aria-hidden />
      </button>
    </div>
  );
}
