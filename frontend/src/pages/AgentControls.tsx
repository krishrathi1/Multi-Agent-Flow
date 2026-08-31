import { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  SlidersHorizontal,
  Bot,
  Pause,
  Play,
  Plus,
  Search,
  Zap,
  Clock,
  Sparkles,
  Radio,
  RefreshCw,
  Send,
  MoreVertical,
  Activity,
  Layers,
} from 'lucide-react';
import { api } from '@/lib/api';
import type { Agent, Command } from '@/types';
import { cn, timeAgo } from '@/lib/utils';
import { agentStatusTone } from '@/lib/design';
import { useAgentStore } from '@/stores/agent-store';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Avatar } from '@/components/ui/Avatar';
import { HourglassLoader } from '@/components/ui/HourglassLoader';
import { useToast } from '@/components/ui/Toast';
import { AgentDetailSheet } from '@/components/agent/AgentDetailSheet';

export function AgentControls() {
  const { agents, fetchAgents } = useAgentStore();
  const [allCommands, setAllCommands] = useState<Command[]>([]);
  const [sendingAll, setSendingAll] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ONLINE' | 'IDLE' | 'OFFLINE' | 'ERROR'>('ALL');
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [loading, setLoading] = useState(false);
  const toast = useToast();

  const fetchAllCommands = useCallback(async () => {
    try {
      const cmds = await api.commands.list();
      setAllCommands(cmds);
    } catch (err) {
      console.error('Failed to fetch commands:', err);
    }
  }, []);

  const handleRefresh = async () => {
    setLoading(true);
    await Promise.all([fetchAgents(), fetchAllCommands()]);
    setLoading(false);
  };

  useEffect(() => {
    handleRefresh();
  }, []);

  const pendingCount = allCommands.filter((c) => c.status === 'PENDING').length;
  const onlineCount = agents.filter((a) => a.status === 'ONLINE').length;
  const idleCount = agents.filter((a) => a.status === 'IDLE').length;

  const filteredAgents = useMemo(() => {
    return agents.filter((a) => {
      const matchesSearch =
        a.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        a.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (a.processRole && a.processRole.toLowerCase().includes(searchQuery.toLowerCase()));

      if (!matchesSearch) return false;
      if (statusFilter === 'ALL') return true;
      return a.status === statusFilter;
    });
  }, [agents, searchQuery, statusFilter]);

  const handlePauseAll = async () => {
    if (!window.confirm('Pause all running agents in the fleet?')) return;
    setSendingAll('PAUSE');
    try {
      await Promise.all(
        agents.filter((a) => a.enabled).map((a) => api.commands.send({ agentId: a.id, type: 'PAUSE' }))
      );
      toast.success('Fleet paused', 'All active agents set to idle');
      handleRefresh();
    } catch (err) {
      toast.error('Failed to pause fleet', (err as Error).message);
    } finally {
      setSendingAll(null);
    }
  };

  const handleResumeAll = async () => {
    setSendingAll('RESUME');
    try {
      await Promise.all(
        agents.filter((a) => a.enabled).map((a) => api.commands.send({ agentId: a.id, type: 'RESUME' }))
      );
      toast.success('Fleet resumed', 'All active agents brought online');
      handleRefresh();
    } catch (err) {
      toast.error('Failed to resume fleet', (err as Error).message);
    } finally {
      setSendingAll(null);
    }
  };

  const [togglingAgentId, setTogglingAgentId] = useState<string | null>(null);
  const updateAgent = useAgentStore((s) => s.updateAgent);

  const handleToggleAgent = async (agent: Agent, e: React.MouseEvent) => {
    e.stopPropagation();
    const isOnline = agent.status === 'ONLINE' && agent.enabled;
    const nextEnabled = !isOnline;
    const nextStatus = nextEnabled ? 'ONLINE' : 'IDLE';
    const cmdType = nextEnabled ? 'RESUME' : 'PAUSE';

    setTogglingAgentId(agent.id);
    try {
      await Promise.all([
        api.agents.updateConfig(agent.id, { enabled: nextEnabled }),
        api.commands.send({ agentId: agent.id, type: cmdType }),
      ]);
      updateAgent({ id: agent.id, enabled: nextEnabled, status: nextStatus });
      toast.success(
        nextEnabled ? 'Agent Activated' : 'Agent Deactivated',
        `${agent.displayName} is now ${nextEnabled ? 'online' : 'paused/idle'}`
      );
      handleRefresh();
    } catch (err) {
      toast.error('Failed to toggle agent state', (err as Error).message);
    } finally {
      setTogglingAgentId(null);
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6 max-w-5xl mx-auto pb-16">
      {/* Mobile Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-brand-500/10 text-brand-600 dark:text-brand-400 border border-brand-500/20 flex items-center justify-center shrink-0">
            <SlidersHorizontal size={17} />
          </div>
          <div>
            <h1 className="text-base sm:text-lg font-bold text-ink tracking-tight flex items-center gap-2">
              Agent Control
              <Badge tone="brand" size="sm">
                {agents.length} Agents
              </Badge>
            </h1>
            <p className="text-2xs text-ink-muted">Operational fleet command, directives, and real-time execution</p>
          </div>
        </div>

        {/* Global Fleet Actions */}
        <div className="flex items-center gap-2 flex-wrap self-start sm:self-auto">
          <Button
            variant="secondary"
            size="xs"
            icon={Pause}
            loading={sendingAll === 'PAUSE'}
            onClick={handlePauseAll}
          >
            Pause All
          </Button>
          <Button
            variant="secondary"
            size="xs"
            icon={Play}
            loading={sendingAll === 'RESUME'}
            onClick={handleResumeAll}
          >
            Resume All
          </Button>
          <Link to="/agents/new">
            <Button variant="primary" size="xs" icon={Plus}>
              New Agent
            </Button>
          </Link>
        </div>
      </div>

      {/* KPI Metric Summary Strip (4-Column) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3.5">
        <div className="p-3 sm:p-4 rounded-2xl border border-line-subtle bg-surface shadow-2xs space-y-1">
          <span className="text-2xs font-bold uppercase tracking-wider text-ink-muted block">Total Fleet</span>
          <div className="text-lg sm:text-xl font-bold font-mono text-ink">{agents.length}</div>
          <span className="text-[10px] text-ink-faint font-mono block">Registered agents</span>
        </div>

        <div className="p-3 sm:p-4 rounded-2xl border border-line-subtle bg-surface shadow-2xs space-y-1">
          <span className="text-2xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 block">Online</span>
          <div className="text-lg sm:text-xl font-bold font-mono text-emerald-600 dark:text-emerald-400">{onlineCount}</div>
          <span className="text-[10px] text-ink-faint font-mono block">Executing & ready</span>
        </div>

        <div className="p-3 sm:p-4 rounded-2xl border border-line-subtle bg-surface shadow-2xs space-y-1">
          <span className="text-2xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 block">Idle / Paused</span>
          <div className="text-lg sm:text-xl font-bold font-mono text-ink">{idleCount}</div>
          <span className="text-[10px] text-ink-faint font-mono block">Awaiting triggers</span>
        </div>

        <div className="p-3 sm:p-4 rounded-2xl border border-line-subtle bg-surface shadow-2xs space-y-1">
          <span className="text-2xs font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400 block">Pending Cmds</span>
          <div className="text-lg sm:text-xl font-bold font-mono text-purple-600 dark:text-purple-400">{pendingCount}</div>
          <span className="text-[10px] text-ink-faint font-mono block">In flight</span>
        </div>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
        {/* Search */}
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search agents by name, role, or stage..."
            className="w-full rounded-2xl border border-line bg-surface pl-9 pr-3.5 py-2 text-xs text-ink placeholder:text-ink-muted shadow-2xs focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </div>

        {/* Status Filter Chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
          {(
            [
              { id: 'ALL', label: 'All' },
              { id: 'ONLINE', label: 'Online' },
              { id: 'IDLE', label: 'Idle' },
              { id: 'OFFLINE', label: 'Offline' },
              { id: 'ERROR', label: 'Error' },
            ] as const
          ).map((filter) => (
            <button
              key={filter.id}
              type="button"
              onClick={() => setStatusFilter(filter.id)}
              className={cn(
                'shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer shadow-2xs',
                statusFilter === filter.id
                  ? 'bg-brand-600 text-white shadow-xs'
                  : 'border border-line bg-surface text-ink-muted hover:text-ink hover:bg-hover'
              )}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </div>

      {/* Agents List (Scannable Cards with 4-box scroll container) */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <HourglassLoader size={48} label="Loading fleet telemetry..." />
        </div>
      ) : filteredAgents.length === 0 ? (
        <div className="py-16 text-center text-xs text-ink-muted bg-surface rounded-2xl border border-line-subtle p-6">
          <Bot size={32} className="mx-auto mb-2 text-ink-faint opacity-50" />
          <p className="font-bold text-ink mb-1">No agents found</p>
          <p className="text-2xs text-ink-muted max-w-xs mx-auto">
            {searchQuery || statusFilter !== 'ALL'
              ? 'Try changing your search or filter settings.'
              : 'Create a new autonomous agent to start orchestrating.'}
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {filteredAgents.map((agent) => {
            const isOnline = agent.status === 'ONLINE' && agent.enabled;
            const tone = agentStatusTone[agent.status] || 'neutral';
            return (
              <div
                key={agent.id}
                onClick={() => setSelectedAgent(agent)}
                className="w-full rounded-2xl border border-line-subtle bg-surface p-3.5 sm:p-4 shadow-2xs hover:border-line hover:bg-hover/30 transition-all flex items-center justify-between gap-3 text-left cursor-pointer active:scale-[0.99]"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-2xl bg-brand-500/10 border border-brand-500/20 text-brand-600 dark:text-brand-400 flex items-center justify-center text-base shrink-0">
                    {agent.avatar ? agent.avatar : '🤖'}
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs sm:text-sm font-bold text-ink truncate">
                        {agent.displayName}
                      </span>
                      <Badge tone={tone} size="sm" dot pulse={isOnline}>
                        {agent.status.toLowerCase()}
                      </Badge>
                    </div>

                    <div className="flex items-center gap-1.5 text-[11px] text-ink-muted font-mono mt-0.5 truncate">
                      {agent.processRole ? (
                        <span className="text-brand-600 dark:text-brand-400 font-semibold truncate">
                          {agent.processRole} {agent.processStage != null ? `(Stage ${agent.processStage})` : ''}
                        </span>
                      ) : (
                        <span>Autonomous Persona</span>
                      )}
                      <span>•</span>
                      <span>Heartbeat: {timeAgo(agent.lastHeartbeat)}</span>
                    </div>
                  </div>
                </div>

                {/* Direct Actions: Activate / Deactivate Toggle + Directives */}
                <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                  <Button
                    variant={isOnline ? 'secondary' : 'primary'}
                    size="xs"
                    icon={isOnline ? Pause : Play}
                    loading={togglingAgentId === agent.id}
                    onClick={(e) => handleToggleAgent(agent, e)}
                    className={cn(
                      isOnline && 'text-amber-600 dark:text-amber-400 hover:text-rose-600 border-line'
                    )}
                  >
                    {isOnline ? 'Deactivate' : 'Activate'}
                  </Button>

                  <Button
                    variant="secondary"
                    size="xs"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedAgent(agent);
                    }}
                  >
                    Directives
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Agent Detail Sheet */}
      <AgentDetailSheet
        agent={selectedAgent}
        onClose={() => setSelectedAgent(null)}
        onCommandSent={fetchAllCommands}
      />
    </div>
  );
}
