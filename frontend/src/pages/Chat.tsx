import { useState, useEffect, useMemo, useRef } from 'react';
import {
  Brain,
  Bot,
  SendHorizontal,
  Workflow,
  Sparkles,
  Layers,
  FileCode,
  ShieldCheck,
  Server,
  Activity,
  ChevronDown,
  Info,
  CheckCircle2,
  Cpu,
  CornerDownLeft,
} from 'lucide-react';
import { api } from '../lib/api';
import { getSocket } from '../lib/socket';
import { cn, timeAgo } from '../lib/utils';
import { agentStatusLabel, agentStatusTone } from '../lib/design';
import { useProcessStore } from '../stores/process-store';
import { Avatar } from '../components/ui/Avatar';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Spinner } from '../components/ui/States';
import type { Agent, ChatMessage, AgentStatus, Process } from '../types';

export function Chat() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedTarget, setSelectedTarget] = useState<{ type: 'mother'; processId?: string } | { type: 'agent'; agentId: string }>({
    type: 'mother',
  });
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { processes, fetchProcesses } = useProcessStore();
  const [selectedProcessId, setSelectedProcessId] = useState<string>('all');

  const activeProcess: Process | undefined = useMemo(() => {
    return processes.find((p) => p.id === selectedProcessId);
  }, [processes, selectedProcessId]);

  useEffect(() => {
    fetchProcesses();
    api.agents
      .list()
      .then((data) => {
        setAgents(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));

    const socket = getSocket();
    const handleUpdated = (data: { id: string; status?: string }) => {
      if (data.id && data.status) {
        const next = data.status as AgentStatus;
        setAgents((prev) => prev.map((a) => (a.id === data.id ? { ...a, status: next } : a)));
      }
    };
    socket.on('agent:updated', handleUpdated);
    socket.on('agent:status', handleUpdated);
    return () => {
      socket.off('agent:updated', handleUpdated);
      socket.off('agent:status', handleUpdated);
    };
  }, [fetchProcesses]);

  useEffect(() => {
    loadCurrentHistory();
  }, [selectedTarget, selectedProcessId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function loadCurrentHistory() {
    setLoading(true);
    try {
      if (selectedTarget.type === 'mother') {
        const pId = selectedProcessId === 'all' ? undefined : selectedProcessId;
        const data = await api.chat.motherHistory(pId);
        if (data.messages && data.messages.length > 0) {
          setMessages(data.messages);
        } else {
          setMessages([
            {
              role: 'assistant',
              content: activeProcess
                ? `👋 Hello Operator! I am **Mother Chat**, Central Supervisor for **"${activeProcess.name}"**.\n\nI have complete real-time telemetry over all assigned agents and generated code artifacts in this production block. Ask me anything about what happened, task execution progress, or code review deliverables!`
                : `👋 Greetings Operator! I am **Mother Chat** (Primary Fleet Supervisor).\n\nI oversee all active production pipelines and autonomous agents across your workspace. Select a production block above or ask me about fleet status, code reviews, or deliverables!`,
              timestamp: new Date().toISOString(),
            },
          ]);
        }
      } else {
        const data = await api.chat.history(selectedTarget.agentId);
        setMessages(data.messages || []);
      }
    } catch {
      setMessages([]);
    } finally {
      setLoading(false);
    }
  }

  async function handleSend(textToSend?: string) {
    const text = textToSend || input.trim();
    if (!text || sending) return;

    const userMessage: ChatMessage = {
      role: 'user',
      content: text,
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMessage]);
    if (!textToSend) setInput('');
    setSending(true);

    try {
      if (selectedTarget.type === 'mother') {
        const pId = selectedProcessId === 'all' ? undefined : selectedProcessId;
        const response = await api.chat.sendToMother(text, pId);
        const assistantMessage: ChatMessage = {
          role: 'assistant',
          content: response.result || 'Mother Core acknowledged request.',
          timestamp: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, assistantMessage]);
      } else {
        const response = await api.chat.send(selectedTarget.agentId, text);
        const assistantMessage: ChatMessage = {
          role: 'assistant',
          content: response.result || response.summary || 'No response',
          timestamp: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, assistantMessage]);
      }
    } catch (err) {
      const errorMessage: ChatMessage = {
        role: 'assistant',
        content: `Error: ${(err as Error).message}`,
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setSending(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  const filteredAgents = useMemo(() => {
    if (selectedProcessId === 'all') return agents;
    return agents.filter((a) => a.processId === selectedProcessId);
  }, [agents, selectedProcessId]);

  const selectedAgent = selectedTarget.type === 'agent' ? agents.find((a) => a.id === selectedTarget.agentId) : null;

  return (
    <div className="-m-6 flex h-[calc(100dvh-3.5rem)] overflow-hidden bg-canvas">
      {/* ── Left Sidebar: Mother Core & Production Selector ── */}
      <aside className="flex w-80 shrink-0 flex-col border-r border-line-subtle bg-surface shadow-sm">
        <div className="space-y-3.5 border-b border-line-subtle p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="grid h-7 w-7 place-items-center rounded-lg bg-gradient-to-br from-brand-500 to-indigo-600 text-white shadow-xs">
                <Brain size={15} />
              </div>
              <h2 className="text-sm font-semibold text-ink">Mother Chat</h2>
            </div>
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-2xs font-semibold text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Online
            </span>
          </div>

          {/* Production Selector Dropdown */}
          <div className="space-y-1.5">
            <label className="block text-2xs font-semibold uppercase tracking-wider text-ink-muted">
              Production Context
            </label>
            <div className="relative">
              <select
                value={selectedProcessId}
                onChange={(e) => {
                  setSelectedProcessId(e.target.value);
                  setSelectedTarget({ type: 'mother', processId: e.target.value === 'all' ? undefined : e.target.value });
                }}
                className="w-full appearance-none rounded-lg border border-line bg-inset py-2 pl-3 pr-8 text-xs font-medium text-ink focus:outline-none focus:ring-1 focus:ring-brand-500 cursor-pointer"
              >
                <option value="all">🌐 All Production Chains (Fleet View)</option>
                {processes.map((p) => (
                  <option key={p.id} value={p.id}>
                    ⚡ {p.name}
                  </option>
                ))}
              </select>
              <ChevronDown
                size={14}
                className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-muted"
              />
            </div>
          </div>
        </div>

        {/* Target Hierarchy List */}
        <div className="min-h-0 flex-1 overflow-y-auto p-3 space-y-2">
          {/* Primary Mother Chat Hub */}
          <button
            type="button"
            onClick={() => setSelectedTarget({ type: 'mother', processId: selectedProcessId === 'all' ? undefined : selectedProcessId })}
            className={cn(
              'relative flex w-full items-start gap-3 rounded-xl p-3 text-left transition-all border',
              selectedTarget.type === 'mother'
                ? 'bg-brand-500/10 border-brand-500/40 text-ink shadow-xs ring-1 ring-brand-500/20'
                : 'bg-surface border-line-subtle text-ink-muted hover:border-line hover:bg-raised'
            )}
          >
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-brand-600 to-indigo-700 text-white shadow-xs shrink-0">
              <Brain size={18} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between">
                <span className="truncate text-xs font-semibold text-ink">Mother Core</span>
                <Badge tone="accent" size="sm">Primary AI</Badge>
              </div>
              <p className="mt-1 text-2xs text-ink-muted line-clamp-1 leading-relaxed">
                {activeProcess ? `Direct supervisor for "${activeProcess.name}"` : 'Supreme Supervisor for all agents'}
              </p>
            </div>
          </button>

          {/* Supervised Sub-Agents Header */}
          <div className="pt-2 px-1 flex items-center justify-between text-2xs font-semibold uppercase tracking-wider text-ink-faint">
            <span>Supervised Agents ({filteredAgents.length})</span>
            <span className="text-2xs font-normal lowercase text-brand-600 dark:text-brand-400">One-way link</span>
          </div>

          {/* Sub-Agents List */}
          {filteredAgents.map((agent) => {
            const isSelected = selectedTarget.type === 'agent' && selectedTarget.agentId === agent.id;
            return (
              <button
                key={agent.id}
                type="button"
                onClick={() => setSelectedTarget({ type: 'agent', agentId: agent.id })}
                className={cn(
                  'relative flex w-full items-center gap-2.5 rounded-lg p-2.5 text-left transition-all border',
                  isSelected
                    ? 'bg-inset border-brand-500 text-ink shadow-xs ring-1 ring-brand-500/30'
                    : 'bg-surface border-line-subtle text-ink-muted hover:border-line hover:bg-raised'
                )}
              >
                <Avatar
                  name={agent.displayName}
                  emoji={agent.avatar}
                  size="sm"
                  status={agentStatusTone[agent.status]}
                  statusLabel={agentStatusLabel[agent.status]}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between">
                    <span className="truncate text-xs font-medium text-ink">{agent.displayName}</span>
                    <span className="text-2xs text-ink-faint font-medium">Stage {agent.processStage || 1}</span>
                  </div>
                  <p className="text-2xs text-ink-muted truncate mt-0.5">{agent.processRole || agent.name}</p>
                </div>
              </button>
            );
          })}
        </div>

        {/* Network Protocol Info */}
        <div className="border-t border-line-subtle p-3 bg-inset/50 text-2xs text-ink-muted flex items-center gap-2">
          <Info size={13} className="shrink-0 text-brand-500" />
          <span>Mother Chat coordinates network graph with one-way command protocol.</span>
        </div>
      </aside>

      {/* ── Right Chat Area: Mother Core Conversation & Live Telemetry ── */}
      <div className="flex min-w-0 flex-1 flex-col bg-canvas">
        {/* Conversation Header */}
        <header className="flex shrink-0 items-center justify-between border-b border-line-subtle bg-surface px-6 py-3.5 shadow-xs">
          <div className="flex items-center gap-3.5">
            {selectedTarget.type === 'mother' ? (
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-brand-600 to-indigo-700 text-white shadow-sm">
                <Brain size={20} />
              </div>
            ) : (
              <Avatar
                name={selectedAgent?.displayName || 'Agent'}
                emoji={selectedAgent?.avatar}
                size="md"
                status={selectedAgent ? agentStatusTone[selectedAgent.status] : 'neutral'}
              />
            )}

            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold text-ink">
                  {selectedTarget.type === 'mother' ? 'Mother Chat (Primary Core)' : selectedAgent?.displayName}
                </h2>
                <Badge tone={selectedTarget.type === 'mother' ? 'accent' : 'brand'} size="sm">
                  {selectedTarget.type === 'mother' ? 'Orchestrator' : `Stage ${selectedAgent?.processStage || 1}`}
                </Badge>
              </div>
              <p className="text-2xs text-ink-muted flex items-center gap-1.5 mt-0.5">
                <Cpu size={12} className="text-brand-500" />
                <span>
                  {activeProcess
                    ? `Scoped to "${activeProcess.name}" • Connected to LLM Engine`
                    : 'Global Fleet Scope • Live Telemetry'}
                </span>
              </p>
            </div>
          </div>
        </header>

        {/* Conversation Message Feed */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {loading ? (
            <div className="flex justify-center py-16">
              <Spinner size={24} />
            </div>
          ) : (
            messages.map((msg, index) => {
              const isUser = msg.role === 'user';
              return (
                <div
                  key={index}
                  className={cn('flex items-start gap-3 max-w-3xl', isUser ? 'ml-auto flex-row-reverse' : 'mr-auto')}
                >
                  <div
                    className={cn(
                      'grid h-8 w-8 shrink-0 place-items-center rounded-xl text-xs font-bold shadow-xs',
                      isUser ? 'bg-brand-600 text-white' : 'bg-gradient-to-br from-brand-600 to-indigo-700 text-white'
                    )}
                  >
                    {isUser ? 'OP' : <Brain size={15} />}
                  </div>

                  <div
                    className={cn(
                      'rounded-2xl px-4 py-3 text-xs leading-relaxed shadow-sm border font-sans',
                      isUser
                        ? 'bg-brand-600 text-white border-brand-500/40 rounded-tr-none'
                        : 'bg-surface text-ink border-line-subtle rounded-tl-none whitespace-pre-wrap'
                    )}
                  >
                    {msg.content}
                  </div>
                </div>
              );
            })
          )}

          {sending && (
            <div className="flex items-center gap-2.5 text-xs font-medium text-ink-muted py-2">
              <Spinner size={16} />
              <span>Mother Chat is evaluating production state & workspace deliverables…</span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Quick Question Suggestions */}
        {selectedTarget.type === 'mother' && (
          <div className="px-6 py-2.5 border-t border-line-subtle bg-surface/60 flex flex-wrap items-center gap-2">
            <span className="text-2xs font-semibold uppercase tracking-wider text-ink-faint mr-1">Quick Ask:</span>
            {[
              'What has happened in this production block so far?',
              'Show me all files & code created by agents',
              'What was the code review audit score?',
              'Summarize the architectural plan & components',
            ].map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => handleSend(q)}
                className="rounded-lg border border-line-subtle bg-surface px-2.5 py-1 text-2xs font-medium text-ink-muted hover:border-brand-500 hover:text-ink transition-colors shadow-2xs"
              >
                {q}
              </button>
            ))}
          </div>
        )}

        {/* Input Composer Bar */}
        <div className="border-t border-line-subtle bg-surface p-4">
          <div className="flex items-center gap-2.5">
            <textarea
              rows={1}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                selectedTarget.type === 'mother'
                  ? 'Ask Mother Chat about what happened, task progress, generated files, or architecture…'
                  : `Message ${selectedAgent?.displayName || 'agent'}…`
              }
              className="flex-1 resize-none rounded-xl border border-line bg-inset px-4 py-2.5 text-xs text-ink placeholder:text-ink-faint shadow-inner focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 leading-relaxed"
            />
            <Button
              variant="primary"
              icon={SendHorizontal}
              loading={sending}
              onClick={() => handleSend()}
              disabled={!input.trim()}
            >
              Send
            </Button>
          </div>
          <div className="mt-1.5 flex items-center justify-between text-2xs text-ink-faint px-1">
            <span>Press <kbd className="font-mono rounded border border-line bg-inset px-1 py-0.5">Enter</kbd> to send, <kbd className="font-mono rounded border border-line bg-inset px-1 py-0.5">Shift+Enter</kbd> for newline</span>
            <span>Mother Chat Fleet Intelligence</span>
          </div>
        </div>
      </div>
    </div>
  );
}
