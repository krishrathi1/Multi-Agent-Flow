import { useState, useEffect, useCallback } from 'react';
import {
  X,
  Bot,
  Activity,
  Zap,
  SlidersHorizontal,
  Clock,
  Send,
  Save,
  Check,
  Radio,
  History,
  Shield,
  Layers,
  Sparkles,
} from 'lucide-react';
import { api } from '@/lib/api';
import type { Agent, Command } from '@/types';
import { cn, timeAgo } from '@/lib/utils';
import { agentStatusTone } from '@/lib/design';
import { useAgentStore } from '@/stores/agent-store';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';

interface AgentDetailSheetProps {
  agent: Agent | null;
  onClose: () => void;
  onCommandSent?: () => void;
}

export function AgentDetailSheet({ agent, onClose, onCommandSent }: AgentDetailSheetProps) {
  const [activeTab, setActiveTab] = useState<'status' | 'soul' | 'commands'>('status');
  const [soulMd, setSoulMd] = useState(agent?.soulMd ?? '');
  const [heartbeatInterval, setHeartbeatInterval] = useState(agent?.heartbeatInterval ?? 5);
  const [injectText, setInjectText] = useState('');
  const [commands, setCommands] = useState<Command[]>([]);
  const [savingSoul, setSavingSoul] = useState(false);
  const [savingHb, setSavingHb] = useState(false);
  const [sendingCmd, setSendingCmd] = useState<string | null>(null);

  const updateAgent = useAgentStore((s) => s.updateAgent);
  const toast = useToast();

  useEffect(() => {
    if (agent) {
      setSoulMd(agent.soulMd ?? '');
      setHeartbeatInterval(agent.heartbeatInterval ?? 5);
    }
  }, [agent]);

  const fetchCommands = useCallback(async () => {
    if (!agent) return;
    try {
      const cmds = await api.commands.list(agent.id);
      setCommands(cmds);
    } catch (err) {
      console.error('Failed to fetch commands:', err);
    }
  }, [agent]);

  useEffect(() => {
    if (agent && activeTab === 'commands') {
      fetchCommands();
    }
  }, [agent, activeTab, fetchCommands]);

  if (!agent) return null;

  const tone = agentStatusTone[agent.status] || 'neutral';

  const handleSaveSoul = async () => {
    setSavingSoul(true);
    try {
      await api.agents.updateConfig(agent.id, { soulMd });
      updateAgent({ id: agent.id, soulMd });
      toast.success('SOUL.md updated', `Personality and directives saved for ${agent.displayName}`);
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
      toast.success('Heartbeat updated', `Telemetry frequency set to ${heartbeatInterval} min`);
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
      onCommandSent?.();
      fetchCommands();
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
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs animate-fade-in p-0 sm:p-4">
      {/* Backdrop */}
      <div className="fixed inset-0" onClick={onClose} aria-hidden="true" />

      {/* Sheet Container */}
      <div className="relative z-10 w-full max-w-xl rounded-t-3xl sm:rounded-3xl border border-line bg-surface p-5 sm:p-6 shadow-2xl animate-slide-up max-h-[90vh] overflow-y-auto no-scrollbar flex flex-col justify-between">
        {/* Mobile drag handle */}
        <div className="w-12 h-1.5 rounded-full bg-line-strong mx-auto mb-4 sm:hidden" />

        {/* Header */}
        <div>
          <div className="flex items-start justify-between gap-3 border-b border-line-subtle pb-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-2xl bg-brand-500/10 border border-brand-500/20 text-brand-600 dark:text-brand-400 flex items-center justify-center text-lg shrink-0">
                {agent.avatar ? agent.avatar : '🤖'}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm sm:text-base font-bold text-ink truncate">
                    {agent.displayName}
                  </h3>
                  <Badge tone={tone} dot pulse={agent.status === 'ONLINE'}>
                    {agent.status.toLowerCase()}
                  </Badge>
                </div>
                <p className="text-2xs font-mono text-ink-muted truncate mt-0.5">
                  {agent.processRole || 'Autonomous Agent'} · ID: {agent.id.slice(0, 8)}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-inset hover:bg-hover flex items-center justify-center text-ink-muted hover:text-ink transition-colors cursor-pointer shrink-0"
              aria-label="Close details"
            >
              <X size={16} />
            </button>
          </div>

          {/* Tab Navigation */}
          <div className="flex items-center gap-2 border-b border-line-subtle my-3">
            {[
              { id: 'status', label: 'Status & Controls', icon: SlidersHorizontal },
              { id: 'soul', label: 'SOUL.md Directive', icon: Sparkles },
              { id: 'commands', label: 'Command Audit', icon: History },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as any)}
                className={cn(
                  'pb-2.5 text-xs font-bold tracking-tight border-b-2 transition-all cursor-pointer flex items-center gap-1.5',
                  activeTab === tab.id
                    ? 'border-brand-500 text-brand-600 dark:text-brand-400'
                    : 'border-transparent text-ink-muted hover:text-ink'
                )}
              >
                <tab.icon size={13} />
                <span>{tab.label}</span>
              </button>
            ))}
          </div>

          {/* TAB 1: Status & Quick Controls */}
          {activeTab === 'status' && (
            <div className="space-y-4 py-1">
              {/* Quick Actions Strip */}
              <div className="rounded-2xl bg-inset/60 border border-line-subtle p-3.5 space-y-3">
                <span className="text-2xs font-bold uppercase tracking-wider text-ink-muted block">
                  Quick Actions
                </span>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    loading={sendingCmd === 'PING'}
                    onClick={() => handleSendCommand('PING')}
                  >
                    Ping Agent
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    loading={sendingCmd === 'RELOAD'}
                    onClick={() => handleSendCommand('RELOAD')}
                  >
                    Reload Persona
                  </Button>
                  {agent.status === 'ONLINE' ? (
                    <Button
                      variant="secondary"
                      size="sm"
                      loading={sendingCmd === 'PAUSE'}
                      onClick={() => handleSendCommand('PAUSE')}
                    >
                      Pause
                    </Button>
                  ) : (
                    <Button
                      variant="primary"
                      size="sm"
                      loading={sendingCmd === 'RESUME'}
                      onClick={() => handleSendCommand('RESUME')}
                    >
                      Resume Online
                    </Button>
                  )}
                </div>
              </div>

              {/* Real-time Directive Injection */}
              <div className="rounded-2xl border border-line-subtle p-3.5 space-y-2">
                <span className="text-2xs font-bold uppercase tracking-wider text-ink-muted block">
                  Inject High-Priority Instruction
                </span>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={injectText}
                    onChange={(e) => setInjectText(e.target.value)}
                    placeholder="Inject directive or guidance..."
                    className="flex-1 rounded-xl border border-line bg-inset px-3 py-1.5 text-xs text-ink placeholder:text-ink-muted focus:outline-none focus:ring-1 focus:ring-brand-500"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleInject();
                    }}
                  />
                  <Button
                    variant="primary"
                    size="sm"
                    icon={Send}
                    loading={sendingCmd === 'INJECT'}
                    disabled={!injectText.trim()}
                    onClick={handleInject}
                  >
                    Send
                  </Button>
                </div>
              </div>

              {/* Telemetry Settings */}
              <div className="rounded-2xl border border-line-subtle p-3.5 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-2xs font-bold uppercase tracking-wider text-ink-muted block">
                      Heartbeat Telemetry
                    </span>
                    <p className="text-2xs text-ink-muted">Frequency: Every {heartbeatInterval} minutes</p>
                  </div>
                  <Button
                    variant="secondary"
                    size="xs"
                    loading={savingHb}
                    onClick={handleUpdateHeartbeat}
                  >
                    Save Interval
                  </Button>
                </div>
                <input
                  type="range"
                  min={1}
                  max={60}
                  value={heartbeatInterval}
                  onChange={(e) => setHeartbeatInterval(Number(e.target.value))}
                  className="w-full accent-brand-500 cursor-pointer"
                />
              </div>
            </div>
          )}

          {/* TAB 2: SOUL.md Personality Directive */}
          {activeTab === 'soul' && (
            <div className="space-y-3 py-1">
              <div className="flex items-center justify-between">
                <span className="text-2xs font-bold uppercase tracking-wider text-ink-muted">
                  System Directive Prompt
                </span>
                <Button
                  variant="primary"
                  size="xs"
                  icon={Save}
                  loading={savingSoul}
                  onClick={handleSaveSoul}
                >
                  Save SOUL.md
                </Button>
              </div>
              <textarea
                value={soulMd}
                onChange={(e) => setSoulMd(e.target.value)}
                rows={8}
                placeholder="# Personality Directive..."
                className="w-full rounded-2xl border border-line bg-inset p-3 font-mono text-xs text-ink placeholder:text-ink-muted leading-relaxed focus:outline-none focus:ring-1 focus:ring-brand-500 no-scrollbar"
              />
            </div>
          )}

          {/* TAB 3: Command Audit History */}
          {activeTab === 'commands' && (
            <div className="space-y-2 py-1 max-h-64 overflow-y-auto no-scrollbar">
              {commands.length === 0 ? (
                <div className="py-8 text-center text-xs text-ink-muted bg-inset/40 rounded-xl border border-line-subtle">
                  No commands dispatched yet.
                </div>
              ) : (
                commands.map((cmd) => (
                  <div
                    key={cmd.id}
                    className="p-2.5 rounded-xl bg-inset/60 border border-line-subtle flex items-center justify-between gap-2"
                  >
                    <div className="min-w-0">
                      <span className="text-xs font-mono font-bold text-ink block">{cmd.type}</span>
                      <span className="text-[10px] text-ink-faint font-mono">{timeAgo(cmd.createdAt)}</span>
                    </div>
                    <Badge
                      tone={cmd.status === 'COMPLETED' ? 'success' : cmd.status === 'PENDING' ? 'warning' : 'neutral'}
                      size="sm"
                    >
                      {cmd.status.toLowerCase()}
                    </Badge>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="mt-4 pt-3 border-t border-line-subtle flex items-center justify-between text-2xs font-mono text-ink-muted">
          <span>Last Heartbeat: {timeAgo(agent.lastHeartbeat)}</span>
          <span className="text-emerald-600 dark:text-emerald-400 font-semibold">Ready</span>
        </div>
      </div>
    </div>
  );
}
