import { useState, useEffect } from 'react';
import { api } from '../lib/api';
import type { SoulTemplate } from '../types';
import { Sparkles, Plus, Search, Trash2, BookOpen, Layers } from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';
import { Button } from '../components/ui/Button';
import { CustomSelect } from '../components/ui/CustomSelect';
import { HourglassLoader } from '../components/ui/HourglassLoader';
import { cn } from '../lib/utils';

export function SoulTemplates() {
  const [templates, setTemplates] = useState<SoulTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<SoulTemplate | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: '', category: 'general', description: '', content: '' });

  useEffect(() => {
    api.soulTemplates.list().then(data => {
      setTemplates(data);
      if (data.length > 0) setSelectedTemplate(data[0]);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  async function handleSearch() {
    if (!search.trim()) {
      const data = await api.soulTemplates.list();
      setTemplates(data);
      return;
    }
    const data = await api.soulTemplates.search(search);
    setTemplates(data);
  }

  async function handleCreate() {
    const template = await api.soulTemplates.create(form);
    setTemplates(prev => [...prev, template]);
    setSelectedTemplate(template);
    setShowCreate(false);
    setForm({ name: '', category: 'general', description: '', content: '' });
  }

  async function handleDelete(id: string) {
    if (!confirm('Are you sure you want to delete this template?')) return;
    await api.soulTemplates.delete(id);
    setTemplates(prev => prev.filter(t => t.id !== id));
    if (selectedTemplate?.id === id) setSelectedTemplate(null);
  }

  const categories = [...new Set(templates.map(t => t.category))].sort();

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <HourglassLoader size={48} label="Loading soul templates..." />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Sparkles}
        title="Soul Templates"
        description="Predefined system personas, operating constraints, and instructions for autonomous agents"
        actions={
          <Button
            variant="primary"
            icon={Plus}
            onClick={() => setShowCreate(true)}
          >
            Create Template
          </Button>
        }
      />

      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-muted" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
            placeholder="Search templates by name, keyword, or capability..."
            className="w-full pl-10 pr-4 py-2.5 bg-inset border border-line rounded-xl text-xs text-ink placeholder:text-ink-muted focus:border-brand-500 focus:outline-none shadow-2xs"
          />
        </div>
        <Button variant="secondary" onClick={handleSearch}>Search</Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-4 space-y-4">
          <div className="bg-surface rounded-2xl border border-line p-4 shadow-2xs space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-ink">Template Directory</h3>
            {categories.map(cat => (
              <div key={cat} className="space-y-1.5 pt-1">
                <p className="text-2xs font-bold text-ink-muted uppercase tracking-wider px-1">{cat}</p>
                {templates.filter(t => t.category === cat).map(template => (
                  <button
                    key={template.id}
                    onClick={() => setSelectedTemplate(template)}
                    className={cn(
                      'w-full text-left px-3.5 py-2.5 rounded-xl text-xs transition-all border shadow-2xs cursor-pointer',
                      selectedTemplate?.id === template.id
                        ? 'bg-brand-500/10 border-brand-500 text-brand-700 dark:text-brand-300 ring-1 ring-brand-500/30'
                        : 'bg-surface border-line text-ink-muted hover:text-ink hover:border-line-strong',
                    )}
                  >
                    <p className="font-bold text-ink truncate">{template.name}</p>
                    {template.description && <p className="text-2xs text-ink-muted truncate mt-0.5">{template.description}</p>}
                  </button>
                ))}
              </div>
            ))}
            {templates.length === 0 && <p className="text-xs text-ink-muted p-2">No templates found</p>}
          </div>
        </div>

        <div className="lg:col-span-8">
          {selectedTemplate ? (
            <div className="bg-surface border border-line rounded-2xl p-6 shadow-2xs space-y-4">
              <div className="flex items-start justify-between gap-3 border-b border-line pb-4">
                <div>
                  <h2 className="text-lg font-bold text-ink">{selectedTemplate.name}</h2>
                  <p className="text-xs text-ink-muted mt-0.5 font-mono capitalize">{selectedTemplate.category} • {selectedTemplate.slug}</p>
                </div>
                <Button
                  variant="ghost"
                  size="xs"
                  className="text-rose-600 hover:bg-rose-500/10"
                  icon={Trash2}
                  onClick={() => handleDelete(selectedTemplate.id)}
                >
                  Delete
                </Button>
              </div>
              {selectedTemplate.description && (
                <p className="text-xs text-ink-muted leading-relaxed font-medium">{selectedTemplate.description}</p>
              )}
              <div>
                <label className="block text-2xs font-bold uppercase tracking-wider text-ink-muted mb-2">SOUL Instructions (SOUL.md)</label>
                <pre className="bg-inset border border-line rounded-xl p-4 text-xs font-mono text-ink leading-relaxed overflow-auto max-h-[500px] whitespace-pre-wrap shadow-2xs">
                  {selectedTemplate.content}
                </pre>
              </div>
            </div>
          ) : (
            <div className="bg-surface border border-line rounded-2xl p-12 text-center text-xs text-ink-muted shadow-2xs">
              Select a template to preview its operating instructions
            </div>
          )}
        </div>
      </div>

      {showCreate && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4" onClick={() => setShowCreate(false)}>
          <div className="bg-surface border border-line rounded-3xl p-6 w-full max-w-lg shadow-2xl space-y-4" onClick={e => e.stopPropagation()}>
            <h2 className="text-sm font-bold uppercase tracking-wider text-ink">Create Soul Template</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-2xs font-bold uppercase tracking-wider text-ink-muted mb-1">Template Name</label>
                <input
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. SRE Incident Commander"
                  className="w-full px-3.5 py-2 bg-inset border border-line rounded-xl text-xs text-ink placeholder:text-ink-muted focus:border-brand-500 focus:outline-none shadow-2xs"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-2xs font-bold uppercase tracking-wider text-ink-muted mb-1">Category</label>
                  <CustomSelect
                    value={form.category}
                    onChange={val => setForm(f => ({ ...f, category: val }))}
                    options={[
                      { value: 'general', label: 'General' },
                      { value: 'coding', label: 'Coding' },
                      { value: 'research', label: 'Research' },
                      { value: 'support', label: 'Support' },
                      { value: 'creative', label: 'Creative' },
                    ]}
                  />
                </div>
                <div>
                  <label className="block text-2xs font-bold uppercase tracking-wider text-ink-muted mb-1">Brief Description</label>
                  <input
                    value={form.description}
                    onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                    placeholder="Short summary of role"
                    className="w-full px-3.5 py-2 bg-inset border border-line rounded-xl text-xs text-ink placeholder:text-ink-muted focus:border-brand-500 focus:outline-none shadow-2xs"
                  />
                </div>
              </div>
              <div>
                <label className="block text-2xs font-bold uppercase tracking-wider text-ink-muted mb-1">Soul Markdown Instructions</label>
                <textarea
                  value={form.content}
                  onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
                  placeholder="# Agent Role&#10;&#10;Instructions, boundaries, output rules..."
                  rows={8}
                  className="w-full px-3.5 py-2 bg-inset border border-line rounded-xl text-xs text-ink font-mono placeholder:text-ink-muted focus:border-brand-500 focus:outline-none resize-none shadow-2xs"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-line-subtle">
              <Button variant="ghost" size="sm" onClick={() => setShowCreate(false)}>Cancel</Button>
              <Button variant="primary" size="sm" onClick={handleCreate} disabled={!form.name || !form.content}>Create Template</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

