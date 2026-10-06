import { useState, useEffect } from 'react';
import {
  Sparkles,
  Play,
  Copy,
  Check,
  ChevronDown,
  Code2,
  FileText,
  History,
  Thermometer,
  Cpu,
  BookOpen,
} from 'lucide-react';
import { api } from '../lib/api';
import { cn } from '../lib/utils';
import { Button } from '../components/ui/Button';
import { Spinner } from '../components/ui/States';

/* ──────────────────────── Types ──────────────────────── */

interface PromptTemplate {
  id: string;
  name: string;
  version: string;
  description: string;
  category: string;
  models: string[];
  temperature: number;
  maxTokens: number;
  variables: { name: string; description: string; required: boolean }[];
  changelog: { version: string; date: string; changes: string }[];
  systemPrompt?: string;
  fewShotExamples?: { input: string; output: string }[];
}

/* ──────────────────────── API ──────────────────────── */

const promptApi = {
  list: () => api._request<{ count: number; templates: PromptTemplate[] }>('/prompts'),
  get: (id: string) => api._request<PromptTemplate>(`/prompts/${id}`),
  render: (templateId: string, variables: Record<string, string>) =>
    api._request<{ rendered: string; model: string; temperature: number; maxTokens: number }>(
      '/prompts/render',
      { method: 'POST', body: JSON.stringify({ templateId, variables }) },
    ),
  test: (templateId: string, variables: Record<string, string>) =>
    api._request<{ renderedPrompt: string; fewShotExamples: any[]; note: string }>(
      '/prompts/test',
      { method: 'POST', body: JSON.stringify({ templateId, variables }) },
    ),
};

/* ──────────────────────── Category styling ──────────────────────── */

const categoryStyles: Record<string, { color: string; bg: string; icon: typeof Code2 }> = {
  'code-review': { color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-500/15', icon: FileText },
  'refactoring': { color: 'text-purple-600 dark:text-purple-400', bg: 'bg-purple-500/15', icon: Code2 },
  'bug-detection': { color: 'text-rose-600 dark:text-rose-400', bg: 'bg-rose-500/15', icon: Sparkles },
  'code-completion': { color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-500/15', icon: Code2 },
  'code-explanation': { color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-500/15', icon: BookOpen },
};

/* ──────────────────────── Main ──────────────────────── */

export function PromptPlayground() {
  const [templates, setTemplates] = useState<PromptTemplate[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [fullTemplate, setFullTemplate] = useState<PromptTemplate | null>(null);
  const [variables, setVariables] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [rendering, setRendering] = useState(false);
  const [rendered, setRendered] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<any>(null);
  const [copied, setCopied] = useState(false);
  const [activePanel, setActivePanel] = useState<'prompt' | 'examples' | 'changelog' | 'benchmark'>('prompt');

  // Load template list
  useEffect(() => {
    promptApi.list()
      .then(d => {
        setTemplates(d.templates);
        if (d.templates.length > 0) setSelectedId(d.templates[0].id);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  // Load full template when selected
  useEffect(() => {
    if (!selectedId) return;
    promptApi.get(selectedId).then(t => {
      setFullTemplate(t);
      const vars: Record<string, string> = {};
      t.variables.forEach(v => { vars[v.name] = ''; });
      setVariables(vars);
      setRendered(null);
      setTestResult(null);
    });
  }, [selectedId]);

  const handleRender = async () => {
    if (!selectedId) return;
    setRendering(true);
    try {
      const data = await promptApi.render(selectedId, variables);
      setRendered(data.rendered);
    } catch { /* ignore */ }
    setRendering(false);
  };

  const handleTest = async () => {
    if (!selectedId) return;
    setRendering(true);
    try {
      const data = await promptApi.test(selectedId, variables);
      setTestResult(data);
      setRendered(data.renderedPrompt);
    } catch { /* ignore */ }
    setRendering(false);
  };

  const handleCopy = () => {
    if (rendered) {
      navigator.clipboard.writeText(rendered);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Spinner className="w-8 h-8" />
      </div>
    );
  }

  return (
    <div className="nexus-page space-y-6">
      {/* ── Header ── */}
      <div>
        <h1 className="text-2xl font-bold text-ink flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-white shadow-xs">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          Prompt Engineering Lab
        </h1>
        <p className="text-ink-muted mt-1 text-sm">
          Structured prompt templates for AI-powered code understanding, review, and refactoring
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* ── Left: Template selector + Variables ── */}
        <div className="lg:col-span-4 space-y-4">
          {/* Template cards */}
          <div className="bg-surface rounded-xl border border-line p-4 shadow-2xs">
            <h2 className="text-xs font-bold uppercase tracking-wider text-ink mb-3">Prompt Templates</h2>
            <div className="space-y-2">
              {templates.map(t => {
                const style = categoryStyles[t.category] || { color: 'text-ink-muted', bg: 'bg-inset', icon: FileText };
                const isActive = selectedId === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => setSelectedId(t.id)}
                    className={cn(
                      'w-full flex items-start gap-3 px-3 py-2.5 rounded-xl text-left transition-all border shadow-2xs',
                      isActive
                        ? 'bg-brand-500/15 border-brand-500 ring-1 ring-brand-500/40'
                        : 'bg-surface border-line hover:border-line-strong hover:bg-hover',
                    )}
                  >
                    <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 shadow-2xs', style.bg)}>
                      <style.icon className={cn('w-4 h-4', style.color)} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-ink">{t.name}</span>
                        <span className="text-[10px] text-ink-faint font-mono font-semibold">v{t.version}</span>
                      </div>
                      <p className="text-[11px] text-ink-muted line-clamp-2 mt-0.5 leading-relaxed">{t.description}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Variable inputs */}
          {fullTemplate && (
            <div className="bg-surface rounded-xl border border-line p-4 space-y-3 shadow-2xs">
              <h2 className="text-xs font-bold uppercase tracking-wider text-ink mb-2">Variables</h2>
              <div className="space-y-3">
                {fullTemplate.variables.map(v => (
                  <div key={v.name}>
                    <label className="flex items-center gap-1 text-xs font-bold text-ink mb-1">
                      <span className="font-mono">{`{{${v.name}}}`}</span>
                      {v.required && <span className="text-rose-500">*</span>}
                    </label>
                    <p className="text-[10px] text-ink-muted mb-1">{v.description}</p>
                    {v.name === 'code' || v.name === 'context' ? (
                      <textarea
                        value={variables[v.name] || ''}
                        onChange={e => setVariables({ ...variables, [v.name]: e.target.value })}
                        rows={5}
                        className="w-full px-3 py-2 bg-canvas border border-line rounded-xl text-xs text-ink font-mono placeholder:text-ink-faint focus:border-brand-500 focus:outline-none resize-y shadow-2xs"
                        placeholder={`Enter ${v.name}…`}
                      />
                    ) : (
                      <input
                        type="text"
                        value={variables[v.name] || ''}
                        onChange={e => setVariables({ ...variables, [v.name]: e.target.value })}
                        className="w-full px-3.5 py-2 bg-canvas border border-line rounded-xl text-xs text-ink placeholder:text-ink-faint focus:border-brand-500 focus:outline-none shadow-2xs"
                        placeholder={v.name === 'language' ? 'e.g., TypeScript' : `Enter ${v.name}…`}
                      />
                    )}
                  </div>
                ))}
              </div>

              <div className="flex gap-2 pt-2">
                <Button variant="primary" size="sm" onClick={handleRender} disabled={rendering} className="flex-1 gap-2">
                  <Play className="w-3.5 h-3.5" />
                  Render Prompt
                </Button>
                <Button variant="secondary" size="sm" onClick={handleTest} disabled={rendering} className="flex-1 gap-2">
                  <Cpu className="w-3.5 h-3.5" />
                  Test
                </Button>
              </div>
            </div>
          )}

          {/* Template metadata */}
          {fullTemplate && (
            <div className="bg-surface rounded-xl border border-line p-4 shadow-2xs">
              <h2 className="text-xs font-bold uppercase tracking-wider text-ink mb-3">Configuration</h2>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-inset rounded-lg p-2.5 border border-line-subtle">
                  <div className="flex items-center gap-1 text-2xs font-bold uppercase tracking-wider text-ink-muted mb-1">
                    <Thermometer className="w-3 h-3" /> Temperature
                  </div>
                  <div className="text-ink font-bold text-sm">{fullTemplate.temperature}</div>
                </div>
                <div className="bg-inset rounded-lg p-2.5 border border-line-subtle">
                  <div className="text-2xs font-bold uppercase tracking-wider text-ink-muted mb-1">Max Tokens</div>
                  <div className="text-ink font-bold text-sm">{fullTemplate.maxTokens.toLocaleString()}</div>
                </div>
              </div>
              <div className="mt-3">
                <div className="text-2xs font-bold uppercase tracking-wider text-ink-muted mb-1.5">Recommended Models</div>
                <div className="flex flex-wrap gap-1">
                  {fullTemplate.models.map(m => (
                    <span key={m} className="text-[10px] px-2 py-0.5 bg-inset border border-line-subtle text-ink font-mono font-semibold rounded-md">{m}</span>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Right: Rendered output ── */}
        <div className="lg:col-span-8 space-y-4">
          {/* Sub-tabs */}
          {fullTemplate && (
            <div className="flex gap-1.5 bg-inset/50 rounded-xl border border-line p-1.5 shadow-2xs">
              {[
                { id: 'prompt' as const, label: 'System Prompt', icon: FileText },
                { id: 'examples' as const, label: 'Few-Shot Examples', icon: BookOpen },
                { id: 'changelog' as const, label: 'Version History', icon: History },
                { id: 'benchmark' as const, label: 'Model Benchmarks', icon: Cpu },
              ].map(t => (
                <button
                  key={t.id}
                  onClick={() => setActivePanel(t.id)}
                  className={cn(
                    'flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all flex-1 justify-center',
                    activePanel === t.id
                      ? 'bg-surface text-brand-600 dark:text-brand-400 shadow-2xs border border-line-subtle'
                      : 'text-ink-muted hover:text-ink hover:bg-hover',
                  )}
                >
                  <t.icon className="w-3.5 h-3.5" />
                  {t.label}
                </button>
              ))}
            </div>
          )}

          {/* Panel content */}
          {fullTemplate && activePanel === 'prompt' && (
            <div className="bg-surface rounded-xl border border-line overflow-hidden shadow-2xs">
              <div className="flex items-center justify-between px-4 py-3 bg-inset/40 border-b border-line">
                <span className="text-xs font-bold text-ink">
                  {rendered ? 'Rendered Prompt' : 'System Prompt Template'}
                </span>
                {rendered && (
                  <button onClick={handleCopy} className="flex items-center gap-1.5 text-xs font-bold text-brand-600 dark:text-brand-400 hover:underline">
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                    {copied ? 'Copied!' : 'Copy Prompt'}
                  </button>
                )}
              </div>
              <pre className="p-4 text-xs font-mono text-ink bg-canvas whitespace-pre-wrap leading-relaxed max-h-[600px] overflow-y-auto">
                {rendered || fullTemplate.systemPrompt || 'Select a template to see its system prompt'}
              </pre>
            </div>
          )}

          {fullTemplate && activePanel === 'examples' && (
            <div className="space-y-4">
              {(fullTemplate.fewShotExamples || []).map((ex, i) => (
                <div key={i} className="bg-surface rounded-xl border border-line overflow-hidden shadow-2xs">
                  <div className="px-4 py-3 bg-inset/40 border-b border-line flex items-center gap-2">
                    <span className="text-xs font-bold text-ink">Example {i + 1}</span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-line">
                    <div className="p-4 bg-canvas">
                      <div className="text-2xs text-ink-muted font-bold uppercase tracking-wider mb-2">Input</div>
                      <pre className="text-xs font-mono text-ink whitespace-pre-wrap leading-relaxed">{ex.input}</pre>
                    </div>
                    <div className="p-4 bg-canvas">
                      <div className="text-2xs text-emerald-600 dark:text-emerald-400 font-bold uppercase tracking-wider mb-2">Expected Output</div>
                      <pre className="text-xs font-mono text-ink whitespace-pre-wrap leading-relaxed">{ex.output}</pre>
                    </div>
                  </div>
                </div>
              ))}
              {(fullTemplate.fewShotExamples || []).length === 0 && (
                <div className="bg-surface rounded-xl border border-line p-8 text-center text-ink-muted text-xs shadow-2xs">
                  No few-shot examples for this template
                </div>
              )}
            </div>
          )}

          {fullTemplate && activePanel === 'changelog' && (
            <div className="bg-surface rounded-xl border border-line p-5 shadow-2xs">
              <div className="space-y-4">
                {fullTemplate.changelog.map((entry, i) => (
                  <div key={i} className="flex gap-4">
                    <div className="flex flex-col items-center">
                      <div className={cn(
                        'w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shadow-2xs border',
                        i === 0 ? 'bg-brand-500/15 border-brand-500 text-brand-700 dark:text-brand-300' : 'bg-inset border-line text-ink-muted',
                      )}>
                        v{entry.version}
                      </div>
                      {i < fullTemplate.changelog.length - 1 && (
                        <div className="w-px h-full bg-line my-1" />
                      )}
                    </div>
                    <div className="pb-4">
                      <div className="text-2xs text-ink-muted font-mono font-semibold">{entry.date}</div>
                      <p className="text-xs text-ink font-medium mt-1">{entry.changes}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {fullTemplate && activePanel === 'benchmark' && (
            <div className="bg-surface rounded-xl border border-line p-6 space-y-6 shadow-2xs">
              <div>
                <h3 className="text-sm font-bold text-ink mb-1">Code Model Capabilities Matrix</h3>
                <p className="text-xs text-ink-muted">
                  Empirical benchmarks (HumanEval, MBPP) & deployment profiles across supported AI models
                </p>
              </div>

              {/* Matrix Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-line text-2xs font-bold text-ink-muted uppercase">
                      <th className="pb-3 text-left">Model Name</th>
                      <th className="pb-3 text-center">HumanEval (Pass@1)</th>
                      <th className="pb-3 text-center">Context</th>
                      <th className="pb-3 text-left">Ideal Use Case</th>
                      <th className="pb-3 text-right">Hosting</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line-subtle">
                    {[
                      { name: 'Claude 3.5 Sonnet', score: '92.0%', num: 92, context: '200k', use: 'Multi-agent production chains & architecture', host: 'Cloud API', color: 'bg-indigo-500' },
                      { name: 'GPT-4o', score: '90.2%', num: 90, context: '128k', use: 'Real-time interactive chat & security auditing', host: 'Cloud API', color: 'bg-emerald-500' },
                      { name: 'DeepSeek Coder V2', score: '90.2%', num: 90, context: '128k', use: 'High-volume automated CI code reviews', host: 'Self-Hosted / Cloud', color: 'bg-blue-500' },
                      { name: 'Code Llama 34B', score: '62.2%', num: 62, context: '100k', use: 'Air-gapped on-premise code refactoring', host: 'Local GPU / Ollama', color: 'bg-amber-500' },
                      { name: 'StarCoder2 15B', score: '46.3%', num: 46, context: '16k', use: 'Fast IDE fill-in-the-middle completion', host: 'Local / Edge', color: 'bg-purple-500' },
                    ].map((m, idx) => (
                      <tr key={idx} className="hover:bg-hover transition-colors">
                        <td className="py-3 font-bold text-ink font-mono">{m.name}</td>
                        <td className="py-3 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <div className="w-16 h-1.5 bg-inset rounded-full overflow-hidden border border-line-subtle">
                              <div className={cn('h-full rounded-full', m.color)} style={{ width: `${m.num}%` }} />
                            </div>
                            <span className="font-mono text-ink font-bold text-2xs">{m.score}</span>
                          </div>
                        </td>
                        <td className="py-3 text-center text-ink-muted font-mono">{m.context}</td>
                        <td className="py-3 text-ink-muted">{m.use}</td>
                        <td className="py-3 text-right">
                          <span className="px-2 py-0.5 rounded-full bg-inset border border-line text-[10px] font-semibold text-ink-muted">
                            {m.host}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Parameter Guidance */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-line pt-4">
                <div className="bg-inset rounded-xl p-3.5 border border-line-subtle">
                  <h4 className="text-xs font-bold text-brand-600 dark:text-brand-400 mb-1">Temperature Thresholds</h4>
                  <ul className="text-2xs text-ink-muted space-y-1">
                    <li>• <strong className="text-ink">0.1 - 0.2:</strong> Bug detection & deterministic completion</li>
                    <li>• <strong className="text-ink">0.3:</strong> Structured code review & quality evaluation</li>
                    <li>• <strong className="text-ink">0.4 - 0.5:</strong> Refactoring patterns & architectural explanation</li>
                  </ul>
                </div>
                <div className="bg-inset rounded-xl p-3.5 border border-line-subtle">
                  <h4 className="text-xs font-bold text-brand-600 dark:text-brand-400 mb-1">In-Context Learning</h4>
                  <p className="text-2xs text-ink-muted leading-relaxed">
                    Small models (&lt;34B) require 2–3 explicit few-shot examples to maintain strict formatting. Frontier models (Claude/GPT-4o) succeed zero-shot with clear role prompts.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Live AI Execution Output */}
          {testResult?.output && (
            <div className="bg-surface rounded-xl border border-brand-500/30 overflow-hidden shadow-xs animate-fade-in">
              <div className="flex items-center justify-between px-4 py-3 bg-brand-500/10 border-b border-brand-500/20">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-xs font-bold text-ink">
                    AI Execution Output ({testResult.model || 'LLM Engine'})
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(testResult.output);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  }}
                  className="flex items-center gap-1.5 text-xs font-bold text-brand-600 dark:text-brand-400 hover:underline cursor-pointer"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied ? 'Copied Output' : 'Copy Output'}
                </button>
              </div>
              <pre className="p-4 text-xs font-mono text-ink bg-canvas whitespace-pre-wrap leading-relaxed max-h-[500px] overflow-y-auto">
                {testResult.output}
              </pre>
            </div>
          )}

          {/* Test result note */}
          {testResult?.note && (
            <div className="bg-brand-500/10 border border-brand-500/20 rounded-xl p-3.5 text-xs font-medium text-ink flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-brand-500 shrink-0" />
                <span>{testResult.note}</span>
              </div>
              {testResult.model && (
                <span className="px-2 py-0.5 rounded-md bg-inset border border-line text-[10px] font-mono text-ink-muted shrink-0">
                  {testResult.model}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
