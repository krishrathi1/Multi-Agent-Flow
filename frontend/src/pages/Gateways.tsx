import { useState, useEffect } from 'react';
import { Router as RouterIcon, Plus, RefreshCw, Trash2, Edit3, CheckCircle2, AlertTriangle, ShieldCheck } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { LiveRadarBeacon } from '@/components/ui/LiveIcon';
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
        setGateways(prev => prev.map(g => g.id === editId ? updated : g));
      } else {
        // create() requires a token; update() treats it as optional.
        const created = await api.gateways.create({
          name: payload.name,
          url: payload.url,
          token: formToken.trim(),
          workspaceRoot: payload.workspaceRoot,
        });
        setGateways(prev => [...prev, created]);
      }
      resetForm();
    } catch (err) {
      console.error('Failed to save gateway:', err);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      await api.gateways.delete(id);
      setGateways(prev => prev.filter(g => g.id !== id));
    } catch (err) {
      console.error('Failed to delete gateway:', err);
    }
  }

  async function handleHealthCheck(id: string) {
    setCheckingHealth(id);
    try {
      const health = await api.gateways.health(id);
      setHealthChecks(prev => ({ ...prev, [id]: health }));
    } catch {
      setHealthChecks(prev => ({ ...prev, [id]: null }));
    } finally {
      setCheckingHealth(null);
    }
  }

  const statusColors: Record<string, string> = {
    ONLINE: 'bg-emerald-500',
    OFFLINE: 'bg-rose-500',
    UNKNOWN: 'bg-amber-500',
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

      {/* Add/Edit Form */}
      {showForm && (
        <div className="mb-6 rounded-xl border border-white/5 bg-surface-850 p-5">
          <h3 className="text-sm font-semibold text-white mb-4">
            {editId ? 'Edit Gateway' : 'Add Gateway'}
          </h3>
          <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">Name</label>
              <input
                type="text"
                value={formName}
                onChange={e => setFormName(e.target.value)}
                placeholder="My OpenClaw Gateway"
                className="w-full px-3 py-2 rounded-lg bg-surface-900 border border-white/10 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-nexus-500/50"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">WebSocket URL</label>
              <input
                type="text"
                value={formUrl}
                onChange={e => setFormUrl(e.target.value)}
                placeholder="ws://localhost:9090"
                className="w-full px-3 py-2 rounded-lg bg-surface-900 border border-white/10 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-nexus-500/50 font-mono"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">
                Auth Token {editId && <span className="text-gray-600">(leave blank to keep current)</span>}
              </label>
              <input
                type="password"
                value={formToken}
                onChange={e => setFormToken(e.target.value)}
                placeholder="gateway-secret-token"
                className="w-full px-3 py-2 rounded-lg bg-surface-900 border border-white/10 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-nexus-500/50"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">
                Workspace Root <span className="text-gray-600">(optional)</span>
              </label>
              <input
                type="text"
                value={formWorkspaceRoot}
                onChange={e => setFormWorkspaceRoot(e.target.value)}
                placeholder="~/.openclaw/agents"
                className="w-full px-3 py-2 rounded-lg bg-surface-900 border border-white/10 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-nexus-500/50 font-mono"
              />
            </div>
            <div className="col-span-2 flex items-center gap-3">
              <button
                type="submit"
                disabled={saving}
                className="px-5 py-2 rounded-lg text-sm font-medium bg-nexus-600 text-white hover:bg-nexus-500 transition-colors disabled:opacity-50"
              >
                {saving ? 'Saving...' : editId ? 'Update' : 'Add Gateway'}
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="px-5 py-2 rounded-lg text-sm font-medium bg-white/5 border border-white/10 text-gray-400 hover:bg-white/10 transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Gateway List */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-nexus-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : gateways.length === 0 ? (
        <div className="rounded-xl border border-white/5 bg-surface-850 p-12 text-center">
          <div className="text-4xl mb-3">{'\u2302'}</div>
          <h3 className="text-lg font-semibold text-white mb-1">No Gateways</h3>
          <p className="text-sm text-gray-500 mb-4">Add an OpenClaw gateway to start provisioning real agents</p>
          {!showForm && (
            <button
              onClick={() => setShowForm(true)}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-nexus-600 text-white hover:bg-nexus-500 transition-colors"
            >
              + Add Gateway
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {gateways.map(gw => (
            <div key={gw.id} className="rounded-xl border border-white/5 bg-surface-850 p-5">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full ${statusColors[gw.status] || statusColors.UNKNOWN}`} />
                  <div>
                    <h3 className="text-sm font-semibold text-white">{gw.name}</h3>
                    <p className="text-xs text-gray-500 font-mono mt-0.5">{gw.url}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleHealthCheck(gw.id)}
                    disabled={checkingHealth === gw.id}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium bg-white/5 border border-white/10 text-gray-400 hover:bg-white/10 transition-colors disabled:opacity-50"
                  >
                    {checkingHealth === gw.id ? 'Checking...' : 'Health Check'}
                  </button>
                  <button
                    onClick={() => startEdit(gw)}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium bg-white/5 border border-white/10 text-gray-400 hover:bg-white/10 transition-colors"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(gw.id)}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 transition-colors"
                  >
                    Delete
                  </button>
                </div>
              </div>
              {(() => {
                // Hoisted so TypeScript narrows the optional fields once.
                const health = healthChecks[gw.id];
                if (!health) return null;
                return (
                  <div className="mt-3 px-3 py-2 rounded-lg bg-inset border border-line-subtle text-xs text-ink-subtle">
                    <span className="font-medium text-emerald-600 dark:text-emerald-400">Healthy</span>
                    {' \u2022 '}
                    Version: {health.version || 'unknown'}
                    {health.uptime != null && ` \u2022 Uptime: ${Math.floor(health.uptime / 60)}m`}
                  </div>
                );
              })()}
              {healthChecks[gw.id] === null && gw.id in healthChecks && (
                <div className="mt-3 px-3 py-2 rounded-lg bg-red-500/5 border border-red-500/10 text-xs text-red-400">
                  Health check failed — gateway may be unreachable
                </div>
              )}
              {gw.workspaceRoot && (
                <p className="mt-2 text-xs text-gray-600">
                  Workspace: <span className="font-mono">{gw.workspaceRoot}</span>
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
