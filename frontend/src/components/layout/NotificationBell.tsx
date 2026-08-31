import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell,
  CalendarClock,
  CheckCircle2,
  CircleDollarSign,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import { api } from '../../lib/api';
import { cn, timeAgo } from '../../lib/utils';
import { tones, type Tone } from '../../lib/design';
import type { AppNotification, NotificationKind } from '../../types';
import { EmptyState } from '../ui/States';

const meta: Record<NotificationKind, { icon: typeof Bell; tone: Tone }> = {
  GATE_PENDING: { icon: ShieldCheck, tone: 'warning' },
  RUN_FAILED: { icon: XCircle, tone: 'danger' },
  RUN_COMPLETED: { icon: CheckCircle2, tone: 'success' },
  BUDGET_STOPPED: { icon: CircleDollarSign, tone: 'warning' },
  SCHEDULE_FIRED: { icon: CalendarClock, tone: 'info' },
};

/**
 * The bell used to be decorative. It now shows what actually happened —
 * gates waiting on a decision, runs that finished or failed, budget stops and
 * scheduled starts — so a chain that paused overnight is discoverable.
 */
export function NotificationBell() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<AppNotification[]>([]);
  const [unread, setUnread] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const res = await api.orchestration.notifications();
      setItems(res.items);
      setUnread(res.unread);
    } catch {
      /* transient — the bell is not worth surfacing an error for */
    }
  }, []);

  useEffect(() => {
    load();
    // Chains run for minutes; a slow poll is plenty and costs nothing.
    const t = setInterval(load, 30_000);
    return () => clearInterval(t);
  }, [load]);

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

  const openPanel = async () => {
    const next = !open;
    setOpen(next);
    // Opening the panel is the read receipt.
    if (next && unread > 0) {
      await api.orchestration.markNotificationsRead().catch(() => {});
      setUnread(0);
      setItems((list) => list.map((n) => ({ ...n, readAt: n.readAt ?? new Date().toISOString() })));
    }
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={openPanel}
        aria-label={unread > 0 ? `Notifications — ${unread} unread` : 'Notifications'}
        aria-expanded={open}
        className={cn(
          'relative grid h-8.5 w-8.5 place-items-center rounded-xl border border-line/70',
          'bg-surface/50 text-ink-subtle backdrop-blur-md shadow-xs',
          'transition-all duration-150 hover:border-brand-500/40 hover:bg-surface hover:text-ink hover:shadow-e1 active:scale-[0.98]',
          open && 'border-brand-500/50 bg-surface text-ink shadow-e1',
        )}
      >
        <Bell size={16} strokeWidth={1.75} aria-hidden />
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-[16px] items-center justify-center">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-75" />
            <span className="relative grid h-4 min-w-[16px] place-items-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white shadow-xs">
              {unread > 9 ? '9+' : unread}
            </span>
          </span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Notifications"
          className={cn(
            'absolute right-0 top-full z-50 mt-2 w-[min(24rem,calc(100vw-2rem))]',
            'animate-scale-in origin-top-right overflow-hidden rounded-lg border border-line',
            'bg-overlay shadow-e4',
          )}
        >
          <div className="flex items-center justify-between border-b border-line-subtle px-3 py-2">
            <p className="text-sm font-semibold text-ink">Notifications</p>
            <span className="text-2xs text-ink-faint">{items.length}</span>
          </div>

          <div className="max-h-[min(60vh,380px)] overflow-y-auto">
            {items.length === 0 ? (
              <EmptyState
                compact
                icon={Bell}
                title="Nothing yet"
                description="Run outcomes and approval gates appear here."
              />
            ) : (
              <ul className="p-1">
                {items.map((n) => {
                  const m = meta[n.kind] ?? { icon: Bell, tone: 'neutral' as Tone };
                  const Icon = m.icon;
                  return (
                    <li key={n.id}>
                      <button
                        type="button"
                        onClick={() => {
                          if (n.link) navigate(n.link);
                          setOpen(false);
                        }}
                        className="flex w-full items-start gap-2.5 rounded-md p-2 text-left transition-colors hover:wash"
                      >
                        <span
                          className={cn(
                            'mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-md border',
                            tones[m.tone].soft,
                            tones[m.tone].text,
                          )}
                        >
                          <Icon size={13} strokeWidth={1.75} aria-hidden />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span
                            className={cn(
                              'block truncate text-sm',
                              n.readAt ? 'text-ink-muted' : 'font-medium text-ink',
                            )}
                          >
                            {n.title}
                          </span>
                          {n.body && (
                            <span className="mt-0.5 block truncate text-2xs text-ink-subtle">
                              {n.body}
                            </span>
                          )}
                          <span className="mt-0.5 block text-2xs text-ink-faint">
                            {timeAgo(n.createdAt)}
                          </span>
                        </span>
                        {!n.readAt && (
                          <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-500" />
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
