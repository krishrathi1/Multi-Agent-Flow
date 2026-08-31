import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Cpu,
  Server,
  Plus,
  RefreshCw,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  Shield,
  Layers,
  Search,
  Wrench,
  Bot,
  ChevronDown,
  Power,
  Sparkles,
  Check,
} from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Avatar } from '../components/ui/Avatar';
import { LiveRadarBeacon, LiveWaveform, LiveGearIcon } from '../components/ui/LiveIcon';
import { LottieAnimation } from '../components/ui/LottieAnimation';
import { HourglassLoader } from '../components/ui/HourglassLoader';
import { api } from '../lib/api';
import { cn, timeAgo } from '../lib/utils';
import type { McpServer, McpTool, Agent } from '../types';

function CustomSelect({
  label,
  value,
  onChange,
  options,
  placeholder = 'Select an option',
}: {
  label?: string;
  value: string;
  onChange: (val: string) => void;
  options: Array<{ value: string; label: string; sublabel?: string; avatar?: string }>;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const selected = options.find((o) => o.value === value);

  return (
    <div className="relative" ref={ref}>
      {label && <label className="block text-xs font-semibold text-ink-muted mb-1.5">{label}</label>}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={cn(
          'w-full h-10 px-3.5 py-2 rounded-xl bg-inset border text-xs text-ink flex items-center justify-between shadow-2xs transition-all cursor-pointer',
          open ? 'border-brand-500 ring-2 ring-brand-500/10' : 'border-line hover:border-line-strong'
        )}
      >
        <div className="flex items-center gap-2 truncate min-w-0">
          {selected?.avatar && (
            <span className="text-sm shrink-0">{selected.avatar}</span>
          )}
          <span className={cn('truncate', !selected && 'text-ink-faint')}>
            {selected ? selected.label : placeholder}
          </span>
          {selected?.sublabel && (
            <span className="text-[11px] text-ink-faint font-mono truncate hidden sm:inline">
              ({selected.sublabel})
            </span>
          )}
        </div>
        <ChevronDown size={14} className={cn('text-ink-muted shrink-0 ml-2 transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="absolute z-50 mt-1.5 left-0 w-full rounded-2xl bg-surface/95 backdrop-blur-2xl border border-line shadow-xl p-1.5 space-y-0.5 animate-scale-in max-h-60 overflow-y-auto no-scrollbar">
          {options.map((opt) => {
            const isOptSelected = opt.value === value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  onChange(opt.value);
                  setOpen(false);
                }}
                className={cn(
                  'w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs text-left transition-colors cursor-pointer',
                  isOptSelected
                    ? 'bg-brand-500/10 text-brand-600 dark:text-brand-400 font-bold'
                    : 'text-ink-muted hover:bg-hover hover:text-ink font-medium'
                )}
              >
                <div className="flex items-center gap-2 min-w-0 flex-1 truncate">
                  {opt.avatar && <span className="text-sm shrink-0">{opt.avatar}</span>}
                  <div className="truncate">
                    <span className="block truncate">{opt.label}</span>
                    {opt.sublabel && <p className="text-[10px] text-ink-faint font-mono">{opt.sublabel}</p>}
                  </div>
                </div>
                {isOptSelected && <Check size={13} className="text-brand-500 shrink-0 ml-2" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

interface McpServerWithDetails extends McpServer {
  tools?: McpTool[];
  agent?: {
    id: string;
    name: string;
    displayName: string;
    avatar?: string;
    status: string;
  };
}

export function McpHub() {
  const [servers, setServers] = useState<McpServerWithDetails[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshingId, setRefreshingId] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Add Server Form
  const [selectedAgentId, setSelectedAgentId] = useState('');
  const [serverName, setServerName] = useState('');
  const [serverUrl, setServerUrl] = useState('');
  const [transport, setTransport] = useState<'SSE' | 'STDIO'>('SSE');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      const [mcpData, agentsData] = await Promise.all([
        api.mcp.orgList(),
        api.agents.list(),
      ]);
      setServers(mcpData);
      setAgents(agentsData);
      if (agentsData.length > 0 && !selectedAgentId) {
        setSelectedAgentId(agentsData[0].id);
      }
    } catch (err) {
      console.error('Failed to load MCP servers:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedAgentId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRefreshTools = async (server: McpServerWithDetails) => {
    setRefreshingId(server.id);
    try {
      const tools = (await api.mcp.refreshTools(server.agentId, server.id)) as McpTool[];
      setServers((prev) =>
        prev.map((s) => (s.id === server.id ? { ...s, tools, lastConnected: new Date().toISOString() } : s))
      );
    } catch (err) {
      console.error('Failed to refresh MCP tools:', err);
    } finally {
      setRefreshingId(null);
    }
  };

  const handleToggleEnabled = async (server: McpServerWithDetails) => {
    try {
      const updated = await api.mcp.update(server.agentId, server.id, {
        enabled: !server.enabled,
      });
      setServers((prev) =>
        prev.map((s) => (s.id === server.id ? { ...s, enabled: !server.enabled } : s))
      );
    } catch (err) {
      console.error('Failed to toggle MCP server:', err);
    }
  };

  const handleDelete = async (server: McpServerWithDetails) => {
    if (!confirm(`Are you sure you want to delete MCP server "${server.name}"?`)) return;
    try {
      await api.mcp.remove(server.agentId, server.id);
      setServers((prev) => prev.filter((s) => s.id !== server.id));
    } catch (err) {
      console.error('Failed to delete MCP server:', err);
    }
  };

  const handleAddServer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAgentId || !serverName.trim() || !serverUrl.trim()) return;

    setSubmitting(true);
    setFormError(null);
    try {
      const created = await api.mcp.orgAdd({
        agentId: selectedAgentId,
        name: serverName.trim(),
        url: serverUrl.trim(),
        transport,
      });

      // Reload fresh state with agent details
      await loadData();
      setShowAddModal(false);
      setServerName('');
      setServerUrl('');
    } catch (err: any) {
      console.error('Failed to add MCP server:', err);
      setFormError(err?.message || 'Failed to connect MCP server. Please check URL and transport.');
    } finally {
      setSubmitting(false);
    }
  };

  const connectedCount = servers.filter((s) => s.enabled).length;
  const totalToolsCount = servers.reduce((acc, s) => acc + (s.tools?.length || 0), 0);

  const filteredServers = servers.filter((s) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      s.name.toLowerCase().includes(q) ||
      s.url.toLowerCase().includes(q) ||
      s.agent?.displayName.toLowerCase().includes(q) ||
      s.tools?.some((t) => t.name.toLowerCase().includes(q) || (t.description && t.description.toLowerCase().includes(q)))
    );
  });

  return (
    <div className="space-y-6">
      {/* ── Page Header ── */}
      <PageHeader
        icon={Cpu}
        title="MCP Hub & Tools"
        description="Manage Model Context Protocol (MCP) server endpoints, live tool discovery, and autonomous agent capabilities"
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              icon={RefreshCw}
              onClick={loadData}
              loading={loading}
            >
              Refresh
            </Button>
            <Button
              variant="primary"
              icon={Plus}
              onClick={() => setShowAddModal(true)}
            >
              Connect MCP Server
            </Button>
          </div>
        }
      />

      {/* ── Telemetry Deck: Responsive Horizontal Deck ── */}
      <div className="flex sm:grid sm:grid-cols-4 gap-2.5 sm:gap-3.5 overflow-x-auto no-scrollbar pb-1">
        {/* Connected Servers */}
        <div className="min-w-[140px] sm:min-w-0 flex-1 rounded-2xl border border-emerald-500/25 bg-emerald-500/5 p-3 sm:p-4 shadow-2xs hover:border-emerald-500/40 transition-all flex flex-col justify-between shrink-0">
          <div className="flex items-center justify-between gap-1.5 mb-1.5">
            <span className="text-[11px] sm:text-2xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300 whitespace-nowrap">
              Connected MCP
            </span>
            <LiveRadarBeacon size={8} tone="emerald" />
          </div>
          <p className="text-xl sm:text-2xl font-bold text-ink tabular-nums flex items-baseline gap-1 font-mono">
            {connectedCount}
            <span className="text-[11px] sm:text-xs font-normal text-ink-muted whitespace-nowrap">/ {servers.length} online</span>
          </p>
        </div>

        {/* Discovered Tools */}
        <div className="min-w-[140px] sm:min-w-0 flex-1 rounded-2xl border border-line-subtle bg-surface p-3 sm:p-4 shadow-2xs hover:border-line transition-all flex flex-col justify-between shrink-0">
          <div className="flex items-center justify-between gap-1.5 mb-1.5">
            <span className="text-[11px] sm:text-2xs font-bold uppercase tracking-wider text-ink-muted whitespace-nowrap">
              Discovered Tools
            </span>
            <Wrench size={13} className="text-brand-500 shrink-0" />
          </div>
          <p className="text-xl sm:text-2xl font-bold text-ink tabular-nums flex items-baseline gap-1 font-mono">
            {totalToolsCount}
            <span className="text-[11px] sm:text-xs font-normal text-ink-muted whitespace-nowrap">active tools</span>
          </p>
        </div>

        {/* Attached Agents */}
        <div className="min-w-[140px] sm:min-w-0 flex-1 rounded-2xl border border-line-subtle bg-surface p-3 sm:p-4 shadow-2xs hover:border-line transition-all flex flex-col justify-between shrink-0">
          <div className="flex items-center justify-between gap-1.5 mb-1.5">
            <span className="text-[11px] sm:text-2xs font-bold uppercase tracking-wider text-ink-muted whitespace-nowrap">
              Attached Agents
            </span>
            <Bot size={13} className="text-indigo-500 shrink-0" />
          </div>
          <p className="text-xl sm:text-2xl font-bold text-ink tabular-nums flex items-baseline gap-1 font-mono">
            {new Set(servers.map((s) => s.agentId)).size}
            <span className="text-[11px] sm:text-xs font-normal text-ink-muted whitespace-nowrap">agents linked</span>
          </p>
        </div>

        {/* Protocol Transports */}
        <div className="min-w-[140px] sm:min-w-0 flex-1 rounded-2xl border border-line-subtle bg-surface p-3 sm:p-4 shadow-2xs hover:border-line transition-all flex flex-col justify-between shrink-0">
          <div className="flex items-center justify-between gap-1.5 mb-1.5">
            <span className="text-[11px] sm:text-2xs font-bold uppercase tracking-wider text-ink-muted whitespace-nowrap">
              Transport Stack
            </span>
            <LiveWaveform color="bg-brand-500" />
          </div>
          <p className="text-xs sm:text-sm font-bold text-ink flex items-center gap-1.5 mt-0.5">
            <span className="px-2 py-0.5 rounded-md bg-brand-500/10 border border-brand-500/20 text-brand-600 dark:text-brand-400 text-[10px] font-mono font-bold">
              SSE
            </span>
            <span className="px-2 py-0.5 rounded-md bg-purple-500/10 border border-purple-500/20 text-purple-600 dark:text-purple-400 text-[10px] font-mono font-bold">
              STDIO
            </span>
          </p>
        </div>
      </div>

      {/* ── Search & Filter Bar ── */}
      <div className="flex items-center justify-between gap-3">
        <div className="relative w-full max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search MCP servers, endpoints, or tools..."
            className="w-full h-9.5 pl-8.5 pr-3 bg-surface border border-line rounded-xl text-xs text-ink placeholder:text-ink-faint shadow-2xs focus:border-brand-500 focus:outline-none"
          />
        </div>
      </div>

      {/* ── MCP Servers Grid ── */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <HourglassLoader size={48} label="Loading Model Context Protocol servers..." />
        </div>
      ) : filteredServers.length === 0 ? (
        <div className="rounded-2xl border border-line bg-surface p-12 text-center shadow-2xs space-y-3">
          <div className="relative mx-auto flex items-center justify-center">
            <div className="absolute inset-0 rounded-full bg-cyan-500/10 blur-xl scale-125" />
            <LottieAnimation type="quantumHub" size={68} />
          </div>
          <h3 className="text-sm font-bold text-ink">No MCP Servers Connected</h3>
          <p className="text-xs text-ink-muted max-w-md mx-auto">
            Connect Model Context Protocol (MCP) servers via Server-Sent Events (SSE) or stdio to equip your agents with live tools, databases, and custom API integrations.
          </p>
          <Button
            variant="primary"
            size="sm"
            icon={Plus}
            onClick={() => setShowAddModal(true)}
            className="mt-2"
          >
            Connect First MCP Server
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filteredServers.map((server) => {
            const isRefreshing = refreshingId === server.id;
            return (
              <div
                key={server.id}
                className={cn(
                  'flex flex-col justify-between rounded-2xl border bg-surface p-5 shadow-2xs transition-all',
                  server.enabled ? 'border-line hover:border-line-strong hover:shadow-xs' : 'border-line-subtle opacity-70'
                )}
              >
                <div className="space-y-4">
                  {/* Top Header Row */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <div className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-brand-600 to-indigo-600 text-white shadow-xs">
                          <Cpu size={14} />
                        </div>
                        <h3 className="text-sm font-bold text-ink truncate">{server.name}</h3>
                        <span className="px-2 py-0.5 rounded-full bg-brand-500/10 border border-brand-500/20 text-[10px] font-bold text-brand-600 dark:text-brand-400 uppercase tracking-wider shrink-0">
                          {server.transport}
                        </span>
                      </div>
                      <p className="mt-1 text-2xs text-ink-muted font-mono truncate pl-9">
                        {server.url}
                      </p>
                    </div>

                    {/* Live Status Pill */}
                    <div className="flex items-center gap-2 shrink-0">
                      <span
                        className={cn(
                          'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-2xs font-semibold border shadow-2xs',
                          server.enabled
                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/25'
                            : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/25'
                        )}
                      >
                        {server.enabled ? (
                          <>
                            <LiveRadarBeacon size={6} tone="emerald" />
                            <span>Connected</span>
                          </>
                        ) : (
                          <>
                            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                            <span>Disabled</span>
                          </>
                        )}
                      </span>
                    </div>
                  </div>

                  {/* Attached Agent Info */}
                  {server.agent && (
                    <div className="flex items-center justify-between p-2.5 rounded-xl bg-inset border border-line-subtle text-xs">
                      <div className="flex items-center gap-2 min-w-0">
                        <Avatar
                          name={server.agent.displayName}
                          emoji={server.agent.avatar}
                          size="xs"
                        />
                        <span className="text-ink font-semibold truncate text-xs">
                          {server.agent.displayName}
                        </span>
                        <span className="text-ink-faint text-2xs font-mono truncate">
                          ({server.agent.name})
                        </span>
                      </div>
                      <span className="text-2xs text-ink-muted font-medium shrink-0">
                        {server.lastConnected ? `Active ${timeAgo(server.lastConnected)}` : 'Ready'}
                      </span>
                    </div>
                  )}

                  {/* Discovered Tools Preview */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-2xs font-bold uppercase tracking-wider text-ink-muted">
                      <span>Discovered Tools ({server.tools?.length || 0})</span>
                      <button
                        type="button"
                        onClick={() => handleRefreshTools(server)}
                        disabled={isRefreshing}
                        className="text-brand-600 dark:text-brand-400 hover:underline flex items-center gap-1 cursor-pointer font-semibold"
                      >
                        <RefreshCw size={11} className={cn(isRefreshing && 'animate-spin')} />
                        {isRefreshing ? 'Discovering...' : 'Refresh Tools'}
                      </button>
                    </div>

                    {server.tools && server.tools.length > 0 ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-40 overflow-y-auto pr-1 no-scrollbar">
                        {server.tools.map((tool) => (
                          <div
                            key={tool.id}
                            className="p-2 rounded-xl bg-inset/70 border border-line-subtle text-xs space-y-0.5"
                          >
                            <p className="font-mono font-bold text-ink truncate text-[11px]">
                              {tool.name}
                            </p>
                            {tool.description && (
                              <p className="text-[10px] text-ink-muted line-clamp-1">
                                {tool.description}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-[11px] text-ink-faint py-3 text-center bg-inset/40 rounded-xl border border-dashed border-line">
                        No tools discovered yet. Click "Refresh Tools" to query the server endpoint.
                      </p>
                    )}
                  </div>
                </div>

                {/* Bottom Actions Row */}
                <div className="flex items-center justify-between gap-2 pt-4 mt-4 border-t border-line-subtle">
                  <button
                    type="button"
                    onClick={() => handleToggleEnabled(server)}
                    className={cn(
                      'px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer flex items-center gap-1.5',
                      server.enabled
                        ? 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/25 hover:bg-amber-500/20'
                        : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/25 hover:bg-emerald-500/20'
                    )}
                  >
                    <Power size={12} />
                    {server.enabled ? 'Disable' : 'Enable'}
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDelete(server)}
                    className="p-2 rounded-xl text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                    title="Delete MCP Server"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Connect MCP Server Modal ── */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fade-in" onClick={() => setShowAddModal(false)}>
          <div className="bg-surface border border-line rounded-3xl p-6 w-full max-w-md shadow-2xl space-y-4 animate-scale-in" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-line-subtle pb-3">
              <h2 className="text-sm font-bold uppercase tracking-wider text-ink flex items-center gap-2">
                <Cpu size={16} className="text-brand-500" />
                <span>Connect MCP Server</span>
              </h2>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="text-ink-muted hover:text-ink text-xs font-semibold cursor-pointer p-1"
              >
                ✕
              </button>
            </div>

            {formError && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/25 text-rose-600 dark:text-rose-400 text-xs font-medium">
                {formError}
              </div>
            )}

            <form onSubmit={handleAddServer} className="space-y-4">
              <div>
                <CustomSelect
                  label="Attach to Agent *"
                  value={selectedAgentId}
                  onChange={(val) => setSelectedAgentId(val)}
                  placeholder="Select target agent"
                  options={agents.map((ag) => ({
                    value: ag.id,
                    label: ag.displayName,
                    sublabel: ag.name,
                    avatar: ag.avatar || '🤖',
                  }))}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-ink-muted mb-1.5">Server Name *</label>
                <input
                  type="text"
                  required
                  value={serverName}
                  onChange={(e) => setServerName(e.target.value)}
                  placeholder="e.g. filesystem-tools or github-mcp"
                  className="w-full h-10 px-3.5 bg-inset border border-line rounded-xl text-xs text-ink placeholder:text-ink-faint focus:border-brand-500 focus:outline-none shadow-2xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-ink-muted mb-1.5">Server URL / SSE Endpoint *</label>
                <input
                  type="text"
                  required
                  value={serverUrl}
                  onChange={(e) => setServerUrl(e.target.value)}
                  placeholder="http://localhost:8000/sse"
                  className="w-full h-10 px-3.5 bg-inset border border-line rounded-xl text-xs text-ink placeholder:text-ink-faint focus:border-brand-500 focus:outline-none shadow-2xs font-mono"
                />
              </div>

              <div>
                <CustomSelect
                  label="Transport Protocol"
                  value={transport}
                  onChange={(val) => setTransport(val as 'SSE' | 'STDIO')}
                  options={[
                    { value: 'SSE', label: 'SSE (Server-Sent Events)', sublabel: 'HTTP Streaming connection' },
                    { value: 'STDIO', label: 'STDIO (Standard I/O)', sublabel: 'Direct process pipes' },
                  ]}
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-line-subtle">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowAddModal(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  loading={submitting}
                  disabled={!serverName.trim() || !serverUrl.trim() || !selectedAgentId}
                >
                  Connect & Discover
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
