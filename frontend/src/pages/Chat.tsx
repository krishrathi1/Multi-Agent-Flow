import { useState, useEffect, useMemo, useRef } from 'react';
import {
  Brain,
  Bot,
  SendHorizontal,
  Workflow,
  Sparkles,
  Layers,
  FileCode,
  Globe,
  Zap,
  Check,
  Copy,
  Clock,
  ThumbsUp,
  ThumbsDown,
  Share2,
  RotateCw,
  Cpu,
  ChevronDown,
  Info,
} from 'lucide-react';
import { api } from '@/lib/api';
import { getSocket } from '@/lib/socket';
import { cn, timeAgo } from '@/lib/utils';
import { useProcessStore } from '@/stores/process-store';
import { useAuthStore } from '@/stores/auth-store';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { LiveBrainIcon, LiveWaveform, LiveRadarBeacon } from '@/components/ui/LiveIcon';
import { HourglassLoader } from '@/components/ui/HourglassLoader';
import { MarkdownRenderer } from '@/components/ui/MarkdownRenderer';
import { CustomSelect } from '@/components/ui/CustomSelect';
import type { Agent, ChatMessage, AgentStatus, Process } from '@/types';

export function Chat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedProcessId, setSelectedProcessId] = useState<string>('all');
  const [selectedTarget, setSelectedTarget] = useState<{ type: 'mother' | 'agent'; agentId?: string; processId?: string }>({
    type: 'mother',
  });
  const [processDropdownOpen, setProcessDropdownOpen] = useState(false);
  const [mobileTab, setMobileTab] = useState<'chat' | 'agents'>('chat');
  const [copiedMsgIdx, setCopiedMsgIdx] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<Record<number, 'up' | 'down'>>({});
  const [chatModel, setChatModel] = useState(() => localStorage.getItem('nexus:mother_model') || '');
  const [availableModels, setAvailableModels] = useState<Array<{ id: string; name: string; provider: string; source?: string }>>([]);

  const modelOptions = useMemo(() => [
    { value: '', label: 'Auto / configured default' },
    ...availableModels.map((m) => ({
      value: m.id,
      label: `${m.provider} / ${m.name}`,
      badge: m.source === 'local' ? 'Local' : m.source === 'opencode' ? 'OpenCode' : undefined,
    })),
  ], [availableModels]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const processDropdownRef = useRef<HTMLDivElement>(null);

  const { processes, fetchProcesses } = useProcessStore();
  const user = useAuthStore((s) => s.user);

  const userName = user?.name ? user.name.split(' ')[0] : 'Engineer';
  const userInitials = user?.name ? user.name.slice(0, 2).toUpperCase() : 'ME';

  const activeProcess = useMemo(() => {
    if (selectedProcessId === 'all') return null;
    return processes.find((p) => p.id === selectedProcessId) || null;
  }, [processes, selectedProcessId]);

  useEffect(() => {
    fetchProcesses();
    api.llmProviders.availableModels().then((r) => setAvailableModels(r.models)).catch(() => {});
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
                ? `Hey ${userName}! 👋\n\nI am **Mother Chat**, overseeing **"${activeProcess.name}"**.\n\nWhat are we working on today?`
                : `Hey ${userName}! 👋\n\nWhat are we working on today?`,
              timestamp: new Date().toISOString(),
            },
          ]);
        }
      } else if (selectedTarget.agentId) {
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
        const response = await api.chat.sendToMother(text, pId, chatModel || undefined);
        const assistantMessage: ChatMessage = {
          role: 'assistant',
          content: response.result || 'Mother Core acknowledged request.',
          timestamp: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, assistantMessage]);
      } else if (selectedTarget.agentId) {
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
    <div className="flex flex-1 min-h-0 w-full h-full overflow-hidden bg-canvas">
      {/* ── Left Sidebar: Mother Core & Production Selector ── */}
      <aside
        className={cn(
          'flex flex-col border-r border-line-subtle bg-surface shadow-sm md:w-80 md:shrink-0 h-full min-h-0',
          mobileTab === 'agents' ? 'w-full flex-1' : 'hidden md:flex'
        )}
      >
        <div className="shrink-0 space-y-3.5 border-b border-line-subtle p-3.5 sm:p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div
                className="grid h-8 w-8 place-items-center rounded-xl text-white shadow-xs shrink-0"
                style={{ background: 'linear-gradient(135deg, #2563eb 0%, #4f46e5 100%)' }}
              >
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

          {/* Production Selector Dropdown */}
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
                      ? 'All Production Chains'
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

              {/* Options Menu */}
              {processDropdownOpen && (
                <div className="absolute left-0 right-0 top-full z-50 mt-1.5 overflow-hidden rounded-2xl border border-line bg-surface p-1.5 shadow-2xl space-y-1 animate-scale-in">
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
                      <span className="truncate">All Production Chains</span>
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
          {/* Mother Chat Card */}
          <button
            type="button"
            onClick={() => {
              setSelectedTarget({ type: 'mother', processId: activeProcess?.id });
              setMobileTab('chat');
            }}
            className={cn(
              'flex w-full items-center gap-3 rounded-2xl border p-2.5 sm:p-3 text-left transition-all cursor-pointer shadow-2xs',
              selectedTarget.type === 'mother'
                ? 'border-brand-500 bg-brand-500/10 text-brand-600 dark:text-brand-400 font-bold ring-1 ring-brand-500/20'
                : 'border-line-subtle bg-surface text-ink hover:border-line hover:bg-hover'
            )}
          >
            <div
              className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-white shadow-sm"
              style={{ background: 'linear-gradient(135deg, #2563eb 0%, #4f46e5 100%)' }}
            >
              <Brain size={18} className="text-white" />
            </div>
            <div className="min-w-0 flex-1">
              <span className="truncate text-xs font-bold block text-ink">Mother Core</span>
              <span className="text-[10px] text-ink-muted font-normal block truncate">
                Central Orchestration Bot
              </span>
            </div>
          </button>

          {/* Individual Agent Targets */}
          <div className="pt-2">
            <span className="text-2xs font-bold uppercase tracking-wider text-ink-muted px-2 block mb-1">
              Sub-Agents ({filteredAgents.length})
            </span>
            <div className="space-y-1">
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
                      'flex w-full items-center gap-2.5 rounded-xl border px-2.5 py-2 text-left transition-all cursor-pointer',
                      isSelected
                        ? 'border-brand-500 bg-brand-500/10 font-bold text-brand-600 dark:text-brand-400'
                        : 'border-transparent hover:bg-hover text-ink'
                    )}
                  >
                    <div className="w-7 h-7 rounded-lg bg-inset border border-line flex items-center justify-center text-xs shrink-0">
                      {agent.avatar || '🤖'}
                    </div>
                    <div className="min-w-0 flex-1">
                      <span className="truncate text-xs font-semibold block">{agent.displayName}</span>
                      <span className="text-[10px] text-ink-muted truncate block">
                        {agent.processRole || 'Autonomous Agent'}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </aside>

      {/* ── Main Chat Conversation View ── */}
      <main
        className={cn(
          'flex flex-1 min-h-0 flex-col overflow-hidden bg-canvas h-full',
          mobileTab === 'chat' ? 'flex' : 'hidden md:flex'
        )}
      >
        {/* Header */}
        <header className="flex min-h-14 shrink-0 flex-wrap items-center justify-between gap-2.5 border-b border-line-subtle bg-surface px-3.5 sm:px-6 py-2.5 shadow-2xs">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div
              className="grid h-8.5 w-8.5 sm:h-9 sm:w-9 shrink-0 place-items-center rounded-xl text-white shadow-sm"
              style={{ background: selectedTarget.type === 'mother' ? 'linear-gradient(135deg, #2563eb 0%, #4f46e5 100%)' : '#3b82f6' }}
            >
              {selectedTarget.type === 'mother' ? <Brain size={17} className="text-white" /> : <Bot size={17} className="text-white" />}
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <h2 className="truncate text-xs sm:text-sm font-bold text-ink">
                  {selectedTarget.type === 'mother' ? 'Mother Chat' : selectedAgent?.displayName}
                </h2>
                <Badge tone={selectedTarget.type === 'mother' ? 'accent' : 'brand'} size="sm">
                  {selectedTarget.type === 'mother' ? 'Supreme Core' : `Stage ${selectedAgent?.processStage || 1}`}
                </Badge>
              </div>
              <p className="truncate text-[11px] sm:text-2xs text-ink-muted flex items-center gap-1 mt-0.5">
                <Cpu size={11} className="text-brand-500 shrink-0" />
                <span className="truncate">
                  {activeProcess
                    ? `Scope: "${activeProcess.name}"`
                    : 'Global Fleet Workspace • Telemetry Active'}
                </span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end min-w-0">
            {selectedTarget.type === 'mother' && (
              <div className="flex items-center gap-1.5 flex-1 sm:flex-initial min-w-0">
                <span className="text-[10px] font-bold uppercase tracking-wider text-ink-muted shrink-0 hidden xs:inline">Model</span>
                <div className="w-full sm:w-[220px] min-w-0 flex-1">
                  <CustomSelect
                    value={chatModel}
                    onChange={(val) => {
                      setChatModel(val);
                      localStorage.setItem('nexus:mother_model', val);
                    }}
                    options={modelOptions}
                    size="sm"
                    placeholder="Auto / configured default"
                  />
                </div>
              </div>
            )}
            <div className="flex items-center gap-1.5 shrink-0">
              <LiveWaveform color="bg-brand-500" className="hidden sm:inline-flex" />
              <button
                type="button"
                onClick={() => setMobileTab('agents')}
                className="md:hidden flex items-center gap-1.5 rounded-xl border border-line bg-surface px-2.5 py-1.5 text-xs font-bold text-ink shadow-2xs hover:bg-hover transition-colors shrink-0 whitespace-nowrap active:scale-[0.98]"
              >
                <Workflow size={13} className="text-brand-500 shrink-0" />
                <span>Agents ({filteredAgents.length})</span>
              </button>
            </div>
          </div>
        </header>

        {/* Message Feed */}
        <div className="flex-1 min-h-0 overflow-y-auto p-3.5 sm:p-6 space-y-4 no-scrollbar">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20">
              <HourglassLoader size={48} label="Syncing telemetry conversation..." />
            </div>
          ) : (
            messages.map((msg, index) => {
              const isUser = msg.role === 'user';
              if (isUser) {
                return (
                  <div
                    key={index}
                    className="flex items-start gap-2.5 max-w-2xl ml-auto flex-row-reverse animate-scale-in"
                  >
                    <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-blue-600 text-white text-2xs font-bold shadow-xs uppercase">
                      {userInitials}
                    </div>

                    <div className="flex flex-col items-end max-w-[85%] sm:max-w-lg">
                      <div className="rounded-2xl rounded-br-xs px-4 py-2.5 bg-blue-600 text-white shadow-sm text-xs sm:text-[13px] font-medium leading-relaxed break-words">
                        <MarkdownRenderer content={msg.content} />
                      </div>
                      {msg.timestamp && (
                        <div className="mt-1 text-[10px] font-mono text-ink-muted flex items-center gap-1 opacity-70 px-1">
                          <Clock size={10} />
                          {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      )}
                    </div>
                  </div>
                );
              }

              return (
                <div
                  key={index}
                  className="group flex items-start gap-2.5 max-w-3xl mr-auto animate-scale-in"
                >
                  <div
                    className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-white text-xs font-bold shadow-xs"
                    style={{ background: selectedTarget.type === 'mother' ? 'linear-gradient(135deg, #2563eb 0%, #4f46e5 100%)' : '#3b82f6' }}
                  >
                    {selectedTarget.type === 'mother' ? <Brain size={15} className="text-white" /> : <Bot size={15} className="text-white" />}
                  </div>

                  <div className="flex flex-col items-start min-w-0 space-y-1 max-w-[90%] sm:max-w-2xl">
                    <div className="rounded-2xl sm:rounded-2xl sm:rounded-tl-xs p-3.5 sm:p-4 text-xs sm:text-[13px] leading-relaxed shadow-xs border border-line-subtle bg-surface text-ink font-sans w-full">
                      <MarkdownRenderer content={msg.content} />
                      {msg.timestamp && (
                        <div className="mt-2 text-[10px] font-mono text-ink-muted flex items-center gap-1 opacity-60">
                          <Clock size={10} />
                          {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      )}
                    </div>

                    {/* Action Bar */}
                    <div className="flex items-center gap-1 pt-0.5 px-1 text-ink-muted">
                      <button
                        type="button"
                        title="Copy message"
                        onClick={() => {
                          navigator.clipboard.writeText(msg.content);
                          setCopiedMsgIdx(index);
                          setTimeout(() => setCopiedMsgIdx(null), 1800);
                        }}
                        className="p-1 rounded-lg hover:bg-hover hover:text-ink transition-colors cursor-pointer"
                      >
                        {copiedMsgIdx === index ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
                      </button>

                      <button
                        type="button"
                        title="Thumbs up"
                        onClick={() => setFeedback((prev) => ({ ...prev, [index]: prev[index] === 'up' ? undefined! : 'up' }))}
                        className={cn(
                          'p-1 rounded-lg hover:bg-hover hover:text-ink transition-colors cursor-pointer',
                          feedback[index] === 'up' && 'text-brand-500 bg-brand-500/10 font-bold'
                        )}
                      >
                        <ThumbsUp size={13} />
                      </button>

                      <button
                        type="button"
                        title="Thumbs down"
                        onClick={() => setFeedback((prev) => ({ ...prev, [index]: prev[index] === 'down' ? undefined! : 'down' }))}
                        className={cn(
                          'p-1 rounded-lg hover:bg-hover hover:text-ink transition-colors cursor-pointer',
                          feedback[index] === 'down' && 'text-rose-500 bg-rose-500/10 font-bold'
                        )}
                      >
                        <ThumbsDown size={13} />
                      </button>

                      <button
                        type="button"
                        title="Regenerate"
                        onClick={() => {
                          const prevUserMsg = [...messages.slice(0, index)].reverse().find((m) => m.role === 'user');
                          if (prevUserMsg) handleSend(prevUserMsg.content);
                        }}
                        className="p-1 rounded-lg hover:bg-hover hover:text-ink transition-colors cursor-pointer"
                      >
                        <RotateCw size={13} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}

          {sending && (
            <div className="flex items-start gap-2.5 max-w-3xl mr-auto animate-scale-in">
              <div
                className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-white text-xs font-bold shadow-xs"
                style={{ background: selectedTarget.type === 'mother' ? 'linear-gradient(135deg, #2563eb 0%, #4f46e5 100%)' : '#3b82f6' }}
              >
                {selectedTarget.type === 'mother' ? <Brain size={15} className="text-white" /> : <Bot size={15} className="text-white" />}
              </div>

              <div className="rounded-2xl rounded-tl-xs px-4 py-3 shadow-xs border border-line-subtle bg-surface flex items-center gap-1.5 h-10">
                <span className="h-2 w-2 rounded-full bg-ink-muted/70 animate-bounce [animation-delay:-0.3s]" />
                <span className="h-2 w-2 rounded-full bg-ink-muted/70 animate-bounce [animation-delay:-0.15s]" />
                <span className="h-2 w-2 rounded-full bg-ink-muted/70 animate-bounce" />
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Quick Suggestion Chips */}
        {selectedTarget.type === 'mother' && (
          <div className="shrink-0 px-3.5 sm:px-6 py-2 border-t border-line-subtle bg-surface/40 flex items-center gap-2 overflow-x-auto no-scrollbar scroll-smooth">
            <span className="text-2xs font-bold uppercase tracking-wider text-ink-muted shrink-0 flex items-center gap-1">
              <Sparkles size={11} className="text-brand-500" />
              Quick:
            </span>
            {[
              'What has happened so far?',
              'Show created files & code',
              'What was the audit score?',
              'Summarize the plan & stages',
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

        {/* Chat Composer */}
        <div className="shrink-0 border-t border-line-subtle bg-surface p-3 sm:p-4 shadow-lg">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="flex items-end gap-2"
          >
            <div className="relative flex-1">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask Mother about agents, code, or runs..."
                rows={1}
                className="w-full resize-none rounded-2xl border border-line bg-inset px-3.5 py-2.5 text-xs sm:text-sm text-ink placeholder:text-ink-muted focus:outline-none focus:ring-1 focus:ring-brand-500 max-h-32 min-h-[46px] no-scrollbar leading-normal"
              />
            </div>

            <Button
              type="submit"
              variant="primary"
              size="md"
              icon={SendHorizontal}
              loading={sending}
              disabled={!input.trim() || sending}
              className="rounded-2xl h-[46px] px-4"
            >
              Send
            </Button>
          </form>
        </div>
      </main>
    </div>
  );
}
