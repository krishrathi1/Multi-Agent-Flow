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
import { Card } from '../components/ui/Card';
import { Badge, Chip } from '../components/ui/Badge';
import { Avatar } from '../components/ui/Avatar';
import { StatCard } from '../components/ui/StatCard';
import { EmptyState, SkeletonGrid } from '../components/ui/States';
import { ConfirmDialog } from '../components/ui/Modal';
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
  const t = tones[processTone(process.color)];
  const agents = process.agents ?? [];
  const stages = [...new Set(agents.map((a) => a.processStage))].sort((a, b) => a - b);
  const running = process.status === 'ACTIVE';
  // A finished or failed chain is restartable; a running one can be paused.
  const startLabel = process.status === 'PAUSED' ? 'Resume' : 'Start';

  return (
    <Card padding="none" className="flex flex-col overflow-hidden">
      {/* Tinted rail identifies the production at a glance across the app. */}
      <div className={cn('h-1 w-full', t.solid)} aria-hidden />

      <div className="flex flex-1 flex-col p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="truncate text-md font-semibold text-ink">{process.name}</h3>
            {process.summary && (
              <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-ink-subtle">
                {process.summary}
              </p>
            )}
          </div>
          <Badge tone={statusTone[process.status]} dot pulse={process.status === 'ACTIVE'}>
            {process.status.toLowerCase()}
          </Badge>
        </div>

        {/* Stage → agent pipeline */}
        <div className="mt-4 space-y-2">
          {stages.map((stage) => (
            <div key={stage} className="flex items-center gap-2">
              <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-inset text-2xs font-semibold text-ink-subtle">
                {stage}
              </span>
              <div className="flex min-w-0 flex-wrap items-center gap-1">
                {agents
                  .filter((a) => a.processStage === stage)
                  .map((a) => (
                    <span
                      key={a.id}
                      title={`${a.displayName} — ${a.processRole ?? 'agent'}`}
                      className="inline-flex items-center gap-1.5 rounded-full border border-line bg-inset py-0.5 pl-0.5 pr-2"
                    >
                      <Avatar name={a.displayName} emoji={a.avatar} size="xs" />
                      <span className="truncate text-xs font-medium text-ink">
                        {a.displayName}
                      </span>
                    </span>
                  ))}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 flex items-center justify-between border-t border-line-subtle pt-3 text-2xs text-ink-faint">
          <span className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <Bot size={12} strokeWidth={1.75} aria-hidden />
              {process.agentCount ?? agents.length}
            </span>
            <span className="flex items-center gap-1">
              <ListChecks size={12} strokeWidth={1.75} aria-hidden />
              {process.taskCount ?? 0}
            </span>
            <span className="flex items-center gap-1">
              <ActivityIcon size={12} strokeWidth={1.75} aria-hidden />
              {process.activityCount ?? 0}
            </span>
          </span>
          <span>{timeAgo(process.createdAt)}</span>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line-subtle px-3 py-2.5">
        {/* Primary Run Controls */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {running ? (
            <Button
              variant="secondary"
              size="xs"
              icon={Pause}
              loading={busy}
              onClick={() => onPause(process)}
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

        {/* Action Tool Group (Edit, Settings, Delete) */}
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
    </Card>
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
  // Which card is mid-transition, so only that button shows a spinner.
  const [busyId, setBusyId] = useState<string | null>(null);
  const [runError, setRunError] = useState<string | null>(null);
  const [runTarget, setRunTarget] = useState<Process | null>(null);
  const [reportTarget, setReportTarget] = useState<Process | null>(null);
  const [editTarget, setEditTarget] = useState<Process | null>(null);
  const [settingsTarget, setSettingsTarget] = useState<Process | null>(null);
  // Which chains produced an HTML artifact, so only those show a Preview link.
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

  // Probe each chain's artifacts once so the Preview affordance is accurate.
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
      // Agents go with the production — leaving orphans behind is worse.
      await removeProcess(pendingDelete.id, true);
      setPendingDelete(null);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <PageHeader
        icon={Factory}
        title="Productions"
        description="Describe a goal and MyceliumOps builds the agent chain to deliver it."
        actions={
          <Button variant="primary" icon={Plus} onClick={() => setShowCreate(true)}>
            New Production
          </Button>
        }
      />

      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <StatCard
          label="Productions"
          value={stats?.total ?? processes.length}
          icon={Factory}
          tone="brand"
          muted={(stats?.total ?? processes.length) === 0}
        />
        <StatCard
          label="Active"
          value={stats?.active ?? 0}
          icon={Workflow}
          tone="success"
          muted={(stats?.active ?? 0) === 0}
        />
        <StatCard
          label="Agents deployed"
          value={stats?.agentsInProcesses ?? 0}
          icon={Bot}
          tone="accent"
          muted={(stats?.agentsInProcesses ?? 0) === 0}
        />
      </div>

      {runError && (
        <p
          role="alert"
          className="mt-4 rounded-lg border border-red-500/25 bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-300"
        >
          {runError}
        </p>
      )}

      <div className="mt-6">
        {loading && processes.length === 0 ? (
          <SkeletonGrid count={3} />
        ) : processes.length === 0 ? (
          <Card padding="none">
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
          </Card>
        ) : (
          <div className="stagger grid gap-4 md:grid-cols-2 xl:grid-cols-3">
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
    </>
  );
}
