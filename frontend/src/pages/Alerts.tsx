import { useEffect, useState, useCallback, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { PageHeader } from '../components/ui/PageHeader';
import { api } from '@/lib/api';
import { getSocket } from '@/lib/socket';
import { cn, timeAgo } from '@/lib/utils';
import type { AlertRule, AlertEvent, Severity } from '@/types';
import {
  Bell,
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  Info,
  Plus,
  ChevronDown,
  Check,
  Radio,
  SlidersHorizontal,
  Activity,
  Filter,
  CheckCheck,
  Clock,
  Sparkles,
  Bot,
  ShieldCheck,
  Terminal,
  GitCommit,
  Cpu,
  Layers,
  ArrowRight,
  FileText,
  RefreshCw,
  Zap,
  Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { LiveWaveform, LiveRadarBeacon } from '@/components/ui/LiveIcon';
import { LottieAnimation } from '@/components/ui/LottieAnimation';
import { HourglassLoader } from '@/components/ui/HourglassLoader';
import { CustomSelect } from '@/components/ui/CustomSelect';

const severityConfig: Record<Severity, { color: string; bg: string; border: string; label: string; dot: string; icon: typeof AlertTriangle }> = {
  INFO: { color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/25', label: 'Info', dot: 'bg-blue-500', icon: Info },
  WARNING: { color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/25', label: 'Warning', dot: 'bg-amber-500', icon: AlertTriangle },
  CRITICAL: { color: 'text-rose-600 dark:text-rose-400', bg: 'bg-rose-500/10', border: 'border-rose-500/25', label: 'Critical', dot: 'bg-rose-500', icon: ShieldAlert },
};

interface DropdownOption<T> {
  value: T;
  label: string;
  dotColor?: string;
}

function CustomDropdown<T extends string>({
  value,
  options,
  onChange,
  placeholder,
  align = 'left',
}: {
  value: T;
  options: DropdownOption<T>[];
  onChange: (val: T) => void;
  placeholder?: string;
  align?: 'left' | 'right';
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const selected = options.find((o) => o.value === value);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={cn(
          'flex h-9 items-center gap-2 rounded-xl border border-line bg-surface px-3 py-1.5 text-xs font-semibold text-ink shadow-2xs transition-all hover:border-brand-500/50 hover:bg-hover active:scale-[0.98] cursor-pointer outline-none focus:outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/20',
          open && 'border-brand-500 ring-2 ring-brand-500/10 bg-surface'
        )}
      >
        {selected?.dotColor && (
          <span className={cn('h-2 w-2 rounded-full shrink-0', selected.dotColor)} />
        )}
        <span className="truncate">{selected?.label ?? placeholder ?? 'Select'}</span>
        <ChevronDown size={13} className={cn('text-ink-muted transition-transform duration-200 ml-0.5', open && 'rotate-180')} />
      </button>

      {open && (
        <div className={cn(
          'absolute z-50 mt-1.5 min-w-[160px] overflow-hidden rounded-2xl border border-line bg-surface/95 backdrop-blur-xl p-1.5 shadow-xl animate-scale-in',
          align === 'right' ? 'right-0' : 'left-0'
        )}>
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
                  'flex w-full items-center justify-between gap-2.5 rounded-xl px-3 py-2 text-xs font-semibold transition-colors cursor-pointer text-left',
                  isSelected
                    ? 'bg-brand-500/10 text-brand-600 dark:text-brand-400 font-bold'
                    : 'text-ink-muted hover:bg-hover hover:text-ink'
                )}
              >
                <div className="flex items-center gap-2">
                  {opt.dotColor && (
                    <span className={cn('h-2 w-2 rounded-full shrink-0', opt.dotColor)} />
                  )}
                  <span>{opt.label}</span>
                </div>
                {isSelected && <Check size={13} className="shrink-0 text-brand-600 dark:text-brand-400" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function Alerts() {
  const navigate = useNavigate();
  const [events, setEvents] = useState<AlertEvent[]>([]);
  const [rules, setRules] = useState<AlertRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [severityFilter, setSeverityFilter] = useState<Severity | 'ALL'>('ALL');
  const [ackFilter, setAckFilter] = useState<'all' | 'unacknowledged' | 'acknowledged'>('all');
  const [showAddRule, setShowAddRule] = useState(false);
  const [activeTab, setActiveTab] = useState<'events' | 'rules'>('events');
  const [submittingToApprovals, setSubmittingToApprovals] = useState(false);

  // DevOps Incident Agent State
  const [incidentSymptom, setIncidentSymptom] = useState('');
  const [investigating, setInvestigating] = useState(false);
  const [investigationStep, setInvestigationStep] = useState<string>('');
  const [activeInvestigation, setActiveInvestigation] = useState<any | null>(null);
  const [evidenceTab, setEvidenceTab] = useState<'metrics' | 'logs' | 'k8s' | 'git'>('metrics');

  const fetchData = useCallback(async () => {
    try {
      const [evts, rls, incidents] = await Promise.all([
        api.alerts.events().catch(() => []),
        api.alerts.rules().catch(() => []),
        api.incidents.list().catch(() => []),
      ]);
      setEvents(evts);
      setRules(rls);
      if (incidents && incidents.length > 0 && !activeInvestigation) {
        setActiveInvestigation(incidents[0]);
      }
    } catch (err) {
      console.error('Failed to fetch alert data:', err);
    } finally {
      setLoading(false);
    }
  }, [activeInvestigation]);

  useEffect(() => {
    fetchData();

    const socket = getSocket();
    const handleAlert = () => fetchData();
    const handleIncident = (res: any) => {
      setActiveInvestigation(res);
      setInvestigating(false);
    };

    socket.on('alert:event:created', handleAlert);
    socket.on('alert:event:acknowledged', handleAlert);
    socket.on('alert:events:cleared', handleAlert);
    socket.on('incident:investigation:completed', handleIncident);

    return () => {
      socket.off('alert:event:created', handleAlert);
      socket.off('alert:event:acknowledged', handleAlert);
      socket.off('alert:events:cleared', handleAlert);
      socket.off('incident:investigation:completed', handleIncident);
    };
  }, [fetchData]);

  const handleRunInvestigation = async (scenario?: 'LATENCY_SPIKE' | 'DB_POOL_EXHAUSTION' | 'K8S_CRASHLOOP' | 'BAD_CONFIG_ROLLOUT') => {
    try {
      setInvestigating(true);
      setInvestigationStep('1/4 Fetching Prometheus Telemetry & Metrics...');
      await new Promise((r) => setTimeout(r, 400));
      setInvestigationStep('2/4 Scanning Loki Logs & Stacktrace Anomalies...');
      await new Promise((r) => setTimeout(r, 400));
      setInvestigationStep('3/4 Inspecting Kubernetes Pods & Cluster Events...');
      await new Promise((r) => setTimeout(r, 400));
      setInvestigationStep('4/4 Correlating Recent Git Diffs & CI/CD Pipelines...');
      
      const res = await api.incidents.investigate({
        alertTitle: incidentSymptom || 'Autonomous Incident Triage',
        symptom: incidentSymptom,
        scenario: scenario || 'LATENCY_SPIKE',
      });
      setActiveInvestigation(res);
      setIncidentSymptom('');
    } catch (err) {
      console.error('Investigation failed:', err);
    } finally {
      setInvestigating(false);
      setInvestigationStep('');
    }
  };

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

  const handleReviewInApprovals = async () => {
    if (!activeInvestigation) {
      navigate('/approvals');
      return;
    }
    if (activeInvestigation.approvalId) {
      navigate(`/approvals?id=${activeInvestigation.approvalId}`);
      return;
    }
    try {
      setSubmittingToApprovals(true);
      const boards = await api.boards.list().catch(() => []);
      let targetBoardId = boards[0]?.id;
      if (!targetBoardId) {
        const newBoard = await api.boards.create({ name: 'Production Operations' });
        targetBoardId = newBoard.id;
      }
      const rec = activeInvestigation.recommendedAction;
      const created = await api.approvals.create({
        boardId: targetBoardId,
        actionType: rec?.type || 'ROLLBACK_DEPLOYMENT',
        confidence: activeInvestigation.confidence || 0.95,
        payload: {
          incidentId: activeInvestigation.id,
          title: rec?.title || 'Incident Remediation',
          description: rec?.description || 'Autonomous incident remediation action',
          riskLevel: rec?.riskLevel || 'LOW',
          rootCause: activeInvestigation.rootCause,
          affectedServices: activeInvestigation.affectedServices,
          commandOrPayload: rec?.commandOrPayload,
          evidenceSummary: {
            latencyP95Ms: activeInvestigation.evidence?.metrics?.latencyP95Ms,
            errorRatePercent: activeInvestigation.evidence?.metrics?.errorRatePercent,
            latestCommit: activeInvestigation.evidence?.deployments?.commitHash,
            latestCommitMessage: activeInvestigation.evidence?.deployments?.commitMessage,
          },
        },
      });
      setActiveInvestigation((prev: any) => ({
        ...prev,
        approvalId: created.id,
        status: 'AWAITING_APPROVAL',
      }));
      navigate(`/approvals?id=${created.id}`);
    } catch (err) {
      console.error('Failed to dispatch approval:', err);
      navigate('/approvals');
    } finally {
      setSubmittingToApprovals(false);
    }
  };

  const [clearingEvents, setClearingEvents] = useState(false);

  const handleClearAllEvents = async () => {
    try {
      setClearingEvents(true);
      await api.alerts.clearAll();
      setEvents([]);
    } catch (err) {
      console.error('Failed to clear alert events:', err);
    } finally {
      setClearingEvents(false);
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

  const severityOptions: DropdownOption<Severity | 'ALL'>[] = [
    { value: 'ALL', label: 'All Severities' },
    { value: 'CRITICAL', label: 'Critical', dotColor: 'bg-rose-500' },
    { value: 'WARNING', label: 'Warning', dotColor: 'bg-amber-500' },
    { value: 'INFO', label: 'Info', dotColor: 'bg-blue-500' },
  ];

  const ackOptions: DropdownOption<'all' | 'unacknowledged' | 'acknowledged'>[] = [
    { value: 'all', label: 'All Status' },
    { value: 'unacknowledged', label: 'Unacknowledged', dotColor: 'bg-rose-500' },
    { value: 'acknowledged', label: 'Acknowledged', dotColor: 'bg-emerald-500' },
  ];

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader
          icon={AlertTriangle}
          title="Alerts & Telemetry"
          description="Monitor autonomous agent alert rules, events, and anomaly thresholds"
        />
        <div className="flex flex-col items-center justify-center py-20">
          <HourglassLoader size={48} label="Loading alert telemetry..." />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        icon={AlertTriangle}
        title="Alerts & Telemetry"
        description="Monitor autonomous agent alert rules, events, and anomaly thresholds"
        actions={
          <Button
            variant="primary"
            icon={Plus}
            onClick={() => setShowAddRule(true)}
          >
            Add Rule
          </Button>
        }
      />

      {/* Active Alerts Banner */}
      {unacknowledged.length > 0 && (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 dark:bg-amber-500/10 p-4 sm:p-5 shadow-xs transition-all">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start sm:items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0 shadow-2xs">
                <AlertTriangle size={20} />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-sm font-bold text-ink">
                    {unacknowledged.length} Unacknowledged Alert{unacknowledged.length !== 1 ? 's' : ''}
                  </h3>
                  <div className="flex items-center gap-1.5">
                    {criticalCount > 0 && (
                      <span className="px-2 py-0.5 rounded-full bg-rose-500/15 border border-rose-500/30 text-rose-700 dark:text-rose-300 text-[11px] font-bold">
                        {criticalCount} Critical
                      </span>
                    )}
                    {warningCount > 0 && (
                      <span className="px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-700 dark:text-amber-300 text-[11px] font-bold">
                        {warningCount} Warning
                      </span>
                    )}
                    {infoCount > 0 && (
                      <span className="px-2 py-0.5 rounded-full bg-blue-500/15 border border-blue-500/30 text-blue-700 dark:text-blue-300 text-[11px] font-bold">
                        {infoCount} Info
                      </span>
                    )}
                  </div>
                </div>
                <p className="text-xs text-ink-muted mt-0.5">
                  Action required: review anomalies and acknowledge to clear active triggers.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={async () => {
                for (const e of unacknowledged) {
                  await handleAcknowledge(e.id);
                }
              }}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-surface border border-line text-ink hover:bg-hover hover:border-line-strong transition-all shadow-xs cursor-pointer self-start sm:self-auto shrink-0 flex items-center gap-1.5"
            >
              <CheckCheck size={14} className="text-emerald-500" />
              Acknowledge All
            </button>
          </div>
        </div>
      )}

      {/* ─── Autonomous DevOps Incident Agent & SRE Doctor ──────────────── */}
      <div className="rounded-3xl border border-brand-500/30 bg-gradient-to-b from-surface via-surface to-brand-500/[0.03] p-5 sm:p-6 shadow-sm space-y-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-line-subtle pb-4.5">
          <div className="flex items-start sm:items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-brand-500/10 border border-brand-500/30 flex items-center justify-center text-brand-600 dark:text-brand-400 shrink-0 shadow-2xs">
              <Bot size={22} className="animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h2 className="text-sm sm:text-base font-bold text-ink">DevOps Incident Doctor (AI SRE Agent)</h2>
                <Badge tone="success" dot pulse>Autonomous RCA Engine</Badge>
              </div>
              <p className="text-xs text-ink-muted mt-0.5">
                Automated multi-source root cause analysis across Prometheus metrics, Loki logs, K8s cluster events, and Git commit history.
              </p>
            </div>
          </div>

          {/* Quick Scenario Simulators */}
          <div className="flex flex-wrap items-center gap-1.5 self-start md:self-auto">
            <span className="text-[11px] font-bold uppercase tracking-wider text-ink-muted mr-1 flex items-center gap-1">
              <Zap size={12} className="text-amber-500" />
              Simulate:
            </span>
            <Button
              size="xs"
              variant="secondary"
              loading={investigating}
              onClick={() => handleRunInvestigation('LATENCY_SPIKE')}
            >
              Latency Spike (8s)
            </Button>
            <Button
              size="xs"
              variant="secondary"
              loading={investigating}
              onClick={() => handleRunInvestigation('DB_POOL_EXHAUSTION')}
            >
              DB Pool Timeout
            </Button>
            <Button
              size="xs"
              variant="secondary"
              loading={investigating}
              onClick={() => handleRunInvestigation('K8S_CRASHLOOP')}
            >
              K8s OOMKilled
            </Button>
            <Button
              size="xs"
              variant="secondary"
              loading={investigating}
              onClick={() => handleRunInvestigation('BAD_CONFIG_ROLLOUT')}
            >
              Bad Config Secret
            </Button>
          </div>
        </div>

        {/* Custom Symptom Investigation Input */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleRunInvestigation();
          }}
          className="flex flex-col sm:flex-row gap-2.5"
        >
          <div className="relative flex-1">
            <Terminal size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-muted" />
            <input
              type="text"
              value={incidentSymptom}
              onChange={(e) => setIncidentSymptom(e.target.value)}
              placeholder="Enter incident alert symptom (e.g., 'API Gateway 504 Gateway Timeout surge on /checkout endpoint')..."
              className="w-full h-10 pl-9.5 pr-4 rounded-xl bg-inset border border-line text-xs text-ink placeholder:text-ink-muted outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 shadow-2xs transition-all"
            />
          </div>
          <Button
            type="submit"
            variant="primary"
            icon={Sparkles}
            loading={investigating}
            className="shrink-0"
          >
            {investigating ? 'Analyzing Telemetry...' : 'Investigate Incident'}
          </Button>
        </form>

        {/* Live Investigation Progress Loader */}
        {investigating && (
          <div className="p-4 rounded-2xl bg-inset border border-line flex items-center justify-between gap-3 animate-pulse">
            <div className="flex items-center gap-3">
              <HourglassLoader size={20} />
              <div>
                <span className="text-xs font-bold text-ink">DevOps Agent Triage in Progress</span>
                <p className="text-[11px] text-ink-muted font-mono">{investigationStep || 'Extracting multi-agent telemetry...'}</p>
              </div>
            </div>
            <LiveWaveform color="bg-brand-500" />
          </div>
        )}

        {/* Active Investigation Result Diagnostic Card */}
        {activeInvestigation && !investigating && (
          <div className="rounded-2xl border border-brand-500/20 bg-surface/90 p-5 space-y-4 shadow-xs">
            {/* Diagnostic Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-line-subtle pb-3">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/25">
                    {activeInvestigation.severity}
                  </span>
                  <h3 className="text-sm font-bold text-ink font-mono">{activeInvestigation.id}</h3>
                  <span className="text-2xs text-ink-muted font-medium">Investigated {timeAgo(activeInvestigation.createdAt)}</span>
                </div>
                <p className="text-xs text-ink font-medium mt-1">{activeInvestigation.title}</p>
              </div>

              <div className="flex items-center gap-3 self-start md:self-auto">
                <div className="text-right">
                  <span className="text-2xs font-bold uppercase tracking-wider text-ink-muted block">AI Confidence</span>
                  <span className="text-sm font-bold font-mono text-emerald-600 dark:text-emerald-400">
                    {Math.round((activeInvestigation.confidence || 0.94) * 100)}% Match
                  </span>
                </div>
                <div className="w-12 h-2 rounded-full bg-inset overflow-hidden border border-line-subtle">
                  <div
                    className="h-full bg-emerald-500 rounded-full"
                    style={{ width: `${Math.round((activeInvestigation.confidence || 0.94) * 100)}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Root Cause Banner */}
            <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/25 space-y-1">
              <span className="text-2xs font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                <ShieldAlert size={13} />
                Identified Root Cause:
              </span>
              <p className="text-xs font-semibold text-ink leading-relaxed">
                {activeInvestigation.rootCause}
              </p>
              <p className="text-[11px] text-ink-muted pt-0.5">
                Impact: {activeInvestigation.impactSummary}
              </p>
            </div>

            {/* 4-Tab Evidence Breakdown */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 border-b border-line pb-2 overflow-x-auto no-scrollbar">
                <button
                  type="button"
                  onClick={() => setEvidenceTab('metrics')}
                  className={cn(
                    'px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shrink-0',
                    evidenceTab === 'metrics'
                      ? 'bg-brand-500/10 text-brand-600 dark:text-brand-400 border border-brand-500/25'
                      : 'text-ink-muted hover:text-ink'
                  )}
                >
                  <Activity size={13} />
                  Prometheus Metrics
                </button>
                <button
                  type="button"
                  onClick={() => setEvidenceTab('logs')}
                  className={cn(
                    'px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shrink-0',
                    evidenceTab === 'logs'
                      ? 'bg-brand-500/10 text-brand-600 dark:text-brand-400 border border-brand-500/25'
                      : 'text-ink-muted hover:text-ink'
                  )}
                >
                  <FileText size={13} />
                  Loki Logs
                </button>
                <button
                  type="button"
                  onClick={() => setEvidenceTab('k8s')}
                  className={cn(
                    'px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shrink-0',
                    evidenceTab === 'k8s'
                      ? 'bg-brand-500/10 text-brand-600 dark:text-brand-400 border border-brand-500/25'
                      : 'text-ink-muted hover:text-ink'
                  )}
                >
                  <Layers size={13} />
                  Kubernetes Cluster
                </button>
                <button
                  type="button"
                  onClick={() => setEvidenceTab('git')}
                  className={cn(
                    'px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shrink-0',
                    evidenceTab === 'git'
                      ? 'bg-brand-500/10 text-brand-600 dark:text-brand-400 border border-brand-500/25'
                      : 'text-ink-muted hover:text-ink'
                  )}
                >
                  <GitCommit size={13} />
                  Git & CI/CD Diff
                </button>
              </div>

              {/* Tab Content */}
              {evidenceTab === 'metrics' && activeInvestigation.evidence?.metrics && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  <div className="p-3 rounded-xl bg-inset border border-line space-y-1">
                    <span className="text-[10px] uppercase font-bold text-ink-muted">P95 Latency</span>
                    <div className="text-sm font-bold font-mono text-rose-600 dark:text-rose-400">
                      {activeInvestigation.evidence.metrics.latencyP95Ms}ms
                    </div>
                    <span className="text-[10px] text-ink-muted">Baseline: {activeInvestigation.evidence.metrics.latencyBaselineMs}ms</span>
                  </div>
                  <div className="p-3 rounded-xl bg-inset border border-line space-y-1">
                    <span className="text-[10px] uppercase font-bold text-ink-muted">Error Rate</span>
                    <div className="text-sm font-bold font-mono text-rose-600 dark:text-rose-400">
                      {activeInvestigation.evidence.metrics.errorRatePercent}%
                    </div>
                    <span className="text-[10px] text-ink-muted">Baseline: {activeInvestigation.evidence.metrics.errorRateBaselinePercent}%</span>
                  </div>
                  <div className="p-3 rounded-xl bg-inset border border-line space-y-1">
                    <span className="text-[10px] uppercase font-bold text-ink-muted">CPU Usage</span>
                    <div className="text-sm font-bold font-mono text-ink">
                      {activeInvestigation.evidence.metrics.cpuUtilizationPercent}%
                    </div>
                    <span className="text-[10px] text-ink-muted">Container Core</span>
                  </div>
                  <div className="p-3 rounded-xl bg-inset border border-line space-y-1">
                    <span className="text-[10px] uppercase font-bold text-ink-muted">Memory RAM</span>
                    <div className="text-sm font-bold font-mono text-amber-600 dark:text-amber-400">
                      {activeInvestigation.evidence.metrics.memoryUtilizationPercent}%
                    </div>
                    <span className="text-[10px] text-ink-muted">Cgroup limit</span>
                  </div>
                </div>
              )}

              {evidenceTab === 'logs' && activeInvestigation.evidence?.logs && (
                <div className="space-y-2">
                  <span className="text-2xs font-mono text-ink-muted">Source: {activeInvestigation.evidence.logs.source}</span>
                  <pre className="p-3.5 rounded-xl bg-inset border border-line text-[11px] font-mono text-rose-600 dark:text-rose-300 max-h-40 overflow-y-auto no-scrollbar whitespace-pre-wrap">
                    {activeInvestigation.evidence.logs.sampleErrors?.join('\n\n')}
                  </pre>
                </div>
              )}

              {evidenceTab === 'k8s' && activeInvestigation.evidence?.kubernetes && (
                <div className="space-y-2">
                  <div className="text-2xs font-mono text-ink-muted flex items-center gap-2">
                    <span>Cluster: <strong>{activeInvestigation.evidence.kubernetes.cluster}</strong></span>
                    <span>Namespace: <strong>{activeInvestigation.evidence.kubernetes.namespace}</strong></span>
                  </div>
                  <div className="space-y-1.5">
                    {activeInvestigation.evidence.kubernetes.failingPods?.length === 0 ? (
                      <p className="text-xs text-ink-muted">No failing pods detected.</p>
                    ) : (
                      activeInvestigation.evidence.kubernetes.failingPods?.map((pod: any, i: number) => (
                        <div key={i} className="p-2.5 rounded-xl bg-inset border border-line text-xs flex items-center justify-between gap-2">
                          <span className="font-mono font-bold text-ink truncate">{pod.name}</span>
                          <span className="text-rose-600 dark:text-rose-400 font-bold text-2xs uppercase bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/20 shrink-0">
                            {pod.status} ({pod.restarts} restarts)
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {evidenceTab === 'git' && activeInvestigation.evidence?.deployments && (
                <div className="p-3 rounded-xl bg-inset border border-line space-y-1.5 text-xs">
                  <div className="flex items-center justify-between gap-2 flex-wrap font-mono">
                    <span className="font-bold text-ink">{activeInvestigation.evidence.deployments.latestRelease} (Commit: {activeInvestigation.evidence.deployments.commitHash})</span>
                    <span className="text-ink-muted text-2xs">Shipped {activeInvestigation.evidence.deployments.deployedAtAgo} by {activeInvestigation.evidence.deployments.author}</span>
                  </div>
                  <p className="text-ink font-semibold">"{activeInvestigation.evidence.deployments.commitMessage}"</p>
                  <div className="flex items-center gap-1.5 flex-wrap pt-1">
                    <span className="text-2xs font-bold text-ink-muted uppercase">Changed:</span>
                    {activeInvestigation.evidence.deployments.changedFiles?.map((f: string, i: number) => (
                      <span key={i} className="px-1.5 py-0.5 rounded bg-surface border border-line-subtle font-mono text-2xs text-ink">
                        {f}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Recommended Human-in-the-Loop Remediation Footer */}
            {activeInvestigation.recommendedAction && (
              <div className="pt-3 border-t border-line-subtle flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-ink">Recommended Fix: {activeInvestigation.recommendedAction.title}</span>
                    <span className="px-2 py-0.2 rounded text-[10px] font-bold uppercase bg-brand-500/10 text-brand-600 dark:text-brand-400 border border-brand-500/20">
                      {activeInvestigation.recommendedAction.riskLevel} Risk
                    </span>
                  </div>
                  <p className="text-[11px] text-ink-muted">{activeInvestigation.recommendedAction.description}</p>
                </div>

                <button
                  type="button"
                  onClick={handleReviewInApprovals}
                  disabled={submittingToApprovals}
                  className="px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-xs font-bold shadow-xs transition-all shrink-0 flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <ShieldCheck size={14} />
                  {submittingToApprovals ? 'Dispatching to Queue...' : 'Review in Approvals'}
                  <ArrowRight size={13} />
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Mobile Tab Switcher */}
      <div className="flex lg:hidden rounded-xl bg-inset p-1 border border-line gap-1">
        <button
          type="button"
          onClick={() => setActiveTab('events')}
          className={cn(
            'flex-1 py-2 rounded-lg text-xs font-bold transition-all text-center cursor-pointer',
            activeTab === 'events'
              ? 'bg-surface text-brand-600 dark:text-brand-400 shadow-2xs'
              : 'text-ink-muted hover:text-ink'
          )}
        >
          Alert Events ({filteredEvents.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('rules')}
          className={cn(
            'flex-1 py-2 rounded-lg text-xs font-bold transition-all text-center cursor-pointer',
            activeTab === 'rules'
              ? 'bg-surface text-brand-600 dark:text-brand-400 shadow-2xs'
              : 'text-ink-muted hover:text-ink'
          )}
        >
          Rules ({rules.length})
        </button>
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 items-stretch">
        {/* Left: Alert Events (3 columns) */}
        <div className={cn('lg:col-span-3 flex flex-col', activeTab !== 'events' && 'hidden lg:flex')}>
          <div className="rounded-2xl border border-line-subtle bg-surface p-5 shadow-xs flex flex-col h-full">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-line-subtle pb-4 mb-4 shrink-0">
              <div className="flex items-center gap-2.5">
                <h3 className="text-xs font-bold uppercase tracking-wider text-ink">
                  Alert Events ({filteredEvents.length})
                </h3>
                <LiveWaveform color="bg-brand-500" />
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <CustomDropdown
                  value={severityFilter}
                  options={severityOptions}
                  onChange={setSeverityFilter}
                />

                <CustomDropdown
                  value={ackFilter}
                  options={ackOptions}
                  onChange={setAckFilter}
                />

                {events.length > 0 && (
                  <Button
                    variant="secondary"
                    size="xs"
                    icon={Trash2}
                    loading={clearingEvents}
                    onClick={handleClearAllEvents}
                    className="text-rose-600 dark:text-rose-400 border-rose-500/30 hover:bg-rose-500/10"
                    title="Clear all alert events"
                  >
                    Clear All
                  </Button>
                )}
              </div>
            </div>

            <div className="space-y-3 overflow-y-auto max-h-[800px] pr-2 flex-1 scrollbar-thin scrollbar-thumb-line scrollbar-track-transparent">
              {filteredEvents.length === 0 ? (
                <div className="rounded-2xl bg-inset/40 border border-dashed border-line p-10 text-center text-ink-muted text-xs">
                  <ShieldAlert size={32} className="mx-auto text-ink-faint mb-2 opacity-50" />
                  <p className="font-semibold text-ink">No alert events match criteria</p>
                  <p className="text-ink-muted text-xs mt-1">All agent telemetry thresholds are currently operating within normal bounds.</p>
                </div>
              ) : (
                filteredEvents.map((event) => (
                  <EventCard key={event.id} event={event} onAcknowledge={handleAcknowledge} />
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right: Alert Rules (2 columns) */}
        <div className={cn('lg:col-span-2 flex flex-col', activeTab !== 'rules' && 'hidden lg:flex')}>
          <div className="rounded-2xl border border-line-subtle bg-surface p-5 shadow-xs flex flex-col h-full">
            <div className="flex items-center justify-between border-b border-line-subtle pb-4 mb-4 shrink-0">
              <h3 className="text-xs font-bold uppercase tracking-wider text-ink">Configured Rules ({rules.length})</h3>
              <button
                type="button"
                onClick={() => setShowAddRule(true)}
                className="px-3 py-1.5 rounded-xl text-xs font-bold bg-brand-500/10 text-brand-600 dark:text-brand-400 border border-brand-500/20 hover:bg-brand-500/20 transition-all cursor-pointer flex items-center gap-1 shadow-2xs"
              >
                <Plus size={13} /> Add Rule
              </button>
            </div>

            <div className="space-y-3 overflow-y-auto max-h-[800px] pr-2 flex-1 scrollbar-thin scrollbar-thumb-line scrollbar-track-transparent">
              {rules.map((rule) => (
                <RuleCard key={rule.id} rule={rule} onToggle={handleToggleRule} />
              ))}
              {rules.length === 0 && (
                <div className="rounded-2xl bg-inset/40 border border-dashed border-line p-8 text-center text-ink-muted text-xs">
                  No alert rules configured
                </div>
              )}
            </div>
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
  const IconComponent = sev.icon;

  return (
    <div
      className={cn(
        'rounded-xl border p-4 transition-all shadow-2xs',
        event.acknowledged
          ? 'border-line-subtle bg-inset/40 hover:bg-inset/70'
          : 'border-line bg-inset/70 hover:border-line-strong hover:bg-inset shadow-xs'
      )}
    >
      <div className="flex items-start gap-3">
        <div className={cn(
          'w-8 h-8 rounded-full flex items-center justify-center shrink-0 border shadow-2xs mt-0.5',
          sev.bg,
          sev.border,
          sev.color
        )}>
          <IconComponent size={15} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-1.5 flex-wrap">
            <div className="flex items-center gap-2 flex-wrap min-w-0">
              <span className={cn('px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border', sev.bg, sev.border, sev.color)}>
                {sev.label}
              </span>
              {event.alertRule && (
                <span className="text-xs font-bold text-ink truncate">{event.alertRule.name}</span>
              )}
            </div>
            <span className="text-[11px] text-ink-faint font-medium flex items-center gap-1 font-mono shrink-0">
              <Clock size={11} /> {timeAgo(event.createdAt)}
            </span>
          </div>

          <p className={cn('text-xs leading-relaxed mb-3 font-medium', event.acknowledged ? 'text-ink-muted' : 'text-ink')}>
            {event.message}
          </p>

          <div className="flex items-center justify-between pt-2.5 border-t border-line-subtle">
            <div className="flex items-center gap-2 text-2xs text-ink-muted">
              {event.acknowledged && event.acknowledgedAt ? (
                <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                  <CheckCircle2 size={13} /> Acknowledged {timeAgo(event.acknowledgedAt)}
                </span>
              ) : (
                <span className="text-amber-600 dark:text-amber-400 font-semibold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" /> Pending Review
                </span>
              )}
            </div>
            {!event.acknowledged && (
              <button
                type="button"
                onClick={() => onAcknowledge(event.id)}
                className="px-3 py-1 rounded-xl text-xs font-bold text-brand-600 dark:text-brand-400 hover:bg-brand-500/10 border border-brand-500/20 transition-all cursor-pointer"
              >
                Acknowledge Alert
              </button>
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
    <div className={cn('rounded-xl border p-3.5 transition-all shadow-2xs', rule.enabled ? 'border-line-subtle bg-inset/70 hover:border-line hover:bg-inset' : 'border-line-subtle bg-inset/30 opacity-60')}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <h4 className="text-xs font-bold text-ink truncate">{rule.name}</h4>
            {rule._count && (
              <span className="text-[10px] text-ink-muted px-2 py-0.5 rounded-full bg-surface border border-line-subtle font-semibold">
                {rule._count.events} event{rule._count.events !== 1 ? 's' : ''}
              </span>
            )}
          </div>
          {rule.description && (
            <p className="text-xs text-ink-muted mb-2 line-clamp-2 leading-relaxed">{rule.description}</p>
          )}
          <div className="flex flex-wrap items-center gap-1.5 text-2xs text-ink-muted font-medium">
            <span className="bg-surface px-2 py-0.5 rounded-md border border-line-subtle">
              Condition: <strong className="text-ink font-mono">{rule.condition}</strong>
            </span>
            {rule.threshold !== null && rule.threshold !== undefined && (
              <span className="bg-surface px-2 py-0.5 rounded-md border border-line-subtle">
                Threshold: <strong className="text-ink font-mono">{rule.threshold}</strong>
              </span>
            )}
            <span className="bg-surface px-2 py-0.5 rounded-md border border-line-subtle">
              Window: <strong className="text-ink font-mono">{rule.windowMinutes}m</strong>
            </span>
          </div>
        </div>

        {/* Toggle switch */}
        <button
          type="button"
          onClick={() => onToggle(rule)}
          className={cn(
            'relative w-10 h-5.5 rounded-full transition-colors flex-shrink-0 mt-0.5 cursor-pointer outline-none focus:outline-none',
            rule.enabled ? 'bg-brand-600' : 'bg-line-strong',
          )}
        >
          <div
            className={cn(
              'absolute top-0.5 w-4.5 h-4.5 rounded-full bg-white shadow-xs transition-transform duration-200',
              rule.enabled ? 'translate-x-5' : 'translate-x-0.5',
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
      <div className="relative bg-surface border border-line rounded-2xl p-6 w-full max-w-md shadow-xl space-y-4 animate-scale-in">
        <div className="flex items-center justify-between border-b border-line-subtle pb-3">
          <h3 className="text-sm font-bold text-ink">Create Alert Rule</h3>
          <button
            type="button"
            onClick={onClose}
            className="text-ink-muted hover:text-ink text-xs font-semibold cursor-pointer"
          >
            ✕
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-ink-muted mb-1.5">Rule Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. High Error Rate Anomaly"
              required
              className="w-full h-10 px-3.5 py-2 bg-inset border border-line rounded-xl text-xs text-ink placeholder:text-ink-muted outline-none focus:outline-none focus-visible:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 shadow-2xs transition-all"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-ink-muted mb-1.5">Condition Trigger</label>
            <CustomSelect
              value={condition}
              onChange={(val) => setCondition(val)}
              options={[
                { value: 'error_rate', label: 'Error Rate Threshold Exceeded' },
                { value: 'heartbeat_missed', label: 'Heartbeat Missed (Stalled Agent)' },
                { value: 'offline', label: 'Agent Node Offline' },
                { value: 'high_response_time', label: 'High Response Latency' },
                { value: 'high_cost', label: 'High Token Cost Spike' },
              ]}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-ink-muted mb-1.5">Threshold</label>
              <input
                type="number"
                value={threshold}
                onChange={(e) => setThreshold(Number(e.target.value))}
                className="w-full h-10 px-3.5 py-2 bg-inset border border-line rounded-xl text-xs text-ink outline-none focus:outline-none focus-visible:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 shadow-2xs transition-all"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-ink-muted mb-1.5">Window (minutes)</label>
              <input
                type="number"
                value={windowMinutes}
                onChange={(e) => setWindowMinutes(Number(e.target.value))}
                className="w-full h-10 px-3.5 py-2 bg-inset border border-line rounded-xl text-xs text-ink outline-none focus:outline-none focus-visible:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 shadow-2xs transition-all"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-3 border-t border-line-subtle">
            <Button
              type="button"
              variant="secondary"
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

