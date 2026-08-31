import { useState, useEffect } from 'react';
import { api } from '../lib/api';
import type { MarketplaceSkill, SkillPack, Gateway } from '../types';
import {
  Sparkles,
  Plus,
  Package,
  Download,
  Trash2,
  RefreshCw,
  Search,
  Check,
  ChevronDown,
  Layers,
  ExternalLink,
  ShieldAlert,
} from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';
import { Button } from '../components/ui/Button';
import { LiveSparkleIcon } from '../components/ui/LiveIcon';
import { cn } from '../lib/utils';

export function SkillsMarketplace() {
  const [skills, setSkills] = useState<MarketplaceSkill[]>([]);
  const [packs, setPacks] = useState<SkillPack[]>([]);
  const [gateways, setGateways] = useState<Gateway[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'skills' | 'packs'>('skills');
  const [showCreate, setShowCreate] = useState(false);
  const [selectedGateway, setSelectedGateway] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');

  const [form, setForm] = useState({
    name: '',
    description: '',
    category: 'general',
    risk: 'low',
    sourceUrl: '',
  });
  const [creatingSkill, setCreatingSkill] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const [packForm, setPackForm] = useState({ name: '', description: '', sourceUrl: '', branch: 'main' });
  const [creatingPack, setCreatingPack] = useState(false);

  useEffect(() => {
    Promise.all([
      api.skills.marketplace(),
      api.skills.packs(),
      api.gateways.list(),
    ])
      .then(([s, p, g]) => {
        setSkills(s);
        setPacks(p);
        setGateways(g);
        if (g.length > 0) setSelectedGateway(g[0].id);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  async function handleCreateSkill(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (!form.name.trim()) return;

    setCreatingSkill(true);
    setCreateError(null);
    try {
      const created = await api.skills.createSkill({
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        category: form.category,
        risk: form.risk,
        sourceUrl: form.sourceUrl.trim() || undefined,
      });

      setSkills((prev) => [
        {
          ...created,
          installedGatewayIds: [],
        },
        ...prev,
      ]);

      setForm({ name: '', description: '', category: 'general', risk: 'low', sourceUrl: '' });
      setShowCreate(false);
    } catch (err: any) {
      console.error('Failed to create skill:', err);
      setCreateError(err?.message || 'Failed to create skill. Please verify your inputs.');
    } finally {
      setCreatingSkill(false);
    }
  }

  async function handleInstall(skillId: string) {
    if (!selectedGateway) return;
    try {
      await api.skills.install(skillId, selectedGateway);
      setSkills((prev) =>
        prev.map((s) =>
          s.id === skillId
            ? { ...s, installedGatewayIds: [...s.installedGatewayIds, selectedGateway] }
            : s
        )
      );
    } catch (err) {
      console.error('Failed to install skill:', err);
    }
  }

  async function handleUninstall(skillId: string) {
    if (!selectedGateway) return;
    try {
      await api.skills.uninstall(skillId, selectedGateway);
      setSkills((prev) =>
        prev.map((s) =>
          s.id === skillId
            ? { ...s, installedGatewayIds: s.installedGatewayIds.filter((g) => g !== selectedGateway) }
            : s
        )
      );
    } catch (err) {
      console.error('Failed to uninstall skill:', err);
    }
  }

  async function handleCreatePack() {
    if (!packForm.name.trim() || !packForm.sourceUrl.trim()) return;
    setCreatingPack(true);
    try {
      const pack = await api.skills.createPack(packForm);
      setPacks((prev) => [pack, ...prev]);
      setPackForm({ name: '', description: '', sourceUrl: '', branch: 'main' });
    } catch (err) {
      console.error('Failed to create pack:', err);
    } finally {
      setCreatingPack(false);
    }
  }

  const riskColors: Record<string, string> = {
    low: 'text-emerald-700 dark:text-emerald-300 bg-emerald-500/15 border-emerald-500/30',
    medium: 'text-amber-700 dark:text-amber-300 bg-amber-500/15 border-amber-500/30',
    high: 'text-rose-700 dark:text-rose-300 bg-rose-500/15 border-rose-500/30',
  };

  const filteredSkills = skills.filter((s) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return s.name.toLowerCase().includes(q) || (s.description && s.description.toLowerCase().includes(q)) || s.category.toLowerCase().includes(q);
  });

  if (loading) return <div className="p-6 text-xs text-ink-muted">Loading skills marketplace...</div>;

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Sparkles}
        title="Skills Marketplace"
        description="Manage and install toolkits, integrations, and skill packs for your agents"
        actions={
          <div className="flex items-center gap-2">
            {gateways.length > 1 && (
              <select
                value={selectedGateway}
                onChange={(e) => setSelectedGateway(e.target.value)}
                className="h-9 px-3 bg-surface border border-line rounded-xl text-xs font-semibold text-ink shadow-2xs focus:border-brand-500 focus:outline-none cursor-pointer"
              >
                {gateways.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            )}
            <Button
              variant="primary"
              icon={Plus}
              onClick={() => setShowCreate(true)}
            >
              Add Skill
            </Button>
          </div>
        }
      />

      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex gap-1 bg-inset/50 rounded-xl p-1 border border-line w-fit shadow-2xs">
          <button
            type="button"
            onClick={() => setTab('skills')}
            className={cn(
              'px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer',
              tab === 'skills'
                ? 'bg-surface text-brand-600 dark:text-brand-400 shadow-2xs border border-line-subtle'
                : 'text-ink-muted hover:text-ink hover:bg-hover'
            )}
          >
            Skills Directory ({skills.length})
          </button>
          <button
            type="button"
            onClick={() => setTab('packs')}
            className={cn(
              'px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer',
              tab === 'packs'
                ? 'bg-surface text-brand-600 dark:text-brand-400 shadow-2xs border border-line-subtle'
                : 'text-ink-muted hover:text-ink hover:bg-hover'
            )}
          >
            Skill Packs ({packs.length})
          </button>
        </div>

        {tab === 'skills' && (
          <div className="relative w-full sm:w-64">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search skills & toolkits..."
              className="w-full h-9 pl-8.5 pr-3 bg-surface border border-line rounded-xl text-xs text-ink placeholder:text-ink-faint shadow-2xs focus:border-brand-500 focus:outline-none"
            />
          </div>
        )}
      </div>

      {tab === 'skills' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredSkills.length === 0 ? (
            <div className="col-span-full bg-surface rounded-2xl border border-line p-12 text-center text-xs text-ink-muted shadow-2xs space-y-2">
              <Sparkles size={24} className="mx-auto text-brand-500 opacity-60" />
              <p className="font-semibold text-ink">No skills found</p>
              <p className="text-2xs text-ink-faint">Try adjusting your search query or add a new skill capability.</p>
            </div>
          ) : (
            filteredSkills.map((skill) => {
              const isInstalled = selectedGateway ? skill.installedGatewayIds.includes(selectedGateway) : false;
              return (
                <div key={skill.id} className="bg-surface border border-line rounded-2xl p-5 shadow-2xs flex flex-col justify-between space-y-4 transition-all hover:border-line-strong hover:shadow-xs">
                  <div className="space-y-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <h3 className="text-sm font-bold text-ink truncate">{skill.name}</h3>
                        <span className="text-2xs font-semibold text-ink-muted capitalize">{skill.category}</span>
                      </div>
                      <span className={cn('px-2.5 py-0.5 text-2xs font-bold uppercase rounded-full border shrink-0', riskColors[skill.risk] || riskColors.low)}>
                        {skill.risk} Risk
                      </span>
                    </div>
                    <p className="text-xs text-ink-muted leading-relaxed line-clamp-2">
                      {skill.description || 'No description provided'}
                    </p>
                  </div>

                  {selectedGateway && (
                    <Button
                      size="xs"
                      variant={isInstalled ? 'ghost' : 'secondary'}
                      className={isInstalled ? 'text-rose-600 hover:bg-rose-500/10 w-full' : 'w-full'}
                      onClick={() => (isInstalled ? handleUninstall(skill.id) : handleInstall(skill.id))}
                    >
                      {isInstalled ? 'Uninstall from Gateway' : 'Install on Gateway'}
                    </Button>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {tab === 'packs' && (
        <div className="space-y-4">
          <div className="bg-surface border border-line rounded-2xl p-5 shadow-2xs space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-ink">Add Skill Pack from Git Repository</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <input
                value={packForm.name}
                onChange={(e) => setPackForm((p) => ({ ...p, name: e.target.value }))}
                placeholder="Pack name"
                className="px-3.5 py-2 bg-inset border border-line rounded-xl text-xs text-ink placeholder:text-ink-faint focus:border-brand-500 focus:outline-none shadow-2xs"
              />
              <input
                value={packForm.sourceUrl}
                onChange={(e) => setPackForm((p) => ({ ...p, sourceUrl: e.target.value }))}
                placeholder="Git Repository URL"
                className="px-3.5 py-2 bg-inset border border-line rounded-xl text-xs text-ink placeholder:text-ink-faint focus:border-brand-500 focus:outline-none shadow-2xs"
              />
              <input
                value={packForm.description}
                onChange={(e) => setPackForm((p) => ({ ...p, description: e.target.value }))}
                placeholder="Description"
                className="px-3.5 py-2 bg-inset border border-line rounded-xl text-xs text-ink placeholder:text-ink-faint focus:border-brand-500 focus:outline-none shadow-2xs"
              />
            </div>
            <Button
              size="xs"
              variant="primary"
              onClick={handleCreatePack}
              loading={creatingPack}
              disabled={!packForm.name || !packForm.sourceUrl}
            >
              Register Pack
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {packs.map((pack) => (
              <div key={pack.id} className="bg-surface border border-line rounded-2xl p-5 shadow-2xs flex items-center justify-between gap-4">
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
          <div className="bg-surface border border-line rounded-3xl p-6 w-full max-w-md shadow-2xl space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-line-subtle pb-3">
              <h2 className="text-sm font-bold uppercase tracking-wider text-ink flex items-center gap-2">
                <LiveSparkleIcon size={16} />
                <span>Add Skill</span>
              </h2>
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                className="text-ink-muted hover:text-ink text-xs font-semibold cursor-pointer"
              >
                ✕
              </button>
            </div>

            {createError && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/25 text-rose-600 dark:text-rose-400 text-xs font-medium">
                {createError}
              </div>
            )}

            <form onSubmit={handleCreateSkill} className="space-y-3.5">
              <div>
                <label className="block text-2xs font-bold uppercase tracking-wider text-ink-muted mb-1.5">Skill Name *</label>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. GitHub Pull Request Audit"
                  className="w-full h-10 px-3.5 bg-inset border border-line rounded-xl text-xs text-ink placeholder:text-ink-faint focus:border-brand-500 focus:outline-none shadow-2xs"
                />
              </div>

              <div>
                <label className="block text-2xs font-bold uppercase tracking-wider text-ink-muted mb-1.5">Description</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="What does this skill enable agents to do?"
                  rows={3}
                  className="w-full p-3 bg-inset border border-line rounded-xl text-xs text-ink placeholder:text-ink-faint focus:border-brand-500 focus:outline-none resize-none shadow-2xs leading-relaxed"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-2xs font-bold uppercase tracking-wider text-ink-muted mb-1.5">Category</label>
                  <select
                    value={form.category}
                    onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                    className="w-full h-10 px-3 bg-inset border border-line rounded-xl text-xs font-semibold text-ink focus:border-brand-500 focus:outline-none shadow-2xs cursor-pointer"
                  >
                    <option value="general">General</option>
                    <option value="coding">Coding</option>
                    <option value="research">Research</option>
                    <option value="writing">Writing</option>
                    <option value="data">Data</option>
                    <option value="devops">DevOps</option>
                  </select>
                </div>
                <div>
                  <label className="block text-2xs font-bold uppercase tracking-wider text-ink-muted mb-1.5">Risk Profile</label>
                  <select
                    value={form.risk}
                    onChange={(e) => setForm((f) => ({ ...f, risk: e.target.value }))}
                    className="w-full h-10 px-3 bg-inset border border-line rounded-xl text-xs font-semibold text-ink focus:border-brand-500 focus:outline-none shadow-2xs cursor-pointer"
                  >
                    <option value="low">Low Risk</option>
                    <option value="medium">Medium Risk</option>
                    <option value="high">High Risk</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-2xs font-bold uppercase tracking-wider text-ink-muted mb-1.5">Source Repository URL (optional)</label>
                <input
                  type="text"
                  value={form.sourceUrl}
                  onChange={(e) => setForm((f) => ({ ...f, sourceUrl: e.target.value }))}
                  placeholder="https://github.com/..."
                  className="w-full h-10 px-3.5 bg-inset border border-line rounded-xl text-xs text-ink placeholder:text-ink-faint focus:border-brand-500 focus:outline-none shadow-2xs font-mono"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-line-subtle">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowCreate(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  loading={creatingSkill}
                  disabled={!form.name.trim()}
                >
                  Add Skill
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
