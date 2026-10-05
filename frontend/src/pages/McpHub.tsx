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
  Play,
  Terminal,
  Code2,
  XCircle,
  Copy,
  Clock,
  Zap,
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
          'w-full h-10 px-3.5 py-2 rounded-xl bg-inset border text-xs text-ink flex items-center justify-between shadow-2xs transition-all cursor-pointer outline-none focus:outline-none',
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
  const [loading, setLoading] = useState(true);
  const [refreshingId, setRefreshingId] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Add Standalone Server Form
  const [serverName, setServerName] = useState('');
  const [serverUrl, setServerUrl] = useState('');
  const [transport, setTransport] = useState<'SSE' | 'STREAMABLE_HTTP'>('SSE');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Interactive Tool Calling Modal State
  const [activeToolCall, setActiveToolCall] = useState<{
    serverId: string;
    serverName: string;
    tool: McpTool;
  } | null>(null);
  const [toolArgsText, setToolArgsText] = useState('{}');
  const [toolExecuting, setToolExecuting] = useState(false);
  const [toolResult, setToolResult] = useState<{
    success: boolean;
    result?: any;
    error?: string;
    durationMs?: number;
    executedAt?: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const mcpData = await api.mcp.orgList();
      setServers(mcpData);
    } catch (err) {
      console.error('Failed to load MCP servers:', err);
    } finally {
      setLoading(false);
    }
  }, []);

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
      await api.mcp.orgUpdate(server.id, { enabled: !server.enabled });
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
      await api.mcp.orgRemove(server.id);
      setServers((prev) => prev.filter((s) => s.id !== server.id));
    } catch (err) {
      console.error('Failed to delete MCP server:', err);
    }
  };

  const handleAddServer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!serverName.trim() || !serverUrl.trim()) return;

    setSubmitting(true);
    setFormError(null);
    try {
      await api.mcp.orgAdd({
        name: serverName.trim(),
        url: serverUrl.trim(),
        transport,
      });

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

  const handleOpenToolCall = (server: McpServerWithDetails, tool: McpTool) => {
    setActiveToolCall({
      serverId: server.id,
      serverName: server.name,
      tool,
    });
    setToolResult(null);
    // Prefill with schema defaults if available
    if (tool.inputSchema && typeof tool.inputSchema === 'object') {
      const properties = (tool.inputSchema as any).properties || {};
      const sample: Record<string, any> = {};
      for (const [key, val] of Object.entries<any>(properties)) {
        sample[key] = val.default !== undefined ? val.default : val.type === 'string' ? '' : val.type === 'number' ? 0 : val.type === 'boolean' ? false : null;
      }
      setToolArgsText(JSON.stringify(sample, null, 2));
    } else {
      setToolArgsText('{}');
    }
  };

  const handleExecuteTool = async () => {
    if (!activeToolCall) return;
    setToolExecuting(true);
    setToolResult(null);
    try {
      let parsedArgs = {};
      if (toolArgsText.trim()) {
        try {
          parsedArgs = JSON.parse(toolArgsText);
        } catch {
          setToolResult({
            success: false,
            error: 'Invalid JSON format in arguments payload. Please check syntax.',
          });
          setToolExecuting(false);
          return;
        }
      }
      const res = await api.mcp.callTool(activeToolCall.serverId, activeToolCall.tool.name, parsedArgs);
      setToolResult(res);
    } catch (err: any) {
      setToolResult({
        success: false,
        error: err.message || 'Direct tool execution failed.',
      });
    } finally {
      setToolExecuting(false);
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
      s.tools?.some((t) => t.name.toLowerCase().includes(q) || (t.description && t.description.toLowerCase().includes(q)))
    );
  });

  return (
    <div className="space-y-6">
      {/* ── Page Header ── */}
      <PageHeader
        icon={Cpu}
        title="MCP Hub & Tools"
        description="Standalone Model Context Protocol (MCP) server endpoints, live tool execution, and direct API capabilities"
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

      {/* ── 4 Compact Core Stat Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3.5">
        {/* Connected MCP Servers */}
        <div className="rounded-xl border border-line-subtle bg-surface p-3 sm:p-3.5 shadow-2xs hover:border-line-strong hover:shadow-xs transition-all relative overflow-hidden group">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-ink-muted truncate">Connected</span>
            <div className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center justify-center shrink-0">
              <Cpu size={14} />
            </div>
          </div>
          <div className="text-lg sm:text-xl font-bold text-ink tracking-tight font-mono">
            {connectedCount}
            <span className="text-[11px] font-normal text-ink-muted font-sans ml-1">/ {servers.length}</span>
          </div>
          <p className="text-[10px] text-ink-muted mt-0.5 font-medium truncate">Live endpoints</p>
        </div>

        {/* Discovered Tools */}
        <div className="rounded-xl border border-line-subtle bg-surface p-3 sm:p-3.5 shadow-2xs hover:border-line-strong hover:shadow-xs transition-all relative overflow-hidden group">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-ink-muted truncate">Tools</span>
            <div className="w-7 h-7 rounded-lg bg-brand-500/10 text-brand-600 dark:text-brand-400 border border-brand-500/20 flex items-center justify-center shrink-0">
              <Wrench size={14} />
            </div>
          </div>
          <div className="text-lg sm:text-xl font-bold text-ink tracking-tight font-mono">
            {totalToolsCount}
          </div>
          <p className="text-[10px] text-ink-muted mt-0.5 font-medium truncate">Callable functions</p>
        </div>

        {/* Standalone Endpoints */}
        <div className="rounded-xl border border-line-subtle bg-surface p-3 sm:p-3.5 shadow-2xs hover:border-line-strong hover:shadow-xs transition-all relative overflow-hidden group">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-ink-muted truncate">Endpoints</span>
            <div className="w-7 h-7 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 flex items-center justify-center shrink-0">
              <Zap size={14} />
            </div>
          </div>
          <div className="text-lg sm:text-xl font-bold text-ink tracking-tight font-mono">
            {servers.length}
          </div>
          <p className="text-[10px] text-ink-muted mt-0.5 font-medium truncate">Tool hosts</p>
        </div>

        {/* Transport Protocols */}
        <div className="rounded-xl border border-line-subtle bg-surface p-3 sm:p-3.5 shadow-2xs hover:border-line-strong hover:shadow-xs transition-all relative overflow-hidden group">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-ink-muted truncate">Transports</span>
            <div className="w-7 h-7 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 flex items-center justify-center shrink-0">
              <Server size={14} />
            </div>
          </div>
          <div className="flex items-center gap-1">
            <span className="px-2 py-0.5 rounded-md bg-brand-500/10 border border-brand-500/20 text-brand-600 dark:text-brand-400 text-[10px] font-mono font-bold">
              SSE
            </span>
            <span className="px-2 py-0.5 rounded-md bg-purple-500/10 border border-purple-500/20 text-purple-600 dark:text-purple-400 text-[10px] font-mono font-bold">
              STDIO
            </span>
          </div>
          <p className="text-[10px] text-ink-muted mt-0.5 font-medium truncate">Streaming & STDIO</p>
        </div>
      </div>

      {/* ── Search Bar ── */}
      <div className="flex items-center justify-between gap-3">
        <div className="relative w-full max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search standalone MCP servers or tools..."
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
          <h3 className="text-sm font-bold text-ink">No Standalone MCP Servers Connected</h3>
          <p className="text-xs text-ink-muted max-w-md mx-auto">
            Connect individual Model Context Protocol (MCP) server endpoints via Server-Sent Events (SSE) or stdio to make tools directly callable across your workspace.
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
                            <span>Callable</span>
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

                  {/* Standalone Server Metadata Bar */}
                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-inset border border-line-subtle text-xs">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="px-2 py-0.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-600 dark:text-indigo-400 text-[10px] font-bold flex items-center gap-1 shrink-0">
                        <Zap size={11} /> Standalone MCP Host
                      </span>
                      <span className="text-ink-muted text-2xs font-mono truncate">
                        {server.transport} • direct execution
                      </span>
                    </div>
                    <span className="text-2xs text-ink-muted font-medium shrink-0">
                      {server.lastConnected ? `Verified ${timeAgo(server.lastConnected)}` : 'Ready'}
                    </span>
                  </div>

                  {/* Discovered Tools & Direct Call Buttons */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-2xs font-bold uppercase tracking-wider text-ink-muted">
                      <span>Callable Tools ({server.tools?.length || 0})</span>
                      <button
                        type="button"
                        onClick={() => handleRefreshTools(server)}
                        disabled={isRefreshing}
                        className="text-brand-600 dark:text-brand-400 hover:underline flex items-center gap-1 cursor-pointer font-semibold"
                      >
                        <RefreshCw size={11} className={cn(isRefreshing && 'animate-spin')} />
                        {isRefreshing ? 'Discovering...' : 'Discover Tools'}
                      </button>
                    </div>

                    {server.tools && server.tools.length > 0 ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1 no-scrollbar">
                        {server.tools.map((tool) => (
                          <div
                            key={tool.id}
                            className="p-2.5 rounded-xl bg-inset/70 border border-line-subtle text-xs flex flex-col justify-between gap-2 hover:border-line hover:bg-inset transition-all group"
                          >
                            <div className="space-y-0.5 min-w-0">
                              <p className="font-mono font-bold text-ink truncate text-[11px] flex items-center gap-1">
                                <Code2 size={11} className="text-brand-500 shrink-0" />
                                {tool.name}
                              </p>
                              {tool.description && (
                                <p className="text-[10px] text-ink-muted line-clamp-2">
                                  {tool.description}
                                </p>
                              )}
                            </div>
                            <button
                              type="button"
                              onClick={() => handleOpenToolCall(server, tool)}
                              className="self-start px-2.5 py-1 rounded-lg bg-brand-500/10 hover:bg-brand-500/20 text-brand-600 dark:text-brand-400 border border-brand-500/25 text-[11px] font-bold flex items-center gap-1 cursor-pointer transition-all active:scale-95"
                            >
                              <Play size={10} className="fill-current" />
                              Call Tool
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-[11px] text-ink-faint py-3 text-center bg-inset/40 rounded-xl border border-dashed border-line">
                        No tools discovered yet. Click "Discover Tools" to query the server endpoint.
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

      {/* ── Connect Standalone MCP Server Modal ── */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fade-in" onClick={() => setShowAddModal(false)}>
          <div className="bg-surface border border-line rounded-3xl p-6 w-full max-w-md shadow-2xl space-y-4 animate-scale-in" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-line-subtle pb-3">
              <h2 className="text-sm font-bold uppercase tracking-wider text-ink flex items-center gap-2">
                <Cpu size={16} className="text-brand-500" />
                <span>Connect Individual MCP Server</span>
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
                <label className="block text-xs font-semibold text-ink-muted mb-1.5">Server Name *</label>
                <input
                  type="text"
                  required
                  value={serverName}
                  onChange={(e) => setServerName(e.target.value)}
                  placeholder="e.g. filesystem-tools, github-mcp, or postgres-mcp"
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
                  placeholder="http://host.docker.internal:8000/sse"
                  className="w-full h-10 px-3.5 bg-inset border border-line rounded-xl text-xs text-ink placeholder:text-ink-faint focus:border-brand-500 focus:outline-none shadow-2xs font-mono"
                />
                <p className="text-[11px] text-ink-muted mt-1.5 leading-relaxed">
                  💡 <strong>Local servers:</strong> Use <code className="font-mono text-brand-600 dark:text-brand-400 bg-brand-500/10 px-1 py-0.5 rounded">http://host.docker.internal:PORT/sse</code> to connect to servers running on your machine. For remote servers, use their HTTPS URL.
                </p>
              </div>

              <div>
                <CustomSelect
                  label="Transport Protocol"
                  value={transport}
                  onChange={(val) => setTransport(val as 'SSE' | 'STREAMABLE_HTTP')}
                  options={[
                    { value: 'SSE', label: 'SSE (Server-Sent Events)', sublabel: 'HTTP Streaming connection' },
                    { value: 'STREAMABLE_HTTP', label: 'Streamable HTTP', sublabel: 'HTTP streaming / JSON-RPC' },
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
                  disabled={!serverName.trim() || !serverUrl.trim()}
                >
                  Connect & Discover
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Interactive Tool Execution Modal ── */}
      {activeToolCall && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fade-in"
          onClick={() => setActiveToolCall(null)}
        >
          <div
            className="bg-surface border border-line rounded-3xl p-6 w-full max-w-lg shadow-2xl space-y-4 animate-scale-in max-h-[90vh] overflow-y-auto no-scrollbar"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-line-subtle pb-3">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-8 h-8 rounded-xl bg-brand-500/10 border border-brand-500/20 flex items-center justify-center text-brand-600 dark:text-brand-400 shrink-0">
                  <Play size={14} className="fill-current" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-sm font-bold text-ink font-mono truncate">
                    {activeToolCall.tool.name}
                  </h2>
                  <p className="text-[11px] text-ink-muted truncate">
                    From {activeToolCall.serverName}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveToolCall(null)}
                className="text-ink-muted hover:text-ink text-xs font-semibold cursor-pointer p-1"
              >
                ✕
              </button>
            </div>

            {activeToolCall.tool.description && (
              <p className="text-xs text-ink-muted leading-relaxed bg-inset/50 p-3 rounded-xl border border-line-subtle">
                {activeToolCall.tool.description}
              </p>
            )}

            {/* Input Arguments Editor */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-2xs font-bold uppercase tracking-wider text-ink-muted flex items-center gap-1.5">
                  <Terminal size={12} className="text-brand-500" />
                  Tool Arguments (JSON Payload)
                </label>
                <span className="text-[10px] text-ink-faint font-mono">application/json</span>
              </div>
              <textarea
                value={toolArgsText}
                onChange={(e) => setToolArgsText(e.target.value)}
                rows={5}
                placeholder="{}"
                className="w-full p-3 font-mono text-xs bg-inset border border-line rounded-xl text-ink focus:border-brand-500 focus:outline-none shadow-2xs leading-relaxed"
              />
            </div>

            {/* Live Result Output */}
            {toolResult && (
              <div className="space-y-2 animate-fade-in">
                <div className="flex items-center justify-between">
                  <span className="text-2xs font-bold uppercase tracking-wider text-ink-muted flex items-center gap-1.5">
                    {toolResult.success ? (
                      <CheckCircle2 size={13} className="text-emerald-500" />
                    ) : (
                      <XCircle size={13} className="text-rose-500" />
                    )}
                    Execution Result
                  </span>
                  {toolResult.durationMs !== undefined && (
                    <span className="text-[10px] font-mono text-ink-muted flex items-center gap-1">
                      <Clock size={10} /> {toolResult.durationMs}ms
                    </span>
                  )}
                </div>
                <div className="relative group">
                  <pre
                    className={cn(
                      'p-3 rounded-xl border font-mono text-[11px] max-h-52 overflow-y-auto no-scrollbar whitespace-pre-wrap break-words',
                      toolResult.success
                        ? 'bg-emerald-500/5 border-emerald-500/25 text-ink'
                        : 'bg-rose-500/5 border-rose-500/25 text-rose-600 dark:text-rose-400'
                    )}
                  >
                    {toolResult.success
                      ? JSON.stringify(toolResult.result, null, 2)
                      : toolResult.error || 'Execution failed.'}
                  </pre>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(
                        toolResult.success
                          ? JSON.stringify(toolResult.result, null, 2)
                          : toolResult.error || ''
                      );
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2000);
                    }}
                    className="absolute top-2 right-2 p-1.5 rounded-lg bg-surface/80 border border-line-subtle text-ink-muted hover:text-ink text-xs cursor-pointer shadow-2xs opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Copy Output"
                  >
                    {copied ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
                  </button>
                </div>
              </div>
            )}

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-line-subtle">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setActiveToolCall(null)}
              >
                Close
              </Button>
              <Button
                type="button"
                variant="primary"
                size="sm"
                icon={Play}
                loading={toolExecuting}
                onClick={handleExecuteTool}
              >
                Execute Call
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
