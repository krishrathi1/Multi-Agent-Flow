import { useState, useEffect } from 'react';
import {
  Router as RouterIcon,
  Plus,
  RefreshCw,
  Trash2,
  Edit3,
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
  Activity,
  Globe,
  HardDrive,
  KeyRound,
  ExternalLink,
} from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { LiveRadarBeacon, LiveWaveform } from '@/components/ui/LiveIcon';
import { HourglassLoader } from '@/components/ui/HourglassLoader';
import { LottieAnimation } from '@/components/ui/LottieAnimation';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import type { Gateway, GatewayHealth } from '@/types';

export function Gateways() {
  const [gateways, setGateways] = useState<Gateway[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [healthChecks, setHealthChecks] = useState<Record<string, GatewayHealth | null>>({});
  const [checkingHealth, setCheckingHealth] = useState<string | null>(null);

  // Form state
  const [formName, setFormName] = useState('');
  const [formUrl, setFormUrl] = useState('');
  const [formToken, setFormToken] = useState('');
  const [formWorkspaceRoot, setFormWorkspaceRoot] = useState('');

  useEffect(() => {
    loadGateways();
  }, []);

  async function loadGateways() {
    try {
      const data = await api.gateways.list();
      setGateways(data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }

  function resetForm() {
    setFormName('');
    setFormUrl('');
    setFormToken('');
    setFormWorkspaceRoot('');
    setEditId(null);
    setShowForm(false);
  }

  function startEdit(gw: Gateway) {
    setFormName(gw.name);
    setFormUrl(gw.url);
    setFormToken('');
    setFormWorkspaceRoot(gw.workspaceRoot || '');
    setEditId(gw.id);
    setShowForm(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!formName.trim() || !formUrl.trim()) return;
    setSaving(true);
    try {
      const payload = {
        name: formName.trim(),
        url: formUrl.trim(),
        ...(formToken.trim() && { token: formToken.trim() }),
        workspaceRoot: formWorkspaceRoot.trim() || undefined,
      };
      if (editId) {
        const updated = await api.gateways.update(editId, payload);
        setGateways((prev) => (prev.map((g) => (g.id === editId ? updated : g))));
      } else {
        const created = await api.gateways.create({
          name: payload.name,
          url: payload.url,
          token: formToken.trim(),
          workspaceRoot: payload.workspaceRoot,
        });
        setGateways((prev) => [...prev, created]);
      }
      resetForm();
    } catch (err) {
      console.error('Failed to save gateway:', err);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Are you sure you want to remove this gateway endpoint?')) return;
    try {
      await api.gateways.delete(id);
      setGateways((prev) => prev.filter((g) => g.id !== id));
    } catch (err) {
      console.error('Failed to delete gateway:', err);
    }
  }

  async function handleHealthCheck(id: string) {
    setCheckingHealth(id);
    try {
      const health = await api.gateways.health(id);
      setHealthChecks((prev) => ({ ...prev, [id]: health }));
    } catch {
      setHealthChecks((prev) => ({ ...prev, [id]: null }));
    } finally {
      setCheckingHealth(null);
    }
  }

  const statusBadge = (status: string) => {
    switch (status) {
      case 'ONLINE':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Online
          </span>
        );
      case 'OFFLINE':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/25">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
            Offline
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/25">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            Standby
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        icon={RouterIcon}
        title="Gateways"
        description="Manage OpenClaw gateway connection endpoints, WebSocket bridges, and agent dispatchers"
        actions={
          !showForm ? (
            <Button
              variant="primary"
              icon={Plus}
              onClick={() => setShowForm(true)}
            >
              Add Gateway
            </Button>
          ) : undefined
        }
      />

      {/* Add/Edit Form Card */}
      {showForm && (
        <div className="rounded-2xl border border-line-subtle bg-surface p-5 sm:p-6 shadow-xs animate-scale-in">
          <div className="flex items-center justify-between border-b border-line-subtle pb-3.5 mb-5">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-brand-500/10 border border-brand-500/20 flex items-center justify-center text-brand-600 dark:text-brand-400">
                <RouterIcon size={16} />
              </div>
              <h3 className="text-sm font-bold text-ink">
                {editId ? 'Edit Gateway Configuration' : 'Provision New Gateway Endpoint'}
              </h3>
            </div>
            <button
              type="button"
              onClick={resetForm}
              className="text-xs font-semibold text-ink-muted hover:text-ink cursor-pointer"
            >
              ✕
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-ink-muted mb-1.5">
                  Gateway Name *
                </label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. Production Cluster Gateway"
                  className="w-full h-10 px-3.5 bg-inset border border-line rounded-xl text-xs text-ink placeholder:text-ink-faint focus:border-brand-500 focus:outline-none shadow-2xs"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-ink-muted mb-1.5">
                  WebSocket URL *
                </label>
                <input
                  type="text"
                  value={formUrl}
                  onChange={(e) => setFormUrl(e.target.value)}
                  placeholder="ws://localhost:9090"
                  className="w-full h-10 px-3.5 bg-inset border border-line rounded-xl text-xs text-ink placeholder:text-ink-faint focus:border-brand-500 focus:outline-none shadow-2xs font-mono"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-ink-muted mb-1.5">
                  Auth Token {editId && <span className="text-ink-faint font-normal">(leave blank to keep current)</span>}
                </label>
                <input
                  type="password"
                  value={formToken}
                  onChange={(e) => setFormToken(e.target.value)}
                  placeholder="gateway-secret-token"
                  className="w-full h-10 px-3.5 bg-inset border border-line rounded-xl text-xs text-ink placeholder:text-ink-faint focus:border-brand-500 focus:outline-none shadow-2xs font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-ink-muted mb-1.5">
                  Workspace Root <span className="text-ink-faint font-normal">(optional)</span>
                </label>
                <input
                  type="text"
                  value={formWorkspaceRoot}
                  onChange={(e) => setFormWorkspaceRoot(e.target.value)}
                  placeholder="~/.openclaw/agents"
                  className="w-full h-10 px-3.5 bg-inset border border-line rounded-xl text-xs text-ink placeholder:text-ink-faint focus:border-brand-500 focus:outline-none shadow-2xs font-mono"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-line-subtle">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={resetForm}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="sm"
                loading={saving}
                disabled={!formName.trim() || !formUrl.trim()}
              >
                {editId ? 'Update Gateway' : 'Add Gateway'}
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* Gateway List */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <HourglassLoader size={52} label="Discovering gateway nodes..." />
        </div>
      ) : gateways.length === 0 ? (
        <div className="rounded-2xl border border-line-subtle bg-surface p-12 text-center shadow-xs">
          <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-brand-500/10 border border-brand-500/20 flex items-center justify-center text-brand-600 dark:text-brand-400 shadow-2xs">
            <RouterIcon size={28} />
          </div>
          <h3 className="text-sm font-bold text-ink mb-1">No Gateways Configured</h3>
          <p className="text-xs text-ink-muted mb-5 max-w-md mx-auto leading-relaxed">
            Add an OpenClaw or WebSocket gateway to start provisioning remote agent runtimes, real-time message dispatchers, and autonomous nodes.
          </p>
          {!showForm && (
            <Button
              variant="primary"
              size="sm"
              icon={Plus}
              onClick={() => setShowForm(true)}
            >
              Add Gateway
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3.5">
          {gateways.map((gw) => (
            <div
              key={gw.id}
              className="rounded-2xl border border-line-subtle bg-surface p-4.5 sm:p-5 shadow-2xs hover:border-line-strong hover:shadow-xs transition-all"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-start gap-3.5 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-inset border border-line flex items-center justify-center text-brand-600 dark:text-brand-400 shrink-0 mt-0.5">
                    <Globe size={18} />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2.5 flex-wrap mb-1">
                      <h3 className="text-xs font-bold text-ink truncate">{gw.name}</h3>
                      {statusBadge(gw.status)}
                    </div>
                    <div className="flex items-center gap-2 text-2xs text-ink-muted font-mono truncate">
                      <span className="bg-inset px-2 py-0.5 rounded-md border border-line-subtle truncate">
                        {gw.url}
                      </span>
                      {gw.workspaceRoot && (
                        <span className="text-ink-faint truncate hidden md:inline">
                          📁 {gw.workspaceRoot}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                  <button
                    type="button"
                    onClick={() => handleHealthCheck(gw.id)}
                    disabled={checkingHealth === gw.id}
                    className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-surface border border-line text-ink hover:bg-hover hover:border-line-strong transition-all cursor-pointer flex items-center gap-1.5 shadow-2xs disabled:opacity-50"
                  >
                    <RefreshCw size={12} className={cn(checkingHealth === gw.id && 'animate-spin')} />
                    {checkingHealth === gw.id ? 'Pinging...' : 'Health Check'}
                  </button>
                  <button
                    type="button"
                    onClick={() => startEdit(gw)}
                    className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-surface border border-line text-ink hover:bg-hover hover:border-line-strong transition-all cursor-pointer flex items-center gap-1.5 shadow-2xs"
                  >
                    <Edit3 size={12} />
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(gw.id)}
                    className="p-1.5 rounded-xl text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                    title="Remove Gateway"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>

              {/* Health Check Result Tile */}
              {(() => {
                const health = healthChecks[gw.id];
                if (!health) return null;
                return (
                  <div className="mt-3.5 px-3.5 py-2.5 rounded-xl bg-emerald-500/5 border border-emerald-500/20 text-xs text-ink flex items-center gap-2.5 animate-scale-in">
                    <CheckCircle2 size={14} className="text-emerald-500 shrink-0" />
                    <span className="font-bold text-emerald-600 dark:text-emerald-400">Endpoint Reachable</span>
                    <span className="text-ink-muted">•</span>
                    <span className="text-2xs text-ink-muted">Version: <strong className="text-ink font-mono">{health.version || 'v1.0.0'}</strong></span>
                    {health.uptime != null && (
                      <>
                        <span className="text-ink-muted">•</span>
                        <span className="text-2xs text-ink-muted">Uptime: <strong className="text-ink font-mono">{Math.floor(health.uptime / 60)}m</strong></span>
                      </>
                    )}
                  </div>
                );
              })()}

              {healthChecks[gw.id] === null && gw.id in healthChecks && (
                <div className="mt-3.5 px-3.5 py-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-600 dark:text-rose-400 flex items-center gap-2 animate-scale-in">
                  <AlertTriangle size={14} className="shrink-0" />
                  <span>Health check failed — gateway node is unreachable at this WebSocket endpoint.</span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

