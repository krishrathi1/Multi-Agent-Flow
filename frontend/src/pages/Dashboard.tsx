import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Activity,
  Bot,
  CheckCircle2,
  ChevronRight,
  Edit3,
  ExternalLink,
  Factory,
  FileText,
  History,
  Layers,
  LayoutDashboard,
  MessagesSquare,
  MoreVertical,
  Pause,
  Play,
  Plus,
  Radio,
  Settings,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  Workflow,
  Zap,
} from 'lucide-react';
import { useAgentStore } from '../stores/agent-store';
import { useProcessStore } from '../stores/process-store';
import { processTone } from '../components/process/ProcessScope';
import { tones } from '../lib/design';
import { Badge } from '../components/ui/Badge';
import { Card } from '../components/ui/Card';
import { Avatar } from '../components/ui/Avatar';
import { cn, timeAgo } from '../lib/utils';
import { StatsBar } from '../components/dashboard/StatsBar';
import { SystemHealth } from '../components/dashboard/SystemHealth';
import { PageHeader, SectionHeading } from '../components/ui/PageHeader';
import { Button, ButtonLink } from '../components/ui/Button';
import { EmptyState, SkeletonCard } from '../components/ui/States';
import { Tabs } from '../components/ui/Tabs';
import { CreateProcessModal } from '../components/process/CreateProcessModal';
import { EditProcessModal } from '../components/process/EditProcessModal';
import { ProcessReportModal } from '../components/process/ProcessReportModal';
import type { Agent, Process, ProcessStatus } from '../types';

const statusTone: Record<ProcessStatus, 'success' | 'warning' | 'neutral' | 'danger' | 'info'> = {
  DRAFT: 'neutral',
  PLANNING: 'info',
  ACTIVE: 'success',
  PAUSED: 'warning',
  COMPLETED: 'info',
  FAILED: 'danger',
};

type FilterType = 'all' | 'ACTIVE' | 'PAUSED' | 'PLANNING' | 'standby';

export function Dashboard() {
  const { agents, loading: agentsLoading } = useAgentStore();
  const {
    processes,
    loading: processesLoading,
    fetchProcesses,
    startProcess,
    pauseProcess,
  } = useProcessStore();
  const [filter, setFilter] = useState<FilterType>('all');
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [busyProcessId, setBusyProcessId] = useState<string | null>(null);

  useEffect(() => {
    fetchProcesses();
  }, [fetchProcesses]);

  // Agents grouped into productions vs unassigned standby agents
  const { unassignedAgents, processesWithAgents } = useMemo(() => {
    const processMap = new Map<string, Agent[]>();
    const unassigned: Agent[] = [];

    for (const a of agents) {
      if (a.processId) {
        const list = processMap.get(a.processId) ?? [];
        list.push(a);
        processMap.set(a.processId, list);
      } else {
        unassigned.push(a);
      }
    }

    const merged = processes.map((p) => {
      const procAgents = processMap.get(p.id) ?? p.agents ?? [];
      return {
        ...p,
        agents: procAgents,
        agentCount: procAgents.length || p.agentCount,
      };
    });

    return { unassignedAgents: unassigned, processesWithAgents: merged };
  }, [agents, processes]);

  const counts = useMemo(() => {
    const base = { all: processesWithAgents.length, ACTIVE: 0, PAUSED: 0, PLANNING: 0, standby: unassignedAgents.length };
    for (const p of processesWithAgents) {
      if (p.status in base) {
        (base as any)[p.status] = ((base as any)[p.status] ?? 0) + 1;
      }
    }
    return base;
  }, [processesWithAgents, unassignedAgents]);

  const visibleProcesses = useMemo(() => {
    if (filter === 'all') return processesWithAgents;
    if (filter === 'standby') return [];
    return processesWithAgents.filter((p) => p.status === filter);
  }, [processesWithAgents, filter]);

  const handleToggleRun = async (process: Process) => {
    setBusyProcessId(process.id);
    try {
      if (process.status === 'ACTIVE') {
        await pauseProcess(process.id);
      } else {
        await startProcess(process.id);
      }
    } finally {
      setBusyProcessId(null);
    }
  };

  const tabs = useMemo(
    () =>
      (
        [
          { value: 'all' as const, label: 'All Production Blocks', count: counts.all },
          { value: 'ACTIVE' as const, label: 'Active', count: counts.ACTIVE },
          { value: 'PAUSED' as const, label: 'Paused', count: counts.PAUSED },
          { value: 'PLANNING' as const, label: 'Planning', count: counts.PLANNING },
          { value: 'standby' as const, label: 'Standby Fleet', count: counts.standby },
        ] satisfies { value: FilterType; label: string; count: number }[]
      ).filter((t) => t.value === 'all' || t.count > 0),
    [counts],
  );

  return (
    <>
      <PageHeader
        icon={LayoutDashboard}
        title="Mission Control Dashboard"
        description="Monitor and orchestrate multi-agent production blocks, autonomous chains, and fleet telemetry."
        actions={
          <div className="flex items-center gap-2.5">
            <ButtonLink to="/processes" variant="secondary" icon={Workflow}>
              Manage Pipelines
            </ButtonLink>
            <Button
              variant="primary"
              icon={Plus}
              onClick={() => setCreateModalOpen(true)}
            >
              New Production Block
            </Button>
          </div>
        }
      />

      <StatsBar />

      <div className="mt-8 grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        {/* Main Column: Production Blocks & Groups */}
        <div className="space-y-6">
          <SectionHeading
            title="Production Blocks & Chains"
            description="Autonomous multi-agent systems grouped into collaborative production pipelines."
            actions={
              <Tabs
                items={tabs}
                value={filter}
                onChange={setFilter}
                aria-label="Filter production blocks"
              />
            }
          />

          {processesLoading && processes.length === 0 ? (
            <div className="space-y-4">
              <SkeletonCard />
              <SkeletonCard />
            </div>
          ) : filter === 'standby' ? (
            /* Standby Agents Only View */
            <StandbyFleetCard agents={unassignedAgents} onNewProcess={() => setCreateModalOpen(true)} />
          ) : visibleProcesses.length === 0 ? (
            <Card padding="none" className="p-8 text-center">
              <EmptyState
                icon={Factory}
                title="No Production Blocks match this filter"
                description="Create a goal-driven production block and Nexus will auto-organize agents into an automated workflow."
                action={
                  <Button
                    variant="primary"
                    icon={Plus}
                    onClick={() => setCreateModalOpen(true)}
                  >
                    Create Production Block
                  </Button>
                }
              />
            </Card>
          ) : (
            <div className="space-y-5">
              {visibleProcesses.map((proc) => (
                <ProductionBlockCard
                  key={proc.id}
                  process={proc}
                  busy={busyProcessId === proc.id}
                  onToggleRun={() => handleToggleRun(proc)}
                />
              ))}

              {/* Show Standby Fleet at bottom if filtering All and there are unassigned agents */}
              {filter === 'all' && unassignedAgents.length > 0 && (
                <StandbyFleetCard agents={unassignedAgents} onNewProcess={() => setCreateModalOpen(true)} />
              )}
            </div>
          )}
        </div>

        {/* Aside: Real-Time Telemetry & Live Activity */}
        <aside className="min-w-0 space-y-6">
          <div>
            <SectionHeading title="Live Operations Feed" />
            <SystemHealth />
          </div>
        </aside>
      </div>

      {/* Creation Modal */}
      {createModalOpen && (
        <CreateProcessModal open={createModalOpen} onClose={() => setCreateModalOpen(false)} />
      )}
    </>
  );
}

/**
 * High-Impact Production Block Card: Visualizes an entire multi-agent group / pipeline
 */
function ProductionBlockCard({
  process,
  busy,
  onToggleRun,
}: {
  process: Process;
  busy: boolean;
  onToggleRun: () => void;
}) {
  const navigate = useNavigate();
  const removeProcess = useProcessStore((s) => s.removeProcess);
  const fetchProcesses = useProcessStore((s) => s.fetchProcesses);
  const [menuOpen, setMenuOpen] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const agents = process.agents ?? [];
  const stages = [...new Set(agents.map((a) => a.processStage || 1))].sort((a, b) => a - b);
  const isRunning = process.status === 'ACTIVE';

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    if (menuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [menuOpen]);

  const handleDelete = async () => {
    if (window.confirm(`Are you sure you want to delete production "${process.name}"?`)) {
      setDeleting(true);
      try {
        await removeProcess(process.id, false);
      } catch (err) {
        console.error('Failed to delete process:', err);
      } finally {
        setDeleting(false);
        setMenuOpen(false);
      }
    }
  };

  return (
    <>
      <Card padding="none" className="overflow-hidden border border-line-subtle bg-surface shadow-xs hover:shadow-sm transition-all rounded-2xl">
        {/* Block Header */}
        <div className="border-b border-line-subtle px-4 sm:px-5 py-4 bg-surface">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="rounded bg-inset px-2 py-0.5 text-2xs font-semibold text-ink-muted border border-line-subtle shrink-0">
                  Repo
                </span>
                <Link
                  to={`/processes`}
                  className="text-sm sm:text-base font-bold tracking-tight text-ink hover:text-brand-500 transition-colors break-words"
                >
                  {process.name}
                </Link>
                <span className={cn(
                  'rounded-full px-2.5 py-0.5 text-[11px] font-semibold shrink-0',
                  isRunning
                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                    : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                )}>
                  {isRunning ? 'Active' : 'Completed'}
                </span>
              </div>

              {process.summary && (
                <p className="mt-1.5 text-xs text-ink-muted leading-relaxed">
                  {process.summary}
                </p>
              )}
            </div>

            {/* Quick Action Buttons */}
            <div className="flex items-center gap-2 flex-wrap shrink-0 pt-1 sm:pt-0">
              <Button
                size="xs"
                variant="primary"
                icon={isRunning ? Pause : Play}
                loading={busy}
                onClick={onToggleRun}
              >
                {isRunning ? 'Pause' : 'Run Chain'}
              </Button>
              <ButtonLink
                to={`/activity?processId=${process.id}`}
                size="xs"
                variant="secondary"
                icon={Activity}
                title="View Production Activity"
              >
                Logs
              </ButtonLink>
              <ButtonLink
                to={`/processes`}
                size="xs"
                variant="secondary"
                icon={ExternalLink}
                title="Open Pipeline Canvas"
              >
                Canvas
              </ButtonLink>

              {/* Functional 3-Dots Dropdown */}
              <div className="relative" ref={menuRef}>
                <button
                  type="button"
                  onClick={() => setMenuOpen(!menuOpen)}
                  className={cn(
                    'grid h-7 w-7 place-items-center rounded-lg border border-line-subtle bg-surface text-ink-muted hover:border-line hover:bg-hover hover:text-ink transition-all cursor-pointer shadow-2xs',
                    menuOpen && 'border-brand-500 bg-surface text-brand-600 ring-2 ring-brand-500/10'
                  )}
                  title="More production options"
                >
                  <MoreVertical size={14} />
                </button>

                {menuOpen && (
                  <div className="absolute right-0 top-full z-50 mt-1.5 w-48 overflow-hidden rounded-2xl border border-line bg-surface/95 backdrop-blur-2xl p-1.5 shadow-xl space-y-0.5 animate-scale-in">
                    <button
                      type="button"
                      onClick={() => {
                        setShowEdit(true);
                        setMenuOpen(false);
                      }}
                      className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-xs font-semibold text-ink-muted hover:bg-hover hover:text-ink transition-colors cursor-pointer text-left"
                    >
                      <Edit3 size={13} className="text-brand-500" />
                      <span>Edit Pipeline</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setShowReport(true);
                        setMenuOpen(false);
                      }}
                      className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-xs font-semibold text-ink-muted hover:bg-hover hover:text-ink transition-colors cursor-pointer text-left"
                    >
                      <FileText size={13} className="text-emerald-500" />
                      <span>Audit Report</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        navigate(`/chat?processId=${process.id}`);
                        setMenuOpen(false);
                      }}
                      className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-xs font-semibold text-ink-muted hover:bg-hover hover:text-ink transition-colors cursor-pointer text-left"
                    >
                      <MessagesSquare size={13} className="text-violet-500" />
                      <span>Mother Chat</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        navigate(`/runs?processId=${process.id}`);
                        setMenuOpen(false);
                      }}
                      className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-xs font-semibold text-ink-muted hover:bg-hover hover:text-ink transition-colors cursor-pointer text-left"
                    >
                      <History size={13} className="text-amber-500" />
                      <span>Run History</span>
                    </button>

                    <div className="my-1 border-t border-line-subtle" />

                    <button
                      type="button"
                      onClick={handleDelete}
                      disabled={deleting}
                      className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-500/10 transition-colors cursor-pointer text-left"
                    >
                      <Trash2 size={13} />
                      <span>{deleting ? 'Deleting...' : 'Delete Production'}</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

      {/* Pipeline Stage Visualization */}
      <div className="p-4 sm:p-5 bg-surface space-y-3">
        <div className="flex items-center justify-between text-xs text-ink-muted font-medium">
          <span className="flex items-center gap-1.5 font-semibold text-ink-muted">
            <Workflow size={13} className="text-brand-500" />
            <span>Agent Pipeline Stages ({stages.length} {stages.length === 1 ? 'stage' : 'stages'})</span>
          </span>
          <span className="text-xs text-ink-faint">
            {agents.length} agent{agents.length === 1 ? '' : 's'} in block
          </span>
        </div>

        {stages.length === 0 || agents.length === 0 ? (
          <div className="rounded-xl border border-dashed border-line bg-inset/50 p-4 text-center text-xs text-ink-muted">
            No agents mapped to this block yet.{' '}
            <Link to="/processes" className="font-semibold text-brand-500 hover:underline">
              Configure Pipeline & Agents →
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {stages.map((stageNum) => {
              const stageAgents = agents.filter((a) => (a.processStage || 1) === stageNum);
              return (
                <div
                  key={stageNum}
                  className="rounded-xl border border-line-subtle bg-inset/30 p-3 flex flex-col gap-2"
                >
                  <div className="text-[11px] font-bold text-ink-muted">
                    Stage {stageNum}
                  </div>

                  <div className="space-y-2">
                    {stageAgents.map((agent) => (
                      <AgentMiniRow key={agent.id} agent={agent} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Block Footer */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 border-t border-line-subtle px-4 sm:px-5 py-3 text-xs text-ink-muted bg-surface">
        <div className="flex items-center gap-3 sm:gap-4 flex-wrap">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-emerald-500 inline-block" />
            <span className="font-semibold text-ink">
              {agents.filter((a) => a.status === 'ONLINE').length}
            </span>{' '}
            online
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-amber-500 inline-block" />
            <span className="font-semibold text-ink">
              {agents.filter((a) => a.status === 'IDLE').length}
            </span>{' '}
            idle
          </span>
          {process.budgetUsd && (
            <span className="text-xs text-ink-muted">
              Budget: <strong className="text-ink">${process.budgetUsd}</strong>
            </span>
          )}
        </div>

        <Link
          to="/processes"
          className="flex items-center gap-1 text-xs font-semibold text-brand-600 dark:text-brand-400 hover:underline shrink-0"
        >
          <span>Pipeline Details →</span>
        </Link>
      </div>
    </Card>

    {/* Inline Modals triggered from 3-dots dropdown */}
    {showEdit && (
      <EditProcessModal
        process={process}
        open={showEdit}
        onClose={() => setShowEdit(false)}
        onSaved={() => fetchProcesses()}
      />
    )}

    {showReport && (
      <ProcessReportModal
        process={process}
        open={showReport}
        onClose={() => setShowReport(false)}
      />
    )}
  </>
  );
}

/**
 * Mini interactive row for an agent inside a stage
 */
function AgentMiniRow({ agent }: { agent: Agent }) {
  const initials = agent.displayName
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="group flex items-center justify-between gap-3 rounded-xl border border-line-subtle bg-surface p-3 shadow-2xs hover:border-line-strong transition-all">
      <div className="flex items-start gap-2.5 min-w-0 flex-1">
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 text-[11px] font-bold">
          {initials || 'AG'}
        </span>

        <div className="min-w-0 flex-1">
          <Link
            to={`/agents/${agent.id}`}
            className="truncate text-xs font-bold text-ink hover:text-brand-500 transition-colors block"
          >
            {agent.displayName}
          </Link>
          <p className="text-[11px] text-ink-muted leading-relaxed line-clamp-2 mt-0.5">
            {agent.description || agent.processRole || agent.name}
          </p>
        </div>
      </div>

      <div className="shrink-0 flex items-center">
        <CheckCircle2 size={16} className="text-emerald-500" />
      </div>
    </div>
  );
}

/**
 * Standby & Specialized Agents Group Block
 */
function StandbyFleetCard({
  agents,
  onNewProcess,
}: {
  agents: Agent[];
  onNewProcess: () => void;
}) {
  if (agents.length === 0) return null;

  return (
    <Card padding="none" className="overflow-hidden border border-line-strong/60 shadow-sm">
      <div className="h-1.5 w-full bg-gradient-to-r from-slate-400 to-slate-600" />
      <div className="border-b border-line-subtle bg-surface/70 px-5 py-3.5 backdrop-blur-sm flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-slate-600 text-xs font-bold text-white shadow-xs">
            <Bot size={14} />
          </span>
          <div>
            <h3 className="text-sm font-bold text-ink">Standby Fleet & Unassigned Agents</h3>
            <p className="text-2xs text-ink-muted">
              {agents.length} agent{agents.length === 1 ? '' : 's'} available for new autonomous production blocks
            </p>
          </div>
        </div>

        <Button size="xs" variant="secondary" icon={Plus} onClick={onNewProcess}>
          Create Block with Standby Agents
        </Button>
      </div>

      <div className="p-4 bg-surface grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
        {agents.map((agent) => (
          <AgentMiniRow key={agent.id} agent={agent} />
        ))}
      </div>
    </Card>
  );
}
