import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  Bot,
  ChevronDown,
  Edit3,
  Heart,
  History,
  MessageSquarePlus,
  Pause,
  Play,
  Plus,
  Radio,
  Save,
  Send,
  SlidersHorizontal,
  Sparkles,
  Zap,
} from 'lucide-react';
import { api } from '@/lib/api';
import type { Agent, Command } from '@/types';
import { cn, timeAgo } from '@/lib/utils';
import { agentStatusTone } from '@/lib/design';
import { useAgentStore } from '@/stores/agent-store';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge, Chip } from '@/components/ui/Badge';
import { Avatar } from '@/components/ui/Avatar';
import { useToast } from '@/components/ui/Toast';

function AgentControlCard({ agent, onCommandSent }: { agent: Agent; onCommandSent: () => void }) {
  const [soulMd, setSoulMd] = useState(agent.soulMd ?? '');
  const [soulOpen, setSoulOpen] = useState(false);
  const [heartbeatInterval, setHeartbeatInterval] = useState(agent.heartbeatInterval);
  const [enabled, setEnabled] = useState(agent.enabled);
  const [injectOpen, setInjectOpen] = useState(false);
  const [injectText, setInjectText] = useState('');
  const [historyOpen, setHistoryOpen] = useState(false);
  const [commands, setCommands] = useState<Command[]>([]);
  const [savingSoul, setSavingSoul] = useState(false);
  const [savingHb, setSavingHb] = useState(false);
  const [sendingCmd, setSendingCmd] = useState<string | null>(null);
  const updateAgent = useAgentStore((s) => s.updateAgent);
  const toast = useToast();

  const fetchCommands = useCallback(async () => {
    try {
      const cmds = await api.commands.list(agent.id);
      setCommands(cmds);
    } catch (err) {
      console.error('Failed to fetch commands:', err);
    }
  }, [agent.id]);

  useEffect(() => {
    if (historyOpen) fetchCommands();
  }, [historyOpen, fetchCommands]);

  useEffect(() => {
    setEnabled(agent.enabled);
    setHeartbeatInterval(agent.heartbeatInterval);
  }, [agent.enabled, agent.heartbeatInterval]);

  const handleToggleEnabled = async () => {
    const newVal = !enabled;
    setEnabled(newVal);
    try {
      await api.agents.updateConfig(agent.id, { enabled: newVal });
      updateAgent({ id: agent.id, enabled: newVal });
      toast.success(newVal ? 'Agent enabled' : 'Agent disabled', `${agent.displayName} is now ${newVal ? 'active' : 'disabled'}`);
    } catch (err) {
      setEnabled(!newVal);
      toast.error('Failed to toggle', (err as Error).message);
    }
  };

  const handleSaveSoul = async () => {
    setSavingSoul(true);
    try {
      await api.agents.updateConfig(agent.id, { soulMd });
      updateAgent({ id: agent.id, soulMd });
      toast.success('SOUL.md updated', `Personality and instructions saved for ${agent.displayName}`);
      setSoulOpen(false);
    } catch (err) {
      toast.error('Failed to save SOUL.md', (err as Error).message);
    } finally {
      setSavingSoul(false);
    }
  };

  const handleUpdateHeartbeat = async () => {
    setSavingHb(true);
    try {
      await api.agents.updateConfig(agent.id, { heartbeatInterval });
      updateAgent({ id: agent.id, heartbeatInterval });
      toast.success('Heartbeat updated', `Set to ${heartbeatInterval} min`);
    } catch (err) {
      toast.error('Failed to update heartbeat', (err as Error).message);
    } finally {
      setSavingHb(false);
    }
  };

  const handleSendCommand = async (type: string, payload?: Record<string, unknown>) => {
    setSendingCmd(type);
    try {
      await api.commands.send({ agentId: agent.id, type, payload });
      toast.success(`Command "${type}" dispatched`, `Sent to ${agent.displayName}`);
      onCommandSent();
      if (historyOpen) fetchCommands();
    } catch (err) {
      toast.error('Command failed', (err as Error).message);
    } finally {
      setSendingCmd(null);
    }
  };

  const handleInject = async () => {
    if (!injectText.trim()) return;
    await handleSendCommand('INJECT', { message: injectText.trim() });
    setInjectText('');
    setInjectOpen(false);
  };

  const tone = agentStatusTone[agent.status] || 'neutral';

  return (
    <Card padding="none" className="flex flex-col overflow-hidden border-line rounded-2xl shadow-2xs hover:shadow-xs transition-all">
      {/* Header Bar */}
      <div className="border-b border-line-subtle bg-raised/40 p-3.5 sm:p-4 space-y-2.5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0 flex-1">
            <Avatar name={agent.displayName} emoji={agent.avatar} size="md" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm font-bold text-ink truncate">{agent.displayName}</h3>
                <Badge tone={tone} dot pulse={agent.status === 'ONLINE'}>
                  {agent.status.toLowerCase()}
                </Badge>
              </div>
              <div className="mt-0.5 text-xs text-ink-muted">
                {agent.processRole ? (
                  <p className="font-medium text-brand-600 dark:text-brand-400 line-clamp-2 leading-tight">
                    {agent.processRole} {agent.processStage != null ? `(Stage ${agent.processStage})` : ''}
                  </p>
                ) : (
                  <span>Autonomous Agent</span>
                )}
              </div>
            </div>
          </div>

          {/* Toggle Switch + Edit Profile */}
          <div className="flex items-center gap-2 shrink-0">
            <Link
              to={`/agents/${agent.id}/edit`}
              className="inline-flex items-center gap-1 rounded-xl border border-line bg-surface px-2.5 py-1 text-xs font-semibold text-ink-subtle hover:border-line-strong hover:text-ink transition-colors shadow-2xs"
            >
              <Edit3 size={11} />
              <span>Edit</span>
            </Link>

            <button
              type="button"
              role="switch"
              aria-checked={enabled}
              onClick={handleToggleEnabled}
              className={cn(
                'relative inline-flex h-5 w-10 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 shadow-2xs',
                enabled ? 'bg-emerald-500' : 'bg-line-strong dark:bg-surface-700'
              )}
            >
              <span
                className={cn(
                  'pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out',
                  enabled ? 'translate-x-5' : 'translate-x-0'
                )}
              />
            </button>
          </div>
        </div>
      </div>

      {/* Card Body */}
      <div className="p-3.5 sm:p-4 space-y-3.5 flex-1 flex flex-col justify-between">
        {/* Current Task if any */}
        {agent.currentTask ? (
          <div className="rounded-xl border border-line-subtle bg-inset p-3">
            <span className="text-2xs font-bold text-ink-faint uppercase tracking-wider block">Current Task</span>
            <p className="text-xs text-ink mt-0.5 font-medium leading-relaxed break-words">{agent.currentTask}</p>
          </div>
        ) : (
          <div className="rounded-xl border border-line-subtle/50 bg-inset/40 p-2.5 text-2xs text-ink-faint italic">
            Standing by for pipeline task dispatch...
          </div>
        )}

        {/* Quick Command Buttons: 3 Columns Grid on Mobile */}
        <div className="grid grid-cols-3 gap-2 pt-1">
          <Button
            variant="secondary"
            size="xs"
            icon={Pause}
            loading={sendingCmd === 'PAUSE'}
            onClick={() => handleSendCommand('PAUSE')}
            className="hover:text-amber-600 dark:hover:text-amber-400 w-full justify-center"
          >
            Pause
          </Button>

          <Button
            variant="secondary"
            size="xs"
            icon={Play}
            loading={sendingCmd === 'RESUME'}
            onClick={() => handleSendCommand('RESUME')}
            className="hover:text-emerald-600 dark:hover:text-emerald-400 w-full justify-center"
          >
            Resume
          </Button>

          <Button
            variant="secondary"
            size="xs"
            icon={Zap}
            onClick={() => setInjectOpen(!injectOpen)}
            className="hover:text-brand-600 dark:hover:text-brand-400 w-full justify-center truncate"
          >
            Inject
          </Button>
        </div>

        {/* Inject Input */}
        {injectOpen && (
          <div className="flex gap-1.5 rounded-lg border border-brand-500/30 bg-brand-500/5 p-2 transition-all">
            <input
              type="text"
              value={injectText}
              onChange={(e) => setInjectText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleInject()}
              placeholder="Inject direct instruction to agent memory..."
              className="flex-1 rounded-md border border-line bg-surface px-2.5 py-1 text-xs text-ink placeholder:text-ink-faint focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
            <Button
              variant="primary"
              size="xs"
              icon={Send}
              loading={sendingCmd === 'INJECT'}
              onClick={handleInject}
              disabled={!injectText.trim()}
            >
              Inject
            </Button>
          </div>
        )}

        {/* Heartbeat Controller */}
        <div className="flex items-center justify-between gap-2 border-t border-line-subtle pt-3 text-xs">
          <span className="flex items-center gap-1.5 font-medium text-ink-muted text-xs">
            <Radio size={13} className="text-brand-500" />
            Heartbeat:
          </span>
          <div className="flex items-center gap-1.5">
            <input
              type="number"
              min={1}
              max={120}
              value={heartbeatInterval}
              onChange={(e) => setHeartbeatInterval(parseInt(e.target.value) || 1)}
              className="w-16 rounded-md border border-line bg-surface px-2 py-0.5 text-center text-xs text-ink focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
            <span className="text-2xs text-ink-faint">min</span>
            <Button
              variant="ghost"
              size="xs"
              loading={savingHb}
              disabled={heartbeatInterval === agent.heartbeatInterval}
              onClick={handleUpdateHeartbeat}
            >
              Update
            </Button>
          </div>
        </div>

        {/* Collapsible SOUL.md & Command History */}
        <div className="space-y-1.5 pt-1">
          {/* SOUL.md */}
          <div className="rounded-lg border border-line-subtle bg-inset/50 overflow-hidden">
            <button
              type="button"
              onClick={() => setSoulOpen(!soulOpen)}
              className="flex w-full items-center justify-between px-3 py-2 text-left text-xs font-medium text-ink-muted hover:bg-raised/60 hover:text-ink transition-colors"
            >
              <span className="flex items-center gap-1.5">
                <Sparkles size={12} className="text-accent-500" />
                SOUL.md Directives
              </span>
              <ChevronDown size={14} className={cn('transition-transform duration-150', soulOpen && 'rotate-180')} />
            </button>
            {soulOpen && (
              <div className="border-t border-line-subtle p-3 space-y-2 bg-surface">
                <textarea
                  value={soulMd}
                  onChange={(e) => setSoulMd(e.target.value)}
                  rows={6}
                  className="w-full rounded-md border border-line bg-inset p-2 font-mono text-2xs text-ink focus:outline-none focus:ring-1 focus:ring-brand-500 leading-relaxed resize-y"
                  placeholder="Agent directives, tone, and cognitive policies..."
                />
                <div className="flex justify-end">
                  <Button variant="primary" size="xs" icon={Save} loading={savingSoul} onClick={handleSaveSoul}>
                    Save SOUL
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Command History */}
          <div className="rounded-lg border border-line-subtle bg-inset/50 overflow-hidden">
            <button
              type="button"
              onClick={() => setHistoryOpen(!historyOpen)}
              className="flex w-full items-center justify-between px-3 py-2 text-left text-xs font-medium text-ink-muted hover:bg-raised/60 hover:text-ink transition-colors"
            >
              <span className="flex items-center gap-1.5">
                <History size={12} className="text-ink-faint" />
                Command History ({commands.length})
              </span>
              <ChevronDown size={14} className={cn('transition-transform duration-150', historyOpen && 'rotate-180')} />
            </button>
            {historyOpen && (
              <div className="border-t border-line-subtle p-2 max-h-40 overflow-y-auto space-y-1.5 bg-surface">
                {commands.length === 0 ? (
                  <p className="text-2xs text-ink-faint py-1.5 text-center italic">No commands dispatched yet</p>
                ) : (
                  commands.map((cmd) => (
                    <div key={cmd.id} className="flex items-center justify-between rounded border border-line-subtle bg-inset px-2 py-1 text-2xs">
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold uppercase text-brand-600 dark:text-brand-400">{cmd.type}</span>
                        {cmd.payload != null && (cmd.payload as Record<string, unknown>).message != null && (
                          <span className="truncate max-w-[140px] text-ink-muted">
                            {String((cmd.payload as Record<string, unknown>).message)}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge tone={cmd.status === 'COMPLETED' ? 'success' : cmd.status === 'PENDING' ? 'warning' : 'info'}>
                          {cmd.status.toLowerCase()}
                        </Badge>
                        <span className="text-ink-faint">{timeAgo(cmd.createdAt)}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}

export function AgentControls() {
  const { agents, fetchAgents } = useAgentStore();
  const [allCommands, setAllCommands] = useState<Command[]>([]);
  const [sendingAll, setSendingAll] = useState<string | null>(null);
  const toast = useToast();

  useEffect(() => {
    fetchAgents();
    fetchAllCommands();
  }, [fetchAgents]);

  const fetchAllCommands = async () => {
    try {
      const cmds = await api.commands.list();
      setAllCommands(cmds);
    } catch (err) {
      console.error('Failed to fetch commands:', err);
    }
  };

  const pendingCount = allCommands.filter((c) => c.status === 'PENDING').length;

  const handlePauseAll = async () => {
    setSendingAll('PAUSE');
    try {
      await Promise.all(
        agents.filter((a) => a.enabled).map((a) => api.commands.send({ agentId: a.id, type: 'PAUSE' }))
      );
      toast.success('Fleet paused', 'All active agents set to idle');
      fetchAllCommands();
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
      fetchAllCommands();
    } catch (err) {
      toast.error('Failed to resume fleet', (err as Error).message);
    } finally {
      setSendingAll(null);
    }
  };

  return (
    <>
      <PageHeader
        icon={SlidersHorizontal}
        title="Agent Controls"
        description="Human-in-the-loop command center — pause, resume, inject instructions, and update cognitive directives in real time."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              icon={Pause}
              loading={sendingAll === 'PAUSE'}
              onClick={handlePauseAll}
            >
              Pause All
            </Button>
            <Button
              variant="secondary"
              size="sm"
              icon={Play}
              loading={sendingAll === 'RESUME'}
              onClick={handleResumeAll}
            >
              Resume All
            </Button>
            <Link to="/agents/new">
              <Button variant="primary" size="sm" icon={Plus}>
                Create Agent
              </Button>
            </Link>
          </div>
        }
      />

      {/* Quick Status Bar */}
      <div className="mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 rounded-2xl border border-line bg-surface p-4 shadow-2xs">
        <div className="flex flex-wrap items-center gap-4 sm:gap-6">
          <div className="flex items-center gap-2">
            <Bot size={16} className="text-brand-500" />
            <span className="text-xs font-bold text-ink">{agents.length} Total Agents</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
              {agents.filter((a) => a.status === 'ONLINE').length} Online / Active
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {pendingCount > 0 ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 px-2.5 py-0.5 text-2xs font-bold text-amber-600 dark:text-amber-400">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-ping" />
              {pendingCount} Pending Commands
            </span>
          ) : (
            <span className="text-2xs font-semibold text-ink-muted">✓ All commands delivered</span>
          )}
        </div>
      </div>

      {/* Agents Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {agents.map((agent) => (
          <AgentControlCard
            key={agent.id}
            agent={agent}
            onCommandSent={fetchAllCommands}
          />
        ))}
      </div>
    </>
  );
}
