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
            'absolute -right-8 sm:-right-6 lg:right-0 top-full z-50 mt-2 w-[330px] sm:w-[360px] max-w-[calc(100vw-2rem)]',
            'animate-scale-in origin-top-right overflow-hidden rounded-2xl border border-line-subtle',
            'bg-surface shadow-e3 backdrop-blur-xl',
          )}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-line-subtle/80 px-4 py-3 bg-surface">
            <div className="flex items-center gap-2">
              <p className="text-sm font-bold text-ink">Notifications</p>
              <span className="rounded-full bg-brand-500/10 px-2 py-0.5 text-2xs font-semibold text-brand-600 dark:text-brand-400">
                {items.length}
              </span>
            </div>
            <button
              type="button"
              onClick={async () => {
                await api.orchestration.markNotificationsRead().catch(() => {});
                setUnread(0);
                setItems((list) => list.map((n) => ({ ...n, readAt: new Date().toISOString() })));
              }}
              className="text-2xs font-medium text-brand-600 dark:text-brand-400 hover:underline cursor-pointer"
            >
              Mark all read
            </button>
          </div>

          {/* List */}
          <div className="max-h-[min(65vh,400px)] overflow-y-auto divide-y divide-line-subtle/50">
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
                  return (
                    <button
                      key={n.id}
                      type="button"
                      onClick={() => {
                        if (n.link) navigate(n.link);
                        setOpen(false);
                      }}
                      className={cn(
                        'flex w-full items-start gap-3 rounded-xl p-2.5 text-left transition-all cursor-pointer',
                        n.readAt
                          ? 'hover:bg-hover'
                          : 'bg-brand-500/5 hover:bg-brand-500/10',
                      )}
                    >
                      <span
                        className={cn(
                          'mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-xl border shadow-2xs',
                          tones[m.tone].soft,
                          tones[m.tone].text,
                        )}
                      >
                        <Icon size={15} strokeWidth={2} aria-hidden />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-1">
                          <span
                            className={cn(
                              'text-xs font-semibold leading-tight line-clamp-1',
                              n.readAt ? 'text-ink-subtle' : 'text-ink',
                            )}
                          >
                            {cleanTitle}
                          </span>
                          {!n.readAt && (
                            <span className="h-2 w-2 shrink-0 rounded-full bg-brand-500" />
                          )}
                        </div>

                        {n.body && (
                          <p className="mt-1 text-2xs text-ink-muted line-clamp-2 leading-relaxed">
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
