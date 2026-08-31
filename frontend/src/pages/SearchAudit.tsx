import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Download, ScanSearch, SearchX, X } from 'lucide-react';
import { api } from '@/lib/api';
import type { Activity, ActivityType } from '@/types';
import { cn, timeAgo } from '@/lib/utils';
import {
  activityIconFor,
  activityToneFor,
  activityLabel,
  tones,
  formatNumber,
} from '@/lib/design';
import { useAgentStore } from '@/stores/agent-store';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Avatar } from '@/components/ui/Avatar';
import { EmptyState, SkeletonRows } from '@/components/ui/States';

const ACTIVITY_TYPES: ActivityType[] = [
  'HEARTBEAT', 'TASK_START', 'TASK_COMPLETE', 'ERROR',
  'MESSAGE', 'DELEGATION', 'ALERT', 'SYSTEM',
];

const PAGE_SIZE = 50;

/** Splits on the query and marks matches. Builds a fresh non-global regex per
 *  call so `lastIndex` can't leak between segments. */
function highlight(text: string, query: string): React.ReactNode {
  const q = query.trim();
  if (!q) return text;
  const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const parts = text.split(new RegExp(`(${escaped})`, 'gi'));
  const probe = new RegExp(`^${escaped}$`, 'i');
  return parts.map((part, i) =>
    probe.test(part) ? (
      <mark
        key={i}
        className="rounded-[3px] bg-brand-500/25 px-0.5 font-medium text-brand-100"
      >
        {part}
      </mark>
    ) : (
      part
    ),
  );
}

/** Small filter pill used for both agent and type facets. */
function FilterPill({
  active,
  onClick,
  children,
  activeClass,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  activeClass?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-xs font-medium',
        'transition-colors duration-150',
        active
          ? activeClass ?? 'border-brand-500/35 bg-brand-500/15 text-brand-200'
          : 'border-line bg-raised text-ink-subtle hover:border-line-strong hover:text-ink',
      )}
    >
      {children}
    </button>
  );
}

export function SearchAudit() {
  const { agents, fetchAgents } = useAgentStore();
  const [searchParams, setSearchParams] = useSearchParams();

  // Seed from ?q= so the topbar's global search deep-links here.
  const [query, setQuery] = useState(() => searchParams.get('q') ?? '');
  const [debouncedQuery, setDebouncedQuery] = useState(query);
  const [filterAgent, setFilterAgent] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<ActivityType | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [offset, setOffset] = useState(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    fetchAgents();
  }, [fetchAgents]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedQuery(query);
      setOffset(0);
      setSearchParams(query.trim() ? { q: query.trim() } : {}, { replace: true });
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, setSearchParams]);

  useEffect(() => {
    setOffset(0);
  }, [filterAgent, filterType]);

  const fetchResults = useCallback(async () => {
    setLoading(true);
    try {
      if (debouncedQuery.trim()) {
        const result = await api.activities.search(debouncedQuery, {
          agentId: filterAgent || undefined,
          type: filterType || undefined,
          limit: PAGE_SIZE + offset,
        });
        setActivities(result.activities);
        setTotal(result.total);
      } else {
        const result = await api.activities.list({
          agentId: filterAgent || undefined,
          type: filterType || undefined,
          limit: PAGE_SIZE,
          offset,
        });
        setActivities((prev) =>
          offset === 0 ? result.activities : [...prev, ...result.activities],
        );
        setTotal(result.total);
      }
    } catch (err) {
      console.error('Search failed:', err);
    } finally {
      setLoading(false);
    }
  }, [debouncedQuery, filterAgent, filterType, offset]);

  useEffect(() => {
    fetchResults();
  }, [fetchResults]);

  const handleExport = () => {
    const blob = new Blob([JSON.stringify(activities, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `nexus-audit-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const activeFilterCount =
    (filterAgent ? 1 : 0) + (filterType ? 1 : 0) + (debouncedQuery.trim() ? 1 : 0);

  const resultLabel = useMemo(
    () => `${formatNumber(total)} result${total === 1 ? '' : 's'}`,
    [total],
  );

  return (
    <>
      <PageHeader
        icon={ScanSearch}
        title="Search & Audit"
        description="Full-text search across every agent event."
        actions={
          <Button
            variant="secondary"
            icon={Download}
            onClick={handleExport}
            disabled={activities.length === 0}
          >
            Export JSON
          </Button>
        }
      />

      {/* ---- Search ---- */}
      <div className="relative">
        <ScanSearch
          size={18}
          strokeWidth={1.75}
          className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-faint"
          aria-hidden
        />
        <label htmlFor="audit-search" className="sr-only">
          Search agent activity
        </label>
        <input
          id="audit-search"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search across all agent activity…"
          className={cn(
            'h-12 w-full rounded-xl border border-line bg-surface',
            'pl-12 pr-11 text-md text-ink placeholder:text-ink-faint',
            'transition-colors hover:border-line-strong',
            'focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/25',
          )}
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery('')}
            aria-label="Clear search"
            className="absolute right-3 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-md text-ink-faint transition-colors hover:wash hover:text-ink"
          >
            <X size={15} strokeWidth={2} aria-hidden />
          </button>
        )}
      </div>

      {/* ---- Facets ---- */}
      <Card className="mt-4 space-y-4">
        <div>
          <p className="mb-2 text-2xs font-semibold uppercase tracking-[0.09em] text-ink-faint">
            Agent
          </p>
          <div className="flex flex-wrap gap-1.5">
            <FilterPill active={!filterAgent} onClick={() => setFilterAgent(null)}>
              All agents
            </FilterPill>
            {agents.map((agent) => (
              <FilterPill
                key={agent.id}
                active={filterAgent === agent.id}
                onClick={() => setFilterAgent(filterAgent === agent.id ? null : agent.id)}
              >
                <Avatar name={agent.displayName} emoji={agent.avatar} size="xs" />
                {agent.displayName}
              </FilterPill>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-2 text-2xs font-semibold uppercase tracking-[0.09em] text-ink-faint">
            Activity type
          </p>
          <div className="flex flex-wrap gap-1.5">
            <FilterPill active={!filterType} onClick={() => setFilterType(null)}>
              All types
            </FilterPill>
            {ACTIVITY_TYPES.map((type) => {
              const Icon = activityIconFor(type);
              const t = tones[activityToneFor(type)];
              return (
                <FilterPill
                  key={type}
                  active={filterType === type}
                  activeClass={cn(t.soft, t.text)}
                  onClick={() => setFilterType(filterType === type ? null : type)}
                >
                  <Icon size={12} strokeWidth={2} aria-hidden />
                  {activityLabel[type]}
                </FilterPill>
              );
            })}
          </div>
        </div>
      </Card>

      {/* ---- Results ---- */}
      <div className="mb-3 mt-6 flex items-center justify-between gap-4">
        <p className="text-sm text-ink-subtle">
          <span className="font-medium tabular-nums text-ink">{resultLabel}</span>
          {debouncedQuery && <> for &ldquo;{debouncedQuery}&rdquo;</>}
        </p>
        {activeFilterCount > 0 && (
          <Button
            variant="ghost"
            size="xs"
            icon={X}
            onClick={() => {
              setQuery('');
              setFilterAgent(null);
              setFilterType(null);
            }}
          >
            Clear filters
          </Button>
        )}
      </div>

      {loading && activities.length === 0 ? (
        <SkeletonRows rows={6} />
      ) : activities.length === 0 ? (
        <Card padding="none">
          <EmptyState
            icon={SearchX}
            title={debouncedQuery ? 'No matching events' : 'No activity recorded'}
            description={
              debouncedQuery
                ? 'Try a shorter query, or clear the agent and type filters.'
                : 'Events will appear here once your agents start reporting.'
            }
            action={
              activeFilterCount > 0 ? (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setQuery('');
                    setFilterAgent(null);
                    setFilterType(null);
                  }}
                >
                  Clear filters
                </Button>
              ) : undefined
            }
          />
        </Card>
      ) : (
        <ul className="space-y-2">
          {activities.map((activity) => {
            const tone = activityToneFor(activity.type);
            const Icon = activityIconFor(activity.type);
            const t = tones[tone];

            return (
              <li
                key={activity.id}
                className={cn(
                  'flex items-start gap-3 rounded-lg border border-line-subtle',
                  'bg-surface p-3.5 transition-colors hover:bg-raised',
                )}
              >
                <span
                  className={cn(
                    'mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-md border',
                    t.soft,
                    t.text,
                  )}
                >
                  <Icon size={15} strokeWidth={1.75} aria-hidden />
                </span>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <Avatar
                      name={activity.agent?.displayName || 'System'}
                      emoji={activity.agent?.avatar}
                      size="xs"
                    />
                    <span className="text-sm font-medium text-ink">
                      {activity.agent?.displayName || 'System'}
                    </span>
                    <span
                      className={cn(
                        'text-2xs font-semibold uppercase tracking-[0.07em]',
                        t.text,
                      )}
                    >
                      {activityLabel[activity.type]}
                    </span>
                  </div>
                  <p className="mt-1 text-base leading-relaxed text-ink-muted">
                    {highlight(activity.message, debouncedQuery)}
                  </p>
                </div>

                <time
                  className="shrink-0 whitespace-nowrap pt-0.5 text-xs tabular-nums text-ink-faint"
                  dateTime={activity.createdAt}
                >
                  {timeAgo(activity.createdAt)}
                </time>
              </li>
            );
          })}
        </ul>
      )}

      {activities.length > 0 && activities.length < total && (
        <div className="mt-5 flex justify-center">
          <Button
            variant="secondary"
            loading={loading}
            onClick={() => setOffset((prev) => prev + PAGE_SIZE)}
          >
            Load more · {formatNumber(activities.length)} of {formatNumber(total)}
          </Button>
        </div>
      )}
    </>
  );
}
