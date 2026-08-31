import { useEffect, useState, useCallback } from 'react';
import { Header } from '../components/layout/Header';
import { api } from '@/lib/api';
import { cn, timeAgo } from '@/lib/utils';
import type { AlertRule, AlertEvent, Severity } from '@/types';
import { Bell, ShieldAlert, CheckCircle2, AlertTriangle, Info, Plus } from 'lucide-react';
import { Button } from '@/components/ui/Button';

const severityConfig: Record<Severity, { color: string; bg: string; border: string; label: string }> = {
  INFO: { color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/30', label: 'Info' },
  WARNING: { color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/30', label: 'Warning' },
  CRITICAL: { color: 'text-rose-600 dark:text-rose-400', bg: 'bg-rose-500/10', border: 'border-rose-500/30', label: 'Critical' },
};

export function Alerts() {
  const [events, setEvents] = useState<AlertEvent[]>([]);
  const [rules, setRules] = useState<AlertRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [severityFilter, setSeverityFilter] = useState<Severity | 'ALL'>('ALL');
  const [ackFilter, setAckFilter] = useState<'all' | 'unacknowledged' | 'acknowledged'>('all');
  const [showAddRule, setShowAddRule] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [evts, rls] = await Promise.all([api.alerts.events(), api.alerts.rules()]);
      setEvents(evts);
      setRules(rls);
    } catch (err) {
      console.error('Failed to fetch alert data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleAcknowledge = async (id: string) => {
    try {
      const updated = await api.alerts.acknowledge(id);
      setEvents((prev) => prev.map((e) => (e.id === id ? updated : e)));
    } catch (err) {
      console.error('Failed to acknowledge event:', err);
    }
  };

  const handleToggleRule = async (rule: AlertRule) => {
    try {
      const updated = await api.alerts.updateRule(rule.id, { enabled: !rule.enabled });
      setRules((prev) => prev.map((r) => (r.id === rule.id ? updated : r)));
    } catch (err) {
      console.error('Failed to toggle rule:', err);
    }
  };

  const handleCreateRule = async (data: {
    name: string;
    condition: string;
    threshold: number;
    windowMinutes: number;
  }) => {
    try {
      const rule = await api.alerts.createRule(data);
      setRules((prev) => [rule, ...prev]);
      setShowAddRule(false);
    } catch (err) {
      console.error('Failed to create rule:', err);
    }
  };

  const unacknowledged = events.filter((e) => !e.acknowledged);
  const criticalCount = unacknowledged.filter((e) => e.severity === 'CRITICAL').length;
  const warningCount = unacknowledged.filter((e) => e.severity === 'WARNING').length;
  const infoCount = unacknowledged.filter((e) => e.severity === 'INFO').length;

  const filteredEvents = events.filter((e) => {
    if (severityFilter !== 'ALL' && e.severity !== severityFilter) return false;
    if (ackFilter === 'unacknowledged' && e.acknowledged) return false;
    if (ackFilter === 'acknowledged' && !e.acknowledged) return false;
    return true;
  });

  if (loading) {
    return (
      <div className="space-y-6">
        <Header title="Alerts & Telemetry" subtitle="Monitor autonomous agent alert rules, events, and anomaly thresholds" />
        <div className="text-ink-muted text-xs p-6">Loading alert telemetry...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Header title="Alerts & Telemetry" subtitle="Monitor autonomous agent alert rules, events, and anomaly thresholds" />

      {/* Active Alerts Banner */}
      {unacknowledged.length > 0 && (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/5 p-4 flex flex-wrap items-center justify-between gap-4 shadow-2xs">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2.5">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500"></span>
              </span>
              <span className="text-sm font-bold text-ink">
                {unacknowledged.length} Unacknowledged Alert{unacknowledged.length !== 1 ? 's' : ''}
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              {criticalCount > 0 && (
                <span className="px-2.5 py-0.5 rounded-md bg-rose-500/15 border border-rose-500/30 text-rose-700 dark:text-rose-300 font-bold">
                  {criticalCount} Critical
                </span>
              )}
              {warningCount > 0 && (
                <span className="px-2.5 py-0.5 rounded-md bg-amber-500/15 border border-amber-500/30 text-amber-700 dark:text-amber-300 font-bold">
                  {warningCount} Warning
                </span>
              )}
              {infoCount > 0 && (
                <span className="px-2.5 py-0.5 rounded-md bg-blue-500/15 border border-blue-500/30 text-blue-700 dark:text-blue-300 font-bold">
                  {infoCount} Info
                </span>
              )}
            </div>
          </div>
          <Button
            size="xs"
            variant="secondary"
            onClick={async () => {
              for (const e of unacknowledged) {
                await handleAcknowledge(e.id);
              }
            }}
          >
            Acknowledge All
          </Button>
        </div>
      )}

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Left: Alert Events (3 columns) */}
        <div className="lg:col-span-3 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-ink">Alert Events ({filteredEvents.length})</h3>
            <div className="flex items-center gap-2">
              <select
                value={severityFilter}
                onChange={(e) => setSeverityFilter(e.target.value as Severity | 'ALL')}
                className="text-xs font-semibold bg-canvas border border-line text-ink rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-brand-500 shadow-2xs"
              >
                <option value="ALL">All Severities</option>
                <option value="CRITICAL">Critical</option>
                <option value="WARNING">Warning</option>
                <option value="INFO">Info</option>
              </select>

              <select
                value={ackFilter}
                onChange={(e) => setAckFilter(e.target.value as 'all' | 'unacknowledged' | 'acknowledged')}
                className="text-xs font-semibold bg-canvas border border-line text-ink rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-brand-500 shadow-2xs"
              >
                <option value="all">All Status</option>
                <option value="unacknowledged">Unacknowledged</option>
                <option value="acknowledged">Acknowledged</option>
              </select>
            </div>
          </div>

          <div className="space-y-2.5 max-h-[calc(100vh-300px)] overflow-y-auto pr-1">
            {filteredEvents.length === 0 ? (
              <div className="bg-surface rounded-xl border border-line p-8 text-center text-ink-muted text-xs shadow-2xs">
                No alert events match the current filter criteria
              </div>
            ) : (
              filteredEvents.map((event) => (
                <EventCard key={event.id} event={event} onAcknowledge={handleAcknowledge} />
              ))
            )}
          </div>
        </div>

        {/* Right: Alert Rules (2 columns) */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-ink">Configured Rules ({rules.length})</h3>
            <Button
              variant="primary"
              size="xs"
              icon={Plus}
              onClick={() => setShowAddRule(true)}
            >
              Add Rule
            </Button>
          </div>

          <div className="space-y-2.5">
            {rules.map((rule) => (
              <RuleCard key={rule.id} rule={rule} onToggle={handleToggleRule} />
            ))}
            {rules.length === 0 && (
              <div className="bg-surface rounded-xl border border-line p-8 text-center text-ink-muted text-xs shadow-2xs">
                No alert rules configured
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Add Rule Modal */}
      {showAddRule && <AddRuleModal onClose={() => setShowAddRule(false)} onSubmit={handleCreateRule} />}
    </div>
  );
}

function EventCard({
  event,
  onAcknowledge,
}: {
  event: AlertEvent;
  onAcknowledge: (id: string) => void;
}) {
  const sev = severityConfig[event.severity];

  return (
    <div
      className={cn(
        'rounded-xl border p-4 transition-all shadow-2xs',
        event.acknowledged ? 'border-line bg-surface/70' : 'border-line-strong bg-surface',
      )}
    >
      <div className="flex items-start gap-3">
        <div className="mt-1 flex-shrink-0">
          {!event.acknowledged ? (
            <div className={cn('w-2.5 h-2.5 rounded-full', {
              'bg-rose-500 animate-pulse': event.severity === 'CRITICAL',
              'bg-amber-500': event.severity === 'WARNING',
              'bg-blue-500': event.severity === 'INFO',
            })} />
          ) : (
            <div className="w-2.5 h-2.5 rounded-full bg-ink-faint/30" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5">
            <span className={cn('px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border', sev.bg, sev.border, sev.color)}>
              {sev.label}
            </span>
            {event.alertRule && (
              <span className="text-xs font-bold text-ink truncate">{event.alertRule.name}</span>
            )}
          </div>

          <p className={cn('text-xs leading-relaxed mb-2 font-medium', event.acknowledged ? 'text-ink-muted' : 'text-ink')}>
            {event.message}
          </p>

          <div className="flex items-center justify-between pt-1 border-t border-line-subtle text-2xs">
            <span className="text-ink-muted font-medium">{timeAgo(event.createdAt)}</span>
            {!event.acknowledged && (
              <button
                onClick={() => onAcknowledge(event.id)}
                className="font-bold text-brand-600 dark:text-brand-400 hover:underline transition-colors"
              >
                Acknowledge Alert
              </button>
            )}
            {event.acknowledged && event.acknowledgedAt && (
              <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                <CheckCircle2 size={12} /> Acknowledged {timeAgo(event.acknowledgedAt)}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function RuleCard({
  rule,
  onToggle,
}: {
  rule: AlertRule;
  onToggle: (rule: AlertRule) => void;
}) {
  return (
    <div className={cn('rounded-xl border p-4 bg-surface transition-all shadow-2xs', rule.enabled ? 'border-line' : 'border-line-subtle opacity-60')}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h4 className="text-xs font-bold text-ink truncate">{rule.name}</h4>
            {rule._count && (
              <span className="text-[10px] text-ink-muted px-1.5 py-0.2 rounded bg-inset border border-line-subtle font-semibold">
                {rule._count.events} event{rule._count.events !== 1 ? 's' : ''}
              </span>
            )}
          </div>
          {rule.description && (
            <p className="text-[11px] text-ink-muted mb-2 line-clamp-2 leading-relaxed">{rule.description}</p>
          )}
          <div className="flex flex-wrap items-center gap-3 text-2xs text-ink-muted font-medium">
            <span>
              Condition: <strong className="text-ink font-mono">{rule.condition}</strong>
            </span>
            {rule.threshold !== null && rule.threshold !== undefined && (
              <span>
                Threshold: <strong className="text-ink font-mono">{rule.threshold}</strong>
              </span>
            )}
            <span>
              Window: <strong className="text-ink font-mono">{rule.windowMinutes}m</strong>
            </span>
          </div>
        </div>

        {/* Toggle switch */}
        <button
          onClick={() => onToggle(rule)}
          className={cn(
            'relative w-9 h-5 rounded-full transition-colors flex-shrink-0 mt-0.5',
            rule.enabled ? 'bg-brand-600' : 'bg-inset border border-line',
          )}
        >
          <div
            className={cn(
              'absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-xs transition-transform',
              rule.enabled ? 'translate-x-4.5' : 'translate-x-0.5',
            )}
          />
        </button>
      </div>
    </div>
  );
}

function AddRuleModal({
  onClose,
  onSubmit,
}: {
  onClose: () => void;
  onSubmit: (data: { name: string; condition: string; threshold: number; windowMinutes: number }) => void;
}) {
  const [name, setName] = useState('');
  const [condition, setCondition] = useState('error_rate');
  const [threshold, setThreshold] = useState(3);
  const [windowMinutes, setWindowMinutes] = useState(5);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onSubmit({ name: name.trim(), condition, threshold, windowMinutes });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-xs" onClick={onClose} />
      <div className="relative bg-surface border border-line rounded-2xl p-6 w-full max-w-md shadow-xl space-y-4">
        <h3 className="text-sm font-bold uppercase tracking-wider text-ink">Create Alert Rule</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-2xs font-bold uppercase tracking-wider text-ink-muted mb-1.5">Rule Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. High Error Rate Anomaly"
              required
              className="w-full px-3.5 py-2.5 bg-canvas border border-line rounded-xl text-xs text-ink placeholder:text-ink-faint focus:border-brand-500 focus:outline-none shadow-2xs"
            />
          </div>
          <div>
            <label className="block text-2xs font-bold uppercase tracking-wider text-ink-muted mb-1.5">Condition Trigger</label>
            <select
              value={condition}
              onChange={(e) => setCondition(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-canvas border border-line rounded-xl text-xs font-semibold text-ink focus:border-brand-500 focus:outline-none shadow-2xs"
            >
              <option value="error_rate">Error Rate Threshold Exceeded</option>
              <option value="heartbeat_missed">Heartbeat Missed (Stalled Agent)</option>
              <option value="offline">Agent Node Offline</option>
              <option value="high_response_time">High Response Latency</option>
              <option value="high_cost">High Token Cost Spike</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-2xs font-bold uppercase tracking-wider text-ink-muted mb-1.5">Threshold</label>
              <input
                type="number"
                value={threshold}
                onChange={(e) => setThreshold(Number(e.target.value))}
                className="w-full px-3.5 py-2.5 bg-canvas border border-line rounded-xl text-xs text-ink focus:border-brand-500 focus:outline-none shadow-2xs"
              />
            </div>
            <div>
              <label className="block text-2xs font-bold uppercase tracking-wider text-ink-muted mb-1.5">Window (minutes)</label>
              <input
                type="number"
                value={windowMinutes}
                onChange={(e) => setWindowMinutes(Number(e.target.value))}
                className="w-full px-3.5 py-2.5 bg-canvas border border-line rounded-xl text-xs text-ink focus:border-brand-500 focus:outline-none shadow-2xs"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-line-subtle">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
            >
              Create Rule
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
