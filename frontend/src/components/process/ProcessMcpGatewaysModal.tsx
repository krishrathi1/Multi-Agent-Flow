import { useState, useEffect, useCallback } from 'react';
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
  Wrench,
  ChevronDown,
  ChevronRight,
  Power,
  Sparkles,
  Check,
  Play,
  Terminal,
  Clock,
  Zap,
  Edit2,
  X,
} from 'lucide-react';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Modal } from '../ui/Modal';
import { HourglassLoader } from '../ui/HourglassLoader';
import { api } from '../../lib/api';
import { cn } from '../../lib/utils';
import type { Process, McpServer, McpTool, Gateway } from '../../types';

interface ProcessMcpGatewaysModalProps {
  process: Process;
  isOpen: boolean;
  onClose: () => void;
  onUpdated?: () => void;
}

export function ProcessMcpGatewaysModal({
  process: proc,
  isOpen,
  onClose,
  onUpdated,
}: ProcessMcpGatewaysModalProps) {
  const [activeTab, setActiveTab] = useState<'mcp' | 'gateways'>('mcp');

  // MCP State
  const [mcpServers, setMcpServers] = useState<any[]>([]);
  const [orgMcpServers, setOrgMcpServers] = useState<any[]>([]);
  const [loadingMcp, setLoadingMcp] = useState(true);
  const [refreshingServerId, setRefreshingServerId] = useState<string | null>(null);
  const [showAddMcp, setShowAddMcp] = useState(false);
  const [editingServer, setEditingServer] = useState<any | null>(null);

  // Add MCP Form
  const [mcpMode, setMcpMode] = useState<'new' | 'existing'>('new');
  const [newMcpName, setNewMcpName] = useState('');
  const [newMcpUrl, setNewMcpUrl] = useState('');
  const [newMcpTransport, setNewMcpTransport] = useState<'SSE' | 'STREAMABLE_HTTP'>('SSE');
  const [selectedExistingMcpId, setSelectedExistingMcpId] = useState('');
  const [submittingMcp, setSubmittingMcp] = useState(false);
  const [mcpError, setMcpError] = useState<string | null>(null);

  // Gateways State
  const [gateways, setGateways] = useState<any[]>([]);
  const [orgGateways, setOrgGateways] = useState<any[]>([]);
  const [loadingGateways, setLoadingGateways] = useState(true);
  const [checkingGwId, setCheckingGwId] = useState<string | null>(null);
  const [showAddGateway, setShowAddGateway] = useState(false);

  // Add Gateway Form
  const [gwMode, setGwMode] = useState<'new' | 'existing'>('new');
  const [newGwName, setNewGwName] = useState('');
  const [newGwUrl, setNewGwUrl] = useState('');
  const [newGwToken, setNewGwToken] = useState('');
  const [newGwRoot, setNewGwRoot] = useState('');
  const [selectedExistingGwId, setSelectedExistingGwId] = useState('');
  const [submittingGw, setSubmittingGw] = useState(false);
  const [gwError, setGwError] = useState<string | null>(null);

  const [toast, setToast] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);

  const showToast = (type: 'success' | 'error' | 'info', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  };

  const loadData = useCallback(async () => {
    if (!isOpen) return;
    setLoadingMcp(true);
    setLoadingGateways(true);
    try {
      const [pMcp, allMcp, pGw, allGw] = await Promise.all([
        api.processes.mcpServers(proc.id).catch(() => []),
        api.mcp.orgList().catch(() => []),
        api.processes.gateways(proc.id).catch(() => []),
        api.gateways.list().catch(() => []),
      ]);
      setMcpServers(Array.isArray(pMcp) ? pMcp : []);
      setOrgMcpServers(Array.isArray(allMcp) ? allMcp : []);
      setGateways(Array.isArray(pGw) ? pGw : []);
      setOrgGateways(Array.isArray(allGw) ? allGw : []);
    } catch (err) {
      console.error('Failed to load process MCP and Gateway telemetry:', err);
    } finally {
      setLoadingMcp(false);
      setLoadingGateways(false);
    }
  }, [proc.id, isOpen]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // MCP Handlers
  const handleAddMcpServer = async (e: React.FormEvent) => {
    e.preventDefault();
    setMcpError(null);
    setSubmittingMcp(true);
    try {
      if (mcpMode === 'existing') {
        if (!selectedExistingMcpId) {
          setMcpError('Please select an existing MCP server.');
          return;
        }
        await api.processes.addMcpServer(proc.id, {
          name: '',
          url: '',
          existingServerId: selectedExistingMcpId,
        });
        showToast('success', 'Connected existing MCP server to production.');
      } else {
        if (!newMcpName.trim() || !newMcpUrl.trim()) {
          setMcpError('Server name and endpoint URL are required.');
          return;
        }
        await api.processes.addMcpServer(proc.id, {
          name: newMcpName.trim(),
          url: newMcpUrl.trim(),
          transport: newMcpTransport,
        });
        showToast('success', `Created & connected MCP server "${newMcpName.trim()}" to production.`);
      }
      setNewMcpName('');
      setNewMcpUrl('');
      setSelectedExistingMcpId('');
      setShowAddMcp(false);
      await loadData();
      onUpdated?.();
    } catch (err: any) {
      setMcpError(err.message || 'Failed to connect MCP server');
    } finally {
      setSubmittingMcp(false);
    }
  };

  const handleRefreshMcpTools = async (server: any) => {
    setRefreshingServerId(server.id);
    try {
      const tools = await api.mcp.refresh(server.id);
      showToast('success', `Connected to "${server.name}"! Discovered ${tools?.length || 0} callable tools.`);
      await loadData();
    } catch (err: any) {
      showToast('error', `Failed to connect to "${server.name}": ${err.message}`);
    } finally {
      setRefreshingServerId(null);
    }
  };

  const handleUpdateMcpServer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingServer) return;
    try {
      await api.processes.updateMcpServer(proc.id, editingServer.id, {
        name: editingServer.name,
        url: editingServer.url,
        transport: editingServer.transport,
        enabled: editingServer.enabled,
      });
      showToast('success', `Updated MCP server "${editingServer.name}".`);
      setEditingServer(null);
      await loadData();
      onUpdated?.();
    } catch (err: any) {
      showToast('error', `Failed to update server: ${err.message}`);
    }
  };

  const handleDeleteMcpServer = async (serverId: string, name: string) => {
    if (!confirm(`Are you sure you want to disconnect MCP server "${name}" from this production?`)) return;
    try {
      await api.processes.deleteMcpServer(proc.id, serverId);
      showToast('info', `Disconnected MCP server "${name}".`);
      await loadData();
      onUpdated?.();
    } catch (err: any) {
      showToast('error', `Failed to disconnect server: ${err.message}`);
    }
  };

  // Gateway Handlers
  const handleAddGateway = async (e: React.FormEvent) => {
    e.preventDefault();
    setGwError(null);
    setSubmittingGw(true);
    try {
      if (gwMode === 'existing') {
        if (!selectedExistingGwId) {
          setGwError('Please select an existing Gateway.');
          return;
        }
        await api.processes.addGateway(proc.id, { gatewayId: selectedExistingGwId });
        showToast('success', 'Connected gateway to production agents.');
      } else {
        if (!newGwName.trim() || !newGwUrl.trim()) {
          setGwError('Gateway name and URL are required.');
          return;
        }
        await api.processes.addGateway(proc.id, {
          name: newGwName.trim(),
          url: newGwUrl.trim(),
          token: newGwToken.trim() || undefined,
          workspaceRoot: newGwRoot.trim() || undefined,
        });
        showToast('success', `Created & connected Gateway "${newGwName.trim()}" to production agents.`);
      }
      setNewGwName('');
      setNewGwUrl('');
      setNewGwToken('');
      setNewGwRoot('');
      setSelectedExistingGwId('');
      setShowAddGateway(false);
      await loadData();
      onUpdated?.();
    } catch (err: any) {
      setGwError(err.message || 'Failed to connect gateway');
    } finally {
      setSubmittingGw(false);
    }
  };

  const handleCheckGatewayHealth = async (gw: any) => {
    setCheckingGwId(gw.id);
    try {
      const res = await api.gateways.health(gw.id);
      showToast('success', `Gateway "${gw.name}" health: ${res.status || 'OK'}`);
      await loadData();
    } catch (err: any) {
      showToast('error', `Gateway health check failed: ${err.message}`);
    } finally {
      setCheckingGwId(null);
    }
  };

  const handleDeleteGateway = async (gwId: string, name: string) => {
    if (!confirm(`Are you sure you want to unlink Gateway "${name}" from this production?`)) return;
    try {
      await api.processes.deleteGateway(proc.id, gwId);
      showToast('info', `Unlinked Gateway "${name}".`);
      await loadData();
      onUpdated?.();
    } catch (err: any) {
      showToast('error', `Failed to unlink gateway: ${err.message}`);
    }
  };

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      title={`Production Tooling & Gateways: ${proc.name}`}
      size="xl"
    >
      <div className="space-y-4">
        {/* Toast Notification */}
        {toast && (
          <div
            className={cn(
              'px-3.5 py-2.5 rounded-xl text-xs font-semibold flex items-center justify-between shadow-sm animate-in fade-in',
              toast.type === 'success' && 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25',
              toast.type === 'error' && 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/25',
              toast.type === 'info' && 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/25'
            )}
          >
            <span>{toast.message}</span>
            <button type="button" onClick={() => setToast(null)} className="opacity-70 hover:opacity-100">
              <X size={14} />
            </button>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 border-b border-line pb-2">
          <button
            type="button"
            onClick={() => setActiveTab('mcp')}
            className={cn(
              'px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2',
              activeTab === 'mcp'
                ? 'bg-brand-500/10 text-brand-600 dark:text-brand-400 border border-brand-500/25 shadow-2xs'
                : 'text-ink-muted hover:text-ink'
            )}
          >
            <Cpu size={14} />
            MCP Servers ({mcpServers.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('gateways')}
            className={cn(
              'px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2',
              activeTab === 'gateways'
                ? 'bg-brand-500/10 text-brand-600 dark:text-brand-400 border border-brand-500/25 shadow-2xs'
                : 'text-ink-muted hover:text-ink'
            )}
          >
            <Server size={14} />
            Inference Gateways ({gateways.length})
          </button>
        </div>

        {/* ─── TAB 1: MCP SERVERS ────────────────────────────────────────── */}
        {activeTab === 'mcp' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-ink">
                  Connected Model Context Protocol (MCP) Servers
                </h4>
                <p className="text-[11px] text-ink-muted">
                  Connect any number of MCP tools (Filesystem, Postgres, APIs, GitHub) to this autonomous production.
                </p>
              </div>
              <Button
                variant="primary"
                size="xs"
                icon={Plus}
                onClick={() => {
                  setShowAddMcp(!showAddMcp);
                  setMcpError(null);
                }}
              >
                {showAddMcp ? 'Cancel' : 'Connect MCP'}
              </Button>
            </div>

            {/* Add / Connect MCP Form */}
            {showAddMcp && (
              <form onSubmit={handleAddMcpServer} className="rounded-2xl border border-brand-500/30 bg-inset/50 p-4 space-y-3 shadow-xs">
                <div className="flex items-center gap-3 border-b border-line-subtle pb-2">
                  <button
                    type="button"
                    onClick={() => setMcpMode('new')}
                    className={cn(
                      'text-xs font-bold pb-1 cursor-pointer transition-colors',
                      mcpMode === 'new' ? 'text-brand-600 dark:text-brand-400 border-b-2 border-brand-500' : 'text-ink-muted'
                    )}
                  >
                    New Custom MCP Server
                  </button>
                  <button
                    type="button"
                    onClick={() => setMcpMode('existing')}
                    className={cn(
                      'text-xs font-bold pb-1 cursor-pointer transition-colors',
                      mcpMode === 'existing' ? 'text-brand-600 dark:text-brand-400 border-b-2 border-brand-500' : 'text-ink-muted'
                    )}
                  >
                    Attach from MCP Library ({orgMcpServers.length})
                  </button>
                </div>

                {mcpError && (
                  <p className="text-2xs text-rose-600 dark:text-rose-400 font-semibold">{mcpError}</p>
                )}

                {mcpMode === 'existing' ? (
                  <div className="space-y-2">
                    <label className="text-2xs font-bold uppercase tracking-wider text-ink-muted">
                      Select Existing Workspace MCP Server
                    </label>
                    <select
                      value={selectedExistingMcpId}
                      onChange={(e) => setSelectedExistingMcpId(e.target.value)}
                      className="w-full h-9 rounded-xl bg-surface border border-line px-3 text-xs text-ink outline-none focus:border-brand-500 cursor-pointer"
                    >
                      <option value="">-- Choose an MCP Server --</option>
                      {orgMcpServers.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name} ({s.url}) — {s.tools?.length || 0} tools
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <label className="text-2xs font-bold uppercase tracking-wider text-ink-muted">Name</label>
                      <input
                        type="text"
                        placeholder="e.g. Postgres DB Server"
                        value={newMcpName}
                        onChange={(e) => setNewMcpName(e.target.value)}
                        className="w-full h-9 rounded-xl bg-surface border border-line px-3 text-xs text-ink outline-none focus:border-brand-500"
                      />
                    </div>
                    <div className="space-y-1 sm:col-span-1">
                      <label className="text-2xs font-bold uppercase tracking-wider text-ink-muted">URL Endpoint</label>
                      <input
                        type="text"
                        placeholder="http://localhost:3001/sse"
                        value={newMcpUrl}
                        onChange={(e) => setNewMcpUrl(e.target.value)}
                        className="w-full h-9 rounded-xl bg-surface border border-line px-3 text-xs text-ink font-mono outline-none focus:border-brand-500"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-2xs font-bold uppercase tracking-wider text-ink-muted">Transport</label>
                      <select
                        value={newMcpTransport}
                        onChange={(e) => setNewMcpTransport(e.target.value as any)}
                        className="w-full h-9 rounded-xl bg-surface border border-line px-3 text-xs text-ink outline-none focus:border-brand-500 cursor-pointer"
                      >
                        <option value="SSE">Server-Sent Events (SSE)</option>
                        <option value="STREAMABLE_HTTP">Streamable HTTP (Post / JSON-RPC)</option>
                      </select>
                    </div>
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-1">
                  <Button type="button" variant="secondary" size="xs" onClick={() => setShowAddMcp(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" variant="primary" size="xs" loading={submittingMcp}>
                    Connect Server
                  </Button>
                </div>
              </form>
            )}

            {/* List Connected MCP Servers */}
            {loadingMcp ? (
              <div className="flex flex-col items-center justify-center py-10">
                <HourglassLoader size={24} label="Loading connected MCP servers..." />
              </div>
            ) : mcpServers.length === 0 ? (
              <div className="p-8 text-center rounded-2xl border border-line bg-surface/50 space-y-2">
                <Cpu size={28} className="mx-auto text-ink-muted opacity-50" />
                <h5 className="text-xs font-bold text-ink">No MCP Servers Connected to this Production</h5>
                <p className="text-[11px] text-ink-muted max-w-sm mx-auto">
                  Connect any remote or local MCP server to equip this production's autonomous agents with live database and system tools.
                </p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {mcpServers.map((server) => (
                  <div
                    key={server.id}
                    className="rounded-2xl border border-line bg-surface p-3.5 shadow-2xs space-y-2.5"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-brand-500/10 text-brand-600 dark:text-brand-400 flex items-center justify-center shrink-0 border border-brand-500/20">
                          <Cpu size={16} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-ink">{server.name}</span>
                            <span className="px-2 py-0.2 rounded-full text-[10px] font-bold bg-inset border border-line-subtle text-ink-muted font-mono">
                              {server.transport}
                            </span>
                            {server.enabled ? (
                              <span className="px-2 py-0.2 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                                Active
                              </span>
                            ) : (
                              <span className="px-2 py-0.2 rounded-full text-[10px] font-bold bg-zinc-500/15 text-zinc-500 border border-zinc-500/30">
                                Disabled
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] font-mono text-ink-muted truncate max-w-md">{server.url}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 self-start sm:self-auto">
                        <Button
                          size="xs"
                          variant="secondary"
                          icon={RefreshCw}
                          loading={refreshingServerId === server.id}
                          onClick={() => handleRefreshMcpTools(server)}
                          title="Refresh and discover tools"
                        >
                          Test & Refresh
                        </Button>
                        <button
                          type="button"
                          onClick={() => setEditingServer(server)}
                          className="p-1.5 rounded-lg border border-line text-ink-muted hover:text-ink hover:bg-hover transition-colors cursor-pointer"
                          title="Edit server"
                        >
                          <Edit2 size={13} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteMcpServer(server.id, server.name)}
                          className="p-1.5 rounded-lg border border-line text-rose-500 hover:bg-rose-500/10 transition-colors cursor-pointer"
                          title="Disconnect server"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>

                    {/* Tools count & summary */}
                    <div className="flex items-center gap-2 pt-1 border-t border-line-subtle text-2xs text-ink-muted">
                      <span className="font-semibold text-brand-600 dark:text-brand-400 flex items-center gap-1">
                        <Wrench size={11} />
                        {server.tools?.length || 0} callable tools discovered
                      </span>
                      {server.lastConnected && (
                        <span>• Connected {new Date(server.lastConnected).toLocaleTimeString()}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ─── TAB 2: GATEWAYS ──────────────────────────────────────────── */}
        {activeTab === 'gateways' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-ink">
                  Production Inference Gateways
                </h4>
                <p className="text-[11px] text-ink-muted">
                  Connect multiple runtime gateways to route execution, offload tools, or connect isolated agent sandboxes.
                </p>
              </div>
              <Button
                variant="primary"
                size="xs"
                icon={Plus}
                onClick={() => {
                  setShowAddGateway(!showAddGateway);
                  setGwError(null);
                }}
              >
                {showAddGateway ? 'Cancel' : 'Connect Gateway'}
              </Button>
            </div>

            {/* Add / Connect Gateway Form */}
            {showAddGateway && (
              <form onSubmit={handleAddGateway} className="rounded-2xl border border-brand-500/30 bg-inset/50 p-4 space-y-3 shadow-xs">
                <div className="flex items-center gap-3 border-b border-line-subtle pb-2">
                  <button
                    type="button"
                    onClick={() => setGwMode('new')}
                    className={cn(
                      'text-xs font-bold pb-1 cursor-pointer transition-colors',
                      gwMode === 'new' ? 'text-brand-600 dark:text-brand-400 border-b-2 border-brand-500' : 'text-ink-muted'
                    )}
                  >
                    New Custom Gateway
                  </button>
                  <button
                    type="button"
                    onClick={() => setGwMode('existing')}
                    className={cn(
                      'text-xs font-bold pb-1 cursor-pointer transition-colors',
                      gwMode === 'existing' ? 'text-brand-600 dark:text-brand-400 border-b-2 border-brand-500' : 'text-ink-muted'
                    )}
                  >
                    Attach from Gateway Library ({orgGateways.length})
                  </button>
                </div>

                {gwError && (
                  <p className="text-2xs text-rose-600 dark:text-rose-400 font-semibold">{gwError}</p>
                )}

                {gwMode === 'existing' ? (
                  <div className="space-y-2">
                    <label className="text-2xs font-bold uppercase tracking-wider text-ink-muted">
                      Select Existing Workspace Gateway
                    </label>
                    <select
                      value={selectedExistingGwId}
                      onChange={(e) => setSelectedExistingGwId(e.target.value)}
                      className="w-full h-9 rounded-xl bg-surface border border-line px-3 text-xs text-ink outline-none focus:border-brand-500 cursor-pointer"
                    >
                      <option value="">-- Choose a Gateway --</option>
                      {orgGateways.map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.name} ({g.url}) — {g.status}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-2xs font-bold uppercase tracking-wider text-ink-muted">Name</label>
                      <input
                        type="text"
                        placeholder="e.g. Production Cluster Gateway"
                        value={newGwName}
                        onChange={(e) => setNewGwName(e.target.value)}
                        className="w-full h-9 rounded-xl bg-surface border border-line px-3 text-xs text-ink outline-none focus:border-brand-500"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-2xs font-bold uppercase tracking-wider text-ink-muted">Endpoint URL</label>
                      <input
                        type="text"
                        placeholder="http://127.0.0.1:8080"
                        value={newGwUrl}
                        onChange={(e) => setNewGwUrl(e.target.value)}
                        className="w-full h-9 rounded-xl bg-surface border border-line px-3 text-xs text-ink font-mono outline-none focus:border-brand-500"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-2xs font-bold uppercase tracking-wider text-ink-muted">Auth Token (optional)</label>
                      <input
                        type="password"
                        placeholder="Bearer token"
                        value={newGwToken}
                        onChange={(e) => setNewGwToken(e.target.value)}
                        className="w-full h-9 rounded-xl bg-surface border border-line px-3 text-xs text-ink outline-none focus:border-brand-500"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-2xs font-bold uppercase tracking-wider text-ink-muted">Workspace Root (optional)</label>
                      <input
                        type="text"
                        placeholder="/workspace"
                        value={newGwRoot}
                        onChange={(e) => setNewGwRoot(e.target.value)}
                        className="w-full h-9 rounded-xl bg-surface border border-line px-3 text-xs text-ink font-mono outline-none focus:border-brand-500"
                      />
                    </div>
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-1">
                  <Button type="button" variant="secondary" size="xs" onClick={() => setShowAddGateway(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" variant="primary" size="xs" loading={submittingGw}>
                    Connect Gateway
                  </Button>
                </div>
              </form>
            )}

            {/* List Connected Gateways */}
            {loadingGateways ? (
              <div className="flex flex-col items-center justify-center py-10">
                <HourglassLoader size={24} label="Loading connected gateways..." />
              </div>
            ) : gateways.length === 0 ? (
              <div className="p-8 text-center rounded-2xl border border-line bg-surface/50 space-y-2">
                <Server size={28} className="mx-auto text-ink-muted opacity-50" />
                <h5 className="text-xs font-bold text-ink">No Gateways Connected to this Production</h5>
                <p className="text-[11px] text-ink-muted max-w-sm mx-auto">
                  Connect one or more inference or sandbox gateways to route agent commands and workspaces.
                </p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {gateways.map((gw) => (
                  <div
                    key={gw.id}
                    className="rounded-2xl border border-line bg-surface p-3.5 shadow-2xs space-y-2"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0 border border-purple-500/20">
                          <Server size={16} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-ink">{gw.name}</span>
                            <span
                              className={cn(
                                'px-2 py-0.2 rounded-full text-[10px] font-bold border',
                                gw.status === 'ONLINE'
                                  ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                                  : 'bg-zinc-500/15 text-zinc-500 border-zinc-500/30'
                              )}
                            >
                              {gw.status || 'ONLINE'}
                            </span>
                          </div>
                          <p className="text-[11px] font-mono text-ink-muted truncate max-w-md">{gw.url}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 self-start sm:self-auto">
                        <Button
                          size="xs"
                          variant="secondary"
                          icon={RefreshCw}
                          loading={checkingGwId === gw.id}
                          onClick={() => handleCheckGatewayHealth(gw)}
                          title="Check gateway health"
                        >
                          Check Health
                        </Button>
                        <button
                          type="button"
                          onClick={() => handleDeleteGateway(gw.id, gw.name)}
                          className="p-1.5 rounded-lg border border-line text-rose-500 hover:bg-rose-500/10 transition-colors cursor-pointer"
                          title="Unlink gateway"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="flex justify-end pt-3 border-t border-line-subtle">
          <Button variant="secondary" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>

      {/* Edit MCP Server Submodal */}
      {editingServer && (
        <Modal
          open={true}
          onClose={() => setEditingServer(null)}
          title={`Edit MCP Server: ${editingServer.name}`}
        >
          <form onSubmit={handleUpdateMcpServer} className="space-y-3">
            <div className="space-y-1">
              <label className="text-2xs font-bold uppercase tracking-wider text-ink-muted">Server Name</label>
              <input
                type="text"
                value={editingServer.name}
                onChange={(e) => setEditingServer({ ...editingServer, name: e.target.value })}
                className="w-full h-9 rounded-xl bg-inset border border-line px-3 text-xs text-ink outline-none focus:border-brand-500"
              />
            </div>
            <div className="space-y-1">
              <label className="text-2xs font-bold uppercase tracking-wider text-ink-muted">Endpoint URL</label>
              <input
                type="text"
                value={editingServer.url}
                onChange={(e) => setEditingServer({ ...editingServer, url: e.target.value })}
                className="w-full h-9 rounded-xl bg-inset border border-line px-3 text-xs text-ink font-mono outline-none focus:border-brand-500"
              />
            </div>
            <div className="space-y-1">
              <label className="text-2xs font-bold uppercase tracking-wider text-ink-muted">Transport</label>
              <select
                value={editingServer.transport}
                onChange={(e) => setEditingServer({ ...editingServer, transport: e.target.value })}
                className="w-full h-9 rounded-xl bg-inset border border-line px-3 text-xs text-ink outline-none focus:border-brand-500 cursor-pointer"
              >
                <option value="SSE">SSE</option>
                <option value="STREAMABLE_HTTP">STREAMABLE_HTTP</option>
              </select>
            </div>
            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="edit-enabled"
                checked={editingServer.enabled}
                onChange={(e) => setEditingServer({ ...editingServer, enabled: e.target.checked })}
                className="rounded border-line"
              />
              <label htmlFor="edit-enabled" className="text-xs font-semibold text-ink cursor-pointer">
                Enabled in this Production
              </label>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-line-subtle">
              <Button type="button" variant="secondary" size="sm" onClick={() => setEditingServer(null)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" size="sm">
                Save Changes
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </Modal>
  );
}
