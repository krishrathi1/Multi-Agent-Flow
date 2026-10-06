import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  Code2,
  Search,
  GitBranch,
  FileCode2,
  BarChart3,
  RefreshCw,
  FileText,
  ArrowRight,
  Filter,
  ChevronRight,
  X,
  Box,
  ExternalLink,
  Bot,
  Sparkles,
  Send,
} from 'lucide-react';
import { api } from '../lib/api';
import { cn } from '../lib/utils';
import { Button } from '../components/ui/Button';
import { EmptyState, Spinner } from '../components/ui/States';

/* ──────────────────────── Types ──────────────────────── */

interface SearchResult {
  file: string;
  line: number;
  column: number;
  content: string;
  matchStart: number;
  matchEnd: number;
  context: { before: string[]; after: string[] };
}

interface CodeSymbol {
  name: string;
  kind: string;
  file: string;
  line: number;
  exported: boolean;
  signature?: string;
}

interface GraphNode {
  id: string;
  group: string;
  lineCount: number;
  symbolCount: number;
}

interface GraphEdge {
  source: string;
  target: string;
}

interface CodebaseStats {
  totalFiles: number;
  totalLines: number;
  totalBytes: number;
  languages: Record<string, number>;
  directories: Record<string, number>;
  avgFileSize: number;
  largestFiles: { path: string; lines: number; bytes: number }[];
}

interface FileContent {
  relativePath: string;
  language: string;
  content: string;
  lineCount: number;
  symbols: CodeSymbol[];
}

type TabId = 'search' | 'graph' | 'symbols' | 'overview' | 'ask';

/* ──────────────────────── API helpers ──────────────────────── */

const codeIntelApi = {
  search: (q: string, opts?: { file?: string; language?: string; regex?: boolean }) =>
    api._request<{ query: string; count: number; results: SearchResult[] }>(
      `/code-intelligence/search?q=${encodeURIComponent(q)}${opts?.file ? `&file=${encodeURIComponent(opts.file)}` : ''}${opts?.language ? `&language=${encodeURIComponent(opts.language)}` : ''}${opts?.regex ? '&regex=true' : ''}`
    ),
  symbols: (opts?: { kind?: string; q?: string; file?: string }) =>
    api._request<{ count: number; symbols: CodeSymbol[] }>(
      `/code-intelligence/symbols?${opts?.kind ? `kind=${opts.kind}&` : ''}${opts?.q ? `q=${encodeURIComponent(opts.q)}&` : ''}${opts?.file ? `file=${encodeURIComponent(opts.file)}` : ''}`
    ),
  graph: () => api._request<{ nodes: GraphNode[]; edges: GraphEdge[] }>('/code-intelligence/graph'),
  stats: () => api._request<CodebaseStats>('/code-intelligence/stats'),
  file: (path: string) => api._request<FileContent>(`/code-intelligence/file/${path}`),
  references: (symbol: string) =>
    api._request<{ symbol: string; count: number; imports: any[]; usages: any[] }>(
      `/code-intelligence/references/${encodeURIComponent(symbol)}`
    ),
  ask: (question: string, model?: string) =>
    api._request<{ question: string; answer: string; citations: { file: string; line?: number; reason: string }[]; relatedSymbols: CodeSymbol[] }>(
      '/code-intelligence/ask',
      { method: 'POST', body: JSON.stringify({ question, model }) }
    ),
  reindex: () => api._request<{ message: string; stats: CodebaseStats }>('/code-intelligence/reindex', { method: 'POST' }),
};

/* ──────────────────────── Tabs ──────────────────────── */

const tabs: { id: TabId; label: string; icon: typeof Search }[] = [
  { id: 'search', label: 'Semantic Search', icon: Search },
  { id: 'graph', label: 'Code Graph', icon: GitBranch },
  { id: 'symbols', label: 'Symbol Explorer', icon: Code2 },
  { id: 'overview', label: 'Codebase Overview', icon: BarChart3 },
  { id: 'ask', label: 'Repo Q&A (AI Assistant)', icon: Bot },
];

/* ──────────────────────── Helpers ──────────────────────── */

const kindColors: Record<string, string> = {
  function: 'text-blue-600 dark:text-blue-400 bg-blue-500/10 border-blue-500/20',
  class: 'text-amber-600 dark:text-amber-400 bg-amber-500/10 border-amber-500/20',
  interface: 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  type: 'text-purple-600 dark:text-purple-400 bg-purple-500/10 border-purple-500/20',
  enum: 'text-cyan-600 dark:text-cyan-400 bg-cyan-500/10 border-cyan-500/20',
  const: 'text-orange-600 dark:text-orange-400 bg-orange-500/10 border-orange-500/20',
  variable: 'text-slate-600 dark:text-slate-400 bg-slate-500/10 border-slate-500/20',
  export: 'text-teal-600 dark:text-teal-400 bg-teal-500/10 border-teal-500/20',
};

const groupColors: Record<string, string> = {
  backend: '#5367FF',
  frontend: '#00D09C',
  prisma: '#06B6D4',
  e2e: '#F59E0B',
  dashboards: '#EF4444',
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function highlightMatch(text: string, start: number, end: number): React.ReactElement {
  return (
    <span>
      <span className="text-ink-muted">{text.slice(0, start)}</span>
      <span className="bg-brand-500/25 text-brand-700 dark:text-brand-300 font-bold rounded px-1">{text.slice(start, end)}</span>
      <span className="text-ink-muted">{text.slice(end)}</span>
    </span>
  );
}

/* ──────────────────────── Main Component ──────────────────────── */

export function CodeIntelligence() {
  const [activeTab, setActiveTab] = useState<TabId>('search');
  const [reindexing, setReindexing] = useState(false);

  const handleReindex = async () => {
    setReindexing(true);
    try {
      await codeIntelApi.reindex();
    } catch { /* ignore */ }
    setReindexing(false);
  };

  return (
    <div className="nexus-page space-y-6">
      {/* ── Header ── */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-ink flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white shadow-xs">
              <Code2 className="w-5 h-5 text-white" />
            </div>
            Code Intelligence
          </h1>
          <p className="text-ink-muted mt-1 text-sm">Semantic code search, dependency graph, and symbol navigation</p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={handleReindex}
          disabled={reindexing}
          className="gap-2"
        >
          <RefreshCw className={cn('w-4 h-4', reindexing && 'animate-spin')} />
          {reindexing ? 'Indexing…' : 'Re-index Codebase'}
        </Button>
      </div>

      {/* ── Tab bar ── */}
      <div className="flex gap-1.5 p-1.5 bg-inset/50 rounded-xl border border-line overflow-x-auto shadow-2xs">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={cn(
              'flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-bold transition-all flex-1 justify-center whitespace-nowrap',
              activeTab === t.id
                ? 'bg-surface text-brand-600 dark:text-brand-400 shadow-2xs border border-line-subtle'
                : 'text-ink-muted hover:text-ink hover:bg-hover',
            )}
          >
            <t.icon className="w-4 h-4" />
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Tab content ── */}
      {activeTab === 'search' && <SearchTab />}
      {activeTab === 'graph' && <GraphTab />}
      {activeTab === 'symbols' && <SymbolsTab />}
      {activeTab === 'overview' && <OverviewTab />}
      {activeTab === 'ask' && <AskTab />}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   TAB 1: Semantic Search
   ═══════════════════════════════════════════════════════════ */

function SearchTab() {
  const [query, setQuery] = useState('');
  const [fileFilter, setFileFilter] = useState('');
  const [isRegex, setIsRegex] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [fileViewer, setFileViewer] = useState<{ path: string; highlightLine?: number } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const doSearch = useCallback(async () => {
    if (!query.trim()) return;
    setLoading(true);
    setSearched(true);
    try {
      const data = await codeIntelApi.search(query, { file: fileFilter || undefined, regex: isRegex });
      setResults(data.results);
    } catch {
      setResults([]);
    }
    setLoading(false);
  }, [query, fileFilter, isRegex]);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const grouped = useMemo(() => {
    const map = new Map<string, SearchResult[]>();
    for (const r of results) {
      const arr = map.get(r.file) || [];
      arr.push(r);
      map.set(r.file, arr);
    }
    return Array.from(map.entries());
  }, [results]);

  return (
    <div className="space-y-4">
      {/* Search bar */}
      <div className="bg-surface rounded-xl border border-line p-4 shadow-2xs">
        <div className="flex flex-wrap md:flex-nowrap gap-3">
          <div className="flex-1 relative min-w-[240px]">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-muted" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && doSearch()}
              placeholder="Search across codebase — try: createAgent, WebSocket, prisma.agent"
              className="w-full pl-10 pr-4 py-2.5 bg-canvas border border-line rounded-xl text-sm text-ink placeholder:text-ink-faint focus:border-brand-500 focus:outline-none shadow-2xs transition-colors"
            />
          </div>
          <div className="relative">
            <Filter className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-muted" />
            <input
              type="text"
              value={fileFilter}
              onChange={e => setFileFilter(e.target.value)}
              placeholder="File filter"
              className="w-48 pl-10 pr-4 py-2.5 bg-canvas border border-line rounded-xl text-sm text-ink placeholder:text-ink-faint focus:border-brand-500 focus:outline-none shadow-2xs transition-colors"
            />
          </div>
          <label className="flex items-center gap-2 px-3.5 bg-canvas border border-line rounded-xl text-xs font-semibold text-ink-muted cursor-pointer hover:border-line-strong transition-colors shadow-2xs">
            <input type="checkbox" checked={isRegex} onChange={() => setIsRegex(!isRegex)} className="accent-brand-500" />
            Regex
          </label>
          <Button variant="primary" size="sm" onClick={doSearch} disabled={loading}>
            {loading ? <Spinner className="w-4 h-4" /> : 'Search'}
          </Button>
        </div>
      </div>

      {/* Results */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className={cn('space-y-3', fileViewer ? 'lg:col-span-1' : 'lg:col-span-3')}>
          {loading && (
            <div className="flex items-center justify-center py-12">
              <Spinner className="w-8 h-8" />
            </div>
          )}

          {!loading && searched && results.length === 0 && (
            <EmptyState icon={Search} title="No results" description={`No matches found for "${query}"`} />
          )}

          {!loading && grouped.map(([file, fileResults]) => (
            <div key={file} className="bg-surface rounded-xl border border-line overflow-hidden shadow-2xs">
              <button
                onClick={() => setFileViewer({ path: file, highlightLine: fileResults[0]?.line })}
                className="w-full flex items-center gap-2 px-4 py-3 bg-inset/40 border-b border-line hover:bg-hover transition-colors text-left"
              >
                <FileCode2 className="w-4 h-4 text-brand-600 dark:text-brand-400 shrink-0" />
                <span className="text-xs font-bold text-ink font-mono truncate">{file}</span>
                <span className="ml-auto text-2xs font-semibold text-ink-muted">{fileResults.length} match{fileResults.length > 1 ? 'es' : ''}</span>
                <ExternalLink className="w-3 h-3 text-ink-muted" />
              </button>
              <div className="divide-y divide-line-subtle">
                {fileResults.map((r, i) => (
                  <button
                    key={i}
                    onClick={() => setFileViewer({ path: r.file, highlightLine: r.line })}
                    className="w-full flex items-start gap-3 px-4 py-2.5 hover:bg-hover transition-colors text-left"
                  >
                    <span className="text-2xs text-ink-muted font-mono w-8 shrink-0 text-right pt-0.5 font-semibold">
                      {r.line}
                    </span>
                    <code className="text-xs font-mono leading-relaxed break-all text-ink">
                      {highlightMatch(r.content, r.matchStart, r.matchEnd)}
                    </code>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* File viewer panel */}
        {fileViewer && (
          <div className="lg:col-span-2">
            <FileViewer
              path={fileViewer.path}
              highlightLine={fileViewer.highlightLine}
              onClose={() => setFileViewer(null)}
            />
          </div>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   TAB 2: Code Graph (Dependency Visualization)
   ═══════════════════════════════════════════════════════════ */

function GraphTab() {
  const [graph, setGraph] = useState<{ nodes: GraphNode[]; edges: GraphEdge[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [filter, setFilter] = useState('');

  useEffect(() => {
    codeIntelApi.graph().then(d => { setGraph(d); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  const filteredNodes = useMemo(() => {
    if (!graph) return [];
    return filter ? graph.nodes.filter(n => n.id.includes(filter)) : graph.nodes;
  }, [graph, filter]);

  const grouped = useMemo(() => {
    const map = new Map<string, GraphNode[]>();
    for (const n of filteredNodes) {
      const group = n.group;
      const arr = map.get(group) || [];
      arr.push(n);
      map.set(group, arr);
    }
    return Array.from(map.entries()).sort((a, b) => b[1].length - a[1].length);
  }, [filteredNodes]);

  if (loading) return <div className="flex items-center justify-center py-16"><Spinner className="w-8 h-8" /></div>;
  if (!graph) return <EmptyState icon={GitBranch} title="No graph data" description="Re-index the codebase to generate the dependency graph." />;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* Graph controls + directory listing */}
      <div className="lg:col-span-2 space-y-4">
        <div className="bg-surface rounded-xl border border-line p-4 shadow-2xs">
          <div className="flex items-center gap-3 mb-4">
            <input
              type="text"
              value={filter}
              onChange={e => setFilter(e.target.value)}
              placeholder="Filter files…"
              className="flex-1 px-3.5 py-2 bg-canvas border border-line rounded-xl text-xs font-mono text-ink placeholder:text-ink-faint focus:border-brand-500 focus:outline-none shadow-2xs"
            />
            <div className="text-2xs font-semibold text-ink-muted whitespace-nowrap">
              {filteredNodes.length} files · {graph.edges.length} dependencies
            </div>
          </div>

          <div className="space-y-4">
            {grouped.map(([group, nodes]) => {
              const color = groupColors[group] || '#6B7280';
              return (
                <div key={group} className="space-y-1.5">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
                    <span className="text-xs font-bold text-ink uppercase tracking-wider">{group}/</span>
                    <span className="text-2xs text-ink-muted">({nodes.length} files)</span>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-1.5 pl-3">
                    {nodes.sort((a, b) => b.lineCount - a.lineCount).slice(0, 24).map(n => {
                      const name = n.id.split('/').pop() || n.id;
                      const relPath = n.id.split('/').slice(1).join('/');
                      const isSelected = selectedNode?.id === n.id;
                      const maxLines = Math.max(...nodes.map(x => x.lineCount), 1);
                      const pct = Math.max(8, (n.lineCount / maxLines) * 100);
                      return (
                        <button
                          key={n.id}
                          onClick={() => setSelectedNode(isSelected ? null : n)}
                          className={cn(
                            'relative flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left transition-all text-xs border shadow-2xs',
                            isSelected
                              ? 'bg-brand-500/15 border-brand-500 text-brand-700 dark:text-brand-300 ring-1 ring-brand-500'
                              : 'bg-surface border-line text-ink-muted hover:text-ink hover:border-line-strong',
                          )}
                        >
                          <div
                            className="absolute bottom-0 left-0 h-0.5 rounded-full opacity-40"
                            style={{ width: `${pct}%`, backgroundColor: color }}
                          />
                          <FileText className="w-3 h-3 shrink-0" style={{ color }} />
                          <span className="truncate font-mono text-[11px]" title={relPath}>{name}</span>
                          <span className="ml-auto text-[10px] text-ink-faint font-semibold">{n.lineCount}L</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Selected file detail panel */}
      <div className="space-y-4">
        {selectedNode ? (
          <div className="bg-surface rounded-xl border border-line p-4 space-y-4 shadow-2xs">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-ink">File Details</h3>
              <button onClick={() => setSelectedNode(null)} className="text-ink-muted hover:text-ink"><X className="w-4 h-4" /></button>
            </div>
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <FileCode2 className="w-4 h-4 text-brand-600 dark:text-brand-400" />
                <span className="text-xs text-ink font-mono font-bold break-all">{selectedNode.id}</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-inset rounded-lg p-2.5 border border-line-subtle">
                  <div className="text-2xs font-bold text-ink-muted uppercase">Lines</div>
                  <div className="text-ink font-bold text-base">{selectedNode.lineCount.toLocaleString()}</div>
                </div>
                <div className="bg-inset rounded-lg p-2.5 border border-line-subtle">
                  <div className="text-2xs font-bold text-ink-muted uppercase">Symbols</div>
                  <div className="text-ink font-bold text-base">{selectedNode.symbolCount}</div>
                </div>
              </div>
              {/* Edges */}
              <div className="space-y-1 mt-3">
                <h4 className="text-2xs text-ink-faint font-bold uppercase tracking-wider">Dependencies</h4>
                {graph.edges
                  .filter(e => e.source === selectedNode.id)
                  .slice(0, 15)
                  .map((e, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs text-ink-muted py-0.5">
                      <ArrowRight className="w-3 h-3 text-brand-500" />
                      <span className="font-mono text-xs truncate">{e.target}</span>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-surface rounded-xl border border-line p-6 text-center shadow-2xs">
            <Box className="w-8 h-8 text-ink-faint mx-auto mb-2" />
            <p className="text-xs text-ink-muted">Click a file node to view its details and dependencies</p>
          </div>
        )}

        {/* Legend */}
        <div className="bg-surface rounded-xl border border-line p-4 shadow-2xs">
          <h3 className="text-2xs text-ink-faint font-bold uppercase tracking-wider mb-3">Module Legend</h3>
          <div className="space-y-2">
            {Object.entries(groupColors).map(([name, color]) => (
              <div key={name} className="flex items-center gap-2 text-xs text-ink-muted">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
                <span className="font-mono">{name}/</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   TAB 3: Symbol Explorer
   ═══════════════════════════════════════════════════════════ */

function SymbolsTab() {
  const [symbols, setSymbols] = useState<CodeSymbol[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [kindFilter, setKindFilter] = useState('');
  const [fileFilter, setFileFilter] = useState('');
  const [selectedSymbol, setSelectedSymbol] = useState<CodeSymbol | null>(null);
  const [references, setReferences] = useState<any | null>(null);
  const [loadingRefs, setLoadingRefs] = useState(false);

  useEffect(() => {
    setLoading(true);
    codeIntelApi.symbols({ kind: kindFilter || undefined, q: query || undefined, file: fileFilter || undefined })
      .then(d => { setSymbols(d.symbols); setLoading(false); })
      .catch(() => setLoading(false));
  }, [query, kindFilter, fileFilter]);

  const handleFindRefs = async (sym: CodeSymbol) => {
    setSelectedSymbol(sym);
    setLoadingRefs(true);
    try {
      const data = await codeIntelApi.references(sym.name);
      setReferences(data);
    } catch {
      setReferences(null);
    }
    setLoadingRefs(false);
  };

  const kinds = ['function', 'class', 'interface', 'type', 'enum', 'const'];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div className={cn('space-y-3', selectedSymbol ? 'lg:col-span-2' : 'lg:col-span-3')}>
        {/* Filters */}
        <div className="bg-surface rounded-xl border border-line p-4 shadow-2xs">
          <div className="flex gap-3 flex-wrap">
            <div className="flex-1 min-w-[200px] relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-muted" />
              <input
                type="text"
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Search symbols…"
                className="w-full pl-10 pr-4 py-2 bg-canvas border border-line rounded-xl text-xs font-mono text-ink placeholder:text-ink-faint focus:border-brand-500 focus:outline-none shadow-2xs"
              />
            </div>
            <div className="flex gap-1.5 flex-wrap">
              <button
                onClick={() => setKindFilter('')}
                className={cn('px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-2xs border',
                  !kindFilter ? 'bg-brand-500/15 border-brand-500 text-brand-700 dark:text-brand-300' : 'bg-surface border-line text-ink-muted hover:text-ink')}
              >
                All
              </button>
              {kinds.map(k => (
                <button
                  key={k}
                  onClick={() => setKindFilter(kindFilter === k ? '' : k)}
                  className={cn('px-3 py-1.5 rounded-lg text-xs font-bold transition-all capitalize shadow-2xs border',
                    kindFilter === k ? 'bg-brand-500/15 border-brand-500 text-brand-700 dark:text-brand-300' : 'bg-surface border-line text-ink-muted hover:text-ink')}
                >
                  {k}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Symbol table */}
        {loading ? (
          <div className="flex items-center justify-center py-12"><Spinner className="w-8 h-8" /></div>
        ) : (
          <div className="bg-surface rounded-xl border border-line overflow-hidden shadow-2xs">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-2xs font-bold text-ink-muted uppercase tracking-wider border-b border-line bg-inset/50">
                    <th className="px-4 py-3 text-left">Symbol</th>
                    <th className="px-4 py-3 text-left">Kind</th>
                    <th className="px-4 py-3 text-left">File</th>
                    <th className="px-4 py-3 text-center">Line</th>
                    <th className="px-4 py-3 text-center">Exported</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line-subtle">
                  {symbols.map((s, i) => (
                    <tr key={i} className="hover:bg-hover transition-colors">
                      <td className="px-4 py-2.5">
                        <span className="font-mono text-ink font-bold text-xs">{s.name}</span>
                      </td>
                      <td className="px-4 py-2.5">
                        <span className={cn('text-2xs px-2 py-0.5 rounded-full font-bold border capitalize', kindColors[s.kind] || 'text-ink-muted bg-inset')}>
                          {s.kind}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-ink-muted font-mono text-xs max-w-[300px] truncate">{s.file}</td>
                      <td className="px-4 py-2.5 text-center text-ink-muted font-mono text-xs">{s.line}</td>
                      <td className="px-4 py-2.5 text-center">
                        {s.exported ? <span className="text-emerald-600 dark:text-emerald-400 text-xs font-bold">✓</span> : <span className="text-ink-faint text-xs">—</span>}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <button
                          onClick={() => handleFindRefs(s)}
                          className="text-xs font-bold text-brand-600 dark:text-brand-400 hover:underline transition-colors"
                        >
                          Find refs
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {symbols.length === 0 && (
              <div className="py-8 text-center text-ink-muted text-xs">No symbols found</div>
            )}
          </div>
        )}
      </div>

      {/* References panel */}
      {selectedSymbol && (
        <div className="space-y-3">
          <div className="bg-surface rounded-xl border border-line p-4 shadow-2xs">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-ink">References</h3>
              <button onClick={() => { setSelectedSymbol(null); setReferences(null); }} className="text-ink-muted hover:text-ink"><X className="w-4 h-4" /></button>
            </div>
            <div className="flex items-center gap-2 mb-3">
              <span className={cn('text-2xs px-2 py-0.5 rounded-full font-bold border capitalize', kindColors[selectedSymbol.kind])}>
                {selectedSymbol.kind}
              </span>
              <span className="font-mono text-xs text-ink font-bold">{selectedSymbol.name}</span>
            </div>
            <div className="text-2xs text-ink-muted font-mono mb-4">{selectedSymbol.file}:{selectedSymbol.line}</div>

            {loadingRefs ? (
              <div className="flex items-center justify-center py-6"><Spinner className="w-6 h-6" /></div>
            ) : references ? (
              <div className="space-y-3">
                {references.imports.length > 0 && (
                  <div>
                    <h4 className="text-2xs text-ink-muted font-bold uppercase tracking-wider mb-2">Imports ({references.imports.length})</h4>
                    <div className="space-y-1">
                      {references.imports.slice(0, 20).map((r: any, i: number) => (
                        <div key={i} className="text-xs font-mono bg-inset rounded-lg px-3 py-1.5 text-ink-muted truncate border border-line-subtle">
                          <span className="text-brand-600 dark:text-brand-400 font-bold">{r.file}</span>
                          <span className="text-ink-faint">:{r.line}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {references.usages.length > 0 && (
                  <div>
                    <h4 className="text-2xs text-ink-muted font-bold uppercase tracking-wider mb-2">Usages ({references.usages.length})</h4>
                    <div className="space-y-1 max-h-[400px] overflow-y-auto">
                      {references.usages.slice(0, 30).map((r: any, i: number) => (
                        <div key={i} className="text-xs font-mono bg-inset rounded-lg px-3 py-1.5 text-ink-muted truncate border border-line-subtle">
                          <span className="text-brand-600 dark:text-brand-400 font-bold">{r.file}</span>
                          <span className="text-ink-faint">:{r.line}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {references.imports.length === 0 && references.usages.length === 0 && (
                  <p className="text-xs text-ink-muted text-center py-4">No references found</p>
                )}
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   TAB 4: Codebase Overview
   ═══════════════════════════════════════════════════════════ */

function OverviewTab() {
  const [stats, setStats] = useState<CodebaseStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    codeIntelApi.stats().then(d => { setStats(d); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex items-center justify-center py-16"><Spinner className="w-8 h-8" /></div>;
  if (!stats) return <EmptyState icon={BarChart3} title="No data" description="Re-index the codebase first." />;

  const langEntries = Object.entries(stats.languages).sort((a, b) => b[1] - a[1]);
  const dirEntries = Object.entries(stats.directories).sort((a, b) => b[1] - a[1]);
  const maxLang = Math.max(...langEntries.map(([, c]) => c), 1);
  const maxDir = Math.max(...dirEntries.map(([, c]) => c), 1);

  return (
    <div className="space-y-4">
      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Files', value: stats.totalFiles.toLocaleString(), color: 'text-blue-600 dark:text-blue-400' },
          { label: 'Total Lines', value: stats.totalLines.toLocaleString(), color: 'text-emerald-600 dark:text-emerald-400' },
          { label: 'Total Size', value: formatBytes(stats.totalBytes), color: 'text-purple-600 dark:text-purple-400' },
          { label: 'Avg File Size', value: formatBytes(stats.avgFileSize), color: 'text-amber-600 dark:text-amber-400' },
        ].map(card => (
          <div key={card.label} className="bg-surface rounded-xl border border-line p-4 shadow-2xs">
            <div className="text-2xs font-bold uppercase tracking-wider text-ink-muted mb-1">{card.label}</div>
            <div className={cn('text-2xl font-black', card.color)}>
              {card.value}
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Languages */}
        <div className="bg-surface rounded-xl border border-line p-4 shadow-2xs">
          <h3 className="text-xs font-bold uppercase tracking-wider text-ink mb-4">Languages</h3>
          <div className="space-y-2.5">
            {langEntries.map(([lang, count]) => (
              <div key={lang}>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-ink font-medium">{lang}</span>
                  <span className="text-ink-muted text-2xs font-semibold">{count} files</span>
                </div>
                <div className="h-2 bg-inset rounded-full overflow-hidden border border-line-subtle">
                  <div
                    className="h-full bg-brand-500 rounded-full transition-all"
                    style={{ width: `${(count / maxLang) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Directories */}
        <div className="bg-surface rounded-xl border border-line p-4 shadow-2xs">
          <h3 className="text-xs font-bold uppercase tracking-wider text-ink mb-4">Directories</h3>
          <div className="space-y-2.5">
            {dirEntries.slice(0, 12).map(([dir, count]) => (
              <div key={dir}>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-ink font-mono text-xs">{dir}/</span>
                  <span className="text-ink-muted text-2xs font-semibold">{count} files</span>
                </div>
                <div className="h-2 bg-inset rounded-full overflow-hidden border border-line-subtle">
                  <div
                    className="h-full bg-emerald-500 rounded-full transition-all"
                    style={{ width: `${(count / maxDir) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Largest files */}
        <div className="bg-surface rounded-xl border border-line p-4 shadow-2xs">
          <h3 className="text-xs font-bold uppercase tracking-wider text-ink mb-4">Largest Files</h3>
          <div className="space-y-1.5">
            {stats.largestFiles.map((f, i) => {
              const name = f.path.split('/').pop() || f.path;
              return (
                <div key={i} className="flex items-center gap-2 text-xs bg-inset rounded-lg px-3 py-2 border border-line-subtle">
                  <span className="text-ink-faint font-mono font-bold w-4">{i + 1}.</span>
                  <FileText className="w-3.5 h-3.5 text-ink-muted shrink-0" />
                  <span className="text-ink font-mono text-xs truncate flex-1 font-medium" title={f.path}>{name}</span>
                  <span className="text-ink-muted text-2xs font-semibold">{f.lines.toLocaleString()}L</span>
                  <span className="text-ink-faint">·</span>
                  <span className="text-ink-muted text-2xs font-semibold">{formatBytes(f.bytes)}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   File Viewer Component
   ═══════════════════════════════════════════════════════════ */

function FileViewer({ path, highlightLine, onClose }: { path: string; highlightLine?: number; onClose: () => void }) {
  const [file, setFile] = useState<FileContent | null>(null);
  const [loading, setLoading] = useState(true);
  const highlightRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLoading(true);
    codeIntelApi.file(path).then(d => { setFile(d); setLoading(false); }).catch(() => setLoading(false));
  }, [path]);

  useEffect(() => {
    if (highlightRef.current) {
      highlightRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [file, highlightLine]);

  if (loading) return <div className="bg-surface rounded-xl border border-line p-8 flex items-center justify-center shadow-2xs"><Spinner className="w-6 h-6" /></div>;
  if (!file) return null;

  const lines = file.content.split('\n');

  return (
    <div className="bg-surface rounded-xl border border-line overflow-hidden sticky top-4 shadow-2xs">
      <div className="flex items-center justify-between px-4 py-3 bg-inset/50 border-b border-line">
        <div className="flex items-center gap-2">
          <FileCode2 className="w-4 h-4 text-brand-600 dark:text-brand-400" />
          <span className="text-xs font-bold text-ink font-mono">{file.relativePath}</span>
          <span className="text-2xs text-ink-muted">({file.lineCount} lines · {file.language})</span>
        </div>
        <button onClick={onClose} className="text-ink-muted hover:text-ink"><X className="w-4 h-4" /></button>
      </div>
      <div className="max-h-[600px] overflow-y-auto font-mono text-xs leading-relaxed bg-canvas">
        {lines.map((line, i) => {
          const lineNum = i + 1;
          const isHighlighted = lineNum === highlightLine;
          return (
            <div
              key={i}
              ref={isHighlighted ? highlightRef : undefined}
              className={cn(
                'flex',
                isHighlighted ? 'bg-brand-500/15 border-l-2 border-brand-500' : 'border-l-2 border-transparent hover:bg-hover',
              )}
            >
              <span className="w-12 text-right px-3 py-0.5 text-ink-faint select-none shrink-0 border-r border-line-subtle text-[11px]">
                {lineNum}
              </span>
              <pre className="px-4 py-0.5 text-ink whitespace-pre overflow-x-auto flex-1 font-mono text-[11px]">{line || ' '}</pre>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   TAB 5: Repo Q&A (Code Assistant)
   ═══════════════════════════════════════════════════════════ */

function AskTab() {
  const [question, setQuestion] = useState('');
  const [chatModel, setChatModel] = useState(() => localStorage.getItem('nexus:code_intel_model') || '');
  const [availableModels, setAvailableModels] = useState<Array<{ id: string; name: string; provider: string }>>([]);
  useEffect(() => { api.llmProviders.availableModels().then((r) => setAvailableModels(r.models)).catch(() => {}); }, []);
  const [loading, setLoading] = useState(false);
  const [fileViewer, setFileViewer] = useState<{ path: string; highlightLine?: number } | null>(null);
  const [result, setResult] = useState<{
    question: string;
    answer: string;
    citations: { file: string; line?: number; reason: string }[];
    relatedSymbols: CodeSymbol[];
  } | null>(null);

  const sampleQuestions = [
    'How does authentication and JWT work in Nexus?',
    'Where is the OpenClaw Gateway RPC client implemented?',
    'How are agent approvals and board workflows structured?',
    'What metrics and token usage tracking are implemented in Prisma?',
  ];

  const handleAsk = async (qText?: string) => {
    const q = qText || question;
    if (!q.trim()) return;
    setLoading(true);
    try {
      const data = await codeIntelApi.ask(q, chatModel || undefined);
      setResult(data);
      if (qText) setQuestion(qText);
    } catch {
      setResult({
        question: q,
        answer: 'Failed to process codebase query. Ensure the backend server is running.',
        citations: [],
        relatedSymbols: [],
      });
    }
    setLoading(false);
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="bg-surface rounded-xl border border-line p-6 space-y-4 shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-500 to-indigo-600 flex items-center justify-center text-white shadow-xs">
            <Bot className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-base font-bold text-ink">Ask the Nexus AI Repository</h2>
            <p className="text-xs text-ink-muted">Grounded code understanding with file citations and symbol tracing</p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <label className="text-[11px] font-semibold uppercase tracking-wider text-ink-faint">Model</label>
              <select value={chatModel} onChange={(e) => { setChatModel(e.target.value); localStorage.setItem('nexus:code_intel_model', e.target.value); }} className="h-8 rounded-md border border-line bg-inset px-2 text-xs text-ink">
                <option value="">Auto / configured default</option>
                {availableModels.map((m) => <option key={m.id} value={m.id}>{m.provider} / {m.name}</option>)}
              </select>
            </div>
          </div>
        </div>

        <div className="relative">
          <textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleAsk();
              }
            }}
            placeholder="Ask anything about the codebase (e.g., 'How does the OpenClaw Gateway connect?')..."
            rows={3}
            className="w-full px-4 py-3 bg-canvas border border-line rounded-xl text-xs text-ink placeholder:text-ink-faint focus:border-brand-500 focus:outline-none resize-none shadow-2xs"
          />
          <div className="flex justify-between items-center mt-2">
            <span className="text-[11px] text-ink-muted">Press Enter to ask, Shift+Enter for new line</span>
            <Button
              variant="primary"
              size="sm"
              onClick={() => handleAsk()}
              disabled={loading || !question.trim()}
              className="gap-2"
            >
              {loading ? <Spinner className="w-4 h-4" /> : <Send className="w-3.5 h-3.5" />}
              {loading ? 'Analyzing Codebase...' : 'Ask Assistant'}
            </Button>
          </div>
        </div>

        {/* Suggested Queries */}
        <div className="pt-2">
          <div className="text-2xs text-ink-muted font-bold uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-brand-500" />
            Suggested questions:
          </div>
          <div className="flex flex-wrap gap-2">
            {sampleQuestions.map((sq, i) => (
              <button
                key={i}
                onClick={() => handleAsk(sq)}
                className="text-xs px-3 py-1.5 rounded-lg bg-inset border border-line text-ink-muted hover:text-ink hover:border-line-strong transition-colors text-left shadow-2xs font-medium"
              >
                {sq}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Answer Output */}
      {result && (
        <div className="bg-surface rounded-xl border border-line p-6 space-y-6 shadow-2xs">
          <div>
            <h3 className="text-2xs font-bold uppercase tracking-wider text-brand-600 dark:text-brand-400 mb-2">Question</h3>
            <p className="text-sm font-bold text-ink">{result.question}</p>
          </div>

          <div className="border-t border-line-subtle pt-4">
            <h3 className="text-2xs font-bold uppercase tracking-wider text-ink-muted mb-3">Synthesis & Explanation</h3>
            <div className="text-xs leading-relaxed text-ink whitespace-pre-wrap font-mono bg-inset p-4 rounded-xl border border-line-subtle">
              {result.answer}
            </div>
          </div>

          {/* Citations */}
          {result.citations.length > 0 && (
            <div className="border-t border-line-subtle pt-4">
              <h3 className="text-2xs font-bold uppercase tracking-wider text-ink-muted mb-3">
                Source Citations ({result.citations.length}) — Click to view file
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {result.citations.map((c, idx) => (
                  <button
                    key={idx}
                    onClick={() => setFileViewer({ path: c.file, highlightLine: c.line })}
                    className="bg-inset hover:bg-hover rounded-lg p-3 border border-line-subtle hover:border-brand-500/50 transition-all text-left group shadow-2xs"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <FileCode2 className="w-3.5 h-3.5 text-brand-600 dark:text-brand-400 shrink-0" />
                      <span className="text-xs font-mono text-brand-700 dark:text-brand-300 group-hover:underline truncate font-bold">{c.file}</span>
                      {c.line && <span className="text-[10px] text-ink-faint">L{c.line}</span>}
                      <ExternalLink className="w-3 h-3 text-ink-muted ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                    <p className="text-[11px] text-ink-muted line-clamp-2">{c.reason}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Interactive File Viewer for Citations */}
          {fileViewer && (
            <div className="border-t border-line-subtle pt-4">
              <FileViewer
                path={fileViewer.path}
                highlightLine={fileViewer.highlightLine}
                onClose={() => setFileViewer(null)}
              />
            </div>
          )}

          {/* Related symbols */}
          {result.relatedSymbols.length > 0 && (
            <div className="border-t border-line-subtle pt-4">
              <h3 className="text-2xs font-bold uppercase tracking-wider text-ink-muted mb-3">
                Key Symbols Located ({result.relatedSymbols.length})
              </h3>
              <div className="flex flex-wrap gap-1.5">
                {result.relatedSymbols.map((sym, idx) => (
                  <span
                    key={idx}
                    className="text-xs font-mono px-2.5 py-1 rounded-md bg-inset border border-line text-ink flex items-center gap-1.5"
                  >
                    <span className="text-brand-600 dark:text-brand-400 font-bold">{sym.kind}</span>
                    <span>{sym.name}</span>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
