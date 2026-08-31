import { useState, useEffect } from 'react';
import { api } from '../lib/api';
import type { TaskCustomFieldDefinition, Board } from '../types';
import { Sliders, Plus, Trash2, Link as LinkIcon, CheckCircle2 } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { cn } from '../lib/utils';

export function CustomFields() {
  const [definitions, setDefinitions] = useState<TaskCustomFieldDefinition[]>([]);
  const [boards, setBoards] = useState<Board[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [attachFieldId, setAttachFieldId] = useState<string | null>(null);
  const [selectedBoards, setSelectedBoards] = useState<string[]>([]);
  const [form, setForm] = useState({ fieldKey: '', label: '', fieldType: 'TEXT', uiVisibility: 'ALWAYS', validationRegex: '', defaultValue: '' });

  useEffect(() => {
    Promise.all([api.customFields.list(), api.boards.list()])
      .then(([defs, boards]) => {
        setDefinitions(defs);
        setBoards(boards);
        setLoading(false);
      }).catch(() => setLoading(false));
  }, []);

  async function handleCreate() {
    const def = await api.customFields.create({
      fieldKey: form.fieldKey || form.label.toLowerCase().replace(/[^a-z0-9]+/g, '_'),
      label: form.label,
      fieldType: form.fieldType,
      uiVisibility: form.uiVisibility,
      validationRegex: form.validationRegex || undefined,
      defaultValue: form.defaultValue || undefined,
    });
    setDefinitions(prev => [...prev, def]);
    setShowCreate(false);
    setForm({ fieldKey: '', label: '', fieldType: 'TEXT', uiVisibility: 'ALWAYS', validationRegex: '', defaultValue: '' });
  }

  async function handleDelete(id: string) {
    if (!confirm('Are you sure you want to delete this custom field?')) return;
    await api.customFields.delete(id);
    setDefinitions(prev => prev.filter(d => d.id !== id));
  }

  async function handleAttach() {
    if (!attachFieldId || selectedBoards.length === 0) return;
    await api.customFields.attach(attachFieldId, selectedBoards);
    setAttachFieldId(null);
    setSelectedBoards([]);
    const refreshed = await api.customFields.list();
    setDefinitions(refreshed);
  }

  const fieldTypeLabels: Record<string, string> = {
    TEXT: 'Text', TEXT_LONG: 'Long Text', INTEGER: 'Integer', DECIMAL: 'Decimal',
    BOOLEAN: 'Boolean', DATE: 'Date', DATE_TIME: 'Date & Time', URL: 'URL', JSON: 'JSON',
  };

  if (loading) return <div className="p-6 text-xs text-ink-muted">Loading custom fields...</div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-ink flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white shadow-xs">
              <Sliders className="w-5 h-5 text-white" />
            </div>
            Custom Fields
          </h1>
          <p className="text-sm text-ink-muted mt-1">Define custom schema attributes for tasks and bind them to specific project boards</p>
        </div>
        <Button
          variant="primary"
          size="sm"
          icon={Plus}
          onClick={() => setShowCreate(true)}
        >
          Create Field
        </Button>
      </div>

      <div className="space-y-3">
        {definitions.length === 0 ? (
          <div className="rounded-2xl border border-line bg-surface p-12 text-center shadow-2xs space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-brand-500/10 text-brand-600 dark:text-brand-400 mx-auto flex items-center justify-center shadow-xs">
              <Sliders size={24} />
            </div>
            <div className="space-y-1 max-w-md mx-auto">
              <h3 className="text-base font-bold text-ink">No Custom Fields Defined</h3>
              <p className="text-xs text-ink-muted leading-relaxed">
                Add schema fields such as pull request IDs, latency targets, and environments to attach to tasks across your boards.
              </p>
            </div>
            <Button
              variant="primary"
              size="sm"
              icon={Plus}
              onClick={() => setShowCreate(true)}
            >
              Create First Field
            </Button>
          </div>
        ) : definitions.map(def => (
          <div key={def.id} className="bg-surface border border-line rounded-2xl p-5 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2.5 flex-wrap">
                <h3 className="text-sm font-bold text-ink">{def.label}</h3>
                <span className="px-2 py-0.5 text-[10px] font-bold uppercase rounded-md bg-inset border border-line-subtle text-ink-muted">
                  {fieldTypeLabels[def.fieldType] || def.fieldType}
                </span>
                <span className="px-2 py-0.5 text-[10px] font-bold uppercase rounded-md bg-brand-500/10 text-brand-700 dark:text-brand-300 border border-brand-500/20">
                  {def.uiVisibility.toLowerCase()}
                </span>
              </div>
              <p className="text-2xs text-ink-muted font-medium">
                Key: <strong className="font-mono text-ink">{def.fieldKey}</strong> &middot; <span className="text-ink font-semibold">{def._count?.boardFields ?? 0}</span> boards attached &middot; <span className="text-ink font-semibold">{def._count?.values ?? 0}</span> values recorded
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="xs"
                icon={LinkIcon}
                onClick={() => { setAttachFieldId(def.id); setSelectedBoards([]); }}
              >
                Attach to Boards
              </Button>
              <Button
                variant="ghost"
                size="xs"
                icon={Trash2}
                className="text-rose-600 hover:bg-rose-500/10"
                onClick={() => handleDelete(def.id)}
              >
                Delete
              </Button>
            </div>
          </div>
        ))}
      </div>

      {/* Create Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4" onClick={() => setShowCreate(false)}>
          <div className="bg-surface border border-line rounded-2xl p-6 w-full max-w-md shadow-xl space-y-4" onClick={e => e.stopPropagation()}>
            <h2 className="text-sm font-bold uppercase tracking-wider text-ink">Create Custom Field</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-2xs font-bold uppercase tracking-wider text-ink-muted mb-1">Field Label</label>
                <input
                  value={form.label}
                  onChange={e => setForm(f => ({ ...f, label: e.target.value }))}
                  placeholder="e.g. Deployment Environment"
                  className="w-full px-3.5 py-2.5 bg-canvas border border-line rounded-xl text-xs text-ink placeholder:text-ink-faint focus:border-brand-500 focus:outline-none shadow-2xs"
                />
              </div>
              <div>
                <label className="block text-2xs font-bold uppercase tracking-wider text-ink-muted mb-1">Field Key (Optional)</label>
                <input
                  value={form.fieldKey}
                  onChange={e => setForm(f => ({ ...f, fieldKey: e.target.value }))}
                  placeholder="e.g. deploy_env (auto-generated if blank)"
                  className="w-full px-3.5 py-2.5 bg-canvas border border-line rounded-xl text-xs font-mono text-ink placeholder:text-ink-faint focus:border-brand-500 focus:outline-none shadow-2xs"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-2xs font-bold uppercase tracking-wider text-ink-muted mb-1">Field Type</label>
                  <select
                    value={form.fieldType}
                    onChange={e => setForm(f => ({ ...f, fieldType: e.target.value }))}
                    className="w-full px-3.5 py-2.5 bg-canvas border border-line rounded-xl text-xs font-semibold text-ink focus:border-brand-500 focus:outline-none shadow-2xs"
                  >
                    {Object.entries(fieldTypeLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-2xs font-bold uppercase tracking-wider text-ink-muted mb-1">Visibility</label>
                  <select
                    value={form.uiVisibility}
                    onChange={e => setForm(f => ({ ...f, uiVisibility: e.target.value }))}
                    className="w-full px-3.5 py-2.5 bg-canvas border border-line rounded-xl text-xs font-semibold text-ink focus:border-brand-500 focus:outline-none shadow-2xs"
                  >
                    <option value="ALWAYS">Always Visible</option>
                    <option value="IF_SET">Show If Set</option>
                    <option value="HIDDEN">Hidden</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-2xs font-bold uppercase tracking-wider text-ink-muted mb-1">Default Value</label>
                <input
                  value={form.defaultValue}
                  onChange={e => setForm(f => ({ ...f, defaultValue: e.target.value }))}
                  placeholder="Optional default string or value"
                  className="w-full px-3.5 py-2.5 bg-canvas border border-line rounded-xl text-xs text-ink placeholder:text-ink-faint focus:border-brand-500 focus:outline-none shadow-2xs"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-line-subtle">
              <Button variant="ghost" size="sm" onClick={() => setShowCreate(false)}>Cancel</Button>
              <Button variant="primary" size="sm" onClick={handleCreate} disabled={!form.label}>Create Field</Button>
            </div>
          </div>
        </div>
      )}

      {/* Attach Modal */}
      {attachFieldId && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4" onClick={() => setAttachFieldId(null)}>
          <div className="bg-surface border border-line rounded-2xl p-6 w-full max-w-sm shadow-xl space-y-4" onClick={e => e.stopPropagation()}>
            <h2 className="text-sm font-bold uppercase tracking-wider text-ink">Attach Field to Boards</h2>
            <div className="space-y-1.5 max-h-60 overflow-y-auto">
              {boards.map(board => (
                <label key={board.id} className="flex items-center gap-2.5 px-3 py-2 hover:bg-hover rounded-xl cursor-pointer transition-colors">
                  <input
                    type="checkbox"
                    checked={selectedBoards.includes(board.id)}
                    onChange={e => {
                      setSelectedBoards(prev => e.target.checked ? [...prev, board.id] : prev.filter(id => id !== board.id));
                    }}
                    className="rounded border-line text-brand-600 focus:ring-brand-500"
                  />
                  <span className="text-xs font-semibold text-ink">{board.name}</span>
                </label>
              ))}
              {boards.length === 0 && <p className="text-xs text-ink-muted">No boards available</p>}
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-line-subtle">
              <Button variant="ghost" size="sm" onClick={() => setAttachFieldId(null)}>Cancel</Button>
              <Button variant="primary" size="sm" onClick={handleAttach} disabled={selectedBoards.length === 0}>Attach</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
