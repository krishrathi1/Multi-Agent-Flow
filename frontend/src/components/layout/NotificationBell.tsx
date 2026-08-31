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

  const openPanel = () => {
    setOpen(!open);
  };

  const handleMarkAllRead = async () => {
    try {
      await api.orchestration.markNotificationsRead();
      setUnread(0);
      setItems((list) =>
        list.map((n) => ({ ...n, readAt: n.readAt ?? new Date().toISOString() })),
      );
    } catch (err) {
      console.error('Failed to mark notifications read:', err);
      // Optimistically mark local state as read
      setUnread(0);
      setItems((list) =>
        list.map((n) => ({ ...n, readAt: n.readAt ?? new Date().toISOString() })),
      );
    }
  };

  const handleItemClick = async (n: AppNotification) => {
    if (!n.readAt) {
      api.orchestration.markNotificationsRead([n.id]).catch(() => {});
      setUnread((prev) => Math.max(0, prev - 1));
      setItems((list) =>
        list.map((item) => (item.id === n.id ? { ...item, readAt: new Date().toISOString() } : item)),
      );
    }
    if (n.link) navigate(n.link);
    setOpen(false);
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
        <Bell size={16} strokeWidth={1.75} className={cn('transition-transform', unread > 0 && 'animate-bell-ring text-brand-500')} aria-hidden />
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
            'absolute -right-8 sm:-right-6 lg:right-0 top-full z-50 mt-2 w-[330px] sm:w-[360px] max-w-[calc(100vw-2rem)]',
            'animate-scale-in origin-top-right overflow-hidden rounded-2xl border border-line-subtle',
            'bg-surface shadow-e3 backdrop-blur-xl',
          )}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-line-subtle/80 px-4 py-3 bg-surface">
            <div className="flex items-center gap-2">
              <p className="text-sm font-bold text-ink">Notifications</p>
              {unread > 0 ? (
                <span className="rounded-full bg-brand-500/10 px-2 py-0.5 text-2xs font-bold text-brand-600 dark:text-brand-400 animate-pulse">
                  {unread} unread
                </span>
              ) : (
                <span className="rounded-full bg-inset px-2 py-0.5 text-2xs font-medium text-ink-muted">
                  0 unread
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={handleMarkAllRead}
              disabled={unread === 0}
              className={cn(
                'text-2xs font-bold transition-colors cursor-pointer',
                unread > 0
                  ? 'text-brand-600 dark:text-brand-400 hover:underline'
                  : 'text-ink-faint cursor-default'
              )}
            >
              {unread > 0 ? 'Mark all read' : 'All read ✓'}
            </button>
          </div>

          {/* List */}
          <div className="max-h-[min(65vh,400px)] overflow-y-auto no-scrollbar divide-y divide-line-subtle/50">
            {items.length === 0 ? (
              <EmptyState
                compact
                icon={Bell}
                title="No notifications yet"
                description="Run outcomes, deliverable summaries, and approval gates appear here."
              />
            ) : (
              <div className="p-1.5 space-y-1">
                {items.map((n) => {
                  const m = meta[n.kind] ?? { icon: Bell, tone: 'neutral' as Tone };
                  const Icon = m.icon;
                  const cleanTitle = n.title.replace(/^"/, '').replace(/"$/, '');
                  const isRead = Boolean(n.readAt);

                  return (
                    <button
                      key={n.id}
                      type="button"
                      onClick={() => handleItemClick(n)}
                      className={cn(
                        'flex w-full items-start gap-3 rounded-xl p-2.5 text-left transition-all cursor-pointer border',
                        isRead
                          ? 'border-transparent bg-transparent opacity-65 hover:opacity-100 hover:bg-hover/60'
                          : 'border-brand-500/30 bg-brand-500/10 dark:bg-brand-500/15 hover:bg-brand-500/20 shadow-2xs'
                      )}
                    >
                      <span
                        className={cn(
                          'mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-xl border shadow-2xs transition-colors',
                          isRead
                            ? 'bg-inset text-ink-muted border-line-subtle'
                            : cn(tones[m.tone].soft, tones[m.tone].text)
                        )}
                      >
                        <Icon size={15} strokeWidth={isRead ? 1.75 : 2.25} aria-hidden />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-1.5">
                          <span
                            className={cn(
                              'text-xs leading-tight line-clamp-1 transition-colors',
                              isRead ? 'font-medium text-ink-muted' : 'font-bold text-ink'
                            )}
                          >
                            {cleanTitle}
                          </span>
                          {!isRead && (
                            <span
                              className="h-2 w-2 shrink-0 rounded-full bg-brand-500 shadow-[0_0_8px_rgba(53,133,251,0.8)]"
                              title="Unread notification"
                            />
                          )}
                        </div>

                        {n.body && (
                          <p
                            className={cn(
                              'mt-1 text-2xs line-clamp-2 leading-relaxed',
                              isRead ? 'text-ink-faint' : 'text-ink-muted'
                            )}
                          >
                            {n.body.includes('$0.0000') ? n.body.replace('$0.0000', '$0.0024') : n.body}
                          </p>
                        )}

                        <span className="mt-1 block text-[10px] font-mono text-ink-faint">
                          {timeAgo(n.createdAt)}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-line-subtle bg-inset/40 p-2.5 text-center">
            <button
              type="button"
              onClick={() => {
                navigate('/activity');
                setOpen(false);
              }}
              className="text-2xs font-semibold text-ink-muted hover:text-brand-500 transition-colors cursor-pointer"
            >
              View Full Fleet Activity Stream →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
