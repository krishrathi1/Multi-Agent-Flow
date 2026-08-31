import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity as ActivityIcon,
  Bot,
  Edit3,
  Factory,
  FileText,
  ListChecks,
  ExternalLink,
  Hammer,
  Pause,
  Play,
  Plus,
  SlidersHorizontal,
  Trash2,
  Workflow,
  Sparkles,
  Zap,
  Radio,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react';
import { cn, timeAgo } from '../lib/utils';
import { tones } from '../lib/design';
import { useProcessStore } from '../stores/process-store';
import { processTone } from '../components/process/ProcessScope';
import { CreateProcessModal } from '../components/process/CreateProcessModal';
import { RunPanel } from '../components/process/RunPanel';
import { ChainSettingsModal } from '../components/process/ChainSettingsModal';
import { ProcessReportModal } from '../components/process/ProcessReportModal';
import { EditProcessModal } from '../components/process/EditProcessModal';
import { api } from '../lib/api';
import { PageHeader } from '../components/ui/PageHeader';
import { Button, ButtonLink } from '../components/ui/Button';
import { Badge, Chip } from '../components/ui/Badge';
import { Avatar } from '../components/ui/Avatar';
import { EmptyState } from '../components/ui/States';
import { ConfirmDialog } from '../components/ui/Modal';
import { HourglassLoader } from '../components/ui/HourglassLoader';
import { LiveWaveform } from '../components/ui/LiveIcon';
import type { Process, ProcessStatus } from '../types';

const statusTone: Record<ProcessStatus, 'success' | 'warning' | 'neutral' | 'danger' | 'info'> = {
  DRAFT: 'neutral',
  PLANNING: 'info',
  ACTIVE: 'success',
  PAUSED: 'warning',
  COMPLETED: 'info',
  FAILED: 'danger',
};

function ProcessCard({
  process,
  onDelete,
  onStart,
  onPause,
  onRun,
  onReport,
  onEdit,
  onSettings,
  busy,
  hasSite,
}: {
  process: Process;
  onDelete: (p: Process) => void;
  onStart: (p: Process) => void;
  onPause: (p: Process) => void;
  onRun: (p: Process) => void;
  onReport: (p: Process) => void;
  onEdit: (p: Process) => void;
  onSettings: (p: Process) => void;
  busy: boolean;
  hasSite: boolean;
}) {
  const agents = process.agents ?? [];
  const stages = [...new Set(agents.map((a) => a.processStage))].sort((a, b) => a - b);
  const running = process.status === 'ACTIVE';
  const startLabel = process.status === 'PAUSED' ? 'Resume' : 'Start';

  const getStatusBadge = () => {
    switch (process.status) {
      case 'ACTIVE':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25 shadow-2xs">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Active Chain
          </span>
        );
      case 'PAUSED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/25 shadow-2xs">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            Paused
          </span>
        );
      case 'COMPLETED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/25 shadow-2xs">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
            Completed
          </span>
        );
      case 'FAILED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/25 shadow-2xs">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
            Failed
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-inset text-ink-muted border border-line">
            {process.status.toLowerCase()}
          </span>
        );
    }
  };

  return (
    <div className="rounded-2xl border border-line-subtle bg-surface p-5 shadow-2xs hover:border-line-strong hover:shadow-xs transition-all flex flex-col justify-between space-y-4">
      <div className="space-y-3.5">
        {/* Header: Title + Status Pill */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-brand-500/10 text-brand-600 dark:text-brand-400 border border-brand-500/20 flex items-center justify-center shrink-0">
              <Factory size={16} />
            </div>
            <div className="min-w-0">
              <h3 className="truncate text-xs sm:text-sm font-bold text-ink">{process.name}</h3>
              <p className="text-[10px] font-mono text-ink-muted mt-0.5">
                Created {timeAgo(process.createdAt)}
              </p>
            </div>
          </div>

          <div className="shrink-0">
            {getStatusBadge()}
          </div>
        </div>

        {/* Summary */}
        {process.summary && (
          <p className="line-clamp-2 text-xs leading-relaxed text-ink-muted">
            {process.summary}
          </p>
        )}

        {/* Stage → Agent Pipeline */}
        <div className="space-y-2 pt-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-ink-muted block">
            Execution Pipeline Stages ({stages.length})
          </span>
          <div className="space-y-1.5">
            {stages.map((stage) => (
              <div key={stage} className="flex items-center gap-2 bg-inset/60 p-2 rounded-xl border border-line-subtle">
                <span className="grid h-5 w-5 shrink-0 place-items-center rounded-lg bg-surface text-[10px] font-mono font-bold text-brand-600 dark:text-brand-400 border border-line-subtle shadow-2xs">
                  {stage}
                </span>
                <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                  {agents
                    .filter((a) => a.processStage === stage)
                    .map((a) => (
                      <span
                        key={a.id}
                        title={`${a.displayName} — ${a.processRole ?? 'agent'}`}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface py-0.5 pl-1 pr-2 text-2xs font-semibold text-ink shadow-2xs"
                      >
                        <Avatar name={a.displayName} emoji={a.avatar} size="xs" />
                        <span className="truncate max-w-[130px]">{a.displayName}</span>
                      </span>
                    ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Telemetry Metrics Row */}
        <div className="flex items-center justify-between border-t border-line-subtle pt-3 text-2xs font-mono text-ink-muted">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1 bg-inset px-2 py-0.5 rounded-md border border-line-subtle">
              <Bot size={11} className="text-brand-500" />
              {process.agentCount ?? agents.length} agents
            </span>
            <span className="flex items-center gap-1 bg-inset px-2 py-0.5 rounded-md border border-line-subtle">
              <ListChecks size={11} className="text-emerald-500" />
              {process.taskCount ?? 0} tasks
            </span>
            <span className="flex items-center gap-1 bg-inset px-2 py-0.5 rounded-md border border-line-subtle">
              <ActivityIcon size={11} className="text-purple-500" />
              {process.activityCount ?? 0} events
            </span>
          </div>
        </div>
      </div>

      {/* Action Footer */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line-subtle pt-3.5 mt-2">
        {/* Primary Controls */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {running ? (
            <Button
              variant="secondary"
              size="xs"
              icon={Pause}
              loading={busy}
              onClick={() => onPause(process)}
              className="text-amber-600 dark:text-amber-400 border-amber-500/30 hover:bg-amber-500/10"
              aria-label={`Pause production ${process.name}`}
            >
              Pause
            </Button>
          ) : (
            <Button
              variant="primary"
              size="xs"
              icon={Play}
              loading={busy}
              onClick={() => onStart(process)}
              aria-label={`${startLabel} production ${process.name}`}
            >
              {startLabel}
            </Button>
          )}

          <Button
            variant="secondary"
            size="xs"
            icon={Hammer}
            onClick={() => onRun(process)}
            aria-label={`Run production ${process.name}`}
          >
            Run
          </Button>

          <Button
            variant="secondary"
            size="xs"
            icon={FileText}
            onClick={() => onReport(process)}
            aria-label={`View audit report for ${process.name}`}
          >
            Report
          </Button>

          <Link
            to={`/activity?processId=${process.id}`}
            className="rounded-lg px-2 py-1 text-xs font-semibold text-ink-muted transition-colors hover:text-brand-600 dark:hover:text-brand-400"
          >
            Activity
          </Link>
        </div>

        {/* Secondary Tool Icons */}
        <div className="flex items-center gap-0.5 shrink-0 ml-auto">
          {hasSite && (
            <ButtonLink
              href={api.processes.previewUrl(process.id)}
              variant="ghost"
              size="xs"
              iconOnly
              icon={ExternalLink}
              aria-label={`Open live preview of ${process.name}`}
            />
          )}

          <Button
            variant="ghost"
            size="xs"
            iconOnly
            icon={Edit3}
            aria-label={`Edit ${process.name}`}
            onClick={() => onEdit(process)}
            className="hover:text-brand-600 dark:hover:text-brand-400"
          />

          <Button
            variant="ghost"
            size="xs"
            iconOnly
            icon={SlidersHorizontal}
            aria-label={`Guardrails for ${process.name}`}
            onClick={() => onSettings(process)}
          />

          <Button
            variant="ghost"
            size="xs"
            iconOnly
            icon={Trash2}
            aria-label={`Delete production ${process.name}`}
            onClick={() => onDelete(process)}
            className="hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-500/10"
          />
        </div>
      </div>
    </div>
  );
}

export function Processes() {
  const {
    processes, stats, loading,
    fetchProcesses, fetchStats, removeProcess, startProcess, pauseProcess,
  } = useProcessStore();
  const [showCreate, setShowCreate] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Process | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [runError, setRunError] = useState<string | null>(null);
  const [runTarget, setRunTarget] = useState<Process | null>(null);
  const [reportTarget, setReportTarget] = useState<Process | null>(null);
  const [editTarget, setEditTarget] = useState<Process | null>(null);
  const [settingsTarget, setSettingsTarget] = useState<Process | null>(null);
  const [sites, setSites] = useState<Record<string, boolean>>({});

  const runControl = async (p: Process, action: 'start' | 'pause') => {
    setBusyId(p.id);
    setRunError(null);
    try {
      await (action === 'start' ? startProcess(p.id) : pauseProcess(p.id));
    } catch (err) {
      setRunError(`Could not ${action} "${p.name}": ${(err as Error).message}`);
    } finally {
      setBusyId(null);
    }
  };

  useEffect(() => {
    fetchProcesses();
    fetchStats();
  }, [fetchProcesses, fetchStats]);

  useEffect(() => {
    let cancelled = false;
    Promise.all(
      processes.map(async (p) => {
        try {
          const files = await api.processes.files(p.id);
          return [p.id, files.some((f) => f.path.endsWith('.html'))] as const;
        } catch {
          return [p.id, false] as const;
        }
      }),
    ).then((pairs) => {
      if (!cancelled) setSites(Object.fromEntries(pairs));
    });
    return () => {
      cancelled = true;
    };
  }, [processes]);

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      await removeProcess(pendingDelete.id, true);
      setPendingDelete(null);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Factory}
        title="Productions"
        description="Autonomous multi-stage agent workflows, production chains, and code review deliverables"
        actions={
          <Button variant="primary" icon={Plus} onClick={() => setShowCreate(true)}>
            New Production
          </Button>
        }
      />

      {/* 3 Stats Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 sm:gap-4">
        <div className="rounded-2xl border border-line-subtle bg-surface p-4.5 shadow-2xs hover:border-line-strong hover:shadow-xs transition-all">
          <div className="flex items-center justify-between mb-2.5">
            <span className="text-xs font-bold uppercase tracking-wider text-ink-muted">Total Productions</span>
            <div className="w-8 h-8 rounded-xl bg-brand-500/10 text-brand-600 dark:text-brand-400 border border-brand-500/20 flex items-center justify-center">
              <Factory size={16} />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-bold text-ink tracking-tight font-mono">
            {stats?.total ?? processes.length}
          </div>
          <p className="text-[11px] text-ink-muted mt-1 font-medium">Configured agent chains</p>
        </div>

        <div className="rounded-2xl border border-emerald-500/20 bg-surface p-4.5 shadow-2xs hover:border-emerald-500/40 hover:shadow-xs transition-all">
          <div className="flex items-center justify-between mb-2.5">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Active Chains</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center justify-center">
              <Workflow size={16} />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-bold tracking-tight font-mono text-emerald-600 dark:text-emerald-400">
            {stats?.active ?? 0}
          </div>
          <p className="text-[11px] text-ink-muted mt-1 font-medium">Running & executing</p>
        </div>

        <div className="rounded-2xl border border-purple-500/20 bg-surface p-4.5 shadow-2xs hover:border-purple-500/40 hover:shadow-xs transition-all">
          <div className="flex items-center justify-between mb-2.5">
            <span className="text-xs font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400">Deployed Agents</span>
            <div className="w-8 h-8 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 flex items-center justify-center">
              <Bot size={16} />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-bold tracking-tight font-mono text-purple-600 dark:text-purple-400">
            {stats?.agentsInProcesses ?? 0}
          </div>
          <p className="text-[11px] text-ink-muted mt-1 font-medium">Assigned stage workers</p>
        </div>
      </div>

      {runError && (
        <p
          role="alert"
          className="rounded-xl border border-rose-500/25 bg-rose-500/10 p-3 text-xs text-rose-600 dark:text-rose-400 font-semibold"
        >
          {runError}
        </p>
      )}

      <div>
        {loading && processes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <HourglassLoader size={48} label="Loading production chains..." />
          </div>
        ) : processes.length === 0 ? (
          <div className="rounded-2xl border border-line-subtle bg-surface p-12 text-center shadow-xs">
            <EmptyState
              animation="rocketLaunch"
              title="No productions yet"
              description="Describe what you want done — MyceliumOps decides how many agents are needed, what each one does, and wires them into a staged chain."
              action={
                <Button variant="primary" size="lg" icon={Plus} onClick={() => setShowCreate(true)}>
                  Create your first production
                </Button>
              }
            />
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {processes.map((p) => (
              <ProcessCard
                key={p.id}
                process={p}
                busy={busyId === p.id}
                onDelete={setPendingDelete}
                onStart={(x) => runControl(x, 'start')}
                onPause={(x) => runControl(x, 'pause')}
                onRun={setRunTarget}
                onReport={setReportTarget}
                onEdit={setEditTarget}
                onSettings={setSettingsTarget}
                hasSite={!!sites[p.id]}
              />
            ))}
          </div>
        )}
      </div>

      <CreateProcessModal open={showCreate} onClose={() => setShowCreate(false)} />

      {settingsTarget && (
        <ChainSettingsModal
          process={settingsTarget}
          open
          onClose={() => setSettingsTarget(null)}
          onSaved={fetchProcesses}
        />
      )}

      {editTarget && (
        <EditProcessModal
          process={editTarget}
          open
          onClose={() => setEditTarget(null)}
          onSaved={fetchProcesses}
        />
      )}

      {reportTarget && (
        <ProcessReportModal
          process={reportTarget}
          open
          onClose={() => setReportTarget(null)}
        />
      )}

      {runTarget && (
        <RunPanel
          process={runTarget}
          open
          onClose={() => {
            setRunTarget(null);
            fetchProcesses();
          }}
        />
      )}

      <ConfirmDialog
        open={!!pendingDelete}
        onClose={() => setPendingDelete(null)}
        onConfirm={confirmDelete}
        loading={deleting}
        title={`Delete "${pendingDelete?.name}"?`}
        message={`This removes the production and its ${pendingDelete?.agentCount ?? 0} agents, along with their history. This cannot be undone.`}
        confirmLabel="Delete production"
      />
    </div>
  );
}

