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
  Globe,
  Zap,
  Check,
  Copy,
  Terminal,
  Clock,
} from 'lucide-react';
import { api } from '../lib/api';
import { getSocket } from '../lib/socket';
import { cn, timeAgo } from '../lib/utils';
import { agentStatusLabel, agentStatusTone } from '../lib/design';
import { useProcessStore } from '../stores/process-store';
import { Avatar } from '../components/ui/Avatar';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { LiveBrainIcon, LiveWaveform, LiveRadarBeacon } from '../components/ui/LiveIcon';
import { LottieAnimation } from '../components/ui/LottieAnimation';
import { HourglassLoader } from '../components/ui/HourglassLoader';
import type { Agent, ChatMessage, AgentStatus, Process } from '../types';

function FormattedMessage({ text }: { text: string }) {
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

  const copyCode = (code: string, idx: number) => {
    navigator.clipboard.writeText(code);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 2000);
  };

  // Check for code blocks ```
  const codeBlockRegex = /```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g;
  const parts: Array<{ type: 'text' | 'code'; lang?: string; content: string }> = [];
  let lastIndex = 0;
  let match;

  while ((match = codeBlockRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: 'text', content: text.slice(lastIndex, match.index) });
    }
    parts.push({ type: 'code', lang: match[1] || 'text', content: match[2].trimEnd() });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) {
    parts.push({ type: 'text', content: text.slice(lastIndex) });
  }

  return (
    <div className="space-y-2.5 leading-relaxed text-xs sm:text-[13px]">
      {parts.map((part, pIdx) => {
        if (part.type === 'code') {
          return (
            <div key={pIdx} className="my-2.5 rounded-xl border border-line bg-inset overflow-hidden shadow-2xs">
              <div className="flex items-center justify-between px-3.5 py-1.5 bg-raised border-b border-line text-[11px] font-mono text-ink-muted">
                <span className="flex items-center gap-1.5 font-bold uppercase tracking-wider text-brand-600 dark:text-brand-400">
                  <Terminal size={12} />
                  {part.lang || 'code'}
                </span>
                <button
                  type="button"
                  onClick={() => copyCode(part.content, pIdx)}
                  className="flex items-center gap-1 hover:text-ink transition-colors cursor-pointer"
                >
                  {copiedIdx === pIdx ? (
                    <>
                      <Check size={12} className="text-emerald-500" />
                      <span className="text-emerald-500 font-bold">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy size={12} />
                      <span>Copy</span>
                    </>
                  )}
                </button>
              </div>
              <pre className="p-3.5 overflow-x-auto font-mono text-xs text-ink leading-relaxed no-scrollbar">
                <code>{part.content}</code>
              </pre>
            </div>
          );
        }

        const lines = part.content.split('\n');
        return (
          <div key={pIdx} className="space-y-1.5">
            {lines.map((line, idx) => {
              const trimmed = line.trim();
              if (!trimmed) return <div key={idx} className="h-1" />;

              if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
                return (
                  <div key={idx} className="flex items-start gap-2 ml-1">
                    <span className="text-brand-500 font-bold">•</span>
                    <span>{renderInlineFormatting(trimmed.substring(2))}</span>
                  </div>
                );
              }

              return <p key={idx}>{renderInlineFormatting(line)}</p>;
            })}
          </div>
        );
      })}
    </div>
  );
}

function renderInlineFormatting(content: string) {
  const parts = content.split(/(\*\*.*?\*\*|`.*?`)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**') && part.length >= 4) {
      return (
        <strong key={i} className="font-bold text-ink">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith('`') && part.endsWith('`') && part.length >= 2) {
      return (
        <code key={i} className="rounded-md bg-inset px-1.5 py-0.5 font-mono text-[11px] font-bold text-brand-600 dark:text-brand-400 border border-line-subtle">
          {part.slice(1, -1)}
        </code>
      );
    }
    return part;
  });
}

export function Chat() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedTarget, setSelectedTarget] = useState<{ type: 'mother'; processId?: string } | { type: 'agent'; agentId: string }>({
    type: 'mother',
  });
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [mobileTab, setMobileTab] = useState<'chat' | 'agents'>('chat');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const { processes, fetchProcesses } = useProcessStore();
  const [selectedProcessId, setSelectedProcessId] = useState<string>('all');
  const [processDropdownOpen, setProcessDropdownOpen] = useState(false);
  const processDropdownRef = useRef<HTMLDivElement>(null);

  const activeProcess: Process | undefined = useMemo(() => {
    return processes.find((p) => p.id === selectedProcessId);
  }, [processes, selectedProcessId]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (processDropdownRef.current && !processDropdownRef.current.contains(e.target as Node)) {
        setProcessDropdownOpen(false);
      }
    }
    if (processDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [processDropdownOpen]);

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
  }, [messages, sending]);

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
                ? `👋 Hello Operator! I am **Mother Chat**, Central Supervisor for **"${activeProcess.name}"**.\n\nI have complete real-time telemetry over all assigned agents and generated code artifacts in this production block. Ask me anything about execution status, task review deltas, or codebase deliverables!`
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

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
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
    <div className="-m-3.5 sm:-m-6 flex h-[calc(100dvh-3.5rem)] overflow-hidden bg-canvas">
      {/* ── Left Sidebar: Mother Core & Production Selector ── */}
      <aside
        className={cn(
          'flex flex-col border-r border-line-subtle bg-surface shadow-sm md:w-80 md:shrink-0',
          mobileTab === 'agents' ? 'w-full flex-1' : 'hidden md:flex'
        )}
      >
        <div className="space-y-3.5 border-b border-line-subtle p-3.5 sm:p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="grid h-8 w-8 place-items-center rounded-xl bg-gradient-to-br from-brand-500 to-indigo-600 text-white shadow-xs">
                <LiveBrainIcon size={16} />
              </div>
              <div>
                <h2 className="text-xs font-bold text-ink uppercase tracking-wider">Mother Chat</h2>
                <p className="text-[10px] text-ink-muted">Supreme Fleet Core</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2 py-0.5 text-2xs font-bold text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 shadow-2xs">
                <LiveRadarBeacon size={6} tone="emerald" />
                Online
              </span>
              <button
                type="button"
                onClick={() => setMobileTab('chat')}
                className="md:hidden rounded-lg bg-brand-500/10 text-brand-600 px-2 py-1 text-2xs font-bold hover:bg-brand-500/20 transition-colors"
              >
                💬 Chat
              </button>
            </div>
          </div>

          {/* Glassmorphic Production Selector Dropdown */}
          <div className="space-y-1.5" ref={processDropdownRef}>
            <label className="block text-2xs font-bold uppercase tracking-wider text-ink-muted">
              Production Scope
            </label>
            <div className="relative">
              <button
                type="button"
                onClick={() => setProcessDropdownOpen(!processDropdownOpen)}
                className={cn(
                  'flex w-full items-center justify-between gap-2 rounded-xl border border-line bg-inset px-3 py-2 text-xs font-bold text-ink shadow-2xs transition-all hover:border-brand-500/50 hover:bg-hover active:scale-[0.99] cursor-pointer text-left',
                  processDropdownOpen && 'border-brand-500 ring-2 ring-brand-500/10'
                )}
              >
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  {selectedProcessId === 'all' ? (
                    <Globe size={14} className="shrink-0 text-brand-500" />
                  ) : (
                    <Zap size={14} className="shrink-0 text-amber-500" />
                  )}
                  <span className="truncate">
                    {selectedProcessId === 'all'
                      ? 'All Production Chains (Fleet View)'
                      : activeProcess?.name || 'Selected Production'}
                  </span>
                </div>
                <ChevronDown
                  size={14}
                  className={cn(
                    'shrink-0 text-ink-muted transition-transform duration-200',
                    processDropdownOpen && 'rotate-180 text-brand-500'
                  )}
                />
              </button>

              {/* Floating Glass Options Menu */}
              {processDropdownOpen && (
                <div className="absolute left-0 right-0 top-full z-50 mt-1.5 overflow-hidden rounded-2xl border border-line bg-surface/95 backdrop-blur-2xl p-1.5 shadow-2xl space-y-1 animate-scale-in">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedProcessId('all');
                      setSelectedTarget({ type: 'mother', processId: undefined });
                      setProcessDropdownOpen(false);
                    }}
                    className={cn(
                      'flex w-full items-center justify-between gap-2.5 rounded-xl px-2.5 py-2 text-xs font-semibold transition-colors cursor-pointer text-left',
                      selectedProcessId === 'all'
                        ? 'bg-brand-500/10 text-brand-600 dark:text-brand-400 font-bold'
                        : 'text-ink-muted hover:bg-hover hover:text-ink'
                    )}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Globe size={14} className="shrink-0 text-brand-500" />
                      <span className="truncate">All Production Chains (Fleet View)</span>
                    </div>
                    {selectedProcessId === 'all' && (
                      <Check size={13} className="shrink-0 text-brand-600 dark:text-brand-400" />
                    )}
                  </button>

                  {processes.map((p) => {
                    const isSelected = selectedProcessId === p.id;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => {
                          setSelectedProcessId(p.id);
                          setSelectedTarget({ type: 'mother', processId: p.id });
                          setProcessDropdownOpen(false);
                        }}
                        className={cn(
                          'flex w-full items-center justify-between gap-2.5 rounded-xl px-2.5 py-2 text-xs font-semibold transition-colors cursor-pointer text-left',
                          isSelected
                            ? 'bg-brand-500/10 text-brand-600 dark:text-brand-400 font-bold'
                            : 'text-ink-muted hover:bg-hover hover:text-ink'
                        )}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <Zap size={14} className="shrink-0 text-amber-500" />
                          <span className="truncate">{p.name}</span>
                        </div>
                        {isSelected && (
                          <Check size={13} className="shrink-0 text-brand-600 dark:text-brand-400" />
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Target Hierarchy List */}
        <div className="min-h-0 flex-1 overflow-y-auto p-3 space-y-2 no-scrollbar">
          {/* Primary Mother Chat Hub */}
          <button
            type="button"
            onClick={() => {
              setSelectedTarget({ type: 'mother', processId: selectedProcessId === 'all' ? undefined : selectedProcessId });
              setMobileTab('chat');
            }}
            className={cn(
              'relative flex w-full items-start gap-3 rounded-2xl p-3 text-left transition-all border cursor-pointer',
              selectedTarget.type === 'mother'
                ? 'bg-brand-500/10 border-brand-500/40 text-ink shadow-xs ring-1 ring-brand-500/20'
                : 'bg-surface border-line-subtle text-ink-muted hover:border-line hover:bg-raised'
            )}
          >
            <div className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-600 to-indigo-700 text-white shadow-xs shrink-0 overflow-hidden border border-brand-400/30">
              <LottieAnimation type="aiBrain" size={28} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between">
                <span className="truncate text-xs font-bold text-ink">Mother Core</span>
                <span className="px-1.5 py-0.2 text-[10px] font-bold uppercase rounded bg-brand-500/15 text-brand-600 dark:text-brand-400 border border-brand-500/20">Supervisor</span>
              </div>
              <p className="mt-1 text-2xs text-ink-muted line-clamp-1 leading-relaxed">
                {activeProcess ? `Direct supervisor for "${activeProcess.name}"` : 'Supreme Supervisor for all agents'}
              </p>
            </div>
          </button>

          {/* Supervised Sub-Agents Header */}
          <div className="pt-2 px-1 flex items-center justify-between text-2xs font-bold uppercase tracking-wider text-ink-muted">
            <span>Supervised Agents ({filteredAgents.length})</span>
            <span className="text-2xs font-medium lowercase text-brand-600 dark:text-brand-400">Telemetry link</span>
          </div>

          {/* Sub-Agents List */}
          {filteredAgents.map((agent) => {
            const isSelected = selectedTarget.type === 'agent' && selectedTarget.agentId === agent.id;
            return (
              <button
                key={agent.id}
                type="button"
                onClick={() => {
                  setSelectedTarget({ type: 'agent', agentId: agent.id });
                  setMobileTab('chat');
                }}
                className={cn(
                  'relative flex w-full items-center gap-2.5 rounded-xl p-2.5 text-left transition-all border cursor-pointer',
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
                    <span className="truncate text-xs font-bold text-ink">{agent.displayName}</span>
                    <span className="text-2xs font-mono font-bold text-ink-muted bg-inset px-1.5 py-0.2 rounded border border-line-subtle">
                      Stage {agent.processStage || 1}
                    </span>
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
          <span>Mother Chat coordinates multi-agent consensus and deliverables.</span>
        </div>
      </aside>

      {/* ── Right Chat Area: Mother Core Conversation & Live Telemetry ── */}
      <div
        className={cn(
          'flex min-w-0 flex-1 flex-col bg-canvas',
          mobileTab === 'chat' ? 'flex' : 'hidden md:flex'
        )}
      >
        {/* Conversation Header */}
        <header className="flex shrink-0 items-center justify-between border-b border-line-subtle bg-surface px-4 sm:px-6 py-3 shadow-xs">
          <div className="flex items-center gap-3 min-w-0">
            {selectedTarget.type === 'mother' ? (
              <div className="relative flex h-9 w-9 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-600 to-indigo-700 text-white shadow-sm overflow-hidden border border-brand-400/30">
                <LottieAnimation type="aiBrain" size={32} />
              </div>
            ) : (
              <Avatar
                name={selectedAgent?.displayName || 'Agent'}
                emoji={selectedAgent?.avatar}
                size="md"
                status={selectedAgent ? agentStatusTone[selectedAgent.status] : 'neutral'}
              />
            )}

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="truncate text-xs sm:text-sm font-bold text-ink">
                  {selectedTarget.type === 'mother' ? 'Mother Chat' : selectedAgent?.displayName}
                </h2>
                <Badge tone={selectedTarget.type === 'mother' ? 'accent' : 'brand'} size="sm">
                  {selectedTarget.type === 'mother' ? 'Supreme Core' : `Stage ${selectedAgent?.processStage || 1}`}
                </Badge>
              </div>
              <p className="truncate text-2xs text-ink-muted flex items-center gap-1 mt-0.5">
                <Cpu size={11} className="text-brand-500 shrink-0" />
                <span className="truncate">
                  {activeProcess
                    ? `Production: "${activeProcess.name}"`
                    : 'Global Fleet Workspace • Telemetry Active'}
                </span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <LiveWaveform color="bg-brand-500" />
            <button
              type="button"
              onClick={() => setMobileTab('agents')}
              className="md:hidden flex items-center gap-1.5 rounded-xl border border-line bg-surface px-3 py-1.5 text-xs font-bold text-ink shadow-2xs hover:bg-hover transition-colors shrink-0"
            >
              <Workflow size={13} className="text-brand-500" />
              <span>Agents ({filteredAgents.length})</span>
            </button>
          </div>
        </header>

        {/* Conversation Message Feed */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 no-scrollbar">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20">
              <HourglassLoader size={48} label="Syncing telemetry conversation..." />
            </div>
          ) : (
            messages.map((msg, index) => {
              const isUser = msg.role === 'user';
              return (
                <div
                  key={index}
                  className={cn(
                    'flex items-start gap-3 max-w-3xl animate-scale-in',
                    isUser ? 'ml-auto flex-row-reverse' : 'mr-auto'
                  )}
                >
                  <div
                    className={cn(
                      'grid h-8 w-8 shrink-0 place-items-center rounded-xl text-xs font-bold shadow-xs',
                      isUser
                        ? 'bg-brand-600 text-white'
                        : 'bg-gradient-to-br from-brand-600 to-indigo-700 text-white border border-brand-400/30'
                    )}
                  >
                    {isUser ? 'OP' : <Brain size={15} />}
                  </div>

                  <div
                    className={cn(
                      'rounded-2xl p-4 text-xs leading-relaxed shadow-sm border font-sans',
                      isUser
                        ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white border-blue-500/40 rounded-tr-xs shadow-md'
                        : 'bg-surface text-ink border-line rounded-tl-xs shadow-xs'
                    )}
                  >
                    <FormattedMessage text={msg.content} />
                    {msg.timestamp && (
                      <div
                        className={cn(
                          'mt-2 text-[10px] font-mono flex items-center justify-end gap-1 opacity-70',
                          isUser ? 'text-blue-100' : 'text-ink-muted'
                        )}
                      >
                        <Clock size={10} />
                        {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}

          {sending && (
            <div className="flex items-center gap-3 text-xs font-semibold text-ink-muted bg-surface/80 border border-line-subtle p-3 rounded-2xl max-w-md animate-pulse">
              <div className="w-6 h-6 rounded-lg bg-brand-500/10 text-brand-600 flex items-center justify-center">
                <Brain size={14} className="animate-spin" />
              </div>
              <span>Mother Chat is inspecting agent telemetry and deliverables…</span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Quick Question Suggestions */}
        {selectedTarget.type === 'mother' && (
          <div className="px-4 sm:px-6 py-2 border-t border-line-subtle bg-surface/40 flex items-center gap-2 overflow-x-auto no-scrollbar">
            <span className="text-2xs font-bold uppercase tracking-wider text-ink-muted shrink-0 flex items-center gap-1">
              <Sparkles size={11} className="text-brand-500" />
              Quick:
            </span>
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
                className="shrink-0 rounded-full border border-line bg-surface px-3 py-1 text-2xs font-semibold text-ink-muted hover:border-brand-500/50 hover:text-brand-600 dark:hover:text-brand-400 hover:bg-hover transition-all shadow-2xs whitespace-nowrap cursor-pointer active:scale-[0.98]"
              >
                {q}
              </button>
            ))}
          </div>
        )}

        {/* Modern Prompt Composer Bar */}
        <div className="border-t border-line-subtle bg-surface p-3.5 sm:p-4">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="flex items-center gap-2 bg-inset rounded-2xl p-1.5 border border-line focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-500/20 transition-all shadow-inner"
          >
            <textarea
              ref={inputRef}
              rows={1}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                selectedTarget.type === 'mother'
                  ? 'Ask Mother Chat anything about agents, processes, or deliverables...'
                  : `Message ${selectedAgent?.displayName || 'agent'}...`
              }
              className="w-full bg-transparent px-3 py-2 text-xs sm:text-[13px] text-ink placeholder:text-ink-muted resize-none border-0 outline-none ring-0 focus:outline-none focus:ring-0 focus:border-0 leading-relaxed max-h-24 overflow-y-auto no-scrollbar"
            />
            <Button
              type="submit"
              variant="primary"
              className="h-9 px-3.5 rounded-xl shrink-0 shadow-xs cursor-pointer"
              icon={SendHorizontal}
              loading={sending}
              disabled={!input.trim()}
            >
              Send
            </Button>
          </form>

          <div className="mt-2 hidden sm:flex items-center justify-between text-2xs text-ink-muted px-1">
            <span>Press <kbd className="font-mono rounded bg-inset border border-line px-1 py-0.5 text-[10px]">Enter</kbd> to send, <kbd className="font-mono rounded bg-inset border border-line px-1 py-0.5 text-[10px]">Shift+Enter</kbd> for newline</span>
            <span className="font-semibold text-brand-600 dark:text-brand-400">Mother Core Live Intelligence</span>
          </div>
        </div>
      </div>
    </div>
  );
}

