import { useState, useEffect } from 'react';
import { api } from '../lib/api';
import type { MarketplaceSkill, SkillPack, Gateway } from '../types';
import { Layers, Plus, Package, Download, Trash2, RefreshCw } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { cn } from '../lib/utils';

export function SkillsMarketplace() {
  const [skills, setSkills] = useState<MarketplaceSkill[]>([]);
  const [packs, setPacks] = useState<SkillPack[]>([]);
  const [gateways, setGateways] = useState<Gateway[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'skills' | 'packs'>('skills');
  const [showCreate, setShowCreate] = useState(false);
  const [selectedGateway, setSelectedGateway] = useState<string>('');
  const [form, setForm] = useState({ name: '', description: '', category: 'general', risk: 'low', sourceUrl: '' });
  const [packForm, setPackForm] = useState({ name: '', description: '', sourceUrl: '', branch: 'main' });

  useEffect(() => {
    Promise.all([
      api.skills.marketplace(),
      api.skills.packs(),
      api.gateways.list(),
    ]).then(([s, p, g]) => {
      setSkills(s);
      setPacks(p);
      setGateways(g);
      if (g.length > 0) setSelectedGateway(g[0].id);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  async function handleCreateSkill() {
    const skill = await api.skills.createSkill(form);
    setSkills(prev => [...prev, { ...skill, installedGatewayIds: [] }]);
    setShowCreate(false);
    setForm({ name: '', description: '', category: 'general', risk: 'low', sourceUrl: '' });
  }

  async function handleInstall(skillId: string) {
    if (!selectedGateway) return;
    await api.skills.install(skillId, selectedGateway);
    setSkills(prev => prev.map(s => s.id === skillId ? { ...s, installedGatewayIds: [...s.installedGatewayIds, selectedGateway] } : s));
  }

  async function handleUninstall(skillId: string) {
    if (!selectedGateway) return;
    await api.skills.uninstall(skillId, selectedGateway);
    setSkills(prev => prev.map(s => s.id === skillId ? { ...s, installedGatewayIds: s.installedGatewayIds.filter(g => g !== selectedGateway) } : s));
  }

  async function handleCreatePack() {
    const pack = await api.skills.createPack(packForm);
    setPacks(prev => [...prev, pack]);
    setPackForm({ name: '', description: '', sourceUrl: '', branch: 'main' });
  }

  const riskColors: Record<string, string> = {
    low: 'text-emerald-700 dark:text-emerald-300 bg-emerald-500/15 border-emerald-500/30',
    medium: 'text-amber-700 dark:text-amber-300 bg-amber-500/15 border-amber-500/30',
    high: 'text-rose-700 dark:text-rose-300 bg-rose-500/15 border-rose-500/30',
  };

  if (loading) return <div className="p-6 text-xs text-ink-muted">Loading skills marketplace...</div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-ink flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white shadow-xs">
              <Layers className="w-5 h-5 text-white" />
            </div>
            Skills & Capabilities Marketplace
          </h1>
          <p className="text-sm text-ink-muted mt-1">Manage and install toolkits, integrations, and skill packs for your agents</p>
        </div>
        <div className="flex items-center gap-3">
          {gateways.length > 1 && (
            <select
              value={selectedGateway}
              onChange={e => setSelectedGateway(e.target.value)}
              className="px-3 py-2 bg-canvas border border-line rounded-xl text-xs font-semibold text-ink shadow-2xs focus:border-brand-500 focus:outline-none"
            >
              {gateways.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          )}
          <Button
            variant="primary"
            size="sm"
            icon={Plus}
            onClick={() => setShowCreate(true)}
          >
            Add Skill
          </Button>
        </div>
      </div>

      <div className="flex gap-1 bg-inset/50 rounded-xl p-1.5 border border-line w-fit shadow-2xs">
        <button
          onClick={() => setTab('skills')}
          className={cn(
            'px-4 py-1.5 text-xs font-bold rounded-lg transition-all',
            tab === 'skills'
              ? 'bg-surface text-brand-600 dark:text-brand-400 shadow-2xs border border-line-subtle'
              : 'text-ink-muted hover:text-ink hover:bg-hover',
          )}
        >
          Skills Directory ({skills.length})
        </button>
        <button
          onClick={() => setTab('packs')}
          className={cn(
            'px-4 py-1.5 text-xs font-bold rounded-lg transition-all',
            tab === 'packs'
              ? 'bg-surface text-brand-600 dark:text-brand-400 shadow-2xs border border-line-subtle'
              : 'text-ink-muted hover:text-ink hover:bg-hover',
          )}
        >
          Skill Packs ({packs.length})
        </button>
      </div>

      {tab === 'skills' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {skills.length === 0 ? (
            <div className="col-span-full bg-surface rounded-xl border border-line p-12 text-center text-xs text-ink-muted shadow-2xs">
              No skills found. Add your first capability to get started.
            </div>
          ) : skills.map(skill => {
            const isInstalled = selectedGateway ? skill.installedGatewayIds.includes(selectedGateway) : false;
            return (
              <div key={skill.id} className="bg-surface border border-line rounded-xl p-5 shadow-2xs flex flex-col justify-between space-y-4">
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="text-sm font-bold text-ink">{skill.name}</h3>
                      <span className="text-2xs font-semibold text-ink-muted capitalize">{skill.category}</span>
                    </div>
                    <span className={cn('px-2 py-0.5 text-2xs font-bold uppercase rounded-full border', riskColors[skill.risk] || riskColors.low)}>
                      {skill.risk} Risk
                    </span>
                  </div>
                  <p className="text-xs text-ink-muted leading-relaxed line-clamp-2">{skill.description || 'No description provided'}</p>
                </div>

                {selectedGateway && (
                  <Button
                    size="xs"
                    variant={isInstalled ? 'ghost' : 'secondary'}
                    className={isInstalled ? 'text-rose-600 hover:bg-rose-500/10 w-full' : 'w-full'}
                    onClick={() => isInstalled ? handleUninstall(skill.id) : handleInstall(skill.id)}
                  >
                    {isInstalled ? 'Uninstall from Gateway' : 'Install on Gateway'}
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {tab === 'packs' && (
        <div className="space-y-4">
          <div className="bg-surface border border-line rounded-xl p-5 shadow-2xs space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-ink">Add Skill Pack from Git Repository</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <input
                value={packForm.name}
                onChange={e => setPackForm(p => ({ ...p, name: e.target.value }))}
                placeholder="Pack name"
                className="px-3.5 py-2 bg-canvas border border-line rounded-xl text-xs text-ink placeholder:text-ink-faint focus:border-brand-500 focus:outline-none shadow-2xs"
              />
              <input
                value={packForm.sourceUrl}
                onChange={e => setPackForm(p => ({ ...p, sourceUrl: e.target.value }))}
                placeholder="Git Repository URL"
                className="px-3.5 py-2 bg-canvas border border-line rounded-xl text-xs text-ink placeholder:text-ink-faint focus:border-brand-500 focus:outline-none shadow-2xs"
              />
              <input
                value={packForm.description}
                onChange={e => setPackForm(p => ({ ...p, description: e.target.value }))}
                placeholder="Description"
                className="px-3.5 py-2 bg-canvas border border-line rounded-xl text-xs text-ink placeholder:text-ink-faint focus:border-brand-500 focus:outline-none shadow-2xs"
              />
            </div>
            <Button
              size="xs"
              variant="primary"
              onClick={handleCreatePack}
              disabled={!packForm.name || !packForm.sourceUrl}
            >
              Register Pack
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {packs.map(pack => (
              <div key={pack.id} className="bg-surface border border-line rounded-xl p-5 shadow-2xs flex items-center justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-bold text-ink truncate">{pack.name}</h3>
                  <p className="text-2xs text-ink-muted truncate font-mono mt-0.5">{pack.sourceUrl} ({pack.branch})</p>
                  {pack.lastSyncedAt && <p className="text-2xs text-ink-faint mt-1">Last synced: {new Date(pack.lastSyncedAt).toLocaleString()}</p>}
                </div>
                <Button
                  size="xs"
                  variant="secondary"
                  icon={RefreshCw}
                  onClick={() => api.skills.syncPack(pack.id)}
                >
                  Sync
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {showCreate && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4" onClick={() => setShowCreate(false)}>
          <div className="bg-surface border border-line rounded-2xl p-6 w-full max-w-md shadow-xl space-y-4" onClick={e => e.stopPropagation()}>
            <h2 className="text-sm font-bold uppercase tracking-wider text-ink">Add Skill</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-2xs font-bold uppercase tracking-wider text-ink-muted mb-1">Skill Name</label>
                <input
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. GitHub Pull Request Audit"
                  className="w-full px-3.5 py-2 bg-canvas border border-line rounded-xl text-xs text-ink placeholder:text-ink-faint focus:border-brand-500 focus:outline-none shadow-2xs"
                />
              </div>
              <div>
                <label className="block text-2xs font-bold uppercase tracking-wider text-ink-muted mb-1">Description</label>
                <textarea
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="What does this skill enable agents to do?"
                  rows={3}
                  className="w-full px-3.5 py-2 bg-canvas border border-line rounded-xl text-xs text-ink placeholder:text-ink-faint focus:border-brand-500 focus:outline-none resize-none shadow-2xs"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-2xs font-bold uppercase tracking-wider text-ink-muted mb-1">Category</label>
                  <select
                    value={form.category}
                    onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                    className="w-full px-3.5 py-2 bg-canvas border border-line rounded-xl text-xs font-semibold text-ink focus:border-brand-500 focus:outline-none shadow-2xs"
                  >
                    <option value="general">General</option>
                    <option value="coding">Coding</option>
                    <option value="research">Research</option>
                    <option value="writing">Writing</option>
                    <option value="data">Data</option>
                  </select>
                </div>
                <div>
                  <label className="block text-2xs font-bold uppercase tracking-wider text-ink-muted mb-1">Risk Profile</label>
                  <select
                    value={form.risk}
                    onChange={e => setForm(f => ({ ...f, risk: e.target.value }))}
                    className="w-full px-3.5 py-2 bg-canvas border border-line rounded-xl text-xs font-semibold text-ink focus:border-brand-500 focus:outline-none shadow-2xs"
                  >
                    <option value="low">Low Risk</option>
                    <option value="medium">Medium Risk</option>
                    <option value="high">High Risk</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-2xs font-bold uppercase tracking-wider text-ink-muted mb-1">Source Repository URL (optional)</label>
                <input
                  value={form.sourceUrl}
                  onChange={e => setForm(f => ({ ...f, sourceUrl: e.target.value }))}
                  placeholder="https://github.com/..."
                  className="w-full px-3.5 py-2 bg-canvas border border-line rounded-xl text-xs text-ink placeholder:text-ink-faint focus:border-brand-500 focus:outline-none shadow-2xs"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-line-subtle">
              <Button variant="ghost" size="sm" onClick={() => setShowCreate(false)}>Cancel</Button>
              <Button variant="primary" size="sm" onClick={handleCreateSkill} disabled={!form.name}>Add Skill</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
